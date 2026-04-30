/**
 * Последняя сессия с 12× protocol.coordinate_assigned → один запрос в LLM, замер latency, *.md.
 *
 * По умолчанию (--mode=card) тот же путь, что прод: координаты из событий → assemble/match/confidence
 * → prompts/cognitive-card-render.md через renderCognitiveCardMarkdown (max_tokens см. render-card).
 *
 * --mode=transcript — прежний разбор по осям по тексту 12 вопросов/ответов (длинный user prompt).
 *
 * Запуск из корня репозитория:
 *   node --env-file=.env ./node_modules/tsx/dist/cli.mjs scripts/replay-protocol-session-to-llm.ts
 * Опции:
 *   --out=path/to/out.md   иначе replay-protocol-llm-<mode>-<session-prefix>-<timestamp>.md в cwd
 *   --session=<uuid>       иначе последняя полная сессия
 *   --mode=card|transcript
 *
 * Env: REPLAY_LLM_TIMEOUT_MS — таймаут HTTP (мс). Если не задан: не ниже 180000 мс и не ниже
 * CARD_RENDER_TIMEOUT_MS/LLM_TIMEOUT_MS (card) или LLM_TIMEOUT_MS (transcript).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import {
  assembleCoordinates,
  computeConfidence,
  matchTypes,
  type ProtocolAnswersMapped,
} from '../src/aeon/cognitive-engine.js';
import { loadConfig } from '../src/config.js';
import type { DomainLogger } from '../src/util/domain-log.js';
import { renderCognitiveCardMarkdown } from '../src/llm/render-card.js';
import { openAiChatCompletionUserMessage } from '../src/llm/openai-chat-completion.js';
import { formatProtocolQuestionMessageMarkdown, getProtocolQuestion } from '../src/protocols/cognitive_v1/questions.js';
import { PROTOCOL_QUESTION_IDS } from '../src/protocols/cognitive_v1/queue.js';
import type { GoalLabel, AnchorLetter } from '../src/protocols/cognitive_v1/types.js';
import type { ModalityLetter } from '../src/protocols/cognitive_v1/types.js';

/** Нижняя граница HTTP-таймаута replay без REPLAY_LLM_TIMEOUT_MS (карта §6 + до 4096 выходных токенов). */
const REPLAY_LLM_DEFAULT_MS = 180_000;

const dsn = process.env.DATABASE_URL;
if (!dsn) {
  console.error('Нет DATABASE_URL');
  process.exit(1);
}

const TRANSCRIPT_MAX_OUT_TOKENS = 4096;
const USER_PROMPT_PREFIX = `Ты аналитик протокола Cognitive Identity Map v1. Ниже 12 шагов диалога с пользователем: для каждого шага дан текст вопроса (как в чате) и ответ пользователя.

Задача: дай сжатый разбор по-русски (обычный markdown): ось за осью (цели → модальность → якорь), внутренняя связность ответов, что выглядит стабильным и где возможные противоречия или спешка. Не придумывай ответы и не продолжай опрос — только работа с уже данным текстом.

---

`;

type ReplayMode = 'card' | 'transcript';

const replayLog: DomainLogger = {
  info: () => {},
  warn: (obj, msg) => console.warn(msg ?? 'warn', obj),
};

function parseArgs(): { outPath: string | null; sessionId: string | null; mode: ReplayMode } {
  let outPath: string | null = null;
  let sessionId: string | null = null;
  let mode: ReplayMode = 'card';
  for (const a of process.argv.slice(2)) {
    if (a.startsWith('--out=')) outPath = a.slice('--out='.length);
    else if (a.startsWith('--session=')) sessionId = a.slice('--session='.length);
    else if (a.startsWith('--mode=')) {
      const m = a.slice('--mode='.length).toLowerCase();
      if (m === 'card' || m === 'transcript') mode = m;
      else console.warn(`Неизвестный --mode=${m}, используется card`);
    }
  }
  return { outPath, sessionId, mode };
}

async function resolveSessionId(pool: pg.Pool, explicit: string | null): Promise<string | null> {
  if (explicit && explicit.trim()) return explicit.trim();
  const r = await pool.query<{ sid: string }>(
    `SELECT payload->>'session_id' AS sid
     FROM events
     WHERE event_type = 'protocol.coordinate_assigned'
     GROUP BY payload->>'session_id'
     HAVING COUNT(DISTINCT payload->>'question_id') >= 12
     ORDER BY MAX(occurred_at) DESC
     LIMIT 1`,
  );
  return r.rows[0]?.sid ?? null;
}

async function loadLatestQuestions(
  pool: pg.Pool,
  sessionId: string,
): Promise<Map<string, string>> {
  const r = await pool.query<{ qid: string; qtext: string }>(
    `SELECT DISTINCT ON ((payload->>'question_id'))
       payload->>'question_id' AS qid,
       COALESCE(payload->>'question_text', '') AS qtext
     FROM events
     WHERE event_type = 'question.asked'
       AND payload->>'session_id' = $1
     ORDER BY (payload->>'question_id'), occurred_at DESC`,
    [sessionId],
  );
  const m = new Map<string, string>();
  for (const row of r.rows) {
    if (row.qid) m.set(row.qid, row.qtext);
  }
  return m;
}

async function loadLatestAnswers(pool: pg.Pool, sessionId: string): Promise<Map<string, string>> {
  const r = await pool.query<{ qid: string; aval: string }>(
    `SELECT DISTINCT ON ((payload->>'question_id'))
       payload->>'question_id' AS qid,
       COALESCE(payload->>'answer_value', '') AS aval
     FROM events
     WHERE event_type = 'answer.given'
       AND payload->>'session_id' = $1
     ORDER BY (payload->>'question_id'), occurred_at DESC`,
    [sessionId],
  );
  const m = new Map<string, string>();
  for (const row of r.rows) {
    if (row.qid) m.set(row.qid, row.aval);
  }
  return m;
}

/** Как в deliver-card-computed: порядок событий, последняя запись по question_id побеждает. */
async function loadCoordinateAssignedForSession(
  pool: pg.Pool,
  sessionId: string,
): Promise<Map<string, { axis: string; coordinate: string }>> {
  const r = await pool.query<{ payload: Record<string, unknown> }>(
    `SELECT payload
     FROM events
     WHERE event_type = 'protocol.coordinate_assigned'
       AND payload->>'session_id' = $1
     ORDER BY occurred_at ASC, event_id ASC`,
    [sessionId],
  );
  const byQuestionCoord = new Map<string, { axis: string; coordinate: string }>();
  for (const row of r.rows) {
    const p = row.payload;
    const qid = String(p.question_id ?? p.source_question_id ?? '');
    const axis = String(p.axis ?? '');
    const coordinate = String(p.coordinate ?? '');
    if (!qid || !axis) continue;
    byQuestionCoord.set(qid, { axis, coordinate });
  }
  return byQuestionCoord;
}

function coordsPayload(coords: ReturnType<typeof assembleCoordinates>): Record<string, unknown> {
  return {
    primary_goal: coords.primaryGoal,
    secondary_goal: coords.secondaryGoal,
    core_formation: coords.coreFormation,
    goal_votes: [...coords.goalVotes],
    modality_profile: [...coords.modalityProfile],
    anchor_letters: [...coords.anchorLetters],
    dominant_anchor_letter: coords.dominantAnchorLetter,
  };
}

function mappedFromCoordinates(
  byQuestionCoord: Map<string, { axis: string; coordinate: string }>,
  sessionId: string,
): ProtocolAnswersMapped | { error: string } {
  const goals: GoalLabel[] = [];
  const modalities: ModalityLetter[] = [];
  const anchors: AnchorLetter[] = [];

  for (const qid of PROTOCOL_QUESTION_IDS) {
    const c = byQuestionCoord.get(qid);
    if (!c) {
      return { error: `deliverCardComputed: missing coordinate for ${qid} (session ${sessionId})` };
    }
    const { axis, coordinate } = c;
    if (axis === 'goal') {
      goals.push(coordinate as GoalLabel);
    } else if (axis === 'modality') {
      modalities.push(coordinate as ModalityLetter);
    } else if (axis === 'anchor') {
      anchors.push(coordinate as AnchorLetter);
    }
  }

  return { goals, modalities, anchors };
}

function questionBodyForStep(questionId: string, askedText: string): string {
  const t = askedText.trim();
  if (t.length > 0) return t;
  const def = getProtocolQuestion(questionId);
  return def ? formatProtocolQuestionMessageMarkdown(def) : `(вопрос ${questionId}: текста нет в событиях)`;
}

function buildTranscript(
  sessionId: string,
  questions: Map<string, string>,
  answers: Map<string, string>,
): string {
  const lines: string[] = [`session_id: ${sessionId}`, ''];
  let i = 1;
  for (const qid of PROTOCOL_QUESTION_IDS) {
    const body = questionBodyForStep(qid, questions.get(qid) ?? '');
    const ans = answers.get(qid) ?? '(нет answer.given)';
    lines.push(`## Шаг ${i}/12 — ${qid}`, '', '### Вопрос', '', body, '', '### Ответ пользователя', '', ans, '', '---', '');
    i++;
  }
  return lines.join('\n').trim();
}

async function callAnthropic(opts: {
  apiKey: string;
  model: string;
  userContent: string;
  timeoutMs: number;
  maxTokens: number;
}): Promise<{ text: string; latencyMs: number }> {
  const t0 = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs);
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        'x-api-key': opts.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: opts.model,
        max_tokens: opts.maxTokens,
        messages: [{ role: 'user', content: opts.userContent }],
      }),
    });
    const latencyMs = Date.now() - t0;
    const raw = await res.text();
    if (!res.ok) throw new Error(`Anthropic ${res.status}: ${raw.slice(0, 500)}`);
    const data = JSON.parse(raw) as { content?: Array<{ type: string; text?: string }> };
    const block = data.content?.find((c) => c.type === 'text');
    const text = block?.text?.trim() ?? '';
    if (!text) throw new Error('Anthropic: пустой ответ');
    return { text, latencyMs };
  } finally {
    clearTimeout(timer);
  }
}

async function main(): Promise<void> {
  const config = loadConfig();
  const { outPath: outArg, sessionId: sessionArg, mode } = parseArgs();

  const replayTimeoutMsFromEnv = process.env.REPLAY_LLM_TIMEOUT_MS
    ? Number(process.env.REPLAY_LLM_TIMEOUT_MS)
    : undefined;

  const replayTimeoutMs =
    replayTimeoutMsFromEnv ??
    (mode === 'card'
      ? Math.max(config.cardRenderTimeoutMs ?? config.llmTimeoutMs, REPLAY_LLM_DEFAULT_MS)
      : Math.max(config.llmTimeoutMs, REPLAY_LLM_DEFAULT_MS));

  const pool = new pg.Pool({ connectionString: dsn });
  try {
    const sessionId = await resolveSessionId(pool, sessionArg);
    if (!sessionId) {
      console.error('Не найдена сессия с 12 координатами (или неверный --session).');
      process.exit(2);
    }

    let text = '';
    let latencyMs = 0;
    let provider: 'anthropic' | 'openai' = 'anthropic';
    let model = config.anthropicModel;
    let promptVersion = '';
    let inputHash = '';
    let appendix = '';

    if (mode === 'card') {
      const byCoord = await loadCoordinateAssignedForSession(pool, sessionId);
      const mappedOrErr = mappedFromCoordinates(byCoord, sessionId);
      if ('error' in mappedOrErr) {
        console.error(mappedOrErr.error);
        process.exit(2);
      }
      const assembled = assembleCoordinates(mappedOrErr);
      const matched = matchTypes(assembled);
      const confidenceResult = computeConfidence(assembled, matched);
      const coordsRecord = coordsPayload(assembled);
      const coreUnformed = assembled.coreFormation === 'unformed';
      const narrativeMatchedNames = matched.matchedTypes.map((t) => t.name);

      const rendered = await renderCognitiveCardMarkdown({
        config,
        log: replayLog,
        promptArgs: {
          sessionId,
          coordinates: coordsRecord,
          matchedTypeNames: narrativeMatchedNames,
          syntheticDrawing: matched.syntheticDrawing,
          coreUnformed,
          confidenceResolution: confidenceResult.resolution,
          confidenceMessage: confidenceResult.message,
        },
        timeoutMs: replayTimeoutMs,
      });
      text = rendered.cardMarkdown;
      latencyMs = rendered.latencyMs;
      provider = rendered.provider;
      model = rendered.model;
      promptVersion = rendered.promptVersion;
      inputHash = rendered.inputHash;
      appendix = ['# Вход: координаты (JSON)', '', JSON.stringify(coordsRecord, null, 2), ''].join('\n');
    } else {
      const [qMap, aMap] = await Promise.all([
        loadLatestQuestions(pool, sessionId),
        loadLatestAnswers(pool, sessionId),
      ]);

      const transcript = buildTranscript(sessionId, qMap, aMap);
      const userContent = `${USER_PROMPT_PREFIX}${transcript}`;
      appendix = ['# Вход: транскрипт протокола', '', transcript, ''].join('\n');

      if (config.anthropicApiKey) {
        try {
          const r = await callAnthropic({
            apiKey: config.anthropicApiKey,
            model: config.anthropicModel,
            userContent,
            timeoutMs: replayTimeoutMs,
            maxTokens: TRANSCRIPT_MAX_OUT_TOKENS,
          });
          text = r.text;
          latencyMs = r.latencyMs;
        } catch (e) {
          console.warn('Anthropic failed:', e instanceof Error ? e.message : e);
        }
      }

      if (!text && config.openaiApiKey) {
        provider = 'openai';
        model = config.openaiTextModel;
        const t0 = Date.now();
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), replayTimeoutMs);
        try {
          text = await openAiChatCompletionUserMessage({
            apiKey: config.openaiApiKey,
            model: config.openaiTextModel,
            userContent,
            signal: ctrl.signal,
            maxTokens: TRANSCRIPT_MAX_OUT_TOKENS,
          });
          latencyMs = Date.now() - t0;
        } catch (e) {
          console.warn('OpenAI failed:', e instanceof Error ? e.message : e);
        } finally {
          clearTimeout(timer);
        }
      }
    }

    if (!text) {
      console.error('Нет ответа LLM: проверь ANTHROPIC_API_KEY / OPENAI_API_KEY.');
      process.exit(3);
    }

    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const defaultName = `replay-protocol-llm-${mode}-${sessionId.slice(0, 8)}-${stamp}.md`;
    const out =
      outArg && outArg.trim()
        ? path.resolve(process.cwd(), outArg.trim())
        : path.resolve(process.cwd(), defaultName);

    const dir = path.dirname(out);
    mkdirSync(dir, { recursive: true });

    const yamlLines = [
      '---',
      `generated_at: ${new Date().toISOString()}`,
      `session_id: ${sessionId}`,
      `replay_mode: ${mode}`,
      `llm_provider: ${provider}`,
      `llm_model: ${model}`,
      `latency_ms: ${latencyMs}`,
      `replay_llm_timeout_ms: ${replayTimeoutMs}`,
    ];
    if (promptVersion) yamlLines.push(`prompt_version: ${promptVersion}`);
    if (inputHash) yamlLines.push(`input_hash: ${inputHash}`);
    yamlLines.push('---');

    const md = [
      ...yamlLines,
      '',
      mode === 'card' ? '# Карта (card_render)' : '# Ответ модели',
      '',
      text.trim(),
      '',
      '---',
      '',
      appendix.trim(),
      '',
    ].join('\n');

    writeFileSync(out, md, 'utf8');
    console.log(`Записано: ${out}`);
    console.log(`latency_ms=${latencyMs} provider=${provider} model=${model} mode=${mode}`);
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

import type { Pool } from 'pg';
import type { Config } from '../config.js';
import { CORE_FIRST_QUESTION_ID, CORE_LLM_QUESTION_RE } from './constants.js';
import { fetchDialogEventsForUser } from '../db/dialog-events.js';
import { insertLlmCalled, insertQuestionAskedLlm } from '../db/llm-events.js';
import { sendMaxUserMessage } from '../integrations/max/client.js';
import type { DomainLogger } from '../util/domain-log.js';
import { dbg } from '../util/domain-log.js';
import { generateNextQuestion } from '../llm/next-question.js';
import type { DialogState } from './resolve-state.js';

export async function deliverNextLlmQuestion(opts: {
  pool: Pool;
  config: Config;
  maxUserId: number;
  state: Extract<DialogState, { type: 'needs_next_llm' }>;
  log: DomainLogger;
}): Promise<void> {
  const { pool, config, maxUserId, state, log } = opts;
  const { sessionId, lastAnswerQuestionId } = state;

  let llmTurn: number;
  if (lastAnswerQuestionId === CORE_FIRST_QUESTION_ID) {
    llmTurn = 1;
  } else {
    const m = CORE_LLM_QUESTION_RE.exec(lastAnswerQuestionId);
    if (!m) {
      log.warn({ lastAnswerQuestionId }, 'deliverNextLlm: unexpected question id');
      return;
    }
    llmTurn = Number(m[1]) + 1;
  }

  if (llmTurn > config.llmFollowupCount) {
    return;
  }

  const rows = await fetchDialogEventsForUser(pool, maxUserId);
  dbg(log, 'dialog.llm.next_question_generate', { sessionId, llmTurn });
  let gen;
  try {
    gen = await generateNextQuestion({ config, events: rows, sessionId, log });
  } catch (e) {
    log.warn({ err: e }, 'deliverNextLlm: generate failed');
    return;
  }

  const llmRow = await insertLlmCalled(pool, {
    maxUserId,
    sessionId,
    llmTurn,
    model: gen.model,
    provider: gen.provider,
    promptVersion: gen.promptVersion,
    inputHash: gen.inputHash,
    latencyMs: gen.latencyMs,
    questionText: gen.text,
  });

  const qIns = await insertQuestionAskedLlm(pool, {
    maxUserId,
    sessionId,
    llmTurn,
    questionText: gen.text,
    llmCallEventId: llmRow.eventId,
  });

  if (qIns === 'inserted' && config.maxBotToken) {
    await sendMaxUserMessage({
      baseUrl: config.maxApiBaseUrl,
      token: config.maxBotToken,
      userId: maxUserId,
      text: gen.text,
    });
  } else if (qIns === 'inserted' && !config.maxBotToken) {
    log.warn('MAX_BOT_TOKEN empty: skip LLM question send');
  }
}

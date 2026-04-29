import type { Pool } from 'pg';
import type { Config } from '../config.js';
import type { MapAnswerOk } from '../protocol_mapper/map-answer.js';
import { mapAnswerToCoordinate } from '../protocol_mapper/map-answer.js';
import {
  fetchProtocolCoordinatesPriorToQuestion,
  insertAnswerInterpreted,
  insertProtocolCoordinateAssigned,
} from '../db/protocol-events.js';
import { insertLlmCalledAnswerInterpretation } from '../db/llm-events.js';
import { insertQuestionAskedProtocol } from '../db/session-events.js';
import { interpretProtocolAnswer } from '../llm/interpret-answer.js';
import {
  formatMapperInvalidReplyMarkdown,
  formatPriorCoordinatesSummaryForInterpret,
  formatProtocolQuestionMessageMarkdown,
  getProtocolQuestion,
} from '../protocols/cognitive_v1/questions.js';
import { nextQuestionAfter } from '../protocols/cognitive_v1/queue.js';
import { COGNITIVE_CARD_TYPE } from './protocol-constants.js';
import { sendMaxUserMessage } from '../integrations/max/client.js';
import { deliverCardComputed } from './deliver-card-computed.js';

/** Убирает JSON-хвост и типичные markdown-fences вокруг JSON — пользователь видит только прозу. */
function stripInterpretationForUser(text: string): string {
  let t = text.trim();
  t = t.replace(/\s*`{3}(?:json)?\s*\{[\s\S]*?"coordinate"[\s\S]*?\}\s*`{3}\s*$/u, '');
  const lines = t.split(/\r?\n/);
  while (lines.length > 0) {
    const last = lines[lines.length - 1]?.trim() ?? '';
    if (last.startsWith('{') && last.includes('"coordinate"')) {
      lines.pop();
      continue;
    }
    break;
  }
  while (lines.length > 0 && lines[lines.length - 1]?.trim() === '```') {
    lines.pop();
  }
  return lines.join('\n').trim();
}

export async function deliverProtocolStep(opts: {
  pool: Pool;
  config: Config;
  maxUserId: number;
  sessionId: string;
  questionId: string;
  answerText: string;
  answerEventId: string;
  /** Если передан (валидный mapper из webhook), повторный разбор текста не делается. */
  preMapped?: MapAnswerOk;
  log: { warn: (o: unknown, msg?: string) => void; info: (o: unknown, msg?: string) => void };
}): Promise<void> {
  const { pool, config, maxUserId, sessionId, questionId, answerText, answerEventId, log } = opts;

  const mapped = opts.preMapped ?? mapAnswerToCoordinate(questionId, answerText);
  if (!mapped.ok) {
    if (config.maxBotToken) {
      await sendMaxUserMessage({
        baseUrl: config.maxApiBaseUrl,
        token: config.maxBotToken,
        userId: maxUserId,
        text: formatMapperInvalidReplyMarkdown(questionId),
        format: 'markdown',
      });
    } else {
      log.warn('mapper invalid / MAX_BOT_TOKEN empty');
    }
    return;
  }

  await insertProtocolCoordinateAssigned(pool, {
    sessionId,
    maxUserId,
    questionId,
    answerEventId,
    cardType: COGNITIVE_CARD_TYPE,
    axis: mapped.axis,
    coordinate: mapped.coordinate,
    sourceQuestionId: questionId,
  });

  const priorRows = await fetchProtocolCoordinatesPriorToQuestion(pool, sessionId, questionId);
  const priorSummary = formatPriorCoordinatesSummaryForInterpret(priorRows);

  let interp;
  try {
    interp = await interpretProtocolAnswer({
      config,
      sessionId,
      questionId,
      answerText,
      mappedAxis: mapped.axis,
      mappedCoordinate: mapped.coordinate,
      priorCoordinatesSummary: priorSummary,
      log,
    });
  } catch (e) {
    log.warn({ err: e }, 'deliverProtocolStep: interpret failed');
    return;
  }

  const summaryLine = stripInterpretationForUser(interp.interpretationText).slice(0, 240);
  const llmRow = await insertLlmCalledAnswerInterpretation(pool, {
    maxUserId,
    sessionId,
    questionId,
    model: interp.model,
    provider: interp.provider,
    promptVersion: interp.promptVersion,
    inputHash: interp.inputHash,
    latencyMs: interp.latencyMs,
    summaryText: summaryLine || '(interpretation)',
  });

  await insertAnswerInterpreted(pool, {
    sessionId,
    maxUserId,
    questionId,
    axis: mapped.axis,
    coordinate: mapped.coordinate,
    llmCallId: llmRow.eventId,
    interpretationText: interp.interpretationText,
  });

  const next = nextQuestionAfter(questionId);
  if (next == null) {
    await deliverCardComputed({ pool, config, maxUserId, sessionId, log });
    return;
  }

  const nextDef = getProtocolQuestion(next);
  if (!nextDef) {
    log.warn({ next }, 'deliverProtocolStep: next question def missing');
    return;
  }

  const nextBodyMd = formatProtocolQuestionMessageMarkdown(nextDef);
  const qIns = await insertQuestionAskedProtocol(pool, {
    maxUserId,
    sessionId,
    questionId: next,
    questionText: nextBodyMd,
    cognitiveProtocolVersion: config.cognitiveProtocolVersion,
  });

  if (qIns === 'inserted' && config.maxBotToken) {
    const interpHuman = stripInterpretationForUser(interp.interpretationText);
    if (interpHuman.trim().length > 0) {
      await sendMaxUserMessage({
        baseUrl: config.maxApiBaseUrl,
        token: config.maxBotToken,
        userId: maxUserId,
        text: interpHuman,
      });
    }
    await sendMaxUserMessage({
      baseUrl: config.maxApiBaseUrl,
      token: config.maxBotToken,
      userId: maxUserId,
      text: nextBodyMd,
      format: 'markdown',
    });
  } else if (qIns === 'inserted' && !config.maxBotToken) {
    log.warn('MAX_BOT_TOKEN empty: skip protocol step outbound');
  }
}

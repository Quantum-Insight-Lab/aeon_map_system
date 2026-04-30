import type { Pool } from 'pg';
import type { Config } from '../config.js';
import { dbg, type DomainLogger } from '../util/domain-log.js';
import { deliverNextLlmQuestion } from './deliver-next-llm.js';
import { deliverProtocolStep } from './deliver-protocol-step.js';
import type { InferDialogStateOpts } from './resolve-state.js';
import { inferDialogState } from './resolve-state.js';
import { fetchDialogEventsForUser } from '../db/dialog-events.js';
import { insertAnswerGiven } from '../db/session-events.js';
import { sendMaxUserMessage } from '../integrations/max/client.js';
import { mapAnswerToCoordinate } from '../protocol_mapper/map-answer.js';
import { formatMapperInvalidReplyMarkdown } from '../protocols/cognitive_v1/questions.js';
import { PROTOCOL_FIRST_QUESTION_ID, type ProtocolQuestionId } from '../protocols/cognitive_v1/queue.js';

/** Общий путь: mapper → answer.given → deliverProtocolStep (+ опционально LLM chain). */
export async function runProtocolAnswerPipeline(opts: {
  pool: Pool;
  config: Config;
  maxUserId: number;
  sessionId: string;
  questionId: ProtocolQuestionId;
  answerText: string;
  maxUpdateId: string;
  answerType: 'text' | 'callback';
  inferOpts: InferDialogStateOpts;
  log: DomainLogger;
}): Promise<void> {
  const {
    pool,
    config,
    maxUserId,
    sessionId,
    questionId,
    answerText,
    maxUpdateId,
    answerType,
    inferOpts,
    log,
  } = opts;

  dbg(log, 'dialog.protocol.answer_pipeline', {
    questionId,
    answerType,
    maxUpdateId,
    sessionId,
    maxUserId,
  });

  const mapped = mapAnswerToCoordinate(questionId, answerText);
  if (!mapped.ok) {
    if (config.maxBotToken) {
      await sendMaxUserMessage({
        baseUrl: config.maxApiBaseUrl,
        token: config.maxBotToken,
        userId: maxUserId,
        text: formatMapperInvalidReplyMarkdown(questionId),
        format: 'markdown',
      });
    }
    return;
  }

  const ansIns = await insertAnswerGiven(pool, {
    maxUserId,
    sessionId,
    questionId,
    answerValue: answerText,
    answerType,
    maxUpdateId,
  });

  if (ansIns.inserted && questionId === PROTOCOL_FIRST_QUESTION_ID && config.maxBotToken) {
    await sendMaxUserMessage({
      baseUrl: config.maxApiBaseUrl,
      token: config.maxBotToken,
      userId: maxUserId,
      text: config.dialogAnswerAckText,
    });
  } else if (ansIns.inserted && questionId === PROTOCOL_FIRST_QUESTION_ID && !config.maxBotToken) {
    log.warn('MAX_BOT_TOKEN empty: skip answer ack');
  }

  if (!ansIns.inserted) {
    return;
  }

  await deliverProtocolStep({
    pool,
    config,
    maxUserId,
    sessionId,
    questionId,
    answerText,
    answerEventId: ansIns.eventId,
    preMapped: mapped,
    log,
  });

  const rows = await fetchDialogEventsForUser(pool, maxUserId);
  const state = inferDialogState(rows, inferOpts);
  if (state.type === 'needs_next_llm' && config.dialogLlmNextQuestion) {
    await deliverNextLlmQuestion({ pool, config, maxUserId, state, log });
  }
}

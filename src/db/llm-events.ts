import type { Pool } from 'pg';
import { coreLlmQuestionId, DIALOG_LAYER_CORE } from '../dialog/constants.js';
import { insertEventWithId } from './insert-event.js';

export type InsertLlmCalledParams = {
  maxUserId: number;
  sessionId: string;
  /** Номер LLM-вопроса 1..N (question_id будет core:llm:k). */
  llmTurn: number;
  model: string;
  provider: 'anthropic' | 'openai';
  promptVersion: string;
  inputHash: string;
  latencyMs: number;
  /** Черновик текста следующего вопроса (восстановление, если question.asked не записался). */
  questionText: string;
};

export async function insertLlmCalled(
  pool: Pool,
  params: InsertLlmCalledParams,
): Promise<{ eventId: string; inserted: boolean }> {
  const idempotencyKey = `llm.called:${params.sessionId}:core:llm:${params.llmTurn}`;
  const r = await insertEventWithId(pool, {
    eventType: 'llm.called',
    actor: { id: 'aeon-max-bot', role: 'service' },
    subject: { entity: 'session', id: params.sessionId },
    payload: {
      session_id: params.sessionId,
      max_user_id: params.maxUserId,
      model: params.model,
      provider: params.provider,
      prompt_version: params.promptVersion,
      input_hash: params.inputHash,
      latency_ms: params.latencyMs,
      question_text: params.questionText,
    },
    idempotencyKey,
    schemaVersion: 1,
    correlationId: params.sessionId,
  });
  return { eventId: r.eventId, inserted: r.inserted };
}

export async function insertQuestionAskedLlm(
  pool: Pool,
  params: {
    maxUserId: number;
    sessionId: string;
    llmTurn: number;
    questionText: string;
    llmCallEventId: string;
  },
): Promise<'inserted' | 'duplicate'> {
  const qid = coreLlmQuestionId(params.llmTurn);
  const r = await insertEventWithId(pool, {
    eventType: 'question.asked',
    actor: { id: 'aeon-max-bot', role: 'service' },
    subject: { entity: 'session', id: params.sessionId },
    payload: {
      session_id: params.sessionId,
      question_id: qid,
      question_text: params.questionText,
      layer: DIALOG_LAYER_CORE,
      llm_call_id: params.llmCallEventId,
      max_user_id: params.maxUserId,
    },
    idempotencyKey: `question.asked:${params.sessionId}:${qid}`,
    schemaVersion: 1,
    correlationId: params.sessionId,
  });
  return r.inserted ? 'inserted' : 'duplicate';
}

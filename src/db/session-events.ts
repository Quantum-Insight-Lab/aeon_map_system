import { v7 as uuidv7 } from 'uuid';
import type { Pool } from 'pg';
import { CORE_FIRST_QUESTION_ID, DIALOG_LAYER_CORE } from '../dialog/constants.js';
import { getPayloadByIdempotencyKey } from './dialog-events.js';
import { insertEvent } from './insert-event.js';

export type InsertSessionOpenedParams = {
  maxUserId: number;
  sessionId: string;
  /** mid первого message_created, из которого открыли сессию; для bot_started не задавать. */
  openingMessageMid?: string | null;
};

/** Одна сессия iter-2 на пользователя (идемпотентность). */
export async function insertSessionOpened(
  pool: Pool,
  params: InsertSessionOpenedParams,
): Promise<'inserted' | 'duplicate'> {
  const payload: Record<string, unknown> = {
    session_id: params.sessionId,
    layer: DIALOG_LAYER_CORE,
    question_count_plan: [1],
    max_user_id: params.maxUserId,
  };
  if (params.openingMessageMid != null && params.openingMessageMid !== '') {
    payload.opening_message_mid = params.openingMessageMid;
  }

  return insertEvent(pool, {
    eventType: 'session.opened',
    actor: { id: 'aeon-max-bot', role: 'service' },
    subject: { entity: 'session', id: params.sessionId },
    payload,
    idempotencyKey: `session.opened:iter2:${params.maxUserId}`,
    schemaVersion: 1,
    correlationId: params.sessionId,
  });
}

/** Вставляет session.opened (iter-2) или возвращает session_id из уже существующей строки. */
export async function ensureIter2SessionAndGetId(
  pool: Pool,
  params: InsertSessionOpenedParams,
): Promise<string> {
  const key = `session.opened:iter2:${params.maxUserId}`;
  const ins = await insertSessionOpened(pool, params);
  if (ins === 'inserted') {
    return params.sessionId;
  }
  const payload = await getPayloadByIdempotencyKey(pool, key);
  const sid = payload?.session_id;
  if (sid == null) {
    throw new Error(`session.opened duplicate but payload missing session_id for user ${params.maxUserId}`);
  }
  return String(sid);
}

/** Вызывать после успешного insertSessionOpened с тем же sessionId и openingMessageMid. */
export async function insertQuestionAskedFirstCore(
  pool: Pool,
  params: {
    maxUserId: number;
    sessionId: string;
    questionText: string;
  },
): Promise<'inserted' | 'duplicate'> {
  return insertEvent(pool, {
    eventType: 'question.asked',
    actor: { id: 'aeon-max-bot', role: 'service' },
    subject: { entity: 'session', id: params.sessionId },
    payload: {
      session_id: params.sessionId,
      question_id: CORE_FIRST_QUESTION_ID,
      question_text: params.questionText,
      layer: DIALOG_LAYER_CORE,
      llm_call_id: null,
      max_user_id: params.maxUserId,
    },
    idempotencyKey: `question.asked:iter2:${CORE_FIRST_QUESTION_ID}:${params.maxUserId}`,
    schemaVersion: 1,
    correlationId: params.sessionId,
  });
}

export async function insertAnswerGiven(
  pool: Pool,
  params: {
    maxUserId: number;
    sessionId: string;
    questionId: string;
    answerValue: string;
    answerType: string;
    maxUpdateId: string;
  },
): Promise<'inserted' | 'duplicate'> {
  return insertEvent(pool, {
    eventType: 'answer.given',
    actor: { id: String(params.maxUserId), role: 'user' },
    subject: { entity: 'session', id: params.sessionId },
    payload: {
      session_id: params.sessionId,
      question_id: params.questionId,
      answer_value: params.answerValue,
      answer_type: params.answerType,
      max_user_id: params.maxUserId,
      max_update_id: params.maxUpdateId,
    },
    idempotencyKey: `answer.given:${params.maxUpdateId}`,
    schemaVersion: 1,
    correlationId: params.sessionId,
  });
}

export function newSessionId(): string {
  return uuidv7();
}

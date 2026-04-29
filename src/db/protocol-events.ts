import type { Pool } from 'pg';
import { insertEventWithId } from './insert-event.js';

export type InsertProtocolCoordinateAssignedParams = {
  sessionId: string;
  maxUserId: number;
  questionId: string;
  answerEventId: string;
  cardType: string;
  axis: string;
  coordinate: string;
  sourceQuestionId: string;
};

/** После mapper; causation_id = answer event_id. */
export async function insertProtocolCoordinateAssigned(
  pool: Pool,
  params: InsertProtocolCoordinateAssignedParams,
): Promise<{ eventId: string; inserted: boolean }> {
  const idempotencyKey = `protocol.coordinate_assigned:${params.sessionId}:${params.questionId}`;
  return insertEventWithId(pool, {
    eventType: 'protocol.coordinate_assigned',
    actor: { id: 'aeon-max-bot', role: 'service' },
    subject: { entity: 'session', id: params.sessionId },
    payload: {
      session_id: params.sessionId,
      max_user_id: params.maxUserId,
      answer_id: params.answerEventId,
      card_type: params.cardType,
      axis: params.axis,
      coordinate: params.coordinate,
      source_question_id: params.sourceQuestionId,
      question_id: params.questionId,
    },
    idempotencyKey,
    schemaVersion: 1,
    causationId: params.answerEventId,
    correlationId: params.sessionId,
  });
}

export type InsertAnswerInterpretedParams = {
  sessionId: string;
  maxUserId: number;
  questionId: string;
  axis: string;
  coordinate: string;
  llmCallId: string;
  interpretationText: string;
};

export async function insertAnswerInterpreted(
  pool: Pool,
  params: InsertAnswerInterpretedParams,
): Promise<{ eventId: string; inserted: boolean }> {
  const idempotencyKey = `answer.interpreted:${params.sessionId}:${params.questionId}`;
  return insertEventWithId(pool, {
    eventType: 'answer.interpreted',
    actor: { id: 'aeon-max-bot', role: 'service' },
    subject: { entity: 'session', id: params.sessionId },
    payload: {
      session_id: params.sessionId,
      question_id: params.questionId,
      axis: params.axis,
      coordinate: params.coordinate,
      llm_call_id: params.llmCallId,
      interpretation_text: params.interpretationText,
      max_user_id: params.maxUserId,
    },
    idempotencyKey,
    schemaVersion: 1,
    causationId: params.llmCallId,
    correlationId: params.sessionId,
  });
}

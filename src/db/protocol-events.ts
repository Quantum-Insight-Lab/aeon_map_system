import type { Pool } from 'pg';
import { protocolQuestionIndex } from '../protocols/cognitive_v1/queue.js';
import type { CognitiveAxis } from '../protocols/cognitive_v1/types.js';
import { insertEventWithId } from './insert-event.js';

const AXES: CognitiveAxis[] = ['goal', 'modality', 'anchor'];

function asAxis(raw: unknown): CognitiveAxis | null {
  return typeof raw === 'string' && (AXES as readonly string[]).includes(raw) ? (raw as CognitiveAxis) : null;
}

/** Координаты протокола по сессии для шагов строго до currentQuestionId (по порядку PROTOCOL_QUESTION_IDS). */
export async function fetchProtocolCoordinatesPriorToQuestion(
  pool: Pool,
  sessionId: string,
  currentQuestionId: string,
): Promise<Array<{ questionId: string; axis: CognitiveAxis; coordinate: string }>> {
  const curIdx = protocolQuestionIndex(currentQuestionId);
  if (curIdx < 0) return [];

  const r = await pool.query<{ payload: Record<string, unknown> }>(
    `SELECT payload FROM events
     WHERE event_type = 'protocol.coordinate_assigned'
       AND payload->>'session_id' = $1`,
    [sessionId],
  );

  type Row = { questionId: string; axis: CognitiveAxis; coordinate: string; idx: number };
  const pairs: Row[] = [];
  for (const row of r.rows) {
    const p = row.payload;
    const qid = typeof p.question_id === 'string' ? p.question_id : '';
    const idx = protocolQuestionIndex(qid);
    if (idx < 0 || idx >= curIdx) continue;
    const axis = asAxis(p.axis);
    const coordinate = typeof p.coordinate === 'string' ? p.coordinate : '';
    if (!axis || !coordinate) continue;
    pairs.push({ questionId: qid, axis, coordinate, idx });
  }
  pairs.sort((a, b) => a.idx - b.idx);
  return pairs.map(({ questionId, axis, coordinate }) => ({ questionId, axis, coordinate }));
}

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

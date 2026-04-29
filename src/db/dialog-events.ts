import type { Pool } from 'pg';
import type { DialogEventRow } from '../dialog/resolve-state.js';

const DIALOG_EVENT_TYPES = [
  'user.started',
  'session.opened',
  'protocol.continue_offered',
  'question.asked',
  'answer.given',
  'llm.called',
  'protocol.coordinate_assigned',
  'answer.interpreted',
  'card.computed',
] as const;

/** События диалога для пользователя MAX (фильтр по payload.max_user_id). */
export async function fetchDialogEventsForUser(pool: Pool, maxUserId: number): Promise<DialogEventRow[]> {
  const r = await pool.query<{ event_id: string; event_type: string; payload: Record<string, unknown> }>(
    `SELECT event_id, event_type, payload
     FROM events
     WHERE event_type = ANY($1::text[])
       AND (payload->>'max_user_id') = $2
     ORDER BY occurred_at ASC, event_id ASC`,
    [DIALOG_EVENT_TYPES, String(maxUserId)],
  );
  return r.rows.map((row) => ({
    event_id: row.event_id,
    event_type: row.event_type,
    payload: row.payload,
  }));
}

export async function getPayloadByIdempotencyKey(
  pool: Pool,
  idempotencyKey: string,
): Promise<Record<string, unknown> | null> {
  const r = await pool.query<{ payload: Record<string, unknown> }>(
    `SELECT payload FROM events WHERE idempotency_key = $1 LIMIT 1`,
    [idempotencyKey],
  );
  return r.rows[0]?.payload ?? null;
}

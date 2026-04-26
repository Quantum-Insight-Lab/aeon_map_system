import { v7 as uuidv7 } from 'uuid';
import type { Pool } from 'pg';

/** vibepp events.contract — actor */
export type EventActor = {
  id: string;
  role: string;
};

/** vibepp events.contract — subject */
export type EventSubject = {
  entity: string;
  id: string;
};

export type InsertEventParams = {
  eventType: string;
  occurredAt?: Date;
  actor: EventActor;
  subject: EventSubject;
  payload: Record<string, unknown>;
  idempotencyKey: string;
  schemaVersion?: number;
  causationId?: string | null;
  correlationId?: string | null;
};

/**
 * Append-only вставка события. Идемпотентность по idempotency_key (UNIQUE).
 * event_id — UUID v7 по контракту vibepp.
 */
export async function insertEvent(pool: Pool, params: InsertEventParams): Promise<'inserted' | 'duplicate'> {
  const eventId = uuidv7();
  const occurredAt = params.occurredAt ?? new Date();
  const schemaVersion = params.schemaVersion ?? 1;
  const result = await pool.query<{ event_id: string }>(
    `INSERT INTO events (
      event_id, event_type, occurred_at, actor, subject, payload, idempotency_key, schema_version, causation_id, correlation_id
    ) VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, $7, $8, $9, $10)
    ON CONFLICT (idempotency_key) DO NOTHING
    RETURNING event_id`,
    [
      eventId,
      params.eventType,
      occurredAt,
      JSON.stringify(params.actor),
      JSON.stringify(params.subject),
      JSON.stringify(params.payload),
      params.idempotencyKey,
      schemaVersion,
      params.causationId ?? null,
      params.correlationId ?? null,
    ],
  );
  return result.rows.length > 0 ? 'inserted' : 'duplicate';
}

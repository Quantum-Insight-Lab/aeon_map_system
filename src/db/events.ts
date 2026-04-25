import type { Pool } from 'pg';

export type InsertUserStartedParams = {
  userId: number;
  locale: string | null;
  referralSource: string | null;
  correlationId?: string | null;
};

/** Идемпотентность: один user.started на max_user_id (idempotency_key). */
export async function insertUserStarted(
  pool: Pool,
  params: InsertUserStartedParams,
): Promise<'inserted' | 'duplicate'> {
  const idempotencyKey = `user.started:${params.userId}`;
  const result = await pool.query<{ event_id: string }>(
    `INSERT INTO events (
      event_type, occurred_at, actor, subject, payload, idempotency_key, schema_version, correlation_id
    ) VALUES ($1, now(), $2::jsonb, $3::jsonb, $4::jsonb, $5, 1, $6)
    ON CONFLICT (idempotency_key) DO NOTHING
    RETURNING event_id`,
    [
      'user.started',
      JSON.stringify({ type: 'user', max_user_id: params.userId }),
      JSON.stringify({ type: 'service', id: 'aeon-max-bot' }),
      JSON.stringify({
        max_user_id: params.userId,
        locale: params.locale,
        referral_source: params.referralSource,
      }),
      idempotencyKey,
      params.correlationId ?? null,
    ],
  );
  return result.rows.length > 0 ? 'inserted' : 'duplicate';
}

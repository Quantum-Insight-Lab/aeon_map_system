import type { Pool } from 'pg';
import { insertEvent } from './insert-event.js';

export type InsertUserStartedParams = {
  userId: number;
  locale: string | null;
  referralSource: string | null;
  /** Нормализованный идентификатор доставки MAX (см. resolveMaxUpdateId). */
  maxUpdateId: string | null;
  correlationId?: string | null;
};

/** Идемпотентность: один user.started на max_user_id (idempotency_key). */
export async function insertUserStarted(
  pool: Pool,
  params: InsertUserStartedParams,
): Promise<'inserted' | 'duplicate'> {
  const payload: Record<string, unknown> = {
    max_user_id: params.userId,
    locale: params.locale,
    referral_source: params.referralSource,
  };
  if (params.maxUpdateId != null) {
    payload.max_update_id = params.maxUpdateId;
  }

  return insertEvent(pool, {
    eventType: 'user.started',
    actor: { id: String(params.userId), role: 'user' },
    subject: { entity: 'max_bot', id: 'aeon-max-bot' },
    payload,
    idempotencyKey: `user.started:${params.userId}`,
    schemaVersion: 1,
    correlationId: params.correlationId ?? null,
  });
}

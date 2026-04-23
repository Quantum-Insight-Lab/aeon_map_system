import type { AppRedis } from './redis.js';

const TTL_SEC = 7 * 24 * 3600;

/** true — первый раз видим ключ; false — дубликат (ретрай webhook). */
export async function claimWebhookDedup(redis: AppRedis, key: string): Promise<boolean> {
  const r = await redis.set(`aeon:webhook:${key}`, '1', { NX: true, EX: TTL_SEC });
  return r === 'OK';
}

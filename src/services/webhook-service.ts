import type { Pool } from 'pg';
import type { Config } from '../config.js';
import type { AppRedis } from '../lib/redis.js';
import { insertUserStarted } from '../db/events.js';
import { sendMaxUserMessage } from '../integrations/max/client.js';
import type { BotStartedUpdate, MaxUpdate, MessageCreatedUpdate } from '../integrations/max/types.js';
import { claimWebhookDedup } from '../lib/dedup.js';

function isBotStarted(u: MaxUpdate): u is BotStartedUpdate {
  return u.update_type === 'bot_started' && 'user' in u && u.user != null;
}

function isMessageCreated(u: MaxUpdate): u is MessageCreatedUpdate {
  return u.update_type === 'message_created' && 'message' in u && u.message != null;
}

function webhookDedupKey(update: MaxUpdate): string | null {
  if (isBotStarted(update)) {
    return `bot_started:${update.timestamp}:${update.user.user_id}`;
  }
  if (isMessageCreated(update)) {
    const mid = update.message.body?.mid;
    if (mid) return `message:${mid}`;
    const uid = update.message.sender?.user_id;
    if (uid != null) return `message_fallback:${update.message.timestamp}:${uid}`;
  }
  return null;
}

export async function handleMaxWebhook(
  opts: {
    config: Config;
    pool: Pool;
    redis: AppRedis;
    update: MaxUpdate;
    log: { warn: (o: unknown, msg?: string) => void; info: (o: unknown, msg?: string) => void };
  },
): Promise<{ duplicate: boolean; skipped: boolean }> {
  const { config, pool, redis, update, log } = opts;
  const dedupKey = webhookDedupKey(update);
  if (!dedupKey) {
    log.warn({ update_type: update.update_type }, 'webhook: no dedup key, skip');
    return { duplicate: false, skipped: true };
  }
  const first = await claimWebhookDedup(redis, dedupKey);
  if (!first) {
    return { duplicate: true, skipped: false };
  }

  if (isBotStarted(update)) {
    const ins = await insertUserStarted(pool, {
      userId: update.user.user_id,
      locale: null,
      referralSource: typeof update.payload === 'string' ? update.payload : null,
    });
    if (ins === 'inserted' && config.maxBotToken) {
      await sendMaxUserMessage({
        baseUrl: config.maxApiBaseUrl,
        token: config.maxBotToken,
        userId: update.user.user_id,
        text: 'Привет!',
      });
    } else if (ins === 'inserted' && !config.maxBotToken) {
      log.warn('MAX_BOT_TOKEN empty: skip outbound message');
    }
    return { duplicate: false, skipped: false };
  }

  if (isMessageCreated(update)) {
    const m = update.message;
    if (m.sender?.is_bot) {
      return { duplicate: false, skipped: false };
    }
    const uid = m.sender?.user_id;
    if (uid == null) {
      log.warn({ update }, 'message_created without sender.user_id');
      return { duplicate: false, skipped: true };
    }
    const ins = await insertUserStarted(pool, {
      userId: uid,
      locale: update.user_locale ?? null,
      referralSource: null,
    });
    if (ins === 'inserted' && config.maxBotToken) {
      await sendMaxUserMessage({
        baseUrl: config.maxApiBaseUrl,
        token: config.maxBotToken,
        userId: uid,
        text: 'Привет!',
      });
    } else if (ins === 'inserted' && !config.maxBotToken) {
      log.warn('MAX_BOT_TOKEN empty: skip outbound message');
    }
    return { duplicate: false, skipped: false };
  }

  return { duplicate: false, skipped: true };
}

import type { Pool } from 'pg';
import type { Config } from '../config.js';
import { insertUserStarted } from '../db/events.js';
import { sendMaxUserMessage } from '../integrations/max/client.js';
import type { BotStartedUpdate, MaxUpdate, MessageCreatedUpdate } from '../integrations/max/types.js';
import { resolveMaxUpdateId } from '../integrations/max/update-id.js';

function isBotStarted(u: MaxUpdate): u is BotStartedUpdate {
  return u.update_type === 'bot_started' && 'user' in u && u.user != null;
}

function isMessageCreated(u: MaxUpdate): u is MessageCreatedUpdate {
  return u.update_type === 'message_created' && 'message' in u && u.message != null;
}

export async function handleMaxWebhook(
  opts: {
    config: Config;
    pool: Pool;
    update: MaxUpdate;
    log: { warn: (o: unknown, msg?: string) => void; info: (o: unknown, msg?: string) => void };
  },
): Promise<{ duplicate: boolean; skipped: boolean }> {
  const { config, pool, update, log } = opts;
  const maxUpdateId = resolveMaxUpdateId(update);
  if (!maxUpdateId) {
    log.warn({ update_type: update.update_type }, 'webhook: no max_update_id, skip');
    return { duplicate: false, skipped: true };
  }

  if (isBotStarted(update)) {
    const ins = await insertUserStarted(pool, {
      userId: update.user.user_id,
      locale: null,
      referralSource: typeof update.payload === 'string' ? update.payload : null,
      maxUpdateId,
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
    return { duplicate: ins === 'duplicate', skipped: false };
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
      maxUpdateId,
    });
    if (ins === 'inserted' && config.maxBotToken) {
      await sendMaxUserMessage({
        baseUrl: config.maxApiBaseUrl,
        token: config.maxBotToken,
        userId: uid,
        text: 'Привет!',
      });
    } else     if (ins === 'inserted' && !config.maxBotToken) {
      log.warn('MAX_BOT_TOKEN empty: skip outbound message');
    }
    return { duplicate: ins === 'duplicate', skipped: false };
  }

  return { duplicate: false, skipped: true };
}

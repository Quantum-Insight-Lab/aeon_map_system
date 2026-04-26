import type { BotStartedUpdate, MaxUpdate, MessageCreatedUpdate } from './types.js';

function isBotStarted(u: MaxUpdate): u is BotStartedUpdate {
  return u.update_type === 'bot_started' && 'user' in u && u.user != null;
}

function isMessageCreated(u: MaxUpdate): u is MessageCreatedUpdate {
  return u.update_type === 'message_created' && 'message' in u && u.message != null;
}

function rootUpdateId(update: MaxUpdate): string | null {
  const rid = 'update_id' in update ? update.update_id : undefined;
  if (typeof rid === 'string' && rid.length > 0) return rid;
  if (typeof rid === 'number' && Number.isFinite(rid)) return String(rid);
  return null;
}

/**
 * Нормализованный max_update_id для идемпотентности и трассировки (см. docs/SPEC/events.md).
 */
export function resolveMaxUpdateId(update: MaxUpdate): string | null {
  const fromRoot = rootUpdateId(update);
  if (fromRoot) return fromRoot;

  if (isMessageCreated(update)) {
    const mid = update.message.body?.mid;
    if (mid) return mid;
    const uid = update.message.sender?.user_id;
    if (uid != null) {
      return `msg_fallback:${update.message.timestamp}:${uid}`;
    }
    return null;
  }

  if (isBotStarted(update)) {
    return `bot_started:${update.timestamp}:${update.user.user_id}`;
  }

  return null;
}

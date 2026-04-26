import type { Pool } from 'pg';
import type { Config } from '../config.js';
import { inferDialogState } from '../dialog/resolve-state.js';
import { fetchDialogEventsForUser } from '../db/dialog-events.js';
import { insertUserStarted } from '../db/events.js';
import {
  ensureIter2SessionAndGetId,
  insertAnswerGiven,
  insertQuestionAskedFirstCore,
  newSessionId,
} from '../db/session-events.js';
import { sendMaxUserMessage } from '../integrations/max/client.js';
import type { BotStartedUpdate, MaxUpdate, MessageCreatedUpdate } from '../integrations/max/types.js';
import { resolveMaxUpdateId } from '../integrations/max/update-id.js';

function isBotStarted(u: MaxUpdate): u is BotStartedUpdate {
  return u.update_type === 'bot_started' && 'user' in u && u.user != null;
}

function isMessageCreated(u: MaxUpdate): u is MessageCreatedUpdate {
  return u.update_type === 'message_created' && 'message' in u && u.message != null;
}

async function openIter2SessionAndAskFirstQuestion(opts: {
  pool: Pool;
  config: Config;
  maxUserId: number;
  openingMessageMid: string | null;
  log: { warn: (o: unknown, msg?: string) => void };
}): Promise<void> {
  const { pool, config, maxUserId, openingMessageMid, log } = opts;
  const candidate = newSessionId();
  const sessionId = await ensureIter2SessionAndGetId(pool, {
    maxUserId,
    sessionId: candidate,
    openingMessageMid: openingMessageMid ?? undefined,
  });
  const qIns = await insertQuestionAskedFirstCore(pool, {
    maxUserId,
    sessionId,
    questionText: config.firstCoreQuestionText,
  });
  if (qIns === 'inserted' && config.maxBotToken) {
    await sendMaxUserMessage({
      baseUrl: config.maxApiBaseUrl,
      token: config.maxBotToken,
      userId: maxUserId,
      text: config.firstCoreQuestionText,
    });
  } else if (qIns === 'inserted' && !config.maxBotToken) {
    log.warn('MAX_BOT_TOKEN empty: skip outbound first question');
  }
}

export async function handleMaxWebhook(opts: {
  config: Config;
  pool: Pool;
  update: MaxUpdate;
  log: { warn: (o: unknown, msg?: string) => void; info: (o: unknown, msg?: string) => void };
}): Promise<{ duplicate: boolean; skipped: boolean }> {
  const { config, pool, update, log } = opts;
  const maxUpdateId = resolveMaxUpdateId(update);
  if (!maxUpdateId) {
    log.warn({ update_type: update.update_type }, 'webhook: no max_update_id, skip');
    return { duplicate: false, skipped: true };
  }

  if (isBotStarted(update)) {
    const userId = update.user.user_id;
    const userIns = await insertUserStarted(pool, {
      userId,
      locale: null,
      referralSource: typeof update.payload === 'string' ? update.payload : null,
      maxUpdateId,
    });
    const rows = await fetchDialogEventsForUser(pool, userId);
    const state = inferDialogState(rows);
    if (state.type === 'needs_first_question') {
      await openIter2SessionAndAskFirstQuestion({
        pool,
        config,
        maxUserId: userId,
        openingMessageMid: null,
        log,
      });
    }
    return { duplicate: userIns === 'duplicate', skipped: false };
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

    const userIns = await insertUserStarted(pool, {
      userId: uid,
      locale: update.user_locale ?? null,
      referralSource: null,
      maxUpdateId,
    });

    const rows = await fetchDialogEventsForUser(pool, uid);
    const state = inferDialogState(rows);

    if (state.type === 'answered') {
      return { duplicate: userIns === 'duplicate', skipped: true };
    }

    if (state.type === 'needs_first_question') {
      await openIter2SessionAndAskFirstQuestion({
        pool,
        config,
        maxUserId: uid,
        openingMessageMid: maxUpdateId,
        log,
      });
      return { duplicate: userIns === 'duplicate', skipped: false };
    }

    if (state.type === 'awaiting_answer') {
      if (state.openingMessageMid != null && state.openingMessageMid === maxUpdateId) {
        return { duplicate: userIns === 'duplicate', skipped: true };
      }
      const text = m.body?.text ?? '';
      const ansIns = await insertAnswerGiven(pool, {
        maxUserId: uid,
        sessionId: state.sessionId,
        questionId: state.questionId,
        answerValue: text,
        answerType: 'text',
        maxUpdateId,
      });
      if (ansIns === 'inserted' && config.maxBotToken) {
        await sendMaxUserMessage({
          baseUrl: config.maxApiBaseUrl,
          token: config.maxBotToken,
          userId: uid,
          text: config.dialogAnswerAckText,
        });
      } else if (ansIns === 'inserted' && !config.maxBotToken) {
        log.warn('MAX_BOT_TOKEN empty: skip answer ack');
      }
      return { duplicate: userIns === 'duplicate', skipped: false };
    }

    return { duplicate: userIns === 'duplicate', skipped: true };
  }

  return { duplicate: false, skipped: true };
}

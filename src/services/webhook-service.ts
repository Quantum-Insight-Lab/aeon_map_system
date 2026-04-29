import type { Pool } from 'pg';
import type { Config } from '../config.js';
import { CORE_FIRST_QUESTION_ID } from '../dialog/constants.js';
import { deliverCardComputed } from '../dialog/deliver-card-computed.js';
import { deliverNextLlmQuestion } from '../dialog/deliver-next-llm.js';
import { deliverProtocolStep } from '../dialog/deliver-protocol-step.js';
import { inferDialogState, type DialogEventRow, type DialogState } from '../dialog/resolve-state.js';
import { fetchDialogEventsForUser } from '../db/dialog-events.js';
import { insertUserStarted } from '../db/events.js';
import {
  ensureIter2SessionAndGetId,
  insertAnswerGiven,
  insertQuestionAskedProtocol,
  newSessionId,
} from '../db/session-events.js';
import { sendMaxUserMessage } from '../integrations/max/client.js';
import { mapAnswerToCoordinate } from '../protocol_mapper/map-answer.js';
import {
  formatMapperInvalidReplyMarkdown,
  formatProtocolQuestionMessageMarkdown,
  getProtocolQuestion,
} from '../protocols/cognitive_v1/questions.js';
import { PROTOCOL_FIRST_QUESTION_ID, isProtocolQuestionId } from '../protocols/cognitive_v1/queue.js';
import type { BotStartedUpdate, MaxUpdate, MessageCreatedUpdate } from '../integrations/max/types.js';
import { resolveMaxUpdateId } from '../integrations/max/update-id.js';

function isBotStarted(u: MaxUpdate): u is BotStartedUpdate {
  return u.update_type === 'bot_started' && 'user' in u && u.user != null;
}

function isMessageCreated(u: MaxUpdate): u is MessageCreatedUpdate {
  return u.update_type === 'message_created' && 'message' in u && u.message != null;
}

function inferOpts(config: Config) {
  return {
    llmFollowupCount: config.llmFollowupCount,
    dialogLlmNextQuestion: config.dialogLlmNextQuestion,
  };
}

async function openProtocolSessionAndAskGoal1(opts: {
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
    cognitiveProtocolVersion: config.cognitiveProtocolVersion,
  });
  const qDef = getProtocolQuestion(PROTOCOL_FIRST_QUESTION_ID);
  if (!qDef) {
    log.warn(null, 'protocol: goal:1 question def missing');
    return;
  }
  const bodyMd = formatProtocolQuestionMessageMarkdown(qDef);
  const qIns = await insertQuestionAskedProtocol(pool, {
    maxUserId,
    sessionId,
    questionId: PROTOCOL_FIRST_QUESTION_ID,
    questionText: bodyMd,
    cognitiveProtocolVersion: config.cognitiveProtocolVersion,
  });
  if (qIns === 'inserted' && config.maxBotToken) {
    await sendMaxUserMessage({
      baseUrl: config.maxApiBaseUrl,
      token: config.maxBotToken,
      userId: maxUserId,
      text: bodyMd,
      format: 'markdown',
    });
  } else if (qIns === 'inserted' && !config.maxBotToken) {
    log.warn('MAX_BOT_TOKEN empty: skip outbound first protocol question');
  }
}

async function recoverProtocolFromState(opts: {
  pool: Pool;
  config: Config;
  maxUserId: number;
  state: Extract<DialogState, { type: 'needs_next_protocol_step' }>;
  rows: DialogEventRow[];
  log: { warn: (o: unknown, msg?: string) => void; info: (o: unknown, msg?: string) => void };
}): Promise<void> {
  const { pool, config, maxUserId, state, rows, log } = opts;
  const ansRow = [...rows]
    .reverse()
    .find(
      (e) =>
        e.event_type === 'answer.given' &&
        String(e.payload.session_id ?? '') === state.sessionId &&
        String(e.payload.question_id ?? '') === state.lastAnswerQuestionId,
    );
  const answerText = ansRow ? String(ansRow.payload.answer_value ?? '') : '';
  const answerEventId = ansRow?.event_id;
  if (!answerEventId || answerText === '') {
    log.warn({ state }, 'webhook: recovery protocol step missing answer row');
    return;
  }
  await deliverProtocolStep({
    pool,
    config,
    maxUserId,
    sessionId: state.sessionId,
    questionId: state.lastAnswerQuestionId,
    answerText,
    answerEventId,
    log,
  });
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
    let rows = await fetchDialogEventsForUser(pool, userId);
    let state = inferDialogState(rows, inferOpts(config));

    if (state.type === 'protocol_complete') {
      await deliverCardComputed({ pool, config, maxUserId: userId, sessionId: state.sessionId, log });
      rows = await fetchDialogEventsForUser(pool, userId);
      state = inferDialogState(rows, inferOpts(config));
    }

    if (state.type === 'needs_next_protocol_step') {
      await recoverProtocolFromState({ pool, config, maxUserId: userId, state, rows, log });
      rows = await fetchDialogEventsForUser(pool, userId);
      state = inferDialogState(rows, inferOpts(config));
    }

    if (state.type === 'needs_next_llm' && config.dialogLlmNextQuestion) {
      await deliverNextLlmQuestion({ pool, config, maxUserId: userId, state, log });
      rows = await fetchDialogEventsForUser(pool, userId);
      state = inferDialogState(rows, inferOpts(config));
    }

    if (state.type === 'needs_first_question') {
      await openProtocolSessionAndAskGoal1({
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

    let rows = await fetchDialogEventsForUser(pool, uid);
    let state = inferDialogState(rows, inferOpts(config));

    if (state.type === 'protocol_complete') {
      await deliverCardComputed({ pool, config, maxUserId: uid, sessionId: state.sessionId, log });
      rows = await fetchDialogEventsForUser(pool, uid);
      state = inferDialogState(rows, inferOpts(config));
    }

    if (state.type === 'needs_next_protocol_step') {
      await recoverProtocolFromState({ pool, config, maxUserId: uid, state, rows, log });
      rows = await fetchDialogEventsForUser(pool, uid);
      state = inferDialogState(rows, inferOpts(config));
      if (state.type === 'awaiting_answer') {
        return { duplicate: userIns === 'duplicate', skipped: true };
      }
    }

    if (state.type === 'needs_next_llm' && config.dialogLlmNextQuestion) {
      await deliverNextLlmQuestion({ pool, config, maxUserId: uid, state, log });
      rows = await fetchDialogEventsForUser(pool, uid);
      state = inferDialogState(rows, inferOpts(config));
      if (state.type === 'awaiting_answer') {
        return { duplicate: userIns === 'duplicate', skipped: true };
      }
    }

    if (state.type === 'session_complete') {
      return { duplicate: userIns === 'duplicate', skipped: true };
    }

    if (state.type === 'needs_first_question') {
      await openProtocolSessionAndAskGoal1({
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

      if (isProtocolQuestionId(state.questionId)) {
        const mapped = mapAnswerToCoordinate(state.questionId, text);
        if (!mapped.ok) {
          if (config.maxBotToken) {
            await sendMaxUserMessage({
              baseUrl: config.maxApiBaseUrl,
              token: config.maxBotToken,
              userId: uid,
              text: formatMapperInvalidReplyMarkdown(state.questionId),
              format: 'markdown',
            });
          }
          return { duplicate: userIns === 'duplicate', skipped: false };
        }

        const ansIns = await insertAnswerGiven(pool, {
          maxUserId: uid,
          sessionId: state.sessionId,
          questionId: state.questionId,
          answerValue: text,
          answerType: 'text',
          maxUpdateId,
        });

        if (ansIns.inserted && state.questionId === PROTOCOL_FIRST_QUESTION_ID && config.maxBotToken) {
          await sendMaxUserMessage({
            baseUrl: config.maxApiBaseUrl,
            token: config.maxBotToken,
            userId: uid,
            text: config.dialogAnswerAckText,
          });
        } else if (ansIns.inserted && state.questionId === PROTOCOL_FIRST_QUESTION_ID && !config.maxBotToken) {
          log.warn('MAX_BOT_TOKEN empty: skip answer ack');
        }

        if (ansIns.inserted) {
          await deliverProtocolStep({
            pool,
            config,
            maxUserId: uid,
            sessionId: state.sessionId,
            questionId: state.questionId,
            answerText: text,
            answerEventId: ansIns.eventId,
            preMapped: mapped,
            log,
          });
        }

        if (ansIns.inserted) {
          rows = await fetchDialogEventsForUser(pool, uid);
          state = inferDialogState(rows, inferOpts(config));
          if (state.type === 'needs_next_llm' && config.dialogLlmNextQuestion) {
            await deliverNextLlmQuestion({ pool, config, maxUserId: uid, state, log });
          }
        }

        return { duplicate: userIns === 'duplicate', skipped: false };
      }

      const ansIns = await insertAnswerGiven(pool, {
        maxUserId: uid,
        sessionId: state.sessionId,
        questionId: state.questionId,
        answerValue: text,
        answerType: 'text',
        maxUpdateId,
      });

      if (ansIns.inserted && state.questionId === CORE_FIRST_QUESTION_ID && config.maxBotToken) {
        await sendMaxUserMessage({
          baseUrl: config.maxApiBaseUrl,
          token: config.maxBotToken,
          userId: uid,
          text: config.dialogAnswerAckText,
        });
      } else if (ansIns.inserted && state.questionId === CORE_FIRST_QUESTION_ID && !config.maxBotToken) {
        log.warn('MAX_BOT_TOKEN empty: skip answer ack');
      }

      if (ansIns.inserted) {
        rows = await fetchDialogEventsForUser(pool, uid);
        state = inferDialogState(rows, inferOpts(config));
        if (state.type === 'needs_next_llm' && config.dialogLlmNextQuestion) {
          await deliverNextLlmQuestion({ pool, config, maxUserId: uid, state, log });
        }
      }

      return { duplicate: userIns === 'duplicate', skipped: false };
    }

    return { duplicate: userIns === 'duplicate', skipped: true };
  }

  return { duplicate: false, skipped: true };
}

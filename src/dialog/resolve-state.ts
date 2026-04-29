import {
  CORE_FIRST_QUESTION_ID,
  CORE_LLM_QUESTION_RE,
  LLM_FOLLOWUP_COUNT,
  coreLlmQuestionId,
} from './constants.js';
import {
  PROTOCOL_FIRST_QUESTION_ID,
  PROTOCOL_LAST_QUESTION_ID,
  isProtocolQuestionId,
} from '../protocols/cognitive_v1/queue.js';

export type DialogEventRow = {
  /** Из журнала событий (опционально в синтетических тестах без БД). */
  event_id?: string;
  event_type: string;
  payload: Record<string, unknown>;
};

export type DialogState =
  | { type: 'needs_first_question' }
  | { type: 'awaiting_answer'; sessionId: string; questionId: string; openingMessageMid: string | null }
  | { type: 'needs_next_llm'; sessionId: string; lastAnswerQuestionId: string }
  | { type: 'needs_next_protocol_step'; sessionId: string; lastAnswerQuestionId: string }
  | { type: 'protocol_complete'; sessionId: string }
  | { type: 'session_complete' };

export type InferDialogStateOpts = {
  llmFollowupCount?: number;
  /** iter-3: после core:first генерировать LLM-вопросы (по умолчанию false в iter-4). */
  dialogLlmNextQuestion?: boolean;
};

function openingMidForSession(events: DialogEventRow[], sessionId: string): string | null {
  for (const e of events) {
    if (e.event_type === 'session.opened' && String(e.payload.session_id) === sessionId) {
      const om = e.payload.opening_message_mid;
      return om != null && om !== '' ? String(om) : null;
    }
  }
  return null;
}

function lastAnswerGivenIndex(events: DialogEventRow[]): number {
  for (let i = events.length - 1; i >= 0; i--) {
    if (events[i].event_type === 'answer.given') {
      return i;
    }
  }
  return -1;
}

function expectedNextLlmQuestionId(lastAnswerQuestionId: string, llmFollowupCount: number): string | null {
  if (lastAnswerQuestionId === CORE_FIRST_QUESTION_ID) {
    return coreLlmQuestionId(1);
  }
  const m = CORE_LLM_QUESTION_RE.exec(lastAnswerQuestionId);
  if (!m) {
    return null;
  }
  const k = Number(m[1]);
  if (k >= llmFollowupCount) {
    return null;
  }
  return coreLlmQuestionId(k + 1);
}

function hasCardComputed(events: DialogEventRow[]): boolean {
  return events.some((e) => e.event_type === 'card.computed');
}

/** Последний протокольный ответ без answer.interpreted после него (recovery). */
function pendingProtocolInterpret(events: DialogEventRow[]): { sessionId: string; questionId: string } | null {
  let lastIdx = -1;
  let lastSid = '';
  let lastQid = '';
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    if (e.event_type !== 'answer.given') continue;
    const qid = String(e.payload.question_id ?? '');
    if (!isProtocolQuestionId(qid)) continue;
    lastIdx = i;
    lastSid = String(e.payload.session_id ?? '');
    lastQid = qid;
  }
  if (lastIdx < 0 || lastSid === '' || lastQid === '') return null;
  const ok = events.slice(lastIdx + 1).some(
    (e) =>
      e.event_type === 'answer.interpreted' &&
      String(e.payload.session_id ?? '') === lastSid &&
      String(e.payload.question_id ?? '') === lastQid,
  );
  return ok ? null : { sessionId: lastSid, questionId: lastQid };
}

/** Ответ на последнем якоре есть в тексте, карты ещё нет — финализировать карту (recovery). */
function pendingProtocolCard(events: DialogEventRow[]): string | null {
  let anchor3Interpreted = false;
  let sid = '';

  for (const e of events) {
    if (e.event_type === 'answer.interpreted' && String(e.payload.question_id ?? '') === PROTOCOL_LAST_QUESTION_ID) {
      anchor3Interpreted = true;
      sid = String(e.payload.session_id ?? '');
    }
  }

  if (!anchor3Interpreted || sid === '') return null;

  const cardForSid = events.some(
    (e) => e.event_type === 'card.computed' && String(e.payload.session_id ?? '') === sid,
  );
  return cardForSid ? null : sid;
}

/**
 * Состояние диалога: pending Q/A по последнему question.asked,
 * затем протокол Cognitive v1 или LLM-цепочка core:llm:1..N (feature-flag).
 */
export function inferDialogState(events: DialogEventRow[], opts?: InferDialogStateOpts): DialogState {
  const llmFollowupCount = opts?.llmFollowupCount ?? LLM_FOLLOWUP_COUNT;
  const dialogLlmNextQuestion = opts?.dialogLlmNextQuestion ?? false;

  if (hasCardComputed(events)) {
    return { type: 'session_complete' };
  }

  const protoInterpretMissing = pendingProtocolInterpret(events);
  if (protoInterpretMissing != null) {
    return {
      type: 'needs_next_protocol_step',
      sessionId: protoInterpretMissing.sessionId,
      lastAnswerQuestionId: protoInterpretMissing.questionId,
    };
  }

  const cardSid = pendingProtocolCard(events);
  if (cardSid != null) {
    return { type: 'protocol_complete', sessionId: cardSid };
  }

  let pending: { sessionId: string; questionId: string } | null = null;

  for (const e of events) {
    switch (e.event_type) {
      case 'session.opened': {
        pending = null;
        break;
      }
      case 'question.asked': {
        const sid = e.payload.session_id;
        const qid = e.payload.question_id;
        if (sid != null && qid != null) {
          pending = { sessionId: String(sid), questionId: String(qid) };
        }
        break;
      }
      case 'answer.given': {
        const sid = e.payload.session_id;
        const qid = e.payload.question_id;
        if (
          pending != null &&
          sid != null &&
          qid != null &&
          String(sid) === pending.sessionId &&
          String(qid) === pending.questionId
        ) {
          pending = null;
        }
        break;
      }
      default:
        break;
    }
  }

  if (pending != null) {
    let openingMessageMid: string | null = null;
    if (pending.questionId === CORE_FIRST_QUESTION_ID || pending.questionId === PROTOCOL_FIRST_QUESTION_ID) {
      openingMessageMid = openingMidForSession(events, pending.sessionId);
    }
    return {
      type: 'awaiting_answer',
      sessionId: pending.sessionId,
      questionId: pending.questionId,
      openingMessageMid,
    };
  }

  const lastAnsIdx = lastAnswerGivenIndex(events);
  if (lastAnsIdx < 0) {
    return { type: 'needs_first_question' };
  }

  const lastAns = events[lastAnsIdx];
  const lastQid = String(lastAns.payload.question_id ?? '');
  const lastSid = String(lastAns.payload.session_id ?? '');

  /** Протокольный хвост без открытого вопроса — карта уже выпущена или будет через recovery. */
  if (isProtocolQuestionId(lastQid)) {
    return { type: 'session_complete' };
  }

  const llmMatch = CORE_LLM_QUESTION_RE.exec(lastQid);
  if (llmMatch) {
    const k = Number(llmMatch[1]);
    if (k >= llmFollowupCount) {
      return { type: 'session_complete' };
    }
  }

  if (!dialogLlmNextQuestion && lastQid === CORE_FIRST_QUESTION_ID) {
    return { type: 'session_complete' };
  }

  const expectedNext = expectedNextLlmQuestionId(lastQid, llmFollowupCount);
  if (expectedNext == null) {
    return { type: 'session_complete' };
  }

  if (!dialogLlmNextQuestion) {
    return { type: 'session_complete' };
  }

  return {
    type: 'needs_next_llm',
    sessionId: lastSid,
    lastAnswerQuestionId: lastQid,
  };
}

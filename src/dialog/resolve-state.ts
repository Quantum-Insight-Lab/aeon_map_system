import {
  CORE_FIRST_QUESTION_ID,
  CORE_LLM_QUESTION_RE,
  LLM_FOLLOWUP_COUNT,
  coreLlmQuestionId,
} from './constants.js';

export type DialogEventRow = {
  event_type: string;
  payload: Record<string, unknown>;
};

export type DialogState =
  | { type: 'needs_first_question' }
  | { type: 'awaiting_answer'; sessionId: string; questionId: string; openingMessageMid: string | null }
  | { type: 'needs_next_llm'; sessionId: string; lastAnswerQuestionId: string }
  | { type: 'session_complete' };

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

/**
 * Состояние диалога: pending Q/A по последнему question.asked, затем LLM-цепочка core:llm:1..N.
 */
export function inferDialogState(
  events: DialogEventRow[],
  opts?: { llmFollowupCount?: number },
): DialogState {
  const llmFollowupCount = opts?.llmFollowupCount ?? LLM_FOLLOWUP_COUNT;

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
    const openingMessageMid =
      pending.questionId === CORE_FIRST_QUESTION_ID ? openingMidForSession(events, pending.sessionId) : null;
    return {
      type: 'awaiting_answer',
      sessionId: pending.sessionId,
      questionId: pending.questionId,
      openingMessageMid,
    };
  }

  const lastAnsIdx = lastAnswerGivenIndex(events);
  if (lastAnsIdx < 0) {
    const hasUserStarted = events.some((x) => x.event_type === 'user.started');
    return hasUserStarted ? { type: 'needs_first_question' } : { type: 'needs_first_question' };
  }

  const lastAns = events[lastAnsIdx];
  const lastQid = String(lastAns.payload.question_id ?? '');
  const lastSid = String(lastAns.payload.session_id ?? '');

  const llmMatch = CORE_LLM_QUESTION_RE.exec(lastQid);
  if (llmMatch) {
    const k = Number(llmMatch[1]);
    if (k >= llmFollowupCount) {
      return { type: 'session_complete' };
    }
  }

  const expectedNext = expectedNextLlmQuestionId(lastQid, llmFollowupCount);
  if (expectedNext == null) {
    return { type: 'session_complete' };
  }

  return {
    type: 'needs_next_llm',
    sessionId: lastSid,
    lastAnswerQuestionId: lastQid,
  };
}

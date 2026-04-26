import { CORE_FIRST_QUESTION_ID } from './constants.js';

export type DialogEventRow = {
  event_type: string;
  payload: Record<string, unknown>;
};

export type DialogState =
  | { type: 'needs_first_question' }
  | { type: 'awaiting_answer'; sessionId: string; questionId: string; openingMessageMid: string | null }
  | { type: 'answered' };

function openingMidForSession(events: DialogEventRow[], sessionId: string): string | null {
  for (const e of events) {
    if (e.event_type === 'session.opened' && String(e.payload.session_id) === sessionId) {
      const om = e.payload.opening_message_mid;
      return om != null && om !== '' ? String(om) : null;
    }
  }
  return null;
}

/**
 * Выводит состояние диалога iter-2 по хронологии событий пользователя (user.started, session, question, answer).
 */
export function inferDialogState(events: DialogEventRow[]): DialogState {
  let currentSessionId: string | null = null;
  let pendingCoreQuestionSessionId: string | null = null;
  let answeredCoreFirst = false;

  for (const e of events) {
    switch (e.event_type) {
      case 'session.opened': {
        const sid = e.payload.session_id;
        if (sid != null) {
          currentSessionId = String(sid);
        }
        pendingCoreQuestionSessionId = null;
        break;
      }
      case 'question.asked': {
        if (
          e.payload.question_id === CORE_FIRST_QUESTION_ID &&
          currentSessionId != null &&
          String(e.payload.session_id) === currentSessionId
        ) {
          pendingCoreQuestionSessionId = currentSessionId;
        }
        break;
      }
      case 'answer.given': {
        if (e.payload.question_id === CORE_FIRST_QUESTION_ID) {
          answeredCoreFirst = true;
          pendingCoreQuestionSessionId = null;
        }
        break;
      }
      default:
        break;
    }
  }

  if (answeredCoreFirst) {
    return { type: 'answered' };
  }

  if (pendingCoreQuestionSessionId != null) {
    return {
      type: 'awaiting_answer',
      sessionId: pendingCoreQuestionSessionId,
      questionId: CORE_FIRST_QUESTION_ID,
      openingMessageMid: openingMidForSession(events, pendingCoreQuestionSessionId),
    };
  }

  const hasUserStarted = events.some((x) => x.event_type === 'user.started');
  if (hasUserStarted) {
    return { type: 'needs_first_question' };
  }

  return { type: 'needs_first_question' };
}

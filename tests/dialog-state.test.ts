import { describe, expect, it } from 'vitest';
import { CORE_FIRST_QUESTION_ID } from '../src/dialog/constants.js';
import { inferDialogState, type DialogEventRow } from '../src/dialog/resolve-state.js';

function row(type: string, payload: Record<string, unknown>): DialogEventRow {
  return { event_type: type, payload };
}

describe('inferDialogState', () => {
  it('needs_first_question after user.started only', () => {
    const events: DialogEventRow[] = [row('user.started', { max_user_id: 1 })];
    expect(inferDialogState(events)).toEqual({ type: 'needs_first_question' });
  });

  it('awaiting_answer after session.opened + question.asked for core:first', () => {
    const sid = 'sess-1';
    const events: DialogEventRow[] = [
      row('user.started', { max_user_id: 1 }),
      row('session.opened', {
        session_id: sid,
        max_user_id: 1,
        opening_message_mid: 'm-open',
      }),
      row('question.asked', {
        session_id: sid,
        question_id: CORE_FIRST_QUESTION_ID,
        max_user_id: 1,
      }),
    ];
    expect(inferDialogState(events)).toEqual({
      type: 'awaiting_answer',
      sessionId: sid,
      questionId: CORE_FIRST_QUESTION_ID,
      openingMessageMid: 'm-open',
    });
  });

  it('answered after answer.given for core:first', () => {
    const sid = 'sess-1';
    const events: DialogEventRow[] = [
      row('user.started', { max_user_id: 1 }),
      row('session.opened', { session_id: sid, max_user_id: 1 }),
      row('question.asked', {
        session_id: sid,
        question_id: CORE_FIRST_QUESTION_ID,
        max_user_id: 1,
      }),
      row('answer.given', {
        session_id: sid,
        question_id: CORE_FIRST_QUESTION_ID,
        max_user_id: 1,
      }),
    ];
    expect(inferDialogState(events)).toEqual({ type: 'answered' });
  });

  it('bot_started session has null openingMessageMid in awaiting_answer', () => {
    const sid = 'sess-b';
    const events: DialogEventRow[] = [
      row('user.started', { max_user_id: 2 }),
      row('session.opened', { session_id: sid, max_user_id: 2 }),
      row('question.asked', {
        session_id: sid,
        question_id: CORE_FIRST_QUESTION_ID,
        max_user_id: 2,
      }),
    ];
    expect(inferDialogState(events)).toEqual({
      type: 'awaiting_answer',
      sessionId: sid,
      questionId: CORE_FIRST_QUESTION_ID,
      openingMessageMid: null,
    });
  });
});

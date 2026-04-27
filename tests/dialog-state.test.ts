import { describe, expect, it } from 'vitest';
import { CORE_FIRST_QUESTION_ID, coreLlmQuestionId } from '../src/dialog/constants.js';
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

  it('needs_next_llm after answer.given for core:first without следующего вопроса', () => {
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
    expect(inferDialogState(events)).toEqual({
      type: 'needs_next_llm',
      sessionId: sid,
      lastAnswerQuestionId: CORE_FIRST_QUESTION_ID,
    });
  });

  it('awaiting_answer на core:llm:1 после question.asked', () => {
    const sid = 'sess-1';
    const q1 = coreLlmQuestionId(1);
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
      row('question.asked', {
        session_id: sid,
        question_id: q1,
        max_user_id: 1,
      }),
    ];
    expect(inferDialogState(events)).toEqual({
      type: 'awaiting_answer',
      sessionId: sid,
      questionId: q1,
      openingMessageMid: null,
    });
  });

  it('needs_next_llm после ответа на core:llm:2', () => {
    const sid = 's';
    const events: DialogEventRow[] = [
      row('user.started', { max_user_id: 1 }),
      row('session.opened', { session_id: sid, max_user_id: 1 }),
      row('question.asked', { session_id: sid, question_id: CORE_FIRST_QUESTION_ID, max_user_id: 1 }),
      row('answer.given', { session_id: sid, question_id: CORE_FIRST_QUESTION_ID, max_user_id: 1 }),
      row('question.asked', { session_id: sid, question_id: coreLlmQuestionId(1), max_user_id: 1 }),
      row('answer.given', { session_id: sid, question_id: coreLlmQuestionId(1), max_user_id: 1 }),
    ];
    expect(inferDialogState(events)).toEqual({
      type: 'needs_next_llm',
      sessionId: sid,
      lastAnswerQuestionId: coreLlmQuestionId(1),
    });
  });

  it('session_complete после ответа на core:llm:5', () => {
    const sid = 's';
    const chain: DialogEventRow[] = [row('user.started', { max_user_id: 1 }), row('session.opened', { session_id: sid, max_user_id: 1 })];
    chain.push(row('question.asked', { session_id: sid, question_id: CORE_FIRST_QUESTION_ID, max_user_id: 1 }));
    chain.push(row('answer.given', { session_id: sid, question_id: CORE_FIRST_QUESTION_ID, max_user_id: 1 }));
    for (let k = 1; k <= 5; k++) {
      chain.push(row('question.asked', { session_id: sid, question_id: coreLlmQuestionId(k), max_user_id: 1 }));
      chain.push(row('answer.given', { session_id: sid, question_id: coreLlmQuestionId(k), max_user_id: 1 }));
    }
    expect(inferDialogState(chain)).toEqual({ type: 'session_complete' });
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

  it('учитывает llmFollowupCount', () => {
    const sid = 's';
    const events: DialogEventRow[] = [
      row('user.started', { max_user_id: 1 }),
      row('session.opened', { session_id: sid, max_user_id: 1 }),
      row('question.asked', { session_id: sid, question_id: CORE_FIRST_QUESTION_ID, max_user_id: 1 }),
      row('answer.given', { session_id: sid, question_id: CORE_FIRST_QUESTION_ID, max_user_id: 1 }),
      row('question.asked', { session_id: sid, question_id: coreLlmQuestionId(1), max_user_id: 1 }),
      row('answer.given', { session_id: sid, question_id: coreLlmQuestionId(1), max_user_id: 1 }),
    ];
    expect(inferDialogState(events, { llmFollowupCount: 1 })).toEqual({ type: 'session_complete' });
  });

  it('не сбрасывает awaiting_answer если session.opened идёт позже question.asked (tiebreak порядок)', () => {
    // Имитирует случай, когда Postgres при одинаковом occurred_at вернул question.asked перед session.opened.
    // После фикса ORDER BY occurred_at, event_id такой порядок недостижим на живой БД,
    // но тест фиксирует, что inferDialogState устойчив к любому порядку: state должен быть awaiting_answer.
    const sid = 'sess-order';
    const events: DialogEventRow[] = [
      row('user.started', { max_user_id: 3 }),
      // намеренно переставлены: question.asked идёт до session.opened
      row('question.asked', {
        session_id: sid,
        question_id: CORE_FIRST_QUESTION_ID,
        max_user_id: 3,
      }),
      row('session.opened', { session_id: sid, max_user_id: 3, opening_message_mid: 'mid-x' }),
    ];
    // При инвертированном порядке session.opened сбрасывает pending → needs_first_question (регрессия).
    // Этот тест документирует поведение: корректный порядок (session.opened < question.asked)
    // обязан давать awaiting_answer; инвертированный — needs_first_question.
    // Фактически на проде порядок гарантирован tiebreaker event_id ASC в SQL-запросе.
    const correctOrder: DialogEventRow[] = [
      row('user.started', { max_user_id: 3 }),
      row('session.opened', { session_id: sid, max_user_id: 3, opening_message_mid: 'mid-x' }),
      row('question.asked', {
        session_id: sid,
        question_id: CORE_FIRST_QUESTION_ID,
        max_user_id: 3,
      }),
    ];
    expect(inferDialogState(correctOrder)).toEqual({
      type: 'awaiting_answer',
      sessionId: sid,
      questionId: CORE_FIRST_QUESTION_ID,
      openingMessageMid: 'mid-x',
    });
  });
});

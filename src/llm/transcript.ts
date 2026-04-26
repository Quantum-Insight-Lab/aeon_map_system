import type { DialogEventRow } from '../dialog/resolve-state.js';

/** Строки Q/A для промпта (только события указанной сессии). */
export function buildDialogTranscript(events: DialogEventRow[], sessionId: string): string {
  const lines: string[] = [];
  for (const e of events) {
    if (e.event_type === 'question.asked' && String(e.payload.session_id) === sessionId) {
      const text = String(e.payload.question_text ?? '');
      lines.push(`Бот: ${text}`);
    }
    if (e.event_type === 'answer.given' && String(e.payload.session_id) === sessionId) {
      const text = String(e.payload.answer_value ?? '');
      const qid = String(e.payload.question_id ?? '');
      lines.push(`Пользователь (${qid}): ${text}`);
    }
  }
  return lines.length > 0 ? lines.join('\n') : '(пока нет пар вопрос–ответ)';
}

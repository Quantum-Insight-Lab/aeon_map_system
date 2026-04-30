import type { ProtocolQuestion } from '../../protocols/cognitive_v1/questions.js';
import { protocolQuestionIndex } from '../../protocols/cognitive_v1/queue.js';

/** Payload кнопки «Продолжить» до показа текста протокольного вопроса (MAX inline_keyboard / callback). */
export const PROTOCOL_CONTINUE_CALLBACK_PAYLOAD = 'protocol_continue';

/** Префикс payload выбора варианта протокола: `pa|<индекс 0–11>|<ключ варианта>`. */
export const PROTOCOL_ANSWER_PAYLOAD_PREFIX = 'pa';

/** Один attachment для POST /messages (inline_keyboard). */
export type MaxInlineKeyboardAttachment = {
  type: 'inline_keyboard';
  payload: { buttons: Array<Array<{ type: 'callback'; text: string; payload: string }>> };
};

/** Одна кнопка «Продолжить». См. POST /messages → attachments → inline_keyboard. */
export function protocolContinueKeyboardAttachment(): MaxInlineKeyboardAttachment {
  return {
    type: 'inline_keyboard',
    payload: {
      buttons: [[{ type: 'callback', text: 'Продолжить', payload: PROTOCOL_CONTINUE_CALLBACK_PAYLOAD }]],
    },
  };
}

export function buildProtocolAnswerPayload(questionIndex: number, variantKey: string): string {
  return `${PROTOCOL_ANSWER_PAYLOAD_PREFIX}|${questionIndex}|${variantKey}`;
}

export function parseProtocolAnswerPayload(payload: string): { questionIndex: number; variantKey: string } | null {
  const prefix = `${PROTOCOL_ANSWER_PAYLOAD_PREFIX}|`;
  if (!payload.startsWith(prefix)) return null;
  const rest = payload.slice(prefix.length);
  const pipe = rest.indexOf('|');
  if (pipe < 0) return null;
  const idxStr = rest.slice(0, pipe);
  const variantKey = rest.slice(pipe + 1);
  if (!variantKey) return null;
  const questionIndex = Number(idxStr);
  if (!Number.isInteger(questionIndex) || questionIndex < 0 || questionIndex > 11) return null;
  return { questionIndex, variantKey };
}

const BTN_TEXT_MAX = 64;

function truncateBtn(text: string): string {
  return text.length <= BTN_TEXT_MAX ? text : `${text.slice(0, BTN_TEXT_MAX - 1)}…`;
}

/**
 * Цели и якорь: две строки по 4 callback-кнопки (ключ на кнопке = цифра или буква).
 * Модальность: одна строка — А, Б, Среднее М (payload по-прежнему ключ А / Б / М).
 */
export function protocolQuestionKeyboardAttachment(q: ProtocolQuestion): MaxInlineKeyboardAttachment {
  const questionIndex = protocolQuestionIndex(q.id);
  if (questionIndex < 0) {
    throw new Error(`protocolQuestionKeyboardAttachment: unknown question ${q.id}`);
  }

  const mk = (key: string, label: string): { type: 'callback'; text: string; payload: string } => ({
    type: 'callback',
    text: truncateBtn(label),
    payload: buildProtocolAnswerPayload(questionIndex, key),
  });

  if (q.axis === 'goal' || q.axis === 'anchor') {
    const v = q.variants;
    return {
      type: 'inline_keyboard',
      payload: {
        buttons: [
          v.slice(0, 4).map((x) => mk(x.key, x.key)),
          v.slice(4, 8).map((x) => mk(x.key, x.key)),
        ],
      },
    };
  }

  if (q.axis === 'modality') {
    const labels: readonly string[] = ['А', 'Б', 'М'];
    return {
      type: 'inline_keyboard',
      payload: {
        buttons: [q.variants.map((x, i) => mk(x.key, labels[i] ?? x.key))],
      },
    };
  }

  const _: never = q.axis;
  throw new Error(`protocolQuestionKeyboardAttachment: unexpected axis ${String(_)}`);
}

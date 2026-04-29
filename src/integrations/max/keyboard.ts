/** Payload кнопки «Продолжить» под протокольным вопросом (MAX inline_keyboard / callback). */
export const PROTOCOL_CONTINUE_CALLBACK_PAYLOAD = 'protocol_continue';

/** Одна кнопка в ряд — см. POST /messages → attachments → inline_keyboard. */
export function protocolContinueKeyboardAttachment(): {
  type: 'inline_keyboard';
  payload: { buttons: Array<Array<{ type: 'callback'; text: string; payload: string }>> };
} {
  return {
    type: 'inline_keyboard',
    payload: {
      buttons: [[{ type: 'callback', text: 'Продолжить', payload: PROTOCOL_CONTINUE_CALLBACK_PAYLOAD }]],
    },
  };
}

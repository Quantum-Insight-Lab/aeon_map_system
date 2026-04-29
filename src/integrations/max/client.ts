/** См. POST /messages → поле format (markdown | html). */
export type MaxTextFormat = 'markdown' | 'html';

/** Произвольное вложение для POST /messages (inline_keyboard и т.д.). */
export type MaxOutgoingAttachment = Record<string, unknown>;

export type SendMessageParams = {
  baseUrl: string;
  token: string;
  userId: number;
  text: string;
  format?: MaxTextFormat;
  attachments?: MaxOutgoingAttachment[];
};

/** POST /messages — см. https://dev.max.ru/docs-api/methods/POST/messages */
export async function sendMaxUserMessage(params: SendMessageParams): Promise<void> {
  const url = new URL(`${params.baseUrl.replace(/\/$/, '')}/messages`);
  url.searchParams.set('user_id', String(params.userId));
  const body: Record<string, unknown> = { text: params.text };
  if (params.format != null) {
    body.format = params.format;
  }
  if (params.attachments != null && params.attachments.length > 0) {
    body.attachments = params.attachments;
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: params.token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`MAX API ${res.status}: ${errBody}`);
  }
}

/** POST /answers — закрыть индикатор нажатия callback-кнопки. См. https://dev.max.ru/docs-api/methods/POST/answers */
export async function answerMaxCallback(opts: {
  baseUrl: string;
  token: string;
  callbackId: string;
  /** Короткий тост; можно не передавать. */
  notification?: string;
}): Promise<void> {
  const url = new URL(`${opts.baseUrl.replace(/\/$/, '')}/answers`);
  url.searchParams.set('callback_id', opts.callbackId);
  const body: Record<string, unknown> = {};
  if (opts.notification != null) {
    body.notification = opts.notification;
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: opts.token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`MAX API answers ${res.status}: ${errBody}`);
  }
}

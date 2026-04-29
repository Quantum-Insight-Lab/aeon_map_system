/** См. POST /messages → поле format (markdown | html). */
export type MaxTextFormat = 'markdown' | 'html';

export type SendMessageParams = {
  baseUrl: string;
  token: string;
  userId: number;
  text: string;
  format?: MaxTextFormat;
};

/** POST /messages — см. https://dev.max.ru/docs-api/methods/POST/messages */
export async function sendMaxUserMessage(params: SendMessageParams): Promise<void> {
  const url = new URL(`${params.baseUrl.replace(/\/$/, '')}/messages`);
  url.searchParams.set('user_id', String(params.userId));
  const body: Record<string, unknown> = { text: params.text };
  if (params.format != null) {
    body.format = params.format;
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
    const body = await res.text();
    throw new Error(`MAX API ${res.status}: ${body}`);
  }
}

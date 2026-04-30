/**
 * POST https://api.openai.com/v1/chat/completions.
 * Часть моделей принимает только max_completion_tokens (400 при max_tokens).
 */
export async function openAiChatCompletionUserMessage(opts: {
  apiKey: string;
  model: string;
  userContent: string;
  signal: AbortSignal;
  maxTokens?: number;
}): Promise<string> {
  const cap = opts.maxTokens ?? 1024;
  const url = 'https://api.openai.com/v1/chat/completions';
  const headers = {
    Authorization: `Bearer ${opts.apiKey}`,
    'content-type': 'application/json',
  };
  const messages = [{ role: 'user' as const, content: opts.userContent }];

  async function post(body: Record<string, unknown>): Promise<Response> {
    return fetch(url, {
      method: 'POST',
      signal: opts.signal,
      headers,
      body: JSON.stringify(body),
    });
  }

  let res = await post({
    model: opts.model,
    messages,
    max_tokens: cap,
  });
  let raw = await res.text();
  if (
    !res.ok &&
    res.status === 400 &&
    raw.includes('max_completion_tokens') &&
    raw.includes('max_tokens')
  ) {
    res = await post({
      model: opts.model,
      messages,
      max_completion_tokens: cap,
    });
    raw = await res.text();
  }
  if (!res.ok) {
    throw new Error(`OpenAI ${res.status}: ${raw.slice(0, 500)}`);
  }
  const data = JSON.parse(raw) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  const text = data.choices?.[0]?.message?.content?.trim() ?? '';
  if (!text) {
    throw new Error('OpenAI: пустой ответ');
  }
  return text;
}

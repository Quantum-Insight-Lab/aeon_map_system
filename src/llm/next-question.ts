import { createHash } from 'node:crypto';
import type { Config } from '../config.js';
import { loadDialogNextQuestionPrompt } from './load-prompt.js';
import { buildDialogTranscript } from './transcript.js';
import type { DialogEventRow } from '../dialog/resolve-state.js';

export type LlmGenerateResult = {
  text: string;
  model: string;
  provider: 'anthropic' | 'openai';
  latencyMs: number;
  inputHash: string;
  promptVersion: string;
};

function sha256Hex(s: string): string {
  return createHash('sha256').update(s, 'utf8').digest('hex');
}

async function callAnthropic(opts: {
  apiKey: string;
  model: string;
  userContent: string;
  timeoutMs: number;
}): Promise<{ text: string; latencyMs: number }> {
  const t0 = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs);
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        'x-api-key': opts.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: opts.model,
        max_tokens: 1024,
        messages: [{ role: 'user', content: opts.userContent }],
      }),
    });
    const latencyMs = Date.now() - t0;
    const raw = await res.text();
    if (!res.ok) {
      throw new Error(`Anthropic ${res.status}: ${raw.slice(0, 500)}`);
    }
    const data = JSON.parse(raw) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const block = data.content?.find((c) => c.type === 'text');
    const text = block?.text?.trim() ?? '';
    if (!text) {
      throw new Error('Anthropic: пустой ответ');
    }
    return { text, latencyMs };
  } finally {
    clearTimeout(timer);
  }
}

async function callOpenAiChat(opts: {
  apiKey: string;
  model: string;
  userContent: string;
  timeoutMs: number;
}): Promise<{ text: string; latencyMs: number }> {
  const t0 = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs);
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        Authorization: `Bearer ${opts.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: opts.model,
        max_tokens: 1024,
        messages: [{ role: 'user', content: opts.userContent }],
      }),
    });
    const latencyMs = Date.now() - t0;
    const raw = await res.text();
    if (!res.ok) {
      throw new Error(`OpenAI ${res.status}: ${raw.slice(0, 500)}`);
    }
    const data = JSON.parse(raw) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = data.choices?.[0]?.message?.content?.trim() ?? '';
    if (!text) {
      throw new Error('OpenAI: пустой ответ');
    }
    return { text, latencyMs };
  } finally {
    clearTimeout(timer);
  }
}

export async function generateNextQuestion(opts: {
  config: Config;
  events: DialogEventRow[];
  sessionId: string;
  log: {
    warn: (o: unknown, msg?: string) => void;
    info: (o: unknown, msg?: string) => void;
  };
}): Promise<LlmGenerateResult> {
  const { config, events, sessionId, log } = opts;
  const transcript = buildDialogTranscript(events, sessionId);
  const { body: userContent, promptVersion } = await loadDialogNextQuestionPrompt(transcript);
  const inputHash = sha256Hex(userContent);

  const timeoutMs = config.llmTimeoutMs;

  if (config.anthropicApiKey) {
    try {
      const { text, latencyMs } = await callAnthropic({
        apiKey: config.anthropicApiKey,
        model: config.anthropicModel,
        userContent,
        timeoutMs,
      });
      return {
        text,
        model: config.anthropicModel,
        provider: 'anthropic',
        latencyMs,
        inputHash,
        promptVersion,
      };
    } catch (e) {
      log.warn({ err: e, stage: 'anthropic' }, 'llm: anthropic failed');
    }
  } else {
    log.warn('llm: ANTHROPIC_API_KEY пуст');
  }

  if (config.openaiApiKey) {
    log.info({ metric: 'llm_fallback_openai' }, 'llm: fallback OpenAI');
    const { text, latencyMs } = await callOpenAiChat({
      apiKey: config.openaiApiKey,
      model: config.openaiTextModel,
      userContent,
      timeoutMs,
    });
    return {
      text,
      model: config.openaiTextModel,
      provider: 'openai',
      latencyMs,
      inputHash,
      promptVersion,
    };
  }

  throw new Error('Нет ни ANTHROPIC_API_KEY, ни OPENAI_API_KEY для LLM');
}

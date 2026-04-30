import { createHash } from 'node:crypto';
import type { Config } from '../config.js';
import type { DomainLogger } from '../util/domain-log.js';
import { dbg } from '../util/domain-log.js';
import type { CognitiveCardRenderPromptArgs } from './load-prompt.js';
import { loadCognitiveCardRenderPrompt } from './load-prompt.js';
import { openAiChatCompletionUserMessage } from './openai-chat-completion.js';

export type RenderCardResult = {
  cardMarkdown: string;
  latencyMs: number;
  model: string;
  provider: 'anthropic' | 'openai';
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
  maxTokens: number;
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
        max_tokens: opts.maxTokens,
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

/** Лимит завершения: десять разделов по-русски при разговорном стиле часто >2048 токенов. */
const CARD_RENDER_MAX_TOKENS = 4096;

/**
 * LLM: полный текст карты §6 методички по координатам сессии.
 */
export async function renderCognitiveCardMarkdown(opts: {
  config: Config;
  log: DomainLogger;
  promptArgs: CognitiveCardRenderPromptArgs;
  /** Переопределение таймаута (например скрипт замера latency). */
  timeoutMs?: number;
}): Promise<RenderCardResult> {
  const { config, log, promptArgs } = opts;
  const { body: userContent, promptVersion } = await loadCognitiveCardRenderPrompt(promptArgs);
  const inputHash = sha256Hex(userContent);
  const timeoutMs = opts.timeoutMs ?? config.cardRenderTimeoutMs ?? config.llmTimeoutMs;

  const finish = (
    text: string,
    latencyMs: number,
    model: string,
    provider: 'anthropic' | 'openai',
  ): RenderCardResult => ({
    cardMarkdown: text.replace(/\r\n/g, '\n').trim(),
    latencyMs,
    model,
    provider,
    inputHash,
    promptVersion,
  });

  if (config.anthropicApiKey) {
    try {
      dbg(log, 'dialog.llm.call', {
        purpose: 'card_render',
        provider: 'anthropic',
        model: config.anthropicModel,
        sessionId: promptArgs.sessionId,
      });
      const { text, latencyMs } = await callAnthropic({
        apiKey: config.anthropicApiKey,
        model: config.anthropicModel,
        userContent,
        timeoutMs,
        maxTokens: CARD_RENDER_MAX_TOKENS,
      });
      return finish(text, latencyMs, config.anthropicModel, 'anthropic');
    } catch (e) {
      log.warn({ err: e, stage: 'anthropic' }, 'card_render: anthropic failed');
    }
  } else {
    log.warn('card_render: ANTHROPIC_API_KEY пуст');
  }

  if (config.openaiApiKey) {
    dbg(log, 'dialog.llm.call', {
      purpose: 'card_render',
      provider: 'openai',
      model: config.openaiTextModel,
      sessionId: promptArgs.sessionId,
    });
    const t0 = Date.now();
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const text = await openAiChatCompletionUserMessage({
        apiKey: config.openaiApiKey,
        model: config.openaiTextModel,
        userContent,
        signal: ctrl.signal,
        maxTokens: CARD_RENDER_MAX_TOKENS,
      });
      return finish(text, Date.now() - t0, config.openaiTextModel, 'openai');
    } finally {
      clearTimeout(timer);
    }
  }

  throw new Error('Нет ни ANTHROPIC_API_KEY, ни OPENAI_API_KEY для рендера карты');
}

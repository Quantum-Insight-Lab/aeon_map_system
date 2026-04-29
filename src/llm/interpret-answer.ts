import { createHash } from 'node:crypto';
import type { Config } from '../config.js';
import { COGNITIVE_INTERPRET_PROMPT_VERSION } from '../dialog/protocol-constants.js';
import type { DomainLogger } from '../util/domain-log.js';
import { dbg } from '../util/domain-log.js';
import { loadCognitiveInterpretPrompt } from './load-prompt.js';
import { openAiChatCompletionUserMessage } from './openai-chat-completion.js';

export type InterpretAnswerResult = {
  interpretationText: string;
  latencyMs: number;
  model: string;
  provider: 'anthropic' | 'openai';
  inputHash: string;
  promptVersion: string;
  parsedCoordinate?: { axis: string; coordinate: string };
};

function sha256Hex(s: string): string {
  return createHash('sha256').update(s, 'utf8').digest('hex');
}

function extractJsonFooter(text: string): { axis: string; coordinate: string } | undefined {
  const lines = text.trim().split(/\r?\n/);
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i]?.trim();
    if (!line?.startsWith('{')) continue;
    try {
      const o = JSON.parse(line) as { axis?: unknown; coordinate?: unknown };
      if (typeof o.axis === 'string' && typeof o.coordinate === 'string') {
        return { axis: o.axis, coordinate: o.coordinate };
      }
    } catch {
      continue;
    }
  }
  const fence = text.match(/\{[\s\S]*"axis"[\s\S]*"coordinate"[\s\S]*\}/);
  if (fence) {
    try {
      const o = JSON.parse(fence[0]) as { axis?: unknown; coordinate?: unknown };
      if (typeof o.axis === 'string' && typeof o.coordinate === 'string') {
        return { axis: o.axis, coordinate: o.coordinate };
      }
    } catch {
      return undefined;
    }
  }
  return undefined;
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
    const text = await openAiChatCompletionUserMessage({
      apiKey: opts.apiKey,
      model: opts.model,
      userContent: opts.userContent,
      signal: ctrl.signal,
      maxTokens: 1024,
    });
    const latencyMs = Date.now() - t0;
    return { text, latencyMs };
  } finally {
    clearTimeout(timer);
  }
}

export async function interpretProtocolAnswer(opts: {
  config: Config;
  sessionId: string;
  questionId: string;
  answerText: string;
  mappedAxis: string;
  mappedCoordinate: string;
  priorCoordinatesSummary: string;
  log: DomainLogger;
}): Promise<InterpretAnswerResult> {
  const {
    config,
    sessionId,
    questionId,
    answerText,
    mappedAxis,
    mappedCoordinate,
    priorCoordinatesSummary,
    log,
  } = opts;
  const { body: userContent, promptVersion } = await loadCognitiveInterpretPrompt({
    sessionId,
    questionId,
    answerText,
    mappedAxis,
    mappedCoordinate,
    priorCoordinatesSummary,
  });
  const inputHash = sha256Hex(userContent);
  const timeoutMs = config.llmTimeoutMs;

  const parseAndFinish = (
    text: string,
    latencyMs: number,
    model: string,
    provider: 'anthropic' | 'openai',
  ): InterpretAnswerResult => {
    const parsedCoordinate = extractJsonFooter(text);
    return {
      interpretationText: text,
      latencyMs,
      model,
      provider,
      inputHash,
      promptVersion,
      parsedCoordinate,
    };
  };

  if (config.anthropicApiKey) {
    try {
      dbg(log, 'dialog.llm.call', {
        purpose: 'answer_interpretation',
        provider: 'anthropic',
        model: config.anthropicModel,
        questionId,
        sessionId,
      });
      const { text, latencyMs } = await callAnthropic({
        apiKey: config.anthropicApiKey,
        model: config.anthropicModel,
        userContent,
        timeoutMs,
      });
      return parseAndFinish(text, latencyMs, config.anthropicModel, 'anthropic');
    } catch (e) {
      log.warn({ err: e, stage: 'anthropic' }, 'interpret: anthropic failed');
    }
  } else {
    log.warn('interpret: ANTHROPIC_API_KEY пуст');
  }

  if (config.openaiApiKey) {
    log.info({ metric: 'interpret_fallback_openai' }, 'interpret: fallback OpenAI');
    dbg(log, 'dialog.llm.call', {
      purpose: 'answer_interpretation',
      provider: 'openai',
      model: config.openaiTextModel,
      questionId,
      sessionId,
    });
    const { text, latencyMs } = await callOpenAiChat({
      apiKey: config.openaiApiKey,
      model: config.openaiTextModel,
      userContent,
      timeoutMs,
    });
    return parseAndFinish(text, latencyMs, config.openaiTextModel, 'openai');
  }

  throw new Error('Нет ни ANTHROPIC_API_KEY, ни OPENAI_API_KEY для интерпретации');
}

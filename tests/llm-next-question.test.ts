import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Config } from '../src/config.js';
import type { DialogEventRow } from '../src/dialog/resolve-state.js';
import { generateNextQuestion } from '../src/llm/next-question.js';

const baseConfig: Config = {
  port: 3000,
  databaseUrl: '',
  maxBotToken: '',
  maxWebhookSecret: '',
  maxApiBaseUrl: '',
  logLevel: 'silent',
  firstCoreQuestionText: '',
  dialogAnswerAckText: '',
  dialogLlmNextQuestion: true,
  cognitiveProtocolVersion: 'v1',
  cardConfidenceThreshold: 0.55,
  llmRuleAgreementThreshold: 0.7,
  anthropicApiKey: 'k',
  anthropicModel: 'claude-x',
  openaiApiKey: 'ok',
  openaiTextModel: 'gpt-x',
  llmTimeoutMs: 5000,
  llmFollowupCount: 5,
};

describe('generateNextQuestion', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('при ошибке Anthropic вызывает OpenAI (fallback)', async () => {
    const log = { warn: vi.fn(), info: vi.fn() };
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('anthropic.com')) {
        return new Response('bad', { status: 500 });
      }
      if (url.includes('openai.com')) {
        return new Response(
          JSON.stringify({ choices: [{ message: { content: 'Вопрос от OpenAI' } }] }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      throw new Error(url);
    });
    vi.stubGlobal('fetch', fetchMock);

    const events: DialogEventRow[] = [
      { event_type: 'question.asked', payload: { session_id: 's1', question_text: 'Q0?' } },
    ];
    const r = await generateNextQuestion({
      config: baseConfig,
      events,
      sessionId: 's1',
      log,
    });
    expect(r.provider).toBe('openai');
    expect(r.model).toBe('gpt-x');
    expect(r.text).toContain('OpenAI');
    expect(r.promptVersion).toBe('dialog-next-question@v1');
    expect(log.info).toHaveBeenCalled();
  });
});

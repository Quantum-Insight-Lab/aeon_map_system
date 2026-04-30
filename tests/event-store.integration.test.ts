import pg from 'pg';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PROTOCOL_FIRST_QUESTION_ID } from '../src/protocols/cognitive_v1/queue.js';
import { runMigrations } from '../src/db/migrate.js';
import { insertEvent } from '../src/db/insert-event.js';
import { handleMaxWebhook } from '../src/services/webhook-service.js';
import type { Config } from '../src/config.js';
import type { MaxUpdate } from '../src/integrations/max/types.js';

const dsn = process.env.TEST_DATABASE_URL;

function mockLlmFetch(): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('api.anthropic.com')) {
        return new Response(
          JSON.stringify({
            content: [
              {
                type: 'text',
                text: 'Интерпретация ответа пользователя.\n{"axis":"goal","coordinate":"Истина"}',
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      if (url.includes('api.openai.com')) {
        return new Response(
          JSON.stringify({ choices: [{ message: { content: 'Fallback вопрос OpenAI?' } }] }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      throw new Error(`unexpected fetch: ${url}`);
    }),
  );
}

describe.skipIf(!dsn)('event store (integration)', () => {
  let pool: pg.Pool;

  const testConfig: Config = {
    port: 3000,
    databaseUrl: dsn!,
    maxBotToken: '',
    maxWebhookSecret: '',
    maxApiBaseUrl: 'https://platform-api.max.ru',
    logLevel: 'silent',
    firstCoreQuestionText: 'Тестовый первый вопрос?',
    dialogAnswerAckText: 'Ок.',
    anthropicApiKey: 'test-anthropic',
    anthropicModel: 'claude-test',
    openaiApiKey: 'test-openai',
    openaiTextModel: 'gpt-test',
    llmTimeoutMs: 5000,
    llmFollowupCount: 5,
    dialogLlmNextQuestion: false,
    cognitiveProtocolVersion: 'v1',
    cardConfidenceThreshold: 0.5,
    cardConfidenceStrongThreshold: 0.75,
    llmRuleAgreementThreshold: 0.7,
  };

  const log = {
    warn: () => {},
    info: () => {},
  };

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: dsn });
    await runMigrations(pool);
  });

  afterAll(async () => {
    await pool.end();
  });

  beforeEach(async () => {
    mockLlmFetch();
    await pool.query('TRUNCATE events');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('rejects UPDATE on events (append-only trigger)', async () => {
    await insertEvent(pool, {
      eventType: 'user.started',
      actor: { id: '1', role: 'user' },
      subject: { entity: 'max_bot', id: 'aeon-max-bot' },
      payload: { max_user_id: 1 },
      idempotencyKey: 'user.started:1',
    });
    const row = await pool.query<{ event_id: string }>('SELECT event_id FROM events LIMIT 1');
    const eventId = row.rows[0].event_id;
    await expect(
      pool.query('UPDATE events SET payload = $1::jsonb WHERE event_id = $2', ['{}', eventId]),
    ).rejects.toThrow(/append-only|mutation forbidden/i);
  });

  it('rejects DELETE on events', async () => {
    await insertEvent(pool, {
      eventType: 'user.started',
      actor: { id: '2', role: 'user' },
      subject: { entity: 'max_bot', id: 'aeon-max-bot' },
      payload: { max_user_id: 2 },
      idempotencyKey: 'user.started:2',
    });
    await expect(pool.query('DELETE FROM events WHERE idempotency_key = $1', ['user.started:2'])).rejects.toThrow(
      /append-only|mutation forbidden/i,
    );
  });

  it('duplicate message_created webhook does not insert second user.started', async () => {
    const update: MaxUpdate = {
      update_type: 'message_created',
      timestamp: 10_000,
      message: {
        timestamp: 10_000,
        body: { mid: 'mid.dup-test', text: 'hello' },
        sender: { user_id: 4242, is_bot: false },
      },
    };
    await handleMaxWebhook({ config: testConfig, pool, update, log });
    await handleMaxWebhook({ config: testConfig, pool, update, log });
    const r = await pool.query<{ c: string }>(
      `SELECT count(*)::text AS c FROM events WHERE event_type = 'user.started' AND payload->>'max_user_id' = '4242'`,
    );
    expect(r.rows[0].c).toBe('1');
  });

  it('iter-2: first message creates session.opened and question.asked', async () => {
    const u1: MaxUpdate = {
      update_type: 'message_created',
      timestamp: 1,
      message: {
        timestamp: 1,
        body: { mid: 'mid-iter2-1', text: 'hi' },
        sender: { user_id: 9100, is_bot: false },
      },
    };
    await handleMaxWebhook({ config: testConfig, pool, update: u1, log });
    const types = await pool.query<{ event_type: string }>(
      `SELECT event_type FROM events ORDER BY occurred_at`,
    );
    expect(types.rows.map((r) => r.event_type)).toEqual([
      'user.started',
      'session.opened',
      'question.asked',
    ]);
  });

  it('iter-2: second message appends answer.given', async () => {
    const u1: MaxUpdate = {
      update_type: 'message_created',
      timestamp: 1,
      message: {
        timestamp: 1,
        body: { mid: 'mid-iter2-a', text: 'hi' },
        sender: { user_id: 9101, is_bot: false },
      },
    };
    const u2: MaxUpdate = {
      update_type: 'message_created',
      timestamp: 2,
      message: {
        timestamp: 2,
        body: { mid: 'mid-iter2-b', text: '1' },
        sender: { user_id: 9101, is_bot: false },
      },
    };
    await handleMaxWebhook({ config: testConfig, pool, update: u1, log });
    await handleMaxWebhook({ config: testConfig, pool, update: u2, log });
    const types = await pool.query<{ event_type: string }>(
      `SELECT event_type FROM events ORDER BY occurred_at`,
    );
    expect(types.rows.map((r) => r.event_type)).toEqual([
      'user.started',
      'session.opened',
      'question.asked',
      'answer.given',
      'protocol.coordinate_assigned',
      'llm.called',
      'answer.interpreted',
      'question.asked',
    ]);
    const ans = await pool.query<{ answer_value: string }>(
      `SELECT payload->>'answer_value' AS answer_value FROM events WHERE event_type = 'answer.given'`,
    );
    expect(ans.rows[0].answer_value).toBe('1');
  });

  it('iter-2: duplicate answer webhook does not duplicate answer.given', async () => {
    const u1: MaxUpdate = {
      update_type: 'message_created',
      timestamp: 1,
      message: {
        timestamp: 1,
        body: { mid: 'mid-iter2-d1', text: 'hi' },
        sender: { user_id: 9102, is_bot: false },
      },
    };
    const u2: MaxUpdate = {
      update_type: 'message_created',
      timestamp: 2,
      message: {
        timestamp: 2,
        body: { mid: 'mid-iter2-d2', text: 'ans' },
        sender: { user_id: 9102, is_bot: false },
      },
    };
    await handleMaxWebhook({ config: testConfig, pool, update: u1, log });
    await handleMaxWebhook({ config: testConfig, pool, update: u2, log });
    await handleMaxWebhook({ config: testConfig, pool, update: u2, log });
    const c = await pool.query<{ c: string }>(`SELECT count(*)::text AS c FROM events WHERE event_type = 'answer.given'`);
    expect(c.rows[0].c).toBe('1');
  });

  it('iter-2: duplicate first message does not insert answer.given', async () => {
    const u1: MaxUpdate = {
      update_type: 'message_created',
      timestamp: 1,
      message: {
        timestamp: 1,
        body: { mid: 'mid-iter2-open-dup', text: 'hi' },
        sender: { user_id: 9103, is_bot: false },
      },
    };
    await handleMaxWebhook({ config: testConfig, pool, update: u1, log });
    await handleMaxWebhook({ config: testConfig, pool, update: u1, log });
    const c = await pool.query<{ c: string }>(`SELECT count(*)::text AS c FROM events WHERE event_type = 'answer.given'`);
    expect(c.rows[0].c).toBe('0');
    const q = await pool.query<{ c: string }>(
      `SELECT count(*)::text AS c FROM events WHERE event_type = 'question.asked' AND payload->>'question_id' = $1`,
      [PROTOCOL_FIRST_QUESTION_ID],
    );
    expect(q.rows[0].c).toBe('1');
  });
});

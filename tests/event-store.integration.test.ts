import pg from 'pg';
import { v7 as uuidv7 } from 'uuid';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PROTOCOL_FIRST_QUESTION_ID, PROTOCOL_QUESTION_IDS } from '../src/protocols/cognitive_v1/queue.js';
import { runMigrations } from '../src/db/migrate.js';
import { insertEvent } from '../src/db/insert-event.js';
import { insertProtocolCoordinateAssigned } from '../src/db/protocol-events.js';
import { insertAnswerGiven } from '../src/db/session-events.js';
import { handleMaxWebhook } from '../src/services/webhook-service.js';
import { deliverCardComputed } from '../src/dialog/deliver-card-computed.js';
import { COGNITIVE_CARD_TYPE } from '../src/dialog/protocol-constants.js';
import type { ProtocolAnswersMapped } from '../src/aeon/cognitive-engine.js';
import type { Config } from '../src/config.js';
import type { MaxUpdate, MessageCallbackUpdate } from '../src/integrations/max/types.js';
import { PROTOCOL_CONTINUE_CALLBACK_PAYLOAD, buildProtocolAnswerPayload } from '../src/integrations/max/keyboard.js';

const dsn = process.env.TEST_DATABASE_URL;

function messageCallback(opts: {
  timestamp: number;
  updateId: string;
  callbackId: string;
  userId: number;
  payload: string;
}): MessageCallbackUpdate {
  return {
    update_type: 'message_callback',
    timestamp: opts.timestamp,
    update_id: opts.updateId,
    callback: {
      callback_id: opts.callbackId,
      payload: opts.payload,
      user: { user_id: opts.userId },
    },
  };
}

function stubFetchInterpretAndCard(): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('platform-api.max.ru')) {
        return new Response('{}', { status: 200 });
      }
      if (url.includes('api.anthropic.com')) {
        const raw = typeof init?.body === 'string' ? init.body : '{}';
        let userMsg = '';
        try {
          const body = JSON.parse(raw) as { messages?: Array<{ content?: string }> };
          userMsg = String(body.messages?.[0]?.content ?? '');
        } catch {
          userMsg = '';
        }
        if (userMsg.includes('cognitive_card_render_input_v1')) {
          const text =
            '### 1. Координаты\nТест карты.\n\n### 7. Парадокс мыслителя\nВторая часть.';
          return new Response(JSON.stringify({ content: [{ type: 'text', text }] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
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

async function seedProtocolFromMapped(
  pool: pg.Pool,
  opts: { sessionId: string; maxUserId: number; mapped: ProtocolAnswersMapped },
): Promise<void> {
  const { goals, modalities, anchors } = opts.mapped;
  for (let i = 0; i < PROTOCOL_QUESTION_IDS.length; i++) {
    const qid = PROTOCOL_QUESTION_IDS[i]!;
    let axis: string;
    let coordinate: string;
    if (i < 4) {
      axis = 'goal';
      coordinate = goals[i]!;
    } else if (i < 9) {
      axis = 'modality';
      coordinate = modalities[i - 4]!;
    } else {
      axis = 'anchor';
      coordinate = anchors[i - 9]!;
    }
    const ans = await insertAnswerGiven(pool, {
      maxUserId: opts.maxUserId,
      sessionId: opts.sessionId,
      questionId: qid,
      answerValue: coordinate,
      answerType: 'protocol_choice',
      maxUpdateId: `seed:${opts.sessionId}:${qid}`,
    });
    await insertProtocolCoordinateAssigned(pool, {
      sessionId: opts.sessionId,
      maxUserId: opts.maxUserId,
      questionId: qid,
      answerEventId: ans.eventId,
      cardType: COGNITIVE_CARD_TYPE,
      axis,
      coordinate,
      sourceQuestionId: qid,
    });
  }
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
    dialogProtocolContinueGateMarkdown: 'Продолжить?',
    dialogAwaitContinueHintText: 'Жди.',
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
    cardRenderEnabled: true,
    cardRenderTimeoutMs: 5000,
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
    stubFetchInterpretAndCard();
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

  it('iter-4: первое сообщение — session + ворота «Продолжить» (ещё без question.asked)', async () => {
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
      'protocol.continue_offered',
    ]);
  });

  it('iter-4: continue + callback ответа на Ц1 — цепочка до следующего ворота', async () => {
    const u1: MaxUpdate = {
      update_type: 'message_created',
      timestamp: 1,
      message: {
        timestamp: 1,
        body: { mid: 'mid-iter2-a', text: 'hi' },
        sender: { user_id: 9101, is_bot: false },
      },
    };
    const uContinue = messageCallback({
      timestamp: 2,
      updateId: 'cb-cont-9101',
      callbackId: 'cid-cont-9101',
      userId: 9101,
      payload: PROTOCOL_CONTINUE_CALLBACK_PAYLOAD,
    });
    const uGoal1 = messageCallback({
      timestamp: 3,
      updateId: 'cb-g1-9101',
      callbackId: 'cid-g1-9101',
      userId: 9101,
      payload: buildProtocolAnswerPayload(0, '1'),
    });
    await handleMaxWebhook({ config: testConfig, pool, update: u1, log });
    await handleMaxWebhook({ config: testConfig, pool, update: uContinue, log });
    await handleMaxWebhook({ config: testConfig, pool, update: uGoal1, log });
    const types = await pool.query<{ event_type: string }>(
      `SELECT event_type FROM events ORDER BY occurred_at`,
    );
    expect(types.rows.map((r) => r.event_type)).toEqual([
      'user.started',
      'session.opened',
      'protocol.continue_offered',
      'question.asked',
      'answer.given',
      'protocol.coordinate_assigned',
      'llm.called',
      'answer.interpreted',
      'protocol.continue_offered',
    ]);
    const ans = await pool.query<{ answer_value: string }>(
      `SELECT payload->>'answer_value' AS answer_value FROM events WHERE event_type = 'answer.given'`,
    );
    expect(ans.rows[0].answer_value).toBe('1');
  });

  it('iter-4: повтор того же callback-ответа не дублирует answer.given', async () => {
    const u1: MaxUpdate = {
      update_type: 'message_created',
      timestamp: 1,
      message: {
        timestamp: 1,
        body: { mid: 'mid-iter2-d1', text: 'hi' },
        sender: { user_id: 9102, is_bot: false },
      },
    };
    const uContinue = messageCallback({
      timestamp: 2,
      updateId: 'cb-cont-9102',
      callbackId: 'cid-cont-9102',
      userId: 9102,
      payload: PROTOCOL_CONTINUE_CALLBACK_PAYLOAD,
    });
    const uAns = messageCallback({
      timestamp: 3,
      updateId: 'cb-dup-9102',
      callbackId: 'cid-dup-9102',
      userId: 9102,
      payload: buildProtocolAnswerPayload(0, '6'),
    });
    await handleMaxWebhook({ config: testConfig, pool, update: u1, log });
    await handleMaxWebhook({ config: testConfig, pool, update: uContinue, log });
    await handleMaxWebhook({ config: testConfig, pool, update: uAns, log });
    await handleMaxWebhook({ config: testConfig, pool, update: uAns, log });
    const c = await pool.query<{ c: string }>(`SELECT count(*)::text AS c FROM events WHERE event_type = 'answer.given'`);
    expect(c.rows[0].c).toBe('1');
  });

  it('iter-4: дубль первого message_created не создаёт answer.given; question.asked после ворот ещё нет', async () => {
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
    expect(q.rows[0].c).toBe('0');
  });

  it('iter-5: deliverCardComputed записывает llm.called card_render и card.rendered', async () => {
    const sessionId = uuidv7();
    const maxUserId = 99002;
    const mapped: ProtocolAnswersMapped = {
      goals: ['Понимание', 'Понимание', 'Понимание', 'Понимание'],
      modalities: ['А', 'А', 'Б', 'Б', 'А'],
      anchors: ['Б', 'Б', 'Б'],
    };
    await seedProtocolFromMapped(pool, { sessionId, maxUserId, mapped });
    await deliverCardComputed({
      pool,
      config: { ...testConfig, maxBotToken: 'tok' },
      maxUserId,
      sessionId,
      log,
    });
    const r = await pool.query<{ event_type: string; purpose: string | null }>(
      `SELECT event_type, payload->>'purpose' AS purpose FROM events
       WHERE payload->>'session_id' = $1
       ORDER BY occurred_at ASC`,
      [sessionId],
    );
    const types = r.rows.map((x) => x.event_type);
    expect(types).toContain('card.computed');
    expect(types).toContain('card.rendered');
    const cardLlm = r.rows.filter((x) => x.event_type === 'llm.called' && x.purpose === 'card_render');
    expect(cardLlm.length).toBe(1);
    const rendered = await pool.query<{ card_text: string }>(
      `SELECT payload->>'card_text' AS card_text FROM events WHERE event_type = 'card.rendered' AND payload->>'session_id' = $1`,
      [sessionId],
    );
    expect(rendered.rows[0]?.card_text ?? '').toContain('Координаты');

    const link = await pool.query<{ llm_call_id: string; event_id: string }>(
      `SELECT cr.payload->>'llm_call_id' AS llm_call_id, ll.event_id::text AS event_id
       FROM events cr
       JOIN events ll ON ll.event_id::text = cr.payload->>'llm_call_id'
       WHERE cr.event_type = 'card.rendered'
         AND ll.event_type = 'llm.called'
         AND cr.payload->>'session_id' = $1`,
      [sessionId],
    );
    expect(link.rows.length).toBe(1);
    expect(link.rows[0]!.llm_call_id).toBe(link.rows[0]!.event_id);
  });

  it('iter-4 INV-03: card.computed без имён типов при confidence ниже CARD_CONFIDENCE_THRESHOLD', async () => {
    const sessionId = uuidv7();
    const maxUserId = 99003;
    const mapped: ProtocolAnswersMapped = {
      goals: ['Истина', 'Понимание', 'Ясность', 'Решение'],
      modalities: ['А', 'А', 'А', 'М', 'А'],
      anchors: ['Б', 'Б', 'Б'],
    };
    await seedProtocolFromMapped(pool, { sessionId, maxUserId, mapped });
    await deliverCardComputed({
      pool,
      config: { ...testConfig, maxBotToken: '', cardRenderEnabled: false },
      maxUserId,
      sessionId,
      log,
    });
    const row = await pool.query<{ matched_types: unknown; confidence: string | null }>(
      `SELECT payload->'matched_types' AS matched_types, payload->>'confidence' AS confidence
       FROM events
       WHERE event_type = 'card.computed' AND payload->>'session_id' = $1`,
      [sessionId],
    );
    expect(row.rows.length).toBe(1);
    expect(Number(row.rows[0]!.confidence)).toBeLessThan(testConfig.cardConfidenceThreshold);
    expect(row.rows[0]!.matched_types).toEqual([]);
  });

  it('iter-4 INV-04: card.computed synthetic_drawing=true при синтетическом двойном рисунке', async () => {
    const sessionId = uuidv7();
    const maxUserId = 99004;
    const mapped: ProtocolAnswersMapped = {
      goals: ['Возможность', 'Согласованность', 'Возможность', 'Возможность'],
      modalities: ['А', 'М', 'Б', 'М', 'М'],
      anchors: ['Б', 'Ж', 'В'],
    };
    await seedProtocolFromMapped(pool, { sessionId, maxUserId, mapped });
    await deliverCardComputed({
      pool,
      config: { ...testConfig, maxBotToken: '', cardRenderEnabled: false },
      maxUserId,
      sessionId,
      log,
    });
    const row = await pool.query<{ synthetic_drawing: string | null; matched_len: string | null }>(
      `SELECT payload->>'synthetic_drawing' AS synthetic_drawing,
              jsonb_array_length(payload->'matched_types')::text AS matched_len
       FROM events
       WHERE event_type = 'card.computed' AND payload->>'session_id' = $1`,
      [sessionId],
    );
    expect(row.rows.length).toBe(1);
    expect(row.rows[0]!.synthetic_drawing).toBe('true');
    expect(Number(row.rows[0]!.matched_len)).toBeGreaterThanOrEqual(2);
  });
});

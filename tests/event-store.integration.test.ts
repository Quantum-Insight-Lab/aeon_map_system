import pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { runMigrations } from '../src/db/migrate.js';
import { insertEvent } from '../src/db/insert-event.js';
import { handleMaxWebhook } from '../src/services/webhook-service.js';
import type { Config } from '../src/config.js';
import type { MaxUpdate } from '../src/integrations/max/types.js';

const dsn = process.env.TEST_DATABASE_URL;

describe.skipIf(!dsn)('event store (integration)', () => {
  let pool: pg.Pool;

  const testConfig: Config = {
    port: 3000,
    databaseUrl: dsn!,
    maxBotToken: '',
    maxWebhookSecret: '',
    maxApiBaseUrl: 'https://platform-api.max.ru',
    logLevel: 'silent',
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
    await pool.query('TRUNCATE events');
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
});

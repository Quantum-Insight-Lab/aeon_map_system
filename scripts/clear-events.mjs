#!/usr/bin/env node
/**
 * Очищает таблицу events (ручное тестирование / сброс диалога).
 *
 * По умолчанию: DATABASE_URL из окружения.
 * Флаг --test: TEST_DATABASE_URL или дефолт как в ensure-test-db.mjs.
 *
 * Примеры:
 *   npm run db:clear
 *   npm run db:clear:test
 */
import pg from 'pg';

const FALLBACK_TEST_URL = 'postgres://aeon:aeon@127.0.0.1:5433/aeon_test';

const useTest = process.argv.includes('--test');
const connectionString = useTest
  ? (process.env.TEST_DATABASE_URL ?? FALLBACK_TEST_URL)
  : process.env.DATABASE_URL;

if (!connectionString) {
  console.error(
    'clear-events: задай DATABASE_URL (или npm run db:clear с --env-file=.env), либо запусти с --test для TEST_DATABASE_URL',
  );
  process.exit(1);
}

let dbLabel = connectionString;
try {
  const u = new URL(connectionString);
  dbLabel = `${u.hostname}:${u.port || '5432'}${u.pathname}`;
} catch {
  /* keep raw */
}

const pool = new pg.Pool({ connectionString });
try {
  await pool.query('TRUNCATE events');
  console.log(`clear-events: TRUNCATE events — ${dbLabel}${useTest ? ' (--test)' : ''}`);
} catch (e) {
  console.error('clear-events:', e instanceof Error ? e.message : e);
  process.exit(1);
} finally {
  await pool.end();
}

#!/usr/bin/env node
/**
 * Создаёт БД для интеграционных тестов (имя из pathname TEST_DATABASE_URL), если её ещё нет.
 * Подключается к maintenance DB `postgres` на том же хосте/порту/учётке.
 */
import pg from 'pg';

/** Держи в синхроне с vitest.config.ts (default TEST_DATABASE_URL). */
const FALLBACK_TEST_URL = 'postgres://aeon:aeon@127.0.0.1:5433/aeon_test';

const rawUrl = process.env.TEST_DATABASE_URL ?? FALLBACK_TEST_URL;

let parsed;
try {
  parsed = new URL(rawUrl);
} catch {
  console.error('ensure-test-db: невалидный TEST_DATABASE_URL');
  process.exit(1);
}

let dbName = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
if (!dbName) dbName = 'aeon_test';

if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(dbName)) {
  console.error('ensure-test-db: небезопасное имя БД:', dbName);
  process.exit(1);
}

parsed.pathname = '/postgres';
const adminUrl = parsed.toString();

const pool = new pg.Pool({ connectionString: adminUrl });
try {
  const r = await pool.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
  if (r.rowCount === 0) {
    await pool.query(`CREATE DATABASE ${dbName}`);
    console.log(`ensure-test-db: создана БД ${dbName}`);
  } else {
    console.log(`ensure-test-db: БД ${dbName} уже есть`);
  }
} catch (e) {
  console.error('ensure-test-db:', e instanceof Error ? e.message : e);
  process.exit(1);
} finally {
  await pool.end();
}

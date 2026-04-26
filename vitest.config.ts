import { defineConfig } from 'vitest/config';

/** Держи в синхроне с scripts/ensure-test-db.mjs (FALLBACK_TEST_URL). */
const DEFAULT_TEST_DATABASE_URL =
  'postgres://aeon:aeon@127.0.0.1:5433/aeon_test';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    env: {
      TEST_DATABASE_URL:
        process.env.TEST_DATABASE_URL ?? DEFAULT_TEST_DATABASE_URL,
    },
  },
});

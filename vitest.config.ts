import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';

/** Подхватывает `.env` / `.env.test` как при `vite`, без обязательного `node --env-file` в npm scripts. */
export default defineConfig(({ mode }) => {
  const fromFiles = loadEnv(mode, process.cwd(), '');
  for (const [key, value] of Object.entries(fromFiles)) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }

  return {
    test: {
      environment: 'node',
      include: ['tests/**/*.test.ts'],
    },
  };
});

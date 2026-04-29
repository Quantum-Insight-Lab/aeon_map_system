import { loadConfig } from './config.js';
import { runMigrations } from './db/migrate.js';
import { createPool } from './db/pool.js';
import { buildApp } from './app.js';

async function main(): Promise<void> {
  const config = loadConfig();
  if (!config.databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  const pool = createPool(config.databaseUrl);
  await runMigrations(pool);

  const app = await buildApp({ config, pool });
  app.log.info(
    {
      LOG_LEVEL: config.logLevel,
      note:
        'Строки «incoming request» у Fastify — всегда info (≈30). Детали: ключи max.webhook.update и dialog.* на уровне debug (≈20), только если LOG_LEVEL=debug и переменная реально загружена (npm run dev / node --env-file=.env …)',
    },
    'server.logging',
  );
  app.log.debug({ probe: true }, 'server.logging.debug_probe');
  await app.listen({ host: '0.0.0.0', port: config.port });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

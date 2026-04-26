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
  await app.listen({ host: '0.0.0.0', port: config.port });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

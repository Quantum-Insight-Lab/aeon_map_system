import Fastify, { type FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import type { Config } from './config.js';
import type { AppRedis } from './lib/redis.js';
import { healthRoutes } from './routes/health.js';
import { webhookRoutes } from './routes/webhook.js';

export async function buildApp(opts: {
  config: Config;
  pool: Pool;
  redis: AppRedis;
}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: { level: opts.config.logLevel },
  });
  await app.register(healthRoutes);
  await app.register(webhookRoutes, {
    config: opts.config,
    pool: opts.pool,
    redis: opts.redis,
  });
  return app;
}

import type { FastifyPluginAsync } from 'fastify';
import type { Pool } from 'pg';
import type { Config } from '../config.js';
import type { AppRedis } from '../lib/redis.js';
import type { MaxUpdate } from '../integrations/max/types.js';
import { handleMaxWebhook } from '../services/webhook-service.js';

export const webhookRoutes: FastifyPluginAsync<{
  config: Config;
  pool: Pool;
  redis: AppRedis;
}> = async (app, opts) => {
  const { config, pool, redis } = opts;

  app.post('/webhook', async (req, reply) => {
    if (config.maxWebhookSecret) {
      const secret = req.headers['x-max-bot-api-secret'];
      if (secret !== config.maxWebhookSecret) {
        return reply.code(401).send({ ok: false, error: 'invalid secret' });
      }
    }

    const update = req.body as MaxUpdate;
    try {
      const result = await handleMaxWebhook({
        config,
        pool,
        redis,
        update,
        log: app.log,
      });
      return reply.send({ ok: true, ...result });
    } catch (e) {
      app.log.error(e);
      return reply.code(500).send({ ok: false });
    }
  });
};

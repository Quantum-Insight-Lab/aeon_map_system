import type { FastifyPluginAsync } from 'fastify';
import type { Pool } from 'pg';
import type { Config } from '../config.js';
import type { MaxUpdate } from '../integrations/max/types.js';
import { handleMaxWebhook } from '../services/webhook-service.js';
import type { DomainLogger } from '../util/domain-log.js';
import { dbg } from '../util/domain-log.js';

export const webhookRoutes: FastifyPluginAsync<{
  config: Config;
  pool: Pool;
}> = async (app, opts) => {
  const { config, pool } = opts;

  app.post('/webhook', async (req, reply) => {
    if (config.maxWebhookSecret) {
      const secret = req.headers['x-max-bot-api-secret'];
      if (secret !== config.maxWebhookSecret) {
        return reply.code(401).send({ ok: false, error: 'invalid secret' });
      }
    }

    const update = req.body as MaxUpdate;
    dbg(req.log as DomainLogger, 'max.webhook.update', {
      update_type: update.update_type,
      hint: 'строки req/res сервера — уровень info (30); детали — ключи dialog.* при LOG_LEVEL=debug',
    });
    try {
      const result = await handleMaxWebhook({
        config,
        pool,
        update,
        log: req.log as DomainLogger,
      });
      return reply.send({ ok: true, ...result });
    } catch (e) {
      app.log.error(e);
      return reply.code(500).send({ ok: false });
    }
  });
};

import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { healthRoutes } from '../src/routes/health.js';

describe('health', () => {
  it('returns ok', async () => {
    const app = Fastify({ logger: false });
    await app.register(healthRoutes);
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.payload)).toEqual({ status: 'ok' });
    await app.close();
  });
});

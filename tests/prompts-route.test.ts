import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { promptsRoutes } from '../src/routes/prompts.js';

describe('/prompts', () => {
  it('lists markdown prompts with frontmatter version', async () => {
    const app = Fastify({ logger: false });
    await app.register(promptsRoutes);
    const res = await app.inject({ method: 'GET', url: '/prompts' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload) as { prompts: Array<{ file: string; prompt_version: string | null }> };
    const dialog = body.prompts.find((p) => p.file === 'dialog-next-question.md');
    expect(dialog?.prompt_version).toBe('dialog-next-question@v1');
    await app.close();
  });
});

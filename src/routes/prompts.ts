import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { FastifyPluginAsync } from 'fastify';

/** Список промптов в `prompts/` (имя файла + `prompt_version` из YAML frontmatter, если есть). */
export const promptsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/prompts', async () => {
    const dir = path.join(process.cwd(), 'prompts');
    const names = (await readdir(dir)).filter((f) => f.endsWith('.md'));
    const prompts = await Promise.all(
      names.map(async (name) => {
        const raw = await readFile(path.join(dir, name), 'utf8');
        const prompt_version = raw.match(/^prompt_version:\s*(.+)$/m)?.[1]?.trim() ?? null;
        return { file: name, prompt_version };
      }),
    );
    return { prompts };
  });
};

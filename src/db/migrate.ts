import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Pool } from 'pg';

export async function runMigrations(
  pool: Pool,
  migrationsDir = path.join(process.cwd(), 'migrations'),
): Promise<void> {
  let files: string[];
  try {
    files = (await readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort();
  } catch (e) {
    throw new Error(`Migrations dir unreadable: ${migrationsDir}: ${e}`);
  }
  for (const file of files) {
    const sql = await readFile(path.join(migrationsDir, file), 'utf8');
    await pool.query(sql);
  }
}

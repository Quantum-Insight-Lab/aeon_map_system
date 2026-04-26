import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { DIALOG_NEXT_QUESTION_PROMPT_VERSION } from '../dialog/constants.js';

const PROMPT_FILE = 'dialog-next-question.md';

export type LoadedDialogPrompt = {
  body: string;
  promptVersion: string;
};

/** Читает markdown-промпт, выкидывает YAML frontmatter, подставляет {{TRANSCRIPT}}. */
export async function loadDialogNextQuestionPrompt(transcript: string): Promise<LoadedDialogPrompt> {
  const filePath = path.join(process.cwd(), 'prompts', PROMPT_FILE);
  const raw = await readFile(filePath, 'utf8');
  let body = raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/s, '').trim();
  body = body.replace(/\{\{TRANSCRIPT\}\}/g, transcript);
  return { body, promptVersion: DIALOG_NEXT_QUESTION_PROMPT_VERSION };
}

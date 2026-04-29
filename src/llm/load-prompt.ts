import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { COGNITIVE_INTERPRET_PROMPT_VERSION } from '../dialog/protocol-constants.js';
import { DIALOG_NEXT_QUESTION_PROMPT_VERSION } from '../dialog/constants.js';

const PROMPT_FILE = 'dialog-next-question.md';
const COGNITIVE_INTERPRET_FILE = 'cognitive-interpret-answer.md';

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

export type CognitiveInterpretPromptArgs = {
  sessionId: string;
  questionId: string;
  answerText: string;
  mappedAxis: string;
  mappedCoordinate: string;
};

/** cognitive-interpret-answer@v1 — интерпретация одного ответа протокола. */
export async function loadCognitiveInterpretPrompt(args: CognitiveInterpretPromptArgs): Promise<LoadedDialogPrompt> {
  const filePath = path.join(process.cwd(), 'prompts', COGNITIVE_INTERPRET_FILE);
  const raw = await readFile(filePath, 'utf8');
  let body = raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/s, '').trim();
  body += `\n\nsession_id: ${args.sessionId}\n`;
  body += `question_id: ${args.questionId}\n`;
  body += `mapped_axis: ${args.mappedAxis}\n`;
  body += `mapped_coordinate: ${args.mappedCoordinate}\n\n`;
  body += `Ответ пользователя:\n${args.answerText}\n`;
  return { body, promptVersion: COGNITIVE_INTERPRET_PROMPT_VERSION };
}

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { COGNITIVE_INTERPRET_PROMPT_VERSION } from '../dialog/protocol-constants.js';
import { DIALOG_NEXT_QUESTION_PROMPT_VERSION } from '../dialog/constants.js';
import {
  formatProtocolQuestionForInterpretPrompt,
  getProtocolQuestion,
} from '../protocols/cognitive_v1/questions.js';

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
  /** Уже зафиксированные координаты до текущего шага (formatPriorCoordinatesSummaryForInterpret). */
  priorCoordinatesSummary: string;
};

/** cognitive-interpret-answer@v5 — интерпретация одного ответа протокола (контекст вопроса + методика). */
export async function loadCognitiveInterpretPrompt(args: CognitiveInterpretPromptArgs): Promise<LoadedDialogPrompt> {
  const filePath = path.join(process.cwd(), 'prompts', COGNITIVE_INTERPRET_FILE);
  const raw = await readFile(filePath, 'utf8');
  let body = raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/s, '').trim();

  const q = getProtocolQuestion(args.questionId);
  const questionBlock = q
    ? formatProtocolQuestionForInterpretPrompt(q)
    : `(Вопрос «${args.questionId}»: определение не найдено в каталоге протокола.)`;

  body += '\n\n---\n\n';
  body += `session_id: ${args.sessionId}\n`;
  body += `question_id: ${args.questionId}\n\n`;
  body += `${questionBlock}\n\n`;
  body += `Уже зафиксировано ранее в этой сессии:\n${args.priorCoordinatesSummary}\n\n`;
  body += `Результат mapper (эталон — не оспаривай):\n`;
  body += `mapped_axis: ${args.mappedAxis}\n`;
  body += `mapped_coordinate: ${args.mappedCoordinate}\n\n`;
  body += `Ответ пользователя (как в сообщении):\n${args.answerText}\n`;
  return { body, promptVersion: COGNITIVE_INTERPRET_PROMPT_VERSION };
}

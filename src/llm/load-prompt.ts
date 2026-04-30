import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  COGNITIVE_CARD_RENDER_INPUT_MARKER,
  COGNITIVE_CARD_RENDER_PROMPT_VERSION,
  COGNITIVE_INTERPRET_PROMPT_VERSION,
} from '../dialog/protocol-constants.js';
import { DIALOG_NEXT_QUESTION_PROMPT_VERSION } from '../dialog/constants.js';
import {
  formatProtocolQuestionForInterpretPrompt,
  getProtocolQuestion,
} from '../protocols/cognitive_v1/questions.js';
import { protocolBlockClosure } from '../protocols/cognitive_v1/queue.js';
import { dominantAnchorFilterLine } from '../protocols/cognitive_v1/anchor-narrative.js';
import { formatModalityProfileForPrompt } from '../protocols/cognitive_v1/modality-narrative.js';
import { formatTrapBlockForTypes } from '../protocols/cognitive_v1/trap-narrative.js';
import { SHADOW_PRINCIPLE_FOR_PROMPT } from '../protocols/cognitive_v1/shadow-narrative.js';
import {
  COGNITIVE_TYPE_NARRATIVES,
  type CognitiveCatalogTypeName,
} from '../protocols/cognitive_v1/types-narrative.js';
import { ANCHOR_LABEL_BY_LETTER, type AnchorLetter, type ModalityLetter } from '../protocols/cognitive_v1/types.js';

const PROMPT_FILE = 'dialog-next-question.md';
const COGNITIVE_INTERPRET_FILE = 'cognitive-interpret-answer.md';
const COGNITIVE_CARD_RENDER_FILE = 'cognitive-card-render.md';

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

/** cognitive-interpret-answer@v7 — запрет превью следующего вопроса (гейт «Продолжить»). */
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

  const closure = protocolBlockClosure(args.questionId);
  if (closure === 'goal') {
    body +=
      'Режим шага: ПОДВЕДЕНИЕ ИТОГА БЛОКА «Цели» (Ц1–Ц4 завершены). Используй раздел «Итог блока» в инструкции выше.\n\n';
  } else if (closure === 'modality') {
    body +=
      'Режим шага: ПОДВЕДЕНИЕ ИТОГА БЛОКА «Модальность» (М1–М5 завершены). Используй раздел «Итог блока» в инструкции выше.\n\n';
  } else if (closure === 'anchor') {
    body +=
      'Режим шага: ПОДВЕДЕНИЕ ИТОГА БЛОКА «Якорь» (Я1–Я3 завершены; это последний шаг протокола перед сборкой карты). Используй раздел «Итог блока» в инструкции выше.\n\n';
  }

  body += `Ответ пользователя (как в сообщении):\n${args.answerText}\n`;
  return { body, promptVersion: COGNITIVE_INTERPRET_PROMPT_VERSION };
}

export type CognitiveCardRenderPromptArgs = {
  sessionId: string;
  coordinates: Record<string, unknown>;
  matchedTypeNames: readonly string[];
  syntheticDrawing: boolean;
  coreUnformed: boolean;
  confidenceResolution: string;
  confidenceMessage: string;
};

function formatTypesNarrativeBlock(names: readonly string[]): string {
  if (names.length === 0) {
    return 'ОПИСАНИЯ ТИПОВ: тип по таблице не выведен (пустой список совпадений). Опирайся только на координаты и общие принципы методики; раздел «Когнитивный рисунок» опиши как гипотезу без имён каталога.';
  }
  const lines: string[] = ['ОПИСАНИЯ ТИПОВ (каталог §2 методички — перефразируй в карте):'];
  for (const name of names) {
    const n = COGNITIVE_TYPE_NARRATIVES[name as CognitiveCatalogTypeName];
    if (!n) {
      lines.push(`### ${name}`, '(нет выжимки в коде — опиши умеренно по координатам)', '');
      continue;
    }
    lines.push(
      `### ${name}`,
      `Сила: ${n.strength}`,
      `Риск без контроля: ${n.risk}`,
      `Тень (типа): ${n.shadow}`,
      `Маркер: ${n.marker}`,
      '',
    );
  }
  return lines.join('\n').trim();
}

function formatAnchorLettersBlock(letters: readonly string[]): string {
  const lines: string[] = ['Ответы блока Якорь (Я1–Я3):'];
  letters.forEach((L, i) => {
    const letter = L as AnchorLetter;
    const label = ANCHOR_LABEL_BY_LETTER[letter] ?? L;
    lines.push(`Я${i + 1}: ${label} (ключ ${letter})`);
  });
  return lines.join('\n');
}

/** cognitive-card-render@v1 — полная карта §6 методички после card.computed. */
export async function loadCognitiveCardRenderPrompt(
  args: CognitiveCardRenderPromptArgs,
): Promise<LoadedDialogPrompt> {
  const filePath = path.join(process.cwd(), 'prompts', COGNITIVE_CARD_RENDER_FILE);
  const raw = await readFile(filePath, 'utf8');
  let template = raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/s, '').trim();

  const modalityRaw = args.coordinates.modality_profile;
  const modalityProfile = Array.isArray(modalityRaw)
    ? (modalityRaw as unknown[]).map((x) => String(x)) as ModalityLetter[]
    : [];
  const anchorRaw = args.coordinates.anchor_letters;
  const anchorLetters = Array.isArray(anchorRaw) ? (anchorRaw as unknown[]).map((x) => String(x)) : [];

  const dominantRaw = args.coordinates.dominant_anchor_letter;
  const dominantLetter =
    dominantRaw != null && dominantRaw !== ''
      ? (String(dominantRaw) as AnchorLetter)
      : null;

  const coordsBlock = [
    `session_id: ${args.sessionId}`,
    '',
    'Координаты (JSON):',
    JSON.stringify(args.coordinates, null, 2),
  ].join('\n');

  const modalityBlock = formatModalityProfileForPrompt(modalityProfile);
  const anchorBlock = [
    formatAnchorLettersBlock(anchorLetters),
    '',
    dominantAnchorFilterLine(dominantLetter),
  ].join('\n');

  const confidenceBlock = [
    'УВЕРЕННОСТЬ И РЕЗОЛЮЦИЯ (качественно; числа не показывать пользователю):',
    `confidence_resolution: ${args.confidenceResolution}`,
    `confidence_message: ${args.confidenceMessage}`,
    `synthetic_drawing: ${args.syntheticDrawing}`,
    `core_unformed: ${args.coreUnformed}`,
  ].join('\n');

  const replacements: Record<string, string> = {
    COORDINATES_BLOCK: coordsBlock,
    TYPES_NARRATIVE_BLOCK: formatTypesNarrativeBlock(args.matchedTypeNames),
    MODALITY_NARRATIVE_BLOCK: modalityBlock,
    ANCHOR_NARRATIVE_BLOCK: anchorBlock,
    TRAP_BLOCK: formatTrapBlockForTypes(args.matchedTypeNames),
    SHADOW_PRINCIPLE_BLOCK: SHADOW_PRINCIPLE_FOR_PROMPT,
    CONFIDENCE_BLOCK: confidenceBlock,
  };

  for (const [key, val] of Object.entries(replacements)) {
    template = template.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), val);
  }

  const body = `${template.trim()}${COGNITIVE_CARD_RENDER_INPUT_MARKER}`;
  return { body, promptVersion: COGNITIVE_CARD_RENDER_PROMPT_VERSION };
}

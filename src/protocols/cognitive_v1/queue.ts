/** Детерминированный порядок 12 вопросов протокола v1. */
export const PROTOCOL_QUESTION_IDS = [
  'core:protocol:goal:1',
  'core:protocol:goal:2',
  'core:protocol:goal:3',
  'core:protocol:goal:4',
  'core:protocol:modality:1',
  'core:protocol:modality:2',
  'core:protocol:modality:3',
  'core:protocol:modality:4',
  'core:protocol:modality:5',
  'core:protocol:anchor:1',
  'core:protocol:anchor:2',
  'core:protocol:anchor:3',
] as const;

export type ProtocolQuestionId = (typeof PROTOCOL_QUESTION_IDS)[number];

export const PROTOCOL_FIRST_QUESTION_ID: ProtocolQuestionId = 'core:protocol:goal:1';

export const PROTOCOL_LAST_QUESTION_ID: ProtocolQuestionId = 'core:protocol:anchor:3';

export function protocolQuestionIndex(questionId: string): number {
  const i = PROTOCOL_QUESTION_IDS.indexOf(questionId as ProtocolQuestionId);
  return i;
}

export function isProtocolQuestionId(questionId: string): questionId is ProtocolQuestionId {
  return PROTOCOL_QUESTION_IDS.includes(questionId as ProtocolQuestionId);
}

/** Последний вопрос блока Ц / М / Я — после ответа нужен развёрнутый итог блока в интерпретации LLM. */
export type ProtocolBlockKind = 'goal' | 'modality' | 'anchor';

/** `null`, если это не завершение блока (не goal:4 / modality:5 / anchor:3). */
export function protocolBlockClosure(questionId: string): ProtocolBlockKind | null {
  const i = protocolQuestionIndex(questionId);
  if (i === 3) return 'goal';
  if (i === 8) return 'modality';
  if (i === 11) return 'anchor';
  return null;
}

/** Следующий вопрос после текущего или `null`, если протокол завершён после ответа на последний. */
export function nextQuestionAfter(currentId: string): ProtocolQuestionId | null {
  const i = protocolQuestionIndex(currentId);
  if (i < 0 || i >= PROTOCOL_QUESTION_IDS.length - 1) {
    return null;
  }
  return PROTOCOL_QUESTION_IDS[i + 1];
}

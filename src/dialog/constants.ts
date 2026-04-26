/** Статичный первый вопрос Core Layer (iter-2). */
export const CORE_FIRST_QUESTION_ID = 'core:first';

export const DIALOG_LAYER_CORE = 'core';

/** Число адаптивных вопросов после ответа на core:first (vibepp iter-3). */
export const LLM_FOLLOWUP_COUNT = 5;

/** Версия промпта (совпадает с шапкой prompts/dialog-next-question.md). */
export const DIALOG_NEXT_QUESTION_PROMPT_VERSION = 'dialog-next-question@v1';

export function coreLlmQuestionId(turn: number): string {
  return `core:llm:${turn}`;
}

export const CORE_LLM_QUESTION_RE = /^core:llm:(\d+)$/;

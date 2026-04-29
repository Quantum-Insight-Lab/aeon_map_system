/** Оси протокола Cognitive Identity Map v1. */
export type CognitiveAxis = 'goal' | 'modality' | 'anchor';

/** Цели блока Ц (пункты 1–8). */
export const GOAL_LABELS = [
  'Истина',
  'Понимание',
  'Ясность',
  'Решение',
  'Смысл',
  'Возможность',
  'Согласованность',
  'Точность',
] as const;

export type GoalLabel = (typeof GOAL_LABELS)[number];

/** Модальность: А / Б / среднее М. */
export type ModalityLetter = 'А' | 'Б' | 'М';

/** Якорь: буквы Я1–Я3 (кириллица А–З). */
export type AnchorLetter = 'А' | 'Б' | 'В' | 'Г' | 'Д' | 'Е' | 'Ж' | 'З';

/** Порядок строк якоря в протоколе (ключ варианта = буква; coordinate — та же буква). */
export const ANCHOR_LETTERS_ORDER: readonly AnchorLetter[] = ['А', 'Б', 'В', 'Г', 'Д', 'Е', 'Ж', 'З'];

export const ANCHOR_LABEL_BY_LETTER: Record<AnchorLetter, string> = {
  А: 'Эмпирический',
  Б: 'Логический',
  В: 'Интуитивный',
  Г: 'Авторитетный',
  Д: 'Опытный',
  Е: 'Соматический',
  Ж: 'Диалогический',
  З: 'Этический',
};

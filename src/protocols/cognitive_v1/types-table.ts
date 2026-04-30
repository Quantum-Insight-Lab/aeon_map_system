import type { GoalLabel, ModalityLetter } from './types.js';

/** Строка таблицы §4.1: когнитивный тип и координаты. */
export type CognitiveTypeRow = {
  name: string;
  /** Одна ядерная цель или две (комбинированные типы). */
  goals: readonly GoalLabel[];
  modalityProfile: readonly ModalityLetter[];
  anchorPrimary: string;
  anchorSecondary: string;
};

function m(s: string): ModalityLetter[] {
  return s.split('·').map((x) => x.trim()) as ModalityLetter[];
}

/** 24 типа из §4.1 Cognitive Identity Map v1. */
export const COGNITIVE_TYPES: readonly CognitiveTypeRow[] = [
  { name: 'Empiricist', goals: ['Истина'], modalityProfile: m('А·А·А·М·А'), anchorPrimary: 'эмпирический', anchorSecondary: 'логический' },
  { name: 'Skeptic', goals: ['Истина'], modalityProfile: m('А·А·М·Б·А'), anchorPrimary: 'логический', anchorSecondary: 'эмпирический' },
  {
    name: 'Phenomenologist',
    goals: ['Истина'],
    modalityProfile: m('Б·Б·А·Б·Б'),
    anchorPrimary: 'соматический',
    anchorSecondary: 'интуитивный',
  },
  {
    name: 'Theorist',
    goals: ['Понимание'],
    modalityProfile: m('А·А·Б·Б·А'),
    anchorPrimary: 'логический',
    anchorSecondary: 'авторитетный',
  },
  {
    name: 'Decoder',
    goals: ['Понимание'],
    modalityProfile: m('А·Б·М·М·А'),
    anchorPrimary: 'логический',
    anchorSecondary: 'эмпирический',
  },
  {
    name: 'Reflector',
    goals: ['Понимание'],
    modalityProfile: m('М·Б·Б·Б·Б'),
    anchorPrimary: 'интуитивный',
    anchorSecondary: 'диалогический',
  },
  {
    name: 'Analyst',
    goals: ['Ясность'],
    modalityProfile: m('А·А·М·М·А'),
    anchorPrimary: 'логический',
    anchorSecondary: 'эмпирический',
  },
  {
    name: 'Cartographer',
    goals: ['Ясность'],
    modalityProfile: m('М·Б·М·Б·М'),
    anchorPrimary: 'логический',
    anchorSecondary: 'диалогический',
  },
  {
    name: 'Pragmatist',
    goals: ['Решение'],
    modalityProfile: m('А·А·А·А·А'),
    anchorPrimary: 'опытный',
    anchorSecondary: 'эмпирический',
  },
  {
    name: 'Tactician',
    goals: ['Решение'],
    modalityProfile: m('А·А·А·А·М'),
    anchorPrimary: 'интуитивный',
    anchorSecondary: 'опытный',
  },
  {
    name: 'Optimizer',
    goals: ['Решение'],
    modalityProfile: m('А·А·М·Б·А'),
    anchorPrimary: 'логический',
    anchorSecondary: 'эмпирический',
  },
  {
    name: 'Hermeneutic',
    goals: ['Смысл'],
    modalityProfile: m('Б·Б·М·Б·Б'),
    anchorPrimary: 'диалогический',
    anchorSecondary: 'авторитетный',
  },
  {
    name: 'Narrator',
    goals: ['Смысл'],
    modalityProfile: m('М·А·А·М·М'),
    anchorPrimary: 'опытный',
    anchorSecondary: 'диалогический',
  },
  {
    name: 'Symbolist',
    goals: ['Смысл'],
    modalityProfile: m('Б·Б·М·М·Б'),
    anchorPrimary: 'интуитивный',
    anchorSecondary: 'этический',
  },
  {
    name: 'Strategist',
    goals: ['Возможность'],
    modalityProfile: m('А·Б·Б·Б·А'),
    anchorPrimary: 'логический',
    anchorSecondary: 'опытный',
  },
  {
    name: 'Experimenter',
    goals: ['Возможность'],
    modalityProfile: m('А·Б·А·А·Б'),
    anchorPrimary: 'эмпирический',
    anchorSecondary: 'опытный',
  },
  {
    name: 'Generator',
    goals: ['Возможность'],
    modalityProfile: m('Б·Б·М·А·Б'),
    anchorPrimary: 'интуитивный',
    anchorSecondary: 'диалогический',
  },
  {
    name: 'Synthesist',
    goals: ['Согласованность'],
    modalityProfile: m('Б·Б·М·М·М'),
    anchorPrimary: 'диалогический',
    anchorSecondary: 'интуитивный',
  },
  {
    name: 'Systematist',
    goals: ['Согласованность'],
    modalityProfile: m('А·М·Б·Б·А'),
    anchorPrimary: 'логический',
    anchorSecondary: 'авторитетный',
  },
  {
    name: 'Algorithmist',
    goals: ['Точность'],
    modalityProfile: m('А·А·М·М·А'),
    anchorPrimary: 'логический',
    anchorSecondary: 'эмпирический',
  },
  {
    name: 'Polymath',
    goals: ['Понимание', 'Согласованность'],
    modalityProfile: m('Б·Б·М·Б·Б'),
    anchorPrimary: 'диалогический',
    anchorSecondary: 'логический',
  },
  {
    name: 'Seer',
    goals: ['Истина', 'Возможность'],
    modalityProfile: m('Б·Б·М·А·Б'),
    anchorPrimary: 'интуитивный',
    anchorSecondary: 'соматический',
  },
  {
    name: 'Essayist',
    goals: ['Смысл', 'Ясность'],
    modalityProfile: m('М·Б·М·Б·М'),
    anchorPrimary: 'диалогический',
    anchorSecondary: 'этический',
  },
  {
    name: 'Architect',
    goals: ['Возможность', 'Точность'],
    modalityProfile: m('А·А·Б·Б·А'),
    anchorPrimary: 'логический',
    anchorSecondary: 'эмпирический',
  },
];

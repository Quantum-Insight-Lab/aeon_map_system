import type { CognitiveCatalogTypeName } from './types-narrative.js';

/** §5.4 — типичная когнитивная ловушка под давлением для ключевых типов. */
export const COGNITIVE_TRAP_BY_TYPE: Partial<Record<CognitiveCatalogTypeName, string>> = {
  Empiricist: 'Паралич в ожидании «полных данных».',
  Skeptic: 'Паралич в ожидании «полных данных».',
  Theorist: 'Отказ принимать опровергающие случаи как валидные.',
  Systematist: 'Отказ принимать опровергающие случаи как валидные.',
  Reflector: 'Бесконечная рефлексия без выхода.',
  Hermeneutic: 'Бесконечная рефлексия без выхода.',
  Pragmatist: 'Действие ради действия в обход смысла.',
  Tactician: 'Действие ради действия в обход смысла.',
  Generator: 'Гиперпроизводство без доводки.',
  Experimenter: 'Гиперпроизводство без доводки.',
  Synthesist: 'Растворение собственной позиции в попытке всё совместить.',
  Polymath: 'Растворение собственной позиции в попытке всё совместить.',
};

export function formatTrapBlockForTypes(names: readonly string[]): string {
  const lines: string[] = [];
  const seen = new Set<string>();
  for (const n of names) {
    const t = COGNITIVE_TRAP_BY_TYPE[n as CognitiveCatalogTypeName];
    if (t && !seen.has(t)) {
      seen.add(t);
      lines.push(`• ${n}: ${t}`);
    }
  }
  if (lines.length === 0) {
    return 'Для перечисленных типов отдельная формулировка ловушки §5.4 не задана — опиши раздел «Когнитивная ловушка» мягко, без ярлыка из таблицы, опираясь на координаты и модальность.';
  }
  return lines.join('\n');
}

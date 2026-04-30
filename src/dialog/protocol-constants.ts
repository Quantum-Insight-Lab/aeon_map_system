/** Протокол Cognitive Identity Map (iter-4). */
export const COGNITIVE_PROTOCOL_VERSION = 'v1';

/** Версия промпта cognitive-interpret-answer.md */
export const COGNITIVE_INTERPRET_PROMPT_VERSION = 'cognitive-interpret-answer@v6';

/** Версия промпта cognitive-card-render.md (итоговая карта §6 методички). */
export const COGNITIVE_CARD_RENDER_PROMPT_VERSION = 'cognitive-card-render@v1';

/** Версия payload события card.rendered. */
export const COGNITIVE_CARD_RENDERED_VERSION = 'card.rendered@v1';

/** Маркер в конце user-контента LLM для отличия вызова от интерпретации шага (тесты/диагностика). */
export const COGNITIVE_CARD_RENDER_INPUT_MARKER = '\n=== cognitive_card_render_input_v1 ===\n';

/** Минимальный confidence, чтобы показать имя типа на карте (ниже — только пояснение). */
export const CARD_CONFIDENCE_THRESHOLD = 0.5;

/** Совпадение без оговорок в тексте пользователю. */
export const CARD_CONFIDENCE_STRONG_THRESHOLD = 0.75;

export const COGNITIVE_CARD_TYPE = 'CognitiveIdentityMap';

export const COGNITIVE_CARD_COMPUTED_VERSION = '1';

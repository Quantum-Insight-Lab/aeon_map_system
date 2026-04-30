/** Протокол Cognitive Identity Map (iter-4). */
export const COGNITIVE_PROTOCOL_VERSION = 'v1';

/** Версия промпта cognitive-interpret-answer.md */
export const COGNITIVE_INTERPRET_PROMPT_VERSION = 'cognitive-interpret-answer@v4';

/** Минимальный confidence, чтобы показать имя типа на карте (ниже — только пояснение). */
export const CARD_CONFIDENCE_THRESHOLD = 0.5;

/** Совпадение без оговорок в тексте пользователю. */
export const CARD_CONFIDENCE_STRONG_THRESHOLD = 0.75;

/** Расхождение с LLM — если agreement ниже порога. */
export const LLM_RULE_AGREEMENT_THRESHOLD = 0.7;

export const COGNITIVE_CARD_TYPE = 'CognitiveIdentityMap';

export const COGNITIVE_CARD_COMPUTED_VERSION = '1';

export type Config = {
  port: number;
  databaseUrl: string;
  maxBotToken: string;
  maxWebhookSecret: string;
  maxApiBaseUrl: string;
  logLevel: string;
  /**
   * Статичный первый вопрос Core (iter-2).
   * @deprecated iter-4+: активный первый вопрос — протокол goal:1; поле оставлено для совместимости env.
   */
  firstCoreQuestionText: string;
  /** Короткое подтверждение после answer.given на первом шаге протокола (goal:1). */
  dialogAnswerAckText: string;
  /** Текст до показа протокольного вопроса: только markdown и кнопка «Продолжить». */
  dialogProtocolContinueGateMarkdown: string;
  /** Если пользователь пишет текст до нажатия «Продолжить». */
  dialogAwaitContinueHintText: string;
  /** iter-3 LLM-цепочка после legacy core:first (не используется при протоколе v1). Default false. */
  dialogLlmNextQuestion: boolean;
  cognitiveProtocolVersion: string;
  /** Минимальная уверенность, чтобы показать имя типа на карте (< порога — только пояснение). */
  cardConfidenceThreshold: number;
  /** Уверенное совпадение без оговорок в тексте пользователю. */
  cardConfidenceStrongThreshold: number;
  /** Порог доли совпадений mapper vs LLM для флага disagreement_with_llm. */
  llmRuleAgreementThreshold: number;
  anthropicApiKey: string;
  anthropicModel: string;
  openaiApiKey: string;
  openaiTextModel: string;
  /** Таймаут HTTP вызова LLM (мс). */
  llmTimeoutMs: number;
  /** Сколько LLM-вопросов после core:first (по умолчанию как в vibepp). */
  llmFollowupCount: number;
};

export function loadConfig(): Config {
  return {
    port: Number(process.env.PORT ?? 3000),
    databaseUrl: process.env.DATABASE_URL ?? '',
    maxBotToken: process.env.MAX_BOT_TOKEN ?? '',
    maxWebhookSecret: process.env.MAX_WEBHOOK_SECRET ?? '',
    maxApiBaseUrl: process.env.MAX_API_BASE_URL ?? 'https://platform-api.max.ru',
    logLevel: process.env.LOG_LEVEL ?? 'info',
    firstCoreQuestionText:
      process.env.FIRST_CORE_QUESTION_TEXT ??
      'Привет! С чего хочешь начать разговор о себе — про работу и цели, про отношения или про ощущение смысла?',
    dialogAnswerAckText: process.env.DIALOG_ANSWER_ACK_TEXT ?? 'Спасибо, ответ записан!',
    dialogProtocolContinueGateMarkdown:
      process.env.DIALOG_PROTOCOL_CONTINUE_GATE_MARKDOWN ??
      'Нажми **«Продолжить»**, чтобы открыть следующий вопрос.',
    dialogAwaitContinueHintText:
      process.env.DIALOG_AWAIT_CONTINUE_HINT_TEXT ??
      'Сначала нажми **«Продолжить»** под сообщением бота — так откроется вопрос.',
    anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? '',
    anthropicModel: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-20250514',
    openaiApiKey: process.env.OPENAI_API_KEY ?? '',
    openaiTextModel: process.env.OPENAI_TEXT_MODEL ?? 'gpt-4o-mini',
    llmTimeoutMs: Number(process.env.LLM_TIMEOUT_MS ?? 45_000),
    llmFollowupCount: Number(process.env.LLM_FOLLOWUP_COUNT ?? 5),
    dialogLlmNextQuestion: process.env.DIALOG_LLM_NEXT_QUESTION === 'true',
    cognitiveProtocolVersion: process.env.COGNITIVE_PROTOCOL_VERSION ?? 'v1',
    cardConfidenceThreshold: Number(process.env.CARD_CONFIDENCE_THRESHOLD ?? '0.5'),
    cardConfidenceStrongThreshold: Number(process.env.CARD_CONFIDENCE_STRONG_THRESHOLD ?? '0.75'),
    llmRuleAgreementThreshold: Number(process.env.LLM_RULE_AGREEMENT_THRESHOLD ?? '0.7'),
  };
}

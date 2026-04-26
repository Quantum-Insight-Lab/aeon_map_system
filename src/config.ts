export type Config = {
  port: number;
  databaseUrl: string;
  maxBotToken: string;
  maxWebhookSecret: string;
  maxApiBaseUrl: string;
  logLevel: string;
  /** Статичный первый вопрос Core (iter-2). */
  firstCoreQuestionText: string;
  /** Короткое подтверждение после answer.given на core:first. */
  dialogAnswerAckText: string;
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
    anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? '',
    anthropicModel: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-20250514',
    openaiApiKey: process.env.OPENAI_API_KEY ?? '',
    openaiTextModel: process.env.OPENAI_TEXT_MODEL ?? 'gpt-4o-mini',
    llmTimeoutMs: Number(process.env.LLM_TIMEOUT_MS ?? 45_000),
    llmFollowupCount: Number(process.env.LLM_FOLLOWUP_COUNT ?? 5),
  };
}

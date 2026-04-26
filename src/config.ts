export type Config = {
  port: number;
  databaseUrl: string;
  maxBotToken: string;
  maxWebhookSecret: string;
  maxApiBaseUrl: string;
  logLevel: string;
};

export function loadConfig(): Config {
  return {
    port: Number(process.env.PORT ?? 3000),
    databaseUrl: process.env.DATABASE_URL ?? '',
    maxBotToken: process.env.MAX_BOT_TOKEN ?? '',
    maxWebhookSecret: process.env.MAX_WEBHOOK_SECRET ?? '',
    maxApiBaseUrl: process.env.MAX_API_BASE_URL ?? 'https://platform-api.max.ru',
    logLevel: process.env.LOG_LEVEL ?? 'info',
  };
}

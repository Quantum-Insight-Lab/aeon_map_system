/** Общий контекстный логгер (Fastify `req.log` / `app.log`): при LOG_LEVEL=debug появляется `debug`. */
export type DomainLogger = {
  debug?: (obj: unknown, msg?: string) => void;
  info: (obj: unknown, msg?: string) => void;
  warn: (obj: unknown, msg?: string) => void;
};

/** Безопасный debug: не падает, если передан минимальный логгер без `debug`. */
export function dbg(log: DomainLogger, msg: string, obj?: Record<string, unknown>): void {
  log.debug?.(obj ?? {}, msg);
}

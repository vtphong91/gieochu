import pino, { type Logger } from "pino";

/**
 * Fields redacted from every log line, per docs/GIEOCHU_PROMPT_MVP_PHASE1.md §6:
 * "Không log mật khẩu, token, secret, số tài khoản đầy đủ".
 */
const REDACT_PATHS = [
  "password",
  "*.password",
  "*.*.password",
  "token",
  "*.token",
  "*.*.token",
  "secret",
  "*.secret",
  "*.*.secret",
  "authorization",
  "*.authorization",
  "req.headers.authorization",
  "cookie",
  "*.cookie",
  "req.headers.cookie",
];

export interface CreateLoggerOptions {
  name?: string;
  level?: string;
}

/**
 * Creates a pino logger with sensitive-field redaction baked in.
 * `destination` is only used by tests to capture output synchronously.
 */
export function createLogger(options: CreateLoggerOptions = {}, destination?: NodeJS.WritableStream): Logger {
  const pinoOptions = {
    name: options.name ?? "gieochu",
    level: options.level ?? process.env.LOG_LEVEL ?? "info",
    redact: { paths: REDACT_PATHS, censor: "[REDACTED]" },
  };
  return destination ? pino(pinoOptions, destination) : pino(pinoOptions);
}

export const logger = createLogger();

/** Returns a child logger tagged with the current request's id. */
export function loggerWithRequestId(requestId: string): Logger {
  return logger.child({ requestId });
}

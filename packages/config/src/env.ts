import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.string().url(),
  APP_NAME: z.string().min(1),
  APP_SHORT_NAME: z.string().min(1),
  APP_SLOGAN: z.string().min(1),
  TZ_DISPLAY: z.string().min(1).default("Asia/Ho_Chi_Minh"),

  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().min(1),
  /** Owner-role connection, DDL rights — Prisma CLI only. See ADR-010. */
  PRISMA_MIGRATE_URL: z.string().min(1),
  TEST_DATABASE_URL: z.string().optional(),

  JWT_ACCESS_SECRET: z.string().min(32, "JWT_ACCESS_SECRET phải có ít nhất 32 ký tự"),
  JWT_ISSUER: z.string().min(1),
  JWT_AUDIENCE: z.string().min(1),
  ACCESS_TOKEN_TTL: z.string().min(1).default("15m"),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),
  EMAIL_VERIFY_TTL_HOURS: z.coerce.number().int().positive().default(24),
  PASSWORD_RESET_TTL_MINUTES: z.coerce.number().int().positive().default(30),

  PAYMENT_ENCRYPTION_KEY: z.string().min(1),
  /** §"M5"/ADR-017: separate key from PAYMENT_ENCRYPTION_KEY for SystemStorageConfig secrets — object
   * storage credentials reach every tenant's files, so they never share a key with payment secrets. */
  STORAGE_ENCRYPTION_KEY: z.string().min(1),

  PRESIGN_UPLOAD_TTL_SECONDS: z.coerce.number().int().positive().default(600),
  PRESIGN_DOWNLOAD_TTL_SECONDS: z.coerce.number().int().positive().max(600).default(600),
  CLAMAV_HOST: z.string().optional(),

  EMAIL_PROVIDER: z.enum(["smtp", "resend"]).default("smtp"),
  EMAIL_FROM: z.string().min(1),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().optional(),
  RESEND_API_KEY: z.string().optional(),

  TRIAL_DAYS: z.coerce.number().int().positive().default(14),
  GRACE_DAYS: z.coerce.number().int().positive().default(7),
  ORDER_PENDING_TTL_MINUTES: z.coerce.number().int().positive().default(60),
  INVOICE_PENDING_TTL_HOURS: z.coerce.number().int().positive().default(24),
  DEFAULT_DOWNLOAD_LIMIT: z.coerce.number().int().nonnegative().default(5),

  MOMO_SANDBOX_ENDPOINT: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;
type ZodIssue = z.ZodError<Env>["issues"][number];

export class EnvValidationError extends Error {
  readonly issues: ZodIssue[];

  constructor(issues: ZodIssue[]) {
    const details = issues
      .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");
    super(`Invalid environment configuration:\n${details}`);
    this.name = "EnvValidationError";
    this.issues = issues;
  }
}

/**
 * Parses and validates a raw environment record. Fails fast (throws) when a
 * required variable is missing or malformed, per docs/GIEOCHU_PROMPT_MVP_PHASE1.md M0.
 */
export function parseEnv(raw: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    throw new EnvValidationError(result.error.issues);
  }
  return result.data;
}

let cached: Env | undefined;

/** Lazily parses `process.env` once and caches the result for the process lifetime. */
export function getEnv(): Env {
  if (!cached) {
    cached = parseEnv(process.env);
  }
  return cached;
}

/** Test-only: clears the cached env so the next `getEnv()` re-parses. */
export function resetEnvCache(): void {
  cached = undefined;
}

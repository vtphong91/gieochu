import { z } from "zod";

/**
 * ADR-032: env runtime chỉ còn hạ tầng + secret. Bắt buộc: APP_URL, DATABASE_URL, DIRECT_URL,
 * JWT_ACCESS_SECRET, JWT_ISSUER, JWT_AUDIENCE, PAYMENT_ENCRYPTION_KEY, STORAGE_ENCRYPTION_KEY
 * (+ NODE_ENV do nền tảng đặt). Thương hiệu (SystemBranding) và cấu hình nghiệp vụ/TTL
 * (SystemSettings) quản lý ở System Center, lưu DB — không đặt qua env. Múi giờ hiển thị là hằng
 * `DISPLAY_TIME_ZONE` trong @gieochu/core.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.string().url(),

  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().min(1),
  // PRISMA_MIGRATE_URL (owner role, DDL rights, ADR-010) deliberately NOT in the runtime schema:
  // only the Prisma CLI (packages/db/prisma.config.ts) and setup-app-role.mts read it straight from
  // process.env on dev/CI machines. It must never be set on Vercel/runtime.
  /** Dev/CI only. */
  TEST_DATABASE_URL: z.string().optional(),

  JWT_ACCESS_SECRET: z.string().min(32, "JWT_ACCESS_SECRET phải có ít nhất 32 ký tự"),
  JWT_ISSUER: z.string().min(1),
  JWT_AUDIENCE: z.string().min(1),

  PAYMENT_ENCRYPTION_KEY: z.string().min(1),
  /** §"M5"/ADR-017: separate key from PAYMENT_ENCRYPTION_KEY for SystemStorageConfig secrets — object
   * storage credentials reach every tenant's files, so they never share a key with payment secrets. */
  STORAGE_ENCRYPTION_KEY: z.string().min(1),

  /**
   * ADR-036: secret của route cron `/api/cron/daily` (Vercel Cron gửi `Authorization: Bearer <CRON_SECRET>`).
   * Tuỳ chọn — thiếu thì route trả 503, app vẫn khởi động. Chuỗi rỗng coi như chưa đặt.
   */
  CRON_SECRET: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().min(32, "CRON_SECRET phải có ít nhất 32 ký tự").optional(),
  ),

  /** Tuỳ chọn — không đặt thì bỏ qua quét virus (apps/web/lib/file-scan.ts). */
  CLAMAV_HOST: z.string().optional(),

  // Email: production cấu hình ở System Center (/admin/settings/smtp, bảng SystemSmtpConfig) — nhóm
  // biến dưới đây CHỈ là fallback cho dev (Mailpit), đều tuỳ chọn. Thiếu cả hai nguồn thì việc gửi
  // trả về lỗi EMAIL_NOT_CONFIGURED (apps/web/lib/email-dispatch.ts), app vẫn khởi động bình thường.
  EMAIL_PROVIDER: z.enum(["smtp", "resend"]).default("smtp"),
  // Chuỗi rỗng (vd `EMAIL_FROM=` copy từ .env.example) coi như chưa đặt, không làm app dừng.
  EMAIL_FROM: z.preprocess((value) => (value === "" ? undefined : value), z.string().min(1).optional()),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().optional(),
  RESEND_API_KEY: z.string().optional(),

  /** Dev only. */
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

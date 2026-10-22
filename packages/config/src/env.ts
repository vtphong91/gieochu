import { z } from "zod";

/**
 * ADR-032: env runtime chỉ còn hạ tầng + secret. Bắt buộc: APP_URL, DATABASE_URL, DIRECT_URL,
 * JWT_ACCESS_SECRET, JWT_ISSUER, JWT_AUDIENCE, PAYMENT_ENCRYPTION_KEY, STORAGE_ENCRYPTION_KEY
 * (+ NODE_ENV do nền tảng đặt). Thương hiệu (SystemBranding) và cấu hình nghiệp vụ/TTL
 * (SystemSettings) quản lý ở System Center, lưu DB — không đặt qua env. Múi giờ hiển thị là hằng
 * `DISPLAY_TIME_ZONE` trong @gieochu/core.
 * Tuỳ chọn hạ tầng: CRON_SECRET (ADR-036), STORAGE_GATEWAY_PROVIDERS (ADR-045 — topo nginx của từng
 * process nên đặt bằng env, không qua DB dùng chung).
 */
const STORAGE_GATEWAY_PROVIDER_VALUES = ["MINIO", "CLOUDFLARE_R2"] as const;

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

  /**
   * ADR-045: provider lưu trữ giao file qua Storage Gateway (`/_s/<vé>` + nginx `auth_request`) thay vì
   * presigned URL trực tiếp. Danh sách phân tách dấu phẩy, giá trị thuộc MINIO | CLOUDFLARE_R2. Chuỗi
   * rỗng/không đặt = [] (mặc định, máy dev/Vercel — presigned trực tiếp như cũ). Giá trị lạ → fail-fast.
   */
  STORAGE_GATEWAY_PROVIDERS: z.preprocess(
    (value) => {
      if (value === undefined || value === null) return [];
      if (typeof value !== "string") return value;
      const items = value
        .split(",")
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
      return [...new Set(items)];
    },
    z.array(
      z.enum(STORAGE_GATEWAY_PROVIDER_VALUES, {
        message: `STORAGE_GATEWAY_PROVIDERS chỉ nhận ${STORAGE_GATEWAY_PROVIDER_VALUES.join(", ")} (phân tách bằng dấu phẩy)`,
      }),
    ),
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
 * Tự động tạo APP_URL, DATABASE_URL, DIRECT_URL từ các biến thành phần
 * (APP_HOST, APP_PORT, APP_PROTOCOL, DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD, DB_SSLMODE)
 * khi người dùng tách nhỏ cấu hình trong .env.
 */
export function resolveRawEnv(raw: Record<string, string | undefined>): Record<string, string | undefined> {
  const resolved = { ...raw };

  // Hỗ trợ DE_ENV hoặc NODE_ENV
  if (!resolved.NODE_ENV && resolved.DE_ENV) {
    resolved.NODE_ENV = resolved.DE_ENV;
  }

  // Tự động ghép APP_URL từ APP_HOST, APP_PORT, APP_PROTOCOL nếu chưa có APP_URL
  if (!resolved.APP_URL && (resolved.APP_HOST || resolved.APP_PORT)) {
    const protocol = resolved.APP_PROTOCOL || "http";
    const host = resolved.APP_HOST || "localhost";
    const port = resolved.APP_PORT ? `:${resolved.APP_PORT}` : "";
    resolved.APP_URL = `${protocol}://${host}${port}`;
  }

  // Tự động gán PORT cho Next.js dev server nếu có APP_PORT
  if (!resolved.PORT && resolved.APP_PORT) {
    resolved.PORT = resolved.APP_PORT;
  }

  // Tự động ghép DATABASE_URL, DIRECT_URL từ DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD, DB_SSLMODE
  if (!resolved.DATABASE_URL && resolved.DB_HOST) {
    const user = encodeURIComponent(resolved.DB_USER || "postgres");
    const password = resolved.DB_PASSWORD ? `:${encodeURIComponent(resolved.DB_PASSWORD)}` : "";
    const host = resolved.DB_HOST;
    const port = resolved.DB_PORT ? `:${resolved.DB_PORT}` : ":5432";
    const dbName = resolved.DB_NAME || "postgres";
    const sslmode = resolved.DB_SSLMODE?.trim();
    const sslQuery = sslmode ? `?sslmode=${sslmode}` : "";
    const connStr = `postgresql://${user}${password}@${host}${port}/${dbName}${sslQuery}`;
    resolved.DATABASE_URL = connStr;
    if (!resolved.DIRECT_URL) {
      resolved.DIRECT_URL = connStr;
    }
  } else if (resolved.DATABASE_URL && !resolved.DIRECT_URL) {
    resolved.DIRECT_URL = resolved.DATABASE_URL;
  }

  // Đồng bộ lại vào process.env để các module khác (Prisma CLI, next dev...) cùng đọc được
  if (typeof process !== "undefined" && process.env) {
    const envObj = process.env as Record<string, string | undefined>;
    if (resolved.NODE_ENV && !envObj.NODE_ENV) envObj.NODE_ENV = resolved.NODE_ENV;
    if (resolved.APP_URL && !envObj.APP_URL) envObj.APP_URL = resolved.APP_URL;
    if (resolved.DATABASE_URL && !envObj.DATABASE_URL) envObj.DATABASE_URL = resolved.DATABASE_URL;
    if (resolved.DIRECT_URL && !envObj.DIRECT_URL) envObj.DIRECT_URL = resolved.DIRECT_URL;
    if (resolved.PORT && !envObj.PORT) envObj.PORT = resolved.PORT;
    if (resolved.DATABASE_URL && !envObj.PRISMA_MIGRATE_URL) envObj.PRISMA_MIGRATE_URL = resolved.DATABASE_URL;
  }

  return resolved;
}

/**
 * Parses and validates a raw environment record. Fails fast (throws) when a
 * required variable is missing or malformed, per docs/GIEOCHU_PROMPT_MVP_PHASE1.md M0.
 */
export function parseEnv(raw: Record<string, string | undefined>): Env {
  const prepared = resolveRawEnv(raw);
  const result = envSchema.safeParse(prepared);
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

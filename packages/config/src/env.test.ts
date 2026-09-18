import { EnvValidationError, parseEnv } from "./env";

function validEnv(overrides: Record<string, string | undefined> = {}) {
  return {
    NODE_ENV: "test",
    APP_URL: "http://localhost:3000",
    APP_NAME: "Gieo Chữ",
    APP_SHORT_NAME: "Gieo",
    APP_SLOGAN: "Gieo Chữ – Nơi người dạy gieo chữ và chia sẻ học liệu.",
    DATABASE_URL: "postgresql://user:pass@localhost:5432/gieochu",
    DIRECT_URL: "postgresql://user:pass@localhost:5432/gieochu",
    PRISMA_MIGRATE_URL: "postgresql://owner:pass@localhost:5432/gieochu",
    JWT_ACCESS_SECRET: "a".repeat(32),
    JWT_ISSUER: "gieochu",
    JWT_AUDIENCE: "gieochu-web",
    PAYMENT_ENCRYPTION_KEY: "b".repeat(32),
    STORAGE_ENCRYPTION_KEY: "c".repeat(32),
    EMAIL_FROM: "Gieo Chữ <no-reply@gieochu.net>",
    ...overrides,
  };
}

describe("M0 env schema", () => {
  it("accepts a fully valid configuration and fills defaults", () => {
    const env = parseEnv(validEnv());
    expect(env.APP_NAME).toBe("Gieo Chữ");
    expect(env.TZ_DISPLAY).toBe("Asia/Ho_Chi_Minh");
    expect(env.TRIAL_DAYS).toBe(14);
    expect(env.GRACE_DAYS).toBe(7);
    expect(env.DEFAULT_DOWNLOAD_LIMIT).toBe(5);
  });

  it("throws EnvValidationError when a required variable is missing", () => {
    const withoutDatabaseUrl = validEnv({ DATABASE_URL: undefined });
    expect(() => parseEnv(withoutDatabaseUrl)).toThrow(EnvValidationError);
  });
});

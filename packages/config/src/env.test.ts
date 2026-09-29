import { EnvValidationError, parseEnv } from "./env";

function validEnv(overrides: Record<string, string | undefined> = {}) {
  return {
    NODE_ENV: "test",
    APP_URL: "http://localhost:3000",
    DATABASE_URL: "postgresql://user:pass@localhost:5432/gieochu",
    DIRECT_URL: "postgresql://user:pass@localhost:5432/gieochu",
    JWT_ACCESS_SECRET: "a".repeat(32),
    JWT_ISSUER: "gieochu",
    JWT_AUDIENCE: "gieochu-web",
    PAYMENT_ENCRYPTION_KEY: "b".repeat(32),
    STORAGE_ENCRYPTION_KEY: "c".repeat(32),
    // ADR-032: only the 8 required runtime variables. No EMAIL_*/brand/TTL on purpose — those live in
    // System Center (DB); email env is only a dev fallback.
    ...overrides,
  };
}

describe("M0 env schema", () => {
  it("accepts a fully valid configuration and fills defaults", () => {
    const env = parseEnv(validEnv());
    expect(env.APP_URL).toBe("http://localhost:3000");
    expect(env.NODE_ENV).toBe("test");
    expect(env.EMAIL_PROVIDER).toBe("smtp");
    expect(env.EMAIL_FROM).toBeUndefined();
    expect(env).not.toHaveProperty("APP_NAME");
    expect(env).not.toHaveProperty("TRIAL_DAYS");
  });

  it("throws EnvValidationError when a required variable is missing", () => {
    const withoutDatabaseUrl = validEnv({ DATABASE_URL: undefined });
    expect(() => parseEnv(withoutDatabaseUrl)).toThrow(EnvValidationError);
  });
});

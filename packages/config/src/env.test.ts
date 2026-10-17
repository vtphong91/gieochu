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

  it("assembles DATABASE_URL, DIRECT_URL, and APP_URL from granular env variables", () => {
    const granular = validEnv({
      DATABASE_URL: undefined,
      DIRECT_URL: undefined,
      APP_URL: undefined,
      DB_HOST: "ep-sample-123456.ap-southeast-1.aws.neon.tech",
      DB_PORT: "5432",
      DB_NAME: "neondb",
      DB_USER: "gieochu_app",
      DB_PASSWORD: "p@ss:word#123",
      DB_SSLMODE: "require",
      APP_HOST: "localhost",
      APP_PORT: "3000",
      APP_PROTOCOL: "http",
    });

    const env = parseEnv(granular);
    expect(env.DATABASE_URL).toBe(
      "postgresql://gieochu_app:p%40ss%3Aword%23123@ep-sample-123456-pooler.ap-southeast-1.aws.neon.tech:5432/neondb?sslmode=require",
    );
    expect(env.DIRECT_URL).toBe(
      "postgresql://gieochu_app:p%40ss%3Aword%23123@ep-sample-123456.ap-southeast-1.aws.neon.tech:5432/neondb?sslmode=require",
    );
    expect(env.APP_URL).toBe("http://localhost:3000");
  });
});


import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    setupFiles: ["./tests/integration/setup.ts"],
    // Integration tests share one real Neon DB (see docs/DECISIONS.md ADR-009)
    // and a pg-boss queue on it — run files serially to avoid cross-file races.
    fileParallelism: false,
    testTimeout: 20000,
    // M0 ships zero integration tests by design (see docs §9); later modules
    // add real ones under tests/integration/. Without this flag, `vitest run`
    // exits non-zero when no test files match yet.
    passWithNoTests: true,
  },
});

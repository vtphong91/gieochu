import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    // M0 ships zero integration tests by design (see docs §9); later modules
    // add real ones under tests/integration/. Without this flag, `vitest run`
    // exits non-zero when no test files match yet.
    passWithNoTests: true,
  },
});

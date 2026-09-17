/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "node",
  // ESM mode: this package imports `jose`, which ships ESM-only (no CJS build).
  extensionsToTreatAsEsm: [".ts"],
  testMatch: ["<rootDir>/src/**/*.test.ts"],
  transform: {
    "^.+\\.ts$": ["ts-jest", { tsconfig: "<rootDir>/tsconfig.json", useESM: true }],
  },
};

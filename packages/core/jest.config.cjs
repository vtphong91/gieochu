/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["<rootDir>/src/**/*.test.ts"],
  transform: {
    "^.+\.ts$": ["ts-jest", { tsconfig: "<rootDir>/tsconfig.json" }],
    // ADR-028: `sanitize-html` (CJS) require `htmlparser2@12` + các gói dom*/entities chỉ phát hành ESM — Jest
    // (chạy CJS) phải transpile riêng các gói này thì test sanitizer mới nạp được.
    "^.+\.js$": ["ts-jest", { tsconfig: { allowJs: true, module: "commonjs", target: "es2022", esModuleInterop: true }, diagnostics: false }],
  },
  transformIgnorePatterns: ["/node_modules/(?!\.pnpm|htmlparser2|domhandler|domutils|dom-serializer|entities|domelementtype)"],
};

import tseslint from "typescript-eslint";

/**
 * Shared ESLint flat-config base for every package/app in the monorepo.
 * See docs/GIEOCHU_PROMPT_MVP_PHASE1.md §4.4 (packages/config hosts eslint + tsconfig).
 */
export const baseConfig = tseslint.config(
  {
    ignores: ["dist/**", ".next/**", "node_modules/**", "coverage/**"],
  },
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
);

/**
 * Rule set for apps/web only: forbids importing the raw Prisma client anywhere
 * outside the packages/db tenant-scoped helpers (docs §5.4 RLS requirement).
 */
export const noRawPrismaImport = {
  rules: {
    "no-restricted-imports": [
      "error",
      {
        paths: [
          {
            name: "@prisma/client",
            message:
              "Do not import @prisma/client directly. Use withTenant/withCustomer/withPublic/withSystemJob from @gieochu/db.",
          },
        ],
      },
    ],
  },
};

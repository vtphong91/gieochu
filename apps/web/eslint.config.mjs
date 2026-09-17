import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import { noRawPrismaImport } from "@gieochu/config/eslint-preset";

// §5.4: apps/web must never import the raw Prisma client — only the
// tenant-scoped withTenant/withCustomer/withPublic/withSystemJob helpers
// from @gieochu/db.
export default defineConfig([
  ...nextVitals,
  ...nextTs,
  noRawPrismaImport,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);

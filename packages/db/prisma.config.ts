import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "node:url";
import { defineConfig, env } from "prisma/config";

// Monorepo has a single root .env (see /.env.example), not one per package.
loadEnv({ path: fileURLToPath(new URL("../../.env", import.meta.url)) });

/**
 * CLI/migrate operations (generate, migrate, studio, db seed) connect directly
 * to Postgres via DIRECT_URL. The application at runtime instead uses
 * DATABASE_URL (pooled, "-pooler" host) through @prisma/adapter-neon — see
 * src/client.ts. Verified against https://www.prisma.io/docs/orm/overview/databases/neon
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("DIRECT_URL"),
  },
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});

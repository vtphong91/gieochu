import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "node:url";
import { defineConfig, env } from "prisma/config";

// Monorepo has a single root .env (see /.env.example), not one per package.
loadEnv({ path: fileURLToPath(new URL("../../.env", import.meta.url)) });

/**
 * CLI/migrate operations (generate, migrate, studio, db seed) need DDL
 * rights (CREATE/ALTER TABLE), so they connect as the Neon owner role via
 * PRISMA_MIGRATE_URL — never as the restricted runtime role. The app itself
 * uses DATABASE_URL (pooled) / DIRECT_URL (pg-boss) as the "gieochu_app"
 * role, which has DML-only privileges and, critically, no BYPASSRLS — see
 * docs/DECISIONS.md ADR-010 and packages/db/scripts/setup-app-role.mts.
 * Neon setup verified against https://www.prisma.io/docs/orm/overview/databases/neon
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("PRISMA_MIGRATE_URL"),
  },
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});

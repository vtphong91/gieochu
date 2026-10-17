import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "node:url";
import { defineConfig } from "prisma/config";

import { resolvePrismaMigrateUrl } from "@gieochu/config";

// Monorepo has a single root .env (see /.env.example), not one per package.
loadEnv({ path: fileURLToPath(new URL("../../.env", import.meta.url)) });

/**
 * CLI/migrate operations (migrate, studio, db push/pull) need DDL rights
 * (CREATE/ALTER TABLE), so they connect as the Neon owner role via
 * PRISMA_MIGRATE_URL — never as the restricted runtime role. The app itself
 * uses DATABASE_URL (pooled) / DIRECT_URL (pg-boss) as the "gieochu_app"
 * role, which has DML-only privileges and, critically, no BYPASSRLS — see
 * docs/DECISIONS.md ADR-010 and packages/db/scripts/setup-app-role.mts.
 * Neon setup verified against https://www.prisma.io/docs/orm/overview/databases/neon
 *
 * `prisma generate` does not connect to a database, so PRISMA_MIGRATE_URL is
 * optional here: CI/Vercel builds (which must never hold the owner-role URL)
 * can still generate the client. We deliberately do NOT use `env()` from
 * prisma/config (it throws on a missing var, breaking generate) and do NOT
 * fall back to a placeholder URL — when the var is absent, `datasource` is
 * omitted entirely, so migrate/studio/db push commands fail with Prisma's own
 * "datasource.url is required" error instead of silently hitting a fake host.
 */
const migrateUrl = resolvePrismaMigrateUrl(process.env);

if (!migrateUrl) {
  console.warn(
    "[prisma.config] PRISMA_MIGRATE_URL (hoặc DB_MIGRATE_USER/DB_MIGRATE_PASSWORD/DB_HOST/DB_NAME) chưa đặt — chỉ `prisma generate` chạy được; " +
      "migrate/studio/db push sẽ báo lỗi thiếu datasource.url (cần URL role owner, xem ADR-010).",
  );
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  ...(migrateUrl ? { datasource: { url: migrateUrl } } : {}),
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});

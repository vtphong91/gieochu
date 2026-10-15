// One-time, per-environment provisioning script — NOT a Prisma migration.
// Creates a dedicated Postgres role for the app to connect as (instead of
// the Neon-provided owner role, which has BYPASSRLS and would silently
// defeat every RLS policy — see docs/DECISIONS.md ADR-010).
//
// Run once per Neon project/branch:
//   pnpm --filter @gieochu/db exec tsx scripts/setup-app-role.mts
//
// Then copy the printed DATABASE_URL/DIRECT_URL into .env (keep
// PRISMA_MIGRATE_URL as the owner role — Prisma migrate/generate need DDL
// rights this restricted role intentionally does not have).
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { Client } from "pg";

loadEnv({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });

const APP_ROLE = "gieochu_app";

function assertEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name} in .env`);
  return value;
}

function generatePassword(): string {
  // Alphanumeric only — safe to embed in a connection-string URL unescaped.
  return randomBytes(24).toString("base64url");
}

async function main() {
  const ownerUrl = assertEnv("PRISMA_MIGRATE_URL");
  const ownerClient = new Client({ connectionString: ownerUrl });
  await ownerClient.connect();

  let newPassword: string | undefined;

  try {
    const existing = await ownerClient.query("SELECT 1 FROM pg_roles WHERE rolname = $1", [APP_ROLE]);
    if (existing.rowCount && existing.rowCount > 0) {
      console.log(`Role "${APP_ROLE}" already exists — not touching its password.`);
      console.log("Re-running GRANTs anyway (idempotent) in case new tables/schemas were added.\n");
    } else {
      newPassword = generatePassword();
      await ownerClient.query(`CREATE ROLE ${APP_ROLE} WITH LOGIN PASSWORD '${newPassword}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS`);
      console.log(`\nCreated role "${APP_ROLE}".\n`);
    }

    // Least privilege (2026-10-15): the app role must NOT create schemas. pg-boss only runs
    // CREATE SCHEMA when it is not installed yet — on a brand-new database, create the
    // "pgboss" schema with the owner role first (e.g. start the worker once with the owner
    // URL), then re-run this script so the grants below pick it up.
    const dbName = new URL(ownerUrl).pathname.replace(/^\//, "");
    await ownerClient.query(`REVOKE CREATE ON DATABASE "${dbName}" FROM ${APP_ROLE}`);

    await ownerClient.query(`GRANT USAGE ON SCHEMA public TO ${APP_ROLE}`);
    await ownerClient.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${APP_ROLE}`);
    await ownerClient.query(
      `ALTER DEFAULT PRIVILEGES FOR ROLE ${ownerClient.user} IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${APP_ROLE}`,
    );

    // pg-boss creates its own "pgboss" schema on first boss.start(). Grant
    // access to it if it already exists (e.g. from earlier local testing).
    const pgbossSchema = await ownerClient.query("SELECT 1 FROM information_schema.schemata WHERE schema_name = 'pgboss'");
    if (pgbossSchema.rowCount && pgbossSchema.rowCount > 0) {
      await ownerClient.query(`GRANT USAGE ON SCHEMA pgboss TO ${APP_ROLE}`);
      await ownerClient.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA pgboss TO ${APP_ROLE}`);
      await ownerClient.query(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA pgboss TO ${APP_ROLE}`);
      await ownerClient.query(
        `ALTER DEFAULT PRIVILEGES FOR ROLE ${ownerClient.user} IN SCHEMA pgboss GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${APP_ROLE}`,
      );
    }

    console.log("Grants applied.\n");

    if (newPassword) {
      // ownerUrl is the direct (non-pooled) connection — reuse its host for DIRECT_URL,
      // and derive the pooled host (Neon convention: "-pooler" before the first ".") for DATABASE_URL.
      const directUrlObj = new URL(ownerUrl);
      directUrlObj.username = APP_ROLE;
      directUrlObj.password = newPassword;

      const pooledUrlObj = new URL(ownerUrl);
      pooledUrlObj.username = APP_ROLE;
      pooledUrlObj.password = newPassword;
      pooledUrlObj.hostname = pooledUrlObj.hostname.replace(/^([^.]+)\./, "$1-pooler.");

      console.log("Set these in .env (save the password — it will not be shown again):\n");
      console.log(`DATABASE_URL="${pooledUrlObj.toString()}"`);
      console.log(`DIRECT_URL="${directUrlObj.toString()}"`);
    } else {
      console.log("Role already existed — DATABASE_URL/DIRECT_URL in .env should already use its saved password.");
    }
  } finally {
    await ownerClient.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

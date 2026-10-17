import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { getEnv } from "@gieochu/config";
import { PrismaClient } from "./generated/prisma/client";

let client: PrismaClient | undefined;

/**
 * Runtime Prisma client. Uses @prisma/adapter-neon for Neon cloud deployments (*.neon.tech),
 * and @prisma/adapter-pg for local / standard TCP PostgreSQL instances (e.g. self-hosted / docker).
 * Lazily created so importing this module has no side effects before env vars are validated.
 */
export function getPrismaClient(): PrismaClient {
  if (!client) {
    const dbUrl = getEnv().DATABASE_URL;
    const isNeon = dbUrl.includes(".neon.tech");
    const adapter = isNeon ? new PrismaNeon({ connectionString: dbUrl }) : new PrismaPg(new Pool({ connectionString: dbUrl }));
    client = new PrismaClient({ adapter });
  }
  return client;
}

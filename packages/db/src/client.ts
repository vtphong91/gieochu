import { PrismaNeon } from "@prisma/adapter-neon";
import { getEnv } from "@gieochu/config";
import { PrismaClient } from "./generated/prisma/client.js";

let client: PrismaClient | undefined;

/**
 * Runtime Prisma client, connected through the Neon serverless driver adapter
 * against the pooled DATABASE_URL (see prisma.config.ts for the CLI-side
 * DIRECT_URL). Lazily created so importing this module has no side effects
 * before env vars are validated.
 */
export function getPrismaClient(): PrismaClient {
  if (!client) {
    const adapter = new PrismaNeon({ connectionString: getEnv().DATABASE_URL });
    client = new PrismaClient({ adapter });
  }
  return client;
}

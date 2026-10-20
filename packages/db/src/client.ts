import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaPg } from "@prisma/adapter-pg";
import { getEnv } from "@gieochu/config";
import { PrismaClient } from "./generated/prisma/client";

let client: PrismaClient | undefined;

/**
 * Runtime Prisma client, connected through either Neon serverless driver adapter
 * or standard PostgreSQL adapter (@prisma/adapter-pg) depending on DATABASE_URL.
 */
export function getPrismaClient(): PrismaClient {
  if (!client) {
    const dbUrl = getEnv().DATABASE_URL;
    const isNeon = dbUrl.includes(".neon.tech") || dbUrl.includes(".neon.build");
    const adapter = isNeon
      ? new PrismaNeon({ connectionString: dbUrl })
      : new PrismaPg(dbUrl);
    client = new PrismaClient({ adapter: adapter as any });
  }
  return client;
}


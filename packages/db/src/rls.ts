import { getPrismaClient } from "./client";
import { Prisma } from "./generated/prisma/client";

export type Tx = Prisma.TransactionClient;

/**
 * §5.4 Row-Level Security helpers. Every L2 (tenant-scoped) query must go
 * through one of these — never call getPrismaClient() directly for
 * tenant/product/order/etc. tables (only L1 tables like users/tokens may).
 * Each sets Postgres session config local to the transaction
 * (`set_config(..., true)`), which the RLS policies in the rls_* migrations
 * read via `current_setting(...)`.
 */

export async function withTenant<T>(tenantId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  const prisma = getPrismaClient();
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.scope', 'tenant', true)`;
    await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
    return fn(tx);
  });
}

export async function withCustomer<T>(userId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  const prisma = getPrismaClient();
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.scope', 'customer', true)`;
    await tx.$executeRaw`SELECT set_config('app.user_id', ${userId}, true)`;
    return fn(tx);
  });
}

export async function withPublic<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  const prisma = getPrismaClient();
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.scope', 'public', true)`;
    return fn(tx);
  });
}

export async function withSystemJob<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  const prisma = getPrismaClient();
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.scope', 'system_job', true)`;
    return fn(tx);
  });
}

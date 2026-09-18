import { AppError, conflict, generateOrderCodePrefix, isReservedSlug, slugify } from "@gieochu/core";
import { getEnv } from "@gieochu/config";
import { getPrismaClient } from "@gieochu/db";
import type { CurrentUser } from "./session";

export interface CreateTenantInput {
  name: string;
  slug?: string;
  bio?: string;
}

export interface CreatedTenant {
  id: string;
  slug: string;
}

const ORDER_CODE_PREFIX_RETRIES = 10;
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function randomLetters(length: number): string {
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
}

async function resolveOrderCodePrefix(base: string): Promise<string> {
  const prisma = getPrismaClient();
  const existing = await prisma.tenant.findUnique({ where: { orderCodePrefix: base } });
  if (!existing) return base;

  // Rare collision on the deterministic prefix: fall back to a random 4-letter code.
  for (let attempt = 0; attempt < ORDER_CODE_PREFIX_RETRIES; attempt += 1) {
    const candidate = randomLetters(4);
    const taken = await prisma.tenant.findUnique({ where: { orderCodePrefix: candidate } });
    if (!taken) return candidate;
  }
  throw new AppError({
    code: "ORDER_CODE_PREFIX_EXHAUSTED",
    message: "Không tạo được mã đơn hàng, vui lòng thử lại.",
    httpStatus: 500,
  });
}

/**
 * §"M4" onboarding: one tenant per user, ACTIVE, OWNER membership, and a
 * TRIALING subscription opened in the same transaction (Subscription model
 * is forward-declared here — full billing logic lands in M3).
 */
export async function createTenantForUser(user: CurrentUser, input: CreateTenantInput): Promise<CreatedTenant> {
  const prisma = getPrismaClient();

  const existingOwned = await prisma.tenant.findUnique({ where: { ownerId: user.userId } });
  if (existingOwned) {
    return { id: existingOwned.id, slug: existingOwned.slug };
  }

  const slug = slugify(input.slug?.trim() || input.name);
  if (!slug) {
    throw new AppError({ code: "INVALID_SLUG", message: "Không tạo được đường dẫn từ tên trang.", httpStatus: 400 });
  }
  if (isReservedSlug(slug)) {
    throw conflict("SLUG_RESERVED", "Đường dẫn này không được phép sử dụng, vui lòng chọn tên khác.");
  }

  const existingSlug = await prisma.tenant.findUnique({ where: { slug } });
  if (existingSlug) {
    throw conflict("SLUG_TAKEN", `Đường dẫn "${slug}" đã được sử dụng, vui lòng chọn tên khác (ví dụ: ${slug}-2).`);
  }

  const plan = await prisma.plan.findFirst({ where: { isActive: true }, orderBy: { priceVnd: "asc" } });
  if (!plan) {
    throw new AppError({ code: "NO_PLAN_AVAILABLE", message: "Chưa có gói dịch vụ nào khả dụng.", httpStatus: 500 });
  }

  const orderCodePrefix = await resolveOrderCodePrefix(generateOrderCodePrefix(input.name));

  // SystemSettings (§"M2") is the live source of truth for trialDays once it
  // exists; TRIAL_DAYS env var is only the seed default (packages/db/prisma/seed.ts).
  const settings = await prisma.systemSettings.findUnique({ where: { id: "default" } });
  const trialDays = settings?.trialDays ?? getEnv().TRIAL_DAYS;
  const now = new Date();
  const trialEnd = new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000);

  const tenant = await prisma.$transaction(async (tx) => {
    const created = await tx.tenant.create({
      data: {
        slug,
        ownerId: user.userId,
        name: input.name,
        bio: input.bio || null,
        orderCodePrefix,
        status: "ACTIVE",
      },
    });
    // RLS on tenant_members requires app.tenant_id — set it to the tenant we
    // just created so its own bootstrap OWNER row is allowed through.
    await tx.$executeRaw`SELECT set_config('app.scope', 'tenant', true)`;
    await tx.$executeRaw`SELECT set_config('app.tenant_id', ${created.id}, true)`;
    await tx.tenantMember.create({ data: { tenantId: created.id, userId: user.userId, role: "OWNER" } });
    await tx.subscription.create({
      data: {
        tenantId: created.id,
        planId: plan.id,
        status: "TRIALING",
        currentPeriodStart: now,
        currentPeriodEnd: trialEnd,
      },
    });
    return created;
  });

  return { id: tenant.id, slug: tenant.slug };
}

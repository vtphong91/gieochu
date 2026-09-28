"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AppError, isValidPlanInput, type PlanFeatureKey } from "@gieochu/core";
import { getPrismaClient, type Prisma } from "@gieochu/db";
import { requireRole } from "../../../lib/session";

const FEATURE_KEYS: PlanFeatureKey[] = ["coupons", "advancedAnalytics", "advancedBranding", "seoTools", "automation", "customDomain"];

const planFormSchema = z.object({
  code: z.string().trim().min(1),
  name: z.string().trim().min(1),
  priceVnd: z.coerce.number(),
  interval: z.enum(["MONTH", "YEAR"]),
  intervalCount: z.coerce.number(),
  maxProducts: z.coerce.number(),
  storageMb: z.coerce.number(),
  maxFileMb: z.coerce.number(),
  /** ADR-028: hạn mức ảnh Cloudinary (MB). */
  imageStorageMb: z.coerce.number(),
  isFree: z.boolean().default(false),
  features: z.record(z.string(), z.boolean()),
});

export interface PlanActionState {
  error?: string;
}

function parsePlanFormData(formData: FormData) {
  const raw = Object.fromEntries(formData);
  const features = Object.fromEntries(FEATURE_KEYS.map((key) => [key, formData.get(`feature_${key}`) === "on"]));
  return planFormSchema.safeParse({ ...raw, isFree: formData.get("isFree") === "on", features });
}

/** §"M3 v2" ADR-021: only one active FREE plan at a time — createTenantForUser() picks it with a plain findFirst, no priority/tiebreak logic. */
async function assertSingleActiveFreePlan(isFree: boolean, isActive: boolean, excludePlanId?: string): Promise<void> {
  if (!isFree || !isActive) return;
  const prisma = getPrismaClient();
  const existing = await prisma.plan.findFirst({ where: { isFree: true, isActive: true, id: { not: excludePlanId } } });
  if (existing) {
    throw new AppError({
      code: "FREE_PLAN_ALREADY_EXISTS",
      message: `Đã có gói Free đang bật ("${existing.name}") — chỉ được 1 gói Free đang hoạt động tại một thời điểm.`,
      httpStatus: 409,
    });
  }
}

export async function createPlanAction(_prevState: PlanActionState, formData: FormData): Promise<PlanActionState> {
  await requireRole("SYSTEM_ADMIN");

  const parsed = parsePlanFormData(formData);
  if (!parsed.success) {
    return { error: "Dữ liệu không hợp lệ." };
  }
  if (!isValidPlanInput(parsed.data)) {
    return { error: "Chu kỳ hoặc giới hạn không hợp lệ (phải là số nguyên không âm)." };
  }

  const prisma = getPrismaClient();
  const existing = await prisma.plan.findUnique({ where: { code: parsed.data.code } });
  if (existing) {
    return { error: `Mã gói "${parsed.data.code}" đã tồn tại.` };
  }

  try {
    await assertSingleActiveFreePlan(parsed.data.isFree, true);
  } catch (error) {
    if (error instanceof AppError) return { error: error.message };
    throw error;
  }

  await prisma.plan.create({ data: { ...parsed.data, features: parsed.data.features as Prisma.InputJsonValue } });
  revalidatePath("/admin/plans");
  revalidatePath("/pricing");
  return {};
}

export async function updatePlanAction(planId: string, _prevState: PlanActionState, formData: FormData): Promise<PlanActionState> {
  await requireRole("SYSTEM_ADMIN");

  const parsed = parsePlanFormData(formData);
  if (!parsed.success) {
    return { error: "Dữ liệu không hợp lệ." };
  }
  if (!isValidPlanInput(parsed.data)) {
    return { error: "Chu kỳ hoặc giới hạn không hợp lệ (phải là số nguyên không âm)." };
  }

  const prisma = getPrismaClient();
  const plan = await prisma.plan.findUnique({ where: { id: planId } });
  if (!plan) {
    return { error: "Không tìm thấy gói." };
  }
  if (plan.code !== parsed.data.code) {
    const codeTaken = await prisma.plan.findUnique({ where: { code: parsed.data.code } });
    if (codeTaken) return { error: `Mã gói "${parsed.data.code}" đã tồn tại.` };
  }

  try {
    await assertSingleActiveFreePlan(parsed.data.isFree, plan.isActive, planId);
  } catch (error) {
    if (error instanceof AppError) return { error: error.message };
    throw error;
  }

  await prisma.plan.update({ where: { id: planId }, data: { ...parsed.data, features: parsed.data.features as Prisma.InputJsonValue } });
  revalidatePath("/admin/plans");
  revalidatePath(`/admin/plans/${planId}`);
  revalidatePath("/pricing");
  return {};
}

export async function togglePlanActiveAction(planId: string): Promise<void> {
  await requireRole("SYSTEM_ADMIN");
  const prisma = getPrismaClient();
  const plan = await prisma.plan.findUnique({ where: { id: planId } });
  if (!plan) throw new AppError({ code: "PLAN_NOT_FOUND", message: "Không tìm thấy gói.", httpStatus: 404 });

  if (!plan.isActive) {
    await assertSingleActiveFreePlan(plan.isFree, true, planId);
  }

  await prisma.plan.update({ where: { id: planId }, data: { isActive: !plan.isActive } });
  revalidatePath("/admin/plans");
  revalidatePath("/pricing");
}

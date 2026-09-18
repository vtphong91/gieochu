"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AppError, isValidPlanInput } from "@gieochu/core";
import { getPrismaClient } from "@gieochu/db";
import { requireRole } from "../../../lib/session";

const planFormSchema = z.object({
  code: z.string().trim().min(1),
  name: z.string().trim().min(1),
  priceVnd: z.coerce.number(),
  interval: z.enum(["MONTH", "YEAR"]),
  intervalCount: z.coerce.number(),
  maxProducts: z.coerce.number(),
  storageMb: z.coerce.number(),
  maxFileMb: z.coerce.number(),
});

export interface PlanActionState {
  error?: string;
}

export async function createPlanAction(_prevState: PlanActionState, formData: FormData): Promise<PlanActionState> {
  await requireRole("SYSTEM_ADMIN");

  const parsed = planFormSchema.safeParse(Object.fromEntries(formData));
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

  await prisma.plan.create({ data: parsed.data });
  revalidatePath("/admin/plans");
  revalidatePath("/pricing");
  return {};
}

export async function togglePlanActiveAction(planId: string): Promise<void> {
  await requireRole("SYSTEM_ADMIN");
  const prisma = getPrismaClient();
  const plan = await prisma.plan.findUnique({ where: { id: planId } });
  if (!plan) throw new AppError({ code: "PLAN_NOT_FOUND", message: "Không tìm thấy gói.", httpStatus: 404 });

  await prisma.plan.update({ where: { id: planId }, data: { isActive: !plan.isActive } });
  revalidatePath("/admin/plans");
  revalidatePath("/pricing");
}

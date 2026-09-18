"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { AppError } from "@gieochu/core";
import { requireTenantMember } from "../../../../lib/tenant";
import { createCoupon, updateCoupon, type CouponInput } from "../../../../lib/coupon";

export interface CouponActionState {
  error?: string;
}

/** Same "no timezone in the value" issue as the product sale-price fields — interpret as Asia/Ho_Chi_Minh wall-clock time. */
function parseVnDatetimeLocal(value: string): Date {
  return new Date(`${value}:00+07:00`);
}

const couponSchema = z.object({
  code: z.string().trim().min(1),
  type: z.enum(["PERCENT", "FIXED"]),
  value: z.coerce.number().int(),
  maxDiscountVnd: z.string().trim().optional(),
  minOrderVnd: z.string().trim().optional(),
  usageLimit: z.string().trim().optional(),
  perCustomerLimit: z.string().trim().optional(),
  startsAt: z.string().trim().optional(),
  endsAt: z.string().trim().optional(),
  productIds: z.array(z.string()).optional(),
});

function toNullableInt(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

function buildInput(formData: FormData): CouponInput | { error: string } {
  const parsed = couponSchema.safeParse({
    code: formData.get("code"),
    type: formData.get("type"),
    value: formData.get("value"),
    maxDiscountVnd: formData.get("maxDiscountVnd") || undefined,
    minOrderVnd: formData.get("minOrderVnd") || undefined,
    usageLimit: formData.get("usageLimit") || undefined,
    perCustomerLimit: formData.get("perCustomerLimit") || undefined,
    startsAt: formData.get("startsAt") || undefined,
    endsAt: formData.get("endsAt") || undefined,
    productIds: formData.getAll("productIds").map(String),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };

  return {
    code: parsed.data.code,
    type: parsed.data.type,
    value: parsed.data.value,
    maxDiscountVnd: toNullableInt(parsed.data.maxDiscountVnd),
    minOrderVnd: toNullableInt(parsed.data.minOrderVnd),
    usageLimit: toNullableInt(parsed.data.usageLimit),
    perCustomerLimit: toNullableInt(parsed.data.perCustomerLimit),
    startsAt: parsed.data.startsAt ? parseVnDatetimeLocal(parsed.data.startsAt) : null,
    endsAt: parsed.data.endsAt ? parseVnDatetimeLocal(parsed.data.endsAt) : null,
    productIds: parsed.data.productIds ?? [],
    isEnabled: formData.get("isEnabled") === "on",
  };
}

export async function createCouponAction(tenantSlug: string, _prevState: CouponActionState, formData: FormData): Promise<CouponActionState> {
  const { tenant } = await requireTenantMember(tenantSlug);
  const input = buildInput(formData);
  if ("error" in input) return input;

  try {
    await createCoupon(tenant.id, input);
  } catch (error) {
    if (error instanceof AppError) return { error: error.message };
    throw error;
  }
  revalidatePath(`/studio/${tenantSlug}/coupons`);
  redirect(`/studio/${tenantSlug}/coupons`);
}

export async function updateCouponAction(
  tenantSlug: string,
  couponId: string,
  _prevState: CouponActionState,
  formData: FormData,
): Promise<CouponActionState> {
  const { tenant } = await requireTenantMember(tenantSlug);
  const input = buildInput(formData);
  if ("error" in input) return input;

  try {
    await updateCoupon(tenant.id, couponId, input);
  } catch (error) {
    if (error instanceof AppError) return { error: error.message };
    throw error;
  }
  revalidatePath(`/studio/${tenantSlug}/coupons`);
  revalidatePath(`/studio/${tenantSlug}/coupons/${couponId}`);
  return {};
}

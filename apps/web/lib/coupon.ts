import { AppError, calculatePrice, type CalculatePriceResult, type CouponSnapshot, type CouponType } from "@gieochu/core";
import { getPrismaClient, withPublic, withTenant, type Coupon, type Prisma } from "@gieochu/db";
import { assertTenantCanWrite } from "./tenant-write-guard";

export interface CouponInput {
  code: string;
  type: CouponType;
  value: number;
  maxDiscountVnd?: number | null;
  minOrderVnd?: number | null;
  usageLimit?: number | null;
  perCustomerLimit?: number | null;
  startsAt?: Date | null;
  endsAt?: Date | null;
  /** empty array = applies to every product */
  productIds?: string[];
  isEnabled: boolean;
}

function validateCouponInput(input: CouponInput): void {
  if (!input.code.trim()) {
    throw new AppError({ code: "INVALID_COUPON", message: "Mã giảm giá không được để trống.", httpStatus: 400 });
  }
  if (input.type === "PERCENT" && (input.value < 1 || input.value > 100)) {
    throw new AppError({ code: "INVALID_COUPON", message: "Coupon phần trăm phải từ 1 đến 100.", httpStatus: 400 });
  }
  if (input.type === "FIXED" && input.value < 0) {
    throw new AppError({ code: "INVALID_COUPON", message: "Coupon số tiền cố định không được âm.", httpStatus: 400 });
  }
  if (input.startsAt && input.endsAt && input.startsAt >= input.endsAt) {
    throw new AppError({ code: "INVALID_COUPON", message: "Ngày bắt đầu phải trước ngày kết thúc.", httpStatus: 400 });
  }
}

export async function createCoupon(tenantId: string, input: CouponInput): Promise<Coupon> {
  const prisma = getPrismaClient();
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
  assertTenantCanWrite(tenant);
  validateCouponInput(input);

  const code = input.code.trim().toUpperCase();
  const existing = await withTenant(tenantId, (tx) => tx.coupon.findUnique({ where: { tenantId_code: { tenantId, code } } }));
  if (existing) {
    throw new AppError({ code: "COUPON_CODE_TAKEN", message: `Mã "${code}" đã tồn tại.`, httpStatus: 409 });
  }

  return withTenant(tenantId, (tx) =>
    tx.coupon.create({
      data: {
        tenantId,
        code,
        type: input.type,
        value: input.value,
        maxDiscountVnd: input.maxDiscountVnd ?? null,
        minOrderVnd: input.minOrderVnd ?? null,
        usageLimit: input.usageLimit ?? null,
        perCustomerLimit: input.perCustomerLimit ?? null,
        startsAt: input.startsAt ?? null,
        endsAt: input.endsAt ?? null,
        productIds: (input.productIds && input.productIds.length > 0 ? input.productIds : null) as Prisma.InputJsonValue,
        isEnabled: input.isEnabled,
      },
    }),
  );
}

export async function updateCoupon(tenantId: string, couponId: string, input: CouponInput): Promise<Coupon> {
  const prisma = getPrismaClient();
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
  assertTenantCanWrite(tenant);
  validateCouponInput(input);

  const existing = await withTenant(tenantId, (tx) => tx.coupon.findUnique({ where: { id: couponId } }));
  if (!existing) {
    throw new AppError({ code: "COUPON_NOT_FOUND", message: "Không tìm thấy mã giảm giá.", httpStatus: 404 });
  }

  const code = input.code.trim().toUpperCase();
  if (code !== existing.code) {
    const codeTaken = await withTenant(tenantId, (tx) => tx.coupon.findUnique({ where: { tenantId_code: { tenantId, code } } }));
    if (codeTaken) {
      throw new AppError({ code: "COUPON_CODE_TAKEN", message: `Mã "${code}" đã tồn tại.`, httpStatus: 409 });
    }
  }

  return withTenant(tenantId, (tx) =>
    tx.coupon.update({
      where: { id: couponId },
      data: {
        code,
        type: input.type,
        value: input.value,
        maxDiscountVnd: input.maxDiscountVnd ?? null,
        minOrderVnd: input.minOrderVnd ?? null,
        usageLimit: input.usageLimit ?? null,
        perCustomerLimit: input.perCustomerLimit ?? null,
        startsAt: input.startsAt ?? null,
        endsAt: input.endsAt ?? null,
        productIds: (input.productIds && input.productIds.length > 0 ? input.productIds : null) as Prisma.InputJsonValue,
        isEnabled: input.isEnabled,
      },
    }),
  );
}

export async function listCoupons(tenantId: string): Promise<Coupon[]> {
  return withTenant(tenantId, (tx) => tx.coupon.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" } }));
}

export async function getCoupon(tenantId: string, couponId: string): Promise<Coupon> {
  const coupon = await withTenant(tenantId, (tx) => tx.coupon.findUnique({ where: { id: couponId } }));
  if (!coupon) {
    throw new AppError({ code: "COUPON_NOT_FOUND", message: "Không tìm thấy mã giảm giá.", httpStatus: 404 });
  }
  return coupon;
}

function toCouponSnapshot(row: Coupon): CouponSnapshot {
  return {
    type: row.type,
    value: row.value,
    maxDiscountVnd: row.maxDiscountVnd,
    minOrderVnd: row.minOrderVnd,
    usageLimit: row.usageLimit,
    usedCount: row.usedCount,
    perCustomerLimit: row.perCustomerLimit,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    productIds: row.productIds as string[] | null,
    isEnabled: row.isEnabled,
  };
}

export interface PreviewPriceInput {
  productIds: string[];
  couponCode?: string;
  userId?: string;
}

export interface PreviewPriceResult extends Omit<CalculatePriceResult, "couponError"> {
  couponError?: CalculatePriceResult["couponError"] | "NOT_FOUND";
}

/**
 * §"M6" — "API áp mã trả về tổng tiền đã tính lại ở server". Public: reads
 * only PUBLISHED products and isEnabled coupons (RLS), meant for a
 * storefront cart preview before checkout exists (M8) — M8's real checkout
 * calls the same `calculatePrice()` engine again server-side before
 * accepting payment, never trusting a client-computed total.
 */
export async function previewCouponPrice(tenantId: string, input: PreviewPriceInput): Promise<PreviewPriceResult> {
  const products = await withPublic((tx) =>
    tx.product.findMany({ where: { tenantId, id: { in: input.productIds }, status: "PUBLISHED" } }),
  );
  const items = products.map((p) => ({
    productId: p.id,
    priceVnd: p.priceVnd,
    salePriceVnd: p.salePriceVnd,
    saleStartsAt: p.saleStartsAt,
    saleEndsAt: p.saleEndsAt,
  }));

  const now = new Date();
  if (!input.couponCode) {
    return calculatePrice({ items, customerUsageCount: 0, now });
  }

  const code = input.couponCode.trim().toUpperCase();
  const couponRow = await withPublic((tx) => tx.coupon.findFirst({ where: { tenantId, code, isEnabled: true } }));
  if (!couponRow) {
    return { ...calculatePrice({ items, customerUsageCount: 0, now }), couponError: "NOT_FOUND" };
  }

  let customerUsageCount = 0;
  if (input.userId && couponRow.perCustomerLimit != null) {
    customerUsageCount = await withTenant(tenantId, (tx) =>
      tx.couponRedemption.count({ where: { couponId: couponRow.id, userId: input.userId } }),
    );
  }

  return calculatePrice({ items, coupon: toCouponSnapshot(couponRow), customerUsageCount, now });
}

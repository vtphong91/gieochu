import { AppError, isWithinPlanLimit, type PlanLimitKind } from "@gieochu/core";
import { getPrismaClient, withTenant } from "@gieochu/db";

/**
 * §"M3" backlog item, resolved now that M5 has a real Product/ProductFile
 * schema to query against. `amount` means "how much MORE" for `products`
 * (published-count delta, usually 1) and `storage` (bytes about to be
 * added) — for `fileSize` it IS the value being checked (one file's size),
 * not a delta.
 */
export async function assertPlanLimit(tenantId: string, kind: PlanLimitKind, amount: number): Promise<void> {
  const prisma = getPrismaClient();
  const subscription = await prisma.subscription.findUniqueOrThrow({ where: { tenantId }, include: { plan: true } });
  const limits = {
    maxProducts: subscription.plan.maxProducts,
    storageMb: subscription.plan.storageMb,
    maxFileMb: subscription.plan.maxFileMb,
  };

  if (kind === "fileSize") {
    if (!isWithinPlanLimit("fileSize", amount, limits)) {
      throw new AppError({
        code: "FILE_TOO_LARGE",
        message: `File vượt quá giới hạn ${limits.maxFileMb}MB của gói hiện tại.`,
        httpStatus: 400,
      });
    }
    return;
  }

  if (kind === "storage") {
    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
    if (!isWithinPlanLimit("storage", tenant.storageUsedBytes + amount, limits)) {
      throw new AppError({
        code: "STORAGE_LIMIT_REACHED",
        message: `Đã vượt dung lượng ${limits.storageMb}MB của gói hiện tại.`,
        httpStatus: 400,
      });
    }
    return;
  }

  const publishedCount = await withTenant(tenantId, (tx) => tx.product.count({ where: { tenantId, status: "PUBLISHED" } }));
  if (!isWithinPlanLimit("products", publishedCount + amount, limits)) {
    throw new AppError({
      code: "PRODUCT_LIMIT_REACHED",
      message: `Đã đạt giới hạn ${limits.maxProducts} sản phẩm của gói hiện tại.`,
      httpStatus: 400,
    });
  }
}

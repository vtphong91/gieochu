import { getPrismaClient, type PaymentProviderId, type PlatformPaymentConfig, type Prisma, type SystemStorageConfig } from "@gieochu/db";

/**
 * Integration test chạy trên DB dev dùng chung (ADR-009): test nào ghi đè cấu hình hệ thống singleton (R2 storage,
 * cổng thanh toán platform) phải chụp lại dòng cũ TRƯỚC khi ghi và khôi phục đúng dòng đó ở `afterAll` — chỉ xoá
 * khi trước đó không có dòng nào. Không bao giờ `deleteMany` mù cấu hình thật của môi trường.
 */

const prisma = getPrismaClient();
const STORAGE_CONFIG_ID = "default";

export type StorageConfigSnapshot = { row: SystemStorageConfig | null };

export async function snapshotStorageConfig(): Promise<StorageConfigSnapshot> {
  return { row: await prisma.systemStorageConfig.findUnique({ where: { id: STORAGE_CONFIG_ID } }) };
}

export async function restoreStorageConfig(snapshot: StorageConfigSnapshot): Promise<void> {
  const { row } = snapshot;
  if (!row) {
    await prisma.systemStorageConfig.deleteMany({ where: { id: STORAGE_CONFIG_ID } });
    return;
  }
  const data = {
    isEnabled: row.isEnabled,
    publicConfig: row.publicConfig as Prisma.InputJsonValue,
    encryptedSecrets: row.encryptedSecrets,
    lastVerifiedAt: row.lastVerifiedAt,
  };
  await prisma.systemStorageConfig.upsert({
    where: { id: STORAGE_CONFIG_ID },
    update: data,
    create: { id: row.id, createdAt: row.createdAt, ...data },
  });
}

export type PlatformPaymentConfigSnapshot = { provider: PaymentProviderId; row: PlatformPaymentConfig | null };

export async function snapshotPlatformPaymentConfig(provider: PaymentProviderId): Promise<PlatformPaymentConfigSnapshot> {
  return { provider, row: await prisma.platformPaymentConfig.findUnique({ where: { provider } }) };
}

export async function restorePlatformPaymentConfig(snapshot: PlatformPaymentConfigSnapshot): Promise<void> {
  const { provider, row } = snapshot;
  if (!row) {
    await prisma.platformPaymentConfig.deleteMany({ where: { provider } });
    return;
  }
  const data = {
    isEnabled: row.isEnabled,
    publicConfig: row.publicConfig as Prisma.InputJsonValue,
    encryptedSecrets: row.encryptedSecrets,
    webhookSecretHash: row.webhookSecretHash,
    lastVerifiedAt: row.lastVerifiedAt,
  };
  // Upsert theo `provider` (unique) — nếu test đã tạo dòng mới với id khác thì dòng đó được ghi lại nội dung cũ.
  await prisma.platformPaymentConfig.upsert({
    where: { provider },
    update: data,
    create: { id: row.id, provider, createdAt: row.createdAt, ...data },
  });
}

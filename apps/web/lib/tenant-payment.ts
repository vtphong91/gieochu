import { decryptSecret, encryptSecret, getProvider, maskSecret, type PaymentProviderId, type TestResult } from "@gieochu/payments";
import { AppError } from "@gieochu/core";
import { getEnv } from "@gieochu/config";
import { getPrismaClient, withTenant, Prisma } from "@gieochu/db";
import { audit } from "./audit";

export type PublicProviderConfig = Record<string, string | number | boolean>;

export interface SaveProviderConfigInput {
  provider: PaymentProviderId;
  isEnabled: boolean;
  /** Non-secret fields (bank BIN, account no/name, partnerCode, environment...). */
  publicConfig: PublicProviderConfig;
  /** Secret fields (API key, HMAC secret, MoMo secretKey...) — encrypted before storage. */
  secrets: Record<string, string>;
  /** ADR-037: user ghi audit PAYMENT_CONFIG_UPDATED. */
  actorId?: string | null;
}

/**
 * §"M7": validates the merged config against the provider's own zod schema
 * before saving. A blank value in `input.secrets` means "keep the existing
 * secret for that key" (so editing other fields doesn't force re-entering
 * credentials) — resolved against the previously-saved config, if any.
 */
export async function saveTenantProviderConfig(tenantId: string, input: SaveProviderConfigInput): Promise<void> {
  const env = getEnv();

  const existing = await withTenant(tenantId, (tx) =>
    tx.tenantPaymentConfig.findUnique({ where: { tenantId_provider: { tenantId, provider: input.provider } } }),
  );
  const existingSecrets = existing
    ? (JSON.parse(decryptSecret(existing.encryptedSecrets, env.PAYMENT_ENCRYPTION_KEY)) as Record<string, string>)
    : {};

  // Secret không bắt buộc (SePay `apiToken`) chưa từng nhập → bỏ hẳn khoá thay vì lưu "" (zod `optional()` không nhận "").
  const resolvedSecrets = Object.fromEntries(
    Object.entries(input.secrets)
      .map(([key, value]) => [key, value || existingSecrets[key] || ""] as const)
      .filter(([, value]) => value !== ""),
  );

  const provider = getProvider(input.provider);
  try {
    provider.validateConfig({ ...input.publicConfig, ...resolvedSecrets });
  } catch {
    throw new AppError({ code: "INVALID_PAYMENT_CONFIG", message: "Cấu hình không hợp lệ.", httpStatus: 400 });
  }

  const encryptedSecrets = encryptSecret(JSON.stringify(resolvedSecrets), env.PAYMENT_ENCRYPTION_KEY);

  const publicConfig = input.publicConfig as Prisma.InputJsonValue;
  await withTenant(tenantId, (tx) =>
    tx.tenantPaymentConfig.upsert({
      where: { tenantId_provider: { tenantId, provider: input.provider } },
      update: { isEnabled: input.isEnabled, publicConfig, encryptedSecrets },
      create: {
        tenantId,
        provider: input.provider,
        isEnabled: input.isEnabled,
        publicConfig,
        encryptedSecrets,
      },
    }),
  );
  // ADR-037 / §"M7": KHÔNG ghi secret (kể cả bản che) hay publicConfig (số tài khoản) — chỉ cờ thay đổi.
  await audit.log({
    actorId: input.actorId ?? null,
    scope: "TENANT",
    tenantId,
    action: "PAYMENT_CONFIG_UPDATED",
    targetType: "TenantPaymentConfig",
    targetId: input.provider,
    metadata: {
      provider: input.provider,
      created: !existing,
      isEnabled: input.isEnabled,
      credentialsChanged: JSON.stringify(resolvedSecrets) !== JSON.stringify(existingSecrets),
    },
  });
}

/**
 * Bản tenant của `testPlatformProviderConnection` (PaymentScope TENANT, `tenant_payment_configs` qua `withTenant`): chạy
 * `testConnection` của provider với cấu hình ĐÃ LƯU; thành công → đặt `lastVerifiedAt` và bật cổng + ghi audit. Secret chỉ
 * giải mã trong hàm, không trả ra ngoài.
 */
export async function testTenantProviderConnection(tenantId: string, provider: PaymentProviderId, actorId: string | null = null): Promise<TestResult> {
  const env = getEnv();
  const row = await withTenant(tenantId, (tx) =>
    tx.tenantPaymentConfig.findUnique({ where: { tenantId_provider: { tenantId, provider } } }),
  );
  if (!row) return { ok: false, message: "Chưa cấu hình phương thức này." };

  const providerImpl = getProvider(provider);
  if (!providerImpl.testConnection) return { ok: false, message: "Phương thức này không hỗ trợ kiểm tra kết nối." };

  const secrets = JSON.parse(decryptSecret(row.encryptedSecrets, env.PAYMENT_ENCRYPTION_KEY)) as Record<string, string>;
  const cfg = { ...(row.publicConfig as Record<string, unknown>), ...secrets };
  const result = await providerImpl.testConnection(cfg as never);

  if (result.ok) {
    await withTenant(tenantId, (tx) =>
      tx.tenantPaymentConfig.update({
        where: { tenantId_provider: { tenantId, provider } },
        data: { isEnabled: true, lastVerifiedAt: new Date() },
      }),
    );
    await audit.log({
      actorId,
      scope: "TENANT",
      tenantId,
      action: "PAYMENT_CONFIG_UPDATED",
      targetType: "TenantPaymentConfig",
      targetId: provider,
      metadata: { provider, isEnabled: true, verified: true, wasEnabled: row.isEnabled },
    });
  }
  return result;
}

export interface MaskedProviderConfig {
  provider: PaymentProviderId;
  isEnabled: boolean;
  publicConfig: Record<string, unknown>;
  maskedSecrets: Record<string, string>;
  lastVerifiedAt: Date | null;
}

/** §7.3: secrets are decrypted only long enough to compute a masked (••••abcd) view — never returned raw. */
export async function listTenantProviderConfigs(tenantId: string): Promise<MaskedProviderConfig[]> {
  const env = getEnv();
  const rows = await withTenant(tenantId, (tx) => tx.tenantPaymentConfig.findMany({ where: { tenantId } }));

  return rows.map((row) => {
    const secrets = JSON.parse(decryptSecret(row.encryptedSecrets, env.PAYMENT_ENCRYPTION_KEY)) as Record<
      string,
      string
    >;
    const maskedSecrets = Object.fromEntries(Object.entries(secrets).map(([key, value]) => [key, maskSecret(value)]));
    return {
      provider: row.provider,
      isEnabled: row.isEnabled,
      publicConfig: row.publicConfig as Record<string, unknown>,
      maskedSecrets,
      lastVerifiedAt: row.lastVerifiedAt,
    };
  });
}

/** Used by M8's checkout to list which methods a tenant actually takes payments through. */
export async function getEnabledProviders(tenantId: string): Promise<PaymentProviderId[]> {
  const rows = await withTenant(tenantId, (tx) =>
    tx.tenantPaymentConfig.findMany({ where: { tenantId, isEnabled: true }, select: { provider: true } }),
  );
  return rows.map((row) => row.provider);
}

export async function listBankBins() {
  const prisma = getPrismaClient();
  return prisma.bankBin.findMany({ orderBy: { shortName: "asc" } });
}

/** Tên ngân hàng theo BIN (bảng L1 `bank_bins`) — null nếu BIN rỗng/không có trong danh mục. */
export async function getBankByBin(bin: string | null | undefined): Promise<{ shortName: string; name: string } | null> {
  if (!bin) return null;
  const prisma = getPrismaClient();
  return prisma.bankBin.findUnique({ where: { bin }, select: { shortName: true, name: true } });
}

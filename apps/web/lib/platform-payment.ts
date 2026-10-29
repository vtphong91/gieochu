import { decryptSecret, encryptSecret, getProvider, maskSecret, type PaymentProviderId, type TestResult } from "@gieochu/payments";
import { AppError } from "@gieochu/core";
import { getEnv } from "@gieochu/config";
import { getPrismaClient, Prisma, type PlatformPaymentConfig } from "@gieochu/db";
import { audit } from "./audit";

export type PublicProviderConfig = Record<string, string | number | boolean>;

export interface SavePlatformProviderConfigInput {
  provider: PaymentProviderId;
  isEnabled: boolean;
  /** Non-secret fields (bank BIN, account no/name, partnerCode, environment, paymentPrefix...). */
  publicConfig: PublicProviderConfig;
  /** Secret fields — encrypted before storage. Blank value keeps the existing secret (§"M7" convention). */
  secrets: Record<string, string>;
  /** ADR-037: admin ghi audit PAYMENT_CONFIG_UPDATED. */
  actorId?: string | null;
}

/** The account/secret "identity" per provider — used to detect a change worth re-verifying (see below). */
function accountIdentity(provider: PaymentProviderId, cfg: PublicProviderConfig): unknown {
  if (provider === "MOMO") return cfg.partnerCode;
  // ADR-059 bổ sung lần 3/4: đổi số điện thoại ví → tự tắt, phải lưu lại để xác nhận (ADR-013).
  if (provider === "MOMO_MANUAL") return { phone: cfg.phone };
  return { bankBin: cfg.bankBin, accountNo: cfg.accountNo };
}

/**
 * §"M3", informed by the TaniGos report's `config.service.ts` pattern: saving
 * a config whose bank account / partnerCode / secret changed from what was
 * stored before automatically clears `isEnabled` and `lastVerifiedAt` — a
 * platform provider never sits "enabled" against credentials nobody has
 * re-confirmed. A cosmetic edit (account name, SePay authType) does not
 * trigger this. Re-saving unchanged (with the checkbox ticked) re-enables it.
 */
export interface SavePlatformProviderConfigResult {
  /** Trạng thái thực sự đã lưu (có thể khác `input.isEnabled` do ADR-013). */
  isEnabled: boolean;
  /** Admin yêu cầu bật nhưng bị tự tắt vì định danh tài khoản/secret đổi (ADR-013) — cần lưu lại lần nữa. */
  autoDisabled: boolean;
}

export async function savePlatformProviderConfig(input: SavePlatformProviderConfigInput): Promise<SavePlatformProviderConfigResult> {
  const env = getEnv();
  const prisma = getPrismaClient();

  const existing = await prisma.platformPaymentConfig.findUnique({ where: { provider: input.provider } });
  const existingSecrets = existing
    ? (JSON.parse(decryptSecret(existing.encryptedSecrets, env.PAYMENT_ENCRYPTION_KEY)) as Record<string, string>)
    : {};

  const resolvedSecrets = Object.fromEntries(
    Object.entries(input.secrets).map(([key, value]) => [key, value || existingSecrets[key] || ""]),
  );

  const provider = getProvider(input.provider);
  try {
    provider.validateConfig({ ...input.publicConfig, ...resolvedSecrets });
  } catch {
    throw new AppError({ code: "INVALID_PAYMENT_CONFIG", message: "Cấu hình không hợp lệ.", httpStatus: 400 });
  }

  const identityChanged =
    !existing ||
    JSON.stringify(accountIdentity(input.provider, input.publicConfig)) !==
      JSON.stringify(accountIdentity(input.provider, existing.publicConfig as PublicProviderConfig)) ||
    JSON.stringify(resolvedSecrets) !== JSON.stringify(existingSecrets);

  const isEnabled = identityChanged ? false : input.isEnabled;
  const lastVerifiedAt = identityChanged ? null : (existing?.lastVerifiedAt ?? null);
  const encryptedSecrets = encryptSecret(JSON.stringify(resolvedSecrets), env.PAYMENT_ENCRYPTION_KEY);
  const publicConfig = input.publicConfig as Prisma.InputJsonValue;

  await prisma.platformPaymentConfig.upsert({
    where: { provider: input.provider },
    update: { isEnabled, publicConfig, encryptedSecrets, lastVerifiedAt },
    create: { provider: input.provider, isEnabled, publicConfig, encryptedSecrets, lastVerifiedAt },
  });
  // ADR-037: không ghi secret/publicConfig — chỉ cờ thay đổi (PaymentScope PLATFORM, không tenantId).
  await audit.log({
    actorId: input.actorId ?? null,
    scope: "SYSTEM",
    action: "PAYMENT_CONFIG_UPDATED",
    targetType: "PlatformPaymentConfig",
    targetId: input.provider,
    metadata: {
      provider: input.provider,
      created: !existing,
      isEnabled,
      requestedEnabled: input.isEnabled,
      credentialsChanged: JSON.stringify(resolvedSecrets) !== JSON.stringify(existingSecrets),
      accountChanged: identityChanged,
    },
  });
  return { isEnabled, autoDisabled: identityChanged && input.isEnabled };
}

export interface MaskedPlatformProviderConfig {
  provider: PaymentProviderId;
  isEnabled: boolean;
  publicConfig: Record<string, unknown>;
  maskedSecrets: Record<string, string>;
  lastVerifiedAt: Date | null;
}

export async function listPlatformProviderConfigs(): Promise<MaskedPlatformProviderConfig[]> {
  const env = getEnv();
  const prisma = getPrismaClient();
  const rows = await prisma.platformPaymentConfig.findMany();

  return rows.map((row) => {
    const secrets = JSON.parse(decryptSecret(row.encryptedSecrets, env.PAYMENT_ENCRYPTION_KEY)) as Record<string, string>;
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

/**
 * Dòng cấu hình cổng PLATFORM (L1, PaymentScope PLATFORM) theo provider — điểm đọc duy nhất cho luồng tạo hoá đơn gia hạn
 * và webhook platform. Tách hàm để integration test thay bằng cấu hình giả trong bộ nhớ thay vì ghi đè dòng thật trên
 * DB dùng chung (ADR-034).
 */
export async function getPlatformPaymentConfigRow(provider: PaymentProviderId): Promise<PlatformPaymentConfig | null> {
  return getPrismaClient().platformPaymentConfig.findUnique({ where: { provider } });
}

/** Used by subscription-billing.ts to offer only providers the platform actually accepts payment through. */
export async function getEnabledPlatformProviders(): Promise<PaymentProviderId[]> {
  const prisma = getPrismaClient();
  const rows = await prisma.platformPaymentConfig.findMany({ where: { isEnabled: true }, select: { provider: true } });
  return rows.map((row) => row.provider);
}

/**
 * Runs the provider's own testConnection (MoMo only — SePay/MANUAL_QR have
 * none, see docs/BACKLOG.md M7 entry) and, on success, sets lastVerifiedAt
 * and flips isEnabled back on — the other half of the auto-disable guard above.
 */
export async function testPlatformProviderConnection(provider: PaymentProviderId, actorId: string | null = null): Promise<TestResult> {
  const env = getEnv();
  const prisma = getPrismaClient();
  const row = await prisma.platformPaymentConfig.findUnique({ where: { provider } });
  if (!row) {
    return { ok: false, message: "Chưa cấu hình phương thức này." };
  }

  const providerImpl = getProvider(provider);
  if (!providerImpl.testConnection) {
    return { ok: false, message: "Phương thức này không hỗ trợ kiểm tra kết nối." };
  }

  const secrets = JSON.parse(decryptSecret(row.encryptedSecrets, env.PAYMENT_ENCRYPTION_KEY)) as Record<string, string>;
  const cfg = { ...(row.publicConfig as Record<string, unknown>), ...secrets };
  const result = await providerImpl.testConnection(cfg as never);

  if (result.ok) {
    await prisma.platformPaymentConfig.update({
      where: { provider },
      data: { isEnabled: true, lastVerifiedAt: new Date() },
    });
    // Kiểm tra kết nối thành công tự BẬT phương thức — là thay đổi cấu hình, ghi audit.
    await audit.log({
      actorId,
      scope: "SYSTEM",
      action: "PAYMENT_CONFIG_UPDATED",
      targetType: "PlatformPaymentConfig",
      targetId: provider,
      metadata: { provider, isEnabled: true, verified: true, wasEnabled: row.isEnabled },
    });
  }
  return result;
}

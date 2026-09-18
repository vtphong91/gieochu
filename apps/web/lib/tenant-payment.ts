import { decryptSecret, encryptSecret, getProvider, maskSecret, type PaymentProviderId } from "@gieochu/payments";
import { AppError } from "@gieochu/core";
import { getEnv } from "@gieochu/config";
import { getPrismaClient, withTenant, Prisma } from "@gieochu/db";

export type PublicProviderConfig = Record<string, string | number | boolean>;

export interface SaveProviderConfigInput {
  provider: PaymentProviderId;
  isEnabled: boolean;
  /** Non-secret fields (bank BIN, account no/name, partnerCode, environment...). */
  publicConfig: PublicProviderConfig;
  /** Secret fields (API key, HMAC secret, MoMo secretKey...) — encrypted before storage. */
  secrets: Record<string, string>;
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

  const resolvedSecrets = Object.fromEntries(
    Object.entries(input.secrets).map(([key, value]) => [key, value || existingSecrets[key] || ""]),
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

import { decryptSecret, encryptSecret, maskSecret, AppError } from "@gieochu/core";
import { createS3Client, testS3Connection, type TestConnectionResult } from "@gieochu/storage";
import { getEnv } from "@gieochu/config";
import { getPrismaClient, Prisma } from "@gieochu/db";

const CONFIG_ID = "default";

export interface SystemStoragePublicConfig {
  endpoint: string;
  region: string;
  bucketPrivate: string;
  bucketPublic: string;
  publicBaseUrl?: string;
}

export interface SystemStorageSecrets {
  accessKeyId: string;
  secretAccessKey: string;
}

export interface SaveSystemStorageConfigInput {
  isEnabled: boolean;
  publicConfig: SystemStoragePublicConfig;
  /** Blank value keeps the existing secret (§"M7"/M3 convention). */
  secrets: Partial<SystemStorageSecrets>;
}

/** The connection-relevant fields — a change here (not `publicBaseUrl`, purely cosmetic) forces re-verification. */
function connectionIdentity(cfg: SystemStoragePublicConfig): unknown {
  return { endpoint: cfg.endpoint, region: cfg.region, bucketPrivate: cfg.bucketPrivate, bucketPublic: cfg.bucketPublic };
}

/**
 * §"M5"/ADR-017: same auto-disable-on-change safety net as
 * savePlatformProviderConfig() (ADR-013) — object storage credentials reach
 * every tenant's files, so a config whose endpoint/buckets/keys changed
 * always comes back up `isEnabled=false` until an admin re-verifies it.
 */
export async function saveSystemStorageConfig(input: SaveSystemStorageConfigInput): Promise<void> {
  const env = getEnv();
  const prisma = getPrismaClient();

  const existing = await prisma.systemStorageConfig.findUnique({ where: { id: CONFIG_ID } });
  const existingSecrets = existing
    ? (JSON.parse(decryptSecret(existing.encryptedSecrets, env.STORAGE_ENCRYPTION_KEY)) as Partial<SystemStorageSecrets>)
    : {};

  const resolvedSecrets: SystemStorageSecrets = {
    accessKeyId: input.secrets.accessKeyId || existingSecrets.accessKeyId || "",
    secretAccessKey: input.secrets.secretAccessKey || existingSecrets.secretAccessKey || "",
  };
  if (!resolvedSecrets.accessKeyId || !resolvedSecrets.secretAccessKey) {
    throw new AppError({ code: "INVALID_STORAGE_CONFIG", message: "Thiếu Access Key ID/Secret Access Key.", httpStatus: 400 });
  }

  const identityChanged =
    !existing ||
    JSON.stringify(connectionIdentity(input.publicConfig)) !==
      JSON.stringify(connectionIdentity(existing.publicConfig as unknown as SystemStoragePublicConfig)) ||
    JSON.stringify(resolvedSecrets) !== JSON.stringify(existingSecrets);

  const isEnabled = identityChanged ? false : input.isEnabled;
  const lastVerifiedAt = identityChanged ? null : (existing?.lastVerifiedAt ?? null);
  const encryptedSecrets = encryptSecret(JSON.stringify(resolvedSecrets), env.STORAGE_ENCRYPTION_KEY);
  const publicConfig = input.publicConfig as unknown as Prisma.InputJsonValue;

  await prisma.systemStorageConfig.upsert({
    where: { id: CONFIG_ID },
    update: { isEnabled, publicConfig, encryptedSecrets, lastVerifiedAt },
    create: { id: CONFIG_ID, isEnabled, publicConfig, encryptedSecrets, lastVerifiedAt },
  });
}

export interface MaskedSystemStorageConfig {
  isEnabled: boolean;
  publicConfig: SystemStoragePublicConfig;
  maskedSecrets: { accessKeyId: string; secretAccessKey: string };
  lastVerifiedAt: Date | null;
}

export async function getSystemStorageConfig(): Promise<MaskedSystemStorageConfig | null> {
  const env = getEnv();
  const prisma = getPrismaClient();
  const row = await prisma.systemStorageConfig.findUnique({ where: { id: CONFIG_ID } });
  if (!row) return null;

  const secrets = JSON.parse(decryptSecret(row.encryptedSecrets, env.STORAGE_ENCRYPTION_KEY)) as SystemStorageSecrets;
  return {
    isEnabled: row.isEnabled,
    publicConfig: row.publicConfig as unknown as SystemStoragePublicConfig,
    maskedSecrets: { accessKeyId: maskSecret(secrets.accessKeyId), secretAccessKey: maskSecret(secrets.secretAccessKey) },
    lastVerifiedAt: row.lastVerifiedAt,
  };
}

export interface DecryptedSystemStorageConfig extends SystemStoragePublicConfig, SystemStorageSecrets {
  isEnabled: boolean;
}

/**
 * Internal, server-only — the full decrypted config (upload/presign,
 * file.scan). Never returned from a Server Action/route response; only
 * `getSystemStorageConfig()` (masked) is safe to send to the client.
 * Returns null when unconfigured or not yet re-verified after a change.
 */
export async function getDecryptedSystemStorageConfig(): Promise<DecryptedSystemStorageConfig | null> {
  const env = getEnv();
  const prisma = getPrismaClient();
  const row = await prisma.systemStorageConfig.findUnique({ where: { id: CONFIG_ID } });
  if (!row || !row.isEnabled) return null;

  const publicConfig = row.publicConfig as unknown as SystemStoragePublicConfig;
  const secrets = JSON.parse(decryptSecret(row.encryptedSecrets, env.STORAGE_ENCRYPTION_KEY)) as SystemStorageSecrets;
  return { ...publicConfig, ...secrets, isEnabled: row.isEnabled };
}

/** Runs a real HeadBucket against both buckets and, on success, flips isEnabled back on (the other half of the auto-disable guard above). */
export async function testSystemStorageConnection(): Promise<TestConnectionResult> {
  const env = getEnv();
  const prisma = getPrismaClient();
  const row = await prisma.systemStorageConfig.findUnique({ where: { id: CONFIG_ID } });
  if (!row) {
    return { ok: false, message: "Chưa cấu hình storage." };
  }

  const publicConfig = row.publicConfig as unknown as SystemStoragePublicConfig;
  const secrets = JSON.parse(decryptSecret(row.encryptedSecrets, env.STORAGE_ENCRYPTION_KEY)) as SystemStorageSecrets;
  const client = createS3Client({
    endpoint: publicConfig.endpoint,
    region: publicConfig.region,
    accessKeyId: secrets.accessKeyId,
    secretAccessKey: secrets.secretAccessKey,
  });
  const result = await testS3Connection(client, { bucketPrivate: publicConfig.bucketPrivate, bucketPublic: publicConfig.bucketPublic });

  if (result.ok) {
    await prisma.systemStorageConfig.update({ where: { id: CONFIG_ID }, data: { isEnabled: true, lastVerifiedAt: new Date() } });
  }
  return result;
}

import { createHash } from "node:crypto";
import { decryptSecret, encryptSecret, maskSecret, AppError } from "@gieochu/core";
import { getEnv } from "@gieochu/config";
import { getPrismaClient, Prisma } from "@gieochu/db";

const CONFIG_ID = "default";

export interface SystemCloudinaryPublicConfig {
  cloudName: string;
  uploadFolder: string;
}

export interface SystemCloudinarySecrets {
  apiKey: string;
  apiSecret: string;
}

export interface SaveSystemCloudinaryConfigInput {
  isEnabled: boolean;
  publicConfig: SystemCloudinaryPublicConfig;
  /** Blank value keeps the existing secret (§"M7"/M3 convention). */
  secrets: Partial<SystemCloudinarySecrets>;
}

function connectionIdentity(cfg: SystemCloudinaryPublicConfig): unknown {
  return { cloudName: cfg.cloudName };
}

/** Cùng cơ chế auto-disable-on-change với R2/SePay/MoMo (ADR-013) — đổi cloud name/key/secret luôn tắt cho tới khi admin xác nhận lại. */
export async function saveSystemCloudinaryConfig(input: SaveSystemCloudinaryConfigInput): Promise<void> {
  const env = getEnv();
  const prisma = getPrismaClient();

  const existing = await prisma.systemCloudinaryConfig.findUnique({ where: { id: CONFIG_ID } });
  const existingSecrets = existing
    ? (JSON.parse(decryptSecret(existing.encryptedSecrets, env.STORAGE_ENCRYPTION_KEY)) as Partial<SystemCloudinarySecrets>)
    : {};

  const resolvedSecrets: SystemCloudinarySecrets = {
    apiKey: input.secrets.apiKey || existingSecrets.apiKey || "",
    apiSecret: input.secrets.apiSecret || existingSecrets.apiSecret || "",
  };
  if (!resolvedSecrets.apiKey || !resolvedSecrets.apiSecret) {
    throw new AppError({ code: "INVALID_CLOUDINARY_CONFIG", message: "Thiếu API Key/API Secret.", httpStatus: 400 });
  }

  const identityChanged =
    !existing ||
    JSON.stringify(connectionIdentity(input.publicConfig)) !==
      JSON.stringify(connectionIdentity(existing.publicConfig as unknown as SystemCloudinaryPublicConfig)) ||
    JSON.stringify(resolvedSecrets) !== JSON.stringify(existingSecrets);

  const isEnabled = identityChanged ? false : input.isEnabled;
  const lastVerifiedAt = identityChanged ? null : (existing?.lastVerifiedAt ?? null);
  const encryptedSecrets = encryptSecret(JSON.stringify(resolvedSecrets), env.STORAGE_ENCRYPTION_KEY);
  const publicConfig = input.publicConfig as unknown as Prisma.InputJsonValue;

  await prisma.systemCloudinaryConfig.upsert({
    where: { id: CONFIG_ID },
    update: { isEnabled, publicConfig, encryptedSecrets, lastVerifiedAt },
    create: { id: CONFIG_ID, isEnabled, publicConfig, encryptedSecrets, lastVerifiedAt },
  });
}

export interface MaskedSystemCloudinaryConfig {
  isEnabled: boolean;
  publicConfig: SystemCloudinaryPublicConfig;
  maskedSecrets: { apiKey: string; apiSecret: string };
  lastVerifiedAt: Date | null;
}

export async function getSystemCloudinaryConfig(): Promise<MaskedSystemCloudinaryConfig | null> {
  const env = getEnv();
  const prisma = getPrismaClient();
  const row = await prisma.systemCloudinaryConfig.findUnique({ where: { id: CONFIG_ID } });
  if (!row) return null;

  const secrets = JSON.parse(decryptSecret(row.encryptedSecrets, env.STORAGE_ENCRYPTION_KEY)) as SystemCloudinarySecrets;
  return {
    isEnabled: row.isEnabled,
    publicConfig: row.publicConfig as unknown as SystemCloudinaryPublicConfig,
    maskedSecrets: { apiKey: maskSecret(secrets.apiKey), apiSecret: maskSecret(secrets.apiSecret) },
    lastVerifiedAt: row.lastVerifiedAt,
  };
}

interface DecryptedSystemCloudinaryConfig extends SystemCloudinaryPublicConfig, SystemCloudinarySecrets {}

async function getDecryptedSystemCloudinaryConfig(): Promise<DecryptedSystemCloudinaryConfig | null> {
  const env = getEnv();
  const prisma = getPrismaClient();
  const row = await prisma.systemCloudinaryConfig.findUnique({ where: { id: CONFIG_ID } });
  if (!row || !row.isEnabled) return null;

  const publicConfig = row.publicConfig as unknown as SystemCloudinaryPublicConfig;
  const secrets = JSON.parse(decryptSecret(row.encryptedSecrets, env.STORAGE_ENCRYPTION_KEY)) as SystemCloudinarySecrets;
  return { ...publicConfig, ...secrets };
}

/** Basic Auth vào Cloudinary Admin API (usage endpoint) — xác nhận cloud name/key/secret khớp nhau thật, không chỉ định dạng hợp lệ. */
export async function testSystemCloudinaryConnection(): Promise<{ ok: boolean; message?: string }> {
  const env = getEnv();
  const prisma = getPrismaClient();
  const row = await prisma.systemCloudinaryConfig.findUnique({ where: { id: CONFIG_ID } });
  if (!row) return { ok: false, message: "Chưa cấu hình Cloudinary." };

  const publicConfig = row.publicConfig as unknown as SystemCloudinaryPublicConfig;
  const secrets = JSON.parse(decryptSecret(row.encryptedSecrets, env.STORAGE_ENCRYPTION_KEY)) as SystemCloudinarySecrets;

  const auth = Buffer.from(`${secrets.apiKey}:${secrets.apiSecret}`).toString("base64");
  const response = await fetch(`https://api.cloudinary.com/v1_1/${publicConfig.cloudName}/usage`, {
    headers: { Authorization: `Basic ${auth}` },
  });

  if (!response.ok) {
    return { ok: false, message: response.status === 401 ? "Sai API Key/API Secret." : `Cloudinary trả lỗi (${response.status}).` };
  }
  await prisma.systemCloudinaryConfig.update({ where: { id: CONFIG_ID }, data: { isEnabled: true, lastVerifiedAt: new Date() } });
  return { ok: true };
}

export interface CloudinaryUploadSignature {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  folder: string;
  signature: string;
}

/**
 * Chữ ký upload trực tiếp (client -> Cloudinary), theo chuẩn signed upload
 * của Cloudinary: sha1(paramsToSign + apiSecret) — apiSecret không bao giờ
 * rời server, chỉ chữ ký + apiKey công khai được gửi cho trình duyệt.
 */
export async function createCloudinaryUploadSignature(): Promise<CloudinaryUploadSignature> {
  const config = await getDecryptedSystemCloudinaryConfig();
  if (!config) {
    throw new AppError({ code: "CLOUDINARY_NOT_CONFIGURED", message: "Cloudinary chưa được cấu hình hoặc đang tắt.", httpStatus: 400 });
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const folder = config.uploadFolder || "gieochu";
  const paramsToSign = `folder=${folder}&timestamp=${timestamp}`;
  const signature = createHash("sha1").update(paramsToSign + config.apiSecret).digest("hex");

  return { cloudName: config.cloudName, apiKey: config.apiKey, timestamp, folder, signature };
}

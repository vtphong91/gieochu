import { decryptSecret, encryptSecret, maskSecret, AppError } from "@gieochu/core";
import { getEnv } from "@gieochu/config";
import { getPrismaClient, Prisma } from "@gieochu/db";
import { verifySmtpConnection } from "@gieochu/email";

const CONFIG_ID = "default";

export interface SystemSmtpPublicConfig {
  host: string;
  port: number;
  /** true = SSL/TLS trực tiếp (port 465), false = STARTTLS (port 587 — mặc định Gmail khuyến nghị). */
  secure: boolean;
  username: string;
  fromName: string;
  fromEmail: string;
  /** Tuỳ chọn — địa chỉ nhận phản hồi nếu khác fromEmail. */
  replyTo?: string;
}

export interface SystemSmtpSecrets {
  /** Gmail: bắt buộc dùng App Password (16 ký tự) — mật khẩu tài khoản thường bị SMTP từ chối vì Google đã tắt "less secure apps". */
  password: string;
}

export interface SaveSystemSmtpConfigInput {
  isEnabled: boolean;
  publicConfig: SystemSmtpPublicConfig;
  /** Blank value keeps the existing secret (§"M7"/M3 convention). */
  secrets: Partial<SystemSmtpSecrets>;
}

function connectionIdentity(cfg: SystemSmtpPublicConfig): unknown {
  return { host: cfg.host, port: cfg.port, secure: cfg.secure, username: cfg.username };
}

/** Cùng cơ chế auto-disable-on-change với R2/Cloudinary/SePay/MoMo (ADR-013) — đổi host/port/username/password luôn tắt cho tới khi admin xác nhận lại. */
export async function saveSystemSmtpConfig(input: SaveSystemSmtpConfigInput): Promise<void> {
  const env = getEnv();
  const prisma = getPrismaClient();

  const existing = await prisma.systemSmtpConfig.findUnique({ where: { id: CONFIG_ID } });
  const existingSecrets = existing
    ? (JSON.parse(decryptSecret(existing.encryptedSecrets, env.STORAGE_ENCRYPTION_KEY)) as Partial<SystemSmtpSecrets>)
    : {};

  const resolvedSecrets: SystemSmtpSecrets = {
    password: input.secrets.password || existingSecrets.password || "",
  };
  if (!resolvedSecrets.password) {
    throw new AppError({ code: "INVALID_SMTP_CONFIG", message: "Thiếu mật khẩu/App Password SMTP.", httpStatus: 400 });
  }

  const identityChanged =
    !existing ||
    JSON.stringify(connectionIdentity(input.publicConfig)) !==
      JSON.stringify(connectionIdentity(existing.publicConfig as unknown as SystemSmtpPublicConfig)) ||
    JSON.stringify(resolvedSecrets) !== JSON.stringify(existingSecrets);

  const isEnabled = identityChanged ? false : input.isEnabled;
  const lastVerifiedAt = identityChanged ? null : (existing?.lastVerifiedAt ?? null);
  const encryptedSecrets = encryptSecret(JSON.stringify(resolvedSecrets), env.STORAGE_ENCRYPTION_KEY);
  const publicConfig = input.publicConfig as unknown as Prisma.InputJsonValue;

  await prisma.systemSmtpConfig.upsert({
    where: { id: CONFIG_ID },
    update: { isEnabled, publicConfig, encryptedSecrets, lastVerifiedAt },
    create: { id: CONFIG_ID, isEnabled, publicConfig, encryptedSecrets, lastVerifiedAt },
  });
}

export interface MaskedSystemSmtpConfig {
  isEnabled: boolean;
  publicConfig: SystemSmtpPublicConfig;
  maskedSecrets: { password: string };
  lastVerifiedAt: Date | null;
}

export async function getSystemSmtpConfig(): Promise<MaskedSystemSmtpConfig | null> {
  const env = getEnv();
  const prisma = getPrismaClient();
  const row = await prisma.systemSmtpConfig.findUnique({ where: { id: CONFIG_ID } });
  if (!row) return null;

  const secrets = JSON.parse(decryptSecret(row.encryptedSecrets, env.STORAGE_ENCRYPTION_KEY)) as SystemSmtpSecrets;
  return {
    isEnabled: row.isEnabled,
    publicConfig: row.publicConfig as unknown as SystemSmtpPublicConfig,
    maskedSecrets: { password: maskSecret(secrets.password) },
    lastVerifiedAt: row.lastVerifiedAt,
  };
}

interface DecryptedSystemSmtpConfig extends SystemSmtpPublicConfig, SystemSmtpSecrets {}

/** Nội bộ — dùng khi gửi email thật (xem lib/email-dispatch.ts), không export ra action/route trực tiếp. */
export async function getDecryptedSystemSmtpConfig(): Promise<DecryptedSystemSmtpConfig | null> {
  const env = getEnv();
  const prisma = getPrismaClient();
  const row = await prisma.systemSmtpConfig.findUnique({ where: { id: CONFIG_ID } });
  if (!row || !row.isEnabled) return null;

  const publicConfig = row.publicConfig as unknown as SystemSmtpPublicConfig;
  const secrets = JSON.parse(decryptSecret(row.encryptedSecrets, env.STORAGE_ENCRYPTION_KEY)) as SystemSmtpSecrets;
  return { ...publicConfig, ...secrets };
}

/** Đăng nhập SMTP thật (không gửi email) — xác nhận host/port/username/password khớp nhau. */
export async function testSystemSmtpConnection(): Promise<{ ok: boolean; message?: string }> {
  const env = getEnv();
  const prisma = getPrismaClient();
  const row = await prisma.systemSmtpConfig.findUnique({ where: { id: CONFIG_ID } });
  if (!row) return { ok: false, message: "Chưa cấu hình SMTP." };

  const publicConfig = row.publicConfig as unknown as SystemSmtpPublicConfig;
  const secrets = JSON.parse(decryptSecret(row.encryptedSecrets, env.STORAGE_ENCRYPTION_KEY)) as SystemSmtpSecrets;

  try {
    await verifySmtpConnection({
      host: publicConfig.host,
      port: publicConfig.port,
      secure: publicConfig.secure,
      auth: { user: publicConfig.username, pass: secrets.password },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không kết nối được SMTP.";
    return { ok: false, message: `Kết nối thất bại: ${message}` };
  }

  await prisma.systemSmtpConfig.update({ where: { id: CONFIG_ID }, data: { isEnabled: true, lastVerifiedAt: new Date() } });
  return { ok: true };
}

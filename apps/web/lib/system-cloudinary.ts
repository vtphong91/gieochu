import { createHash } from "node:crypto";
import { cache } from "react";
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
  /** Thư mục chứa ảnh (thông tin). Với chữ ký có `publicId`, folder đã nằm trong public id — KHÔNG gửi riêng. */
  folder: string;
  signature: string;
  /** Có giá trị → client PHẢI gửi kèm field `allowed_formats` y hệt (nằm trong chữ ký). */
  allowedFormats?: string;
  /** ADR-028: public id đầy đủ do server sinh (nằm trong chữ ký) — chỉ có ở chữ ký ảnh tenant. */
  publicId?: string;
  /** ADR-028: incoming transformation (vd `c_limit,w_2000,h_2000`) nằm trong chữ ký. */
  transformation?: string;
  /**
   * Đúng bộ tham số đã ký (trừ `api_key`/`signature`). Client gửi NGUYÊN VẸN các cặp này cùng `file`,
   * `api_key`, `signature` lên `https://api.cloudinary.com/v1_1/<cloudName>/image/upload`. Thêm/bớt/sửa bất kỳ
   * tham số nào → Cloudinary từ chối chữ ký.
   */
  uploadParams: Record<string, string>;
}

export interface CloudinaryUploadSignatureOptions {
  /** Thư mục con dưới `uploadFolder` hệ thống, vd `tenants/<tenantId>/storefront` (ADR-023). Bỏ qua khi có `publicId`. */
  subfolder?: string;
  /**
   * ADR-028: public id (tương đối với `uploadFolder`, vd `tenants/<id>/content/<ngẫu nhiên>`) ký cố định — một chữ
   * ký chỉ tạo/ghi đè được ĐÚNG một asset (không dùng lại chữ ký để upload hàng loạt vượt hạn mức). Có giá trị thì
   * không ký `folder`: đường dẫn nằm trọn trong public id, cho kết quả như nhau ở chế độ fixed lẫn dynamic folder.
   */
  publicId?: string;
  /** Giới hạn định dạng ảnh Cloudinary chấp nhận — ký vào chữ ký nên client không đổi được. */
  allowedFormats?: readonly string[];
  /** ADR-028: incoming transformation, Cloudinary áp TRƯỚC khi lưu bản gốc (vd giới hạn cạnh dài). */
  transformation?: string;
}

function trimSlashes(value: string): string {
  return value.replace(/^\/+|\/+$/g, "");
}

function uploadRootOf(config: SystemCloudinaryPublicConfig): string {
  return trimSlashes(config.uploadFolder || "gieochu") || "gieochu";
}

/**
 * Chữ ký upload trực tiếp (client -> Cloudinary), theo chuẩn signed upload
 * của Cloudinary: sha1(paramsToSign + apiSecret) — apiSecret không bao giờ
 * rời server, chỉ chữ ký + apiKey công khai được gửi cho trình duyệt.
 * paramsToSign: mọi tham số upload (trừ file, cloud_name, resource_type, api_key) sắp theo thứ tự chữ cái, nối
 * `key=value` bằng `&` — ở đây: allowed_formats, folder | public_id, timestamp, transformation.
 */
export async function createCloudinaryUploadSignature(options: CloudinaryUploadSignatureOptions = {}): Promise<CloudinaryUploadSignature> {
  const config = await getDecryptedSystemCloudinaryConfig();
  if (!config) {
    throw new AppError({ code: "CLOUDINARY_NOT_CONFIGURED", message: "Cloudinary chưa được cấu hình hoặc đang tắt.", httpStatus: 400 });
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const root = uploadRootOf(config);
  const allowedFormats = options.allowedFormats?.length ? options.allowedFormats.join(",") : undefined;

  const params: Record<string, string> = { timestamp: String(timestamp) };
  let folder: string;
  let publicId: string | undefined;
  if (options.publicId) {
    publicId = `${root}/${trimSlashes(options.publicId)}`;
    params.public_id = publicId;
    folder = publicId.slice(0, publicId.lastIndexOf("/"));
  } else {
    folder = options.subfolder ? `${root}/${trimSlashes(options.subfolder)}` : root;
    params.folder = folder;
  }
  if (allowedFormats) params.allowed_formats = allowedFormats;
  if (options.transformation) params.transformation = options.transformation;

  const paramsToSign = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
  const signature = createHash("sha1").update(paramsToSign + config.apiSecret).digest("hex");

  return {
    cloudName: config.cloudName,
    apiKey: config.apiKey,
    timestamp,
    folder,
    signature,
    ...(allowedFormats ? { allowedFormats } : {}),
    ...(publicId ? { publicId } : {}),
    ...(options.transformation ? { transformation: options.transformation } : {}),
    uploadParams: params,
  };
}

export interface SystemCloudinaryLocation {
  cloudName: string;
  /** Thư mục gốc (`uploadFolder`, đã bỏ `/` đầu/cuối, mặc định `gieochu`). */
  uploadRoot: string;
}

/**
 * ADR-028: cloud name + thư mục gốc của Cloudinary hệ thống — đọc CẢ KHI cấu hình đang tắt (ảnh đã lưu vẫn
 * phải hiển thị và lọc đúng cloud). `cache()` gộp trong một request. `null` = chưa từng cấu hình.
 */
export const getSystemCloudinaryLocation = cache(async function getSystemCloudinaryLocation(): Promise<SystemCloudinaryLocation | null> {
  const row = await getPrismaClient().systemCloudinaryConfig.findUnique({ where: { id: CONFIG_ID }, select: { publicConfig: true } });
  if (!row) return null;
  const publicConfig = row.publicConfig as unknown as SystemCloudinaryPublicConfig;
  const cloudName = publicConfig.cloudName?.trim();
  return cloudName ? { cloudName, uploadRoot: uploadRootOf(publicConfig) } : null;
});

/** ADR-028 §5: cloud name hệ thống cho sanitizer / kiểm URL ảnh. `null` = chưa cấu hình → mọi ảnh bị loại. */
export async function getSystemCloudinaryCloudName(): Promise<string | null> {
  return (await getSystemCloudinaryLocation())?.cloudName ?? null;
}

export interface CloudinaryImageResource {
  publicId: string;
  bytes: number;
  format: string | null;
  width: number | null;
  height: number | null;
  secureUrl: string | null;
}

export type CloudinaryResourceLookup =
  | { kind: "found"; resource: CloudinaryImageResource }
  | { kind: "not_found" }
  | { kind: "error"; reason: string };

const ADMIN_API_TIMEOUT_MS = 5000;

function intOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

/**
 * ADR-028: đọc metadata ảnh thật từ Cloudinary Admin API (`GET resources/image/upload/<public_id>`, Basic Auth
 * api_key:api_secret) — nguồn `bytes/format/width/height` duy nhất được tin (không lấy số client gửi). Không ném
 * lỗi mạng/HTTP: trả `error` để caller chọn đường an toàn; `not_found` = Cloudinary xác nhận asset không tồn tại.
 */
export async function fetchCloudinaryImageResource(publicId: string): Promise<CloudinaryResourceLookup> {
  const config = await getDecryptedSystemCloudinaryConfig();
  if (!config) return { kind: "error", reason: "CLOUDINARY_NOT_CONFIGURED" };

  const path = publicId.split("/").map(encodeURIComponent).join("/");
  const auth = Buffer.from(`${config.apiKey}:${config.apiSecret}`).toString("base64");
  let response: Response;
  try {
    response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(config.cloudName)}/resources/image/upload/${path}`, {
      headers: { Authorization: `Basic ${auth}` },
      cache: "no-store",
      signal: AbortSignal.timeout(ADMIN_API_TIMEOUT_MS),
    });
  } catch (error) {
    return { kind: "error", reason: error instanceof Error ? error.name : "FETCH_FAILED" };
  }
  if (response.status === 404) return { kind: "not_found" };
  if (!response.ok) return { kind: "error", reason: `HTTP_${response.status}` };

  let data: Record<string, unknown>;
  try {
    data = ((await response.json()) ?? {}) as Record<string, unknown>;
  } catch {
    return { kind: "error", reason: "INVALID_JSON" };
  }
  const bytes = intOrNull(data.bytes);
  if (bytes === null || bytes < 0 || data.public_id !== publicId) return { kind: "error", reason: "UNEXPECTED_RESPONSE" };
  return {
    kind: "found",
    resource: {
      publicId,
      bytes,
      format: typeof data.format === "string" ? data.format : null,
      width: intOrNull(data.width),
      height: intOrNull(data.height),
      secureUrl: typeof data.secure_url === "string" ? data.secure_url : null,
    },
  };
}


/** Cloudinary hệ thống đang bật (đã cấu hình + xác minh) — để UI Studio báo trước thay vì đợi upload lỗi. */
export async function isSystemCloudinaryReady(): Promise<boolean> {
  const prisma = getPrismaClient();
  const row = await prisma.systemCloudinaryConfig.findUnique({ where: { id: CONFIG_ID }, select: { isEnabled: true } });
  return row?.isEnabled ?? false;
}

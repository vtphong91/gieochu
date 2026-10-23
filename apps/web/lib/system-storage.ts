import { decryptSecret, encryptSecret, maskSecret, AppError } from "@gieochu/core";
import {
  createS3Client,
  ensureBucketExists,
  resolveMinioEndpoint,
  testS3Connection,
  type S3ClientConfig,
  type TestConnectionResult,
} from "@gieochu/storage";
import { getEnv } from "@gieochu/config";
import { getPrismaClient, Prisma } from "@gieochu/db";

export type S3ClientInstance = ReturnType<typeof createS3Client>;

const CONFIG_ID = "default";

export type StorageProvider = "CLOUDFLARE_R2" | "MINIO";

export interface R2Config {
  endpoint: string;
  region: string;
  bucketPrivate: string;
  bucketPublic: string;
  publicBaseUrl?: string;
}

export interface MinioConfig {
  host: string;
  port?: number;
  useSSL: boolean;
  region: string;
  bucketPrefix?: string;
  maxUploadMb?: number;
  publicBaseUrl?: string;
  endpoint?: string;
}

export interface StorageCredentials {
  accessKeyId: string;
  secretAccessKey: string;
}

export interface SystemStoragePublicConfig {
  activeProvider: StorageProvider;
  r2: R2Config;
  minio: MinioConfig;
  // Backward-compatible flattened fields pointing to the active provider
  endpoint: string;
  region: string;
  bucketPrivate: string;
  bucketPublic: string;
  publicBaseUrl?: string;
}

export interface SystemStorageSecrets {
  r2: StorageCredentials;
  minio: StorageCredentials;
  // Backward-compatible flattened credentials for the active provider
  accessKeyId: string;
  secretAccessKey: string;
}

export interface SaveSystemStorageConfigInput {
  isEnabled: boolean;
  activeProvider?: StorageProvider;
  r2?: Partial<R2Config>;
  minio?: Partial<MinioConfig>;
  // Support legacy or flat payload
  publicConfig?: Partial<SystemStoragePublicConfig & R2Config & MinioConfig>;
  secrets?: {
    r2?: Partial<StorageCredentials>;
    minio?: Partial<StorageCredentials>;
    accessKeyId?: string;
    secretAccessKey?: string;
  };
}

export interface MaskedSystemStorageConfig {
  isEnabled: boolean;
  activeProvider: StorageProvider;
  r2: R2Config;
  minio: MinioConfig;
  publicConfig: SystemStoragePublicConfig;
  maskedSecrets: {
    r2: StorageCredentials;
    minio: StorageCredentials;
    accessKeyId: string;
    secretAccessKey: string;
  };
  lastVerifiedAt: Date | null;
}

export interface DecryptedSystemStorageConfig {
  isEnabled: boolean;
  activeProvider: StorageProvider;
  r2: R2Config & StorageCredentials;
  minio: MinioConfig & StorageCredentials;
  endpoint: string;
  region: string;
  bucketPrivate: string;
  bucketPublic: string;
  publicBaseUrl?: string;
  accessKeyId: string;
  secretAccessKey: string;
}

/** Tiền tố bucket gian hàng: tối đa 20 ký tự, chỉ [a-z0-9-], bắt đầu bằng chữ/số. */
export const BUCKET_PREFIX_MAX_LENGTH = 20;
export const BUCKET_PREFIX_PATTERN = "[a-z0-9][a-z0-9\\-]{0,19}";
const BUCKET_PREFIX_REGEX = new RegExp(`^${BUCKET_PREFIX_PATTERN}$`);

export function isValidBucketPrefix(prefix: string): boolean {
  return BUCKET_PREFIX_REGEX.test(prefix);
}

function assertValidBucketPrefix(prefix: string): void {
  if (!isValidBucketPrefix(prefix)) {
    throw new AppError({
      code: "INVALID_STORAGE_CONFIG",
      message: `Tiền tố bucket không hợp lệ: chỉ gồm chữ thường, số, dấu gạch ngang; bắt đầu bằng chữ/số; tối đa ${BUCKET_PREFIX_MAX_LENGTH} ký tự.`,
      httpStatus: 400,
    });
  }
}

function normalizeMinioEndpoint(minio: MinioConfig): string {
  if (minio.endpoint?.trim()) return minio.endpoint.trim();
  if (minio.host?.trim()) {
    return resolveMinioEndpoint({
      host: minio.host,
      port: minio.port,
      useSSL: minio.useSSL,
    });
  }
  return "";
}

/**
 * Parses and normalizes publicConfig from DB or input, ensuring 100% backward
 * compatibility if the stored config was created under the legacy single-R2 schema (ADR-017).
 */
export function normalizePublicStorageConfig(raw: Record<string, unknown> | null | undefined): SystemStoragePublicConfig {
  const activeProvider: StorageProvider =
    raw?.activeProvider === "MINIO" ? "MINIO" : "CLOUDFLARE_R2";

  const rawR2 = (raw?.r2 as Record<string, unknown> | undefined) || {};
  const r2: R2Config = {
    endpoint: String(rawR2.endpoint ?? raw?.endpoint ?? "").trim(),
    region: String(rawR2.region ?? raw?.region ?? "auto").trim() || "auto",
    bucketPrivate: String(rawR2.bucketPrivate ?? raw?.bucketPrivate ?? "").trim(),
    bucketPublic: String(rawR2.bucketPublic ?? raw?.bucketPublic ?? "").trim(),
    publicBaseUrl: rawR2.publicBaseUrl ? String(rawR2.publicBaseUrl).trim() : (raw?.publicBaseUrl ? String(raw?.publicBaseUrl).trim() : undefined),
  };

  const rawMinio = (raw?.minio as Record<string, unknown> | undefined) || {};
  const minio: MinioConfig = {
    host: String(rawMinio.host ?? "").trim(),
    port: rawMinio.port !== undefined && rawMinio.port !== null && rawMinio.port !== "" ? Number(rawMinio.port) : 9000,
    useSSL: Boolean(rawMinio.useSSL),
    region: String(rawMinio.region ?? "us-east-1").trim() || "us-east-1",
    bucketPrefix: String(rawMinio.bucketPrefix ?? "gc-").trim() || "gc-",
    maxUploadMb: rawMinio.maxUploadMb ? Number(rawMinio.maxUploadMb) : 500,
    publicBaseUrl: rawMinio.publicBaseUrl ? String(rawMinio.publicBaseUrl).trim() : undefined,
  };
  minio.endpoint = normalizeMinioEndpoint(minio);

  const prefix = minio.bucketPrefix || "gc-";
  const minioBucketPrivate = `${prefix}private`;
  const minioBucketPublic = `${prefix}public`;

  const flattenedEndpoint = activeProvider === "MINIO" ? minio.endpoint : r2.endpoint;
  const flattenedRegion = activeProvider === "MINIO" ? minio.region : r2.region;
  const flattenedBucketPrivate = activeProvider === "MINIO" ? minioBucketPrivate : r2.bucketPrivate;
  const flattenedBucketPublic = activeProvider === "MINIO" ? minioBucketPublic : r2.bucketPublic;
  const flattenedPublicBaseUrl = activeProvider === "MINIO" ? minio.publicBaseUrl : r2.publicBaseUrl;

  return {
    activeProvider,
    r2,
    minio,
    endpoint: flattenedEndpoint,
    region: flattenedRegion,
    bucketPrivate: flattenedBucketPrivate,
    bucketPublic: flattenedBucketPublic,
    publicBaseUrl: flattenedPublicBaseUrl,
  };
}

/**
 * Normalizes stored secrets with fallback for legacy single-credential data.
 */
export function normalizeSecrets(
  raw: Record<string, unknown> | null | undefined,
  activeProvider: StorageProvider,
): SystemStorageSecrets {
  const rawR2 = (raw?.r2 as Record<string, unknown> | undefined) || {};
  const rawMinio = (raw?.minio as Record<string, unknown> | undefined) || {};

  const r2: StorageCredentials = {
    accessKeyId: String(rawR2.accessKeyId ?? raw?.accessKeyId ?? "").trim(),
    secretAccessKey: String(rawR2.secretAccessKey ?? raw?.secretAccessKey ?? "").trim(),
  };

  const minio: StorageCredentials = {
    accessKeyId: String(rawMinio.accessKeyId ?? "").trim(),
    secretAccessKey: String(rawMinio.secretAccessKey ?? "").trim(),
  };

  const activeCredentials = activeProvider === "MINIO" ? minio : r2;

  return {
    r2,
    minio,
    accessKeyId: activeCredentials.accessKeyId,
    secretAccessKey: activeCredentials.secretAccessKey,
  };
}

function connectionIdentity(cfg: SystemStoragePublicConfig, secrets: SystemStorageSecrets): string {
  return JSON.stringify({
    activeProvider: cfg.activeProvider,
    r2: {
      endpoint: cfg.r2.endpoint,
      region: cfg.r2.region,
      bucketPrivate: cfg.r2.bucketPrivate,
      bucketPublic: cfg.r2.bucketPublic,
      accessKeyId: secrets.r2.accessKeyId,
      secretAccessKey: secrets.r2.secretAccessKey,
    },
    minio: {
      host: cfg.minio.host,
      port: cfg.minio.port,
      useSSL: cfg.minio.useSSL,
      region: cfg.minio.region,
      bucketPrefix: cfg.minio.bucketPrefix,
      accessKeyId: secrets.minio.accessKeyId,
      secretAccessKey: secrets.minio.secretAccessKey,
    },
  });
}

/**
 * Saves storage configuration supporting both Cloudflare R2 and MinIO.
 * Automatically handles backward compatibility with single-provider inputs.
 */
export async function saveSystemStorageConfig(input: SaveSystemStorageConfigInput): Promise<void> {
  const env = getEnv();
  const prisma = getPrismaClient();

  const existingRow = await prisma.systemStorageConfig.findUnique({ where: { id: CONFIG_ID } });
  const existingPublicConfig = existingRow
    ? normalizePublicStorageConfig(existingRow.publicConfig as Record<string, unknown>)
    : null;

  let existingSecrets: SystemStorageSecrets = {
    r2: { accessKeyId: "", secretAccessKey: "" },
    minio: { accessKeyId: "", secretAccessKey: "" },
    accessKeyId: "",
    secretAccessKey: "",
  };

  if (existingRow?.encryptedSecrets) {
    try {
      const decrypted = JSON.parse(decryptSecret(existingRow.encryptedSecrets, env.STORAGE_ENCRYPTION_KEY));
      existingSecrets = normalizeSecrets(decrypted, existingPublicConfig?.activeProvider ?? "CLOUDFLARE_R2");
    } catch {
      // ignore decryption errors for non-existent or corrupted secrets
    }
  }

  // Determine active provider
  const activeProvider: StorageProvider =
    input.activeProvider ||
    input.publicConfig?.activeProvider ||
    existingPublicConfig?.activeProvider ||
    "CLOUDFLARE_R2";

  // Build merged public config
  const legacyFlat = input.publicConfig || {};
  const mergedRaw: Record<string, unknown> = {
    activeProvider,
    r2: {
      endpoint: input.r2?.endpoint ?? legacyFlat.endpoint ?? existingPublicConfig?.r2.endpoint ?? "",
      region: input.r2?.region ?? legacyFlat.region ?? existingPublicConfig?.r2.region ?? "auto",
      bucketPrivate: input.r2?.bucketPrivate ?? legacyFlat.bucketPrivate ?? existingPublicConfig?.r2.bucketPrivate ?? "",
      bucketPublic: input.r2?.bucketPublic ?? legacyFlat.bucketPublic ?? existingPublicConfig?.r2.bucketPublic ?? "",
      publicBaseUrl: input.r2?.publicBaseUrl ?? legacyFlat.publicBaseUrl ?? existingPublicConfig?.r2.publicBaseUrl,
    },
    minio: {
      host: input.minio?.host ?? legacyFlat.host ?? existingPublicConfig?.minio.host ?? "",
      port: input.minio?.port ?? legacyFlat.port ?? existingPublicConfig?.minio.port ?? 9000,
      useSSL: input.minio?.useSSL ?? legacyFlat.useSSL ?? existingPublicConfig?.minio.useSSL ?? false,
      region: input.minio?.region ?? legacyFlat.region ?? existingPublicConfig?.minio.region ?? "us-east-1",
      bucketPrefix: input.minio?.bucketPrefix ?? legacyFlat.bucketPrefix ?? existingPublicConfig?.minio.bucketPrefix ?? "gc-",
      maxUploadMb: input.minio?.maxUploadMb ?? legacyFlat.maxUploadMb ?? existingPublicConfig?.minio.maxUploadMb ?? 500,
      publicBaseUrl: input.minio?.publicBaseUrl ?? legacyFlat.publicBaseUrl ?? existingPublicConfig?.minio.publicBaseUrl,
    },
  };

  // Chỉ kiểm tra giá trị người dùng vừa nhập; dữ liệu cũ không hợp lệ không chặn việc đọc cấu hình
  // (sẽ báo lỗi khi tạo bucket gian hàng mới).
  const submittedPrefix = input.minio?.bucketPrefix ?? legacyFlat.bucketPrefix;
  if (submittedPrefix !== undefined) assertValidBucketPrefix(submittedPrefix.trim());

  const normalizedPublic = normalizePublicStorageConfig(mergedRaw);

  // Merge secrets
  const r2Key = input.secrets?.r2?.accessKeyId || (input.secrets?.accessKeyId && activeProvider === "CLOUDFLARE_R2" ? input.secrets.accessKeyId : existingSecrets.r2.accessKeyId);
  const r2Secret = input.secrets?.r2?.secretAccessKey || (input.secrets?.secretAccessKey && activeProvider === "CLOUDFLARE_R2" ? input.secrets.secretAccessKey : existingSecrets.r2.secretAccessKey);

  const minioKey = input.secrets?.minio?.accessKeyId || (input.secrets?.accessKeyId && activeProvider === "MINIO" ? input.secrets.accessKeyId : existingSecrets.minio.accessKeyId);
  const minioSecret = input.secrets?.minio?.secretAccessKey || (input.secrets?.secretAccessKey && activeProvider === "MINIO" ? input.secrets.secretAccessKey : existingSecrets.minio.secretAccessKey);

  const resolvedSecrets: SystemStorageSecrets = {
    r2: {
      accessKeyId: r2Key?.trim() ?? "",
      secretAccessKey: r2Secret?.trim() ?? "",
    },
    minio: {
      accessKeyId: minioKey?.trim() ?? "",
      secretAccessKey: minioSecret?.trim() ?? "",
    },
    accessKeyId: (activeProvider === "MINIO" ? minioKey : r2Key)?.trim() ?? "",
    secretAccessKey: (activeProvider === "MINIO" ? minioSecret : r2Secret)?.trim() ?? "",
  };

  // Validate active provider credentials
  const activeCreds = activeProvider === "MINIO" ? resolvedSecrets.minio : resolvedSecrets.r2;
  if (!activeCreds.accessKeyId || !activeCreds.secretAccessKey) {
    throw new AppError({
      code: "INVALID_STORAGE_CONFIG",
      message: `Thiếu Access Key ID / Secret Access Key cho nền tảng ${activeProvider}.`,
      httpStatus: 400,
    });
  }

  const identityChanged =
    !existingPublicConfig ||
    connectionIdentity(normalizedPublic, resolvedSecrets) !==
      connectionIdentity(existingPublicConfig, existingSecrets);

  const isEnabled = identityChanged ? false : input.isEnabled;
  const lastVerifiedAt = identityChanged ? null : (existingRow?.lastVerifiedAt ?? null);
  const encryptedSecrets = encryptSecret(JSON.stringify(resolvedSecrets), env.STORAGE_ENCRYPTION_KEY);
  const publicConfig = normalizedPublic as unknown as Prisma.InputJsonValue;

  await prisma.systemStorageConfig.upsert({
    where: { id: CONFIG_ID },
    update: { isEnabled, publicConfig, encryptedSecrets, lastVerifiedAt },
    create: { id: CONFIG_ID, isEnabled, publicConfig, encryptedSecrets, lastVerifiedAt },
  });
}

/**
 * Returns masked storage config safe for display in admin UI.
 */
export async function getSystemStorageConfig(): Promise<MaskedSystemStorageConfig | null> {
  const env = getEnv();
  const prisma = getPrismaClient();
  const row = await prisma.systemStorageConfig.findUnique({ where: { id: CONFIG_ID } });
  if (!row) return null;

  const publicConfig = normalizePublicStorageConfig(row.publicConfig as Record<string, unknown>);
  let secrets: SystemStorageSecrets = {
    r2: { accessKeyId: "", secretAccessKey: "" },
    minio: { accessKeyId: "", secretAccessKey: "" },
    accessKeyId: "",
    secretAccessKey: "",
  };

  try {
    const decrypted = JSON.parse(decryptSecret(row.encryptedSecrets, env.STORAGE_ENCRYPTION_KEY));
    secrets = normalizeSecrets(decrypted, publicConfig.activeProvider);
  } catch {
    // ignore
  }

  return {
    isEnabled: row.isEnabled,
    activeProvider: publicConfig.activeProvider,
    r2: publicConfig.r2,
    minio: publicConfig.minio,
    publicConfig,
    maskedSecrets: {
      r2: {
        accessKeyId: maskSecret(secrets.r2.accessKeyId),
        secretAccessKey: maskSecret(secrets.r2.secretAccessKey),
      },
      minio: {
        accessKeyId: maskSecret(secrets.minio.accessKeyId),
        secretAccessKey: maskSecret(secrets.minio.secretAccessKey),
      },
      accessKeyId: maskSecret(secrets.accessKeyId),
      secretAccessKey: maskSecret(secrets.secretAccessKey),
    },
    lastVerifiedAt: row.lastVerifiedAt,
  };
}

/**
 * Server-only: returns the full decrypted config for the active provider.
 * Returns null if not configured or not enabled.
 */
export async function getDecryptedSystemStorageConfig(): Promise<DecryptedSystemStorageConfig | null> {
  const env = getEnv();
  const prisma = getPrismaClient();
  const row = await prisma.systemStorageConfig.findUnique({ where: { id: CONFIG_ID } });
  if (!row || !row.isEnabled) return null;

  const publicConfig = normalizePublicStorageConfig(row.publicConfig as Record<string, unknown>);
  let secrets: SystemStorageSecrets = {
    r2: { accessKeyId: "", secretAccessKey: "" },
    minio: { accessKeyId: "", secretAccessKey: "" },
    accessKeyId: "",
    secretAccessKey: "",
  };

  try {
    const decrypted = JSON.parse(decryptSecret(row.encryptedSecrets, env.STORAGE_ENCRYPTION_KEY));
    secrets = normalizeSecrets(decrypted, publicConfig.activeProvider);
  } catch {
    return null;
  }

  return {
    isEnabled: row.isEnabled,
    activeProvider: publicConfig.activeProvider,
    r2: { ...publicConfig.r2, ...secrets.r2 },
    minio: { ...publicConfig.minio, ...secrets.minio },
    endpoint: publicConfig.endpoint,
    region: publicConfig.region,
    bucketPrivate: publicConfig.bucketPrivate,
    bucketPublic: publicConfig.bucketPublic,
    publicBaseUrl: publicConfig.publicBaseUrl,
    accessKeyId: secrets.accessKeyId,
    secretAccessKey: secrets.secretAccessKey,
  };
}

/**
 * Creates an S3Client for a specific provider using the saved credentials.
 */
export async function createClientForProvider(
  provider: StorageProvider,
): Promise<{ client: S3ClientInstance; config: S3ClientConfig; publicBaseUrl?: string; bucketPrefix?: string }> {
  const env = getEnv();
  const prisma = getPrismaClient();
  const row = await prisma.systemStorageConfig.findUnique({ where: { id: CONFIG_ID } });
  if (!row) {
    throw new AppError({ code: "STORAGE_NOT_CONFIGURED", message: "Chưa cấu hình lưu trữ.", httpStatus: 503 });
  }

  const publicConfig = normalizePublicStorageConfig(row.publicConfig as Record<string, unknown>);
  const decrypted = JSON.parse(decryptSecret(row.encryptedSecrets, env.STORAGE_ENCRYPTION_KEY));
  const secrets = normalizeSecrets(decrypted, publicConfig.activeProvider);

  if (provider === "MINIO") {
    const endpoint = publicConfig.minio.endpoint || resolveMinioEndpoint(publicConfig.minio);
    const clientConfig: S3ClientConfig = {
      endpoint,
      region: publicConfig.minio.region || "us-east-1",
      accessKeyId: secrets.minio.accessKeyId,
      secretAccessKey: secrets.minio.secretAccessKey,
    };
    return {
      client: createS3Client(clientConfig),
      config: clientConfig,
      publicBaseUrl: publicConfig.minio.publicBaseUrl,
      bucketPrefix: publicConfig.minio.bucketPrefix,
    };
  }

  const clientConfig: S3ClientConfig = {
    endpoint: publicConfig.r2.endpoint,
    region: publicConfig.r2.region || "auto",
    accessKeyId: secrets.r2.accessKeyId,
    secretAccessKey: secrets.r2.secretAccessKey,
  };
  return {
    client: createS3Client(clientConfig),
    config: clientConfig,
    publicBaseUrl: publicConfig.r2.publicBaseUrl,
  };
}

/**
 * Tests connection to a specified provider (or the active provider).
 * Supports testing CLOUDFLARE_R2, MINIO, or BOTH.
 */
export async function testSystemStorageConnection(
  targetProvider?: StorageProvider | "ALL",
): Promise<TestConnectionResult> {
  const env = getEnv();
  const prisma = getPrismaClient();
  const row = await prisma.systemStorageConfig.findUnique({ where: { id: CONFIG_ID } });
  if (!row) {
    return { ok: false, message: "Chưa cấu hình storage." };
  }

  const publicConfig = normalizePublicStorageConfig(row.publicConfig as Record<string, unknown>);
  let secrets: SystemStorageSecrets;
  try {
    const decrypted = JSON.parse(decryptSecret(row.encryptedSecrets, env.STORAGE_ENCRYPTION_KEY));
    secrets = normalizeSecrets(decrypted, publicConfig.activeProvider);
  } catch (error) {
    return { ok: false, message: `Không giải mã được secret: ${error instanceof Error ? error.message : "Lỗi bí mật"}` };
  }

  const providerToTest = targetProvider || publicConfig.activeProvider;

  // Test R2
  const testR2 = async (): Promise<TestConnectionResult> => {
    if (!publicConfig.r2.endpoint || !secrets.r2.accessKeyId || !secrets.r2.secretAccessKey) {
      return { ok: false, message: "R2 chưa được điền đủ thông tin (endpoint, keys)." };
    }
    const client = createS3Client({
      endpoint: publicConfig.r2.endpoint,
      region: publicConfig.r2.region,
      accessKeyId: secrets.r2.accessKeyId,
      secretAccessKey: secrets.r2.secretAccessKey,
    });
    return testS3Connection(client, {
      bucketPrivate: publicConfig.r2.bucketPrivate,
      bucketPublic: publicConfig.r2.bucketPublic,
    });
  };

  // Test MinIO
  const testMinio = async (): Promise<TestConnectionResult> => {
    const endpoint = publicConfig.minio.endpoint || resolveMinioEndpoint(publicConfig.minio);
    if (!endpoint || !secrets.minio.accessKeyId || !secrets.minio.secretAccessKey) {
      return { ok: false, message: "MinIO chưa được điền đủ thông tin (host, keys)." };
    }
    const client = createS3Client({
      endpoint,
      region: publicConfig.minio.region || "us-east-1",
      accessKeyId: secrets.minio.accessKeyId,
      secretAccessKey: secrets.minio.secretAccessKey,
    });
    const prefix = publicConfig.minio.bucketPrefix || "gc-";
    const privateBucket = `${prefix}private`;
    const publicBucket = `${prefix}public`;

    try {
      // Ensure private & public system buckets exist on MinIO
      await ensureBucketExists(client, privateBucket);
      await ensureBucketExists(client, publicBucket);
      return { ok: true, message: `Kết nối MinIO thành công (${endpoint}).` };
    } catch (error) {
      return { ok: false, message: `Lỗi kết nối MinIO: ${error instanceof Error ? error.message : String(error)}` };
    }
  };

  let result: TestConnectionResult;
  if (providerToTest === "ALL") {
    const r2Res = await testR2();
    const minioRes = await testMinio();
    if (!r2Res.ok) {
      result = { ok: false, message: `Lỗi R2: ${r2Res.message}` };
    } else if (!minioRes.ok) {
      result = { ok: false, message: `Lỗi MinIO: ${minioRes.message}` };
    } else {
      result = { ok: true, message: "Kết nối thành công cả Cloudflare R2 và MinIO." };
    }
  } else if (providerToTest === "MINIO") {
    result = await testMinio();
  } else {
    result = await testR2();
  }

  if (result.ok) {
    await prisma.systemStorageConfig.update({
      where: { id: CONFIG_ID },
      data: { isEnabled: true, lastVerifiedAt: new Date() },
    });
  }

  return result;
}

export interface RawStorageTestInput {
  provider: StorageProvider;
  // R2 parameters
  r2Endpoint?: string;
  r2Region?: string;
  r2BucketPrivate?: string;
  r2BucketPublic?: string;
  r2AccessKeyId?: string;
  r2SecretAccessKey?: string;
  // MinIO parameters
  minioHost?: string;
  minioPort?: number;
  minioUseSSL?: boolean;
  minioRegion?: string;
  minioBucketPrefix?: string;
  minioAccessKeyId?: string;
  minioSecretAccessKey?: string;
  // Generic / legacy fallback parameters
  endpoint?: string;
  region?: string;
  bucketPrivate?: string;
  bucketPublic?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
}

/**
 * Tests connection directly from raw input parameters without requiring a prior
 * DB record, falling back to stored secrets only if the input secrets are omitted.
 */
export async function testRawStorageConnection(
  input: RawStorageTestInput,
): Promise<TestConnectionResult> {
  const env = getEnv();
  const prisma = getPrismaClient();

  // Read existing row to fallback on saved secrets if empty in form
  const existingRow = await prisma.systemStorageConfig.findUnique({ where: { id: CONFIG_ID } });
  let existingSecrets: SystemStorageSecrets = {
    r2: { accessKeyId: "", secretAccessKey: "" },
    minio: { accessKeyId: "", secretAccessKey: "" },
    accessKeyId: "",
    secretAccessKey: "",
  };
  let existingPublic: SystemStoragePublicConfig | null = null;

  if (existingRow) {
    existingPublic = normalizePublicStorageConfig(existingRow.publicConfig as Record<string, unknown>);
    if (existingRow.encryptedSecrets) {
      try {
        const decrypted = JSON.parse(decryptSecret(existingRow.encryptedSecrets, env.STORAGE_ENCRYPTION_KEY));
        existingSecrets = normalizeSecrets(decrypted, existingPublic.activeProvider);
      } catch {
        // ignore decryption error
      }
    }
  }

  if (input.provider === "MINIO") {
    const host = (input.minioHost || input.endpoint || existingPublic?.minio.host || "").trim();
    if (!host) {
      return { ok: false, message: "Vui lòng nhập Host hoặc IP của MinIO." };
    }

    const port =
      input.minioPort !== undefined && input.minioPort !== null && !isNaN(input.minioPort)
        ? input.minioPort
        : (existingPublic?.minio.port ?? 9000);
    const useSSL =
      input.minioUseSSL !== undefined ? input.minioUseSSL : (existingPublic?.minio.useSSL ?? false);
    const region = (input.minioRegion || existingPublic?.minio.region || "us-east-1").trim();
    const prefix = (input.minioBucketPrefix || existingPublic?.minio.bucketPrefix || "gc-").trim();
    if (!isValidBucketPrefix(prefix)) {
      return {
        ok: false,
        message: `Tiền tố bucket không hợp lệ: chỉ gồm chữ thường, số, dấu gạch ngang; bắt đầu bằng chữ/số; tối đa ${BUCKET_PREFIX_MAX_LENGTH} ký tự.`,
      };
    }

    const accessKeyId = (
      input.minioAccessKeyId ||
      input.accessKeyId ||
      existingSecrets.minio.accessKeyId ||
      ""
    ).trim();
    const secretAccessKey = (
      input.minioSecretAccessKey ||
      input.secretAccessKey ||
      existingSecrets.minio.secretAccessKey ||
      ""
    ).trim();

    if (!accessKeyId || !secretAccessKey) {
      return { ok: false, message: "Thiếu Access Key ID hoặc Secret Access Key cho MinIO." };
    }

    const endpoint = resolveMinioEndpoint({ host, port, useSSL });
    const client = createS3Client({
      endpoint,
      region,
      accessKeyId,
      secretAccessKey,
    });

    const privateBucket = `${prefix}private`;
    const publicBucket = `${prefix}public`;

    try {
      await ensureBucketExists(client, privateBucket);
      await ensureBucketExists(client, publicBucket);
      return { ok: true, message: `Kết nối MinIO thành công (${endpoint}).` };
    } catch (error) {
      return {
        ok: false,
        message: `Lỗi kết nối MinIO: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  // Provider is CLOUDFLARE_R2
  const endpoint = (input.r2Endpoint || input.endpoint || existingPublic?.r2.endpoint || "").trim();
  if (!endpoint) {
    return { ok: false, message: "Vui lòng nhập Endpoint Cloudflare R2." };
  }

  const region = (input.r2Region || input.region || existingPublic?.r2.region || "auto").trim();
  const bucketPrivate = (
    input.r2BucketPrivate ||
    input.bucketPrivate ||
    existingPublic?.r2.bucketPrivate ||
    ""
  ).trim();
  const bucketPublic = (
    input.r2BucketPublic ||
    input.bucketPublic ||
    existingPublic?.r2.bucketPublic ||
    ""
  ).trim();

  if (!bucketPrivate || !bucketPublic) {
    return { ok: false, message: "Vui lòng nhập đầy đủ tên Bucket Private và Bucket Public của R2." };
  }

  const accessKeyId = (
    input.r2AccessKeyId ||
    input.accessKeyId ||
    existingSecrets.r2.accessKeyId ||
    ""
  ).trim();
  const secretAccessKey = (
    input.r2SecretAccessKey ||
    input.secretAccessKey ||
    existingSecrets.r2.secretAccessKey ||
    ""
  ).trim();

  if (!accessKeyId || !secretAccessKey) {
    return { ok: false, message: "Thiếu Access Key ID hoặc Secret Access Key cho Cloudflare R2." };
  }

  const client = createS3Client({
    endpoint,
    region,
    accessKeyId,
    secretAccessKey,
  });

  return testS3Connection(client, { bucketPrivate, bucketPublic });
}

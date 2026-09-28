import { randomBytes } from "node:crypto";
import { AppError, isCloudinaryImageUrl, logger } from "@gieochu/core";
import { getPrismaClient, withTenant, type TenantMediaUsage } from "@gieochu/db";
import {
  createCloudinaryUploadSignature,
  fetchCloudinaryImageResource,
  getSystemCloudinaryLocation,
  type CloudinaryImageResource,
  type CloudinaryUploadSignature,
} from "./system-cloudinary";

/**
 * ADR-028 — ảnh tenant trên Cloudinary HỆ THỐNG: hạn mức theo gói (`Plan.imageStorageMb`, cộng chung ảnh mô tả
 * + ảnh bìa + ảnh storefront) và sổ ghi nhận `tenant_media_assets` (L2, RLS — mọi truy vấn qua `withTenant`).
 *
 * Luồng:
 * 1. `createTenantImageUploadSignature` — kiểm hạn mức, sinh `public_id` ngẫu nhiên trong folder của tenant, ký
 *    (public_id + allowed_formats + incoming transformation), rồi GIỮ CHỖ một dòng `bytes` tạm tính
 *    (`verifiedAt = null`). Một chữ ký chỉ tạo/ghi đè đúng một asset, và mọi chữ ký đã cấp đều bị tính vào hạn mức
 *    kể cả khi client không bao giờ gọi bước 2 → không lách hạn mức bằng cách "upload rồi không báo".
 * 2. `registerTenantImage` — sau khi upload xong, server tự hỏi Cloudinary Admin API số `bytes/format/width/height`
 *    thật (không tin client) và cập nhật dòng. Admin API lỗi → giữ mức tạm tính, trả URL dựng từ public id.
 * 3. Dòng giữ chỗ quá hạn chữ ký (1 giờ) chưa xác minh được đối soát lười ở lần xin chữ ký sau (bước 1): Cloudinary
 *    báo không có → xoá (upload bị bỏ dở không ăn hạn mức mãi); có → ghi số thật.
 */

/** Ảnh tenant: png/jpg/webp (không SVG — nội dung do tenant upload, hiển thị công khai; không GIF ở GĐ1). */
export const TENANT_IMAGE_FORMATS = ["png", "jpg", "jpeg", "webp"] as const;
/** Incoming transformation: Cloudinary thu cạnh dài về ≤2000px TRƯỚC khi lưu bản gốc (không phóng ảnh nhỏ). */
export const TENANT_IMAGE_INCOMING_TRANSFORMATION = "c_limit,w_2000,h_2000";
/**
 * Mức tạm tính cho một ảnh chưa xác minh (giữ chỗ lúc ký, hoặc Admin API lỗi lúc ghi nhận): 5MB — bằng trần ảnh
 * lớn nhất UI cho chọn (ảnh bìa) nên đa số ảnh thật nhỏ hơn; đủ để số ảnh "chưa báo" bị chặn bởi hạn mức gói.
 */
export const UNVERIFIED_IMAGE_BYTES = 5 * 1024 * 1024;
/** Cloudinary chỉ chấp nhận chữ ký có `timestamp` trong vòng 1 giờ — quá mốc này asset giữ chỗ không thể đổi nữa. */
const SIGNATURE_VALIDITY_MS = 60 * 60 * 1000;
/** Số dòng giữ chỗ quá hạn đối soát mỗi lần xin chữ ký — chặn trên số lần gọi Admin API (có rate limit). */
const RECONCILE_BATCH = 3;

const USAGE_SUBFOLDER: Record<TenantMediaUsage, string> = {
  CONTENT: "content",
  PRODUCT_COVER: "products",
  STOREFRONT: "storefront",
  // ADR-029 mục 5 (M10b): ảnh trong bài viết — cùng hạn mức ảnh của gói.
  POST: "posts",
};
/** Tên file do server sinh: 24 ký tự hex (12 byte ngẫu nhiên). */
const ASSET_NAME = /^[a-f0-9]{24}$/;

export const TENANT_MEDIA_USAGES = Object.keys(USAGE_SUBFOLDER) as TenantMediaUsage[];

export function isTenantMediaUsage(value: unknown): value is TenantMediaUsage {
  return typeof value === "string" && (TENANT_MEDIA_USAGES as string[]).includes(value);
}

/** Folder tương đối với `uploadFolder` hệ thống: `tenants/<tenantId>/<content|products|storefront|posts>`. */
export function tenantImageFolder(tenantId: string, usage: TenantMediaUsage): string {
  return `tenants/${tenantId}/${USAGE_SUBFOLDER[usage]}`;
}

export interface TenantImageQuota {
  usedBytes: number;
  limitBytes: number;
  limitMb: number;
}

/** Gói hiện tại xác định giống `assertPlanLimit` (subscription của tenant → plan). */
export async function getTenantImageQuota(tenantId: string): Promise<TenantImageQuota> {
  const subscription = await getPrismaClient().subscription.findUniqueOrThrow({
    where: { tenantId },
    select: { plan: { select: { imageStorageMb: true } } },
  });
  const aggregate = await withTenant(tenantId, (tx) => tx.tenantMediaAsset.aggregate({ where: { tenantId }, _sum: { bytes: true } }));
  const limitMb = subscription.plan.imageStorageMb;
  return { usedBytes: aggregate._sum.bytes ?? 0, limitBytes: limitMb * 1024 * 1024, limitMb };
}

function formatQuota(limitMb: number): string {
  return limitMb >= 1024 && limitMb % 1024 === 0 ? `${limitMb / 1024}GB` : `${limitMb}MB`;
}

async function applyVerifiedResource(tenantId: string, usage: TenantMediaUsage, resource: CloudinaryImageResource): Promise<void> {
  const verified = {
    bytes: resource.bytes,
    format: resource.format,
    width: resource.width,
    height: resource.height,
    verifiedAt: new Date(),
  };
  await withTenant(tenantId, (tx) =>
    tx.tenantMediaAsset.upsert({
      where: { publicId: resource.publicId },
      create: { tenantId, publicId: resource.publicId, usage, ...verified },
      update: verified,
    }),
  );
}

/** Bước 3 ở đầu file: đối soát lười các dòng giữ chỗ đã quá hạn chữ ký. Admin API lỗi → dừng, để lần sau. */
async function reconcileStaleReservations(tenantId: string): Promise<void> {
  const cutoff = new Date(Date.now() - SIGNATURE_VALIDITY_MS);
  const stale = await withTenant(tenantId, (tx) =>
    tx.tenantMediaAsset.findMany({
      where: { tenantId, verifiedAt: null, createdAt: { lt: cutoff } },
      orderBy: { createdAt: "asc" },
      take: RECONCILE_BATCH,
      select: { publicId: true, usage: true },
    }),
  );
  for (const row of stale) {
    const lookup = await fetchCloudinaryImageResource(row.publicId);
    if (lookup.kind === "error") {
      logger.warn({ tenantId, publicId: row.publicId, reason: lookup.reason }, "tenant-media: reconcile skipped (Cloudinary Admin API error)");
      return;
    }
    if (lookup.kind === "not_found") {
      await withTenant(tenantId, (tx) => tx.tenantMediaAsset.deleteMany({ where: { tenantId, publicId: row.publicId } }));
    } else {
      await applyVerifiedResource(tenantId, row.usage, lookup.resource);
    }
  }
}

/**
 * ADR-028 — chữ ký upload ảnh cho tenant (dùng chung cho ảnh mô tả, ảnh bìa, ảnh storefront). Vượt hạn mức →
 * `AppError IMAGE_QUOTA_EXCEEDED` (không cấp chữ ký). Caller phải đã `requireTenantMember` và truyền `tenant.id`
 * lấy từ đó (không từ client).
 */
export async function createTenantImageUploadSignature(tenantId: string, usage: TenantMediaUsage): Promise<CloudinaryUploadSignature> {
  await reconcileStaleReservations(tenantId);

  const quota = await getTenantImageQuota(tenantId);
  if (quota.usedBytes >= quota.limitBytes) {
    throw new AppError({
      code: "IMAGE_QUOTA_EXCEEDED",
      message: `Đã dùng hết ${formatQuota(quota.limitMb)} dung lượng ảnh của gói hiện tại. Hãy xoá bớt ảnh không dùng hoặc nâng cấp gói để tải thêm ảnh.`,
      httpStatus: 403,
    });
  }

  const name = randomBytes(12).toString("hex");
  const signature = await createCloudinaryUploadSignature({
    publicId: `${tenantImageFolder(tenantId, usage)}/${name}`,
    allowedFormats: TENANT_IMAGE_FORMATS,
    transformation: TENANT_IMAGE_INCOMING_TRANSFORMATION,
  });
  const publicId = signature.publicId;
  if (!publicId) throw new AppError({ code: "INTERNAL_ERROR", message: "Thiếu public id trong chữ ký upload.", httpStatus: 500, expose: false });

  await withTenant(tenantId, (tx) =>
    tx.tenantMediaAsset.create({ data: { tenantId, publicId, bytes: UNVERIFIED_IMAGE_BYTES, usage } }),
  );
  return signature;
}

export interface RegisteredTenantImage {
  /** `secure_url` Cloudinary (đã kiểm đúng cloud hệ thống) — URL gốc để lưu DB; hiển thị qua `cloudinaryDeliveryUrl`. */
  url: string;
  /** false = Admin API lỗi, dung lượng đang tính theo mức tạm `UNVERIFIED_IMAGE_BYTES`. */
  verified: boolean;
}

/**
 * ADR-028 — ghi nhận ảnh sau khi client upload xong. `publicId` phải đúng dạng server đã ký cho tenant này và mục
 * đích này (`<uploadRoot>/tenants/<tenantId>/<folder>/<24 hex>`), ngoài ra → `INVALID_IMAGE_PUBLIC_ID`.
 * Số liệu lấy từ Cloudinary Admin API, không từ client.
 */
export async function registerTenantImage(tenantId: string, publicId: string, usage: TenantMediaUsage): Promise<RegisteredTenantImage> {
  const location = await getSystemCloudinaryLocation();
  if (!location) {
    throw new AppError({ code: "CLOUDINARY_NOT_CONFIGURED", message: "Cloudinary chưa được cấu hình hoặc đang tắt.", httpStatus: 400 });
  }

  const prefix = `${location.uploadRoot}/${tenantImageFolder(tenantId, usage)}/`;
  if (typeof publicId !== "string" || !publicId.startsWith(prefix) || !ASSET_NAME.test(publicId.slice(prefix.length))) {
    throw new AppError({ code: "INVALID_IMAGE_PUBLIC_ID", message: "Ảnh không thuộc thư mục của trang này.", httpStatus: 400 });
  }

  const fallbackUrl = `https://res.cloudinary.com/${location.cloudName}/image/upload/${publicId}`;
  const lookup = await fetchCloudinaryImageResource(publicId);

  if (lookup.kind === "not_found") {
    // Cloudinary xác nhận không có asset (upload lỗi/bị huỷ) → bỏ dòng giữ chỗ, không ăn hạn mức.
    await withTenant(tenantId, (tx) => tx.tenantMediaAsset.deleteMany({ where: { tenantId, publicId } }));
    throw new AppError({ code: "IMAGE_NOT_FOUND", message: "Không tìm thấy ảnh vừa tải lên — vui lòng tải lại.", httpStatus: 404 });
  }

  if (lookup.kind === "error") {
    // Không xác minh được: giữ (hoặc tạo) dòng với mức tạm tính — tenant không lách được hạn mức, số thật được
    // đối soát lại ở lần xin chữ ký sau khi quá hạn chữ ký.
    logger.warn({ tenantId, publicId, reason: lookup.reason }, "tenant-media: register without verification (Cloudinary Admin API error)");
    await withTenant(tenantId, (tx) =>
      tx.tenantMediaAsset.upsert({
        where: { publicId },
        create: { tenantId, publicId, bytes: UNVERIFIED_IMAGE_BYTES, usage },
        update: {},
      }),
    );
    return { url: fallbackUrl, verified: false };
  }

  await applyVerifiedResource(tenantId, usage, lookup.resource);
  const secureUrl = lookup.resource.secureUrl;
  return { url: secureUrl && isCloudinaryImageUrl(secureUrl, location.cloudName) ? secureUrl : fallbackUrl, verified: true };
}

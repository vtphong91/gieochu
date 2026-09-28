"use server";

import { revalidatePath } from "next/cache";
import { AppError, isCloudinaryImageUrl, storefrontImageUrls, storefrontSectionsSchema } from "@gieochu/core";
import { getPrismaClient, Prisma } from "@gieochu/db";
import { signatureError, signatureOk, type CloudinarySignatureResult } from "../../../../lib/cloudinary-signature";
import { getSystemCloudinaryCloudName } from "../../../../lib/system-cloudinary";
import { createTenantImageUploadSignature } from "../../../../lib/tenant-media";
import { requireTenantMember } from "../../../../lib/tenant";

/**
 * ADR-023 — Studio → Trang bán hàng. Cùng quy trình Lưu nháp / Xuất bản /
 * Khôi phục bản live như CMS trang chủ (`admin/cms/home-editor/actions.ts`).
 * `tenants` không có RLS (như `branding`) — ghi thẳng theo `tenant.id` lấy
 * từ `requireTenantMember`, KHÔNG từ client. Section luôn validate lại ở server.
 */

export interface StorefrontEditorActionState {
  error?: string;
  success?: boolean;
}

function toActionError(error: unknown): StorefrontEditorActionState {
  if (error instanceof AppError && error.expose) return { error: error.message };
  throw error;
}

async function parseSections(sections: unknown): Promise<{ data: Prisma.InputJsonValue } | { error: string }> {
  const parsed = storefrontSectionsSchema.safeParse(sections);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: issue ? `Dữ liệu section không hợp lệ: ${issue.message}` : "Dữ liệu section không hợp lệ." };
  }
  // ADR-028: schema chỉ kiểm host res.cloudinary.com — ở server kiểm thêm đúng cloud hệ thống.
  const imageUrls = storefrontImageUrls(parsed.data);
  if (imageUrls.length > 0) {
    const cloudName = await getSystemCloudinaryCloudName();
    if (imageUrls.some((url) => !isCloudinaryImageUrl(url, cloudName))) {
      return { error: "Dữ liệu section không hợp lệ: Ảnh phải được upload lên Cloudinary của hệ thống." };
    }
  }
  // JSON round-trip bỏ các key `undefined` (field tuỳ chọn để trống) trước khi lưu Json.
  return { data: JSON.parse(JSON.stringify(parsed.data)) as Prisma.InputJsonValue };
}

/** Lưu nháp — chỉ ghi `storefrontSectionsDraft`, trang công khai không đổi. */
export async function saveStorefrontDraftAction(tenantSlug: string, sections: unknown): Promise<StorefrontEditorActionState> {
  try {
    const { tenant } = await requireTenantMember(tenantSlug);
    const parsed = await parseSections(sections);
    if ("error" in parsed) return { error: parsed.error };

    await getPrismaClient().tenant.update({ where: { id: tenant.id }, data: { storefrontSectionsDraft: parsed.data } });
    revalidatePath(`/studio/${tenant.slug}/storefront`);
    return { success: true };
  } catch (error) {
    return toActionError(error);
  }
}

/** Xuất bản — sections gửi lên thành bản live, xoá nháp, làm mới trang công khai. */
export async function publishStorefrontAction(tenantSlug: string, sections: unknown): Promise<StorefrontEditorActionState> {
  try {
    const { tenant } = await requireTenantMember(tenantSlug);
    const parsed = await parseSections(sections);
    if ("error" in parsed) return { error: parsed.error };

    await getPrismaClient().tenant.update({
      where: { id: tenant.id },
      data: { storefrontSections: parsed.data, storefrontSectionsDraft: Prisma.DbNull },
    });
    revalidatePath(`/studio/${tenant.slug}/storefront`);
    revalidatePath(`/${tenant.slug}`);
    return { success: true };
  } catch (error) {
    return toActionError(error);
  }
}

/** Khôi phục bản live — xoá nháp (bỏ mọi thay đổi chưa xuất bản). */
export async function restoreLiveStorefrontAction(tenantSlug: string): Promise<StorefrontEditorActionState> {
  try {
    const { tenant } = await requireTenantMember(tenantSlug);
    await getPrismaClient().tenant.update({ where: { id: tenant.id }, data: { storefrontSectionsDraft: Prisma.DbNull } });
    revalidatePath(`/studio/${tenant.slug}/storefront`);
    return { success: true };
  } catch (error) {
    return toActionError(error);
  }
}

/**
 * ADR-023 mục 6 + ADR-028 — chữ ký upload ảnh storefront: chỉ thành viên quản lý tenant; public id ngẫu nhiên trong
 * folder `<uploadFolder>/tenants/<tenantId>/storefront`, định dạng png/jpg/webp và incoming transformation (cạnh
 * dài ≤2000px) đều nằm trong chữ ký. Kiểm hạn mức ảnh của gói (`IMAGE_QUOTA_EXCEEDED`). Sau upload, client gọi
 * `registerTenantImageAction(tenantSlug, publicId, "STOREFRONT")`.
 */
export async function getTenantCloudinaryUploadSignatureAction(tenantSlug: string): Promise<CloudinarySignatureResult> {
  try {
    const { tenant } = await requireTenantMember(tenantSlug);
    return signatureOk(await createTenantImageUploadSignature(tenant.id, "STOREFRONT"));
  } catch (error) {
    return signatureError(error);
  }
}

"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { AppError, LEGAL_DOCUMENT_DEFS, logger } from "@gieochu/core";
import { requireVerified } from "../../lib/session";
import { createTenantForUser } from "../../lib/create-tenant";
import { getEffectiveLegalVersion, resolveSellerPolicyAcceptance } from "../../lib/legal";
import { getOrCreateTenantBucket } from "../../lib/tenant-storage";

const createTenantSchema = z.object({
  name: z.string().trim().min(1, "Vui lòng nhập tên trang."),
  slug: z.string().trim().optional(),
  bio: z.string().trim().optional(),
  // ADR-054 mục 5: ô "Tôi đồng ý Chính sách người bán" (chỉ hiện khi văn bản có bản hiệu lực) + id bản người dùng đã thấy.
  sellerPolicyAccepted: z.boolean(),
  sellerPolicyVersionId: z.string().trim().min(1).max(64).optional(),
});

export interface CreateTenantActionState {
  error?: string;
}

export async function createTenantAction(
  _prevState: CreateTenantActionState,
  formData: FormData,
): Promise<CreateTenantActionState> {
  const user = await requireVerified();

  const parsed = createTenantSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug") || undefined,
    bio: formData.get("bio") || undefined,
    sellerPolicyAccepted: formData.get("sellerPolicyAccepted") === "on",
    sellerPolicyVersionId: formData.get("sellerPolicyVersionId") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };
  }

  let tenant;
  try {
    // Server tự xác định bản hiệu lực — không tin việc client có hiện checkbox hay không.
    const sellerPolicyVersionId = resolveSellerPolicyAcceptance(await getEffectiveLegalVersion(LEGAL_DOCUMENT_DEFS.seller.key), {
      accepted: parsed.data.sellerPolicyAccepted,
      submittedVersionId: parsed.data.sellerPolicyVersionId,
    });
    tenant = await createTenantForUser(user, {
      name: parsed.data.name,
      slug: parsed.data.slug,
      bio: parsed.data.bio,
      acceptedLegalVersionIds: sellerPolicyVersionId ? [sellerPolicyVersionId] : [],
    });
  } catch (error) {
    if (error instanceof AppError) {
      return { error: error.message };
    }
    throw error;
  }

  // Tạo bucket thật trên nhà cung cấp lưu trữ đang dùng. Không chặn việc tạo gian hàng khi lỗi:
  // bucket sẽ được cấp lại (idempotent) ở lần upload đầu hoặc qua nút "Khởi tạo" của admin.
  try {
    await getOrCreateTenantBucket(tenant.id);
  } catch (error) {
    logger.warn({ err: error, tenantId: tenant.id }, "tenant bucket provisioning failed at creation");
  }

  redirect(`/studio/${tenant.slug}`);
}

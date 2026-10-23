"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { AppError, logger } from "@gieochu/core";
import { requireVerified } from "../../lib/session";
import { createTenantForUser } from "../../lib/create-tenant";
import { getOrCreateTenantBucket } from "../../lib/tenant-storage";

const createTenantSchema = z.object({
  name: z.string().trim().min(1, "Vui lòng nhập tên trang."),
  slug: z.string().trim().optional(),
  bio: z.string().trim().optional(),
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
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };
  }

  let tenant;
  try {
    tenant = await createTenantForUser(user, parsed.data);
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

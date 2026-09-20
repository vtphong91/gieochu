"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { AppError } from "@gieochu/core";
import { requireVerified } from "../../lib/session";
import { createTenantForUser } from "../../lib/create-tenant";

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

  redirect(`/studio/${tenant.slug}`);
}

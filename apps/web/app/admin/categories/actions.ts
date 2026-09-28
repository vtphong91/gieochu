"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { AppError } from "@gieochu/core";
import { sanitizeRichTextHtml } from "@gieochu/core/content/sanitize-html";
import { requireRole } from "../../../lib/session";
import { getSystemCloudinaryCloudName } from "../../../lib/system-cloudinary";
import { createDocumentCategory, toggleDocumentCategoryActive, updateDocumentCategory } from "../../../lib/document-category";

export interface CategoryActionState {
  error?: string;
  success?: boolean;
}

const categorySchema = z.object({
  name: z.string().trim().min(1, "Thiếu tên danh mục."),
  slug: z.string().trim().optional(),
  shortDescription: z.string().trim().max(300, "Mô tả ngắn tối đa 300 ký tự.").optional(),
  description: z.string().trim().optional(),
  imageUrl: z.string().trim().optional(),
  seoTitle: z.string().trim().max(70, "SEO Title tối đa 70 ký tự.").optional(),
  seoDescription: z.string().trim().max(160, "Meta Description tối đa 160 ký tự.").optional(),
  ogImageUrl: z.string().trim().optional(),
});

function parseCategoryFormData(formData: FormData) {
  return categorySchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug") || undefined,
    shortDescription: formData.get("shortDescription") || undefined,
    description: formData.get("description") || undefined,
    imageUrl: formData.get("imageUrl") || undefined,
    seoTitle: formData.get("seoTitle") || undefined,
    seoDescription: formData.get("seoDescription") || undefined,
    ogImageUrl: formData.get("ogImageUrl") || undefined,
  });
}

export async function createCategoryAction(_prevState: CategoryActionState, formData: FormData): Promise<CategoryActionState> {
  await requireRole("SYSTEM_ADMIN");
  const parsed = parseCategoryFormData(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };

  // Sanitize server-side — cùng nguyên tắc với mô tả sản phẩm (không tin HTML client gửi lên); ADR-028: chỉ giữ ảnh Cloudinary hệ thống.
  const description = parsed.data.description ? sanitizeRichTextHtml(parsed.data.description, { imageCloudName: await getSystemCloudinaryCloudName() }) : undefined;

  let category;
  try {
    category = await createDocumentCategory({ ...parsed.data, description });
  } catch (error) {
    if (error instanceof AppError) return { error: error.message };
    throw error;
  }

  revalidatePath("/admin/categories");
  redirect(`/admin/categories/${category.id}`);
}

export async function updateCategoryAction(categoryId: string, _prevState: CategoryActionState, formData: FormData): Promise<CategoryActionState> {
  await requireRole("SYSTEM_ADMIN");
  const parsed = parseCategoryFormData(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };

  const description = parsed.data.description ? sanitizeRichTextHtml(parsed.data.description, { imageCloudName: await getSystemCloudinaryCloudName() }) : undefined;

  try {
    await updateDocumentCategory(categoryId, { ...parsed.data, description });
  } catch (error) {
    if (error instanceof AppError) return { error: error.message };
    throw error;
  }

  revalidatePath("/admin/categories");
  revalidatePath(`/admin/categories/${categoryId}`);
  return { success: true };
}

export async function toggleCategoryActiveAction(categoryId: string): Promise<void> {
  await requireRole("SYSTEM_ADMIN");
  await toggleDocumentCategoryActive(categoryId);
  revalidatePath("/admin/categories");
}

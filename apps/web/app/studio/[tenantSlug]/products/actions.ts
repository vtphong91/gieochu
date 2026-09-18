"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { AppError } from "@gieochu/core";
import type { ProductType } from "@gieochu/db";
import { requireTenantMember } from "../../../../lib/tenant";
import { archiveProduct, createProduct, publishProduct, restoreProduct, unpublishProduct, updateProduct } from "../../../../lib/product";

export interface ProductActionState {
  error?: string;
}

const PRODUCT_TYPES: ProductType[] = ["TEMPLATE", "SLIDE", "EBOOK", "EXAM", "OTHER"];

const createSchema = z.object({
  title: z.string().trim().min(1),
  slug: z.string().trim().optional(),
  type: z.enum(PRODUCT_TYPES as [ProductType, ...ProductType[]]),
});

export async function createProductAction(
  tenantSlug: string,
  _prevState: ProductActionState,
  formData: FormData,
): Promise<ProductActionState> {
  const { tenant } = await requireTenantMember(tenantSlug);
  const parsed = createSchema.safeParse({
    title: formData.get("title"),
    slug: formData.get("slug") || undefined,
    type: formData.get("type"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };

  let product;
  try {
    product = await createProduct(tenant.id, parsed.data);
  } catch (error) {
    if (error instanceof AppError) return { error: error.message };
    throw error;
  }

  revalidatePath(`/studio/${tenantSlug}/products`);
  redirect(`/studio/${tenantSlug}/products/${product.id}`);
}

const updateSchema = z.object({
  title: z.string().trim().min(1),
  description: z.string().trim().optional(),
  type: z.enum(PRODUCT_TYPES as [ProductType, ...ProductType[]]),
  tags: z.string().trim().optional(),
  priceVnd: z.coerce.number().int().min(0),
  downloadLimit: z.coerce.number().int().min(0),
});

export async function updateProductAction(
  tenantSlug: string,
  productId: string,
  _prevState: ProductActionState,
  formData: FormData,
): Promise<ProductActionState> {
  const { tenant } = await requireTenantMember(tenantSlug);
  const parsed = updateSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    type: formData.get("type"),
    tags: formData.get("tags") || undefined,
    priceVnd: formData.get("priceVnd"),
    downloadLimit: formData.get("downloadLimit"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };

  const tags = (parsed.data.tags ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  try {
    await updateProduct(tenant.id, productId, {
      title: parsed.data.title,
      description: parsed.data.description || undefined,
      type: parsed.data.type,
      tags,
      priceVnd: parsed.data.priceVnd,
      downloadLimit: parsed.data.downloadLimit,
    });
  } catch (error) {
    if (error instanceof AppError) return { error: error.message };
    throw error;
  }

  revalidatePath(`/studio/${tenantSlug}/products/${productId}`);
  return {};
}

async function runStatusAction(
  tenantSlug: string,
  productId: string,
  fn: (tenantId: string, productId: string) => Promise<unknown>,
): Promise<ProductActionState> {
  const { tenant } = await requireTenantMember(tenantSlug);
  try {
    await fn(tenant.id, productId);
  } catch (error) {
    if (error instanceof AppError) return { error: error.message };
    throw error;
  }
  revalidatePath(`/studio/${tenantSlug}/products/${productId}`);
  revalidatePath(`/studio/${tenantSlug}/products`);
  return {};
}

export async function publishProductAction(tenantSlug: string, productId: string): Promise<ProductActionState> {
  return runStatusAction(tenantSlug, productId, publishProduct);
}

export async function unpublishProductAction(tenantSlug: string, productId: string): Promise<ProductActionState> {
  return runStatusAction(tenantSlug, productId, unpublishProduct);
}

export async function archiveProductAction(tenantSlug: string, productId: string): Promise<ProductActionState> {
  return runStatusAction(tenantSlug, productId, archiveProduct);
}

export async function restoreProductAction(tenantSlug: string, productId: string): Promise<ProductActionState> {
  return runStatusAction(tenantSlug, productId, restoreProduct);
}

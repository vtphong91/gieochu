"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getPrismaClient } from "@gieochu/db";
import { requireRole } from "../../../../lib/session";
import { isValidHex } from "../../../../lib/color-utils";

const CONFIG_ID = "default";

export interface BrandingActionState {
  error?: string;
  success?: boolean;
}

async function upsertBranding(data: Record<string, unknown>) {
  const prisma = getPrismaClient();
  await prisma.systemBranding.upsert({
    where: { id: CONFIG_ID },
    update: data,
    create: { id: CONFIG_ID, ...data },
  });
  revalidatePath("/", "layout");
  revalidatePath("/admin/settings/branding");
}

const logoFieldSchema = z.enum([
  "logoLightUrl",
  "logoDarkUrl",
  "logoSquareUrl",
  "logoSidebarUrl",
  "logoFooterUrl",
  "faviconUrl",
  "ogImageUrl",
]);

export async function saveLogoUrlAction(field: string, url: string | null): Promise<BrandingActionState> {
  await requireRole("SYSTEM_ADMIN");
  const parsedField = logoFieldSchema.safeParse(field);
  if (!parsedField.success) return { error: "Trường ảnh không hợp lệ." };

  await upsertBranding({ [parsedField.data]: url });
  return { success: true };
}

const nameSloganSchema = z.object({
  brandName: z.string().trim().optional(),
  brandSlogan: z.string().trim().optional(),
  navbarLogoHeightPx: z.coerce.number().int().min(24).max(80),
});

export async function saveNameSloganAction(_prevState: BrandingActionState, formData: FormData): Promise<BrandingActionState> {
  await requireRole("SYSTEM_ADMIN");
  const parsed = nameSloganSchema.safeParse({
    brandName: formData.get("brandName") || undefined,
    brandSlogan: formData.get("brandSlogan") || undefined,
    navbarLogoHeightPx: formData.get("navbarLogoHeightPx"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };

  await upsertBranding({
    brandName: parsed.data.brandName || null,
    brandSlogan: parsed.data.brandSlogan || null,
    navbarLogoHeightPx: parsed.data.navbarLogoHeightPx,
  });
  return { success: true };
}

const colorsSchema = z.object({
  primaryColorHex: z.string().trim().optional(),
  accentColorHex: z.string().trim().optional(),
  secondaryColorHex: z.string().trim().optional(),
});

export async function saveColorsAction(_prevState: BrandingActionState, formData: FormData): Promise<BrandingActionState> {
  await requireRole("SYSTEM_ADMIN");
  const parsed = colorsSchema.safeParse({
    primaryColorHex: formData.get("primaryColorHex") || undefined,
    accentColorHex: formData.get("accentColorHex") || undefined,
    secondaryColorHex: formData.get("secondaryColorHex") || undefined,
  });
  if (!parsed.success) return { error: "Dữ liệu không hợp lệ." };

  for (const value of [parsed.data.primaryColorHex, parsed.data.accentColorHex, parsed.data.secondaryColorHex]) {
    if (value && !isValidHex(value)) return { error: `Mã màu "${value}" không hợp lệ — cần dạng #RRGGBB.` };
  }

  await upsertBranding({
    primaryColorHex: parsed.data.primaryColorHex || null,
    accentColorHex: parsed.data.accentColorHex || null,
    secondaryColorHex: parsed.data.secondaryColorHex || null,
  });
  return { success: true };
}

export async function resetBrandingAction(): Promise<BrandingActionState> {
  await requireRole("SYSTEM_ADMIN");
  const prisma = getPrismaClient();
  await prisma.systemBranding.deleteMany({ where: { id: CONFIG_ID } });
  revalidatePath("/", "layout");
  revalidatePath("/admin/settings/branding");
  return { success: true };
}

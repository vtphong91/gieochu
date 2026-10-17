"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { isReservedSlug, isValidHexColor, isValidSocialLink, slugify, type SocialLinkKey } from "@gieochu/core";
import { getPrismaClient } from "@gieochu/db";
import { requireTenantMember } from "../../../../lib/tenant";
import { audit } from "../../../../lib/audit";

export interface SettingsActionState {
  error?: string;
  success?: boolean;
}

const brandingSchema = z.object({
  name: z.string().trim().min(1, "Vui lòng nhập tên trang."),
  bio: z.string().trim().optional(),
  primaryColor: z.string().trim(),
  accentColor: z.string().trim(),
  facebook: z.string().trim().optional(),
  youtube: z.string().trim().optional(),
  tiktok: z.string().trim().optional(),
  zalo: z.string().trim().optional(),
  website: z.string().trim().optional(),
});

const SOCIAL_KEYS: SocialLinkKey[] = ["facebook", "youtube", "tiktok", "zalo", "website"];

export async function updateBrandingAction(
  tenantSlug: string,
  _prevState: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const { tenant } = await requireTenantMember(tenantSlug);

  const parsed = brandingSchema.safeParse({
    name: formData.get("name"),
    bio: formData.get("bio") || undefined,
    primaryColor: formData.get("primaryColor"),
    accentColor: formData.get("accentColor"),
    facebook: formData.get("facebook") || undefined,
    youtube: formData.get("youtube") || undefined,
    tiktok: formData.get("tiktok") || undefined,
    zalo: formData.get("zalo") || undefined,
    website: formData.get("website") || undefined,
  });
  if (!parsed.success) {
    return { error: "Dữ liệu không hợp lệ." };
  }

  if (!isValidHexColor(parsed.data.primaryColor) || !isValidHexColor(parsed.data.accentColor)) {
    return { error: "Màu phải ở định dạng mã hex, ví dụ #2563eb." };
  }

  const socialLinks: Partial<Record<SocialLinkKey, string>> = {};
  for (const key of SOCIAL_KEYS) {
    const value = parsed.data[key];
    if (!value) continue;
    if (!isValidSocialLink(key, value)) {
      return { error: `Liên kết ${key} không hợp lệ.` };
    }
    socialLinks[key] = value;
  }

  const prisma = getPrismaClient();
  await prisma.tenant.update({
    where: { id: tenant.id },
    data: {
      name: parsed.data.name,
      bio: parsed.data.bio || null,
      branding: {
        primaryColor: parsed.data.primaryColor,
        accentColor: parsed.data.accentColor,
        socialLinks,
      },
    },
  });

  return { success: true };
}

const SLUG_CHANGE_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;

export async function changeSlugAction(
  tenantSlug: string,
  _prevState: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const { tenant, user } = await requireTenantMember(tenantSlug);

  const newSlug = slugify(String(formData.get("newSlug") ?? ""));
  if (!newSlug) return { error: "Vui lòng nhập đường dẫn mới." };
  if (newSlug === tenant.slug) return { error: "Đây đã là đường dẫn hiện tại." };
  if (isReservedSlug(newSlug)) return { error: "Đường dẫn này không được phép sử dụng." };

  const prisma = getPrismaClient();

  const lastChange = await prisma.tenantSlugHistory.findFirst({
    where: { tenantId: tenant.id },
    orderBy: { changedAt: "desc" },
  });
  if (lastChange && Date.now() - lastChange.changedAt.getTime() < SLUG_CHANGE_COOLDOWN_MS) {
    return { error: "Mỗi trang chỉ được đổi đường dẫn tối đa 1 lần / 30 ngày." };
  }

  const existing = await prisma.tenant.findUnique({ where: { slug: newSlug } });
  if (existing) return { error: "Đường dẫn này đã được sử dụng." };

  await prisma.$transaction([
    prisma.tenantSlugHistory.create({ data: { tenantId: tenant.id, oldSlug: tenant.slug } }),
    prisma.tenant.update({ where: { id: tenant.id }, data: { slug: newSlug } }),
  ]);
  await audit.log({
    actorId: user.userId,
    scope: "TENANT",
    tenantId: tenant.id,
    action: "TENANT_SLUG_CHANGED",
    targetType: "Tenant",
    targetId: tenant.id,
    metadata: { from: tenant.slug, to: newSlug },
  });

  redirect(`/studio/${newSlug}/settings`);
}

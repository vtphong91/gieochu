"use server";

import { revalidatePath } from "next/cache";
import { AppError } from "@gieochu/core";
import { requireTenantMember } from "../../../../../../lib/tenant";
import { createShareLink, revokeShareLink } from "../../../../../../lib/share-link";

export interface ShareLinkActionState {
  error?: string;
  createdToken?: string;
}

function parseVnDatetimeLocal(value: string): Date {
  return new Date(`${value}:00+07:00`);
}

export async function createShareLinkAction(
  tenantSlug: string,
  productId: string,
  _prevState: ShareLinkActionState,
  formData: FormData,
): Promise<ShareLinkActionState> {
  const { tenant } = await requireTenantMember(tenantSlug);

  const label = String(formData.get("label") ?? "").trim();
  if (!label) return { error: "Vui lòng nhập nhãn cho link." };

  const expiresAtRaw = String(formData.get("expiresAt") ?? "").trim();
  const maxUsesRaw = String(formData.get("maxUses") ?? "").trim();
  const password = String(formData.get("password") ?? "").trim();
  const fileIds = formData.getAll("fileIds").map(String);

  try {
    const { token } = await createShareLink(tenant.id, productId, {
      label,
      expiresAt: expiresAtRaw ? parseVnDatetimeLocal(expiresAtRaw) : null,
      maxUses: maxUsesRaw ? Number(maxUsesRaw) : null,
      password: password || null,
      fileIds,
    });
    revalidatePath(`/studio/${tenantSlug}/products/${productId}/share-links`);
    return { createdToken: token, error: undefined };
  } catch (error) {
    if (error instanceof AppError) return { error: error.message };
    throw error;
  }
}

export async function revokeShareLinkAction(tenantSlug: string, productId: string, shareLinkId: string): Promise<void> {
  const { tenant } = await requireTenantMember(tenantSlug);
  await revokeShareLink(tenant.id, shareLinkId);
  revalidatePath(`/studio/${tenantSlug}/products/${productId}/share-links`);
}

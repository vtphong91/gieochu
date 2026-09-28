"use server";

import { after } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { AppError, logger, resolveStorefrontAccess } from "@gieochu/core";
import { findTenantBySlugForStorefront, resolveStorefrontSections } from "../../lib/storefront";
import {
  clientIpFromHeaders,
  createStorefrontMessage,
  hashClientIp,
  notifyTenantOwnerOfMessage,
} from "../../lib/storefront-messages";

export type StorefrontContactResult = { ok: true } | { error: string };

const contactSchema = z.object({
  name: z.string().trim().min(1, "Vui lòng nhập tên của bạn.").max(80, "Tên tối đa 80 ký tự."),
  email: z.string().trim().max(200, "Email quá dài.").pipe(z.email("Email chưa đúng định dạng.")),
  message: z.string().trim().min(1, "Vui lòng nhập nội dung lời nhắn.").max(2000, "Lời nhắn tối đa 2000 ký tự."),
});

function field(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

/**
 * ADR-023 — form liên hệ trên storefront. Dùng với `useActionState`:
 * `useActionState(submitStorefrontContactAction.bind(null, tenantSlug), null)`.
 * FormData: `name`, `email`, `message`, `website` (honeypot — phải rỗng).
 * CSRF: cơ chế Server Action sẵn có của Next (§7.7). Tin được lưu TRƯỚC, email
 * báo chủ trang gửi sau khi response trả về (`after`), lỗi gửi chỉ log.
 */
export async function submitStorefrontContactAction(
  tenantSlug: string,
  _prevState: StorefrontContactResult | null,
  formData: FormData,
): Promise<StorefrontContactResult> {
  // Honeypot: bot điền mọi ô → giả vờ thành công, không lưu, không báo lỗi để bot không học được.
  if (field(formData, "website").trim() !== "") return { ok: true };

  const parsed = contactSchema.safeParse({
    name: field(formData, "name"),
    email: field(formData, "email"),
    message: field(formData, "message"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Thông tin chưa hợp lệ." };
  }

  const tenant = await findTenantBySlugForStorefront(tenantSlug);
  if (!tenant || resolveStorefrontAccess(tenant.status, "guest") !== "ACTIVE") {
    return { error: "Trang này hiện không nhận lời nhắn." };
  }

  const { sections } = resolveStorefrontSections(tenant, { isOwner: false });
  const contact = sections.find((s) => s.type === "contact");
  if (!contact || contact.type !== "contact" || !contact.data.formEnabled) {
    return { error: "Trang này hiện không nhận lời nhắn." };
  }

  const ip = clientIpFromHeaders(await headers());
  try {
    await createStorefrontMessage({
      tenantId: tenant.id,
      name: parsed.data.name,
      email: parsed.data.email,
      message: parsed.data.message,
      ipHash: ip ? hashClientIp(ip) : null,
    });
  } catch (error) {
    if (error instanceof AppError && error.expose) return { error: error.message };
    logger.error({ err: error, tenantId: tenant.id }, "storefront.message: lưu lời nhắn thất bại");
    return { error: "Chưa gửi được lời nhắn, vui lòng thử lại sau." };
  }

  after(() =>
    notifyTenantOwnerOfMessage({
      tenant: { id: tenant.id, slug: tenant.slug, name: tenant.name, ownerId: tenant.ownerId },
      name: parsed.data.name,
      email: parsed.data.email,
      message: parsed.data.message,
    }),
  );

  return { ok: true };
}

import { createHmac } from "node:crypto";
import { logger, notFound, rateLimited } from "@gieochu/core";
import { getEnv } from "@gieochu/config";
import { getPrismaClient, withPublic, withTenant, type StorefrontMessageStatus } from "@gieochu/db";
import { renderStorefrontMessageEmail } from "@gieochu/email";
import { sendEmailNow } from "./email-dispatch";
import { checkRateLimit } from "./rate-limit";

/**
 * ADR-023 — hộp thư form liên hệ storefront (`storefront_messages`, bảng L2
 * có RLS). Ghi từ khách: `withPublic` (policy chỉ cho INSERT, không
 * SELECT/UPDATE/DELETE). Đọc/sửa/xoá: `withTenant` của đúng tenant (Studio).
 * Không có hàm nào ở đây cho System Admin (§7.9).
 */

/** ≤ 3 tin / 10 phút cho mỗi IP (tính trên mọi storefront). */
const IP_LIMIT = 3;
const IP_WINDOW_MS = 10 * 60 * 1000;
/** ≤ 50 tin / giờ cho mỗi tenant — chặn spam dồn vào 1 hộp thư dù đổi IP. */
const TENANT_LIMIT = 50;
const TENANT_WINDOW_MS = 60 * 60 * 1000;

/**
 * Không lưu IP thô (ADR-023). HMAC-SHA256 với khoá = `JWT_ACCESS_SECRET` (tái
 * dùng secret sẵn có, thêm nhãn domain "storefront-ip:" để giá trị không
 * trùng bất kỳ HMAC nào khác dùng cùng khoá). Đổi secret → hash đổi, chỉ ảnh
 * hưởng cửa sổ rate limit hiện tại.
 */
export function hashClientIp(ip: string): string {
  return createHmac("sha256", getEnv().JWT_ACCESS_SECRET).update(`storefront-ip:${ip}`).digest("hex");
}

/** `x-forwarded-for` phần tử đầu (theo brief), fallback `x-real-ip`. */
export function clientIpFromHeaders(headers: Pick<Headers, "get">): string | null {
  const forwarded = headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  if (first) return first;
  return headers.get("x-real-ip")?.trim() || null;
}

export interface CreateStorefrontMessageInput {
  tenantId: string;
  name: string;
  email: string;
  message: string;
  ipHash: string | null;
}

/**
 * Rate limit dùng helper in-memory sẵn có (`lib/rate-limit.ts`, 1 process —
 * xem BACKLOG). Không đếm bằng DB được vì scope public không có quyền SELECT
 * trên bảng này (đúng thiết kế RLS).
 */
export async function createStorefrontMessage(input: CreateStorefrontMessageInput): Promise<void> {
  if (input.ipHash && !checkRateLimit(`storefront-msg:ip:${input.ipHash}`, IP_LIMIT, IP_WINDOW_MS)) {
    throw rateLimited("Bạn đã gửi khá nhiều lời nhắn trong ít phút. Vui lòng thử lại sau khoảng 10 phút nhé.");
  }
  if (!checkRateLimit(`storefront-msg:tenant:${input.tenantId}`, TENANT_LIMIT, TENANT_WINDOW_MS)) {
    throw rateLimited("Trang này đang nhận quá nhiều lời nhắn. Vui lòng thử lại sau ít phút nhé.");
  }

  // createMany = INSERT không RETURNING: policy RLS scope public chỉ có INSERT,
  // `create()` (INSERT ... RETURNING) sẽ bị từ chối vì row mới không qua được policy SELECT.
  await withPublic((tx) =>
    tx.storefrontMessage.createMany({
      data: [
        {
          tenantId: input.tenantId,
          name: input.name,
          email: input.email,
          message: input.message,
          ipHash: input.ipHash,
        },
      ],
    }),
  );
}

/**
 * Email báo chủ tenant — gọi SAU khi tin đã lưu (thường trong `after()`), lỗi
 * chỉ log, không bao giờ ném ra (tin đã nằm trong hộp thư). Loại email
 * `storefront_message` không ghi vào EmailSendLog (xem email-dispatch.ts).
 */
export async function notifyTenantOwnerOfMessage(input: {
  tenant: { id: string; slug: string; name: string; ownerId: string };
  name: string;
  email: string;
  message: string;
}): Promise<void> {
  try {
    const owner = await getPrismaClient().user.findUnique({ where: { id: input.tenant.ownerId }, select: { email: true } });
    if (!owner) return;
    const inboxUrl = `${getEnv().APP_URL.replace(/\/+$/, "")}/studio/${input.tenant.slug}/messages`;
    const rendered = renderStorefrontMessageEmail({
      tenantName: input.tenant.name,
      senderName: input.name,
      senderEmail: input.email,
      message: input.message,
      inboxUrl,
    });
    const result = await sendEmailNow({ type: "storefront_message", to: owner.email, ...rendered });
    if (!result.ok) {
      logger.warn({ tenantId: input.tenant.id, error: result.error }, "storefront.message: gửi email báo chủ trang thất bại");
    }
  } catch (error) {
    logger.warn({ tenantId: input.tenant.id, err: error }, "storefront.message: lỗi khi gửi email báo chủ trang");
  }
}

export type StorefrontInboxFilter = "inbox" | "archived";

export const STOREFRONT_MESSAGES_PAGE_SIZE = 20;

export interface StorefrontMessageItem {
  id: string;
  name: string;
  email: string;
  message: string;
  status: StorefrontMessageStatus;
  createdAt: Date;
}

/** "inbox" = NEW + READ, "archived" = ARCHIVED; mới nhất trước. */
export async function listStorefrontMessages(
  tenantId: string,
  options: { filter: StorefrontInboxFilter; page: number },
): Promise<{ items: StorefrontMessageItem[]; total: number }> {
  const page = Math.max(1, Math.trunc(options.page) || 1);
  const where = {
    tenantId,
    status: options.filter === "archived" ? ("ARCHIVED" as const) : { in: ["NEW" as const, "READ" as const] },
  };
  return withTenant(tenantId, async (tx) => {
    const [items, total] = await Promise.all([
      tx.storefrontMessage.findMany({
        where,
        select: { id: true, name: true, email: true, message: true, status: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * STOREFRONT_MESSAGES_PAGE_SIZE,
        take: STOREFRONT_MESSAGES_PAGE_SIZE,
      }),
      tx.storefrontMessage.count({ where }),
    ]);
    return { items, total };
  });
}

export async function countNewStorefrontMessages(tenantId: string): Promise<number> {
  return withTenant(tenantId, (tx) => tx.storefrontMessage.count({ where: { tenantId, status: "NEW" } }));
}

export async function setStorefrontMessageStatus(tenantId: string, messageId: string, status: StorefrontMessageStatus): Promise<void> {
  const result = await withTenant(tenantId, (tx) =>
    tx.storefrontMessage.updateMany({ where: { id: messageId, tenantId }, data: { status } }),
  );
  if (result.count === 0) throw notFound("Không tìm thấy tin nhắn.");
}

export async function deleteStorefrontMessage(tenantId: string, messageId: string): Promise<void> {
  const result = await withTenant(tenantId, (tx) => tx.storefrontMessage.deleteMany({ where: { id: messageId, tenantId } }));
  if (result.count === 0) throw notFound("Không tìm thấy tin nhắn.");
}

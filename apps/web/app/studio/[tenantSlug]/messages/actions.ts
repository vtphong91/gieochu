"use server";

import { revalidatePath } from "next/cache";
import { AppError } from "@gieochu/core";
import { requireTenantMember } from "../../../../lib/tenant";
import { deleteStorefrontMessage, setStorefrontMessageStatus } from "../../../../lib/storefront-messages";

/**
 * ADR-023 — Studio → Hộp thư. `tenant.id` luôn lấy từ `requireTenantMember`
 * (không từ client); mọi ghi đi qua `withTenant` + WHERE tenantId nên id tin
 * của tenant khác không bao giờ khớp.
 */

const STATUS_BY_OP = { read: "READ", unread: "NEW", archive: "ARCHIVED", unarchive: "READ" } as const;
export type MessageStatusOp = keyof typeof STATUS_BY_OP;

export interface MessageActionState {
  error?: string;
  success?: boolean;
}

function isOp(value: unknown): value is MessageStatusOp {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(STATUS_BY_OP, value);
}

export async function updateMessageStatusAction(tenantSlug: string, messageId: string, op: MessageStatusOp): Promise<MessageActionState> {
  try {
    const { tenant } = await requireTenantMember(tenantSlug);
    if (!isOp(op) || typeof messageId !== "string" || !messageId) return { error: "Thao tác không hợp lệ." };
    await setStorefrontMessageStatus(tenant.id, messageId, STATUS_BY_OP[op]);
    revalidatePath(`/studio/${tenant.slug}`, "layout");
    return { success: true };
  } catch (error) {
    if (error instanceof AppError && error.expose) return { error: error.message };
    throw error;
  }
}

export async function deleteMessageAction(tenantSlug: string, messageId: string): Promise<MessageActionState> {
  try {
    const { tenant } = await requireTenantMember(tenantSlug);
    if (typeof messageId !== "string" || !messageId) return { error: "Thao tác không hợp lệ." };
    await deleteStorefrontMessage(tenant.id, messageId);
    revalidatePath(`/studio/${tenant.slug}`, "layout");
    return { success: true };
  } catch (error) {
    if (error instanceof AppError && error.expose) return { error: error.message };
    throw error;
  }
}

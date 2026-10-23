import { z } from "zod";
import { AppError, notFound } from "@gieochu/core";
import { withTenant } from "@gieochu/db";
import { audit } from "./audit";

/**
 * ADR-047 mục 2 — ghi chú nội bộ trên đơn hàng Studio (bảng L2 `order_notes`, RLS chỉ scope tenant + system_job).
 * Khách KHÔNG bao giờ đọc được: mọi hàm ở đây chạy dưới `withTenant`, và nơi gọi đã `requireTenantMember` (OWNER),
 * truyền `tenant.id` lấy từ guard. Ghi chú không sửa được (không có policy UPDATE); chỉ tác giả được xoá.
 *
 * Deploy trước migration `20261018090000_adr045_order_notes`: đọc → `available: false`, thêm/xoá → ORDER_NOTES_UNAVAILABLE.
 */

export const ORDER_NOTE_MAX_LENGTH = 1000;
/** Số ghi chú tối đa đọc cho một đơn (trang chi tiết). */
const ORDER_NOTE_READ_LIMIT = 200;

export interface OrderNoteView {
  id: string;
  body: string;
  createdAt: Date;
  /** null khi tài khoản tác giả đã bị xoá. `name` = họ tên hồ sơ (null nếu chưa có) — UI hiện `name ?? email`. */
  author: { name: string | null; email: string } | null;
  /** true khi người xem là tác giả. */
  canDelete: boolean;
}

/** Bảng `order_notes` chưa tồn tại (code lên trước migration ADR-047). */
export function isOrderNotesTableMissing(error: unknown): boolean {
  if (typeof error === "object" && error !== null && (error as { code?: unknown }).code === "P2021") return true;
  const text = error instanceof Error ? `${error.message} ${String((error as { cause?: unknown }).cause ?? "")}` : String(error);
  return /42P01|order_notes.*does not exist|does not exist.*order_notes/i.test(text);
}

function notesUnavailable(): AppError {
  return new AppError({ code: "ORDER_NOTES_UNAVAILABLE", message: "Tính năng ghi chú chưa sẵn sàng, vui lòng thử lại sau.", httpStatus: 503 });
}

const noteBodySchema = z
  .string()
  .transform((value) => value.normalize("NFC").trim())
  .pipe(
    z
      .string()
      .min(1, "Vui lòng nhập nội dung ghi chú.")
      .max(ORDER_NOTE_MAX_LENGTH, `Ghi chú tối đa ${ORDER_NOTE_MAX_LENGTH} ký tự.`),
  );

/**
 * Đọc ghi chú của một đơn (cũ → mới). Transaction RIÊNG (không gộp vào transaction đọc đơn): lỗi bảng thiếu làm hỏng
 * transaction Postgres đang mở. Bảng `users`/`user_profiles` là L1 — chỉ lấy email + họ tên tác giả.
 */
export async function listOrderNotes(
  tenantId: string,
  orderId: string,
  viewerId: string | null,
): Promise<{ available: boolean; notes: OrderNoteView[] }> {
  try {
    const rows = await withTenant(tenantId, (tx) =>
      tx.orderNote.findMany({
        where: { tenantId, orderId },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        take: ORDER_NOTE_READ_LIMIT,
        select: {
          id: true,
          body: true,
          createdAt: true,
          authorId: true,
          author: { select: { email: true, profile: { select: { fullName: true } } } },
        },
      }),
    );
    return {
      available: true,
      notes: rows.map((row) => ({
        id: row.id,
        body: row.body,
        createdAt: row.createdAt,
        author: row.author ? { name: row.author.profile?.fullName ?? null, email: row.author.email } : null,
        canDelete: viewerId !== null && row.authorId === viewerId,
      })),
    };
  } catch (error) {
    if (isOrderNotesTableMissing(error)) return { available: false, notes: [] };
    throw error;
  }
}

/**
 * Thêm ghi chú. Kiểm đơn thuộc tenant trong cùng transaction (policy INSERT cũng kiểm lại). Audit sau commit, metadata
 * chỉ id (ADR-047: không lưu nội dung).
 */
export async function addOrderNote(tenantId: string, orderId: string, authorId: string, body: unknown): Promise<{ id: string }> {
  const parsed = noteBodySchema.safeParse(typeof body === "string" ? body : "");
  if (!parsed.success) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: parsed.error.issues[0]?.message ?? "Ghi chú không hợp lệ.",
      httpStatus: 400,
    });
  }

  let note: { id: string };
  try {
    note = await withTenant(tenantId, async (tx) => {
      const order = await tx.order.findFirst({ where: { id: orderId, tenantId }, select: { id: true } });
      if (!order) throw notFound("Không tìm thấy đơn hàng.");
      return tx.orderNote.create({ data: { tenantId, orderId, authorId, body: parsed.data }, select: { id: true } });
    });
  } catch (error) {
    if (isOrderNotesTableMissing(error)) throw notesUnavailable();
    throw error;
  }

  await audit.log({
    actorId: authorId,
    scope: "TENANT",
    tenantId,
    action: "ORDER_NOTE_ADDED",
    targetType: "Order",
    targetId: orderId,
    metadata: { noteId: note.id },
  });
  return note;
}

/**
 * Xoá ghi chú — chỉ tác giả. Điều kiện tác giả nằm trong WHERE của lệnh xoá (không đọc-rồi-xoá); khi xoá 0 dòng mới
 * đọc lại để phân biệt 404 (không có / không thuộc tenant / thuộc đơn khác) và 403 (không phải tác giả).
 * `orderId` (từ URL) phải khớp đơn của ghi chú.
 */
export async function deleteOrderNote(tenantId: string, orderId: string, noteId: string, actorId: string): Promise<void> {
  let outcome: "deleted" | "not_found" | "forbidden";
  try {
    outcome = await withTenant(tenantId, async (tx) => {
      const deleted = await tx.orderNote.deleteMany({ where: { id: noteId, tenantId, orderId, authorId: actorId } });
      if (deleted.count > 0) return "deleted" as const;
      const existing = await tx.orderNote.findFirst({ where: { id: noteId, tenantId, orderId }, select: { id: true } });
      return existing ? ("forbidden" as const) : ("not_found" as const);
    });
  } catch (error) {
    if (isOrderNotesTableMissing(error)) throw notesUnavailable();
    throw error;
  }

  if (outcome === "not_found") {
    throw new AppError({ code: "ORDER_NOTE_NOT_FOUND", message: "Không tìm thấy ghi chú.", httpStatus: 404 });
  }
  if (outcome === "forbidden") {
    throw new AppError({ code: "ORDER_NOTE_FORBIDDEN", message: "Bạn chỉ có thể xoá ghi chú do mình viết.", httpStatus: 403 });
  }

  await audit.log({
    actorId,
    scope: "TENANT",
    tenantId,
    action: "ORDER_NOTE_DELETED",
    targetType: "Order",
    targetId: orderId,
    metadata: { noteId },
  });
}

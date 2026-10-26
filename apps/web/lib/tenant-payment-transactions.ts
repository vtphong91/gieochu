import { Prisma, withTenant } from "@gieochu/db";
import type { PaymentProviderId } from "@gieochu/payments";

/**
 * ADR-059 bổ sung lần 2 (d) — Studio "Giao dịch cần xử lý": giao dịch cổng của gian hàng (`tenant_payment_transactions`, L2 —
 * đọc dưới `withTenant`) không tự áp được vào đơn: UNMATCHED (không tìm thấy đơn) và MISMATCH_AMOUNT (sai số tiền). Bỏ giao dịch
 * SePay tiền ra (`transferType = out`). Chủ gian hàng đối chiếu rồi xác nhận tay ở trang chi tiết đơn (nếu còn trong cửa sổ).
 */

export const TENANT_TXN_PAGE_SIZE = 20;

export interface TenantTxnNeedingAction {
  id: string;
  provider: PaymentProviderId;
  providerTxnId: string;
  amountVnd: number;
  matchStatus: "UNMATCHED" | "MISMATCH_AMOUNT";
  createdAt: Date;
  /** Nội dung chuyển khoản (SePay `content`), cắt ngắn. */
  content: string | null;
  order: { id: string; code: string; totalVnd: number; status: string } | null;
}

/**
 * Điều kiện lọc viết bằng SQL: `rawPayload->>'transferType'` vắng mặt (MoMo, payload cũ) phải được GIỮ — bộ lọc JSON của Prisma
 * (`NOT path equals`) loại cả dòng thiếu khoá (NULL), nên dùng COALESCE. Chạy dưới `withTenant` → RLS vẫn áp.
 */
function needingActionSql(tenantId: string): Prisma.Sql {
  return Prisma.sql`"tenantId" = ${tenantId}
    AND "matchStatus" IN ('UNMATCHED', 'MISMATCH_AMOUNT')
    AND NOT ("provider" = 'SEPAY' AND COALESCE("rawPayload"->>'transferType', '') = 'out')`;
}

function contentOf(raw: Prisma.JsonValue): string | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const content = (raw as Record<string, unknown>).content;
  if (typeof content !== "string" || !content.trim()) return null;
  return content.length > 160 ? `${content.slice(0, 160)}…` : content;
}

/** Người gọi đã `requireTenantMember*` (tenantId lấy từ guard). Mới nhất trước, phân trang. */
export async function listTenantTransactionsNeedingAction(tenantId: string, page: number, pageSize: number = TENANT_TXN_PAGE_SIZE) {
  const safePage = Math.max(1, Math.trunc(page) || 1);
  const size = Math.min(100, Math.max(1, Math.trunc(pageSize) || TENANT_TXN_PAGE_SIZE));
  const [rows, total] = await withTenant(tenantId, async (tx) => {
    const ids = await tx.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "tenant_payment_transactions" WHERE ${needingActionSql(tenantId)}
      ORDER BY "createdAt" DESC, "id" DESC LIMIT ${size} OFFSET ${(safePage - 1) * size}
    `;
    const counted = await tx.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::bigint AS "count" FROM "tenant_payment_transactions" WHERE ${needingActionSql(tenantId)}
    `;
    const found = await tx.tenantPaymentTransaction.findMany({
      where: { tenantId, id: { in: ids.map((row) => row.id) } },
      select: {
        id: true,
        provider: true,
        providerTxnId: true,
        amountVnd: true,
        matchStatus: true,
        createdAt: true,
        rawPayload: true,
        order: { select: { id: true, code: true, totalVnd: true, status: true } },
      },
    });
    const byId = new Map(found.map((row) => [row.id, row]));
    return [ids.flatMap((row) => (byId.has(row.id) ? [byId.get(row.id)!] : [])), Number(counted[0]?.count ?? 0)] as const;
  });
  const items: TenantTxnNeedingAction[] = rows.map((row) => ({
    id: row.id,
    provider: row.provider,
    providerTxnId: row.providerTxnId,
    amountVnd: row.amountVnd,
    matchStatus: row.matchStatus as TenantTxnNeedingAction["matchStatus"],
    createdAt: row.createdAt,
    content: contentOf(row.rawPayload),
    order: row.order,
  }));
  return { items, total, page: safePage, pageSize: size };
}

/** Số giao dịch cần xử lý — cho liên kết ở trang Đơn hàng. */
export async function countTenantTransactionsNeedingAction(tenantId: string): Promise<number> {
  const counted = await withTenant(tenantId, (tx) =>
    tx.$queryRaw<{ count: bigint }[]>`SELECT COUNT(*)::bigint AS "count" FROM "tenant_payment_transactions" WHERE ${needingActionSql(tenantId)}`,
  );
  return Number(counted[0]?.count ?? 0);
}

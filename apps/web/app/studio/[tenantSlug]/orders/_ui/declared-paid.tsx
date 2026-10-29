import { brandColors } from "@gieochu/config/theme";
import { Badge } from "../../../../admin/_ui/kit";
import { IconClock } from "../../../../admin/_ui/icons";
import { formatOrderDateTime } from "./order-format";

/*
 * ADR-062 Q1 + bổ sung mục 3 — khách bấm "Tôi đã chuyển khoản" (cổng xác nhận thủ công). Chỉ ý nghĩa khi đơn chưa trả:
 * PENDING, hoặc EXPIRED nhưng khách báo trước hạn (người bán vẫn xác nhận được). Badge có icon + chữ (không chỉ màu).
 */

type OrderLike = { status: string; customerDeclaredPaidAt: Date | null };

/** Đơn đang có cờ "khách báo đã chuyển" cần người bán đối chiếu. */
export function isDeclaredPaidPending(order: OrderLike): boolean {
  return Boolean(order.customerDeclaredPaidAt) && (order.status === "PENDING" || order.status === "EXPIRED");
}

export function DeclaredPaidBadge({ order }: { order: OrderLike }) {
  if (!isDeclaredPaidPending(order)) return null;
  return (
    <Badge tone="info">
      <IconClock className="mr-1 h-3.5 w-3.5 shrink-0" />
      {order.status === "EXPIRED" ? "Khách báo đã chuyển · trước hạn" : "Khách báo đã chuyển"}
    </Badge>
  );
}

/** Khối nhắc trong "Thao tác đơn" (chi tiết đơn) — đặt ngay trên form xác nhận thanh toán thủ công. */
export function DeclaredPaidNotice({ order }: { order: OrderLike }) {
  if (!isDeclaredPaidPending(order) || !order.customerDeclaredPaidAt) return null;
  return (
    <div className="mb-3 flex gap-2.5 rounded-xl border border-l-4 p-3 text-xs leading-relaxed" style={{ background: brandColors.surface, borderColor: brandColors.primary, color: brandColors.ink }}>
      <IconClock className="mt-0.5 h-4 w-4 shrink-0" />
      <p>
        <strong className="font-semibold">Khách báo đã chuyển lúc {formatOrderDateTime(order.customerDeclaredPaidAt)}.</strong>{" "}
        {order.status === "EXPIRED"
          ? "Đơn đã quá hạn giữ, nhưng khách báo chuyển trước hạn nên bạn vẫn xác nhận được. Đối chiếu sao kê / lịch sử ví trước khi xác nhận."
          : "Đối chiếu sao kê / lịch sử ví theo mã đơn rồi xác nhận thủ công."}
      </p>
    </div>
  );
}

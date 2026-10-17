import { Badge } from "./kit";
import { IconLock } from "./icons";

/*
 * ADR-038 mục 5 — nhãn + khối giải thích "Bị khoá kiểm duyệt" cho nội dung tenant (tài liệu, đánh giá, bài viết) bị
 * quản trị hệ thống ẩn/lưu trữ sau khi xử lý báo cáo vi phạm. Dùng trong Studio (danh sách, editor, thẻ đánh giá) và
 * trang chi tiết báo cáo của System Center. Không hook → import được từ Server lẫn Client Component.
 * Chỉ hiển thị nhãn loại vi phạm (`moderationReason`) — không bao giờ có danh tính người báo cáo (ADR-038 mục 4).
 */

const RED_TEXT = "#B91C1C"; // 6.5:1 trên nền trắng, ~6:1 trên nền đỏ nhạt
const RED_SOFT = "#FEF2F2";
const RED_LINE = "#FCA5A5";

/** Nhãn ngắn — icon khoá + chữ (không chỉ dựa vào màu). */
export function ModerationLockBadge() {
  return (
    <Badge tone="danger">
      <IconLock className="mr-1 h-3.5 w-3.5" />
      Bị khoá kiểm duyệt
    </Badge>
  );
}

/**
 * Khối giải thích: lý do + việc tenant không làm được + hướng liên hệ hỗ trợ.
 * - `subject`: "tài liệu" / "đánh giá" / "bài viết".
 * - `measure`: biện pháp đã áp, ví dụ "lưu trữ", "ẩn".
 * - `blocked`: việc tenant không tự làm được, ví dụ "khôi phục hay xuất bản lại", "bỏ ẩn".
 */
export function ModerationLockNotice({
  subject,
  measure,
  blocked,
  reason,
  lockedAtLabel,
  className = "",
}: {
  subject: string;
  measure: string;
  blocked: string;
  reason: string | null;
  /** Thời điểm khoá đã định dạng giờ Việt Nam; null = không hiện. */
  lockedAtLabel?: string | null;
  className?: string;
}) {
  return (
    <div
      className={`flex items-start gap-2.5 rounded-lg border px-3.5 py-3 text-sm leading-relaxed ${className}`}
      style={{ background: RED_SOFT, borderColor: RED_LINE, color: RED_TEXT }}
    >
      <IconLock className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 [overflow-wrap:anywhere]">
        <p className="font-semibold">
          Bị khoá kiểm duyệt{reason ? ` — ${reason}` : ""}
        </p>
        <p className="mt-0.5">
          Quản trị hệ thống đã {measure} {subject} này sau khi xem xét báo cáo vi phạm
          {lockedAtLabel ? ` (lúc ${lockedAtLabel})` : ""}, nên bạn không thể {blocked}. Nếu cho rằng đây là nhầm lẫn, vui lòng liên hệ bộ
          phận hỗ trợ.
        </p>
      </div>
    </div>
  );
}

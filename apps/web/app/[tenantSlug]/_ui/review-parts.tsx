import { IconStar } from "./icons";
import { DISPLAY_TIME_ZONE } from "@gieochu/core/system-settings";

/*
 * ADR-029 (M10a) — mảnh giao diện đánh giá dùng chung: trang chi tiết tài liệu (trang hệ thống), section "Đánh giá"
 * của storefront, Thư viện khách và Studio → Đánh giá. KHÔNG dùng hook → import được từ cả Server lẫn Client
 * Component. Màu sao theo `currentColor` — nơi dùng tự đặt màu (hệ thống: accent; storefront: `--sf-accent-text`).
 */

/** Nhãn chữ đi kèm từng mức sao (không truyền đạt chỉ bằng số sao/màu). */
export const REVIEW_RATING_WORDS: Record<number, string> = {
  1: "Rất không hài lòng",
  2: "Chưa hài lòng",
  3: "Bình thường",
  4: "Hài lòng",
  5: "Rất hài lòng",
};

const DATE_TIME = new Intl.DateTimeFormat("vi-VN", {
  timeZone: DISPLAY_TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const DATE_ONLY = new Intl.DateTimeFormat("vi-VN", { timeZone: DISPLAY_TIME_ZONE, day: "2-digit", month: "2-digit", year: "numeric" });

/** Ngày giờ hiển thị theo giờ Việt Nam, ví dụ "14:05 27/09/2026". */
export function formatReviewDateTime(value: Date | string): string {
  return DATE_TIME.format(new Date(value));
}

export function formatReviewDate(value: Date | string): string {
  return DATE_ONLY.format(new Date(value));
}

/** Điểm trung bình 1 chữ số thập phân kiểu Việt Nam: 4.6 → "4,6". */
export function formatRatingAverage(average: number): string {
  return average.toLocaleString("vi-VN", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/**
 * Hàng 5 sao chỉ đọc. Cả hàng là 1 ảnh có tên (`role="img"` + aria-label) — trình đọc màn hình nghe "4 trên 5 sao"
 * thay vì 5 hình vô nghĩa. `rating` có thể lẻ (điểm TB) — số sao tô = làm tròn gần nhất; con số chính xác luôn
 * hiển thị bằng chữ cạnh đó ở nơi dùng.
 */
export function ReviewStars({
  rating,
  label,
  starClassName = "h-4 w-4",
  className = "",
}: {
  rating: number;
  /** Mặc định "Đánh giá {n} trên 5 sao". */
  label?: string;
  starClassName?: string;
  className?: string;
}) {
  const filled = Math.round(rating);
  return (
    <span role="img" aria-label={label ?? `Đánh giá ${rating} trên 5 sao`} className={`inline-flex shrink-0 items-center gap-0.5 ${className}`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <IconStar key={n} filled={n <= filled} className={starClassName} />
      ))}
    </span>
  );
}

/** Chữ cái đầu của tên hiển thị ("Minh N." → "M") cho avatar chữ. */
export function reviewerInitial(displayName: string): string {
  return Array.from(displayName.trim())[0]?.toLocaleUpperCase("vi") ?? "?";
}

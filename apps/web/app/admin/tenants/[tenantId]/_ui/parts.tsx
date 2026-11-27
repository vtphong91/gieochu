import { brandColors } from "@gieochu/config/theme";
import { Badge } from "../../../_ui/kit";
import { LINE } from "../../../_ui/detail-kit";

/*
 * ADR-072 — mảnh trình bày riêng của trang chi tiết gian hàng (Server Component thuần). Các mảnh dùng chung với trang chi tiết
 * người dùng (CARD, InfoGrid, SectionHeading, StatTile…) nằm ở `admin/_ui/detail-kit.tsx`.
 */

/** amber-700 — phần đã dùng khi gần đầy (≥ 3:1 trên nền track; kèm chữ "Gần đầy" nên không phụ thuộc màu). */
const NEAR_FULL = "#B45309";
const NEAR_FULL_PERCENT = 90;

/**
 * Thanh mức dùng (dung lượng / số tài liệu): `role="progressbar"` có tên + `aria-valuetext` đọc được ("120 MB trên 500 MB,
 * 24%"). Từ 90% đổi màu thanh VÀ hiện badge chữ "Gần đầy". Thanh chặn ở 100% nhưng chữ hiện % thật (có thể vượt 100%).
 */
export function UsageBar({ id, label, usedText, limitText, ratio }: { id: string; label: string; usedText: string; limitText: string; ratio: number }) {
  const percent = Number.isFinite(ratio) ? Math.max(0, Math.round(ratio * 100)) : 0;
  const barPercent = Math.min(100, percent);
  const near = percent >= NEAR_FULL_PERCENT;
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <span id={id} className="text-sm font-medium" style={{ color: brandColors.ink }}>
          {label}
        </span>
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm tabular-nums" style={{ color: brandColors.ink }}>
          <span>
            {usedText} / {limitText} ({percent}%)
          </span>
          {near ? <Badge tone="warning">Gần đầy</Badge> : null}
        </span>
      </div>
      <div
        role="progressbar"
        aria-labelledby={id}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={barPercent}
        aria-valuetext={`${usedText} trên ${limitText}, ${percent}%${near ? ", gần đầy" : ""}`}
        className="mt-2 h-2.5 w-full overflow-hidden rounded-full"
        style={{ background: LINE }}
      >
        <div className="h-full rounded-full" style={{ width: `${barPercent}%`, background: near ? NEAR_FULL : brandColors.primary }} />
      </div>
    </div>
  );
}

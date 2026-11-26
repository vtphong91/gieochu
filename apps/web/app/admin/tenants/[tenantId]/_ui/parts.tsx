import type { ReactNode } from "react";
import Link from "next/link";
import { brandColors } from "@gieochu/config/theme";
import { Badge } from "../../../_ui/kit";

/*
 * ADR-072 — mảnh trình bày dùng chung của trang chi tiết gian hàng (Server Component thuần). Cùng ngôn ngữ thị giác với trang
 * chi tiết thuê bao `/admin/subscriptions/[subscriptionId]` (thẻ bo góc `rounded-2xl border bg-white`, tiêu đề phần có icon).
 */

export const CARD = "rounded-2xl border bg-white p-5 sm:p-6";
export const LINE = "#E5E7EB";
const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-primary)]";

/** "—" cho trình đọc màn hình đọc được nghĩa ("Không có"…) thay vì đọc ký tự gạch. */
export function Dash({ srText }: { srText: string }) {
  return (
    <>
      <span aria-hidden="true">—</span>
      <span className="sr-only">{srText}</span>
    </>
  );
}

export function SectionHeading({ id, icon, title, description }: { id: string; icon: ReactNode; title: string; description?: string }) {
  return (
    <div className="mb-3 flex items-start gap-3">
      <span
        aria-hidden="true"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
        style={{ background: brandColors.surface, color: brandColors.primary }}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <h2 id={id} className="font-[family-name:var(--font-heading)] font-semibold" style={{ color: brandColors.ink }}>
          {title}
        </h2>
        {description ? (
          <p className="mt-0.5 text-sm" style={{ color: brandColors.inkSoft }}>
            {description}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export interface InfoItem {
  label: string;
  value: ReactNode;
  /** Chiếm cả hàng (nội dung dài: danh sách slug cũ, hoá đơn gần nhất). */
  wide?: boolean;
}

/** Danh sách nhãn → giá trị (`<dl>`): 1 cột dưới sm, 2 cột từ sm. Giá trị dài tự ngắt dòng — không cuộn ngang ở 375px. */
export function InfoGrid({ items }: { items: InfoItem[] }) {
  return (
    <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.label} className={`min-w-0 ${item.wide ? "sm:col-span-2" : ""}`}>
          <dt className="text-xs font-medium text-gray-600">{item.label}</dt>
          <dd className="mt-1 text-sm [overflow-wrap:anywhere]" style={{ color: brandColors.ink }}>
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Ô trống gọn trong thẻ (phần không có dữ liệu) — cùng nét đứt với `EmptyState` của kit nhưng không chiếm 16 hàng. */
export function CompactEmpty({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed px-4 py-5 text-center text-sm" style={{ borderColor: LINE, color: brandColors.inkSoft }}>
      {children}
    </p>
  );
}

/** Link văn bản trong thẻ — vùng bấm 44px dưới lg. */
export function TextLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className={`inline-flex min-h-11 items-center gap-1 text-sm font-semibold underline-offset-2 hover:underline lg:min-h-9 ${FOCUS}`}
      style={{ color: brandColors.primary }}
    >
      {children}
    </Link>
  );
}

/** Ô số liệu: nhãn nhỏ + số lớn (tabular-nums để các cột số thẳng hàng). */
export function StatTile({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0 rounded-xl border bg-gray-50 px-3.5 py-3" style={{ borderColor: LINE }}>
      <dt className="text-xs font-medium text-gray-600">{label}</dt>
      <dd className="mt-1 text-lg font-semibold tabular-nums [overflow-wrap:anywhere]" style={{ color: brandColors.ink }}>
        {value}
      </dd>
    </div>
  );
}

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

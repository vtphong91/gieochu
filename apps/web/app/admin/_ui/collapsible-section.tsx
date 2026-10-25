"use client";

import { useEffect, useId, useState, useSyncExternalStore, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { brandColors } from "@gieochu/config/theme";
import { IconAlertTriangle, IconCheckCircle, IconChevronDown } from "./icons";

/**
 * ADR-058 — khối cấu hình thu gọn kiểu section của Rank Math: một dòng tiêu đề (heading chứa `<button aria-expanded
 * aria-controls>`) + badge trạng thái CÓ CHỮ + chevron bên phải; bấm thì xổ nội dung. Mẫu gốc: `LegalMetaForm`
 * (heading không bị nuốt như trong `<summary>`, điều khiển mở từ ngoài được — lỗi validate, hash).
 *
 * - Panel chỉ `hidden` khi đóng, KHÔNG unmount: giữ state đang nhập, input trong `<form>` vẫn được gửi.
 * - `#id` trên URL: section mang `id` nên trình duyệt tự cuộn tới, đồng thời khối tự mở (deep link / link từ tóm tắt lỗi).
 * - `errorCount` chuyển 0 → >0 thì tự mở. Người dùng đóng lại thì tôn trọng cho tới lần lỗi mới.
 * - `revealSection(id)` mở khối đồng bộ để code gọi focus ô bên trong được ngay sau đó.
 * - Không dùng localStorage, chỉ dùng hash (tuỳ chọn `syncHash`, ghi bằng `history.replaceState`).
 * - Chỉ xoay chevron, tắt khi `prefers-reduced-motion`. Không animate height.
 * Quy tắc dùng (khối đầu mở, SEO luôn thu gọn, cổng thanh toán đang bật thì mở): `docs/ke-hoach-toi-uu-layout-tab-accordion-2026-10-25.md` §4–§5.
 */

export type SectionStatusTone = "success" | "danger" | "warning" | "neutral" | "info";
export type SectionStatus = { tone: SectionStatusTone; label: string };

/** Badge Rank Math: nền nhạt + chữ đậm, mọi cặp ≥ 4.5:1 (màu trạng thái nghiệp vụ, không phải màu thương hiệu). */
const STATUS_STYLE: Record<SectionStatusTone, { bg: string; fg: string; line: string }> = {
  success: { bg: "#F0FDF4", fg: "#15803D", line: "#BBF7D0" },
  danger: { bg: "#FEF2F2", fg: "#B91C1C", line: "#FCA5A5" },
  warning: { bg: "#FFFBEB", fg: "#B45309", line: "#FDE68A" },
  neutral: { bg: "#F3F4F6", fg: "#4B5563", line: "#E5E7EB" },
  // Cùng sắc `Badge tone="info"` của kit (màu thương hiệu runtime).
  info: { bg: brandColors.surface, fg: brandColors.primary, line: "#BFDBFE" },
};
const LINE = "#E5E7EB";
const INK = brandColors.ink;
const INK_SOFT = "#6B7280";
const FOCUS_RING = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-primary)]";
const REVEAL_EVENT = "gieochu:reveal-section";

/**
 * Trạng thái chuẩn cho badge. Thứ tự ưu tiên: lỗi > có thay đổi chưa lưu > cảnh báo > trống > "Tất cả đều tốt".
 * `emptyLabel` (vd "Chưa điền") chỉ dùng khi truyền `empty: true`.
 */
export function sectionStatus({
  errorCount = 0,
  warningCount = 0,
  dirty = false,
  empty = false,
  emptyLabel = "Chưa điền",
  okLabel = "Tất cả đều tốt",
}: {
  errorCount?: number;
  warningCount?: number;
  dirty?: boolean;
  empty?: boolean;
  emptyLabel?: string;
  okLabel?: string;
}): SectionStatus {
  if (errorCount > 0) return { tone: "danger", label: `${errorCount} lỗi` };
  if (dirty) return { tone: "warning", label: "Có thay đổi" };
  if (warningCount > 0) return { tone: "warning", label: `${warningCount} cảnh báo` };
  if (empty) return { tone: "neutral", label: emptyLabel };
  return { tone: "success", label: okLabel };
}

/** Mở khối có `id` ngay lập tức (đồng bộ) — gọi trước khi focus một ô nằm trong khối đang thu gọn. */
export function revealSection(id: string) {
  window.dispatchEvent(new CustomEvent<string>(REVEAL_EVENT, { detail: id }));
}

function subscribeHash(callback: () => void) {
  window.addEventListener("hashchange", callback);
  return () => window.removeEventListener("hashchange", callback);
}

function StatusBadge({ status }: { status: SectionStatus }) {
  const s = STATUS_STYLE[status.tone];
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-0.5 font-[family-name:var(--font-body)] text-xs font-semibold whitespace-nowrap"
      style={{ background: s.bg, color: s.fg, borderColor: s.line }}
    >
      {status.tone === "danger" || status.tone === "warning" ? (
        <IconAlertTriangle className="h-3.5 w-3.5" />
      ) : status.tone === "success" ? (
        <IconCheckCircle className="h-3.5 w-3.5" />
      ) : null}
      {status.label}
    </span>
  );
}

export function CollapsibleSection({
  id,
  title,
  description,
  icon,
  headingLevel = 2,
  status,
  defaultOpen = false,
  open: controlledOpen,
  onOpenChange,
  errorCount = 0,
  actions,
  syncHash = false,
  region = true,
  children,
}: {
  /** Slug ổn định, duy nhất trong trang (vd "seo") — gắn lên `<section id>`, dùng cho `#id` và `revealSection`. */
  id: string;
  title: string;
  description?: string;
  icon?: ReactNode;
  headingLevel?: 2 | 3;
  /** Badge trạng thái — thường lấy từ `sectionStatus(...)`. Mảng = nhiều badge (vd "Đã điền 2/3" + "Có thay đổi"). */
  status?: SectionStatus | SectionStatus[] | null;
  /** Khối đầu tiên của trang: `true`. SEO: luôn `false`. Cổng thanh toán: `defaultOpen={enabled}`. */
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Số lỗi validate trong khối — chuyển 0 → >0 thì tự mở. Badge lỗi do `status` hiển thị. */
  errorCount?: number;
  /** Toggle/nút phụ — đặt CẠNH nút tiêu đề, không lồng control vào trong `<button>`. */
  actions?: ReactNode;
  /** Mở/đóng thì ghi/xoá `#id` trên URL (không tạo mục lịch sử). */
  syncHash?: boolean;
  /** `role="region"` cho panel — tắt khi trang có > 6 khối (WAI-APG: tránh quá nhiều landmark). */
  region?: boolean;
  children: ReactNode;
}) {
  const baseId = useId();
  const buttonId = `${baseId}-button`;
  const panelId = `${baseId}-panel`;

  // Hash là nguồn ngoài (URL) → đọc qua useSyncExternalStore; server luôn "" (khối render theo defaultOpen).
  const hash = useSyncExternalStore(subscribeHash, () => window.location.hash, () => "");
  const hashTargeted = hash === `#${id}`;

  // `manual` = lựa chọn đã có (người dùng bấm, tự mở do lỗi/hash/reveal). undefined → theo hash/defaultOpen.
  const [manual, setManual] = useState<boolean | undefined>(undefined);
  // Điều chỉnh state theo prop/hash ngay trong render (mẫu "adjusting state when a prop changes" của React — không dùng effect).
  const [prevErrorCount, setPrevErrorCount] = useState(errorCount);
  const [prevHashTargeted, setPrevHashTargeted] = useState(hashTargeted);
  if (errorCount !== prevErrorCount) {
    setPrevErrorCount(errorCount);
    if (prevErrorCount === 0 && errorCount > 0) setManual(true);
  }
  if (hashTargeted !== prevHashTargeted) {
    setPrevHashTargeted(hashTargeted);
    if (hashTargeted) setManual(true);
  }

  const isOpen = controlledOpen ?? manual ?? (hashTargeted || defaultOpen);

  useEffect(() => {
    function onReveal(event: Event) {
      if ((event as CustomEvent<string>).detail !== id) return;
      // flushSync: panel bỏ `hidden` trước khi `revealSection` trả về → bên gọi focus ô bên trong được ngay.
      flushSync(() => setManual(true));
      onOpenChange?.(true);
    }
    window.addEventListener(REVEAL_EVENT, onReveal);
    return () => window.removeEventListener(REVEAL_EVENT, onReveal);
  }, [id, onOpenChange]);

  function toggle() {
    const next = !isOpen;
    setManual(next);
    onOpenChange?.(next);
    if (syncHash) {
      const { pathname, search } = window.location;
      window.history.replaceState(window.history.state, "", next ? `${pathname}${search}#${id}` : `${pathname}${search}`);
    }
  }

  const Heading = headingLevel === 3 ? "h3" : "h2";
  const badges = Array.isArray(status) ? status : status ? [status] : [];

  return (
    <section id={id} className="scroll-mt-6 rounded-2xl border bg-white" style={{ borderColor: LINE }}>
      <div className="flex items-center gap-2">
        <Heading className="min-w-0 flex-1 font-[family-name:var(--font-heading)] font-semibold" style={{ color: INK }}>
          <button
            type="button"
            id={buttonId}
            aria-expanded={isOpen}
            aria-controls={panelId}
            onClick={toggle}
            className={`flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-2xl px-4 py-3.5 text-left sm:px-6 sm:py-4 ${FOCUS_RING}`}
          >
            {icon ? (
              <span
                aria-hidden="true"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                style={{ background: brandColors.surface, color: brandColors.primary }}
              >
                {icon}
              </span>
            ) : null}
            {/* flex-wrap: thiếu chỗ (mobile, nhiều badge) thì nhóm badge xuống dòng dưới tiêu đề thay vì bóp tiêu đề. */}
            <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1.5">
              <span className="min-w-0 flex-1 basis-48">
                <span className="block">{title}</span>
                {description ? (
                  <span className="mt-0.5 block font-[family-name:var(--font-body)] text-sm font-normal" style={{ color: INK_SOFT }}>
                    {description}
                  </span>
                ) : null}
              </span>
              {badges.length > 0 ? (
                <span className="flex flex-wrap gap-1.5">
                  {badges.map((item) => (
                    <StatusBadge key={`${item.tone}-${item.label}`} status={item} />
                  ))}
                </span>
              ) : null}
            </span>
            <IconChevronDown
              className={`h-5 w-5 shrink-0 text-gray-500 transition-transform duration-200 motion-reduce:transition-none ${isOpen ? "rotate-180" : ""}`}
            />
          </button>
        </Heading>
        {actions ? <div className="shrink-0 pr-4 sm:pr-6">{actions}</div> : null}
      </div>

      <div
        id={panelId}
        role={region ? "region" : undefined}
        aria-labelledby={region ? buttonId : undefined}
        hidden={!isOpen}
        className="border-t px-4 py-5 sm:px-6 sm:py-6"
        style={{ borderColor: LINE }}
      >
        {/* Khoảng cách giữa các khối con như `ConfigCard` (space-y-4). */}
        <div className="space-y-4">{children}</div>
      </div>
    </section>
  );
}

"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { brandColors } from "@gieochu/config/theme";
import { IconAlertTriangle, IconCheckCircle, IconChevronDown } from "./icons";
import { useLeaveGuard } from "./unsaved-changes";

/**
 * ADR-058 — tab ngang đầu trang, CHỈ gom các trang con cùng một chức năng (vd "Trang CMS": Trang chủ · Header & Footer).
 * Mỗi tab là một URL thật (`next/link`), nên markup là `<nav>` + link `aria-current="page"`, KHÔNG phải `role="tablist"`
 * (WAI-APG: tab ARIA chỉ dành cho panel trong cùng trang). Do đó không cần phím mũi tên, Tab/Shift+Tab đi qua từng link.
 * Không có dropdown.
 *
 * - `current`: href tab đang xem — trang truyền vào (trang biết mình là tab nào), không đoán bằng pathname.
 * - Tab đang chọn: nền primary + chữ trắng + chữ đậm + vạch dưới accent (không chỉ dựa màu). Khác `PillTabs` (lọc trong trang).
 * - Mobile (< md): `mobile="auto"` → ≤ 2 tab thì hiện thẳng, ≥ 3 tab thì dùng nút disclosure "Đang xem: … (i/n)"
 *   (Esc đóng + trả focus, bấm ra ngoài/chọn link thì đóng). Không dải tab cuộn ngang, không sticky.
 * - Mọi link gắn `onNavigate={useLeaveGuard()}` — còn thay đổi chưa lưu thì hỏi lại (ADR-058 mục 5, `unsaved-changes.tsx`).
 */

export type ModuleTabBadge = { count: number; srText: string; urgent?: boolean };
export type ModuleTabItem = { href: string; label: string; badge?: ModuleTabBadge };

const LINE = "#E5E7EB";
const INK = brandColors.ink;
const INK_MUTED = "#4B5563";
const DANGER = "#B91C1C";
const FOCUS_RING = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-primary)]";

function TabBadge({ badge, onPrimary }: { badge: ModuleTabBadge; onPrimary: boolean }) {
  if (badge.count <= 0) return null;
  const style = badge.urgent
    ? { background: DANGER, color: "white" }
    : onPrimary
      ? { background: "white", color: INK }
      : { background: brandColors.accentSoft, color: INK };
  return (
    <>
      <span
        aria-hidden="true"
        className="inline-flex min-w-6 shrink-0 items-center justify-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] leading-none font-bold tabular-nums"
        style={style}
      >
        {badge.urgent ? <IconAlertTriangle className="h-3 w-3" /> : null}
        {badge.count > 99 ? "99+" : badge.count}
      </span>
      <span className="sr-only">, {badge.srText}</span>
    </>
  );
}

export function ModuleTabs({
  label,
  items,
  current,
  mobile = "auto",
}: {
  /** aria-label của `<nav>`, vd "Các trang trong Trang CMS". */
  label: string;
  /** 2–4 trang cùng chức năng. */
  items: ModuleTabItem[];
  /** href của tab đang xem (phải trùng một `items[].href`). */
  current: string;
  mobile?: "auto" | "inline" | "disclosure";
}) {
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const guardLeave = useLeaveGuard();

  const useDisclosure = mobile === "disclosure" || (mobile === "auto" && items.length > 2);
  const currentIndex = items.findIndex((item) => item.href === current);
  const currentItem = currentIndex >= 0 ? items[currentIndex] : undefined;

  // Chỉ đăng ký listener khi đang mở — đóng khi bấm ra ngoài hoặc Esc (Esc trả focus về nút).
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <nav aria-label={label} className="mt-6">
      {useDisclosure ? (
        <div ref={rootRef} className="relative md:hidden">
          <button
            ref={buttonRef}
            type="button"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => setOpen((prev) => !prev)}
            className={`flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 rounded-xl border bg-white px-4 text-left text-sm ${FOCUS_RING}`}
            style={{ borderColor: LINE, color: INK }}
          >
            <span className="min-w-0">
              <span style={{ color: INK_MUTED }}>Đang xem: </span>
              <span className="font-semibold">{currentItem?.label ?? items[0]?.label}</span>
              {currentIndex >= 0 ? (
                <span className="tabular-nums" style={{ color: INK_MUTED }}>
                  {" "}
                  ({currentIndex + 1}/{items.length})
                </span>
              ) : null}
            </span>
            <IconChevronDown className={`h-5 w-5 shrink-0 transition-transform duration-200 motion-reduce:transition-none ${open ? "rotate-180" : ""}`} />
          </button>
          <ul
            id={panelId}
            hidden={!open}
            className="absolute inset-x-0 top-full z-20 mt-2 flex flex-col gap-1 rounded-xl border bg-white p-1.5 shadow-lg"
            style={{ borderColor: LINE }}
          >
            {items.map((item) => {
              const active = item.href === current;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onNavigate={guardLeave}
                    aria-current={active ? "page" : undefined}
                    onClick={() => setOpen(false)}
                    className={`flex min-h-11 items-center gap-2.5 rounded-lg px-3 text-sm ${active ? "font-semibold" : "font-medium hover:bg-gray-50"} ${FOCUS_RING}`}
                    style={active ? { background: brandColors.surface, color: brandColors.primary } : { color: INK }}
                  >
                    <span className="flex w-4 shrink-0 justify-center">{active ? <IconCheckCircle className="h-4 w-4" /> : null}</span>
                    <span className="min-w-0 flex-1">{item.label}</span>
                    {item.badge ? <TabBadge badge={item.badge} onPrimary={false} /> : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      <ul className={`${useDisclosure ? "hidden md:flex" : "flex"} flex-wrap gap-x-1 gap-y-2 border-b`} style={{ borderColor: LINE }}>
        {items.map((item) => {
          const active = item.href === current;
          return (
            <li key={item.href} className="-mb-px">
              <Link
                href={item.href}
                onNavigate={guardLeave}
                aria-current={active ? "page" : undefined}
                className={`inline-flex min-h-11 items-center gap-2 rounded-t-lg border-b-[3px] px-4 text-sm transition-colors motion-reduce:transition-none lg:min-h-10 ${
                  active ? "font-semibold" : "font-medium hover:bg-gray-50"
                } ${FOCUS_RING}`}
                style={
                  active
                    ? { background: brandColors.primary, color: "white", borderBottomColor: brandColors.accent }
                    : { color: INK_MUTED, borderBottomColor: "transparent" }
                }
              >
                {item.label}
                {item.badge ? <TabBadge badge={item.badge} onPrimary={active} /> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

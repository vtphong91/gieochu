"use client";

import { useEffect, useId, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { brandColors } from "@gieochu/config/theme";
import { IconChevronDown, IconClose, IconMenu } from "../admin/_ui/icons";
import { NavLinkAnchor, NavLinkLabel } from "./nav-link";

const INK = brandColors.ink;
const LINE = brandColors.line;
const PAPER = brandColors.background;
const PAPER_ALT = brandColors.backgroundAlt;
const BLUE = brandColors.primary;

export interface MobileNavItem {
  id: string;
  /** `null` = mục nhóm có menu con (ADR-050) — nút mở/thu danh sách con (accordion). */
  href: string | null;
  label: string;
  /** Mục ứng với trang đang xem → `aria-current="page"` + chỉ báo bằng chữ đậm/vạch (không chỉ bằng màu). */
  current?: boolean;
  /** Mở tab mới (kèm `rel="noopener noreferrer"`). */
  newTab?: boolean;
  /** `https://`/`mailto:` — dùng `<a>` thay `<Link>`. */
  external?: boolean;
  children?: MobileNavItem[];
}

const MOBILE_LINK_CLASS =
  "flex min-h-12 items-center gap-3 rounded-xl px-3 text-base outline-offset-[-2px] transition-colors hover:bg-[color:var(--nav-hover)] focus-visible:outline-2 [touch-action:manipulation]";

function MobileNavLink({ item, onNavigate }: { item: MobileNavItem & { href: string }; onNavigate: () => void }) {
  return (
    <NavLinkAnchor
      link={item}
      current={item.current}
      onClick={onNavigate}
      className={`${MOBILE_LINK_CLASS} ${item.current ? "font-bold" : "font-medium"}`}
      style={{ color: INK, outlineColor: BLUE, ["--nav-hover" as string]: PAPER_ALT }}
    >
      <span aria-hidden="true" className="h-5 w-1 shrink-0 rounded-full" style={{ background: item.current ? BLUE : "transparent" }} />
      <NavLinkLabel link={item} iconClassName="h-4 w-4" />
    </NavLinkAnchor>
  );
}

/** Mục nhóm (ADR-050): nút `aria-expanded` mở/thu danh sách con ngay bên dưới; mở sẵn khi chứa trang đang xem. */
function MobileNavGroup({ item, onNavigate }: { item: MobileNavItem; onNavigate: () => void }) {
  const children = (item.children ?? []).filter((child): child is MobileNavItem & { href: string } => child.href !== null);
  const containsCurrent = children.some((child) => child.current);
  const [expanded, setExpanded] = useState(containsCurrent);
  const listId = useId();
  return (
    <>
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={listId}
        onClick={() => setExpanded((value) => !value)}
        className={`${MOBILE_LINK_CLASS} w-full cursor-pointer justify-between text-left ${containsCurrent ? "font-bold" : "font-medium"}`}
        style={{ color: INK, outlineColor: BLUE, ["--nav-hover" as string]: PAPER_ALT }}
      >
        <span className="flex min-w-0 items-center gap-3">
          <span aria-hidden="true" className="h-5 w-1 shrink-0 rounded-full" style={{ background: containsCurrent ? BLUE : "transparent" }} />
          <span className="min-w-0 [overflow-wrap:anywhere]">{item.label}</span>
        </span>
        <IconChevronDown className={`h-5 w-5 shrink-0 transition-transform motion-reduce:transition-none ${expanded ? "rotate-180" : ""}`} />
      </button>
      <ul id={listId} hidden={!expanded} className="mb-1 ml-5 border-l pl-2" style={{ borderColor: LINE }}>
        {children.map((child) => (
          <li key={child.id}>
            <MobileNavLink item={child} onNavigate={onNavigate} />
          </li>
        ))}
      </ul>
    </>
  );
}

/**
 * Menu điều hướng của header công khai dưới `lg` (nav ngang chỉ hiện từ `lg`). Nút 44×44 có `aria-expanded` +
 * `aria-controls`; panel thả xuống full-bleed dưới header. Đóng khi: bấm lại nút, Esc (trả focus về nút), bấm ra
 * ngoài, hoặc đổi trang (header có thể nằm trong layout dùng chung nên không tự unmount khi điều hướng). Mục có menu con
 * (ADR-050) là accordion (`MobileNavGroup`); link ngoài/tab mới có biểu tượng + chữ ẩn (`NavLinkLabel`).
 */
export function MobileNav({ items }: { items: MobileNavItem[] }) {
  const [open, setOpen] = useState(false);
  const [openedAt, setOpenedAt] = useState<string | null>(null);
  const pathname = usePathname();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  // Đổi trang → đóng (điều chỉnh state trong render theo khuyến nghị React, không cần effect).
  if (open && openedAt !== pathname) {
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (items.length === 0) return null;

  return (
    <div ref={rootRef} className="lg:hidden">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? "Đóng menu điều hướng" : "Mở menu điều hướng"}
        onClick={() => {
          setOpenedAt(pathname);
          setOpen((value) => !value);
        }}
        className="inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border outline-offset-2 transition-colors hover:bg-white focus-visible:outline-2 [touch-action:manipulation]"
        style={{ borderColor: LINE, color: INK, outlineColor: BLUE }}
      >
        {open ? <IconClose className="h-5 w-5" /> : <IconMenu className="h-5 w-5" />}
      </button>
      <nav
        id={panelId}
        aria-label="Điều hướng chính"
        hidden={!open}
        className="absolute inset-x-0 top-full border-b shadow-[0_18px_30px_-20px_rgba(18,33,58,0.45)]"
        style={{ background: PAPER, borderColor: LINE }}
      >
        <ul className="container-page flex max-h-[calc(100dvh-68px)] flex-col overflow-y-auto overscroll-contain py-2 sm:max-h-[calc(100dvh-88px)]">
          {items.map((item) => (
            <li key={item.id}>
              {item.href !== null ? (
                <MobileNavLink item={{ ...item, href: item.href }} onNavigate={() => setOpen(false)} />
              ) : (
                <MobileNavGroup item={item} onNavigate={() => setOpen(false)} />
              )}
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

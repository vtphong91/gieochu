"use client";

import { useEffect, useId, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { brandColors } from "@gieochu/config/theme";
import { IconChevronDown } from "../admin/_ui/icons";
import { NavLinkAnchor, NavLinkLabel, type NavLinkData } from "./nav-link";

const INK = brandColors.ink;
const INK_SOFT = brandColors.inkSoft;
const PAPER = brandColors.background;
const PAPER_ALT = brandColors.backgroundAlt;
const LINE = brandColors.line;
const BLUE = brandColors.primary;

export interface NavDropdownChild extends NavLinkData {
  id: string;
  current?: boolean;
}

/**
 * Menu con 1 cấp của nav ngang (≥ lg, ADR-050) — mẫu "disclosure navigation" của WAI (nút + danh sách link, không dùng
 * `role="menu"`): mở/đóng bằng **bấm** (không chỉ hover — skill `hover-vs-tap`), `aria-expanded` + `aria-controls`; Esc đóng
 * và trả focus về nút; bấm ra ngoài hoặc Tab ra khỏi khối thì đóng; đổi trang thì đóng. Mục con đang xem →
 * `aria-current="page"` + chữ đậm + vạch trái; nút nhóm đậm + gạch chân khi chứa trang đang xem (không chỉ đổi màu).
 */
export function NavDropdown({ label, items, className }: { label: string; items: NavDropdownChild[]; className: string }) {
  const [open, setOpen] = useState(false);
  const [openedAt, setOpenedAt] = useState<string | null>(null);
  const pathname = usePathname();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const containsCurrent = items.some((item) => item.current);

  // Đổi trang → đóng (điều chỉnh state trong render, không cần effect — cùng mẫu MobileNav).
  if (open && openedAt !== pathname) setOpen(false);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
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

  return (
    <div
      ref={rootRef}
      className="relative"
      onBlur={(event) => {
        // Focus rời hẳn khối (Tab qua mục cuối / Shift+Tab qua nút) → đóng.
        if (open && !event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          setOpenedAt(pathname);
          setOpen((value) => !value);
        }}
        className={`${className} cursor-pointer gap-1.5 [touch-action:manipulation] ${containsCurrent ? "font-bold underline decoration-2" : ""}`}
        style={{ color: containsCurrent || open ? INK : INK_SOFT, outlineColor: BLUE }}
      >
        {label}
        <IconChevronDown className={`h-4 w-4 shrink-0 transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`} />
      </button>
      <ul
        id={panelId}
        hidden={!open}
        className="absolute top-full left-1/2 z-30 mt-1 w-max max-w-[20rem] min-w-56 -translate-x-1/2 rounded-2xl border p-2 shadow-[0_18px_40px_-18px_rgba(18,33,58,0.35)]"
        style={{ background: PAPER, borderColor: LINE }}
      >
        {items.map((item) => (
          <li key={item.id}>
            <NavLinkAnchor
              link={item}
              current={item.current}
              onClick={() => setOpen(false)}
              className={`flex min-h-11 items-center gap-2 rounded-xl border-l-[3px] px-3 py-2 text-[15px] outline-offset-[-2px] transition-colors hover:bg-[color:var(--nav-hover)] focus-visible:outline-2 ${
                item.current ? "font-bold" : "font-medium"
              }`}
              style={{ color: INK, outlineColor: BLUE, borderLeftColor: item.current ? BLUE : "transparent", ["--nav-hover" as string]: PAPER_ALT }}
            >
              <NavLinkLabel link={item} />
            </NavLinkAnchor>
          </li>
        ))}
      </ul>
    </div>
  );
}

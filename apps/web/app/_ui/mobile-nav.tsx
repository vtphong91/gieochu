"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { brandColors } from "@gieochu/config/theme";
import { IconClose, IconMenu } from "../admin/_ui/icons";

const INK = brandColors.ink;
const LINE = brandColors.line;
const PAPER = brandColors.background;
const BLUE = brandColors.primary;

export interface MobileNavItem {
  href: string;
  label: string;
  /** Mục ứng với trang đang xem → `aria-current="page"` + chỉ báo bằng chữ đậm/vạch (không chỉ bằng màu). */
  current?: boolean;
}

/**
 * Menu điều hướng của header công khai dưới `lg` (nav ngang chỉ hiện từ `lg`). Nút 44×44 có `aria-expanded` +
 * `aria-controls`; panel thả xuống full-bleed dưới header. Đóng khi: bấm lại nút, Esc (trả focus về nút), bấm ra
 * ngoài, hoặc đổi trang (header có thể nằm trong layout dùng chung nên không tự unmount khi điều hướng).
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
        <ul className="container-page flex flex-col py-2">
          {items.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={item.current ? "page" : undefined}
                onClick={() => setOpen(false)}
                className={`flex min-h-12 items-center gap-3 rounded-xl px-3 text-base outline-offset-[-2px] focus-visible:outline-2 ${
                  item.current ? "font-bold" : "font-medium"
                }`}
                style={{ color: INK, outlineColor: BLUE }}
              >
                <span aria-hidden="true" className="h-5 w-1 rounded-full" style={{ background: item.current ? BLUE : "transparent" }} />
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

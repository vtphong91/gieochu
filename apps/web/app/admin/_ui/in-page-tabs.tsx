"use client";

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { brandColors } from "@gieochu/config/theme";

/**
 * Tab nội bộ trong một trang — tab ARIA thật (ADR-058, kế hoạch §5.3): `tablist`/`tab`/`tabpanel`, roving tabindex,
 * ←/→ + Home/End (kích hoạt tự động). Kiểu pill (nền accent + chữ INK như `PillTabs`) để khác thanh `ModuleTabs` (link
 * giữa các trang) ở phía trên. MỌI panel luôn mounted, chỉ `hidden` — chuyển tab không làm mất dữ liệu đang nhập.
 * Dùng khi các khung cùng một màn, không đổi URL. Đổi URL (`?tab=`) thì dùng `PillTabs`.
 */
export type InPageTab = { id: string; label: string; panel: ReactNode };

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-primary)]";

export function InPageTabs({ label, tabs, panelClassName = "mt-6" }: { label: string; tabs: InPageTab[]; panelClassName?: string }) {
  const [active, setActive] = useState(tabs[0]?.id ?? "");
  const baseId = useId();
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const tabId = (id: string) => `${baseId}-tab-${id}`;
  const panelId = (id: string) => `${baseId}-panel-${id}`;

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next: number | null = null;
    if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    if (next === null) return;
    event.preventDefault();
    const target = tabs[next]!.id;
    setActive(target);
    tabRefs.current[target]?.focus();
  }

  return (
    <div>
      <div role="tablist" aria-label={label} className="flex flex-wrap gap-2">
        {tabs.map((tab, index) => {
          const selected = tab.id === active;
          return (
            <button
              key={tab.id}
              ref={(node) => {
                tabRefs.current[tab.id] = node;
              }}
              type="button"
              role="tab"
              id={tabId(tab.id)}
              aria-selected={selected}
              aria-controls={panelId(tab.id)}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(tab.id)}
              onKeyDown={(event) => onKeyDown(event, index)}
              className={`inline-flex min-h-11 cursor-pointer items-center rounded-full border px-4 text-sm font-semibold transition-colors motion-reduce:transition-none lg:min-h-9 ${
                selected ? "" : "hover:bg-gray-50"
              } ${FOCUS}`}
              style={
                selected
                  ? { background: brandColors.accent, borderColor: brandColors.accent, color: brandColors.ink }
                  : { background: "white", borderColor: "#E5E7EB", color: "#4B5563" }
              }
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={panelId(tab.id)}
          aria-labelledby={tabId(tab.id)}
          tabIndex={0}
          hidden={tab.id !== active}
          className={`${panelClassName} rounded-2xl ${FOCUS}`}
        >
          {tab.panel}
        </div>
      ))}
    </div>
  );
}

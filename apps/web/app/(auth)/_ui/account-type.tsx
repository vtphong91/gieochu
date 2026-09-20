"use client";

import { INK, INK_SOFT, LINE } from "./colors";

export type AccountType = "TENANT" | "CUSTOMER";

function IconChalkboard({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="12" rx="1.5" />
      <path d="M8 20h8M12 16v4" />
      <path d="M7 9.5 10 12l-1.5 3" />
    </svg>
  );
}

function IconBag({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 8h12l-1 12.5a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 7 20.5L6 8Z" />
      <path d="M9 8V6.5a3 3 0 0 1 6 0V8" />
    </svg>
  );
}

const OPTIONS: { value: AccountType; title: string; desc: string; Icon: (p: { className?: string }) => React.ReactElement }[] = [
  {
    value: "TENANT",
    title: "Giáo viên / Coach / Chuyên gia",
    desc: "Mở gian hàng riêng, bán tài liệu, slide bài giảng, khoá học.",
    Icon: IconChalkboard,
  },
  {
    value: "CUSTOMER",
    title: "Khách hàng",
    desc: "Tìm và mua tài liệu từ giáo viên, coach trên Gieo Chữ.",
    Icon: IconBag,
  },
];

export function AccountTypeSelect({ value, onChange }: { value: AccountType | null; onChange: (v: AccountType) => void }) {
  return (
    <div role="group" aria-label="Loại tài khoản" className="grid gap-3 sm:grid-cols-2">
      {OPTIONS.map((opt) => {
        const selected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(opt.value)}
            className="flex flex-col items-start gap-2.5 rounded-xl border-2 p-4 text-left transition"
            style={{
              borderColor: selected ? "#0F3B82" : LINE,
              background: selected ? "rgba(29,78,216,0.06)" : "white",
            }}
          >
            <span
              className="flex h-9 w-9 items-center justify-center rounded-lg"
              style={{ background: selected ? "#0F3B82" : "#F2ECDD", color: selected ? "white" : INK }}
            >
              <opt.Icon className="h-[18px] w-[18px]" />
            </span>
            <span className="text-sm font-semibold" style={{ color: INK }}>
              {opt.title}
            </span>
            <span className="text-xs leading-snug" style={{ color: INK_SOFT }}>
              {opt.desc}
            </span>
          </button>
        );
      })}
    </div>
  );
}

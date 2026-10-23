"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { brandColors } from "@gieochu/config/theme";

/**
 * Nút chuyển chỉ số biểu đồ (segmented control) dùng chung cho dashboard System Center (`/admin`, `?chi-so=gmv|don`) và
 * Studio Tổng quan (`/studio/{slug}`, `?chi-so=gop|thuc-nhan`). Đổi chỉ số **tức thì phía client** — dữ liệu mọi chỉ số đã
 * có sẵn trong props — và ghi lại `?chi-so=` bằng `window.history.replaceState` (chia sẻ được, không điều hướng, không
 * cuộn, không gọi lại server). Giá trị đầu đọc ở server (prop `initial`); URL đổi từ nơi khác (back/forward, điều
 * hướng mềm) được đồng bộ lại qua `useSearchParams` (Next tích hợp `replaceState` với router).
 */
export function useUrlMetric<M extends string>({
  param,
  initial,
  defaultValue,
  parse,
}: {
  param: string;
  initial: M;
  /** Giá trị mặc định — bỏ khỏi query cho gọn (cùng quy ước link GET cũ). */
  defaultValue: M;
  parse: (raw: string | undefined) => M;
}): [M, (next: M) => void] {
  const searchParams = useSearchParams();
  const fromUrl = parse(searchParams.get(param) ?? undefined);
  const [metric, setMetric] = useState<M>(initial);
  const [syncedUrl, setSyncedUrl] = useState<M>(initial);
  // URL thay đổi không do nút này (hoặc router đã nhận `replaceState`) → điều chỉnh state ngay trong render.
  if (fromUrl !== syncedUrl) {
    setSyncedUrl(fromUrl);
    setMetric(fromUrl);
  }

  function select(next: M) {
    setMetric(next);
    const url = new URL(window.location.href);
    if (next === defaultValue) url.searchParams.delete(param);
    else url.searchParams.set(param, next);
    window.history.replaceState(null, "", url);
  }

  return [metric, select];
}

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-primary,#0F3B82)]";

/** Nhóm 2+ nút `aria-pressed` (Tab đi qua từng nút, Enter/Space chọn). Nút ≥ 44px dưới `lg`. */
export function MetricToggle<M extends string>({
  label,
  options,
  value,
  onChange,
}: {
  /** Tên nhóm cho trình đọc màn hình ("Chọn cách tính doanh thu trên biểu đồ"). */
  label: string;
  options: ReadonlyArray<{ key: M; label: string }>;
  value: M;
  onChange: (next: M) => void;
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex shrink-0 rounded-lg border border-gray-200 p-0.5">
      {options.map((o) => {
        const active = o.key === value;
        return (
          <button
            key={o.key}
            type="button"
            aria-pressed={active}
            onClick={() => {
              if (!active) onChange(o.key);
            }}
            className={`inline-flex min-h-11 min-w-14 cursor-pointer touch-manipulation items-center justify-center rounded-md px-3 text-sm font-semibold transition-colors motion-reduce:transition-none lg:min-h-9 ${
              active ? "" : "hover:bg-gray-100"
            } ${FOCUS}`}
            style={active ? { background: brandColors.primary, color: "#FFFFFF" } : { color: brandColors.ink }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

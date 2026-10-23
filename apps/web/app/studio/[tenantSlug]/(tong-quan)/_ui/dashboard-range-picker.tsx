"use client";

import type { ComponentProps } from "react";
import { useSearchParams } from "next/navigation";
import { DashboardDateRangePicker } from "../../../../admin/_ui/date-range-picker";
import { dashboardHref, parseStudioChartMetric } from "./dashboard-format";

/**
 * ADR-043/044 — bọc picker dùng chung (`admin/_ui/date-range-picker.tsx`) cho dashboard Tổng quan: dựng URL bằng
 * `dashboardHref` (giữ `?chi-so=`). Cần là Client Component vì hàm dựng link không truyền được từ Server Component.
 * Chỉ số biểu đồ đọc từ URL hiện tại (`useSearchParams`, không phải giá trị server đã render) — nút Gộp / Thực nhận đổi
 * `?chi-so=` bằng `replaceState` ở client (`revenue-chart-switcher.tsx`), Next đồng bộ vào `useSearchParams`.
 */
export function StudioDashboardRangePicker({
  slug,
  ...rest
}: { slug: string } & Omit<ComponentProps<typeof DashboardDateRangePicker>, "hrefForPreset" | "hrefForCustom" | "formMode">) {
  const chiSo = parseStudioChartMetric(useSearchParams().get("chi-so") ?? undefined);
  return (
    <DashboardDateRangePicker
      {...rest}
      hrefForPreset={(key) => dashboardHref(slug, { ky: key, chiSo })}
      hrefForCustom={(tu, den) => dashboardHref(slug, { ky: "tuy-chon", tu, den, chiSo })}
    />
  );
}

"use client";

import type { ComponentProps } from "react";
import { DashboardDateRangePicker } from "../../../../admin/_ui/date-range-picker";
import { dashboardHref, type StudioChartMetric } from "./dashboard-format";

/**
 * ADR-043/044 — bọc picker dùng chung (`admin/_ui/date-range-picker.tsx`) cho dashboard Tổng quan: dựng URL bằng
 * `dashboardHref` (giữ `?chi-so=`). Cần là Client Component vì hàm dựng link không truyền được từ Server Component.
 */
export function StudioDashboardRangePicker({
  slug,
  metric,
  ...rest
}: { slug: string; metric: StudioChartMetric } & Omit<
  ComponentProps<typeof DashboardDateRangePicker>,
  "hrefForPreset" | "hrefForCustom" | "formMode"
>) {
  return (
    <DashboardDateRangePicker
      {...rest}
      hrefForPreset={(key) => dashboardHref(slug, { ky: key, chiSo: metric })}
      hrefForCustom={(tu, den) => dashboardHref(slug, { ky: "tuy-chon", tu, den, chiSo: metric })}
    />
  );
}

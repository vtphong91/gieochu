import { StudioDashboardSkeleton } from "./_ui/dashboard-skeleton";

/** Khung chờ Tổng quan gian hàng (ADR-043) — cũng hiện khi đổi kỳ (`?ky=`) vì đổi searchParams là điều hướng mới. */
export default function Loading() {
  return <StudioDashboardSkeleton />;
}

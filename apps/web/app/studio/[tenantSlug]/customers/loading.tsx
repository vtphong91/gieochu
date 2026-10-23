import { CustomerListSkeleton } from "./_ui/customer-skeleton";

/** Khung chờ danh sách khách (ADR-048) — cũng hiện khi đổi bộ lọc vì đổi searchParams là điều hướng mới. */
export default function Loading() {
  return <CustomerListSkeleton />;
}

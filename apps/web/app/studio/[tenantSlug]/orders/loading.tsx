import { OrderListSkeleton } from "./_ui/order-skeleton";

/** Khung chờ danh sách đơn (ADR-046) — cũng hiện khi đổi bộ lọc vì đổi searchParams là điều hướng mới. */
export default function Loading() {
  return <OrderListSkeleton />;
}

import { AuditLogSkeleton } from "../../../admin/_ui/audit-log-skeleton";

export default function Loading() {
  return <AuditLogSkeleton label="Đang tải hoạt động..." fields={4} />;
}

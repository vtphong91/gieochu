import { AuditLogSkeleton } from "../_ui/audit-log-skeleton";

export default function Loading() {
  return <AuditLogSkeleton label="Đang tải nhật ký hệ thống..." fields={6} />;
}

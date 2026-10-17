-- ADR-037 (M12b chốt định nghĩa số liệu): bảng tenant_daily_stats — số liệu tổng hợp theo tenant + ngày giờ VN.
-- Migration EXPAND: chỉ THÊM bảng + index + khoá ngoại; không đổi bảng hiện có → an toàn với bản code đang chạy
-- (code mới gặp bảng chưa có thì bỏ qua: cron trả { skipped: true }, dashboard trả "unavailable").
--
-- Lớp dữ liệu: L1 (đặc tả §5 "Các bảng L1 khác", §7.9) — KHÔNG bật RLS, cùng mẫu subscriptions/audit_logs (có cột
-- tenantId nhưng là bảng L1): admin đọc bằng getPrismaClient(); chỉ job stats.aggregate (withSystemJob) ghi. Chỉ chứa
-- số đếm/tổng tiền — không email, tên, mã đơn.
-- Khoá ngoại tenant ON DELETE CASCADE (bảng tổng hợp tính lại được — không bất biến như audit_logs).
-- "date" là ngày theo giờ Asia/Ho_Chi_Minh; "updatedAt" TIMESTAMP(3) lưu UTC (Prisma @updatedAt / job ghi now() quy UTC).

-- CreateTable
CREATE TABLE "tenant_daily_stats" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "ordersPaid" INTEGER NOT NULL DEFAULT 0,
    "gmvVnd" BIGINT NOT NULL DEFAULT 0,
    "newCustomers" INTEGER NOT NULL DEFAULT 0,
    "downloads" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_daily_stats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tenant_daily_stats_date_idx" ON "tenant_daily_stats"("date");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_daily_stats_tenantId_date_key" ON "tenant_daily_stats"("tenantId", "date");

-- AddForeignKey
ALTER TABLE "tenant_daily_stats" ADD CONSTRAINT "tenant_daily_stats_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ───────────────────────── Quyền cho role runtime ─────────────────────────
-- ALTER DEFAULT PRIVILEGES (setup-app-role.mts, ADR-010) đã tự cấp SELECT/INSERT/UPDATE/DELETE cho bảng mới; cấp lại
-- tường minh (idempotent) để không phụ thuộc owner nào chạy migration. Job cần INSERT + UPDATE (upsert); DELETE giữ theo
-- mặc định bảng L1 (dọn dữ liệu test/ops) — xoá tenant đi qua CASCADE của khoá ngoại.
-- Bỏ qua nếu môi trường chưa có role gieochu_app (theo mẫu migration RLS/M12a).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'gieochu_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "tenant_daily_stats" TO gieochu_app;
  END IF;
END
$$;

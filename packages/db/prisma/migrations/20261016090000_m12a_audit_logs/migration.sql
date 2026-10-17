-- ADR-037 mục 2 + 3 (M12a): bảng audit_logs — L1, CHỈ INSERT, không khoá ngoại, giữ 12 tháng.
-- Migration EXPAND: chỉ THÊM enum + bảng + index + hàm/trigger + quyền; không đổi bảng hiện có → an toàn với bản code
-- đang chạy (code mới ghi audit tự bỏ qua khi bảng chưa có — apps/web/lib/audit.ts bắt lỗi, không ném).
--
-- Bảo vệ "chỉ INSERT" có 2 lớp:
--   1. Quyền: role runtime gieochu_app chỉ có SELECT, INSERT, DELETE (không UPDATE/TRUNCATE). ALTER DEFAULT PRIVILEGES
--      (setup-app-role.mts, ADR-010) tự cấp SELECT/INSERT/UPDATE/DELETE cho bảng mới → phải REVOKE ở đây.
--      DELETE được cấp CHỈ để cron purge (ADR-037 mục 3) chạy được bằng role app; CỔNG THẬT là trigger bên dưới —
--      quyền DELETE một mình KHÔNG cho xoá được dòng nào.
--   2. Trigger (áp dụng cho MỌI role, kể cả owner — trừ khi owner chủ động tắt trigger):
--      * BEFORE UPDATE  → luôn RAISE.
--      * BEFORE DELETE  → RAISE trừ khi phiên đặt `gieochu.audit_purge = 'on'` (SET LOCAL trong transaction purge)
--                         VÀ dòng cũ hơn 12 tháng.
--      * BEFORE TRUNCATE → luôn RAISE (TRUNCATE không kích hoạt trigger theo dòng, phải chặn riêng).
-- "createdAt" là TIMESTAMP(3) không múi giờ, lưu UTC (Prisma) → so với now() quy về UTC, không phụ thuộc TimeZone
-- của phiên.
-- Partition theo tháng: để sau (ADR-037 mục 4, BACKLOG).

-- CreateEnum
CREATE TYPE "AuditScope" AS ENUM ('SYSTEM', 'TENANT', 'CUSTOMER');

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "scope" "AuditScope" NOT NULL,
    "tenantId" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_tenantId_createdAt_idx" ON "audit_logs"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_actorId_createdAt_idx" ON "audit_logs"("actorId", "createdAt");

-- ───────────────────────── Trigger chặn UPDATE ─────────────────────────
CREATE OR REPLACE FUNCTION "audit_logs_block_update"() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs: rows are append-only (UPDATE not allowed)' USING ERRCODE = '42501';
END;
$$;

CREATE TRIGGER "audit_logs_block_update"
  BEFORE UPDATE ON "audit_logs"
  FOR EACH ROW
  EXECUTE FUNCTION "audit_logs_block_update"();

-- ───────────────────────── Trigger chặn DELETE (trừ purge > 12 tháng) ─────────────────────────
CREATE OR REPLACE FUNCTION "audit_logs_guard_delete"() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_setting('gieochu.audit_purge', true) = 'on'
     AND OLD."createdAt" < (now() AT TIME ZONE 'UTC') - interval '12 months' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'audit_logs: rows are append-only (DELETE only allowed for retention purge of rows older than 12 months)'
    USING ERRCODE = '42501';
END;
$$;

CREATE TRIGGER "audit_logs_guard_delete"
  BEFORE DELETE ON "audit_logs"
  FOR EACH ROW
  EXECUTE FUNCTION "audit_logs_guard_delete"();

-- ───────────────────────── Trigger chặn TRUNCATE ─────────────────────────
CREATE OR REPLACE FUNCTION "audit_logs_block_truncate"() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs: TRUNCATE not allowed' USING ERRCODE = '42501';
END;
$$;

CREATE TRIGGER "audit_logs_block_truncate"
  BEFORE TRUNCATE ON "audit_logs"
  FOR EACH STATEMENT
  EXECUTE FUNCTION "audit_logs_block_truncate"();

-- ───────────────────────── Quyền cho role runtime ─────────────────────────
-- REVOKE ALL trước (gỡ UPDATE mà ALTER DEFAULT PRIVILEGES vừa tự cấp), rồi cấp đúng SELECT, INSERT, DELETE.
-- Bỏ qua nếu môi trường chưa có role gieochu_app (theo mẫu migration RLS, ADR-010). Idempotent.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'gieochu_app') THEN
    REVOKE ALL ON "audit_logs" FROM gieochu_app;
    GRANT SELECT, INSERT, DELETE ON "audit_logs" TO gieochu_app;
    GRANT EXECUTE ON FUNCTION "audit_logs_block_update"() TO gieochu_app;
    GRANT EXECUTE ON FUNCTION "audit_logs_guard_delete"() TO gieochu_app;
    GRANT EXECUTE ON FUNCTION "audit_logs_block_truncate"() TO gieochu_app;
  END IF;
END
$$;

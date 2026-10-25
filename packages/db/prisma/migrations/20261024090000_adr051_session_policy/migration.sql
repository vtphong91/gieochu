-- ADR-051 GĐ B: chính sách phiên đăng nhập ("Ghi nhớ đăng nhập", idle/absolute timeout, danh sách thiết bị).
-- Migration EXPAND: chỉ THÊM cột (có DEFAULT hằng hoặc NULL — Postgres 11+ không rewrite bảng) + 2 index. Không đổi/xoá
-- cột có sẵn. "system_settings"."refreshTokenTtlDays" giữ nguyên (code cũ còn đọc); chỉ bỏ ở migration contract sau khi
-- code ADR-051 đã lên prod.
--
-- THỨ TỰ DEPLOY: chạy migration này TRƯỚC khi deploy code ADR-051 GĐ B. Code hiện tại (GĐ A) chạy trên schema mới không
-- sao: Prisma không đọc cột nó không biết; INSERT "refresh_tokens" nhận DEFAULT (rememberMe=false, các cột mới NULL).
--
-- Lớp dữ liệu: cả 2 bảng là L1 (không "tenantId") → không RLS. gieochu_app đã có SELECT/INSERT/UPDATE/DELETE trên mọi
-- bảng public (setup-app-role) — cron dọn token (DELETE) không cần GRANT mới.
--
-- Phiên có sẵn: rememberMe=false, sessionStartedAt=NULL → code GĐ B coi sessionStartedAt NULL là "bắt đầu tại lần rotate
-- đầu tiên sau deploy" (không đăng xuất hàng loạt ngay lúc deploy).

-- AlterTable
ALTER TABLE "refresh_tokens" ADD COLUMN     "deviceLabel" TEXT,
ADD COLUMN     "rememberMe" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sessionStartedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "system_settings" ADD COLUMN     "adminAbsoluteHours" INTEGER NOT NULL DEFAULT 8,
ADD COLUMN     "adminIdleMinutes" INTEGER NOT NULL DEFAULT 15,
ADD COLUMN     "rememberMeDays" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "sessionAbsoluteHours" INTEGER NOT NULL DEFAULT 12,
ADD COLUMN     "sessionIdleMinutes" INTEGER NOT NULL DEFAULT 60,
ADD COLUMN     "sessionWarningMinutes" INTEGER NOT NULL DEFAULT 2;

-- CreateIndex (cron /api/cron/daily: xoá bản ghi hết hạn / đã thu hồi quá 90 ngày)
CREATE INDEX "refresh_tokens_expiresAt_idx" ON "refresh_tokens"("expiresAt");

-- CreateIndex
CREATE INDEX "refresh_tokens_revokedAt_idx" ON "refresh_tokens"("revokedAt");

-- ADR-061 + ADR-062 — đợt 1 luồng mua: khách vãng lai, hạn giữ đơn theo phương thức, "Tôi đã chuyển khoản", mốc chống
-- gửi sót/trùng email, bộ đếm rate limit dùng chung.
--
-- Migration EXPAND (ADR-034): chỉ THÊM giá trị enum / cột (NULL hoặc DEFAULT hằng — Postgres 11+ không rewrite bảng) / bảng /
-- index. Không DROP, không RENAME, không đổi kiểu, không UPDATE dữ liệu. Code đang chạy (prod) không đọc cột mới — Prisma chỉ
-- select cột nó biết; INSERT nhận DEFAULT.
--
-- THỨ TỰ: (1) migration B3 `20261026150000_adr059_momo_manual` (MOMO_MANUAL) chạy trước — migration này chỉ dùng KIỂU
-- "PaymentProviderId", không dùng giá trị MOMO_MANUAL. (2) chạy migration này. (3) mới `prisma generate` + deploy code đợt 1.
--
-- Enum: `ALTER TYPE … ADD VALUE` chạy được trong transaction (PG ≥ 12) nhưng giá trị mới KHÔNG được dùng trong cùng
-- transaction — migration này không có câu nào dùng 'GUEST_ACTIVATION'.
--
-- Lớp dữ liệu: "users", "refresh_tokens", "system_settings", "rate_limit_counters" là L1 (không "tenantId") → không RLS.
-- "orders" là L2 — chỉ thêm cột, policy RLS hiện có (`rls_m8`) áp nguyên cho mọi cột, không cần đổi policy.

-- AlterEnum
ALTER TYPE "VerificationTokenType" ADD VALUE IF NOT EXISTS 'GUEST_ACTIVATION';

-- AlterTable — ADR-061 Q1: tài khoản khách vãng lai chưa tự đặt mật khẩu (tài khoản có sẵn: true).
ALTER TABLE "users" ADD COLUMN     "hasPassword" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable — ADR-061 Q1: phiên cấp lúc khách vãng lai tạo tài khoản ở trang thanh toán (user còn PENDING).
ALTER TABLE "refresh_tokens" ADD COLUMN     "guestCheckout" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable — ADR-061/062: hạn giữ đơn theo phương thức (giờ, tính từ lúc đặt đơn).
ALTER TABLE "system_settings" ADD COLUMN     "orderHoldAutoHours" INTEGER NOT NULL DEFAULT 48,
ADD COLUMN     "orderHoldManualHours" INTEGER NOT NULL DEFAULT 72;

-- AlterTable — ADR-062 Q1 + ADR-061 Q7/Q9/Q10: "Tôi đã chuyển khoản" + mốc email (nhận nguyên tử `WHERE col IS NULL`).
ALTER TABLE "orders" ADD COLUMN     "customerDeclaredPaidAt" TIMESTAMP(3),
ADD COLUMN     "customerPaymentEmailedAt" TIMESTAMP(3),
ADD COLUMN     "customerPaymentEmailedProvider" "PaymentProviderId",
ADD COLUMN     "customerReminderSentAt" TIMESTAMP(3),
ADD COLUMN     "ownerDeclaredPaidNotifiedAt" TIMESTAMP(3),
ADD COLUMN     "ownerManualNotifiedAt" TIMESTAMP(3);

-- CreateTable — ADR-061 Q1: rate limit dùng chung giữa các instance (key đã băm, không IP/email thô).
CREATE TABLE "rate_limit_counters" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "resetAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rate_limit_counters_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "rate_limit_counters_key_key" ON "rate_limit_counters"("key");

-- CreateIndex (cron hằng ngày xoá dòng hết hạn)
CREATE INDEX "rate_limit_counters_resetAt_idx" ON "rate_limit_counters"("resetAt");

-- CreateIndex (ADR-061 Q7: cron nhắc khách + sweep hết hạn quét theo status + expiresAt)
CREATE INDEX "orders_status_expiresAt_idx" ON "orders"("status", "expiresAt");

-- Quyền cho role ứng dụng: `setup-app-role` đã đặt ALTER DEFAULT PRIVILEGES cho role owner (role chạy migration) nên bảng mới
-- tự có SELECT/INSERT/UPDATE/DELETE. GRANT lại ở đây (idempotent) phòng trường hợp migration chạy bằng role khác owner đã đặt
-- default privileges; bỏ qua nếu môi trường không có role `gieochu_app` (DB local mới).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'gieochu_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "rate_limit_counters" TO gieochu_app;
  END IF;
END
$$;

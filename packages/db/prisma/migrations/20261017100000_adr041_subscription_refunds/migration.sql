-- ADR-041 B (+ bổ sung): hoàn tiền gói trả phí — 7 ngày, chỉ lần thanh toán gói đầu tiên, hoàn 100%, admin chuyển tay.
-- Migration EXPAND: chỉ THÊM 1 giá trị enum, 1 enum mới, 1 bảng L1 mới + CHECK + quyền. Không DROP/RENAME, không rewrite
-- bảng có sẵn.
--
-- AlterEnum: `ALTER TYPE ... ADD VALUE` chạy được trong transaction từ PG 12 (Neon PG 16) với điều kiện KHÔNG dùng giá
-- trị mới trong cùng transaction — migration này không tham chiếu 'REFUNDED' của "SubscriptionInvoiceStatus" ở đâu
-- (CHECK bên dưới chỉ dùng enum mới "SubscriptionRefundStatus", tạo bằng CREATE TYPE nên dùng ngay được).
-- Cùng mẫu 20260928090000_m10b_posts và 20261017090000_adr041_email_change.
--
-- THỨ TỰ DEPLOY: code ADR-041 B chạy được TRƯỚC migration này (không có cột mới trên bảng có sẵn; truy vấn bảng mới
-- bắt lỗi P2021 → Studio/System Center hiện "chức năng hoàn tiền chưa sẵn sàng", không 500). Vẫn nên chạy migration
-- trước deploy để chức năng dùng được ngay. Code cũ chạy trên schema mới không sao (giá trị enum chưa ai ghi; bảng mới
-- không ai đọc).
--
-- Lớp dữ liệu: "subscription_refund_requests" là L1 (billing nền tảng, PaymentScope PLATFORM — như subscription_invoices),
-- KHÔNG bật RLS. Chủ gian hàng chỉ đọc/tạo dòng của tenant mình (requireTenantMember OWNER), admin duyệt
-- (requireRole SYSTEM_ADMIN). "payoutEncrypted" = thông tin nhận tiền hoàn (ngân hàng, số TK, tên chủ TK) mã hoá
-- AES-256-GCM bằng PAYMENT_ENCRYPTION_KEY — dữ liệu cá nhân, chỉ admin giải mã, bắt buộc NULL khi đã xử lý xong.

-- AlterEnum
ALTER TYPE "SubscriptionInvoiceStatus" ADD VALUE 'REFUNDED';

-- CreateEnum
CREATE TYPE "SubscriptionRefundStatus" AS ENUM ('REQUESTED', 'APPROVED_REFUNDED', 'REJECTED');

-- CreateTable
CREATE TABLE "subscription_refund_requests" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "reason" TEXT,
    "payoutEncrypted" TEXT,
    "status" "SubscriptionRefundStatus" NOT NULL DEFAULT 'REQUESTED',
    "amountVnd" INTEGER NOT NULL,
    "adminNote" TEXT,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscription_refund_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "subscription_refund_requests_tenantId_key" ON "subscription_refund_requests"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_refund_requests_invoiceId_key" ON "subscription_refund_requests"("invoiceId");

-- CreateIndex
CREATE INDEX "subscription_refund_requests_status_createdAt_idx" ON "subscription_refund_requests"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "subscription_refund_requests" ADD CONSTRAINT "subscription_refund_requests_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_refund_requests" ADD CONSTRAINT "subscription_refund_requests_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "subscription_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ───────────────────────── CHECK: hình dạng theo trạng thái ─────────────────────────
-- Tiền hoàn là số nguyên dương (hoá đơn 0đ không được yêu cầu).
ALTER TABLE "subscription_refund_requests" ADD CONSTRAINT "subscription_refund_requests_amount_positive"
  CHECK ("amountVnd" > 0);

-- REQUESTED ⇔ chưa quyết (không decidedAt/decidedById/refundedAt) và PHẢI có thông tin nhận tiền (mã hoá).
-- Đã quyết (APPROVED_REFUNDED/REJECTED) ⇔ có decidedAt + decidedById và thông tin nhận tiền đã bị xoá (NULL).
-- refundedAt chỉ có ở APPROVED_REFUNDED; REJECTED bắt buộc có lý do (adminNote).
ALTER TABLE "subscription_refund_requests" ADD CONSTRAINT "subscription_refund_requests_status_shape"
  CHECK (
    (
      "status" = 'REQUESTED'
      AND "payoutEncrypted" IS NOT NULL
      AND "decidedAt" IS NULL AND "decidedById" IS NULL AND "refundedAt" IS NULL
    )
    OR (
      "status" = 'APPROVED_REFUNDED'
      AND "payoutEncrypted" IS NULL
      AND "decidedAt" IS NOT NULL AND "decidedById" IS NOT NULL AND "refundedAt" IS NOT NULL
    )
    OR (
      "status" = 'REJECTED'
      AND "payoutEncrypted" IS NULL
      AND "decidedAt" IS NOT NULL AND "decidedById" IS NOT NULL AND "refundedAt" IS NULL
      AND "adminNote" IS NOT NULL AND length(btrim("adminNote")) > 0
    )
  );

ALTER TABLE "subscription_refund_requests" ADD CONSTRAINT "subscription_refund_requests_text_length"
  CHECK (
    ("reason" IS NULL OR length("reason") <= 500)
    AND ("adminNote" IS NULL OR length("adminNote") <= 500)
  );

-- ALTER DEFAULT PRIVILEGES (setup-app-role.mts, ADR-010) đã cấp DML cho bảng mới; GRANT tường minh để migration
-- tự đủ nghĩa (idempotent, bỏ qua nếu môi trường chưa có role gieochu_app).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'gieochu_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "subscription_refund_requests" TO gieochu_app;
  END IF;
END
$$;

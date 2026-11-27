-- ADR-074 mục 4 — Gắn nhãn gian hàng cho nhật ký email: hai trang đọc nhật ký (chi tiết đơn Studio, chi tiết đơn hàng gói) lọc
-- theo gian hàng thay vì đoán theo người nhận/loại email.
--
-- Migration EXPAND (ADR-034): chỉ THÊM 1 cột NULL + 1 index. Không DROP, không RENAME, không đổi kiểu, không UPDATE dữ liệu — dòng
-- cũ giữ "tenantId" = NULL (code đọc coi NULL là "chưa biết gian hàng" và giữ cách khớp cũ). KHÔNG tạo khoá ngoại: "email_send_log"
-- là bảng L1 chỉ ghi nhật ký, dòng log không được chặn việc xoá gian hàng.
--
-- THỨ TỰ TRIỂN KHAI: chạy migration này TRƯỚC khi deploy code mới (code mới ghi/đọc cột "tenantId" sẽ lỗi nếu cột chưa có).
--
-- Lớp dữ liệu: "email_send_log" là L1 (không RLS) — cột mới chỉ là nhãn, không đổi lớp dữ liệu.

-- AlterTable
ALTER TABLE "email_send_log" ADD COLUMN "tenantId" TEXT;

-- CreateIndex
CREATE INDEX "email_send_log_tenantId_createdAt_idx" ON "email_send_log"("tenantId", "createdAt");

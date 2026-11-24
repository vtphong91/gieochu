-- ADR-065 — Mã thanh toán SePay của đơn hàng gian hàng (nội dung chuyển khoản) = tiền tố SePay + 8 chữ số, tách khỏi mã đơn.
--
-- Migration EXPAND (ADR-034): chỉ THÊM 1 cột NULL + 1 unique index. Không DROP, không RENAME, không đổi kiểu, không UPDATE dữ
-- liệu. Code đang chạy không đọc cột mới (Prisma chỉ select cột nó biết) → an toàn khi chạy trước deploy.
--
-- Lớp dữ liệu: "orders" là L2 — chỉ thêm cột, policy RLS hiện có áp nguyên cho mọi cột, không cần đổi policy. Unique theo
-- (tenantId, paymentRef): NULL không đụng nhau trong Postgres nên đơn chưa chọn SePay không bị ràng buộc.

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "paymentRef" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "orders_tenantId_paymentRef_key" ON "orders"("tenantId", "paymentRef");

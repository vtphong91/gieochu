-- ADR-068 mục 8 — Mốc tính hạn giữ đơn theo phương thức thanh toán: hạn = COALESCE("holdStartedAt", "createdAt") + số giờ của
-- phương thức. Người bán mở lại đơn đặt "holdStartedAt" = thời điểm mở lại (đơn tạo > 72 giờ vẫn chọn được cách trả).
--
-- Migration EXPAND (ADR-034): chỉ THÊM 1 cột NULL. Không DROP, không RENAME, không đổi kiểu, không UPDATE dữ liệu. Code đang chạy
-- không đọc cột mới (Prisma chỉ select cột nó biết) → an toàn khi chạy trước deploy; NULL = dùng "createdAt" như hành vi cũ.
--
-- Lớp dữ liệu: "orders" là L2 — chỉ thêm cột, policy RLS hiện có áp nguyên cho mọi cột, không cần đổi policy.

-- AlterTable
ALTER TABLE "orders" ADD COLUMN "holdStartedAt" TIMESTAMP(3);

-- ADR-059 bổ sung lần 3 (B3): provider MoMo cá nhân xác nhận tay. Expand-only (ADR-034): chỉ thêm giá trị enum, không đổi dữ liệu.
-- Postgres: giá trị enum mới chỉ dùng được SAU khi transaction chứa lệnh này commit — không dùng nó trong cùng migration.
ALTER TYPE "PaymentProviderId" ADD VALUE IF NOT EXISTS 'MOMO_MANUAL';

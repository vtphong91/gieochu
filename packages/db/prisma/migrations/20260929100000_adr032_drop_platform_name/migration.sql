-- ADR-032 (Quốc chốt 2026-09-29): tên nền tảng chỉ lấy từ system_branding / DEFAULT_BRAND —
-- bỏ cột trùng lặp platformName (không nơi nào đọc).
ALTER TABLE "system_settings" DROP COLUMN "platformName";

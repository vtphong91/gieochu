-- ADR-032: cấu hình hệ thống lưu DB (System Center), bỏ khỏi env.
-- Bảng L1 (không tenantId) — không RLS, cùng lớp với system_branding/system_smtp_config.

-- Cột cũ: tên nền tảng/email hỗ trợ không còn bắt buộc (thương hiệu lấy từ system_branding).
ALTER TABLE "system_settings" ALTER COLUMN "platformName" DROP NOT NULL;
ALTER TABLE "system_settings" ALTER COLUMN "supportEmail" DROP NOT NULL;
ALTER TABLE "system_settings" ALTER COLUMN "trialDays" SET DEFAULT 14;
ALTER TABLE "system_settings" ALTER COLUMN "graceDays" SET DEFAULT 7;

ALTER TABLE "system_settings"
  ADD COLUMN "accessTokenTtlMinutes" INTEGER NOT NULL DEFAULT 15,
  ADD COLUMN "refreshTokenTtlDays" INTEGER NOT NULL DEFAULT 7,
  ADD COLUMN "emailVerifyTtlHours" INTEGER NOT NULL DEFAULT 24,
  ADD COLUMN "passwordResetTtlMinutes" INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN "presignUploadTtlSeconds" INTEGER NOT NULL DEFAULT 600,
  ADD COLUMN "presignDownloadTtlSeconds" INTEGER NOT NULL DEFAULT 600,
  ADD COLUMN "orderPendingTtlMinutes" INTEGER NOT NULL DEFAULT 60,
  ADD COLUMN "invoicePendingTtlHours" INTEGER NOT NULL DEFAULT 24,
  ADD COLUMN "defaultDownloadLimit" INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN "updatedById" TEXT;

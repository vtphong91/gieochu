-- ADR-038 (M12c): báo cáo vi phạm + khoá kiểm duyệt + cam kết bản quyền.
-- Migration EXPAND: chỉ THÊM enum, bảng L1 "abuse_reports", cột nullable trên products/reviews/posts, CHECK (mọi dòng
-- hiện có đều thoả vì cột mới = NULL), trigger guard và quyền. Không DROP/RENAME gì.
--
-- ⚠️ THỨ TỰ DEPLOY: chạy migration này TRƯỚC khi deploy code M12c. Code M12c đọc các cột mới của products/reviews/posts
-- (Prisma chọn đủ cột của model) → nếu code lên trước, mọi truy vấn sản phẩm/đánh giá/bài viết lỗi P2022 (500). Ngược
-- lại code cũ chạy trên schema mới không sao (cột mới nullable, trigger chỉ chặn đổi cột mới / đổi status khi đang khoá
-- — code cũ không bao giờ đặt khoá nên không bao giờ chạm điều kiện chặn).
--
-- Lớp dữ liệu:
--   * "abuse_reports" — L1 (đặc tả §5 "Các bảng L1 khác"), KHÔNG bật RLS, cùng mẫu audit_logs/tenant_daily_stats: chỉ
--     System Admin đọc/ghi qua apps/web/lib/abuse-report.ts (getPrismaClient hoặc trong transaction withSystemJob);
--     route POST /api/reports chỉ INSERT. Tenant không có đường đọc nào (ADR-038 mục 4: ẩn danh với tenant).
--   * Cột "moderationLockedAt"/"moderationReason" trên products/reviews/posts (L2, RLS giữ nguyên — policy hiện có
--     không tham chiếu cột mới nên không cần đổi). Chỉ scope 'system_job' (admin xử lý báo cáo) được đặt/gỡ; khi đang
--     khoá, scope khác không đổi được trạng thái hiển thị → trigger "<bảng>_guard_moderation" (mẫu posts_guard_columns,
--     ADR-029: không dùng được column GRANT vì mọi scope chung role gieochu_app).
--   * "products"."rightsConfirmedAt"/"rightsConfirmedById" — tenant ghi khi xuất bản (ADR-038 mục 7), không FK.

-- CreateEnum
CREATE TYPE "AbuseTargetType" AS ENUM ('PRODUCT', 'REVIEW', 'POST');

-- CreateEnum
CREATE TYPE "AbuseReportType" AS ENUM ('COPYRIGHT', 'INAPPROPRIATE', 'SCAM', 'OTHER');

-- CreateEnum
CREATE TYPE "AbuseReportStatus" AS ENUM ('OPEN', 'RESOLVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AbuseReportDecision" AS ENUM ('HIDE_CONTENT', 'ARCHIVE_PRODUCT', 'LOCK_TENANT', 'REJECT');

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "moderationLockedAt" TIMESTAMP(3),
ADD COLUMN     "moderationReason" TEXT,
ADD COLUMN     "rightsConfirmedAt" TIMESTAMP(3),
ADD COLUMN     "rightsConfirmedById" TEXT;

-- AlterTable
ALTER TABLE "reviews" ADD COLUMN     "moderationLockedAt" TIMESTAMP(3),
ADD COLUMN     "moderationReason" TEXT;

-- AlterTable
ALTER TABLE "posts" ADD COLUMN     "moderationLockedAt" TIMESTAMP(3),
ADD COLUMN     "moderationReason" TEXT;

-- CreateTable
CREATE TABLE "abuse_reports" (
    "id" TEXT NOT NULL,
    "targetType" "AbuseTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" "AbuseReportType" NOT NULL,
    "description" TEXT NOT NULL,
    "evidenceUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "reporterUserId" TEXT,
    "reporterEmail" TEXT NOT NULL,
    "ip" TEXT,
    "status" "AbuseReportStatus" NOT NULL DEFAULT 'OPEN',
    "decision" "AbuseReportDecision",
    "resolutionNote" TEXT,
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "abuse_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "abuse_reports_status_createdAt_idx" ON "abuse_reports"("status", "createdAt");

-- CreateIndex
CREATE INDEX "abuse_reports_targetType_targetId_idx" ON "abuse_reports"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "abuse_reports_tenantId_createdAt_idx" ON "abuse_reports"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "abuse_reports_ip_createdAt_idx" ON "abuse_reports"("ip", "createdAt");

-- CreateIndex
CREATE INDEX "abuse_reports_reporterUserId_idx" ON "abuse_reports"("reporterUserId");

-- CreateIndex
CREATE INDEX "abuse_reports_resolvedById_idx" ON "abuse_reports"("resolvedById");

-- AddForeignKey
ALTER TABLE "abuse_reports" ADD CONSTRAINT "abuse_reports_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "abuse_reports" ADD CONSTRAINT "abuse_reports_reporterUserId_fkey" FOREIGN KEY ("reporterUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "abuse_reports" ADD CONSTRAINT "abuse_reports_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ───────────────────────── CHECK: abuse_reports ─────────────────────────
-- Mô tả 1–2000 ký tự, ≤5 link bằng chứng (ADR-038 mục 1). Định dạng email/URL kiểm ở server (zod).
ALTER TABLE "abuse_reports" ADD CONSTRAINT "abuse_reports_description_length"
  CHECK (char_length("description") BETWEEN 1 AND 2000);

ALTER TABLE "abuse_reports" ADD CONSTRAINT "abuse_reports_evidence_count"
  CHECK (COALESCE(cardinality("evidenceUrls"), 0) <= 5);

ALTER TABLE "abuse_reports" ADD CONSTRAINT "abuse_reports_reporter_email_length"
  CHECK (char_length("reporterEmail") BETWEEN 3 AND 320);

-- OPEN ⇔ chưa có quyết định; REJECTED ⇔ REJECT; RESOLVED ⇔ 1 trong 3 biện pháp. Đã xử lý thì phải có resolvedAt.
ALTER TABLE "abuse_reports" ADD CONSTRAINT "abuse_reports_decision_shape"
  CHECK (
    ("status" = 'OPEN' AND "decision" IS NULL AND "resolvedAt" IS NULL)
    OR ("status" = 'REJECTED' AND "decision" = 'REJECT' AND "resolvedAt" IS NOT NULL)
    OR (
      "status" = 'RESOLVED'
      AND "decision" IN ('HIDE_CONTENT', 'ARCHIVE_PRODUCT', 'LOCK_TENANT')
      AND "resolvedAt" IS NOT NULL
    )
  );

-- ───────────────────────── CHECK: khoá kiểm duyệt đi cùng trạng thái ẩn ─────────────────────────
-- Khoá chỉ tồn tại khi nội dung đang ẩn/lưu trữ — admin gỡ khoá bài viết thì chuyển HIDDEN → DRAFT trong cùng lệnh.
ALTER TABLE "products" ADD CONSTRAINT "products_moderation_shape"
  CHECK ("moderationLockedAt" IS NULL OR "status" = 'ARCHIVED');

ALTER TABLE "reviews" ADD CONSTRAINT "reviews_moderation_shape"
  CHECK ("moderationLockedAt" IS NULL OR "status" = 'HIDDEN');

ALTER TABLE "posts" ADD CONSTRAINT "posts_moderation_shape"
  CHECK ("moderationLockedAt" IS NULL OR "status" = 'HIDDEN');

-- ───────────────────────── Trigger: products ─────────────────────────
-- Ngoài system_job: không tạo dòng có khoá, không đặt/gỡ khoá, không đổi status khi đang khoá. Role owner (migration,
-- script vận hành) không đặt app.scope → cũng bị áp như scope thường (an toàn: thao tác kiểm duyệt phải qua system_job).
CREATE OR REPLACE FUNCTION "products_guard_moderation"() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_setting('app.scope', true) = 'system_job' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW."moderationLockedAt" IS NOT NULL OR NEW."moderationReason" IS NOT NULL THEN
      RAISE EXCEPTION 'products: moderation columns can only be set by the system' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW."moderationLockedAt" IS DISTINCT FROM OLD."moderationLockedAt"
     OR NEW."moderationReason" IS DISTINCT FROM OLD."moderationReason" THEN
    RAISE EXCEPTION 'products: moderation columns can only be changed by the system' USING ERRCODE = '42501';
  END IF;

  IF OLD."moderationLockedAt" IS NOT NULL AND NEW."status" IS DISTINCT FROM OLD."status" THEN
    RAISE EXCEPTION 'products: status is locked by moderation' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "products_guard_moderation"
  BEFORE INSERT OR UPDATE ON "products"
  FOR EACH ROW
  EXECUTE FUNCTION "products_guard_moderation"();

-- ───────────────────────── Trigger: reviews ─────────────────────────
-- Bổ sung cho "reviews_guard_columns" (trigger đó giới hạn cột theo scope customer/tenant nhưng không biết cột mới).
CREATE OR REPLACE FUNCTION "reviews_guard_moderation"() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_setting('app.scope', true) = 'system_job' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW."moderationLockedAt" IS NOT NULL OR NEW."moderationReason" IS NOT NULL THEN
      RAISE EXCEPTION 'reviews: moderation columns can only be set by the system' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW."moderationLockedAt" IS DISTINCT FROM OLD."moderationLockedAt"
     OR NEW."moderationReason" IS DISTINCT FROM OLD."moderationReason" THEN
    RAISE EXCEPTION 'reviews: moderation columns can only be changed by the system' USING ERRCODE = '42501';
  END IF;

  IF OLD."moderationLockedAt" IS NOT NULL
     AND (NEW."status" IS DISTINCT FROM OLD."status"
          OR NEW."hiddenReason" IS DISTINCT FROM OLD."hiddenReason"
          OR NEW."hiddenAt" IS DISTINCT FROM OLD."hiddenAt") THEN
    RAISE EXCEPTION 'reviews: visibility is locked by moderation' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "reviews_guard_moderation"
  BEFORE INSERT OR UPDATE ON "reviews"
  FOR EACH ROW
  EXECUTE FUNCTION "reviews_guard_moderation"();

-- ───────────────────────── Trigger: posts ─────────────────────────
-- "posts_guard_columns" đã chặn tenant đặt/gỡ HIDDEN; trigger này thêm cột khoá + chặn đổi status khi đang khoá.
CREATE OR REPLACE FUNCTION "posts_guard_moderation"() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_setting('app.scope', true) = 'system_job' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW."moderationLockedAt" IS NOT NULL OR NEW."moderationReason" IS NOT NULL THEN
      RAISE EXCEPTION 'posts: moderation columns can only be set by the system' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW."moderationLockedAt" IS DISTINCT FROM OLD."moderationLockedAt"
     OR NEW."moderationReason" IS DISTINCT FROM OLD."moderationReason" THEN
    RAISE EXCEPTION 'posts: moderation columns can only be changed by the system' USING ERRCODE = '42501';
  END IF;

  IF OLD."moderationLockedAt" IS NOT NULL AND NEW."status" IS DISTINCT FROM OLD."status" THEN
    RAISE EXCEPTION 'posts: status is locked by moderation' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "posts_guard_moderation"
  BEFORE INSERT OR UPDATE ON "posts"
  FOR EACH ROW
  EXECUTE FUNCTION "posts_guard_moderation"();

-- ───────────────────────── Quyền cho role runtime ─────────────────────────
-- ALTER DEFAULT PRIVILEGES (setup-app-role.mts, ADR-010) đã tự cấp SELECT/INSERT/UPDATE/DELETE cho bảng mới; cấp lại
-- tường minh (idempotent) để không phụ thuộc owner nào chạy migration. Route gửi báo cáo cần INSERT; admin xử lý +
-- cron xoá IP cần UPDATE; DELETE giữ theo mặc định bảng L1 (dọn dữ liệu test/vận hành — ứng dụng không xoá báo cáo).
-- products/reviews/posts đã có GRANT từ migration RLS tương ứng; chỉ cấp EXECUTE cho hàm trigger mới.
-- Bỏ qua nếu môi trường chưa có role gieochu_app (theo mẫu migration RLS/M12a/M12b).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'gieochu_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "abuse_reports" TO gieochu_app;
    GRANT EXECUTE ON FUNCTION "products_guard_moderation"() TO gieochu_app;
    GRANT EXECUTE ON FUNCTION "reviews_guard_moderation"() TO gieochu_app;
    GRANT EXECUTE ON FUNCTION "posts_guard_moderation"() TO gieochu_app;
  END IF;
END
$$;

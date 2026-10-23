-- ADR-050 mục 3: Điều khoản sử dụng có phiên bản + ghi nhận chấp thuận theo phiên bản.
-- Migration EXPAND: chỉ THÊM 2 enum, 3 bảng L1 mới + index + FK + CHECK + trigger + quyền. Không đổi/xoá gì của bảng
-- có sẵn (quan hệ mới trên "users" là quan hệ ngược — không thêm cột).
--
-- THỨ TỰ DEPLOY: code cũ chạy trên schema mới không sao (không ai đọc bảng mới). Code ADR-050 mục 3 cần migration này
-- chạy TRƯỚC (đăng ký đọc bản Điều khoản PUBLISHED; bảng chưa có → lỗi P2021 được bắt, đăng ký giữ hành vi cũ).
--
-- Lớp dữ liệu: cả 3 bảng là L1 (nội dung/ghi nhận hệ thống, không "tenantId") → KHÔNG bật RLS, đọc/ghi bằng
-- getPrismaClient(); ghi văn bản chỉ qua Server Action requireRole("SYSTEM_ADMIN") + audit_logs.
-- "user_legal_acceptances" KHÔNG lưu IP/User-Agent (chủ dự án chốt) và append-only với gieochu_app (không UPDATE).

-- CreateEnum
CREATE TYPE "LegalDocumentVersionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "LegalReviewStatus" AS ENUM ('PENDING_LEGAL_REVIEW', 'APPROVED');

-- CreateTable
CREATE TABLE "legal_documents" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "legal_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legal_document_versions" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "LegalDocumentVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "reviewStatus" "LegalReviewStatus" NOT NULL DEFAULT 'PENDING_LEGAL_REVIEW',
    "contentHtml" TEXT NOT NULL,
    "changeSummary" TEXT,
    "effectiveAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "publishedById" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "legal_document_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_legal_acceptances" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_legal_acceptances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "legal_documents_key_key" ON "legal_documents"("key");

-- CreateIndex
CREATE UNIQUE INDEX "legal_documents_slug_key" ON "legal_documents"("slug");

-- CreateIndex
CREATE INDEX "legal_document_versions_documentId_status_effectiveAt_idx" ON "legal_document_versions"("documentId", "status", "effectiveAt");

-- CreateIndex
CREATE UNIQUE INDEX "legal_document_versions_documentId_version_key" ON "legal_document_versions"("documentId", "version");

-- CreateIndex
CREATE INDEX "user_legal_acceptances_versionId_idx" ON "user_legal_acceptances"("versionId");

-- CreateIndex
CREATE UNIQUE INDEX "user_legal_acceptances_userId_versionId_key" ON "user_legal_acceptances"("userId", "versionId");

-- AddForeignKey
ALTER TABLE "legal_document_versions" ADD CONSTRAINT "legal_document_versions_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "legal_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_legal_acceptances" ADD CONSTRAINT "user_legal_acceptances_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_legal_acceptances" ADD CONSTRAINT "user_legal_acceptances_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "legal_document_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ───────────────────────── CHECK ─────────────────────────
-- Khoá/slug: chữ thường, số, gạch nối (khớp segment URL `/phap-ly/{slug}`).
ALTER TABLE "legal_documents" ADD CONSTRAINT "legal_documents_key_format"
  CHECK ("key" ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND "slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

-- Số phiên bản dương; bản đã phát hành (PUBLISHED/ARCHIVED) bắt buộc có ngày hiệu lực + ngày phát hành; nội dung ≤ 200k ký tự.
ALTER TABLE "legal_document_versions" ADD CONSTRAINT "legal_document_versions_shape"
  CHECK (
    "version" >= 1
    AND char_length("contentHtml") <= 200000
    AND ("changeSummary" IS NULL OR char_length("changeSummary") <= 1000)
    AND ("status" = 'DRAFT' OR ("effectiveAt" IS NOT NULL AND "publishedAt" IS NOT NULL))
  );

-- ───────────────────────── Trigger: phiên bản đã phát hành bất biến nội dung ─────────────────────────
-- Cho phép duy nhất PUBLISHED → ARCHIVED (lưu trữ bản cũ) và đổi reviewStatus; mọi thay đổi nội dung/số phiên bản/ngày
-- hiệu lực của bản không còn DRAFT bị từ chối — sửa = tạo phiên bản mới. Không cho quay về DRAFT.
CREATE OR REPLACE FUNCTION "legal_document_versions_freeze_content"() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD."status" <> 'DRAFT' THEN
    IF NEW."contentHtml" IS DISTINCT FROM OLD."contentHtml"
      OR NEW."version" IS DISTINCT FROM OLD."version"
      OR NEW."documentId" IS DISTINCT FROM OLD."documentId"
      OR NEW."effectiveAt" IS DISTINCT FROM OLD."effectiveAt"
      OR NEW."publishedAt" IS DISTINCT FROM OLD."publishedAt"
      OR NEW."changeSummary" IS DISTINCT FROM OLD."changeSummary"
      OR NEW."status" = 'DRAFT'
      OR (OLD."status" = 'ARCHIVED' AND NEW."status" <> 'ARCHIVED') THEN
      RAISE EXCEPTION 'legal_document_versions: published versions are immutable (create a new version instead)' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "legal_document_versions_freeze_content"
  BEFORE UPDATE ON "legal_document_versions"
  FOR EACH ROW
  EXECUTE FUNCTION "legal_document_versions_freeze_content"();

-- ───────────────────────── Quyền ─────────────────────────
-- ALTER DEFAULT PRIVILEGES (setup-app-role.mts, ADR-010) đã tự cấp SELECT/INSERT/UPDATE/DELETE cho bảng mới. GRANT
-- tường minh để migration tự đủ nghĩa; "user_legal_acceptances" REVOKE ALL rồi chỉ cấp SELECT, INSERT, DELETE (DELETE để
-- dọn dữ liệu test / Cascade theo user; không UPDATE — bản ghi chấp thuận không sửa được). Bỏ qua nếu chưa có role.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'gieochu_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "legal_documents" TO gieochu_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON "legal_document_versions" TO gieochu_app;
    REVOKE ALL ON "user_legal_acceptances" FROM gieochu_app;
    GRANT SELECT, INSERT, DELETE ON "user_legal_acceptances" TO gieochu_app;
    GRANT EXECUTE ON FUNCTION "legal_document_versions_freeze_content"() TO gieochu_app;
  END IF;
END
$$;

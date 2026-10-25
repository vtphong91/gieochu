-- ADR-057 mục 3: công bố chính sách dạng "Bản dự thảo" — cờ trên phiên bản văn bản.
-- Migration EXPAND: chỉ THÊM 1 cột NOT NULL DEFAULT false (Postgres 11+ thêm cột có DEFAULT hằng không viết lại bảng) và
-- tạo lại function trigger đóng băng để phủ cả cột mới. Không đổi/xoá dữ liệu: mọi phiên bản hiện có = false (bản chính thức
-- hoặc nháp), đúng hành vi cũ.
--
-- THỨ TỰ DEPLOY: chạy migration này TRƯỚC khi deploy code ADR-057 GĐ C (Prisma client mới đọc/ghi "isDraftRelease"). Code
-- cũ chạy trên schema mới không sao (cột có DEFAULT, code cũ không biết tới cột).
--
-- Lớp dữ liệu: "legal_document_versions" là L1 (không "tenantId", không RLS) — quyền bảng đã cấp ở migration ADR-050 phủ cả
-- cột mới, không cần GRANT thêm. Ghi chỉ qua Server Action requireRole("SYSTEM_ADMIN") + audit_logs.

-- AlterTable
ALTER TABLE "legal_document_versions" ADD COLUMN "isDraftRelease" BOOLEAN NOT NULL DEFAULT false;

-- ───────────────────────── Trigger: phiên bản đã phát hành bất biến nội dung ─────────────────────────
-- Tạo lại function (giữ nguyên tên, chữ ký và trigger đang gắn — CREATE OR REPLACE không cần DROP/CREATE TRIGGER). Thay đổi
-- DUY NHẤT so với ADR-050: thêm `OR NEW."isDraftRelease" IS DISTINCT FROM OLD."isDraftRelease"` — cờ "Bản dự thảo" chỉ đặt
-- được trong lúc chuyển DRAFT → PUBLISHED (OLD là DRAFT, không bị kiểm) và không sửa được khi bản đã PUBLISHED/ARCHIVED
-- (không thể "nâng" một bản dự thảo thành bản chính thức hay ngược lại — muốn thế phải tạo phiên bản mới).
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
      OR NEW."isDraftRelease" IS DISTINCT FROM OLD."isDraftRelease"
      OR NEW."status" = 'DRAFT'
      OR (OLD."status" = 'ARCHIVED' AND NEW."status" <> 'ARCHIVED') THEN
      RAISE EXCEPTION 'legal_document_versions: published versions are immutable (create a new version instead)' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Quyền EXECUTE giữ nguyên sau CREATE OR REPLACE; cấp lại cho chắc (idempotent). Bỏ qua nếu chưa có role.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'gieochu_app') THEN
    GRANT EXECUTE ON FUNCTION "legal_document_versions_freeze_content"() TO gieochu_app;
  END IF;
END
$$;

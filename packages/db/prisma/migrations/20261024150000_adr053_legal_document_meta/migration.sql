-- ADR-053 mục 2 + 4: mô tả ngắn + SEO của văn bản pháp lý sửa trong CMS (System Center); 6 văn bản mới có khoá chứa "_".
-- Migration EXPAND: chỉ THÊM 3 cột tuỳ chọn (NULL) + 1 CHECK độ dài, và NỚI CHECK định dạng "key" để nhận "_"
-- (khoá `content_policy`, `usage_license`). Không đổi/xoá dữ liệu; "slug" giữ nguyên luật cũ (chỉ chữ thường, số, "-").
--
-- THỨ TỰ DEPLOY: code cũ chạy trên schema mới không sao (cột mới NULL, CHECK chỉ nới). Code ADR-053 cần migration này
-- chạy TRƯỚC: trang văn bản + editor đọc 3 cột mới; tạo nháp `content_policy`/`usage_license` cần CHECK đã nới.
--
-- Lớp dữ liệu: "legal_documents" là L1 (không "tenantId", không RLS) — quyền bảng đã cấp ở migration ADR-050 phủ cả cột
-- mới, không cần GRANT thêm. Ghi chỉ qua Server Action requireRole("SYSTEM_ADMIN") + audit_logs.

-- AlterTable
ALTER TABLE "legal_documents"
  ADD COLUMN "summary" TEXT,
  ADD COLUMN "seoTitle" TEXT,
  ADD COLUMN "seoDescription" TEXT;

-- ───────────────────────── CHECK ─────────────────────────
-- Độ dài khớp `@gieochu/core`: SEO_TITLE_MAX = 120, SEO_DESCRIPTION_MAX = 320, LEGAL_SUMMARY_MAX = 320.
ALTER TABLE "legal_documents" ADD CONSTRAINT "legal_documents_meta_length"
  CHECK (
    ("summary" IS NULL OR char_length("summary") <= 320)
    AND ("seoTitle" IS NULL OR char_length("seoTitle") <= 120)
    AND ("seoDescription" IS NULL OR char_length("seoDescription") <= 320)
  );

-- Khoá: chữ thường, số, nối bằng "-" hoặc "_" (nới từ ADR-050, chỉ có "-"); slug URL không đổi luật.
ALTER TABLE "legal_documents" DROP CONSTRAINT "legal_documents_key_format";
ALTER TABLE "legal_documents" ADD CONSTRAINT "legal_documents_key_format"
  CHECK ("key" ~ '^[a-z0-9]+([_-][a-z0-9]+)*$' AND "slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

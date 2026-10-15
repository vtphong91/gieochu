-- ADR-035 mục 5 (kế hoạch cửa hàng §4.4, phương án A): tìm kiếm không dấu cho /cua-hang/tai-lieu.
-- Migration EXPAND — chỉ THÊM extension + hàm, không đổi bảng/dữ liệu → an toàn với bản code đang chạy.
-- Idempotent: chạy lại không lỗi (IF NOT EXISTS / OR REPLACE / GRANT lặp lại vô hại).
--
-- * `unaccent` là extension "trusted" (pg_available_extension_versions.trusted = true trên Neon PG 18) → role owner
--   DB (neondb_owner, có quyền CREATE trên database) tạo được, không cần superuser.
-- * Prisma không quản lý extension/hàm khi KHÔNG bật preview `postgresqlExtensions` → không khai trong schema.prisma,
--   không gây drift.
-- * Không tạo index ở bước này (catalog nhỏ; truy vấn LIKE '%…%' không dùng btree). Index GIN trigram (`pg_trgm`)
--   trên biểu thức gieochu_unaccent(lower(...)) là nợ "index cho catalog lớn" (BACKLOG). Hàm đã IMMUTABLE nên sau
--   này dựng index biểu thức được mà không cần đổi hàm.

CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA public;

-- `unaccent()` gốc chỉ STABLE (phụ thuộc search_path để tìm dictionary) → không dùng được trong index biểu thức.
-- Bọc bằng hàm IMMUTABLE, chỉ định schema + dictionary tường minh nên kết quả không đổi theo search_path.
-- `translate` đ/Đ → d/D trước: luật unaccent mặc định đã map hai ký tự này, bước này chỉ là bảo hiểm (vô hại).
-- Không gộp lower() vào đây — nơi gọi tự quyết (truy vấn dự kiến: gieochu_unaccent(lower(col)) LIKE ...).
CREATE OR REPLACE FUNCTION public.gieochu_unaccent(text)
  RETURNS text
  LANGUAGE sql
  IMMUTABLE
  PARALLEL SAFE
  STRICT
AS $$
  SELECT public.unaccent('public.unaccent'::regdictionary, translate($1, 'đĐ', 'dD'))
$$;

COMMENT ON FUNCTION public.gieochu_unaccent(text) IS
  'ADR-035: bỏ dấu tiếng Việt (IMMUTABLE, schema-qualified) cho tìm kiếm không dấu ở /cua-hang.';

-- Mặc định EXECUTE trên hàm mới cấp cho PUBLIC; GRANT tường minh để migration tự đủ nghĩa (gồm cả unaccent gốc
-- mà hàm bọc gọi — hàm bọc không phải SECURITY DEFINER nên role gọi cần quyền trên cả hai).
-- Bỏ qua nếu môi trường chưa tạo role gieochu_app (theo mẫu migration RLS, ADR-010).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'gieochu_app') THEN
    GRANT EXECUTE ON FUNCTION public.unaccent(regdictionary, text) TO gieochu_app;
    GRANT EXECUTE ON FUNCTION public.gieochu_unaccent(text) TO gieochu_app;
  END IF;
END
$$;

-- ADR-029 mục 5 + 6 (M10b): RLS cho "posts" — tách policy theo lệnh (quy tắc bổ sung ADR-029 mục 0: bảng L2 có
-- nhánh public không dùng FOR ALL). Không nhánh customer, không nhánh admin (§7.9). Xoá tenant → CASCADE, xoá sản
-- phẩm → SET NULL (RI bỏ qua RLS).
--
--   SELECT : tenant (đúng tenantId) | public (PUBLISHED + tenant không LOCKED — khớp resolveStorefrontAccess với
--            khách: LOCKED → 404; READ_ONLY vẫn hiển thị) | system_job
--   INSERT : tenant (đúng tenantId, không tạo được bài HIDDEN / có hiddenReason) | system_job
--   UPDATE : tenant (đúng tenantId, cả USING lẫn WITH CHECK) | system_job
--   DELETE : tenant (đúng tenantId) | system_job
--
-- Trigger:
--   * "posts_guard_product_tenant" (BEFORE INSERT/UPDATE OF productId, tenantId): productId phải là sản phẩm của
--     CÙNG tenant. Subquery chạy dưới RLS của người gọi (SECURITY INVOKER) — scope tenant chỉ thấy sản phẩm của
--     mình nên sản phẩm tenant khác luôn bị từ chối.
--   * "posts_guard_columns" (BEFORE UPDATE): ngoài system_job, không ai đặt/gỡ HIDDEN hay sửa hiddenReason, và không
--     đổi id/tenantId/createdAt. Không dùng được column GRANT vì mọi scope chung role gieochu_app.

ALTER TABLE "posts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "posts" FORCE ROW LEVEL SECURITY;

-- ───────────────────────── SELECT ─────────────────────────
-- "tenants" không bật RLS (ADR-023 mục 2) → subquery trạng thái tenant đọc được dưới scope public.
CREATE POLICY "select_access" ON "posts"
  FOR SELECT
  USING (
    (current_setting('app.scope', true) = 'tenant' AND "tenantId" = current_setting('app.tenant_id', true))
    OR (
      current_setting('app.scope', true) = 'public'
      AND "status" = 'PUBLISHED'
      AND EXISTS (
        SELECT 1 FROM "tenants" t
        WHERE t."id" = "posts"."tenantId" AND t."status" <> 'LOCKED'
      )
    )
    OR current_setting('app.scope', true) = 'system_job'
  );

-- ───────────────────────── INSERT ─────────────────────────
CREATE POLICY "tenant_insert" ON "posts"
  FOR INSERT
  WITH CHECK (
    current_setting('app.scope', true) = 'tenant'
    AND "tenantId" = current_setting('app.tenant_id', true)
    AND "status" <> 'HIDDEN'
    AND "hiddenReason" IS NULL
  );

CREATE POLICY "system_job_insert" ON "posts"
  FOR INSERT
  WITH CHECK (current_setting('app.scope', true) = 'system_job');

-- ───────────────────────── UPDATE ─────────────────────────
CREATE POLICY "tenant_update" ON "posts"
  FOR UPDATE
  USING (current_setting('app.scope', true) = 'tenant' AND "tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK (current_setting('app.scope', true) = 'tenant' AND "tenantId" = current_setting('app.tenant_id', true));

CREATE POLICY "system_job_update" ON "posts"
  FOR UPDATE
  USING (current_setting('app.scope', true) = 'system_job')
  WITH CHECK (current_setting('app.scope', true) = 'system_job');

-- ───────────────────────── DELETE ─────────────────────────
CREATE POLICY "tenant_delete" ON "posts"
  FOR DELETE
  USING (current_setting('app.scope', true) = 'tenant' AND "tenantId" = current_setting('app.tenant_id', true));

CREATE POLICY "system_job_delete" ON "posts"
  FOR DELETE
  USING (current_setting('app.scope', true) = 'system_job');

-- ───────────────────────── Trigger: sản phẩm gắn phải cùng tenant ─────────────────────────
CREATE OR REPLACE FUNCTION "posts_guard_product_tenant"() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."productId" IS NULL THEN
    RETURN NEW;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM "products" p
    WHERE p."id" = NEW."productId" AND p."tenantId" = NEW."tenantId"
  ) THEN
    RAISE EXCEPTION 'posts: product must belong to the same tenant' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "posts_guard_product_tenant"
  BEFORE INSERT OR UPDATE OF "productId", "tenantId" ON "posts"
  FOR EACH ROW
  EXECUTE FUNCTION "posts_guard_product_tenant"();

-- ───────────────────────── Trigger: cột kiểm duyệt / định danh ─────────────────────────
CREATE OR REPLACE FUNCTION "posts_guard_columns"() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_setting('app.scope', true) = 'system_job' THEN
    RETURN NEW;
  END IF;

  IF NEW."id" IS DISTINCT FROM OLD."id"
     OR NEW."tenantId" IS DISTINCT FROM OLD."tenantId"
     OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt" THEN
    RAISE EXCEPTION 'posts: identity columns are immutable' USING ERRCODE = '42501';
  END IF;

  IF NEW."hiddenReason" IS DISTINCT FROM OLD."hiddenReason"
     OR ((NEW."status" = 'HIDDEN') IS DISTINCT FROM (OLD."status" = 'HIDDEN')) THEN
    RAISE EXCEPTION 'posts: moderation columns can only be changed by the system' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "posts_guard_columns"
  BEFORE UPDATE ON "posts"
  FOR EACH ROW
  EXECUTE FUNCTION "posts_guard_columns"();

-- ALTER DEFAULT PRIVILEGES (setup-app-role.mts, ADR-010) đã cấp DML cho bảng mới; GRANT tường minh để migration
-- tự đủ nghĩa (idempotent, bỏ qua nếu môi trường chưa có role gieochu_app).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'gieochu_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "posts" TO gieochu_app;
    GRANT EXECUTE ON FUNCTION "posts_guard_product_tenant"() TO gieochu_app;
    GRANT EXECUTE ON FUNCTION "posts_guard_columns"() TO gieochu_app;
  END IF;
END
$$;

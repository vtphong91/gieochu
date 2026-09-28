-- ADR-029 mục 2 + 6 (M10a): RLS cho "reviews" — tách policy theo lệnh (quy tắc bổ sung ADR-029 mục 0: bảng L2
-- có nhánh public/customer không dùng FOR ALL). Không có nhánh admin (§7.9). Xoá tenant/sản phẩm/user/order item
-- → FK CASCADE (RI bỏ qua RLS).
--
--   SELECT : tenant (scope 'tenant' + đúng tenantId) | public (VISIBLE + sản phẩm PUBLISHED)
--            | customer (userId = app.user_id, kể cả HIDDEN — người viết thấy nhãn "đã bị ẩn") | system_job
--   INSERT : chỉ customer, userId = app.user_id, trạng thái khởi tạo sạch (VISIBLE, chưa ẩn, chưa trả lời) và
--            EXISTS dòng đơn FULFILLED của chính user chứa đúng sản phẩm + entitlement chưa thu hồi.
--   UPDATE : customer (bản ghi của mình, dòng mới vẫn phải qua điều kiện đủ quyền) | tenant (đúng tenantId)
--            | system_job (tính lại/khôi phục do hệ thống).
--   DELETE : chỉ customer, bản ghi của mình.
--
-- Giới hạn CỘT theo scope không làm được bằng RLS/GRANT (tenant và customer cùng 1 role gieochu_app) → trigger
-- BEFORE UPDATE "reviews_guard_columns" kiểm theo app.scope:
--   * customer chỉ đổi được rating, body, displayName, orderItemId (+ updatedAt);
--   * tenant chỉ đổi được status, hiddenReason, hiddenAt, reply, repliedAt (+ updatedAt);
--   * không scope nào ngoài system_job đổi được id/tenantId/productId/userId/createdAt;
--   * scope khác (public/không đặt) bị từ chối (RLS đã chặn trước, đây là lớp thứ hai).

ALTER TABLE "reviews" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "reviews" FORCE ROW LEVEL SECURITY;

-- ───────────────────────── SELECT ─────────────────────────
CREATE POLICY "select_access" ON "reviews"
  FOR SELECT
  USING (
    (current_setting('app.scope', true) = 'tenant' AND "tenantId" = current_setting('app.tenant_id', true))
    OR (
      current_setting('app.scope', true) = 'public'
      AND "status" = 'VISIBLE'
      AND EXISTS (
        SELECT 1 FROM "products" p
        WHERE p."id" = "reviews"."productId" AND p."status" = 'PUBLISHED'
      )
    )
    OR (current_setting('app.scope', true) = 'customer' AND "userId" = current_setting('app.user_id', true))
    OR current_setting('app.scope', true) = 'system_job'
  );

-- ───────────────────────── INSERT ─────────────────────────
-- Subquery đi qua RLS của orders/order_items/entitlements dưới scope customer (withCustomer không đặt
-- app.tenant_id): cả 3 bảng đều có nhánh SELECT customer theo app.user_id nên dòng của chính khách nhìn thấy được.
CREATE POLICY "customer_insert" ON "reviews"
  FOR INSERT
  WITH CHECK (
    current_setting('app.scope', true) = 'customer'
    AND "userId" = current_setting('app.user_id', true)
    AND "status" = 'VISIBLE'
    AND "hiddenReason" IS NULL
    AND "hiddenAt" IS NULL
    AND "reply" IS NULL
    AND "repliedAt" IS NULL
    AND EXISTS (
      SELECT 1
      FROM "order_items" oi
      JOIN "orders" o ON o."id" = oi."orderId"
      JOIN "entitlements" e ON e."orderItemId" = oi."id"
      WHERE oi."id" = "reviews"."orderItemId"
        AND oi."productId" = "reviews"."productId"
        AND o."tenantId" = "reviews"."tenantId"
        AND o."customerId" = current_setting('app.user_id', true)
        AND o."status" = 'FULFILLED'
        AND e."userId" = current_setting('app.user_id', true)
        AND e."revokedAt" IS NULL
    )
  );

-- ───────────────────────── UPDATE ─────────────────────────
CREATE POLICY "customer_update" ON "reviews"
  FOR UPDATE
  USING (
    current_setting('app.scope', true) = 'customer'
    AND "userId" = current_setting('app.user_id', true)
  )
  WITH CHECK (
    current_setting('app.scope', true) = 'customer'
    AND "userId" = current_setting('app.user_id', true)
    AND EXISTS (
      SELECT 1
      FROM "order_items" oi
      JOIN "orders" o ON o."id" = oi."orderId"
      JOIN "entitlements" e ON e."orderItemId" = oi."id"
      WHERE oi."id" = "reviews"."orderItemId"
        AND oi."productId" = "reviews"."productId"
        AND o."tenantId" = "reviews"."tenantId"
        AND o."customerId" = current_setting('app.user_id', true)
        AND o."status" = 'FULFILLED'
        AND e."userId" = current_setting('app.user_id', true)
        AND e."revokedAt" IS NULL
    )
  );

CREATE POLICY "tenant_update" ON "reviews"
  FOR UPDATE
  USING (current_setting('app.scope', true) = 'tenant' AND "tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK (current_setting('app.scope', true) = 'tenant' AND "tenantId" = current_setting('app.tenant_id', true));

CREATE POLICY "system_job_update" ON "reviews"
  FOR UPDATE
  USING (current_setting('app.scope', true) = 'system_job')
  WITH CHECK (current_setting('app.scope', true) = 'system_job');

-- ───────────────────────── DELETE ─────────────────────────
CREATE POLICY "customer_delete" ON "reviews"
  FOR DELETE
  USING (
    current_setting('app.scope', true) = 'customer'
    AND "userId" = current_setting('app.user_id', true)
  );

-- ───────────────────────── Trigger giới hạn cột theo scope ─────────────────────────
CREATE OR REPLACE FUNCTION "reviews_guard_columns"() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_scope text := current_setting('app.scope', true);
BEGIN
  IF v_scope = 'system_job' THEN
    RETURN NEW;
  END IF;

  IF NEW."id" IS DISTINCT FROM OLD."id"
     OR NEW."tenantId" IS DISTINCT FROM OLD."tenantId"
     OR NEW."productId" IS DISTINCT FROM OLD."productId"
     OR NEW."userId" IS DISTINCT FROM OLD."userId"
     OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt" THEN
    RAISE EXCEPTION 'reviews: identity columns are immutable' USING ERRCODE = '42501';
  END IF;

  IF v_scope = 'customer' THEN
    IF NEW."status" IS DISTINCT FROM OLD."status"
       OR NEW."hiddenReason" IS DISTINCT FROM OLD."hiddenReason"
       OR NEW."hiddenAt" IS DISTINCT FROM OLD."hiddenAt"
       OR NEW."reply" IS DISTINCT FROM OLD."reply"
       OR NEW."repliedAt" IS DISTINCT FROM OLD."repliedAt" THEN
      RAISE EXCEPTION 'reviews: customer cannot change moderation or reply columns' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF v_scope = 'tenant' THEN
    IF NEW."rating" IS DISTINCT FROM OLD."rating"
       OR NEW."body" IS DISTINCT FROM OLD."body"
       OR NEW."displayName" IS DISTINCT FROM OLD."displayName"
       OR NEW."orderItemId" IS DISTINCT FROM OLD."orderItemId" THEN
      RAISE EXCEPTION 'reviews: tenant cannot change customer content' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'reviews: update not allowed in this scope' USING ERRCODE = '42501';
END;
$$;

CREATE TRIGGER "reviews_guard_columns"
  BEFORE UPDATE ON "reviews"
  FOR EACH ROW
  EXECUTE FUNCTION "reviews_guard_columns"();

-- ALTER DEFAULT PRIVILEGES (setup-app-role.mts, ADR-010) đã cấp DML cho bảng mới; GRANT tường minh để migration
-- tự đủ nghĩa (idempotent, bỏ qua nếu môi trường chưa có role gieochu_app).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'gieochu_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "reviews" TO gieochu_app;
    GRANT EXECUTE ON FUNCTION "reviews_guard_columns"() TO gieochu_app;
  END IF;
END
$$;

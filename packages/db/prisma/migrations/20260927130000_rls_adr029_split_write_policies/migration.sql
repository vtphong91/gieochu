-- ADR-029 mục 0: siết RLS các bảng L2 có nhánh public/customer trong policy "tenant_isolation" FOR ALL.
--
-- Vấn đề: policy cũ là FOR ALL USING (...) không WITH CHECK → USING áp cho cả SELECT/UPDATE/DELETE (và làm
-- WITH CHECK cho INSERT/UPDATE), nên nhánh đọc của scope public/customer cũng là nhánh GHI. Ví dụ: scope public
-- UPDATE được sản phẩm PUBLISHED hoặc mọi share link; scope customer UPDATE được sản phẩm/đơn/entitlement của mình.
-- Code hiện không ghi dưới 2 scope này (đã rà apps/web/lib: mọi withPublic/withCustomer chỉ đọc; riêng
-- storefront_messages đã tách policy ở ADR-023), nhưng lớp DB phải tự chặn.
--
-- Cách sửa (mẫu cho cả 7 bảng: products, product_files, coupons, share_links, orders, order_items, entitlements):
--   * "select_access"  FOR SELECT: giữ NGUYÊN điều kiện đọc của policy cũ (tenant / public / customer / system_job).
--   * "write_insert"   FOR INSERT WITH CHECK, "write_update" FOR UPDATE USING + WITH CHECK, "write_delete" FOR
--     DELETE USING: chỉ "tenantId" = app.tenant_id hoặc app.scope = 'system_job'.
--     (order_items không có cột tenantId → đi qua đơn cha, như policy cũ.)
-- RLS vẫn ENABLE + FORCE (không đổi); DROP/CREATE POLICY không đụng GRANT của gieochu_app.
-- Xoá tenant → FK CASCADE (RI bỏ qua RLS), không cần nhánh riêng.

-- ───────────────────────── products ─────────────────────────
DROP POLICY "tenant_isolation" ON "products";

CREATE POLICY "select_access" ON "products"
  FOR SELECT
  USING (
    "tenantId" = current_setting('app.tenant_id', true)
    OR (current_setting('app.scope', true) = 'public' AND "status" = 'PUBLISHED')
    OR current_setting('app.scope', true) = 'system_job'
    OR (
      current_setting('app.scope', true) = 'customer'
      AND EXISTS (
        SELECT 1 FROM "entitlements" e
        WHERE e."productId" = "products"."id"
          AND e."userId" = current_setting('app.user_id', true)
      )
    )
  );

CREATE POLICY "write_insert" ON "products"
  FOR INSERT
  WITH CHECK (
    "tenantId" = current_setting('app.tenant_id', true)
    OR current_setting('app.scope', true) = 'system_job'
  );

CREATE POLICY "write_update" ON "products"
  FOR UPDATE
  USING (
    "tenantId" = current_setting('app.tenant_id', true)
    OR current_setting('app.scope', true) = 'system_job'
  )
  WITH CHECK (
    "tenantId" = current_setting('app.tenant_id', true)
    OR current_setting('app.scope', true) = 'system_job'
  );

CREATE POLICY "write_delete" ON "products"
  FOR DELETE
  USING (
    "tenantId" = current_setting('app.tenant_id', true)
    OR current_setting('app.scope', true) = 'system_job'
  );

-- ───────────────────────── product_files ─────────────────────────
DROP POLICY "tenant_isolation" ON "product_files";

CREATE POLICY "select_access" ON "product_files"
  FOR SELECT
  USING (
    "tenantId" = current_setting('app.tenant_id', true)
    OR current_setting('app.scope', true) = 'system_job'
    OR (
      current_setting('app.scope', true) = 'public'
      AND "sourceKind" = 'FILE'
      AND "isPreview" = true
      AND "scanStatus" = 'CLEAN'
      AND "removedAt" IS NULL
      AND EXISTS (
        SELECT 1 FROM "products" p
        WHERE p."id" = "product_files"."productId" AND p."status" = 'PUBLISHED'
      )
    )
    OR (
      current_setting('app.scope', true) = 'customer'
      AND "removedAt" IS NULL
      AND (
        ("sourceKind" = 'FILE' AND "scanStatus" = 'CLEAN')
        OR "sourceKind" = 'EXTERNAL_URL'
      )
      AND EXISTS (
        SELECT 1 FROM "entitlements" e
        WHERE e."productId" = "product_files"."productId"
          AND e."userId" = current_setting('app.user_id', true)
          AND e."revokedAt" IS NULL
      )
    )
  );

CREATE POLICY "write_insert" ON "product_files"
  FOR INSERT
  WITH CHECK (
    "tenantId" = current_setting('app.tenant_id', true)
    OR current_setting('app.scope', true) = 'system_job'
  );

CREATE POLICY "write_update" ON "product_files"
  FOR UPDATE
  USING (
    "tenantId" = current_setting('app.tenant_id', true)
    OR current_setting('app.scope', true) = 'system_job'
  )
  WITH CHECK (
    "tenantId" = current_setting('app.tenant_id', true)
    OR current_setting('app.scope', true) = 'system_job'
  );

CREATE POLICY "write_delete" ON "product_files"
  FOR DELETE
  USING (
    "tenantId" = current_setting('app.tenant_id', true)
    OR current_setting('app.scope', true) = 'system_job'
  );

-- ───────────────────────── coupons ─────────────────────────
-- Nhánh public (isEnabled) chỉ phục vụ previewCouponPrice (đọc). Tăng usedCount chạy trong markOrderPaid
-- dưới withTenant/withSystemJob.
DROP POLICY "tenant_isolation" ON "coupons";

CREATE POLICY "select_access" ON "coupons"
  FOR SELECT
  USING (
    "tenantId" = current_setting('app.tenant_id', true)
    OR (current_setting('app.scope', true) = 'public' AND "isEnabled" = true)
    OR current_setting('app.scope', true) = 'system_job'
  );

CREATE POLICY "write_insert" ON "coupons"
  FOR INSERT
  WITH CHECK (
    "tenantId" = current_setting('app.tenant_id', true)
    OR current_setting('app.scope', true) = 'system_job'
  );

CREATE POLICY "write_update" ON "coupons"
  FOR UPDATE
  USING (
    "tenantId" = current_setting('app.tenant_id', true)
    OR current_setting('app.scope', true) = 'system_job'
  )
  WITH CHECK (
    "tenantId" = current_setting('app.tenant_id', true)
    OR current_setting('app.scope', true) = 'system_job'
  );

CREATE POLICY "write_delete" ON "coupons"
  FOR DELETE
  USING (
    "tenantId" = current_setting('app.tenant_id', true)
    OR current_setting('app.scope', true) = 'system_job'
  );

-- ───────────────────────── share_links ─────────────────────────
-- Nhánh public (tra theo tokenHash, không lọc trạng thái) chỉ để ĐỌC. Trước đây nó cho public UPDATE/DELETE
-- mọi share link (bỏ revokedAt, reset usedCount...). Tăng usedCount ở /s/{token} chạy dưới withTenant.
DROP POLICY "tenant_isolation" ON "share_links";

CREATE POLICY "select_access" ON "share_links"
  FOR SELECT
  USING (
    "tenantId" = current_setting('app.tenant_id', true)
    OR current_setting('app.scope', true) = 'public'
    OR current_setting('app.scope', true) = 'system_job'
  );

CREATE POLICY "write_insert" ON "share_links"
  FOR INSERT
  WITH CHECK (
    "tenantId" = current_setting('app.tenant_id', true)
    OR current_setting('app.scope', true) = 'system_job'
  );

CREATE POLICY "write_update" ON "share_links"
  FOR UPDATE
  USING (
    "tenantId" = current_setting('app.tenant_id', true)
    OR current_setting('app.scope', true) = 'system_job'
  )
  WITH CHECK (
    "tenantId" = current_setting('app.tenant_id', true)
    OR current_setting('app.scope', true) = 'system_job'
  );

CREATE POLICY "write_delete" ON "share_links"
  FOR DELETE
  USING (
    "tenantId" = current_setting('app.tenant_id', true)
    OR current_setting('app.scope', true) = 'system_job'
  );

-- ───────────────────────── orders ─────────────────────────
-- Nhánh customer chỉ để khách xem đơn của mình (thư viện, trang checkout). Tạo/cập nhật đơn chạy dưới withTenant.
DROP POLICY "tenant_isolation" ON "orders";

CREATE POLICY "select_access" ON "orders"
  FOR SELECT
  USING (
    "tenantId" = current_setting('app.tenant_id', true)
    OR (current_setting('app.scope', true) = 'customer' AND "customerId" = current_setting('app.user_id', true))
    OR current_setting('app.scope', true) = 'system_job'
  );

CREATE POLICY "write_insert" ON "orders"
  FOR INSERT
  WITH CHECK (
    "tenantId" = current_setting('app.tenant_id', true)
    OR current_setting('app.scope', true) = 'system_job'
  );

CREATE POLICY "write_update" ON "orders"
  FOR UPDATE
  USING (
    "tenantId" = current_setting('app.tenant_id', true)
    OR current_setting('app.scope', true) = 'system_job'
  )
  WITH CHECK (
    "tenantId" = current_setting('app.tenant_id', true)
    OR current_setting('app.scope', true) = 'system_job'
  );

CREATE POLICY "write_delete" ON "orders"
  FOR DELETE
  USING (
    "tenantId" = current_setting('app.tenant_id', true)
    OR current_setting('app.scope', true) = 'system_job'
  );

-- ───────────────────────── order_items ─────────────────────────
-- Không có cột tenantId (§5.2 ERD) → xét qua đơn cha, như policy cũ.
DROP POLICY "tenant_isolation" ON "order_items";

CREATE POLICY "select_access" ON "order_items"
  FOR SELECT
  USING (
    current_setting('app.scope', true) = 'system_job'
    OR EXISTS (
      SELECT 1 FROM "orders" o
      WHERE o."id" = "order_items"."orderId"
        AND (
          o."tenantId" = current_setting('app.tenant_id', true)
          OR (current_setting('app.scope', true) = 'customer' AND o."customerId" = current_setting('app.user_id', true))
        )
    )
  );

CREATE POLICY "write_insert" ON "order_items"
  FOR INSERT
  WITH CHECK (
    current_setting('app.scope', true) = 'system_job'
    OR EXISTS (
      SELECT 1 FROM "orders" o
      WHERE o."id" = "order_items"."orderId"
        AND o."tenantId" = current_setting('app.tenant_id', true)
    )
  );

CREATE POLICY "write_update" ON "order_items"
  FOR UPDATE
  USING (
    current_setting('app.scope', true) = 'system_job'
    OR EXISTS (
      SELECT 1 FROM "orders" o
      WHERE o."id" = "order_items"."orderId"
        AND o."tenantId" = current_setting('app.tenant_id', true)
    )
  )
  WITH CHECK (
    current_setting('app.scope', true) = 'system_job'
    OR EXISTS (
      SELECT 1 FROM "orders" o
      WHERE o."id" = "order_items"."orderId"
        AND o."tenantId" = current_setting('app.tenant_id', true)
    )
  );

CREATE POLICY "write_delete" ON "order_items"
  FOR DELETE
  USING (
    current_setting('app.scope', true) = 'system_job'
    OR EXISTS (
      SELECT 1 FROM "orders" o
      WHERE o."id" = "order_items"."orderId"
        AND o."tenantId" = current_setting('app.tenant_id', true)
    )
  );

-- ───────────────────────── entitlements ─────────────────────────
-- Nhánh customer chỉ để đọc (thư viện, kiểm tra quyền tải/mua). Cấp/thu hồi entitlement và tăng
-- downloadsUsed chạy dưới withTenant/withSystemJob.
DROP POLICY "tenant_isolation" ON "entitlements";

CREATE POLICY "select_access" ON "entitlements"
  FOR SELECT
  USING (
    "tenantId" = current_setting('app.tenant_id', true)
    OR (current_setting('app.scope', true) = 'customer' AND "userId" = current_setting('app.user_id', true))
    OR current_setting('app.scope', true) = 'system_job'
  );

CREATE POLICY "write_insert" ON "entitlements"
  FOR INSERT
  WITH CHECK (
    "tenantId" = current_setting('app.tenant_id', true)
    OR current_setting('app.scope', true) = 'system_job'
  );

CREATE POLICY "write_update" ON "entitlements"
  FOR UPDATE
  USING (
    "tenantId" = current_setting('app.tenant_id', true)
    OR current_setting('app.scope', true) = 'system_job'
  )
  WITH CHECK (
    "tenantId" = current_setting('app.tenant_id', true)
    OR current_setting('app.scope', true) = 'system_job'
  );

CREATE POLICY "write_delete" ON "entitlements"
  FOR DELETE
  USING (
    "tenantId" = current_setting('app.tenant_id', true)
    OR current_setting('app.scope', true) = 'system_job'
  );

-- ADR-026: product_files có thêm dòng link ngoài (sourceKind = 'EXTERNAL_URL', scanStatus NULL).
-- * Nhánh public: thêm điều kiện tường minh sourceKind = 'FILE' — externalUrl KHÔNG BAO GIỜ đọc
--   được ở scope public (vốn đã bị loại vì scanStatus NULL <> 'CLEAN', nay chặn thêm lớp thứ hai).
-- * Nhánh customer: khách có entitlement còn hiệu lực đọc được file CLEAN (như cũ) HOẶC dòng link
--   chưa gỡ — cần để requestDownload() nhận ra link khách đã mua (ADR-026 mục 3).
-- Nhánh tenant/system_job giữ nguyên.

DROP POLICY "tenant_isolation" ON "product_files";

CREATE POLICY "tenant_isolation" ON "product_files"
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

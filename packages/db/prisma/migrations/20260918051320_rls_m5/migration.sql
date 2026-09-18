-- §"M5": RLS for product_files, same pattern as products (rls_m4).
-- Public may only see isPreview=true, CLEAN, not-removed files of a
-- PUBLISHED product — everything else requires app.tenant_id or system_job.

ALTER TABLE "product_files" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "product_files" FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON "product_files"
  USING (
    "tenantId" = current_setting('app.tenant_id', true)
    OR current_setting('app.scope', true) = 'system_job'
    OR (
      current_setting('app.scope', true) = 'public'
      AND "isPreview" = true
      AND "scanStatus" = 'CLEAN'
      AND "removedAt" IS NULL
      AND EXISTS (
        SELECT 1 FROM "products" p
        WHERE p."id" = "product_files"."productId" AND p."status" = 'PUBLISHED'
      )
    )
  );

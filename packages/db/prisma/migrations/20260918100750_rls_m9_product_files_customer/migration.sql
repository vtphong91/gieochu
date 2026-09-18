-- §"M9": product_files' RLS (rls_m5) had no branch letting a customer read
-- a file they actually own — only tenant/system_job/public-preview. Without
-- this, requestDownload() could never even SELECT the file row for a real
-- (non-preview) purchased document. Adds: customer scope + CLEAN + not
-- removed + an active (not revoked) entitlement for the same product.

DROP POLICY "tenant_isolation" ON "product_files";

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
    OR (
      current_setting('app.scope', true) = 'customer'
      AND "scanStatus" = 'CLEAN'
      AND "removedAt" IS NULL
      AND EXISTS (
        SELECT 1 FROM "entitlements" e
        WHERE e."productId" = "product_files"."productId"
          AND e."userId" = current_setting('app.user_id', true)
          AND e."revokedAt" IS NULL
      )
    )
  );

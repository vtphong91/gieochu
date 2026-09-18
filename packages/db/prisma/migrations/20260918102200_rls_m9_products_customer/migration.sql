-- §"M9": products' RLS (rls_m4) only allowed tenantId match / public+PUBLISHED
-- / system_job — no way for a customer to read a product they hold an
-- entitlement for once it's no longer PUBLISHED (unpublished/archived after
-- purchase). The library must still show it, so add a customer branch, same
-- reasoning as the product_files fix just above this one.

DROP POLICY "tenant_isolation" ON "products";

CREATE POLICY "tenant_isolation" ON "products"
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

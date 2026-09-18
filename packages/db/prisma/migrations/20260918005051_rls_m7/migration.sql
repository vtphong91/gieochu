-- §5.4 RLS for the M7 L2 table (tenant_payment_configs). Same pattern as
-- the products/tenant_members policy from *_rls_m4/ — see packages/db/src/rls.ts.
-- No "public" branch here: unlike products, payment config (even the
-- non-secret publicConfig) is never shown to storefront guests.

ALTER TABLE "tenant_payment_configs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenant_payment_configs" FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON "tenant_payment_configs"
  USING (
    "tenantId" = current_setting('app.tenant_id', true)
    OR current_setting('app.scope', true) = 'system_job'
  );

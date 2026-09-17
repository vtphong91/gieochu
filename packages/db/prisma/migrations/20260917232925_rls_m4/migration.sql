-- §5.4 Row-Level Security for the first two L2 (tenant-scoped) tables.
-- Session config is set per-transaction by packages/db/src/rls.ts
-- (withTenant / withPublic / withCustomer / withSystemJob):
--   app.scope      = 'tenant' | 'public' | 'customer' | 'system_job'
--   app.tenant_id  = <tenantId>          (withTenant)
--   app.user_id    = <userId>            (withCustomer)
--
-- FORCE (not just ENABLE) so the policy also applies to the app's own
-- connection role, which owns these tables.

ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "products" FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON "products"
  USING (
    "tenantId" = current_setting('app.tenant_id', true)
    OR (current_setting('app.scope', true) = 'public' AND "status" = 'PUBLISHED')
    OR current_setting('app.scope', true) = 'system_job'
  );

ALTER TABLE "tenant_members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenant_members" FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON "tenant_members"
  USING (
    "tenantId" = current_setting('app.tenant_id', true)
    OR current_setting('app.scope', true) = 'system_job'
  );

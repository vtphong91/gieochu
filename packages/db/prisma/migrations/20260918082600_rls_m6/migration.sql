-- §"M6": RLS for coupons/coupon_redemptions, same pattern as products (rls_m4).
-- Public may read only isEnabled coupons — the code-preview endpoint
-- (apps/web/lib/coupon.ts) runs under withPublic so a customer typing a
-- code on the storefront can look it up before any purchase exists.

ALTER TABLE "coupons" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "coupons" FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON "coupons"
  USING (
    "tenantId" = current_setting('app.tenant_id', true)
    OR (current_setting('app.scope', true) = 'public' AND "isEnabled" = true)
    OR current_setting('app.scope', true) = 'system_job'
  );

ALTER TABLE "coupon_redemptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "coupon_redemptions" FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON "coupon_redemptions"
  USING (
    "tenantId" = current_setting('app.tenant_id', true)
    OR current_setting('app.scope', true) = 'system_job'
  );

-- §"M8"/§5.4: RLS for orders/order_items/tenant_payment_transactions/
-- tenant_customers/entitlements. `orders` and `entitlements` add the
-- "customer owns it" branch (app.scope='customer' + app.user_id) on top of
-- the usual tenant/system_job pattern — the buyer must see their own order
-- regardless of which tenant it belongs to.

ALTER TABLE "orders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "orders" FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON "orders"
  USING (
    "tenantId" = current_setting('app.tenant_id', true)
    OR (current_setting('app.scope', true) = 'customer' AND "customerId" = current_setting('app.user_id', true))
    OR current_setting('app.scope', true) = 'system_job'
  );

-- order_items has no tenantId column of its own (§5.2 ERD) — scope via the parent order.
ALTER TABLE "order_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "order_items" FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON "order_items"
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

ALTER TABLE "tenant_payment_transactions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenant_payment_transactions" FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON "tenant_payment_transactions"
  USING (
    "tenantId" = current_setting('app.tenant_id', true)
    OR current_setting('app.scope', true) = 'system_job'
  );

ALTER TABLE "tenant_customers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenant_customers" FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON "tenant_customers"
  USING (
    "tenantId" = current_setting('app.tenant_id', true)
    OR current_setting('app.scope', true) = 'system_job'
  );

ALTER TABLE "entitlements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "entitlements" FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON "entitlements"
  USING (
    "tenantId" = current_setting('app.tenant_id', true)
    OR (current_setting('app.scope', true) = 'customer' AND "userId" = current_setting('app.user_id', true))
    OR current_setting('app.scope', true) = 'system_job'
  );

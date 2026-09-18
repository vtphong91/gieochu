-- §"M9"/§5.4: RLS for share_links/download_events. download_tokens is L1
-- (no RLS) — see its schema.prisma doc comment: the security boundary is
-- "only the customer who just requested it holds the raw token", not a
-- tenant/user row filter.

-- share_links: owner (tenant match) OR anonymous public lookup by tokenHash
-- (app.scope='public', no status filter — the row must be readable even
-- when revoked/expired so /s/{token} can return 410 instead of 404) OR
-- system_job.
ALTER TABLE "share_links" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "share_links" FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON "share_links"
  USING (
    "tenantId" = current_setting('app.tenant_id', true)
    OR current_setting('app.scope', true) = 'public'
    OR current_setting('app.scope', true) = 'system_job'
  );

-- download_events: tenant-owner audit trail only — no public/customer branch.
ALTER TABLE "download_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "download_events" FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON "download_events"
  USING (
    "tenantId" = current_setting('app.tenant_id', true)
    OR current_setting('app.scope', true) = 'system_job'
  );

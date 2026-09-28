-- ADR-023: RLS cho storefront_messages (form liên hệ trên storefront).
-- Khác mẫu "tenant_isolation" 1 policy của các bảng L2 trước: ở đây tách
-- policy theo lệnh vì quyền không đối xứng —
--   * scope 'public'  : CHỈ INSERT (khách gửi form), không SELECT/UPDATE/DELETE.
--     Hệ quả: code ghi phải dùng INSERT không RETURNING (Prisma `createMany`),
--     vì RETURNING đòi row mới qua được policy SELECT.
--   * scope 'tenant'  : SELECT/UPDATE/DELETE đúng tenantId (Studio → Hộp thư).
--   * Không có nhánh system_job / admin — System Admin không có đường đọc
--     tin nhắn của tenant (§7.9). Xoá tenant → FK CASCADE (RI bỏ qua RLS).

ALTER TABLE "storefront_messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "storefront_messages" FORCE ROW LEVEL SECURITY;

CREATE POLICY "public_insert" ON "storefront_messages"
  FOR INSERT
  WITH CHECK (current_setting('app.scope', true) = 'public');

CREATE POLICY "tenant_select" ON "storefront_messages"
  FOR SELECT
  USING (
    current_setting('app.scope', true) = 'tenant'
    AND "tenantId" = current_setting('app.tenant_id', true)
  );

CREATE POLICY "tenant_update" ON "storefront_messages"
  FOR UPDATE
  USING (
    current_setting('app.scope', true) = 'tenant'
    AND "tenantId" = current_setting('app.tenant_id', true)
  )
  WITH CHECK (
    current_setting('app.scope', true) = 'tenant'
    AND "tenantId" = current_setting('app.tenant_id', true)
  );

CREATE POLICY "tenant_delete" ON "storefront_messages"
  FOR DELETE
  USING (
    current_setting('app.scope', true) = 'tenant'
    AND "tenantId" = current_setting('app.tenant_id', true)
  );

-- ALTER DEFAULT PRIVILEGES (setup-app-role.mts, ADR-010) đã tự cấp quyền DML
-- cho bảng mới; GRANT tường minh ở đây để migration tự đủ nghĩa (idempotent,
-- bỏ qua nếu môi trường chưa tạo role gieochu_app).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'gieochu_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "storefront_messages" TO gieochu_app;
  END IF;
END
$$;

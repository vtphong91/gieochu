-- ADR-051 bổ sung lần 3: tự lưu nháp editor lên server (docs/ke-hoach-tu-luu-nhap-2026-10-24.md mục 2).
-- Migration EXPAND: chỉ THÊM 2 enum + 2 bảng + index + FK + CHECK + RLS + quyền. Không đổi/xoá gì của bảng hiện có.
-- Quan hệ mới trên Tenant/User là quan hệ ngược (không thêm cột) → truy vấn hiện có không đổi.
--
-- THỨ TỰ DEPLOY: chạy migration này TRƯỚC khi deploy code dùng nháp (apps/web/lib/editor-draft.ts). Code hiện tại chạy
-- trên schema mới không sao (không đọc 2 bảng này).
--
-- Hai bảng tách theo layer (không gộp 1 bảng "tenantId" nullable — bài học ADR-010/020):
--   "tenant_editor_drafts" (L2): RLS ENABLE + FORCE. Truy cập qua withTenant + lọc "userId" ở server.
--   "system_editor_drafts" (L1): không "tenantId", không RLS. Chỉ qua getPrismaClient() sau requireRole("SYSTEM_ADMIN").
--
-- RLS "tenant_editor_drafts" (mẫu tách policy theo lệnh như "order_notes") — KHÔNG nhánh customer/public, KHÔNG nhánh
-- admin (§7.9):
--   SELECT : tenant (đúng tenantId) | system_job (cron dọn nháp cũ/mồ côi)
--   INSERT : tenant (đúng tenantId)
--   UPDATE : tenant (đúng tenantId, cả USING lẫn WITH CHECK → không chuyển dòng sang tenant khác)
--   DELETE : tenant (đúng tenantId) | system_job (cron dọn)
--   system_job KHÔNG có INSERT/UPDATE: cron chỉ đọc + xoá, không tạo/sửa nháp.
--   "Chỉ đúng người dùng" kiểm ở server (WHERE "userId" = người gọi): scope tenant không mang user id nên không đặt được
--   trong policy (cùng lý do "order_notes").
-- Xoá tenant/user → CASCADE (RI bỏ qua RLS).

-- CreateEnum
CREATE TYPE "TenantEditorDraftEntity" AS ENUM ('POST', 'PRODUCT', 'STOREFRONT');

-- CreateEnum
CREATE TYPE "SystemEditorDraftEntity" AS ENUM ('HOME', 'SHOP', 'PRICING', 'MENU', 'LEGAL_VERSION');

-- CreateTable
CREATE TABLE "tenant_editor_drafts" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "entityType" "TenantEditorDraftEntity" NOT NULL,
    "entityKey" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "clientId" TEXT NOT NULL,
    "baseUpdatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_editor_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_editor_drafts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "entityType" "SystemEditorDraftEntity" NOT NULL,
    "entityKey" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "clientId" TEXT NOT NULL,
    "baseUpdatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_editor_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (cron /api/cron/daily: xoá nháp không động tới quá 30 ngày)
CREATE INDEX "tenant_editor_drafts_updatedAt_idx" ON "tenant_editor_drafts"("updatedAt");

-- CreateIndex (FK "userId" — xoá user CASCADE)
CREATE INDEX "tenant_editor_drafts_userId_idx" ON "tenant_editor_drafts"("userId");

-- CreateIndex (một nháp / người dùng / thực thể; cột đầu "tenantId" phục vụ luôn FK "tenantId")
CREATE UNIQUE INDEX "tenant_editor_drafts_tenantId_userId_entityType_entityKey_key" ON "tenant_editor_drafts"("tenantId", "userId", "entityType", "entityKey");

-- CreateIndex (cron dọn)
CREATE INDEX "system_editor_drafts_updatedAt_idx" ON "system_editor_drafts"("updatedAt");

-- CreateIndex (cột đầu "userId" phục vụ luôn FK "userId")
CREATE UNIQUE INDEX "system_editor_drafts_userId_entityType_entityKey_key" ON "system_editor_drafts"("userId", "entityType", "entityKey");

-- AddForeignKey
ALTER TABLE "tenant_editor_drafts" ADD CONSTRAINT "tenant_editor_drafts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_editor_drafts" ADD CONSTRAINT "tenant_editor_drafts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_editor_drafts" ADD CONSTRAINT "system_editor_drafts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ───────────────────────── CHECK ─────────────────────────
-- Lưới an toàn ở DB; giới hạn chính theo entityType (POST 400KB, PRODUCT 64KB, STOREFRONT/CMS 256KB, LEGAL 400KB, trần
-- 512KB → DRAFT_TOO_LARGE) kiểm ở server trên JSON.stringify. jsonb::text thêm khoảng trắng sau ":" và "," nên trần DB
-- đặt rộng 1 MiB để không bao giờ chặn payload server đã cho qua.
ALTER TABLE "tenant_editor_drafts" ADD CONSTRAINT "tenant_editor_drafts_bounds"
  CHECK (
    "revision" >= 1
    AND char_length("entityKey") BETWEEN 1 AND 64
    AND char_length("clientId") BETWEEN 1 AND 64
    AND octet_length("payload"::text) <= 1048576
  );

ALTER TABLE "system_editor_drafts" ADD CONSTRAINT "system_editor_drafts_bounds"
  CHECK (
    "revision" >= 1
    AND char_length("entityKey") BETWEEN 1 AND 64
    AND char_length("clientId") BETWEEN 1 AND 64
    AND octet_length("payload"::text) <= 1048576
  );

-- ───────────────────────── RLS (chỉ bảng L2) ─────────────────────────
ALTER TABLE "tenant_editor_drafts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenant_editor_drafts" FORCE ROW LEVEL SECURITY;

CREATE POLICY "select_access" ON "tenant_editor_drafts"
  FOR SELECT
  USING (
    (current_setting('app.scope', true) = 'tenant' AND "tenantId" = current_setting('app.tenant_id', true))
    OR current_setting('app.scope', true) = 'system_job'
  );

CREATE POLICY "tenant_insert" ON "tenant_editor_drafts"
  FOR INSERT
  WITH CHECK (current_setting('app.scope', true) = 'tenant' AND "tenantId" = current_setting('app.tenant_id', true));

CREATE POLICY "tenant_update" ON "tenant_editor_drafts"
  FOR UPDATE
  USING (current_setting('app.scope', true) = 'tenant' AND "tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK (current_setting('app.scope', true) = 'tenant' AND "tenantId" = current_setting('app.tenant_id', true));

CREATE POLICY "tenant_delete" ON "tenant_editor_drafts"
  FOR DELETE
  USING (current_setting('app.scope', true) = 'tenant' AND "tenantId" = current_setting('app.tenant_id', true));

CREATE POLICY "system_job_delete" ON "tenant_editor_drafts"
  FOR DELETE
  USING (current_setting('app.scope', true) = 'system_job');

-- ───────────────────────── Quyền cho role runtime ─────────────────────────
-- ALTER DEFAULT PRIVILEGES (setup-app-role.mts, ADR-010) đã tự cấp DML cho bảng mới; GRANT tường minh để migration tự
-- đủ nghĩa (idempotent). Bỏ qua nếu môi trường chưa có role gieochu_app (theo mẫu migration RLS).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'gieochu_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "tenant_editor_drafts" TO gieochu_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON "system_editor_drafts" TO gieochu_app;
  END IF;
END
$$;

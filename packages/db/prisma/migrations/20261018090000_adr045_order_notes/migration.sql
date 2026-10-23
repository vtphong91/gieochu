-- ADR-045 mục 2: ghi chú nội bộ trên đơn hàng Studio — bảng L2 "order_notes".
-- Migration EXPAND: chỉ THÊM bảng + index + FK + CHECK + RLS + quyền. Không đổi/xoá gì của bảng hiện có.
--
-- Thứ tự deploy: code ADR-045 chịu được việc lên TRƯỚC migration này — đọc ghi chú gặp P2021 (bảng chưa có) thì trả
-- `notes: []` + `notesAvailable: false`, thêm/xoá ghi chú trả lỗi ORDER_NOTES_UNAVAILABLE (apps/web/lib/order-note.ts).
-- Quan hệ mới trên Order/Tenant/User là quan hệ ngược (không thêm cột) → truy vấn hiện có không đổi.
--
-- RLS (mẫu tách policy theo lệnh như "posts", ADR-029 mục 0) — KHÔNG nhánh customer/public, KHÔNG nhánh admin (§7.9):
--   SELECT : tenant (đúng tenantId) | system_job
--   INSERT : tenant (đúng tenantId VÀ đơn thuộc cùng tenant) | system_job
--   UPDATE : không có policy → mọi UPDATE ảnh hưởng 0 dòng (ghi chú không sửa được, ADR-045)
--   DELETE : tenant (đúng tenantId) | system_job — "chỉ tác giả được xoá" kiểm ở server (WHERE authorId = người gọi);
--            mọi scope chung role gieochu_app và scope tenant không mang user id nên không đặt được trong policy.
-- Xoá tenant/đơn → CASCADE; xoá user → authorId SET NULL (RI bỏ qua RLS).

-- CreateTable
CREATE TABLE "order_notes" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "authorId" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "order_notes_tenantId_orderId_createdAt_idx" ON "order_notes"("tenantId", "orderId", "createdAt");

-- CreateIndex
CREATE INDEX "order_notes_orderId_idx" ON "order_notes"("orderId");

-- CreateIndex
CREATE INDEX "order_notes_authorId_idx" ON "order_notes"("authorId");

-- AddForeignKey
ALTER TABLE "order_notes" ADD CONSTRAINT "order_notes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_notes" ADD CONSTRAINT "order_notes_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_notes" ADD CONSTRAINT "order_notes_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ───────────────────────── CHECK ─────────────────────────
-- Server lưu nội dung đã trim (zod). Ràng buộc DB: ≤1000 ký tự và không rỗng/chỉ khoảng trắng.
ALTER TABLE "order_notes" ADD CONSTRAINT "order_notes_body_length"
  CHECK (char_length("body") <= 1000 AND char_length(btrim("body", E' \t\r\n')) >= 1);

-- ───────────────────────── RLS ─────────────────────────
ALTER TABLE "order_notes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "order_notes" FORCE ROW LEVEL SECURITY;

CREATE POLICY "select_access" ON "order_notes"
  FOR SELECT
  USING (
    (current_setting('app.scope', true) = 'tenant' AND "tenantId" = current_setting('app.tenant_id', true))
    OR current_setting('app.scope', true) = 'system_job'
  );

-- Subquery "orders" chạy dưới RLS của người gọi: scope tenant chỉ thấy đơn của chính mình → không gắn được ghi chú
-- vào đơn của tenant khác kể cả khi server lỗi.
CREATE POLICY "tenant_insert" ON "order_notes"
  FOR INSERT
  WITH CHECK (
    current_setting('app.scope', true) = 'tenant'
    AND "tenantId" = current_setting('app.tenant_id', true)
    AND EXISTS (
      SELECT 1 FROM "orders" o
      WHERE o."id" = "order_notes"."orderId" AND o."tenantId" = "order_notes"."tenantId"
    )
  );

CREATE POLICY "system_job_insert" ON "order_notes"
  FOR INSERT
  WITH CHECK (current_setting('app.scope', true) = 'system_job');

CREATE POLICY "tenant_delete" ON "order_notes"
  FOR DELETE
  USING (current_setting('app.scope', true) = 'tenant' AND "tenantId" = current_setting('app.tenant_id', true));

CREATE POLICY "system_job_delete" ON "order_notes"
  FOR DELETE
  USING (current_setting('app.scope', true) = 'system_job');

-- ───────────────────────── Quyền cho role runtime ─────────────────────────
-- ALTER DEFAULT PRIVILEGES (setup-app-role.mts, ADR-010) đã tự cấp DML cho bảng mới; GRANT tường minh để migration tự
-- đủ nghĩa (idempotent). Không cấp UPDATE — ghi chú bất biến (thu hồi nếu default privileges đã cấp).
-- Bỏ qua nếu môi trường chưa có role gieochu_app (theo mẫu migration RLS).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'gieochu_app') THEN
    GRANT SELECT, INSERT, DELETE ON "order_notes" TO gieochu_app;
    REVOKE UPDATE ON "order_notes" FROM gieochu_app;
  END IF;
END
$$;

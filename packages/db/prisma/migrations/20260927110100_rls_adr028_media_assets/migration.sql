-- ADR-028: RLS cho tenant_media_assets — mẫu "tenant_isolation" 1 policy như coupons/product_files:
--   * scope tenant  : chỉ dòng đúng app.tenant_id (Studio ký upload / ghi nhận ảnh / tính hạn mức).
--   * scope system_job: đọc/ghi mọi dòng (job dọn asset mồ côi — nợ ADR-028).
--   * Không có nhánh public/customer: khách không cần đọc bảng này (ảnh phục vụ thẳng từ CDN Cloudinary).
-- Policy không có WITH CHECK riêng → USING áp luôn cho INSERT/UPDATE (không ghi được dòng tenant khác).

ALTER TABLE "tenant_media_assets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenant_media_assets" FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON "tenant_media_assets"
  USING (
    "tenantId" = current_setting('app.tenant_id', true)
    OR current_setting('app.scope', true) = 'system_job'
  );

-- ALTER DEFAULT PRIVILEGES (setup-app-role.mts, ADR-010) đã tự cấp quyền DML cho bảng mới; GRANT tường minh ở
-- đây để migration tự đủ nghĩa (idempotent, bỏ qua nếu môi trường chưa tạo role gieochu_app).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'gieochu_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "tenant_media_assets" TO gieochu_app;
  END IF;
END
$$;

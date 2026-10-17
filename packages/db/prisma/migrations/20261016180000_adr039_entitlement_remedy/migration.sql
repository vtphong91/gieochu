-- ADR-039: quyền lợi người mua khi tài liệu bị admin lưu trữ do vi phạm (chọn "tải lần cuối" hoặc "yêu cầu hoàn tiền").
-- Migration EXPAND: chỉ THÊM enum, 5 cột trên "entitlements" (1 cột NOT NULL có DEFAULT hằng — PG ≥11 chỉ sửa metadata,
-- không rewrite bảng), 1 index, CHECK (mọi dòng hiện có đều thoả: NONE + 3 cột NULL), trigger guard và quyền.
-- Không DROP/RENAME gì.
--
-- ⚠️ THỨ TỰ DEPLOY: chạy migration này TRƯỚC khi deploy code ADR-039. Code mới đọc cột "remedyStatus" (Prisma chọn đủ
-- cột của model Entitlement) → nếu code lên trước, mọi truy vấn entitlement (thư viện, tải, đơn Studio) lỗi P2022 (500).
-- Code cũ chạy trên schema mới không sao: cột mới có DEFAULT/nullable; trigger chỉ chặn đổi cột remedy* (code cũ không
-- chạm) và đổi "downloadLimit" của entitlement đang có remedy (không tồn tại trước khi code mới xử lý báo cáo).
--
-- Lớp dữ liệu: "entitlements" là L2/L3, RLS giữ nguyên (policy ADR-029 không tham chiếu cột mới):
--   * customer chỉ SELECT dòng của mình — KHÔNG có quyền UPDATE. Hành động chọn của khách chạy dưới scope
--     'system_job' SAU KHI server kiểm quyền sở hữu (apps/web/lib/entitlement-remedy.ts), có điều kiện
--     "remedyStatus" = 'PENDING_CHOICE' AND "userId" = <khách> trong chính câu UPDATE.
--   * tenant UPDATE được dòng của tenant (cấp thêm lượt, thu hồi, hoàn tiền, tăng downloadsUsed khi tải) → trigger
--     "entitlements_guard_remedy" (mẫu *_guard_moderation M12c — không dùng column GRANT được vì mọi scope chung role
--     gieochu_app): ngoài 'system_job' không được tạo dòng có remedy (trừ PENDING_CHOICE cho tài liệu đang bị khoá kiểm
--     duyệt — fulfil đơn thanh toán muộn), không đổi remedy*, không đổi "remedyStatus" trừ
--     đúng 1 chuyển tiếp REFUND_REQUESTED → REFUNDED kèm thu hồi (markOrderRefunded), và không đổi "downloadLimit" khi
--     dòng đã có remedy (giữ nghĩa "lần tải cuối" / "chặn vĩnh viễn").

-- CreateEnum
CREATE TYPE "EntitlementRemedyStatus" AS ENUM ('NONE', 'PENDING_CHOICE', 'FINAL_DOWNLOAD', 'REFUND_REQUESTED', 'REFUNDED');

-- AlterTable
ALTER TABLE "entitlements" ADD COLUMN     "remedyChosenAt" TIMESTAMP(3),
ADD COLUMN     "remedyReportId" TEXT,
ADD COLUMN     "remedyRequestedAt" TIMESTAMP(3),
ADD COLUMN     "remedyResolvedAt" TIMESTAMP(3),
ADD COLUMN     "remedyStatus" "EntitlementRemedyStatus" NOT NULL DEFAULT 'NONE';

-- CreateIndex
CREATE INDEX "entitlements_tenantId_remedyStatus_idx" ON "entitlements"("tenantId", "remedyStatus");

-- ───────────────────────── CHECK: hình dạng remedy ─────────────────────────
-- NONE ⇔ không có mốc nào; PENDING_CHOICE ⇔ đã mở, chưa chọn; FINAL_DOWNLOAD/REFUND_REQUESTED ⇔ đã mở + đã chọn;
-- REFUNDED ⇔ đã mở + đã chọn + tenant đã hoàn ("remedyResolvedAt"). "remedyResolvedAt" chỉ có ở REFUNDED.
-- REFUNDED luôn đi cùng thu hồi (markOrderRefunded thu hồi trước rồi mới đổi trạng thái, cùng transaction).
ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_remedy_shape"
  CHECK (
    (
      "remedyStatus" = 'NONE'
      AND "remedyRequestedAt" IS NULL AND "remedyChosenAt" IS NULL AND "remedyResolvedAt" IS NULL AND "remedyReportId" IS NULL
    )
    OR ("remedyStatus" = 'PENDING_CHOICE' AND "remedyRequestedAt" IS NOT NULL AND "remedyChosenAt" IS NULL AND "remedyResolvedAt" IS NULL)
    OR (
      "remedyStatus" IN ('FINAL_DOWNLOAD', 'REFUND_REQUESTED')
      AND "remedyRequestedAt" IS NOT NULL
      AND "remedyChosenAt" IS NOT NULL
      AND "remedyResolvedAt" IS NULL
    )
    OR (
      "remedyStatus" = 'REFUNDED'
      AND "remedyRequestedAt" IS NOT NULL
      AND "remedyChosenAt" IS NOT NULL
      AND "remedyResolvedAt" IS NOT NULL
    )
  );

ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_remedy_refunded_revoked"
  CHECK ("remedyStatus" <> 'REFUNDED' OR "revokedAt" IS NOT NULL);

-- ───────────────────────── Trigger: entitlements ─────────────────────────
-- Role owner (migration, script vận hành) không đặt app.scope → bị áp như scope thường (an toàn, cùng mẫu M12c).
CREATE OR REPLACE FUNCTION "entitlements_guard_remedy"() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_setting('app.scope', true) = 'system_job' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW."remedyStatus" = 'NONE'
       AND NEW."remedyRequestedAt" IS NULL
       AND NEW."remedyChosenAt" IS NULL
       AND NEW."remedyResolvedAt" IS NULL
       AND NEW."remedyReportId" IS NULL THEN
      RETURN NEW;
    END IF;
    -- Ngoại lệ (ADR-039 bổ sung): fulfil đơn (markOrderPaid chạy dưới scope tenant — webhook, xác nhận tay, đơn 0đ)
    -- cho tài liệu ĐANG bị khoá kiểm duyệt → entitlement sinh thẳng ở PENDING_CHOICE, cùng transaction (không có
    -- khoảng hở tải được). Điều kiện do DB tự kiểm: sản phẩm có "moderationLockedAt" (chỉ system_job đặt được —
    -- products_guard_moderation) và báo cáo (nếu có) đúng là báo cáo về sản phẩm này.
    IF NEW."remedyStatus" = 'PENDING_CHOICE'
       AND NEW."remedyRequestedAt" IS NOT NULL
       AND NEW."remedyChosenAt" IS NULL
       AND NEW."remedyResolvedAt" IS NULL
       AND EXISTS (
         SELECT 1 FROM "products" p
         WHERE p."id" = NEW."productId" AND p."moderationLockedAt" IS NOT NULL
       )
       AND (
         NEW."remedyReportId" IS NULL
         OR EXISTS (
           SELECT 1 FROM "abuse_reports" r
           WHERE r."id" = NEW."remedyReportId" AND r."targetType" = 'PRODUCT' AND r."targetId" = NEW."productId"
         )
       ) THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'entitlements: remedy columns can only be set by the system' USING ERRCODE = '42501';
  END IF;

  IF NEW."remedyRequestedAt" IS DISTINCT FROM OLD."remedyRequestedAt"
     OR NEW."remedyChosenAt" IS DISTINCT FROM OLD."remedyChosenAt"
     OR NEW."remedyReportId" IS DISTINCT FROM OLD."remedyReportId" THEN
    RAISE EXCEPTION 'entitlements: remedy columns can only be changed by the system' USING ERRCODE = '42501';
  END IF;

  -- Ngoại lệ duy nhất ngoài system_job: tenant bấm "Hoàn tiền" cho yêu cầu hoàn tiền (entitlement đã thu hồi) — đổi
  -- "remedyStatus" + đặt "remedyResolvedAt" trong CÙNG lệnh. Ngoài chuyển tiếp này, "remedyResolvedAt" không đổi được.
  IF NEW."remedyStatus" IS DISTINCT FROM OLD."remedyStatus"
     AND NOT (
       OLD."remedyStatus" = 'REFUND_REQUESTED' AND NEW."remedyStatus" = 'REFUNDED'
       AND NEW."revokedAt" IS NOT NULL AND NEW."remedyResolvedAt" IS NOT NULL
     ) THEN
    RAISE EXCEPTION 'entitlements: remedy status can only be changed by the system' USING ERRCODE = '42501';
  END IF;

  IF NEW."remedyResolvedAt" IS DISTINCT FROM OLD."remedyResolvedAt"
     AND NOT (OLD."remedyStatus" = 'REFUND_REQUESTED' AND NEW."remedyStatus" = 'REFUNDED') THEN
    RAISE EXCEPTION 'entitlements: remedy columns can only be changed by the system' USING ERRCODE = '42501';
  END IF;

  IF OLD."remedyStatus" <> 'NONE' AND NEW."downloadLimit" IS DISTINCT FROM OLD."downloadLimit" THEN
    RAISE EXCEPTION 'entitlements: download limit is locked by remedy' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "entitlements_guard_remedy"
  BEFORE INSERT OR UPDATE ON "entitlements"
  FOR EACH ROW
  EXECUTE FUNCTION "entitlements_guard_remedy"();

-- ───────────────────────── Quyền cho role runtime ─────────────────────────
-- "entitlements" đã có GRANT từ migration RLS M8; chỉ cấp EXECUTE cho hàm trigger mới.
-- Bỏ qua nếu môi trường chưa có role gieochu_app (theo mẫu migration RLS/M12a/M12b/M12c).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'gieochu_app') THEN
    GRANT EXECUTE ON FUNCTION "entitlements_guard_remedy"() TO gieochu_app;
  END IF;
END
$$;

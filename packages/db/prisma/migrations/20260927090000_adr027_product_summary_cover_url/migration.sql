-- ADR-027: mô tả ngắn + ảnh bìa Cloudinary cho sản phẩm.
-- Cả hai cột nullable, không default → không rewrite bảng, dữ liệu cũ giữ nguyên
-- (ảnh bìa cũ vẫn đọc qua "coverImageKey" làm fallback). RLS của "products" không đổi
-- (policy theo hàng, áp cho mọi cột).
-- Độ dài/định dạng validate ở tầng ứng dụng (normalizeProductSummary / isCloudinaryImageUrl).

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "summary" TEXT,
ADD COLUMN     "coverImageUrl" TEXT;

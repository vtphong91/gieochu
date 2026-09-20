-- Logo trên navbar mặc định (40px) quá nhỏ so với thiết kế thực tế của logo
-- upload — nâng mặc định lên 56px. Backfill các dòng còn giữ giá trị mặc định
-- cũ (chưa admin nào chỉnh tay) để hiệu lực ngay không cần vào /admin sửa lại.
ALTER TABLE "system_branding" ALTER COLUMN "navbarLogoHeightPx" SET DEFAULT 56;

UPDATE "system_branding" SET "navbarLogoHeightPx" = 56 WHERE "navbarLogoHeightPx" = 40;

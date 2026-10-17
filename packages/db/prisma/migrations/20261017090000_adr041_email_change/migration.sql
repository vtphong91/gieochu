-- ADR-041 mục C (Hồ sơ): luồng đổi email đăng nhập qua link xác minh gửi tới email mới.
-- Migration EXPAND: chỉ THÊM 1 giá trị enum + 1 cột nullable. Không DROP/RENAME, không rewrite bảng.
--
-- AlterEnum: `ALTER TYPE ... ADD VALUE` chạy được trong transaction từ PG 12 (Neon PG 16) với điều kiện KHÔNG dùng giá
-- trị mới trong cùng transaction — migration này không dùng (cùng mẫu 20260928090000_m10b_posts).
--
-- ⚠️ THỨ TỰ DEPLOY: chạy migration này TRƯỚC khi deploy code ADR-041 (Hồ sơ). Prisma Client mới chọn đủ cột của model
-- VerificationToken (kể cả "newEmail") → nếu code lên trước, mọi truy vấn verification_tokens (đăng ký, xác minh email,
-- quên/đặt lại mật khẩu) lỗi P2022. Code cũ chạy trên schema mới không sao (cột nullable, giá trị enum chưa ai ghi).
--
-- Lớp dữ liệu: "verification_tokens" là bảng L1 (không RLS). "newEmail" là dữ liệu cá nhân, chỉ có giá trị với
-- type = 'EMAIL_CHANGE' (email đích đã chuẩn hoá lowercase/trim).

-- AlterEnum
ALTER TYPE "VerificationTokenType" ADD VALUE 'EMAIL_CHANGE';

-- AlterTable
ALTER TABLE "verification_tokens" ADD COLUMN "newEmail" TEXT;

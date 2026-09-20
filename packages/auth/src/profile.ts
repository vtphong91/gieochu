export interface ProfileCompletionInput {
  fullName?: string | null;
  phone?: string | null;
  province?: string | null;
}

/**
 * fullName/phone/province — KHÔNG còn dùng để chặn truy cập (/account/*,
 * /studio/*, checkout dùng ngay sau khi xác minh email, không đợi hồ sơ đầy
 * đủ — xem apps/web/lib/page-guards.ts). Bỏ hẳn `occupation` khỏi tiêu chí:
 * trường "Bạn là" từng hỏi lại gần như đúng lựa chọn loại tài khoản (Tenant/
 * Customer) đã chọn lúc đăng ký, dư thừa và gây cảm giác hệ thống bắt chọn
 * 2 lần cho cùng 1 câu hỏi. Hàm này vẫn tính `pc` claim (JWT) để có thể dùng
 * cho gợi ý không chặn (vd: banner "hoàn thiện hồ sơ") trong tương lai.
 */
export function isProfileComplete(profile: ProfileCompletionInput | null | undefined): boolean {
  if (!profile) return false;
  return Boolean(profile.fullName?.trim() && profile.phone?.trim() && profile.province?.trim());
}

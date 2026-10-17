/**
 * ADR-041 mục C (Hồ sơ `/account`) — hằng + hàm thuần cho hồ sơ cá nhân. Module thuần (không Node/Prisma) — client
 * component import được qua subpath `@gieochu/core/account-profile` (vd ô chọn Tỉnh/Thành, gợi ý định dạng).
 *
 * SĐT và Tỉnh/Thành là **tuỳ chọn** và là dữ liệu cá nhân: chỉ chủ tài khoản + System Admin thấy, gian hàng không
 * thấy (ADR-041 C.1).
 */

/** Họ và tên: một ô gộp, 1–80 ký tự sau khi trim. */
export const PROFILE_FULL_NAME_MAX_LENGTH = 80;

/**
 * 34 đơn vị hành chính cấp tỉnh sau sắp xếp 2025 (Nghị quyết 202/2025/QH15, hiệu lực 12/6/2025), cập nhật theo chủ
 * dự án 2026-10-17: Đồng Nai đã lên thành phố trực thuộc trung ương → 7 thành phố + 27 tỉnh. Thành phố xếp trước,
 * tỉnh theo ABC. Giá trị lưu DB là đúng chuỗi hiển thị (giữ "Đồng Nai" để không đổi dữ liệu đã lưu).
 */
export const VN_PROVINCES = [
  "Hà Nội",
  "Huế",
  "Hải Phòng",
  "Đà Nẵng",
  "TP. Hồ Chí Minh",
  "Cần Thơ",
  "Đồng Nai",
  "An Giang",
  "Bắc Ninh",
  "Cà Mau",
  "Cao Bằng",
  "Đắk Lắk",
  "Điện Biên",
  "Đồng Tháp",
  "Gia Lai",
  "Hà Tĩnh",
  "Hưng Yên",
  "Khánh Hòa",
  "Lai Châu",
  "Lâm Đồng",
  "Lạng Sơn",
  "Lào Cai",
  "Nghệ An",
  "Ninh Bình",
  "Phú Thọ",
  "Quảng Ngãi",
  "Quảng Ninh",
  "Quảng Trị",
  "Sơn La",
  "Tây Ninh",
  "Thái Nguyên",
  "Thanh Hóa",
  "Tuyên Quang",
  "Vĩnh Long",
] as const;
export type VnProvince = (typeof VN_PROVINCES)[number];

const PROVINCE_SET: ReadonlySet<string> = new Set(VN_PROVINCES);

export function isVnProvince(value: unknown): value is VnProvince {
  return typeof value === "string" && PROVINCE_SET.has(value);
}

/**
 * Chuẩn hoá SĐT Việt Nam về dạng `0XXXXXXXXX` (10 chữ số). Chấp nhận khoảng trắng, dấu chấm, gạch ngang, ngoặc và
 * tiền tố `+84`/`84`. Không hợp lệ → `null`.
 */
export function normalizeVnPhone(raw: string): string | null {
  const compact = raw.replace(/[\s.\-()]/g, "");
  let local: string;
  if (compact.startsWith("+84")) local = `0${compact.slice(3)}`;
  else if (/^84\d{9}$/.test(compact)) local = `0${compact.slice(2)}`;
  else local = compact;
  return /^0[1-9]\d{8}$/.test(local) ? local : null;
}

/** Mã lỗi theo ô của form hồ sơ — `fieldErrors` trả về UI dùng tên ô làm khoá. */
export const PROFILE_FIELD_MESSAGES = {
  fullNameRequired: "Vui lòng nhập họ và tên.",
  fullNameTooLong: `Họ và tên tối đa ${PROFILE_FULL_NAME_MAX_LENGTH} ký tự.`,
  phoneInvalid: "Số điện thoại không hợp lệ (10 số, bắt đầu bằng 0 hoặc +84).",
  provinceInvalid: "Vui lòng chọn Tỉnh/Thành phố trong danh sách.",
} as const;

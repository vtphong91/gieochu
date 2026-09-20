import { isProfileComplete } from "./profile";

// §"đơn giản hoá đăng ký/đăng nhập" (2026-09-20): bỏ `occupation` khỏi tiêu chí
// hoàn thiện hồ sơ — từng trùng lựa chọn loại tài khoản (Tenant/Customer) đã
// chọn lúc đăng ký, gây cảm giác hỏi lại 2 lần. Hàm này giờ không còn dùng để
// chặn truy cập (xem lib/page-guards.ts requireVerifiedAccess()), chỉ còn
// tính `pc` claim cho khả năng gợi ý không chặn sau này.
describe("M1 profile completion check", () => {
  it("is complete only when fullName, phone and province are all present", () => {
    expect(isProfileComplete(null)).toBe(false);
    expect(isProfileComplete({ fullName: "Nguyễn Hạnh" })).toBe(false);
    expect(
      isProfileComplete({
        fullName: "Nguyễn Hạnh",
        phone: "0901234567",
        province: "Hà Nội",
      }),
    ).toBe(true);
    expect(
      isProfileComplete({
        fullName: "Nguyễn Hạnh",
        phone: "  ", // blank after trim
        province: "Hà Nội",
      }),
    ).toBe(false);
  });
});

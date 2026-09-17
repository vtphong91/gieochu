import { isProfileComplete } from "./profile";

describe("M1 profile completion check", () => {
  it("is complete only when fullName, phone, occupation and province are all present", () => {
    expect(isProfileComplete(null)).toBe(false);
    expect(isProfileComplete({ fullName: "Nguyễn Hạnh" })).toBe(false);
    expect(
      isProfileComplete({
        fullName: "Nguyễn Hạnh",
        phone: "0901234567",
        occupation: "teacher",
        province: "Hà Nội",
      }),
    ).toBe(true);
    expect(
      isProfileComplete({
        fullName: "Nguyễn Hạnh",
        phone: "0901234567",
        occupation: "  ", // blank after trim
        province: "Hà Nội",
      }),
    ).toBe(false);
  });
});

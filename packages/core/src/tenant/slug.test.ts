import { isReservedSlug, slugify } from "./slug";

describe("M4 tenant slug", () => {
  it("slugifies Vietnamese text (strips diacritics, kebab-cases)", () => {
    expect(slugify("Cô Hạnh Toán 9")).toBe("co-hanh-toan-9");
    expect(slugify("Đại học Sư phạm")).toBe("dai-hoc-su-pham");
  });

  it("rejects a slug that is on the reserved list", () => {
    expect(isReservedSlug("admin")).toBe(true);
    expect(isReservedSlug("STUDIO")).toBe(true);
    expect(isReservedSlug("co-hanh")).toBe(false);
    // ADR-054: 7 văn bản pháp lý ở URL cấp gốc + tiền tố cũ "phap-ly".
    for (const slug of ["dieu-khoan-su-dung", "chinh-sach-bao-mat", "chinh-sach-noi-dung", "cam-ket-ban-quyen", "quyen-su-dung-tai-lieu", "chinh-sach-nguoi-ban", "lien-he", "phap-ly"]) {
      expect(isReservedSlug(slug)).toBe(true);
    }
  });
});

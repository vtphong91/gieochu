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
  });
});

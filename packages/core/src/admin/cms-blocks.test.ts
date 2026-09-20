import { isValidCmsBlocks } from "./cms-blocks";

describe("M2 CMS block schema", () => {
  it("accepts a valid block set and rejects malformed/unknown blocks", () => {
    expect(
      isValidCmsBlocks({
        hero: { title: "Gieo Chữ", subtitle: "Nơi người dạy gieo chữ" },
        features: [{ title: "Bán tài liệu" }],
        stats: [{ value: "500+", label: "Giáo viên" }],
        testimonials: [{ quote: "Rất hữu ích", name: "Cô Lan", role: "Giáo viên Toán" }],
        pricingTable: { source: "plans" },
        faq: [{ question: "Phí bao nhiêu?", answer: "Miễn phí gói cơ bản." }],
      }),
    ).toBe(true);

    expect(isValidCmsBlocks({ hero: { subtitle: "thiếu title" } })).toBe(false);
    expect(isValidCmsBlocks({ pricingTable: { source: "not-plans" } })).toBe(false);
    expect(isValidCmsBlocks({ stats: [{ value: "500+" }] })).toBe(false);
    expect(isValidCmsBlocks({ testimonials: [{ name: "Cô Lan" }] })).toBe(false);
    expect(isValidCmsBlocks({ unknownBlock: {} })).toBe(false);
  });
});

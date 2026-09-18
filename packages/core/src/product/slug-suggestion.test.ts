import { suggestSlug } from "./slug-suggestion";

describe("M5 product slug suggestion on collision", () => {
  it("returns the base slug when free, otherwise the first free base-N", () => {
    expect(suggestSlug("de-thi-toan", [])).toBe("de-thi-toan");
    expect(suggestSlug("de-thi-toan", ["de-thi-toan"])).toBe("de-thi-toan-2");
    expect(suggestSlug("de-thi-toan", ["de-thi-toan", "de-thi-toan-2"])).toBe("de-thi-toan-3");
    expect(suggestSlug("de-thi-toan", ["de-thi-toan", "de-thi-toan-3"])).toBe("de-thi-toan-2");
  });
});

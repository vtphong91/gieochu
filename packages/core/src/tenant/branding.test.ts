import { isValidHexColor, isValidSocialLink } from "./branding";

describe("M4 branding validation", () => {
  it("validates hex colors and social links", () => {
    expect(isValidHexColor("#2563eb")).toBe(true);
    expect(isValidHexColor("#fff")).toBe(true);
    expect(isValidHexColor("2563eb")).toBe(false);
    expect(isValidHexColor("#ggg")).toBe(false);

    expect(isValidSocialLink("facebook", "https://facebook.com/giaovien")).toBe(true);
    expect(isValidSocialLink("facebook", "https://not-facebook.com/giaovien")).toBe(false);
    expect(isValidSocialLink("website", "https://example.com")).toBe(true);
    expect(isValidSocialLink("website", "not a url")).toBe(false);
  });
});

import { canPublishProduct, type PublishEligibilityInput } from "./publish-eligibility";

const eligible: PublishEligibilityInput = {
  categoryStatus: "active",
  hasCleanSaleFile: true,
  hasValidExternalLink: false,
  hasCoverImage: true,
  priceVnd: 50_000,
  tenantStatus: "ACTIVE",
  currentPublishedCount: 2,
  maxProducts: 10,
};

function codesOf(input: PublishEligibilityInput): string[] {
  return canPublishProduct(input).reasons.map((r) => r.code);
}

describe("M5 product publish eligibility", () => {
  it("allows publishing only when every condition holds, and reports every reason it doesn't", () => {
    const ok = canPublishProduct(eligible);
    expect(ok.allowed).toBe(true);
    expect(ok.reasons).toEqual([]);
    expect(ok.checklist.every((item) => item.passed)).toBe(true);

    expect(codesOf({ ...eligible, hasCleanSaleFile: false })).toContain("NO_DELIVERY_SOURCE");
    expect(codesOf({ ...eligible, hasCoverImage: false })).toContain("NO_COVER_IMAGE");
    expect(codesOf({ ...eligible, priceVnd: -1 })).toContain("INVALID_PRICE");
    expect(codesOf({ ...eligible, tenantStatus: "READ_ONLY" })).toContain("TENANT_NOT_ACTIVE");
    expect(codesOf({ ...eligible, currentPublishedCount: 10, maxProducts: 10 })).toContain("PRODUCT_LIMIT_REACHED");

    const allBlocked = canPublishProduct({
      categoryStatus: "missing",
      hasCleanSaleFile: false,
      hasValidExternalLink: false,
      hasCoverImage: false,
      priceVnd: -1,
      tenantStatus: "LOCKED",
      currentPublishedCount: 10,
      maxProducts: 10,
    });
    expect(allBlocked.allowed).toBe(false);
    expect(allBlocked.reasons).toHaveLength(6);
    expect(allBlocked.reasons.every((r) => r.message.length > 0)).toBe(true);
    expect(allBlocked.checklist.every((item) => !item.passed && item.message)).toBe(true);
  });

  it("ADR-026: requires an active category and accepts either a CLEAN sale file or a valid external link as delivery source", () => {
    expect(codesOf({ ...eligible, categoryStatus: "missing" })).toEqual(["CATEGORY_REQUIRED"]);
    expect(codesOf({ ...eligible, categoryStatus: "inactive" })).toEqual(["CATEGORY_INACTIVE"]);

    // Link-only product is publishable (owner decision, ADR-026).
    expect(canPublishProduct({ ...eligible, hasCleanSaleFile: false, hasValidExternalLink: true }).allowed).toBe(true);
    expect(canPublishProduct({ ...eligible, hasCleanSaleFile: true, hasValidExternalLink: true }).allowed).toBe(true);
    expect(codesOf({ ...eligible, hasCleanSaleFile: false, hasValidExternalLink: false })).toEqual(["NO_DELIVERY_SOURCE"]);

    const inactive = canPublishProduct({ ...eligible, categoryStatus: "inactive" });
    const categoryItem = inactive.checklist.find((item) => item.requirement === "CATEGORY");
    expect(categoryItem).toMatchObject({ passed: false });
    expect(inactive.checklist.filter((item) => item.passed)).toHaveLength(inactive.checklist.length - 1);
  });
});

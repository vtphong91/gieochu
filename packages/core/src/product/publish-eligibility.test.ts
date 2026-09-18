import { canPublishProduct } from "./publish-eligibility";

const eligible = {
  hasCleanSaleFile: true,
  hasCoverImage: true,
  priceVnd: 50_000,
  tenantStatus: "ACTIVE" as const,
  currentPublishedCount: 2,
  maxProducts: 10,
};

describe("M5 product publish eligibility", () => {
  it("allows publishing only when every condition holds, and reports every reason it doesn't", () => {
    expect(canPublishProduct(eligible)).toEqual({ allowed: true, reasons: [] });

    expect(canPublishProduct({ ...eligible, hasCleanSaleFile: false }).reasons).toContain("NO_CLEAN_SALE_FILE");
    expect(canPublishProduct({ ...eligible, hasCoverImage: false }).reasons).toContain("NO_COVER_IMAGE");
    expect(canPublishProduct({ ...eligible, priceVnd: -1 }).reasons).toContain("INVALID_PRICE");
    expect(canPublishProduct({ ...eligible, tenantStatus: "READ_ONLY" }).reasons).toContain("TENANT_NOT_ACTIVE");
    expect(canPublishProduct({ ...eligible, currentPublishedCount: 10, maxProducts: 10 }).reasons).toContain(
      "PRODUCT_LIMIT_REACHED",
    );

    const allBlocked = canPublishProduct({
      hasCleanSaleFile: false,
      hasCoverImage: false,
      priceVnd: -1,
      tenantStatus: "LOCKED",
      currentPublishedCount: 10,
      maxProducts: 10,
    });
    expect(allBlocked.allowed).toBe(false);
    expect(allBlocked.reasons).toHaveLength(5);
  });
});

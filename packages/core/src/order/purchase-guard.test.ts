import { canPurchaseProduct } from "./purchase-guard";

describe("M8 purchase guard", () => {
  it("blocks buying your own product and buying a product you already own", () => {
    expect(canPurchaseProduct({ isOwner: true, hasActiveEntitlement: false })).toEqual({ allowed: false, reason: "OWN_PRODUCT" });
    expect(canPurchaseProduct({ isOwner: false, hasActiveEntitlement: true })).toEqual({ allowed: false, reason: "ALREADY_OWNED" });
    expect(canPurchaseProduct({ isOwner: false, hasActiveEntitlement: false })).toEqual({ allowed: true });
  });
});

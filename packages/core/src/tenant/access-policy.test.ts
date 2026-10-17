import { resolveStorefrontAccess } from "./access-policy";

describe("M4 storefront access policy", () => {
  it("resolves access per tenant status and viewer", () => {
    expect(resolveStorefrontAccess("ACTIVE", "guest")).toBe("ACTIVE");
    expect(resolveStorefrontAccess("READ_ONLY", "guest")).toBe("SUSPENDED_NOTICE");
    expect(resolveStorefrontAccess("READ_ONLY", "owner")).toBe("READ_ONLY");
    expect(resolveStorefrontAccess("LOCKED", "guest")).toBe("NOT_FOUND");
    expect(resolveStorefrontAccess("LOCKED", "owner")).toBe("LOCKED_NOTICE");
  });
});

import { transitionSubscriptionStatus } from "./subscription-state";

describe("M3 subscription state machine", () => {
  it("allows every transition drawn in the spec's state diagram", () => {
    expect(transitionSubscriptionStatus("TRIALING", "INVOICE_PAID")).toBe("ACTIVE");
    expect(transitionSubscriptionStatus("TRIALING", "PERIOD_ENDED")).toBe("GRACE");
    expect(transitionSubscriptionStatus("ACTIVE", "PERIOD_ENDED")).toBe("GRACE");
    expect(transitionSubscriptionStatus("GRACE", "INVOICE_PAID")).toBe("ACTIVE");
    expect(transitionSubscriptionStatus("GRACE", "GRACE_ENDED")).toBe("EXPIRED");
    expect(transitionSubscriptionStatus("EXPIRED", "INVOICE_PAID")).toBe("ACTIVE");
    expect(transitionSubscriptionStatus("ACTIVE", "OWNER_CANCELED")).toBe("CANCELED");
    expect(transitionSubscriptionStatus("CANCELED", "PERIOD_ENDED")).toBe("EXPIRED");
  });

  it("throws on a transition the diagram does not draw", () => {
    expect(() => transitionSubscriptionStatus("EXPIRED", "GRACE_ENDED")).toThrow(/Không thể chuyển/);
    expect(() => transitionSubscriptionStatus("CANCELED", "INVOICE_PAID")).toThrow(/Không thể chuyển/);
  });
});

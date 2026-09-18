import { transitionOrderStatus } from "./state";

describe("M8 order state machine", () => {
  it("allows every transition drawn in the spec's state diagram", () => {
    expect(transitionOrderStatus("PENDING", "MARK_PAID")).toBe("PAID");
    expect(transitionOrderStatus("PENDING", "EXPIRE")).toBe("EXPIRED");
    expect(transitionOrderStatus("PENDING", "CANCEL")).toBe("CANCELED");
    expect(transitionOrderStatus("EXPIRED", "MARK_PAID")).toBe("PAID");
    expect(transitionOrderStatus("PAID", "FULFILL")).toBe("FULFILLED");
    expect(transitionOrderStatus("FULFILLED", "REFUND")).toBe("REFUNDED");
  });

  it("throws on a transition the diagram does not draw", () => {
    expect(() => transitionOrderStatus("CANCELED", "MARK_PAID")).toThrow(/Không thể chuyển/);
    expect(() => transitionOrderStatus("FULFILLED", "MARK_PAID")).toThrow(/Không thể chuyển/);
    expect(() => transitionOrderStatus("PENDING", "FULFILL")).toThrow(/Không thể chuyển/);
  });
});

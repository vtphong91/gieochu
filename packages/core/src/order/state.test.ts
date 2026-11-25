import { transitionOrderStatus } from "./state";

describe("M8 order state machine", () => {
  it("allows every transition drawn in the spec's state diagram", () => {
    expect(transitionOrderStatus("PENDING", "MARK_PAID")).toBe("PAID");
    expect(transitionOrderStatus("PENDING", "EXPIRE")).toBe("EXPIRED");
    expect(transitionOrderStatus("PENDING", "CANCEL")).toBe("CANCELED");
    expect(transitionOrderStatus("EXPIRED", "MARK_PAID")).toBe("PAID");
    expect(transitionOrderStatus("PAID", "FULFILL")).toBe("FULFILLED");
    expect(transitionOrderStatus("FULFILLED", "REFUND")).toBe("REFUNDED");
    // ADR-068: thao tác "Đổi trạng thái…" của người bán.
    expect(transitionOrderStatus("PENDING", "SELLER_CANCEL")).toBe("CANCELED");
    expect(transitionOrderStatus("EXPIRED", "SELLER_CANCEL")).toBe("CANCELED");
    expect(transitionOrderStatus("EXPIRED", "SELLER_REOPEN")).toBe("PENDING");
    expect(transitionOrderStatus("CANCELED", "SELLER_REOPEN")).toBe("PENDING");
  });

  it("throws on a transition the diagram does not draw", () => {
    expect(() => transitionOrderStatus("CANCELED", "MARK_PAID")).toThrow(/Không thể chuyển/);
    expect(() => transitionOrderStatus("FULFILLED", "MARK_PAID")).toThrow(/Không thể chuyển/);
    expect(() => transitionOrderStatus("PENDING", "FULFILL")).toThrow(/Không thể chuyển/);
    // ADR-068: luồng khách/cũ không huỷ được đơn hết hạn; đơn đã trả/hoàn không mở lại được.
    expect(() => transitionOrderStatus("EXPIRED", "CANCEL")).toThrow(/Không thể chuyển/);
    expect(() => transitionOrderStatus("FULFILLED", "SELLER_REOPEN")).toThrow(/Không thể chuyển/);
    expect(() => transitionOrderStatus("REFUNDED", "SELLER_CANCEL")).toThrow(/Không thể chuyển/);
  });
});

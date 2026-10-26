import { buildWebhookNotifyUrl, getProvider, isManualConfirmProvider } from "./registry";


describe("M7 payment provider registry", () => {
  it("resolves the correct provider by id and the correct webhook URL by scope", () => {
    expect(getProvider("MANUAL_QR").id).toBe("MANUAL_QR");
    expect(getProvider("SEPAY").id).toBe("SEPAY");
    expect(getProvider("MOMO").id).toBe("MOMO");
    // ADR-059 bổ sung lần 3: MoMo cá nhân xác nhận tay như MANUAL_QR, không webhook.
    expect(getProvider("MOMO_MANUAL").id).toBe("MOMO_MANUAL");
    expect(["MANUAL_QR", "MOMO_MANUAL", "SEPAY", "MOMO"].map((id) => isManualConfirmProvider(id as never))).toEqual([true, true, false, false]);

    expect(buildWebhookNotifyUrl("https://gieochu.net", { kind: "PLATFORM" }, "SEPAY")).toBe(
      "https://gieochu.net/api/webhooks/platform/sepay",
    );
    expect(buildWebhookNotifyUrl("https://gieochu.net", { kind: "TENANT", tenantId: "t_123" }, "MOMO")).toBe(
      "https://gieochu.net/api/webhooks/tenants/t_123/momo",
    );
  });
});

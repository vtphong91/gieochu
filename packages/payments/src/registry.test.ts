import { buildWebhookNotifyUrl, getProvider } from "./registry";

describe("M7 payment provider registry", () => {
  it("resolves the correct provider by id and the correct webhook URL by scope", () => {
    expect(getProvider("MANUAL_QR").id).toBe("MANUAL_QR");
    expect(getProvider("SEPAY").id).toBe("SEPAY");
    expect(getProvider("MOMO").id).toBe("MOMO");

    expect(buildWebhookNotifyUrl("https://gieochu.net", { kind: "PLATFORM" }, "SEPAY")).toBe(
      "https://gieochu.net/api/webhooks/platform/sepay",
    );
    expect(buildWebhookNotifyUrl("https://gieochu.net", { kind: "TENANT", tenantId: "t_123" }, "MOMO")).toBe(
      "https://gieochu.net/api/webhooks/tenants/t_123/momo",
    );
  });
});

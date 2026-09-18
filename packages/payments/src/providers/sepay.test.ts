import { createHmac } from "node:crypto";
import { extractSepayReference, sepayProvider } from "./sepay";
import type { SepayConfig } from "../types";

const baseConfig: SepayConfig = {
  bankBin: "970403",
  accountNo: "0011012345678",
  accountName: "NGUYEN VAN A",
  authType: "API_KEY",
  secret: "test-secret",
  paymentPrefix: "HAN",
};

describe("M7 SePay provider", () => {
  it("authenticates a webhook via the API key header", async () => {
    const cfg = { ...baseConfig, authType: "API_KEY" as const };
    const valid = await sepayProvider.verifyWebhook(
      { headers: { authorization: "Apikey test-secret" }, rawBody: "{}" },
      cfg,
    );
    expect(valid).toBe(true);

    const invalid = await sepayProvider.verifyWebhook(
      { headers: { authorization: "Apikey wrong-key" }, rawBody: "{}" },
      cfg,
    );
    expect(invalid).toBe(false);
  });

  it("authenticates a webhook via HMAC-SHA256 signature", async () => {
    const cfg = { ...baseConfig, authType: "HMAC_SHA256" as const };
    const rawBody = '{"id":1,"transferAmount":100000}';
    const timestamp = "1700000000";
    const signature = `sha256=${createHmac("sha256", cfg.secret).update(`${timestamp}.${rawBody}`).digest("hex")}`;

    const valid = await sepayProvider.verifyWebhook(
      { headers: { "x-sepay-signature": signature, "x-sepay-timestamp": timestamp }, rawBody },
      cfg,
    );
    expect(valid).toBe(true);

    const invalid = await sepayProvider.verifyWebhook(
      { headers: { "x-sepay-signature": "sha256=deadbeef", "x-sepay-timestamp": timestamp }, rawBody },
      cfg,
    );
    expect(invalid).toBe(false);
  });

  it("parses the webhook payload and extracts the reference by prefix", () => {
    const body = {
      id: 92704,
      code: null,
      content: "HAN7K2QXM chuyen tien mua tai lieu",
      transferType: "in" as const,
      transferAmount: 5_000_000,
      transactionDate: "2024-07-02 11:08:33",
    };

    const event = sepayProvider.parseWebhook(body);
    expect(event.providerEventId).toBe("92704");
    expect(event.amountVnd).toBe(5_000_000);
    expect(event.success).toBe(true);

    expect(extractSepayReference(body, "HAN")).toBe("HAN7K2QXM");
  });
});

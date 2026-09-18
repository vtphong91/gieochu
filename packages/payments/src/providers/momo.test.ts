import { buildMomoCreateSignature, buildMomoIpnSignature, momoProvider } from "./momo";
import type { MomoConfig } from "../types";

// Official MoMo sandbox test credentials from github.com/momo-wallet/payment
// (php/atm/atm_momo.php) — used only as a known-good signature fixture.
const cfg: MomoConfig = {
  partnerCode: "MOMOBKUN20180529",
  accessKey: "klm05TvNBzhg7h7j",
  secretKey: "at67qH6mk8w5Y1nAyMoYKMWACiEi2bsa",
  environment: "sandbox",
};

describe("M7 MoMo provider", () => {
  it("generates a create-payment signature matching a known sample (raw hash field order verified against MoMo's official sample code)", () => {
    const signature = buildMomoCreateSignature(cfg, {
      amount: 50000,
      extraData: "",
      ipnUrl: "https://gieochu.net/api/webhooks/tenants/t1/momo",
      orderId: "MM1700000000",
      orderInfo: "Thanh toan don hang MM1700000000",
      redirectUrl: "https://gieochu.net/return",
      requestId: "MM1700000000-1",
      requestType: "captureWallet",
    });

    expect(signature).toBe("1a089f3faafa74161c7e4e852ee664d7720a8e9aba716e7b6eb4083fb1810d6d");
  });

  it("verifies an IPN with a correct signature and rejects a tampered one", async () => {
    const ipnParams = {
      accessKey: cfg.accessKey,
      amount: "50000",
      extraData: "",
      message: "Successful.",
      orderId: "MM1700000000",
      orderInfo: "Thanh toan don hang MM1700000000",
      orderType: "momo_wallet",
      partnerCode: cfg.partnerCode,
      payType: "qr",
      requestId: "MM1700000000-1",
      responseTime: 1700000000000,
      resultCode: 0,
      transId: 987654321,
    };
    const validSignature = buildMomoIpnSignature(cfg.secretKey, ipnParams);
    const body = { ...ipnParams, amount: 50000, signature: validSignature };

    const valid = await momoProvider.verifyWebhook({ headers: {}, rawBody: JSON.stringify(body) }, cfg);
    expect(valid).toBe(true);

    const tampered = { ...body, resultCode: 1 };
    const invalid = await momoProvider.verifyWebhook({ headers: {}, rawBody: JSON.stringify(tampered) }, cfg);
    expect(invalid).toBe(false);
  });
});

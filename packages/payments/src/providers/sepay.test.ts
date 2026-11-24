import { createHmac } from "node:crypto";
import {
  extractSepayPaymentCodes,
  extractSepayReference,
  extractSepayReferences,
  sepayAccountMatches,
  sepayProvider,
  testSepayConnection,
} from "./sepay";
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

    // ADR-059 bổ sung lần 2: giới hạn độ dài mã → nội dung bị nối liền vẫn tách đúng; tiền tố được escape; thử nhiều tiền tố
    // theo thứ tự (tiền tố cấu hình lệch vẫn khớp theo tiền tố mã đơn).
    const glued = { ...body, content: "HAN7K2QXMNGUYENVANA" };
    expect(extractSepayReference(glued, "HAN")).toBe("HAN7K2QXMNGUYENVANA");
    expect(extractSepayReference(glued, "HAN", { codeLength: 6 })).toBe("HAN7K2QXM");
    expect(extractSepayReference({ ...body, content: "thanh toan A1B2C3D4" }, "A.", { codeLength: 6 })).toBeUndefined();
    expect(extractSepayReferences(glued, ["GC", "HAN"], { codeLength: 6 })).toEqual(["HAN7K2QXM"]);
    expect(() => sepayProvider.parseWebhook({ id: 1, transferType: "in", transferAmount: 1000 })).toThrow();
  });

  it("ADR-065: extracts only prefix + 8-digit payment codes, SePay's own `code` first", () => {
    const base = { id: 1, transferType: "in" as const, transferAmount: 99_000, transactionDate: "2026-11-24 14:07:22" };
    const content = "CT DEN:945T26B14AZ5VN4P MBVCB.13345.SEVQR40718256.NGUYEN VAN A";
    expect(extractSepayPaymentCodes({ ...base, content }, ["sevqr"])).toEqual(["SEVQR40718256"]);
    // Nội dung bị nối liền vẫn tách đúng; `code` của SePay đứng trước `content`.
    expect(extractSepayPaymentCodes({ ...base, code: "SEVQR11112222", content: "SEVQR40718256NGUYENVANA" }, ["SEVQR"])).toEqual([
      "SEVQR11112222",
      "SEVQR40718256",
    ]);
    // Hậu tố lẫn chữ (mã cũ), 9 chữ số liền nhau, tiền tố không hợp lệ → không phải mã thanh toán.
    expect(extractSepayPaymentCodes({ ...base, content: "SEVQRWQRMN878" }, ["SEVQR"])).toEqual([]);
    expect(extractSepayPaymentCodes({ ...base, content: "SEVQR407182569" }, ["SEVQR"])).toEqual([]);
    expect(extractSepayPaymentCodes({ ...base, content }, ["SEVQR1", "", null])).toEqual([]);
  });

  it("ADR-065: ignores a transaction credited to another bank account of the same SePay account", () => {
    expect(sepayAccountMatches({ accountNumber: "0011012345678" }, baseConfig.accountNo)).toBe(true);
    expect(sepayAccountMatches({ accountNumber: "0011 0123 45678" }, baseConfig.accountNo)).toBe(true);
    expect(sepayAccountMatches({ accountNumber: "106887878525" }, baseConfig.accountNo)).toBe(false);
    // Payload không có số tài khoản → không đủ căn cứ từ chối.
    expect(sepayAccountMatches({ content: "x" }, baseConfig.accountNo)).toBe(true);
  });

  it("test connection: rejects a bad token or an unlinked account, accepts a linked active account", async () => {
    const respond = (status: number, body: unknown) => (async () => new Response(JSON.stringify(body), { status })) as typeof fetch;
    const accounts = { bankaccounts: [{ account_number: "0011012345678", bank_bin: "970403", bank_short_name: "BIDV", active: "1" }] };

    expect((await testSepayConnection(baseConfig, respond(200, accounts))).message).toContain("Chưa nhập API Token");
    const cfg = { ...baseConfig, apiToken: "token" };
    expect(await testSepayConnection(cfg, respond(401, {}))).toMatchObject({ ok: false, message: expect.stringContaining("không hợp lệ") });
    expect(await testSepayConnection({ ...cfg, accountNo: "999999999" }, respond(200, accounts))).toMatchObject({ ok: false });
    expect(await testSepayConnection({ ...cfg, bankBin: "970415" }, respond(200, accounts))).toMatchObject({ ok: false });
    expect(await testSepayConnection(cfg, respond(200, accounts))).toMatchObject({ ok: true, message: expect.stringContaining("••••5678") });
  });
});

import { buildVietQrPayload, crc16ccitt } from "./vietqr";
import { MOMO_VIETQR_BIN, momoManualProvider, normalizeMomoManualConfig } from "./providers/momo-manual";

describe("M7 VietQR payload", () => {
  it("matches a known-good sample payload (verified field-by-field before writing this test)", async () => {
    const payload = buildVietQrPayload({ bankBin: "970403", accountNo: "0011012345678" });
    expect(payload).toBe(
      "00020101021138570010A00000072701270006970403011300110123456780208QRIBFTTA53037045802VN63049E6F",
    );

    // ADR-059 bổ sung lần 3 — MoMo cá nhân: chuẩn hoá cấu hình; có "số TK nhận VietQR" → VietQR (BIN MoMo, số tiền, nội dung = mã),
    // không có → chỉ thông tin chuyển tay (qr = null).
    const cfg = normalizeMomoManualConfig({ phone: "+84 912.345.678", accountName: "  Nguyễn Văn  Đức ", vietQrAccountNo: " 99mm24011m34875080 " });
    expect(cfg).toEqual({ phone: "0912345678", accountName: "NGUYEN VAN DUC", vietQrAccountNo: "99MM24011M34875080" });
    expect(momoManualProvider.validateConfig(cfg)).toEqual(cfg);
    expect(() => momoManualProvider.validateConfig({ ...cfg, phone: "12345" })).toThrow();
    const args = { scope: { kind: "TENANT" as const, tenantId: "t1" }, reference: "HAN7K2QXM", amountVnd: 1_197_000, description: "", returnUrl: "", notifyUrl: "" };
    const withQr = await momoManualProvider.createCheckout({ ...args, cfg });
    expect(withQr).toMatchObject({ kind: "WALLET", phone: "0912345678", content: "HAN7K2QXM", amountVnd: 1_197_000 });
    expect(withQr.kind === "WALLET" && withQr.qr?.qrPayload).toBe(
      buildVietQrPayload({ bankBin: MOMO_VIETQR_BIN, accountNo: "99MM24011M34875080", amountVnd: 1_197_000, content: "HAN7K2QXM" }),
    );
    const noQr = await momoManualProvider.createCheckout({ ...args, cfg: { phone: cfg.phone, accountName: cfg.accountName } });
    expect(noQr.kind === "WALLET" && noQr.qr).toBeNull();
  });

  it("computes CRC-16/CCITT-FALSE correctly (canonical check value for '123456789')", () => {
    expect(crc16ccitt("123456789")).toBe("29B1");
  });
});

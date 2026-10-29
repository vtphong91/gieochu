import { buildVietQrPayload, crc16ccitt } from "./vietqr";
import { momoManualProvider, normalizeMomoManualConfig } from "./providers/momo-manual";

describe("M7 VietQR payload", () => {
  it("matches a known-good sample payload (verified field-by-field before writing this test)", async () => {
    const payload = buildVietQrPayload({ bankBin: "970403", accountNo: "0011012345678" });
    expect(payload).toBe(
      "00020101021138570010A00000072701270006970403011300110123456780208QRIBFTTA53037045802VN63049E6F",
    );

    // ADR-059 bổ sung lần 3/4 — MoMo cá nhân: chuẩn hoá cấu hình; KHÔNG có QR (chỉ thông tin chuyển tay, qr = null). Cấu hình cũ
    // còn `vietQrAccountNo` vẫn hợp lệ, trường đó bị bỏ qua.
    const cfg = normalizeMomoManualConfig({ phone: "+84 912.345.678", accountName: "  Nguyễn Văn  Đức " });
    expect(cfg).toEqual({ phone: "0912345678", accountName: "NGUYEN VAN DUC" });
    expect(momoManualProvider.validateConfig(cfg)).toEqual(cfg);
    expect(momoManualProvider.validateConfig({ ...cfg, vietQrAccountNo: "99MM24011M34875080" })).toEqual(cfg);
    expect(() => momoManualProvider.validateConfig({ ...cfg, phone: "12345" })).toThrow();
    const args = { scope: { kind: "TENANT" as const, tenantId: "t1" }, reference: "HAN7K2QXM", amountVnd: 1_197_000, description: "", returnUrl: "", notifyUrl: "" };
    const wallet = await momoManualProvider.createCheckout({ ...args, cfg: { ...cfg, vietQrAccountNo: "99MM24011M34875080" } as never });
    expect(wallet).toEqual({ kind: "WALLET", wallet: "MOMO", phone: "0912345678", accountName: "NGUYEN VAN DUC", content: "HAN7K2QXM", amountVnd: 1_197_000, qr: null });
  });

  it("computes CRC-16/CCITT-FALSE correctly (canonical check value for '123456789')", () => {
    expect(crc16ccitt("123456789")).toBe("29B1");
  });
});

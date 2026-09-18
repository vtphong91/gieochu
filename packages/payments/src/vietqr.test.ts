import { buildVietQrPayload, crc16ccitt } from "./vietqr";

describe("M7 VietQR payload", () => {
  it("matches a known-good sample payload (verified field-by-field before writing this test)", () => {
    const payload = buildVietQrPayload({ bankBin: "970403", accountNo: "0011012345678" });
    expect(payload).toBe(
      "00020101021138570010A00000072701270006970403011300110123456780208QRIBFTTA53037045802VN63049E6F",
    );
  });

  it("computes CRC-16/CCITT-FALSE correctly (canonical check value for '123456789')", () => {
    expect(crc16ccitt("123456789")).toBe("29B1");
  });
});

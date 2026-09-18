import { buildProductFileKey, sanitizeFileName } from "./object-key";

describe("M5 object key generation and file name sanitization", () => {
  it("sanitizes unsafe file names and builds the object key in the spec's exact format", () => {
    expect(sanitizeFileName("  Đề thi Toán 12 (v2).pdf  ")).toBe("thi_To_n_12_v2_.pdf");
    expect(sanitizeFileName("../../etc/passwd")).toBe("passwd");
    expect(sanitizeFileName("C:\\Users\\a\\report final.docx")).toBe("report_final.docx");
    expect(sanitizeFileName("...")).toBe("file");

    expect(buildProductFileKey("tenant1", "prod1", "file1", "Đề Cương.pdf")).toBe(
      "tenants/tenant1/products/prod1/file1/C_ng.pdf",
    );
  });
});

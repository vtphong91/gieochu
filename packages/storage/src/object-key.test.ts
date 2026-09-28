import { buildProductFileKey, isProductObjectKeyFor, sanitizeFileName } from "./object-key";

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

  it("accepts only object keys built for the same tenant/product and rejects foreign, traversal or malformed keys", () => {
    const uuid = "123e4567-e89b-42d3-a456-426614174000";
    const ownFile = buildProductFileKey("tenantA", "prodA", uuid, "Đề thi.pdf");
    const ownCover = buildProductFileKey("tenantA", "prodA", "cover", "anh bia.png");

    expect(isProductObjectKeyFor(ownFile, "tenantA", "prodA", "file")).toBe(true);
    expect(isProductObjectKeyFor(ownCover, "tenantA", "prodA", "cover")).toBe(true);

    // Another tenant's / product's key, and cross-kind reuse.
    expect(isProductObjectKeyFor(buildProductFileKey("tenantB", "prodB", uuid, "a.pdf"), "tenantA", "prodA", "file")).toBe(false);
    expect(isProductObjectKeyFor(buildProductFileKey("tenantA", "prodX", uuid, "a.pdf"), "tenantA", "prodA", "file")).toBe(false);
    expect(isProductObjectKeyFor(ownCover, "tenantA", "prodA", "file")).toBe(false);
    expect(isProductObjectKeyFor(ownFile, "tenantA", "prodA", "cover")).toBe(false);

    // Traversal, extra segments, unsanitized names, prefix tricks.
    expect(isProductObjectKeyFor(`tenants/tenantA/products/prodA/${uuid}/../../../tenantB/x.pdf`, "tenantA", "prodA", "file")).toBe(false);
    expect(isProductObjectKeyFor(`tenants/tenantA/products/prodA/${uuid}/..`, "tenantA", "prodA", "file")).toBe(false);
    expect(isProductObjectKeyFor(`tenants/tenantA/products/prodA/${uuid}/a b.pdf`, "tenantA", "prodA", "file")).toBe(false);
    expect(isProductObjectKeyFor(`tenants/tenantA/products/prodA/${uuid}/`, "tenantA", "prodA", "file")).toBe(false);
    expect(isProductObjectKeyFor(`tenants/tenantA/products/prodAB/${uuid}/a.pdf`, "tenantA", "prodA", "file")).toBe(false);
    expect(isProductObjectKeyFor(`tenants/tenantA/products/prodA/not-a-uuid/a.pdf`, "tenantA", "prodA", "file")).toBe(false);
  });
});

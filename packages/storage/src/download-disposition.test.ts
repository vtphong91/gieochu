import { buildAttachmentDisposition, clampDownloadTtlSeconds, MAX_DOWNLOAD_PRESIGN_TTL_SECONDS } from "./download-disposition";

describe("M9 download presign options", () => {
  it("always forces attachment (never inline) and clamps the TTL to <= 600s", () => {
    const header = buildAttachmentDisposition("Đề thi Toán lớp 10.pdf");
    expect(header).toContain("attachment;");
    expect(header).toContain(`filename*=UTF-8''${encodeURIComponent("Đề thi Toán lớp 10.pdf")}`);
    expect(header).toMatch(/filename="[\x20-\x7E]*"/);

    expect(clampDownloadTtlSeconds(900)).toBe(MAX_DOWNLOAD_PRESIGN_TTL_SECONDS);
    expect(clampDownloadTtlSeconds(120)).toBe(120);
  });
});

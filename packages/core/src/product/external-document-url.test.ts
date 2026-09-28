import { EXTERNAL_DOCUMENT_URL_MAX_LENGTH, isAllowedExternalDocumentUrl, normalizeExternalDocumentUrl } from "./external-document-url";

describe("ADR-026 external document link allowlist", () => {
  it("accepts only https links on allowlisted hosts and rejects lookalikes, userinfo, ports and other schemes", () => {
    const allowed = [
      "https://drive.google.com/file/d/abc123/view?usp=sharing",
      "https://docs.google.com/document/d/abc/edit",
      "https://onedrive.live.com/?id=ABC",
      "https://1drv.ms/w/s!Abc",
      "https://contoso.sharepoint.com/:w:/s/team/abc",
      "https://contoso-my.sharepoint.com/personal/x",
      "https://www.dropbox.com/s/abc/de-thi.pdf?dl=0",
      "https://dropbox.com/s/abc/de-thi.pdf",
      "  https://DRIVE.GOOGLE.COM/file/d/abc  ",
    ];
    for (const url of allowed) expect(isAllowedExternalDocumentUrl(url)).toBe(true);
    expect(normalizeExternalDocumentUrl("  https://DRIVE.GOOGLE.COM/file/d/abc  ")).toBe("https://drive.google.com/file/d/abc");

    const rejected = [
      "http://drive.google.com/file/d/abc",
      "javascript:alert(1)",
      "ftp://drive.google.com/x",
      "https://evilsharepoint.com/x",
      "https://sharepoint.com/x",
      "https://.sharepoint.com/x",
      "https://a.b.sharepoint.com/x",
      "https://sharepoint.com.evil.com/x",
      "https://drive.google.com.evil.com/x",
      "https://evil.com/drive.google.com",
      "https://user:pass@drive.google.com/x",
      "https://drive.google.com@evil.com/x",
      "https://drive.google.com:8443/x",
      "https://dl.dropbox.com/x",
      "https://mail.google.com/x",
      "not a url",
      "",
      `https://drive.google.com/${"a".repeat(EXTERNAL_DOCUMENT_URL_MAX_LENGTH)}`,
    ];
    for (const url of rejected) expect(isAllowedExternalDocumentUrl(url)).toBe(false);
  });
});

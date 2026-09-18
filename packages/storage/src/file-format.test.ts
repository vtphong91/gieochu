import { isAllowedExtension, matchesDeclaredExtension } from "./file-format";

describe("M5 file format validation (extension + magic bytes)", () => {
  it("accepts an allowed extension whose magic bytes match, and rejects everything else", () => {
    expect(isAllowedExtension("de-thi.pdf")).toBe(true);
    expect(isAllowedExtension("script.exe")).toBe(false);

    // extension allowed AND magic bytes match declared type
    expect(matchesDeclaredExtension("de-thi.pdf", "pdf")).toBe(true);
    expect(matchesDeclaredExtension("bai-giang.docx", "docx")).toBe(true);
    expect(matchesDeclaredExtension("giao-an-cu.doc", "cfb")).toBe(true);

    // a renamed .exe pretending to be a .pdf — the whole point of magic-byte checking
    expect(matchesDeclaredExtension("virus.pdf", "exe")).toBe(false);
    // disallowed extension outright, regardless of what the bytes say
    expect(matchesDeclaredExtension("script.exe", "pdf")).toBe(false);
    // bytes couldn't be identified at all
    expect(matchesDeclaredExtension("de-thi.pdf", undefined)).toBe(false);
  });
});

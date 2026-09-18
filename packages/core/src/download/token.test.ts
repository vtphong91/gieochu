import { createDownloadToken, evaluateDownloadToken } from "./token";

describe("M9 download token", () => {
  it("generates a random token, stores only its hash, and expires 60s later by default", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const a = createDownloadToken(now);
    const b = createDownloadToken(now);

    expect(a.token).not.toBe(b.token);
    expect(a.tokenHash).not.toBe(a.token);
    expect(a.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(a.expiresAt.getTime()).toBe(now.getTime() + 60_000);

    expect(evaluateDownloadToken({ expiresAt: a.expiresAt, usedAt: null }, now)).toBe("valid");
    expect(evaluateDownloadToken({ expiresAt: a.expiresAt, usedAt: now }, now)).toBe("used");
    expect(evaluateDownloadToken({ expiresAt: a.expiresAt, usedAt: null }, a.expiresAt)).toBe("expired");
  });
});

import { hashOpaqueToken } from "./random-token";
import { createVerificationToken, evaluateVerificationToken } from "./verification-token";

describe("M1 verification token", () => {
  it("has the requested TTL (e.g. 24h) and only the hash is retained", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const { token, tokenHash, expiresAt } = createVerificationToken(24, now);

    expect(expiresAt.getTime() - now.getTime()).toBe(24 * 60 * 60 * 1000);
    expect(tokenHash).not.toBe(token);
    expect(tokenHash).toBe(hashOpaqueToken(token));
  });

  it("can only be used once", () => {
    const now = new Date("2026-01-01T12:00:00Z");
    const used = { expiresAt: new Date("2026-01-02"), usedAt: new Date("2026-01-01T11:00:00Z") };

    expect(evaluateVerificationToken(used, now)).toBe("used");
  });

  it("rejects an expired token", () => {
    const now = new Date("2026-01-02T00:00:00Z");
    const expired = { expiresAt: new Date("2026-01-01T00:00:00Z"), usedAt: null };

    expect(evaluateVerificationToken(expired, now)).toBe("expired");
  });
});

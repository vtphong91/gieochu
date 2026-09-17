import { hashOpaqueToken } from "./random-token";
import { createRefreshToken, evaluateRefreshToken, rotateRefreshToken } from "./refresh-token";

describe("M1 refresh token", () => {
  it("generates a random opaque token and hashes it correctly", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const a = createRefreshToken("family_1", 7, now);
    const b = createRefreshToken("family_1", 7, now);

    expect(a.token).not.toBe(b.token);
    expect(a.tokenHash).toBe(hashOpaqueToken(a.token));
    expect(a.tokenHash).toHaveLength(64); // sha256 hex
  });

  it("rotation issues a fresh token bound to the same family", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const rotated = rotateRefreshToken("family_1", 7, now);

    expect(rotated.familyId).toBe("family_1");
    expect(rotated.expiresAt.getTime()).toBe(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    expect(hashOpaqueToken(rotated.token)).toBe(rotated.tokenHash);
  });

  it("flags a replaced or revoked token as reused", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const replaced = { expiresAt: new Date("2026-02-01"), revokedAt: null, replacedById: "rt_new" };
    const revoked = { expiresAt: new Date("2026-02-01"), revokedAt: new Date("2026-01-02"), replacedById: null };

    expect(evaluateRefreshToken(replaced, now)).toBe("reused");
    expect(evaluateRefreshToken(revoked, now)).toBe("reused");
  });

  it("rejects an expired refresh token", () => {
    const now = new Date("2026-01-10T00:00:00Z");
    const expired = { expiresAt: new Date("2026-01-01"), revokedAt: null, replacedById: null };

    expect(evaluateRefreshToken(expired, now)).toBe("expired");
  });
});

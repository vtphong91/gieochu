import { isShareLinkUsable } from "./share-link";

describe("M9 share link usability", () => {
  it("is unusable once past its expiresAt", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const expired = { expiresAt: new Date("2025-12-31T00:00:00.000Z"), maxUses: null, usedCount: 0, revokedAt: null };
    expect(isShareLinkUsable(expired, now)).toEqual({ usable: false, reason: "EXPIRED" });

    const notYet = { expiresAt: new Date("2026-01-02T00:00:00.000Z"), maxUses: null, usedCount: 0, revokedAt: null };
    expect(isShareLinkUsable(notYet, now)).toEqual({ usable: true });
  });

  it("is unusable once usedCount reaches maxUses, but null maxUses means unlimited", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    expect(isShareLinkUsable({ expiresAt: null, maxUses: 3, usedCount: 3, revokedAt: null }, now)).toEqual({
      usable: false,
      reason: "LIMIT_REACHED",
    });
    expect(isShareLinkUsable({ expiresAt: null, maxUses: null, usedCount: 9999, revokedAt: null }, now)).toEqual({ usable: true });
  });
});

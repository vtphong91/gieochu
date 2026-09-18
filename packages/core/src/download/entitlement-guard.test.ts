import { canDownloadEntitlement } from "./entitlement-guard";

describe("M9 entitlement download guard", () => {
  it("blocks once downloadsUsed reaches downloadLimit, but 0 means unlimited", () => {
    expect(canDownloadEntitlement({ revokedAt: null, downloadsUsed: 5, downloadLimit: 5 })).toEqual({
      allowed: false,
      reason: "LIMIT_REACHED",
    });
    expect(canDownloadEntitlement({ revokedAt: null, downloadsUsed: 4, downloadLimit: 5 })).toEqual({ allowed: true });
    expect(canDownloadEntitlement({ revokedAt: null, downloadsUsed: 999, downloadLimit: 0 })).toEqual({ allowed: true });
  });

  it("blocks a revoked entitlement regardless of remaining downloads", () => {
    expect(canDownloadEntitlement({ revokedAt: new Date(), downloadsUsed: 0, downloadLimit: 5 })).toEqual({
      allowed: false,
      reason: "REVOKED",
    });
  });
});

import { accessTokenSecret, signAccessToken, verifyAccessToken, type JwtContext } from "./access-token";

const context: JwtContext = {
  secret: accessTokenSecret("a".repeat(32)),
  issuer: "gieochu",
  audience: "gieochu-web",
};

const claims = { sub: "user_1", sid: "family_1", role: "USER" as const, ver: true, pc: false };

describe("M1 access token", () => {
  it("has a 15-minute expiry and carries all required claims", async () => {
    const token = await signAccessToken(claims, context, 15 * 60);
    const verified = await verifyAccessToken(token, context);

    expect(verified.sub).toBe(claims.sub);
    expect(verified.sid).toBe(claims.sid);
    expect(verified.role).toBe(claims.role);
    expect(verified.ver).toBe(claims.ver);
    expect(verified.pc).toBe(claims.pc);
    expect(verified.exp - verified.iat).toBe(15 * 60);
  });

  it("rejects an expired token", async () => {
    const token = await signAccessToken(claims, context, -10);
    await expect(verifyAccessToken(token, context)).rejects.toThrow();
  });

  it("rejects a token with the wrong signature, issuer, or audience", async () => {
    const token = await signAccessToken(claims, context, 900);

    const wrongSecretContext: JwtContext = { ...context, secret: accessTokenSecret("b".repeat(32)) };
    await expect(verifyAccessToken(token, wrongSecretContext)).rejects.toThrow();

    const wrongIssuerContext: JwtContext = { ...context, issuer: "not-gieochu" };
    await expect(verifyAccessToken(token, wrongIssuerContext)).rejects.toThrow();

    const wrongAudienceContext: JwtContext = { ...context, audience: "not-gieochu-web" };
    await expect(verifyAccessToken(token, wrongAudienceContext)).rejects.toThrow();
  });
});

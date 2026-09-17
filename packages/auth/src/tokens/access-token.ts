import { jwtVerify, SignJWT } from "jose";
import type { SystemRole } from "../rbac";

export interface AccessTokenClaims {
  /** user id */
  sub: string;
  /** refresh token family id, so a revoked family invalidates issued access tokens' lineage */
  sid: string;
  role: SystemRole;
  /** email verified */
  ver: boolean;
  /** profile completed */
  pc: boolean;
}

export interface JwtContext {
  secret: Uint8Array;
  issuer: string;
  audience: string;
}

export function accessTokenSecret(rawSecret: string): Uint8Array {
  return new TextEncoder().encode(rawSecret);
}

export async function signAccessToken(
  claims: AccessTokenClaims,
  context: JwtContext,
  ttlSeconds: number,
): Promise<string> {
  const nowSeconds = Math.floor(Date.now() / 1000);
  return new SignJWT({ sid: claims.sid, role: claims.role, ver: claims.ver, pc: claims.pc })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.sub)
    .setIssuer(context.issuer)
    .setAudience(context.audience)
    .setIssuedAt(nowSeconds)
    .setExpirationTime(nowSeconds + ttlSeconds)
    .sign(context.secret);
}

export type VerifiedAccessToken = AccessTokenClaims & { iat: number; exp: number };

export async function verifyAccessToken(token: string, context: JwtContext): Promise<VerifiedAccessToken> {
  const { payload } = await jwtVerify(token, context.secret, {
    issuer: context.issuer,
    audience: context.audience,
  });
  return {
    sub: payload.sub as string,
    sid: payload.sid as string,
    role: payload.role as SystemRole,
    ver: payload.ver as boolean,
    pc: payload.pc as boolean,
    iat: payload.iat as number,
    exp: payload.exp as number,
  };
}

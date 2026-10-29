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
  /** ADR-053: phiên "Ghi nhớ đăng nhập" (không có idle) — client dùng để biết có hiện cảnh báo idle hay không. Vắng = false. */
  rm?: boolean;
  /**
   * ADR-061 Q1 / Bổ sung ADR-062 mục 1: phiên khách vãng lai (`refresh_tokens.guestCheckout`) — user có thể còn PENDING
   * (`ver = false`) nhưng được vào checkout / Đơn hàng / Thư viện / API tải. Vắng = false.
   */
  gco?: boolean;
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
  return new SignJWT({ sid: claims.sid, role: claims.role, ver: claims.ver, pc: claims.pc, rm: claims.rm === true, gco: claims.gco === true })
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
    rm: payload.rm === true,
    gco: payload.gco === true,
    iat: payload.iat as number,
    exp: payload.exp as number,
  };
}

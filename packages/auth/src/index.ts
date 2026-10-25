export { hashPassword, isValidPassword, verifyPassword } from "./password";
export { normalizeEmail } from "./email";
export { isProfileComplete } from "./profile";
export type { ProfileCompletionInput } from "./profile";
export { can } from "./rbac";
export type { SystemAction, SystemRole } from "./rbac";

export {
  accessTokenSecret,
  signAccessToken,
  verifyAccessToken,
} from "./tokens/access-token";
export type { AccessTokenClaims, JwtContext, VerifiedAccessToken } from "./tokens/access-token";

export { generateOpaqueToken, hashOpaqueToken } from "@gieochu/core";

export { createRefreshToken, evaluateRefreshToken, issueRefreshToken, REFRESH_REUSE_GRACE_MS, rotateRefreshToken } from "./tokens/refresh-token";
export {
  evaluateSessionTimeouts,
  refreshCookieMaxAgeSeconds,
  resolveSessionPolicy,
  sessionExpiresAt,
} from "./session-policy";
export type { SessionPolicy, SessionPolicySettings, SessionTimeoutStatus } from "./session-policy";
export { describeDeviceKind, describeUserAgent, UNKNOWN_DEVICE_LABEL, type DeviceKind } from "./device-label";
export type { EvaluateRefreshTokenOptions, NewRefreshToken, RefreshTokenRecord, RefreshTokenStatus } from "./tokens/refresh-token";

export { createVerificationToken, evaluateVerificationToken } from "./tokens/verification-token";
export type {
  NewVerificationToken,
  VerificationTokenRecord,
  VerificationTokenStatus,
} from "./tokens/verification-token";

import { accessTokenSecret, type JwtContext } from "@gieochu/auth";
import { getEnv } from "@gieochu/config";
import { parseDurationToSeconds } from "./duration";

export function getJwtContext(): JwtContext {
  const env = getEnv();
  return {
    secret: accessTokenSecret(env.JWT_ACCESS_SECRET),
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
  };
}

export function getAccessTokenTtlSeconds(): number {
  return parseDurationToSeconds(getEnv().ACCESS_TOKEN_TTL);
}

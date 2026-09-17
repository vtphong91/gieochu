import { createHash, randomBytes } from "node:crypto";

/** Shared by refresh tokens, verification tokens, share-link tokens, etc. */
export function generateOpaqueToken(byteLength = 32): string {
  return randomBytes(byteLength).toString("base64url");
}

/** Per docs §7.2: only the SHA-256 hash of opaque tokens is ever stored. */
export function hashOpaqueToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

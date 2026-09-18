import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

/**
 * Generic AES-256-GCM string encryption — first built for payment provider
 * secrets (§7.3, M7) using `PAYMENT_ENCRYPTION_KEY`, now shared with any
 * other secret that needs the same at-rest treatment (e.g. system storage
 * credentials, M5, using their own separate key — a leaked key should only
 * ever expose one domain's secrets, not every domain's). Stored format is
 * "iv:tag:ciphertext", each base64-encoded.
 */
export function encryptSecret(plaintext: string, keyBase64: string): string {
  const key = Buffer.from(keyBase64, "base64");
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${tag.toString("base64")}:${ciphertext.toString("base64")}`;
}

export function decryptSecret(encoded: string, keyBase64: string): string {
  const parts = encoded.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted secret format");
  }
  const [ivB64, tagB64, ciphertextB64] = parts as [string, string, string];
  const key = Buffer.from(keyBase64, "base64");
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const ciphertext = Buffer.from(ciphertextB64, "base64");

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString("utf8");
}

/** UI never shows the real secret (§7.3) — only the last 4 characters. */
export function maskSecret(plaintext: string): string {
  const tail = plaintext.slice(-4);
  return `••••${tail}`;
}

import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

/**
 * ADR-045 Storage Gateway: "vé" (ticket) mã hoá thay presigned URL khi giao cho trình duyệt. Server vẫn ký
 * presigned URL nội bộ, rồi niêm phong `{ method, target (pathname+search), exp, maxBytes? }` bằng AES-256-GCM.
 * Khoá dẫn xuất HKDF-SHA256 từ `STORAGE_ENCRYPTION_KEY` với nhãn riêng — không dùng lại khoá thô đang mã hoá
 * credential storage. Ticket = base64url(iv | tag | ciphertext): chỉ gồm [A-Za-z0-9_-], an toàn trong path URL.
 */

export type StorageTicketMethod = "GET" | "PUT";

export interface StorageTicketPayload {
  method: StorageTicketMethod;
  /** Chỉ pathname + search của presigned URL nội bộ (bắt đầu bằng `/`, không chứa `://`). */
  target: string;
  /** Hạn vé, epoch giây (UTC). */
  exp: number;
  /** Chỉ cho PUT: trần `Content-Length` nginx được phép chuyển tiếp. */
  maxBytes?: number;
}

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const HKDF_INFO = "gieochu:storage-ticket:v1";
/** Presigned URL multipart (X-Amz-* + uploadId) dài vài trăm ký tự — 8KB là trần rộng, chặn input bất thường. */
const MAX_TICKET_LENGTH = 8192;
const TICKET_PATTERN = /^[A-Za-z0-9_-]+$/;

const derivedKeys = new Map<string, Buffer>();

function deriveTicketKey(keyBase64: string): Buffer {
  const cached = derivedKeys.get(keyBase64);
  if (cached) return cached;
  const raw = Buffer.from(keyBase64, "base64");
  const derived = Buffer.from(hkdfSync("sha256", raw, Buffer.alloc(0), HKDF_INFO, 32));
  derivedKeys.set(keyBase64, derived);
  return derived;
}

/**
 * `target` đi thẳng vào `proxy_pass` (nginx) và header `X-Storage-Target`: bắt buộc là path tuyệt đối, không phải
 * URL đầy đủ / protocol-relative, và chỉ gồm ký tự ASCII in được (presigned URL luôn percent-encode) — chặn
 * CR/LF hay khoảng trắng lọt vào header.
 */
function isValidTarget(target: unknown): target is string {
  return (
    typeof target === "string" &&
    target.startsWith("/") &&
    !target.startsWith("//") &&
    !target.includes("://") &&
    /^[\x21-\x7E]+$/.test(target)
  );
}

function isValidPayload(value: unknown): value is StorageTicketPayload {
  if (!value || typeof value !== "object") return false;
  const p = value as Record<string, unknown>;
  if (p.method !== "GET" && p.method !== "PUT") return false;
  if (!isValidTarget(p.target)) return false;
  if (typeof p.exp !== "number" || !Number.isSafeInteger(p.exp) || p.exp <= 0) return false;
  if (p.maxBytes !== undefined && (typeof p.maxBytes !== "number" || !Number.isSafeInteger(p.maxBytes) || p.maxBytes < 0)) {
    return false;
  }
  return true;
}

export function sealStorageTicket(payload: StorageTicketPayload, storageEncryptionKeyBase64: string): string {
  if (!isValidPayload(payload)) {
    throw new Error("Invalid storage ticket payload");
  }
  const body: StorageTicketPayload = { method: payload.method, target: payload.target, exp: payload.exp };
  if (payload.maxBytes !== undefined) body.maxBytes = payload.maxBytes;

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, deriveTicketKey(storageEncryptionKeyBase64), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(body), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString("base64url");
}

/** Trả payload khi vé hợp lệ và chưa hết hạn; mọi trường hợp khác (sai định dạng, sai tag, hết hạn) → `null`. Không ném. */
export function openStorageTicket(ticket: string, storageEncryptionKeyBase64: string, nowEpochSec: number): StorageTicketPayload | null {
  try {
    if (typeof ticket !== "string" || ticket.length === 0 || ticket.length > MAX_TICKET_LENGTH || !TICKET_PATTERN.test(ticket)) {
      return null;
    }
    const buffer = Buffer.from(ticket, "base64url");
    if (buffer.length <= IV_LENGTH + TAG_LENGTH) return null;

    const iv = buffer.subarray(0, IV_LENGTH);
    const tag = buffer.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const ciphertext = buffer.subarray(IV_LENGTH + TAG_LENGTH);
    const decipher = createDecipheriv(ALGORITHM, deriveTicketKey(storageEncryptionKeyBase64), iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");

    const parsed: unknown = JSON.parse(plaintext);
    if (!isValidPayload(parsed)) return null;
    if (nowEpochSec >= parsed.exp) return null;

    const result: StorageTicketPayload = { method: parsed.method, target: parsed.target, exp: parsed.exp };
    if (parsed.maxBytes !== undefined) result.maxBytes = parsed.maxBytes;
    return result;
  } catch {
    return null;
  }
}

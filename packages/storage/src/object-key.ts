const MAX_FILENAME_LENGTH = 150;

/**
 * §"M5": strips any path portion, control characters and anything outside
 * `[A-Za-z0-9._-]` (replaced with `_`), collapses repeats, and trims stray
 * leading/trailing dots/underscores — keeps object keys URL/S3-safe
 * regardless of what the browser's original file name contained.
 */
export function sanitizeFileName(fileName: string): string {
  const trimmed = fileName.normalize("NFC").trim();
  const lastSeparator = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\"));
  const base = lastSeparator >= 0 ? trimmed.slice(lastSeparator + 1) : trimmed;

  const cleaned = base
    .replace(/[^\w.-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^[._]+|[._]+$/g, "");

  const safe = cleaned.length > 0 ? cleaned : "file";
  return safe.slice(0, MAX_FILENAME_LENGTH);
}

/** §5.2: `tenants/{tenantId}/products/{productId}/{fileId}/{sanitizedFileName}`. */
export function buildProductFileKey(tenantId: string, productId: string, fileId: string, fileName: string): string {
  return `tenants/${tenantId}/products/${productId}/${fileId}/${sanitizeFileName(fileName)}`;
}

export type ProductObjectKeyKind = "file" | "cover";

const SAFE_ID_SEGMENT = /^[\w-]+$/;
const SAFE_FILENAME_SEGMENT = /^[\w.-]+$/;
const UUID_SEGMENT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Checks that a client-supplied object key is exactly one that
 * `buildProductFileKey(tenantId, productId, …)` could have produced for THIS
 * tenant/product — `{randomUUID}` segment for a sellable file, the literal
 * `cover` segment for a cover image — and that the file-name segment is
 * already in sanitized form (so no `..`, extra `/`, or odd characters).
 * Must run before any storage call that takes the key from the client.
 */
export function isProductObjectKeyFor(objectKey: string, tenantId: string, productId: string, kind: ProductObjectKeyKind): boolean {
  if (!SAFE_ID_SEGMENT.test(tenantId) || !SAFE_ID_SEGMENT.test(productId)) return false;

  const prefix = `tenants/${tenantId}/products/${productId}/`;
  if (!objectKey.startsWith(prefix)) return false;

  const segments = objectKey.slice(prefix.length).split("/");
  if (segments.length !== 2) return false;
  const [fileId, fileName] = segments as [string, string];

  const fileIdOk = kind === "cover" ? fileId === "cover" : UUID_SEGMENT.test(fileId);
  if (!fileIdOk) return false;

  return SAFE_FILENAME_SEGMENT.test(fileName) && sanitizeFileName(fileName) === fileName;
}

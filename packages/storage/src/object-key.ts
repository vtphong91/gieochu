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

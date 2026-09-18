/** §7.6: presigned download URLs must live ≤ 10 minutes. */
export const MAX_DOWNLOAD_PRESIGN_TTL_SECONDS = 600;

export function clampDownloadTtlSeconds(ttlSeconds: number): number {
  return Math.min(ttlSeconds, MAX_DOWNLOAD_PRESIGN_TTL_SECONDS);
}

/**
 * RFC 6266/5987: an ASCII-only `filename=` fallback plus a `filename*=UTF-8''...`
 * extended value, so Vietnamese titles (accented, ơ/ư/đ...) survive intact in
 * browsers that support it, and still degrade to something sane otherwise —
 * exact form the spec calls for (§"M9": "attachment; filename*=UTF-8''...").
 */
export function buildAttachmentDisposition(fileName: string): string {
  const asciiFallback = fileName.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "");
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

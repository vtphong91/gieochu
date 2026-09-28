/**
 * ADR-026 §3 — link tài liệu ngoài. Chỉ chấp nhận `https:` và host trong allowlist khởi đầu; mở rộng
 * allowlist phải qua ADR mới. Hàm thuần — dùng cả khi tenant nhập link (Studio) lẫn khi giao link cho
 * khách (kiểm lại lần nữa trước khi redirect, phòng allowlist bị thu hẹp sau khi link đã lưu).
 */

export const EXTERNAL_DOCUMENT_URL_MAX_LENGTH = 2048;

/** Host khớp chính xác (không nhận subdomain). */
export const EXTERNAL_DOCUMENT_EXACT_HOSTS: readonly string[] = [
  "drive.google.com",
  "docs.google.com",
  "onedrive.live.com",
  "1drv.ms",
  "dropbox.com",
  "www.dropbox.com",
];

/** Hậu tố wildcard: chỉ nhận đúng MỘT nhãn subdomain thật phía trước (vd `contoso.sharepoint.com`). */
export const EXTERNAL_DOCUMENT_WILDCARD_SUFFIXES: readonly string[] = [".sharepoint.com"];

const DNS_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

function isAllowedHost(hostname: string): boolean {
  if (EXTERNAL_DOCUMENT_EXACT_HOSTS.includes(hostname)) return true;
  for (const suffix of EXTERNAL_DOCUMENT_WILDCARD_SUFFIXES) {
    if (!hostname.endsWith(suffix)) continue;
    // `evilsharepoint.com` không kết thúc bằng ".sharepoint.com" nên không lọt tới đây;
    // phần trước hậu tố phải là đúng một nhãn DNS hợp lệ (không rỗng, không có dấu chấm).
    const label = hostname.slice(0, -suffix.length);
    if (DNS_LABEL.test(label)) return true;
  }
  return false;
}

/**
 * Trả về URL đã chuẩn hoá (`URL.href`) nếu hợp lệ, ngược lại `null`. Từ chối: không phải `https:`,
 * có userinfo (`user:pass@`), có port tường minh khác mặc định, host ngoài allowlist, quá dài.
 */
export function normalizeExternalDocumentUrl(raw: string): string | null {
  const value = raw.trim();
  if (value.length === 0 || value.length > EXTERNAL_DOCUMENT_URL_MAX_LENGTH) return null;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  if (url.protocol !== "https:") return null;
  if (url.username !== "" || url.password !== "") return null;
  if (url.port !== "") return null;
  if (!isAllowedHost(url.hostname.toLowerCase())) return null;
  if (url.href.length > EXTERNAL_DOCUMENT_URL_MAX_LENGTH) return null;
  return url.href;
}

export function isAllowedExternalDocumentUrl(raw: string): boolean {
  return normalizeExternalDocumentUrl(raw) !== null;
}

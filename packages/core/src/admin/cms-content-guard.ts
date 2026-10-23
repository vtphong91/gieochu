/**
 * ADR-050 — kiểm tra nội dung CMS dùng chung giữa editor (client) và Server Action (server):
 *  - `isSafePublicHref`: luật CỨNG cho mọi link do admin nhập (CTA trang chủ, menu header/footer). Chỉ nhận đường dẫn
 *    nội bộ `/…`, `https://…` (không phải localhost/IP nội bộ/`*.vercel.app` — brief trang chủ §7 "không giữ URL
 *    preview") và `mailto:`. Mọi scheme khác (`javascript:`, `data:`, `http:`, `vbscript:`…) bị chặn.
 *  - `findContentClaimWarnings`: cảnh báo MỀM theo brief trang chủ §8 (số liệu, đánh giá, thu nhập, "miễn phí"…) —
 *    không bao giờ chặn lưu/xuất bản, chỉ nhắc admin xác minh.
 * File không phụ thuộc gì — client component import qua `@gieochu/core/cms-content-guard`.
 */

export const SAFE_HREF_MAX_LENGTH = 500;

const EMAIL_PATTERN = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]+$/;
// Khoảng trắng / ký tự điều khiển / dấu "\" — trình duyệt chuẩn hoá "\" thành "/" nên "/\evil.com" thành "//evil.com".
const FORBIDDEN_CHARS = /[\s\u0000-\u001f\u007f\\]/;

function isBlockedHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost")) return true;
  if (host.endsWith(".vercel.app") || host === "vercel.app") return true;
  if (host === "0.0.0.0" || host === "::1" || /^127\./.test(host)) return true;
  // IP nội bộ IPv4 (10/8, 172.16/12, 192.168/16) — không phải URL người dùng thật.
  if (/^10\./.test(host) || /^192\.168\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host)) return true;
  return false;
}

/** Email thuần (không kèm `mailto:`) hợp lệ để dựng link `mailto:`. */
export function isSafeEmailAddress(value: string): boolean {
  const email = value.trim();
  return email.length > 0 && email.length <= 254 && EMAIL_PATTERN.test(email);
}

/** Đường dẫn nội bộ an toàn: bắt đầu `/`, không phải `//` (protocol-relative), không ký tự lạ. */
export function isSafeInternalPath(value: string): boolean {
  const path = value.trim();
  if (path.length === 0 || path.length > SAFE_HREF_MAX_LENGTH) return false;
  if (FORBIDDEN_CHARS.test(path)) return false;
  return path.startsWith("/") && !path.startsWith("//");
}

/** Link ngoài an toàn: `https://` hợp lệ, không kèm user:pass, không trỏ host nội bộ/preview. */
export function isSafeExternalUrl(value: string): boolean {
  const raw = value.trim();
  if (raw.length === 0 || raw.length > SAFE_HREF_MAX_LENGTH || FORBIDDEN_CHARS.test(raw)) return false;
  if (!/^https:\/\//i.test(raw)) return false;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.username || url.password || !url.hostname) return false;
  return !isBlockedHost(url.hostname);
}

/** Luật cứng cho `href` gõ tự do (CTA trang chủ): `/…`, `https://…` an toàn, hoặc `mailto:email`. */
export function isSafePublicHref(value: string): boolean {
  const href = value.trim();
  if (href.toLowerCase().startsWith("mailto:")) return isSafeEmailAddress(href.slice("mailto:".length));
  return isSafeInternalPath(href) || isSafeExternalUrl(href);
}

export const UNSAFE_HREF_MESSAGE =
  "Link không an toàn: chỉ dùng đường dẫn nội bộ bắt đầu bằng “/”, liên kết “https://” chính thức (không localhost, không *.vercel.app) hoặc “mailto:”.";

// ───────────────────────── Cảnh báo mềm brief §8 ─────────────────────────

export interface ContentClaimRule {
  id: "numbers" | "ratings" | "income" | "free" | "moneyFlow" | "absolute";
  message: string;
  patterns: RegExp[];
}

/** Mẫu so trên chữ đã bỏ dấu + chữ thường (xem `normalizeForClaims`). */
export const CONTENT_CLAIM_RULES: readonly ContentClaimRule[] = [
  {
    id: "numbers",
    message: "Có số liệu — chỉ đăng khi đã xác minh với dữ liệu thật. Muốn hiện số tự động, dùng section Số liệu nổi bật.",
    patterns: [/\d[\d.,]*\s*\+/, /\bhon\s+\d/, /\d[\d.,]*\s*(nguoi|giao vien|tai lieu|luot|hoc vien|gian hang|don hang|khach)/],
  },
  {
    id: "ratings",
    message: "Điểm đánh giá phải lấy từ dữ liệu thật.",
    patterns: [/★/, /\b\d([.,]\d)?\s*\/\s*5\b/, /\d\s*sao\b/, /danh gia cao nhat/],
  },
  {
    id: "income",
    message: "Không hứa hẹn thu nhập hoặc thời gian có đơn.",
    patterns: [/thu nhap/, /kiem (tien|them)/, /trieu\s*\/\s*thang/, /doanh thu/, /doanh so/, /co don (sau|ngay)/],
  },
  {
    id: "free",
    message: "Có tuyên bố miễn phí/không giới hạn — kiểm tra lại với Bảng giá hiện hành trước khi xuất bản.",
    patterns: [/mien phi/, /tron doi/, /khong gioi han/, /khong mat phi/, /\b0\s*(d|vnd|dong)\b/],
  },
  {
    id: "moneyFlow",
    message: "Cần chủ dự án xác nhận cách diễn đạt luồng tiền.",
    patterns: [/ve thang/, /truc tiep vao tai khoan/],
  },
  {
    id: "absolute",
    message: "Tránh cam kết tuyệt đối về bảo mật/thời gian.",
    patterns: [/an toan tuyet doi/, /bao mat 100/, /ngay lap tuc/, /tuc thi/],
  },
];

/** Chữ thường, bỏ dấu tiếng Việt (đ → d) — để mẫu khớp cả khi admin gõ không dấu. */
export function normalizeForClaims(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

/** Các nhóm tuyên bố cần xác minh có trong `texts` (mỗi nhóm tối đa 1 lần, theo thứ tự `CONTENT_CLAIM_RULES`). */
export function findContentClaimWarnings(texts: readonly string[]): ContentClaimRule[] {
  const haystack = texts.map(normalizeForClaims).join("\n");
  return CONTENT_CLAIM_RULES.filter((rule) => rule.patterns.some((pattern) => pattern.test(haystack)));
}

/** Gom mọi chuỗi trong một giá trị JSON (dùng cho quét cảnh báo theo section). */
export function collectStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) value.forEach((item) => collectStrings(item, out));
  else if (typeof value === "object" && value !== null) Object.values(value).forEach((item) => collectStrings(item, out));
  return out;
}

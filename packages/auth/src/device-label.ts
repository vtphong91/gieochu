/**
 * ADR-053 — nhãn thiết bị cho danh sách phiên ("Chrome · Windows"). Parse ở server từ User-Agent, đủ để người dùng nhận ra
 * thiết bị của mình — không nhằm định danh chính xác (UA giả được). Thứ tự kiểm tra quan trọng: trình duyệt nhân Chromium
 * đều chứa "Chrome", Chrome chứa "Safari".
 */

const BROWSERS: { label: string; pattern: RegExp }[] = [
  { label: "Cốc Cốc", pattern: /coc_coc_browser/i },
  { label: "Edge", pattern: /Edg(e|A|iOS)?\//i },
  { label: "Opera", pattern: /OPR\/|Opera/i },
  { label: "Samsung Internet", pattern: /SamsungBrowser\//i },
  { label: "Firefox", pattern: /Firefox\/|FxiOS\//i },
  { label: "Chrome", pattern: /Chrome\/|CriOS\//i },
  { label: "Safari", pattern: /Safari\//i },
];

const SYSTEMS: { label: string; pattern: RegExp }[] = [
  { label: "iPhone", pattern: /iPhone/i },
  { label: "iPad", pattern: /iPad/i },
  { label: "Android", pattern: /Android/i },
  { label: "Windows", pattern: /Windows/i },
  { label: "macOS", pattern: /Mac OS X|Macintosh/i },
  { label: "ChromeOS", pattern: /CrOS/i },
  { label: "Linux", pattern: /Linux/i },
];

export const UNKNOWN_DEVICE_LABEL = "Thiết bị không xác định";

export function describeUserAgent(userAgent: string | null | undefined): string {
  if (!userAgent) return UNKNOWN_DEVICE_LABEL;
  const browser = BROWSERS.find((b) => b.pattern.test(userAgent))?.label;
  const system = SYSTEMS.find((s) => s.pattern.test(userAgent))?.label;
  if (browser && system) return `${browser} · ${system}`;
  return browser ?? system ?? UNKNOWN_DEVICE_LABEL;
}

export type DeviceKind = "desktop" | "mobile" | "tablet";

/**
 * Loại thiết bị (chỉ để chọn icon trong danh sách phiên). Máy tính bảng Android không có token "Mobile" trong UA (quy
 * ước của Chrome/Samsung Internet trên Android); Firefox Android ghi rõ "Tablet". iPadOS 13+ ở chế độ "trang web cho máy
 * tính" giả UA macOS → không phân biệt được ở server, hiện là máy tính.
 */
export function describeDeviceKind(userAgent: string | null | undefined): DeviceKind {
  if (!userAgent) return "desktop";
  if (/iPad|Tablet|PlayBook|Silk\/|Kindle/i.test(userAgent)) return "tablet";
  if (/Android/i.test(userAgent)) return /Mobile/i.test(userAgent) ? "mobile" : "tablet";
  if (/iPhone|iPod|Windows Phone|Mobile/i.test(userAgent)) return "mobile";
  return "desktop";
}

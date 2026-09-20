/** Trộn RGB theo tỷ lệ — dùng để tính màu dẫn xuất (đậm hơn = trộn đen, nhạt hơn = trộn trắng) từ 1 màu gốc bất kỳ admin chọn. */
function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const int = parseInt(full, 16);
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
}

function rgbToHex([r, g, b]: [number, number, number]): string {
  const clamp = (c: number) => Math.max(0, Math.min(255, Math.round(c)));
  return `#${[r, g, b].map((c) => clamp(c).toString(16).padStart(2, "0")).join("")}`;
}

/** ratio = tỷ lệ giữ lại màu gốc (0..1) — phần còn lại trộn với đen. */
export function darkenHex(hex: string, ratio: number): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex([r * ratio, g * ratio, b * ratio]);
}

/** ratio = tỷ lệ giữ lại màu gốc (0..1) — phần còn lại trộn với trắng. */
export function lightenHex(hex: string, ratio: number): string {
  const [r, g, b] = hexToRgb(hex);
  const mix = (c: number) => c * ratio + 255 * (1 - ratio);
  return rgbToHex([mix(r), mix(g), mix(b)]);
}

const HEX_PATTERN = /^#[0-9A-Fa-f]{6}$/;

export function isValidHex(value: string): boolean {
  return HEX_PATTERN.test(value);
}

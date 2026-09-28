/**
 * ADR-027 §2: mô tả ngắn của sản phẩm — văn bản thuần, tối đa 300 ký tự, hiển thị trên thẻ tài liệu ở
 * storefront và đầu trang chi tiết. Module thuần (không phụ thuộc Node) để client component import được
 * hằng số qua `@gieochu/core/product-summary` (bộ đếm ký tự).
 */
export const PRODUCT_SUMMARY_MAX_LENGTH = 300;

/** Ký tự điều khiển C0/C1 + DEL; xuống dòng/tab cũng thuộc nhóm này và được đổi thành khoảng trắng. */
const CONTROL_CHARS = /[\u0000-\u001F\u007F-\u009F]/g;
/** Ký tự định hướng/zero-width hay bị lạm dụng để giả mạo hiển thị (bidi override, ZWSP, BOM...). */
const INVISIBLE_FORMAT_CHARS = /[​-‏‪-‮⁠-⁤⁦-⁩﻿]/g;

export type ProductSummaryResult = { ok: true; value: string | null } | { ok: false; message: string };

/**
 * Chuẩn hoá: NFC → bỏ ký tự điều khiển/định dạng ẩn (xuống dòng thành khoảng trắng) → gộp khoảng trắng →
 * trim. Chuỗi rỗng sau chuẩn hoá = `null` (xoá mô tả ngắn). Dài hơn 300 ký tự (tính theo code point) →
 * từ chối, không tự cắt — người dùng phải thấy được phần bị mất.
 */
export function normalizeProductSummary(input: string): ProductSummaryResult {
  const value = input
    .normalize("NFC")
    .replace(CONTROL_CHARS, " ")
    .replace(INVISIBLE_FORMAT_CHARS, "")
    .replace(/\s+/g, " ")
    .trim();
  if (value === "") return { ok: true, value: null };
  if (Array.from(value).length > PRODUCT_SUMMARY_MAX_LENGTH) {
    return { ok: false, message: `Mô tả ngắn tối đa ${PRODUCT_SUMMARY_MAX_LENGTH} ký tự.` };
  }
  return { ok: true, value };
}

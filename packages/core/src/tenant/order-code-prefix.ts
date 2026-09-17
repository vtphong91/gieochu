const MIN_LENGTH = 3;
const MAX_LENGTH = 4;
const FALLBACK = "SHOP";

/**
 * Deterministic 3–4 uppercase-letter prefix derived from the tenant name —
 * used as the order-code prefix and the SePay payment-content filter
 * (docs §"M4"). Uniqueness against other tenants is enforced by the caller
 * (DB unique constraint + retry with a random fallback), not here.
 */
export function generateOrderCodePrefix(source: string): string {
  const lettersOnly = source
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toUpperCase()
    .replace(/[^A-Z]/g, "");

  const prefix = lettersOnly.slice(0, MAX_LENGTH) || FALLBACK;
  return prefix.length >= MIN_LENGTH ? prefix : prefix.padEnd(MIN_LENGTH, "X");
}

export function isValidOrderCodePrefix(value: string): boolean {
  return /^[A-Z]{3,4}$/.test(value);
}

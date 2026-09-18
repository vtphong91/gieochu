/** Excludes 0/O and 1/I — the pair each digit/letter is most often confused with (§"M8": "6 ký tự base32 in hoa không gây nhầm lẫn"). */
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const SUFFIX_LENGTH = 6;

/** §"M8": `{orderCodePrefix}{6 ký tự base32 in hoa}`, e.g. "HAN7K2QXM". */
export function generateOrderCode(prefix: string): string {
  let suffix = "";
  for (let i = 0; i < SUFFIX_LENGTH; i += 1) {
    suffix += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return `${prefix}${suffix}`;
}

export function isValidOrderCode(code: string, prefix: string): boolean {
  const pattern = new RegExp(`^${prefix}[${ALPHABET}]{${SUFFIX_LENGTH}}$`);
  return pattern.test(code);
}

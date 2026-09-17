const HEX_COLOR_PATTERN = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function isValidHexColor(value: string): boolean {
  return HEX_COLOR_PATTERN.test(value);
}

export type SocialLinkKey = "facebook" | "youtube" | "tiktok" | "zalo" | "website";

const SOCIAL_HOST_PATTERNS: Partial<Record<SocialLinkKey, RegExp>> = {
  facebook: /(^|\.)facebook\.com$/i,
  youtube: /(^|\.)(youtube\.com|youtu\.be)$/i,
  tiktok: /(^|\.)tiktok\.com$/i,
  zalo: /(^|\.)zalo\.me$/i,
};

/** `website` accepts any http(s) URL; the other keys must match their known host. */
export function isValidSocialLink(key: SocialLinkKey, url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;

  const pattern = SOCIAL_HOST_PATTERNS[key];
  return pattern ? pattern.test(parsed.hostname) : true;
}

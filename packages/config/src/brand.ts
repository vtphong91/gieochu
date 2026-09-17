import { getEnv } from "./env";

export interface Brand {
  /** Full name, used in headers, <title>, email, footer. */
  name: string;
  /** Compact name, used for logo, favicon, PWA short_name, push notifications. */
  shortName: string;
  slogan: string;
}

/**
 * Single source of truth for brand strings (see docs/GIEOCHU_PROMPT_MVP_PHASE1.md §1.3).
 * Components must read brand strings from here instead of hard-coding them.
 */
export function getBrand(): Brand {
  const env = getEnv();
  return {
    name: env.APP_NAME,
    shortName: env.APP_SHORT_NAME,
    slogan: env.APP_SLOGAN,
  };
}

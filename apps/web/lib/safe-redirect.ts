const DEFAULT_REDIRECT = "/account/profile";

/**
 * Post-login/post-onboarding redirect target must be a same-origin relative
 * path — otherwise `?next=` becomes an open-redirect payload (e.g.
 * "https://evil.com", "//evil.com", "/\evil.com" — browsers treat a leading
 * backslash as a forward slash) that ships a freshly authenticated user to a
 * phishing site.
 */
export function toSafeRedirect(next: string | null | undefined, fallback: string = DEFAULT_REDIRECT): string {
  if (!next) return fallback;
  if (!next.startsWith("/")) return fallback;
  if (next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}

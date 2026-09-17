/** Emails are normalized lowercase+trim before storage/lookup (docs §"M1" quy tắc). */
export function normalizeEmail(rawEmail: string): string {
  return rawEmail.trim().toLowerCase();
}

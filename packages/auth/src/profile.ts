export interface ProfileCompletionInput {
  fullName?: string | null;
  phone?: string | null;
  occupation?: string | null;
  province?: string | null;
}

/**
 * Required fields per docs §"M1": fullName, phone, occupation, province.
 * Until this is true, /account/*, /studio/* and checkout redirect to
 * /account/profile?complete=1.
 */
export function isProfileComplete(profile: ProfileCompletionInput | null | undefined): boolean {
  if (!profile) return false;
  return Boolean(
    profile.fullName?.trim() && profile.phone?.trim() && profile.occupation?.trim() && profile.province?.trim(),
  );
}

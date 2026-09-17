import { redirect } from "next/navigation";
import { getCurrentUser, type CurrentUser } from "./session";

/**
 * Server Component guard matching the M1 "Chặn hoàn thiện hồ sơ" flowchart:
 * not logged in -> /login, not verified -> /verify-email, incomplete profile
 * -> /account/profile?complete=1. Used by /account/*, /studio/* and checkout
 * pages (proxy.ts does not enforce this on its own — see §4.3).
 */
export async function requireCompleteAccountAccess(nextPath: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }
  if (!user.emailVerified) {
    redirect("/verify-email?pending=1");
  }
  if (!user.profileCompleted) {
    redirect("/account/profile?complete=1");
  }
  return user;
}

/** Weaker guard for pages that only need a logged-in, verified user (e.g. the profile page itself). */
export async function requireVerifiedAccess(nextPath: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }
  if (!user.emailVerified) {
    redirect("/verify-email?pending=1");
  }
  return user;
}

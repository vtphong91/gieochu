import { notFound, redirect } from "next/navigation";
import { AppError } from "@gieochu/core";
import { getCurrentUser, type CurrentUser } from "./session";
import { requireTenantMember, type TenantContext } from "./tenant";

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

/**
 * §"M2" admin pages guard: not logged in -> /login, logged in but not
 * SYSTEM_ADMIN -> 404 (matches the LOCKED-tenant storefront's "don't reveal
 * what's here" behavior). `requireRole()` from session.ts throws AppError
 * instead — correct for API routes/Server Actions, but would surface as a
 * raw 500 if used directly in a Server Component.
 */
export async function requireAdminAccess(nextPath: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }
  if (user.role !== "SYSTEM_ADMIN") {
    notFound();
  }
  return user;
}

/**
 * §4.3 `/studio/[tenantSlug]/*` guard: not logged in -> /login; tenant
 * missing or not a member -> 404. `requireTenantMember()` (lib/tenant.ts)
 * throws AppError instead — correct for Server Actions, but needs this
 * redirect/notFound translation when called from a Server Component.
 */
export async function requireTenantMemberPage(slug: string, nextPath: string): Promise<TenantContext> {
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }
  try {
    return await requireTenantMember(slug);
  } catch (error) {
    if (error instanceof AppError) {
      notFound();
    }
    throw error;
  }
}

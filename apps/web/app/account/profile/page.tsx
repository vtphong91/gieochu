import type { Metadata } from "next";
import { requireVerifiedAccess } from "../../../lib/page-guards";
import { AVATAR_MAX_BYTES, getCachedAccountOverview } from "../../../lib/account-profile";
import { ProfileView } from "./_ui/profile-view";

export const metadata: Metadata = { title: "Hồ sơ", robots: { index: false, follow: false } };

/** ADR-041 C2 — Hồ sơ. Bố cục: `_ui/profile-view.tsx`. */
export default async function ProfilePage() {
  await requireVerifiedAccess("/account/profile");
  const overview = await getCachedAccountOverview();
  if (!overview) return null; // không xảy ra: requireVerifiedAccess đã redirect
  return <ProfileView overview={overview} avatarMaxBytes={AVATAR_MAX_BYTES} />;
}

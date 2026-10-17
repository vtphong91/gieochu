import type { Metadata } from "next";
import { getCachedAccountOverview } from "../../lib/account-profile";
import { requireVerifiedAccess } from "../../lib/page-guards";
import { AccountOverviewView } from "./_ui/overview-view";

export const metadata: Metadata = { title: "Tài khoản của bạn", robots: { index: false, follow: false } };

/** ADR-041 C1 — Tổng quan tài khoản (`/account`, thay redirect GĐ1). Bố cục: `_ui/overview-view.tsx`. */
export default async function AccountOverviewPage() {
  await requireVerifiedAccess("/account");
  const overview = await getCachedAccountOverview();
  if (!overview) return null; // không xảy ra: requireVerifiedAccess đã redirect
  return <AccountOverviewView overview={overview} />;
}

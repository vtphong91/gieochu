import { redirect } from "next/navigation";
import { getEnv } from "@gieochu/config";
import { getPrismaClient } from "@gieochu/db";
import { requireVerifiedAccess } from "../../lib/page-guards";
import { getEffectiveBrand } from "../../lib/branding";
import { StudioOnboardingForm } from "./onboarding-form";
import { PAPER } from "../(auth)/_ui/colors";

export default async function StudioIndexPage() {
  const user = await requireVerifiedAccess("/studio");

  const prisma = getPrismaClient();
  const existing = await prisma.tenant.findUnique({ where: { ownerId: user.userId } });
  if (existing) {
    redirect(`/studio/${existing.slug}`);
  }

  const brand = await getEffectiveBrand();
  const siteHost = new URL(getEnv().APP_URL).host;

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-16" style={{ background: PAPER }}>
      <StudioOnboardingForm brandName={brand.name} siteHost={siteHost} />
    </main>
  );
}

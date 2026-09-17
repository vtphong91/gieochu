import { redirect } from "next/navigation";
import { getPrismaClient } from "@gieochu/db";
import { requireCompleteAccountAccess } from "../../lib/page-guards";
import { StudioOnboardingForm } from "./onboarding-form";

export default async function StudioIndexPage() {
  const user = await requireCompleteAccountAccess("/studio");

  const prisma = getPrismaClient();
  const existing = await prisma.tenant.findUnique({ where: { ownerId: user.userId } });
  if (existing) {
    redirect(`/studio/${existing.slug}`);
  }

  return <StudioOnboardingForm />;
}

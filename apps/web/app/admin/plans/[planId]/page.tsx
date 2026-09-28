import { notFound } from "next/navigation";
import { getPrismaClient } from "@gieochu/db";
import { requireAdminAccess } from "../../../../lib/page-guards";
import { AdminPageHeader, SettingsGrid } from "../../_ui/kit";
import { EditPlanForm } from "./edit-plan-form";
import type { PlanFormValues } from "../plan-form";

export default async function AdminEditPlanPage({ params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params;
  await requireAdminAccess(`/admin/plans/${planId}`);

  const prisma = getPrismaClient();
  const plan = await prisma.plan.findUnique({ where: { id: planId } });
  if (!plan) notFound();

  const initial: PlanFormValues = {
    code: plan.code,
    name: plan.name,
    priceVnd: plan.priceVnd,
    interval: plan.interval,
    intervalCount: plan.intervalCount,
    maxProducts: plan.maxProducts,
    storageMb: plan.storageMb,
    maxFileMb: plan.maxFileMb,
    imageStorageMb: plan.imageStorageMb,
    isFree: plan.isFree,
    features: (plan.features as Record<string, boolean>) ?? {},
  };

  return (
    <main className="px-5 py-8 lg:px-8">
      <AdminPageHeader title={`Sửa gói — ${plan.name}`} />
      <SettingsGrid>
        <EditPlanForm planId={planId} initial={initial} />
      </SettingsGrid>
    </main>
  );
}

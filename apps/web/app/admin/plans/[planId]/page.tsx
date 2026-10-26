import { notFound } from "next/navigation";
import { getPrismaClient } from "@gieochu/db";
import { requireAdminAccess } from "../../../../lib/page-guards";
import { AdminPageHeader } from "../../_ui/kit";
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
    // Wrapper <div>: layout admin đã có <main>.
    <div className="px-5 py-8 lg:px-8">
      <AdminPageHeader title={`Sửa gói — ${plan.name}`} />
      {/* Full width theo khung app (quy tắc 2026-10-25) — thay SettingsGrid 2 cột. */}
      <div className="mt-6">
        <EditPlanForm planId={planId} initial={initial} />
      </div>
    </div>
  );
}

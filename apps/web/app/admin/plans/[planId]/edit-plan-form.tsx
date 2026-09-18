"use client";

import { updatePlanAction } from "../actions";
import { PlanForm, type PlanFormValues } from "../plan-form";

export function EditPlanForm({ planId, initial }: { planId: string; initial: PlanFormValues }) {
  const action = updatePlanAction.bind(null, planId);
  return <PlanForm action={action} initial={initial} submitLabel="Lưu thay đổi" />;
}

"use client";

import { createPlanAction } from "./actions";
import { PlanForm, type PlanFormValues } from "./plan-form";

const EMPTY: PlanFormValues = {
  code: "",
  name: "",
  priceVnd: 0,
  interval: "MONTH",
  intervalCount: 1,
  maxProducts: 0,
  storageMb: 0,
  maxFileMb: 0,
  imageStorageMb: 100,
  isFree: false,
  features: {},
};

export function CreatePlanForm() {
  return <PlanForm action={createPlanAction} initial={EMPTY} submitLabel="Tạo gói mới" expandAll />;
}

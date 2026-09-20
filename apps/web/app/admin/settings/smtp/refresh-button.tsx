"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { GhostButton } from "../../_ui/kit";

export function RefreshButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <GhostButton disabled={isPending} onClick={() => startTransition(() => router.refresh())}>
      {isPending ? "Đang làm mới..." : "Làm mới"}
    </GhostButton>
  );
}

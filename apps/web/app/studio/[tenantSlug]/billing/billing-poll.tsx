"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** §"M3" sequence diagram: "Polling trạng thái mỗi 3 giây" while a PENDING invoice is showing. */
export function BillingPoll({ active }: { active: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => router.refresh(), 3000);
    return () => clearInterval(id);
  }, [active, router]);

  return null;
}

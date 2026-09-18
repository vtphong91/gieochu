"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** §"M8" sequence diagram: "Polling trạng thái mỗi 3 giây" while the order is still PENDING — same pattern as billing's BillingPoll (M3). */
export function CheckoutPoll({ active }: { active: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => router.refresh(), 3000);
    return () => clearInterval(id);
  }, [active, router]);

  return null;
}

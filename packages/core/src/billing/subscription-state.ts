import { AppError } from "../errors";

/** Mirrors Prisma's SubscriptionStatus, minus PAST_DUE (never assigned by M3 — see schema.prisma). */
export type SubscriptionStatus = "TRIALING" | "ACTIVE" | "GRACE" | "EXPIRED" | "CANCELED";

export type SubscriptionEvent = "INVOICE_PAID" | "PERIOD_ENDED" | "GRACE_ENDED" | "OWNER_CANCELED";

/** §"M3" state diagram, encoded as an explicit transition table. */
const TRANSITIONS: Record<SubscriptionStatus, Partial<Record<SubscriptionEvent, SubscriptionStatus>>> = {
  TRIALING: { INVOICE_PAID: "ACTIVE", PERIOD_ENDED: "GRACE" },
  ACTIVE: { INVOICE_PAID: "ACTIVE", PERIOD_ENDED: "GRACE", OWNER_CANCELED: "CANCELED" },
  GRACE: { INVOICE_PAID: "ACTIVE", GRACE_ENDED: "EXPIRED" },
  EXPIRED: { INVOICE_PAID: "ACTIVE" },
  CANCELED: { PERIOD_ENDED: "EXPIRED" },
};

/** Throws (not a decision object) — an out-of-band transition is a bug, not a user-facing outcome. */
export function transitionSubscriptionStatus(current: SubscriptionStatus, event: SubscriptionEvent): SubscriptionStatus {
  const next = TRANSITIONS[current]?.[event];
  if (!next) {
    throw new AppError({
      code: "INVALID_SUBSCRIPTION_TRANSITION",
      message: `Không thể chuyển subscription từ ${current} với sự kiện ${event}.`,
      httpStatus: 409,
      expose: false,
    });
  }
  return next;
}

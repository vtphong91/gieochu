export type TenantStatus = "ACTIVE" | "READ_ONLY" | "LOCKED";
export type StorefrontViewer = "guest" | "owner";

export type StorefrontAccessDecision =
  /** 404 to guests; LOCKED tenants are invisible to the public. */
  | "NOT_FOUND"
  /** Owner sees the storefront with a "tenant locked" notice. */
  | "LOCKED_NOTICE"
  /** Renders, but purchase actions are hidden behind a banner. */
  | "READ_ONLY"
  | "ACTIVE";

/** §4.4 storefront render flowchart, factored out as a pure decision function. */
export function resolveStorefrontAccess(status: TenantStatus, viewer: StorefrontViewer): StorefrontAccessDecision {
  if (status === "LOCKED") {
    return viewer === "owner" ? "LOCKED_NOTICE" : "NOT_FOUND";
  }
  if (status === "READ_ONLY") {
    return "READ_ONLY";
  }
  return "ACTIVE";
}

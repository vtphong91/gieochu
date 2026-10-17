export type TenantStatus = "ACTIVE" | "READ_ONLY" | "LOCKED";
export type StorefrontViewer = "guest" | "owner";

export type StorefrontAccessDecision =
  /** 404 to guests; LOCKED tenants are invisible to the public. */
  | "NOT_FOUND"
  /** Owner sees the storefront with a "tenant locked" notice. */
  | "LOCKED_NOTICE"
  /**
   * ADR-040: guest of a READ_ONLY tenant sees only a "tạm ngưng hoạt động" notice — no products/posts/reviews
   * (the page must not even query them); product/post detail pages 404.
   */
  | "SUSPENDED_NOTICE"
  /** ADR-040: owner of a READ_ONLY tenant still sees the storefront, with a status notice. */
  | "READ_ONLY"
  | "ACTIVE";

/** §4.4 storefront render flowchart (ADR-040 for READ_ONLY), factored out as a pure decision function. */
export function resolveStorefrontAccess(status: TenantStatus, viewer: StorefrontViewer): StorefrontAccessDecision {
  if (status === "LOCKED") {
    return viewer === "owner" ? "LOCKED_NOTICE" : "NOT_FOUND";
  }
  if (status === "READ_ONLY") {
    return viewer === "owner" ? "READ_ONLY" : "SUSPENDED_NOTICE";
  }
  return "ACTIVE";
}

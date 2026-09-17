export type SystemRole = "USER" | "SYSTEM_ADMIN";

/**
 * System-level actions gated by SystemRole. Tenant-level actions (OWNER/STAFF)
 * are added in M4 with their own matrix (`requireTenantMember`), not here.
 */
export type SystemAction = "system:manage_users" | "system:manage_plans" | "system:view_admin_dashboard";

const SYSTEM_ADMIN_ACTIONS: ReadonlySet<SystemAction> = new Set([
  "system:manage_users",
  "system:manage_plans",
  "system:view_admin_dashboard",
]);

export function can(role: SystemRole, action: SystemAction): boolean {
  if (role === "SYSTEM_ADMIN") return SYSTEM_ADMIN_ACTIONS.has(action);
  return false;
}

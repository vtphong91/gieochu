export type TenantMemberRole = "OWNER" | "STAFF";

/**
 * MVP only ever creates OWNER members (§2.2: staff with fine-grained
 * permissions is out of scope, schema is ready for later). `role` is `null`
 * when the user isn't a member of the tenant at all.
 */
export function canManageTenant(role: TenantMemberRole | null): boolean {
  return role === "OWNER";
}

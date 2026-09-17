import { can } from "./rbac";

describe("M1 RBAC matrix", () => {
  it("only SYSTEM_ADMIN passes system-level actions", () => {
    expect(can("SYSTEM_ADMIN", "system:manage_users")).toBe(true);
    expect(can("SYSTEM_ADMIN", "system:view_admin_dashboard")).toBe(true);
    expect(can("USER", "system:manage_users")).toBe(false);
    expect(can("USER", "system:view_admin_dashboard")).toBe(false);
  });
});

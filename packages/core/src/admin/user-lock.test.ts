import { decideLockUser } from "./user-lock";

describe("M2 lock-user decision", () => {
  it("rejects locking oneself or the super admin, otherwise requires revoking sessions", () => {
    expect(decideLockUser("admin_1", { id: "admin_1", isSuperAdmin: false })).toEqual({
      allowed: false,
      reason: "SELF",
      revokeSessions: false,
    });
    expect(decideLockUser("admin_1", { id: "admin_2", isSuperAdmin: true })).toEqual({
      allowed: false,
      reason: "SUPER_ADMIN",
      revokeSessions: false,
    });
    expect(decideLockUser("admin_1", { id: "user_5", isSuperAdmin: false })).toEqual({
      allowed: true,
      revokeSessions: true,
    });
  });
});

import type { AdminUserRole, AdminUserStatus } from "../../../../lib/admin-user-detail";

/**
 * ADR-073 — nhãn tiếng Việt + tông badge dùng chung cho danh sách `/admin/users` và trang chi tiết `/admin/users/[userId]`.
 * Badge luôn hiện CHỮ (không truyền nghĩa chỉ bằng màu). `import type` bị xoá khi biên dịch → không kéo code server vào bundle client.
 */
type Tone = "success" | "warning" | "danger" | "neutral" | "info";

export const USER_STATUS_LABEL: Record<AdminUserStatus, string> = {
  PENDING: "Chờ kích hoạt",
  ACTIVE: "Đang hoạt động",
  LOCKED: "Đã khoá",
};

export const USER_STATUS_TONE: Record<AdminUserStatus, Tone> = {
  PENDING: "warning",
  ACTIVE: "success",
  LOCKED: "danger",
};

export const USER_ROLE_LABEL: Record<AdminUserRole, string> = {
  SUPER_ADMIN: "Siêu quản trị",
  ADMIN: "Quản trị viên",
  OWNER: "Chủ gian hàng",
  USER: "Người dùng",
};

export const USER_ROLE_TONE: Record<AdminUserRole, Tone> = {
  SUPER_ADMIN: "info",
  ADMIN: "info",
  OWNER: "success",
  USER: "neutral",
};

/** Cùng quy tắc với `getAdminUserDetail` — để danh sách (không đi qua loader chi tiết) hiện đúng nhãn vai trò. */
export function resolveUserRole(user: { isSuperAdmin: boolean; systemRole: "SYSTEM_ADMIN" | "USER"; hasOwnedTenant: boolean }): AdminUserRole {
  if (user.isSuperAdmin) return "SUPER_ADMIN";
  if (user.systemRole === "SYSTEM_ADMIN") return "ADMIN";
  return user.hasOwnedTenant ? "OWNER" : "USER";
}

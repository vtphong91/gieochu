import type { SystemRole } from "@gieochu/auth";
import { getPrismaClient } from "@gieochu/db";
import { hasSystemPermission } from "./permissions";

/**
 * ADR-022 — nơi duy nhất quyết định "user này nên vào module nào" sau đăng
 * nhập, thay vì phân nhánh role rải rác ở login page. Luôn dựng đường dẫn
 * Studio từ `tenant.slug`, tuyệt đối không dùng `user.userId` trong URL.
 * Chưa resolve cho STAFF — hiện chưa có luồng nào tạo row TenantMember STAFF.
 */
export async function resolveLandingPath(user: { userId: string; role: SystemRole }): Promise<string> {
  if (await hasSystemPermission(user.role, "system:view_admin_dashboard")) {
    return "/admin";
  }

  const tenant = await getPrismaClient().tenant.findUnique({ where: { ownerId: user.userId } });
  if (tenant) {
    return `/studio/${tenant.slug}`;
  }

  return "/";
}

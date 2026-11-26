import { notFound, redirect } from "next/navigation";
import { AppError } from "@gieochu/core";
import { getCurrentUser, getSessionState, type CurrentUser } from "./session";
import { requireTenantMember, type TenantContext } from "./tenant";

/**
 * ADR-073 mục 9 — trang nhạy cảm: tài khoản bị khoá / phiên đã thu hồi → về /login (access token còn hạn không đủ). Trang
 * đăng nhập không tự chuyển hướng người đã có cookie nên không lặp; lần refresh kế tiếp cũng bị từ chối và xoá cookie.
 */
async function redirectUnlessSessionActive(user: CurrentUser, nextPath: string): Promise<void> {
  if ((await getSessionState(user)) !== "ACTIVE") {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }
}

/**
 * Server Component guard cho /account/*, /studio/* và checkout: chưa đăng
 * nhập -> /login, chưa xác minh email -> /verify-email. KHÔNG còn chặn theo
 * hồ sơ đầy đủ hay chưa — dùng được ngay sau khi xác minh email, không phải
 * điền hồ sơ trước (đã bỏ cổng "Chặn hoàn thiện hồ sơ" của M1 theo yêu cầu
 * đơn giản hoá luồng đăng ký/đăng nhập). proxy.ts không tự gác việc này —
 * xem §4.3.
 */
export async function requireVerifiedAccess(nextPath: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }
  if (!user.emailVerified) {
    redirect("/verify-email?pending=1");
  }
  // ADR-073 mục 9: /account, /account/profile, /account/security, /studio — khoá/thu hồi phiên có hiệu lực ngay.
  await redirectUnlessSessionActive(user, nextPath);
  return user;
}

/**
 * ADR-061 Q1 — bản trang (Server Component) của `requireCheckoutUser`: chưa đăng nhập → /login; đăng nhập nhưng chưa xác
 * minh VÀ không phải phiên khách vãng lai → /verify-email. CHỈ dùng cho checkout, /account/orders, /account/library.
 */
export async function requireCheckoutAccess(nextPath: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }
  if (!user.emailVerified && !user.guestCheckout) {
    redirect("/verify-email?pending=1");
  }
  await redirectUnlessSessionActive(user, nextPath);
  return user;
}

/**
 * §"M2" admin pages guard: not logged in -> /login, logged in but not
 * SYSTEM_ADMIN -> 404 (matches the LOCKED-tenant storefront's "don't reveal
 * what's here" behavior). `requireRole()` from session.ts throws AppError
 * instead — correct for API routes/Server Actions, but would surface as a
 * raw 500 if used directly in a Server Component.
 */
export async function requireAdminAccess(nextPath: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }
  if (user.role !== "SYSTEM_ADMIN") {
    notFound();
  }
  await redirectUnlessSessionActive(user, nextPath);
  return user;
}

/**
 * §4.3 `/studio/[tenantSlug]/*` guard: not logged in -> /login; tenant
 * missing or not a member -> 404. `requireTenantMember()` (lib/tenant.ts)
 * throws AppError instead — correct for Server Actions, but needs this
 * redirect/notFound translation when called from a Server Component.
 */
export async function requireTenantMemberPage(slug: string, nextPath: string): Promise<TenantContext> {
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }
  // Kiểm trước requireTenantMember: phiên hết hiệu lực → /login (không biến thành 404). Kết quả cache theo request nên
  // requireTenantMember kiểm lại không tốn thêm truy vấn.
  await redirectUnlessSessionActive(user, nextPath);
  try {
    return await requireTenantMember(slug);
  } catch (error) {
    if (error instanceof AppError) {
      notFound();
    }
    throw error;
  }
}

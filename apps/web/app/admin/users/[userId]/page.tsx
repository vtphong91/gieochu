import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { brandColors } from "@gieochu/config/theme";
import { requireAdminAccess } from "../../../../lib/page-guards";
import { getAdminUserDetail } from "../../../../lib/admin-user-detail";
import { Badge, EmptyState, Notice } from "../../_ui/kit";
import { IconChevronLeft, IconClock, IconLock, IconShield } from "../../_ui/icons";
import { formatAdminDate, formatAdminDateTime } from "../../_ui/billing-labels";
import { USER_ROLE_LABEL, USER_ROLE_TONE, USER_STATUS_LABEL, USER_STATUS_TONE } from "../_ui/user-labels";
import { UserDetailActions } from "../_ui/user-detail-actions";
import { UserAuditLog } from "./_ui/audit-log";
import { LegalSection, OwnedTenantSection, ProfileSection, SecuritySection } from "./_ui/sections";
// Mảnh trình bày dùng chung với trang chi tiết gian hàng.
import { SectionHeading } from "../../tenants/[tenantId]/_ui/parts";

export const metadata: Metadata = { title: "Chi tiết người dùng" };

const LIST_PATH = "/admin/users";
const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-primary)]";

/**
 * ADR-073 — chi tiết một người dùng (System Admin): hồ sơ & tài khoản (số điện thoại che, có nút hiện đầy đủ), bảo mật & phiên đăng
 * nhập (IP che), gian hàng sở hữu, điều khoản đã đồng ý và nhật ký; thao tác: khoá/mở khoá (có lý do, gửi email), đăng xuất mọi thiết bị,
 * yêu cầu đặt lại mật khẩu, gửi lại email kích hoạt — chỉ hiện khi cờ `detail.actions` cho phép. Chỉ dữ liệu L1 (§7.9). Loader tự kiểm
 * SYSTEM_ADMIN; id sai/không có người dùng → 404.
 */
export default async function AdminUserDetailPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  await requireAdminAccess(`${LIST_PATH}/${userId}`);
  const detail = await getAdminUserDetail(userId);
  if (!detail) notFound();

  const displayName = detail.fullName ?? detail.email;
  const locked = detail.status === "LOCKED";
  // Lý do khoá gần nhất = dòng USER_LOCKED mới nhất trong nhật ký (đã sắp mới nhất trước; chỉ có trong 50 dòng gần nhất).
  const lastLock = locked ? detail.audit.entries.find((entry) => entry.kind === "USER_LOCKED") : undefined;
  const { actions } = detail;
  const hasAnyAction =
    actions.canLock || actions.canUnlock || actions.canRevokeSessions || actions.canResendVerification || actions.canRequestPasswordReset;

  // Wrapper <div>: layout admin đã có <main>.
  return (
    <div className="px-5 py-8 lg:px-8">
      <nav aria-label="Đường dẫn trang">
        <Link
          href={LIST_PATH}
          className={`-ml-2 inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-semibold underline-offset-2 hover:underline lg:min-h-9 ${FOCUS}`}
          style={{ color: brandColors.primary }}
        >
          <IconChevronLeft className="h-4 w-4" />
          Người dùng
        </Link>
      </nav>

      <div className="mt-1 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold [overflow-wrap:anywhere]" style={{ color: brandColors.ink }}>
              {displayName}
            </h1>
            <Badge tone={USER_STATUS_TONE[detail.status]}>{USER_STATUS_LABEL[detail.status]}</Badge>
            <Badge tone={USER_ROLE_TONE[detail.role]}>{USER_ROLE_LABEL[detail.role]}</Badge>
            {detail.isSelf ? <Badge tone="neutral">Tài khoản của bạn</Badge> : null}
          </div>
          <p className="mt-1.5 text-sm text-gray-500">
            {detail.fullName ? (
              <>
                <span className="[overflow-wrap:anywhere]">{detail.email}</span>
                <span aria-hidden="true"> · </span>
                <span className="sr-only">, </span>
              </>
            ) : null}
            Tạo ngày <time dateTime={detail.createdAt.toISOString()} className="tabular-nums">{formatAdminDate(detail.createdAt)}</time>
          </p>
        </div>
        {hasAnyAction ? (
          <div className="lg:max-w-[48rem] lg:shrink-0">
            <UserDetailActions
              user={{ id: detail.id, name: displayName, email: detail.email, status: detail.status, ownedTenantName: detail.ownedTenant?.name ?? null }}
              actions={actions}
            />
          </div>
        ) : null}
      </div>

      <div className="mt-6 space-y-8">
        {locked ? (
          <Notice tone="warning" icon={<IconLock className="h-4 w-4" />}>
            <p className="font-semibold">Tài khoản đang bị khoá.</p>
            <p className="mt-1">
              Người dùng không đăng nhập được.
              {detail.ownedTenant ? " Gian hàng của họ vẫn hoạt động bình thường (khách vẫn xem và mua được)." : ""}
            </p>
            <p className="mt-1 whitespace-pre-line [overflow-wrap:anywhere]">
              <span className="font-semibold">Lý do gần nhất: </span>
              {lastLock?.reason ?? "Không có lý do được ghi lại."}
            </p>
            {lastLock ? (
              <p className="mt-1 text-xs tabular-nums">
                Khoá lúc <time dateTime={lastLock.createdAt.toISOString()}>{formatAdminDateTime(lastLock.createdAt)}</time>
              </p>
            ) : null}
          </Notice>
        ) : null}
        {actions.lockBlocked ? (
          <Notice tone="info" icon={<IconShield className="h-4 w-4" />}>
            <p>
              {actions.lockBlocked === "SELF"
                ? "Đây là tài khoản của bạn nên không thể khoá, đăng xuất mọi thiết bị hay yêu cầu đặt lại mật khẩu tại đây. "
                : "Tài khoản siêu quản trị được bảo vệ nên không thể khoá, đăng xuất mọi thiết bị hay yêu cầu đặt lại mật khẩu từ trang này. "}
              {actions.lockBlocked === "SELF" ? (
                <Link href="/account/security" className={`font-semibold underline underline-offset-2 ${FOCUS}`}>
                  Mở trang bảo mật tài khoản
                </Link>
              ) : null}
            </p>
          </Notice>
        ) : null}

        <div className="grid items-start gap-8 xl:grid-cols-2">
          <ProfileSection detail={detail} />
          <div className="space-y-8">
            <OwnedTenantSection tenant={detail.ownedTenant} />
            <LegalSection legal={detail.legal} />
          </div>
        </div>

        <SecuritySection security={detail.security} />

        <section aria-labelledby="user-audit-title">
          <SectionHeading
            id="user-audit-title"
            icon={<IconClock className="h-4 w-4" />}
            title="Nhật ký"
            description="Sự kiện bảo mật của người dùng và thao tác quản trị trên tài khoản (khoá/mở khoá kèm lý do, đăng xuất, đặt lại mật khẩu, xem số điện thoại…), mới nhất trước. Giờ Việt Nam."
          />
          {detail.audit.entries.length === 0 ? (
            <EmptyState icon={<IconClock className="h-6 w-6" />} title="Chưa có sự kiện nào" description="Sự kiện bảo mật và thao tác quản trị trên tài khoản sẽ hiện ở đây." />
          ) : (
            <UserAuditLog entries={detail.audit.entries} total={detail.audit.total} />
          )}
        </section>
      </div>
    </div>
  );
}

import type { ReactNode } from "react";
import { brandColors } from "@gieochu/config/theme";
import type { AdminUserDetail } from "../../../../../lib/admin-user-detail";
import { Badge } from "../../../_ui/kit";
import { IconDoc, IconMonitor, IconShield, IconStore, IconUsers } from "../../../_ui/icons";
import { formatAdminDateTime } from "../../../_ui/billing-labels";
// Mảnh trình bày dùng chung với trang chi tiết gian hàng (cùng ngôn ngữ thị giác — thẻ bo góc, tiêu đề phần có icon, `<dl>` nhãn → giá trị).
import { CARD, CompactEmpty, Dash, InfoGrid, LINE, SectionHeading, StatTile, TextLink, type InfoItem } from "../../../_ui/detail-kit";
import { TENANT_STATUS_LABEL, TENANT_STATUS_TONE } from "../../../tenants/_ui/tenant-labels";
import { PhoneField } from "../../_ui/phone-field";

/*
 * ADR-073 — các phần của trang chi tiết người dùng. Server Component thuần (trừ `PhoneField` — client, gọi action hiện số đầy đủ).
 * §7.9: chỉ dữ liệu L1 — không có đơn hàng, thư viện, khách hàng của gian hàng. Số điện thoại và IP đã được che ở server.
 */

const numberFormat = new Intl.NumberFormat("vi-VN");
const ICON = "h-4 w-4";

function DateTime({ value }: { value: Date }) {
  return (
    <time dateTime={value.toISOString()} className="tabular-nums">
      {formatAdminDateTime(value)}
    </time>
  );
}

// ───────────────────────── Hồ sơ & tài khoản ─────────────────────────

export function ProfileSection({ detail }: { detail: AdminUserDetail }) {
  const { profile } = detail;
  const items: InfoItem[] = [
    { label: "Họ tên", value: detail.fullName ? <span className="font-semibold">{detail.fullName}</span> : <Dash srText="Chưa có hồ sơ" /> },
    {
      label: "Email",
      value: (
        <>
          <span className="block">{detail.email}</span>
          {detail.emailVerifiedAt ? (
            <span className="mt-0.5 block text-xs text-gray-600">
              Đã xác minh lúc <DateTime value={detail.emailVerifiedAt} />
            </span>
          ) : (
            <span className="mt-1 block">
              <Badge tone="warning">Chưa xác minh</Badge>
            </span>
          )}
        </>
      ),
    },
    {
      label: "Số điện thoại",
      value: profile ? <PhoneField userId={detail.id} masked={profile.phoneMasked} /> : <Dash srText="Chưa có hồ sơ" />,
    },
    { label: "Tỉnh/thành", value: profile?.province ?? <Dash srText="Chưa cập nhật" /> },
    { label: "Nghề nghiệp", value: profile?.occupation ?? <Dash srText="Chưa cập nhật" /> },
    { label: "Ngày tạo tài khoản", value: <DateTime value={detail.createdAt} /> },
    {
      label: "Hoàn thiện hồ sơ",
      value: detail.profileCompletedAt ? <DateTime value={detail.profileCompletedAt} /> : <span className="text-gray-600">Chưa hoàn thiện</span>,
    },
    {
      label: "Đồng ý thu thập dữ liệu",
      value: profile?.consentAt ? <DateTime value={profile.consentAt} /> : <Dash srText="Chưa ghi nhận" />,
    },
  ];
  return (
    <section aria-labelledby="user-profile-title">
      <SectionHeading id="user-profile-title" icon={<IconUsers className={ICON} />} title="Hồ sơ & tài khoản" />
      <div className={CARD} style={{ borderColor: LINE }}>
        <InfoGrid items={items} />
      </div>
    </section>
  );
}

// ───────────────────────── Bảo mật & phiên đăng nhập ─────────────────────────

export function SecuritySection({ security }: { security: AdminUserDetail["security"] }) {
  const { sessions, activeSessionCount } = security;
  return (
    <section aria-labelledby="user-security-title">
      <SectionHeading
        id="user-security-title"
        icon={<IconShield className={ICON} />}
        title="Bảo mật & phiên đăng nhập"
        description="Địa chỉ IP chỉ hiện một phần. Giờ Việt Nam."
      />
      <div className={`${CARD} space-y-5`} style={{ borderColor: LINE }}>
        <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile label="Đăng nhập gần nhất" value={security.lastLoginAt ? <DateTime value={security.lastLoginAt} /> : <span className="text-base text-gray-600">Chưa từng</span>} />
          <StatTile label="Sai mật khẩu liên tiếp" value={numberFormat.format(security.failedLoginAttempts)} />
          <StatTile
            label="Bắt buộc đặt lại mật khẩu"
            value={<span className={security.passwordResetRequired ? "" : "text-base font-medium text-gray-600"}>{security.passwordResetRequired ? "Đang bắt buộc" : "Không"}</span>}
          />
          <StatTile label="Phiên đang hoạt động" value={numberFormat.format(activeSessionCount)} />
        </dl>

        <div>
          <h3 className="font-[family-name:var(--font-heading)] text-sm font-semibold" style={{ color: brandColors.ink }}>
            Phiên còn hiệu lực
          </h3>
          {sessions.length === 0 ? (
            <div className="mt-2">
              <CompactEmpty>Người dùng không có phiên đăng nhập nào đang hoạt động.</CompactEmpty>
            </div>
          ) : (
            <>
              <ul className="mt-1 divide-y divide-gray-100">
                {sessions.map((session, index) => (
                  <li key={`${session.startedAt.toISOString()}-${index}`} className="py-4">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                      <span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md" style={{ background: brandColors.surface, color: brandColors.primary }}>
                        <IconMonitor className={ICON} />
                      </span>
                      <p className="min-w-0 text-sm font-semibold [overflow-wrap:anywhere]" style={{ color: brandColors.ink }}>
                        {session.deviceLabel ?? "Thiết bị không xác định"}
                      </p>
                      {session.rememberMe ? <Badge tone="neutral">Ghi nhớ đăng nhập</Badge> : null}
                    </div>
                    <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
                      <SessionField label="Địa chỉ IP">{session.ipMasked ? <span className="font-mono tabular-nums">{session.ipMasked}</span> : <Dash srText="Không rõ" />}</SessionField>
                      <SessionField label="Bắt đầu lúc">
                        <DateTime value={session.startedAt} />
                      </SessionField>
                      <SessionField label="Hoạt động gần nhất">
                        <DateTime value={session.lastActiveAt} />
                      </SessionField>
                      <SessionField label="Hết hạn lúc">
                        <DateTime value={session.expiresAt} />
                      </SessionField>
                    </dl>
                  </li>
                ))}
              </ul>
              {activeSessionCount > sessions.length ? (
                <p className="mt-2 text-xs text-gray-600 tabular-nums">
                  Hiển thị {numberFormat.format(sessions.length)} / {numberFormat.format(activeSessionCount)} phiên hoạt động gần nhất.
                </p>
              ) : null}
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function SessionField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-gray-600">{label}</dt>
      <dd className="mt-0.5 [overflow-wrap:anywhere]" style={{ color: brandColors.ink }}>
        {children}
      </dd>
    </div>
  );
}

// ───────────────────────── Gian hàng sở hữu ─────────────────────────

export function OwnedTenantSection({ tenant }: { tenant: AdminUserDetail["ownedTenant"] }) {
  const statusLabels: Record<string, string> = TENANT_STATUS_LABEL;
  const statusTones: Record<string, "success" | "warning" | "danger" | "neutral" | "info"> = TENANT_STATUS_TONE;
  return (
    <section aria-labelledby="user-tenant-title">
      <SectionHeading id="user-tenant-title" icon={<IconStore className={ICON} />} title="Gian hàng sở hữu" />
      <div className={CARD} style={{ borderColor: LINE }}>
        {tenant === null ? (
          <CompactEmpty>Người dùng này không sở hữu gian hàng nào.</CompactEmpty>
        ) : (
          <>
            <InfoGrid
              items={[
                { label: "Tên gian hàng", value: <span className="font-semibold">{tenant.name}</span> },
                { label: "Đường dẫn", value: <span>/{tenant.slug}</span> },
                { label: "Trạng thái", value: <Badge tone={statusTones[tenant.status] ?? "neutral"}>{statusLabels[tenant.status] ?? tenant.status}</Badge> },
                { label: "Gói dịch vụ", value: tenant.planName ?? <Dash srText="Chưa có gói" /> },
              ]}
            />
            <div className="mt-3 border-t pt-2" style={{ borderColor: LINE }}>
              <TextLink href={`/admin/tenants/${tenant.id}`}>Xem chi tiết gian hàng</TextLink>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

// ───────────────────────── Điều khoản đã đồng ý ─────────────────────────

export function LegalSection({ legal }: { legal: AdminUserDetail["legal"] }) {
  return (
    <section aria-labelledby="user-legal-title">
      <SectionHeading id="user-legal-title" icon={<IconDoc className={ICON} />} title="Điều khoản đã đồng ý" description="Mới nhất trước. Giờ Việt Nam." />
      <div className={CARD} style={{ borderColor: LINE }}>
        {legal.acceptances.length === 0 ? (
          <CompactEmpty>Người dùng chưa đồng ý văn bản điều khoản nào.</CompactEmpty>
        ) : (
          <>
            <ul className="divide-y divide-gray-100">
              {legal.acceptances.map((item, index) => (
                <li key={`${item.documentTitle}-${item.acceptedAt.toISOString()}-${index}`} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                  <div className="min-w-0 text-sm">
                    <p className="font-medium [overflow-wrap:anywhere]" style={{ color: brandColors.ink }}>
                      {item.documentTitle}
                    </p>
                    <p className="text-xs text-gray-600">{item.versionLabel}</p>
                  </div>
                  <p className="shrink-0 text-xs text-gray-600">
                    <span className="sr-only">Đồng ý lúc </span>
                    <DateTime value={item.acceptedAt} />
                  </p>
                </li>
              ))}
            </ul>
            {legal.total > legal.acceptances.length ? (
              <p className="mt-3 text-xs text-gray-600 tabular-nums">
                Hiển thị {numberFormat.format(legal.acceptances.length)} / {numberFormat.format(legal.total)} lần đồng ý mới nhất.
              </p>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}

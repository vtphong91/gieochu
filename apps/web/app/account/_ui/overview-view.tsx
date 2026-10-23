import type { AccountOverview } from "../../../lib/account-profile";
import Link from "next/link";
import { brandColors } from "@gieochu/config/theme";
import { AccountAvatar } from "../../_ui/account-avatar";
import { AdminPageHeader, Badge, Notice } from "../../admin/_ui/kit";
import { IconCheckCircle, IconChevronRight, IconMail, IconPackage, IconReceipt } from "../../admin/_ui/icons";
import { buildAccountNav } from "./account-nav";
import { AccountNavList } from "./account-nav-list";
import { formatVnDateTime } from "./format";
import { OpenStoreCard, OwnedTenantCard, tenantNeedsRenewal } from "./owned-tenant-card";

const INK = brandColors.ink;
const INK_SOFT = brandColors.inkSoft;
const BLUE = brandColors.primary;
const LINE = "#E5E7EB";
const FOCUS = "outline-offset-2 focus-visible:outline-2";

/**
 * ADR-041 C1 — Tổng quan tài khoản. Thẻ hồ sơ · (mobile) danh sách mục kiểu cài đặt · thẻ "Gian hàng của bạn" hoặc
 * "Mở gian hàng miễn phí" · lối tắt Thư viện / Đơn chờ thanh toán (desktop — mobile đã gộp số vào danh sách mục).
 */
export function AccountOverviewView({ overview }: { overview: AccountOverview }) {
  const tenant = overview.ownedTenant;
  const name = overview.fullName.trim();
  const groups = buildAccountNav({
    tenant: tenant ? { slug: tenant.slug, planName: tenant.plan.name, needsRenewal: tenantNeedsRenewal(tenant) } : null,
    libraryCount: overview.libraryCount,
    pendingOrderCount: overview.pendingOrderCount,
  });

  return (
    <div className="space-y-6">
      <AdminPageHeader title="Tài khoản của bạn" />

      <section aria-labelledby="profile-summary" className="flex flex-col gap-4 rounded-2xl border bg-white p-5 sm:flex-row sm:items-center sm:p-6" style={{ borderColor: LINE }}>
        <AccountAvatar url={overview.avatarUrl} name={name || overview.email} size={56} />
        <div className="min-w-0 flex-1">
          <h2 id="profile-summary" className="font-[family-name:var(--font-heading)] text-lg font-semibold [overflow-wrap:anywhere]" style={{ color: INK }}>
            {name || "Chưa có họ tên"}
          </h2>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm" style={{ color: INK_SOFT }}>
            <span className="[overflow-wrap:anywhere]">{overview.email}</span>
            {overview.emailVerifiedAt ? (
              <Badge tone="success">
                <IconCheckCircle className="mr-1 h-3.5 w-3.5" />
                Đã xác minh
              </Badge>
            ) : null}
          </p>
        </div>
        <Link
          href="/account/profile"
          className={`inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg border px-4 text-sm font-semibold hover:bg-gray-50 lg:min-h-10 ${FOCUS}`}
          style={{ borderColor: LINE, color: INK, outlineColor: BLUE }}
        >
          Sửa hồ sơ
        </Link>
      </section>

      {overview.pendingEmail ? (
        <Notice tone="info" icon={<IconMail className="h-4 w-4" />}>
          Đang chờ xác minh email mới <strong className="font-semibold [overflow-wrap:anywhere]">{overview.pendingEmail.email}</strong> (hết hạn lúc{" "}
          {formatVnDateTime(overview.pendingEmail.expiresAt)}).{" "}
          <Link href="/account/security#email" className={`font-semibold underline ${FOCUS}`} style={{ outlineColor: BLUE }}>
            Xem yêu cầu
          </Link>
        </Notice>
      ) : null}

      {/* Mobile: danh sách mục thay cho sidebar. */}
      <div className="lg:hidden">
        <AccountNavList groups={groups} />
      </div>

      {/* Từ xl: thẻ gian hàng (cột rộng) + lối tắt Mua sắm (cột hẹp, xếp dọc) — tận dụng chiều rộng vùng main. */}
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        {tenant ? <OwnedTenantCard tenant={tenant} /> : <OpenStoreCard />}

        <section aria-labelledby="shortcuts-title" className="hidden min-w-0 lg:block">
          <h2 id="shortcuts-title" className="font-[family-name:var(--font-heading)] text-lg font-semibold" style={{ color: INK }}>
            Mua sắm
          </h2>
          <ul className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
            <ShortcutCard
              href="/account/library"
              icon={<IconPackage className="h-5 w-5" />}
              title="Thư viện tài liệu"
              value={overview.libraryCount > 0 ? `${overview.libraryCount.toLocaleString("vi-VN")} tài liệu` : "Chưa có tài liệu"}
            />
            <ShortcutCard
              href="/account/orders"
              icon={<IconReceipt className="h-5 w-5" />}
              title="Đơn hàng"
              value={overview.pendingOrderCount > 0 ? `${overview.pendingOrderCount.toLocaleString("vi-VN")} đơn chờ thanh toán` : "Không có đơn chờ thanh toán"}
              attention={overview.pendingOrderCount > 0}
            />
          </ul>
        </section>
      </div>
    </div>
  );
}

function ShortcutCard({ href, icon, title, value, attention = false }: { href: string; icon: React.ReactNode; title: string; value: string; attention?: boolean }) {
  return (
    <li>
      <Link
        href={href}
        className={`flex items-center gap-3 rounded-2xl border bg-white p-4 transition-colors hover:bg-gray-50 motion-reduce:transition-none ${FOCUS}`}
        style={{ borderColor: LINE, outlineColor: BLUE }}
      >
        <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: brandColors.surface, color: BLUE }}>
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold" style={{ color: INK }}>
            {title}
          </span>
          <span className="block text-sm" style={{ color: attention ? "#92400E" : INK_SOFT }}>
            {value}
          </span>
        </span>
        <IconChevronRight className="h-4 w-4 shrink-0 opacity-70" />
      </Link>
    </li>
  );
}

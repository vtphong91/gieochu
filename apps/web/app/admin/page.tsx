import Link from "next/link";
import { Suspense, type ReactElement } from "react";
import { getEffectiveBrand } from "../../lib/branding";
import { brandColors } from "@gieochu/config/theme";
import { requireAdminAccess } from "../../lib/page-guards";
import {
  getAdminDashboardSummary,
  getMonthlyPlatformRevenue,
  getPlanDistribution,
  getRecentPlatformPayments,
  getRecentTenants,
} from "../../lib/admin-dashboard";
import { getAdminStatsOverview } from "../../lib/admin-stats";
import { SalesStatsSection, SalesStatsSkeleton, parseSalesChartMetric, type SalesChartMetric } from "./_ui/sales-stats";
import { formatVndFull } from "./_ui/stats-chart";

const BLUE = brandColors.primary;
const GREEN = brandColors.secondary;
const AMBER = brandColors.accent;
const LINE = "#E5E7EB";
const MUTED = "#6B7280";

function IconUsers({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8.5" r="3" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <circle cx="17" cy="9" r="2.3" />
      <path d="M15.5 14.2c2.6.4 4.5 2.6 4.5 5.3" />
    </svg>
  );
}

function IconStore({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 9.5 5 4h14l1 5.5" />
      <path d="M3.5 9.5h17L20 20H4L3.5 9.5Z" />
      <path d="M9 13.5a3 3 0 0 0 6 0" />
    </svg>
  );
}

function IconWallet({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="6" width="18" height="13" rx="2.5" />
      <path d="M3 10h18" />
      <circle cx="16.5" cy="14" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconTrendUp({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 17l6-6 4 4 8-8" />
      <path d="M15 7h6v6" />
    </svg>
  );
}

function IconLock({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
      <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" />
    </svg>
  );
}

function IconArrow({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12h15M13 6l6 6-6 6" />
    </svg>
  );
}

function formatRelativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "vừa xong";
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  return `${days} ngày trước`;
}

const TENANT_STATUS_LABEL: Record<string, string> = { ACTIVE: "Hoạt động", READ_ONLY: "Tạm ngưng bán", LOCKED: "Đã khoá" };
const TENANT_STATUS_COLOR: Record<string, string> = { ACTIVE: GREEN, READ_ONLY: AMBER, LOCKED: "#B91C1C" };

function StatCard({
  Icon,
  label,
  value,
  sub,
  ratio,
}: {
  Icon: (props: { className?: string }) => ReactElement;
  label: string;
  value: string;
  sub: string;
  ratio?: number;
}) {
  return (
    <div className="rounded-2xl border bg-white p-5" style={{ borderColor: LINE }}>
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: "#EFF4FF", color: BLUE }}>
        <Icon className="h-[18px] w-[18px]" />
      </div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className="mt-0.5 text-sm font-medium text-gray-700">{label}</div>
      <div className="mt-1 text-xs" style={{ color: MUTED }}>
        {sub}
      </div>
      {ratio != null ? (
        <div className="mt-3 h-1.5 rounded-full bg-gray-100">
          <div className="h-1.5 rounded-full" style={{ width: `${Math.round(ratio * 100)}%`, background: BLUE }} />
        </div>
      ) : null}
    </div>
  );
}

/** M12b — khối bán tài liệu tự lấy số liệu trong Suspense riêng để phần còn lại của dashboard không phải chờ. */
async function SalesStats({ metric }: { metric: SalesChartMetric }) {
  const overview = await getAdminStatsOverview({ days: 30 });
  return <SalesStatsSection overview={overview} metric={metric} />;
}

export default async function AdminDashboardPage({ searchParams }: { searchParams: Promise<{ "chi-so"?: string | string[] }> }) {
  await requireAdminAccess("/admin");
  const metric = parseSalesChartMetric((await searchParams)["chi-so"]);
  const brand = await getEffectiveBrand();

  const [summary, monthlyRevenue, recentPayments, recentTenants, planDistribution] = await Promise.all([
    getAdminDashboardSummary(),
    getMonthlyPlatformRevenue(6),
    getRecentPlatformPayments(6),
    getRecentTenants(6),
    getPlanDistribution(),
  ]);

  const maxRevenue = Math.max(1, ...monthlyRevenue.map((m) => m.totalVnd));
  const totalSubscriptions = summary.subscriptionsByPlanType.free + summary.subscriptionsByPlanType.paid;
  const paidRatio = totalSubscriptions === 0 ? 0 : summary.subscriptionsByPlanType.paid / totalSubscriptions;
  const activeTenantRatio = summary.totalTenants === 0 ? 0 : summary.tenantsByStatus.ACTIVE / summary.totalTenants;
  const today = new Date().toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });

  return (
    <div className="space-y-6 px-5 py-6 lg:px-8 lg:py-8">
      {/* Welcome banner */}
      <section
        className="flex flex-col gap-6 rounded-2xl p-6 text-white lg:flex-row lg:items-center lg:justify-between lg:p-8"
        style={{ background: `linear-gradient(120deg, ${BLUE} 0%, #12213A 100%)` }}
      >
        <div>
          <div className="mb-1 inline-block rounded-full bg-white/15 px-3 py-1 text-xs font-medium capitalize">{today}</div>
          <h1 className="mt-2 text-2xl font-bold lg:text-[28px]">Chào mừng quay lại, Admin</h1>
          <p className="mt-1 text-sm text-white/75">Tổng quan hoạt động nền tảng {brand.name}</p>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:flex sm:gap-8">
          <div>
            <div className="text-2xl font-bold">{summary.totalUsers}</div>
            <div className="text-xs text-white/70">Tổng người dùng</div>
          </div>
          <div>
            <div className="text-2xl font-bold">{summary.totalTenants}</div>
            <div className="text-xs text-white/70">Tổng tenant</div>
          </div>
        </div>
      </section>

      {/* Stat cards */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard Icon={IconUsers} label="Người dùng hoạt động" value={summary.usersByStatus.ACTIVE.toLocaleString("vi-VN")} sub={`${summary.usersByStatus.LOCKED} bị khoá`} />
        <StatCard
          Icon={IconStore}
          label="Tenant hoạt động"
          value={summary.tenantsByStatus.ACTIVE.toLocaleString("vi-VN")}
          sub={`${summary.totalTenants} tổng cộng`}
          ratio={activeTenantRatio}
        />
        <StatCard
          Icon={IconWallet}
          label="Đang trả phí"
          value={summary.subscriptionsByPlanType.paid.toLocaleString("vi-VN")}
          sub={`${summary.subscriptionsByPlanType.free} đang dùng Free`}
          ratio={paidRatio}
        />
        <StatCard Icon={IconLock} label="User bị khoá" value={summary.usersByStatus.LOCKED.toLocaleString("vi-VN")} sub={`${summary.usersByStatus.PENDING} chờ xác minh`} />
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Revenue chart */}
        <section className="rounded-2xl border bg-white p-6 lg:col-span-2" style={{ borderColor: LINE }}>
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-gray-900">Doanh thu gói dịch vụ</h2>
              <p className="mt-0.5 text-xs" style={{ color: MUTED }}>
                Doanh thu Platform Billing 6 tháng gần nhất (tenant trả phí cho {brand.name})
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: GREEN }}>
              <IconTrendUp className="h-3.5 w-3.5" /> MRR
            </div>
          </div>
          <div className="flex h-48 items-end gap-3 sm:gap-4">
            {monthlyRevenue.map((m) => (
              <div key={m.label} className="flex flex-1 flex-col items-center gap-2">
                <div className="flex w-full flex-1 items-end">
                  <div
                    className="w-full rounded-t-md"
                    style={{ height: `${Math.max(4, (m.totalVnd / maxRevenue) * 100)}%`, background: m.totalVnd > 0 ? BLUE : "#EEF1F5", minHeight: 4 }}
                    title={formatVndFull(m.totalVnd)}
                  />
                </div>
                <span className="text-[11px] font-medium capitalize" style={{ color: MUTED }}>
                  {m.label}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-5 flex items-center justify-between border-t pt-4 text-sm" style={{ borderColor: LINE }}>
            <span style={{ color: MUTED }}>Tổng 6 tháng</span>
            <span className="font-bold tabular-nums text-gray-900">{formatVndFull(monthlyRevenue.reduce((sum, m) => sum + m.totalVnd, 0))}</span>
          </div>
        </section>

        {/* Recent activity */}
        <section className="rounded-2xl border bg-white p-6" style={{ borderColor: LINE }}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-bold text-gray-900">Thanh toán gần đây</h2>
            <span className="flex items-center gap-1.5 text-xs font-medium" style={{ color: GREEN }}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: GREEN }} /> Live
            </span>
          </div>
          {recentPayments.length === 0 ? (
            <p className="py-6 text-center text-sm" style={{ color: MUTED }}>
              Chưa có giao dịch nào.
            </p>
          ) : (
            <ul className="space-y-4">
              {recentPayments.map((p) => (
                <li key={p.id} className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full" style={{ background: "#EFF4FF", color: BLUE }}>
                    <IconWallet className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-gray-800">
                      <span className="font-semibold">{p.tenantName}</span> đã thanh toán gói{" "}
                      <span className="font-semibold">{p.planName}</span>
                    </p>
                    <p className="mt-0.5 text-xs font-medium" style={{ color: GREEN }}>
                      {p.amountVnd.toLocaleString("vi-VN")}đ
                    </p>
                    <p className="text-xs" style={{ color: MUTED }}>
                      {formatRelativeTime(p.paidAt)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <Link href="/admin/billing/invoices" className="mt-5 flex items-center gap-1.5 text-sm font-semibold" style={{ color: BLUE }}>
            Xem tất cả hoá đơn <IconArrow className="h-3.5 w-3.5" />
          </Link>
        </section>
      </div>

      {/* M12b — hoạt động bán tài liệu toàn nền tảng (tenant_daily_stats, ADR-037) */}
      <Suspense fallback={<SalesStatsSkeleton />}>
        <SalesStats metric={metric} />
      </Suspense>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Quick actions */}
        <section className="rounded-2xl border bg-white p-6" style={{ borderColor: LINE }}>
          <h2 className="mb-1 text-base font-bold text-gray-900">Thao tác nhanh</h2>
          <p className="mb-4 text-xs" style={{ color: MUTED }}>
            Các tác vụ quản trị thường dùng
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Link href="/admin/users" className="rounded-xl p-4 text-white" style={{ background: BLUE }}>
              <IconUsers className="mb-2 h-5 w-5" />
              <div className="text-sm font-semibold">Người dùng</div>
              <div className="text-xs opacity-80">Xem &amp; khoá tài khoản</div>
            </Link>
            <Link href="/admin/tenants" className="rounded-xl p-4 text-white" style={{ background: GREEN }}>
              <IconStore className="mb-2 h-5 w-5" />
              <div className="text-sm font-semibold">Tenant</div>
              <div className="text-xs opacity-80">Quản lý trang bán</div>
            </Link>
            <Link href="/admin/plans" className="rounded-xl p-4 text-white" style={{ background: AMBER }}>
              <IconWallet className="mb-2 h-5 w-5" />
              <div className="text-sm font-semibold">Gói dịch vụ</div>
              <div className="text-xs opacity-80">Sửa giá &amp; giới hạn</div>
            </Link>
            <Link href="/admin/settings/general" className="rounded-xl p-4 text-white" style={{ background: "#334155" }}>
              <IconTrendUp className="mb-2 h-5 w-5" />
              <div className="text-sm font-semibold">Cấu hình</div>
              <div className="text-xs opacity-80">Thiết lập hệ thống</div>
            </Link>
          </div>
        </section>

        {/* Plan distribution */}
        <section className="rounded-2xl border bg-white p-6" style={{ borderColor: LINE }}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-bold text-gray-900">Phân bổ theo gói</h2>
            <Link href="/admin/plans" className="text-xs font-semibold" style={{ color: BLUE }}>
              Quản lý gói
            </Link>
          </div>
          <ul className="space-y-3.5">
            {planDistribution.map((p) => {
              const ratio = totalSubscriptions === 0 ? 0 : p.count / totalSubscriptions;
              return (
                <li key={p.planName}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium text-gray-800">{p.planName}</span>
                    <span style={{ color: MUTED }}>{p.count} tenant</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-gray-100">
                    <div className="h-1.5 rounded-full" style={{ width: `${Math.round(ratio * 100)}%`, background: p.isFree ? GREEN : BLUE }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Recent tenants */}
        <section className="rounded-2xl border bg-white p-6" style={{ borderColor: LINE }}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-bold text-gray-900">Tenant mới</h2>
            <Link href="/admin/tenants" className="text-xs font-semibold" style={{ color: BLUE }}>
              Xem tất cả
            </Link>
          </div>
          {recentTenants.length === 0 ? (
            <p className="py-6 text-center text-sm" style={{ color: MUTED }}>
              Chưa có tenant nào.
            </p>
          ) : (
            <ul className="space-y-3.5">
              {recentTenants.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-gray-800">{t.name}</div>
                    <div className="text-xs" style={{ color: MUTED }}>
                      {t.planName} · {formatRelativeTime(t.createdAt)}
                    </div>
                  </div>
                  <span
                    className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold"
                    style={{ background: `${TENANT_STATUS_COLOR[t.status] ?? MUTED}1A`, color: TENANT_STATUS_COLOR[t.status] ?? MUTED }}
                  >
                    {TENANT_STATUS_LABEL[t.status] ?? t.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

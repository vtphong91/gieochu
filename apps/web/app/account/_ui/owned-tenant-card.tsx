import Link from "next/link";
import { brandColors } from "@gieochu/config/theme";
import type { OwnedTenantOverview, PlanUsage } from "../../../lib/account-profile";
import { Badge, Notice } from "../../admin/_ui/kit";
import { IconAlertTriangle, IconExternalLink, IconStore } from "../../admin/_ui/icons";
import { formatVnDate } from "./format";

const INK = brandColors.ink;
const INK_SOFT = brandColors.inkSoft;
const BLUE = brandColors.primary;
const LINE = "#E5E7EB";
/** Đỏ đạt 6.5:1 trên nền trắng. */
const RED = "#B91C1C";

const CARD = "rounded-2xl border bg-white p-5 sm:p-6";
const BTN = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold outline-offset-2 transition focus-visible:outline-2 motion-reduce:transition-none lg:min-h-10";
const BTN_PRIMARY = `${BTN} text-white hover:brightness-110`;
const BTN_GHOST = `${BTN} border bg-white hover:bg-gray-50`;

const OVERDUE = new Set(["GRACE", "PAST_DUE", "EXPIRED"]);

/** Gói cần gia hạn — dùng chung cho sidebar (nhãn "Quá hạn") và thẻ. */
export function tenantNeedsRenewal(tenant: Pick<OwnedTenantOverview, "subscriptionStatus">): boolean {
  return OVERDUE.has(tenant.subscriptionStatus);
}

interface PlanView {
  status: { tone: "success" | "warning" | "neutral" | "info"; text: string };
  detail: string | null;
  warning: string | null;
  primary: { href: string; label: string };
  secondary: { href: string; label: string } | null;
}

function planView(tenant: OwnedTenantOverview): PlanView {
  const billing = `/studio/${tenant.slug}/billing`;
  const compare = { href: "/pricing", label: "So sánh các gói" };
  const status = tenant.subscriptionStatus;

  if (OVERDUE.has(status)) {
    const until = tenant.graceEndsAt ? ` — gia hạn trước ${formatVnDate(tenant.graceEndsAt)} để giữ hạn mức hiện tại` : "";
    return {
      status: { tone: "warning", text: status === "EXPIRED" ? "Đã hết hạn" : "Quá hạn" },
      detail: tenant.currentPeriodEnd ? `Hết hạn kỳ trước: ${formatVnDate(tenant.currentPeriodEnd)}` : null,
      warning: `Gói ${tenant.plan.name} đã quá hạn${until}.`,
      primary: { href: billing, label: "Gia hạn ngay" },
      secondary: null,
    };
  }
  if (tenant.plan.isFree) {
    return {
      status: { tone: "info", text: "Không hết hạn" },
      detail: null,
      warning: null,
      primary: { href: "/pricing", label: "Nâng cấp" },
      secondary: null,
    };
  }
  if (status === "CANCELED") {
    return {
      status: { tone: "neutral", text: "Đã huỷ gia hạn" },
      detail: tenant.currentPeriodEnd ? `Dùng tới: ${formatVnDate(tenant.currentPeriodEnd)}` : null,
      warning: null,
      primary: { href: billing, label: "Gia hạn" },
      secondary: compare,
    };
  }
  return {
    status: { tone: "success", text: "Đang hoạt động" },
    detail: tenant.currentPeriodEnd ? `Hết hạn: ${formatVnDate(tenant.currentPeriodEnd)}` : null,
    warning: null,
    primary: { href: billing, label: "Quản lý gói" },
    secondary: compare,
  };
}

/**
 * Thẻ "Gian hàng của bạn" (đề xuất Phong §5) — chỉ dữ liệu L1 của gian hàng user sở hữu (gói, trạng thái, hạn, hạn
 * mức), không có dữ liệu đơn/khách. Nút chính theo trạng thái: Free → "Nâng cấp" (`/pricing`); trả phí → "Quản lý
 * gói"; quá hạn → "Gia hạn ngay" (Billing Studio). Trạng thái luôn có chữ (Badge/Notice), không chỉ màu.
 */
export function OwnedTenantCard({ tenant, headingLevel = "h2" }: { tenant: OwnedTenantOverview; headingLevel?: "h2" | "h3" }) {
  const view = planView(tenant);
  const Heading = headingLevel;

  return (
    <section aria-labelledby="owned-tenant-title" className={CARD} style={{ borderColor: LINE }}>
      <div className="flex items-start gap-3">
        {tenant.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- logo gian hàng (bucket public), kích thước nhỏ cố định
          <img src={tenant.logoUrl} alt="" width={44} height={44} className="h-11 w-11 shrink-0 rounded-xl border object-contain" style={{ borderColor: LINE }} />
        ) : (
          <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ background: brandColors.surface, color: BLUE }}>
            <IconStore className="h-5 w-5" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold tracking-wide uppercase" style={{ color: INK_SOFT }}>
            Gian hàng của bạn
          </p>
          <Heading id="owned-tenant-title" className="mt-0.5 font-[family-name:var(--font-heading)] text-lg font-semibold [overflow-wrap:anywhere]" style={{ color: INK }}>
            {tenant.name}
          </Heading>
          <p className="text-sm [overflow-wrap:anywhere]" style={{ color: INK_SOFT }}>
            /{tenant.slug}
          </p>
        </div>
      </div>

      <dl className="mt-5 space-y-3 text-sm">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <dt className="w-24 shrink-0" style={{ color: INK_SOFT }}>
            Gói hiện tại
          </dt>
          <dd className="flex flex-wrap items-center gap-2">
            <span className="font-semibold" style={{ color: INK }}>
              {tenant.plan.name}
            </span>
            <Badge tone={view.status.tone}>{view.status.text}</Badge>
          </dd>
        </div>
        {view.detail ? (
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            <dt className="sr-only">Thời hạn</dt>
            <dd className="sm:pl-[108px]" style={{ color: INK_SOFT }}>
              {view.detail}
            </dd>
          </div>
        ) : null}
      </dl>

      {view.warning ? (
        <div className="mt-4">
          <Notice tone="warning" icon={<IconAlertTriangle className="h-4 w-4" />}>
            <strong className="font-semibold">{view.warning}</strong> Quá hạn ân hạn mà chưa gia hạn, gian hàng sẽ tự chuyển về gói Free.
          </Notice>
        </div>
      ) : null}

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <UsageMeter label="Tài liệu đang bán" usage={tenant.usage.products} formatUsed={(n) => n.toLocaleString("vi-VN")} />
        <UsageMeter label="Dung lượng" usage={tenant.usage.storageMb} formatUsed={(n) => `${n.toLocaleString("vi-VN", { maximumFractionDigits: 1 })} MB`} />
      </div>

      <div className="mt-6 flex flex-col gap-2 border-t pt-4 sm:flex-row sm:flex-wrap sm:items-center" style={{ borderColor: LINE }}>
        <Link href={view.primary.href} className={BTN_PRIMARY} style={{ background: BLUE, outlineColor: BLUE }}>
          {view.primary.label}
        </Link>
        {view.secondary ? (
          <Link href={view.secondary.href} className={BTN_GHOST} style={{ borderColor: LINE, color: INK, outlineColor: BLUE }}>
            {view.secondary.label}
          </Link>
        ) : null}
        <Link
          href={`/studio/${tenant.slug}`}
          className={`${BTN} sm:ml-auto`}
          style={{ color: BLUE, outlineColor: BLUE }}
        >
          Vào Studio
          <IconExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>
    </section>
  );
}

/**
 * Hạn mức đã dùng. Chỉ vẽ thanh % khi `display.kind === "LIMITED"` (ADR-041 A.4); `UNLIMITED`/`NONE` chỉ hiện chữ
 * `label`. Thanh là trang trí (`aria-hidden`) — số liệu nằm trong chữ; ≥ 80% kèm chữ "Sắp đạt hạn mức", ≥ 100% "Đã đạt
 * hạn mức" (không chỉ đổi màu).
 */
function UsageMeter({ label, usage, formatUsed }: { label: string; usage: PlanUsage; formatUsed: (n: number) => string }) {
  const { display } = usage;
  let valueText: string;
  let ratio: number | null = null;
  if (display.kind === "LIMITED") {
    ratio = display.value > 0 ? usage.used / display.value : 1;
    valueText = `${formatUsed(usage.used)} / ${usage.label}`;
  } else if (display.kind === "UNLIMITED") {
    valueText = `${formatUsed(usage.used)} · ${usage.label}`;
  } else {
    valueText = usage.label;
  }
  const full = ratio !== null && ratio >= 1;
  const near = ratio !== null && ratio >= 0.8 && !full;
  const barColor = full ? RED : near ? brandColors.accent : BLUE;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span style={{ color: INK_SOFT }}>{label}</span>
        <span className="text-right font-semibold tabular-nums [overflow-wrap:anywhere]" style={{ color: INK }}>
          {valueText}
        </span>
      </div>
      {ratio !== null ? (
        <>
          <div aria-hidden="true" className="mt-2 h-2 overflow-hidden rounded-full" style={{ background: "#EEF0F3" }}>
            <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.round(ratio * 100))}%`, background: barColor }} />
          </div>
          {full || near ? (
            <p className="mt-1 text-xs font-semibold" style={{ color: full ? RED : "#92400E" }}>
              {full ? "Đã đạt hạn mức" : "Sắp đạt hạn mức"}
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

/** Thẻ cho người chưa có gian hàng — CTA "Mở gian hàng miễn phí" → `/studio` (onboarding). */
export function OpenStoreCard() {
  return (
    <section aria-labelledby="open-store-title" className={`${CARD} flex flex-col gap-4 sm:flex-row sm:items-center`} style={{ borderColor: LINE }}>
      <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ background: brandColors.accentSoft, color: "#92400E" }}>
        <IconStore className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <h2 id="open-store-title" className="font-[family-name:var(--font-heading)] font-semibold" style={{ color: INK }}>
          Bạn là giáo viên hoặc coach?
        </h2>
        <p className="mt-1 text-sm" style={{ color: INK_SOFT }}>
          Mở gian hàng miễn phí để bán tài liệu số của bạn. Hồ sơ cá nhân vẫn dùng chung một tài khoản.
        </p>
      </div>
      <Link href="/studio" className={`${BTN} shrink-0 hover:brightness-105`} style={{ background: brandColors.accent, color: "#241503", outlineColor: BLUE }}>
        Mở gian hàng miễn phí
      </Link>
    </section>
  );
}

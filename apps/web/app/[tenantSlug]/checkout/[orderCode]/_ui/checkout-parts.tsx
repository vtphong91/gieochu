import type { ReactNode } from "react";
import Link from "next/link";
import { brandColors } from "@gieochu/config/theme";
import type { CheckoutDisplayStatus, CheckoutView } from "../../../../../lib/checkout-view";
import { IconAlertTriangle, IconCheckCircle, IconChevronDown, IconClock, IconDoc, IconMail, IconRefresh, IconXCircle } from "../../../../admin/_ui/icons";
import { formatDateTime, formatVnd, STATUS_LABEL, STATUS_STEP } from "./format";

/*
 * Mảnh trình bày phía server của trang thanh toán (ADR-062). Không hook, không truy vấn — nhận dữ liệu từ `CheckoutView`.
 * Màu chỉ qua `brandColors`; chữ trong mọi khối trạng thái là `ink` (§7.1 — `secondary`/`accent` không đạt 4.5:1 làm chữ).
 */

const INK = brandColors.ink;
const INK_SOFT = brandColors.inkSoft;
const LINE = brandColors.line;
export const GREEN_SOFT = `color-mix(in srgb, ${brandColors.secondary} 10%, white)`;
/** Nền trung tính (huỷ / hoàn tiền) — pha từ `inkSoft`, không dùng palette xám rời. */
export const NEUTRAL_SOFT = `color-mix(in srgb, ${brandColors.inkSoft} 8%, white)`;
export const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-primary)]";
/** Nút chính: nền primary chữ trắng, ≥48px. */
export const PRIMARY_BTN = `inline-flex min-h-12 cursor-pointer touch-manipulation items-center justify-center gap-2 rounded-full px-6 text-base font-semibold text-white transition-[filter] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none ${FOCUS}`;
/** Nút phụ viền: ≥44px. */
export const GHOST_BTN = `inline-flex min-h-11 cursor-pointer touch-manipulation items-center justify-center gap-2 rounded-full border bg-white px-5 text-sm font-semibold transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none ${FOCUS}`;

/** Id tiêu đề khối trạng thái — nhận focus sau khi khách bấm hành động làm đổi trạng thái. */
export const STATE_HEADING_ID = "checkout-trang-thai";
/** Id tiêu đề khối thanh toán — nhận focus sau khi đổi phương thức. */
export const PAYMENT_HEADING_ID = "checkout-thanh-toan";

// ───────────────────────── Badge trạng thái ─────────────────────────

const BADGE: Record<CheckoutDisplayStatus, { bg: string; line: string; icon: ReactNode }> = {
  AWAITING_PAYMENT: { bg: brandColors.accentSoft, line: brandColors.accent, icon: <IconClock className="h-4 w-4" /> },
  AWAITING_SELLER_CONFIRM: { bg: brandColors.surface, line: brandColors.primary, icon: <IconClock className="h-4 w-4" /> },
  PAID: { bg: GREEN_SOFT, line: brandColors.secondary, icon: <IconCheckCircle className="h-4 w-4" /> },
  EXPIRED: { bg: brandColors.accentSoft, line: brandColors.accent, icon: <IconAlertTriangle className="h-4 w-4" /> },
  CANCELED: { bg: NEUTRAL_SOFT, line: LINE, icon: <IconXCircle className="h-4 w-4" /> },
  REFUNDED: { bg: NEUTRAL_SOFT, line: LINE, icon: <IconRefresh className="h-4 w-4" /> },
};

/** Badge có chữ + icon (không chỉ màu), chữ `ink`. */
export function CheckoutStatusBadge({ status }: { status: CheckoutDisplayStatus }) {
  const b = BADGE[status];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-semibold" style={{ background: b.bg, borderColor: b.line, color: INK }}>
      {b.icon}
      <span className="sr-only">Trạng thái: </span>
      {STATUS_LABEL[status]}
    </span>
  );
}

// ───────────────────────── Tóm tắt đơn ─────────────────────────

function Cover({ url, size }: { url: string | null; size: "sm" | "md" }) {
  const box = size === "sm" ? "h-14 w-12" : "h-20 w-16";
  if (!url) {
    return (
      <span aria-hidden="true" className={`${box} flex shrink-0 items-center justify-center rounded-lg`} style={{ background: brandColors.surface, color: brandColors.primary }}>
        <IconDoc className="h-6 w-6" />
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element -- ảnh bìa đã tối ưu ở server (getProductCoverUrl), giữ kích thước cố định để không nhảy bố cục
  return <img src={url} alt="" width={size === "sm" ? 48 : 64} height={size === "sm" ? 56 : 80} className={`${box} shrink-0 rounded-lg border object-cover`} style={{ borderColor: LINE }} />;
}

/** Phần tài liệu cần cho khối tóm tắt — dùng chung trang đơn (`CheckoutView.item`) và trang khách vãng lai chưa có đơn. */
export type SummaryItem = { title: string; productPath: string | null; typeLabel: string | null; coverUrl: string | null };

function ItemTitle({ item }: { item: SummaryItem }) {
  return (
    <>
      {item.productPath ? (
        <Link href={item.productPath} className={`rounded font-semibold hover:text-[color:var(--color-primary)] hover:underline ${FOCUS}`}>
          {item.title}
        </Link>
      ) : (
        <span className="font-semibold">{item.title}</span>
      )}
      {item.typeLabel ? (
        <span className="mt-0.5 block text-xs" style={{ color: INK_SOFT }}>
          {item.typeLabel}
        </span>
      ) : null}
    </>
  );
}

function PriceRows({ order }: { order: CheckoutView["order"] }) {
  return (
    <dl className="space-y-1.5 text-sm">
      <div className="flex justify-between gap-4" style={{ color: INK_SOFT }}>
        <dt>Tạm tính</dt>
        <dd className="tabular-nums">{formatVnd(order.subtotalVnd)}</dd>
      </div>
      {order.discountVnd > 0 ? (
        <div className="flex justify-between gap-4" style={{ color: INK_SOFT }}>
          <dt className="min-w-0 [overflow-wrap:anywhere]">Giảm giá{order.couponCode ? ` (${order.couponCode})` : ""}</dt>
          <dd className="shrink-0 tabular-nums">−{formatVnd(order.discountVnd)}</dd>
        </div>
      ) : null}
      <div className="flex justify-between gap-4 border-t pt-2 text-base font-bold" style={{ borderColor: LINE }}>
        <dt>Tổng cộng</dt>
        <dd className="tabular-nums">{formatVnd(order.totalVnd)}</dd>
      </div>
    </dl>
  );
}

/** Dải tóm tắt gọn trên mobile (< lg): bìa + tên + tổng; "Chi tiết" mở bảng giá. */
export function SummaryStrip({ view }: { view: CheckoutView }) {
  return (
    <section aria-label="Tóm tắt đơn hàng" className="rounded-xl border p-3 lg:hidden" style={{ borderColor: LINE }}>
      <div className="flex items-start gap-3">
        <Cover url={view.item.coverUrl} size="sm" />
        <div className="min-w-0 flex-1 text-sm [overflow-wrap:anywhere]">
          <ItemTitle item={view.item} />
        </div>
        <span className="shrink-0 text-base font-bold tabular-nums">{formatVnd(view.order.totalVnd)}</span>
      </div>
      <details className="group mt-1">
        <summary
          className={`ml-auto flex min-h-11 w-fit cursor-pointer list-none items-center gap-1 rounded-lg px-2 text-sm font-medium text-[color:var(--color-primary)] [&::-webkit-details-marker]:hidden ${FOCUS}`}
        >
          Chi tiết giá
          <IconChevronDown className="h-4 w-4 transition-transform group-open:rotate-180 motion-reduce:transition-none" />
        </summary>
        <div className="mt-1 border-t pt-2" style={{ borderColor: LINE }}>
          <PriceRows order={view.order} />
        </div>
      </details>
    </section>
  );
}

/** Thẻ tóm tắt đầy đủ ở cột phải (từ lg). */
export function SummaryCard({ view }: { view: CheckoutView }) {
  return (
    <section aria-labelledby="checkout-tom-tat" className="hidden rounded-2xl border p-5 lg:block" style={{ borderColor: LINE }}>
      <h2 id="checkout-tom-tat" className="sr-only">
        Tóm tắt đơn hàng
      </h2>
      <div className="flex items-start gap-3">
        <Cover url={view.item.coverUrl} size="md" />
        <div className="min-w-0 flex-1 text-sm leading-snug [overflow-wrap:anywhere]">
          <ItemTitle item={view.item} />
        </div>
      </div>
      <div className="mt-4">
        <PriceRows order={view.order} />
      </div>
    </section>
  );
}

/**
 * Tóm tắt khi CHƯA có đơn (khách vãng lai, ADR-062 Q2 §3.5): cùng hình thức `SummaryStrip` (mobile) / `SummaryCard` (từ lg) nhưng
 * chỉ có "Tổng cộng" — giá do server tính sẵn (đã gồm khuyến mãi đang áp), tổng thật vẫn tính lại khi tạo đơn.
 */
export function PreOrderSummary({ item, totalVnd, variant }: { item: SummaryItem; totalVnd: number; variant: "strip" | "card" }) {
  if (variant === "strip") {
    return (
      <section aria-label="Tóm tắt đơn hàng" className="flex items-start gap-3 rounded-xl border p-3 lg:hidden" style={{ borderColor: LINE }}>
        <Cover url={item.coverUrl} size="sm" />
        <div className="min-w-0 flex-1 text-sm [overflow-wrap:anywhere]">
          <ItemTitle item={item} />
        </div>
        <span className="shrink-0 text-base font-bold tabular-nums">{formatVnd(totalVnd)}</span>
      </section>
    );
  }
  return (
    <section aria-labelledby="checkout-tom-tat" className="hidden rounded-2xl border p-5 lg:block" style={{ borderColor: LINE }}>
      <h2 id="checkout-tom-tat" className="sr-only">
        Tóm tắt đơn hàng
      </h2>
      <div className="flex items-start gap-3">
        <Cover url={item.coverUrl} size="md" />
        <div className="min-w-0 flex-1 text-sm leading-snug [overflow-wrap:anywhere]">
          <ItemTitle item={item} />
        </div>
      </div>
      <dl className="mt-4 text-sm">
        <div className="flex justify-between gap-4 border-t pt-2 text-base font-bold" style={{ borderColor: LINE }}>
          <dt>Tổng cộng</dt>
          <dd className="tabular-nums">{formatVnd(totalVnd)}</dd>
        </div>
      </dl>
    </section>
  );
}

// ───────────────────────── Tiến độ ─────────────────────────

type StepState = "done" | "current" | "upcoming" | "stopped";
type Step = { title: string; state: StepState; detail?: string };

const STEP_SR: Record<StepState, string> = { done: "đã xong", current: "đang thực hiện", upcoming: "chưa tới", stopped: "đã dừng" };

function buildSteps(view: CheckoutView): Step[] {
  const { order } = view;
  const auto = order.confirmMode === "AUTO";
  const confirmTitle = auto ? "Hệ thống xác nhận" : "Người bán xác nhận";
  const placed: Step = { title: "Đặt đơn", state: "done", detail: formatDateTime(order.createdAt) };
  const declared = order.customerDeclaredPaidAt ? `Bạn báo đã chuyển lúc ${formatDateTime(order.customerDeclaredPaidAt)}` : undefined;

  switch (order.displayStatus) {
    case "AWAITING_PAYMENT":
      return [
        placed,
        {
          title: "Thanh toán",
          state: "current",
          detail: order.provider
            ? auto
              ? "Quét QR hoặc chuyển khoản đúng nội dung — trang tự cập nhật khi tiền về."
              : "Quét QR hoặc chuyển khoản theo thông tin, rồi bấm “Tôi đã chuyển khoản”."
            : "Chọn cách thanh toán để nhận thông tin chuyển khoản.",
        },
        { title: confirmTitle, state: "upcoming", detail: auto ? "Tự động, thường vài phút." : undefined },
        { title: "Tải tài liệu", state: "upcoming" },
      ];
    case "AWAITING_SELLER_CONFIRM":
      return [
        placed,
        { title: "Thanh toán", state: "done", detail: declared },
        { title: confirmTitle, state: "current", detail: "Người bán đối chiếu giao dịch rồi xác nhận thủ công — bạn nhận email khi xong." },
        { title: "Tải tài liệu", state: "upcoming" },
      ];
    case "PAID":
      return [
        placed,
        { title: "Thanh toán", state: "done", detail: order.paidAt ? formatDateTime(order.paidAt) : undefined },
        { title: confirmTitle, state: "done" },
        { title: "Tải tài liệu", state: "current", detail: "Tài liệu đã sẵn sàng trong Thư viện." },
      ];
    case "REFUNDED":
      return [
        placed,
        { title: "Thanh toán", state: "done" },
        { title: confirmTitle, state: "done" },
        { title: "Tải tài liệu", state: "stopped", detail: "Đơn đã hoàn tiền — quyền tải đã thu hồi." },
      ];
    case "EXPIRED":
      return [
        placed,
        { title: "Thanh toán", state: "stopped", detail: `Đơn đã hết hạn lúc ${formatDateTime(order.expiresAt)}.` },
        { title: confirmTitle, state: "upcoming" },
        { title: "Tải tài liệu", state: "upcoming" },
      ];
    case "CANCELED":
      return [
        placed,
        { title: "Thanh toán", state: "stopped", detail: "Đơn đã huỷ." },
        { title: confirmTitle, state: "upcoming" },
        { title: "Tải tài liệu", state: "upcoming" },
      ];
  }
}

function StepMarker({ state, index }: { state: StepState; index: number }) {
  const base = "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold";
  if (state === "done") {
    return (
      <span aria-hidden="true" className={base} style={{ borderColor: brandColors.secondary, background: brandColors.secondary, color: "white" }}>
        <IconCheckCircle className="h-4 w-4" />
      </span>
    );
  }
  if (state === "current") {
    return (
      <span aria-hidden="true" className={base} style={{ borderColor: brandColors.primary, background: brandColors.primary, color: "white" }}>
        {index + 1}
      </span>
    );
  }
  if (state === "stopped") {
    return (
      <span aria-hidden="true" className={base} style={{ borderColor: brandColors.accent, background: brandColors.accentSoft, color: INK }}>
        <IconXCircle className="h-4 w-4" />
      </span>
    );
  }
  return (
    <span aria-hidden="true" className={base} style={{ borderColor: LINE, background: "white", color: INK_SOFT }}>
      {index + 1}
    </span>
  );
}

export function ProgressTimeline({ view }: { view: CheckoutView }) {
  return <TimelineSection steps={buildSteps(view)} stepNo={STATUS_STEP[view.order.displayStatus]} />;
}

/** Tiến độ khi CHƯA có đơn (khách vãng lai): bước 1/4 đang làm, cùng 4 bước như trang đơn. */
export function PreOrderProgress({ hasAutoOnly = false }: { hasAutoOnly?: boolean }) {
  return (
    <TimelineSection
      stepNo={1}
      steps={[
        { title: "Đặt đơn", state: "current", detail: "Điền họ tên, email và chọn cách thanh toán." },
        { title: "Thanh toán", state: "upcoming", detail: "Nhận mã QR và thông tin chuyển khoản ngay sau bước này." },
        { title: hasAutoOnly ? "Hệ thống xác nhận" : "Người bán xác nhận", state: "upcoming" },
        { title: "Tải tài liệu", state: "upcoming" },
      ]}
    />
  );
}

function TimelineSection({ steps, stepNo }: { steps: Step[]; stepNo: number }) {
  return (
    <section aria-labelledby="checkout-tien-do" className="rounded-2xl border p-5" style={{ borderColor: LINE }}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="checkout-tien-do" className="font-[family-name:var(--font-heading)] text-base font-bold">
          Tiến độ
        </h2>
        <span className="text-sm" style={{ color: INK_SOFT }}>
          Bước {stepNo}/4
        </span>
      </div>
      <ol className="mt-4">
        {steps.map((step, i) => {
          const last = i === steps.length - 1;
          const active = step.state === "current" || step.state === "stopped";
          return (
            <li key={step.title} aria-current={active ? "step" : undefined} className="relative flex gap-3 pb-5 last:pb-0">
              {!last ? (
                <span
                  aria-hidden="true"
                  className="absolute top-7 bottom-0 left-[13px] w-0.5"
                  style={{ background: step.state === "done" ? brandColors.secondary : LINE }}
                />
              ) : null}
              <StepMarker state={step.state} index={i} />
              <div className="min-w-0 pt-0.5">
                <p className={`text-sm ${active ? "font-bold" : step.state === "done" ? "font-semibold" : "font-medium"}`} style={{ color: step.state === "upcoming" ? INK_SOFT : INK }}>
                  {step.title}
                  <span className="sr-only"> — {STEP_SR[step.state]}</span>
                </p>
                {step.detail ? (
                  <p className="mt-0.5 text-sm leading-relaxed" style={{ color: INK_SOFT }}>
                    {step.detail}
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

// ───────────────────────── Khối thông báo §7.1 ─────────────────────────

type NoticeTone = "success" | "warning" | "info" | "neutral";
const NOTICE: Record<NoticeTone, { bg: string; line: string; icon: ReactNode }> = {
  success: { bg: GREEN_SOFT, line: brandColors.secondary, icon: <IconCheckCircle className="h-6 w-6" /> },
  warning: { bg: brandColors.accentSoft, line: brandColors.accent, icon: <IconAlertTriangle className="h-6 w-6" /> },
  info: { bg: brandColors.surface, line: brandColors.primary, icon: <IconClock className="h-6 w-6" /> },
  neutral: { bg: NEUTRAL_SOFT, line: brandColors.inkSoft, icon: <IconXCircle className="h-6 w-6" /> },
};

/** Khối trạng thái (tint + viền trái 4px) có tiêu đề h2 nhận focus được (`STATE_HEADING_ID`). */
export function StateNotice({ tone, title, children, icon }: { tone: NoticeTone; title: string; children?: ReactNode; icon?: ReactNode }) {
  const n = NOTICE[tone];
  return (
    <section aria-labelledby={STATE_HEADING_ID} className="flex gap-3 rounded-2xl border border-l-4 p-5" style={{ background: n.bg, borderColor: n.line, color: INK }}>
      <span aria-hidden="true" className="mt-0.5 shrink-0">
        {icon ?? n.icon}
      </span>
      <div className="min-w-0 flex-1 text-sm leading-relaxed">
        <h2 id={STATE_HEADING_ID} tabIndex={-1} className="font-[family-name:var(--font-heading)] text-lg font-bold outline-none">
          {title}
        </h2>
        {children ? <div className="mt-1.5 space-y-2">{children}</div> : null}
      </div>
    </section>
  );
}

/**
 * ADR-061 Q1 — nhắc kích hoạt cho phiên khách vãng lai (tài khoản tạo lúc mua, chưa có mật khẩu). Nền `surface` + viền
 * `primary` (thông tin, không phải cảnh báo). `prominent` (vừa tạo — `?vua-tao=1`): viền đủ 4 cạnh dày hơn + tiêu đề lớn; còn
 * lại: bản gọn. Chữ luôn `ink`, icon chỉ trang trí (có chữ đi kèm).
 */
export function GuestActivationNotice({ email, prominent, resendHref }: { email: string; prominent: boolean; resendHref: string }) {
  return (
    <section
      aria-labelledby="checkout-kich-hoat"
      className={`flex gap-3 rounded-2xl border-l-4 ${prominent ? "border-2 p-5" : "border p-4"}`}
      style={{ background: brandColors.surface, borderColor: brandColors.primary, color: INK }}
    >
      <span aria-hidden="true" className="mt-0.5 shrink-0" style={{ color: brandColors.primary }}>
        <IconMail className={prominent ? "h-6 w-6" : "h-5 w-5"} />
      </span>
      <div className="min-w-0 flex-1 text-sm leading-relaxed">
        <h2 id="checkout-kich-hoat" className={`font-[family-name:var(--font-heading)] font-bold ${prominent ? "text-lg" : "text-base"}`}>
          {prominent ? "Đã tạo tài khoản cho bạn" : "Tài khoản chưa kích hoạt"}
        </h2>
        <p className="mt-1.5">
          Kiểm tra email <strong className="font-semibold [overflow-wrap:anywhere]">{email}</strong> để kích hoạt tài khoản và đặt mật khẩu (thư “Kích hoạt tài
          khoản và đặt mật khẩu”).
        </p>
        <p className="mt-1.5">
          Phiên mua này dùng được trong <strong className="font-semibold">24 giờ</strong> trên trình duyệt này. Sau đó, hoặc khi dùng thiết bị khác, bạn
          đăng nhập bằng mật khẩu vừa đặt để tải lại tài liệu.
        </p>
        <p className="mt-1">
          <Link
            href={resendHref}
            className={`inline-flex min-h-11 items-center rounded font-medium text-[color:var(--color-primary)] underline underline-offset-2 ${FOCUS}`}
          >
            Chưa nhận được email? Gửi lại email kích hoạt
          </Link>
        </p>
      </div>
    </section>
  );
}

/** Khối lưu ý vàng nhỏ (§7.1) dưới thông tin chuyển khoản. */
export function CautionNote({ children, icon }: { children: ReactNode; icon: ReactNode }) {
  return (
    <div className="flex gap-2.5 rounded-xl border border-l-4 p-3.5 text-sm leading-relaxed" style={{ background: brandColors.accentSoft, borderColor: brandColors.accent, color: INK }}>
      <span aria-hidden="true" className="mt-0.5 shrink-0">
        {icon}
      </span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

// ───────────────────────── Thanh hành động dính đáy (mobile) ─────────────────────────

/**
 * Thanh dính đáy dưới `lg`: trái "Tổng" + số tiền, phải đúng một hành động chính. Không hook → dùng được trong cả Server
 * lẫn Client Component (component cha có state đặt nút của mình vào `children`). Safe area iOS qua `env()`.
 */
export function MobileActionBar({ totalVnd, children }: { totalVnd: number; children: ReactNode }) {
  return (
    <div
      className="checkout-action-bar fixed inset-x-0 bottom-0 z-10 border-t bg-white px-4 pt-3 shadow-[0_-8px_24px_-12px_rgba(18,33,58,0.25)] lg:hidden"
      style={{ borderColor: LINE, paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="shrink-0 leading-tight">
          <span className="block text-xs" style={{ color: INK_SOFT }}>
            Tổng
          </span>
          <span className="text-lg font-bold tabular-nums">{formatVnd(totalVnd)}</span>
        </p>
        <div className="flex min-w-0 flex-1 justify-end">{children}</div>
      </div>
    </div>
  );
}

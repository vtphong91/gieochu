import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { brandColors } from "@gieochu/config/theme";
import { requireCheckoutAccess } from "../../../../lib/page-guards";
import { getCheckoutView, type CheckoutView } from "../../../../lib/checkout-view";
import { EmptyState } from "../../../admin/_ui/kit";
import { IconCard, IconChevronDown, IconExternalLink } from "../../../admin/_ui/icons";
import { CheckoutPoll } from "./checkout-poll";
import { CouponPanel } from "./coupon-panel";
import {
  CheckoutStatusBadge,
  FOCUS,
  GHOST_BTN,
  GuestActivationNotice,
  MobileActionBar,
  PAYMENT_HEADING_ID,
  PRIMARY_BTN,
  ProgressTimeline,
  StateNotice,
  SummaryCard,
  SummaryStrip,
} from "./_ui/checkout-parts";
import { deadlineInfo, formatDateTime, formatHoldDeadline, formatVnd, STATUS_STEP } from "./_ui/format";
import { CancelOrderAction, DeclarePaidAction, UndoDeclarePaidAction } from "./_ui/order-actions";
import { PaymentInstructions } from "./_ui/payment-instructions";
import { PaymentMethodPanel } from "./_ui/payment-method-panel";

/*
 * Trang thanh toán đơn tài liệu (ADR-062). Dữ liệu duy nhất: `getCheckoutView` (server tính sẵn `displayStatus` và các quyền
 * `can.*` — UI chỉ ẩn/hiện, server Action kiểm lại). Bố cục: 1 cột dưới `lg` (QR trong màn đầu, thanh hành động dính đáy),
 * 2 cột từ `lg` (`minmax(0,1fr) 22rem`, cột phải dính). Khung header/footer + `container-page` ở `layout.tsx`.
 *
 * Khách vãng lai trước khi có đơn: trang riêng `../(chua-co-don)/page.tsx` (`?tai-lieu=`), cùng khung + mảnh `_ui`. Sau khi tạo đơn, phiên
 * khách vãng lai thấy `GuestActivationNotice` ở đầu cột trái.
 */

const INK = brandColors.ink;
const INK_SOFT = brandColors.inkSoft;
const LINE = brandColors.line;
const LINK = `inline-flex min-h-11 items-center gap-1 rounded font-medium text-[color:var(--color-primary)] underline underline-offset-2 ${FOCUS}`;

/** Câu đọc cho trình đọc màn hình khi trạng thái đổi (ADR-062 §4.8). */
function statusMessage(view: CheckoutView): string {
  const { order } = view;
  const label = view.enabledProviders.find((p) => p.id === order.provider)?.label;
  switch (order.displayStatus) {
    case "AWAITING_PAYMENT":
      return order.provider && order.checkout
        ? `Đang thanh toán bằng ${label ?? "cách đã chọn"}. Thông tin chuyển khoản đã cập nhật.`
        : "Đơn đang chờ bạn chọn cách thanh toán.";
    case "AWAITING_SELLER_CONFIRM":
      return "Đã ghi nhận bạn báo đã chuyển khoản. Đang chờ người bán xác nhận.";
    case "PAID":
      return "Đã nhận thanh toán. Bạn có thể tải tài liệu.";
    case "EXPIRED":
      return "Đơn đã hết hạn.";
    case "CANCELED":
      return "Đơn đã huỷ.";
    case "REFUNDED":
      return "Đơn đã được hoàn tiền.";
  }
}

/** Nút chính dạng link — cột phải (từ lg) + thanh dính đáy (mobile). */
function LinkPrimary({ href, label, totalVnd, external }: { href: string; label: string; totalVnd: number; external?: boolean }) {
  // Link ngoài (cổng MoMo API) dùng <a> thường — không prefetch/điều hướng client tới domain khác.
  const anchor = (className: string, withIcon: boolean) =>
    external ? (
      <a href={href} className={className} style={{ background: "var(--color-primary)" }}>
        {label}
        {withIcon ? <IconExternalLink className="h-4 w-4" /> : null}
      </a>
    ) : (
      <Link href={href} className={className} style={{ background: "var(--color-primary)" }}>
        {label}
      </Link>
    );
  return (
    <>
      <div className="hidden lg:block">{anchor(`${PRIMARY_BTN} w-full`, true)}</div>
      <MobileActionBar totalVnd={totalVnd}>{anchor(`${PRIMARY_BTN} w-full max-w-64 px-4 text-[15px]`, false)}</MobileActionBar>
    </>
  );
}

/** Không có nút chính (chờ tự động / chờ người bán): câu trạng thái ngắn — vẫn giữ thanh đáy để tổng tiền luôn thấy. */
function WaitingPrimary({ text, totalVnd, spinner }: { text: string; totalVnd: number; spinner?: boolean }) {
  const content = (
    <span className="inline-flex items-center gap-2 text-sm font-medium" style={{ color: INK }}>
      {spinner ? (
        <span
          aria-hidden="true"
          className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-t-transparent motion-reduce:animate-none"
          style={{ borderColor: "var(--color-primary)", borderTopColor: "transparent" }}
        />
      ) : null}
      {text}
    </span>
  );
  return (
    <>
      <div className="hidden rounded-xl border px-4 py-3 lg:block" style={{ borderColor: LINE, background: brandColors.surface }}>
        {content}
      </div>
      <MobileActionBar totalVnd={totalVnd}>
        <span className="text-right">{content}</span>
      </MobileActionBar>
    </>
  );
}

function PrimaryAction({ view }: { view: CheckoutView }): ReactNode {
  const { order, item, tenant, links } = view;
  const total = order.totalVnd;
  switch (order.displayStatus) {
    case "AWAITING_PAYMENT": {
      if (!order.provider || !order.checkout) return null; // PaymentMethodPanel tự có nút "Tiếp tục thanh toán".
      if (order.can.declarePaid) return <DeclarePaidAction tenantSlug={tenant.slug} orderCode={order.code} totalVnd={total} />;
      if (order.checkout.kind === "REDIRECT") return <LinkPrimary href={order.checkout.url} label="Mở trang thanh toán" totalVnd={total} external />;
      return <WaitingPrimary text="Đang chờ ngân hàng báo về…" totalVnd={total} spinner />;
    }
    case "AWAITING_SELLER_CONFIRM":
      return <WaitingPrimary text="Đang chờ người bán xác nhận" totalVnd={total} />;
    case "PAID":
      return <LinkPrimary href={links.library} label="Tải tài liệu" totalVnd={total} />;
    case "EXPIRED":
    case "CANCELED":
      return item.stillPurchasable && item.productPath ? (
        <LinkPrimary href={item.productPath} label="Đặt lại đơn" totalVnd={total} />
      ) : (
        <LinkPrimary href={`/${tenant.slug}`} label="Về gian hàng" totalVnd={total} />
      );
    case "REFUNDED":
      return <LinkPrimary href={`/${tenant.slug}`} label="Về gian hàng" totalVnd={total} />;
  }
}

function SecondaryActions({ view }: { view: CheckoutView }) {
  const { order, tenant, links } = view;
  const items: ReactNode[] = [];
  if (order.can.undoDeclarePaid) items.push(<UndoDeclarePaidAction key="undo" tenantSlug={tenant.slug} orderCode={order.code} />);
  if (order.displayStatus === "AWAITING_PAYMENT") {
    items.push(
      <p key="later" className="text-sm leading-relaxed" style={{ color: INK_SOFT }}>
        <Link href={links.orders} className={LINK}>
          Để sau — xem lại trong Đơn hàng của tôi
        </Link>
        <span className="block">Đơn được giữ đến {formatHoldDeadline(order.expiresAt)}.</span>
      </p>,
    );
  } else if (order.displayStatus === "AWAITING_SELLER_CONFIRM") {
    items.push(
      <p key="orders" className="text-sm">
        <Link href={links.orders} className={LINK}>
          Đơn hàng của tôi
        </Link>
      </p>,
    );
  } else {
    items.push(
      <p key="shop" className="text-sm">
        <Link href={`/${tenant.slug}`} className={LINK}>
          Về gian hàng {tenant.name}
        </Link>
      </p>,
    );
  }
  if (order.can.cancel) items.push(<CancelOrderAction key="cancel" tenantSlug={tenant.slug} orderCode={order.code} />);
  return <div className="space-y-3 border-t pt-4 lg:border-t-0 lg:pt-0" style={{ borderColor: LINE }}>{items}</div>;
}

/** Cột trái: khối chính theo trạng thái. */
function MainState({ view }: { view: CheckoutView }) {
  const { order, item, tenant, enabledProviders } = view;
  const currentLabel = enabledProviders.find((p) => p.id === order.provider)?.label;

  switch (order.displayStatus) {
    case "AWAITING_PAYMENT": {
      const chosen = order.provider && order.checkout && order.confirmMode;
      if (!chosen && enabledProviders.length === 0) {
        return (
          <EmptyState
            icon={<IconCard className="h-6 w-6" />}
            title="Người bán chưa bật cách thanh toán nào"
            description={`Đơn của bạn vẫn được giữ đến ${formatHoldDeadline(order.expiresAt)}. Vui lòng quay lại sau.`}
            action={
              <Link href={`/${tenant.slug}`} className={GHOST_BTN} style={{ borderColor: LINE, color: INK }}>
                Về gian hàng
              </Link>
            }
          />
        );
      }
      if (!chosen) {
        return <PaymentMethodPanel tenantSlug={tenant.slug} orderCode={order.code} current={null} options={enabledProviders} canChange={order.can.changeProvider} totalVnd={order.totalVnd} />;
      }
      return (
        <>
          <PaymentMethodPanel
            tenantSlug={tenant.slug}
            orderCode={order.code}
            current={{ id: order.provider!, label: currentLabel ?? "Cách thanh toán đã chọn", confirmMode: order.confirmMode! }}
            options={enabledProviders}
            canChange={order.can.changeProvider}
            totalVnd={order.totalVnd}
          />
          <section aria-labelledby={PAYMENT_HEADING_ID} className="rounded-2xl border p-4 sm:p-5" style={{ borderColor: LINE }}>
            <PaymentInstructions view={view} />
          </section>
        </>
      );
    }

    case "AWAITING_SELLER_CONFIRM": {
      const holdPassed = deadlineInfo(order.expiresAt).passed;
      return (
        <>
          <StateNotice tone="info" title="Chờ người bán xác nhận">
            <p>
              Bạn đã báo chuyển khoản lúc <strong className="font-semibold">{order.customerDeclaredPaidAt ? formatDateTime(order.customerDeclaredPaidAt) : "—"}</strong>.
              Người bán sẽ đối chiếu giao dịch và xác nhận thủ công — bạn nhận email khi xong.
            </p>
            <p>
              {holdPassed
                ? "Đã quá hạn giữ đơn, nhưng vì bạn báo chuyển trước hạn nên người bán vẫn xác nhận được đơn này."
                : `Đơn được giữ đến ${formatHoldDeadline(order.expiresAt)}.`}
            </p>
          </StateNotice>
          {order.checkout ? (
            <details className="group rounded-2xl border" style={{ borderColor: LINE }}>
              <summary
                className={`flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-4 font-semibold [&::-webkit-details-marker]:hidden ${FOCUS}`}
              >
                Xem lại thông tin chuyển khoản
                <IconChevronDown className="h-5 w-5 shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none" />
              </summary>
              <div className="border-t p-4 sm:p-5" style={{ borderColor: LINE }}>
                <PaymentInstructions view={view} headingLevel={3} />
              </div>
            </details>
          ) : null}
        </>
      );
    }

    case "PAID":
      return (
        <StateNotice tone="success" title="Thanh toán thành công">
          <p className="font-semibold [overflow-wrap:anywhere]">{item.title}</p>
          <p>
            {order.paidAt ? `Thanh toán lúc ${formatDateTime(order.paidAt)} · ` : ""}
            <span className="tabular-nums">{formatVnd(order.totalVnd)}</span>
          </p>
          <p>Tài liệu đã nằm trong Thư viện của bạn — bấm “Tải tài liệu” để tải xuống.</p>
        </StateNotice>
      );

    case "EXPIRED":
      return (
        <StateNotice tone="warning" title="Đơn đã hết hạn">
          <p>Đơn đã hết hạn lúc {formatDateTime(order.expiresAt)}. Mã QR và thông tin chuyển khoản không còn dùng được.</p>
          <p>
            <strong className="font-semibold">Nếu bạn đã chuyển tiền</strong>, hãy giữ lại mã đơn <strong className="font-semibold">{order.code}</strong> để đối chiếu
            với người bán.
          </p>
          {item.stillPurchasable ? null : <p>Tài liệu này hiện không còn bán.</p>}
        </StateNotice>
      );

    case "CANCELED":
      return (
        <StateNotice tone="neutral" title="Đơn đã huỷ">
          <p>Đơn này đã bị huỷ, mã QR không còn dùng được.</p>
          {item.stillPurchasable ? <p>Bạn có thể đặt lại đơn mới từ trang tài liệu.</p> : <p>Tài liệu này hiện không còn bán.</p>}
        </StateNotice>
      );

    case "REFUNDED":
      return (
        <StateNotice tone="neutral" title="Đơn đã được hoàn tiền">
          <p>Quyền tải tài liệu của đơn này đã thu hồi.</p>
        </StateNotice>
      );
  }
}

export default async function CheckoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string; orderCode: string }>;
  searchParams: Promise<{ "vua-tao"?: string }>;
}) {
  const { tenantSlug, orderCode } = await params;
  const sp = await searchParams;
  // ADR-061 Q1: đã xác minh HOẶC phiên khách vãng lai.
  const user = await requireCheckoutAccess(`/${tenantSlug}/checkout/${orderCode}`);
  const view = await getCheckoutView(user, orderCode, { justCreated: sp["vua-tao"] === "1" });
  if (!view || view.tenant.slug !== tenantSlug) notFound();

  const { order, tenant } = view;
  const status = order.displayStatus;
  const waiting = status === "AWAITING_PAYMENT" || status === "AWAITING_SELLER_CONFIRM";
  const hold = deadlineInfo(order.expiresAt);

  return (
    <>
      <CheckoutPoll active={waiting} statusKey={`${status}:${order.provider ?? "-"}`} message={statusMessage(view)} />

      <nav aria-label="Đường dẫn" className="mb-1">
        <ol className="flex flex-wrap items-center gap-x-1 text-sm" style={{ color: INK_SOFT }}>
          <li>
            <Link href={`/${tenant.slug}`} className={`inline-flex min-h-11 items-center rounded-full pr-1 font-medium hover:text-[color:var(--color-primary)] hover:underline ${FOCUS}`}>
              <span aria-hidden="true">←&nbsp;</span>
              {tenant.name}
            </Link>
          </li>
        </ol>
      </nav>

      <header>
        <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold [overflow-wrap:anywhere] sm:text-3xl">Thanh toán đơn {order.code}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
          <CheckoutStatusBadge status={status} />
          <span style={{ color: INK_SOFT }}>Bước {STATUS_STEP[status]}/4</span>
          {waiting && !hold.passed ? (
            <span style={{ color: INK }}>
              Giữ đơn đến <strong className="font-semibold">{formatHoldDeadline(order.expiresAt)}</strong>
              {hold.underOneDay ? <span style={{ color: INK_SOFT }}> (còn dưới 1 ngày)</span> : null}
            </span>
          ) : null}
        </div>
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-8">
        <div className="min-w-0 space-y-5">
          <SummaryStrip view={view} />
          {/* ADR-061 Q1 — phiên khách vãng lai (tài khoản chưa kích hoạt): nổi bật ngay sau khi vừa tạo (`?vua-tao=1`). */}
          {view.viewer.guestSession ? (
            <GuestActivationNotice email={view.viewer.email} prominent={view.viewer.justCreated} resendHref="/verify-email?pending=1" />
          ) : null}
          <MainState view={view} />
        </div>

        <aside aria-label="Đơn hàng và tiến độ" className="min-w-0 space-y-5 lg:sticky lg:top-[112px]">
          <SummaryCard view={view} />
          <PrimaryAction view={view} />
          {order.can.applyCoupon ? (
            <details className="group rounded-2xl border" style={{ borderColor: LINE }} open={Boolean(order.couponCode)}>
              <summary
                className={`flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-4 text-sm font-semibold [&::-webkit-details-marker]:hidden ${FOCUS}`}
              >
                {order.couponCode ? `Mã giảm giá: ${order.couponCode}` : "Có mã giảm giá?"}
                <IconChevronDown className="h-5 w-5 shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none" />
              </summary>
              <div className="border-t px-4 pt-3 pb-4" style={{ borderColor: LINE }}>
                <CouponPanel
                  tenantSlug={tenant.slug}
                  orderCode={order.code}
                  appliedCode={order.couponCode}
                  hasQrCheckout={order.checkout?.kind === "QR" || (order.checkout?.kind === "WALLET" && order.checkout.qr !== null)}
                />
              </div>
            </details>
          ) : null}
          <ProgressTimeline view={view} />
          <SecondaryActions view={view} />
        </aside>
      </div>
    </>
  );
}

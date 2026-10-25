import { notFound } from "next/navigation";
import Link from "next/link";
import { AppError } from "@gieochu/core";
import type { CheckoutResult } from "@gieochu/payments";
import { brandColors } from "@gieochu/config/theme";
import { requireVerifiedAccess } from "../../../../lib/page-guards";
import { getOrderForCustomer } from "../../../../lib/order";
import { getBankByBin, getEnabledProviders } from "../../../../lib/tenant-payment";
import { SiteFooter } from "../../../_ui/site-footer";
import { SiteHeader } from "../../../_ui/site-header";
import { systemFontVars } from "../../../_ui/system-fonts";
import { BankTransferPanel } from "../../../_ui/bank-transfer-panel";
import { CheckoutPoll } from "./checkout-poll";
import { CouponPanel } from "./coupon-panel";
import { ProviderPanel } from "./provider-panel";
import { DISPLAY_TIME_ZONE } from "@gieochu/core/system-settings";

// ADR-025: checkout là trang HỆ THỐNG — màu lấy từ token hệ thống như trang chi tiết tài liệu.
const INK = brandColors.ink;
const INK_SOFT = brandColors.inkSoft;
const LINE = brandColors.line;
const BLUE = brandColors.primary;
const AMBER = brandColors.accent;
const ACCENT_SOFT = brandColors.accentSoft;
const GREEN = brandColors.secondary;
/** Nền nhạt của secondary; chữ trên nền này dùng INK (tương phản AA), viền mang sắc trạng thái. */
const GREEN_SOFT = `color-mix(in srgb, ${GREEN} 10%, white)`;

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Chờ thanh toán",
  PAID: "Đã thanh toán",
  FULFILLED: "Hoàn tất — tài liệu đã sẵn sàng",
  EXPIRED: "Đã hết hạn",
  CANCELED: "Đã huỷ",
  REFUNDED: "Đã hoàn tiền",
};

function formatVnDateTime(date: Date): string {
  return date.toLocaleString("vi-VN", { timeZone: DISPLAY_TIME_ZONE });
}

export default async function CheckoutPage({ params }: { params: Promise<{ tenantSlug: string; orderCode: string }> }) {
  const { tenantSlug, orderCode } = await params;
  const user = await requireVerifiedAccess(`/${tenantSlug}/checkout/${orderCode}`);

  let order;
  try {
    order = await getOrderForCustomer(user.userId, orderCode);
  } catch (error) {
    if (error instanceof AppError && error.httpStatus === 404) notFound();
    throw error;
  }
  if (order.tenant.slug !== tenantSlug) notFound();

  const isPending = order.status === "PENDING";
  const isPaidOrFulfilled = order.status === "PAID" || order.status === "FULFILLED";
  const enabledProviders = isPending && !order.provider ? await getEnabledProviders(order.tenantId) : [];
  const checkout = order.checkoutPayload as CheckoutResult | null;
  // Tên ngân hàng từ bảng L1 `bank_bins` theo BIN trong checkoutPayload; không tìm thấy → không truyền (dòng "Ngân hàng" tự ẩn).
  const bank = isPending && checkout?.kind === "QR" ? await getBankByBin(checkout.bank.bin) : null;

  // ADR-025: checkout là trang hệ thống — bọc header/footer + font hệ thống, nội dung giữ container-narrow.
  return (
    <div className={`${systemFontVars} flex min-h-dvh flex-col bg-white font-[family-name:var(--font-body)]`} style={{ color: INK }}>
      <a
        href="#noi-dung"
        className="sr-only z-30 rounded-full bg-white px-5 py-3 font-semibold text-[color:var(--color-primary)] shadow-lg focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Bỏ qua tới nội dung chính
      </a>

      <SiteHeader />

      <main id="noi-dung" tabIndex={-1} className="container-narrow flex-1 py-10 outline-none">
        <CheckoutPoll active={isPending} />

        <nav aria-label="Đường dẫn" className="mb-2">
          <ol className="flex flex-wrap items-center gap-x-1 text-sm" style={{ color: INK_SOFT }}>
            <li>
              <Link
                href={`/${order.tenant.slug}`}
                className="inline-flex min-h-11 items-center rounded-full pr-1 font-medium hover:text-[color:var(--color-primary)] hover:underline"
              >
                <span aria-hidden="true">←&nbsp;</span>
                {order.tenant.name}
              </Link>
            </li>
          </ol>
        </nav>

        <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold [overflow-wrap:anywhere]">Đơn hàng {order.code}</h1>
        <p className="mt-1 text-sm" style={{ color: INK_SOFT }}>
          <span className="sr-only">Trạng thái: </span>
          {STATUS_LABEL[order.status] ?? order.status}
        </p>

        <section className="mt-6 rounded-xl border p-4" style={{ borderColor: LINE }}>
          <ul className="space-y-1 text-sm">
            {order.items.map((item) => (
              <li key={item.id} className="flex justify-between gap-4">
                <span className="min-w-0 [overflow-wrap:anywhere]">{item.titleSnapshot}</span>
                <span className="shrink-0 tabular-nums">{item.finalPriceVnd.toLocaleString("vi-VN")}đ</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 space-y-1 border-t pt-3 text-sm" style={{ borderColor: LINE }}>
            <div className="flex justify-between" style={{ color: INK_SOFT }}>
              <span>Tạm tính</span>
              <span>{order.subtotalVnd.toLocaleString("vi-VN")}đ</span>
            </div>
            {order.discountVnd > 0 ? (
              <div className="flex justify-between" style={{ color: INK_SOFT }}>
                <span>Giảm giá</span>
                <span>-{order.discountVnd.toLocaleString("vi-VN")}đ</span>
              </div>
            ) : null}
            <div className="flex justify-between text-base font-semibold">
              <span>Tổng cộng</span>
              <span>{order.totalVnd.toLocaleString("vi-VN")}đ</span>
            </div>
          </div>
        </section>

        {isPending ? (
          <section className="mt-4">
            <CouponPanel tenantSlug={tenantSlug} orderCode={orderCode} appliedCode={order.couponCode} hasQrCheckout={checkout?.kind === "QR"} />
          </section>
        ) : null}

        {isPending ? (
          <section className="mt-6 rounded-xl border p-4" style={{ borderColor: LINE }}>
            {checkout ? (
              checkout.kind === "QR" ? (
                <div>
                  <h2 className="font-[family-name:var(--font-heading)] text-lg font-semibold">Thanh toán chuyển khoản</h2>
                  <div className="mt-2">
                    <BankTransferPanel
                      {...(bank ? { bank } : {})}
                      qrImageDataUrl={checkout.qrImageDataUrl}
                      accountNo={checkout.bank.accountNo}
                      accountName={checkout.bank.accountName}
                      amountVnd={order.totalVnd}
                      content={checkout.content}
                      referenceCode={order.code}
                      referenceNoun="đơn hàng"
                    />
                  </div>
                </div>
              ) : (
                <a href={checkout.url} className="flex min-h-11 items-center justify-center font-medium underline" style={{ color: BLUE }}>
                  Mở trang thanh toán
                </a>
              )
            ) : (
              <ProviderPanel tenantSlug={tenantSlug} orderCode={orderCode} enabledProviders={enabledProviders} />
            )}
            <p className="mt-3 text-center text-xs" style={{ color: INK_SOFT }}>Đơn hàng hết hạn lúc {formatVnDateTime(order.expiresAt)}</p>
          </section>
        ) : null}

        {isPaidOrFulfilled ? (
          <section
            className="mt-6 rounded-xl border border-l-4 p-4 text-sm"
            style={{ borderColor: GREEN, background: GREEN_SOFT, color: INK }}
          >
            <strong className="font-semibold">Thanh toán thành công.</strong>{" "}
            <Link href="/account/library" className="font-medium underline" style={{ color: BLUE }}>
              Xem tài liệu đã mua
            </Link>
          </section>
        ) : null}

        {order.status === "EXPIRED" ? (
          <section
            className="mt-6 rounded-xl border border-l-4 p-4 text-sm"
            style={{ borderColor: AMBER, background: ACCENT_SOFT, color: INK }}
          >
            <strong className="font-semibold">Đơn hàng đã hết hạn.</strong> Vui lòng đặt lại đơn hàng mới.
          </section>
        ) : null}
      </main>

      <SiteFooter />
    </div>
  );
}

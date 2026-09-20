import { notFound } from "next/navigation";
import Link from "next/link";
import { AppError } from "@gieochu/core";
import type { CheckoutResult } from "@gieochu/payments";
import { requireVerifiedAccess } from "../../../../lib/page-guards";
import { getOrderForCustomer } from "../../../../lib/order";
import { getEnabledProviders } from "../../../../lib/tenant-payment";
import { CheckoutPoll } from "./checkout-poll";
import { CouponPanel } from "./coupon-panel";
import { ProviderPanel } from "./provider-panel";

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Chờ thanh toán",
  PAID: "Đã thanh toán",
  FULFILLED: "Hoàn tất — tài liệu đã sẵn sàng",
  EXPIRED: "Đã hết hạn",
  CANCELED: "Đã huỷ",
  REFUNDED: "Đã hoàn tiền",
};

function formatVnDateTime(date: Date): string {
  return date.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
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

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <CheckoutPoll active={isPending} />

      <h1 className="text-2xl font-bold">Đơn hàng {order.code}</h1>
      <p className="mt-1 text-sm text-gray-500">{STATUS_LABEL[order.status] ?? order.status}</p>

      <section className="mt-6 rounded border p-4">
        <ul className="space-y-1 text-sm">
          {order.items.map((item) => (
            <li key={item.id} className="flex justify-between">
              <span>{item.titleSnapshot}</span>
              <span>{item.finalPriceVnd.toLocaleString("vi-VN")}đ</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 space-y-1 border-t pt-3 text-sm">
          <div className="flex justify-between text-gray-500">
            <span>Tạm tính</span>
            <span>{order.subtotalVnd.toLocaleString("vi-VN")}đ</span>
          </div>
          {order.discountVnd > 0 ? (
            <div className="flex justify-between text-gray-500">
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
          <CouponPanel tenantSlug={tenantSlug} orderCode={orderCode} appliedCode={order.couponCode} />
        </section>
      ) : null}

      {isPending ? (
        <section className="mt-6 rounded border p-4">
          {checkout ? (
            checkout.kind === "QR" ? (
              <div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={checkout.qrImageDataUrl} alt="QR thanh toán" className="mx-auto h-48 w-48" />
                <p className="mt-2 text-center text-sm">
                  {checkout.bank.accountName} — {checkout.bank.accountNo}
                </p>
                <p className="text-center text-sm text-gray-500">Nội dung: {checkout.content}</p>
              </div>
            ) : (
              <a href={checkout.url} className="block text-center text-[var(--color-primary)] underline">
                Mở trang thanh toán
              </a>
            )
          ) : (
            <ProviderPanel tenantSlug={tenantSlug} orderCode={orderCode} enabledProviders={enabledProviders} />
          )}
          <p className="mt-3 text-center text-xs text-gray-400">Đơn hàng hết hạn lúc {formatVnDateTime(order.expiresAt)}</p>
        </section>
      ) : null}

      {isPaidOrFulfilled ? (
        <section className="mt-6 rounded border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          Thanh toán thành công.{" "}
          <Link href="/account/library" className="underline">
            Xem tài liệu đã mua
          </Link>
        </section>
      ) : null}

      {order.status === "EXPIRED" ? (
        <section className="mt-6 rounded border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Đơn hàng đã hết hạn. Vui lòng đặt lại đơn hàng mới.
        </section>
      ) : null}
    </main>
  );
}

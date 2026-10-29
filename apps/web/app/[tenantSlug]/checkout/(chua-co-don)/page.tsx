import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { brandColors } from "@gieochu/config/theme";
import { getCurrentUser } from "../../../../lib/session";
import { getGuestCheckoutView } from "../../../../lib/checkout-view";
import { FOCUS, PreOrderProgress, PreOrderSummary } from "../[orderCode]/_ui/checkout-parts";
import { GuestCheckoutForm } from "../_ui/guest-checkout-form";

export const metadata: Metadata = { title: "Thanh toán", robots: { index: false, follow: false } };

/**
 * ADR-062 Q2 — trang thanh toán của khách vãng lai TRƯỚC khi có đơn: `/{tenantSlug}/checkout?tai-lieu={productSlug}`. Đơn chỉ
 * được tạo khi khách bấm "Tiếp tục thanh toán" (`startGuestCheckoutAction`). Đã đăng nhập → quay về trang tài liệu để "Mua ngay"
 * (luồng thường). Route group `(chua-co-don)` chỉ để `loading.tsx`/`error.tsx` riêng của trang này không bọc trang đơn (URL không
 * đổi). Khung header/footer + `container-page` ở `../layout.tsx` (chung với trang đơn).
 *
 * Bố cục theo wireframe §3.5 — giống trang đơn: dưới `lg` 1 cột (dải tóm tắt → form) + thanh dính đáy "Tổng · Tiếp tục thanh
 * toán"; từ `lg` 2 cột `minmax(0,1fr) 22rem`, cột phải dính (tóm tắt, nút chính, tiến độ bước 1/4). Mã giảm giá chỉ áp được khi đã có đơn → câu dẫn dưới khối phương thức.
 */
export default async function GuestCheckoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<{ "tai-lieu"?: string }>;
}) {
  const { tenantSlug } = await params;
  const productSlug = (await searchParams)["tai-lieu"]?.trim();
  if (!productSlug) notFound();
  const view = await getGuestCheckoutView(tenantSlug, productSlug);
  if (!view) notFound();
  if (await getCurrentUser()) redirect(view.item.productPath);

  const { item, tenant } = view;
  const summaryItem = { title: item.title, productPath: item.productPath, typeLabel: item.typeLabel, coverUrl: item.coverUrl };
  const autoOnly = view.enabledProviders.length > 0 && view.enabledProviders.every((p) => p.confirmMode === "AUTO");

  return (
    <>
      <nav aria-label="Đường dẫn" className="mb-1">
        <ol className="flex flex-wrap items-center gap-x-1 text-sm" style={{ color: brandColors.inkSoft }}>
          <li>
            <Link
              href={`/${tenant.slug}`}
              className={`inline-flex min-h-11 items-center rounded-full pr-1 font-medium hover:text-[color:var(--color-primary)] hover:underline ${FOCUS}`}
            >
              <span aria-hidden="true">←&nbsp;</span>
              {tenant.name}
            </Link>
          </li>
        </ol>
      </nav>

      <header>
        <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold sm:text-3xl">Thanh toán</h1>
        <p className="mt-2 text-sm" style={{ color: brandColors.inkSoft }}>
          Bước 1/4 · Thông tin và cách thanh toán
        </p>
      </header>

      <GuestCheckoutForm
        tenantSlug={tenant.slug}
        productSlug={item.productSlug}
        productPath={item.productPath}
        providers={view.enabledProviders}
        totalVnd={item.priceVnd}
        links={view.links}
        resendHref="/verify-email?pending=1"
        mobileSummary={<PreOrderSummary item={summaryItem} totalVnd={item.priceVnd} variant="strip" />}
        sideSummary={<PreOrderSummary item={summaryItem} totalVnd={item.priceVnd} variant="card" />}
        progress={<PreOrderProgress hasAutoOnly={autoOnly} />}
      />
    </>
  );
}

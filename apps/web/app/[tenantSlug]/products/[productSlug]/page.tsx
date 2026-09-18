import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { calculateOrderPricing } from "@gieochu/core";
import { findTenantBySlugForStorefront, getPublishedProductBySlug } from "../../../../lib/storefront";
import { getSystemStorageConfig } from "../../../../lib/system-storage";
import { getCurrentUser } from "../../../../lib/session";
import { BuyButton } from "./buy-button";

const TYPE_LABEL: Record<string, string> = {
  PDF: "Tài liệu PDF",
  DOCX: "Tài liệu Word",
  XLSX: "Bảng tính",
  PPTX: "Bài trình chiếu",
  ZIP: "Bộ tài liệu (ZIP)",
  OTHER: "Tài liệu",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tenantSlug: string; productSlug: string }>;
}): Promise<Metadata> {
  const { tenantSlug, productSlug } = await params;
  const tenant = await findTenantBySlugForStorefront(tenantSlug);
  if (!tenant) return {};
  const product = await getPublishedProductBySlug(tenant.id, productSlug);
  if (!product) return {};
  return { title: `${product.title} — ${tenant.name}`, description: product.description ?? undefined };
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; productSlug: string }>;
}) {
  const { tenantSlug, productSlug } = await params;
  const tenant = await findTenantBySlugForStorefront(tenantSlug);
  if (!tenant || tenant.status === "LOCKED") notFound();

  const product = await getPublishedProductBySlug(tenant.id, productSlug);
  if (!product) notFound();

  const currentUser = await getCurrentUser();
  const isOwner = currentUser?.userId === tenant.ownerId;

  const pricing = calculateOrderPricing(
    [
      {
        productId: product.id,
        title: product.title,
        priceVnd: product.priceVnd,
        salePriceVnd: product.salePriceVnd,
        saleStartsAt: product.saleStartsAt,
        saleEndsAt: product.saleEndsAt,
      },
    ],
    null,
    0,
    new Date(),
  );
  const effectivePriceVnd = pricing.lines[0]?.finalPriceVnd ?? product.priceVnd;
  const onSale = effectivePriceVnd < product.priceVnd;

  const storageConfig = await getSystemStorageConfig();
  const publicBaseUrl = storageConfig?.publicConfig.publicBaseUrl;
  const coverUrl = product.coverImageKey && publicBaseUrl ? `${publicBaseUrl}/${product.coverImageKey}` : null;

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <a href={`/${tenant.slug}`} className="text-sm text-gray-500 underline">
        ← {tenant.name}
      </a>

      {coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={coverUrl} alt={product.title} className="mt-4 w-full rounded border object-cover" />
      ) : null}

      <p className="mt-4 text-sm text-gray-500">{TYPE_LABEL[product.type] ?? product.type}</p>
      <h1 className="mt-1 text-3xl font-bold">{product.title}</h1>

      {product.description ? <p className="mt-4 whitespace-pre-line text-gray-700">{product.description}</p> : null}

      <div className="mt-6 flex items-baseline gap-3">
        <span className="text-2xl font-bold text-[var(--color-primary)]">{effectivePriceVnd.toLocaleString("vi-VN")}đ</span>
        {onSale ? <span className="text-sm text-gray-400 line-through">{product.priceVnd.toLocaleString("vi-VN")}đ</span> : null}
      </div>

      <div className="mt-6">
        {isOwner ? (
          <p className="text-sm text-gray-500">Đây là sản phẩm của bạn.</p>
        ) : tenant.status !== "ACTIVE" ? (
          <p className="text-sm text-amber-700">Trang tạm ngưng bán — chưa thể mua lúc này.</p>
        ) : (
          <BuyButton tenantSlug={tenant.slug} productId={product.id} productSlug={product.slug} loggedIn={Boolean(currentUser)} />
        )}
      </div>
    </main>
  );
}

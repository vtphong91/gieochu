import { defaultStorefrontSections } from "@gieochu/core";
import { requireTenantMemberPage } from "../../../../lib/page-guards";
import { listStorefrontProductOptions, resolveStorefrontSectionsDraft } from "../../../../lib/storefront";
import { isSystemCloudinaryReady } from "../../../../lib/system-cloudinary";
import { listStorefrontReviewOptions } from "../../../../lib/review";
import { AdminPageHeader } from "../../../admin/_ui/kit";
import { StorefrontEditor, type ReviewPinOption } from "./storefront-editor";

const EXCERPT_MAX = 80;

/** Trích 1 dòng nội dung đánh giá cho ô chọn ghim. */
function excerpt(body: string | null): string | null {
  const text = body?.replace(/\s+/g, " ").trim() ?? "";
  if (!text) return null;
  const chars = Array.from(text);
  return chars.length > EXCERPT_MAX ? `${chars.slice(0, EXCERPT_MAX - 1).join("").trimEnd()}…` : text;
}

export default async function StudioStorefrontPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;
  const { tenant } = await requireTenantMemberPage(tenantSlug, `/studio/${tenantSlug}/storefront`);

  const resolved = resolveStorefrontSectionsDraft(tenant);
  const [products, reviews, cloudinaryReady] = await Promise.all([
    listStorefrontProductOptions(tenant.id),
    listStorefrontReviewOptions(tenant.id),
    isSystemCloudinaryReady(),
  ]);
  // ADR-029: chỉ gửi sang client những gì ô "ghim đánh giá" cần (nội dung rút gọn).
  const reviewOptions: ReviewPinOption[] = reviews.map((r) => ({
    id: r.id,
    rating: r.rating,
    displayName: r.displayName,
    excerpt: excerpt(r.body),
    productTitle: r.productTitle,
  }));

  return (
    <main className="px-5 py-8 lg:px-8">
      <AdminPageHeader title="Trang bán hàng" subtitle="Sửa nội dung từng phần trên trang của bạn. Lưu nháp trước, bấm Xuất bản khi sẵn sàng." />
      <StorefrontEditor
        tenantSlug={tenant.slug}
        initialSections={resolved.sections}
        live={resolved.live}
        defaults={defaultStorefrontSections({ tenantName: tenant.name, bio: tenant.bio })}
        hasDraft={resolved.source === "draft"}
        products={products}
        reviewOptions={reviewOptions}
        cloudinaryReady={cloudinaryReady}
      />
    </main>
  );
}

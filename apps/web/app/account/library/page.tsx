import Link from "next/link";
import { productPath } from "@gieochu/core/product-path";
import { requireVerifiedAccess } from "../../../lib/page-guards";
import { listLibraryEntitlements } from "../../../lib/library";
import { IconStar } from "../../[tenantSlug]/_ui/icons";
import { PRODUCT_REVIEWS_ANCHOR } from "../../[tenantSlug]/_ui/product-reviews";
import { DownloadButton } from "./download-button";

const REVIEW_LINK =
  "inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold text-[var(--color-primary)] transition-colors hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)] motion-reduce:transition-none";

/**
 * ADR-029: lối vào đánh giá của 1 mục thư viện — dẫn tới khối "Đánh giá" trên trang tài liệu (form viết/sửa nằm ở
 * đó, một chỗ duy nhất). Chưa viết → "Viết đánh giá"; đã viết → "Sửa đánh giá" kèm số sao; bị ẩn → nhãn chữ.
 */
function ReviewEntry({ href, canReview, review }: { href: string; canReview: boolean; review: { rating: number; status: "VISIBLE" | "HIDDEN" } | null }) {
  if (!review) {
    if (!canReview) return null;
    return (
      <Link href={href} className={REVIEW_LINK}>
        <IconStar filled={false} className="h-4 w-4" />
        Viết đánh giá
      </Link>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link href={href} className={REVIEW_LINK}>
        {canReview ? "Sửa đánh giá" : "Xem đánh giá"}
        <span className="inline-flex items-center gap-0.5 text-amber-700" aria-hidden="true">
          <IconStar filled className="h-4 w-4" />
          {review.rating}
        </span>
        <span className="sr-only">(bạn đã chấm {review.rating} trên 5 sao)</span>
      </Link>
      {review.status === "HIDDEN" ? (
        <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-900">Đánh giá đã bị ẩn</span>
      ) : null}
    </div>
  );
}

/** §"M9": entitlements from every tenant, grouped by tenant. */
export default async function LibraryPage() {
  const user = await requireVerifiedAccess("/account/library");
  const groups = await listLibraryEntitlements(user.userId);

  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Thư viện của bạn</h1>
        <Link href="/account/orders" className="text-sm text-[var(--color-primary)] underline">
          Lịch sử đơn hàng
        </Link>
      </div>

      {groups.length === 0 ? (
        <p className="mt-4 text-gray-600">Bạn chưa có tài liệu nào.</p>
      ) : (
        groups.map((group) => (
          <section key={group.tenantId} className="mt-8">
            <h2 className="text-lg font-semibold">{group.tenantName}</h2>
            <ul className="mt-3 space-y-3">
              {group.entitlements.map((entitlement) => {
                const unlimited = entitlement.downloadLimit === 0;
                const remaining = unlimited ? null : Math.max(0, entitlement.downloadLimit - entitlement.downloadsUsed);
                const blocked = entitlement.revoked || (!unlimited && remaining === 0);
                return (
                  <li key={entitlement.entitlementId} className="rounded border p-4">
                    <div className="flex items-center justify-between">
                      <Link href={productPath(group.tenantSlug, entitlement.productSlug)} className="font-medium hover:underline">
                        {entitlement.productTitle}
                      </Link>
                      <span className="text-xs text-gray-500">
                        {entitlement.revoked ? "Đã thu hồi" : unlimited ? "Không giới hạn lượt tải" : `Còn ${remaining} lượt tải`}
                      </span>
                    </div>
                    <ul className="mt-2 space-y-2">
                      {entitlement.files.map((file) => (
                        <li key={file.id} className="flex items-center justify-between text-sm">
                          <span>{file.fileName}</span>
                          <DownloadButton
                            fileId={file.id}
                            disabled={blocked}
                            label={file.kind === "EXTERNAL_URL" ? "Mở link tài liệu" : undefined}
                          />
                        </li>
                      ))}
                    </ul>
                    {entitlement.review || entitlement.canReview ? (
                      <div className="mt-3 border-t pt-3">
                        <ReviewEntry
                          href={`${productPath(group.tenantSlug, entitlement.productSlug)}#${PRODUCT_REVIEWS_ANCHOR}`}
                          canReview={entitlement.canReview}
                          review={entitlement.review}
                        />
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
    </main>
  );
}

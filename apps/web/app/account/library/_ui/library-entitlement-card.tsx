import Link from "next/link";
import { brandColors } from "@gieochu/config/theme";
import { productPath } from "@gieochu/core/product-path";
import { remedyDownloadBlock } from "@gieochu/core/entitlement-remedy";
import type { LibraryEntitlement } from "../../../../lib/library";
import { IconStar } from "../../../[tenantSlug]/_ui/icons";
import { PRODUCT_REVIEWS_ANCHOR } from "../../../[tenantSlug]/_ui/product-reviews";
import { DownloadButton } from "../download-button";
import { LIBRARY_FOCUS } from "./confirm-dialog";
import { RemedyNotice } from "./remedy-notice";

/*
 * Một mục trong Thư viện (Server Component, không hook). ADR-039: tài liệu bị gỡ do vi phạm hiện khối `RemedyNotice`
 * (chọn tải lần cuối / yêu cầu hoàn tiền / trạng thái đã chọn) phía trên danh sách tệp; nút tải bị khoá theo
 * `remedyDownloadBlock`. Thu hồi ưu tiên hơn mọi trạng thái remedy — trừ REFUNDED (hoàn tiền luôn kèm thu hồi, nhãn
 * "Đã hoàn tiền" nói rõ lý do hơn).
 */

const REVIEW_LINK = `inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold text-[var(--color-primary)] transition-colors hover:bg-gray-50 motion-reduce:transition-none ${LIBRARY_FOCUS}`;

type PillTone = "neutral" | "warning" | "info" | "danger";
const PILL_STYLE: Record<PillTone, { background: string; color: string; borderColor: string }> = {
  neutral: { background: "#F3F4F6", color: "#4B5563", borderColor: "#E5E7EB" },
  warning: { background: "#FFFBEB", color: "#92400E", borderColor: "#FDE68A" },
  info: { background: brandColors.surface, color: brandColors.primary, borderColor: "#BFDBFE" },
  danger: { background: "#FEF2F2", color: "#B91C1C", borderColor: "#FCA5A5" },
};

/** ADR-029: lối vào đánh giá — dẫn tới khối "Đánh giá" trên trang tài liệu. */
function ReviewEntry({ href, canReview, review }: { href: string; canReview: boolean; review: LibraryEntitlement["review"] }) {
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

function statusPill(entitlement: LibraryEntitlement, remaining: number | null): { label: string; tone: PillTone } {
  const { remedyStatus, revoked } = entitlement;
  if (remedyStatus === "REFUNDED") return { label: "Đã hoàn tiền", tone: "neutral" };
  if (revoked) return { label: "Đã thu hồi", tone: "neutral" };
  if (remedyStatus === "PENDING_CHOICE") return { label: "Cần bạn lựa chọn", tone: "warning" };
  if (remedyStatus === "REFUND_REQUESTED") return { label: "Đã yêu cầu hoàn tiền", tone: "info" };
  if (remedyStatus === "FINAL_DOWNLOAD") {
    return remaining && remaining > 0 ? { label: `Còn ${remaining} lượt tải cuối`, tone: "warning" } : { label: "Đã dùng lượt tải cuối", tone: "neutral" };
  }
  if (remaining === null) return { label: "Không giới hạn lượt tải", tone: "info" };
  return remaining > 0 ? { label: `Còn ${remaining} lượt tải`, tone: "info" } : { label: "Hết lượt tải", tone: "neutral" };
}

export function LibraryEntitlementCard({ entitlement, tenantName, tenantSlug }: { entitlement: LibraryEntitlement; tenantName: string; tenantSlug: string }) {
  const unlimited = entitlement.downloadLimit === 0;
  const remaining = unlimited ? null : Math.max(0, entitlement.downloadLimit - entitlement.downloadsUsed);
  const remedyBlocked = remedyDownloadBlock(entitlement.remedyStatus) !== null;
  const blocked = entitlement.revoked || remedyBlocked || (!unlimited && remaining === 0);
  const isFinal = !entitlement.revoked && entitlement.remedyStatus === "FINAL_DOWNLOAD";
  const showRemedy = entitlement.remedyStatus !== "NONE" && (!entitlement.revoked || entitlement.remedyStatus === "REFUNDED");
  const pill = statusPill(entitlement, remaining);
  const href = productPath(tenantSlug, entitlement.productSlug);
  const multiFile = entitlement.files.length > 1;

  return (
    <li className="rounded-2xl border bg-white p-4 sm:p-5" style={{ borderColor: "#E5E7EB" }}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <h3 className="min-w-0 font-semibold [overflow-wrap:anywhere]">
          <Link href={href} className={`rounded hover:underline ${LIBRARY_FOCUS}`}>
            {entitlement.productTitle}
          </Link>
        </h3>
        <span
          className="inline-flex w-fit shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap"
          style={PILL_STYLE[pill.tone]}
        >
          {pill.label}
        </span>
      </div>

      {showRemedy ? (
        <div className="mt-3">
          <RemedyNotice
            entitlementId={entitlement.entitlementId}
            status={entitlement.remedyStatus as Exclude<LibraryEntitlement["remedyStatus"], "NONE">}
            productTitle={entitlement.productTitle}
            tenantName={tenantName}
            orderCode={entitlement.orderCode}
            refundAvailable={entitlement.refundAvailable}
            remedyChosenAt={entitlement.remedyChosenAt}
            remaining={remaining ?? 0}
            finalDownloadFileCount={entitlement.finalDownloadFileCount}
            remedyResolvedAt={entitlement.remedyResolvedAt}
          />
        </div>
      ) : null}

      {entitlement.files.length > 0 ? (
        <ul className="mt-3 divide-y" style={{ borderColor: "#E5E7EB" }} aria-label={`Tệp của ${entitlement.productTitle}`}>
          {entitlement.files.map((file) => (
            <li key={file.id} className="flex flex-col gap-2 py-2.5 text-sm first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4" style={{ borderColor: "#E5E7EB" }}>
              <span className="min-w-0 [overflow-wrap:anywhere]">{file.fileName}</span>
              <DownloadButton
                fileId={file.id}
                disabled={blocked}
                label={file.kind === "EXTERNAL_URL" ? (isFinal ? "Mở link lần cuối" : "Mở link tài liệu") : isFinal ? "Tải lần cuối" : "Tải xuống"}
                fileName={multiFile ? file.fileName : undefined}
                finalDownload={isFinal && !blocked ? { productTitle: entitlement.productTitle } : undefined}
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-gray-600">Tài liệu chưa có tệp tải xuống.</p>
      )}

      {entitlement.review || entitlement.canReview ? (
        <div className="mt-3 border-t pt-3" style={{ borderColor: "#E5E7EB" }}>
          <ReviewEntry href={`${href}#${PRODUCT_REVIEWS_ANCHOR}`} canReview={entitlement.canReview} review={entitlement.review} />
        </div>
      ) : null}
    </li>
  );
}

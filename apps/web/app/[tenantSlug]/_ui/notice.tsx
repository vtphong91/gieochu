import { IconInfo, IconLockClosed } from "./icons";

/**
 * Thanh thông báo trạng thái gian hàng (kết quả resolveStorefrontAccess) —
 * nằm ngay dưới header hệ thống (ADR-025), không sticky. Có icon + chữ, không truyền đạt chỉ bằng màu.
 */
export function StorefrontNotice({ kind }: { kind: "READ_ONLY" | "LOCKED_NOTICE" }) {
  const readOnly = kind === "READ_ONLY";
  return (
    <div
      className={
        readOnly
          ? "border-b border-amber-200 bg-amber-50 text-amber-900"
          : "border-b border-red-200 bg-red-50 text-red-900"
      }
    >
      <p className="container-page flex items-start gap-2.5 py-3 text-sm font-medium sm:items-center">
        {readOnly ? (
          <IconInfo className="mt-0.5 h-5 w-5 shrink-0 sm:mt-0" />
        ) : (
          <IconLockClosed className="mt-0.5 h-5 w-5 shrink-0 sm:mt-0" />
        )}
        {readOnly
          ? "Trang tạm ngưng bán — chỉ xem, chưa mua được."
          : "Trang của bạn đang bị khoá. Liên hệ hỗ trợ để biết thêm chi tiết."}
      </p>
    </div>
  );
}

/**
 * Chỉ chủ tenant thấy (isDemo && isOwner): trang đang dùng nội dung mẫu — kèm link
 * sang Studio để chỉnh. Khách không thấy thanh này (và không thấy đánh giá mẫu).
 */
export function StorefrontDemoBanner({ studioHref }: { studioHref: string }) {
  return (
    <div className="border-b border-sky-200 bg-sky-50 text-sky-950">
      <p className="container-page flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-sm font-medium">
        <IconInfo className="h-5 w-5 shrink-0" />
        <span>Nội dung mẫu — chỉ bạn thấy thanh này và phần đánh giá mẫu.</span>
        <a href={studioHref} className="inline-flex min-h-11 items-center font-bold underline underline-offset-2 hover:no-underline sm:min-h-0">
          Vào Studio › Trang bán hàng để chỉnh
        </a>
      </p>
    </div>
  );
}

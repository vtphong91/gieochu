import Link from "next/link";
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
          ? "Gian hàng của bạn đang tạm ngưng hoạt động — khách chỉ thấy thông báo tạm ngưng, không thấy tài liệu."
          : "Trang của bạn đang bị khoá. Liên hệ hỗ trợ để biết thêm chi tiết."}
      </p>
    </div>
  );
}

/**
 * ADR-040: khách vào gian hàng READ_ONLY chỉ thấy khối này (không tài liệu/bài viết/đánh giá). Là nội dung chính
 * của `<main>` nên mang h1 — tên gian hàng — để trang luôn có đúng 1 h1.
 */
export function StorefrontSuspendedNotice({ tenantName }: { tenantName: string }) {
  return (
    <section className="container-narrow py-16 text-center sm:py-24">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-amber-800">
        <IconInfo className="h-7 w-7" />
      </span>
      <h1 className="mt-5 text-2xl font-bold text-slate-900">{tenantName}</h1>
      <p className="mt-3 text-base font-medium text-amber-900">Gian hàng đang tạm ngưng hoạt động.</p>
      <p className="mt-2 text-sm text-slate-600">
        Tài liệu của gian hàng tạm thời không hiển thị. Nếu bạn đã mua tài liệu, bạn vẫn tải được trong Thư viện của mình.
      </p>
      <Link
        href="/account/library"
        className="mt-6 inline-flex min-h-11 items-center justify-center rounded-full border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-900 transition hover:border-[color:var(--color-primary)] hover:text-[color:var(--color-primary)] motion-reduce:transition-none"
      >
        Mở Thư viện của tôi
      </Link>
    </section>
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

import { AdminPageHeader } from "../../admin/_ui/kit";

/** Trạng thái đang tải của Thư viện — khung xương giữ chỗ (không nhảy bố cục), tôn trọng giảm chuyển động. */
export default function LibraryLoading() {
  return (
    <div aria-busy="true">
      <AdminPageHeader title="Thư viện của bạn" />
      <p className="sr-only" role="status">
        Đang tải thư viện...
      </p>
      <div className="mt-8" aria-hidden="true">
        <div className="h-5 w-40 animate-pulse rounded bg-gray-200 motion-reduce:animate-none" />
        {/* Cùng lưới với trang thật (2 cột từ xl) để không nhảy bố cục. */}
        <div className="mt-3 grid gap-3 xl:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl border bg-white p-5" style={{ borderColor: "#E5E7EB" }}>
              <div className="h-4 w-2/3 animate-pulse rounded bg-gray-200 motion-reduce:animate-none" />
              <div className="mt-4 h-9 w-full animate-pulse rounded-full bg-gray-100 motion-reduce:animate-none" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

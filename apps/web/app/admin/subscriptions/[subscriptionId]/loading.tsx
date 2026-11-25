/**
 * Khung chờ `/admin/subscriptions/[subscriptionId]` (ADR-069): tiêu đề + thẻ thông tin thuê bao + bảng hoá đơn + nhật ký.
 * Nhấp nháy tắt khi giảm chuyển động. Wrapper <div>: layout admin đã có <main>.
 */
function Block({ className }: { className: string }) {
  return <div className={`rounded-lg bg-gray-200/80 ${className}`} />;
}

export default function Loading() {
  return (
    <div className="px-5 py-8 lg:px-8" aria-busy="true">
      <p className="sr-only" role="status">
        Đang tải chi tiết đơn hàng gói...
      </p>
      <div className="animate-pulse motion-reduce:animate-none" aria-hidden="true">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Block className="h-8 w-72 max-w-full" />
            <Block className="mt-3 h-4 w-[28rem] max-w-full" />
          </div>
          <Block className="h-11 w-48 lg:h-10" />
        </div>
        <div className="mt-6 space-y-8">
          <div>
            <Block className="mb-3 h-6 w-48" />
            <div className="grid gap-4 rounded-2xl border bg-white p-5 sm:grid-cols-2 sm:p-6 lg:grid-cols-3" style={{ borderColor: "#E5E7EB" }}>
              {Array.from({ length: 6 }, (_, i) => (
                <Block key={i} className="h-10 w-full" />
              ))}
            </div>
          </div>
          <div>
            <Block className="mb-3 h-6 w-56" />
            <div className="space-y-3 rounded-2xl border bg-white p-5" style={{ borderColor: "#E5E7EB" }}>
              {Array.from({ length: 4 }, (_, i) => (
                <Block key={i} className="h-10 w-full" />
              ))}
            </div>
          </div>
          <div>
            <Block className="mb-3 h-6 w-44" />
            <div className="space-y-3 rounded-2xl border bg-white p-5" style={{ borderColor: "#E5E7EB" }}>
              {Array.from({ length: 3 }, (_, i) => (
                <Block key={i} className="h-12 w-full" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Khung chờ dashboard Tổng quan gian hàng (ADR-043): cùng khung với trang thật (tiêu đề, chip kỳ, 4 KPI + 3 thẻ phụ,
 * biểu đồ + top 5, bảng đơn) để không nhảy layout. `motion-reduce:animate-none` tôn trọng prefers-reduced-motion.
 * Wrapper là <div>: layout Studio đã có <main>.
 */
function Block({ className }: { className: string }) {
  return <div className={`rounded-lg bg-gray-200/80 ${className}`} />;
}

const CARD = "rounded-2xl border border-gray-200 bg-white";

export function StudioDashboardSkeleton() {
  return (
    <div className="px-5 py-8 lg:px-8" aria-busy="true">
      <p className="sr-only" role="status">
        Đang tải số liệu gian hàng…
      </p>
      <div className="animate-pulse space-y-8 motion-reduce:animate-none" aria-hidden="true">
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
          <div>
            <Block className="h-8 w-56 max-w-full" />
            <Block className="mt-2 h-4 w-40" />
          </div>
          <Block className="h-4 w-36" />
        </div>
        <div className="space-y-3">
          <Block className="h-6 w-60 max-w-full" />
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 8 }, (_, i) => (
              <Block key={i} className="h-11 w-24 rounded-full lg:h-9" />
            ))}
          </div>
          <Block className="h-11 w-full rounded-xl" />
        </div>
        <div className="space-y-4">
          <Block className="h-6 w-28" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className={`${CARD} p-5`}>
                <div className="flex justify-between">
                  <Block className="h-4 w-28" />
                  <Block className="h-10 w-10 rounded-full" />
                </div>
                <Block className="mt-1 h-7 w-32" />
                <Block className="mt-3 h-3.5 w-full" />
                <Block className="mt-3 h-3.5 w-40 max-w-full" />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className={`${CARD} flex gap-3 p-4`}>
                <Block className="h-9 w-9 shrink-0 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Block className="h-4 w-32" />
                  <Block className="h-5 w-20" />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className={`${CARD} p-5 sm:p-6 xl:col-span-2`}>
            <Block className="h-5 w-48" />
            <Block className="mt-5 h-48 w-full" />
            <Block className="mt-8 h-28 w-full" />
            <Block className="mt-5 h-11 w-full" />
          </div>
          <div className={`${CARD} p-5 sm:p-6`}>
            <Block className="h-5 w-48 max-w-full" />
            {Array.from({ length: 5 }, (_, i) => (
              <Block key={i} className="mt-5 h-10 w-full" />
            ))}
          </div>
        </div>
        <div className={`${CARD} space-y-3 p-4`}>
          {Array.from({ length: 6 }, (_, i) => (
            <Block key={i} className="h-6 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}

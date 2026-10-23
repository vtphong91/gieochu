/**
 * ADR-048 — khung chờ trang Khách hàng: cùng khung với trang thật (5 thẻ thống kê, thanh lọc, bảng/thẻ) để không nhảy
 * layout. `motion-reduce:animate-none` tôn trọng prefers-reduced-motion. Wrapper là <div>: layout Studio đã có <main>.
 * File riêng (không import loader) để `loading.tsx` nhẹ.
 */
function Block({ className }: { className: string }) {
  return <div className={`rounded-lg bg-gray-200/80 ${className}`} />;
}

const CARD = "rounded-2xl border border-gray-200 bg-white";

export function CustomerListSkeleton() {
  return (
    <div className="px-5 py-8 lg:px-8" aria-busy="true">
      <p className="sr-only" role="status">
        Đang tải danh sách khách hàng…
      </p>
      <div className="animate-pulse motion-reduce:animate-none" aria-hidden="true">
        <Block className="h-8 w-40" />
        <Block className="mt-2 h-4 w-[30rem] max-w-full" />
        <Block className="mt-6 h-5 w-48" />
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className={`${CARD} p-5`}>
              <div className="flex items-start justify-between">
                <Block className="h-4 w-28" />
                <Block className="h-10 w-10 rounded-full" />
              </div>
              <Block className="mt-1 h-7 w-32" />
              <Block className="mt-2 h-3 w-40 max-w-full" />
              <Block className="mt-3 h-3 w-full" />
            </div>
          ))}
        </div>
        <div className={`${CARD} mt-6 space-y-4 p-4 sm:p-5`}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Block className="h-4 w-28" />
              <Block className="mt-1.5 h-11 w-full" />
            </div>
            <Block className="h-11 w-full sm:w-20" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i}>
                <Block className="h-4 w-24" />
                <Block className="mt-1.5 h-11 w-full" />
              </div>
            ))}
          </div>
        </div>
        <Block className="mt-6 h-5 w-32" />
        <div className={`${CARD} mt-3 hidden xl:block`}>
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="flex items-center gap-6 border-b border-gray-100 px-4 py-4 last:border-0">
              <Block className="h-9 flex-1" />
              <Block className="h-4 w-12" />
              <Block className="h-4 w-24" />
              <Block className="h-4 w-20" />
              <Block className="h-8 w-24" />
              <Block className="h-8 w-24" />
              <Block className="h-8 w-8" />
            </div>
          ))}
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:hidden">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className={`${CARD} p-4`}>
              <div className="flex justify-between gap-2">
                <div className="flex-1">
                  <Block className="h-5 w-40 max-w-full" />
                  <Block className="mt-1.5 h-3 w-48 max-w-full" />
                </div>
                <Block className="h-11 w-11" />
              </div>
              <div className="mt-3 grid grid-cols-3 gap-3 border-t border-gray-100 pt-3">
                {Array.from({ length: 3 }, (_, j) => (
                  <Block key={j} className="h-9 w-full" />
                ))}
              </div>
              <div className="mt-2.5 grid grid-cols-2 gap-3">
                <Block className="h-9 w-full" />
                <Block className="h-9 w-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

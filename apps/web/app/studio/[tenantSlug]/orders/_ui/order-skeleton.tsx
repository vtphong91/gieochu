/**
 * ADR-046 — khung chờ trang Đơn hàng (danh sách + chi tiết): cùng khung với trang thật để không nhảy layout.
 * `motion-reduce:animate-none` tôn trọng prefers-reduced-motion. Wrapper là <div>: layout Studio đã có <main>.
 * File riêng (không import loader) để `loading.tsx` nhẹ.
 */
function Block({ className }: { className: string }) {
  return <div className={`rounded-lg bg-gray-200/80 ${className}`} />;
}

const CARD = "rounded-2xl border border-gray-200 bg-white";

export function OrderListSkeleton() {
  return (
    <div className="px-5 py-8 lg:px-8" aria-busy="true">
      <p className="sr-only" role="status">
        Đang tải danh sách đơn hàng…
      </p>
      <div className="animate-pulse motion-reduce:animate-none" aria-hidden="true">
        <Block className="h-8 w-40" />
        <Block className="mt-2 h-4 w-[30rem] max-w-full" />
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
              <Block className="h-4 w-24" />
              <Block className="h-8 w-20" />
              <Block className="h-8 flex-1" />
              <Block className="h-4 w-40" />
              <Block className="h-4 w-20" />
              <Block className="h-5 w-24 rounded-full" />
              <Block className="h-8 w-8" />
            </div>
          ))}
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:hidden">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className={`${CARD} p-4`}>
              <div className="flex justify-between">
                <Block className="h-5 w-28" />
                <Block className="h-11 w-11" />
              </div>
              <Block className="mt-3 h-4 w-40" />
              <Block className="mt-2 h-4 w-56 max-w-full" />
              <div className="mt-3 flex justify-between border-t border-gray-100 pt-3">
                <Block className="h-5 w-24 rounded-full" />
                <Block className="h-5 w-20" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function OrderDetailSkeleton() {
  return (
    <div className="px-5 py-8 lg:px-8" aria-busy="true">
      <p className="sr-only" role="status">
        Đang tải đơn hàng…
      </p>
      <div className="animate-pulse motion-reduce:animate-none" aria-hidden="true">
        <Block className="h-5 w-40" />
        <Block className="mt-4 h-8 w-64 max-w-full" />
        <Block className="mt-2 h-4 w-52" />
        <div className="mt-6 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-6">
            <div className={`${CARD} p-5`}>
              <Block className="h-6 w-36" />
              <div className="mt-4 grid gap-6 lg:grid-cols-2">
                <div className="space-y-3">
                  {Array.from({ length: 5 }, (_, i) => (
                    <Block key={i} className="h-4 w-full" />
                  ))}
                </div>
                <div className="space-y-3">
                  <Block className="h-4 w-24" />
                  <Block className="h-4 w-full" />
                  <Block className="h-4 w-3/4" />
                </div>
              </div>
            </div>
            <div className={`${CARD} p-5`}>
              <Block className="h-6 w-44" />
              <Block className="mt-4 h-14 w-full" />
              <Block className="mt-3 ml-auto h-16 w-full max-w-sm" />
            </div>
          </div>
          <div className="space-y-6">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className={`${CARD} p-5`}>
                <Block className="h-6 w-32" />
                <Block className="mt-4 h-11 w-full" />
                <Block className="mt-3 h-4 w-3/4" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

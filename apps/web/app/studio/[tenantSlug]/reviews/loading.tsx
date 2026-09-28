/**
 * Khung chờ Studio → Đánh giá: cùng khung với page (tiêu đề, form lọc, thẻ đánh giá) để không nhảy layout.
 * `motion-reduce:animate-none` tôn trọng prefers-reduced-motion. Wrapper là <div>: layout Studio đã có <main>.
 */
function Block({ className }: { className: string }) {
  return <div className={`rounded-lg bg-gray-200/80 ${className}`} />;
}

export default function Loading() {
  return (
    <div className="px-5 py-8 lg:px-8" aria-busy="true">
      <p className="sr-only" role="status">
        Đang tải đánh giá...
      </p>
      <div className="animate-pulse motion-reduce:animate-none" aria-hidden="true">
        <Block className="h-8 w-40" />
        <Block className="mt-3 h-4 w-[32rem] max-w-full" />
        <div className="mt-6 grid gap-3 rounded-2xl border bg-white p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-4" style={{ borderColor: "#E5E7EB" }}>
          {Array.from({ length: 4 }, (_, i) => (
            <Block key={i} className="h-11 w-full" />
          ))}
        </div>
        <div className="mt-5 space-y-3">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="rounded-2xl border bg-white p-4 sm:p-5" style={{ borderColor: "#E5E7EB" }}>
              <div className="flex items-start gap-3">
                <Block className="h-10 w-10 shrink-0 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Block className="h-4 w-48 max-w-full" />
                  <Block className="h-3 w-64 max-w-full" />
                </div>
              </div>
              <div className="mt-4 space-y-2 sm:pl-[52px]">
                <Block className="h-4 w-28" />
                <Block className="h-4 w-full" />
                <Block className="h-4 w-2/3" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

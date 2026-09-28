/**
 * Khung chờ Studio → Bài viết: cùng khung với page (tiêu đề + nút, tab trạng thái, thẻ bài) để không nhảy layout.
 * `motion-reduce:animate-none` tôn trọng prefers-reduced-motion. Wrapper là <div>: layout Studio đã có <main>.
 */
function Block({ className }: { className: string }) {
  return <div className={`rounded-lg bg-gray-200/80 ${className}`} />;
}

export default function Loading() {
  return (
    <div className="px-5 py-8 lg:px-8" aria-busy="true">
      <p className="sr-only" role="status">
        Đang tải bài viết...
      </p>
      <div className="animate-pulse motion-reduce:animate-none" aria-hidden="true">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Block className="h-8 w-36" />
            <Block className="mt-3 h-4 w-[32rem] max-w-full" />
          </div>
          <Block className="h-10 w-28" />
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Block key={i} className="h-11 w-24 lg:h-9" />
          ))}
        </div>
        <div className="mt-5 space-y-3">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="rounded-2xl border bg-white p-4 sm:p-5" style={{ borderColor: "#E5E7EB" }}>
              <Block className="h-5 w-24 rounded-full" />
              <Block className="mt-3 h-5 w-80 max-w-full" />
              <Block className="mt-2 h-4 w-full" />
              <Block className="mt-1.5 h-4 w-2/3" />
              <div className="mt-4 flex gap-2 border-t pt-3" style={{ borderColor: "#E5E7EB" }}>
                <Block className="h-11 w-20 lg:h-8" />
                <Block className="h-11 w-20 lg:h-8" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

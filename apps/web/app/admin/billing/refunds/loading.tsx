/** Khung chờ `/admin/billing/refunds`: tiêu đề + bộ lọc + 2 thẻ yêu cầu. Nhấp nháy tắt khi giảm chuyển động. Wrapper <div>: layout admin đã có <main>. */
function Block({ className }: { className: string }) {
  return <div className={`rounded-lg bg-gray-200/80 ${className}`} />;
}

export default function Loading() {
  return (
    <div className="px-5 py-8 lg:px-8" aria-busy="true">
      <p className="sr-only" role="status">
        Đang tải yêu cầu hoàn tiền...
      </p>
      <div className="animate-pulse motion-reduce:animate-none" aria-hidden="true">
        <Block className="h-8 w-64" />
        <Block className="mt-3 h-4 w-[36rem] max-w-full" />
        <div className="mt-6 flex flex-wrap gap-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Block key={i} className="h-11 w-28 rounded-full lg:h-9" />
          ))}
        </div>
        <div className="mt-6 space-y-4">
          {Array.from({ length: 2 }, (_, i) => (
            <div key={i} className="rounded-2xl border bg-white p-5" style={{ borderColor: "#E5E7EB" }}>
              <Block className="h-5 w-48" />
              <div className="mt-4 grid gap-5 lg:grid-cols-2">
                <Block className="h-24 w-full" />
                <Block className="h-24 w-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

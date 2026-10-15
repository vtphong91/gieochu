/**
 * Khung chờ editor CMS Cửa hàng: cùng khung với page (tiêu đề, thanh trạng thái, danh sách khu vực + form) để không
 * nhảy layout. `motion-reduce:animate-none` tôn trọng prefers-reduced-motion. Wrapper là <div>: layout admin đã có <main>.
 */
function Block({ className }: { className: string }) {
  return <div className={`rounded-lg bg-gray-200/80 ${className}`} />;
}

export default function Loading() {
  return (
    <div className="px-5 py-8 lg:px-8" aria-busy="true">
      <p className="sr-only" role="status">
        Đang tải cấu hình trang Cửa hàng...
      </p>
      <div className="animate-pulse motion-reduce:animate-none" aria-hidden="true">
        <Block className="h-8 w-56" />
        <Block className="mt-3 h-4 w-[36rem] max-w-full" />
        <div className="mt-6 flex flex-col gap-3 border-y bg-white py-3 xl:flex-row xl:items-center xl:justify-between" style={{ borderColor: "#E5E7EB" }}>
          <div className="flex gap-2">
            <Block className="h-6 w-24 rounded-full" />
            <Block className="h-6 w-36 rounded-full" />
          </div>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 4 }, (_, i) => (
              <Block key={i} className="h-11 w-28 lg:h-10" />
            ))}
          </div>
        </div>
        <div className="mt-4 grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
          <div className="space-y-1.5 rounded-2xl border bg-white p-4" style={{ borderColor: "#E5E7EB" }}>
            <Block className="mb-3 h-3 w-32" />
            {Array.from({ length: 9 }, (_, i) => (
              <Block key={i} className="h-12 w-full rounded-xl" />
            ))}
          </div>
          <div className="space-y-4 rounded-2xl border bg-white p-5 sm:p-6" style={{ borderColor: "#E5E7EB" }}>
            <Block className="h-6 w-48" />
            <Block className="h-12 w-full" />
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="space-y-2">
                <Block className="h-4 w-32" />
                <Block className="h-11 w-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

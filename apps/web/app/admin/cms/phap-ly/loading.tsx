/**
 * Khung chờ editor "Chính sách sử dụng" (ADR-057 bổ sung): cùng khung với page (tiêu đề, hàng chọn văn bản, cột nội dung +
 * khối SEO thu gọn, sidebar Xuất bản) để không nhảy layout. `motion-reduce:animate-none` tôn trọng prefers-reduced-motion.
 * Wrapper là <div>: layout admin đã có <main>.
 */
function Block({ className }: { className: string }) {
  return <div className={`rounded-lg bg-gray-200/80 ${className}`} />;
}

const LINE = "#E5E7EB";

export default function Loading() {
  return (
    <div className="px-5 py-8 lg:px-8" aria-busy="true">
      <p className="sr-only" role="status">
        Đang tải chính sách...
      </p>
      <div className="animate-pulse motion-reduce:animate-none" aria-hidden="true">
        <Block className="h-8 w-80 max-w-full" />
        <Block className="mt-3 h-4 w-[36rem] max-w-full" />
        <div className="mt-6 flex flex-wrap gap-2">
          {Array.from({ length: 7 }, (_, i) => (
            <Block key={i} className="h-16 w-44 rounded-xl" />
          ))}
        </div>
        <div className="mt-6 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px] xl:gap-8">
          <div className="min-w-0 space-y-6">
            <div className="space-y-4 rounded-2xl border bg-white p-5 sm:p-6" style={{ borderColor: LINE }}>
              <Block className="h-6 w-56" />
              <Block className="h-3 w-80 max-w-full" />
              <Block className="h-96 w-full rounded-xl" />
            </div>
            <div className="rounded-2xl border bg-white p-5 sm:p-6" style={{ borderColor: LINE }}>
              <Block className="h-10 w-64 max-w-full" />
            </div>
          </div>
          <div className="space-y-4 rounded-2xl border bg-white p-5 sm:p-6" style={{ borderColor: LINE }}>
            <Block className="h-6 w-40" />
            <Block className="h-10 w-full" />
            <Block className="h-11 w-full" />
            <Block className="h-11 w-full" />
            <Block className="h-16 w-full" />
            <Block className="h-11 w-full" />
            <Block className="h-11 w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

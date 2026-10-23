/**
 * Khung chờ editor văn bản pháp lý (ADR-050): cùng khung với page (tiêu đề, ghi chú, danh sách phiên bản + bảng soạn) để
 * không nhảy layout. `motion-reduce:animate-none` tôn trọng prefers-reduced-motion. Wrapper là <div>: layout admin đã có <main>.
 */
function Block({ className }: { className: string }) {
  return <div className={`rounded-lg bg-gray-200/80 ${className}`} />;
}

const LINE = "#E5E7EB";

export default function Loading() {
  return (
    <div className="px-5 py-8 lg:px-8" aria-busy="true">
      <p className="sr-only" role="status">
        Đang tải văn bản pháp lý...
      </p>
      <div className="animate-pulse motion-reduce:animate-none" aria-hidden="true">
        <Block className="h-8 w-80 max-w-full" />
        <Block className="mt-3 h-4 w-[36rem] max-w-full" />
        <Block className="mt-6 h-16 w-full rounded-xl" />
        <div className="mt-6 grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
          <div className="space-y-2 rounded-2xl border bg-white p-4" style={{ borderColor: LINE }}>
            <Block className="mb-2 h-3 w-24" />
            <Block className="h-11 w-full" />
            {Array.from({ length: 3 }, (_, i) => (
              <Block key={i} className="h-20 w-full rounded-xl" />
            ))}
          </div>
          <div className="space-y-4 rounded-2xl border bg-white p-4 sm:p-6" style={{ borderColor: LINE }}>
            <Block className="h-6 w-56" />
            <Block className="h-3 w-80 max-w-full" />
            <Block className="h-72 w-full rounded-xl" />
            <Block className="h-11 w-full" />
            <Block className="h-40 w-full rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}

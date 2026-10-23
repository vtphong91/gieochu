/**
 * Khung chờ editor CMS menu header/footer (ADR-050): cùng khung với page (tiêu đề, ghi chú, thanh trạng thái, 3 card) để
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
        Đang tải cấu hình menu header và footer...
      </p>
      <div className="animate-pulse motion-reduce:animate-none" aria-hidden="true">
        <Block className="h-8 w-64" />
        <Block className="mt-3 h-4 w-[36rem] max-w-full" />
        <Block className="mt-6 h-14 w-full rounded-xl" />
        <div className="mt-4 flex flex-col gap-3 border-y bg-white py-3 2xl:flex-row 2xl:items-center 2xl:justify-between" style={{ borderColor: LINE }}>
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
        {[3, 1, 2].map((rows, card) => (
          <div key={card} className="mt-4 space-y-4 rounded-2xl border bg-white p-5 sm:p-6" style={{ borderColor: LINE }}>
            <div className="flex items-center gap-3">
              <Block className="h-10 w-10 rounded-xl" />
              <Block className="h-5 w-48" />
            </div>
            {Array.from({ length: rows }, (_, i) => (
              <div key={i} className="grid gap-3 rounded-xl border p-3 md:grid-cols-2" style={{ borderColor: LINE }}>
                <Block className="h-11 w-full" />
                <Block className="h-11 w-full" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

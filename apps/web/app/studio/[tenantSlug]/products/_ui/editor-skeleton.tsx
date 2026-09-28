/**
 * Khung chờ (loading.tsx) của editor Tạo/Sửa sản phẩm — cùng khung với ProductEditor (tối đa 1440px căn giữa,
 * cột chính + sidebar 360px từ xl, card xuất bản đầu sidebar) để không nhảy layout khi dữ liệu về.
 * `motion-reduce:animate-none` tôn trọng prefers-reduced-motion. Wrapper là <div>: layout Studio đã có <main>.
 */
function Block({ className }: { className: string }) {
  return <div className={`rounded-lg bg-gray-200/80 ${className}`} />;
}

function CardSkeleton({ lines }: { lines: number }) {
  return (
    <div className="rounded-2xl border bg-white p-5 sm:p-6" style={{ borderColor: "#E5E7EB" }}>
      <div className="flex items-center gap-3">
        <Block className="h-10 w-10 rounded-xl" />
        <Block className="h-5 w-40" />
      </div>
      <div className="mt-5 space-y-3">
        {Array.from({ length: lines }, (_, i) => (
          <Block key={i} className={i % 3 === 2 ? "h-10 w-2/3" : "h-10 w-full"} />
        ))}
      </div>
    </div>
  );
}

export function ProductEditorSkeleton({ label }: { label: string }) {
  return (
    <div className="px-5 pt-8 pb-12 lg:px-8" aria-busy="true">
      <p className="sr-only" role="status">
        {label}
      </p>
      <div className="mx-auto max-w-[1440px] animate-pulse motion-reduce:animate-none" aria-hidden="true">
        <Block className="h-8 w-72 max-w-full" />
        <Block className="mt-3 h-4 w-96 max-w-full" />
        <div className="mt-6 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px] xl:gap-8">
          <div className="min-w-0 space-y-6">
            <CardSkeleton lines={4} />
            <CardSkeleton lines={2} />
            <CardSkeleton lines={2} />
          </div>
          <div className="flex min-w-0 flex-col gap-6">
            <CardSkeleton lines={2} />
            <CardSkeleton lines={1} />
            {/* Card xuất bản: đầu sidebar từ xl, cuối form dưới xl — khớp ProductEditor. */}
            <div className="xl:order-first">
              <CardSkeleton lines={4} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

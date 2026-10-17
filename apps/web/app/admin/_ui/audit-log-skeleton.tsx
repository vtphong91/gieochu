/**
 * Khung chờ cho 2 trang nhật ký (ADR-037): cùng khung với trang thật (tiêu đề, form lọc, danh sách) để không nhảy
 * layout. `motion-reduce:animate-none` tôn trọng prefers-reduced-motion. Wrapper là <div>: app shell đã có <main>.
 * File riêng (không import loader) để `loading.tsx` nhẹ.
 */
function Block({ className }: { className: string }) {
  return <div className={`rounded-lg bg-gray-200/80 ${className}`} />;
}

export function AuditLogSkeleton({ label, fields }: { label: string; fields: number }) {
  return (
    <div className="px-5 py-8 lg:px-8" aria-busy="true">
      <p className="sr-only" role="status">
        {label}
      </p>
      <div className="animate-pulse motion-reduce:animate-none" aria-hidden="true">
        <Block className="h-8 w-56 max-w-full" />
        <Block className="mt-3 h-4 w-[32rem] max-w-full" />
        <div className="mt-6 rounded-2xl border bg-white p-4 sm:p-5" style={{ borderColor: "#E5E7EB" }}>
          <Block className="h-5 w-20" />
          <div className={`mt-3 grid gap-4 sm:grid-cols-2 ${fields > 4 ? "xl:grid-cols-3" : "xl:grid-cols-4"}`}>
            {Array.from({ length: fields }, (_, i) => (
              <div key={i}>
                <Block className="h-4 w-24" />
                <Block className="mt-1.5 h-11 w-full" />
              </div>
            ))}
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Block className="h-11 w-24" />
            <Block className="h-11 w-20" />
          </div>
        </div>
        <Block className="mt-8 h-5 w-24" />
        <div className="mt-3 space-y-3">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="rounded-2xl border bg-white p-4 sm:p-5" style={{ borderColor: "#E5E7EB" }}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 space-y-2">
                  <Block className="h-4 w-56 max-w-full" />
                  <Block className="h-5 w-20 rounded-full" />
                </div>
                <Block className="h-9 w-24 shrink-0" />
              </div>
              <div className="mt-4 flex items-center gap-2.5">
                <Block className="h-8 w-8 shrink-0 rounded-full" />
                <Block className="h-4 w-48 max-w-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Khung chờ `/admin/tenants/[tenantId]` (ADR-072): breadcrumb + tiêu đề/nút + 4 thẻ thông tin (2 cột từ xl) + số liệu + nội dung/vi phạm
 * + nhật ký. Nhấp nháy tắt khi giảm chuyển động. Wrapper <div>: layout admin đã có <main>.
 */
function Block({ className }: { className: string }) {
  return <div className={`rounded-lg bg-gray-200/80 ${className}`} />;
}

const CARD = "rounded-2xl border bg-white p-5 sm:p-6";
const LINE = { borderColor: "#E5E7EB" };

function SkeletonSection({ rows, tall = false }: { rows: number; tall?: boolean }) {
  return (
    <div>
      <Block className="mb-3 h-6 w-48" />
      <div className={`${CARD} space-y-3`} style={LINE}>
        {Array.from({ length: rows }, (_, i) => (
          <Block key={i} className={`${tall ? "h-12" : "h-8"} w-full`} />
        ))}
      </div>
    </div>
  );
}

export default function Loading() {
  return (
    <div className="px-5 py-8 lg:px-8" aria-busy="true">
      <p className="sr-only" role="status">
        Đang tải chi tiết gian hàng...
      </p>
      <div className="animate-pulse motion-reduce:animate-none" aria-hidden="true">
        <Block className="h-11 w-32 lg:h-9" />
        <div className="mt-1 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Block className="h-8 w-72 max-w-full" />
            <Block className="mt-3 h-4 w-56 max-w-full" />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Block className="h-11 w-full sm:w-44 lg:h-10" />
            <Block className="h-11 w-full sm:w-44 lg:h-10" />
          </div>
        </div>
        <div className="mt-6 space-y-8">
          <div className="grid items-start gap-8 xl:grid-cols-2">
            <SkeletonSection rows={3} />
            <SkeletonSection rows={2} />
            <SkeletonSection rows={3} />
            <SkeletonSection rows={1} />
          </div>
          <div>
            <Block className="mb-3 h-6 w-56" />
            <div className="grid gap-4 xl:grid-cols-2">
              <Block className="h-44 w-full rounded-2xl" />
              <Block className="h-44 w-full rounded-2xl" />
            </div>
          </div>
          <div className="grid items-start gap-8 xl:grid-cols-2">
            <SkeletonSection rows={3} />
            <SkeletonSection rows={3} />
          </div>
          <SkeletonSection rows={3} tall />
        </div>
      </div>
    </div>
  );
}

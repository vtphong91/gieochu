/**
 * Khung chờ `/admin/users/[userId]` (ADR-073): breadcrumb + tiêu đề/nút + hồ sơ & gian hàng/điều khoản (2 cột từ xl) + bảo mật & phiên +
 * nhật ký. Nhấp nháy tắt khi giảm chuyển động. Wrapper <div>: layout admin đã có <main>.
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
        Đang tải chi tiết người dùng...
      </p>
      <div className="animate-pulse motion-reduce:animate-none" aria-hidden="true">
        <Block className="h-11 w-32 lg:h-9" />
        <div className="mt-1 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
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
            <SkeletonSection rows={5} />
            <div className="space-y-8">
              <SkeletonSection rows={2} />
              <SkeletonSection rows={2} />
            </div>
          </div>
          <SkeletonSection rows={3} tall />
          <SkeletonSection rows={3} tall />
        </div>
      </div>
    </div>
  );
}

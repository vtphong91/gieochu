import { LINE } from "../_ui/catalog-parts";

/** Khối giữ chỗ; nhấp nháy chỉ khi người dùng không bật giảm chuyển động. */
function Bone({ className }: { className: string }) {
  return <div className={`rounded-md motion-safe:animate-pulse ${className}`} style={{ background: LINE }} />;
}

/**
 * Khung chờ `/pricing`: hero + 3 thẻ gói cùng kích thước gần với thật (tránh nhảy layout). Nằm trong layout nên header/footer
 * đã hiện. `role="status"` ẩn đọc "Đang tải bảng giá".
 */
export default function PricingLoading() {
  return (
    <div aria-busy="true">
      <p role="status" className="sr-only">
        Đang tải bảng giá…
      </p>
      <div aria-hidden="true">
        <section className="pt-12 pb-8 sm:pt-16">
          <div className="container-page flex flex-col items-center text-center">
            <Bone className="h-4 w-40" />
            <Bone className="mt-4 h-9 w-full max-w-[640px]" />
            <Bone className="mt-3 h-9 w-3/4 max-w-[480px]" />
            <Bone className="mt-5 h-4 w-full max-w-[560px]" />
            <Bone className="mt-8 h-12 w-72 rounded-full" />
          </div>
        </section>
        <section className="pb-14">
          <div className="container-page grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className={`rounded-3xl border bg-white p-6 ${i === 2 ? "hidden lg:block" : ""}`} style={{ borderColor: LINE }}>
                <Bone className="h-6 w-1/2" />
                <Bone className="mt-3 h-4 w-3/4" />
                <Bone className="mt-6 h-9 w-2/3" />
                <Bone className="mt-6 h-12 w-full rounded-full" />
                <div className="mt-6 space-y-3">
                  {Array.from({ length: 5 }, (_, j) => (
                    <Bone key={j} className="h-4 w-full" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

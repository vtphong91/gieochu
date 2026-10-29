/**
 * Đang tải trang thanh toán — khung xương đúng bố cục (đầu trang, dải tóm tắt, ô giữ chỗ QR 224×224, các dòng thông tin, cột
 * phải từ lg) để không nhảy bố cục. Tôn trọng giảm chuyển động. Header/footer do `../layout.tsx` (khung chung khu thanh toán) bọc.
 */
const PULSE = "animate-pulse rounded bg-gray-200 motion-reduce:animate-none";

export default function CheckoutLoading() {
  return (
    <div aria-busy="true">
      <p role="status" className="sr-only">
        Đang tải trang thanh toán...
      </p>
      <div aria-hidden="true">
        <div className={`h-4 w-32 ${PULSE}`} />
        <div className={`mt-4 h-8 w-72 max-w-full ${PULSE}`} />
        <div className="mt-3 flex gap-3">
          <div className={`h-7 w-36 rounded-full ${PULSE}`} />
          <div className={`h-7 w-48 ${PULSE}`} />
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-8">
          <div className="space-y-5">
            <div className="flex items-center gap-3 rounded-xl border border-gray-200 p-3 lg:hidden">
              <div className={`h-14 w-12 rounded-lg ${PULSE}`} />
              <div className={`h-4 flex-1 ${PULSE}`} />
            </div>
            <div className={`h-[72px] rounded-2xl ${PULSE}`} />
            <div className="rounded-2xl border border-gray-200 p-5">
              <div className={`h-6 w-48 ${PULSE}`} />
              <div className="mt-4 grid gap-5 sm:grid-cols-[14rem_minmax(0,1fr)]">
                <div className={`mx-auto h-56 w-56 rounded-lg ${PULSE}`} />
                <div className="space-y-3">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className={`h-14 rounded-xl ${PULSE}`} />
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="space-y-5">
            <div className={`hidden h-40 rounded-2xl lg:block ${PULSE}`} />
            <div className={`h-56 rounded-2xl ${PULSE}`} />
          </div>
        </div>
      </div>
    </div>
  );
}

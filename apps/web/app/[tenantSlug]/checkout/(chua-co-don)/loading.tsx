/**
 * Đang tải trang thanh toán của khách vãng lai (chưa có đơn, `?tai-lieu=`) — khung xương đúng bố cục §3.5 (đầu trang, dải tóm
 * tắt, form người mua, thẻ phương thức, cột phải từ lg) để không nhảy bố cục. Trang đơn có `loading.tsx` riêng trong
 * `[orderCode]/`. Tôn trọng giảm chuyển động.
 */
const PULSE = "animate-pulse rounded bg-gray-200 motion-reduce:animate-none";

export default function GuestCheckoutLoading() {
  return (
    <div aria-busy="true">
      <p role="status" className="sr-only">
        Đang tải trang thanh toán...
      </p>
      <div aria-hidden="true">
        <div className={`h-4 w-32 ${PULSE}`} />
        <div className={`mt-4 h-8 w-40 ${PULSE}`} />
        <div className={`mt-3 h-4 w-56 ${PULSE}`} />

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-8">
          <div className="space-y-5">
            <div className="flex items-center gap-3 rounded-xl border border-gray-200 p-3 lg:hidden">
              <div className={`h-14 w-12 rounded-lg ${PULSE}`} />
              <div className={`h-4 flex-1 ${PULSE}`} />
            </div>
            <div className="space-y-4 rounded-2xl border border-gray-200 p-5">
              <div className={`h-6 w-48 ${PULSE}`} />
              <div className={`h-11 rounded-xl ${PULSE}`} />
              <div className={`h-11 rounded-xl ${PULSE}`} />
            </div>
            <div className="space-y-2.5 rounded-2xl border border-gray-200 p-5">
              <div className={`h-6 w-40 ${PULSE}`} />
              {[0, 1].map((i) => (
                <div key={i} className={`h-16 rounded-xl ${PULSE}`} />
              ))}
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

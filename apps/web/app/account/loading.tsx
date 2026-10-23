/**
 * Đang tải — khu vực tài khoản (Tổng quan, Hồ sơ, Bảo mật, Đơn hàng). Khung xương giữ chỗ trong app shell (không nhảy
 * bố cục), tôn trọng giảm chuyển động. Thư viện có `loading.tsx` riêng.
 */
export default function AccountLoading() {
  return (
    <div aria-busy="true">
      <p className="sr-only" role="status">
        Đang tải trang tài khoản...
      </p>
      <div aria-hidden="true">
        <div className="h-8 w-56 animate-pulse rounded-lg bg-gray-200 motion-reduce:animate-none" />
        {/* Lưới giống trang thật: 2 thẻ cạnh nhau từ xl + 1 thẻ trải hết hàng dưới (Hồ sơ, Bảo mật). */}
        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className={`rounded-2xl border bg-white p-5 sm:p-6 ${i === 2 ? "xl:col-span-2" : ""}`} style={{ borderColor: "#E5E7EB" }}>
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 shrink-0 animate-pulse rounded-full bg-gray-200 motion-reduce:animate-none" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-1/2 animate-pulse rounded bg-gray-200 motion-reduce:animate-none" />
                  <div className="h-3 w-1/3 animate-pulse rounded bg-gray-100 motion-reduce:animate-none" />
                </div>
              </div>
              <div className="mt-5 h-10 w-full animate-pulse rounded-lg bg-gray-100 motion-reduce:animate-none" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

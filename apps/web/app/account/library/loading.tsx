/** Trạng thái đang tải của Thư viện — khung xương giữ chỗ (không nhảy bố cục), tôn trọng giảm chuyển động. */
export default function LibraryLoading() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:py-16" aria-busy="true">
      <h1 className="text-2xl font-bold">Thư viện của bạn</h1>
      <p className="sr-only" role="status">
        Đang tải thư viện...
      </p>
      <div className="mt-8 space-y-3" aria-hidden="true">
        <div className="h-5 w-40 animate-pulse rounded bg-gray-200 motion-reduce:animate-none" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-2xl border bg-white p-5" style={{ borderColor: "#E5E7EB" }}>
            <div className="h-4 w-2/3 animate-pulse rounded bg-gray-200 motion-reduce:animate-none" />
            <div className="mt-4 h-9 w-full animate-pulse rounded-full bg-gray-100 motion-reduce:animate-none" />
          </div>
        ))}
      </div>
    </main>
  );
}

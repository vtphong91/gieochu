import { PAPER_ALT } from "../../_ui/catalog-parts";
import { ShelfSkeleton } from "../../_ui/shelf-skeleton";

/** Đang tải trang tìm: dải tiêu đề + form giữ chỗ, rồi lưới thẻ (khớp bố cục thật để không nhảy). */
export default function ShopSearchLoading() {
  return (
    <>
      <div aria-hidden="true" className="py-8 sm:py-10" style={{ background: PAPER_ALT }}>
        <div className="container-page flex flex-col gap-4">
          <div className="h-5 w-40 rounded-md bg-white/70 motion-safe:animate-pulse" />
          <div className="h-9 w-full max-w-[420px] rounded-md bg-white/70 motion-safe:animate-pulse" />
          <div className="h-[150px] w-full rounded-2xl bg-white sm:h-[92px]" />
        </div>
      </div>
      <ShelfSkeleton variant="products" label="kết quả tìm kiếm" />
    </>
  );
}

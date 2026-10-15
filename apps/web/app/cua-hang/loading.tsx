import { ShelfSkeleton } from "../_ui/shelf-skeleton";

/** Lần điều hướng đầu tới `/cua-hang` (trước khi khung trang stream về): hero + 2 kệ giữ chỗ. */
export default function ShopLoading() {
  return (
    <>
      <ShelfSkeleton variant="hero" label="Cửa hàng" />
      <ShelfSkeleton variant="products" label="tài liệu" shelves={2} />
    </>
  );
}

import { ProductEditorSkeleton } from "../../products/_ui/editor-skeleton";

/** Cùng khung editor 2 cột (≥ xl) với editor sản phẩm — tái dùng skeleton để không nhảy layout. */
export default function Loading() {
  return <ProductEditorSkeleton label="Đang mở trình viết bài..." />;
}

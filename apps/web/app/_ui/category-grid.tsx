import Link from "next/link";
import { cloudinaryDeliveryUrl } from "@gieochu/core/cloudinary-url";
import { BLUE, FOCUS_RING, IconChevron, IconFolder, INK, INK_SOFT, formatCount, pastelOf, rotatingColor } from "./catalog-parts";
import { ShelfSection } from "./product-shelf";
import { shopSearchHref } from "../../lib/shop";

/** Danh mục công khai (contract `ShopCategory` ở `lib/shop.ts`). */
export interface CategoryTileData {
  id: string;
  slug: string;
  name: string;
  /** Ảnh/icon danh mục (`DocumentCategory.imageUrl`); null → icon mặc định. */
  imageUrl: string | null;
  /** Số tài liệu Công khai trong danh mục. */
  productCount: number;
}

/** Link lọc danh mục trên trang tìm Cửa hàng (ADR-035 mục 1) — dựng bằng `shopSearchHref` (một nguồn). */
export function shopCategoryHref(slug: string): string {
  return shopSearchHref({ categorySlug: slug });
}

/** Ô danh mục: cả ô là một link (≥ 112px cao), nền pastel suy ra từ token màu xoay vòng, tên + số tài liệu bằng chữ. */
export function CategoryTile({ category, toneIndex = 0 }: { category: CategoryTileData; toneIndex?: number }) {
  const tone = rotatingColor(toneIndex);
  return (
    <Link
      href={shopCategoryHref(category.slug)}
      className={`group flex h-full min-h-[112px] flex-col items-center justify-center gap-2 rounded-2xl border p-3 text-center transition-[border-color,box-shadow] duration-200 hover:border-[color:var(--tile-tone)] hover:shadow-[0_10px_24px_-16px_rgba(18,33,58,0.4)] sm:p-4 ${FOCUS_RING}`}
      style={{
        background: pastelOf(tone),
        borderColor: pastelOf(tone, 22),
        outlineColor: BLUE,
        color: INK,
        ["--tile-tone" as string]: tone,
      }}
    >
      <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white" style={{ color: tone }}>
        {category.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- ảnh Cloudinary tối ưu qua cloudinaryDeliveryUrl (ADR-028)
          <img src={cloudinaryDeliveryUrl(category.imageUrl, { width: 200 })} alt="" width={48} height={48} loading="lazy" decoding="async" className="h-full w-full object-cover" />
        ) : (
          <IconFolder className="h-6 w-6" />
        )}
      </span>
      <span className="line-clamp-2 text-[14px] leading-snug font-semibold [overflow-wrap:anywhere] sm:text-[14.5px]">{category.name}</span>
      <span className="text-[12.5px] tabular-nums" style={{ color: INK_SOFT }}>
        {formatCount(category.productCount)} tài liệu
      </span>
    </Link>
  );
}

const GRID = "grid grid-cols-2 gap-3 min-[400px]:grid-cols-3 sm:grid-cols-4 sm:gap-4 lg:grid-cols-6";

export interface CategoryGridProps {
  title: string;
  subtitle?: string;
  categories: CategoryTileData[];
  /** Số ô hiện ngay (CMS `maxVisible`); phần dư trong `<details>` mở được bằng bàn phím. */
  maxVisible: number;
  background?: "paper" | "alt";
}

/** Section "Danh mục": lưới 2–3 cột mobile / 4 tablet / 6 desktop. Rỗng → không render. */
export function CategoryGrid({ title, subtitle, categories, maxVisible, background }: CategoryGridProps) {
  if (categories.length === 0) return null;
  const visibleCount = Math.max(1, maxVisible);
  const visible = categories.slice(0, visibleCount);
  const rest = categories.slice(visibleCount);

  return (
    <ShelfSection title={title} subtitle={subtitle} background={background}>
      <ul className={GRID}>
        {visible.map((category, i) => (
          <li key={category.id}>
            <CategoryTile category={category} toneIndex={i} />
          </li>
        ))}
      </ul>
      {rest.length > 0 ? (
        <details className="group mt-4">
          <summary
            className={`mx-auto flex min-h-11 w-fit cursor-pointer list-none items-center gap-1.5 rounded-full px-4 text-sm font-semibold [&::-webkit-details-marker]:hidden ${FOCUS_RING}`}
            style={{ color: BLUE, outlineColor: BLUE }}
          >
            <span className="group-open:hidden">Xem thêm {formatCount(rest.length)} danh mục</span>
            <span className="hidden group-open:inline">Thu gọn</span>
            <IconChevron className="h-4 w-4 transition-transform group-open:rotate-180 motion-reduce:transition-none" />
          </summary>
          <ul aria-label="Danh mục khác" className={`mt-4 ${GRID}`}>
            {rest.map((category, i) => (
              <li key={category.id}>
                <CategoryTile category={category} toneIndex={visible.length + i} />
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </ShelfSection>
  );
}

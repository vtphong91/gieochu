import Link from "next/link";
import type { Metadata } from "next";
import { getEnv } from "@gieochu/config";
import { defaultShopSections, type ShopSection } from "@gieochu/core";
import { getEffectiveBrand } from "../../../lib/branding";
import {
  getShopCmsSections,
  getShopHeroAndCategories,
  parseShopSearchParams,
  searchShopProducts,
  SHOP_DEFAULT_SORT,
  SHOP_PATH,
  SHOP_SEARCH_PAGE_SIZE,
  SHOP_SEARCH_PATH,
} from "../../../lib/shop";
import { BLUE, FOCUS_RING, INK_SOFT, PAPER_ALT, formatCount } from "../../_ui/catalog-parts";
import { DocumentCard } from "../../_ui/document-card";
import { ShopSearchForm } from "../../_ui/shop-hero";
import { SearchNote, ShopNoResults, ShopPagination, ShopSortForm, type ShopSearchState } from "../_ui/search-parts";

/**
 * Trang danh sách/tìm tài liệu Cửa hàng `/cua-hang/tai-lieu` (ADR-035 mục 1, kế hoạch §4.1): form GET thuần,
 * `?q=&danh-muc=&sap-xep=&trang=`, 24 thẻ/trang. Tham số sai được `parseShopSearchParams` hạ về mặc định (không 404).
 */

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Số chip danh mục gợi ý khi không có kết quả. */
const POPULAR_CHIPS = 8;

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const [{ q }, brand] = await Promise.all([searchParams.then(parseShopSearchParams), getEffectiveBrand()]);
  return {
    title: q ? `Kết quả cho “${q}” | ${brand.name}` : `Tài liệu | ${brand.name}`,
    description: "Tìm giáo án, đề thi, slide bài giảng theo tên, môn học, danh mục hoặc gian hàng — lọc và sắp xếp theo nổi bật, bán chạy, đánh giá, mới nhất.",
    // Canonical không kèm query; trang kết quả tìm theo từ khoá không đưa vào chỉ mục (nội dung mỏng/vô hạn biến thể).
    alternates: { canonical: `${getEnv().APP_URL.replace(/\/+$/, "")}${SHOP_SEARCH_PATH}` },
    robots: q ? { index: false, follow: true } : undefined,
  };
}

function findHero(sections: readonly ShopSection[]) {
  return sections.find((s): s is Extract<ShopSection, { type: "hero" }> => s.type === "hero");
}

export default async function ShopSearchPage({ searchParams }: { searchParams: SearchParams }) {
  const parsed = parseShopSearchParams(await searchParams);
  const [result, { categories }, sections] = await Promise.all([
    searchShopProducts({ q: parsed.q, categorySlug: parsed.categorySlug, sort: parsed.sort, page: parsed.page, pageSize: SHOP_SEARCH_PAGE_SIZE }),
    // Select danh mục luôn đủ danh sách — không phụ thuộc admin có bật section "Danh mục" ở /cua-hang hay không.
    getShopHeroAndCategories(defaultShopSections().filter((s) => s.type === "categories")),
    getShopCmsSections(),
  ]);

  // Nhãn/placeholder ô tìm: theo hero CMS (nếu đang bật) để đồng nhất với /cua-hang, không thì mặc định.
  const heroData = (findHero(sections) ?? findHero(defaultShopSections()))?.data;
  const category = result.category;
  const invalidCategory = Boolean(parsed.categorySlug) && !category;
  const state: ShopSearchState = { q: parsed.q, categorySlug: category?.slug, sort: parsed.sort };
  const pageClamped = result.total > 0 && parsed.page > result.page;

  const heading = parsed.q ? `Kết quả cho “${parsed.q}”` : (category?.name ?? "Tài liệu");
  const subheading = parsed.q && category ? `Trong danh mục ${category.name}` : category ? "Tài liệu trong danh mục" : null;

  return (
    <>
      <section className="py-8 sm:py-10" style={{ background: PAPER_ALT }}>
        <div className="container-page flex flex-col gap-4 sm:gap-5">
          <nav aria-label="Đường dẫn">
            <ol className="flex flex-wrap items-center gap-x-2 text-sm" style={{ color: INK_SOFT }}>
              <li>
                <Link href={SHOP_PATH} className={`inline-flex min-h-11 items-center font-semibold hover:underline ${FOCUS_RING}`} style={{ color: BLUE, outlineColor: BLUE }}>
                  Cửa hàng
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li aria-current="page">Tài liệu</li>
            </ol>
          </nav>
          <div className="min-w-0">
            {subheading && !parsed.q ? (
              <p className="mb-1 text-[13px] font-semibold" style={{ color: INK_SOFT }}>
                {subheading}
              </p>
            ) : null}
            <h1 className="font-[family-name:var(--font-heading)] text-[26px] leading-tight font-semibold text-balance [overflow-wrap:anywhere] sm:text-[32px] lg:text-[36px]">
              {heading}
            </h1>
            {subheading && parsed.q ? (
              <p className="mt-2 text-[15px]" style={{ color: INK_SOFT }}>
                {subheading}
              </p>
            ) : null}
          </div>
          {invalidCategory ? <SearchNote>Không tìm thấy danh mục bạn chọn (có thể đã đổi tên hoặc ngừng hiển thị) — đang hiện tài liệu ở mọi danh mục.</SearchNote> : null}
          <ShopSearchForm
            label={heroData?.searchLabel ?? "Tìm tài liệu"}
            placeholder={heroData?.searchPlaceholder ?? ""}
            categories={categories}
            defaultQuery={parsed.q}
            defaultCategorySlug={category?.slug}
            hiddenFields={parsed.sort !== SHOP_DEFAULT_SORT ? { "sap-xep": parsed.sort } : undefined}
          />
        </div>
      </section>

      <section aria-labelledby="ket-qua" className="py-8 sm:py-10 lg:py-12">
        <div className="container-page">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 sm:mb-6">
            <h2 id="ket-qua" className="font-[family-name:var(--font-heading)] text-lg font-semibold tabular-nums sm:text-xl">
              {result.total > 0 ? `${formatCount(result.total)} tài liệu` : "Không có kết quả"}
            </h2>
            {result.total > 0 ? <ShopSortForm {...state} /> : null}
          </div>

          {pageClamped ? (
            <div className="mb-5">
              <SearchNote>
                Trang {formatCount(parsed.page)} không tồn tại — đang hiện trang cuối ({formatCount(result.page)}/{formatCount(result.pageCount)}).
              </SearchNote>
            </div>
          ) : null}

          {result.items.length > 0 ? (
            <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 lg:gap-6">
              {result.items.map((product, i) => (
                <li key={product.id}>
                  <DocumentCard product={product} toneIndex={i} headingLevel="h3" density="compact" />
                </li>
              ))}
            </ul>
          ) : (
            <ShopNoResults
              state={state}
              categoryName={category?.name}
              popular={categories.filter((c) => c.id !== category?.id).slice(0, POPULAR_CHIPS)}
            />
          )}

          <ShopPagination page={result.page} pageCount={result.pageCount} state={state} />
        </div>
      </section>
    </>
  );
}

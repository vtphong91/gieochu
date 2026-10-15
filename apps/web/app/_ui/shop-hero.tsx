import { useId } from "react";
import Link from "next/link";
import type { ShopHeroData } from "@gieochu/core/shop-sections";
import { cloudinaryDeliveryUrl } from "@gieochu/core/cloudinary-url";
import {
  AMBER,
  AMBER_SOFT,
  BLUE,
  BLUE_DEEP,
  GREEN,
  INK,
  INK_SOFT,
  IconDocs,
  IconSearch,
  IconStar,
  IconStorefront,
  LINE,
  formatCount,
} from "./catalog-parts";
import { shopCategoryHref, type CategoryTileData } from "./category-grid";
// Chỉ hằng (đường dẫn, giới hạn `q`) — không gọi hàm DB trong _ui.
import { SHOP_SEARCH_PATH, SHOP_SEARCH_Q_MAX } from "../../lib/shop";


const FIELD_CLASS =
  "h-12 w-full rounded-xl border bg-white text-base outline-offset-1 focus-visible:outline-2 [touch-action:manipulation]";

export interface ShopSearchFormProps {
  /** Nhãn hiển thị của ô tìm (CMS `searchLabel`). */
  label: string;
  placeholder: string;
  /** Lựa chọn của `<select name="danh-muc">`; rỗng → không render select. */
  categories: Pick<CategoryTileData, "id" | "slug" | "name">[];
  defaultQuery?: string;
  defaultCategorySlug?: string;
  /** Mặc định `/cua-hang/tai-lieu`. */
  action?: string;
  /** Tham số giữ lại khi gửi (vd `{ "sap-xep": "ban-chay" }` trên trang tìm). */
  hiddenFields?: Record<string, string>;
  submitLabel?: string;
}

/**
 * Form tìm tài liệu — GET thuần (không cần JS): `q` + `danh-muc` (giá trị rỗng = mọi danh mục). Nhãn hiển thị cho cả ô
 * tìm lẫn select (không dùng placeholder thay nhãn), ô cao 48px, chữ 16px (iOS không tự phóng to).
 * Đặt trong khung trắng nên dùng được trên nền tối (hero) lẫn nền sáng (trang tìm).
 */
export function ShopSearchForm({
  label,
  placeholder,
  categories,
  defaultQuery,
  defaultCategorySlug,
  action = SHOP_SEARCH_PATH,
  hiddenFields,
  submitLabel = "Tìm kiếm",
}: ShopSearchFormProps) {
  const queryId = useId();
  const categoryId = useId();
  return (
    <form action={action} method="get" role="search" className="w-full rounded-2xl bg-white p-3 shadow-[0_18px_40px_-20px_rgba(6,12,35,0.45)] sm:p-4" style={{ color: INK }}>
      {hiddenFields ? Object.entries(hiddenFields).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />) : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 grow">
          <label htmlFor={queryId} className="mb-1.5 block text-[13px] font-semibold">
            {label}
          </label>
          <div className="relative">
            <IconSearch className="pointer-events-none absolute top-1/2 left-3.5 h-[18px] w-[18px] -translate-y-1/2" style={{ color: INK_SOFT }} />
            <input
              id={queryId}
              type="search"
              name="q"
              defaultValue={defaultQuery}
              placeholder={placeholder}
              maxLength={SHOP_SEARCH_Q_MAX}
              enterKeyHint="search"
              autoComplete="off"
              className={`${FIELD_CLASS} pr-3 pl-10 placeholder:text-[color:var(--search-placeholder)]`}
              style={{ borderColor: LINE, outlineColor: BLUE, ["--search-placeholder" as string]: INK_SOFT }}
            />
          </div>
        </div>
        {categories.length > 0 ? (
          <div className="sm:w-[210px] sm:shrink-0">
            <label htmlFor={categoryId} className="mb-1.5 block text-[13px] font-semibold">
              Danh mục
            </label>
            <select
              id={categoryId}
              name="danh-muc"
              defaultValue={defaultCategorySlug ?? ""}
              className={`${FIELD_CLASS} cursor-pointer px-3`}
              style={{ borderColor: LINE, outlineColor: BLUE }}
            >
              <option value="">Tất cả danh mục</option>
              {categories.map((category) => (
                <option key={category.id} value={category.slug}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <button
          type="submit"
          className="inline-flex h-12 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl px-6 text-[15px] font-bold text-white transition-[filter] outline-offset-2 hover:brightness-110 focus-visible:outline-2 [touch-action:manipulation]"
          style={{ background: BLUE, outlineColor: BLUE }}
        >
          <IconSearch className="h-[18px] w-[18px]" />
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

export interface ShopHeroProps {
  /** Nội dung section `hero` của CMS Cửa hàng (`ShopHeroData`, chỉ phần hiển thị). */
  data: Pick<ShopHeroData, "eyebrow" | "title" | "subtitle" | "searchLabel" | "searchPlaceholder" | "imageUrl">;
  /** Danh mục cho select (danh mục đang có tài liệu Công khai). */
  categories: Pick<CategoryTileData, "id" | "slug" | "name">[];
  /** Chip "Phổ biến" (CMS `popularChips` đã giải ra danh mục). Rỗng → ẩn hàng chip. */
  chips: Pick<CategoryTileData, "id" | "slug" | "name">[];
  /** Số liệu thật cho thẻ nổi (chỉ ≥ lg). 0/thiếu → ẩn thẻ tương ứng. */
  stats?: { productCount?: number; tenantCount?: number };
}

function StatCard({ value, label, tone, icon, className }: { value: number; label: string; tone: string; icon: "docs" | "store"; className: string }) {
  const Icon = icon === "docs" ? IconDocs : IconStorefront;
  return (
    <div className={`absolute flex items-center gap-3 rounded-2xl bg-white px-[18px] py-3.5 ${className}`} style={{ boxShadow: "0 18px 40px rgba(6,12,35,0.3)" }}>
      <span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-full text-white" style={{ background: tone }}>
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <p className="flex flex-col">
        <span className="text-[15px] leading-tight font-bold tabular-nums" style={{ color: INK }}>
          {formatCount(value)}
        </span>
        <span className="text-xs leading-tight" style={{ color: INK_SOFT }}>
          {label}
        </span>
      </p>
    </div>
  );
}

/** Minh hoạ mặc định khi CMS chưa có ảnh: chồng thẻ tài liệu cách điệu (thuần trang trí). */
function DefaultIllustration() {
  return (
    <div aria-hidden="true" className="absolute inset-0">
      <div className="absolute top-4 right-6 h-64 w-64 rounded-full" style={{ background: `color-mix(in srgb, ${AMBER} 35%, transparent)` }} />
      <div className="absolute bottom-6 left-0 h-48 w-48 rounded-full" style={{ background: `color-mix(in srgb, ${GREEN} 35%, transparent)` }} />
      <div className="absolute top-[70px] left-[40px] w-[230px] rotate-[5deg] rounded-[18px] bg-white/90 p-5" style={{ boxShadow: "0 24px 50px rgba(6,12,35,0.3)" }}>
        <div className="mb-3 h-20 rounded-xl" style={{ background: `color-mix(in srgb, ${BLUE} 12%, white)` }} />
        <div className="mb-2 h-2.5 w-[85%] rounded-full" style={{ background: LINE }} />
        <div className="h-2.5 w-[60%] rounded-full" style={{ background: LINE }} />
      </div>
      <div className="absolute top-[40px] left-[120px] w-[250px] -rotate-[4deg] rounded-[18px] bg-white p-5" style={{ boxShadow: "0 30px 60px rgba(6,12,35,0.35)" }}>
        <div className="mb-3 flex items-center gap-2">
          <span className="flex h-[34px] w-[34px] items-center justify-center rounded-[9px]" style={{ background: AMBER_SOFT, color: AMBER }}>
            <IconDocs className="h-[18px] w-[18px]" />
          </span>
          <span className="flex gap-0.5" style={{ color: AMBER }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <IconStar key={i} className="h-3.5 w-3.5" />
            ))}
          </span>
        </div>
        <div className="mb-2.5 h-2.5 w-[90%] rounded-full" style={{ background: LINE }} />
        <div className="mb-2.5 h-2.5 w-[70%] rounded-full" style={{ background: LINE }} />
        <div className="mb-4 h-2.5 w-[80%] rounded-full" style={{ background: LINE }} />
        <div className="h-3 w-16 rounded-full" style={{ background: `color-mix(in srgb, ${BLUE} 30%, white)` }} />
      </div>
    </div>
  );
}

/**
 * Hero Cửa hàng (section `hero`, ADR-035): eyebrow, H1 duy nhất của trang, mô tả, form tìm GET, chip danh mục phổ biến.
 * Khối trang trí (ảnh CMS hoặc minh hoạ mặc định + thẻ số liệu thật) chỉ hiện từ `lg` — mobile ưu tiên ô tìm.
 */
export function ShopHero({ data, categories, chips, stats }: ShopHeroProps) {
  const chipsLabelId = useId();
  const productCount = stats?.productCount ?? 0;
  const tenantCount = stats?.tenantCount ?? 0;

  return (
    <section className="py-10 sm:py-14 lg:py-20" style={{ background: `linear-gradient(160deg, ${BLUE_DEEP} 0%, color-mix(in srgb, ${BLUE} 45%, ${BLUE_DEEP}) 100%)` }}>
      <div className="container-page flex items-center gap-12 lg:justify-between">
        <div className="flex w-full min-w-0 flex-col items-start gap-4 sm:gap-5 lg:max-w-[640px]">
          <span
            className="max-w-full rounded-full border px-4 py-1.5 text-xs font-semibold [overflow-wrap:anywhere] sm:text-[13.5px]"
            style={{ background: "rgba(255,255,255,0.1)", color: AMBER_SOFT, borderColor: "rgba(244,227,196,0.35)" }}
          >
            {data.eyebrow}
          </span>
          <h1 className="font-[family-name:var(--font-heading)] text-[30px] leading-[1.2] font-semibold text-balance text-white [overflow-wrap:anywhere] sm:text-[40px] lg:text-[46px] lg:leading-[1.15]">
            {data.title}
          </h1>
          <p className="max-w-[560px] text-[15px] leading-[1.65] text-white/80 sm:text-base lg:text-[17px]">{data.subtitle}</p>

          <div className="mt-1 w-full">
            <ShopSearchForm label={data.searchLabel} placeholder={data.searchPlaceholder} categories={categories} />
          </div>

          {chips.length > 0 ? (
            <div className="flex w-full flex-wrap items-center gap-x-3 gap-y-2">
              <p id={chipsLabelId} className="text-[13px] font-semibold text-white/80">
                Phổ biến:
              </p>
              <ul aria-labelledby={chipsLabelId} className="flex min-w-0 flex-wrap gap-2">
                {chips.map((chip) => (
                  <li key={chip.id} className="max-w-full">
                    <Link
                      href={shopCategoryHref(chip.slug)}
                      className="inline-flex min-h-11 max-w-full items-center rounded-full border border-white/30 bg-white/10 px-4 text-[13.5px] font-semibold text-white transition-colors outline-offset-2 hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-white sm:min-h-10 [touch-action:manipulation]"
                    >
                      <span className="[overflow-wrap:anywhere]">{chip.name}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="relative hidden h-[400px] w-[420px] shrink-0 lg:block">
          {data.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- ảnh Cloudinary tối ưu qua cloudinaryDeliveryUrl (ADR-028)
            <img
              src={cloudinaryDeliveryUrl(data.imageUrl, { width: 1000 })}
              alt=""
              width={840}
              height={800}
              loading="lazy"
              decoding="async"
              className="absolute inset-0 h-full w-full rounded-[24px] object-cover"
              style={{ boxShadow: "0 30px 60px rgba(6,12,35,0.35)" }}
            />
          ) : (
            <DefaultIllustration />
          )}
          {productCount > 0 ? <StatCard value={productCount} label="Tài liệu đang bán" tone={GREEN} icon="docs" className="right-0 bottom-6" /> : null}
          {tenantCount > 0 ? <StatCard value={tenantCount} label="Gian hàng" tone={BLUE} icon="store" className="top-0 right-2" /> : null}
        </div>
      </div>
    </section>
  );
}

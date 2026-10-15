---
tags: [ke-hoach, marketplace, cms, adr-035]
date: 2026-10-15
---

# Kế hoạch triển khai trang "Cửa hàng" (marketplace) — ADR-035

> Người soạn: Long (tài liệu) theo brief của Quốc, 2026-10-15. Ràng buộc chính: **ADR-035** (`docs/DECISIONS.md`),
> kèm ADR-024 (độ rộng), ADR-025 (trang hệ thống), ADR-028 (ảnh Cloudinary), ADR-029 (rating cache), ADR-030
> (`productPath`, slug dành riêng), ADR-032 (thương hiệu/cấu hình từ DB), ADR-033 (dữ liệu thật trang chủ, "Công
> khai", `soldCount`), ADR-034 (một DB duy nhất).
>
> Đầu vào: ảnh mẫu marketplace (hero chữ + ô tìm bên trái, ảnh minh hoạ bên phải; hàng ô danh mục nền pastel có
> icon; lưới thẻ 4 cột có nhãn góc, sao, giá; footer nhiều cột) và đề xuất UX của Phong (qua brief Quốc).
>
> **Mức xác minh:** ✅ đã đối chiếu code/DB schema trong repo ngày 2026-10-15 · 🟡 nghe từ báo cáo/đề xuất, chưa có
> trong code · ❓ cần môi trường thật (Neon production) hoặc cần chủ dự án/Quốc quyết.
> Mọi chỗ ghi "đề xuất" là phương án kế hoạch, **chưa phải quyết định** cho tới khi Quốc/chủ dự án chốt.
>
> **Trạng thái 2026-10-15:** GĐ1 + GĐ2 xong code, chưa commit/deploy (§5). Nội dung dưới đây là kế hoạch gốc, giữ nguyên để đối chiếu —
> hành vi thực tế xem KB `02-System-Specs/Shop-Marketplace-Specs.md`.

---

## 1. Tóm tắt và phạm vi

Trang Cửa hàng tổng hợp tài liệu Công khai của mọi tenant, là trang hệ thống (header/footer hệ thống, ADR-025;
`container-page` 1280px, ADR-024). Triển khai hai giai đoạn theo ADR-035 mục 6:

| Giai đoạn | Nội dung | Ai làm chính | DDL? |
|---|---|---|---|
| **GĐ1 — CMS Cửa hàng** | Schema cấu hình section (`packages/core`), editor `/admin/cms/shop` trong System Center (nội dung hero, tiêu đề/mô tả/bật-tắt/thứ tự section, ghim tài liệu riêng cho Cửa hàng, chế độ + ghim gian hàng nổi bật, ngưỡng đánh giá cao), lưu nháp / xuất bản / khôi phục. | Hiếu (schema, action, loader option), Phong (bố cục editor) | **Không** — dùng bảng `cms_pages` có sẵn (xem §2.1) |
| **GĐ2 — Trang công khai** | `/cua-hang`, `/cua-hang/tai-lieu` đọc CMS + dữ liệu thật qua `lib/shop.ts` (`withPublic`), tìm không dấu, gian hàng nổi bật 30 ngày, slug dành riêng, link header/footer, component dùng chung (`DocumentCard`…). | Hiếu (loader, migration expand, slug), Phong (UI), Quốc (duyệt + chạy migration, quét slug) | **Có** — 1 migration *expand* cho tìm không dấu (§4.4) |

Ngoài phạm vi (nợ theo ADR-035): trang danh mục SEO `/cua-hang/danh-muc/[slug]`, `Product.publishedAt` (tạm dùng
`createdAt` cho "Mới"), `DocumentCategory.iconKey/sortOrder`, index cho catalog lớn, carousel.

---

## 2. Mô hình dữ liệu CMS

### 2.1 Nơi lưu — `CmsPage` slug `shop` (không cần DDL)

- ✅ Bảng `CmsPage` (`cms_pages`, L1, không RLS) đã có `slug @unique`, `blocks Json`, `blocksDraft Json?`, `status`
  (`DRAFT|PUBLISHED`), `seoTitle`, `seoDescription` — đủ cho mẫu nháp/xuất bản của trang chủ
  (`packages/db/prisma/schema.prisma`, model `CmsPage`).
- ✅ Trang chủ dùng đúng mẫu này: `blocks` = mảng section có thứ tự, `blocksDraft` = nháp, action
  `saveHomeDraftAction` / `publishHomeAction` / `restoreLiveHomeAction` (`apps/web/app/admin/cms/home-editor/actions.ts`).
- **Đề xuất:** lưu cấu hình Cửa hàng ở `CmsPage` slug **`shop`**, `blocks`/`blocksDraft` = mảng `ShopSection[]`;
  `seoTitle`/`seoDescription` của dòng này dùng cho metadata `/cua-hang` (GĐ2). → **GĐ1 không cần migration/DDL.**
- **Tạo dòng `shop` không qua seed** (ADR-034 cấm `db:seed`): editor nạp mặc định khi chưa có dòng; lần lưu đầu
  tiên `upsert` tạo dòng (`status: DRAFT`, `blocks` = mặc định, `blocksDraft` = bản đang soạn). Xuất bản đặt
  `status: PUBLISHED`.

### 2.2 Va chạm với CMS chung cần chặn (phát hiện khi đối chiếu code)

- ✅ `saveCmsPageAction` (`apps/web/app/admin/cms/actions.ts`) `upsert` theo slug tự nhập từ `/admin/cms/new` và
  validate bằng `isValidCmsBlocks` (dạng object phẳng) — **không chặn slug `home`**. Nếu admin tạo trang slug `shop`
  (hoặc `home`) qua form chung sẽ ghi đè cấu hình bằng JSON khác dạng.
- ✅ `/p/[slug]` (`apps/web/app/p/[slug]/page.tsx`) render mọi `CmsPage` PUBLISHED, ép kiểu `blocks as CmsBlocks` —
  không loại trừ `home`; dòng `shop` PUBLISHED cũng sẽ lộ ở `/p/shop` với dữ liệu sai dạng.
- ✅ `/admin/cms/[slug]/page.tsx` chỉ có nhánh riêng cho `home`; slug khác rơi vào form JSON chung, và `notFound()`
  khi chưa có dòng.
- **Đề xuất (Hiếu, GĐ1):** hằng `SYSTEM_CMS_SLUGS = ["home", "shop"]` ở `packages/core`; form chung từ chối các slug
  này; `/p/[slug]` trả 404 cho các slug này; trang danh sách `/admin/cms` hiển thị đường dẫn `/cua-hang` cho `shop`
  và link "Sửa" về `/admin/cms/shop`. Route editor riêng `app/admin/cms/shop/page.tsx` (segment tĩnh thắng `[slug]`)
  để xử lý được trường hợp chưa có dòng.

### 2.3 Schema `shopSectionsSchema` (file mới `packages/core/src/admin/shop-sections.ts`)

Theo mẫu `homeSectionsSchema` ✅: `discriminatedUnion("type")`, mỗi phần tử `{ id, type, visible, data }`, mảng có
thứ tự = thứ tự hiển thị. Mỗi `type` xuất hiện **tối đa 1 lần** (refine). Chuỗi do admin nhập: `trim`, có `max`.

| `type` | `data` | Mặc định đề xuất (tiếng Việt, không chứa tên thương hiệu) |
|---|---|---|
| `hero` | `eyebrow` (≤60), `title` (≤120), `subtitle` (≤240), `searchLabel` (≤60), `searchPlaceholder` (≤100), `popularChips: { mode: "AUTO" \| "MANUAL", categoryIds: string[≤8], max: 3–8 }`, `imageUrl?` (chỉ URL Cloudinary hợp lệ — `isCloudinaryImageUrl`, ADR-028) | eyebrow "Cửa hàng tài liệu"; title "Tìm tài liệu dạy và học bạn cần"; subtitle "Giáo án, đề thi, slide bài giảng từ giáo viên và coach trên khắp cả nước."; searchLabel "Tìm tài liệu"; placeholder "Tên tài liệu, môn học, giáo viên…"; chips AUTO, max 6 |
| `categories` | `title`, `subtitle`, `maxVisible` 6–24 (phần dư vào `<details>`) | "Khám phá theo danh mục"; maxVisible 12 |
| `featured` | `title`, `subtitle`, `limit` 4–12, `pinnedProductIds` (≤12, không trùng) | "Tài liệu nổi bật"; limit 8 |
| `byCategory` | `title`, `subtitle`, `mode: "AUTO" \| "MANUAL"`, `categoryIds: string[≤6]`, `blockCount` 1–6, `cardsPerBlock` 2–4 | "Theo từng danh mục"; AUTO; 6 khối × 4 thẻ (ADR-035 mục 2: ≤6 × 4) |
| `bestSellers` | `title`, `subtitle`, `limit` 4–12 | "Bán chạy"; limit 8 |
| `topRated` | `title`, `subtitle`, `limit` 4–12, `minReviews` 1–50, `minAvgTenths` 10–50 | "Đánh giá cao"; limit 8; **minReviews 3, minAvgTenths 40** (= 4,0 — ADR-035 mục 3) |
| `featuredTenants` | `title`, `subtitle`, `mode: "SALES_30D" \| "TOP_RATED"`, `limit` 3–12, `pinnedTenantIds` (≤12), `minReviews` 1–50 | "Gian hàng nổi bật"; SALES_30D; limit 4; minReviews 3 |
| `newest` | `title`, `subtitle`, `limit` 4–12 | "Mới cập nhật"; limit 8 |
| `ctaOpenStore` | `eyebrow`, `title`, `description`, `cta: { label, href }` (href chỉ đường dẫn nội bộ bắt đầu `/`) | "Dành cho giáo viên & coach"; "Mở gian hàng, bán tài liệu của bạn"; cta "Mở gian hàng miễn phí" → `/register` |

Thứ tự mặc định = thứ tự ADR-035 mục 2: hero → categories → featured → byCategory → bestSellers → topRated →
featuredTenants → newest → ctaOpenStore; tất cả `visible: true`.

**Ngưỡng điểm TB lưu dạng số nguyên ×10** (`minAvgTenths = 40` nghĩa là 4,0): tránh float trong JSON/so sánh, khớp
quy ước "so sánh số nguyên" của ADR-035 mục 3. Điều kiện ở SQL:
`ratingCount >= minReviews AND ratingSum * 10 >= minAvgTenths * ratingCount` (với mặc định tương đương
`ratingSum ≥ 4·ratingCount`). Editor hiển thị/nhập dạng thập phân 1 chữ số (1,0–5,0), quy đổi khi lưu.

Hằng xuất kèm (theo mẫu `HOME_*`): `SHOP_SECTION_LABELS`, `SHOP_LIMIT_MIN/MAX`, `SHOP_PINNED_MAX = 12`,
`DEFAULT_SHOP_SECTIONS()`, `parseShopSections(input)`, `isValidShopSections(input)`.

**Đọc phòng thủ `parseShopSections`** (giống `parseHomeSections` ✅): không phải mảng → `null` (caller dùng mặc định);
section sai → chuẩn hoá từng field về mặc định (text rỗng → mặc định, limit ngoài khoảng → mặc định, id ghim lọc
trùng/quá dài/quá 12) thay vì bỏ cả trang; trùng `id` hoặc trùng `type` → giữ phần tử đầu; **section `type` thiếu
được bổ sung từ mặc định với `visible: false`?** — xem câu hỏi Q5. Lúc **lưu** dùng schema chặt.

---

## 3. GĐ1 chi tiết — CMS Cửa hàng trong System Center

### 3.1 Phân rã việc

| # | Việc | Người | File (dự kiến) | Ghi chú |
|---|---|---|---|---|
| 1.1 | `shopSectionsSchema` + mặc định + `parseShopSections` + hằng; export từ `@gieochu/core` | Hiếu | `packages/core/src/admin/shop-sections.ts`, `packages/core/src/index.ts` | Không import gì ngoài zod (dùng được cả client editor) |
| 1.2 | `SYSTEM_CMS_SLUGS`; chặn ở `saveCmsPageAction`, `/p/[slug]`, danh sách `/admin/cms` | Hiếu | `packages/core`, `apps/web/app/admin/cms/actions.ts`, `apps/web/app/p/[slug]/page.tsx`, `apps/web/app/admin/cms/page.tsx` | §2.2 |
| 1.3 | Server actions: `saveShopDraftAction`, `publishShopAction`, `restoreLiveShopAction` — mỗi action `await requireRole("SYSTEM_ADMIN")` đầu tiên, validate chặt, `upsert` dòng `shop`; publish `revalidatePath("/admin/cms/shop")` + `revalidatePath("/cua-hang")` (+ `/cua-hang/tai-lieu`) | Hiếu | `apps/web/app/admin/cms/shop-editor/actions.ts` | Server Action dựa CSRF sẵn của Next (§7.7) |
| 1.4 | Option ghim: tái dùng `listHomeProductOptions`/`listHomeTenantOptions` (✅ đã `withPublic`, chỉ dữ liệu công khai, §7.9) qua action mới `searchShop…OptionsAction` hoặc dùng chung action trang chủ; option danh mục (danh mục `isActive`, kèm số tài liệu Công khai — tái dùng `getHomeSearchCategories` ✅ + danh mục đang chọn nhưng đã tắt, cờ `eligible:false`) | Hiếu | `apps/web/lib/home.ts` (hoặc tách `lib/pin-options.ts`) | Đổi tên/tách hàm dùng chung là tuỳ Hiếu; không đổi hành vi trang chủ |
| 1.5 | Route editor `app/admin/cms/shop/page.tsx`: `requireAdminAccess("/admin/cms/shop")`, đọc dòng `shop` (thiếu → mặc định), parse phòng thủ live + nháp, nạp sẵn option ghim | Hiếu (dữ liệu) + Phong (bố cục) | `apps/web/app/admin/cms/shop/page.tsx` | |
| 1.6 | `ShopSectionsEditor` (client): danh sách section có Lên/Xuống + bật/tắt, form từng section, `PinPicker` ✅ cho tài liệu (featured) và gian hàng (featuredTenants), bộ chọn danh mục (hero MANUAL, byCategory MANUAL), nhập ngưỡng 1,0–5,0, upload ảnh hero (tái dùng luồng ảnh Cloudinary của hero trang chủ), 3 nút Lưu nháp / Xuất bản / Khôi phục bản đang hiển thị, nhãn trạng thái "Có thay đổi chưa xuất bản" | Phong (UI, theo pattern `home-sections-editor.tsx`) + Hiếu (nối action) | `apps/web/app/admin/cms/shop-editor/*.tsx` | Tái dùng `pin-picker.tsx`, `array-object-editor.tsx` nếu hợp |
| 1.7 | Mục menu System Center "Trang Cửa hàng" → `/admin/cms/shop` cạnh "Trang CMS" | Phong | `apps/web/app/admin/_ui/sidebar-nav.tsx` (✅ hiện có mục `/admin/cms` "Trang CMS") | |
| 1.8 | Xem trước (tuỳ chọn): link "Xem trang" chỉ bật từ GĐ2 | — | — | GĐ1 chưa có trang công khai |

### 3.2 Tiêu chí xong GĐ1

- `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:count` đạt; số test **không đổi** (93/52 — ✅ chạy
  `scripts/count-tests.mjs` ngày 2026-10-15: 93/94 unit, 52/53 integration).
- Thử tay trên dev server (dữ liệu là production — ADR-034): mở `/admin/cms/shop` khi chưa có dòng → thấy mặc định;
  Lưu nháp tạo dòng `shop` DRAFT; Xuất bản → `PUBLISHED`; Khôi phục xoá nháp. Không tạo dữ liệu tạm ngoài dòng `shop`.
  Người không phải SYSTEM_ADMIN gọi action → bị từ chối.
- `/admin/cms/new` với slug `shop`/`home` → báo lỗi; `/p/shop`, `/p/home` → 404.
- A11y editor (Phong): mọi input có `label`; nút Lên/Xuống thay kéo-thả (WCAG 2.5.7); target ≥44px dưới lg; thông báo
  thao tác qua `role="status"`; không cuộn ngang ở 360px.
- Long cập nhật KB (spec CMS Cửa hàng, MOC) sau khi Quốc review.

---

## 4. GĐ2 chi tiết — trang công khai

### 4.1 Routes

| Route | Mô tả |
|---|---|
| `app/cua-hang/page.tsx` | Trang tổng hợp. Đọc `CmsPage` `shop` (đề xuất: chưa PUBLISHED → dùng mặc định, xem Q1), render section `visible` theo thứ tự, section rỗng → ẩn (ADR-035 mục 2). |
| `app/cua-hang/tai-lieu/page.tsx` | Danh sách/tìm kiếm: `?q=&danh-muc=&sap-xep=noi-bat\|ban-chay\|danh-gia-cao\|moi-nhat&trang=` (form GET, 24 thẻ/trang theo đề xuất Phong 🟡). |

- ✅ `app/cua-hang` là segment tĩnh cấp gốc, Next ưu tiên hơn `app/[tenantSlug]` — vì vậy tenant slug `cua-hang`
  (nếu có) sẽ **không bao giờ** truy cập được storefront → phải dành riêng (§4.5).
- ✅ Root layout `dynamic = "force-dynamic"` (ADR-031) — trang render theo request.
- Validate query bằng zod: `q` trim ≤100 ký tự; `danh-muc` là slug danh mục `isActive` (không khớp → bỏ lọc, hiện
  ghi chú); `sap-xep` không hợp lệ → `noi-bat`; `trang` số nguyên ≥1, vượt số trang → trang cuối hoặc trạng thái rỗng.

### 4.2 Contract `apps/web/lib/shop.ts` (Hiếu)

```ts
export interface ShopProduct extends HomeFeaturedProduct { typeLabel: string }       // + nhãn loại tài liệu
export interface ShopCategory { id: string; slug: string; name: string; imageUrl: string | null; productCount: number }
export interface ShopCategoryShelf { category: ShopCategory; products: ShopProduct[]; href: string } // href = /cua-hang/tai-lieu?danh-muc=…
export interface ShopFeaturedTenant extends HomeFeaturedTenant { sales30d: number | null } // null ở chế độ TOP_RATED
export type ShopSort = "noi-bat" | "ban-chay" | "danh-gia-cao" | "moi-nhat";
export interface ShopPageData {
  sections: ShopSection[];                 // đã parse, chỉ visible
  heroChips: ShopCategory[];
  categories: ShopCategory[];
  featured: ShopProduct[];
  byCategory: ShopCategoryShelf[];
  bestSellers: ShopProduct[];
  topRated: ShopProduct[];
  featuredTenants: ShopFeaturedTenant[];
  newest: ShopProduct[];
  showOpenStoreCta: boolean;               // false với người đang là chủ/thành viên tenant
}
export async function getShopPageData(sections: ShopSection[], viewer: CurrentUser | null): Promise<ShopPageData>;
export async function searchShopProducts(input: { q?: string; categorySlug?: string; sort: ShopSort; page: number; pageSize: 24 })
  : Promise<{ items: ShopProduct[]; total: number; page: number; pageCount: number; category: ShopCategory | null }>;
```

- ✅ `HomeFeaturedProduct` (`apps/web/lib/home.ts`) = `PublicProduct` + `tenant {slug,name}` + `href` (dựng bằng
  `productPath`, ADR-030); giá hiệu lực/ảnh bìa tính qua `toPublicProducts` (`apps/web/lib/storefront.ts`).
- ✅ Nhãn loại tài liệu hiện nằm ở `apps/web/app/[tenantSlug]/_ui/icons.tsx` (map theo enum `ProductType`
  TEMPLATE/SLIDE/EBOOK/EXAM/OTHER). Đề xuất: chuyển map nhãn sang `packages/core` (một nguồn) để loader và UI dùng chung.
- Phong có thể nhận Suspense theo nhóm kệ → nên tách hàm con (`getShopHeroAndCategories`, `getShopProductShelves`,
  `getShopFeaturedTenants`) để page bọc `<Suspense>` từng nhóm; `getShopPageData` là tiện ích gộp.

**"Công khai"** = `products.status = PUBLISHED` **và** `tenants.status = ACTIVE` (ADR-033 bổ sung, ADR-035 mục 6 ✅
hằng `PUBLIC_PRODUCT_WHERE` ở `lib/home.ts`). Mọi truy vấn sản phẩm/đánh giá trong `withPublic` (RLS là cổng thật);
**không** đọc `orders`/`order_items`/`entitlements` ở scope public (§7.9, ADR-033 mục 1).

### 4.3 Quy tắc từng kệ

| Kệ | Lọc | Sắp xếp | Nguồn |
|---|---|---|---|
| Hero chips | AUTO: danh mục `isActive` có ≥1 tài liệu Công khai, theo số tài liệu giảm dần rồi tên (✅ `getHomeSearchCategories`); MANUAL: `categoryIds` theo thứ tự, bỏ id tắt/không còn tài liệu | — | `document_categories` (L1) + đếm trong `withPublic` |
| Danh mục | như chips AUTO; `maxVisible` hiện ngay, phần dư trong `<details>` | số tài liệu ↓, tên | như trên; icon = `DocumentCategory.imageUrl` ✅ (có cột) hoặc icon mặc định |
| Nổi bật | ghim trước (bỏ id không còn Công khai), tự bù | có đánh giá trước → điểm TB ↓ → số đánh giá ↓ → `createdAt` ↓ (✅ giống `fillProductIdsQuery`) | `pinnedProductIds` riêng của Cửa hàng |
| Theo danh mục | AUTO: top `blockCount` danh mục theo số tài liệu; MANUAL: `categoryIds`; mỗi khối `cardsPerBlock` thẻ; khối < 1 thẻ → ẩn | trong khối: như Nổi bật (🟡 đề xuất, xem Q3) | 1 truy vấn `ROW_NUMBER() OVER (PARTITION BY categoryId …)` |
| Bán chạy | `soldCount > 0` | `soldCount` ↓ → `ratingCount` ↓ → `createdAt` ↓ → `id`; UI hiện nhãn chữ "#1", "#2"… | cột cache `products.soldCount` (✅ ADR-033) — **tổng mọi thời gian**, xem Q2 |
| Đánh giá cao | `ratingCount ≥ minReviews` và `ratingSum*10 ≥ minAvgTenths*ratingCount` | điểm TB ↓ (`ratingSum::numeric/ratingCount`) → `ratingCount` ↓ → `createdAt` ↓ | ✅ cột `ratingSum/ratingCount` (ADR-029); tiêu chí in dưới tiêu đề, vd "Từ 3 đánh giá, điểm trung bình từ 4,0" |
| Mới | — | `createdAt` ↓ → `id` (tạm, nợ `publishedAt`) | |
| Gian hàng nổi bật | tenant ACTIVE có ≥1 tài liệu Công khai; ghim trước | SALES_30D: số bán 30 ngày ↓ → tổng `soldCount` ↓ → điểm TB ↓ → `createdAt` ↓ (bù cho đủ `limit`, xem Q4); TOP_RATED: tổng `ratingCount ≥ minReviews`, điểm TB tổng (`SUM(ratingSum)/SUM(ratingCount)`) ↓ → số đánh giá ↓ → `createdAt` ↓ | aggregate tenant (✅ mẫu `featuredTenantQuery`) + số 30 ngày (dưới) |
| CTA mở gian hàng | ẩn khi viewer là chủ/thành viên tenant (đề xuất Phong 🟡) | — | `getCurrentUser()` + membership (L1) |

**Hiệu năng:** một transaction `withPublic` cho nhóm kệ sản phẩm: lấy **id** từng kệ (truy vấn nhẹ, chỉ `id`), gom id
duy nhất, **một** `findMany` với `PUBLIC_PRODUCT_SELECT` + tenant + category, rồi `toPublicProducts` một lần, phân
lại về từng kệ theo thứ tự. Giá hiệu lực (khuyến mãi theo thời gian) **tính sau** mọi cache. Cache dữ liệu thô (id
+ số liệu) là tuỳ chọn (TTL ngắn, vd 60s), không cache giá hiệu lực.

**Bán 30 ngày theo tenant (ADR-035 mục 4):**
- ✅ `orders` có `tenantId`, `status` (`PENDING|PAID|FULFILLED|EXPIRED|CANCELED|REFUNDED`), `paidAt`; `order_items` có
  `productId`; **không** có cột `fulfilledAt`. `withSystemJob` có ở `packages/db/src/rls.ts`.
- Đề xuất: hàm `getTenantSales30d(tenantIds?)` trong `lib/shop.ts` (hoặc `lib/tenant-sales.ts`) chạy **dưới
  `withSystemJob`**, SQL `SELECT o."tenantId", COUNT(oi.id)::int FROM orders o JOIN order_items oi … WHERE o.status =
  'FULFILLED' AND o."paidAt" >= now() - interval '30 days' GROUP BY o."tenantId"` (cách đếm loại trừ thu hồi
  entitlement/hoàn tiền giống `soldCount` hay không — Q2), chỉ trả `Map<tenantId, number>`; kết quả cache ngắn
  (5–10 phút) theo khoá cố định. Không route admin nào dùng hàm này; không trả dòng đơn nào ra ngoài (§7.9).
- ❓ Quốc cần xác nhận việc gọi `withSystemJob` trong luồng render trang public là chấp nhận được (ADR-035 viết "tính
  dưới `system_job`" nhưng không nói chạy ở request hay ở job nền). Phương án thay thế: job pg-boss ghi cache vào bảng
  L1 — nhưng worker chưa có nơi chạy (ADR-031 mục 4) và cần DDL.

### 4.4 Tìm không dấu (ADR-035 mục 5)

| Phương án | Cách làm | Ưu | Nhược |
|---|---|---|---|
| **A. `unaccent` + hàm IMMUTABLE bọc** (đề xuất) | Migration expand: `CREATE EXTENSION IF NOT EXISTS unaccent;` + `CREATE OR REPLACE FUNCTION gieochu_unaccent(text) RETURNS text … IMMUTABLE` (gọi `unaccent('unaccent'::regdictionary, $1)`); truy vấn `gieochu_unaccent(lower(p.title)) LIKE '%' || gieochu_unaccent(lower($q)) || '%'` trên tiêu đề, `summary`, tên tenant, tên danh mục. Index GIN trigram (`pg_trgm`) trên biểu thức là **tuỳ chọn**, để nợ "index cho catalog lớn". | Chỉ *thêm* extension/hàm — an toàn với bản đang deploy; không đổi đường ghi sản phẩm; không backfill dữ liệu production; tìm được cả tên tenant/danh mục | Phụ thuộc extension trên Neon (❓); Prisma không quản lý hàm/extension (chỉ SQL migration) |
| B. Cột `products.searchText` chuẩn hoá | Migration expand thêm cột + backfill; code ghi lại khi tạo/sửa sản phẩm (dùng `slugify` ✅ `packages/core/src/tenant/slug.ts`, đã xử lý `đ/Đ`) | Không cần extension | Đổi đường ghi sản phẩm (Studio, mọi action); phải backfill **trên production** (ADR-034); tên tenant đổi không tự cập nhật |

- Chuẩn hoá phía app trước khi đưa vào SQL: `trim`, cắt 100 ký tự, escape `%`/`_`/`\` trong `LIKE`, truyền tham số
  qua `Prisma.sql` (không nối chuỗi). Truy vấn chạy trong `withPublic` → RLS vẫn lọc PUBLISHED.
- **Người chạy migration:** Hiếu viết file migration SQL; **Quốc duyệt và chạy** `pnpm db:migrate` (ADR-034 mục 1) —
  Hiếu/Long không tự chạy. Kiểm trước: ❓ `SELECT * FROM pg_available_extensions WHERE name IN ('unaccent','pg_trgm')`
  trên Neon; ❓ role `gieochu_app` gọi được hàm (mặc định `EXECUTE` cấp cho `PUBLIC` — cần thử thật).
- Thứ tự deploy: chạy migration (chỉ thêm) **trước**, rồi deploy code dùng hàm.

### 4.5 Slug dành riêng + quét tenant trùng

- ✅ `RESERVED_SLUGS` (`packages/core/src/tenant/slug.ts`) hiện **chưa có** `cua-hang`, `tai-lieu`, `danh-muc`,
  `tim-kiem`, `giao-vien`, `kham-pha`. Hiếu thêm 6 slug này (ADR-035 mục 1).
- `RESERVED_PRODUCT_SLUGS` (`packages/core/src/product/path.ts`) **không** cần đổi: `/cua-hang/...` là route cấp gốc,
  không phải segment con của `/[tenantSlug]` (✅ hiện có `[productSlug]`, `checkout`, `posts`, `products`).
- ❓ **Quét trùng trên production** (Quốc chạy, chỉ đọc):
  `SELECT id, slug, name, status FROM tenants WHERE slug IN ('cua-hang','tai-lieu','danh-muc','tim-kiem','giao-vien','kham-pha');`
  và `tenant_slug_history` cùng danh sách (nếu có redirect slug cũ). Có trùng → dừng, hỏi chủ dự án cách đổi slug
  tenant đó trước deploy.

### 4.6 Component UI (Phong) — `apps/web/app/_ui/`

| Component | Nội dung |
|---|---|
| `DocumentCard` | Tách từ thẻ trong `DocumentsSection` (✅ `apps/web/app/_home-sections.tsx`): ảnh bìa tối ưu (`cloudinaryDeliveryUrl`), tên (heading theo `headingLevel` h3/h4), gian hàng, giá hiệu lực + % giảm, sao + số đánh giá, "Đã bán" (ẩn khi 0), nhãn loại (`typeLabel`), `rank?` (nhãn chữ "#1"), `density: "default" \| "compact"`; stretched link tới `href`. Trang chủ chuyển sang dùng component này (ADR-035 mục 7) — không đổi giao diện trang chủ ngoài phạm vi đã duyệt. |
| `ProductShelf` | Tiêu đề + mô tả + lưới 4 cột desktop / 2 cột mobile; 8 thẻ desktop, 4 thẻ mobile (🟡 đề xuất Phong); "Xem tất cả {tên kệ}" → `/cua-hang/tai-lieu?…`; rỗng → không render. |
| `CategoryTile` / `CategoryGrid` | Ô là link `/cua-hang/tai-lieu?danh-muc={slug}`; lưới 6 cột desktop, 2–3 cột mobile; nền pastel xoay vòng từ token; icon = `imageUrl` hoặc icon mặc định; phần dư trong `<details>`. |
| `ShopHero` / `ShopSearchForm` | Eyebrow, H1, mô tả, `<label>` + ô tìm + `<select>` danh mục + nút (form GET tới `/cua-hang/tai-lieu`); chip phổ biến; thẻ nổi số liệu thật (0 → ẩn); khối trang trí ẩn dưới `lg`. Ảnh hero từ CMS hoặc minh hoạ mặc định. |
| `ShelfSkeleton` | Fallback cho `<Suspense>` theo nhóm kệ; tôn trọng `prefers-reduced-motion`. |
| Thẻ gian hàng | Tái dùng/tách thẻ `CoachesSection`; chế độ SALES_30D hiển thị "Bán N trong 30 ngày" chỉ khi N > 0 (🟡 cần Phong/Quốc chốt có hiện số này không — Q6). |

Header/footer: ✅ `site-header.tsx` hiện có mục "Khám phá tài liệu" là `<span>` (không phải link) và nav chỉ hiện từ
`lg` (chưa có bản mobile). GĐ2: đổi thành link "Cửa hàng" → `/cua-hang` + bản mobile (ADR-035 mục 1). Footer ✅ hiện
chỉ có link `/pricing` — thêm "Cửa hàng".

Trang chủ (tuỳ chọn, cần Quốc xác nhận phạm vi): chip danh mục và ô tìm của `SearchSection` trỏ về
`/cua-hang/tai-lieu?…`.

### 4.7 Trạng thái, SEO, a11y

- **Loading:** `ShelfSkeleton` trong `<Suspense>` theo nhóm (hero+danh mục / kệ sản phẩm / gian hàng).
- **Empty:** từng kệ rỗng → ẩn; toàn trang không có tài liệu Công khai → khối trạng thái rỗng (đề xuất Phong) với CTA
  mở gian hàng; trang tìm không kết quả → gợi ý bỏ lọc/danh mục phổ biến.
- **Error:** lỗi DB → `error.tsx` của route (thông điệp chung, có `requestId` theo quy ước); không lộ lỗi SQL.
- **SEO:** `generateMetadata` dùng `seoTitle/seoDescription` của dòng `shop`, fallback từ title hero + tên thương
  hiệu qua `getEffectiveBrand()` (ADR-032, không hard-code); canonical tuyệt đối `/cua-hang`; `/cua-hang/tai-lieu`
  canonical không query, đề xuất `robots: noindex` khi có `q` (🟡 đề xuất, Q7).
- **A11y:** một H1/trang; H2 mỗi section, H3 danh mục / H4 thẻ trong "Theo danh mục"; stretched link (một link/thẻ);
  label cho ô tìm/select; target ≥44px; không cuộn ngang ở 360px; `prefers-reduced-motion`; nhãn "#1" là chữ, không
  chỉ màu.

---

## 5. Thứ tự công việc

> **Tiến độ (cập nhật 2026-10-15, Long theo brief Quốc):** bước **1–15 xong** — GĐ1 (bước 2–6) và GĐ2 (bước 7–14) xong code, migration
> `20261015090000_adr035_unaccent_search` đã áp (bước 8), 6 slug dành riêng đã thêm + quét prod không trùng (bước 9), KB đã cập nhật
> (bước 15). Verify: lint/typecheck/build/`test:unit` đạt, `test:count` 93/52, dev server dữ liệu thật đạt. **Chưa commit, chưa deploy.**
> Việc còn lại: `docs/BACKLOG.md` mục "Phát sinh trong đợt Cửa hàng GĐ1/GĐ2 (ADR-035)". Đường dẫn file thật khác dự kiến ở §3.1
> (`admin/cms/shop/…` thay vì `shop-editor/…`) — xem KB `00-Index/KB-Audit-2026-09-26.md` §13. Các câu hỏi §7 đã được chốt trong
> `docs/DECISIONS.md` (ADR-035 bổ sung, "Chủ dự án chốt").

| Bước | Việc | Ai | Phụ thuộc | Ước lượng | Tiêu chí xong |
|---|---|---|---|---|---|
| 1 | Chốt các câu hỏi §7 (ít nhất Q1–Q4) | Quốc + chủ dự án | — | S | Ghi bổ sung vào ADR-035 |
| 2 | `shopSectionsSchema`, mặc định, `parseShopSections`, `SYSTEM_CMS_SLUGS` | Hiếu | 1 | M | lint/typecheck đạt |
| 3 | Chặn slug hệ thống ở CMS chung, `/p/[slug]`, danh sách CMS | Hiếu | 2 | S | `/p/home`, `/p/shop` 404; form chung từ chối |
| 4 | Actions nháp/xuất bản/khôi phục + option ghim/danh mục | Hiếu | 2 | M | Non-admin bị từ chối; upsert tạo dòng `shop` |
| 5 | Bố cục editor `/admin/cms/shop` + menu sidebar | Phong | 2 (contract) | M | A11y editor như §3.2 |
| 6 | Nối editor với actions, thử tay | Hiếu | 4, 5 | S | §3.2 đạt → **xong GĐ1**; Quốc review; Long ghi KB |
| 7 | Viết migration expand tìm không dấu (phương án đã chốt) | Hiếu | 1 | S | File SQL chỉ *thêm*; không chạy |
| 8 | Kiểm extension trên Neon, duyệt + chạy migration | **Quốc** | 7 | S | Migration áp dụng; bản deploy hiện tại không lỗi |
| 9 | Thêm 6 slug dành riêng; quét tenant trùng trên prod | Hiếu (code), **Quốc** (quét) | 1 | S | Không có tenant trùng (hoặc đã xử lý) |
| 10 | `lib/shop.ts`: loader kệ, gian hàng (30 ngày dưới `withSystemJob`), `searchShopProducts`, map nhãn loại vào core | Hiếu | 2, 8 | L | Một `withPublic` cho kệ, một `findMany` chi tiết; không đọc orders ở scope public |
| 11 | Tách `DocumentCard` (trang chủ dùng lại), `ProductShelf`, `CategoryGrid`, `ShopHero/ShopSearchForm`, `ShelfSkeleton` | Phong | contract §4.2 | L | Trang chủ không đổi giao diện ngoài ý muốn |
| 12 | Route `/cua-hang`, `/cua-hang/tai-lieu` (Suspense, empty/error, metadata) | Phong (JSX) + Hiếu (data/params) | 10, 11 | M | Đủ trạng thái loading/empty/error; ẩn section rỗng |
| 13 | Header/footer link "Cửa hàng" (+ mobile); tuỳ chọn chip/ô tìm trang chủ | Phong | 12 | S | Có link trên mobile |
| 14 | Verify tổng: lint, typecheck, test, test:count, dev server với dữ liệu thật (không tạo/xoá dữ liệu), responsive 360/768/1280, a11y | Hiếu + Phong | 12, 13 | M | Báo cáo verify; Quốc review `git diff` |
| 15 | Long cập nhật KB (spec Cửa hàng, API/loader contract, runbook UI, MOC, audit) | Long | 14 | S | — |

Ghi chú deploy (ADR-034): bước 8 chạy trước khi deploy code bước 10–12. Preview chỉ để xem giao diện.

---

## 6. Rủi ro

1. **Hiệu năng** — trang có ~8 nhóm truy vấn; mỗi request render động (ADR-031). Giảm bằng gom id + một `findMany`,
   `ROW_NUMBER` cho kệ theo danh mục, Suspense theo nhóm, cache ngắn dữ liệu thô. `LIKE '%q%'` không dùng index —
   chấp nhận được với catalog nhỏ hiện tại (❓ chưa đo số tài liệu Công khai thật), index trigram để nợ.
2. **An toàn dữ liệu §7.9** — số bán 30 ngày là truy vấn duy nhất chạm `orders`, chạy dưới `withSystemJob` (bỏ qua
   RLS). Bắt buộc: chỉ trả số đếm theo tenant, không nhận tham số tuỳ ý từ client ngoài danh sách tenant đã lọc,
   không dùng cho route admin. Option ghim cho admin chỉ dùng dữ liệu `withPublic` (✅ như trang chủ).
3. **Một DB duy nhất (ADR-034)** — migration chạy thẳng lên production: chỉ *thêm* extension/hàm (không DROP/RENAME);
   thử tay GĐ1 ghi dòng `shop` thật; Lưu nháp an toàn (không đổi bản live), Xuất bản ảnh hưởng `/cua-hang` thật (từ
   GĐ2). Dữ liệu demo `demo-*` của `phongweb` (ADR-034 mục 4) sẽ hiển thị trên Cửa hàng cho tới khi `demo:clean`.
4. **Slug** — tenant đã đăng ký `cua-hang`/… sẽ mất storefront khi route lên; phải quét trước deploy.
5. **Ghi đè CMS** — trước bước 3, form CMS chung vẫn có thể ghi đè `home`/`shop` (lỗi có sẵn, xem §2.2).
6. **Ngân sách test** — ✅ hiện 93/52, trần 94/53 (ADR-026, `scripts/count-tests.mjs`). Chủ dự án đang chọn **không
   thêm test** cho đợt này (🟡 theo brief Quốc). **Nợ test ghi nhận:** (a) unit `parseShopSections` (dữ liệu hỏng →
   mặc định, trùng type); (b) unit điều kiện "đánh giá cao" số nguyên; (c) integration tìm không dấu ("de thi" khớp
   "Đề thi") trong `withPublic`; (d) integration action CMS Cửa hàng từ chối non-admin; (e) unit slug dành riêng mới.
   Đề xuất đưa vào `docs/BACKLOG.md` khi Quốc giao.
7. **Tách `DocumentCard`** đụng trang chủ đang chạy production — cần so sánh trực quan trước/sau.

---

## 7. Câu hỏi còn mở (cho Quốc / chủ dự án)

- **Q1.** Dòng CMS `shop` chưa xuất bản (hoặc chưa tồn tại): `/cua-hang` render bằng **cấu hình mặc định** (đề xuất)
  hay 404?
- **Q2.** "Bán chạy" (kệ tài liệu) dùng `soldCount` **tổng mọi thời gian** (đề xuất, không chạm orders) hay cũng 30
  ngày? Và "bán 30 ngày" của gian hàng: đếm dòng `order_items` của đơn `FULFILLED` có `paidAt` trong 30 ngày — có loại
  entitlement đã thu hồi như `soldCount` không? (Order không có `fulfilledAt` ✅.)
- **Q3.** Thứ tự thẻ trong khối "Theo danh mục": như Nổi bật (đánh giá → mới) hay theo bán chạy?
- **Q4.** Chế độ SALES_30D khi ít tenant có bán trong 30 ngày: bù bằng tổng `soldCount` → đánh giá → mới (đề xuất) hay
  chỉ hiện tenant có bán?
- **Q5.** CMS thiếu một section (dữ liệu cũ/hỏng): tự thêm từ mặc định ở trạng thái **ẩn** hay **hiện**?
- **Q6.** Thẻ gian hàng có hiển thị con số "bán N trong 30 ngày" công khai không, hay chỉ dùng để xếp hạng?
- **Q7.** Một tài liệu được phép xuất hiện ở nhiều kệ cùng lúc (Nổi bật + Bán chạy + Mới…)? Đề xuất: cho phép.
- **Q8.** `/cua-hang/tai-lieu?q=…` đặt `noindex`? Sắp xếp `noi-bat` khi có `q` giữ như Nổi bật hay ưu tiên khớp tiêu đề?
- **Q9.** Có đổi chip/ô tìm trang chủ sang `/cua-hang/tai-lieu` trong đợt này không?
- **Q10.** Gọi `withSystemJob` trong luồng render public cho số 30 ngày có chấp nhận được (§4.3)?

---

[[MOC-Home]] — chỉ mục KB: `obsidian-knowledge-base/00-Index/MOC-Home.md`

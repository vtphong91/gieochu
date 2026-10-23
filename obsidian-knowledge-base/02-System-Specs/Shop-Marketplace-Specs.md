---
tags:
  - spec
  - marketplace
  - system-admin
  - product
  - status/living
date: 2026-10-15
updated: 2026-10-23
author: Long (tài liệu)
---

# 📐 Đặc Tả: Trang Cửa Hàng (Marketplace) — CMS `shop` (GĐ1) và Trang Công Khai (GĐ2)

> **Nguồn quyết định:** ADR-035 + "Bổ sung ADR-035" + "Chủ dự án chốt" (2026-10-15) trong
> [`docs/DECISIONS.md`](../../docs/DECISIONS.md) — bản trích
> [[01-Architecture-Decisions/ADR-021-Shop-Marketplace-Cms-First|ADR-021 (KB)]]. Kế hoạch:
> [`docs/ke-hoach-cua-hang-marketplace-2026-10-15.md`](../../docs/ke-hoach-cua-hang-marketplace-2026-10-15.md).
> Mức xác minh: ✅ Long đã đọc code ngày 2026-10-15 (working tree, chưa commit) · 🟡 theo `docs/DECISIONS.md`/kế hoạch/brief/báo cáo
> của Quốc · ❓ cần môi trường thật.
> **Trạng thái chung:** **GĐ1 + GĐ2 xong code, chưa commit, chưa deploy.** Verify theo báo cáo của Quốc 🟡: lint, typecheck, build,
> `test:unit` đạt; thử trên dev server với dữ liệu thật đạt. Không thêm test ở đợt này — `pnpm test:count` = 93/94 unit, 52/53
> integration ✅ (Long chạy 2026-10-15, không đổi). Nợ test + việc chưa kiểm: §10.

## 1. Phạm Vi

| Giai đoạn | Nội dung | Trạng thái |
|---|---|---|
| **GĐ1 — CMS Cửa hàng** | Editor `/admin/cms/shop` trong System Center: nội dung hero, tiêu đề/mô tả/ẩn-hiện/thứ tự 9 section, ghim tài liệu nổi bật riêng của Cửa hàng, chế độ + ghim gian hàng nổi bật, ngưỡng đánh giá cao; nháp/xuất bản/khôi phục. Lưu `CmsPage` slug `shop` — **không DDL**. Chặn slug hệ thống ở CMS chung. | ✅ xong code |
| **GĐ2 — Trang công khai** | `/cua-hang`, `/cua-hang/tai-lieu` đọc cấu hình CMS + dữ liệu thật qua `apps/web/lib/shop.ts`, tìm không dấu (migration expand `unaccent`), số bán 30 ngày dưới `withSystemJob`, 6 slug tenant dành riêng, link header/footer + menu mobile, `DocumentCard`/`TenantCard` dùng chung với trang chủ. | ✅ xong code |

Ngoài phạm vi (nợ theo ADR-035): trang danh mục SEO `/cua-hang/danh-muc/[slug]`, `Product.publishedAt` (kệ "Mới" tạm dùng
`createdAt`), `DocumentCategory.iconKey/sortOrder`, index cho catalog lớn, carousel.

## 2. Lưu Trữ — `CmsPage` slug `shop` ✅

- Bảng `cms_pages` (L1, không RLS) — `blocks` = bản live, `blocksDraft` = nháp, `status` `DRAFT|PUBLISHED`. Đọc/ghi bằng
  `getPrismaClient()` (đúng quy tắc L1) ✅ (`apps/web/lib/shop-cms.ts`, `apps/web/app/admin/cms/shop/actions.ts`, `apps/web/lib/shop.ts`).
- **Không seed** (ADR-034). Dòng `shop` được tạo bằng `upsert` ở lần Lưu nháp/Xuất bản đầu tiên, `title = "Cửa hàng"` ✅.
- Trạng thái (`ShopCmsStatus`) và tác động lên trang công khai ✅:

| Trạng thái | Điều kiện | Trang `/cua-hang` dùng |
|---|---|---|
| `NONE` | Chưa có dòng `shop` | `defaultShopSections()`; editor báo "Chưa lưu lần nào" |
| `DRAFT` | Có dòng, `status = DRAFT` (chưa từng xuất bản) | `defaultShopSections()` — **không 404** (ADR-035 bổ sung); nháp không lộ ra ngoài |
| `PUBLISHED` | Có dòng, `status = PUBLISHED` | `parseShopSections(blocks)`; JSON không đọc được → mặc định + `logger.warn` |

- Nạp editor (`getShopCmsEditorData`) ✅: `live` = `parseShopSections(blocks)` (không có dòng/không đọc được → mặc định);
  bản đang soạn = nháp ?? live; `hasDraft` = `blocksDraft` khác null.
- `seoTitle`/`seoDescription` của dòng `shop`: trang công khai **đã đọc** (§6.3, chỉ khi `PUBLISHED`) ✅, nhưng editor **vẫn chưa
  có ô sửa** và actions không ghi hai cột này ✅ → hiện luôn rơi về nhánh dự phòng. BACKLOG.

## 3. Schema 9 Section (`packages/core/src/admin/shop-sections.ts`) ✅

Mảng có thứ tự (= thứ tự hiển thị), mỗi phần tử `{ id, type, visible, data }`, mỗi `type` tối đa 1 lần, `id` không trùng,
`id` ≤ 64 ký tự. Thứ tự mặc định = `SHOP_SECTION_TYPES`, id mặc định `shop-{type}`, tất cả hiện. Mọi ô chữ bắt buộc (trim,
không rỗng). File chỉ import zod + helper thuần, không chuỗi thương hiệu.

| # | `type` (nhãn) | Field `data` | Giới hạn | Mặc định |
|---|---|---|---|---|
| 1 | `hero` (Hero — Tìm kiếm) | `eyebrow`, `title`, `subtitle`, `searchLabel`, `searchPlaceholder`, `popularChips {mode, categoryIds, max}`, `imageUrl?` | 60/120/240/60/100 ký tự; chip `max` 3–8; `categoryIds` ≤8; ảnh phải là Cloudinary (server kiểm thêm đúng cloud hệ thống) | chip `AUTO`, `max` 6; không ảnh = minh hoạ mặc định |
| 2 | `categories` (Danh mục) | `title`, `subtitle`, `maxVisible` | `maxVisible` 6–24 | 12 |
| 3 | `featured` (Tài liệu nổi bật) | `title`, `subtitle`, `limit`, `pinnedProductIds` | `limit` 4–12; ghim ≤12, không trùng | 8, `[]` |
| 4 | `byCategory` (Theo từng danh mục) | `title`, `subtitle`, `mode`, `categoryIds`, `blockCount`, `cardsPerBlock` | `blockCount` 1–6; `cardsPerBlock` 2–4; `categoryIds` ≤6 | `AUTO`, 6 khối × 4 thẻ |
| 5 | `bestSellers` (Bán chạy) | `title`, `subtitle`, `limit` | 4–12 | 8 |
| 6 | `topRated` (Đánh giá cao) | `title`, `subtitle`, `limit`, `minReviews`, `minAvgTenths` | `minReviews` 1–50; `minAvgTenths` 10–50 | 8, 3, 40 (= 4,0) |
| 7 | `featuredTenants` (Gian hàng nổi bật) | `title`, `subtitle`, `mode`, `limit`, `pinnedTenantIds`, `minReviews` | `mode` `SALES_30D`/`TOP_RATED`; `limit` 3–12; ghim ≤12; `minReviews` 1–50 (chỉ dùng ở `TOP_RATED`) | `SALES_30D`, 4, `[]`, 3 |
| 8 | `newest` (Mới cập nhật) | `title`, `subtitle`, `limit` | 4–12 | 8 |
| 9 | `ctaOpenStore` (Kêu gọi mở gian hàng) | `eyebrow`, `title`, `description`, `cta {label, href}` | 60/120/300/60 ký tự; `href` đường dẫn nội bộ `/…` (không `//`, không ký tự điều khiển/backslash, ≤200) | `href` `/register` |

- Chế độ danh mục (`hero.popularChips`, `byCategory`): `AUTO` = danh mục nhiều tài liệu Công khai nhất; `MANUAL` = chọn tay,
  **cần ≥1 danh mục** (schema chặt `refine`) ✅. Cách chọn lúc render: §5.
- **Hai cách parse** ✅:
  - Lưu: `shopSectionsSchema` (chặt) — client chạy cùng schema để báo lỗi sớm, server luôn validate lại.
  - Đọc (render + nạp editor): `parseShopSections` (phòng thủ) — không phải mảng → `null` (caller dùng mặc định); phần tử
    hỏng/`type` lạ → bỏ; trùng `type` → giữ phần tử đầu; `id` thiếu/sai/trùng → id mặc định (thêm hậu tố nếu vẫn trùng);
    `visible` không phải boolean → `true`; field hỏng → mặc định **của field đó** (không bỏ cả section); id ghim lọc trim/
    1–64 ký tự/không trùng/cắt theo trần; `MANUAL` mà không còn danh mục → về `AUTO`; ảnh hero không phải Cloudinary → bỏ;
    `cta.href` không hợp lệ → `/register`; **type còn thiếu → thêm cuối mảng ở trạng thái ẩn**. Lưới an toàn: kết quả
    chuẩn hoá phải qua schema chặt, không qua → mặc định của section (giữ `id`/`visible`). Kết quả luôn đủ 9 section.
  - `resolveShopSections(input)` = `parseShopSections(input) ?? defaultShopSections()`. Trang công khai **không** gọi hàm này mà
    tự xét `status` ở `getShopCmsSections()` (§6.1) ✅.

### 3.1 Ngưỡng điểm ×10 ✅

- Lưu số nguyên `minAvgTenths` (40 = 4,0), không float. `formatShopAvgTenths(40)` → `"4,0"`;
  `parseShopAvgTenthsInput` nhận `"4,0"` | `"4.0"` | `"4"`, tối đa 1 chữ số thập phân, ngoài 1,0–5,0 → `null`.
- Điều kiện "đánh giá cao" khi render: `ratingCount ≥ minReviews` **và** `ratingSum * 10 ≥ minAvgTenths * ratingCount` (so sánh
  số nguyên trong SQL) ✅ `getShopProductShelves` — khớp quyết định Quốc xác nhận 2026-10-15.

## 4. Định Nghĩa "Công Khai" và Cổng Dữ Liệu ✅

- **"Công khai"** = `products.status = 'PUBLISHED'` **và** `tenants.status = 'ACTIVE'` (hằng `PUBLIC_PRODUCT_WHERE`, nay export từ
  `apps/web/lib/home.ts`; SQL thô dùng cùng điều kiện).
- Mọi truy vấn sản phẩm/đánh giá/đếm theo danh mục/aggregate tenant chạy trong **`withPublic`** — RLS `products` scope public là
  cổng thật (chỉ thấy PUBLISHED).
- **Ngoại lệ duy nhất chạm `orders`**: `getTenantSales30d` dưới `withSystemJob` (§5.3) — chỉ trả số đếm theo tenant, chỉ để xếp hạng,
  không hiển thị, không dùng cho route admin (§7.9).
- `cms_pages`, `tenants` (tra chủ gian hàng cho CTA) là L1 → `getPrismaClient()`.
- Giá hiệu lực (khuyến mãi theo khung giờ) luôn tính lúc render qua `toPublicProducts` — không cache giá.
- Một tài liệu được xuất hiện ở nhiều kệ cùng lúc (chủ dự án chốt).

## 5. Quy Tắc Kệ ✅ (`apps/web/lib/shop.ts`)

### 5.1 Danh mục, chip hero

| Phần | Quy tắc |
|---|---|
| Danh sách danh mục (`loadShopCategories`) | `document_categories.isActive` có ≥1 tài liệu Công khai; số tài liệu ↓ → tên (`localeCompare` "vi") |
| Chip hero | `AUTO`: `max` danh mục đầu danh sách trên. `MANUAL`: `categoryIds` theo thứ tự, bỏ id tắt/không còn tài liệu, tối đa `max` |
| Lưới "Danh mục" | Toàn bộ danh sách; `maxVisible` ô hiện ngay, phần dư trong `<details>` (UI) |
| Select danh mục của ô tìm | Toàn bộ danh sách — kể cả khi admin ẩn section "Danh mục" (page bổ sung section mặc định cho loader, không tốn thêm truy vấn) |

### 5.2 Kệ tài liệu (`getShopProductShelves`)

Một `withPublic`: lấy **id** từng kệ bằng truy vấn nhẹ → gom id duy nhất → **một** `findMany` chi tiết (`PUBLIC_PRODUCT_SELECT` +
tenant) → `toPublicProducts` một lần → phân lại theo thứ tự từng kệ. Section ẩn → kệ rỗng, không truy vấn.

| Kệ | Lọc | Sắp xếp |
|---|---|---|
| Nổi bật | Ghim trước (bỏ trùng, cắt theo `limit`, bỏ id không còn Công khai, giữ đúng thứ tự ghim), thiếu thì bù bằng `fillProductIdsQuery` (của trang chủ) | Bù: có đánh giá trước → điểm TB ↓ → số đánh giá ↓ → `createdAt` ↓ |
| Theo danh mục | Khối = `pickCategories(..., blockCount)` như chip hero; mỗi khối ≤ `cardsPerBlock` thẻ — **một** truy vấn `ROW_NUMBER() OVER (PARTITION BY categoryId)`; khối 0 thẻ → bỏ | `soldCount` ↓ → có đánh giá → điểm TB ↓ → số đánh giá ↓ → `createdAt` ↓ → `id` |
| Bán chạy | `soldCount > 0` | `soldCount` ↓ → `ratingCount` ↓ → `createdAt` ↓ → `id`; UI hiện nhãn "#1", "#2"… |
| Đánh giá cao | §3.1 | điểm TB ↓ (`ratingSum::numeric / ratingCount`) → `ratingCount` ↓ → `createdAt` ↓ → `id` |
| Mới cập nhật | — | `createdAt` ↓ → `id` (tạm, chưa có `publishedAt`) |

`soldCount` là cột cache tổng mọi thời gian (ADR-033), không đọc `orders`.

### 5.3 Gian hàng nổi bật (`getShopFeaturedTenants`) và số bán 30 ngày

- Ứng viên: tenant `ACTIVE` có ≥1 tài liệu PUBLISHED. Ghim trước (bỏ trùng, cắt theo `limit`, bỏ tenant không hợp lệ, giữ thứ tự
  ghim), rồi bù cho đủ `limit` theo chế độ:
  - **`SALES_30D`**: bán 30 ngày ↓ → tổng `soldCount` ↓ → điểm TB tổng ↓ → tổng số đánh giá ↓ → tenant `createdAt` ↓ → `id`. Tenant
    không bán trong 30 ngày tự thành phần bù (ADR-035 bổ sung).
  - **`TOP_RATED`**: `SUM(ratingCount) ≥ minReviews`; điểm TB tổng ↓ → số đánh giá ↓ → tenant `createdAt` ↓. **Không bù** tenant
    chưa đạt ngưỡng — kệ có thể ít hơn `limit` (BACKLOG ghi nhận).
- Luồng 3 bước: (1) `withPublic` — tenant ghim hợp lệ + danh sách id tenant Công khai; (2) `getTenantSales30d(ids)` chỉ cho tập đã
  lọc ở bước 1 (không nhận tham số từ client); (3) `withPublic` — truy vấn bù, số 30 ngày truyền vào dạng bảng `VALUES` tham số hoá.
- **`getTenantSales30d`** — `withSystemJob`, đếm dòng `order_items` của đơn `FULFILLED` có `paidAt` trong 30 ngày, **loại dòng có
  entitlement đã thu hồi** (cùng công thức `recomputeProductSoldCounts`; đơn REFUNDED không phải FULFILLED nên không tính). Tính
  **toàn bộ** tenant một lần, cache **trong bộ nhớ mỗi instance server**, TTL 5 phút, gộp lời gọi đồng thời (inflight); trả
  `Map<tenantId, number>` (chỉ tenant > 0). Lỗi DB → log, trả map rỗng (xếp hạng rơi về tổng đã bán), **không cache lỗi**.
- Số 30 ngày (`ShopFeaturedTenant.sales30d`) **chỉ dùng xếp hạng, không hiển thị** (chủ dự án chốt) — `TenantCard` hiện tổng đã bán +
  sao, bỏ qua `sales30d` ✅.
- ❓ Hiệu năng truy vấn 30 ngày trên production và hành vi cache khi chạy serverless nhiều instance (Vercel) chưa đo.

### 5.4 CTA mở gian hàng (`shouldShowOpenStoreCta`)

- Ẩn khi người xem đã là **chủ** một gian hàng (`tenants.ownerId`, L1). Khách chưa đăng nhập → hiện.
- Giới hạn ✅ (ghi trong code): **chưa xét thành viên STAFF** (`tenant_members` có RLS chỉ cho scope tenant/system_job, và chưa có
  luồng tạo STAFF) — BACKLOG.

## 6. Trang Công Khai ✅

Không có `route.ts` mới — chỉ page (Server Component) + layout/loading/error. Danh bạ:
[[03-API-Contracts/Endpoint-Directory|Endpoint-Directory]] §16.

### 6.1 `/cua-hang` (`app/cua-hang/page.tsx`)

- `getShopCmsSections()` (`cache()` theo request, dùng chung cho page + `generateMetadata`) → chỉ section `visible`, đúng thứ tự CMS.
- Dữ liệu chia **3 nhóm loader**, mỗi nhóm gọi **một lần**: (a) chip hero + danh mục (`getShopHeroAndCategories`) + số liệu hero
  (`getShopHeroStats`, gọi tối đa 1 lần qua `once()`); (b) kệ tài liệu (`getShopProductShelves`); (c) gian hàng
  (`getShopFeaturedTenants`). Mỗi section có `<Suspense>` riêng **tại đúng vị trí** của nó, các section cùng nhóm chờ chung một
  promise — thứ tự CMS xen kẽ nhóm vẫn đúng.
- Section rỗng → component trả `null` (ẩn).
- **Trạng thái rỗng toàn trang** (`CatalogEmptyGate`, đặt ngay dưới hero): chỉ hiện khi mọi kệ tài liệu rỗng **và** hệ thống thật sự
  có 0 tài liệu Công khai (kệ rỗng do admin ẩn hết section kệ thì không tính). CTA trong khối rỗng chỉ hiện khi section CTA riêng
  đang ẩn và người xem chưa là chủ gian hàng (tránh 2 nút "Mở gian hàng" liền nhau).
- **Hero bị ẩn** trong CMS → trang render H1 dự phòng "Cửa hàng tài liệu" (luôn một H1).
- Nền xen kẽ `paper`/`alt` giữa các section nội dung (hero và CTA có nền riêng).
- Link "Xem tất cả" mỗi kệ → `/cua-hang/tai-lieu?sap-xep=…` (Nổi bật → không tham số; Bán chạy `ban-chay`; Đánh giá cao
  `danh-gia-cao`; Mới `moi-nhat`); khối theo danh mục → `?danh-muc={slug}`.
- `layout.tsx` riêng của segment `cua-hang` chứa `SiteHeader current="shop"` + `<main>` + `SiteFooter` → `loading.tsx`/`error.tsx` vẫn
  nằm trong khung có header/footer.

### 6.2 `/cua-hang/tai-lieu` (`app/cua-hang/tai-lieu/page.tsx`)

| Tham số | Parse (`parseShopSearchParams`, không bao giờ ném, không 404) |
|---|---|
| `q` | NFC, trim, cắt 100 ký tự (`SHOP_SEARCH_Q_MAX`); rỗng → bỏ |
| `danh-muc` | Slug `[a-z0-9-]` ≤100 ký tự, sai dạng → bỏ. Không tồn tại / danh mục đã tắt → bỏ lọc + ghi chú "Không tìm thấy danh mục bạn chọn…" |
| `sap-xep` | `noi-bat` (mặc định) \| `ban-chay` \| `danh-gia-cao` \| `moi-nhat`; lạ → `noi-bat` |
| `trang` | Số nguyên ≥1, sai → 1; vượt số trang → kẹp về trang cuối + ghi chú "Trang N không tồn tại — đang hiện trang cuối" |

- 24 thẻ/trang (`SHOP_SEARCH_PAGE_SIZE`). `shopSearchHref()` dựng URL, bỏ tham số mặc định (`sap-xep=noi-bat`, `trang=1`).
- **Tìm không dấu** (`searchShopProducts`, một `withPublic`): khớp `public.gieochu_unaccent(lower(col)) LIKE '%' ||
  public.gieochu_unaccent(lower($q)) || '%' ESCAPE '\'` trên **tiêu đề, `summary`, tên tenant, tên danh mục (chỉ danh mục đang bật)**.
  `q` được escape `\`, `%`, `_` (`escapeLikePattern`) và truyền tham số qua `Prisma.sql` — không nối chuỗi. Hàm DB: §9.
- Sắp xếp: `ban-chay`/`danh-gia-cao`/`moi-nhat` cùng thứ tự kệ tương ứng (§5.2, không lọc `soldCount > 0`/ngưỡng); `noi-bat` = như kệ
  Nổi bật, **có `q` thì khớp tiêu đề lên trước** (ADR-035 bổ sung).
- Không kết quả → `ShopNoResults`: gợi ý bỏ từ khoá/bỏ danh mục/"Xem tất cả tài liệu" + tối đa 8 chip danh mục phổ biến.
- Ô tìm lấy nhãn/placeholder theo hero CMS (nếu đang bật), không thì mặc định.

### 6.3 SEO

| Trang | `title` | `description` | canonical | robots |
|---|---|---|---|---|
| `/cua-hang` | `seoTitle` của dòng `shop` (chỉ khi PUBLISHED) ?? `"{tiêu đề hero ?? "Cửa hàng"} \| {brand.name}"` | `seoDescription` ?? mô tả hero ?? `brand.slogan` | `APP_URL` + `/cua-hang` | mặc định |
| `/cua-hang/tai-lieu` | có `q`: `Kết quả cho "{q}" \| {brand}`; không `q`: `Tài liệu \| {brand}` (lọc danh mục **chưa** đưa tên danh mục vào title — BACKLOG) | chuỗi cố định | `APP_URL` + `/cua-hang/tai-lieu` (**không** query) | có `q` → `noindex, follow` |

Tên thương hiệu qua `getEffectiveBrand()` (ADR-032) ✅. `getShopSeo()` không lấy `seoTitle/seoDescription` khi dòng chưa PUBLISHED.

### 6.4 Loading / error

- `loading.tsx`: `/cua-hang` → skeleton hero + 2 kệ; `/cua-hang/tai-lieu` → dải tiêu đề + form giữ chỗ + lưới thẻ.
- `error.tsx` (client, chung cho cả hai trang): thông điệp chung "Không tải được Cửa hàng", **không** hiển thị `error.message`; hiện
  `error.digest` làm "Mã tham chiếu" khi có; nút "Thử lại" (`retry()`) + link về trang chủ. Lệch nhỏ so với kế hoạch §4.7 (ghi
  `requestId`) — code dùng `digest` của Next (KB-Audit §14).

## 7. Slug Tenant Dành Riêng ✅

- `RESERVED_SLUGS` (`packages/core/src/tenant/slug.ts`) thêm 6 slug: `cua-hang`, `tai-lieu`, `danh-muc`, `tim-kiem`, `giao-vien`,
  `kham-pha` — route tĩnh `app/cua-hang` thắng `app/[tenantSlug]`, tenant mang slug này sẽ mất storefront.
- `RESERVED_PRODUCT_SLUGS` không đổi (`/cua-hang` là route cấp gốc, không phải segment con của `/[tenantSlug]`).
- Quét production: **không có tenant trùng** 🟡 (Quốc quét, Long không truy vấn DB — ADR-034). Cần quét lại ngay trước deploy nếu có
  tenant mới đăng ký trong khoảng chờ.

## 8. Server Actions & Quyền (CMS — GĐ1) ✅

Chi tiết contract: [[03-API-Contracts/Endpoint-Directory|Endpoint-Directory]] §15.

| Hàm | Quyền | Việc |
|---|---|---|
| Trang `/admin/cms/shop` | `requireAdminAccess` (chưa đăng nhập → `/login?next=`; không phải SYSTEM_ADMIN → 404) | Nạp `getShopCmsEditorData()`; segment tĩnh `shop` thắng `[slug]` nên chạy được khi chưa có dòng |
| `saveShopDraftAction` | `requireRole("SYSTEM_ADMIN")` | Validate chặt → `upsert`: có dòng → chỉ ghi `blocksDraft`; chưa có → tạo dòng `DRAFT`, `blocks` = mặc định |
| `publishShopAction` | `requireRole("SYSTEM_ADMIN")` | Validate chặt → `upsert`: `blocks` = bản gửi, `blocksDraft` = null, `PUBLISHED`; revalidate `/admin/cms/shop`, `/admin/cms`, `/cua-hang`, `/cua-hang/tai-lieu` |
| `restoreLiveShopAction` | `requireRole("SYSTEM_ADMIN")` | `updateMany` xoá `blocksDraft`; chưa có dòng → không làm gì |
| `searchShopCategoryOptionsAction` | `requireRole("SYSTEM_ADMIN")` | Tìm danh mục cho bộ chọn tay |
| Ô ghim tài liệu/gian hàng | `requireRole("SYSTEM_ADMIN")` | **Dùng chung** `searchHomeProductOptionsAction`/`searchHomeTenantOptionsAction` của CMS trang chủ |

- Ảnh hero: schema chỉ kiểm host Cloudinary; server kiểm thêm đúng cloud hệ thống (`getSystemCloudinaryCloudName`, ADR-028) ✅.
- Lỗi `AppError` có `expose` → trả `{ error }`; lỗi khác ném tiếp ✅. Server Action dựa CSRF sẵn của Next (§7.7).
- Ghim/chọn là **riêng của Cửa hàng** — không ảnh hưởng ghim trang chủ ✅ (lưu trong dòng `shop`).
- Ô chọn danh mục (`listCategoryPinOptions`, `apps/web/lib/home.ts`, `withPublic`): danh mục `isActive` A→Z tối đa 200 + id đang chọn
  (kể cả đã tắt) xếp trước; `productCount` = tài liệu Công khai; `eligible = isActive && productCount > 0`; trả kèm tối đa 14 id đang
  chọn (= 8 chip + 6 khối). Editor nạp sẵn option cho id ở **cả bản đang soạn lẫn bản live**.
- **Slug CMS hệ thống** (`packages/core/src/admin/cms-slugs.ts`): `SYSTEM_CMS_SLUGS = ["home","shop"]` (trạng thái ADR-035; nay 4 slug `home`/`shop`/`pricing`/`menu` — ADR-041, ADR-050), `isSystemCmsSlug` (trim + chữ
  thường). Form CMS chung từ chối; `/p/home`, `/p/shop` → 404; `/admin/cms/[slug]` với slug hệ thống khác `home` → 404; danh sách
  `/admin/cms` hiện đường dẫn `/` / `/cua-hang` và link editor riêng.
- ⚠️ Editor vẫn để hằng `PUBLIC_PAGE_READY = false` (`shop-sections-editor.tsx`) → còn hiện ghi chú "Trang công khai /cua-hang có ở giai
  đoạn 2 — Xem trang chưa mở được" dù GĐ2 đã có route ✅ (KB-Audit §14).

## 9. Tìm Không Dấu — Hàm DB `gieochu_unaccent` ✅ / 🟡

- Migration expand `20261015090000_adr035_unaccent_search` ✅ (đọc SQL): `CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA public`;
  hàm `public.gieochu_unaccent(text)` `LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT` = `public.unaccent('public.unaccent'::regdictionary,
  translate($1, 'đĐ', 'dD'))`; GRANT EXECUTE trên `unaccent(regdictionary, text)` và `gieochu_unaccent(text)` cho `gieochu_app` (bọc
  `IF EXISTS` role). Không tạo index. Prisma không quản lý extension/hàm (không khai trong `schema.prisma`).
- Đã áp lên DB 2026-10-15; kiểm `gieochu_unaccent(lower('Đề thi Toán học'))` = `de thi toan hoc` 🟡 (theo báo cáo Quốc; extension
  `unaccent` 1.1, schema public, trusted).
- Lược đồ: [[03-API-Contracts/Database-Schema-Reference|Database-Schema-Reference]] §7.

## 10. Chưa Verify / Nợ

| Mục | Mức |
|---|---|
| Lint/typecheck/build/`test:unit` đạt; dev server với dữ liệu thật đạt | 🟡 (báo cáo Quốc — Long chỉ chạy `test:count`) |
| `pnpm test:integration` cho đợt này | ❓ không có trong báo cáo verify |
| Chưa kiểm thực tế: trạng thái rỗng toàn trang, `error.tsx` khi lỗi thật, phân trang nhiều trang, nhánh SEO từ CMS đã xuất bản (`seoTitle/seoDescription`) | ❓ |
| Thử tay GĐ1 chi tiết (`NONE` → Lưu nháp → Xuất bản → Khôi phục; non-admin bị từ chối; `/admin/cms/new` slug `shop`/`home` báo lỗi; `/p/shop`, `/p/home` 404) — báo cáo "dev server đạt" không nêu riêng | ❓ |
| Nợ test — unit: `productTypeLabel`, 6 slug dành riêng mới, `parseShopSearchParams`/`escapeLikePattern`, điều kiện đánh giá cao, `parseShopSections`; integration: tìm không dấu trong `withPublic`, `getTenantSales30d` loại entitlement thu hồi, `ROW_NUMBER` kệ danh mục, action CMS shop từ chối non-admin | ✅ chưa có (BACKLOG) |
| UI sửa `seoTitle`/`seoDescription` cho dòng `shop` | ✅ chưa có (BACKLOG) |
| `PUBLIC_PAGE_READY` còn `false` trong editor | ✅ (BACKLOG) |
| Commit, deploy | chưa |

## 11. Liên Kết

* [[MOC-Home]] ([MOC-Home.md](../00-Index/MOC-Home.md)) · [[02-System-Specs/README|02-System-Specs]] ([README.md](./README.md))
* [[01-Architecture-Decisions/ADR-021-Shop-Marketplace-Cms-First|ADR-021 (≙ ADR-035)]] ([ADR-021-Shop-Marketplace-Cms-First.md](../01-Architecture-Decisions/ADR-021-Shop-Marketplace-Cms-First.md))
* [[01-Architecture-Decisions/ADR-019-Home-Page-Real-Data-Sold-Count|ADR-019 (≙ ADR-033)]] — mẫu CMS trang chủ, `soldCount` ([ADR-019-Home-Page-Real-Data-Sold-Count.md](../01-Architecture-Decisions/ADR-019-Home-Page-Real-Data-Sold-Count.md))
* [[03-API-Contracts/Endpoint-Directory|Endpoint-Directory]] §15–§16 ([Endpoint-Directory.md](../03-API-Contracts/Endpoint-Directory.md))
* [[03-API-Contracts/Database-Schema-Reference|Database-Schema-Reference]] §7 — migration `unaccent` ([Database-Schema-Reference.md](../03-API-Contracts/Database-Schema-Reference.md))
* [[04-Operations-Runbooks/UI-Design-System|UI-Design-System]] §13–§14 ([UI-Design-System.md](../04-Operations-Runbooks/UI-Design-System.md))
* [[00-Index/KB-Audit-2026-09-26|KB-Audit-2026-09-26]] §13–§14 ([KB-Audit-2026-09-26.md](../00-Index/KB-Audit-2026-09-26.md))

*Quay lại: [[MOC-Home]] (../00-Index/MOC-Home.md)*

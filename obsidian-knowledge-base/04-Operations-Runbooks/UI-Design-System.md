---
tags:
  - runbook
  - ui-ux
  - design-system
  - status/living
date: 2026-05-24
updated: 2026-10-27
author: System Architect
---

# 🚀 Cẩm Nang: Hệ Thống Thiết Kế Giao Diện (UI Design System)

> **Người phụ trách & công cụ:** Phong (sub-agent `phong`, UX/UI) là owner thiết kế — nhận việc qua brief của
> Quốc, dùng skill `ui-ux-pro-max` để tra quy tắc UX/accessibility/responsive và pattern Next.js; hệ thống thị
> giác ghi trong trang này ưu tiên hơn gợi ý của skill. Long ghi nhận quyết định thiết kế (token, component,
> bố cục) vào trang này khi Quốc giao. Xem [[06-AI-Agent-Guides/Team-Charter|Team-Charter]]
> ([Team-Charter.md](../06-AI-Agent-Guides/Team-Charter.md)) §3.

## 1. Mục Tiêu & Kiến Trúc Chung

Gieo Chữ chỉ có **một** ứng dụng web (`apps/web`, Next.js 16 App Router, Tailwind CSS), chia thành các vùng
giao diện theo layer đã định nghĩa trong `docs/ARCHITECTURE.md`:

- **Trang công khai** (`/`, `/p/[slug]`, `/[tenantSlug]/...`) — marketing + storefront khách hàng.
- **System Center** (`/admin/*`) — L1, dành cho System Admin (chỉ đọc `tenant_daily_stats` + bảng L1, không
  bao giờ đọc chi tiết đơn hàng/khách hàng của tenant — CLAUDE.md mục 7.9).
- **Studio** (`/studio/[tenantSlug]/*`) — L2, dành cho chủ tenant/staff quản lý sản phẩm, đơn hàng, coupon.

**Quyết định kiến trúc quan trọng đang áp dụng:** System Center và Studio **dùng chung một bộ component
UI** — `apps/web/app/admin/_ui/kit.tsx` và `apps/web/app/admin/_ui/icons.tsx` — thay vì mỗi vùng tự có bộ
component riêng. Studio import trực tiếp từ thư mục `admin/_ui` bằng đường dẫn tương đối xuyên ranh giới
route group, ví dụ:

```ts
// apps/web/app/studio/[tenantSlug]/products/page.tsx
import { AdminPageHeader, Badge, DataTable, EmptyState, PrimaryLinkButton, Td, Tr } from "../../../admin/_ui/kit";
```

Có ít nhất 20 file trong `apps/web/app/studio/**` import theo cách này. Đây là lựa chọn có chủ đích để giữ
**một hệ thống thị giác duy nhất** giữa hai khu vực quản trị (System Center + Studio) — tránh phân mảnh
component khi cả hai đều là "trang quản trị dạng bảng/form" có nhu cầu UI giống nhau (bảng dữ liệu, badge
trạng thái, form cấu hình). Việc tên thư mục là `admin/_ui` (chứ không phải một package `@gieochu/ui` trung
lập) là nợ kỹ thuật đã biết — nếu tách `apps/web/app/admin` sang route group khác trong tương lai, cần rời
`_ui` sang một vị trí không gắn với riêng "admin" trước.

### 1.1. Chrome trang public: `SiteHeader` / `SiteFooter` (ADR-025)

> Nguồn: ADR-025 trong `docs/DECISIONS.md` — bản trích
> [[01-Architecture-Decisions/ADR-011-Tenant-Owns-Storefront-Content-Only|ADR-011 (KB)]]. ✅ đã đọc code 2026-09-26.

- **Header/footer trên mọi trang public là của hệ thống**, không thuộc CMS, không thuộc tenant.
  `SiteHeader` (`apps/web/app/_ui/site-header.tsx`) và `SiteFooter` (`apps/web/app/_ui/site-footer.tsx`) là chrome
  **bắt buộc** cho trang public — trang public mới phải dùng 2 component này, không tự dựng header/footer.
- Cả hai là **async Server Component**, tự đọc dữ liệu (từ ADR-035 GĐ2, `SiteHeader` nhận **một prop tuỳ chọn** `current?: SiteNavKey`
  — `"shop" | "pricing"` — xem cuối mục; `SiteFooter` không nhận prop): `getEffectiveBrand()` +
  `getEffectiveLogos()` (có `cache()` theo request); riêng `SiteHeader` đọc thêm người dùng hiện tại
  (`getCurrentUser()`) — đã đăng nhập thì truy vấn `user` (email + `profile.fullName`) và `resolveLandingPath` để hiện
  `AccountMenu` (mục "Trang quản trị hệ thống" cho `/admin`, "Quản lý gian hàng" cho `/studio/*`); chưa đăng nhập thì
  hiện "Đăng nhập" + "Mở gian hàng miễn phí".
- **Tự gắn font hệ thống** (`systemFontVars`) và màu hệ thống (`brandColors`) lên phần tử gốc `<header>`/`<footer>` —
  vì vậy đặt được trong trang có font/theme riêng (storefront) mà vẫn đúng nhận diện hệ thống.
- **Font hệ thống khai báo một nơi:** `apps/web/app/_ui/system-fonts.ts` export `systemFontVars` (Be Vietnam Pro
  → `--font-heading`, Inter → `--font-body`). Trang public dùng `SiteHeader`/`SiteFooter` gắn `systemFontVars` lên
  phần tử bọc — **không khai lại `next/font`** trong từng trang. (Trạng thái các nơi còn khai riêng: §3.)
- **Kích thước & lớp:** header `sticky top-0 z-20`, class đánh dấu `site-header`, cao **68px** (< `sm`) / **88px**
  (`sm+`); nền + border full-bleed ở `<header>`, nội dung bọc `container-page`.
- **`scroll-padding-top`** khai trong `globals.css` qua selector `html:has(.site-header)`: `calc(68px + 1rem)`, từ
  `sm` (`width >= 40rem`) là `calc(88px + 1rem)` — anchor và phần tử nhận focus không bị header che (WCAG 2.4.11). Đổi
  chiều cao header phải sửa cả số này.
- **Phần tử sticky trong trang** (ví dụ khối mua ở trang chi tiết sản phẩm) dùng **`top-[112px]`** = header 88px +
  24px, để không chui dưới header.
- Skip-link "Bỏ qua tới nội dung chính" → `#noi-dung` đặt trước `SiteHeader` ở storefront, chi tiết sản phẩm,
  checkout và — từ ADR-050 — **trang chủ** (`app/page.tsx`: skip-link `sr-only focus:not-sr-only` + `<main id="noi-dung" tabIndex={-1}>`) ✅ đọc code
  2026-10-23; mục BACKLOG tương ứng đã đánh dấu xong. Skip-link hiện nằm ở từng trang, không nằm trong `SiteHeader`.
- Trang đang dùng: trang chủ (`app/page.tsx`), storefront `/[tenantSlug]`, chi tiết sản phẩm, checkout, Cửa hàng (`app/cua-hang/layout.tsx`,
  ADR-035), Bảng giá (`app/pricing/layout.tsx`, ADR-041 — §18.4). `/p/[slug]` **chưa** chuyển — xem §4.6.
- **Điều hướng (ADR-035 GĐ2)** ✅ đọc code 2026-10-15:
  - Nav ngang (chỉ hiện từ `lg`): "Bảng giá" (`/pricing`) · "Giáo viên & Coach" (vẫn `<span>`, chưa có trang) · **"Cửa hàng"**
    (`/cua-hang`, thay `<span>` "Khám phá tài liệu" cũ). Link dùng `NAV_LINK_CLASS`: `min-h-11`, mục ứng với `current` có
    `aria-current="page"` + chữ đậm + gạch chân (không chỉ đổi màu).
  - `current` do **trang tự truyền** (header là Server Component, không biết pathname). `cua-hang/layout.tsx` truyền
    `current="shop"`; `pricing/layout.tsx` truyền `current="pricing"` (ADR-041, 2026-10-17) ✅.
  - **Menu mobile** `MobileNav` (`app/_ui/mobile-nav.tsx`, client) dưới `lg`: §14.6. Mục = "Cửa hàng", "Bảng giá" (+ "Đăng nhập" khi chưa
    đăng nhập — nút "Đăng nhập" ở header bị ẩn dưới `sm`).
  - Footer cột "Khám phá": link **"Cửa hàng"** → `/cua-hang` thay dòng chữ "Tài liệu"; "Bảng giá" thành link có `FOOTER_LINK` (chữ trắng
    60%, hover/focus trắng hẳn + gạch chân, focus ring trắng); "Giáo viên & Coach" vẫn là chữ.
  - *(Mô tả trên là trạng thái ADR-035; từ ADR-050 mục menu không còn gõ cứng — xem ngay dưới.)*

#### 1.1.1. Menu từ CMS (ADR-050) — header, dropdown, mobile, footer

> Nguồn: báo cáo UI của Phong qua brief Quốc 2026-10-23, Long đối chiếu code working tree (chưa commit). Dữ liệu menu và luật link:
> [[02-System-Specs/System-Cms-Menu-Home-Seo-Specs|System-Cms-Menu-Home-Seo-Specs]] §2; contract render `SiteMenuView`: [[03-API-Contracts/Endpoint-Directory|Endpoint-Directory]] §26.2.

- **Nguồn dữ liệu:** `SiteHeader`/`SiteFooter` đọc `getSiteMenu()` (CMS slug `menu`, `cache()` theo request); **bố cục** vẫn cố định trong code,
  chỉ nhãn/đích/thứ tự/ẩn-hiện do System Admin cấu hình. "Đăng nhập" và menu tài khoản vẫn do hệ thống tự hiện ✅.
- **`apps/web/app/_ui/nav-link.tsx`** ✅: `NavLinkAnchor` (dùng `<Link>` cho đường dẫn nội bộ, `<a>` cho `external`), `NavLinkLabel` (chữ + chỉ báo),
  `newTabProps`. Mục đang mở có `aria-current="page"`. Link **ngoài / email / tab mới** có icon (`aria-hidden`) kèm chữ ẩn (`sr-only`, vd
  "(mở trong tab mới)"); tab mới luôn `target="_blank"` + `rel="noopener noreferrer"`.
- **`apps/web/app/_ui/nav-dropdown.tsx`** (`NavDropdown`, client) ✅: mục nhóm có menu con 1 cấp theo **pattern disclosure của WAI** (không phải
  `role="menu"`): nút bấm để mở/đóng, `aria-expanded`, **Esc** đóng và trả focus về nút.
- **Mobile** (`MobileNav`, §14.6): items dựng từ cùng `menu.header.items`; mục có menu con hiển thị dạng **accordion** ✅ `site-header.tsx`, `mobile-nav.tsx`.
- **Footer** ✅ `site-footer.tsx`: phần tử gốc class `site-footer`; các cột nằm trong `<nav aria-label="Liên kết chân trang">`, **1–4 cột**, tiêu đề cột
  là **H2**; mô tả (trống = slogan) và dòng bản quyền (`{năm}` theo giờ VN, `{brand}`) đã thay ở server.

---

## 2. Design Tokens — Màu Sắc (`packages/config/src/theme.ts`)

Nguồn màu duy nhất cho toàn app — không hard-code hex rời rạc theo từng file. Theo
`docs/GIEOCHU_BRAND_IDENTITY_PRODUCT_PROPOSAL_V1.0.md` §28 (Color System):

| Token | Giá trị mặc định | Ý nghĩa |
| :--- | :--- | :--- |
| `primary` | `#0F3B82` (Xanh tri thức) | Header, hero, navigation, primary UI |
| `primaryDeep` | `#12213A` (derived — đậm hơn) | Điểm tối cho gradient/hero |
| `accent` | `#D97706` (Cam năng lượng) | CTA, highlight, pricing, achievement |
| `accentSoft` | `#FCEBD5` (derived — nhạt hơn) | Badge, nhấn nhẹ |
| `secondary` | `#16A34A` (Xanh phát triển) | Success, growth, trạng thái tích cực |
| `background` | `#FFF7E9` (Kem ấm) | Nền trang, section editorial |
| `backgroundAlt` | `#F5EEDD` (derived) | Zebra-stripe section |
| `surface` | `#E8F1FF` (Xanh nhạt) | Card, secondary section, soft highlight |
| `line` | `#E7DFC9` (derived) | Border hài hoà với background |
| `ink` | `#12213A` (Navy) | Heading, body text, dark UI |
| `inkSoft` | `#55607A` (derived) | Text phụ, nhãn, timestamp |

**Cơ chế runtime:** `primary`/`primaryDeep`/`accent`/`accentSoft`/`secondary` là chuỗi `var(--brand-xxx,
<hex-fallback>)`. System Admin đổi màu qua **`/admin/settings/branding`** (bảng `SystemBranding`); root
layout (`apps/web/app/layout.tsx`) tính 2 sắc dẫn xuất (`primaryDeep`, `accentSoft`) rồi set `:root` qua một
thẻ `<style>` — chưa cấu hình gì thì trình duyệt tự dùng hex fallback, không có hiện tượng "nhấp nháy" màu
sai lúc tải trang, không cần JS runtime nào khác.

---

## 3. Design Tokens — Typography

- **Heading:** Be Vietnam Pro.
- **Body:** Inter.
- Cả hai load qua `next/font/google` (`subsets: ["latin", "vietnamese"]`), gán CSS variable
  `--font-heading`/`--font-body` (hằng số tên biến ở `brandFonts.headingVar`/`brandFonts.bodyVar` trong `theme.ts`).
- **Quy tắc (ADR-025):** trang public khai báo font hệ thống **một nơi** — `apps/web/app/_ui/system-fonts.ts`
  (`systemFontVars`), xem §1.1. Trạng thái đối chiếu code 2026-09-26 ✅:
  - Đã dùng `systemFontVars`: `app/page.tsx`, `[tenantSlug]/page.tsx`, `[tenantSlug]/[productSlug]/page.tsx` (ADR-030),
    `[tenantSlug]/checkout/[orderCode]/page.tsx`, và bên trong `SiteHeader`/`SiteFooter`.
  - Còn tự khai `next/font` riêng: `app/p/[slug]/page.tsx` (sẽ gỡ khi chuyển sang `SiteHeader`, xem §4.6),
    `app/(auth)/layout.tsx`, `app/admin/layout.tsx`, `app/studio/[tenantSlug]/layout.tsx`. Ba layout sau là app shell,
    không phải trang public — **Quốc quyết 2026-09-26: giữ nguyên** (ADR-025 không áp dụng); gộp về `system-fonts.ts`
    khi có task chạm tới (`docs/BACKLOG.md`, ưu tiên thấp).
- **Ngoại lệ — storefront tenant** (`/[tenantSlug]`): heading **Montserrat** (600/700/800), body Inter, khai báo ở
  `apps/web/app/[tenantSlug]/_ui/fonts.ts` và **chỉ gắn trên `<main class="sf-root">`** — header/footer hệ thống trên
  cùng trang vẫn Be Vietnam Pro/Inter ✅. Trang chi tiết sản phẩm và checkout **không** dùng Montserrat (trang hệ
  thống) ✅. Xem §8.
- Component trong `kit.tsx` áp heading font qua class Tailwind arbitrary value:
  `font-[family-name:var(--font-heading)]` (xem `AdminPageHeader`, `ConfigCard`, `TableCard`, `EmptyState`).

### 3.1. Nội dung rich text `.gieochu-rich-content` — bảng (ADR-060) ✅ đọc `apps/web/app/globals.css` 2026-10-26 — đã commit `fa29d99`

Quyết định thiết kế của Phong (brief Quốc 2026-10-26). Bảng chỉ xuất hiện ở trang tuỳ chỉnh `/p/[slug]` (Markdown → `table/thead/tbody/tr/th/td` trần,
không thuộc tính — [[02-System-Specs/System-Cms-Menu-Home-Seo-Specs|System-Cms-Menu-Home-Seo-Specs]] §4A); trang dùng `gieochu-rich-content
gieochu-legal-content` (typography trang pháp lý §22.3). CSS ở `apps/web/app/globals.css`.

- **Cuộn ngang khi hẹp:** đặt thẳng trên thẻ `table` — `display: block`, `overflow-x: auto`, `max-width: 100%` — **không** dùng wrapper. Bảng rộng chỉ cuộn
  trong khung, trang không cuộn ngang. `border-collapse: collapse`, `margin: 1em 0`, chữ cỡ đoạn văn (`1em`), `line-height: 1.55`.
- **Ô (`th`, `td`):** rộng tối thiểu **8em** (bảng 3 cột ≈ 26em → cuộn ở 375px, vừa ở cột 768px); `padding: 0.5em 0.75em`; viền **1px** màu line **`#e7dfc9`**;
  căn trái, `vertical-align: top`; phần tử đầu/cuối trong ô bỏ margin.
- **Dòng tiêu đề (`th`):** nền backgroundAlt **`#f5eedd`**, chữ ink **`#12213a`**, đậm **650** (tương phản ≈ 14:1 theo comment code; khác biệt bằng nền + độ
  đậm, không chỉ màu).
- **Ngắt chữ trong ô:** `overflow-wrap: break-word` — **ghi đè** `anywhere` của `.gieochu-legal-content` (với `anywhere`, min-content của ô còn 1 ký tự, bảng bị
  bóp thay vì cuộn).
- **Khi in (`@media print`):** bảng trở về `display: table`, `width: 100%`, `overflow: visible`; ô viền đen `#000`, nền trắng, `min-width: 0`; **không ngắt trang
  giữa một hàng** (`tr` `break-inside: avoid`).
  - Lưu ý phạm vi ✅ code: luật viền đen/nền trắng của ô và không ngắt hàng nằm dưới selector `.legal-doc .gieochu-legal-content` (trang văn bản pháp lý); trên
    trang tuỳ chỉnh `/p/[slug]` (không có `.legal-doc`) chỉ luật `display: table` / `width: 100%` áp dụng — KB-Audit §42.
- **Rủi ro còn treo:** vùng cuộn (`table`) **chưa có `tabindex`** → trên Safari có thể không cuộn được bằng bàn phím ❓ (chưa thử).

---

## 4. Độ Rộng Layout & Container (ADR-024)

> Nguồn quyết định: **ADR-024** trong `docs/DECISIONS.md` (Quốc ghi, đã duyệt 2026-09-26). Mục này là quy tắc
> áp dụng cho **mọi layout UI phát triển sau** — Phong/Hiếu làm trang public mới phải theo.

### 4.1. Ba utility độ rộng ✅

Khai báo **một lần** trong `apps/web/app/globals.css` bằng `@utility` + `@variant sm/lg` (Tailwind v4). Mỗi
utility gồm `width: 100%`, `margin-inline: auto`, `padding-inline` theo breakpoint và
`max-width = nội dung + 2 × lề` của đúng breakpoint đó — nên phần nội dung luôn chạm đúng mức trần ở mọi độ
rộng. ✅ đã đối chiếu `globals.css`.

| Utility | Nội dung tối đa | Lề ngang (mặc định / `sm` / `lg`) | Dùng cho |
| :--- | :--- | :--- | :--- |
| `container-page` | **1280px** | 16 / 24 / 32px | Khung chung mọi trang public: header, footer, section trang chủ, storefront tenant, trang danh sách/sản phẩm, pricing |
| `container-prose` | 768px | 16 / 24 / 32px | Trang đọc dài: CMS `/p/[slug]`, chính sách, bài viết |
| `container-narrow` | 448px | 16 / 24px (không có bậc `lg`) | Form đơn lẻ: checkout, auth card, trang xác nhận |

### 4.2. Mẫu dùng

Nền màu/ảnh đặt ở phần tử ngoài cùng (`<section>`/`<header>`/`<footer>`) — tràn toàn chiều ngang (full-bleed)
kèm khoảng đệm dọc `py-*`. Nội dung bọc trong `<div className="container-page …">`, bố cục (flex/grid/gap) gắn
cùng div đó. **Không đặt nền lên chính container** (nền sẽ bị cắt ở 1280px + lề).

```tsx
<section className="py-14 sm:py-20 lg:py-24" style={{ background: PAPER_ALT }}>
  <div className="container-page grid gap-6 md:grid-cols-3">
    <div className="max-w-[560px]">…</div> {/* khối con tự giới hạn nhỏ hơn — hợp lệ */}
  </div>
</section>
```

Mẫu trên phản ánh cách `apps/web/app/_home-sections.tsx` đang viết (section full-bleed + `container-page`) ✅.

### 4.3. Quy tắc cấm

- **Không** tự đặt `max-w-[...]`, hoặc `mx-auto` + `px-*`, để làm khung trang — luôn dùng một trong 3 utility.
- **Không** gắn `px-*`, `max-w-*`, `mx-*` trên **cùng phần tử** với `container-*` — sẽ ghi đè lề/độ rộng chuẩn.
  Cần lề/độ rộng khác thì bọc thêm một lớp bên trong container.
- Khối con (mô tả hero, ảnh, thanh tìm kiếm, thẻ) được tự giới hạn **nhỏ hơn** bằng `max-w-*` **bên trong**
  container; không khối nào vượt ra ngoài container.

### 4.4. Ngoại lệ — app shell có sidebar

Khu vực `/admin/*`, `/studio/*`, `/account/*` **không** dùng `container-page` ở mức trang: vùng làm việc fluid theo
sidebar. Nguồn: ADR-024. **Từ 2026-10-25** (chủ dự án chốt): nội dung chính `/admin`, `/studio` luôn **full width**, khối xếp 1 cột, không
`max-w-*` ở khung form/editor — `max-w` chỉ ở cấp component (quy tắc ở §5). `/account` không thuộc phạm vi quy tắc này (giữ mẫu §18.5). Ba shell cùng sidebar 288px và khung nội dung `px-5 py-8 lg:px-8` ✅ — khác chỗ đặt: Studio/System
Center đặt padding này ở **từng trang** (`<main>` của layout không padding), còn `/account` đặt ngay trên `<main>` của
`AccountShell` nên trang con không tự đặt. `/account` đồng bộ 2026-10-23 và có mẫu "form trong trang fluid" bằng container
query — xem §18.5.

### 4.4a. Ngoại lệ — trang thanh toán đơn tài liệu dùng `container-page` (ADR-062 Q5) ✅ đọc code 2026-10-27 (chưa commit)

`/{tenantSlug}/checkout/{orderCode}` trước đây là form đơn lẻ `container-narrow`; từ ADR-062 nội dung nằm trong **`container-page`** (đặt ở `<main>` của
`checkout/[orderCode]/layout.tsx`) và trang tự chia **2 cột từ `lg`** (§8.4). Đây là ngoại lệ có chủ đích của bảng §4.1 — trang thanh toán khác (Studio billing) không đổi.

### 4.5. Độ rộng thực tế của `container-page` theo viewport

"Lề" ở đây là khoảng từ mép màn hình tới mép nội dung (phần `margin-inline: auto` + `padding-inline`). Số tính từ
công thức trong `globals.css` (bậc `lg`, max-width 1344px) ✅:

| Viewport | Nội dung | Lề mỗi bên |
| :--- | :--- | :--- |
| 1280px | 1216px | 32px |
| 1440px | 1280px | 80px |
| 1920px | 1280px | 320px |

### 4.6. Trạng thái áp dụng

Cột "Chrome" = có dùng `SiteHeader`/`SiteFooter` hệ thống (§1.1, ADR-025) hay chưa. Đối chiếu code 2026-09-26 ✅.

| Trang | Container | Chrome (ADR-025) | Ghi chú |
| :--- | :--- | :--- | :--- |
| Trang chủ hệ thống (`app/page.tsx`, `app/_home-sections.tsx`) | ✅ đã áp dụng | ✅ `SiteHeader` + `SiteFooter` | Mọi section dùng `container-page` |
| Storefront tenant (`app/[tenantSlug]/page.tsx`, `_ui/*`) | ✅ đã áp dụng | ✅ `SiteHeader` + `SiteFooter` | Hằng `CONTAINER` trong `[tenantSlug]/_ui/primitives.tsx` = `"container-page"` (bí danh, giữ tên để các section khỏi đổi import) |
| `/pricing` | ✅ đã áp dụng (2026-09-26) | ✅ `SiteHeader current="pricing"` + `SiteFooter` ở `app/pricing/layout.tsx` (ADR-041, 2026-10-17 — dựng lại đọc CMS, §18.4) | Trang dựng lại theo CMS `pricing`; chi tiết §18.4 |
| `/p/[slug]` (CMS) | ✅ đã áp dụng (2026-09-26) | ❌ **chưa** — còn `<header>` riêng (cao 64px, logo hard-code chữ "G", chỉ có link Đăng nhập), **chưa có footer**; còn tự khai `next/font` | `<header>` full-bleed + `container-page`; `main.container-prose`. Chuyển sang chrome hệ thống: việc sau (`docs/BACKLOG.md`) |
| Checkout (`[tenantSlug]/checkout/[orderCode]`) | ✅ đã áp dụng (2026-09-26) | ✅ `SiteHeader` + `SiteFooter` | Trang hệ thống (§8.4); `main.container-narrow` |
| Chi tiết sản phẩm (`[tenantSlug]/[productSlug]` — ADR-030; URL cũ `…/products/[productSlug]` → 301) | ✅ đã áp dụng (2026-09-26) | ✅ `SiteHeader` + `SiteFooter` | Trang hệ thống (§8.4). `container-page`, bố cục thương mại 2 cột: lưới `lg:grid-cols-12`, ảnh + mô tả `lg:col-span-7`, khối mua `lg:col-span-5 lg:sticky lg:top-[112px]`; mô tả `max-w-prose` |

### 4.7. Checklist cho người làm layout mới

- [ ] Trang public → dùng `SiteHeader`/`SiteFooter` + `systemFontVars` (§1.1), không tự dựng header/footer, không
  khai lại `next/font`; phần tử sticky trong trang dùng `top-[112px]`.
- [ ] Trang thuộc loại nào: khung chung → `container-page`; đọc dài → `container-prose`; form đơn lẻ →
  `container-narrow`; app shell có sidebar → không dùng container ở mức trang.
- [ ] Nền màu/ảnh đặt ở `<section>`/`<header>`/`<footer>` full-bleed, không đặt trên container.
- [ ] Không có `max-w-[...]`/`mx-auto px-*` tự chế làm khung trang.
- [ ] Không có `px-*`/`max-w-*`/`mx-*` cùng phần tử với `container-*`.
- [ ] Khối con giới hạn bằng `max-w-*` bên trong container, không vượt container.
- [ ] Kiểm tra ở 375 / 768 / 1280 / 1440 / 1920px: nội dung không vượt 1280px, lề đúng bảng §4.5.
- [ ] Cần độ rộng mới ngoài 3 cấp → không tự thêm, báo Quốc (đổi ADR-024).

### 4.8. Lịch sử ngắn

- 🟡 Theo ADR-024 và brief của Quốc: storefront tenant đã thử lần lượt **960 → 1140 → 1200 → chốt 1280px**
  (2026-09-26) theo phản hồi của chủ dự án; chủ dự án yêu cầu mọi layout sau theo cùng một template kích thước.
- 🟡 Lý do kỹ thuật chọn `@utility` thay vì class arbitrary (theo ADR-024): dev server Turbopack từng **không sinh
  lại** class arbitrary mới trong thư mục `[tenantSlug]` cho tới khi khởi động lại. Utility khai báo trong CSS gốc
  không phụ thuộc việc quét nguồn, và là một nguồn duy nhất — đổi 1 chỗ áp mọi trang.

---

## 5. Bộ Component Dùng Chung (`apps/web/app/admin/_ui/kit.tsx`)

`kit.tsx` là **Server Component** (không hook) — 2 component cần `useState` (`PasswordField`, `Toggle`) sống
riêng ở `kit-interactive.tsx` ("use client") và được re-export lại từ `kit.tsx`, để trang Server Component
(ví dụ `admin/tenants/page.tsx`) vẫn import thẳng từ `kit.tsx` mà không kéo theo lỗi build "importing a
module that depends on useState into a Server Component module".

| Component | Vai trò |
| :--- | :--- |
| `AdminPageHeader` | Tiêu đề trang + mô tả + khối hành động bên phải — dùng ở đầu mọi trang cấu hình/CMS |
| `SettingsGrid` | Từ 2026-10-25 (Quốc sửa tận gốc theo quy tắc full width bên dưới): `mt-6 grid grid-cols-1 gap-6` — **1 cột, full width** ✅ đọc `kit.tsx`. Trước đây là lưới `auto-fit` cột `minmax(380px, 960px)` (gây cuộn ngang ở 375px — lỗi này hết cùng bản sửa). Component còn trong kit nhưng **không trang nào dùng nữa** ✅ grep (System Center bỏ ở task 1.15, share-links ở 2.3b, coupons bỏ import ở 2.6; Lưu trữ file không dùng). Trang mới: xếp khối trực tiếp, không cần bọc |
| `MainAsideGrid` | (ADR-026) Bố cục 2 cột `main` + `aside` (`aside` có `aria-label` qua `asideLabel`): 1 cột dưới `xl`, từ `xl` là `minmax(0,1fr) 320px`, `items-start`, `gap-6` ✅. Editor sản phẩm **không** dùng component này — tự dựng lưới riêng `minmax(0,1fr) 360px` trong `<form>`, nay full width (đã bỏ khung 1440px, task 2.3a — §9.1) |
| `ConfigCard` | Card cấu hình 1 module: icon + tiêu đề + badge trạng thái + toggle bên phải + nội dung + footer |
| `TableCard` | Card bọc 1 bảng tham khảo — icon + tiêu đề + mô tả, không có toggle (khác `ConfigCard`) |
| `Badge` | Huy hiệu trạng thái, 5 tone: `success` / `warning` / `danger` / `neutral` / `info` |
| `TextField`, `SelectField` | Input/select có label, hint, error — dùng `FieldShell` nội bộ chung. **Tự gắn a11y khi có `id`** (2026-10-15 ✅): `aria-invalid` khi có `error`; `aria-describedby` trỏ `${id}-error` (ưu tiên) hoặc `${id}-hint` — đúng id `FieldShell` gắn cho dòng lỗi (`role="alert"`) / dòng gợi ý; có lỗi thì dòng gợi ý không render. Trang gọi **không** tự đặt lại hai thuộc tính này |
| `PasswordField`, `Toggle` | Client component (từ `kit-interactive.tsx`), re-export qua `kit.tsx`. **`Toggle`** (2026-10-15 ✅): input thật `sr-only` + vòng focus vẽ trên rãnh switch (`peer-focus-visible:outline-2`, màu `#0F3B82` — WCAG 2.4.7); có prop `checked` (controlled) thì **luôn theo prop**, không lệch màu khi cha đổi giá trị; không có `checked` thì tự giữ state từ `defaultChecked` |
| `PrimaryButton`, `GhostButton` | Nút submit chính/phụ trong form |
| `PrimaryLinkButton`, `GhostLinkButton` | Nút dạng `<Link>` — dùng cho pattern "bấm để hiện form" qua query param (`?new=1`) thay vì client state |
| `RowActionButton` | Nút hành động nhỏ trong dòng bảng, 4 tone: `primary` / `success` / `danger` / `neutral`; prop `size`: `sm` (mặc định, dòng bảng desktop) · **`touch`** (ADR-029 — thẻ/danh sách dùng cả trên mobile: `min-h-11` = 44px dưới `lg`, gọn như `sm` từ `lg`) ✅ |
| `FormBanner` | Banner thông báo kết quả form (`ok` → xanh, lỗi → đỏ), `role="status"`/`role="alert"` |
| `DataTable`, `Tr`, `Td` | Bảng dữ liệu chuẩn (từ M12a: prop `caption?` → `<caption class="sr-only">`, `<th scope="col">` — §15.5; từ ADR-046: `head` là `ReactNode[]`, prop `headAriaSort?` → `aria-sort` — §20.5) — cố tình không set `overflow-x-auto` (tránh browser tự suy ra `overflow-y: auto`, cắt mất `RowMenu` dùng `position: absolute` ở các hàng cuối) |
| `EmptyState` | Trạng thái rỗng: icon + tiêu đề + mô tả + hành động gợi ý |
| `PillTabs` | (ADR-056) Tab dạng pill bằng link GET — **lọc/góc nhìn của cùng một danh sách** trong một trang (§24.1). Không dùng để gom các trang khác nhau (dùng `ModuleTabs`, §25) |

**Quy tắc bố cục full width** (chủ dự án chốt 2026-10-25 🟡 brief Quốc + kế hoạch ADR-058 mục "Quy tắc bố cục"; trạng thái code ✅ grep 2026-10-25):
* Nội dung chính trong **System Center và Studio luôn full width theo khung app**, đồng bộ toàn hệ thống. **Không** giới hạn bề ngang form/editor bằng
  `max-w-*`/`mx-auto` ở khung trang; **không** xếp card thành lưới nhiều cột khiến card chỉ chiếm nửa màn hình. Các khối xếp **1 cột**; cột phụ bên phải chỉ
  dùng khi có lý do (editor tài liệu/bài viết, `MainAsideGrid`).
* **Được** giữ `max-w`/`mx-auto` ở **cấp component**: độ rộng ô nhập ngắn, ô bảng, khối lỗi/trạng thái trống ở giữa, đoạn mô tả dưới tiêu đề (dòng chữ dễ đọc).
* Đã áp: `SettingsGrid` thành 1 cột (sửa ở gốc); bỏ `mx-auto max-w-[1440px]` ở `post-editor.tsx` (2 chỗ) và `max-w-7xl mx-auto` ở `admin/settings/storage/page.tsx`
  (Quốc); bỏ `max-w-[1440px]` ở `product-editor.tsx`/`editor-skeleton.tsx` (2.3a); trang Cài đặt + Thanh toán Studio và Cấu hình thanh toán System Center
  (Quốc) ✅ grep không còn `max-w-[1440px]`/`max-w-7xl`/`max-w-5xl` ở các file này. `max-w`/`mx-auto` còn lại trong `admin/**`, `studio/**` đều ở cấp component 🟡 (theo
  rà của Phong, Long chỉ kiểm các file trên).
* Không mâu thuẫn ADR-024 (§4.4 — app shell fluid theo sidebar); quy tắc này siết thêm: bỏ cả giới hạn bề ngang ở cấp form/editor.

**Component dùng chung ngoài `kit.tsx`** (ADR-058 GĐ 0–2, client component, file riêng trong `apps/web/app/admin/_ui/`) ✅ đọc code 2026-10-25 — đã commit (GĐ 0–1 `c8e1b2f`, GĐ 2 `fa29d99`) — chi tiết §25:

| Component (file) | Vai trò |
| :--- | :--- |
| `ModuleTabs` (`module-tabs.tsx`) | Tab ngang đầu trang gom **các trang con cùng một chức năng** (mỗi tab một URL). `<nav>` + link `aria-current="page"`, không `tablist`, không dropdown. Dùng ở nhóm **Trang CMS** (task 1.1), **Cấu hình chung** (task 1.7) — §12.6 — và **Cài đặt** Studio (task 2.1) — §11.1 |
| `InPageTabs` (`in-page-tabs.tsx`) — GĐ 1 | Tab ARIA thật **trong một trang** (không đổi URL), kiểu pill; **mọi panel luôn mounted**. Dùng ở SMTP và Nhận diện thương hiệu — §25.6 |
| `CollapsibleSection` + `sectionStatus()` + `revealSection()` (`collapsible-section.tsx`) | Khối thu gọn kiểu section Rank Math (tiêu đề + badge trạng thái có chữ + chevron); `status` nhận một hoặc **mảng** badge. Đã áp ở GĐ 1 cho 9 trang System Center và GĐ 2 cho 5 form/editor Studio (thanh toán, tài liệu, bài viết, mã giảm giá…) — bảng §25.3 |
| `useFormDraft` (`use-form-draft.ts`, hook) — GĐ 1, mở rộng GĐ 2 | Giữ giá trị đã nhập khi **lưu lỗi** cho form không kiểm soát + `useActionState`; không ghi lại secret (`secretNames`); `failed`, `keepOnSuccess`, `dirtyOf`, trả `values`; hỗ trợ nhóm checkbox cùng tên — §25.7 |
| `UnsavedChangesProvider`, `useUnsavedChanges`, `useLeaveGuard`, `GuardedLink` (`unsaved-changes.tsx`) | Cảnh báo rời trang khi còn thay đổi chưa lưu — `beforeunload` chung + chặn điều hướng client qua `onNavigate` của `next/link`. Provider bọc ở layout `/admin`, `/studio/{slug}` và trang onboarding `/studio` (nằm ngoài layout Studio) |
| `navMatchLength`, `pickActiveHref` (`nav-match.ts`, không phải component) | Luật chọn mục sidebar đang sáng, có trường `match` (§25.5) |

**Quy tắc bắt buộc khi thêm trang quản trị mới** (System Center hoặc Studio): tái dùng các component trên
thay vì tự viết class Tailwind rời rạc cho bảng/badge/form — tránh lặp lại việc phân mảnh CSS mà kit này
được tạo ra để giải quyết.

### 5.1. App shell System Center + Studio — sidebar dùng chung, Đăng xuất, drawer mobile (ADR-042) ✅

Đối chiếu working tree 2026-10-17 (nay đã commit `9d37ab1`, deploy ❓). Quyết định: [[01-Architecture-Decisions/ADR-028-Shared-App-Sidebar-Logout-Mobile-Drawer|ADR-028 KB (≙ ADR-042)]].
**Một bộ duy nhất** cho `/admin` và `/studio/{slug}` — sidebar riêng của Studio (`studio/[tenantSlug]/_ui/sidebar-nav.tsx`) **đã xoá**, không
dựng lại sidebar thứ hai.

| Component (file) | Vai trò |
| :--- | :--- |
| `SidebarNav` (`admin/_ui/sidebar-nav.tsx`, client) | Props `{ standalone, groups, rootHref, storageKey, ariaLabel }`. Mục đứng riêng ở đầu + nhóm **accordion** (1 nhóm mở; nút nhóm `aria-expanded`/`aria-controls`, chevron xoay). Nhóm mở theo ưu tiên: thao tác tay trong phiên (kể cả đóng) → nhóm chứa trang đang xem → nhóm lưu `localStorage[storageKey]` → nhóm đầu. Active = mẫu khớp **dài nhất** (gốc khu vực và `/admin/settings` là tiền tố của mục khác; từ ADR-058 tính cả trường `match?` của mục — luật ở `nav-match.ts`, §25.5), `aria-current="page"`, mọi link gắn `onNavigate={useLeaveGuard()}` (§25.4), nền/chữ `color-mix` từ `brandColors.accent` (không hex cứng). Mục ≥ 44px dưới `lg`. Icon bằng **key chuỗi** (`SidebarNavIcon` — 18 key trong `NAV_ICONS`, §8.5) |
| `SidebarNavBadge = { count, srText, urgent? }` | Pill số (`99+` khi > 99) `aria-hidden` + `srText` `sr-only` đủ ngữ cảnh. `urgent` → nền `#B91C1C` chữ trắng + `IconAlertTriangle` (không chỉ bằng màu); thường → nền `accentSoft` chữ `ink`. Nhóm **đang đóng** hiện tổng badge các mục con ("N mục cần xử lý[, có mục quá hạn]"). Nhãn mục **không** còn hậu tố "(N)" |
| `AdminSidebarNav({ badges })` (cùng file) | Cấu hình menu System Center (`ADMIN_STANDALONE` + `ADMIN_GROUPS`), `storageKey="admin:nav:expanded"`, `ariaLabel="Điều hướng System Center"`; `badges` theo href → `srText` riêng ("N báo cáo chờ xử lý", "N yêu cầu hoàn tiền chờ duyệt") |
| `AppSidebarPanel({ brand, nav, footer })` (`admin/_ui/app-sidebar.tsx`, server được) | Nền `brandColors.primary`, chữ trắng: khối brand cao 64px · `nav` (cuộn riêng) · `footer` link phụ (class `SIDEBAR_FOOTER_LINK_CLASS`, 44px dưới `lg`) · **Đăng xuất cố định đáy**, tách bằng đường kẻ (`LogoutButton tone="onDark" redirectTo="/login"`) |
| `SidebarDrawer({ label, children })` (`admin/_ui/sidebar-drawer.tsx`, client) | Dưới `lg`: nút ☰ 44×44 (`aria-label="Mở menu điều hướng"`, `aria-expanded`, `aria-controls`) mở `<dialog>` bằng `showModal()` → trình duyệt tự bẫy focus + Esc. Đóng thêm khi bấm nút đóng (chữ `sr-only` "Đóng menu điều hướng"), bấm nền mờ, bấm link trong drawer, đổi `pathname`, màn hình lên `lg`; đóng xong trả focus nút ☰. Panel rộng 288px (tối đa `100vw − 4rem`); nội dung chỉ render khi mở (không trùng `nav`) |
| `.app-drawer` (`globals.css`) | `html:has(dialog.app-drawer[open])` khoá cuộn; panel trượt từ trái + nền mờ hiện dần 200ms; **tắt** khi `prefers-reduced-motion: reduce` |

**Bố cục layout** (`admin/layout.tsx`, `studio/[tenantSlug]/layout.tsx`): tạo **một** phần tử `panel = <AppSidebarPanel …/>`, đặt vào
`<aside className="sticky top-0 hidden h-dvh w-[288px] lg:block">` và vào `<SidebarDrawer>` trong header. Header 64px: bên trái nút ☰ + tên
gọn (dưới `lg`) / nhãn khu vực (từ `lg`), bên phải `AccountMenu variant="app" logoutRedirect="/login"` (§18.5). Chân sidebar: System Center
"Về trang chủ"; Studio "Xem trang công khai" (tab mới, chữ `sr-only` "(mở tab mới)") + "Về trang chủ".

**Kiểm** 🟡 (báo cáo Quốc): lint/typecheck/build đạt; xem trước dữ liệu giả 360/768/1280, bàn phím trong drawer. **Chưa** kiểm phiên đăng nhập
thật, đăng xuất thật, trình đọc màn hình ❓.

---

## 6. Bộ Icon Dùng Chung (`apps/web/app/admin/_ui/icons.tsx`)

**51** icon SVG dạng component (đếm lại `export function Icon` 2026-10-18 sau "Bổ sung ADR-043 lần 3" ✅ — ADR-043 thêm `IconArrowUp`/`IconArrowDown` (mũi tên xu hướng trong `ChangeLine`), `IconStarSolid` (điểm đánh giá, top đánh giá), `IconGift` (thẻ "Lượt nhận tài liệu miễn phí"), §19; lần 3 thêm `IconCalendar` (ô mở date range picker, §19.5); danh sách dưới là mốc 42 của 2026-09-28, các icon thêm sau — `IconMenu`, `IconClose`, `IconShoppingBag`… — ghi ở §14.6 và các mục tương ứng) (`IconProps = { className?: string }`; mốc 2026-09-28 sau M10b — thêm
`IconNewspaper` (mục "Bài viết" sidebar Studio, key `posts`; icon trạng thái rỗng) và `IconPin` (ghim bài), ADR-029 M10b), dùng chung cho cả System Center và
Studio, cùng vị trí `_ui` với `kit.tsx`:

`IconBank`, `IconBolt`, `IconWallet`, `IconDatabase`, `IconGear`, `IconDoc`, `IconPlus`, `IconShield`,
`IconLayers`, `IconUsers`, `IconRoute`, `IconPackage`, `IconGrid`, `IconStore`, `IconCard`, `IconReceipt`,
`IconChevronDown`, `IconMoreHorizontal`, `IconLock`, `IconUnlock`, `IconMail`, `IconChevronsLeft`,
`IconChevronLeft`, `IconChevronRight`, `IconChevronsRight`, `IconEdit`, `IconToggleOn`, `IconToggleOff`,
`IconTrash`, `IconCheckCircle`, `IconTag`, `IconExternalLink`, `IconGlobe`, `IconEye`, `IconEyeOff`, 4 icon thêm cho
editor sản phẩm (ADR-026/027): `IconXCircle`, `IconAlertTriangle`, `IconUpload`, `IconFile`, và `IconStarOutline` (ADR-029 —
mục "Đánh giá" sidebar Studio, key `star`). (Bản trước ghi "34" nhưng
liệt kê 35 tên — số đúng trước đợt này là 35 ✅ `git show HEAD`.)

Dùng làm `icon` prop cho `ConfigCard`/`TableCard`/`EmptyState`, hoặc độc lập trong nút/menu hành động
(`RowActionButton`, kebab menu).

**A11y mặc định (2026-10-15 ✅; đếm lại 2026-10-18: 50/50):** mọi `<svg>` trong `icons.tsx` đều có `aria-hidden="true"` — icon là trang trí; nút/link chỉ
có icon phải tự có tên truy cập (`aria-label` hoặc chữ `sr-only`).

---

## 7. Quy Chuẩn Badge Trạng Thái Nghiệp Vụ

`Badge` component có 5 tone kỹ thuật (`success`/`warning`/`danger`/`neutral`/`info`) — mỗi trang tự map
trạng thái nghiệp vụ (đơn hàng, subscription, entitlement...) sang 1 trong 5 tone này khi gọi component,
không tạo tone mới riêng lẻ ngoài 5 tone đã định nghĩa trong `BADGE_STYLE`. Ví dụ áp dụng thực tế: trạng thái
đơn hàng `PAID`/`DELIVERED` → tone `success`; `PENDING` → tone `warning`; `CANCELLED` → tone `danger`.

### 7.1. Khối thông báo trạng thái trên trang public (tint + viền trái)

Ngoài `Badge` (kit admin), trang public hệ thống báo trạng thái bằng **khối** (lần đầu dùng ở checkout — đã thanh
toán / hết hạn; ✅ đọc `[tenantSlug]/checkout/[orderCode]/page.tsx` 2026-09-26):

| Trạng thái | Nền | Viền | Chữ |
| :-- | :-- | :-- | :-- |
| Thành công (đã thanh toán) | `color-mix(in srgb, <secondary> 10%, white)` | `secondary` | `ink` |
| Cảnh báo (hết hạn) | `accentSoft` | `accent` | `ink` |
| Thông tin (chờ người bán xác nhận) — ADR-062 | `surface` | `primary` | `ink` |
| Trung tính (đã huỷ / đã hoàn tiền) — ADR-062 | `NEUTRAL_SOFT` (hằng trong `checkout-parts.tsx`) | `inkSoft` | `ink` |

- Class khung: `rounded-xl border border-l-4 p-4 text-sm` — viền 1px quanh khối, **viền trái 4px** mang sắc trạng thái
  (`borderColor` áp cả 4 cạnh, cạnh trái dày hơn).
- **Chữ luôn `ink`**, không dùng `secondary`/`accent` làm màu chữ: `secondary` `#16A34A` trên trắng chỉ ~3.3:1, không
  đạt AA 4.5:1 cho chữ thường. Link trong khối dùng `primary`.
- Trạng thái phải **có chữ** (câu mở đầu `<strong>`, vd. "Thanh toán thành công.", "Đơn hàng đã hết hạn."), không
  truyền đạt chỉ bằng màu.
- Màu lấy từ `brandColors` (`@gieochu/config/theme`), không dùng palette Tailwind `green-*`/`amber-*` rời.
  Storefront (`.sf-root`) có banner riêng `StorefrontNotice` (§8.0) — chưa theo pattern này.
- **Từ ADR-062 (trang thanh toán, 2026-10-27 ✅ đọc code, chưa commit):** khối là `StateNotice({ tone, title, children, icon? })` (`checkout/[orderCode]/_ui/checkout-parts.tsx`)
  với 4 tone `success` · `warning` · **`info`** · **`neutral`**; mỗi tone có icon mặc định (check / tam giác / đồng hồ / X) + tiêu đề `h2` nhận focus
  (`STATE_HEADING_ID`, `tabIndex=-1`); khung `rounded-2xl border border-l-4 p-5`. Kit admin `Badge` vốn đã có tone `info`/`neutral`.

---

## 8. Giao Diện Storefront Tenant (`apps/web/app/[tenantSlug]/_ui/*`)

> Nguồn: ADR-023 (Storefront CMS) + ADR-024 (độ rộng) + ADR-025 (tenant chỉ sở hữu nội dung). Nghiệp vụ/dữ liệu:
> [[02-System-Specs/Storefront-CMS-Specs|Storefront-CMS-Specs]]
> ([Storefront-CMS-Specs.md](../02-System-Specs/Storefront-CMS-Specs.md)). Mọi mục dưới đây ✅ đã đọc code 2026-09-26,
> trừ khi ghi khác. Storefront **không** dùng kit `admin/_ui` — có bộ primitives riêng.

### 8.0. Cấu trúc trang storefront (ADR-025) ✅

Storefront `/[tenantSlug]` là trang public **duy nhất** mang giao diện tenant. Thứ tự DOM
(`app/[tenantSlug]/page.tsx`):

1. Skip-link "Bỏ qua tới nội dung chính" → `#noi-dung`.
2. `SiteHeader` (hệ thống, §1.1).
3. Banner trạng thái, **ngay dưới header hệ thống**, không sticky, nền full-bleed + `container-page`:
   `StorefrontNotice` (chỉ **chủ** tenant thấy) khi `resolveStorefrontAccess` trả `READ_ONLY` (ADR-040: "Gian hàng của bạn đang tạm
   ngưng hoạt động — khách chỉ thấy thông báo tạm ngưng, không thấy tài liệu."; nền amber + `IconInfo`) hoặc `LOCKED_NOTICE` ("Trang của
   bạn đang bị khoá…"; nền đỏ + `IconLockClosed`); `StorefrontDemoBanner` "Nội dung mẫu" khi `isDemo && isOwner`.
   Cả hai ở `_ui/notice.tsx`, có icon + chữ (không truyền đạt chỉ bằng màu).
4. `<main id="noi-dung" class="sf-root …">` — **chỉ ở đây** mới có theme `--sf-*` (style inline từ
   `buildStorefrontStyle`) + biến font Montserrat/Inter. Không có section hero → thêm `<h1 class="sr-only">` tên tenant.
5. `SiteFooter` (hệ thống).

**Trang "tạm ngưng" cho khách (ADR-040)** ✅ đọc code 2026-10-17: khi `resolveStorefrontAccess` trả `SUSPENDED_NOTICE` (khách của
tenant `READ_ONLY`), `page.tsx` trả `SuspendedStorefront` **trước** mọi loader — khung **hệ thống** (`systemFontVars`, nền trắng,
skip-link → `SiteHeader` → `<main id="noi-dung">` → `SiteFooter`), **không** `.sf-root`/theme tenant, không section CMS.
Nội dung `<main>` là `StorefrontSuspendedNotice` (`_ui/notice.tsx`): `section.container-narrow` căn giữa (`py-16 sm:py-24`), vòng icon
`IconInfo` nền `amber-50`, **h1 = tên gian hàng** (trang có đúng 1 h1), dòng "Gian hàng đang tạm ngưng hoạt động." (`amber-900`), dòng
phụ "Tài liệu của gian hàng tạm thời không hiển thị. Nếu bạn đã mua tài liệu, bạn vẫn tải được trong Thư viện của mình." và nút viền
"Mở Thư viện của tôi" → `/account/library` (`min-h-11`, `rounded-full`, `motion-reduce:transition-none`). Metadata: `title` = tên gian
hàng + `robots: noindex, nofollow`. Kiểm tra a11y/responsive trên trình duyệt thật ❓.

**Không có** header/footer/menu anchor riêng của tenant. Các component đã **xoá** khỏi code (grep không còn tham
chiếu ✅): `StorefrontHeader`, `MobileMenu`, `StorefrontFooter`, `TenantAvatar`. Không dựng lại chúng — muốn thêm
điều hướng trong storefront phải qua Quốc (đổi ADR-025).

**Mạng xã hội tenant:** hàng icon tròn **44px** (`h-11 w-11`, viền `border-current`) trong **khối CTA của section Liên
hệ** (`_ui/contact.tsx`), `<ul aria-label="Mạng xã hội của {tenant}">`, mỗi link mở tab mới + `rel="noopener
noreferrer"` + `aria-label` "{mạng} của {tenant} (mở tab mới)". Tắt section Liên hệ → không hiện ở đâu cả.

### 8.1. Theme `--sf-*` (`[tenantSlug]/_ui/theme.ts`)

`buildStorefrontStyle({ primary, accent })` tính ở **server** rồi gắn CSS variables inline lên
`<main class="sf-root">` (không sinh class động) — header/footer hệ thống nằm ngoài phạm vi này. Màu vào = `Tenant.branding` (qua `getStorefrontProfile`), thiếu → màu hệ
thống. Vì màu tenant có thể là bất kỳ hex nào (kể cả vàng chanh), mọi cặp chữ/nền được **tính tương phản WCAG**:

| Biến | Ý nghĩa |
| :-- | :-- |
| `--sf-primary`, `--sf-accent` | Màu gốc tenant |
| `--sf-on-primary`, `--sf-on-accent` | Chữ trên nền màu: chọn trắng → mực → đen/trắng, cặp nào đạt ≥ 4.5:1 |
| `--sf-primary-text` | Primary làm **chữ** trên nền sáng — làm đậm dần tới ≥ 4.5:1 trên `--sf-primary-soft` (không đạt → mực) |
| `--sf-accent-text` | Accent làm chữ trên nền trắng (nút trắng trong khối CTA, icon dịch vụ), ≥ 4.5:1 |
| `--sf-primary-soft`, `--sf-hero-bg` | Primary làm nhạt (hệ số 0.1 / 0.05 qua `lightenHex`) |
| `--sf-cta-end` | Đầu thứ 2 gradient CTA, đi theo hướng tăng tương phản với chữ đã chọn |
| `--sf-heading-from/to` | Gradient tiêu đề hero — chữ lớn nên ngưỡng AA 3:1 |
| `--sf-red` | `#dc2626` cố định (badge ✓, dấu ngoặc kép, sao, nhãn giảm giá…) — chữ trắng đạt 4.8:1 (thay `#ef4444` chỉ 3.8:1) |
| `--sf-focus` | = `--sf-primary-text` |
| `--sf-ink`, `--sf-ink-soft`, `--sf-line` | Lấy từ `brandColors` hệ thống |

**Quy tắc:** trong storefront chỉ dùng `var(--sf-*)`, không hard-code màu tenant; chữ đặt trên nền màu tenant luôn
lấy biến `--sf-on-*`/`--sf-*-text`, không tự chọn trắng/đen.

### 8.2. Font

Heading Montserrat + body Inter qua `[tenantSlug]/_ui/fonts.ts`, biến font gắn cùng `<main class="sf-root">` (xem
§3). Phần tử bọc ngoài của trang gắn `systemFontVars` cho header/footer hệ thống. Trang chi tiết sản phẩm và checkout
**không** bọc `.sf-root`, không dùng Montserrat, không gọi `buildStorefrontStyle` (trang hệ thống, §8.4) ✅.

### 8.3. Primitives (`[tenantSlug]/_ui/primitives.tsx`)

| Export | Vai trò |
| :-- | :-- |
| `CONTAINER` | Bí danh `"container-page"` (ADR-024) |
| `SECTION_ANCHORS` | Chỉ còn `{ id }` theo type: hero→`gioi-thieu`, services→`dich-vu`, products→`tai-lieu`, **reviews→`danh-gia`** (đánh giá thật), **testimonials→`cam-nhan`** (đổi từ `danh-gia` ở ADR-029), contact→`lien-he` — dùng làm id section và đích CTA hero (`#tai-lieu`/`#lien-he`). Trường `label` (nhãn menu) **đã xoá** 2026-09-26 vì storefront không còn menu anchor (ADR-025) ✅ |
| `SectionHeading` | Tiêu đề section căn giữa, IN HOA, gạch accent 45×3px, subtitle `max-w-2xl` |
| `pillClass(tone, size)` | Nút pill in hoa; tone `primary`/`accent`/`white`, size `md` (min-h-11) / `lg` (min-h-12); có `motion-reduce` |
| `SfLink` | Link CTA do tenant cấu hình: URL tuyệt đối → tab mới + `rel="noopener noreferrer"` + chữ sr-only "(mở tab mới)"; `#anchor`/`/path` điều hướng thường. href đã được lọc ở schema core |
| `initialOf` | Chữ cái đầu làm monogram khi không có ảnh |

- `PRODUCT_TYPE_LABEL` (`_ui/icons.tsx`) map **đúng enum `ProductType`**: `TEMPLATE` Mẫu tài liệu · `SLIDE` Slide bài
  giảng · `EBOOK` Sách điện tử · `EXAM` Đề thi · `OTHER` Tài liệu; kèm `ProductTypeIcon`. Trang chi tiết sản phẩm
  dùng chung map này (đã thay `TYPE_LABEL` cũ lệch enum) ✅. Không tạo map nhãn loại sản phẩm thứ hai.

### 8.4. Trang chi tiết sản phẩm & checkout — trang hệ thống (ADR-025)

- `[tenantSlug]/[productSlug]` (URL chuẩn `/{tenantSlug}/{productSlug}` từ ADR-030; mọi link tới trang này dựng bằng
  `productPath` từ `@gieochu/core/product-path` — không tự ghép chuỗi) và `[tenantSlug]/checkout/[orderCode]` là **trang hệ thống**:
  `SiteHeader`/`SiteFooter` + `systemFontVars`, màu từ token `brandColors` (`@gieochu/config/theme`) hoặc
  `var(--color-primary)` — **không** dùng `--sf-*`, không bọc `.sf-root` ✅.
- **Chi tiết sản phẩm:** breadcrumb `<nav aria-label="Đường dẫn">` chỉ một mục **"← {tenant.name}"** trỏ `/{slug}`
  (vùng bấm `min-h-11`) ✅. Bố cục 2 cột §4.6, khối mua `lg:sticky lg:top-[112px]` ✅. Tái dùng `PRODUCT_TYPE_LABEL`,
  `ProductTypeIcon`, `IconInfo` từ `[tenantSlug]/_ui/icons.tsx` (icon/nhãn, không phải theme) ✅.
- **Khối mua theo trạng thái** (✅ đọc code 2026-10-17, ADR-040): khách của tenant không `ACTIVE` đã nhận 404 trước khi render
  (`LOCKED` → 404 với cả chủ); người xem là chủ tenant → "Đây là sản phẩm của bạn."; còn lại → `BuyButton`. Dòng "Trang tạm ngưng
  bán — chưa thể mua lúc này." **đã bỏ** (khách không còn tới được trang này khi tenant `READ_ONLY`). Phía server `createOrder` vẫn
  chặn bằng `assertTenantCanWrite`. Trang này **không** hiện banner `StorefrontNotice`.
- **Checkout — bố cục mới (ADR-062, đợt 1 2026-10-27, chưa commit) ✅ đọc code; xem trình duyệt ❓.** Thay đoạn "Checkout" cũ ngay dưới:
  - **Layout chung khu thanh toán** `app/[tenantSlug]/checkout/layout.tsx` (từ task 12/13 chuyển lên từ `[orderCode]/layout.tsx`): skip-link → `SiteHeader` →
    `<main id="noi-dung" class="container-page">` → `SiteFooter`, `systemFontVars`, màu `brandColors` (ngoại lệ ADR-024 §4.4a). Bọc **cả hai** route: trang trước khi có
    đơn `/{tenant}/checkout?tai-lieu=` (route group **`(chua-co-don)`** — chỉ để có `loading.tsx`/`error.tsx` riêng, URL không đổi) và trang đơn `/{tenant}/checkout/{mã}`.
    Đặt ở layout để `loading.tsx`/`error.tsx` của từng route vẫn có header/footer. Dưới `lg` khung có `padding-bottom`
    `calc(5.5rem + safe-area)` để footer không bị thanh dính che.
  - **2 cột từ `lg`**: `grid lg:grid-cols-[minmax(0,1fr)_22rem]`; cột phải `<aside aria-label="Đơn hàng và tiến độ">` **dính** `lg:sticky lg:top-[112px]` (tóm tắt đơn +
    timeline 4 bước Đặt đơn · Thanh toán · Xác nhận · Tải tài liệu + nút chính). Dưới `lg` một cột: dải tóm tắt (`SummaryStrip`), khối thanh toán **QR trước** các dòng
    sao chép (`TransferDetails order="qr-first"`, QR 224px + "Số tiền cần chuyển" lớn + "Tải ảnh QR").
  - **Thanh `.checkout-action-bar`** (`MobileActionBar`, dưới `lg`): `fixed` đáy, trái "Tổng" + số tiền, phải **đúng một** hành động chính; padding đáy theo
    `env(safe-area-inset-bottom)`. `globals.css`: `html:has(.checkout-action-bar) { scroll-padding-bottom: calc(6.5rem + safe-area) }` dưới 64rem để phần tử nhận focus
    không nằm dưới thanh (WCAG 2.4.11).
  - **6 trạng thái** theo `displayStatus` (server tính — §29.1 Endpoint-Directory): Chờ thanh toán · Chờ người bán xác nhận (`StateNotice` info) · Đã thanh toán (success,
    nút "Tải tài liệu" → Thư viện `?tai-lieu=`) · Đã hết hạn (warning, "Đặt lại đơn" khi tài liệu còn bán) · Đã huỷ (neutral) · Đã hoàn tiền (neutral). Badge trạng thái
    `CheckoutStatusBadge`; câu đọc cho trình đọc màn hình khi trạng thái đổi (`statusMessage`).
  - **Hành động khách** (`_ui/order-actions.tsx`): "Tôi đã chuyển khoản" (`DeclarePaidAction`, chỉ cổng xác nhận tay), "Tôi chưa chuyển khoản" (`UndoDeclarePaidAction`),
    "Huỷ đơn" (`CancelOrderAction`); **chỉ "Huỷ đơn"** qua hộp xác nhận `ConfirmDialog` dùng chung phía khách (`app/account/library/_ui/confirm-dialog.tsx` — trả focus về nút mở,
    lỗi server `role="alert"` trong hộp). Chọn/đổi phương thức: `_ui/payment-method-panel.tsx` (thay `provider-panel.tsx` đã xoá), phương thức hết hạn giữ đơn hiện
    không chọn được. Nhãn SePay cho khách: "Chuyển khoản (xác nhận tự động)" (ADR-062 Q8); không logo NAPAS/ngân hàng (Q9); số tiền màu `ink` (không đỏ).
  - Dưới thông tin MoMo có link **"Chính sách người bán"** (Q12) — trỏ trang **Chính sách người bán của nền tảng** (`legalDocumentPath("seller")`). Quốc quyết 2026-10-27 dùng
    tạm trang này; **Phong đã đổi nhãn** cho khớp đích (trước: "Chính sách thanh toán của {gian hàng}") ✅ code.
  - **`loading.tsx`**: khung xương đúng bố cục (ô QR 224×224, các dòng, cột phải từ `lg`), `aria-busy`, chữ "Đang tải trang thanh toán…" cho trình đọc màn hình, tôn trọng
    giảm chuyển động. **`error.tsx`**: không lộ chi tiết kỹ thuật, `role="alert"`, nút "Thử lại" (`retry()` của Next 16) + link "Đơn hàng của tôi".
  - Chỗ dành cho khối "Thông tin người mua" của khách vãng lai (task 12/13) — **chưa dựng**.
- **Checkout (mô tả trước ADR-062, giữ để tra lịch sử)** (`[tenantSlug]/checkout/[orderCode]/page.tsx`): `main.container-narrow`; breadcrumb
  `<nav aria-label="Đường dẫn">` **"← {order.tenant.name}"** về `/{order.tenant.slug}` (dữ liệu có sẵn từ
  `getOrderForCustomer`, không thêm truy vấn); toàn bộ màu theo `brandColors` (ink/inkSoft/line/primary/accent/
  accentSoft/secondary) ✅ (đọc code 2026-09-26, Phong sửa). Khối trạng thái đơn theo pattern §7.1. Hiển thị thật cần
  đăng nhập + đơn thật: ❓ (BACKLOG "verify với dữ liệu thật").
- `BuyButton` (`[tenantSlug]/[productSlug]/buy-button.tsx`): nút pill `min-h-12 w-full`, nền
  **`bg-[color:var(--color-primary)]`** chữ trắng, focus outline cùng màu — **không còn** dùng `pillClass`, **không
  còn phụ thuộc `.sf-root`/`--sf-*`** ✅ (thay ghi chú cũ "phải nằm trong `.sf-root`"). `--color-primary` là alias của
  `--brand-primary` khai trong `globals.css` (màu hệ thống, System Admin đổi được).
- Nút "Xem tất cả" của section products (storefront) ẩn khi không truyền `viewAllHref` (chưa có trang danh sách) ✅.

### 8.5. Quy tắc Server → Client Component: truyền icon bằng key chuỗi

Server Component **không được** truyền component (hàm) sang Client Component — lỗi "Functions cannot be passed
directly to Client Components". Bài học thật: layout Studio truyền `Icon: IconGrid…` vào `TenantSidebarNav`
("use client") làm **mọi `/studio/*` trả 500** (🟡 lỗi runtime theo báo cáo; bản sửa ✅ đã đọc code). Cách đúng:
layout gửi **key chuỗi** (`icon: "grid"`), Client Component giữ bảng `NAV_ICONS` map key → component. Từ ADR-042 bảng này nằm ở
`admin/_ui/sidebar-nav.tsx` (type `SidebarNavIcon`, dùng chung System Center + Studio — §5.1); file `TenantSidebarNav` cũ đã xoá ✅.
Áp dụng cho mọi prop dạng component/hàm.

### 8.6. Pattern form công khai: `useActionState` + honeypot

`[tenantSlug]/_ui/contact-form.tsx`:
- `useActionState(action.bind(null, tenantSlug), null)`; submit qua `onSubmit` + `startTransition` để React **không
  reset ô nhập khi server trả lỗi**; vẫn có `action` cho progressive enhancement (không JS).
- `<label>` thật (ẩn trực quan), lỗi `role="alert"`, thành công thay form bằng khối `role="status"` và dời focus vào
  đó; `aria-busy` khi đang gửi.
- Honeypot: ô `website` trong khối `aria-hidden`, đặt ngoài màn hình, `tabIndex={-1}`, `autoComplete="off"`.

### 8.7. Pattern editor CMS (Studio `/storefront`)

- Thanh trạng thái **sticky** đầu vùng cuộn, `aria-live="polite"`, dùng `Badge`: **Đã xuất bản** (success) hoặc
  "Chưa xuất bản · đang dùng nội dung mẫu" (neutral); **Đang có bản nháp chưa xuất bản** (warning); **Có thay đổi
  chưa lưu** (từ task 2.5: `warning` — sắc chung mọi thanh nút, §25.3; so snapshot JSON; cảnh báo rời trang qua `useUnsavedChanges`, §25.4) ✅ đọc code.
- Task 2.5 (ADR-058): **không** dùng accordion — list-detail chỉ hiện 1 section; "Đánh giá ghim"/"Tài liệu nổi bật" đổi hành vi hiển thị nên không giấu
  (lý do §25.3). Trang bọc `<div>` (bỏ `<main>` lồng).
- Nút: Xem trang (tab mới, sr-only ghi rõ "hiển thị bản đã xuất bản") · Khôi phục bản đang hiển thị (`window.confirm`,
  tắt khi không có nháp) · Lưu nháp · Xuất bản.
- Banner vàng khi chưa xuất bản ("khách không thấy phần đánh giá mẫu"); banner xám khi Cloudinary chưa sẵn sàng.
- Trên storefront, chủ trang đang xem bản demo thấy `StorefrontDemoBanner` "Nội dung mẫu — chỉ bạn thấy thanh này
  và phần đánh giá mẫu." kèm link sang editor ✅.

---

## 9. Editor Sản Phẩm Studio & Trang Xem Trước (ADR-026/027/028)

> Nguồn: `apps/web/app/studio/[tenantSlug]/products/_ui/*` (`product-editor.tsx`, `publish-card.tsx`,
> `delivery-sources.tsx`, `cover-image-card.tsx`, `editor-skeleton.tsx`), `new/page.tsx`, `[productId]/page.tsx`,
> `[productId]/preview/page.tsx`, `apps/web/app/_ui/editor/*`, `apps/web/app/[tenantSlug]/_ui/product-detail.tsx`,
> `products.tsx`, `globals.css`. ✅ = Long đọc code 2026-09-27 (bản sau ADR-027 + ADR-028). **Chưa xem bằng mắt** các
> trang cần đăng nhập (Tạo/Sửa/Xem trước) và chưa upload Cloudinary/R2 thật ❓. Nghiệp vụ:
> [[02-System-Specs/Product-Editor-And-Publishing-Specs|Product-Editor-And-Publishing-Specs]] §6–§8.

### 9.1. Bố cục editor: cột chính + sidebar, card xuất bản đứng đầu (không dính — ADR-030) ✅

- Trang Tạo và Sửa dùng chung `ProductEditor` (`_ui/product-editor.tsx`). Toàn trang là **một `<form class="studio-editor">`**
  (`aria-label` "Tạo sản phẩm"/"Sửa sản phẩm"), **full width** theo khung app (task 2.3a bỏ khung `mx-auto max-w-[1440px]` cũ,
  cả ở skeleton `editor-skeleton.tsx` — quy tắc §5) ✅ grep. ⚠️ Comment đầu `product-editor.tsx` còn ghi "khung tối đa 1440px" (cũ, KB-Audit §40).
- **Accordion (task 2.3a, ADR-058; "Bổ sung ADR-058" (b) — giữ bố cục 2 cột, không thêm tab):** các khối Thông tin / Giá / Danh mục & loại / Thẻ / Lượt
  tải / Link chia sẻ là `CollapsibleSection`; Ảnh đại diện, Tệp tài liệu, card Xuất bản **không thu gọn** — chi tiết bảng §25.3.
- **≥ xl:** lưới `xl:grid-cols-[minmax(0,1fr)_360px]` (`gap-6`, `xl:gap-8`). **Cột chính** theo thứ tự: Thông tin tài liệu
  (tiêu đề, đường dẫn, mô tả ngắn, mô tả Tiptap) → **Giá & khuyến mãi** → **Ảnh đại diện** (`CoverImageCard`) → **Tệp tài
  liệu** (`DeliverySourcesCard`). **Sidebar 360px:** card xuất bản `PublishCard` ở **đầu** (đưa lên bằng `xl:order-first`),
  **không dính** khi cuộn ở mọi kích thước (ADR-030 §3 — bỏ `xl:sticky`, bỏ `xl:self-stretch` của sidebar; lý do: card cao hơn
  màn hình, che chức năng bên dưới), tiếp theo các card thuộc tính (Danh mục & loại, Thẻ, Giới hạn lượt tải, Link chia sẻ
  private ở trang Sửa); toàn sidebar cuộn bình thường cùng trang. ✅ đọc `product-editor.tsx` 2026-09-28: wrapper chỉ còn
  `xl:order-first`.
- **< xl (1 cột):** card xuất bản ở **cuối form** (đúng trình tự điền → lưu; thứ tự DOM của sidebar = card thuộc tính
  trước, card xuất bản sau) + **thanh lưu nhanh** `.studio-save-bar` (`sticky bottom-0 z-20`, `xl:hidden`, nền trắng,
  viền trên, `safe-area-inset-bottom`): dòng trạng thái rút gọn (`aria-hidden` — vùng `aria-live` duy nhất nằm trong card
  xuất bản) + một nút ("Lưu nháp" khi chưa công khai, nếu không thì nhãn nút chính). Chỉ hiện khi có thay đổi/đang
  lưu/có kết quả lưu **và** khối nút của card xuất bản chưa trong tầm nhìn (`IntersectionObserver`); ẩn bằng `invisible`
  (giữ chỗ, không nhảy layout), thuộc tính `data-visible`.
- **Không còn thanh hành động dính đáy** `.studio-action-bar` của bản ADR-026/027 đầu tiên — đã thay bằng card xuất bản +
  thanh lưu nhanh ✅.
- `globals.css`: dưới `80rem` (xl), `html:has(.studio-save-bar[data-visible="true"])` đặt `scroll-padding-bottom: 6rem`
  (WCAG 2.4.11); `.studio-editor :is(a, button, summary):focus-visible` outline 2px `--brand-primary`;
  `touch-action: manipulation`; `.studio-editor .gieochu-editor-content { min-height: 12.5rem }` (khung mô tả thấp hơn
  mặc định 280px để các card Giá/Ảnh/Tệp không bị đẩy quá sâu).
- Tóm tắt lỗi đầu form (`role="alert"`, link tới từng field); focus tự chuyển: lỗi lưu → tóm tắt lỗi, bị chặn công khai
  → checklist (tôn trọng `prefers-reduced-motion` khi cuộn); từ task 2.3a tóm tắt lỗi mở đúng khối chứa ô lỗi. Cảnh báo rời trang
  khi còn thay đổi chưa lưu **hoặc còn file đang tải** — từ task 2.3a qua `useUnsavedChanges(dirty || uploading, …)` (§25.4; trước đó là
  `beforeunload` riêng, không chặn bấm sidebar) ✅ đọc code. Skeleton `loading.tsx` cho trang Tạo và Sửa.
- **Landmark:** trang Tạo/Sửa (và skeleton) bọc bằng `<div>`, **không** `<main>` — `studio/[tenantSlug]/layout.tsx` đã có
  `<main>`. Quy tắc cho mọi trang con Studio: dùng `<div>`. Từ GĐ 2 ADR-058 không còn trang Studio nào lồng `<main>` ✅ grep (§25.8).

### 9.2. Quy ước form trong editor ✅

- **Tách ô khỏi form sản phẩm bằng thuộc tính `form` trỏ id không tồn tại:** `DETACHED_FORM_ID =
  "product-editor-detached-fields"` (`_ui/delivery-sources.tsx`). Các ô nằm trong `<form>` sản phẩm nhưng không thuộc
  về nó (thêm/sửa link, chọn cách thêm, đánh dấu preview) gán `form={DETACHED_FORM_ID}` → không bị gửi kèm, không bị
  validate/reset theo form cha, Enter trong ô đó không submit form sản phẩm. Ô cần Enter có `onKeyDown` chặn Enter rồi
  tự gọi action riêng.
- **Submit thủ công** để tránh React 19 reset form khi lưu lỗi: nút → `form.reportValidity()` → `new FormData(form)` (xoá
  rồi đặt lại `visibility` theo **nút được bấm**) → `startTransition(() => dispatch(fd))` với `useActionState`. Không dùng
  `<form action>` trực tiếp. Cùng tinh thần §8.6.
- **Enter trong ô nhập = Lưu nháp** khi chưa công khai: "Lưu nháp" là nút `type="submit"` mặc định, "Xuất bản" là
  `type="button"` → Enter không bao giờ vô tình xuất bản.
- Tag input: Enter/dấu phẩy tạo chip, không submit; chữ đang gõ dở vẫn được gửi khi bấm Lưu.

### 9.3. `TiptapEditor` — quy tắc chung + upload ảnh (ADR-028) ✅

- **Không `overflow-hidden` ở khung ngoài** `TiptapEditor` (`app/_ui/editor/tiptap-editor.tsx`): popover của toolbar tràn
  ra ngoài sẽ bị cắt, và khi input `autoFocus` trình duyệt cuộn ngang chính khung đó làm lệch toolbar + nội dung. Bo góc
  do toolbar (`rounded-t-lg`) và footer (`rounded-b-lg`) tự lo.
- **Enter trong ô của popover toolbar (URL liên kết, Alt ảnh) không submit form cha**: `onKeyDown` bắt Enter →
  `preventDefault()` rồi áp; Escape đóng popover.
- **Không còn chèn ảnh bằng URL** (ADR-028 §3). Prop `imageUpload?: TiptapImageUpload` (`app/_ui/editor/image-upload.ts`):

  | Trường | Kiểu | Ý nghĩa |
  |---|---|---|
  | `getSignature` | `() => Promise<CloudinarySignatureResult>` | Server Action cấp chữ ký (folder/định dạng khoá trong chữ ký) |
  | `register?` | `(publicId) => Promise<{ok:true,url} \| {ok:false,error,errorCode?}>` | Ảnh tenant: đăng ký sau upload (tính hạn mức), trả URL để chèn. Admin không truyền |
  | `upgradeHref?` | `string` | Link nâng gói hiện cạnh lỗi `IMAGE_QUOTA_EXCEEDED` (Studio: `/studio/<slug>/billing`) |

  Không truyền `imageUpload` → **ẩn nút chèn ảnh**. Nơi dùng: editor mô tả sản phẩm (`getContentImageUploadSignatureAction`
  + `registerTenantImageAction(..., "CONTENT")` + `upgradeHref`), editor mô tả danh mục admin
  (`getCloudinaryUploadSignatureAction`, không `register`).
- **Kiểm ở client trước khi xin chữ ký:** chỉ PNG/JPEG/WebP (`accept="image/png,image/jpeg,image/webp"`), ≤ **5MB**
  (`EDITOR_IMAGE_MAX_BYTES`) — thông điệp "Chỉ chèn được ảnh PNG, JPG hoặc WebP." / "Ảnh tối đa 5MB — hãy nén hoặc giảm
  kích thước ảnh rồi thử lại.". Server/Cloudinary vẫn kiểm lại (định dạng trong chữ ký, cạnh ≤2000px).
- **Ba cách chèn:** nút ảnh trên toolbar (mở chọn file), **kéo-thả** file vào vùng soạn (chèn tại vị trí thả), **dán**
  ảnh từ clipboard. Mỗi lần một ảnh (lấy file ảnh đầu tiên); đang tải thì không nhận ảnh mới.
- **Trạng thái dưới vùng soạn:** đang tải — "Đang tải ảnh “<tên>” lên… N%" + `<progress>` (`aria-label` "Tiến độ tải
  ảnh"; upload bằng XHR để có tiến độ); xong — "Đã chèn ảnh. Nhấn vào ảnh rồi chọn nút “Alt” để sửa mô tả ảnh."; lỗi —
  thông điệp tiếng Việt, riêng lỗi hạn mức (`IMAGE_QUOTA_EXCEEDED`) kèm link nâng gói khi có `upgradeHref`.
- **Alt ảnh:** alt mặc định lấy từ tên file (bỏ đuôi, `_`/`-` → khoảng trắng, ≤120 ký tự); chọn ảnh → nút **"Alt"** trên
  toolbar mở popover sửa mô tả ảnh.
- Thông điệp khi action ký ném lỗi không hiển thị được (thường do mất quyền / phiên hết hạn): "Không lấy được quyền tải
  ảnh lên. Phiên đăng nhập có thể đã hết hạn hoặc tài khoản không có quyền — tải lại trang rồi thử lại." (dùng chung với
  `ImageUploadField`, §9.9).
- Nút toolbar hiện `h-8 w-8` (32px) — dưới mức vùng chạm 44px trên mobile (BACKLOG).

### 9.4. Tệp tài liệu & link ✅

- Badge quét file (`SCAN_BADGE`, tone `Badge` §7): `PENDING` → **"Đang quét"** (warning), `CLEAN` → **"An toàn"**
  (success), `REJECTED` → **"Bị từ chối"** (danger).
- Khu link ngoài hiện danh sách host cho phép (từ `EXTERNAL_DOCUMENT_*` của core, wildcard hiển thị `*.sharepoint.com`)
  và cảnh báo "Link ngoài không được quét, không chống chia sẻ lại; bạn chịu trách nhiệm quyền truy cập của link…".
- **Trang Tạo không khoá card Tệp tài liệu** ("Sửa đổi ADR-027 §4"): thêm file/link đầu tiên tự tạo bản nháp
  (`ensureProductId`); thiếu tiêu đề → focus ô Tiêu đề + "Nhập tiêu đề trước khi thêm tài liệu…"; dòng trạng thái tạo
  nháp ("Đang tạo bản nháp...") là vùng `aria-live` của card. Trên trang Tạo danh sách file/link giữ cục bộ trong card
  (`sync="local"`), trang Sửa lấy từ server. Không còn khối thông báo "cần lưu trước" (LockedNotice) ✅.

### 9.5. Card xuất bản `PublishCard` — chế độ hiển thị + nút ✅

- `_ui/publish-card.tsx` (kiểu hộp "Publish"), thứ tự: nhóm radio **Công khai** (`IconGlobe`, "Hiện trên trang bán — khách
  xem và mua được.") / **Riêng tư** (`IconLock`, "Chỉ bạn thấy trong Studio. Dùng khi đang soạn hoặc muốn tạm ẩn.") →
  checklist điều kiện (chỉ trang Sửa — cần loader) → dòng trạng thái lưu (`aria-live`) → khối nút → chân card Lưu trữ /
  Khôi phục (tách bằng đường kẻ). Radio dạng thẻ (`label` bọc input gốc, vùng bấm ≥ 44px). `ARCHIVED`: không radio, chỉ
  "Khôi phục" (về Riêng tư). Card (id `publish-status`) nhận focus khi bị chặn công khai.
- **Khối nút:**

  | Trạng thái hiện tại | Nút chính (hàng 1, full width) | Hàng 2 |
  | :-- | :-- | :-- |
  | Chưa tạo / `DRAFT` | **[Xuất bản]** luôn hiện, `type="button"`, gửi `PUBLIC` | [Xem trước \| Lưu nháp] — "Lưu nháp" là submit mặc định, gửi `PRIVATE` |
  | `PUBLISHED` | Theo radio: "Lưu thay đổi" (Công khai) / "Lưu & chuyển Riêng tư" (có `confirm`) | [Xem trước] |
  | `ARCHIVED` | "Lưu thay đổi" (không gửi `visibility`) | [Xem trước] |

- **Chưa công khai: gửi theo nút bấm, không theo radio** — bấm nút thì radio được đồng bộ theo nút. Công khai bị chặn →
  radio tự về Riêng tư, card báo "Đã lưu ở chế độ Riêng tư — chưa đủ điều kiện công khai…". Nhãn khi đang gửi: "Đang
  xuất bản..." / "Đang lưu...".
- **Công khai → Riêng tư** trên sản phẩm đang `PUBLISHED`: `window.confirm("Chuyển sang Riêng tư? Tài liệu sẽ ẩn khỏi
  trang bán cho tới khi bạn Công khai lại.")`. Lưu trữ/Khôi phục cũng có `confirm` (nhắc thay đổi chưa lưu không đi kèm).
- Màu chữ trạng thái thành công dùng tạm `GREEN_TEXT = "#15803D"` (`_ui/editor-bits.tsx`) để đạt ≥ 4.5:1 — chưa có
  token chính thức trong `theme.ts` (BACKLOG).
- ⚠️ Danh sách sản phẩm Studio (`products/page.tsx`) và `PRODUCT_STATUS_LABEL` (`editor-bits.tsx`) vẫn ghi
  "Nháp"/"Đã xuất bản" — chưa đổi sang Riêng tư/Công khai (BACKLOG).

### 9.6. Luồng Tạo → Sửa và Xem trước ✅

- Trang Tạo lưu thành công → `router.replace("/studio/<slug>/products/<id>?created=draft|published|blocked")` — **trừ khi
  còn file đang tải** (bản nháp tự tạo): ở lại trang, kết quả hiện trong card xuất bản. Trang Sửa hiện thông báo tương ứng
  (`blocked` = `WarningNote` "Đã lưu ở chế độ Riêng tư" + focus checklist), rồi gỡ `?created=` bằng `history.replaceState`.
- Trong phiên bản nháp tự tạo, URL **giữ `/products/new`**, editor không remount (không ngắt upload).
- **Nút "Xem trước":**
  - Chưa có `productId` (trang Tạo, chưa tạo nháp): `<button>` mở tab trống **ngay trong cú bấm** (tránh chặn popup), lưu
    nháp (Riêng tư), xong thì điền URL xem trước vào tab; lưu lỗi → đóng tab, lỗi hiện trên form. sr-only "(lưu nháp rồi
    mở tab mới)".
  - Đã có `productId` (trang Sửa hoặc nháp tự tạo): `<Link target="_blank">` tới `/preview` — hiển thị **bản đã lưu**.
    sr-only "(bản đã lưu, mở tab mới)".
- Trang Xem trước (`[productId]/preview/page.tsx`, nằm **trong app shell Studio**, dùng `<div>` vì layout đã có `<main>`):
  - Dải `.studio-preview-bar` (`sticky top-0 z-30`, nền `brandColors.ink`, chữ trắng): `IconEye` + "Bản xem trước — khách
    chưa thấy trang này", pill chế độ hiển thị (icon + chữ: Riêng tư / Công khai / Đã lưu trữ, sr-only "Chế độ hiển
    thị:"), nút "Quay lại chỉnh sửa" (`min-h-11`, `sm:min-h-9`). Sản phẩm Công khai có thêm dòng giải thích.
  - Khung `.studio-preview-frame` (bo góc, viền, `systemFontVars`, màu `brandColors`) chứa `SiteHeader` +
    `ProductDetailView` + `SiteFooter`. `globals.css` (ngoài `@layer`): `.studio-preview-frame .site-header { position:
    static }` để header không đè dải; `html:has(.studio-preview-bar) { scroll-padding-top: 7rem }`.
  - Nút "Mua ngay" `disabled`, `aria-describedby` tới ghi chú "Nút mua bị tắt trong bản xem trước."

### 9.7. `ProductDetailView` dùng chung (trang công khai + xem trước) ✅

- `app/[tenantSlug]/_ui/product-detail.tsx` — **chỉ dùng trong Server Component**. Mô tả chi tiết được **sanitize lại lúc
  render** bằng `sanitizeRichTextHtml(raw, { imageCloudName, imageWidth: 1200 })` — ảnh ngoài cloud hệ thống bị loại, ảnh
  hợp lệ được tối ưu `f_auto,q_auto,c_limit,w_1200` (ADR-028) — rồi render trong `.gieochu-rich-content` (`max-w-prose`,
  `overflow-wrap:anywhere`). Ảnh bìa qua `cloudinaryDeliveryUrl(..., { width: 1200 })`. `summary` hiện dưới tiêu đề.
- Prop `categoryName` tuỳ chọn: có truyền → hàng "Danh mục" (null = "Chưa chọn"). Trang xem trước truyền; **trang công
  khai chưa truyền** (loader chưa có `categoryName` — BACKLOG).
- Khối mua truyền qua prop `purchase` (trang công khai: khối M8 §8.4; xem trước: nút vô hiệu).

### 9.8. Ảnh Cloudinary trên trang public — độ rộng theo ngữ cảnh (ADR-028) ✅

- Mọi ảnh Cloudinary hiển thị qua `cloudinaryDeliveryUrl(url, { width })` (`@gieochu/core/cloudinary-url`): thẻ tài liệu
  storefront **800**, ảnh bìa chi tiết **1200**, ảnh trong mô tả **1200**, hero storefront **1000**, hero trang chủ hệ thống **1200** (§12.10), avatar testimonial / icon dịch
  vụ **200**, preview trong `ImageUploadField` **600**; logo gian hàng trên thẻ **160** (`tenantLogoUrl`), logo trong hero storefront chưa áp. Bảng đầy đủ (rà lại 2026-10-23):
  [[02-System-Specs/File-Storage-And-Downloads-Specs|File-Storage-And-Downloads-Specs]] §7.4.
- Thẻ tài liệu (`[tenantSlug]/_ui/products.tsx`): ảnh `aspect-[4/3]` dưới `lg`, `lg:aspect-[16/10]`; tiêu đề
  `line-clamp-2`; có `summary` → đoạn `line-clamp-2` chữ `text-white/85`. Ảnh bìa theo thứ tự Cloudinary → R2 (`coverUrl`).

### 9.9. `ImageUploadField` (`admin/_ui/image-upload-field.tsx`) ✅

- Prop `removeLabel` (mặc định "Xoá ảnh"; ảnh bìa sản phẩm dùng "Gỡ ảnh"); prop `getSignature` (mặc định
  `getCloudinaryUploadSignatureAction` — **chỉ `SYSTEM_ADMIN`** từ ADR-028) và `register?` (ảnh tenant).
- **Vùng kéo-thả là `<button>`** — chọn được bằng bàn phím (Enter/Space); kéo-thả chỉ là cách bổ sung.
- Action ký ném lỗi không hiển thị được → thông điệp **lỗi quyền**: "Không lấy được quyền tải ảnh lên. Phiên đăng nhập có
  thể đã hết hạn hoặc tài khoản không có quyền — tải lại trang rồi thử lại." (trước đây dễ bị hiểu là lỗi mạng). Lỗi
  `ok:false` của action (vd `IMAGE_QUOTA_EXCEEDED`, `CLOUDINARY_NOT_CONFIGURED`) hiện nguyên thông điệp tiếng Việt.
- Preview ảnh qua `cloudinaryDeliveryUrl(value, { width: 600 })`.
- Ảnh bìa sản phẩm (`_ui/cover-image-card.tsx`): `getSignature` = `getProductCoverUploadSignatureAction`, `register` =
  `registerTenantImageAction(..., "PRODUCT_COVER")`, `accept` png/jpeg/webp, `maxBytes` 5MB (client), gợi ý tỉ lệ 16:10
  (1600×1000). Ảnh R2 cũ hiện kèm `WarningNote` "Đang dùng ảnh cũ" cho tới khi lưu ảnh mới. Storefront editor dùng
  `getTenantCloudinaryUploadSignatureAction` + `register(..., "STOREFRONT")`.

### 9.10. Việc còn mở (BACKLOG, liên quan UI)

~~`<main>` lồng nhau ở các trang Studio khác~~ — ✅ hết từ GĐ 2 ADR-058 (2026-10-25, grep: chỉ layout Studio và trang onboarding `studio/page.tsx`
— nằm ngoài layout — còn `<main>`; §25.8); trang Xem trước nằm trong khung Studio (muốn toàn trang cần tách route group); 404 trả HTTP 200 khi
`loading.tsx` đã stream (trang Sửa/Xem trước sai tenant); token màu chữ thành công; nhãn danh sách sản phẩm; tên danh
mục ở trang công khai; nút toolbar editor 32px < 44px trên mobile; upload nhiều ảnh cùng lúc trong editor; dòng "Đã dùng
X/Y MB ảnh" (cần action đọc hạn mức); kiểm bằng mắt các trang cần đăng nhập ❓.

---

## 10. Giao Diện Đánh Giá (M10a — ADR-029) ✅

Đọc code 2026-09-28. Nghiệp vụ: [[02-System-Specs/Reviews-Specs|Reviews-Specs]]. Kiểm bằng mắt trên trình duyệt với dữ liệu
thật ❓ (đã có script dữ liệu demo cho DB dev — [[04-Operations-Runbooks/Dev-Demo-Data-Runbook|Dev-Demo-Data-Runbook]]; chưa có
báo cáo kiểm bằng mắt).

### 10.1. Mảnh dùng chung (`apps/web/app/[tenantSlug]/_ui/review-parts.tsx`)

Không dùng hook → import được từ Server lẫn Client Component.

| Export | Vai trò |
| :-- | :-- |
| `ReviewStars` | Hàng 5 sao chỉ đọc; cả hàng là **1 ảnh có tên** (`role="img"` + `aria-label`, mặc định "Đánh giá {n} trên 5 sao") thay vì 5 hình rời. `rating` lẻ (điểm TB) → tô theo làm tròn gần nhất; con số chính xác luôn hiện bằng chữ bên cạnh ở nơi dùng. Màu theo `currentColor` — nơi dùng tự đặt màu. Prop `starClassName` (mặc định `h-4 w-4`) |
| `REVIEW_RATING_WORDS` | Nhãn chữ theo mức sao: 1 "Rất không hài lòng" · 2 "Chưa hài lòng" · 3 "Bình thường" · 4 "Hài lòng" · 5 "Rất hài lòng" — **sao luôn đi kèm chữ**, không truyền đạt chỉ bằng số sao/màu |
| `formatReviewDateTime` / `formatReviewDate` | Giờ Việt Nam (`Asia/Ho_Chi_Minh`), ví dụ "14:05 27/09/2026" |
| `formatRatingAverage` | Điểm TB kiểu Việt Nam: 4.6 → "4,6" |
| `reviewerInitial` | Chữ cái đầu tên hiển thị cho avatar chữ |

**Màu sao** (quy ước):

| Ngữ cảnh | Màu |
| :-- | :-- |
| Trang hệ thống (chi tiết tài liệu, composer, Studio) | `text-[color:var(--color-accent)]` |
| Storefront (section "Đánh giá") | `text-[color:var(--sf-accent-text)]` |
| Thẻ tài liệu trên dải tối storefront (`RatingLine` trong `_ui/products.tsx`) | `text-amber-300` + chữ trắng — "★ 4,6 (12)", chữ sr-only đầy đủ |

### 10.2. Trang chi tiết tài liệu — `ProductReviewsSection` (`_ui/product-reviews.tsx`)

- `<section id="danh-gia">` (`PRODUCT_REVIEWS_ANCHOR`) + `aria-labelledby`, `scroll-mt-28` để anchor không bị header hệ thống
  dính che. Props: `tenantName`, `summary: ProductRatingSummary`, `items: PublicReview[]`, `composer?`, `loadMore?`,
  `resetHref?`, `footer?`, `className?`.
- Tóm tắt điểm + phân bố sao chỉ khi `count > 0`; rỗng → `EmptyState` nét đứt "Chưa có đánh giá" (hoặc "Không còn đánh giá
  nào cũ hơn" khi đang ở trang cursor). Danh sách là `<ol aria-label="Danh sách đánh giá">`; mỗi mục (`PublicReviewItem`):
  sao + chữ, tên, nhãn **"Đã mua"**, giờ VN, nội dung text thuần giữ xuống dòng, khối "Phản hồi từ {tenant}".
  Dòng đếm "Đang hiện X/Y đánh giá" có `aria-live="polite"`.
- `ProductRatingInline`: dòng điểm cạnh tiêu đề, link tới `#danh-gia`.
- **Phân trang không cần JS** (server render theo searchParams, `page.tsx`): `?reviews=N` — N làm tròn lên bội 10, từ 10 tới
  tối đa 50 (link "Xem thêm đánh giá" tăng 10, giữ vị trí cuộn); quá 50 → `?reviewsAfter=<cursor>` (trang 50 đánh giá cũ
  hơn, link "Xem đánh giá cũ hơn" + `#danh-gia`, `replace`) kèm link "Về đánh giá mới nhất". Cursor phải khớp
  `^[a-z0-9]{1,40}$`. Tải thêm bằng client khi > 50 (`loadMoreProductReviews`) chưa có — BACKLOG.
- Trang Xem trước Studio dùng lại cùng component.

### 10.3. `ReviewComposer` (`_ui/review-composer.tsx`, client)

- Union props: `{ viewer: "guest", loginHref }` → lời mời đăng nhập (`/login?next=...#danh-gia`);
  `{ viewer: "customer", productId, tenantName, canReview, existing, displayNamePreview, profileHref }`.
- Chủ tenant không thấy composer. Khách chưa đủ điều kiện và chưa có đánh giá → giải thích ngắn.
- Form: chọn sao là **nhóm radio gốc** (phím mũi tên dùng được, ô 44×44, nhãn "n sao — {chữ}", dòng trạng thái "n/5 — {chữ}"
  hoặc "Chưa chọn"); textarea đếm ký tự theo code point (≤ 2000); xem trước tên hiển thị + link sửa hồ sơ.
- Đã viết: xem đánh giá của mình + nút Sửa / Xoá (`window.confirm`); bị ẩn → khối cảnh báo "Đánh giá của bạn đã bị ẩn — {nhãn
  lý do tiếng Việt}". Kết quả gửi/xoá thông báo qua 1 vùng `role="status"` luôn gắn sẵn. Nút `min-h-11`, màu
  `--color-primary`.

### 10.4. Section "Đánh giá" storefront (`_ui/storefront-reviews.tsx` — `ReviewsSection`)

Thẻ đánh giá thật: sao `h-5 w-5` màu `--sf-accent-text`, tên, nhãn "Đã mua", ngày, tên tài liệu link tới
`productPath(slug, productSlug)#danh-gia` = `/{slug}/{productSlug}#danh-gia` (ADR-030). Không có đánh giá → trang không render section. Section `testimonials` giờ hiển
thị là **"Cảm nhận"**, **bỏ sao** (trường `rating` cũ vẫn giữ trong dữ liệu), anchor `#cam-nhan`.

### 10.5. Studio → Đánh giá — `StudioReviewCard` (`studio/[tenantSlug]/reviews/_ui/review-card.tsx`, client)

- Dữ liệu `StudioReviewCardData` (Date đã tuần tự hoá ISO). Hiển thị sao + "n/5 — {chữ}", tên tài liệu link tới trang công
  khai `#danh-gia`, trạng thái/lý do ẩn.
- Panel `reply` (textarea ≤ 2000, gửi rỗng = xoá trả lời) và `hide` (select lý do bắt buộc từ `TENANT_REVIEW_HIDE_REASONS`);
  nút Khôi phục; đánh giá `REFUNDED` → nút khoá `disabled` + `aria-describedby` giải thích. Mọi nút dùng
  `RowActionButton size="touch"`. Kết quả qua vùng `role="status"`.
- Trang danh sách: lọc trạng thái/sản phẩm/số sao, phân trang cursor `?cursor=`.
- **Sidebar Studio:** mục **"Đánh giá"** (icon `IconStarOutline`, key `star`, nhóm "Nội dung") kèm badge pill N = số đánh giá `VISIBLE`
  **chưa trả lời** (`99+` khi > 99; N = 0 → không có pill; trình đọc màn hình "N đánh giá chưa trả lời"). Trước ADR-042 là nhãn "Đánh giá (N)". Tổng quan Studio có `StatCard` "Đánh giá mới" (7 ngày gần nhất).
- Ghi nhận khi đối chiếu: `review-card.tsx` khai màu hex cục bộ (`#12213A`, `#6B7280`, `#E5E7EB`, `#0F3B82`) thay vì đọc
  `brandColors` như `review-composer.tsx` ✅ (đọc code) — ghi để Phong/Quốc cân nhắc, không phải lỗi hành vi.

---

## 11. Giao Diện Bài Viết (M10b — ADR-029) ✅

Đọc code 2026-09-28. Nghiệp vụ: [[02-System-Specs/Posts-Specs|Posts-Specs]]. Kiểm bằng mắt trên trình duyệt với dữ liệu thật ❓
(chưa có dữ liệu demo bài viết).

### 11.1. Sidebar Studio

Từ ADR-042 sidebar Studio dùng `SidebarNav` chung (§5.1) với `storageKey="studio:nav:expanded"`, `ariaLabel="Điều hướng Studio"` ✅
(`studio/[tenantSlug]/layout.tsx`, mảng `NAV_STANDALONE` + `NAV_GROUPS`):

| Vị trí | Mục (icon key) | Badge |
| :-- | :-- | :-- |
| Đứng riêng | Tổng quan (`grid`) | — |
| Nhóm **Bán hàng** (`shoppingBag`) | Đơn hàng (`receipt`) · Khách hàng (`users`) · Mã giảm giá (`tag`) | Đơn hàng: số yêu cầu hoàn tiền của khách chờ xử lý (ADR-039), `urgent` khi có mục quá hạn |
| Nhóm **Nội dung** (`doc`) | Sản phẩm (`package`) · **Bài viết** (`posts`) · Trang bán hàng (`layers` — trước là `store`) · Đánh giá (`star`) | Đánh giá: số chưa trả lời |
| Nhóm **Gian hàng** (`store`) | Hộp thư (`mail`) · Gói dịch vụ (`card`) · Hoạt động (`eye`, **chỉ `OWNER`** — ADR-037) · Cài đặt (`gear`) | Hộp thư: số tin nhắn mới |

Trước ADR-042: danh sách phẳng 11 mục (12 với OWNER), số đếm nằm trong nhãn "(N)" — đã thay. Mục BACKLOG "nhóm mục khi sidebar dài" đã xong.

**Theo ADR-058 — đã áp task 2.1** ✅ đọc code 2026-10-25 (đã commit `fa29d99`; chưa thử trình duyệt ❓):
* `ModuleTabs` **"Cài đặt"** gồm 2 tab **Thông tin & thương hiệu** (`/studio/{slug}/settings`) · **Thanh toán** (`/studio/{slug}/settings/payments`). Một nguồn:
  `studio/[tenantSlug]/settings/_ui/settings-tabs.ts` (`studioSettingsTabs(tenantSlug)`, `STUDIO_SETTINGS_TABS_LABEL` = "Các trang trong Cài đặt"). Cả 2 trang
  h1 **"Cài đặt"**, subtitle bắt đầu bằng tên tab. Đã bỏ link chữ "Thanh toán" ở cuối trang Cài đặt; 2 trang bọc `<div>` (bỏ `<main>` lồng).
* Sidebar **không đổi** và **không cần `match`**: href `/studio/{slug}/settings` đã khớp tiền tố `/settings/payments` (luật §25.5) nên mục "Cài đặt" sáng ở cả
  2 tab 🟡 (Phong rà bằng script; Long đọc luật khớp tiền tố trong `nav-match.ts`, khớp).
* Hai trang tab **không** khai `metadata.title` riêng ✅ grep (khác System Center sau task 1.14) — KB-Audit §40.
* **Trang sửa tài liệu** `/products/{id}` **giữ nguyên bố cục, không thêm tab** ("Bổ sung ADR-058" (b)) — trang Link chia sẻ vẫn là trang riêng; accordion
  cho các khối (task 2.3a/2.3b, §25.3).

### 11.2. Studio → Bài viết — danh sách (`studio/[tenantSlug]/posts/page.tsx` + `_ui/post-list.tsx`)

- `AdminPageHeader` + nút **"Viết bài"** (`PrimaryLinkButton` → `/posts/new`).
- **Lọc bằng tab-link** (không JS): "Tất cả" · "Đã đăng" · "Bản nháp" · "Bị ẩn" → `?status=`; tab đang chọn có
  `aria-current="page"`. Phân trang cursor `?cursor=` (link "Trang sau →" / "← Về trang đầu", hết thì "Đã hết danh sách.");
  `EmptyState` (icon `IconNewspaper`)
  khi rỗng, có biến thể "Không còn bài nào" khi đang ở trang cursor.
- **Mỗi bài là 1 thẻ** (không bảng cuộn ngang, đọc tốt trên mobile): tiêu đề link sang editor, `Badge` trạng thái
  (`POST_STATUS_TONE`: DRAFT `warning`, PUBLISHED `success`, HIDDEN `danger` — luôn kèm chữ), nhãn ghim (`IconPin` + chữ,
  thẻ ghim có vạch trái màu primary), trích đoạn 2 dòng, thời gian giờ VN (`formatPostDateTime`), tài liệu gắn kèm (hậu tố
  "(Riêng tư)" / "(Đã lưu trữ)"), lý do ẩn (`IconEyeOff`).
- Hàng nút `RowActionButton size="touch"`: Sửa (bài HIDDEN → "Xem"), Xem bài (chỉ PUBLISHED, tab mới), Ghim/Bỏ ghim (trừ
  HIDDEN), Xoá (xác nhận `window.confirm`). Kết quả báo qua **1 vùng `role="status"` chung**; sau khi xoá focus chuyển về vùng
  đó (thẻ bị xoá biến mất).
- `listTenantPosts` đã trả `imageUrl` (ảnh hợp lệ đầu bài, rộng 320) ✅ nhưng **danh sách chưa hiển thị ảnh** (đọc
  `post-list.tsx` 2026-09-28 ✅) — dữ liệu sẵn cho bước giao diện tiếp theo (việc của Phong nếu Quốc giao).

### 11.3. Editor bài viết (`_ui/post-editor.tsx`, client) — trang `posts/new` và `posts/[postId]`

- **Accordion (task 2.4, ADR-058)** ✅ đọc code: **Nội dung bài viết** (mở) · **Tài liệu liên quan** · **Ghim bài** (thu gọn) — bảng §25.3. Card Xuất bản và
  chế độ xem bài bị ẩn không đổi. Cảnh báo rời trang qua `useUnsavedChanges` (thay `beforeunload` riêng).
- **Khung như editor sản phẩm (§9.1):** full width (Quốc bỏ `mx-auto max-w-[1440px]` 2 chỗ, 2026-10-25 ✅ grep); ≥ `xl` lưới `minmax(0,1fr) 360px` — cột chính (tiêu đề tuỳ chọn +
  nội dung Tiptap) + sidebar (card xuất bản đứng đầu bằng `xl:order-first`, **không dính** khi cuộn — ADR-030 §3 ✅ đọc `post-editor.tsx`
  2026-09-28; card "Tài liệu liên quan" và "Ghim" ở dưới, cả sidebar cuộn cùng trang); < `xl` 1 cột, card xuất bản ở **cuối**
  + thanh lưu nhanh `.studio-save-bar` dính đáy khi có thay đổi (giữ nguyên).
- Class `studio-editor studio-post-editor`: vùng soạn thảo `min-height: 22rem` (`globals.css`, `.studio-editor.studio-post-editor
  .gieochu-editor-content`).
- **Nút:** bài chưa đăng → **[Đăng bài]** (`type="button"`, gửi `PUBLISHED`) + **[Lưu nháp]** (submit mặc định — Enter trong ô
  tiêu đề không vô tình đăng); bài đã đăng → **[Lưu thay đổi]** (không gửi `status` = giữ nguyên) + **[Gỡ bài (về Bản nháp)]**
  (xác nhận, gửi `DRAFT`) + link "Xem bài đã đăng". Trang Tạo lưu xong → chuyển sang trang Sửa.
- **Ảnh:** `TiptapEditor` dùng chữ ký `getPostImageUploadSignatureAction` + `registerTenantImageAction(..., "POST")`. Bộ đếm
  "Ảnh: n/6" (màu cảnh báo khi đủ 6, đỏ + `IconAlertTriangle` khi vượt). **Chặn ảnh thứ 7 ở client** bằng cách bọc
  `getSignature`: khi đã có ≥ 6 ảnh trả chữ ký lỗi thay vì gọi server (server vẫn kiểm `POST_TOO_MANY_IMAGES`).
- **Không gửi `productId` khi không đổi** (sửa bài): tránh kiểm lại sản phẩm đã lưu trữ đang gắn. Ô chọn "Tài liệu liên quan":
  sản phẩm đã lưu trữ hiển thị nhưng `disabled` trừ khi đang được gắn.
- Submit thủ công (`startTransition` + dispatch) để form **không tự reset** khi lưu lỗi; lỗi theo field từ `fieldErrors`;
  `POST_HIDDEN_LOCKED` / `POST_NOT_FOUND` → làm mới trang.
- **Bài HIDDEN:** khoá toàn bộ — chỉ xem nội dung (render `bodyHtml` đã sanitize lại, `dangerouslySetInnerHTML`) + card "Trạng
  thái" (`Badge danger` "Bị ẩn do vi phạm") + nút **Xoá bài viết**.
- Bài ghim nhưng chưa đăng → ghi chú "chỉ hiện công khai sau khi bạn Đăng bài".

### 11.4. Trang hệ thống `/[tenantSlug]/posts` và `/[tenantSlug]/posts/[postId]` (ADR-025)

- Header/footer hệ thống + font hệ thống; nền `brandColors.background` (`#FFF7E9`, tông kem) ✅; link "Bỏ qua tới nội dung
  chính"; breadcrumb "← <tên tenant>".
- Danh sách: `container-page`, lưới **1 / 2 / 3 cột** (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`), thẻ `PostSummaryCard`
  (`[tenantSlug]/_ui/post-parts.tsx`): cả thẻ bấm được (stretched link trong heading), ảnh đầu bài (640px) hoặc khối minh hoạ
  nhạt, nhãn `PinnedLabel` ("Đã ghim" + `IconPin`), dòng tài liệu gắn kèm là link riêng lớp trên (`z-10`).
- **`postCardText`**: có tiêu đề → tiêu đề là heading + trích đoạn bên dưới; không tiêu đề → trích đoạn **là** heading, không
  lặp.
- Chi tiết: `container-prose`, `<article>` nền trắng bo góc, nội dung `bodyHtml`; dưới bài là thẻ **"Tài liệu liên quan"**
  (ảnh bìa, tên, giá hiệu lực — giá gốc gạch ngang khi đang giảm) khi sản phẩm gắn còn `PUBLISHED`.

> **Quy tắc chung (render HTML đã lưu):** mọi chỗ dùng `dangerouslySetInnerHTML` với HTML lấy từ DB phải nhận HTML **đã
> sanitize lại lúc render** ở server (`sanitizeRichTextHtml` theo cloud hệ thống) — hiện 3 chỗ: xem bài HIDDEN trong Studio
> (`bodyHtml`), chi tiết bài công khai (`bodyHtml`), mô tả sản phẩm `product-detail.tsx` ✅. Nạp HTML vào Tiptap (`content`)
> không cần vì Tiptap parse theo schema. Chi tiết: [[02-System-Specs/Posts-Specs|Posts-Specs]] §4.1.

### 11.5. Section `posts` trên storefront (`[tenantSlug]/_ui/storefront-posts.tsx` — `PostsSection`)

- Anchor `#bai-viet`; nền `var(--sf-hero-bg)` (theme tenant); `SectionHeading` với `data.title`.
- Lưới theo số bài: 1 bài → căn giữa `max-w-xl`; 2 bài → `sm:grid-cols-2` trong `max-w-4xl`; ≥ 3 → `sm:grid-cols-2
  lg:grid-cols-3`. Thẻ dùng `postCardText`. Nút pill **"Xem tất cả bài viết"** → `/[slug]/posts`.
- **Không có bài → không render section.** Editor storefront (case `posts` trong `storefront-editor.tsx`): ô "Tiêu đề", "Số
  bài hiển thị (3–9)" (gợi ý chọn 3/6/9 cho lưới đều), checkbox "Đưa bài đang ghim lên đầu (nếu có)", kèm link sang Studio →
  Bài viết.

---

## 12. Trang Chủ Dữ Liệu Thật, System Center "Cấu Hình Chung" và Thương Hiệu (ADR-032/033) ✅

Quyết định: [[01-Architecture-Decisions/ADR-018-System-Settings-And-Brand-From-System-Center|ADR-018 (≙ ADR-032)]],
[[01-Architecture-Decisions/ADR-019-Home-Page-Real-Data-Sold-Count|ADR-019 (≙ ADR-033)]]. Quyết định thiết kế theo brief của Quốc
(Phong làm), Long đối chiếu code 2026-10-15.

### 12.1. Thẻ trang chủ — link phủ cả thẻ (`app/_home-sections.tsx`)

> **Cập nhật ADR-035 GĐ2 (2026-10-15) ✅:** thẻ đã tách thành component dùng chung `DocumentCard` / `TenantCard` (`app/_ui/`), hằng
> `CARD_CLASS`, `STRETCHED_LINK`, `FOCUS_RING` chuyển sang `app/_ui/catalog-parts.tsx` — trang chủ và Cửa hàng cùng dùng (§14.2).
> Quy tắc dưới đây vẫn đúng.

* `CARD_CLASS`: `group relative flex h-full flex-col … rounded-3xl border bg-white`, hover đổ bóng + nhấc `-translate-y-0.5` **chỉ
  khi** `motion-safe`; vòng focus vẽ trên **cả thẻ** bằng `has-[a:focus-visible]:outline-3 outline-offset-2` (màu qua
  `outlineColor`).
* `STRETCHED_LINK = "outline-none after:absolute after:inset-0 after:content-['']"` gắn vào **link duy nhất** trên tiêu đề thẻ
  (`<h3><Link>`) → bấm đâu trên thẻ cũng đi; tên truy cập = tên giáo viên/tài liệu, không lặp "Xem chi tiết". Nhãn "Xem gian
  hàng" cuối thẻ chỉ là `span aria-hidden`.
* Áp cho thẻ "Giáo viên & Coach nổi bật" (link `/{tenantSlug}`) và "Tài liệu nổi bật" (link `productPath`). Avatar/ảnh trang trí
  `alt=""`/`aria-hidden`. Không đặt thêm link/nút khác bên trong thẻ (sẽ bị lớp `after:` phủ).
* "Đã bán N" và sao chỉ hiện khi > 0 / có đánh giá; cả khối ẩn khi không có gì.

### 12.2. Định dạng số

* Số đếm thường: `Intl.NumberFormat("vi-VN")` ("1.234").
* **Số liệu nổi bật** (`formatStat`): < 1.000 hiện đúng số; từ 1.000 làm tròn **xuống** hàng trăm kèm "+" — hiển thị "1.200+",
  bản cho trình đọc màn hình "Hơn 1.200" (không bao giờ phóng đại); số tròn trăm hiện nguyên.
* Điểm đánh giá 1 chữ số thập phân kiểu vi-VN ("4,6"), giá `"… ₫"`.

### 12.3. Section "Tìm tài liệu" — chip link + `<details>`

* **Từ ADR-035 GĐ2 (2026-10-15) ✅:** ô tìm là **form GET** `action="/cua-hang/tai-lieu"` với `name="q"` (cắt theo
  `SHOP_SEARCH_Q_MAX` = 100); chip danh mục là **link** `shopSearchHref({ categorySlug })` → `/cua-hang/tai-lieu?danh-muc={slug}` (tên
  + "· N" kèm `sr-only` "tài liệu"). Giao diện giữ như cũ, chỉ đổi đích. (Trước GĐ2: chip `<li>` tĩnh, nút "Tìm kiếm" chưa có hành vi.)
* Danh sách có nhãn "Danh mục đang có tài liệu" (`aria-labelledby`).
* Hiện sẵn 10 chip (`SEARCH_CHIPS_VISIBLE`); phần còn lại trong `<details>`/`<summary>` ("Xem thêm N danh mục" / "Thu gọn",
  `min-h-11`, focus-visible outline, mũi tên xoay tắt khi `motion-reduce`) — không cắt mất, không cuộn ngang.

### 12.4. Mẫu `PinPicker` (`app/admin/cms/home-editor/pin-picker.tsx`, client)

Ô chọn ghim cho section "Giáo viên & Coach nổi bật" / "Tài liệu nổi bật" trong editor CMS trang chủ:

* Props: `id`, `label`, `searchLabel`, `searchPlaceholder?`, `value: string[]` (thứ tự = thứ tự hiển thị), `max`, `limit`,
  `initialOptions: PinOption[]` (`{ id, label, hint?, eligible }`), `search(query, includeIds)` (gọi Server Action
  `searchHomeTenantOptionsAction`/`searchHomeProductOptionsAction`), `onChange`.
* Danh sách đã ghim: nút **Lên/Xuống** thay kéo-thả (WCAG 2.5.7) + "Bỏ ghim"; nút icon 44px dưới `lg`, 36px từ `lg`; dùng
  `aria-disabled` thay `disabled` để focus không mất khi chạm đầu/cuối.
* Mục `eligible:false` hoặc id không còn trong dữ liệu → nhãn **chữ** "Không còn hiển thị" (không chỉ dùng màu); mục vượt `limit`
  → nhãn "Ngoài số thẻ hiển thị".
* Ô tìm: debounce 300ms, Enter tìm ngay, bỏ kết quả cũ nếu có yêu cầu mới hơn. Thông báo thao tác (đã ghim/bỏ/chuyển vị trí, số
  kết quả) qua **một** vùng `role="status"` ẩn — không dời focus.

### 12.5. Mẫu form cấu hình chung (`/admin/settings/general`)

* `AdminPageHeader` + dòng "Cập nhật lần cuối … bởi …" (`<time>`, giờ theo `DISPLAY_TIME_ZONE`) hoặc "Chưa lưu lần nào — hệ thống
  đang dùng giá trị mặc định."; cảnh báo vàng `role="status"` khi DB đang lưu giá trị không hợp lệ.
* **Từ task 1.9 (ADR-058) ✅ đọc code:** 3 nhóm là `CollapsibleSection` (id `nhom-{nhóm}`, xếp dọc, lưới ô `sm:grid-cols-2 xl:grid-cols-3`) — **Bảo mật & phiên**
  (mở) · **Chính sách phiên đăng nhập** · **Nghiệp vụ** (thu gọn); badge `sectionStatus({ errorCount, dirty })` theo nhóm, nhóm có lỗi tự mở, link trong tóm
  tắt lỗi mở nhóm trước khi nhảy tới ô; khoá không thuộc nhóm nào rơi vào nhóm cuối. Ô có kiểm soát nên lưu lỗi không mất giá trị; "có thay đổi" = so với giá trị
  đã nạp (cập nhật khi lưu thành công) → `useUnsavedChanges`. Mô tả `ConfigCard` dưới là bố cục trước 1.9.
* Nhóm ô theo `ConfigCard` (lưới `xl:grid-cols-2`, trong card `sm:grid-cols-2`); mỗi ô là `TextField type="number"
  inputMode="numeric"` có `min/max/step=1`, nhãn "Tên (đơn vị)", gợi ý giới hạn; `noValidate` — validate ở server.
* **Tóm tắt lỗi** đầu form: `role="alert"`, `tabIndex=-1`, nhận focus sau khi gửi lỗi, tiêu đề "Chưa lưu — N ô cần sửa", mỗi lỗi
  là link `#<khoá>` tới ô.
* Thanh hành động: ghi chú "Thay đổi chỉ áp cho thao tác mới…", nút phụ **"Điền giá trị mặc định"** (chỉ điền lại ô phía client,
  không lưu; tắt khi đang lưu hoặc đã là mặc định) + nút chính "Lưu cấu hình"/"Đang lưu...". Kết quả qua `FormBanner`.
* Khoá chưa dùng (`trialDays`) không có ô.

### 12.6. Menu System Center (`admin/_ui/sidebar-nav.tsx`)

Trước ADR-058, nhóm cài đặt hệ thống có 6 mục rời: "Cấu hình chung", "Email hỗ trợ", "Nhận diện thương hiệu", "Lưu trữ file", "Cloudinary Upload",
"Cấu hình Mail". Từ task 1.7 còn 4 mục (xem bảng "Nhóm Cấu hình hệ thống" dưới).

Từ ADR-042 (2026-10-17 ✅): `AdminSidebarNav` là lớp cấu hình trên `SidebarNav` dùng chung (§5.1) — icon theo key chuỗi, badge pill, Đăng xuất
ở đáy `AppSidebarPanel`, drawer dưới `lg`. Cấu trúc 1 mục đứng riêng + 6 nhóm giữ nguyên; sơ đồ đầy đủ:
[[02-System-Specs/User-Management-System-Center-Specs|User-Management-System-Center-Specs]] §2.

**Nhóm Nội dung — đã áp dụng task 1.1 (ADR-058 + "Bổ sung ADR-058" (a), Quốc duyệt 2026-10-25; code đã commit `c8e1b2f` ✅ đọc code, `git log`):**

| Thứ tự | Mục | href / `match` | Ghi chú |
| :-: | :-- | :-- | :-- |
| 1 | **Trang CMS** (`doc`) | `/admin/cms/home`, `match: ["/admin/cms/menu"]` | Mở trang có `ModuleTabs` **Trang chủ · Header & Footer** (§25.2); sáng ở cả 2 tab |
| 2 | **Trang tuỳ chỉnh** (`posts`) — mới | `/admin/cms` | Danh sách trang `/p/[slug]`; h1 trang đổi thành "Trang tuỳ chỉnh". href tự khớp tiền tố `/admin/cms/new`, `/admin/cms/{slug}` |
| 3 | Trang Cửa hàng (`shoppingBag`) | `/admin/cms/shop` | Giữ riêng |
| 4 | Trang Bảng giá (`package`) | `/admin/cms/pricing` | Giữ riêng |
| 5 | Chính sách sử dụng (`doc`) | `/admin/cms/phap-ly` | Trước là "Văn bản pháp lý" (ADR-057 mục 4) |
| 6 | Danh mục tài liệu (`tag`) | `/admin/categories` | Giữ riêng |

* **Đã bỏ** mục "Menu & chân trang" — `/admin/cms/menu` nay là tab "Header & Footer" của Trang CMS (URL giữ nguyên).
* Luật khớp dài nhất (§25.5): `/admin/cms/home`, `/admin/cms/menu` → "Trang CMS"; `/admin/cms/shop`, `/pricing`, `/phap-ly` → mục riêng; `/admin/cms`, `/new`,
  `/{slug}` khác → "Trang tuỳ chỉnh".
* Nhóm tab một nguồn: `admin/cms/_ui/cms-tabs.ts` (`CMS_TABS`, `CMS_HOME_TAB`, `CMS_MENU_TAB`, `CMS_TABS_LABEL` = "Các trang trong Trang CMS") dùng chung cho
  `cms/[slug]/page.tsx` (slug `home`), `cms/menu/page.tsx` và `cms/menu/loading.tsx` — thanh tab không lệch khi đang tải. Cả 2 tab có h1 **"Trang CMS"**, subtitle bắt
  đầu bằng tên tab ("Trang chủ — …", "Header & Footer — …"). Trang bọc `<div>` thay `<main>` (sửa `<main>` lồng nhau).
* Danh sách "Trang tuỳ chỉnh" **ẩn slug hệ thống** (`SYSTEM_CMS_SLUGS` = home/shop/pricing/menu): `admin/cms/page.tsx` dùng chung `where: { slug: { notIn:
  SYSTEM_CMS_SLUGS } }` cho cả `findMany` lẫn `count` → tổng số + phân trang khớp danh sách ✅ đọc code (Hiếu báo xong 2026-10-25). Không lọc ở JSX.

**Nhóm Cấu hình hệ thống — đã áp dụng task 1.7 (ADR-058 mục 3; code đã commit `c8e1b2f` ✅ đọc `sidebar-nav.tsx`, `settings/_ui/settings-tabs.ts`):**

| Thứ tự | Mục | href / `match` | Ghi chú |
| :-: | :-- | :-- | :-- |
| 1 | **Cấu hình chung** (`gear`) | `/admin/settings/general`, `match: ["=/admin/settings", "/admin/settings/smtp"]` | Mở trang có `ModuleTabs` **Cấu hình chung · Email hỗ trợ · Cấu hình Email (SMTP)**; sáng ở cả 3 tab. `=` vì `/admin/settings` là tiền tố mọi trang cấu hình |
| 2 | Nhận diện thương hiệu (`layers`) | `/admin/settings/branding` | Giữ riêng; tab nội bộ `InPageTabs` (§25.6) |
| 3 | Lưu trữ file (`database`) | `/admin/settings/storage` | Giữ riêng; **không** gom với Cloudinary |
| 4 | Cloudinary Upload (`database`) | `/admin/settings/cloudinary` | Giữ riêng |

* Nhóm tab một nguồn: `admin/settings/_ui/settings-tabs.ts` (`SETTINGS_TABS`, `SETTINGS_GENERAL_TAB`, `SETTINGS_SUPPORT_EMAIL_TAB`, `SETTINGS_SMTP_TAB`,
  `SETTINGS_TABS_LABEL` = "Các trang trong Cấu hình chung") dùng chung cho `settings/general/page.tsx`, `settings/page.tsx`, `settings/smtp/page.tsx`. Cả 3 tab có h1
  **"Cấu hình chung"**, subtitle bắt đầu bằng tên tab ("Email hỗ trợ — …", "Cấu hình Email (SMTP) — …"). Đã bỏ mục "Email hỗ trợ" và "Cấu hình Mail" khỏi sidebar.
* **`metadata.title` riêng theo tab** (task 1.14) ✅ grep: "Cấu hình chung", "Email hỗ trợ — Cấu hình chung", "Cấu hình Email (SMTP) — Cấu hình chung"; Trang CMS:
  "Trang chủ — Trang CMS" (`generateMetadata` của `cms/[slug]`, slug khác → "Sửa trang tuỳ chỉnh"), "Header & Footer — Trang CMS". Đóng KB-Audit §39 mục 1.

**Số mục:** sidebar System Center hiện **21 mục** ✅ đếm `ADMIN_STANDALONE` (1) + `ADMIN_GROUPS` (Người dùng 2 · Kinh doanh 3 · Nội dung 6 · Tài chính 3 · Cấu hình
hệ thống 4 · Giám sát 2) — khớp kế hoạch §2.1 bản sửa "23 → 21". Không đổi nhóm, URL mọi trang giữ nguyên.

### 12.7. Thương hiệu và múi giờ trên giao diện

* Trang `/login`, `/register` (server) đọc `getEffectiveBrand()` rồi truyền **`brandName`** xuống form client (`LoginForm`,
  `RegisterForm`); form onboarding Studio (`studio/onboarding-form.tsx`) cũng nhận `brandName` qua prop. Client component **không**
  tự đọc thương hiệu (không có DB) và không import hằng `DEFAULT_BRAND` để hiển thị.
* Định dạng ngày giờ dùng hằng chung `DISPLAY_TIME_ZONE` (`@gieochu/core/system-settings`) — `apps/web` không còn chỗ hard-code
  chuỗi múi giờ ✅ (2026-10-15, sau khi Quốc sửa `lib/subscription-sweep.ts`).

### 12.8. Việc còn mở (BACKLOG, liên quan UI)

* ~~`SettingsGrid` `minmax(380px, …)` gây cuộn ngang ở 375px~~ — ✅ hết: `SettingsGrid` nay 1 cột full width (2026-10-25, §5).
* Editor CMS trang chủ: "Xem trang chủ ↗" là `<Link>` bọc `<button>` (phần tử tương tác lồng nhau).
* ~~Chip/ô tìm trang chủ chưa thành link~~ — ✅ xong ở ADR-035 GĐ2 (§12.3).

### 12.9. Trang chủ theo brief (ADR-050) — section mới, minh hoạ, tương phản ✅ đọc code 2026-10-23 (chưa commit)

> Nguồn: báo cáo UI của Phong qua brief Quốc; Long đối chiếu `app/_home-sections.tsx`, `app/page.tsx`. Dữ liệu/schema section:
> [[02-System-Specs/System-Cms-Menu-Home-Seo-Specs|System-Cms-Menu-Home-Seo-Specs]] §3.

* **Cách bắt đầu (`steps`):** `<ol>` thật (trình đọc màn hình đọc "danh sách N mục"); số bước hiển thị là trang trí (`aria-hidden`), tiêu đề mỗi
  bước là **H3** có tiền tố ẩn "Bước n:". Mobile: dòng thời gian dọc (vòng số + vạch nối); `sm+`: thẻ.
* **Cùng nhau phát triển (`community`)** — 3 chế độ theo `HomeCommunityView` đã resolve ở server: **lời nhận xét** (`<figure>`/`<blockquote>`,
  **không sao**, chỉ mục đã xác nhận đồng ý), **nhật ký phát triển** (dòng thời gian, ngày trong `<time>`), **lời mời** (chữ + CTA tuỳ chọn).
* **FAQ:** `<details>/<summary>` gốc (Enter/Space mở, không cần JS); câu hỏi là H3 trong `<summary>`.
* **Minh hoạ** Hero (khi chưa có ảnh) và "Kêu gọi mở gian hàng": dựng bằng CSS, `aria-hidden`, **không số liệu, không giá, không sao, không chữ**
  (đã gỡ "500+", "10.000+", "149.000đ", 5 sao cố định). Số liệu **thật** trên Hero: thẻ số liệu §12.10.
* **H1 dự phòng:** khi section hero bị ẩn, trang vẫn có `<h1 className="sr-only">` (ẩn thị giác) — trang luôn có đúng một H1.
* **Tương phản đã sửa:** chữ eyebrow dùng `color-mix(in srgb, <accent> 72%, black)` (hằng `AMBER_TEXT`); chữ trên nút CTA nền cam (`AMBER`) đổi sang
  `#241503`.
* Skip-link + `<main id="noi-dung">`: §1.1.

### 12.10. Hero — thẻ số liệu nổi bật ("Bổ sung ADR-050 lần 3") ✅ đọc code 2026-10-23 (chưa commit)

> Nguồn: "Bổ sung ADR-050 lần 3" (`docs/DECISIONS.md`) + brief Quốc; Long đối chiếu `app/_ui/hero-stat-badges.tsx`, `app/_home-sections.tsx`
> (`HeroSection`). Dữ liệu/lọc/định dạng số: [[02-System-Specs/System-Cms-Menu-Home-Seo-Specs|System-Cms-Menu-Home-Seo-Specs]] §3.6.

* **Component:** `HeroStatBadges({ items, groupLabel = "Số liệu nổi bật" })` — `apps/web/app/_ui/hero-stat-badges.tsx` (server-safe). Nhận
  `HeroStatBadgeItem[]` **đã lọc ở server**; rỗng → `null`; cắt tối đa 3. Đặt **bên trong** khung media `relative` của `HeroSection`, ngay sau ảnh/minh hoạ.
* **Map số liệu → icon / màu** (`METRIC_VISUAL`, màu là token runtime `var(--brand-*)` từ `catalog-parts`):

  | `metric` | Icon | Màu |
  | :-- | :-- | :-- |
  | `tenants` | `IconStorefront` | `BLUE` |
  | `products` | `IconDocs` | `AMBER` |
  | `sold` | `IconBag` (khai báo riêng trong file, nét 1.7) | `GREEN` |
  | `reviews` | `IconStar` | `AMBER` |

  Ô icon nền `color-mix(in srgb, <màu> 14%, white)`; số `font-heading` `text-xl`/`sm:text-2xl` đậm `tabular-nums` màu `INK`; nhãn `text-xs`/`sm:text-[13px]`
  màu `INK_SOFT`, `overflow-wrap:anywhere`. Thẻ nền trắng `rounded-2xl`, bóng `0 18px 40px rgba(6,12,35,0.28)`.
* **Một DOM cho hai bố cục:** một `<ul role="list" aria-label>`:
  * **Dưới `lg`:** lưới ngay dưới ảnh (`mt-5`), số cột = số thẻ (1–3), không phủ ảnh; `sm+` icon nằm ngang cạnh chữ.
  * **`lg+`:** `ul` thành `block` (cao 0, không nhảy layout), mỗi `<li>` `absolute z-10`, rộng 170–220px, phủ mép khung theo số thẻ — thứ tự trên → dưới
    khớp thứ tự DOM (= thứ tự CMS):

    | Số thẻ | Vị trí |
    | :-- | :-- |
    | 1 | dưới-trái |
    | 2 | trên-phải, dưới-trái |
    | 3 | trên-phải, giữa-phải, dưới-trái |

* **Độ tràn ra ngoài khung media:** phía phải `-right-4`/`xl:-right-6` (trên) và `-right-6`/`xl:-right-8` (giữa) → **≤ 24px ở `lg`, ≤ 32px ở `xl`**, nằm
  trong lề `container-page` 32px; phía trái `-left-8`/`xl:-left-12` (32/48px) tràn vào khoảng cách giữa cột chữ và cột ảnh. Section hero có
  `overflow-x-clip` làm dự phòng chống cuộn ngang ✅ code. Độ tràn trái 48px ở `xl` (vượt mốc "≤ 24/32px" của brief) được Quốc **chấp nhận như code
  hiện tại** (2026-10-23, KB-Audit §32 mục 3).
* **Khung media:** có ảnh → rộng `max-w-[320px]`/`sm:max-w-[360px]`/`lg:w-[380px]`/`xl:w-[420px]`, khung `aspect-[4/5]` `rounded-[24px]`
  `overflow-hidden`, `<img src={cloudinaryDeliveryUrl(data.imageUrl, { width: 1200 })} fetchPriority="high" object-cover>` (khớp §9.8 từ
  2026-10-23 ✅ code); không ảnh → minh hoạ CSS cao cố định 220/340/420px như trước.
* **Chữ số hiển thị:** `display` = `formatCompactStatCount(value)` — làm tròn xuống, dấu **"+" chỉ khi số đã bị làm tròn** (125 → "120+", 1.250 →
  "1,2K+"); số đúng tròn theo bậc không có "+" (100 → "100", 1.000 → "1K", 1.200 → "1,2K", 1.000.000 → "1M") ✅ code + unit test.
* **A11y:** phần nhìn thấy (icon, số, nhãn) `aria-hidden`; mỗi thẻ có câu `sr-only` "`<số đọc>` `<nhãn>`" — số đọc (`spokenCount`) dựng từ `value` thật
  bằng `floorStatValue` + `isStatRounded` (`@gieochu/core/home-sections`), **cùng bậc** với chữ hiển thị: "1,2K+" → "Hơn 1.200 Lượt mua"; "1,2K" →
  "1.200 Lượt mua"; "87" → "87 Lượt mua". Chữ "Hơn" xuất hiện **đúng khi** phần hiển thị có "+" — hai kênh luôn nói cùng một ý ✅ code. Không có
  chuyển động → không cần nhánh `prefers-reduced-motion`.
* **Minh hoạ CSS khi có thẻ thật:** `HeroIllustration hideFloatingCardOnDesktop` — thẻ trang trí "đã sẵn sàng" (dấu tích) bị `lg:hidden` khi có ≥ 1 thẻ
  số liệu, tránh chồng/rối; dưới `lg` vẫn hiện (thẻ số liệu nằm dưới minh hoạ).

---

## 13. Editor CMS Cửa Hàng (ADR-035 GĐ1) ✅

Quyết định: [[01-Architecture-Decisions/ADR-021-Shop-Marketplace-Cms-First|ADR-021 (≙ ADR-035)]]; nghiệp vụ:
[[02-System-Specs/Shop-Marketplace-Specs|Shop-Marketplace-Specs]]. Thiết kế theo brief của Quốc (Phong làm), Long đối chiếu code
2026-10-15 (working tree, chưa commit). Thử tay a11y/responsive trên trình duyệt ❓ (chưa có báo cáo kiểm tay).

### 13.1. Kit: `Notice` (`admin/_ui/kit.tsx`) — khác `FormBanner`

* `Notice({ tone?: "info" | "warning", icon?, children })`: khung ghi chú/cảnh báo **tĩnh** trong trang (bo `rounded-xl`, viền +
  nền theo tone: info = `brandColors.surface`/chữ `primary`, warning = nền hổ phách/chữ `#92400E`). Không có `role` — không phải
  thông báo động.
* `FormBanner` vẫn là nơi hiện **kết quả thao tác** (thành công/lỗi sau khi gửi). Không dùng `Notice` cho kết quả thao tác.
* Nội dung `Notice` phải tự nói rõ ý (không chỉ dựa vào màu); `icon` chỉ trang trí.

### 13.2. `PinPicker` thêm `copy` và `error` (`app/admin/cms/home-editor/pin-picker.tsx`)

Bổ sung cho §12.4 (props cũ giữ nguyên, trang chủ không đổi hành vi):
* `copy?: Partial<PinPickerCopy>` — bộ chữ giao diện: `note`, `emptyPinned`, `searchHint`, `pinAction`, `unpinAction`,
  `pinnedState`, `unavailable`, `overLimit(limit)`, `full(max)`, `noMatch(query)`, `noOptions`, `PinIcon`. Thiếu key nào dùng
  mặc định "ghim" của trang chủ. Thông báo `role="status"` và `aria-label` nút cũng đổi theo bộ chữ.
* `error?: string` — lỗi của cả danh sách: viền khung đỏ, `<p role="alert">` dưới tiêu đề, gắn vào `aria-describedby` của khung.
* Editor Cửa hàng dùng 3 bộ chữ: tài liệu ghim (ghi chú "ghim riêng cho trang Cửa hàng"), gian hàng ghim, và **bộ chọn danh mục**
  (`categoryCopy(unit)` — động từ "Chọn / Bỏ chọn / Đã chọn", icon `IconPlus`). Option danh mục map bằng `toCategoryPinOption`
  (gợi ý "N tài liệu công khai", `eligible:false` → nhãn chữ "Danh mục đang tắt hoặc chưa có tài liệu công khai").

### 13.3. Pattern editor CMS nhiều section (`app/admin/cms/shop/_ui/shop-sections-editor.tsx`, client)

* **Bố cục:** wrapper trang là `<div>` (layout admin đã có `<main>`); lưới `xl:grid-cols-[320px_minmax(0,1fr)]` — trái danh sách
  khu vực, phải form của khu vực đang chọn; dưới `xl` xếp dọc.
* **Thông báo trạng thái đầu trang** (`Notice tone="warning"`): `NONE` "Chưa lưu lần nào — đang hiển thị cấu hình mặc định";
  `DRAFT` "Chưa xuất bản lần nào…".
* **Thanh trạng thái dính** (`sticky top-0 z-10`, nền trắng mờ `backdrop-blur`, tràn mép bằng `-mx-5 lg:-mx-8`): huy hiệu
  "Đã xuất bản" / "Chưa xuất bản" / "Chưa lưu · cấu hình mặc định", "Có nháp chưa xuất bản", "Có thay đổi chưa lưu", "Lưu lần
  cuối: …" (giờ định dạng ở server theo `DISPLAY_TIME_ZONE` để tránh lệch hydrate), vùng `aria-live="polite"`; nút "Xem trang"
  (tab mới, có `sr-only` giải thích), "Khôi phục bản đang hiển thị", "Lưu nháp", "Xuất bản" (chính). Nút `min-h-11` dưới `lg`.
  Kết quả thao tác hiện ngay trong thanh: `role="status"` khi thành công, `role="alert"` khi lỗi.
* **Danh sách khu vực** (`<ol>`): mỗi dòng = nút con mắt ẩn/hiện (`aria-pressed`, `aria-label` "Ẩn/Hiện khu vực …", icon
  `IconEye`/`IconEyeOff`) + nút tên (số thứ tự, `aria-current` khi đang chọn, nhãn chữ "Đang ẩn", "N lỗi") + nút **Lên/Xuống**
  thay kéo-thả (WCAG 2.5.7; `disabled` ở đầu/cuối). Nút icon 44px dưới `lg`, 36px từ `lg`. Bộ đếm "x/9 đang hiện".
* **Kiểm tra trước khi gửi:** chạy đúng `shopSectionsSchema` ở client (`shop-validation.ts`), chỉ bật hiện lỗi sau lần bấm
  Lưu/Xuất bản đầu tiên; lỗi → **khung tóm tắt** (`role="alert"`, `tabIndex=-1`, nhận focus, tiêu đề "Chưa lưu được — còn N lỗi
  cần sửa"), mỗi lỗi là nút: chọn đúng khu vực rồi **focus nhảy tới ô** (ô danh sách → ô tìm `-search` của `PinPicker`; không
  thấy ô → tiêu đề form `tabIndex=-1`). Không gọi server khi còn lỗi; server vẫn validate lại.
* **Xác nhận khôi phục:** `window.confirm` nêu rõ đích ("bản đang hiển thị" hoặc "cấu hình mặc định") và "không hoàn tác được";
  khôi phục xong dựng lại form (`formVersion`) để ô gõ tay bỏ chuỗi dở.
* **Cảnh báo rời trang:** chỉ bật khi có thay đổi chưa lưu (so snapshot JSON) — từ task 1.5 (ADR-058) qua `useUnsavedChanges` của provider layout (§25.4),
  không còn `beforeunload` riêng ✅ grep.
* **Ghi chú dữ liệu thật** đầu form từng khu vực (`LiveDataNote` = `Notice tone="info"`): CMS chỉ lưu nhãn/cấu hình, thẻ lấy từ
  dữ liệu thật. "Mọi ô chữ đều bắt buộc."
* **Khung chờ** `app/admin/cms/shop/loading.tsx`: cùng khung với trang (tránh nhảy layout), `aria-busy`, `role="status"` ẩn,
  `animate-pulse motion-reduce:animate-none`.

### 13.4. Field riêng (`app/admin/cms/shop/_ui/shop-fields.tsx`)

| Field | Dùng cho | Ghi chú |
|---|---|---|
| `ShopTextField` | Ô chữ 1 dòng bắt buộc | Bọc `TextField` của kit, `maxLength`, gợi ý kèm bộ đếm "n/max ký tự" |
| `ShopTextAreaField` | Mô tả (CTA) | Textarea bắt buộc có đếm ký tự |
| `RangeSelectField` | Số trong khoảng nhỏ (số thẻ, số khối, chip) | `SelectField` liệt kê từng số + đơn vị — không có trạng thái gõ sai |
| `IntegerField` | Số nguyên khoảng rộng (số đánh giá tối thiểu 1–50) | Ô chữ `inputMode="numeric"`, giữ chuỗi đang gõ; sai → đẩy `NaN` để bước kiểm tra chặn (không âm thầm giữ giá trị cũ) |
| `AvgTenthsField` | Ngưỡng điểm TB | Nhập "4,0" (nhận "4.0", "4"), `inputMode="decimal"`, placeholder "4,0"; lưu số nguyên ×10 qua `parseShopAvgTenthsInput`; rời ô thì chuẩn hoá cách viết ("4.5" → "4,5"); sai/ngoài 1,0–5,0 → `NaN`. Không float |
| `RadioCardGroup` | Chế độ danh mục AUTO/MANUAL, chế độ gian hàng SALES_30D/TOP_RATED | `fieldset`/`legend`, cả thẻ là vùng bấm `min-h-11`, mô tả gắn `aria-describedby`, focus ring qua `has-[:focus-visible]` |

Lỗi luôn hiện dưới ô (`role="alert"`) + `aria-invalid`/`aria-describedby`. Ảnh hero dùng `ImageUploadField` (§9.9). Mô tả chế độ
`SALES_30D` ghi rõ "số bán chỉ dùng để xếp hạng, không hiển thị".

### 13.5. Menu và hằng tạm

* Sidebar System Center (`admin/_ui/sidebar-nav.tsx`), nhóm nội dung: "Trang CMS" → **"Trang Cửa hàng"** (`/admin/cms/shop`, icon
  mới `IconShoppingBag` trong `admin/_ui/icons.tsx`) → "Danh mục tài liệu".
* Hằng `PUBLIC_PAGE_READY = false` trong editor: hiện ghi chú "Trang công khai /cua-hang có ở giai đoạn 2 — hiện “Xem trang” chưa
  mở được nội dung" (gắn `aria-describedby` vào nút "Xem trang"). **Đổi thành `true` (hoặc bỏ ghi chú) khi GĐ2 lên.** ⚠️ Tại
  2026-10-15 GĐ2 đã xong code (route `/cua-hang` có thật) nhưng hằng **vẫn `false`** ✅ — ghi chú sai sự thật; BACKLOG.

### 13.6. Việc còn mở (BACKLOG, liên quan UI)

* `<main>` lồng: 20 file trong `app/admin/**` (các `page.tsx` + `error.tsx`) vẫn bọc `<main>` riêng trong khi `admin/layout.tsx` đã có
  `<main>` ✅ (grep 2026-10-15); editor Cửa hàng đã dùng `<div>`.
* Editor CMS trang chủ chưa đạt target 44px và focus ring như editor Cửa hàng.

### 13.7. Editor menu và editor văn bản pháp lý (ADR-050)

* `/admin/cms/menu` (`menu-editor.tsx`) và `/admin/cms/phap-ly` (`legal-editor.tsx`) dùng **pattern §13.3** (thanh trạng thái, Lưu nháp / Xuất bản /
  Khôi phục, tóm tắt lỗi, `loading.tsx` cùng khung) 🟡 theo báo cáo Phong; cả hai có `loading.tsx` ✅ `ls`.
* **Đường dẫn lỗi → id ô:** lỗi từ schema/server (`issues[].path` chấm, vd `header.items.0.target`) được ánh xạ sang `id` của ô nhập để nút trong khung
  tóm tắt nhảy focus đúng chỗ ✅ `menu-editor.tsx` (editor pháp lý 🟡 — chưa thấy hàm ánh xạ khi grep, theo báo cáo Phong).
* Editor pháp lý: ô tích "Đã rà soát pháp lý phiên bản này" bị `disabled` khi còn thay đổi chưa lưu (nhãn thêm "(lưu nháp trước)"); ô
  `datetime-local` "Ngày giờ hiệu lực (giờ Việt Nam)"; Xuất bản và Lưu trữ hỏi `window.confirm` (lưu trữ bản đang hiệu lực có cảnh báo 404) ✅.
  Quy trình: [[04-Operations-Runbooks/Legal-Terms-Publishing-Runbook|Legal-Terms-Publishing-Runbook]].
* ⚠️ **Đã đổi theo "Bổ sung ADR-057" (2026-10-25, chưa commit):** editor pháp lý (nay tên "Chính sách sử dụng") chỉ còn **một nội dung** mỗi văn bản —
  không còn danh sách phiên bản, không còn nút Lưu trữ; sidebar bên phải (trạng thái, "Cập nhật lúc …", ô "Đã rà soát nội dung", "Công bố dạng bản dự
  thảo" — đã bật từ khi migration ADR-057 chạy, ngày hiệu lực, Lưu nháp / Xem trước / Xuất bản), khối "Tối ưu SEO" thu gọn dưới nội dung; đăng ký cờ chưa lưu qua `useUnsavedChanges`
  (§25.4) ✅ đọc code. Bố cục chi tiết chưa ghi lại ở trang này 🟡 (chờ Phong bàn giao phiên `/phap-ly`). Quyết định:
  [[01-Architecture-Decisions/ADR-042-Legal-Drafts-Import-Preview-Draft-Release|ADR-042 KB (≙ ADR-057)]].

---

## 14. Trang Cửa Hàng Công Khai + Component Catalog Dùng Chung (ADR-035 GĐ2) ✅

Quyết định: [[01-Architecture-Decisions/ADR-021-Shop-Marketplace-Cms-First|ADR-021 (≙ ADR-035)]]; nghiệp vụ + dữ liệu:
[[02-System-Specs/Shop-Marketplace-Specs|Shop-Marketplace-Specs]] §5–§6. Thiết kế theo brief của Quốc (Phong làm), Long đọc file
component lấy API props ngày 2026-10-15 (working tree, chưa commit). Kiểm responsive 360/768/1280 + a11y trên trình duyệt: theo báo
cáo "dev server đạt" 🟡; chi tiết từng điểm chưa có báo cáo riêng ❓.

### 14.1. `catalog-parts.tsx` — mảnh trình bày dùng chung (server-safe, client import được)

* Màu lấy từ token `brandColors`: `INK`, `INK_SOFT`, `LINE`, `PAPER_ALT` (`backgroundAlt`), `BLUE`, `BLUE_DEEP`, `AMBER`, `AMBER_SOFT`,
  `GREEN`; `ROTATING_COLORS` + `rotatingColor(i)` (xoay màu nhấn theo vị trí thẻ), `pastelOf(color, percent=10)` (nền pastel).
* ⚠️ **Hex hard-code** chưa có token: `SALE_RED = "#B91C1C"` (nhãn giảm giá/giá sale); chữ `#241503` trên nút accent (trang chủ, `shop-cta`,
  `site-header`) — BACKLOG thêm token sale/danger vào `theme.ts`.
* Icon SVG: `IconArrow`, `IconSearch`, `IconChevron`, `IconDocs`, `IconStar`, `IconFolder`, `IconStorefront` (props `className`, `style`).
* Định dạng: `formatCount` (vi-VN), `formatVnd`, `formatRating` ("4,6"), `initialsOf`, `discountPercentOf(product)`; `RatingInline({ average,
  count, long? })`.
* Lớp thẻ: `CARD_CLASS`, `STRETCHED_LINK`, `FOCUS_RING`; kiểu `CardHeadingLevel = "h2" | "h3" | "h4"`.

### 14.2. Thẻ — `DocumentCard`, `TenantCard`

| Component | Props | Ghi chú |
|---|---|---|
| `DocumentCard` (`_ui/document-card.tsx`) | `product: DocumentCardProduct` (= `HomeFeaturedProduct` + `typeLabel?`), `toneIndex?` (0), `headingLevel?: "h3" \| "h4"` (h3), `rank?: number`, `density?: "default" \| "compact"` | Ảnh bìa `cloudinaryDeliveryUrl(…, { width: 640 })` hoặc khối màu; nhãn "Giảm N%" khi khuyến mãi; nhãn loại (`typeLabel`, chỉ khi có — trang chủ không truyền); tên `line-clamp-2`; tên gian hàng; sao + số đánh giá; "Đã bán N" (ẩn khi 0); giá + giá gốc gạch (có `sr-only` "Giá khuyến mãi"). `rank` → "#N" `aria-hidden` + `sr-only` "Hạng N". Một link duy nhất (stretched) tới `href` |
| `TenantCard` (`_ui/tenant-card.tsx`) | `tenant: TenantCardTenant` (= `HomeFeaturedTenant`), `toneIndex?`, `headingLevel?: "h3" \| "h4"` | Avatar/logo (`alt=""`), tên, "N tài liệu", sao (khi có), "Đã bán" tổng (khi > 0), nhãn "Xem gian hàng" `aria-hidden`; link `/{tenantSlug}`. Trường thừa (`sales30d`) **bị bỏ qua** — số bán 30 ngày không hiển thị |

Trang chủ (`_home-sections.tsx`) dùng `DocumentCard` (mặc định `default`) và `TenantCard`; Cửa hàng dùng `density="compact"`.

### 14.3. Khung kệ — `product-shelf.tsx`

| Export | Props | Ghi chú |
|---|---|---|
| `ShelfSection` | `title`, `subtitle?`, `note?`, `viewAll?: { href, label }`, `headingLevel?: "h2" \| "h3"` (h2), `background?: "paper" \| "alt"` (paper), `children` | Khung section dùng chung (tiêu đề + mô tả + dòng ghi chú + một link "Xem tất cả" ≥44px) |
| `ProductShelf` | `title`, `subtitle?`, `criteria?`, `products`, `href?`, `viewAllLabel?` (mặc định "Xem tất cả {title}"), `ranked?`, `headingLevel?`, `background?`, `desktopLimit?` (8), `mobileLimit?` (4) | Lưới 2 cột (< lg) / 4 cột (≥ lg), thẻ `compact`; thẻ vượt `mobileLimit` ẩn bằng `hidden lg:block` (không vào cây a11y ở mobile); `headingLevel="h3"` → thẻ h4; rỗng → `null` |
| `TenantShelf` | `title`, `subtitle?`, `tenants`, `href?`, `viewAllLabel?`, `background?` | Lưới 2/4 cột `TenantCard`; rỗng → `null` |
| `formatTopRatedCriteria(minReviews, minAvgTenths)` | — | "Từ 3 đánh giá, điểm trung bình từ 4,0" — in dưới tiêu đề kệ Đánh giá cao |

### 14.4. Danh mục, hero, CTA, skeleton

| Component | Props | Ghi chú |
|---|---|---|
| `CategoryGrid` (`_ui/category-grid.tsx`) | `title`, `subtitle?`, `categories: CategoryTileData[]`, `maxVisible`, `background?` | Lưới 2–3 cột mobile / 4 tablet / 6 desktop; phần vượt `maxVisible` trong `<details>` ("Xem thêm N danh mục" / "Thu gọn", `min-h-11`, danh sách phụ `aria-label="Danh mục khác"`); rỗng → `null` |
| `CategoryTile` | `category`, `toneIndex?` | Ô là link `shopCategoryHref(slug)` = `/cua-hang/tai-lieu?danh-muc={slug}`; nền pastel xoay vòng; icon = `imageUrl` hoặc icon mặc định |
| `ShopHero` (`_ui/shop-hero.tsx`) | `data` (eyebrow/title/subtitle/searchLabel/searchPlaceholder/imageUrl của CMS), `categories`, `chips`, `stats?: { productCount?, tenantCount? }` | Nền gradient `BLUE_DEEP`→`BLUE`; **H1** = `data.title`; `ShopSearchForm`; chip phổ biến (danh sách có nhãn); khối minh hoạ phải `hidden lg:block` (ảnh CMS `width: 1000` hoặc minh hoạ mặc định) + thẻ số liệu "Tài liệu đang bán"/"Gian hàng" chỉ hiện khi > 0 |
| `ShopSearchForm` | `label`, `placeholder`, `categories` (rỗng → không render select), `defaultQuery?`, `defaultCategorySlug?`, `action?` (`/cua-hang/tai-lieu`), `hiddenFields?`, `submitLabel?` ("Tìm kiếm") | Form GET thuần (không cần JS): `q` + `<select name="danh-muc">` (rỗng = mọi danh mục); nhãn hiển thị cho cả ô và select (không dùng placeholder thay nhãn); ô cao 48px, chữ 16px (iOS không tự zoom) |
| `ShopEmptyState` (`_ui/shop-cta.tsx`) | `title?` ("Cửa hàng chưa có tài liệu nào"), `description?`, `cta?: {label, href} \| null` (mặc định "Mở gian hàng miễn phí" → `/register`; `null` = ẩn), `secondary?`, `headingLevel?: "h1" \| "h2"` (h2) | Khối trạng thái rỗng toàn trang |
| `OpenStoreCta` | `data: ShopCtaOpenStoreData` | Section CTA mở gian hàng; nút accent chữ nâu đậm (≥ 4.5:1) |
| `ShelfSkeleton` (`_ui/shelf-skeleton.tsx`) | `variant?: "products" \| "categories" \| "tenants" \| "hero"`, `label?` (chữ sr "Đang tải {label}…"), `shelves?` (1), `background?` | Khối giữ chỗ; nhấp nháy chỉ khi `motion-safe` |

### 14.5. Trang `/cua-hang` và `/cua-hang/tai-lieu`

* `app/cua-hang/layout.tsx`: bọc `systemFontVars`, nền/màu hệ thống, `SiteHeader current="shop"` + `<main className="grow">` + `SiteFooter`
  → `loading.tsx` / `error.tsx` vẫn có header/footer.
* `/cua-hang`: mỗi section một `<Suspense>` tại đúng vị trí với `ShelfSkeleton` tương ứng; nền zebra `paper`/`alt` xen kẽ; hero ẩn → H1
  dự phòng "Cửa hàng tài liệu". Khối theo danh mục: `ShelfSection` (h2) chứa nhiều `ProductShelf headingLevel="h3"` → thẻ h4.
* `/cua-hang/tai-lieu`: dải đầu nền `PAPER_ALT` — breadcrumb (`nav aria-label="Đường dẫn"`, "Cửa hàng / Tài liệu", mục cuối
  `aria-current="page"`), H1 ("Kết quả cho “q”" / tên danh mục / "Tài liệu"), ghi chú `SearchNote`, `ShopSearchForm` (giữ `sap-xep` bằng
  `hiddenFields`). Phần kết quả: H2 "N tài liệu" / "Không có kết quả" (`id="ket-qua"`), `ShopSortForm`, lưới 2/4 cột `DocumentCard`
  compact (h3), `ShopPagination`.
* `app/cua-hang/_ui/search-parts.tsx`:
  - `ShopSortForm({ q?, categorySlug?, sort })` — form GET riêng, giữ `q` + `danh-muc` bằng input ẩn, về trang 1; có nút "Áp dụng" (không
    cần JS), select có nhãn hiển thị.
  - `SearchNote({ children })` — ghi chú (danh mục không tồn tại, trang vượt).
  - `ShopPagination({ page, pageCount, state })` — link thuần: Trước/Sau (`rel="prev"`/`"next"`) + số trang (≥ `sm`; dưới `sm` chỉ "Trang
    x/y" để không tràn ngang); trang hiện tại `aria-current="page"` + nền đặc; đầu/cuối là nút mờ `aria-disabled`, không phải link.
  - `ShopNoResults({ state, categoryName?, popular })` — gợi ý bỏ từ khoá/danh mục + chip danh mục phổ biến.
* `error.tsx`: khối `role="alert"`, tiêu đề H1 "Không tải được Cửa hàng", "Mã tham chiếu" = `digest` (không hiện `error.message`), nút
  "Thử lại" (`retry()`) `min-h-12` + link "Về trang chủ".

### 14.6. `MobileNav` (`app/_ui/mobile-nav.tsx`, client) + icon mới

* Props `items: MobileNavItem[]` — `{ href, label, current? }`; rỗng → `null`.
* Nút 44×44 có `aria-expanded` + `aria-controls`; panel thả xuống full-bleed dưới header. Đóng khi: bấm lại nút, **Esc** (trả focus về
  nút), bấm ra ngoài (`pointerdown`), hoặc đổi trang (so `usePathname()` — header nằm trong layout nên không tự unmount). Mục hiện tại:
  `aria-current="page"` + chữ đậm/vạch (không chỉ màu).
* Icon mới trong `admin/_ui/icons.tsx`: `IconMenu`, `IconClose` (cùng `IconShoppingBag` từ GĐ1).

### 14.7. Việc còn mở (BACKLOG, liên quan UI)

* Token màu sale/danger trong `theme.ts` (thay `#B91C1C`, `#241503` hard-code).
* Nhãn "Xem gian hàng" của `TenantCard` xuống 2 dòng ở 360px.
* ~~`/pricing` chưa truyền `current="pricing"` cho `SiteHeader`.~~ — xong ở ADR-041 (§18.4).
* Title trang tìm khi lọc danh mục chưa có tên danh mục.
* `PUBLIC_PAGE_READY` còn `false` trong editor CMS Cửa hàng (§13.5).
* Chưa kiểm thực tế: trạng thái rỗng toàn trang, `error.tsx` khi lỗi thật, phân trang nhiều trang ❓.

---

## 15. Trang Nhật Ký — `/admin/audit` và Studio → Hoạt động (M12a — ADR-037) ✅

Quyết định: [[01-Architecture-Decisions/ADR-023-M12-Audit-Log-Append-Only|ADR-023 (≙ ADR-037)]]; nghiệp vụ + quyền che dữ liệu:
[[02-System-Specs/Audit-Log-Specs|Audit-Log-Specs]]. Thiết kế theo brief của Quốc (Phong làm), Long đọc code 2026-10-16 (working tree,
chưa commit). Kiểm a11y/responsive trên trình duyệt: chưa có báo cáo kiểm tay riêng ❓.

### 15.1. File và vai trò

| File | Vai trò |
| :-- | :-- |
| `admin/_ui/audit-log.tsx` | Mảnh trình bày dùng chung 2 trang — **Server Component thuần** (không hook, không JS phía client). Export `AuditFilterForm`, `AuditLogResults` |
| `admin/_ui/link-pagination.tsx` | `LinkPagination` — phân trang bằng link GET (Server Component) |
| `admin/_ui/audit-log-skeleton.tsx` | `AuditLogSkeleton({ label, fields })` — khung chờ, file riêng để `loading.tsx` không kéo loader |
| `admin/audit/{page,loading}.tsx`, `studio/[tenantSlug]/activity/{page,loading}.tsx` | Hai trang; wrapper `<div className="px-5 py-8 lg:px-8">` (app shell đã có `<main>`), tiêu đề bằng `AdminPageHeader` |

Giao diện chỉ hiển thị — **không tự quyết quyền**; dữ liệu đã được loader che/lọc (§5 Audit-Log-Specs).

### 15.2. `AuditFilterForm({ basePath, filters, scope: "admin" | "studio" })`

* `<form method="get" role="search">` có tiêu đề "Bộ lọc" (`aria-labelledby`); gửi form luôn về trang 1 (không có ô `page`).
* Admin: "Người thực hiện" (email/ID), "Hành động", "Gian hàng" (slug/ID), "Từ ngày", "Đến ngày", "Số dòng mỗi trang" — lưới
  `sm:grid-cols-2 xl:grid-cols-3`. Studio bỏ 2 ô người thực hiện + gian hàng — `xl:grid-cols-4`.
* Ô ngày `type="date"`, `max`/`min` ràng buộc lẫn nhau; ghi chú "Ngày tính theo giờ Việt Nam" + số điều kiện lọc đang áp dụng.
* Nút "Xoá lọc" (link về `basePath`) và "Lọc" (chính); `min-h-11` dưới `lg`, `min-h-10` từ `lg`; hai nút chia đôi chiều ngang trên mobile.
* ⚠️ Ô "Hành động" liệt kê **toàn bộ** `AUDIT_ACTIONS`, kể cả action cấp hệ thống không bao giờ có ở Studio (BACKLOG).

### 15.3. `AuditLogResults({ result, basePath, scope, caption, emptyDescription })` — đủ trạng thái

| Trạng thái | Hiển thị |
| :-- | :-- |
| `status: "unavailable"` (bảng chưa migrate) | `Notice tone="warning"` "Nhật ký chưa sẵn sàng" |
| Có dòng | Danh sách (§15.4) + `LinkPagination` giữ bộ lọc |
| Bộ lọc actor/tenant không khớp | `Notice` warning nêu lại giá trị đã nhập |
| Trang vượt số trang | `EmptyState` "Trang này không còn nhật ký" + link "Về trang đầu" |
| Rỗng theo bộ lọc | `EmptyState` "Không có nhật ký khớp bộ lọc" + "Xoá lọc" |
| Rỗng hoàn toàn | `EmptyState` "Chưa có nhật ký nào" + `emptyDescription` của trang |

Đầu vùng kết quả: tiêu đề "Kết quả" + tổng "N mục (khớp bộ lọc)".

### 15.4. Danh sách — bảng từ `xl`, thẻ dưới `xl`

* **Từ `xl`:** `DataTable` với `caption` ẩn; cột Thời gian · Hành động · Người thực hiện · (Gian hàng — chỉ admin) · Đối tượng · Chi tiết.
* **Dưới `xl`:** `<ol aria-label={caption}>` mỗi dòng nhật ký là một thẻ, nhãn trường hiện rõ (`<dl>`), không cuộn ngang ở 360px.
* Hai bản dựng ẩn bằng `hidden` (display:none) nên trình đọc màn hình chỉ gặp một bản.
* **Hành động:** nhãn tiếng Việt + `Badge` phạm vi (`SYSTEM` info, `TENANT` success, `CUSTOMER` warning, kèm chữ ẩn "Phạm vi:"). Action
  cần chú ý (`AUTH_LOGIN_FAILED`, `AUTH_REFRESH_REUSE`, `COUPON_OVERUSED`, `USER_LOCKED`, `TENANT_LOCKED`) thêm icon cảnh báo + chữ ẩn
  "Cần chú ý:" — không chỉ dựa vào màu.
* **Người thực hiện:** vòng icon theo loại (`IconBolt` tác vụ tự động, `IconShield` quản trị, `IconStore` thành viên, `IconUsers`
  người dùng/khách, `IconXCircle` tài khoản đã xoá) + nhãn + họ tên (nếu có) + chữ loại.
* **Thời gian:** `<time dateTime>` ngày/giờ tách dòng, định dạng `vi-VN` theo `DISPLAY_TIME_ZONE`, `tabular-nums`.
* **Chi tiết:** `<details>`/`<summary>` (không JS) — metadata dạng key–value (`<dl>` lồng tối đa theo độ sâu, cặp `{from,to}` hiện
  "cũ → mới") + thông tin kỹ thuật (mã đầy đủ, IP, thiết bị).
* Chuỗi dài không dấu cách (email, id, User-Agent) dùng `[overflow-wrap:anywhere]` để xuống dòng.

### 15.5. Kit — thay đổi dùng chung

* **`DataTable`** (`admin/_ui/kit.tsx`) thêm prop tuỳ chọn **`caption?: string`** → `<caption className="sr-only">`; mọi `<th>` nay có
  **`scope="col"`**. Nên truyền `caption` khi trang có nhiều bảng hoặc bảng dài.
* **`LinkPagination({ basePath, query, page, pageSize, total, label = "Phân trang" })`** — khác `Pagination` (client, `router.push`):
  mỗi trang là một URL thật (chia sẻ/bookmark được, Back/Forward đúng). `query` là các tham số cần giữ, giá trị rỗng bị bỏ khỏi URL.
  Trang hiện tại `aria-current="page"` + nền đặc; đầu/cuối, Trước/Sau là `<span>` mờ. Dưới `sm` chỉ "Trước · Trang x/y · Sau"; số trang
  hiện từ `sm` (cửa sổ 1, …, p−1, p, p+1, …, cuối). Target 44px dưới `lg`, 36px từ `lg`. Dùng cho trang danh sách quản trị có bộ lọc
  dạng form GET. Từ ADR-046 có prop `pageParam` (mặc định `page`; Đơn hàng Studio dùng `trang`) — §20.5.
* **`AuditLogSkeleton`:** cùng khung với trang thật (tiêu đề, form lọc theo số ô `fields`, danh sách), `aria-busy`, `role="status"` ẩn
  chứa `label`, `animate-pulse motion-reduce:animate-none`. Admin `fields={6}`.

### 15.6. Menu

* System Center: nhóm mới **"Giám sát"** (icon `IconShield`) ở cuối sidebar → "Nhật ký hệ thống" (`/admin/audit`, `IconEye`).
* Studio: mục **"Hoạt động"** (`/studio/{slug}/activity`, key icon `activity` → `IconEye`) giữa "Gói dịch vụ" và "Cài đặt" — **chỉ thêm
  vào NAV khi `role === "OWNER"`** (`studio/[tenantSlug]/layout.tsx`, ADR-037 bổ sung) ✅ đọc code.

### 15.7. Việc còn mở (BACKLOG, liên quan UI)

* Ô lọc hành động ở Studio cần danh sách theo scope.
* Nút kit `PrimaryButton`/`GhostLinkButton` cao dưới 44px trên mobile (dùng chung nhiều trang).
* ⚠️ Hex hard-code trong `audit-log.tsx`/`link-pagination.tsx` chưa có token: `#6B7280` (chữ phụ), `#E5E7EB` (viền), `#B45309` (icon cảnh
  báo), `#F3F4F6`/`#4B5563` (vòng icon tài khoản đã xoá) ✅ đọc code.

---

## 16. Dashboard `/admin` — Section "Hoạt Động Bán Tài Liệu (30 Ngày)" (M12b — ADR-037) ✅

Quyết định: [[01-Architecture-Decisions/ADR-023-M12-Audit-Log-Append-Only|ADR-023 (≙ ADR-037)]]; định nghĩa số liệu + contract loader:
[[02-System-Specs/Tenant-Stats-Specs|Tenant-Stats-Specs]], [[03-API-Contracts/Endpoint-Directory|Endpoint-Directory]] §19. Thiết kế theo
brief của Quốc (Phong làm), Long đọc code 2026-10-16 (working tree, chưa commit). Kiểm a11y/responsive trên trình duyệt: chưa có báo cáo
kiểm tay riêng ❓.

### 16.1. File và vị trí

| File | Vai trò |
| :-- | :-- |
| `admin/_ui/sales-stats.tsx` | Chỉ trình bày, **Server Component** (không hook): `SalesStatsSection({ overview, metric })`, `SalesStatsSkeleton()`, `AdminStatsOverviewView`; re-export `parseSalesChartMetric`/`SalesChartMetric` từ `sales-chart-metric.ts` (lần 4). Nhận kết quả `getAdminStatsOverview()` qua prop — **không tự truy vấn**. `metric` nay chỉ là giá trị đầu cho biểu đồ client |
| `admin/_ui/sales-chart-metric.ts` ("Bổ sung ADR-043 lần 4", 2026-10-23, chưa commit) | Module thuần (không `"use client"`, không I/O): kiểu `SalesChartMetric = "gmv" \| "don"` + `parseSalesChartMetric(raw)` (mảng → lấy phần tử đầu; khác `don` → `gmv`) — dùng ở cả server (`page.tsx`) lẫn client |
| `admin/_ui/sales-daily-chart.tsx` (lần 4, chưa commit) | **Client**: `SalesDailyChart({ initialMetric, points })` — đầu thẻ (tiêu đề + đơn vị) + `MetricToggle` "GMV/Đơn" + `TrendChart`. `points` = `SalesDailyPoint { key, tick, label, gmvVnd: string, ordersPaid: number }` — GMV là **chuỗi** BigInt (không qua float) đổi bằng `toBigIntSafe`. Pattern toggle §19.8 |
| `admin/_ui/stats-chart.tsx` (từ ADR-043, 2026-10-18) | Khối con dùng chung với Studio Tổng quan: `KpiCard`, `ChangeLine`, `computeChange`, `TrendChart`, định dạng VND — `sales-stats.tsx` đã refactor để import thay cho các hàm nội bộ cũ (`KpiCard`, `DailyChart`, `computeChange`, `formatVndCompact`). Nhãn trục X `/admin` vẫn neo ngày cuối, lùi 7 ngày (truyền `showTick` riêng). Từ "Bổ sung ADR-043 lần 3": số đầy đủ; từ **lần 4** cả trục Y cũng số đầy đủ, `formatVndAxis` **đã xoá** — §19.6. **Chưa kiểm lại `/admin` trên trình duyệt sau refactor/đổi số** ❓. API: §19.4 |
| `admin/page.tsx` | Component async `SalesStats` gọi `getAdminStatsOverview({ days: 30 })`, bọc `<Suspense fallback={<SalesStatsSkeleton />}>` riêng — phần còn lại dashboard không phải chờ. Đặt sau khối thanh toán gói gần đây, trước "Thao tác nhanh" |

Section có `id="hoat-dong-ban-tai-lieu"` + `scroll-mt-20`, `aria-labelledby` trỏ tiêu đề `h2`.

### 16.2. Đầu section

* `h2` "Hoạt động bán tài liệu (30 ngày)" (font heading).
* Ghi chú: "Số liệu tổng hợp hằng ngày lúc 03:00, tính đến hết hôm qua — cập nhật lần cuối {`lastAggregatedAt` theo `DISPLAY_TIME_ZONE`}.
  GMV là tổng tiền khách trả (gộp, chưa trừ hoàn tiền)." — thay "mỗi giờ" của đặc tả gốc (ADR-037 mục 5).

### 16.3. Thẻ KPI (4 thẻ)

* Lưới `grid-cols-1 sm:grid-cols-2 xl:grid-cols-4`: **GMV**, **Đơn đã thanh toán**, **Khách mới**, **Lượt tải**. Từ "Bổ sung ADR-043 lần 3"
  (working tree, chưa commit ✅ `git diff`): GMV hiện **số đầy đủ** "1.234.567 đ" (`formatVndFull`), **bỏ** dòng phụ; trước đó là giá trị rút gọn
  "12,5 triệu đ" + dòng phụ số đầy đủ. Cỡ chữ theo độ dài (`statValueSizeClass`, §19.6).
* Dòng thay đổi so với 30 ngày trước, tính bằng **BigInt** (cả GMV), 1 chữ số thập phân:
  - kỳ trước = 0 → "— chưa có số liệu kỳ trước" (màu chữ phụ);
  - 0% → "Không đổi so với 30 ngày trước";
  - tăng/giảm → mũi tên + chữ "Tăng"/"Giảm" {x}% — màu **`text-green-700`** / **`text-red-700`** (Tailwind, không phải token); không chỉ
    dựa vào màu vì có chữ + icon.
* Định dạng tiền không qua float: phần nguyên + 1 chữ số thập phân tính bằng BigInt rồi mới đổi number.

### 16.4. Biểu đồ cột theo ngày

* Thẻ `xl:col-span-2`; tiêu đề "GMV theo ngày" / "Đơn đã thanh toán theo ngày" + đơn vị + "mỗi cột là 1 ngày (giờ Việt Nam)".
* **Chọn chỉ số `?chi-so=gmv|don`** — từ "Bổ sung ADR-043 lần 4" (2026-10-23, working tree chưa commit ✅ `git diff`) đổi **tức thì phía
  client** bằng `MetricToggle` trong `role="group"` `aria-label="Chọn chỉ số biểu đồ"`, 2 nút "GMV"/"Đơn" `aria-pressed`; URL cập nhật bằng
  `history.replaceState` (giá trị mặc định `gmv` bỏ khỏi query), không gọi lại server — pattern §19.8. Giá trị đầu vẫn đọc ở server; giá trị lạ →
  `gmv`. Target `min-h-11` dưới `lg`. *Trước lần 4:* `<nav>` 2 link GET `aria-current`, `scroll={false}` + neo `#hoat-dong-ban-tai-lieu` (không cần
  JS) — **đã bỏ**; nay **đổi chỉ số cần JS** (không JS thì gõ URL `?chi-so=don`).
* Biểu đồ **HTML thuần** (không thư viện chart, không SVG): khối `role="img"` có `aria-label` tóm tắt (khoảng ngày, giá trị cao nhất + ngày);
  cột/trục bên trong `aria-hidden`. Cao `h-48`; trục Y 3 mốc (max, max/2, 0); lưới ngang nét đứt; cột màu `brandColors.primary`, ngày bằng 0
  là vạch xám 2px; `title` mỗi cột = ngày + giá trị đầy đủ; nhãn trục X thưa — neo ngày cuối, lùi mỗi 7 ngày (không chồng chữ ở 360px).
  Nhãn trục Y GMV từ lần 4 là **số đầy đủ** (`formatVndFull`), cột nhãn co theo nhãn dài nhất (§19.6).
  Dòng "Cao nhất: … ngày …" dưới biểu đồ.
* Cả 30 ngày = 0 cho chỉ số đang chọn → khung nét đứt "Không có doanh thu/đơn đã thanh toán nào trong 30 ngày."
* **Bảng số liệu thay thế** trong `<details>` "Xem bảng số liệu theo ngày" (từ lần 4 có chevron bên phải — mẫu §19.6): `<table>` có `caption` ẩn, `th scope="col"`/`scope="row"`, 5 cột
  (Ngày, GMV, Đơn, Khách mới, Lượt tải), mới → cũ, khung `max-h-96 overflow-auto` (cuộn ngang trong khung, trang không cuộn ngang).

### 16.5. Top 5 gian hàng theo GMV

* Thẻ cạnh biểu đồ (dưới `xl` xếp dưới): danh sách `<ol>` hạng 1–5, mỗi dòng tên gian hàng (link `/{slug}` mở tab mới, có chữ ẩn "Hạng n" và
  "(mở gian hàng ở tab mới)"), `/{slug}`, GMV (số đầy đủ từ lần 3 — trước là rút gọn) + số đơn. **Chỉ tên + số tổng hợp** (§7.9).
* Không có tenant GMV > 0 → "Chưa có gian hàng nào phát sinh doanh thu trong 30 ngày."

### 16.6. Trạng thái

| Trạng thái | Hiển thị |
| :-- | :-- |
| Đang tải | `SalesStatsSkeleton` — cùng khung với khối thật, `aria-busy`, `role="status"` ẩn "Đang tải thống kê bán tài liệu…", `animate-pulse motion-reduce:animate-none` |
| `status: "unavailable"` (bảng chưa migrate) | `Notice tone="warning"` "Thống kê chưa sẵn sàng" — "Số liệu sẽ hiện sau lần tổng hợp hằng ngày kế tiếp (03:00)" |
| Rỗng — **cả 2 kỳ (60 ngày) đều 0 và không có top tenant** | `EmptyState` "Chưa có hoạt động bán tài liệu" |
| Có số liệu | 4 KPI + biểu đồ/bảng + top 5 |

### 16.7. Việc còn mở (liên quan UI)

* ⚠️ Hex hard-code trong `sales-stats.tsx` chưa có token: còn `LINE = "#E5E7EB"` (viền khung/bảng) ✅ đọc code 2026-10-18 — `#6B7280` (chữ
  phụ) và `#D1D5DB` (đường đáy) đã bỏ khi refactor sang `stats-chart.tsx` (chữ phụ nay `brandColors.inkSoft`, lưới dùng thang xám Tailwind).
  Màu xu hướng vẫn `text-green-700`/`text-red-700`, luôn kèm mũi tên + chữ "Tăng/Giảm".

---

## 17. Báo Cáo Vi Phạm, Khoá Kiểm Duyệt & Quyền Lợi Người Mua (M12c — ADR-038, ADR-039) ✅

Quyết định thiết kế của Phong, nhận qua brief Quốc 2026-10-17; Long đối chiếu file trong working tree (**chưa commit/deploy**). Nghiệp vụ:
[[02-System-Specs/Abuse-Reports-Specs|Abuse-Reports-Specs]]. Kiểm thật trên trình duyệt (a11y, responsive 360px, trình đọc màn hình) ❓ —
Long chưa chạy; brief không kèm kết quả kiểm của Phong.

### 17.1. File và vai trò

| File | Vai trò |
| :-- | :-- |
| `app/[tenantSlug]/_ui/report-abuse.tsx` | `ReportAbuseButton` + hộp thoại gửi báo cáo (trang hệ thống ADR-025 — màu/font hệ thống) |
| `app/admin/_ui/moderation-lock.tsx` | `ModerationLockBadge`, `ModerationLockNotice` — dùng ở Studio (danh sách, editor, thẻ đánh giá) và chi tiết báo cáo |
| `app/admin/reports/_ui/report-list.tsx` | `ReportFilterForm`, `ReportResults` — trang `/admin/reports` |
| `app/admin/reports/_ui/report-detail.tsx` | `ReportDetailView` — trang chi tiết |
| `app/admin/reports/_ui/report-actions.tsx` | `ResolveReportForm`, `UnlockModerationButton` (client) |
| `app/account/library/_ui/confirm-dialog.tsx` | `ConfirmDialog` + hằng `LIBRARY_BTN`, `LIBRARY_FOCUS`, `LIBRARY_ERROR_RED` |
| `app/account/library/_ui/remedy-notice.tsx` | `RemedyNotice` (client) — khối quyền lợi người mua |
| `app/account/library/_ui/library-entitlement-card.tsx` | `LibraryEntitlementCard` (server) — 1 mục Thư viện |
| `app/account/library/{loading,error}.tsx` | Trạng thái tải / lỗi của Thư viện |
| `app/studio/[tenantSlug]/orders/_ui/remedy-parts.tsx` | `RefundRequestBadge`, `OrderItemRemedy`, `isRefundOverdue`, `refundDueAt`, `formatRemedyDateTime` |
| `app/admin/_ui/icons.tsx` | Thêm `IconFlag` (menu + nút báo cáo) |

### 17.2. Nút & hộp thoại "Báo cáo vi phạm" (public)

- Vị trí: trang tài liệu (cạnh thông tin tài liệu + dưới từng đánh giá) và trang bài viết. Nút dạng link chữ nhỏ có icon cờ, vùng bấm
  `min-h-11` (44px) trên mobile, `lg:min-h-9`; có `srContext` cho trình đọc màn hình khi nhiều nút trên một trang.
- Hộp thoại dùng `<dialog>` gốc mở bằng `showModal()` (top layer, nền sau `inert`): `aria-modal`, `aria-labelledby/-describedby`, bẫy Tab,
  Esc / nút Đóng / bấm nền để đóng (đang gửi thì không đóng), trả focus về nút mở.
- Trường: nhóm radio loại vi phạm dạng thẻ (kèm gợi ý ngắn), mô tả (bắt buộc), tối đa 5 link bằng chứng (thêm/xoá từng ô), email (chỉ hiện
  khi chưa đăng nhập), ô honeypot `website` ẩn khỏi người dùng/trình đọc màn hình.
- Lỗi API map theo mã sang thông điệp tiếng Việt; lỗi theo trường hiện ngay dưới ô (vì `VALIDATION_ERROR` chỉ trả thông điệp, UI **đoán
  trường theo nội dung thông điệp** — BACKLOG đề nghị API trả `field`). Thành công → khung cảm ơn, focus chuyển tới thông điệp.
- Màu: đỏ lỗi `#B91C1C` (6.5:1 trên trắng), xanh thành công `#15803D` (5.0:1). Không dùng `localStorage`.

### 17.3. Khoá kiểm duyệt trong Studio

- `ModerationLockBadge`: `Badge tone="danger"` + icon khoá + chữ "Bị khoá kiểm duyệt" (không chỉ dựa vào màu).
- `ModerationLockNotice({ subject, measure, blocked, reason, lockedAtLabel })`: khối nền `#FEF2F2`, viền `#FCA5A5`, chữ `#B91C1C` — nêu lý do
  (nhãn loại vi phạm), biện pháp, việc tenant không làm được và hướng liên hệ hỗ trợ. **Chưa** hiện email hỗ trợ cụ thể (BACKLOG). Không bao
  giờ có danh tính người báo cáo.
- Danh sách sản phẩm/bài viết, editor, thẻ đánh giá: hiện nhãn + ẩn các nút đổi trạng thái khi bị khoá (server vẫn chặn).
- Card xuất bản của editor sản phẩm: ô tích bắt buộc **"Tôi sở hữu hoặc có quyền phân phối tài liệu này"** (`id="rightsConfirmed"`, vùng bấm
  `min-h-11`, viền đỏ khi lỗi, `aria-invalid` + `aria-describedby` tới gợi ý/lỗi); bấm Xuất bản khi chưa tích → lỗi cục bộ + focus về ô.

### 17.4. System Center — `/admin/reports`

- Theo mẫu trang nhật ký §15: form lọc GET (trạng thái — mặc định "Chờ xử lý", loại vi phạm, đối tượng, cỡ trang 10/20/50/100) · bảng từ `xl`,
  danh sách thẻ dưới `xl` (không cuộn ngang ở 360px) · phân trang link GET giữ bộ lọc (`LinkPagination`). Server Component thuần.
- Đủ trạng thái: chưa sẵn sàng (bảng chưa có) · danh sách · trang vượt số trang · rỗng theo lọc · không còn báo cáo chờ.
- Chi tiết: cột chính (nội dung báo cáo → nội dung bị báo cáo; đánh giá chỉ sao + nội dung + tên tài liệu) + cột phải từ `xl` (xử lý → gian
  hàng kèm số yêu cầu hoàn tiền quá hạn); dưới `xl` xếp dọc.
- `ResolveReportForm`: quyết định là nhóm radio dạng thẻ (≥44px, mô tả hậu quả dưới nhãn), ô "áp cùng quyết định cho N báo cáo khác",
  ghi chú nội bộ; "Khoá gian hàng" phải xác nhận trước khi gửi; submit thủ công (`startTransition`) để form không reset khi server trả lỗi.
- Sidebar nhóm "Giám sát" thêm "Báo cáo vi phạm" (`IconFlag`) + badge số báo cáo `OPEN` (`AdminSidebarNav badges`, nhãn đọc màn hình
  "N báo cáo chờ xử lý"). `/admin/tenants` hiện `Badge tone="danger"` "N hoàn tiền quá hạn" (chỉ số đếm).

### 17.5. Thư viện khách — quyền lợi người mua

- `LibraryEntitlementCard` hiện `RemedyNotice` phía trên danh sách tệp khi `remedyStatus ≠ NONE` và chưa thu hồi (thu hồi ưu tiên, trừ
  `REFUNDED` — nhãn "Đã hoàn tiền" rõ hơn). Nút tải bị khoá theo `remedyDownloadBlock`.
- `RemedyNotice` theo pattern §7.1 (tint + viền trái 4px, chữ luôn `ink`, câu mở đầu `<strong>`): `PENDING_CHOICE` → 2 lựa chọn ("Tải lần cuối" — "N lượt tải cuối cho N tệp — mỗi lượt tải một tệp"; "Yêu cầu hoàn tiền" — chỉ khi đơn > 0đ), mỗi lựa chọn mở `ConfirmDialog` xác nhận; trạng thái đã
  chọn hiện ngày chọn / ngày hoàn tiền. Sau Server Action, component giữ instance (key theo entitlement) và chuyển focus tới khối trạng thái
  mới.
- `FINAL_DOWNLOAD`: nút tải mở hộp thoại cảnh báo trước khi tải (tài liệu bị gỡ, chỉ dùng cá nhân, không phát tán, đây là lần cuối)
  (`download-button.tsx`).
- `ConfirmDialog`: cùng pattern `<dialog>` của §17.2; điều khiển bằng prop `open`; nút `LIBRARY_BTN` bo tròn `min-h-11`.
- Lượt tải lần cuối tính chung theo entitlement ("Bổ sung ADR-039 lần 2" (d)) — chữ UI đổi từ "mỗi tệp đúng 1 lần" thành "Bạn có N lượt tải cuối cho N tệp — mỗi lượt tải một tệp, hãy tải mỗi tệp một lần." (`remedy-notice.tsx`); Studio: "(số lượt bằng số tệp — mỗi lượt tải một tệp)" (`remedy-parts.tsx`) ✅ đọc code 2026-10-17. Xem
  [[02-System-Specs/File-Storage-And-Downloads-Specs|File-Storage-And-Downloads-Specs]] §8.

### 17.6. Studio — Đơn hàng

- Chip lọc trạng thái + chip "Yêu cầu hoàn tiền" (`?remedy=REFUND_REQUESTED`, kèm số đếm; chữ đỏ "N quá hạn" khi có): `min-h-11` (`lg:min-h-9`),
  chip đang chọn nền primary + chữ trắng (~10:1), chip thường nền trắng + chữ `#4B5563` (~7:1) — **sửa tương phản** chip lọc đơn cũ; có
  `aria-current="page"`.
- Bảng đơn: email khách gộp dưới mã đơn trên mobile (`md:hidden`), cột riêng từ `md`; `RefundRequestBadge` "Khách yêu cầu hoàn tiền" (vàng) /
  "… · quá hạn" (đỏ — chữ nói rõ, không chỉ màu).
- Chi tiết đơn: `OrderItemRemedy` theo từng dòng (trạng thái, ngày chọn, hạn xử lý = `remedyChosenAt` + 7 ngày, quá hạn tô đỏ + chữ "Quá hạn"),
  hướng dẫn trỏ tới nút "Đánh dấu đã hoàn tiền"; ẩn "Cấp thêm lượt" khi có remedy.
- Sidebar Studio: badge số yêu cầu hoàn tiền cạnh "Đơn hàng", `srText` đầy đủ ("N yêu cầu hoàn tiền chờ xử lý, M quá hạn"), `urgent` khi có
  mục quá hạn. Từ ADR-042 kiểu là `SidebarNavBadge = { count, srText, urgent? }` của `SidebarNav` chung (§5.1 — pill `accentSoft`/`ink`,
  `urgent` nền `#B91C1C` + icon cảnh báo); kiểu cũ `TenantNavItem.badge = { text, … }` đã bỏ cùng file sidebar Studio.

### 17.7. Việc còn mở (BACKLOG, liên quan UI)

~~System Center chưa có menu mobile; Studio chưa có nav mobile~~ — xong ADR-042 (§5.1); `VALIDATION_ERROR` chưa trả `field`; email hỗ trợ trong khối khoá Studio; nút theo
dõi tranh chấp hoàn tiền.

---

## 18. Bảng Giá CMS, Khu Vực Tài Khoản `/account`, Hoàn Tiền Gói (ADR-041) ✅

Đối chiếu working tree 2026-10-17 (nay đã commit `7f8360b`, deploy ❓). Nghiệp vụ: [[02-System-Specs/Pricing-Page-Specs|Pricing-Page-Specs]],
[[02-System-Specs/Account-Profile-Specs|Account-Profile-Specs]], [[02-System-Specs/Payment-And-Billing|Payment-And-Billing]] §5B. Đề xuất gốc
của Phong: `docs/de-xuat-trang-bang-gia-2026-10-17.md`, `docs/de-xuat-trang-ho-so-2026-10-17.md`.

### 18.1. Kit — thay đổi dùng chung (`admin/_ui/kit.tsx`, `kit-interactive.tsx`)

* `PrimaryButton` / `GhostButton`: `min-h-11` (44px) **dưới `lg`**, `lg:min-h-0`; vòng focus `focus-visible:outline-2` màu primary.
* `TextField` (`FieldShell`): đoạn lỗi có `id="${id}-error"`, gợi ý `id="${id}-hint"` để ô tham chiếu bằng `aria-describedby`.
* `PasswordField`: có `id` thì tự gắn `aria-invalid` + `aria-describedby` (lỗi ưu tiên, rồi gợi ý) như `TextField`; nút ẩn/hiện nhãn **cố định**
  `toggleLabel` (mặc định "Hiện giá trị") + `aria-pressed` + `aria-controls`, vùng bấm rộng 44px, vòng focus nhìn thấy; không chặn dán /
  trình quản lý mật khẩu.

### 18.2. `SortableListEditor` (`app/admin/cms/_ui/sortable-list-editor.tsx`, client)

Danh sách mục có thứ tự dùng chung cho editor CMS (thay `ArrayObjectEditor` không đổi được thứ tự): Thêm / Lên / Xuống / Xoá. Lên/Xuống thay
kéo-thả (WCAG 2.5.7); nút icon 44px dưới `lg`, 36px từ `lg`; mục đầu/cuối dùng `aria-disabled` (không `disabled`) để focus không rơi; mỗi thao
tác đọc qua **một** vùng `role="status"` ẩn, không dời focus; thêm mục → focus ô đầu của mục mới; xoá → focus về nút Thêm; mảng không có id
(vd mảng chuỗi) vẫn giữ key ổn định.

### 18.3. Editor `/admin/cms/pricing`

* Cùng pattern editor Cửa hàng (§13.3): thanh trạng thái, danh sách 9 khu vực (ẩn/hiện, Lên/Xuống), form khu vực đang chọn
  (`_ui/pricing-section-forms.tsx`), **kiểm tra trước khi gửi bằng đúng schema server + tham chiếu gói** (`_ui/pricing-validation.ts`), khung
  tóm tắt lỗi nhận focus và dẫn tới đúng ô, lỗi server (`issues`) gộp vào cùng khung và hiện dưới từng ô, cảnh báo rời trang khi chưa lưu.
* Ô SEO (tiêu đề ≤ 120, mô tả ≤ 320) — cột riêng, **không có nháp** (đã xuất bản thì "Lưu nháp" đổi SEO ngay).
* Dòng loại `feature` có cờ ngoài `implementedFeatures` (hiện rỗng) hiện nhãn "(chưa triển khai)" — và không ra trang công khai. Có
  `loading.tsx`.
* Menu System Center (`sidebar-nav.tsx`): "Trang Bảng giá" (`IconPackage`), "Hoàn tiền gói" (`IconReceipt`) kèm badge số yêu cầu chờ
  (nhãn đọc "N yêu cầu hoàn tiền chờ duyệt").

### 18.4. Trang `/pricing` (`app/pricing/*`, `app/_ui/pricing/*`)

* Khung hệ thống ở `layout.tsx`: skip-link → `#noi-dung`, `SiteHeader current="pricing"` (`aria-current="page"`), `SiteFooter`; `loading.tsx` +
  `error.tsx` nằm trong khung có header.
* **Thẻ gói** (`pricing-plans.tsx`, client): mỗi thẻ `<article aria-labelledby>`; giá có bản đọc trọn câu (`sr-only`); "Gói hiện tại"/nhãn nổi
  bật là **chữ thật** (không chỉ viền màu); một nút chính mỗi thẻ (nền primary chữ trắng). **Toggle Tháng/Năm = nhóm radio** (`fieldset` +
  `legend` ẩn), đổi chu kỳ cập nhật giá tại chỗ, không dời focus, một vùng `role="status"` đọc chu kỳ đang hiển thị; không JS → hiện giá chu
  kỳ chính.
* **Bảng so sánh** (`pricing-blocks.tsx`): bảng thật trong vùng cuộn ngang **riêng** (`role="region"` + `aria-labelledby` + `tabIndex=0` để
  cuộn bằng phím), cột nhãn `sticky left-0`. ⚠️ Vùng cuộn **phải có `relative`** — thiếu nó, các span `sr-only` (absolute) trong bảng kéo rộng
  cả trang ở màn hẹp (trang cuộn ngang). Dưới màn hẹp có dòng gợi ý "Vuốt ngang trong bảng để xem đủ các gói".
* **"Vì sao chọn"** (`PricingWhyUs`, hàm `whyUsDesktopCols(count)` trong `pricing-blocks.tsx`) ✅ đọc code 2026-10-23 (working tree, chưa
  commit): dưới `sm` luôn 1 cột; mọi class `sm:`/`lg:`/`xl:` của lưới nằm **trong hàm**, số cột **theo số thẻ** —

  | Số thẻ | Từ `sm` | Từ `lg` | Từ `xl` |
  | :--- | :--- | :--- | :--- |
  | 1 | 1 cột, thẻ giữa (`sm:max-w-xl sm:mx-auto`) | như `sm` | như `sm` |
  | 2 | 2 cột | 2 cột | 2 cột |
  | 4 (nhánh `count % 4 === 0`) | 2 cột | 2 cột | 4 cột |
  | 3, 5, 6 (mọi trường hợp còn lại) | 2 cột | 3 cột | 3 cột |

  Tối đa **6 thẻ** (`PRICING_WHY_US_MAX = 6`, `packages/core/src/admin/pricing-sections.ts`) ✅, nên nhánh "bội 4" thực tế chỉ gặp 4 thẻ.
  Sửa lỗi cũ: 4 thẻ hiện 3 cột → thẻ thứ 4 lẻ hàng dưới; 1 thẻ chỉ chiếm nửa hàng ở khoảng `sm`–`lg`. 5 thẻ ra hàng 3 + 2 ở `lg` — đã
  chấp nhận (Quốc chốt 2026-10-23). Chưa kiểm trình duyệt ❓.
* **FAQ** bằng `<details>` (không JS). Section rỗng tự ẩn; số liệu = 0 ẩn.
* Xem nháp (`?xem-truoc=nhap`, chỉ admin): dải "Đang xem bản nháp" + `noindex`.

### 18.5. Khu vực `/account`

* **App shell fluid** (`_ui/account-shell.tsx`; ADR-024 §4.4 — không `container-page`): skip-link, header hệ thống gọn **64px** (logo → trang
  chủ, nhãn "Tài khoản", menu tài khoản) — giống Studio. Header `px-4 sm:px-5 lg:px-8`.
* **Đồng bộ độ rộng với Studio/System Center** ✅ đọc code 2026-10-23 (working tree, chưa commit): `<main>` padding `px-5 py-8 lg:px-8` (bằng
  khung trang Studio — Studio đặt ở từng trang, `/account` đặt ở shell); sidebar **288px** (trước 264px, nay bằng Studio/System Center). Trang con **không** tự đặt `mx-auto`/`max-w-*`/padding cho khung
  trang — muốn giới hạn thì giới hạn ô nhập/đoạn văn **bên trong** thẻ. Ngoại lệ duy nhất: `/account/email/xac-nhan` (form đơn lẻ) dùng
  `mx-auto max-w-md` ≈ `container-narrow`. Tiêu đề mọi trang con dùng `AdminPageHeader` (kit §5).
* **Mẫu "form trong trang fluid"** (pattern mới, lần đầu repo dùng container query Tailwind v4) ✅ đọc code: thẻ trải hết chiều rộng cột lưới;
  nội dung form bọc `@container max-w-3xl`; chia cột ô nhập theo **độ rộng thẻ** chứ không theo viewport — `@xl:grid-cols-2` (vd
  `profile/profile-form.tsx`). Dùng khi cùng một form nằm trong cột lưới có bề rộng thay đổi theo breakpoint; ô nhập không giãn quá
  `max-w-3xl` trên màn rộng.
* **Lưới từng trang** ✅ đọc code:

  | Trang | File | Lưới |
  | :--- | :--- | :--- |
  | Tổng quan `/account` | `_ui/overview-view.tsx` | `xl:grid-cols-[3fr_2fr]` (`minmax(0,…)`) |
  | Hồ sơ | `profile/_ui/profile-view.tsx` | `xl:grid-cols-[2fr_3fr]` → `2xl:grid-cols-[1fr_2fr]` (`minmax(0,…)`); thẻ Email `xl:col-span-2` |
  | Bảo mật | `security/page.tsx` | `xl:grid-cols-2` (Đổi mật khẩu · Email đăng nhập); khối "Phiên đăng nhập" (viền nguy hiểm) `xl:col-span-2` trải hết hàng dưới; nội dung thẻ `max-w-3xl` |
  | Thư viện | `library/page.tsx` | thẻ tài liệu `xl:grid-cols-2`; link "Lịch sử đơn hàng" đặt ở `action` của `AdminPageHeader` |
  | Đơn hàng | `orders/page.tsx` | từ `xl`: `DataTable` cột Mã đơn · Ngày tạo · Tài liệu · Gian hàng (gian hàng ở dòng phụ) · Trạng thái · Tổng tiền · Thao tác (tiêu đề `sr-only`); dưới `xl`: thẻ, `md:grid-cols-2` |

  `loading.tsx`/`error.tsx` theo lưới mới: `account/loading.tsx` skeleton `xl:grid-cols-2` + `xl:col-span-2`, `library/loading.tsx`
  `xl:grid-cols-2`; `account/error.tsx` thẻ trải hết vùng main (chỉ đoạn văn `max-w-md`); `library/error.tsx` có `AdminPageHeader`, khối lỗi
  `max-w-3xl`. 🟡 Theo báo cáo: build/tsc/eslint đạt, đã xem preview 360/768/1280/1920 cho Hồ sơ và Tổng quan; Bảo mật/Thư viện/Đơn hàng
  **chỉ kiểm code**, chưa xem trình duyệt ❓.
* **Sidebar** (`_ui/account-sidebar-nav.tsx`, chỉ từ `lg`, rộng 288px): 3 nhóm "Tài khoản của bạn" · "Mua sắm" · "Gian hàng của bạn" (chỉ chủ gian hàng),
  nút Đăng xuất tách riêng (`_ui/logout-button.tsx`, đặt trong shell và danh sách mobile). Chữ phụ (tên gói, số đơn chờ) luôn là chữ; `metaTone="warning"` khi cần chú ý; mục
  sang khu vực khác (Studio) có icon + chữ ẩn cho trình đọc màn hình. Icon truyền bằng **key chuỗi** (§8.5).
* **Mobile (< `lg`)**: `/account` là danh sách mục kiểu cài đặt (`_ui/account-nav-list.tsx`); trang con có link "← Tài khoản"
  (`_ui/back-link.tsx`).
* Trang Tổng quan (`_ui/overview-view.tsx`), thẻ "Gian hàng của bạn" (`_ui/owned-tenant-card.tsx` — nút đích theo Free/ACTIVE/GRACE/CANCELED,
  thanh dùng chỉ khi hạn mức `LIMITED`), Hồ sơ (`profile/_ui/profile-view.tsx`, `profile-form.tsx`, `avatar-card.tsx`), Bảo mật
  (`security-forms.tsx`). Phản hồi form: `_ui/form-feedback.tsx` — thành công `role="status"`, lỗi chung `role="alert"`, lỗi dưới ô +
  `aria-describedby`, giữ nội dung đã gõ. Mỗi trang một H1. Có `loading.tsx`, `error.tsx`.
* **Ảnh đại diện**: `app/_ui/account-avatar.tsx` (ảnh hoặc chữ cái đầu). `avatarUploadEnabled=false` → ẩn ô tải, hiện ghi chú, vẫn cho "Gỡ ảnh"
  (giao diện đổi ngay, lỗi thì trả ảnh cũ).
* **Menu tài khoản** (`app/_ui/account-menu.tsx`): mẫu **disclosure** — nút `aria-expanded` + `aria-controls`, danh sách link trong `<nav
  aria-label="Tài khoản">`, **không** `role="menu"` (menu này không cần phím mũi tên; link đi bằng Tab). Nút ≥ 44×44, dưới `sm` chỉ hiện avatar +
  tên `sr-only`. `variant="site"` ("Xin chào, {tên}") ở `SiteHeader`; `variant="app"` ở header **System Center** (từ ADR-042, họ tên + avatar
  qua `getAccountHeaderData`), Studio và `/account` — `variant="app"` có viền + chevron ở mọi kích thước. Có mục **Đăng xuất**; prop
  `logoutRedirect` (mặc định `/`): System Center/Studio truyền `/login`, `SiteHeader` và `/account` giữ `/`.
  Header Studio thay khối avatar-chữ-cái + email cũ bằng menu này.
* **`LogoutButton`** (`account/_ui/logout-button.tsx`): prop `redirectTo` (mặc định `/`) và `tone` — `light` (đỏ `#B91C1C` trên nền trắng, dùng
  ở `/account`) / `onDark` (đỏ nhạt `#FCA5A5` trên nền primary, dùng ở đáy `AppSidebarPanel` — §5.1). Gọi `POST /api/auth/logout` rồi
  `router.push(redirectTo)`.

### 18.6. Hoàn tiền gói

* **Studio → Gói dịch vụ** (`billing/page.tsx`, `refund-request-form.tsx`): card hoàn tiền chỉ hiện khi đủ điều kiện hoặc đã có yêu cầu; mô tả
  "Hoàn 100% lần thanh toán gói đầu tiên … trong 7 ngày"; form ngân hàng (danh sách `bank_bins`) + số TK + tên chủ TK + lý do, hiện số tiền và
  hạn chót; sau khi gửi hiện trạng thái (badge `REQUESTED` vàng / `APPROVED_REFUNDED` xanh / `REJECTED` đỏ, mốc thời gian, lý do từ chối).
  `?plan=` chọn sẵn gói trong form gia hạn. Thanh dùng hạn mức: `-1` không vẽ thanh %.
* **System Center `/admin/billing/refunds`** (`page.tsx`, `refund-actions.tsx`, `loading.tsx`): lọc trạng thái bằng link; thông tin nhận tiền
  **che sẵn từ server** (`••••1234`) + nút "Xem đầy đủ"/"Ẩn thông tin"; "Đã hoàn tiền" / "Từ chối" là **hai bước** (bấm nút → mở khung xác
  nhận tại chỗ — progressive disclosure, thay `window.confirm`), từ chối bắt buộc lý do; `approveBlocked` → ẩn "Đã hoàn tiền", hiện `Notice`
  giải thích chỉ có thể từ chối.

### 18.7. Việc còn mở (BACKLOG, liên quan UI)

* ~~Studio chưa có **menu điều hướng mobile** (GĐ2b)~~ — **xong 2026-10-17** theo ADR-042 (`SidebarDrawer`, §5.1).
* Shell System Center/Studio chưa có skip-link "Bỏ qua tới nội dung" (`/account` đã có) — BACKLOG (ADR-042).
* Cân nhắc chuyển `LogoutButton` từ `account/_ui/` về `app/_ui/` (đang được `admin/_ui/app-sidebar.tsx` import chéo) — BACKLOG (ADR-042).
* Editor CMS **Cửa hàng**: cột aside thiếu `min-w-0` (nội dung dài có thể tràn).
* Hex cứng còn ở `owned-tenant-card.tsx` (`#E5E7EB`, `#B91C1C`), thanh 80% Billing (`#F3F4F6`) — thay bằng token khi có token màu danger/line.
* Ghi chú tương phản khi admin đổi màu thương hiệu (đề xuất Phong) — chưa có cơ chế kiểm.
* Chưa kiểm thực tế qua trình duyệt có đăng nhập: 360/375px, bàn phím, trình đọc màn hình ❓. Riêng lưới mới 2026-10-23: Bảo mật,
  Thư viện, Đơn hàng (bảng `xl` / thẻ `md`) chưa xem preview ❓.

---

## 19. Dashboard Tổng Quan Gian Hàng `/studio/{slug}` (ADR-043) ✅

Quyết định: [[01-Architecture-Decisions/ADR-029-Studio-Dashboard-Period-Gross-Net-Revenue|ADR-029 (≙ ADR-043)]]; định nghĩa số liệu:
[[02-System-Specs/Studio-Dashboard-Specs|Studio-Dashboard-Specs]]; contract: [[03-API-Contracts/Endpoint-Directory|Endpoint-Directory]] §22. Phong
làm UI theo brief của Quốc, Long đọc code 2026-10-18 (working tree, chưa commit). Kiểm: lint/typecheck/build đạt (Quốc chạy lại 2026-10-18) 🟡,
xem trước dữ liệu giả 360/768/1280 🟡. **Chưa** kiểm phiên OWNER thật, bàn phím/trình đọc màn hình ❓.

**"Bổ sung ADR-043 lần 3"** (2026-10-18, chủ dự án yêu cầu; **đã commit** trong `dd349b9` ✅ `git log` 2026-10-23 — trước đây trang ghi "chưa commit"; phần ADR-043 gốc commit `e5d63d0`):
bộ chọn kỳ đổi sang **date range picker** (§19.5), thẻ thống kê hiện **số đầy đủ** — chỉ trục Y rút gọn (§19.6), áp cho cả `/admin`. Phong báo:
lint/typecheck/build đạt, Playwright kiểm bàn phím, 360/1100/1440 không cuộn ngang 🟡; **chưa** kiểm phiên OWNER thật ❓; thẻ "Doanh thu gói dịch
vụ" `/admin` đã xong (Phong báo, Long đọc lại `git diff` ✅).

**"Bổ sung ADR-043 lần 4"** (2026-10-23, chủ dự án yêu cầu; working tree **chưa commit** ✅ `git diff`/`git status`, Long đọc code 2026-10-23):
**trục Y** cũng số đầy đủ, `formatVndAxis` đã xoá (§19.6); nút **Gộp/Thực nhận** (Studio) và **GMV/Đơn** (`/admin`) đổi **tức thì phía client**,
URL giữ `?chi-so=` bằng `history.replaceState` (§19.8); `<details>` bảng số liệu có chevron; bảng "10 đơn mới nhất" hiện "0 đ". Quốc báo: tsc/eslint/build
đạt 🟡; **chưa kiểm trình duyệt** ❓.

### 19.1. File

| File | Vai trò |
| :-- | :-- |
| `studio/[tenantSlug]/(tong-quan)/page.tsx` | Server Component: guard OWNER → `resolveDashboardRange` → `getTenantDashboard` → `StudioDashboardView`. Route group `(tong-quan)` (URL không đổi) để `loading.tsx`/`error.tsx` **chỉ** áp cho Tổng quan, không phủ các trang con Studio (`git status`: `page.tsx` cũ đổi tên vào đây) |
| `(tong-quan)/loading.tsx` + `_ui/dashboard-skeleton.tsx` | `StudioDashboardSkeleton` — `aria-busy`, `role="status"` ẩn, `animate-pulse motion-reduce:animate-none`; cũng hiện khi đổi kỳ (đổi searchParams = điều hướng mới) |
| `(tong-quan)/error.tsx` | Client; `role="alert"`, tiêu đề "Không tải được số liệu Tổng quan", hiện `digest` (không `error.message`), nút "Thử lại" (`retry()` — "Next 16.3" theo comment code 🟡) + link "Xem đơn hàng"; nằm trong app shell nên sidebar vẫn dùng được |
| `(tong-quan)/_ui/dashboard.tsx` | `StudioDashboardView({ tenant, data, metric })` — chỉ trình bày, nhận `TenantDashboard` qua prop; từ lần 4 `metric` chỉ truyền xuống làm giá trị đầu cho `RevenueChartSwitcher` (`RangeBar` không còn nhận `metric`) |
| `(tong-quan)/_ui/revenue-chart-switcher.tsx` (lần 4, chưa commit) | **Client**: `RevenueChartSwitcher({ titleId, unit, hasFuture, initialMetric, points })` — tiêu đề `h2` + đơn vị + `MetricToggle` "Gộp/Thực nhận" + `TrendChart` cột. `points` = `RevenueChartPoint { key, tick, label, future?, grossVnd: number, netVnd: number }` — cả hai chuỗi gửi sẵn, client chỉ chọn. Pattern §19.8 |
| `(tong-quan)/_ui/dashboard-format.ts` | Thuần: `parseStudioChartMetric` (`gop` mặc định \| `thuc-nhan`), `dashboardHref` (bỏ giá trị mặc định khỏi query), định dạng ngày giờ VN, `GRANULARITY_UNIT`, `formatRating`, `formatPercent` |
| `admin/_ui/date-range-picker.tsx` (chuyển từ `(tong-quan)/_ui/` theo "Bổ sung ADR-046"; file đã có trong commit `dd349b9` ✅ `git log`) + wrapper `(tong-quan)/_ui/dashboard-range-picker.tsx` | Client: `DashboardDateRangePicker({ activeKey, displayFrom, displayTo, today, hrefForPreset?, hrefForCustom?, formMode? })` dùng chung; dashboard gọi `StudioDashboardRangePicker({ slug, … })` dựng link bằng `dashboardHref` (giữ `?chi-so=`) — §19.5. Từ lần 4 **bỏ prop `metric`**: wrapper đọc `chi-so` từ URL hiện tại bằng `useSearchParams` (vì toggle đổi URL ở client, giá trị server render có thể đã cũ) |
| `admin/_ui/stats-chart.tsx` | Component thống kê dùng chung `/admin` + Studio (§19.4) |

### 19.2. Thứ tự khối

1. **Header** `AdminPageHeader`: tên gian hàng, phụ đề `/{slug} · trạng thái: {status}` (giá trị enum thô — nhãn tiếng Việt ở BACKLOG), "Cập nhật
   lúc … giờ Việt Nam".
2. **Việc cần xử lý** (chỉ hiện khi có): khối yêu cầu hoàn tiền ADR-039 (giữ), rồi danh sách đánh giá chưa trả lời (→ `/reviews?status=VISIBLE`),
   tài liệu bị khoá kiểm duyệt (→ `/products`), đơn chờ thanh toán (→ `/orders?status=PENDING`).
3. **Gian hàng chưa có đơn nào** (`latestOrders` rỗng) → thay mục 4–8 bằng **checklist 3 bước** (khung nét đứt): Thêm tài liệu đầu tiên (xong khi
   có ≥ 1 tài liệu) · Xuất bản tài liệu (xong khi có tài liệu Công khai) · Chia sẻ trang bán hàng (link `/{slug}` tab mới, có chữ ẩn "(mở tab
   mới)").
4. **Kỳ thống kê** (từ lần 3): một hàng `flex-wrap` — trái `h2` "Kỳ thống kê: {label}" + "So với {prevLabel}" (bỏ chữ "(cùng độ dài)" vì 3 mốc
   "… trước" so trọn kỳ); phải ô **date range picker** (§19.5). URL sai → `Notice tone="warning"` báo đang hiện kỳ mặc định (giữ). *Trước lần 3:*
   `<nav>` 8 chip link + `<details>` "Tuỳ chọn" chứa `next/form` GET 2 ô `type="date"` — **đã bỏ** ✅ `git diff`.
5. **Bán hàng**: ghi chú "Đơn có thời điểm khách trả tiền trong kỳ. Không tính tài liệu miễn phí (đơn 0 đ)…"; lưới 4 `KpiCard` có icon tròn —
   **Doanh thu (gộp)** (note "Tính cả đơn sau này hoàn tiền — cùng cách tính của System Center."), **Doanh thu thực nhận**, **Đơn đã thanh toán**,
   **Giá trị đơn trung bình**; dải 3 chỉ số phụ: **Đã hoàn tiền** (xu hướng đảo màu — `higherIsBetter=false`), **Tài liệu khác nhau đã bán**, **Lượt
   nhận tài liệu miễn phí** (`IconGift`).
6. **Biểu đồ** (`id="bieu-do-doanh-thu"`, `xl:col-span-2`): tiêu đề "{Doanh thu gộp|thực nhận} theo {giờ|ngày|tuần|tháng}"; công tắc
   `?chi-so=gop|thuc-nhan` — từ lần 4 là `MetricToggle` client (`role="group"` "Chọn cách tính doanh thu trên biểu đồ", nút `aria-pressed`, đổi tức
   thì, §19.8; *trước:* link GET `aria-current` + `scroll={false}` + neo — đã bỏ); `TrendChart` **cột** doanh thu, rồi `TrendChart` **đường** màu accent cho số đơn
   (`h-28`) — biểu đồ đường **không** đổi theo toggle; cột tương lai để trống + chú thích; `<details>` "Xem bảng số liệu theo …" (chevron từ lần 4, §19.6) — bảng 4 cột (Thời gian, Doanh thu gộp, Thực nhận, Đơn),
   mới → cũ, bỏ bucket tương lai, `caption` ẩn, `th scope`, khung `relative max-h-96 overflow-auto` (`min-w-[28rem]`, trang không cuộn ngang).
   **Top 5 bán chạy** cạnh biểu đồ: phụ đề "{kỳ} · theo số đơn, không tính đơn đã hoàn tiền, gồm lượt nhận miễn phí"; mỗi dòng link tới trang
   tài liệu trong Studio, chữ ẩn "Hạng n", "{n} đơn · {doanh thu} · đã bán từ trước tới nay {soldCount}"; rỗng → "Chưa có tài liệu nào được mua
   trong kỳ này."
7. **10 đơn hàng mới nhất**: `DataTable` 4 cột **Mã đơn** (link chi tiết đơn) · **Khách hàng** (họ tên hoặc "Khách") · **Đơn giá** (ẩn dưới `sm`) ·
   **Thành tiền**; link "Xem tất cả đơn". **Không có email** (ADR-043 mục 3). Từ lần 4 cột Thành tiền của đơn 0 đ hiện **"0 đ"** (`formatVndFull`; trước
   là "Miễn phí"; cột Đơn giá vốn đã là số) — trang Đơn hàng Studio (§20) vẫn ghi "Miễn phí".
8. **Ba thẻ nhóm** (`md` 2 cột, `xl` 3 cột), mỗi thẻ có link tới trang quản lý tương ứng: **Khách hàng** (khách mới + xu hướng, người mua trong kỳ,
   tỷ lệ quay lại) · **Đánh giá** (điểm TB `IconStarSolid`, phân bố 1–5 sao `<ul aria-label>`, đánh giá mới, chưa trả lời/đang ẩn "hiện tại", bị
   ẩn trong kỳ, bị khoá nếu > 0) · **Tài liệu** (4 ô trạng thái Công khai/Nháp/Lưu trữ/Bị khoá kiểm duyệt — ô khoá cảnh báo khi > 0, lượt tải
   trong kỳ, top đánh giá).

### 19.3. A11y / responsive (theo code)

- Mọi `section` có `aria-labelledby` → tiêu đề; biểu đồ `role="img"` + `aria-label` tóm tắt (khoảng thời gian, giá trị cao nhất) + bảng thay thế;
  % thay đổi luôn có mũi tên + chữ "Tăng/Giảm" (không chỉ màu); chỉ số ảnh chụp ghi "hiện tại", luỹ kế ghi "từ trước tới nay".
- Vùng chạm `min-h-11` dưới `lg`; focus `focus-visible:outline-2` màu primary. Từ lần 3 **chọn kỳ cần JS** (picker client); từ lần 4 **đổi chỉ số
  `?chi-so=` cũng cần JS** (nút client — trước là link GET); không JS thì chỉ đổi được bằng cách gõ URL `?ky=`/`?tu=`/`?den=`/`?chi-so=`.
- App shell fluid theo sidebar (ADR-024/042), padding `px-5 lg:px-8`.

### 19.4. `admin/_ui/stats-chart.tsx` — API dùng chung

Không hook, không tự truy vấn — từ lần 4 được import cả trong Client Component (`sales-daily-chart.tsx`, `revenue-chart-switcher.tsx`), nên mọi
export phải giữ "không hook, không I/O" để dùng được hai phía. Màu từ `brandColors` + thang xám Tailwind.

| Export | Ghi chú |
| :-- | :-- |
| `STAT_INK`, `STAT_INK_SOFT`, `STAT_CARD_CLASS` | Màu chữ + class khung thẻ (`min-w-0 rounded-2xl border border-gray-200 bg-white`) |
| `MoneyLike = bigint \| number \| string`, `toBigIntSafe`, `formatCount`, `formatVndFull` ("1.234.567 đ") | Định dạng không qua float; quy tắc dùng §19.6. `formatVndAxis` (lần 3, đổi tên từ `formatVndCompact`) **đã xoá ở lần 4** ✅ `grep` không còn chỗ dùng trong `apps/web` |
| `statValueSizeClass(value, level?: "primary" \| "secondary")` (lần 3) | Class cỡ chữ theo độ dài chuỗi số — §19.6 |
| `computeChange(cur, prev) → Change` | BigInt, 1 chữ số thập phân; `prev` = 0 hoặc `null` → `{ kind: "none" }` |
| `ChangeLine({ change, compareLabel, higherIsBetter? })` | "— chưa có số liệu kỳ trước…" / "Không đổi so với …" / mũi tên + "Tăng/Giảm x%" + "so với …"; `higherIsBetter=false` đảo màu |
| `StatIcon({ icon, tone?, size? })` | Icon tròn `aria-hidden`, tone `primary`/`accent`/`secondary` |
| `KpiCard({ label, value, detail?, note?, change?, compareLabel?, higherIsBetter?, icon?, iconTone? })` | `compareLabel` mặc định "30 ngày trước"; không có `change` → không dòng xu hướng |
| `TrendPoint { key, tick, label, value: bigint, future? }`, `TrendChart({ points, variant?: "bar" \| "line", metricName, formatAxis, formatFull, emptyText, color?, heightClass?, integerScale?, showTick? })` | Cột HTML hoặc đường SVG trong khung `aria-hidden`; khối `role="img"` có tóm tắt; nhãn trục X thưa mặc định ~5 nhãn neo điểm đầu. Cột nhãn trục Y (lần 4): `max-w-[5.5rem] min-w-8 leading-tight` dưới `sm`, `sm:max-w-none sm:whitespace-nowrap` từ `sm` — §19.6 |
| `RatioBar({ ratio, color?, label? })` | Thanh tỉ lệ `aria-hidden` (phân bố sao) |

### 19.5. Pattern: Date range picker (`DashboardDateRangePicker`, "Bổ sung ADR-043 lần 3") ✅ đọc code

File dùng chung `admin/_ui/date-range-picker.tsx` (client; từ "Bổ sung ADR-046" — trước nằm ở `(tong-quan)/_ui/`). Dùng ở Tổng quan Studio (wrapper `StudioDashboardRangePicker`) và trang Đơn hàng (`formMode`, §20.4); dùng lại được cho màn hình
thống kê khác nếu Quốc giao.

* **Nguồn dữ liệu:** không tự tính kỳ — ngày hiển thị/tô lấy từ `range.displayFrom/displayTo` (server, giờ VN), "hôm nay" là prop `today`
  (`YYYY-MM-DD` giờ VN từ `generatedAt`). Lịch chỉ làm phép tính ngày dương lịch thuần (UTC, không múi giờ).
* **Ô mở:** nút bo tròn `min-h-11`, `IconCalendar` + chữ `dd/mm/yyyy - dd/mm/yyyy` (`tabular-nums`) + `IconChevronDown`; `aria-haspopup="dialog"`,
  `aria-expanded`, `aria-controls`; chữ ẩn "Kỳ thống kê {nhãn mốc}, từ …". Cạnh ô có vùng `role="status"` "Đang tải số liệu…" khi đang chuyển
  trang (`useTransition`).
* **Popup:** `<dialog>` mở bằng `showModal()` (bẫy focus, Esc đóng, nền inert), bấm nền đóng, đóng xong trả focus về ô mở. Bố cục theo độ rộng
  (theo `matchMedia`, đổi được khi đang mở):
  - **≥ xl (1280px)**: popover neo dưới ô, **2 tháng** cạnh nhau;
  - **768–1279px (md → < xl)**: popover neo dưới ô, **1 tháng**;
  - **< 768px**: **sheet đáy** (`range-picker-sheet`, bo góc trên, `max-h-[92dvh]`), 1 tháng, có tiêu đề "Chọn kỳ thống kê" + nút Đóng 44px; mốc
    xếp lưới 3 cột.
  Popover tự né mép màn hình (cách mép 16px), tính lại khi đổi kích thước; ẩn (`visibility: hidden`) tới khi định vị xong.
* **Cột mốc (trái):** `<nav aria-label="Mốc thời gian">`, 11 mốc là **`Link` `?ky=<key>`** (giữ `chi-so`, `prefetch={false}`, `scroll={false}`;
  bấm → đóng dialog rồi `router.push` trong transition) + nút "Tuỳ chọn" (đưa focus vào lịch). Mục đang chọn `aria-current="true"`, nền primary chữ
  trắng; focus đầu tiên khi mở = mục đang chọn (hoặc ô ngày nếu đang ở Tuỳ chọn).
* **Lịch:** `<table role="grid">` 6 hàng × (cột **W** = số tuần ISO-8601 + 7 ngày), **Thứ Hai đầu tuần** (T2…CN, `abbr` tên đầy đủ); tiêu đề tháng
  ẩn cho trình đọc màn hình; tháng đầu có **select Tháng + select Năm** (lùi **10 năm**, `YEARS_BACK`), nút tháng trước/sau; **không** duyệt qua
  tháng tương lai (option tháng tương lai `disabled`). Ngày thuộc tháng khác hiện mờ, không tương tác. **Ngày tương lai** `aria-disabled` + chữ
  xám **gạch ngang** (không chỉ dựa vào màu). Hôm nay `aria-current="date"` + chấm accent. Mỗi ô có `aria-label` đầy đủ ("Thứ Hai, 5 tháng 10 năm
  2026, ngày bắt đầu khoảng chọn…").
* **Tô khoảng không chỉ màu:** hai đầu khoảng nền primary chữ đậm; dải giữa nền `surface` + **viền trên/dưới** primary (nét liền khi đã chọn xong,
  **nét đứt** khi đang xem trước sau lần bấm đầu); đầu xem trước còn lại viền nét đứt.
* **Bàn phím** (roving tabindex): mũi tên ±1 ngày/±1 tuần, Home/End đầu/cuối tuần, PageUp/PageDown ±1 tháng, **Shift+PageUp/PageDown ±1 năm**,
  Enter/Space chọn, Esc đóng; focus bị kẹp trong [10 năm trước, hôm nay].
* **Chọn khoảng:** bấm ngày đầu rồi ngày cuối (bấm ngày trước ngày đầu → tự đảo). Chân popup: tóm tắt `aria-live="polite"` ("Từ … — chọn ngày kết
  thúc" / "Đã chọn … - … (N ngày)"), nút Huỷ / **Áp dụng**. Quá **366 ngày** (`DASHBOARD_CUSTOM_MAX_DAYS`) → thông báo `role="alert"` + nút Áp dụng
  `disabled` (`aria-describedby` trỏ lỗi). Áp dụng → `?ky=tuy-chon&tu=YYYY-MM-DD&den=YYYY-MM-DD` (giữ `chi-so`); khoảng không đổi → chỉ đóng.
  Server vẫn kiểm lại (§19.2 mục 4).
* **CSS** (`globals.css`, khối `.range-picker`): `html:has(dialog.range-picker[open])` khoá cuộn trang nền; `dialog.range-picker-sheet[open]` trượt
  lên 200ms, tắt dưới `prefers-reduced-motion`.
* **Cần JS** — không có phương án form GET dự phòng (URL gõ tay vẫn chạy). Quốc chấp nhận 2026-10-18 (app shell vốn cần JS).

### 19.6. Quy tắc hiển thị số tiền/số đếm (lần 3, lần 4) ✅ đọc code

* **Số đầy đủ, không rút gọn** theo `vi-VN` (vd `993.000 đ`) — `formatVndFull` — cho: thẻ KPI, dòng phụ, top 5, bảng số liệu, tooltip/`title` cột,
  dòng "Cao nhất". Áp cho **cả** Studio và `/admin` (component chung `stats-chart.tsx`): `sales-stats.tsx` (thẻ GMV, top 5 gian hàng, bảng) và thẻ
  "Doanh thu gói dịch vụ" 6 tháng trong `admin/page.tsx` (`title` cột + "Tổng 6 tháng"; trước dùng hàm nội bộ `formatVndCompact` kiểu "1,2Tr đ"/"35K đ"
  — đã xoá) ✅ `git diff` (Long đọc lại sau khi Phong báo xong, 2026-10-18). Thẻ này không có trục Y.
* **Nhãn trục Y** — từ "Bổ sung ADR-043 lần 4" cũng **số đầy đủ** (`formatVndFull`, vd `993.000 đ`), **không** rút gọn "nghìn/triệu/tỷ"; áp Studio
  + `/admin`. Cột nhãn **co theo nhãn dài nhất** (bỏ độ rộng cố định `w-16 sm:w-20`): dưới `sm` giới hạn `max-w-[5.5rem]` — số rất lớn **xuống dòng ở
  khoảng trắng trước "đ"** (`leading-tight`); từ `sm` không giới hạn, `whitespace-nowrap`. Trục số đơn vẫn "{n} đơn". *Lần 3:* chỉ trục Y rút gọn
  bằng `formatVndAxis` (cột 64–80px) — **hàm đã xoá** ✅ `git diff`.
* **Chevron `<details>` bảng số liệu** (lần 4, Studio + `/admin`): `<details class="group">`, `summary` `list-none` + `[&::-webkit-details-marker]:hidden`
  (ẩn marker mặc định), `justify-between`; `IconChevronDown` (`h-4 w-4 shrink-0`, `aria-hidden` sẵn) bên phải, xoay `group-open:rotate-180`,
  hiệu ứng `motion-safe:transition-transform` (không chuyển động khi `prefers-reduced-motion`). Trạng thái mở/đóng vẫn do `<details>` gốc báo cho
  trình đọc màn hình.
* Vì đã bỏ rút gọn, thẻ không còn dòng phụ "số đầy đủ" (Studio: Doanh thu gộp/thực nhận/giá trị TB bỏ `detail`; "Đã hoàn tiền" chỉ còn "{n} đơn").
* **Cỡ chữ theo độ dài** — `statValueSizeClass(value, level)`: `primary` ≤ 12 ký tự `text-2xl`, ≤ 15 `text-xl`, dài hơn `text-lg`; `secondary` ≤ 13
  `text-lg`, dài hơn `text-base`. Nơi gọi vẫn kèm `[overflow-wrap:anywhere]` làm lưới an toàn (khoảng trắng trước "đ" là chỗ xuống dòng ưu
  tiên); số trong danh sách bọc `whitespace-nowrap`.

### 19.7. Việc còn mở (BACKLOG)

* Nhãn tiếng Việt cho `tenant.status` ở phụ đề header.
* Trang Đánh giá chưa có bộ lọc "chưa trả lời" (link từ "Việc cần xử lý" chỉ lọc `VISIBLE`).
* Chưa kiểm phiên OWNER thật, `/admin` sau refactor + đổi số đầy đủ, trình đọc màn hình ❓ (picker: bàn phím đã kiểm bằng Playwright 🟡).
* Lần 4 chưa kiểm trình duyệt ❓: toggle đổi tức thì + URL `?chi-so=` sau `replaceState`, back/forward, picker giữ đúng `chi-so` sau khi bấm
  toggle, trục Y số dài ở 360px (xuống dòng trước "đ"), chevron xoay.

### 19.8. Pattern: Toggle chỉ số phía client giữ URL (`useUrlMetric` + `MetricToggle`, "Bổ sung ADR-043 lần 4") ✅ đọc code

File `admin/_ui/metric-toggle.tsx` (**client**, working tree chưa commit). Thay pattern "link GET `?chi-so=`" cũ ở §16.4 và §19.2 mục 6. Dùng khi
**dữ liệu mọi chỉ số đã có sẵn trong props** (chỉ đổi cách vẽ) — không dùng khi đổi chỉ số cần server tính lại.

* **`useUrlMetric<M>({ param, initial, defaultValue, parse }) → [metric, select]`**:
  - state khởi tạo bằng `initial` (giá trị server đã đọc từ `searchParams`);
  - `select(next)` → `setState` + `window.history.replaceState(null, "", url)` với `param` = `next`; `next === defaultValue` thì **xoá** param khỏi
    query (giữ quy ước bỏ giá trị mặc định). Không điều hướng, không cuộn, không gọi lại server, không thêm mục history;
  - **đồng bộ ngược:** đọc `useSearchParams().get(param)` qua `parse`; khi khác giá trị đã đồng bộ lần trước (back/forward, điều hướng mềm, hoặc
    router nhận `replaceState`) thì cập nhật state **ngay trong render** (không `useEffect`). Comment code ghi "Next tích hợp `replaceState` với
    router" 🟡 — chưa kiểm trình duyệt ❓.
* **`MetricToggle<M>({ label, options, value, onChange })`**: `div role="group" aria-label={label}` chứa các `<button type="button" aria-pressed>`;
  Tab đi qua từng nút, Enter/Space chọn; bấm nút đang chọn không làm gì. Nút `min-h-11 min-w-14` dưới `lg` (`lg:min-h-9`), `touch-manipulation`,
  hover `bg-gray-100` ở nút chưa chọn; nút chọn nền `brandColors.primary` chữ trắng, nút khác chữ `brandColors.ink`; `transition-colors
  motion-reduce:transition-none`; focus `focus-visible:outline-2` màu primary.
* **Nơi dùng:** `SalesDailyChart` (`/admin`, `chi-so` = `gmv` mặc định | `don`, §16.4) và `RevenueChartSwitcher` (Studio, `gop` mặc định | `thuc-nhan`,
  §19.2 mục 6). Thành phần khác dựng link cần biết chỉ số hiện tại phải đọc **URL** (`useSearchParams`), không dùng prop server — vd
  `StudioDashboardRangePicker` (§19.1).
* **Đánh đổi:** cần JS (không còn phương án không-JS ngoài gõ URL); dữ liệu mọi chuỗi gửi xuống client (Studio: cả gộp + thực nhận; `/admin`: GMV dạng
  chuỗi + số đơn).

---

## 20. Trang Đơn Hàng Studio — Danh Sách + Chi Tiết (ADR-046, ADR-047) ✅

Quyết định: [[01-Architecture-Decisions/ADR-031-Studio-Orders-List-Detail-Upgrade|ADR-031 (≙ ADR-046)]], [[01-Architecture-Decisions/ADR-032-Studio-Orders-Unaccent-Search-Internal-Notes|ADR-032 (≙ ADR-047 — ghi chú nội bộ, §20.8)]]; nghiệp vụ:
[[02-System-Specs/Studio-Orders-Specs|Studio-Orders-Specs]]; contract: [[03-API-Contracts/Endpoint-Directory|Endpoint-Directory]] §23. Phong làm UI, Hiếu
làm dữ liệu theo brief của Quốc; Long đọc code working tree 2026-10-18 (nay **đã commit** `dd349b9` (deploy ❓) ✅ `git log`). Kiểm: lint/typecheck/build đạt (Quốc chạy
2026-10-18) 🟡. **Chưa** xem UI thật với phiên OWNER, chưa trình đọc màn hình ❓.

### 20.1. File

| File | Vai trò |
| :-- | :-- |
| `studio/[tenantSlug]/orders/page.tsx` | Server Component: guard OWNER → `listOrdersPage` → `RefundRequestNotice`, `OrderFilterBar`, `OrderList`. Trong app shell (layout đã có `<main>`) nên bọc `<div>` |
| `orders/_ui/order-list.tsx` | Thanh lọc, Notice hoàn tiền, bảng/thẻ, tiêu đề cột sắp xếp, phân trang |
| `orders/_ui/order-filter-form.tsx` (client) | `OrderFilterForm` — `<form method="get" role="search">`; có JS thì bỏ ô rỗng + giá trị mặc định (`sap-xep=moi-nhat`, `so-dong=20`) rồi `router.push` (URL gọn); không JS gửi form thường |
| `orders/_ui/order-row-actions.tsx` (client) | Menu "Thao tác" mỗi dòng + hộp xác nhận |
| `orders/_ui/order-detail-parts.tsx` | `DetailCard`, `InfoList`, `DateTimeValue`, `OrderItemsTable`, `CustomerHistoryCard`, `OrderNotesCard` (ADR-047), `OrderTimeline` |
| `orders/_ui/order-format.ts` | Nhãn/tone trạng thái, nhãn sắp xếp, nhãn cổng, `paymentChannelText`, `formatOrderPrice` (giá/tổng của một đơn hoặc một dòng; 0 → "Miễn phí") và `formatOrderVnd` (số tổng hợp — Lịch sử khách, giảm giá, giao dịch; 0 → "0 đ"), ngày/giờ VN, `orderDetailHref`/`orderListBackHref` |
| `orders/_ui/order-skeleton.tsx`, `orders/loading.tsx`, `orders/[orderId]/loading.tsx` | Khung chờ cùng bố cục trang thật; `aria-busy`, `role="status"` ẩn, `animate-pulse motion-reduce:animate-none` |
| `orders/error.tsx` (client) | Lỗi chung cho danh sách + chi tiết: `role="alert"`, mã tham chiếu `digest`, không hiện `error.message`, nút thử lại (`retry`) |
| `orders/[orderId]/page.tsx`, `order-status-actions.tsx`, `entitlement-actions.tsx`, `confirm-form.tsx` | Chi tiết + thao tác 2 bước (action cũ, không đổi) |
| `orders/[orderId]/order-note-actions.tsx` (client, ADR-047) | `AddOrderNoteForm` (thêm ghi chú) + `DeleteOrderNoteButton` (xoá 2 bước) — §20.8 |

### 20.2. Danh sách `/studio/{slug}/orders`

1. **Notice yêu cầu hoàn tiền** (`Notice tone="warning"`, ADR-039): "N đơn có yêu cầu hoàn tiền đang chờ…, trong đó M đơn đã quá hạn 7 ngày" +
   link "Xem các đơn này" (`?remedy=REFUND_REQUESTED`); ẩn khi không có, hoặc khi đang xem đúng bộ lọc đó mà không có đơn quá hạn.
2. **Thanh lọc** (khung trắng bo 2xl): ô **Tìm đơn hàng** (`type="search"`, placeholder "Mã đơn, họ tên hoặc email khách", `maxLength=100`; từ ADR-047 khớp **không dấu** ở server — UI không đổi) + nút
   **Lọc** + **Xoá lọc** (chỉ khi có điều kiện). Hàng dropdown: **Trạng thái** (mỗi lựa chọn kèm số đếm, vd "Chờ thanh toán (3)"; "Tất cả trạng
   thái (N)"), **Hoàn tiền** ("Có yêu cầu hoàn tiền (N)"), **Tài liệu** (chỉ tài liệu đã có đơn), **Ngày tạo đơn** (date range picker `formMode`,
   §20.4), **Sắp xếp** (chỉ dưới `xl`), **Số dòng mỗi trang** (10/20/50/100). Dòng chú thích "Đang áp dụng N điều kiện lọc." / "Đang xem mọi đơn
   hàng." + "Ngày giờ theo giờ Việt Nam". Form có `key` theo bộ lọc đã áp dụng để ô `defaultValue` dựng lại đúng sau điều hướng.
3. **Tiêu đề kết quả** "N đơn hàng (khớp bộ lọc)".
4. **Từ `xl`: `DataTable`** (có `caption` ẩn "Danh sách đơn hàng, N đơn…, trang x/y") 7 cột: **Mã đơn** (link mono, primary) · **Ngày tạo**
   (ngày + giờ, sắp xếp được) · **Khách hàng** (họ tên đậm hoặc "Chưa có họ tên" nghiêng + email nhỏ) · **Tài liệu** (`line-clamp-2`, `title` đủ) ·
   **Tổng tiền** (căn phải, sắp xếp được) · **Trạng thái** (`Badge` + `RefundRequestBadge` khi có yêu cầu hoàn tiền) · cột Thao tác (tiêu đề
   `sr-only`). **Dưới `xl`: danh sách thẻ** (`md` 2 cột) — mã + ngày giờ + nút menu, khách, tài liệu, chân thẻ trạng thái + tổng; không cuộn ngang
   ở 360px. Sidebar Studio chiếm chỗ ở `lg` nên bảng chỉ từ `xl`.
5. **Sắp xếp bằng tiêu đề cột** (`SortHeader`): link GET (`scroll={false}`), icon mũi tên lên/xuống/cặp mờ, chữ `sr-only` ", bấm để sắp xếp tăng/giảm
   dần"; bấm cột đang giảm → tăng, còn lại → giảm trước. `<th aria-sort>` qua prop mới `headAriaSort` (§20.5).
6. **Trạng thái rỗng** (`EmptyState`): 3 biến thể — chưa có đơn / không khớp bộ lọc (+ nút "Xem tất cả đơn hàng") / không có yêu cầu hoàn tiền.
7. **Phân trang** `LinkPagination pageParam="trang" unit="đơn"`, giữ bộ lọc.

### 20.3. Menu "Thao tác" của dòng (`OrderRowActions`)

* Dùng `RowMenu` + `MenuItemLink`/`MenuItemButton` có sẵn (`admin/_ui/row-menu`). Mục theo `allowedActions`: **Xem chi tiết** (luôn có) ·
  **Xác nhận thanh toán** → link tới chi tiết `#order-actions` (cần ghi chú nên không làm tại danh sách) · **Đánh dấu đã hoàn tiền** · **Huỷ đơn**
  (tone `danger`, sau separator).
* Hoàn tiền / Huỷ mở **`<dialog>` xác nhận** (`showModal()` — bẫy focus, Esc đóng) nằm **ngoài** menu (menu tự đóng khi bấm); focus mặc định vào nút
  an toàn ("Giữ đơn"/"Thôi"); đóng xong trả focus về nút mở menu; lỗi action hiện `role="alert"`. Gọi thẳng `cancelOrderAction` /
  `markOrderRefundedAction` (tự kiểm quyền, revalidate). Câu chữ hoàn tiền nói rõ hệ thống **không tự chuyển tiền** và quyền tải sẽ bị thu hồi.
* Link "Xem" mang `?back=<query danh sách>` (§20.6).

### 20.4. Date range picker ở chế độ form (`DashboardDateRangePicker formMode`)

* Prop mới `formMode?: { label, dialogTitle, allowAll? }` (file dùng chung `admin/_ui/date-range-picker.tsx`, §19.5): **không tự điều
  hướng** — chọn mốc / "Áp dụng" khoảng ghi vào 3 input ẩn `ky`/`tu`/`den` rồi `requestSubmit()` form chứa ô (giữ các ô lọc khác đang nhập). Ô rỗng bị
  `disabled` để không rơi `?ky=` thừa vào URL.
* `allowAll` thêm mốc **"Mọi thời gian"** (`activeKey = null`, không gửi `ky`) — mặc định của trang Đơn hàng. `activeKey` nay nhận `null`.
* Kỳ vẫn do server giải (`resolveDashboardRange`); picker **cần JS** (như dashboard).
* Không có `formMode` thì picker điều hướng bằng `hrefForPreset(key)` / `hrefForCustom(tu, den)` do nơi gọi truyền (dashboard: wrapper client `StudioDashboardRangePicker`, vì hàm không truyền được từ Server Component). Trang Đơn hàng import thẳng từ `admin/_ui/` ("Bổ sung ADR-046").

### 20.5. Kit — thay đổi dùng chung

* **`DataTable.head`** đổi từ `string[]` sang **`ReactNode[]`** (cột sắp xếp truyền phần tử link); `key` của `<th>` đổi sang chỉ số cột.
* **`DataTable.headAriaSort?`** — mảng `"ascending" | "descending" | "none" | undefined` theo cột → `aria-sort` trên `<th>`.
* **`LinkPagination.pageParam?`** (mặc định `"page"`) — tên tham số số trang; trang Đơn hàng dùng `trang`.
* Dashboard Tổng quan: thẻ "Đơn chờ xác nhận" link `?trang-thai=PENDING` (trước `?status=PENDING` — loader vẫn nhận alias).

### 20.6. Chi tiết `/studio/{slug}/orders/{orderId}`

* Đầu trang: link **"← Danh sách đơn hàng"** về đúng bộ lọc/trang qua `?back=` — `orderListBackHref` chỉ giữ khoá lọc đã biết, ghép vào đường dẫn
  danh sách cố định (không open redirect). Tiêu đề `h1` "Đơn hàng #{mã}" (mono) + dòng "Tạo lúc … · tổng tiền"; bên phải badge trạng thái +
  `RefundRequestBadge` khi có yêu cầu hoàn tiền.
* **`MainAsideGrid`** (2 cột từ `xl`, `asideLabel="Thao tác và lịch sử đơn"`; dưới `xl` cột phụ xuống dưới):
  - Cột chính: **Thông tin chung** (mã, ngày tạo/thanh toán giờ VN, trạng thái, kênh thanh toán, khách họ tên + email) · **Tài liệu trong đơn**
    (`OrderItemsTable`: đơn giá, giảm giá/mã, thành tiền; khối quyền tải **theo từng dòng** — lượt đã dùng/giới hạn, **Cấp thêm lượt** (ô "Số lượt" có
    nhãn thật; ẩn khi có remedy), **Thu hồi quyền tải** 2 bước (focus "Thôi"), remedy ADR-039 `OrderItemRemedy`)
    · **Giao dịch thanh toán** (khi có; badge khớp/không khớp/sai số tiền).
  - Cột phụ: **Thao tác đơn** (`id="order-actions"`, `scroll-mt-6`) — chỉ thao tác trong `allowedActions`: xác nhận thanh toán (form ghi chú), đánh dấu
    đã hoàn, huỷ; huỷ/hoàn là **2 bước** (`TwoStepAction`: bấm → khung xác nhận mở ngay dưới, focus vào "Thôi", "Thôi"/Esc đóng và trả focus; không
    `window.confirm`) · **Lịch sử khách hàng** (Đơn đã thanh toán, Tổng chi tiêu, "Đã hoàn −x đ" khi > 0, Giá trị đơn trung bình; chú thích "Chỉ tính
    đơn trả phí (> 0 đ) … Tổng chi tiêu gồm cả đơn đã hoàn tiền sau đó") · **Ghi chú nội bộ** (ADR-047, §20.8) · **Lịch sử đơn** (`<ol aria-label="Sự kiện của đơn, mới nhất trước">`, mốc
    tròn có icon theo loại, đường nối dọc `aria-hidden`; rỗng → "Chưa có sự kiện nào.").
* `DetailCard` = `<section aria-labelledby>` với icon trong ô `surface`.

### 20.7. Việc còn mở (BACKLOG)

* Chưa xem UI thật với phiên OWNER, chưa thử tenant chéo, nhánh timeline audit/email chưa có dữ liệu thật, chưa trình đọc màn hình ❓.
* ~~Tìm đơn không dấu~~ — xong ở ADR-047 (server). ~~Ghi chú nội bộ~~ — xong ở ADR-047 (§20.8).
* **Không làm** (ADR-047 mục 3): thao tác hàng loạt (chọn nhiều dòng), nút xuất CSV đơn/khách — không thêm checkbox chọn dòng hay nút "Xuất".

### 20.8. Ghi chú nội bộ trên chi tiết đơn (ADR-047) ✅ đọc code

* **Thẻ `OrderNotesCard`** ("Ghi chú nội bộ", `id="order-notes"`, icon `IconNote` — mới trong `admin/_ui/icons.tsx`) nằm ở cột phụ **giữa** "Lịch sử
  khách hàng" và "Lịch sử đơn". Chứa `AddOrderNoteForm` + dòng đếm "N ghi chú — xem trong “Lịch sử đơn” bên dưới." / "Chưa có ghi chú nào…".
  `notesAvailable = false` → chỉ `Notice tone="warning"` "Ghi chú nội bộ tạm chưa sẵn sàng. Vui lòng thử lại sau.", không hiện form.
* **`AddOrderNoteForm`** (`useActionState` → `addOrderNoteAction`): `<label>` thật "Nội dung ghi chú" + gợi ý "Chỉ gian hàng thấy — khách không bao giờ
  thấy."; `<textarea name="body" required rows=3 maxLength={ORDER_NOTE_MAX_LENGTH_UI}>` (hằng UI = 1000, bản sao `ORDER_NOTE_MAX_LENGTH` ở lib —
  `orders/_ui/order-format.ts`); bộ đếm "x/1.000" (chữ `sr-only` "Đã nhập … ký tự", đổi màu khi ≥ 90%); **Ctrl/⌘+Enter** gửi; đang gửi → `readOnly` +
  nút "Đang thêm..."; lỗi `role="alert"` + `aria-invalid` + viền đỏ; thành công xoá ô + `role="status"` ẩn "Đã thêm ghi chú."; sau gửi trả focus về ô.
  Nút "Thêm ghi chú" full-width, màu `brandColors.primary`.
* **Trong "Lịch sử đơn"**: sự kiện kind `note`, icon `IconNote`, **tông `neutral`** mới (`#F3F4F6` / `#4B5563`); nhãn "Ghi chú nội bộ · {họ tên ?? email}"
  (`orderNoteAuthorText` — tác giả null → **"Tài khoản đã xoá"**); nội dung trong khung viền xám nhạt, `whitespace-pre-wrap`, render text (không HTML).
* **`DeleteOrderNoteButton`** — chỉ render khi `canDelete` (tác giả): nút chữ đỏ "Xoá" (`aria-label` "Xoá ghi chú lúc {giờ}", `aria-expanded`,
  `min-h-11` dưới `lg`) → khung xác nhận ngay dưới "Xoá ghi chú lúc …? Thao tác không hoàn tác được." với "Thôi" (focus mặc định, Esc đóng, trả focus
  về nút) / "Xoá ghi chú"; lỗi `role="alert"`. Không `window.confirm`.
* Không có nút sửa ghi chú (ghi chú bất biến).

---

## 21. Trang Khách Hàng Studio + Mẫu Trang Danh Sách Studio Dùng Chung (ADR-048) ✅ đọc code

Quyết định: [[01-Architecture-Decisions/ADR-033-Studio-Customers-List-Upgrade|ADR-033 (≙ ADR-048)]]; nghiệp vụ:
[[02-System-Specs/Studio-Customers-Specs|Studio-Customers-Specs]]; contract: [[03-API-Contracts/Endpoint-Directory|Endpoint-Directory]] §24. Phong làm UI, Hiếu
làm dữ liệu theo brief của Quốc; Long đọc code working tree 2026-10-23 (nay **đã commit** `dd349b9` (deploy ❓) ✅ `git log`). Kiểm: lint/typecheck/build đạt (Quốc
2026-10-19) 🟡. **Chưa** kiểm UI thật với phiên OWNER, chưa trình đọc màn hình ❓.

### 21.1. Mẫu trang danh sách Studio (dùng chung Đơn hàng §20 ↔ Khách hàng)

Trang danh sách dữ liệu mới trong Studio theo cùng khung (đã áp ở Đơn hàng và Khách hàng):

1. `AdminPageHeader` (tiêu đề + phụ đề) — trang nằm trong app shell nên bọc `<div className="px-5 py-8 lg:px-8">`, không `<main>`.
2. (Tuỳ trang) dải `KpiCard` (`admin/_ui/stats-chart.tsx`, số đầy đủ `formatVndFull`/`formatCount`, có `note` định nghĩa) + dòng nêu **phạm vi** số liệu.
3. Form lọc **`OrderFilterForm`** (GET, `role="search"`, `aria-label` = prop `label`; có JS thì bỏ ô rỗng + giá trị `defaults` rồi `router.push`) — ô tìm
   `type="search"` `maxLength=100` + nút **Lọc** + **Xoá lọc** (khi có điều kiện); hàng dropdown có số đếm; date range picker `formMode` + `allowAll`;
   "Sắp xếp" chỉ dưới `xl` (từ `xl` đổi bằng tiêu đề cột); "Số dòng mỗi trang"; dòng chú thích "Đang áp dụng N điều kiện lọc." Form `key` theo bộ lọc đã áp.
4. Tiêu đề kết quả "N … (khớp bộ lọc)". **Từ `xl`: `DataTable`** (`caption` ẩn, `headAriaSort`); **dưới `xl`: thẻ** (`md` 2 cột, không cuộn ngang 360px).
5. Cột sắp xếp = `SortHeader` (link GET `scroll={false}`, chữ `sr-only`). Menu **Thao tác** mỗi dòng = `RowMenu` (`admin/_ui/row-menu`); hộp thoại là
   `<dialog>` + `showModal()` nằm **ngoài** menu, đóng xong trả focus về nút menu.
6. `EmptyState` 2 biến thể (chưa có dữ liệu / không khớp bộ lọc + nút "Xem tất cả"), `LinkPagination pageParam="trang"`.
7. `loading.tsx` (skeleton cùng bố cục, `animate-pulse motion-reduce:animate-none`) + `error.tsx` (`role="alert"`, mã `digest`, không `error.message`, nút thử lại).

**`OrderFilterForm.label`** (prop mới, mặc định `"Lọc đơn hàng"`) — tên vùng tìm kiếm cho trình đọc màn hình; trang Khách hàng truyền `"Lọc khách hàng"`.
Form vẫn nằm ở `orders/_ui/order-filter-form.tsx` (trang Khách hàng import chéo) — chưa chuyển về thư mục dùng chung.

### 21.2. File

| File | Vai trò |
| :-- | :-- |
| `studio/[tenantSlug]/customers/page.tsx` | Server Component: guard OWNER → `listCustomersPage` → `CustomerStatsStrip`, `CustomerFilterBar`, `CustomerList`; bind `saveCustomerNoteAction` với `tenantSlug` |
| `customers/_ui/customer-list.tsx` | Thẻ thống kê, thanh lọc, bảng/thẻ, `SortHeader`, phân trang |
| `customers/_ui/customer-row-actions.tsx` (client) | Menu Thao tác + hộp ghi chú |
| `customers/_ui/customer-format.ts` | Nhãn nhóm/mốc ngày/sắp xếp, `customerOrdersHref`, `customerDisplayName` (họ tên → email), `formatRate` ("62,5%"), `countActiveCustomerFilters` — file thuần, chỉ `import type` từ loader |
| `customers/_ui/customer-skeleton.tsx`, `customers/loading.tsx`, `customers/error.tsx` | Khung chờ / lỗi theo §21.1 |

### 21.3. Trang `/studio/{slug}/customers`

* **5 `KpiCard`** (lưới 1 → `sm` 2 → `xl` 3 → `2xl` 5 cột): **Tổng khách** (dòng phụ "+N khách mới · {kỳ}") · **Khách quay lại** ("x% số khách trả phí") ·
  **Tổng chi tiêu** ("Đã hoàn: …") · **Chi tiêu TB / khách trả phí** ("—" khi chưa có) · **Khách chỉ nhận miễn phí**. Trên dải: dòng phạm vi — có kỳ thì "Khách có
  {mua lần đầu/mua gần nhất} trong {kỳ}…", không kỳ thì "Toàn bộ khách của gian hàng — không áp ô tìm, nhóm và tài liệu."
* **Thanh lọc:** Tìm khách hàng (placeholder "Họ tên hoặc email (gõ không dấu cũng được)") · **Nhóm khách** (6 lựa chọn kèm số đếm; gợi ý "Khách mới = mua lần
  đầu trong …") · **Khoảng ngày** (picker `formMode` "Khoảng ngày mua", có "Mọi thời gian") · **Ngày tính theo** (Mua lần đầu / Mua gần nhất) · **Đã mua tài
  liệu** · Sắp xếp (dưới `xl`) · Số dòng. Chú thích: số đơn/chi tiêu là luỹ kế, chỉ đơn trả phí; đơn 0 đ ghi riêng là "miễn phí"; giờ Việt Nam.
* **Bảng (từ `xl`) 7 cột:** **Khách** (họ tên đậm hoặc email; email nhỏ; "Ghi chú: …" 1 dòng `truncate` + `title`; badge **chữ** `warning` "Có yêu cầu hoàn
  tiền", `neutral` "Lâu chưa quay lại") · **Số đơn** (sắp xếp; "+N miễn phí") · **Tổng chi tiêu** (sắp xếp, đậm, phải) · **Đã hoàn** ("—" + `sr-only` "Chưa hoàn"
  khi 0) · **Mua lần đầu** (sắp xếp) · **Mua gần nhất** (sắp xếp, mặc định) · Thao tác (`sr-only`). Mọi cột sắp xếp chỉ chiều **giảm**; `aria-sort` =
  `"descending"` ở cột đang chọn, `"none"` ở cột sắp xếp được khác. **Thẻ (dưới `xl`)**: khối khách + menu, `<dl>` 5 số liệu.
* **Menu Thao tác** (`RowMenu size="touch"`, nhãn "Thao tác khách {tên}"): **Xem đơn của khách** → `/studio/{slug}/orders?khach=<userId>` · **Thêm ghi chú… / Sửa
  ghi chú…**.
* **Hộp ghi chú** (`<dialog aria-labelledby>`, rộng `min(32rem, 100vw − 2rem)`): tiêu đề "Ghi chú về {tên}", `<label>` thật, `<textarea name="note" rows=5
  maxLength=500 autoFocus>`, gợi ý "Chỉ gian hàng thấy — khách không đọc được. Để trống rồi Lưu để xoá ghi chú.", bộ đếm "x/500 ký tự" (đổi màu khi còn ≤ 20),
  lỗi `role="alert"` + `aria-invalid`; nút "Huỷ" / "Lưu ghi chú" ("Đang lưu..."); lưu thành công tự đóng (trang revalidate); lỗi lần trước không hiện lại
  khi mở lại.

### 21.4. Trang Đơn hàng — lọc theo khách

* Có `?khach=` hợp lệ: khung trên cùng của form lọc "Đang xem đơn của khách **{họ tên ?? email}** · {email}" + ô ẩn `khach` (giữ khi lọc tiếp) + link **"Bỏ lọc
  khách"** (`min-h-11` dưới `lg`). `BACK_KEYS` (`orders/_ui/order-format.ts`) thêm `khach` để "← Danh sách đơn hàng" ở chi tiết quay về đúng bộ lọc.

### 21.5. Việc còn mở

* Kiểm UI thật với phiên OWNER (menu, hộp ghi chú, mobile), trình đọc màn hình ❓ — `docs/BACKLOG.md` "Phát sinh trong đợt ADR-048".
* Không thêm nút "Xuất CSV" / chọn nhiều dòng (ADR-047 mục 3).

---

## 22. Trang Văn Bản Pháp Lý `/phap-ly/[slug]` + Form Đăng Ký (ADR-050) ✅ đọc code 2026-10-23 (chưa commit)

> Nguồn: báo cáo UI của Phong qua brief Quốc + "Bổ sung ADR-050 lần 2" (`docs/DECISIONS.md`). Nghiệp vụ: [[02-System-Specs/Legal-Documents-Specs|Legal-Documents-Specs]].
>
> **Cập nhật ADR-054 (2026-10-24) ✅ đọc code:** trang chuyển sang URL cấp gốc — component dùng chung `app/_ui/legal-document-page.tsx`, TOC ở
> `app/_ui/legal-toc.ts` (thư mục `app/phap-ly/[slug]/_ui/` và `page.tsx` cũ đã xoá; `/phap-ly/[slug]` chỉ còn `route.ts` redirect 308). Bố cục §22.1–§22.3
> giữ nguyên theo comment component. Form đăng ký thêm link "Chính sách bảo mật" (cụm "chính sách xử lý dữ liệu cá nhân" thành link khi có bản hiệu
> lực); form mở gian hàng có checkbox Chính sách người bán; editor `/admin/cms/phap-ly` có bộ chọn văn bản + khung "Mô tả & SEO" ở mức **tối thiểu**
> (comment `page.tsx`: Phong hoàn thiện sau) — chưa có báo cáo UI của Phong cho các phần này 🟡.

### 22.1. Bố cục

* `container-page` + lưới `lg:grid-cols-[220px_minmax(0,768px)] lg:justify-center` (cột đọc = độ rộng `container-prose`) — **hợp ADR-024**: khung
  trang vẫn là utility chuẩn, chỉ cột nội dung giới hạn độ rộng đọc; **không** thêm `container-doc` ("Bổ sung ADR-050 lần 2"). Không có mục lục →
  lưới một cột `minmax(0,768px)`.
* **Mục lục dựng từ H2:** `lg+` là cột trái 220px, `<nav aria-labelledby="muc-luc">` **dính** `sticky top-[112px]` (header 88px + 24px, §1.1), cuộn riêng
  khi dài; dưới `lg` là `<details>` đóng sẵn ngay dưới dòng meta.
* Meta: "Phiên bản n.0 · Có hiệu lực từ dd/mm/yyyy" (giờ VN).

### 22.2. `buildLegalToc` (`app/_ui/legal-toc.ts` — trước ADR-054 ở `app/phap-ly/[slug]/_ui/legal-toc.ts`)

* Đọc HTML **đã sanitize** (sau đó mới thay `{brand}`), **hạ mọi `<h1>` trong nội dung xuống `<h2>`** (trang chỉ có một H1 là tiêu đề văn bản), gắn `id`
  slug không dấu cho từng `<h2>` (chống trùng bằng hậu tố, rỗng → `muc-n`; id chỉ `[a-z0-9-]` nên chèn HTML an toàn), trả danh sách mục cho TOC (nhãn
  dạng text, React escape).

### 22.3. Nội dung và in

* Class nội dung `.gieochu-legal-content` (`globals.css`: nhịp H2, đoạn, danh sách).
* **In:** `@media print` ẩn `.site-header`, `.site-footer`, `.no-print` (mục lục) khi trang có `.legal-doc`.

### 22.4. Form đăng ký

* Có bản Điều khoản đang hiệu lực → nhãn checkbox chấp thuận chứa link "Điều khoản sử dụng" tới `/dieu-khoan-su-dung` (ADR-054; trước đó `/phap-ly/…`), **mở tab mới**
  (`target="_blank"` + `rel="noopener noreferrer"` + chữ ẩn "(mở trong tab mới)"); chưa có → chữ cũ, không link ✅ `register-form.tsx`.

---

## 23. Phiên Đăng Nhập — Hộp Thoại Hết Phiên, Thẻ Thiết Bị, Checkbox "Ghi Nhớ" (ADR-053) ✅ đọc code 2026-10-24 (chưa commit)

Quyết định thiết kế của Phong (brief Quốc 2026-10-24), Long đối chiếu code working tree. Nghiệp vụ: [[02-System-Specs/Auth-Session-Specs|Auth-Session-Specs]] §5, §7.
Kiểm thật với trình đọc màn hình / trình duyệt thật ❓.

### 23.1. Hộp thoại cảnh báo hết phiên — `app/_ui/session-expiry-dialog.tsx`

* `SessionRefresh` mount `SessionExpiryDialog` khi còn `warningSeconds` trước hạn idle (thay hộp thoại tối thiểu trước đó).
* Khung `<dialog>` + `showModal()` (cùng mẫu `ConfirmDialog` của Thư viện): top layer, nền sau `inert`, nền mờ navy; `role="alertdialog"` + `aria-modal` +
  `aria-labelledby`/`aria-describedby`. Mở → focus "Tiếp tục phiên", bẫy Tab vòng; đóng → trả focus về phần tử trước đó.
* Đồng hồ `mm:ss` và thanh tiến trình **`aria-hidden`** (đổi mỗi giây). Trình đọc màn hình nghe mô tả lúc mở, rồi một vùng `role="status"` chỉ cập nhật ở
  mốc **60 giây** và **30 giây** (chỉ các mốc nhỏ hơn thời gian còn lại lúc mở).
* **Esc = "Tiếp tục phiên"** (chặn `cancel` gốc của `<dialog>`; trình duyệt vẫn tự đóng thì mở lại). **Không có nút X**; **bấm nền không đóng** — người
  dùng phải chọn một trong hai nút.
* Nút đang xử lý dùng **`aria-disabled`** (không `disabled` — giữ focus), chữ đổi "Đang gia hạn phiên…" / "Đang đăng xuất…"; "Tiếp tục" cho bấm lại sau
  5 giây nếu mạng chậm. Nút `min-h-11`, full-width trên mobile.
* Hiệu ứng mở fade + scale (`@starting-style`) tắt khi **`prefers-reduced-motion`** (`motion-reduce:transition-none`).
* Gốc có `data-idle-warning` để `SessionRefresh` bỏ qua thao tác bên trong hộp thoại.

### 23.2. Thẻ thiết bị — `app/account/security/_ui/session-cards.tsx`

* Dữ liệu chuẩn bị ở server (`session-list.tsx`): định dạng giờ `DISPLAY_TIME_ZONE`, loại thiết bị suy từ `deviceLabel` (iPad → máy tính bảng, iPhone/Android →
  điện thoại, còn lại → máy tính) — chỉ để chọn icon.
* Mỗi thẻ: icon loại thiết bị trong ô **44px** (kèm tên loại `sr-only`), nhãn "trình duyệt · hệ điều hành", badge **"Thiết bị này" tone `info`** và
  **"Ghi nhớ" tone `neutral`** (không dùng `success` — xem §23.5); viền thẻ hiện tại màu `primary`.
* `dl` lưới 2 cột: **Đăng nhập lúc** (tuyệt đối), **Hoạt động gần nhất** (tương đối: "vừa xong", "12 phút trước", "3 giờ trước", "hôm qua"…; **quá 7 ngày →
  ngày giờ tuyệt đối**; luôn kèm giờ tuyệt đối trong `title` + `sr-only`), **Địa chỉ IP** (khi có). `<time dateTime>` cho cả hai mốc.
* Nút "Đăng xuất" (viền đỏ, `aria-label` có tên thiết bị) mở **`ConfirmDialog`**; câu xác nhận khác nhau cho thiết bị hiện tại / thiết bị khác; lỗi hiện
  trong hộp thoại.
* **Thông báo kết quả đặt ở cấp danh sách** (`role="status"` chung) vì thẻ vừa đăng xuất bị xoá sau revalidate; chữ xanh `#15803D` trên `#F0FDF4` (~5:1).
* Chỉ còn một phiên → câu **"Chỉ có thiết bị này đang đăng nhập."** (thay câu cũ "Không có phiên đăng nhập nào khác").

### 23.3. Icon mới (`app/admin/_ui/icons.tsx`)

`IconMonitor`, `IconSmartphone`, `IconTablet` (thẻ thiết bị), `IconClock` (hộp thoại hết phiên) ✅.

### 23.4. Mẫu dòng phụ cho checkbox — "Ghi nhớ đăng nhập" ở `/login`

* `label` bao cả ô → vùng bấm cả dòng `min-h-11`; dòng phụ **"Không dùng trên máy dùng chung."** là `<p id>` gắn vào checkbox bằng **`aria-describedby`**,
  thụt lề (`pl-[26px]`) **thẳng hàng với chữ của nhãn**, cỡ `text-xs`, màu `inkSoft`. Dùng lại mẫu này cho checkbox có giải thích ngắn.

### 23.5. Vấn đề còn mở — contrast tone `success` của kit

`Badge tone="success"` và `FormBanner` thành công trong `admin/_ui/kit.tsx` (chữ `brandColors.secondary` trên nền xanh nhạt) chỉ đạt **~3:1** — chưa đủ
4.5:1 cho chữ thường 🟡 (số đo của Phong; Long chưa đo). Thẻ thiết bị đã tránh dùng. **Chưa sửa** — Quốc sẽ giao task riêng. Ghi ở
[[00-Index/KB-Audit-2026-09-26|KB-Audit]] §33 mục 12.

---

## 24. Hoá Đơn / Đơn Hàng Gói Ở System Center, Khối Chuyển Khoản, Ô Mã Giảm Giá (ADR-056) ✅ đọc code 2026-10-25 (chưa commit)

Long ghi theo code working tree (brief Quốc 2026-10-25 không kèm báo cáo thiết kế riêng của Phong — chi tiết dưới đây là những gì code đang làm). Nghiệp vụ:
[[02-System-Specs/Payment-And-Billing|Payment-And-Billing]] §5C–§5E, [[02-System-Specs/Order-State-Machine|Order-State-Machine]] §3.9. Kiểm với trình đọc màn hình /
thiết bị thật ❓.

### 24.1. Kit admin — thành phần mới (`app/admin/_ui/kit.tsx`)

* **`PillTabs({ label, items: { href, label, active }[] })`** — tab dạng pill điều hướng bằng link GET (không cần JS), bọc `<nav aria-label>`; tab đang chọn
  `aria-current="page"`, nền `brandColors.accent` + **chữ INK** (comment code: chữ trắng trên accent chỉ ≈3.2:1, chữ INK ≈5.4:1); cao 44px dưới `lg`, 36px từ `lg`.
* **`FilterSelect({ label, name, value, allLabel, options })`** — `<select>` có nhãn hiển thị (không chỉ placeholder), tuỳ chọn đầu = "tất cả" (bỏ lọc); chữ
  16px dưới `lg` (tránh iOS tự zoom), cao 44px dưới `lg`; `id = filter-<name>`.
* **`FilterBar({ action, label, hidden?, active, clearHref, children })`** — `<form method="get" aria-label>` gồm các `FilterSelect` + nút "Lọc" + link "Xoá bộ
  lọc" (chỉ khi đang lọc); input ẩn giữ tham số (`tab`, `pageSize`), bỏ `page`.
* Hằng `FOCUS_RING` (viền focus theo `var(--color-primary)`); **`GhostLinkButton`** đổi: `min-h-11` dưới `lg`, nền trắng, có focus ring.
* **`app/admin/_ui/billing-labels.ts`** — nhãn tiếng Việt + tông badge cho trạng thái hoá đơn/thuê bao, nhãn cổng, `formatAdminDateTime`/`formatAdminDate`
  (`DISPLAY_TIME_ZONE`). Badge luôn có chữ (không truyền nghĩa chỉ bằng màu).
* Icon mới (`app/admin/_ui/icons.tsx`): `IconCopy`, `IconDownload` ✅.

### 24.2. Trang `/admin/billing/invoices` và `/admin/subscriptions`

* Header `AdminPageHeader` → `PillTabs` (chỉ trang Hoá đơn) → `FilterBar` → dòng đếm `aria-live="polite"` ("Tổng: …" / "Khớp bộ lọc: …") → `DataTable` có
  `caption` → `Pagination`.
* Cột phụ ẩn dưới `md`/`lg` (`hidden md:table-cell`…); thông tin bị ẩn (gói, cổng) lặp lại dưới tên gian hàng ở mobile (`md:hidden`).
* Ô trống hiện `—` `aria-hidden` + chữ `sr-only` ("Chưa thu", "Không có", "Chưa có hoá đơn").
* `EmptyState` tách 2 trường hợp: không khớp bộ lọc (nút "Xoá bộ lọc") / chưa có dữ liệu; tab "Chờ đối soát" rỗng có nút "Xem tất cả hoá đơn".
* Trang Đơn hàng gói có nút phụ "Xem hoá đơn gói" (`/admin/billing/invoices?tab=tat-ca`).

### 24.3. Khối chuyển khoản `BankTransferPanel` (`app/_ui/bank-transfer-panel.tsx`) + ô mã giảm giá checkout

> **Từ ADR-062 (2026-10-27, chưa commit) ✅ đọc code:** phần QR + dòng sao chép tách thành component dùng chung **`TransferDetails`** (`app/_ui/transfer-details.tsx`, client)
> + module thuần **`transfer-rows.ts`** (kiểu `TransferRow { key, label, srName, display, detail?, copyValue, mono?, note? }`, `bankTransferRows`, `walletTransferRows`,
> `defaultContentNote`) — dùng được ở cả Server Component (trang checkout) lẫn Client Component (`BankTransferPanel`, `WalletTransferPanel`). Prop **`order`**:
> `"info-first"` (mặc định — Studio billing giữ thứ tự cũ bên dưới) hoặc `"qr-first"` (trang checkout của khách, ADR-062 Q10: QR 224px luôn trước + "Số tiền cần chuyển" lớn
> + "Tải ảnh QR"). **MoMo ở Studio billing** (`WalletTransferPanel`): bỏ dòng "Ví", thêm nút **"Tải ảnh QR"** (dùng `TransferDetails`) — **từ Bổ sung ADR-059 lần 4 (2026-10-27) MoMo không còn QR** nên ảnh QR và nút này không hiện (`qr: null`); câu dẫn của panel vẫn nhắc QR (KB-Audit §47); dòng còn lại: Số điện thoại MoMo, Tên
> chủ ví, Số tiền, Nội dung chuyển khoản. Mô tả dưới đây là hành vi `info-first`.

* **Thứ tự:** dưới `sm` khối thông tin + nút sao chép đứng **trước** ảnh QR (trên điện thoại không quét được QR của chính máy mình), câu dẫn riêng cho mobile;
  từ `sm` ảnh QR lên trước. Container query: khung ≥ 32rem (`@lg`) thì QR (12rem) và thông tin đặt cạnh nhau.
* Ảnh QR 192px, `alt` "Mã QR chuyển khoản cho {đơn hàng|hoá đơn} {mã}". Nút **"Tải ảnh QR"** là `<a download>` (không `fetch` — CSP), viền/chữ màu primary,
  `min-h-11`.
* `dl` từng dòng: nhãn `dt` + giá trị `select-all` (chạm giữ để chọn tay) + nút "Sao chép" `min-h-11`, `aria-label` "Sao chép {tên dòng}", đổi thành "Đã chép"
  + icon check trong 2,5 giây. Dòng **Nội dung chuyển khoản** nền `accentSoft` + câu nhắc nhập đúng nguyên văn (nút sao chép trỏ `aria-describedby` vào câu này).
* **Một** vùng `role="status"` `aria-live="polite"` (`sr-only`) cho cả khối đọc "Đã sao chép …" / lỗi clipboard (hướng dẫn chép tay).
* **Ô mã giảm giá** (`app/[tenantSlug]/checkout/[orderCode]/coupon-panel.tsx`): nhãn "Mã giảm giá" hiển thị, input `min-h-11` chữ 16px, `autoCapitalize="characters"`,
  gợi ý "Nhập mã trước khi chọn cách thanh toán. Nếu áp mã sau, mã QR và số tiền sẽ được cập nhật lại." (`aria-describedby`); lỗi `role="alert"` + `aria-invalid`;
  thành công `role="status"` "Đã áp/bỏ mã giảm giá. Đã cập nhật mã QR theo số tiền mới." khi đơn đã có QR. Lỗi không mang thông điệp (Next che ở production) → câu
  chung "…Vui lòng tải lại trang và thử lại.".
* **Nút gỡ mã** (khi đơn đã áp mã): chữ **"Bỏ áp dụng"**, đang xử lý **"Đang bỏ áp dụng..."** (nút `disabled`); `aria-label` "Bỏ áp dụng mã giảm giá {mã}" /
  "Đang bỏ áp dụng mã giảm giá"; kiểu link đỏ gạch chân, `min-h-11` ✅ đọc code (quyết định của Phong qua brief Quốc 2026-10-25 — thay chữ cũ "Bỏ mã").

---

## 25. Điều Hướng Nhóm Trang (`ModuleTabs`), Tab Nội Bộ (`InPageTabs`), Accordion (`CollapsibleSection`), Giữ Dữ Liệu Khi Lưu Lỗi, Cảnh Báo Rời Trang (ADR-058 GĐ 0 + GĐ 1 + GĐ 2) ✅ đọc code 2026-10-25 — đã commit (GĐ 0–1 `c8e1b2f`, GĐ 2 `fa29d99`)

Quyết định: [[01-Architecture-Decisions/ADR-043-Module-Tabs-Accordion-Unsaved-Guard|ADR-043 KB (≙ ADR-058, gồm "Bổ sung ADR-058")]]. Kế hoạch
(Phong, có đánh dấu trạng thái từng task): `docs/ke-hoach-toi-uu-layout-tab-accordion-2026-10-25.md`. Tiến độ:
* **GĐ 0 xong** task **0.1–0.4** (component + guard + trường `match` + KB).
* **GĐ 1 (System Center) xong, trừ 1.10** — 1.1, 1.2, 1.2b, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.8b, 1.9, 1.11, 1.12a, 1.12b, 1.13, **1.14** (metadata/câu SEO/sắc badge),
  **1.15** (8 trang bỏ `SettingsGrid`) (Quốc báo code xong + verify 2026-10-25; code đã commit `c8e1b2f`/`fa29d99` ✅ `git log`). **1.10 (Lưu trữ file) tạm hoãn —
  chờ Vương xong ADR-055** — là task **duy nhất** còn lại của toàn kế hoạch.
* **GĐ 2 (Studio) xong hết, không task nào hoãn** — 2.1, 2.2, 2.3a, 2.3b, 2.4, 2.5 (kết luận không accordion), 2.6 (Quốc báo xong 2026-10-25; ✅ đọc code working tree).
* Quy tắc **full width** cho System Center + Studio (chủ dự án chốt 2026-10-25) — §5.
* `pnpm test:count` = **100/66** ✅ (Long chạy 2026-10-25, sau GĐ 2). Chỉ lớp trình bày: không migration, URL không đổi 🟡 (kế hoạch/brief). Ngoại lệ phía server
  duy nhất: Quốc thêm `revalidatePath` vào `updateBrandingAction` (Studio) ✅ đọc code — xem §25.7.
* **Chưa thử trên trình duyệt** (Quốc báo): hộp hỏi rời trang, giữ dữ liệu khi lưu lỗi, phím mũi tên tab, accordion mở/đóng, 375px, trình đọc màn hình ❓.

### 25.1. Quy tắc chọn pattern (kế hoạch §4 — đã chốt ADR-058)

| Tình huống | Dùng |
| :-- | :-- |
| Các **trang** cùng chức năng, URL riêng, lưu riêng | `ModuleTabs` (`nav` + link `aria-current="page"`, không phím mũi tên) |
| Bộ lọc/góc nhìn của **cùng một danh sách** | `PillTabs` (link GET, §24.1) |
| Nhiều khung trong một màn, không đổi URL, phải giữ state (vd SMTP, Thương hiệu) | `InPageTabs` — tab ARIA thật (`tablist`/`tab`/`tabpanel`, ←/→, Home/End), panel luôn mounted (§25.6) |
| Trang/form có **nhiều khối** hoặc có khối tuỳ chọn | `CollapsibleSection`: khối đầu mở, các khối khác thu gọn. **SEO luôn thu gọn** |
| Danh sách section có thứ tự, ẩn/hiện, sắp xếp | Giữ list-detail (§13.3) |
| Nội dung đọc (FAQ, xem thêm, chi tiết log) | `<details>` gốc |
| Trang ngắn (≤ 2 khối, không có khối tuỳ chọn) | **Không** accordion |

Ràng buộc:
* Tab ngang chỉ gom **trang con cùng một chức năng** (cùng đối tượng/loại cấu hình, người dùng hay chuyển qua lại). **Không dropdown.** URL giữ nguyên.
  Mỗi nhóm tab chỉ còn **một** mục trên sidebar (mục đó dùng `match`, §25.5). Sidebar = cấp chức năng, `ModuleTabs` = cấp phần con; không breadcrumb.
* Tối đa 2 tầng tab trên một màn và hai tầng phải khác kiểu. Không lồng accordion.
* **Card chứa nút hành động chính (Lưu/Xuất bản) không thu gọn** và không tính là "khối đầu tiên". Lỗi ở khối thu gọn thì khối tự mở.
* Trang thanh toán: cổng **đang bật thì mở**, cổng tắt thu gọn (`defaultOpen={enabled}`).
* h1 của trang có tab = **tên nhóm** (giống nhau ở mọi tab); tên trang con là phần đầu subtitle ✅ (Trang CMS, Cấu hình chung, Cài đặt Studio). `metadata.title` riêng
  theo tab: System Center đã khai cho 5 trang tab (task 1.14, §12.6) ✅ grep; 2 trang tab **Cài đặt Studio chưa khai** ✅ grep (KB-Audit §40).
* Không áp accordion khi không có lợi: **Cửa hàng** (editor list-detail chỉ hiện 1 section; section dài nhất là Hero ~9 ô, mọi ô chữ bắt buộc, không có SEO/nhóm tuỳ
  chọn — thu gọn nhóm bắt buộc trái quy tắc), **Cloudinary** (1 khối), **Báo cáo vi phạm** (trang xử lý, không phải form cấu hình), **Trang bán hàng Studio**
  (list-detail chỉ hiện 1 section, section dài nhất ~8–10 điều khiển; "Đánh giá ghim"/"Tài liệu nổi bật" đổi hành vi hiển thị nên không giấu) 🟡 kế hoạch task 1.5/1.12b/2.5.
  SEO của `/cua-hang` chưa có trong CMS — thuộc kế hoạch SEO tổng thể làm sau 🟡.
* **Full width** (chủ dự án chốt 2026-10-25): khối xếp 1 cột, không `max-w` ở khung form/editor — quy tắc đầy đủ ở §5.
* Studio áp cùng quy tắc; **không** làm trang tài khoản khách hàng `/account`.

### 25.2. `ModuleTabs` (`apps/web/app/admin/_ui/module-tabs.tsx`, client) ✅

```ts
type ModuleTabBadge = { count: number; srText: string; urgent?: boolean };
type ModuleTabItem = { href: string; label: string; badge?: ModuleTabBadge };
<ModuleTabs label="Các trang trong Trang CMS" items={[…]} current="/admin/cms/home" mobile="auto" />  // mobile: "auto" | "inline" | "disclosure"
```

* `current` = href tab đang xem, **trang tự truyền vào** (không đoán bằng `usePathname`). Phải trùng một `items[].href`.
* Markup `<nav aria-label={label}>` → `<ul>` → `next/link` với `aria-current="page"` ở tab đang xem. **Không** `role="tablist"` (tab là link điều hướng — WAI-APG),
  nên không có phím mũi tên; Tab/Shift+Tab đi qua từng link. **Không dropdown.**
* Tab đang chọn: nền `brandColors.primary` + chữ trắng + chữ đậm + vạch dưới 3px `brandColors.accent` (không chỉ dựa màu); tab khác chữ `#4B5563`, hover `gray-50`.
  Cao `min-h-11` (44px) dưới `lg`, `min-h-10` từ `lg`. Focus ring 2px `var(--color-primary)`. Khác `PillTabs` (pill nền accent, lọc trong trang).
* Badge tab: pill số (`99+` khi > 99) `aria-hidden` + `srText` `sr-only`; `urgent` → nền `#B91C1C` + icon cảnh báo; `count ≤ 0` không hiện.
* **Mobile (< `md`)**: `mobile="auto"` → nhóm **≤ 2 tab** hiện thẳng (xuống dòng nếu chật), nhóm **≥ 3 tab** thành nút disclosure **"Đang xem: {tab} (i/n)"**
  (`<button aria-expanded aria-controls>`, ≥ 44px) mở danh sách link dọc (mỗi dòng ≥ 44px, tab đang xem có icon check). Esc đóng + trả focus về nút; bấm ra ngoài
  hoặc chọn link thì đóng. `"inline"`/`"disclosure"` ép một kiểu. Không dải tab cuộn ngang, không sticky.
* Mọi link gắn `onNavigate={useLeaveGuard()}` (§25.4).

### 25.3. `CollapsibleSection` kiểu section Rank Math (`apps/web/app/admin/_ui/collapsible-section.tsx`, client) ✅

Mẫu gốc: disclosure của `LegalMetaForm` (heading chứa `<button>`, không dùng `<summary>`). Một dòng tiêu đề (icon tuỳ chọn · tiêu đề + mô tả · badge · chevron),
cả dòng là `<button>` nằm trong `<h2>`/`<h3>`.

| Thuộc tính | Hành vi (theo code) |
| :-- | :-- |
| `id` (bắt buộc) | Slug ổn định, duy nhất trong trang; gắn lên `<section id>` (`scroll-mt-6`). `#id` trên URL → trình duyệt cuộn tới **và khối tự mở** (deep link, link từ tóm tắt lỗi) |
| `title`, `description?`, `icon?`, `headingLevel?` (`2` mặc định \| `3`) | Heading chứa `<button aria-expanded aria-controls>`; chevron `aria-hidden` |
| `status?` (`SectionStatus \| SectionStatus[] \| null`) | Badge trạng thái **có chữ** + icon (lỗi/cảnh báo: tam giác; tốt: check; trống/`info`: không icon) — nền nhạt, chữ đậm. 5 tone: `success`/`danger`/`warning`/`neutral` dùng cặp màu cố định (màu trạng thái nghiệp vụ), **`info`** (từ task 1.6) cùng sắc `Badge tone="info"` của kit — nền `brandColors.surface`, chữ `brandColors.primary` (màu thương hiệu runtime). Nhận **mảng** để hiện nhiều badge (vd "Đã điền x/3" + "Có thay đổi chưa lưu"). Nhóm badge `flex-wrap`: thiếu chỗ (mobile, nhiều badge) thì xuống dòng dưới tiêu đề thay vì bóp tiêu đề. Badge nằm trong nút nên thuộc tên truy cập |
| `defaultOpen?` (`false`) | Khối đầu tiên của trang: `true`. SEO: luôn `false`. Cổng thanh toán: `defaultOpen={enabled}` |
| `open?` / `onOpenChange?` | Controlled tuỳ chọn |
| `errorCount?` | Chuyển 0 → > 0 thì **tự mở**; người dùng đóng lại thì giữ đóng tới lần lỗi mới. Badge lỗi vẫn do `status` hiển thị |
| `actions?` | Toggle/nút phụ đặt **cạnh** nút tiêu đề, không lồng control trong `<button>` |
| `syncHash?` (`false`) | Mở/đóng thì ghi/xoá `#id` bằng `history.replaceState` (không tạo mục lịch sử). Không `localStorage`, không query |
| `region?` (`true`) | Panel `role="region"` + `aria-labelledby` nút; tắt khi trang có > 6 khối |
| Panel | Đóng = thuộc tính `hidden`, **không unmount** — giữ state đang nhập, input trong `<form>` vẫn được gửi |
| Chuyển động | Chỉ xoay chevron (`motion-reduce:transition-none`); không animate height |

Helper:
* **`sectionStatus({ errorCount, warningCount, dirty, empty, emptyLabel = "Chưa điền", okLabel = "Tất cả đều tốt" })`** → `{ tone, label }`. Thứ tự ưu tiên:
  **"N lỗi"** (danger) → **"Có thay đổi"** (warning) → **"N cảnh báo"** (warning) → **"Chưa điền"** (neutral, chỉ khi `empty: true`) → **"Tất cả đều tốt"** (success).
* **`revealSection(id)`** — phát sự kiện cửa sổ; khối có `id` đó mở **đồng bộ** (`flushSync`) nên code gọi focus ô bên trong được ngay sau lệnh.

**Đã áp — task 1.2b** ✅ đọc code: editor trang chủ tự theo dõi "có thay đổi chưa lưu" phía client — `isDirty = sectionsDirty || seoDirty` (so với mốc đã nạp:
nháp nếu có, không thì bản live; mốc cập nhật sau Lưu nháp/Xuất bản/Khôi phục 🟡 theo kế hoạch) → `useUnsavedChanges` + badge ở thanh nút. Không đổi action.

**Đã áp — task 1.2** (Quốc duyệt 2026-10-25 ✅ đọc `admin/cms/home-editor/home-sections-editor.tsx`): khối **"SEO trang chủ"** là `CollapsibleSection id="seo"` (icon globe, thu gọn mặc định), badge từ `sectionStatus({ dirty: SEO khác bản đã lưu, warningCount: cảnh báo độ dài tiêu đề/mô tả + cảnh báo SEO, empty: cả hai ô trống, emptyLabel: "Dùng mặc định" })`. Nút **Lên / Xuống / Ẩn-Hiện** ở danh sách section dùng `ICON_BTN` `h-11 w-11` (44px) dưới `lg`, `h-9 w-9` từ `lg`, có `aria-label` ("Đưa {section} lên/xuống", "Ẩn/Hiện section {section}"); không còn hex `#D97706` ✅ grep.

**Đã áp — task 1.3** (Quốc duyệt 2026-10-25 ✅ đọc `admin/cms/menu/menu-editor.tsx`): editor **Header & Footer** chia 3 `CollapsibleSection` — **Menu đầu trang**
(`defaultOpen`, icon menu) · **Nút kêu gọi đầu trang** (thu gọn; badge `emptyLabel: "Đang ẩn"` khi nút ẩn, `okLabel: "Đang hiện"`) · **Chân trang** (thu gọn). Mỗi
khối có `status={sectionStatus({ errorCount, dirty })}` và `errorCount` riêng (khối có lỗi tự mở); id khối trong `MENU_BLOCK_IDS`. Khung tóm tắt lỗi gọi
`revealSection(MENU_BLOCK_IDS[khối chứa ô lỗi])` trước khi focus ô. Cờ chưa lưu qua `useUnsavedChanges` — **bỏ `beforeunload` riêng**.

**Bảng áp dụng GĐ 1 — khối và quy tắc mở mặc định theo từng trang** (✅ đọc code 2026-10-25, đã commit `c8e1b2f`; chưa thử trình duyệt ❓):

| Trang (file) | Task | Khối (id) — mặc định | Badge |
| :-- | :-: | :-- | :-- |
| Trang chủ (`cms/home-editor/home-sections-editor.tsx`) | 1.2, 1.2b, 1.14 | Danh sách section list-detail giữ nguyên; **SEO trang chủ** (`seo`) **luôn thu gọn** | SEO: lỗi/"Có thay đổi"/"N cảnh báo"/"Dùng mặc định" (trên). Thanh nút có badge "Có thay đổi chưa lưu" — từ 1.14 sắc `warning` (trước là `info`) |
| Header & Footer (`cms/menu/menu-editor.tsx`) | 1.3 | Menu đầu trang **mở** · Nút kêu gọi · Chân trang (thu gọn) | Trên |
| Bảng giá (`cms/pricing/_ui/pricing-sections-editor.tsx`) | 1.4 | List-detail giữ nguyên; **SEO trang Bảng giá** (`seo`) **luôn thu gọn** | `sectionStatus({ dirty, empty, emptyLabel: "Dùng mặc định" })` |
| Cửa hàng (`cms/shop/_ui/shop-sections-editor.tsx`) | 1.5 | **Không accordion** (lý do §25.1) — chỉ chuyển sang `useUnsavedChanges` | — |
| Chính sách sử dụng — Mô tả & SEO (`cms/phap-ly/legal-meta-form.tsx`) | 1.6 | **Tối ưu SEO** (`seo`) thu gọn khi tải — thay disclosure tự viết bằng `CollapsibleSection`, giữ hành vi ADR-057 | **Mảng** 2 badge: "Đã điền x/3" (`info`, hoặc `neutral` khi 0) + "Có thay đổi chưa lưu" (`warning`, khi dirty) |
| Cấu hình chung (`settings/general/general-settings-form.tsx`) | 1.9 | Bảo mật & phiên **mở** · Chính sách phiên đăng nhập · Nghiệp vụ (thu gọn) — §12.5 | `sectionStatus({ errorCount, dirty })` theo nhóm; nhóm lỗi tự mở |
| Cấu hình thanh toán (`billing/payment/{manual-qr,sepay,momo}-form.tsx`) | 1.11 | Chuyển khoản thủ công · SePay · MoMo — `defaultOpen={initial.isEnabled}` (**cổng đang bật thì mở**). Xếp 1 cột, full width (Quốc bỏ `max-w-5xl`, 2026-10-25) | `sectionStatus({ errorCount, dirty, empty: !isEnabled, emptyLabel: đã cấu hình ? "Đang tắt" : "Chưa cấu hình", okLabel: "Đang bật" })` |
| Gói dịch vụ (`plans/plan-form.tsx`, `create-plan-form.tsx`) | 1.12a | Thông tin gói (`goi-thong-tin`) **mở** · Giới hạn sử dụng (`goi-gioi-han`) · Gói Free & tính năng (`goi-tinh-nang`) thu gọn khi sửa; **trang tạo gói mở cả 3** (`expandAll` — giới hạn mặc định 0 = "không được phép", ẩn đi dễ tạo nhầm gói) | `sectionStatus({ dirty })` theo nhóm ô (`dirtyOf`) |
| Danh mục (`categories/category-form.tsx`) | 1.12a | Thông tin danh mục **mở** · Mô tả chi tiết · Hình ảnh · SEO (`seo`, luôn thu gọn) | "Có thay đổi"; trống: "Chưa có" / "Chưa có ảnh" / "Dùng mặc định" |
| Trang tuỳ chỉnh (`cms/cms-page-form.tsx`) | 1.12a | Nội dung trang (`trang-noi-dung`) **mở** · SEO (`seo`, thu gọn) | "Có thay đổi"; SEO trống: "Dùng mặc định" |
| Cloudinary (`settings/cloudinary/cloudinary-form.tsx`) | 1.12b | **Không accordion** (1 khối `ConfigCard`) | `Badge` kit: "Đang bật"/"Đang tắt", "Đã xác minh", "Có thay đổi chưa lưu" |

Quy ước cài đặt chung rút ra (✅ code): khối cổng thanh toán đặt **ngoài** `<form key>` để trạng thái mở và thông báo tự tắt (ADR-013) không mất khi form dựng
lại sau lần lưu; Toggle `isEnabled` nằm **trong** khối (không ở `actions`) để ô vẫn thuộc form có key. SEO luôn là khối cuối, không bao giờ `defaultOpen`.

**Badge "Có thay đổi chưa lưu"** ở thanh nút và khối: **một sắc chung `warning`** (task 1.14 System Center, 2.5 Trang bán hàng Studio) ✅ grep — mọi `Badge` mang chữ
này trong `admin/**`, `studio/**` đều `tone="warning"` (badge `neutral` "Chưa lưu · … mặc định" là trạng thái khác). Câu mô tả SEO trang chủ và Bảng giá (1.14):
"SEO không có bản nháp: bấm Lưu nháp hoặc Xuất bản đều ghi SEO và áp dụng ngay cho trang…" ✅ đọc JSX — hành vi lưu của action 🟡 (Quốc/Phong báo khớp; Long không
lần lại action).

**Bảng áp dụng GĐ 2 — Studio** (✅ đọc code 2026-10-25, đã commit `fa29d99`; chưa thử trình duyệt ❓):

| Trang (file) | Task | Khối — mặc định | Badge / ghi chú |
| :-- | :-: | :-- | :-- |
| Cài đặt — Thông tin & thương hiệu (`settings/page.tsx`, `branding-form.tsx`, `slug-form.tsx`) | 2.1 | Không accordion (trang 2 form) — `ModuleTabs` "Cài đặt" (§11.1) | `useFormDraft` + `useUnsavedChanges` cho cả 2 form. `branding-form` dùng **`keepOnSuccess`** (§25.7) |
| Onboarding mở gian hàng (`studio/page.tsx`, `studio/onboarding-form.tsx`) | 2.1 | Không accordion | `useFormDraft` + `useUnsavedChanges`; trang nằm **ngoài** layout Studio nên tự bọc `UnsavedChangesProvider` ngay trong page ✅ |
| Cài đặt — Thanh toán (`settings/payments/{manual-qr,sepay,momo}-form.tsx`, `page.tsx`) | 2.2 | QR thủ công · SePay · MoMo, mỗi cổng 1 khối, `defaultOpen={initial.isEnabled}` (**cổng đang bật thì mở**); xếp 1 cột | Như 1.11: "Đang bật"/"Đang tắt"/"Chưa cấu hình"/"1 lỗi"/"Có thay đổi". Khối ngoài `<form key>`; form có `key = JSON.stringify(initial)` để Toggle khớp DB khi cổng bị tự tắt; `secretNames`: SePay `secret`, MoMo `secretKey` (không ghi lại). Dòng cảnh báo tự tắt giữ nguyên |
| Editor tài liệu (`products/_ui/product-editor.tsx`, `editor-skeleton.tsx`) | 2.3a | Giữ bố cục 2 cột, **không thêm tab**. **Thông tin tài liệu** (`tai-lieu-thong-tin`, mở) · **Giá & khuyến mãi** (`tai-lieu-gia` — thu gọn khi Sửa, **mở sẵn ở trang Tạo** vì giá 0 = miễn phí) · **Danh mục & loại** · **Thẻ** · **Giới hạn lượt tải** · **Link chia sẻ private** (thu gọn). **Không thu gọn:** Ảnh đại diện, Tệp tài liệu, card Xuất bản | "N lỗi" > "Có thay đổi" > tóm tắt (giá "Miễn phí"/"50.000 ₫"; tên danh mục hoặc "Chưa chọn danh mục" `warning`). Tóm tắt lỗi mở đúng khối (`SECTION_FIELDS`). Cờ chưa lưu `dirty \|\| uploading`. Full width |
| Link chia sẻ (`products/[productId]/share-links/page.tsx`, `share-link-form.tsx`) | 2.3b | Không accordion | `useFormDraft` (mật khẩu link trong `secretNames` — không ghi lại) + badge + `useUnsavedChanges` (tắt khi đã tạo link). Nhóm chọn file là `fieldset/legend`, dòng ≥ 44px; `useFormDraft` hỗ trợ nhóm checkbox cùng tên. Bỏ `SettingsGrid`, bỏ `<main>` lồng |
| Editor bài viết (`posts/_ui/post-editor.tsx`) | 2.4 | **Nội dung bài viết** (mở) · **Tài liệu liên quan** · **Ghim bài** (thu gọn) | Tài liệu: "Đã gắn 1 tài liệu"/"Không gắn"; Ghim: "Đang ghim" (`info`)/"Không ghim"; "N lỗi"/"Có thay đổi" ưu tiên hơn tóm tắt. Card Xuất bản + chế độ xem bài bị ẩn không đổi; tóm tắt lỗi mở đúng khối |
| Trang bán hàng (`storefront/storefront-editor.tsx`, `page.tsx`) | 2.5 | **Không accordion** (lý do §25.1) | Badge "Có thay đổi chưa lưu" → `warning`; `useUnsavedChanges`; bỏ `<main>` lồng |
| Mã giảm giá (`coupons/coupon-form.tsx`, `page.tsx`, `new/page.tsx`, `[couponId]/page.tsx`) | 2.6 | **Thông tin mã giảm giá** (mở) · **Điều kiện & giới hạn lượt dùng** · **Thời gian áp dụng** · **Áp dụng cho sản phẩm** (thu gọn — cả ở trang Tạo, vì mọi ô thu gọn đều tuỳ chọn, trống = không giới hạn) | Tóm tắt từ `values` của `useFormDraft`: "Không giới hạn"/"Có điều kiện", "Áp dụng ngay, không hết hạn"/"Có thời hạn", "Tất cả sản phẩm"/"N sản phẩm"; "Có thay đổi" ưu tiên. Nhóm chọn sản phẩm `fieldset/legend`, dòng ≥ 44px. Bỏ `<main>` lồng (3 trang coupons + `messages`, `products`), bỏ import `SettingsGrid` |

**Lưu ý `changedFields` / `touchField` (2.3a, 2.4)** ✅ đọc code: hai editor tự quản `dirty` (không dùng `useFormDraft` — submit thủ công, §9.2). Để có badge theo khối,
editor giữ thêm tập `changedFields` (tên ô đã sửa từ lần lưu gần nhất), ghi qua `touchField(name)` (từ `onChange` của form và các ô tự quản như mô tả Tiptap, thẻ).
**`dirty` vẫn là nguồn sự thật** cho lưu, cảnh báo rời trang và tự lưu nháp (comment code: "lưu/tự lưu nháp dựa vào nó" — khi gắn hook tự lưu nháp
`useServerAutosave` của "Bổ sung ADR-053 lần 3" vào editor, phải dựa vào `dirty`, **không** dựa vào `changedFields`; hiện hook **chưa** gắn editor nào ✅ grep —
[[02-System-Specs/Editor-Autosave-Drafts-Specs|Editor-Autosave-Drafts-Specs]]); `changedFields` **chỉ** dùng cho badge
(`sectionDirty = dirty && khối có ô trong changedFields`) và **tự xoá khi `dirty` về false**, nên không phải sửa các chỗ `setDirty(false)`. Thêm ô mới vào editor:
khai tên ô vào `SECTION_FIELDS` của khối (để badge + tóm tắt lỗi mở đúng khối) và gọi `touchField` nếu ô tự quản state.

### 25.4. Cảnh báo rời trang khi chưa lưu (`apps/web/app/admin/_ui/unsaved-changes.tsx`, client) ✅

| API | Vai trò |
| :-- | :-- |
| `UnsavedChangesProvider` | Bọc ở `admin/layout.tsx`, `studio/[tenantSlug]/layout.tsx` và — từ task 2.1 — ngay trong `studio/page.tsx` (trang onboarding mở gian hàng nằm ngoài layout Studio) ✅. Giữ danh sách nguồn đang "dirty" trong ref (không render lại) và gắn **một** listener `beforeunload` (tải lại, đóng tab, gõ URL, link ngoài) |
| `useUnsavedChanges(dirty, message?)` | Editor/form đăng ký cờ chưa lưu; nhiều nguồn trên một trang được (vd nội dung + khối SEO lưu riêng); hết dirty hoặc unmount thì tự gỡ. Câu hỏi mặc định: "Trang đang có thay đổi chưa lưu. Rời trang và bỏ các thay đổi này?" (nhiều nguồn dirty → luôn câu mặc định) |
| `useLeaveGuard()` | Trả handler cho `onNavigate` của `next/link`: còn dirty → `window.confirm`; người dùng huỷ → `preventDefault()` chặn điều hướng client. Đồng ý thì không xoá cờ (editor unmount tự gỡ) |
| `GuardedLink` | `next/link` có sẵn guard, dùng được trong Server Component (layout) vì không nhận prop hàm |

* Đã gắn guard: mọi link `SidebarNav` (System Center + Studio), mọi link `ModuleTabs`, link "Về trang chủ" ở chân sidebar hai khu vực (`GuardedLink`).
  Link "Xem trang công khai" của Studio mở tab mới nên không cần.
* Đã áp thử: editor **Chính sách sử dụng** — `legal-editor.tsx` (nội dung) và `legal-meta-form.tsx` (Mô tả & SEO) gọi `useUnsavedChanges`; hàng chọn 7 văn bản
  dùng `useLeaveGuard` ✅ grep.
* Ctrl/Cmd+click (mở tab mới) không bị hỏi — `onNavigate` chỉ chạy với điều hướng SPA. Ngoài Provider (trang công khai) hook không làm gì.
* **Giới hạn:** không chặn được Back/Forward của trình duyệt (popstate) — App Router không có API chặn chính thức.
* **Đã áp `useUnsavedChanges` ở System Center (GĐ 1)** ✅ grep — mỗi form có câu hỏi riêng "{Tên} có thay đổi chưa lưu. Rời trang và bỏ thay đổi?":
  trang chủ (1.2b), Header & Footer (1.3), Bảng giá (1.4), Cửa hàng (1.5), Chính sách sử dụng — nội dung + Mô tả & SEO (0.2/1.6), SMTP (1.8b), Cấu hình chung (1.9),
  Email hỗ trợ (1.13), thanh toán ×3 (1.11), Gói dịch vụ, Danh mục, Trang tuỳ chỉnh (1.12a), Thương hiệu — Tên & Slogan + Màu sắc (1.12b), Cloudinary (1.12b).
  Không còn editor System Center nào tự gắn `beforeunload` (chỉ còn trong comment) ✅ grep.
* **Đã áp `useUnsavedChanges` ở Studio (GĐ 2)** ✅ grep — 11 file: Thông tin & thương hiệu + đổi đường dẫn (`branding-form`, `slug-form`), onboarding (2.1), thanh toán ×3
  (2.2), editor tài liệu — gồm cả lúc còn file đang tải (2.3a), Link chia sẻ — tắt khi đã tạo link (2.3b), editor bài viết (2.4), Trang bán hàng (2.5), mã giảm giá (2.6).
  3 editor trước đây tự gắn `beforeunload` (bài viết, tài liệu, Trang bán hàng) đã chuyển sang provider — nay bấm sidebar/tab cũng được hỏi lại.
* **Không còn `beforeunload` riêng** ở cả System Center lẫn Studio (chỉ còn trong comment và trong provider) ✅ grep. **Ngoại lệ duy nhất:** Lưu trữ file
  (`admin/settings/storage/*`, task 1.10 — chưa có cờ chưa lưu, chờ Vương).
* Thương hiệu: ảnh (logo/favicon/OG) lưu ngay khi chọn nên không cần cảnh báo 🟡 (comment code).

### 25.5. Trường `match` của mục sidebar (`apps/web/app/admin/_ui/nav-match.ts`) ✅

* `SidebarNavLeaf` thêm `match?: string[]` — đường dẫn khác cũng làm mục sáng (một mục sidebar đại diện cả nhóm tab).
* Luật (`navMatchLength(pathname, item, rootHref)`, `pickActiveHref(pathname, items, rootHref)`):
  * `href`: gốc khu vực (`/admin`, `/studio/{slug}`) chỉ khớp **đúng**; href khác khớp chính nó + trang con (`href/…`).
  * Chuỗi trong `match`: chuỗi thường = khớp tiền tố (chính nó + `…/con`); **`=` ở đầu** = chỉ khớp đúng đường dẫn đó (vd `"=/admin/settings"`, vì
    `/admin/settings` là tiền tố của mọi trang cấu hình).
  * Mục thắng = mục có mẫu khớp **dài nhất** trong toàn menu; bằng nhau → mục đứng trước; không mục nào khớp → không sáng.
* Ở mốc GĐ 0 **chưa mục nào dùng `match`** → active giống hệt trước (thay hàm `isMatch`/`activeHref` cũ trong `sidebar-nav.tsx`) ✅ đọc diff. Từ GĐ 1 có 2 mục dùng
  `match`: "Trang CMS" (task 1.1) và "Cấu hình chung" (task 1.7) — §12.6.

### 25.6. `InPageTabs` — tab nội bộ trong một trang (`apps/web/app/admin/_ui/in-page-tabs.tsx`, client) ✅ (task 1.8, 1.12b)

```ts
type InPageTab = { id: string; label: string; panel: ReactNode };
<InPageTabs label="Cấu hình Email (SMTP)" tabs={[…]} panelClassName="mt-6" />
```

* Tab ARIA thật: `role="tablist"` (`aria-label={label}`) → `<button role="tab" aria-selected aria-controls>`; panel `role="tabpanel"` + `aria-labelledby`, `tabIndex=0`.
  Roving tabindex (chỉ tab đang chọn `tabIndex=0`); **←/→** (vòng), **Home/End**, kích hoạt tự động khi di chuyển. Tab đầu là mặc định; state chỉ trong `useState`
  (không URL, không `localStorage`).
* **Mọi panel luôn mounted**, đóng bằng `hidden` — chuyển tab không mất dữ liệu đang nhập.
* Kiểu **pill** (nền `brandColors.accent` + chữ `brandColors.ink` khi chọn; trắng + viền `#E5E7EB` + chữ `#4B5563` khi không), `min-h-11` dưới `lg`, `min-h-9` từ `lg`,
  xuống dòng khi chật (`flex-wrap`), focus ring 2px `var(--color-primary)`. Khác `ModuleTabs` (link giữa các trang, phía trên) và `PillTabs` (link GET `?tab=`).
* Dùng ở: **SMTP** (`settings/smtp/smtp-tabs.tsx` — Cấu hình · Kiểm tra & Kích hoạt · Lịch sử gửi; nằm dưới `ModuleTabs` Cấu hình chung → 2 tầng tab khác kiểu) và
  **Nhận diện thương hiệu** (`settings/branding/branding-editor.tsx` — Logo & Icon · Favicon & OG · Tên & Slogan · Màu sắc · Xem trước; panel có viền, nền trắng).
* Chọn: khung cùng một màn, không đổi URL → `InPageTabs`; đổi URL (`?tab=`) → `PillTabs`.

### 25.7. Giữ dữ liệu khi lưu lỗi — `useFormDraft` (`apps/web/app/admin/_ui/use-form-draft.ts`, client hook) ✅ (task 1.8b, 1.11; mở rộng 2.1, 2.3b, 2.6)

Vấn đề (🟡 Phong/Quốc báo, khớp comment code): React 19 **reset ô không kiểm soát sau mọi lần form action chạy xong, kể cả khi action trả lỗi** → form
`useActionState` + `<form action>` + `defaultValue` mất dữ liệu đã gõ khi lưu lỗi.

```ts
const { dirty, dirtyOf, values, formProps } = useFormDraft({ names, secretNames, initial, resetKey, failed, keepOnSuccess });
<form key={resetKey} action={formAction} {...formProps}>…</form>
```

| Tham số / trả về | Hành vi (theo code ✅ đọc `use-form-draft.ts` 2026-10-25) |
| :-- | :-- |
| `names` | Ô được theo dõi **và ghi lại** sau khi lưu lỗi (input/select/textarea có `name`; checkbox đơn lưu boolean) |
| Nhóm checkbox cùng `name` (từ 2.3b) | `form.elements.namedItem(name)` trả `RadioNodeList` → lưu dạng chuỗi các `value` đang tích, nối bằng dấu phẩy; ghi lại thì tích đúng các ô có `value` trong tập. Giả định `value` là id cuid2 (không chứa dấu phẩy). Dùng ở chọn file (Link chia sẻ) và chọn sản phẩm (Mã giảm giá) |
| `secretNames?` | Ô bí mật (mật khẩu, secret, API key) — chỉ theo dõi "đang nhập" (khác rỗng = có thay đổi); **không bao giờ ghi lại** vào DOM, kể cả với `keepOnSuccess`. Để trống = giữ giá trị đã lưu |
| `initial` | Giá trị đã lưu, khớp `defaultValue`/`defaultChecked` của các ô `names` |
| `resetKey` | Đổi (vd form dựng lại theo dữ liệu server sau khi lưu thành công) → coi như sạch, `values` và mốc "đã lưu" theo `initial` mới |
| `failed` | Kết quả action hiện tại là lỗi (vd `Boolean(state.error)`). **Chỉ ghi lại khi lần lưu vừa rồi thất bại** — form tạo mới lưu thành công vẫn được làm trống |
| `keepOnSuccess?` (`false`, từ 2.1) | Dành cho action lưu thành công **không làm mới dữ liệu trang** (`initial` giữ giá trị cũ → React reset ô về giá trị cũ, trông như chưa lưu): ghi lại giá trị vừa gửi cả khi thành công và **lấy làm mốc "đã lưu" mới** (secret vẫn không ghi lại) |
| `formProps` | `onChange` (đọc lại giá trị), `onSubmit` (chụp giá trị `names`), `onReset` (tick sau: form còn trong DOM → `failed` thì ghi bản chụp; không lỗi + `keepOnSuccess` thì ghi bản chụp và đặt làm mốc) |
| `dirty` / `dirtyOf(names)` | "Có thay đổi" = ô `names` khác **mốc đã lưu** (mặc định `initial`) hoặc có ô bí mật đang nhập; `dirtyOf` cho badge từng khối |
| `values` (từ 2.6) | Giá trị hiện tại của các ô được theo dõi (đọc lại sau mỗi lần đổi) — dùng cho **badge tóm tắt khi khối thu gọn** (vd Mã giảm giá: "Có điều kiện", "N sản phẩm") |

* Đã áp ✅ grep — **System Center:** thanh toán ×3 (secret: SePay `secret`, MoMo `secretKey`), Gói dịch vụ, Danh mục, Trang tuỳ chỉnh, Thương hiệu (Tên & Slogan),
  Cloudinary (secret: `apiKey`, `apiSecret`), Email hỗ trợ. **Studio:** Thông tin & thương hiệu (`branding-form`, `keepOnSuccess`), đổi đường dẫn (`slug-form`),
  onboarding (2.1); thanh toán ×3 (2.2 — secret SePay `secret`, MoMo `secretKey`); Link chia sẻ (2.3b — secret `password`); Mã giảm giá (2.6 — dùng `values`).
  Secret vẫn chỉ hiển thị `••••abcd`. Cloudinary: form có `key` theo dữ liệu server để Toggle khớp trạng thái thật kể cả khi bị tự tắt; `lastVerifiedAt` không vào
  key nên bấm "Kiểm tra kết nối" không xoá dữ liệu đang gõ ✅ comment code.
* **`branding-form` + `revalidatePath`:** lúc làm 2.1, `updateBrandingAction` (`studio/[tenantSlug]/settings/actions.ts`) không làm mới trang nên form bật `keepOnSuccess`.
  Sau đó Quốc thêm `revalidatePath(`/studio/${tenantSlug}`, "layout")` và `revalidatePath(`/${tenantSlug}`, "layout")` (tên/màu hiện ở sidebar Studio và trang gian
  hàng công khai) ✅ đọc code. Form **vẫn** bật `keepOnSuccess` và comment còn ghi "action lưu xong không làm mới dữ liệu trang" — lệch, KB-Audit §40.
* **SMTP** giữ dữ liệu bằng cách riêng trong `smtp-tabs.tsx` (task 1.8b, có trước hook): chụp giá trị lúc gửi, ghi lại sau reset **trừ mật khẩu** ✅ đọc code — không
  dùng `useFormDraft`.
* **Không cần hook** (ô có kiểm soát — React không reset): Cấu hình chung, Màu sắc thương hiệu; editor tài liệu/bài viết (submit thủ công, §9.2); 2 form ghi chú
  Studio — `orders/[orderId]/order-note-actions.tsx` và `customers/_ui/customer-row-actions.tsx` (ô `value` + state; ghi chú khách trong dialog, lỗi hiện trong hộp,
  hộp vẫn mở) — đã rà ở 2.6, kết luận không sửa 🟡 (kết luận của Phong, khớp mô tả trong kế hoạch).
* Form còn nguy cơ: chỉ còn **Lưu trữ file** (`admin/settings/storage/storage-form.tsx`, có secret — 1.10) 🟡 theo bảng kế hoạch §6; nhóm "Thấp" `billing/refund-request-form.tsx`,
  `billing/renew-form.tsx` ghi "gộp vào task áp dụng của trang" — chưa task GĐ 2 nào nhận ✅ grep (không dùng hook) — KB-Audit §40.

### 25.8. Lỗi có sẵn đã sửa trong GĐ 1 + GĐ 2 ✅ đọc code (chưa thử trình duyệt ❓)

| Lỗi | Nguyên nhân | Sửa (task) |
| :-- | :-- | :-- |
| Thương hiệu: sửa Tên/Màu rồi sang tab khác → **mất dữ liệu đang nhập** | Tab cũ chỉ render panel đang chọn (unmount panel khác) | `InPageTabs`, mọi panel luôn mounted (1.12b) |
| SMTP: chọn cổng 465 → xem tab khác → quay lại tự về 587 | Như trên — state cục bộ port/secure mất khi unmount | `InPageTabs` (1.8, 1.12b) |
| Thanh toán System Center: **Toggle hiển thị lệch** trạng thái sau khi lưu lỗi | React reset ô checkbox về `defaultChecked` sau action lỗi, còn hình switch giữ state riêng 🟡 (Quốc báo) | `isEnabled` thuộc `names` của `useFormDraft` → ghi lại sau lưu lỗi; form có `key` theo dữ liệu đã lưu (1.11) |
| Thanh toán **Studio**: **Toggle lệch** khi cổng **tự tắt** (ADR-013) | Form chưa có `key` → `defaultChecked` mới từ server không áp vào ô đã mount 🟡 (Phong/Quốc báo, khớp comment code) | Form có `key = JSON.stringify(initial)`, khối thu gọn nằm ngoài form để giữ trạng thái mở (2.2) ✅ đọc code |
| **`<main>` lồng** trong `<main>` của layout | Trang tự bọc `<main>` | **System Center:** `<div>` ở mọi trang (1.1, 1.7, 1.12a, 1.12b, 1.13) + `admin/error.tsx` (1.14). **Studio:** đủ 9 trang — `settings`, `settings/payments` (2.1/2.2), `share-links` (2.3b), `storefront` (2.5), `coupons` ×3, `messages`, `products` (2.6). ✅ grep: thẻ `<main>` thật chỉ còn ở 2 layout, `studio/page.tsx` (onboarding, ngoài layout Studio — không lồng) và **`admin/settings/storage/page.tsx`** (sửa cùng 1.10) |

### 25.9. Việc còn mở

* **1.10 Lưu trữ file** (accordion, `useFormDraft` có secret, `useUnsavedChanges`, `<main>` lồng) — chờ Vương xong ADR-055. Là task duy nhất còn lại của kế hoạch ADR-058.
* 2 trang tab Cài đặt Studio chưa có `metadata.title` riêng; comment cũ ở `branding-form.tsx` và `product-editor.tsx` (KB-Audit §40) — chờ Quốc quyết.
* Kiểm trình duyệt thật cho toàn GĐ 1 + GĐ 2 ❓.

---

## 26. Luồng Mua Đợt 1 — Khu Tài Khoản, Thư Viện, Studio (ADR-061 + ADR-062) ✅ đọc code 2026-10-27 (chưa commit)

Quyết định thiết kế của Phong (brief Quốc 2026-10-27). Trang thanh toán: §8.4; khối chuyển khoản: §24.3; khối trạng thái: §7.1. Xem trình duyệt ❓.

### 26.1. Dòng nhắc đơn chờ trong `AccountShell` (`app/account/_ui/account-shell.tsx`)
* `AccountShell` nhận thêm `pendingOrderCount?: number` (layout `/account` lấy từ overview). Khi đã đăng nhập và `> 0`: dải ngay **dưới header** (không dính — header 64px
  vẫn là phần dính duy nhất), nền `accentSoft`, viền `accent`, chữ `ink`, `IconClock` + câu "Anh/Chị {họ tên} có đơn cần thanh toán để hoàn tất đơn hàng!" (ADR-061 Q8;
  không có họ tên → "Anh/Chị") + link ≥ 44px "Xem đơn cần thanh toán" / "Xem N đơn cần thanh toán" → `/account/orders`. **Chỉ khu vực `/account`**.

### 26.2. Thư viện `?tai-lieu={productId}` (`app/account/library/page.tsx`)
* Link "Tải tài liệu" ở trang thanh toán / email `order_paid` mở Thư viện kèm `?tai-lieu=`. Server chỉ khớp với entitlement **của chính user**; khớp → thẻ mang id
  `LIBRARY_HIGHLIGHT_ID` ("tai-lieu-vua-mua") được làm nổi, `LibraryHighlightFocus` (client) cuộn tới giữa màn hình + đưa focus vào thẻ (cuộn mượt chỉ khi không bật giảm
  chuyển động). Tham số lạ → không làm nổi gì. Có tham số mà chưa có entitlement (giao tài liệu đang chạy nền) → khối `role="status"` báo rõ thay vì im lặng.

### 26.3. Studio — `DeclaredPaidBadge` (`studio/[tenantSlug]/orders/_ui/declared-paid.tsx`)
* `Badge tone="info"`: "Khách báo đã chuyển" (PENDING) / "Khách báo đã chuyển · trước hạn" (EXPIRED còn xác nhận được). Hiện ở dòng danh sách đơn (luôn xếp đầu —
  [[02-System-Specs/Studio-Orders-Specs|Studio-Orders-Specs]] §2.5) và đầu trang chi tiết; `DeclaredPaidNotice` đặt ngay trên form xác nhận thanh toán. Badge có chữ, không
  chỉ màu.
* "Giao dịch cần xử lý": badge "Về sau hạn giữ đơn" (tone `danger`, cùng nhóm "Sai số tiền").

### 26.4. `ConfirmDialog` phía khách
* `app/account/library/_ui/confirm-dialog.tsx` (có từ ADR-039) nay dùng chung cho trang thanh toán — **chỉ "Huỷ đơn"** (câu cảnh báo "Nếu bạn đã chuyển tiền, đừng huỷ"); "Tôi đã chuyển khoản" và "Tôi chưa chuyển khoản" bấm thẳng, không hộp xác nhận (hoàn tác được ngay): nội dung đoạn đầu làm mô tả
  hộp thoại, lỗi server hiện **trong** hộp (`role="alert"`), đóng thì trả focus về nút đã mở.

---

### 26.5. Trang trước khi có đơn (khách vãng lai) — `(chua-co-don)/page.tsx` + `checkout/_ui/guest-checkout-form.tsx` (ADR-062 Q2/Q11, task 12/13) ✅ đọc code 2026-10-27 (chưa commit, chưa thử thủ công ❓)
* Bố cục giống trang đơn: breadcrumb "← {gian hàng}", h1 "Thanh toán", dòng "Bước 1/4 · Thông tin và cách thanh toán"; dưới `lg` 1 cột (dải tóm tắt → form) + thanh dính đáy
  "Tổng · Tiếp tục thanh toán"; từ `lg` 2 cột `minmax(0,1fr) 22rem`, cột phải dính (tóm tắt, nút chính, tiến độ).
* **`PreOrderSummary({ item, totalVnd, variant: "strip" | "card" })`** (`[orderCode]/_ui/checkout-parts.tsx`) — cùng hình thức `SummaryStrip`/`SummaryCard` nhưng chỉ "Tổng cộng"
  (giá server tính sẵn, gồm khuyến mãi đang áp).
* **`PreOrderProgress({ hasAutoOnly? })`** — cùng 4 bước như trang đơn, bước 1 đang làm.
* **`ProviderOptionCard`** (`[orderCode]/_ui/payment-method-panel.tsx`) — một thẻ radio phương thức (cả thẻ là `label`, ≥ 56px, viền `primary` khi chọn, focus ring trên cả thẻ,
  icon ví cho MoMo / ngân hàng cho cổng khác). **Dùng chung** cho `PaymentMethodPanel` (trang đơn) và form khách vãng lai.
* Form: Họ và tên, Email (có gợi ý `aria-describedby`), **1 ô** "xác nhận thông tin chính xác và đồng ý Điều khoản, Chính sách bảo mật" (link 2 văn bản, không tick sẵn), chọn
  phương thức; nút "Tiếp tục thanh toán" (đang gửi "Đang tạo đơn…"; tài liệu 0đ: "Nhận tài liệu"). Không có ô mật khẩu.
* **Mã giảm giá** ở trang này chỉ là **câu dẫn** dưới khối phương thức: "Có mã giảm giá? Bạn nhập được ở bước tiếp theo, ngay khi đơn được tạo — trước khi chuyển tiền."
  (mã chỉ áp được khi đã có đơn).
* **Pattern lỗi form** (mẫu cho form khách): sau mỗi lần gửi lỗi — **từ 2 ô lỗi trở lên** → hộp **tóm tắt lỗi** đầu form (`role="alert"`, `tabIndex=-1`, nhận focus, mỗi lỗi là link
  tới ô); **chỉ 1 ô lỗi** → đưa **focus thẳng vào ô** đó; lỗi chung không gắn ô (vd `RATE_LIMITED`) → hộp lỗi đầu form nhận focus. Lỗi từng ô đặt dưới ô
  (`aria-describedby`). Giá trị đã nhập được giữ lại.

### 26.6. `GuestActivationNotice` (`[orderCode]/_ui/checkout-parts.tsx`)
* Trên trang đơn khi `viewer.guestSession`: nền `surface`, viền `primary` (thông tin, không phải cảnh báo), chữ `ink`, icon chỉ trang trí. `prominent` (vừa tạo — `?vua-tao=1`):
  viền đủ 4 cạnh dày hơn + tiêu đề lớn "Đã tạo tài khoản cho bạn"; còn lại bản gọn "Tài khoản chưa kích hoạt". Nội dung: email đã gửi tới {email}, kích hoạt để đăng nhập lại
  và tải trên thiết bị khác; link "Chưa nhận được email? Gửi lại email kích hoạt" → `/verify-email?pending=1`.

### 26.7. Kit auth — `SuccessBanner` + trang kích hoạt
* `SuccessBanner({ title, message? })` (`app/(auth)/_ui/fields.tsx`, mới): nền pha 10% từ `secondary`, viền trái `secondary`, chữ `ink` + icon check, `role="status"` (không cướp
  focus). Dùng ở `/login?da-kich-hoat=1` ("Đã kích hoạt tài khoản").
* Trang `/verify-email/dat-mat-khau` dùng `AuthCard` + kit `(auth)/_ui/fields` (form mật khẩu + nhập lại); thiếu token → `ErrorBanner` + nút "Gửi lại email kích hoạt". Form đăng
  nhập: lỗi `EMAIL_NOT_VERIFIED`/`GUEST_NOT_ACTIVATED` hiện nút viền ≥ 44px "Gửi lại email kích hoạt" ngay dưới thông báo lỗi.

### 26.8. Ô định danh tài chính bị che, chống trình duyệt tự điền, `CopyValue` (2026-10-27, yêu cầu của chủ dự án) ✅ đọc code (working tree, chưa commit; chưa thử trình duyệt ❓)

**`MaskedTextField`** (`app/admin/_ui/kit-interactive.tsx`, export qua kit) — API như `TextField`:
* **Dùng cho** ô định danh tài chính trong form cấu hình thanh toán: **số tài khoản** của QR thủ công và SePay, **số điện thoại** MoMo thủ công — ở **cả** System Center
  (`admin/billing/payment/{manual-qr,sepay,momo-manual}-form.tsx`) và Studio (`studio/[tenantSlug]/settings/payments/{manual-qr,sepay,momo-manual}-form.tsx`).
* Có giá trị → mặc định hiện khung chỉ đọc **`*****` + 4 ký tự cuối** (vd `*****9123`); giá trị **≤ 4 ký tự** → chỉ `*****`. Ô trống → hiện input luôn.
* **Nút mắt** hiện/ẩn (`aria-pressed`); bấm hiện → input thật + focus. Ô có **lỗi** → tự mở ra để sửa.
* `<input name>` thật luôn nằm trong form (chỉ `hidden` khi đang che) → submit đúng, `useFormDraft` đọc/ghi được (nghe sự kiện `reset` của form để đọc lại giá trị).
* **Chỉ che trên giao diện** — giá trị đầy đủ vẫn nằm trong HTML gửi về trình duyệt người quản trị. **Không dùng cho secret** (secret/API key vẫn `PasswordField`, không bao giờ
  trả giá trị về client — CLAUDE.md §7.3).
* **Không** che tên chủ tài khoản. Trang thanh toán của khách vẫn hiện **đầy đủ** số tài khoản / số điện thoại (khách cần để chuyển tiền).

**Quy tắc chống trình duyệt tự điền** (lý do: Chrome từng tự điền **mật khẩu đăng nhập** vào ô Secret SePay và **email** vào ô "Tên chủ tài khoản"):
* Mọi ô secret/API key dùng **`autoComplete="new-password"`** — `PasswordField` của kit **đặt sẵn** giá trị này (form đăng nhập truyền `autoComplete` riêng).
* Ô text **đứng ngay trước** ô secret dùng **`autoComplete="off"`** (vd Username SMTP, API key Cloudinary).
* Form **đăng nhập, đăng ký, đổi mật khẩu** giữ autocomplete đúng chuẩn (`current-password` / `new-password` / `email`…).
* File đã sửa: `sepay-form`, `momo-form` (admin + Studio), `storage-form` (R2/MinIO), `cloudinary-form`, `smtp-tabs`, `s/[token]/download-panel`.

**`CopyValue({ value, label })`** (`app/admin/_ui/copy-value.tsx`) — giá trị chỉ đọc (`code`, font mono, xuống dòng mọi chỗ) + nút **"Sao chép"** ≥ 44px có focus ring (`aria-label`
"Sao chép {label}"), đổi thành **"Đã chép"** 2,5 giây; một vùng `sr-only aria-live="polite"` đọc phản hồi. Hiện dùng cho **Webhook URL SePay** ở System Center và Studio.

---

## 27. Tài Liệu Tham Chiếu & Liên Kết

* [[MOC-Home]] — Trang chủ Map of Content ([MOC-Home.md](../00-Index/MOC-Home.md))
* `apps/web/app/admin/_ui/kit.tsx`, `apps/web/app/admin/_ui/kit-interactive.tsx`, `apps/web/app/admin/_ui/icons.tsx`
* `apps/web/app/admin/_ui/{sidebar-nav,app-sidebar,sidebar-drawer}.tsx`, `apps/web/app/admin/layout.tsx`, `apps/web/app/studio/[tenantSlug]/layout.tsx`, `apps/web/app/account/_ui/logout-button.tsx`, `apps/web/app/globals.css` (`.app-drawer`) (§5.1) · [[01-Architecture-Decisions/ADR-028-Shared-App-Sidebar-Logout-Mobile-Drawer|ADR-028 (≙ ADR-042)]]
* `packages/config/src/theme.ts` — design tokens màu + tên biến font
* `apps/web/app/globals.css` — `@utility container-page/prose/narrow` (§4)
* `docs/DECISIONS.md` ADR-025 (tenant chỉ sở hữu nội dung storefront), ADR-024 (độ rộng layout), ADR-023 (storefront tenant theo section CMS)
* [[01-Architecture-Decisions/ADR-011-Tenant-Owns-Storefront-Content-Only|ADR-011 (KB, ≙ ADR-025)]] ([ADR-011-Tenant-Owns-Storefront-Content-Only.md](../01-Architecture-Decisions/ADR-011-Tenant-Owns-Storefront-Content-Only.md))
* `apps/web/app/_ui/site-header.tsx`, `site-footer.tsx`, `system-fonts.ts` (§1.1) · `apps/web/app/_ui/hero-stat-badges.tsx` (§12.10)
* `apps/web/app/[tenantSlug]/_ui/theme.ts`, `primitives.tsx`, `fonts.ts`, `icons.tsx`, `contact-form.tsx` (§8)
* [[02-System-Specs/Storefront-CMS-Specs|Storefront-CMS-Specs]] ([Storefront-CMS-Specs.md](../02-System-Specs/Storefront-CMS-Specs.md))
* `docs/GIEOCHU_BRAND_IDENTITY_PRODUCT_PROPOSAL_V1.0.md` §28 (Color System), §30 (Typography)
* `docs/DECISIONS.md` ADR-026, ADR-027, ADR-028 (§9) · [[01-Architecture-Decisions/ADR-012-Product-Editor-Category-External-Links|ADR-012 (≙ ADR-026)]] · [[01-Architecture-Decisions/ADR-013-Product-Summary-Cover-Preview-Visibility|ADR-013 (≙ ADR-027)]] · [[01-Architecture-Decisions/ADR-014-System-Cloudinary-Image-Quota|ADR-014 (≙ ADR-028)]]
* `apps/web/app/_ui/editor/{tiptap-editor,tiptap-toolbar,image-upload}.ts(x)` (§9.3)
* [[02-System-Specs/Product-Editor-And-Publishing-Specs|Product-Editor-And-Publishing-Specs]] ([Product-Editor-And-Publishing-Specs.md](../02-System-Specs/Product-Editor-And-Publishing-Specs.md))
* `apps/web/app/[tenantSlug]/_ui/{review-parts,product-reviews,review-composer,storefront-reviews}.tsx`, `studio/[tenantSlug]/reviews/_ui/review-card.tsx` (§10) · [[02-System-Specs/Reviews-Specs|Reviews-Specs]] ([Reviews-Specs.md](../02-System-Specs/Reviews-Specs.md)) · [[01-Architecture-Decisions/ADR-015-M10-Reviews-Posts-Rls-Split-Writes|ADR-015 (≙ ADR-029)]]
* `apps/web/app/studio/[tenantSlug]/posts/_ui/{post-list,post-editor,post-bits}.ts(x)`, `apps/web/app/[tenantSlug]/_ui/{post-parts,storefront-posts}.tsx` (§11) · [[02-System-Specs/Posts-Specs|Posts-Specs]] ([Posts-Specs.md](../02-System-Specs/Posts-Specs.md))
* `apps/web/app/_home-sections.tsx`, `apps/web/app/admin/cms/home-editor/{pin-picker,home-sections-editor}.tsx`, `apps/web/app/admin/settings/general/*`, `apps/web/app/admin/_ui/sidebar-nav.tsx` (§12) · [[01-Architecture-Decisions/ADR-018-System-Settings-And-Brand-From-System-Center|ADR-018 (≙ ADR-032)]] · [[01-Architecture-Decisions/ADR-019-Home-Page-Real-Data-Sold-Count|ADR-019 (≙ ADR-033)]]
* `apps/web/app/admin/cms/shop/{page,loading}.tsx`, `apps/web/app/admin/cms/shop/_ui/{shop-sections-editor,shop-fields,shop-validation}.ts(x)`, `apps/web/app/admin/_ui/kit.tsx` (`Notice`) (§13) · [[02-System-Specs/Shop-Marketplace-Specs|Shop-Marketplace-Specs]] ([Shop-Marketplace-Specs.md](../02-System-Specs/Shop-Marketplace-Specs.md)) · [[01-Architecture-Decisions/ADR-021-Shop-Marketplace-Cms-First|ADR-021 (≙ ADR-035)]]
* `apps/web/app/_ui/{catalog-parts,document-card,tenant-card,product-shelf,category-grid,shop-hero,shelf-skeleton,shop-cta,mobile-nav}.tsx`, `apps/web/app/cua-hang/{layout,page,loading,error}.tsx`, `apps/web/app/cua-hang/tai-lieu/{page,loading}.tsx`, `apps/web/app/cua-hang/_ui/search-parts.tsx` (§14)
* `apps/web/app/admin/_ui/{audit-log,link-pagination,audit-log-skeleton}.tsx`, `apps/web/app/admin/audit/*`, `apps/web/app/studio/[tenantSlug]/activity/*` (§15) · [[02-System-Specs/Audit-Log-Specs|Audit-Log-Specs]] ([Audit-Log-Specs.md](../02-System-Specs/Audit-Log-Specs.md))
* `apps/web/app/admin/_ui/{sales-stats,stats-chart}.tsx`, `apps/web/app/admin/page.tsx` (§16) · [[02-System-Specs/Tenant-Stats-Specs|Tenant-Stats-Specs]] ([Tenant-Stats-Specs.md](../02-System-Specs/Tenant-Stats-Specs.md))
* `apps/web/app/admin/cms/_ui/sortable-list-editor.tsx`, `apps/web/app/admin/cms/pricing/*`, `apps/web/app/pricing/*`, `apps/web/app/_ui/pricing/*`, `apps/web/app/account/**`, `apps/web/app/_ui/{account-menu,account-avatar}.tsx`, `apps/web/app/admin/billing/refunds/*`, `apps/web/app/studio/[tenantSlug]/billing/refund-request-form.tsx` (§18) · [[02-System-Specs/Pricing-Page-Specs|Pricing-Page-Specs]] ([Pricing-Page-Specs.md](../02-System-Specs/Pricing-Page-Specs.md)) · [[02-System-Specs/Account-Profile-Specs|Account-Profile-Specs]] ([Account-Profile-Specs.md](../02-System-Specs/Account-Profile-Specs.md)) · [[01-Architecture-Decisions/ADR-027-Account-Upgrade-Pricing-Profile-Refund|ADR-027 (≙ ADR-041)]]
* `apps/web/app/studio/[tenantSlug]/(tong-quan)/**` (gồm `_ui/dashboard-range-picker.tsx`), `apps/web/app/admin/_ui/{stats-chart,date-range-picker}.tsx`, `apps/web/app/globals.css` (`.range-picker`) (§19) · [[02-System-Specs/Studio-Dashboard-Specs|Studio-Dashboard-Specs]] ([Studio-Dashboard-Specs.md](../02-System-Specs/Studio-Dashboard-Specs.md)) · [[01-Architecture-Decisions/ADR-029-Studio-Dashboard-Period-Gross-Net-Revenue|ADR-029 (≙ ADR-043)]]
* `apps/web/app/studio/[tenantSlug]/orders/**` (gồm `_ui/{order-list,order-filter-form,order-row-actions,order-detail-parts,order-format,order-skeleton}.ts(x)`), `apps/web/app/admin/_ui/{kit,link-pagination}.tsx` (§20) · [[02-System-Specs/Studio-Orders-Specs|Studio-Orders-Specs]] ([Studio-Orders-Specs.md](../02-System-Specs/Studio-Orders-Specs.md)) · [[01-Architecture-Decisions/ADR-031-Studio-Orders-List-Detail-Upgrade|ADR-031 (≙ ADR-046)]]
* `apps/web/app/studio/[tenantSlug]/customers/**` (gồm `_ui/{customer-list,customer-row-actions,customer-format,customer-skeleton}.ts(x)`), `apps/web/app/studio/[tenantSlug]/orders/_ui/order-filter-form.tsx` (prop `label`) (§21) · [[02-System-Specs/Studio-Customers-Specs|Studio-Customers-Specs]] ([Studio-Customers-Specs.md](../02-System-Specs/Studio-Customers-Specs.md)) · [[01-Architecture-Decisions/ADR-033-Studio-Customers-List-Upgrade|ADR-033 (≙ ADR-048)]]
* `apps/web/app/_ui/{nav-link,nav-dropdown,mobile-nav,site-header,site-footer}.tsx` (§1.1.1), `apps/web/app/_home-sections.tsx` (§12.9), `apps/web/app/admin/cms/{menu,phap-ly}/*` (§13.7), `apps/web/app/phap-ly/[slug]/{page.tsx,_ui/legal-toc.ts}` (§22) · [[02-System-Specs/System-Cms-Menu-Home-Seo-Specs|System-Cms-Menu-Home-Seo-Specs]] · [[02-System-Specs/Legal-Documents-Specs|Legal-Documents-Specs]] · [[01-Architecture-Decisions/ADR-035-Menu-Home-Seo-Versioned-Terms|ADR-035 (≙ ADR-050)]]
* `apps/web/app/admin/_ui/{kit,billing-labels,icons}.ts(x)`, `apps/web/app/admin/billing/invoices/page.tsx`, `apps/web/app/admin/subscriptions/page.tsx`, `apps/web/app/_ui/bank-transfer-panel.tsx`, `apps/web/app/[tenantSlug]/checkout/[orderCode]/{page,coupon-panel}.tsx`, `apps/web/app/studio/[tenantSlug]/billing/page.tsx` (§24) · [[01-Architecture-Decisions/ADR-041-System-Center-Subscription-Invoices-Bank-Transfer-Qr|ADR-041 (≙ ADR-056)]]
* `apps/web/app/admin/_ui/{module-tabs,collapsible-section,unsaved-changes,in-page-tabs}.tsx`, `apps/web/app/admin/_ui/{nav-match,use-form-draft}.ts`, `apps/web/app/admin/cms/_ui/cms-tabs.ts`, `apps/web/app/admin/settings/_ui/settings-tabs.ts`, `apps/web/app/admin/_ui/sidebar-nav.tsx` (`match`), `apps/web/app/admin/layout.tsx`, `apps/web/app/studio/[tenantSlug]/layout.tsx` (Provider), `apps/web/app/studio/page.tsx` (Provider onboarding), `apps/web/app/studio/[tenantSlug]/settings/_ui/settings-tabs.ts`, `apps/web/app/studio/[tenantSlug]/{settings,settings/payments,products/_ui,products/[productId]/share-links,posts/_ui,storefront,coupons}/*` (GĐ 2), `docs/ke-hoach-toi-uu-layout-tab-accordion-2026-10-25.md` (§5 quy tắc full width, §11.1, §25) · [[01-Architecture-Decisions/ADR-043-Module-Tabs-Accordion-Unsaved-Guard|ADR-043 (≙ ADR-058)]] · [[01-Architecture-Decisions/ADR-042-Legal-Drafts-Import-Preview-Draft-Release|ADR-042 (≙ ADR-057)]] (§13.7)
* [[04-Operations-Runbooks/README|Quay lại danh mục Operations Runbooks]]

*Quay lại: [[MOC-Home]] (../00-Index/MOC-Home.md)*

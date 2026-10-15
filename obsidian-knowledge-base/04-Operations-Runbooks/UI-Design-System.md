---
tags:
  - runbook
  - ui-ux
  - design-system
  - status/living
date: 2026-05-24
updated: 2026-10-15
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
- Cả hai là **async Server Component, không nhận props**, tự đọc dữ liệu: `getEffectiveBrand()` +
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
  checkout; **trang chủ chưa có** skip-link (cũng không có `<main id="noi-dung">`) — đã có trong `docs/BACKLOG.md`.
  Skip-link hiện nằm ở từng trang, không nằm trong `SiteHeader`.
- Trang đang dùng: trang chủ (`app/page.tsx`), storefront `/[tenantSlug]`, chi tiết sản phẩm, checkout. `/pricing` và
  `/p/[slug]` **chưa** chuyển — xem §4.6.

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
sidebar. Nội dung dạng đọc/form bên trong vẫn có thể dùng `container-prose`/`container-narrow` hoặc `max-w-*` của
kit admin (§5). Nguồn: ADR-024.

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
| `/pricing` | ✅ đã áp dụng (2026-09-26) | ❌ **chưa** — trang chưa có header/footer nào | `main.container-page`; phần giới thiệu `mx-auto max-w-2xl` bên trong (khối con, hợp lệ theo §4.3); lưới gói `lg:grid-cols-4`. Chuyển sang chrome hệ thống: việc sau (`docs/BACKLOG.md`) |
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
| `SettingsGrid` | Grid nhiều `ConfigCard` xếp ngang, `auto-fit` tránh khoảng trắng chết. ⚠️ Cột `minmax(380px, 960px)` → **cuộn ngang ở viewport 375px** ✅ (đọc code; BACKLOG). Trang "Cấu hình chung" không dùng component này (lưới riêng `xl:grid-cols-2`) |
| `MainAsideGrid` | (ADR-026) Bố cục 2 cột `main` + `aside` (`aside` có `aria-label` qua `asideLabel`): 1 cột dưới `xl`, từ `xl` là `minmax(0,1fr) 320px`, `items-start`, `gap-6` ✅. Editor sản phẩm **không** dùng component này — tự dựng lưới riêng `minmax(0,1fr) 360px` trong `<form>`, khung 1440px (§9.1) |
| `ConfigCard` | Card cấu hình 1 module: icon + tiêu đề + badge trạng thái + toggle bên phải + nội dung + footer |
| `TableCard` | Card bọc 1 bảng tham khảo — icon + tiêu đề + mô tả, không có toggle (khác `ConfigCard`) |
| `Badge` | Huy hiệu trạng thái, 5 tone: `success` / `warning` / `danger` / `neutral` / `info` |
| `TextField`, `SelectField` | Input/select có label, hint, error — dùng `FieldShell` nội bộ chung. **Tự gắn a11y khi có `id`** (2026-10-15 ✅): `aria-invalid` khi có `error`; `aria-describedby` trỏ `${id}-error` (ưu tiên) hoặc `${id}-hint` — đúng id `FieldShell` gắn cho dòng lỗi (`role="alert"`) / dòng gợi ý; có lỗi thì dòng gợi ý không render. Trang gọi **không** tự đặt lại hai thuộc tính này |
| `PasswordField`, `Toggle` | Client component (từ `kit-interactive.tsx`), re-export qua `kit.tsx`. **`Toggle`** (2026-10-15 ✅): input thật `sr-only` + vòng focus vẽ trên rãnh switch (`peer-focus-visible:outline-2`, màu `#0F3B82` — WCAG 2.4.7); có prop `checked` (controlled) thì **luôn theo prop**, không lệch màu khi cha đổi giá trị; không có `checked` thì tự giữ state từ `defaultChecked` |
| `PrimaryButton`, `GhostButton` | Nút submit chính/phụ trong form |
| `PrimaryLinkButton`, `GhostLinkButton` | Nút dạng `<Link>` — dùng cho pattern "bấm để hiện form" qua query param (`?new=1`) thay vì client state |
| `RowActionButton` | Nút hành động nhỏ trong dòng bảng, 4 tone: `primary` / `success` / `danger` / `neutral`; prop `size`: `sm` (mặc định, dòng bảng desktop) · **`touch`** (ADR-029 — thẻ/danh sách dùng cả trên mobile: `min-h-11` = 44px dưới `lg`, gọn như `sm` từ `lg`) ✅ |
| `FormBanner` | Banner thông báo kết quả form (`ok` → xanh, lỗi → đỏ), `role="status"`/`role="alert"` |
| `DataTable`, `Tr`, `Td` | Bảng dữ liệu chuẩn — cố tình không set `overflow-x-auto` (tránh browser tự suy ra `overflow-y: auto`, cắt mất `RowMenu` dùng `position: absolute` ở các hàng cuối) |
| `EmptyState` | Trạng thái rỗng: icon + tiêu đề + mô tả + hành động gợi ý |

**Quy tắc bắt buộc khi thêm trang quản trị mới** (System Center hoặc Studio): tái dùng các component trên
thay vì tự viết class Tailwind rời rạc cho bảng/badge/form — tránh lặp lại việc phân mảnh CSS mà kit này
được tạo ra để giải quyết.

---

## 6. Bộ Icon Dùng Chung (`apps/web/app/admin/_ui/icons.tsx`)

42 icon SVG dạng component (`IconProps = { className?: string }`; đếm `export function Icon` 2026-09-28 sau M10b ✅ — thêm
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

**A11y mặc định (2026-10-15 ✅):** cả 42 `<svg>` trong `icons.tsx` đều có `aria-hidden="true"` — icon là trang trí; nút/link chỉ
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

- Class khung: `rounded-xl border border-l-4 p-4 text-sm` — viền 1px quanh khối, **viền trái 4px** mang sắc trạng thái
  (`borderColor` áp cả 4 cạnh, cạnh trái dày hơn).
- **Chữ luôn `ink`**, không dùng `secondary`/`accent` làm màu chữ: `secondary` `#16A34A` trên trắng chỉ ~3.3:1, không
  đạt AA 4.5:1 cho chữ thường. Link trong khối dùng `primary`.
- Trạng thái phải **có chữ** (câu mở đầu `<strong>`, vd. "Thanh toán thành công.", "Đơn hàng đã hết hạn."), không
  truyền đạt chỉ bằng màu.
- Màu lấy từ `brandColors` (`@gieochu/config/theme`), không dùng palette Tailwind `green-*`/`amber-*` rời.
  Storefront (`.sf-root`) có banner riêng `StorefrontNotice` (§8.0) — chưa theo pattern này.

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
   `StorefrontNotice` khi `resolveStorefrontAccess` trả `READ_ONLY` ("Trang tạm ngưng bán — chỉ xem, chưa mua được.")
   hoặc `LOCKED_NOTICE` ("Trang của bạn đang bị khoá…"); `StorefrontDemoBanner` "Nội dung mẫu" khi `isDemo && isOwner`.
   Cả hai ở `_ui/notice.tsx`, có icon + chữ (không truyền đạt chỉ bằng màu).
4. `<main id="noi-dung" class="sf-root …">` — **chỉ ở đây** mới có theme `--sf-*` (style inline từ
   `buildStorefrontStyle`) + biến font Montserrat/Inter. Không có section hero → thêm `<h1 class="sr-only">` tên tenant.
5. `SiteFooter` (hệ thống).

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
- **Khối mua theo trạng thái** (logic M8 giữ nguyên, ✅ đọc code): tenant `LOCKED` → `notFound()`; người xem là chủ
  tenant → "Đây là sản phẩm của bạn."; tenant khác `ACTIVE` (tức `READ_ONLY`) → ẩn `BuyButton`, hiện "Trang tạm ngưng
  bán — chưa thể mua lúc này."; còn lại → `BuyButton`. Phía server `createOrder` vẫn chặn bằng `assertTenantCanWrite`.
  Trang này **không** hiện banner `StorefrontNotice` — thông báo nằm trong khối mua.
- **Checkout** (`[tenantSlug]/checkout/[orderCode]/page.tsx`): `main.container-narrow`; breadcrumb
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
layout gửi **key chuỗi** (`icon: "grid"`), Client Component giữ bảng `NAV_ICONS` map key → component
(`studio/[tenantSlug]/_ui/sidebar-nav.tsx`, type `TenantNavIcon`). Áp dụng cho mọi prop dạng component/hàm.

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
  chưa lưu** (info — so snapshot JSON, kèm cảnh báo `beforeunload`).
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
  (`aria-label` "Tạo sản phẩm"/"Sửa sản phẩm"), bên trong khung `mx-auto max-w-[1440px]` căn giữa vùng làm việc (app
  shell Studio — ngoại lệ §4.4; skeleton `editor-skeleton.tsx` dùng cùng khung).
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
  → checklist (tôn trọng `prefers-reduced-motion` khi cuộn). Cảnh báo `beforeunload` khi còn thay đổi chưa lưu **hoặc còn
  file đang tải**. Skeleton `loading.tsx` cho trang Tạo và Sửa.
- **Landmark:** trang Tạo/Sửa (và skeleton) bọc bằng `<div>`, **không** `<main>` — `studio/[tenantSlug]/layout.tsx` đã có
  `<main>`. Quy tắc cho mọi trang con Studio: dùng `<div>`. Các trang Studio khác còn `<main>` lồng (BACKLOG, §9.10).

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
  storefront **800**, ảnh bìa chi tiết **1200**, ảnh trong mô tả **1200**, hero **1000**, avatar testimonial / icon dịch
  vụ **200**, preview trong `ImageUploadField` **600**; logo không áp. Bảng đầy đủ:
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

`<main>` lồng nhau ở các trang Studio khác (đếm 2026-09-27 ✅: 14 trang — `page.tsx` tổng quan, `billing`, `coupons` ×3,
`customers`, `messages`, `orders` ×2, `products` (danh sách), `share-links`, `settings` ×2, `storefront`; trang Tạo/Sửa/Xem
trước đã sửa); trang Xem trước nằm trong khung Studio (muốn toàn trang cần tách route group); 404 trả HTTP 200 khi
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
- **Sidebar Studio:** mục **"Đánh giá (N)"** (icon `IconStarOutline`, key `star`) — N = số đánh giá `VISIBLE` **chưa trả lời**,
  `99+` khi > 99; N = 0 → chỉ "Đánh giá". Tổng quan Studio có `StatCard` "Đánh giá mới" (7 ngày gần nhất).
- Ghi nhận khi đối chiếu: `review-card.tsx` khai màu hex cục bộ (`#12213A`, `#6B7280`, `#E5E7EB`, `#0F3B82`) thay vì đọc
  `brandColors` như `review-composer.tsx` ✅ (đọc code) — ghi để Phong/Quốc cân nhắc, không phải lỗi hành vi.

---

## 11. Giao Diện Bài Viết (M10b — ADR-029) ✅

Đọc code 2026-09-28. Nghiệp vụ: [[02-System-Specs/Posts-Specs|Posts-Specs]]. Kiểm bằng mắt trên trình duyệt với dữ liệu thật ❓
(chưa có dữ liệu demo bài viết).

### 11.1. Sidebar Studio

Mục **"Bài viết"** (icon `IconNewspaper`, key `posts`) đứng ngay sau "Sản phẩm" → sidebar Studio có **11 mục**: Tổng quan,
Đơn hàng, Khách hàng, Sản phẩm, Bài viết, Mã giảm giá, Trang bán hàng, Đánh giá (N), Hộp thư (N), Gói dịch vụ, Cài đặt ✅
(`studio/[tenantSlug]/layout.tsx`). Cân nhắc nhóm mục khi sidebar dài — BACKLOG.

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

- **Khung như editor sản phẩm (§9.1):** tối đa 1440px; ≥ `xl` lưới `minmax(0,1fr) 360px` — cột chính (tiêu đề tuỳ chọn +
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

### 12.3. Section "Tìm tài liệu" — chip tĩnh + `<details>`

* Chip danh mục là `<li>` **tĩnh** (tên + "· N" kèm `sr-only` "tài liệu"), **không** phải link/nút — chưa có trang tìm kiếm/danh
  mục công khai nên không giả làm phần tử bấm được. Danh sách có nhãn "Danh mục đang có tài liệu" (`aria-labelledby`).
* Hiện sẵn 10 chip (`SEARCH_CHIPS_VISIBLE`); phần còn lại trong `<details>`/`<summary>` ("Xem thêm N danh mục" / "Thu gọn",
  `min-h-11`, focus-visible outline, mũi tên xoay tắt khi `motion-reduce`) — không cắt mất, không cuộn ngang.
* Ô tìm + nút "Tìm kiếm" giữ hiện trạng (chưa có hành vi) — BACKLOG "trang tìm kiếm/danh mục công khai".

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
* Nhóm ô theo `ConfigCard` (lưới `xl:grid-cols-2`, trong card `sm:grid-cols-2`); mỗi ô là `TextField type="number"
  inputMode="numeric"` có `min/max/step=1`, nhãn "Tên (đơn vị)", gợi ý giới hạn; `noValidate` — validate ở server.
* **Tóm tắt lỗi** đầu form: `role="alert"`, `tabIndex=-1`, nhận focus sau khi gửi lỗi, tiêu đề "Chưa lưu — N ô cần sửa", mỗi lỗi
  là link `#<khoá>` tới ô.
* Thanh hành động: ghi chú "Thay đổi chỉ áp cho thao tác mới…", nút phụ **"Điền giá trị mặc định"** (chỉ điền lại ô phía client,
  không lưu; tắt khi đang lưu hoặc đã là mặc định) + nút chính "Lưu cấu hình"/"Đang lưu...". Kết quả qua `FormBanner`.
* Khoá chưa dùng (`trialDays`) không có ô.

### 12.6. Menu System Center (`admin/_ui/sidebar-nav.tsx`)

Nhóm cài đặt hệ thống nay có: **"Cấu hình chung"** → `/admin/settings/general` (`IconGear`), **"Email hỗ trợ"** →
`/admin/settings` (`IconMail`), rồi "Nhận diện thương hiệu", "Lưu trữ file", "Cloudinary Upload", "Cấu hình Mail" như cũ.

### 12.7. Thương hiệu và múi giờ trên giao diện

* Trang `/login`, `/register` (server) đọc `getEffectiveBrand()` rồi truyền **`brandName`** xuống form client (`LoginForm`,
  `RegisterForm`); form onboarding Studio (`studio/onboarding-form.tsx`) cũng nhận `brandName` qua prop. Client component **không**
  tự đọc thương hiệu (không có DB) và không import hằng `DEFAULT_BRAND` để hiển thị.
* Định dạng ngày giờ dùng hằng chung `DISPLAY_TIME_ZONE` (`@gieochu/core/system-settings`) — `apps/web` không còn chỗ hard-code
  chuỗi múi giờ ✅ (2026-10-15, sau khi Quốc sửa `lib/subscription-sweep.ts`).

### 12.8. Việc còn mở (BACKLOG, liên quan UI)

* `SettingsGrid` `minmax(380px, …)` gây cuộn ngang ở 375px.
* Editor CMS trang chủ: "Xem trang chủ ↗" là `<Link>` bọc `<button>` (phần tử tương tác lồng nhau).
* Chip/ô tìm trang chủ chưa thành link — chờ trang tìm kiếm/danh mục công khai.

---

## 13. Tài Liệu Tham Chiếu & Liên Kết

* [[MOC-Home]] — Trang chủ Map of Content ([MOC-Home.md](../00-Index/MOC-Home.md))
* `apps/web/app/admin/_ui/kit.tsx`, `apps/web/app/admin/_ui/kit-interactive.tsx`, `apps/web/app/admin/_ui/icons.tsx`
* `packages/config/src/theme.ts` — design tokens màu + tên biến font
* `apps/web/app/globals.css` — `@utility container-page/prose/narrow` (§4)
* `docs/DECISIONS.md` ADR-025 (tenant chỉ sở hữu nội dung storefront), ADR-024 (độ rộng layout), ADR-023 (storefront tenant theo section CMS)
* [[01-Architecture-Decisions/ADR-011-Tenant-Owns-Storefront-Content-Only|ADR-011 (KB, ≙ ADR-025)]] ([ADR-011-Tenant-Owns-Storefront-Content-Only.md](../01-Architecture-Decisions/ADR-011-Tenant-Owns-Storefront-Content-Only.md))
* `apps/web/app/_ui/site-header.tsx`, `site-footer.tsx`, `system-fonts.ts` (§1.1)
* `apps/web/app/[tenantSlug]/_ui/theme.ts`, `primitives.tsx`, `fonts.ts`, `icons.tsx`, `contact-form.tsx` (§8)
* [[02-System-Specs/Storefront-CMS-Specs|Storefront-CMS-Specs]] ([Storefront-CMS-Specs.md](../02-System-Specs/Storefront-CMS-Specs.md))
* `docs/GIEOCHU_BRAND_IDENTITY_PRODUCT_PROPOSAL_V1.0.md` §28 (Color System), §30 (Typography)
* `docs/DECISIONS.md` ADR-026, ADR-027, ADR-028 (§9) · [[01-Architecture-Decisions/ADR-012-Product-Editor-Category-External-Links|ADR-012 (≙ ADR-026)]] · [[01-Architecture-Decisions/ADR-013-Product-Summary-Cover-Preview-Visibility|ADR-013 (≙ ADR-027)]] · [[01-Architecture-Decisions/ADR-014-System-Cloudinary-Image-Quota|ADR-014 (≙ ADR-028)]]
* `apps/web/app/_ui/editor/{tiptap-editor,tiptap-toolbar,image-upload}.ts(x)` (§9.3)
* [[02-System-Specs/Product-Editor-And-Publishing-Specs|Product-Editor-And-Publishing-Specs]] ([Product-Editor-And-Publishing-Specs.md](../02-System-Specs/Product-Editor-And-Publishing-Specs.md))
* `apps/web/app/[tenantSlug]/_ui/{review-parts,product-reviews,review-composer,storefront-reviews}.tsx`, `studio/[tenantSlug]/reviews/_ui/review-card.tsx` (§10) · [[02-System-Specs/Reviews-Specs|Reviews-Specs]] ([Reviews-Specs.md](../02-System-Specs/Reviews-Specs.md)) · [[01-Architecture-Decisions/ADR-015-M10-Reviews-Posts-Rls-Split-Writes|ADR-015 (≙ ADR-029)]]
* `apps/web/app/studio/[tenantSlug]/posts/_ui/{post-list,post-editor,post-bits}.ts(x)`, `apps/web/app/[tenantSlug]/_ui/{post-parts,storefront-posts}.tsx` (§11) · [[02-System-Specs/Posts-Specs|Posts-Specs]] ([Posts-Specs.md](../02-System-Specs/Posts-Specs.md))
* `apps/web/app/_home-sections.tsx`, `apps/web/app/admin/cms/home-editor/{pin-picker,home-sections-editor}.tsx`, `apps/web/app/admin/settings/general/*`, `apps/web/app/admin/_ui/sidebar-nav.tsx` (§12) · [[01-Architecture-Decisions/ADR-018-System-Settings-And-Brand-From-System-Center|ADR-018 (≙ ADR-032)]] · [[01-Architecture-Decisions/ADR-019-Home-Page-Real-Data-Sold-Count|ADR-019 (≙ ADR-033)]]
* [[04-Operations-Runbooks/README|Quay lại danh mục Operations Runbooks]]

*Quay lại: [[MOC-Home]] (../00-Index/MOC-Home.md)*

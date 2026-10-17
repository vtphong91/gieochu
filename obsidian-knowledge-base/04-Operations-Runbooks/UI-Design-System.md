---
tags:
  - runbook
  - ui-ux
  - design-system
  - status/living
date: 2026-05-24
updated: 2026-10-17
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
  checkout; **trang chủ chưa có** skip-link (cũng không có `<main id="noi-dung">`) — đã có trong `docs/BACKLOG.md`.
  Skip-link hiện nằm ở từng trang, không nằm trong `SiteHeader`.
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
| `DataTable`, `Tr`, `Td` | Bảng dữ liệu chuẩn (từ M12a: prop `caption?` → `<caption class="sr-only">`, `<th scope="col">` — §15.5) — cố tình không set `overflow-x-auto` (tránh browser tự suy ra `overflow-y: auto`, cắt mất `RowMenu` dùng `position: absolute` ở các hàng cuối) |
| `EmptyState` | Trạng thái rỗng: icon + tiêu đề + mô tả + hành động gợi ý |

**Quy tắc bắt buộc khi thêm trang quản trị mới** (System Center hoặc Studio): tái dùng các component trên
thay vì tự viết class Tailwind rời rạc cho bảng/badge/form — tránh lặp lại việc phân mảnh CSS mà kit này
được tạo ra để giải quyết.

### 5.1. App shell System Center + Studio — sidebar dùng chung, Đăng xuất, drawer mobile (ADR-042) ✅

Đối chiếu working tree 2026-10-17 (**chưa commit/deploy**). Quyết định: [[01-Architecture-Decisions/ADR-028-Shared-App-Sidebar-Logout-Mobile-Drawer|ADR-028 KB (≙ ADR-042)]].
**Một bộ duy nhất** cho `/admin` và `/studio/{slug}` — sidebar riêng của Studio (`studio/[tenantSlug]/_ui/sidebar-nav.tsx`) **đã xoá**, không
dựng lại sidebar thứ hai.

| Component (file) | Vai trò |
| :--- | :--- |
| `SidebarNav` (`admin/_ui/sidebar-nav.tsx`, client) | Props `{ standalone, groups, rootHref, storageKey, ariaLabel }`. Mục đứng riêng ở đầu + nhóm **accordion** (1 nhóm mở; nút nhóm `aria-expanded`/`aria-controls`, chevron xoay). Nhóm mở theo ưu tiên: thao tác tay trong phiên (kể cả đóng) → nhóm chứa trang đang xem → nhóm lưu `localStorage[storageKey]` → nhóm đầu. Active = href khớp **dài nhất** (gốc khu vực và `/admin/settings` là tiền tố của mục khác), `aria-current="page"`, nền/chữ `color-mix` từ `brandColors.accent` (không hex cứng). Mục ≥ 44px dưới `lg`. Icon bằng **key chuỗi** (`SidebarNavIcon` — 18 key trong `NAV_ICONS`, §8.5) |
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

**46** icon SVG dạng component (đếm lại `export function Icon` 2026-10-17 ✅; danh sách dưới là mốc 42 của 2026-09-28, các icon thêm sau — `IconMenu`, `IconClose`, `IconShoppingBag`… — ghi ở §14.6 và các mục tương ứng) (`IconProps = { className?: string }`; mốc 2026-09-28 sau M10b — thêm
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

Từ ADR-042 (2026-10-17 ✅): `AdminSidebarNav` là lớp cấu hình trên `SidebarNav` dùng chung (§5.1) — icon theo key chuỗi, badge pill, Đăng xuất
ở đáy `AppSidebarPanel`, drawer dưới `lg`. Cấu trúc 1 mục đứng riêng + 6 nhóm giữ nguyên; sơ đồ đầy đủ:
[[02-System-Specs/User-Management-System-Center-Specs|User-Management-System-Center-Specs]] §2.

### 12.7. Thương hiệu và múi giờ trên giao diện

* Trang `/login`, `/register` (server) đọc `getEffectiveBrand()` rồi truyền **`brandName`** xuống form client (`LoginForm`,
  `RegisterForm`); form onboarding Studio (`studio/onboarding-form.tsx`) cũng nhận `brandName` qua prop. Client component **không**
  tự đọc thương hiệu (không có DB) và không import hằng `DEFAULT_BRAND` để hiển thị.
* Định dạng ngày giờ dùng hằng chung `DISPLAY_TIME_ZONE` (`@gieochu/core/system-settings`) — `apps/web` không còn chỗ hard-code
  chuỗi múi giờ ✅ (2026-10-15, sau khi Quốc sửa `lib/subscription-sweep.ts`).

### 12.8. Việc còn mở (BACKLOG, liên quan UI)

* `SettingsGrid` `minmax(380px, …)` gây cuộn ngang ở 375px.
* Editor CMS trang chủ: "Xem trang chủ ↗" là `<Link>` bọc `<button>` (phần tử tương tác lồng nhau).
* ~~Chip/ô tìm trang chủ chưa thành link~~ — ✅ xong ở ADR-035 GĐ2 (§12.3).

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
* **Cảnh báo rời trang:** `beforeunload` chỉ gắn khi có thay đổi chưa lưu (so snapshot JSON).
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
  dạng form GET.
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
| `admin/_ui/sales-stats.tsx` | Chỉ trình bày, **Server Component** (không hook): `SalesStatsSection({ overview, metric })`, `SalesStatsSkeleton()`, `parseSalesChartMetric(raw)`, kiểu `SalesChartMetric = "gmv" \| "don"`, `AdminStatsOverviewView`. Nhận kết quả `getAdminStatsOverview()` qua prop — **không tự truy vấn** |
| `admin/page.tsx` | Component async `SalesStats` gọi `getAdminStatsOverview({ days: 30 })`, bọc `<Suspense fallback={<SalesStatsSkeleton />}>` riêng — phần còn lại dashboard không phải chờ. Đặt sau khối thanh toán gói gần đây, trước "Thao tác nhanh" |

Section có `id="hoat-dong-ban-tai-lieu"` + `scroll-mt-20`, `aria-labelledby` trỏ tiêu đề `h2`.

### 16.2. Đầu section

* `h2` "Hoạt động bán tài liệu (30 ngày)" (font heading).
* Ghi chú: "Số liệu tổng hợp hằng ngày lúc 03:00, tính đến hết hôm qua — cập nhật lần cuối {`lastAggregatedAt` theo `DISPLAY_TIME_ZONE`}.
  GMV là tổng tiền khách trả (gộp, chưa trừ hoàn tiền)." — thay "mỗi giờ" của đặc tả gốc (ADR-037 mục 5).

### 16.3. Thẻ KPI (4 thẻ)

* Lưới `grid-cols-1 sm:grid-cols-2 xl:grid-cols-4`: **GMV** (giá trị rút gọn "12,5 triệu đ"/"1,2 tỷ đ" + dòng phụ số đầy đủ "1.234.567 đ"),
  **Đơn đã thanh toán**, **Khách mới**, **Lượt tải**.
* Dòng thay đổi so với 30 ngày trước, tính bằng **BigInt** (cả GMV), 1 chữ số thập phân:
  - kỳ trước = 0 → "— chưa có số liệu kỳ trước" (màu chữ phụ);
  - 0% → "Không đổi so với 30 ngày trước";
  - tăng/giảm → mũi tên + chữ "Tăng"/"Giảm" {x}% — màu **`text-green-700`** / **`text-red-700`** (Tailwind, không phải token); không chỉ
    dựa vào màu vì có chữ + icon.
* Định dạng tiền không qua float: phần nguyên + 1 chữ số thập phân tính bằng BigInt rồi mới đổi number.

### 16.4. Biểu đồ cột theo ngày

* Thẻ `xl:col-span-2`; tiêu đề "GMV theo ngày" / "Đơn đã thanh toán theo ngày" + đơn vị + "mỗi cột là 1 ngày (giờ Việt Nam)".
* **Chọn chỉ số bằng link GET** `?chi-so=gmv|don` (không cần JS): `<nav aria-label="Chọn chỉ số biểu đồ">` 2 link "GMV"/"Đơn",
  `aria-current` ở mục đang chọn, `scroll={false}` + neo `#hoat-dong-ban-tai-lieu`; giá trị lạ → `gmv`. Target `min-h-11` dưới `lg`.
* Biểu đồ **HTML thuần** (không thư viện chart, không SVG): khối `role="img"` có `aria-label` tóm tắt (khoảng ngày, giá trị cao nhất + ngày);
  cột/trục bên trong `aria-hidden`. Cao `h-48`; trục Y 3 mốc (max, max/2, 0); lưới ngang nét đứt; cột màu `brandColors.primary`, ngày bằng 0
  là vạch xám 2px; `title` mỗi cột = ngày + giá trị đầy đủ; nhãn trục X thưa — neo ngày cuối, lùi mỗi 7 ngày (không chồng chữ ở 360px).
  Dòng "Cao nhất: … ngày …" dưới biểu đồ.
* Cả 30 ngày = 0 cho chỉ số đang chọn → khung nét đứt "Không có doanh thu/đơn đã thanh toán nào trong 30 ngày."
* **Bảng số liệu thay thế** trong `<details>` "Xem bảng số liệu theo ngày": `<table>` có `caption` ẩn, `th scope="col"`/`scope="row"`, 5 cột
  (Ngày, GMV, Đơn, Khách mới, Lượt tải), mới → cũ, khung `max-h-96 overflow-auto` (cuộn ngang trong khung, trang không cuộn ngang).

### 16.5. Top 5 gian hàng theo GMV

* Thẻ cạnh biểu đồ (dưới `xl` xếp dưới): danh sách `<ol>` hạng 1–5, mỗi dòng tên gian hàng (link `/{slug}` mở tab mới, có chữ ẩn "Hạng n" và
  "(mở gian hàng ở tab mới)"), `/{slug}`, GMV rút gọn + số đơn. **Chỉ tên + số tổng hợp** (§7.9).
* Không có tenant GMV > 0 → "Chưa có gian hàng nào phát sinh doanh thu trong 30 ngày."

### 16.6. Trạng thái

| Trạng thái | Hiển thị |
| :-- | :-- |
| Đang tải | `SalesStatsSkeleton` — cùng khung với khối thật, `aria-busy`, `role="status"` ẩn "Đang tải thống kê bán tài liệu…", `animate-pulse motion-reduce:animate-none` |
| `status: "unavailable"` (bảng chưa migrate) | `Notice tone="warning"` "Thống kê chưa sẵn sàng" — "Số liệu sẽ hiện sau lần tổng hợp hằng ngày kế tiếp (03:00)" |
| Rỗng — **cả 2 kỳ (60 ngày) đều 0 và không có top tenant** | `EmptyState` "Chưa có hoạt động bán tài liệu" |
| Có số liệu | 4 KPI + biểu đồ/bảng + top 5 |

### 16.7. Việc còn mở (liên quan UI)

* ⚠️ Hex hard-code trong `sales-stats.tsx` chưa có token: `#E5E7EB` (viền, cột rỗng), `#6B7280` (chữ phụ), `#D1D5DB` (đường đáy biểu đồ);
  màu xu hướng dùng class Tailwind `text-green-700`/`text-red-700` ✅ đọc code.

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

Đối chiếu working tree 2026-10-17 (**chưa commit/deploy**). Nghiệp vụ: [[02-System-Specs/Pricing-Page-Specs|Pricing-Page-Specs]],
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
* **FAQ** bằng `<details>` (không JS). Section rỗng tự ẩn; số liệu = 0 ẩn.
* Xem nháp (`?xem-truoc=nhap`, chỉ admin): dải "Đang xem bản nháp" + `noindex`.

### 18.5. Khu vực `/account`

* **App shell fluid** (`_ui/account-shell.tsx`; ADR-024 §4.4 — không `container-page`): skip-link, header hệ thống gọn **64px** (logo → trang
  chủ, nhãn "Tài khoản", menu tài khoản) — giống Studio.
* **Sidebar** (`_ui/account-sidebar-nav.tsx`, chỉ từ `lg`): 3 nhóm "Tài khoản của bạn" · "Mua sắm" · "Gian hàng của bạn" (chỉ chủ gian hàng),
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
* Chưa kiểm thực tế qua trình duyệt có đăng nhập: 360/375px, bàn phím, trình đọc màn hình ❓.

---

## 19. Tài Liệu Tham Chiếu & Liên Kết

* [[MOC-Home]] — Trang chủ Map of Content ([MOC-Home.md](../00-Index/MOC-Home.md))
* `apps/web/app/admin/_ui/kit.tsx`, `apps/web/app/admin/_ui/kit-interactive.tsx`, `apps/web/app/admin/_ui/icons.tsx`
* `apps/web/app/admin/_ui/{sidebar-nav,app-sidebar,sidebar-drawer}.tsx`, `apps/web/app/admin/layout.tsx`, `apps/web/app/studio/[tenantSlug]/layout.tsx`, `apps/web/app/account/_ui/logout-button.tsx`, `apps/web/app/globals.css` (`.app-drawer`) (§5.1) · [[01-Architecture-Decisions/ADR-028-Shared-App-Sidebar-Logout-Mobile-Drawer|ADR-028 (≙ ADR-042)]]
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
* `apps/web/app/admin/cms/shop/{page,loading}.tsx`, `apps/web/app/admin/cms/shop/_ui/{shop-sections-editor,shop-fields,shop-validation}.ts(x)`, `apps/web/app/admin/_ui/kit.tsx` (`Notice`) (§13) · [[02-System-Specs/Shop-Marketplace-Specs|Shop-Marketplace-Specs]] ([Shop-Marketplace-Specs.md](../02-System-Specs/Shop-Marketplace-Specs.md)) · [[01-Architecture-Decisions/ADR-021-Shop-Marketplace-Cms-First|ADR-021 (≙ ADR-035)]]
* `apps/web/app/_ui/{catalog-parts,document-card,tenant-card,product-shelf,category-grid,shop-hero,shelf-skeleton,shop-cta,mobile-nav}.tsx`, `apps/web/app/cua-hang/{layout,page,loading,error}.tsx`, `apps/web/app/cua-hang/tai-lieu/{page,loading}.tsx`, `apps/web/app/cua-hang/_ui/search-parts.tsx` (§14)
* `apps/web/app/admin/_ui/{audit-log,link-pagination,audit-log-skeleton}.tsx`, `apps/web/app/admin/audit/*`, `apps/web/app/studio/[tenantSlug]/activity/*` (§15) · [[02-System-Specs/Audit-Log-Specs|Audit-Log-Specs]] ([Audit-Log-Specs.md](../02-System-Specs/Audit-Log-Specs.md))
* `apps/web/app/admin/_ui/sales-stats.tsx`, `apps/web/app/admin/page.tsx` (§16) · [[02-System-Specs/Tenant-Stats-Specs|Tenant-Stats-Specs]] ([Tenant-Stats-Specs.md](../02-System-Specs/Tenant-Stats-Specs.md))
* `apps/web/app/admin/cms/_ui/sortable-list-editor.tsx`, `apps/web/app/admin/cms/pricing/*`, `apps/web/app/pricing/*`, `apps/web/app/_ui/pricing/*`, `apps/web/app/account/**`, `apps/web/app/_ui/{account-menu,account-avatar}.tsx`, `apps/web/app/admin/billing/refunds/*`, `apps/web/app/studio/[tenantSlug]/billing/refund-request-form.tsx` (§18) · [[02-System-Specs/Pricing-Page-Specs|Pricing-Page-Specs]] ([Pricing-Page-Specs.md](../02-System-Specs/Pricing-Page-Specs.md)) · [[02-System-Specs/Account-Profile-Specs|Account-Profile-Specs]] ([Account-Profile-Specs.md](../02-System-Specs/Account-Profile-Specs.md)) · [[01-Architecture-Decisions/ADR-027-Account-Upgrade-Pricing-Profile-Refund|ADR-027 (≙ ADR-041)]]
* [[04-Operations-Runbooks/README|Quay lại danh mục Operations Runbooks]]

*Quay lại: [[MOC-Home]] (../00-Index/MOC-Home.md)*

# Kế hoạch tối ưu layout: tab nhóm trang cùng chức năng + accordion cho trang cấu hình

> Người soạn: Phong (UX/UI) · Ngày: 2026-10-25 · Trạng thái: **ĐÃ CHỐT theo ADR-058 + Bổ sung ADR-058** (`docs/DECISIONS.md`)
> Phạm vi: chỉ lớp trình bày (điều hướng, bố cục, component dùng chung). **URL không đổi**, không đổi dữ liệu,
> không đổi Server Action. **Mỗi task làm xong, Quốc duyệt, rồi mới làm task sau** (ADR-058 mục 7).

---

## 0. Tóm tắt quyết định (ADR-058)

1. Tab ngang đầu trang (`ModuleTabs`) **chỉ gom trang con cùng một chức năng**. **Không dropdown.** URL giữ nguyên.
   Sidebar giữ nhóm/mục như hiện tại. Mỗi nhóm tab chỉ còn **một** mục trên sidebar.
2. **Trang CMS** = 2 tab: **Trang chủ** (mặc định) · **Header & Footer**. Trang Cửa hàng, Trang Bảng giá,
   Chính sách sử dụng, Danh mục tài liệu giữ là mục riêng.
3. **Cấu hình chung** = 3 tab: **Cấu hình chung** · **Email hỗ trợ** · **Cấu hình Email (SMTP)**.
   **Không** gom Lưu trữ file với Cloudinary.
4. **Accordion** chỉ dùng cho trang có nhiều khối hoặc có khối tuỳ chọn, không áp cho trang ngắn. Mặc định **khối đầu tiên
   mở**, các khối khác thu gọn. Khối **SEO luôn thu gọn** ở mọi editor, theo kiểu section của Rank Math (tiêu đề + badge
   trạng thái có chữ + chevron). Trang thanh toán: cổng **đang bật thì mở**, cổng tắt thì thu gọn.
5. **Cảnh báo rời trang khi chưa lưu** (kể cả bấm tab/sidebar, tức điều hướng phía client) làm ngay ở GĐ 0.
6. **Studio** áp cùng quy tắc. **Không** làm trang tài khoản khách hàng (bỏ GĐ 3 cũ).
7. (Bổ sung) Các trang CMS tuỳ chỉnh `/p/[slug]` có **mục sidebar riêng "Trang tuỳ chỉnh"** (danh sách `/admin/cms`). Các
   slug hệ thống (home/menu/shop/pricing) bị ẩn khỏi danh sách **bằng truy vấn** (Hiếu), không lọc ở JSX.
8. (Bổ sung) Studio — trang sửa tài liệu **giữ nguyên bố cục, không thêm tab**, chỉ áp accordion cho các khối.

---

## 1. Hiện trạng (khảo sát chỉ đọc, 2026-10-25)

### 1.1. Menu System Center (`apps/web/app/admin/_ui/sidebar-nav.tsx`, `ADMIN_GROUPS`)

| Nhóm | Mục (href) |
|---|---|
| (riêng) | Tổng quan `/admin` |
| Người dùng | Danh sách người dùng `/admin/users` · Phân quyền `/admin/roles` |
| Kinh doanh | Tenant `/admin/tenants` · Gói dịch vụ `/admin/plans` · Đơn hàng `/admin/subscriptions` |
| Nội dung | Trang CMS `/admin/cms` · Trang Cửa hàng `/admin/cms/shop` · Trang Bảng giá `/admin/cms/pricing` · Menu & chân trang `/admin/cms/menu` · Chính sách sử dụng `/admin/cms/phap-ly` · Danh mục tài liệu `/admin/categories` |
| Tài chính | Cấu hình thanh toán `/admin/billing/payment` · Hoá đơn `/admin/billing/invoices` · Hoàn tiền gói `/admin/billing/refunds` |
| Cấu hình hệ thống | Cấu hình chung `/admin/settings/general` · Email hỗ trợ `/admin/settings` · Nhận diện thương hiệu `/admin/settings/branding` · Lưu trữ file `/admin/settings/storage` · Cloudinary Upload `/admin/settings/cloudinary` · Cấu hình Mail `/admin/settings/smtp` |
| Giám sát | Nhật ký hệ thống `/admin/audit` · Báo cáo vi phạm `/admin/reports` |

### 1.2. Menu Studio (`apps/web/app/studio/[tenantSlug]/layout.tsx`)

Tổng quan · **Bán hàng** (Đơn hàng · Khách hàng · Mã giảm giá) · **Nội dung** (Sản phẩm · Bài viết · Trang bán hàng ·
Đánh giá) · **Gian hàng** (Hộp thư · Gói dịch vụ · Hoạt động · Cài đặt). Trang con không có trên sidebar:
`/settings/payments` (chỉ có link chữ ở cuối trang Cài đặt), `/products/[id]/share-links`.

### 1.3. Điểm đáng chú ý

| # | Phát hiện |
|---|---|
| H1 | Editor trang chủ (`/admin/cms/home`, qua `[slug]`) **không có mục sidebar**. Phải vào danh sách "Trang CMS" rồi bấm menu hàng. |
| H2 | "Menu & chân trang" là mục rời, dù cùng chức năng nội dung CMS (dòng `menu` nằm trong bảng `cmsPage`). |
| H3 | "Email hỗ trợ" và "Cấu hình Mail" rời nhau. Tab nội bộ SMTP (`smtp-tabs.tsx`, `useState`) chỉ là nút thường, chưa có `role="tab"` và chưa đi được bằng phím mũi tên. |
| H4 | Đang có 4 kiểu "tab" khác nhau: `PillTabs` (Hoá đơn), tab `useState` (SMTP), hàng chọn 7 văn bản (Chính sách sử dụng, `?van-ban=`), lọc tab-link (Bài viết Studio). |
| H5 | Khối thu gọn đúng chuẩn duy nhất là `LegalMetaForm` (`<h2><button aria-expanded>` + panel `hidden`). Đây là mẫu gốc cho `CollapsibleSection`. |
| H6 | Editor nhiều section (trang chủ, cửa hàng, bảng giá, trang bán hàng) dùng bố cục **danh sách section + khung sửa** (list-detail). Giữ nguyên. |
| H7 | `Link` điều hướng phía client nên **không** kích hoạt `beforeunload`. Bấm sidebar khi editor đang sửa dở có thể mất thay đổi mà không có cảnh báo. Next 16 có prop `onNavigate` (có `preventDefault()`) trên `Link` để chặn. |

Phát hiện kèm, ngoài phạm vi (Quốc quyết): `<main>` lồng trong `<main>` của layout ở `admin/cms/page.tsx`,
`admin/cms/[slug]/page.tsx`, `studio/.../settings/page.tsx`. Ở danh sách section trang chủ, nút Lên/Xuống có vùng bấm
< 24px và còn hex cứng `#D97706`. Đề xuất sửa trong task 1.2.

---

## 2. Rà từng nhóm theo nguyên tắc "cùng chức năng"

Một nhóm tab hợp lệ khi các trang là **các phần của cùng một việc**, dùng chung đối tượng hoặc loại cấu hình, và người
dùng hay chuyển qua lại giữa chúng. Thiếu một điều thì giữ là mục riêng.

### 2.1. System Center

| Trang | Quyết định | Lý do / ghi chú |
|---|---|---|
| Trang chủ CMS `/admin/cms/home` + Header & Footer `/admin/cms/menu` | **GOM → tab "Trang CMS"** (Trang chủ mặc định) | ADR-058 mục 2. Sửa H1, H2. |
| Danh sách trang tuỳ chỉnh `/admin/cms` (`/p/[slug]`), `/admin/cms/new`, `/admin/cms/[slug]` | **Mục sidebar riêng "Trang tuỳ chỉnh"**, không thành tab | Bổ sung ADR-058 (a). Ẩn slug hệ thống bằng truy vấn (Hiếu). |
| Trang Cửa hàng · Trang Bảng giá · Chính sách sử dụng · Danh mục tài liệu | **Giữ riêng** | ADR-058. Chính sách sử dụng giữ hàng chọn 7 văn bản bên trong. |
| Cấu hình chung `/admin/settings/general` + Email hỗ trợ `/admin/settings` + Cấu hình Email (SMTP) `/admin/settings/smtp` | **GOM → tab "Cấu hình chung"** | ADR-058 mục 3. Sửa H3. |
| Nhận diện thương hiệu · Lưu trữ file · Cloudinary Upload | **Giữ riêng** | ADR-058: không gom Lưu trữ với Cloudinary. |
| Người dùng, Kinh doanh, Tài chính, Giám sát (mọi mục) | **Giữ riêng** | Mỗi mục là một đối tượng/việc riêng. Hoá đơn giữ `PillTabs` nội bộ. |

Sidebar System Center sau khi gom (23 → 21 mục tính cả "Tổng quan", không đổi nhóm; 1.1 giữ nguyên 23 vì bỏ "Menu & chân trang" nhưng thêm "Trang tuỳ chỉnh", 1.7 gộp 3 mục cấu hình thành 1):

```
Tổng quan
Người dùng ▸ Danh sách người dùng · Phân quyền
Kinh doanh ▸ Tenant · Gói dịch vụ · Đơn hàng
Nội dung   ▸ Trang CMS* · Trang tuỳ chỉnh · Trang Cửa hàng · Trang Bảng giá · Chính sách sử dụng · Danh mục tài liệu
Tài chính  ▸ Cấu hình thanh toán · Hoá đơn · Hoàn tiền gói
Cấu hình hệ thống ▸ Cấu hình chung* · Nhận diện thương hiệu · Lưu trữ file · Cloudinary Upload
Giám sát   ▸ Nhật ký hệ thống · Báo cáo vi phạm
(* = mở trang có ModuleTabs)
```

Mục sidebar có tab cần trường `match` để vẫn sáng khi đứng ở tab khác:
- "Trang CMS": `href: /admin/cms/home`, `match: ["/admin/cms/menu"]`.
- "Trang tuỳ chỉnh": `href: /admin/cms`. Bản thân href đã khớp tiền tố `/admin/cms/new` và `/admin/cms/{slug}`. Theo luật
  khớp dài nhất, `home`/`menu` thuộc "Trang CMS", còn `shop`/`pricing`/`phap-ly` thuộc mục riêng của chúng.
- "Cấu hình chung": `href: /admin/settings/general`, `match: ["=/admin/settings", "/admin/settings/smtp"]`. Đường dẫn
  `/admin/settings` là tiền tố của mọi trang cấu hình nên phải **khớp đúng** (cú pháp `=`), không khớp theo tiền tố.

### 2.2. Studio (cùng quy tắc)

| Trang | Quyết định | Lý do |
|---|---|---|
| Cài đặt `/settings` + Thanh toán `/settings/payments` | **GOM → tab "Cài đặt"** (Thông tin & thương hiệu · Thanh toán) | Cùng chức năng cấu hình gian hàng. Payments đã là URL con. |
| Sửa tài liệu `/products/[id]` + Link chia sẻ `/products/[id]/share-links` | **Giữ nguyên, không thêm tab** | Bổ sung ADR-058 (b). Chỉ áp accordion cho các khối (task 2.4). |
| Mọi mục còn lại | Giữ riêng | Đối tượng khác nhau. |

### 2.3. Trang tuỳ chỉnh (`/p/[slug]`) — đã chốt

Chủ dự án chọn **mục sidebar riêng** "Trang tuỳ chỉnh" (Bổ sung ADR-058 (a)). Phương án link phụ trên header Trang CMS bị
bỏ. Trang danh sách `/admin/cms` đổi tiêu đề thành "Trang tuỳ chỉnh". Việc ẩn các slug hệ thống (home/menu/shop/pricing)
do Hiếu làm trong truy vấn, kèm tổng đếm phân trang khớp.

---

## 3. Kiến trúc điều hướng 2 cấp (phương án đã chốt)

Sidebar là cấp **chức năng**, `ModuleTabs` là cấp **phần con của cùng chức năng**. Hai cấp không chồng nhau
(`avoid-mixed-patterns`, `nav-hierarchy`). Không thêm breadcrumb vì tối đa chỉ sidebar → tab → tab nội bộ.

### 3.1. Desktop (≥ md)

```
┌──────────────┬───────────────────────────────────────────────────────────────┐
│ Nội dung  ▾  │  Trang CMS                                                     │ ← h1 = tên nhóm
│  ▌Trang CMS  │  Nội dung trang chủ và khung đầu/chân trang công khai.         │
│   Tuỳ chỉnh  │  ┌─────────────┬──────────────────┐                            │
│   Bảng giá   │  │▓ Trang chủ ▓│ Header & Footer  │                ← ModuleTabs│
│   Chính sách │  ──▀▀▀▀▀▀▀▀▀▀▀──────────────────────────────────────────────── │
│   Danh mục   │  [nội dung tab đang chọn …]                                    │
└──────────────┴───────────────────────────────────────────────────────────────┘
```

- **h1 = tên nhóm** (giống nhau ở mọi tab). Tên trang con là phần đầu nội dung (h2/subtitle). `metadata.title` vẫn riêng
  theo tab.
- Tab đang chọn: nền primary + chữ trắng (khoảng 10:1) + chữ đậm + vạch dưới 3px màu accent. Không chỉ dựa vào màu.
  Kiểu này khác hẳn `PillTabs` (viên thuốc nền accent, dùng để lọc trong một trang).

### 3.2. Mobile (< md)

```
┌─────────────────────────────────────┐
│ Cấu hình chung                (h1)  │
│ ┌─────────────────────────────────┐ │
│ │ Đang xem: Email hỗ trợ (2/3)  ▾ │ │ ← nút disclosure ≥ 44px
│ └─────────────────────────────────┘ │
│   │ Cấu hình chung              │   │ ← khi mở: link dọc, mỗi dòng ≥ 44px
│   │ ✓ Email hỗ trợ              │   │
│   │ Cấu hình Email (SMTP)       │   │
└─────────────────────────────────────┘
```

- `mobile="auto"` (mặc định): nhóm ≤ 2 tab thì hiện thẳng các tab (xuống dòng nếu chật), nhóm ≥ 3 tab thì dùng disclosure.
- Không dùng dải tab cuộn ngang. Không sticky (`focus-not-obscured`).

---

## 4. Quy tắc chọn pattern (ghi vào `UI-Design-System.md`)

| Tình huống | Dùng |
|---|---|
| Các **trang** cùng chức năng, URL riêng, lưu riêng | `ModuleTabs` (`nav` + link `aria-current="page"`, không phím mũi tên) |
| Bộ lọc/góc nhìn của **cùng một danh sách** | `PillTabs` (link GET) |
| Nhiều khung trong một màn, không đổi URL, phải giữ state (SMTP) | Tab ARIA thật (`tablist`/`tab`/`tabpanel`, ←/→, Home/End) |
| Trang/form có **nhiều khối** hoặc có khối tuỳ chọn | `CollapsibleSection`: khối đầu mở, các khối khác thu gọn. SEO luôn thu gọn |
| Danh sách section có thứ tự, ẩn/hiện, sắp xếp | Giữ list-detail |
| Nội dung đọc (FAQ, xem thêm, chi tiết log) | `<details>` gốc |
| Trang ngắn (≤ 2 khối, không có khối tuỳ chọn) | **Không** accordion |

Ràng buộc: tối đa 2 tầng tab trên một màn và hai tầng phải khác kiểu. Không lồng accordion. **Card chứa nút hành động
chính (Lưu/Xuất bản) không thu gọn** và không tính là "khối đầu tiên". Lỗi ở khối thu gọn thì khối tự mở.

---

### Quy tắc bố cục: full width (chủ dự án chốt 2026-10-25)

Nội dung chính trong System Center và Studio **luôn full width theo khung app**, đồng bộ toàn hệ thống. **Không** giới hạn
bề ngang form/editor bằng `max-w-*`/`mx-auto` ở khung trang, **không** xếp card thành lưới nhiều cột khiến card chỉ chiếm
nửa màn hình. Các khối xếp 1 cột; cột phụ bên phải chỉ dùng khi có lý do (editor tài liệu/bài viết, `MainAsideGrid`).
Được phép giữ `max-w`/`mx-auto` ở cấp **component** (độ rộng ô nhập ngắn, ô bảng, khối lỗi/trạng thái trống ở giữa, đoạn
mô tả dưới tiêu đề để dòng chữ dễ đọc).

**Sửa ở gốc (Quốc, 2026-10-25):** `SettingsGrid` trong `admin/_ui/kit.tsx` nay là `mt-6 grid grid-cols-1 gap-6` (1 cột, full
width) — mọi trang còn dùng nó tự full width. Quốc cũng bỏ `mx-auto max-w-[1440px]` ở `post-editor.tsx` (2 chỗ) và
`max-w-7xl mx-auto` ở `admin/settings/storage/page.tsx`. Long cần cập nhật mô tả `SettingsGrid` ở `UI-Design-System.md` §5.

Kết quả rà (2026-10-25, sau khi sửa ở gốc):

| Trang / file | Trạng thái |
|---|---|
| 8 trang System Center (Email hỗ trợ, Cloudinary, gói tạo/sửa, danh mục tạo/sửa, trang tuỳ chỉnh tạo/sửa) | Đã bỏ hẳn `SettingsGrid` (task 1.15) — full width |
| `studio/[tenantSlug]/products/[productId]/share-links/page.tsx` | Đã bỏ `SettingsGrid` (task 2.3b) — full width |
| `studio/[tenantSlug]/settings/page.tsx`, `settings/payments/page.tsx`, `admin/billing/payment/page.tsx` | Quốc đã sửa — full width |
| `studio/[tenantSlug]/products/_ui/product-editor.tsx`, `editor-skeleton.tsx` | Đã bỏ `max-w-[1440px]` (task 2.3a) |
| `studio/[tenantSlug]/posts/_ui/post-editor.tsx`, `admin/settings/storage/page.tsx` | Quốc đã sửa |
| `studio/[tenantSlug]/coupons/new/page.tsx`, `coupons/[couponId]/page.tsx` | Đã bỏ hẳn `SettingsGrid` (task 2.6) — full width. Toàn `app/` không còn trang nào dùng `SettingsGrid` (component vẫn còn trong kit, 1 cột full width) |
| Khung trang khác trong `admin/**`, `studio/**` | **Không còn vi phạm.** `max-w`/`mx-auto` còn lại đều ở cấp component: đoạn mô tả `roles` (`max-w-2xl`), ô màu thương hiệu, ô bảng/ghi chú SMTP, trạng thái trống, khối lỗi ở giữa của `error.tsx` Studio (tổng quan, khách hàng, đơn hàng), ô ngày của bộ chọn khoảng ngày |

## 5. Đặc tả component

### 5.1. `ModuleTabs` (`apps/web/app/admin/_ui/module-tabs.tsx`, client)

```ts
type ModuleTabItem = { href: string; label: string; badge?: { count: number; srText: string; urgent?: boolean } };
<ModuleTabs label="Các trang trong Trang CMS" items={[…]} current="/admin/cms/home" mobile="auto" />
```

- `current` do trang truyền vào (trang biết mình là tab nào). Không cần `usePathname`.
- Markup: `<nav aria-label>` → `<ul>` → `<Link aria-current="page">`. **Không** dùng `role="tablist"`, vì tab ở đây là link
  điều hướng (WAI-APG).
- Mobile disclosure: `<button aria-expanded aria-controls>`. Esc đóng và trả focus về nút. Bấm ra ngoài hoặc chọn link
  thì đóng.
- Tab `min-h-11` dưới `lg`. Focus ring 2px primary. Badge số có chữ `sr-only`. **Không có dropdown**.
- Là client component để task 0.2 gắn được `onNavigate` (chặn rời trang khi chưa lưu).

### 5.2. `CollapsibleSection` kiểu Rank Math (`apps/web/app/admin/_ui/collapsible-section.tsx`, client)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ [ic] Tối ưu SEO                                    ( ✓ Tất cả đều tốt )  ⌄ │ ← cả dòng là <button>
│      Tiêu đề và mô tả hiển thị trên Google.                               │
├──────────────────────────────────────────────────────────────────────────┤
│  … nội dung (chỉ hiện khi mở; đóng thì `hidden`, không unmount) …         │
└──────────────────────────────────────────────────────────────────────────┘
   badge: ( ⚠ 2 lỗi ) đỏ · ( ● Có thay đổi ) cam · ( ✓ Tất cả đều tốt ) xanh · ( Chưa điền ) xám
```

| Thuộc tính | Hành vi |
|---|---|
| `id` | Slug ổn định. Gắn lên `<section id>` nên `#id` trên URL vừa cuộn tới vừa **mở** khối (deep link). |
| `title`, `description?`, `icon?`, `headingLevel?` (2 \| 3) | Tiêu đề là heading chứa `<button aria-expanded aria-controls>`. Chevron `aria-hidden`. |
| `status?` | Badge Rank Math: nền nhạt + chữ đậm + icon (không chỉ màu), tương phản ≥ 4.5:1. Helper `sectionStatus({ errorCount, warningCount, dirty, emptyLabel? })` → thứ tự ưu tiên lỗi > có thay đổi > cảnh báo > trống > "Tất cả đều tốt". Badge nằm trong tên truy cập của nút. |
| `defaultOpen?` | Trang đặt `true` cho khối đầu tiên. SEO luôn `false`. Cổng thanh toán: `defaultOpen={enabled}`. |
| `open?` / `onOpenChange?` | Controlled (tuỳ chọn). |
| `errorCount?` | Chuyển từ 0 sang > 0 thì **tự mở**. Người dùng đóng lại thì tôn trọng cho đến lần lỗi mới. |
| `actions?` | Toggle/nút phụ đặt **cạnh** nút tiêu đề, không lồng control vào trong nút. |
| `syncHash?` | Mở/đóng thì ghi/xoá `#id` bằng `history.replaceState`. Không `localStorage`, không query. |
| `revealSection(id)` | Hàm export: mở khối **đồng bộ** (`flushSync`) để khung tóm tắt lỗi focus được ô nằm bên trong ngay sau đó. |
| Panel | `role="region"` + `aria-labelledby` (tắt bằng `region={false}` khi trang có > 6 khối). `hidden` khi đóng, giữ state, input vẫn được gửi cùng form. |
| Chuyển động | Chỉ xoay chevron (`motion-reduce:transition-none`). Không animate height. |

### 5.3. Cảnh báo rời trang khi chưa lưu (task 0.2)

- `UnsavedChangesProvider` đặt ở layout `/admin` và `/studio`. Hook `useUnsavedChanges(dirty, message?)` để editor
  đăng ký trạng thái "có thay đổi".
- Chặn **điều hướng client**: `SidebarNav`, `ModuleTabs` (và link khác dùng `GuardedLink`) gọi `onNavigate` của
  `next/link`. Khi đang dirty thì `window.confirm` hỏi lại, người dùng chọn huỷ thì `e.preventDefault()`.
- Chặn **tải lại/đóng tab/link ngoài**: `beforeunload` (một chỗ chung, thay cho mỗi editor tự gắn).
- Ngoài phạm vi: nút Back/Forward của trình duyệt (popstate). App Router không có API chặn chính thức, ghi rõ là giới hạn.
- Thuần client UI, **không cần Hiếu**.

---

## 6. Danh sách task (mỗi task một lượt, Quốc duyệt rồi mới làm task sau)

Verify mỗi task: `pnpm --filter web exec tsc -p tsconfig.json --noEmit`, `eslint <file> --max-warnings=0`,
`pnpm --filter web build` (khi đổi layout/route), `pnpm test:count` giữ 100/66. Khi dev server chạy được thì kiểm tra
375px + desktop + bàn phím + reduced-motion.

### GĐ 0 — Nền tảng

| Task | File | Việc | Phụ thuộc | Hiếu | Xong khi |
|---|---|---|---|---|---|
| **0.1** | `admin/_ui/collapsible-section.tsx`, `admin/_ui/module-tabs.tsx` (mới) | Tạo 2 component theo §5.1–5.2. **Chưa áp vào trang nào** | — | Không | tsc/lint/build pass |
| **0.2** | `admin/_ui/unsaved-changes.tsx` (mới), `admin/_ui/sidebar-nav.tsx`, `module-tabs.tsx`, `admin/layout.tsx`, `studio/[tenantSlug]/layout.tsx` (JSX) | Cảnh báo rời trang theo §5.3 | 0.1 | Không | Bấm sidebar/tab khi dirty thì có hỏi lại |
| **0.3** | `admin/_ui/sidebar-nav.tsx` | Thêm `match?: string[]` (tiền tố, hoặc `=` cho khớp đúng) vào `SidebarNavLeaf` | — | Không | Menu chưa đổi, active vẫn như cũ |
| **0.4** | — (Quốc → Long) | Ghi §4–§5 vào `UI-Design-System.md` | 0.1–0.3 | Không | Long xác nhận |

### GĐ 1 — System Center

| Task | Trang / file | Việc | Phụ thuộc | Hiếu |
|---|---|---|---|---|
| **1.1** | `admin/cms/[slug]/page.tsx` (home), `admin/cms/menu/page.tsx` + `loading.tsx`, `admin/cms/page.tsx`, `sidebar-nav.tsx` | `ModuleTabs` "Trang CMS" (Trang chủ · Header & Footer). Sidebar: "Trang CMS" trỏ `/admin/cms/home` với `match`, bỏ "Menu & chân trang", thêm "Trang tuỳ chỉnh" (`/admin/cms`). Danh sách đổi tiêu đề thành "Trang tuỳ chỉnh" | 0.1–0.3 | **Có**: ẩn slug hệ thống trong truy vấn danh sách (task riêng của Hiếu) |
| **1.2** | `admin/cms/home-editor/home-sections-editor.tsx` | SEO trang chủ thành `CollapsibleSection` thu gọn, có badge. Kèm: nút Lên/Xuống ≥ 44px dưới `lg`, bỏ hex cứng | 0.1 | Không |
| **1.2b** | `admin/cms/home-editor/home-sections-editor.tsx` | Theo dõi "có thay đổi chưa lưu" phía client: so `sections` + SEO đang sửa với mốc đã nạp (nháp nếu có, không thì live), cập nhật mốc sau Lưu nháp/Xuất bản/Khôi phục. Gắn `useUnsavedChanges` (ADR-058 mục 5) và badge "Có thay đổi" ở thanh nút. Không đổi action | 0.2, 1.2 | Không |
| **1.3** | `admin/cms/menu/menu-editor.tsx` | 3 khối: Menu đầu trang (mở) · Nút kêu gọi (thu gọn) · Chân trang (thu gọn). Tóm tắt lỗi gọi `revealSection` | 0.1, 1.1 | Không |
| **1.4** | `admin/cms/pricing/_ui/pricing-sections-editor.tsx` | SEO thu gọn kiểu Rank Math | 0.1 | Không |
| **1.5** | `admin/cms/shop/_ui/shop-sections-editor.tsx` | **Đã làm (2026-10-25) — kết luận: không cần accordion.** Editor là list-detail (chỉ hiện 1 section đang chọn). Section dài nhất là Hero (khoảng 9 ô, 2 nhóm), mọi ô chữ đều bắt buộc, và không có khối SEO hay nhóm tuỳ chọn. Thu gọn nhóm bắt buộc trái quy tắc §4. Chỉ chuyển `beforeunload` sang `useUnsavedChanges`. Trang `/cua-hang` chưa có khối SEO trong CMS — **thuộc kế hoạch SEO tổng thể** (chủ dự án chốt gom mọi chức năng SEO vào kế hoạch riêng, làm sau) | 0.2 | Không |
| **1.6** | `admin/cms/phap-ly/legal-meta-form.tsx`, `admin/_ui/collapsible-section.tsx` | **Đã làm (2026-10-25).** Khối thu gọn tự viết thay bằng `CollapsibleSection` (`#seo`). Giữ hành vi ADR-057: thu gọn khi tải, tiêu đề luôn hiện "Đã điền x/3" + "Có thay đổi chưa lưu". `CollapsibleSection` nhận được nhiều badge (`status` là mảng), có thêm sắc `info`, và nhóm badge tự xuống dòng dưới tiêu đề khi thiếu chỗ | 0.1 | Không |
| **1.7** | `admin/settings/general/page.tsx`, `admin/settings/page.tsx`, `admin/settings/smtp/page.tsx`, `sidebar-nav.tsx` | `ModuleTabs` "Cấu hình chung" (Cấu hình chung · Email hỗ trợ · Cấu hình Email (SMTP)). Sidebar gộp 3 mục thành 1, dùng `match` | 0.1–0.3 | Không |
| **1.8** | `admin/settings/smtp/smtp-tabs.tsx` | Tab nội bộ thành tab ARIA thật (←/→, Home/End) | 1.7 | Không |
| **1.8b** | `admin/settings/smtp/smtp-tabs.tsx` | **Đã làm (2026-10-25):** giữ giá trị đã nhập khi lưu form lỗi. React 19 reset ô không kiểm soát sau mọi lần action chạy xong, kể cả khi trả lỗi. Cách sửa phía client: chụp giá trị lúc `onSubmit`, sau khi reset ghi lại vào ô, **trừ mật khẩu**. Form Cấu hình chung đã dùng ô có kiểm soát nên không bị lỗi này. Các form khác xem danh sách dưới bảng | 1.8 | Không |
| **1.9** | `admin/settings/general/general-settings-form.tsx` | 3 nhóm (Bảo mật & phiên · Chính sách phiên · Nghiệp vụ): nhóm đầu mở, nhóm sau thu gọn, badge lỗi/có thay đổi | 0.1 | Không |
| **1.10** | `admin/settings/storage/*` | **Tạm hoãn — chờ Vương xong ADR-055** (đang sửa vùng storage/MinIO, tránh xung đột). Khi làm: Cấu hình R2/MinIO (mở) · Đồng bộ dữ liệu (thu gọn) · Giám sát bucket (thu gọn). Đóng khối không dừng tiến trình | 0.1 | Không |
| **1.11** | `admin/billing/payment/*-form.tsx`, `page.tsx`, `admin/_ui/use-form-draft.ts` (mới) | **Đã làm (2026-10-25).** SePay · MoMo · QR thủ công: `defaultOpen={đang bật}`; badge "Đang bật"/"Đang tắt"/"Chưa cấu hình"/"N lỗi"/"Có thay đổi". Toggle đặt **trong** khối (không ở `actions`, để ô `isEnabled` vẫn thuộc form có key). Khối nằm ngoài `<form key>` để giữ trạng thái mở và thông báo tự tắt ADR-013. Lưu lỗi giữ giá trị đã nhập, không ghi lại secret (`useFormDraft`, dùng lại được cho 2.2 và các form trong bảng nguy cơ). Secret vẫn chỉ hiện `••••abcd` | 0.1, 1.8b | Không |
| **1.12a** | `admin/plans/plan-form.tsx` (+ `create-plan-form.tsx`), `admin/categories/category-form.tsx`, `admin/cms/cms-page-form.tsx`, các `page.tsx` của plans/categories | **Đã làm (2026-10-25).** Gói dịch vụ: 3 khối (Thông tin gói mở; Giới hạn sử dụng, Gói Free & tính năng thu gọn khi sửa, **mở cả 3 khi tạo mới** vì giới hạn mặc định 0 = không được phép). Danh mục: Thông tin mở; Mô tả chi tiết, Hình ảnh thu gọn; SEO luôn thu gọn. Trang tuỳ chỉnh: Nội dung mở, SEO thu gọn. Cả 3 form dùng `useFormDraft` (chỉ ghi lại giá trị khi lưu **lỗi**) + `useUnsavedChanges`. Sửa 5 thẻ `<main>` lồng | 0.1, 1.11 | Không |
| **1.12b** | `admin/_ui/in-page-tabs.tsx` (mới), `settings/branding/*`, `settings/cloudinary/*`, `settings/smtp/smtp-tabs.tsx` | **Đã làm (2026-10-25).** Tab nội bộ của Thương hiệu thành `InPageTabs` (tab ARIA kiểu pill, mọi panel luôn mounted — trước đây chuyển tab là mất dữ liệu Tên/Màu đang nhập). SMTP chuyển sang cùng component. Tên & Slogan: `useFormDraft` + badge + `useUnsavedChanges`; Màu (đã kiểm soát): badge + `useUnsavedChanges`. Cloudinary (1 khối, không accordion): `useFormDraft` (không ghi lại API key/secret), form có `key` để Toggle khớp khi bị tự tắt, badge + `useUnsavedChanges`. Báo cáo vi phạm: trang xử lý (không phải form cấu hình), không cần accordion. Sửa `<main>` lồng ở branding, cloudinary | 0.1, 1.11 | Không |
| **1.13** | `admin/users/page.tsx`, `admin/roles/page.tsx`, `admin/tenants/page.tsx`, `admin/settings/settings-form.tsx` | **Đã làm (2026-10-25).** Sửa `<main>` lồng (3 trang). Form "Email hỗ trợ": `useFormDraft` + badge + `useUnsavedChanges`. `settings/storage/page.tsx` sửa cùng 1.10 | — | Không |
| **1.14** | `cms/[slug]/page.tsx`, `cms/menu/page.tsx`, `settings/page.tsx`, `settings/general/page.tsx`, `settings/smtp/page.tsx`, `admin/error.tsx`, editor trang chủ, Bảng giá + các thanh nút | **Đã làm (2026-10-25)** — sửa lệch do Long rà GĐ 1: `metadata.title` riêng cho 5 trang tab ("Trang chủ — Trang CMS", "Header & Footer — Trang CMS", "Cấu hình chung", "Email hỗ trợ — Cấu hình chung", "Cấu hình Email (SMTP) — Cấu hình chung"); `admin/error.tsx` bỏ `<main>` lồng; câu mô tả SEO trang chủ và Bảng giá khớp action (Lưu nháp **và** Xuất bản đều ghi SEO vào cột live, áp dụng ngay nếu trang đã xuất bản); badge "Có thay đổi chưa lưu" dùng **một sắc chung `warning`** ở mọi thanh nút và khối | — | Không |
| **1.15** | 8 trang System Center: `settings/page.tsx`, `settings/cloudinary`, `plans` (form tạo), `plans/[planId]`, `categories/new`, `categories/[categoryId]`, `cms/new`, `cms/[slug]` | **Đã làm (2026-10-25).** Bỏ `SettingsGrid`, xếp 1 cột full width. System Center không còn trang nào dùng `SettingsGrid` (trừ Storage — 1.10) | — | Không |

**Form có nguy cơ mất dữ liệu khi lưu lỗi** (rà 2026-10-25, task 1.8b). Các form dưới đây dùng `useActionState` + `<form action>`
với ô không kiểm soát. Mỗi form xử lý ở task áp dụng tương ứng, bằng cùng cách của SMTP (không ghi lại secret/mật khẩu):

| Mức | Form | Task xử lý |
|---|---|---|
| Cao (nhiều ô `defaultValue`) | `admin/billing/payment/{sepay,momo,manual-qr}-form.tsx` (có secret) | 1.11 (đã làm) |
| Cao | `admin/settings/storage/storage-form.tsx` (có secret) | 1.10 |
| Cao | `admin/plans/plan-form.tsx`, `admin/cms/cms-page-form.tsx`, `admin/categories/category-form.tsx` (một phần) | 1.12a (đã làm) |
| Cao | `admin/settings/cloudinary/cloudinary-form.tsx` (có secret), `admin/settings/branding/branding-editor.tsx` (một phần) | 1.12b (đã làm) |
| Cao | `studio/[tenantSlug]/settings/payments/{sepay,momo,manual-qr}-form.tsx` (có secret), `settings/branding-form.tsx` | 2.1, 2.2 (đã làm) |
| Cao | `studio/[tenantSlug]/coupons/coupon-form.tsx` | 2.6 |
| Thấp (1–2 ô) | `admin/settings/settings-form.tsx` (Email hỗ trợ) → 1.13 (đã làm); `studio/[tenantSlug]/settings/slug-form.tsx` → 2.1 (đã làm); `billing/renew-form.tsx` → 2.7 (đã làm: `useFormDraft` giữ lựa chọn gói/phương thức, không cảnh báo rời trang); `billing/refund-request-form.tsx` → **không cần**: gửi qua `onSubmit` trong transition (không qua prop `action`) nên React không reset form | đã xử lý (2026-10-25) |
| Cần rà kỹ | `studio/onboarding-form.tsx` → 2.1 (đã làm); `products/[productId]/share-links/share-link-form.tsx` → 2.3b (đã làm); `orders/[orderId]/order-note-actions.tsx`, `customers/_ui/customer-row-actions.tsx` → rà ở 2.6: **không cần** — ô ghi chú là ô có kiểm soát (`value` + state), React không reset khi lưu lỗi; ghi chú khách nằm trong dialog, lỗi hiện ngay trong hộp và hộp vẫn mở | đã rà (2026-10-25) |
| Không bị | `admin/settings/general/general-settings-form.tsx` (đã kiểm soát), `product-editor.tsx`, `post-editor.tsx`, `reports/_ui/report-actions.tsx`, `billing/refunds/refund-actions.tsx` (không dùng `<form action>`), các form chỉ có nút xác nhận | — |

**Trạng thái GĐ 1 (2026-10-25):** đã xong 1.1, 1.2, 1.2b, 1.3, 1.4, 1.5 (kết luận không cần accordion), 1.6, 1.7, 1.8,
1.8b, 1.9, 1.11, 1.12a, 1.12b, 1.13, 1.14. Còn duy nhất **1.10 tạm hoãn** (chờ Vương xong ADR-055). 1.15 đã làm.

### GĐ 2 — Studio

| Task | Trang / file | Việc | Phụ thuộc | Hiếu |
|---|---|---|---|---|
| **2.1** | `studio/[tenantSlug]/settings/page.tsx`, `settings/payments/page.tsx`, `settings/_ui/settings-tabs.ts` (mới), `branding-form.tsx`, `slug-form.tsx`, `studio/onboarding-form.tsx` + `studio/page.tsx` | **Đã làm (2026-10-25).** `ModuleTabs` "Cài đặt" (Thông tin & thương hiệu · Thanh toán), h1 "Cài đặt"; bỏ link chữ cuối trang; sửa `<main>` lồng 2 trang. Sidebar **không cần `match`**: href `/settings` đã khớp tiền tố `/settings/payments` (đã rà bằng script). `useFormDraft` + `useUnsavedChanges` cho 3 form. `branding-form` dùng `keepOnSuccess` vì action không `revalidatePath` (xem việc cho Hiếu). Trang onboarding nằm ngoài layout Studio → tự bọc `UnsavedChangesProvider` | 0.1–0.3 | **Đề xuất:** `updateBrandingAction` thêm `revalidatePath` |
| **2.2** | `studio/[tenantSlug]/settings/payments/*-form.tsx`, `page.tsx` | **Đã làm (2026-10-25).** Như 1.11: QR thủ công · SePay · MoMo là khối thu gọn, `defaultOpen={đang bật}`, badge "Đang bật"/"Đang tắt"/"Chưa cấu hình"/"1 lỗi"/"Có thay đổi"; khối ngoài `<form key>` (form mới có `key` để Toggle khớp khi tự tắt); `useFormDraft` không ghi lại `secret`/`secretKey`; `useUnsavedChanges`; xếp 1 cột. Dòng cảnh báo tự tắt giữ nguyên | 1.11 | Không |
| **2.3a** | `studio/[tenantSlug]/products/_ui/product-editor.tsx`, `editor-skeleton.tsx` | **Đã làm (2026-10-25).** Giữ bố cục 2 cột, không thêm tab. Khối thu gọn: Thông tin tài liệu (mở), Giá & khuyến mãi (thu gọn khi Sửa, **mở khi Tạo** — giá 0 = miễn phí), Danh mục & loại, Thẻ, Giới hạn lượt tải, Link chia sẻ private (thu gọn). Badge: "N lỗi" > "Có thay đổi" > tóm tắt (giá "Miễn phí"/"50.000 ₫", tên danh mục / "Chưa chọn danh mục"). Ảnh đại diện, Tệp tài liệu (component riêng — Vương vừa sửa) và card Xuất bản **không thu gọn**. Tóm tắt lỗi mở đúng khối. `beforeunload` → `useUnsavedChanges` (gồm cả lúc còn file đang tải). Bỏ `max-w-[1440px]` (full width) | 0.1, 0.2 | Không |
| **2.3b** | `products/[productId]/share-links/page.tsx`, `share-link-form.tsx`, `admin/_ui/use-form-draft.ts` | **Đã làm (2026-10-25).** `useFormDraft` (không ghi lại mật khẩu link) + badge + `useUnsavedChanges` (tắt khi đã tạo link); `useFormDraft` hỗ trợ nhóm checkbox cùng tên. Nhóm chọn file thành `fieldset/legend`, dòng ≥ 44px. Sửa `<main>` lồng; bỏ `SettingsGrid` | 0.1 | Không |
| **2.4** | `posts/_ui/post-editor.tsx` | **Đã làm (2026-10-25).** Khối thu gọn: Nội dung bài viết (mở), Tài liệu liên quan (thu gọn, badge "Đã gắn 1 tài liệu"/"Không gắn"), Ghim bài (thu gọn, badge "Đang ghim"/"Không ghim"); "N lỗi"/"Có thay đổi" ưu tiên hơn tóm tắt. Card Xuất bản và chế độ xem bài bị ẩn không đổi. Tóm tắt lỗi mở đúng khối. `beforeunload` → `useUnsavedChanges`. Cùng lưu ý tự lưu nháp như 2.3a: `dirty` giữ nguyên là nguồn sự thật, `changedFields` chỉ cho badge và tự xoá khi `dirty` về false | 0.1, 0.2 | Không |
| **2.5** | `storefront/storefront-editor.tsx`, `storefront/page.tsx` | **Đã làm (2026-10-25) — kết luận: không cần accordion.** List-detail chỉ hiện 1 section; section dài nhất (Đánh giá, Tài liệu) khoảng 8–10 điều khiển. "Đánh giá ghim"/"Tài liệu nổi bật" đổi hành vi hiển thị (có ghim → chỉ hiện mục ghim) nên không giấu. Badge "Có thay đổi chưa lưu" → `warning`; `beforeunload` → `useUnsavedChanges`; sửa `<main>` lồng | 0.2 | Không |
| **2.6** | `coupons/coupon-form.tsx`, `coupons/page.tsx`, `coupons/new/page.tsx`, `coupons/[couponId]/page.tsx`, `messages/page.tsx`, `products/page.tsx` | **Đã làm (2026-10-25).** Form mã giảm giá thành 4 khối: Thông tin mã (mở) · Điều kiện & giới hạn lượt dùng · Thời gian áp dụng · Áp dụng cho sản phẩm (thu gọn, badge tóm tắt "Không giới hạn"/"Có điều kiện", "Áp dụng ngay, không hết hạn"/"Có thời hạn", "Tất cả sản phẩm"/"N sản phẩm"; "Có thay đổi" ưu tiên). Mọi ô thu gọn đều tuỳ chọn, trống = không giới hạn → thu gọn cả ở trang Tạo. `useFormDraft` (thêm trả `values` cho badge) + `useUnsavedChanges`. Nhóm chọn sản phẩm: `fieldset/legend` rõ, dòng ≥ 44px. Rà 2 form ghi chú (xem bảng nguy cơ): không cần sửa. Sửa `<main>` lồng ở 3 trang coupons + `messages`, `products` (đóng danh sách 9 trang); bỏ import `SettingsGrid` | 0.1, 1.8b | Không |

| **2.7** | `settings/branding-form.tsx`, `products/_ui/product-editor.tsx`, `settings/page.tsx`, `settings/payments/page.tsx`, `billing/renew-form.tsx`, `share-link-form.tsx`, `coupon-form.tsx` | **Đã làm (2026-10-25)** — sửa lệch do Long rà GĐ 2: comment `keepOnSuccess` (giữ, action đã `revalidatePath`); bỏ comment "khung tối đa 1440px"; `metadata.title` "Thông tin & thương hiệu — Cài đặt", "Thanh toán — Cài đặt"; `renew-form` giữ lựa chọn khi lỗi, `refund-request-form` không cần (lý do ở bảng nguy cơ); `legend`/nhãn checkbox dùng `brandColors.ink` thay hex | — | Không |

**`<main>` lồng ở Studio** (rà 2026-10-25, layout Studio đã có `<main>`): **đã sửa đủ 9 trang** — `settings`, `settings/payments`
(2.1/2.2), `share-links` (2.3b), `storefront` (2.5), `coupons` ×3, `messages`, `products` (2.6). `studio/page.tsx` không nằm
trong layout Studio nên không lồng. Badge "Có thay đổi chưa lưu" của `storefront-editor.tsx` đã đổi sang `warning` (2.5).

**Trạng thái GĐ 2 (2026-10-25):** đã xong 2.1, 2.2, 2.3a, 2.3b, 2.4, 2.5 (kết luận không cần accordion), 2.6, 2.7. Không còn
task hoãn trong GĐ 2. Việc mở đề xuất cho Hiếu: `updateBrandingAction` thêm `revalidatePath` — Quốc đã tự làm.

Thứ tự: 0.1 → 0.2 → 0.3 → 1.1 → 1.2 → 1.2b → 1.3 → 1.7 → 1.8 → 1.4 → 1.8b → 1.9 → 1.11 → 1.5 → 1.12a → 1.12b → 1.13 → 1.14 → 1.15 → (1.10 khi Vương xong ADR-055) → (1.6 khi phiên `/phap-ly`
xong) → 2.1 → 2.2 → 2.3a → 2.3b → 2.4 → 2.5 → 2.6. Task Hiếu (ẩn slug hệ thống ở `/admin/cms`) làm song song sau 1.1.

---

## 7. Checklist chấp nhận mỗi task

- [ ] URL không đổi. Back/Forward đúng. Deep link tới tab và `#khối` hoạt động.
- [ ] `ModuleTabs`: đúng 1 link `aria-current="page"`. Sidebar sáng đúng mục.
- [ ] `CollapsibleSection`: `aria-expanded`/`aria-controls` đúng. Khối đầu mở, SEO thu gọn. Lỗi thì tự mở. Badge có chữ.
- [ ] Focus thấy được. Target ≥ 44px dưới `lg`. 375px không cuộn ngang. Reduced-motion tắt chuyển động.
- [ ] Tương phản ≥ 4.5:1. Không hex cứng cho màu thương hiệu. Dấu tiếng Việt đúng.
- [ ] Trang giữ đủ loading/empty/error. Không có `localStorage` mới.

## 8. Câu hỏi còn mở

Không còn. Hai câu hỏi trước (trang tuỳ chỉnh, tab cấp tài liệu Studio) đã chốt ở Bổ sung ADR-058.

## 9. Tác động tài liệu

- **Long:** thêm mục "Điều hướng nhóm trang (`ModuleTabs`) & accordion (`CollapsibleSection`)" vào `UI-Design-System.md`
  (quy tắc §4, spec §5). Cập nhật §5 (bảng kit), §12.6 (menu System Center), §11.1 (sidebar Studio).
- **Hiếu:** danh sách `/admin/cms` loại các slug hệ thống (home, menu, shop, pricing; dùng `isSystemCmsSlug`) **trong
  truy vấn** `findMany` + `count`, để phân trang khớp. Giao diện không đổi gì thêm.

## 10. Nguồn skill (ui-ux-pro-max)

`--domain ux`: Breadcrumbs, Deep Linking, Active State, Focusable Error Summary, Error Placement, Keyboard Navigation,
Sticky Navigation. `--stack nextjs`: `next/link`. Quick Reference: `nav-hierarchy`, `avoid-mixed-patterns`,
`progressive-disclosure`, `horizontal-scroll`, `touch-target-size`, `reduced-motion`, `transform-performance`,
`contextual-live-badge-updates`, `focus-not-obscured`. Dataset không có mục accordion/disclosure (đã tra 2 lần), nên spec
§5.2 dựa theo WAI-ARIA APG (Disclosure/Accordion) và mẫu `LegalMetaForm`. Next 16 `Link.onNavigate`: đọc ở
`node_modules/next/dist/docs/01-app/03-api-reference/02-components/link.md`.

# Phân tích layout frontend công khai và blog — 2026-10-27

> Người viết: **Phong** (UX/UI). Brief: Quốc, 2026-10-27. Đây là **bản phân tích, không phải quyết định**. Mọi điểm
> nghiệp vụ ở §11 cần chủ dự án chốt trước khi Long viết kế hoạch. Không sửa code trong bước này.
> Nguồn: đọc code runtime (`apps/web/app/**`, `globals.css`, `packages/db/prisma/schema.prisma`, migration RLS
> `rls_m10b_posts`, `packages/core/src/tenant/slug.ts`, `product/path.ts`), ADR-024/025/029/054/060, `UI-Design-System.md`,
> ba ảnh tham khảo 7/8/9, skill `ui-ux-pro-max`.

---

## 0. Tóm tắt

1. **Chưa có blog hệ thống.** Chỉ có bài viết của tenant (M10b, ADR-029): `/[tenantSlug]/posts` và
   `/[tenantSlug]/posts/[postId]`. ADR-029 mục 5 ghi rõ **"Feed xuyên tenant ngoài phạm vi"**. Muốn blog hệ thống trộn
   bài studio thì phải có **ADR mới**.
2. **Chưa có danh mục bài viết.** `DocumentCategory` chỉ dùng cho tài liệu (sản phẩm). Model `Post` không có danh mục,
   slug, ảnh bìa, tác giả cá nhân hay lượt xem, và **bắt buộc có `tenantId`**, nên chưa chứa được bài của hệ thống.
3. **Khung trang công khai đang bị chép lại ở ≥ 9 chỗ** (div bọc + skip-link + `SiteHeader` + `main` + `SiteFooter`)
   và lệch nhau giữa các bản: `/p/[slug]` còn header riêng, logo "G" gõ cứng, không có footer, không skip-link;
   `/cua-hang` không có skip-link. Breadcrumb có **5 kiểu** khác nhau. H1 có **5 thang cỡ chữ**.
4. **Có hai hệ chữ đọc dài:** trang pháp lý (16/17px, dòng 1.75, khối chữ 38em ≈ 75 ký tự) đã đạt chuẩn. Bài viết
   chỉ có 15px, khối chữ ~688px nên **~88–92 ký tự/dòng**, vượt mức 65–75 và dưới mức tối thiểu 16px trên mobile.
5. **Đề xuất:** 4 template (`PublicPageShell` → `ProseLayout` / `ArticleLayout` / `ListingLayout`), một lớp chữ
   `.gieochu-prose` thống nhất, 8 component dùng chung. Chia **7 giai đoạn** độc lập, deploy riêng được: **GĐ0–GĐ3
   không cần đổi DB**, GĐ4–GĐ6 cần CMS và model mới.

---

## 1. Kiểm kê hiện trạng

### 1.1. Route công khai

| Route | File | Khung (shell) | Độ rộng | Ghi chú |
|---|---|---|---|---|
| `/` | `app/page.tsx` + `_home-sections.tsx` | tự dựng: skip-link + `SiteHeader`/`SiteFooter` | section full-bleed + `container-page` | CMS trang chủ (ADR-033) |
| `/pricing` | `pricing/layout.tsx` | **layout segment**: skip-link + header (`current="pricing"`) + footer | `container-page` | có `loading`/`error` |
| `/cua-hang`, `/cua-hang/tai-lieu` | `cua-hang/layout.tsx` | layout segment: header + footer | `container-page` | **không có skip-link**, `<main>` không có `id="noi-dung"` |
| 7 trang pháp lý `/{slug}` (`dieu-khoan-su-dung`, `chinh-sach-bao-mat`, `lien-he`…) | route mỏng → `_ui/legal-document-page.tsx` | tự dựng trong `LegalDocumentView` | `container-page` + lưới `220px │ minmax(0,768px)` | TOC từ H2, breadcrumb, nút lên đầu, bản in. **Tốt nhất hiện có** |
| `/phap-ly/xem-truoc` | admin xem trước | dùng lại `LegalDocumentView` | như trên | |
| `/p/[slug]` | `p/[slug]/page.tsx` | **header riêng** (logo chữ "G" gõ cứng, chỉ có link Đăng nhập), **không footer**, **không skip-link**, tự khai `next/font` lần thứ hai | `container-prose` | CMS `CmsBlocks` (hero/features/stats/testimonials/pricingTable/faq/richText/cta) |
| `/[tenantSlug]` | storefront | tự dựng; nền `bg-white`; `<main class="sf-root">` theme tenant | `container-page` (`CONTAINER`) | section "Bài viết" (`storefront-posts.tsx`) |
| `/[tenantSlug]/[productSlug]` | trang tài liệu | tự dựng | `container-page`, lưới 7/5 | breadcrumb "← tên tenant" |
| `/[tenantSlug]/checkout/*` | `checkout/layout.tsx` | layout segment | `container-page` (ADR-062) | có `loading`/`error` |
| `/[tenantSlug]/posts` | danh sách bài tenant | tự dựng | `container-page` | 12 bài/trang, `?cursor=`, bài ghim đứng đầu. **Không có `loading`/`error`** |
| `/[tenantSlug]/posts/[postId]` | chi tiết bài | tự dựng | `container-prose` + `<article>` thẻ trắng | **Không có `loading`/`error`** |
| `/s/[token]` | link chia sẻ | riêng | `max-w-m…` (tự đặt) | ngoài phạm vi đợt này, ghi nhận lệch ADR-024 |

### 1.2. Mô hình dữ liệu liên quan (chỉ đọc `schema.prisma`)

**`Post` (L2, RLS):** `id`, `tenantId` (bắt buộc), `title?` (≤ 200), `body` (HTML đã sanitize, ≤ 6 ảnh Cloudinary),
`excerpt` (≤ 300, tự sinh), `productId?` (1 tài liệu gắn kèm), `status` DRAFT/PUBLISHED/HIDDEN, `isPinned` (≤ 1 bài/tenant),
`publishedAt`, `updatedAt`, các trường kiểm duyệt. Loader công khai (`lib/post.ts`) trả thêm `imageUrl`, lấy từ **ảnh đầu
tiên trong body** rồi tối ưu 640px.

| Trường blog cần | Hiện có? | Ghi chú |
|---|---|---|
| Tiêu đề, trích đoạn, nội dung, ngày đăng/cập nhật | ✅ | tiêu đề tuỳ chọn → `postDisplayTitle()` |
| Ảnh bìa | ⚠️ suy ra | ảnh đầu tiên của body. Không có trường `coverImageUrl` và không có alt riêng |
| Slug (URL đẹp) | ❌ | URL dùng `postId` (cuid2) |
| Danh mục | ❌ | không có `PostCategory`, không có `Post.categoryId` |
| Tác giả | ⚠️ | chỉ có **gian hàng** (Tenant: `name`, `bio`, `logoKey`, `branding.socialLinks`). Không có `authorId` (staff/người viết) |
| Thời gian đọc | ⚠️ suy ra được | tính ở server từ `body` (đếm chữ). **Không cần cột DB** |
| Bài nổi bật | ⚠️ | blog tenant: `isPinned` dùng được. Blog hệ thống: chưa có |
| Bài của hệ thống | ❌ | `tenantId` bắt buộc. Cần model riêng |
| Bình luận / thả tim / theo dõi | ❌ | M10c đang nằm trong BACKLOG (ADR-029 mục 1) |
| Đăng ký nhận tin | ❌ | không có bảng subscriber/consent |
| Tìm kiếm bài | ❌ | không có full-text cho `posts` |
| Lượt xem | ❌ | không cần ở đợt này |

**Khác:**
- `CmsPage` (L1): `slug`, `title`, `blocks` (JSON), `blocksDraft`, `status`, `seoTitle`, `seoDescription`. Đây là nơi tự
  nhiên để lưu **cấu hình trang blog hệ thống** (hero, khối CTA), giống mẫu `home`/`shop` (`isSystemCmsSlug`).
- `DocumentCategory` (L1): `slug`, `name`, `shortDescription`, `description`, `imageUrl`, SEO, `ogImageUrl`, `isActive`.
  **Nên lấy làm mẫu** cho `PostCategory`.
- `LegalDocument`/`LegalDocumentVersion`: có `summary`, `seoTitle`, `seoDescription`. Trang pháp lý đã đủ dữ liệu.

### 1.3. Header/footer và khung trang

- `SiteHeader`/`SiteFooter` (`app/_ui/`) đã dùng chung, đọc menu từ CMS (ADR-050), tự gắn `systemFontVars`. Đây là phần ổn.
- Phần **bọc ngoài** header/footer thì đang chép lại thủ công ở trang chủ, storefront (2 lần), trang tài liệu, posts
  (2 file), pháp lý, `pricing/layout`, `cua-hang/layout`, `checkout/layout`. Các bản chép lệch nhau:
  - skip-link dùng `--color-primary` ở chỗ này và `--brand-primary,#0F3B82` ở chỗ khác. Hai cách viết này cùng màu, chỉ lệch cú pháp;
  - có trang dùng `flex min-h-dvh flex-col` + `main.grow` (footer luôn nằm đáy), có trang chỉ `min-h-dvh` (trang ngắn thì footer bị kéo lên giữa);
  - có trang dùng `overflow-x-clip`, có trang không;
  - nền: cream (`background`) ở hầu hết trang, nhưng storefront là `bg-white`.
- `/p/[slug]` chưa dùng chrome hệ thống. `UI-Design-System.md` §4.6 đã ghi nhận và đang chờ ở BACKLOG.

### 1.4. Độ rộng (ADR-024)

| Utility | Trần | Đang dùng ở |
|---|---|---|
| `container-page` | 1280px | trang chủ, cửa hàng, storefront, tài liệu, checkout, posts list, pháp lý (bọc lưới) |
| `container-prose` | 768px | `/p/[slug]`, posts detail |
| `container-narrow` | 448px | auth, (checkout cũ) |

Đo thực tế độ dài dòng của nội dung đọc. Ước lượng với Inter tiếng Việt, trung bình ~0.5em/ký tự:

| Trang | Cỡ chữ | Bề rộng khối chữ | Ký tự/dòng (desktop) | Đánh giá |
|---|---|---|---|---|
| Pháp lý | 16 → 17px (lg) | `max-width: 38em` ≈ 608–646px | ~75 | ✅ đạt |
| `/p/[slug]` richText | 16/17px (dùng lại `.gieochu-legal-content`) | 38em | ~75 | ✅ đạt |
| Bài viết tenant | **15px** | 768 − 2×40 (padding thẻ) = **688px** | **~88–92** | ❌ dòng quá dài, chữ < 16px |
| Mô tả tài liệu | 15px (`max-w-prose` 65ch) | ~65ch | ~70 | ⚠️ chữ 15px |

### 1.5. Typography trong `globals.css`

- `.gieochu-rich-content`: 15px, dòng 1.7, H1–H4 theo `em`. Lớp này **dùng chung với editor** (WYSIWYG). Nếu đổi cỡ chữ ở
  đây thì editor Studio cũng đổi theo, nên cần quyết có tách không (đề xuất ở §4.1).
- `.gieochu-legal-content` (dùng KÈM rich-content): 16/17px, dòng 1.75, measure 38em, H2 có vạch ngăn, danh sách lồng
  đổi kiểu dấu, link gạch chân dày khi hover/focus, blockquote thành ô ghi chú, `scroll-padding` cho anchor, bản in.
  Lớp này đã đạt chuẩn đọc dài nhưng **tên gắn với "legal"**, trong khi `/p/[slug]` cũng đang mượn nó.
- Màu trong hai lớp là hex fallback của token (`#12213a`, `#55607a`, `#e7dfc9`…), có ghi chú rõ. Chấp nhận được trong CSS
  toàn cục, nhưng khi System Admin đổi brand thì các màu chữ này **không đổi theo**. Hiện token `ink`/`line` cũng là hex
  tĩnh, nên chưa phát sinh lỗi.

### 1.6. Các điểm không thống nhất (tổng hợp)

| # | Hạng mục | Hiện trạng | Mức |
|---|---|---|---|
| 1 | Shell trang | ≥ 9 bản chép tay; `/p/[slug]` không có header/footer hệ thống; `/cua-hang` thiếu skip-link | Cao |
| 2 | Breadcrumb | 5 kiểu: pháp lý (`Trang chủ › Tiêu đề`, icon chevron, `aria-current` ở span) · tài liệu cửa hàng (dấu `/`, `aria-current` ở `li`) · posts list, trang tài liệu, checkout (`← Tên tenant`, 1 mục) · posts detail (`Tenant / Bài viết`, không có mục hiện tại) · `/p` (không có) | Trung bình |
| 3 | H1 | pháp lý 28/36 semibold · posts list 30/36 extrabold · post detail 24/30 extrabold · `/p` 30/36 semibold · checkout 24/30 bold | Trung bình |
| 4 | Khoảng cách dọc `main` | pháp lý `py-8/12/14` · posts `pt-4/6 pb-16/20` · `/p` `py-14/20` | Thấp |
| 5 | Chữ đọc dài | xem §1.4: bài viết 15px, ~90 ký tự/dòng | Cao (đọc trên điện thoại) |
| 6 | Trạng thái | posts list có `EmptyState` (tốt). Hai route posts thiếu `loading.tsx`/`error.tsx`, trong khi pricing/cửa hàng/checkout có | Trung bình |
| 7 | Thẻ bài | 2 bản gần giống nhau: `PostSummaryCard` (hệ thống) và thẻ trong `storefront-posts.tsx` (theme `--sf-*`). Bóng đổ khác nhau, `RelatedDocuments` lại một kiểu khác. Chưa có thang elevation | Thấp |
| 8 | TOC | chỉ trang pháp lý có (`legal-toc.ts` gắn `id` cho H2). Bài viết dài không có | Trung bình |
| 9 | `/p/[slug]` | nút CTA chữ trắng trên `accent` #D97706 ≈ **3.2:1** (chữ 14px đậm, không đủ "large text") ❌ AA. FAQ là đoạn văn tĩnh, chưa thành accordion. Bảng giá 4 cột bị nhét trong cột 768px | Cao (a11y) |
| 10 | Font | `/p/[slug]` khai lại `Be_Vietnam_Pro`/`Inter` thay vì dùng `systemFontVars` | Thấp |

---

## 2. Đánh giá ba ảnh mẫu

Bối cảnh Gieo Chữ: người đọc là giáo viên, phụ huynh, học sinh, **phần lớn dùng điện thoại**, mạng có lúc chậm. Mục đích
kinh doanh của blog là **dẫn người đọc tới tài liệu để mua/tải**. Giữ nguyên theme kem `#FFF7E9` và navy `#0F3B82`/`#12213A`,
cam `accent` dùng cho CTA. **Không lấy tím.**

### 2.1. Ảnh 7 — blog hệ thống (SmartByteLabs)

| Lấy | Bỏ / sửa |
|---|---|
| Hero ngắn gồm H1, 1 câu mô tả và ô tìm kiếm. Mục đích của trang rõ ngay màn đầu | Ảnh minh hoạ lớn bên phải hero (tốn băng thông, ẩn trên mobile). Thay bằng nền kem + họa tiết nhẹ, hoặc bỏ hẳn |
| Hàng danh mục đặt ngay dưới hero | **Thẻ danh mục to có icon tròn**: trên 375px, 4 thẻ cao ~120px đẩy bài xuống dưới màn đầu. Đổi thành **hàng chip cuộn ngang** trên mobile (có gợi ý cuộn, mỗi chip ≥ 44px), lưới chip trên desktop |
| Thẻ bài gồm ảnh 16:9, nhãn danh mục, ngày, tiêu đề, thời gian đọc | Link "See Full Article →" riêng trên mỗi thẻ: thừa vì cả thẻ đã bấm được (stretched link, như `PostSummaryCard`). Bỏ để giảm tab-stop |
| Lưới 3 cột desktop → 1 cột mobile | Nhãn danh mục chữ cam nhỏ: cam `#D97706` trên trắng ≈ 3.2:1, **không đạt** cho chữ 12px. Dùng chip nền `accentSoft` chữ `ink`, hoặc chữ `primary` |
| Nút "Xem thêm" ở cuối lưới | Khối "Get Notified" dùng ô email. Chỉ làm khi chủ dự án chốt đăng ký nhận tin (§11 Q6) |

### 2.2. Ảnh 8 — blog studio (Untitled UI)

| Lấy | Bỏ / sửa |
|---|---|
| **Bài nổi bật** là ảnh lớn có chữ đè: hợp với `isPinned` đã có | Chữ trắng trực tiếp trên ảnh: tương phản phụ thuộc ảnh. Bắt buộc phủ gradient tối (`primaryDeep` ~70% ở 50% dưới), hoặc trên mobile đặt chữ **dưới** ảnh. Đề xuất: mobile chữ dưới ảnh, desktop chữ đè có gradient |
| Thẻ "Bài viết gần đây" gồm ảnh, tiêu đề, mô tả 2–3 dòng, dòng tác giả + ngày | Avatar người viết từng bài: Gieo Chữ chưa có tác giả cá nhân (§1.2). Dùng **logo + tên gian hàng** ở trang hệ thống. Ở blog tenant thì bỏ dòng tác giả vì mọi bài cùng một gian hàng |
| Nút "Tải thêm" ở cuối trang | Footer đen nhiều cột: đã có `SiteFooter` hệ thống |
| Khối CTA cuối trang | Đổi CTA thành **"Xem tài liệu của {tên gian hàng}"** (về storefront) thay vì CTA chung chung |
| Rất ít thành phần, nhiều khoảng trắng: hợp với người đọc lớn tuổi | Ảnh full-bleed sát mép màn trên mobile: giữ lề 16px theo `container-page` |

### 2.3. Ảnh 9 — single post (Crypto Chat)

| Lấy | Bỏ / sửa |
|---|---|
| Breadcrumb `Trang chủ › Blog › Bài` | Hai banner quảng cáo chen giữa nội dung và ở sidebar. Không làm. Vị trí đó dành cho **thẻ "Tài liệu liên quan"** (`post.product`, đã có) |
| Ảnh bìa, nhãn danh mục, H1, meta (tác giả · ngày · thời gian đọc) | Đếm "bình luận" trong meta: chưa có bình luận (M10c) |
| Nút chia sẻ | Dải icon mạng xã hội nhỏ (~20px, dưới 44px), tải script bên thứ ba (vướng CSP nonce ADR-016). Dùng **Web Share API** (mobile) + nút "Sao chép liên kết" + link Facebook/Zalo dạng URL thuần, không SDK |
| Nội dung có H2/H3 rõ, đoạn ngắn | Cột nội dung khoảng 430px trong ảnh: quá hẹp ở desktop. Ở mobile thì sidebar phải xuống **sau** nội dung |
| Hộp tác giả cuối bài | Form "Leave a reply" (chưa có bình luận) |
| Sidebar: bài gần đây, danh mục | "Follow us" và "Newsletter" trong sidebar: chỉ làm theo quyết định ở §11. Sidebar Gieo Chữ ưu tiên **mục lục (TOC) dính** + **tài liệu liên quan** vì đây là chỗ ra chuyển đổi |

### 2.4. Đối chiếu skill `ui-ux-pro-max` (các quy tắc đã tra/áp)

- `line-length-control` / `line-length` (ux: "Limit to 65-75 characters per line", Medium) → measure 38em, chữ ≥ 16px.
- `readable-font-size` (ux: "Minimum 16px body text on mobile", High) → bài viết đang 15px là vi phạm.
- `breadcrumb-web` / ux "Breadcrumbs" (dùng khi ≥ 3 cấp) → blog hệ thống › danh mục › bài là 3 cấp nên **cần** breadcrumb.
  Danh sách 1 cấp thì không bắt buộc, nhưng giữ một component chung để vị trí nhất quán (`navigation-consistency`).
- `color-contrast` / `color-not-only` → nhãn danh mục cam, chữ đè ảnh, nút CTA `/p` (§1.6 #9).
- `touch-target-size`, `touch-spacing` → chip danh mục, nút chia sẻ, phân trang ≥ 44px, khoảng cách ≥ 8px.
- `image-dimension`, `lazy-load-below-fold`, `content-jumping` → ảnh thẻ cố định `aspect-[16/9]` (đã có), ảnh bìa
  single post đặt `aspect-ratio` và `fetchpriority="high"`, ảnh còn lại lazy.
- ux "Lazy Loading" + `progressive-loading` → `loading.tsx` dạng skeleton lưới thẻ.
- `back-behavior` / `state-preservation` / `deep-linking` → "Xem thêm" phải đổi URL (`?cursor=` / `?trang=`) để nút Back
  và link chia sẻ giữ đúng vị trí. **Không cuộn vô hạn.** Tra "infinite scroll load more" không có kết quả khớp, nên chỗ này
  là suy luận chung từ `back-behavior` + `deep-linking`.
- `focus-not-obscured` → TOC dính và header dính không được che phần tử đang focus (pháp lý đã xử lý bằng `scroll-padding`).
- `auto-rotation-controls` → **không** làm carousel bài nổi bật tự chạy.
- `primary-action` → mỗi màn chỉ có một CTA chính. Ở single post đó là "Xem tài liệu".
- `heading-line-balance`, `long-token-wrapping` → `text-balance` cho H1, `overflow-wrap:anywhere` cho tiêu đề (đã dùng).
- Stack nextjs: gợi ý `next/image`. Dự án đang dùng `<img>` + URL Cloudinary tối ưu sẵn (có eslint-disable kèm lý do).
  **Giữ cách hiện tại**, chỉ thêm `srcset`/`sizes` từ `cloudinaryDeliveryUrl`. Không đổi sang `next/image` trong đợt này.
- Tra `--domain landing "blog article layout"` không có kết quả khớp, nên bố cục blog trong tài liệu này dựa trên quy tắc ux
  ở trên và ảnh mẫu, không dựa trên dữ liệu landing của skill.
- Không dùng `--design-system`/`--persist`. Palette/font giữ nguyên của Gieo Chữ.

---

## 3. Hệ thống template đề xuất

### 3.1. Cây template

```
PublicPageShell          (_ui/public-page-shell.tsx — server component, chỉ trình bày)
 ├─ skip-link "Bỏ qua tới nội dung chính" → #noi-dung
 ├─ slot `banner` (preview bar, notice READ_ONLY…)
 ├─ SiteHeader current=?
 ├─ <main id="noi-dung" tabIndex=-1 class="grow">  {children}
 └─ SiteFooter
   props: current?: SiteNavKey, tone?: "paper" | "white", banner?: ReactNode

ProseLayout              pháp lý, /p/[slug] richText, trang tĩnh (giới thiệu, hướng dẫn)
 └─ container-page → lưới [TOC 220px │ cột đọc ≤ 768px] (không đủ 2 mục TOC → 1 cột căn giữa)
    Breadcrumb · PageHeader(H1, meta, summary) · TocMobile · .gieochu-prose · RelatedLinks · BackToTop

ArticleLayout            single post (tenant + hệ thống)
 └─ container-page → lưới [cột bài ≤ 720px │ sidebar 320px], gap 48px (lg+)
    Breadcrumb · ArticleHeader · ảnh bìa · .gieochu-prose · ShareBar · AuthorBox · RelatedProduct
    sidebar: TOC (dính) · Tài liệu liên quan (dính) · Bài cùng gian hàng/danh mục · Danh mục

ListingLayout            blog hệ thống, blog tenant, archive danh mục
 └─ section hero full-bleed (container-page) → CategoryChips → FeaturedPost? → PostGrid → LoadMore/Pager → CTA block
```

`LegalDocumentView` hiện có **chuyển thành** `ProseLayout` + phần riêng của pháp lý (MetaLine phiên bản, DraftBanner,
PreviewBar, bản in), không viết lại từ đầu. Các `layout.tsx` segment (`pricing`, `cua-hang`, `checkout`) đổi sang
gọi `PublicPageShell`.

### 3.2. Độ rộng chuẩn từng loại

| Loại trang | Khung ngoài | Cột nội dung | Khối chữ | Lý do |
|---|---|---|---|---|
| Danh sách (blog, archive) | `container-page` 1280 | toàn khung, lưới 1/2/3 cột | — | `container-width` |
| Đọc dài không sidebar (pháp lý không TOC, `/p`) | `container-page` | ≤ 768px căn giữa | **38em** (16/17px ≈ 75 ký tự) | giữ chuẩn hiện có |
| Đọc dài + TOC trái (pháp lý) | `container-page` | `220px │ minmax(0,768px)` | 38em | đã có, giữ nguyên |
| Single post + sidebar | `container-page` | `minmax(0,720px) │ 320px`, gap 48 → 1088px | **38em** cho đoạn văn; ảnh/bảng/blockquote được rộng hết 720px | 720px ở 17px ≈ 80 ký tự, nên giới hạn đoạn văn ở 38em cho đúng 65–75 |
| Single post (< lg) | `container-page` | 1 cột, sidebar xuống sau AuthorBox | 100% (16px, mobile ≈ 40–45 ký tự) | `content-priority` |
| Form đơn lẻ | `container-narrow` | — | — | giữ |

### 3.3. Đề xuất chỉnh ADR-024 (Quốc quyết, Long ghi)

Giữ nguyên 3 utility, **bổ sung**:
1. **Measure chữ đọc dài = 38em** là chuẩn chung, khai báo một lần trong `.gieochu-prose` (§4.1). Bỏ cách mỗi trang tự
   chọn `max-w-prose`/`38em`.
2. **Bố cục bài viết có sidebar:** `container-page` + lưới `minmax(0,720px) 320px`. Đây là lưới bên trong khung đã có,
   không phải `max-w` khung trang mới. Nên khai báo thành một utility (`@utility article-grid`) trong `globals.css` để
   giữ nguyên tắc "một nguồn" và tránh class arbitrary (bài học Turbopack trong ADR-024).
3. Cập nhật cột "Dùng cho": `container-prose` = trang đọc dài **không** có sidebar. Bài viết chuyển sang `article-grid`.
4. Ghi ngoại lệ đã có (checkout `container-page`, ADR-062) vào bảng gốc.

---

## 4. Typography, khoảng cách, màu cho nội dung đọc dài

### 4.1. Lớp `.gieochu-prose` (thay `gieochu-legal-content`, giữ tên cũ làm alias)

| Thuộc tính | Mobile (< 1024) | Desktop (≥ 1024) |
|---|---|---|
| Cỡ chữ thân | 16px | 17px (bài viết có thể 18px, chờ chủ dự án xem thử) |
| Dòng | 1.75 | 1.75 |
| Measure đoạn văn | 100% | 38em |
| Khoảng cách đoạn | 0.9em | 0.9em |
| H2 | 1.4em (~22px), dòng 1.3, đậm 700, trên 2em / dưới 0.6em, **vạch ngăn chỉ ở pháp lý** (biến thể `--sectioned`) | ~24px |
| H3 | 1.15em, 650, trên 1.6em | |
| H4 | 1em, 650 | |
| Danh sách | thụt 1.5em, dấu màu `inkSoft`, cấp 2 đổi kiểu dấu | |
| Link | `primary`, gạch chân 1px → 2px khi hover/focus, focus ring 2px | |
| Blockquote | ô nền `backgroundAlt`, viền trái 4px `primary`, chữ `ink` (không làm mờ) | |
| Ảnh | rộng 100% cột, bo 12px, `figcaption` 14px `inkSoft` | |
| Bảng | giữ cách cuộn trong khung hiện có (ADR-060) | |
| Màu chữ | `ink` #12213A trên kem ≈ 14.6:1, `inkSoft` #55607A ≈ 5.9:1 (✅ AA) | |

**Quyết định cần Quốc:** `.gieochu-rich-content` (15px) đang dùng chung với editor để WYSIWYG. Có hai phương án:
- **A (đề xuất):** nâng editor lên cùng 16px. Editor vẫn khớp trang xem, và Studio cũng dễ đọc hơn.
- B: tách hẳn editor và trang xem. Phương án này gọn hơn nhưng phá nguyên tắc WYSIWYG (báo cáo Tiptap §2.9).

### 4.2. Thang chữ tiêu đề trang (thống nhất 5 kiểu H1 hiện có)

| Vai trò | Mobile | Desktop | Font/độ đậm |
|---|---|---|---|
| H1 trang listing/hero blog | 30px | 40px | Be Vietnam Pro 800, `text-balance` |
| H1 bài viết / văn bản | 28px | 36px | Be Vietnam Pro 700 |
| H2 khối trong trang (Bài viết gần đây…) | 22px | 26px | 700 |
| Tiêu đề thẻ bài | 18px | 18–20px | 700, tối đa 3 dòng |
| Meta (ngày, thời gian đọc) | 14px | 14px | Inter 500, `inkSoft` |
| Nhãn/chip | 13–14px | 14px | 600 |

Chữ nhỏ nhất 13px, chỉ dùng cho nhãn, không dùng cho đoạn văn.

### 4.3. Khoảng cách (thang 4/8)

- `main` của trang đọc/listing: `pt-6 pb-16` mobile, `pt-10 pb-24` desktop (thay 3 bộ đang lệch).
- Breadcrumb → H1: 16px. H1 → meta: 12px. Header bài → ảnh bìa: 24px. Ảnh → nội dung: 32px.
- Giữa các section listing: 48px mobile / 64px desktop. Gap lưới thẻ: 16 / 24px.

### 4.4. Màu (chỉ dùng token, không thêm màu)

- Nền trang `background` (kem); thẻ, ô nội dung `#FFF`; viền `line`; nhãn danh mục: chip nền `surface` chữ `primary`
  (≈ 9:1) hoặc nền `accentSoft` chữ `ink`. **Không dùng chữ `accent` trên nền sáng ở cỡ < 18px.**
- Hero blog: nền `background` hoặc dải `surface`. Không dùng gradient tím.
- Bài nổi bật chữ đè: gradient `primaryDeep` → trong suốt, chữ trắng (≥ 4.5:1 trên vùng phủ).
- CTA chính: nút `primary` chữ trắng (≈ 10:1). Nút `accent` chỉ dùng khi chữ ≥ 18px đậm, hoặc đổi chữ sang `ink`. Lỗi
  ở `/p` hiện tại sửa theo cách này.

---

## 5. Thành phần dùng chung đề xuất

Đặt ở `apps/web/app/_ui/` (vùng công khai). Tái dùng icon `admin/_ui/icons.tsx`, `EmptyState` từ `admin/_ui/kit`.

| Component | Mô tả / a11y | Thay thế cái gì |
|---|---|---|
| `PublicPageShell` | §3.1. Một skip-link, `main#noi-dung`, footer luôn ở đáy | 9 bản chép tay |
| `Breadcrumb` | `nav aria-label="Đường dẫn"` > `ol`. Mục cuối là `span aria-current="page"` (cắt 1 dòng trên mobile, có `title`). Phân cách bằng `IconChevronRight aria-hidden`. Link cao 44px dưới `lg`. Có prop `items` và biến thể `back` (`← Tên tenant`) cho trang 1 cấp | 5 kiểu ở §1.6 #2 |
| `PageHeader` | H1 + meta + mô tả + slot action. Thang §4.2 | H1 rải rác |
| `PostCard` | Biến thể `default` (ảnh 16:9, chip danh mục, tiêu đề, trích đoạn 2 dòng, meta: ngày · phút đọc · [gian hàng]), `compact` (sidebar: ảnh 1:1 72px + tiêu đề 2 dòng), `featured` (§2.2). Stretched link, focus `has-[a:focus-visible]`. Tham số `theme: "system" \| "storefront"` để gộp 2 bản hiện có | `PostSummaryCard` + thẻ trong `storefront-posts.tsx` |
| `CategoryChips` | `nav aria-label="Danh mục bài viết"`. Mục đang chọn có `aria-current="page"` + nền đặc + dấu ✓ SVG (không chỉ dựa màu). Mobile cuộn ngang, có gradient mép báo còn chip; mỗi chip ≥ 44px; desktop xuống dòng (`chip-collection-reflow`) | mới |
| `LoadMore` / `Pager` | Link thật đổi URL (`?cursor=`). Nhãn "Xem thêm bài viết". Trang 2+ có "← Bài mới nhất". Không cuộn vô hạn | `PAGER_LINK` trong posts list |
| `AuthorBox` | Logo/avatar gian hàng 56px, tên (link storefront), `bio` 3 dòng, nút "Xem tài liệu của …" | mới |
| `TableOfContents` | Tổng quát hoá `legal-toc.ts`: gắn `id` cho H2 (H3 tuỳ chọn). Desktop: dính ở sidebar. Mobile: `<details>` đóng sẵn. Chỉ hiện khi ≥ 3 H2 (bài viết) / ≥ 2 (pháp lý) | `TocList` riêng của pháp lý |
| `ShareBar` | Nút "Chia sẻ" (Web Share API, client component nhỏ) + "Sao chép liên kết" (thông báo `aria-live="polite"`) + link Facebook/Zalo dạng URL. Mỗi nút ≥ 44px có nhãn chữ hoặc `aria-label`. Không SDK bên thứ ba | mới |
| `RelatedProductCard` | Đã có (`[tenantSlug]/_ui/post-parts.tsx`). Thêm biến thể `sidebar` (dọc, dính) | tái dùng |
| `PostGridSkeleton` | Skeleton cho `loading.tsx`, giữ đúng khung `aspect-[16/9]` | mới (dùng lại `shelf-skeleton` nếu khớp) |
| `NewsletterBlock` | **Chỉ khi chủ dự án chốt.** Label hiển thị, `type="email"`, `autocomplete="email"`, checkbox đồng ý chính sách bảo mật, thông báo lỗi ngay dưới ô | mới, chờ quyết định |

---

## 6. Wireframe

Ký hiệu: `[H]` = SiteHeader, `[F]` = SiteFooter, `▓` = ảnh.

### 6.1. Trang pháp lý / trang tuỳ chỉnh `/p/[slug]` (ProseLayout)

```
Mobile 375                               Desktop 1280
┌─────────────────────┐                  ┌──────────────────────────────────────────────────┐
│[H]                  │                  │[H]                                               │
├─────────────────────┤                  ├──────────────────────────────────────────────────┤
│Trang chủ › Điều kho…│                  │           Trang chủ › Điều khoản sử dụng         │
│                     │                  │ TRÊN TRANG NÀY │ # Điều khoản sử dụng (H1)       │
│# Điều khoản sử dụng │                  │ │ 1. Phạm vi   │ Phiên bản 3 · Hiệu lực 01/10/26 │
│Phiên bản 3 · Hiệu…  │                  │ │ 2. Tài khoản │ ───────────────────────────────  │
│─────────────────────│                  │ │ 3. Thanh toán│ ## 1. Phạm vi                   │
│▸ Mục lục (8 mục)  ⌄ │                  │ │ …(dính)      │ Đoạn văn 17px, dòng 1.75,       │
│                     │                  │ │ ↑ Lên đầu    │ tối đa 38em ≈ 75 ký tự/dòng…    │
│## 1. Phạm vi        │                  │  220px         │ ## 2. Tài khoản  …   ≤768px     │
│Đoạn văn 16px, dòng  │                  │                │ ── Chính sách liên quan ──      │
│1.75…                │                  │                │ [Bảo mật →] [Nội dung →]        │
│ …                   │                  │                │ Điều khoản · v3     [↑ Lên đầu] │
│[Chính sách liên q.] │                  ├──────────────────────────────────────────────────┤
│[↑] (nút nổi 48px)   │                  │[F]                                               │
│[F]                  │                  └──────────────────────────────────────────────────┘
└─────────────────────┘
```

`/p/[slug]` dùng cùng khung. Hero CMS là H1 + subtitle. Khối `features/stats/testimonials/faq` đặt **trong** cột 768px.
`pricingTable` tối đa 2 cột (`sm:grid-cols-2`). `faq` dùng `<details>` (accordion native). `cta` là nút `primary`.

### 6.2. Blog hệ thống `/bai-viet` (ListingLayout)

```
Mobile 375                               Desktop 1280
┌─────────────────────┐                  ┌──────────────────────────────────────────────────┐
│[H]                  │                  │[H]                                               │
├─────────────────────┤                  ├──────────── nền surface/kem full-bleed ──────────┤
│# Góc chia sẻ (H1)   │                  │ # Góc chia sẻ của giáo viên (H1, 40px)           │
│Mô tả 1–2 dòng (CMS) │                  │ Mô tả ngắn từ CMS (≤ 2 dòng)                     │
│┌───────────────┬──┐ │                  │ ┌────────────────────────────────┬────────┐      │
││Tìm bài viết…  │🔍│ │ (*)              │ │ Tìm bài viết…                  │ Tìm    │ (*)  │
│└───────────────┴──┘ │                  │ └────────────────────────────────┴────────┘      │
├─────────────────────┤                  ├──────────────────────────────────────────────────┤
│(Tất cả✓)(Toán)(Văn)→│ chip cuộn ngang  │ (Tất cả ✓) (Toán) (Ngữ văn) (Tiếng Anh) (Kỹ năng)…│
│                     │                  │                                                  │
│▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│ bài nổi bật      │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│ NỔI BẬT · Toán      │
│Nổi bật · Toán       │ (chữ dưới ảnh)   │ ▓▓▓▓▓▓▓▓ ảnh 16:9 ▓▓▓▓▓▓▓▓│ ## Tiêu đề bài lớn  │
│## Tiêu đề bài       │                  │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│ Trích đoạn 3 dòng   │
│Gian hàng · 5 phút   │                  │                           │ [logo] Cô Lan · 5ph │
│─────────────────────│                  │ ## Bài viết mới                                  │
│## Bài viết mới      │                  │ ┌────────┐ ┌────────┐ ┌────────┐                 │
│┌───────────────────┐│                  │ │▓▓▓▓▓▓▓▓│ │▓▓▓▓▓▓▓▓│ │▓▓▓▓▓▓▓▓│                 │
││▓▓▓▓▓▓ 16:9 ▓▓▓▓▓▓▓││                  │ │(Toán)  │ │(Văn)   │ │(Kỹ năng│                 │
││(Toán) 12/10/2026  ││                  │ │Tiêu đề │ │Tiêu đề │ │Tiêu đề │                 │
││Tiêu đề 3 dòng     ││                  │ │Trích 2d│ │Trích 2d│ │Trích 2d│                 │
││[logo] Cô Lan·5 ph ││                  │ │[o]GH·5p│ │[o]GH·4p│ │[o]HT·6p│ ← HT = hệ thống │
│└───────────────────┘│                  │ └────────┘ └────────┘ └────────┘  × 3–4 hàng     │
│ … (1 cột)           │                  │            [ Xem thêm bài viết ]                 │
│[ Xem thêm bài viết ]│                  │ ┌──────────── khối CTA (CMS) ─────────────────┐  │
│┌ khối CTA (CMS) ───┐│                  │ │ Bạn là giáo viên? Mở gian hàng…  [Bắt đầu]  │  │
││ … [Bắt đầu]       ││                  │ └─────────────────────────────────────────────┘  │
│└───────────────────┘│                  │[F]                                               │
│[F]                  │                  └──────────────────────────────────────────────────┘
└─────────────────────┘
(*) chỉ khi có tìm kiếm (§11 Q8). Trước đó bỏ ô tìm kiếm.
```

Tablet 768: lưới 2 cột, bài nổi bật chữ dưới ảnh.

### 6.3. Blog của một tenant `/[tenantSlug]/posts` (ListingLayout, biến thể tenant)

```
Mobile 375                               Desktop 1280
┌─────────────────────┐                  ┌──────────────────────────────────────────────────┐
│[H]                  │                  │[H]                                               │
│← Cô Lan Toán        │ breadcrumb back  │ ← Cô Lan Toán                                    │
│[logo] # Bài viết của│                  │ [logo 56] # Bài viết của Cô Lan Toán (H1)        │
│Cô Lan Toán          │                  │           bio 1 dòng · [Xem tài liệu →]          │
│(Tất cả✓)(Toán 6)… → │ (khi có danh mục)│ (Tất cả ✓) (Toán 6) (Đề thi)…                    │
│▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│ bài ghim =       │ ┌──────────────────────────────────────────────┐ │
│📌 Đã ghim (SVG)     │ nổi bật          │ │▓▓▓▓▓▓▓▓▓ ảnh, gradient primaryDeep ▓▓▓▓▓▓▓▓▓│ │
│## Tiêu đề           │                  │ │ [Đã ghim]                                    │ │
│Trích đoạn 2 dòng    │                  │ │ ## Tiêu đề bài ghim (chữ trắng)          →   │ │
│─────────────────────│                  │ │ Trích đoạn 2 dòng · 12/10/2026 · 5 phút đọc  │ │
│## Bài viết gần đây  │                  │ └──────────────────────────────────────────────┘ │
│[thẻ] [thẻ] … 1 cột  │                  │ ## Bài viết gần đây                              │
│ (không dòng tác giả)│                  │ [thẻ] [thẻ] [thẻ]   (ngày · phút đọc, không avatar)│
│[ Xem thêm bài viết ]│                  │            [ Xem thêm bài viết ]                 │
│┌ CTA ──────────────┐│                  │ ┌ Xem tài liệu của Cô Lan Toán   [Vào gian hàng]┐│
││Xem tài liệu… [→]  ││                  │ └──────────────────────────────────────────────┘ │
│[F]                  │                  │[F]                                               │
└─────────────────────┘                  └──────────────────────────────────────────────────┘
```

Trống: `EmptyState` (đã có) + nút về gian hàng. Trang `?cursor=` thì ẩn bài nổi bật, hiện "← Bài mới nhất".

### 6.4. Archive danh mục `/bai-viet/danh-muc/[slug]`

```
Mobile 375                               Desktop 1280
┌─────────────────────┐                  ┌──────────────────────────────────────────────────┐
│[H]                  │                  │[H]                                               │
│Trang chủ › Bài viết │                  │ Trang chủ › Bài viết › Toán học                  │
│› Toán học           │                  │ DANH MỤC                                         │
│DANH MỤC             │                  │ # Toán học (H1)                                  │
│# Toán học           │                  │ Mô tả ngắn danh mục (CMS, ≤ 2 dòng) · 24 bài     │
│Mô tả ngắn · 24 bài  │                  │ (Tất cả) (Toán học ✓) (Ngữ văn) …                │
│(Tất cả)(Toán ✓)…  → │                  │ [thẻ] [thẻ] [thẻ]                                │
│[thẻ] … 1 cột        │                  │ [thẻ] [thẻ] [thẻ]                                │
│[ Xem thêm ]         │                  │            [ Xem thêm bài viết ]                 │
│[F]                  │                  │[F]                                               │
└─────────────────────┘                  └──────────────────────────────────────────────────┘
Danh mục rỗng → EmptyState "Chưa có bài trong Toán học" + [Xem tất cả bài viết].
Danh mục tắt (isActive=false) → 404.
```

Archive danh mục của **một tenant** dùng lại 6.3 với chip đang chọn (`/[tenantSlug]/posts?danh-muc=toan-hoc`). Không
cần route riêng (§11 Q4).

### 6.5. Single post (ArticleLayout)

```
Mobile 375                               Desktop 1280 (cột 720 │ gap 48 │ sidebar 320)
┌─────────────────────┐                  ┌──────────────────────────────────────────────────┐
│[H]                  │                  │[H]                                               │
│Cô Lan Toán › Bài viế│                  │ Cô Lan Toán › Bài viết › Cách ôn thi…            │
│(Toán học)           │                  │ (Toán học)                         │             │
│# Tiêu đề bài viết,  │                  │ # Tiêu đề bài viết 36px            │ TRÊN BÀI NÀY│
│28px, tối đa 4 dòng  │                  │ [logo] Cô Lan Toán · 12/10/2026 ·  │ │ Mở đầu    │
│[logo] Cô Lan · 12/10│                  │ 5 phút đọc · Cập nhật 14/10        │ │ Bước 1    │
│· 5 phút đọc         │                  │ [Chia sẻ] [Sao chép liên kết]      │ │ Bước 2    │
│[Chia sẻ][Sao chép]  │                  │ ▓▓▓▓▓▓▓▓▓▓▓▓▓ ảnh bìa 16:9 ▓▓▓▓▓▓▓▓ │ ─────────  │
│▓▓▓▓ ảnh bìa 16:9 ▓▓▓│                  │                                    │┌ TÀI LIỆU ┐│
│▸ Mục lục (5 mục)  ⌄ │ (≥ 3 H2)         │ Đoạn văn 17px, ≤ 38em …            ││▓▓▓▓▓▓▓▓▓▓││
│Đoạn văn 16px, dòng  │                  │ ## Bước 1 …                        ││Đề ôn thi ││
│1.75 …               │                  │ ▓▓ ảnh trong bài rộng 720 ▓▓        ││89.000 ₫  ││
│## Bước 1            │                  │ ## Bước 2 …                        ││[Xem tài l]││ ← dính
│…                    │                  │ ─────────────────────────          │└──────────┘│
│┌ Tài liệu liên quan┐│ (đẩy lên ngay    │ [Chia sẻ] [Sao chép liên kết]      │ Bài khác   │
││▓▓ Đề ôn · 89.000 ₫││  sau nội dung)   │ ┌ AuthorBox ───────────────────┐   │ [▓]Tiêu đề │
││[ Xem tài liệu ]   ││                  │ │[logo] Cô Lan Toán            │   │ [▓]Tiêu đề │
│└───────────────────┘│                  │ │bio 3 dòng  [Xem tài liệu của…]│   │ [▓]Tiêu đề │
│[Chia sẻ][Sao chép]  │                  │ └──────────────────────────────┘   │ Danh mục   │
│┌ AuthorBox ────────┐│                  │ Báo cáo vi phạm (kín đáo, phải)    │ (Toán)(Văn)│
│└───────────────────┘│                  │ ← Tất cả bài viết                  │            │
│## Bài khác của …    │                  ├──────────────────────────────────────────────────┤
│[thẻ compact] ×3     │                  │[F]                                               │
│← Tất cả bài viết    │                  └──────────────────────────────────────────────────┘
│[F]                  │
└─────────────────────┘
```

- Thứ tự DOM = thứ tự đọc mobile. Sidebar desktop là `<aside aria-label="Thông tin thêm">` đặt **sau** `<article>` trong
  DOM. Chỉ TOC và thẻ tài liệu được dính (`top-[112px]`, `max-h` + `overflow-auto` để không bị che).
- Bài không có tiêu đề (bài ngắn kiểu "cập nhật nhanh"): H1 = tiêu đề suy ra (như hiện tại), không TOC, không ảnh bìa
  riêng (ảnh nằm trong nội dung).
- Bài **của hệ thống** dùng cùng layout: breadcrumb `Trang chủ › Bài viết › {Danh mục} › {Tiêu đề}`, AuthorBox = thương
  hiệu hệ thống (`getEffectiveBrand()`), sidebar "Tài liệu liên quan" chỉ hiện khi bài có gắn tài liệu.
- Bài **của studio xem từ blog hệ thống**: link về URL chuẩn `/{tenantSlug}/posts/{id}` (một canonical, tránh trùng
  nội dung). Không dựng bản thứ hai dưới `/bai-viet`.

---

## 7. Contract dữ liệu theo trang (cho Hiếu, qua Quốc)

Ký hiệu: ✅ có sẵn · 🔁 suy ra được ở server, không đổi DB · 🆕 cần mới (DB/CMS).

### 7.1. `PublicPageShell` / `ProseLayout`
Không cần dữ liệu mới. Pháp lý: ✅ toàn bộ. `/p/[slug]`: ✅ `CmsPage`.

### 7.2. Single post tenant — `getPublishedPost` mở rộng

```ts
interface PublicPostDetailV2 {
  id: string; title: string | null; excerpt: string; bodyHtml: string;   // ✅ (bodyHtml: thêm id cho H2 → 🔁)
  publishedAt: Date; updatedAt: Date; isPinned: boolean;                  // ✅
  product: PublicPostProduct | null;                                       // ✅
  coverImage: { url: string; srcSet: string; alt: string } | null;         // 🔁 ảnh đầu bài (alt = alt ảnh trong body) │ 🆕 nếu chốt trường riêng
  readingMinutes: number;                                                   // 🔁 ceil(số chữ / 200), tối thiểu 1
  toc: { id: string; text: string; level: 2 | 3 }[];                         // 🔁 tổng quát hoá legal-toc
  category: { slug: string; name: string } | null;                          // 🆕 (GĐ4)
  author: { kind: "tenant"; name: string; slug: string; logoUrl: string | null; bio: string | null }; // 🔁 từ Tenant (đã đọc trong page, cần thêm logo + bio)
  canonicalUrl: string;                                                     // 🔁
}
// Sidebar: listPublishedPosts(tenantId, …) loại bài hiện tại, limit 3 → ✅ (cần thêm tham số excludeId)
```

### 7.3. Danh sách bài tenant — `listPublishedPosts` mở rộng

```ts
interface PublicPostSummaryV2 extends PublicPostSummary {               // ✅ id,title,excerpt,imageUrl,isPinned,publishedAt,product
  readingMinutes: number;                                                // 🔁
  category: { slug: string; name: string } | null;                       // 🆕 GĐ4
}
interface TenantBlogPage {
  tenant: { name; slug; logoUrl; bio };                                  // 🔁
  featured: PublicPostSummaryV2 | null;                                  // ✅ bài ghim (chỉ trang đầu)
  items: PublicPostSummaryV2[]; nextCursor: string | null;               // ✅
  categories: { slug; name; count }[];                                   // 🆕 GĐ4, chỉ danh mục có ≥ 1 bài của tenant
  activeCategory: string | null;                                         // 🆕 GĐ4 (?danh-muc=)
}
```

### 7.4. Blog hệ thống — 🆕 toàn bộ (GĐ5)

```ts
interface SystemBlogPage {
  hero: { title: string; description: string | null };                  // 🆕 CMS (CmsPage slug "blog")
  featured: BlogFeedItem | null;                                          // 🆕 CMS chọn tay, hoặc bài hệ thống mới nhất
  categories: { slug; name; iconKey?: string; count }[];                  // 🆕 PostCategory
  items: BlogFeedItem[]; nextCursor: string | null;                       // 🆕 feed trộn
  cta: { title; description?; label; href } | null;                       // 🆕 CMS
}
type BlogFeedItem = {
  source: "system" | "tenant";
  href: string;                     // system: /bai-viet/{slug}; tenant: /{tenantSlug}/posts/{id}
  title: string | null; excerpt: string; imageUrl: string | null;
  publishedAt: Date; readingMinutes: number;
  category: { slug; name } | null;
  author: { name: string; logoUrl: string | null; href: string | null }; // gian hàng hoặc thương hiệu hệ thống
};
```

Bài hệ thống cần **model L1 riêng** (đề xuất `SystemPost`: `slug` unique, `title`, `body`, `excerpt`, `coverImageUrl`,
`coverAlt`, `categoryId`, `status`, `isFeatured`, `publishedAt`, SEO). Không mở `Post.tenantId` thành nullable vì sẽ phá
RLS L2. Đây là quyết định của Quốc/Hiếu, Phong chỉ nêu nhu cầu.

### 7.5. Archive danh mục — 🆕 (GĐ4/GĐ5)

```ts
interface CategoryArchivePage {
  category: { slug; name; shortDescription: string | null; seoTitle?; seoDescription?; ogImageUrl? };
  items: BlogFeedItem[]; nextCursor: string | null; total: number;
  siblings: { slug; name }[];       // cho CategoryChips
}
```

`PostCategory` (L1) đề xuất theo mẫu `DocumentCategory`: `slug`, `name`, `shortDescription`, `iconKey` (chọn từ
`icons.tsx`, **không** upload icon), `sortOrder`, `isActive`, SEO. `Post.categoryId?` + `SystemPost.categoryId?`.

### 7.6. Trạng thái bắt buộc mọi trang dữ liệu

| Trang | loading | empty | error | 404 |
|---|---|---|---|---|
| Blog hệ thống | skeleton hero + 6 thẻ | "Chưa có bài viết" | `error.tsx` + "Thử lại" | — |
| Blog tenant | skeleton 6 thẻ | có (EmptyState) | thêm `error.tsx` | tenant không tồn tại/không ACTIVE |
| Archive | skeleton | EmptyState + link "Tất cả bài" | `error.tsx` | danh mục không tồn tại/tắt |
| Single post | skeleton tiêu đề + ảnh + 6 dòng | — | `error.tsx` | bài không PUBLISHED |

---

## 8. "CMS trước, UI sau": nội dung phải quản trị được trước khi dựng UI

| Nội dung / cấu hình | Nơi quản trị đề xuất | Thuộc GĐ |
|---|---|---|
| Hero blog hệ thống (tiêu đề, mô tả), khối CTA cuối trang, SEO trang `/bai-viet` | System Center → Nội dung → "Trang Blog" (`CmsPage` slug hệ thống `blog`, mẫu `home`/`shop`, có nháp/xuất bản) | GĐ5 |
| Danh mục bài viết (tên, slug, mô tả, icon, thứ tự, bật/tắt, SEO) | System Center → "Danh mục bài viết" (mẫu `DocumentCategory`) | GĐ4 |
| Bài viết hệ thống | System Center → "Bài viết hệ thống" (editor Tiptap dùng lại) | GĐ5 |
| Bài nổi bật blog hệ thống | Cờ `isFeatured` trên bài hệ thống, hoặc ô chọn trong "Trang Blog" | GĐ5 |
| Bài studio được lên blog hệ thống | Tuỳ §11 Q1/Q2: cờ "Đề xuất lên blog chung" trong editor Studio + duyệt ở System Center | GĐ5 |
| Danh mục của bài tenant | Studio → editor bài viết, accordion "Danh mục" (bắt buộc khi xuất bản? → §11 Q5) | GĐ4 |
| Ảnh bìa riêng + alt | Studio/System editor, accordion "Ảnh bìa" (nếu §11 Q7 chốt có) | GĐ4 |
| Bài nổi bật blog tenant | ✅ đã có: "Ghim bài" | — |
| Nhãn cố định của UI ("Bài viết gần đây", "Xem thêm bài viết", "phút đọc") | chuỗi giao diện, không phải nội dung → để trong code như các nhãn hệ thống khác. **Quốc xác nhận** cách hiểu này của nguyên tắc | — |
| Đăng ký nhận tin (tiêu đề khối, mô tả, bật/tắt) | System Center → Trang Blog (chỉ khi §11 Q6 chốt) | GĐ6 |
| Mục menu "Bài viết" trên header/footer | ✅ CMS menu (ADR-050): System Admin tự thêm link `/bai-viet` sau khi trang lên | GĐ5 |

---

## 9. Chia giai đoạn (mỗi giai đoạn tự deploy được)

| GĐ | Nội dung | Ai | Đổi DB? | Phụ thuộc |
|---|---|---|---|---|
| **0. Nền khung** | `PublicPageShell`, `Breadcrumb`, `PageHeader`. Chuyển `pricing`/`cua-hang`/`checkout` layout, trang chủ, storefront, trang tài liệu, posts sang shell. `/p/[slug]` dùng header/footer hệ thống (bỏ "G" gõ cứng, bỏ `next/font` trùng). Thêm skip-link cho `/cua-hang`. `loading.tsx`/`error.tsx` cho 2 route posts. Sửa tương phản nút CTA `/p` | Phong | Không | — |
| **1. Chữ đọc dài** | `.gieochu-prose` (alias `gieochu-legal-content`), thang H1 §4.2, `ProseLayout` tách từ `LegalDocumentView`. `/p/[slug]`: FAQ dạng `<details>`, bảng giá 2 cột. Quyết A/B §4.1 cho editor | Phong (+ Quốc chốt A/B) | Không | GĐ0 |
| **2. Single post tenant** | `ArticleLayout` + `article-grid`: TOC, thời gian đọc, ảnh bìa suy ra, AuthorBox (tenant), ShareBar, tài liệu liên quan dính, "Bài khác của gian hàng" | Phong (UI) + Hiếu (loader: `readingMinutes`, `toc`, logo/bio tenant, `excludeId`) | Không | GĐ1 |
| **3. Blog tenant** | Bài ghim thành `featured`, `PostCard` gộp 2 bản (system/storefront), lưới, "Xem thêm", khối CTA về gian hàng, skeleton | Phong + Hiếu (nhỏ) | Không | GĐ2 |
| **4. Danh mục bài viết** | CMS: `PostCategory` (System Center) + chọn danh mục trong editor Studio (+ ảnh bìa riêng nếu chốt). UI: chip danh mục, nhãn trên thẻ, lọc `?danh-muc=` ở blog tenant | Hiếu (DB/CMS) → Phong (UI) | **Có** (expand-only: bảng mới + cột nullable) | GĐ3, §11 Q4/Q5/Q7 |
| **5. Blog hệ thống** | CMS: `SystemPost` + trang "Bài viết hệ thống" + "Trang Blog" (hero/CTA/nổi bật) + cơ chế đưa bài studio lên. UI: `/bai-viet`, `/bai-viet/[slug]`, `/bai-viet/danh-muc/[slug]`. Thêm menu qua CMS | Quốc (ADR mới thay "feed xuyên tenant ngoài phạm vi") → Hiếu → Phong | **Có** | GĐ4, §11 Q1–Q3 |
| **6. Tuỳ chọn** | Tìm kiếm bài, đăng ký nhận tin, (bình luận = M10c) | theo quyết định | Có | §11 Q6/Q8/Q9 |

Riêng GĐ0 đã giải quyết phần lớn lỗi "không thống nhất" ở §1.6 mà không động tới dữ liệu. Đề xuất làm ngay.

---

## 10. Ranh giới dữ liệu và RLS (cần Hiếu/Quốc kiểm chứng)

1. **Blog hệ thống đọc bài studio = đọc dữ liệu L2 công khai qua `withPublic`.** `withPublic` chỉ đặt
   `app.scope='public'`, không gắn `tenant_id`, nên về kỹ thuật một truy vấn xuyên tenant **chạy được** và RLS lọc
   `status='PUBLISHED'` + tenant **không LOCKED**.
2. **Lệch giữa RLS và quyền xem ở tầng ứng dụng.** RLS cho phép đọc bài của tenant **READ_ONLY**, nhưng
   `resolveStorefrontAccess` (ADR-040) trả 404 cho **khách** khi tenant READ_ONLY. Feed hệ thống **phải lọc thêm
   `tenant.status = 'ACTIVE'`** ở code, nếu không sẽ lộ bài của gian hàng đang tạm ngưng. Cần Hiếu viết điều kiện này và Quốc
   xác nhận có nên siết luôn policy RLS cho khớp không.
3. Bài bị kiểm duyệt (`HIDDEN` + `moderationLockedAt`) đã bị RLS loại vì không PUBLISHED. Không cần làm thêm, chỉ cần kiểm lại.
4. **ADR-029 mục 5: "Feed xuyên tenant ngoài phạm vi"** và "không nhánh admin". Nếu System Center **duyệt** bài studio
   trước khi lên blog chung (§11 Q2), admin phải đọc nội dung bài. Bài PUBLISHED là nội dung công khai nên đọc qua
   `withPublic` là hợp lý, khác với đơn hàng/khách hàng (§7.9). Tuy vậy, bảng lưu quyết định duyệt (L1 hay cột trên `posts`)
   là quyết định kiến trúc, cần ADR.
5. Bài hệ thống nên là bảng **L1** (không RLS, chỉ System Admin ghi), tách hẳn khỏi `posts`.
6. Cờ "đề xuất lên blog chung" nếu đặt trên `posts` thì cần thêm vào trigger `posts_guard_columns` (ai được đặt/gỡ).
7. URL: `blog`/`bai-viet` **chưa** nằm trong `RESERVED_SLUGS` (tenant). `bai-viet` đã có trong `RESERVED_PRODUCT_SLUGS`
   nhưng đó là danh sách khác. Thêm route `/bai-viet` cấp gốc → phải thêm vào `RESERVED_SLUGS` và **quét DB prod xem có
   tenant slug trùng không** (quy ước CLAUDE.md).
8. Tác giả là gian hàng, không lộ email/tên thật của chủ hay staff. AuthorBox chỉ dùng `Tenant.name/logo/bio`.

---

## 11. Câu hỏi cần chủ dự án chốt (kèm đề xuất của Phong)

| # | Câu hỏi | Đề xuất của Phong | Lý do |
|---|---|---|---|
| Q1 | Blog hệ thống có trộn bài studio không? | **Có, nhưng chỉ bài được chọn**, không tự động tất cả | Giữ chất lượng blog chung, tránh bài "cập nhật nhanh" không tiêu đề tràn trang |
| Q2 | Bài studio lên blog chung theo cơ chế nào? | **Tenant bấm "Đề xuất lên blog chung" → System Admin duyệt** (có thể gỡ). Chỉ bài có tiêu đề + có ảnh mới được đề xuất | Tenant đồng ý (bài của họ xuất hiện ngoài gian hàng) + kiểm soát nội dung |
| Q3 | URL blog hệ thống? | `/bai-viet` (danh sách), `/bai-viet/{slug}` (bài hệ thống), `/bai-viet/danh-muc/{slug}` (archive). Bài studio giữ URL `/{tenantSlug}/posts/{id}` | Thống nhất tiếng Việt với `/cua-hang`. Một canonical cho bài studio |
| Q4 | Danh mục bài viết dùng chung cho hệ thống và mọi tenant, hay mỗi tenant tự tạo? | **Một bộ danh mục chung do System Admin quản lý** (như `DocumentCategory`) | Archive hệ thống gom được bài từ nhiều gian hàng. Tenant không phải quản trị thêm |
| Q5 | Tenant có bắt buộc chọn danh mục khi đăng bài không? | **Không bắt buộc**. Riêng khi "Đề xuất lên blog chung" thì bắt buộc | Không làm khó bài ngắn. Chỉ siết ở nơi cần phân loại |
| Q6 | Có đăng ký nhận tin không? | **Chưa làm ở đợt này** (GĐ6). Nếu làm: double opt-in, lưu đồng ý, có link huỷ | Dữ liệu cá nhân + gửi email: cần thiết kế riêng về consent và bảo mật |
| Q7 | Có thêm trường ảnh bìa riêng (+ alt) không, hay giữ ảnh đầu bài? | **Thêm trường tuỳ chọn**, không có thì dùng ảnh đầu bài | Ảnh bìa đẹp cho thẻ/chia sẻ mạng xã hội, alt đúng a11y. Bài cũ vẫn chạy |
| Q8 | Có ô tìm kiếm trong blog hệ thống không? | **Chưa** ở GĐ5. Hero bỏ ô tìm kiếm cho tới khi có full-text | Ô tìm kiếm trả kết quả kém còn tệ hơn không có |
| Q9 | Có bình luận không? | **Không** (giữ M10c trong BACKLOG) | Cần kiểm duyệt, chống spam. Không thuộc đợt layout |
| Q10 | Bài viết có slug (URL đẹp) thay vì id không? | **Có cho bài hệ thống**. Bài tenant giữ id ở đợt này (đổi sau có redirect) | SEO cho blog chung. Tránh migration lớn trên `posts` |
| Q11 | Hiển thị "thời gian đọc" không? | **Có**, tính tự động, không lưu DB | Người đọc mobile cân nhắc thời gian. Chi phí thấp |
| Q12 | Đổi cỡ chữ editor Studio cùng trang xem (15 → 16px)? | **Có** (phương án A §4.1) | Giữ WYSIWYG, chữ dễ đọc hơn |
| Q13 | Đổi URL blog tenant `/posts` sang `/bai-viet`? | **Chưa**. Để sau, kèm redirect 308 | Ngoài mục tiêu layout, có rủi ro link cũ |

---

## 12. Checklist a11y / responsive áp cho mọi giai đoạn

- [ ] Một H1/trang, heading tuần tự (thẻ bài trong listing dùng H2 hoặc H3 theo ngữ cảnh, như `PostSummaryCard` đã làm).
- [ ] Skip-link + `main#noi-dung` (do `PublicPageShell` lo).
- [ ] Breadcrumb `aria-current`, link ≥ 44px dưới `lg`.
- [ ] Chip/nhãn: trạng thái chọn có dấu hiệu ngoài màu. Tương phản chữ ≥ 4.5:1 (không dùng chữ cam nhỏ).
- [ ] Chữ đè ảnh có lớp phủ đảm bảo 4.5:1.
- [ ] Ảnh có `aspect-ratio`, ảnh thẻ `alt=""` (trang trí, tiêu đề đã là tên link), ảnh bìa có alt thật.
- [ ] TOC/thẻ dính không che focus (`scroll-padding-top`/`bottom`).
- [ ] Không cuộn ngang ở 375px. Bảng cuộn trong khung. Chip cuộn ngang có gợi ý và có thể bấm qua bàn phím.
- [ ] `prefers-reduced-motion`: tắt zoom ảnh khi hover, tắt cuộn mượt.
- [ ] "Xem thêm" là link đổi URL: Back/chia sẻ giữ vị trí.
- [ ] Đủ loading/empty/error/404 (§7.6).
- [ ] Ngày theo `vi-VN` + `DISPLAY_TIME_ZONE`. Giá `vi-VN` số nguyên.
- [ ] Không gõ cứng chuỗi thương hiệu (dùng `getEffectiveBrand()`). Không gõ cứng hex trong component.

---

## 13. Tác động tài liệu (Long cập nhật sau khi chủ dự án chốt)

- `UI-Design-System.md`: §4 (bảng ADR-024 + `article-grid` + measure 38em), §4.6 (bảng áp dụng: `/p/[slug]` sang shell),
  §11 (Bài viết: ArticleLayout, PostCard gộp), mục mới "Template công khai" (PublicPageShell/ProseLayout/ArticleLayout/
  ListingLayout) và "Thành phần dùng chung công khai" (§5 của tài liệu này), thang chữ §4.2.
- `docs/DECISIONS.md` (Quốc): ADR mới cho blog hệ thống + feed xuyên tenant (thay câu "ngoài phạm vi" của ADR-029 mục 5),
  `PostCategory`, `SystemPost`. Ghi bổ sung ADR-024.
- Spec `02-System-Specs/` bài viết: thêm danh mục, ảnh bìa, thời gian đọc, cơ chế đề xuất lên blog chung.
- `docs/BACKLOG.md`: đóng mục "chuyển `/p/[slug]` sang chrome hệ thống" khi GĐ0 xong.

# Đề xuất UX — Trang chủ, Bộ trang pháp lý, CMS Menu header/footer, SEO từng trang

> Người soạn: Phong (UX/UI) · Ngày: 23/10/2026 · Trạng thái: **ĐỀ XUẤT, chưa code** — chờ Quốc/chủ dự án chốt.
> Nguồn: `docs/GIEOCHU_HOMEPAGE_CONTENT_BRIEF.md` (gọi tắt **BH**), `docs/claude-code-gieochu-legal-pages-implementation-brief.md`
> (gọi tắt **BL**), code hiện tại (đọc ngày 23/10/2026), `UI-Design-System.md`, ADR-024/025/033/035/038/039.
> Nguyên tắc: **CMS trước, UI sau** — mọi chữ/nhãn/link mô tả dưới đây lưu DB, sửa trong System Center; UI công khai đọc DB.

---

## 0. Hiện trạng đã đối chiếu code (căn cứ cho đề xuất)

| # | Phát hiện | Vị trí | Mức |
|---|---|---|---|
| H1 | Minh hoạ mặc định của Hero (khi chưa upload ảnh) **hard-code "500+ Giáo viên & Coach" và "10.000+ Tài liệu chất lượng"** — đúng loại số liệu BH §6 S1 + §8 cấm khi chưa xác minh. | `apps/web/app/_home-sections.tsx` `HeroSection` | Cao |
| H2 | Section "Cảm nhận" luôn vẽ **5 sao cố định** cho mọi lời nhận xét; tiêu đề "Người dùng nói gì về…" và câu "Những chia sẻ thật từ cộng đồng…" hard-code, không qua CMS. Không có cờ xác nhận người dùng đồng ý đăng. | `TestimonialsSection` | Cao |
| H3 | Minh hoạ của "Kêu gọi mở gian hàng" vẽ giá **"149.000đ" + 5 sao** — dữ liệu minh hoạ giả (BH §8 gạch cuối). | `BecomeSellerSection` | Trung bình |
| H4 | Nút header **"Mở gian hàng miễn phí"** hard-code — tuyên bố "miễn phí" thuộc BH §8; không sửa được qua CMS. | `site-header.tsx` | Cao |
| H5 | Footer có 6 mục là `<span>` không bấm được ("Giáo viên & Coach", "Về …", "Liên hệ", "Tuyển dụng", "Điều khoản dịch vụ", "Chính sách bảo mật"); năm "© 2026" hard-code. Nav ngang cũng có "Giáo viên & Coach" là chữ chết. | `site-footer.tsx`, `site-header.tsx` | Trung bình |
| H6 | Trang chủ khi chưa có `CmsPage(home)` PUBLISHED → **chỉ còn header + footer** (không có nội dung mặc định). | `app/page.tsx` `getHomeSections()` | Trung bình |
| H7 | Trang chủ **không có `generateMetadata`** (dùng title/description chung của root layout = tên + slogan). Editor trang chủ và Cửa hàng **không có ô SEO** (chỉ Bảng giá và `/p/*` có). Không có `sitemap.ts`, `robots.ts`, không có JSON-LD nào trong app. | `app/page.tsx`, `admin/cms/*` | Cao (SEO) |
| H8 | Trang chủ chưa có skip-link + `<main id="noi-dung">` (đã có trong BACKLOG). Lợi ích (benefits) dùng `div` cho tiêu đề mục, không phải H3 (BH §4.5). | `_home-sections.tsx` | Trung bình |
| H9 | Chưa có section "Cách bắt đầu", "FAQ", "Nhật ký phát triển" trên trang chủ. Section "Kêu gọi mở gian hàng" chỉ có 1 CTA, không có đoạn văn (BH S6 cần 3 đoạn + 2 CTA). CTA cuối trang chỉ 1 nút (BH S10 cần 2). | `home-sections.ts` | — |
| H10 | `/p/[slug]` tự dựng header riêng (chữ "G" cứng, không `SiteHeader`/`SiteFooter`), `richText` là **văn bản thuần** (`whitespace-pre-line`, không heading) → không dựng được mục lục; block `stats` cho nhập số tự do (rủi ro BH §8). | `app/p/[slug]/page.tsx` | Trung bình |
| H11 | Đăng ký: checkbox "Tôi đồng ý với điều khoản sử dụng và chính sách xử lý dữ liệu cá nhân." **không có link** tới văn bản; chỉ lưu `UserProfile.consentAt` (không lưu phiên bản). Mở gian hàng (`studio/onboarding-form.tsx`) **không có điểm chấp thuận**. Xuất bản tài liệu đã có checkbox cam kết bản quyền (ADR-038 mục 7, lưu `rightsConfirmedAt/ById`) nhưng không link tới văn bản cam kết. | auth/register, studio | Cao (pháp lý) |
| H12 | Báo cáo vi phạm (ADR-038): chỉ mở từ nút trên **tài liệu / đánh giá / bài viết** (`AbuseTargetType` = PRODUCT/REVIEW/POST); 4 loại (COPYRIGHT/INAPPROPRIATE/SCAM/OTHER); bằng chứng chỉ là link (≤5); `tenantId` bắt buộc; API trả `{ ok, message }` — **không có mã tiếp nhận**; trạng thái OPEN/RESOLVED/REJECTED. Không có trang báo cáo độc lập. | `[tenantSlug]/_ui/report-abuse.tsx`, schema | — |
| H13 | Không có trang danh bạ gian hàng ("Giáo viên & Coach") → CTA "Khám phá các gian hàng" (BH S4) **chưa có đích**; `/cua-hang` có section `featuredTenants`. Không có cờ "đang mở đăng ký" (BH S6 điều kiện). | — | — |
| H14 | Không có analytics/cookie không thiết yếu (chỉ cookie phiên `httpOnly`) → chưa cần trang Cookie riêng. | `lib/cookies.ts` | — |
| H15 | Đã có sẵn để tái dùng: `SortableListEditor` (Lên/Xuống, WCAG 2.5.7), luồng Lưu nháp/Xuất bản/Khôi phục + Xem trước bản nháp (`/pricing?xem-truoc=nhap`), `PinPicker`, `TiptapEditor` (H1–H4, sanitize), `ImageUploadField`, `SystemSettings.supportEmail`, `RESERVED_SLUGS` (đã có `terms`, `privacy`, `help`, `support`). | — | — |

---

## 1. Trang chủ

### 1.1. Đối chiếu 10 section của BH với trang hiện tại

| BH | Section | Hiện có (`type`) | Quyết định | Nguồn nội dung | Ẩn khi |
|---|---|---|---|---|---|
| S1 | Hero | `hero` | **Sửa**: `badge` dùng làm eyebrow; thêm `brandMessage` (dòng slogan, mặc định đọc từ brand), `imageAlt`; **bỏ 2 thẻ số liệu cứng** trong minh hoạ mặc định (chỉ giữ hình khối trang trí + thẻ "Đề thi" không số). | CMS | Không ẩn (bắt buộc có) |
| — | Số liệu nổi bật | `stats` | **Giữ nhưng mặc định ẩn** — số thật từ DB nhưng BH §8 yêu cầu xác minh trước khi công bố; bật lại khi chủ dự án duyệt (Q4). | DB + nhãn CMS | Tổng số 0 / bị tắt |
| S2 | Tìm kiếm + danh mục | `search` | **Sửa nhẹ**: thêm `eyebrow?`, `submitLabel` (BH: "Tìm tài liệu", code đang cứng "Tìm kiếm"). Chip danh mục giữ như hiện tại (chỉ danh mục đang bật **có** tài liệu công khai — khớp BH). | CMS + DB (danh mục) | Không ẩn ô tìm; dải chip ẩn khi 0 danh mục |
| S3 | Vì sao Gieo Chữ | `benefits` | **Sửa**: tiêu đề mục thành **H3**; mỗi mục thêm cờ nội bộ `verified` (xem §1.5). | CMS | — |
| S4 | Gian hàng nổi bật | `coaches` | **Sửa**: thêm `eyebrow?`, `cta?` (nhãn + link, mặc định `/cua-hang`), `minToShow` (mặc định 3). | DB (tenant ACTIVE có tài liệu công khai) + nhãn CMS | Số gian hàng < `minToShow` |
| S5 | Tài liệu nổi bật | `documents` | **Sửa**: thêm `eyebrow?`, `cta?` (mặc định `/cua-hang/tai-lieu`), `minToShow`, `fallback: "hide" \| "categories"`. | DB + nhãn CMS | < `minToShow` → ẩn hoặc thay bằng khối "Khám phá theo danh mục" |
| S6 | CTA người có kiến thức | `becomeSeller` | **Sửa**: thêm `body` (1–3 đoạn), `secondaryCta?`; `bullets` thành tuỳ chọn (0–6); minh hoạ bỏ giá + sao. | CMS | — |
| S7 | Cách bắt đầu | — | **Thêm** `steps`: H2, 2–6 bước (tiêu đề + mô tả), `cta?`. | CMS | — |
| S8 | Phản hồi / nhật ký | `testimonials` | **Thay** bằng `community` có 3 chế độ: `testimonials` (bắt buộc tích "đã có đồng ý"), `devlog` (mục ngày + tiêu đề + tóm tắt), `invite` (lời mời thử nghiệm + CTA). **Bỏ sao cố định**; tiêu đề/mô tả vào CMS. | CMS | Chế độ testimonials mà 0 mục đã xác nhận → tự rơi về `invite` |
| S9 | FAQ | — | **Thêm** `faq` (tái dùng mẫu editor FAQ của Bảng giá: 1–20 câu, Lên/Xuống). | CMS | — |
| S10 | CTA cuối trang | `finalCta` | **Sửa**: thêm `secondaryCta?`, `showSlogan` (slogan đọc từ brand, không nhập lại). | CMS | — |
| Footer | Footer | `SiteFooter` | Chuyển sang **CMS Menu** (§3). | CMS | — |

Thứ tự mặc định theo BH §5: hero → search → benefits → coaches → documents → becomeSeller → steps → community → faq → finalCta
(stats nằm sau hero, mặc định ẩn). Mỗi loại tối đa 1 lần (giống quy tắc Cửa hàng) để giữ **một H1** và H2 không trùng.

### 1.2. Bố cục từng section (wireframe chữ)

Quy ước chung: nền xen kẽ `background`/`PAPER_ALT` như hiện tại; mỗi section `<section aria-labelledby>` có H2; eyebrow là
`<p>` (không phải heading); nội dung bọc `container-page`; khoảng dọc giữ `py-14 sm:py-20 lg:py-24`; CTA chính dùng
`accent`, CTA phụ dạng link/ghost — **một CTA chính mỗi section** (skill `primary-action`). Thêm skip-link
"Bỏ qua tới nội dung chính" + `<main id="noi-dung">` bọc các section (H8).

**S1 Hero** (nền xanh đậm như hiện tại)
```
Mobile (375)                         Desktop (≥1024)
[eyebrow pill]                       | [eyebrow pill]            |  [ảnh / minh hoạ  ]
H1 (32px, 3–4 dòng)                  | H1 (52px)                 |  [không số liệu   ]
Đoạn mô tả                           | Đoạn mô tả (≤ 480px)      |  [                ]
[ CTA chính — full width ]           | [CTA chính] CTA phụ →     |
CTA phụ →  (căn giữa)                | "Gieo kiến thức. Tạo giá trị." (chữ nhỏ, AMBER_SOFT) |
"Gieo kiến thức. Tạo giá trị."       |
[minh hoạ thu nhỏ 220px]
```
- Ảnh upload: `imageAlt` bắt buộc khi ảnh mang nội dung; để trống = ảnh trang trí (`alt=""`). Giữ khung cao cố định để không CLS.
- CTA chính cao ≥ 44px (hiện `py-[15px]` ≈ 50px — đạt). Đích CTA "Bắt đầu xây dựng gian hàng" = `/register` (Q2: chỉ khi đăng ký mở).

**S2 Tìm kiếm** — giữ bố cục pill + chip hiện tại (`UI-Design-System §12.3`). Nút submit đọc `submitLabel`. Mobile: nút
nằm trong pill, chữ 13px; nếu `submitLabel` > 12 ký tự thì xuống dòng dưới ô (editor cảnh báo độ dài).

**S3 Lợi ích** — giữ 2 cột (trái: eyebrow/H2/mô tả; phải: lưới 2×2 thẻ). Mobile: 1 cột. Tiêu đề thẻ = H3.

**S4 Gian hàng nổi bật / S5 Tài liệu nổi bật** — giữ lưới hiện tại (4 cột / 3 cột desktop; 2 / 1 cột mobile). Thêm hàng
đầu: `[eyebrow] H2 + mô tả` bên trái, link CTA "Khám phá tất cả tài liệu →" bên phải (desktop); mobile CTA chuyển xuống
**dưới lưới** thành nút viền full-width. Thẻ giữ quy tắc ADR-033: sao chỉ hiện khi có đánh giá thật, "Đã bán" chỉ khi > 0.
Fallback S5 = `categories`: H2 "Khám phá theo danh mục" + lưới chip lớn (tái dùng `CategoryGrid` của Cửa hàng) — chỉ khi
có ≥ 1 danh mục có tài liệu; không thì ẩn hẳn.

**S6 CTA người có kiến thức** — thẻ bo 32px nền xanh đậm (giữ). Trái: eyebrow, H2 (+ `highlight`), 1–3 đoạn `body`,
bullets (nếu có), `[CTA chính]  CTA phụ →`. Phải (≥ sm): minh hoạ "trang tài liệu" **không giá, không sao** (chỉ thanh xám
+ icon tài liệu). Mobile: ẩn minh hoạ như hiện tại.

**S7 Cách bắt đầu** (mới)
```
Mobile: H2 → <ol> dọc: (1) Tiêu đề bước / mô tả … → [CTA]
Desktop: H2 căn giữa → 4 cột thẻ, số bước trong vòng tròn primary (số là chữ, không chỉ màu) → [CTA] căn giữa
```
Dùng `<ol>` thật (trình đọc màn hình đọc "danh sách 4 mục"); số bước hiển thị bằng CSS counter hoặc chữ, đường nối giữa các
bước là trang trí (`aria-hidden`).

**S8 Cùng nhau phát triển** (mới, thay testimonials)
- Chế độ `testimonials`: lưới 1/2/3 cột, thẻ = trích dẫn + tên + vai trò + (tuỳ chọn) ảnh đại diện upload; **không sao**.
  Chỉ render mục có `consentConfirmed = true`.
- Chế độ `devlog`: danh sách dọc dạng timeline: `<time>` (định dạng `vi-VN`, `Asia/Ho_Chi_Minh`) · tiêu đề H3 · tóm tắt ·
  link "Đọc thêm" tuỳ chọn. Tối đa 6 mục, mới nhất trên cùng.
- Chế độ `invite`: một khối đơn: H2 + đoạn văn + CTA (vd "Tham gia thử nghiệm" → `/lien-he` hoặc mailto từ `supportEmail`).

**S9 FAQ** (mới) — H2 + danh sách `<details>/<summary>` (mỗi câu hỏi là `<summary>` chứa H3, vùng bấm ≥ 44px, icon mũi tên
xoay — tắt chuyển động khi `prefers-reduced-motion`). Desktop: `container-prose` căn giữa, 1 cột (dòng dài ≤ 75 ký tự).
Cuối khối: "Chưa thấy câu trả lời? Liên hệ" → trang Liên hệ (§2). Không mở sẵn câu nào.

**S10 CTA cuối trang** — nền accent như hiện tại: H2, đoạn văn, `[CTA chính] [CTA phụ viền]`, slogan nhỏ phía dưới.
Mobile: 2 nút xếp dọc full-width.

### 1.3. Trạng thái rỗng / lỗi

| Tình huống | Hành vi |
|---|---|
| Chưa có bản ghi `home` PUBLISHED | Render **bộ section mặc định** (§1.4) thay vì trang trắng (H6). Editor hiện banner "Chưa lưu lần nào — trang đang hiển thị nội dung mặc định" (cùng mẫu Bảng giá). |
| Section dữ liệu động không đủ ngưỡng | Ẩn im lặng ngoài trang công khai; **trong editor** cạnh section hiện chú thích trạng thái: "Đang ẩn ngoài trang chủ: mới có 2/3 gian hàng đủ điều kiện". |
| Loader một section lỗi (DB timeout) | Section đó không render (không làm vỡ trang); các section CMS khác vẫn hiện. Đề nghị bọc section động bằng `Suspense` + skeleton như `/cua-hang` (`ShelfSkeleton`) để hero không chờ truy vấn. |
| Tất cả CTA có `href` trỏ trang chưa xuất bản | Editor cảnh báo (§1.5); ngoài trang công khai vẫn render link (không đoán). |

### 1.4. Nội dung mặc định khi CMS chưa cấu hình

- Hằng `DEFAULT_HOME_SECTIONS` trong `@gieochu/core` (cạnh `home-sections.ts`), soạn từ chữ trong BH §6 (đã là nội dung chủ
  dự án viết). **Không** chứa số liệu, lời chứng thực, giá.
- Mặc định: `stats` ẩn; `community` = chế độ `invite`; `benefits` dùng 4 lợi ích BH nhưng **`verified = false`** → editor
  nhắc đối chiếu trước khi xuất bản lần đầu.
- Brand name trong chữ mặc định dùng token `{brand}` thay cho "Gieo Chữ" (CLAUDE.md: không hard-code thương hiệu); renderer
  thay bằng `getEffectiveBrand().name`.
- Nút "Khôi phục nội dung mặc định" cho từng section (có xác nhận) — giúp admin quay lại chữ chuẩn.

### 1.5. Cảnh báo trong editor cho tuyên bố BH §8

Hai tầng — không chặn vô lý, nhưng không để lọt điều cấm:

**(a) Cảnh báo mềm (không chặn lưu):** quét mọi ô chữ của trang chủ (và Cửa hàng, Bảng giá, `/p/*`, Menu) theo danh sách mẫu,
hiện ngay dưới ô (gắn `aria-describedby`, biểu tượng tam giác + chữ, không chỉ màu):

| Nhóm BH §8 | Mẫu phát hiện (không phân biệt hoa thường, có/không dấu) | Thông điệp |
|---|---|---|
| Số lượng người dùng/tài liệu/lượt mua | số + `+` / "hơn N", "N người", "N giáo viên", "N tài liệu", "N lượt" | "Có số liệu — chỉ đăng khi đã xác minh với dữ liệu thật. Muốn hiện số tự động, dùng section Số liệu nổi bật." |
| Đánh giá / chứng thực | "sao", "★", "N/5", "đánh giá cao nhất" | "Điểm đánh giá phải lấy từ dữ liệu thật." |
| Thu nhập / doanh số | "thu nhập", "kiếm", "triệu/tháng", "doanh thu", "có đơn sau" | "Không hứa hẹn thu nhập hoặc thời gian có đơn." |
| Miễn phí / không giới hạn | "miễn phí", "trọn đời", "không giới hạn", "không mất phí", "0đ" | "Kiểm tra lại với Bảng giá hiện hành trước khi xuất bản." |
| Tiền về tài khoản | "về thẳng", "trực tiếp vào tài khoản" | "Cần chủ dự án xác nhận cách diễn đạt luồng tiền." |
| An toàn / bảo mật / thời gian giao file | "an toàn tuyệt đối", "bảo mật 100%", "ngay lập tức", "tức thì" | "Tránh cam kết tuyệt đối về bảo mật/thời gian." |

**(b) Chặn cứng khi Xuất bản:**
- Mục testimonial chưa tích "Người này đã đồng ý cho đăng tên và nội dung" → lỗi tại ô, focus vào ô đầu tiên lỗi + error
  summary đầu form (skill `error-summary`, `focus-management`).
- `href` của CTA: phải bắt đầu bằng `/` (nội bộ) hoặc `https://`; chặn `javascript:`, `http://`, `localhost`, `*.vercel.app`
  (BH §7 "không giữ URL preview").
- Hộp xác nhận trước khi xuất bản khi còn cảnh báo mềm: liệt kê "Còn 3 cảnh báo nội dung chưa xử lý" + link nhảy tới từng ô;
  nút "Vẫn xuất bản" / "Quay lại sửa".

Cờ `benefits.items[].verified` (và `steps` toàn khối `verified`): checkbox "Đã đối chiếu với tính năng đang chạy" — không chặn,
nhưng mục chưa tích hiện nhãn "Chưa xác minh" trong editor (không bao giờ hiện ra ngoài).

---

## 2. Bộ trang pháp lý

### 2.1. Kiến trúc thông tin — gộp/tách

| # | Trang | Slug đề xuất (phương án A) | Gộp từ BL | Đối tượng | Ghi chú |
|---|---|---|---|---|---|
| 0 | **Hub "Chính sách & pháp lý"** | `/phap-ly` | — | Mọi người | Liệt kê văn bản đang công bố, nhóm theo đối tượng |
| 1 | Điều khoản sử dụng | `/phap-ly/dieu-khoan-su-dung` | 4.1 + phần "xoá tài khoản" của 4.7 | Mọi người | Tóm tắt quy trình xoá tài khoản, link sang Bảo mật |
| 2 | Chính sách bảo mật & quyền riêng tư | `/phap-ly/chinh-sach-bao-mat` | 4.6 + **cookie** (4.7) + lưu trữ dữ liệu (4.7) | Mọi người | Cookie chỉ là 1 mục vì hiện chỉ có cookie thiết yếu (H14); tách trang khi có analytics |
| 3 | Chính sách nội dung | `/phap-ly/chinh-sach-noi-dung` | 4.3 | Mọi người | Ba nhóm: Bị cấm / Hạn chế / Được phép — mỗi nhóm có ví dụ |
| 4 | Cam kết bản quyền & nguồn gốc tài liệu | `/phap-ly/cam-ket-ban-quyen` | 4.2 | Người bán | Đích của checkbox khi xuất bản tài liệu |
| 5 | Chính sách người bán | `/phap-ly/chinh-sach-nguoi-ban` | 4.5 (phần người bán) | Người bán | Phí/gói: **link sang `/pricing`**, không chép số |
| 6 | Giao dịch & hoàn tiền | `/phap-ly/chinh-sach-hoan-tien` | 4.5 (phần giao dịch) | Người mua | Mô tả đúng ADR-039 (tải lần cuối / yêu cầu hoàn tiền) — chờ duyệt câu chữ |
| 7 | Quyền sử dụng tài liệu | `/phap-ly/quyen-su-dung-tai-lieu` | 4.7 | Người mua | Ngắn; link từ trang tài liệu + checkout |
| 8 | Báo cáo vi phạm & khiếu nại | `/bao-cao-vi-pham` | 4.4 + `huong-dan-bao-cao-ban-quyen` | Mọi người | Trang quy trình + form; mục bản quyền là anchor `#ban-quyen` |
| 9 | Liên hệ & thông tin pháp lý | `/lien-he` | `lien-he-ho-tro` + `thong-tin-phap-ly` | Mọi người | Dữ liệu từ cấu hình; **ẩn từng dòng chưa điền**, không placeholder giả |
| — | Quy chế hoạt động | (chưa tạo) | 4.7 | — | Chỉ tạo khi chủ dự án xác nhận mô hình sàn TMĐT (Q9) |

**Phương án A (khuyến nghị):** gom dưới `/phap-ly/*` → chỉ cần thêm 3 slug vào `RESERVED_SLUGS` (`phap-ly`, `bao-cao-vi-pham`,
`lien-he`) thay vì 9; URL có cấu trúc tự nhiên cho breadcrumb. Redirect 308 `/terms` → Điều khoản, `/privacy` → Bảo mật
(2 slug đã reserved sẵn). **Phương án B:** slug gốc đúng như BL (`/dieu-khoan-su-dung`…) → phải reserve 9 slug + quét slug
tenant trùng trên DB prod. Chọn ở Q8.

### 2.2. Layout trang đọc dài (văn bản pháp lý)

```
SiteHeader (sticky 68/88px)
[skip-link]
Breadcrumb: Trang chủ › Chính sách & pháp lý › Điều khoản sử dụng          (nav aria-label="Đường dẫn")
┌───────────────────────────── container-page ─────────────────────────────┐
│ [Banner Dự thảo — nếu áp dụng, full chiều ngang cột nội dung]             │
│                                                                          │
│  Mobile: H1 / mô tả / dòng meta / [Mục lục ▾ (details)] / nội dung       │
│                                                                          │
│  Desktop ≥ lg:                                                           │
│  ┌ TOC 240px, sticky top-[112px] ┐  ┌ cột nội dung ≤ 768px (prose) ──┐   │
│  │ Trên trang này                 │  │ H1                              │   │
│  │ • 1. Giới thiệu   ← đang đọc   │  │ Mô tả ngắn                      │   │
│  │ • 2. Định nghĩa                │  │ Phiên bản 1.0 · Hiệu lực từ ... │   │
│  │ • ...                          │  │ · Cập nhật ...  · [In / PDF]    │   │
│  │ ─────                          │  │ ─────                           │   │
│  │ Văn bản liên quan              │  │ H2 1. Giới thiệu                │   │
│  │ › Chính sách bảo mật           │  │ H3 ...                          │   │
│  └────────────────────────────────┘  │ ...                             │   │
│                                      │ Văn bản liên quan (thẻ 2 cột)   │   │
│                                      │ Lịch sử phiên bản (details)     │   │
│                                      │ Câu hỏi? → Liên hệ · Lên đầu ↑  │   │
│                                      └─────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────┘
SiteFooter
```
- **Nội dung**: soạn bằng `TiptapEditor` giới hạn H2/H3 (H1 là tiêu đề trang, khoá H1/H4 trong toolbar của editor pháp lý),
  sanitize như hiện tại. Server tự gắn `id` cho H2/H3 (slug không dấu, chống trùng) và dựng TOC từ H2 (H3 lồng 1 cấp, tuỳ
  chọn). Anchor không bị header che nhờ `scroll-padding-top` đã có.
- **Dòng meta**: `<time datetime>` ngày hiệu lực + ngày cập nhật (`vi-VN`, `Asia/Ho_Chi_Minh`); "Phiên bản 1.2".
- **TOC đang đọc**: client nhỏ dùng IntersectionObserver đánh dấu `aria-current="location"` + vạch trái + chữ đậm (không chỉ
  màu); không JS thì TOC vẫn là danh sách link. Mobile: `<details>` "Mục lục (8 mục)" đóng sẵn, đặt ngay dưới meta.
- **Độ rộng**: ADR-024 yêu cầu trang đọc dài dùng `container-prose`. Khi có TOC cần khung rộng hơn → đề xuất thêm utility mới
  `container-doc` (khung `container-page`, lưới `240px + minmax(0, 768px)`) trong `globals.css` thay vì tự đặt `max-w` —
  cần Quốc duyệt bổ sung ADR-024 (Q12). Hub và trang Liên hệ dùng `container-prose` thường.
- **Typography đọc**: body 16px (17px desktop), `line-height 1.75`, đoạn cách 1em, danh sách có thụt lề; liên kết trong văn
  bản gạch chân sẵn (không chỉ đổi màu). In: ẩn header/footer/TOC qua `@media print`.
- **Liên kết chéo**: khối "Văn bản liên quan" chọn tay trong CMS (2–4 văn bản), hiện ở sidebar TOC (desktop) và cuối bài.

**Nhãn "Bản dự thảo"** — 3 trạng thái hiển thị (dùng mẫu khối thông báo tint + viền trái `UI-Design-System §7.1`, có icon +
chữ):

| Trạng thái văn bản | Công khai? | Hiển thị |
|---|---|---|
| `DRAFT` (đang soạn) | Không — 404 với khách; admin xem qua `?xem-truoc=nhap` | Banner "Xem trước bản nháp — chưa công khai" |
| `PUBLISHED` + `reviewStatus = PENDING_LEGAL_REVIEW` | Có (nếu chủ dự án đồng ý công bố dự thảo — Q10) | Banner amber "Bản dự thảo — văn bản đang được rà soát pháp lý và có thể thay đổi." + nhãn "Dự thảo" cạnh tên ở hub/footer? (chỉ ở hub) |
| `PUBLISHED` + `APPROVED` | Có | Không banner |
| `ARCHIVED` (phiên bản cũ) | Có tại `/phap-ly/<slug>/phien-ban/<n>` (Q11) | Banner xám "Đây là phiên bản cũ, hết hiệu lực từ …" + link bản hiện hành; `noindex` |

### 2.3. Hub `/phap-ly`

```
H1 Chính sách & pháp lý
Đoạn giới thiệu (CMS)
H2 Dành cho mọi người dùng   → thẻ: Điều khoản sử dụng · Chính sách bảo mật · Chính sách nội dung
H2 Dành cho người mua        → thẻ: Quyền sử dụng tài liệu · Giao dịch & hoàn tiền
H2 Dành cho người bán        → thẻ: Chính sách người bán · Cam kết bản quyền
H2 Hỗ trợ & báo cáo          → thẻ: Báo cáo vi phạm · Liên hệ
```
Thẻ = cả thẻ là link (mẫu link phủ thẻ §12.1): tên (H3), 1 câu tóm tắt, "Hiệu lực từ dd/mm/yyyy", nhãn chữ "Dự thảo" nếu áp
dụng. Mobile 1 cột, desktop 2 cột. Nhóm không có văn bản công bố → ẩn nhóm. Hub không có văn bản nào → empty state "Các văn
bản chính sách đang được hoàn thiện. Cần hỗ trợ, vui lòng [liên hệ]." (link chỉ hiện khi có trang Liên hệ/`supportEmail`).

### 2.4. Báo cáo vi phạm — mở rộng UX theo BL §4.4

**Trang `/bao-cao-vi-pham`** gồm 2 phần:
1. **Quy trình** (CMS, văn bản ngắn): `<ol>` 9 bước của BL (tiếp nhận → … → lưu lịch sử). **Không hiển thị thời hạn** trừ khi
   cấu hình `reportResponseTimeText` được duyệt (Q15). Mục `#ban-quyen` hướng dẫn khiếu nại bản quyền.
2. **Form** (độc lập, ngoài hộp thoại hiện có):

| Nhóm (fieldset/legend) | Trường | Ghi chú UX |
|---|---|---|
| 1. Loại báo cáo | Radio dạng thẻ (7 loại BL): Khiếu nại bản quyền · Nguồn gốc không rõ/giả mạo · Nội dung trái pháp luật · Xâm phạm dữ liệu cá nhân · Gian lận/lừa đảo/giao dịch · Tài liệu lỗi/không đúng mô tả · Khác | Mỗi thẻ có 1 dòng gợi ý (mẫu `TYPE_HINTS`). Chọn "Tài liệu lỗi" → hiện ghi chú "Với đơn đã mua, bạn có thể liên hệ gian hàng trước…" (Q14) |
| 2. Nội dung bị báo cáo | Đường dẫn (URL) **hoặc** mã — một ô `type="url"`; mở từ nút trên trang tài liệu thì điền sẵn + hiện thẻ xem trước "Tài liệu “…” của gian hàng …" (khoá, có nút "Đổi") | Server phân giải URL → PRODUCT/POST/TENANT; không phân giải được → lỗi tại ô "Không tìm thấy nội dung công khai tại đường dẫn này" |
| 3. Mô tả | Textarea ≤ 2000 ký tự + bộ đếm | Giữ quy tắc hiện có |
| 4. Bằng chứng | Danh sách link (≤ 5, Thêm/Xoá) — upload tệp để giai đoạn sau (Q13) | |
| 5. **Chỉ khi loại = bản quyền** (progressive disclosure, `aria-expanded` không cần — nội dung xuất hiện ngay sau radio, có thông báo `role="status"`) | Họ tên / tổ chức bên khiếu nại · Vai trò (Chủ sở hữu / Đại diện được uỷ quyền) · Tác phẩm gốc (mô tả + link) · Phần bị xâm phạm · Căn cứ quyền (text + link bằng chứng) · Checkbox tuyên bố thiện chí · Checkbox tuyên bố chính xác & có quyền đại diện | Hai checkbox tuyên bố là bắt buộc riêng cho bản quyền |
| 6. Liên hệ | Email (bắt buộc với khách; đã đăng nhập thì hiện email tài khoản dạng chỉ đọc) · SĐT tuỳ chọn (Q16) | `autocomplete="email"`, `type="email"` |
| 7. Xác nhận | Checkbox "Thông tin tôi gửi là trung thực theo hiểu biết của tôi" (bắt buộc) + đoạn thông báo xử lý dữ liệu cá nhân có link Chính sách bảo mật | |
| Ẩn | Honeypot + rate limit 5/giờ/IP (giữ ADR-038) | |

- Lỗi: error summary đầu form (focus vào, link tới từng ô) + lỗi dưới từng ô (`aria-describedby`, `role="alert"`).
- Nút gửi: trạng thái "Đang gửi…" + `disabled`; chống gửi lặp.
- **Trang/khối thành công**: icon check + H2 "Đã tiếp nhận báo cáo" + **mã tiếp nhận** (vd `BC-7KQ2-9XHM`, font tabular, nút
  "Sao chép mã" có thông báo `aria-live`) + "Chúng tôi đã gửi email xác nhận tới a•••@gmail.com" + link về trang trước.
  Không hứa thời hạn.
- **Hộp thoại hiện có** trên trang tài liệu/đánh giá/bài viết: giữ (nhanh, ít trường), cập nhật danh sách loại theo 7 loại;
  khi chọn "Khiếu nại bản quyền" hiện link "Khiếu nại bản quyền cần thêm thông tin — mở biểu mẫu đầy đủ" →
  `/bao-cao-vi-pham?loai=ban-quyen&url=<trang hiện tại>#bieu-mau`. Thêm nút "Báo cáo gian hàng" ở storefront (target TENANT).
- **Admin `/admin/reports`**: lọc thêm theo loại mới + trạng thái mở rộng (contract §5.C); hồ sơ bản quyền hiện khối "Thông tin
  bên khiếu nại" riêng. (Chỉ admin thấy — ADR-038 mục 4 giữ nguyên.)

### 2.5. Điểm chấp thuận

| Điểm | Hiện tại | Đề xuất UX |
|---|---|---|
| Đăng ký tài khoản | Checkbox không link, lưu `consentAt` | Nhãn: "Tôi đồng ý với [Điều khoản sử dụng] và đã đọc [Chính sách bảo mật]." — link mở tab mới, kèm chữ ẩn "(mở trong tab mới)" + icon ngoài; checkbox 18px trong nhãn có vùng bấm ≥ 44px (mẫu `rightsConfirmed`). Lưu chấp thuận **theo phiên bản** (§5.B). Nếu văn bản chưa công bố → không hiện link (chỉ chữ) và ghi rõ trong Q10. |
| Mở gian hàng (`/studio` onboarding) | Không có | Thêm checkbox bắt buộc trước nút tạo: "Tôi đồng ý với [Chính sách người bán] và [Cam kết bản quyền & nguồn gốc tài liệu]." Lỗi tại ô nếu bỏ trống. |
| Xuất bản tài liệu | Đã có checkbox (ADR-038) | Giữ nguyên hành vi; thêm link "[Đọc cam kết bản quyền]" trong dòng gợi ý; ghi kèm phiên bản cam kết vào lần xác nhận. |
| Checkout | Không có | **Không** thêm checkbox giả. Dòng chữ dưới nút thanh toán: "Khi thanh toán, bạn đồng ý với [Quyền sử dụng tài liệu] và [Chính sách hoàn tiền]." (Q17 — có cần checkbox lưu vết không) |
| Văn bản trọng yếu đổi (`requiresReacceptance`) | — | Sau đăng nhập, nếu user chưa chấp thuận phiên bản mới: **trang chặn mềm** `/account/dieu-khoan-moi` (không modal): tóm tắt thay đổi (CMS), link văn bản, checkbox + "Đồng ý và tiếp tục"; link "Đăng xuất" làm lối thoát. Thay đổi không trọng yếu → banner trong `/account` + email, đóng được. |

---

## 3. CMS Menu header/footer

> Đổi một phần ADR-025 ("chrome cố định, không thuộc CMS"): header/footer **vẫn của hệ thống**, nhưng nội dung menu do System
> Admin sửa. Tenant vẫn không có quyền. Quốc cần ghi bổ sung ADR.

### 3.1. Vị trí & bố cục editor

Trang mới `/admin/cms/menu` ("Menu & chân trang"), thêm vào nhóm CMS của `sidebar-nav.tsx`. Bố cục giống editor Bảng giá:
thanh trạng thái (Chưa lưu / Bản nháp / Đã xuất bản + nhãn "Có nháp chưa xuất bản"), nút **Lưu nháp · Xem trước bản nháp ·
Xuất bản · Khôi phục bản đang chạy**, cảnh báo rời trang khi còn thay đổi.

```
[Thanh trạng thái + nút hành động]
┌ Card 1: Menu đầu trang ──────────────────────────────┐
│ SortableListEditor (tối đa 5 mục cấp 1)              │
│  Mục 1  [Nhãn][Loại link ▾][Đích][□ Tab mới][● Hiện] │
│         └ Menu con (tuỳ chọn, tối đa 8 — 1 cấp)       │
│  [+ Thêm mục]                                         │
├ Card 2: Nút kêu gọi đầu trang (khách chưa đăng nhập) ┤
│  Nhãn (≤ 24 ký tự, đếm) · Đích · Hiện/ẩn              │
├ Card 3: Chân trang ──────────────────────────────────┤
│  Mô tả ngắn dưới logo (≤ 160 ký tự; mặc định slogan)  │
│  Cột (1–4, Lên/Xuống): Tiêu đề cột + link (1–8)       │
│  Dòng bản quyền: "© {năm} {brand}. Bảo lưu mọi quyền."│
├ Card 4: Xem trước ───────────────────────────────────┤
│  [Desktop | Mobile]  — render SiteHeader/SiteFooter   │
│  bằng dữ liệu nháp, khung 375px khi chọn Mobile       │
└──────────────────────────────────────────────────────┘
```

### 3.2. Một mục link

| Trường | UX |
|---|---|
| Nhãn | Bắt buộc, ≤ 32 ký tự (cấp 1 ≤ 20 để vừa nav ngang), bộ đếm |
| Loại link | Select: **Trang có sẵn** (danh sách gợi ý: Trang chủ, Cửa hàng, Tài liệu, Bảng giá, Hub pháp lý + từng văn bản, Báo cáo vi phạm, Liên hệ, các trang `/p/*`) · **Đường dẫn nội bộ** (bắt đầu `/`) · **Liên kết ngoài** (`https://` bắt buộc) · **Email** (`mailto:` — mặc định lấy `supportEmail`) |
| Mở tab mới | Checkbox; mặc định bật cho link ngoài, tắt cho nội bộ. Khi bật: renderer tự thêm `rel="noopener noreferrer"`, icon ngoài + chữ ẩn "(mở trong tab mới)" |
| Hiện/ẩn | Công tắc; mục ẩn mờ đi trong danh sách + nhãn "Đang ẩn" (chữ, không chỉ màu) |
| Kiểm tra đích | Cảnh báo (không chặn): trang CMS/pháp lý chưa xuất bản ("Khách sẽ gặp trang 404"), trùng đích với mục khác. Chặn: `javascript:`, `http://`, domain preview/localhost |

**Menu con 1 cấp — khuyến nghị cho phép nhưng mặc định không dùng.** Mục cấp 1 có menu con trở thành **nút** (không phải link)
`aria-expanded` mở panel thả xuống khi **bấm** (không chỉ hover — skill `hover-vs-tap`); Esc đóng và trả focus, bấm ra ngoài
đóng, Tab đi tuần tự trong panel. Mobile: mục có con là nút mở/thu danh sách con lồng (accordion) trong `MobileNav`. Mục cấp 1
có con thì không có đích riêng (tránh "link vừa bấm vừa mở"). Giới hạn 5 mục cấp 1 (skill `overloaded nav`).

### 3.3. Hành vi hiển thị

- **Một nguồn dữ liệu** cho nav ngang (≥ lg), `MobileNav` (< lg) và footer. "Đăng nhập" và `AccountMenu` là phần hệ thống, không
  thuộc CMS; mobile vẫn tự thêm "Đăng nhập" khi chưa đăng nhập (giữ hành vi hiện tại).
- **Trang hiện tại**: thay prop `current` (trang tự truyền) bằng so khớp `pathname` với `href` (khớp chính xác hoặc tiền tố cho
  mục có trang con) → `aria-current="page"` + đậm + gạch chân. Cần Hiếu cung cấp pathname cho Server Component (contract §5.D).
- Nút CTA đầu trang: giữ kiểu hiện tại (pill accent, vùng bấm ≥ 44px qua pseudo-element). Nhãn đọc từ CMS — **thay chữ
  "Mở gian hàng miễn phí"** (H4); mặc định đề xuất "Mở gian hàng" (Q3).
- Footer mobile: cột xếp 2×n như hiện tại; > 2 cột trên mobile → mỗi cột là `<details>` thu gọn? **Không** — giữ mở hết (footer
  ít link, thu gọn làm khó tìm "Điều khoản"); chỉ đổi lưới 2 cột.
- Năm bản quyền: token `{năm}` lấy năm hiện tại theo `Asia/Ho_Chi_Minh`.

### 3.4. Menu mặc định khi chưa cấu hình

Giữ **đúng menu hiện tại nhưng bỏ mục chết** (H5):
- Header: Bảng giá (`/pricing`) · Cửa hàng (`/cua-hang`). ("Giáo viên & Coach" chỉ thêm khi có trang danh bạ gian hàng.)
- CTA: "Mở gian hàng" → `/register` (chờ Q3).
- Footer: **Khám phá** (Cửa hàng, Tài liệu `/cua-hang/tai-lieu`, Bảng giá) · **Hỗ trợ** (Liên hệ, Báo cáo vi phạm — khi có trang) ·
  **Pháp lý** (Điều khoản sử dụng, Chính sách bảo mật, "Tất cả chính sách" → hub — khi đã xuất bản). Mục trỏ trang chưa tồn tại
  bị lọc khi render mặc định.

---

## 4. SEO tuỳ chọn cho từng trang

### 4.1. Khối "SEO & chia sẻ" dùng chung

Một component editor dùng chung (`admin/cms/_ui/seo-fields.tsx`) đặt **cuối mọi editor**: trang chủ, Cửa hàng, Bảng giá, `/p/*`,
văn bản pháp lý, hub, báo cáo vi phạm, liên hệ. Khối thu gọn mặc định (`<details>` "SEO & chia sẻ — đang dùng mặc định" /
"— đã tuỳ chỉnh") để không làm rối editor (skill `progressive-disclosure`).

| Trường | UX | Giới hạn |
|---|---|---|
| Tiêu đề SEO | Placeholder hiện **giá trị mặc định thực tế** (vd "Bảng giá \| Gieo Chữ"); bộ đếm "45/60" + chữ trạng thái "Vừa đẹp" / "Hơi dài — Google có thể cắt bớt" (chữ + icon, không chỉ màu); bộ đếm gắn `aria-describedby`, không đọc liên tục | Khuyến nghị ≤ 60, tối đa 120 (giữ `PRICING_SEO_TITLE_MAX`) |
| Mô tả SEO | Textarea, như trên | Khuyến nghị 70–160, tối đa 320 |
| Ảnh chia sẻ (OG) | `ImageUploadField`, gợi ý 1200×630; trống → dùng `ogImageUrl` của Nhận diện thương hiệu (hiện ảnh đó mờ làm mẫu) | PNG/JPG/WebP ≤ 5MB |
| Không cho công cụ tìm kiếm lập chỉ mục | Checkbox, mặc định tắt; bật → cảnh báo "Trang sẽ biến mất khỏi Google" và trang bị loại khỏi sitemap | — |
| Đường dẫn chuẩn (canonical) | **Chỉ đọc**, hiển thị URL tự tính từ `APP_URL` + path (không cho sửa — tránh khai sai làm mất index) | — |
| Xem trước | Thẻ mô phỏng kết quả Google (đường dẫn dạng breadcrumb · tiêu đề xanh · mô tả, cắt theo ~60/160 ký tự với "…") + thẻ chia sẻ mạng xã hội (ảnh 1.91:1 + tiêu đề + domain). Cập nhật theo ô đang gõ (debounce) | — |

- **Nháp**: hiện SEO "không có nháp" (Bảng giá). Đề xuất SEO đi chung luồng Lưu nháp/Xuất bản để nhất quán (Q18).
- Trang chủ cần thêm `generateMetadata` đọc SEO CMS, mặc định = BH §4.1/§4.2 (chữ thương hiệu qua token).

### 4.2. Structured data (tự động, không có ô nhập)

Trong khối SEO hiện dòng thông tin chỉ đọc "Dữ liệu có cấu trúc được tạo tự động: Organization, WebSite" (theo trang) — admin
không nhập JSON-LD tay (BH §4.5 "không đánh dấu dữ liệu không hiển thị").

| Schema | Trang | Nguồn | Điều kiện |
|---|---|---|---|
| `Organization` | Trang chủ | brand name, `APP_URL`, logo vuông; `contactPoint.email` = `supportEmail`; `legalName`/địa chỉ từ thông tin pháp lý | Trường nào trống thì bỏ trường đó |
| `WebSite` + `SearchAction` | Trang chủ | target `/cua-hang/tai-lieu?q={search_term_string}` (đã có tìm kiếm thật) | Luôn |
| `BreadcrumbList` | Văn bản pháp lý, hub, `/p/*`, trang tài liệu, storefront, danh mục | Khớp breadcrumb hiển thị trên trang | Chỉ khi trang có breadcrumb hiển thị |
| `Product` + `Offer` | Trang chi tiết tài liệu | tên, ảnh bìa, giá VND hiệu lực, `availability`; `aggregateRating` chỉ khi có đánh giá thật > 0 | Không nằm trong phạm vi editor — ghi để Hiếu làm cùng |
| `FAQPage` | — | **Không thêm** (BH không yêu cầu; Google đã giới hạn rich result FAQ) | — |

`sitemap.xml` + `robots.txt` (H7): gồm trang chủ, Cửa hàng, Bảng giá, `/p/*` PUBLISHED, hub + văn bản pháp lý PUBLISHED, storefront +
tài liệu công khai; loại trừ `noindex`, bản xem trước, phiên bản cũ, `/admin`, `/studio`, `/account`, `/s/*`.

---

## 5. Contract dữ liệu cần bổ sung (cho Long ghi spec, Hiếu làm)

### 5.A. Section trang chủ (`CmsPage.slug = "home"`, `packages/core/src/admin/home-sections.ts`)

| Section | Thay đổi field | Kiểu / giới hạn | Tương thích ngược |
|---|---|---|---|
| `hero` | + `brandMessage?` (trống = slogan brand), + `imageAlt?` | string ≤ 80 / ≤ 160 | Field mới tuỳ chọn |
| `stats` | — (mặc định `visible=false` trong `DEFAULT_HOME_SECTIONS`) | — | — |
| `search` | + `eyebrow?`, + `submitLabel` (mặc định "Tìm tài liệu") | ≤ 40 / ≤ 20 | Parse phòng thủ điền mặc định |
| `benefits` | `items[]` + `verified: boolean` (chỉ editor dùng) | mặc định false | Thiếu → false |
| `coaches` | + `eyebrow?`, + `cta?: {label, href}`, + `minToShow` | `minToShow` 1–12, mặc định 3 | Thiếu → mặc định |
| `documents` | + `eyebrow?`, + `cta?`, + `minToShow`, + `fallback: "hide" \| "categories"` | mặc định 3 / `"categories"` | Thiếu → mặc định |
| `becomeSeller` | + `body: string[]` (0–3 đoạn), + `secondaryCta?`; `bullets` min 0 | đoạn ≤ 600 | Thiếu → [] |
| `steps` (mới) | `eyebrow?`, `title`, `items[{id,title,description}]` 2–6, `cta?`, `verified` | | — |
| `community` (mới, thay `testimonials`) | `mode: "testimonials" \| "devlog" \| "invite"`, `eyebrow?`, `title`, `description?`; `testimonials[{id,quote,name,role,avatarUrl?,consentConfirmed}]` ≤ 6; `devlog[{id,date,title,summary,href?}]` ≤ 6; `invite{text, cta}` | `date` ISO (UTC lưu, hiển thị VN) | Parse `testimonials` cũ → `community` mode `testimonials`, `consentConfirmed=false` (tức là **ẩn** cho tới khi admin xác nhận) |
| `faq` (mới) | `title`, `items[{id,question,answer}]` 1–20 | như Bảng giá (200/1500) | — |
| `finalCta` | + `secondaryCta?`, + `showSlogan` | mặc định true | — |
| Toàn trang | `DEFAULT_HOME_SECTIONS`, token `{brand}`; mỗi `type` ≤ 1 lần | | — |
| Dữ liệu cho editor | Số mục thật đủ điều kiện của coaches/documents/danh mục (để hiện "Đang ẩn: 2/3") | `{ tenants: number, products: number, categories: number }` | Action đọc-only cho SYSTEM_ADMIN |
| Xem trước | `/?xem-truoc=nhap` (SYSTEM_ADMIN, `noindex`) như Bảng giá | | — |
| Cảnh báo §8 | Danh sách mẫu (regex) đặt ở `@gieochu/core` dùng chung editor (client) và kiểm lúc xuất bản (server, chỉ chặn các luật cứng §1.5b) | | — |

### 5.B. Văn bản pháp lý & chấp thuận

| Thực thể | Trường | Ghi chú |
|---|---|---|
| `LegalDocument` (L1) | `id` cuid2, `key` (enum/slug ổn định: `terms`, `privacy`, `content-policy`, `copyright-pledge`, `seller-policy`, `refund-policy`, `buyer-license`, `report-process`), `slug`, `title`, `summary` (≤ 200, dùng ở hub + meta), `audience` (`ALL\|BUYER\|SELLER\|SUPPORT`), `relatedKeys[]`, `sortOrder`, SEO (§5.E) | Một dòng/văn bản |
| `LegalDocumentVersion` | `documentId`, `version` (int tăng dần; hiển thị "1.0, 1.1…" — Q11), `contentHtml` (sanitize, H2/H3), `changeSummary`, `status` `DRAFT\|PUBLISHED\|ARCHIVED`, `reviewStatus` `PENDING_LEGAL_REVIEW\|APPROVED`, `requiresReacceptance`, `effectiveAt`, `publishedAt`, `createdById` | Chỉ 1 PUBLISHED / văn bản; xuất bản bản mới → bản cũ ARCHIVED |
| `UserLegalAcceptance` | `userId`, `documentKey`, `versionId`, `acceptedAt`, `context` (`REGISTER\|STORE_OPEN\|PRODUCT_PUBLISH\|REACCEPT`), `tenantId?` | Idempotent theo (`userId`,`versionId`,`context`); `ip`/UA tối thiểu chỉ khi Q19 đồng ý |
| Thông tin pháp lý/liên hệ | Mở rộng `SystemSettings` hoặc bảng `SystemLegalInfo` 1 dòng: `operatorName`, `legalEntityName?`, `businessRegNo?`, `address?`, `supportEmail` (có sẵn), `copyrightEmail?`, `privacyEmail?`, `phone?`, `reportResponseTimeText?` | Trang Liên hệ ẩn dòng trống; không bao giờ hiện placeholder |
| Editor `/admin/cms/legal` | Danh sách văn bản (bảng: tên, phiên bản hiện hành, trạng thái rà soát, hiệu lực) → trang sửa: Tiptap (H2/H3), meta, "Văn bản liên quan", "Yêu cầu chấp thuận lại", Lịch sử phiên bản (chỉ đọc), Lưu nháp / Xem trước / Xuất bản (hộp xác nhận nêu rõ ngày hiệu lực + có yêu cầu chấp thuận lại không) | Tái dùng kit + `SortableListEditor` cho văn bản liên quan |
| Đăng ký | `POST /api/auth/register` nhận thêm `acceptedVersionIds` (server tự lấy phiên bản PUBLISHED hiện hành, không tin client) | Thay/giữ `consentAt` — Hiếu quyết với Quốc |
| Onboarding gian hàng | Server Action tạo tenant nhận `acceptSellerTerms: true` | Bắt buộc |
| Xuất bản tài liệu | Ghi thêm `versionId` cam kết bản quyền cạnh `rightsConfirmedAt` | |
| Chấp thuận lại | Hàm `getPendingReacceptance(userId)` + trang `/account/dieu-khoan-moi` | |

### 5.C. Báo cáo vi phạm (mở rộng ADR-038)

| Mục | Hiện có | Cần |
|---|---|---|
| `AbuseReportType` | 4 giá trị | Thêm `ORIGIN_UNCLEAR`, `ILLEGAL`, `PRIVACY`, `DEFECTIVE` (giữ `INAPPROPRIATE` cho dữ liệu cũ hoặc gộp vào `ILLEGAL` — Q14) |
| `AbuseTargetType` | PRODUCT/REVIEW/POST | Thêm `TENANT` (gian hàng); `ORDER` chỉ khi Q14 chốt (vướng §7.9 — admin không đọc chi tiết đơn) |
| Đầu vào | `targetType+targetId` | Thêm đường vào bằng `targetUrl` → server phân giải; `tenantId` vẫn suy từ đối tượng |
| Bản quyền | — | `claimant{name, role: OWNER\|AUTHORIZED_AGENT, phone?}`, `originalWork{description, url?}`, `infringingPart`, `rightsBasis`, `goodFaithAt`, `accuracyAt` (Json hoặc bảng con) |
| Xác nhận trung thực | — | `truthfulConfirmedAt` |
| Mã tiếp nhận | Không | `receiptCode` ngắn, duy nhất, không đoán được (vd 8 ký tự base32); trả trong response 201 + email xác nhận |
| Trạng thái | OPEN/RESOLVED/REJECTED | Đề xuất thêm `UNDER_REVIEW`, `NEED_MORE_INFO`, `APPEAL_REVIEW` (BL §8) — Quốc chốt (đụng CHECK `decision_shape`) |
| Nhật ký | Audit chung | `ReportActivity` (actor, action, reason, at) cho dòng thời gian trong trang chi tiết admin |
| Tra cứu trạng thái công khai | Không | Tuỳ Q15 — nếu có: `/bao-cao-vi-pham/tra-cuu` nhập mã + email |

### 5.D. Menu header/footer

| Mục | Contract |
|---|---|
| Lưu trữ | Tái dùng `CmsPage` với slug hệ thống mới `menu` (thêm vào `SYSTEM_CMS_SLUGS`), `blocks`/`blocksDraft` (cùng mẫu ADR-035) — không bảng mới |
| Shape | `{ header: { items: NavItem[] (≤5), cta: { label ≤24, href, visible } }, footer: { description? ≤160, columns: { id, title ≤32, links: NavLink[] 1–8 }[] 1–4, copyright ≤120 (token {năm}, {brand}) } }` |
| `NavLink` | `{ id, label ≤32, kind: "page"\|"internal"\|"external"\|"email", target: string, newTab: boolean, visible: boolean }`; `page` = khoá trang có sẵn (`shop`, `pricing`, `legal:terms`, `cms:<slug>`…) để đổi slug không vỡ link |
| `NavItem` | `NavLink` + `children?: NavLink[]` (≤ 8, 1 cấp; có children thì bỏ `target`) |
| Mặc định | `DEFAULT_SITE_MENU` (§3.4), lọc mục trỏ trang chưa tồn tại khi render |
| Render | `getSiteMenu()` có `cache()` theo request; `SiteHeader` cần `pathname` (header `x-pathname` gắn trong `proxy.ts` hoặc tách phần nav thành client component dùng `usePathname`) — Hiếu chọn |
| Kiểm tra | Danh sách "trang có sẵn" + trạng thái xuất bản cho editor (action đọc-only) |

### 5.E. SEO dùng chung

| Mục | Contract |
|---|---|
| `CmsPage` | Thêm `ogImageUrl?`, `noindex Boolean @default(false)`; (nếu Q18 = có nháp) `seoDraft Json?` |
| `LegalDocument` | Cùng bộ: `seoTitle?`, `seoDescription?`, `ogImageUrl?`, `noindex` |
| Helper | `buildPageMetadata({ seo, fallbackTitle, fallbackDescription, path, preview })` → `Metadata` (title, description, canonical, openGraph, robots) — dùng cho mọi trang CMS để hết lặp code ở `cua-hang`/`pricing` |
| JSON-LD | Component server `<JsonLd data>` dùng nonce CSP (ADR-016) |
| Sitemap/robots | `app/sitemap.ts`, `app/robots.ts` |

---

## 6. Câu hỏi mở cho chủ dự án

1. **Số liệu nổi bật**: đếm thật từ DB đã có — có được bật trên trang chủ trong giai đoạn thử nghiệm không, hay ẩn tới khi ra
   mắt chính thức? (Đề xuất: ẩn.)
2. **Đăng ký có đang mở cho mọi người không?** BH S6 chỉ cho CTA dẫn tới đăng ký khi mở. Nếu có lúc đóng, cần thêm cờ cấu hình
   "Đăng ký mở/đóng" + đích thay thế (vd "Đăng ký nhận tin") — hiện code chưa có cờ này.
3. Nút header hiện ghi **"Mở gian hàng miễn phí"** — giữ chữ "miễn phí" (gói Free có thật trên Bảng giá?) hay đổi thành "Mở gian
   hàng"? Cùng câu hỏi cho các nơi khác có chữ "miễn phí".
4. Ngưỡng tối thiểu để hiện "Gian hàng nổi bật" / "Tài liệu nổi bật": 3 có hợp lý không?
5. Có làm **trang danh bạ gian hàng** ("Giáo viên & Coach") không? Nếu chưa, CTA "Khám phá các gian hàng" trỏ về `/cua-hang` có
   được không?
6. Section 8: giai đoạn này dùng **nhật ký phát triển** hay **lời mời thử nghiệm**? Đã có lời nhận xét nào có đồng ý bằng văn bản?
7. Lời mời thử nghiệm dẫn tới đâu: trang Liên hệ, email hỗ trợ, hay form đăng ký riêng (chưa có)?
8. Slug pháp lý: **Phương án A** `/phap-ly/<slug>` (khuyến nghị) hay **B** slug gốc như BL?
9. Gieo Chữ có đăng ký/thông báo là **sàn giao dịch TMĐT** với Bộ Công Thương không? (Quyết định có trang Quy chế hoạt động.)
10. Có **công bố công khai bản dự thảo** (kèm nhãn "Bản dự thảo") trước khi luật sư duyệt không? Nếu không, checkbox đăng ký sẽ
    tạm không có link văn bản.
11. Đánh số phiên bản kiểu "1.0/1.1" hay theo ngày? Phiên bản cũ có cần xem công khai không?
12. Đồng ý thêm utility `container-doc` (bổ sung ADR-024) cho trang văn bản có mục lục bên cạnh?
13. Form báo cáo có cần **upload tệp bằng chứng** (bucket private + quét mã độc) ngay, hay chỉ link như hiện tại?
14. Báo cáo loại "giao dịch" và "tài liệu lỗi/không đúng mô tả": xử lý bởi System Admin (vướng §7.9 — admin không xem đơn) hay
    chuyển cho gian hàng? Có gộp `INAPPROPRIATE` cũ vào "Nội dung trái pháp luật" không?
15. Có công bố **thời hạn phản hồi** báo cáo không (chữ gì)? Có cần trang **tra cứu trạng thái** bằng mã tiếp nhận không?
16. Form báo cáo có hỏi số điện thoại không (dữ liệu cá nhân thêm)?
17. Checkout cần **checkbox lưu vết** đồng ý Quyền sử dụng tài liệu/Hoàn tiền, hay chỉ dòng thông báo?
18. SEO có đi theo luồng **nháp/xuất bản** như nội dung không (hiện Bảng giá áp dụng ngay)?
19. Khi lưu chấp thuận điều khoản, có lưu IP/User-Agent làm bằng chứng không (cân nhắc dữ liệu cá nhân)?
20. Có cho người dùng hiện hữu một **thời gian ân hạn** trước khi buộc chấp thuận lại điều khoản mới không?
21. Tên, địa chỉ, mã số pháp nhân, email bản quyền/quyền riêng tư — ai cung cấp, khi nào? (Trang Liên hệ ẩn dòng trống tới lúc đó.)

---

## 7. Quy tắc skill `ui-ux-pro-max` đã đối chiếu

| Quy tắc | Áp dụng ở |
|---|---|
| `heading-hierarchy` | 1 H1/trang; H2 mỗi section; H3 cho lợi ích, bước, câu FAQ, thẻ hub |
| `skip-links`, `focus-not-obscured` | Skip-link trang chủ; `scroll-padding-top` cho anchor TOC; TOC sticky `top-[112px]` |
| `color-not-only`, `nav-state-active` | TOC đang đọc, menu hiện tại, nhãn "Đang ẩn"/"Dự thảo"/cảnh báo đều có chữ/icon |
| `hover-vs-tap`, `keyboard-nav`, `escape-routes` | Menu con mở bằng bấm, Esc đóng; trang chấp thuận lại có lối "Đăng xuất" |
| `dragging-alternative` | Sắp xếp bằng Lên/Xuống (`SortableListEditor`), không kéo-thả |
| `touch-target-size` | CTA, summary FAQ, mục menu mobile ≥ 44px; checkbox nằm trong nhãn có vùng bấm lớn |
| `error-summary`, `error-placement`, `aria-live-errors`, `focus-management` | Form báo cáo, xuất bản CMS khi có lỗi cứng |
| `progressive-disclosure` | Trường bản quyền chỉ hiện khi chọn loại; khối SEO thu gọn |
| `empty-states`, `content-jumping` | Trang chủ mặc định, hub rỗng, skeleton section động |
| `line-length-control`, `line-height` | `container-prose` / cột 768px, line-height 1.75 cho văn bản pháp lý |
| `reduced-motion` | Mũi tên FAQ, cuộn TOC không smooth khi giảm chuyển động |
| `primary-action` | Mỗi section 1 CTA chính |
| Next.js `Use generateMetadata for dynamic`, `Include OpenGraph images` | §4 |
| Tra `"metadata seo open graph" --stack nextjs` | **Không có kết quả**, thử lại `"metadata"` có kết quả (3 mục trên). Phần sitemap/JSON-LD/giới hạn ký tự SEO là **hướng dẫn chung**, không từ dataset |

---

## 8. Tác động tài liệu (để Long cập nhật khi được giao)

- `UI-Design-System.md`: §1.1 (header/footer đọc menu CMS, bỏ prop `current`), §12 (section trang chủ mới + quy tắc cảnh báo §8),
  mục mới "Trang văn bản pháp lý" (layout TOC, banner dự thảo, `container-doc` nếu duyệt), "Khối SEO dùng chung", form báo cáo
  độc lập; §4 ADR-024 nếu thêm utility.
- `docs/DECISIONS.md` (Quốc): bổ sung ADR-025 (menu do System Admin cấu hình), ADR-033 (section mới, `community`), ADR-038 (loại/đối
  tượng/mã tiếp nhận), ADR mới cho văn bản pháp lý + chấp thuận theo phiên bản, ADR mới cho SEO/sitemap.
- Spec `02-System-Specs/` CMS trang chủ, CMS menu, pháp lý; `03-API-Contracts/` `/api/reports`, `/api/auth/register`.
- `RESERVED_SLUGS` (`packages/core/src/tenant/slug.ts`): thêm slug theo Q8.

---
tags: [ke-hoach, trang-chu, phap-ly, menu, seo, cms]
date: 2026-10-23
---

# Kế hoạch: Trang chủ + Pháp lý + Menu CMS + SEO — đợt 1 đã chốt (ADR-050)

> Người soạn: Long (tài liệu) theo brief của Quốc, 2026-10-23. **Kế hoạch gốc (lúc soạn chưa code, chưa DDL); chủ dự án đã chốt đợt 1 ở ADR-050 — trạng thái code hiện hành xem §0.**
> Đầu vào: `docs/GIEOCHU_HOMEPAGE_CONTENT_BRIEF.md` (brief nội dung trang chủ v1.0, 21/10/2026),
> `docs/claude-code-gieochu-legal-pages-implementation-brief.md` (brief trang pháp lý), nguyên tắc **CMS trước, UI sau**
> (`CLAUDE.md`; mẫu ADR-033 trang chủ, ADR-035 Cửa hàng, ADR-041 Bảng giá), đề xuất UX của Phong
> `docs/de-xuat-ux-home-legal-menu-2026-10-23.md` (gộp ở §7 khi có).
>
> **Mức xác minh:** ✅ đã đối chiếu code/schema trong repo ngày 2026-10-23 · 🟡 nghe từ báo cáo/ADR, chưa đối chiếu
> code · ❓ cần môi trường thật (DB production) hoặc cần chủ dự án/Quốc/luật sư quyết.
> Mọi chỗ ghi "đề xuất" là phương án kế hoạch, **chưa phải quyết định**.
>
> **Đọc lại khi bị gián đoạn:** §0 trạng thái → §6 thứ tự → §8 câu hỏi mở. Tài liệu kèm:
> `docs/legal/LEGAL_REVIEW_CHECKLIST.md`.

---

## 0. Trạng thái

| Hạng mục | Trạng thái 2026-10-23 |
|---|---|
| Audit hiện trạng (§1) | Xong (Long) |
| **Chủ dự án chốt** | **Đợt 1 theo ADR-050** (`docs/DECISIONS.md`), thứ tự, mỗi hạng mục CMS trước UI sau: (1) CMS menu header/footer (hạng mục C, không migration, sửa ADR-025); (2) trang chủ theo brief + SEO trang chủ (hạng mục A + phần ô SEO/`generateMetadata` trang chủ của D, không migration); (3) Điều khoản sử dụng có phiên bản + ghi nhận chấp thuận khi đăng ký (một phần hạng mục B, migration expand-only — Hiếu viết, Quốc duyệt, chủ dự án chạy). Test: nâng trần +1 unit, +2 integration (94/55 → 95/57) |
| Hoãn sang giai đoạn pháp lý (sau khi hệ thống chạy) | Các trang pháp lý khác, trang hub `/phap-ly`, mở rộng báo cáo vi phạm `abuse_reports` (M-R), chấp thuận khi mở gian hàng/xuất bản, công bố bản dự thảo, xoá tài khoản, thông tin pháp nhân; phần D còn lại (ảnh OG, noindex, sitemap, robots, JSON-LD, M-S) |
| Kế hoạch A–D (§2–§5) | Bản đề xuất gốc — **phạm vi đã thu hẹp theo ADR-050**; chỗ ADR-050 khác kế hoạch thì theo ADR-050 (vd đợt này chỉ một văn bản `terms` tại `/phap-ly/dieu-khoan-su-dung`, không lưu IP/User-Agent) |
| Đề xuất UX của Phong | Đã gộp (§7) — `docs/de-xuat-ux-home-legal-menu-2026-10-23.md`; chỗ hai bên lệch ghi ở §7.2 |
| `docs/legal/LEGAL_REVIEW_CHECKLIST.md` | Bản đầu (theo brief pháp lý §5) |
| Dự thảo Điều khoản sử dụng | `docs/legal/drafts/dieu-khoan-su-dung.md` (Long, 2026-10-23) — **bản dự thảo, chưa được luật sư rà soát**; còn placeholder `[[CẦN XÁC NHẬN: …]]` nên chưa xuất bản được |
| ADR | ADR-050 (đợt 1) + "Bổ sung ADR-050" (Quốc, 2026-10-23: không xoá user — chỉ khoá; nhiều bản PUBLISHED, bản hiệu lực = `effectiveAt ≤ now` mới nhất; xuất bản cần `APPROVED` + hết `[[CẦN XÁC NHẬN`; `phap-ly` vào `RESERVED_SLUGS`). Các ADR cho phần hoãn: Quốc ghi khi bắt đầu giai đoạn pháp lý |
| Migration | Đợt 1 chỉ có migration pháp lý `20261023090000_adr050_legal_documents` (3 bảng L1 + 2 enum + trigger bất biến + quyền append-only) — Hiếu viết, Quốc duyệt, **đã chạy trên DB dùng chung** (2026-10-23, theo báo cáo Quốc) |
| **Code đợt 1 (2026-10-23)** | **CMS/logic cả 3 hạng mục xong + verify** (working tree, chưa commit): (1) CMS menu `/admin/cms/menu`; (2) section trang chủ `steps`/`faq`/`community`, nội dung mặc định, chặn xuất bản, SEO trang chủ + `generateMetadata`; (3) `/admin/cms/phap-ly`, `/phap-ly/[slug]`, ghi chấp thuận khi đăng ký. **UI (Phong) đang làm.** Chưa có bản Điều khoản nào được xuất bản (dự thảo còn placeholder). Test `test:count` 95/95 unit, 57/57 integration; 4 integration test lỗi do dữ liệu dùng chung (Plan FREE `maxProducts=1`, 1 test timeout) — tồn tại, chưa xử lý. KB: `System-Cms-Menu-Home-Seo-Specs`, `Legal-Documents-Specs`, `Legal-Terms-Publishing-Runbook`, bản trích KB ADR-035 (≙ ADR-050) |

---

## 1. Audit hiện trạng

### 1.1. Trang chủ (`/`)

| # | Hiện trạng | Mức |
|---|---|---|
| H1 | `app/page.tsx` đọc `CmsPage` slug `home`; chỉ render khi `status = PUBLISHED`; `blocks` parse phòng thủ bằng `parseHomeSections` (bỏ riêng section hỏng). Section `visible=false` không render. | ✅ |
| H2 | 9 loại section (`packages/core/src/admin/home-sections.ts`): `hero`, `stats`, `search`, `benefits`, `coaches`, `documents`, `becomeSeller`, `testimonials`, `finalCta`. | ✅ |
| H3 | Dữ liệu thật (ADR-033): `stats` (ẩn ô = 0, cả section rỗng → không render), `search` (danh mục `isActive` có ≥1 tài liệu Công khai), `coaches`/`documents` (ghim + tự bù; rỗng → không render). "Công khai" = sản phẩm PUBLISHED + tenant ACTIVE, đọc qua `withPublic` (`apps/web/lib/home.ts`). | ✅ |
| H4 | Nhập tay: `hero` (badge, title, subtitle, 2 CTA, ảnh tuỳ chọn), `benefits` (eyebrow, title, description, 1–4 item), `becomeSeller` (eyebrow, title, highlight, 1–6 bullet, **1** CTA), `testimonials` (1–6 item quote/name/role), `finalCta` (title, subtitle, **1** CTA). | ✅ |
| H5 | Chữ cứng trong JSX (trái nguyên tắc CMS trước): H2 `testimonials` = "Người dùng nói gì về {brandName}" + câu "Những chia sẻ thật từ cộng đồng…"; nút tìm kiếm "Tìm kiếm"; section `coaches`/`documents` **không có** CTA "Khám phá tất cả". | ✅ |
| H5b | **Số liệu/giá minh hoạ cứng** (brief §8 cấm khi chưa xác minh — Phong phát hiện, Long đối chiếu): minh hoạ mặc định của Hero (khi chưa có ảnh) ghi "**500+**" và "**10.000+**"; minh hoạ `becomeSeller` ghi giá "**149.000đ**"; `testimonials` vẽ **5 sao cố định** cho mọi lời nhận xét (`_home-sections.tsx`). | ✅ |
| H5c | Chưa có bản ghi `home` PUBLISHED → trang chủ chỉ còn header + footer (không có nội dung mặc định). | ✅ |
| H6 | H1 duy nhất nằm trong `HeroSection`; nếu admin ẩn hero → trang **không có H1**. Các section khác dùng H2. | ✅ |
| H7 | Editor `/admin/cms/home` (`home-editor/*`): lưu nháp `blocksDraft` / Publish / Khôi phục live; ô chọn ghim tenant/tài liệu. **Không có ô SEO** dù `CmsPage.seoTitle/seoDescription` tồn tại. | ✅ |
| H8 | Trang chủ **không có** `generateMetadata` riêng → dùng của root layout: `title = brand.name`, `description = brand.slogan`, OG image = `SystemBranding.ogImageUrl` nếu có. Không canonical. | ✅ |
| H9 | Nội dung `home` đang có trên production (chữ thật, lời chứng thực có thật hay mẫu?) — Long không đọc DB. | ❓ |
| H10 | So với brief: **thiếu** "Cách bắt đầu" (bước 1–4), "FAQ", "Nhật ký phát triển" (thay thế khi chưa có lời chứng thực); `stats` có trong code nhưng **không** có trong thứ tự brief §5. | ✅ (so code) |
| H11 | Không có cờ "đăng ký đang mở" trong hệ thống (brief yêu cầu CTA người bán chỉ trỏ `/register` khi đăng ký mở). | ✅ (grep không thấy) |

### 1.2. CMS chung (`CmsPage`, `/p/[slug]`)

| # | Hiện trạng | Mức |
|---|---|---|
| C1 | Model `CmsPage` (L1): `id, slug @unique, title, blocks Json, blocksDraft Json?, status DRAFT/PUBLISHED, seoTitle?, seoDescription?, createdAt, updatedAt`. **Không có** version, effectiveAt, publishedAt, lịch sử phiên bản, ogImage, noindex. | ✅ |
| C2 | `SYSTEM_CMS_SLUGS = ["home","shop","pricing"]` (`packages/core/src/admin/cms-slugs.ts`) — form chung không tạo/ghi đè; `/p/[slug]` trả 404 cho các slug này. | ✅ |
| C3 | Form chung `/admin/cms/[slug]` sửa **JSON thô** (`blocksJson`), schema `cmsBlocksSchema` (hero/features/stats/testimonials/pricingTable/faq/richText/cta), lưu **thẳng** `blocks` + `status` (không dùng `blocksDraft`), không ghi audit log. | ✅ |
| C4 | `/p/[slug]`: `richText` render **văn bản thuần** (`whitespace-pre-line`) — không HTML, không mục lục; header **tự dựng** (logo chữ "G", link Đăng nhập), **không** dùng `SiteHeader/SiteFooter`; metadata = `seoTitle ?? title`, `seoDescription`; không canonical. | ✅ |
| C5 | Có sẵn bộ lọc HTML `sanitizeRichTextHtml` (`packages/core/src/content/sanitize-html.ts`) dùng cho mô tả danh mục/sản phẩm/bài viết (Tiptap). | ✅ |
| C6 | Kết luận: `CmsPage` + `/p/[slug]` **không đủ** làm trang pháp lý (thiếu phiên bản, ngày hiệu lực, bản lưu trữ, rich text, chrome hệ thống). | ✅ (suy từ C1–C4) |

### 1.3. Header / footer / menu mobile

| # | Hiện trạng | Mức |
|---|---|---|
| N1 | `app/_ui/site-header.tsx`: nav ngang (≥ lg) **hard-code** "Bảng giá" `/pricing`, "Giáo viên & Coach" (**chữ thường, không link**), "Cửa hàng" `/cua-hang`; khách: "Đăng nhập" + nút "**Mở gian hàng miễn phí**" `/register`; đã đăng nhập: `AccountMenu` (+ link System Center/Studio theo `resolveLandingPath`). | ✅ |
| N2 | `MobileNav` (`app/_ui/mobile-nav.tsx`, client) nhận `items` từ `SiteHeader`: chỉ Cửa hàng, Bảng giá (+ Đăng nhập khi là khách) — lệch với nav ngang (không có "Giáo viên & Coach"). | ✅ |
| N3 | `app/_ui/site-footer.tsx`: 3 cột hard-code — Khám phá (Cửa hàng ✓link, "Giáo viên & Coach" chữ, Bảng giá ✓link), Công ty ("Về {brand}", "Liên hệ", "Tuyển dụng" — **chữ, không link**), Pháp lý ("Điều khoản dịch vụ", "Chính sách bảo mật" — **chữ, không link**). Dòng bản quyền "© **2026** {brand}" năm cứng. | ✅ |
| N4 | Tên/slogan/logo đọc `getEffectiveBrand()` / `getEffectiveLogos()` (DB `SystemBranding`, ADR-032). | ✅ |
| N5 | ADR-025 ghi rõ header/footer là "chrome cố định, **không thuộc CMS**" → hạng mục C cần **ADR mới sửa ADR-025** (Quốc ghi). | ✅ (DECISIONS.md) |
| N6 | Trang dùng `SiteHeader/SiteFooter`: `/`, `/cua-hang` (layout), `/pricing` (layout), storefront, trang tài liệu, bài viết, checkout, preview Studio, `/admin` layout (header). `/p/[slug]` và nhóm `(auth)` không dùng. | ✅ |

### 1.4. Pháp lý / vi phạm hiện có

| # | Hiện trạng | Mức |
|---|---|---|
| L1 | **Đăng ký** (`(auth)/register/register-form.tsx` + `POST /api/auth/register`): checkbox bắt buộc "Tôi đồng ý với điều khoản sử dụng và chính sách xử lý dữ liệu cá nhân." — **không có link** tới trang nào; server chỉ lưu `UserProfile.consentAt` (thời điểm) — **không lưu phiên bản**, không IP/UA. | ✅ |
| L2 | **Mở gian hàng** (`studio/onboarding-form.tsx`, `lib/create-tenant.ts`): **không có** bước chấp thuận điều khoản người bán/cam kết bản quyền. Tenant tạo kèm subscription gói FREE (ADR-021 "Free Forever"). | ✅ |
| L3 | **Xuất bản tài liệu** (ADR-038 mục 7): ô "Tôi sở hữu hoặc có quyền phân phối tài liệu này" bắt buộc **mỗi lần** xuất bản; lưu `Product.rightsConfirmedAt` + `rightsConfirmedById` (lần gần nhất, không FK, không phiên bản văn bản cam kết). Không có link tới trang cam kết. | ✅ |
| L4 | **Báo cáo vi phạm** (ADR-038): bảng `abuse_reports` (L1). `targetType` chỉ `PRODUCT/REVIEW/POST`; `tenantId` **NOT NULL** (bắt buộc gắn tenant); `type` `COPYRIGHT/INAPPROPRIATE/SCAM/OTHER`; `status` `OPEN/RESOLVED/REJECTED`; `decision` `HIDE_CONTENT/ARCHIVE_PRODUCT/LOCK_TENANT/REJECT` (CHECK `abuse_reports_decision_shape`); `evidenceUrls` ≤5 URL (không upload file); `reporterEmail` bắt buộc; `ip` xoá sau 12 tháng. **Không có** mức ưu tiên, mã tiếp nhận, nhật ký từng bước (chỉ audit `REPORT_SUBMITTED`/`REPORT_RESOLVED`), trường khai báo bên khiếu nại bản quyền (tên, căn cứ quyền, tuyên bố thiện chí). | ✅ |
| L5 | `POST /api/reports`: kiểm `Origin`, honeypot `website`, 5 báo cáo/giờ/IP, chặn trùng; trả `{ ok: true, message }` — **không trả mã tiếp nhận**. Nút báo cáo chỉ có ở trang tài liệu (sản phẩm + đánh giá) và trang bài viết (`[tenantSlug]/_ui/report-abuse.tsx`). Không có trang/form báo cáo độc lập (`/bao-cao-vi-pham`). | ✅ |
| L6 | Admin `/admin/reports`: lọc `status` (mặc định OPEN), `type`, `targetType`; chi tiết + xử lý; mọi action `requireRole("SYSTEM_ADMIN")`; email người báo cáo + chủ gian hàng khi xử lý (dùng `supportEmail` nếu có). Tenant không đọc bảng này (ẩn danh người báo cáo). | ✅ |
| L7 | `SystemSettings.supportEmail` (nullable, sửa ở `/admin/settings`) — **chỉ một** email; không có email bản quyền/quyền riêng tư, tên pháp nhân, địa chỉ, MST. | ✅ |
| L8 | Hoàn tiền tài liệu: không tự động; khi vi phạm được xác nhận, khách chọn "tải lần cuối" hoặc "yêu cầu hoàn tiền", tenant tự bấm "Hoàn tiền" (ADR-039). ADR-039 ghi "nền tảng không giữ tiền bán tài liệu (tiền về thẳng tenant)". Cổng tenant: `MANUAL_QR`, `SEPAY`, `MOMO` (enum `PaymentProviderId`). Hoàn tiền **gói** 7 ngày (ADR-041). | ✅ schema/ADR; 🟡 dòng tiền thực tế |
| L9 | Cookie: chỉ tìm thấy 2 cookie phiên `gieochu_access`, `gieochu_refresh` (`apps/web/lib/cookies.ts`); không thấy analytics/tracking (gtag, GTM, Plausible, PostHog, Vercel Analytics). | ✅ (grep) / ❓ hạ tầng ngoài code (CDN, Vercel) |
| L10 | Không có tính năng **xoá tài khoản** do người dùng tự thực hiện. | ✅ (grep) |
| L11 | Bên xử lý dữ liệu có trong code: Neon (Postgres), Cloudflare R2 / MinIO (ADR-044), Cloudinary (ảnh), SMTP cấu hình ở System Center, cổng thanh toán SePay/MoMo, hosting Vercel (thử nghiệm) / VPS (production, ADR-049). Vị trí máy chủ/chuyển dữ liệu ra nước ngoài chưa xác minh. | ✅ có tích hợp / ❓ vùng dữ liệu |

### 1.5. SEO

| # | Hiện trạng | Mức |
|---|---|---|
| S1 | **Không có** `app/sitemap.ts`, `app/robots.ts`, không JSON-LD (`application/ld+json`) ở đâu cả. Root layout không đặt `metadataBase`, không `title.template`. | ✅ |
| S2 | Canonical có ở: `/cua-hang`, `/cua-hang/tai-lieu` (không query; có `q` → `noindex, follow`), `/pricing` (preview → noindex), trang tài liệu `/{tenant}/{product}`. **Không** có ở: `/`, storefront `/{tenant}`, bài viết, `/p/[slug]`. | ✅ |
| S3 | `noindex` có ở: `/account/*`, preview sản phẩm Studio, storefront tenant không ACTIVE, pricing preview, shop search có `q`. `/admin`, `/studio` chưa kiểm hết từng trang (được chặn bằng đăng nhập). | ✅ (grep) |
| S4 | Ô SEO trong CMS: `shop`, `pricing` có (`seoTitle/seoDescription`); `home` **không** có ô (cột có sẵn); form chung có. Danh mục (`DocumentCategory`) có `seoTitle/seoDescription/ogImageUrl` nhưng **không có trang danh mục công khai riêng** dùng chúng (lọc danh mục là query của `/cua-hang/tai-lieu`). | ✅ |
| S5 | Metadata tài liệu: `title = "{product} — {tenant}"`, `description = summary`; storefront: `title = tenant.name`, `description = bio`. Cách ghép tên thương hiệu không thống nhất ("\| brand" ở shop/pricing, "— tenant" ở tài liệu, không ghép ở storefront). | ✅ |
| S6 | Hạng chỉ mục thực tế, Search Console, domain chính thức `gieochu.net` đã trỏ production chưa. | ❓ |

---

## 2. Hạng mục A — Trang chủ tối ưu theo brief

**Nguyên tắc:** không DDL (nội dung nằm trong JSON `CmsPage.blocks` slug `home`); thêm/sửa schema section trong
`packages/core/src/admin/home-sections.ts` theo kiểu **chỉ thêm field tuỳ chọn** + parse phòng thủ (dữ liệu live cũ
không vỡ — ADR-033 mục 6). Nội dung brief **không** tự ghi vào DB: chỉ làm mặc định khi admin *thêm* section mới và
làm "nội dung gợi ý" để admin dán vào editor.

### 2.1. Đối chiếu brief §5 ↔ section hiện có

| Brief §5 | Section hiện có | Cần làm GĐ1 (CMS) |
|---|---|---|
| 1 Hero | `hero` | Thêm `brandMessage?` (trống = đọc `brand.slogan` từ `getEffectiveBrand()` — không lưu slogan lần 2), `imageAlt?`; **bỏ "500+"/"10.000+"** khỏi minh hoạ mặc định (H5b). |
| 2 Tìm kiếm + danh mục | `search` | Thêm `buttonLabel` (thay chữ cứng "Tìm kiếm"), `eyebrow` tuỳ chọn. Chip danh mục giữ dữ liệu thật (đúng yêu cầu "chỉ danh mục có tài liệu"). |
| 3 Vì sao Gieo Chữ | `benefits` | Giữ (đã khớp 4 lợi ích). Nhãn editor đổi "Vì sao chọn chúng tôi" → giữ, admin tự sửa nội dung. |
| 4 Gian hàng nổi bật | `coaches` | Thêm `eyebrow?`, `cta?` {label, href} (mặc định "Khám phá các gian hàng" → ❓ đích: chưa có trang danh sách gian hàng — §8 Q-A3), `minToShow` (mặc định 3 — Q-A7). |
| 5 Tài liệu nổi bật | `documents` | Thêm `eyebrow?`, `cta?` (mặc định "Khám phá tất cả tài liệu" → `/cua-hang/tai-lieu`), `minToShow`, `fallback: "hide" \| "categories"` (thiếu dữ liệu → khối "Khám phá theo danh mục", đúng brief S5). |
| 6 CTA người có kiến thức | `becomeSeller` | Thêm `body: string[]` (0–3 đoạn), `secondaryCta?`; cho `bullets` rỗng (min 0); **bỏ "149.000đ" + sao** khỏi minh hoạ (H5b). |
| 7 Cách bắt đầu | — | **Section mới `steps`** (tên theo Phong): `eyebrow?`, `title`, `items[2–6]` {id, title, description}, `cta?`. |
| 8 Phản hồi / nhật ký phát triển | `testimonials` | **Thay bằng section `community`** (theo Phong) có `mode`: `testimonials` (mỗi mục bắt buộc `consentConfirmed`, **không sao**), `devlog` (ngày + tiêu đề + tóm tắt, ≤6), `invite` (lời mời thử nghiệm + CTA); `eyebrow?`, `title`, `description?` từ CMS (bỏ H2 cứng). Parse phòng thủ: `testimonials` cũ → `community` mode `testimonials`, `consentConfirmed=false` ⇒ **bị ẩn** cho tới khi admin xác nhận; 0 mục đã xác nhận → tự rơi về `invite`. ⚠️ Đây là thay đổi hành vi trên trang live — cần chủ dự án biết (Q-A6). |
| 9 FAQ | — | **Section mới `faq`**: `title`, `items[1–20]` {question, answer văn bản thuần} — cùng giới hạn với FAQ Bảng giá (`PRICING_FAQ_*`). |
| 10 CTA cuối | `finalCta` | Thêm `secondaryCta?`, `showSlogan` (slogan đọc từ brand). |
| 11 Footer | `SiteFooter` | Thuộc hạng mục C (menu CMS). |
| — | `stats` | Không có trong brief §5. Số liệu là thật (ADR-033) nên không vi phạm brief §8, nhưng ở giai đoạn ít dữ liệu nên **ẩn** — chủ dự án chốt (§8 Q-A2). |

Thêm vào editor: **ô SEO** (`seoTitle`, `seoDescription` — giới hạn chốt ở D2) ghi cột `CmsPage` có sẵn,
mặc định đề xuất theo brief §4.1–4.2. Ô `ogImageUrl`/`noindex` thuộc hạng mục D (cần cột mới).

### 2.2. Các bước

| Bước | Việc | Ai | Phụ thuộc | Tiêu chí xong |
|---|---|---|---|---|
| A0 | Chốt §8 nhóm Q-A; Quốc ghi ADR "Trang chủ theo brief nội dung 2026-10" (bổ sung ADR-033). | Quốc + chủ dự án | — | ADR có số trong `docs/DECISIONS.md` |
| A1 | Phong đã đề xuất bố cục (§7) — chốt 3 section mới (`steps`, `faq`, `community`) + CTA cho `coaches/documents` + vị trí slogan; trả contract field cho Quốc. | Phong | A0 | Contract field (tên, giới hạn độ dài) được Quốc chuyển cho Hiếu |
| A2 | GĐ1 CMS: mở rộng `homeSectionSchema` (field tuỳ chọn + 3 type mới), parse phòng thủ, `HOME_SECTION_LABELS`, mặc định `DEFAULT_*` theo brief; editor thêm form 3 section mới + ô SEO; Publish chặn testimonial thiếu `consentConfirmed`. | Hiếu | A1 | lint/typecheck/test xanh, `test:count` không vượt trần; dữ liệu `home` live hiện tại parse không mất section nào (kiểm bằng bản sao JSON, không ghi DB) |
| A3 | GĐ2 UI: render 3 section mới, CTA, slogan, H2 testimonials từ CMS; `generateMetadata` trang chủ đọc `seoTitle/seoDescription` (PUBLISHED, trống → brand như cũ) + canonical `/`; khi hero ẩn → H1 ẩn trực quan (`sr-only`) = `seoTitle ?? brand.name` để luôn có 1 H1. | Phong (JSX) + Hiếu (metadata) | A2 | a11y/responsive/kiểm 1 H1; trạng thái section rỗng ẩn đúng |
| A4 | Chủ dự án/admin nhập nội dung theo brief qua `/admin/cms/home` (nháp → xem → Publish); đối chiếu checklist brief §9 (từng lợi ích khớp tính năng thật). | Chủ dự án | A3 deploy | Checklist §9 tick đủ |
| A5 | Long ghi KB (spec trang chủ, UI-Design-System nếu có token/section mới). | Long | A3 | Trang KB cập nhật |

**Header CTA "Mở gian hàng miễn phí"** (chữ cứng) đụng brief §8 ("miễn phí" cần xác minh) — xử lý trong C (đưa vào menu
CMS). Gói FREE không hết hạn có trong code (ADR-021) ✅, nhưng chữ quảng bá do chủ dự án duyệt (§8 Q-A4).

---

## 3. Hạng mục B — Trang pháp lý

### 3.1. Phương án lưu nội dung

| Phương án | Ưu | Nhược | Đánh giá |
|---|---|---|---|
| B-1 Dùng `CmsPage` + `/p/[slug]` như hiện có | Không DDL | Không phiên bản/ngày hiệu lực/bản lưu trữ (C1); sửa JSON thô (C3); văn bản thuần (C4); không ràng buộc được chấp thuận với một phiên bản cụ thể | **Không đạt** brief §7, §10 |
| B-2 File Markdown/MDX trong repo | Có git history | Trái nguyên tắc chủ dự án "toàn bộ nội dung trong DB" (CMS trước); sửa chữ cần deploy; chủ dự án/luật sư không tự sửa được | Không đề xuất |
| **B-3 Bảng L1 riêng `legal_documents` + `legal_document_versions`, editor ở System Center** | Phiên bản bất biến sau khi phát hành; DRAFT/PUBLISHED/ARCHIVED; `effectiveAt`; chấp thuận trỏ đúng phiên bản; rich text Tiptap + `sanitizeRichTextHtml` có sẵn (C5); đúng "CMS trước" | Cần migration + editor mới | **Đề xuất** |

### 3.2. Mô hình dữ liệu đề xuất (B-3) — chưa duyệt

Tất cả là **L1** (nội dung hệ thống, không `tenantId`, không RLS), đọc/ghi bằng `getPrismaClient()`, ghi chỉ qua Server
Action `requireRole("SYSTEM_ADMIN")` + audit log.

- `LegalDocument`: `id` cuid2, `key` unique (vd `TERMS`, `PRIVACY`, `COPYRIGHT`, `CONTENT`, `SELLER`, `REFUND`,
  `BUYER_LICENSE`, `OPERATING_RULES` — danh sách chốt ở §3.3), `slug` unique, `title`, `sortOrder`, `createdAt`,
  `updatedAt`.
- `LegalDocumentVersion`: `id`, `documentId` FK, `version` (chuỗi "1.0", unique theo document), `status`
  `DRAFT|PUBLISHED|ARCHIVED`, `contentHtml` (đã sanitize khi lưu), `changeSummary`, `effectiveAt`, `publishedAt`,
  `publishedById` (không FK, mẫu `updatedById`), `requiresReacceptance` bool, `legalReviewedAt?` + `legalReviewNote?`
  (đánh dấu đã qua luật sư — chỉ là ghi nhận nội bộ), `createdAt`, `updatedAt`. Bản PUBLISHED **không sửa được**
  (sửa = tạo phiên bản mới); chặn ở server (+ trigger nếu Quốc muốn mức DB như `audit_logs`).
  Bản đang hiệu lực = PUBLISHED, `effectiveAt ≤ now`, mới nhất. Bản PUBLISHED có `effectiveAt` tương lai → trang
  hiện thông báo "Phiên bản mới có hiệu lực từ …" (❓ chủ dự án có muốn không — Q-B9).
- `UserLegalAcceptance`: `id`, `userId` FK, `versionId` FK, `documentKey` (dư thừa để truy vấn nhanh), `context`
  (`REGISTER|OPEN_STORE|PUBLISH_PRODUCT|REACCEPT`), `acceptedAt`, `contextRef?` (vd productId khi xuất bản),
  `ip?`, `userAgent?` (❓ có thu IP/UA làm bằng chứng không — dữ liệu cá nhân, Q-B6). Unique
  `(userId, versionId, context, contextRef)` để idempotent. `onDelete` khi xoá user: ❓ (chưa có xoá tài khoản — Q-B7).
- Thông tin pháp nhân/liên hệ (tên đơn vị, địa chỉ, MST, email bản quyền, email quyền riêng tư, điện thoại): **thêm cột
  nullable vào `SystemSettings`** (đã là mô hình cấu hình hệ thống, ADR-032) thay vì bảng mới — brief §9 "không tạo
  bảng chỉ để lưu placeholder". Trường trống → **ẩn** dòng đó trên trang, không hiện chữ "đang cập nhật" như thông tin.
- **Chặn phát hành nội dung chưa duyệt:** Publish từ chối nếu `contentHtml` còn dấu `[[CẦN XÁC NHẬN: …]]` (quy ước
  placeholder trong bản nháp) hoặc chưa tick "Đã rà soát pháp lý" (Q-B10). Không có seed/script tự phát hành.

### 3.3. Danh sách trang (đề xuất gộp/tách — chờ chốt)

| # | Trang | Slug đề xuất | Gộp/tách | Ghi chú |
|---|---|---|---|---|
| 1 | Điều khoản sử dụng | `dieu-khoan-su-dung` | Riêng | Brief §4.1 |
| 2 | Chính sách bảo mật & quyền riêng tư | `chinh-sach-bao-mat` | **Gộp** cookie (chỉ có cookie phiên — L9) + lưu trữ/xoá dữ liệu | Brief §4.6, §4.7; tách trang cookie nếu sau này thêm analytics |
| 3 | Cam kết bản quyền & nguồn gốc tài liệu | `cam-ket-ban-quyen` | **Gộp** "hướng dẫn báo cáo bản quyền" (phần mô tả) | Brief §4.2 |
| 4 | Chính sách nội dung | `chinh-sach-noi-dung` | Riêng | Brief §4.3 |
| 5 | Chính sách người bán | `chinh-sach-nguoi-ban` | Riêng | Brief §4.5 — phí/hoa hồng/thuế: chỉ mô tả theo gói hiện có, không bịa tỷ lệ |
| 6 | Giao dịch, hoàn tiền & quyền sử dụng tài liệu | `chinh-sach-hoan-tien` | **Gộp** `/quyen-su-dung-tai-lieu` (cùng đối tượng người mua) — hoặc tách (Q-B3) | Phải khớp ADR-039/ADR-041 và "tiền về thẳng tenant" (L8) |
| 7 | Quy trình báo cáo & khiếu nại + form | `bao-cao-vi-pham` | Trang mô tả + form thật (§3.5) | Brief §4.4 |
| 8 | Liên hệ & thông tin pháp lý | `lien-he` | **Gộp** `/lien-he-ho-tro` + `/thong-tin-phap-ly`; dữ liệu từ `SystemSettings` | Chỉ hiện trường đã điền |
| 9 | Quy chế hoạt động | `quy-che-hoat-dong` | ❓ chỉ tạo khi luật sư xác nhận có nghĩa vụ (sàn TMĐT) | Brief §4.7; không tạo trang trống |

**Vị trí URL (Q-B2):** route tĩnh cấp gốc thắng `app/[tenantSlug]` → gian hàng trùng slug sẽ **mất trang** (ADR-030/035
cùng rủi ro). Hai cách:
- (a) Cấp gốc như brief (`/dieu-khoan-su-dung`, …): thêm **mỗi** slug vào `RESERVED_SLUGS`
  (`packages/core/src/tenant/slug.ts`) và quét slug tenant trùng trên DB production (❓). ~9 từ dành riêng.
- (b) **Một tiền tố** `/phap-ly/{slug}` (+ trang hub `/phap-ly`, theo Phong) + `/bao-cao-vi-pham` + `/lien-he`: chỉ 3 từ dành riêng. Long và Phong cùng nghiêng (b) vì
  ít rủi ro đụng slug và dễ thêm trang mới không cần dành riêng thêm.
Cả hai: `RESERVED_SLUGS` đã có sẵn `terms`, `privacy`, `help`, `support` ✅ (chưa có route nào dùng).

### 3.4. Điểm chấp thuận

| Điểm | Hiện có | Đề xuất | Mức |
|---|---|---|---|
| Đăng ký | Checkbox không link, lưu `consentAt` | Checkbox có link Điều khoản + Bảo mật (mở tab mới); server ghi 2 dòng `UserLegalAcceptance` (TERMS, PRIVACY — phiên bản đang hiệu lực) trong cùng transaction tạo user; vẫn ghi `consentAt` (tương thích). Chưa có phiên bản nào PUBLISHED → ❓ chặn đăng ký hay giữ hành vi cũ (Q-B5). | ✅ hiện trạng |
| Mở gian hàng | Không có | Checkbox "Tôi đồng ý Chính sách người bán và Cam kết bản quyền" bắt buộc ở onboarding; ghi SELLER + COPYRIGHT. Tenant đã có: xem "chấp thuận lại". | ✅ hiện trạng |
| Xuất bản tài liệu | Ô cam kết bắt buộc mỗi lần, `rightsConfirmedAt` | Giữ ô + thêm link `cam-ket-ban-quyen`; ghi `UserLegalAcceptance` context `PUBLISH_PRODUCT`, `contextRef = productId` (hoặc chỉ giữ `rightsConfirmedAt` — Q-B8). | ✅ hiện trạng |
| Thay đổi trọng yếu | Không có | Phiên bản `requiresReacceptance` có hiệu lực → người dùng đăng nhập chưa chấp thuận bản đó thấy màn chấp thuận (chặn thao tác ghi ở Studio cho người bán; người mua: chặn checkout?) — Q-B4. Người dùng cũ chỉ có `consentAt`: Q-B4. | — |

Nút "Tôi đồng ý" **chỉ** xuất hiện khi bấm thật sự ghi bản ghi (brief §6).

### 3.5. Mở rộng báo cáo vi phạm (tái dùng `abuse_reports`, không xây hệ thứ hai)

| Nhu cầu brief §4.4/§8 | Có sẵn | Đề xuất (expand-only) | Cần ai quyết |
|---|---|---|---|
| Báo cáo không gắn nút (form `/bao-cao-vi-pham`, dán URL) | Chỉ nút trên sản phẩm/đánh giá/bài viết | Form độc lập: người dùng dán URL → server phân giải `/{tenant}/{product}` hoặc `/{tenant}/posts/{id}` sang `targetType/targetId` (giữ kiểm "đối tượng công khai" hiện có) | Quốc |
| Báo cáo gian hàng | Không | Thêm `AbuseTargetType.TENANT` | Quốc |
| Báo cáo không có đối tượng cụ thể (vd quyền riêng tư chung) | Không (`tenantId` NOT NULL) | `tenantId` → nullable + `targetType` `NONE`/`URL` + `targetUrl?`; quyết định chỉ còn `REJECT`/"đã xử lý ngoài hệ thống" cho loại này | Quốc + chủ dự án |
| Báo cáo giao dịch (mã đơn) | Không | Chỉ lưu **mã đơn dạng văn bản** người báo cáo nhập; admin **không** mở dữ liệu đơn (§7.9 — admin không đọc đơn tenant) → chuyển tenant/hướng dẫn liên hệ. | **Chủ dự án** (đụng §7.9 + tiền) |
| 7 loại báo cáo | 4 loại | Thêm `FAKE_ORIGIN`, `ILLEGAL_CONTENT`, `PRIVACY`, `NOT_AS_DESCRIBED`; `SCAM` = "Gian lận, lừa đảo"; giữ `INAPPROPRIATE`. Cần rà mọi `switch` đủ nhánh trước khi thêm giá trị enum (code cũ đang chạy). | Quốc |
| Khiếu nại bản quyền: tên, tư cách (chủ sở hữu/đại diện), căn cứ quyền, tuyên bố thiện chí | Không | Cột nullable `claimantName`, `claimantRole`, `rightsBasis`, `truthfulnessConfirmedAt` (ô xác nhận trung thực — áp mọi loại) | Quốc |
| Mã tiếp nhận | Không | Cột `referenceCode` unique (vd `BC-` + 8 ký tự), trả trong response 201 + email xác nhận | Quốc |
| Mức ưu tiên, lọc theo ưu tiên | Không | Cột `priority` (LOW/NORMAL/HIGH) admin đặt; lọc ở `/admin/reports` | Quốc |
| Trạng thái `UNDER_REVIEW`, `NEED_MORE_INFO`, `APPEAL_REVIEW` | `OPEN/RESOLVED/REJECTED` | Thêm trạng thái trung gian là **đổi luật nghiệp vụ** (CHECK `abuse_reports_decision_shape`, email, đếm badge sidebar) | **Chủ dự án** |
| Nhật ký thay đổi + người thao tác | Audit `REPORT_SUBMITTED/RESOLVED` | **Dùng lại `audit_logs`** (append-only sẵn, ADR-037): thêm action `REPORT_STATUS_CHANGED`, `REPORT_NOTE_ADDED`; trang chi tiết đọc audit theo `targetId` — không tạo bảng `report_activity` | Quốc |
| Kháng nghị của bên bị báo cáo | Tenant không thấy báo cáo (ẩn danh, ADR-038) | GĐ sau; trước mắt nội dung chính sách chỉ ghi kênh liên hệ nếu chủ dự án duyệt | **Chủ dự án** |
| Upload bằng chứng | Chỉ URL | Giữ URL (tránh lưu file cá nhân); nếu muốn upload → bucket private + quét file (M5) — GĐ sau | Chủ dự án |
| SLA phản hồi | Không | **Không** đặt số ngày nào cho tới khi chủ dự án duyệt (brief §4.4) | Chủ dự án |

### 3.6. Các bước

| Bước | Việc | Ai | Phụ thuộc | Tiêu chí xong |
|---|---|---|---|---|
| B0 | Chủ dự án trả lời nhóm Q-B + `docs/legal/LEGAL_REVIEW_CHECKLIST.md` mục ưu tiên cao; Quốc ghi ADR "Trang pháp lý có phiên bản + chấp thuận" và ADR "Mở rộng báo cáo vi phạm" (bổ sung ADR-038). | Quốc + chủ dự án | — | ADR có số |
| B1 | Soạn **bản nháp** nội dung tiếng Việt cho trang đã chốt, đánh dấu `[[CẦN XÁC NHẬN: …]]` mọi chỗ thiếu dữ kiện; trạng thái "DỰ THẢO — chưa được luật sư rà soát". Lưu `docs/legal/drafts/` để duyệt (không phải nguồn hiển thị). | Long (brief riêng) | B0 | Mỗi trang đủ mục tối thiểu brief §4.x; không bịa thông tin pháp nhân/SLA/tỷ lệ |
| B2 | Migration expand: 3 bảng legal + cột `SystemSettings` (§6.1 M-L). | Hiếu soạn, Quốc duyệt, chủ dự án chạy | B0 | `prisma migrate` áp xong; app cũ vẫn chạy |
| B3 | GĐ1 CMS: `/admin/legal` (danh sách tài liệu, phiên bản, soạn Tiptap, xem trước, Publish có cổng chặn placeholder, lưu trữ); `/admin/settings` thêm thông tin pháp lý; audit mọi thao tác. | Hiếu (+ Phong bố cục editor) | B2 | Không publish được bản còn `[[CẦN XÁC NHẬN` |
| B4 | GĐ2 UI công khai: layout trang pháp lý (SiteHeader/Footer, `container-prose`, mục lục từ H2, ngày hiệu lực + phiên bản + ngày cập nhật, liên kết chéo), `/lien-he`, 404 khi chưa có bản PUBLISHED. | Phong (UI) + Hiếu (loader) | B3 | a11y, responsive, metadata + canonical |
| B5 | Điểm chấp thuận (§3.4) + màn chấp thuận lại. | Hiếu (logic) + Phong (UI) | B3, Q-B4/B5 | Đăng ký không gãy; chấp thuận ghi đúng phiên bản (kiểm dữ liệu thật trên dev server, dọn dữ liệu tạm) |
| B6 | Báo cáo vi phạm mở rộng (§3.5): migration M-R, form `/bao-cao-vi-pham`, mã tiếp nhận, admin lọc/ưu tiên/nhật ký. | Hiếu + Phong | B0, B2 có thể song song | Luồng ADR-038/039 cũ không đổi hành vi |
| B7 | Chủ dự án/luật sư duyệt → admin nhập & Publish từng trang; gắn link footer (C). | Chủ dự án | B4 | Checklist pháp lý mục "trước công bố" xong |
| B8 | `docs/legal/IMPLEMENTATION_SUMMARY.md` (brief §12 DoD) + KB (spec pháp lý, endpoint, schema). | Long | B6 | — |

---

## 4. Hạng mục C — CMS Menu header/footer (System Center)

### 4.1. Mô hình dữ liệu đề xuất

**Không DDL:** thêm slug hệ thống `menu` (tên theo Phong) vào `SYSTEM_CMS_SLUGS` (cùng mẫu `shop`/`pricing`), lưu JSON trong
`CmsPage.blocks` / `blocksDraft` (nháp → Publish → Khôi phục live như trang chủ), schema zod mới
`siteNavSchema` trong `packages/core/src/admin/`:

```
header: { items: NavItem[≤5] (NavItem = NavLink + children? ≤8, chỉ khi Q-C1 duyệt), cta: { label, href, audience: "guest" } | null, showLogin: bool }
footer: { columns: { title, links: NavLink[≤8] }[≤4], bottomText?: string }   // "© {năm hiện tại} {brand}" tự sinh
NavLink: { id, label ≤40, visible, target: { kind: "internal", path } | { kind: "external", url https } | { kind: "legal", key } | { kind: "system", key: "shop"|"pricing"|... } }
```

- `legal` trỏ theo `key` → tự lấy slug và **tự ẩn** khi tài liệu chưa có bản PUBLISHED (footer không bao giờ có link
  chết tới trang pháp lý chưa duyệt).
- `internal` phải bắt đầu `/`, không `//`; `external` chỉ `https://`, render `rel="noopener noreferrer"`.
- Một cấp (Q-C1). Mobile dùng **đúng** `header.items` (bỏ lệch N2). Link "Đăng nhập" / AccountMenu giữ trong code
  (phụ thuộc phiên đăng nhập — không đưa vào CMS).
- **Mặc định khi chưa có dòng CMS / JSON hỏng** = menu hiện tại nhưng chỉ các mục có trang thật: header Bảng giá, Cửa
  hàng, CTA "Mở gian hàng miễn phí" → `/register`; footer Khám phá (Cửa hàng, Bảng giá), Pháp lý (Điều khoản, Bảo mật —
  kiểu `legal`, tự ẩn khi chưa phát hành). Các chữ không link hiện nay ("Giáo viên & Coach", "Về …", "Liên hệ",
  "Tuyển dụng") **không** vào mặc định (Q-C2).
- Đọc bằng loader có `cache()` theo request trong `SiteHeader/SiteFooter`; parse phòng thủ (mục hỏng bị bỏ riêng).

### 4.2. Các bước

| Bước | Việc | Ai | Phụ thuộc | Tiêu chí xong |
|---|---|---|---|---|
| C0 | Chủ dự án chốt Q-C; Quốc ghi ADR "Menu header/footer quản lý bằng CMS" (sửa ADR-025 mục "chrome cố định, không thuộc CMS"). | Quốc + chủ dự án | — | ADR có số |
| C1 | Phong chốt bố cục editor menu (kéo-thả `sortable-list-editor` có sẵn ở `admin/cms/_ui`) + giới hạn số mục theo bố cục header/footer hiện tại. | Phong | C0 | Contract giới hạn |
| C2 | GĐ1: schema `siteNavSchema` + mặc định + parse phòng thủ; editor `/admin/cms/menu` (nháp/Publish/Khôi phục, audit), mục sidebar "Menu & Footer". | Hiếu | C1 | Không lưu được link `javascript:`/`//`; audit ghi |
| C3 | GĐ2: `SiteHeader`, `MobileNav`, `SiteFooter` đọc CMS; năm bản quyền tự sinh; `/p/[slug]` chuyển sang `SiteHeader/SiteFooter` (ADR-025 "khi có task chạm tới"). | Hiếu + Phong | C2 | Không có dòng CMS → header/footer y như hiện tại (trừ mục chữ không link) |
| C4 | KB: spec menu, UI-Design-System. | Long | C3 | — |

---

## 5. Hạng mục D — SEO tuỳ chọn cho mọi trang

**Nguyên tắc (brief trang chủ §4.5):** chỉ đánh dấu dữ liệu **đang hiển thị** cho người dùng; không dữ liệu giả.

| Bước | Việc | Ai | Phụ thuộc | Tiêu chí xong |
|---|---|---|---|---|
| D1 | Helper `buildPageMetadata()` (`apps/web/lib/seo.ts`): `metadataBase = APP_URL`, `title.template = "%s \| {brand}"` ở root layout, canonical tuyệt đối, OG/Twitter từ ô SEO → fallback ảnh trang → `SystemBranding.ogImageUrl`. Chuẩn hoá cách ghép tên (S5). Không DDL. | Hiếu | — | Mọi trang public có title/description/canonical; trang riêng tư có noindex |
| D2 | Chuẩn ô SEO dùng chung `{ seoTitle, seoDescription, ogImageUrl?, noindex } (giới hạn: xem §7.2 — code đang có hai bộ khác nhau)` cho CMS `home`, `shop`, `pricing`, `/p/*`, menu không cần, trang pháp lý (trên `LegalDocument`). Cần cột mới `cms_pages.ogImageUrl`, `cms_pages.noindex` (M-S). Component editor `SeoFields` dùng chung (có xem trước đoạn trích Google). | Hiếu + Phong | M-S | Admin đặt noindex được; trang noindex bị loại khỏi sitemap |
| D3 | `app/sitemap.ts` (động, DB): `/`, `/cua-hang`, `/cua-hang/tai-lieu`, `/pricing`, `/p/*` PUBLISHED không noindex, trang pháp lý đang hiệu lực, storefront tenant ACTIVE, tài liệu Công khai (`withPublic`, quy ước ADR-033), bài viết công khai (❓ Q-D2). Loại `/admin`, `/studio`, `/account`, checkout, `/s/*` (share link), `/_s/*`, kết quả tìm có `q`. | Hiếu | D1 | Sitemap hợp lệ; không lộ trang riêng tư |
| D4 | `app/robots.ts`: Disallow `/admin`, `/studio`, `/account`, `/api`, `/s/`, `/_s/`, `/*/checkout`; khai báo sitemap. Môi trường không phải production (Vercel thử nghiệm, ADR-049) → `Disallow: /` (❓ cách nhận biết: so host request với `APP_URL` production — Q-D3). | Hiếu | D1 | Preview không bị lập chỉ mục |
| D5 | JSON-LD: `Organization` + `WebSite` (kèm `SearchAction` tới `/cua-hang/tai-lieu?q=` — tìm kiếm có thật ✅) ở trang chủ; `BreadcrumbList` ở trang tài liệu + storefront + trang pháp lý; `Product` ở trang tài liệu: name, image, description (summary), `offers` (giá hiệu lực VND, URL), `aggregateRating` **chỉ khi** `ratingCount > 0` và đang hiển thị. Gắn nonce CSP (ADR-016) cho thẻ script. `sameAs` chỉ khi chủ dự án cung cấp link mạng xã hội. | Hiếu | D1 | Rich Results Test không lỗi (❓ cần URL production) |
| D6 | SEO riêng cho tài liệu/gian hàng do tenant tự đặt (cột L2 mới) — **ngoài phạm vi đợt này**, chỉ dùng mặc định tự sinh (Q-D1). | — | — | — |
| D7 | Đăng ký Google Search Console, gửi sitemap. | Chủ dự án | D3 deploy production | ❓ |

---

## 6. Migration, ngân sách test, rủi ro, thứ tự

### 6.1. Migration cần (tất cả expand-only — Quốc duyệt, **chủ dự án chạy**; ADR-034 một DB dùng chung)

| Mã | Nội dung | Hạng mục | Ghi chú an toàn |
|---|---|---|---|
| M-L | Tạo `legal_documents`, `legal_document_versions`, `user_legal_acceptances`; thêm cột nullable thông tin pháp lý vào `system_settings`; GRANT cho `gieochu_app` | B | Chỉ thêm — bản đang chạy không đọc |
| M-R | `abuse_reports`: thêm giá trị enum `AbuseTargetType`/`AbuseReportType` (+ `AbuseReportStatus` nếu Q-B11 duyệt), `tenantId DROP NOT NULL`, cột nullable `targetUrl`, `referenceCode` (unique, nullable cho dòng cũ), `priority`, `claimantName`, `claimantRole`, `rightsBasis`, `truthfulnessConfirmedAt` | B | Thêm giá trị enum: code đang chạy gặp giá trị lạ có thể lỗi ở `switch` — deploy code mới **trước** khi có dòng dùng giá trị mới; `DROP NOT NULL` chỉ nới ràng buộc |
| M-S | `cms_pages`: `ogImageUrl TEXT NULL`, `noindex BOOLEAN NOT NULL DEFAULT false` | D | Chỉ thêm |
| — | Trang chủ (A), menu (C) | A, C | **Không DDL** (JSON trong `cms_pages`) |

### 6.2. Ngân sách test

`pnpm test:count` ngày 2026-10-23: **94 / 94 unit, 55 / 55 integration** — đã chạm trần (trần gốc 91/50 mục 9; nâng
theo ADR-026 + ADR-037). ✅ (chạy `scripts/count-tests.mjs`).
Không thêm test nếu chủ dự án không duyệt nâng trần. Đề xuất **xin nâng tối thiểu** (Q-T1):
- +1 unit: cổng chặn Publish trang pháp lý còn `[[CẦN XÁC NHẬN` / chặn link menu không an toàn.
- +1 integration: đăng ký ghi `UserLegalAcceptance` đúng phiên bản đang hiệu lực (dữ liệu tạm, dọn sau).
- +1 integration: form `/bao-cao-vi-pham` tạo báo cáo có `referenceCode`, tenant không đọc được.
Nếu không duyệt: ghi nợ test vào `docs/BACKLOG.md` như ADR-038/039.

### 6.3. ADR dự kiến (Quốc ghi, đánh số khi chốt)

1. Trang chủ theo brief nội dung (bổ sung ADR-033).
2. Trang pháp lý có phiên bản + chấp thuận lưu phiên bản (mới).
3. Mở rộng báo cáo vi phạm (bổ sung ADR-038).
4. Menu header/footer bằng CMS (sửa ADR-025) — có thể gộp với SEO (D) thành một ADR "chrome + SEO".

### 6.4. Rủi ro

| Rủi ro | Mức | Giảm thiểu |
|---|---|---|
| Phát hành nội dung pháp lý chưa được luật sư duyệt / chứa placeholder | Cao | Cổng chặn Publish (§3.2), checklist, không seed |
| Route pháp lý cấp gốc nuốt gian hàng trùng slug | Trung bình | Phương án (b) tiền tố; nếu (a) → quét slug trên DB production trước (❓) |
| Thêm enum `abuse_reports` khi bản cũ đang chạy trên cùng DB (ADR-034) | Trung bình | Deploy code trước, dữ liệu sau; rà `switch` |
| Chấp thuận lại làm gián đoạn người dùng/người bán hiện có | Trung bình | Chủ dự án chốt Q-B4; có thời gian ân hạn |
| Báo cáo "giao dịch" kéo admin vào dữ liệu đơn của tenant (§7.9) | Cao | Chỉ lưu mã đơn văn bản; không loader đọc `orders` từ admin |
| Ẩn hero → mất H1 | Thấp | H1 `sr-only` dự phòng (A3) |
| JSON-LD lệch dữ liệu hiển thị (giá khuyến mãi hết hạn, đánh giá ẩn) | Thấp | Dùng cùng loader với UI, không truy vấn riêng |
| Sitemap lộ trang preview/nháp | Trung bình | Chỉ `withPublic` + PUBLISHED + không noindex |

### 6.5. Thứ tự ưu tiên đề xuất

| Thứ tự | Việc | Lý do |
|---|---|---|
| 1 | **B0 + B1** (chốt câu hỏi, soạn dự thảo pháp lý) chạy song song với **C** (menu CMS, không DDL) | Nội dung pháp lý cần thời gian luật sư lâu nhất; menu mở đường cho footer có link thật |
| 2 | **A** (trang chủ GĐ1 → GĐ2, không DDL) + **D1, D3, D4** (metadata, sitemap, robots — không DDL) | Giá trị SEO/chuyển đổi nhanh, rủi ro thấp |
| 3 | **B2–B5** (migration M-L, editor pháp lý, trang công khai, chấp thuận) | Phụ thuộc ADR + dự thảo |
| 4 | **B6** (báo cáo vi phạm mở rộng, M-R) | Đụng luật nghiệp vụ ADR-038 — cần chủ dự án chốt nhiều điểm |
| 5 | **D2, D5** (ô SEO đầy đủ M-S, JSON-LD) | Hoàn thiện sau khi trang đã ổn định |

---

## 7. Gộp đề xuất UX của Phong

Nguồn: `docs/de-xuat-ux-home-legal-menu-2026-10-23.md` (Phong, 23/10/2026, **đề xuất, chưa code**). Bố cục chi tiết
(wireframe, trạng thái, a11y) **đọc thẳng trong file của Phong** — ở đây chỉ ghi phần ảnh hưởng tới kế hoạch. Các phát
hiện hiện trạng của Phong (§0 bên đó) Long đã đối chiếu code và đưa vào §1 (H5b, H5c); phần còn lại khớp với §1.

### 7.1. Điểm đã nhận vào kế hoạch

| Hạng mục | Nội dung nhận từ Phong | Ảnh hưởng |
|---|---|---|
| A | Thứ tự mặc định theo brief §5; mỗi `type` tối đa 1 lần (giữ 1 H1, H2 không trùng); `stats` mặc định ẩn | A2 |
| A | `DEFAULT_HOME_SECTIONS` trong `@gieochu/core` từ chữ brief §6 (không số liệu/chứng thực/giá), token `{brand}` thay "Gieo Chữ" (CLAUDE.md cấm hard-code thương hiệu); trang chủ chưa PUBLISHED → render mặc định thay vì trang trắng (H5c) | A2, A3 — đổi hành vi trang chủ khi DB trống |
| A | Section `steps`, `faq` (`<details>`, câu hỏi là H3, tái dùng mẫu FAQ Bảng giá), `community` (3 chế độ) | §2.1 đã sửa theo |
| A | Tiêu đề lợi ích thành **H3**; skip-link + `<main id="noi-dung">` (đã có trong BACKLOG) | A3 |
| A | Cảnh báo nội dung brief §8 trong editor: **mềm** (quét chữ "miễn phí", "500+", "thu nhập"… — không chặn) + **cứng** khi Xuất bản (testimonial chưa `consentConfirmed`; CTA `href` phải `/…` hoặc `https://`, chặn `javascript:`, `http://`, `localhost`, `*.vercel.app`); mẫu regex dùng chung client/server | A2 — luật cứng là logic server (Hiếu) |
| A | Xem trước bản nháp `/?xem-truoc=nhap` (SYSTEM_ADMIN, noindex) như Bảng giá; editor hiện "Đang ẩn: 2/3 gian hàng đủ điều kiện" (action đọc-only số đếm) | A2, A3 |
| B | Hub `/phap-ly` + trang con `/phap-ly/{slug}`, `/bao-cao-vi-pham`, `/lien-he`; redirect 308 `/terms`, `/privacy` (2 slug đã dành riêng) | §3.3 phương án (b) |
| B | Layout văn bản: breadcrumb, TOC sticky (desktop) / `<details>` (mobile) dựng từ H2 server gắn `id`, dòng meta phiên bản + ngày hiệu lực + ngày cập nhật, "Văn bản liên quan" chọn tay, lịch sử phiên bản, in ẩn chrome | B4 |
| B | Editor Tiptap chỉ H2/H3 cho văn bản pháp lý | B3 |
| B | Form `/bao-cao-vi-pham`: 7 loại dạng thẻ, ô URL do server phân giải, trường bản quyền hiện khi chọn loại, 2 checkbox tuyên bố riêng cho bản quyền, xác nhận trung thực, khối thành công có **mã tiếp nhận** + nút sao chép; hộp thoại báo cáo cũ giữ, thêm link "mở biểu mẫu đầy đủ"; nút "Báo cáo gian hàng" ở storefront | B6 |
| B | Chấp thuận: link mở tab mới ở đăng ký; checkbox ở onboarding gian hàng; link cam kết ở ô xuất bản; checkout **chỉ dòng thông báo**, không checkbox giả (Q-B18); chấp thuận lại = **trang chặn mềm** `/account/dieu-khoan-moi` có lối "Đăng xuất" (không modal) | B5 |
| C | Editor `/admin/cms/menu` ("Menu & chân trang") cùng luồng Lưu nháp/Xem trước/Xuất bản/Khôi phục; tối đa 5 mục cấp 1; footer 1–4 cột × 1–8 link; mô tả dưới logo ≤160; dòng bản quyền có token `{năm}`, `{brand}`; loại link `page` (khoá trang có sẵn — đổi slug không vỡ link), `internal`, `external`, `email` (mặc định `supportEmail`); "tab mới" tự thêm `rel`; xem trước Desktop/Mobile; trang hiện tại so `pathname` thay prop `current` | §4.1 — tên slug theo Phong là `menu` |
| C | Mặc định CTA header đề xuất đổi thành "Mở gian hàng" (bỏ "miễn phí") — chờ Q-A4 | C2 |
| D | Khối "SEO & chia sẻ" dùng chung `admin/cms/_ui/seo-fields.tsx`, thu gọn mặc định; canonical **chỉ đọc**; xem trước kết quả Google + thẻ chia sẻ; JSON-LD tự động (không ô nhập JSON); **không** thêm `FAQPage` | D2, D5 |

### 7.2. Chỗ lệch giữa đề xuất của Phong và kế hoạch Long — Quốc chốt

| # | Chủ đề | Phong | Long | Đề xuất của Long |
|---|---|---|---|---|
| L-1 | Nhật ký xử lý báo cáo | Bảng mới `ReportActivity` | Dùng lại `audit_logs` (append-only sẵn, ADR-037) | Giữ `audit_logs` — brief pháp lý cấm xây hệ thứ hai song song; Quốc quyết |
| L-2 | Số phiên bản văn bản | `version` số nguyên tăng dần, hiển thị "1.0/1.1" | Chuỗi "1.0" | Số nguyên (dễ sắp xếp, unique) + nhãn hiển thị; chờ Q-B19 |
| L-3 | Trạng thái rà soát | `reviewStatus` `PENDING_LEGAL_REVIEW\|APPROVED`; có thể công bố dự thảo kèm banner (Phong Q10) | `legalReviewedAt` + cổng chặn Publish khi còn `[[CẦN XÁC NHẬN` | Gộp: `reviewStatus` của Phong **và** cổng chặn placeholder luôn bật (kể cả bản dự thảo được công bố); việc công bố dự thảo chờ Q-B20 |
| L-4 | Phiên bản cũ | Xem công khai `/phap-ly/{slug}/phien-ban/{n}` (noindex) | Không nêu | Chờ Q-B19 |
| L-5 | Gộp trang | Tách "Quyền sử dụng tài liệu" thành trang riêng; gộp xoá tài khoản vào Điều khoản | Gộp quyền sử dụng vào hoàn tiền; xoá tài khoản vào Bảo mật | Theo Phong (đối tượng người mua đọc từ trang tài liệu/checkout) — chờ Q-B3 |
| L-6 | Danh sách `key` văn bản | Có `report-process` là văn bản pháp lý | `report-process` là trang mô tả + form | Theo Phong (nội dung quy trình cũng cần phiên bản/CMS) |
| L-7 | Thông tin pháp nhân | `SystemSettings` hoặc bảng `SystemLegalInfo` 1 dòng; thêm `reportResponseTimeText?` | Cột `SystemSettings` | `SystemSettings` (brief: không tạo bảng chỉ để lưu placeholder); `reportResponseTimeText` chỉ khi Q-B15 duyệt |
| L-8 | Menu con | Cho phép 1 cấp, mặc định không dùng | Chỉ 1 cấp phẳng | Chờ Q-C1; schema để sẵn `children?` |
| L-9 | Giới hạn ô SEO | Khuyến nghị ≤60/≤160, tối đa 120/320 (theo `PRICING_SEO_*`) | ≤70/≤160 (theo form danh mục) | Code hiện **có hai bộ giới hạn khác nhau**: danh mục `max(70)`/`max(160)` (`admin/categories/actions.ts`), Bảng giá `PRICING_SEO_TITLE_MAX = 120`, `PRICING_SEO_DESCRIPTION_MAX = 320` (`packages/core/src/admin/pricing-sections.ts`) ✅. Đề xuất một hằng dùng chung theo Phong (tối đa 120/320, cảnh báo mềm từ 60/160) |
| L-10 | Độ rộng trang văn bản có TOC | Utility mới `container-doc` (240px + 768px) — sửa ADR-024 | Không nêu | Chờ Q-B21; Quốc ghi bổ sung ADR-024 nếu duyệt |
| L-11 | Loại báo cáo mới | `ORIGIN_UNCLEAR`, `ILLEGAL`, `PRIVACY`, `DEFECTIVE`; có thể gộp `INAPPROPRIATE` vào `ILLEGAL` | `FAKE_ORIGIN`, `ILLEGAL_CONTENT`, `PRIVACY`, `NOT_AS_DESCRIBED`; giữ `INAPPROPRIATE` | Tên enum Hiếu đặt theo Phong; **không** xoá/gộp giá trị enum cũ (expand-only — dòng cũ vẫn dùng) |
| L-12 | Trường bản quyền | Json hoặc bảng con (`claimant`, `originalWork`, `infringingPart`, `goodFaithAt`, `accuracyAt`) | Cột nullable | Hiếu chọn khi thiết kế; Long nghiêng một cột `copyrightClaim Json?` validate bằng zod (ít DDL) |
| L-13 | Tra cứu trạng thái báo cáo bằng mã | Tuỳ chọn `/bao-cao-vi-pham/tra-cuu` | Không nêu | Chờ Q-B15 |
| L-14 | SEO theo luồng nháp | Hỏi (Phong Q18) | Không nêu | Chờ Q-D4 |

**Quốc chốt (2026-10-23, phần kỹ thuật — không cần chủ dự án):** L-1 dùng `audit_logs`; L-2 `version Int` + nhãn
hiển thị; L-3 `reviewStatus` + cổng chặn placeholder luôn bật; L-6 theo Phong; L-7 cột nullable `SystemSettings`;
L-8 schema để sẵn `children?` tối đa 1 cấp, UI bật theo Q-C1; L-9 một hằng dùng chung trong `@gieochu/core` (tối đa
120/320, cảnh báo mềm 60/160); L-11 tên theo Phong, không xoá/gộp enum cũ; L-12 `copyrightClaim Json?` + zod.
Còn chờ chủ dự án: L-4/L-13 (Q-B19, Q-B15), L-5 (Q-B3), L-10 (Q-B21), L-14 (Q-D4).

### 7.3. Contract dữ liệu

Bảng contract của Phong (§5.A–§5.E bên file đó) là **đầu vào** cho Hiếu sau khi Quốc chốt §7.2 — Long không chép lại để
tránh hai bản lệch nhau. Khi Quốc chốt, Long ghi spec chính thức vào KB (`02-System-Specs/`, `03-API-Contracts/`).

---

## 8. Câu hỏi mở cho chủ dự án (đánh số)

### Trang chủ (A)

1. **Q-A1** Nội dung brief trang chủ có được dùng nguyên văn làm mặc định/gợi ý trong editor không, hay chỉ tham khảo?
2. **Q-A2** Section "Số liệu nổi bật" (số thật, ADR-033) giữ, ẩn, hay bỏ khỏi thứ tự mặc định khi dữ liệu còn ít?
3. **Q-A3** CTA "Khám phá các gian hàng" trỏ đâu? Hiện **chưa có** trang danh sách gian hàng (header/footer có chữ
   "Giáo viên & Coach" không link). Tạm trỏ `/cua-hang` hay làm trang danh sách gian hàng (hạng mục mới)?
4. **Q-A4** Chữ "Mở gian hàng **miễn phí**" (header) và các tuyên bố "miễn phí" có được giữ không (brief §8)?
5. **Q-A5** Đăng ký hiện luôn mở (không có công tắc). Có cần công tắc "Đăng ký đang mở" để CTA người bán tự đổi đích
   (vd trang "Đăng ký nhận tin") không?
6. **Q-A6** Lời chứng thực đang có trên production là thật và có đồng ý chưa? Theo đề xuất `community`, lời chứng thực
   cũ sẽ **tự ẩn** cho tới khi admin tích xác nhận đồng ý — chấp nhận không? Giai đoạn này dùng "nhật ký phát triển" hay
   "lời mời thử nghiệm"?
   - **Q-A7** Ngưỡng tối thiểu để hiện "Gian hàng nổi bật"/"Tài liệu nổi bật": 3 có hợp lý không?
   - **Q-A8** Lời mời thử nghiệm dẫn tới đâu: trang Liên hệ, email hỗ trợ, hay form riêng (chưa có)?

### Pháp lý (B) — xem thêm `docs/legal/LEGAL_REVIEW_CHECKLIST.md`

7. **Q-B1** Tên pháp nhân/đơn vị vận hành, địa chỉ, MST, người đại diện, điện thoại; email hỗ trợ / bản quyền / quyền
   riêng tư (một hay nhiều địa chỉ)?
8. **Q-B2** URL trang pháp lý: cấp gốc như brief, hay tiền tố `/phap-ly/…` + hub (Long và Phong cùng nghiêng tiền tố)?
9. **Q-B3** Danh sách trang gộp/tách ở §3.3 có đồng ý không (đặc biệt: gộp cookie vào bảo mật; gộp quyền sử dụng tài liệu
   vào hoàn tiền; gộp liên hệ + thông tin pháp lý)? Có cần "Quy chế hoạt động" (sàn TMĐT) không?
10. **Q-B4** Người dùng/người bán **đã có** (chỉ có `consentAt`, không phiên bản): yêu cầu chấp thuận lại phiên bản đầu
    tiên khi đăng nhập lần tới, hay coi như đã chấp thuận? Có thời gian ân hạn không? Người mua có bị chặn checkout
    khi chưa chấp thuận lại không?
11. **Q-B5** Khi chưa có phiên bản Điều khoản nào được phát hành: giữ đăng ký như hiện tại hay chặn đăng ký?
12. **Q-B6** Có lưu IP/User-Agent khi chấp thuận làm bằng chứng không (dữ liệu cá nhân, thời gian lưu)?
13. **Q-B7** Xoá tài khoản: hiện không có tính năng. Có làm trong đợt này không? Bản ghi chấp thuận/báo cáo giữ bao lâu
    sau khi xoá?
14. **Q-B8** Khi xuất bản tài liệu: ghi bản chấp thuận theo phiên bản Cam kết bản quyền mỗi lần, hay giữ
    `rightsConfirmedAt` như ADR-038 là đủ?
15. **Q-B9** Có hiện thông báo "phiên bản mới có hiệu lực từ ngày …" trước ngày hiệu lực không? Bao nhiêu ngày báo trước?
16. **Q-B10** Ai được bấm Publish trang pháp lý — mọi SYSTEM_ADMIN hay chỉ super admin? Có bắt buộc tick "đã rà soát
    pháp lý" không?
17. **Q-B11** Báo cáo vi phạm: có thêm trạng thái trung gian (đang xem xét / cần bổ sung / kháng nghị) không? Có cho
    bên bị báo cáo kháng nghị không, qua kênh nào?
18. **Q-B12** Báo cáo "gian lận giao dịch": chấp nhận chỉ lưu mã đơn dạng văn bản (admin không xem đơn — §7.9) không?
19. **Q-B13** Mô hình hoạt động: Gieo Chữ là nền tảng trung gian (tiền về thẳng người bán — ADR-039), nhà cung cấp nội
    dung, hay kết hợp? Có thu phí/hoa hồng trên giao dịch tài liệu không?
20. **Q-B14** Độ tuổi tối thiểu tạo tài khoản / mở gian hàng? Có người dùng dưới 18 tuổi (học sinh) không?
21. **Q-B15** Thời hạn phản hồi báo cáo/yêu cầu quyền riêng tư nội bộ (nếu muốn công bố)?
22. **Q-B16** Có luật sư rà soát không, và lịch dự kiến?
    - **Q-B17** Form báo cáo có cần upload tệp bằng chứng (bucket private + quét file) ngay, hay chỉ link như hiện tại? Có
      hỏi số điện thoại không?
    - **Q-B18** Checkout cần checkbox lưu vết đồng ý Quyền sử dụng tài liệu/Hoàn tiền, hay chỉ dòng thông báo (Phong đề
      xuất chỉ dòng thông báo)?
    - **Q-B19** Đánh số phiên bản "1.0/1.1" hay theo ngày? Phiên bản cũ có cần xem công khai không?
    - **Q-B20** Có công bố công khai **bản dự thảo** (kèm nhãn "Bản dự thảo") trước khi luật sư duyệt không? Nếu không,
      checkbox đăng ký tạm thời chưa có link văn bản.
    - **Q-B21** Đồng ý thêm utility `container-doc` (bổ sung ADR-024) cho trang văn bản có mục lục bên cạnh?

### Menu (C)

23. **Q-C1** Menu một cấp là đủ, hay cần menu nhiều cấp (dropdown) ở header?
24. **Q-C2** Bỏ các chữ không link hiện nay ("Giáo viên & Coach", "Về …", "Liên hệ", "Tuyển dụng") khỏi mặc định — đồng
    ý không? Có trang "Về Gieo Chữ"/"Tuyển dụng" sắp tới không?
25. **Q-C3** Footer có cần khối mạng xã hội / thông tin pháp nhân (theo nghĩa vụ TMĐT nếu có) không?

### SEO (D)

26. **Q-D1** Có cho người bán tự đặt SEO title/description cho gian hàng/tài liệu không (cột mới bảng L2) — đợt này hay
    sau?
27. **Q-D2** Bài viết của gian hàng có vào sitemap không?
28. **Q-D3** Domain production chính thức (`gieochu.net`?) và domain thử nghiệm Vercel — để robots chặn đúng môi trường
    thử nghiệm.
    - **Q-D4** Ô SEO có đi theo luồng nháp/xuất bản như nội dung không (hiện Bảng giá ghi thẳng, không nháp)?

### Test

29. **Q-T1** Có duyệt nâng trần test (+1 unit, +2 integration, §6.2) không?

---

_Liên quan: `docs/PLAN.md` (mục "Kế hoạch: Trang chủ + Pháp lý + Menu CMS + SEO — chờ chủ dự án chốt"),
`docs/legal/LEGAL_REVIEW_CHECKLIST.md`._

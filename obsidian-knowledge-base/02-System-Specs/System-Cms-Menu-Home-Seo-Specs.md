---
tags:
  - spec
  - cms
  - system-admin
  - seo
  - security
  - status/living
date: 2026-10-23
updated: 2026-10-23
author: Long
---

# 📐 Đặc Tả: CMS Hệ Thống — Menu Header/Footer, Trang Chủ Theo Brief, SEO Trang Chủ (ADR-050 đợt 1)

Quyết định: [[01-Architecture-Decisions/ADR-035-Menu-Home-Seo-Versioned-Terms|ADR-035 KB (≙ ADR-050)]]. Trang này ghi hạng mục 1 (menu) và 2
(trang chủ + SEO) của ADR-050; hạng mục 3 (Điều khoản sử dụng) ở [[02-System-Specs/Legal-Documents-Specs|Legal-Documents-Specs]]. CMS trang chủ
gốc (dữ liệu thật, ghim, `soldCount`): [[01-Architecture-Decisions/ADR-019-Home-Page-Real-Data-Sold-Count|ADR-019 KB (≙ ADR-033)]].

> **Trạng thái 2026-10-23:** phần CMS/logic xong ở working tree, **chưa commit** ✅ `git status`; **không migration** cho hạng mục 1–2; giao diện
> công khai (header/footer/mobile nav/section trang chủ) Phong đã làm 🟡 (báo cáo Phong qua Quốc, Long đối chiếu phần lớn trong code) — bố cục ở
> [[04-Operations-Runbooks/UI-Design-System|UI-Design-System]] §1.1.1, §12.9, §13.7.
> Mức xác minh: ✅ Long đọc code working tree · 🟡 brief/báo cáo Quốc · ❓ cần môi trường thật.

---

## 1. Slug CMS hệ thống ✅

`SYSTEM_CMS_SLUGS = ["home", "shop", "pricing", "menu"]` (`packages/core/src/admin/cms-slugs.ts`; hằng `MENU_CMS_SLUG = "menu"`). Hệ quả với `menu`
giống 3 slug cũ: form CMS chung (`app/admin/cms/actions.ts`) từ chối tạo/ghi đè, `/p/menu` trả 404, danh sách `/admin/cms` trỏ dòng `menu` sang
`/admin/cms/menu` với chú thích "(header/footer mọi trang)". Cả `home` lẫn `menu` là `CmsPage` **L1 không RLS** → đọc/ghi bằng `getPrismaClient()`.
Dòng có thể chưa tồn tại: action dùng `upsert` theo slug, **không seed** (ADR-034). Sidebar System Center thêm 2 mục "Menu & chân trang"
(`/admin/cms/menu`) và "Văn bản pháp lý" (`/admin/cms/phap-ly`) ✅ `admin/_ui/sidebar-nav.tsx`.

---

## 2. Menu header/footer (`CmsPage` slug `menu`) ✅

Nguồn: `packages/core/src/admin/site-menu.ts` (subpath `@gieochu/core/site-menu`, chỉ phụ thuộc zod), loader `apps/web/lib/site-menu.ts`, editor
`apps/web/app/admin/cms/menu/`. `blocks` = bản live, `blocksDraft` = nháp (mẫu Cửa hàng/Bảng giá).

### 2.1. Mô hình

```
SiteMenu
├─ header.items[]  ≤ 5      NavItem { id, label ≤32, kind, target ≤500, newTab, visible, children[] ≤ 8 (NavLink, 1 cấp) }
├─ header.cta               NavCta  { id, label ≤24, kind, target, newTab, visible }
└─ footer
   ├─ description ≤160      (trống = slogan thương hiệu)
   ├─ columns[] 1–4         NavFooterColumn { id, title ≤32, links[] 1–8 (NavLink) }
   └─ copyright 1–120       token {năm} (năm hiện tại giờ VN) và {brand} (tên thương hiệu)
```

- `id` 1–64 ký tự, **không trùng** trên toàn menu (mục, mục con, CTA, cột, link) — schema chặt từ chối khi lưu.
- Mục header có `children` ≠ rỗng là **mục nhóm**: đích riêng bị bỏ qua (không bắt buộc hợp lệ). Khi render, nhóm không còn mục con hiển thị nào bị bỏ.

### 2.2. 4 loại link (`NAV_LINK_KINDS`) và luật đích

| `kind` | Nhãn editor | `target` hợp lệ | `href` dựng |
| :-- | :-- | :-- | :-- |
| `page` | Trang có sẵn | khoá trong `NAV_PAGE_PATHS` — `home` `/`, `shop` `/cua-hang`, `documents` `/cua-hang/tai-lieu`, `pricing` `/pricing`, `register` `/register`, `login` `/login` — hoặc `cms:<slug>` (slug chữ thường-số-gạch nối) | đường dẫn tương ứng / `/p/<slug>` |
| `internal` | Đường dẫn nội bộ | `isSafeInternalPath`: bắt đầu `/`, không `//`, không khoảng trắng/ký tự điều khiển/`\`, ≤ 500 | nguyên giá trị |
| `external` | Liên kết ngoài | `isSafeExternalUrl`: chỉ `https://`, URL parse được, không user:pass, host không phải `localhost`/`*.localhost`/`*.vercel.app`/`0.0.0.0`/`::1`/`127.*`/`10.*`/`192.168.*`/`172.16–31.*` | nguyên giá trị |
| `email` | Email | `isSafeEmailAddress` (≤ 254, nhập địa chỉ, **không** kèm `mailto:`) | `mailto:<email>` |

Khoá trang có sẵn là **khoá ổn định** — đổi đường dẫn trong code không làm vỡ menu đã lưu. Editor liệt kê thêm mọi `CmsPage` không thuộc slug hệ
thống dưới dạng `cms:<slug>` (kèm cờ đã xuất bản hay chưa; tối đa 200 dòng).

### 2.3. Luật chặn link dùng chung — `packages/core/src/admin/cms-content-guard.ts` ✅

Subpath `@gieochu/core/cms-content-guard` (không phụ thuộc gì, client import được):
- **Luật cứng** `isSafePublicHref(href)` cho `href` gõ tự do (CTA trang chủ): nhận `mailto:<email hợp lệ>`, đường dẫn nội bộ an toàn, hoặc
  `https://` an toàn theo bảng trên. Mọi scheme khác (`javascript:`, `data:`, `http:`, `vbscript:`…) bị chặn. Thông báo `UNSAFE_HREF_MESSAGE`.
- **Cảnh báo mềm** `findContentClaimWarnings(texts)` theo brief trang chủ §8 — **không bao giờ chặn** lưu/xuất bản. So trên chữ đã bỏ dấu + chữ
  thường (`normalizeForClaims`, `đ → d`). 6 nhóm `CONTENT_CLAIM_RULES`: `numbers` (số liệu "500+", "hơn N", "N người/giáo viên/tài liệu…"),
  `ratings` (★, "x/5", "N sao"), `income` (thu nhập, kiếm tiền, triệu/tháng, doanh thu/doanh số, có đơn sau/ngay), `free` (miễn phí, trọn đời,
  không giới hạn, không mất phí, 0đ), `moneyFlow` (về thẳng, trực tiếp vào tài khoản), `absolute` (an toàn tuyệt đối, bảo mật 100, ngay lập tức,
  tức thì). `collectStrings` gom mọi chuỗi trong một section để quét.

### 2.4. Đọc, mặc định và render

| Bước | Hàm | Hành vi |
| :-- | :-- | :-- |
| Lưu | `siteMenuSchema` (chặt) | Link không hợp lệ/không an toàn → lỗi theo `path` chấm (vd `header.items.0.target`), tối đa 20 lỗi |
| Đọc (render + nạp editor) | `parseSiteMenu(input)` (phòng thủ) | Mục/link hỏng bị bỏ **riêng**; header > 5 mục bị cắt; CTA hỏng → CTA mặc định; cột không còn link bị bỏ; không còn cột → cột mặc định; mô tả/bản quyền hỏng → mặc định; đầu vào không phải object → `null`. Id trùng (dữ liệu sửa tay) vẫn render |
| Công khai | `getPublishedSiteMenu()` (`cache()` theo request) | Chỉ dùng `blocks` khi `status = PUBLISHED`; còn lại → `defaultSiteMenu()` |
| Render | `resolveSiteMenu(menu, { brandName, slogan, year })` → `SiteMenuView` | Lọc `visible`, dựng `href` (đích hỏng bị bỏ), `external = !href.startsWith("/")`, thay `{năm}`/`{brand}` (chỉ 2 token, không phải template engine) |
| Header/footer | `getSiteMenu()` | `SiteHeader` + `SiteFooter` cùng request chỉ đọc DB một lần; năm = `currentDisplayYear()` theo `DISPLAY_TIME_ZONE` |

**Menu mặc định** (`defaultSiteMenu()`) = menu trước ADR-050 bỏ mục không có link ("Giáo viên & Coach", cột "Công ty", cột "Pháp lý"): header
"Bảng giá" → `pricing`, "Cửa hàng" → `shop`; CTA → `register`; footer 1 cột "Khám phá" (Cửa hàng, Bảng giá); bản quyền
`© {năm} {brand}. Bảo lưu mọi quyền.`

**CTA "miễn phí" có điều kiện** ✅: khi dùng menu mặc định, nhãn CTA là `DEFAULT_HEADER_CTA_LABEL_FREE` ("Mở gian hàng miễn phí") **chỉ khi** có
`Plan` `isActive = true` **và** `isFree = true`; không có → `DEFAULT_HEADER_CTA_LABEL` ("Mở gian hàng"). Khi menu đã PUBLISHED, nhãn CTA là chữ admin
đã lưu (không kiểm lại gói). Editor (`getSiteMenuEditorData`) áp **cùng luật** khi phải dùng menu mặc định (chưa có dòng hoặc `blocks` không đọc được) — Quốc sửa 2026-10-23
✅ `lib/site-menu.ts`. Theo "Bổ sung ADR-050", gói FREE thật đang bật 🟡 → mặc định giữ "miễn phí".

Contract render cho UI (`SiteNavLinkView`, `SiteNavItemView`, `SiteFooterColumnView`, `SiteMenuView`): [[03-API-Contracts/Endpoint-Directory|Endpoint-Directory]] §26.2.
`newTab` → UI đặt `target="_blank"` + `rel="noopener noreferrer"` (UI-Design-System §1.1.1). "Đăng nhập" và menu tài khoản
**không** cấu hình trong CMS — hệ thống tự hiện theo trạng thái đăng nhập ✅ (Notice ở editor).

### 2.5. Editor `/admin/cms/menu`

`requireAdminAccess("/admin/cms/menu")` ở trang; 3 Server Action (`saveMenuDraftAction`, `publishMenuAction`, `restoreLiveMenuAction`) mỗi cái tự
`requireRole("SYSTEM_ADMIN")`, validate lại bằng `siteMenuSchema` ở server, ghi audit `MENU_CMS_UPDATED` (metadata chỉ `operation`). Lưu nháp lần đầu
tạo dòng `DRAFT` với live = menu mặc định. Xuất bản → `revalidatePath("/", "layout")` (áp dụng mọi trang công khai). Khôi phục → xoá `blocksDraft`.
Contract chi tiết: [[03-API-Contracts/Endpoint-Directory|Endpoint-Directory]] §26.1.

---

## 3. Trang chủ theo brief (`CmsPage` slug `home`) ✅

Nguồn: `packages/core/src/admin/home-sections.ts` (subpath `@gieochu/core/home-sections`), loader `apps/web/lib/home-cms.ts`, editor
`app/admin/cms/[slug]/page.tsx` (nhánh `home`) + `app/admin/cms/home-editor/`, trang `app/page.tsx`. Đầu vào nội dung:
`docs/GIEOCHU_HOMEPAGE_CONTENT_BRIEF.md`.

### 3.1. 11 loại section (thứ tự mặc định)

| Section | Nhãn editor | Đổi ở ADR-050 |
| :-- | :-- | :-- |
| `hero` | Hero — Banner chính | Thêm `brandMessage?` ≤ 80 (trống = slogan thương hiệu), `imageAlt?` ≤ 160 (trống = ảnh trang trí `alt=""`) |
| `stats` | Số liệu nổi bật | Không đổi schema; **mặc định ẩn** (brief §5 không có, §8 yêu cầu xác minh) |
| `search` | Tìm tài liệu | Thêm `eyebrow?` ≤ 60, `submitLabel` ≤ 20 (mặc định "Tìm tài liệu", trước gõ cứng "Tìm kiếm") |
| `benefits` | Vì sao chọn chúng tôi | Không đổi schema |
| `coaches` / `documents` | Giáo viên & Coach / Tài liệu nổi bật | Thêm `eyebrow?`, `cta?`, **`minToShow`** 1–12, ≤ `limit` |
| `becomeSeller` | Kêu gọi mở gian hàng | `highlight` thành tuỳ chọn (mặc định `""`), thêm `body` 0–3 đoạn ≤ 600, `secondaryCta?` |
| `steps` **(mới)** | Cách bắt đầu | `eyebrow?`, `title` ≤ 160, `items` 2–6 `{ id, title, description ≤ 600 }`, `cta?` |
| `community` **(mới, thay `testimonials`)** | Cùng nhau phát triển (chứng thực / nhật ký / lời mời) | `mode` ∈ `testimonials`/`devlog`/`invite`; `testimonials` ≤ 6 `{ id, quote, name, role, consentConfirmed }`; `devlog` ≤ 6 `{ id, date YYYY-MM-DD, title, summary, href? }`; `invite { text, cta? }` (bắt buộc có `text` khi `mode = invite`) |
| `faq` **(mới)** | Câu hỏi thường gặp | `eyebrow?`, `title`, `items` 1–20 `{ id, question ≤ 200, answer ≤ 1500 }`, id không trùng |
| `finalCta` | CTA cuối trang | Thêm `secondaryCta?`, `showSlogan` (mặc định `true` — slogan đọc từ brand) |

Field mới đều tuỳ chọn hoặc có mặc định → bản live trước ADR-050 vẫn parse được ✅ (unit test). `ctaSchema` chỉ yêu cầu `label`/`href` không rỗng
— an toàn của `href` kiểm ở **luật chặn xuất bản** (§3.4), không ở lúc lưu nháp ✅.

### 3.2. Chuyển dữ liệu cũ + parse phòng thủ

`parseHomeSections(input)` (dùng khi render và nạp editor; lúc lưu dùng `homeSectionsSchema` chặt):
- Section `testimonials` cũ → `community` chế độ `testimonials`, mỗi mục `consentConfirmed = false` (không có bằng chứng đồng ý), id
  `testimonial-N`, bỏ mục thiếu `quote`/`name`, tối đa 6; kèm chữ "Cùng nhau phát triển" + lời mời mặc định ⇒ **tự ẩn**, rơi về lời mời.
- `stats/search/coaches/documents`: dữ liệu nhập tay cũ chuẩn hoá sang dạng mới (ADR-033 mục 6); `minToShow` thiếu/sai → 3, luôn kẹp ≤ `limit`.
- Section khác không hợp lệ → bỏ riêng section đó; trùng `id` → giữ section đầu; đầu vào không phải mảng → `null`.

`resolveCommunityView(data)` (chạy ở server trước khi render): chế độ chứng thực chỉ lấy mục `consentConfirmed = true`; chế độ chứng thực/nhật ký
không còn mục nào → lời mời; nhật ký sắp ngày giảm dần; lời mời trống → `null` (section không render).

### 3.3. Nội dung mặc định và token `{brand}`

- `getHomePageContent()` (`cache()` theo request): chỉ dùng bản `PUBLISHED`; chưa xuất bản **hoặc** không đọc được section nào →
  `defaultHomeSections()` (`isDefault = true`). Trước ADR-050, chưa có bản PUBLISHED thì trang chủ chỉ còn header + footer.
- `defaultHomeSections()`: 11 section soạn từ brief §6 — **không** số liệu, giá, lời chứng thực; `stats` ẩn; `community` ở chế độ lời mời; CTA trỏ
  `/register`, `/cua-hang/tai-lieu`, `/cua-hang`. FAQ mặc định có câu "Tôi có thể bắt đầu miễn phí không?" — câu trả lời **không** khẳng định miễn
  phí, chỉ dẫn tới bảng giá hiện hành ✅.
- `replaceBrandToken(value, brandName)` thay `{brand}` trong mọi chuỗi (chữ thuần — React tự escape). Editor nhắc "Dùng {brand} thay cho tên nền tảng".
- Editor: `withMissingHomeSections` thêm (ở trạng thái **ẩn**) các loại section còn thiếu vào cuối, nên bản live cũ chưa có `steps/faq/community`
  vẫn soạn được; id trùng được thêm hậu tố `-2`, `-3`…

### 3.4. Luật chặn xuất bản — `homePublishIssues(sections)` ✅

Server kiểm lại khi **Xuất bản** (Lưu nháp không chặn); editor dùng để báo trước. Mỗi lỗi `{ sectionId, field (đường dẫn chấm trong data), message }`:
1. Mục lời chứng thực `consentConfirmed = false` (field `testimonials.N.consentConfirmed`) — phải tích xác nhận đồng ý của người được trích hoặc xoá mục.
2. `href` không qua `isSafePublicHref` ở: `hero.primaryCta/secondaryCta`, `coaches/documents/steps.cta`, `becomeSeller/finalCta.cta/secondaryCta`,
   `community.invite.cta`, `community.devlog.N.href`.

Cảnh báo mềm brief §8 (§2.3) **không** nằm trong luật này.

### 3.5. Trang công khai `app/page.tsx`

- `coaches`/`documents`: render khi số thẻ thật > 0 **và** ≥ `minToShow` ✅; ghim + tự bù như ADR-033.
- Section `visible = false` không render; số liệu/giá/sao gõ cứng ("500+", "10.000+", "149.000đ", 5 sao) được gỡ — phần JSX Phong đã làm, xem UI-Design-System §12.9.

---

## 4. SEO trang chủ + bộ giới hạn SEO dùng chung ✅

### 4.1. `packages/core/src/admin/seo.ts` (subpath `@gieochu/core/seo`)

| Hằng / hàm | Giá trị |
| :-- | :-- |
| `SEO_TITLE_MAX` / `SEO_DESCRIPTION_MAX` | **120 / 320** — ràng buộc cứng khi lưu |
| `SEO_TITLE_RECOMMENDED_MAX` / `SEO_DESCRIPTION_RECOMMENDED_MAX` | **60 / 160** — chỉ cảnh báo mềm |
| `cmsSeoSchema` | `{ seoTitle, seoDescription }` trim; chuỗi rỗng = dùng mặc định của route |
| `seoLengthWarning(kind, value)` | "Dài hơn N ký tự — Google có thể cắt bớt khi hiển thị."; trống hoặc trong mức → `null` |

CMS Bảng giá dùng lại bộ này: `PRICING_SEO_TITLE_MAX = SEO_TITLE_MAX`, `pricingSeoSchema = cmsSeoSchema` — **giá trị không đổi** (120/320) ✅ `git diff`.

### 4.2. Trang chủ

- Editor lưu `seoTitle/seoDescription` (cột có sẵn của `CmsPage`, không migration) qua `cmsSeoSchema`; chuỗi rỗng lưu `null`.
- **SEO lưu thẳng, không qua nháp — giống Bảng giá** ✅ code, chốt ở "Bổ sung ADR-050 lần 2" (Quốc, "cho tới khi có quyết định khác"): mọi thao tác
  Lưu nháp / Xuất bản đều ghi thẳng 2 cột; giá trị chỉ được dùng khi dòng `home` đang `PUBLISHED`. Hệ quả: khi trang chủ **đã** PUBLISHED, bấm
  "Lưu nháp" cũng làm SEO mới có hiệu lực ngay (khác phần section phải chờ Xuất bản).
- `generateMetadata()` ở `app/page.tsx`: `title` = `seoTitle` CMS ?? `DEFAULT_HOME_SEO.title`, `description` = `seoDescription` ?? mặc định (đều thay
  `{brand}`); `metadataBase = new URL(APP_URL)`, `alternates.canonical = ${APP_URL}/` (bỏ `/` thừa cuối `APP_URL`). Mặc định brief §4:
  "{brand} – Nền tảng bán tài liệu số và học liệu giáo dục" + mô tả 1 câu.
- **Chưa làm** (đợt sau): ảnh OG riêng, `noindex`, `sitemap.ts`, `robots.ts`, JSON-LD.

### 4.3. Editor trang chủ — Server Action

`saveHomeDraftAction(sections, seo)`, `publishHomeAction(sections, seo)`, `restoreLiveHomeAction()` — mỗi action `requireRole("SYSTEM_ADMIN")`,
section validate bằng `homeSectionsSchema`, xuất bản thêm `homePublishIssues`, audit `HOME_CMS_UPDATED` (metadata chỉ `operation`). Trang editor mở được
cả khi chưa có dòng `home` (lần lưu đầu tạo dòng `DRAFT`, live = nội dung mặc định). Contract: [[03-API-Contracts/Endpoint-Directory|Endpoint-Directory]] §26.3.

---

## 5. Test ✅

`packages/core/src/admin/site-menu.test.ts` — **1 unit** (`describe("ADR-050 CMS menu and home sections")`): menu mặc định hợp lệ; link `javascript:`,
`data:`, `http:`, `*.vercel.app`, `//…`, `/\…`, khoá trang lạ, email `javascript:` bị từ chối; parse phòng thủ (cắt 5 mục, CTA hỏng → mặc định, cột
chỉ có link hỏng bị bỏ, đầu vào chuỗi → `null`); `testimonials` cũ → `community` consent=false → hiển thị lời mời, `minToShow` mặc định 3, xuất bản bị chặn.

---

## 6. Liên kết

* [[01-Architecture-Decisions/ADR-035-Menu-Home-Seo-Versioned-Terms|ADR-035 KB (≙ ADR-050)]] · [[01-Architecture-Decisions/ADR-011-Tenant-Owns-Storefront-Content-Only|ADR-011 KB (≙ ADR-025)]] · [[01-Architecture-Decisions/ADR-019-Home-Page-Real-Data-Sold-Count|ADR-019 KB (≙ ADR-033)]]
* [[02-System-Specs/Pricing-Page-Specs|Pricing-Page-Specs]] — SEO CMS Bảng giá dùng chung giới hạn ([Pricing-Page-Specs.md](./Pricing-Page-Specs.md)) · [[02-System-Specs/Shop-Marketplace-Specs|Shop-Marketplace-Specs]] — mẫu CMS slug hệ thống ([Shop-Marketplace-Specs.md](./Shop-Marketplace-Specs.md))
* [[02-System-Specs/Legal-Documents-Specs|Legal-Documents-Specs]] ([Legal-Documents-Specs.md](./Legal-Documents-Specs.md)) · [[02-System-Specs/Audit-Log-Specs|Audit-Log-Specs]] §4
* [[03-API-Contracts/Endpoint-Directory|Endpoint-Directory]] §26 ([Endpoint-Directory.md](../03-API-Contracts/Endpoint-Directory.md))

*Quay lại: [[MOC-Home]] (../00-Index/MOC-Home.md)*

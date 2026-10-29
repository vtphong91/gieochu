---
tags:
  - spec
  - cms
  - system-admin
  - seo
  - security
  - status/living
date: 2026-10-23
updated: 2026-10-26
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

### 2.2. 5 loại link (`NAV_LINK_KINDS`) và luật đích (ADR-050: 4 loại; ADR-054 thêm `legal`)

| `kind` | Nhãn editor | `target` hợp lệ | `href` dựng |
| :-- | :-- | :-- | :-- |
| `page` | Trang có sẵn | khoá trong `NAV_PAGE_PATHS` — `home` `/`, `shop` `/cua-hang`, `documents` `/cua-hang/tai-lieu`, `pricing` `/pricing`, `register` `/register`, `login` `/login` — hoặc `cms:<slug>` (slug chữ thường-số-gạch nối) | đường dẫn tương ứng / `/p/<slug>` |
| `legal` | Văn bản pháp lý (ADR-054) | khoá trong `LEGAL_DOCUMENT_DEFS` (`terms`, `privacy`, `content_policy`, `copyright`, `usage_license`, `seller`, `contact`); khoá lạ → lỗi "Chọn một văn bản pháp lý." | `legalDocumentPath(key)` = `/{slug}` cấp gốc. Khi render, văn bản **chưa có bản hiệu lực** → link bị bỏ (§2.4) ✅ |
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
| Render | `resolveSiteMenu(menu, { brandName, slogan, year, effectiveLegalKeys })` → `SiteMenuView` | Lọc `visible`, bỏ link `legal` tới văn bản không nằm trong `effectiveLegalKeys` (ADR-054 — mọi vị trí: mục header, menu con, CTA, link footer; cột footer rỗng → bỏ cột), dựng `href` (đích hỏng bị bỏ), `external = !href.startsWith("/")`, thay `{năm}`/`{brand}` (chỉ 2 token, không phải template engine) |
| Header/footer | `getSiteMenu()` | Đọc song song menu, thương hiệu và `getEffectiveLegalKeys()` (ADR-054, một truy vấn, `cache()`); `SiteHeader` + `SiteFooter` cùng request chỉ đọc DB một lần; năm = `currentDisplayYear()` theo `DISPLAY_TIME_ZONE` |

**Menu mặc định** (`defaultSiteMenu()`) = menu trước ADR-050 bỏ mục không có link ("Giáo viên & Coach", cột "Công ty", cột "Pháp lý"): header
"Bảng giá" → `pricing`, "Cửa hàng" → `shop`; CTA → `register`; footer cột "Khám phá" (Cửa hàng, Bảng giá) và — từ ADR-054 — cột **"Thông tin"** (`col-info`, 7 link loại `legal`: Điều khoản sử dụng, Chính sách
bảo mật, Chính sách nội dung, Cam kết bản quyền, Quyền sử dụng tài liệu, Chính sách người bán, Liên hệ — tự ẩn từng link/cả cột khi văn bản chưa hiệu
lực) ✅ code. Menu **đã xuất bản** trên DB không tự có cột này — admin thêm trong CMS ❓; bản quyền
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
| `hero` | Hero — Banner chính | Thêm `brandMessage?` ≤ 80 (trống = **không hiển thị** — "Bổ sung lần 3", trước đó trống = slogan), `imageAlt?` ≤ 160 (trống = ảnh trang trí `alt=""`), `statBadges` 0–3 thẻ số liệu (lần 3, §3.6) |
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

### 3.6. Hero — thông điệp và thẻ số liệu nổi bật ("Bổ sung ADR-050 lần 3") ✅ đọc code working tree 2026-10-23 (chưa commit)

Không migration — dữ liệu nằm trong JSON section `hero` của `CmsPage` slug `home`.

**`brandMessage`:** trống → **không render** dòng thông điệp dưới CTA (`HeroSection` không còn nhận prop `slogan`). Nội dung mặc định để trống
`brandMessage`. Hint editor: "Để trống = không hiển thị dòng này." ✅

**`statBadges`** (`packages/core/src/admin/home-sections.ts`) ✅:

| Trường | Ràng buộc |
| :-- | :-- |
| `id` | chuỗi trim, 1–`HOME_ITEM_ID_MAX` |
| `metric` | ∈ `HOME_STAT_KEYS` = `tenants` / `products` / `sold` / `reviews` |
| `label` | bắt buộc, ≤ `HOME_HERO_STAT_LABEL_MAX` = 40 (= `HOME_SHORT_LABEL_MAX`) |
| `minValue` | `Int` ≥ 0 — giá trị thật < ngưỡng → thẻ ẩn; giá trị thật = 0 → thẻ **luôn ẩn** kể cả `minValue` = 0 (lọc ở server, xem dưới) |
| `enabled` | boolean |

- Mảng 0–`HOME_HERO_STAT_BADGES_MAX` (3) thẻ; **không trùng `metric`** ("Mỗi số liệu chỉ dùng cho 1 thẻ.") và **không trùng `id`**. Mảng rỗng hợp lệ.
- Mặc định `defaultHeroStatBadges()`: 3 thẻ `tenants`/`products`/`sold` (id `hero-stat-{metric}`), `minValue` = `HOME_HERO_STAT_MIN_VALUE_DEFAULT` (10),
  bật, nhãn theo `HOME_HERO_STAT_DEFAULT_LABELS` ("Gian hàng đang hoạt động", "Tài liệu đang bán", "Lượt mua"; `reviews` dùng nhãn của section
  `stats`). **Không** có thẻ `reviews` trong mặc định.
- Dữ liệu cũ thiếu trường: schema dùng `.default(defaultHeroStatBadges)` → parse ra 3 thẻ mặc định. **Hệ quả:** bản PUBLISHED hiện có trên DB dùng
  chung sẽ hiện thẻ ngay sau khi code lên (nếu số liệu thật ≥ 10), không cần admin xuất bản lại ✅ unit test.

**Lọc ở server** — `buildHeroStatBadges(data, stats)` (`apps/web/lib/home.ts`) ✅: giữ đúng thứ tự CMS, bỏ thẻ tắt, thẻ có giá trị thật
**= 0** (luôn ẩn kể cả khi `minValue` = 0 — thống nhất với section `stats`, ADR-033 mục 2; sửa 2026-10-23 theo KB-Audit §32 mục 2) và thẻ có
`stats[metric] < minValue` (điều kiện giữ: `enabled && value > 0 && value >= minValue`); trả `{ id, metric, label, value, display }`. `app/page.tsx` (nhánh `hero` của `loadSectionData`) chỉ gọi `getHomeStats()` khi có ít nhất 1 thẻ bật,
dùng chung lần gọi (`once`) với section `stats` — **tính cả khi section `stats` đang ẩn**. `getHomeStats()` đếm qua `withPublic`, tính **mỗi request,
không cache** (định nghĩa số liệu như ADR-033 mục 2, xem [[01-Architecture-Decisions/ADR-019-Home-Page-Real-Data-Sold-Count|ADR-019 KB]]).

**`formatCompactStatCount(value)`** (`@gieochu/core`, cả subpath `@gieochu/core/home-sections`) — luôn làm tròn **xuống**; dấu **"+" chỉ
thêm khi số đã bị làm tròn** (mất phần lẻ), số đúng tròn theo bậc không có "+" ✅ unit test (sửa 2026-10-23 theo KB-Audit §32 mục 1):

| Khoảng | Bậc làm tròn | Kết quả | Ví dụ |
| :-- | :-: | :-- | :-- |
| < 100 | 1 | số thật, không bao giờ có "+" | 7 → "7", 99 → "99" |
| 100–999 | 10 | hàng chục; "+" khi lẻ hàng đơn vị | 100 → "100", 120 → "120", 125 → "120+", 999 → "990+" |
| 1.000–999.999 | 100 | 1 chữ số thập phân dấu phẩy + "K", bỏ ",0"; "+" khi lẻ dưới hàng trăm | 1000 → "1K", 1200 → "1,2K", 1250 → "1,2K+", 999.999 → "999,9K+" |
| ≥ 1.000.000 | 100.000 | như trên + "M" | 1.000.000 → "1M", 1.250.000 → "1,2M+" |

Âm / không hữu hạn → "0" (chuẩn hoá chung `normalizeStatValue`: `floor`, chặn dưới 0).

**Hai helper đi kèm** (cùng file, export ở `@gieochu/core` và `@gieochu/core/home-sections`) ✅ code — dùng chung bậc làm tròn với
`formatCompactStatCount` (hàm nội bộ `statRoundingStep`), nên chữ hiển thị và câu đọc luôn khớp nhau:

| Hàm | Trả về | Ví dụ |
| :-- | :-- | :-- |
| `isStatRounded(value)` | `true` khi số bị làm tròn xuống (`n % bậc ≠ 0`) — tức chữ hiển thị có "+" | 1250 → `true`; 1200 → `false`; 87 → `false` |
| `floorStatValue(value)` | giá trị sau khi làm tròn xuống theo cùng bậc | 1250 → 1200; 125 → 120; 87 → 87 |

Câu `sr-only` của thẻ (`spokenCount` trong `app/_ui/hero-stat-badges.tsx`) = `"Hơn " + formatCount(floorStatValue(v))` khi `isStatRounded(v)`,
ngược lại chỉ `formatCount(floorStatValue(v))` → "1,2K+" đọc "Hơn 1.200", "1,2K" đọc "1.200", "87" đọc "87" ✅ code. Chữ "Hơn" xuất hiện **đúng
khi** phần hiển thị có "+".

**Editor** (`/admin/cms/home`, khối `HeroStatBadgesEditor` trong `home-sections-editor.tsx`) ✅: trang `[slug]/page.tsx` đọc `getHomeStats()` song song
với dữ liệu editor và truyền `liveStats` — mỗi lựa chọn số liệu hiện "(hiện tại: N)", ô ngưỡng có hint "Giá trị hiện tại: N — thẻ đang hiện / dưới
ngưỡng, thẻ đang ẩn / thẻ đang tắt". Thêm thẻ tự chọn số liệu chưa dùng (số liệu đã dùng bị `disabled` trong select); đổi số liệu mà nhãn vẫn là
nhãn mặc định → nhãn đổi theo. Ô ảnh có hint khung 4:5. Hint trạng thái tính `enabled && current > 0 && current >= minValue` — cùng quy tắc
với `buildHeroStatBadges`; ghi chú `LiveDataNote` nêu "Thẻ tắt, có giá trị thật bằng 0 hoặc nhỏ hơn ngưỡng sẽ tự ẩn" ✅ code (sửa 2026-10-23, KB-Audit §32 mục 6).

**Khung ảnh:** cố định tỷ lệ **4:5** (`aspect-[4/5]`, `object-cover`) — ảnh khuyến nghị **1200×1500 px**, tỷ lệ khác bị cắt giữa, WebP/JPEG < 300 KB,
chừa ~15% mỗi góc cho thẻ (hint editor) ✅. Ảnh upload render qua `cloudinaryDeliveryUrl(data.imageUrl, { width: 1200 })` (ADR-028,
`app/_home-sections.tsx`, `fetchPriority="high"`) — sửa 2026-10-23 theo KB-Audit §32 mục 4 ✅ code. Bố cục thẻ: [[04-Operations-Runbooks/UI-Design-System|UI-Design-System]] §12.10.

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

## 4A. Trang tuỳ chỉnh `/p/[slug]` — khối `richText` hiển thị Markdown (ADR-060) ✅ đọc code 2026-10-26 — đã commit `fa29d99`

Quyết định: [[01-Architecture-Decisions/ADR-045-Custom-Page-Markdown-Brand-Token|ADR-045 KB (≙ ADR-060)]]. Không đổi schema (`CmsPage.blocks` vẫn JSON khối
`hero`/`features`/`stats`/`testimonials`/`pricingTable`/`faq`/`richText`/`cta`), không migration, không thêm `route.ts`. Chỉ đổi cách **hiển thị** khối `richText`;
các khối khác giữ nguyên.

- **Nơi xử lý:** `renderCmsRichText(source, brandName)` (`apps/web/lib/cms-markdown.ts`, mới) — chạy ở **server** (Server Component `app/p/[slug]/page.tsx`), dùng
  thư viện `marked` (GFM). Trang in kết quả bằng `dangerouslySetInnerHTML` trong `<section class="gieochu-rich-content gieochu-legal-content">` (dùng lại typography của
  trang pháp lý). Chuỗi rỗng → không có section.
- **Nhận:** Markdown GFM — tiêu đề, **đậm**/*nghiêng*, danh sách (có/không số), **bảng**, liên kết, trích dẫn.
- **Không nhận:**
  - **HTML thô** viết trong nội dung (khối hoặc inline) → escape thành chữ, không bao giờ thành thẻ (`<script>` hiện ra dạng văn bản).
  - **Ảnh** — sanitize với `imageCloudName = null` nên mọi `<img>` bị bỏ.
- **Làm sạch:** kết quả `marked` đi qua `sanitizeRichTextHtml` (`packages/core/src/content/sanitize-html.ts`) với `trustedLinks: { siteOrigin }` (ADR-054 — link
  ngoài `target="_blank" rel="noopener noreferrer"`, link nội bộ cùng tab; chỉ `http`/`https`/`mailto`) và tuỳ chọn **mới `allowTables: true`** — thêm thẻ
  `table/thead/tbody/tr/th/td`, **không** thuộc tính nào (bỏ `align`, `style`). Chỉ trang tuỳ chỉnh bật `allowTables`; nội dung Tiptap khác giữ whitelist cũ.
- **Thay `{brand}`:** sau khi sanitize, bằng `replaceBrandTokenInHtml(html, brand.name)` (`@gieochu/core`, giá trị được escape); tên lấy từ `getEffectiveBrand()`.
- **Quy tắc xuống dòng (tương thích nội dung chữ thuần cũ):**
  - Nội dung **có tiêu đề** Markdown (dòng bắt đầu `#`…`######` + khoảng trắng) **hoặc có bảng** (dòng dạng `| … |`) → coi là tài liệu Markdown: xuống dòng đơn
    trong một đoạn được **nối lại** thành một đoạn (chuẩn Markdown, `breaks: false`).
  - **Không có** tiêu đề/bảng → mỗi xuống dòng thành `<br>` (`breaks: true`), dòng trống vẫn tách đoạn — nội dung cũ trước đây in `white-space: pre-line` hiển thị như cũ.
- **Test:** thêm assert `allowTables` vào test có sẵn `sanitize-html.test.ts` ✅ `git diff --stat`; `pnpm test:count` = **100/100 unit, 66/66 integration** ✅ (Long chạy
  2026-10-26) — không đổi. Thử trên trình duyệt với 3 dự thảo hướng dẫn ❓.
- **Soạn nội dung:** dự thảo hướng dẫn khách hàng ở `docs/du-thao-huong-dan/` dùng `{brand}` (ADR-060), nhập vào **Nội dung → Trang tuỳ chỉnh**, khối `richText`.

---

## 5. Test ✅

`packages/core/src/admin/site-menu.test.ts` — **1 unit** (`describe("ADR-050 CMS menu and home sections")`): menu mặc định hợp lệ; link `javascript:`,
`data:`, `http:`, `*.vercel.app`, `//…`, `/\…`, khoá trang lạ, email `javascript:` bị từ chối; parse phòng thủ (cắt 5 mục, CTA hỏng → mặc định, cột
chỉ có link hỏng bị bỏ, đầu vào chuỗi → `null`); `testimonials` cũ → `community` consent=false → hiển thị lời mời, `minToShow` mặc định 3, xuất bản bị chặn;
(lần 3, thêm `expect` vào cùng test) hero thiếu `statBadges` → 3 thẻ mặc định ngưỡng 10, `statBadges: []` hợp lệ, trùng `metric` bị từ chối, bảng ví dụ
`formatCompactStatCount`. `pnpm test:count` = **95/95 unit, 57/57 integration** ✅ (Long chạy 2026-10-23) — không đổi.

---

## 6. Liên kết

* [[01-Architecture-Decisions/ADR-035-Menu-Home-Seo-Versioned-Terms|ADR-035 KB (≙ ADR-050)]] · [[01-Architecture-Decisions/ADR-011-Tenant-Owns-Storefront-Content-Only|ADR-011 KB (≙ ADR-025)]] · [[01-Architecture-Decisions/ADR-019-Home-Page-Real-Data-Sold-Count|ADR-019 KB (≙ ADR-033)]]
* [[02-System-Specs/Pricing-Page-Specs|Pricing-Page-Specs]] — SEO CMS Bảng giá dùng chung giới hạn ([Pricing-Page-Specs.md](./Pricing-Page-Specs.md)) · [[02-System-Specs/Shop-Marketplace-Specs|Shop-Marketplace-Specs]] — mẫu CMS slug hệ thống ([Shop-Marketplace-Specs.md](./Shop-Marketplace-Specs.md))
* [[02-System-Specs/Legal-Documents-Specs|Legal-Documents-Specs]] ([Legal-Documents-Specs.md](./Legal-Documents-Specs.md)) · [[02-System-Specs/Audit-Log-Specs|Audit-Log-Specs]] §4
* [[03-API-Contracts/Endpoint-Directory|Endpoint-Directory]] §26 ([Endpoint-Directory.md](../03-API-Contracts/Endpoint-Directory.md))
* [[01-Architecture-Decisions/ADR-045-Custom-Page-Markdown-Brand-Token|ADR-045 KB (≙ ADR-060)]] — trang tuỳ chỉnh hiển thị Markdown (§4A) ([ADR-045-Custom-Page-Markdown-Brand-Token.md](../01-Architecture-Decisions/ADR-045-Custom-Page-Markdown-Brand-Token.md))

*Quay lại: [[MOC-Home]] (../00-Index/MOC-Home.md)*

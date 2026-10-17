---
tags:
  - spec
  - pricing
  - billing
  - system-admin
  - ui-ux
  - status/living
date: 2026-10-17
updated: 2026-10-17
author: Long
---

# 📐 Đặc Tả: Trang Bảng Giá `/pricing` + CMS `pricing` (ADR-041 A)

> Quyết định gốc: **ADR-041** mục A (+ 2 lần bổ sung) trong [`docs/DECISIONS.md`](../../docs/DECISIONS.md). Bản trích KB:
> [[01-Architecture-Decisions/ADR-027-Account-Upgrade-Pricing-Profile-Refund|ADR-027 (≙ ADR-041)]]. Kế hoạch:
> [`docs/ke-hoach-nang-cap-tai-khoan-va-ho-so-2026-10-17.md`](../../docs/ke-hoach-nang-cap-tai-khoan-va-ho-so-2026-10-17.md); đề xuất
> giao diện của Phong: `docs/de-xuat-trang-bang-gia-2026-10-17.md`. Theo nguyên tắc **CMS trước, UI sau** (mẫu đã áp dụng: trang chủ
> ADR-033, Cửa hàng ADR-035 — [[02-System-Specs/Shop-Marketplace-Specs|Shop-Marketplace-Specs]]).
>
> Mức xác minh: ✅ Long đã đối chiếu code working tree 2026-10-17 (**GĐ1 + GĐ2 xong code, chưa commit/deploy**) · 🟡 theo brief/báo
> cáo · ❓ cần môi trường thật. Không DDL cho phần CMS (dùng bảng `cms_pages` có sẵn).

---

## 1. Phạm vi

- Trang công khai `/pricing` giới thiệu **gói dịch vụ giáo viên/coach (tenant) mua của nền tảng** (Platform Billing, ADR-021) — không
  phải giá tài liệu tenant bán cho khách.
- **Một nguồn sự thật cho số:** tên, giá, chu kỳ, hạn mức, cờ tính năng **luôn đọc từ `Plan`** (`/admin/plans`); số liệu "đang diễn
  ra" đọc thật (`getHomeStats()`); danh sách cổng thanh toán đọc `getEnabledPlatformProviders()`. CMS chỉ lưu chữ marketing + cấu hình
  hiển thị ✅.
- Ngoài phạm vi (ADR-041): thẻ Enterprise/"Liên hệ", quà tặng thêm tháng, dùng thử gói trả phí. VAT/hoá đơn, hoa hồng, kênh hỗ trợ là
  **nội dung CMS do admin nhập**, không hard-code.

---

## 2. Dữ liệu — `CmsPage` slug `pricing` ✅

- `blocks` = bản live, `blocksDraft` = nháp, `status` `DRAFT`/`PUBLISHED`, `seoTitle`/`seoDescription` (cột riêng, không có nháp).
- `"pricing"` thuộc `SYSTEM_CMS_SLUGS` (`packages/core/src/admin/cms-slugs.ts`, hằng `PRICING_CMS_SLUG`) → `/p/pricing` 404, form CMS
  chung không tạo/ghi đè; danh sách `/admin/cms` trỏ dòng này tới `/pricing` (công khai) và `/admin/cms/pricing` (editor).
- Dòng tạo bằng `upsert` ở **lần lưu đầu** của admin — **không qua seed** (ADR-034). Chưa có dòng / chưa xuất bản → trang dùng cấu hình
  mặc định trong code (không 404).
- Dữ liệu cá nhân: không (nội dung marketing + bảng L1 `Plan`).

### 2.1. Schema — `packages/core/src/admin/pricing-sections.ts` (subpath `@gieochu/core/pricing-sections`)

Mảng có thứ tự `{ id, type, visible, data }`, mỗi `type` tối đa 1 lần, đủ **9 section** ✅:

| `type` | Nhãn | `data` (giới hạn chính) |
| :-- | :-- | :-- |
| `hero` | Hero | `eyebrow` (≤60), `title` (≤120), `subtitle` (≤240), `badge?` (≤40) |
| `plans` | Thẻ gói | `title?`, `subtitle?`, `showAutoLimits`, `ctaLabels` (10 khoá, mỗi nhãn ≤40), `cycleToggle { primaryLabel, altLabel, savingsTemplate (phải chứa `{percent}`) }`, `items[]` (≤8, tối đa 1 `highlighted`, một gói chỉ xuất hiện ở 1 thẻ) |
| ↳ item | | `planId`, `altPlanId?` (khác `planId`), `visible`, `highlighted`, `badge?` (≤30), `tagline?` (≤120), `benefits[]` (≤8, mỗi dòng ≤100), `ctaLabel?`, `note?` (≤120) |
| `priceNote` | Ghi chú giá | `lines[]` (1–4, mỗi dòng ≤200) |
| `stats` | Số liệu thật | `title`, `items { key: HomeStatKey, label, visible }[]` — **không có trường số** |
| `comparison` | Bảng so sánh | `title`, `subtitle?`, `showPlanHeaderCta`, `groups[]` (≤6) → `rows[]` (≤15/nhóm) union theo `kind`: `limit` (`field` ∈ `maxProducts`/`storageMb`/`maxFileMb`/`imageStorageMb`) · `feature` (`featureKey` ∈ 6 cờ) · `custom` (`cells` theo `planId`: `yes`/`no`/`text`, `fallback` `yes`/`no`/`dash`) |
| `whyUs` | Vì sao chọn | `title`, `subtitle?`, `items { icon (8 key cố định), title, description }[]` (1–6) |
| `faq` | Câu hỏi thường gặp | `title`, `items { id, question (≤200), answer (≤1500, văn bản thuần) }[]` (≤20) |
| `ctaFinal` | Kêu gọi cuối trang | `title`, `description` (≤300), `buttonLabel?` |
| `paymentMethods` | Phương thức thanh toán | `title`, `description?`, nhãn theo `MANUAL_QR`/`SEPAY`/`MOMO` |

> ⚠️ Kế hoạch §3.1 gọi section lý do là `reasons`; code dùng **`whyUs`** ✅ (chỗ lệch tên, ghi KB-Audit §21).

**Khoá nhãn CTA** (`PRICING_CTA_KEYS`, 10): `signup`, `choosePlan`, `openStore`, `openStoreFirst`, `upgrade`, `switch`, `renew`, `current`,
`pendingInvoice`, `freeFallback`. Code quyết **đích** theo người xem, CMS chỉ quyết **chữ** ✅.

**Biến thay thế** (không phải template engine): `{brand}` (`getEffectiveBrand()`, ADR-032), `{graceDays}` (`getSystemSettings().graceDays`);
nhãn nút thêm `{plan}` (tên gói), nhãn tiết kiệm thêm `{percent}`. Chuỗi mặc định không chứa tên thương hiệu cứng ✅.

### 2.2. Lưu và đọc

- **Lưu** (editor → action): `pricingSectionsSchema` (chặt) + `validatePricingPlanRefs` với danh sách `Plan` thật ở server: `planId`/
  `altPlanId` phải tồn tại (được phép gói đã tắt — editor báo "Gói đang tắt"); **không ghép cặp chu kỳ cho gói Free**; ô `custom` chỉ chứa
  `planId` có thật ✅.
- **Đọc** (`parsePricingSections`, phòng thủ): không phải mảng → `null` (dùng mặc định); `type` lạ bỏ, trùng giữ phần tử đầu; field hỏng về
  mặc định, mục hỏng trong danh sách bị bỏ; section thiếu thêm cuối ở trạng thái **ẩn**; kết quả luôn đủ 9 section và qua schema chặt ✅.
- **Thẻ gói khi render** (`resolvePricingPlanSlots`): giữ thứ tự `items[]`; bỏ mục `visible:false` và mục có `planId` không còn bật;
  `altPlanId` không còn bật → coi như không ghép; gói đang bật chưa được nhắc tới (kể cả làm `altPlanId`) → **thêm cuối, đang hiện**, nội
  dung mặc định ✅ (ADR-041 A.1).

---

## 3. Gói năm và % tiết kiệm (ADR-041 A.2) ✅

- Admin tạo `Plan` `interval = YEAR` ở `/admin/plans`; CMS ghép cặp bằng `altPlanId` trên thẻ gói tháng. Không đổi schema `Plan`.
- `computeCycleSavingsPercent(primary, alt)` = `floor((giá chính × tháng phụ − giá phụ × tháng chính) × 100 / (giá chính × tháng phụ))` —
  số nguyên, không float; không tiết kiệm hoặc dữ liệu không hợp lệ → `null` (UI ẩn nhãn). **Không nhập tay %.**
- Không quà tặng thêm tháng, không dùng thử.

---

## 4. Chỉ quảng cáo tính năng có thật (ADR-041 A.3) ✅

- `IMPLEMENTED_PLAN_FEATURES` (`packages/core/src/billing/feature-gate.ts`) = **`[]`** — chưa cờ nào được chặn theo gói.
- Loader bỏ mọi dòng `comparison` loại `feature` có cờ không thuộc danh sách (`withoutUnimplementedFeatureRows`); editor hiện cảnh báo
  "chưa triển khai" với cờ khác.
- Quy ước: khi gắn `assertPlanFeature` cho tính năng thật, thêm khoá vào hằng này **cùng commit**.

---

## 5. CTA theo người xem — `apps/web/lib/pricing-cms.ts` ✅

`PricingViewer` đọc ở server, chỉ gian hàng người xem **sở hữu** (`Tenant.ownerId`, ADR-022 — STAFF không quản lý gói):

| Người xem | Thẻ Free | Thẻ trả phí |
| :-- | :-- | :-- |
| `ANON` (chưa đăng nhập) | `signup` → `/register` | `choosePlan` → `/register?next=/studio` |
| `NO_TENANT` (đăng nhập, chưa có gian hàng) | `openStore` → `/studio` | `openStoreFirst` → `/studio` |
| `TENANT`, đang Free | `current` (nhãn, không nút) | `upgrade` → `/studio/{slug}/billing?plan={id}` |
| `TENANT`, đang trả phí | `freeFallback` (dòng chữ — Billing không cho chọn Free) | gói hiện tại: `current` + nút phụ `renew` (`?plan=`); gói khác: `upgrade` (giá ≥ gói hiện tại) / `switch` (giá thấp hơn) |
| `TENANT` có hoá đơn `PENDING` còn hạn | — | gói khác: `pendingInvoice` → Billing; gói hiện tại: `current` + phụ `pendingInvoice` |

CTA cuối trang: `ANON` → `signup`; `NO_TENANT` → `openStore`; `TENANT` → Billing (`upgrade` nếu Free, `renew` nếu trả phí); `ctaFinal.buttonLabel`
ghi đè nhãn (bỏ `{plan}`).

Billing Studio nhận `?plan={planId}`: chỉ gói trả phí đang bật, sai/không có → gói hiện tại ✅ (`studio/[tenantSlug]/billing/page.tsx`).

---

## 6. Editor `/admin/cms/pricing` (System Center) ✅

- Action `savePricingDraftAction` / `publishPricingAction` / `restoreLivePricingAction` — mỗi action `requireRole("SYSTEM_ADMIN")`, trả
  `PricingEditorActionState` (`issues` theo section/field). Audit `PRICING_CMS_UPDATED` (metadata chỉ `operation`). Contract:
  [[03-API-Contracts/Endpoint-Directory|Endpoint-Directory]] §21.1.
- Loader `getPricingCmsEditorData()`: bản đang soạn = nháp ?? live ?? mặc định; mọi gói kể cả đã tắt; số liệu thật hiện tại (chỉ đọc).
- Giao diện cùng pattern editor Cửa hàng (thanh trạng thái, danh sách 9 khu vực ẩn/hiện + Lên/Xuống, form theo khu vực), danh sách con
  dùng `SortableListEditor` chung, **kiểm tra phía client bằng đúng schema server + tham chiếu gói**, khung tóm tắt lỗi dẫn tới ô, cảnh báo
  rời trang khi chưa lưu. Bố cục: [[04-Operations-Runbooks/UI-Design-System|UI-Design-System]] §18.
- Menu System Center: "Trang Bảng giá" ✅.

---

## 7. Trang công khai `/pricing` ✅

- `getPricingPageData({ preview })`: bản `PUBLISHED` (hoặc mặc định); `?xem-truoc=nhap` chỉ hiệu lực với `SYSTEM_ADMIN` (kiểm ở server, không
  tin query) — đọc `blocksDraft ?? blocks`, `viewer` ép `ANON`, dải "Đang xem bản nháp", `robots: noindex, nofollow`.
- Section `visible` render đúng thứ tự CMS; section rỗng tự ẩn; số liệu = 0 ẩn; không có cổng thanh toán bật → ẩn section phương thức.
- `app/pricing/layout.tsx`: `SiteHeader current="pricing"` + `SiteFooter` + skip-link; có `loading.tsx`, `error.tsx`. Metadata: SEO CMS
  (§8) hoặc mặc định "Bảng giá | {brand}" + mô tả hero; canonical `APP_URL/pricing`.
- Thành phần `app/_ui/pricing/*`: thẻ gói + toggle Tháng/Năm (nhóm radio), bảng so sánh cuộn ngang trong khung riêng, FAQ `<details>`.
- Đổi gói ở `/admin/plans` (tạo/sửa/bật-tắt) → `revalidatePath("/pricing")` ✅.

---

## 8. SEO CMS Bảng giá ✅ (Hiếu xong 2026-10-17)

- `savePricingDraftAction(sections, seo)` / `publishPricingAction(sections, seo)` nhận `{ seoTitle, seoDescription }` — trim, tối đa
  **120 / 320** ký tự (`PRICING_SEO_TITLE_MAX`/`PRICING_SEO_DESCRIPTION_MAX`), rỗng → `null`.
- Lưu ở cột `CmsPage.seoTitle`/`seoDescription` — **không có bản nháp**: khi dòng đã `PUBLISHED`, "Lưu nháp" đổi SEO **ngay**. Trang
  `/pricing` chỉ dùng SEO khi dòng `PUBLISHED`; trống → tiêu đề mặc định "Bảng giá | {brand}" và mô tả từ hero ✅ (`app/pricing/page.tsx`).
- Build/lint/typecheck xanh 🟡 (Quốc báo).

---

## 9. Kiểm thử và giới hạn

- **Test:** không thêm (ADR-041; `pnpm test:count` = **93/94 unit, 54/55 integration** ✅ Long chạy 2026-10-17). Nợ test
  `parsePricingSections`/`validatePricingPlanRefs`/action từ chối non-admin → `docs/BACKLOG.md`.
- **Dữ liệu thật** 🟡 (Hiếu 2026-10-17): parse/mặc định pricing đạt khi gọi lib trực tiếp. Chưa kiểm qua UI có đăng nhập ❓.
- ❓ Gói trên prod đang để hạn mức `0` với ý "không giới hạn" (trước ADR-041) sẽ hiện "Không có" — xem
  [[02-System-Specs/Payment-And-Billing|Payment-And-Billing]] §5A.
- Xuất bản ở môi trường nào cũng ghi DB production (ADR-034) — `/pricing` thật đổi ngay khi code lên.

---

## 10. Liên kết

* [[02-System-Specs/Payment-And-Billing|Payment-And-Billing]] §5A (hạn mức, cờ, gói năm), §5B (hoàn tiền gói) ([Payment-And-Billing.md](./Payment-And-Billing.md))
* [[02-System-Specs/Shop-Marketplace-Specs|Shop-Marketplace-Specs]] — mẫu CMS hệ thống trước ([Shop-Marketplace-Specs.md](./Shop-Marketplace-Specs.md))
* [[02-System-Specs/Account-Profile-Specs|Account-Profile-Specs]] — thẻ "Gian hàng của bạn" dẫn sang `/pricing` ([Account-Profile-Specs.md](./Account-Profile-Specs.md))
* [[03-API-Contracts/Endpoint-Directory|Endpoint-Directory]] §21.1–§21.2 ([Endpoint-Directory.md](../03-API-Contracts/Endpoint-Directory.md))
* [[04-Operations-Runbooks/UI-Design-System|UI-Design-System]] §18 ([UI-Design-System.md](../04-Operations-Runbooks/UI-Design-System.md))
* Mã nguồn: `packages/core/src/admin/{pricing-sections,cms-slugs}.ts`, `packages/core/src/billing/{plan-limits,feature-gate}.ts`,
  `apps/web/lib/pricing-cms.ts`, `apps/web/app/pricing/`, `apps/web/app/_ui/pricing/`, `apps/web/app/admin/cms/pricing/`,
  `apps/web/app/admin/cms/_ui/sortable-list-editor.tsx`

*Quay lại: [[MOC-Home]] (../00-Index/MOC-Home.md)*

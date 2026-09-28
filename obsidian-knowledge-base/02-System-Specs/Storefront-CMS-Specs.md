---
tags:
  - spec
  - tenant
  - rls
  - security
  - status/living
date: 2026-09-26
updated: 2026-09-28
author: Long (tài liệu)
---

# 📐 Đặc Tả: Storefront CMS & Hộp Thư Liên Hệ (ADR-023)

> **Nguồn quyết định:** ADR-023 (phần header/footer tenant bị ADR-025 thay thế — §1.1) trong [`docs/DECISIONS.md`](../../docs/DECISIONS.md) — bản trích
> [[01-Architecture-Decisions/ADR-009-Storefront-Cms-Contact-Inbox|ADR-009 (KB)]]. Mức xác minh: ✅ đã đọc code
> ngày 2026-09-26 · 🟡 theo báo cáo/brief, chưa tự kiểm · ❓ cần môi trường thật (Neon, dev server, Cloudinary).
> Trạng thái chung: **code xong, chưa có test riêng** (nợ test ghi trong ADR-023 và `docs/BACKLOG.md`) — mọi hành
> vi runtime (RLS thật, email thật, upload Cloudinary thật) là ❓ cho tới khi có test/smoke-test.
> **Cập nhật ADR-029 (M10a, đọc code 2026-09-28):** thêm section `reviews` (đánh giá thật, §3.3), section `testimonials`
> đổi tên hiển thị thành "Cảm nhận" và bỏ sao, anchor `#danh-gia` chuyển sang section `reviews`. Nghiệp vụ đánh giá:
> [[02-System-Specs/Reviews-Specs|Reviews-Specs]].
> **Cập nhật ADR-029 (M10b, đọc code 2026-09-28):** thêm section `posts` ("Bài viết", bài `PUBLISHED` thật, anchor
> `#bai-viet`, §3.4). Nghiệp vụ bài viết: [[02-System-Specs/Posts-Specs|Posts-Specs]].

## 1. Phạm Vi

| Vùng | Đường dẫn | Ai dùng |
| :-- | :-- | :-- |
| Storefront công khai | `/[tenantSlug]` (`apps/web/app/[tenantSlug]/page.tsx`, `_ui/*`) | Khách vãng lai, khách hàng, chủ tenant |
| Trang chi tiết sản phẩm | `/[tenantSlug]/[productSlug]` (ADR-030 — `app/[tenantSlug]/[productSlug]/page.tsx`; URL cũ `/[tenantSlug]/products/[productSlug]` → 301, `/[tenantSlug]/products` → 404; slug dành riêng → 404; route map: [[02-System-Specs/Product-Editor-And-Publishing-Specs|Product-Editor-And-Publishing-Specs]] §7A) — **trang hệ thống** (ADR-025): header/footer + màu/font hệ thống, không gọi `getStorefrontProfile`/`resolveStorefrontSections`, chỉ nêu tên tenant ở breadcrumb | Như trên |
| Editor CMS | `/studio/[tenantSlug]/storefront` (`page.tsx`, `storefront-editor.tsx`, `actions.ts`) | Thành viên tenant (`requireTenantMemberPage` / `requireTenantMember`) |
| Hộp thư | `/studio/[tenantSlug]/messages` (`page.tsx`, `message-actions.tsx`, `actions.ts`) | Thành viên tenant |
| Logic | `packages/core/src/tenant/storefront-sections.ts`, `apps/web/lib/storefront.ts`, `apps/web/lib/storefront-messages.ts` | — |

Sidebar Studio có thêm 2 mục "Trang bán hàng" và "Hộp thư (N)" — N = số tin `NEW`, hiển thị `99+` khi > 99 ✅.

### 1.1. Ranh giới giao diện tenant (ADR-025) ✅

> Nguồn: ADR-025 trong `docs/DECISIONS.md` — bản trích
> [[01-Architecture-Decisions/ADR-011-Tenant-Owns-Storefront-Content-Only|ADR-011 (KB)]]. Đã đọc code 2026-09-26.

- Storefront `/[tenantSlug]` là trang public **duy nhất** mang giao diện tenant (màu `Tenant.branding` qua `--sf-*`,
  font Montserrat) — và chỉ trong vùng `<main class="sf-root">` chứa các section CMS.
- Header/footer của storefront là **`SiteHeader`/`SiteFooter` hệ thống**; tenant **không có** header/footer/menu
  anchor riêng. Banner READ_ONLY/LOCKED và "Nội dung mẫu" đặt ngay dưới header hệ thống.
- Trang chi tiết sản phẩm và checkout là **trang hệ thống** (không mang theme tenant); logic mua hàng M8 không đổi.
- **Mạng xã hội tenant** (`Tenant.branding.socialLinks`, qua `getStorefrontProfile` → `socialEntries`) chỉ hiện ở
  **một nơi**: hàng icon trong khối CTA của section `contact`. Section `contact` bị tắt (`visible=false`) hoặc không có →
  mạng xã hội **không hiện** ở đâu trên trang. Link mạng xã hội đầu tiên vẫn là **fallback cho nút CTA** khi
  `contact.ctaHref` trống (thứ tự: `ctaHref` → link mạng xã hội ưu tiên → `#<form>-name` nếu `formEnabled` → không
  có nút).
- `SECTION_ANCHORS` (`[tenantSlug]/_ui/primitives.tsx`) chỉ còn `{ id }` (id section); trường `label` cho menu đã xoá
  2026-09-26 vì menu tenant không còn ✅. Từ ADR-029: `reviews` → `#danh-gia` (đánh giá thật), `testimonials` → `#cam-nhan`; từ M10b: `posts` → `#bai-viet`;
  CTA cũ trỏ `#danh-gia` nay dẫn tới đánh giá thật (không có đích khi section không render) ✅.
- Chi tiết UI: [[04-Operations-Runbooks/UI-Design-System|UI-Design-System]] §1.1, §8.0, §8.4.

---

## 2. Lưu Trữ ✅

- `tenants.storefrontSections` (`Json?`) — bản **live** đã xuất bản. `null` = chưa từng xuất bản → nội dung demo.
- `tenants.storefrontSectionsDraft` (`Json?`) — bản **nháp**.
- `tenants` không có RLS (cùng cách lưu `branding`) → Server Action ghi thẳng `getPrismaClient().tenant.update`
  theo `tenant.id` lấy từ `requireTenantMember`, **không** nhận id từ client.
- Migration `20260926090000_storefront_cms_messages` (thêm 2 cột, enum, bảng `storefront_messages`) và
  `20260926090100_rls_storefront_messages` (RLS). Chi tiết bảng: [[03-API-Contracts/Database-Schema-Reference|Database-Schema-Reference]].

---

## 3. Schema Section (`packages/core/src/tenant/storefront-sections.ts`) ✅

Export qua `@gieochu/core` và subpath `@gieochu/core/storefront-sections` (file không import gì server-only, client
component editor import được).

- Mảng có thứ tự `{ id, type, visible, data }`, `min(1)`; discriminated union theo `type`.
- **Mỗi `type` tối đa 1 lần**, `id` không trùng (`superRefine`).
- 7 type (thêm `posts` từ M10b) và nội dung sửa được (nhãn editor lấy từ `STOREFRONT_SECTION_LABELS`):

| `type` | Nhãn editor | Dữ liệu chính |
| :-- | :-- | :-- |
| `hero` | Hero — Giới thiệu chính | `eyebrow?`, `title`, `highlight?` (chữ gradient dòng 2), `subtitle`, `primaryCta`/`secondaryCta` `{label, href}`, `imageUrl?` |
| `services` | Dịch vụ / Bạn nhận được gì | `title`, `subtitle?`, `items` 1–6 `{icon, title, description, imageUrl?}`; `icon` ∈ `book, slides, exam, template, coaching, video, star, chat` |
| `products` | Tài liệu nổi bật | `title`, `subtitle?`, `limit` 3–12, `featuredProductIds` (≤ 12, không trùng), `ctaLabel?` |
| `reviews` | Đánh giá (ADR-029) | `title`, `limit` 3–12, `minRating` 1–5, `requireBody`, `pinnedReviewIds` (≤ 12, không trùng) — **đọc đánh giá thật**, không nhập nội dung (§3.3) |
| `posts` | Bài viết (ADR-029 M10b) | `title`, `limit` 3–9, `showPinnedFirst` — **đọc bài `PUBLISHED` thật**, không nhập nội dung (§3.4) |
| `testimonials` | Cảm nhận (trước ADR-029: "Đánh giá từ học viên") | `title`, `items` 1–6 `{quote, name, role?, avatarUrl?, rating 1–5}` — nội dung nhập tay; `rating` vẫn **bắt buộc trong schema** (giữ dữ liệu cũ) nhưng UI **không hiển thị sao** và editor không còn ô sửa sao (mục mới thêm mặc định `rating: 5`) ✅ |
| `contact` | Liên hệ & kêu gọi hành động | `title`, `formEnabled`, `formTitle?`, `successMessage`, `ctaTitle`, `ctaSubtitle`, `ctaLabel`, `ctaHref?` (trống → link mạng xã hội ưu tiên trong `Tenant.branding.socialLinks`). Hàng icon mạng xã hội hiển thị trong khối CTA của section này (§1.1) |

- Giới hạn độ dài: tiêu đề 120, chuỗi ngắn 60, văn bản 500, URL 500. Chuỗi rỗng/chỉ khoảng trắng ở field tuỳ chọn →
  bỏ field.

### 3.1. Luật an toàn link & ảnh (áp ở schema, không chỉ ở UI) ✅

- `isSafeStorefrontHref`: chỉ `#anchor` (`^#[A-Za-z0-9_-]{0,64}$`), đường dẫn `/path` **không** bắt đầu `//`, hoặc
  URL tuyệt đối `http:`/`https:` không có username/password. Từ chối mọi ký tự khoảng trắng/điều khiển/backslash
  (chặn kiểu `/\evil.com`), và `javascript:`, `data:`, `mailto:`...
- `isCloudinaryImageUrl`: chỉ `https://res.cloudinary.com/<path>` — khớp CSP `img-src` (`'self' data: blob:
  https://res.cloudinary.com`, `apps/web/proxy.ts`). **Từ ADR-028:** khi lưu, `storefront/actions.ts` gọi thêm
  `isCloudinaryImageUrl(url, cloudName hệ thống)` — ảnh của cloud Cloudinary khác bị từ chối ✅. Hiển thị qua
  `cloudinaryDeliveryUrl` (hero 1000px, avatar/icon 200px).

### 3.2. Nội dung demo ✅

`defaultStorefrontSections({ tenantName, bio })` sinh 7 section theo thứ tự hero → services → products → **posts** (ẩn,
từ M10b) → **reviews** → testimonials → contact, chỉ dùng tên/bio của tenant (không chuỗi thương hiệu hệ thống). Section `testimonials` demo có
tiêu đề mặc định **"Cảm nhận"**. Section `reviews` demo (`defaultStorefrontReviewsSection(true)`: tiêu đề "Khách hàng đánh
giá", `limit` 6, `minRating` 4, `requireBody` true, không ghim) chỉ đọc đánh giá thật — tenant chưa có đánh giá nào thì
trang không render nó; **không có đánh giá mẫu công khai** (ADR-023 mục 3 / ADR-029).

### 3.3. Section `reviews` — đánh giá thật (ADR-029 mục 4) ✅

- Dữ liệu: `getStorefrontReviews(tenantId, data)` (`apps/web/lib/review.ts`) trong **một** `withPublic` — RLS `reviews` chỉ
  trả `VISIBLE` của sản phẩm `PUBLISHED`.
- **Thứ tự:** các id trong `pinnedReviewIds` trước, đúng thứ tự tenant chọn (id không còn hiệu lực — không `VISIBLE`, không
  thuộc tenant, sản phẩm không `PUBLISHED` — bị bỏ qua; **không** áp `minRating`/`requireBody` cho mục ghim); rồi **tự bù**
  đánh giá mới nhất có `rating ≥ minRating` (và có nội dung nếu `requireBody`) cho đủ `limit`, không trùng.
  `pinnedReviewIds` rỗng = hoàn toàn tự động.
- **Kết quả rỗng → trang không render section** (không hiện khung trống, không đánh giá mẫu).
- Mỗi thẻ: sao (màu `--sf-accent-text`) + nhãn chữ, tên hiển thị, nhãn **"Đã mua"**, ngày, tên tài liệu link tới
  `productPath(<slug>, <productSlug>)#danh-gia` = `/<slug>/<productSlug>#danh-gia` (ADR-030 ✅ `storefront-reviews.tsx`). Không hiện số đánh giá bị ẩn.
- **Editor:** ô chọn ghim lấy từ `listStorefrontReviewOptions(tenantId)` (dưới `withTenant`, ≤ 200 đánh giá `VISIBLE` của
  sản phẩm `PUBLISHED`, mới nhất trước). Danh sách section lưu **trước M10** (không có `reviews`) → khi mở editor,
  `resolveStorefrontSectionsDraft` tự chèn 1 section `reviews` **đang ẩn** (`visible:false`) trước `testimonials` (hoặc cuối
  nếu không có) để tenant tự bật; dữ liệu đã lưu không đổi cho tới khi tenant lưu nháp/xuất bản, trang công khai không bị
  ảnh hưởng.
- Khác biệt với `testimonials` ("Cảm nhận", `#cam-nhan`): nội dung nhập tay, không sao, không nhãn "Đã mua" — tránh nhầm
  với đánh giá xác thực. Dữ liệu `testimonials` cũ giữ nguyên.

### 3.4. Section `posts` — bài viết thật (ADR-029 M10b) ✅

- Dữ liệu: `getStorefrontPosts(tenantId, data)` (`apps/web/lib/post.ts`) dưới `withPublic` — RLS `posts` chỉ trả `PUBLISHED` của
  tenant không `LOCKED`. Mới đăng trước; `showPinnedFirst` = bài đang ghim (nếu `PUBLISHED`) đứng đầu; `limit` kẹp 3–9.
- **Kết quả rỗng → trang không render section** (không bài mẫu). Nút "Xem tất cả bài viết" → trang hệ thống `/[slug]/posts`.
- Mặc định `defaultStorefrontPostsSection(visible)`: tiêu đề "Bài viết mới", `limit` 3, `showPinnedFirst` true; trong nội dung
  demo luôn **ẩn**. Danh sách section lưu **trước M10b** → `withPostsSection` (trong `resolveStorefrontSectionsDraft`) tự chèn 1
  section `posts` **ẩn** ngay sau `products` (hoặc trước `reviews`, hoặc cuối); dữ liệu đã lưu không đổi cho tới khi tenant lưu.
- Chi tiết nghiệp vụ: [[02-System-Specs/Posts-Specs|Posts-Specs]] §5; giao diện: [[04-Operations-Runbooks/UI-Design-System|UI-Design-System]] §11.5.

---

## 4. Đọc & Hiển Thị Storefront (`apps/web/lib/storefront.ts`) ✅

| Hàm | Việc làm |
| :-- | :-- |
| `resolveStorefrontSections(tenant, { isOwner })` | Bản live parse hợp lệ → chỉ section `visible`, `isDemo=false`. Live `null` **hoặc JSON hỏng** (log warn) → demo, `isDemo=true`; khách (không phải owner) **không** nhận `testimonials` demo. |
| `resolveStorefrontSectionsDraft(tenant)` | Cho editor: `draft ?? live ?? default`, trả `source` (`draft`/`live`/`default`) và `live` để "Khôi phục". Từ ADR-029 tự chèn section `reviews` ẩn (§3.3) và từ M10b section `posts` ẩn (§3.4) cho dữ liệu cũ (`withMissingSections`). |
| `getStorefrontSectionProducts(tenantId, { limit, featuredProductIds })` | Trong **một** `withPublic`: lấy sản phẩm nổi bật theo đúng thứ tự chọn (id không còn PUBLISHED bị bỏ qua), bù bằng PUBLISHED mới nhất cho đủ `limit` (kẹp 1–12). |
| `getPublishedProducts(tenantId)` | Mở rộng field: `description`, `type`, `tags`, `priceVnd`, `effectivePriceVnd`, `onSale`, `coverUrl`; ADR-029 thêm `ratingAvg`, `ratingCount` vào `PublicProduct` (thẻ tài liệu hiện sao từ 1 đánh giá). Hiện trang storefront không gọi hàm này nữa (dùng hàm trên); còn dùng trong integration test. |
| `listStorefrontProductOptions(tenantId)` | Danh sách PUBLISHED (≤ 200) cho ô chọn sản phẩm nổi bật trong editor — cùng cổng `withPublic`. |
| `getStorefrontProfile(tenant)` | Từ `Tenant.branding` (parse phòng thủ từng field): `primaryColor`/`accentColor` chuẩn hoá `#rrggbb` (nhận cả `#rgb`), `socialLinks` chỉ giữ link hợp lệ (`isValidSocialLink`; Zalo dạng số điện thoại → `https://zalo.me/<số>`), `logoUrl`/`coverUrl` từ `publicBaseUrl` của storage. |

- Giá hiển thị tính ở server bằng `calculateOrderPricing` (cùng đường với trang chi tiết sản phẩm — §7.5), VND nguyên.
- `coverUrl` = `publicBaseUrl` (cấu hình ở `/admin/settings/storage`) + `coverImageKey`; `cache()` để đọc cấu hình
  storage 1 lần/request.
- **Giới hạn đã biết:** `logoUrl`/`coverUrl` của tenant thực tế luôn `null` vì chưa có luồng upload
  `Tenant.logoKey/coverKey` ✅ (comment trong code); ảnh bìa sản phẩm từ `publicBaseUrl` bị CSP chặn vì `img-src`
  chưa có host R2/MinIO ✅ (đã đọc `proxy.ts`; hiển thị thật ❓). Nút "Xem tất cả" của section products bị ẩn vì
  chưa có trang `/[tenantSlug]/products` ✅.

---

## 5. Hộp Thư — Bảng `storefront_messages` & RLS ✅

- Cột: `id` (cuid2), `tenantId` (FK `tenants`, `ON DELETE CASCADE`), `name`, `email`, `message`, `status`
  (`StorefrontMessageStatus`: `NEW` · `READ` · `ARCHIVED`, mặc định `NEW`), `ipHash?`, `createdAt`. Index
  `(tenantId, createdAt)` và `(ipHash, createdAt)`.
- **Mẫu RLS mới — policy tách theo lệnh** (khác mẫu 1 policy `tenant_isolation` của bảng L2 trước), `ENABLE` +
  `FORCE ROW LEVEL SECURITY`:

| Policy | Lệnh | Điều kiện |
| :-- | :-- | :-- |
| `public_insert` | INSERT | `app.scope = 'public'` |
| `tenant_select` | SELECT | `app.scope = 'tenant'` **và** `tenantId = app.tenant_id` |
| `tenant_update` | UPDATE | như trên (cả `USING` lẫn `WITH CHECK`) |
| `tenant_delete` | DELETE | như trên |

- **Không có nhánh `system_job`/admin** — System Admin không có đường đọc tin nhắn (§7.9). Xoá tenant → FK CASCADE.
- **Thời hạn lưu (dữ liệu cá nhân):** chủ dự án chốt 2026-09-26 **không tự xoá** — tin giữ tới khi tenant xoá tay ở
  Studio hoặc tenant bị xoá (FK cascade); xem lại khi có yêu cầu pháp lý/chính sách quyền riêng tư (ADR-023, mục Hệ quả).
- **Hệ quả bắt buộc cho code:** scope public không có SELECT nên ghi phải là INSERT **không `RETURNING`** —
  `withPublic(tx => tx.storefrontMessage.createMany(...))`. Dùng `create()` (INSERT … RETURNING) sẽ bị từ chối.
  Cũng vì thế rate limit **không** đếm bằng DB được.
- Migration có `GRANT SELECT, INSERT, UPDATE, DELETE … TO gieochu_app` idempotent (bỏ qua nếu chưa có role).
- Việc RLS chặn đúng trên Neon thật: ❓ — chưa có integration test (nợ ADR-023).

### 5.1. Hàm lib (`apps/web/lib/storefront-messages.ts`) ✅

| Hàm | Scope | Ghi chú |
| :-- | :-- | :-- |
| `createStorefrontMessage` | `withPublic` + `createMany` | Kiểm rate limit trước khi ghi |
| `listStorefrontMessages(tenantId, { filter, page })` | `withTenant` | `inbox` = NEW + READ, `archived` = ARCHIVED; mới nhất trước; 20 tin/trang |
| `countNewStorefrontMessages` | `withTenant` | Badge sidebar |
| `setStorefrontMessageStatus` / `deleteStorefrontMessage` | `withTenant` + `WHERE tenantId` | `updateMany`/`deleteMany`, count 0 → `notFound` |
| `notifyTenantOwnerOfMessage` | L1 `user` (email chủ) | Không bao giờ ném lỗi, chỉ log warn |
| `hashClientIp`, `clientIpFromHeaders` | — | Xem §6 |

---

## 6. Form Liên Hệ — `submitStorefrontContactAction` ✅

File `apps/web/app/[tenantSlug]/actions.ts`; dùng với `useActionState(submitStorefrontContactAction.bind(null, tenantSlug), null)`.
Kết quả `{ ok: true } | { error: string }`. Thứ tự xử lý:

1. **Honeypot** `website` khác rỗng → trả `{ ok: true }` giả, không lưu, không báo lỗi.
2. **zod:** `name` 1–80, `email` ≤ 200 và đúng định dạng, `message` 1–2000 (đều `trim`).
3. Tenant phải tồn tại và `resolveStorefrontAccess(tenant.status, "guest") === "ACTIVE"` (tức tenant
   `READ_ONLY`/`LOCKED` không nhận tin — đọc `packages/core/src/tenant/access-policy.ts`); section `contact` (sau
   `resolveStorefrontSections` với `isOwner:false`) phải có và `formEnabled = true` — nếu không: "Trang này hiện
   không nhận lời nhắn."
4. IP = phần tử đầu `x-forwarded-for`, fallback `x-real-ip`. **Không lưu IP thô:** `ipHash` =
   HMAC-SHA256(khoá `JWT_ACCESS_SECRET`, chuỗi `storefront-ip:<ip>`), hex.
   **Dùng chung khoá JWT là quyết định đã chấp nhận** (ADR-023 mục 5): `ipHash` chỉ để chống spam, không định danh
   lâu dài; xoay `JWT_ACCESS_SECRET` chỉ làm hash cũ mất liên kết (cửa sổ rate limit hiện tại reset) — vô hại.
   **Phải tách secret riêng** nếu `ipHash` được dùng cho mục đích khác (thống kê, chặn vĩnh viễn).
5. **Rate limit** in-memory (`apps/web/lib/rate-limit.ts`, có từ M1, 1 process): ≤ **3 tin / 10 phút theo `ipHash`**
   (tính trên mọi storefront), ≤ **50 tin / giờ theo tenant**. Vượt → `rateLimited` với thông báo thân thiện.
6. **Lưu trước** (`createStorefrontMessage`), lỗi không lường trước → log + "Chưa gửi được lời nhắn…".
7. **Email báo chủ trang sau khi trả response** qua `after()`: `renderStorefrontMessageEmail` (`@gieochu/email`), link
   hộp thư `APP_URL/studio/<slug>/messages`. Loại `storefront_message` nằm trong `TENANT_CUSTOMER_FACING_TYPES` của
   `email-dispatch.ts` → **không ghi `EmailSendLog`** (bảng System Admin đọc được — §7.9).

- CSRF: cơ chế sẵn có của Server Action (§7.7) ✅.
- Email gửi thật qua SMTP hệ thống: ❓.

---

## 7. Editor CMS — `/studio/[tenantSlug]/storefront` ✅

Server Actions (`actions.ts`), tất cả gọi `requireTenantMember(tenantSlug)` và validate lại bằng
`storefrontSectionsSchema` ở server (JSON round-trip bỏ key `undefined` trước khi lưu Json):

| Action | Ghi | Revalidate |
| :-- | :-- | :-- |
| `saveStorefrontDraftAction` | `storefrontSectionsDraft` | trang editor |
| `publishStorefrontAction` | `storefrontSections` = sections gửi lên, `storefrontSectionsDraft` = `DbNull` | editor + `/<slug>` |
| `restoreLiveStorefrontAction` | `storefrontSectionsDraft` = `DbNull` | editor |
| `getTenantCloudinaryUploadSignatureAction` | — (ký upload) | — |

### 7.1. Upload ảnh (Cloudinary hệ thống) ✅

- **Cập nhật ADR-028 (2026-09-27) ✅:** `getTenantCloudinaryUploadSignatureAction` nay gọi
  `createTenantImageUploadSignature(tenant.id, "STOREFRONT")` (`apps/web/lib/tenant-media.ts`) — kiểm hạn mức ảnh của
  gói, ký **`public_id` đầy đủ** `<uploadFolder>/tenants/<tenantId>/storefront/<24 hex>` (không còn ký `folder`),
  `allowed_formats=png,jpg,jpeg,webp`, incoming transformation ≤2000px, giữ chỗ 5MB trong `tenant_media_assets`. Sau
  upload editor gọi `registerTenantImageAction(tenantSlug, publicId, "STOREFRONT")`. Không cho SVG. Luồng đầy đủ:
  [[02-System-Specs/File-Storage-And-Downloads-Specs|File-Storage-And-Downloads-Specs]] §7. (Bản trước: ký `folder` +
  `allowed_formats` qua `createCloudinaryUploadSignature({ subfolder, allowedFormats })`.)
- `ImageUploadField` nhận thêm `getSignature`, `maxBytes`, `accept`; editor truyền `maxBytes = 2MB`,
  `accept=image/png,image/jpeg,image/webp`. Giới hạn 2MB chỉ kiểm phía client; từ ADR-028 server bù bằng incoming
  transformation ≤2000px + đọc bytes thật vào hạn mức ảnh, nhưng upload preset chặn cứng dung lượng vẫn chưa có →
  BACKLOG.
- `isSystemCloudinaryReady()` → editor hiện thông báo "tải ảnh chưa sẵn sàng" thay vì đợi upload lỗi.

### 7.2. Hộp thư — `/studio/[tenantSlug]/messages` ✅

- Tab `inbox`/`archived` (`?tab=archived`), phân trang `?page=`, `mailto:` người gửi, `EmptyState` khi trống.
- `updateMessageStatusAction(slug, id, op)`: `op` ∈ `read→READ`, `unread→NEW`, `archive→ARCHIVED`,
  `unarchive→READ`; `deleteMessageAction` (xác nhận `window.confirm`, xoá vĩnh viễn). Cả hai `requireTenantMember`,
  `revalidatePath('/studio/<slug>', 'layout')` để cập nhật badge sidebar.

---

## 8. Chưa Xác Minh / Nợ

| Nội dung | Mức |
| :-- | :-- |
| Test schema section, quyền sửa, RLS `storefront_messages` — chưa có (ngân sách `test:count` 88/91 · 46/50 giữ nguyên, đã chạy `pnpm test:count` 2026-09-26) | ✅ (đã xác nhận chưa có) |
| RLS chặn đúng trên Neon thật (public không đọc được, tenant khác không đọc được) | ❓ |
| Email báo chủ trang gửi thật; lỗi SMTP không làm mất tin | ❓ |
| Upload Cloudinary thật với `allowed_formats` trong chữ ký | ❓ |
| Rate limit chỉ đúng khi chạy 1 instance | ✅ (đọc code) |
| Section `reviews` hiển thị thật với dữ liệu đánh giá thật (đã có script demo dev `demo:seed` — [[04-Operations-Runbooks/Dev-Demo-Data-Runbook|Dev-Demo-Data-Runbook]]; chưa ai báo kết quả chạy) | ❓ |
| Section `posts` hiển thị thật với bài viết thật (script demo không tạo bài viết) | ❓ |

## 9. Liên Kết

* [[MOC-Home]] ([MOC-Home.md](../00-Index/MOC-Home.md)) · [[02-System-Specs/README|02-System-Specs]] ([README.md](./README.md))
* [[01-Architecture-Decisions/ADR-009-Storefront-Cms-Contact-Inbox|ADR-009 (≙ ADR-023)]] ([ADR-009-Storefront-Cms-Contact-Inbox.md](../01-Architecture-Decisions/ADR-009-Storefront-Cms-Contact-Inbox.md))
* [[01-Architecture-Decisions/ADR-011-Tenant-Owns-Storefront-Content-Only|ADR-011 (≙ ADR-025)]] ([ADR-011-Tenant-Owns-Storefront-Content-Only.md](../01-Architecture-Decisions/ADR-011-Tenant-Owns-Storefront-Content-Only.md))
* [[03-API-Contracts/Database-Schema-Reference|Database-Schema-Reference]] ([Database-Schema-Reference.md](../03-API-Contracts/Database-Schema-Reference.md))
* [[04-Operations-Runbooks/UI-Design-System|UI-Design-System]] §8 — theme/primitives/pattern UI storefront ([UI-Design-System.md](../04-Operations-Runbooks/UI-Design-System.md))
* [[Architecture-Overview]] §3 — 4 scope RLS ([Architecture-Overview.md](./Architecture-Overview.md))
* [[02-System-Specs/Reviews-Specs|Reviews-Specs]] — đánh giá M10a ([Reviews-Specs.md](./Reviews-Specs.md))

*Quay lại: [[MOC-Home]]*

---
tags:
  - spec
  - posts
  - tenant
  - rls
  - security
  - status/living
date: 2026-09-28
author: Long (tài liệu)
---

# 📐 Đặc Tả: Bài Viết Tối Giản Của Tenant (M10b — ADR-029)

> **Nguồn quyết định:** ADR-029 mục 5, 6 và mục "Bổ sung ADR-029 M10b theo triển khai" (Quốc chốt 2026-09-28) trong
> [`docs/DECISIONS.md`](../../docs/DECISIONS.md) — bản trích
> [[01-Architecture-Decisions/ADR-015-M10-Reviews-Posts-Rls-Split-Writes|ADR-015 (KB)]]. Kế hoạch gốc:
> [`docs/ke-hoach-M10-social-feed-danh-gia-2026-09-27.md`](../../docs/ke-hoach-M10-social-feed-danh-gia-2026-09-27.md).
> Mức xác minh: ✅ đã đọc code/migration ngày 2026-09-28 · 🟡 theo báo cáo/brief, chưa tự kiểm · ❓ cần môi trường thật.
> **Trạng thái chung:** code xong, **chưa có test** (chủ dự án chọn chưa thêm test — nợ trong `docs/BACKLOG.md`); verify
> thủ công theo báo cáo 🟡. Mọi hành vi runtime (RLS/trigger trên Neon thật, upload ảnh Cloudinary thật) là ❓ cho tới khi có
> test.

## 1. Phạm Vi

M10 giai đoạn 1: **M10a Đánh giá** ([[02-System-Specs/Reviews-Specs|Reviews-Specs]]) → **M10b Bài viết tối giản** (trang
này) — cả hai xong code. **M10c** (bình luận, thả tim, theo dõi) ở BACKLOG; nút "Báo cáo vi phạm" đợi M12; **không có feed
xuyên tenant**; **không giới hạn số bài theo gói** (ADR-029 mục 5).

| Vùng | Đường dẫn | Ai dùng |
| :-- | :-- | :-- |
| Studio → Bài viết (danh sách) | `/studio/[tenantSlug]/posts` (`?status=`, `?cursor=`) | Thành viên tenant (`requireTenantMemberPage`) |
| Studio → Viết bài / Sửa bài | `/studio/[tenantSlug]/posts/new`, `/studio/[tenantSlug]/posts/[postId]` | Thành viên tenant |
| Trang hệ thống danh sách bài (ADR-025) | `/[tenantSlug]/posts` (`?cursor=`) | Công khai |
| Trang hệ thống chi tiết bài | `/[tenantSlug]/posts/[postId]` | Công khai |
| Section storefront `posts` | `/[tenantSlug]` (anchor `#bai-viet`) | Công khai |
| Logic | `apps/web/lib/post.ts`; logic thuần `packages/core/src/content/post.ts` (subpath `@gieochu/core/post`) | — |

**System Admin không có route/hàm nào đọc bài viết** (§7.9) ✅ — không có nhánh admin trong RLS, không có hàm admin trong
`lib/post.ts`. **Không có `authorId`** ở GĐ1 (bài thuộc tenant, không gắn người viết) ✅ (schema).

---

## 2. Quy Tắc Nghiệp Vụ ✅

| Quy tắc | Chi tiết | Nguồn code |
| :-- | :-- | :-- |
| Trạng thái | `DRAFT` · `PUBLISHED` · `HIDDEN`. Tenant chỉ chuyển **DRAFT ⇄ PUBLISHED** (Đăng bài / Gỡ bài về nháp). `HIDDEN` (vi phạm) **chỉ `system_job` đặt/gỡ** — hiện chưa có luồng nào đặt (M12) | `TenantPostStatus`, trigger `posts_guard_columns`, RLS `tenant_insert` |
| Bài `HIDDEN` | Tenant **chỉ xem và xoá**: sửa/đăng lại/ghim → `POST_HIDDEN_LOCKED` (403) trả sớm ở app; trigger là lớp thứ hai | `updatePost`, `setPostPinned` |
| Tiêu đề | **Tuỳ chọn**, 1 dòng: NFC, bỏ ký tự điều khiển/ẩn, gộp khoảng trắng, trim; rỗng → `null`; > **200** ký tự (code point) → `POST_TITLE_INVALID` (không tự cắt). CHECK `posts_title_length` (NULL hoặc 1–200) | `normalizePostTitle` |
| Nội dung | HTML từ Tiptap, **sanitize khi lưu** bằng `sanitizeRichTextHtml` theo cloud Cloudinary **hệ thống** (ảnh ngoài cloud hệ thống bị loại — ADR-028), và **sanitize lại khi render** (trang chi tiết, xem bài HIDDEN trong Studio). Bắt buộc có chữ **hoặc ≥ 1 ảnh** → nếu không: `POST_BODY_REQUIRED`. Trần 100 000 ký tự HTML → `POST_BODY_TOO_LONG` (CHECK `posts_body_length` 1–100 000) | `preparePostBody` |
| Ảnh | **≤ 6 ảnh/bài** — đếm `<img>` **sau** sanitize; vượt → `POST_TOO_MANY_IMAGES` (400). Upload qua Cloudinary hệ thống, usage **`POST`**, thư mục `tenants/<tenantId>/posts`, **tính vào hạn mức ảnh của gói** (ADR-028, `IMAGE_QUOTA_EXCEEDED`) | `POST_MAX_IMAGES`, `tenant-media.ts` |
| Trích đoạn | `excerpt` văn bản thuần **≤ 300** ký tự **tự sinh** từ nội dung khi lưu (cắt ở ranh giới từ khi được, thêm "…"); bài chỉ có ảnh → `""`. CHECK `posts_excerpt_length` | `buildPostExcerpt`, `htmlToPlainText` |
| Gắn tài liệu | Tối đa **1 sản phẩm** (`productId`), phải **cùng tenant** và **chưa `ARCHIVED`** lúc gắn → sai: `POST_PRODUCT_INVALID`. Chỉ kiểm lại khi **đổi** sản phẩm (bài cũ gắn sản phẩm đã lưu trữ vẫn sửa được nội dung). Xoá sản phẩm → `productId` SET NULL. Trang công khai **chỉ hiện thẻ tài liệu khi sản phẩm `PUBLISHED`**; thẻ link tới `productPath(tenantSlug, product.slug)` = `/{tenantSlug}/{productSlug}` (ADR-030 ✅ `post-parts.tsx`, `storefront-posts.tsx`) | `assertAttachableProduct`, trigger `posts_guard_product_tenant`, `getPublicProductsByIds` |
| Ghim | Tối đa **1 bài ghim / tenant** — partial unique index `posts_tenantId_pinned_key` (`WHERE "isPinned"`). Ghim bài mới tự bỏ ghim bài cũ **trong cùng transaction**; đua ghim → `POST_PIN_CONFLICT` (409). Ghim được bài **mọi trạng thái trừ `HIDDEN`**; công khai chỉ thấy bài ghim khi bài đó `PUBLISHED` | `setPostPinned` |
| `publishedAt` | Đặt ở **lần đăng đầu tiên**, giữ nguyên khi gỡ về nháp rồi đăng lại. CHECK `posts_published_at_shape`: `PUBLISHED` ⇒ `publishedAt` NOT NULL | `createPost`, `updatePost` |
| Tenant `READ_ONLY` / `LOCKED` | **Không tạo/sửa/xoá/ghim** bài (giống sản phẩm) — `assertTenantCanWrite` → `FORBIDDEN` khi `status ≠ ACTIVE`. Trang công khai: `LOCKED` → 404 (RLS public + `resolveStorefrontAccess`); `READ_ONLY` vẫn hiển thị bài đã đăng | `requireWritableTenant`, RLS `select_access` |
| Thứ tự Studio | Bài ghim trước, rồi mới **tạo** trước; 20 bài/trang, cursor = id mục cuối | `listTenantPosts` |
| Thứ tự công khai | Mới **đăng** trước (`publishedAt desc`); trang `/posts` đặt bài ghim đầu trang 1 (luồng còn lại bỏ bài ghim để không trùng); 12 bài/trang (tối đa 30) | `listPublishedPosts` |

### 2.1. Tiêu đề hiển thị khi bài không có tiêu đề ✅

- `postDisplayTitle` (`lib/post.ts`): tiêu đề bài → nếu không có, ~60 ký tự đầu của trích đoạn (cắt, thêm "…") → nếu vẫn rỗng
  (bài chỉ có ảnh), "Bài viết". Dùng cho metadata/tiêu đề trang.
- Thẻ bài (danh sách/section) dùng `postCardText` (`[tenantSlug]/_ui/post-parts.tsx`): không tiêu đề → trích đoạn **là**
  heading của thẻ, không lặp lại đoạn đầu 2 lần.

---

## 3. Dữ Liệu & RLS ✅ (đọc migration)

Bảng L2 `posts` — cột/CHECK/index ở [[03-API-Contracts/Database-Schema-Reference|Database-Schema-Reference]] §3.2 + §7.
Migration: `20260928090000_m10b_posts`, `20260928090100_rls_m10b_posts`.

| Policy | Lệnh | Ai |
| :-- | :-- | :-- |
| `select_access` | SELECT | tenant (`app.scope='tenant'` + đúng `tenantId`) · public (`PUBLISHED` **và** tenant không `LOCKED` — subquery bảng `tenants`, bảng này không bật RLS) · `system_job` |
| `tenant_insert` | INSERT | tenant, đúng `tenantId`, **không** tạo bài `HIDDEN` / có `hiddenReason` |
| `system_job_insert` | INSERT | `system_job` |
| `tenant_update` | UPDATE | tenant, đúng `tenantId` (cả `USING` lẫn `WITH CHECK`) |
| `system_job_update` | UPDATE | `system_job` |
| `tenant_delete` | DELETE | tenant, đúng `tenantId` |
| `system_job_delete` | DELETE | `system_job` |

- **Không nhánh customer, không nhánh admin** (§7.9). Policy tách theo lệnh đúng quy tắc ADR-029 mục 0 (bảng có nhánh
  public không dùng `FOR ALL`).
- **Trigger `posts_guard_product_tenant`** (BEFORE INSERT / UPDATE OF `productId`, `tenantId`): `productId` phải là sản phẩm
  **cùng tenant**; subquery chạy dưới RLS của người gọi nên scope tenant không thấy sản phẩm tenant khác → luôn bị từ chối.
- **Trigger `posts_guard_columns`** (BEFORE UPDATE): ngoài `system_job`, không ai đổi `id/tenantId/createdAt`, không ai
  đặt/gỡ `HIDDEN` hay sửa `hiddenReason` (mẫu "trigger giới hạn cột theo scope" từ `reviews_guard_columns`, vì mọi scope chung
  role `gieochu_app`).
- App dịch lỗi RLS/trigger (SQLSTATE 42501, "row-level security", "posts: ") thành `POST_PRODUCT_INVALID` ✅ (đọc code).
- ⚠️ **Partial unique index `posts_tenantId_pinned_key` chỉ có trong SQL migration** — Prisma schema không biểu diễn được
  (ghi chú trên model `Post`). Chạy `prisma migrate dev` có thể sinh migration "drift" đề nghị xoá index này; **đọc kỹ SQL sinh
  ra trước khi áp**, không để mất index (ADR-029 bổ sung M10b).

---

## 4. Trang Công Khai (trang hệ thống ADR-025) ✅

- `/[tenantSlug]/posts`: header/footer + màu/font **hệ thống** (không theme tenant), khung `container-page`; truy cập theo
  `resolveStorefrontAccess` như storefront (`NOT_FOUND` → 404); dữ liệu `listPublishedPosts` dưới `withPublic`. Rỗng → trạng
  thái trống; phân trang `?cursor=` (id bài không ghim cuối trang trước; cursor sai dạng bị bỏ qua).
- `/[tenantSlug]/posts/[postId]`: khung `container-prose`; `getPublishedPost` → `null` khi không có / không `PUBLISHED` /
  tenant `LOCKED` → `notFound()`. `bodyHtml` sanitize lại lúc render (ảnh viết lại qua `cloudinaryDeliveryUrl` rộng 1536).
  `generateMetadata` dùng `getPublishedPostMeta` (không đọc body). Thẻ "Tài liệu liên quan" dưới bài khi sản phẩm gắn còn
  `PUBLISHED` (giá/ảnh bìa hiệu lực tính ở server).
- Ảnh minh hoạ thẻ bài = ảnh Cloudinary hệ thống **hợp lệ đầu tiên** trong nội dung (`firstRichTextImageSrc(body, accept)`,
  rộng 640; Studio dùng rộng 320), không có → khối minh hoạ nhạt.

### 4.1. Quy tắc chung: sanitize lại khi render HTML đã lưu ✅

Mọi chỗ render HTML đã lưu bằng `dangerouslySetInnerHTML` **phải sanitize lại lúc render** (`sanitizeRichTextHtml` theo cloud
hệ thống) — không tin HTML trong DB dù đã sanitize lúc lưu (lớp phòng thủ thứ hai). Hiện có **3 chỗ** (đối chiếu 2026-09-28):

| Chỗ render | Nguồn HTML |
| :-- | :-- |
| Xem bài `HIDDEN` trong Studio (`posts/_ui/post-editor.tsx`) | `getPostForEditor` → `post.bodyHtml` |
| Chi tiết bài công khai (`[tenantSlug]/posts/[postId]/page.tsx`) | `getPublishedPost` → `bodyHtml` |
| Mô tả sản phẩm (`[tenantSlug]/_ui/product-detail.tsx`) | `prepareDescription` → `sanitizeRichTextHtml` |

Nạp HTML vào Tiptap (`content`, vd `post.body` trong editor) **không cần** sanitize lại vì Tiptap parse theo schema của nó.
- Chi tiết giao diện: [[04-Operations-Runbooks/UI-Design-System|UI-Design-System]] §11.

## 5. Section Storefront `posts` ✅

- Schema (`packages/core/src/tenant/storefront-sections.ts`): `data = { title, limit (3–9), showPinnedFirst }`; nhãn editor
  "Bài viết"; anchor `#bai-viet` (`SECTION_ANCHORS`).
- Dữ liệu `getStorefrontPosts(tenantId, data)` — bài `PUBLISHED`, mới đăng trước; `showPinnedFirst` = bài đang ghim (nếu
  `PUBLISHED`) đứng đầu. **Rỗng → trang không render section** (không bài mẫu). Nút "Xem tất cả bài viết" → `/[slug]/posts`.
- Mặc định `defaultStorefrontPostsSection(false)`: tiêu đề "Bài viết mới", `limit` 3, `showPinnedFirst` true, **đang ẩn**.
  Nội dung demo của tenant mới có section này ở trạng thái ẩn. Danh sách section lưu **trước M10b** → khi mở editor,
  `withPostsSection` (`lib/storefront.ts`) tự chèn 1 section `posts` **ẩn** (ngay sau `products`, hoặc trước `reviews`, hoặc
  cuối) để tenant tự bật; dữ liệu đã lưu không đổi cho tới khi tenant lưu nháp/xuất bản.
- Xem thêm [[02-System-Specs/Storefront-CMS-Specs|Storefront-CMS-Specs]] §3.

## 6. Studio → Bài Viết ✅

- Mọi Server Action lấy `tenant.id` từ `requireTenantMember` (không từ client), ghi qua `withTenant` + `WHERE tenantId`; CSRF
  theo cơ chế Server Action (§7.7). Contract: [[03-API-Contracts/Endpoint-Directory|Endpoint-Directory]] §13.
- Sidebar Studio có mục **"Bài viết"** ngay sau "Sản phẩm" (tổng 11 mục).
- Revalidate sau mỗi thao tác ghi: `/studio/<slug>/posts` (+ trang bài), `/<slug>`, `/<slug>/posts` (+ trang bài).
- Chi tiết giao diện editor/danh sách: [[04-Operations-Runbooks/UI-Design-System|UI-Design-System]] §11.

---

## 7. Chưa Xác Minh / Nợ

| Nội dung | Mức |
| :-- | :-- |
| Không có test (unit/integration) cho bài viết, RLS `posts`, trigger, sanitize/đếm ảnh, feed công khai | ✅ (đã xác nhận: `pnpm test:count` 2026-09-28 = 93/94 unit, 52/53 integration — không đổi) |
| RLS `posts` + 2 trigger chặn đúng trên Neon thật (public không thấy DRAFT/HIDDEN/tenant LOCKED; tenant không đặt HIDDEN; không gắn sản phẩm tenant khác) | ❓ |
| Verify thủ công M10b (theo brief: "verify thủ công") | 🟡 (Long chưa tự chạy) |
| Upload ảnh bài viết lên Cloudinary thật + tính hạn mức | ❓ |
| `prisma migrate dev` không làm mất partial unique index | ❓ (cảnh báo theo ADR, chưa thử) |
| Báo cáo vi phạm / luồng đặt `HIDDEN` (M12), audit log | ✅ (chưa có) |

## 8. Liên Kết

* [[MOC-Home]] ([MOC-Home.md](../00-Index/MOC-Home.md)) · [[02-System-Specs/README|02-System-Specs]] ([README.md](./README.md))
* [[01-Architecture-Decisions/ADR-015-M10-Reviews-Posts-Rls-Split-Writes|ADR-015 (≙ ADR-029)]] ([ADR-015-M10-Reviews-Posts-Rls-Split-Writes.md](../01-Architecture-Decisions/ADR-015-M10-Reviews-Posts-Rls-Split-Writes.md))
* [[03-API-Contracts/Database-Schema-Reference|Database-Schema-Reference]] ([Database-Schema-Reference.md](../03-API-Contracts/Database-Schema-Reference.md)) — bảng `posts`, RLS, trigger
* [[03-API-Contracts/Endpoint-Directory|Endpoint-Directory]] §13 ([Endpoint-Directory.md](../03-API-Contracts/Endpoint-Directory.md)) — contract hàm/action
* [[02-System-Specs/Storefront-CMS-Specs|Storefront-CMS-Specs]] ([Storefront-CMS-Specs.md](./Storefront-CMS-Specs.md)) — section `posts`
* [[02-System-Specs/File-Storage-And-Downloads-Specs|File-Storage-And-Downloads-Specs]] §7 ([File-Storage-And-Downloads-Specs.md](./File-Storage-And-Downloads-Specs.md)) — ảnh Cloudinary + hạn mức
* [[04-Operations-Runbooks/UI-Design-System|UI-Design-System]] §11 ([UI-Design-System.md](../04-Operations-Runbooks/UI-Design-System.md))

*Quay lại: [[MOC-Home]] (../00-Index/MOC-Home.md)*

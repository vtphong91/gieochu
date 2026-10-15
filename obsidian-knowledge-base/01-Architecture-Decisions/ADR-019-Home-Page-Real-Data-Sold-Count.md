---
tags:
  - adr
  - product
  - order
  - rls
  - system-admin
  - ui-ux
  - status/accepted
date: 2026-10-15
decider: vtphong91
status: Accepted (Chốt — Áp dụng chính thức)
---

# 🏛️ ADR-019: Trang Chủ Hệ Thống Dùng Dữ Liệu Thật (Số Liệu, Danh Mục, Giáo Viên, Tài Liệu Nổi Bật, Số Đã Bán)

## 1. Trạng Thái (Status)
**ĐÃ PHÊ DUYỆT (Accepted)** — tương ứng **ADR-033** trong [`docs/DECISIONS.md`](../../docs/DECISIONS.md) (chủ dự án chốt
2026-09-29), gồm mục **"Bổ sung ADR-033 theo triển khai (2026-10-15, Quốc chốt)"**. **Đã xong code** (working tree chưa commit
tại 2026-10-15). Mục "Sự cố 2026-10-15" ghi cuối ADR-033 thuộc ADR-032 — xem
[[01-Architecture-Decisions/ADR-018-System-Settings-And-Brand-From-System-Center|ADR-018 (≙ ADR-032)]] §5.

Mức xác minh: ✅ Long đã đối chiếu code/migration (2026-10-15) · 🟡 theo `docs/DECISIONS.md`/brief của Quốc · ❓ cần môi
trường thật.

---

## 2. Bối Cảnh (Context)
Các section trang chủ (`CmsPage` slug `home`, `homeSectionsSchema`) là dữ liệu nhập tay/mockup. Chủ dự án chốt: dùng dữ liệu
thật; nổi bật = **admin ghim + tự bù**; **hiển thị số đã bán thật** của tài liệu và tenant, chưa bán thì không hiển thị; số liệu
nổi bật là số thật, bằng 0 thì ẩn ô đó 🟡.

---

## 3. Quyết Định (Decision)
1. **Số đã bán** = số lượt mua đã hoàn tất, lưu cột cache `products.soldCount`; trang chủ/public chỉ đọc cột cache, **không**
   truy vấn `orders` (giữ §7.9). `soldCount = 0` → không hiển thị "đã bán". Số đã bán của tenant = tổng `soldCount` các tài
   liệu Công khai.
2. **Số liệu nổi bật** (thay nhập tay): tenant đang hoạt động có ≥1 tài liệu Công khai, số tài liệu Công khai, tổng lượt mua,
   số đánh giá hiển thị. Ô = 0 ẩn; cả section rỗng không render. Nhãn sửa được trong CMS.
3. **Tìm tài liệu:** chip lấy từ danh mục đang hoạt động có ≥1 tài liệu Công khai; admin sửa tiêu đề/placeholder.
4. **Giáo viên & Coach nổi bật / Tài liệu nổi bật:** CMS lưu `title/subtitle`, `limit`, `pinnedTenantIds`/`pinnedProductIds`;
   ghim trước (bỏ id không còn hợp lệ), rồi tự bù.
5. **Giữ nhập tay:** Hero, Vì sao chọn, Mở gian hàng, **Cảm nhận người dùng** (về nền tảng), CTA cuối.
6. Dữ liệu nhập tay cũ của 4 section chuyển sang thật được bỏ qua khi render (parse phòng thủ).

**Bổ sung theo triển khai (2026-10-15):** "Công khai" trên trang chủ = tài liệu `PUBLISHED` **và** tenant `ACTIVE`; số đánh giá =
review `VISIBLE` trên tài liệu Công khai; tự bù theo: có đánh giá → điểm TB giảm dần → số đánh giá → mới nhất (tenant: ngày
tạo); dòng đơn FULFILLED thiếu entitlement vẫn tính đã bán; tính lại `soldCount` sau commit ở mọi đường đổi trạng thái
đơn/entitlement; chưa có job đối soát định kỳ.

---

## 4. Hệ Quả & Ràng Buộc Kỹ Thuật (Consequences & Rules)

### 4.1. `products.soldCount` ✅
* **Định nghĩa** (khớp code + migration): số `order_items` của đơn `status = 'FULFILLED'` mà **không** tồn tại entitlement của
  dòng đó có `revokedAt IS NOT NULL`. Hệ quả: đơn `REFUNDED` không còn là FULFILLED → không tính; thu hồi entitlement lẻ chỉ loại
  đúng dòng đó; dòng FULFILLED **thiếu** entitlement vẫn tính (đúng "Bổ sung").
* **Migration** `20260929120000_adr033_product_sold_count`: `ADD COLUMN "soldCount" INTEGER NOT NULL DEFAULT 0`; CHECK
  `products_sold_count_nonnegative` (`"soldCount" >= 0`, chỉ có trong SQL — Prisma không biểu diễn); backfill bằng cùng công
  thức, không chạm `updatedAt`. Theo `docs/DECISIONS.md` đã áp lên DB dùng chung (chỉ thêm cột — an toàn với bản đang deploy)
  🟡. File migration chưa commit (untracked) ✅.
* **`recomputeProductSoldCounts(productIds)`** (`apps/web/lib/product-sold-count.ts`): tính lại **toàn phần** (COUNT, idempotent)
  theo từng sản phẩm, trong `withSystemJob` (chỉ tenant/`system_job` được ghi `products`, ADR-029), `pg_advisory_xact_lock`
  theo sản phẩm, raw SQL không chạm `updatedAt`. Caller gọi **sau khi** transaction đổi trạng thái đã commit; lỗi chỉ log.
* **6 đường gọi** (đã grep):

  | Đường | File |
  | :-- | :-- |
  | `createOrder` (đơn 0đ hoàn tất ngay) | `apps/web/lib/order.ts` |
  | `applyCouponToOrder` (coupon đưa đơn về 0đ) | `apps/web/lib/order.ts` |
  | `confirmOrderManually` | `apps/web/lib/order.ts` |
  | `markOrderRefunded` | `apps/web/lib/order.ts` |
  | `processPaymentEvent` (job `payment.process`) | `apps/web/lib/payment-process.ts` |
  | `revokeEntitlement` | `apps/web/lib/entitlement.ts` |

* **`markOrderPaid(tx, orderId, source)`** nay trả `{ fulfilled: boolean, productIds: string[] }` — `productIds` là sản phẩm
  (khử trùng) của đơn vừa FULFILLED, rỗng khi no-op; caller dùng để gọi `recomputeProductSoldCounts`.
* **`PublicProduct.soldCount`** (`apps/web/lib/storefront.ts`) — có trong select công khai; hiện **chỉ trang chủ** hiển thị
  "Đã bán" (thẻ storefront tenant chưa render trường này) ✅.

### 4.2. Schema CMS trang chủ (`@gieochu/core/home-sections` → `packages/core/src/admin/home-sections.ts`) ✅
* 9 loại section: `hero`, `stats`, `search`, `benefits`, `coaches`, `documents`, `becomeSeller`, `testimonials`, `finalCta`.
  4 section dữ liệu thật:

  | Section | `data` lưu trong CMS |
  | :-- | :-- |
  | `stats` — "Số liệu nổi bật" | `metrics.{tenants,products,sold,reviews}` = `{ label (1–60), enabled }` — thứ tự cố định `HOME_STAT_KEYS` |
  | `search` — "Tìm tài liệu" | `title`, `subtitle`, `placeholder` |
  | `coaches` — "Giáo viên & Coach nổi bật" | `title`, `subtitle`, `limit` (3–12, mặc định 4), `pinnedTenantIds` (≤ 12, không trùng) |
  | `documents` — "Tài liệu nổi bật" | `title`, `subtitle`, `limit` (3–12, mặc định 6), `pinnedProductIds` (≤ 12, không trùng) |

* Nhãn section `testimonials` đổi thành **"Cảm nhận người dùng"** (`HOME_SECTION_LABELS`; editor ghi "Cảm nhận người dùng
  (nhập tay, về nền tảng)").
* **`parseHomeSections(input)`** — đọc an toàn khi render và khi nạp editor (lúc **lưu** vẫn validate chặt bằng
  `homeSectionsSchema`): 4 section trên được chuẩn hoá (field mới thiếu/sai → mặc định, field nhập tay cũ như `items`/`chips` bị
  bỏ); section khác không hợp lệ → bỏ riêng section đó; trùng `id` → giữ section đầu; đầu vào không phải mảng → `null`.

### 4.3. Loader `apps/web/lib/home.ts` ✅
* "Công khai" = `PUBLIC_PRODUCT_WHERE = { status: "PUBLISHED", tenant: { status: "ACTIVE" } }`.
* Mọi truy vấn trong `withPublic` (RLS `products`/`reviews` là cổng thật); **không** đọc `orders/order_items/entitlements`.
* `getHomeStats()`: `tenants` (ACTIVE có ≥1 PUBLISHED), `products`, `sold` (tổng `soldCount`), `reviews` (VISIBLE trên tài liệu
  Công khai). `buildHomeStatItems` giữ ô **bật và > 0**; rỗng → trang chủ không render section.
* `getHomeSearchCategories()`: danh mục `isActive` có ≥1 tài liệu Công khai, nhiều tài liệu trước rồi theo tên (`vi`). Section
  "Tìm tài liệu" vẫn render khi không có danh mục (chỉ ẩn khối chip).
* `getHomeFeaturedTenants` / `getHomeFeaturedProducts`: `limit` kẹp 3–12; ghim trước đúng thứ tự (bỏ id không còn hợp lệ),
  bù bằng SQL sắp xếp: có đánh giá → `ratingSum/ratingCount` giảm dần → `ratingCount` → `createdAt` mới nhất → `id`. Rỗng →
  không render section. Thẻ giáo viên: logo tối ưu Cloudinary (rộng 160), số tài liệu, điểm TB, số đánh giá, `soldCount`,
  `href = /{slug}`; thẻ tài liệu: dữ liệu `PublicProduct` + tenant + `href = productPath(...)`.
* Trang `app/page.tsx` gọi `getHomeStats`/`getHomeSearchCategories` tối đa 1 lần/request (`once`).

### 4.4. Ô chọn ghim cho editor CMS (System Admin) ✅
* Server Actions `searchHomeTenantOptionsAction(search, includeIds)` và `searchHomeProductOptionsAction(search, includeIds)`
  (`apps/web/app/admin/cms/home-editor/actions.ts`) — `requireRole("SYSTEM_ADMIN")`; `includeIds` lọc chuỗi 1–64 ký tự, tối đa 12.
* `listHomeTenantOptions` / `listHomeProductOptions`: tối đa 200 lựa chọn (`HOME_PIN_OPTIONS_MAX`), lọc theo tên không phân biệt
  hoa thường (cắt 100 ký tự); id đang ghim luôn trả kèm — tenant có cờ `eligible:false` khi không còn hợp lệ; tài liệu không còn
  Công khai thì **không** trả (RLS public không cho đọc bản nháp — admin không xem tài liệu riêng tư của tenant, §7.9).
* Trang `/admin/cms/[slug]` nạp sẵn lựa chọn cho các id đang ghim.

### 4.5. Ràng buộc cho code sau
* Trang chủ/public **không** đọc `orders`; mọi số "đã bán" lấy từ `products.soldCount`.
* Thêm đường đổi trạng thái đơn/entitlement mới ⇒ phải gọi `recomputeProductSoldCounts` sau commit.
* Đổi `soldCount` phải giữ công thức trùng giữa migration backfill và `product-sold-count.ts`.

---

## 5. Chưa Verify / Còn Mở
* Chưa có job đối soát định kỳ `soldCount` (BACKLOG) — cache sai sau lỗi recompute chỉ tự sửa khi sản phẩm có thay đổi kế tiếp ✅.
* Hiển thị trang chủ với dữ liệu thật trên production; hiệu năng 2 truy vấn SQL bù ghim ❓.
* Chip/ô tìm/"Tìm kiếm" chưa dẫn đi đâu — chưa có trang tìm kiếm/danh mục công khai (BACKLOG) ✅.
* Không có test tự động mới (`pnpm test:count` 2026-10-15 = 93/94 unit, 52/53 integration) ✅.

---

## 6. Tài Liệu Tham Chiếu & Liên Kết
* [[MOC-Home]] — Trang chủ Map of Content ([MOC-Home.md](../00-Index/MOC-Home.md))
* Tương ứng **ADR-033** trong [`docs/DECISIONS.md`](../../docs/DECISIONS.md) (gốc repo).
* [[01-Architecture-Decisions/ADR-015-M10-Reviews-Posts-Rls-Split-Writes|ADR-015 (≙ ADR-029)]] — mẫu cache `ratingSum/ratingCount`, quyền ghi `products` ([ADR-015-M10-Reviews-Posts-Rls-Split-Writes.md](./ADR-015-M10-Reviews-Posts-Rls-Split-Writes.md))
* [[01-Architecture-Decisions/ADR-016-Short-Product-Url-No-Sticky-Publish-Card|ADR-016 (≙ ADR-030)]] — `productPath` ([ADR-016-Short-Product-Url-No-Sticky-Publish-Card.md](./ADR-016-Short-Product-Url-No-Sticky-Publish-Card.md))
* [[04-Operations-Runbooks/UI-Design-System|UI-Design-System]] §12 — giao diện trang chủ + PinPicker ([UI-Design-System.md](../04-Operations-Runbooks/UI-Design-System.md))
* [[03-API-Contracts/Endpoint-Directory|Endpoint-Directory]] §14 ([Endpoint-Directory.md](../03-API-Contracts/Endpoint-Directory.md))
* [[02-System-Specs/Order-State-Machine|Order-State-Machine]] ([Order-State-Machine.md](../02-System-Specs/Order-State-Machine.md))

*Quay lại: [[MOC-Home]] (../00-Index/MOC-Home.md)*

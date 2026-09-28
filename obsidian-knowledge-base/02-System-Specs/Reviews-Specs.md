---
tags:
  - spec
  - reviews
  - tenant
  - rls
  - security
  - status/living
date: 2026-09-28
updated: 2026-09-28
author: Long (tài liệu)
---

# 📐 Đặc Tả: Đánh Giá Sản Phẩm (M10a — ADR-029)

> **Nguồn quyết định:** ADR-029 trong [`docs/DECISIONS.md`](../../docs/DECISIONS.md), gồm mục "Bổ sung ADR-029 M10a theo
> triển khai" (Quốc chốt 2026-09-27) — bản trích
> [[01-Architecture-Decisions/ADR-015-M10-Reviews-Posts-Rls-Split-Writes|ADR-015 (KB)]]. Kế hoạch gốc:
> [`docs/ke-hoach-M10-social-feed-danh-gia-2026-09-27.md`](../../docs/ke-hoach-M10-social-feed-danh-gia-2026-09-27.md).
> Mức xác minh: ✅ đã đọc code/migration ngày 2026-09-28 · 🟡 theo báo cáo/brief, chưa tự kiểm · ❓ cần môi trường thật.
> **Trạng thái chung:** code xong, **chưa có test** (chủ dự án chọn chưa thêm test — nợ trong `docs/BACKLOG.md`); verify
> thủ công theo báo cáo 🟡. Mọi hành vi runtime (RLS/trigger trên Neon thật, email thật) là ❓ cho tới khi có test.

## 1. Phạm Vi

M10 giai đoạn 1 chia 3 phần: **M10a Đánh giá** (trang này, đã xong code), **M10b Bài viết tối giản** (xong code 2026-09-28 —
[[02-System-Specs/Posts-Specs|Posts-Specs]]), **M10c**
bình luận/thả tim/theo dõi (BACKLOG). Nút "Báo cáo vi phạm" đợi M12; SEO `AggregateRating` để GĐ3.

| Vùng | Đường dẫn | Ai dùng |
| :-- | :-- | :-- |
| Trang chi tiết tài liệu (trang hệ thống) — khối "Đánh giá" `#danh-gia` | `/[tenantSlug]/[productSlug]` (ADR-030; URL cũ `/[tenantSlug]/products/[productSlug]` → 301) | Khách vãng lai (đọc), khách đã mua (viết/sửa/xoá), chủ tenant (chỉ đọc, không viết) |
| Section "Đánh giá" storefront | `/[tenantSlug]` (section CMS `reviews`) | Công khai |
| Thư viện khách | `/account/library` — link "Viết/Sửa/Xem đánh giá" | Khách |
| Studio → Đánh giá | `/studio/[tenantSlug]/reviews` | Thành viên tenant (`requireTenantMemberPage`) |
| Studio → Tổng quan | ô "Đánh giá mới" (7 ngày) | Thành viên tenant |
| Logic | `apps/web/lib/review.ts`, `packages/core/src/review/review.ts` (subpath `@gieochu/core/review`) | — |

**System Admin không có route/hàm nào đọc đánh giá** (§7.9) ✅ — không có nhánh admin trong RLS, không có hàm admin
trong `lib/review.ts`.

---

## 2. Quy Tắc Nghiệp Vụ ✅

| Quy tắc | Chi tiết | Nguồn code |
| :-- | :-- | :-- |
| Ai được đánh giá | Khách có **đơn `FULFILLED`** (của chính mình) chứa sản phẩm **và** entitlement tương ứng **chưa thu hồi** (`revokedAt IS NULL`). Đơn 0đ cũng được đánh giá và tính điểm (ADR-029 mục 2). Chủ tenant không thấy form viết (trang ẩn composer khi `isOwner`). Khách phải đã xác minh email (`requireVerified`). | `findEligibleItem`, RLS `customer_insert` |
| Chứng từ mua | Mỗi đánh giá gắn `orderItemId` = dòng đơn đủ điều kiện **mới nhất**; khi khách sửa, `orderItemId` được cập nhật về dòng đang đủ điều kiện. | `upsertMyReview` |
| Số lượng | **1 đánh giá / khách / sản phẩm** — unique `(productId, userId)`. Gửi lần 2 = sửa. Đua ghi → `REVIEW_ALREADY_EXISTS` 409. | `@@unique`, `isUniqueViolation` |
| Sao | Số nguyên 1–5 (`parseReviewRating`, CHECK `reviews_rating_range`). | core |
| Nội dung | Tuỳ chọn, **văn bản thuần** ≤ 2000 ký tự (đếm theo code point, khớp CHECK `char_length`). Chuẩn hoá: NFC → bỏ ký tự điều khiển/ẩn (giữ xuống dòng) → CRLF thành LF → gộp >2 dòng trống → trim; rỗng = `null`; quá dài → từ chối, **không tự cắt**. | `normalizeReviewText` |
| Tên hiển thị | Snapshot lúc ghi, từ `UserProfile.fullName`: **tên = từ cuối**, kèm chữ cái đầu của **họ (từ đầu)** + dấu chấm — "Nguyễn Văn Minh" → "Minh N."; 1 từ → giữ nguyên; rỗng → "Khách hàng"; không bao giờ dùng email. Khách xem trước tên trên form (`displayNamePreview`). Mỗi lần sửa làm mới snapshot. | `formatReviewerDisplayName` |
| Sửa / xoá | Khách sửa **không giới hạn thời hạn** (ADR-029 bổ sung b) và tự xoá (xoá thật, xác nhận `window.confirm`). | `upsertMyReview`, `deleteMyReview` |
| Rate limit | Ghi (tạo/sửa) ≤ **5 lần / 10 phút / user** — in-memory (`apps/web/lib/rate-limit.ts`, chỉ đúng khi 1 instance) → `RATE_LIMITED` (429). Xoá không bị giới hạn. | `checkRateLimit("review-write:<userId>")` |
| Tự đăng | Đánh giá mới là `VISIBLE` ngay (không duyệt trước). | RLS `customer_insert` ép trạng thái sạch |
| Tenant READ_ONLY | Vẫn nhận và kiểm duyệt đánh giá của khách đã mua (ADR-029 bổ sung c): `upsertMyReview` không kiểm `tenant.status`; Studio vẫn mở. Storefront `LOCKED` vốn 404 với khách. | đọc code |

### 2.1. Trạng thái & ẩn ✅

- `status`: `VISIBLE` | `HIDDEN`. CHECK `reviews_hidden_shape`: `VISIBLE` ⇔ `hiddenReason`/`hiddenAt` NULL; `HIDDEN` ⇔ cả
  hai có giá trị.
- **Tenant ẩn** với lý do bắt buộc ∈ `SPAM`, `OFFENSIVE`, `IRRELEVANT`, `PERSONAL_INFO`, `OTHER`
  (`TENANT_REVIEW_HIDE_REASONS`) — sai → `REVIEW_INVALID_HIDE_REASON` 400. Tenant **khôi phục** được (`unhideReview`).
- **`REFUNDED` chỉ hệ thống đặt** (§5). Đánh giá đang `HIDDEN(REFUNDED)` bị **khoá**: tenant không ẩn lại với lý do khác,
  không khôi phục → `REVIEW_REFUNDED_LOCKED` 409.
- **Người viết** vẫn thấy đánh giá của mình khi bị ẩn, kèm nhãn "Đánh giá của bạn đã bị ẩn — <nhãn lý do tiếng Việt>"
  (`REVIEW_HIDDEN_REASON_LABELS`, không hiện mã) (ADR-029 bổ sung e). Khách khác không thấy; **không công khai số đánh giá
  bị ẩn**.
- Nhật ký: chưa có `audit_logs` (M12) → ghi log có cấu trúc `REVIEW_HIDDEN`, `REVIEW_RESTORED`, `REVIEW_HIDDEN_REFUNDED`,
  `REVIEW_RESTORED_AFTER_REPURCHASE` (pino) ✅.

### 2.2. Trả lời của tenant ✅

- 1 trả lời / đánh giá, sửa được; văn bản thuần ≤ 2000 (cùng `normalizeReviewText`). **Chuỗi rỗng = xoá trả lời**
  (`reply` và `repliedAt` về NULL — CHECK `reviews_reply_shape`) (ADR-029 bổ sung d).
- Trả lời hiển thị công khai dưới đánh giá: "Phản hồi từ <tên tenant>".

---

## 3. Điểm Trung Bình (cache số nguyên) ✅

- Cột `products.ratingSum`, `products.ratingCount` (INT, không float — ADR-029 mục 3), chỉ tính review `VISIBLE`.
- `recomputeProductRatings(productIds)` chạy **dưới `withSystemJob`** (customer/public không có quyền UPDATE `products` sau
  ADR-029 mục 0), mỗi sản phẩm: `pg_advisory_xact_lock(hashtext('product-rating:<id>'))` rồi `UPDATE` bằng
  **SUM/COUNT toàn phần** (idempotent, không cộng dồn); raw SQL để không chạm `products.updatedAt`. Lỗi chỉ log — đánh giá
  đã lưu, lần ghi sau tự sửa cache. Chưa có job đối soát định kỳ (BACKLOG).
- Gọi sau: tạo/sửa, xoá, ẩn, khôi phục, hoàn tiền/thu hồi (sau khi transaction commit).
- Hiển thị: `computeRatingAverage(sum, count)` làm tròn 1 chữ số thập phân bằng phép tính số nguyên (×10); `count = 0` →
  `null`. Thẻ tài liệu hiện sao **từ 1 đánh giá** kèm số lượng ("★ 4,6 (12)").
- `getProductRatingSummary` thêm phân bố sao 1–5 bằng `groupBy` dưới `withPublic` (chỉ khi `ratingCount > 0`).

---

## 4. Dữ Liệu & RLS ✅ (đọc migration)

Bảng L2 `reviews` — chi tiết cột/CHECK/index/policy ở
[[03-API-Contracts/Database-Schema-Reference|Database-Schema-Reference]] §3.2 + §7. Migration:
`20260927150000_m10a_reviews`, `20260927150100_rls_m10a_reviews`.

| Policy | Lệnh | Ai |
| :-- | :-- | :-- |
| `select_access` | SELECT | tenant (`app.scope='tenant'` + đúng `tenantId`) · public (`VISIBLE` + sản phẩm `PUBLISHED`) · customer (bản ghi của mình, kể cả `HIDDEN`) · `system_job` |
| `customer_insert` | INSERT | customer, `userId` của mình, trạng thái sạch, `EXISTS` dòng đơn `FULFILLED` của mình (đúng sản phẩm, đúng tenant) + entitlement cùng `orderItemId` chưa thu hồi |
| `customer_update` | UPDATE | customer, bản ghi của mình; dòng mới vẫn phải qua điều kiện đủ quyền |
| `tenant_update` | UPDATE | tenant, đúng `tenantId` |
| `system_job_update` | UPDATE | `system_job` |
| `customer_delete` | DELETE | customer, bản ghi của mình |

- **Không nhánh admin**; tenant **không DELETE** được đánh giá.
- **Trigger `reviews_guard_columns`** (BEFORE UPDATE) giới hạn cột theo `app.scope` vì tenant và customer chung role
  `gieochu_app` (không dùng được column GRANT): customer chỉ đổi `rating/body/displayName/orderItemId`; tenant chỉ đổi
  `status/hiddenReason/hiddenAt/reply/repliedAt`; không ai ngoài `system_job` đổi được `id/tenantId/productId/userId/createdAt`.
  Đây là **mẫu chuẩn** cho bảng L2 sau có cùng tình huống (ADR-029).
- App dịch lỗi RLS/trigger (SQLSTATE 42501, "row-level security", "reviews: ") thành `REVIEW_NOT_ELIGIBLE` ✅.
- Dưới scope customer, subquery của `customer_insert` đi qua RLS `orders`/`order_items`/`entitlements` — cả 3 có nhánh SELECT
  customer theo `app.user_id` nên dòng của chính khách đọc được ✅ (comment migration); chạy thật ❓.

---

## 5. Hoàn Tiền / Thu Hồi → Tự Ẩn; Mua Lại → Tự Hiện ✅

- `markOrderRefunded` (`lib/order.ts`) và `revokeEntitlement` (`lib/entitlement.ts`), trong **cùng transaction `withTenant`**
  của thao tác hoàn tiền/thu hồi, gọi `hideReviewsForRevokedItems(tx, tenantId, orderItemIds)`: đánh giá gắn với các dòng đơn
  đó → `HIDDEN`, `hiddenReason = REFUNDED` (ghi đè lý do ẩn cũ của tenant). Sau commit gọi `recomputeProductRatings`.
- **Mua lại** sau hoàn tiền (có entitlement mới hợp lệ) rồi khách **gửi lại/sửa** đánh giá → đánh giá `HIDDEN(REFUNDED)` tự về
  `VISIBLE` (bước khôi phục chạy dưới `withSystemJob`, log `REVIEW_RESTORED_AFTER_REPURCHASE`) (ADR-029 bổ sung a). Đánh giá bị
  **tenant** ẩn thì giữ nguyên khi khách sửa. Lưu ý: việc khôi phục chỉ xảy ra khi khách **gửi** đánh giá, không tự động lúc
  thanh toán ✅ (đọc code).

---

## 6. Email ✅ / ❓

- Đánh giá **mới** (không phải sửa) → `after()` gọi `notifyTenantOwnerOfReview`: email loại **`review_new`** tới email chủ
  tenant (`renderNewReviewEmail`, `@gieochu/email`), link `APP_URL/studio/<slug>/reviews`. Lỗi chỉ log, không ném.
- `review_new` nằm trong `TENANT_CUSTOMER_FACING_TYPES` (`apps/web/lib/email-dispatch.ts`) → **không ghi `EmailSendLog`**
  (§7.9) ✅.
- Không email cho khách ở GĐ1. Gửi thật qua SMTP ❓.

---

## 7. Storefront & Trang Tài Liệu

- **Trang chi tiết tài liệu:** tóm tắt điểm + phân bố sao, danh sách đánh giá `VISIBLE` mới nhất trước (kèm trả lời),
  form viết/sửa (`ReviewComposer`) cho khách, lời mời đăng nhập cho khách vãng lai (`/login?next=...#danh-gia`). Phân trang
  không cần JS: `?reviews=N` (bước 10, tối đa 50) rồi `?reviewsAfter=<cursor>` ✅. Chi tiết UI:
  [[04-Operations-Runbooks/UI-Design-System|UI-Design-System]] §10.
- **Section storefront `reviews`** ("Đánh giá", anchor `#danh-gia`): ghim trước rồi tự bù — xem
  [[02-System-Specs/Storefront-CMS-Specs|Storefront-CMS-Specs]] §3.3.
- **Trang Xem trước (Studio)** cũng gọi `getProductReviews` + `getProductRatingSummary` — cả hai chạy dưới `withPublic` nên với
  sản phẩm chưa `PUBLISHED` danh sách đánh giá luôn rỗng ✅ (đọc code; RLS public đòi sản phẩm `PUBLISHED`).

---

## 8. Studio → Đánh Giá ✅

- Danh sách đánh giá của tenant (mọi trạng thái), mới nhất trước, 20/trang, cursor `?cursor=`; lọc theo trạng thái, sản
  phẩm, số sao. Thẻ `StudioReviewCard`: trả lời/sửa/xoá trả lời, ẩn (chọn lý do)/khôi phục; đánh giá `REFUNDED` hiện nút khoá
  kèm giải thích.
- Badge sidebar **"Đánh giá (N)"**: N = số đánh giá `VISIBLE` **chưa có trả lời** (`countReviewsNeedingAttention`), `99+` khi
  > 99.
- Ô "Đánh giá mới" ở Tổng quan: số đánh giá tạo trong 7 ngày gần nhất, mọi trạng thái (`countNewTenantReviews`).
- Mọi action lấy `tenant.id` từ `requireTenantMember` (không từ client) và ghi qua `withTenant` + `WHERE tenantId`.

---

## 9. Chưa Xác Minh / Nợ

| Nội dung | Mức |
| :-- | :-- |
| Không có test (unit/integration) cho đánh giá, RLS `reviews`, trigger, điểm TB | ✅ (đã xác nhận: `pnpm test:count` 2026-09-28 = 93/94 unit, 52/53 integration — không đổi) |
| RLS `reviews` + trigger chặn đúng trên Neon thật (customer không đổi cột kiểm duyệt, tenant không sửa nội dung, public không thấy `HIDDEN`) | ❓ |
| Verify thủ công M10a trên DB dev qua role `gieochu_app` | 🟡 (theo ADR-029/PLAN, Long chưa tự chạy) |
| Dữ liệu demo đánh giá cho DB dev: script `demo:seed`/`demo:clean` (5 khách, 11 đơn, 9 đánh giá) — [[04-Operations-Runbooks/Dev-Demo-Data-Runbook|Dev-Demo-Data-Runbook]] | ✅ đọc code · kết quả chạy ❓ |
| Email `review_new` gửi thật | ❓ |
| Rate limit chỉ đúng khi chạy 1 instance | ✅ (đọc code) |
| Cache điểm lệch nếu `recomputeProductRatings` lỗi — chưa có job đối soát | ✅ (đọc code; BACKLOG) |
| Audit log ẩn/khôi phục (M12), nút Báo cáo vi phạm (M12), `AggregateRating` (GĐ3) | ✅ (chưa có) |

## 10. Liên Kết

* [[MOC-Home]] ([MOC-Home.md](../00-Index/MOC-Home.md)) · [[02-System-Specs/README|02-System-Specs]] ([README.md](./README.md))
* [[01-Architecture-Decisions/ADR-015-M10-Reviews-Posts-Rls-Split-Writes|ADR-015 (≙ ADR-029)]] ([ADR-015-M10-Reviews-Posts-Rls-Split-Writes.md](../01-Architecture-Decisions/ADR-015-M10-Reviews-Posts-Rls-Split-Writes.md))
* [[03-API-Contracts/Database-Schema-Reference|Database-Schema-Reference]] ([Database-Schema-Reference.md](../03-API-Contracts/Database-Schema-Reference.md)) — bảng `reviews`, RLS, trigger
* [[03-API-Contracts/Endpoint-Directory|Endpoint-Directory]] §12 ([Endpoint-Directory.md](../03-API-Contracts/Endpoint-Directory.md)) — contract hàm/action
* [[02-System-Specs/Storefront-CMS-Specs|Storefront-CMS-Specs]] §3.3 ([Storefront-CMS-Specs.md](./Storefront-CMS-Specs.md))
* [[02-System-Specs/Order-State-Machine|Order-State-Machine]] ([Order-State-Machine.md](./Order-State-Machine.md)) — hoàn tiền
* [[04-Operations-Runbooks/UI-Design-System|UI-Design-System]] §10 ([UI-Design-System.md](../04-Operations-Runbooks/UI-Design-System.md))

*Quay lại: [[MOC-Home]] (../00-Index/MOC-Home.md)*

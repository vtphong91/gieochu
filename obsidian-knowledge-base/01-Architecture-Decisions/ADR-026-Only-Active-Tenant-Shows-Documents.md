---
tags:
  - adr
  - tenant
  - security
  - seo
  - status/accepted
date: 2026-10-17
decider: vtphong91
status: Accepted (Chốt — Áp dụng chính thức)
---

# 🏛️ ADR-026: Chỉ gian hàng `ACTIVE` hiển thị tài liệu — `READ_ONLY` là trang "tạm ngưng" không có tài liệu

## 1. Trạng Thái (Status)
**ĐÃ PHÊ DUYỆT (Accepted)** — tương ứng **ADR-040** trong [`docs/DECISIONS.md`](../../docs/DECISIONS.md), gồm mục "Bổ sung ADR-040" (2026-10-17, Quốc). Bản trích ghi vào thư mục này
theo duyệt của Quốc (brief 2026-10-17). Quyết định này **chốt** mục "Bổ sung ADR-039 lần 2" (g) đang chờ chủ dự án xác nhận
([[01-Architecture-Decisions/ADR-025-Buyer-Remedy-Final-Download-Or-Refund|ADR-025 KB (≙ ADR-039)]]): chặn thanh toán đơn `PENDING` khi
tenant không `ACTIVE`.

Tiến độ (2026-10-17): **xong code; đã commit `36103fb`** (2026-10-17) ✅ `git log`, deploy ❓; không có migration (chỉ đổi logic đọc/hiển thị).

Mức xác minh: ✅ Long đã đối chiếu code (2026-10-17) · 🟡 theo `docs/DECISIONS.md`/báo cáo của Quốc · ❓ cần môi trường thật.

---

## 2. Bối Cảnh (Context)
Chủ dự án chốt (2026-10-17) 🟡: *"Gian hàng chỉ hiển thị tài liệu khi ở trạng thái Hoạt động; ngoài trạng thái này tài liệu không hiển thị
cho người dùng."* Trước đó (§4.4 đặc tả gốc) `READ_ONLY` vẫn render storefront + tài liệu, chỉ ẩn nút mua. Từ M3 v2
([[01-Architecture-Decisions/ADR-007-Hybrid-Monetization-Free-Forever|ADR-007 KB (≙ ADR-021)]]) `READ_ONLY` không còn là hệ quả billing,
chỉ còn là biện pháp quản trị.

---

## 3. Quyết Định (Decision)
1. **`ACTIVE`:** như hiện tại. **`LOCKED`:** giữ nguyên — khách 404, chủ thấy thông báo khoá ✅.
2. **`READ_ONLY`:** khách vào `/{slug}` thấy trang "Gian hàng đang tạm ngưng hoạt động" — **không** danh sách tài liệu/bài viết/đánh giá;
   trang tài liệu `/{slug}/{productSlug}` và bài viết trả 404. Chủ gian hàng vẫn xem storefront kèm thông báo trạng thái ✅.
   - ADR gốc ghi "chủ/**thành viên** gian hàng"; code xác định chủ bằng `tenant.ownerId === currentUser.userId` — **chưa** xét thành viên
     khác ✅ code (ghi BACKLOG).
3. Cửa hàng `/cua-hang` và trang chủ đã chỉ lấy tenant `ACTIVE` (ADR-033/035) — không đổi ✅ (`PUBLIC_PRODUCT_WHERE` = `PUBLISHED` + tenant `ACTIVE` trong `lib/home.ts`, dùng lại ở `lib/shop.ts`).
4. Thanh toán đơn `PENDING` khi tenant không `ACTIVE`: **chặn** (409 `PRODUCT_UNAVAILABLE`, chốt ADR-039 (g)). Khách đã mua vẫn tải từ
   Thư viện (ADR-039 áp riêng cho tài liệu vi phạm). Chặn thanh toán ✅ `assertOrderProductsPurchasable` (`lib/order.ts`); thư viện/tải không đổi đợt này 🟡 (theo brief, không đối chiếu lại).

---

## 4. Triển Khai (theo code, 2026-10-17)
| Chỗ | Hành vi | Xác minh |
|---|---|---|
| `packages/core/src/tenant/access-policy.ts` | `resolveStorefrontAccess`: `READ_ONLY` + guest → `SUSPENDED_NOTICE`; `READ_ONLY` + owner → `READ_ONLY`; `LOCKED` không đổi | ✅ |
| `app/[tenantSlug]/page.tsx` | `SUSPENDED_NOTICE` → trả trang tạm ngưng **trước** mọi loader sản phẩm/bài viết/đánh giá (không truy vấn); metadata tenant không `ACTIVE` → `robots: noindex, nofollow` | ✅ |
| `app/[tenantSlug]/_ui/notice.tsx` | `StorefrontSuspendedNotice` (khách) + lời mới của `StorefrontNotice` `READ_ONLY` (chủ) | ✅ |
| `app/[tenantSlug]/[productSlug]/page.tsx` | Chỉ `ACTIVE`/`READ_ONLY`(chủ) được xem; còn lại 404 (gồm `LOCKED` với cả chủ — như trước); metadata trả `{}` khi tenant không `ACTIVE` | ✅ |
| `app/[tenantSlug]/posts/page.tsx`, `posts/[postId]/page.tsx` | `NOT_FOUND`/`SUSPENDED_NOTICE` → 404 | ✅ |
| `lib/abuse-report.ts` `resolvePublicTarget` | Đối tượng của tenant không `ACTIVE` coi như không công khai → 404 `REPORT_TARGET_NOT_FOUND` | ✅ |
| `lib/share-link.ts` | Mở link (`resolveShareLink`) **và** tải (`consumeShareLinkDownload`) → 410 `SHARE_LINK_TENANT_LOCKED` khi tenant không `ACTIVE` (trước chỉ chặn `LOCKED` ở bước mở link) | ✅ |
| `lib/review.ts` `upsertMyReview` | Gửi/sửa đánh giá khi tenant không `ACTIVE` → 409 `TENANT_NOT_ACTIVE` | ✅ |
| `lib/tenant-write-guard.ts` | Chỉ cập nhật comment; `assertTenantCanWrite` không đổi | ✅ |

---

## 5. Hệ Quả (Consequences)
- `READ_ONLY` giờ ẩn hoàn toàn nội dung với khách; khác biệt duy nhất với `LOCKED` (với khách) là trang thông báo thay vì 404.
- **Bổ sung ADR-040 (2026-10-17, Quốc)** 🟡 nguồn / ✅ code: tenant không `ACTIVE` còn chặn gửi/sửa đánh giá (409 `TENANT_NOT_ACTIVE`) —
  **thay thế ADR-029 bổ sung (c)** ("`READ_ONLY` vẫn nhận đánh giá"; bản trích [[01-Architecture-Decisions/ADR-015-M10-Reviews-Posts-Rls-Split-Writes|ADR-015 KB]]
  đã đánh dấu); share link 410 (cả mở link và tải); báo cáo vi phạm 404. "Chủ" xác định bằng `ownerId` (thành viên khác → BACKLOG).
  Để BACKLOG: coupon preview chưa kiểm trạng thái tenant; đổi tên integration test `READ_ONLY` cũ; thống nhất cách chủ tenant `LOCKED`
  xem trang tài liệu/bài viết.
- Share link của tenant không `ACTIVE` hết hiệu lực tạm thời (410), tự hoạt động lại khi tenant về `ACTIVE` ✅ (không đổi dữ liệu link).
- Không thêm test (không đổi ngân sách 94/55).

---

## 6. Liên Kết
* [[02-System-Specs/Storefront-CMS-Specs|Storefront-CMS-Specs]] ([Storefront-CMS-Specs.md](../02-System-Specs/Storefront-CMS-Specs.md))
* [[02-System-Specs/Order-State-Machine|Order-State-Machine]] §3.8 ([Order-State-Machine.md](../02-System-Specs/Order-State-Machine.md))
* [[02-System-Specs/File-Storage-And-Downloads-Specs|File-Storage-And-Downloads-Specs]] ([File-Storage-And-Downloads-Specs.md](../02-System-Specs/File-Storage-And-Downloads-Specs.md))
* [[02-System-Specs/Reviews-Specs|Reviews-Specs]], [[02-System-Specs/Posts-Specs|Posts-Specs]], [[02-System-Specs/Abuse-Reports-Specs|Abuse-Reports-Specs]]
* [[04-Operations-Runbooks/UI-Design-System|UI-Design-System]] ([UI-Design-System.md](../04-Operations-Runbooks/UI-Design-System.md))

*Quay lại: [[MOC-Home]] (../00-Index/MOC-Home.md)*

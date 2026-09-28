---
tags:
  - adr
  - rls
  - security
  - reviews
  - posts
  - tenant
  - status/accepted
date: 2026-09-28
decider: vtphong91
status: Accepted (Chốt — Áp dụng chính thức)
---

# 🏛️ ADR-015: M10 Giai Đoạn 1 — Đánh Giá (M10a) + Bài Viết Tối Giản (M10b); Siết RLS Ghi Của Bảng L2

## 1. Trạng Thái (Status)
**ĐÃ PHÊ DUYỆT (Accepted)** — tương ứng **ADR-029** trong [`docs/DECISIONS.md`](../../docs/DECISIONS.md), gồm 3 mục
"Bổ sung": **mục 0 theo triển khai** (siết RLS 7 bảng), **M10a theo triển khai** (Quốc chốt 2026-09-27) và **M10b theo
triển khai** (Quốc chốt 2026-09-28). M10a và M10b đều **đã xong code** (chưa có test). Liên quan
[[01-Architecture-Decisions/ADR-006-Download-Token-Rls-Customer-Branch|ADR-006 (≙ ADR-020)]] (nhánh customer của RLS),
[[01-Architecture-Decisions/ADR-009-Storefront-Cms-Contact-Inbox|ADR-009 (≙ ADR-023)]] (mẫu policy tách theo lệnh, section
CMS), [[01-Architecture-Decisions/ADR-014-System-Cloudinary-Image-Quota|ADR-014 (≙ ADR-028)]] (ảnh bài viết M10b).

---

## 2. Bối Cảnh (Context)
Đặc tả M10 gốc viết trước ADR-023/025/028. Kế hoạch
[`docs/ke-hoach-M10-social-feed-danh-gia-2026-09-27.md`](../../docs/ke-hoach-M10-social-feed-danh-gia-2026-09-27.md) phát
hiện policy `products` là `FOR ALL USING (...)` không `WITH CHECK` → ở tầng DB scope `public` UPDATE được sản phẩm
`PUBLISHED`, scope `customer` UPDATE được sản phẩm có entitlement (code không làm, nhưng lớp DB hở). Khi triển khai, cùng
mẫu hở được tìm thấy ở thêm 5 bảng.

---

## 3. Quyết Định (Decision)
0. **Siết RLS trước M10.** Theo triển khai: migration `20260927130000_rls_adr029_split_write_policies` siết **7 bảng**
   `products`, `product_files`, `coupons`, `share_links`, `orders`, `order_items`, `entitlements`: mỗi bảng `select_access`
   (FOR SELECT, giữ nguyên điều kiện đọc cũ) + `write_insert/update/delete` chỉ `tenantId = app.tenant_id` hoặc scope
   `system_job` (`order_items` qua đơn cha). Trước đó scope public UPDATE/DELETE được mọi share link và customer tự UPDATE
   được `downloadsUsed/downloadLimit` của entitlement ở tầng DB.
   **Quy tắc cho bảng L2 mới:** có nhánh public/customer ⇒ tách policy theo lệnh, **không** dùng `FOR ALL`.
1. **Phạm vi:** M10a Đánh giá → M10b Bài viết tối giản. M10c (bình luận, thả tim, theo dõi) sang BACKLOG. Nút "Báo cáo vi
   phạm" đợi M12. SEO `AggregateRating` để GĐ3.
2. **Đánh giá:** chỉ khách có đơn hoàn tất + entitlement chưa thu hồi; 1 đánh giá/khách/sản phẩm; sao 1–5, nội dung tuỳ
   chọn ≤2000 ký tự; đơn 0đ được đánh giá; khách sửa/tự xoá; hoàn tiền/thu hồi → tự ẩn (lý do `REFUNDED`), không tính điểm.
   Tên hiển thị "Minh A.". Tự đăng; tenant trả lời (1/đánh giá) và ẩn với lý do bắt buộc, khôi phục được; người viết thấy
   nhãn "đã bị ẩn"; không công khai số bị ẩn. Email cho chủ tenant khi có đánh giá mới; không email cho khách ở GĐ1. System
   admin không có route đọc đánh giá (§7.9).
3. **Điểm trung bình:** cache số nguyên `products.ratingSum/ratingCount`, cập nhật dưới `system_job`; thẻ tài liệu hiện sao
   từ 1 đánh giá kèm số lượng.
4. **Storefront:** section **"Đánh giá"** lấy đánh giá thật (tự động N đánh giá ≥4 sao có nội dung, tenant chọn tay được),
   nhãn "Đã mua". Section nhập tay cũ đổi tên hiển thị thành **"Cảm nhận"**, không sao; dữ liệu cũ giữ nguyên.
5. **Bài viết (M10b — đã triển khai, chi tiết mục 9):** Tiptap + sanitizer (ADR-028), ≤6 ảnh Cloudinary tính hạn mức; tiêu đề tuỳ chọn; gắn ≤1
   sản phẩm; ghim ≤1 bài; DRAFT/PUBLISHED, HIDDEN cho vi phạm; trang hệ thống `/{tenantSlug}/posts` + `/posts/{postId}` +
   section "Bài viết"; không giới hạn số bài theo gói; không feed xuyên tenant.
6. **Dữ liệu:** bảng L2 `reviews`, `posts` — RLS tách policy theo lệnh; không nhánh admin.
7. **Bổ sung M10a theo triển khai (Quốc chốt):** `reviews` gắn `orderItemId`; trigger `reviews_guard_columns` giới hạn cột
   theo scope (customer: rating/body/displayName/orderItemId; tenant: status/hidden*/reply*) vì tenant và customer chung role
   `gieochu_app` nên không dùng được column GRANT; điểm TB tính lại toàn phần dưới `system_job` có advisory lock. Chi tiết:
   (a) mua lại sau hoàn tiền và sửa đánh giá → tự khôi phục `VISIBLE` (có log); (b) không giới hạn thời hạn sửa; (c) tenant
   `READ_ONLY` vẫn nhận/kiểm duyệt đánh giá; (d) trả lời rỗng = xoá trả lời; (e) khách thấy nhãn "đã bị ẩn" kèm nhãn lý do
   tiếng Việt; đánh giá ẩn vì `REFUNDED` tenant không khôi phục được.
8. **Test:** chủ dự án chọn **chưa thêm test** — nợ cho RLS, đánh giá, bài viết; verify thủ công trên DB dev qua role
   `gieochu_app`.
9. **Bổ sung M10b theo triển khai (Quốc chốt 2026-09-28):** bảng `posts` (L2, RLS tách lệnh; public chỉ thấy `PUBLISHED` khi
   tenant không `LOCKED`); partial unique index 1 bài ghim/tenant **chỉ có trong SQL** — cẩn thận khi chạy
   `prisma migrate dev`; trigger `posts_guard_product_tenant` (sản phẩm gắn phải cùng tenant) và `posts_guard_columns` (chỉ
   `system_job` đặt/gỡ `HIDDEN`). Quy tắc: ghim được bài mọi trạng thái trừ `HIDDEN` (công khai chỉ hiện khi `PUBLISHED`);
   bài `HIDDEN` tenant chỉ xoá được; tenant `READ_ONLY` không tạo/sửa/xoá bài (giống sản phẩm); gắn được sản phẩm chưa
   `ARCHIVED` (công khai chỉ hiện thẻ khi sản phẩm `PUBLISHED`); `publishedAt` giữ lần đăng đầu; body phải có chữ hoặc ≥ 1
   ảnh; không có `authorId` ở GĐ1; ảnh bài viết thư mục `tenants/<id>/posts`, usage `POST`.

---

## 4. Hệ Quả & Ràng Buộc Kỹ Thuật (Consequences & Rules)
* **Hiện trạng code (đối chiếu 2026-09-28) ✅:**
  - Migration `20260927130000_rls_adr029_split_write_policies` (đọc SQL — đúng 7 bảng, 4 policy/bảng).
  - Migration `20260927150000_m10a_reviews` (2 enum `ReviewStatus`/`ReviewHiddenReason`, cột `products.ratingSum/ratingCount`,
    bảng `reviews`, 7 CHECK) và `20260927150100_rls_m10a_reviews` (6 policy theo lệnh + trigger `reviews_guard_columns`).
  - Logic: `apps/web/lib/review.ts`; logic thuần `packages/core/src/review/review.ts` (subpath `@gieochu/core/review`);
    action khách `app/[tenantSlug]/[productSlug]/review-actions.ts` (đường dẫn sau ADR-030); action Studio `app/studio/[tenantSlug]/reviews/actions.ts`.
  - Hoàn tiền/thu hồi tự ẩn: `markOrderRefunded` (`lib/order.ts`), `revokeEntitlement` (`lib/entitlement.ts`).
  - Email `review_new` không ghi `EmailSendLog`.
  - **M10b:** migration `20260928090000_m10b_posts` (enum `PostStatus`, giá trị `TenantMediaUsage.POST`, bảng `posts`, 6 CHECK,
    partial unique index `posts_tenantId_pinned_key`) và `20260928090100_rls_m10b_posts` (7 policy theo lệnh + 2 trigger). Logic
    `apps/web/lib/post.ts`; logic thuần `packages/core/src/content/post.ts` (subpath `@gieochu/core/post`); action Studio
    `app/studio/[tenantSlug]/posts/actions.ts`; trang hệ thống `app/[tenantSlug]/posts/**`; section storefront `posts`.
* **Mẫu mới cho các bảng L2 sau:** (1) tách policy theo lệnh khi có nhánh public/customer; (2) trigger giới hạn cột theo
  `app.scope` khi hai scope cùng UPDATE một bảng nhưng khác nhóm cột.
* **Mẫu thứ 3 (M10b):** trigger kiểm **quan hệ cùng tenant** (`posts_guard_product_tenant`) — subquery chạy dưới RLS của
  người gọi nên tự chặn tham chiếu sản phẩm của tenant khác.
* **Chưa verify ❓:** RLS 7 bảng + `reviews` + `posts` + trigger trên Neon thật (chưa có integration test); email thật; upload
  ảnh bài viết thật; hiển thị với dữ liệu thật. Verify thủ công M10a/M10b trên DB dev 🟡 (theo ADR/PLAN).
* **Số test:** không đổi — `pnpm test:count` 2026-09-28 = 93/94 unit, 52/53 integration ✅.
* Đặc tả: [[02-System-Specs/Reviews-Specs|Reviews-Specs]], [[02-System-Specs/Posts-Specs|Posts-Specs]]; RLS: [[02-System-Specs/Architecture-Overview|Architecture-Overview]] §3,
  [[03-API-Contracts/Database-Schema-Reference|Database-Schema-Reference]] §7; contract:
  [[03-API-Contracts/Endpoint-Directory|Endpoint-Directory]] §12 (đánh giá), §13 (bài viết); storefront:
  [[02-System-Specs/Storefront-CMS-Specs|Storefront-CMS-Specs]] §3.3–§3.4; UI:
  [[04-Operations-Runbooks/UI-Design-System|UI-Design-System]] §10 (đánh giá), §11 (bài viết).

---

## 5. Tài Liệu Tham Chiếu & Liên Kết
* [[MOC-Home]] — Trang chủ Map of Content ([MOC-Home.md](../00-Index/MOC-Home.md))
* Tương ứng **ADR-029** trong [`docs/DECISIONS.md`](../../docs/DECISIONS.md) (gốc repo).
* [[01-Architecture-Decisions/ADR-003-Postgres-App-Role-RLS|ADR-003 (≙ ADR-010)]] ([ADR-003-Postgres-App-Role-RLS.md](./ADR-003-Postgres-App-Role-RLS.md)) — RLS chỉ có hiệu lực với role `gieochu_app`.
* [[01-Architecture-Decisions/ADR-006-Download-Token-Rls-Customer-Branch|ADR-006 (≙ ADR-020)]] ([ADR-006-Download-Token-Rls-Customer-Branch.md](./ADR-006-Download-Token-Rls-Customer-Branch.md))
* [[01-Architecture-Decisions/ADR-009-Storefront-Cms-Contact-Inbox|ADR-009 (≙ ADR-023)]] ([ADR-009-Storefront-Cms-Contact-Inbox.md](./ADR-009-Storefront-Cms-Contact-Inbox.md))
* [[02-System-Specs/Reviews-Specs|Reviews-Specs]] ([Reviews-Specs.md](../02-System-Specs/Reviews-Specs.md))
* [[02-System-Specs/Posts-Specs|Posts-Specs]] ([Posts-Specs.md](../02-System-Specs/Posts-Specs.md))

*Quay lại: [[MOC-Home]] (../00-Index/MOC-Home.md)*

# Kế hoạch chi tiết M10 — Social Feed và Đánh giá (đánh giá lại phạm vi sau ADR-021…028)

> **Ngày:** 2026-09-27 · **Loại:** Kế hoạch đề xuất làm đầu vào để Quốc chốt phạm vi với chủ dự án (không kèm thay
> đổi code, không sửa PLAN/DECISIONS/BACKLOG).
> **Người viết:** Long (tài liệu), theo brief của Quốc.
> **Nguồn đã đối chiếu:** `docs/GIEOCHU_PROMPT_MVP_PHASE1.md` (§1, §1.1, §2, §4.2, §4.4, §5.2–5.4, §6, §7, M4, M9, M10,
> M11, M12, §9, §10, §12); `docs/PLAN.md`; `docs/BACKLOG.md`; `docs/DECISIONS.md` (ADR-010, 020, 021, 022, 023, 024,
> 025, 026, 027, 028); `docs/ARCHITECTURE.md`; `docs/GIEOCHU_PRODUCT_MODULE_DEEP_PLAN_V1.0.md`; KB
> `02-System-Specs/{Storefront-CMS-Specs,Product-Editor-And-Publishing-Specs}.md`,
> `03-API-Contracts/Database-Schema-Reference.md`. Code (chỉ đọc): `packages/db/prisma/schema.prisma`, các migration
> `rls_m8`, `rls_m9*`, `rls_storefront_messages`; `packages/db/src/rls.ts`; `apps/web/lib/{order,storefront,rate-limit,session}.ts`;
> `apps/web/app/[tenantSlug]/**`, `apps/web/app/account/**`, `apps/web/app/studio/[tenantSlug]/{layout,page}.tsx`;
> `packages/core/src/{content/sanitize-html.ts,tenant/storefront-sections.ts,order/purchase-guard.ts,order/state.ts,billing/feature-gate.ts,errors.ts}`;
> `packages/email/src/templates/`; `scripts/count-tests.mjs` (đã chạy `node scripts/count-tests.mjs`).
>
> **Ký hiệu xác minh:** ✅ đã đối chiếu code/DB schema/tài liệu gốc · 🟡 nghe từ báo cáo/tài liệu hoặc hiểu biết
> chung, chưa kiểm chứng (thông lệ ngành ghi "tham khảo, chưa kiểm chứng nguồn") · ❓ cần môi trường thật (DB Neon,
> trình duyệt, nhiều instance) để xác nhận.

---

## 1. Tóm tắt điều hành

- **Chưa có một dòng code nào của M10** ✅: không có model `Post`/`Comment`/`Review`/`PostLike`/follow, không có cột
  `ratingAvg`/`ratingCount` trên `Product` (comment schema ghi rõ "M10 adds those columns"), không có test nào thuộc
  M10, ô "Đánh giá mới" ở tổng quan Studio vẫn ghi "Cần M10 — Social Feed".
- **Đặc tả gốc M10 gộp 6 tính năng** (bài viết, feed, bình luận, thả tim, đánh giá, theo dõi tenant) ✅ — nhưng viết
  **trước** khi storefront chuyển sang section CMS (ADR-023), trước khi tenant chỉ còn 1 trang public (ADR-025), trước
  editor Tiptap + sanitizer + ảnh Cloudinary có hạn mức (ADR-028). Một số chỗ trong đặc tả (tab "Bài viết/Tài liệu/
  Đánh giá", "markdown giới hạn", ảnh bài viết "bucket public-read", `float ratingAvg`) **không còn khớp** kiến trúc
  hiện tại và cần chốt lại.
- **Khuyến nghị tách M10 làm 2 đợt:** **M10a Đánh giá** (giá trị chuyển đổi cao nhất, phụ thuộc M8/M9 đã xong, thay
  được section `testimonials` bằng đánh giá thật) làm trước; **M10b Bài viết/feed tối giản** (bài viết + ghim +
  thẻ sản phẩm + section "Bài viết mới" trên storefront, **chưa** bình luận/thả tim/theo dõi) làm sau; **M10c** (bình
  luận, thả tim, theo dõi) để chủ dự án quyết có nằm trong GĐ1 hay chuyển BACKLOG.
- **Ngân sách test đã cạn** ✅: thực tế 93 unit / 52 integration, trần hiện 94/53. Đặc tả dành cho M10 4 unit / 3
  integration → cần trần tối thiểu **97/55** (chưa tính M12 0/2 → 97/57). **Bắt buộc chủ dự án duyệt nâng trần** trước
  khi Hiếu viết test M10.
- **Phát hiện RLS cần Quốc biết** ✅: policy `products` là một policy `FOR ALL` chỉ có `USING` (không có `WITH CHECK`
  riêng), nên nhánh `public` (sản phẩm PUBLISHED) và nhánh `customer` (có entitlement) về mặt DB **được phép UPDATE**
  sản phẩm — hiện chỉ code chặn. M10 nên dùng mẫu **policy tách theo lệnh** như `storefront_messages` cho mọi bảng mới,
  và quyết định rõ cách cập nhật điểm trung bình (mục 4.8).
- **Có 14 câu hỏi cần chủ dự án quyết** (mục 10), quan trọng nhất: phạm vi GĐ1 (a/b/c), ai được đánh giá (đơn 0đ?
  hoàn tiền?), kiểm duyệt đánh giá (tenant ẩn được đến đâu), trang chi tiết bài viết là trang hệ thống hay không có,
  và nâng trần test.

---

## 2. Đặc tả gốc nói gì và những gì đã thay đổi

### 2.1 Đặc tả gốc (trích ý) ✅

| Nội dung | Nguồn |
|---|---|
| Tenant "đăng bài dạng social để giới thiệu và chia sẻ về tài liệu"; customer "đánh giá tài liệu đã mua" | §1 |
| L3 Customer: "đánh giá, bình luận"; L2 gồm `posts, comments, reviews` | §1.1, §4.2 |
| ERD: `POSTS {tenantId, authorId, body, media json, productId, status DRAFT/PUBLISHED/HIDDEN, likeCount, commentCount}`; `COMMENTS {tenantId, postId, userId, body, status VISIBLE/HIDDEN}`; `REVIEWS {tenantId, productId, userId, orderItemId, rating, body, ownerReply, status VISIBLE/HIDDEN}`; bảng phụ `post_likes` unique `postId+userId`; `PRODUCTS` có `float ratingAvg`, `int ratingCount` | §5.2 |
| Unique `reviews(orderItemId)` | §5.3 |
| RLS: nhánh customer đọc `reviews` của mình; nhánh public đọc `posts PUBLISHED`, `reviews VISIBLE` | §5.4 |
| Đường dẫn `/{tenantSlug}/posts/{postId}`; storefront có tab **Bài viết / Tài liệu / Đánh giá**; sitemap cho sản phẩm và bài viết đã xuất bản; dashboard có "đánh giá mới" | M4 |
| Thư viện: "link tới trang đánh giá" | M9 |
| **M10 chức năng:** bài viết (markdown giới hạn, sanitize, ≤6 ảnh qua storage public, gắn 1 sản phẩm, DRAFT/PUBLISHED/HIDDEN, ghim); feed mới nhất trước, cursor, thẻ sản phẩm kèm giá hiện tại; bình luận (đăng nhập + xác minh, 1 cấp trả lời, owner ẩn/hiện, rate limit); thả tim toggle; đánh giá (chỉ user có `order_items` thuộc đơn `FULFILLED`, **mỗi order item một đánh giá**, 1–5 sao + nội dung, **sửa trong 7 ngày**, owner trả lời 1 lần, ẩn vi phạm có audit, không xoá, huy hiệu "Đã mua"); cập nhật `ratingAvg/ratingCount` **trong cùng transaction**; nút "Báo cáo" (M12); **theo dõi tenant** (chỉ lưu quan hệ + đếm) | M10 |
| Test M10: unit 4 (điều kiện đánh giá, số sao 1–5, tính lại điểm TB khi thêm/sửa/ẩn, sanitize bài viết + bình luận); integration 3 (bài viết xuất hiện trên feed công khai; người chưa mua không đánh giá được/người đã mua đúng 1 lần; owner ẩn bình luận → biến mất) | M10, §9 |
| Audit action `REVIEW_HIDDEN`; báo cáo vi phạm `abuse_reports` (L1) do admin xử lý | M12 |
| Ngoài MVP: "bài viết lên lịch", "SEO nâng cao (schema.org Product/Review)", "trang khám phá toàn nền tảng", "email marketing tới follower" | §12 GĐ3 |
| "Tìm kiếm toàn nền tảng, marketplace chung" ngoài phạm vi | §2.2 |

→ Theo đặc tả, **feed là feed của từng tenant**; feed xuyên tenant trên trang chủ hệ thống **không** nằm trong MVP
(§2.2 + §12 GĐ3 "trang khám phá toàn nền tảng") ✅.

### 2.2 Những thay đổi từ đó đến nay khiến M10 phải điều chỉnh

| Thay đổi | Hệ quả cho M10 | Nguồn |
|---|---|---|
| **Storefront là section CMS** (`hero/services/products/testimonials/contact`), lưu Json trên `tenants`, có nháp/xuất bản | Không còn "tab Bài viết/Tài liệu/Đánh giá". Feed và đánh giá phải vào storefront dưới dạng **section** (loại mới hoặc mở rộng loại cũ) | ADR-023 ✅, `packages/core/src/tenant/storefront-sections.ts` ✅ |
| Section `testimonials` hiện là **nội dung tenant tự gõ** (`quote, name, role?, avatarUrl?, rating 1–5`), demo **không** hiện cho khách | ADR-023 ghi rõ "khi có M10, section `testimonials` có thể chuyển sang lấy review thật". Cần quyết: thay hẳn, hay thêm nguồn "đánh giá thật" song song | ADR-023 §3 ✅, schema ✅ |
| **Tenant chỉ có 1 trang public (storefront)**; trang sản phẩm/checkout là **trang hệ thống** (header/footer hệ thống, không theme tenant) | Danh sách đánh giá hiển thị ở trang sản phẩm theo giao diện hệ thống. Route `/{tenantSlug}/posts/{postId}` trong đặc tả là một "trang con" — theo ADR-025 phải là trang hệ thống hoặc bỏ | ADR-025 ✅ |
| Chuẩn độ rộng `container-page/prose/narrow` | Trang chi tiết bài viết (nếu có) dùng `container-prose`; danh sách đánh giá nằm trong lưới `container-page` của trang sản phẩm | ADR-024 ✅ |
| **Editor Tiptap + `sanitizeRichTextHtml`** (whitelist đúng thẻ editor sinh ra, `img` chỉ Cloudinary hệ thống) — docstring đã ghi "sau này Blog" | Nội dung bài viết nên dùng lại Tiptap + sanitizer thay cho "markdown giới hạn" của đặc tả | `packages/core/src/content/sanitize-html.ts` ✅, `GIEOCHU_PRODUCT_MODULE_DEEP_PLAN_V1.0.md` §5 🟡 |
| **Ảnh qua Cloudinary hệ thống, chữ ký theo `public_id` do server sinh, hạn mức `Plan.imageStorageMb`, ghi `tenant_media_assets`** (usage `CONTENT/PRODUCT_COVER/STOREFRONT`) | "≤6 ảnh qua storage, bucket public-read" của đặc tả được thay bằng Cloudinary + hạn mức; cần thêm giá trị usage (ví dụ `POST`) hoặc dùng `CONTENT`. Ảnh đính kèm đánh giá của **khách** không có chỗ tính hạn mức (hạn mức là của tenant) | ADR-028 ✅, schema `TenantMediaAsset` ✅ |
| **Mẫu RLS public-INSERT** của `storefront_messages`: policy tách theo lệnh, public chỉ INSERT (ghi bằng `createMany` không RETURNING), tenant SELECT/UPDATE/DELETE, không nhánh admin | Mẫu đúng để áp cho `reviews`/`comments` (insert có điều kiện) | migration `rls_storefront_messages` ✅ |
| **Rate limit in-memory** (`checkRateLimit`, 1 process) | Bình luận/đánh giá dùng được ngay nhưng không bền khi nhiều instance (BACKLOG đã ghi) | `apps/web/lib/rate-limit.ts` ✅, BACKLOG ✅ |
| **Hybrid Monetization** — gate tính năng qua `plan.features` (`coupons, advancedAnalytics, advancedBranding, seoTools, automation, customDomain`) | Nếu muốn giới hạn feed theo gói phải thêm key mới (ví dụ `posts`), chỉnh được ở `/admin/plans` | ADR-021 ✅, `feature-gate.ts` ✅ |
| Đơn hàng: `markOrderPaid()` chuyển `PENDING → PAID → FULFILLED` **trong cùng một lần gọi**, tạo entitlement; `REFUND` chỉ từ `FULFILLED`, thu hồi entitlement | Điều kiện "đơn FULFILLED" của đặc tả tương đương "đã thanh toán" trong thực tế; cần quyết đánh giá của đơn đã hoàn tiền | `apps/web/lib/order.ts` ✅, `packages/core/src/order/state.ts` ✅ |
| Chặn mua lại khi còn entitlement hiệu lực (`canPurchaseProduct`) | Thực tế 1 khách chỉ có nhiều order item cho cùng sản phẩm khi đã bị thu hồi/hoàn tiền rồi mua lại → "1 review/order item" ≈ "1 review/khách/sản phẩm", trừ ca mua lại | `purchase-guard.ts` ✅ |
| Chưa có `audit_logs`/`abuse_reports` (M12) | `REVIEW_HIDDEN` phải tạm ghi `logger` như các hành động audit khác; nút "Báo cáo" chưa có đích | PLAN ✅, BACKLOG ✅ |

---

## 3. Hiện trạng code liên quan

### 3.1 Chưa có ✅
- Model/migration: `Post`, `Comment`, `Review`, `PostLike`, follow; cột rating trên `Product`.
- Route: `/[tenantSlug]/posts/...`, Studio "Bài viết"/"Đánh giá"; không có mục nav tương ứng (nav Studio hiện: Tổng
  quan, Đơn hàng, Khách hàng, Sản phẩm, Mã giảm giá, Trang bán hàng, Hộp thư, Gói dịch vụ, Cài đặt).
- Thư viện `/account/library` chưa có link/nút đánh giá (chỉ link tới trang sản phẩm).
- Trang sản phẩm (`_ui/product-detail.tsx`) chưa có khu đánh giá/điểm sao.
- Không có `sitemap` và không có JSON-LD ở bất kỳ route nào.
- Email template: có `new-sale, order-paid, product-file-rejected, reset-password, storefront-message,
  subscription-billing, verify-email` — **không** có mẫu cho đánh giá/bình luận.
- Không có test `describe("M10 …")` nào.

### 3.2 Dùng lại được ✅
| Thành phần | Dùng cho M10 |
|---|---|
| `withTenant/withCustomer/withPublic/withSystemJob` (`packages/db/src/rls.ts`) — lưu ý `withCustomer` chỉ đặt `app.scope` + `app.user_id`, **không** đặt `app.tenant_id` | Studio (tenant), khách viết đánh giá (customer), storefront/trang sản phẩm (public) |
| `requireVerified()` (`apps/web/lib/session.ts`) | Điều kiện "đã đăng nhập và xác minh" |
| RLS `orders`/`order_items`/`entitlements` có nhánh customer | Policy INSERT `reviews` kiểm quyền mua bằng `EXISTS` |
| Mẫu `storefront_messages` (policy tách lệnh, `createMany`, `ipHash` HMAC, honeypot, rate limit, email trong `after()`) | Bình luận/đánh giá công khai |
| `sanitizeRichTextHtml` + Tiptap editor + chữ ký Cloudinary tenant + `tenant_media_assets` | Nội dung/ảnh bài viết |
| Pricing engine M6 (`packages/core/src/pricing`) + `getStorefrontSectionProducts`/`PublicProduct` | Thẻ sản phẩm kèm giá hiện tại trong bài viết |
| Section `testimonials` + component `_ui/testimonials.tsx` (có `Stars`, a11y `aria-pressed`) | Hiển thị đánh giá thật trên storefront |
| `assertTenantCanWrite` (dùng trong `order.ts`) | Chặn đăng bài khi tenant READ_ONLY/LOCKED |
| `AppError` + `ErrorCodes` (`FORBIDDEN, NOT_FOUND, CONFLICT, RATE_LIMITED`…) | Mã lỗi M10 |
| `UserProfile.fullName` (L1) | Nguồn tên hiển thị người đánh giá (xem 4.10) |

---

## 4. Đánh giá (Reviews) — đề xuất chi tiết

### 4.1 Ai được đánh giá
- **Đặc tả:** user đăng nhập + xác minh, có `order_items` thuộc đơn `FULFILLED` của sản phẩm ✅.
- **Đề xuất:** giữ nguyên, **thêm** điều kiện entitlement của order item đó **chưa bị thu hồi** (`revokedAt IS NULL`) —
  vì đơn hoàn tiền chuyển `REFUNDED` và thu hồi entitlement ✅, người đã hoàn tiền không nên đánh giá mới.
- **Chủ tenant không tự đánh giá** sản phẩm của mình: đã tự nhiên bị chặn vì `canPurchaseProduct` cấm owner mua ✅.
- **Đơn 0đ (`ZERO_AMOUNT`)**: khách nhận tài liệu miễn phí cũng có đơn FULFILLED ✅ → theo đặc tả **được** đánh giá.
  Cần chủ dự án xác nhận (câu hỏi Q3). 🟡 Thông lệ: Gumroad cho người nhận sản phẩm miễn phí đánh giá (tham khảo, chưa
  kiểm chứng nguồn).
- Người nhận qua **share link** không có tài khoản/entitlement → không đánh giá được ✅ (hệ quả tự nhiên).

### 4.2 Số lượng
- Đặc tả: unique `reviews(orderItemId)` ✅. Vì mua lại chỉ xảy ra sau thu hồi/hoàn tiền (3.2), đề xuất **thêm unique
  `(productId, userId)`** để đúng "1 khách – 1 đánh giá/sản phẩm", tránh khách hoàn tiền → mua lại → có 2 đánh giá.
  Khi mua lại, khách **sửa** đánh giá cũ (nếu còn cửa sổ sửa) chứ không tạo mới. Cần quyết (Q4).

### 4.3 Sửa / xoá
- Đặc tả: **sửa trong 7 ngày**, "không xoá" (áp cho owner ẩn) ✅.
- Đề xuất: khách sửa sao + nội dung trong 7 ngày kể từ `createdAt`; sau đó chỉ xem. Khách **tự xoá** đánh giá của
  mình: đặc tả không nói → đề xuất **cho phép** (quyền của người viết với dữ liệu cá nhân của họ), xoá thật, tính lại
  điểm. Cần quyết (Q5).

### 4.4 Nội dung
- Sao 1–5 (số nguyên, CHECK ở DB + zod) ✅ theo đặc tả. Nội dung **văn bản thuần** (không HTML, không Tiptap), đề xuất
  10–2000 ký tự, cho phép chỉ chấm sao không viết (nội dung tuỳ chọn) — cần quyết (Q6). Văn bản thuần tránh hẳn XSS
  (render bằng text node React), không cần sanitizer HTML.
- **Ảnh đính kèm: đề xuất KHÔNG làm ở GĐ1.** Lý do ✅: hạn mức ảnh ADR-028 là của **tenant** (`Plan.imageStorageMb`,
  `tenant_media_assets` L2); ảnh do **khách** tải lên không có chủ hạn mức hợp lý (tính vào tenant = tenant trả tiền cho
  nội dung người khác; tính riêng = hạ tầng mới), lại cần kiểm duyệt ảnh. 🟡 Thông lệ: Shopify review app
  (Judge.me/Loox) có ảnh; Gumroad/Payhip chỉ sao + chữ (tham khảo, chưa kiểm chứng nguồn).

### 4.5 Tenant trả lời
- Đặc tả: owner trả lời **1 lần** ✅. Đề xuất: 1 trả lời, **sửa được**, văn bản thuần ≤1000 ký tự, lưu `ownerReply`,
  `ownerRepliedAt`. Staff trả lời khi luồng STAFF thật có (ADR-022) — hiện guard Studio chỉ OWNER ✅.

### 4.6 Kiểm duyệt
- Đặc tả: **tự đăng** (`VISIBLE` ngay), owner **ẩn** vi phạm (ghi audit, không xoá) ✅.
- Rủi ro 🟡: tenant ẩn đánh giá xấu để làm đẹp điểm → mất lòng tin người mua. Đề xuất: ẩn **bắt buộc chọn lý do**
  (`SPAM`, `OFFENSIVE`, `PERSONAL_INFO`, `OFF_TOPIC`), đánh giá ẩn **vẫn hiện cho chính người viết** kèm nhãn "Đã bị ẩn
  bởi người bán"; ẩn có **khôi phục**; điểm trung bình **chỉ tính VISIBLE** (theo đặc tả "tính lại khi ẩn"). Có hiển
  thị công khai "N đánh giá bị ẩn" không → Q7.
- Audit: chưa có `audit_logs` (M12) → tạm `logger.info` `REVIEW_HIDDEN/REVIEW_RESTORED` + ghi BACKLOG, đúng mẫu
  `COUPON_OVERUSED` ✅.
- **Báo cáo vi phạm:** `abuse_reports` là M12 → M10 **không** dựng nút "Báo cáo" (hoặc dựng nút gửi về hộp thư hệ
  thống tạm — không khuyến nghị). Đề xuất để M12 gắn vào cả sản phẩm, bài viết, bình luận, đánh giá. Q8.
- **System admin** không có route đọc đánh giá/bình luận chi tiết (§7.9) — khi M12 có báo cáo, admin chỉ thao tác trên
  đối tượng bị báo cáo qua luồng `abuse_reports`. Việc này cần Quốc xác nhận ranh giới (Q13).

### 4.7 Hiển thị ở đâu
1. **Trang sản phẩm (trang hệ thống, ADR-025):** khối "Đánh giá" dưới mô tả: điểm TB (1 chữ số thập phân) + số đánh giá
   + phân bố 5→1 sao, danh sách mới nhất trước, phân trang cursor (10/lần, `limit ≤ 50` theo §6), huy hiệu "Đã mua",
   trả lời của người bán. Phần đầu trang (cạnh giá) hiện sao + số đánh giá, bấm cuộn tới khối.
2. **Thư viện `/account/library`:** mỗi tài liệu có nút "Viết đánh giá" / "Sửa đánh giá (còn N ngày)" / "Đã đánh giá"
   → mở form (đề xuất form ngay trên trang sản phẩm khi khách đủ điều kiện, Thư viện chỉ dẫn link `#danh-gia`).
3. **Storefront section `testimonials`:** thêm trường `source: "manual" | "reviews"` (mặc định `manual` để không vỡ
   dữ liệu đã xuất bản). `reviews` = lấy tự động N đánh giá VISIBLE mới nhất có nội dung, lọc `rating ≥ minRating`
   (tenant chọn 4 hoặc 5), hoặc tenant **chọn tay** từng đánh giá — Q9. Đánh giá thật mang nhãn "Đã mua"; mục nhập tay
   nên đổi nhãn thành "Cảm nhận" để không lẫn với đánh giá đã xác minh (Q9).
4. **Thẻ tài liệu** trên storefront (`_ui/products.tsx`): sao + số đánh giá, **ẩn khi `ratingCount < ngưỡng`**
   (đề xuất ngưỡng 1; `GIEOCHU_PRODUCT_MODULE_DEEP_PLAN_V1.0.md` §5.6 từng gợi ý ngưỡng 5 cho số lượt bán 🟡) — Q10.
5. **Tổng quan Studio:** ô "Đánh giá mới" = số đánh giá 7 ngày gần nhất (thay "Cần M10").

### 4.8 Tính điểm trung bình
- Đặc tả: cột cache `ratingAvg` (**float**) + `ratingCount`, cập nhật trong cùng transaction ✅.
- **Đề xuất:** cột cache **số nguyên** `ratingCount Int` + `ratingSum Int` (TB = sum/count khi hiển thị) — tránh sai số
  float, cập nhật cộng/trừ nguyên tử (`UPDATE … SET ratingSum = ratingSum + Δ`), hàm thuần
  `applyRatingChange(prev, event)` trong `packages/core` là đối tượng unit test "tính lại khi thêm/sửa/ẩn". Lệch ERD
  gốc → ghi ADR.
- **Ràng buộc RLS khi cập nhật cache** ✅: khách tạo đánh giá trong `withCustomer` → phải UPDATE `products`. Policy
  `products` hiện là `FOR ALL USING (...)` với nhánh `customer AND EXISTS entitlement` → **DB cho phép** UPDATE này (vì
  không có policy UPDATE/`WITH CHECK` riêng). Tức là cơ chế chạy được, nhưng dựa vào một policy quá rộng (cùng lý do,
  scope `public` cũng UPDATE được sản phẩm PUBLISHED ở mức DB). Hai phương án:
  - **A (khuyến nghị):** giữ cache trên `products`, cập nhật trong cùng transaction customer/tenant — chạy được với
    policy hiện tại; đồng thời Quốc cân nhắc một task riêng **siết policy `products`** tách theo lệnh (public/customer
    chỉ SELECT) — khi đó cần thêm policy UPDATE hẹp cho cột rating hoặc chuyển cache sang bảng riêng.
  - **B:** không cache, tính động `AVG/COUNT … GROUP BY productId` từ `reviews VISIBLE` (có index) — đơn giản, không
    đụng RLS `products`, nhưng lệch đặc tả và tốn 1 truy vấn gộp mỗi lần render danh sách.
  → Q11.

### 4.9 Chống spam / giả mạo
- Ràng buộc gốc đã rất mạnh: chỉ người **đã trả tiền** (hoặc nhận 0đ) và **1 lần**. Thêm: rate limit in-memory 5 lần
  ghi/10 phút/user cho tạo+sửa (chủ yếu chống bấm lặp) ✅ khả thi; kiểm tra lại quyền ở **Server Action và RLS** (hai
  lớp). Đơn 0đ là kẽ hở "tự tạo tài khoản ảo nhận miễn phí rồi chấm 5 sao/1 sao" 🟡 — nếu Q3 cho phép, cân nhắc
  không tính đơn 0đ vào điểm TB.
- Không lưu IP thô; nếu cần dò lạm dụng dùng `ipHash` như ADR-023 (tuỳ chọn).

### 4.10 SEO và quyền riêng tư
- **schema.org `AggregateRating`/`Review`:** đặc tả xếp vào **GĐ3** (§12) ✅. Đề xuất **không** làm ở M10: dữ liệu
  đánh giá có thể bị tenant ẩn chọn lọc → rủi ro vi phạm chính sách rich result của Google về đánh giá tự phục vụ 🟡
  (tham khảo, chưa kiểm chứng nguồn). Q12.
- **Tên hiển thị:** đề xuất lưu **snapshot** `authorDisplayName` lúc tạo, dạng rút gọn từ `UserProfile.fullName`
  (ví dụ "Nguyễn Minh Anh" → "Minh A." hoặc "Anh N."), không bao giờ hiện email; khách **xem trước** tên sẽ hiện trước
  khi gửi. Lý do: trang public đọc qua `withPublic`, không nên join `user_profiles` (L1) để lấy họ tên đầy đủ; snapshot
  cũng giữ ổn định nếu khách đổi tên. Định dạng rút gọn → Q6. 🟡 Nghị định 13/2023/NĐ-CP về dữ liệu cá nhân — cần
  người có chuyên môn pháp lý xác nhận mức hiển thị (chưa kiểm chứng nguồn).

---

## 5. Social Feed (bài viết) — đề xuất

### 5.1 Phạm vi: feed của tenant, không phải feed xuyên tenant
- **Feed tenant** (bài viết do tenant đăng, hiện trên storefront của chính tenant) — **trong phạm vi M10** ✅ (§M10).
- **Feed xuyên tenant trên trang chủ hệ thống / trang khám phá** — **ngoài phạm vi MVP** ✅ (§2.2 "marketplace chung",
  §12 GĐ3 "trang khám phá toàn nền tảng"; ADR-026 cũng loại "trang khám phá xuyên tenant"). Nếu chủ dự án muốn có thì
  phải là quyết định mới (liên quan tới RLS: một truy vấn public đọc bài của nhiều tenant — policy `posts PUBLISHED`
  cho phép, nhưng cần xếp hạng/kiểm duyệt cấp nền tảng).

### 5.2 Loại bài
- Đề xuất GĐ1: **một loại bài** = nội dung Tiptap (đã sanitize, bộ công cụ rút gọn: đoạn, đậm/nghiêng, danh sách, link,
  ảnh) + **tối đa 6 ảnh** (đặc tả) upload qua chữ ký Cloudinary tenant (usage mới `POST` hoặc tái dùng `CONTENT`, tính
  vào `imageStorageMb`) + **gắn tối đa 1 sản phẩm** (thẻ sản phẩm có giá hiện tại tính bằng pricing engine M6, nút
  "Xem tài liệu" → trang sản phẩm). Không video, không bình chọn, không liên kết nhúng (embed) ở GĐ1.
- Tiêu đề bài: đặc tả không có (chỉ `body`); đề xuất **có tiêu đề tuỳ chọn** để dùng cho `<title>`/OG nếu có trang
  chi tiết (Q2).

### 5.3 Ai xem
- GĐ1: **công khai** (`PUBLISHED` đọc bằng `withPublic`) ✅ theo đặc tả. Bài chỉ cho khách đã mua/người theo dõi
  (kiểu Patreon/Substack bài trả phí 🟡 tham khảo, chưa kiểm chứng nguồn) là mô hình membership → §12 GĐ4
  ("khoá học video/membership"), **không** làm.

### 5.4 Bình luận, thả tim, theo dõi
- Đặc tả có cả ba ✅. Đánh giá chi phí: bình luận kéo theo kiểm duyệt, rate limit, thông báo, báo cáo vi phạm, hiển thị
  tên người dùng công khai; thả tim cần bảng phụ + đếm; theo dõi chỉ có giá trị khi có email marketing (§12 GĐ3).
- **Khuyến nghị:** M10b **không** có bình luận/thả tim/theo dõi; gom vào **M10c** và để chủ dự án chọn: làm trong GĐ1
  (sau M10a/b) hay chuyển BACKLOG (Q1). Nếu làm, theo đặc tả: bình luận cần `requireVerified`, 1 cấp trả lời, owner
  ẩn/hiện, rate limit (đề xuất 5 bình luận/5 phút/user, 30/giờ/post), văn bản thuần ≤1000 ký tự; thả tim toggle, unique
  `(postId, userId)`, cập nhật `likeCount` nguyên tử; theo dõi = bảng `tenant_follows (tenantId, userId)` + đếm.

### 5.5 Ghim, lịch đăng, trạng thái
- **Ghim:** đặc tả có ✅ → `pinnedAt DateTime?`, tối đa 1 (hoặc 3) bài ghim, bài ghim lên đầu feed (Q2).
- **Lịch đăng:** §12 GĐ3 "bài viết lên lịch" ✅ → **không** làm; chỉ `DRAFT → PUBLISHED`.
- **Trạng thái:** `DRAFT / PUBLISHED / HIDDEN`. Đề xuất phân biệt: tenant tự "gỡ" = về `DRAFT`; `HIDDEN` dành cho ẩn do
  vi phạm (M12 dùng) — tenant không tự đặt `HIDDEN`. Cần Quốc xác nhận (Q2).

### 5.6 Hạn mức theo gói
- Ảnh: đã có hạn mức chung `imageStorageMb` ✅ — không cần thêm.
- Số bài: đề xuất **không giới hạn** ở GĐ1 (không gate), nếu muốn thì thêm key `posts` vào `plan.features` (ADR-021
  cấm đọc `plan.code`) — Q2.

### 5.7 Nơi hiển thị
- **Storefront:** section mới `posts` ("Bài viết mới", N bài 1–6, tenant bật/tắt, sắp xếp như các section khác theo
  ADR-023), mặc định **không** có trong demo (tránh nội dung giả). Bài dài hiển thị trích đoạn (cắt văn bản thuần ~300 ký
  tự) + "Đọc tiếp".
- **Trang chi tiết/danh sách bài:** theo ADR-025 tenant chỉ có 1 trang public, nên hoặc
  - (a) `/{tenantSlug}/posts/{postId}` là **trang hệ thống** (header/footer hệ thống, `container-prose`, breadcrumb về
    storefront — giống trang sản phẩm), kèm `/{tenantSlug}/posts` danh sách cursor; hoặc
  - (b) không có trang con, bài hiển thị đầy đủ ngay trong section (mở rộng/thu gọn).
  Khuyến nghị (a) vì có URL chia sẻ được (mục đích "giới thiệu tài liệu") — Q2. Sitemap (M4 đặc tả) chưa tồn tại ✅ →
  đề xuất để task SEO riêng.
- Tenant `READ_ONLY`: vẫn hiện bài; `LOCKED`: 404 như storefront ✅ (dùng `resolveStorefrontAccess`). Đăng/sửa bài bị
  chặn bởi `assertTenantCanWrite` khi không ACTIVE (đề xuất).

### 5.8 Kiểm duyệt bài
- Tenant chịu trách nhiệm nội dung của mình; nền tảng xử lý qua báo cáo vi phạm M12 (`HIDDEN`). Sanitizer chạy khi lưu
  **và** khi render ✅ (docstring sanitizer). Ảnh chỉ Cloudinary hệ thống ✅.

---

## 6. Dữ liệu và bảo mật (đề xuất — cần Hiếu thiết kế chi tiết, Quốc duyệt)

### 6.1 Bảng (tất cả L2, có `tenantId`, id `cuid(2)`, RLS `ENABLE + FORCE`, policy **tách theo lệnh**)

| Bảng | Cột chính | Index / ràng buộc | RLS đề xuất |
|---|---|---|---|
| `reviews` | `tenantId, productId, userId, orderItemId, rating Int, body String?, authorDisplayName, status VISIBLE/HIDDEN, hiddenReason?, hiddenAt?, ownerReply?, ownerRepliedAt?, createdAt, updatedAt` | unique `orderItemId` (§5.3); unique `(productId, userId)` (nếu Q4 duyệt); CHECK `rating BETWEEN 1 AND 5`; index `(tenantId, productId, status, createdAt)`, `(userId)` | SELECT: tenant đúng `tenantId` **hoặc** public + `status='VISIBLE'` **hoặc** customer + `userId = app.user_id` **hoặc** system_job. INSERT: chỉ customer, `userId = app.user_id` **và** `EXISTS` order item thuộc đơn `FULFILLED` của chính user, cùng `productId`/`tenantId`, entitlement chưa thu hồi. UPDATE: customer (của mình — giới hạn cột và cửa sổ 7 ngày kiểm ở code, có thể thêm `createdAt > now() - interval '7 days'` vào `WITH CHECK`) **hoặc** tenant (ẩn/khôi phục/trả lời — cột kiểm ở code). DELETE: customer của mình (nếu Q5 duyệt). Không nhánh admin. |
| `products` (sửa) | `ratingCount Int @default(0)`, `ratingSum Int @default(0)` | — | Giữ policy hiện có (xem 4.8) |
| `posts` | `tenantId, authorId, title?, bodyHtml, images Json (≤6 URL Cloudinary), productId?, status DRAFT/PUBLISHED/HIDDEN, pinnedAt?, publishedAt?, likeCount, commentCount, createdAt, updatedAt` | index `(tenantId, status, pinnedAt, publishedAt, id)` cho cursor; FK `productId` cùng tenant (kiểm ở code) | SELECT: tenant **hoặc** public + `PUBLISHED` **hoặc** system_job. INSERT/UPDATE/DELETE: chỉ tenant. |
| `comments` *(M10c)* | `tenantId, postId, userId, parentId?, body, authorDisplayName, status VISIBLE/HIDDEN, createdAt` | index `(tenantId, postId, status, createdAt)` | SELECT: tenant / public + VISIBLE / customer của mình. INSERT: customer của mình, post `PUBLISHED`. UPDATE: tenant (ẩn/hiện). |
| `post_likes` *(M10c)* | `tenantId, postId, userId, createdAt` | unique `(postId, userId)` | INSERT/DELETE: customer của mình; SELECT: customer của mình + tenant. |
| `tenant_follows` *(M10c)* | `tenantId, userId, createdAt` | unique `(tenantId, userId)` | như `post_likes` |

Ghi chú:
- Chèn review trong `withCustomer` (không có `app.tenant_id`) → dùng `create` bình thường được vì customer có policy
  SELECT trên dòng của mình (RETURNING qua được); còn comment/like nếu public SELECT không bao phủ dòng mới thì dùng
  `createMany` như `storefront_messages` ✅ (mẫu đã có).
- Studio đọc/ẩn/trả lời review qua `withTenant`; trang sản phẩm/storefront đọc qua `withPublic`.
- Migration: 1 migration schema + 1 migration `rls_m10_*` (giữ lịch sử bất biến như ADR-020); GRANT tường minh cho
  `gieochu_app` theo mẫu `rls_storefront_messages` ✅. Cần chạy trên DB Neon thật ❓.
- `TenantMediaUsage` thêm giá trị `POST` (nếu tách thống kê) — migration enum.

### 6.2 Mã lỗi đề xuất (hằng trong `packages/core/src/errors.ts` hoặc mã nghiệp vụ như `ALREADY_OWNED`)
`REVIEW_NOT_ELIGIBLE` (403 — chưa mua/đã hoàn tiền), `REVIEW_ALREADY_EXISTS` (409), `REVIEW_EDIT_WINDOW_CLOSED` (403),
`REVIEW_INVALID_RATING` (400, thực tế đi qua `VALIDATION_ERROR`), `REVIEW_NOT_FOUND` (404), `REVIEW_REPLY_EXISTS`
(409 nếu trả lời không sửa được), `POST_NOT_FOUND` (404), `POST_PRODUCT_INVALID` (400 — sản phẩm không thuộc tenant),
`POST_TOO_MANY_IMAGES` (400), `TENANT_NOT_WRITABLE` (dùng mã hiện có của `assertTenantCanWrite`), `RATE_LIMITED` (429,
đã có ✅). Tên cuối cùng do Hiếu đối chiếu với mã sẵn có.

### 6.3 Ranh giới bảo mật
- §7.9: **system admin không có route** đọc review/bình luận/bài nháp của tenant ✅ (không nhánh admin trong RLS).
  Thống kê nền tảng (nếu cần) chỉ số lượng qua `tenant_daily_stats` (M12).
- §7.7: ghi bằng **Server Action** (CSRF sẵn có) — nếu có Route Handler ghi (ví dụ like qua fetch) phải kiểm `Origin`.
- §7.5 tinh thần "không tin client": quyền đánh giá, `tenantId`, `productId`, `authorDisplayName` đều suy ở server.
- Sanitize: bài viết qua `sanitizeRichTextHtml` khi lưu và khi render; review/comment văn bản thuần (React escape).
- CSP `img-src` đã cho `res.cloudinary.com` ✅ — ảnh bài viết không cần đổi CSP.

---

## 7. UI (theo ADR-024/025; Phong chốt bố cục, token)

| Màn hình | Vùng | Nội dung chính | Đợt |
|---|---|---|---|
| Studio › **Đánh giá** (`/studio/[tenantSlug]/reviews`) | App shell (fluid) | Bảng/thẻ: sản phẩm, sao, trích nội dung, tên hiển thị, ngày, trạng thái; lọc theo sản phẩm/sao/trạng thái; hành động Trả lời, Ẩn (chọn lý do), Khôi phục; mục nav mới kèm đếm đánh giá mới (như Hộp thư) | M10a |
| Studio › Tổng quan | App shell | Ô "Đánh giá mới" số thật | M10a |
| Trang sản phẩm `/{tenantSlug}/products/{slug}` (trang hệ thống) | `container-page` | Tóm tắt sao cạnh giá; khối "Đánh giá" (TB + phân bố + danh sách cursor + trả lời người bán + huy hiệu "Đã mua"); form viết/sửa cho khách đủ điều kiện; trạng thái rỗng "Chưa có đánh giá" | M10a |
| `/account/library` | App shell account | Nút "Viết đánh giá"/"Sửa (còn N ngày)"/"Đã đánh giá" | M10a |
| Storefront section `testimonials` | Section CMS, màu tenant `--sf-*` | Nguồn "Đánh giá thật"; editor Studio chọn nguồn/ngưỡng/chọn tay | M10a |
| Thẻ tài liệu storefront | Section `products` | Sao + số đánh giá (ẩn dưới ngưỡng) | M10a |
| Studio › **Bài viết** (`/studio/[tenantSlug]/posts`, `/new`, `/[postId]`) | App shell | Danh sách (trạng thái, ghim, ngày); editor Tiptap rút gọn + tải ≤6 ảnh + chọn 1 sản phẩm + Lưu nháp/Đăng/Gỡ/Ghim; dùng lại lưới editor sản phẩm | M10b |
| Storefront section `posts` | Section CMS | Thẻ bài (ảnh đầu, trích đoạn, ngày, thẻ sản phẩm nhỏ) | M10b |
| `/{tenantSlug}/posts` + `/{tenantSlug}/posts/{postId}` *(nếu Q2 chọn (a))* | Trang hệ thống, `container-prose` | Nội dung bài, gallery ảnh, thẻ sản phẩm có giá, breadcrumb về storefront, OG metadata | M10b |
| Bình luận/tim/theo dõi | — | *(nếu Q1 duyệt M10c)* | M10c |

Mọi màn hình cần đủ trạng thái loading/empty/error, a11y (sao có `sr-only` như `Stars` hiện có ✅, form sao dùng
radio group), responsive — Phong kiểm theo quy trình.

---

## 8. Phân rã công việc

Ước lượng tương đối: S (≤½ ngày), M (~1 ngày), L (2–3 ngày) — 🟡 ước lượng của Long, Hiếu/Phong cần xác nhận.

### M10a — Đánh giá

| # | Hạng mục | Người | Phụ thuộc | Cỡ | Test đề xuất |
|---|---|---|---|---|---|
| a1 | ADR M10 (phạm vi, int sum/count, unique product+user, ẩn có lý do, tên hiển thị) | Quốc | Q1–Q13 | S | — |
| a2 | Schema `reviews` + cột rating `products` + migration + `rls_m10_reviews` (tách lệnh) | Hiếu | a1 | M | — |
| a3 | `packages/core/src/review`: `canReviewOrderItem()`, zod rating/body, `applyRatingChange()`, `formatReviewerName()` | Hiếu | a1 | S | **Unit 3**: (1) điều kiện được phép đánh giá, (2) số sao hợp lệ 1–5, (3) tính lại tổng khi thêm/sửa/ẩn |
| a4 | `apps/web/lib/review.ts` + Server Actions: tạo/sửa (7 ngày)/xoá(?), owner trả lời/ẩn/khôi phục, danh sách public cursor, rate limit | Hiếu | a2, a3 | L | **Integration 1**: người chưa mua bị từ chối, người đã mua tạo đúng 1 lần (đặc tả M10 #2) |
| a5 | Bố cục khối đánh giá trang sản phẩm, form sao, Studio Đánh giá, nút Thư viện, thẻ tài liệu có sao, section testimonials nguồn thật (contract dữ liệu → Quốc chuyển Hiếu) | Phong | a1 | L | — (kiểm a11y/responsive thủ công) |
| a6 | Nối dữ liệu vào UI, mở rộng `storefrontSectionsSchema` (`source`), ô Tổng quan | Hiếu | a4, a5 | M | (có thể dùng lại integration a4) |
| a7 | KB: spec Reviews, cập nhật Storefront-CMS-Specs, Database-Schema-Reference, API/action contract, KB-Audit | Long | a4–a6 | M | — |

### M10b — Bài viết (feed tenant tối giản)

| # | Hạng mục | Người | Phụ thuộc | Cỡ | Test đề xuất |
|---|---|---|---|---|---|
| b1 | Schema `posts` + migration + `rls_m10_posts`; usage ảnh `POST` | Hiếu | a1/Q2 | M | — |
| b2 | `lib/post.ts` + Server Actions (CRUD, đăng/gỡ, ghim, ảnh ≤6 qua chữ ký tenant, sản phẩm cùng tenant), feed public cursor + giá hiện tại | Hiếu | b1 | L | **Unit 1**: sanitize nội dung bài viết (đặc tả M10 #4 — phần "bình luận" chỉ khi có M10c); **Integration 1**: bài PUBLISHED xuất hiện trên feed công khai, DRAFT thì không (đặc tả M10 #1) |
| b3 | Bố cục Studio Bài viết, section `posts`, trang chi tiết/danh sách hệ thống | Phong | Q2 | L | — |
| b4 | Nối UI + section schema `posts` | Hiếu | b2, b3 | M | — |
| b5 | KB: spec Posts/Feed, runbook | Long | b4 | S | — |

### M10c — Bình luận, thả tim, theo dõi (chỉ khi Q1 duyệt)

| # | Hạng mục | Người | Cỡ | Test đề xuất |
|---|---|---|---|---|
| c1 | `comments` + `post_likes` + `tenant_follows` + RLS | Hiếu | M | — |
| c2 | Actions + rate limit + owner ẩn/hiện + đếm | Hiếu | L | **Integration 1**: owner ẩn bình luận → biến mất khỏi feed (đặc tả M10 #3) |
| c3 | UI bình luận/tim/nút theo dõi | Phong | M | — |
| c4 | KB | Long | S | — |

### Ngân sách test ✅

| | Unit | Integration |
|---|---:|---:|
| Thực tế hôm nay (`node scripts/count-tests.mjs`) | 93 | 52 |
| Trần hiện tại (ADR-026) | 94 | 53 |
| Còn trống | 1 | 1 |
| M10 theo đặc tả (a: 3+1, b: 1+1, c: 0+1) | +4 | +3 |
| Sau M10 | **97** | **55** |
| M12 theo đặc tả | +0 | +2 |
| Sau M10 + M12 | **97** | **57** |

→ **Vượt trần 94/53**. Cần chủ dự án duyệt nâng trần lên **97/55** cho M10 (hoặc 97/57 gộp luôn M12) — Q14. Nếu
M10c không làm, integration còn +2 (54) và mục "owner ẩn bình luận" thay bằng "owner ẩn đánh giá → biến mất khỏi trang
sản phẩm và điểm TB được tính lại" (vẫn 3 integration) — cần chủ dự án đồng ý đổi nội dung test so với §9.

---

## 9. Rủi ro và phụ thuộc

| Rủi ro / phụ thuộc | Mức | Ghi chú |
|---|---|---|
| Policy RLS `products` quá rộng (public/customer UPDATE được ở mức DB) | Trung bình | ✅ đối chiếu migration `rls_m9_products_customer`. Không do M10 gây ra nhưng M10 sẽ dựa vào nó nếu chọn 4.8-A. Đề xuất task siết riêng. |
| Chưa có `audit_logs` (M12) | Thấp | `REVIEW_HIDDEN` tạm ghi logger; nối khi M12 (BACKLOG). |
| Chưa có `abuse_reports` (M12) | Trung bình | Nội dung khách viết công khai mà chưa có kênh báo cáo — chủ yếu ảnh hưởng bình luận (M10c). |
| Rate limit in-memory, 1 instance | Trung bình | ✅ BACKLOG đã ghi. Nhiều instance thì giới hạn nhân lên ❓ (cần môi trường deploy thật). |
| Email thông báo (M11): "có đánh giá mới" cho owner, "người bán đã trả lời" cho khách | Thấp | Chưa có template; đề xuất gửi trong `after()` theo mẫu `storefront-message` hoặc để sau (Q13). |
| Tenant ẩn đánh giá xấu → mất lòng tin | Trung bình | Chính sách ẩn (4.6, Q7). |
| Section `testimonials` nhập tay mang dáng "đánh giá" nhưng không xác minh | Trung bình | Q9 — đổi nhãn/tách nguồn. |
| Ảnh bài viết tăng dung lượng Cloudinary hệ thống | Thấp | Đã có hạn mức theo gói (ADR-028); job dọn asset mồ côi còn nợ (ADR-028). |
| Không có sitemap/SEO bài viết | Thấp | Đặc tả M4 có sitemap nhưng chưa làm ✅; để task SEO riêng. |
| Ngân sách test | Cao (chặn) | Q14. |
| Trang chi tiết bài viết vs ADR-025 | Trung bình | Q2. |

---

## 10. Câu hỏi cần chủ dự án quyết

1. **Phạm vi GĐ1:** làm M10a (Đánh giá) + M10b (Bài viết tối giản), còn bình luận/thả tim/theo dõi (M10c) chuyển
   BACKLOG? — *Khuyến nghị:* **Có** — M10a trước, M10b sau, M10c sang BACKLOG (có thể mở lại khi có M12 báo cáo vi phạm).
2. **Bài viết:** (a) có trang hệ thống `/{tenantSlug}/posts` + `/{tenantSlug}/posts/{postId}` hay (b) chỉ hiện trong
   section storefront? Có tiêu đề tuỳ chọn? Số bài ghim tối đa? Tenant tự gỡ về DRAFT, `HIDDEN` dành cho vi phạm? Có
   giới hạn số bài theo gói? — *Khuyến nghị:* (a); có tiêu đề tuỳ chọn; ghim tối đa 1; đúng như đề xuất 5.5; không
   giới hạn số bài (ảnh đã có hạn mức).
3. **Đơn 0đ** có được đánh giá không, có tính vào điểm TB không? — *Khuyến nghị:* được đánh giá, **có** tính (đơn
   giản, minh bạch), theo dõi lạm dụng sau; nếu lo spam thì chọn "được đánh giá nhưng không tính TB".
4. **Mỗi khách 1 đánh giá/sản phẩm** (thêm unique `productId+userId`) thay vì chỉ "mỗi order item 1 đánh giá"? —
   *Khuyến nghị:* **Có**.
5. **Khách tự xoá** đánh giá của mình? Đánh giá của đơn **đã hoàn tiền** xử lý thế nào? — *Khuyến nghị:* cho tự xoá;
   đơn hoàn tiền → tự chuyển đánh giá sang HIDDEN (lý do `REFUNDED`), không tính TB.
6. **Nội dung đánh giá:** bắt buộc viết chữ hay chỉ chấm sao cũng được; độ dài; định dạng tên hiển thị? —
   *Khuyến nghị:* chữ tuỳ chọn, tối đa 2000 ký tự; tên dạng "Minh A." (tên + chữ cái đầu họ), khách xem trước.
7. **Kiểm duyệt:** tự đăng (VISIBLE ngay) + tenant ẩn bắt buộc lý do + có khôi phục; công khai số đánh giá bị ẩn? —
   *Khuyến nghị:* tự đăng; ẩn phải chọn lý do; **không** công khai số bị ẩn ở GĐ1 nhưng người viết vẫn thấy nhãn "đã bị
   ẩn".
8. **Nút "Báo cáo"** trên đánh giá/bài viết: làm cùng M10 hay đợi M12? — *Khuyến nghị:* đợi M12.
9. **Section `testimonials`:** thay hẳn bằng đánh giá thật, hay thêm nguồn "Đánh giá thật" song song "Nhập tay"
   (đổi nhãn nhập tay thành "Cảm nhận")? Tự động hay tenant chọn tay đánh giá nào? — *Khuyến nghị:* thêm nguồn song
   song, mặc định giữ nhập tay cho dữ liệu cũ; nguồn thật = tự động N đánh giá ≥4 sao có nội dung, tenant có thể chọn tay.
10. **Ngưỡng hiện sao** trên thẻ tài liệu — *Khuyến nghị:* hiện từ 1 đánh giá (kèm số lượng), vì ẩn dễ gây hiểu nhầm
    "chưa ai mua".
11. **Điểm TB:** cột cache số nguyên trên `products` (lệch `float` của ERD, dựa vào policy `products` hiện tại) hay tính
    động? — *Khuyến nghị:* cache `ratingSum/ratingCount` (A), kèm task riêng siết policy `products`.
12. **SEO `AggregateRating`** làm ở M10? — *Khuyến nghị:* **Không** (đặc tả để GĐ3).
13. **Email thông báo** đánh giá mới (cho owner) / trả lời (cho khách) có trong M10 không? Admin có cần thấy gì về
    đánh giá (ngoài luồng báo cáo M12)? — *Khuyến nghị:* email cho owner khi có đánh giá mới (gửi trong `after()`, mẫu
    như hộp thư); không email cho khách ở GĐ1; admin không có route đọc đánh giá (§7.9).
14. **Nâng trần test** từ 94/53 lên 97/55 cho M10 (và 97/57 khi làm M12)? Đồng ý thay nội dung integration #3 nếu bỏ
    bình luận? — *Khuyến nghị:* duyệt 97/55 ngay khi chốt phạm vi; M12 duyệt riêng.

---

## 11. Mục còn 🟡 / ❓

- 🟡 Thông lệ Gumroad/Payhip/Shopify (Judge.me, Loox)/Substack/Patreon — tham khảo, chưa kiểm chứng nguồn.
- 🟡 Chính sách Google về rich result đánh giá tự phục vụ; Nghị định 13/2023/NĐ-CP về hiển thị tên người dùng — cần
  kiểm chứng/tư vấn pháp lý.
- 🟡 Ước lượng S/M/L — Long ước, Hiếu/Phong cần xác nhận.
- ❓ Hành vi policy INSERT có `EXISTS` lồng qua RLS `orders/order_items/entitlements` dưới scope customer — hợp lý theo
  SQL nhưng phải chạy thật trên Neon (integration test) mới khẳng định.
- ❓ Rate limit in-memory khi deploy nhiều instance.
- ❓ Hiệu năng truy vấn feed/danh sách đánh giá theo cursor với dữ liệu lớn.

## 12. Lệch giữa tài liệu và code phát hiện khi viết kế hoạch

- `docs/PLAN.md` bảng trạng thái: dòng **Tổng** ghi 91/50 nhưng cộng các dòng hiện có ra **92/51** (M3 ghi 11/7, M8
  10/9… đã khác bảng §9), và không phản ánh trần 94/53 của ADR-026 ✅. Đề nghị Quốc cập nhật PLAN (Long không sửa PLAN
  theo brief).
- `docs/GIEOCHU_PROMPT_MVP_PHASE1.md` §5.2 `PRODUCTS` có `float ratingAvg/int ratingCount` — schema thật chưa có, comment
  schema nói "M10 adds" ✅ (không phải lỗi, chỉ lưu ý khi làm M10).
- Đặc tả M4 "tab Bài viết/Tài liệu/Đánh giá" và "sitemap" — đã bị ADR-023/025 thay thế (tab) / chưa làm (sitemap) ✅.
- Policy `products` `FOR ALL USING` không `WITH CHECK` → public/customer UPDATE được ở mức DB ✅ (mục 4.8, 9) — chưa được
  nêu trong ADR-020 hay KB `Database-Schema-Reference.md`; Long sẽ ghi vào KB-Audit khi Quốc xác nhận.

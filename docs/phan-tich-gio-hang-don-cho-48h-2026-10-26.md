# Phân tích: giỏ hàng, đơn chờ 48 giờ, thông báo và email tải tài liệu — 2026-10-26

> **Người viết:** Hiếu (kỹ sư lập trình), theo brief của Quốc. **Người đọc:** Quốc → chủ dự án.
> **Loại tài liệu:** phân tích + đề xuất, **chưa code, chưa migration**. Không có quyết định nào ở đây có hiệu lực cho tới khi
> chủ dự án chốt và Quốc ghi ADR.
> **Đầu vào:** chủ dự án chốt câu 6, 7, 8 của `docs/de-xuat-ui-khach-hang-ban-toi-uu-2026-10-26.md` (a)–(e).
> **Mức xác minh:** ✅ Hiếu đã đọc code working tree 2026-10-26 (gồm thay đổi ADR-059 chưa commit) · 🟡 suy luận/ước lượng ·
> ❓ cần môi trường thật.

## Tóm tắt nhanh

| Câu hỏi | Trả lời ngắn |
|---|---|
| Giỏ hàng là L2 hay L3? | **L3** (dữ liệu của khách, đọc/ghi qua `withCustomer`). Bảng mới `cart_items` có `tenantId` để nhóm theo gian hàng, nhưng **không có nhánh tenant** trong RLS: người bán không thấy giỏ của khách. |
| Giỏ nhiều gian hàng thành đơn thế nào? | **Mỗi gian hàng một đơn** (tiền về thẳng tài khoản từng người bán, ADR-039; QR/SePay theo từng gian hàng). Đề xuất: khách thanh toán **từng gian hàng một** từ giỏ; một đơn chứa được **nhiều tài liệu của cùng gian hàng**. |
| Cần migration không? | **Có**, chỉ mở rộng: bảng `cart_items` + RLS; vài cột đánh dấu đã gửi email trên `orders` (khuyến nghị). Nâng hạn đơn lên 48 giờ **không** cần migration (chỉ đổi giới hạn trong code). |
| Đơn chờ 48 giờ có bớt được cron không? | **Gần như không.** Hệ thống đã "hết hạn lười" khi đọc (ADR-036) từ trước; cron hằng ngày còn chạy thuê bao, dọn log, dọn job… Bỏ bước quét đơn chỉ bớt một bước nhỏ. Muốn **nhắc khách trước hạn** thì *lại cần* cron. |
| Mã giảm giá có bị "giữ chỗ" 48 giờ không? | **Không giữ chỗ** — lượt dùng chỉ trừ khi đơn đã thanh toán ✅. Rủi ro ngược lại: nhiều đơn chờ cùng dùng một mã giới hạn → đơn trả sau vẫn được giảm (COUPON_OVERUSED). Cần chủ dự án chốt. |
| Header báo "có đơn cần thanh toán"? | Đã có sẵn số đơn chờ (`pendingOrderCount`) trong dữ liệu khu vực tài khoản ✅ — chỉ cần hiển thị, chi phí thêm ≈ 0. |
| Email thanh toán thành công có nút tải? | Email **đã có** link tới `/account/library` ✅. **Không** đặt presigned URL hay token tải vào email (quy tắc bảo mật 6). Đề xuất: nút "Tải tài liệu" trỏ tới thư viện (bắt buộc đăng nhập). |
| Bắt buộc xác minh email trước khi mua? | **Server đã chặn** ở Server Action mua và checkout ✅ (`requireVerifiedAccess`). Thiếu: lib `createOrder` không tự kiểm, và luồng đăng ký/kích hoạt **không giữ trang đang mua** (`next`). |
| Công sức | Khoảng **9–12 ngày Hiếu + 4–5 ngày Phong** cho trọn gói (xem §6). Có thể tách: phần 48 giờ + thông báo (≈ 3–4 ngày) làm trước, giỏ hàng sau. |

---

## 1. Mô hình dữ liệu giỏ hàng

### 1.1. Hiện trạng liên quan ✅

- "Mua ngay" tạo **ngay một đơn PENDING 1 tài liệu** (`buyProductAction` → `createOrder`), rồi chuyển sang `/{tenant}/checkout/{mã đơn}`.
  Bấm lại "Mua ngay" **luôn tạo đơn mới** (không kiểm đơn chờ cũ).
- `Order` thuộc **một** gian hàng (`orders.tenantId`), có quan hệ `items[]` (`order_items`). Bộ tính giá
  `calculateOrderPricing` và `markOrderPaid` **đã xử lý nhiều dòng** (vòng lặp từng item, sinh entitlement theo từng
  `orderItemId`). Giới hạn "mỗi đơn 1 sản phẩm" hiện chỉ nằm ở `createOrder` và một vài chỗ hiển thị/email lấy `items[0]`.
- RLS `products`: scope **customer** chỉ đọc được sản phẩm **đã có entitlement**; sản phẩm đang bán đọc qua scope **public**
  (`status = PUBLISHED`) ✅ (migration `rls_m9_products_customer`).

### 1.2. Đề xuất bảng `cart_items` (L3)

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `id` | `String @id @default(cuid(2))` | cuid2 |
| `userId` | `String` → `users.id` (onDelete Cascade) | chủ giỏ |
| `tenantId` | `String` → `tenants.id` (onDelete Cascade) | để **nhóm theo gian hàng** và tách đơn; không cho người bán đọc |
| `productId` | `String` → `products.id` (onDelete Cascade) | |
| `createdAt` | `DateTime @default(now())` | sắp xếp, dọn giỏ cũ (nếu muốn) |

- **Chặn trùng:** `@@unique([userId, productId])` — thêm lần 2 là no-op ("Đã có trong giỏ").
- **Không lưu giá.** Giá hiển thị và tổng tiền tính lúc xem/lúc tạo đơn bằng `calculateOrderPricing` (§7.5 — không tin giá cũ).
  Sản phẩm hết bán / đổi giá / hết khuyến mãi → giỏ hiện trạng thái mới ("Không còn bán", giá mới).
- **RLS:** `ENABLE` + `FORCE`, policy:
  `"userId" = current_setting('app.user_id', true) AND current_setting('app.scope', true) = 'customer'` cho mọi thao tác,
  cộng nhánh `system_job` (dọn dẹp). **Không** có nhánh `tenant` / `public`.
- **Đọc giỏ:** `cart_items` qua `withCustomer(userId)`; thông tin sản phẩm (tên, giá, ảnh bìa, trạng thái) qua `withPublic`
  (chỉ thấy `PUBLISHED`) — dòng nào không đọc được thì hiện "Không còn bán" và cho xoá. Tên gian hàng đọc từ `tenants` (L1).
  → Một trang giỏ nhiều gian hàng **không** cần `withTenant` cho từng gian hàng.
- **Ghi giỏ:** thêm/xoá qua `withCustomer`. Khi thêm: kiểm sản phẩm `PUBLISHED`, gian hàng `ACTIVE`, không phải sản phẩm của
  chính mình, chưa sở hữu (`canPurchaseProduct`) — kiểm lại ở server.
- **Migration:** expand-only (bảng mới + policy), theo ADR-034. Cần **integration test RLS thật** (khách A không đọc/ghi được
  giỏ khách B; scope tenant không đọc được giỏ).
- **Giới hạn số dòng** (chống lạm dụng): đề xuất tối đa 50 tài liệu/giỏ 🟡.

> Lưu ý quy ước CLAUDE.md "mọi bảng có `tenantId` qua 4 hàm RLS": `cart_items` thoả (dùng `withCustomer`/`withSystemJob`), nhưng
> nên ghi rõ trong ADR rằng đây là bảng L3 có `tenantId` chỉ để nhóm, giống `entitlements`.

### 1.3. Từ giỏ sang đơn

- **Một đơn = một gian hàng** là bắt buộc: tiền về tài khoản riêng từng người bán (ADR-039), cổng thanh toán theo
  `PaymentScope {kind:"TENANT", tenantId}`, mã đơn mang tiền tố gian hàng, webhook theo `tenantId`.
- **Đề xuất:** trang giỏ nhóm theo gian hàng, mỗi nhóm có nút **"Thanh toán (N tài liệu)"** → tạo **1 đơn nhiều dòng** cho gian
  hàng đó, xoá các dòng tương ứng khỏi giỏ **sau khi** đơn tạo thành công, chuyển sang checkout của đơn đó. Khách mua ở 2 gian
  hàng thì thanh toán 2 lần (2 QR) — đúng bản chất "tiền về từng người bán".
- **"Mua ngay"** trên trang tài liệu: giữ (đi thẳng 1 đơn 1 tài liệu) hay đổi thành "Thêm vào giỏ"? → câu hỏi Q2.
- **Việc phải sửa để có đơn nhiều dòng** ✅ (đã rà):
  - `createOrder` nhận danh sách `productId` (cùng tenant), kiểm từng dòng, `calculateOrderPricing` với nhiều dòng.
  - Mã giảm giá: `calculateOrderPricing` đã hỗ trợ nhiều dòng; cần kiểm lại `NOT_APPLICABLE` khi mã chỉ áp một phần sản phẩm.
  - Email `new_sale` (`items[0]`), `order_pending_manual` (đã nối tên nhiều dòng ✅), timeline/chi tiết đơn Studio, trang checkout.
  - **Hoàn tiền**: hiện `markOrderRefunded` thu hồi **toàn bộ** entitlement của đơn — đơn nhiều dòng chỉ hoàn **cả đơn**, không
    hoàn từng tài liệu (câu hỏi Q4).
  - Chặn đơn chờ trùng (§2.5) phải xét theo **từng tài liệu**.

---

## 2. Đơn chờ thanh toán 48 giờ

### 2.1. Hiện trạng ✅

- `orderPendingTtlMinutes` mặc định 60, **giới hạn cho phép 15–1440 phút** (`SYSTEM_SETTINGS_BOUNDS`) — 48 giờ = **2880 phút**
  vượt trần → phải nâng trần trong code (`packages/core`), **không cần migration** (cột `Int`).
- Trạng thái hiệu lực: `effectiveOrderStatus` — PENDING quá `expiresAt` được coi là **EXPIRED ở mọi nơi đọc/quyết định** ngay cả
  khi cron chưa ghi (ADR-036) ✅. Danh sách đơn Studio lọc theo trạng thái hiệu lực bằng SQL ✅.
- Xác nhận tay của người bán: còn PENDING, hoặc EXPIRED **trong 24 giờ** sau `expiresAt` (`canManuallyConfirmOrder`,
  `manualConfirmDeadline`, hằng số 24 giờ trong code) ✅. Webhook SePay/MoMo đến trễ dùng cùng cửa sổ ✅.
- Cron `GET /api/cron/daily` chạy **một lần/ngày** và làm nhiều việc: quét thuê bao, quét đơn (`runOrderSweep`), dọn audit,
  IP báo cáo, refresh token, download events, bảo trì hàng đợi ✅.

### 2.2. Tác động lên FSM đơn

- FSM **không đổi**: `PENDING → (MARK_PAID) PAID → FULFILLED`, `PENDING → EXPIRE → EXPIRED`, `PENDING → CANCEL`.
- Với TTL 48 giờ: người bán xác nhận tay được tới **48 + 24 = 72 giờ** sau khi tạo đơn. Câu hỏi Q5: giữ cửa sổ trễ 24 giờ hay
  bỏ (đặt 0) vì 48 giờ đã đủ dài. Hiếu đề xuất **giữ 24 giờ** — nó bảo vệ khách đã chuyển khoản sát hạn và webhook đến trễ.
- `expiresAt` tính **lúc tạo đơn** (`computeOrderExpiresAt`). Đổi TTL chỉ áp cho đơn mới; đơn cũ giữ hạn cũ.
- Giá trong đơn **chốt lúc tạo** (`subtotal/total` lưu trên đơn). Khuyến mãi hết hạn trong 48 giờ thì khách vẫn trả giá cũ —
  hợp lý (đơn là báo giá đã chốt), nhưng cần nói rõ trong hướng dẫn.
- Tài liệu bị gỡ/lưu trữ trong 48 giờ: khách **không** tiếp tục thanh toán được (`assertOrderProductsPurchasable`) ✅; tiền đã về
  thì người bán vẫn xác nhận được, entitlement sinh ở `PENDING_CHOICE` (ADR-039) ✅.

### 2.3. Còn cần cron quét đơn không? "Bớt cron" đúng tới đâu

- **Hết hạn lười đã đủ cho đúng nghiệp vụ**: mọi quyết định (thanh toán, xác nhận, áp mã, hiển thị) đã dùng trạng thái hiệu
  lực ✅. `runOrderSweep` chỉ để **cột `status` trong DB khớp thực tế** (thống kê, truy vấn trực tiếp, `tenant_daily_stats`).
  Có thể giữ nguyên (rẻ) — **không nên bỏ** vì báo cáo/thống kê đọc cột thô.
- **Không bớt được cron**: cron hằng ngày vẫn phải chạy cho thuê bao, dọn dữ liệu, hàng đợi. Bỏ bước quét đơn chỉ tiết kiệm một
  câu `UPDATE` mỗi ngày.
- **Thứ thật sự bớt được** là **đếm ngược trên checkout** + vòng hỏi trạng thái dày (đơn 60 phút buộc khách vội). Với 48 giờ chỉ
  cần hiện **giờ hết hạn** ("Thanh toán trước HH:MM ngày dd/mm") — đúng mục đích (b).
- **Ngược lại:** muốn **nhắc khách trước hạn** (§3.2) thì phải có tác vụ định kỳ — dùng luôn cron hằng ngày (đủ, xem §3.2).

### 2.4. Mã giảm giá trong 48 giờ ✅ (đã rà code)

- Lượt dùng **không bị giữ chỗ** khi đơn đang chờ: `usedCount` chỉ tăng và `couponRedemption` chỉ ghi trong `markOrderPaid`, bằng
  `UPDATE … WHERE usedCount < usageLimit` (nguyên tử). Đơn hết hạn không chiếm lượt.
- **Rủi ro mới khi kéo dài 48 giờ:**
  1. **Giới hạn tổng (`usageLimit`):** nhiều khách cùng áp một mã giới hạn N lượt, đơn trả sau khi hết lượt **vẫn PAID với giá đã
     giảm**, chỉ ghi audit `COUPON_OVERUSED` (hành vi M8). Cửa sổ 48 giờ làm việc này hay xảy ra hơn.
  2. **Giới hạn mỗi khách (`perCustomerLimit`):** chỉ đếm lượt **đã trả** → một khách tạo được nhiều đơn chờ cùng mã.
  3. Mã hết hạn (`endsAt`) trong 48 giờ: đơn đã áp vẫn giữ giảm giá.
- **Đề xuất (Q6):** (2) đếm thêm **đơn chờ còn hiệu lực của chính khách** có cùng mã khi kiểm `perCustomerLimit` (code nhỏ, không
  migration). (1) giữ hành vi hiện tại (người bán chịu phần vượt) **hoặc** đếm cả đơn chờ vào `usageLimit` (giữ chỗ thật — mã có
  thể "hết" vì đơn treo không trả). Hiếu nghiêng về **giữ hiện tại** cho beta, kèm hiển thị cảnh báo cho người bán.

### 2.5. Chặn đơn chờ trùng tài liệu

- **Đề xuất:** trước khi tạo đơn (mua ngay hoặc thanh toán từ giỏ), tìm đơn **còn hiệu lực PENDING** của khách có chứa tài liệu đó
  (`withCustomer`, `status = PENDING AND expiresAt > now`). Có → **không tạo đơn mới**, chuyển hướng về checkout đơn cũ ("Bạn có đơn
  đang chờ thanh toán cho tài liệu này").
- Đơn đã **hết hạn nhưng còn trong cửa sổ người bán xác nhận** (+24 giờ) và khách **đã chọn chuyển khoản tay**: không chặn cứng,
  nhưng hiện cảnh báo "Nếu bạn đã chuyển khoản cho đơn X, đừng đặt lại" (khớp câu 7 đã chốt).
- Giỏ nhiều dòng: dòng nào đang nằm trong đơn chờ khác thì **loại khỏi đơn mới** và báo khách.
- Race hai tab bấm cùng lúc: kiểm trong transaction có khoá theo khách (ví dụ `pg_advisory_xact_lock(hashtext(userId))`) 🟡 — nhẹ,
  không cần bảng mới.

---

## 3. Thông báo

### 3.1. Notification trên header khu vực tài khoản

- **Đã có dữ liệu** ✅: `getAccountOverview` đếm `orders` của chính khách `status = PENDING AND expiresAt > now` qua `withCustomer`;
  layout `/account` đã dùng (`pendingOrderCount` trên sidebar), kết quả `cache()` theo request → **không tốn thêm truy vấn**.
- Việc cần làm: hiện câu "Anh/Chị {tên} có đơn cần thanh toán để hoàn tất đơn hàng!" trên header (`AccountShell`) khi
  `pendingOrderCount > 0`, link tới `/account/orders?status=PENDING` (hoặc giỏ). Tên lấy `profile.fullName` (đã đọc trong
  overview), thiếu thì bỏ phần tên ("Bạn có …"). "Anh/Chị" là cách xưng cố định — chấp nhận được (không phải chuỗi thương hiệu).
- Header **trang công khai** (SiteHeader) cũng muốn hiện? → Q8. Nếu có: thêm 1 `count` có index `orders(customerId)` ✅ mỗi lần
  render trang công khai khi đã đăng nhập — vẫn rẻ, nhưng làm trang công khai thành động theo user (ảnh hưởng cache). Đề xuất
  **chỉ ở khu vực tài khoản** + biểu tượng giỏ ở header công khai (đếm `cart_items`, cũng 1 count).

### 3.2. Email nhắc khách

| Thời điểm | Cần cron? | Đề xuất |
|---|---|---|
| **Ngay khi khách chọn cổng** (đơn đã có QR/thông tin CK) | Không — gửi sau response bằng `after()`, cùng chỗ email báo người bán (B1) | **Làm.** Nội dung: mã đơn, danh sách tài liệu, tổng tiền, **hạn thanh toán**, thông tin chuyển khoản (ngân hàng, số TK, tên, nội dung = mã đơn) **hoặc** nút "Tiếp tục thanh toán" về trang checkout. |
| Khi tạo đơn mà **chưa chọn cổng** | Không | Không gửi (chưa có gì để trả); header + giỏ đã nhắc. |
| **Nhắc 1 lần trước hạn** (ví dụ còn ≤ 24 giờ) | **Có** — dùng cron hằng ngày | Làm nếu chủ dự án muốn (Q7). Với TTL 48 giờ, mọi đơn đều còn chờ trong ít nhất 1 lần chạy cron có "còn ≤ 24 giờ", nên một lần chạy/ngày là đủ. |

- **Chặn gửi trùng:**
  - Email lúc chọn cổng: hiện B1 dựa vào "lần đầu `provider` từ null → có giá trị" (khoá dòng `FOR UPDATE`) ✅ — không cần cột.
  - **Lỗ hổng Long nêu là đúng** ✅: điều kiện "lần đầu provider từ null" khiến **đổi cổng** (SePay → QR tay, hiện chỉ làm được
    bằng request tự dựng vì UI không cho đổi) thì **không** gửi email người bán. Nếu sắp tới cho khách "đổi phương thức" (giỏ/48 giờ
    làm việc này dễ xảy ra hơn) thì nên đổi sang **cột đánh dấu**: `orders.ownerManualNotifiedAt`, `orders.customerPaymentNotifiedAt`,
    `orders.customerReminderSentAt` (`DateTime?`, expand-only), ghi bằng `UPDATE … WHERE col IS NULL` (nhận nguyên tử) rồi mới gửi.
  - Email nhắc từ cron: bắt buộc dùng cột `customerReminderSentAt` theo cách trên (cron có thể chạy lại).
- **Thông tin chuyển khoản trong email có được không?** Được: số TK, tên chủ TK, ngân hàng **đã công khai** trên QR ở checkout cho
  chính khách này; email gửi **tới chính khách** (L3). Không có secret (SePay/MoMo secret không bao giờ nằm trong `checkoutPayload`
  ✅). Lưu ý: (1) email phải lấy **checkoutPayload hiện tại** — sau khi áp mã giảm giá QR được tạo lại (ADR-056), nên email nhắc
  phải ghi "nếu số tiền khác email trước, dùng số mới / mở trang thanh toán"; (2) không nhúng ảnh QR base64 lớn vào email (nhiều
  hộp thư chặn) — nên dùng thông tin dạng chữ + nút về checkout.
- Loại email khách hàng mới (`order_payment_pending_customer`, `order_payment_reminder`) phải vào `TENANT_CUSTOMER_FACING_TYPES`
  (không ghi `email_send_log`, §7.9).

### 3.3. Báo người bán "Kiểm tra thanh toán cho các đơn hàng chờ xác nhận"

- **Đã có** email `order_pending_manual` theo từng đơn (B1) ✅: gửi khi khách chọn chuyển khoản tay, có hạn chót xác nhận.
- Với 48 giờ, đề xuất thêm **bản tổng hợp hằng ngày** cho người bán (cron): "Bạn có N đơn chờ xác nhận chuyển khoản" kèm link
  Studio → Đơn hàng lọc "Chờ thanh toán". Chặn trùng: một lần/ngày/gian hàng — dùng audit `TENANT_PENDING_DIGEST_SENT` có ngày
  (không migration) hoặc chấp nhận trùng khi cron chạy lại 🟡. Câu hỏi Q9.
- Studio cũng nên có dòng báo trên Tổng quan/Đơn hàng (giống "Giao dịch cần xử lý" của B2b) — rẻ, không cần email.
- §7.9: email gửi **chủ gian hàng** (L2), System Admin không nhận, không ghi log có mã đơn.

---

## 4. Bắt buộc xác minh email trước khi mua

### 4.1. Hiện trạng ✅

- Server Action **"Mua ngay"** (`buyProductAction`) và **mọi action ở checkout** (`selectProviderAction`, áp/gỡ mã) đều gọi
  `requireVerifiedAccess()`: chưa đăng nhập → `/login?next=…`; đăng nhập nhưng **chưa xác minh** → `/verify-email?pending=1`.
  Trang checkout cũng gọi guard này. → **Tài khoản chưa xác minh hiện KHÔNG mua được** ✅.
- Thiếu sót:
  1. `requireVerifiedAccess` đọc cờ `ver` trong **access token (JWT)**, không đọc DB. Lib `createOrder` **không tự kiểm**
     xác minh/khoá tài khoản → mọi nơi gọi `createOrder` sau này (giỏ) phải nhớ gọi guard.
  2. Redirect chưa xác minh đi `/verify-email?pending=1` **mất trang đang mua**.
  3. Đăng ký gắn `next` cố định vào link kích hoạt (`TENANT → /studio`, còn lại `/`) — **không mang theo trang tài liệu** khách
     đang xem ✅ (`api/auth/register/route.ts`). Long đã gom vào T2.

### 4.2. Đề xuất

- **Server (Hiếu):** kiểm lại trong lib (defense in depth) ở `createOrder`/tạo đơn từ giỏ: `users.emailVerifiedAt IS NOT NULL` và
  tài khoản `ACTIVE` (đọc DB, L1). Thêm/xoá giỏ: yêu cầu **đăng nhập** (giỏ lưu server); có bắt buộc **đã xác minh** để thêm vào giỏ
  không → Q1 (Hiếu đề xuất: thêm giỏ chỉ cần đăng nhập, **thanh toán** mới cần xác minh — đỡ mất khách ở bước đầu).
- **UI khi chưa có tài khoản (Phong):** nút "Mua/Thêm vào giỏ" với khách chưa đăng nhập hiện khối mời "Tạo tài khoản để mua tài
  liệu" (đăng ký / đăng nhập), giữ `next` = trang tài liệu.
- **returnTo:** truyền `next` (đã lọc bằng `toSafeRedirect`) xuyên suốt: trang tài liệu → `/register?next=` → API register gắn vào
  link kích hoạt (thay `next` cố định với tài khoản khách) → `/verify-email?token=…&next=` → sau kích hoạt về đúng trang tài liệu.
  `requireVerifiedAccess` chuyển `/verify-email?pending=1&next=…`. Lưu ý: chỉ nhận đường dẫn nội bộ (chống open redirect, đã có
  `toSafeRedirect`) ✅.

---

## 5. Email tải tài liệu (câu e)

### 5.1. Hiện trạng ✅

- Email "thanh toán thành công" (`order_paid`) **đã có** dòng "Tải tài liệu: {APP_URL}/account/library" và link ✅.
- Luồng tải hiện tại: thư viện (`/account/library`, bắt buộc đăng nhập + xác minh) → `requestDownload` cấp **token dùng một lần sống
  60 giây** (lưu hash) → `GET /api/downloads/{token}` đổi token lấy **presigned URL ≤ 10 phút**, `Content-Disposition: attachment`,
  kiểm entitlement + giới hạn lượt ✅.

### 5.2. Đánh giá theo quy tắc bảo mật 6

- **Không** đặt presigned URL vào email: hết hạn ≤ 10 phút, khách mở email muộn là hỏng; lộ nếu email bị chuyển tiếp.
- **Không** đặt token tải dài hạn vào email: email là kênh không an toàn (chuyển tiếp, máy dùng chung, quét link tự động của hộp thư
  sẽ "tiêu" token một lần hoặc tải hộ → trừ lượt tải của khách). Trái tinh thần quy tắc 6 và ADR-054 (giới hạn lượt).
- **Đề xuất (đồng ý với Quốc):** nút **"Tải tài liệu"** trong email trỏ tới **`/account/library`** (hoặc trang chi tiết đơn của khách,
  nếu làm), bắt buộc đăng nhập; chưa đăng nhập thì `/login?next=/account/library`. Có thể thêm `?highlight={productId}` để thư viện
  cuộn tới đúng tài liệu (không lộ gì vì vẫn phải đăng nhập).
- Phương án khác đã cân nhắc: "magic link đăng nhập" trong email (token đăng nhập ngắn hạn) — **không đề xuất**: biến email thành khoá
  đăng nhập, mở rộng bề mặt tấn công, ngoài phạm vi beta.
- Việc còn lại chỉ là **trình bày** (nút thay cho link trần) — Phong + Hiếu sửa template, ≈ 0,25 ngày.

---

## 6. Ước lượng công sức (🟡)

| # | Task | Ai | Công | Migration |
|---|---|---|---|---|
| 1 | Nâng trần `orderPendingTtlMinutes` lên 2880 (core + form System Settings + test assertion); chủ dự án đặt 2880 trong `/admin/settings` | Hiếu | 0,25 ngày | Không |
| 2 | Checkout bỏ đếm ngược, hiện giờ hết hạn + hạn chót xác nhận (T4 của Long, phần dữ liệu) | Hiếu S + Phong M | 0,5 + 1 ngày | Không |
| 3 | Chặn đơn chờ trùng (redirect về đơn cũ, khoá theo khách) | Hiếu | 0,5 ngày | Không |
| 4 | Header tài khoản "có đơn cần thanh toán" (dữ liệu đã có) | Phong (Hiếu truyền `fullName`) | 0,5 ngày | Không |
| 5 | Cột đánh dấu email trên `orders` (`ownerManualNotifiedAt`, `customerPaymentNotifiedAt`, `customerReminderSentAt`) + chuyển B1 sang cột | Hiếu | 0,75 ngày | **Có** (3 cột `DateTime?`) |
| 6 | Email khách lúc chọn cổng (thông tin CK + nút checkout) | Hiếu (template + gửi) | 0,75 ngày | Không (nếu đã có #5) |
| 7 | Email nhắc trước hạn qua cron hằng ngày | Hiếu | 0,75 ngày | Không (dùng #5) |
| 8 | Tổng hợp hằng ngày cho người bán (cron) + dòng báo Studio | Hiếu + Phong (dòng báo) | 0,75 + 0,25 ngày | Không |
| 9 | Xác minh email: kiểm DB trong lib, `next` qua đăng ký/kích hoạt (T2) | Hiếu | 0,75 ngày | Không |
| 10 | Khối mời tạo tài khoản ở trang tài liệu | Phong | 0,5 ngày | Không |
| 11 | Coupon `perCustomerLimit` đếm cả đơn chờ (nếu chốt) | Hiếu | 0,25 ngày | Không |
| 12 | Bảng `cart_items` + RLS + test RLS thật | Hiếu | 1 ngày | **Có** |
| 13 | Lib giỏ: thêm/xoá/đọc (withCustomer + withPublic), giới hạn dòng | Hiếu | 1 ngày | Không |
| 14 | Đơn nhiều dòng: `createOrder` nhiều sản phẩm, email/chi tiết đơn/checkout nhiều dòng, coupon nhiều dòng, hoàn cả đơn | Hiếu | 2–2,5 ngày | Không |
| 15 | Thanh toán từ giỏ theo từng gian hàng (tạo đơn, xoá dòng, redirect) | Hiếu | 0,75 ngày | Không |
| 16 | UI trang giỏ (nhóm theo gian hàng, trạng thái "không còn bán", rỗng/lỗi/loading), nút "Thêm vào giỏ", biểu tượng giỏ header | Phong | 2 ngày | — |
| 17 | Email "thanh toán thành công" dạng nút trỏ thư viện | Phong + Hiếu | 0,25 ngày | Không |
| 18 | Long cập nhật spec (Order-State-Machine, Cart mới, email, Auth T2) | Long | — | — |

**Tổng 🟡:** Hiếu ≈ 9,5–12 ngày, Phong ≈ 4,5–5 ngày. **Thứ tự đề xuất:** đợt 1 = #1–#11, #17 (48 giờ + thông báo + xác minh,
≈ 6 ngày Hiếu, migration nhỏ #5); đợt 2 = #12–#16 (giỏ hàng, migration bảng mới).

---

## 7. Câu hỏi cần chủ dự án chốt (kèm đề xuất của Hiếu)

| # | Câu hỏi | Đề xuất của Hiếu |
|---|---|---|
| Q1 | Thêm vào giỏ có cần **đã xác minh email** không, hay chỉ cần đăng nhập (xác minh lúc thanh toán)? | Chỉ cần **đăng nhập**; **thanh toán** bắt buộc đã xác minh (server chặn). |
| Q2 | Giữ nút **"Mua ngay"** (đi thẳng 1 đơn) song song "Thêm vào giỏ", hay chỉ còn giỏ? | **Giữ cả hai**: "Mua ngay" = thêm vào giỏ + thanh toán ngay gian hàng đó. Ít bước cho người mua 1 tài liệu. |
| Q3 | Giỏ nhiều gian hàng: thanh toán **từng gian hàng một** (mỗi gian hàng 1 đơn, 1 QR) có chấp nhận được? | **Có** — bắt buộc vì tiền về thẳng từng người bán (ADR-039). Trang giỏ ghi rõ "Mỗi gian hàng thanh toán riêng". |
| Q4 | Đơn nhiều tài liệu: hoàn tiền **cả đơn** là đủ, hay cần hoàn **từng tài liệu**? | **Cả đơn** cho beta (code hiện tại). Hoàn từng dòng là việc lớn (entitlement, thống kê, coupon) — để sau. |
| Q5 | Cửa sổ người bán xác nhận trễ (+24 giờ sau hạn) giữ hay bỏ khi đơn đã chờ 48 giờ? | **Giữ 24 giờ** (tổng 72 giờ) — bảo vệ khách chuyển sát hạn, webhook trễ. |
| Q6 | Mã giảm giá trong 48 giờ: (a) `perCustomerLimit` đếm cả đơn chờ của khách? (b) `usageLimit` có giữ chỗ cho đơn chờ không? | (a) **Có**. (b) **Không giữ chỗ** (giữ hành vi M8: trả sau khi hết lượt vẫn được giảm, ghi audit) — tránh mã "hết" vì đơn treo. |
| Q7 | Email nhắc khách: chỉ gửi **lúc chọn cổng**, hay thêm **1 lần nhắc trước hạn** (cron)? | Gửi lúc chọn cổng **+ 1 lần nhắc** khi còn ≤ 24 giờ (cron hằng ngày đã có). Không nhắc đơn chưa chọn cổng. |
| Q8 | Thông báo "có đơn cần thanh toán" chỉ ở header **khu vực tài khoản**, hay cả header trang công khai? | Chỉ **khu vực tài khoản** + **biểu tượng giỏ** (có số) ở header công khai. |
| Q9 | Người bán: ngoài email từng đơn (đã có), có cần **email tổng hợp hằng ngày** "N đơn chờ xác nhận"? | **Có**, 1 email/ngày khi N > 0, kèm dòng báo trên Studio. |
| Q10 | Cho khách **đổi phương thức thanh toán** của đơn đang chờ (SePay ↔ chuyển khoản tay)? | **Chưa cho** trong beta (UI hiện không cho). Nếu cho thì bắt buộc làm task #5 (cột đánh dấu) để email người bán không bị sót/trùng. |
| Q11 | Giỏ có tự dọn dòng cũ không (ví dụ sau 90 ngày)? | **Không dọn** trong beta; chỉ ẩn dòng "không còn bán" khi khách xoá. Xem lại sau. |
| Q12 | Email "thanh toán thành công": nút tải trỏ **thư viện** (bắt buộc đăng nhập) — đồng ý không đặt link tải trực tiếp? | **Đồng ý** (quy tắc 6). Nút "Tải tài liệu" → `/account/library?highlight=…`. |
| Q13 | Đơn chờ 48 giờ áp dụng cho **cả SePay** (tự xác nhận) hay chỉ chuyển khoản tay? | **Một hạn chung** 48 giờ (đơn giản, một cấu hình) — SePay trả xong là xong sớm. |

---

Liên quan: `docs/de-xuat-ui-khach-hang-ban-toi-uu-2026-10-26.md` (Long) · `docs/DECISIONS.md` (ADR-030, 034, 036, 037, 039, 054, 056, 059) ·
code: `apps/web/lib/order.ts`, `payment-process.ts`, `account-profile.ts`, `download.ts`, `page-guards.ts`,
`app/[tenantSlug]/[productSlug]/actions.ts`, `app/api/auth/register/route.ts`, `packages/core/src/settings/system-settings.ts`,
`packages/core/src/order/expiry.ts`, migration `rls_m9_products_customer`.

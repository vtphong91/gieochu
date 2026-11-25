---
tags:
  - spec
  - order
  - status/living
date: 2026-09-26
updated: 2026-11-25
author: System Architect
---

# 📐 Đặc Tả: Vòng Đời Trạng Thái Đơn Hàng (Order State Machine)

## 1. Trạng Thái Đơn Hàng Chuẩn (OrderStatus Enum)

Gieo Chữ bán tài liệu số — đơn hàng **không có** giao hàng vật lý, chuẩn bị món, hay shipper. `OrderStatus`
định nghĩa tại `packages/db/prisma/schema.prisma`:

| Mã Trạng Thái | Người/Sự Kiện Kích Hoạt | Mô Tả Nghiệp Vụ |
| :--- | :--- | :--- |
| `PENDING` | Khách bấm "Mua ngay" (`buyProductAction`) | Đơn vừa tạo, đang chờ thanh toán, có `expiresAt` |
| `PAID` | `markOrderPaid()` — webhook/IPN khớp, xác nhận thủ công, hoặc đơn 0đ | Đã nhận đủ tiền, đúng số tiền |
| `FULFILLED` | Ngay sau `PAID`, cùng trong `markOrderPaid()` | Đã tạo `Entitlement` cho từng `OrderItem` — khách tải được ngay |
| `EXPIRED` | `runOrderSweep()` (từ ADR-036: cron hằng ngày `/api/cron/daily`) ghi DB — nhưng mọi luồng đọc/thanh toán đã coi `PENDING` quá `expiresAt` là `EXPIRED` ngay (`effectiveOrderStatus`, §3.4) | Hết hạn thanh toán, chưa nhận được tiền |
| `CANCELED` | Khách tự huỷ (`cancelOrderByCustomer`, event `CANCEL`, từ `PENDING`) hoặc người bán "Đổi trạng thái…" → Huỷ đơn (event `SELLER_CANCEL`, từ `PENDING`/`EXPIRED` — ADR-068) | Người bán mở lại được (`SELLER_REOPEN` → `PENDING`, ADR-068) |
| `REFUNDED` | Owner bấm "Hoàn tiền" (`markOrderRefunded`) | Chỉ hợp lệ từ `FULFILLED` — thu hồi mọi `Entitlement` |

**Khác biệt quan trọng so với đơn hàng vật lý:** `PAID` và `FULFILLED` xảy ra **trong cùng một hàm, cùng một
transaction** (`markOrderPaid()`, `apps/web/lib/order.ts`) — tài liệu số không cần bước "đóng gói/giao hàng"
riêng, việc "giao hàng" chính là tạo `Entitlement` (quyền tải file) ngay khi tiền về.

---

## 2. Sơ Đồ Chuyển Trạng Thái (State Diagram)

Máy trạng thái thuần được cài ở `packages/core/src/order/state.ts` (`transitionOrderStatus`, bảng
`TRANSITIONS` — ném `AppError("INVALID_ORDER_TRANSITION")` nếu chuyển sai, không có transition "âm thầm bỏ
qua"):

```mermaid
stateDiagram-v2
    [*] --> PENDING: buyProductAction() tạo đơn

    PENDING --> PAID: MARK_PAID (markOrderPaid — webhook khớp/xác nhận thủ công/0đ)
    PENDING --> EXPIRED: EXPIRE (runOrderSweep — cron hằng ngày ADR-036, quá expiresAt)
    PENDING --> CANCELED: CANCEL (khách tự huỷ) / SELLER_CANCEL (người bán, ADR-068)

    PAID --> FULFILLED: FULFILL (cùng transaction với MARK_PAID — tạo Entitlement)

    EXPIRED --> PAID: MARK_PAID (người bán xác nhận trễ — ADR-068; ngoại lệ khách báo chuyển trước hạn — ADR-062)
    EXPIRED --> CANCELED: SELLER_CANCEL (người bán, ADR-068)
    EXPIRED --> PENDING: SELLER_REOPEN (người bán mở lại, ADR-068)
    CANCELED --> PENDING: SELLER_REOPEN (người bán mở lại, ADR-068)

    FULFILLED --> REFUNDED: REFUND (owner hoàn tiền — thu hồi Entitlement)

    REFUNDED --> [*]
```

**Trạng thái kết (terminal):** chỉ còn `REFUNDED` (`TRANSITIONS.REFUNDED = {}`). Từ ADR-068 (2026-11-25, đã commit `2ccc2fc`) ✅ code
`packages/core/src/order/state.ts`: `CANCELED` **không còn là trạng thái kết** — `TRANSITIONS.CANCELED = { SELLER_REOPEN: "PENDING" }`; `EXPIRED` thêm `SELLER_CANCEL`,
`SELLER_REOPEN`; `PENDING` thêm `SELLER_CANCEL`. Hai event mới chỉ dùng cho "Đổi trạng thái…" của người bán (§3.14); `CANCEL` (khách) và đường thanh toán tự động giữ nguyên.

---

## 3. Quy Tắc Chuyển Dịch & Điều Kiện Ràng Buộc (Business Rules)

### 3.1. `markOrderPaid(tx, orderId, source)` — hàm duy nhất, idempotent

Mọi nguồn tiền vào đều gọi đúng một hàm này (`apps/web/lib/order.ts`), nhận `tx` đã mở sẵn bởi caller qua
`withTenant`/`withSystemJob` — không tự mở transaction riêng:

- **Nguồn gọi (`MarkOrderPaidSource`):** `SEPAY_WEBHOOK`, `MOMO_IPN`, `MANUAL_CONFIRM`, `ZERO_AMOUNT`.
- **Idempotent:** đơn đã `PAID` hoặc `FULFILLED` → trả `{ fulfilled: false }` ngay, không làm lại.
- **Cập nhật có điều kiện (ADR-068 "Bổ sung" mục 7, 2026-11-25 — sửa lỗi có từ trước) ✅ code:** bước chuyển sang `PAID` là
  `updateMany({ where: { id, status: <trạng thái vừa đọc> } })`; 0 dòng → trả `{ fulfilled: false }` (no-op). Trước đây hai nguồn cùng đọc `PENDING` (webhook/job + người
  bán, hai lần bấm) đều đi tiếp → mã giảm giá có thể bị tính hai lượt. Người bán gọi qua "Đổi trạng thái…" còn khoá dòng đơn `FOR UPDATE` trước khi đọc (§3.14).
- **Trong 1 lần chạy:** chuyển `PENDING`/`EXPIRED` → `PAID` → `FULFILLED`; cộng dồn `TenantCustomer`
  (`ordersCount`/`totalSpentVnd`); nếu có `couponCode`, tăng `Coupon.usedCount` bằng
  `UPDATE ... WHERE "usedCount" < "usageLimit"` (raw SQL, atomic — 2 đơn thanh toán đồng thời không thể vượt
  `usageLimit`); tạo `Entitlement` cho từng `OrderItem` (snapshot `downloadLimit` từ `Product` tại thời điểm
  mua).
- **Sản phẩm đang bị khoá kiểm duyệt (bổ sung ADR-039 (c), 2026-10-16) ✅:** nếu `Product.moderationLockedAt` khác null, entitlement
  tạo ra ở `remedyStatus = PENDING_CHOICE` (+ `remedyRequestedAt`, `remedyReportId` = báo cáo `ARCHIVE_PRODUCT` mới nhất của sản phẩm) —
  khách đã trả tiền luôn có 2 lựa chọn tải lần cuối / yêu cầu hoàn tiền
  ([[02-System-Specs/Abuse-Reports-Specs|Abuse-Reports-Specs]] §6.5). Trigger `entitlements_guard_remedy` cho phép đúng trường hợp
  này dưới scope tenant.
- **Kết quả (`MarkOrderPaidResult`):** `{ fulfilled, productIds, couponOverused }` — caller dùng `fulfilled` để quyết định gửi email
  (§3.7), `productIds` để tính lại `soldCount`, `couponOverused` để ghi audit sau commit (`auditMarkOrderPaid`).
- **`EXPIRED → PAID`:** máy trạng thái vẫn cho phép (`markOrderPaid` nhận `PENDING`/`EXPIRED`), nhưng từ ADR-061 chỉ còn **một** đường tới đó:
  ngoại lệ "khách đã báo chuyển trước hạn" (§3.12). Cửa sổ xác nhận muộn 24 giờ của đặc tả M8 **đã bỏ**. **Từ ADR-068 (2026-11-25):** thêm đường thứ hai — **người bán**
  chọn "Đã thanh toán" trong "Đổi trạng thái…" xác nhận được **mọi** đơn hiệu lực `EXPIRED` (§3.14). Webhook/job **không đổi**: vẫn qua `canManuallyConfirmOrder` không
  truyền `declaredPaidAt` → **không tự áp đơn `EXPIRED`** ✅ code (`payment-process.ts`).
- **Luật xác nhận hiện hành (ADR-061 + Bổ sung ADR-062 mục 3 — đợt 1 luồng mua, working tree chưa commit, 2026-10-27) ✅ code:**
  `canManuallyConfirmOrder(status, expiresAt, now, { declaredPaidAt })`: hiệu lực `PENDING` → được; hiệu lực `EXPIRED` → **chỉ** khi `declaredPaidAt` có và
  `declaredPaidAt < expiresAt`. Webhook (`processPaymentEvent`) gọi **không** truyền `declaredPaidAt` → tiền SePay/MoMo về sau hạn: giao dịch ghi `MATCHED` nhưng
  **không** tự giao, hiện ở "Giao dịch cần xử lý" với nhãn "Về sau hạn giữ đơn" (§3.11). `confirmOrderManually` truyền `customerDeclaredPaidAt` khi cổng là loại xác
  nhận tay. Chi tiết §3.12.
- ~~**Cửa sổ 24h (chủ dự án chốt giữ 2026-10-16, ADR-036)**~~ — **đã thay bởi ADR-061 (2026-10-26), code đợt 1 đã bỏ**. Mô tả cũ giữ để tra lịch sử: webhook `payment.process` (`processPaymentEvent`) và xác nhận tay
  (`confirmOrderManually`) cùng dùng `canManuallyConfirmOrder(status, expiresAt, now)` (`packages/core/src/order/expiry.ts`): đơn
  hiệu lực `PENDING` → được; hiệu lực `EXPIRED` → chỉ được khi `now ≤ expiresAt + 24h`. Webhook khớp số tiền nhưng trễ hơn 24h:
  giao dịch vẫn ghi `tenant_payment_transactions` với `matchStatus = MATCHED`, **không** tự fulfil — tenant đối soát/xử lý tay.
  Từ ADR-036 hàm này xét theo `effectiveOrderStatus`, nên đơn DB còn `PENDING` nhưng đã quá hạn cũng chỉ có 24h (trước đây
  xác nhận được vô thời hạn nếu sweep không chạy).

### 3.2. Huỷ đơn

> **Từ ADR-068 (2026-11-25, đã commit `2ccc2fc`) ✅ `git diff`:** hàm `cancelOrder` (người bán) và `cancelOrderAction` **đã xoá**. Người bán huỷ qua "Đổi trạng thái…" →
> `changeOrderStatusBySeller(…, "CANCELLED")`, event **`SELLER_CANCEL`**, hợp lệ từ hiệu lực **`PENDING` hoặc `EXPIRED`** (§3.14). Khách tự huỷ vẫn là `cancelOrderByCustomer`
> (event `CANCEL`, chỉ `PENDING`, §3.12). Mô tả cũ dưới đây giữ để tra lịch sử.

~~Chỉ hợp lệ khi đơn đang `PENDING` (`transitionOrderStatus(status, "CANCEL")` ném lỗi 409 nếu không).~~ Không có
đường huỷ cho đơn đã `PAID`/`FULFILLED` — phải dùng hoàn tiền (vẫn đúng). ~~Từ ADR-036: `cancelOrder` truyền **trạng thái hiệu lực** vào máy
trạng thái — đơn `PENDING` đã quá `expiresAt` bị coi là `EXPIRED` nên **không huỷ được**.~~ (ADR-068 cho người bán huỷ đơn `EXPIRED`.)

### 3.3. Hoàn tiền (`markOrderRefunded`)

Chỉ hợp lệ khi đơn đang `FULFILLED`. Khi hoàn tiền, mọi `Entitlement` được tạo bởi đơn này bị
`revokedAt = now()` (`updateMany` trên toàn bộ `OrderItem` của đơn) — khách mất quyền tải ngay, không xoá lịch
sử đơn hàng.

Từ ADR-039 ✅: trong cùng transaction, **sau** lệnh thu hồi, entitlement của đơn đang `remedyStatus = REFUND_REQUESTED` (khách yêu cầu
hoàn tiền vì tài liệu bị gỡ do vi phạm) chuyển `REFUNDED` + `remedyResolvedAt = now()` — ngoại lệ duy nhất mà trigger
`entitlements_guard_remedy` cho phép ngoài `system_job`. Đánh giá đang bị khoá kiểm duyệt bị bỏ qua khi tự ẩn đánh giá (trigger
`reviews_guard_moderation` sẽ làm hỏng cả transaction hoàn tiền) ✅. Audit `ORDER_REFUNDED`.

### 3.4. Hết hạn: trạng thái hiệu lực (`effectiveOrderStatus`) + đồng bộ DB (`runOrderSweep`)

Nguồn: ADR-036 mục 3 + "Chủ dự án chốt (2026-10-16)" trong `docs/DECISIONS.md`. Đối chiếu code working tree 2026-10-16 (**chưa
commit/deploy**) ✅.

- **Trạng thái hiệu lực:** `effectiveOrderStatus(status, expiresAt, now)` (`packages/core/src/order/expiry.ts`, export từ
  `@gieochu/core`) trả `EXPIRED` khi `status = PENDING` và `expiresAt < now` (cùng ranh giới với `runOrderSweep`), ngược lại trả
  nguyên `status`. Không ghi DB. Áp vào ✅:
  - `applyCouponToOrder`, `removeCouponFromOrder`, `initiateOrderCheckout` — đơn quá hạn → `409 ORDER_NOT_PENDING`;
  - ~~`cancelOrder` (§3.2)~~ (đã xoá — ADR-068); `canManuallyConfirmOrder` (§3.1 — webhook + `confirmOrderManually`); `orderStatusTargets` / `changeOrderStatusBySeller`
    (§3.14 — ADR-068);
  - đọc: `getOrderForCustomer` (trang checkout), `getOrderDetailView`, `listOrdersPage` trả `status` hiệu lực; bộ lọc trạng thái của
    `listOrdersPage` (SQL `effectiveStatusSql`): `PENDING` loại đơn quá hạn, `EXPIRED` gồm cả đơn `PENDING` quá hạn ✅ code
    (`getOrderDetail`/`listOrders` cũ đã xoá ở ADR-047 — [[02-System-Specs/Studio-Orders-Specs|Studio-Orders-Specs]]);
  - `listCustomerOrders` (`apps/web/lib/library.ts`, tab đơn của khách) — đơn quá hạn hiện `EXPIRED`, không còn link thanh toán;
  - ~~`getOrderDashboardStats`~~ — **đã xoá** (ADR-048, 2026-10-23 ✅ grep); ô "Đơn chờ xác nhận" của dashboard nay ở `getTenantDashboard` (ADR-043).
- **Hạn giữ đơn (`expiresAt`) — ADR-061/062 Q3, đợt 1 ✅ code:** tính **từ lúc đặt đơn** (`createdAt`) bằng `computeOrderHoldExpiresAt(createdAt, holdHours)`:

  | Phương thức | Số giờ | Khoá System Settings |
  | :-- | :-- | :-- |
  | Chưa chọn, hoặc cổng xác nhận tay (`MANUAL_QR`, `MOMO_MANUAL`) | **72** (mặc định) | `orderHoldManualHours` (1–168) |
  | Cổng tự xác nhận (`SEPAY`; `MOMO` API nếu bật) | **48** (mặc định) | `orderHoldAutoHours` (1–168) |

  > **Đổi mốc từ ADR-068 mục 8 (2026-11-25, đã commit `2ccc2fc`) ✅ code:** mốc giữ = **`orderHoldStartedAt(order)` = `holdStartedAt ?? createdAt`** (cột mới `orders.holdStartedAt`,
  > migration `20261125120000_adr068_order_hold_started_at`). Người bán **mở lại** đơn đặt `holdStartedAt` = lúc mở lại (§3.14); đơn chưa từng mở lại có `holdStartedAt = NULL`
  > → hành vi như cũ. Helper dùng ở `initiateOrderCheckout` (hạn mới + chặn `PROVIDER_HOLD_EXPIRED`) và `checkout-view.ts` (cờ `available` của từng phương thức). Câu chữ:
  > System Settings "…kể từ lúc đặt đơn (hoặc lúc người bán mở lại đơn)"; lý do phương thức bị khoá ở trang thanh toán bỏ "(tính từ lúc đặt đơn)" ✅ code. Mọi chỗ ghi
  > "`createdAt`" dưới đây đọc là "mốc giữ".

  `createOrder` đặt hạn thủ công; `initiateOrderCheckout` tính lại `createdAt + giờ của phương thức mới` (`orderHoldHoursFor`) — **đổi phương thức không gia hạn**
  (luôn neo `createdAt`, không cộng dồn — đổi SePay → chuyển tay thì hạn = `createdAt + 72 giờ`, Quốc xác nhận đúng công thức Q3 ngày 2026-10-27); hạn mới đã qua →
  **409 `PROVIDER_HOLD_EXPIRED`** (vd đơn 60 giờ tuổi không chuyển sang SePay được). `orderPendingTtlMinutes` **không còn
  dùng** (`computeOrderExpiresAt` còn trong `@gieochu/core` nhưng `createOrder` không gọi).
- **Đồng bộ DB:** `runOrderSweep()` quét mọi đơn `PENDING` có `expiresAt < now()`, chuyển `EXPIRED` qua `withSystemJob()`, **trả
  số đơn đã chuyển** (trước đây `void`). Không đụng `Coupon.usedCount` — con số này chỉ tăng trong `markOrderPaid()`.
- **Lịch chạy:** từ ADR-036, trên Vercel sweep chạy **một lần mỗi ngày** trong `GET /api/cron/daily` (03:00 giờ VN) — gọi trực tiếp,
  không qua hàng đợi. Lịch cũ "mỗi 5 phút" (ADR-019, job `order.sweep`) chỉ còn khi chạy `apps/web/worker.ts` local/server riêng
  (worker vẫn `schedule("*/5 * * * *")`) ✅. Vì đã có trạng thái hiệu lực, việc sweep trễ không làm khách thanh toán được đơn quá hạn.
  Chi tiết job/cron: [[02-System-Specs/Background-Jobs-Specs|Background-Jobs-Specs]].

### 3.5. Snapshot giá & tiêu đề (`OrderItem`)

`OrderItem.titleSnapshot`/`unitPriceVnd`/`finalPriceVnd` được chốt tại thời điểm mua — một thay đổi giá/tiêu đề
sau đó trên `Product` không viết lại đơn đã đặt.

### 3.6. Không tin số tiền từ client

`createOrder`/`applyCouponToOrder` luôn gọi lại `calculatePrice()` (`packages/core/src/pricing`, M6) ở server —
không nhận tham số "tổng tiền" từ request của client (CLAUDE.md §7.5).

### 3.7. Email sau thanh toán (`sendOrderPaidEmails`) — sửa lỗi RLS (2026-10-16)

- Gửi `order_paid` (khách) + `new_sale` (chủ gian hàng) qua `sendEmailNow` **sau** khi transaction của `markOrderPaid` commit, và **chỉ
  khi lần gọi đó thật sự fulfil đơn** (`paid.fulfilled`) — không gửi lặp ở đơn 0đ / xác nhận tay; webhook (`processPaymentEvent`) vốn chỉ
  gửi khi fulfil ✅.
- **Lỗi cũ đã sửa ✅ (đọc `git diff`):** `sendOrderPaidEmailsInner` trước đây đọc `orders` bằng `getPrismaClient()` không scope — bảng
  `orders` bật RLS `FORCE`, client không đặt `app.scope` thấy **0 dòng** → hàm `return` sớm, **email `order_paid`/`new_sale` chưa từng được
  gửi** trên môi trường dùng role `gieochu_app`. Nay đọc dưới `withSystemJob`, chỉ chọn trường cần cho email. Cùng lỗi ở
  `resolveUniqueOrderCode` (kiểm trùng mã đơn luôn "không trùng") — nay kiểm dưới `withSystemJob` (`orders.code` unique toàn hệ thống).
  Mức ảnh hưởng thực tế trước khi sửa (đơn nào không nhận email) — Long không kiểm DB ❓.
- Sau phần email đơn hàng (kể cả khi dừng sớm, `finally`) chạy `notifyPurchaseRemedyForOrder` — email 2 lựa chọn cho entitlement
  `PENDING_CHOICE` của đơn (§3.1, ADR-039).
- **Sau deploy, email đơn hàng sẽ bắt đầu gửi thật lần đầu** 🟡 (brief Quốc) — xem
  [[04-Operations-Runbooks/Deploy-Vercel-Runbook|Deploy-Vercel-Runbook]] §9.8. Gửi thật tới hộp thư ❓.

### 3.8. Chặn thanh toán khi tài liệu không còn bán (`PRODUCT_UNAVAILABLE`, bổ sung ADR-039)

`assertOrderProductsPurchasable` (gọi trong `initiateOrderCheckout` và `applyCouponToOrder`, sau kiểm `ORDER_NOT_PENDING`) ✅: tenant không
`ACTIVE` **hoặc** đơn có sản phẩm không `PUBLISHED` → **409 `PRODUCT_UNAVAILABLE`**. Áp cho đơn `PENDING` tạo trước khi tài liệu bị
gỡ/lưu trữ/chuyển nháp hoặc gian hàng bị khoá/tạm ngưng.

- ⚠️ **Thay đổi hành vi:** tenant `READ_ONLY` cũng không `ACTIVE` → đơn `PENDING` của gian hàng đó **không thanh toán tiếp được** (trước đây
  được). "Bổ sung ADR-039 lần 2" (g) tạm giữ chặn (`READ_ONLY` từ M3 v2 chỉ còn là biện pháp quản trị; khách chưa bị trừ tiền); **chủ dự án
  đã chốt chặn qua ADR-040 mục 4** (2026-10-17 —
  [[01-Architecture-Decisions/ADR-026-Only-Active-Tenant-Shows-Documents|ADR-026 KB]]). Cùng ADR: khách của gian hàng `READ_ONLY` không
  còn thấy tài liệu (trang tài liệu 404) nên không tạo được đơn mới từ storefront; khách đã mua vẫn tải từ Thư viện.
- **Không** chặn webhook / xác nhận tay cho giao dịch **đã trả tiền** — các đường đó không qua hàm này; fulfil bình thường (sản phẩm bị
  khoá kiểm duyệt → `PENDING_CHOICE`, §3.1).

### 3.9. Mã giảm giá sau khi đã có QR — tạo lại `checkoutPayload` (bổ sung ADR-056) — working tree, chưa commit ✅ `git diff lib/order.ts`

Quyết định: [[01-Architecture-Decisions/ADR-041-System-Center-Subscription-Invoices-Bank-Transfer-Qr|ADR-041 KB (≙ ADR-056)]] §3.6–§3.7. Mục này chỉ ghi
hành vi code đọc được; luật nghiệp vụ là của ADR.

- **Chặn theo trạng thái:** `applyCouponToOrder` và `removeCouponFromOrder` kiểm `isEffectivelyPending(order)` trước — đơn PAID/FULFILLED/huỷ/hết hạn (hiệu lực)
  → **409 `ORDER_NOT_PENDING`** ✅ (test `order.test.ts` kiểm đơn đã fulfil).
- **Tạo lại payload:** nếu đơn đã có `provider` và `checkoutPayload` và tổng mới > 0, gọi `buildTenantCheckoutPayload(tenantId, { code, totalVnd: tổngMới },
  order.provider)` (hàm nội bộ mới, tách từ `initiateOrderCheckout`; PaymentScope TENANT; `reference`/nội dung CK luôn là mã đơn) ✅.
  - Payload được tạo **trước** transaction (gọi cổng thanh toán nằm ngoài transaction DB); lỗi cổng (không phải `AppError`) → `logger.warn` + **502
    `CHECKOUT_CREATE_FAILED`**, đơn **không đổi** ✅.
  - Sau đó **một** `withTenant` transaction: `order.updateMany` có điều kiện `{ id, status: "PENDING", totalVnd: <tổng lúc đọc>, provider: <cổng lúc đọc> }`
    ghi subtotal/discount/total/couponCode + payload mới; cập nhật `order_items.finalPriceVnd`. `count = 0` (có người chọn cổng/áp mã song song) → **409
    `ORDER_CHANGED`** "Đơn hàng vừa được cập nhật, vui lòng tải lại trang và thử lại." ✅.
  - Gỡ mã: tổng về `subtotalVnd`, `discountVnd = 0`, `couponCode = null`, `finalPriceVnd = unitPriceVnd`; payload tạo lại theo `subtotalVnd` ✅.
- **Tổng mới = 0đ:** không tạo payload; sau commit `markOrderPaid(tx, orderId, "ZERO_AMOUNT")` như cũ (trang ẩn khối thanh toán) ✅.
- **`initiateOrderCheckout`** (chọn cổng) cũng dùng `buildTenantCheckoutPayload` rồi chỉ ghi khi `{ status: "PENDING", totalVnd: <tổng lúc đọc> }` còn khớp —
  không thì 409 `ORDER_CHANGED` ✅.
- **Server Action** (`app/[tenantSlug]/checkout/[orderCode]/actions.ts`): `applyCouponAction`, `removeCouponAction`, `selectProviderAction` đều bắt `AppError` →
  `{ error: message }`. `removeCouponAction` nay trả **`CheckoutActionState`** (chữ ký `useActionState`) thay vì `void` ✅ đọc code.
- **Kiểm test:** `order.test.ts` (case MANUAL_QR có sẵn) thêm assert: áp mã 10% sau khi có QR → `totalVnd` 90.000, QR chứa tag số tiền mới, nội dung CK giữ mã
  đơn; gỡ mã → 100.000 ✅ đọc test. Kiểm qua trình duyệt/cổng thật ❓.
- **QR cũ khách đã lưu:** với SePay, tiền về theo số cũ → `matchPaymentAmount` ghi `tenant_payment_transactions.matchStatus = MISMATCH_AMOUNT`, không
  `markOrderPaid`; chủ gian hàng xác nhận tay (§3.1 `MANUAL_CONFIRM`, còn trong cửa sổ `canManuallyConfirmOrder`) ✅ đọc `lib/payment-process.ts`. Với SePay thật ❓.
- **MoMo:** đổi mã sau khi đã có link MoMo → gọi lại `createCheckout` cùng `orderId`; MoMo có thể từ chối → `CHECKOUT_CREATE_FAILED`, đơn không đổi. **Tạm chưa
  xử lý** (bổ sung ADR-056 lần 2) 🟡; hành vi với MoMo thật ❓.
- **UI:** ô mã giảm giá (`coupon-panel.tsx`) có nhãn, gợi ý "Nhập mã trước khi chọn cách thanh toán…", lỗi `role="alert"` trong panel, thành công báo "Đã cập nhật mã
  QR theo số tiền mới" khi đơn đã có QR — [[04-Operations-Runbooks/UI-Design-System|UI-Design-System]] §24.3.

### 3.10. Email báo người bán có đơn chờ xác nhận tay (ADR-059 B1) — đã commit `fa29d99` ✅ đọc code (đợt 1 ADR-061 sửa tiếp, working tree)

Quyết định: [[01-Architecture-Decisions/ADR-044-Beta-Payments-Manual-Confirm-Emails-Sepay|ADR-044 KB (≙ ADR-059)]]. Không đổi máy trạng thái đơn.

- **`initiateOrderCheckout(tenantId, orderId, customerId, provider, options?)`** — tham số `options.scheduleNotification` (kiểu `ScheduleAfterResponse`,
  `lib/email-dispatch.ts`); `selectProviderAction` (checkout) truyền `(task) => after(task)`.
- **Từ đợt 1 ADR-061 (2026-10-27, working tree) ✅ code — thay cơ chế "lần đầu chọn cổng":** bỏ khoá `FOR UPDATE` / `firstProviderSelection`. Mỗi lần chọn cổng xác nhận
  tay (MANUAL_QR, MOMO_MANUAL) đều **lên lịch** `notifyOwnerOfPendingManualOrder`; hàm tự **nhận mốc** `orders.ownerManualNotifiedAt` (`UPDATE … WHERE … IS NULL`) rồi
  mới gửi → **một lần/đơn** kể cả khi khách đổi phương thức (ADR-061 Q10). Khách chọn SePay trước rồi đổi sang chuyển tay → nay **có** email (trước đây không — KB-Audit
  §41 mục 5 đã đóng). Áp/gỡ mã giảm giá không gửi lại.
- **`notifyOwnerOfPendingManualOrder(tenantId, orderId)`** (chạy sau response): đọc `tenants.slug` + `owner.email` (L1, `getPrismaClient`) và đơn + `items.titleSnapshot`
  dưới `withTenant` (L2). Bỏ qua nếu đơn không còn chờ hiệu lực (`isEffectivelyPending`) hoặc cổng không còn là loại xác nhận tay. Lỗi chỉ log, không ném.
- Nội dung (`renderOrderAwaitingManualConfirmEmail`): tiêu đề chỉ có mã đơn ("Đơn {mã} chờ bạn xác nhận chuyển khoản"); thân có tên tài liệu (nối bằng dấu phẩy
  nếu nhiều dòng), tổng tiền, **hạn thanh toán** (`expiresAt`) và **hạn chót xác nhận tay** (`manualConfirmDeadline(expiresAt)` — từ ADR-061 **= `expiresAt`**,
  kèm câu "sau mốc này chỉ xác nhận được nếu khách đã bấm 'Tôi đã chuyển khoản' trước hạn"), **`methodLabel`** ("chuyển khoản ngân hàng, đối chiếu sao kê" /
  "chuyển tiền MoMo, đối chiếu lịch sử ví" — mới ở đợt 1, đóng KB-Audit §43 mục 1), link `/studio/{slug}/orders/{orderId}`. Không thông tin khách. Loại `order_pending_manual` thuộc `TENANT_CUSTOMER_FACING_TYPES` → **không** ghi `email_send_log`.
- **`manualConfirmDeadline(expiresAt)`** (`packages/core/src/order/expiry.ts`) — ADR-059 tạo với cửa sổ 24 giờ; từ đợt 1 ADR-061 bỏ tham số `lateWindowHours`, trả đúng
  `expiresAt` ✅ code.

### 3.11. Webhook gian hàng: nhiều mã ứng viên, email sai tiền, trang "Giao dịch cần xử lý" (ADR-059 bổ sung lần 2) ✅ `git diff`

- **Mã ứng viên:** route `POST /api/webhooks/tenants/[tenantId]/sepay` đọc `referenceCandidates` bằng `extractSepayReferences(body, [cfg.paymentPrefix,
  tenant.orderCodePrefix], { codeLength: 6 })`; `reference` = phần tử đầu. `processPaymentEvent` tìm các đơn có `code IN candidates` và lấy đơn đầu tiên theo thứ tự ưu
  tiên; job cũ (không có `referenceCandidates`) dùng `reference`. MoMo giữ `event.reference`.
  - **Từ ADR-065 (2026-11-24, working tree) ✅ code:** đơn chọn SePay có **mã thanh toán riêng `orders.paymentRef`** (tiền tố SePay + 8 chữ số) làm nội dung QR/CK; ứng viên =
    `extractSepayPaymentCodes(body, [cfg.paymentPrefix, orderCodePrefix])` **rồi** mã đơn (`orderCodePrefix` + 6 ký tự); `processPaymentEvent` tìm đơn trong gian hàng có
    `paymentRef IN …` **hoặc** `code IN …`. Giao dịch có `accountNumber` khác tài khoản cấu hình bị bỏ qua (200, không ghi `webhook_events`). Chi tiết:
    [[02-System-Specs/Payment-And-Billing|Payment-And-Billing]] §5M.
- **Luật khớp không đổi:** không tìm thấy đơn → `UNMATCHED`; có đơn → ghi `MATCHED`/`MISMATCH_AMOUNT` theo `matchPaymentAmount`; chỉ `markOrderPaid` khi tiền vào thành
  công + `MATCHED` + `canManuallyConfirmOrder` ✅.
- **Email `payment_mismatch`** — khi tiền vào thành công (`success`) và có đơn nhưng `matchStatus ≠ MATCHED`: sau khi transaction commit, `notifyOwnerOfPaymentMismatch`
  gửi chủ gian hàng: mã đơn, số nhận, số đơn cần, "thiếu/thừa N đ", tên cổng, link đơn + link `/studio/{slug}/orders/giao-dich`. Không ghi `email_send_log`. Một giao dịch chỉ
  báo một lần vì dòng `tenant_payment_transactions` unique `(tenantId, provider, providerTxnId)` — job chạy lại sẽ lỗi ở bước ghi giao dịch trước khi tới email ✅ code
  (comment). Email gửi **bất kể trạng thái đơn** (kể cả đơn đã FULFILLED/huỷ) — ✅ code, KB-Audit §41.
- **Trang `/studio/{slug}/orders/giao-dich` "Giao dịch cần xử lý"** (`lib/tenant-payment-transactions.ts`, L2 qua `withTenant`, guard `requireTenantMemberPage` — OWNER):
  giao dịch `matchStatus ∈ {UNMATCHED, MISMATCH_AMOUNT}` **và** (từ đợt 1 ADR-061) `MATCHED` mà đơn **chưa** `PAID`/`FULFILLED`/`REFUNDED` — nhãn **"Về sau hạn giữ
  đơn"** (tiền đúng đơn, đúng số nhưng về khi đơn đã hết hạn; người bán hoàn tiền hoặc liên hệ khách); **bỏ** giao dịch SePay tiền ra (`rawPayload->>'transferType' = 'out'`, lọc bằng SQL thô + `COALESCE` để giữ
  dòng MoMo/payload cũ thiếu khoá). Mới nhất trước, 20/trang. Cột: thời điểm nhận + mã giao dịch cổng, cổng, số tiền, tình trạng, đơn (nếu có, kèm chênh lệch), nội dung
  CK (≤ 160 ký tự). Chỉ xem — chủ gian hàng xác nhận tay ở trang chi tiết đơn (nếu đơn còn xác nhận được — §3.1; từ ADR-068 qua "Đổi trạng thái…", kể cả đơn đã hết hạn — §3.14). Markup tối thiểu, Phong rà sau 🟡.
- **Trang Đơn hàng** `/studio/{slug}/orders` hiện dòng cảnh báo "Có N giao dịch thanh toán cần xử lý…" + link khi `countTenantTransactionsNeedingAction > 0`.
- ~~**Không có trên trang này:** giao dịch `MATCHED` đến sau hạn~~ — **đã có** từ đợt 1 ADR-061 (nhãn "Về sau hạn giữ đơn"; KB-Audit §41 mục 7 đã đóng). Vẫn **không**
  có email cho trường hợp này ✅ code.

### 3.12. Đợt 1 luồng mua — khách đã đăng nhập (ADR-061 + ADR-062 + Bổ sung ADR-062) — working tree, chưa commit ✅ đối chiếu code 2026-10-27

Quyết định: [[01-Architecture-Decisions/ADR-046-Customer-Purchase-Flow-Pending-Orders-Notifications|ADR-046 KB (≙ ADR-061)]],
[[01-Architecture-Decisions/ADR-048-Checkout-Layout-Declared-Paid-Guest-Session|ADR-048 KB (≙ ADR-062)]]. Migration `20261026180000_adr061_purchase_flow` **đã áp** 🟡 (brief).
Phần khách vãng lai (task 12/13): §3.13. Code: `packages/core/src/order/expiry.ts`, `apps/web/lib/order.ts`, `apps/web/lib/order-customer.ts`,
`apps/web/lib/checkout-view.ts`.

- **Hạn giữ đơn** theo phương thức, tính từ lúc đặt đơn (từ ADR-068 mục 8: hoặc lúc người bán mở lại đơn — `holdStartedAt`) — bảng ở §3.4.
- **"Tôi đã chuyển khoản"** (`declareOrderPaid`, ADR-062 Q1): chỉ đơn hiệu lực `PENDING` của cổng xác nhận tay (khác → 400 `NOT_MANUAL_PROVIDER`; không chờ →
  409 `ORDER_NOT_PENDING`). Ghi `orders.customerDeclaredPaidAt = now` (idempotent — đã có thì trả mốc cũ), **không đổi `status`**. Audit
  `ORDER_CUSTOMER_DECLARED_PAID`. Lên lịch email người bán `order_customer_declared_paid` **một lần/đơn** (mốc `ownerDeclaredPaidNotifiedAt`).
- **Hoàn tác** (`undoDeclareOrderPaid`, "Tôi chưa chuyển khoản"): khi đơn còn chờ; xoá mốc; audit `ORDER_CUSTOMER_DECLARED_PAID_UNDONE`; không gửi email.
- **Khoá khi đã báo chuyển:** đổi phương thức, áp/gỡ mã giảm giá, tự huỷ → **409 `ORDER_DECLARED_PAID`** (phải hoàn tác trước). Ghi có điều kiện
  `customerDeclaredPaidAt IS NULL`.
- **Ngoại lệ xác nhận sau hạn** (Bổ sung ADR-062 mục 3): đơn cổng xác nhận tay đã `EXPIRED` mà `customerDeclaredPaidAt < expiresAt` → người bán vẫn xác nhận được
  (`confirmOrderManually`, `orderAllowedActions`). Audit `ORDER_MANUALLY_CONFIRMED` thêm `lateDeclaredPaid` (xác nhận khi đã hết hạn) và `customerDeclaredPaid`.
  *Từ ADR-068:* UI Studio không còn gọi `confirmOrderManually` — người bán xác nhận được mọi đơn `EXPIRED` qua "Đổi trạng thái…" (§3.14); ngoại lệ này còn tác dụng ở
  `displayStatus` phía khách ("Chờ người bán xác nhận") và hàm cũ.
- **Khách tự huỷ** (`cancelOrderByCustomer`, ADR-062 Q4): đơn hiệu lực `PENDING`, chưa báo chuyển → `PENDING → CANCELED` theo FSM (`transitionOrderStatus`). Audit
  `ORDER_CANCELED_BY_CUSTOMER`. UI có hộp xác nhận.
- **`displayStatus` trang khách** (`CheckoutDisplayStatus`, `lib/checkout-view.ts`) — server tính, UI không tự suy:

  | `displayStatus` | Khi nào | Nhãn |
  | :-- | :-- | :-- |
  | `AWAITING_PAYMENT` | Hiệu lực `PENDING`, chưa báo chuyển | Chờ thanh toán |
  | `AWAITING_SELLER_CONFIRM` | `PENDING` đã báo chuyển, **hoặc** `EXPIRED` mà còn xác nhận được (ngoại lệ trên) | Chờ người bán xác nhận |
  | `PAID` | `PAID`/`FULFILLED` | Đã thanh toán |
  | `EXPIRED` | `EXPIRED` không thuộc ngoại lệ | Đã hết hạn |
  | `CANCELED` / `REFUNDED` | như trạng thái | Đã huỷ / Đã hoàn tiền |

  Kèm quyền `can.{changeProvider, applyCoupon, declarePaid, undoDeclarePaid, cancel}` (đổi phương thức/mã chỉ khi còn chờ, chưa báo chuyển, tài liệu còn bán + gian
  hàng ACTIVE). Mỗi phương thức có `available` = hạn của phương thức đó (tính từ ~~`createdAt`~~ mốc giữ `holdStartedAt ?? createdAt` — ADR-068 mục 8) chưa qua.
- **Giới hạn mã giảm giá "mỗi khách"** (ADR-061 Q6): số lượt đã dùng + số **đơn chờ còn hiệu lực khác** của chính khách có cùng mã. Giới hạn tổng không giữ chỗ.
- **Email cho khách** (L3, không ghi `email_send_log`): hướng dẫn thanh toán khi chọn/đổi phương thức, nhắc 1 lần khi còn ≤ 24 giờ (cron) —
  [[02-System-Specs/Payment-And-Billing|Payment-And-Billing]] §5K.
- **Studio:** đơn "Khách báo đã chuyển" luôn lên đầu danh sách — [[02-System-Specs/Studio-Orders-Specs|Studio-Orders-Specs]] §2.5.
- **Test:** assert thêm trong case có sẵn (`expiry.test.ts`, `order.test.ts`, `auth.test.ts`); `pnpm test:count` = **100/100 unit, 66/66 integration** ✅ (Long chạy).

### 3.13. Khách vãng lai — mua không cần đăng ký (ADR-061 Q1, ADR-062 Q2/Q11, Bổ sung ADR-062) — working tree, chưa commit, chưa thử thủ công ✅ đọc code 2026-10-27

Phiên + guard + kích hoạt: [[02-System-Specs/Auth-Session-Specs|Auth-Session-Specs]] §9A. Code: `apps/web/lib/guest-checkout.ts`, `app/[tenantSlug]/checkout/{layout.tsx,(chua-co-don)/,actions.ts,_ui/}`,
`app/[tenantSlug]/[productSlug]/actions.ts`, `lib/checkout-view.ts` (`getGuestCheckoutView`).

- **Nút mua (`BuyButton`) luôn ghi "Mua ngay"**, kể cả khi chưa đăng nhập (2026-10-27, working tree — trước ghi "Đăng nhập để mua"); prop `loggedIn` của `BuyButton` đã bỏ ✅ code.
- **"Mua ngay" (`buyProductAction`)**: **chưa đăng nhập** → chuyển tới **`/{tenantSlug}/checkout?tai-lieu={productSlug}`** (chưa tạo đơn — ADR-062 Q2); đã có phiên (đã xác minh
  **hoặc** phiên guest — `requireCheckoutAccess`) → tạo đơn như cũ rồi tới `/{tenant}/checkout/{mã}`. Phiên guest mua thêm tài liệu khác theo đường này là **có chủ đích**
  (Quốc quyết 2026-10-27).
- **Trang trước khi có đơn** `/{tenantSlug}/checkout?tai-lieu=` (route group **`(chua-co-don)`** — chỉ để có `loading.tsx`/`error.tsx` riêng, URL không đổi; khung chung
  `checkout/layout.tsx`): thiếu `tai-lieu` / tài liệu không PUBLISHED / gian hàng không ACTIVE → 404; **đã đăng nhập** → về trang tài liệu. Dữ liệu `getGuestCheckoutView`
  (chỉ dữ liệu công khai; giá tính lại ở server, kể cả giá khuyến mãi; `viewer.kind = "guest"`, `order = null`).
- **`startGuestCheckoutAction(tenantSlug, productSlug, prevState, formData)`** (`app/[tenantSlug]/checkout/actions.ts`, Server Action — CSRF sẵn của Next.js) → `startGuestCheckout`:
  1. Validate: Họ tên (1–100), Email, **1 ô** đồng ý (`acceptTerms`, không tick sẵn — Q11), phương thức (bắt buộc khi tài liệu > 0đ và phải là cổng đang bật).
  2. Tài liệu còn bán (kiểm **trước** khi tạo tài khoản).
  3. Rate limit DB (5/IP/giờ, 3/email/ngày).
  4. Email đã có tài khoản → **không** gắn đơn, không tạo phiên: guest chưa kích hoạt → `EMAIL_EXISTS_GUEST` "Email này đã được dùng — đăng nhập hoặc gửi lại email kích
     hoạt." (Bổ sung ADR-062 mục 4); tài khoản thường → `EMAIL_EXISTS` "…vui lòng đăng nhập để mua.".
  5. Một transaction: tạo user `PENDING`/`hasPassword = false` + hồ sơ (`consentAt`), **ghi `UserLegalAcceptance`** cho bản hiệu lực của **Điều khoản** và **Chính sách bảo mật**
     (`getAcceptanceLegalVersion` — bản nào có thì ghi; "Bản dự thảo" không ghi, ADR-057), token `GUEST_ACTIVATION`, refresh token `guestCheckout`.
  6. Audit `AUTH_GUEST_ACCOUNT_CREATED`; ký access `gco`; tạo đơn (`createOrder`) + chọn cổng (`initiateOrderCheckout` — email người bán/khách như §3.10/§3.12).
  7. Lên lịch email `guest_activation` (kèm mã đơn); đặt cookie phiên (`applyAuthCookiesTo`); chuyển `/{tenant}/checkout/{mã}?vua-tao=1`.

  Tạo đơn lỗi sau bước 5 → trả `PRODUCT_UNAVAILABLE`, không đặt cookie, nhưng tài khoản guest đã tạo vẫn còn (email kích hoạt vẫn gửi) — **Quốc chấp nhận, chưa dọn**
  (2026-10-27).

  | `code` | Khi nào |
  | :-- | :-- |
  | `VALIDATION` | Thiếu/sai ô (kèm `fieldErrors` theo ô: `fullName`, `email`, `acceptTerms`, `provider`) |
  | `PRODUCT_UNAVAILABLE` | Tài liệu/gian hàng không còn bán, hoặc tạo đơn thất bại sau khi đã tạo tài khoản |
  | `RATE_LIMITED` | Vượt giới hạn IP/email |
  | `EMAIL_EXISTS_GUEST` / `EMAIL_EXISTS` | Như bước 4 (cũng dùng khi hai lần gửi đồng thời cùng email — P2002) |
  | `ALREADY_SIGNED_IN` | Đã có phiên — bảo khách bấm "Mua ngay" |

  State trả `{ error, code, fieldErrors, values }` (giữ Họ tên/Email/phương thức đã nhập; form không có ô mật khẩu).
- **Trang đơn với phiên guest:** `CheckoutView.viewer` thêm `justCreated` (`?vua-tao=1` + phiên guest) và `guestSession` (phiên guest, chưa xác minh) → khối
  **`GuestActivationNotice`** ở đầu cột trái (bản nổi bật "Đã tạo tài khoản cho bạn" khi vừa tạo, bản gọn "Tài khoản chưa kích hoạt" sau đó; link "Gửi lại email kích hoạt").
- **Tải tài liệu:** khách guest tải ngay trên phiên đó (Thư viện + `POST /api/downloads` qua `requireCheckoutUser`), theo đúng `downloadLimit` của tài liệu (Bổ sung ADR-062
  mục 2 — không có giới hạn riêng). Hết phiên (≤ 24 giờ) → phải kích hoạt rồi đăng nhập.

### 3.14. Người bán "Đổi trạng thái…" đơn — xác nhận trễ, mở lại, huỷ (ADR-068 + Bổ sung) — đã commit `2ccc2fc`; migration expand `holdStartedAt` (mục 8) đã áp DB `.env`, production chưa xác minh ✅ đọc code 2026-11-25

Quyết định: [[01-Architecture-Decisions/ADR-052-Studio-Order-Status-Change-Reopen-Late-Confirm|ADR-052 KB (≙ ADR-068)]]. Code: `apps/web/lib/order.ts` (khối "ADR-068"),
`packages/core/src/order/state.ts`, `app/studio/[tenantSlug]/orders/[orderId]/actions.ts`.

- **Bảng chuyển** — `orderStatusTargets(order, now)` theo **trạng thái hiệu lực** (thứ tự PAID → PENDING → CANCELLED):

  | Từ (hiệu lực) | → `PAID` | → `PENDING` (mở lại) | → `CANCELLED` |
  | :-- | :-: | :-: | :-: |
  | `PENDING` | ✅ | — | ✅ `SELLER_CANCEL` |
  | `EXPIRED` | ✅ `MARK_PAID` (xác nhận trễ) | ✅ `SELLER_REOPEN` | ✅ `SELLER_CANCEL` |
  | `CANCELED` | — | ✅ `SELLER_REOPEN` | — |
  | `PAID` / `FULFILLED` / `REFUNDED` | — | — | — (hoàn tiền: §3.3) |

- **`changeOrderStatusBySeller(tenantId, orderId, target, note, actorId)`** — nơi gọi đã `requireTenantMember(slug)` (mặc định OWNER) và truyền `tenant.id` từ guard; mọi
  đọc/ghi `orders` dưới `withTenant`. Đơn không thuộc gian hàng → 404; `target` không nằm trong bảng → 409 **`ORDER_STATUS_NOT_CHANGEABLE`**.
- **→ PAID:** transaction `withTenant` khoá dòng đơn `FOR UPDATE` → đọc lại → hiệu lực phải `PENDING`/`EXPIRED` (khác → `ORDER_STATUS_NOT_CHANGEABLE`) → ghi `confirmNote`
  (nếu có) → `markOrderPaid(tx, id, "MANUAL_CONFIRM")`; no-op (nguồn khác vừa áp) → 409 **`ORDER_ALREADY_PAID`**, rollback. Sau commit: audit, `COUPON_OVERUSED` nếu có,
  tính lại `soldCount`, email đã thanh toán. Không kiểm "khách báo chuyển", không kiểm tài liệu còn bán.
- **→ PENDING (mở lại):** chặn `PRODUCT_UNAVAILABLE` (gian hàng không ACTIVE / tài liệu không PUBLISHED — §3.8), `ALREADY_OWNED` (khách có entitlement chưa thu hồi với tài liệu
  của đơn qua **đơn khác**) / `CANNOT_BUY_OWN_PRODUCT` (khách là chủ gian hàng) — cùng `canPurchaseProduct` với tạo đơn. `expiresAt` = `computeOrderHoldExpiresAt(lúc mở lại,
  orderHoldHoursFor(provider))` (luôn ở tương lai vì số giờ ≥ 1 → sweep không hết hạn lại ngay) và **`holdStartedAt` = lúc mở lại** (mục 8) → khách đổi/chọn phương thức
  được, hạn mới tính từ lúc mở lại. Giữ `totalVnd`, `couponCode`, `provider`, `checkoutPayload`, `paymentRef`; xoá `customerDeclaredPaidAt`, `customerReminderSentAt`. Không
  gửi email. Audit `ORDER_REOPENED_BY_SELLER` ghi thêm `holdStartedAt`.
- **→ CANCELLED:** `PENDING`/`EXPIRED` → `CANCELED`.
- **Chống ghi đè song song (mở lại, huỷ):** `updateMany` có điều kiện `status` (DB) + `expiresAt` đã đọc → 0 dòng → 409 `ORDER_CHANGED`. Đơn hiệu lực `EXPIRED` mà DB còn
  `PENDING` (sweep chưa chạy) vẫn khớp điều kiện ✅ code.
- **Ghi chú** (không bắt buộc, NFC + trim, cắt 500) → ghi chú nội bộ `[Đổi trạng thái: {cũ} → {mới}] …` sau commit + `confirmNote` khi PAID. Audit chỉ id + trạng thái —
  [[02-System-Specs/Audit-Log-Specs|Audit-Log-Specs]] §4.
- **Không đổi:** webhook/job (`processPaymentEvent`) — đơn hết hạn vẫn không tự giao; giao dịch về sau hạn ghi `MATCHED` và hiện ở "Giao dịch cần xử lý" (§3.11). Người
  bán xác nhận tay đơn đó qua "Đổi trạng thái…" thì `paymentChannel` hiện `PROVIDER` (có giao dịch MATCHED) ✅ code; không có giao dịch MATCHED → `MANUAL` nhờ `confirmNote`
  **hoặc** audit `ORDER_MANUALLY_CONFIRMED` (mục 9 — [[02-System-Specs/Studio-Orders-Specs|Studio-Orders-Specs]] §3).
- **Lệch/rủi ro đã thấy khi đọc code** (chưa thử thật ❓): ~~đơn mở lại có `createdAt` cũ → mọi phương thức `available = false`, đổi phương thức bị 409
  `PROVIDER_HOLD_EXPIRED`~~ — **đã sửa bằng mục 8** (`holdStartedAt`, KB-Audit §51 mục 5 đóng); mốc email `ownerManualNotifiedAt`, `ownerDeclaredPaidNotifiedAt`,
  `customerPaymentEmailed*` không reset — xem [[00-Index/KB-Audit-2026-09-26|KB-Audit]] §51.
- **Test:** không thêm case — mở rộng `order.test.ts` (10/10 🟡 Quốc báo) và `state.test.ts`; `pnpm test:count` 105/69 ✅.

### 3.15. Email cho khách khi đơn hết hạn / sai số tiền / MoMo thất bại / người bán huỷ (ADR-070) — working tree, chưa commit ✅ đọc code 2026-11-25

Bảng đầy đủ + nội dung: [[02-System-Specs/Payment-And-Billing|Payment-And-Billing]] §5Q (B1–B5). Điểm gắn với máy trạng thái ✅ code:
- **B2 hết hạn:** `runOrderSweep` nay chuyển **có điều kiện từng đơn** (`updateMany where status = PENDING AND expiresAt < now`), trả số đơn thật sự chuyển; sau commit gửi
  `order_expired_customer` **chỉ cho đơn có `provider`** (khách đã chọn cách trả). Hết hạn "hiệu lực" (§3.4) không gửi email — chỉ khi sweep ghi DB.
- **B3/B4:** `processPaymentEvent` — sai số tiền / MoMo `success = false` cho đơn còn PENDING/EXPIRED → email khách sau commit; đơn đã trả/hoàn nhận giao dịch lệch chỉ báo người bán.
- **B5:** sau `sellerCancelOrder` thành công (§3.14); khách tự huỷ (§3.12) **không** có email; mở lại không có email.

> **Hiển thị ở Studio (ADR-046, 2026-10-18 — working tree, chưa commit ✅ `git status`):** trang `/studio/{slug}/orders` lọc/đếm theo trạng thái
> **hiệu lực** (`effectiveOrderStatus`) và chỉ hiện thao tác hợp lệ theo `orderAllowedActions` — `confirm` = `canManuallyConfirmOrder`, `cancel` =
> hiệu lực PENDING, `refund` = FULFILLED ✅ đọc code. Đây chỉ là lớp hiển thị; các action vẫn tự kiểm luật ở §3 (không đổi). Xem
> [[02-System-Specs/Studio-Orders-Specs|Studio-Orders-Specs]] §2.4 ([Studio-Orders-Specs.md](./Studio-Orders-Specs.md)). *Từ ADR-068: UI dùng `statusTargets` (§3.14) cho
> xác nhận/mở lại/huỷ; `orderAllowedActions` chỉ còn quyết định "Xem" và "Đánh dấu đã hoàn tiền".*

---

## 4. Ranh Giới Bảo Mật (RLS) Áp Dụng Cho `orders`/`order_items`

Khác các bảng L2 khác chỉ có chiều tenant, `orders` có **thêm một chiều "khách hàng"** trong policy RLS: đọc
được nếu `tenantId` khớp (owner) **HOẶC** `customerId` khớp dưới `app.scope='customer'` (người mua) **HOẶC**
`system_job`. `order_items` không có cột `tenantId` riêng — scope qua JOIN tới `orders`.
Từ ADR-029 mục 0 (migration `20260927130000_rls_adr029_split_write_policies`) ✅ đọc SQL: điều kiện trên chỉ còn là
policy **đọc** `select_access`; policy ghi `write_insert/update/delete` chỉ cho `tenantId` khớp hoặc `system_job`
(`order_items` qua đơn cha) — khách (`scope='customer'`) không còn UPDATE/DELETE được đơn của mình ở tầng DB.
Hoàn tiền (`markOrderRefunded`) và thu hồi entitlement giờ còn tự ẩn đánh giá liên quan (lý do `REFUNDED`) trong cùng
transaction — xem [[02-System-Specs/Reviews-Specs|Reviews-Specs]] §5. Xem thêm
[[Architecture-Overview]] mục 3 và [docs/GIEOCHU_TENANT_MODULE_STRUCTURE_V1.0.md](../../docs/GIEOCHU_TENANT_MODULE_STRUCTURE_V1.0.md) mục 2.2.

---

## 5. Tài Liệu Tham Chiếu & Liên Kết

* [[Architecture-Overview]] — Kiến trúc 3 tầng dữ liệu và RLS ([Architecture-Overview.md](./Architecture-Overview.md))
* [[Payment-And-Billing]] — Cơ chế thanh toán Tenant (SePay/MoMo/Manual QR) đứng sau `markOrderPaid` ([Payment-And-Billing.md](./Payment-And-Billing.md))
* [[File-Storage-And-Downloads-Specs]] — `Entitlement` quyết định quyền tải sau khi `FULFILLED` ([File-Storage-And-Downloads-Specs.md](./File-Storage-And-Downloads-Specs.md))
* [[02-System-Specs/Background-Jobs-Specs|Background-Jobs-Specs]] — hàng đợi pg-boss, `after()` + cron hằng ngày (ADR-036) ([Background-Jobs-Specs.md](./Background-Jobs-Specs.md))
* [[02-System-Specs/Abuse-Reports-Specs|Abuse-Reports-Specs]] — quyền lợi người mua khi tài liệu bị gỡ do vi phạm (ADR-039) ([Abuse-Reports-Specs.md](./Abuse-Reports-Specs.md))
* [[02-System-Specs/Studio-Orders-Specs|Studio-Orders-Specs]] — trang Đơn hàng Studio: danh sách lọc/tìm/phân trang + chi tiết, dòng thời gian đơn (ADR-046) ([Studio-Orders-Specs.md](./Studio-Orders-Specs.md))
* [[01-Architecture-Decisions/ADR-041-System-Center-Subscription-Invoices-Bank-Transfer-Qr|ADR-041 KB (≙ ADR-056)]] — mã giảm giá sau khi đã có QR (§3.9) ([ADR-041-System-Center-Subscription-Invoices-Bank-Transfer-Qr.md](../01-Architecture-Decisions/ADR-041-System-Center-Subscription-Invoices-Bank-Transfer-Qr.md))
* [[01-Architecture-Decisions/ADR-044-Beta-Payments-Manual-Confirm-Emails-Sepay|ADR-044 KB (≙ ADR-059)]] — email báo xác nhận tay, giao dịch cần xử lý (§3.10–§3.11) ([ADR-044-Beta-Payments-Manual-Confirm-Emails-Sepay.md](../01-Architecture-Decisions/ADR-044-Beta-Payments-Manual-Confirm-Emails-Sepay.md))
* [[01-Architecture-Decisions/ADR-048-Checkout-Layout-Declared-Paid-Guest-Session|ADR-048 KB (≙ ADR-062)]] — "Tôi đã chuyển khoản", hạn theo phương thức, khách tự huỷ (§3.12)
* [[01-Architecture-Decisions/ADR-052-Studio-Order-Status-Change-Reopen-Late-Confirm|ADR-052 KB (≙ ADR-068)]] — người bán đổi trạng thái đơn, `SELLER_CANCEL`/`SELLER_REOPEN` (§2, §3.14) ([ADR-052-Studio-Order-Status-Change-Reopen-Late-Confirm.md](../01-Architecture-Decisions/ADR-052-Studio-Order-Status-Change-Reopen-Late-Confirm.md))
* Mã nguồn: `packages/core/src/order/state.ts` (máy trạng thái), `packages/core/src/order/expiry.ts` (`effectiveOrderStatus`,
  `canManuallyConfirmOrder`, `manualConfirmDeadline`, `computeOrderHoldExpiresAt`), `apps/web/lib/tenant-payment-transactions.ts`, `apps/web/lib/order-customer.ts`, `apps/web/lib/checkout-view.ts`, `apps/web/lib/order.ts` (`markOrderPaid`, `changeOrderStatusBySeller`, `orderStatusTargets`, `markOrderRefunded`, `runOrderSweep`),
  `apps/web/lib/payment-process.ts`, enum: `packages/db/prisma/schema.prisma`

*Quay lại: [[MOC-Home]] (../00-Index/MOC-Home.md)*

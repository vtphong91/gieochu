# Báo cáo kỹ thuật — Module Payment (System Center + Merchant)

> **Ngày:** 2026-09-18 · **Loại:** Báo cáo kỹ thuật chi tiết (verify trực tiếp trong code, không suy đoán).
> **Phạm vi:** Toàn bộ dòng tiền trong hệ thống TaniGos — cả 2 miền: **Merchant Payment** (khách ↔ nhà hàng, non-custodial) và **System Center Billing** (nhà hàng ↔ Tani, custodial phí SaaS).
> **Nguồn:** `prisma/schema.prisma`, `apps/web/lib/server/services/merchant-payment/**`, `apps/web/lib/server/services/system-billing/**`, `apps/web/app/api/v1/{payments,webhooks,merchant,admin,system}/**`, `apps/web/components/merchant/panels/{payments-panel,subscription-panel}.tsx`.
> Tài liệu kế hoạch gốc (bối cảnh quyết định): `plan/11-payment-per-merchant.md`, `plan/11a–11d`, `plan/12-system-center-billing.md`.

---

## 1. Nguyên tắc kiến trúc — 2 miền tách biệt hoàn toàn

TaniGos có **2 dòng tiền độc lập, không giao nhau**, cố ý tách bằng model, bảng, webhook, mã đối soát và cả trang cấu hình riêng:

| | **Merchant Payment** (§3) | **System Center Billing** (§4) |
|---|---|---|
| Tiền của ai → tài khoản ai | **Khách hàng → tài khoản ngân hàng của Nhà hàng** | **Nhà hàng → tài khoản ngân hàng của Tani** |
| Bản chất | **Non-custodial** — Tani không giữ tiền, chỉ điều phối trạng thái đơn | **Custodial** — Tani thực sự nhận phí thuê bao phần mềm |
| Việc mua bán | Khách mua món ăn | Nhà hàng mua quyền sử dụng nền tảng (gói Starter/Growth/Enterprise) |
| Model chính | `Payment`, `MerchantPaymentMethod`, `MerchantPaymentConfig`, `MerchantSecret`, `Refund` | `MerchantSubscription`, `PlatformInvoice` |
| Mã đối soát | `TANI` + 8 ký tự (vd. `TANIF8QK2M1R`) | `SUB` (hoặc prefix tùy chỉnh) + 8 ký tự (vd. `SUBF4H3JZW5`) |
| Webhook | `POST /v1/webhooks/merchant-payment/:merchantId/:source` | `POST /v1/webhooks/system-billing/sepay` |
| Cấu hình bởi | Từng **Merchant Owner/Admin** (số TK **của chính họ**) | **Super_admin** (số TK **của Tani**) |
| Trang cấu hình | Merchant CMS → **Thanh toán** (`payments-panel.tsx`) | System Center → **Gói dịch vụ SaaS → Tài khoản thu phí** (`admin/billing/payment`) |
| Trang khách hàng dùng | Merchant CMS → **Gói dịch vụ** (`subscription-panel.tsx`) | — |

Nguyên tắc này được chốt tường minh trong `plan/00-quyet-dinh-payment-out-of-scope.md` và nhắc lại trong code (`types.ts` của cả 2 module): *"Dòng tiền đi THẲNG về tài khoản ngân hàng của Merchant Owner (non-custodial). Tani chỉ điều phối trạng thái đơn."*

---

## 2. Sơ đồ tổng thể hệ thống Payment

```mermaid
flowchart TB
    subgraph CustomerSide["👥 KHÁCH HÀNG"]
        C["Khách đặt món<br/>(web /customer · mobile /m)"]
    end

    subgraph MerchantDomain["🏪 MIỀN 1 — MERCHANT PAYMENT (non-custodial)"]
        direction TB
        ORD["Order (COD | ONLINE)"]
        PAY["Payment<br/>INITIATED→PENDING→PAID/EXPIRED/FAILED"]
        MPM["MerchantPaymentMethod<br/>(nhiều dòng/merchant)"]
        PROV1{"Provider"}
        QRM["qr_manual<br/>QR tĩnh, merchant tự xác nhận"]
        SEPAY1["sepay<br/>QR động + webhook tự động"]
        PAYOS1["payos<br/>hosted checkout + webhook"]
        REF["Refund<br/>REQUESTED→MERCHANT_NOTIFIED→COMPLETED/REJECTED"]
        BANK_M["🏦 TK ngân hàng<br/>NHÀ HÀNG"]
    end

    subgraph BillingDomain["🏛️ MIỀN 2 — SYSTEM CENTER BILLING (custodial)"]
        direction TB
        SUB["MerchantSubscription<br/>TRIALING→ACTIVE→GRACE→SUSPENDED"]
        INV["PlatformInvoice<br/>ISSUED→PAID/EXPIRED/VOID"]
        PROV2{"Phương thức"}
        SEPAY2["sepay<br/>QR động + webhook tự động"]
        MANUAL2["manual<br/>QR tĩnh Tani tải lên + admin xác nhận"]
        BANK_T["🏦 TK ngân hàng<br/>TANI"]
        CRON["Cron hằng ngày<br/>/v1/system/billing/tick"]
    end

    SEPAY_EXT["☁️ SePay<br/>(VietQR webhook)"]
    PAYOS_EXT["☁️ PayOS<br/>(hosted checkout)"]

    C -->|"checkout"| ORD --> PAY
    PAY --> PROV1
    PROV1 --> QRM & SEPAY1 & PAYOS1
    SEPAY1 <-->|"webhook Apikey"| SEPAY_EXT
    PAYOS1 <-->|"webhook HMAC"| PAYOS_EXT
    QRM -->|"chuyển khoản"| BANK_M
    SEPAY1 -->|"chuyển khoản"| BANK_M
    PAYOS1 -->|"chuyển khoản"| BANK_M
    PAY -.->|"khiếu nại/hủy sau khi trả"| REF
    REF -->|"merchant chuyển khoản trả"| C

    ORD -.->|"nhà hàng cần subscription<br/>ACTIVE để nhận đơn"| SUB

    SUB -->|"merchant gia hạn (CMS > Gói dịch vụ)"| INV
    INV --> PROV2
    PROV2 --> SEPAY2 & MANUAL2
    SEPAY2 <-->|"webhook Apikey"| SEPAY_EXT
    SEPAY2 -->|"chuyển khoản"| BANK_T
    MANUAL2 -->|"chuyển khoản"| BANK_T
    INV -->|"PAID"| SUB
    CRON -->|"nhắc/GRACE/SUSPENDED<br/>+ hết hạn hóa đơn"| SUB
    CRON -->|"hóa đơn quá hạn"| INV

    style MerchantDomain fill:#fff7ed,stroke:#f97316
    style BillingDomain fill:#eff6ff,stroke:#2563eb
    style BANK_M fill:#dcfce7,stroke:#16a34a
    style BANK_T fill:#dcfce7,stroke:#16a34a
```

**Điểm mấu chốt của sơ đồ:** 2 miền chỉ chạm nhau ở **1 điểm logic duy nhất** — subscription phải `ACTIVE`/`TRIALING`/`GRACE` (chưa `SUSPENDED`) thì nhà hàng mới hiển thị và nhận đơn trên app khách. Ngoài điểm đó, không có bảng, service hay webhook nào dùng chung.

---

## 3. Miền 1 — Merchant Payment (thanh toán khách ↔ nhà hàng)

### 3.1. Data model

| Model | Vai trò | Trường đáng chú ý | Nguồn |
|---|---|---|---|
| `Payment` | 1 bản ghi thanh toán / đơn | `status` (`PaymentStatus`), `merchantId`, `matchCode` (unique), `qrCodeUrl`, `expiresAt`, `providerRef` (PayOS), `methodId`, `rawWebhookPayload` | `prisma/schema.prisma:687-717` |
| `MerchantPaymentMethod` | 1 dòng = 1 cổng thanh toán online merchant bật — **merchant có thể bật NHIỀU cùng lúc**, khách chọn ở checkout | `provider`, `enabled`, `bankBin/AccountNumber/AccountName`, `qrImageUrl` (qr_manual), `customerNote`, `verifiedAt`, `pendingTestCode` | `prisma/schema.prisma:721-744` |
| `MerchantPaymentConfig` | Cấu hình cấp merchant — từ P5 chỉ còn `codEnabled` (online đã chuyển hết sang `MerchantPaymentMethod`) | `codEnabled` | `prisma/schema.prisma:749-769` |
| `MerchantSecret` | Credential đã **mã hóa at-rest** (`lib/server/encrypt.ts`) — namespace theo `provider.methodId(.sub)` | `key`, `valueEncrypted` | `prisma/schema.prisma:772-782` |
| `Refund` | Yêu cầu hoàn tiền — luôn **thủ công** | `status` (`RefundStatus`), `customerBank*`, `proofImageUrl`, `resubmitCount`, `mode` (giữ chỗ cho tương lai, hiện luôn `manual`) | `prisma/schema.prisma:787-819` |

**Enum:**
- `PaymentStatus`: `INITIATED → PENDING → PAID | FAILED | REFUNDED | EXPIRED`
- `PaymentMethod` (chọn ở checkout): `COD | ONLINE`
- `RefundStatus`: `REQUESTED → MERCHANT_NOTIFIED → COMPLETED | REJECTED` (REJECTED có thể gửi lại → REQUESTED, tối đa `refundMaxResubmit` lần)

### 3.2. 5 provider — bảng năng lực

Định nghĩa tại `lib/server/services/merchant-payment/types.ts:46-84` (`PROVIDER_CAPABILITIES`):

| Provider | `checkoutKind` | Credential cần | Sẵn sàng | Cơ chế xác nhận |
|---|---|---|---|---|
| **`qr_manual`** | `qr` | Không có | ✅ | Merchant tải **ảnh QR tĩnh** (QR ngân hàng thật, giống ảnh "nhận tiền" trong app bank) → khách quét, **tự nhập** số tiền + nội dung → merchant tự bấm "Đã nhận tiền" cho từng đơn. **Không có webhook, không sinh QR động.** |
| **`sepay`** | `qr` | `apiKey` | ✅ | QR **động** sinh từ `img.vietqr.io` (kèm sẵn số tiền + nội dung theo đơn) → SePay gọi webhook khi tiền về → **tự động** chuyển `Payment` sang `PAID`. |
| **`payos`** | `hosted_redirect` | `clientId`, `apiKey`, `checksumKey` | ✅ | Trang thanh toán riêng của PayOS (redirect) → webhook HMAC-SHA256 tự xác nhận. Hoàn tiền **best-effort** qua API PayOS (endpoint chưa được PayOS công bố chính thức tại thời điểm code — `refund()` trả `{ok:false}` nếu cổng từ chối, không chặn hoàn tiền thủ công). |
| **`momo`** | `hosted_redirect` | `partnerCode`, `accessKey`, `secretKey` | ❌ khung | Cần pháp nhân doanh nghiệp + hợp đồng MoMo — **chưa tích hợp API thật**, bị chặn ở `updateMethod()` khi cố bật (`PROVIDER_NOT_READY`). |
| **`vnpay`** | `hosted_redirect` | `tmnCode`, `hashSecret` | ❌ khung | Tương tự — chưa tích hợp. |

**Điểm bảo mật quan trọng (đã chốt trong phiên làm việc trước):** `qr_manual` **không bao giờ** dùng mã BIN ngân hàng để tự sinh QR động thay thế — đây là quyết định cố ý (không ngân hàng nào cấp mã BIN công khai; QR tĩnh là ảnh merchant tự tải lên, giống hệt cách chuyển khoản thủ công thông thường qua ảnh QR "nhận tiền" của ngân hàng).

Factory chọn implementation theo `provider` key: `lib/server/services/merchant-payment/providers/index.ts:14-20`.

### 3.3. Luồng thanh toán của khách hàng

```mermaid
sequenceDiagram
    actor KH as Khách hàng
    participant APP as App khách (/customer · /m)
    participant API as ChargeService
    participant PR as Provider (qr_manual/sepay/payos)
    participant BANK as TK ngân hàng NHÀ HÀNG
    participant EXT as SePay/PayOS (nếu có)

    KH->>APP: Chọn món → checkout → chọn phương thức ONLINE
    APP->>API: POST /v1/payments/charge (methodId)
    API->>API: initOnlineCharge() — sinh matchCode "TANI…"<br/>+ expiresAt = now + unpaidOnlineOrderTimeoutMin
    API->>PR: createCharge()
    alt qr_manual
        PR-->>API: qrCodeUrl = ảnh QR tĩnh merchant đã tải
    else sepay
        PR-->>API: qrCodeUrl = img.vietqr.io (STK+số tiền+matchCode)
    else payos
        PR-->>API: checkoutUrl = trang thanh toán PayOS
    end
    API-->>APP: QR / checkoutUrl + matchCode + hạn thanh toán
    APP-->>KH: Hiển thị QR (hoặc redirect PayOS)
    KH->>BANK: Chuyển khoản đúng nội dung "TANI…"

    alt sepay / payos (tự động)
        BANK-->>EXT: Biến động số dư
        EXT->>API: Webhook (xem §3.4)
        API->>API: Payment → PAID
    else qr_manual (thủ công)
        Note over APP: Merchant CMS thấy đơn PLACED chưa thanh toán
        APP->>API: Merchant bấm "Xác nhận đã nhận tiền"
        API->>API: confirmManualPayment() — chỉ khi provider=qr_manual,<br/>status ∈ {INITIATED,PENDING}, order còn PLACED
        API->>API: Payment → PAID
    end

    Note over API: Quá unpaidOnlineOrderTimeoutMin chưa trả → cron<br/>expireUnpaidOnlineOrders() tự hủy đơn (Payment EXPIRED)
```

Nguồn: `charge.service.ts` — `initOnlineCharge()` (dòng 182-255), `confirmManualPayment()` (dòng 273-315), `expireUnpaidOnlineOrders()` (dòng 379-390).

**Idempotent theo thiết kế:** gọi lại `initOnlineCharge` khi đã có `matchCode`/`expiresAt` sẽ **tái sử dụng** giá trị cũ thay vì sinh mới (dòng 217-220) — tránh đổi mã QR giữa chừng nếu khách back rồi mở lại màn thanh toán.

### 3.4. Luồng webhook (SePay / PayOS)

```mermaid
flowchart TD
    A["POST /v1/webhooks/merchant-payment/:merchantId/:source"] --> B{"source hợp lệ?<br/>(sepay/payos/momo/vnpay)"}
    B -->|"không"| Z1["200 ignored: unknown_source"]
    B -->|"có"| C["Lấy TẤT CẢ MerchantPaymentMethod<br/>của merchant khớp provider = source"]
    C --> D{"Có method nào?"}
    D -->|"không"| Z2["200 ignored: no_method"]
    D -->|"có"| E["Thử verifyWebhook() lần lượt<br/>với secret CỦA TỪNG method"]
    E --> F{"Method nào xác thực<br/>chữ ký/Apikey đúng?"}
    F -->|"không có method nào"| Z3["401 Unauthorized"]
    F -->|"khớp 1 method"| G["applyWebhookPayment()"]
    G --> H{"matchCode bắt đầu<br/>'TANITEST'?"}
    H -->|"có"| I["Đánh dấu method verifiedAt<br/>(bước Kiểm tra kết nối)"]
    H -->|"không"| J["Tìm Payment theo matchCode<br/>(hoặc providerRef cho PayOS)"]
    J --> K{"Tìm thấy?"}
    K -->|"không"| Z4["200 ignored: no_match"]
    K -->|"đã PAID"| Z5["200 duplicate: true"]
    K -->|"tìm thấy, chưa PAID"| L{"Số tiền khớp?"}
    L -->|"lệch"| Z6["200 mismatch: true<br/>(lưu raw, KHÔNG auto-PAID)"]
    L -->|"khớp"| M{"Đơn đã CANCELLED<br/>hoặc Payment EXPIRED?"}
    M -->|"có — thanh toán TRỄ"| N["Payment → PAID (markPaidLate)<br/>+ tự tạo Refund REQUESTED<br/>(cần hỏi STK khách để hoàn)"]
    M -->|"không"| O["Payment → PAID (markWebhookPaid)<br/>+ ghi OrderStatusEvent"]
```

Nguồn: route `app/api/v1/webhooks/merchant-payment/[merchantId]/[provider]/route.ts`, logic `applyWebhookPayment()` trong `charge.service.ts:321-376`.

**Thiết kế đáng chú ý:**
- **1 merchant có thể có nhiều `MerchantPaymentMethod` cùng nhận webhook từ 1 nguồn** (ví dụ 2 cổng `sepay` khác STK) — route thử xác thực **lần lượt** bằng secret của từng method thay vì giả định chỉ có 1.
- **Nhánh hợp lệ luôn trả HTTP 200** (kể cả `ignored`/`mismatch`) — chỉ khi **không method nào xác thực được chữ ký** mới trả `401`. Đây là để tránh SePay/PayOS retry vô hạn khi lỗi chỉ là "không khớp dữ liệu" chứ không phải lỗi xác thực.
- **Thanh toán trễ** (khách chuyển khoản sau khi đơn đã bị hủy/hết hạn) không bị bỏ qua — hệ thống vẫn ghi nhận `PAID` rồi **tự động tạo yêu cầu hoàn tiền** để không mất dấu vết dòng tiền.

### 3.5. Luồng hoàn tiền — luôn thủ công

```mermaid
stateDiagram-v2
    [*] --> REQUESTED: Khách yêu cầu<br/>(chỉ khi Payment đã PAID +<br/>đơn còn PLACED/CONFIRMED/CANCELLED)
    REQUESTED --> MERCHANT_NOTIFIED: Hệ thống đã báo merchant
    MERCHANT_NOTIFIED --> COMPLETED: Merchant chuyển khoản trả<br/>+ BẮT BUỘC ảnh biên lai (proofImageUrl)
    REQUESTED --> COMPLETED: (merchant xử lý ngay,<br/>không cần qua NOTIFIED)
    MERCHANT_NOTIFIED --> REJECTED: Merchant từ chối<br/>+ BẮT BUỘC lý do (≥3 ký tự)
    REQUESTED --> REJECTED
    REJECTED --> REQUESTED: Khách gửi lại<br/>(tối đa refundMaxResubmit lần,<br/>mặc định 2)
    COMPLETED --> [*]: Khách bấm<br/>"Tôi đã nhận tiền"<br/>(customerConfirmedAt)
```

Nguồn: `refund.service.ts` — `requestRefund()` (dòng 126-217), `completeRefund()` (230-256), `rejectRefund()` (259-279), `customerConfirmReceipt()` (282-294).

- **`amount` luôn = giá trị đơn** — hoàn toàn bộ, không hoàn một phần.
- **Phí chuyển khoản khi hoàn do khách chịu** (business rule ghi rõ trong comment code).
- Trường `mode`/`providerRefundRef` đã có sẵn trong schema cho **hoàn tiền tự động qua API cổng trong tương lai**, nhưng **hiện tại service không bao giờ gọi** (`refund.service.ts` dòng 214-216: *"Hoàn tiền LUÔN thủ công... tránh lạm dụng + lỗi hệ thống"*) — kể cả PayOS có `refund()` implement sẵn, cũng chưa được `RefundService` gọi tới.

### 3.6. Chính sách hệ thống (`merchant_payment_policy`)

Super_admin cấu hình tại **System Center → Cấu hình hệ thống → Chính sách thanh toán** (`admin/settings/payment-policy`), áp dụng **chung cho mọi merchant**:

| Tham số | Mặc định | Giới hạn | Ý nghĩa |
|---|---|---|---|
| `unpaidOnlineOrderTimeoutMin` | 15 phút | 3–120 | Đơn ONLINE chưa trả quá hạn → tự hủy |
| `manualPaymentReminderMin` | 5 phút | 1–60 | Nhắc merchant xác nhận `qr_manual` |
| `refundReminderHours` | 24 giờ | 1–168 | Nhắc merchant xử lý yêu cầu hoàn tiền |
| `refundMaxResubmit` | 2 lần | 0–10 | Số lần khách gửi lại sau khi bị từ chối |

Nguồn: `policy.service.ts:12-24`.

### 3.7. API routes chính

| Route | Vai trò |
|---|---|
| `POST /v1/payments/charge` | Khách mở màn thanh toán (`initOnlineCharge`) |
| `GET /v1/payments/status/:orderId` | Khách poll trạng thái |
| `POST /v1/orders/:id/confirm-manual-payment` | Merchant xác nhận `qr_manual` |
| `POST /v1/webhooks/merchant-payment/:merchantId/:source` | Webhook SePay/PayOS per-merchant |
| `GET/POST/PATCH/DELETE /v1/merchant/payment-methods[/:id]` | CRUD phương thức thanh toán (CMS) |
| `POST /v1/merchant/payment-methods/:id/test` | "Kiểm tra kết nối" SePay/PayOS |
| `GET/PATCH /v1/merchant/payment-config` | Bật/tắt COD |
| `GET /v1/merchant/payment-report` | Báo cáo đối soát (chỉ dữ liệu Tani có sẵn — **không thay thế sao kê ngân hàng**, `report.service.ts:1-4`) |
| `GET/PATCH /v1/system/payment-policy` | Super_admin cấu hình policy |
| `GET /v1/restaurants/:id/payment-methods` | Public — danh sách phương thức online khả dụng cho 1 nhà hàng |

### 3.8. Giao diện

- **Merchant CMS → Thanh toán** (`components/merchant/panels/payments-panel.tsx`): danh sách phương thức đã bật, form thêm/sửa từng provider (ẩn/hiện trường theo `isQrManual`/`isSepay`/`isPayos`), nút "Kiểm tra kết nối" hiển thị QR test + mã webhook, toggle bật/tắt COD.
- **System Center → Chính sách thanh toán**: chỉnh 4 tham số policy ở §3.6.

---

## 4. Miền 2 — System Center Billing (phí thuê bao SaaS)

### 4.1. Data model

| Model | Vai trò | Trường đáng chú ý | Nguồn |
|---|---|---|---|
| `MerchantSubscription` | 1 subscription / merchant (unique) | `planKey`, `status` (`SubscriptionStatus`), `currentPeriodStart/End`, `trialEndsAt`, `suspendedForBilling`, `remindedForPeriodEnd` | `prisma/schema.prisma:1121-1139` |
| `PlatformInvoice` | 1 hóa đơn phí SaaS / lần gia hạn | `status` (`PlatformInvoiceStatus`), `paymentMethod` (`sepay`/`manual`), `matchCode` (unique, prefix `SUB`), `sepayRef`, `confirmedByUserId`, `confirmNote` | `prisma/schema.prisma:1141-1169` |

Cấu hình lưu trong `SystemIntegrationSetting` (key-value JSON, KHÔNG phải bảng riêng):
- Key **`system_billing`** — 3 gói (Starter/Growth/Enterprise) + policy vận hành.
- Key **`system_payment`** — TK ngân hàng Tani + bật/tắt 2 phương thức thu (`sepay`/`manual`).

**Enum:**
- `SubscriptionStatus`: `TRIALING | ACTIVE | GRACE | SUSPENDED | CANCELLED`
- `PlatformInvoiceStatus`: `ISSUED | PAID | VOID | EXPIRED`

### 4.2. Vòng đời Subscription

```mermaid
stateDiagram-v2
    [*] --> TRIALING: Nhà hàng mới được duyệt<br/>(dùng thử trialDays, mặc định 14 ngày)
    [*] --> ACTIVE: Nhà hàng pilot đã approved TỪ LÂU<br/>(approvedAt cách hiện tại > trialDays)<br/>→ ân hạn lịch sự pilotCourtesyDays (30 ngày)
    TRIALING --> ACTIVE: Hóa đơn đầu tiên PAID
    ACTIVE --> ACTIVE: Gia hạn/nâng gói thành công<br/>(currentPeriodEnd nối thêm)
    ACTIVE --> GRACE: Cron — quá currentPeriodEnd
    TRIALING --> GRACE: Cron — quá hạn (đường tắt nếu trial hết mà chưa trả)
    GRACE --> ACTIVE: Thanh toán trong thời gian ân hạn
    GRACE --> SUSPENDED: Cron — quá (currentPeriodEnd + graceDays)
    TRIALING --> SUSPENDED: Cron nhảy cóc (chạy trễ nhiều ngày,<br/>bỏ qua thẳng mốc GRACE)
    ACTIVE --> SUSPENDED: (tương tự — cron nhảy cóc)
    SUSPENDED --> ACTIVE: Thanh toán → applyPaidInvoice() mở lại NGAY
    ACTIVE --> ACTIVE: Admin override (grant_days/set_plan)
    SUSPENDED --> SUSPENDED: Admin override (suspend thủ công)
    note right of SUSPENDED
        suspendedForBilling=true
        + Merchant.status='suspended' NGAY nếu
        không còn đơn active; nếu còn đơn
        đang chạy → cron ngày sau kiểm lại
        (đơn không bị bỏ dở giữa chừng)
    end note
```

Nguồn: `subscription.service.ts` — `ensureSubscription()` (dòng 91-123), `runBillingTick()` (269-349), `applyPaidInvoice()` (238-256), `adminOverride()` (415-467).

**Enforcement gói** (chặn TRƯỚC khi tạo, không phải dọn dẹp SAU):
- `assertCanAddBranch()` — chặn thêm chi nhánh nếu subscription `SUSPENDED`/trial hết hạn, hoặc đã đạt `maxBranches` của gói.
- `assertCanAddRestaurant()` — mỗi merchant tối đa **1 nhà hàng**.
- Hạ gói bị chặn nếu số chi nhánh đang dùng **vượt** `maxBranches` gói mới (`invoice.service.ts:145-154`).

### 4.3. Vòng đời Hóa đơn (`PlatformInvoice`)

```mermaid
stateDiagram-v2
    [*] --> ISSUED: Merchant chọn gói + số tháng + phương thức<br/>→ createRenewalInvoice()
    ISSUED --> PAID: Webhook SePay khớp matchCode<br/>HOẶC super_admin confirmManual()
    ISSUED --> EXPIRED: Cron — quá dueAt (payWindowDays)<br/>chưa thanh toán
    PAID --> [*]
    EXPIRED --> [*]: Merchant tạo hóa đơn mới được<br/>(hóa đơn cũ không hồi sinh)
    ISSUED --> VOID: (enum có sẵn — hủy thủ công,<br/>chưa thấy service gọi trong luồng hiện tại)
```

Nguồn: `invoice.service.ts` — `createRenewalInvoice()` (111-207), `confirmManual()` (276-292), `applyWebhook()` (232-257), `expireOverdueInvoices()` (259-261).

**Logic tính tiền/kỳ hạn đáng chú ý** (`createRenewalInvoice`, dòng 172-206):
- **Dedupe**: đã có hóa đơn `ISSUED` chưa hết hạn → trả lại hóa đơn đó, **không tạo hóa đơn thứ 2** (tránh merchant bấm nhiều lần ra nhiều hóa đơn trùng).
- **Nâng gói (upgrade)**: kỳ mới bắt đầu **ngay hôm nay**, cộng thêm số ngày còn lại của kỳ cũ (không mất ngày đã trả trước đó).
- **Gia hạn cùng gói / hạ gói**: kỳ mới nối tiếp `currentPeriodEnd` hiện tại (`max(now, currentPeriodEnd)` làm điểm bắt đầu).
- `amountVnd = unitPriceVnd × months` — đơn giá lấy từ `plan.priceMonthly` tại **thời điểm tạo hóa đơn** (đổi giá gói sau đó không ảnh hưởng hóa đơn đã phát hành).
- VAT (`policy.vatPercent`) chỉ **tách hiển thị** trên hóa đơn PDF, **không cộng thêm** vào `amountVnd` — cùng triết lý "giá đã gồm thuế" như module Catalog/Order.

### 4.4. Luồng tạo & thanh toán hóa đơn

```mermaid
sequenceDiagram
    actor M as Merchant Owner/Admin
    participant CMS as Merchant CMS (Gói dịch vụ)
    participant SVC as PlatformInvoiceService
    participant BANK as TK ngân hàng TANI
    participant SEPAY as SePay
    actor SA as Super_admin

    M->>CMS: Chọn gói + số tháng + phương thức (sepay/manual)
    CMS->>SVC: POST /v1/merchant/subscription/renew
    SVC->>SVC: createRenewalInvoice()<br/>tính periodStart/End, amountVnd, matchCode "SUB…"
    SVC-->>CMS: PlatformInvoice ISSUED + QR

    alt phương thức = sepay
        CMS-->>M: QR động (VietQR từ TK Tani)
        M->>BANK: Chuyển khoản đúng nội dung "SUB…"
        BANK-->>SEPAY: Biến động số dư
        SEPAY->>SVC: Webhook Apikey (do Tani tự đặt)
        SVC->>SVC: applyWebhook() → khớp matchCode → PAID
    else phương thức = manual
        CMS-->>M: QR TĨNH (ảnh Tani đã tải lên) + PDF hóa đơn
        M->>BANK: Chuyển khoản đúng nội dung "SUB…"
        Note over SA: Cron B5 nhắc nếu quá manualConfirmSlaHours (24h)<br/>chưa được đối chiếu
        SA->>SVC: Đối chiếu sao kê → confirmManual()
        SVC->>SVC: PlatformInvoice → PAID
    end

    SVC->>SVC: subscriptions.applyPaidInvoice()<br/>→ Subscription ACTIVE, cộng kỳ, gỡ suspend
    SVC-->>M: Email biên nhận (sendBillingPaidEmail)
```

Nguồn: `invoice.service.ts:111-207` (tạo), `276-292` (confirm thủ công), `232-257` (webhook), route webhook `app/api/v1/webhooks/system-billing/sepay/route.ts`.

**Khác biệt quan trọng với miền Merchant Payment:** hóa đơn `manual` ở đây dùng **ảnh QR tĩnh của chính Tani** (`manualQrImageUrl`, tải sẵn trong System Center) — **không phải QR merchant tải lên**. Cùng nguyên tắc bảo mật "không tự sinh QR động thay thế ảnh tĩnh" như `qr_manual` ở miền 1 (`config.service.ts:275-276`: *"'Chuyển khoản thủ công' LUÔN cần ảnh QR tĩnh thật — KHÔNG có chuyện tự sinh QR động thay thế"*).

### 4.5. Cron hằng ngày — `POST /v1/system/billing/tick`

```mermaid
flowchart TD
    START["GitHub Actions gọi 1 lần/ngày<br/>Authorization: Bearer CRON_SECRET (fail-closed)"] --> A["runBillingTick()"]
    A --> B["Với mỗi subscription TRIALING/ACTIVE/GRACE/SUSPENDED"]
    B --> C{"now > graceDeadline?"}
    C -->|"có"| D["→ SUSPENDED + suspendedForBilling=true<br/>+ thử hardSuspend (nếu hết đơn active)"]
    C -->|"chưa, nhưng now ≥ periodEnd"| E["→ GRACE"]
    C -->|"chưa tới periodEnd"| F{"Trong remindDaysBefore<br/>ngày & chưa nhắc kỳ này?"}
    F -->|"có"| G["Đánh dấu đã nhắc + queue email reminder"]
    F -->|"không"| H["Bỏ qua"]
    D --> I["expireOverdueInvoices()<br/>ISSUED quá dueAt → EXPIRED"]
    E --> I
    G --> I
    H --> I
    I --> J["Gửi email reminder/grace/suspended<br/>(best-effort, không chặn cron)"]
    J --> K["listPendingManualOverSla()<br/>hóa đơn manual ISSUED quá manualConfirmSlaHours"]
    K --> L{"Có hóa đơn treo?"}
    L -->|"có"| M["Gửi digest email cho TẤT CẢ<br/>admin/super_admin đang hoạt động"]
    L -->|"không"| N["Kết thúc"]
    M --> N
    D -.->|"suspended ≥ 10 trong 1 lần chạy"| WARN["Log cảnh báo bất thường<br/>(HIGH_SUSPEND_WARN)"]
```

Nguồn: `app/api/v1/system/billing/tick/route.ts`, `subscription.service.ts:269-349`.

Scheduler thực tế: **GitHub Actions** (`.github/workflows/cron-system-billing-tick.yml`) — không dùng Vercel Cron vì gói Hobby chỉ cho 1 cron/ngày và đã dùng cho cron order-timeout.

### 4.6. Cấu hình

**`system_billing` — Chính sách & Gói** (System Center → Gói dịch vụ SaaS → Giá gói & Chính sách):

| Tham số | Mặc định | Ý nghĩa |
|---|---|---|
| `trialDays` | 14 | Số ngày dùng thử cho merchant mới |
| `pilotCourtesyDays` | 30 | Ân hạn cho merchant pilot cũ (approved trước khi có billing) |
| `remindDaysBefore` | 7 | Nhắc trước khi hết hạn N ngày |
| `graceDays` | 7 | Số ngày ân hạn sau khi hết hạn trước khi khóa |
| `payWindowDays` | *(bắt buộc set, không có default an toàn)* | Hạn thanh toán mỗi hóa đơn |
| `manualConfirmSlaHours` | 24 | SLA nhắc admin đối chiếu hóa đơn `manual` |
| `months` | `[1,3,6,12]` | Các lựa chọn số tháng gia hạn |
| `vatPercent` | `null` (không tách VAT) | % VAT tách hiển thị trên hóa đơn PDF |
| `plans[]` | Starter (1 chi nhánh) · Growth (3) · Enterprise (∞) | `priceMonthly` mặc định `null` — **phải set giá trước khi merchant gia hạn được** |

**`system_payment` — TK thu phí & phương thức** (System Center → Gói dịch vụ SaaS → Tài khoản thu phí):

| Tham số | Ý nghĩa |
|---|---|
| `bankBin/AccountNumber/AccountName` | TK ngân hàng **của Tani** |
| `sepayEnabled` + `sepayApiKey` (mã hóa) | Bật SePay — bắt buộc "Kiểm tra kết nối" thành công (`sepayVerifiedAt`) trước khi bật |
| `matchCodePrefix` | Mặc định `SUB` — 2-6 ký tự A-Z, đổi được (chốt trong phiên trước) |
| `manualEnabled` + `manualQrImageUrl` + `manualNote` | Bật chuyển khoản thủ công — bắt buộc có ảnh QR tĩnh trước khi bật |

**Cơ chế tự-tắt an toàn** (`config.service.ts:256-273`): đổi số TK hoặc API key → **tự động tắt SePay** và xóa `sepayVerifiedAt`/`sepayPendingTestCode`, bắt kiểm tra kết nối lại — tránh treo trạng thái "đang bật" với thông tin chưa từng được xác minh thật.

### 4.7. API routes chính

| Route | Vai trò |
|---|---|
| `GET /v1/merchant/subscription` | Merchant xem subscription hiện tại (banner, số ngày còn lại) |
| `POST /v1/merchant/subscription/renew` | Tạo hóa đơn gia hạn/nâng gói |
| `GET /v1/merchant/subscription/invoices[/:id]` | Lịch sử hóa đơn |
| `GET /v1/merchant/subscription/invoices/:id/pdf` | Hóa đơn dạng in được (đã có logo + QR — xem §7) |
| `POST /v1/webhooks/system-billing/sepay` | Webhook SePay của Tani |
| `GET/PATCH /v1/admin/billing/plans` | Super_admin sửa giá gói + policy |
| `GET/PATCH /v1/admin/settings/system-payment` + `/test-sepay` | Cấu hình TK thu phí + kiểm tra kết nối |
| `GET /v1/admin/billing/subscriptions[/:merchantId]` + `POST .../override` | Console theo dõi + can thiệp thủ công |
| `GET/POST /v1/admin/billing/invoices` + `POST .../confirm-manual` | Danh sách hóa đơn + xác nhận thủ công |
| `POST /v1/admin/billing/backfill` | Chạy 1 lần sau deploy — tạo subscription cho merchant approved còn thiếu |
| `POST /v1/system/billing/tick` | Cron hằng ngày (CRON_SECRET) |

### 4.8. Giao diện

- **System Center**: `/admin/billing/plans` (giá gói & chính sách), `/admin/billing/payment` (TK thu phí Tani + SePay/manual), `/admin/billing/subscriptions` (danh sách toàn bộ merchant, filter theo trạng thái, override).
- **Merchant CMS → Gói dịch vụ** (`subscription-panel.tsx`): gói hiện tại, nâng gói, hóa đơn đang chờ (QR + nút xem/lưu PDF — **QR đã chuyển sang bên phải** theo yêu cầu chỉnh sửa gần nhất), lịch sử hóa đơn.

---

## 5. Bảo mật & cô lập dữ liệu

| Cơ chế | Áp dụng |
|---|---|
| **Mã hóa credential at-rest** | `MerchantSecret.valueEncrypted` (miền 1) và `system_payment.sepayApiKey` (miền 2) đều qua `lib/server/encrypt.ts`; hiển thị lại ở CMS luôn ở dạng **mask** (`maskValue()`), không bao giờ trả plaintext qua API GET. |
| **Webhook signature theo từng domain** | SePay: header `Authorization: Apikey <key>` — **key do chính Tani/merchant tự đặt**, dán vào dashboard SePay (không phải key SePay cấp). PayOS: HMAC-SHA256 querystring-sort bằng `checksumKey`. Sai chữ ký → không method/nguồn nào khớp → `401`. |
| **Cô lập theo merchant** | Route webhook per-merchant `.../:merchantId/:source` — chỉ thử secret của **đúng merchant đó**; matchCode/providerRef được lookup **kèm điều kiện `merchantId`** ở tầng store, chặn 1 merchant dùng matchCode đoán được để đánh lừa webhook của merchant khác. |
| **2 namespace matchCode tách biệt** | `TANI…` (đơn hàng) vs `SUB…` (hóa đơn SaaS) — regex đối soát ở mỗi domain chỉ khớp đúng prefix của mình, không nhầm lẫn hóa đơn phí SaaS với đơn hàng khách dù cùng chạy qua SePay. |
| **Xác thực bắt buộc trước khi bật cổng tự động** | Cả `sepay` (2 miền) và `payos` đều bắt "Kiểm tra kết nối" (`verifiedAt` != null) thành công mới cho `enabled=true` — tránh bật nhầm cấu hình chưa test. |
| **Không tự sinh QR động thay ảnh tĩnh** | Nguyên tắc bảo mật lặp lại ở CẢ 2 miền cho phương thức thủ công (`qr_manual`, `manual`) — QR luôn là ảnh thật do người dùng tải lên, không có mã BIN ngân hàng bị lộ qua API sinh QR tự động. |
| **Fail-closed cho cron** | `POST /v1/system/billing/tick` bắt buộc `Authorization: Bearer CRON_SECRET` đúng — sai/thiếu → `401`, không có đường vòng. |
| **Route → Service → Store, không route nào đụng `prisma` trực tiếp** | Tuân thủ quy tắc kiến trúc chung của dự án (`getMerchantPaymentChargeService()`, `getPlatformInvoiceService()`, v.v. qua `store-factory.ts`). |

---

## 6. Tình trạng hiện tại & việc còn dở

- ✅ **Hoàn thiện, đã verify E2E trên Neon dev**: cả 2 miền (theo memory dự án — Payment P1-P5, System Center Billing B1-B5).
- ✅ **Hóa đơn PDF** (`invoices/:id/pdf`): vừa bổ sung **logo thương hiệu động** (qua `loadBrandingConfig()`) và **ảnh QR** (dùng lại đúng `inv.qr` đã tính sẵn — không tự sinh QR riêng, tránh lệch với QR hiển thị trong CMS) — 2026-09-18.
- ⚠️ **`momo`/`vnpay`** (miền 1): chỉ là khung (`stub.provider.ts`) — cần pháp nhân doanh nghiệp + hợp đồng, **chưa tích hợp API thật**, bị chặn cứng ở tầng service (`PROVIDER_NOT_READY`) nếu cố bật.
- ⚠️ **Hoàn tiền tự động qua API cổng** (`RefundExecInput`/`RefundExecResult`, `PayOsProvider.refund()`): interface đã có sẵn cho tương lai, nhưng `RefundService` hiện **không gọi** — hoàn tiền miền 1 luôn 100% thủ công theo chủ ý thiết kế (tránh lạm dụng).
- ⚠️ **`VOID`** (`PlatformInvoiceStatus`): enum đã khai báo trong schema nhưng chưa thấy service nào gán trạng thái này trong luồng hiện tại (chỉ có `ISSUED → PAID` hoặc `ISSUED → EXPIRED` qua cron).
- ⚠️ **`Refund.mode`**: cột đã có (`'manual' | 'auto'`), nhưng giá trị thực tế luôn là `'manual'` — cột `providerRefundRef` chưa từng được ghi.
- 📌 **`plan/11d-payment-P4-provider-mo-rong.md` §7** (theo `GIOI-THIEU-HE-THONG.md`): còn hoãn việc dọn route pilot cũ vì web checkout còn dùng — cần rà lại nếu muốn dọn dứt điểm.

---

## 7. Tham chiếu tài liệu

| Chủ đề | File |
|---|---|
| Quyết định payment out-of-scope ban đầu | `plan/00-quyet-dinh-payment-out-of-scope.md` |
| Kế hoạch gốc Merchant Payment (P1-P5) | `plan/11-payment-per-merchant.md`, `plan/11a` (nền tảng), `plan/11b` (SePay webhook), `plan/11c` (hoàn tiền), `plan/11d` (mở rộng provider) |
| Kế hoạch gốc System Center Billing (B1-B5) | `plan/12-system-center-billing.md` |
| Giới thiệu tổng quan hệ thống | `plan/GIOI-THIEU-HE-THONG.md` §3 (bảng module), §5.2 (sequence thanh toán), §5.4 (state subscription) |
| Ghi chú memory (evolving) | `.claude/…/memory/project_payment_module_p1_p5.md`, `project_system_center_billing_plan.md` |

---

*Báo cáo này được viết bằng cách đọc trực tiếp source code hiện hành (không dựa vào tài liệu kế hoạch cũ để suy đoán) — mọi trích dẫn file:dòng đều đã verify tại thời điểm 2026-09-18.*

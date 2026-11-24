---
tags:
  - adr
  - payment
  - billing
  - order
  - database
  - status/accepted
date: 2026-11-24
decider: vtphong91
status: Accepted — đã code, verify đạt (Quốc báo), chưa commit; migration đã áp DB dev, production (VPS) chưa áp
---

# 🏛️ ADR-049: Mã thanh toán SePay — tiền tố 2–5 chữ cái + 8 chữ số, dùng chung System và Studio

## 1. Trạng Thái (Status)
**ĐÃ PHÊ DUYỆT (Accepted)** — tương ứng **ADR-065** trong [`docs/DECISIONS.md`](../../docs/DECISIONS.md) (chủ dự án chốt 2026-11-24). Bản trích ghi theo duyệt
của Quốc (brief 2026-11-24).

Tiến độ (đối chiếu 2026-11-24): code ở working tree, **chưa commit** ✅ `git status`. Migration expand `20261124120000_adr065_order_payment_ref`: **đã áp DB dev
(Neon, `.env`)** 🟡 (Quốc báo; Long không chạy lệnh DB); **production (VPS) chưa áp** ❓ — **bước bắt buộc khi deploy**: chạy `prisma migrate deploy` trên DB production
**trước/khi** deploy code ADR-065 (code mới đọc/ghi `orders.paymentRef`). Đính chính 2026-11-24: bản ghi trước ghi "đã áp lên DB dùng chung" là sai — Quốc xác minh
bằng truy vấn chỉ đọc rằng DB của `.env` máy dev **không** phải DB production gieochu.net (KB-Audit §50 mục 12). **Không thêm `route.ts`** (24 dưới `/api`, 26 toàn app ✅ đếm). `pnpm test:count` = **105/105 unit,
69/69 integration** ✅ (Long chạy, chỉ đếm). Typecheck/unit/integration xanh 🟡 (Quốc báo trong `docs/PLAN.md`, Long không chạy lại).

Mức xác minh: ✅ Long đã đối chiếu code working tree · 🟡 theo `docs/DECISIONS.md`/brief của Quốc · ❓ cần môi trường thật — **chưa thử giao dịch thật** với mã mới.

---

## 2. Bối Cảnh (Context) 🟡
- 2026-11-24: hoá đơn gói `SEVQRWQRMN878` (99.000đ, VietinBank) đã chuyển khoản đúng nhưng kẹt "Chờ thanh toán". Trên SePay giao dịch hiện "Mã thanh toán: —" và
  **không có webhook**.
- Nguyên nhân: "Cấu trúc mã thanh toán" của SePay chỉ nhận diện **hậu tố toàn số, độ dài cố định** (ô tiền tố 2–5 chữ cái). Mã hoá đơn cũ có hậu tố 8 ký tự lẫn chữ
  → SePay không trích được mã → không gọi webhook.
- Phía gian hàng lỗi y hệt (mã đơn = tiền tố gian hàng + 6 ký tự lẫn chữ), và mã đơn không thể bắt đầu bằng từ khoá ngân hàng bắt buộc (VietinBank: `SEVQR`).
- Tài liệu chạy thật được đối chiếu: `docs/sepay-auto-payment-guide.md` §7, §13 (tài liệu của một hệ thống khác, dùng để tham khảo cách SePay nhận diện mã).

**Chủ dự án chốt:** sửa đồng bộ cả System và Studio; Studio dùng **cột `paymentRef` riêng**; cho chạy migration expand; nâng trần test +3 unit / +1 integration;
**không** xử lý hoá đơn/đơn cũ.

---

## 3. Quyết Định (Decision)

### 3.1. Định dạng duy nhất ✅ code
- `generatePaymentCode(prefix)` (`packages/core/src/billing/payment-code.ts`, export ở `@gieochu/core` và subpath mới **`@gieochu/core/payment-code`**): tiền tố
  **2–5 chữ cái in hoa** + **8 chữ số**, chữ số đầu khác 0, CSPRNG (Web Crypto, loại lệch modulo). Ví dụ `SEVQR40718256`.
- `normalizePaymentCodePrefix(value)` — trim + in hoa, ngoài `^[A-Z]{2,5}$` → `null`. `isPaymentCode(code, prefix?)` kiểm định dạng.
- Hằng `PAYMENT_CODE_DIGITS = 8`, `PAYMENT_CODE_PREFIX_MIN = 2`, `PAYMENT_CODE_PREFIX_MAX = 5`.

### 3.2. System — hoá đơn gói ✅ code
- Mã hoá đơn = mã thanh toán: SePay dùng tiền tố đã cấu hình (`paymentPrefix`), cổng khác dùng `SUB` (`generateInvoiceCode` gọi `generatePaymentCode`).
  Tiền tố SePay cấu hình không hợp lệ → `SUB` + `logger.warn`.
- Webhook platform và tab "Giao dịch cổng" tách mã bằng **`extractSepayPaymentCodes`** (qua `sepayInvoiceReferenceCandidates`): chỉ hậu tố **8 chữ số, không theo sau bởi
  chữ số**; thử tiền tố cấu hình rồi `SUB`.

### 3.3. Studio — đơn hàng gian hàng ✅ code
- Cột mới **`orders.paymentRef String?`**, unique `(tenantId, paymentRef)` (NULL không đụng nhau) — migration `20261124120000_adr065_order_payment_ref`.
- Sinh khi khách chọn SePay (`buildTenantCheckoutPayload` → `resolveSepayPaymentRef`, thử tối đa 10 lần tránh trùng trong gian hàng); **giữ nguyên** khi áp/gỡ mã giảm
  giá hoặc chọn lại SePay nếu mã còn đúng tiền tố hiện hành.
- QR/nội dung chuyển khoản SePay = `paymentRef`. **Mã đơn, URL, QR thủ công, MoMo giữ `orders.code`.**
- Tiền tố = `paymentPrefix` cấu hình; không hợp lệ → tiền tố mã đơn (`tenantSepayPrefix`).
- Webhook ưu tiên `paymentRef`, sau đó mã đơn (khách tự gõ mã đơn, hậu tố 6 ký tự như cũ); job `payment.process` khớp `paymentRef` **hoặc** `code` trong gian hàng.
- Trang chi tiết đơn Studio hiện dòng **"Mã thanh toán SePay"** khi đơn có `paymentRef`.

### 3.4. Webhook hai phía — bỏ qua giao dịch của tài khoản khác ✅ code
- Giao dịch có `accountNumber` khác tài khoản đã cấu hình (`sepayAccountMatches`, so chỉ chữ số) → trả **200 `{ success: true }`**, **không** ghi `webhook_events`,
  chỉ `logger.warn`. Lý do: một tài khoản SePay có thể nối nhiều tài khoản ngân hàng.
- Payload không có `accountNumber` → coi là khớp (không đủ căn cứ để từ chối) ✅ code.

### 3.5. Form cấu hình hai phía ✅ code
- Tiền tố bắt buộc 2–5 chữ cái (zod ở Server Action + `pattern="[A-Za-z]{2,5}"` ở ô nhập; `validateConfig` của provider SePay cũng bắt `^[A-Z]{2,5}$`).
- Gợi ý ô + khối hướng dẫn + thông báo sau lưu nêu cấu hình SePay: *Cấu trúc mã thanh toán: tiền tố X, hậu tố dài 8 ký tự, "Là số nguyên"*; VietinBank bắt
  buộc `SEVQR`. Chuỗi dùng chung ở `apps/web/lib/sepay-setup.ts` (câu chữ hiện hành: [[02-System-Specs/Payment-And-Billing|Payment-And-Billing]] §5M) ✅ code.
- Bỏ cảnh báo cũ "tiền tố SePay khác tiền tố mã đơn" (Studio) — state action đổi `warning` → `message`.

### 3.6. Vận hành 🟡
- Trên SePay đặt **một** mẫu cấu trúc mã khớp tiền tố đang dùng (System và từng gian hàng tự cấu hình trên tài khoản SePay của mình). Đổi tiền tố trong app ⇒ đổi
  mẫu trên SePay cùng lúc. Các bước: [[04-Operations-Runbooks/SePay-Live-Test-Runbook|SePay-Live-Test-Runbook]].

### 3.7. Không xử lý
- Hoá đơn/đơn đã tạo trước thay đổi (mã cũ SePay không nhận diện được) — admin/người bán xác nhận tay nếu cần (hoá đơn gói: [[01-Architecture-Decisions/ADR-050-Admin-Manual-Confirm-Invoice-Any-Provider|ADR-050 KB]]).
  Hoá đơn gói `PENDING` còn hạn vẫn được dùng lại khi gian hàng bấm gia hạn (dedupe sẵn có) cho tới khi hết hạn 🟡.

### 3.8. Test ✅ đếm
Unit 102 → **105** (tách mã 8 chữ số; bỏ qua tài khoản khác; kiểm tra kết nối SePay), integration 68 → **69** (đơn chọn SePay có `paymentRef` → webhook → job khớp theo
`paymentRef`). `scripts/count-tests.mjs` đã nâng trần 105/69.

---

## 4. Hệ Quả (Consequences)
- **Sửa** quy tắc tiền tố của [[01-Architecture-Decisions/ADR-044-Beta-Payments-Manual-Confirm-Emails-Sepay|ADR-044 KB (≙ ADR-059)]] §3.4 (c): tiền tố không còn là
  "chữ/số 1–10 ký tự" và không còn cảnh báo lệch tiền tố mã đơn.
- Kèm cùng phiên (không thuộc văn bản ADR-065 gốc, ghi ở `docs/PLAN.md`): nút "Tạo key ngẫu nhiên", ô API Token + "Kiểm tra kết nối" SePay — đã commit `14f08ba`
  ✅ `git show --stat`; chi tiết [[02-System-Specs/Payment-And-Billing|Payment-And-Billing]] §5L.
- Thay đổi suy từ code ❓: giao dịch cũ trong tab "Giao dịch cổng" chứa mã hoá đơn dạng cũ (hậu tố lẫn chữ) không còn tách được mã — có thể hiện "Thiếu mã hoá đơn"
  thay vì nhãn trước đây. Ghi ở [[00-Index/KB-Audit-2026-09-26|KB-Audit]] §50.
- Deploy: production (VPS) dùng DB riêng → migration `20261124120000_adr065_order_payment_ref` phải chạy trên DB production trước/khi deploy ❓ chưa chạy — bước 0 của
  [[04-Operations-Runbooks/SePay-Live-Test-Runbook|SePay-Live-Test-Runbook]].

---

## 5. Liên Kết
* [[02-System-Specs/Payment-And-Billing|Payment-And-Billing]] §5L–§5M · [[02-System-Specs/Order-State-Machine|Order-State-Machine]] §3.11 ·
  [[02-System-Specs/Studio-Orders-Specs|Studio-Orders-Specs]] §3
* [[03-API-Contracts/Endpoint-Directory|Endpoint-Directory]] §9, §31 · [[03-API-Contracts/Database-Schema-Reference|Database-Schema-Reference]] §3.2, §7
* [[04-Operations-Runbooks/SePay-Live-Test-Runbook|SePay-Live-Test-Runbook]]
* [[01-Architecture-Decisions/ADR-050-Admin-Manual-Confirm-Invoice-Any-Provider|ADR-050 KB (≙ ADR-066)]] — xác nhận tay hoá đơn gói mọi cổng
* [[00-Index/KB-Audit-2026-09-26|KB-Audit]] §50

*Quay lại: [[MOC-Home]] (../00-Index/MOC-Home.md)*

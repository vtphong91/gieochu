---
tags:
  - adr
  - billing
  - payment
  - system-admin
  - order
  - ui-ux
  - status/accepted
date: 2026-10-25
decider: vtphong91
status: Accepted (Chốt — Áp dụng chính thức)
---

# 🏛️ ADR-041: System Center — lịch sử hoá đơn gói + trang Đơn hàng gói dịch vụ; QR chuyển khoản tải được + thông tin chuyển khoản tay; mã giảm giá tạo lại QR

## 1. Trạng Thái (Status)
**ĐÃ PHÊ DUYỆT (Accepted)** — tương ứng **ADR-056** trong [`docs/DECISIONS.md`](../../docs/DECISIONS.md) (chủ dự án chốt 2026-10-25), gồm
"Bổ sung ADR-056" (nhãn menu "Đơn hàng"; mã giảm giá và QR) và "Bổ sung ADR-056 lần 2" (tạm chưa xử lý MoMo). Bản trích ghi theo duyệt
của Quốc (brief 2026-10-25).

Tiến độ (2026-10-25): code ở working tree, **chưa commit** ✅ `git status`. **Không migration**, **không thêm `route.ts`** (23 dưới `/api`, 25 toàn
app ✅ đếm). `pnpm test:count` = **100/100 unit, 66/66 integration** ✅ (Long chạy, chỉ đếm) — phần kiểm tra mới viết **thêm assert vào test có sẵn**
(`subscription-billing.test.ts`, `order.test.ts`), không thêm case.

Mức xác minh: ✅ Long đã đối chiếu code working tree · 🟡 theo `docs/DECISIONS.md`/brief của Quốc · ❓ cần môi trường thật.

---

## 2. Bối Cảnh (Context) 🟡
Chủ dự án báo System Center "không ghi lại" thuê bao/hoá đơn. Hiếu chẩn đoán: dữ liệu đúng (1 subscription CREATOR ACTIVE, 1 invoice MANUAL_QR PAID);
trang Hoá đơn khi đó chỉ liệt kê hoá đơn MANUAL_QR **PENDING** (`listPendingManualInvoices`) và không có trang liệt kê thuê bao.

---

## 3. Quyết Định (Decision)

### 3.1. Trang Hoá đơn có 2 tab ✅ (`app/admin/billing/invoices/page.tsx`)
- `?tab=cho-doi-soat` (mặc định — giá trị lạ cũng về tab này): giữ hành vi cũ, hoá đơn MANUAL_QR PENDING cũ nhất trước, nút "Xác nhận đã nhận tiền".
- `?tab=tat-ca`: mọi trạng thái/cổng, mới nhất trước (`createdAt desc, id desc`), lọc `status` (`PENDING|PAID|EXPIRED|VOID|REFUNDED`) +
  `provider` (`MANUAL_QR|SEPAY|MOMO`), phân trang `page`/`pageSize` (cỡ trang theo `PAGE_SIZE_OPTIONS`, mặc định 20). Giá trị query không hợp lệ
  → bỏ lọc (`parseEnumParam`), không lỗi. Nút xác nhận **chỉ** hiện ở dòng MANUAL_QR + PENDING.

### 3.2. Trang mới `/admin/subscriptions` — "Đơn hàng gói dịch vụ" ✅
- Menu **Kinh doanh → "Đơn hàng"** (bổ sung (a)); tiêu đề trang "Đơn hàng gói dịch vụ", phụ đề nói rõ không phải đơn hàng tài liệu của gian hàng.
- Cột: gian hàng (tên + `/slug`), gói, trạng thái thuê bao, bắt đầu chu kỳ, hết hạn, hạn ân hạn, hoá đơn gần nhất (mã + trạng thái).
- Lọc `plan` (mã gói — chỉ nhận mã có trong `listPlanFilterOptions`, gồm cả gói đã ngừng bán) + `status` (`TRIALING|ACTIVE|PAST_DUE|GRACE|EXPIRED|CANCELED`);
  cũng nhận `page`/`pageSize`.
- Sắp xếp: gói trả phí trước, theo `currentPeriodEnd` tăng dần; **gói miễn phí xếp sau** và cột "Hết hạn" hiện **"Không thời hạn"**.

### 3.3. Ranh giới dữ liệu ✅
Bốn hàm mới trong `apps/web/lib/subscription-billing.ts` — `listSubscriptionInvoices`, `listSubscriptions`, `listPlanFilterOptions`, `parseEnumParam` —
chỉ đọc bảng L1 `subscription_invoices`, `subscriptions`, `plans` + tên/slug gian hàng qua `getPrismaClient()`; không đọc `orders`/`order_items`/
`tenant_customers` → **không vi phạm §7.9**.

### 3.4. Đổi tên menu ✅
"Thanh toán nền tảng" → **"Cấu hình thanh toán"** (`/admin/billing/payment`, nhóm Tài chính).

### 3.5. Khối chuyển khoản dùng chung ✅ (`app/_ui/bank-transfer-panel.tsx` — `BankTransferPanel`)
Dùng ở Studio `/studio/{slug}/billing` (hoá đơn gói — PaymentScope PLATFORM) và checkout `/{tenantSlug}/checkout/{orderCode}` (đơn tài liệu —
PaymentScope TENANT). Nút **"Tải ảnh QR"** + bảng thông tin chuyển khoản tay (ngân hàng, số TK, chủ TK, số tiền, nội dung CK = mã đơn/mã hoá đơn) có
nút sao chép. Chi tiết: [[02-System-Specs/Payment-And-Billing|Payment-And-Billing]] §5D, [[04-Operations-Runbooks/UI-Design-System|UI-Design-System]] §24.

### 3.6. Mã giảm giá và QR (bổ sung (b)) ✅
Khuyến khích áp mã trước khi chọn cách thanh toán; nếu áp/gỡ mã **sau** khi đơn đã có `checkoutPayload`, server **tạo lại** payload (QR + số tiền)
theo tổng mới — QR không bao giờ lệch `totalVnd`. Chặn áp/gỡ mã khi đơn đã PAID/huỷ/hết hạn (`ORDER_NOT_PENDING`). Mã lỗi mới `ORDER_CHANGED` (409),
`CHECKOUT_CREATE_FAILED` (502). Chi tiết: [[02-System-Specs/Order-State-Machine|Order-State-Machine]] §3.9.

### 3.7. MoMo tạm chưa xử lý (bổ sung lần 2) 🟡
Đổi mã sau khi đã tạo link MoMo: MoMo có thể từ chối `orderId` trùng (chưa thử với MoMo thật ❓). Hành vi giữ nguyên: báo `CHECKOUT_CREATE_FAILED`,
đơn không đổi (an toàn về tiền). Xem lại khi làm MoMo.

### 3.8. Không xoá audit giả 🟡
**Không xoá** 27 dòng audit `SUBSCRIPTION_PAID` giả do integration test để lại — `audit_logs` append-only
([[01-Architecture-Decisions/ADR-023-M12-Audit-Log-Append-Only|ADR-023 KB (≙ ADR-037)]]). Long không đọc DB để đếm.

---

## 4. Lý Do (Rationale) 🟡
- Dữ liệu đã đúng; thiếu là **màn hình xem lại** — thêm tab "Tất cả" và trang thuê bao là đủ, không đổi schema.
- Gọi trang là "Đơn hàng" cho quen với chủ dự án, nhưng tiêu đề nói rõ là gói dịch vụ để không nhầm với đơn của tenant (§7.9 giữ nguyên).
- Người mua trên điện thoại không quét được QR trên chính máy mình → cần tải ảnh QR và chép từng dòng.
- Tạo lại QR khi đổi tổng tiền tránh khách chuyển số tiền cũ (SePay sẽ ghi `MISMATCH_AMOUNT`, chủ gian hàng phải xác nhận tay).

---

## 5. Hệ Quả (Consequences)
- Không migration; code cần commit + deploy ❓.
- Tab "Chờ đối soát" giữ nguyên hành vi cũ; quy trình duyệt hoá đơn tay không đổi.
- QR cũ mà khách đã lưu trước khi đổi mã vẫn quét được ở app ngân hàng — với SePay, tiền về sẽ bị ghi `MISMATCH_AMOUNT` và đơn không tự fulfil;
  chủ gian hàng xác nhận tay (`canManuallyConfirmOrder`) ✅ đọc `lib/payment-process.ts`. Kiểm với SePay thật ❓.
- MoMo đổi mã sau khi có link: lỗi `CHECKOUT_CREATE_FAILED` có chủ đích (§3.7).

---

## 6. Liên Kết
* [[02-System-Specs/Payment-And-Billing|Payment-And-Billing]] §5C–§5E ([Payment-And-Billing.md](../02-System-Specs/Payment-And-Billing.md)) ·
  [[02-System-Specs/Order-State-Machine|Order-State-Machine]] §3.9 ([Order-State-Machine.md](../02-System-Specs/Order-State-Machine.md)) ·
  [[02-System-Specs/User-Management-System-Center-Specs|User-Management-System-Center-Specs]] §2, §5
* [[03-API-Contracts/Endpoint-Directory|Endpoint-Directory]] §27 · [[04-Operations-Runbooks/UI-Design-System|UI-Design-System]] §24
* [[01-Architecture-Decisions/ADR-007-Hybrid-Monetization-Free-Forever|ADR-007 KB (≙ ADR-021)]] — gói Free không hết hạn
* [[00-Index/KB-Audit-2026-09-26|KB-Audit]] §37 — lệch phát hiện khi ghi nhận

*Quay lại: [[MOC-Home]] (../00-Index/MOC-Home.md)*

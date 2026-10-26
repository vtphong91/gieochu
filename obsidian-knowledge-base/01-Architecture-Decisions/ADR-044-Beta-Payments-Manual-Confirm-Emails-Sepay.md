---
tags:
  - adr
  - payment
  - billing
  - order
  - system-admin
  - status/accepted
date: 2026-10-26
decider: vtphong91
status: Accepted (Chốt — Áp dụng chính thức)
---

# 🏛️ ADR-044: Chuẩn bị chạy thử (beta) — thanh toán đủ phương thức, email báo xác nhận tay, xác nhận trễ hoá đơn gói, hoàn thiện SePay; MoMo cá nhân thủ công

## 1. Trạng Thái (Status)
**ĐÃ PHÊ DUYỆT (Accepted)** — tương ứng **ADR-059** trong [`docs/DECISIONS.md`](../../docs/DECISIONS.md) (chủ dự án chốt 2026-10-25), gồm
"Bổ sung ADR-059" (xác nhận tay hoá đơn gói EXPIRED) và "Bổ sung ADR-059 lần 2" (SePay: thiếu/thừa tiền, hoá đơn hết hạn, tiền tố, Studio "Giao dịch cần
xử lý"). Bản trích ghi theo duyệt của Quốc (brief 2026-10-26). Đề xuất gốc: `docs/de-xuat-chay-thu-thanh-toan-goi-tai-lieu-2026-10-25.md`.

Tiến độ (đối chiếu 2026-10-26): **B1, B2, B2b xong code ở working tree, chưa commit** ✅ `git status`; **B3 MoMo cá nhân (`MOMO_MANUAL`, bổ sung lần 3) xong code,
chưa commit, migration `20261026150000_adr059_momo_manual` chưa áp** ✅ `git status` (cập nhật 2026-10-26). B1/B2/B2b không migration ✅, **không thêm
`route.ts`** (23 dưới `/api`, 25 toàn app ✅ đếm). `pnpm test:count` = **100/100 unit, 66/66 integration** ✅ (Long chạy, chỉ đếm) — test mới là assert thêm
trong case có sẵn (`sepay.test.ts`, `order.test.ts`, `subscription-billing.test.ts`). Kết quả lint/typecheck/test xanh 🟡 (Quốc báo, Long không chạy lại).

Mức xác minh: ✅ Long đã đối chiếu code working tree · 🟡 theo `docs/DECISIONS.md`/brief của Quốc · ❓ cần môi trường thật (SMTP, SePay thật, VPS).

---

## 2. Bối Cảnh (Context) 🟡
Beta chạy trên **VPS** (production, ADR-049); Vercel giữ để thử chức năng mới. Mục tiêu: khách trả tiền xong phải nhận được tài liệu, người bán/admin
biết có tiền chờ xác nhận, và không giao dịch nào bị "mất dấu" vì cấu hình lệch.

---

## 3. Quyết Định (Decision)

### 3.1. Phương thức thanh toán (ADR-059 mục 2) 🟡
- Đủ phương thức, ưu tiên **chuyển khoản QR thủ công**. **SePay hoàn thiện ngay** cho cả thu phí gói (platform) lẫn gian hàng (tenant).
- **MoMo chuyển sang dạng cá nhân, xác nhận tay** (khách chuyển qua app MoMo, nội dung = mã đơn; người bán/admin bấm xác nhận). MoMo API (partner
  code/secret) **tạm ẩn**, giữ code. → **Thay bởi bổ sung lần 3** (§3.6): MoMo API giữ nguyên, để tắt; MoMo cá nhân là provider mới `MOMO_MANUAL`.
- **Gói Free:** không hard-code hạn mức beta — System Admin tự chỉnh ở `/admin/plans` (ADR-059 mục 4) 🟡.

### 3.2. Email báo xác nhận tay (B1, ADR-059 mục 3) ✅ code
| `type` | Người nhận | Khi nào | Ghi `email_send_log`? |
| :-- | :-- | :-- | :-- |
| `order_pending_manual` | Chủ gian hàng (`tenant.owner.email`) | Lần **đầu** đơn được gắn cổng (provider đang `null`, khoá `FOR UPDATE`) và cổng là loại xác nhận tay | **Không** (`TENANT_CUSTOMER_FACING_TYPES`) |
| `invoice_pending_manual` | Địa chỉ "Email hỗ trợ" (`system_settings.supportEmail`, đọc động qua `getSupportEmail()`) | Chỉ khi hoá đơn gói QR thủ công **vừa được tạo** (không gửi khi dùng lại hoá đơn chờ) | Có (dữ liệu L1) |
| `payment_mismatch` (B2b) | Chủ gian hàng | Giao dịch tiền vào khớp mã đơn nhưng **sai số tiền** | **Không** (`TENANT_CUSTOMER_FACING_TYPES`) |

Gửi sau response (`after()` truyền vào lib qua `scheduleNotification`) hoặc sau commit trong job; lỗi chỉ log. Chi tiết:
[[02-System-Specs/Payment-And-Billing|Payment-And-Billing]] §5F, §5I; [[02-System-Specs/Order-State-Machine|Order-State-Machine]] §3.10–§3.11.

### 3.3. Xác nhận trễ hoá đơn gói EXPIRED (Bổ sung ADR-059) ✅ code
Admin xác nhận tay hoá đơn MANUAL_QR đã **EXPIRED** (`confirmExpiredManualInvoice`, nút "Xác nhận trễ…"):
1. **Chặn** (`NEWER_INVOICE_EXISTS` 409) nếu gian hàng có hoá đơn **tạo sau** hoá đơn này đang PENDING hoặc PAID — admin hoàn tiền ngoài hệ thống.
2. **Tính lại kỳ** theo lúc xác nhận: `computeRenewalPeriod(now, currentPeriodEnd, plan)`, ghi đè kỳ trên hoá đơn.
3. `paidAt` = lúc xác nhận → vẫn tính là "lần thanh toán gói đầu tiên" cho hoàn tiền 7 ngày (ADR-041 B) nếu đúng là hoá đơn trả đầu tiên.
4. Audit `SUBSCRIPTION_PAID` ghi rõ `lateConfirmation`, `periodRecomputed`, kỳ cũ/mới.

### 3.4. SePay — thiếu/thừa tiền, hoá đơn hết hạn, tiền tố, Studio (Bổ sung ADR-059 lần 2) ✅ code
- (a) Admin xác nhận hoá đơn **từ một giao dịch** SePay: **thiếu tiền → chặn** (`TRANSACTION_UNDERPAID`); **đúng/thừa → cho**, gắn giao dịch vào hoá
  đơn (mỗi giao dịch dùng 1 lần — `TRANSACTION_ALREADY_USED`), audit ghi `differenceVnd`; phần thừa admin hoàn ngoài hệ thống.
- (b) Hoá đơn SePay **hết hạn** có giao dịch đủ tiền → xác nhận trễ theo **cùng luật** §3.3 (chỉ qua đường xác nhận từ giao dịch).
- (c) Tiền tố do admin/người bán tự điền, **không khoá**; hệ thống sinh mã đúng tiền tố đã cấu hình (platform) hoặc thử nhiều tiền tố khi đọc webhook,
  và **cảnh báo khi lưu** nếu lệch.
- (d) Studio có trang **"Giao dịch cần xử lý"** (`/studio/{slug}/orders/giao-dich`) + email `payment_mismatch`.

### 3.5. Việc kéo theo (ADR-059 "Việc kéo theo") ✅ code / ❓ thực tế
- Màn hình admin xem giao dịch SePay chưa khớp — tab **"Giao dịch cổng"** `/admin/billing/invoices?tab=giao-dich` ✅.
- Thử một giao dịch SePay thật nhỏ trước khi mở — checklist ở [[04-Operations-Runbooks/SePay-Live-Test-Runbook|SePay-Live-Test-Runbook]] ❓ chưa chạy.
- Nhập lại cấu hình SePay nền tảng — lần lưu đầu tự tắt (ADR-013), phải **lưu 2 lần** ❓.

### 3.6. MoMo cá nhân `MOMO_MANUAL` (Bổ sung ADR-059 lần 3, B3) — chủ dự án chốt 2026-10-26 🟡 ADR · ✅ code (chưa commit)
1. Dùng cho **cả** thu phí gói (platform) lẫn bán tài liệu (gian hàng).
2. **Phương án B:** provider mới `MOMO_MANUAL` (migration chỉ `ALTER TYPE "PaymentProviderId" ADD VALUE`), xác nhận tay như MANUAL_QR (`isManualConfirmProvider`),
   bật song song được với chuyển khoản ngân hàng.
3. **MoMo API giữ nguyên** cấu hình và code, để tắt — không xoá, không tự sửa dữ liệu (thay quyết định "tạm ẩn" ở mục 2).
4. Trang thanh toán hiện **ảnh QR MoMo + số điện thoại + tên chủ ví**; nội dung chuyển khoản tự sinh từ mã đơn/hoá đơn. QR chỉ có khi người nhận điền số TK VietQR
   của ví (BIN `MOMO_VIETQR_BIN = 970454` — **chờ kiểm chứng**); không có → dự phòng **F1** (thông tin + nút sao chép).
5. Thông tin MoMo của người bán **công khai ở trang thanh toán** → phải ghi rõ trong **Chính sách người bán** — **chưa làm** (việc cần làm ở `docs/PLAN.md`).
6. Chủ dự án tự kiểm thử thật (giải mã QR "Nhận tiền", chuyển thử 1.000đ) — [[04-Operations-Runbooks/MoMo-Manual-Verification-Runbook|MoMo-Manual-Verification-Runbook]] ❓ chưa chạy.

Chi tiết code: [[02-System-Specs/Payment-And-Billing|Payment-And-Billing]] §5J.

---

## 4. Lý Do (Rationale) 🟡
- Xác nhận tay là đường chính của beta → người nhận tiền phải được báo ngay, không phải tự vào kiểm.
- Tiền về trễ là chuyện thường với chuyển khoản; chặn khi đã có hoá đơn mới hơn tránh trả 2 lần / lùi gói; tính lại kỳ để gian hàng không mất ngày.
- Thiếu tiền không được coi là đã trả; thừa tiền thì giao hàng và hoàn phần chênh — có lợi cho khách, an toàn về tiền.
- Không khoá tiền tố để khớp cấu hình SePay sẵn có của người dùng; bù lại hệ thống phải tự khớp được và cảnh báo rõ.

---

## 5. Hệ Quả (Consequences)
- `markInvoicePaid` chỉ còn áp hoá đơn **PENDING** (idempotent; EXPIRED/VOID/REFUNDED không qua đường này) ✅.
- `createRenewalInvoice` và mọi đường áp/xác nhận hoá đơn gói xếp hàng qua khoá dòng `subscriptions` (`FOR UPDATE`) ✅.
- Webhook platform ghi `platform_payment_transactions` **trước** khi áp hoá đơn ✅; body hỏng/thiếu trường → **400 `invalid_body`** (cả 2 webhook) ✅.
- Không migration: trạng thái giao dịch platform suy ra từ cột sẵn có + `rawPayload` ✅ (`lib/platform-transactions.ts`).
- **Chưa làm** (🟡 brief): email cho giao dịch `UNMATCHED`; email/hiển thị cho giao dịch khớp tiền nhưng đến **quá 24 giờ** sau hạn đơn;
  kiểm trường payload MoMo; kiểm chứng QR MoMo cá nhân + migration `MOMO_MANUAL`.
- Hạn đơn chờ thanh toán: nay ADR-061 chốt 72 giờ (thủ công) / 48 giờ (SePay), chưa có code — [[01-Architecture-Decisions/ADR-046-Customer-Purchase-Flow-Pending-Orders-Notifications|ADR-046 KB]].

---

## 6. Liên Kết
* [[02-System-Specs/Payment-And-Billing|Payment-And-Billing]] §3, §5F–§5I ([Payment-And-Billing.md](../02-System-Specs/Payment-And-Billing.md)) ·
  [[02-System-Specs/Order-State-Machine|Order-State-Machine]] §3.10–§3.11 ([Order-State-Machine.md](../02-System-Specs/Order-State-Machine.md))
* [[03-API-Contracts/Endpoint-Directory|Endpoint-Directory]] §9, §28 · [[02-System-Specs/Audit-Log-Specs|Audit-Log-Specs]] §4
* [[04-Operations-Runbooks/SePay-Live-Test-Runbook|SePay-Live-Test-Runbook]] ([SePay-Live-Test-Runbook.md](../04-Operations-Runbooks/SePay-Live-Test-Runbook.md))
* [[01-Architecture-Decisions/ADR-041-System-Center-Subscription-Invoices-Bank-Transfer-Qr|ADR-041 KB (≙ ADR-056)]] — hoá đơn gói, khối chuyển khoản ·
  [[01-Architecture-Decisions/ADR-027-Account-Upgrade-Pricing-Profile-Refund|ADR-027 KB (≙ ADR-041)]] — hoàn tiền gói 7 ngày ·
  [[01-Architecture-Decisions/ADR-036-Vercel-Testing-VPS-Production|ADR-036 KB (≙ ADR-049)]] — VPS production
* [[00-Index/KB-Audit-2026-09-26|KB-Audit]] §41 — lệch phát hiện khi ghi nhận

*Quay lại: [[MOC-Home]] (../00-Index/MOC-Home.md)*

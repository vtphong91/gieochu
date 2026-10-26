---
tags:
  - runbook
  - payment
  - billing
  - deployment
  - status/living
date: 2026-10-26
author: Long
---

# 🧪 Runbook: Chạy thử SePay bằng giao dịch thật nhỏ (ADR-059)

> Mục đích: trước khi mở beta, thử **một giao dịch SePay thật, số tiền nhỏ** cho cả thu phí gói (platform) và bán tài liệu (gian hàng) — ADR-059
> "Việc kéo theo". Quyết định: [[01-Architecture-Decisions/ADR-044-Beta-Payments-Manual-Confirm-Emails-Sepay|ADR-044 KB (≙ ADR-059)]].
>
> Mức xác minh: ✅ hành vi đã đối chiếu code working tree 2026-10-26 (chưa commit) · 🟡 checklist theo brief của Quốc · ❓ **chưa ai chạy runbook này
> trên môi trường thật** — mọi kết quả "kiểm" bên dưới là kết quả **mong đợi**, chưa phải kết quả đã quan sát.

> [!WARNING] Một DB duy nhất (ADR-034)
> VPS production, Vercel và máy dev dùng **cùng** database. Giao dịch thử tạo dữ liệu thật (hoá đơn, đơn, giao dịch, audit). Dòng `audit_logs` không xoá
> được (append-only, ADR-037). Dùng gian hàng nội bộ, không dùng gian hàng của người bán thật.

---

## 1. Chuẩn bị 🟡
- VPS có `APP_URL` là **HTTPS** (URL webhook dựng từ `APP_URL` — `buildWebhookNotifyUrl`) ✅ code.
- Cron `/api/cron/daily` chạy được trên VPS (crontab — ADR-049) ❓.
- **"Email hỗ trợ"** đã điền ở `/admin/settings` (tab "Email hỗ trợ") — trống thì email `invoice_pending_manual` bị bỏ qua, chỉ log
  `invoice.pending_manual: chưa đặt Email hỗ trợ…` ✅ code.
- SMTP hệ thống đã cấu hình (nếu không, `sendEmailNow` trả `EMAIL_NOT_CONFIGURED`) ✅ code.

## 2. Cấu hình SePay nền tảng — `/admin/billing/payment` ✅ code
- **`paymentPrefix`**: mặc định `SUB`, hoặc tiền tố admin tự điền cho khớp "cấu trúc mã thanh toán" bên SePay. Chỉ nhận **chữ/số, 1–10 ký tự** (viết hoa)
  — giá trị khác thì hoá đơn SePay dùng `SUB` và form cảnh báo khi lưu (`normalizeInvoiceCodePrefix`). Mã hoá đơn mới = tiền tố + 8 ký tự.
- **`authType`**:
  - `API_KEY` — SePay gửi header `Authorization: Apikey <key>`;
  - `HMAC_SHA256` — header `X-SePay-Signature: sha256=<hex>` ký `{timestamp}.{rawBody}`, kèm `X-SePay-Timestamp`.
- **Lưu 2 lần:** lần lưu đầu sau khi đổi tài khoản/secret **tự tắt** cổng (ADR-013) — bật lại rồi lưu thêm một lần.
- Đổi tiền tố khi còn hoá đơn chờ mang tiền tố cũ (khác `SUB`): form cảnh báo hoá đơn đó không còn tự khớp — kiểm ở tab "Giao dịch cổng".

## 3. Cấu hình phía SePay 🟡
- Webhook: `https://<domain>/api/webhooks/platform/sepay`, sự kiện **tiền vào**, cùng key/kiểu xác thực như bước 2.
- Nhận diện mã thanh toán theo tiền tố. Nếu tiền tố hai bên **không trùng**, **không** bật tuỳ chọn "bỏ qua giao dịch không có mã thanh toán" (SePay có thể
  không gửi giao dịch về).

## 4. Giao dịch đúng tiền (platform)
- Dùng **gói thử giá nhỏ** (khoảng 2.000đ, chỉnh ở `/admin/plans`) và **gian hàng nội bộ**; tạo hoá đơn SePay ở `/studio/{slug}/billing`, chuyển **đúng mã**.
- Kiểm (mong đợi ✅ code, thực tế ❓):
  - hoá đơn **PAID**, gói được nâng;
  - tab `/admin/billing/invoices?tab=giao-dich` hiện **"Đã áp"**;
  - `/admin/audit` có `SUBSCRIPTION_PAID` với `source: PLATFORM_WEBHOOK`.

## 5. Giao dịch sai tiền (platform)
- Mong đợi ✅ code: tab Giao dịch hiện **"Sai số tiền"**, hoá đơn vẫn **PENDING**.
- Nút "Xác nhận hoá đơn từ giao dịch": **thừa** tiền → xác nhận được (audit `source: ADMIN_TRANSACTION_CONFIRM`, `differenceVnd` > 0); **thiếu** tiền →
  bị chặn `TRANSACTION_UNDERPAID`. Phần thừa admin hoàn ngoài hệ thống.

## 6. Gửi lại webhook
- Gửi lại cùng sự kiện từ SePay → **không** sinh giao dịch thứ hai: `webhook_events` (`scope, provider, providerEventId` unique) chặn, route trả `200
  { success: true }` ✅ code.

## 7. Chữ ký sai
- Sai key/chữ ký → **401** `{ error: "invalid_signature" }` ✅ code. (Cổng chưa cấu hình/tắt → 404 `not_configured`; body hỏng/thiếu trường sau khi chữ ký
  đúng → 400 `invalid_body`.)

## 8. Xem kết quả
- Log pm2 trên VPS (`platform payment webhook processed` / `… rejected: invalid body`), tab "Giao dịch cổng", `/admin/audit`.

## 9. Gian hàng (tenant)
- Studio → Cài đặt → Thanh toán (`/studio/{slug}/settings/payments`): cấu hình SePay của gian hàng. Form **cảnh báo** khi `paymentPrefix` khác tiền tố mã đơn (`orderCodePrefix`) — webhook vẫn thử
  cả hai tiền tố, mã đơn = tiền tố mã đơn + 6 ký tự ✅ code.
- Webhook SePay: `https://<domain>/api/webhooks/tenants/<tenantId>/sepay`.
- Mua thử một tài liệu giá nhỏ, chuyển đúng mã → mong đợi đơn **FULFILLED**. Sai tiền → giao dịch `MISMATCH_AMOUNT`, đơn không tự giao, chủ gian hàng nhận
  email `payment_mismatch` và thấy dòng ở `/studio/{slug}/orders/giao-dich` ✅ code / ❓ thực tế.

## 10. Dọn dẹp 🟡
- Hoàn tiền giao dịch thử (ngoài hệ thống), trả giá gói về như cũ ở `/admin/plans`.
- Không xoá được dòng audit (append-only).

---

## Liên kết
* [[02-System-Specs/Payment-And-Billing|Payment-And-Billing]] §3, §5F–§5I · [[02-System-Specs/Order-State-Machine|Order-State-Machine]] §3.11
* [[03-API-Contracts/Endpoint-Directory|Endpoint-Directory]] §9, §28
* [[04-Operations-Runbooks/Storage-Gateway-VPS-Runbook|Storage-Gateway-VPS-Runbook]] — pm2 trên VPS

*Quay lại: [[MOC-Home]] (../00-Index/MOC-Home.md)*

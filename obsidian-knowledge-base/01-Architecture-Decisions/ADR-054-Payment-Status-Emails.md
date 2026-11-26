---
tags:
  - adr
  - payment
  - billing
  - order
  - status/accepted
date: 2026-11-25
decider: vtphong91
status: Accepted — đã code, verify đạt (Quốc báo), đã commit dbf9984; không migration
---

# 🏛️ ADR-054: Email thông báo thanh toán — thành công / hết hạn / sai số tiền / thất bại / bị huỷ

## 1. Trạng Thái (Status)
**ĐÃ PHÊ DUYỆT (Accepted)** — tương ứng **ADR-070** trong [`docs/DECISIONS.md`](../../docs/DECISIONS.md) (chủ dự án chốt 2026-11-25). Bản trích ghi theo duyệt của Quốc
(brief 2026-11-25). Đây là **đợt 1** trong kế hoạch 4 đợt ở `docs/PLAN.md` (§4 dưới).

Tiến độ (đối chiếu 2026-11-25): **đã commit `dbf9984`** ✅ `git show --stat` (cập nhật 2026-11-26). **Không migration**, **không thêm `route.ts`** (24 / 26 ✅ đếm). Không thêm test case —
`pnpm test:count` = **105/105 unit, 69/69 integration** ✅ (Long chạy). tsc 17/17, lint (chỉ cảnh báo cũ), unit, integration `order` + `subscription-billing` 17/17 🟡 (Quốc báo).

Mức xác minh: ✅ Long đã đối chiếu code working tree · 🟡 theo `docs/DECISIONS.md`/brief · ❓ **chưa gửi thật** tới hộp thư nào, chưa chạy trên production.

---

## 2. Bối Cảnh (Context) 🟡
Chủ dự án trả hoá đơn gói `SEVQR31004800` (SePay tự xác nhận) nhưng không nhận email. Trước đó hoá đơn gói chỉ có email nhắc hạn (7 ngày/1 ngày), ân hạn, hạ Free; đơn tài liệu
có email thành công cho khách + "có đơn mới"/sai tiền cho người bán.

**Chủ dự án chốt:** đợt 1 gửi email thành công (hoá đơn gói), hết hạn chưa trả, sai số tiền, thất bại ở mọi phương thức, bị huỷ; email hết hạn đơn tài liệu **chỉ** cho đơn
khách đã chọn cách thanh toán.

**"Thất bại" theo phương thức:** chuyển khoản (SePay, QR thủ công, MoMo cá nhân) không có sự kiện thất bại từ ngân hàng → thất bại = hết hạn chưa nhận tiền hoặc sai số tiền;
MoMo API có kết quả thất bại/huỷ (`resultCode ≠ 0`).

---

## 3. Quyết Định (Decision)

### 3.1. Danh mục email (người nhận = email tài khoản)

| # | Sự kiện | Người nhận | `type` (✅ code) |
| :-: | :-- | :-- | :-- |
| A1 | Hoá đơn gói thanh toán thành công (webhook / admin xác nhận / từ giao dịch / xác nhận trễ) | Chủ gian hàng | `subscription_invoice_paid` |
| A2 | Hoá đơn gói hết hạn chưa trả (sweep → EXPIRED) | Chủ gian hàng | `subscription_invoice_expired` |
| A3 | Hoá đơn gói nhận giao dịch đúng mã, sai số tiền | Chủ gian hàng | `subscription_invoice_amount_mismatch` |
| A4 | Hoá đơn gói MoMo thất bại/huỷ | Chủ gian hàng | `subscription_invoice_payment_failed` |
| A5 | Admin huỷ hoá đơn gói (ADR-067) | Chủ gian hàng | `subscription_invoice_voided` |
| B1 | Đơn tài liệu thành công (đã có — giữ) | Khách | `order_paid` |
| B2 | Đơn tài liệu hết hạn chưa trả — chỉ đơn đã chọn cách thanh toán | Khách | `order_expired_customer` |
| B3 | Đơn tài liệu sai số tiền (người bán đã có email riêng) | Khách | `order_amount_mismatch_customer` |
| B4 | Đơn tài liệu MoMo thất bại/huỷ | Khách | `order_payment_failed_customer` |
| B5 | Người bán huỷ đơn tài liệu (ADR-068) | Khách | `order_canceled_customer` |

### 3.2. Quy tắc gửi ✅ code
- Gửi **sau khi commit**; lỗi gửi chỉ log, không làm hỏng thanh toán (`lib/payment-status-notify.ts` — hàm không bao giờ ném).
- **Mỗi email một lần** mỗi sự kiện: gắn với chuyển trạng thái có điều kiện (A1, A2, A5, B2, B5) hoặc idempotency `webhook_events` / giao dịch (A3, A4, B3, B4).
- Nút hành động: thanh toán lại / gia hạn (tạo hoá đơn mới) / mua lại tài liệu; liên hệ: **Email hỗ trợ** (System Settings, `mailto:`) cho hoá đơn gói, **trang gian hàng** cho đơn
  tài liệu. Thương hiệu qua `getEffectiveBrand()`.
- B2–B5 **không** ghi `email_send_log` (`TENANT_CUSTOMER_FACING_TYPES`, §7.9); A1–A5 có ghi.
- Không migration. **Mở lại** (ADR-067/068) không gửi email.
- Chi tiết chỗ gửi, nội dung (THIẾU/THỪA, câu an toàn, định dạng "150.000 đ", ngày dd/mm/yyyy) và test: [[02-System-Specs/Payment-And-Billing|Payment-And-Billing]] §5Q.

---

## 4. Kế hoạch 4 đợt (chủ dự án chốt 2026-11-25 — `docs/PLAN.md`) 🟡
1. **Đợt 1 — Email thông báo thanh toán** (ADR này) — đã commit `dbf9984`.
   - Đợt 2 đã code, chưa commit (2026-11-26) — [[01-Architecture-Decisions/ADR-055-Subscription-Activity-Log-Detail-Gian-Hang-Label|ADR-055 KB (≙ ADR-071)]].
2. **Đợt 2 — Nhật ký thao tác chi tiết** (nguồn/cổng thanh toán, số tiền, mã giao dịch, mốc tạo hoá đơn) + **đổi chữ "Tenant" → "Gian hàng"** trong System Center (chỉ chữ hiển
   thị; code/DB giữ `tenant`).
3. **Đợt 3 — Trang chi tiết gian hàng** `/admin/tenants/[id]` (không đơn/khách của gian hàng — §7.9).
4. **Đợt 4 — Trang chi tiết người dùng** `/admin/users/[id]` (không đơn mua/thư viện — §7.9).

---

## 5. Hệ Quả (Consequences)
- Cron hằng ngày nay gửi email (A2, B2) — [[02-System-Specs/Background-Jobs-Specs|Background-Jobs-Specs]] §5.
- `runOrderSweep` đổi sang cập nhật có điều kiện từng đơn; `runSubscriptionSweep` đổi sang `UPDATE … RETURNING` ✅ code.
- Test integration chặn mọi email `subscription_*` và 4 loại B2–B5 (trước đây email GRACE/DOWNGRADED của sweep trong test gửi thật 🟡).
- Rủi ro còn mở: [[00-Index/KB-Audit-2026-09-26|KB-Audit]] §53.

---

## 6. Liên Kết
* [[02-System-Specs/Payment-And-Billing|Payment-And-Billing]] §5Q · [[02-System-Specs/Order-State-Machine|Order-State-Machine]] §3.15 ·
  [[02-System-Specs/Background-Jobs-Specs|Background-Jobs-Specs]] §5
* [[03-API-Contracts/Endpoint-Directory|Endpoint-Directory]] §34
* [[00-Index/KB-Audit-2026-09-26|KB-Audit]] §53

*Quay lại: [[MOC-Home]] (../00-Index/MOC-Home.md)*

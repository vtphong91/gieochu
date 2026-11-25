---
tags:
  - adr
  - billing
  - payment
  - system-admin
  - status/accepted
date: 2026-11-24
decider: vtphong91
status: Accepted — đã code, verify đạt (Quốc báo), chưa commit; không migration
---

# 🏛️ ADR-050: Admin xác nhận tay hoá đơn gói của mọi cổng; cột "Thao tác" ở Đơn hàng gói dịch vụ

## 1. Trạng Thái (Status)
**ĐÃ PHÊ DUYỆT (Accepted)** — tương ứng **ADR-066** trong [`docs/DECISIONS.md`](../../docs/DECISIONS.md) (chủ dự án chốt 2026-11-24). Bản trích ghi theo duyệt
của Quốc (brief 2026-11-24).

Tiến độ (đối chiếu 2026-11-24): code ở working tree, **chưa commit** ✅ `git status`. **Không migration**, **không thêm `route.ts`** ✅. Không thêm test case
(trần 105/69 — `pnpm test:count` = 105/105, 69/69 ✅ Long chạy). Integration `subscription-billing` 7/7 xanh 🟡 (Quốc báo).

Mức xác minh: ✅ Long đã đối chiếu code working tree · 🟡 theo `docs/DECISIONS.md`/brief · ❓ chưa xem giao diện bằng trình duyệt với phiên SYSTEM_ADMIN.

> [!NOTE] Bị sửa bởi ADR-051 (KB) — tương ứng ADR-067 docs (2026-11-25, Quốc duyệt ghi chú)
> [[01-Architecture-Decisions/ADR-051-Subscription-Invoice-Status-Change-Void-Reopen|ADR-051 KB (≙ ADR-067)]] thay `ManualConfirmButton` bằng nút **"Đổi trạng thái…"**
> (`InvoiceStatusButton`: Đã thanh toán / Chưa thanh toán (mở lại) / Huỷ hoá đơn) ở cột "Thao tác" của `/admin/subscriptions` và tab "Tất cả" của `/admin/billing/invoices`;
> tab "Chờ đối soát" vẫn dùng `ManualConfirmButton`. Luật `confirmManualInvoicePayment` (§3.1) không đổi. Nội dung bên dưới giữ nguyên như lúc ghi ADR-066.

---

## 2. Bối Cảnh (Context) 🟡
Hoá đơn SePay `SEVQRWQRMN878` đã nhận tiền nhưng không có webhook ([[01-Architecture-Decisions/ADR-049-Sepay-Numeric-Payment-Code-Shared|ADR-049 KB (≙ ADR-065)]])
→ không có giao dịch trong "Giao dịch cổng" để xác nhận; ADR-059 chỉ cho xác nhận tay hoá đơn QR thủ công / MoMo cá nhân → không còn đường nào ghi nhận. Chủ dự án
yêu cầu cột "Thao tác" ở `/admin/subscriptions` để xác nhận khi tiền đã về mà hệ thống chưa ghi.

**Chủ dự án chốt:** áp dụng **mọi cổng**; ghi chú **không bắt buộc**.

---

## 3. Quyết Định (Decision)

### 3.1. `confirmManualInvoicePayment(invoiceId, actorId, note?)` — mọi cổng ✅ code
- Bỏ giới hạn `isManualConfirmProvider` (lỗi `NOT_MANUAL_INVOICE` không còn được ném ở hàm này) — **thay** quy tắc ADR-059 "SePay/MoMo chỉ PAID qua webhook hoặc qua
  giao dịch".

| Trạng thái hoá đơn | Kết quả |
| :-- | :-- |
| PENDING | `markInvoicePaid(source: ADMIN_MANUAL_CONFIRM)` — kỳ đã lưu |
| EXPIRED | nhánh xác nhận trễ sẵn có `confirmExpiredManualInvoice` (chặn `NEWER_INVOICE_EXISTS` khi gian hàng có hoá đơn mới hơn đang PENDING/PAID, tính lại kỳ) — nay cho mọi cổng |
| PAID | no-op |
| khác (VOID, REFUNDED) | 409 `INVOICE_NOT_CONFIRMABLE` |

### 3.2. Ghi chú ✅ code
- Ô "Ghi chú (không bắt buộc)" (`maxLength` 500). Server trim, **cắt** còn 500 ký tự (`MANUAL_CONFIRM_NOTE_MAX`), trống → bỏ.
- Chỉ lưu trong metadata audit `SUBSCRIPTION_PAID` (`source: ADMIN_MANUAL_CONFIRM`, `note`) — **không migration**, không cột mới trên hoá đơn.

### 3.3. Giao diện ✅ code / ❓ trình duyệt
- Một component **`ManualConfirmButton`** (`app/admin/billing/invoices/confirm-button.tsx`) thay `ConfirmButton` + `ExpiredConfirmButton`: hai bước — nút "Xác nhận
  đã nhận tiền…" (hoá đơn hết hạn: "Xác nhận trễ…") → khung xác nhận nêu mã, số tiền, cổng; cổng tự xác nhận (SePay/MoMo) nhắc "chỉ xác nhận tay khi đã đối chiếu sao
  kê mà hệ thống chưa ghi nhận"; hoá đơn hết hạn nêu kỳ gói tính lại từ lúc xác nhận; "Không hoàn tác được". Khung xác nhận là `<dialog>` mở bằng `showModal()`;
  thành công → đóng hộp, phản hồi là badge "Đã thanh toán" của dòng sau revalidate (vùng `role="status"` "Đã xác nhận thanh toán." vẫn còn trong component) ✅ code.
  Quy tắc trình bày (focus, nhãn nút theo viewport, Label in Name): [[04-Operations-Runbooks/UI-Design-System|UI-Design-System]] §27.
- Dùng ở `/admin/billing/invoices` — tab **"Chờ đối soát"** (vẫn chỉ hoá đơn QR thủ công / MoMo cá nhân) và tab **"Tất cả"** (mọi cổng, dòng PENDING hoặc EXPIRED).
- Cột mới **"Thao tác"** ở `/admin/subscriptions`: nút cho hoá đơn **gần nhất** khi đang PENDING/EXPIRED; không có → gạch ngang ("Không có thao tác" cho trình đọc màn hình).
  Cột "Bắt đầu chu kỳ", "Hạn ân hạn" chỉ hiện từ `xl` ✅ code (UI-Design-System §27.5).
- Cột **"Hoá đơn gần nhất"**: mã hoá đơn ở trên, nhãn trạng thái thanh toán ở dưới, kèm "số tiền · cổng". `listSubscriptions` trả thêm `latestInvoice.id/amountVnd/provider`.
- Server Action `confirmManualInvoiceAction(invoiceId, prevState, formData)` (đổi chữ ký — đọc `note` từ form), `requireRole("SYSTEM_ADMIN")`, revalidate cả
  `/admin/billing/invoices` và `/admin/subscriptions`.

### 3.4. Không đổi 🟡 / ✅
- Tab "Chờ đối soát" vẫn chỉ liệt kê hoá đơn QR thủ công / MoMo cá nhân ✅; "Xác nhận hoá đơn từ giao dịch" giữ nguyên ✅.
- Không có route nào đọc đơn hàng/khách hàng của tenant (§7.9) — hai trang chỉ đọc bảng L1 ✅.

### 3.5. Test ✅ đếm
Không thêm test case (trần 105/69) — mở rộng test integration hoá đơn SePay sẵn có: xác nhận tay hoá đơn SePay kèm ghi chú → PAID + audit có `note`; định dạng mã hoá
đơn ADR-065.

---

## 4. Hệ Quả (Consequences)
- **Sửa** [[01-Architecture-Decisions/ADR-044-Beta-Payments-Manual-Confirm-Emails-Sepay|ADR-044 KB (≙ ADR-059)]]: xác nhận tay / xác nhận trễ hoá đơn gói không còn
  giới hạn ở cổng xác nhận tay. Spec: [[02-System-Specs/Payment-And-Billing|Payment-And-Billing]] §5F (bảng đã đánh dấu thay đổi), §5N.
- Rủi ro vận hành 🟡: admin có thể xác nhận hoá đơn SePay trong khi webhook đến sau — `markInvoicePaid` chỉ áp hoá đơn PENDING (cập nhật có điều kiện), nên webhook
  đến sau là no-op cho hoá đơn ✅ code (§5G); giao dịch vẫn được ghi ở "Giao dịch cổng".

---

## 5. Liên Kết
* [[02-System-Specs/Payment-And-Billing|Payment-And-Billing]] §5C, §5F, §5N · [[02-System-Specs/Audit-Log-Specs|Audit-Log-Specs]] §4
* [[03-API-Contracts/Endpoint-Directory|Endpoint-Directory]] §31
* [[04-Operations-Runbooks/SePay-Live-Test-Runbook|SePay-Live-Test-Runbook]] §12 (xử lý sự cố)
* [[00-Index/KB-Audit-2026-09-26|KB-Audit]] §50

*Quay lại: [[MOC-Home]] (../00-Index/MOC-Home.md)*

---
tags:
  - adr
  - billing
  - payment
  - system-admin
  - status/accepted
date: 2026-11-25
decider: vtphong91
status: Accepted — đã code, verify đạt (Quốc báo), đã commit 2ccc2fc; không migration
---

# 🏛️ ADR-051: "Đổi trạng thái" hoá đơn gói — Đã thanh toán / Huỷ / Chưa thanh toán (mở lại)

## 1. Trạng Thái (Status)
**ĐÃ PHÊ DUYỆT (Accepted)** — tương ứng **ADR-067** trong [`docs/DECISIONS.md`](../../docs/DECISIONS.md) (chủ dự án chốt 2026-11-24), gồm mục **"Bổ sung"** (chủ dự án
chốt 2026-11-25: không mở lại hoá đơn của gói ngừng bán; ghi chú admin trong audit tiếp tục hiện ở Studio). Bản trích ghi theo duyệt của Quốc (brief 2026-11-25).

Tiến độ (đối chiếu 2026-11-25): **đã commit `2ccc2fc`** ✅ `git show --stat` (lúc ghi lần đầu còn ở working tree). **Không migration**, **không thêm `route.ts`** (24 dưới `/api`, 26 toàn app ✅ đếm).
Không thêm test case — `pnpm test:count` = **105/105 unit, 69/69 integration** ✅ (Long chạy). Integration `subscription-billing` 7/7, tsc, lint, unit xanh 🟡 (Quốc báo).

Mức xác minh: ✅ Long đã đối chiếu code working tree · 🟡 theo `docs/DECISIONS.md`/brief · ❓ chưa thử bằng trình duyệt với phiên SYSTEM_ADMIN, chưa chạy trên production.

> [!NOTE] Cập nhật 2026-11-25 — đã commit; bị sửa bởi ADR-053 (KB) — tương ứng ADR-069 docs (Quốc duyệt)
> Code ADR-067 nay nằm trong commit `2ccc2fc` ✅ `git show --stat`. [[01-Architecture-Decisions/ADR-053-Admin-Subscription-Detail-Row-Menu|ADR-053 KB (≙ ADR-069)]] đổi
> §3.6: ở `/admin/subscriptions` + tab "Tất cả", nút `InvoiceStatusButton` thay bằng menu "⋯" ("Xem chi tiết" + "Đổi trạng thái hoá đơn…"; hộp tách thành
> `InvoiceStatusDialog`); `InvoiceStatusButton` chỉ còn ở trang chi tiết `/admin/subscriptions/[subscriptionId]`. Nội dung bên dưới giữ nguyên.

---

## 2. Bối Cảnh (Context) 🟡
Chủ dự án yêu cầu (2026-11-24) cột "Thao tác" ở `/admin/subscriptions` chuyển được trạng thái hoá đơn gói "Chưa thanh toán", "Đã thanh toán", "Huỷ" —
[[01-Architecture-Decisions/ADR-050-Admin-Manual-Confirm-Invoice-Any-Provider|ADR-050 KB (≙ ADR-066)]] mới có "Xác nhận đã nhận tiền".

**Chủ dự án chốt:** Huỷ chỉ cho hoá đơn chưa trả; "Chưa thanh toán" = **mở lại** hoá đơn đã huỷ/hết hạn (không hoàn tác hoá đơn đã trả); UI một nút "Đổi trạng thái…" mở hộp chọn.

---

## 3. Quyết Định (Decision)

### 3.1. Bảng chuyển trạng thái (chỉ System Admin, mọi cổng) ✅ code
`invoiceStatusTargets(status)` (`apps/web/lib/subscription-billing.ts`, bảng `INVOICE_STATUS_TRANSITIONS`, thứ tự hiển thị PAID → PENDING → VOID):

| Từ (trạng thái DB) | Được chuyển tới |
| :-- | :-- |
| `PENDING` (Chờ thanh toán) | `PAID` (ADR-066), `VOID` |
| `EXPIRED` (Hết hạn) | `PAID` (xác nhận trễ ADR-059/066), `PENDING` (mở lại), `VOID` |
| `VOID` (Đã huỷ) | `PENDING` (mở lại) |
| `PAID`, `REFUNDED` | — (hoá đơn đã trả đi luồng hoàn tiền ADR-041) |

Danh sách này chỉ để UI biết hiện lựa chọn nào; server luôn kiểm lại dưới khoá dòng `subscriptions` của gian hàng khi thực hiện ✅ code.

### 3.2. Huỷ (→ `VOID`) — `voidSubscriptionInvoice(invoiceId, actorId, note?)` ✅ code
- Transaction khoá dòng `subscriptions` (`lockSubscriptionRow`) → đọc lại hoá đơn → chỉ `PENDING`/`EXPIRED`; cập nhật có điều kiện `status IN (PENDING, EXPIRED)`.
  Trạng thái khác hoặc lần chạy song song đã đổi trước → 409 **`INVOICE_NOT_VOIDABLE`**. Hoá đơn không tồn tại → 404 `INVOICE_NOT_FOUND`.
- **Không đổi thuê bao/gói.** Gian hàng tạo được hoá đơn mới ngay — `createRenewalInvoice` chỉ dùng lại hoá đơn `PENDING` còn hạn, không xét `VOID` ✅ code.
- Webhook/xác nhận đến sau cho hoá đơn `VOID`: `markInvoicePaid` chỉ áp hoá đơn `PENDING` → no-op ✅ code.

### 3.3. Mở lại (→ `PENDING`) — `reopenSubscriptionInvoice(invoiceId, actorId, note?)` ✅ code
Đọc `invoicePendingTtlHours` **trước** transaction; trong transaction có khoá, kiểm theo thứ tự:

| # | Điều kiện | Lỗi (409 trừ khi ghi khác) |
| :-: | :-- | :-- |
| 1 | Hoá đơn đang `EXPIRED` hoặc `VOID` | `INVOICE_NOT_REOPENABLE` |
| 2 | Gói của hoá đơn còn bán (`plan.isActive`) — **Bổ sung 2026-11-25** | `PLAN_INACTIVE` |
| 3 | Là hoá đơn **mới nhất** của gian hàng (`createdAt desc, id desc`) | `INVOICE_NOT_LATEST` |
| 4 | Gian hàng **không có hoá đơn `PENDING` khác** (kể cả `PENDING` đã quá hạn chưa sweep) | `PENDING_INVOICE_EXISTS` |

Rồi: `dueAt` = bây giờ + `invoicePendingTtlHours`; **tính lại kỳ** `computeRenewalPeriod(now, subscription.currentPeriodEnd, plan)` và ghi đè `periodStart/periodEnd` (để
`markInvoicePaid` — dùng kỳ đã lưu — áp đúng kỳ ở lần thanh toán sau); cập nhật có điều kiện theo trạng thái đã đọc dưới khoá (0 dòng → `INVOICE_NOT_REOPENABLE`).
**Giữ** mã, số tiền (`amountVnd`), cổng, `checkoutPayload` ✅ code. Mã cũ dạng chữ + số không được SePay nhận diện → admin xác nhận tay 🟡 ADR.

### 3.4. Đã thanh toán (→ `PAID`) ✅ code
Giữ nguyên `confirmManualInvoicePayment` ([[01-Architecture-Decisions/ADR-050-Admin-Manual-Confirm-Invoice-Any-Provider|ADR-050 KB]]): `PENDING` → kỳ đã lưu; `EXPIRED` →
xác nhận trễ (chặn `NEWER_INVOICE_EXISTS`, tính lại kỳ).

### 3.5. Ghi chú + audit ✅ code
- Ghi chú không bắt buộc, trim, **cắt** còn 500 ký tự (`MANUAL_CONFIRM_NOTE_MAX`), trống → bỏ; chỉ lưu trong metadata audit (khoá `note`). Không cột mới.
- 2 action mới: **`SUBSCRIPTION_INVOICE_VOIDED`** ("Huỷ hoá đơn gói dịch vụ"), **`SUBSCRIPTION_INVOICE_REOPENED`** ("Mở lại hoá đơn gói dịch vụ"); `PAID` vẫn ghi
  `SUBSCRIPTION_PAID`. Scope `SYSTEM` + `tenantId` → chủ gian hàng thấy ở Studio → Hoạt động, kể cả ghi chú (**Bổ sung**: chủ dự án xác nhận giữ) ✅ code
  (`audit-log.tsx` hiện metadata dạng key–value). Chi tiết metadata: [[02-System-Specs/Audit-Log-Specs|Audit-Log-Specs]] §4.

### 3.6. Giao diện ✅ code / ❓ trình duyệt
- Server Action **`changeInvoiceStatusAction(invoiceId, prevState, formData)`** (`app/admin/billing/invoices/actions.ts`) — `requireRole("SYSTEM_ADMIN")`, `target` qua
  zod `PAID|PENDING|VOID`, rẽ sang 3 hàm lib, lỗi `AppError` → `{ error }`, revalidate `/admin/billing/invoices` + `/admin/subscriptions`.
- Component **`InvoiceStatusButton`** (`confirm-button.tsx`) — một nút "Đổi trạng thái…" mở `<dialog>`; **thay `ManualConfirmButton`** ở cột "Thao tác" của
  `/admin/subscriptions` và tab "Tất cả" của `/admin/billing/invoices`. Tab "Chờ đối soát" **vẫn dùng `ManualConfirmButton`** ✅ code. Không còn trạng thái nào → "—"
  (`sr-only` "Không có thao tác"). Trình bày: [[04-Operations-Runbooks/UI-Design-System|UI-Design-System]] §27.7.
- Ranh giới: chỉ bảng L1 (`subscription_invoices`, `subscriptions`, `plans`, tên/slug gian hàng) — không đọc đơn/khách tenant (§7.9) ✅ code.

---

## 4. Hệ Quả (Consequences)
- **Sửa** [[01-Architecture-Decisions/ADR-050-Admin-Manual-Confirm-Invoice-Any-Provider|ADR-050 KB (≙ ADR-066)]] §3.3: ở `/admin/subscriptions` và tab "Tất cả", nút
  "Xác nhận đã nhận tiền…" nay nằm trong hộp "Đổi trạng thái…" (lựa chọn "Đã thanh toán").
- Hoá đơn `VOID` giờ là trạng thái admin tạo ra được; luật xác nhận trễ (`assertNoNewerInvoiceLocked`) chỉ chặn hoá đơn mới hơn đang `PENDING`/`PAID` → huỷ hoá đơn mới hơn
  thì xác nhận trễ được hoá đơn cũ ✅ code (suy từ điều kiện, chưa thử).
- Mở lại **không** gửi lại email `invoice_pending_manual` cho "Email hỗ trợ" (chỉ `createRenewalInvoice` gửi) ✅ code.
- Rủi ro còn mở: [[00-Index/KB-Audit-2026-09-26|KB-Audit]] §51.

---

## 5. Liên Kết
* [[02-System-Specs/Payment-And-Billing|Payment-And-Billing]] §5O · [[02-System-Specs/Audit-Log-Specs|Audit-Log-Specs]] §4
* [[03-API-Contracts/Endpoint-Directory|Endpoint-Directory]] §32
* [[04-Operations-Runbooks/UI-Design-System|UI-Design-System]] §27.7
* [[01-Architecture-Decisions/ADR-052-Studio-Order-Status-Change-Reopen-Late-Confirm|ADR-052 KB (≙ ADR-068)]] — bản tương ứng cho đơn hàng Studio
* [[00-Index/KB-Audit-2026-09-26|KB-Audit]] §51

*Quay lại: [[MOC-Home]] (../00-Index/MOC-Home.md)*

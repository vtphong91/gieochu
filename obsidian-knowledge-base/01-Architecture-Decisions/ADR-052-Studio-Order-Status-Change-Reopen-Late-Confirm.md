---
tags:
  - adr
  - order
  - payment
  - tenant
  - status/accepted
date: 2026-11-25
decider: vtphong91
status: Accepted — đã code, verify đạt (Quốc báo), chưa commit; không migration
---

# 🏛️ ADR-052: Studio — "Đổi trạng thái…" đơn hàng: Đã thanh toán / Chưa thanh toán (mở lại) / Huỷ

## 1. Trạng Thái (Status)
**ĐÃ PHÊ DUYỆT (Accepted)** — tương ứng **ADR-068** trong [`docs/DECISIONS.md`](../../docs/DECISIONS.md) (chủ dự án chốt 2026-11-25), gồm mục **"Bổ sung"** (mục 6 chặn
mở lại khi khách đã có quyền tải qua đơn khác; mục 7 sửa lỗi `markOrderPaid` áp hai lần). Bản trích ghi theo duyệt của Quốc (brief 2026-11-25).

Tiến độ (đối chiếu 2026-11-25): code ở working tree, **chưa commit** ✅ `git status`. **Không migration**, **không thêm `route.ts`** (24 dưới `/api`, 26 toàn app ✅ đếm).
Không thêm test case — `pnpm test:count` = **105/105 unit, 69/69 integration** ✅ (Long chạy). Integration `order` 10/10, tsc, lint, unit xanh 🟡 (Quốc báo).

Mức xác minh: ✅ Long đã đối chiếu code working tree · 🟡 theo `docs/DECISIONS.md`/brief · ❓ chưa thử bằng trình duyệt với phiên OWNER, chưa chạy trên production.

> [!NOTE] Thay quy tắc cũ
> - [[01-Architecture-Decisions/ADR-046-Customer-Purchase-Flow-Pending-Orders-Notifications|ADR-046 KB (≙ ADR-061)]] "không xác nhận trễ": **người bán** nay xác nhận
>   được đơn đã hết hạn. Webhook/job tự khớp **không đổi**.
> - §"M8" đặc tả gốc "bắt buộc ghi chú khi xác nhận tay": nay **không bắt buộc**.
> - [[01-Architecture-Decisions/ADR-031-Studio-Orders-List-Detail-Upgrade|ADR-031 KB (≙ ADR-046)]] menu "Thao tác": mục "Xác nhận thanh toán" + "Huỷ đơn" gộp thành
>   "Đổi trạng thái…"; "Đánh dấu đã hoàn tiền…" giữ riêng.

---

## 2. Bối Cảnh (Context) 🟡
Chủ dự án yêu cầu (2026-11-25) Studio có chức năng đổi trạng thái đơn tương tự System Center
([[01-Architecture-Decisions/ADR-051-Subscription-Invoice-Status-Change-Void-Reopen|ADR-051 KB (≙ ADR-067)]]). Trước đó menu "Thao tác" (ADR-046) có: xác nhận thanh toán
(ghi chú bắt buộc, chỉ PENDING hoặc EXPIRED đã báo chuyển — ADR-061/062), huỷ (PENDING), đánh dấu đã hoàn tiền (FULFILLED).

**Chủ dự án chốt:** cho xác nhận đơn **đã hết hạn** (tiền về trễ); cho **mở lại** đơn hết hạn/đã huỷ, **giữ giá cũ**; ghi chú **không bắt buộc**; UI một mục "Đổi trạng
thái…" trong menu Thao tác (danh sách + trang chi tiết), giữ riêng "Đánh dấu đã hoàn tiền".

---

## 3. Quyết Định (Decision)

### 3.1. Bảng chuyển (trạng thái **hiệu lực**, mọi cổng) ✅ code
`orderStatusTargets(order, now)` (`apps/web/lib/order.ts`, bảng `ORDER_STATUS_TARGETS`, xét `effectiveOrderStatus`):

| Từ | Được chuyển tới |
| :-- | :-- |
| `PENDING` | `PAID` (xác nhận tay), `CANCELLED` |
| `EXPIRED` (kể cả `PENDING` quá `expiresAt` chưa sweep) | `PAID` (xác nhận trễ), `PENDING` (mở lại), `CANCELLED` |
| `CANCELED` | `PENDING` (mở lại) |
| `PAID` / `FULFILLED` / `REFUNDED` | — (hoàn tiền giữ mục riêng ADR-046) |

`CANCELLED` là giá trị form; trạng thái DB là `CANCELED` ✅ code. Máy trạng thái `@gieochu/core` thêm 2 event **`SELLER_CANCEL`** (PENDING/EXPIRED → CANCELED) và
**`SELLER_REOPEN`** (EXPIRED/CANCELED → PENDING) — chỉ dùng cho thao tác người bán; `CANCEL` của khách giữ nguyên ✅ code.

Quyền: action gọi `requireTenantMember(slug)` — mặc định `requiredRole = "OWNER"` → thực tế **chỉ chủ gian hàng** ✅ code (ADR ghi "thành viên gian hàng").

### 3.2. Đã thanh toán ✅ code
- Dùng luồng `markOrderPaid` sẵn có (quyền tải, mã giảm giá tính lượt lúc PAID, thống kê khách, email, `soldCount`). `EXPIRED → PAID` **chỉ là thao tác người bán**;
  webhook/job vẫn dùng `canManuallyConfirmOrder` → giao dịch về sau hạn vẫn vào "Giao dịch cần xử lý" ✅ code (`payment-process.ts` không đổi).
- Khoá dòng đơn `FOR UPDATE`, đọc lại, trạng thái hiệu lực phải là PENDING/EXPIRED (khác → 409 `ORDER_STATUS_NOT_CHANGEABLE`). Không kiểm "khách đã báo chuyển", không
  kiểm tài liệu còn bán (giống webhook — tài liệu bị khoá kiểm duyệt thì entitlement sinh ở `PENDING_CHOICE`).
- Ghi chú (nếu có) lưu vào `confirmNote` trong cùng transaction; `markOrderPaid` no-op → 409 **`ORDER_ALREADY_PAID`** và rollback ghi chú.

### 3.3. Mở lại (→ `PENDING`) ✅ code
- Chặn: gian hàng không `ACTIVE` hoặc tài liệu trong đơn không `PUBLISHED` → 409 `PRODUCT_UNAVAILABLE` (`assertOrderProductsPurchasable`); khách **đã có quyền tải còn hiệu
  lực** với tài liệu của đơn qua **đơn khác** → 409 **`ALREADY_OWNED`**, hoặc khách là chủ gian hàng → 409 `CANNOT_BUY_OWN_PRODUCT` (cùng luật `canPurchaseProduct` với
  tạo đơn — **Bổ sung mục 6**).
- Hạn giữ mới = **thời điểm mở lại** + `orderHoldHoursFor(provider)` (72 giờ thủ công/chưa chọn, 48 giờ cổng tự xác nhận — mặc định System Settings).
- **Giữ** tổng tiền, mã giảm giá, phương thức, `checkoutPayload`, `paymentRef`. **Xoá** `customerDeclaredPaidAt`, `customerReminderSentAt`. **Không** gửi email cho khách.
- Cập nhật có điều kiện theo `status` + `expiresAt` đã đọc → thao tác song song đổi trước → 409 `ORDER_CHANGED`.

### 3.4. Huỷ ✅ code
PENDING hoặc EXPIRED → CANCELED (EXPIRED → CANCELED thêm để đồng nhất với ADR-067), cập nhật có điều kiện như mở lại (409 `ORDER_CHANGED`).

### 3.5. Ghi chú + audit ✅ code
- Ghi chú không bắt buộc: NFC + trim, **cắt** còn 500 ký tự (`ORDER_STATUS_CHANGE_NOTE_MAX`). Sau khi đổi trạng thái commit, lưu thành **ghi chú nội bộ** (`order_notes`,
  ADR-047 — khách không thấy) dạng `[Đổi trạng thái: {cũ} → {mới}] {ghi chú}`; lỗi ghi chú chỉ `logger.warn`, không hỏng thao tác chính.
- Audit **không** chứa văn bản ghi chú (§7.9): `PAID` → `ORDER_MANUALLY_CONFIRMED` (`source: "SELLER_STATUS_CHANGE"`, …); mới **`ORDER_REOPENED_BY_SELLER`**,
  **`ORDER_CANCELED_BY_SELLER`** — chi tiết [[02-System-Specs/Audit-Log-Specs|Audit-Log-Specs]] §4. Hai action mới có trong dòng thời gian đơn Studio.

### 3.6. Sửa lỗi có từ trước — `markOrderPaid` cập nhật có điều kiện (**Bổ sung mục 7**) ✅ code
`updateMany({ where: { id, status: <trạng thái đã đọc> } })` → hai nguồn áp song song (webhook/job + người bán, hai lần bấm) thì lần sau 0 dòng → no-op, **không** tính mã
giảm giá / thống kê khách / email / audit lần hai. Áp cho mọi nguồn gọi.

### 3.7. Giao diện ✅ code / ❓ trình duyệt
- Server Action **`changeOrderStatusAction(tenantSlug, orderId, prevState, formData)`** thay `confirmOrderManuallyAction` + `cancelOrderAction` (đã xoá); `confirm-form.tsx`
  và `CancelOrderButton` đã xoá.
- Menu dòng: "Xem chi tiết" · "Đổi trạng thái…" (khi `statusTargets` khác rỗng) · "Đánh dấu đã hoàn tiền…" (FULFILLED). Trang chi tiết: khối "Trạng thái đơn" với nút
  "Đổi trạng thái…". Hộp chung `OrderStatusDialog` — [[04-Operations-Runbooks/UI-Design-System|UI-Design-System]] §20.9.

---

## 4. Hệ Quả (Consequences)
- `confirmOrderManually` (lib, ghi chú bắt buộc, luật ADR-061/062) **vẫn còn** nhưng không còn UI nào gọi — chỉ test integration + `scripts/demo-reviews.ts` ✅ grep.
  `orderAllowedActions` vẫn trả `confirm`/`cancel` "cho tương thích"; UI chỉ dùng `view`/`refund` ✅ code.
- Rủi ro/lệch còn mở (hạn giữ đơn mở lại vs đổi phương thức, kênh thanh toán khi không ghi chú, mốc email không reset…): [[00-Index/KB-Audit-2026-09-26|KB-Audit]] §51.

---

## 5. Liên Kết
* [[02-System-Specs/Order-State-Machine|Order-State-Machine]] §2, §3.1, §3.2, §3.14 · [[02-System-Specs/Studio-Orders-Specs|Studio-Orders-Specs]] §2.4, §3
* [[02-System-Specs/Payment-And-Billing|Payment-And-Billing]] §4 · [[02-System-Specs/Audit-Log-Specs|Audit-Log-Specs]] §4
* [[03-API-Contracts/Endpoint-Directory|Endpoint-Directory]] §32
* [[04-Operations-Runbooks/UI-Design-System|UI-Design-System]] §20.9
* [[00-Index/KB-Audit-2026-09-26|KB-Audit]] §51

*Quay lại: [[MOC-Home]] (../00-Index/MOC-Home.md)*

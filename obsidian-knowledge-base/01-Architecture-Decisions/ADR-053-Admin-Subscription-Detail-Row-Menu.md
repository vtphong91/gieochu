---
tags:
  - adr
  - billing
  - system-admin
  - ui-ux
  - status/accepted
date: 2026-11-25
decider: vtphong91
status: Accepted — đã code, verify đạt (Quốc báo), chưa commit; không migration
---

# 🏛️ ADR-053: System Center — "Xem chi tiết" đơn hàng gói + menu Thao tác "⋯"

## 1. Trạng Thái (Status)
**ĐÃ PHÊ DUYỆT (Accepted)** — tương ứng **ADR-069** trong [`docs/DECISIONS.md`](../../docs/DECISIONS.md) (chủ dự án chốt 2026-11-25). Bản trích ghi theo duyệt của Quốc
(brief 2026-11-25).

Tiến độ (đối chiếu 2026-11-25): code ADR-069 ở working tree, **chưa commit** ✅ `git status` (code ADR-067/068 nền đã nằm trong commit `2ccc2fc` ✅ `git show --stat`).
**Không migration**, **không thêm `route.ts`** (24 dưới `/api`, 26 toàn app ✅ đếm) — thêm 1 trang App Router. Không thêm test case — `pnpm test:count` = **105/105 unit,
69/69 integration** ✅ (Long chạy); `subscription-billing.test.ts` mở rộng trong case có sẵn ✅ `git diff --stat`. tsc, lint (chỉ cảnh báo cũ), unit, integration
`subscription-billing` 7/7 🟡 (Quốc báo).

Mức xác minh: ✅ Long đã đối chiếu code working tree · 🟡 theo `docs/DECISIONS.md`/brief · ❓ chưa thử bằng trình duyệt với phiên SYSTEM_ADMIN, chưa deploy.

---

## 2. Bối Cảnh (Context) 🟡
Cột "Thao tác" ở `/admin/subscriptions` ([[01-Architecture-Decisions/ADR-051-Subscription-Invoice-Status-Change-Void-Reopen|ADR-051 KB (≙ ADR-067)]]) chỉ có "Đổi
trạng thái…" → dòng có hoá đơn đã thanh toán không có thao tác nào; System Center chưa có trang chi tiết đơn hàng gói. Chủ dự án yêu cầu tối thiểu "Xem chi tiết".

**Chủ dự án chốt:** trang chi tiết gồm **thông tin thuê bao**, **lịch sử hoá đơn gói**, **nhật ký thao tác**; tab "Tất cả" của trang Hoá đơn gói dùng chung menu "⋯".

---

## 3. Quyết Định (Decision)

### 3.1. Menu dòng "⋯" ở cột "Thao tác" ✅ code
- Component **`InvoiceRowMenu({ label, detailHref, status })`** (`app/admin/billing/invoices/confirm-button.tsx`) — kit `RowMenu size="touch"`:
  **"Xem chi tiết"** (`MenuItemLink`, khi có `detailHref`) + **"Đổi trạng thái hoá đơn…"** (`MenuItemButton`, khi `status.targets` khác rỗng — mở hộp ADR-067).
- `/admin/subscriptions`: luôn render menu (mỗi dòng là một thuê bao → "Xem chi tiết" luôn có); nhánh "—" ở cột này **đã bỏ** ✅ `git diff`. Đổi trạng thái áp cho
  hoá đơn **gần nhất**.
- Tab "Tất cả" `/admin/billing/invoices`: "Xem chi tiết" khi hoá đơn có thuê bao (`subscriptionId`); không thuê bao **và** không còn trạng thái để chuyển → vẫn "—" (hiếm).
- Tab "Chờ đối soát" **giữ** `ManualConfirmButton` ✅ code.

### 3.2. Trang chi tiết `/admin/subscriptions/[subscriptionId]` ✅ code
- `page.tsx` + `loading.tsx` (khung chờ, `aria-busy`, `role="status"` "Đang tải chi tiết đơn hàng gói...", tắt nhấp nháy khi giảm chuyển động).
- `requireAdminAccess(path)` → `getAdminSubscriptionDetail(subscriptionId)` → `null` thì **404** (`notFound()`).
- 3 phần: **Thông tin thuê bao** (gian hàng tên + slug, gói + giá/"Miễn phí", trạng thái, bắt đầu kỳ, hết hạn — gói miễn phí "Không thời hạn", hạn ân hạn) · **Lịch sử hoá
  đơn gói** (mọi hoá đơn của gian hàng, mới nhất trước; mỗi dòng có nút "Đổi trạng thái…" khi `statusTargets` khác rỗng, không có → "—") · **Nhật ký thao tác** (danh sách
  `<ol>`: thời điểm giờ VN, nhãn action, người làm — null → "Hệ thống", mã hoá đơn, trạng thái cũ → mới, ghi chú).
- Nút quay lại "Đơn hàng gói dịch vụ" về `/admin/subscriptions` (không giữ bộ lọc).

### 3.3. Dữ liệu — `getAdminSubscriptionDetail` ✅ code
- **Tiền điều kiện:** nơi gọi đã kiểm System Admin. Chỉ bảng **L1** (`subscriptions`, `plans`, `tenants`, `subscription_invoices`, `subscription_refund_requests` — chỉ id,
  `users` — tên/email người làm) + `audit_logs` (L1). **Không** đọc đơn hàng/khách hàng của gian hàng (§7.9).
- Hoá đơn: theo `tenantId`, `createdAt desc, id desc`, **trần 500**; kèm `statusTargets`.
- Nhật ký: `audit_logs` với `tenantId` của gian hàng **và** đối tượng là hoá đơn gói (trong ≤ 500 hoá đơn trên) hoặc yêu cầu hoàn tiền gói của các hoá đơn đó; mới nhất trước,
  **trần 100**; bảng audit chưa có → rỗng.
- Metadata **chỉ** lấy `fromStatus`/`toStatus`/`note`; suy luận: thiếu `fromStatus` → `previousInvoiceStatus` (xác nhận trễ); `SUBSCRIPTION_PAID` thiếu `toStatus` → `PAID`.
  Không trả metadata thô (giao dịch cổng, chênh lệch tiền…).
- `actorLabel`: họ tên ?? email; actor null → `null` (UI "Hệ thống"); tài khoản đã xoá → "Tài khoản đã xoá".

### 3.4. Revalidate ✅ code
3 Server Action hoá đơn gói (`confirmManualInvoiceAction`, `changeInvoiceStatusAction`, `confirmInvoiceFromTransactionAction`) dùng helper nội bộ `revalidateBillingPages()` —
`/admin/billing/invoices`, `/admin/subscriptions` và `revalidatePath("/admin/subscriptions/[subscriptionId]", "page")` (route động: mẫu + `"page"`).

---

## 4. Hệ Quả (Consequences)
- Sửa giao diện [[01-Architecture-Decisions/ADR-051-Subscription-Invoice-Status-Change-Void-Reopen|ADR-051 KB]] §3.6: ở `/admin/subscriptions` + tab "Tất cả", nút
  `InvoiceStatusButton` thay bằng menu "⋯"; `InvoiceStatusButton` nay chỉ dùng ở bảng hoá đơn của trang chi tiết.
- Nhật ký trang chi tiết là **một lối đọc audit mới** ngoài `lib/audit-query.ts` (audit không RLS — Audit-Log-Specs §5 "mọi đường đọc mới phải đi qua loader này") — xem
  [[00-Index/KB-Audit-2026-09-26|KB-Audit]] §52.
- Ô vuông xanh ở cột "Thao tác" chưa tái hiện được; nhánh "—" ở `/admin/subscriptions` đã bỏ ❓ chờ chủ dự án xác nhận sau deploy.

---

## 5. Liên Kết
* [[02-System-Specs/Payment-And-Billing|Payment-And-Billing]] §5P · [[03-API-Contracts/Endpoint-Directory|Endpoint-Directory]] §33
* [[04-Operations-Runbooks/UI-Design-System|UI-Design-System]] §27.8
* [[00-Index/KB-Audit-2026-09-26|KB-Audit]] §52

*Quay lại: [[MOC-Home]] (../00-Index/MOC-Home.md)*

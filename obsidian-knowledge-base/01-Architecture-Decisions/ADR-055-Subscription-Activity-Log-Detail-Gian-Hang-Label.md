---
tags:
  - adr
  - billing
  - system-admin
  - audit
  - ui-ux
  - status/accepted
date: 2026-11-26
decider: vtphong91
status: Accepted — đã code, verify đạt (Quốc báo), chưa commit; không migration
---

# 🏛️ ADR-055: Đợt 2 — nhật ký chi tiết đơn hàng gói + chữ hiển thị "Gian hàng" thay "Tenant"

> Lưu ý đánh số: đây là **bản trích KB số 055**, tương ứng **ADR-071** trong `docs/DECISIONS.md` — **không phải** ADR-055 gốc (MinIO HTTPS, chưa có bản trích KB).

## 1. Trạng Thái (Status)
**ĐÃ PHÊ DUYỆT (Accepted)** — tương ứng **ADR-071** trong [`docs/DECISIONS.md`](../../docs/DECISIONS.md) (chủ dự án chốt 2026-11-25), gồm **"Bổ sung" (chủ dự án chốt
2026-11-26)**. Kế hoạch chi tiết: `docs/ke-hoach-dot-2-nhat-ky-chi-tiet-va-ten-gian-hang-2026-11-25.md` (Long chưa đọc — không thuộc brief). Bản trích ghi theo duyệt của Quốc
(brief 2026-11-26). Đây là **đợt 2** trong kế hoạch 4 đợt ([[01-Architecture-Decisions/ADR-054-Payment-Status-Emails|ADR-054 KB]] §4).

Tiến độ (đối chiếu 2026-11-26): code ở working tree, **chưa commit** ✅ `git status`. **Không migration**, **không thêm `route.ts`** (24 / 26 ✅ đếm). Không thêm test case —
`pnpm test:count` = **105/105 unit, 69/69 integration** ✅ (Long chạy). tsc 17/17, lint (chỉ cảnh báo cũ ở `huong-dan-su-dung`), unit, integration `subscription-billing` 7/7 🟡
(Quốc báo).

Mức xác minh: ✅ Long đã đối chiếu code working tree · 🟡 theo `docs/DECISIONS.md`/brief · ❓ chưa xem trên trình duyệt với phiên SYSTEM_ADMIN, chưa deploy.

---

## 2. Bối Cảnh (Context) 🟡
Nhật ký ở trang Chi tiết đơn hàng gói ([[01-Architecture-Decisions/ADR-053-Admin-Subscription-Detail-Row-Menu|ADR-053 KB (≙ ADR-069)]]) chỉ hiện "Thanh toán gói dịch vụ · Hệ
thống", "— → Đã thanh toán"; thiếu nguồn/cổng/số tiền, mốc tạo hoá đơn, email đã gửi. System Center còn ~20 chỗ hiện chữ "Tenant".

**Chủ dự án chốt:** mốc "Tạo hoá đơn" = audit mới + suy ra cho hoá đơn cũ; hiện email đã gửi trong nhật ký; chi tiết mới **chỉ** áp ở trang Chi tiết đơn hàng gói (Nhật ký chung
`/admin/audit` + Studio Hoạt động để đợt sau); trang Vai trò ghi "Gian hàng (tenant)".

---

## 3. Quyết Định (Decision)

### 3.1. 2B — chữ hiển thị "Gian hàng" (làm trước) ✅ code
- System Center: "Tenant/tenant" → "Gian hàng/gian hàng" ở 11 file `apps/web/app/admin/**` — sidebar (mục **"Gian hàng"**), `/admin/tenants` (tiêu đề, trống, nút **"Khoá/Mở khoá
  gian hàng"**), Tổng quan `/admin` ("Tổng gian hàng", "Gian hàng hoạt động", "Gian hàng mới"…), Gói dịch vụ, Danh mục (2 trang), Cấu hình thanh toán, Báo cáo vi phạm (2 file —
  "Quản lý gian hàng"), Vai trò (**"Gian hàng (tenant)"**), SMTP (2 câu) ✅ `git diff`.
- **Giữ:** URL `/admin/tenants`, tên trong code/DB, tên bucket kỹ thuật `gc-tenant-…`. Chữ "tenant" ngoài System Center: Phong rà — không còn chữ hiển thị 🟡 (brief).
- Thuật ngữ KB: **Gian hàng = tenant (L2)** — [[00-Index/Tags-Dictionary|Tags-Dictionary]] (`#tenant`).

### 3.2. 2A — nhật ký chi tiết trang `/admin/subscriptions/[subscriptionId]` ✅ code
- Mỗi dòng nhật ký có `kind` (`INVOICE_CREATED` / `PAYMENT` / `INVOICE_VOIDED` / `INVOICE_REOPENED` / `EMAIL` / `OTHER`), người làm kèm vai trò (Quản trị viên / Chủ gian hàng),
  hoá đơn (mã · số tiền · cổng), trạng thái cũ → mới.
- **Thanh toán:** nhãn nguồn từ `metadata.source` + cổng ("Tự động qua SePay/MoMo/cổng thanh toán", "Quản trị viên xác nhận tay", "Quản trị viên xác nhận từ giao dịch" — dùng
  "Quản trị viên", không "Admin"), badge "Xác nhận trễ", đã nhận / chênh (thừa/thiếu), khối **giao dịch ngân hàng** từ `platform_payment_transactions.matchedInvoiceId` (+ giao
  dịch admin chọn) — chỉ 5 trường trích (cổng, mã GD, thời điểm, nội dung ≤ 80 ký tự, số tiền), **không** trả `rawPayload`; trạng thái cũ suy ra PENDING, hoặc EXPIRED nếu xác
  nhận trễ.
- **Tạo hoá đơn:** audit mới **`SUBSCRIPTION_INVOICE_CREATED`** trong `createRenewalInvoice` (chỉ khi thật sự tạo; actor = người bấm gia hạn ở Studio; metadata `code`, `planId`,
  `provider`, `amountVnd`); hoá đơn cũ không có audit → dòng **suy ra** từ `invoice.createdAt`, "Không rõ người tạo".
- **Email đã gửi (Bổ sung 2026-11-26):** chỉ **5 email hoá đơn gói** `subscription_invoice_*` (ADR-070) từ `email_send_log`, ghép **theo mã hoá đơn trong tiêu đề**; **bỏ** email
  nhắc hạn / ân hạn / hạ gói vì `email_send_log` không có cột gắn gian hàng. Người nhận chỉ hiện dạng che khi khác email chủ gian hàng hiện tại.
- Gộp audit + dòng suy ra + email, mới nhất trước, **≤ 100 dòng**.

### 3.3. Ranh giới ✅ code
Không migration; không thêm test case; chỉ dữ liệu L1 + `audit_logs` + `email_send_log` — không đơn/khách của gian hàng (§7.9).

---

## 4. Hệ Quả (Consequences)
- Contract dòng nhật ký `AdminSubscriptionActivityEntry` thay kiểu `activity[]` cũ của ADR-069 — [[03-API-Contracts/Endpoint-Directory|Endpoint-Directory]] §35.
- `createRenewalInvoice` nhận tuỳ chọn `actorId`; Studio `renewSubscriptionAction` truyền người bấm.
- Rủi ro còn mở: [[00-Index/KB-Audit-2026-09-26|KB-Audit]] §54.

---

## 5. Liên Kết
* [[02-System-Specs/Payment-And-Billing|Payment-And-Billing]] §5R · [[02-System-Specs/Audit-Log-Specs|Audit-Log-Specs]] §4, §5.2
* [[03-API-Contracts/Endpoint-Directory|Endpoint-Directory]] §35 · [[04-Operations-Runbooks/UI-Design-System|UI-Design-System]] §27.9
* [[02-System-Specs/User-Management-System-Center-Specs|User-Management-System-Center-Specs]] (sơ đồ menu) · [[02-System-Specs/Tenant-RBAC-And-Permissions|Tenant-RBAC-And-Permissions]] §1
* [[00-Index/KB-Audit-2026-09-26|KB-Audit]] §54

*Quay lại: [[MOC-Home]] (../00-Index/MOC-Home.md)*

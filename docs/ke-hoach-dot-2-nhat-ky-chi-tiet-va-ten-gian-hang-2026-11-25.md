# Kế hoạch Đợt 2 — Nhật ký thao tác chi tiết + đổi chữ "Tenant" → "Gian hàng"

> Ngày lập: 2026-11-25 · Người lập: Quốc (kỹ sư trưởng) · Trạng thái: **đã chốt, chưa code**
> Quyết định: [ADR-071](DECISIONS.md) · Lộ trình chung: [PLAN.md](PLAN.md) mục "Kế hoạch 4 đợt System Center / thanh toán"
> Đợt trước: Đợt 1 — Email thông báo thanh toán (ADR-070). Đợt sau: Đợt 3 — Trang chi tiết gian hàng; Đợt 4 — Trang chi tiết người dùng.

---

## 1. Mục tiêu

1. **2B — Tên gọi:** trong System Center, người quản trị thấy chữ **"Gian hàng"** thống nhất với Studio, email và các bảng đã làm, thay cho
   thuật ngữ kỹ thuật "Tenant".
2. **2A — Nhật ký chi tiết:** ở trang **Chi tiết đơn hàng gói** (`/admin/subscriptions/[id]`, ADR-069), nhìn một dòng nhật ký là biết
   ngay: hoá đơn **được tạo** khi nào, **thanh toán qua đâu** (SePay, MoMo, admin xác nhận tay…), **bao nhiêu tiền**, **giao dịch ngân hàng
   nào**, và chủ gian hàng **đã được gửi email gì**.

## 2. Quyết định đã chốt (chủ dự án, 2026-11-25)

| # | Câu hỏi | Chốt |
|---|---|---|
| 1 | Mốc "Tạo hoá đơn" | Ghi **audit mới** từ nay (ai tạo, gói, cổng, số tiền, mã) + **suy ra** từ ngày tạo cho hoá đơn cũ ("không rõ người tạo") |
| 2 | Hiện email đã gửi trong nhật ký | **Có** |
| 3 | Phạm vi hiển thị chi tiết mới | **Chỉ trang Chi tiết đơn hàng gói.** Trang Nhật ký chung của System Center và trang Hoạt động của Studio để đợt sau |
| 4 | Trang Vai trò (bảng kỹ thuật) | Ghi **"Gian hàng (tenant)"** |
| 5 | Thứ tự | **2B trước** (nhỏ, quy trình rút gọn), **2A sau** (quy trình đầy đủ) |

## 3. Hiện trạng (Quốc đối chiếu code 2026-11-25)

### 3.1 Nhật ký trang Chi tiết đơn hàng gói

- Nguồn: `getAdminSubscriptionDetail()` (`apps/web/lib/subscription-billing.ts`) → mảng `activity` chỉ có `action`, `actionLabel`,
  `actorLabel`, `invoiceCode`, `fromStatus`, `toStatus`, `note`.
- Audit **đã lưu sẵn** nhưng chưa hiển thị:

| Action | Metadata đang có |
|---|---|
| `SUBSCRIPTION_PAID` (webhook / admin xác nhận tay) | `source` (`PLATFORM_WEBHOOK` \| `ADMIN_MANUAL_CONFIRM`), `provider`, `amountVnd`, `planId`, `previousPlanId`, `periodEnd`, `reactivated`, `note` |
| `SUBSCRIPTION_PAID` (xác nhận trễ) | như trên + `previousInvoiceStatus: "EXPIRED"`, `lateConfirmation`, kỳ tính lại |
| `SUBSCRIPTION_PAID` (xác nhận từ giao dịch) | `source: ADMIN_TRANSACTION_CONFIRM`, `transactionId`, `transactionProvider`, `receivedAmountVnd`, `amountVnd`, `differenceVnd` |
| `SUBSCRIPTION_INVOICE_VOIDED` / `_REOPENED` | `code`, `provider`, `amountVnd`, `fromStatus`, `toStatus`, `note` (+ `dueAt`, kỳ mới khi mở lại) |

- **Thiếu:**
  - Không có audit khi **tạo hoá đơn** (`createRenewalInvoice`).
  - Thanh toán qua webhook hiện "Hệ thống", không có thông tin giao dịch ngân hàng (nằm ở `platform_payment_transactions.rawPayload`,
    gắn hoá đơn qua `matchedInvoiceId`).
  - `fromStatus` trống ("—") với `SUBSCRIPTION_PAID`.
  - Email đã gửi (A1–A5 ADR-070, nhắc hạn/ân hạn/hạ gói) có trong `email_send_log` nhưng không hiện.

### 3.2 Chữ "Tenant" hiển thị trong System Center (~20 chỗ)

| File | Chỗ hiển thị |
|---|---|
| `apps/web/app/admin/_ui/sidebar-nav.tsx` | Menu "Tenant" |
| `apps/web/app/admin/tenants/page.tsx` | Tiêu đề "Tenant", mô tả "…của tenant (§4.2)…", thông báo trống "Chưa có tenant nào" |
| `apps/web/app/admin/page.tsx` | "Tổng tenant", "Tenant hoạt động", "Tenant", "Tenant mới" |
| `apps/web/app/admin/plans/plan-form.tsx` | 3 câu mô tả có "tenant" |
| `apps/web/app/admin/categories/page.tsx`, `categories/new/page.tsx` | 2 câu mô tả |
| `apps/web/app/admin/billing/payment/page.tsx` | Mô tả "…từ các tenant… khách hàng ↔ tenant… theo từng tenant" |
| `apps/web/app/admin/reports/_ui/report-detail.tsx` | "…trang quản lý tenant." |
| `apps/web/app/admin/settings/smtp/smtp-tabs.tsx` | "…khách hàng của tenant." |
| `apps/web/app/admin/roles/page.tsx` | Bảng kỹ thuật các lớp quyền ("Tenant", "Vai trò Tenant (Studio)"…) → "Gian hàng (tenant)" |

> Danh sách trên lấy bằng grep; Phong rà lại toàn bộ thư mục `apps/web/app/admin/**` khi làm (có thể còn chỗ khác).

## 4. Phạm vi

**Trong phạm vi**
- 2B: chữ hiển thị trong `apps/web/app/admin/**`.
- 2A: dữ liệu + giao diện mục "Nhật ký thao tác" của trang Chi tiết đơn hàng gói; audit mới khi tạo hoá đơn gia hạn.

**Ngoài phạm vi (không làm ở đợt này)**
- Đổi URL `/admin/tenants`, tên bảng/cột/hàm trong code và DB, tên bucket kỹ thuật `gc-tenant-…`.
- Chữ "tenant" ở Studio, trang công khai, email → **chỉ rà và báo cáo** (Phong), quyết ở đợt sau.
- Hiển thị chi tiết mới ở trang Nhật ký chung (`/admin/audit…`) và Studio "Hoạt động".
- Backfill audit cho hoá đơn cũ (chỉ suy ra khi hiển thị).

## 5. 2B — Đổi "Tenant" → "Gian hàng" (quy trình rút gọn)

| Bước | Ai | Việc |
|---|---|---|
| 1 | **Phong** | Sửa toàn bộ chữ hiển thị trong `apps/web/app/admin/**` theo bảng 3.2: "Tenant/tenant" → "Gian hàng/gian hàng" (viết hoa đúng vị trí đầu câu); trang Vai trò dùng "Gian hàng (tenant)". Không đổi tên biến, props, route, import. |
| 2 | **Phong** | Rà và **chỉ báo cáo** (không sửa) chữ "tenant" còn hiển thị ở `apps/web/app/studio/**`, trang công khai, `packages/email/**`: file:dòng + câu hiện tại. |
| 3 | **Quốc** | `git status` (chỉ file trình bày trong `app/admin/**`), `pnpm --filter @gieochu/web exec tsc --noEmit`, `eslint app/admin --max-warnings=0`. |
| 4 | **Long** | Thêm mục thuật ngữ "Gian hàng = tenant (L2)" vào KB (Tags-Dictionary / trang thuật ngữ phù hợp) + ghi danh sách chữ còn sót từ báo cáo của Phong vào KB-Audit. |

**Tiêu chí xong:** không còn chữ "Tenant/tenant" hiển thị trong System Center (trừ "Gian hàng (tenant)" ở trang Vai trò và thuật ngữ kỹ
thuật có chủ đích); typecheck + lint đạt; có báo cáo chữ còn sót ngoài System Center.

## 6. 2A — Nhật ký thao tác chi tiết (quy trình đầy đủ)

### 6.1 Nội dung một dòng nhật ký

| Thành phần | Nguồn dữ liệu | Ví dụ hiển thị |
|---|---|---|
| Thời gian | `audit_logs.createdAt` / `email_send_log` / `invoice.createdAt` | 14:37 25/11/2026 |
| Hành động | Nhãn audit (`@gieochu/core`) | Thanh toán gói dịch vụ |
| Người làm | Họ tên/email actor; không actor → **"Tự động"** | Tự động · System Admin |
| **Nhãn nguồn** (mới) | `metadata.source` + `provider` | Tự động qua SePay · Tự động qua MoMo · Admin xác nhận tay · Admin xác nhận từ giao dịch · Xác nhận trễ |
| Mã HĐ · số tiền · cổng (mới) | `invoiceCode`, `metadata.amountVnd`, `provider` | SEVQR31004800 · 199.000 đ · Chuyển khoản ngân hàng |
| Đã nhận / chênh (mới) | `receivedAmountVnd`, `differenceVnd` | Đã nhận 204.000 đ · thừa 5.000 đ |
| **Khối giao dịch ngân hàng** (mới) | `platform_payment_transactions` có `matchedInvoiceId` = hoá đơn (hoặc `transactionId`) → `rawPayload`: mã GD SePay, thời điểm giao dịch, nội dung CK (cắt ngắn) | GD SePay #102183723 · 14:07 24/11/2026 · "CT DEN:…SEVQR31004800…" |
| Trạng thái cũ → mới | `fromStatus`/`toStatus`; `SUBSCRIPTION_PAID` thiếu `fromStatus` → **suy ra** PENDING (EXPIRED nếu `previousInvoiceStatus`/`lateConfirmation`) | Chờ thanh toán → Đã thanh toán |
| Ghi chú | `metadata.note` | Khách đổi ý |

### 6.2 Dòng mới

| Dòng | Nguồn | Ghi chú |
|---|---|---|
| **Tạo hoá đơn** (hoá đơn mới) | Audit mới `SUBSCRIPTION_INVOICE_CREATED` ghi trong `createRenewalInvoice` khi **thật sự tạo** hoá đơn (không ghi khi dùng lại hoá đơn chờ); metadata: `code`, `planId`, `provider`, `amountVnd`; actor = người bấm gia hạn | Nhãn tiếng Việt "Tạo hoá đơn gói dịch vụ" |
| **Tạo hoá đơn** (hoá đơn cũ) | Suy ra từ `subscription_invoices.createdAt` khi hoá đơn chưa có audit tạo | Người làm: "Không rõ người tạo" |
| **Đã gửi email** | `email_send_log` của gian hàng với các loại `subscription_invoice_*` (ADR-070) và nhắc hạn/ân hạn/hạ gói | "Đã gửi email *Thanh toán thành công* tới chủ gian hàng" (không hiện địa chỉ email đầy đủ nếu Phong thấy không cần) |

### 6.3 Các bước

| Bước | Ai | Việc | Đầu ra |
|---|---|---|---|
| 1 | **Phong** | Chốt bố cục dòng nhật ký (bảng 6.1) cho 375/1024/1280px + **contract dữ liệu** cần (tên trường, kiểu, giá trị rỗng) | Báo cáo bố cục + contract → Quốc |
| 2 | **Quốc** | Duyệt contract, chuyển cho Hiếu | Brief Hiếu |
| 3 | **Hiếu** | Mở rộng `getAdminSubscriptionDetail().activity` theo contract; audit `SUBSCRIPTION_INVOICE_CREATED` (+ nhãn trong `@gieochu/core`); suy ra mốc tạo cho hoá đơn cũ; nối `platform_payment_transactions`; đọc `email_send_log`; mở rộng test sẵn có | Code + verify |
| 4 | **Phong** | Dựng giao diện mục "Nhật ký thao tác" theo contract | Code + soát a11y/responsive |
| 5 | **Quốc** | Review phạm vi, typecheck, lint, unit, `test:count`, integration `subscription-billing` | Báo chủ dự án |
| 6 | **Long** | Ghi KB: ADR-071, spec Payment-And-Billing (nhật ký), Audit-Log-Specs (action mới), Endpoint-Directory (contract), UI-Design-System | Báo trang đã sửa |

### 6.4 Ràng buộc kỹ thuật

- Chỉ đọc dữ liệu L1 + audit + nhật ký email của **chính gian hàng** đó; không đọc đơn hàng/khách hàng của gian hàng (§7.9).
- Không trả `rawPayload` thô: chỉ lấy mã GD, thời điểm, nội dung CK (cắt ngắn), số tiền.
- Không migration (`audit_logs.action` là String).
- **Không thêm test case** (trần 105/69) — mở rộng case sẵn có trong `subscription-billing.test.ts`: audit tạo hoá đơn khi tạo mới (không
  ghi khi dùng lại hoá đơn chờ); nhật ký có nhãn nguồn, số tiền, giao dịch, dòng email; mốc suy ra cho hoá đơn không có audit tạo.
- Giữ trần an toàn hiện có (500 hoá đơn, 100 dòng nhật ký); dòng email tính chung trong giới hạn.

**Tiêu chí xong:** mỗi dòng thanh toán hiện đúng nguồn, số tiền, cổng, giao dịch; có mốc "Tạo hoá đơn" cho mọi hoá đơn; có dòng email đã
gửi; không còn "—" ở trạng thái cũ của dòng thanh toán; toàn bộ verify đạt; Long đã ghi KB.

## 7. Rủi ro

| Rủi ro | Giảm thiểu |
|---|---|
| Nhật ký dài khi gian hàng có nhiều email nhắc hạn | Giữ giới hạn 100 dòng, mới nhất trước; email gom theo loại nếu Phong thấy cần |
| Nội dung CK có thể chứa tên người chuyển | Chỉ System Admin xem (dữ liệu thanh toán phí nền tảng, L1); cắt ngắn; không hiện ở Studio |
| Đổi chữ làm lệch tài liệu/ảnh hướng dẫn cũ | Long cập nhật thuật ngữ trong KB |
| Hoá đơn cũ không có audit tạo | Hiện mốc suy ra, ghi rõ "Không rõ người tạo" |

## 8. Việc chủ dự án cần làm

1. Commit + deploy **Đợt 1** (email thanh toán) và thử trước khi bắt đầu Đợt 2.
2. Báo **"bắt đầu đợt 2"** → Quốc giao Phong làm 2B.
3. Sau 2B và 2A: deploy, mở trang Chi tiết đơn hàng gói của một gian hàng đã thanh toán qua SePay, kiểm tra nhật ký.

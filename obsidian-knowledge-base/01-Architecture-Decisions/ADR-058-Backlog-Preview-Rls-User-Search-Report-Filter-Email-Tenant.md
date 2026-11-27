---
tags:
  - adr
  - security
  - rls
  - payment
  - email
  - system-admin
  - status/accepted
date: 2026-11-27
decider: Quốc (kỹ sư trưởng) — chủ dự án chốt 2026-11-27
status: Accepted — Quốc duyệt 2026-11-27; code đã verify (Quốc báo); migration `20261127120000_adr074_email_send_log_tenant` đã áp
---

# ADR-058 (KB) — Backlog sau 4 đợt: xem trước 20% qua RLS, tìm người dùng theo tên, lọc báo cáo theo gian hàng, gắn gian hàng cho nhật ký email, webhook an toàn khi đẩy job lỗi

> **Tương ứng ADR-074 trong `docs/DECISIONS.md`.** Số KB 058 khác số ADR gốc 074 (KB đánh số riêng, xem [[00-Index/KB-Audit-2026-09-26|KB-Audit]] §57).
> Nguồn chính thức: `docs/DECISIONS.md` ADR-074 (mục 1–8). Mức xác minh: ✅ đã đối chiếu code (2026-11-27) · 🟡 theo brief/báo cáo của Quốc · ❓ cần môi trường thật.

## 1. Bối cảnh

Sau đợt 4 ([[01-Architecture-Decisions/ADR-057-User-Detail-Account-Actions-Session-Guard|ADR-057 KB]]) còn các việc tồn: route "Xem trước 20%" trả 404 cho tài liệu đã xuất bản; ô tìm `/admin/users` ghi "tên, email, SĐT" nhưng chỉ lọc email; lọc `/admin/reports` theo gian hàng (hoãn từ ADR-072); `email_send_log` không có cột gian hàng nên hai trang đọc nhật ký email phải đoán theo người nhận; nợ kit giao diện; webhook thanh toán có thể bỏ sót giao dịch khi đẩy job lỗi (Long phát hiện khi viết `docs/doc-payment-241126.md`, Quốc xác minh).

## 2. Quyết định và hiện trạng code

### 2.1. Xem trước 20% đọc qua helper RLS (mục 1) ✅ `apps/web/lib/product-file-preview.ts`

- **Nguyên nhân 404:** `getPreviewForPublicRoute` đọc bảng L2 bằng `getPrismaClient()` trực tiếp → role `gieochu_app` không có ngữ cảnh RLS → không thấy dòng nào (vi phạm quy tắc helper RLS).
- **Nay mỗi bước dùng đúng helper:**
  1. `withPublic` — kiểm gian hàng `ACTIVE` + sản phẩm `PUBLISHED`.
  2. `withTenant(tenantId)` — đọc `product_files` và cache `product_file_previews` (chỉ sau khi qua guard bước 1).
  3. `withSystemJob` — `generateAndStorePreview` đọc file và upsert cache.
- **Ghi chú RLS:** `tenants` và `product_file_previews` **không bật RLS**; policy public của `product_files` chỉ cho thấy `isPreview = true` — vì vậy đọc file không dùng `withPublic`.
- **Không đổi policy RLS, không migration.**

### 2.2. Tìm người dùng theo họ tên + email (mục 2) ✅ `apps/web/app/admin/users/page.tsx`

Lọc `email` HOẶC `profile.fullName` (`contains`, không phân biệt hoa thường). **Không** tìm theo SĐT (tránh dò số né audit "Hiện đầy đủ" ADR-073). Placeholder: "Tìm theo tên hoặc email...".

### 2.3. Lọc `/admin/reports?tenantId=` (mục 3) ✅ `apps/web/app/admin/reports/_ui/report-list.tsx`

- Đầu danh sách hiện "Đang lọc theo gian hàng: <tên>" + link "Bỏ lọc"; phân trang và nút "Lọc" giữ tham số.
- Id không hợp lệ (rỗng, dài hơn 64 ký tự, không tồn tại) → bỏ qua, không lọc.
- Trang chi tiết gian hàng, phần Vi phạm: link "Xem tất cả báo cáo" → `/admin/reports?tenantId=…` (thay link cũ `?status=ALL`).

### 2.4. `email_send_log.tenantId` (mục 4) ✅

- Cột `tenantId String?`, index `(tenantId, createdAt)`, **không FK**, bảng vẫn **L1** (không RLS) — cột chỉ là nhãn. Dòng cũ để `NULL`. Migration `20261127120000_adr074_email_send_log_tenant` (expand-only) **đã áp**.
- API: `sendEmailNow(message, { tenantId? })` và `logEmailSend` nhận `tenantId` (`apps/web/lib/email-dispatch.ts`).
- **Có `tenantId`** (email trong ngữ cảnh gian hàng): đơn, nhắc thanh toán, hoá đơn gói, sweep thuê bao, hoàn tiền, khoá gian hàng, `content_moderated`, remedy, file bị từ chối, review mới, tin nhắn gian hàng, `payment_mismatch`.
- **Lưu ý:** `tenantId` được truyền cho mọi email trên, nhưng chỉ **vào bảng** với loại có ghi log; loại thuộc `TENANT_CUSTOMER_FACING_TYPES` (`order_paid`, `review_new`, `payment_mismatch`, `storefront_message`…) vẫn không ghi `email_send_log` (§7.9) ✅ đọc `Database-Schema-Reference` + `order.ts`.
- **Để `NULL`:** `abuse_report_resolved` và `guest_activation` (tránh nối người báo cáo hoặc khách với gian hàng trên bảng L1 — §7.9); email tài khoản (reset, verify, khoá/mở khoá người dùng, thử SMTP).
- **Trang đọc log** — `getOrderDetailView` (`order.ts`) và chi tiết đơn hàng gói (`subscription-billing.ts`) lọc `tenantId` khớp **hoặc** `NULL` (dòng cũ giữ cách khớp cũ).
- **Không thêm màn hình** System Center hiển thị email theo gian hàng (email gửi khách là dữ liệu L3 — §7.9).
- **Thứ tự triển khai:** `pnpm db:migrate` **trước**, deploy code sau — xem [[04-Operations-Runbooks/Deploy-Vercel-Runbook|Deploy-Vercel-Runbook]].
- **Lỗi có sẵn → backlog:** timeline email của đơn Studio luôn rỗng, vì `ORDER_EMAIL_TYPES` (`order_paid`, `remedy_refund_requested`) thuộc `TENANT_CUSTOMER_FACING_TYPES` — loại không ghi log ✅ đọc code `order.ts`.

### 2.5. Kit `admin/_ui` (mục 5) ✅

`detail-kit.tsx` (`CARD`, `LINE`, `Dash`, `SectionHeading`, `InfoItem`, `InfoGrid`, `CompactEmpty`, `TextLink`, `StatTile`); `row-popover-menu.tsx` (`RowPopoverMenu`: `label`, `width`, `handleRef`, `dialogs`) — `InvoiceRowMenu` và `UserRowActions` dùng chung; `tenants/[tenantId]/_ui/parts.tsx` chỉ còn `UsageBar`; `apps/web/lib/lock-reason.ts` có `LOCK_REASON_MAX_LENGTH = 500` (nguồn duy nhất, client-safe), `USER_/TENANT_LOCK_REASON_MAX_LENGTH` giữ làm alias. Không đổi giao diện. Xem [[04-Operations-Runbooks/UI-Design-System|UI-Design-System]] §29.

### 2.6. Tài liệu `docs/doc-payment-241126.md` (mục 6)

Hướng dẫn phát triển module thanh toán (có trích code để tái dùng ở hệ thống khác). Nằm ở `docs/` (Quốc quản), KB chỉ liên kết từ MOC.

### 2.7. Webhook hai phía (mục 7) ✅ `apps/web/lib/webhook-event.ts`

- **Lỗi cũ:** route ghi `webhook_events` rồi mới đẩy job; nếu bước sau lỗi, lần cổng gửi lại bị coi là trùng → mất giao dịch; `catch` khi ghi sự kiện coi mọi lỗi là trùng.
- **Nay:** `recordWebhookEvent(key)` — chỉ lỗi trùng khoá **P2002** là "đã xử lý" (trả `null`, route 200). Lỗi khác ném tiếp → route trả **5xx** dạng `{ error: { code, message, requestId } }`.
- `releaseWebhookEventOnFailure(event, step)` — bước sau khi ghi sự kiện mà lỗi: **xoá đúng dòng `webhook_events` vừa ghi (theo id)** rồi ném lại lỗi gốc → 5xx để cổng gửi lại.
- **Phần được bảo vệ:** phía Tenant = tra tenant, trích mã, enqueue; phía Platform = dừng ở ghi `platform_payment_transactions` (giữ ADR-059 B2, tránh ghi giao dịch hai lần; `markInvoicePaid` nằm ngoài vùng bảo vệ).
- **Vận hành:** log `error` "could not release webhook_events row" nghĩa là lần gửi lại sẽ bị coi trùng → **phải đối soát tay theo `providerEventId`**.
- Không migration.

### 2.8. Dọn nhỏ (mục 8) ✅

- `PAYMENT_ENCRYPTION_KEY` phải là base64 đúng **32 byte** (`refine` trong `packages/config/src/env.ts`, kiểm bằng `Buffer.from(value, "base64").length === 32`); sai → app dừng khi khởi động (fail-fast).
- Sửa comment lỗi thời (không đổi hành vi).
- Xoá `confirmOrderManually` (`apps/web/lib/order.ts`): dùng `changeOrderStatusBySeller` ([[01-Architecture-Decisions/ADR-052-Studio-Order-Status-Change-Reopen-Late-Confirm|ADR-052 KB ≙ ADR-068]]). Metadata `lateDeclaredPaid` không còn được ghi; luồng mới ghi `lateConfirmation`. Test chuyển sang `changeOrderStatusBySeller`.

## 3. Test

Không thêm test case (trần 105/69): mở rộng case sẵn có. Số thật `pnpm test:count` = unit **105/105**, integration **69/69** ✅ Long chạy 2026-11-27 (khớp mốc trần).

## 4. Trạng thái xác minh

| Hạng mục | Mức |
| :-- | :-- |
| Code mục 1–5, 7, 8 (đọc trực tiếp: `product-file-preview.ts`, `webhook-event.ts`, `lock-reason.ts`, `email-dispatch.ts`, `env.ts`, `users/page.tsx`, `report-list.tsx`, `order.ts`, `subscription-billing.ts`) | ✅ đối chiếu 2026-11-27 |
| tsc, lint, integration của đợt này | 🟡 Quốc báo đã verify |
| Migration `20261127120000_adr074_email_send_log_tenant` đã áp | 🟡 Quốc báo (Long không truy DB) |
| Route xem trước trả 200 với dữ liệu thật; webhook 5xx + gửi lại bởi cổng thật | ❓ chưa thử |
| Production VPS đã migrate | ❓ chưa xác minh |

## 5. Liên kết

- [[02-System-Specs/Payment-And-Billing|Payment-And-Billing]] §5T — webhook, `email_send_log.tenantId`
- [[02-System-Specs/File-Storage-And-Downloads-Specs|File-Storage-And-Downloads-Specs]] §11.4 — xem trước qua RLS
- [[02-System-Specs/User-Management-System-Center-Specs|User-Management-System-Center-Specs]] §3.5 — tìm kiếm
- [[02-System-Specs/Abuse-Reports-Specs|Abuse-Reports-Specs]] §4.1 — lọc `tenantId`
- [[03-API-Contracts/Endpoint-Directory|Endpoint-Directory]] · [[03-API-Contracts/Database-Schema-Reference|Database-Schema-Reference]]
- [[01-Architecture-Decisions/ADR-057-User-Detail-Account-Actions-Session-Guard|ADR-057 KB (≙ ADR-073)]] — đợt trước

*Quay lại: [[MOC-Home]] (../00-Index/MOC-Home.md)*

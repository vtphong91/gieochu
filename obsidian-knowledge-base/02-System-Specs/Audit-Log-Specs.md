---
tags:
  - spec
  - audit-log
  - system-admin
  - tenant
  - security
  - database
  - status/living
date: 2026-10-16
updated: 2026-11-26
author: Long
---

# 📐 Đặc Tả: Audit Log (M12a — ADR-037)

> Quyết định gốc: **ADR-037** trong [`docs/DECISIONS.md`](../../docs/DECISIONS.md) — M12 chia 3 đợt deploy riêng: **M12a Audit
> log** (trang này) → M12b Thống kê (`tenant_daily_stats`) → M12c Báo cáo vi phạm (`abuse_reports` — [[02-System-Specs/Abuse-Reports-Specs|Abuse-Reports-Specs]], ADR-038/039). Bản trích KB:
> [[01-Architecture-Decisions/ADR-023-M12-Audit-Log-Append-Only|ADR-023 (≙ ADR-037)]]. ADR liên quan: ADR-010 (role `gieochu_app`), ADR-034 (một DB dùng chung),
> ADR-036 (cron hằng ngày).
>
> Mức xác minh: ✅ Long đã đối chiếu code working tree 2026-10-16 (code **đã commit `36103fb`**, deploy ❓) · 🟡 theo brief/báo cáo của Quốc
> · ❓ cần môi trường thật. Trạng thái migration: **đã áp lên DB dùng chung 2026-10-16** 🟡 (Quốc báo; Long không chạy lệnh DB).

---

## 1. Phạm vi M12a

- Bảng L1 `audit_logs` chỉ-INSERT, không khoá ngoại, giữ 12 tháng (ADR-037 mục 2–3) ✅.
- Thư viện ghi (`audit.log`) + dọn hạn (`audit.purgeExpired`) + loader đọc theo quyền ✅.
- Nối audit vào các hành động nghiệp vụ hiện có (§4) ✅.
- Hai trang xem: System Center `/admin/audit`, Studio `/studio/{slug}/activity` (ADR-037 mục 7) ✅.
- **Không** thuộc M12a: thống kê hằng ngày (M12b — [[02-System-Specs/Tenant-Stats-Specs|Tenant-Stats-Specs]]), báo cáo vi phạm (M12c — [[02-System-Specs/Abuse-Reports-Specs|Abuse-Reports-Specs]]), partition theo tháng (ADR-037 mục 4 — để sau).

---

## 2. Dữ liệu — bảng `audit_logs` ✅

Model Prisma `AuditLog` (`packages/db/prisma/schema.prisma`), migration `20261016090000_m12a_audit_logs`. Chi tiết cột, index, trigger,
quyền: [[03-API-Contracts/Database-Schema-Reference|Database-Schema-Reference]] (mục `audit_logs`).

- **Layer L1, không RLS.** Ghi và đọc bằng `getPrismaClient()`; quyền đọc của owner do loader tự kiểm (§5).
- **Không khoá ngoại** tới `users`/`tenants` — lịch sử bất biến, không chặn xoá dữ liệu khác; loader hiển thị "Người dùng đã xoá"
  khi `actorId` không còn khớp user.
- `scope` (enum `AuditScope`): `SYSTEM` — hành động cấp nền tảng (đăng nhập, quản trị hệ thống, thanh toán gói, job hệ thống);
  `TENANT` — thành viên tenant thao tác trong Studio; `CUSTOMER` — khách thao tác.
- `action` là **chuỗi**, không phải enum DB — danh sách hợp lệ là hằng `AUDIT_ACTIONS`; thêm action không cần DDL.
- `tenantId` có giá trị khi hành động thuộc một tenant — **owner thấy dòng đó ở Studio** (kể cả dòng scope `SYSTEM` như khoá tenant,
  thanh toán gói).
- `createdAt` lưu UTC; trang hiển thị theo `DISPLAY_TIME_ZONE`.

### 2.1. Chỉ INSERT — 2 lớp bảo vệ ✅ (đọc migration)

1. **Quyền:** role runtime `gieochu_app` chỉ có `SELECT, INSERT, DELETE` trên `audit_logs` (migration `REVOKE ALL` rồi cấp lại, vì
   `ALTER DEFAULT PRIVILEGES` của `setup-app-role.mts` tự cấp cả UPDATE cho bảng mới). `setup-app-role.mts` chạy lại sẽ cấp lại quyền
   mặc định nên có thêm bước `REVOKE UPDATE, TRUNCATE ON "audit_logs"` khi bảng tồn tại.
2. **Trigger** (áp cho mọi role trừ khi owner chủ động tắt trigger):
   - `audit_logs_block_update` — BEFORE UPDATE, luôn RAISE (mã `42501`);
   - `audit_logs_guard_delete` — BEFORE DELETE theo dòng, chỉ cho qua khi phiên đặt `gieochu.audit_purge = 'on'` **và**
     `createdAt` cũ hơn 12 tháng (so theo UTC); ngược lại RAISE `42501`;
   - `audit_logs_block_truncate` — BEFORE TRUNCATE, luôn RAISE.

Quyền DELETE chỉ để cron purge chạy được bằng role app; **cổng thật là trigger** — DELETE một mình không xoá được dòng nào.

Kiểm trên DB thật 2026-10-16 bằng role `gieochu_app` trong transaction rollback 🟡 (Quốc báo): UPDATE/TRUNCATE → permission denied;
DELETE, và DELETE có cờ purge với dòng mới → trigger `42501`; quyền đúng `DELETE, INSERT, SELECT`; đủ 3 trigger.

---

## 3. Thư viện

### 3.1. `@gieochu/core/audit` — `packages/core/src/audit/audit.ts` ✅

Hàm thuần, không phụ thuộc Prisma (client component import được nhãn). Cũng export lại ở `@gieochu/core`.

| Export | Vai trò |
| :-- | :-- |
| `AUDIT_SCOPES`, `isAuditScope`, `AUDIT_SCOPE_LABELS` | 3 scope + nhãn ("Hệ thống", "Gian hàng", "Khách hàng") |
| `AUDIT_ACTIONS` (52 — 27 từ M12a + 5 từ M12c/ADR-039 + 8 từ ADR-041 + 2 từ ADR-047 + 1 từ ADR-048 + 7 từ ADR-050 + 1 từ ADR-051 + 1 từ ADR-054), `isAuditAction`, `AUDIT_ACTION_LABELS`, `auditActionLabel` | Danh sách action + nhãn tiếng Việt; action lạ hiển thị nguyên chuỗi |
| `sanitizeAuditMetadata` | Thay giá trị khoá nhạy cảm (khớp `pass(word)`, `secret`, `token`, `hash`, `authorization`, `cookie`, `api key`, `private key`, `signature`, `otp`) bằng `"[REDACTED]"` ở mọi độ sâu; bỏ giá trị không phải JSON; giới hạn độ sâu 4, 40 khoá, 50 phần tử mảng, chuỗi 500 ký tự; JSON > 4096 byte → chỉ còn `{ truncated: true }`. Không bao giờ ném |
| `maskEmail` | `nguyen@gmail.com` → `n***@gmail.com` |
| `extractAuditIp`, `normalizeAuditUserAgent` | IP = phần tử đầu `x-forwarded-for` (hoặc `x-real-ip`), cắt 64 ký tự; User-Agent cắt 512 |

### 3.2. `apps/web/lib/audit.ts` — ghi ✅

- **`audit.log(input)`** → `Promise<boolean>`. Nguyên tắc:
  - **Ghi sau khi nghiệp vụ commit, ngoài transaction nghiệp vụ** (lựa chọn có chủ đích): lỗi audit không rollback nghiệp vụ; đổi lại,
    process chết giữa commit và lệnh ghi thì mất 1 dòng audit (chấp nhận với MVP).
  - **Lỗi không ném** — chỉ `logger`; bảng chưa tồn tại (P2021/42P01, code lên trước migration) → `logger.warn` và bỏ qua.
  - `metadata` luôn qua `sanitizeAuditMetadata`. Nơi gọi vẫn phải tự giữ §7.9: hành động của tenant chỉ ghi id, không email khách/chi
    tiết đơn.
  - `ip`/`userAgent`: `undefined` → tự lấy từ request hiện tại qua `headers()`; `null` → không ghi; ngoài phạm vi request (cron, job,
    test) → null. Route Handler dùng `auditMetaFromRequest(request)`.
- **`audit.purgeExpired()`** → `{ deleted, skipped }`: một transaction `SET LOCAL gieochu.audit_purge = 'on'` rồi
  `DELETE ... WHERE "createdAt" < now() UTC - 12 months`. Bảng chưa có → `{ deleted: 0, skipped: true }`; lỗi khác ném (cron bọc bước).
- `isAuditTableMissing(error)` dùng chung cho ghi, purge và loader.

### 3.3. Chữ ký hàm lib thay đổi ✅

Các hàm lib nghiệp vụ thêm tham số cuối **`actorId: string | null = null`** (tuỳ chọn): `archiveProduct`,
`confirmOrderManually`, `markOrderRefunded`, `grantExtraDownloads`, `revokeEntitlement`, `createShareLink`, `revokeShareLink`,
`hideReview`, `unhideReview`, `confirmManualInvoicePayment`, `testPlatformProviderConnection`; input lưu cấu hình thanh toán (platform,
tenant) thêm trường `actorId?`. `markInvoicePaid(invoiceId, { source, actorId? })` thêm `source` (`PLATFORM_WEBHOOK` mặc định |
`ADMIN_MANUAL_CONFIRM`). **`unlockUser(actor, targetUserId)`** — đổi chữ ký, `actor` bắt buộc. Server Action gọi các hàm này đều
truyền `user.userId`/`actor.userId`. Mới: `auditMarkOrderPaid(tenantId, orderId, result, source)` (`lib/order.ts`) — gọi sau commit của
`markOrderPaid`; `MarkOrderPaidResult` thêm `couponOverused`.
Từ M12c (ADR-038, 2026-10-17) ✅: **`publishProduct(tenantId, productId, actorId, { rightsConfirmed })`** — `actorId` thành tham số **bắt buộc**
(kiểu `string | null`) kèm options cam kết bản quyền. Khoá/mở khoá tenant gom về `apps/web/lib/tenant-lock.ts` (`lockTenant`, `unlockTenant`,
`lockTenantInTx` + `auditTenantLocked`) — dùng chung cho `/admin/tenants` và xử lý báo cáo.

---

## 4. Action và nơi ghi ✅ (grep `audit.log(` 2026-10-16; cập nhật M12c 2026-10-17; cập nhật ADR-041 2026-10-17; cập nhật ADR-047 2026-10-18; cập nhật ADR-048 2026-10-23; cập nhật ADR-050 2026-10-23; cập nhật ADR-051 + ADR-054 2026-10-24)

**67** action trong `AUDIT_ACTIONS` ✅ (đếm working tree 2026-11-26 sau ADR-073: +4 ở ADR-073 — `USER_SESSIONS_REVOKED`, `USER_PASSWORD_RESET_REQUIRED`, `USER_PHONE_VIEWED`, `USER_VERIFICATION_RESENT`; `USER_LOCKED`/`USER_UNLOCKED` có từ M12a, đợt này chỉ thêm metadata; **63** đếm working tree 2026-11-26 trước ADR-073: +1 ở ADR-071 — `SUBSCRIPTION_INVOICE_CREATED`; **62** đếm 2026-11-25: +2 ở ADR-067 — `SUBSCRIPTION_INVOICE_VOIDED`, `SUBSCRIPTION_INVOICE_REOPENED`; +2 ở ADR-068 —
`ORDER_CANCELED_BY_SELLER`, `ORDER_REOPENED_BY_SELLER`; trước đó **58** đếm 2026-10-27 (HEAD `c7891f0` vẫn 58 ✅): +2 ở khách vãng lai — `AUTH_GUEST_ACCOUNT_CREATED`, `AUTH_GUEST_ACTIVATED`; +4 ở ADR-061/062 — `ORDER_PAYMENT_EMAIL_SENT`, `ORDER_CUSTOMER_DECLARED_PAID`, `ORDER_CUSTOMER_DECLARED_PAID_UNDONE`, `ORDER_CANCELED_BY_CUSTOMER`; trước đó **52** đếm 2026-10-24, sau ADR-051 của vuong + ADR-054; 50 ở 2026-10-23 sau ADR-050): 21 theo đặc tả §"M12" + 6 bổ sung ở M12a (trước đây chỉ ghi `logger`) + 5 ở
M12c/ADR-039 + 8 ở ADR-041 (Hồ sơ, Bảng giá CMS, hoàn tiền gói) + 2 ở ADR-047 (ghi chú nội bộ đơn) + 1 ở ADR-048 (ghi chú khách) + 7 ở ADR-050 (CMS trang chủ, menu, văn bản pháp lý) + 1 ở ADR-051 (`PRODUCT_DELETED` — vuong, commit `c63b72b`) + 1 ở ADR-054 (`LEGAL_DOCUMENT_META_UPDATED`) + 6 ở ADR-061/062 + 2 ở ADR-067 + 2 ở ADR-068 + 1 ở ADR-071 + 4 ở ADR-073. Thêm action không
cần DDL (`action` là chuỗi).

| Action | Scope | Nơi ghi | Actor |
| :-- | :-- | :-- | :-- |
| `AUTH_LOGIN` | SYSTEM | `api/auth/login/route.ts` | user |
| `AUTH_LOGIN_FAILED` | SYSTEM | `api/auth/login/route.ts` — `reason`: `ACCOUNT_LOCKED`, `PASSWORD_RESET_REQUIRED`, `WRONG_PASSWORD` (+ `failedAttempts`, `lockedOut`), `EMAIL_NOT_VERIFIED`, **`GUEST_NOT_ACTIVATED`** (ADR-061 Q1 — tài khoản tạo lúc mua chưa đặt mật khẩu; không tăng đếm sai) | user (tài khoản có thật) |
| `AUTH_GUEST_ACCOUNT_CREATED` | SYSTEM | `lib/guest-checkout.ts` `startGuestCheckout` — `targetType: "User"`, metadata `{ tenantId, legalVersions }` (số bản pháp lý đã ghi chấp thuận), kèm IP/UA. Nhãn "Tạo tài khoản khi mua (khách vãng lai)" (ADR-061 Q1, 2026-10-27 working tree) | chính user vừa tạo |
| `AUTH_GUEST_ACTIVATED` | SYSTEM | `lib/guest-checkout.ts` `activateGuestAccount` (trang `/verify-email/dat-mat-khau`). Nhãn "Kích hoạt tài khoản và đặt mật khẩu" | user |
| `AUTH_REFRESH_REUSE` | SYSTEM | `api/auth/refresh/route.ts` — metadata `revokedSessions` | user |
| `USER_LOCKED` | SYSTEM (+`targetType: "User"`) | `lib/admin-users.ts` `lockUser` (ADR-073 ✅ code) — metadata `{ reason, previousStatus, revokedSessions, emailSent }`; `reason` là lý do quản trị viên nhập (≤ 500 ký tự), không phải ghi chú nội bộ. Nhãn "Khoá người dùng" | admin |
| `USER_UNLOCKED` | SYSTEM (+`targetType: "User"`) | `lib/admin-users.ts` `unlockUser` (ADR-073 ✅ code) — metadata `{ reason, newStatus, emailSent }`; `newStatus` = `ACTIVE` hoặc `PENDING` (chưa xác minh email). Bản ghi cũ không có `newStatus` → hiểu là `ACTIVE`. Nhãn "Mở khoá người dùng" | admin |
| `USER_SESSIONS_REVOKED` | SYSTEM (+`targetType: "User"`) | `lib/admin-users.ts` `revokeUserSessions` (ADR-073) — metadata `{ revokedSessions }`. Nhãn "Đăng xuất mọi thiết bị của người dùng" | admin |
| `USER_PASSWORD_RESET_REQUIRED` | SYSTEM (+`targetType: "User"`) | `lib/admin-users.ts` `requestUserPasswordReset` (ADR-073) — metadata `{ revokedSessions, emailSent }`, **không có `reason`**. Ghi sau khi gửi email. Nhãn "Yêu cầu người dùng đặt lại mật khẩu" | admin |
| `USER_PHONE_VIEWED` | SYSTEM (+`targetType: "User"`) | `lib/admin-users.ts` `revealUserPhone` (ADR-073) — không metadata. Ghi **trước** khi trả số; ghi lỗi → không trả số (503). Nhãn "Xem số điện thoại đầy đủ của người dùng" | admin |
| `USER_VERIFICATION_RESENT` | SYSTEM (+`targetType: "User"`) | `lib/admin-users.ts` `resendVerificationForUser` (ADR-073) — metadata `{ emailSent: true }`, ghi sau khi gửi. Nhãn "Gửi lại email kích hoạt" | admin |
| `TENANT_CREATED` | TENANT | `lib/create-tenant.ts` | user tạo |
| `TENANT_LOCKED` / `TENANT_UNLOCKED` | SYSTEM (+`tenantId`) | `lib/tenant-lock.ts` — gọi từ `app/admin/tenants/actions.ts`. **Từ ADR-072 (KB ADR-056, 2026-11-26, ✅ code, chưa commit)**: metadata `{ reason, previousStatus }` — `reason` là lý do quản trị viên nhập (bắt buộc, ≤ 500 ký tự), cũng là nội dung gửi cho chủ gian hàng; mở khoá luôn về `ACTIVE`. `TENANT_LOCKED` còn ghi khi xử lý báo cáo `LOCK_TENANT` (metadata `source: "ABUSE_REPORT"`, `reason` = nhãn loại vi phạm, `reportType`, `previousStatus`; chỉ khi tenant chưa khoá; luồng này **không** gửi email `tenant_locked`) | admin |
| `TENANT_SLUG_CHANGED` | TENANT | `app/studio/[tenantSlug]/settings/actions.ts` — `{ from, to }` | thành viên |
| `PLAN_CREATED` / `PLAN_UPDATED` | SYSTEM | `app/admin/plans/actions.ts` (tạo, sửa, bật/tắt) | admin |
| `SUBSCRIPTION_PAID` | SYSTEM (+`tenantId`) | `lib/subscription-billing.ts` — 3 nơi ghi, phân biệt bằng `metadata.source` (ADR-059, ✅ đọc code 2026-10-26, đã commit `fa29d99`): `markInvoicePaid` (`PLATFORM_WEBHOOK` hoặc `ADMIN_MANUAL_CONFIRM`; metadata `provider`, `planId`, `previousPlanId`, `amountVnd`, `periodEnd`, `reactivated`); `confirmExpiredManualInvoice` (`ADMIN_MANUAL_CONFIRM` + `previousInvoiceStatus: "EXPIRED"`, `lateConfirmation: true`, `dueAt`, `storedPeriodStart/End`, `periodRecomputed: true`, `periodStart/End`); `confirmInvoiceFromPlatformTransaction` (**`ADMIN_TRANSACTION_CONFIRM`** + `transactionId`, `transactionProvider`, `receivedAmountVnd`, `differenceVnd`, kèm metadata trễ nếu hoá đơn EXPIRED, không thì `periodEnd`). Không thêm action mới. Từ ADR-066 (2026-11-24, working tree ✅ code): `ADMIN_MANUAL_CONFIRM` áp cho **mọi cổng** (cả SePay/MoMo) và có thêm khoá **`note`** khi admin nhập ghi chú (trim, ≤ 500 ký tự; trống → không có khoá). Từ ADR-067: lựa chọn "Đã thanh toán" trong hộp "Đổi trạng thái…" ghi đúng action này (cùng `confirmManualInvoicePayment`) | null (webhook) hoặc admin (xác nhận tay / từ giao dịch) |
| `SUBSCRIPTION_INVOICE_CREATED` | SYSTEM (+`tenantId`) | `lib/subscription-billing.ts` `createRenewalInvoice` (ADR-071, 2026-11-26 working tree ✅ code) — **chỉ khi tạo hoá đơn mới** (dùng lại hoá đơn chờ → không ghi), sau commit; `targetType: "SubscriptionInvoice"`, metadata `{ code, planId, provider, amountVnd }`. Nhãn "Tạo hoá đơn gói dịch vụ". Hoá đơn tạo trước ADR-071 không có dòng này — nhật ký chi tiết suy ra mốc tạo (Payment-And-Billing §5R) | chủ gian hàng bấm gia hạn (`renewSubscriptionAction` truyền `actorId`); null khi script/test |
| `SUBSCRIPTION_INVOICE_VOIDED` | SYSTEM (+`tenantId`) | `lib/subscription-billing.ts` `voidSubscriptionInvoice` (ADR-067, 2026-11-25, đã commit `2ccc2fc` ✅ code) — `targetType: "SubscriptionInvoice"`, metadata `{ code, provider, amountVnd, fromStatus, toStatus: "VOID", note? }`. Nhãn "Huỷ hoá đơn gói dịch vụ" | admin |
| `SUBSCRIPTION_INVOICE_REOPENED` | SYSTEM (+`tenantId`) | `lib/subscription-billing.ts` `reopenSubscriptionInvoice` (ADR-067) — metadata `{ code, provider, amountVnd, fromStatus, toStatus: "PENDING", dueAt, periodStart, periodEnd, note? }`. Nhãn "Mở lại hoá đơn gói dịch vụ" | admin |
| `PAYMENT_CONFIG_UPDATED` | SYSTEM | `lib/platform-payment.ts` (lưu cấu hình; kiểm tra kết nối thành công tự bật) — chỉ cờ thay đổi, không secret | admin |
| `PAYMENT_CONFIG_UPDATED` | TENANT | `lib/tenant-payment.ts` (lưu cấu hình; từ 2026-11-24 cả "Kiểm tra kết nối" SePay thành công tự bật — `testTenantProviderConnection`, metadata `verified: true`, `wasEnabled`) | thành viên |
| `PRODUCT_PUBLISHED` / `PRODUCT_ARCHIVED` | TENANT | `lib/product.ts` | thành viên |
| `PRODUCT_DELETED` | TENANT | `lib/product.ts` `deleteProduct` (sau transaction xoá) — `targetType: "Product"`, `targetId` = id tài liệu, metadata `{ title, slug, deletedFilesCount, freedStorageBytes }`. Nhãn "Xoá tài liệu" (ADR-051 — vuong; nghiệp vụ ở [[01-Architecture-Decisions/ADR-037-Product-Archive-Deletion-Storage-Cleanup|ADR-037 KB]]) ✅ code | thành viên |
| `ORDER_MANUALLY_CONFIRMED` / `ORDER_REFUNDED` | TENANT | `lib/order.ts` — từ đợt 1 ADR-061/062 (2026-10-27, chưa commit) metadata xác nhận tay thêm **`lateDeclaredPaid`** (xác nhận khi đơn đã hết hạn — chỉ được nhờ ngoại lệ "khách báo chuyển trước hạn") và **`customerDeclaredPaid`** (khách đã bấm "Tôi đã chuyển khoản"). Từ ADR-068 (2026-11-25 ✅ code), xác nhận qua "Đổi trạng thái…" ghi `ORDER_MANUALLY_CONFIRMED` với metadata `{ source: "SELLER_STATUS_CHANGE", previousStatus, fromStatus, toStatus: "PAID", fulfilled, lateConfirmation, customerDeclaredPaid }` — **không** chứa ghi chú (hàm cũ `confirmOrderManually` vẫn ghi metadata kiểu ADR-061/062, không có `source`). ADR-068 mục 9: chi tiết đơn Studio dùng sự có mặt của dòng này để hiện kênh "Xác nhận thủ công" khi không có ghi chú | thành viên |
| `ORDER_CANCELED_BY_SELLER` | TENANT | `lib/order.ts` `sellerCancelOrder` (qua `changeOrderStatusBySeller`, ADR-068) — `targetType: "Order"`, metadata **chỉ** `{ fromStatus, toStatus }` (không ghi chú — §7.9). Nhãn "Người bán huỷ đơn". Có trong dòng thời gian đơn Studio | thành viên |
| `ORDER_REOPENED_BY_SELLER` | TENANT | `lib/order.ts` `sellerReopenOrder` (ADR-068) — metadata `{ fromStatus, toStatus, holdStartedAt, expiresAt }` (mốc giữ + hạn giữ mới — `holdStartedAt` thêm ở mục 8), không ghi chú. Nhãn "Người bán mở lại đơn". Có trong dòng thời gian đơn Studio | thành viên |
| `ORDER_PAYMENT_EMAIL_SENT` | SYSTEM (+`tenantId`) | `lib/order-customer.ts` `notifyCustomerOfPaymentInstructions` — ghi **trước** khi gửi email hướng dẫn thanh toán cho khách; metadata `{ provider, kind: "INSTRUCTIONS" }`; **số dòng của đơn = bộ đếm giới hạn 3 email/đơn**. Nhãn "Gửi email hướng dẫn thanh toán cho khách" (ADR-061/062) | null |
| `ORDER_CUSTOMER_DECLARED_PAID` / `ORDER_CUSTOMER_DECLARED_PAID_UNDONE` | CUSTOMER (+`tenantId`) | `lib/order-customer.ts` `declareOrderPaid` / `undoDeclareOrderPaid` — `targetType: "Order"`, metadata `{ provider }`. Nhãn "Khách báo đã chuyển khoản" / "Khách huỷ báo đã chuyển khoản" (ADR-062 Q1). Có trong dòng thời gian đơn Studio | khách |
| `ORDER_CANCELED_BY_CUSTOMER` | CUSTOMER (+`tenantId`) | `lib/order-customer.ts` `cancelOrderByCustomer` — metadata `{ provider }`. Nhãn "Khách huỷ đơn" (ADR-062 Q4). Có trong dòng thời gian đơn Studio | khách |
| `COUPON_OVERUSED` | SYSTEM (+`tenantId`) | `lib/order.ts` `auditMarkOrderPaid` — gọi từ thanh toán 0đ, xác nhận tay, `payment-process.ts` (webhook) | null |
| `ENTITLEMENT_EXTRA_GRANTED` / `ENTITLEMENT_REVOKED` | TENANT | `lib/entitlement.ts` | thành viên |
| `ORDER_NOTE_ADDED` / `ORDER_NOTE_DELETED` | TENANT | `lib/order-note.ts` (`addOrderNote`, `deleteOrderNote` — sau commit) — `targetType: "Order"`, `targetId` = id đơn, metadata **chỉ `{ noteId }`**, **không** nội dung ghi chú (ADR-047). Nhãn: "Thêm ghi chú nội bộ cho đơn" / "Xoá ghi chú nội bộ của đơn". Không nằm trong danh sách audit của timeline đơn (`ORDER_TIMELINE_AUDIT_ACTIONS`) — timeline hiện ghi chú qua kind `note` | thành viên (tác giả) |
| `CUSTOMER_NOTE_UPDATED` | TENANT | `lib/customer-list.ts` `updateCustomerNote` (gọi từ `customers/actions.ts` `saveCustomerNoteAction` — sau commit) — `targetType: "TenantCustomer"`, `targetId` = userId khách, metadata **chỉ `{ customerUserId }`**, **không** nội dung ghi chú (ADR-048); gồm cả xoá (ghi chú rỗng → `null`); nội dung không đổi → **không ghi**. Nhãn: "Cập nhật ghi chú khách hàng" | thành viên |
| `SHARE_LINK_CREATED` / `SHARE_LINK_REVOKED` | TENANT | `lib/share-link.ts` | thành viên |
| `REVIEW_HIDDEN` / `REVIEW_RESTORED` | TENANT | `lib/review.ts` `hideReview`/`unhideReview` | thành viên |
| `REVIEW_RESTORED` | CUSTOMER | `lib/review.ts` — đánh giá hiện lại khi khách mua lại (`reason: "REPURCHASE"`) | khách |
| `REPORT_SUBMITTED` | CUSTOMER (đã đăng nhập) / SYSTEM (khách vãng lai) — **`tenantId = null` có chủ đích** | `lib/abuse-report.ts` `submitAbuseReport` — metadata id/loại đối tượng, `targetTenantId`, `guest`; không email/mô tả | người báo cáo hoặc null |
| `REPORT_RESOLVED` | SYSTEM, `tenantId = null` | `lib/abuse-report.ts` `resolveAbuseReport` — metadata `decision`, `status`, `targetTenantId`, `alsoResolved`; không email/ghi chú | admin |
| `CONTENT_MODERATION_LOCKED` / `CONTENT_MODERATION_UNLOCKED` | SYSTEM (+`tenantId` — chủ gian hàng thấy ở Studio, actor hiện "Quản trị hệ thống") | `lib/abuse-report.ts` (`resolveAbuseReport` khi ẩn/lưu trữ; `unlockModeration`) | admin |
| `REMEDY_FINAL_DOWNLOAD_CHOSEN` / `REMEDY_REFUND_REQUESTED` | CUSTOMER (+`tenantId`) | `lib/entitlement-remedy.ts` (`chooseFinalDownload`, `requestRefund`) — metadata `productId`, `orderId` (+`grantedDownloads`); không email | khách |
| `AUTH_PASSWORD_CHANGED` | CUSTOMER | `lib/account-security.ts` `changePassword` — metadata `revokedOtherSessions` (số phiên khác bị thu hồi) | user |
| `AUTH_EMAIL_CHANGE_REQUESTED` | CUSTOMER | `lib/account-security.ts` `requestEmailChange` — metadata `newEmail` **đã che** (`maskEmail`) | user |
| `AUTH_EMAIL_CHANGED` | CUSTOMER | `lib/account-security.ts` `confirmEmailChange` — metadata `from`/`to` **đã che**; actor = chủ tài khoản (xác nhận được khi chưa đăng nhập) | user |
| `PRICING_CMS_UPDATED` | SYSTEM | `app/admin/cms/pricing/actions.ts` (`logChange`) — `targetType: "CmsPage"`, `targetId: "pricing"`, metadata chỉ `operation` (`SAVE_DRAFT`/`PUBLISH`/`RESTORE_LIVE`) | admin |
| `SUBSCRIPTION_REFUND_REQUESTED` | SYSTEM (+`tenantId`) | `lib/subscription-refund.ts` `requestSubscriptionRefund` — metadata `invoiceId`, `amountVnd`; **không** thông tin nhận tiền | chủ gian hàng |
| `SUBSCRIPTION_REFUNDED` | SYSTEM (+`tenantId`) | `lib/subscription-refund.ts` `approveRefundRequest` — metadata `invoiceId`, `amountVnd`, `previousPlanId` | admin |
| `SUBSCRIPTION_REFUND_REJECTED` | SYSTEM (+`tenantId`) | `lib/subscription-refund.ts` `rejectRefundRequest` | admin |
| `SUBSCRIPTION_REFUND_PAYOUT_VIEWED` | SYSTEM | `lib/subscription-refund.ts` `revealRefundPayout` (nút "Xem đầy đủ" ở `/admin/billing/refunds`) — **chỉ id**, không số tài khoản | admin |
| `HOME_CMS_UPDATED` | SYSTEM | `app/admin/cms/home-editor/actions.ts` (`logChange`) — `targetType: "CmsPage"`, `targetId: "home"`, metadata chỉ `operation` (`SAVE_DRAFT`/`PUBLISH`/`RESTORE_LIVE`; khôi phục khi chưa có dòng → không ghi). Nhãn "Cập nhật trang chủ" (ADR-050) | admin |
| `MENU_CMS_UPDATED` | SYSTEM | `app/admin/cms/menu/actions.ts` (`logChange`) — `targetType: "CmsPage"`, `targetId: "menu"`, metadata chỉ `operation` như trên. Nhãn "Cập nhật menu header/footer" (ADR-050) | admin |
| `LEGAL_VERSION_CREATED` / `LEGAL_VERSION_UPDATED` / `LEGAL_REVIEW_STATUS_CHANGED` / `LEGAL_VERSION_PUBLISHED` / `LEGAL_VERSION_ARCHIVED` | SYSTEM | `app/admin/cms/phap-ly/actions.ts` (`logChange`, sau khi lib ghi xong) — `targetType: "LegalDocumentVersion"`, `targetId` = id phiên bản, metadata `{ key, version }` + `reviewStatus` (đổi rà soát) / `effectiveAt` ISO (xuất bản); **không** nội dung văn bản. Nhãn: "Tạo phiên bản văn bản pháp lý", "Sửa bản nháp văn bản pháp lý", "Đổi trạng thái rà soát pháp lý", "Xuất bản văn bản pháp lý", "Lưu trữ văn bản pháp lý" (ADR-050). Ghi chấp thuận khi đăng ký **không** audit | admin |
| `LEGAL_DOCUMENT_META_UPDATED` | SYSTEM | `app/admin/cms/phap-ly/actions.ts` `saveLegalDocumentMetaAction` — `targetType: "LegalDocument"`, `targetId` = **khoá** văn bản (vd `privacy`), metadata `{ key, hasSummary, hasSeoTitle, hasSeoDescription }` (chỉ cờ, **không** nội dung). Nhãn "Cập nhật mô tả/SEO văn bản pháp lý" (ADR-054). Ghi chấp thuận khi đăng ký/mở gian hàng **không** audit | admin |
| `SYSTEM_SETTINGS_UPDATED` | SYSTEM | `lib/system-settings.ts` (form "Cấu hình chung", metadata `changes` cũ→mới) và `app/admin/settings/actions.ts` (email hỗ trợ) | admin |

**Có trong `AUDIT_ACTIONS` nhưng chưa nối:**
- `ADMIN_VIEWED_TENANT` — ADR-037 mục 7 yêu cầu ghi khi admin mở trang chi tiết tenant; **chưa có trang chi tiết tenant**.

**Vẫn chỉ `logger` (không vào `audit_logs`):** `REVIEW_HIDDEN_REFUNDED` (tự ẩn đánh giá khi hoàn tiền).

**Cố ý không ghi:** đăng nhập với email **không tồn tại** — bảng chỉ-INSERT giữ 12 tháng, tránh bị spam dòng bằng email ngẫu nhiên và
không lưu email người lạ.

**Chưa audit:** thay đổi cấu hình SMTP, storage, Cloudinary, thương hiệu ở System Center (BACKLOG); đổi/gỡ ảnh đại diện và sửa hồ sơ
(ADR-041 — kế hoạch nêu `PROFILE_AVATAR_CHANGED` là tuỳ chọn, code không thêm ✅); "Đăng xuất mọi thiết bị" (`logoutAllDevicesAction`) ✅.

**Kiểm dữ liệu thật ADR-041** 🟡 (Hiếu báo 2026-10-17, gọi lib trực tiếp, email mock): reveal thông tin nhận tiền ghi audit chỉ id; dữ liệu
tạm đã dọn, **dòng audit để lại** theo ADR-037 (bảng chỉ-INSERT).

---

## 5. Đọc — `apps/web/lib/audit-query.ts` ✅

Bộ lọc từ query string (form GET): `actor`, `action`, `tenant`, `from`, `to` (`YYYY-MM-DD`, hiểu theo giờ Việt Nam UTC+7, `to` tính hết
ngày), `page`, `pageSize` ∈ {10, 20, 50, 100} (mặc định 20). Sắp `createdAt desc, id desc`, phân trang offset (`skip`/`take` + `count`).
Bảng chưa tồn tại → `{ status: "unavailable" }` (trang hiện thông báo, không 500).

### 5.1. Admin — `listAuditLogs(sp)`

- Tự `requireRole("SYSTEM_ADMIN")` (không tin trang gọi).
- Lọc `actor` theo email (có `@`) hoặc id; `tenant` theo slug hoặc id; không khớp → danh sách rỗng kèm `unmatchedFilter`.
- Che theo §7.9: dòng scope `CUSTOMER` → actor hiện email đã che (`maskEmail`), **ẩn IP/User-Agent**. Dòng khác hiện email + họ tên,
  phân loại `ADMIN`/`USER`; actor null → "Hệ thống".

### 5.2. Owner — `listTenantAuditLogs(tenantId, sp)`

- `requireUser()` + đọc `tenant_members` qua `withTenant`; chỉ **OWNER** (`canManageTenant`) — khác → `forbidden`.
- Truy vấn **luôn** `where: { tenantId }`; bỏ qua bộ lọc `actor`/`tenant`.
- Che actor: thành viên tenant → email + họ tên + IP/User-Agent; admin hệ thống hoặc dòng scope `SYSTEM` → "Quản trị hệ thống" (không
  lộ admin cụ thể); người khác (khách, cựu thành viên) → email đã che; IP/User-Agent chỉ hiện khi actor là thành viên.
- **Metadata hiện nguyên** (`<details>` key–value, `admin/_ui/audit-log.tsx`) → ghi chú admin (`note`) của `SUBSCRIPTION_PAID` / `SUBSCRIPTION_INVOICE_VOIDED` /
  `SUBSCRIPTION_INVOICE_REOPENED` **hiện ở Studio → Hoạt động** của gian hàng đó ✅ code. Chủ dự án xác nhận **giữ** hành vi này (ADR-067 "Bổ sung", 2026-11-25) 🟡 —
  admin cần tránh ghi thông tin không muốn chủ gian hàng đọc.

`audit_logs` không có RLS — **mọi đường đọc audit đi qua `lib/audit-query.ts`** (BACKLOG). **Ngoại lệ** (Quốc chấp nhận 2026-11-25, KB-Audit §52 mục 2): trang chi tiết
đơn hàng gói `/admin/subscriptions/[subscriptionId]` (ADR-069) đọc audit của **hoá đơn gói / yêu cầu hoàn tiền gói** của một gian hàng qua `getAdminSubscriptionDetail`
(`lib/subscription-billing.ts`); hàm không tự kiểm quyền — **quyền do page guard** (`requireAdminAccess`, SYSTEM_ADMIN), cùng mẫu `listSubscriptions`/`listSubscriptionInvoices`;
chỉ lấy `fromStatus`/`toStatus`/`note` ✅ code — [[02-System-Specs/Payment-And-Billing|Payment-And-Billing]] §5P. **Từ ADR-071 (2026-11-26, working tree)** nhật ký này đọc thêm khoá metadata `source`, `lateConfirmation`, `previousInvoiceStatus`, `receivedAmountVnd`, `transactionId` (để suy nguồn/số tiền/giao dịch), cùng `platform_payment_transactions` (5 trường trích, không `rawPayload`) và `email_send_log` (5 loại `subscription_invoice_*`) — vẫn L1, cùng ngoại lệ, quyền do page guard ✅ code — Payment-And-Billing §5R.

---

## 6. Giữ 12 tháng — cron ✅

`GET /api/cron/daily` (ADR-036) thêm bước **`audit.purge`** → `audit.purgeExpired()`, đặt **trước** `queue.drain`; kết quả
`auditPurge: { ok, result: { deleted, skipped } }` trong response, bước lỗi làm route trả 500 `CRON_STEP_FAILED` nhưng không bỏ bước
khác. Contract: [[03-API-Contracts/Endpoint-Directory|Endpoint-Directory]] §17. Purge hiện xoá một lệnh, chưa chia lô (BACKLOG).

---

## 7. Giao diện ✅ (đọc code; bố cục chi tiết ở [[04-Operations-Runbooks/UI-Design-System|UI-Design-System]] §15)

| Trang | Guard trang | Loader | Menu |
| :-- | :-- | :-- | :-- |
| `/admin/audit` — "Nhật ký hệ thống" | `requireAdminAccess` | `listAuditLogs` | Sidebar System Center nhóm **"Giám sát"** → "Nhật ký hệ thống" |
| `/studio/{slug}/activity` — "Hoạt động" | `requireTenantMemberPage` | `listTenantAuditLogs` (chỉ OWNER) | Sidebar Studio "Hoạt động" (giữa "Gói dịch vụ" và "Cài đặt") — **chỉ hiện với OWNER** |

Admin lọc được người thực hiện, hành động, gian hàng, khoảng ngày; Studio lọc hành động, khoảng ngày. Mục "Hoạt động" trong sidebar
Studio **chỉ hiện khi vai trò là OWNER** (`role` từ `requireTenantMemberPage` trong `studio/[tenantSlug]/layout.tsx`), khớp quyền loader
(ADR-037 bổ sung) ✅ đọc code. Vai trò khác gõ thẳng URL vẫn bị loader chặn `forbidden`.

---

## 8. Test

- Trần integration nâng **53 → 55** (`scripts/count-tests.mjs`, ADR-037 mục 6) cho đúng 2 test M12 của §9 (M12a: audit; M12b: thống kê).
  Unit giữ trần 94. `pnpm test:count` (Long chạy 2026-10-16, chỉ đếm): **93/94 unit, 53/55 integration** ✅ sau M12a; sau M12b
  (`stats.test.ts`) là **93/94 unit, 54/55 integration** ✅.
- `apps/web/tests/integration/audit.test.ts` — `describe("M12 audit")`, 1 case: đăng nhập sai rồi đúng, khoá/mở khoá user, metadata nhạy
  cảm bị `[REDACTED]`, IP lấy phần tử đầu `x-forwarded-for`, UPDATE (Prisma + raw) bị chặn, DELETE (có/không cờ purge) bị chặn,
  `purgeExpired` không chạm dòng mới ✅ đọc code. **Đã chạy pass 2026-10-16 trên DB thật** 🟡 (Quốc báo).
- Hệ quả ADR-034: dòng audit do test tạo **không xoá được**, tồn tới 12 tháng. Lượt chạy 2026-10-16 để lại 5 dòng giả
  (`AUTH_LOGIN`, `AUTH_LOGIN_FAILED`, `SYSTEM_SETTINGS_UPDATED`, `USER_LOCKED`, `USER_UNLOCKED`, email `@example.com`) 🟡; user tạm đã
  dọn. Mọi integration test khác gọi hàm nghiệp vụ có audit cũng để lại dòng.

---

## 9. Giới hạn đã biết (chi tiết `docs/BACKLOG.md` mục "Phát sinh trong đợt M12a")

- `ADMIN_VIEWED_TENANT`, `REPORT_RESOLVED`, `REVIEW_HIDDEN_REFUNDED` chưa vào bảng; khoá user đã có ô lý do từ ADR-073 (§4) (đặc tả §"M2" muốn
  "USER_LOCKED + lý do").
- Purge một lệnh, chưa partition, phân trang offset — chậm khi bảng lớn.
- Ô lọc action ở Studio liệt kê cả action cấp hệ thống.
- Hành vi trên Vercel production (cron purge, ghi audit trong Server Action thật) ❓ — code chưa deploy.

---

## 10. Liên kết

* [[02-System-Specs/Background-Jobs-Specs|Background-Jobs-Specs]] §5 — cron hằng ngày ([Background-Jobs-Specs.md](./Background-Jobs-Specs.md))
* [[02-System-Specs/Tenant-Stats-Specs|Tenant-Stats-Specs]] — M12b thống kê, cùng ADR-037 ([Tenant-Stats-Specs.md](./Tenant-Stats-Specs.md))
* [[02-System-Specs/User-Management-System-Center-Specs|User-Management-System-Center-Specs]] — System Center, khoá user ([User-Management-System-Center-Specs.md](./User-Management-System-Center-Specs.md))
* [[02-System-Specs/Reviews-Specs|Reviews-Specs]] §2.1 — audit ẩn/khôi phục đánh giá ([Reviews-Specs.md](./Reviews-Specs.md))
* [[03-API-Contracts/Database-Schema-Reference|Database-Schema-Reference]] — bảng `audit_logs` ([Database-Schema-Reference.md](../03-API-Contracts/Database-Schema-Reference.md))
* [[03-API-Contracts/Endpoint-Directory|Endpoint-Directory]] §17–§18 ([Endpoint-Directory.md](../03-API-Contracts/Endpoint-Directory.md))
* [[04-Operations-Runbooks/UI-Design-System|UI-Design-System]] §15 ([UI-Design-System.md](../04-Operations-Runbooks/UI-Design-System.md))
* [[04-Operations-Runbooks/Deploy-Vercel-Runbook|Deploy-Vercel-Runbook]] — migration M12a, quyền `audit_logs` ([Deploy-Vercel-Runbook.md](../04-Operations-Runbooks/Deploy-Vercel-Runbook.md))
* Mã nguồn: `packages/core/src/audit/audit.ts`, `apps/web/lib/{audit,audit-query}.ts`, `apps/web/app/admin/audit/`,
  `apps/web/app/studio/[tenantSlug]/activity/`, `apps/web/app/admin/_ui/{audit-log,link-pagination,audit-log-skeleton}.tsx`,
  `packages/db/prisma/migrations/20261016090000_m12a_audit_logs/migration.sql`, `packages/db/scripts/setup-app-role.mts`

*Quay lại: [[MOC-Home]] (../00-Index/MOC-Home.md)*

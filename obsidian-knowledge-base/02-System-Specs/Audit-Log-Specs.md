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
updated: 2026-10-23
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
| `AUDIT_ACTIONS` (50 — 27 từ M12a + 5 từ M12c/ADR-039 + 8 từ ADR-041 + 2 từ ADR-047 + 1 từ ADR-048 + 7 từ ADR-050), `isAuditAction`, `AUDIT_ACTION_LABELS`, `auditActionLabel` | Danh sách action + nhãn tiếng Việt; action lạ hiển thị nguyên chuỗi |
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

## 4. Action và nơi ghi ✅ (grep `audit.log(` 2026-10-16; cập nhật M12c 2026-10-17; cập nhật ADR-041 2026-10-17; cập nhật ADR-047 2026-10-18; cập nhật ADR-048 2026-10-23; cập nhật ADR-050 2026-10-23)

**50** action trong `AUDIT_ACTIONS` ✅ (đếm working tree 2026-10-23, sau ADR-050): 21 theo đặc tả §"M12" + 6 bổ sung ở M12a (trước đây chỉ ghi `logger`) + 5 ở
M12c/ADR-039 + 8 ở ADR-041 (Hồ sơ, Bảng giá CMS, hoàn tiền gói) + 2 ở ADR-047 (ghi chú nội bộ đơn) + 1 ở ADR-048 (ghi chú khách) + 7 ở ADR-050 (CMS trang chủ, menu, văn bản pháp lý). Thêm action không
cần DDL (`action` là chuỗi).

| Action | Scope | Nơi ghi | Actor |
| :-- | :-- | :-- | :-- |
| `AUTH_LOGIN` | SYSTEM | `api/auth/login/route.ts` | user |
| `AUTH_LOGIN_FAILED` | SYSTEM | `api/auth/login/route.ts` — `reason`: `ACCOUNT_LOCKED`, `PASSWORD_RESET_REQUIRED`, `WRONG_PASSWORD` (+ `failedAttempts`, `lockedOut`), `EMAIL_NOT_VERIFIED` | user (tài khoản có thật) |
| `AUTH_REFRESH_REUSE` | SYSTEM | `api/auth/refresh/route.ts` — metadata `revokedSessions` | user |
| `USER_LOCKED` / `USER_UNLOCKED` | SYSTEM | `lib/admin-users.ts` (`lockUser`, `unlockUser`) | admin |
| `TENANT_CREATED` | TENANT | `lib/create-tenant.ts` | user tạo |
| `TENANT_LOCKED` / `TENANT_UNLOCKED` | SYSTEM (+`tenantId`) | `lib/tenant-lock.ts` — gọi từ `app/admin/tenants/actions.ts`; `TENANT_LOCKED` còn ghi khi xử lý báo cáo `LOCK_TENANT` (metadata `source: "ABUSE_REPORT"`, chỉ khi tenant chưa khoá) | admin |
| `TENANT_SLUG_CHANGED` | TENANT | `app/studio/[tenantSlug]/settings/actions.ts` — `{ from, to }` | thành viên |
| `PLAN_CREATED` / `PLAN_UPDATED` | SYSTEM | `app/admin/plans/actions.ts` (tạo, sửa, bật/tắt) | admin |
| `SUBSCRIPTION_PAID` | SYSTEM (+`tenantId`) | `lib/subscription-billing.ts` `markInvoicePaid` | null (webhook) hoặc admin (xác nhận tay) |
| `PAYMENT_CONFIG_UPDATED` | SYSTEM | `lib/platform-payment.ts` (lưu cấu hình; kiểm tra kết nối thành công tự bật) — chỉ cờ thay đổi, không secret | admin |
| `PAYMENT_CONFIG_UPDATED` | TENANT | `lib/tenant-payment.ts` | thành viên |
| `PRODUCT_PUBLISHED` / `PRODUCT_ARCHIVED` | TENANT | `lib/product.ts` | thành viên |
| `ORDER_MANUALLY_CONFIRMED` / `ORDER_REFUNDED` | TENANT | `lib/order.ts` | thành viên |
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

`audit_logs` không có RLS — **mọi đường đọc mới phải đi qua loader này** (BACKLOG).

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

- `ADMIN_VIEWED_TENANT`, `REPORT_RESOLVED`, `REVIEW_HIDDEN_REFUNDED` chưa vào bảng; khoá user chưa có ô lý do (đặc tả §"M2" muốn
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

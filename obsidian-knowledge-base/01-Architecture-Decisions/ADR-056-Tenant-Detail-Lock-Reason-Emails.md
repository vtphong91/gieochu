---
tags:
  - adr
  - system-admin
  - audit
  - billing
  - ui-ux
  - status/accepted
date: 2026-11-26
decider: Quốc (kỹ sư trưởng) — chủ dự án chốt 2026-11-26
status: Accepted — đã code, Quốc báo verify đạt (tsc 17/17, lint chỉ cảnh báo cũ, unit, test:count 105/69, integration admin.test 4/4); chưa commit; không migration
---

# ADR-056 (KB) — Đợt 3: Trang chi tiết gian hàng (System Center) + khoá/mở khoá có lý do

> **Tương ứng ADR-072 trong `docs/DECISIONS.md`.** Số KB 056 khác số ADR gốc 072 (KB đánh số riêng, xem [[00-Index/KB-Audit-2026-09-26|KB-Audit]] §55).
> Nguồn chính thức: `docs/DECISIONS.md` ADR-072. Kế hoạch chi tiết: `docs/ke-hoach-dot-3-chi-tiet-gian-hang-2026-11-26.md`.
> Mức xác minh: ✅ đã đối chiếu code (2026-11-26) · ❓ chưa thử trên trình duyệt/production.

## 1. Bối cảnh

- `/admin/tenants` chỉ có danh sách. Cột GMV ghi cứng "Cần M12" dù `tenant_daily_stats` đã được cron tính. ✅ (đã thay bằng GMV 30 ngày)
- Menu Khoá/Mở khoá chạy ngay khi bấm, không ghi lý do, không báo chủ gian hàng. ✅ (trước đợt này)
- Chưa có trang chi tiết gian hàng. ✅ (đã thêm)

## 2. Quyết định

### 2.1. Trang chi tiết `/admin/tenants/[tenantId]` (ADR-072 mục 1)

Chỉ System Admin. Dữ liệu gồm: L1 (gian hàng, chủ, thuê bao/gói, audit), `tenant_daily_stats` (tổng hợp), số đếm tài liệu theo
trạng thái, báo cáo vi phạm và yêu cầu hoàn tiền quá hạn của gian hàng. **Không** đọc `orders`, `tenant_customers`,
`tenant_payment_transactions` của gian hàng (§7.9). ✅ (Mục "Không đọc đơn/khách" đối chiếu qua `admin-tenant-detail.ts`.)

### 2.2. Ngoại lệ đọc L2 có giới hạn (ADR-072 mục 2)

System Center đọc `tenant_payment_configs` **chỉ** cột `provider` + `isEnabled`, lọc `isEnabled: true`, qua `withSystemJob`,
để hiện **tên** cổng đang bật. Không đọc `publicConfig`, `encryptedSecrets`, số tài khoản, secret. ✅ (`admin-tenant-detail.ts`
dòng ~404–405: `select: { provider: true, isEnabled: true }`.)

Đếm tài liệu theo trạng thái cũng đi qua `withSystemJob` (`products` là bảng L2, chỉ `groupBy` lấy số đếm). ✅

### 2.3. Khoá / mở khoá có lý do (ADR-072 mục 3)

- Hộp `<dialog>` xác nhận (cùng mẫu ADR-066/067/069), nêu rõ **lý do sẽ gửi cho chủ gian hàng**. ✅ (`tenant-lock-dialog.tsx`)
- Lý do **bắt buộc**, tối đa 500 ký tự (sau trim). ✅ (`TENANT_LOCK_REASON_MAX_LENGTH = 500`, `normalizeTenantLockReason`)
- Mở khoá luôn về `ACTIVE`. ✅ (`unlockTenant` → `changeTenantStatus(tenantId, "ACTIVE")`)
- Kiểm trạng thái ở server, đổi có điều kiện (`updateMany` kèm trạng thái đã đọc) — hai admin bấm cùng lúc thì người sau nhận 409,
  không ghi audit/email lần hai. ✅ (`changeTenantStatus`)
- Audit sau commit, 1 email chủ gian hàng mỗi lần đổi. Lỗi gửi email chỉ log, không rollback. ✅ (`lib/tenant-lock.ts`)

### 2.4. Danh sách `/admin/tenants` (ADR-072 mục 4)

Tên gian hàng là link tới trang chi tiết; cột "GMV / 30 ngày" (thay "Cần M12"); dòng chủ gian hàng dưới tên; menu "⋯" gồm
"Xem chi tiết" và Khoá/Mở khoá (qua hộp xác nhận); ẩn cột theo breakpoint. ✅ (`page.tsx`, `TenantRowActions`)

## 3. Hiện trạng code (✅ đối chiếu 2026-11-26, chưa commit)

| File | Vai trò |
| :-- | :-- |
| `apps/web/app/admin/tenants/[tenantId]/page.tsx`, `loading.tsx`, `not-found.tsx` | Trang chi tiết (Server Component), trạng thái tải, 404 |
| `apps/web/app/admin/tenants/[tenantId]/_ui/` (`parts.tsx`, `sections.tsx`, `audit-log.tsx`) | Các phần hiển thị, `UsageBar`, `TenantAuditLog` |
| `apps/web/app/admin/tenants/_ui/tenant-lock-dialog.tsx` | `TenantLockDialog`, `TenantLockButton`, `TenantRowActions` |
| `apps/web/app/admin/tenants/_ui/tenant-labels.ts` | Nhãn trạng thái gian hàng/chủ/cổng thanh toán |
| `apps/web/app/admin/tenants/page.tsx` | Danh sách: GMV 30 ngày, dòng chủ, menu "⋯" |
| `apps/web/app/admin/tenants/actions.ts` | `lockTenantAction`, `unlockTenantAction` |
| `apps/web/lib/admin-tenant-detail.ts` (mới) | `getAdminTenantDetail`, `listAdminTenants`, `adminStatsWindow` |
| `apps/web/lib/tenant-lock.ts` | `lockTenant`, `unlockTenant`, `lockTenantInTx`, `auditTenantLocked`, `notifyOwner` |
| `apps/web/lib/abuse-report.ts` | Khoá từ báo cáo vi phạm — ghi metadata `source`/`reason` mới (xem mục 6) |
| `packages/email/src/templates/tenant-lock.ts` (mới) | `renderTenantLockedEmail`, `renderTenantUnlockedEmail` |
| `packages/email/src/index.ts` | Export hai template trên |

## 4. Contract dữ liệu (tóm tắt)

| Export | Chữ ký / ghi chú |
| :-- | :-- |
| `getAdminTenantDetail(tenantId, { now? })` | → `AdminTenantDetail \| null`; `null` khi không có gian hàng (trang 404). ✅ |
| `listAdminTenants({ skip, take, now? })` | → `{ items: AdminTenantListItem[], total }`; tự `requireRole("SYSTEM_ADMIN")`. ✅ |
| `adminStatsWindow(now?)` | → `{ from, to }` giờ VN, **30 ngày kết thúc hôm qua** (số hôm nay chưa đủ ngày, cron 03:00). Dùng chung cho cột GMV danh sách và "30 ngày gần nhất" của trang chi tiết. ✅ |
| `TENANT_AUDIT_ACTIONS` | 13 action hiển thị ở "Nhật ký quản trị": `TENANT_CREATED`, `TENANT_LOCKED`, `TENANT_UNLOCKED`, `TENANT_SLUG_CHANGED`, `SUBSCRIPTION_INVOICE_CREATED`, `SUBSCRIPTION_PAID`, `SUBSCRIPTION_INVOICE_VOIDED`, `SUBSCRIPTION_INVOICE_REOPENED`, `SUBSCRIPTION_REFUND_REQUESTED`, `SUBSCRIPTION_REFUNDED`, `SUBSCRIPTION_REFUND_REJECTED`, `CONTENT_MODERATION_LOCKED`, `CONTENT_MODERATION_UNLOCKED`. Loại mọi action có khách hàng/đơn (ví dụ `ORDER_PAYMENT_EMAIL_SENT`, `COUPON_OVERUSED`) để giữ §7.9. ✅ |
| Giới hạn hiển thị | Nhật ký tối đa **50** dòng (`AUDIT_LIMIT`); báo cáo vi phạm gần nhất **5** (`RECENT_ABUSE_LIMIT`). ✅ |
| `lockTenantAction` / `unlockTenantAction(tenantId, _prev, formData)` | → `TenantLockState = { error?, reasonError?, success?, emailSent? }`. `reasonError` khi lý do trống/quá dài; `emailSent: false` khi chủ chưa nhận email. ✅ |
| Mã lỗi `TENANT_LOCK_ERROR_CODES` | `TENANT_LOCK_REASON_INVALID` (400), `TENANT_ALREADY_LOCKED` (409), `TENANT_NOT_LOCKED` (409); không tìm thấy → `NOT_FOUND` (404). ✅ |

Không có `route.ts` mới. Không migration (lý do lưu trong metadata audit). ✅

## 5. Audit và email

### 5.1. Audit (✅ `lib/tenant-lock.ts`)

| Action | Metadata |
| :-- | :-- |
| `TENANT_LOCKED` | `{ reason, previousStatus }` (khoá thủ công). Khoá từ báo cáo vi phạm: `{ source: "ABUSE_REPORT", reason, reportType, previousStatus }` |
| `TENANT_UNLOCKED` | `{ reason, previousStatus }` |

Số action trong `AUDIT_ACTIONS` **không đổi** (vẫn 63 — chỉ thêm khoá metadata). `reason` là lý do do quản trị viên nhập, không phải ghi chú nội bộ.

### 5.2. Email chủ gian hàng (✅ `packages/email/src/templates/tenant-lock.ts`, `apps/web/lib/tenant-lock.ts`)

| Loại (`type`) | Tiêu đề | Ghi chú |
| :-- | :-- | :-- |
| `tenant_locked` | `Gian hàng "{tên}" đã bị khoá — {tên ứng dụng}` | Nội dung có lý do, liên hệ hỗ trợ (email hỗ trợ System Settings), link Studio |
| `tenant_unlocked` | `Gian hàng "{tên}" đã được mở khoá — {tên ứng dụng}` | Tương tự |

- Gửi qua `sendEmailNow` → ghi `email_send_log` cả thành công lẫn thất bại. ✅
- Một email mỗi lần đổi trạng thái, gửi **sau commit**. Lỗi gửi hoặc chưa cấu hình SMTP → log, `emailSent: false`. ✅
- Hộp xác nhận đổi sang màn kết quả khi `emailSent: false` để quản trị viên đọc cảnh báo trước khi đóng. ✅ (`tenant-lock-dialog.tsx`)

### 5.3. Khoá từ báo cáo vi phạm (✅ `apps/web/lib/abuse-report.ts` dòng ~762–771, ~842)

Luồng `LOCK_TENANT` của báo cáo vi phạm **không** gửi email `tenant_locked`. Chủ gian hàng nhận email `content_moderated` có cờ `tenantLocked: true`, như trước đợt này. Lý do ghi vào audit là **nhãn loại vi phạm** (`ABUSE_REPORT_TYPE_LABELS`), không dùng ghi chú nội bộ `note`. Đây là điểm cần Quốc xác nhận, xem [[00-Index/KB-Audit-2026-09-26|KB-Audit]] §55.

## 6. Hệ quả khoá gian hàng

Quốc đối chiếu 2026-11-26 (✅ theo brief):

- Khách không xem được và không mua được tài liệu của gian hàng bị khoá. Storefront trả 404 — nên nút "Mở trang gian hàng" bị ẩn khi `LOCKED`.
- Khách đã mua vẫn tải được tài liệu đã mua.
- Chủ gian hàng không tạo/sửa được tài liệu, bài viết, mã giảm giá.
- Chủ vẫn sửa được giao diện gian hàng, cài đặt, cấu hình thanh toán.

❓ **Cần Quốc xác nhận:** link chia sẻ (`ShareLink`) trả 410 `SHARE_LINK_TENANT_LOCKED` khi gian hàng không `ACTIVE` (ADR-026, `lib/share-link.ts` ✅ code). Hệ quả "khách đã mua vẫn tải được" có áp dụng cho link chia sẻ không? Tài liệu hiện có chưa nêu rõ việc này nên chưa ghi thành sự thật.

## 7. Bố cục và trải nghiệm

Bố cục đầu trang, 7 phần, hộp khoá, thanh mức dùng (`role="progressbar"`, "Gần đầy" từ 90%), màn kết quả khi email lỗi: xem [[04-Operations-Runbooks/UI-Design-System|UI-Design-System]] §28.

## 8. Trạng thái xác minh

| Hạng mục | Mức |
| :-- | :-- |
| Code trang chi tiết, lib, action, email, audit | ✅ đối chiếu code 2026-11-26 |
| Verify: tsc 17/17, lint (cảnh báo cũ), unit, `pnpm test:count` 105/69, integration `admin.test` 4/4 | ✅ Quốc báo (số khớp mốc trần) |
| Chưa commit | ✅ `git status` 2026-11-26 |
| Không thêm test case (giữ trần 105/69) | ✅ |
| Trải nghiệm trên trình duyệt (375/1024/1280px, a11y hộp thoại) | ❓ chưa thử |
| Email gửi thật qua SMTP | ❓ chưa thử |
| Dọn dữ liệu tạm `stats.test.ts` (slug có tiền tố `_` → `-`) | ❓ chưa kiểm — việc riêng 2026-11-26 |
| Deploy VPS và thử khoá/mở khoá gian hàng thử nghiệm | ❓ chủ dự án làm sau khi commit |

## 9. Liên kết

- [[03-API-Contracts/Endpoint-Directory|Endpoint-Directory]] §36 — contract action và lib mới
- [[02-System-Specs/User-Management-System-Center-Specs|User-Management-System-Center-Specs]] — bảng `/admin/tenants`
- [[02-System-Specs/Audit-Log-Specs|Audit-Log-Specs]] — metadata `TENANT_LOCKED`/`TENANT_UNLOCKED`
- [[02-System-Specs/Payment-And-Billing|Payment-And-Billing]] §5S — danh mục email khoá/mở khoá; §5P — chi tiết đơn hàng gói
- [[02-System-Specs/Abuse-Reports-Specs|Abuse-Reports-Specs]] — khoá từ báo cáo vi phạm
- [[04-Operations-Runbooks/UI-Design-System|UI-Design-System]] §28
- [[00-Index/KB-Audit-2026-09-26|KB-Audit]] §55
- [[01-Architecture-Decisions/ADR-055-Subscription-Activity-Log-Detail-Gian-Hang-Label|ADR-055 KB (≙ ADR-071)]] — đợt trước

*Quay lại: [[MOC-Home]] (../00-Index/MOC-Home.md)*

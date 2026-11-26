---
tags:
  - adr
  - system-admin
  - security
  - auth
  - audit
  - status/accepted
date: 2026-11-26
decider: Quốc (kỹ sư trưởng) — chủ dự án chốt 2026-11-26
status: Accepted — Quốc duyệt 2026-11-26; code đã verify (Quốc báo); chưa commit; không migration
---

# ADR-057 (KB) — Đợt 4: Trang chi tiết người dùng (System Center) + thao tác quản trị tài khoản + guard phiên trong DB

> **Tương ứng ADR-073 trong `docs/DECISIONS.md`.** Số KB 057 khác số ADR gốc 073 (KB đánh số riêng, xem [[00-Index/KB-Audit-2026-09-26|KB-Audit]] §56).
> Nguồn chính thức: `docs/DECISIONS.md` ADR-073. Kế hoạch chi tiết: `docs/ke-hoach-dot-4-chi-tiet-nguoi-dung-2026-11-26.md`.
> Mức xác minh: ✅ đã đối chiếu code (2026-11-26) · 🟡 theo brief/báo cáo của Quốc · ❓ cần môi trường thật.

## 1. Bối cảnh

- `/admin/users` chỉ có danh sách. Khoá/Mở khoá chạy ngay khi bấm, không ghi lý do, không báo người dùng; có "Gửi lại email kích hoạt". ✅ (trạng thái trước đợt này)
- Chưa có trang chi tiết người dùng. ✅ (đã thêm)
- Access token là stateless: sau khi khoá tài khoản hoặc đăng xuất mọi thiết bị, phiên đang mở vẫn thao tác được tới khi access token hết hạn. Đợt này yêu cầu khu vực nhạy cảm kiểm trạng thái thật trong DB (ADR-073 mục 9). ✅ (guard đã code, xem mục 3)

## 2. Quyết định

### 2.1. Trang chi tiết `/admin/users/[userId]` (ADR-073 mục 1)

Chỉ System Admin. Dữ liệu chỉ từ L1: user, hồ sơ, phiên (`refresh_tokens`), `user_legal_acceptances`, gian hàng sở hữu, audit. **Không** hiện đơn mua, thư viện hay khách hàng của gian hàng (§7.9). Không bao giờ trả `passwordHash`, `tokenHash`, `familyId`, token kích hoạt/đặt lại. ✅ (`apps/web/lib/admin-user-detail.ts`)

Các mục trang: Hồ sơ & tài khoản (luôn có) · Bảo mật & phiên đăng nhập · Gian hàng sở hữu · Điều khoản đã đồng ý · Nhật ký. Tỉnh/thành và nghề nghiệp hiện bình thường. ✅

### 2.2. Số điện thoại và IP được che (ADR-073 mục 2)

- SĐT che một phần: giữ 2 ký tự đầu + 3 ký tự cuối (`maskPhone`). Nút "Hiện đầy đủ" gọi Server Action riêng `revealUserPhoneAction`; số đầy đủ **không** nằm trong HTML ban đầu. ✅
- Mỗi lần xem ghi audit `USER_PHONE_VIEWED` **trước** khi trả số. Ghi audit lỗi → không trả số (503 `AUDIT_WRITE_FAILED`). Giới hạn 30 lần/phút/quản trị viên, bộ đếm DB (`consumeRateLimit`). ✅ (`revealUserPhone`)
- IP phiên che: IPv4 giữ 2 nhóm đầu (`113.161.•••.•••`); IPv6 giữ 2 nhóm đầu (`2001:db8:•••`). ✅ (`maskIp`)

### 2.3. Khoá / mở khoá có lý do và email (ADR-073 mục 3, 6)

- Hộp xác nhận, lý do **bắt buộc**, tối đa 500 ký tự sau khi trim (`USER_LOCK_REASON_MAX_LENGTH`). Lý do được gửi cho người dùng. ✅
- Khoá: thu hồi mọi phiên còn hiệu lực, email `user_locked`, audit `USER_LOCKED`. ✅
- Mở khoá: về `PENDING` nếu chưa xác minh email, về `ACTIVE` nếu đã xác minh (không nhảy thẳng `ACTIVE`). Email `user_unlocked`, audit `USER_UNLOCKED`. ✅
- Giữ quy tắc hiện có: không khoá được siêu quản trị; không thao tác với chính mình (`lockBlocked` = `SUPER_ADMIN` hoặc `SELF`). Áp cả danh sách lẫn trang chi tiết. ✅

### 2.4. Đăng xuất mọi thiết bị, đặt lại mật khẩu, gửi lại kích hoạt (ADR-073 mục 4, 7, 8, 10)

- **Đăng xuất mọi thiết bị:** thu hồi mọi phiên còn hiệu lực, audit `USER_SESSIONS_REVOKED`. Không có phiên → 409 `USER_NO_ACTIVE_SESSIONS`. ✅
- **Yêu cầu đặt lại mật khẩu:** bật `passwordResetRequired`, **thu hồi mọi phiên** (mục 10), tạo token `PASSWORD_RESET` (chỉ lưu hash, TTL theo `passwordResetTtlMinutes`), gửi email theo khuôn "Quên mật khẩu" có đoạn mở đầu "Quản trị viên … đã yêu cầu…" (không nêu tên admin), audit `USER_PASSWORD_RESET_REQUIRED`. Quản trị viên **không** xem và không đặt mật khẩu thay người dùng. ✅
- **Gửi lại email kích hoạt:** chỉ khi `PENDING`; có audit `USER_VERIFICATION_RESENT`; giới hạn 1 lần / 60 giây / người dùng (bộ đếm DB). ✅
- Không thao tác với siêu quản trị hay chính mình (`lockBlocked`). Nhãn vai trò: Siêu quản trị · Quản trị viên · Chủ gian hàng · Người dùng. ✅ (`user-labels.ts`)

### 2.5. Guard phiên có hiệu lực ngay (ADR-073 mục 9)

Xem mục 3.

### 2.6. Câu báo lỗi đăng nhập khi `passwordResetRequired` (ADR-073) ✅

Route `apps/web/app/api/auth/login/route.ts`. Mã vẫn là `PASSWORD_RESET_REQUIRED`, HTTP 403 (form đăng nhập map theo mã để hiện lối "Quên mật khẩu"). Chỉ câu báo khác nhau:

- `failedLoginAttempts` ≥ `MAX_FAILED_LOGIN_ATTEMPTS` (5): "Tài khoản đã bị khoá tạm thời do đăng nhập sai quá nhiều lần. Vui lòng đặt lại mật khẩu để tiếp tục."
- Còn lại (quản trị viên yêu cầu đặt lại, không tăng bộ đếm sai): "Tài khoản của bạn cần đặt lại mật khẩu trước khi đăng nhập. Vui lòng dùng liên kết trong email chúng tôi đã gửi hoặc chọn "Quên mật khẩu"."

Cờ `passwordResetRequired` được kiểm **trước** khi xác minh mật khẩu (thứ tự có từ trước đợt 4). Vì vậy câu báo phân biệt được hai trường hợp ngay cả với người chỉ biết email. Quốc chấp nhận, rủi ro thấp (2026-11-26).

Lưu ý đã đối chiếu code: luồng quản trị viên không reset `failedLoginAttempts` (chỉ `reset-password` và đăng nhập thành công reset về 0). Nếu bộ đếm đang ≥ 5 khi quản trị viên yêu cầu, người dùng vẫn thấy câu "khoá tạm thời". Câu này đúng với lịch sử sai mật khẩu nhưng không phải do yêu cầu của quản trị viên. Chưa đổi code (xem mục 8).

## 3. Cách làm: guard phiên đối chiếu DB (ADR-073 mục 9) ✅

- Access token mang claim `sid` = `familyId` (`apps/web/lib/session.ts`, `getCurrentUser` gán `familyId: claims.sid`).
- `getSessionState(user)` → `ACTIVE` | `LOCKED` | `REVOKED`, đọc bằng **một** truy vấn `users` (status) + `refresh_tokens` (`familyId`, `revokedAt` null, `take 1`). Cache theo request + tham số (`cache()`). Không migration.
- `assertActiveSession(user)`: `LOCKED` → 401 `ACCOUNT_LOCKED`; họ phiên không còn token chưa thu hồi → 401 `SESSION_REVOKED`.
- Gắn vào: `requireRole`, `requireCheckoutUser`, `requireVerified` (`session.ts`); `requireTenantMember` (`tenant.ts`), kéo theo `requireTenantMemberPage`. Page guard `requireAdminAccess`, `requireCheckoutAccess`, `requireVerifiedAccess` và `requireTenantMemberPage` dùng `getSessionState` và chuyển về `/login?next=…` (`page-guards.ts`). ✅
- `requireVerified` (Server Actions profile/security/thư viện/đánh giá/tạo gian hàng) gọi `assertActiveSession` sau khi kiểm `emailVerified`: `LOCKED` → 401 `ACCOUNT_LOCKED`, `REVOKED` → 401 `SESSION_REVOKED`. `createTenantAction` không gọi lại `assertActiveSession` (đã được `requireVerified` gác). ✅ Quốc báo 2026-11-26.
- `requireVerifiedAccess` (trang `/account`, `/account/profile`, `/account/security`, `/studio`) chuyển về `/login?next=…` khi `LOCKED` hoặc `REVOKED`. ✅ Quốc báo 2026-11-26.
- `requireUser` **giữ nguyên**, không gọi guard: logout, refresh và login không bị chặn, nên không lặp redirect. ✅
- **Bước 2 tải tài liệu** `GET /api/downloads/[token]` **không** kiểm phiên: token một lần do bước 1 cấp (bước 1 đã có guard). ✅ route không gọi guard. Quốc chấp nhận ngoại lệ này (2026-11-26).

## 4. Hệ quả khoá tài khoản

- **Chủ gian hàng bị khoá:** khoá tài khoản chủ gian hàng **không** ảnh hưởng gian hàng, thanh toán, job nền. Khách vẫn mua được; email bán hàng vẫn gửi chủ. 🟡 theo brief Quốc (chưa đối chiếu lại toàn bộ luồng job/checkout trong đợt này).
- **Không xoá dữ liệu:** khoá chỉ đổi `users.status` và đặt `revokedAt` cho refresh token. Cron vẫn dọn token đã thu hồi quá 90 ngày (`refresh_tokens.purge`). 🟡 theo brief và KB [[02-System-Specs/Auth-Session-Specs|Auth-Session-Specs]] §8.

## 5. Hiện trạng code (✅ đối chiếu 2026-11-26, chưa commit)

| File | Vai trò |
| :-- | :-- |
| `apps/web/lib/session.ts` | `getSessionState`, `assertActiveSession`, `SESSION_GUARD_ERROR_CODES`; gắn vào `requireRole`, `requireCheckoutUser`, `requireVerified` |
| `apps/web/lib/page-guards.ts` | `redirectUnlessSessionActive`; dùng trong `requireAdminAccess`, `requireCheckoutAccess`, `requireVerifiedAccess` |
| `apps/web/lib/tenant.ts` | `requireTenantMember` gọi `assertActiveSession` |
| `apps/web/app/studio/actions.ts` | `createTenantAction` dựa vào `requireVerified` (bỏ lời gọi `assertActiveSession` trùng) |
| `apps/web/app/api/auth/login/route.ts` | Hai câu báo của `PASSWORD_RESET_REQUIRED` (mục 2.6) |
| `apps/web/lib/admin-users.ts` (mới phần lớn) | `lockUser`, `unlockUser`, `revokeUserSessions`, `requestUserPasswordReset`, `revealUserPhone`, `resendVerificationForUser`; hằng số giới hạn |
| `apps/web/lib/admin-user-detail.ts` (mới) | `getAdminUserDetail`, `maskPhone`, `maskIp`, `USER_AUDIT_ACTIONS`, `lockBlocked` |
| `apps/web/app/admin/users/actions.ts` | 6 Server Action (mục 6) |
| `apps/web/app/admin/users/page.tsx` | Danh sách: cột "Người dùng" gộp tên + email, link chi tiết, menu "⋯" |
| `apps/web/app/admin/users/[userId]/` | `page.tsx`, `loading.tsx`, `not-found.tsx`, `_ui/` (`sections.tsx`, `audit-log.tsx`) |
| `apps/web/app/admin/users/_ui/` | `user-lock-dialog.tsx`, `user-confirm-dialog.tsx`, `phone-field.tsx`, `user-row-actions.tsx`, `user-detail-actions.tsx`, `user-labels.ts` |
| `apps/web/app/admin/users/resend-verification-item.tsx` | Đã xoá trong working tree (`git status`: D) |
| `packages/email/src/templates/user-lock.ts` (mới) | `renderUserLockedEmail`, `renderUserUnlockedEmail` |
| `packages/email/src/templates/reset-password.ts` | Thêm biến thể `requestedByAdmin` |
| `packages/core/src/audit/audit.ts` | Thêm 4 action (tổng 63 → 67) |

## 6. Contract (tóm tắt)

| Export | Chữ ký / ghi chú |
| :-- | :-- |
| `lockUser(actor, targetUserId, rawReason)` | → `UserLockResult` `{ previousStatus, revokedSessions, emailSent }`. **Đổi:** nhận `rawReason` (trước: không có lý do). ✅ |
| `unlockUser(actor, targetUserId, rawReason)` | → `UserUnlockResult` `{ status: "ACTIVE" \| "PENDING", emailSent }`. **Đổi:** nhận `rawReason`. ✅ |
| `revokeUserSessions(actor, targetUserId)` | → `{ revokedCount }`. ✅ |
| `requestUserPasswordReset(actor, targetUserId)` | → `{ revokedCount, emailSent }`. Giới hạn 5 lần/giờ/email, bộ đếm **trong bộ nhớ** (`checkRateLimit`, key `forgot-password:<email>`). ✅ |
| `revealUserPhone(actor, targetUserId)` | → `string` (số đầy đủ). 30 lần/phút/quản trị viên. ✅ |
| `resendVerificationForUser(actor, userId)` | → `void`. **Đổi:** nhận `actor`. Chỉ `PENDING`; 1 lần/60 giây. ✅ |
| `getAdminUserDetail(userId, { now? })` | → `AdminUserDetail \| null` (`null` → trang 404). ✅ |
| Server Actions (`app/admin/users/actions.ts`) | `lockUserAction`, `unlockUserAction` (`UserLockState`); `revokeUserSessionsAction`, `requestUserPasswordResetAction` (`UserActionState`); `revealUserPhoneAction` (`RevealPhoneState`); `resendVerificationAdminAction` (`ResendVerificationActionState`). ✅ |
| Mã lỗi `USER_ADMIN_ERROR_CODES` | `USER_LOCK_REASON_INVALID`, `USER_ALREADY_LOCKED` (409), `USER_NOT_LOCKED` (409), `USER_NOT_ACTIVE` (409), `NOT_PENDING` (400), `USER_NO_ACTIVE_SESSIONS` (409), `USER_NO_PHONE`, `AUDIT_WRITE_FAILED` (503), `RATE_LIMITED` (429). ✅ |
| Guard phiên | `ACCOUNT_LOCKED`, `SESSION_REVOKED` — 401 (mục 3). ✅ |

Không có `route.ts` mới. Không migration.

## 7. Audit và email

### 7.1. Audit (✅ `apps/web/lib/admin-users.ts`)

| Action | Metadata | Ghi chú |
| :-- | :-- | :-- |
| `USER_LOCKED` | `{ reason, previousStatus, revokedSessions, emailSent }` | Ghi sau commit, sau khi gửi email |
| `USER_UNLOCKED` | `{ reason, newStatus, emailSent }` | `newStatus` là `ACTIVE` hoặc `PENDING` |
| `USER_SESSIONS_REVOKED` | `{ revokedSessions }` | Không gửi email |
| `USER_PASSWORD_RESET_REQUIRED` | `{ revokedSessions, emailSent }` | **Không có `reason`** (xem mục 8) |
| `USER_PHONE_VIEWED` | không có metadata | Ghi **trước** khi trả số; lỗi ghi → không trả số |
| `USER_VERIFICATION_RESENT` | `{ emailSent: true }` | Ghi sau khi gửi |

Số action trong `AUDIT_ACTIONS`: 63 → **67** (+4: `USER_SESSIONS_REVOKED`, `USER_PASSWORD_RESET_REQUIRED`, `USER_PHONE_VIEWED`, `USER_VERIFICATION_RESENT`). `USER_LOCKED` / `USER_UNLOCKED` đã có trước, nay thêm metadata. ✅ (`packages/core/src/audit/audit.ts`). Audit ghi sau khi gửi email, cùng mức chấp nhận như ADR-037 (lỗi gửi email chỉ log, `emailSent: false`).

### 7.2. Email (✅ `packages/email`, `apps/web/lib/admin-users.ts`)

| Loại | Tiêu đề | Gửi khi |
| :-- | :-- | :-- |
| `user_locked` | `Tài khoản của bạn đã bị khoá — {tên ứng dụng}` | Khoá (kèm lý do) |
| `user_unlocked` | `Tài khoản của bạn đã được mở khoá — {tên ứng dụng}` | Mở khoá (kèm lý do) |
| Đặt lại mật khẩu (`requestedByAdmin`) | Khuôn "Quên mật khẩu", đoạn mở đầu nêu quản trị viên đã yêu cầu | Yêu cầu đặt lại từ quản trị viên |

Gửi qua `sendEmailNow` (`apps/web/lib/email-dispatch.ts`). Lỗi gửi → log, `emailSent: false`, hộp xác nhận hiện cảnh báo. ✅ Chưa gửi SMTP thật ❓.

## 8. Lệch và câu hỏi cho Quốc

1. **Lý do đặt lại mật khẩu. ✅ Quốc xác nhận chủ đích (2026-11-26).** `USER_PASSWORD_RESET_REQUIRED` không có `reason`; chỉ khoá/mở khoá bắt buộc lý do. Metadata: `{ revokedSessions, emailSent }`.
2. **"Tải tài liệu" trong khu vực guard. ✅ Quốc chấp nhận ngoại lệ (2026-11-26).** Bước 2 `GET /api/downloads/[token]` không kiểm phiên, vì token một lần do bước 1 cấp và bước 1 đã có guard.
3. **`requireVerified` gắn guard. ✅ Đã xử lý (2026-11-26).** `requireVerified` nay gọi `assertActiveSession` (xem mục 3). `createTenantAction` bỏ lời gọi trùng.
4. **Ô tìm kiếm danh sách có lỗi sẵn → backlog (Quốc chốt 2026-11-26).** Placeholder ghi "Tìm theo tên, email, SĐT..." (`app/admin/users/page.tsx`), nhưng truy vấn chỉ lọc `email` (`contains`, `insensitive`). Chưa sửa trong đợt này. Việc thêm tìm theo SĐT đi cùng backlog này.
5. **Hằng số lý do ở client.** `REASON_MAX_LENGTH = 500` nằm hard-code trong `user-lock-dialog.tsx`, song song với `USER_LOCK_REASON_MAX_LENGTH` phía server. Xem nợ kỹ thuật trong [[04-Operations-Runbooks/UI-Design-System|UI-Design-System]] §29.
6. **Tách `parts.tsx` và popover → backlog (Quốc chốt 2026-11-26).** Ba file trong `admin/users/[userId]/` import `tenants/[tenantId]/_ui/parts.tsx` (nên chuyển sang `admin/_ui`). Popover menu nhân bản từ `InvoiceRowMenu` (ADR-069). Nợ kỹ thuật, không làm trong đợt 4.
7. **Bộ đếm sai mật khẩu khi quản trị viên yêu cầu đặt lại (❓ Quốc chưa quyết).** Luồng quản trị viên không reset `failedLoginAttempts` (mục 2.6). Với người đang ở 5 lần sai, câu báo là "khoá tạm thời" dù quản trị viên là người yêu cầu. Chọn: giữ như hiện tại (Quốc đã chấp nhận rủi ro thấp), hoặc reset bộ đếm cùng lúc với `requestUserPasswordReset` (đổi hành vi, cần duyệt riêng).

## 9. Trạng thái xác minh

| Hạng mục | Mức |
| :-- | :-- |
| Code guard, lib, action, email, audit, metadata, giới hạn 30/phút · 1/60 giây · 5/giờ | ✅ đối chiếu code 2026-11-26 |
| `pnpm test:count` | ✅ Long chạy 2026-11-26: unit **105/105**, integration **69/69** (khớp mốc trần ADR-065; không thêm test case) |
| tsc, lint, integration (đợt 4) | 🟡 Quốc báo đã verify đạt |
| Chưa commit | ✅ `git status` 2026-11-26 |
| Không migration | ✅ |
| Trải nghiệm trên trình duyệt (375/1024/1280px, hộp thoại, menu Popover) | ❓ chưa thử |
| Gửi email thật qua SMTP, SĐT/IP trên production | ❓ chưa thử |
| Khoá chủ gian hàng và kiểm job/checkout thật | ❓ chưa thử |

## 10. Liên kết

- [[03-API-Contracts/Endpoint-Directory|Endpoint-Directory]] §37 — contract action và lib
- [[02-System-Specs/User-Management-System-Center-Specs|User-Management-System-Center-Specs]] §3.5 — trang chi tiết, thao tác, email
- [[02-System-Specs/Auth-Session-Specs|Auth-Session-Specs]] §9B — guard `assertActiveSession`
- [[02-System-Specs/Audit-Log-Specs|Audit-Log-Specs]] §4 — 4 action mới
- [[04-Operations-Runbooks/UI-Design-System|UI-Design-System]] §29 — component
- [[00-Index/KB-Audit-2026-09-26|KB-Audit]] §56
- [[01-Architecture-Decisions/ADR-056-Tenant-Detail-Lock-Reason-Emails|ADR-056 KB (≙ ADR-072)]] — đợt trước

*Quay lại: [[MOC-Home]] (../00-Index/MOC-Home.md)*

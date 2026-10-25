---
tags:
  - spec
  - auth
  - session
  - security
  - account
  - status/living
date: 2026-10-24
updated: 2026-10-24
author: Long
---

# 📐 Đặc Tả: Phiên Đăng Nhập (M1 + ADR-053) — Cookie, "Ghi nhớ đăng nhập", Idle/Absolute, Ân Hạn, Danh Sách Thiết Bị

> Quyết định gốc: **ADR-053** trong [`docs/DECISIONS.md`](../../docs/DECISIONS.md). Bản trích KB:
> [[01-Architecture-Decisions/ADR-039-Session-Policy-Remember-Me-Idle-Absolute|ADR-039 (≙ ADR-053)]]. Cơ chế rotation + reuse detection gốc của M1:
> [[02-System-Specs/User-Management-System-Center-Specs|User-Management-System-Center-Specs]] §4.
>
> Mức xác minh: ✅ Long đã đối chiếu code working tree 2026-10-24 (**GĐ A + GĐ B xong code, chưa commit**; Quốc báo đã verify 🟡) · 🟡 theo
> brief/báo cáo · ❓ cần môi trường thật. Migration `20261024090000_adr051_session_policy` **đã chạy trên DB dùng chung** 🟡 (brief Quốc).
> Phần "Bổ sung ADR-053" + "lần 3" (tự lưu nháp editor lên server) ghi riêng ở
> [[02-System-Specs/Editor-Autosave-Drafts-Specs|Editor-Autosave-Drafts-Specs]] — liên quan phiên: sự kiện `gieochu:session-expiring` (§5). Đổi số ADR
> hai lần: 2026-10-24 (ADR-051 / bản trích KB ADR-037 → ADR-052 / ADR-038) và 2026-10-25 (→ ADR-053 / ADR-039): KB-Audit §34, §36.

---

## 1. Mô hình phiên ✅

- **Một phiên = một `familyId`** trên bảng L1 `refresh_tokens` (một thiết bị/trình duyệt). Mỗi lần refresh tạo token mới cùng `familyId`, token cũ
  ghi `replacedById` (rotation). `rememberMe`, `sessionStartedAt`, `userAgent`, `ip`, `deviceLabel` **chép nguyên** sang token mới.
- **Hoạt động gần nhất** của phiên = `createdAt` của token còn hiệu lực — client chỉ refresh khi có thao tác thật (§5), nên không cần cột `lastUsedAt`.
- **Hạn của mọi token trong phiên** = `sessionStartedAt + absolute` (`sessionExpiresAt`) — **không trượt** khi rotate (trước ADR-053: trượt 7 ngày
  mỗi lần refresh theo `refreshTokenTtlDays`).
- Cookie: `at` (access JWT, `Path=/`) và `rt` (refresh opaque, `Path=/api/auth`), `httpOnly`, `Secure` ở production, `SameSite=Lax` (không đổi).
- Access JWT thêm claim **`rm`** (boolean, vắng = `false`) — cho client biết phiên có idle hay không.

### 1.1. Nơi duy nhất ký access token — `apps/web/lib/session-access.ts` ✅

- `signSessionAccessToken(claims, policy)` → `{ accessToken, accessTtlSeconds }`: ký JWT với `sub`, `sid` (= `familyId`), `role`, `ver`, `pc` và **`rm =
  policy.rememberMe`**, TTL `policy.accessTtlSeconds`. `POST /api/auth/login` và `POST /api/auth/refresh` gọi hàm này.
- `issueAccessCookieForSession(target, claims): Promise<boolean>` — ký lại access cookie cho phiên **đang có**, không rotate refresh (hiện dùng khi đổi hồ
  sơ làm đổi claim `pc`, `lib/account-profile.ts`). "Ghi nhớ" đọc từ refresh token mới nhất **chưa bị thu hồi** của family (`familyId` = claim `sid`, lọc
  thêm `userId`), không tin claim cũ → `getSessionPolicy(role, rememberMe)` → ký → `setAccessCookie`. Family không còn token chưa thu hồi → **không ký
  lại**, trả `false`; thao tác của người gọi (lưu hồ sơ) vẫn thành công, access cũ hết hạn tự nhiên, lần refresh sau bị từ chối.
- `lib/cookies.ts`: `setAccessCookie(target, accessToken, accessTtlSeconds, persistent)` đặt cookie `at` (`httpOnly`, `Secure` ở production, `SameSite=Lax`,
  `Path=/`), **chỉ có `maxAge` khi `persistent`** (phiên "Ghi nhớ"). `applyAuthCookies` (login/refresh) gọi lại hàm này. Kiểu `CookieSetter` = phần chung của
  `NextResponse.cookies` (route handler) và `cookies()` (Server Action).
- Quy tắc: mọi nơi ký access token / đặt cookie `at` mới phải đi qua hai helper trên — không gọi `signAccessToken` hay tự đặt `maxAge` ở nơi gọi.

---

## 2. Bảng chính sách — `resolveSessionPolicy(role, requestedRememberMe, settings)` ✅

`packages/auth/src/session-policy.ts` — module thuần (không đọc DB/env). Web gọi qua `getSessionPolicy(role, rememberMe)` (`lib/jwt-context.ts`, đọc
`getSystemSettings()`).

| | Không "Ghi nhớ" (mặc định) | "Ghi nhớ" | `SYSTEM_ADMIN` |
| :-- | :-- | :-- | :-- |
| `rememberMe` hiệu lực | `false` | `true` | **luôn `false`** (server bỏ qua yêu cầu) |
| Cookie `rt` và `at` | **session cookie** (không `maxAge` — mất khi đóng trình duyệt) | persistent: `rt` `maxAge` = thời gian còn lại tới hạn phiên; `at` `maxAge` = TTL access | session cookie |
| Idle (`idleMs`) | `sessionIdleMinutes` (mặc định 60) | `null` — không áp | `adminIdleMinutes` (15) |
| Absolute (`absoluteMs`) | `sessionAbsoluteHours` (12) | `rememberMeDays` (30) | `adminAbsoluteHours` (8) |
| Cảnh báo (`warningMs`) | `min(sessionWarningMinutes, idle/2)` (2 phút) | `null` | như cột 1 |
| TTL access (`accessTtlSeconds`) | `min(accessTokenTtlMinutes·60, idle)` | `accessTokenTtlMinutes·60` | `min(…, idle)` |

- Chủ gian hàng và khách mua dùng **cùng** mức (chỉ `SYSTEM_ADMIN` khác) 🟡 ADR-053.
- Policy được **tính lại ở mỗi lần refresh** từ vai trò hiện tại + `rememberMe` của bản ghi + cấu hình hiện hành ✅ code — đổi cấu hình hoặc đổi vai trò
  có hiệu lực với phiên đang mở từ lần refresh kế tiếp (xem §4). Đây là **chủ ý** — ngoại lệ của ADR-032 ("Bổ sung ADR-053 lần 2").
- `evaluateSessionTimeouts({ sessionStartedAt, lastActiveAt }, policy, now)`: kiểm **absolute trước**, rồi idle (bỏ qua khi `idleMs = null`) → `active` /
  `absolute` / `idle`.

---

## 3. Đăng nhập — "Ghi nhớ đăng nhập" ✅

- Form `/login` (`app/(auth)/login/login-form.tsx`): checkbox **"Ghi nhớ đăng nhập trên thiết bị này"**, **mặc định tắt**; gửi
  `{ email, password, rememberMe }` tới `POST /api/auth/login` (contract: [[03-API-Contracts/Endpoint-Directory|Endpoint-Directory]] §3.2). Checkbox hiện
  cho mọi người (lúc nhập chưa biết vai trò) — với SYSTEM_ADMIN server bỏ qua; ADR-053 đã đính chính đúng như vậy ✅.
- Server: kiểm như M1 (rate limit, khoá, sai mật khẩu, chưa kích hoạt) → `policy = getSessionPolicy(role, rememberMe)` → tạo `refresh_tokens`
  `{ rememberMe: policy.rememberMe, sessionStartedAt: now, deviceLabel: describeUserAgent(UA), userAgent, ip, expiresAt: now + absolute }` →
  ký access với `rm` và TTL `policy.accessTtlSeconds` → đặt cookie theo §2.
- **Điều hướng cứng** sau đăng nhập thành công: `window.location.assign(next)` (`next` qua `toSafeRedirect`, mặc định `landingPath`).
- `/login?het-phien=1` hiện `InfoBanner` "Phiên đăng nhập đã kết thúc để bảo vệ tài khoản. Vui lòng đăng nhập lại."
- **Khôi phục phiên "Ghi nhớ":** khi mở `/login` (không có `het-phien`), form gọi `POST /api/auth/refresh` một lần; thành công → `location.assign(next)`.
  Chống vòng lặp bằng mốc thời gian trong `sessionStorage` (`gieochu-session-resume-at`, 30 giây); `sessionStorage` bị chặn → bỏ qua. Dùng cho trường hợp
  access cookie đã hết nhưng `rt` persistent còn và trang cần đăng nhập đẩy về `/login?next=…` (guard trong `lib/page-guards.ts` ✅). Chạy thật trên
  trình duyệt ❓.

---

## 4. Refresh — `POST /api/auth/refresh` ✅

Thứ tự xử lý (`app/api/auth/refresh/route.ts`; mã lỗi đầy đủ: [[03-API-Contracts/Endpoint-Directory|Endpoint-Directory]] §3.3):

1. Không có cookie `rt` / không tìm thấy bản ghi theo hash → 401, xoá cookie.
2. `evaluateRefreshToken(record, now, { replacedAt })` (`packages/auth/src/tokens/refresh-token.ts`):
   - `revokedAt` có → **`reused`**.
   - `replacedById` có, token chưa bị thu hồi, và token thay thế được tạo cách đây **≤ 30 giây** (`REFRESH_REUSE_GRACE_MS`; `replacedAt` = `createdAt` của
     bản ghi `replacedById`, không cần cột mới) → **`superseded`** → 401 `AUTH_REFRESH_SUPERSEDED`, **không** thu hồi family, **không** xoá cookie (trình
     duyệt đã/đang nhận cookie mới từ request thắng).
   - `replacedById` có, quá 30 giây → **`reused`** → thu hồi cả family, audit `AUTH_REFRESH_REUSE`, 401 `AUTH_REFRESH_REUSE`, xoá cookie (giữ hành vi M1).
   - Hết `expiresAt` → **`expired`** → 401 `UNAUTHORIZED`, xoá cookie (không thu hồi).
3. **Kiểm `user.status`** (GĐ A): user không còn hoặc khác `ACTIVE` → thu hồi family, 401 `ACCOUNT_LOCKED` (nếu `LOCKED`) hoặc `UNAUTHORIZED`, xoá cookie.
4. **Idle/absolute** (GĐ B): `lastActiveAt = record.createdAt`. Quá absolute → thu hồi family, 401 `SESSION_EXPIRED`; quá idle → thu hồi family, 401
   `SESSION_IDLE_TIMEOUT`; cả hai xoá cookie.
   - **Phiên trước ADR-053** (`sessionStartedAt` NULL): coi như bắt đầu tại lần rotate này (`sessionStartedAt = now`, không xét idle lần này) → không
     đăng xuất hàng loạt lúc deploy. Token mới nhận `rememberMe` của bản ghi cũ (`false`) → từ đó là phiên không ghi nhớ — chấp nhận ("Bổ sung ADR-053
     lần 2"); muốn giữ thì đăng nhập lại có tick "Ghi nhớ".
5. **Rotation nguyên tử** (GĐ A): trong một `$transaction` — tạo token mới, rồi `updateMany({ where: { id, replacedById: null, revokedAt: null } })` gắn
   `replacedById`. `count ≠ 1` (request khác vừa thay/thu hồi) → rollback, trả 401 `AUTH_REFRESH_SUPERSEDED`.
6. Ký access mới (`ver` từ `emailVerifiedAt`, `pc`, `rm`), đặt cookie theo §2 → `200 { ok: true }`.

---

## 5. Client — `SessionRefresh` (`app/_ui/session-refresh.tsx`, mount 1 lần ở root layout) ✅

Root layout (`app/layout.tsx`) truyền: `accessTokenTtlSeconds` (theo policy), `idleSeconds`/`warningSeconds` (chỉ khi đã đăng nhập và phiên có idle),
`sessionIssuedAtMs` (`iat` của access token — `getSessionClientInfo()` đọc claim, không DB, `cache()` dùng chung với `getCurrentUser`), `signedIn`.
Khách: policy mặc định của `USER` chỉ để tính chu kỳ.

- **Chỉ làm mới khi có thao tác thật** (`pointerdown`, `keydown`, `wheel`, `touchstart`, `scroll`, quay lại tab) kể từ lần làm mới trước **và** đã quá
  chu kỳ `clamp(min(TTL access/2, idle/3), 1 phút, 10 phút)`. Gom sự kiện 5 giây; nhịp kiểm tra 15 giây. Tab để yên không kéo dài phiên — server đo idle
  bằng thời điểm phát token.
- **Khoá giữa các tab:** Web Locks (`gieochu-session-refresh`); thiếu Web Locks thì dựa BroadcastChannel (`gieochu-session`) + ân hạn 30 giây ở server.
  Tab làm mới xong phát `refreshed` (các tab khác dời mốc idle, đóng cảnh báo, đồng bộ UI); phiên kết thúc phát `ended`.
- **Tab hiện lại** (`visibilitychange` → `visible`): kiểm idle rồi coi như một thao tác.
- **Cảnh báo idle** (phiên có idle): còn `warningSeconds` trước hạn (`lastRefreshAt + idle`) → hộp thoại `role="alertdialog"` "Bạn vẫn đang dùng
  chứ?" đếm ngược, nút "Tiếp tục phiên" (refresh ngay) và "Đăng xuất"; Escape = tiếp tục; thao tác bất kỳ ngoài hộp thoại = tiếp tục. Nếu đã có thao tác
  chưa kịp refresh thì refresh luôn thay vì cảnh báo. Hết hạn → `POST /api/auth/logout` → `/login?het-phien=1&next=<trang hiện tại>`.
- **Xử lý phản hồi refresh:** 200 → cập nhật mốc, `router.refresh()` nếu UI đang hiện "khách"; 401 `AUTH_REFRESH_SUPERSEDED` → coi như còn phiên; 401
  `SESSION_IDLE_TIMEOUT`/`SESSION_EXPIRED` khi UI đang đăng nhập → điều hướng cứng tới `/login?het-phien=1…`; 401 khác → dừng, báo tab khác,
  `router.refresh()` nếu UI đang hiện đăng nhập; mất mạng/5xx → thử lại lần kiểm tra sau.
- **Khách chưa đăng nhập:** thử refresh một lần ở thao tác đầu tiên (khôi phục phiên "Ghi nhớ"), 401 thì dừng hẳn.
- Hộp thoại `SessionExpiryDialog` (`app/_ui/session-expiry-dialog.tsx`, Phong) — bố cục/a11y ở [[04-Operations-Runbooks/UI-Design-System|UI-Design-System]] §23.1.

---

## 6. Điều hướng cứng sau login/logout và nguyên nhân lỗi header cache

**Nguyên nhân** 🟡 (Hiếu chẩn đoán, ghi trong ADR-053): layout chứa `SiteHeader` + `loading.tsx` của `/pricing`, `/cua-hang`… được Next prefetch và
tái dùng ~5 phút (staleTimes). Login/logout trước đây gọi Route Handler bằng `fetch` rồi `router.push` + `router.refresh` — `router.refresh` chỉ làm
mới route hiện tại, cookie đặt qua Route Handler không invalidate client cache → header của trang khác còn trạng thái cũ, có thể **lộ tên/email của
người vừa đăng xuất** trên máy dùng chung.

**Sửa** ✅ code — mọi điểm kết thúc/bắt đầu phiên dùng `window.location.assign(...)` (tải lại toàn trang, xoá toàn bộ client cache):

| Nơi | Đích |
| :-- | :-- |
| `login-form.tsx` (đăng nhập thành công; khôi phục phiên) | `next` an toàn / `landingPath` |
| `app/_ui/account-menu.tsx` → Đăng xuất | `logoutRedirect` (`/login` ở app shell, `/` ở trang công khai — ADR-042) |
| `app/account/_ui/logout-button.tsx` | `redirectTo`; giữ trạng thái `pending` tới khi trang mới tải |
| `SessionRefresh` (hết idle / nút Đăng xuất trong cảnh báo) | `/login?het-phien=1&next=…` / `/login` |

Server Action `logoutAllDevicesAction` vẫn dùng `redirect("/login")` của Next ✅ code. `revokeSessionAction` (thiết bị hiện tại) từ 2026-10-24 **không**
redirect ở server — trả `{ signedOut: true }`, `_ui/session-cards.tsx` gọi `window.location.assign("/login")` (điều hướng cứng như bảng trên) ✅ code.

---

## 7. Danh sách thiết bị — `/account/security` ✅

`apps/web/lib/account-sessions.ts` (bảng L1, `getPrismaClient()`, luôn lọc `userId` của người gọi):

- `listAccountSessions(user)`: token còn hiệu lực (`revokedAt` NULL, `replacedById` NULL, chưa hết hạn), mỗi `familyId` lấy token mới nhất; bỏ phiên
  đã quá idle/absolute (chưa kịp bị thu hồi vì không ai gọi refresh). Trả `{ id: familyId, deviceLabel, deviceKind, ip, startedAt, lastActiveAt,
  rememberMe, isCurrent }` (`deviceKind` = `describeDeviceKind(UA)`: `desktop` | `mobile` | `tablet`, chỉ để chọn icon; UA trống → `desktop`;
  Android không có "Mobile" → `tablet`); thiết bị hiện tại lên đầu, còn lại theo hoạt động gần nhất.
- `deviceLabel` = `describeUserAgent(UA)` (`packages/auth/src/device-label.ts`) dạng "Chrome · Windows" — nhận Cốc Cốc, Edge, Opera, Samsung Internet,
  Firefox, Chrome, Safari; iPhone, iPad, Android, Windows, macOS, ChromeOS, Linux; không nhận được → "Thiết bị không xác định". Chỉ để người dùng nhận
  ra thiết bị, không định danh (UA giả được).
- `revokeAccountSession(user, familyId)`: `familyId` phải là chuỗi 1–100 ký tự (sai → 400 `VALIDATION_ERROR`); `updateMany` lọc `userId` + `familyId` →
  không khớp → 404 (không tiết lộ phiên của người khác có tồn tại không).
- Server Action `revokeSessionAction(formData)` (`requireUser()`): ô ẩn `sessionId`; 404 → chỉ làm mới danh sách; đăng xuất chính thiết bị này → xoá
  cookie, trả `{ signedOut: true }` (client điều hướng cứng `/login`); còn lại `revalidatePath("/account/security")`, trả `{ signedOut: false }`. **Không** ghi audit (giống `logoutAllDevicesAction`).
- UI: `session-list.tsx` (server, định dạng giờ `DISPLAY_TIME_ZONE`) → `_ui/session-cards.tsx` (thẻ thiết bị, `ConfirmDialog`, thông báo cấp danh sách) —
  [[04-Operations-Runbooks/UI-Design-System|UI-Design-System]] §23.2. Nằm trên nút "Đăng xuất mọi thiết bị" (giữ nguyên). IP chỉ hiện cho chính chủ tài khoản.

---

## 8. Dọn bản ghi phiên — cron ✅

Bước **`refresh_tokens.purge`** trong `GET /api/cron/daily` (sau `abuse_report.ip_purge`, trước `queue.drain`) → `purgeStaleRefreshTokens()`: xoá dòng
`refresh_tokens` có `expiresAt` **hoặc** `revokedAt` cũ hơn **90 ngày** (`SESSION_RECORD_RETENTION_DAYS`) — gồm cả token đã bị thay (hết hạn cùng phiên).
Token còn hiệu lực không bao giờ bị xoá. Kết quả `sessionPurge: { ok, result: { deleted } }` — chỉ số đếm. Index mới `expiresAt`, `revokedAt` phục vụ
bước này. Vận hành: [[04-Operations-Runbooks/Deploy-Vercel-Runbook|Deploy-Vercel-Runbook]] §6.6.

---

## 9. Cấu hình — System Center `/admin/settings/general` ✅

Nhóm mới **"Chính sách phiên đăng nhập"** (6 khoá, `SYSTEM_SETTINGS_BOUNDS`):

| Khoá | Mặc định | Giới hạn | Nhãn |
| :-- | :-: | :-: | :-- |
| `sessionIdleMinutes` | 60 | 10–1440 phút | Tự đăng xuất khi không thao tác |
| `sessionAbsoluteHours` | 12 | 1–72 giờ | Thời hạn tối đa một phiên |
| `rememberMeDays` | 30 | 1–30 ngày | Thời hạn "Ghi nhớ đăng nhập" (trần 30 ngày — comment code dẫn NIST SP 800-63B AAL1) |
| `adminIdleMinutes` | 15 | 10–60 phút | Tự đăng xuất quản trị viên khi không thao tác |
| `adminAbsoluteHours` | 8 | 1–24 giờ | Thời hạn tối đa phiên quản trị viên |
| `sessionWarningMinutes` | 2 | 1–10 phút | Cảnh báo trước khi tự đăng xuất |

- Idle tối thiểu 10 phút vì chu kỳ làm mới phía client ≤ idle/3 (comment code).
- **Ràng buộc chéo** `validateSessionSettings` (sau zod): cảnh báo < `min(sessionIdleMinutes, adminIdleMinutes)`; `sessionIdleMinutes ≤
  sessionAbsoluteHours·60`; `adminIdleMinutes ≤ adminAbsoluteHours·60` — lỗi theo ô, từ chối cả form (`VALIDATION_ERROR`).
- `refreshTokenTtlDays` ngừng dùng (ẩn khỏi form, lý do trong `INACTIVE_SYSTEM_SETTINGS`); cột giữ tới migration contract.
- Phạm vi hiệu lực: áp cho **mọi phiên** từ lần refresh kế tiếp (§2), không chỉ phiên mới.

---

## 10. Giới hạn đã biết

- Access token đã cấp vẫn sống tới hết TTL sau khi thu hồi phiên / quá absolute (absolute chỉ kiểm khi refresh) ✅ suy từ code — TTL access nay ≤ idle.
- ~~`updateProfileAction` ký lại access token thiếu claim `rm`~~ — **đã sửa 2026-10-24** qua `issueAccessCookieForSession` (§1.1; KB-Audit §33 mục 1).
  Còn lại: lần ký lại này đặt `iat` mới nên mốc idle phía client (`sessionIssuedAtMs`) dời theo, trong khi server vẫn đo idle từ `createdAt` của refresh
  token; helper cũng không xét idle/absolute trước khi ký (TTL access ≤ idle nên phần dư bị giới hạn) ✅ suy từ code, tác động thật ❓.
- Chưa kiểm trên trình duyệt thật: session cookie khi đóng/mở trình duyệt (một số trình duyệt khôi phục phiên làm việc giữ cả session cookie), Web Locks
  /BroadcastChannel nhiều tab, máy ngủ dậy, Safari iOS ❓.

---

## 11. Kiểm thử ✅ đếm

`pnpm test:count` = **99/99 unit, 63/63 integration** sau phần phiên đăng nhập (trần 99/63 — ADR-053 nâng từ 95/57; hiện **100/66** sau tự lưu nháp + ADR-054 —
[[04-Operations-Runbooks/Publish-And-Rollback-Runbook|Publish-And-Rollback-Runbook]] §2.2):

- Unit: `packages/auth/src/session-policy.test.ts` (3 — resolve theo vai trò/"Ghi nhớ", idle/absolute, nhãn thiết bị); `refresh-token.test.ts` +1 (ân hạn
  → `superseded`, quá hạn/đã thu hồi → `reused`).
- Integration: `auth.test.ts` +2 (refresh đồng thời chỉ rotate một lần, bên thua không thu hồi family/không xoá cookie; từ chối user không ACTIVE);
  `session-policy.test.ts` 4 (cookie "Ghi nhớ" + admin bị bỏ qua; idle/absolute/phiên cũ; danh sách thiết bị + quyền sở hữu; purge 90 ngày). Bản sửa
  `issueAccessCookieForSession` được kiểm bằng helper `reissueFor` trong cùng file, không thêm test case (vẫn 99/63 ✅ đếm 2026-10-24).
- Kết quả chạy `pnpm test` 🟡 (Quốc báo, Long không chạy): pass, trừ test RLS trong `order.test.ts` timeout 20 giây — đã có từ trước (KB-Audit §31 mục 6).

---

## 12. Liên kết

* [[01-Architecture-Decisions/ADR-039-Session-Policy-Remember-Me-Idle-Absolute|ADR-039 KB (≙ ADR-053)]] · [[01-Architecture-Decisions/ADR-018-System-Settings-And-Brand-From-System-Center|ADR-018 KB (≙ ADR-032)]]
* [[02-System-Specs/User-Management-System-Center-Specs|User-Management-System-Center-Specs]] §4 ([User-Management-System-Center-Specs.md](./User-Management-System-Center-Specs.md)) · [[02-System-Specs/Account-Profile-Specs|Account-Profile-Specs]] §4 ([Account-Profile-Specs.md](./Account-Profile-Specs.md)) · [[02-System-Specs/Background-Jobs-Specs|Background-Jobs-Specs]] §5 ([Background-Jobs-Specs.md](./Background-Jobs-Specs.md))
* [[03-API-Contracts/Endpoint-Directory|Endpoint-Directory]] §3.2–§3.3, §17, §21.4 ([Endpoint-Directory.md](../03-API-Contracts/Endpoint-Directory.md)) · [[03-API-Contracts/Database-Schema-Reference|Database-Schema-Reference]] §3.1, §7 ([Database-Schema-Reference.md](../03-API-Contracts/Database-Schema-Reference.md))
* [[04-Operations-Runbooks/Deploy-Vercel-Runbook|Deploy-Vercel-Runbook]] §6.6, §9.12 ([Deploy-Vercel-Runbook.md](../04-Operations-Runbooks/Deploy-Vercel-Runbook.md))
* Mã nguồn: `packages/auth/src/{session-policy,device-label}.ts`, `packages/auth/src/tokens/{refresh-token,access-token}.ts`, `apps/web/app/api/auth/{login,refresh}/route.ts`,
  `apps/web/lib/{cookies,session,session-access,jwt-context,account-sessions,system-settings,account-profile}.ts`, `apps/web/app/_ui/session-refresh.tsx`, `apps/web/app/layout.tsx`,
  `apps/web/app/account/security/*`, `packages/core/src/settings/system-settings.ts`

*Quay lại: [[MOC-Home]] ([MOC-Home.md](../00-Index/MOC-Home.md))*

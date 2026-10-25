---
tags:
  - adr
  - auth
  - session
  - security
  - account
  - system-admin
  - autosave
  - status/accepted
date: 2026-10-24
decider: vtphong91
status: Accepted (Chốt — Áp dụng chính thức)
---

# 🏛️ ADR-039: Phiên đăng nhập — sửa header cache, "Ghi nhớ đăng nhập", idle/absolute timeout, danh sách thiết bị

> [!note] Đổi số (2 lần)
> - **2026-10-24:** bản trích này ban đầu là **`ADR-037-Session-Policy-Remember-Me-Idle-Absolute`** (≙ ADR-051). Khi gộp commit `c63b72b` của vuong,
>   ADR-051 gốc thuộc về "lưu trữ kích hoạt xoá tài liệu" (bản trích [[01-Architecture-Decisions/ADR-037-Product-Archive-Deletion-Storage-Cleanup|ADR-037 KB]])
>   nên quyết định phiên đăng nhập đổi thành ADR-052, bản trích KB thành `ADR-038-…`. Xem [[00-Index/KB-Audit-2026-09-26|KB-Audit]] §34.
> - **2026-10-25:** khi gộp commit `8fb05ca`/`f9dc9ce` của vuong, ADR-052 gốc thuộc về "giám sát dung lượng bucket và đối soát storage" (bản trích
>   [[01-Architecture-Decisions/ADR-038-Realtime-Storage-Monitoring-And-Reconciliation|ADR-038 KB]]) nên quyết định phiên đăng nhập đổi thành **ADR-053**
>   trong `docs/DECISIONS.md`, bản trích KB thành **ADR-039**. Xem [[00-Index/KB-Audit-2026-09-26|KB-Audit]] §36.
> - Thư mục migration đã chạy giữ tên cũ `…_adr051_session_policy`, `…_adr051_editor_drafts` (thuộc ADR-053).

## 1. Trạng Thái (Status)
**ĐÃ PHÊ DUYỆT (Accepted)** — tương ứng **ADR-053** trong [`docs/DECISIONS.md`](../../docs/DECISIONS.md) (chủ dự án chốt 2026-10-24). Bản trích ghi
theo duyệt của Quốc (brief 2026-10-24), gồm **"Bổ sung ADR-053 lần 2"** (Quốc, sau review GĐ B) và — từ đợt ghi 2026-10-24 sau đổi số — **"Bổ sung
ADR-053"** + **"Bổ sung ADR-053 lần 3"** (tự lưu nháp editor lên server, §3A).

Tiến độ (2026-10-24): code **GĐ A** và **GĐ B** xong ở working tree, **chưa commit** ✅ `git status`; Quốc báo đã verify 🟡. Migration
`20261024090000_adr051_session_policy` **đã chạy trên DB dùng chung** 🟡 (brief Quốc; Long không chạy lệnh DB). Không thêm `route.ts` (23 dưới `/api`,
24 toàn app ✅ đếm). `schema.prisma` vẫn **50 model / 33 enum** ✅ đếm. `pnpm test:count` = **99/99 unit, 63/63 integration** ✅ (Long chạy, chỉ đếm).

Mức xác minh: ✅ Long đã đối chiếu code working tree · 🟡 theo `docs/DECISIONS.md`/brief của Quốc · ❓ cần môi trường thật.

---

## 2. Bối Cảnh (Context) 🟡
Header `/pricing`, `/cua-hang` hiện sai trạng thái đăng nhập. Hiếu chẩn đoán: layout chứa `SiteHeader` + `loading.tsx` được Next prefetch và tái dùng
~5 phút (staleTimes); login/logout gọi Route Handler bằng `fetch` rồi `router.push/refresh` nên client cache không bị xoá → có thể **lộ tên/email người
vừa đăng xuất**. Phụ: nhiều tab refresh cùng lúc bị coi là reuse → đăng xuất toàn bộ; rotation không nguyên tử. Trước ADR-053 phiên luôn persistent,
không idle, refresh trượt 7 ngày (vô hạn nếu dùng đều).

---

## 3. Quyết Định (Decision)

1. **GĐ A — sửa ngay, không migration:** sau login/logout **điều hướng cứng** (`window.location.assign`); refresh có **ân hạn 30 giây** cho token vừa
   bị thay (không thu hồi family, không xoá cookie) + **rotation nguyên tử**; `SessionRefresh` khoá giữa các tab, làm mới khi tab hiện lại, 401 → cập
   nhật UI; route refresh kiểm `user.status`.
2. **GĐ B — chính sách phiên:**

   | | Không tick "Ghi nhớ" (mặc định) | Tick "Ghi nhớ" | SYSTEM_ADMIN |
   | :-- | :-- | :-- | :-- |
   | Cookie refresh | session cookie (đóng trình duyệt = đăng xuất) | persistent tới hết absolute | luôn session cookie — checkbox vẫn hiện (lúc nhập chưa biết vai trò), server bỏ qua "Ghi nhớ" |
   | Idle (đo ở server) | 60 phút | không áp | 15 phút |
   | Absolute (từ lúc login, không trượt) | 12 giờ | 30 ngày | 8 giờ |
   | Cảnh báo trước idle | 2 phút, nút "Tiếp tục" | — | có |

   Chủ gian hàng và khách mua **cùng** mức. Checkbox "Ghi nhớ" **mặc định tắt**. Người dùng đang thao tác (gõ, bấm, cuộn, quay lại tab) = còn hoạt
   động. Các con số cấu hình được trong System Settings.
3. **Soạn thảo luôn tự lưu nháp** — hạng mục riêng, chi tiết ở §3A.
4. **Danh sách thiết bị đăng nhập** ở trang tài khoản: thiết bị + trình duyệt (từ User-Agent), lúc đăng nhập, hoạt động gần nhất; đăng xuất từng thiết
   bị (giữ nút đăng xuất mọi thiết bị). Bản ghi phiên hết hạn/đã thu hồi **tự xoá sau 90 ngày** (cron `/api/cron/daily`).
5. **Test** nâng trần theo nhu cầu module — kết quả: **95/57 → 99/63** (GĐ A +1/+2, GĐ B +3/+4) ✅ `scripts/count-tests.mjs`.

**Bổ sung ADR-053 lần 2 (2026-10-24, Quốc — sau review GĐ B):**
- Cấu hình phiên trong System Settings (và đổi vai trò) áp cho **cả phiên đang mở** từ lần refresh kế tiếp — **chủ ý** vì là thay đổi bảo mật, ngoại lệ
  của nguyên tắc "chỉ áp cho thao tác mới" của ADR-032 ([[01-Architecture-Decisions/ADR-018-System-Settings-And-Brand-From-System-Center|ADR-018 KB]]) ✅ khớp code.
- Phiên tạo trước ADR-053, sau lần refresh đầu, thành phiên **không ghi nhớ** (cookie session, idle 60 phút) — chấp nhận; muốn giữ thì đăng nhập lại có
  tick "Ghi nhớ" ✅ khớp code.
- Cron dọn token chỉ chạy khi có lịch gọi `/api/cron/daily` — trên VPS cần crontab (việc chờ của ADR-049) ❓.

**Migration (GĐ B, expand-only, chủ dự án chạy):** `refresh_tokens` thêm `rememberMe`, `sessionStartedAt`, `deviceLabel` + 2 index; `system_settings`
thêm 6 cột cấu hình phiên. `refreshTokenTtlDays` giữ cột (contract sau khi code ADR-053 lên prod).

---

## 3A. Tự lưu nháp editor lên server ("Bổ sung ADR-053" + "lần 3")

**Bổ sung ADR-053 (2026-10-24, chủ dự án chốt)** 🟡: tự lưu nháp **lên server**, không lưu cục bộ trình duyệt (tránh nội dung gian hàng nằm trên máy
dùng chung). Ưu tiên bài viết, tài liệu, trang gian hàng (Studio) → các editor CMS System Center.

**Bổ sung ADR-053 lần 3 (2026-10-24, chủ dự án duyệt thiết kế — `docs/ke-hoach-tu-luu-nhap-2026-10-24.md`)** 🟡:
- 2 bảng nháp riêng theo layer: `tenant_editor_drafts` (L2, RLS chỉ `tenant` + `system_job`) và `system_editor_drafts` (L1, chỉ SYSTEM_ADMIN) ✅ khớp SQL.
- Nháp **theo từng người dùng**; autosave không bao giờ ghi vào bản đã lưu/live ✅ khớp lib.
- Debounce 3 giây, tối đa 30 giây/lần, lưu khi rời tab ✅ khớp hook; không lưu khi đóng tab (giữ `beforeunload`).
- Xung đột → tab đó dừng autosave, cho chọn tải bản mới / ghi đè ✅ (hook `resolveConflict`/`overwrite`); khôi phục bằng banner "Khôi phục / Bỏ"
  (UI chưa làm).
- Lưu/Xuất bản xoá nháp (`discardDraft`); nháp không động tới quá **30 ngày** tự xoá (cron — `purgeStaleDrafts` có, **chưa gắn** cron).
- Tenant READ_ONLY/LOCKED **không** autosave ✅; không autosave `cms-page-form`; không audit mỗi lần autosave ✅.
- Cảnh báo "bản đã lưu bị sửa nơi khác" cho nút Lưu là hạng mục riêng sau. Thứ tự: bài viết → tài liệu → trang gian hàng → CMS → pháp lý → cron.

**Tiến độ** (2026-10-24): **phần nền** xong ở working tree, chưa commit ✅ — migration `20261024120000_adr051_editor_drafts` (đã chạy 🟡),
`packages/core/src/content/editor-draft.ts`, `apps/web/lib/editor-draft.ts`, `apps/web/lib/use-server-autosave.ts`, sự kiện `gieochu:session-expiring` ở
`session-refresh.tsx`. **Chưa gắn vào editor nào.** Test +1 unit / +2 integration → 100/65 (sau ADR-054: 100/66) ✅ `pnpm test:count`.
Đặc tả: [[02-System-Specs/Editor-Autosave-Drafts-Specs|Editor-Autosave-Drafts-Specs]].

---

## 4. Đối chiếu code ✅ (working tree 2026-10-24)

| Hạng mục | Nơi trong code |
| :-- | :-- |
| Chính sách phiên (module thuần) | `packages/auth/src/session-policy.ts` — `resolveSessionPolicy`, `evaluateSessionTimeouts`, `sessionExpiresAt`, `refreshCookieMaxAgeSeconds` |
| Nhãn thiết bị | `packages/auth/src/device-label.ts` — `describeUserAgent`, `UNKNOWN_DEVICE_LABEL` |
| Ân hạn + `superseded` | `packages/auth/src/tokens/refresh-token.ts` — `REFRESH_REUSE_GRACE_MS = 30_000`, `issueRefreshToken`, `evaluateRefreshToken(record, now, { replacedAt })` |
| Claim `rm` | `packages/auth/src/tokens/access-token.ts` |
| Route | `app/api/auth/login/route.ts` (`rememberMe`), `app/api/auth/refresh/route.ts` |
| Ký access token (nơi duy nhất) | `lib/session-access.ts` — `signSessionAccessToken` (login, refresh), `issueAccessCookieForSession` (ký lại khi đổi hồ sơ, đọc `rememberMe` theo `sid`) |
| Thư viện web | `lib/cookies.ts` (`refreshMaxAgeSeconds: number \| null`, `setAccessCookie`), `lib/jwt-context.ts` (`getSessionPolicy`), `lib/session.ts` (`getSessionClientInfo`), `lib/account-sessions.ts` |
| Client | `app/_ui/session-refresh.tsx`, `app/layout.tsx`, `app/(auth)/login/login-form.tsx`, `app/_ui/account-menu.tsx`, `app/account/_ui/logout-button.tsx` |
| Trang tài khoản | `app/account/security/{page.tsx,session-list.tsx,actions.ts}` (`revokeSessionAction` → `{ signedOut }`, client điều hướng cứng), `_ui/session-cards.tsx`; `AccountSessionView.deviceKind` (`describeDeviceKind`) |
| Cấu hình | `packages/core/src/settings/system-settings.ts` (6 khoá + `validateSessionSettings`), `lib/system-settings.ts`, `app/admin/settings/general/general-settings-form.tsx` |
| Cron | bước `refresh_tokens.purge` trong `app/api/cron/daily/route.ts` → `purgeStaleRefreshTokens()` |
| Migration | `packages/db/prisma/migrations/20261024090000_adr051_session_policy/migration.sql` |
| Test | unit `packages/auth/src/session-policy.test.ts` (3), `refresh-token.test.ts` (+1 ân hạn); integration `apps/web/tests/integration/session-policy.test.ts` (4), `auth.test.ts` (+2) |

Chi tiết nghiệp vụ: [[02-System-Specs/Auth-Session-Specs|Auth-Session-Specs]].

---

## 5. Hệ Quả (Consequences)
- Phiên tạo trước ADR-053 (`sessionStartedAt` NULL) **không** bị đăng xuất lúc deploy: lần refresh đầu sau deploy coi là lúc bắt đầu phiên; token mới
  mang `rememberMe = false` của bản ghi cũ → từ đó là phiên **không ghi nhớ** (cookie session) ✅ code.
- Đổi cấu hình phiên ở System Center có hiệu lực với **cả phiên đang mở** từ lần refresh kế tiếp (policy tính lại mỗi lần refresh từ cấu hình hiện
  hành; hạn token mới = `sessionStartedAt` + absolute mới) ✅ code — ngoại lệ có chủ ý của ADR-032 ("Bổ sung ADR-053 lần 2").
- Thu hồi phiên vẫn chưa chặn access token đã cấp (sống tới hết TTL) — nay TTL access bị kẹp ≤ idle ✅ code; giới hạn cũ ở BACKLOG.
- Hộp thoại cảnh báo hết phiên và thẻ thiết bị do Phong hoàn thiện (2026-10-24) — [[04-Operations-Runbooks/UI-Design-System|UI-Design-System]] §23.
- Chưa kiểm trên trình duyệt thật: đóng/mở trình duyệt với session cookie, Web Locks/BroadcastChannel nhiều tab, máy ngủ dậy ❓.

---

## 6. Liên Kết
* [[01-Architecture-Decisions/ADR-018-System-Settings-And-Brand-From-System-Center|ADR-018 KB (≙ ADR-032)]] — cấu hình hệ thống (thêm 6 khoá, `refreshTokenTtlDays` ngừng dùng) · [[01-Architecture-Decisions/ADR-022-Background-Jobs-After-And-Daily-Cron|ADR-022 KB (≙ ADR-036)]] — cron hằng ngày · [[01-Architecture-Decisions/ADR-027-Account-Upgrade-Pricing-Profile-Refund|ADR-027 KB (≙ ADR-041)]] — `/account/security`
* [[02-System-Specs/Auth-Session-Specs|Auth-Session-Specs]] ([Auth-Session-Specs.md](../02-System-Specs/Auth-Session-Specs.md)) · [[02-System-Specs/Editor-Autosave-Drafts-Specs|Editor-Autosave-Drafts-Specs]] ([Editor-Autosave-Drafts-Specs.md](../02-System-Specs/Editor-Autosave-Drafts-Specs.md))
* [[03-API-Contracts/Endpoint-Directory|Endpoint-Directory]] §3.2–§3.3, §17, §21.4 · [[03-API-Contracts/Database-Schema-Reference|Database-Schema-Reference]] §3.1, §7
* [[04-Operations-Runbooks/Deploy-Vercel-Runbook|Deploy-Vercel-Runbook]] §6.1, §6.6, §9.12

*Quay lại: [[MOC-Home]] (../00-Index/MOC-Home.md)*

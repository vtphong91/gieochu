---
tags:
  - adr
  - system-admin
  - security
  - auth
  - deployment
  - database
  - status/accepted
date: 2026-10-15
updated: 2026-10-24
decider: vtphong91
status: Accepted (Chốt — Áp dụng chính thức)
---

# 🏛️ ADR-018: Cấu Hình Hệ Thống Và Thương Hiệu Lấy Từ System Center (DB); Env Chỉ Còn Hạ Tầng + Secret

## 1. Trạng Thái (Status)
**ĐÃ PHÊ DUYỆT (Accepted)** — tương ứng **ADR-032** trong [`docs/DECISIONS.md`](../../docs/DECISIONS.md) (chủ dự án yêu cầu
2026-09-29), kèm mục **"Sự cố 2026-10-15 (ADR-032)"** ghi ở cuối ADR-033 trong cùng file. **Đã xong code** (working tree
chưa commit tại 2026-10-15). Thay thế phần env của [[01-Architecture-Decisions/ADR-017-Vercel-Deploy-Build-Without-Env|ADR-017 (≙ ADR-031)]]
về danh sách biến runtime. Quy trình thao tác: [[04-Operations-Runbooks/Deploy-Vercel-Runbook|Deploy-Vercel-Runbook]] §3, §9.

Mức xác minh: ✅ Long đã đối chiếu code/migration (2026-10-15) · 🟡 theo `docs/DECISIONS.md`/brief của Quốc · ❓ cần môi
trường thật.

---

## 2. Bối Cảnh (Context)
Env Vercel chứa nhiều biến nghiệp vụ/thương hiệu (`APP_NAME`, `TZ_DISPLAY`, các TTL, `TRIAL_DAYS`…). Chủ dự án yêu cầu mọi
cấu hình tuỳ chọn và chuỗi thương hiệu quản lý ở System Center, lưu DB; chọn đưa cả TTL bảo mật vào System Center **có giới
hạn**, và refactor xong mới deploy 🟡.

---

## 3. Quyết Định (Decision)
1. **Env runtime chỉ còn 8 biến bắt buộc:** `APP_URL`, `DATABASE_URL`, `DIRECT_URL`, `JWT_ACCESS_SECRET`, `JWT_ISSUER`,
   `JWT_AUDIENCE`, `PAYMENT_ENCRYPTION_KEY`, `STORAGE_ENCRYPTION_KEY` (+ `NODE_ENV` do nền tảng đặt, schema mặc định
   `development`) ✅ `packages/config/src/env.ts`. Biến tuỳ chọn còn trong schema: `TEST_DATABASE_URL` (dev/CI),
   `CLAMAV_HOST`, nhóm email fallback dev (`EMAIL_PROVIDER` mặc định `smtp`, `EMAIL_FROM` — chuỗi rỗng coi như chưa đặt,
   `SMTP_HOST`, `SMTP_PORT`, `RESEND_API_KEY`), `MOMO_SANDBOX_ENDPOINT` (dev) ✅.
   *Cập nhật sau ADR-032:* thêm 2 biến **hạ tầng** tuỳ chọn — `CRON_SECRET` (ADR-036, nếu đặt thì ≥ 32 ký tự) và
   `STORAGE_GATEWAY_PROVIDERS` (ADR-045, danh sách `MINIO`/`CLOUDFLARE_R2`, giá trị lạ → fail-fast; chỉ đặt trên máy có nginx Storage
   Gateway) ✅ `packages/config/src/env.ts` 2026-10-22. Cả hai là topo/secret hạ tầng của từng process, không phải cấu hình nghiệp vụ —
   không trái quy tắc §4.6. Xem [[01-Architecture-Decisions/ADR-030-Storage-Gateway-Encrypted-Ticket-Nginx|ADR-030 (≙ ADR-045)]].
2. **Thương hiệu:** `APP_NAME/APP_SHORT_NAME/APP_SLOGAN` bỏ khỏi env ✅. Nguồn duy nhất là `SystemBranding` (DB, trang
   `/admin/settings/branding`); fallback là hằng **một chỗ**:
   - `DEFAULT_BRAND` (`name`, `shortName`, `slogan`, đóng băng) + hàm thuần `resolveBrand(stored)` trong
     `@gieochu/config/brand` (`packages/config/src/brand.ts`) ✅. `resolveBrand` lấy `brandName`/`brandSlogan` đã `trim`,
     rỗng → mặc định; `shortName` **luôn** là mặc định vì `SystemBranding` chưa có cột tên ngắn ✅.
   - `getEffectiveBrand()` (`apps/web/lib/branding.ts`) — async, đọc `SystemBranding` qua `getSystemBranding()` bọc React
     `cache()` (dedupe trong 1 request; ngoài React là passthrough → worker/script đọc lại DB mỗi lần) ✅.
   - Hàm cũ `getBrand()` **đã bỏ** — không còn chỗ gọi trong `apps/`/`packages/` ✅ (grep 2026-10-15).
3. **Cấu hình hệ thống** — bảng L1 `system_settings` (1 dòng `id="default"`), trang `/admin/settings/general`, đọc có cache theo
   request, đổi có hiệu lực cho **thao tác mới** (không hồi tố token/đơn/hoá đơn đã tạo). Bảng mặc định + giới hạn — nguồn duy
   nhất `SYSTEM_SETTINGS_BOUNDS` (`packages/core/src/settings/system-settings.ts`, subpath client
   `@gieochu/core/system-settings`) ✅, khớp ADR-032:

   | Khoá | Mặc định | Giới hạn |
   | :-- | :-: | :-: |
   | `accessTokenTtlMinutes` | 15 | 5–60 phút |
   | `refreshTokenTtlDays` | 7 | 1–30 ngày |
   | `emailVerifyTtlHours` | 24 | 1–72 giờ |
   | `passwordResetTtlMinutes` | 30 | 10–120 phút |
   | `presignUploadTtlSeconds` | 600 | 60–3600 giây |
   | `presignDownloadTtlSeconds` | 600 | 60–600 giây (§7.6 ≤ 10 phút) |
   | `trialDays` | 14 | 0–60 ngày — **chưa dùng** (xem §4) |
   | `graceDays` | 7 | 0–30 ngày |
   | `orderPendingTtlMinutes` | 60 | 15–1440 phút |
   | `invoicePendingTtlHours` | 24 | 1–168 giờ |
   | `defaultDownloadLimit` | 5 | 0–1000 lượt (0 = không giới hạn) |

   > [!note] Cập nhật ADR-053 (2026-10-24, ≙ [[01-Architecture-Decisions/ADR-039-Session-Policy-Remember-Me-Idle-Absolute|ADR-039 KB]]) ✅ code
   > Thêm 6 khoá chính sách phiên (nhóm "Chính sách phiên đăng nhập" trên form): `sessionIdleMinutes` 60 (10–1440 phút), `sessionAbsoluteHours`
   > 12 (1–72 giờ), `rememberMeDays` 30 (1–30 ngày), `adminIdleMinutes` 15 (10–60 phút), `adminAbsoluteHours` 8 (1–24 giờ), `sessionWarningMinutes`
   > 2 (1–10 phút) — tổng 17 khoá. Ràng buộc chéo `validateSessionSettings`: cảnh báo < idle nhỏ nhất; idle ≤ absolute của cùng nhóm.
   > `refreshTokenTtlDays` thành khoá **không còn dùng** (`INACTIVE_SYSTEM_SETTINGS`, ẩn trên form; cột giữ tới migration contract);
   > `getRefreshTokenTtl()` đã xoá, thay bằng `getSessionPolicy(role, rememberMe)`. Khác §4.3 "chỉ token mới": cấu hình phiên áp cho cả phiên đang
   > mở từ lần refresh kế tiếp — xem [[02-System-Specs/Auth-Session-Specs|Auth-Session-Specs]] §4.

   Validate server bằng zod (`systemSettingsSchema`; số nguyên, ngoài khoảng → từ chối cả form). Chỉ `SYSTEM_ADMIN` sửa; ghi
   log thay đổi cũ→mới — từ M12a (2026-10-16) ghi thêm `audit_logs` action `SYSTEM_SETTINGS_UPDATED` (metadata `changes` cũ→mới) ✅,
   xem [[01-Architecture-Decisions/ADR-023-M12-Audit-Log-Append-Only|ADR-023 (≙ ADR-037)]].
4. **Múi giờ hiển thị** là hằng `DISPLAY_TIME_ZONE = "Asia/Ho_Chi_Minh"` trong code (`@gieochu/core/system-settings`), không
   cấu hình ✅.

---

## 4. Hệ Quả & Ràng Buộc Kỹ Thuật (Consequences & Rules)

### 4.1. Dữ liệu ✅
* Migration `20260929090000_adr032_system_settings`: thêm **10 cột** vào `system_settings` — 9 cột `INTEGER NOT NULL` có
  default (`accessTokenTtlMinutes`, `refreshTokenTtlDays`, `emailVerifyTtlHours`, `passwordResetTtlMinutes`,
  `presignUploadTtlSeconds`, `presignDownloadTtlSeconds`, `orderPendingTtlMinutes`, `invoicePendingTtlHours`,
  `defaultDownloadLimit`) + `updatedById TEXT` (không FK — xoá user không chặn cấu hình); bỏ `NOT NULL` của `platformName`,
  `supportEmail`; đặt default `trialDays=14`, `graceDays=7`.
* Migration `20260929100000_adr032_drop_platform_name`: `ALTER TABLE "system_settings" DROP COLUMN "platformName"` (không
  `IF EXISTS`). `schema.prisma` model `SystemSettings` **không còn** `platformName` ✅. **Trên DB dùng chung dev/production
  cột đã được khôi phục** sau sự cố — xem §5.
* `seed.ts` chỉ tạo dòng `default` với `supportEmail` (`SEED_SUPPORT_EMAIL` hoặc mặc định), `update: {}` — 11 khoá lấy default
  của DB ✅.

### 4.2. Đọc cấu hình ✅
* `getSystemSettings()` (`apps/web/lib/system-settings.ts`) = `cache(loadSystemSettings)`: dedupe theo request; ngoài React
  (worker pg-boss, script) đọc lại DB mỗi lần → worker nhận thay đổi mà không cần khởi động lại.
* Parse phòng thủ `parseStoredSystemSettings`: từng khoá thiếu/sai kiểu/ngoài khoảng → dùng mặc định của khoá đó + log warn,
  không throw; chưa có dòng → toàn bộ mặc định (warn 1 lần/tiến trình).
* `INACTIVE_SYSTEM_SETTINGS = { trialDays: "Chưa dùng — mô hình Free Forever, ADR-021." }`: lưu + validate nhưng UI ẩn; form
  không gửi khoá này thì giữ giá trị cũ.
* Root `app/layout.tsx` đọc `getAccessTokenTtlSeconds()` cho mọi trang (cùng lúc với màu thương hiệu) → mỗi request trang
  thêm 1 truy vấn `system_settings` ngoài truy vấn branding đã có từ ADR-031 ✅ (chi phí chưa đo ❓). *Từ ADR-053:* layout đọc
  `getSessionClientInfo()` (claim access token, không DB) + `getSessionPolicy()` thay `getAccessTokenTtlSeconds()` — vẫn 1 lần đọc
  `system_settings` (qua `cache()`) ✅.

### 4.3. Nơi tiêu thụ ✅
| Khoá | Nơi dùng |
| :-- | :-- |
| `accessTokenTtlMinutes` | `getAccessTokenTtlSeconds()` (`lib/jwt-context.ts`) — chỉ token **mới** ký; token cũ giữ `exp` |
| `refreshTokenTtlDays` | ~~`getRefreshTokenTtl()`~~ — **không còn dùng từ ADR-053** (hàm đã xoá); hạn refresh = lúc đăng nhập + absolute theo `getSessionPolicy()` |
| `session*`, `rememberMeDays`, `admin*` (ADR-053) | `getSessionPolicy()` (`lib/jwt-context.ts`) → login/refresh route, root layout (`SessionRefresh`), `lib/account-sessions.ts` |
| `emailVerifyTtlHours` | `api/auth/register`, `api/auth/resend-verification`, `lib/admin-users.ts` — token + email hiển thị hạn động (`expiresInHours`) |
| `passwordResetTtlMinutes` | `api/auth/forgot-password` — token (`/60` giờ) + email hiển thị `expiresInMinutes` |
| `presignUploadTtlSeconds` | `lib/product-upload.ts` |
| `presignDownloadTtlSeconds` | `lib/download.ts`, `lib/share-link.ts`; `packages/storage` kẹp thêm `clampDownloadTtlSeconds` ≤ `MAX_DOWNLOAD_PRESIGN_TTL_SECONDS` (600) lúc ký |
| `orderPendingTtlMinutes` | `lib/order.ts` (`computeOrderExpiresAt`), script demo |
| `invoicePendingTtlHours` | `lib/subscription-billing.ts` |
| `graceDays` | `lib/subscription-sweep.ts` |
| `defaultDownloadLimit` | `lib/product.ts` (tạo sản phẩm không truyền `downloadLimit`), trang Studio `products/new` (giá trị gợi ý trên editor) |
| `trialDays` | Không nơi nào dùng |

* **`SessionRefresh`** (`app/_ui/session-refresh.tsx`, mount ở root layout, nhận `accessTokenTtlSeconds`): gọi
  `POST /api/auth/refresh` mỗi **nửa TTL**, kẹp sàn 1 phút, trần 10 phút; 401 → dừng hẳn ✅.

### 4.4. Trang System Center ✅
* `/admin/settings/general` — "Cấu hình chung": guard `requireAdminAccess("/admin/settings/general")`; Server Action
  `updateSystemSettingsAction` (`requireRole("SYSTEM_ADMIN")`, `useActionState`, lỗi quyền/validate trả state, revalidate
  `/admin/settings/general` + `/admin/settings`). Form: tóm tắt lỗi `role="alert"` nhận focus, mỗi lỗi là link tới ô; nút
  **"Điền giá trị mặc định"** chỉ điền lại ô phía client (không lưu, tắt khi đã là mặc định); cảnh báo `role="status"` khi DB
  đang lưu giá trị sai (chỉ khoá đang hiện); dòng "Cập nhật lần cuối … bởi …" theo `DISPLAY_TIME_ZONE`.
* `/admin/settings` chỉ còn **`supportEmail`** — `updateSupportEmailAction` (`requireRole("SYSTEM_ADMIN")`, zod email, ghi
  `updatedById`).

### 4.5. Email ✅
* Production cấu hình ở `/admin/settings/smtp` (`SystemSmtpConfig`); env email chỉ là **fallback dev** (Mailpit). Thiếu cả hai:
  `sendEmailNow()` trả `{ ok:false, code:"EMAIL_NOT_CONFIGURED" }` + ghi `EmailSendLog` FAILED (trừ loại email khách tenant),
  **không** throw, app vẫn khởi động. `emailNotConfiguredError()` = `AppError` **503** — hiện chỉ ném ở luồng admin gửi lại
  email kích hoạt (`lib/admin-users.ts`); `api/auth/register` chỉ log warn, đăng ký vẫn 201.

### 4.6. Ràng buộc cho code sau
* Không thêm biến env nghiệp vụ/thương hiệu mới — đưa vào `SystemSettings`/`SystemBranding`.
* Không đọc chuỗi thương hiệu đồng bộ ở code chạy theo request — dùng `getEffectiveBrand()`; client component nhận tên thương
  hiệu qua prop từ server (login/register/onboarding đã làm vậy ✅).
* Thêm khoá cấu hình = thêm vào `SYSTEM_SETTINGS_BOUNDS` + cột DB theo **expand → contract** (§5).
* Định dạng ngày giờ hiển thị dùng `DISPLAY_TIME_ZONE`, không hard-code chuỗi múi giờ.

---

## 5. Sự Cố 2026-10-15 — Drop `platformName` Trên DB Dùng Chung 🟡
Theo `docs/DECISIONS.md` (mục "Sự cố 2026-10-15 (ADR-032)") và `CLAUDE.md` mục "Migration" — Long không có log production:
* Migration `20260929100000_adr032_drop_platform_name` chạy trên **DB dev, mà DB dev chính là DB production** → bản đang deploy
  trên Vercel (Prisma client còn model có `platformName`) lỗi **500**.
* Khôi phục: `ALTER TABLE "system_settings" ADD COLUMN IF NOT EXISTS "platformName" TEXT` (chạy tay; không có file migration
  tương ứng trong repo ✅).
* Hệ quả: `schema.prisma` hiện tại không có cột nhưng DB còn cột (nullable) — đúng trạng thái "expand" cho tới khi bản mới lên
  production. Migration contract `DROP COLUMN IF EXISTS "platformName"` (file **mới**, chưa tạo) chạy **sau** khi deploy bản
  không còn dùng cột. Quy trình: [[04-Operations-Runbooks/Deploy-Vercel-Runbook|Deploy-Vercel-Runbook]] §9.
* Quy tắc mới (`CLAUDE.md` mục "Migration"): agent **không tự chạy** `db:migrate`/DDL khi chưa được Quốc duyệt; migration theo
  **expand → contract**; tách DB dev bằng Neon branch — **đề xuất tách đã bị chủ dự án bác**, thay bằng một DB duy nhất + kỷ luật thao tác DB ([[01-Architecture-Decisions/ADR-020-Single-Database-Dev-Preview-Production|ADR-020 (≙ ADR-034)]]) ✅ (đã đọc `CLAUDE.md`).

---

## 6. Chưa Verify ❓
* Deploy bản ADR-032 lên Vercel với đúng 8 biến; xoá biến cũ trên Vercel.
* Trạng thái thật của `_prisma_migrations` trên DB production (bản ghi `20260929100000` đã "applied" trong khi cột đã được thêm
  lại) — cần kiểm trước khi chạy migrate kế tiếp.
* Chi phí thêm 1 truy vấn `system_settings`/request ở root layout.
* Đổi TTL ở `/admin/settings/general` có hiệu lực ngay cho đăng nhập mới/worker trên môi trường thật.

---

## 7. Tài Liệu Tham Chiếu & Liên Kết
* [[MOC-Home]] — Trang chủ Map of Content ([MOC-Home.md](../00-Index/MOC-Home.md))
* Tương ứng **ADR-032** trong [`docs/DECISIONS.md`](../../docs/DECISIONS.md) (gốc repo).
* [[01-Architecture-Decisions/ADR-017-Vercel-Deploy-Build-Without-Env|ADR-017 (≙ ADR-031)]] ([ADR-017-Vercel-Deploy-Build-Without-Env.md](./ADR-017-Vercel-Deploy-Build-Without-Env.md))
* [[01-Architecture-Decisions/ADR-007-Hybrid-Monetization-Free-Forever|ADR-007 (≙ ADR-021)]] — lý do `trialDays` chưa dùng ([ADR-007-Hybrid-Monetization-Free-Forever.md](./ADR-007-Hybrid-Monetization-Free-Forever.md))
* [[04-Operations-Runbooks/Deploy-Vercel-Runbook|Deploy-Vercel-Runbook]] ([Deploy-Vercel-Runbook.md](../04-Operations-Runbooks/Deploy-Vercel-Runbook.md))
* [[01-Architecture-Decisions/ADR-030-Storage-Gateway-Encrypted-Ticket-Nginx|ADR-030 (≙ ADR-045)]] — env tuỳ chọn `STORAGE_GATEWAY_PROVIDERS` ([ADR-030-Storage-Gateway-Encrypted-Ticket-Nginx.md](./ADR-030-Storage-Gateway-Encrypted-Ticket-Nginx.md))
* [[04-Operations-Runbooks/Publish-And-Rollback-Runbook|Publish-And-Rollback-Runbook]] ([Publish-And-Rollback-Runbook.md](../04-Operations-Runbooks/Publish-And-Rollback-Runbook.md))
* [[02-System-Specs/User-Management-System-Center-Specs|User-Management-System-Center-Specs]] ([User-Management-System-Center-Specs.md](../02-System-Specs/User-Management-System-Center-Specs.md))

*Quay lại: [[MOC-Home]] (../00-Index/MOC-Home.md)*

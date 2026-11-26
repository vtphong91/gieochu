---
tags:
  - contract
  - api
  - endpoint
  - status/living
date: 2026-06-15
updated: 2026-11-26
author: System Architect
---

# 🔌 Hợp Đồng: Danh Bạ API Endpoints (Endpoint Directory)

> [!NOTE] Nguồn sinh tài liệu
> Bảng dưới đây được **đối chiếu trực tiếp với code** ngày 2026-09-26: **20 file `route.ts` / 20 handler HTTP**
> dưới `apps/web/app/api/**` (đếm bằng `find apps/web/app/api -name "route.ts" | wc -l`). Từ ADR-030 (2026-09-28) có thêm
> **1 `route.ts` ngoài `/api`** — redirect 301 URL tài liệu cũ (§5.1) → toàn `apps/web/app` có **21** `route.ts` ✅. Gieo Chữ ở giai đoạn
> MVP Phase 1 hiện chưa có tiền tố version (`/api/v1/...` như một số dự án khác) — mọi route nằm thẳng dưới
> `/api/`. Phần lớn nghiệp vụ tenant (Studio, quản lý sản phẩm, đơn hàng, subscription) chạy qua **Server
> Actions** trong `apps/web/app/studio/**` và **Server Components** trong `apps/web/app/admin/**`, không phải
> route handler — bảng này chỉ liệt kê route HTTP thật (`route.ts`) theo đúng yêu cầu của thư mục này; Server
> Actions không nằm trong phạm vi tài liệu này — contract Server Action của Storefront CMS/form liên hệ
> (ADR-023: `submitStorefrontContactAction`, các action editor/hộp thư Studio) ghi ở
> [[02-System-Specs/Storefront-CMS-Specs|Storefront-CMS-Specs]] §6–§7; đợt này không thêm `route.ts` nào (vẫn 20 ✅).
> Đợt ADR-026/027 (2026-09-26/27) cũng **không thêm `route.ts`** (đếm lại 2026-09-27: vẫn 20 ✅); contract Server
> Action của editor sản phẩm Studio ghi ở §10 trang này. Đợt M10a Đánh giá (ADR-029, 2026-09-27) cũng **không thêm
> `route.ts`** (đếm lại 2026-09-28: vẫn 20 ✅) — contract Server Action + hàm lib đánh giá ghi ở §12. Đợt M10b Bài viết
> (ADR-029, 2026-09-28) cũng **không thêm `route.ts`** (đếm lại 2026-09-28: vẫn 20 ✅) — contract ghi ở §13. Đợt Cửa hàng
> (ADR-035 GĐ1 + GĐ2, 2026-10-15) cũng **không thêm `route.ts`** (đếm lại 2026-10-15: 20 dưới `/api`, 21 toàn app ✅) — action
> CMS ở §15, trang công khai `/cua-hang` + loader `lib/shop.ts` ở §16. Đợt ADR-036 (2026-10-16, nay đã commit `9a3208f`) **thêm 1
> `route.ts`**: `GET /api/cron/daily` (§17) — đếm lại 2026-10-16: **21 dưới `/api`, 22 toàn app** ✅; hai route webhook tenant và
> `uploads/complete` thêm xử lý job sau response (§6, §9). Đợt M12a Audit log (ADR-037, 2026-10-16, nay đã commit `36103fb`) **không thêm
> `route.ts`** (đếm lại 2026-10-16: vẫn 22 toàn app ✅) — thêm 2 trang + loader ở §18, bước `audit.purge` vào cron §17; các route
> `api/auth/login`, `api/auth/refresh` ghi audit nhưng không đổi contract HTTP. Đợt M12b Thống kê (ADR-037, 2026-10-16, nay đã
> commit `36103fb`) **không thêm `route.ts`** (đếm lại 2026-10-16: vẫn 22 toàn app ✅) — thêm bước `stats.aggregate` vào cron §17 (khoá
> `results.statsAggregate`) và loader dashboard `/admin` ở §19. Đợt M12c Báo cáo vi phạm + ADR-039 (2026-10-16, nay đã commit `36103fb`)
> **thêm 1 `route.ts`**: `POST /api/reports` (§20) — đếm lại 2026-10-17: **22 dưới `/api`, 23 toàn app** ✅; thêm bước
> `abuse_report.ip_purge` vào cron §17 (khoá `results.reportIpPurge`), Server Action admin/thư viện và mã lỗi mới ở §20; route
> `/api/downloads` và `/api/downloads/[token]` có thêm mã lỗi remedy (§7). Đợt ADR-040 (2026-10-17, nay đã commit `36103fb`) **không thêm
> `route.ts`** (đếm lại 2026-10-17: vẫn 22 dưới `/api`, 23 toàn app ✅) — đổi điều kiện ở `POST /api/share-links/[token]/download` (§7,
> 410 `SHARE_LINK_TENANT_LOCKED` khi tenant không `ACTIVE`), `POST /api/reports` (§20.1, 404 khi tenant không `ACTIVE`) và thêm mã
> `TENANT_NOT_ACTIVE` cho action đánh giá (§12). Đợt ADR-041 (2026-10-17, nay đã commit `7f8360b`) **không thêm `route.ts`** (đếm lại
> 2026-10-17: vẫn 22 dưới `/api`, 23 toàn app ✅) — trang + Server Action Bảng giá CMS, hoàn tiền gói, Hồ sơ/Bảo mật/đổi email ở §21. Đợt ADR-043 (2026-10-18, đã commit `e5d63d0`, deploy ❓) **không thêm `route.ts`** (đếm lại 2026-10-18: vẫn
> 22 dưới `/api`, 23 toàn app ✅) — loader dashboard Studio + subpath `@gieochu/core/dashboard-range` ở §22. "Bổ sung ADR-043 lần 3"
> (2026-10-18, đã commit `dd349b9`, deploy ❓) cũng không thêm `route.ts` (đếm lại sau lần 3: vẫn 22 / 23 ✅) — chỉ thêm 3 key `?ky=` và `displayFrom/To` (§22.1).
> Đợt ADR-046 (Đơn hàng Studio, 2026-10-18, đã commit `dd349b9`, deploy ❓) **không thêm `route.ts`, không thêm/đổi Server Action** (đếm lại 2026-10-18: vẫn 22
> dưới `/api`, 23 toàn app ✅; `orders/[orderId]/actions.ts` không đổi ✅ `git status`) — loader + tham số URL trang Đơn hàng và quy ước escape
> Prisma `contains` ở §23.
> Đợt ADR-045 Storage Gateway
> (vuong, 2026-10-22, đã commit `4ab5a3b`, deploy ❓) **thêm 1 `route.ts` nội bộ**: `GET /api/internal/storage/ticket` (§25 — trước đây §23 ở nhánh vuong) — đếm lại 2026-10-22:
> **23 dưới `/api`, 24 toàn app** ✅; URL trả về ở §6 (`presign`, `cover-presign`) và §7 (`downloads/[token]`, `share-links/[token]/download`)
> có thể là `/_s/<vé>` khi bật gateway — **shape JSON không đổi**.
> Đợt ADR-048 (Khách hàng Studio, 2026-10-23 đối chiếu, đã commit `dd349b9`, deploy ❓) **không thêm `route.ts`** (đếm lại 2026-10-23 trên working tree trước khi pull nhánh vuong: vẫn 22 dưới `/api`, 23 toàn
> app ✅; sau khi gộp ADR-045 Storage Gateway: **23 dưới `/api`, 24 toàn app** ✅ đếm lại 2026-10-23) — loader + 1 Server Action ghi chú khách + subpath `@gieochu/core/customer-list` ở §24; tham số `?khach=` trang Đơn hàng ở §23.2.
> Đợt ADR-050 đợt 1 (menu CMS, trang chủ + SEO, Điều khoản có phiên bản — 2026-10-23, chưa commit) **không thêm `route.ts`** (đếm lại 2026-10-23: vẫn
> **23 dưới `/api`, 24 toàn app** ✅) — `POST /api/auth/register` thêm `termsVersionId` + lỗi 409 `LEGAL_TERMS_CHANGED` (§3.1); Server Action/loader
> menu, trang chủ (đổi chữ ký), văn bản pháp lý ở §26; §26 cũ (Liên kết) nay là §27.
> Đợt ADR-054 (trang pháp lý đợt 2 — 2026-10-24, chưa commit) **thêm 1 `route.ts` ngoài `/api`**: redirect 308 `/phap-ly/[slug]` (§5.2) — đếm lại
> 2026-10-24: **23 dưới `/api`, 25 toàn app** ✅. `POST /api/auth/register` thêm `privacyVersionId` + lỗi 409 `LEGAL_DOCUMENT_CHANGED` (§3.1); cron thêm bước
> `download_events.purge` (§17); Server Action mới `saveLegalDocumentMetaAction` + `createTenantAction` đổi contract (§26.4, §26.5). Đợt ADR-053 bổ sung lần 3
> (nháp tự động) **không thêm route** và **chưa có Server Action** — lib nền ở §26.6.
> Đợt ADR-056 (2026-10-25) không thêm `route.ts` (§27). Đợt **ADR-059 B1/B2/B2b** (2026-10-26, đã commit `fa29d99`) **không thêm `route.ts`** — đếm lại 2026-10-26:
> **23 dưới `/api`, 25 toàn app** ✅; hai route webhook đổi hành vi (400 `invalid_body`, mã ứng viên theo tiền tố, platform ghi giao dịch trước khi áp hoá đơn — §9);
> trang Studio mới, tab admin mới, Server Action + hàm lib + mã lỗi mới ở §28; §28 cũ (Liên kết) nay là §29.
> Đợt **ADR-065 + ADR-066 + cấu hình SePay** (2026-11-24, working tree; phần key/API Token/kiểm tra kết nối đã commit `14f08ba`) **không thêm `route.ts`** — đếm lại
> 2026-11-24: **24 dưới `/api`, 26 toàn app** ✅; hai route webhook đổi hành vi (mã thanh toán 8 chữ số, bỏ qua tài khoản ngân hàng khác — §9); Server Action/hàm lib/
> subpath mới ở §31; §31 cũ (Liên kết) nay là §32.
> Đợt **ADR-067 + ADR-068** (2026-11-25, đã commit `2ccc2fc`) **không thêm `route.ts`** — đếm lại 2026-11-25: **24 dưới `/api`, 26 toàn app** ✅; Server Action mới
> `changeInvoiceStatusAction`, `changeOrderStatusAction`, xoá `confirmOrderManuallyAction` + `cancelOrderAction`, hàm lib + mã lỗi mới ở §32; §32 cũ (Liên kết) nay là §33.
> Đợt **ADR-069** (2026-11-25, đã commit `b18d97a`) **không thêm `route.ts`** (24 / 26 ✅ đếm) — trang mới `/admin/subscriptions/[subscriptionId]`, loader, component ở §33; Liên kết nay là §34.
> Đợt **ADR-070** (2026-11-25, đã commit `dbf9984`) **không thêm `route.ts`** — webhook nền tảng + cron gửi email trạng thái thanh toán, lib/package mới ở §34; Liên kết nay là §35.
> Đợt **ADR-071** (2026-11-26, working tree) **không thêm `route.ts`** (24 / 26 ✅ đếm) — contract nhật ký chi tiết, `createRenewalInvoice({ actorId })` ở §35; Liên kết nay là §36.

## 1. Quy Ước Chung

- **Base URL:** `/api/` (không có tiền tố version).
- **Xác thực:** cookie `httpOnly` `at` (access token, JWT) / `rt` (refresh token, `Path=/api/auth`) — không có
  chế độ Bearer token cho mobile/CMS ở giai đoạn này (xem mục "Quy tắc bảo mật" trong
  [CLAUDE.md](../../CLAUDE.md), quy tắc 1).
- **`proxy.ts`** (`apps/web/proxy.ts`, thay `middleware.ts` — Next.js 16) chỉ gắn `x-request-id` và làm redirect
  thô cho page routes; **không** làm gateway auth cho `/api/**`. Mỗi route handler tự gọi lại
  `requireUser()` / `requireRole()` / `requireTenantMember()` (`apps/web/lib/session.ts`,
  `apps/web/lib/tenant.ts`) — đúng nguyên tắc "không tin proxy" (CLAUDE.md, mục Cấu trúc thư mục).
- **Phản hồi thành công:** route trả trực tiếp `NextResponse.json(<payload>)` — **không có envelope** cố định
  kiểu `{success, data}`; mỗi handler tự định hình payload theo nhu cầu.
- **Phản hồi lỗi** (`handleApiError()` → `toHttpError()`, `@gieochu/core/errors.ts`), đúng CLAUDE.md §6:
  ```json
  { "error": { "code": "VALIDATION_ERROR", "message": "…", "requestId": "…" } }
  ```
  `AppError.httpStatus` quyết định status code (mặc định 400); `expose: false` thay `message` thật bằng thông
  báo chung để không lộ chi tiết nội bộ.
- **`requestId`:** lấy từ header `x-request-id` (do `proxy.ts` gắn) hoặc sinh mới bằng
  `crypto.randomUUID()` (`getRequestId()`, `apps/web/lib/api-response.ts`).

## 2. Lớp Bảo Vệ Truy Cập

Không có tầng "Store Factory" hay middleware auth toàn cục cho API — mỗi route tự gọi 1 trong các guard sau
(`apps/web/lib/session.ts`, `apps/web/lib/tenant.ts`):

| Guard | Hành vi |
| :-- | :-- |
| *(không gọi guard)* | Public — route tự quyết định phần nào cần xác thực (vd. đọc cookie refresh token nếu có, nhưng không bắt buộc) |
| `getCurrentUser()` | Đọc user hiện tại nếu có cookie hợp lệ, **không throw** nếu chưa đăng nhập (dùng cho route public có thể cá nhân hoá, vd. coupon preview biết `userId` để check `perCustomerLimit`) |
| `requireUser()` | Bắt buộc đã đăng nhập (mọi `systemRole`), throw `401` nếu không có/hết hạn access token |
| `requireRole("SYSTEM_ADMIN")` | Bắt buộc `User.systemRole === SYSTEM_ADMIN`, throw `403` nếu không đủ quyền |
| `requireTenantMember(tenantSlug, role?)` | Bắt buộc đã đăng nhập **và** là `TenantMember` (mặc định role `OWNER`) của tenant khớp `tenantSlug` trong path — dùng cho mọi route Studio |
| Xác thực webhook (chữ ký provider) | `provider.verifyWebhook({headers, rawBody}, cfg)` (`@gieochu/payments`) — so khớp chữ ký/HMAC **trước khi** parse body nghiệp vụ, sai chữ ký → `401` ngay, không phải lỗi `AppError` chuẩn (CLAUDE.md §7.4) |

**Ghi chú đọc bảng:**
- `Public` = route không gọi bất kỳ guard nào ở trên.
- `Public (token = credential)` = không cần đăng nhập nhưng cần sở hữu 1 token một-lần đã cấp trước đó
  (download token, share-link token) — cùng mô hình tin cậy với link xác thực email/reset mật khẩu.
- Route webhook không theo envelope lỗi chuẩn ở mục 1 — trả `{error: "..."}"` thô kèm status tương ứng khi
  provider chưa cấu hình / sai chữ ký, để tránh lộ chi tiết nội bộ cho bên ngoài gọi vào.

## 3. Auth (`/api/auth`) — 8 route

| Method | Endpoint | Truy cập | Mô tả |
| :-- | :-- | :-- | :-- |
| `POST` | `/api/auth/register` | Public | Tạo `User` (status `PENDING`) + `UserProfile`, phát `VerificationToken` (`EMAIL_VERIFY`), gửi email kích hoạt qua `sendEmailNow()`. Không tạo `Tenant` — trở thành tenant là hành động riêng, tự nguyện qua `/studio`. Từ ADR-050: body thêm `termsVersionId` tuỳ chọn, ghi chấp thuận Điều khoản trong cùng transaction, lỗi mới 409 `LEGAL_TERMS_CHANGED`. Từ ADR-054: thêm `privacyVersionId` tuỳ chọn (Chính sách bảo mật), lỗi 409 `LEGAL_DOCUMENT_CHANGED` — §3.1. |
| `POST` | `/api/auth/login` | Public | Xác thực email/mật khẩu, rate-limit 10 lần/15 phút theo email. Sai 5 lần liên tiếp (chỉ tính khi email tồn tại) → đặt `passwordResetRequired=true`, khoá đăng nhập tới khi qua `/forgot-password`. Thành công: set cookie `at`/`rt`. Từ ADR-053: body thêm `rememberMe` tuỳ chọn (mặc định `false`), cookie session/persistent theo chính sách phiên — §3.2. |
| `POST` | `/api/auth/logout` | Public (đọc cookie `rt` nếu có) | Revoke toàn bộ `RefreshToken` cùng `familyId`, xoá cookie `at`/`rt`. |
| `POST` | `/api/auth/refresh` | Public (bắt buộc cookie `rt` hợp lệ) | Xoay refresh token (rotate-on-use, nguyên tử từ ADR-053); phát hiện **reuse** token đã bị thay thế → revoke cả `familyId`, trả `401 AUTH_REFRESH_REUSE`. Từ ADR-053: ân hạn 30 giây → `401 AUTH_REFRESH_SUPERSEDED` (không revoke), kiểm `user.status`, idle/absolute timeout — mã lỗi đầy đủ §3.3. |
| `POST` | `/api/auth/verify-email` | Public | Tiêu thụ `VerificationToken` loại `EMAIL_VERIFY` (hash so khớp `tokenHash`), chuyển `User.status` → `ACTIVE`, set `emailVerifiedAt`. |
| `POST` | `/api/auth/resend-verification` | Public | Gửi lại token kích hoạt nếu `User.status === PENDING`; rate-limit 3 lần/giờ theo email; phản hồi giống nhau bất kể email tồn tại hay không (chống dò email). |
| `POST` | `/api/auth/forgot-password` | Public | Luôn trả `200` với thông báo chung (chống dò email); nếu email tồn tại và `status=ACTIVE`, phát `VerificationToken` (`PASSWORD_RESET`) và gửi email. Rate-limit 5 lần/giờ theo email. |
| `POST` | `/api/auth/reset-password` | Public | Tiêu thụ `VerificationToken` (`PASSWORD_RESET`), đặt mật khẩu mới, reset `failedLoginAttempts`/`passwordResetRequired`, **revoke mọi `RefreshToken`** đang hoạt động của user. |

### 3.1. `POST /api/auth/register` — chấp thuận Điều khoản (ADR-050) + Chính sách bảo mật (ADR-054) theo phiên bản ✅ đọc `git diff` 2026-10-23, 2026-10-24

Body (zod `registerSchema`):

```ts
{
  email: string;            // email hợp lệ
  password: string;         // kiểm thêm isValidPassword → 400 WEAK_PASSWORD
  fullName: string;         // trim, ≥ 1
  consent: true;            // bắt buộc như cũ
  accountType: "TENANT" | "CUSTOMER";
  termsVersionId?: string;  // ADR-050 — trim, 1–64; id phiên bản Điều khoản người dùng thấy trên form
  privacyVersionId?: string; // ADR-054 — trim, 1–64; id phiên bản Chính sách bảo mật (cùng ô đồng ý `consent`)
}
```

- **Bổ sung ADR-057 ✅ (đọc code 2026-10-25):** khi văn bản đã có bản **chính thức**, `termsVersionId` / `privacyVersionId` **thành bắt buộc** — thiếu hoặc lệch đều 409 (Điều khoản `LEGAL_TERMS_CHANGED`, Chính sách bảo mật `LEGAL_DOCUMENT_CHANGED`). Văn bản chưa có bản chính thức hoặc đang hiển thị **bản dự thảo** → trường bị bỏ qua, không ghi chấp thuận văn bản đó.
- Server **tự** xác định bản Điều khoản **chính thức** đang hiệu lực (từ ADR-057: `getAcceptanceLegalVersion("terms", now)` — bản dự thảo coi như chưa có, chỉ ghi `consentAt`); `termsVersionId` chỉ dùng để phát hiện Điều khoản
  vừa đổi giữa lúc mở form và lúc gửi.
- Không có bản hiệu lực → đăng ký như trước ADR-050 (chỉ `UserProfile.consentAt`), `termsVersionId` (nếu có) bị bỏ qua.
- Có bản hiệu lực + `termsVersionId` **khác** bản đó → **`409 { error: { code: "LEGAL_TERMS_CHANGED", message: "Điều khoản sử dụng vừa được cập
  nhật. Vui lòng tải lại trang, đọc bản mới rồi đăng ký lại.", requestId } }`**. Form hiện `error.message` ✅ `register-form.tsx`.
- Có bản hiệu lực + không gửi `termsVersionId` → ~~ghi chấp thuận bản đang hiệu lực~~ **409 `LEGAL_TERMS_CHANGED`** (bổ sung ADR-057: bắt buộc id khớp ✅ — `Legal-Documents-Specs` §5.4).
- **ADR-054:** Chính sách bảo mật xử lý độc lập cùng luật (`getEffectiveLegalVersion("privacy", now)` + `resolveRegistrationPrivacyVersion`): chưa có bản
  hiệu lực → bỏ qua; `privacyVersionId` khác bản hiệu lực → **`409 LEGAL_DOCUMENT_CHANGED`** ("Chính sách bảo mật vừa được cập nhật. Vui lòng tải lại
  trang…"); không gửi → cũng 409 `LEGAL_DOCUMENT_CHANGED` (bổ sung ADR-057 ✅). Bản dự thảo: form **không gửi** `termsVersionId`/`privacyVersionId` (`versionId = null`), server bỏ qua văn bản đó.
- Ghi `user_legal_acceptances { userId, versionId, acceptedAt = now }` cho mọi id đã chọn (0–2 dòng, `recordLegalAcceptances` — `createMany … skipDuplicates`)
  **trong cùng `prisma.$transaction`** tạo `User` + `UserProfile` + `VerificationToken`. Không lưu IP/User-Agent.
- Thứ tự kiểm: rate-limit → email đã đăng ký (409 `EMAIL_ALREADY_REGISTERED`) → hash mật khẩu → xác định phiên bản Điều khoản → transaction.
  Response thành công không đổi (`201 { message }`).
- Trang `app/(auth)/register/page.tsx` truyền `terms = { versionId, href: "/dieu-khoan-su-dung", title } | null` và (ADR-054) `privacy = { versionId,
  href: "/chinh-sach-bao-mat", title } | null` cho `RegisterForm` (href dựng bằng `legalDocumentPath`; trước ADR-054 là `/phap-ly/dieu-khoan-su-dung`).

### 3.2. `POST /api/auth/login` — "Ghi nhớ đăng nhập" (ADR-053) ✅ đọc code 2026-10-24

Body (zod `loginSchema`):

```ts
{
  email: string;          // email hợp lệ
  password: string;       // ≥ 1
  rememberMe?: boolean;   // MỚI — mặc định false. SYSTEM_ADMIN: server bỏ qua (luôn false)
}
```

- Mã lỗi **không đổi** (`INVALID_CREDENTIALS` 401, `ACCOUNT_LOCKED` 403, `PASSWORD_RESET_REQUIRED` 403, `EMAIL_NOT_VERIFIED` 403, `RATE_LIMITED` 429,
  `VALIDATION_ERROR` 400 — `rememberMe` sai kiểu bị zod từ chối). Response thành công không đổi: `200 { user: { id, email, role, profileCompleted,
  landingPath } }`.
- **Cookie** (thay đổi hành vi): phiên không ghi nhớ và SYSTEM_ADMIN → `at` và `rt` là **session cookie** (không `Max-Age`); `rememberMe` hiệu lực →
  `rt` `Max-Age` = thời gian còn lại tới `sessionStartedAt + rememberMeDays`, `at` `Max-Age` = TTL access. TTL access = `accessTokenTtlMinutes`, kẹp ≤
  idle khi phiên có idle. Access JWT thêm claim `rm`.
- Bản ghi `refresh_tokens` mới ghi `rememberMe`, `sessionStartedAt = now`, `deviceLabel`; `expiresAt = now + absolute` (không còn `refreshTokenTtlDays`).
- Client (`login-form.tsx`) sau 200 chuyển trang bằng `window.location.assign` (không `router.push`). Chi tiết: [[02-System-Specs/Auth-Session-Specs|Auth-Session-Specs]] §3.

### 3.3. `POST /api/auth/refresh` — mã lỗi (ADR-053) ✅ đọc code 2026-10-24

Không body. Thành công `200 { ok: true }` + cookie mới theo chính sách phiên (như §3.2). Lỗi luôn theo khung `{ error: { code, message, requestId } }`:

| HTTP | `code` | Khi nào | Thu hồi family | Xoá cookie |
| :-: | :-- | :-- | :-: | :-: |
| 401 | `UNAUTHORIZED` | Thiếu cookie `rt`; không tìm thấy token; token hết `expiresAt` ("Phiên đăng nhập đã hết hạn.") | — | ✅ |
| 401 | **`AUTH_REFRESH_SUPERSEDED`** (mới) | Token vừa bị request/tab khác thay **≤ 30 giây** (chưa bị thu hồi), hoặc thua race khi rotate | ❌ | ❌ |
| 401 | `AUTH_REFRESH_REUSE` | Token đã thu hồi, hoặc bị thay **quá** 30 giây — ghi audit `AUTH_REFRESH_REUSE` (`revokedSessions`) | ✅ | ✅ |
| 401 | **`ACCOUNT_LOCKED`** (mới ở route này) | User `LOCKED` (ở login là **403**) | ✅ | ✅ |
| 401 | `UNAUTHORIZED` | User không còn / trạng thái khác `ACTIVE`, `LOCKED` (vd `PENDING`) | ✅ | ✅ |
| 401 | **`SESSION_EXPIRED`** (mới) | Quá absolute tính từ `sessionStartedAt` | ✅ | ✅ |
| 401 | **`SESSION_IDLE_TIMEOUT`** (mới) | Quá idle tính từ `createdAt` token hiện tại (phiên có idle) | ✅ | ✅ |

- Thứ tự kiểm: cookie → bản ghi → trạng thái token → `user.status` → absolute → idle → rotate.
- Phiên trước ADR-053 (`sessionStartedAt` NULL) không bị `SESSION_*` ở lần refresh đầu — bắt đầu đếm từ lần đó.
- Client `SessionRefresh` coi `AUTH_REFRESH_SUPERSEDED` là "còn phiên"; `SESSION_IDLE_TIMEOUT`/`SESSION_EXPIRED` → `/login?het-phien=1&next=…`.
  Chi tiết: [[02-System-Specs/Auth-Session-Specs|Auth-Session-Specs]] §4–§5.

## 4. Tài khoản khách hàng (`/api/me`) — 1 route

| Method | Endpoint | Truy cập | Mô tả |
| :-- | :-- | :-- | :-- |
| `GET` | `/api/me` | `requireUser()` | Trả thông tin user hiện tại (`id`, `email`, `role`, `status`, `emailVerified`, `profileCompleted`, `profile`). |

## 5. Storefront công khai (`/api/[tenantSlug]`) — 1 route

| Method | Endpoint | Truy cập | Mô tả |
| :-- | :-- | :-- | :-- |
| `POST` | `/api/[tenantSlug]/coupons/preview` | Public (`getCurrentUser()` không bắt buộc — chỉ dùng `userId` nếu có để check `perCustomerLimit`) | Tính lại giá + giảm giá coupon **ở server** cho giỏ hàng (`previewCouponPrice()`, `apps/web/lib/coupon.ts`) trước khi vào checkout — không tin số tiền client gửi lên (CLAUDE.md §7.5). Dùng lại đúng `calculatePrice()` mà M8 checkout gọi lần 2 khi tạo `Order` thật. |

### 5.1. Route Handler ngoài `/api` — redirect URL tài liệu cũ (ADR-030) ✅

| Method | Endpoint | Truy cập | Mô tả |
| :-- | :-- | :-- | :-- |
| `GET` | `/[tenantSlug]/products/[productSlug]` (`app/[tenantSlug]/products/[productSlug]/route.ts`) | Public, chỉ đọc (không kiểm `Origin`) | **301** sang URL chuẩn `/{tenantSlug}/{productSlug}`: `Location` **tương đối** = `productPath(tenantSlug, productSlug)` + query gốc; body rỗng. `productSlug` thuộc `RESERVED_PRODUCT_SLUGS` → **404**. Không dùng `permanentRedirect()`/`redirects()` vì Next trả 308. |

- `/{tenantSlug}/products` (không có slug) → **404** (không có `page.tsx`) ✅. Trang tài liệu `/{tenantSlug}/{productSlug}`
  là Server Component (`app/[tenantSlug]/[productSlug]/page.tsx`), kèm Server Action `buyProductAction`
  (`[productSlug]/actions.ts`) và action đánh giá (§12.1). Route map đầy đủ:
  [[02-System-Specs/Product-Editor-And-Publishing-Specs|Product-Editor-And-Publishing-Specs]] §7A.
- Chưa có test tự động cho redirect (BACKLOG) ❓.

### 5.2. Route Handler ngoài `/api` — redirect URL văn bản pháp lý cũ (ADR-054) ✅ đọc code 2026-10-24

| Method | Endpoint | Truy cập | Mô tả |
| :-- | :-- | :-- | :-- |
| `GET`, `HEAD` | `/phap-ly/[slug]` (`app/phap-ly/[slug]/route.ts`) | Public, chỉ đọc (không kiểm `Origin`) | Slug là văn bản đã khai báo (`legalKeyFromSlug`) → **308** `Location` **tương đối** = `legalDocumentPath(key)` + query gốc (không dựng origin từ `request.url`); slug lạ → **404** `text/plain`. **Không đọc DB** — văn bản chưa có bản hiệu lực vẫn redirect, trang đích tự 404. `dynamic = "force-dynamic"`. |

- Trang văn bản cấp gốc `/dieu-khoan-su-dung`, `/chinh-sach-bao-mat`, `/chinh-sach-noi-dung`, `/cam-ket-ban-quyen`, `/quyen-su-dung-tai-lieu`,
  `/chinh-sach-nguoi-ban`, `/lien-he` là `page.tsx` (không phải route handler) — [[02-System-Specs/Legal-Documents-Specs|Legal-Documents-Specs]] §4.
- Chưa có test tự động cho redirect ❓.

## 6. Studio — upload file sản phẩm (`/api/studio/[tenantSlug]/uploads`) — 4 route

Tất cả bốn route đều bắt buộc `requireTenantMember(tenantSlug)` (chỉ `OWNER` của đúng tenant khớp `tenantSlug`
trong path — MVP chưa có `STAFF` được cấp quyền upload).

| Method | Endpoint | Truy cập | Mô tả |
| :-- | :-- | :-- | :-- |
| `POST` | `/api/studio/[tenantSlug]/uploads/presign` | `requireTenantMember` | Cấp URL presigned PUT (bucket **private**) để tải 1 `ProductFile` lên — kiểm giới hạn dung lượng/số file theo `Plan` (`maxFileMb`, `storageMb`) bên trong `presignProductFileUpload()` (`apps/web/lib/product-upload.ts`). |
| `POST` | `/api/studio/[tenantSlug]/uploads/complete` | `requireTenantMember` | Xác nhận upload xong (`completeProductFileUpload()`). ADR-026 ✅: (1) `objectKey` client gửi lên phải khớp tiền tố `tenants/<tenantId>/products/<productId>/<uuid>/<tênĐãSanitize>` (`isProductObjectKeyFor`, kind `file`) + đuôi trong allowlist, kiểm **trước mọi lời gọi storage** — sai → `400 INVALID_OBJECT_KEY`; (2) `objectKey` đã ghi nhận → `409 UPLOAD_ALREADY_COMPLETED`; (3) `HeadObject` thật: không thấy → `400 UPLOAD_NOT_FOUND`, dung lượng lệch khai báo → xoá object + `400 UPLOAD_SIZE_MISMATCH`; (4) kiểm lại `assertPlanLimit("fileSize"/"storage")` bằng **dung lượng thật** — vượt → xoá object + lỗi giới hạn gói; (5) tạo `ProductFile` (`scanStatus=PENDING`), cộng `storageUsedBytes` theo dung lượng thật, enqueue `file.scan`. ADR-036 ✅: sau đó `scheduleQueueDrain([file.scan])` — job quét chạy trong `after()` **sau** khi trả response (response không đổi); `export const maxDuration = 60`. |
| `POST` | `/api/studio/[tenantSlug]/uploads/cover-presign` | `requireTenantMember` | Cấp URL presigned PUT cho ảnh bìa sản phẩm (bucket **public** R2, PNG/JPG/JPEG ≤ 5 MB theo khai báo). **Luồng cũ** — từ ADR-027 editor dùng ảnh bìa Cloudinary (§10); route giữ tới khi dọn (BACKLOG). |
| `POST` | `/api/studio/[tenantSlug]/uploads/cover-complete` | `requireTenantMember` | Xác nhận ảnh bìa R2, ghi `Product.coverImageKey`. ADR-026 ✅: kiểm `objectKey` khớp `tenants/<tenantId>/products/<productId>/cover/<tên>` (`isProductObjectKeyFor`, kind `cover`) + đuôi png/jpg/jpeg trước khi gọi storage → sai `400 INVALID_OBJECT_KEY`. Chưa kiểm dung lượng thật của ảnh (BACKLOG). |

**Storage Gateway (ADR-045)** ✅ đọc `apps/web/lib/{product-upload,storage-gateway}.ts` 2026-10-22: `presign` và `cover-presign` trả **đúng shape
cũ** `{ objectKey, upload }` (`PresignedUpload`: `{ mode: "single", url }` hoặc `{ mode: "multipart", uploadId, partSizeBytes, parts[] }`). Khi
provider đã ký URL nằm trong env `STORAGE_GATEWAY_PROVIDERS`, **`upload.url` và từng `parts[].url` là đường dẫn tương đối `/_s/<vé>`** (cùng
origin) thay vì presigned URL storage; client vẫn `PUT` thẳng vào URL đó (nginx chuyển tiếp, không qua Node). Vé PUT giới hạn `Content-Length`:
đơn ≤ `sizeBytes` khai báo, mỗi part ≤ `partSizeBytes`. Provider: file sản phẩm = provider của bucket tenant (MinIO/bucket riêng) hoặc
`activeProvider`; ảnh bìa = `activeProvider`. Hạn vé = `presignUploadTtlSeconds`. `complete`/`cover-complete` không đổi.

## 7. Downloads & Share Links (khách hàng, L3) — 3 route

| Method | Endpoint | Truy cập | Mô tả |
| :-- | :-- | :-- | :-- |
| `POST` | `/api/downloads` | `assertSameOrigin` + `requireCheckoutUser()` (từ ADR-061 Q1, 2026-10-27 — đã xác minh **hoặc** phiên khách vãng lai; trước: `requireUser()`) | Bước 1 của luồng tải file (M9): kiểm `Entitlement` còn hạn (`downloadsUsed < downloadLimit`, chưa `revokedAt`), phát `DownloadToken` một-lần, TTL 60s. Rate-limit 20 lần/10 phút theo `userId`. Trả `{ url: "/api/downloads/{token}", expiresAt }`, không trả URL bucket thật. ADR-026 ✅: `fileId` có thể là dòng **link ngoài** (`sourceKind = EXTERNAL_URL`) — cùng luồng entitlement/`downloadLimit`/token; dòng không giao được (file chưa `CLEAN`, link không còn qua allowlist, đã gỡ) → `404`. ADR-039 ✅: entitlement chưa thu hồi có `remedyStatus = PENDING_CHOICE` → `403 REMEDY_CHOICE_REQUIRED`; `REFUND_REQUESTED`/`REFUNDED` → `403 DOWNLOAD_BLOCKED_REFUND` (đã thu hồi vẫn báo `ENTITLEMENT_REVOKED`). |
| `GET` | `/api/downloads/[token]` | Public (token = credential một-lần) | Bước 2: tiêu thụ `DownloadToken` (so khớp `tokenHash`; không có/hết hạn/đã dùng → `410 TOKEN_INVALID`), **kiểm lại nguồn giao hàng trước khi trừ lượt** — không còn giao được → `410 DOWNLOAD_SOURCE_UNAVAILABLE` (ADR-026; token lúc này đã bị đánh dấu dùng nhưng lượt tải **không** bị trừ ✅), tăng `Entitlement.downloadsUsed` (hết lượt/thu hồi → `403 DOWNLOAD_LIMIT_REACHED`; ADR-039: UPDATE chỉ khi `remedyStatus ∈ {NONE, FINAL_DOWNLOAD}` — không khớp do remedy → `403 REMEDY_CHOICE_REQUIRED` / `403 DOWNLOAD_BLOCKED_REFUND`), ghi `DownloadEvent`, rồi `302` sang: URL presigned GET (FILE — bucket private, `Content-Disposition: attachment`, sống ≤ 10 phút — CLAUDE.md §7.6) **hoặc** chính URL link ngoài đã chuẩn hoá lại qua allowlist (EXTERNAL_URL). |
| `POST` | `/api/share-links/[token]/download` | Public (mật khẩu tuỳ chọn theo `ShareLink.passwordHash`) | Kiểm mật khẩu (nếu `ShareLink` có đặt), kiểm `fileId` thuộc `fileIds` cho phép, tăng `usedCount` một cách atomic (không vượt `maxUses`), ghi `DownloadEvent`, trả URL presigned GET. Rate-limit 20 lần/10 phút theo **token** (không theo IP — chống brute-force mật khẩu qua proxy). ADR-026 ✅: **không bao giờ giao link ngoài** — chỉ nhận dòng `sourceKind = FILE`, không preview, `CLEAN`, chưa gỡ (`apps/web/lib/share-link.ts`). ADR-040 ✅: tenant không `ACTIVE` (`READ_ONLY`/`LOCKED`) → `410 SHARE_LINK_TENANT_LOCKED` (kiểm sau hạn/lượt/thu hồi, trước mật khẩu). Trang `/s/[token]` (`resolveShareLink`) cùng điều kiện — hiển thị "Link không còn hiệu lực." (trang render thông báo, không đặt HTTP 410). |

**Storage Gateway (ADR-045)** ✅ đọc `apps/web/lib/{download,share-link,storage-gateway}.ts` + `api/downloads/[token]/route.ts` 2026-10-22 — chỉ
áp dụng khi provider **đã ký URL** (provider lưu ở `ProductFile.storageProvider`, fallback `activeProvider`) nằm trong `STORAGE_GATEWAY_PROVIDERS`:
* `GET /api/downloads/[token]` (FILE): `302` tới **`{APP_URL}/_s/<vé>`** (URL tuyệt đối dựng bằng `toAbsoluteRedirectUrl`) thay vì presigned URL
  storage. EXTERNAL_URL không đổi.
* `POST /api/share-links/[token]/download`: vẫn `200 { url }`, nhưng `url` có thể là **đường dẫn tương đối `/_s/<vé>`** (client
  `app/s/[token]/download-panel.tsx` gán `window.location.href = url` ✅ — URL tương đối tự resolve theo origin hiện tại).
* Hạn vé = `clampDownloadTtlSeconds(presignDownloadTtlSeconds)` (≤ 600s), vé chỉ hợp lệ với method `GET`. Các bước kiểm quyền/lượt/token
  một lần không đổi. Env trống (mặc định) → hành vi cũ, URL presigned trực tiếp.

## 8. Admin (System Center) — 1 route

| Method | Endpoint | Truy cập | Mô tả |
| :-- | :-- | :-- | :-- |
| `GET` | `/api/admin/dashboard` | `requireRole("SYSTEM_ADMIN")` | Tổng hợp số liệu dashboard hệ thống (`getAdminDashboardSummary()`, `apps/web/lib/admin-dashboard.ts`) — chỉ đọc số liệu tổng hợp cấp platform, **không** đọc chi tiết đơn hàng/khách hàng của tenant (CLAUDE.md §7.9). Phần lớn nghiệp vụ admin khác (duyệt tenant, cấu hình billing/SMTP/storage, CMS...) chạy qua Server Component/Server Action trong `apps/web/app/admin/**`, không có route riêng. |

## 9. Webhooks (`/api/webhooks`) — 2 route

| Method | Endpoint | Truy cập | Mô tả |
| :-- | :-- | :-- | :-- |
| `POST` | `/api/webhooks/platform/[provider]` | Public + xác thực chữ ký provider (`SEPAY`, `MOMO`) | Webhook thanh toán **phí subscription nền tảng** (Tenant → Gieo Chữ). Xác thực chữ ký trước (`provider.verifyWebhook`), ghi `WebhookEvent` (`scope=PLATFORM`) để idempotent, đối soát `SubscriptionInvoice` theo mã tham chiếu + số tiền, gọi `markInvoicePaid()` nếu khớp, luôn ghi `PlatformPaymentTransaction` (khớp hoặc `UNMATCHED` để admin xử lý tay). **ADR-059 ✅ `git diff` 2026-10-26:** ghi `PlatformPaymentTransaction` **trước** rồi mới `markInvoicePaid` (chỉ khi hoá đơn PENDING, khớp mã + đúng tiền); mã SePay thử tiền tố đã cấu hình rồi `SUB`, đúng 8 ký tự (`sepayInvoiceReferenceCandidates`); body không phải JSON/thiếu trường → **400 `{ error: "invalid_body" }`**. Mã trả: 404 `unsupported_provider`/`not_configured`, 401 `invalid_signature`, 400 `invalid_body`, 200 `{ success: true }` (kể cả sự kiện trùng). **ADR-065 ✅ `git diff` 2026-11-24:** mã hoá đơn đọc bằng `extractSepayPaymentCodes` (tiền tố 2–5 chữ cái + **8 chữ số**, thử `paymentPrefix` rồi `SUB`); SePay có `accountNumber` khác số TK đã cấu hình → **200 `{ success: true }`**, **không** ghi `webhook_events`/giao dịch (kiểm sau chữ ký + parse body). |
| `POST` | `/api/webhooks/tenants/[tenantId]/[provider]` | Public + xác thực chữ ký provider (`SEPAY`, `MOMO` — không nhận `MANUAL_QR`, vì đó không có webhook) | Webhook thanh toán **đơn hàng khách mua sản phẩm của tenant**. Đọc `TenantPaymentConfig` (giải mã `encryptedSecrets` bằng `PAYMENT_ENCRYPTION_KEY`), xác thực chữ ký, ghi `WebhookEvent` (`scope=TENANT`) để idempotent, rồi **trả 200 ngay** và đẩy việc nặng (khớp `Order`, `markOrderPaid()`) vào job `payment.process` qua `enqueuePaymentProcess()` — đúng CLAUDE.md §7.4 "trả 2xx nhanh rồi xử lý nặng trong job". ADR-036 ✅: không có worker thường trực trên Vercel — sau khi enqueue gọi `scheduleQueueDrain([payment.process])`, job được xử lý trong `after()` sau khi `200 { success: true }` đã gửi (hàm không bao giờ ném nên không đổi mã trả về); `export const maxDuration = 60`; cron §17 dọn job sót. **ADR-059 ✅ `git diff` 2026-10-26:** SePay đọc `referenceCandidates` theo `[cfg.paymentPrefix, tenant.orderCodePrefix]`, đúng 6 ký tự, đưa vào job (`PaymentProcessJobData.referenceCandidates?`, `reference` = phần tử đầu); body hỏng/thiếu trường → **400 `invalid_body`**; chữ ký sai 401 `invalid_signature`. **ADR-065 ✅ `git diff` 2026-11-24:** ứng viên = mã thanh toán `extractSepayPaymentCodes(body, [cfg.paymentPrefix, orderCodePrefix])` (8 chữ số) **rồi** mã đơn (`orderCodePrefix` + 6 ký tự), bỏ trùng; job khớp `orders.paymentRef` **hoặc** `orders.code` trong gian hàng; `accountNumber` khác số TK đã cấu hình → **200**, không ghi `webhook_events`. Shape request/response không đổi. |

---

## 10. Server Actions — Editor sản phẩm Studio (ADR-026/027)

Không phải route HTTP, nhưng là contract giữa editor (client) và server — ghi ở đây vì Studio sản phẩm không có
`route.ts` riêng. File: `apps/web/app/studio/[tenantSlug]/products/actions.ts` ✅ (đọc code 2026-09-27). Mọi action
gọi `requireTenantMember(tenantSlug)` trước tiên; lỗi nghiệp vụ `AppError` được đổi thành state, không throw ra UI.

**`ProductActionState`** (kiểu trả về chung):

| Trường | Nghĩa |
| :-- | :-- |
| `ok?: boolean` | Thao tác thành công |
| `error?: string` | Lỗi chung (banner) |
| `fieldErrors?: Record<string, string>` | Lỗi theo tên field FormData. Map mã lỗi → field: `INVALID_SLUG`→`slug`, `INVALID_SALE_PRICE`→`salePriceVnd`, `CATEGORY_NOT_FOUND`/`CATEGORY_INACTIVE`/`CATEGORY_REQUIRED`→`categoryId`, `INVALID_EXTERNAL_URL`→`url`, `INVALID_EXTERNAL_LINK_LABEL`→`label`, `INVALID_PRODUCT_SUMMARY`→`summary`, `INVALID_COVER_IMAGE_URL`→`coverImageUrl` |
| `productId?: string` | Id sản phẩm (trang Tạo dùng để chuyển sang URL sửa) |
| `saved?: boolean` | Đã lưu xong dù bước xuất bản bị từ chối |
| `published?: boolean` | (ADR-027 — chỉ có khi FormData có `visibility` hoặc gọi saveAndPublish) trạng thái sau thao tác: `true` = Công khai (`PUBLISHED`), `false` = Riêng tư |
| `link?: ProductLinkState` | (Sau ADR-027, cho trang Tạo tự tạo nháp) chỉ có ở `addProductLinkAction`/`updateProductLinkAction` khi thành công: `{ id, label, url, isAllowed, createdAt }` — `createdAt` là ISO string UTC (serialize qua Server Action) để card cập nhật danh sách link cục bộ |
| `publishReasons?: PublishBlock[]` | Lý do chưa xuất bản được, dạng `{ code, message }`: `CATEGORY_REQUIRED`, `CATEGORY_INACTIVE`, `NO_DELIVERY_SOURCE`, `NO_COVER_IMAGE`, `INVALID_PRICE`, `TENANT_NOT_ACTIVE`, `PRODUCT_LIMIT_REACHED` |

**Field FormData** (tạo + sửa, `parseProductFields`) — quy ước **vắng mặt = giữ nguyên**, **có mặt nhưng rỗng = xoá**
(trừ `priceVnd`/`downloadLimit`: rỗng = giữ nguyên):
`title` (bắt buộc, ≤200) · `slug` (chỉ khi tạo, tuỳ chọn; không đổi sau khi tạo) · `type`
(`TEMPLATE|SLIDE|EBOOK|EXAM|OTHER`, mặc định `OTHER`) · `summary` (văn bản thuần ≤300, `normalizeProductSummary`) ·
`description` (HTML, sanitize lại ở server bằng `sanitizeRichTextHtml(..., { imageCloudName })` — `<img>` ngoài cloud
hệ thống bị loại, ADR-028) · `coverImageUrl` (URL Cloudinary, zod kiểm host rồi `isCloudinaryImageUrl(url, cloudName hệ
thống)` — cloud khác → `INVALID_COVER_IMAGE_URL`) · `visibility` (`PUBLIC|PRIVATE`, vắng mặt = không đổi trạng thái) · `categoryId` · `tags`
(phân tách dấu phẩy) · `priceVnd` (int 0…1 000 000 000) · `salePriceVnd` (phải < giá gốc) · `saleStartsAt`/`saleEndsAt`
(`datetime-local` giờ VN, ghép `+07:00`; kết thúc phải sau bắt đầu) · `downloadLimit` (0…1000, 0 = không giới hạn).

| Action | Tham số | Hành vi / kết quả |
| :-- | :-- | :-- |
| `createProductAction` | `(tenantSlug, prev, formData)` | Tạo bản **nháp**. Không `visibility` → `{ ok, productId }`. `PRIVATE` → `{ ok, saved, productId, published: false }`. `PUBLIC` → tạo rồi thử `publishProduct`: thành công `{ ok, saved, productId, published: true }`; chưa đủ điều kiện → sản phẩm **vẫn được tạo ở dạng nháp**, trả `{ ok: true, saved: true, productId, published: false, publishReasons, error }` |
| `updateProductAction` | `(tenantSlug, productId, prev, formData)` | Lưu. Không `visibility` → `{ ok, productId }`. `PRIVATE` → lưu + (nếu đang `PUBLISHED`) chuyển `DRAFT` **trong cùng một lệnh update** → `{ ok, saved, productId, published }`. `PUBLIC` → lưu rồi `publishProduct`; chưa đủ điều kiện → `{ error, saved: true, productId, published: false, publishReasons }` (**không có `ok`** — khác `createProductAction`) |
| `saveAndPublishProductAction` | `(tenantSlug, productId, prev, formData)` | Như `updateProductAction` với `visibility=PUBLIC` ép buộc (giữ cho UI cũ) |
| `getProductCoverUploadSignatureAction` | `(tenantSlug)` | (ADR-028) Chữ ký ảnh bìa qua `createTenantImageUploadSignature(tenant.id, "PRODUCT_COVER")`: kiểm hạn mức ảnh, ký `public_id` đầy đủ `<uploadFolder>/tenants/<tenantId>/products/<24 hex>`, `allowed_formats` png/jpg/jpeg/webp, incoming transformation ≤2000px, giữ chỗ 5MB. Không cần `productId`. Trả `CloudinarySignatureResult` (§11). Sau upload gọi `registerTenantImageAction(..., "PRODUCT_COVER")` |
| `addProductLinkAction` | `(tenantSlug, productId, prev, formData{label, url})` | Thêm link ngoài (nhãn 1…200 ký tự, URL qua allowlist) → `{ ok, link }` |
| `updateProductLinkAction` | `(tenantSlug, productId, linkId, prev, formData{label, url})` | Sửa nhãn/URL link; khách đã mua nhận URL mới ở lần mở kế tiếp → `{ ok, link }` |
| `removeProductLinkAction` | `(tenantSlug, productId, linkId)` | Gỡ mềm (`removedAt`) → `{ ok }` |
| `removeProductFileAction` | `(tenantSlug, productId, fileId)` | Gỡ mềm file (`removedAt`, không xoá object) **và trừ `storageUsedBytes`** → `{ ok }` |
| `publishProductAction` / `unpublishProductAction` / `archiveProductAction` / `restoreProductAction` | `(tenantSlug, productId)` | Đổi trạng thái (`restore`: `ARCHIVED → DRAFT`) → `{ ok }` hoặc `{ error, publishReasons? }` |

Mọi action thành công gọi `revalidateProduct` ✅ (đọc code 2026-09-28): `/studio/<slug>/products` (+ trang sửa khi có
`productId`), **trang tài liệu** `revalidatePath("/[tenantSlug]/[productSlug]", "page")` (theo route pattern — làm mới trang
tài liệu của mọi tenant, vì action không có slug) và **storefront** `/<slug>` (ADR-030). `createProductAction`: slug tự nhập
trùng từ dành riêng → `INVALID_SLUG` (map vào `fieldErrors.slug`); slug tự sinh trùng → thêm hậu tố. Nghiệp vụ chi tiết:
[[02-System-Specs/Product-Editor-And-Publishing-Specs|Product-Editor-And-Publishing-Specs]].

---

## 11. Server Actions — Ảnh Cloudinary hệ thống (ADR-028)

Đối chiếu code 2026-09-27 ✅. Luồng đầy đủ: [[02-System-Specs/File-Storage-And-Downloads-Specs|File-Storage-And-Downloads-Specs]] §7.

**`CloudinarySignatureResult`** (`apps/web/lib/cloudinary-signature.ts`; re-export từ `app/_ui/cloudinary-actions.ts`) =
`CloudinaryUploadSignature` + `{ ok, error?, errorCode? }`:

| Trường | Nghĩa |
| :-- | :-- |
| `ok: boolean` | `false` → đọc `error` (tiếng Việt, hiển thị được) + `errorCode`; các trường chữ ký là giá trị rỗng |
| `error?`, `errorCode?` | Chỉ khi `ok: false` — từ `AppError` có `expose`. Lỗi khác bị ném tiếp (Next trả lỗi chung, không lộ chi tiết) |
| `cloudName`, `apiKey`, `timestamp`, `signature` | Tham số chuẩn Cloudinary signed upload (`apiSecret` không rời server) |
| `folder` | Thông tin. Với chữ ký có `publicId`, folder đã nằm trong public id — **không gửi riêng** |
| `allowedFormats?` | Chuỗi định dạng đã ký (vd `png,jpg,jpeg,webp`) |
| `publicId?` | (Chữ ký tenant) public id đầy đủ do server sinh `<root>/tenants/<id>/<content\|products\|storefront\|posts>/<24 hex>` (`posts` từ M10b) |
| `transformation?` | (Chữ ký tenant) incoming transformation đã ký, hiện `c_limit,w_2000,h_2000` |
| `uploadParams: Record<string,string>` | **Đúng bộ tham số đã ký** (trừ `api_key`/`signature`). Client gửi NGUYÊN VẸN cùng `file`, `api_key`, `signature` tới `POST https://api.cloudinary.com/v1_1/<cloudName>/image/upload` — thêm/bớt/sửa là Cloudinary từ chối |

| Action | File | Guard | Tham số | Kết quả |
| :-- | :-- | :-- | :-- | :-- |
| `getCloudinaryUploadSignatureAction` | `app/_ui/cloudinary-actions.ts` | `requireRole("SYSTEM_ADMIN")` (**trước đây `requireUser()`**) | `()` | `CloudinarySignatureResult` ký `folder` = root + `allowed_formats` png/jpg/jpeg/webp/svg. Không tính hạn mức |
| `getContentImageUploadSignatureAction` | `studio/[tenantSlug]/media-actions.ts` | `requireTenantMember` | `(tenantSlug)` | Chữ ký ảnh mô tả (usage `CONTENT`), giữ chỗ 5MB |
| `getProductCoverUploadSignatureAction` | `studio/[tenantSlug]/products/actions.ts` | `requireTenantMember` | `(tenantSlug)` | Chữ ký ảnh bìa (usage `PRODUCT_COVER`) — §10 |
| `getTenantCloudinaryUploadSignatureAction` | `studio/[tenantSlug]/storefront/actions.ts` | `requireTenantMember` | `(tenantSlug)` | Chữ ký ảnh storefront (usage `STOREFRONT`) |
| `getPostImageUploadSignatureAction` | `studio/[tenantSlug]/posts/actions.ts` | `requireTenantMember` | `(tenantSlug)` | (M10b) Chữ ký ảnh bài viết (usage `POST`, folder `tenants/<id>/posts`), tính hạn mức — §13 |
| `registerTenantImageAction` | `studio/[tenantSlug]/media-actions.ts` | `requireTenantMember` | `(tenantSlug, publicId, usage: string)` | Gọi **ngay sau** upload thành công, với `public_id` Cloudinary trả về và đúng `usage` của chữ ký. Trả `RegisterTenantImageResult` |

**`RegisterTenantImageResult`**: `{ ok: true, url, verified }` — `url` là `secure_url` (đã kiểm đúng cloud hệ thống; nếu
không thì URL dựng từ `public_id`) để lưu vào form/HTML; hiển thị qua `cloudinaryDeliveryUrl`; `verified: false` = Admin
API lỗi, đang tính mức tạm 5MB, đối soát sau. Hoặc `{ ok: false, error, errorCode }`.

`tenant.id` luôn lấy từ guard, không từ client. Số `bytes/format/width/height` đọc từ Cloudinary Admin API, không nhận
từ client.

**Mã lỗi (ADR-028)** — đều là `AppError` `expose`, trả dạng `ok: false` + `errorCode`:

| Mã | HTTP (trong AppError) | Khi nào |
| :-- | :-- | :-- |
| `IMAGE_QUOTA_EXCEEDED` | 403 | Lúc xin chữ ký, tổng `bytes` ảnh của tenant ≥ `Plan.imageStorageMb`. Thông điệp: "Đã dùng hết <N>MB/GB dung lượng ảnh của gói hiện tại. Hãy xoá bớt ảnh không dùng hoặc nâng cấp gói để tải thêm ảnh." — UI hiện link nâng gói |
| `INVALID_IMAGE_PUBLIC_ID` | 400 | `publicId` rỗng/>300 ký tự, không đúng tiền tố `<root>/tenants/<tenantId>/<folder của usage>/` hoặc tên không phải 24 hex — kiểm **trước** khi gọi Admin API |
| `IMAGE_NOT_FOUND` | 404 | Admin API xác nhận không có asset (upload hỏng/huỷ) → xoá dòng giữ chỗ |
| `INVALID_IMAGE_USAGE` | 400 | `usage` không thuộc `CONTENT \| PRODUCT_COVER \| STOREFRONT \| POST` (`POST` từ M10b, `isTenantMediaUsage`) |
| `CLOUDINARY_NOT_CONFIGURED` | 400 | Cloudinary hệ thống chưa cấu hình (register) hoặc chưa cấu hình/đang tắt (ký) |

**System Admin — gói (`/admin/plans`)** ✅: form tạo/sửa gói có ô **"Dung lượng ảnh (MB)"** (field FormData
`imageStorageMb`, `z.coerce.number()` rồi `plan-validation.ts` yêu cầu số nguyên ≥ 0; mặc định form tạo mới 100).

---

## 12. Server Actions & hàm lib — Đánh giá sản phẩm (M10a, ADR-029)

Đối chiếu code 2026-09-28 ✅. Nghiệp vụ: [[02-System-Specs/Reviews-Specs|Reviews-Specs]]. Không có `route.ts` nào cho đánh giá;
không có hàm/route nào cho System Admin (§7.9).

### 12.1. Server Actions

| Action | File | Guard | Tham số | Kết quả |
| :-- | :-- | :-- | :-- | :-- |
| `upsertMyReviewAction` | `app/[tenantSlug]/[productSlug]/review-actions.ts` (ADR-030) | `requireVerified()` (đã xác minh email) | `(productId, prevState, formData)` — dùng `useActionState(upsertMyReviewAction.bind(null, productId), null)`; FormData `rating` ("1".."5"), `body` (tuỳ chọn) | `ReviewFormState`. Tạo mới → `after()` gửi email `review_new` cho chủ tenant |
| `deleteMyReviewAction` | cùng file | `requireVerified()` | `(reviewId)` | `ReviewFormState` (`success`) — xoá thật, tính lại điểm |
| `replyReviewAction` | `app/studio/[tenantSlug]/reviews/actions.ts` | `requireTenantMember` | `(tenantSlug, reviewId, reply)` — `reply` rỗng sau trim = xoá trả lời | `ReviewModerationState` |
| `hideReviewAction` | cùng file | `requireTenantMember` | `(tenantSlug, reviewId, reason)` — `reason` ∈ `SPAM \| OFFENSIVE \| IRRELEVANT \| PERSONAL_INFO \| OTHER` | `ReviewModerationState` |
| `unhideReviewAction` | cùng file | `requireTenantMember` | `(tenantSlug, reviewId)` | `ReviewModerationState` (đánh giá đã `VISIBLE` → thành công, không làm gì) |

- **`ReviewFormState`** = `{ success?, error?, code?, review?: MyReview, created?: boolean }`. `code` ổn định:
  `VALIDATION_ERROR` · `REVIEW_NOT_ELIGIBLE` · `REVIEW_ALREADY_EXISTS` · `RATE_LIMITED` · `UNAUTHORIZED` · `FORBIDDEN` ·
  `TENANT_NOT_ACTIVE` (ADR-040, 2026-10-17 ✅ — `upsertMyReview` khi gian hàng không `ACTIVE`, `httpStatus` 409, message "Gian hàng đang
  tạm ngưng hoạt động.").
- **`ReviewModerationState`** = `{ success?, error?, code? }`. `code`: `VALIDATION_ERROR` · `REVIEW_NOT_FOUND` ·
  `REVIEW_INVALID_HIDE_REASON` · `REVIEW_REFUNDED_LOCKED` · `FORBIDDEN` · `UNAUTHORIZED` · `NOT_FOUND`.
- Lỗi `AppError` có `expose` → trả trong state; lỗi khác bị ném tiếp (Next trả lỗi chung).
- `productId`, `tenantId`, `orderItemId`, `displayName` của đánh giá đều suy ở server (§7.5); `tenant.id` của action Studio
  luôn lấy từ guard. CSRF: cơ chế Server Action (§7.7).
- Revalidate ✅ (đọc code 2026-09-28): action khách → `revalidatePath("/[tenantSlug]/[productSlug]", "page")`,
  `revalidatePath("/[tenantSlug]", "page")`, `/account/library`; action Studio → layout `/studio/<slug>` (badge sidebar) + 2
  trang công khai trên (cùng route pattern).

### 12.2. Hàm lib (`apps/web/lib/review.ts`) — gọi từ Server Component

| Hàm | Scope RLS | Trả về / ghi chú |
| :-- | :-- | :-- |
| `getReviewEligibility(userId, productId)` | `withCustomer` (+ L1 `userProfile`) | `ReviewEligibility` = `{ canReview, existing: MyReview \| null, displayNamePreview }` |
| `upsertMyReview(userId, productId, { rating, body })` | `withCustomer` (+ `withSystemJob` khi khôi phục `REFUNDED`) | `{ review: MyReview, created, tenantId }` |
| `deleteMyReview(userId, reviewId)` | `withCustomer` | `{ productId }` |
| `getMyReviewsByProduct(userId, productIds)` | `withCustomer` | `Map<productId, { id, rating, status }>` cho Thư viện |
| `listTenantReviews(tenantId, filter?, cursor?)` | `withTenant` | `{ items: TenantReviewItem[], nextCursor }` — 20/trang, lọc `status`/`productId`/`rating` |
| `countReviewsNeedingAttention(tenantId)` | `withTenant` | Số `VISIBLE` chưa trả lời — badge sidebar |
| `countNewTenantReviews(tenantId, days = 7)` | `withTenant` | Số đánh giá tạo trong N ngày (mọi trạng thái) — ô Tổng quan |
| `replyToReview` / `hideReview` / `unhideReview` | `withTenant` | Dùng bởi action §12.1 |
| `listStorefrontReviewOptions(tenantId)` | `withTenant` | `StorefrontReviewOption[]` (≤ 200, `VISIBLE`, sản phẩm `PUBLISHED`) cho ô ghim trong editor storefront |
| `getProductReviews(productId, cursor?, limit = 10)` | `withPublic` | `{ items: PublicReview[], nextCursor }`; `limit` kẹp 1–50 (`PRODUCT_REVIEWS_PAGE_SIZE` 10, `..._MAX` 50) |
| `getProductRatingSummary({ id, ratingSum, ratingCount })` | `withPublic` | `ProductRatingSummary` = `{ average: number \| null, count, distribution: {1..5} }` |
| `getStorefrontReviews(tenantId, data)` | `withPublic` | `StorefrontReviewItem[]` (= `PublicReview` + `productTitle`, `productSlug`) cho section `reviews` |
| `recomputeProductRatings(productIds)` | `withSystemJob` + advisory lock | Tính lại cache điểm — nội bộ |
| `hideReviewsForRevokedItems(tx, tenantId, orderItemIds)` | transaction của caller | Nội bộ, gọi từ `markOrderRefunded`/`revokeEntitlement` |
| `notifyTenantOwnerOfReview({ tenantId, productId, reviewId })` | L1 `tenant` + `withTenant` | Email `review_new`, không ném lỗi |

- **`PublicReview`** = `{ id, rating, body, displayName, verifiedPurchase: true, reply, repliedAt, createdAt }` — không có
  `userId`/`orderItemId`/trạng thái ẩn.
- **`MyReview`** = `{ id, productId, rating, body, displayName, status, hiddenReason, reply, repliedAt, createdAt, updatedAt }`.

### 12.3. Kiểu dữ liệu mở rộng ở module khác ✅

| Kiểu | File | Trường thêm |
| :-- | :-- | :-- |
| `PublicProduct` (thẻ tài liệu storefront) | `apps/web/lib/storefront.ts` | `ratingAvg: number \| null` (từ `computeRatingAverage`), `ratingCount: number`; **`soldCount: number`** (ADR-033 — cột cache `products.soldCount`; 0 = UI không hiện "đã bán") |
| `ProductPreviewData.product` | `apps/web/lib/product.ts` | `ratingSum: number`, `ratingCount: number` (đưa vào `getProductRatingSummary`) |
| `LibraryEntitlement` | `apps/web/lib/library.ts` | `canReview: boolean` (= entitlement chưa thu hồi), `review: { id, rating, status } \| null` |

### 12.4. Mã lỗi & subpath

| Mã | HTTP (trong AppError) | Khi nào |
| :-- | :-- | :-- |
| `REVIEW_NOT_ELIGIBLE` | 403 | Không có đơn `FULFILLED` + entitlement chưa thu hồi; hoặc RLS/trigger từ chối (42501) |
| `REVIEW_NOT_FOUND` | 404 | Không có đánh giá đúng id (trong tenant / của chính khách) |
| `REVIEW_ALREADY_EXISTS` | 409 | Vi phạm unique `(productId, userId)` khi 2 lần tạo đua nhau |
| `REVIEW_REFUNDED_LOCKED` | 409 | Tenant ẩn/khôi phục đánh giá đang `HIDDEN(REFUNDED)` |
| `REVIEW_INVALID_HIDE_REASON` | 400 | Lý do ẩn không thuộc 5 lý do tenant được chọn |
| `RATE_LIMITED` | 429 | > 5 lần tạo/sửa / 10 phút / user (mã chung `@gieochu/core` `rateLimited`) |
| `VALIDATION_ERROR` | 400 | Sao ngoài 1–5, nội dung/trả lời > 2000 ký tự, id không hợp lệ |

Mã `REVIEW_*` khai trong `REVIEW_ERROR_CODES` của `apps/web/lib/review.ts` (không nằm trong `ErrorCodes` của
`@gieochu/core`). **Subpath `@gieochu/core/review`** (`packages/core/package.json` exports → `src/review/review.ts`): logic
thuần không phụ thuộc Node/DB để client component import — `formatReviewerDisplayName`, `normalizeReviewText`,
`parseReviewRating`, `computeRatingAverage`, `isTenantReviewHideReason`, hằng `REVIEW_BODY_MAX_LENGTH`/`REVIEW_REPLY_MAX_LENGTH`
(2000), `REVIEW_HIDDEN_REASONS`, `TENANT_REVIEW_HIDE_REASONS`, `REVIEW_HIDDEN_REASON_LABELS`, `REVIEW_ANONYMOUS_NAME`
("Khách hàng"); cũng re-export từ `@gieochu/core`.

---

## 13. Server Actions & hàm lib — Bài viết (M10b, ADR-029)

Đối chiếu code 2026-09-28 ✅. Nghiệp vụ: [[02-System-Specs/Posts-Specs|Posts-Specs]]. Không có `route.ts` nào cho bài viết;
không có hàm/route nào cho System Admin (§7.9).

### 13.1. Server Actions (`app/studio/[tenantSlug]/posts/actions.ts`)

Mọi action: guard `requireTenantMember(tenantSlug)`; `tenant.id` luôn lấy từ guard; CSRF theo cơ chế Server Action (§7.7).

| Action | Tham số | Kết quả |
| :-- | :-- | :-- |
| `createPostAction` | `(tenantSlug, prevState, formData)` — FormData `title` (tuỳ chọn, ≤200), `body` (HTML Tiptap, sanitize ở server, ≤6 ảnh), `productId` (tuỳ chọn, rỗng = không gắn), `status` (`PUBLISHED` \| `DRAFT`, vắng = `DRAFT`) | `PostActionState` — thành công `{ ok, postId, published }` (UI chuyển sang `/studio/[slug]/posts/[postId]`) |
| `updatePostAction` | `(tenantSlug, postId, prevState, formData)` — cùng field; **field vắng mặt = giữ nguyên**; `productId` có mặt nhưng rỗng = bỏ gắn; `status=DRAFT` trên bài đang đăng = gỡ bài; `status` vắng = giữ | `PostActionState` `{ ok, postId, published }`. Bài `HIDDEN` → `POST_HIDDEN_LOCKED` |
| `deletePostAction` | `(tenantSlug, postId)` — xoá hẳn, không khôi phục (được với cả bài `HIDDEN`) | `PostActionState` `{ ok }` |
| `pinPostAction` | `(tenantSlug, postId, pinned: boolean)` — ghim tự bỏ ghim bài khác | `PostActionState` `{ ok, postId }`; đua ghim → `POST_PIN_CONFLICT` |
| `getPostImageUploadSignatureAction` | `(tenantSlug)` | `CloudinarySignatureResult` (§11) usage `POST`; sau upload gọi `registerTenantImageAction(tenantSlug, publicId, "POST")` (`studio/[tenantSlug]/media-actions.ts`) để lấy `url` chèn vào nội dung |

- **`PostActionState`** = `{ ok?, error?, errorCode?, fieldErrors?: Record<string,string>, postId?, published? }` (giống
  `ProductActionState`). `fieldErrors` theo field FormData: `POST_TITLE_INVALID` → `title`; `POST_BODY_REQUIRED` /
  `POST_BODY_TOO_LONG` / `POST_TOO_MANY_IMAGES` → `body`; `POST_PRODUCT_INVALID` → `productId`; `status` sai →
  `VALIDATION_ERROR` + `fieldErrors.status`.
- Lỗi `AppError` có `expose` → trả trong state; lỗi khác bị ném tiếp.
- Revalidate: `/studio/<slug>/posts` (+ `/studio/<slug>/posts/<id>`), `/<slug>`, `/<slug>/posts` (+ `/<slug>/posts/<id>`).

### 13.2. Hàm lib (`apps/web/lib/post.ts`) — gọi từ Server Component

| Hàm | Scope RLS | Trả về / ghi chú |
| :-- | :-- | :-- |
| `listTenantPosts(tenantId, filter?: { status? }, cursor?)` | `withTenant` | `{ items: TenantPostListItem[], nextCursor }` — 20/trang (`TENANT_POSTS_PAGE_SIZE`), ghim trước rồi mới tạo trước. `TenantPostListItem` = `{ id, title, excerpt, status, hiddenReason, isPinned, publishedAt, createdAt, updatedAt, imageUrl, product: { id, title, status } \| null }` — `imageUrl` = ảnh Cloudinary hệ thống **hợp lệ đầu tiên** trong nội dung, rộng 320 (`POST_STUDIO_THUMB_WIDTH`), hoặc `null`; danh sách **không trả `body`** |
| `listPostProductOptions(tenantId)` | `withTenant` | `PostProductOption[]` = `{ id, title, status }` — sản phẩm chưa `ARCHIVED`, mới cập nhật trước, ≤ 200 |
| `getPostForEditor(tenantId, postId)` | `withTenant` | `PostEditorData` = `{ post, productOptions }`; `post` gồm `body` (HTML đã sanitize lúc lưu — nạp vào TiptapEditor) **và `bodyHtml`** (sanitize lại lúc đọc theo cloud hệ thống, ảnh rộng 1536 — chỉ để render trực tiếp, vd xem bài `HIDDEN`); `productOptions` thêm sản phẩm đang gắn (kể cả đã lưu trữ). Không có / sai tenant → `POST_NOT_FOUND` (404) |
| `postDisplayTitle({ title, excerpt })` | — | Tiêu đề → ~60 ký tự đầu trích đoạn → "Bài viết" |
| `listPublishedPosts(tenantId, cursor?, limit?)` | `withPublic` | `{ items: PublicPostSummary[], nextCursor }` — mặc định 12, tối đa 30; bài ghim đầu trang 1 |
| `getStorefrontPosts(tenantId, data: StorefrontPostsData)` | `withPublic` | `PublicPostSummary[]` — `limit` kẹp 3–9; `showPinnedFirst` |
| `getPublishedPost(tenantId, postId)` | `withPublic` | `PublicPostDetail \| null` — `null` khi không có / không `PUBLISHED` / tenant `LOCKED` (RLS) |
| `getPublishedPostMeta(tenantId, postId)` | `withPublic` | `{ title, excerpt } \| null` — cho `generateMetadata`, không đọc body |
| `createPost` / `updatePost` / `deletePost` / `setPostPinned` / `preparePostBody` / `isValidPostId` | `withTenant` | Dùng bởi action §13.1 |
| `getPublicProductsByIds(tenantId, ids)` (`apps/web/lib/storefront.ts`) | `withPublic` | `PublicProduct[]` — chỉ sản phẩm `PUBLISHED` trong danh sách id (khử trùng); dùng cho thẻ "Tài liệu liên quan" |

- **`PublicPostSummary`** = `{ id, title, excerpt, imageUrl (ảnh đầu, rộng 640) \| null, isPinned, publishedAt, product:
  PublicPostProduct \| null }`; **`PublicPostDetail`** = như trên bỏ `imageUrl`, thêm `bodyHtml`, `updatedAt`.
  **`PublicPostProduct`** = `Pick<PublicProduct, "id" | "slug" | "title" | "priceVnd" | "effectivePriceVnd" | "onSale" |
  "coverUrl">` — chỉ có khi sản phẩm còn `PUBLISHED`.
- Id từ URL/FormData phải khớp `^[a-z0-9]{1,40}$` (`isValidPostId`) trước khi vào truy vấn.

### 13.3. Mã lỗi & subpath

| Mã | HTTP (trong AppError) | Khi nào |
| :-- | :-- | :-- |
| `POST_NOT_FOUND` | 404 | Không có bài đúng id trong tenant |
| `POST_BODY_REQUIRED` | 400 | Sau sanitize không còn chữ và không có ảnh |
| `POST_BODY_TOO_LONG` | 400 | HTML > 100 000 ký tự (trước hoặc sau sanitize) |
| `POST_TITLE_INVALID` | 400 | Tiêu đề > 200 ký tự |
| `POST_TOO_MANY_IMAGES` | 400 | > 6 ảnh sau sanitize |
| `POST_PRODUCT_INVALID` | 400 | Sản phẩm không thuộc tenant / đã `ARCHIVED` / id sai; hoặc RLS/trigger từ chối (42501) |
| `POST_HIDDEN_LOCKED` | 403 | Sửa/đăng lại/ghim bài `HIDDEN` |
| `POST_PIN_CONFLICT` | 409 | Hai lần ghim đồng thời vi phạm partial unique index (`P2002`) |
| `FORBIDDEN` | 403 | Tenant không `ACTIVE` (`assertTenantCanWrite`) |

Mã `POST_*` khai trong `POST_ERROR_CODES` của `apps/web/lib/post.ts` (không nằm trong `ErrorCodes` của `@gieochu/core`).
**Subpath `@gieochu/core/post`** (`packages/core/package.json` exports → `src/content/post.ts`): logic thuần, client component
import được — `normalizePostTitle`, `htmlToPlainText`, `buildPostExcerpt`, `countRichTextImages`, `richTextImageSrcs(html)`
(mọi `src` ảnh theo thứ tự), `firstRichTextImageSrc(html, accept?)` (ảnh đầu tiên thoả `accept` — `lib/post.ts` truyền
`isCloudinaryImageUrl(src, cloud hệ thống)` để chọn ảnh **hợp lệ** đầu tiên cho thẻ Studio/công khai),
hằng `POST_TITLE_MAX_LENGTH` (200), `POST_EXCERPT_MAX_LENGTH` (300), `POST_MAX_IMAGES` (6), `POST_BODY_MAX_LENGTH` (100 000),
`POST_STATUS_LABELS` ("Bản nháp" / "Đã đăng" / "Bị ẩn do vi phạm"); cũng re-export từ `@gieochu/core`. Section storefront:
`StorefrontPostsData`, `STOREFRONT_POSTS_LIMIT_MIN/MAX` (3/9), `defaultStorefrontPostsSection` (`@gieochu/core`).

---

## 14. Server Actions & hàm lib — Cấu hình hệ thống (ADR-032) và CMS trang chủ (ADR-033) ✅

Đối chiếu code 2026-10-15. Chi tiết quyết định: [[01-Architecture-Decisions/ADR-018-System-Settings-And-Brand-From-System-Center|ADR-018 (≙ ADR-032)]],
[[01-Architecture-Decisions/ADR-019-Home-Page-Real-Data-Sold-Count|ADR-019 (≙ ADR-033)]].

### 14.1. Server Actions

| Action | File | Guard | Input → Output |
| :-- | :-- | :-- | :-- |
| `updateSystemSettingsAction(prevState, formData)` | `app/admin/settings/general/actions.ts` | `requireRole("SYSTEM_ADMIN")` (lỗi quyền trả về state, không ném) | FormData field = tên khoá (`accessTokenTtlMinutes`…); khoá inactive (`trialDays`) vắng → giữ giá trị cũ → `SystemSettingsActionState { ok, error?, code?, fieldErrors?, values? }`; `code` ∈ `VALIDATION_ERROR` / `UNAUTHORIZED` / `FORBIDDEN` / `INTERNAL_ERROR`. Ngoài khoảng → từ chối cả form. Revalidate `/admin/settings/general`, `/admin/settings` |
| `updateSupportEmailAction(prevState, formData)` | `app/admin/settings/actions.ts` | `requireRole("SYSTEM_ADMIN")` | `supportEmail` (zod email) → ghi `system_settings.supportEmail` + `updatedById` |
| `searchHomeTenantOptionsAction(search, includeIds)` | `app/admin/cms/home-editor/actions.ts` | `requireRole("SYSTEM_ADMIN")` | `search` chuỗi (khác chuỗi → bỏ), `includeIds` mảng id 1–64 ký tự, tối đa 12 → `HomeTenantOption[]` `{ id, name, slug, productCount, eligible }` (≤ 200 + id đang ghim) |
| `searchHomeProductOptionsAction(search, includeIds)` | `app/admin/cms/home-editor/actions.ts` | `requireRole("SYSTEM_ADMIN")` | như trên → `HomeProductOption[]` `{ id, title, tenantName, tenantSlug }` — id ghim không còn Công khai **không** được trả |

Các action có sẵn của editor trang chủ (`saveHomeDraftAction`, `publishHomeAction`, `restoreLiveHomeAction`) giữ nguyên guard
`requireRole("SYSTEM_ADMIN")`; lúc lưu validate chặt bằng `homeSectionsSchema` (schema mới ADR-033).

### 14.2. Hàm lib

| Hàm | File | Ghi chú |
| :-- | :-- | :-- |
| `getSystemSettings()` | `lib/system-settings.ts` | `cache()` theo request; parse phòng thủ → `SystemSettingsValues` (11 khoá; 17 từ ADR-053) |
| `getSystemSettingsPageData()` | `lib/system-settings.ts` | Loader trang `/admin/settings/general` (không cache): `values`, `bounds`, `invalidKeys`, `inactiveKeys`, `inactiveReasons`, `isDefault`, `updatedAt`, `updatedByEmail` |
| `getAccessTokenTtlSeconds()`, ~~`getRefreshTokenTtl()`~~ | `lib/jwt-context.ts` | TTL cho token **mới**. Từ ADR-053 `getRefreshTokenTtl()` đã xoá, thay bằng `getSessionPolicy(role, rememberMe): Promise<SessionPolicy>`; `getAccessTokenTtlSeconds()` chỉ còn `lib/account-profile.ts` dùng |
| `getEffectiveBrand()` | `lib/branding.ts` | `Brand { name, shortName, slogan }` = `resolveBrand(SystemBranding)`; thay `getBrand()` đã bỏ |
| `getHomeStats`, `buildHomeStatItems`, `getHomeSearchCategories`, `getHomeFeaturedTenants`, `getHomeFeaturedProducts`, `listHomeTenantOptions`, `listHomeProductOptions` | `lib/home.ts` | Mọi truy vấn trong `withPublic`; không đọc `orders` |
| `recomputeProductSoldCounts(productIds)` | `lib/product-sold-count.ts` | `withSystemJob`, gọi sau commit; lỗi chỉ log |
| `markOrderPaid(tx, orderId, source)` | `lib/order.ts` | Trả `{ fulfilled, productIds }` (đổi contract — bản HEAD trả `{ fulfilled: boolean }` ✅ `git show HEAD`) |
| `sendEmailNow(message)` | `lib/email-dispatch.ts` | Thiếu cấu hình SMTP + env → `{ ok:false, code:"EMAIL_NOT_CONFIGURED" }`; `emailNotConfiguredError()` = `AppError` 503 (ném ở luồng admin gửi lại email kích hoạt) |

### 14.3. Subpath dùng được ở client

* `@gieochu/core/system-settings` → `packages/core/src/settings/system-settings.ts`: `SYSTEM_SETTINGS_BOUNDS`,
  `SYSTEM_SETTING_KEYS`, `DEFAULT_SYSTEM_SETTINGS`, `INACTIVE_SYSTEM_SETTINGS`, `systemSettingsSchema`,
  `parseStoredSystemSettings`, `DISPLAY_TIME_ZONE`.
* `@gieochu/core/home-sections` → `packages/core/src/admin/home-sections.ts`: `homeSectionSchema(s)`, `parseHomeSections`,
  `HOME_STAT_KEYS`, `HOME_STAT_DEFAULT_LABELS`, `HOME_FEATURED_LIMIT_MIN/MAX` (3/12), `HOME_PINNED_MAX` (12),
  `HOME_COACHES_DEFAULT_LIMIT` (4), `HOME_DOCUMENTS_DEFAULT_LIMIT` (6), `HOME_SECTION_LABELS`.
* `@gieochu/config/brand`: `DEFAULT_BRAND`, `resolveBrand`, kiểu `Brand`.

---

## 15. Server Actions & hàm lib — CMS Cửa hàng (ADR-035 GĐ1) ✅

Đối chiếu code 2026-10-15 (working tree, chưa commit). Revalidate `/cua-hang`, `/cua-hang/tai-lieu` của `publishShopAction` nay trỏ
tới route có thật (GĐ2, §16). Nghiệp vụ: [[02-System-Specs/Shop-Marketplace-Specs|Shop-Marketplace-Specs]];
quyết định: [[01-Architecture-Decisions/ADR-021-Shop-Marketplace-Cms-First|ADR-021 (≙ ADR-035)]]. Mọi action là Server Action
(CSRF sẵn của Next, §7.7), không có Route Handler mới. Dòng dữ liệu: `CmsPage` slug `shop` (L1, `getPrismaClient()`).

### 15.1. Server Actions (`app/admin/cms/shop/actions.ts`)

| Action | Guard | Input → Output |
| :-- | :-- | :-- |
| `saveShopDraftAction(sections: unknown)` | `requireRole("SYSTEM_ADMIN")` | `sections` validate bằng `shopSectionsSchema` (+ ảnh hero đúng cloud hệ thống) → `upsert` slug `shop`: có dòng → chỉ ghi `blocksDraft`; chưa có → tạo `{ title: "Cửa hàng", blocks: defaultShopSections(), blocksDraft, status: "DRAFT" }`. Revalidate `/admin/cms/shop`, `/admin/cms` → `ShopEditorActionState { error?, success? }` |
| `publishShopAction(sections: unknown)` | `requireRole("SYSTEM_ADMIN")` | Validate như trên → `upsert`: `blocks` = bản gửi, `blocksDraft` = `DbNull`, `status: "PUBLISHED"`. Revalidate thêm `/cua-hang`, `/cua-hang/tai-lieu` → `ShopEditorActionState` |
| `restoreLiveShopAction()` | `requireRole("SYSTEM_ADMIN")` | `updateMany({ where: { slug: "shop" }, data: { blocksDraft: DbNull } })` — chưa có dòng thì không làm gì → `ShopEditorActionState` |
| `searchShopCategoryOptionsAction(search: unknown, includeIds: unknown)` | `requireRole("SYSTEM_ADMIN")` | `search` chuỗi (khác → bỏ); `includeIds` lọc chuỗi 1–64 ký tự, tối đa 14 → `CategoryPinOption[]` |

- Lỗi validate: `{ error: "Dữ liệu section không hợp lệ (<nhãn section>): <thông báo zod đầu tiên>" }`. Lỗi `AppError` có
  `expose` → `{ error: message }` (gồm lỗi quyền: `requireRole` ném `forbidden()` — `AppError` mặc định `expose: true`); lỗi khác
  ném tiếp. Riêng `searchShopCategoryOptionsAction` không bọc try/catch — lỗi quyền **ném** ra client (giống action tìm của trang chủ).
- Ô ghim tài liệu/gian hàng của editor Cửa hàng **gọi lại** `searchHomeProductOptionsAction`/`searchHomeTenantOptionsAction` (§14.1).
- Đổi contract ở CMS chung: `saveCmsPageAction` (`app/admin/cms/actions.ts`) trả `{ error }` khi slug thuộc `SYSTEM_CMS_SLUGS`
  (so khớp trim + chữ thường) — trước đây form chung ghi đè được `home`.

### 15.2. Hàm lib

| Hàm | File | Ghi chú |
| :-- | :-- | :-- |
| `getShopCmsEditorData(): Promise<ShopCmsEditorData>` | `lib/shop-cms.ts` | Không gác quyền bên trong — caller (`/admin/cms/shop/page.tsx`) gọi `requireAdminAccess`. Trả `{ sections, live, hasDraft, status: "NONE" \| "DRAFT" \| "PUBLISHED", updatedAt: Date \| null, pinOptions: { tenants, products, categories } }`; `sections` = nháp ?? live ?? mặc định (đã `parseShopSections`) |
| `listCategoryPinOptions(query?: { search?, includeIds?, includeMax? })` | `lib/home.ts` | `withPublic`; danh mục `isActive` A→Z tối đa 200 + id đang chọn (kể cả đã tắt) xếp trước → `CategoryPinOption { id, name, slug, productCount, eligible }` (`productCount` = tài liệu PUBLISHED + tenant ACTIVE; `eligible = isActive && productCount > 0`); `includeMax` mặc định 12. Caller phải `requireRole("SYSTEM_ADMIN")` |
| `toCategoryPinOption(option)` | `app/admin/cms/home-editor/pin-options.ts` | → `PinOption { id, label: name, hint: "<n> tài liệu công khai", eligible }` |

### 15.3. `@gieochu/core` — CMS slug và subpath `@gieochu/core/shop-sections`

* `packages/core/src/admin/cms-slugs.ts` (re-export từ `@gieochu/core`): `SYSTEM_CMS_SLUGS` (`["home","shop"]` lúc ADR-035; nay `["home","shop","pricing","menu"]` — §26), `HOME_CMS_SLUG`,
  `SHOP_CMS_SLUG`, `isSystemCmsSlug(slug)`, kiểu `SystemCmsSlug`.
* Subpath `@gieochu/core/shop-sections` (`packages/core/package.json` exports → `src/admin/shop-sections.ts`) — chỉ zod + helper
  thuần, **client component phải import qua subpath này** (barrel `@gieochu/core` kéo code server-only): `shopSectionSchema`,
  `shopSectionsSchema`, `isValidShopSections`, `parseShopSections`, `resolveShopSections`, `defaultShopSections`,
  `DEFAULT_SHOP_SECTIONS`, `defaultShopSectionData`, `defaultShopSectionId`, `isInternalShopHref`, `formatShopAvgTenths`,
  `parseShopAvgTenthsInput`, `SHOP_SECTION_TYPES`, `SHOP_SECTION_LABELS`, `SHOP_CATEGORY_MODES` (+ `_LABELS`),
  `SHOP_FEATURED_TENANTS_MODES` (+ `_LABELS`), hằng giới hạn `SHOP_*_MIN/MAX/DEFAULT`; kiểu `ShopSection`, `ShopSectionType`,
  `ShopSectionData<T>`, `ShopHeroData`, `ShopCategoriesData`, `ShopFeaturedData`, `ShopByCategoryData`, `ShopShelfData`,
  `ShopTopRatedData`, `ShopFeaturedTenantsData`, `ShopCtaOpenStoreData`, `ShopCategoryMode`, `ShopFeaturedTenantsMode`.
  Barrel `@gieochu/core` re-export phần lớn (không re-export các hằng `*_DEFAULT`, `SHOP_EYEBROW_MAX`… — chỉ có ở subpath).
* Loader trang công khai `apps/web/lib/shop.ts` (GĐ2): §16.

---

## 16. Trang công khai Cửa hàng + loader `apps/web/lib/shop.ts` (ADR-035 GĐ2) ✅

Đối chiếu code 2026-10-15 (working tree, chưa commit). Nghiệp vụ, quy tắc kệ, SEO:
[[02-System-Specs/Shop-Marketplace-Specs|Shop-Marketplace-Specs]] §4–§6. **Không thêm `route.ts`** (đếm lại 2026-10-15: 20 dưới
`/api`, 21 toàn `apps/web/app` ✅) — chỉ page Server Component + layout/loading/error; không có Server Action mới.

### 16.1. Trang (App Router)

| Đường dẫn | File | Guard | Query → Hành vi |
| :-- | :-- | :-- | :-- |
| `/cua-hang` | `app/cua-hang/page.tsx` (+ `layout.tsx`, `loading.tsx`, `error.tsx`) | Public (đọc `getCurrentUser()` chỉ để ẩn CTA mở gian hàng) | Không query. Render section `visible` của CMS slug `shop` (bản PUBLISHED, không thì mặc định). `generateMetadata`: canonical tuyệt đối `/cua-hang` |
| `/cua-hang/tai-lieu` | `app/cua-hang/tai-lieu/page.tsx` (+ `loading.tsx`; dùng chung `layout.tsx`/`error.tsx` của `cua-hang`) | Public | `q`, `danh-muc`, `sap-xep` (`noi-bat`\|`ban-chay`\|`danh-gia-cao`\|`moi-nhat`), `trang`; 24/trang; tham số sai hạ về mặc định (không 404); danh mục sai → bỏ lọc + ghi chú; trang vượt → trang cuối + ghi chú. Canonical không query; có `q` → `robots: noindex, follow` |

Thêm route tĩnh cấp gốc ⇒ 6 slug tenant dành riêng (`RESERVED_SLUGS`): `cua-hang`, `tai-lieu`, `danh-muc`, `tim-kiem`, `giao-vien`,
`kham-pha` ✅.

### 16.2. Hàm và hằng export từ `apps/web/lib/shop.ts`

| Export | Chữ ký / giá trị | Ghi chú |
| :-- | :-- | :-- |
| `getShopCmsSections` | `() => Promise<ShopSection[]>` | `cache()` theo request; `CmsPage` slug `shop` (L1) — PUBLISHED → `parseShopSections(blocks)`, còn lại/hỏng → `defaultShopSections()`; chỉ trả section `visible` |
| `getShopSeo` | `() => Promise<ShopSeo>` — `{ title, description, heroTitle }` (đều `string \| null`) | `title`/`description` từ `seoTitle`/`seoDescription` **chỉ khi** dòng PUBLISHED; chưa ghép tên thương hiệu |
| `getShopHeroStats` | `() => Promise<ShopHeroStats>` — `{ productCount, tenantCount }` | Hai phép đếm trong một `withPublic` |
| `getShopHeroAndCategories` | `(sections: readonly ShopSection[]) => Promise<ShopHeroAndCategories>` — `{ heroChips, categories }` | Nhóm Suspense (a); cả `hero` lẫn `categories` ẩn → không truy vấn |
| `getShopProductShelves` | `(sections) => Promise<ShopProductShelves>` — `{ featured, byCategory, bestSellers, topRated, newest }` | Nhóm (b); một `withPublic`, một `findMany` chi tiết |
| `getShopFeaturedTenants` | `(sections) => Promise<ShopFeaturedTenant[]>` | Nhóm (c); `withPublic` + `getTenantSales30d` |
| `getTenantSales30d` | `(tenantIds: readonly string[]) => Promise<Map<string, number>>` | **`withSystemJob`**; chỉ số đếm theo tenant, cache bộ nhớ 5 phút/instance; lỗi → map rỗng. Chỉ gọi với tenant đã lọc ở server — không dùng cho route admin, không nhận input client |
| `shouldShowOpenStoreCta` | `(viewer: Pick<CurrentUser, "userId"> \| null) => Promise<boolean>` | `false` nếu viewer là chủ một tenant (`tenants.ownerId`, L1); chưa xét STAFF |
| `getShopPageData` | `(sections: ShopSection[], viewer: CurrentUser \| null) => Promise<ShopPageData>` | Tiện ích gộp 3 nhóm + CTA (không Suspense) — page hiện **không** dùng |
| `searchShopProducts` | `(input: ShopSearchInput) => Promise<ShopSearchResult>` | Một `withPublic`; tìm không dấu (`public.gieochu_unaccent`) trên tiêu đề/`summary`/tên tenant/tên danh mục đang bật; `page` kẹp 1…`pageCount` |
| `parseShopSearchParams` | `(searchParams: Record<string, string \| string[] \| undefined>) => ShopSearchParams` — `{ q, categorySlug, sort, page }` | Không ném; dựa trên `shopSearchParamsSchema` (zod, export) |
| `normalizeShopQuery` | `(value: string \| undefined \| null) => string \| undefined` | NFC, trim, cắt 100 ký tự |
| `escapeLikePattern` | `(value: string) => string` | Escape `\`, `%`, `_` (dùng với `ESCAPE '\'`) |
| `shopSearchHref` | `(params?: { q?, categorySlug?, sort?, page? }) => string` | Dựng `/cua-hang/tai-lieu?…`, bỏ `sap-xep=noi-bat`, `trang=1` |
| Hằng | `SHOP_PATH = "/cua-hang"`, `SHOP_SEARCH_PATH = "/cua-hang/tai-lieu"`, `SHOP_SORTS`, `SHOP_DEFAULT_SORT = "noi-bat"`, `SHOP_SORT_LABELS`, `SHOP_SEARCH_PAGE_SIZE = 24`, `SHOP_SEARCH_Q_MAX = 100` | |

**Kiểu dữ liệu:** `ShopProduct` = `HomeFeaturedProduct` + `typeLabel: string`; `ShopCategory { id, slug, name, imageUrl, productCount }`;
`ShopCategoryShelf { category, products, href }`; `ShopFeaturedTenant` = `HomeFeaturedTenant` + `sales30d: number | null` (null ở
`TOP_RATED`; **không hiển thị**); `ShopSort`; `ShopPageData`; `ShopSearchInput { q?, categorySlug?, sort, page, pageSize: 24 }`;
`ShopSearchResult { items, total, page, pageCount (≥1), category: ShopCategory | null }`.

### 16.3. Export mới ở `apps/web/lib/home.ts` (để `lib/shop.ts` dùng lại — không đổi hành vi trang chủ)

`PUBLIC_PRODUCT_WHERE`, `orderByPinned`, `tenantLogoUrl`, `fillProductIdsQuery` (trước là hàm/hằng nội bộ) ✅ `git diff`.

### 16.4. `@gieochu/core` — nhãn loại tài liệu (subpath `@gieochu/core/product-type`)

`packages/core/src/product/type-label.ts` (re-export từ barrel `@gieochu/core`; client import qua subpath — file không phụ thuộc gì):
`PRODUCT_TYPES` (`["TEMPLATE","SLIDE","EBOOK","EXAM","OTHER"]`, khớp enum `ProductType`), `PRODUCT_TYPE_LABELS` (Mẫu tài liệu /
Slide bài giảng / Sách điện tử / Đề thi / Tài liệu), `productTypeLabel(type: string)` (giá trị lạ → nhãn `OTHER`), kiểu
`ProductTypeValue`. Storefront tenant (`[tenantSlug]/_ui/products.tsx`, `product-detail.tsx`) và `lib/shop.ts` dùng nguồn này; map
`PRODUCT_TYPE_LABEL` cũ ở `[tenantSlug]/_ui/icons.tsx` đã gỡ ✅. Editor Studio (`studio/.../editor-bits.tsx`) **vẫn** có map nhãn
riêng khác chữ ("Mẫu / Template", "Đề thi / Đề kiểm tra") — BACKLOG.

---

## 17. Cron (`/api/cron`) — 1 route (ADR-036) ✅

Đối chiếu `apps/web/app/api/cron/daily/route.ts` working tree 2026-10-16 (**chưa commit/deploy**). Nghiệp vụ:
[[02-System-Specs/Background-Jobs-Specs|Background-Jobs-Specs]] §5.

| Method | Endpoint | Truy cập | Mô tả |
| :-- | :-- | :-- | :-- |
| `GET` | `/api/cron/daily` | Header `Authorization: Bearer <CRON_SECRET>` (so sánh `timingSafeEqual` cả chuỗi; khác độ dài → từ chối trước). Không dùng cookie/session | Vercel Cron gọi mỗi ngày (`apps/web/vercel.json`: `0 20 * * *` UTC = 03:00 giờ VN). Chạy tuần tự, mỗi bước cô lập: `runSubscriptionSweep()` → `runOrderSweep()` → `superviseQueues([payment.process, file.scan])` → `audit.purgeExpired()` (bước `audit.purge`, thêm ở M12a — ADR-037) → `runStatsAggregation()` (bước `stats.aggregate`, thêm ở M12b — ADR-037) → `purgeExpiredAbuseReportIps()` (bước `abuse_report.ip_purge`, thêm ở M12c — ADR-038) → `purgeStaleRefreshTokens()` (bước `refresh_tokens.purge`, thêm ở ADR-053) → `purgeExpiredDownloadEvents()` (bước `download_events.purge`, thêm ở ADR-054) → `drainQueues(cùng 2 hàng đợi, ngân sách 40 giây)`. `maxDuration = 60`, `dynamic = "force-dynamic"`. |

**Response** — chỉ số đếm, không dữ liệu tenant/đơn/khách (CLAUDE.md §7.9):

| HTTP | Thân | Khi nào |
| :-: | :-- | :-- |
| `200` | `{ ok: true, requestId, results }` | Mọi bước thành công |
| `500` | `{ error: { code: "CRON_STEP_FAILED", message, requestId }, results }` | Ít nhất một bước lỗi (các bước khác vẫn chạy; chi tiết lỗi chỉ ở log) |
| `401` | `{ error: { code: "UNAUTHORIZED", message, requestId } }` | Thiếu/sai header `Authorization` |
| `503` | `{ error: { code: "CRON_NOT_CONFIGURED", message, requestId } }` | Env `CRON_SECRET` chưa đặt (biến tuỳ chọn) |

`results` = `{ subscriptionSweep, orderSweep, orderReminders, rateLimitPurge, queueMaintenance, queues, auditPurge, statsAggregate, reportIpPurge, sessionPurge, downloadPurge }` (từ đợt 1 ADR-061, 2026-10-27: `orderReminders.result = { sent: number }` — bước `order.payment_reminders`; `rateLimitPurge.result = { deleted: number }` — bước `rate_limit_counters.purge`), mỗi phần tử dạng `{ ok: true, result }` hoặc
`{ ok: false }`: `subscriptionSweep.result = {}`; `orderSweep.result = { expired: number }` (số đơn chuyển `EXPIRED`); `queueMaintenance.result =
{ queues: number }`; `queues.result = { processed, failed, budgetExhausted }`; `auditPurge.result = { deleted: number, skipped: boolean }`
(số dòng `audit_logs` > 12 tháng đã xoá; `skipped: true` khi bảng chưa tồn tại — M12a, ADR-037); `statsAggregate.result =
{ skipped, backfilled, fromDate, toDate, upserted }` (`StatsAggregationResult` — `fromDate`/`toDate` dạng `YYYY-MM-DD` ngày VN hoặc `null` khi
`skipped`; `upserted` = số dòng (tenant, ngày) có hoạt động đã ghi; `backfilled: true` khi bảng trống và lần chạy này backfill — M12b, ADR-037); `reportIpPurge.result = { cleared: number, skipped: boolean }` (số báo cáo cũ hơn
12 tháng vừa đặt `ip = NULL`; `skipped: true` khi bảng `abuse_reports` chưa tồn tại — M12c, ADR-038); `sessionPurge.result = { deleted: number }` (số dòng
`refresh_tokens` có `expiresAt` hoặc `revokedAt` cũ hơn 90 ngày đã xoá — ADR-053); `downloadPurge.result = { deleted: number }` (số dòng `download_events`
có `createdAt` cũ hơn 12 tháng đã xoá, chạy qua `withSystemJob` — ADR-054 mục 8; không có nhánh `skipped`). Lưu ý: `500 CRON_STEP_FAILED` có thêm khoá `results`
ngoài khung lỗi chuẩn `{ error }`.

---

## 18. Trang & loader Audit log (M12a, ADR-037) ✅

Đối chiếu working tree 2026-10-16 (**chưa commit/deploy**). **Không có `route.ts`, không có Server Action** — hai trang là Server
Component đọc bộ lọc từ query string (form `method="get"`). Nghiệp vụ: [[02-System-Specs/Audit-Log-Specs|Audit-Log-Specs]].

### 18.1. Trang

| Trang | Guard trang | Loader | Query string |
| :-- | :-- | :-- | :-- |
| `/admin/audit` | `requireAdminAccess("/admin/audit")` | `listAuditLogs(sp)` — tự `requireRole("SYSTEM_ADMIN")` | `actor` (email hoặc id), `action`, `tenant` (slug hoặc id), `from`, `to` (`YYYY-MM-DD`, giờ VN), `page`, `pageSize` ∈ 10/20/50/100 |
| `/studio/{slug}/activity` | `requireTenantMemberPage(slug, …)` | `listTenantAuditLogs(tenant.id, sp)` — tự `requireUser()` + chỉ OWNER, ngược lại ném `forbidden` | `action`, `from`, `to`, `page`, `pageSize` (bỏ qua `actor`/`tenant`) |

Cả hai có `loading.tsx` (`AuditLogSkeleton`).

### 18.2. Export của `apps/web/lib/audit-query.ts`

| Export | Ghi chú |
| :-- | :-- |
| `listAuditLogs(sp)` / `listTenantAuditLogs(tenantId, sp)` | → `AuditLogListResult` = `{ status: "ok", rows, total, filters, unmatchedFilter: "actor" \| "tenant" \| null }` hoặc `{ status: "unavailable", filters }` (bảng chưa có) |
| `parseAuditLogFilters(sp)` | Chuẩn hoá bộ lọc → `AuditLogAppliedFilters` (action lạ → `""`, ngày sai → `""`, page ≥ 1, pageSize mặc định 20) |
| `AUDIT_PAGE_SIZES` | `[10, 20, 50, 100]` |
| Kiểu `AuditLogSearchParams`, `AuditLogAppliedFilters`, `AuditLogRowView`, `AuditActorView`, `AuditActorKind` | `AuditLogRowView`: `id`, `createdAt` (ISO UTC), `action`, `actionLabel`, `scope`, `scopeLabel`, `actor { id, kind, label, name }`, `tenant` (chỉ view admin), `targetType`, `targetId`, `metadata`, `ip`, `userAgent`. `AuditActorKind` = `SYSTEM` · `ADMIN` · `MEMBER` · `USER` · `CUSTOMER` · `DELETED` |

### 18.3. Export của `apps/web/lib/audit.ts` (ghi — dùng ở server)

`audit.log(input: AuditLogInput) → Promise<boolean>` (không ném), `audit.purgeExpired() → Promise<{ deleted, skipped }>`,
`auditMetaFromRequest(request)`, `auditMetaFromHeaders()`, `isAuditTableMissing(error)`; kiểu `AuditLogInput`, `AuditRequestMeta`,
`AuditPurgeResult`. Hằng/hàm thuần ở subpath **`@gieochu/core/audit`** (cũng export ở `@gieochu/core`): `AUDIT_ACTIONS`,
`AUDIT_ACTION_LABELS`, `AUDIT_SCOPES`, `AUDIT_SCOPE_LABELS`, `auditActionLabel`, `isAuditAction`, `isAuditScope`, `sanitizeAuditMetadata`,
`maskEmail`, `extractAuditIp`, `normalizeAuditUserAgent`, `AUDIT_REDACTED`, `AUDIT_METADATA_MAX_BYTES`, `AUDIT_IP_MAX_LENGTH`,
`AUDIT_USER_AGENT_MAX_LENGTH`; kiểu `AuditAction`, `AuditScopeValue`, `AuditMetadata`, `AuditJsonValue`.

### 18.4. Chữ ký hàm lib đổi (contract nội bộ giữa Server Action ↔ lib)

Thêm tham số cuối `actorId: string | null = null`: `archiveProduct`, `confirmOrderManually`, `markOrderRefunded`,
`grantExtraDownloads`, `revokeEntitlement`, `createShareLink`, `revokeShareLink`, `hideReview`, `unhideReview`,
`confirmManualInvoicePayment`, `testPlatformProviderConnection`; input lưu cấu hình thanh toán platform/tenant thêm `actorId?`.
`markInvoicePaid(invoiceId, { source: "PLATFORM_WEBHOOK" | "ADMIN_MANUAL_CONFIRM", actorId? })`. **`unlockUser(actor, targetUserId)`** —
`actor` bắt buộc (phá chữ ký cũ). Mới: `auditMarkOrderPaid(tenantId, orderId, result, source)`; `MarkOrderPaidResult` thêm
`couponOverused: { couponId, couponCode } | null`. Từ M12c (ADR-038): `publishProduct(tenantId, productId, actorId: string | null,
{ rightsConfirmed: boolean })` — `actorId` + options **bắt buộc** (§20.4).

---

## 19. Thống kê bán tài liệu — job + loader dashboard (M12b, ADR-037) ✅

Đối chiếu working tree 2026-10-16 (**chưa commit/deploy**). **Không có `route.ts`/Server Action mới** — job chạy trong cron §17, dashboard
`/admin` là Server Component đọc loader trong `<Suspense>` riêng. Nghiệp vụ: [[02-System-Specs/Tenant-Stats-Specs|Tenant-Stats-Specs]].

### 19.1. Export của `apps/web/lib/tenant-stats.ts` (ghi — job)

| Export | Ghi chú |
| :-- | :-- |
| `aggregateTenantDailyStats({ fromDate, toDate, tenantIds? }) → Promise<number>` | Ngày VN `YYYY-MM-DD`, tính cả 2 đầu; `fromDate > toDate`, ngày sai, hoặc khoảng > 400 ngày → `AppError VALIDATION_ERROR` (400). Chia cửa sổ 31 ngày, mỗi cửa sổ 1 transaction `withSystemJob` có `pg_advisory_xact_lock(hashtext('stats.aggregate'))`. `tenantIds` chỉ dùng cho test (mảng rỗng → 0). Trả tổng số dòng (tenant, ngày) có hoạt động đã upsert. Bảng chưa có → ném (nơi gọi xử lý) |
| `runStatsAggregation(now = new Date()) → Promise<StatsAggregationResult>` | Bước cron: hôm qua + hôm nay (giờ VN); bảng trống → backfill từ ngày hoạt động sớm nhất (sàn 400 ngày tính cả hôm nay). Bảng chưa có → `{ skipped: true, backfilled: false, fromDate: null, toDate: null, upserted: 0 }` + `logger.warn` |
| `vnDateString(at: Date)`, `addDays(date, days)` | Ngày VN `YYYY-MM-DD` của một thời điểm; cộng/trừ ngày lịch thuần |
| `isStatsTableMissing(error)` | P2021 hoặc 42P01/`tenant_daily_stats ... does not exist` |
| `MAX_BACKFILL_DAYS` (= 400) | Hằng |
| Kiểu `TenantDailyStatRow`, `AggregateTenantDailyStatsInput`, `StatsAggregationResult` | `TenantDailyStatRow.gmvVnd` là **chuỗi** BIGINT |

### 19.2. Export của `apps/web/lib/admin-stats.ts` (đọc — dashboard)

`getAdminStatsOverview({ days?, now? }) → Promise<AdminStatsOverview>` — `days` mặc định 30, kẹp 1…366. **Không tự kiểm quyền**: nơi gọi phải
`requireRole` SYSTEM_ADMIN (trang `/admin` gọi `requireAdminAccess("/admin")` trước) ✅. Chỉ đọc `tenant_daily_stats` + `tenants` (`id`,
`name`, `slug`) bằng `getPrismaClient()`.

```ts
type AdminStatsOverview =
  | { status: "unavailable" }                       // bảng chưa có (trước migration M12b)
  | {
      status: "ok";
      lastAggregatedAt: string | null;              // ISO UTC = MAX(updatedAt) toàn bảng; null khi bảng trống
      totals: AdminStatsTotals;                     // cửa sổ `days` ngày kết thúc ở HÔM QUA (giờ VN)
      prevTotals: AdminStatsTotals;                 // `days` ngày liền trước
      series: AdminStatsSeriesPoint[];              // đủ `days` điểm, cũ → mới; ngày không có dòng = 0
      topTenants: AdminStatsTopTenant[];            // ≤ 5, theo GMV giảm dần (hoà → tenantId tăng), chỉ tenant GMV > 0
    };
interface AdminStatsTotals { gmvVnd: string; ordersPaid: number; newCustomers: number; downloads: number } // gmvVnd = chuỗi số nguyên VND
interface AdminStatsSeriesPoint extends AdminStatsTotals { date: string }                                   // YYYY-MM-DD ngày VN
interface AdminStatsTopTenant { tenantId: string; name: string; slug: string; gmvVnd: string; ordersPaid: number }
```

### 19.3. Trang

| Trang | Guard | Query string | Ghi chú |
| :-- | :-- | :-- | :-- |
| `/admin` (dashboard) | `requireAdminAccess("/admin")` | `chi-so` = `gmv` (mặc định, mọi giá trị khác) \| `don` — `parseSalesChartMetric` | Section "Hoạt động bán tài liệu (30 ngày)" (`id="hoat-dong-ban-tai-lieu"`) gọi `getAdminStatsOverview({ days: 30 })` trong `<Suspense fallback={<SalesStatsSkeleton />}>`. Bố cục: [[04-Operations-Runbooks/UI-Design-System|UI-Design-System]] §16 |

---

## 20. Báo cáo vi phạm & quyền lợi người mua (M12c — ADR-038, ADR-039) ✅

Đối chiếu working tree 2026-10-17 (nay đã commit `36103fb`, deploy ❓). Nghiệp vụ: [[02-System-Specs/Abuse-Reports-Specs|Abuse-Reports-Specs]].

### 20.1. Route — `POST /api/reports`

| Method | Endpoint | Truy cập | Mô tả |
| :-- | :-- | :-- | :-- |
| `POST` | `/api/reports` | Public (đăng nhập tuỳ chọn) + `assertSameOrigin` | Gửi báo cáo vi phạm. Body JSON (`abuseReportSubmissionSchema`, `@gieochu/core/abuse-report`): `{ targetType: "PRODUCT" \| "REVIEW" \| "POST", targetId, type: "COPYRIGHT" \| "INAPPROPRIATE" \| "SCAM" \| "OTHER", description (1–2000 ký tự sau chuẩn hoá NFC/bỏ ký tự điều khiển), evidenceUrls? (≤5, http/https, bỏ trùng), email? (bắt buộc khi chưa đăng nhập; đã đăng nhập → bỏ qua, dùng email tài khoản), website? (honeypot) }`. `dynamic = "force-dynamic"` |

| HTTP | Thân / mã | Khi nào |
| :-: | :-- | :-- |
| `201` | `{ ok: true, message }` | Đã ghi — **hoặc** honeypot `website` có giá trị (không ghi gì, cố ý trả thành công) |
| `400` | `INVALID_JSON` · `VALIDATION_ERROR` · `REPORT_EMAIL_REQUIRED` | Body hỏng / sai schema (chỉ thông điệp lỗi đầu tiên, **không** có trường `field`) / khách thiếu email |
| `403` | `ORIGIN_MISMATCH` | Thiếu/sai header `Origin` (so với `APP_URL` hoặc origin của request) |
| `404` | `REPORT_TARGET_NOT_FOUND` | Đối tượng không tồn tại / không công khai (đọc dưới `withPublic`) / tenant **không `ACTIVE`** (`READ_ONLY` hoặc `LOCKED` — ADR-040 ✅; trước đó chỉ `LOCKED`) |
| `409` | `REPORT_DUPLICATE` | Cùng người báo cáo (email hoặc user) đã có báo cáo `OPEN` cho đối tượng này |
| `429` | `RATE_LIMITED` | ≥5 báo cáo trong 1 giờ từ cùng IP (đếm trong `abuse_reports`) |
| `503` | `REPORT_UNAVAILABLE` | Bảng `abuse_reports` chưa có (code lên trước migration) |

Mọi lỗi theo khung `{ error: { code, message, requestId } }`. Kiểm thử thủ công trên dev (201, 409 trùng, 403 thiếu Origin) 🟡 (Quốc báo).

### 20.2. Server Actions — System Center (`app/admin/reports/actions.ts`)

Mỗi action tự `requireRole("SYSTEM_ADMIN")`; trả `ReportActionState = { ok?, error?, code?, resolvedCount? }` (lỗi `AppError` → `{ error, code }`).

| Action | Tham số | Ghi chú |
| :-- | :-- | :-- |
| `resolveReportAction(reportId, prev, formData)` | FormData `decision` (`HIDE_CONTENT` \| `ARCHIVE_PRODUCT` \| `LOCK_TENANT` \| `REJECT`), `note` (≤2000, tuỳ chọn, nội bộ), `applyToSameTarget` (`on`/`true`) | Gọi `resolveAbuseReport`; email gửi trong `after()` (`notifyAbuseReportResolution`); revalidate `/admin/reports`, trang công khai tenant (+ `/admin/tenants` khi khoá). Mã lỗi: `REPORT_NOT_FOUND` 404, `REPORT_ALREADY_RESOLVED` 409, `REPORT_INVALID_DECISION` 400, `REPORT_TARGET_GONE` 409, `VALIDATION_ERROR` 400, `REPORT_UNAVAILABLE` 503 |
| `unlockModerationAction(targetType, targetId)` | `PRODUCT` \| `REVIEW` \| `POST` + id | Gọi `unlockModeration`. Mã lỗi: `CONTENT_NOT_MODERATION_LOCKED` 409, `VALIDATION_ERROR` 400 |

Trang: `/admin/reports` (query `status` = `OPEN` mặc định \| `RESOLVED` \| `REJECTED` \| `ALL`, `type`, `targetType`, `page`, `pageSize` ∈ {10, 20,
50, 100}) và `/admin/reports/[reportId]` — đều `requireAdminAccess`.

### 20.3. Server Actions — Thư viện khách (`app/account/library/actions.ts`)

Mỗi action tự `requireVerified()`; quyền sở hữu kiểm trong lib (`withCustomer`). Dùng với `useActionState` qua `action.bind(null,
entitlementId)`; trả `RemedyActionState = { ok?, error?, code? }`; revalidate `/account/library`.

| Action | Kết quả | Mã lỗi |
| :-- | :-- | :-- |
| `chooseFinalDownloadAction(entitlementId)` | `PENDING_CHOICE` → `FINAL_DOWNLOAD`, `downloadLimit = downloadsUsed + max(1, số tệp khả dụng)` | 404 (không phải của mình), `REMEDY_NOT_PENDING` 409 |
| `requestRefundAction(entitlementId)` | `PENDING_CHOICE` → `REFUND_REQUESTED`; email tenant trong `after()` | 404, `REMEDY_NOT_PENDING` 409, `REMEDY_REFUND_NOT_AVAILABLE` 409 (đơn 0đ) |

### 20.4. Thay đổi contract ở module khác ✅

| Chỗ | Thay đổi |
| :-- | :-- |
| Studio sản phẩm — `publishProductAction(slug, id, options?)` | Thêm `options?: { rightsConfirmed?: boolean }`; thiếu → `{ error, fieldErrors: { rightsConfirmed } }` (`RIGHTS_CONFIRMATION_REQUIRED`). Các action lưu-và-xuất-bản đọc FormData `rightsConfirmed` (`on`/`true`/`1`) |
| Studio sản phẩm/đánh giá/bài viết | Thao tác đổi trạng thái trên nội dung bị khoá → `CONTENT_MODERATION_LOCKED` 409 |
| Studio đơn hàng — `grantExtraDownloads` | `REMEDY_DOWNLOAD_LIMIT_LOCKED` 409 khi entitlement có remedy |
| Studio đơn hàng — trang `/studio/{slug}/orders` | Query mới `remedy=REFUND_REQUESTED` (`parseOrderRemedyFilter`, kết hợp `status`); `listOrders` trả thêm `refundRequested: boolean`, mỗi item kèm `entitlement { remedyStatus, remedyChosenAt }`. **Từ ADR-046** trang dùng `listOrdersPage` (§23), `remedy=REFUND_REQUESTED` giữ nguyên; `listOrders` đã xoá (ADR-047, §23.4) |
| Checkout — `initiateOrderCheckout`, `applyCouponToOrder` | `PRODUCT_UNAVAILABLE` 409 khi tenant không `ACTIVE` hoặc sản phẩm không `PUBLISHED` . Từ ADR-056 thêm `ORDER_CHANGED` 409 / `CHECKOUT_CREATE_FAILED` 502 (§27.3) |
| Thư viện — `LibraryEntitlement` | Thêm `remedyStatus`, `refundAvailable`, `remedyChosenAt`, `remedyResolvedAt`, `finalDownloadFileCount`, `orderCode` |
| `TenantNavItem` (sidebar Studio) | Thêm `badge?: { text, srText, urgent? }` |

### 20.5. Export lib & subpath

- `apps/web/lib/abuse-report.ts`: `submitAbuseReport`, `listAbuseReports`, `parseAbuseReportFilters`, `countOpenAbuseReports`,
  `getAbuseReportDetail`, `resolveAbuseReport`, `notifyAbuseReportResolution`, `unlockModeration`, `purgeExpiredAbuseReportIps`,
  `ABUSE_REPORTS_PAGE_SIZE_DEFAULT` + kiểu. Mọi loader/hàm admin tự kiểm `SYSTEM_ADMIN`.
- `apps/web/lib/entitlement-remedy.ts`: `openPurchaseRemedies` (trong transaction xử lý báo cáo), `notifyPurchaseRemedyOpened`,
  `notifyPurchaseRemedyForOrder`, `chooseFinalDownload`, `requestRefund`, `notifyRefundRequested`, `countPendingRefundRequests(tenantId)` →
  `{ pending, overdue }`, `countOverdueRefundRequestsByTenant({ tenantId? })` → `[{ tenantId, name, slug, count }]` (chỉ số đếm, §7.9).
- `apps/web/lib/moderation.ts`: `contentModerationLocked()`, `assertNotModerationLocked(row)`.
- `apps/web/lib/tenant-lock.ts`: `lockTenantInTx`, `auditTenantLocked`, `lockTenant`, `unlockTenant`.
- `apps/web/lib/origin-guard.ts`: `assertSameOrigin(request)` (403 `ORIGIN_MISMATCH`).
- **`@gieochu/core/abuse-report`** (`packages/core/src/report/abuse-report.ts`): hằng enum + nhãn tiếng Việt, giới hạn (`ABUSE_REPORT_RATE_LIMIT`
  = 5, cửa sổ 1 giờ, mô tả 2000, ≤5 link), `ABUSE_REPORT_HONEYPOT_FIELD = "website"`, `ABUSE_REPORT_ERROR_CODES`,
  `CONTENT_MODERATION_LOCKED_MESSAGE`, `allowedAbuseDecisions`, `isEnforcementDecision`, `normalizeReportText`, `normalizeEvidenceUrl`,
  `abuseReportSubmissionSchema`.
- **`@gieochu/core/entitlement-remedy`** (`packages/core/src/download/entitlement-remedy.ts`): `ENTITLEMENT_REMEDY_STATUSES`,
  `REMEDY_REFUND_SLA_DAYS = 7`, `ENTITLEMENT_REMEDY_ERROR_CODES` (`REMEDY_CHOICE_REQUIRED`, `DOWNLOAD_BLOCKED_REFUND`, `REMEDY_NOT_PENDING`,
  `REMEDY_REFUND_NOT_AVAILABLE`, `REMEDY_DOWNLOAD_LIMIT_LOCKED`), `ENTITLEMENT_REMEDY_STATUS_LABELS`, `remedyDownloadBlock`.
- `@gieochu/email`: `renderAbuseReportResolvedEmail`, `renderContentModeratedEmail`, `renderPurchaseRemedyCustomerEmail`,
  `renderPurchaseRemedyTenantEmail`, `renderRefundRequestedEmail`.

---

## 21. Bảng giá CMS, hoàn tiền gói, Hồ sơ tài khoản (ADR-041) ✅

Đối chiếu working tree 2026-10-17 (**chưa commit/deploy**; 2 migration đã áp DB 🟡). Nghiệp vụ:
[[02-System-Specs/Pricing-Page-Specs|Pricing-Page-Specs]], [[02-System-Specs/Account-Profile-Specs|Account-Profile-Specs]],
[[02-System-Specs/Payment-And-Billing|Payment-And-Billing]] §5A–§5B. Không thêm `route.ts` — toàn bộ là trang + Server Action.

### 21.1. CMS Bảng giá — `app/admin/cms/pricing/actions.ts`

Mỗi action tự `requireRole("SYSTEM_ADMIN")`; trả `PricingEditorActionState = { success?, error?, issues?: PricingSectionIssue[] }`
(`issues` ≤ 20, `{ sectionId, field, message }`, `field` là đường dẫn chấm trong `data`). Section validate lại bằng
`pricingSectionsSchema` (chặt) + `validatePricingPlanRefs` với danh sách `Plan` thật. Audit `PRICING_CMS_UPDATED` (metadata chỉ `operation`).

| Action | Hành vi |
| :-- | :-- |
| `savePricingDraftAction(sections, seo)` | Ghi `blocksDraft` + SEO (cột không có nháp → đã `PUBLISHED` thì SEO đổi ngay); chưa có dòng `pricing` → `upsert` tạo dòng DRAFT, live = mặc định |
| `publishPricingAction(sections, seo)` | Ghi `blocks`, xoá nháp, `status = PUBLISHED`; `revalidatePath("/pricing")` |
| `restoreLivePricingAction()` | Bỏ nháp, quay về bản live |

`seo = { seoTitle, seoDescription }` — trim, ≤ 120 / ≤ 320 ký tự (`PRICING_SEO_TITLE_MAX`/`PRICING_SEO_DESCRIPTION_MAX`), rỗng → `null`; trang
`/pricing` chỉ dùng khi dòng `PUBLISHED` ✅.

Loader `apps/web/lib/pricing-cms.ts`:
- `getPricingCmsEditorData()` → `PricingCmsEditorData { sections (nháp ?? live ?? mặc định), live, hasDraft, status: "NONE" | "DRAFT" |
  "PUBLISHED", updatedAt, seoTitle, seoDescription, plans (mọi gói, kể cả đã tắt), stats, enabledProviders, graceDays, implementedFeatures }`.
- `getPricingPageData({ preview? })` → `PricingPageData { sections (đã thay {brand}/{graceDays}, đã bỏ dòng cờ chưa triển khai), cards,
  plans, stats (chỉ > 0), enabledProviders, graceDays, brandName, implementedFeatures, viewer, isPreview, finalCta, seoTitle, seoDescription }`.
  `preview` chỉ có hiệu lực khi người xem là `SYSTEM_ADMIN` (kiểm ở server); khi xem nháp `viewer` ép `ANON`.
- `PricingViewer` = `{ kind: "ANON" }` · `{ kind: "NO_TENANT" }` · `{ kind: "TENANT", tenantSlug, currentPlanId, isFree, status,
  currentPeriodEnd, hasPendingInvoice }` — chỉ gian hàng người xem **sở hữu** (`Tenant.ownerId`).
- Trang `/pricing` (`?xem-truoc=nhap` → nháp cho admin, `robots: noindex`); `/admin/cms/pricing` (System Center).

Subpath `@gieochu/core/pricing-sections`: `PRICING_SECTION_TYPES` (9), `PRICING_SECTION_LABELS`, `PRICING_CTA_KEYS` (10),
`pricingSectionsSchema`, `parsePricingSections`, `resolvePricingSections`, `defaultPricingSections`, `resolvePricingPlanSlots`,
`validatePricingPlanRefs`, `computeCycleSavingsPercent`, `applyPricingTemplate(Deep)`, `stripUndefinedPricing` + kiểu.

### 21.2. Hạn mức / cờ tính năng — subpath mới

- `@gieochu/core/plan-limits`: `PLAN_LIMIT_UNLIMITED = -1`, `isUnlimitedPlanLimit`, `isWithinPlanLimit`, `PLAN_LIMIT_FIELDS`,
  `PLAN_LIMIT_FIELD_LABELS`, `describePlanLimit`, `formatPlanLimit`.
- `@gieochu/core/plan-features`: `PLAN_FEATURE_KEYS`, `PLAN_FEATURE_LABELS`, `IMPLEMENTED_PLAN_FEATURES` (hiện `[]`), `isPlanFeatureKey`,
  `isImplementedPlanFeature`, `canUsePlanFeature`.
- `isValidPlanInput` (`/admin/plans`): hạn mức là số nguyên ≥ 0 hoặc đúng `-1`. `createPlanAction`/`updatePlanAction`/`togglePlanActiveAction`
  thêm `revalidatePath("/pricing")`.
- Billing Studio `/studio/{slug}/billing?plan={planId}` — chọn sẵn gói trả phí đang bật trong form gia hạn; sai → gói hiện tại.

### 21.3. Hoàn tiền gói — Studio + System Center

| Action | Gác quyền | Trả | Mã lỗi |
| :-- | :-- | :-- | :-- |
| `requestSubscriptionRefundAction(tenantSlug, prev, formData)` (`studio/[tenantSlug]/billing/actions.ts`) — FormData `reason?`, `bankBin`, `accountNo`, `accountName` (không gửi id hoá đơn/số tiền) | `requireTenantMember(slug)` = **OWNER** | `RefundRequestActionState = { error?, success?, fieldErrors?: { bankBin?, accountNo?, accountName? } }` | Không đủ điều kiện → `{ error }` (thông điệp `REFUND_INELIGIBLE_MESSAGES`); `REFUND_LATER_PAYMENT_EXISTS` 409; `REFUND_UNAVAILABLE` 503 |
| `approveRefundAction(requestId, prev, formData)` (`admin/billing/refunds/actions.ts`) — `adminNote?` | `requireRole("SYSTEM_ADMIN")` | `RefundDecisionActionState` | `NOT_FOUND` 404, `REFUND_NOT_PENDING` 409, `REFUND_LATER_PAYMENT_EXISTS` 409, `FREE_PLAN_MISSING` 409, `SUBSCRIPTION_MISSING` 409, `INVOICE_NOT_PAID` 409 |
| `rejectRefundAction(requestId, prev, formData)` — lý do bắt buộc | `requireRole("SYSTEM_ADMIN")` | `RefundDecisionActionState` | `VALIDATION_ERROR` 400, `REFUND_NOT_PENDING` 409 |
| `revealRefundPayoutAction(requestId)` | `requireRole("SYSTEM_ADMIN")` | `RevealPayoutResult` (thông tin nhận tiền đầy đủ) | `REFUND_NOT_PENDING` 409 (đã xử lý → đã xoá), `PAYOUT_UNREADABLE` 500; audit `SUBSCRIPTION_REFUND_PAYOUT_VIEWED` |

Action admin revalidate `/admin/billing/refunds` + `/admin/billing/invoices`. Trang `/admin/billing/refunds?status=` (lọc trạng thái). Menu
System Center "Hoàn tiền gói" có badge số yêu cầu `REQUESTED` (`countPendingRefundRequests()` gọi ở `app/admin/layout.tsx`) ✅.
Lib `apps/web/lib/subscription-refund.ts`: `getTenantRefundState`, `requestSubscriptionRefund`, `countPendingRefundRequests()`,
`listRefundRequestsForAdmin({ status? })` (item có `payoutMasked { bankName, accountNoMasked }`, `approveBlocked`), `revealRefundPayout`,
`approveRefundRequest`, `rejectRefundRequest`, `isRefundSchemaMissing`, `formatRefundDate`. `downgradeToFree` (`lib/subscription-sweep.ts`)
nay được export và nhận cả transaction client.
Subpath `@gieochu/core/subscription-refund`: `SUBSCRIPTION_REFUND_WINDOW_DAYS = 7`, `SUBSCRIPTION_REFUND_STATUSES`/`_LABELS`,
`SUBSCRIPTION_REFUND_ERROR_CODES` (`REFUND_NOT_ELIGIBLE`, `REFUND_ALREADY_REQUESTED`, `REFUND_NOT_PENDING`, `REFUND_UNAVAILABLE`,
`REFUND_INVALID_PAYOUT`, `REFUND_LATER_PAYMENT_EXISTS`), `evaluateRefundEligibility`, `refundDeadline`, `parseRefundPayoutInput`,
`maskAccountNo`, `normalizeRefundText`, `REFUND_INELIGIBLE_MESSAGES`.

### 21.4. Hồ sơ / Bảo mật / đổi email — `app/account/**`

State chung `AccountActionState<T>` (`apps/web/lib/account-state.ts`) cho `useActionState`: `{ ok: true, message, ...T }` hoặc `{ ok: false,
code, formError?, fieldErrors?, values? }` (`values` để giữ nội dung đã gõ — không bao giờ chứa mật khẩu). Thay cho redirect + query cũ.

| Action | Gác quyền | Ghi chú |
| :-- | :-- | :-- |
| `updateProfileAction(prev, formData)` (`account/profile/actions.ts`) | `requireVerified()` | `fullName` 1–80 (bắt buộc), `phone?` (chuẩn hoá `0XXXXXXXXX`), `province?` (thuộc `VN_PROVINCES`; giữ giá trị cũ nhập tự do trước ADR-041); ký lại access token khi `pc` đổi; revalidate `/account` layout |
| `getAvatarUploadSignatureAction()` | `requireVerified()` | `CloudinarySignatureResult`; `public_id` server sinh `<root>/users/<userId>/avatar/<24 hex>`; png/jpg/jpeg/webp; 10 chữ ký/giờ/user; `CLOUDINARY_NOT_CONFIGURED` khi chưa cấu hình |
| `saveAvatarAction(publicId)` | `requireVerified()` | Kiểm `publicId` đúng thư mục của chính user, xác minh asset qua Admin API (≤ 2 MB); revalidate `/` layout. Ảnh cũ **không** bị xoá trên Cloudinary |
| `removeAvatarAction()` | `requireVerified()` | Đặt `avatarKey = null` |
| `changePasswordAction(prev, formData)` (`account/security/actions.ts`) | `requireVerified()` | Cần mật khẩu hiện tại; mới ≥ 8 ký tự gồm chữ + số, khác cũ; 5 lần sai/15 phút/user (không khoá đăng nhập); thu hồi mọi refresh token **trừ** `familyId` hiện tại; email `password_changed`; audit |
| `requestEmailChangeAction(prev, formData)` | `requireVerified()` | `newEmail` + `currentPassword`; `EMAIL_TAKEN` khi email thuộc tài khoản khác; 3 lần/giờ/user (gộp gửi lại); tạo token `EMAIL_CHANGE` (TTL = `emailVerifyTtlHours`), xoá yêu cầu cũ; email tới email mới + báo email cũ |
| `resendEmailChangeAction()` / `cancelEmailChangeAction()` | `requireVerified()` | Gửi lại (token mới, cũ vô hiệu) / huỷ (xoá token) |
| `logoutAllDevicesAction()` | `requireUser()` | Thu hồi mọi refresh token, xoá cookie `at` + `rt` (`Path=/api/auth`), redirect `/login`; không audit |
| `revokeSessionAction(formData)` (ADR-053) | `requireUser()` | Ô `sessionId` = `familyId`; `revokeAccountSession` lọc `userId` của người gọi (sai kiểu/rỗng/dài > 100 ký tự → ném `AppError` `VALIDATION_ERROR` 400, action không bắt; không khớp dòng nào → 404, action nuốt lỗi và chỉ làm mới danh sách); **trả `Promise<{ signedOut: boolean }>`** (không redirect ở server): thiết bị hiện tại → xoá cookie `at` + `rt` (`Path=/api/auth`), trả `{ signedOut: true }` — client (`_ui/session-cards.tsx`) **điều hướng cứng** `window.location.assign("/login")` (xoá client cache phiên cũ, ADR-053); thiết bị khác → `revalidatePath("/account/security")`, trả `{ signedOut: false }`; không audit. Loader `listAccountSessions(user): AccountSessionView[]` `{ id, deviceLabel, deviceKind, ip, startedAt, lastActiveAt, rememberMe, isCurrent }` (`lib/account-sessions.ts`) — `deviceKind: "desktop" \| "mobile" \| "tablet"` từ `describeDeviceKind(userAgent)` (`@gieochu/auth`, chỉ để chọn icon; UA trống → `desktop`) |
| `confirmEmailChangeAction(prev, formData)` (`account/email/xac-nhan/actions.ts`) | **Không cần đăng nhập** | 20 lần/15 phút/IP; một transaction: đánh dấu token đã dùng (`usedAt IS NULL` → chống bấm 2 lần), đổi `User.email` + `emailVerifiedAt`, thu hồi **mọi** refresh token, vô hiệu token `PASSWORD_RESET`/`EMAIL_VERIFY` chưa dùng; lỗi hết hạn/đã dùng/không hợp lệ, `EMAIL_TAKEN`, `ACCOUNT_LOCKED`, `RATE_LIMITED`; email `email_changed` tới email cũ; xoá cookie nếu trình duyệt đang đăng nhập đúng tài khoản |

Trang `/account/email/xac-nhan?token=…` — GET chỉ đọc (`previewEmailChangeToken` → `valid`/`expired`/`used`/`invalid`), xác nhận bằng nút
(POST), `noindex`. Loader: `getAccountOverview(user)` / `getCachedAccountOverview()` (C1), `getAccountHeaderData(userId)` (C7, `cache()`),
`findPendingEmailChange`, `avatarUrlFromKey`; `isSystemCloudinaryUploadEnabled()` (`lib/system-cloudinary.ts`, `cache()`) cấp cờ `avatarUploadEnabled`. Subpath `@gieochu/core/account-profile`: `PROFILE_FULL_NAME_MAX_LENGTH = 80`, `VN_PROVINCES`
(34), `isVnProvince`, `normalizeVnPhone`, `PROFILE_FIELD_MESSAGES`.

`@gieochu/email` thêm: `renderPasswordChangedEmail`, `renderEmailChangeVerifyEmail`, `renderEmailChangeRequestedEmail`,
`renderEmailChangedEmail`, `renderSubscriptionRefundEmail(stage: "REQUESTED" | "REFUNDED" | "REJECTED", data)`.

---

## 22. Dashboard Tổng quan gian hàng — loader + kỳ thống kê (ADR-043) ✅

Đối chiếu code 2026-10-18: ADR-043 + bổ sung lần 1–2 đã commit (`e5d63d0`), deploy ❓; **"Bổ sung ADR-043 lần 3"** (3 mốc "… trước", so sánh
trọn kỳ, `displayFrom/To`) nay **đã commit** `dd349b9` (deploy ❓) ✅ `git log`. "Bổ sung ADR-043 lần 4" (2026-10-23, chỉ lớp trình bày, contract không đổi) còn ở working tree, chưa commit. **Không có `route.ts`/Server Action mới** — trang `/studio/{tenantSlug}` (route
group `studio/[tenantSlug]/(tong-quan)/`) là Server Component gọi loader trực tiếp. Nghiệp vụ:
[[02-System-Specs/Studio-Dashboard-Specs|Studio-Dashboard-Specs]].

### 22.1. Subpath `@gieochu/core/dashboard-range` (cũng re-export ở `@gieochu/core`)

| Export | Ghi chú |
| :-- | :-- |
| `resolveDashboardRange(input?: DashboardRangeInput) → DashboardRange` | `input = { ky?, tu?, den?, now? }` — giá trị thô từ `searchParams` (`string \| string[] \| undefined`, lấy phần tử đầu). Hàm thuần, không ném; sai → `30-ngay` + `invalid: true` |
| `listDashboardBuckets(range) → DashboardBucket[]` | Trục đủ điểm cũ → mới; `DashboardBucket = { key, start: Date, label, future }` (`key` = giờ VN `YYYY-MM-DDTHH:MM`) |
| `DASHBOARD_PRESETS` (12, đúng thứ tự — cũng là thứ tự danh sách mốc của picker) | `hom-nay`, `hom-qua`, `tuan-nay`, `tuan-truoc`, `thang-nay`, `thang-truoc`, `quy-nay`, `quy-truoc`, `nam-nay`, `7-ngay`, `30-ngay`, `tuy-chon`. Ba key `tuan-truoc`/`thang-truoc`/`quy-truoc` thêm ở "Bổ sung ADR-043 lần 3" — key cũ giữ nguyên, URL cũ vẫn hợp lệ |
| `DEFAULT_DASHBOARD_PRESET` = `"30-ngay"`, `DASHBOARD_CUSTOM_MAX_DAYS` = `366`, `DASHBOARD_PRESET_LABELS` | Hằng |
| Kiểu `DashboardPreset`, `DashboardGranularity` (`hour`/`day`/`week`/`month`), `DashboardRangeInput`, `DashboardRange`, `DashboardBucket` | |

```ts
interface DashboardRange {
  key: DashboardPreset; label: string; prevLabel: string;     // "30 ngày qua" / "30 ngày trước đó"
  start: Date; end: Date;                                    // UTC, [start, end)
  prevStart: Date; prevEnd: Date;                            // UTC; cùng độ dài, không vượt start — TRỪ tuan-truoc/thang-truoc/quy-truoc: trọn kỳ trước (prevEnd = start)
  periodEnd: Date;                                           // cuối danh nghĩa của kỳ (dựng trục biểu đồ)
  granularity: DashboardGranularity;
  customFrom: string | null; customTo: string | null;        // YYYY-MM-DD khi tuy-chon hợp lệ
  displayFrom: string; displayTo: string;                    // (lần 3) YYYY-MM-DD giờ VN, ngày đầu / ngày cuối BAO GỒM; luôn có
  invalid: boolean;
}
```

Quy tắc kỳ + bảng 12 mốc: [[02-System-Specs/Studio-Dashboard-Specs|Studio-Dashboard-Specs]] §3. Ba mốc đã kết thúc có `end` cố định (`≤ now`),
không có bucket `future`. Với `thang-truoc`/`quy-truoc`, kỳ so sánh có thể dài hơn kỳ hiện tại (vd tháng 8 = 31 ngày > tháng 9 = 30 ngày) — JSDoc
`prevStart/prevEnd` đã ghi đúng điều này (Quốc sửa 2026-10-18 ✅ đọc code).

### 22.2. `apps/web/lib/tenant-dashboard.ts`

`getTenantDashboard({ tenantId, range, now? }) → Promise<TenantDashboard>` — **không tự kiểm quyền**: nơi gọi phải `requireTenantMember(slug)`
(OWNER; trang dùng `requireTenantMemberPage`) và truyền `tenant.id` từ guard. 3 truy vấn trong một `withTenant`; không cache. Vượt số nguyên an
toàn → `AppError INTERNAL_ERROR` (500).

```ts
interface DashboardCompared<T = number> { current: T; previous: T }
interface TenantDashboard {
  range: TenantDashboardRangeView;   // như DashboardRange nhưng thời điểm là chuỗi ISO UTC, không có periodEnd; CÓ displayFrom/displayTo (lần 3)
  generatedAt: string;               // ISO UTC — "Cập nhật lúc"
  sales: {
    grossRevenueVnd, netRevenueVnd, refundedVnd, refundedOrders, paidOrders,
    distinctProductsSold, freeClaims: DashboardCompared;
    avgOrderVnd: DashboardCompared<number | null>;
    pendingOrders: number;                                   // ảnh chụp
    refundRequests: { pending: number; overdue: number };    // ảnh chụp (ADR-039)
  };
  customers: { newCustomers, buyers, returningCustomers: DashboardCompared;
               returningCustomerRate: DashboardCompared<number | null> };   // 0–1
  reviews: { newReviews, hiddenInPeriod: DashboardCompared; avgRating: DashboardCompared<number | null>;
             distribution: [number, number, number, number, number];       // index 0 = 1 sao
             unanswered: number; hiddenTotal: number; moderationLocked: number };
  products: { published: number; draft: number; archived: number; moderationLocked: number;
              downloads: DashboardCompared;
              topSelling: Array<{ productId; title; orders; revenueVnd; soldAllTime }>;   // ≤ 5
              topRated: Array<{ productId; title; avgRating; reviewCount }> };          // ≤ 5, ≥ 3 đánh giá
  series: Array<{ key; start; label; future; grossRevenueVnd; netRevenueVnd; paidOrders }>;
  latestOrders: Array<{ id; code; customerFullName; unitPriceVnd; totalVnd }>;          // ≤ 10, KHÔNG email
}
```

Tiền là `number` nguyên VND (khác `admin-stats.ts` trả chuỗi BIGINT). Hằng export: `TOP_SELLING_LIMIT = 5`, `TOP_RATED_LIMIT = 5`,
`TOP_RATED_MIN_REVIEWS = 3`, `LATEST_ORDERS_LIMIT = 10`, `ANONYMOUS_CUSTOMER_LABEL = "Khách"`.

### 22.3. Trang

| Trang | Guard | Query string | Ghi chú |
| :-- | :-- | :-- | :-- |
| `/studio/{tenantSlug}` | `requireTenantMemberPage` (OWNER) | `ky` (§22.1), `tu`/`den` khi `ky=tuy-chon`, `chi-so` = `gop` (mặc định, mọi giá trị khác) \| `thuc-nhan` — `parseStudioChartMetric` (`_ui/dashboard-format.ts`) | `loading.tsx`/`error.tsx` riêng trong route group. Từ lần 3 `ky`/`tu`/`den` được date range picker (client) dựng bằng `dashboardHref` và giữ `chi-so`; contract query string **không đổi** ngoài 3 key mới. Bố cục: [[04-Operations-Runbooks/UI-Design-System|UI-Design-System]] §19 |

`apps/web/lib/order.ts` `getOrderDashboardStats` (thẻ "Doanh thu 30 ngày" cũ) — **đã xoá** trong đợt ADR-048 ✅ `git diff` + grep 2026-10-23.

---

## 23. Trang Đơn hàng Studio — loader, tham số URL, quy ước escape, ghi chú nội bộ (ADR-046, ADR-047) ✅

Đối chiếu code working tree 2026-10-18 (nay **đã commit** `dd349b9` (deploy ❓) ✅ `git log`). **Không có `route.ts` mới** — hai trang là Server Component gọi
loader trực tiếp; thao tác tiền dùng lại action cũ ở `studio/[tenantSlug]/orders/[orderId]/actions.ts` (`confirmOrderManuallyAction`,
`cancelOrderAction`, `markOrderRefundedAction`, `grantExtraDownloadsAction`, `revokeEntitlementAction` — không đổi). **ADR-047** thêm đúng 2 Server
Action ghi chú (§23.5). Nghiệp vụ: [[02-System-Specs/Studio-Orders-Specs|Studio-Orders-Specs]]. **Từ ADR-068 (2026-11-25):** `confirmOrderManuallyAction` và
`cancelOrderAction` **đã xoá**, thay bằng `changeOrderStatusAction` (§32.2); `OrderListItem`/`OrderDetailView` thêm `statusTargets` (§32.3).

### 23.1. `apps/web/lib/order.ts` — export mới

| Export | Ghi chú |
| :-- | :-- |
| `listOrdersPage(tenantId, sp: OrderListSearchParams) → Promise<OrderListPage>` | **Không tự kiểm quyền** — nơi gọi `requireTenantMember(slug)` (OWNER) và truyền `tenant.id` từ guard. Một `withTenant` + `tenantId` tường minh |
| `getOrderDetailView(tenantId, orderId, viewerId = null) → Promise<OrderDetailView>` | Tiền điều kiện như trên. Không thấy đơn → `AppError` 404 (`notFound`) — trang đổi thành `notFound()`. `viewerId` (ADR-047) = user đang xem, quyết định `notes[].canDelete` |
| `parseOrderListQuery(sp, now?) → OrderListQuery` | Parse phòng thủ, không ném (§23.2) |
| `buildOrderListSearch(query, patch?) → string` | Query string không có `?`; bỏ giá trị mặc định; đổi bộ lọc không truyền `page` → trang 1 |
| `normalizeOrderSearchQuery(value) → string \| null` | NFC, bỏ ký tự điều khiển, gộp khoảng trắng, cắt 100 |
| `orderAllowedActions({ status, expiresAt }, now?) → OrderRowAction[]` | `view` + `confirm`/`cancel`/`refund` theo luật cũ ([[02-System-Specs/Studio-Orders-Specs|Studio-Orders-Specs]] §2.4) |
| Hằng `ORDER_LIST_STATUSES` (6), `ORDER_LIST_SORTS` (4), `ORDER_LIST_DEFAULT_SORT = "moi-nhat"`, `ORDER_LIST_PAGE_SIZES = [10,20,50,100]`, `ORDER_LIST_DEFAULT_PAGE_SIZE = 20`, `ORDER_LIST_Q_MAX = 100` | |
| Kiểu `OrderListSort`, `OrderRowAction`, `OrderListQuery`, `OrderListItem`, `OrderStatusCounts`, `OrderListPage`, `OrderListSearchParams`, `OrderPaymentChannel`, `OrderDetailLine`, `OrderTimelineEvent`, `OrderDetailView` | Đọc chi tiết trong file |

```ts
type OrderRowAction = "confirm" | "cancel" | "refund" | "view";
interface OrderListPage {
  items: OrderListItem[];            // { id, code, createdAt, paidAt, status (hiệu lực), totalVnd, customer: { fullName | null, email },
                                     //   items: { productTitle }[], refundRequested, refundRequestedAt, refundOverdue, allowedActions }
  total: number; page: number; pageSize: number; pageCount: number;   // page đã kẹp; pageCount ≥ 1
  statusCounts: Record<OrderStatus | "ALL", number>;                  // áp mọi bộ lọc TRỪ trạng thái
  refundRequestCount: number; refundRequestOverdueCount: number;      // toàn gian hàng, không áp bộ lọc
  products: { id: string; title: string }[];                          // sản phẩm đã có trong ≥ 1 đơn
  customer: { userId: string; fullName: string | null; email: string } | null;   // ADR-048 — khách đang lọc (?khach=), đã kiểm thuộc gian hàng
  query: OrderListQuery;                                              // đã chuẩn hoá (productId/customerId đã kiểm thuộc gian hàng, page thực tế)
}
interface OrderDetailView {
  id; code; status /* hiệu lực */; createdAt; paidAt; expiresAt; subtotalVnd; discountVnd; totalVnd; couponCode; confirmNote;
  paymentChannel: { kind: "PROVIDER"; provider; providerTxnId; at } | { kind: "MANUAL"; provider | null } | { kind: "FREE" }
                | { kind: "UNKNOWN"; provider | null } | { kind: "UNPAID"; provider | null };
  customer: { fullName: string | null; email: string };               // KHÔNG SĐT/địa chỉ (ADR-041)
  lines: { id; productId; productTitle; unitPriceVnd /* đơn giá lúc mua */; discountVnd; couponCode | null; finalPriceVnd;
           entitlement: { id; downloadsUsed; downloadLimit /* 0 = không giới hạn */; revokedAt; remedyStatus;
                          remedyRequestedAt; remedyChosenAt; remedyResolvedAt } | null }[];
  transactions: { id; provider; providerTxnId; amountVnd; matchStatus: "MATCHED" | "UNMATCHED" | "MISMATCH_AMOUNT"; createdAt }[];  // không rawPayload
  customerHistory: { orders; spentVnd; refundedVnd; avgOrderVnd: number | null };                 // chỉ đơn > 0đ có paidAt
  refundRequested; refundRequestedAt; refundOverdue;
  timeline: { at: Date; kind: "created" | "payment_txn" | "paid" | "expired" | "canceled" | "audit" | "remedy_opened" | "email"
                          | "note" /* ADR-047 */;
              label: string; detail?: string; noteId?: string /* chỉ kind "note" */ }[];       // cũ → mới
  allowedActions: OrderRowAction[];
  notes: OrderNoteView[];            // ADR-047 — cũ → mới, tối đa 200; [] khi notesAvailable = false
  notesAvailable: boolean;           // false = bảng order_notes chưa có (code lên trước migration)
}
interface OrderNoteView {            // apps/web/lib/order-note.ts
  id: string; body: string; createdAt: Date;
  author: { name: string | null; email: string } | null;   // null = tài khoản tác giả đã xoá; UI hiện name ?? email
  canDelete: boolean;                                       // true khi viewerId là tác giả
}
```

Tiền là `number` nguyên VND.

### 23.2. Trang & tham số URL

| Trang | Guard | Query string |
| :-- | :-- | :-- |
| `/studio/{tenantSlug}/orders` | `requireTenantMemberPage` (OWNER) | `trang-thai` (alias `status`), `remedy=REFUND_REQUESTED`, `q`, `ky`/`tu`/`den` (như §22.1; không có `ky` = mọi thời gian; lọc `createdAt`), `san-pham`, `khach` (userId — ADR-048; bỏ nếu khách không có đơn nào tại gian hàng), `sap-xep` (`moi-nhat`\|`cu-nhat`\|`tong-giam`\|`tong-tang`), `trang`, `so-dong` (10/20/50/100). Bảng đầy đủ: [[02-System-Specs/Studio-Orders-Specs|Studio-Orders-Specs]] §2.1 |
| `/studio/{tenantSlug}/orders/{orderId}` | `requireTenantMemberPage` (OWNER) | `back` — query string của danh sách; `orderListBackHref` chỉ giữ 12 khoá đã biết (`q`, `trang-thai`, `status`, `remedy`, `san-pham`, `khach` (ADR-048), `ky`, `tu`, `den`, `sap-xep`, `trang`, `so-dong`), cắt chuỗi 1000 / giá trị 200 ký tự, luôn ghép vào đường dẫn danh sách cố định → không open redirect |

Link vào trang: dashboard Tổng quan → `?trang-thai=PENDING` (trước là `?status=` — alias vẫn nhận); email ADR-039 + dashboard → `?remedy=REFUND_REQUESTED`
(không đổi) ✅ grep.

### 23.3. Quy ước escape cho Prisma `contains` (mới)

- `escapeContainsValue(value)` — `apps/web/lib/prisma-contains.ts`: escape `\`, `%`, `_` bằng `\`. **Bắt buộc** cho mọi input người dùng đưa vào
  Prisma `contains`/`startsWith`/`endsWith` (Prisma không escape wildcard LIKE). Đang áp: `lib/home.ts` (3 chỗ), `app/admin/users/page.tsx` ✅ grep
  2026-10-18. (`lib/order.ts` từng dùng ở ADR-046; từ ADR-047 chuyển sang SQL thô — dòng dưới.)
- SQL thô: `escapeLikePattern` (`lib/shop.ts`) + `ESCAPE '\'` tường minh (có từ ADR-035). **ADR-047:** `listOrdersPage` tìm `q` **không dấu, không
  phân biệt hoa thường** bằng `public.gieochu_unaccent(lower(col)) LIKE '%' || public.gieochu_unaccent(lower($q)) || '%' ESCAPE '\'` trên `orders.code`,
  `users.email`, `user_profiles.fullName` (2 bảng sau qua `EXISTS`), tham số hoá; lọc + đếm + lấy id trang bằng `$queryRaw` trong **cùng một `withTenant`**,
  rồi Prisma nạp đúng các đơn của trang theo id (≤ 100) ✅ code. Trạng thái hiệu lực trong SQL: `effectiveStatusSql` (nội bộ).

### 23.4. Hàm cũ — đã xoá (ADR-047 mục 4) ✅

`listOrders`, `getOrderDetail`, `effectiveStatusWhere` **đã xoá** khỏi `lib/order.ts` (grep 2026-10-18: không còn trong `apps/`, `packages/`). Giữ
`OrderListFilters` + `parseOrderRemedyFilter`. Đợt ADR-048 xoá thêm `listTenantCustomers` (trang Khách hàng cũ, thay bằng `listCustomersPage` §24) và
`getOrderDashboardStats` (§22.3) ✅ `git diff` + grep 2026-10-23.

### 23.5. Ghi chú nội bộ đơn (ADR-047 mục 2) ✅

`apps/web/lib/order-note.ts` — mọi hàm chạy dưới `withTenant` (bảng L2 `order_notes`, xem [[Database-Schema-Reference]] §3.2/§7); nơi gọi đã
`requireTenantMember` (OWNER) và truyền `tenant.id` từ guard.

| Export | Hành vi |
| :-- | :-- |
| `listOrderNotes(tenantId, orderId, viewerId) → { available, notes: OrderNoteView[] }` | Cũ → mới, tối đa 200; transaction **riêng** (không gộp transaction đọc đơn). Bảng chưa có (P2021/42P01) → `{ available: false, notes: [] }` |
| `addOrderNote(tenantId, orderId, authorId, body: unknown) → { id }` | `body` NFC + trim, 1–1000 ký tự (sai → `VALIDATION_ERROR` 400); đơn không thuộc tenant → 404 `notFound`; audit `ORDER_NOTE_ADDED` sau commit |
| `deleteOrderNote(tenantId, orderId, noteId, actorId) → void` | `deleteMany` với `authorId = actorId` trong WHERE (không đọc-rồi-xoá); 0 dòng → đọc lại: không có / khác tenant / khác đơn → `ORDER_NOTE_NOT_FOUND` 404, có nhưng không phải tác giả → `ORDER_NOTE_FORBIDDEN` 403; audit `ORDER_NOTE_DELETED` |
| `isOrderNotesTableMissing(error)`, hằng `ORDER_NOTE_MAX_LENGTH = 1000` | Bản sao hằng phía UI: `ORDER_NOTE_MAX_LENGTH_UI` (`orders/_ui/order-format.ts`) |

Bảng chưa có khi thêm/xoá → `AppError` `ORDER_NOTES_UNAVAILABLE` **503**. Mã lỗi mới là chuỗi tại chỗ, **không** thêm vào `ErrorCodes`
(`packages/core/src/errors.ts`) ✅ grep.

**Server Action** (`studio/[tenantSlug]/orders/[orderId]/actions.ts`), cả hai `requireTenantMember(tenantSlug)` (OWNER) → bắt `AppError` trả
`{ error: message }` (không trả `code`), thành công `revalidatePath` trang chi tiết:

| Action | Tham số |
| :-- | :-- |
| `addOrderNoteAction(tenantSlug, orderId, prevState, formData)` | Trường form `body` |
| `deleteOrderNoteAction(tenantSlug, orderId, noteId)` | `orderId` từ URL phải khớp đơn của ghi chú |

Không có route/đường đọc nào cho khách, public hay System Admin (RLS không có nhánh customer/public/admin) ✅ đọc SQL.

---

## 24. Trang Khách hàng Studio — loader, tham số URL, ghi chú khách (ADR-048) ✅

Đối chiếu code working tree 2026-10-23 (nay **đã commit** `dd349b9` (deploy ❓) ✅ `git log`). **Không `route.ts` mới, không migration.** Trang
`/studio/{tenantSlug}/customers` là Server Component gọi loader trực tiếp. Nghiệp vụ: [[02-System-Specs/Studio-Customers-Specs|Studio-Customers-Specs]].

### 24.1. `apps/web/lib/customer-list.ts` (mới)

| Export | Ghi chú |
| :-- | :-- |
| `listCustomersPage(tenantId, sp: CustomerListSearchParams) → Promise<CustomerListPage>` | **Không tự kiểm quyền** — nơi gọi `requireTenantMember(slug)` (OWNER), truyền `tenant.id` từ guard. Một `withTenant`: 1 Prisma (dropdown tài liệu) + 2 `$queryRaw` tham số hoá dùng chung CTE |
| `parseCustomerListQuery(sp, now?) → CustomerListQuery` | Parse phòng thủ, không ném (§24.2) |
| `buildCustomerListSearch(query, patch?) → string` | Query string không `?`; bỏ mặc định (`nhom=tat-ca`, `theo=mua-dau`, `sap-xep=gan-nhat`, trang 1, 20 dòng); `theo` chỉ ghi khi có kỳ; `patch.range` dạng URL `{ ky, tu?, den? }` hoặc `null` |
| `updateCustomerNote(tenantId, userId, note: unknown, actorId = null) → Promise<{ note: string \| null }>` | NFC + trim, ≤ 500 (sai → `VALIDATION_ERROR` 400); rỗng → `null`; `userId` sai định dạng / không có dòng `tenant_customers` dưới `withTenant` → 404 `notFound`; audit `CUSTOMER_NOTE_UPDATED` sau commit khi nội dung đổi |
| Hằng `CUSTOMER_GROUPS` (6), `CUSTOMER_DATE_FIELDS` (2), `CUSTOMER_DEFAULT_DATE_FIELD = "mua-dau"`, `CUSTOMER_LIST_SORTS` (4), `CUSTOMER_LIST_DEFAULT_SORT = "gan-nhat"`, `CUSTOMER_LIST_PAGE_SIZES = [10,20,50,100]`, `CUSTOMER_LIST_DEFAULT_PAGE_SIZE = 20`, `NEW_CUSTOMER_DEFAULT_PRESET = "30-ngay"`; re-export `CUSTOMER_NOTE_MAX_LENGTH`, `INACTIVE_CUSTOMER_DAYS` | |

```ts
interface CustomerListPage {
  items: CustomerListItem[];      // { userId, fullName | null, email, paidOrders, freeClaims, spentVnd, refundedVnd,
                                  //   firstOrderAt, lastOrderAt, hasRefundRequest, inactive, note | null }   — số liệu luỹ kế
  total: number; page: number; pageSize: number; pageCount: number;   // page đã kẹp; pageCount ≥ 1
  stats: {                        // chỉ áp kỳ (ky + theo); không áp q / nhom / san-pham
    scope: { range: CustomerListRange | null; dateField: "mua-dau" | "mua-gan-nhat"; newCustomersRange: CustomerListRange };
    totalCustomers; newCustomers; returningCustomers; payingCustomers;
    returningCustomerRate: number | null;            // returning ÷ paying
    spentVnd; refundedVnd; avgSpentPerPayingCustomer: number | null; freeOnlyCustomers;
  };
  groupCounts: Record<CustomerGroup, number>;        // áp kỳ + q + san-pham, không áp nhom
  products: { id: string; title: string }[];         // tài liệu có trong ≥ 1 đơn đã thanh toán
  query: CustomerListQuery;                          // đã chuẩn hoá (productId đã kiểm, page thực tế)
}
```

Tiền là `number` nguyên VND; BIGINT vượt `Number.MAX_SAFE_INTEGER` → `AppError` `INTERNAL_ERROR` 500.

### 24.2. Trang & tham số URL

| Trang | Guard | Query string |
| :-- | :-- | :-- |
| `/studio/{tenantSlug}/customers` | `requireTenantMemberPage` (OWNER) | `q` (không dấu, ≤ 100), `nhom` (`tat-ca`\|`moi`\|`quay-lai`\|`mien-phi`\|`hoan-tien`\|`lau-chua-quay-lai`), `ky`/`tu`/`den` (như §22.1; không có `ky` = mọi thời gian), `theo` (`mua-dau`\|`mua-gan-nhat`), `san-pham`, `sap-xep` (`gan-nhat`\|`moi-nhat`\|`chi-tieu-giam`\|`so-don-giam`), `trang`, `so-dong`. Bảng đầy đủ: [[02-System-Specs/Studio-Customers-Specs|Studio-Customers-Specs]] §3 |

### 24.3. Server Action

`studio/[tenantSlug]/customers/actions.ts` — `saveCustomerNoteAction(tenantSlug, userId, prevState, formData) → { ok?: boolean; error?: string }`:
`requireTenantMember(tenantSlug)` (OWNER) → `updateCustomerNote(tenant.id, userId, formData.get("note"), user.userId)`; `AppError` → `{ error: message }`
(không trả `code`); thành công `revalidatePath("/studio/{slug}/customers")`. Trang bind `tenantSlug`, client bind `userId`. Trường form: `note`.

### 24.4. Subpath `@gieochu/core/customer-list` (mới)

`packages/core/src/customer/customer-list.ts` — file thuần cho Client Component: `CUSTOMER_NOTE_MAX_LENGTH = 500`, `INACTIVE_CUSTOMER_DAYS = 90`.
**Không** re-export ở barrel `@gieochu/core` ✅ grep `index.ts` — chỉ import qua subpath.

---

## 25. Nội bộ (`/api/internal`) — 1 route (ADR-045 Storage Gateway) ✅

Đối chiếu `apps/web/app/api/internal/storage/ticket/route.ts` + `docker/nginx/gieochu-storage-gateway.conf.example` working tree 2026-10-22
(nay đã commit `4ab5a3b` — deploy ❓). Định dạng vé: [[02-System-Specs/File-Storage-And-Downloads-Specs|File-Storage-And-Downloads-Specs]] §9; vận hành:
[[04-Operations-Runbooks/Storage-Gateway-VPS-Runbook|Storage-Gateway-VPS-Runbook]].

| Method | Endpoint | Truy cập | Mô tả |
| :-- | :-- | :-- | :-- |
| `GET` | `/api/internal/storage/ticket` | **Chỉ nginx gọi** qua subrequest `auth_request` của `location /_s/`. Không `requireUser` — vé mã hoá chính là credential (cùng mô hình bearer ngắn hạn với presigned URL). nginx chặn `location ^~ /api/internal/` từ ngoài → `404` (theo file mẫu) | Giải vé ở `X-Original-URI`, so method + `Content-Length`, trả đích nội bộ cho nginx `proxy_pass`. `dynamic = "force-dynamic"`. |

**Header vào** (nginx đặt): `X-Original-URI` = `$request_uri` (phần trước `?` phải bắt đầu `/_s/`, phần sau `/_s/` là vé), `X-Original-Method` =
`$request_method` (so khớp không phân biệt hoa thường với `method` trong vé), `X-Original-Length` = `$content_length` (chỉ kiểm khi vé `PUT` có
`maxBytes`: phải là chuỗi số, ≤ `maxBytes`). Subrequest luôn là `GET` (`proxy_method GET` ở `location = /_storage_auth`).

**Response:**

| HTTP | Thân / header | Khi nào |
| :-: | :-- | :-- |
| `204` | Không thân; `X-Storage-Target: <pathname+search của presigned URL nội bộ>`, `Cache-Control: no-store` | Vé hợp lệ, chưa hết hạn, đúng method, độ dài hợp lệ |
| `403` | `{ error: { code: "STORAGE_TICKET_REJECTED", message: "Không có quyền truy cập tệp.", requestId } }`, `Cache-Control: no-store` | Mọi lý do từ chối — `BAD_URI`, `INVALID_TICKET` (sai định dạng/tag/hết hạn), `METHOD_MISMATCH`, `LENGTH_MISSING`, `LENGTH_EXCEEDED`. Lý do chỉ ghi log (`logger.warn`, không log vé/target). Gộp một mã vì nginx `auth_request` chỉ hiểu 2xx / 401 / 403 |
| `404` | `{ error: { code: "NOT_FOUND", … } }` | `STORAGE_GATEWAY_PROVIDERS` rỗng (gateway tắt trên process này) |

Trình duyệt **không** thấy các response này trực tiếp: theo file mẫu, từ chối ở `auth_request` và lỗi upstream MinIO (400/403/404/405/5xx) đều được
`error_page` chuyển thành `404` văn bản "Không tìm thấy tệp hoặc liên kết đã hết hạn." 🟡 (suy từ cấu hình mẫu, chưa chạy thật ❓).

---

## 26. CMS menu, CMS trang chủ + SEO, văn bản pháp lý (ADR-050 đợt 1; ADR-054 đợt 2; nền nháp ADR-053 lần 3) ✅

Đối chiếu working tree 2026-10-23 (chưa commit). **Không thêm `route.ts`** — đếm lại: 23 dưới `/api`, 24 toàn app ✅; route có sẵn đổi contract:
`POST /api/auth/register` (§3.1). Nghiệp vụ: [[02-System-Specs/System-Cms-Menu-Home-Seo-Specs|System-Cms-Menu-Home-Seo-Specs]],
[[02-System-Specs/Legal-Documents-Specs|Legal-Documents-Specs]]; quyết định [[01-Architecture-Decisions/ADR-035-Menu-Home-Seo-Versioned-Terms|ADR-035 KB (≙ ADR-050)]].

### 26.1. Server Actions — menu (`app/admin/cms/menu/actions.ts`)

| Action | Guard | Input → Output |
| :-- | :-- | :-- |
| `saveMenuDraftAction(menu)` | `requireRole("SYSTEM_ADMIN")` | `menu: unknown` validate bằng `siteMenuSchema` → ghi `blocksDraft` (chưa có dòng → tạo `DRAFT`, `blocks` = `defaultSiteMenu()`, title "Menu header/footer") |
| `publishMenuAction(menu)` | như trên | validate → `blocks` = menu, `blocksDraft = NULL`, `status = PUBLISHED`; `revalidatePath("/", "layout")` |
| `restoreLiveMenuAction()` | như trên | xoá `blocksDraft`; chưa có dòng → không làm gì (không audit) |

Cả 3 trả `MenuEditorActionState { success?, error?, issues?: { path, message }[] }` (`path` chấm trong menu, tối đa 20); `AppError` `expose` → `{ error }`,
lỗi khác ném lại. Audit `MENU_CMS_UPDATED` `{ operation: "SAVE_DRAFT" | "PUBLISH" | "RESTORE_LIVE" }`, `targetType: "CmsPage"`, `targetId: "menu"`.

### 26.2. Loader menu (`apps/web/lib/site-menu.ts`) — contract render cho UI

| Export | Ghi chú |
| :-- | :-- |
| `getSiteMenu(): Promise<SiteMenuView>` | `cache()` theo request — dùng ở `SiteHeader` + `SiteFooter` |
| `getPublishedSiteMenu(): Promise<SiteMenu>` | `cache()`; PUBLISHED hoặc mặc định (CTA mặc định có chữ "miễn phí" chỉ khi có `Plan` `isActive && isFree`) |
| `resolveSiteMenu(menu, { brandName, slogan, year, effectiveLegalKeys })` | Thuần — dùng chung trang công khai và xem trước. **ADR-054:** thêm `effectiveLegalKeys: ReadonlySet<LegalDocumentKey>` — link loại `legal` tới văn bản chưa hiệu lực bị bỏ, cột footer rỗng bị ẩn; `getSiteMenu()` lấy tập này từ `getEffectiveLegalKeys()` (`lib/legal.ts`) |
| `currentDisplayYear(now?)` | Năm theo `DISPLAY_TIME_ZONE` |
| `getSiteMenuEditorData(): Promise<SiteMenuEditorData>` | `{ menu (nháp ?? live ?? mặc định), live, hasDraft, status: "NONE"\|"DRAFT"\|"PUBLISHED", updatedAt }` — caller gác SYSTEM_ADMIN |

```ts
interface SiteNavLinkView { id: string; label: string; href: string; newTab: boolean; external: boolean } // external = https:// hoặc mailto:
interface SiteNavItemView { id: string; label: string; href: string | null; newTab: boolean; external: boolean; children: SiteNavLinkView[] } // href null = mục nhóm
interface SiteFooterColumnView { id: string; title: string; links: SiteNavLinkView[] }
interface SiteMenuView {
  header: { items: SiteNavItemView[]; cta: SiteNavLinkView | null };   // cta null = ẩn
  footer: { description: string; columns: SiteFooterColumnView[]; copyright: string }; // đã thay {năm}/{brand}
}
```

Subpath client `@gieochu/core/site-menu`: `siteMenuSchema`, `navLinkSchema`, `navItemSchema`, `navCtaSchema`, `navFooterColumnSchema`, `parseSiteMenu`,
`defaultSiteMenu`, `resolveNavLinkHref`, `navTargetError`, `navPagePath`, `applyCopyrightTokens`, `NAV_*` (giới hạn, `NAV_LINK_KINDS`,
`NAV_LINK_KIND_LABELS`, `NAV_PAGE_PATHS`, `NAV_PAGE_LABELS`), `DEFAULT_HEADER_CTA_LABEL(_FREE)`, `MENU_CMS_SLUG`.
Subpath `@gieochu/core/cms-content-guard`: `isSafePublicHref`, `isSafeInternalPath`, `isSafeExternalUrl`, `isSafeEmailAddress`, `UNSAFE_HREF_MESSAGE`,
`SAFE_HREF_MAX_LENGTH`, `CONTENT_CLAIM_RULES`, `findContentClaimWarnings`, `normalizeForClaims`, `collectStrings`.

### 26.3. Server Actions + loader — trang chủ (`app/admin/cms/home-editor/actions.ts`, `apps/web/lib/home-cms.ts`)

| Action / hàm | Input → Output |
| :-- | :-- |
| `saveHomeDraftAction(sections, seo)` | **Đổi chữ ký** (HEAD: `(pageId, sections)` theo id dòng; nay theo slug `home` bằng `upsert`, bỏ `pageId`, thêm `seo`) — `seo = { seoTitle, seoDescription }` qua `cmsSeoSchema`; sections qua `homeSectionsSchema` → ghi `blocksDraft` + 2 cột SEO (rỗng → `null`); chưa có dòng → tạo `DRAFT`, `blocks` = `defaultHomeSections()` |
| `publishHomeAction(sections, seo)` | (HEAD: `(pageId, sections)`) Như trên + `homePublishIssues` (chặn) → `blocks`, `blocksDraft = NULL`, `PUBLISHED`, 2 cột SEO |
| `restoreLiveHomeAction()` | (HEAD: `(pageId)`) Xoá `blocksDraft`; chưa có dòng → không làm gì |
| `searchHomeTenantOptionsAction`, `searchHomeProductOptionsAction` | Không đổi (§14.1) |
| `getHomePageContent(): Promise<HomePageContent>` | `{ sections, isDefault, seoTitle, seoDescription }` — chỉ PUBLISHED; SEO `null` khi chưa PUBLISHED hoặc rỗng. `cache()` — dùng cả ở page lẫn `generateMetadata` |
| `getHomeCmsEditorData(): Promise<HomeCmsEditorData>` | `{ sections (nháp ?? live, đã `withMissingHomeSections`), live, hasDraft, status, seoTitle, seoDescription, pinOptions }` — thay phần nạp dữ liệu inline cũ ở `app/admin/cms/[slug]/page.tsx` |

Mọi action `requireRole("SYSTEM_ADMIN")`, trả `HomeEditorActionState { error?, success?, issues?: HomePublishIssue[] }` (`{ sectionId, field, message }`), audit
`HOME_CMS_UPDATED` `{ operation }`. Subpath `@gieochu/core/home-sections` thêm: `defaultHomeSections`, `withMissingHomeSections`, `replaceBrandToken`,
`resolveCommunityView`, `homePublishIssues`, `DEFAULT_HOME_SEO`, `HOME_SECTION_TYPES`, `HOME_COMMUNITY_MODES(_LABELS)`, `HOME_MIN_TO_SHOW_DEFAULT`, các
hằng `HOME_*_MAX`; kiểu `HomeCta`, `HomeCommunityView`, `HomePublishIssue`, `HomeSectionData`. Subpath `@gieochu/core/seo`: `cmsSeoSchema`,
`SEO_TITLE_MAX` (120), `SEO_DESCRIPTION_MAX` (320), `SEO_TITLE_RECOMMENDED_MAX` (60), `SEO_DESCRIPTION_RECOMMENDED_MAX` (160), `seoLengthWarning`.

### 26.4. Server Actions + hàm lib — văn bản pháp lý (`app/admin/cms/phap-ly/actions.ts`, `apps/web/lib/legal.ts`)

| Action | Input → Output | Audit |
| :-- | :-- | :-- |
| `saveLegalDraftAction(key, contentHtml, expectedUpdatedAt)` (Bổ sung ADR-057) | Sửa **bản nháp làm việc** (DRAFT mới nhất có nội dung — `pickWorkingLegalDraft`), chưa có thì tạo DRAFT mới; đổi nội dung → review về PENDING; chưa có nháp và nội dung trùng bản PUBLISHED mới nhất → `{ success, unchanged: true }` | `LEGAL_VERSION_UPDATED` / `LEGAL_VERSION_CREATED` |
| `setLegalReviewAction(key, approved: boolean, expectedUpdatedAt)` | Tích/bỏ "Đã rà soát nội dung" trên bản nháp làm việc; chưa có nháp → `LEGAL_VERSION_NOT_DRAFT` 409 | `LEGAL_REVIEW_STATUS_CHANGED` (+`reviewStatus`) |
| `publishLegalAction(key, { effectiveAtLocal, asDraftRelease }, expectedUpdatedAt)` | `datetime-local` giờ VN, trống = ngay; bản chính thức qua cổng ADR-050; `asDraftRelease: true` (ADR-057 mục 3) bỏ qua cổng placeholder + rà soát, lưu `isDraftRelease` | `LEGAL_VERSION_PUBLISHED` (+`effectiveAt` ISO, `isDraftRelease`) |

> Bổ sung ADR-057 (2026-10-25, working tree chưa commit ✅ đọc code): **đã bỏ** `createLegalDraftAction`, `updateLegalDraftAction`, `setLegalReviewStatusAction`,
> `publishLegalVersionAction`, `archiveLegalVersionAction` — client không còn chọn `versionId`. `expectedUpdatedAt` = `updatedAt` (ISO) của bản nháp editor đã nạp,
> `null` khi chưa có nháp; lệch → `LEGAL_VERSION_CONFLICT` 409. `LegalActionState` thêm `code?`, `reviewStatus?`, `updatedAt?`, `unchanged?`. Hàm lib mới:
> `getLegalEditorData`, `saveLegalWorkingDraft`, `setLegalWorkingDraftReview`, `publishLegalWorkingDraft`, `getLegalVersionForPreview`, `getAcceptanceLegalVersion`
> (bản dự thảo → `null`, không ghi chấp thuận). `archiveLegalVersion` còn trong lib nhưng không có action gọi. Quyết định:
> [[01-Architecture-Decisions/ADR-042-Legal-Drafts-Import-Preview-Draft-Release|ADR-042 KB (≙ ADR-057)]].

| `saveLegalDocumentMetaAction(key, input)` (ADR-054) | `input = { summary, seoTitle, seoDescription }` (chuỗi; `cmsSeoSchema` 120/320 + `summary` ≤ 320; rỗng → `null`); lưu thẳng, không nháp; revalidate `/admin/cms/phap-ly` + `/{slug}` | `LEGAL_DOCUMENT_META_UPDATED` (`targetType: "LegalDocument"`, `targetId` = khoá, metadata `{ key, hasSummary, hasSeoTitle, hasSeoDescription }`) |

Mọi action `requireRole("SYSTEM_ADMIN")`; `key` phải là khoá trong `LEGAL_DOCUMENT_DEFS` (đợt 1 chỉ `"terms"`; từ ADR-054 7 khoá), `versionId` chuỗi 1–64; trả `LegalActionState
{ success?, error?, versionId? }`. 3 action bản nháp làm việc (trước Bổ sung ADR-057: 5 action phiên bản) revalidate `/admin/cms/phap-ly`, `/{slug}`, `/register`, `/studio` và `revalidatePath("/", "layout")` (ADR-054). Audit scope `SYSTEM`, `targetType: "LegalDocumentVersion"`, metadata `{ key, version, … }` — không nội dung. Mã lỗi:
[[02-System-Specs/Legal-Documents-Specs|Legal-Documents-Specs]] §9.

Hàm lib (`lib/legal.ts`, không tự kiểm quyền): `sanitizeLegalHtml`, `ensureLegalDocument`, `listLegalVersions(key)`, `getEffectiveLegalVersion(key, now?)` →
`EffectiveLegalVersion | null`, `createLegalDraft`, `updateLegalDraft`, `setLegalReviewStatus`, `publishLegalVersion`, `archiveLegalVersion`,
`resolveRegistrationTermsVersion(effective, submittedId)`, `recordLegalAcceptance(tx, userId, versionId, acceptedAt)`. **ADR-054 thêm:** `getLegalDocumentMeta(key)`
→ `LegalDocumentMeta | null` (`{ title, summary, seoTitle, seoDescription }`), `updateLegalDocumentMeta(spec, input)`, `listLegalDocumentStatuses(now?)` →
`Map<LegalDocumentKey, { status: "NONE" | "DRAFT_ONLY" | "EFFECTIVE" | "SCHEDULED"; hasDraft }>`, `getEffectiveLegalKeys()` (`cache()`), `resolveAcceptedLegalVersion`,
`resolveRegistrationPrivacyVersion`, `resolveSellerPolicyAcceptance(effective, { accepted, submittedVersionId })`, `recordLegalAcceptances(tx, userId, versionIds,
acceptedAt)` (trả số dòng mới). Subpath `@gieochu/core/legal`
(hằng + luật thuần: `LEGAL_DOCUMENT_DEFS`, `LEGAL_DOCUMENT_KEYS`, `LEGAL_DOCUMENT_ROOT_SLUGS`, `LEGAL_LEGACY_BASE_PATH`, `LEGAL_SUMMARY_MAX`, `legalDocumentPath` (từ ADR-054 trả `/{slug}`), `legalKeyFromSlug`, `LEGAL_PLACEHOLDER_MARKER`, `legalPublishBlockers`,
`pickEffectiveLegalVersion`, `parseVnDateTimeLocal`, `legalVersionLabel`, `LEGAL_ERROR_CODES`…); `@gieochu/core/brand-token`
(`escapeHtmlText`, `replaceBrandTokenInHtml`).

Trang mới: `/admin/cms/menu`, `/admin/cms/phap-ly` (System Center — từ ADR-054 chọn văn bản bằng `?van-ban=<khoá>`), `/phap-ly/[slug]` (công khai — 404 khi chưa có bản hiệu lực; **từ ADR-054 thay bằng 7 URL cấp gốc**, đường cũ redirect 308 — §5.2).
`sanitizeRichTextHtml` (`@gieochu/core/content/sanitize-html`) thêm tuỳ chọn `trustedLinks?: { siteOrigin: string | null }` (chỉ cho văn bản pháp lý) và export
`classifyRichTextLink(href, siteOrigin)` → `"internal" | "external" | "mailto"` — luật ở [[02-System-Specs/Legal-Documents-Specs|Legal-Documents-Specs]] §3.5.

### 26.5. Server Action — mở gian hàng có đồng ý Chính sách người bán (ADR-054 mục 5) ✅ đọc `git diff` 2026-10-24

`createTenantAction` (`app/studio/actions.ts`) — form `StudioOnboardingForm` thêm 2 ô: `sellerPolicyAccepted` (checkbox, `"on"` → `true`) và
`sellerPolicyVersionId` (hidden, trim 1–64; schema vẫn tuỳ chọn nhưng **bắt buộc trên thực tế** khi có bản chính thức — bổ sung ADR-057). Hai ô chỉ hiện khi `seller`
có bản **chính thức** (`app/studio/page.tsx` dùng `getAcceptanceLegalVersion` — bản dự thảo → ẩn ô, truyền `sellerPolicy = { versionId, href: "/chinh-sach-nguoi-ban",
title } | null`). Server **tự** đọc `getAcceptanceLegalVersion("seller")` rồi `resolveSellerPolicyAcceptance`:
- chưa có bản chính thức / đang là bản dự thảo → bỏ qua; có bản mà không tích → `AppError` 400 **`LEGAL_ACCEPTANCE_REQUIRED`**; id gửi lên khác bản hiệu lực
  **hoặc không gửi id** → 409 **`LEGAL_DOCUMENT_CHANGED`** (bổ sung ADR-057 ✅ đọc code 2026-10-25);
  action trả `{ error: message }` như các lỗi `AppError` khác.
- `createTenantForUser(user, { name, slug, bio, acceptedLegalVersionIds })` (`lib/create-tenant.ts`, tham số mới tuỳ chọn) ghi `user_legal_acceptances`
  trong **cùng transaction** tạo tenant (L1, không RLS; lỗi → rollback cả tenant).

### 26.6. Lib nền nháp tự động editor (ADR-053 bổ sung lần 3) ✅ đọc code 2026-10-24 — chưa có Server Action

| Export | Nơi | Ghi chú |
| :-- | :-- | :-- |
| `getDraft(scope, userId, ref)`, `saveDraft(scope, userId, input)`, `discardDraft(scope, userId, ref)`, `purgeStaleDrafts(now?)` | `apps/web/lib/editor-draft.ts` | `scope = { kind: "TENANT", tenantId } \| { kind: "SYSTEM" }`; `ref = { entityType, entityKey }`; `saveDraft` nhận `{ payload, clientId, expectedRevision, baseUpdatedAt?, overwrite? }` → `{ revision, updatedAt }`. **Không tự kiểm quyền người gọi** — Server Action tương lai phải `requireTenantMember`/`requireRole("SYSTEM_ADMIN")` mỗi lần |
| `useServerAutosave(options)` | `apps/web/lib/use-server-autosave.ts` (client) | `save(args) → { ok: true, revision, updatedAt } \| { ok: false, code, message? }`; nghe `gieochu:session-expiring` |
| Hằng, kiểu, `parseEditorDraftPayload`, `isValidEditorDraftKey`, `EDITOR_DRAFT_ERROR_CODES` | subpath `@gieochu/core/editor-draft` | Client import được |

Mã lỗi `DRAFT_TOO_LARGE` (413), `DRAFT_INVALID` (400), `DRAFT_CONFLICT` (409) + `RATE_LIMITED`, `FORBIDDEN`, `NOT_FOUND`. Nghiệp vụ:
[[02-System-Specs/Editor-Autosave-Drafts-Specs|Editor-Autosave-Drafts-Specs]].

---

## 27. System Center hoá đơn/Đơn hàng gói, khối chuyển khoản, mã giảm giá tạo lại QR (ADR-056) ✅

Đối chiếu working tree 2026-10-25 (chưa commit ✅ `git status`). **Không thêm `route.ts`** — đếm lại: 23 dưới `/api`, 25 toàn app ✅; **không migration**. Hai trang
admin là Server Component gọi lib trực tiếp (guard `requireAdminAccess`). Nghiệp vụ: [[02-System-Specs/Payment-And-Billing|Payment-And-Billing]] §5C–§5E,
[[02-System-Specs/Order-State-Machine|Order-State-Machine]] §3.9; quyết định
[[01-Architecture-Decisions/ADR-041-System-Center-Subscription-Invoices-Bank-Transfer-Qr|ADR-041 KB (≙ ADR-056)]].

### 27.1. Trang & tham số URL

| Trang | Guard | Query string |
| :-- | :-- | :-- |
| `/admin/billing/invoices` | `requireAdminAccess` (SYSTEM_ADMIN, khác → 404) | `tab` = `cho-doi-soat` (mặc định, giá trị lạ cũng về đây) \| `tat-ca`. Chỉ tab `tat-ca`: `status` (`PENDING`\|`PAID`\|`EXPIRED`\|`VOID`\|`REFUNDED`), `provider` (`MANUAL_QR`\|`SEPAY`\|`MOMO`), `page`, `pageSize` (10/20/50/100, mặc định 20). Giá trị lạ → bỏ lọc |
| `/admin/subscriptions` | `requireAdminAccess` | `plan` (mã gói có trong `listPlanFilterOptions`, khác → bỏ lọc), `status` (`TRIALING`\|`ACTIVE`\|`PAST_DUE`\|`GRACE`\|`EXPIRED`\|`CANCELED`), `page`, `pageSize` |

Form lọc là `<form method="get">` (`FilterBar`) — gửi lại bỏ `page` (về trang 1), giữ `tab`/`pageSize` bằng input ẩn.

### 27.2. Export mới của `apps/web/lib/subscription-billing.ts` (chỉ đọc bảng L1, §7.9)

| Export | Ghi chú |
| :-- | :-- |
| `ADMIN_INVOICE_STATUSES`, `ADMIN_INVOICE_PROVIDERS`, `ADMIN_SUBSCRIPTION_STATUSES` + kiểu `AdminInvoiceStatus`/`AdminInvoiceProvider`/`AdminSubscriptionStatus` | Mảng `as const` khớp enum DB (`satisfies`) |
| `parseEnumParam(allowed, value) → T \| undefined` | Không ném lỗi |
| `listSubscriptionInvoices({ status?, provider?, page, pageSize }) → { items, total, page, pageSize }` | `page ≥ 1`, `pageSize` kẹp 1–100 (mặc định 20); `createdAt desc, id desc`; item `{ id, code, provider, status, amountVnd, createdAt, paidAt, dueAt, tenant { id, name, slug }, plan { code, name } }` |
| `listSubscriptions({ planCode?, status?, page, pageSize? }) → { items, total, page, pageSize }` | Sắp `plan.isFree asc, currentPeriodEnd asc, id asc`; item `{ id, status, currentPeriodStart, currentPeriodEnd, graceEndsAt, plan { code, name, isFree }, tenant { id, name, slug }, latestInvoice { code, status } \| null }` — **từ ADR-066:** `latestInvoice { id, code, status, amountVnd, provider } \| null` (§31.3) |
| `listPlanFilterOptions() → { code, name }[]` | Mọi gói (kể cả ngừng bán), `priceVnd asc, code asc` |

### 27.3. Hàm lib khác đổi/thêm

| Hàm | Thay đổi |
| :-- | :-- |
| `savePlatformProviderConfig(input)` (`lib/platform-payment.ts`) | Trả `{ isEnabled, autoDisabled }` (trước `void`). 3 action `save*Action` (`app/admin/billing/payment/actions.ts`) trả thêm `PlatformPaymentActionState.message` khi `autoDisabled` |
| `getPlatformPaymentConfigRow(provider)` (`lib/platform-payment.ts`, mới) | Điểm đọc duy nhất dòng `platform_payment_configs` cho `createRenewalInvoice` và `POST /api/webhooks/platform/[provider]` (response webhook không đổi) |
| `getBankByBin(bin)` (`lib/tenant-payment.ts`, mới) | `{ shortName, name } \| null` từ bảng L1 `bank_bins`; BIN rỗng → `null` |
| `initiateOrderCheckout`, `applyCouponToOrder`, `removeCouponFromOrder` (`lib/order.ts`) | Mã lỗi mới **`ORDER_CHANGED` 409** (ghi có điều kiện thất bại — đơn vừa đổi tổng/cổng), **`CHECKOUT_CREATE_FAILED` 502** (cổng không tạo được checkout). Áp/gỡ mã khi đơn đã có `checkoutPayload` → tạo lại payload theo tổng mới. `ORDER_NOT_PENDING` 409 như cũ |

### 27.4. Server Action checkout (`app/[tenantSlug]/checkout/[orderCode]/actions.ts`)

| Action | Chữ ký | Ghi chú |
| :-- | :-- | :-- |
| `applyCouponAction` | `(tenantSlug, orderCode, prevState, formData) → CheckoutActionState` | Không đổi chữ ký; lỗi mới đi qua `{ error: message }` |
| `removeCouponAction` | `(tenantSlug, orderCode, prevState, formData) → CheckoutActionState` | **Đổi** từ `(tenantSlug, orderCode) → void`: nay bắt `AppError` → `{ error: message }` (`ORDER_CHANGED`, `CHECKOUT_CREATE_FAILED`, `PROVIDER_NOT_AVAILABLE`, `ORDER_NOT_PENDING`) ✅ đọc code |
| `selectProviderAction` | không đổi | Có thể nhận thêm `ORDER_CHANGED`/`CHECKOUT_CREATE_FAILED` |

`CheckoutActionState = { error?: string }` (không trả `code`).

---

## 28. Chạy thử beta — email báo xác nhận tay, xác nhận trễ hoá đơn gói, giao dịch cổng, tiền tố SePay (ADR-059 B1/B2/B2b) ✅

Đối chiếu code 2026-10-26 — **đã commit `fa29d99`** ✅ `git log` 2026-10-27. **Không thêm `route.ts`** (23 dưới `/api`, 25 toàn app ✅), **không migration**. Nghiệp vụ:
[[02-System-Specs/Payment-And-Billing|Payment-And-Billing]] §5F–§5I, [[02-System-Specs/Order-State-Machine|Order-State-Machine]] §3.10–§3.11; quyết định
[[01-Architecture-Decisions/ADR-044-Beta-Payments-Manual-Confirm-Emails-Sepay|ADR-044 KB (≙ ADR-059)]]; runbook [[04-Operations-Runbooks/SePay-Live-Test-Runbook|SePay-Live-Test-Runbook]].

### 28.1. Trang & tham số URL

| Trang | Guard | Ghi chú |
| :-- | :-- | :-- |
| `/admin/billing/invoices?tab=giao-dich` (tab mới **"Giao dịch cổng"**) | `requireAdminAccess` | `loai` = `chua-khop` \| `khop-chua-ap` \| `da-ap` (lạ → bỏ lọc), `page`, `pageSize`. `tab` lạ vẫn về `cho-doi-soat`. Tab "Tất cả": dòng MANUAL_QR + EXPIRED có nút **"Xác nhận trễ…"** |
| `/studio/{slug}/orders/giao-dich` **"Giao dịch cần xử lý"** (mới) | `requireTenantMemberPage` (OWNER) | `page`, `pageSize` (`parsePagination`). Chỉ đọc, L2 qua `withTenant` |
| `/studio/{slug}/orders` | như cũ | Thêm dòng cảnh báo + link khi có giao dịch cần xử lý |

### 28.2. Server Action

| Action | Chữ ký | Ghi chú |
| :-- | :-- | :-- |
| `confirmManualInvoiceAction` (`app/admin/billing/invoices/actions.ts`) | không đổi | Nay nhận cả hoá đơn EXPIRED (nhánh trễ); lỗi mới `NEWER_INVOICE_EXISTS`, `INVOICE_NOT_CONFIRMABLE` qua `{ error }`. **Từ ADR-066 đổi chữ ký** — §31.3 |
| `confirmInvoiceFromTransactionAction` (mới, cùng file) | `(transactionId, prevState, formData) → { error?, success? }` | `requireRole("SYSTEM_ADMIN")`; form gửi `invoiceCode`; mọi kiểm tra ở server dưới khoá |
| `selectProviderAction` (checkout) | không đổi | Truyền `after` cho email `order_pending_manual` |
| `renewSubscriptionAction` (`studio/[tenantSlug]/billing/actions.ts`) | không đổi | Truyền `after` cho email `invoice_pending_manual` |
| Lưu SePay platform (`app/admin/billing/payment/actions.ts`) | không đổi | `message` luôn kèm câu nhắc/cảnh báo tiền tố |
| Lưu SePay Studio (`studio/[tenantSlug]/settings/payments/actions.ts`) | state thêm `warning?: string` | Có `warning` khi `paymentPrefix` khác `orderCodePrefix` (vẫn `success: true`). **Từ ADR-065: bỏ `warning`, thay bằng `message?: string`** (§31.2) |

### 28.3. Hàm lib / package — export mới hoặc đổi chữ ký

| Export | Nơi | Ghi chú |
| :-- | :-- | :-- |
| `createRenewalInvoice(tenantId, input, options?)` | `lib/subscription-billing.ts` | `options.scheduleNotification?: ScheduleAfterResponse` |
| `notifyAdminOfPendingManualInvoice(invoiceId)` | như trên | Không ném |
| `confirmInvoiceFromPlatformTransaction(transactionId, invoiceCode, actorId?)` | như trên | §5H Payment-And-Billing |
| `DEFAULT_INVOICE_CODE_PREFIX` (`"SUB"`), `normalizeInvoiceCodePrefix(value) → string \| null`, `sepayInvoiceReferenceCandidates(payload, prefix) → string[]` | như trên | |
| `initiateOrderCheckout(tenantId, orderId, customerId, provider, options?)`, `notifyOwnerOfPendingManualOrder(tenantId, orderId)` | `lib/order.ts` | |
| `listPlatformTransactions({ filter?, page, pageSize })`, `PLATFORM_TXN_FILTERS`, kiểu `PlatformTxnState`/`PlatformTxnRow` | `lib/platform-transactions.ts` (mới) | Chỉ bảng L1 |
| `listTenantTransactionsNeedingAction(tenantId, page, pageSize?)`, `countTenantTransactionsNeedingAction(tenantId)`, `TENANT_TXN_PAGE_SIZE` (20) | `lib/tenant-payment-transactions.ts` (mới) | `withTenant` |
| `getSupportEmail() → string \| null` | `lib/system-settings.ts` | Không cache |
| `ScheduleAfterResponse` (kiểu) | `lib/email-dispatch.ts` | `(task) => void` |
| `manualConfirmDeadline`, `INVOICE_CODE_SUFFIX_LENGTH` (8), `ORDER_CODE_SUFFIX_LENGTH` (6) | `@gieochu/core` | |
| `extractSepayReferences(body, prefixes, { codeLength? })`, kiểu `SepayReferenceOptions`/`SepayWebhookBody`, `isManualConfirmProvider(id)` | `@gieochu/payments` | `extractSepayReference` nhận thêm `options` |
| `renderOrderAwaitingManualConfirmEmail`, `renderInvoiceAwaitingReconciliationEmail`, `renderPaymentAmountMismatchEmail` | `@gieochu/email` | Template `manual-payment-pending.ts` |

### 28.4. Mã lỗi mới (`AppError`)

| Mã | HTTP | Khi nào |
| :-- | :-: | :-- |
| `INVOICE_NOT_CONFIRMABLE` | 409 | Hoá đơn không ở trạng thái xác nhận được (VOID/REFUNDED khi xác nhận tay; không phải PENDING/EXPIRED khi xác nhận từ giao dịch) |
| `NEWER_INVOICE_EXISTS` | 409 | Xác nhận trễ khi gian hàng đã có hoá đơn tạo sau đang PENDING/PAID |
| `INVOICE_CODE_REQUIRED` | 400 | Xác nhận từ giao dịch mà không nhập mã hoá đơn |
| `INVOICE_NOT_FOUND` | 404 | Mã hoá đơn không tồn tại |
| `TRANSACTION_NOT_FOUND` | 404 | Giao dịch không tồn tại |
| `TRANSACTION_NOT_USABLE` | 400 | Không phải giao dịch SePay tiền vào |
| `TRANSACTION_ALREADY_USED` | 409 | Giao dịch đã gắn hoá đơn khác |
| `INVOICE_ALREADY_PAID` | 409 | Hoá đơn đã PAID/REFUNDED |
| `TRANSACTION_UNDERPAID` | 409 | Giao dịch thiếu tiền so với hoá đơn |

Server Action chỉ trả `message` (không trả `code`).

### 28.5. MoMo cá nhân `MOMO_MANUAL` (ADR-059 bổ sung lần 3) ✅ đọc code 2026-10-26 (đã commit `fa29d99`, migration đã áp)

Không thêm `route.ts`. Webhook `/api/webhooks/platform/momo_manual` và `/api/webhooks/tenants/{tenantId}/momo_manual` → **404 `unsupported_provider`**.

| Thay đổi | Nơi | Ghi chú |
| :-- | :-- | :-- |
| `CheckoutResult` thêm `CheckoutWalletResult` `{ kind: "WALLET", wallet: "MOMO", phone, accountName, content, amountVnd, qr: { qrPayload, qrImageDataUrl, bin, accountNo } \| null }` — từ Bổ sung ADR-059 lần 4 provider luôn trả `qr: null`; trường giữ cho payload cũ | `packages/payments/src/types.ts` | Lưu ở `checkoutPayload` của đơn/hoá đơn |
| `momoManualProvider` (`createCheckout` luôn `qr: null` — Bổ sung ADR-059 lần 4), ~~`MOMO_VIETQR_BIN`~~ (đã bỏ ở lần 4), `normalizeVnMobilePhone`, `normalizeAccountHolderName`, `normalizeMomoManualConfig` | `packages/payments/src/providers/momo-manual.ts` | Không secret |
| `MANUAL_CONFIRM_PROVIDERS = ["MANUAL_QR", "MOMO_MANUAL"]`, `isManualConfirmProvider` | `packages/payments/src/registry.ts` | |
| `readMomoManualForm(formData) → { ok: true, config: { phone, accountName } } \| { ok: false, error }` (lần 4: bỏ `vietQrAccountNo`) | `apps/web/lib/momo-manual-config.ts` | Dùng chung Studio + System Center |
| `isMissingEnumValueError`, `MOMO_MANUAL_NOT_READY_MESSAGE` | `apps/web/lib/db-errors.ts` | Bắt lỗi 22P02 khi DB chưa áp migration |
| Server Action lưu MoMo cá nhân | `app/admin/billing/payment/actions.ts`, `app/studio/[tenantSlug]/settings/payments/actions.ts` | Lỗi DB chưa sẵn sàng → `{ error: MOMO_MANUAL_NOT_READY_MESSAGE }` |
| `VALID_PROVIDERS` thêm `MOMO_MANUAL` | `selectProviderAction` (checkout), `renewSubscriptionAction` (Studio billing) | |
| `WalletTransferPanel` (props `phone, accountName, content, amountVnd, qrImageDataUrl, referenceCode, referenceNoun, laterHref`) | `apps/web/app/_ui/wallet-transfer-panel.tsx` | Thuần trình bày |
| `renderInvoiceAwaitingReconciliationEmail` nhận `methodLabel?` | `@gieochu/email` | Mặc định "chuyển khoản QR thủ công" |

---

## 29. Trang thanh toán đơn tài liệu — view model + Server Action (ADR-061 + ADR-062, đợt 1 khách đã đăng nhập) ✅ đọc code 2026-10-27

Working tree, **chưa commit**. **Không thêm `route.ts`** (đếm lại: 23 dưới `/api`, 25 toàn app ✅). Migration `20261026180000_adr061_purchase_flow` đã áp 🟡. Nghiệp vụ:
[[02-System-Specs/Order-State-Machine|Order-State-Machine]] §3.4, §3.12; email [[02-System-Specs/Payment-And-Billing|Payment-And-Billing]] §5K; giao diện
[[04-Operations-Runbooks/UI-Design-System|UI-Design-System]] §8.4. **Chưa có** phần khách vãng lai (task 12/13).

### 29.1. `getCheckoutView(user, orderCode) → CheckoutView | null` (`apps/web/lib/checkout-view.ts`, mới)

Người gọi đã `requireVerifiedAccess` (task 13 đổi sang `requireCheckoutAccess` — chưa có). Không tìm thấy đơn của chính khách → `null` (trang `notFound()`). Đơn + dòng đơn
đọc dưới `withCustomer`; sản phẩm dưới `withPublic` (chỉ thấy khi còn PUBLISHED); `tenants`/`users`/`bank_bins` L1; không secret.

| Trường | Kiểu / ý nghĩa |
| :-- | :-- |
| `viewer` | `{ kind: "user", name, email, justCreated: false }` (`guest` để task 12/13) |
| `order` | `{ id, code, displayStatus, subtotalVnd, discountVnd, totalVnd, couponCode, provider, confirmMode: "MANUAL" \| "AUTO" \| null, checkout: CheckoutResult \| null, createdAt, expiresAt, paidAt, customerDeclaredPaidAt, can }` |
| `order.displayStatus` | `AWAITING_PAYMENT` · `AWAITING_SELLER_CONFIRM` · `PAID` · `EXPIRED` · `CANCELED` · `REFUNDED` (bảng ở Order-State-Machine §3.12) |
| `order.can` | `{ changeProvider, applyCoupon, declarePaid, undoDeclarePaid, cancel }` — UI chỉ ẩn/hiện, action kiểm lại |
| `item` | `{ productId, title, unitPriceVnd, finalPriceVnd, productPath \| null, typeLabel \| null, coverUrl \| null, stillPurchasable }` (đơn 1 tài liệu) |
| `tenant` | `{ name, slug }` |
| `bank` | `{ shortName, name } \| null` (checkout QR ngân hàng) |
| `enabledProviders` | `{ id, confirmMode, label, available }[]` — `label` theo `CUSTOMER_PROVIDER_LABELS` (SePay = "Chuyển khoản (xác nhận tự động)"); `available = false` khi hạn của phương thức đó (tính từ `createdAt`) đã qua |
| `links` | `{ library: "/account/library?tai-lieu={productId}", orders: "/account/orders", terms, sellerPolicy, login: "/login?next=…" }` — `terms`/`sellerPolicy` từ `legalDocumentPath` |

### 29.2. Server Action (`app/[tenantSlug]/checkout/[orderCode]/actions.ts`)

`CheckoutActionState = { error?: string; code?: string; ok?: boolean; provider?: PaymentProviderId }` (thêm `code`, `ok`, `provider`). Mọi action `requireVerifiedAccess`, tìm
đơn bằng `getOrderForCustomer`, bắt `AppError` → `{ error, code }` (riêng `applyCouponAction`/`removeCouponAction` vẫn chỉ `{ error }`).

| Action | Chữ ký | Gọi | Thành công |
| :-- | :-- | :-- | :-- |
| `selectProviderAction` | `(tenantSlug, orderCode, prevState, formData{provider}) → CheckoutActionState` | `initiateOrderCheckout` — chọn **hoặc đổi** phương thức; `after()` cho email người bán + khách | `{ ok: true, provider }` |
| `declarePaidAction` (mới) | `(tenantSlug, orderCode, prevState, formData) → CheckoutActionState` | `declareOrderPaid` ("Tôi đã chuyển khoản") | `{ ok: true }` |
| `undoDeclarePaidAction` (mới) | như trên | `undoDeclareOrderPaid` ("Tôi chưa chuyển khoản") | `{ ok: true }` |
| `cancelOrderByCustomerAction` (mới) | như trên | `cancelOrderByCustomer`; revalidate checkout + `/account/orders` | `{ ok: true }` |
| `applyCouponAction`, `removeCouponAction` | không đổi | thêm chặn `ORDER_DECLARED_PAID` | `{}` |

`VALID_PROVIDERS = ["MANUAL_QR", "SEPAY", "MOMO", "MOMO_MANUAL"]`; khác → `{ error: "Phương thức thanh toán không hợp lệ." }`.

### 29.3. Mã lỗi (`AppError`)

| Mã | HTTP | Khi nào |
| :-- | :-: | :-- |
| `PROVIDER_HOLD_EXPIRED` | 409 | Đổi sang phương thức có hạn (tính từ `createdAt`) đã qua |
| `ORDER_DECLARED_PAID` | 409 | Đổi phương thức / áp-gỡ mã / tự huỷ khi khách đã báo chuyển |
| `NOT_MANUAL_PROVIDER` | 400 | "Tôi đã chuyển khoản" với cổng tự xác nhận hoặc chưa chọn cổng |
| `ORDER_NOT_PENDING` | 409 | Đơn không còn chờ (hiệu lực) — như cũ, áp thêm cho 3 action mới |
| `ORDER_CHANGED` | 409 | Ghi có điều kiện thất bại (đơn vừa đổi) — như ADR-056 |
| `ORDER_NOT_CONFIRMABLE` | 409 | Người bán xác nhận đơn hết hạn mà không thuộc ngoại lệ "báo chuyển trước hạn" (luật mới, mã cũ) |

### 29.4. Export lib khác

| Export | Nơi |
| :-- | :-- |
| `orderHoldHoursFor(provider, settings) → number` | `lib/order.ts` |
| `declareOrderPaid`, `undoDeclareOrderPaid`, `cancelOrderByCustomer`, `notifyCustomerOfPaymentInstructions`, `notifyOwnerOfDeclaredPaid`, `runOrderPaymentReminders`, `CUSTOMER_PROVIDER_LABELS`, `MAX_PAYMENT_EMAILS_PER_ORDER` (3), `PAYMENT_REMINDER_WINDOW_HOURS` (24) | `lib/order-customer.ts` (mới) |
| `purgeExpiredRateLimitCounters(now?) → { deleted }` | `lib/rate-limit-store.ts` (mới) |
| `computeOrderHoldExpiresAt(createdAt, holdHours)`, `canManuallyConfirmOrder(status, expiresAt, now, { declaredPaidAt? })`, `manualConfirmDeadline(expiresAt)` (bỏ tham số cửa sổ) | `@gieochu/core` |
| `renderOrderPaymentInstructionsEmail`, `renderCustomerDeclaredPaidEmail`; `renderOrderAwaitingManualConfirmEmail` nhận `methodLabel?` | `@gieochu/email` |
| `OrderListItem.customerDeclaredPaidAt`, `OrderDetailView.customerDeclaredPaidAt`; `orderAllowedActions(order{…, provider?, customerDeclaredPaidAt?}, now)` | `lib/order.ts` |
| `/account/library?tai-lieu={productId}` — Thư viện làm nổi + focus thẻ tài liệu đó (chỉ khớp entitlement của chính user) | `app/account/library/page.tsx` |

### 29.5. Khách vãng lai + vá luồng mật khẩu (ADR-061 Q1, ADR-062 Q2/Q11, Bổ sung ADR-062) — working tree, chưa commit, chưa thử thủ công ✅ đọc code 2026-10-27

Không thêm `route.ts` (23 / 25 ✅ đếm). Nghiệp vụ: [[02-System-Specs/Order-State-Machine|Order-State-Machine]] §3.13, [[02-System-Specs/Auth-Session-Specs|Auth-Session-Specs]] §9A.

| Mục | Contract |
| :-- | :-- |
| Trang `/{tenantSlug}/checkout?tai-lieu={productSlug}` | Route group `(chua-co-don)`; không cần đăng nhập; đã đăng nhập → redirect trang tài liệu; 404 khi thiếu/không bán |
| `getGuestCheckoutView(tenantSlug, productSlug) → GuestCheckoutView \| null` (`lib/checkout-view.ts`) | `{ viewer: { kind: "guest" }, order: null, tenant, item: { productId, productSlug, title, priceVnd, typeLabel, coverUrl, productPath }, enabledProviders: { id, confirmMode, label }[], links: { terms, privacy, login } }` |
| `CheckoutView.viewer` | thêm `justCreated: boolean`, `guestSession: boolean` (§29.1) |
| `startGuestCheckoutAction(tenantSlug, productSlug, prevState, formData{fullName,email,acceptTerms,provider})` (`app/[tenantSlug]/checkout/actions.ts`) | `GuestCheckoutActionState = { error?, code?, fieldErrors?, values? }`; thành công → đặt cookie + `redirect("/{tenant}/checkout/{mã}?vua-tao=1")`. `code`: `VALIDATION`, `PRODUCT_UNAVAILABLE`, `RATE_LIMITED`, `EMAIL_EXISTS`, `EMAIL_EXISTS_GUEST`, `ALREADY_SIGNED_IN` |
| `buyProductAction` | Chưa đăng nhập → `redirect("/{tenant}/checkout?tai-lieu={slug}")`; có phiên → `requireCheckoutAccess` |
| Trang `/verify-email/dat-mat-khau?token=` + `activateGuestAccountAction(token, prevState, formData{password,confirmPassword})` | `{ error?, code? }` — `INVALID_TOKEN`, `TOKEN_ALREADY_USED`, `TOKEN_EXPIRED`, `WEAK_PASSWORD`, `PASSWORD_MISMATCH`; thành công → `/login?da-kich-hoat=1&next=/account/library` |
| `POST /api/auth/login` | Thêm **403 `GUEST_NOT_ACTIVATED`** (user PENDING chưa có mật khẩu; không tăng đếm sai) |
| `POST /api/auth/reset-password` | Thêm **400 `GUEST_NOT_ACTIVATED`** |
| `POST /api/auth/forgot-password`, `POST /api/auth/resend-verification` | Guest chưa kích hoạt → gửi email `guest_activation` (rate limit DB 3/email/giờ); response **không đổi** |
| `POST /api/auth/refresh` | User PENDING refresh được khi bản ghi `guestCheckout` + `hasPassword = false` (chính sách guest) |
| `POST /api/downloads` | `assertSameOrigin` + `requireCheckoutUser` (§7) |
| Lib | `startGuestCheckout`, `resendGuestActivation`, `activateGuestAccount`, `guestActivationUrl`, `GUEST_ACTIVATION_TTL_DAYS` (7), `EMAIL_EXISTS_GUEST_MESSAGE` (`lib/guest-checkout.ts`); `requireCheckoutAccess` (`lib/page-guards.ts`), `requireCheckoutUser` (`lib/session.ts`), `getGuestSessionPolicy`, `GUEST_SESSION_MAX_HOURS` (24) (`lib/jwt-context.ts`), `applyAuthCookiesTo` (`lib/cookies.ts`), `consumeRateLimit`, `rateLimitKey` (`lib/rate-limit-store.ts`); claim `gco` (`packages/auth` `AccessTokenClaims`); `renderGuestActivationEmail` (`@gieochu/email`) |

---

## 30. Xem trước 20% nội dung thật file tài liệu (ADR-063) ✅

Nguồn: `apps/web/app/api/[tenantSlug]/[productSlug]/preview/[fileId]/route.ts`,
`apps/web/lib/product-file-preview.ts` (2026-10-27, working tree — chưa commit). Bản trích:
[[01-Architecture-Decisions/ADR-047-Public-Product-File-Preview-20-Percent|ADR-047 (≙ ADR-063)]]. Thêm **1
`route.ts` dưới `/api`** → đếm lại 2026-10-27: **24 dưới `/api`, 26 toàn app** ✅.

| Trường | Giá trị |
| :-- | :-- |
| Method · Path | `GET /api/{tenantSlug}/{productSlug}/preview/{fileId}` |
| Layer | Public (route handler tự guard; **không** phải L3 — không yêu cầu đăng nhập) |
| Guard (ẩn mọi lỗi logic thành **404**) | `tenant.status = ACTIVE`; `product.status = PUBLISHED` + đúng `tenantId`/`slug`; `file.productId = product.id`; `sourceKind = FILE`; `scanStatus = CLEAN`; `removedAt = null`; `isPreview = false` |
| Request | Path params: `tenantSlug`, `productSlug`, `fileId`. Không body, không query, không cookie bắt buộc |
| Response 200 (JSON) | `{ fileName, mimeType, sizeBytes, kind, payload, ratio, totalEstimate }` |
| `kind` | `"docx"` · `"xlsx"` · `"pdf"` · `"text"` · `"unsupported"` |
| `payload` theo `kind` | `docx`: `{ html, paragraphsShown, totalParagraphs }` · `xlsx`: `{ sheetName, rows, rowsShown, totalRows }` · `pdf`: `{ text, charsShown, totalChars, pageCount }` · `text`: `{ text, charsShown, totalChars }` · `unsupported`: `{}` |
| `totalEstimate` | Tập con số của `payload` (`pageCount` · `totalRows` · `totalParagraphs` · `totalChars`) |
| `ratio` | Hằng `20` |
| Response 404 | `{ error: { code, message, requestId } }` — ẩn mọi lỗi: product không public, file không tồn tại/không hợp lệ, tenant không ACTIVE |
| Rate limit | **60 req/phút/IP** qua `rate_limit_counters` — **TODO** (helper public chưa viết; comment TODO trong route handler) |
| Side effects | **Lazy sinh cache** `product_file_previews` nếu chưa có; không ghi `audit_logs` |
| Runtime | `nodejs` + `dynamic = "force-dynamic"` (do `pdf-parse@^1.1.1`) |

Payload sau serialize **≤ 256 KB** (giới hạn ở extractor, [[02-System-Specs/File-Storage-And-Downloads-Specs|File-Storage-And-Downloads-Specs]] §11).

> Đánh số: mục này là §29 ở nhánh của vuong (commit `970f713`); khi gộp 2026-10-30 đổi thành **§30** vì §29 đã là trang thanh toán (ADR-061/062). Các trang của vuong vốn trỏ "Endpoint-Directory §30" — nay khớp. KB-Audit §49.

---

## 31. Cấu hình SePay, mã thanh toán SePay, xác nhận tay hoá đơn gói mọi cổng (2026-11-24 — ADR-065, ADR-066) ✅

Đối chiếu 2026-11-24: phần §31.1 đã commit `14f08ba` ✅ `git show --stat`; phần còn lại ở working tree, **chưa commit** ✅ `git status`. **Không thêm `route.ts`** (24 dưới `/api`,
26 toàn app ✅). Migration `20261124120000_adr065_order_payment_ref` (đã áp DB dev 🟡; production VPS chưa áp ❓ — bắt buộc khi deploy) — [[03-API-Contracts/Database-Schema-Reference|Database-Schema-Reference]] §7. Nghiệp vụ:
[[02-System-Specs/Payment-And-Billing|Payment-And-Billing]] §5L–§5N; quyết định [[01-Architecture-Decisions/ADR-049-Sepay-Numeric-Payment-Code-Shared|ADR-049 KB (≙ ADR-065)]],
[[01-Architecture-Decisions/ADR-050-Admin-Manual-Confirm-Invoice-Any-Provider|ADR-050 KB (≙ ADR-066)]].

### 31.1. Server Action — cấu hình SePay hai phía

| Action | Nơi | Chữ ký → state | Ghi chú |
| :-- | :-- | :-- | :-- |
| `saveSepayAction` | `app/admin/billing/payment/actions.ts` | `(prevState, formData) → PlatformPaymentActionState { error?, success?, message?, testResult? }` | `requireRole("SYSTEM_ADMIN")`. Form gửi thêm `apiToken` (trống = giữ). `paymentPrefix` zod trim + in hoa + `^[A-Z]{2,5}$` (ADR-065). `message` = "Đã lưu." / câu tự tắt (ADR-013) + `Mã hoá đơn SePay mới có dạng X + 8 chữ số. <hướng dẫn Cấu trúc mã>` + cảnh báo đổi tiền tố cũ (khác `SUB`) |
| `testSepayConnectionAction` | như trên | `() → { testResult: { ok, message } }` | `testPlatformProviderConnection("SEPAY", actorId)` — thành công đặt `lastVerifiedAt`, bật cổng, audit |
| `saveSepayAction` | `studio/[tenantSlug]/settings/payments/actions.ts` | `(tenantSlug, prevState, formData) → PaymentActionState { error?, success?, message?, testResult? }` | `requireTenantMember`. **`warning` đã bỏ** (ADR-065). Thành công: `message` = `Đã lưu. Mã thanh toán SePay của đơn có dạng X + 8 chữ số. <hướng dẫn>` |
| `testSepayConnectionAction` | như trên | `(tenantSlug) → { testResult }` | `testTenantProviderConnection(tenant.id, "SEPAY", userId)` qua `withTenant` |

Form field: `bankBin`, `accountNo`, `accountName`, `authType` (`API_KEY`\|`HMAC_SHA256`), `paymentPrefix`, `secret` (trống = giữ), `apiToken` (trống = giữ), `isEnabled`.
Secret không bao giờ trả về client — trang chỉ nhận `maskedSecrets`.

### 31.2. Export lib / package mới hoặc đổi

| Export | Nơi | Ghi chú |
| :-- | :-- | :-- |
| `generatePaymentCode(prefix)`, `normalizePaymentCodePrefix(value)`, `isPaymentCode(code, prefix?)`, `PAYMENT_CODE_DIGITS` (8), `PAYMENT_CODE_PREFIX_MIN` (2), `PAYMENT_CODE_PREFIX_MAX` (5) | `@gieochu/core` + **subpath mới `@gieochu/core/payment-code`** (`packages/core/package.json`) | Subpath dùng được ở client (`sepay-setup.ts`) |
| `generateInvoiceCode(prefix = "SUB")`, `isValidInvoiceCode(code, prefix = "SUB")` | `@gieochu/core` | Nay = định dạng mã thanh toán (trước: 8 ký tự chữ/số) |
| `extractSepayPaymentCodes(body, prefixes)`, `sepayAccountMatches(body, accountNo)`, `testSepayConnection(cfg, fetchImpl?)`; `SepayReferenceOptions.numeric?`; `SepayWebhookBody.accountNumber?` | `@gieochu/payments` | `testSepayConnection` có sẵn từ `14f08ba`, nay mới được export ở `index.ts` |
| `SEPAY_BANK_ACCOUNTS_URL` | `packages/payments/src/providers/sepay.ts` (chưa export ở `index.ts`) | `https://my.sepay.vn/userapi/bankaccounts/list` |
| `testTenantProviderConnection(tenantId, provider, actorId?) → TestResult` | `lib/tenant-payment.ts` | Bản tenant của `testPlatformProviderConnection` |
| `sepayCodeStructureInstruction(prefix)`, `sepayPrefixHint(prefix)`, `sepaySecretHint(authType)`, `SEPAY_API_TOKEN_HINT` | `apps/web/lib/sepay-setup.ts` (mới, chuỗi thuần) | Dùng ở 2 form + 2 action |
| `SecretKeyField`, `generateSecretKey(length = 48)` | `app/admin/_ui/secret-key-field.tsx` (client) | Dùng chung System Center + Studio |
| `tenantSepayPrefix(paymentPrefix, orderCodePrefix)` | `lib/order.ts` (export) | `resolveSepayPaymentRef` nội bộ; `buildTenantCheckoutPayload` trả `{ checkoutPayload, paymentRef }` (nội bộ) |
| `OrderDetailView.paymentRef: string \| null` | `lib/order.ts` | |
| `normalizeInvoiceCodePrefix` | `lib/subscription-billing.ts` | Nay = `normalizePaymentCodePrefix` (2–5 chữ cái; trước chữ/số 1–10) |
| `PaymentProcessJobData.referenceCandidates` | `lib/jobs.ts` | Shape không đổi; nghĩa mở rộng: mỗi mã khớp `paymentRef` hoặc `code` |

### 31.3. ADR-066 — xác nhận tay hoá đơn gói

| Hạng mục | Contract |
| :-- | :-- |
| `confirmManualInvoicePayment(invoiceId, actorId = null, note = null)` | Mọi cổng; PENDING → PAID (kỳ đã lưu); EXPIRED → xác nhận trễ (409 `NEWER_INVOICE_EXISTS` nếu có hoá đơn mới hơn); PAID → no-op; khác → 409 `INVOICE_NOT_CONFIRMABLE`. **Không còn ném 400 `NOT_MANUAL_INVOICE`** |
| `MANUAL_CONFIRM_NOTE_MAX` (500) | Export mới `lib/subscription-billing.ts`; ghi chú trim + cắt, trống → không ghi |
| `markInvoicePaid(invoiceId, { source, actorId?, note? })` | Thêm `note?` → metadata audit |
| `confirmManualInvoiceAction(invoiceId, prevState, formData) → { error?, success? }` | **Đổi chữ ký** (trước `(invoiceId)`, bỏ qua tham số còn lại). Đọc `note` từ form; revalidate `/admin/billing/invoices` + `/admin/subscriptions` |
| `confirmInvoiceFromTransactionAction` | Không đổi chữ ký; revalidate thêm `/admin/subscriptions` |
| `ManualConfirmButton({ invoiceId, invoiceCode, amountLabel, providerLabel, expired, autoProvider, align? })` | Thay `ConfirmButton` + `ExpiredConfirmButton` (đã xoá) — `app/admin/billing/invoices/confirm-button.tsx` |
| `/admin/billing/invoices` | Tab "Tất cả": nút ở mọi dòng PENDING/EXPIRED (mọi cổng). Tab "Chờ đối soát": như cũ (cổng xác nhận tay) |
| `/admin/subscriptions` | Thêm cột "Thao tác"; `listSubscriptions().items[].latestInvoice` = `{ id, code, status, amountVnd, provider } \| null` |

*Từ ADR-067 (§32.1): ở `/admin/subscriptions` và tab "Tất cả", `ManualConfirmButton` được thay bằng `InvoiceStatusButton`; `latestInvoice` thêm `statusTargets`.*

---

## 32. Đổi trạng thái hoá đơn gói (ADR-067) và đơn hàng Studio (ADR-068) — 2026-11-25 ✅

Đối chiếu code 2026-11-25, **đã commit `2ccc2fc`** ✅ `git show --stat`. **Không thêm `route.ts`** (24 dưới `/api`, 26 toàn app ✅ đếm). ADR-068 mục 8 thêm migration expand
`20261125120000_adr068_order_hold_started_at` (`orders.holdStartedAt`) — [[03-API-Contracts/Database-Schema-Reference|Database-Schema-Reference]] §7. Nghiệp vụ:
[[02-System-Specs/Payment-And-Billing|Payment-And-Billing]] §5O, [[02-System-Specs/Order-State-Machine|Order-State-Machine]] §3.14,
[[02-System-Specs/Studio-Orders-Specs|Studio-Orders-Specs]] §2.4; quyết định [[01-Architecture-Decisions/ADR-051-Subscription-Invoice-Status-Change-Void-Reopen|ADR-051 KB (≙ ADR-067)]],
[[01-Architecture-Decisions/ADR-052-Studio-Order-Status-Change-Reopen-Late-Confirm|ADR-052 KB (≙ ADR-068)]].

### 32.1. Hoá đơn gói — System Center (`app/admin/billing/invoices/actions.ts`, `lib/subscription-billing.ts`)

| Hạng mục | Contract |
| :-- | :-- |
| **`changeInvoiceStatusAction(invoiceId, prevState, formData) → ChangeInvoiceStatusState { error?, success? }`** (Server Action mới) | `requireRole("SYSTEM_ADMIN")`. Form: `target` ∈ `PAID`\|`PENDING`\|`VOID` (zod; sai → `{ error: "Vui lòng chọn trạng thái hợp lệ." }`), `note` (chuỗi, không bắt buộc). `PAID` → `confirmManualInvoicePayment`; `VOID` → `voidSubscriptionInvoice`; `PENDING` → `reopenSubscriptionInvoice`. `AppError` → `{ error: message }`; lỗi khác ném. Thành công: revalidate `/admin/billing/invoices` + `/admin/subscriptions`, `{ success: true }` |
| `confirmManualInvoiceAction` | **Giữ** — chỉ còn dùng ở tab "Chờ đối soát" (`ManualConfirmButton`) |
| `type InvoiceStatusTarget = "PAID" \| "PENDING" \| "VOID"` | Export mới (client chỉ `import type`) |
| `invoiceStatusTargets(status: InvoiceStatus) → InvoiceStatusTarget[]` | Hàm thuần — bảng chuyển ADR-067 (thứ tự PAID, PENDING, VOID) |
| `voidSubscriptionInvoice(invoiceId, actorId, note?) → Promise<void>` | Mới. 404 `INVOICE_NOT_FOUND`, 409 `INVOICE_NOT_VOIDABLE`. Audit `SUBSCRIPTION_INVOICE_VOIDED` |
| `reopenSubscriptionInvoice(invoiceId, actorId, note?) → Promise<void>` | Mới. 404 `INVOICE_NOT_FOUND`; 409 `INVOICE_NOT_REOPENABLE`, `PLAN_INACTIVE`, `INVOICE_NOT_LATEST`, `PENDING_INVOICE_EXISTS`. Audit `SUBSCRIPTION_INVOICE_REOPENED` |
| `listSubscriptionInvoices(...)` | `items[]` thêm **`statusTargets: InvoiceStatusTarget[]`** |
| `listSubscriptions(...)` | `latestInvoice` thêm **`statusTargets`** (null khi chưa có hoá đơn) |
| `InvoiceStatusButton({ invoiceId, invoiceCode, amountLabel, providerLabel, currentStatusLabel, targets, autoProvider, expired, align? })` | Component client mới (`confirm-button.tsx`); nơi gọi chỉ render khi `targets` khác rỗng |

### 32.2. Đơn hàng Studio (`app/studio/[tenantSlug]/orders/[orderId]/actions.ts`)

| Hạng mục | Contract |
| :-- | :-- |
| **`changeOrderStatusAction(tenantSlug, orderId, prevState, formData) → ChangeOrderStatusState { error?, success? }`** (Server Action mới) | `requireTenantMember(tenantSlug)` (mặc định OWNER) — `tenantId` từ guard, không từ form. Form: `target` ∈ `PAID`\|`PENDING`\|`CANCELLED` (zod), `note` (không bắt buộc). Gọi `changeOrderStatusBySeller`. `AppError` → `{ error }`. Thành công: revalidate chi tiết + danh sách, `{ success: true }` |
| ~~`confirmOrderManuallyAction(tenantSlug, orderId, prevState, formData)`~~ | **Đã xoá** (cùng `confirm-form.tsx`) |
| ~~`cancelOrderAction(tenantSlug, orderId)`~~ | **Đã xoá** (cùng `CancelOrderButton`) |
| `markOrderRefundedAction`, `grantExtraDownloadsAction`, `revokeEntitlementAction`, 2 action ghi chú | Không đổi |

### 32.3. `apps/web/lib/order.ts` + `@gieochu/core`

| Export | Ghi chú |
| :-- | :-- |
| `type OrderStatusTarget = "PAID" \| "PENDING" \| "CANCELLED"` | `CANCELLED` ↔ DB `CANCELED` |
| `orderStatusTargets(order: { status, expiresAt }, now?) → OrderStatusTarget[]` | Hàm thuần theo trạng thái hiệu lực |
| `ORDER_STATUS_CHANGE_NOTE_MAX` (500) | Ghi chú cắt, không báo lỗi |
| `changeOrderStatusBySeller(tenantId, orderId, target, note, actorId) → Promise<void>` | **Tiền điều kiện:** nơi gọi đã `requireTenantMember`. Lỗi: 404 (không thuộc gian hàng), 409 `ORDER_STATUS_NOT_CHANGEABLE`, `ORDER_ALREADY_PAID`, `ORDER_CHANGED`, `PRODUCT_UNAVAILABLE`, `ALREADY_OWNED`, `CANNOT_BUY_OWN_PRODUCT` |
| `OrderListItem.statusTargets`, `OrderListItem.provider`, `OrderDetailView.statusTargets` | Mới |
| ~~`cancelOrder(tenantId, orderId)`~~ | **Đã xoá** |
| `confirmOrderManually(tenantId, orderId, note, actorId?)` | **Giữ** (ghi chú bắt buộc, luật ADR-061/062) — không còn UI gọi; dùng ở test + `scripts/demo-reviews.ts` |
| `markOrderPaid(tx, orderId, source)` | Chữ ký không đổi; hành vi: cập nhật có điều kiện, thua cuộc → `{ fulfilled: false }` |
| `orderHoldStartedAt(order: { holdStartedAt, createdAt }) → Date` | Mới (ADR-068 mục 8) — mốc giữ `holdStartedAt ?? createdAt`; dùng ở `initiateOrderCheckout` và `checkout-view.ts` (`CheckoutView` phương thức `available`, shape không đổi) |
| `OrderPaymentChannel.MANUAL` | Nghĩa mở rộng (mục 9): `confirmNote` **hoặc** audit `ORDER_MANUALLY_CONFIRMED` của đơn; shape không đổi |
| `OrderEvent` (`@gieochu/core`) | Thêm `"SELLER_CANCEL"`, `"SELLER_REOPEN"` |
| `AUDIT_ACTIONS` (`@gieochu/core`) | +4: `SUBSCRIPTION_INVOICE_VOIDED`, `SUBSCRIPTION_INVOICE_REOPENED`, `ORDER_CANCELED_BY_SELLER`, `ORDER_REOPENED_BY_SELLER` (62 action) |
| `OrderStatusDialog`, `OrderStatusButton`, `type OrderStatusInfo`, `type OrderStatusDialogHandle` | Component client mới `app/studio/[tenantSlug]/orders/_ui/order-status-dialog.tsx` |

### 32.4. Mã lỗi mới (`AppError`)

| Mã | HTTP | Nơi |
| :-- | :-: | :-- |
| `INVOICE_NOT_VOIDABLE` | 409 | `voidSubscriptionInvoice` |
| `INVOICE_NOT_REOPENABLE`, `INVOICE_NOT_LATEST`, `PENDING_INVOICE_EXISTS` | 409 | `reopenSubscriptionInvoice` |
| `PLAN_INACTIVE` | 409 | `reopenSubscriptionInvoice` (mã đã có ở `createRenewalInvoice` với **400**) |
| `ORDER_STATUS_NOT_CHANGEABLE` | 409 | `changeOrderStatusBySeller` |
| `ORDER_ALREADY_PAID` | 409 | `changeOrderStatusBySeller` (→ PAID) và `confirmOrderManually` — `markOrderPaid` no-op vì nguồn khác vừa áp |

`INVOICE_NOT_FOUND`, `ORDER_CHANGED`, `PRODUCT_UNAVAILABLE`, `ALREADY_OWNED`, `CANNOT_BUY_OWN_PRODUCT` là mã có sẵn, nay thêm nơi ném.

*Từ ADR-069 (§33): `/admin/subscriptions` + tab "Tất cả" dùng `InvoiceRowMenu` thay `InvoiceStatusButton`; 3 action hoá đơn gói revalidate thêm trang chi tiết.*

---

## 33. Chi tiết đơn hàng gói + menu "⋯" ở System Center (ADR-069) — 2026-11-25 ✅

Đối chiếu code 2026-11-25, **đã commit `b18d97a`** ✅ `git show --stat`. **Không thêm `route.ts`** (24 dưới `/api`, 26 toàn app ✅ đếm), không migration. KB không đếm số
`page.tsx`. Nghiệp vụ: [[02-System-Specs/Payment-And-Billing|Payment-And-Billing]] §5P; quyết định
[[01-Architecture-Decisions/ADR-053-Admin-Subscription-Detail-Row-Menu|ADR-053 KB (≙ ADR-069)]].

### 33.1. Trang (App Router, Server Component)

| Trang | Guard | Loader | Ghi chú |
| :-- | :-- | :-- | :-- |
| **`/admin/subscriptions/[subscriptionId]`** (mới — `page.tsx` + `loading.tsx`) | `requireAdminAccess("/admin/subscriptions/{id}")` | `getAdminSubscriptionDetail(subscriptionId)` | `null` → `notFound()` (404). Không tham số query |

### 33.2. `apps/web/lib/subscription-billing.ts`

| Export | Contract |
| :-- | :-- |
| `getAdminSubscriptionDetail(subscriptionId) → Promise<AdminSubscriptionDetail \| null>` | Mới. **Tiền điều kiện:** nơi gọi đã kiểm System Admin. Chỉ L1 + `audit_logs`; ≤ 500 hoá đơn, ≤ 100 dòng nhật ký; bảng audit thiếu → `activity: []` |
| `interface AdminSubscriptionDetail` | `{ id, status, currentPeriodStart, currentPeriodEnd, graceEndsAt, plan { code, name, isFree, priceVnd }, tenant { id, name, slug, status }, invoices[] { id, code, status, provider, amountVnd, periodStart, periodEnd, createdAt, dueAt, paidAt, statusTargets }, activity[] { id, action, actionLabel, createdAt, actorLabel: string \| null, invoiceCode, fromStatus, toStatus, note } }` |
| `listSubscriptionInvoices(...)` | `items[]` thêm **`subscriptionId: string \| null`** (thuê bao của gian hàng); `tenant` không còn mang `subscription` lồng |

### 33.3. Server Action + component (`app/admin/billing/invoices/`)

| Hạng mục | Contract |
| :-- | :-- |
| `revalidateBillingPages()` (nội bộ `actions.ts`) | `revalidatePath("/admin/billing/invoices")`, `revalidatePath("/admin/subscriptions")`, `revalidatePath("/admin/subscriptions/[subscriptionId]", "page")`. Dùng ở `confirmManualInvoiceAction`, `changeInvoiceStatusAction`, `confirmInvoiceFromTransactionAction` (chữ ký không đổi) |
| `InvoiceRowMenu({ label, detailHref: string \| null, status: InvoiceStatusInfo \| null })` | Mới — menu "⋯" ("Xem chi tiết" + "Đổi trạng thái hoá đơn…") |
| `InvoiceStatusDialog({ ref, info, onClosed })`, `type InvoiceStatusDialogHandle { open() }`, `type InvoiceStatusInfo` | Mới — hộp ADR-067 tách khỏi nút mở |
| `InvoiceStatusButton({ ...InvoiceStatusInfo, align? })` | Props tương đương bản ADR-067 (nay khai báo qua `InvoiceStatusInfo`); chỉ còn dùng ở bảng hoá đơn của trang chi tiết |

---

## 34. Email thông báo trạng thái thanh toán (ADR-070) — 2026-11-25 ✅

Đối chiếu code 2026-11-25, **đã commit `dbf9984`** ✅ `git show --stat`. **Không thêm `route.ts`** (24 / 26 ✅ đếm), không migration, **shape HTTP không đổi**. Nghiệp vụ:
[[02-System-Specs/Payment-And-Billing|Payment-And-Billing]] §5Q; quyết định [[01-Architecture-Decisions/ADR-054-Payment-Status-Emails|ADR-054 KB (≙ ADR-070)]].

### 34.1. Route đổi hành vi (không đổi response)
- **`POST /api/webhooks/platform/[provider]`** — sau khi ghi `webhook_events` lần đầu: A1 (`markInvoicePaid` với `scheduleNotification`), A3 (đúng mã hoá đơn chưa PAID/REFUNDED, sai
  số tiền), A4 (MoMo thất bại cho hoá đơn PENDING/EXPIRED) — gom vào `runAfterResponseOrNow` → gửi sau response (`after()`); ngoài request thì chạy tại chỗ.
- **`GET /api/cron/daily`** — bước `subscriptionSweep` / `orderSweep` nay gửi A2 / B2 (khoá kết quả không đổi).

### 34.2. `apps/web/lib/payment-status-notify.ts` (mới)

| Export | Contract |
| :-- | :-- |
| `notifyOwnerOfInvoiceStatus(invoiceId, stage: SubscriptionInvoiceEmailStage, extra?: { receivedVnd? }) → Promise<void>` | A1–A5; đọc L1; không ném |
| `notifyCustomerOfOrderStatus(tenantId, orderId, stage: OrderStatusEmailStage, extra?: { receivedVnd?, provider? }) → Promise<void>` | B2–B5; đọc đơn dưới `withTenant`; không ném |
| `runAfterResponseOrNow(tasks) → Promise<void>` | `after()` nếu trong request, không thì chạy luôn |
| `formatEmailVnd(amountVnd) → string` | "150.000 đ" — dùng cả cho `order_paid` |
| `SUBSCRIPTION_INVOICE_EMAIL_TYPES`, `ORDER_STATUS_EMAIL_TYPES` | Bảng stage → `type` email |

### 34.3. Hàm lib đổi chữ ký / hành vi

| Hàm | Thay đổi |
| :-- | :-- |
| `markInvoicePaid(invoiceId, { source, actorId?, note?, scheduleNotification? })` | Thêm `scheduleNotification?: ScheduleAfterResponse` — có thì lên lịch A1, không thì gửi tại chỗ; chỉ khi lần này áp |
| `runSubscriptionSweep()` | Hết hạn hoá đơn bằng `UPDATE … RETURNING "id"` (SQL thô, bảng L1) + gửi A2 |
| `runOrderSweep() → Promise<number>` | Chuyển có điều kiện từng đơn; trả số đơn thật sự chuyển; gửi B2 cho đơn có `provider` |
| `processPaymentEvent` | B3 (`Mismatch.notifyCustomer` khi đơn PENDING/EXPIRED), B4 (MoMo `success = false`) sau commit |
| `voidSubscriptionInvoice`, `confirmExpiredManualInvoice`, `confirmInvoiceFromPlatformTransaction`, `sellerCancelOrder` (nội bộ) | Gửi A5 / A1 / A1 / B5 sau commit |

### 34.4. `@gieochu/email`
Export mới `renderSubscriptionInvoiceEmail(stage, data)`, `renderOrderStatusEmail(stage, data)` + kiểu `SubscriptionInvoiceEmailStage` (`PAID`\|`EXPIRED`\|`AMOUNT_MISMATCH`\|
`PAYMENT_FAILED`\|`VOIDED`), `OrderStatusEmailStage` (`EXPIRED`\|`AMOUNT_MISMATCH`\|`PAYMENT_FAILED`\|`CANCELED_BY_SELLER`), `SubscriptionInvoiceEmailData`, `OrderStatusEmailData`
(`packages/email/src/templates/payment-status.ts`). Mỗi hàm trả `{ subject, html, text }`.

---

## 35. Nhật ký chi tiết đơn hàng gói + chữ "Gian hàng" (ADR-071 đợt 2) — 2026-11-26 ✅

Đối chiếu code working tree 2026-11-26, **chưa commit** ✅ `git status`. **Không thêm `route.ts`** (24 / 26 ✅ đếm), không migration, không đổi URL (giữ `/admin/tenants`). Nghiệp vụ:
[[02-System-Specs/Payment-And-Billing|Payment-And-Billing]] §5R; quyết định [[01-Architecture-Decisions/ADR-055-Subscription-Activity-Log-Detail-Gian-Hang-Label|ADR-055 KB (≙ ADR-071)]].

### 35.1. `apps/web/lib/subscription-billing.ts`

| Export | Contract |
| :-- | :-- |
| `createRenewalInvoice(tenantId, input, options?: { scheduleNotification?, actorId?: string \| null })` | Thêm tuỳ chọn **`actorId`** → audit `SUBSCRIPTION_INVOICE_CREATED` (chỉ khi tạo mới); bỏ trống → actor null |
| `type SubscriptionActivityKind` | `"INVOICE_CREATED" \| "PAYMENT" \| "INVOICE_VOIDED" \| "INVOICE_REOPENED" \| "EMAIL" \| "OTHER"` |
| `type SubscriptionPaymentSource` | `"AUTO_SEPAY" \| "AUTO_MOMO" \| "AUTO_OTHER" \| "ADMIN_MANUAL" \| "ADMIN_FROM_TRANSACTION"` |
| `type SubscriptionEmailKind` | `"INVOICE_PAID" \| "INVOICE_EXPIRED" \| "INVOICE_AMOUNT_MISMATCH" \| "INVOICE_PAYMENT_FAILED" \| "INVOICE_VOIDED"` |
| `interface AdminSubscriptionActivityEntry` | `{ id` (id audit \| `created:{invoiceId}` \| `email:{logId}`), `kind, action: string \| null, actionLabel, createdAt, inferred, actor: { label, role: "SYSTEM_ADMIN" \| "TENANT_OWNER" \| "OTHER" } \| null, invoice: { code, amountVnd, provider } \| null, planName, paymentSource, lateConfirmation, receivedVnd, differenceVnd, bankTransactions: { provider, reference, occurredAt, contentExcerpt, amountVnd }[], fromStatus, toStatus, note, email: { kind, status: "SENT" \| "FAILED", recipientIsCurrentOwner, recipientMasked } \| null }` |
| `AdminSubscriptionDetail.activity` | Đổi kiểu → `AdminSubscriptionActivityEntry[]` (bỏ `actorLabel`, `invoiceCode` phẳng của ADR-069) |

### 35.2. Server Action + UI
- `renewSubscriptionAction` (`app/studio/[tenantSlug]/billing/actions.ts`) — chữ ký không đổi; truyền `actorId: user.userId` vào `createRenewalInvoice`.
- `SubscriptionActivityLog({ entries })` (mới, `app/admin/subscriptions/[subscriptionId]/_ui/activity-log.tsx`, Server Component) — trang chi tiết dùng thay `<ol>` viết tay.
- `@gieochu/core` `AUDIT_ACTIONS` +1 `SUBSCRIPTION_INVOICE_CREATED` (63 action).

---

## 36. Tài Liệu Tham Chiếu & Liên Kết

* [[MOC-Home]] — Trang chủ Map of Content ([MOC-Home.md](../00-Index/MOC-Home.md))
* [[01-Architecture-Decisions/ADR-049-Sepay-Numeric-Payment-Code-Shared|ADR-049 (≙ ADR-065)]] · [[01-Architecture-Decisions/ADR-050-Admin-Manual-Confirm-Invoice-Any-Provider|ADR-050 (≙ ADR-066)]] — mã thanh toán SePay, xác nhận tay hoá đơn gói (§9, §31) · [[04-Operations-Runbooks/SePay-Live-Test-Runbook|SePay-Live-Test-Runbook]]
* [[01-Architecture-Decisions/ADR-051-Subscription-Invoice-Status-Change-Void-Reopen|ADR-051 (≙ ADR-067)]] · [[01-Architecture-Decisions/ADR-052-Studio-Order-Status-Change-Reopen-Late-Confirm|ADR-052 (≙ ADR-068)]] — đổi trạng thái hoá đơn gói / đơn hàng Studio (§32) · [[01-Architecture-Decisions/ADR-053-Admin-Subscription-Detail-Row-Menu|ADR-053 (≙ ADR-069)]] — chi tiết đơn hàng gói (§33) · [[01-Architecture-Decisions/ADR-054-Payment-Status-Emails|ADR-054 (≙ ADR-070)]] — email trạng thái thanh toán (§34) · [[01-Architecture-Decisions/ADR-055-Subscription-Activity-Log-Detail-Gian-Hang-Label|ADR-055 (≙ ADR-071)]] — nhật ký chi tiết đơn hàng gói (§35)
* [[01-Architecture-Decisions/ADR-044-Beta-Payments-Manual-Confirm-Emails-Sepay|ADR-044 (≙ ADR-059)]] — chạy thử beta, giao dịch cổng (§28) ([ADR-044-Beta-Payments-Manual-Confirm-Emails-Sepay.md](../01-Architecture-Decisions/ADR-044-Beta-Payments-Manual-Confirm-Emails-Sepay.md))
* [[01-Architecture-Decisions/ADR-041-System-Center-Subscription-Invoices-Bank-Transfer-Qr|ADR-041 (≙ ADR-056)]] — hoá đơn/Đơn hàng gói, khối chuyển khoản, mã giảm giá tạo lại QR (§27) ([ADR-041-System-Center-Subscription-Invoices-Bank-Transfer-Qr.md](../01-Architecture-Decisions/ADR-041-System-Center-Subscription-Invoices-Bank-Transfer-Qr.md))
* [[02-System-Specs/System-Cms-Menu-Home-Seo-Specs|System-Cms-Menu-Home-Seo-Specs]] ([System-Cms-Menu-Home-Seo-Specs.md](../02-System-Specs/System-Cms-Menu-Home-Seo-Specs.md)) · [[02-System-Specs/Legal-Documents-Specs|Legal-Documents-Specs]] ([Legal-Documents-Specs.md](../02-System-Specs/Legal-Documents-Specs.md)) · [[01-Architecture-Decisions/ADR-035-Menu-Home-Seo-Versioned-Terms|ADR-035 (≙ ADR-050)]]
* [[Database-Schema-Reference]] — Lược đồ dữ liệu ([Database-Schema-Reference.md](./Database-Schema-Reference.md))
* [[03-API-Contracts/README|README]] — Giới thiệu thư mục ([README.md](./README.md))
* [[02-System-Specs/Product-Editor-And-Publishing-Specs|Product-Editor-And-Publishing-Specs]] ([Product-Editor-And-Publishing-Specs.md](../02-System-Specs/Product-Editor-And-Publishing-Specs.md))
* [[02-System-Specs/File-Storage-And-Downloads-Specs|File-Storage-And-Downloads-Specs]] §7 — luồng ảnh Cloudinary ADR-028 ([File-Storage-And-Downloads-Specs.md](../02-System-Specs/File-Storage-And-Downloads-Specs.md))
* [[01-Architecture-Decisions/ADR-014-System-Cloudinary-Image-Quota|ADR-014 (≙ ADR-028)]] ([ADR-014-System-Cloudinary-Image-Quota.md](../01-Architecture-Decisions/ADR-014-System-Cloudinary-Image-Quota.md))
* [[02-System-Specs/Reviews-Specs|Reviews-Specs]] — nghiệp vụ đánh giá M10a ([Reviews-Specs.md](../02-System-Specs/Reviews-Specs.md)) · [[01-Architecture-Decisions/ADR-015-M10-Reviews-Posts-Rls-Split-Writes|ADR-015 (≙ ADR-029)]] ([ADR-015-M10-Reviews-Posts-Rls-Split-Writes.md](../01-Architecture-Decisions/ADR-015-M10-Reviews-Posts-Rls-Split-Writes.md))
* [[02-System-Specs/Posts-Specs|Posts-Specs]] — nghiệp vụ bài viết M10b ([Posts-Specs.md](../02-System-Specs/Posts-Specs.md))
* [[01-Architecture-Decisions/ADR-016-Short-Product-Url-No-Sticky-Publish-Card|ADR-016 (≙ ADR-030)]] — URL tài liệu rút gọn, redirect 301 ([ADR-016-Short-Product-Url-No-Sticky-Publish-Card.md](../01-Architecture-Decisions/ADR-016-Short-Product-Url-No-Sticky-Publish-Card.md))
* [[01-Architecture-Decisions/ADR-018-System-Settings-And-Brand-From-System-Center|ADR-018 (≙ ADR-032)]] ([ADR-018-System-Settings-And-Brand-From-System-Center.md](../01-Architecture-Decisions/ADR-018-System-Settings-And-Brand-From-System-Center.md)) · [[01-Architecture-Decisions/ADR-019-Home-Page-Real-Data-Sold-Count|ADR-019 (≙ ADR-033)]] ([ADR-019-Home-Page-Real-Data-Sold-Count.md](../01-Architecture-Decisions/ADR-019-Home-Page-Real-Data-Sold-Count.md))
* [[02-System-Specs/Background-Jobs-Specs|Background-Jobs-Specs]] — job nền, `after()`, cron hằng ngày (ADR-036) ([Background-Jobs-Specs.md](../02-System-Specs/Background-Jobs-Specs.md))
* [[02-System-Specs/Audit-Log-Specs|Audit-Log-Specs]] — audit log M12a (ADR-037) ([Audit-Log-Specs.md](../02-System-Specs/Audit-Log-Specs.md))
* [[02-System-Specs/Tenant-Stats-Specs|Tenant-Stats-Specs]] — thống kê hằng ngày M12b (ADR-037) ([Tenant-Stats-Specs.md](../02-System-Specs/Tenant-Stats-Specs.md))
* [[02-System-Specs/Studio-Dashboard-Specs|Studio-Dashboard-Specs]] — dashboard Tổng quan gian hàng (ADR-043) ([Studio-Dashboard-Specs.md](../02-System-Specs/Studio-Dashboard-Specs.md)) · [[01-Architecture-Decisions/ADR-029-Studio-Dashboard-Period-Gross-Net-Revenue|ADR-029 (≙ ADR-043)]]
* [[02-System-Specs/Abuse-Reports-Specs|Abuse-Reports-Specs]] — báo cáo vi phạm M12c + quyền lợi người mua (ADR-038/039) ([Abuse-Reports-Specs.md](../02-System-Specs/Abuse-Reports-Specs.md))
* [[02-System-Specs/Studio-Orders-Specs|Studio-Orders-Specs]] — trang Đơn hàng Studio (ADR-046) ([Studio-Orders-Specs.md](../02-System-Specs/Studio-Orders-Specs.md)) · [[01-Architecture-Decisions/ADR-031-Studio-Orders-List-Detail-Upgrade|ADR-031 (≙ ADR-046)]]
* [[02-System-Specs/Studio-Customers-Specs|Studio-Customers-Specs]] — trang Khách hàng Studio (ADR-048) ([Studio-Customers-Specs.md](../02-System-Specs/Studio-Customers-Specs.md)) · [[01-Architecture-Decisions/ADR-033-Studio-Customers-List-Upgrade|ADR-033 (≙ ADR-048)]]
* [[02-System-Specs/Pricing-Page-Specs|Pricing-Page-Specs]] ([Pricing-Page-Specs.md](../02-System-Specs/Pricing-Page-Specs.md)) · [[02-System-Specs/Account-Profile-Specs|Account-Profile-Specs]] ([Account-Profile-Specs.md](../02-System-Specs/Account-Profile-Specs.md)) · [[01-Architecture-Decisions/ADR-027-Account-Upgrade-Pricing-Profile-Refund|ADR-027 (≙ ADR-041)]] ([ADR-027-Account-Upgrade-Pricing-Profile-Refund.md](../01-Architecture-Decisions/ADR-027-Account-Upgrade-Pricing-Profile-Refund.md))
* [[02-System-Specs/Shop-Marketplace-Specs|Shop-Marketplace-Specs]] ([Shop-Marketplace-Specs.md](../02-System-Specs/Shop-Marketplace-Specs.md)) · [[01-Architecture-Decisions/ADR-021-Shop-Marketplace-Cms-First|ADR-021 (≙ ADR-035)]] ([ADR-021-Shop-Marketplace-Cms-First.md](../01-Architecture-Decisions/ADR-021-Shop-Marketplace-Cms-First.md))
* [[01-Architecture-Decisions/ADR-030-Storage-Gateway-Encrypted-Ticket-Nginx|ADR-030 (≙ ADR-045)]] — Storage Gateway ([ADR-030-Storage-Gateway-Encrypted-Ticket-Nginx.md](../01-Architecture-Decisions/ADR-030-Storage-Gateway-Encrypted-Ticket-Nginx.md)) · [[04-Operations-Runbooks/Storage-Gateway-VPS-Runbook|Storage-Gateway-VPS-Runbook]] ([Storage-Gateway-VPS-Runbook.md](../04-Operations-Runbooks/Storage-Gateway-VPS-Runbook.md))
* [[01-Architecture-Decisions/ADR-047-Public-Product-File-Preview-20-Percent|ADR-047 (≙ ADR-063)]] — endpoint xem trước 20% nội dung thật (§29) ([ADR-047-Public-Product-File-Preview-20-Percent.md](../01-Architecture-Decisions/ADR-047-Public-Product-File-Preview-20-Percent.md))

*Quay lại: [[MOC-Home]] (../00-Index/MOC-Home.md)*

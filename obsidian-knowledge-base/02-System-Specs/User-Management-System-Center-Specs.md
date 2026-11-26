---
tags:
  - spec
  - admin
  - system-admin
  - security
  - status/living
date: 2026-09-26
updated: 2026-11-26
author: System Architect
---

# 📐 Đặc Tả: System Center — Console Quản Trị Nền Tảng (System Admin Specs)

> Phạm vi: file này không mô tả "phiên đăng nhập đa thiết bị" (Gieo Chữ không có `SessionRecord`/multi-device
> session — xem mục 4). Nội dung thật là toàn bộ console `/admin/**`
> ("System Center" theo cách gọi trong `docs/ARCHITECTURE.md`) mà System Admin dùng để vận hành nền tảng.

## 1. Mục Tiêu & Ranh Giới Tuyệt Đối

System Admin quản trị **toàn nền tảng** (người dùng, gói dịch vụ, thanh toán platform, nội dung CMS, cấu hình
hệ thống) nhưng có một ranh giới bảo mật **không được phá vỡ** (CLAUDE.md §7.9, đã xác nhận qua rà soát mã
nguồn khu vực `/admin`):

> **System Admin không có route nào đọc chi tiết `orders`/`order_items`/`tenant_customers` của một tenant cụ
> thể.** Dashboard/thống kê phía Admin chỉ đọc `tenant_daily_stats` (bảng tổng hợp M12b — section "Hoạt động bán tài liệu (30 ngày)" trên `/admin`,
> [[02-System-Specs/Tenant-Stats-Specs|Tenant-Stats-Specs]]; xong code 2026-10-16, đã commit `36103fb`, deploy ❓) và các
> bảng L1 (`User`, `Plan`, `Subscription`, `SubscriptionInvoice`, `PlatformPaymentTransaction`...).

Nói cách khác, System Admin không phải người xem đơn hàng của tenant — ở Gieo Chữ, dữ
liệu kinh doanh của một gian hàng là riêng tư giữa Tenant Owner và khách hàng của họ.

---

## 2. Điều Hướng Thật Của `/admin/**` (`AdminSidebarNav`)

Lấy trực tiếp từ `apps/web/app/admin/_ui/sidebar-nav.tsx` (mảng `ADMIN_STANDALONE` + `ADMIN_GROUPS`, đối chiếu 2026-10-17, cập nhật 2026-10-25 theo ADR-056 ✅) — nguồn sự thật duy
nhất cho "System Center có gì". Từ ADR-042 menu dựng bằng `SidebarNav` **dùng chung với Studio** (accordion 1 nhóm mở, nhớ nhóm ở
`localStorage` `admin:nav:expanded`), nằm trong `AppSidebarPanel` có nút **Đăng xuất** cố định đáy (về `/login`); dưới `lg` mở bằng nút ☰
(drawer `<dialog>`). Header có menu tài khoản (họ tên + avatar, cũng có Đăng xuất). Chi tiết giao diện:
[[04-Operations-Runbooks/UI-Design-System|UI-Design-System]] §5.1 · quyết định [[01-Architecture-Decisions/ADR-028-Shared-App-Sidebar-Logout-Mobile-Drawer|ADR-028 KB (≙ ADR-042)]].

```mermaid
flowchart TB
    Root["/admin — Tổng quan"]
    subgraph G1["Người dùng"]
        U1["/admin/users — Danh sách người dùng"]
        U2["/admin/roles — Phân quyền (trang tham khảo, chỉ đọc)"]
    end
    subgraph G2["Kinh doanh"]
        B1["/admin/tenants — Gian hàng (trước ADR-071: Tenant)"]
        B2["/admin/plans — Gói dịch vụ"]
        B3["/admin/subscriptions — Đơn hàng (Đơn hàng gói dịch vụ, ADR-056)"]
    end
    subgraph G3["Nội dung"]
        C1["/admin/cms — Trang CMS"]
        C3["/admin/cms/shop — Trang Cửa hàng (ADR-035)"]
        C4["/admin/cms/pricing — Trang Bảng giá (ADR-041)"]
        C5["/admin/cms/menu — Menu & chân trang (ADR-050)"]
        C6["/admin/cms/phap-ly — Văn bản pháp lý (ADR-050, ADR-054)"]
        C2["/admin/categories — Danh mục tài liệu"]
    end
    subgraph G4["Tài chính"]
        F1["/admin/billing/payment — Cấu hình thanh toán (trước ADR-056: Thanh toán nền tảng)"]
        F2["/admin/billing/invoices — Hoá đơn (2 tab Chờ đối soát / Tất cả, ADR-056)"]
        F3["/admin/billing/refunds — Hoàn tiền gói (ADR-041) — badge số yêu cầu chờ duyệt"]
    end
    subgraph G5["Cấu hình hệ thống"]
        S0["/admin/settings/general — Cấu hình chung (ADR-032)"]
        S1["/admin/settings — Email hỗ trợ"]
        S2["/admin/settings/branding — Nhận diện thương hiệu"]
        S3["/admin/settings/storage — Lưu trữ file (R2)"]
        S4["/admin/settings/cloudinary — Cloudinary Upload (ảnh CMS)"]
        S5["/admin/settings/smtp — Cấu hình Mail"]
    end
    subgraph G6["Giám sát"]
        M1["/admin/audit — Nhật ký hệ thống (M12a, ADR-037)"]
        M2["/admin/reports — Báo cáo vi phạm (M12c, ADR-038) — badge số báo cáo OPEN"]
    end
```

Mọi trang trong `/admin/**` đều tự gọi `requireAdminAccess(nextPath)` (`lib/page-guards.ts`) — chưa đăng nhập
→ redirect `/login`; đăng nhập nhưng không phải `SYSTEM_ADMIN` → `notFound()` (404, không lộ thông tin trang
có tồn tại).

---

## 3. Quản Lý Người Dùng & Khoá Tài Khoản (`/admin/users`)

### 3.1. Vòng đời trạng thái tài khoản (`UserStatus`)

```prisma
enum UserStatus { PENDING  ACTIVE  LOCKED }
```

```mermaid
stateDiagram-v2
    [*] --> PENDING: Đăng ký tài khoản mới
    PENDING --> ACTIVE: Xác minh email (verify-email token)
    ACTIVE --> LOCKED: Admin khoá (lockUser)
    LOCKED --> ACTIVE: Admin mở khoá (unlockUser)
```

### 3.2. `lockUser`/`unlockUser` (`apps/web/lib/admin-users.ts`)

- **Ràng buộc bất biến:** không admin nào — kể cả admin khác — có thể khoá tài khoản có `isSuperAdmin = true`.
  Đây là "một admin duy nhất nobody có thể khoá" (comment gốc trong schema, mục §"M2").
- Khoá/mở khoá không xoá dữ liệu, chỉ đổi `UserStatus` — tài khoản `LOCKED` bị chặn đăng nhập ở API login.
- **Audit (M12a, ADR-037) ✅ đọc code 2026-10-16:** `lockUser` ghi `USER_LOCKED` (metadata `previousStatus`, `revokedSessions`; **chưa có
  lý do khoá** — form chưa có ô lý do, BACKLOG); `unlockUser(actor, targetUserId)` — **chữ ký đổi**, `actor` bắt buộc — ghi
  `USER_UNLOCKED`. Xem [[02-System-Specs/Audit-Log-Specs|Audit-Log-Specs]].

### 3.3. Chống brute-force mật khẩu (khác cơ chế "phiên đăng nhập")

Không có bảng `SessionRecord` đa thiết bị trong Gieo Chữ. Cơ chế bảo mật đăng nhập thật dựa trên 2 cột trên
`User`:

- `failedLoginAttempts`: đếm liên tiếp số lần sai mật khẩu (chỉ khi email tồn tại thật) — về 0 khi đăng nhập
  thành công hoặc đặt lại mật khẩu thành công.
- `passwordResetRequired`: `true` khi `failedLoginAttempts` chạm ngưỡng 5 — chặn đăng nhập (**kể cả đúng mật
  khẩu**) cho tới khi người dùng tự đặt lại qua `/forgot-password`. Không liên quan `UserStatus` (đó là khoá
  admin/email chưa xác minh — hai concern khác nhau).

### 3.4. Chính sách: không xoá user, chỉ khoá (chủ dự án chốt 2026-10-23 — "Bổ sung ADR-050" (a))

- Người dùng vi phạm hoặc ngừng dùng **chỉ bị khoá** (deactivate — `UserStatus = LOCKED`, chặn thao tác, **giữ nguyên dữ liệu**) để tránh xoá nhầm.
  Không có luồng nghiệp vụ nào xoá dòng `users` ✅ grep `apps/web` (2026-10-23): ngoài test chỉ có script **dev** `apps/web/scripts/demo-reviews.ts`
  (`demo:clean`, xoá đúng các email demo — [[04-Operations-Runbooks/Dev-Demo-Data-Runbook|Dev-Demo-Data-Runbook]]).
- FK `ON DELETE CASCADE` từ bảng con tới `users` (vd `user_legal_acceptances`, ADR-050) chỉ phục vụ dọn dữ liệu test, **không** phải đường nghiệp vụ.
- Hạng mục "xoá tài khoản" trong giai đoạn pháp lý (hoãn ở ADR-050) phải có ADR riêng và không được mâu thuẫn chính sách này mà không có quyết định
  mới của chủ dự án. Xem [[01-Architecture-Decisions/ADR-035-Menu-Home-Seo-Versioned-Terms|ADR-035 KB (≙ ADR-050)]].

---

## 4. Bảo Mật Phiên Đăng Nhập — Cơ Chế Thật (Refresh Token Rotation)

> [!note] Cập nhật ADR-053 (2026-10-24) ✅ code
> Từ ADR-053 mỗi `familyId` được dùng như **một phiên/thiết bị** (cột `rememberMe`, `sessionStartedAt`, `deviceLabel`): danh sách thiết bị + đăng xuất từng
> phiên ở `/account/security`, idle/absolute timeout đo ở server, "Ghi nhớ đăng nhập", ân hạn 30 giây cho refresh đồng thời (`AUTH_REFRESH_SUPERSEDED`),
> rotation nguyên tử, refresh từ chối user không `ACTIVE`. Vẫn **không** có bảng `SessionRecord` riêng. Chi tiết: [[02-System-Specs/Auth-Session-Specs|Auth-Session-Specs]].

Gieo Chữ dùng **rotation + family revocation** trên `RefreshToken` (`packages/auth/src/tokens/refresh-token.ts`),
không có bảng `SessionRecord` riêng:

- Mỗi lần refresh, token cũ bị thay bằng token mới **cùng `familyId`** (`replacedById` trỏ tới token kế tiếp).
- **Phát hiện tái sử dụng token đã bị thay (reuse detection):** nếu một token đã `replacedById` bị dùng lại
  (dấu hiệu token bị đánh cắp), toàn bộ `familyId` bị revoke — chặn luôn mọi refresh tiếp theo trong cùng
  chuỗi. *Ngoại lệ từ ADR-053:* token bị thay chưa quá 30 giây (race nhiều tab) → `superseded`, không revoke.
- Chỉ lưu **hash SHA-256** của refresh token (`tokenHash`), không bao giờ lưu token gốc (CLAUDE.md §7.2).
- Access/refresh token chỉ trong cookie `httpOnly`, `Secure` (prod), `SameSite=Lax`; refresh cookie
  `Path=/api/auth`.

---

## 5. Các Module Còn Lại Của System Center (Tham Khảo Nhanh)

| Khu vực | Chức năng chính | Lib/route chính |
| :--- | :--- | :--- |
| `/admin/plans` | CRUD gói dịch vụ, `isFree`/`features` JSON | `createPlanAction`/`updatePlanAction`, `packages/core/src/admin/plan-validation.ts` |
| `/admin/tenants` | `lockTenantAction`/`unlockTenantAction` (`TenantStatus.LOCKED` ↔ `ACTIVE`, qua `lib/tenant-lock.ts` từ M12a/M12c) — **không** đọc order/customer của tenant. Từ ADR-039: badge "N hoàn tiền quá hạn" = **chỉ số đếm** yêu cầu hoàn tiền quá 7 ngày (`countOverdueRefundRequestsByTenant`), không id đơn/khách | `apps/web/app/admin/tenants/actions.ts`, `apps/web/lib/entitlement-remedy.ts` |
| `/admin/cms` | CRUD trang CMS marketing, `blocksDraft` (nháp) tách khỏi `blocks` (live). Trang chủ (`slug=home`) dùng schema riêng `homeSectionsSchema`; từ ADR-033 bốn section `stats`/`search`/`coaches`/`documents` lấy dữ liệu thật, CMS chỉ lưu nhãn/`limit`/id ghim (ô chọn ghim `PinPicker`) | `packages/core/src/admin/cms-blocks.ts`, `packages/core/src/admin/home-sections.ts`, `apps/web/lib/home.ts` — xem [[01-Architecture-Decisions/ADR-019-Home-Page-Real-Data-Sold-Count|ADR-019 (≙ ADR-033)]]. Từ ADR-050: thêm slug hệ thống `menu` (`/admin/cms/menu` — menu header/footer), trang chủ thêm section `steps`/`faq`/`community` + ô SEO, editor văn bản pháp lý `/admin/cms/phap-ly` — xem [[02-System-Specs/System-Cms-Menu-Home-Seo-Specs|System-Cms-Menu-Home-Seo-Specs]], [[02-System-Specs/Legal-Documents-Specs|Legal-Documents-Specs]] |
| `/admin/categories` | Danh mục tài liệu (metadata sản phẩm, không phải dữ liệu riêng tư của tenant) | `apps/web/app/admin/categories/*` |
| `/admin/billing/payment` | Menu "Cấu hình thanh toán" (trước ADR-056: "Thanh toán nền tảng"). Cấu hình `PlatformPaymentConfig` (Manual QR/SePay/MoMo); lưu báo rõ khi cổng bị tự tắt (ADR-013) | `savePlatformProviderConfig` → `{ isEnabled, autoDisabled }` — xem [[Payment-And-Billing]] §5E |
| `/admin/billing/invoices` | (ADR-056) Tab "Chờ đối soát" — duyệt `SubscriptionInvoice` MANUAL_QR PENDING; tab "Tất cả" — mọi hoá đơn gói, lọc trạng thái/cổng, phân trang; nút xác nhận chỉ ở dòng MANUAL_QR PENDING | `listPendingManualInvoices`, `listSubscriptionInvoices` (`subscription-billing.ts`) — [[Payment-And-Billing]] §5C |
| `/admin/subscriptions` | (ADR-056) "Đơn hàng gói dịch vụ" (menu Kinh doanh → Đơn hàng): thuê bao của mọi gian hàng, lọc gói/trạng thái, gói trả phí theo ngày hết hạn, gói miễn phí "Không thời hạn" xếp sau, hoá đơn gần nhất. Chỉ bảng L1 (§7.9) | `listSubscriptions`, `listPlanFilterOptions`, `parseEnumParam` (`subscription-billing.ts`) — [[Payment-And-Billing]] §5C |
| `/admin/settings/general` | (ADR-032) "Cấu hình chung": 15 khoá đang dùng của `SystemSettings` (TTL access, hạn link xác minh/đặt lại mật khẩu, hạn presign tải lên/tải xuống, ân hạn, đơn/hoá đơn chờ, lượt tải mặc định; từ ADR-053 thêm nhóm "Chính sách phiên đăng nhập" 6 khoá — áp cho cả phiên đang mở từ lần refresh kế tiếp, xem [[02-System-Specs/Auth-Session-Specs|Auth-Session-Specs]] §9) — có giới hạn; `trialDays` và (từ ADR-053) `refreshTokenTtlDays` lưu nhưng ẩn (không dùng) | `apps/web/lib/system-settings.ts`, `updateSystemSettingsAction`; xem [[01-Architecture-Decisions/ADR-018-System-Settings-And-Brand-From-System-Center|ADR-018 (≙ ADR-032)]] |
| `/admin/settings` | Chỉ còn **Email hỗ trợ** (`SystemSettings.supportEmail`) | `updateSupportEmailAction` (`app/admin/settings/actions.ts`) |
| `/admin/settings/branding` | `SystemBranding` — nguồn **duy nhất** của tên thương hiệu/slogan (ADR-032; trống → `DEFAULT_BRAND`), logo, màu | `apps/web/lib/branding.ts` (`getEffectiveBrand`) |
| `/admin/settings/storage` | `SystemStorageConfig` (R2 credential mã hoá) | xem [[File-Storage-And-Downloads-Specs]] |
| `/admin/settings/smtp` | Cấu hình gửi mail (SMTP) — nguồn production; env email chỉ là fallback dev (ADR-032). Thiếu cả hai → `EMAIL_NOT_CONFIGURED` | `packages/email`, `apps/web/lib/email-dispatch.ts` |
| `/admin/roles` | Trang **chỉ đọc**, giải thích 3 lớp tài khoản (System/Tenant/Customer) | xem [[Tenant-RBAC-And-Permissions]] |
| `/admin/reports` | (M12c, ADR-038) Báo cáo vi phạm: danh sách lọc trạng thái (mặc định OPEN)/loại/đối tượng, chi tiết + xử lý (ẩn nội dung, lưu trữ tài liệu, khoá gian hàng, bác bỏ), gỡ khoá kiểm duyệt. Xem nội dung đối tượng, **không** xem đơn/khách (§7.9); email người báo cáo chỉ admin thấy | `apps/web/lib/abuse-report.ts`, `app/admin/reports/actions.ts` — xem [[02-System-Specs/Abuse-Reports-Specs\|Abuse-Reports-Specs]] |
| `/admin/audit` | (M12a, ADR-037) Nhật ký hệ thống: lọc người thực hiện, hành động, gian hàng, khoảng ngày; dòng của khách chỉ hiện email đã che, không IP/User-Agent (§7.9) | `apps/web/lib/audit-query.ts` (`listAuditLogs`) — xem [[02-System-Specs/Audit-Log-Specs\|Audit-Log-Specs]] |

`getSystemRoleCounts()`/`getTenantOwnerCount()` (`apps/web/lib/admin-roles.ts`) là ví dụ đúng chuẩn: đếm số
lượng theo vai trò (aggregate), không bao giờ trả về danh sách đơn hàng/khách hàng chi tiết của một tenant.

---

## 6. Tài Liệu Tham Chiếu & Liên Kết

* [[Architecture-Overview]] — Ranh giới L1 System vs L2 Tenant ([Architecture-Overview.md](./Architecture-Overview.md))
* [[Tenant-RBAC-And-Permissions]] — `SystemRole`, `isSuperAdmin`, `Role`/`Permission` ([Tenant-RBAC-And-Permissions.md](./Tenant-RBAC-And-Permissions.md))
* [[Payment-And-Billing]] — `PlatformPaymentConfig`, hoá đơn subscription ([Payment-And-Billing.md](./Payment-And-Billing.md))
* [[02-System-Specs/Auth-Session-Specs|Auth-Session-Specs]] — phiên đăng nhập, idle/absolute, "Ghi nhớ", danh sách thiết bị (ADR-053) ([Auth-Session-Specs.md](./Auth-Session-Specs.md))
* CLAUDE.md §7.9 — nguyên tắc "System admin không có route nào đọc chi tiết đơn hàng/khách hàng của tenant"
* Mã nguồn: `apps/web/lib/admin-users.ts`, `apps/web/lib/admin-roles.ts`, `apps/web/lib/page-guards.ts`,
  `apps/web/app/admin/_ui/{sidebar-nav,app-sidebar,sidebar-drawer}.tsx`, `apps/web/app/admin/layout.tsx`, `packages/auth/src/tokens/refresh-token.ts`,
  `packages/db/prisma/schema.prisma` (`User`, `UserStatus`, `RefreshToken`)

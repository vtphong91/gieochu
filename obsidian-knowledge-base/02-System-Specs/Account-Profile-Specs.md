---
tags:
  - spec
  - account
  - auth
  - security
  - customer
  - status/living
date: 2026-10-17
updated: 2026-10-24
author: Long
---

# 📐 Đặc Tả: Khu Vực Tài Khoản `/account` — Hồ Sơ, Bảo Mật, Đổi Email (ADR-041 C)

> Quyết định gốc: **ADR-041** mục C (gồm bổ sung ADR-008 — hồ sơ không còn bắt buộc 4 trường) trong
> [`docs/DECISIONS.md`](../../docs/DECISIONS.md). Bản trích KB: [[01-Architecture-Decisions/ADR-027-Account-Upgrade-Pricing-Profile-Refund|ADR-027 (≙ ADR-041)]].
> Kế hoạch: [`docs/ke-hoach-nang-cap-tai-khoan-va-ho-so-2026-10-17.md`](../../docs/ke-hoach-nang-cap-tai-khoan-va-ho-so-2026-10-17.md);
> đề xuất giao diện của Phong: `docs/de-xuat-trang-ho-so-2026-10-17.md`.
>
> Mức xác minh: ✅ Long đã đối chiếu code working tree 2026-10-17 (**GĐ1 + GĐ2 xong code; đã commit `7f8360b`**, deploy ❓) · 🟡 theo brief/báo
> cáo · ❓ cần môi trường thật. Migration `20261017090000_adr041_email_change` **đã áp DB dùng chung 2026-10-17** 🟡 (brief Quốc).

---

## 1. Phạm vi

- **Một hồ sơ cá nhân cho mọi `User`** (khách mua + chủ gian hàng). Studio chỉ giữ cài đặt gian hàng; hai khu vực liên kết qua menu tài
  khoản và nhóm "Gian hàng của bạn". Một user sở hữu tối đa 1 gian hàng (`Tenant.ownerId @unique`) ✅.
- Bỏ mục không có nghiệp vụ (Referrals, Blocklist, Members…). Họ tên gộp **một ô**.
- **Để sau (BACKLOG):** ~~danh sách phiên/IP~~ (làm ở ADR-053 — §4.3), xoá tài khoản, tuỳ chọn thông báo, ảnh đại diện công khai, xác thực hai bước.
- Bảng dùng: `users`, `user_profiles`, `refresh_tokens`, `verification_tokens` (L1 — `getPrismaClient()` trực tiếp là đúng lớp);
  thư viện/đơn của chính user qua `withCustomer` (L3); thẻ gian hàng chỉ đọc bảng L1 + đếm tài liệu của chính gian hàng (`withTenant`) ✅.

---

## 2. Cấu trúc trang ✅

| Đường dẫn | Nội dung | Gác quyền |
| :-- | :-- | :-- |
| `/account` | **Tổng quan** (trước đây 404): thông tin cá nhân tóm tắt, thẻ "Gian hàng của bạn" hoặc thẻ "Mở gian hàng miễn phí"; dưới `lg` là **danh sách mục kiểu cài đặt** | `requireVerifiedAccess()` |
| `/account/profile` | Hồ sơ: họ tên, SĐT, Tỉnh/Thành, ảnh đại diện | như trên |
| `/account/security` | Bảo mật: đổi mật khẩu, đổi email, đăng xuất mọi thiết bị | như trên |
| `/account/library`, `/account/orders` | Thư viện, Đơn hàng — giữ nội dung, vào khung chung | như trên |
| `/account/email/xac-nhan?token=…` | Xác nhận đổi email — **dùng được khi chưa đăng nhập**, `noindex` | không |

- **Layout** `app/account/layout.tsx`: **app shell fluid** (ADR-024 §4.4 — không `container-page`), header hệ thống gọn 64px (logo → trang
  chủ, nhãn "Tài khoản", menu tài khoản). Layout **không gác quyền** (vì trang xác nhận email); mỗi trang tự `requireVerifiedAccess()`.
  Chưa đăng nhập/chưa xác minh → chỉ header, không sidebar.
- **Sidebar** (từ `lg`, `buildAccountNav`): 3 nhóm — **Tài khoản của bạn** (Tổng quan · Hồ sơ · Bảo mật) → **Mua sắm** (Thư viện · Đơn
  hàng, có số đơn chờ) → **Gian hàng của bạn** (chỉ chủ gian hàng; tên gói, nhãn "cần gia hạn" khi `GRACE`/`PAST_DUE`/`EXPIRED`). Lỗi đọc
  dữ liệu sidebar → bỏ nhóm gian hàng, không lỗi trang.
- > ⚠️ Kế hoạch §4.2 B8 / HS-Q11 ghi "header/footer công khai + `container-page`"; code thực hiện **app shell + header gọn** (brief Quốc
  > xác nhận) — KB ghi theo code.

---

## 3. Hồ sơ — `updateProfile` (`apps/web/lib/account-profile.ts`) ✅

| Trường | Quy tắc |
| :-- | :-- |
| `fullName` | Bắt buộc, 1–80 ký tự sau trim |
| `phone` | **Tuỳ chọn** (rỗng = xoá); chuẩn hoá `normalizeVnPhone` về `0XXXXXXXXX` (nhận `+84`/`84`, khoảng trắng, dấu chấm/gạch/ngoặc) |
| `province` | **Tuỳ chọn**; phải thuộc `VN_PROVINCES` (34 đơn vị — `@gieochu/core/account-profile`); ngoại lệ: giữ nguyên giá trị cũ nhập tự do trước ADR-041 để user không bị chặn lưu khi sửa ô khác |

- Lỗi trả theo ô (`fieldErrors`) + `values` để giữ nội dung đã gõ (`AccountActionState`, `apps/web/lib/account-state.ts`); không redirect.
- Ký lại access token khi claim `pc` (hồ sơ đủ) đổi; `revalidatePath("/account", "layout")`.
- **Quyền xem SĐT/Tỉnh (ADR-041 C.1):** chỉ chủ tài khoản + admin; gian hàng **không** thấy. Loader chỉ đọc theo `userId` của phiên ✅. ❓ Hiện
  **chưa có trang System Center nào hiển thị** SĐT/Tỉnh (grep `app/admin` không thấy) — "admin thấy" chưa có giao diện.
- ⚠️ Danh sách 34 tỉnh ghi theo "Nghị quyết 202/2025/QH15" trong comment code — **chưa đối chiếu văn bản chính thức** (chờ chủ dự án, BACKLOG).

### 3.1. Ảnh đại diện (ADR-041 C.3) ✅

- Cloudinary **hệ thống** (thay hướng "R2 `avatars/`" của đặc tả gốc), `public_id` do server sinh `<root>/users/<userId>/avatar/<24 hex>`;
  một chữ ký tạo đúng 1 asset; chỉ user đã xác minh email; 10 chữ ký/giờ/user; incoming transformation `c_limit,w_1024,h_1024`.
- png/jpg/jpeg/webp (không SVG/GIF), **≤ 2 MB** (client kiểm trước; server kiểm lại qua Admin API). Admin API lỗi tạm thời → vẫn lưu (cùng
  cách ADR-028). **Không** tính vào hạn mức ảnh của gói gian hàng.
- GĐ1 **chỉ hiện ở chỗ riêng tư**: menu tài khoản (header công khai, header Studio, `/account`), trang Hồ sơ.
- Cloudinary chưa cấu hình → `CLOUDINARY_NOT_CONFIGURED`. Loader trả cờ `avatarUploadEnabled` (`isSystemCloudinaryUploadEnabled()`,
  `lib/system-cloudinary.ts`); khi `false` UI **ẩn ô tải**, hiện ghi chú, **vẫn cho "Gỡ ảnh"** ảnh đang có ✅ (`avatar-card.tsx`).
- Đổi/gỡ ảnh **không xoá** asset cũ trên Cloudinary (nợ kỹ thuật, BACKLOG); gỡ ảnh không có hoàn tác (BACKLOG). Không audit đổi ảnh.

---

## 4. Bảo mật tài khoản — `apps/web/lib/account-security.ts` ✅

### 4.1. Đổi mật khẩu

- Cần mật khẩu hiện tại; mật khẩu mới ≥ 8 ký tự gồm chữ + số, **khác** mật khẩu cũ.
- Sai mật khẩu hiện tại: 5 lần / 15 phút / user → chặn tạm **thao tác này** (không khoá đăng nhập như login).
- Thành công (một transaction): đổi hash + thu hồi mọi refresh token **trừ họ phiên hiện tại** (`familyId` trong access token); email
  `password_changed`; audit `AUTH_PASSWORD_CHANGED` (metadata `revokedOtherSessions`).

### 4.2. Đổi email đăng nhập

1. **Yêu cầu** (`requestEmailChange`): `newEmail` + mật khẩu hiện tại; email mới phải khác email hiện tại và **chưa thuộc tài khoản khác**
   (báo rõ `EMAIL_TAKEN`); 3 lần/giờ/user (gộp với "Gửi lại"). Tạo token `EMAIL_CHANGE` (hash SHA-256, `newEmail` lưu ở
   `verification_tokens.newEmail`, TTL = `emailVerifyTtlHours` của System Center); **yêu cầu mới huỷ yêu cầu cũ**. Email
   `email_change_verify` tới **email mới** (link `/account/email/xac-nhan?token=…`) + `email_change_requested` báo **email cũ**. Audit
   `AUTH_EMAIL_CHANGE_REQUESTED` (email đã che). Email cũ vẫn đăng nhập được tới khi xác nhận.
2. **Gửi lại / Huỷ**: gửi lại sinh token mới (cũ vô hiệu); huỷ xoá token (link đã gửi thành không hợp lệ).
3. **Xác nhận** (`confirmEmailChange`, **không cần đăng nhập**): GET chỉ hiển thị trạng thái token (`valid`/`expired`/`used`/`invalid`), xác
   nhận bằng nút (POST). 20 lần/15 phút/IP. Một transaction: đánh dấu token đã dùng (điều kiện `usedAt IS NULL` — hai lần bấm song song chỉ
   một lần thắng), đổi `User.email` + `emailVerifiedAt = now`, **thu hồi mọi refresh token**, xoá yêu cầu đổi email khác, **vô hiệu token
   `PASSWORD_RESET`/`EMAIL_VERIFY` chưa dùng** (link gửi về email cũ không dùng được nữa). Email mới vừa bị tài khoản khác chiếm (unique,
   kể cả race) → huỷ yêu cầu, `EMAIL_TAKEN`. Tài khoản `LOCKED` → `ACCOUNT_LOCKED`. Sau đó: audit `AUTH_EMAIL_CHANGED` (from/to đã che),
   email `email_changed` tới **email cũ**, xoá cookie nếu trình duyệt đang đăng nhập đúng tài khoản → phải đăng nhập lại bằng email mới.

> ⚠️ ADR-041 C.2 ghi đổi email "thu hồi **phiên khác**"; code thu hồi **mọi** phiên (kể cả phiên hiện tại, buộc đăng nhập lại). Chặt hơn
> ADR, không trái tinh thần "bảo mật chặt" — ghi KB-Audit §21, chờ Quốc xác nhận.

- Hệ quả đã chấp nhận (ADR-041 C.2a): đơn hàng không lưu bản chụp email → Studio các gian hàng từng bán cho user thấy email mới.

### 4.3. Đăng xuất mọi thiết bị

`logoutAllDevicesAction` (`requireUser()`): thu hồi mọi refresh token, xoá cookie `at` và `rt` (`Path=/api/auth`), về `/login`. Không ghi audit.

**Từ ADR-053 (2026-10-24) ✅ code:** phía trên nút này có **danh sách thiết bị đang đăng nhập** (`SessionList`, loader `listAccountSessions`) — nhãn thiết bị
từ User-Agent, lúc đăng nhập, hoạt động gần nhất, IP, "Đã ghi nhớ", badge "Thiết bị này" — và nút **Đăng xuất từng thiết bị** (`revokeSessionAction`,
`requireUser()`, kiểm quyền sở hữu theo `userId`, không audit). Mỗi thẻ có icon theo `deviceKind` (`desktop`/`mobile`/`tablet`, suy từ User-Agent).
Đăng xuất **chính thiết bị này**: action xoá cookie và trả `{ signedOut: true }`, client **điều hướng cứng** về `/login` (không còn `redirect()` ở server);
thiết bị khác: trả `{ signedOut: false }`, thẻ biến mất sau revalidate ✅ code 2026-10-24. Chi tiết: [[02-System-Specs/Auth-Session-Specs|Auth-Session-Specs]] §7.

### 4.4. Giới hạn đã biết

- Thu hồi phiên = thu hồi refresh token; **access token đã cấp vẫn sống tới hết TTL** (`accessTokenTtlMinutes`, mặc định 15 phút) — cùng giới
  hạn với đặt lại mật khẩu (BACKLOG). Từ ADR-053 TTL access bị kẹp ≤ thời gian idle của phiên ([[02-System-Specs/Auth-Session-Specs|Auth-Session-Specs]] §2).
- Rate limit nằm **trong bộ nhớ** từng instance (`checkRateLimit`) — trên Vercel nhiều instance không chia sẻ bộ đếm (BACKLOG).

---

## 5. Thẻ "Gian hàng của bạn" và menu tài khoản ✅

- `getAccountOverview(user)` (C1): email, họ tên, SĐT, tỉnh, ảnh, `avatarUploadEnabled`, yêu cầu đổi email đang chờ, `ownedTenant` (tên,
  slug, logo, gói, `subscriptionStatus`, kỳ hạn, ân hạn, mức dùng sản phẩm/dung lượng theo `describePlanLimit`/`formatPlanLimit` — `-1`
  không vẽ thanh %), số tài liệu trong thư viện, số đơn chờ thanh toán của chính user. Bản cache theo request `getCachedAccountOverview()`
  (React `cache()`, dùng chung cho layout + trang) ✅.
- **Bất biến "tenant luôn có subscription"** ✅: gian hàng không có `Subscription` → **không fallback**, chỉ `logger.warn` (`account: tenant không
  có subscription`); DB hiện 0 vi phạm 🟡 (Quốc báo, Long không chạy truy vấn).
- Thẻ dẫn tới Billing (`/studio/{slug}/billing`, có `?plan=`) hoặc `/pricing` ("So sánh các gói"); khách chưa có gian hàng thấy thẻ "Mở gian
  hàng miễn phí" → `/studio`. Không dựng lại form gia hạn trong `/account` — Billing Studio là nơi duy nhất (ADR-021).
- **Menu tài khoản** (`app/_ui/account-menu.tsx`): ảnh đại diện + họ tên, dạng **disclosure** (`aria-expanded`/`aria-controls`, không
  `role="menu"`); dùng ở `SiteHeader` (`variant="site"`) và header app shell **System Center** (từ ADR-042) + Studio + `/account`
  (`variant="app"`) — mục Hồ sơ, Bảo mật, Thư viện, Về trang chủ, **Đăng xuất**. Dữ liệu header `getAccountHeaderData(userId)` (C7, chỉ của
  chính user).
- **Đăng xuất đi đâu (ADR-042 ✅ code 2026-10-17):** System Center và Studio → `/login` (prop `logoutRedirect="/login"` của `AccountMenu`, và nút
  Đăng xuất cố định đáy sidebar `LogoutButton redirectTo="/login"`); trang công khai (`SiteHeader`) và `/account` (menu + `LogoutButton` mặc
  định) → `/`. Cả hai nút gọi cùng `POST /api/auth/logout`. Đăng xuất thật qua UI có đăng nhập chưa kiểm ❓. Từ ADR-053 cả hai chuyển trang bằng
  **điều hướng cứng** `window.location.assign` (xoá client cache — sửa lỗi header còn tên/email phiên cũ) ✅ code.
  Quyết định: [[01-Architecture-Decisions/ADR-028-Shared-App-Sidebar-Logout-Mobile-Drawer|ADR-028 KB (≙ ADR-042)]].

---

## 6. Email mới (`packages/email/src/templates/account-security.ts`) ✅

| Loại (`EmailSendLog.type`) | Người nhận | Khi |
| :-- | :-- | :-- |
| `password_changed` | email hiện tại | Đổi mật khẩu thành công |
| `email_change_verify` | **email mới** | Yêu cầu / gửi lại đổi email (link xác nhận) |
| `email_change_requested` | email cũ | Có yêu cầu đổi email |
| `email_changed` | **email cũ** | Đã đổi xong (email mới đã che, kèm email hỗ trợ nếu có) |

Gửi đồng bộ qua `sendEmailNow`, lỗi gửi không làm hỏng thao tác. 🟡 Kiểm dữ liệu thật dùng email mock — **chưa** gửi qua SMTP thật ❓.

---

## 7. Kiểm thử

- **Test:** không thêm (ADR-041; **93/94 unit, 54/55 integration** ✅ Long chạy 2026-10-17). Nợ test đổi mật khẩu (giữ phiên hiện tại, thu
  hồi phiên khác), đổi email (hết hạn/đã dùng/email bị chiếm) → `docs/BACKLOG.md`.
- **Dữ liệu thật** 🟡 (Hiếu 2026-10-17, gọi lib trực tiếp, email mock, đã dọn): đổi mật khẩu giữ phiên hiện tại/thu hồi phiên khác; đổi email
  `EMAIL_TAKEN`/`TOKEN_USED`, thu hồi phiên, vô hiệu token reset cũ. **Chưa** kiểm qua UI có đăng nhập ❓; chưa thử hai trình duyệt thật ❓.

---

## 8. Liên kết

* [[02-System-Specs/User-Management-System-Center-Specs|User-Management-System-Center-Specs]] — refresh-token rotation, khoá user ([User-Management-System-Center-Specs.md](./User-Management-System-Center-Specs.md))
* [[02-System-Specs/Auth-Session-Specs|Auth-Session-Specs]] — phiên đăng nhập, danh sách thiết bị (ADR-053) ([Auth-Session-Specs.md](./Auth-Session-Specs.md))
* [[02-System-Specs/Pricing-Page-Specs|Pricing-Page-Specs]] ([Pricing-Page-Specs.md](./Pricing-Page-Specs.md)) · [[02-System-Specs/Payment-And-Billing|Payment-And-Billing]] §5A–§5B ([Payment-And-Billing.md](./Payment-And-Billing.md))
* [[02-System-Specs/Audit-Log-Specs|Audit-Log-Specs]] §4 ([Audit-Log-Specs.md](./Audit-Log-Specs.md))
* [[03-API-Contracts/Endpoint-Directory|Endpoint-Directory]] §21.4 ([Endpoint-Directory.md](../03-API-Contracts/Endpoint-Directory.md)) · [[03-API-Contracts/Database-Schema-Reference|Database-Schema-Reference]] ([Database-Schema-Reference.md](../03-API-Contracts/Database-Schema-Reference.md))
* [[04-Operations-Runbooks/UI-Design-System|UI-Design-System]] §18 ([UI-Design-System.md](../04-Operations-Runbooks/UI-Design-System.md))
* Mã nguồn: `packages/core/src/account/profile.ts`, `apps/web/lib/{account-profile,account-security,account-state}.ts`, `apps/web/app/account/**`,
  `apps/web/app/_ui/{account-menu,account-avatar}.tsx`, `packages/email/src/templates/account-security.ts`,
  `packages/db/prisma/migrations/20261017090000_adr041_email_change/migration.sql`

*Quay lại: [[MOC-Home]] (../00-Index/MOC-Home.md)*

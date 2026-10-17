# Đề xuất trang "Hồ sơ" cho khách hàng và chủ gian hàng — UX + dữ liệu trước, UI sau

- **Người viết:** Phong (UX/UI) · **Ngày:** 2026-10-17 · **Trạng thái:** ĐỀ XUẤT, chưa code, chờ chủ dự án chốt các câu hỏi ở §7.
- **Phạm vi:** khu vực tài khoản cá nhân `/account/**` (L3, mọi `User`) và cách chủ gian hàng (L2, Studio `/studio/[tenantSlug]/**`)
  đi vào hồ sơ cá nhân + cài đặt gian hàng. Ảnh mẫu chủ dự án gửi ("Account": nhóm *Your account* + nhóm *Workspace*, khối
  ảnh đại diện, họ tên, email + "Edit Email", mật khẩu + "Change Password", chân trang Cancel/Save) là **tham chiếu bố cục**, không
  phải danh sách tính năng phải làm.
- **Nguyên tắc chủ dự án (CLAUDE.md, 2026-10-17):** UX trước UI; kế hoạch bắt đầu bằng luồng UX + mô hình dữ liệu. Trang hồ sơ
  là **dữ liệu của người dùng** (không phải nội dung marketing) nên "CMS trước" ở đây hiểu là: **GĐ1 = dữ liệu + Server Action +
  quy tắc nghiệp vụ (Hiếu)**, **GĐ2 = giao diện (Phong)**. Không có chữ/nhãn nghiệp vụ nào cần admin chỉnh qua CMS.
- **Căn cứ:** ADR-008, ADR-021, ADR-022, ADR-024, ADR-028, ADR-032, ADR-037; `UI-Design-System.md` §1, §4.4, §5, §9.9, §14.6;
  `docs/de-xuat-trang-bang-gia-2026-10-17.md`; code hiện trạng (§1, chỉ đọc).
- Tên nền tảng trong văn bản ghi là `{tên nền tảng}` (đọc `getEffectiveBrand()`, ADR-032).

---

## 1. Hiện trạng (đọc code 2026-10-17)

### 1.1. Khu vực khách hàng `/account/**`

| Route | File | Có gì | Ghi chú |
|---|---|---|---|
| `/account` | — | **Không có trang** (404) | Không có `layout.tsx` chung |
| `/account/profile` | `account/profile/page.tsx` + `actions.ts` | Form 3 ô: Họ và tên, Số điện thoại, Tỉnh/Thành phố. Lưu → cập nhật `UserProfile`, tính lại `profileCompletedAt`, **ký lại access token** (claim `pc`), redirect | Lỗi qua `?error=1` (1 câu chung). Không hiện email, không có ảnh đại diện |
| `/account/security` | `account/security/page.tsx` + `actions.ts` | (a) Đổi mật khẩu: mật khẩu hiện tại + mật khẩu mới; (b) "Đăng xuất mọi thiết bị" (thu hồi mọi refresh token kể cả phiên hiện tại → về `/login`) | Lỗi/thành công qua query `?error=`/`?success=`. Input thường, **không** nút hiện/ẩn mật khẩu, không `autocomplete` |
| `/account/library` | `account/library/**` | Thư viện tài liệu đã mua theo gian hàng, loading/error, khối quyền lợi người mua (ADR-039) | Đã chỉnh UI kỹ (M12c) |
| `/account/orders` | `account/orders/page.tsx` | Danh sách đơn, mở lại checkout cho đơn PENDING | Rỗng chỉ 1 dòng chữ |

Điểm vào hiện có: `AccountMenu` ở header trang công khai (`app/_ui/account-menu.tsx`) — "Hồ sơ của tôi", "Tài liệu đã mua",
"Đơn hàng của tôi", Đăng xuất; với chủ gian hàng thêm "Quản lý gian hàng" (từ `resolveLandingPath`). **Không có mục "Bảo mật"**.

### 1.2. Định danh, xác thực (`packages/auth`, `apps/web/lib`, `app/api/auth/**`)

| Hạng mục | Hiện trạng |
|---|---|
| Model `User` | `email` (unique, chuẩn hoá lowercase), `passwordHash`, `systemRole`, `status`, `emailVerifiedAt`, `profileCompletedAt`, `lastLoginAt`, `failedLoginAttempts`, `passwordResetRequired`. Quan hệ `ownedTenant` (**1 user sở hữu tối đa 1 gian hàng** — `Tenant.ownerId @unique`) |
| Model `UserProfile` (ADR-008) | `fullName` (bắt buộc), `phone?`, `province?`, **`avatarKey?` (có cột, chưa dùng ở đâu)**, `occupation?` (bỏ dùng), `consentAt` |
| Đăng ký | Chọn loại tài khoản `TENANT`/`CUSTOMER` — chỉ quyết định trang đích sau xác minh (`/studio` hay `/`), **không lưu** thành vai trò |
| Xác minh email | `VerificationToken` loại `EMAIL_VERIFY` (hash SHA-256, TTL từ `getSystemSettings()`), gửi lại được |
| Quên/đặt lại mật khẩu | `PASSWORD_RESET`; đặt lại thành công → **thu hồi mọi refresh token** + xoá cờ khoá |
| Đổi mật khẩu (đã đăng nhập) | Kiểm mật khẩu cũ (argon2), kiểm độ mạnh `isValidPassword`. **Không** thu hồi phiên khác, **không** email báo, **không** ghi audit |
| Đổi email | **Chưa có** (không loại token, không cột lưu email mới, không route) |
| Phiên đăng nhập | `RefreshToken` có `familyId`, `userAgent`, `ip`, `createdAt` — đủ dữ liệu để liệt kê phiên, nhưng UI chỉ có "đăng xuất mọi thiết bị" |
| Audit (ADR-037) | Chỉ có `AUTH_LOGIN`, `AUTH_LOGIN_FAILED`, `AUTH_REFRESH_REUSE` — chưa có sự kiện đổi mật khẩu/email |
| Ảnh đại diện | **Chưa làm** (PLAN M1: "Avatar upload chưa làm — phụ thuộc storage"). Đặc tả gốc §M1 ghi "upload qua M5 storage helper, prefix `avatars/`" — đã cũ so với ADR-028 (ảnh đi Cloudinary hệ thống) |
| Email người dùng nhận | Khách: `order_paid`, `entitlement_remedy_customer`, `abuse_report_resolved`, xác minh/đặt lại. Chủ gian hàng: `new_sale`, `review_new`, `storefront_message`, `product_file_rejected`, `content_moderated`, `remedy_refund_requested`, email hoá đơn gói. **Tất cả gửi tới `User.email` hiện tại** (đơn hàng không lưu bản chụp email) |

### 1.3. Studio của chủ gian hàng

| Route | Có gì |
|---|---|
| `/studio/[slug]/settings` | "Cài đặt trang": `BrandingForm` (tên, giới thiệu, màu, mạng xã hội) + `SlugForm` (đổi đường dẫn ≤1 lần/30 ngày) + link "Cấu hình thanh toán →" |
| `/studio/[slug]/settings/payments` | Cấu hình nhận tiền: QR thủ công / SePay / MoMo (secret che `••••abcd`) |
| `/studio/[slug]/billing` | Gói hiện tại, thanh hạn mức (cảnh báo 80%), gia hạn/nâng cấp, hoá đơn chờ, lịch sử hoá đơn |
| `/studio/[slug]/activity` | Nhật ký (chỉ OWNER) |
| Thành viên / nhân viên | **Không có** — `TenantMemberRole.STAFF` có trong schema nhưng không luồng nào tạo (PLAN, `landing-path.ts`) |
| Tên miền riêng | **Không có** nghiệp vụ |
| Header Studio | Vòng tròn chữ cái đầu + email, **không bấm được**; **không có nút Đăng xuất**, không link tới hồ sơ cá nhân |

### 1.4. Thiếu gì / vấn đề phát hiện

| # | Vấn đề | Mức | Hướng xử lý |
|---|---|---|---|
| H1 | `/account/*` không có layout chung: **không header, không điều hướng giữa các trang, không nút về trang chủ**; font không nạp `--font-heading/--font-body` như Studio | Cao | Layout tài khoản (§3.1) |
| H2 | `/account` trả 404; mục "Bảo mật" không có trong `AccountMenu` → người dùng khó tìm đổi mật khẩu | Cao | Trang tổng quan + sidebar |
| H3 | Form hồ sơ đặt `required` cho SĐT và Tỉnh/Thành, trong khi schema/comment nói **tự nguyện** (ADR-008, `isProfileComplete` không còn chặn) | Trung bình | Q3 — chốt bắt buộc hay tuỳ chọn |
| H4 | Đổi mật khẩu không thu hồi phiên khác, không email báo, không audit — khác hẳn luồng đặt lại mật khẩu | Cao (bảo mật) | Q5, contract C3 |
| H5 | Chưa có đổi email; email là định danh đăng nhập và là địa chỉ nhận mọi thông báo | Trung bình | Luồng §3.4, Q4 |
| H6 | `avatarKey` có cột nhưng không có luồng; đặc tả cũ chỉ R2 `avatars/`, ADR-028 chỉ nói ảnh **của tenant** | Trung bình | Q6, cần ADR bổ sung |
| H7 | Phản hồi form bằng query string + redirect → mất nội dung đã gõ khi lỗi, thông báo lỗi chung chung, không gắn vào ô | Trung bình | Chuyển sang `useActionState` trả state (C1–C3) |
| H8 | Studio không có điều hướng dưới `lg` (sidebar `hidden lg:flex`, không menu mobile) và không có Đăng xuất | Cao (ngoài phạm vi trang hồ sơ nhưng chặn luồng "chủ gian hàng vào hồ sơ trên điện thoại") | Đề xuất task riêng, xem §2.4 |
| H9 | Màu `#0F3B82`, `#E5E7EB`… hard-code trong `account-menu.tsx`, `studio/layout.tsx`, `settings/page.tsx` | Thấp | Thay bằng token khi làm GĐ2 chạm tới |

---

## 2. UX trước — kiến trúc thông tin hai vai

### 2.1. Nguyên tắc chính

1. **Một người — một hồ sơ cá nhân.** Mọi `User` (khách, chủ gian hàng, cả hai) có đúng **một** khu vực tài khoản `/account/**`:
   họ tên, ảnh đại diện, email đăng nhập, mật khẩu, phiên đăng nhập. Studio **không** có bản sao các mục này.
2. **Gian hàng là thứ khác.** Thông tin gian hàng (tên, logo, đường dẫn, thanh toán nhận tiền, gói dịch vụ) sống ở Studio, như hiện nay.
   Khu vực tài khoản chỉ **liên kết sang** Studio, không dựng lại form (tránh hai nơi sửa một dữ liệu).
3. Giống ảnh mẫu ở **hình thức**: sidebar 2 nhóm "Tài khoản của bạn" + nhóm thứ hai. Khác ảnh mẫu ở **nội dung**: chỉ đưa mục có
   nghiệp vụ thật.

### 2.2. Đối chiếu mục trong ảnh mẫu với nghiệp vụ Gieo Chữ

| Mục ảnh mẫu | Gieo Chữ | Quyết định đề xuất |
|---|---|---|
| Profile | Họ tên, ảnh đại diện, SĐT, tỉnh/thành, email (chỉ đọc + nút đổi) | **Làm GĐ này** |
| Preferences | Không có cài đặt ngôn ngữ/giao diện (một ngôn ngữ, một múi giờ cố định) | **Không làm** |
| Notifications | Email khách nhận đều là **giao dịch** (đơn đã thanh toán, quyền lợi người mua) — không được phép tắt. Chủ gian hàng có 3 loại có thể tắt: đơn mới, đánh giá mới, tin nhắn từ trang bán hàng | Khách: **không làm**. Chủ gian hàng: **để sau**, chỉ làm nếu chủ dự án muốn (Q8) |
| Referrals | Không có chương trình giới thiệu | **Không làm** |
| Blocklist | Không có tính năng chặn người dùng | **Không làm** |
| (bổ sung) Bảo mật | Đổi mật khẩu, đổi email, đăng xuất thiết bị | **Làm GĐ này** |
| (bổ sung) Thư viện, Đơn hàng | Đã có | Đưa vào sidebar nhóm "Mua sắm" |
| Workspace › General | Studio › Cài đặt (thương hiệu, đường dẫn) | Link sang Studio |
| Workspace › Members / Groups | STAFF chưa có luồng | **Không làm** (không hiện mục rỗng) |
| Workspace › Phone numbers / Integrations | Không có nghiệp vụ | **Không làm** |
| Workspace › Contacts | Studio › Khách hàng đã có | Không lặp — vẫn ở Studio |
| Workspace › Plan & billing | Studio › Gói dịch vụ | Link sang Studio + thẻ tóm tắt (§5) |
| (bổ sung) Thanh toán nhận tiền | Studio › Cài đặt › Thanh toán | Link sang Studio |
| Tên miền | Không có nghiệp vụ | **Không làm** |

### 2.3. Sidebar khu vực tài khoản `/account`

```
TÀI KHOẢN CỦA BẠN
  Tổng quan            /account                (mới)
  Hồ sơ                /account/profile
  Bảo mật              /account/security       (mật khẩu, email đăng nhập, phiên)
MUA SẮM
  Thư viện tài liệu    /account/library
  Đơn hàng             /account/orders
GIAN HÀNG CỦA BẠN      ← chỉ hiện khi user sở hữu gian hàng
  Vào Studio           /studio/{slug}                    (icon "mở trong Studio")
  Thông tin gian hàng  /studio/{slug}/settings
  Nhận thanh toán      /studio/{slug}/settings/payments
  Gói dịch vụ          /studio/{slug}/billing           (kèm nhãn tên gói, vd "Free")
───────────
  Đăng xuất            (tách riêng cuối sidebar — skill `destructive-nav-separation`)
```

- Người **chưa có gian hàng**: nhóm thứ ba thay bằng một thẻ nhỏ "Bạn là giáo viên/coach? **Mở gian hàng miễn phí** → `/studio`"
  (giống CTA "Mở gian hàng" của `/cua-hang`, đã ẩn với chủ gian hàng). Hiện hay không — Q9.
- Mục dẫn sang Studio có icon `IconExternalLink`-kiểu "đi tới khu vực khác" + chữ phụ ẩn cho trình đọc màn hình "(trong Studio)",
  để người dùng biết sẽ đổi khu vực (skill `navigation-consistency`, `back-behavior`). Mở **cùng tab** (không `target=_blank`).
- Mục hiện tại: `aria-current="page"` + nền + vạch trái (không chỉ màu — `color-not-only`, `nav-state-active`).

### 2.4. Chủ gian hàng vào hồ sơ ở đâu — và điều hướng giữa hai vai

| Từ đâu | Đi tới hồ sơ | Đi tới Studio |
|---|---|---|
| Header trang công khai (`AccountMenu`) | "Hồ sơ của tôi" (có sẵn) + thêm "Bảo mật" | "Quản lý gian hàng" (có sẵn) |
| Khu vực `/account` | — | Nhóm "Gian hàng của bạn" trong sidebar |
| Header Studio | **Mới:** biến avatar + email thành nút mở menu tài khoản (tái dùng hành vi `AccountMenu`): "Hồ sơ cá nhân", "Bảo mật", "Thư viện của tôi", —, "Về trang chủ", —, "Đăng xuất" | — |

- Một user vừa mua vừa bán: **không** cần "chuyển vai". Hai khu vực luôn cách nhau một cú bấm qua menu tài khoản; dữ liệu cá nhân
  chỉ một bản. Nhãn menu dùng "Hồ sơ cá nhân" (trong Studio) để phân biệt rõ với "Cài đặt gian hàng".
- Studio giữ nguyên sidebar hiện tại. Đổi tên mục "Cài đặt" → **"Cài đặt gian hàng"** và trang `settings` đổi tiêu đề "Cài đặt trang"
  → "Cài đặt gian hàng" để không lẫn với cài đặt tài khoản. Trong trang này thêm thanh tab phụ: **Thông tin chung** · **Nhận thanh toán**
  (thay link chữ "Cấu hình thanh toán →" ở cuối trang hiện nay). "Gói dịch vụ" giữ là mục sidebar riêng như hiện tại.
- **H8 (Studio không có menu mobile, không Đăng xuất)** là điều kiện để luồng trên chạy được trên điện thoại. Đề xuất Quốc tách thành
  task UI riêng (Phong): menu mobile Studio tái dùng mẫu `MobileNav` (§14.6) + menu tài khoản ở header.

### 2.5. Hành trình chính

```
A. Khách đổi tên/ảnh:  Header › avatar › Hồ sơ của tôi → /account/profile → sửa → [Lưu thay đổi] → thông báo "Đã lưu" tại chỗ
B. Khách đổi mật khẩu: Header › Bảo mật → /account/security#mat-khau → nhập cũ + mới → [Đổi mật khẩu]
                       → "Đã đổi. Các thiết bị khác đã bị đăng xuất." (nếu Q5 = có)
C. Đổi email:          /account/security#email → email mới + mật khẩu hiện tại → [Gửi link xác minh]
                       → trạng thái "Đang chờ xác minh new@…" (Gửi lại / Huỷ) → mở email mới, bấm link
                       → /account/security?email=changed → "Email đăng nhập đã đổi thành new@…"
D. Chủ gian hàng:      Studio › avatar header › Hồ sơ cá nhân → /account/profile (thấy thẻ "Gian hàng của bạn", §5)
                       → [Quản lý gói] → /studio/{slug}/billing  hoặc  [So sánh các gói] → /pricing
```

---

## 3. Từng màn hình

### 3.1. Khung chung `/account/layout.tsx` (mới)

- **Chrome:** `SiteHeader` + `SiteFooter` của trang công khai (khách quen giao diện cửa hàng; có sẵn menu tài khoản, logo, nút về trang chủ).
  Không dùng khung tối màu của Studio — khách hàng không phải người quản trị.
- **Độ rộng:** ADR-024 xếp `/account` vào nhóm app shell "fluid theo sidebar". Vì `/account` dùng header công khai, đề xuất bọc bằng
  `container-page` (1280px) và chia lưới bên trong: sidebar 240px + nội dung (form giới hạn `max-w-2xl`). **Cần Quốc xác nhận** đây là
  ngoại lệ hợp lệ của ADR-024 hoặc ghi bổ sung (Q11).
- **Desktop ≥1024px:** sidebar trái cố định theo trang (không `sticky` đè nội dung), nội dung phải.
- **Mobile <1024px:** ẩn sidebar. `/account` (Tổng quan) hiển thị chính danh sách nhóm mục như màn hình cài đặt của điện thoại (mỗi dòng
  ≥44px, chữ + icon + mũi tên). Mỗi trang con có link quay lại "← Tài khoản" ở đầu trang. Không dùng dải tab cuộn ngang (khó thấy mục
  bị khuất, skill `horizontal-scroll`, `adaptive-navigation`). Mỗi trang con có URL riêng (`deep-linking`).
- Font: nạp `--font-heading`/`--font-body` (Be Vietnam Pro / Inter, `subsets: ["latin","vietnamese"]`) như Studio.
- Thành phần: tái dùng `ConfigCard`/`TextField`/`PasswordField`/`PrimaryButton`/`GhostButton`/`FormBanner`/`Badge`/`EmptyState`/`Notice`
  từ `admin/_ui/kit.tsx`, `ImageUploadField` cho ảnh đại diện. Mới: `AccountSidebarNav` (client, nhận icon bằng **key chuỗi** như
  `TenantSidebarNav` — §8.5) đặt ở `app/account/_ui/`.

### 3.2. Tổng quan `/account` (mới)

| Khối | Nội dung | Ghi chú |
|---|---|---|
| Đầu trang | H1 "Tài khoản của bạn", avatar 56px + họ tên + email | Avatar trống → vòng tròn chữ cái đầu |
| Gợi ý hồ sơ (tuỳ chọn) | `Notice` "Thêm số điện thoại để gian hàng liên hệ khi cần" nếu `pc=false` | Chỉ khi Q3 giữ SĐT; không chặn |
| Mobile | Danh sách nhóm mục (§2.3) | Desktop ẩn khối này (sidebar đã có) |
| Gian hàng của bạn | Thẻ tóm tắt gói (§5) | Chỉ chủ gian hàng |
| Lối tắt | "Thư viện: N tài liệu" · "Đơn chờ thanh toán: N" (nếu > 0) | Số liệu L3 của chính user |

### 3.3. Hồ sơ `/account/profile`

Bố cục theo ảnh mẫu, một cột, 3 khối có tiêu đề H2, nút ở chân:

```
H1 Hồ sơ
┌ Ảnh đại diện ─────────────────────────────────────┐
│ (ảnh 80px tròn)  [Tải ảnh lên]  [Gỡ ảnh]           │
│ PNG, JPEG hoặc WebP, tối đa 2 MB. Ảnh được cắt vuông.│
├ Thông tin cá nhân ────────────────────────────────┤
│ Họ và tên *        [Nguyễn Thị Lan        ]        │
│ Số điện thoại      [0912 345 678          ]  (tuỳ chọn — Q3)
│ Tỉnh / Thành phố   [Hà Nội ▾              ]  (tuỳ chọn — Q3)
├ Email đăng nhập ──────────────────────────────────┤
│ lan@example.com   ✓ Đã xác minh   [Đổi email] → /account/security#email
│ Dùng để đăng nhập và nhận thông báo đơn hàng.      │
└───────────────────────────────────────────────────┘
                         [Hoàn tác]  [Lưu thay đổi]
```

| Phần tử | Quy tắc |
|---|---|
| Họ và tên | **Một ô gộp** (giữ `fullName` — tên tiếng Việt không tách Họ/Tên như ảnh mẫu; tách sẽ phải migrate và hỏi lại cách ghép). 1–80 ký tự, trim; `autocomplete="name"`. Hiển thị dấu tiếng Việt đúng |
| Số điện thoại | `type="tel"`, `inputmode="tel"`, `autocomplete="tel"`; chuẩn hoá số VN (10 số, đầu 0 hoặc +84). **Dữ liệu cá nhân** |
| Tỉnh/Thành phố | `<select>` danh sách 34 tỉnh/thành sau sáp nhập (nguồn danh sách: hằng trong `@gieochu/core`, **Q3**) thay vì ô tự do. **Dữ liệu cá nhân** |
| Email | Chỉ đọc. Badge "Đã xác minh" (chữ + icon, không chỉ màu). Nếu đang có yêu cầu đổi email: dòng phụ "Đang chờ xác minh new@…" |
| Ảnh đại diện | Upload **ngay khi chọn file** (giống `ImageUploadField`), không đợi nút Lưu; "Gỡ ảnh" có xác nhận nhẹ (nút hoàn tác trong thông báo — `undo-support`). Định dạng/dung lượng: §4.3 |
| Lưu thay đổi | Nút chính duy nhất (`primary-action`), chỉ bật khi form có thay đổi; trong lúc gửi: disabled + "Đang lưu…" |
| Hoàn tác | Thay cho "Cancel" của ảnh mẫu: trả form về giá trị đã lưu, chỉ bật khi có thay đổi. Không điều hướng đi đâu |
| Rời trang khi chưa lưu | Cảnh báo `beforeunload` (tuỳ chọn, GĐ2) |

**Trạng thái:** loading — skeleton 3 khối (`loading.tsx`, giữ chỗ tránh CLS); thành công — `FormBanner` `role="status"` "Đã lưu hồ sơ";
lỗi trường — dưới ô, `aria-describedby`, giữ nguyên nội dung đã gõ; lỗi chung — `FormBanner` `role="alert"` + focus vào banner;
lỗi tải dữ liệu — `error.tsx` có nút "Thử lại"; Cloudinary hệ thống chưa cấu hình — khối ảnh hiện "Tính năng ảnh đại diện tạm chưa
dùng được" và ẩn nút tải (không lỗi trang).

### 3.4. Bảo mật `/account/security`

Ba khối có neo `#mat-khau`, `#email`, `#phien` (deep link từ Hồ sơ và menu):

**a) Đổi mật khẩu**

| Ô | Thuộc tính |
|---|---|
| Mật khẩu hiện tại | `PasswordField` có nút hiện/ẩn (`aria-label` "Hiện mật khẩu", `aria-pressed`), `autocomplete="current-password"`, cho phép dán (skill `accessible-authentication`) |
| Mật khẩu mới | `autocomplete="new-password"`, gợi ý cố định dưới ô "Ít nhất 8 ký tự, gồm cả chữ và số" (khớp `isValidPassword`). Không thêm ô "nhập lại" — đã có nút hiện/ẩn, giống form đăng ký |

Quy tắc: sai mật khẩu cũ → lỗi dưới ô "Mật khẩu hiện tại không đúng"; mật khẩu mới trùng mật khẩu cũ → từ chối; thành công →
**giữ phiên hiện tại, thu hồi mọi phiên khác** (Q5), gửi email "Mật khẩu vừa được đổi — nếu không phải bạn, đặt lại tại /forgot-password",
ghi audit. Nên giới hạn số lần sai mật khẩu cũ (dùng `rate-limit.ts`) — sai nhiều lần ở đây không nên khoá đăng nhập như login.

**b) Email đăng nhập**

```
Email hiện tại: lan@example.com  ✓ Đã xác minh
Email mới *            [                    ]
Mật khẩu hiện tại *    [••••••••       👁]   (xác nhận lại danh tính)
                               [Gửi link xác minh]
```

| Bước | Quy tắc đề xuất |
|---|---|
| Gửi yêu cầu | Chuẩn hoá email; khác email hiện tại; kiểm mật khẩu; rate-limit (vd 3 lần/giờ). Email đã thuộc tài khoản khác → báo "Email này đã được dùng cho một tài khoản khác" (người dùng đã xác thực + có rate-limit nên rủi ro dò email thấp — **Q4c**) |
| Token | `VerificationToken` loại mới `EMAIL_CHANGE`, lưu hash SHA-256, TTL = "Link xác minh email (giờ)" trong `getSystemSettings()`; một yêu cầu mới huỷ yêu cầu cũ |
| Email | Gửi link tới **email mới**; gửi thông báo tới **email cũ** "Có yêu cầu đổi email sang n***@…; nếu không phải bạn, đổi mật khẩu ngay" |
| Chờ xác minh | Khối hiện "Đang chờ xác minh **new@…** (hết hạn lúc HH:mm dd/MM, giờ VN)" + [Gửi lại] + [Huỷ yêu cầu]. **Email cũ vẫn dùng để đăng nhập** tới khi xác minh xong |
| Xác minh | Link mở trang xác nhận (có nút bấm "Xác nhận đổi email", tránh trình quét link trong hộp thư tự kích hoạt); kiểm lại email mới vẫn trống → cập nhật `User.email`, `emailVerifiedAt = now`, đánh dấu token đã dùng, thu hồi phiên khác (Q4b), ghi audit, gửi thư xác nhận tới email cũ |
| Lỗi | Token hết hạn/đã dùng → trang báo lỗi + nút "Gửi lại từ trang Bảo mật"; email mới vừa bị người khác đăng ký → báo và huỷ yêu cầu |

Tác động nghiệp vụ cần chủ dự án biết (Q4a): đơn hàng **không lưu bản chụp email** — sau khi đổi, Studio của mọi gian hàng từng bán cho
user sẽ thấy email mới ở trang Khách hàng/đơn cũ; mọi thông báo (đơn mới, hoá đơn gói…) chuyển sang email mới.

**c) Phiên đăng nhập**

- GĐ này: giữ nút "Đăng xuất mọi thiết bị" (khối tách riêng, viền đỏ — `destructive-emphasis`), thêm hộp thoại xác nhận
  ("Bạn sẽ bị đăng xuất cả trên thiết bị này") — `confirmation-dialogs`.
- Để sau (Q10): danh sách phiên (trình duyệt/HĐH rút từ `userAgent`, thời điểm tạo, "Thiết bị này") + đăng xuất từng phiên. IP là **dữ liệu cá nhân** —
  nếu làm chỉ hiện thành phố/ước lượng hoặc không hiện.

**Ngoài phạm vi GĐ này:** xoá tài khoản (vướng đơn hàng/quyền tải tài liệu, nghĩa vụ lưu chứng từ) — Q12; xác thực hai bước.

### 3.5. Thư viện, Đơn hàng

Giữ nguyên nội dung. Chỉ đổi khung: bỏ `max-w-*`/`py-16` riêng của từng trang để vào layout chung; Đơn hàng thay dòng rỗng bằng `EmptyState`
("Bạn chưa có đơn hàng nào" + nút "Khám phá tài liệu" → `/cua-hang`) và thêm `loading.tsx`.

### 3.6. Accessibility và responsive — checklist chung (skill §1, §2, §5, §8, §9)

| Hạng mục | Yêu cầu |
|---|---|
| Heading | Mỗi trang 1 H1; khối là H2; không nhảy cấp |
| Nhãn | Mọi ô có `<label>` hiển thị; ô bắt buộc có dấu * + chữ "(bắt buộc)" cho trình đọc màn hình |
| Lỗi | Dưới ô + `aria-invalid` + `aria-describedby` (kit `TextField` tự gắn); nhiều lỗi → banner tóm tắt nhận focus |
| Focus | Vòng focus nhìn thấy trên mọi link sidebar, nút, nút hiện/ẩn mật khẩu; sau khi lưu, focus về banner kết quả |
| Bấm | Mục sidebar, dòng danh sách mobile, nút ≥44×44px dưới `lg`; khoảng cách ≥8px |
| Màu | Trạng thái "Đã xác minh", "Đang chờ", "Gói quá hạn" luôn có chữ + icon; token `var(--brand-…)`, không hex |
| Chuyển động | Mở/đóng menu, banner tôn trọng `prefers-reduced-motion` |
| 375px | Không cuộn ngang; email dài/tên dài xuống dòng (`overflow-wrap:anywhere`); nút chân form xếp dọc, nút chính ở trên |

---

## 4. Mô hình dữ liệu cần cho GĐ1

> Nguyên tắc: **tối thiểu**, tận dụng cột đã có; mọi thay đổi schema theo expand-only (ADR-034), Quốc duyệt trước khi migrate.

### 4.1. Bảng đã có — dùng lại, không thêm cột

| Cột | Dùng cho | Dữ liệu cá nhân? |
|---|---|---|
| `UserProfile.fullName` | Họ và tên (một ô) | Có (cơ bản) |
| `UserProfile.phone` | SĐT tuỳ chọn | **Có — nhạy hơn**, Q3 |
| `UserProfile.province` | Tỉnh/thành tuỳ chọn | **Có**, Q3 |
| `UserProfile.avatarKey` | Lưu Cloudinary `public_id` của ảnh đại diện (không lưu URL đầy đủ; URL dựng bằng hàm dùng chung ADR-028 §4) | **Có** (ảnh chân dung) |
| `User.email`, `emailVerifiedAt` | Email đăng nhập | Có |
| `RefreshToken.*` | Thu hồi phiên | `ip`, `userAgent` là dữ liệu cá nhân — không hiện ở GĐ1 |

Không thêm `displayName` riêng (đã có `fullName` + `formatReviewerDisplayName` cho chỗ công khai). Không tách họ/tên.

### 4.2. Thay đổi schema đề xuất (cho Hiếu, sau khi Quốc duyệt)

| Thay đổi | Lý do | Ghi chú |
|---|---|---|
| `enum VerificationTokenType` thêm `EMAIL_CHANGE` | Luồng đổi email §3.4b | Expand-only |
| `VerificationToken.newEmail String?` | Lưu email đích của yêu cầu đổi (đã chuẩn hoá) | Nullable, chỉ dùng với `EMAIL_CHANGE`. Phương án khác: cột `User.pendingEmail` — kém hơn vì không gắn hạn/huỷ theo token |
| `AuditAction` thêm `AUTH_PASSWORD_CHANGED`, `AUTH_EMAIL_CHANGE_REQUESTED`, `AUTH_EMAIL_CHANGED`, `PROFILE_AVATAR_CHANGED` (tuỳ chọn) | ADR-037, truy vết sự cố tài khoản | Hằng trong `packages/core/src/audit` + nhãn tiếng Việt |
| **Không** tạo bảng tuỳ chọn thông báo ở GĐ1 | Khách chỉ nhận email giao dịch | Nếu Q8 = có: `UserNotificationPref` (L1: `userId`, `key`, `enabled`) hoặc `UserProfile.notificationPrefs Json` — đề xuất bảng nhỏ vì dễ thêm khoá mới |

### 4.3. Ảnh đại diện — lưu ở đâu (cần ADR bổ sung ADR-028)

| Hạng mục | Đề xuất |
|---|---|
| Nơi lưu | **Cloudinary hệ thống** (đồng bộ ADR-028; đặc tả cũ "R2 prefix `avatars/`" bỏ). Bucket R2 vẫn chỉ cho file tài liệu private |
| Thư mục / `public_id` | `<root>/users/<userId>/avatar/<24 hex>` — **server sinh** `public_id`, chữ ký chỉ cho đúng 1 asset (giống ADR-028 bổ sung (a)) |
| Ai được ký | Mọi user **đã xác minh email**, chỉ cho chính mình. Không dùng chữ ký `SYSTEM_ADMIN` hay chữ ký tenant |
| Định dạng | png / jpg / jpeg / webp (**không GIF** — đồng bộ ADR-028 GĐ1; ảnh mẫu ghi GIF ≤10MB — Q6) |
| Dung lượng | ≤ **2 MB** kiểm ở client + `max_file_size` trong chữ ký (ảnh mẫu ghi 10MB — quá lớn cho ảnh 80px) |
| Biến đổi | Incoming `c_limit,w_1024,h_1024`; hiển thị `c_fill,g_face,w_<N>,h_<N>,f_auto,q_auto` (N = 32/56/96 theo vị trí, có 2x) |
| Hạn mức | **Không** tính vào hạn mức ảnh của gói gian hàng (ảnh thuộc người, không thuộc gian hàng). Chống lạm dụng bằng rate-limit cấp chữ ký (vd 10 lần/giờ/user) |
| Thay/gỡ ảnh | Thay → lưu `public_id` mới rồi xoá asset cũ (Admin API, lỗi xoá thì ghi log, không chặn). Gỡ → `avatarKey = null` + xoá asset |
| Hiển thị ở đâu (GĐ1) | Chỉ nơi **riêng tư/của chính user**: header (`AccountMenu`), header Studio, khu vực `/account`. **Không** hiện công khai (đánh giá, trang gian hàng) cho tới khi chủ dự án quyết — Q7 |
| Kiểm duyệt | Ảnh không công khai ở GĐ1 nên chưa cần quy trình gỡ ảnh vi phạm; nếu Q7 = công khai thì phải có (nối M12c) |

---

## 5. Liên kết với kế hoạch Bảng giá (`docs/de-xuat-trang-bang-gia-2026-10-17.md`)

Thẻ **"Gian hàng của bạn"** ở `/account` (Tổng quan) và `/account/profile` — chỉ chủ gian hàng, dữ liệu L1 (`Tenant`, `Subscription`, `Plan`)
của chính gian hàng user sở hữu (không đọc dữ liệu đơn/khách):

```
┌ Gian hàng của bạn ────────────────────────────────┐
│ [logo] Cô Lan dạy Văn    /co-lan                   │
│ Gói: [Free]  Không hết hạn                         │  ← Badge tên gói + chữ trạng thái
│ (hoặc) Gói: [Pro]  Đang hoạt động · Hết hạn 30/11/2026
│ (hoặc) ⚠ Gói Pro đã quá hạn — gia hạn trước 07/12/2026 để giữ hạn mức
│ Sản phẩm 8/10 · Dung lượng 420/500 MB  (chỉ hiện khi ≥80%, như Billing)
│ [Quản lý gói]  [So sánh các gói]   ·  Vào Studio →  │
└───────────────────────────────────────────────────┘
```

| Trạng thái gói | Nút chính | Nút phụ |
|---|---|---|
| Free | **Nâng cấp** → `/pricing` (xem so sánh, rồi C5 `billing?plan=`) | Vào Studio |
| Trả phí, ACTIVE | **Quản lý gói** → `/studio/{slug}/billing` | So sánh các gói → `/pricing` |
| GRACE (quá hạn) | **Gia hạn ngay** → `/studio/{slug}/billing` (Notice tone cảnh báo, có icon + chữ) | — |
| CANCELED | **Gia hạn** → billing | So sánh các gói |

- Mục sidebar "Gói dịch vụ" (nhóm Gian hàng) → `/studio/{slug}/billing`; nhãn phụ là tên gói. **Không** dựng lại form gia hạn/hoá đơn trong
  `/account` — một nơi duy nhất là Billing Studio (tránh trùng với Studio, đúng ADR-021).
- Phụ thuộc từ đề xuất Bảng giá: **C5** (`billing?plan={planId}` chọn sẵn gói) và việc thêm link "So sánh các gói" ở Billing. Ngày hiển thị
  định dạng `vi-VN`, múi giờ `DISPLAY_TIME_ZONE`.

---

## 6. Thứ tự công việc

| Bước | Ai | Việc | Ghi chú |
|---|---|---|---|
| 0 | Quốc | Chốt câu hỏi §7 với chủ dự án; ADR "Hồ sơ cá nhân & đổi email/mật khẩu" + bổ sung ADR-028 cho ảnh đại diện; quyết định ngoại lệ ADR-024 cho `/account` | Trước khi code |
| **GĐ1** | Hiếu | (1) Migration expand §4.2 (Quốc duyệt trước khi áp DB dùng chung). (2) Server Actions + loader theo contract C1–C7. (3) Email mới: xác minh đổi email, báo đổi email (email cũ), báo đổi mật khẩu. (4) Audit. (5) Sửa đổi mật khẩu thu hồi phiên khác | Test: không thêm test case khi chưa hỏi (CLAUDE.md mục 9) — Q13 |
| **GĐ2** | Phong | (1) `account/layout.tsx` + `AccountSidebarNav` + trang Tổng quan. (2) Dựng lại Hồ sơ, Bảo mật theo §3 bằng kit. (3) Thẻ "Gian hàng của bạn". (4) Đơn hàng: `EmptyState` + `loading.tsx`. (5) `AccountMenu` thêm "Bảo mật", hiện avatar. (6) Studio: menu tài khoản ở header, đổi tên "Cài đặt gian hàng" + tab phụ | Verify 375px/desktop, bàn phím |
| GĐ2b (task riêng) | Phong | Menu mobile + Đăng xuất cho Studio (H8) | Đề xuất ưu tiên cao |
| Sau | Long | Cập nhật `UI-Design-System.md` (khu vực `/account`, `AccountSidebarNav`, thẻ gói), spec M1 (đổi email, ảnh đại diện), ADR | |

### Contract dữ liệu cho Hiếu (Quốc chuyển)

Mọi action trả state cho `useActionState` thay vì redirect + query (H7):
`type ActionState = { ok: true; message: string } | { ok: false; formError?: string; fieldErrors?: Record<string, string> } | null`.

- **C1 — `getAccountOverview()`** (server loader, `requireVerifiedAccess`): `{ email, emailVerifiedAt, fullName, phone, province, avatarUrl | null,
  pendingEmail: { email, expiresAt } | null, ownedTenant: { name, slug, logoUrl | null, plan: { name, isFree }, subscriptionStatus: SubscriptionStatus (enum đủ 6 giá trị; UI nhóm theo bảng §5, TRIALING/PAST_DUE/EXPIRED hiển thị như ACTIVE/GRACE/Free — Hiếu xác nhận giá trị nào còn xuất hiện thực tế sau ADR-021),
  currentPeriodEnd | null, graceEndsAt | null, usage: { products: {used,limit}, storageMb: {used,limit} } } | null, libraryCount, pendingOrderCount }`.
  `ownedTenant` chỉ đọc bảng L1 + đếm của chính gian hàng user sở hữu.
- **C2 — `updateProfileAction(prev, formData)`**: `fullName` (1–80), `phone?`, `province?` theo kết quả Q3; trả `fieldErrors` theo tên ô; vẫn ký lại
  access token khi `pc` đổi (giữ hành vi hiện tại); `revalidatePath("/account", "layout")`.
- **C3 — `changePasswordAction(prev, formData)`**: `currentPassword`, `newPassword`; lỗi `currentPassword`/`newPassword` theo ô; thành công: thu hồi
  mọi refresh token **trừ** `familyId` hiện tại (Q5), email thông báo, audit `AUTH_PASSWORD_CHANGED`; rate-limit lần sai.
- **C4 — `requestEmailChangeAction(prev, formData)`** / **`resendEmailChangeAction()`** / **`cancelEmailChangeAction()`**: `newEmail`, `currentPassword`;
  tạo token `EMAIL_CHANGE` + `newEmail`, gửi 2 email; trả `{ ok, message, pendingEmail }`.
- **C5 — Xác nhận đổi email**: trang `/account/email/confirm?token=…` (GET chỉ hiển thị) + action `confirmEmailChangeAction(token)` (POST bằng nút) —
  trả `{ ok: true, email }` hoặc lỗi `TOKEN_EXPIRED | TOKEN_USED | EMAIL_TAKEN`. Trang này **không** yêu cầu đang đăng nhập (người dùng có thể mở
  link trên máy khác) — Q4d.
- **C6 — Ảnh đại diện**: `getAvatarUploadSignatureAction()` → `CloudinarySignatureResult` (public_id server sinh, định dạng/dung lượng §4.3, lỗi
  `CLOUDINARY_NOT_CONFIGURED` / `RATE_LIMITED`); `saveAvatarAction(publicId)` (kiểm `public_id` thuộc `users/<chính user>/avatar/`, xác minh asset qua Admin
  API, xoá ảnh cũ) → `{ ok, avatarUrl }`; `removeAvatarAction()`. Prop tương thích `ImageUploadField` (`getSignature`, `register`).
- **C7 — Dữ liệu header**: `SiteHeader` và Studio layout cần thêm `avatarUrl | null` (cùng truy vấn đang lấy `fullName`/`email`); Studio header cần
  `fullName` để hiện menu tài khoản.

---

## 7. Câu hỏi mở cho chủ dự án

| # | Câu hỏi | Ảnh hưởng | Phong đề xuất |
|---|---|---|---|
| Q1 | Đồng ý mô hình **một hồ sơ cá nhân** ở `/account` cho mọi người, Studio chỉ chứa cài đặt gian hàng và liên kết qua lại? | Kiến trúc | Đồng ý |
| Q2 | Bỏ các mục trong ảnh mẫu không có nghiệp vụ (Preferences, Referrals, Blocklist, Members, Groups, Phone numbers, Integrations, Contacts, Tên miền)? | Phạm vi | Bỏ, không hiện mục rỗng |
| Q3 | **SĐT và Tỉnh/Thành** (dữ liệu cá nhân): còn thu thập không? Nếu có — bắt buộc hay tuỳ chọn, ai được xem (hiện gian hàng **không** thấy SĐT khách), Tỉnh/Thành chọn từ danh sách 34 đơn vị mới? | Dữ liệu cá nhân, form | Giữ **tuỳ chọn**, chỉ user tự xem; bỏ `required` ở form (H3); danh sách chọn |
| Q4 | Đổi email: (a) chấp nhận email mới hiện ở Studio các gian hàng đã bán cho user (đơn không lưu bản chụp email)? (b) đổi xong có đăng xuất thiết bị khác? (c) báo rõ "email đã được dùng"? (d) cho xác nhận link khi chưa đăng nhập? | Bảo mật, dữ liệu cá nhân | (a) chấp nhận; (b) có; (c) có, kèm rate-limit; (d) có, bằng nút bấm xác nhận |
| Q5 | Đổi mật khẩu: thu hồi mọi phiên khác (giữ phiên hiện tại) và gửi email thông báo? | Bảo mật | Có (đồng bộ luồng đặt lại mật khẩu) |
| Q6 | Ảnh đại diện: Cloudinary hệ thống, png/jpeg/webp **≤2MB**, không GIF (ảnh mẫu ghi GIF ≤10MB)? | Chi phí, ADR-028 | Như đề xuất |
| Q7 | Ảnh đại diện chỉ hiện ở chỗ riêng tư, hay hiện **công khai** (cạnh đánh giá, trang gian hàng)? | Dữ liệu cá nhân, kiểm duyệt | Riêng tư ở GĐ1; logo gian hàng vẫn là ảnh công khai của gian hàng |
| Q8 | Chủ gian hàng có cần **tắt được** email "đơn mới / đánh giá mới / tin nhắn từ trang bán hàng" không? | Thêm bảng tuỳ chọn | Để sau, khi có phản hồi thật |
| Q9 | Khu vực tài khoản của **khách chưa có gian hàng** có hiện thẻ "Mở gian hàng miễn phí" không? | Tiếp thị, trải nghiệm khách | Có, dạng thẻ nhỏ cuối sidebar, không chen vào nội dung |
| Q10 | Có cần **danh sách phiên đăng nhập** (thiết bị, thời điểm) + đăng xuất từng phiên? IP có hiện không? | Dữ liệu cá nhân | Để sau; nếu làm thì không hiện IP |
| Q11 | `/account` dùng header/footer công khai + `container-page` (ngoại lệ ADR-024 vốn xếp `/account` vào app shell fluid)? | Quy ước layout | Có — Quốc ghi bổ sung ADR-024 |
| Q12 | **Xoá tài khoản** có nằm trong GĐ này không (vướng đơn hàng, quyền tải, chứng từ)? | Pháp lý, dữ liệu cá nhân | Không; hiện dòng "Muốn xoá tài khoản? Liên hệ hỗ trợ" nếu có kênh hỗ trợ |
| Q13 | Luồng đổi email/mật khẩu mới có được thêm test case (cần nâng trần `test:count`)? | Quy tắc test mục 9 | Xin thêm 2–3 integration test cho đổi email và thu hồi phiên |

---

## 8. Tác động tài liệu (Quốc giao Long sau khi chốt)

- `docs/DECISIONS.md`: ADR mới "Hồ sơ cá nhân dùng chung cho mọi vai; đổi email/mật khẩu"; bổ sung ADR-028 (ảnh đại diện, thư mục `users/`); bổ sung ADR-024 (khung `/account`).
- `UI-Design-System.md`: mục mới "Khu vực tài khoản `/account`" (layout, `AccountSidebarNav`, danh sách mobile, thẻ "Gian hàng của bạn"), cập nhật §1 (vùng L3), §4.4.
- Spec M1 (`02-System-Specs/`): đổi email, ảnh đại diện Cloudinary (thay "R2 `avatars/`"), hành vi thu hồi phiên khi đổi mật khẩu.
- `docs/BACKLOG.md`: H8 (menu mobile Studio), danh sách phiên đăng nhập, tuỳ chọn thông báo, xoá tài khoản.

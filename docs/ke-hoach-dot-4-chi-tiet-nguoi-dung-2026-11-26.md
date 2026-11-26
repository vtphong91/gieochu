# Kế hoạch Đợt 4 — Trang chi tiết người dùng (System Center) + thao tác quản trị tài khoản

> Ngày lập: 2026-11-26 · Người lập: Quốc (kỹ sư trưởng) · Trạng thái: **đã chốt, chưa code**
> Quyết định: [ADR-073](DECISIONS.md) · Lộ trình chung: [PLAN.md](PLAN.md) mục "Kế hoạch 4 đợt System Center / thanh toán"
> Đợt trước: Đợt 3 — Trang chi tiết gian hàng (ADR-072). Đây là đợt cuối của kế hoạch 4 đợt.

---

## 1. Mục tiêu

Quản trị viên mở một người dùng là biết: người này là ai (hồ sơ, vai trò, trạng thái), tài khoản có an toàn không (phiên đăng nhập, sai mật
khẩu), làm chủ gian hàng nào, đã đồng ý điều khoản nào, và những gì đã xảy ra với tài khoản. Đồng thời xử lý được các tình huống hỗ trợ
thường gặp — khoá/mở khoá có lý do, đăng xuất mọi thiết bị, gửi lại email kích hoạt, yêu cầu đặt lại mật khẩu — mà **không bao giờ** chạm
tới mật khẩu hay dữ liệu mua hàng của người dùng.

## 2. Quyết định đã chốt (chủ dự án, 2026-11-26)

| # | Câu hỏi | Chốt |
|---|---|---|
| 1 | Các phần của trang | Hồ sơ & tài khoản (luôn có), **Bảo mật & phiên đăng nhập**, **Gian hàng sở hữu**, **Điều khoản đã đồng ý**, **Nhật ký** |
| 2 | Dữ liệu cá nhân | Hiện tỉnh/thành, nghề nghiệp; **số điện thoại che một phần** + nút "Hiện đầy đủ" (ghi audit khi xem) |
| 3 | Thao tác | **Khoá/Mở khoá có lý do + email**, **Đăng xuất mọi thiết bị**, **Gửi lại email kích hoạt**, **Yêu cầu đặt lại mật khẩu** |
| 4 | Địa chỉ IP của phiên | **Che một phần** (vd `113.161.•••.•••`) |

## 3. Hiện trạng (Quốc đối chiếu code 2026-11-26)

| Hạng mục | Hiện trạng |
|---|---|
| `/admin/users` (`apps/web/app/admin/users/page.tsx`) | Danh sách: họ tên, vai trò, gian hàng, trạng thái, email, ngày tạo; menu "⋯": Khoá/Mở khoá (chạy ngay, không lý do, không email), "Gửi lại email kích hoạt" (khi PENDING). Không có trang chi tiết. |
| `User` | `email`, `systemRole`, `status` (PENDING/ACTIVE/LOCKED), `isSuperAdmin`, `emailVerifiedAt`, `profileCompletedAt`, `lastLoginAt`, `failedLoginAttempts`, `passwordResetRequired` |
| `UserProfile` | `fullName`, `phone`, `avatarKey`, `occupation`, `province`, `consentAt` (tuỳ chọn — có tài khoản không có hồ sơ) |
| `RefreshToken` (ADR-053) | Mỗi `familyId` = một phiên/thiết bị: `deviceLabel`, `userAgent`, `ip`, `rememberMe`, `sessionStartedAt`, `expiresAt`, `revokedAt` |
| `UserLegalAcceptance` | `versionId` → văn bản pháp lý + phiên bản, `acceptedAt` |
| Audit | Thao tác của chính người dùng (đổi mật khẩu/email…) và thao tác quản trị trên tài khoản (`targetType` User) |

## 4. Phạm vi

**Trong phạm vi**
- Trang mới `/admin/users/[userId]` (+ loading, not-found).
- Danh sách `/admin/users`: tên/email là link chi tiết; menu "⋯" thêm **Xem chi tiết**; Khoá/Mở khoá qua hộp xác nhận có lý do.
- 4 thao tác quản trị (mục 6) + server action "Hiện số điện thoại đầy đủ" có audit.

**Ngoài phạm vi**
- Đơn mua, thư viện tài liệu, khách hàng của gian hàng, giao dịch (§7.9).
- Sửa hồ sơ, đổi email, đổi vai trò, xoá tài khoản từ System Center.
- Xem/đặt mật khẩu thay người dùng (không bao giờ làm).
- Thu hồi từng phiên riêng lẻ (chỉ "Đăng xuất mọi thiết bị").

## 5. Nội dung trang `/admin/users/[userId]`

| Phần | Nội dung | Nguồn |
|---|---|---|
| **Đầu trang** | Họ tên (hoặc email nếu chưa có hồ sơ), badge trạng thái, badge vai trò (Quản trị viên / Siêu quản trị / Người dùng), nút thao tác (mục 6) | `users`, `user_profiles` |
| **Hồ sơ & tài khoản** | Email (+ đã xác minh lúc …/chưa xác minh), họ tên, số điện thoại **che** (`09•••••123`) + nút "Hiện đầy đủ", tỉnh/thành, nghề nghiệp, ngày tạo, hoàn thiện hồ sơ, đồng ý thu thập dữ liệu lúc … | `users`, `user_profiles` |
| **Bảo mật & phiên đăng nhập** | Đăng nhập gần nhất, số lần sai mật khẩu liên tiếp, cờ "Bắt buộc đặt lại mật khẩu"; danh sách **phiên còn hiệu lực** (mỗi `familyId`): thiết bị, IP **che** (`113.161.•••.•••`; IPv6 che phần sau), bắt đầu lúc, hoạt động gần nhất, "Ghi nhớ đăng nhập", hết hạn | `users`, `refresh_tokens` (không trả `tokenHash`) |
| **Gian hàng sở hữu** | Tên, slug, trạng thái, gói → link **Chi tiết gian hàng** (Đợt 3); không có → EmptyState | `tenants` (owner) |
| **Điều khoản đã đồng ý** | Văn bản, phiên bản, ngày đồng ý — mới nhất trước | `user_legal_acceptances` + phiên bản |
| **Nhật ký** | Thao tác bảo mật của người dùng (đăng nhập bị khoá do sai mật khẩu, đổi mật khẩu, đổi email…) + thao tác quản trị trên tài khoản (khoá/mở khoá kèm lý do, đăng xuất mọi thiết bị, yêu cầu đặt lại mật khẩu, gửi lại email kích hoạt, xem số điện thoại) — ≤ 50 dòng, mới nhất trước; **loại** mọi action liên quan đơn hàng/khách hàng của gian hàng | `audit_logs` (actorId = người dùng hoặc targetId = người dùng) |

Trạng thái: loading, 404 khi không có người dùng, EmptyState cho phần rỗng.

## 6. Thao tác quản trị

| Thao tác | Khi nào hiện | Hành vi | Audit | Email |
|---|---|---|---|---|
| **Khoá tài khoản…** | status ≠ LOCKED, không phải super admin, không phải chính mình | Hộp xác nhận (nêu hệ quả: không đăng nhập được, phiên hiện tại bị thu hồi — Hiếu xác nhận theo code), **lý do bắt buộc** ≤ 500 (gửi cho người dùng) | `USER_LOCKED` + `reason` | Báo người dùng: đã bị khoá, lý do, liên hệ hỗ trợ |
| **Mở khoá tài khoản…** | status = LOCKED | Hộp xác nhận, lý do bắt buộc | `USER_UNLOCKED` + `reason` | Báo đã mở khoá |
| **Đăng xuất mọi thiết bị…** | Có ≥ 1 phiên còn hiệu lực | Hộp xác nhận; thu hồi mọi refresh token còn hiệu lực | Action mới (vd `USER_SESSIONS_REVOKED`) + số phiên | Không (chốt sau nếu cần) |
| **Gửi lại email kích hoạt** | status = PENDING | Dùng luồng sẵn có (rate limit sẵn có) | Theo luồng sẵn có | Email kích hoạt |
| **Yêu cầu đặt lại mật khẩu…** | status = ACTIVE | Hộp xác nhận; bật `passwordResetRequired`, gửi email đặt lại theo luồng "Quên mật khẩu" sẵn có (token chỉ lưu hash) | Action mới (vd `USER_PASSWORD_RESET_REQUIRED`) | Email đặt lại mật khẩu |
| **Hiện số điện thoại đầy đủ** | Có số điện thoại | Server action trả số đầy đủ cho phiên xem đó | Action mới (vd `USER_PHONE_VIEWED`) | Không |

Quy tắc chung: mọi action `requireRole("SYSTEM_ADMIN")`; giữ quy tắc hiện có về super admin và tự khoá chính mình; email gửi sau commit, lỗi chỉ
log (trả `emailSent:false` như Đợt 3).

## 7. Các bước & phân công (quy trình đầy đủ)

| Bước | Ai (model) | Việc | Đầu ra |
|---|---|---|---|
| 1 | **Phong** (Sonnet) | Bố cục trang (mục 5) + các hộp thao tác (mục 6) cho 375/1024/1280px + **contract dữ liệu** (TypeScript) + câu chữ hộp và email | Báo cáo bố cục + contract |
| 2 | **Quốc** | Duyệt contract, chuyển Hiếu | Brief |
| 3 | **Hiếu** (Opus — dữ liệu cá nhân, phiên đăng nhập, khoá tài khoản) | `getAdminUserDetail(userId)`; action khoá/mở khoá có lý do + email; đăng xuất mọi thiết bị; yêu cầu đặt lại mật khẩu; hiện số điện thoại có audit; mẫu email; mở rộng test sẵn có | Code + verify |
| 4 | **Phong** (Sonnet) | Dựng trang + hộp + cập nhật danh sách | Code + soát a11y/responsive |
| 5 | **Quốc** | Review phạm vi, typecheck, lint, unit, `test:count`, integration liên quan | Báo chủ dự án |
| 6 | **Long** (Haiku) | Ghi KB: ADR-073, spec quản lý người dùng System Center, Audit-Log-Specs, Endpoint-Directory, UI-Design-System, email mới | Báo trang đã sửa |

## 8. Ràng buộc kỹ thuật

- Chỉ dữ liệu L1 + audit; không đọc `orders`, `tenant_customers`, `entitlements`, giao dịch (§7.9).
- Không trả `passwordHash`, `tokenHash`, token kích hoạt/đặt lại; số điện thoại đầy đủ chỉ qua action có audit; IP luôn che ở server.
- Không migration (lý do lưu metadata audit; action audit là chuỗi).
- **Không thêm test case** (trần 105/69) — mở rộng case sẵn có: khoá thiếu lý do bị chặn; khoá có lý do → audit + 1 email + phiên bị thu hồi;
  không khoá được super admin/chính mình; đăng xuất mọi thiết bị thu hồi đúng phiên; yêu cầu đặt lại mật khẩu bật cờ + gửi email; xem số
  điện thoại ghi audit; `getAdminUserDetail` không chứa trường bí mật, IP đã che.
- Test gọi sweep/cron phải truyền `tenantIds` (quy ước 2026-11-26).

**Tiêu chí xong:** trang chi tiết đủ các phần; danh sách có "Xem chi tiết" và khoá/mở khoá có lý do; 4 thao tác hoạt động đúng, có audit và email
theo bảng mục 6; không lộ dữ liệu mua hàng, mật khẩu, token; số điện thoại và IP che đúng; verify đạt; Long đã ghi KB.

## 9. Rủi ro

| Rủi ro | Giảm thiểu |
|---|---|
| Lạm dụng xem số điện thoại | Che mặc định + audit mỗi lần xem |
| Khoá nhầm tài khoản chủ gian hàng | Hộp xác nhận nêu "người dùng này là chủ gian hàng X"; lý do bắt buộc; mở khoá có email |
| Quản trị viên ghi nội dung nội bộ vào lý do | Hộp ghi rõ lý do sẽ gửi cho người dùng |
| Yêu cầu đặt lại mật khẩu bị dùng để quấy rối | Hộp xác nhận + audit; dùng rate limit của luồng quên mật khẩu |
| Khoá tài khoản chủ gian hàng ảnh hưởng gian hàng | Hiếu xác nhận theo code và ghi rõ trong hộp (khoá tài khoản ≠ khoá gian hàng) |

## 10. Việc chủ dự án cần làm

1. Commit + deploy Đợt 3 và thử trước.
2. Báo **"bắt đầu đợt 4"** → Quốc giao Phong bước 1.
3. Sau khi xong: deploy, mở `/admin/users` → Xem chi tiết một tài khoản thử nghiệm; thử khoá/mở khoá, đăng xuất mọi thiết bị, yêu cầu đặt lại
   mật khẩu; kiểm tra email và nhật ký.

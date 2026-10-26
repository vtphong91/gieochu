---
tags:
  - adr
  - order
  - payment
  - auth
  - customer
  - status/accepted
date: 2026-10-26
decider: vtphong91
status: Accepted — đã chốt, CHƯA triển khai
---

# 🏛️ ADR-046: Luồng mua của khách — mua không cần đăng ký trước, hạn giữ đơn theo phương thức, thông báo, email (chốt một phần)

## 1. Trạng Thái (Status)
**ĐÃ CHỐT, CHƯA TRIỂN KHAI** — tương ứng **ADR-061** trong [`docs/DECISIONS.md`](../../docs/DECISIONS.md) (chủ dự án chốt 2026-10-26, gồm "Chốt tiếp"). Phân
tích gốc: `docs/phan-tich-gio-hang-don-cho-48h-2026-10-26.md` (Hiếu). Bản trích ghi theo duyệt của Quốc (brief 2026-10-26).

> [!WARNING] Chưa có code
> Toàn bộ trang này là **quyết định**, không phải hành vi đang chạy. Spec [[02-System-Specs/Order-State-Machine|Order-State-Machine]] và
> [[02-System-Specs/Auth-Session-Specs|Auth-Session-Specs]] **chưa** sửa theo ADR này — vẫn mô tả code hiện tại (hạn đơn 60 phút cấu hình được, cửa sổ xác nhận
> trễ 24 giờ, tài khoản chưa xác minh không đăng nhập được). Sửa spec khi có code. Mọi mục dưới: 🟡 theo `docs/DECISIONS.md`.

---

## 2. Quyết Định (Decision) 🟡

### 2.1. Mua hàng
- **Q2:** trang tài liệu chỉ một nút **"Mua ngay"** → trang thanh toán.
- **Q3:** **không làm Giỏ hàng** trong beta. **Q4:** mỗi đơn 1 tài liệu, hoàn cả đơn. **Q11:** bỏ.
- **Q1 — mua không cần đăng ký trước:** khách chưa đăng nhập điền **Họ tên + Email + ô xác nhận** thông tin/đồng ý Điều khoản ở trang thanh toán → hệ thống **tạo
  tài khoản** và cho thanh toán ngay trên phiên đó; gửi email **"Kích hoạt tài khoản và đặt mật khẩu"** (token một lần, lưu hash — vừa xác minh email vừa đặt mật
  khẩu). **Không** gửi mật khẩu qua email. Sau thanh toán: tải được ngay trên phiên đó; đăng nhập lại/thiết bị khác cần kích hoạt qua email. Email đã có tài khoản →
  yêu cầu đăng nhập, không tự gắn đơn. **Thay** quy tắc "tài khoản chưa xác minh không có phiên" (ADR-053) **cho riêng trường hợp này**; cần chống lạm dụng (rate
  limit tạo tài khoản/gửi email).
- **Q6:** giới hạn mã giảm giá "mỗi khách" tính cả đơn chờ còn hiệu lực của khách; giới hạn tổng **không** giữ chỗ.
- **Q10:** khách **được đổi phương thức thanh toán** của đơn đang chờ → email báo người bán phải chống sót/trùng (cột đánh dấu trên `orders`, **migration nhỏ**).

### 2.2. Hạn giữ đơn (Q13 + Q5 đã sửa)
| Phương thức | Hạn giữ đơn |
| :-- | :-- |
| Chuyển khoản ngân hàng thủ công, MoMo thủ công | **72 giờ** |
| SePay | **48 giờ** |

**Không cộng thêm cửa sổ xác nhận trễ 24 giờ** — thay quyết định Q5 ban đầu ("giữ cửa sổ 24 giờ"). Giao dịch SePay đến sau hạn hiện ở "Giao dịch cần xử lý".

### 2.3. Thông báo và email
- **Q8:** thông báo "Anh/Chị {name} có đơn cần thanh toán để hoàn tất đơn hàng!" **chỉ ở header khu vực Tài khoản**; danh sách "Đơn chờ thanh toán" trong Tài khoản.
- **Q7:** email cho khách lúc chọn cách thanh toán (thông tin chuyển khoản + nút về trang thanh toán) + **1 lần nhắc** khi còn ≤ 24 giờ (cron hằng ngày sẵn có).
- **Q12:** email "thanh toán thành công" có nút **"Tải tài liệu"** trỏ **Thư viện** (bắt buộc đăng nhập), không link tải trực tiếp.
- **Q9:** người bán **không** nhận email tổng hợp; chỉ email khi có **đơn thủ công chờ xác nhận** và khi **thanh toán thành công** (kể cả SePay); không gửi cho đơn khách
  tạo rồi bỏ (chưa chọn cổng).

---

## 3. Đối chiếu với code hiện tại (để biết phải đổi gì) ✅ code 2026-10-26
| Quyết định | Code hiện tại |
| :-- | :-- |
| Mua không cần đăng ký | `buyProductAction` + checkout gọi `requireVerifiedAccess`; tài khoản chưa kích hoạt không đăng nhập được (`EMAIL_NOT_VERIFIED`) |
| Hạn 72 giờ / 48 giờ | Một hạn chung `orderPendingTtlMinutes` (mặc định 60, tối đa 1440 phút) |
| Không cửa sổ trễ | `canManuallyConfirmOrder` cho xác nhận tới `expiresAt + 24h`; email `order_pending_manual` (ADR-059) ghi "hạn chót xác nhận" = hạn + 24h |
| Đổi phương thức thanh toán | Chọn lại cổng đã được (`initiateOrderCheckout`), nhưng email người bán chỉ gửi khi provider đang `null` (KB-Audit §41 mục 5) |
| MoMo thủ công | Có từ ADR-059 bổ sung lần 3 (`MOMO_MANUAL`, chưa commit, migration chưa áp); hạn đơn vẫn dùng hạn chung — 72 giờ chưa có |
| Thông báo header, email cho khách lúc chọn cổng, email nhắc | Chưa có |
| Email "thanh toán thành công" | Có (`order_paid`): đã có **liên kết chữ** "Tải tài liệu: …" trỏ `APP_URL/account/library` (`sendOrderPaidEmails`) — Q12 cần đổi thành **nút**, nội dung không đổi đích |
| Email người bán khi thanh toán thành công | Có `new_sale` ("Đơn hàng mới: {tài liệu}") gửi chủ gian hàng sau khi đơn được giao — mọi cổng, kể cả SePay; khớp Q9 về nội dung gửi ✅ code |

---

## 4. Hệ Quả (Consequences) 🟡
- Cần migration nhỏ (cột đánh dấu trên `orders`) — theo expand → contract (ADR-034), Quốc duyệt trước khi chạy.
- Đổi quy tắc phiên ADR-053 cho khách mua lần đầu — ảnh hưởng bảo mật (phiên của tài khoản chưa xác minh) → cần thiết kế + review riêng.
- Dự thảo [`docs/du-thao-huong-dan/huong-dan-mua-va-tai-tai-lieu.md`](../../docs/du-thao-huong-dan/huong-dan-mua-va-tai-tai-lieu.md) viết theo ADR này, đánh dấu
  `[CHƯA CÓ — ADR-061]`.
- MoMo thủ công vẫn chờ kiểm thử thật ❓.

---

## 5. Liên Kết
* [[01-Architecture-Decisions/ADR-044-Beta-Payments-Manual-Confirm-Emails-Sepay|ADR-044 KB (≙ ADR-059)]] — email báo xác nhận tay, "Giao dịch cần xử lý"
* [[01-Architecture-Decisions/ADR-039-Session-Policy-Remember-Me-Idle-Absolute|ADR-039 KB (≙ ADR-053)]] — chính sách phiên bị thay một phần
* [[02-System-Specs/Order-State-Machine|Order-State-Machine]] · [[02-System-Specs/Auth-Session-Specs|Auth-Session-Specs]] — **chưa** cập nhật theo ADR này
* [[00-Index/KB-Audit-2026-09-26|KB-Audit]] §42

*Quay lại: [[MOC-Home]] (../00-Index/MOC-Home.md)*

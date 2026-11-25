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
status: Accepted — đã code đủ, chưa commit, chưa thử thủ công
---

# 🏛️ ADR-046: Luồng mua của khách — mua không cần đăng ký trước, hạn giữ đơn theo phương thức, thông báo, email (chốt một phần)

## 1. Trạng Thái (Status)
**ĐÃ CHỐT — ĐÃ CODE ĐỦ, CHƯA COMMIT, CHƯA THỬ THỦ CÔNG** (cập nhật 2026-10-27, gồm khách vãng lai task 12/13) — tương ứng **ADR-061** trong [`docs/DECISIONS.md`](../../docs/DECISIONS.md) (chủ dự án chốt 2026-10-26, gồm "Chốt tiếp"). Phân
tích gốc: `docs/phan-tich-gio-hang-don-cho-48h-2026-10-26.md` (Hiếu). Bản trích ghi theo duyệt của Quốc (brief 2026-10-26).

> [!WARNING] Đã code đủ — chưa commit, chưa thử thủ công
> **Đợt 1 (khách đã đăng nhập) và khách vãng lai (task 12/13) xong code ở working tree, chưa commit** ✅ `git status` 2026-10-27; migration `20261026180000_adr061_purchase_flow` đã áp 🟡 (brief). Phần đã
> code đã ghi vào spec: [[02-System-Specs/Order-State-Machine|Order-State-Machine]] §3.1, §3.4, §3.10–§3.12, [[02-System-Specs/Payment-And-Billing|Payment-And-Billing]] §5K,
> [[02-System-Specs/Studio-Orders-Specs|Studio-Orders-Specs]] §2.5, [[03-API-Contracts/Endpoint-Directory|Endpoint-Directory]] §29. Khách vãng lai (Q1 — task 12/13): [[02-System-Specs/Auth-Session-Specs|Auth-Session-Specs]] §9A,
> [[02-System-Specs/Order-State-Machine|Order-State-Machine]] §3.13, Endpoint-Directory §29.5. Chưa ai thử luồng trên trình duyệt/hộp thư thật ❓. Mục §2 dưới: 🟡 theo
> `docs/DECISIONS.md`; tiến độ từng mục ở §3. Chi tiết layout và "Tôi đã chuyển khoản": [[01-Architecture-Decisions/ADR-048-Checkout-Layout-Declared-Paid-Guest-Session|ADR-048 KB (≙ ADR-062)]].

> [!NOTE] Bị sửa bởi ADR-052 (KB) — tương ứng ADR-068 docs (2026-11-25, Quốc duyệt ghi chú)
> [[01-Architecture-Decisions/ADR-052-Studio-Order-Status-Change-Reopen-Late-Confirm|ADR-052 KB (≙ ADR-068)]] thay quy tắc "không cửa sổ xác nhận trễ" **cho thao tác của
> người bán**: chủ gian hàng xác nhận được đơn đã hết hạn và mở lại đơn hết hạn/đã huỷ (hạn giữ mới tính từ lúc mở lại). Webhook/job tự khớp **không đổi** — tiền về sau
> hạn vẫn không tự giao. Nội dung bên dưới giữ nguyên như lúc ghi ADR-061.

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

## 3. Tiến độ so với code ✅ đối chiếu working tree 2026-10-27 (bảng 2026-10-26 trước đợt 1 đã thay)
| Quyết định | Code đợt 1 |
| :-- | :-- |
| Q2 — chỉ "Mua ngay"; Q3 — không Giỏ hàng; Q4 — 1 đơn 1 tài liệu | ✅ (vốn có) |
| Q1 — mua không cần đăng ký | ✅ task 12/13 (working tree): `startGuestCheckoutAction` (Họ tên + Email + 1 ô đồng ý → user PENDING `hasPassword=false`, phiên `guestCheckout` ≤ 24 giờ, đơn), email "Kích hoạt tài khoản và đặt mật khẩu" (`GUEST_ACTIVATION` 7 ngày), email đã có tài khoản → yêu cầu đăng nhập, rate limit DB; guard `requireCheckoutAccess`/`requireCheckoutUser` |
| Q13 + Q5 sửa — 72 giờ (thủ công, chưa chọn) / 48 giờ (SePay), không cửa sổ trễ | ✅ `orderHoldManualHours`/`orderHoldAutoHours`, `computeOrderHoldExpiresAt`, `canManuallyConfirmOrder` bỏ 24 giờ (ngoại lệ "báo chuyển trước hạn" của ADR-062); SePay về sau hạn → "Giao dịch cần xử lý" |
| Q6 — mã giảm giá "mỗi khách" tính cả đơn chờ | ✅ `applyCouponToOrder` |
| Q7 — email khách lúc chọn cổng + 1 lần nhắc | ✅ `order_payment_customer` (tối đa 3/đơn), `order_payment_reminder` (cron `order.payment_reminders`) |
| Q8 — thông báo header khu vực Tài khoản + danh sách đơn chờ | ✅ dòng nhắc trong `AccountShell` (link `/account/orders`) |
| Q9 — email người bán: đơn thủ công chờ xác nhận + thanh toán thành công | ✅ `order_pending_manual` một lần/đơn (`ownerManualNotifiedAt`), `new_sale` (có sẵn); thêm `order_customer_declared_paid` (ADR-062 Q1) |
| Q10 — đổi phương thức thanh toán | ✅ `selectProviderAction` đổi được khi còn chờ, chưa báo chuyển, hạn phương thức mới chưa qua (`PROVIDER_HOLD_EXPIRED`) |
| Q12 — nút "Tải tài liệu" về Thư viện | ✅ `order_paid` có nút, trỏ `/account/library?tai-lieu={productId}` |
| MoMo thủ công | ✅ `MOMO_MANUAL` (ADR-059 lần 3) dùng hạn 72 giờ; **chờ kiểm thử thật** ❓ |

---

## 4. Hệ Quả (Consequences) 🟡
- Migration `20261026180000_adr061_purchase_flow` (6 cột trên `orders` + cột/bảng cho khách vãng lai) — expand-only, **đã áp** 🟡 (brief 2026-10-27).
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

> **BẢN DỰ THẢO — trang hướng dẫn, chưa nhập CMS.**
>
> Trang: Hướng dẫn kích hoạt tài khoản (xác nhận email) (đề xuất slug `huong-dan-kich-hoat`, mục "Nội dung > Trang tuỳ chỉnh").
> Người soạn: Long (tài liệu), 2026-10-26, theo brief Quốc (câu 13 đã chốt). Mô tả đúng luồng đang có trong code (`/verify-email`,
> `POST /api/auth/verify-email`, `POST /api/auth/resend-verification`) tại ngày soạn.
>
> Quy ước nhập vào CMS: chỉ chép phần từ "## Vì sao phải kích hoạt?" đến hết "## Cần giúp đỡ?"; **không** chép khối dẫn này và phần
> "Ghi chú nội bộ". Dán vào khối **`richText`** của trang tuỳ chỉnh — hiển thị Markdown, tự thay `{brand}` (ADR-060). `{Số giờ}` là thời hạn liên kết — **điền theo "Hạn link xác minh
> email" ở System Center → Cấu hình chung trước khi đăng** (mặc định hiện tại 24 giờ). `[Ảnh: …]` là chỗ đặt ảnh — trang tuỳ chỉnh không nhận ảnh, xoá khi nhập.

## Vì sao phải kích hoạt?

Sau khi đăng ký, {brand} gửi một email để chắc chắn email đó là của bạn. Khi **chưa kích hoạt**, bạn **không đăng nhập được**.

Nếu bạn **mua tài liệu khi chưa có tài khoản**, {brand} tự tạo tài khoản và gửi email **"Kích hoạt tài khoản {brand} và đặt mật khẩu"**. Bấm
liên kết trong email đó, nhập **Mật khẩu mới** (ít nhất 8 ký tự, có cả chữ và số) và **Nhập lại mật khẩu**, rồi bấm **"Kích hoạt và đặt mật khẩu"**. Liên kết này dùng được
**7 ngày** và chỉ một lần. Xong bước này, bạn đăng nhập bằng email và mật khẩu vừa đặt. Muốn nhận lại email này: dùng **"Gửi lại email kích hoạt"** hoặc **"Quên
mật khẩu?"** ở trang đăng nhập.

## Các bước kích hoạt

1. Mở hộp thư của email bạn đã dùng để đăng ký.
2. Tìm email có tiêu đề **"Kích hoạt tài khoản {brand}"**.
   [Ảnh: email kích hoạt trong hộp thư]
3. Mở email và bấm vào **liên kết kích hoạt**.
4. Trang **"Kích hoạt tài khoản"** mở ra. Chờ vài giây đến khi thấy **"Kích hoạt thành công!"**.
   [Ảnh: thông báo kích hoạt thành công]
5. Bấm **"Đăng nhập ngay"** và đăng nhập bằng email, mật khẩu đã đặt.

## Không thấy email kích hoạt?

Làm lần lượt:

1. **Đợi vài phút.** Email đôi khi đến chậm.
2. **Xem thư mục Spam (Thư rác).** Email tự động hay bị đưa vào đây.
3. **Xem thư mục hoặc tab Quảng cáo** (Gmail gọi là "Quảng cáo" / "Promotions"), và tab "Mạng xã hội", "Cập nhật" nếu có.
4. Tìm trong hộp thư bằng từ khoá **"Kích hoạt tài khoản"**.
5. Thấy email trong Spam hoặc Quảng cáo: bấm **"Không phải thư rác"** hoặc chuyển sang hộp thư chính, để lần sau email đến đúng chỗ.
6. Kiểm tra lại email đã đăng ký có gõ đúng không. Gõ sai thì đăng ký lại bằng email đúng.
7. Vẫn không có: **gửi lại email kích hoạt** (mục dưới).

## Gửi lại email kích hoạt

1. Mở trang **Kích hoạt tài khoản**. Có hai cách:
   - Ở trang Đăng nhập, đăng nhập thử. Khi hiện "Tài khoản chưa được kích hoạt…", bấm **"Gửi lại email kích hoạt"**.
   - Hoặc mở lại liên kết cũ (kể cả đã hết hạn) — trang có sẵn ô gửi lại.
2. Ở mục **"Chưa nhận được email kích hoạt?"**, nhập **email đã đăng ký**.
3. Bấm **"Gửi lại email kích hoạt"**.
4. Trang báo: "Nếu email tồn tại và chưa kích hoạt, chúng tôi đã gửi lại liên kết kích hoạt." Câu này giống nhau với mọi email, để giữ bí mật
   cho người dùng — không có nghĩa là email bị sai.
5. Mở email **mới nhất** và bấm liên kết.
   [Ảnh: ô gửi lại email kích hoạt]

Mỗi email chỉ gửi lại được **3 lần trong 1 giờ**. Quá số lần này, trang báo "Bạn đã yêu cầu gửi lại quá nhiều lần, vui lòng thử lại sau 1 giờ."

## Thời hạn của liên kết

- Liên kết kích hoạt **chỉ dùng được trong {Số giờ} giờ** kể từ lúc gửi. Thời hạn cũng được ghi ngay trong email.
- Mỗi liên kết chỉ dùng được **một lần**.
- Hết hạn thì không sao: gửi lại email kích hoạt để nhận liên kết mới. Tài khoản và thông tin bạn đã điền vẫn còn.

## Lỗi thường gặp

| Bạn thấy | Nghĩa là | Cách xử lý |
| :-- | :-- | :-- |
| "Liên kết kích hoạt đã hết hạn." | Quá {Số giờ} giờ kể từ lúc gửi. | Gửi lại email kích hoạt. |
| "Liên kết kích hoạt đã được sử dụng." | Bạn đã kích hoạt rồi. | Đăng nhập bình thường. |
| "Liên kết kích hoạt không hợp lệ." | Liên kết bị cắt mất một phần khi sao chép. | Bấm thẳng vào liên kết trong email, hoặc gửi lại email. |
| "Tài khoản chưa được kích hoạt…" khi đăng nhập | Chưa bấm liên kết kích hoạt. | Làm theo "Các bước kích hoạt", hoặc gửi lại email. |

## Cần giúp đỡ?

Đã làm hết các bước mà vẫn không nhận được email: liên hệ chúng tôi qua trang **Liên hệ**, ghi rõ email bạn đã đăng ký.

---

## Ghi chú nội bộ (không chép vào CMS)

0. Đoạn "mua tài liệu khi chưa có tài khoản" đối chiếu code working tree 2026-10-27 (task 12/13, chưa commit, chưa thử thủ công): trang
   `/verify-email/dat-mat-khau`, token `GUEST_ACTIVATION` 7 ngày (chỉ tiêu khi gửi form), resend + quên mật khẩu gửi lại email này (3 lần/email/giờ). Đã gỡ dấu
   [CHƯA CÓ — ADR-061]. Đăng nhập khi chưa kích hoạt loại tài khoản này báo `GUEST_NOT_ACTIVATED`. ✅ code

Mức xác minh: ✅ Long đọc code working tree 2026-10-26 · ❓ chưa thử với hộp thư thật (Gmail/Outlook).

1. **Hiển thị (ADR-060)** ✅ code: Markdown + thay `{brand}` có sẵn. Riêng `{Số giờ}` **không** phải biến hệ thống — không có biến nào đọc
   `emailVerifyTtlHours` vào trang CMS → **[CHƯA CÓ]**; phải điền tay và sửa lại khi admin đổi cấu hình.
2. Đối chiếu code: thời hạn = `getSystemSettings().emailVerifyTtlHours` (mặc định 24, cho phép 1–72 giờ, `packages/core/src/settings/system-settings.ts`);
   email ghi "liên kết hết hạn sau N giờ" (`renderVerifyEmailTemplate`); tiêu đề "Kích hoạt tài khoản {appName}"; token dùng 1 lần
   (`TOKEN_ALREADY_USED`), hết hạn `TOKEN_EXPIRED`, sai `INVALID_TOKEN`; đăng nhập khi chưa kích hoạt → `EMAIL_NOT_VERIFIED` 403 + link
   `/verify-email?pending=1`; gửi lại: 3 lần/giờ/email (giới hạn trong bộ nhớ tiến trình), câu trả lời giống nhau cho mọi email.
3. Gửi lại **không** huỷ liên kết cũ — liên kết cũ còn hạn vẫn kích hoạt được ✅ code. Trang ghi "mở email mới nhất" cho đơn giản.
4. Liên kết gửi lại không mang tham số `next` (khác liên kết lúc đăng ký) — sau khi kích hoạt bằng liên kết gửi lại, đăng nhập xong được đưa tới
   trang mặc định theo vai trò, không vào thẳng `/studio` ✅ code. Không ảnh hưởng câu chữ.
5. Tên thư mục "Quảng cáo"/"Promotions" theo Gmail; nhà cung cấp khác đặt tên khác — câu chữ để chung.
6. Email gửi thẳng qua SMTP hệ thống; nếu SMTP lỗi, đăng ký vẫn thành công nhưng không có email — người dùng phải bấm gửi lại ✅ code.

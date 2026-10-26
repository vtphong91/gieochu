> **BẢN DỰ THẢO — trang hướng dẫn, chưa nhập CMS.**
>
> Trang: Hướng dẫn đăng ký tài khoản (đề xuất slug `huong-dan-dang-ky`, mục "Nội dung > Trang tuỳ chỉnh").
> Người soạn: Long (tài liệu), 2026-10-26, theo brief Quốc (câu 13 đã chốt). Nội dung mô tả đúng luồng đang có trong code
> (`/register`, `POST /api/auth/register`) tại ngày soạn.
>
> Quy ước nhập vào CMS: chỉ chép phần từ "## Trước khi bắt đầu" đến hết "## Cần giúp đỡ?"; **không** chép khối dẫn này và phần
> "Ghi chú nội bộ" cuối file. Dán vào khối **`richText`** của trang tuỳ chỉnh — hiển thị Markdown và tự thay `{brand}` bằng tên
> thương hiệu (ADR-060); **không** gõ cứng tên. `[Ảnh: …]` là chỗ đặt ảnh minh hoạ — trang tuỳ chỉnh không nhận ảnh, xoá dòng này khi nhập.

## Trước khi bắt đầu

Bạn cần:

- Một địa chỉ email bạn đang dùng được. Bạn sẽ phải mở email này để kích hoạt tài khoản.
- Một mật khẩu **ít nhất 8 ký tự, có cả chữ và số**.

Mỗi email chỉ đăng ký được **một** tài khoản.

## Các bước đăng ký

1. Mở trang **Đăng ký**: bấm "Đăng ký" ở đầu trang {brand}, hoặc bấm "Đăng ký" ở trang Đăng nhập.
   [Ảnh: nút Đăng ký trên đầu trang]
2. Chọn **loại tài khoản**:
   - **Giáo viên / Coach / Chuyên gia** — nếu bạn muốn mở gian hàng để bán tài liệu.
   - **Khách hàng** — nếu bạn chỉ muốn tìm, mua và tải tài liệu.
   [Ảnh: hai ô chọn loại tài khoản]
3. Điền **Họ và tên**.
4. Điền **Email**.
5. Đặt **Mật khẩu** (ít nhất 8 ký tự, có cả chữ và số).
6. Đánh dấu ô **"Tôi đồng ý với Điều khoản sử dụng và Chính sách bảo mật"**. Bạn có thể bấm vào tên văn bản để đọc trước.
7. Bấm **"Tạo tài khoản"** (nếu chọn Giáo viên / Coach / Chuyên gia, nút ghi "Tạo tài khoản & mở gian hàng").
   [Ảnh: form đăng ký đã điền]
8. Màn hình hiện **"Kiểm tra email của bạn"**. Lúc này tài khoản đã được tạo nhưng **chưa dùng được**.
9. Mở email và bấm liên kết kích hoạt. Xem chi tiết ở trang **Hướng dẫn kích hoạt tài khoản**.

> Chọn "Khách hàng" vẫn mở gian hàng được về sau. Loại tài khoản chỉ quyết định bạn được đưa tới đâu sau khi kích hoạt.

## Sau khi kích hoạt

1. Đăng nhập bằng email và mật khẩu vừa đặt.
2. Bạn dùng được ngay, không phải điền thêm hồ sơ.
3. Nếu muốn, vào **Tài khoản** để thêm số điện thoại, tỉnh/thành hoặc ảnh đại diện.

## Lỗi thường gặp

| Bạn thấy | Nghĩa là | Cách xử lý |
| :-- | :-- | :-- |
| "Email này đã được đăng ký." | Email đã có tài khoản. | Bấm "Đăng nhập". Quên mật khẩu thì bấm "Quên mật khẩu?" ở trang Đăng nhập. |
| "Mật khẩu phải có ít nhất 8 ký tự, gồm cả chữ và số." | Mật khẩu quá ngắn hoặc thiếu chữ/số. | Đặt mật khẩu dài hơn, có cả chữ và số. |
| "Bạn cần đồng ý điều khoản trước khi tiếp tục." | Chưa đánh dấu ô đồng ý. | Đánh dấu ô rồi bấm lại. |
| "Bạn thao tác quá nhanh, thử lại sau." | Đăng ký quá nhiều lần trong thời gian ngắn. | Đợi khoảng 1 giờ rồi thử lại. |
| Thông báo văn bản pháp lý vừa thay đổi | Điều khoản hoặc Chính sách bảo mật vừa có bản mới khi bạn đang điền. | Tải lại trang, đọc bản mới và đồng ý lại. |
| Không nhận được email kích hoạt | Email có thể nằm trong thư mục Spam hoặc Quảng cáo. | Xem trang **Hướng dẫn kích hoạt tài khoản**. |

## Cần giúp đỡ?

Liên hệ chúng tôi qua trang **Liên hệ**. Đừng gửi mật khẩu cho bất kỳ ai, kể cả người tự nhận là nhân viên {brand}.

---

## Ghi chú nội bộ (không chép vào CMS)

Mức xác minh: ✅ Long đọc code working tree 2026-10-26 · 🟡 theo brief · ❓ chưa thử trên trình duyệt.

1. **Hiển thị trên trang tuỳ chỉnh (ADR-060)** ✅ code: khối `richText` nhận Markdown GFM (tiêu đề, đậm/nghiêng, danh sách, bảng, liên kết,
   trích dẫn), không HTML thô, không ảnh, có thay `{brand}`. File có tiêu đề nên xuống dòng đơn trong một đoạn được nối lại. Thử trên trình duyệt ❓.
2. Đối chiếu code: 2 loại tài khoản và nhãn nút (`(auth)/_ui/account-type.tsx`, `register-form.tsx`); mật khẩu ≥ 8 ký tự, có chữ và số
   (`isValidPassword`); trùng email → `EMAIL_ALREADY_REGISTERED`; giới hạn 10 lần/giờ/IP (`RATE_LIMITED`); văn bản đổi giữa chừng →
   `LEGAL_TERMS_CHANGED`/`LEGAL_DOCUMENT_CHANGED` (409); tài khoản tạo ở trạng thái chờ kích hoạt; loại tài khoản **không** lưu DB, chỉ quyết định
   nơi chuyển tới sau kích hoạt (`/studio` hoặc `/`); không bắt buộc hoàn thiện hồ sơ (`lib/page-guards.ts`). Câu chữ ô đồng ý trên form phụ thuộc
   văn bản đã có bản hiệu lực hay chưa — bước 6 ghi theo trường hợp đã có cả hai.
3. Nút "Đăng ký" ở đầu trang phụ thuộc menu CMS (ADR-050) — ❓ kiểm menu thật trước khi đăng.

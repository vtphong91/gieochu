> **BẢN DỰ THẢO — viết theo ADR-061/ADR-062, đối chiếu code working tree 2026-10-27 (chưa commit, chưa thử thủ công). Chưa nhập CMS.**
>
> Trang: Hướng dẫn mua và tải tài liệu (đề xuất slug `huong-dan-mua-tai-lieu`, mục "Nội dung > Trang tuỳ chỉnh").
> Người soạn: Long (tài liệu), 2026-10-26; cập nhật 2026-10-27 theo code đã có (gỡ dấu ở mục đã có code). Luồng mua theo **ADR-061** và **ADR-062**
> (`docs/DECISIONS.md`).
>
> Ký hiệu: **[CHƯA CÓ — ADR-061]** = đã chốt nhưng code chưa làm — **hiện không còn dấu nào** (2026-10-27). Mọi mục đã có trong code tại ngày đối chiếu.
> Trước khi đăng: commit + deploy code, thử luồng thật (xem "Ghi chú nội bộ").
>
> Quy ước nhập vào CMS: chỉ chép phần từ "## Tóm tắt" đến hết "## Cần giúp đỡ?"; không chép khối dẫn và "Ghi chú nội bộ". Dán vào khối **`richText`**
> — hiển thị Markdown, tự thay `{brand}` (ADR-060). `[Ảnh: …]` là chỗ đặt ảnh — trang tuỳ chỉnh không nhận ảnh, xoá khi nhập.

## Tóm tắt

1. Mở trang tài liệu, bấm **"Mua ngay"**.
2. Chưa có tài khoản: điền họ tên, email, đánh dấu ô xác nhận. Có tài khoản: đăng nhập.
3. Chọn cách thanh toán và trả tiền trước khi đơn hết hạn.
4. Tải tài liệu ở **Tài khoản → Thư viện**.

## Bước 1 — Chọn tài liệu

1. Tìm tài liệu ở trang **Cửa hàng** hoặc ở gian hàng của giáo viên.
2. Mở trang tài liệu, đọc mô tả, giá, số lượt tải được.
3. Bấm **"Mua ngay"**.
   [Ảnh: trang tài liệu với nút Mua ngay]

Mỗi đơn hàng là **một** tài liệu. Muốn mua nhiều tài liệu thì mua từng tài liệu.

## Bước 2 — Thông tin người mua

**Bạn đã đăng nhập:** bấm "Mua ngay" là có đơn ngay; bạn được đưa tới trang thanh toán của đơn.

**Bạn chưa đăng nhập:** không cần đăng ký trước.

1. Trang **Thanh toán** mở ra (chưa có đơn). Điền **Họ và tên** và **Email**.
2. Chọn **cách thanh toán**.
3. Đánh dấu ô **xác nhận thông tin chính xác và đồng ý Điều khoản sử dụng, Chính sách bảo mật**.
4. Bấm **"Tiếp tục thanh toán"** (tài liệu 0đ: **"Nhận tài liệu"**). {brand} tự tạo tài khoản cho bạn, tạo đơn và cho bạn thanh toán ngay.
5. Bạn nhận email **"Kích hoạt tài khoản {brand} và đặt mật khẩu"**. {brand} **không bao giờ** gửi mật khẩu qua email.
   [Ảnh: ô họ tên, email, cách thanh toán và ô xác nhận ở trang thanh toán]

> Email bạn nhập **đã có tài khoản**: trang báo bạn đăng nhập để mua (tài khoản tạo lúc mua mà chưa kích hoạt: "đăng nhập hoặc gửi lại email kích hoạt"). Đơn không
> tự gắn vào tài khoản đó.

> Có tài khoản nhưng **muốn đăng nhập**: bấm "Đăng nhập" trên trang. Đăng nhập xong bạn quay lại đúng tài liệu đang xem.

## Bước 3 — Thanh toán

1. Xem lại **Tạm tính**, **Giảm giá**, **Tổng cộng**.
2. Có **mã giảm giá**: nhập ở trang thanh toán của đơn, **trước** khi chuyển tiền. (Nếu bạn mua khi chưa đăng nhập, ô mã giảm giá có ở bước này, ngay sau khi đơn được tạo.)
   Nếu nhập mã sau khi đã có mã QR, mã QR được tạo lại theo số tiền mới — hãy dùng **mã QR mới**.
3. Nếu chưa chọn, chọn cách thanh toán người bán đã bật rồi bấm **"Tiếp tục thanh toán"**:
   - **Chuyển khoản ngân hàng** — quét mã QR hoặc chép từng dòng (ngân hàng, số tài khoản, chủ tài khoản, số tiền, nội dung). **Nội dung chuyển khoản phải đúng
     mã đơn.** Người bán đối chiếu tiền về rồi xác nhận, nên có thể mất một khoảng thời gian.
   - **Chuyển khoản (xác nhận tự động)** — quét mã QR, chuyển **đúng số tiền** và **đúng nội dung**. Tiền về là đơn tự xác nhận.
   - **Ví MoMo** — mở app MoMo, chọn chuyển tiền tới **số điện thoại** của người bán (chép số điện thoại, tên chủ ví, số tiền, nội dung bằng nút sao chép). **Nội dung phải
     đúng mã đơn.**
     Người bán đối chiếu lịch sử ví rồi xác nhận.
   [Ảnh: khối chuyển khoản ngân hàng có mã QR và nút sao chép; khối Ví MoMo có các dòng sao chép]
4. Chuyển khoản ngân hàng: trên điện thoại mã QR nằm trên cùng. Bấm **"Tải ảnh QR"** để lưu mã QR về máy, rồi mở ứng dụng ngân hàng quét từ ảnh. (Ví MoMo không có
   mã QR.)
5. **Chuyển khoản ngân hàng hoặc Ví MoMo:** chuyển xong thì bấm **"Tôi đã chuyển khoản"**. Trang chuyển sang **"Chờ người bán xác nhận"** và người bán được báo. Bấm
   nhầm thì bấm **"Tôi chưa chuyển khoản"**.
6. Muốn **đổi cách thanh toán** của đơn đang chờ: bấm **"Đổi"** cạnh cách đang dùng. (Đã bấm "Tôi đã chuyển khoản" thì phải bấm "Tôi chưa chuyển khoản" trước.)
7. Không muốn mua nữa: bấm **"Huỷ đơn"** và xác nhận. **Nếu đã chuyển tiền, đừng huỷ** — hãy bấm "Tôi đã chuyển khoản".
8. Tài liệu **0đ**: không cần thanh toán, tài liệu vào Thư viện ngay.

### Đơn được giữ bao lâu?

Tính từ lúc đặt đơn:

| Cách thanh toán | Đơn được giữ |
| :-- | :-- |
| Chuyển khoản ngân hàng | 72 giờ |
| Ví MoMo | 72 giờ |
| Chuyển khoản (xác nhận tự động) | 48 giờ |

- Đổi cách thanh toán **không** kéo dài thời gian giữ đơn — thời hạn luôn tính từ lúc đặt đơn.
- Trang thanh toán ghi rõ **giờ hết hạn** của đơn.
- **Quá hạn thì đơn hết hạn.** Người bán chỉ còn xác nhận được nếu bạn **đã bấm "Tôi đã chuyển khoản" trước khi hết hạn**.
- Đã chuyển tiền nhưng đơn báo hết hạn: **đừng đặt đơn mới để trả lần nữa.** Giữ lại mã đơn và liên hệ người bán.

**Chuyển sai số tiền:** đơn không tự xác nhận. Người bán được báo để đối chiếu. Hãy liên hệ người bán kèm mã đơn.

## Bước 4 — Theo dõi đơn

1. Xem đơn ở **Tài khoản → Đơn hàng**. Đơn chưa trả có trạng thái **"Chờ thanh toán"**.
2. Khi còn đơn chưa thanh toán, đầu các trang **Tài khoản** hiện dòng: "Anh/Chị {tên} có đơn cần thanh toán để hoàn tất đơn hàng!" kèm link xem đơn.
   [Ảnh: dòng nhắc đơn chờ thanh toán ở đầu trang Tài khoản]
3. Email bạn nhận:
   - Khi chọn hoặc đổi cách thanh toán: email **"Thông tin thanh toán đơn {mã đơn}"** có thông tin chuyển khoản và nút quay lại trang thanh toán.
   - **Một email nhắc** khi đơn còn khoảng 24 giờ trước khi hết hạn.
   - Khi thanh toán xong: email **thanh toán thành công** có nút **"Tải tài liệu"** dẫn về **Thư viện**.
4. Trang thanh toán cũng hiện **"Thanh toán thành công"** kèm nút **"Tải tài liệu"**.

## Bước 5 — Tải tài liệu

1. Vào **Tài khoản → Thư viện** (hoặc bấm "Tải tài liệu" sau khi thanh toán — Thư viện mở đúng tài liệu vừa mua).
2. Tài liệu được nhóm theo gian hàng. Mỗi tài liệu ghi số lượt tải còn lại, ví dụ "Còn 4 lượt tải" hoặc "Không giới hạn lượt tải".
3. Bấm **"Tải xuống"** ở tệp cần tải. Với tài liệu là liên kết ngoài, nút ghi **"Mở link tài liệu"**.
   [Ảnh: thẻ tài liệu trong Thư viện]
4. Liên kết tải chỉ dùng được trong **vài phút** (tối đa 10 phút). Hết hạn thì quay lại Thư viện bấm tải lại.
5. **Mỗi lần tải thành công trừ một lượt.** Hãy lưu tệp vào máy, đừng tải lại nhiều lần.
6. Hết lượt tải: thẻ ghi "Hết lượt tải". Liên hệ người bán nếu cần thêm lượt (người bán có thể cấp thêm).

**Mua khi chưa có tài khoản:** bạn tải được ngay trên trình duyệt đang dùng để mua, trong tối đa **24 giờ**. Muốn tải lại sau (đăng nhập lại, hoặc dùng máy khác), hãy
**kích hoạt tài khoản** bằng email "Kích hoạt tài khoản và đặt mật khẩu" (liên kết dùng trong 7 ngày) rồi đăng nhập. Xem **Hướng dẫn kích hoạt tài khoản**.

## Câu hỏi thường gặp

- **Không thấy tài liệu trong Thư viện sau khi chuyển khoản?** Với chuyển khoản ngân hàng hoặc Ví MoMo, người bán cần đối chiếu rồi xác nhận — nhớ bấm "Tôi đã chuyển
  khoản". Kiểm tra đơn ở Tài khoản → Đơn hàng. Lâu chưa được xác nhận thì liên hệ người bán kèm mã đơn.
- **Không thấy email?** Xem thư mục Spam hoặc Quảng cáo — như trong **Hướng dẫn kích hoạt tài khoản**.
- **Quên mật khẩu mà tài khoản tạo lúc mua chưa kích hoạt?** Dùng "Quên mật khẩu" hoặc "Gửi lại email kích hoạt" — bạn sẽ nhận email "Kích hoạt tài khoản và đặt mật
  khẩu".
- **Tài liệu bị gỡ do vi phạm thì sao?** Thư viện hiện khung cho bạn chọn **"Tải lần cuối"** hoặc **"Yêu cầu hoàn tiền"**. Tài khoản tạo lúc mua cần **kích hoạt**
  trước mới chọn được — khi chưa kích hoạt, Thư viện ghi "Kích hoạt tài khoản (qua email) để chọn tải lần cuối hoặc hoàn tiền." kèm link **"Gửi lại email kích hoạt"**.

## Cần giúp đỡ?

Liên hệ người bán qua gian hàng, hoặc liên hệ {brand} qua trang **Liên hệ**.

---

## Ghi chú nội bộ (không chép vào CMS)

Mức xác minh: ✅ Long đọc code working tree 2026-10-27 (chưa commit) · ❓ chưa ai thử trên trình duyệt/hộp thư/cổng thật.

1. **Đã gỡ dấu [CHƯA CÓ — ADR-061]** ở: mua không cần đăng ký (`startGuestCheckoutAction`, 1 ô đồng ý, email "Kích hoạt tài khoản {brand} và đặt mật khẩu", `EMAIL_EXISTS` /
   `EMAIL_EXISTS_GUEST`); hạn giữ đơn 72/48 giờ từ lúc đặt, đổi không gia hạn, không cửa sổ trễ trừ ngoại lệ "báo chuyển trước hạn"; đổi cách thanh toán (nút "Đổi");
   "Tôi đã chuyển khoản"/"Tôi chưa chuyển khoản"; "Huỷ đơn"; dòng nhắc trên trang Tài khoản; email lúc chọn/đổi cách thanh toán (tối đa 3/đơn) + 1 email nhắc; nút
   "Tải tài liệu" trong email và trên trang (Thư viện `?tai-lieu=`); khách vãng lai tải ngay trong phiên ≤ 24 giờ; quên mật khẩu với tài khoản chưa kích hoạt gửi email kích
   hoạt.
2. **Câu chữ đã đổi theo code:** nhãn khách "Chuyển khoản ngân hàng", "Chuyển khoản (xác nhận tự động)", "Ví MoMo" (`CUSTOMER_PROVIDER_LABELS`); không còn mục riêng
   "Đơn chờ thanh toán" ở `/account/orders` — đơn chờ có trạng thái "Chờ thanh toán", số đếm "N đơn chờ thanh toán" ở trang tổng quan Tài khoản; trang đơn hết hạn không còn
   câu "Vui lòng đặt lại đơn hàng mới" (nay: "Nếu bạn đã chuyển tiền, hãy giữ lại mã đơn…"; nút "Đặt lại đơn" vẫn có khi tài liệu còn bán).
3. **Đã gỡ dấu cuối cùng (2026-10-27):** Quốc quyết guest **không** được chọn "Tải lần cuối"/"Yêu cầu hoàn tiền" (phải xác minh email trước); Hiếu đã thay hai nút bằng
   câu hướng dẫn + link "Gửi lại email kích hoạt" (markup tối thiểu, chờ Phong hoàn thiện — chép lại câu chữ nếu Phong đổi). ✅ code (KB-Audit §46).
4. MoMo API (`MOMO`) cho khách có nhãn **"Ví MoMo (tự động)"** (✅ code) — trang này không nhắc vì MoMo API đang tắt.
5. Câu thông báo trên trang Tài khoản lấy theo code `AccountShell` ("Anh/Chị {họ tên} …"; không có họ tên → "Anh/Chị"). `{tên}` ở trên **không** phải biến CMS.
6. Không mô tả đếm ngược (theo brief).
7. Bổ sung ADR-059 lần 4 (2026-10-27): MoMo thủ công **không có QR** — đã sửa Bước 3 mục 3–4 (bỏ "quét mã QR nếu có", "Tải ảnh QR" chỉ cho ngân hàng). ✅ code (working tree).

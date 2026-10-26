> **BẢN DỰ THẢO — viết theo ADR-061 đã chốt, phần lớn CHƯA có code. Chưa nhập CMS.**
>
> Trang: Hướng dẫn mua và tải tài liệu (đề xuất slug `huong-dan-mua-tai-lieu`, mục "Nội dung > Trang tuỳ chỉnh").
> Người soạn: Long (tài liệu), 2026-10-26, theo brief Quốc. Luồng mua mô tả theo **ADR-061** (`docs/DECISIONS.md`, chủ dự án chốt 2026-10-26).
>
> Ký hiệu: **[CHƯA CÓ — ADR-061]** = đã chốt nhưng code chưa làm. **Không đăng trang khi còn dấu này** — sửa lại câu chữ theo code thật khi Hiếu
> làm xong. Mục không có dấu = đã có trong code tại ngày soạn.
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
3. Bấm **"Mua ngay"**. Bạn được đưa tới trang thanh toán của một đơn hàng cho đúng tài liệu này.
   [Ảnh: trang tài liệu với nút Mua ngay]

Mỗi đơn hàng là **một** tài liệu. Muốn mua nhiều tài liệu thì mua từng tài liệu.

## Bước 2 — Thông tin người mua

**Bạn đã có tài khoản:** đăng nhập rồi mua như bình thường. Đăng nhập xong bạn quay lại đúng tài liệu đang xem.

**Bạn chưa có tài khoản:** không cần đăng ký trước. [CHƯA CÓ — ADR-061]

1. Ở trang thanh toán, điền **Họ và tên** và **Email**.
2. Đánh dấu ô **xác nhận thông tin và đồng ý Điều khoản sử dụng**.
3. {brand} tự tạo tài khoản cho bạn và cho bạn thanh toán ngay.
4. Bạn nhận email **"Kích hoạt tài khoản và đặt mật khẩu"**. {brand} **không bao giờ** gửi mật khẩu qua email.
   [Ảnh: ô họ tên, email và ô xác nhận ở trang thanh toán]

> Email bạn nhập **đã có tài khoản**: trang sẽ yêu cầu bạn đăng nhập. Đơn không tự gắn vào tài khoản đó. [CHƯA CÓ — ADR-061]

## Bước 3 — Thanh toán

1. Xem lại **Tạm tính**, **Giảm giá**, **Tổng cộng**.
2. Có **mã giảm giá**: nhập mã **trước** khi chọn cách thanh toán. Nếu nhập mã sau khi đã có mã QR, mã QR được tạo lại theo số tiền mới — hãy dùng
   **mã QR mới**.
3. Chọn cách thanh toán người bán đã bật, bấm **"Tiếp tục thanh toán"**:
   - **Chuyển khoản ngân hàng (QR thủ công)** — quét mã QR hoặc chép từng dòng (ngân hàng, số tài khoản, chủ tài khoản, số tiền, nội dung). **Nội dung
     chuyển khoản phải đúng mã đơn.** Người bán đối chiếu tiền về rồi xác nhận, nên có thể mất một khoảng thời gian.
   - **SePay (tự động)** — quét mã QR, chuyển **đúng số tiền** và **đúng nội dung**. Tiền về là đơn tự xác nhận.
   - **MoMo (chuyển tay)** — chuyển vào ví MoMo của người bán (quét mã QR nếu có, hoặc chép số điện thoại, tên chủ ví, số tiền, nội dung). **Nội dung phải đúng
     mã đơn.** Người bán đối chiếu lịch sử ví rồi xác nhận. Nút "Tôi đã chuyển khoản" chỉ là lời nhắn, không tự xác nhận đơn.
   [Ảnh: khối chuyển khoản có mã QR và nút sao chép]
4. Có thể bấm **"Tải ảnh QR"** để lưu mã QR về máy, rồi mở ứng dụng ngân hàng quét từ ảnh.
5. Muốn **đổi cách thanh toán** của đơn đang chờ: chọn lại ở trang thanh toán. [CHƯA CÓ — ADR-061]
6. Tài liệu **0đ**: không cần thanh toán, tài liệu vào Thư viện ngay.

### Đơn được giữ bao lâu?

| Cách thanh toán | Đơn được giữ |
| :-- | :-- |
| Chuyển khoản ngân hàng (QR thủ công) | 72 giờ |
| MoMo | 72 giờ |
| SePay | 48 giờ |

[CHƯA CÓ — ADR-061]

- Trang thanh toán ghi rõ **giờ hết hạn** của đơn.
- **Quá hạn thì đơn hết hạn.** Người bán không xác nhận đơn đã hết hạn nữa. [CHƯA CÓ — ADR-061]
- Đã chuyển tiền nhưng đơn báo hết hạn: **đừng đặt đơn mới để trả lần nữa.** Liên hệ người bán kèm mã đơn.

**Chuyển sai số tiền:** đơn không tự xác nhận. Người bán được báo để đối chiếu. Hãy liên hệ người bán kèm mã đơn.

## Bước 4 — Theo dõi đơn

1. Xem đơn ở **Tài khoản → Đơn hàng**. Đơn chưa trả nằm trong danh sách **"Đơn chờ thanh toán"**. [CHƯA CÓ — ADR-061]
2. Khi còn đơn chưa thanh toán, đầu trang **Tài khoản** hiện thông báo: "Anh/Chị {tên} có đơn cần thanh toán để hoàn tất đơn hàng!" [CHƯA CÓ — ADR-061]
   [Ảnh: thông báo đơn chờ thanh toán ở đầu trang Tài khoản]
3. Email bạn nhận:
   - Khi chọn cách thanh toán: email có thông tin chuyển khoản và nút quay lại trang thanh toán. [CHƯA CÓ — ADR-061]
   - **Một email nhắc** khi đơn còn khoảng 24 giờ trước khi hết hạn. [CHƯA CÓ — ADR-061]
   - Khi thanh toán xong: email **thanh toán thành công** có nút **"Tải tài liệu"** dẫn về **Thư viện**. (Hiện email đã có liên kết về Thư viện; nút là phần
     ADR-061 đổi.) [CHƯA CÓ — ADR-061]
4. Trang thanh toán cũng hiện **"Thanh toán thành công"** kèm liên kết "Xem tài liệu đã mua".

## Bước 5 — Tải tài liệu

1. Vào **Tài khoản → Thư viện** (hoặc bấm "Xem tài liệu đã mua" sau khi thanh toán).
2. Tài liệu được nhóm theo gian hàng. Mỗi tài liệu ghi số lượt tải còn lại, ví dụ "Còn 4 lượt tải" hoặc "Không giới hạn lượt tải".
3. Bấm **"Tải xuống"** ở tệp cần tải. Với tài liệu là liên kết ngoài, nút ghi **"Mở link tài liệu"**.
   [Ảnh: thẻ tài liệu trong Thư viện]
4. Liên kết tải chỉ dùng được trong **vài phút** (tối đa 10 phút). Hết hạn thì quay lại Thư viện bấm tải lại.
5. **Mỗi lần tải thành công trừ một lượt.** Hãy lưu tệp vào máy, đừng tải lại nhiều lần.
6. Hết lượt tải: thẻ ghi "Hết lượt tải". Liên hệ người bán nếu cần thêm lượt (người bán có thể cấp thêm).

**Mua khi chưa có tài khoản:** bạn tải được ngay trên trình duyệt đang dùng để mua. Muốn tải lại sau (đăng nhập lại, hoặc dùng máy khác), hãy **kích hoạt tài
khoản** bằng email "Kích hoạt tài khoản và đặt mật khẩu" trước. Xem **Hướng dẫn kích hoạt tài khoản**. [CHƯA CÓ — ADR-061]

## Câu hỏi thường gặp

- **Không thấy tài liệu trong Thư viện sau khi chuyển khoản?** Với chuyển khoản thủ công hoặc MoMo, người bán cần đối chiếu rồi xác nhận. Kiểm tra đơn ở
  Tài khoản → Đơn hàng. Lâu chưa được xác nhận thì liên hệ người bán kèm mã đơn.
- **Không thấy email?** Xem thư mục Spam hoặc Quảng cáo — như trong **Hướng dẫn kích hoạt tài khoản**.
- **Tài liệu bị gỡ do vi phạm thì sao?** Thư viện hiện khung cho bạn chọn **"Tải lần cuối"** hoặc **"Yêu cầu hoàn tiền"**.

## Cần giúp đỡ?

Liên hệ người bán qua gian hàng, hoặc liên hệ {brand} qua trang **Liên hệ**.

---

## Ghi chú nội bộ (không chép vào CMS)

Mức xác minh: ✅ Long đọc code working tree 2026-10-26 · 🟡 theo ADR-061 (`docs/DECISIONS.md`) · ❓ chưa thử trình duyệt/cổng thật.

1. **Đã có trong code** ✅: chỉ một nút "Mua ngay" (chưa đăng nhập ghi "Đăng nhập để mua", đăng nhập xong quay lại trang tài liệu); 1 đơn = 1 tài liệu (`createOrder`);
   chọn cổng bằng danh sách + nút "Tiếp tục thanh toán" (`provider-panel.tsx`); nhãn "QR chuyển khoản thủ công", "SePay (tự động)"; "Tạm tính/Giảm giá/Tổng
   cộng"; mã giảm giá tạo lại QR (ADR-056); "Tải ảnh QR" (`BankTransferPanel`); "Thanh toán thành công" + "Xem tài liệu đã mua"; email `order_paid` có liên kết
   `/account/library`; người bán được báo khi sai tiền (ADR-059); Thư viện `/account/library` (nhãn lượt tải, "Tải xuống"/"Mở link tài liệu"); mỗi lần tải thành
   công +1 `downloadsUsed`; URL tải presigned ≤ 600 giây; "Tải lần cuối"/"Yêu cầu hoàn tiền" (ADR-039); đơn 0đ tự giao.
2. **[CHƯA CÓ — ADR-061]** — hiện code khác:
   - Mua không cần đăng ký (Q1): hiện bắt buộc đăng nhập bằng tài khoản đã kích hoạt (`requireVerifiedAccess`; chưa kích hoạt không đăng nhập được).
   - Hạn 72 giờ / 48 giờ, không cửa sổ trễ (Q13 + Q5 sửa): hiện một hạn chung `orderPendingTtlMinutes` (mặc định 60 phút, tối đa 24 giờ) + cửa sổ xác nhận trễ 24
     giờ (`canManuallyConfirmOrder`).
   - Đổi cách thanh toán (Q10): hiện trang thanh toán **ẩn** danh sách cổng khi đơn đã có cổng (`enabledProviders` chỉ nạp khi `!order.provider`).
   - Danh sách "Đơn chờ thanh toán", thông báo header Tài khoản (Q8), email lúc chọn cổng + email nhắc (Q7), nút "Tải tài liệu" trong email (Q12): chưa có.
   - (Đã có từ ADR-059 bổ sung lần 3, chưa commit) MoMo cá nhân `MOMO_MANUAL`, nhãn "MoMo (chuyển tay)", khối `WalletTransferPanel`; ảnh QR chỉ có khi người bán điền số TK
     VietQR của ví — **chờ kiểm thử thật** (`MoMo-Manual-Verification-Runbook`) ❓; migration enum chưa áp. Hạn 72 giờ vẫn [CHƯA CÓ — ADR-061].
   - Trang đơn hết hạn hiện ghi "Vui lòng đặt lại đơn hàng mới" — cần sửa cho khớp cảnh báo "đừng trả 2 lần".
3. Tên mục "Đơn chờ thanh toán", câu thông báo header lấy nguyên văn ADR-061 Q8 (`{name}` trong ADR viết thành `{tên}` ở đây để không nhầm với biến
   `{brand}` — **không** phải biến CMS). Khi có code, chép lại đúng chữ trên giao diện.
4. Không mô tả đếm ngược (theo brief).

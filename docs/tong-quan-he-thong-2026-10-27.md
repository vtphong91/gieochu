# Tổng quan hệ thống Gieo Chữ

> **Cập nhật đến ngày 2026-10-30.** Người viết: Long (tài liệu), theo yêu cầu của chủ dự án qua Quốc.
> Dành cho: chủ dự án, đối tác, người bán tiềm năng, người mới vào dự án. Viết theo góc nhìn "người dùng làm được gì".
> Tên thương hiệu hiển thị trên web do quản trị viên cấu hình; tài liệu này gọi chung là **Gieo Chữ**.
>
> **Ghi chú trạng thái:** mọi chức năng liệt kê ở mục 3 đã có trong mã nguồn. Riêng phần ghi **"đã code, đang thử nghiệm"** là đợt
> nâng cấp luồng mua mới nhất (ADR-061/062): đã viết xong nhưng **chưa đưa vào bản chính thức và chưa thử với người dùng/cổng thanh toán thật**.
> Việc đưa từng phần lên môi trường chạy thật (beta trên máy chủ riêng) do chủ dự án quyết định.

---

## 1. Gieo Chữ là gì?

Gieo Chữ là **nền tảng cho thuê gian hàng trực tuyến** (SaaS đa gian hàng) giúp **giáo viên, coach, chuyên gia** mở gian hàng riêng và **bán tài liệu số**:
đề thi, giáo án, slide bài giảng, sách điện tử, khoá học dạng tài liệu…

- **Người bán** có một trang bán hàng riêng (`gieochu.net/ten-gian-hang`), tự đăng tài liệu, đặt giá, nhận tiền trực tiếp vào tài khoản của mình.
- **Người mua** (phụ huynh, học sinh, giáo viên khác) tìm tài liệu, thanh toán bằng chuyển khoản/ví, rồi tải về trong **Thư viện** của mình.
- **Nền tảng** lo phần kỹ thuật: lưu trữ tệp an toàn, link tải có hạn, email thông báo, trang pháp lý, chống gian lận lượt tải.

**Giá trị chính:**
- Mở gian hàng **miễn phí**, bán được ngay (gói Miễn phí không hết hạn); nâng cấp gói khi cần thêm dung lượng, số tài liệu.
- Tiền bán tài liệu **về thẳng tài khoản người bán** — nền tảng không giữ tiền hộ.
- Tài liệu được bảo vệ: chỉ người đã mua mới tải được, link tải chỉ sống vài phút, có giới hạn số lượt tải.
- Mỗi gian hàng tách bạch dữ liệu với gian hàng khác.
- Tối ưu cho **điện thoại** — phần lớn người dùng mua và đọc trên di động.

---

## 2. Ba vai trò

### 2.1. Khách hàng (người mua)
- Xem trang chủ, **Cửa hàng** tổng hợp tài liệu của mọi gian hàng, trang của từng gian hàng, trang chi tiết tài liệu, bài viết của gian hàng.
- **Mua tài liệu** bằng chuyển khoản ngân hàng (QR), chuyển khoản xác nhận tự động (SePay) hoặc ví MoMo; nhập mã giảm giá.
- **Mua không cần đăng ký trước** — chỉ điền họ tên, email *(đã code, đang thử nghiệm)*.
- Tải tài liệu đã mua trong **Thư viện**; xem lịch sử **Đơn hàng**.
- Viết **đánh giá** cho tài liệu đã mua; **báo cáo vi phạm** nội dung.
- Quản lý **tài khoản**: hồ sơ, ảnh đại diện, đổi mật khẩu, đổi email, xem và đăng xuất các thiết bị đang đăng nhập.
- Có thể tự **mở gian hàng** để trở thành người bán bất cứ lúc nào.

### 2.2. Người bán (chủ gian hàng, nhân viên — khu **Studio**)
- **Tổng quan**: doanh thu, số đơn, tài liệu bán chạy theo khoảng thời gian chọn.
- Quản lý **tài liệu**, **trang bán hàng**, **bài viết**, **mã giảm giá**, **link chia sẻ**.
- Xử lý **đơn hàng**: xác nhận đã nhận tiền (chuyển khoản thủ công), huỷ đơn, đánh dấu hoàn tiền, cấp thêm/thu hồi lượt tải, ghi chú nội bộ.
- Xem **giao dịch cần xử lý** (tiền về không khớp đơn, sai số tiền, về sau hạn giữ đơn).
- Xem danh sách **khách hàng** của gian hàng, ghi chú về khách.
- Đọc **hộp thư liên hệ** từ khách gửi qua trang bán hàng; xem và ẩn/trả lời **đánh giá**.
- Cấu hình **thanh toán** của gian hàng (tài khoản ngân hàng, SePay, MoMo cá nhân), **thương hiệu** gian hàng, địa chỉ gian hàng.
- Mua/gia hạn **gói dịch vụ**, xem hoá đơn gói, yêu cầu hoàn tiền gói.
- Xem **nhật ký hoạt động** của gian hàng.

### 2.3. Quản trị hệ thống (khu **System Center**)
- Quản lý **người dùng** (khoá/mở khoá — không xoá tài khoản), **gian hàng** (khoá/mở khoá), **vai trò và quyền**.
- Quản lý **gói dịch vụ** (giá, hạn mức), **hoá đơn gói**, **đơn hàng gói dịch vụ** (thuê bao của các gian hàng), **yêu cầu hoàn tiền gói**, **giao dịch cổng thanh toán**.
- Quản lý **danh mục tài liệu**.
- Soạn nội dung **CMS**: trang chủ, menu đầu/chân trang, trang Cửa hàng, trang Bảng giá, trang tuỳ chỉnh, **văn bản pháp lý** có phiên bản.
- Xử lý **báo cáo vi phạm** (ẩn/lưu trữ nội dung, khoá gian hàng, bác bỏ).
- **Cấu hình hệ thống**: thương hiệu, cài đặt chung, email hỗ trợ, máy chủ gửi email (SMTP), lưu trữ tệp, dịch vụ ảnh (Cloudinary), cổng thanh toán của nền tảng.
- Xem **thống kê** bán tài liệu toàn hệ thống (số tổng hợp, không xem chi tiết đơn/khách của gian hàng) và **nhật ký hoạt động**.

> **Nguyên tắc riêng tư:** quản trị viên hệ thống **không** có màn hình nào xem chi tiết đơn hàng hay khách hàng của từng gian hàng — chỉ xem số liệu tổng hợp.

---

## 3. Danh mục chức năng hiện có

### 3.1. Tài khoản và phiên đăng nhập
- Đăng ký bằng email + mật khẩu (chọn loại tài khoản: giáo viên/coach hoặc khách hàng); đồng ý Điều khoản và Chính sách bảo mật **theo đúng phiên bản** đang hiệu lực.
- Kích hoạt tài khoản qua email (có gửi lại, liên kết có thời hạn); quên mật khẩu / đặt lại mật khẩu.
- **"Ghi nhớ đăng nhập"** (mặc định tắt); tự đăng xuất khi không thao tác quá lâu và khi phiên quá thời hạn tối đa — quản trị viên chỉnh được các mốc này; cảnh báo trước khi
  hết phiên.
- Khoá tạm tài khoản sau nhiều lần nhập sai mật khẩu.
- **Danh sách thiết bị** đang đăng nhập, đăng xuất từng thiết bị; đổi mật khẩu thì các thiết bị khác bị đăng xuất.
- Hồ sơ cá nhân, ảnh đại diện, đổi email (xác nhận qua email mới).
- **Mua không cần đăng ký trước:** tài khoản được tạo tự động lúc mua; người mua nhận email **"Kích hoạt tài khoản và đặt mật khẩu"** (liên kết dùng một lần, 7 ngày); trước khi
  kích hoạt, chỉ dùng được trang thanh toán, Đơn hàng, Thư viện trong tối đa 24 giờ. Nền tảng không bao giờ gửi mật khẩu qua email *(đã code, đang thử nghiệm)*.

### 3.2. Gian hàng và trang bán hàng
- Mở gian hàng miễn phí (đồng ý Chính sách người bán), chọn địa chỉ gian hàng.
- **Trang bán hàng** dựng bằng các khối nội dung (giới thiệu, tài liệu, bài viết, cảm nhận, đánh giá, liên hệ…), có nháp/xuất bản; màu sắc và logo theo thương hiệu gian hàng.
- **Form liên hệ** trên trang bán hàng → hộp thư trong Studio + email báo người bán.
- Gian hàng bị **tạm ngưng** thì khách chỉ thấy trang "tạm ngưng hoạt động", không thấy tài liệu/bài viết; gian hàng bị **khoá** thì không truy cập được.
- Chủ gian hàng và nhân viên (phân quyền theo vai trò).

### 3.3. Tài liệu
- Tạo/sửa tài liệu: tiêu đề, mô tả ngắn, mô tả chi tiết (soạn có định dạng, chèn ảnh), ảnh bìa, giá, giá khuyến mãi theo thời gian, danh mục, loại tài liệu, thẻ.
- **Tải tệp** lên (tệp lớn chia phần), hoặc giao tài liệu bằng **link ngoài**; kiểm tra định dạng tệp.
- **Xem trước** trang tài liệu trước khi xuất bản; chế độ Riêng tư / Công khai / Đã lưu trữ.
- **Giới hạn lượt tải** cho mỗi người mua (hoặc không giới hạn); người bán cấp thêm lượt khi cần.
- Xoá tài liệu chưa ai mua (giải phóng dung lượng); tài liệu đã có người mua thì chỉ **lưu trữ** để giữ quyền tải của khách.
- **Link chia sẻ riêng** (có thể đặt mật khẩu, giới hạn số lần dùng, thu hồi được) để gửi tài liệu cho người cụ thể.
- Hạn mức theo gói: số tài liệu, dung lượng lưu trữ, dung lượng ảnh.

### 3.4. Cửa hàng và danh mục
- Trang **Cửa hàng** tổng hợp tài liệu của mọi gian hàng đang hoạt động: kệ tài liệu bán chạy, mới, theo danh mục, gian hàng nổi bật; nội dung trang do quản trị viên soạn.
- Trang **danh sách tài liệu** lọc theo danh mục, sắp xếp, phân trang; **tìm kiếm không dấu** (gõ "toan" vẫn ra "Toán").
- **Trang chủ** dùng số liệu thật (số tài liệu, gian hàng, tài liệu nổi bật, số đã bán).

### 3.5. Mua hàng và thanh toán
- Nút **"Mua ngay"** → trang thanh toán của đơn. Mỗi đơn một tài liệu. Tài liệu 0đ nhận ngay, không cần thanh toán.
- **Cách thanh toán** (người bán bật cái nào thì khách thấy cái đó):
  - **Chuyển khoản ngân hàng** bằng mã QR VietQR hoặc chép từng dòng; người bán đối chiếu sao kê rồi xác nhận.
  - **Chuyển khoản xác nhận tự động (SePay)**: tiền về đúng số, đúng nội dung → đơn tự xác nhận, khách nhận tài liệu ngay.
  - **Ví MoMo** (cá nhân, xác nhận thủ công): khách chuyển theo số điện thoại ví; người bán đối chiếu lịch sử ví rồi xác nhận.
- Nút **"Tải ảnh QR"**, nút **sao chép** từng dòng (số tài khoản, số tiền, nội dung).
- Mã giảm giá áp sau khi đã có QR → QR tự tạo lại theo số tiền mới.
- **Đợt nâng cấp luồng mua** *(đã code, đang thử nghiệm)*:
  - Trang thanh toán mới: 2 cột trên máy tính, mã QR đặt trên cùng trên điện thoại, thanh nút dính đáy màn hình, các bước tiến độ.
  - **Giữ đơn theo cách thanh toán**, tính từ lúc đặt: **72 giờ** cho chuyển khoản ngân hàng/MoMo, **48 giờ** cho SePay. Đổi cách thanh toán không kéo dài thời gian giữ.
  - Nút **"Tôi đã chuyển khoản"** (báo người bán, hoàn tác được); đơn hết hạn vẫn được người bán xác nhận nếu khách đã bấm nút này trước hạn.
  - **Đổi cách thanh toán** của đơn đang chờ; khách **tự huỷ** đơn.
  - Mua không cần đăng ký trước (mục 3.1).
  - Dòng nhắc "có đơn cần thanh toán" ở khu Tài khoản.

### 3.6. Mã giảm giá
- Người bán tạo mã: giảm theo % hoặc số tiền, thời gian áp dụng, giới hạn tổng lượt và lượt mỗi khách, áp cho tất cả hoặc một số tài liệu.
- Giới hạn "mỗi khách" tính cả đơn đang chờ của chính khách đó *(đã code, đang thử nghiệm)*.

### 3.7. Đơn hàng và giao dịch cần xử lý (Studio)
- Danh sách đơn: lọc theo trạng thái, khoảng ngày, tài liệu, khách; tìm theo mã đơn/họ tên/email không dấu; phân trang; sắp xếp.
- Chi tiết đơn: thông tin thanh toán, dòng thời gian đơn, email đã gửi, quyền tải của khách, ghi chú nội bộ (chỉ người viết xoá được).
- Thao tác: xác nhận thanh toán thủ công (bắt buộc ghi chú), huỷ, đánh dấu đã hoàn tiền, cấp thêm/thu hồi lượt tải.
- **Giao dịch cần xử lý:** tiền về qua cổng nhưng không tìm thấy đơn, sai số tiền, hoặc về sau hạn giữ đơn; người bán được email báo khi khách chuyển sai số tiền.
- Đơn khách đã báo "Tôi đã chuyển khoản" luôn xếp đầu danh sách *(đã code, đang thử nghiệm)*.

### 3.8. Thư viện tải tài liệu (khách)
- Mọi tài liệu đã mua, nhóm theo gian hàng; số lượt tải còn lại; nút tải xuống hoặc mở link tài liệu.
- Link tải chỉ dùng được vài phút, tải xong trừ một lượt.
- Tài liệu bị gỡ do vi phạm: khách chọn **"Tải lần cuối"** hoặc **"Yêu cầu hoàn tiền"** (người bán xử lý trong 7 ngày).

### 3.9. Đánh giá và báo cáo vi phạm
- **Đánh giá:** chỉ người đã mua mới đánh giá được (sao + nội dung); người bán trả lời hoặc ẩn đánh giá; điểm trung bình hiện trên trang tài liệu; trang bán hàng có khối đánh giá
  thật.
- **Báo cáo vi phạm:** ai cũng gửi được (kể cả chưa đăng nhập), ẩn danh với người bán, có chống gửi tràn; quản trị viên ẩn/lưu trữ nội dung, khoá gian hàng hoặc bác bỏ, và có
  **khoá kiểm duyệt** để người bán không tự mở lại. Người bán xác nhận **cam kết bản quyền** mỗi lần xuất bản tài liệu.

### 3.10. Bài viết của gian hàng
- Người bán viết bài (soạn có định dạng, tối đa 6 ảnh), gắn một tài liệu liên quan, ghim một bài; nháp/đăng; bài vi phạm bị ẩn.
- Bài hiện ở trang danh sách bài và trang bài viết của gian hàng, và trong khối "Bài viết" trên trang bán hàng.
- Nâng cấp blog đang lên kế hoạch (mục 4).

### 3.11. Gói dịch vụ, hoá đơn, hoàn tiền gói
- Trang **Bảng giá** công khai (nội dung do quản trị viên soạn); gói tháng và gói năm, phần trăm tiết kiệm tính từ giá thật.
- **Gói Miễn phí không hết hạn**; gói trả phí có thời gian ân hạn khi hết kỳ, rồi tự về gói Miễn phí (không mất dữ liệu).
- Người bán mua/gia hạn gói bằng chuyển khoản QR, SePay hoặc MoMo cá nhân; quản trị viên xác nhận hoá đơn chuyển khoản thủ công (kể cả **xác nhận trễ** hoá đơn đã hết hạn, có
  quy tắc chống trả hai lần).
- **Hoàn tiền gói:** trong 7 ngày kể từ lần thanh toán gói đầu tiên, hoàn 100%; thông tin nhận tiền được mã hoá và tự xoá sau khi xử lý.
- Quản trị viên xem lịch sử hoá đơn, danh sách thuê bao, **giao dịch cổng** (khớp/không khớp/sai tiền) và xác nhận hoá đơn từ một giao dịch cụ thể.

### 3.12. CMS — nội dung quản trị viên tự soạn
- **Trang chủ** (11 loại khối: giới thiệu, số liệu, danh mục, giáo viên, tài liệu nổi bật, các bước, cộng đồng, câu hỏi thường gặp…) + **SEO** trang chủ, có nháp/xuất bản/khôi phục.
- **Menu đầu trang và chân trang**.
- **Trang Cửa hàng**, **trang Bảng giá**.
- **Trang tuỳ chỉnh** (giới thiệu, hướng dẫn…) soạn bằng Markdown (tiêu đề, danh sách, bảng, liên kết).
- **Văn bản pháp lý có phiên bản:** 7 văn bản (Điều khoản sử dụng, Chính sách bảo mật, Chính sách nội dung, Cam kết bản quyền, Quyền sử dụng tài liệu, Chính sách người bán, Liên hệ);
  mỗi bản đã phát hành không sửa được; có rà soát trước khi xuất bản; xem trước; công bố dạng **"Bản dự thảo"**; ghi nhận người dùng đã đồng ý **đúng phiên bản nào**.
- Tên thương hiệu không gõ cứng — đổi một chỗ, cả trang web đổi theo.

### 3.13. Email thông báo
- Tài khoản: kích hoạt, đặt lại mật khẩu, đổi email, kích hoạt + đặt mật khẩu cho tài khoản tạo lúc mua *(đang thử nghiệm)*.
- Mua bán: xác nhận thanh toán cho khách (nút "Tải tài liệu" về Thư viện), báo đơn mới cho người bán, báo người bán có đơn chờ xác nhận chuyển khoản, báo giao dịch sai tiền.
- Luồng mua mới *(đang thử nghiệm)*: thông tin thanh toán gửi khách khi chọn/đổi cách thanh toán (tối đa 3 lần/đơn), **1 email nhắc** trước khi đơn hết hạn, báo người bán khi khách
  bấm "Tôi đã chuyển khoản".
- Gói dịch vụ: hoá đơn chờ đối soát (báo quản trị viên qua "Email hỗ trợ"), nhắc hết kỳ, hoàn tiền gói.
- Khác: tin nhắn liên hệ, đánh giá mới, kết quả báo cáo vi phạm, quyền lợi khi tài liệu bị gỡ, tệp tải lên bị từ chối.

### 3.14. Cấu hình hệ thống (System Center)
- **Thương hiệu:** tên, khẩu hiệu, logo.
- **Cài đặt chung:** thời hạn liên kết email, phiên đăng nhập, thời gian giữ đơn/hoá đơn, ân hạn gói, lượt tải mặc định…
- **Email hỗ trợ**, **máy chủ gửi email (SMTP)**.
- **Lưu trữ tệp:** Cloudflare R2 hoặc MinIO tự host, chạy song song; công cụ đồng bộ và giám sát dung lượng thật của từng kho; giao tệp qua địa chỉ của chính Gieo Chữ (giấu kho lưu
  trữ). Bucket riêng cho từng gian hàng đang hoàn thiện.
- **Dịch vụ ảnh Cloudinary** (ảnh tối ưu tự động, hạn mức ảnh theo gói).
- **Cổng thanh toán của nền tảng** (thu phí gói): chuyển khoản QR, SePay, MoMo.
- Giao diện quản trị: tab theo chức năng, khối thu gọn, **cảnh báo khi rời trang chưa lưu**, giữ dữ liệu đã nhập khi lưu lỗi.

### 3.15. Bảo mật
- **Tách dữ liệu từng gian hàng ngay trong cơ sở dữ liệu** (RLS — quy tắc dưới cùng quyết định ai đọc được dòng dữ liệu nào): gian hàng này không đọc được dữ liệu của gian hàng khác,
  dù có lỗi ở tầng giao diện.
- Mật khẩu, token chỉ lưu dạng **băm** (không đọc ngược được); **khoá bí mật** của cổng thanh toán, kho lưu trữ, email được **mã hoá** trước khi lưu và không bao giờ hiện lại đầy
  đủ.
- Tệp tài liệu nằm ở kho riêng tư; link tải tạm thời, sống tối đa 10 phút.
- Cổng thanh toán gọi về (webhook) phải qua xác thực chữ ký; mỗi giao dịch chỉ xử lý một lần; **luôn tính lại số tiền ở máy chủ**, không tin số tiền từ trình duyệt.
- Đăng nhập dùng cookie bảo mật; chống giả mạo yêu cầu; chính sách nội dung (CSP) chặn mã lạ.
- Khi cấu hình đổi số tài khoản/số ví của cổng thanh toán nền tảng → cổng **tự tắt** cho tới khi quản trị viên xác nhận lại.
- **Che số tài khoản / số điện thoại ví** trong form cấu hình (hiện `*****` + 4 số cuối, bấm mắt để xem); **chặn trình duyệt tự điền** mật khẩu vào ô khoá bí mật *(đã code,
  đang thử nghiệm)*.
- Giới hạn tần suất (chống dò mật khẩu, chống tạo tài khoản hàng loạt).

### 3.16. Giám sát và nhật ký
- **Nhật ký hoạt động** (chỉ ghi thêm, không sửa/xoá được, giữ 12 tháng): đăng nhập, khoá tài khoản, thanh toán, xác nhận đơn, hoàn tiền, đổi cấu hình, xuất bản nội dung… Quản trị
  viên xem toàn hệ thống; chủ gian hàng xem nhật ký của gian hàng mình.
- **Thống kê hằng ngày** toàn hệ thống (doanh số, khách mới, lượt tải) cho quản trị viên; **Tổng quan gian hàng** cho người bán.
- **Việc chạy định kỳ mỗi ngày:** chuyển trạng thái thuê bao/đơn hết hạn, dọn dữ liệu cũ, tổng hợp thống kê, nhắc thanh toán.

---

## 4. Đang lên kế hoạch

**Nâng cấp frontend công khai và blog** (ADR-064, kế hoạch `docs/ke-hoach-nang-cap-frontend-cong-khai-2026-10-27.md`) — chủ dự án đã chốt, **chưa code**, làm theo từng giai đoạn nhỏ:
- Khung trang chung đồng bộ cho mọi trang công khai; chữ đọc dài dễ đọc hơn (16px điện thoại, 18px bài viết trên máy tính).
- **Trang bài viết mới**: ảnh bìa, "N phút đọc", mục lục, chia sẻ Facebook/Pinterest/LinkedIn/X, thẻ "Tài liệu liên quan".
- **Blog gian hàng** `/blog/{gian-hàng}` và section **"Bài viết nổi bật"** trên trang bán hàng.
- **Danh mục bài viết** dùng chung; ảnh bìa riêng tuỳ chọn.
- **Blog hệ thống** `/blog`: bài của hệ thống + bài của các gian hàng đang hoạt động; trang lưu trữ theo danh mục.
- **Địa chỉ bài viết dạng `.html`** (ví dụ `/{gian-hàng}/cach-on-thi.html`), địa chỉ cũ tự chuyển hướng.

Không làm trong đợt này: bình luận, đăng ký nhận tin, tìm kiếm bài viết.

---

## 5. Định hướng tương lai

> **Định hướng, chưa phát triển.** Các mục dưới đây chỉ là hướng đi đang cân nhắc — chưa có thiết kế, chưa có lịch, chưa cam kết.

- **AI hỗ trợ viết bài:** gợi ý dàn ý, viết bản nháp, tối ưu tiêu đề và mô tả SEO, tóm tắt nội dung tài liệu để làm mô tả bán hàng.
- **AI phân tích insights cho người bán:** xu hướng bán hàng, tài liệu được quan tâm, gợi ý cải thiện (giá, mô tả, thời điểm đăng).
- **Tự động chia sẻ lên fanpage Facebook:** khi gian hàng đăng bài viết hoặc tài liệu mới, tự đăng lên fanpage của gian hàng.

Nguyên tắc dự kiến: nội dung do AI tạo hoặc bài tự đăng luôn để **người dùng xem và duyệt trước**; dữ liệu của gian hàng và khách hàng không bị dùng ngoài mục đích đã đồng ý.

---

## Phụ lục — Nền tảng kỹ thuật và tài liệu liên quan

- Ứng dụng web **Next.js** (một mã nguồn cho trang công khai, Studio, System Center); cơ sở dữ liệu **PostgreSQL** trên **Neon**.
- Tệp tài liệu trên **Cloudflare R2** hoặc **MinIO**; ảnh trên **Cloudinary**; email qua máy chủ SMTP do quản trị viên cấu hình.
- Môi trường chạy chính (production/beta) trên **máy chủ riêng (VPS)**; Vercel dùng để thử chức năng mới.
- Tiến độ chi tiết: `docs/PLAN.md`. Quyết định kiến trúc: `docs/DECISIONS.md`. Kho tri thức: `obsidian-knowledge-base/00-Index/MOC-Home.md`.

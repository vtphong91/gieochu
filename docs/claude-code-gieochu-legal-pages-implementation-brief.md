# Yêu cầu Claude Code: Phát triển bộ trang chính sách và cam kết pháp lý cho Gieo Chữ

> **Loại tài liệu:** Product / Engineering Implementation Brief  
> **Dự án:** GieoChu.net  
> **Mục tiêu:** Xây dựng đầy đủ các trang chính sách công khai, quy trình báo cáo vi phạm và các điểm chấp thuận trong trải nghiệm người dùng/người bán.  
> **Ngôn ngữ giao diện:** Tiếng Việt  
> **Đối tượng thực hiện:** Claude Code và các agent phát triển trong repository hiện tại.

---

## 1. Bối cảnh sản phẩm

GieoChu.net là nền tảng tri thức dành cho giáo viên, coach, chuyên gia và những người sở hữu kiến thức, giúp họ biến kiến thức thành nội dung, giáo án, học liệu, tài sản số, cộng đồng và giá trị kinh tế.

Thông điệp thương hiệu:
- **Slogan:** Gieo kiến thức. Tạo giá trị.
- **Định vị:** Nền tảng dành cho người dạy học.
- **Nguyên tắc:** Tôn trọng tác giả, minh bạch nguồn gốc, bảo vệ người mua, tuân thủ pháp luật và xây dựng môi trường chia sẻ tri thức có trách nhiệm.

Nền tảng có thể cho phép người dùng tạo tài khoản, đăng tải tài liệu số, xây dựng gian hàng, bán tài liệu và thực hiện giao dịch. Hãy xác minh tính năng thực tế trong repository; không giả định tính năng nào đã tồn tại nếu chưa tìm thấy bằng chứng trong code.

## 2. Mục tiêu triển khai

Phát triển bộ trang pháp lý/chính sách hoàn chỉnh, có thể truy cập công khai, dễ đọc trên desktop và mobile, có thể liên kết từ footer, màn hình đăng ký, luồng mở gian hàng và luồng đăng sản phẩm.

Phải triển khai cả:
1. Các trang nội dung chính sách.
2. Điều hướng và liên kết giữa các trang.
3. Checkbox/cơ chế chấp thuận tại đúng điểm trong sản phẩm.
4. Cơ chế lưu phiên bản điều khoản đã chấp thuận nếu hệ thống có tài khoản/backend.
5. Quy trình gửi báo cáo/khiếu nại.
6. Các trạng thái xử lý ở khu vực quản trị nếu hệ thống hiện có admin.
7. Kiểm thử, tài liệu triển khai và danh sách các thông tin pháp lý còn cần chủ dự án xác nhận.

**Không chỉ tạo các trang tĩnh hoặc mockup.** Hãy tích hợp với kiến trúc, component, database, authentication, authorization và design system đang có trong repository.

## 3. Quy tắc làm việc bắt buộc

Trước khi sửa code:
- Đọc `CLAUDE.md`, hướng dẫn repository, cấu trúc thư mục và các conventions hiện có.
- Xác định framework, phiên bản, router, hệ thống xác thực, ORM/database, component library, CSS framework, quy trình migration và test hiện có.
- Tìm các trang public/legal hiện có, footer, đăng ký tài khoản, trang quản lý gian hàng, form đăng sản phẩm, khu vực quản trị và các luồng thanh toán/hoàn tiền.
- Lập kế hoạch ngắn, xác định file cần sửa/tạo và các phụ thuộc.
- Giữ nguyên kiến trúc hiện tại nếu không có lý do kỹ thuật rõ ràng. Không tự ý thay stack hoặc xây hệ thống thứ hai song song.

Trong quá trình triển khai:
- Ưu tiên tái sử dụng component và quy ước hiện có.
- Không phá vỡ chức năng đang chạy.
- Không hardcode dữ liệu cá nhân, email, số điện thoại, địa chỉ pháp nhân hoặc thông tin pháp lý chưa được chủ dự án cung cấp.
- Không tự bịa số đăng ký doanh nghiệp, địa chỉ, hotline, email hỗ trợ, thời hạn phản hồi hoặc thời hạn hoàn tiền.
- Không viết nội dung như thể đã được luật sư phê duyệt.
- Không tuyên bố nền tảng được miễn toàn bộ trách nhiệm chỉ vì người bán cam kết.
- Không tự đặt thời hạn xử lý vi phạm nếu chưa được chủ dự án xác nhận hoặc chưa có căn cứ pháp luật.
- Nếu thiếu thông tin, dùng cấu hình placeholder rõ ràng và ghi vào `docs/legal/LEGAL_REVIEW_CHECKLIST.md`; không để placeholder giả xuất hiện như thông tin thật trên production.
- Không tự động gỡ tài liệu/chấm dứt tài khoản chỉ dựa vào một khiếu nại chưa xác minh, trừ trường hợp cần biện pháp tạm thời theo chính sách hoặc yêu cầu pháp luật.
- Nội dung chính sách phải là tiếng Việt tự nhiên, rõ ràng, dễ hiểu, nhất quán thuật ngữ.
- Không sao chép nguyên văn điều khoản của nền tảng khác.
- Không coi tài liệu này là tư vấn pháp lý cuối cùng; cần ghi rõ trạng thái dự thảo cần rà soát pháp lý trước khi công bố chính thức.

## 4. Các trang chính sách bắt buộc

Tạo các trang sau. Có thể điều chỉnh slug theo quy ước router hiện tại, nhưng phải giữ các đường dẫn dễ hiểu, ổn định và có redirect nếu thay slug của trang đang tồn tại.

### 4.1. Điều khoản sử dụng
Slug gợi ý: `/dieu-khoan-su-dung`

Nội dung tối thiểu:
- Giới thiệu Gieo Chữ và phạm vi áp dụng.
- Định nghĩa: nền tảng, người dùng, người bán, người mua, tài liệu, giao dịch, nội dung.
- Điều kiện tạo và sử dụng tài khoản; yêu cầu về độ tuổi/năng lực hành vi cần được chủ dự án và luật sư xác nhận.
- Trách nhiệm bảo mật tài khoản và thông tin đăng ký.
- Quy tắc sử dụng nền tảng.
- Quyền và nghĩa vụ của người dùng, người mua, người bán.
- Quyền đối với nội dung do người dùng đăng tải và giấy phép giới hạn cấp cho nền tảng để lưu trữ, hiển thị, phân phối hoặc quảng bá trong phạm vi cần thiết để cung cấp dịch vụ.
- Không chuyển quyền sở hữu tài liệu cho Gieo Chữ chỉ vì người dùng đăng tải.
- Các hành vi bị cấm.
- Quyền sửa đổi, tạm ngưng, giới hạn hoặc chấm dứt dịch vụ/tài khoản với quy trình hợp lý.
- Tạm ẩn/gỡ nội dung khi có căn cứ, khiếu nại hợp lệ hoặc yêu cầu của cơ quan có thẩm quyền.
- Giới hạn trách nhiệm được diễn đạt phù hợp pháp luật, không loại trừ các nghĩa vụ bắt buộc.
- Cơ chế thông báo thay đổi điều khoản.
- Giải quyết khiếu nại, tranh chấp và pháp luật áp dụng.
- Thông tin liên hệ do cấu hình cung cấp.

### 4.2. Cam kết bản quyền và nguồn gốc tài liệu
Slug gợi ý: `/cam-ket-ban-quyen`

Đối tượng chính: người bán, tác giả, người tải lên hoặc phân phối tài liệu.

Nội dung tối thiểu:
- Người đăng phải là tác giả/chủ sở hữu hoặc có quyền/ủy quyền hợp pháp để cung cấp và kinh doanh tài liệu.
- Phân biệt quyền sở hữu, quyền sử dụng và quyền phân phối/thương mại.
- Cam kết tính nguyên gốc; không đạo văn, mạo danh hoặc sao chép trái phép.
- Nghĩa vụ khai báo tác giả, đồng tác giả, chủ sở hữu, nguồn gốc, giấy phép và phạm vi sử dụng.
- Quy định về tài liệu có nội dung của bên thứ ba, trích dẫn, hình ảnh, font, template, dữ liệu, video và các tài nguyên đi kèm.
- Tài liệu theo giấy phép mở/Creative Commons phải tuân thủ đúng điều kiện giấy phép; giấy phép không cho phép thương mại thì không được bán theo cách vi phạm điều kiện đó.
- Tài liệu được tạo với AI: người bán phải kiểm tra tính chính xác, quyền đối với thành phần sử dụng và không đưa ra tuyên bố sai về tác giả/độc quyền; không khẳng định đầu ra AI luôn có hoặc không có quyền tác giả.
- Tài liệu được tạo bởi nhóm, công ty, trường học hoặc trong quan hệ lao động: yêu cầu người đăng xác định quyền phù hợp trước khi kinh doanh.
- Nghĩa vụ cung cấp bằng chứng hợp lý khi có yêu cầu.
- Xử lý tài liệu bị khiếu nại hoặc có dấu hiệu xâm phạm.
- Trách nhiệm của người đăng theo pháp luật và chính sách.
- Không yêu cầu mọi tác giả phải có giấy chứng nhận đăng ký quyền tác giả nếu pháp luật không bắt buộc.
- Nêu rõ việc ghi nguồn không tự động đồng nghĩa với quyền được sao chép hoặc bán tài liệu.

### 4.3. Chính sách nội dung
Slug gợi ý: `/chinh-sach-noi-dung`

Phân loại rõ:
- Nội dung bị cấm.
- Nội dung hạn chế/cần xem xét thêm.
- Nội dung được phép nếu có quyền hợp pháp và tuân thủ quy định.

Các nhóm cần đề cập:
- Nội dung vi phạm pháp luật hoặc yêu cầu gỡ bỏ hợp pháp.
- Nội dung xâm phạm an ninh quốc gia, bí mật nhà nước, hoặc hành vi tuyên truyền/chống phá bị pháp luật cấm; dùng cách diễn đạt theo hành vi pháp luật cấm, không cấm tuyệt đối mọi tài liệu có chủ đề chính trị/lịch sử/pháp luật.
- Xâm phạm bản quyền và quyền sở hữu trí tuệ.
- Mạo danh, giả giấy phép, văn bằng, chứng chỉ hoặc thông tin chuyên môn.
- Lừa đảo, quảng cáo sai sự thật, gian lận giao dịch.
- Dữ liệu cá nhân, hồ sơ học sinh, thông tin riêng tư bị chia sẻ trái phép.
- Tài liệu phục vụ hành vi phạm pháp hoặc gây hại.
- Nội dung thù ghét, quấy rối, đe dọa, bạo lực hoặc tình dục bất hợp pháp theo quy định pháp luật và chính sách phù hợp.
- Tài liệu giáo dục, lịch sử, chính trị, khoa học hoặc nghiên cứu hợp pháp không tự động bị cấm chỉ vì chủ đề.
- Tài liệu AI: yêu cầu minh bạch trong trường hợp phù hợp, không cho phép giả mạo hoặc thông tin sai lệch có chủ ý.
- Ví dụ cụ thể cho từng nhóm để người dùng dễ hiểu.
- Hình thức xử lý và cơ chế kháng nghị.

### 4.4. Quy trình báo cáo và khiếu nại
Slug gợi ý: `/bao-cao-vi-pham` hoặc `/quy-trinh-bao-cao`

Cần có hai phần: trang mô tả quy trình và form gửi báo cáo thực tế.

Các loại báo cáo:
- Khiếu nại bản quyền.
- Tài liệu không có nguồn gốc rõ ràng/giả mạo.
- Nội dung trái pháp luật.
- Xâm phạm dữ liệu cá nhân/quyền riêng tư.
- Gian lận, lừa đảo hoặc giao dịch.
- Tài liệu lỗi/không đúng mô tả.
- Loại khác.

Form nên có:
- Loại báo cáo.
- URL hoặc ID tài liệu/gian hàng/giao dịch liên quan.
- Mô tả sự việc.
- Thông tin liên hệ cần thiết.
- Tài liệu chứng minh hoặc đường dẫn chứng cứ, nếu có.
- Checkbox xác nhận thông tin gửi là trung thực theo hiểu biết của người báo cáo.
- Thông báo về việc xử lý dữ liệu cá nhân trong phạm vi cần thiết.
- Chống spam/abuse phù hợp với stack hiện có.
- Trang trạng thái thành công và mã tiếp nhận nếu backend hỗ trợ.

Với khiếu nại bản quyền, cho phép khai báo:
- Tên và thông tin liên hệ của bên khiếu nại.
- Tài liệu bị cho là xâm phạm và URL/ID.
- Căn cứ quyền sở hữu hoặc đại diện/ủy quyền.
- Mô tả phần bị xâm phạm.
- Tuyên bố thiện chí và tính chính xác.
- Tài liệu chứng minh phù hợp.

Quy trình xử lý:
1. Tiếp nhận và tạo hồ sơ.
2. Phân loại mức độ ưu tiên.
3. Đánh giá nguy cơ và yêu cầu pháp lý.
4. Có thể áp dụng biện pháp tạm thời tương xứng khi cần thiết.
5. Yêu cầu bên đăng tải phản hồi/chứng minh quyền nếu phù hợp.
6. Ra quyết định có căn cứ và ghi nhận lý do.
7. Thông báo cho các bên trong phạm vi phù hợp.
8. Cung cấp cơ chế phản hồi/kháng nghị khi phù hợp.
9. Lưu lịch sử xử lý theo chính sách lưu trữ và pháp luật.

Không tự đặt SLA pháp lý hoặc cam kết thời gian phản hồi cụ thể nếu chưa được xác nhận. Thời hạn công bố phải cấu hình được và được chủ dự án phê duyệt.

### 4.5. Chính sách người bán, giao dịch và hoàn tiền
Slug gợi ý: `/chinh-sach-nguoi-ban` và có thể tách trang `/chinh-sach-hoan-tien`.

Nội dung người bán:
- Điều kiện mở và duy trì gian hàng.
- Nghĩa vụ cung cấp thông tin trung thực.
- Nghĩa vụ về bản quyền, nguồn gốc và mô tả tài liệu.
- Giá bán, phí nền tảng, hoa hồng, thuế và chứng từ: không tự bịa tỷ lệ; dùng cấu hình/placeholder cần xác nhận.
- Quy trình giao tài liệu số, tải xuống và hỗ trợ người mua.
- Hành vi thao túng đánh giá, giao dịch giả, tự mua bán để trục lợi.
- Tạm dừng hoặc chấm dứt quyền bán.
- Đối soát, hoàn tiền, khoản bị giữ hoặc giao dịch tranh chấp chỉ mô tả theo logic hiện có; không tự thiết kế cơ chế tài chính mới nếu chưa được yêu cầu.
- Nghĩa vụ hợp tác khi có khiếu nại.

Nội dung giao dịch/hoàn tiền:
- Khi nào giao dịch được xem là hoàn tất theo luồng thực tế.
- File lỗi, không tải được, không đúng mô tả hoặc thiếu nội dung.
- Thanh toán trùng, giao dịch trái phép/nghi ngờ gian lận.
- Tài liệu bị gỡ sau khi mua do khiếu nại/quyết định hợp lệ.
- Quy trình gửi yêu cầu, bằng chứng và trạng thái xử lý.
- Phương thức hoàn tiền và thời gian xử lý: phải khớp cổng thanh toán/logic thực tế và thông tin được phê duyệt.
- Không tuyên bố “mọi sản phẩm số đều không hoàn tiền” như quy tắc tuyệt đối.
- Bảo lưu các quyền bắt buộc của người tiêu dùng theo pháp luật.

Nếu hiện tại chưa có thanh toán hoặc hoàn tiền tự động, chỉ xây dựng trang chính sách và luồng yêu cầu phù hợp; không giả lập một hệ thống thanh toán chưa tồn tại.

### 4.6. Chính sách bảo mật và quyền riêng tư
Slug gợi ý: `/chinh-sach-bao-mat`

Nội dung tối thiểu:
- Đơn vị kiểm soát/xử lý dữ liệu và thông tin liên hệ: dùng cấu hình, không bịa.
- Các nhóm dữ liệu có thể thu thập: tài khoản, thông tin hồ sơ, gian hàng, giao dịch, hỗ trợ, log kỹ thuật, cookie và dữ liệu thiết bị.
- Mục đích và căn cứ xử lý phù hợp.
- Dữ liệu bắt buộc và dữ liệu tùy chọn.
- Bên nhận dữ liệu: hosting, lưu trữ, email, analytics, cổng thanh toán và nhà cung cấp khác nếu thực tế được tích hợp.
- Chuyển dữ liệu ra nước ngoài nếu áp dụng, cần chủ dự án/luật sư xác minh.
- Thời gian lưu trữ hoặc tiêu chí xác định thời gian lưu.
- Biện pháp bảo mật ở mức mô tả, không tiết lộ chi tiết dễ bị khai thác.
- Quyền của chủ thể dữ liệu và cách gửi yêu cầu.
- Cookie/analytics và cách quản lý lựa chọn nếu có.
- Dữ liệu trẻ em hoặc dữ liệu nhạy cảm: cần xác minh tính năng và nghĩa vụ pháp luật.
- Quy trình xử lý sự cố dữ liệu.
- Ngày hiệu lực, phiên bản và cách thông báo thay đổi.
- Không khẳng định một hoạt động xử lý dữ liệu đang diễn ra nếu chưa xác minh trong code/cấu hình.

### 4.7. Các trang bổ sung cần thiết
Tạo các trang sau hoặc ghi rõ lý do không áp dụng nếu mô hình hiện tại chưa cần:
- `/quy-che-hoat-dong`: quy chế vận hành nền tảng giao dịch/marketplace nếu áp dụng.
- `/quyen-su-dung-tai-lieu`: giải thích giấy phép người mua nhận được khi mua tài liệu và việc mua không tự động chuyển quyền sở hữu trí tuệ.
- `/chinh-sach-cookie`: nếu có cookie không thiết yếu, analytics hoặc công nghệ tương tự cần thông báo/quản lý lựa chọn.
- `/lien-he-ho-tro`: đầu mối hỗ trợ và khiếu nại.
- `/huong-dan-bao-cao-ban-quyen`: có thể là một phần của trang báo cáo nếu không cần trang riêng.
- `/thong-tin-phap-ly`: tên pháp nhân/đơn vị vận hành, địa chỉ, mã số doanh nghiệp và thông tin bắt buộc khác sau khi chủ dự án cung cấp.
- `/chinh-sach-luu-tru-va-xoa-tai-khoan`: nếu chưa có thể tích hợp trong điều khoản và quyền riêng tư, nhưng phải xác định quy trình xóa tài khoản/dữ liệu.

Không tạo trang trống chỉ để đủ danh sách. Nếu hai nội dung phù hợp gộp lại, hãy gộp có chủ đích và cập nhật liên kết.

## 5. Nội dung điều khoản và các điểm cần chủ dự án xác nhận

Tạo file `docs/legal/LEGAL_REVIEW_CHECKLIST.md` ghi lại những thông tin chưa biết, ví dụ:
- Tên pháp nhân/đơn vị vận hành chính thức.
- Địa chỉ và thông tin liên hệ pháp lý.
- Email hỗ trợ, email bản quyền và email quyền riêng tư.
- Gieo Chữ hiện là nền tảng trung gian, nhà cung cấp nội dung hay kết hợp mô hình nào theo thực tế.
- Tính năng thanh toán, đối soát, hoa hồng, hoàn tiền và nhà cung cấp thanh toán đang dùng.
- Điều kiện mở gian hàng/xác minh người bán.
- Chính sách độ tuổi.
- Thời gian lưu dữ liệu và hồ sơ khiếu nại.
- Quy trình và thời hạn phản hồi nội bộ được chủ dự án phê duyệt.
- Các nghĩa vụ đăng ký/thông báo thương mại điện tử hoặc thủ tục khác có áp dụng.
- Các điều khoản cần luật sư xác nhận trước khi công bố.

Mỗi mục cần có: nội dung cần xác nhận, lý do, người phụ trách (nếu biết), trạng thái và tác động nếu chưa hoàn tất.

## 6. Yêu cầu giao diện và trải nghiệm người dùng

- Tôn trọng design system hiện có của Gieo Chữ; không tự tạo hệ màu mới nếu repository đã có token.
- Giao diện sạch, chuyên nghiệp, dễ đọc; phù hợp với nền tảng tri thức và người dạy học.
- Responsive trên mobile/tablet/desktop.
- Có tiêu đề trang, mô tả ngắn, mục lục hoặc điều hướng nội dung với trang dài, ngày hiệu lực và ngày cập nhật.
- Có liên kết giữa các trang chính sách liên quan.
- Có trạng thái loading, empty, success và error cho form.
- Form có nhãn rõ, validation phía client và server, thông báo lỗi tiếng Việt.
- Đảm bảo accessibility: semantic HTML, keyboard navigation, focus state, tương phản màu, label cho input và aria cần thiết.
- SEO cơ bản: title, description, canonical theo quy ước dự án, sitemap nếu hệ thống đang sử dụng; không đưa trang nhạy cảm hoặc admin vào sitemap.
- Tránh nội dung trùng lặp giữa nhiều trang.
- Không thêm nút “Tôi đồng ý” giả nếu bấm không lưu hoặc không thực hiện hành động thật.

## 7. Chấp thuận điều khoản và lưu phiên bản

Tích hợp tại các điểm:
- Đăng ký tài khoản: chấp thuận Điều khoản sử dụng và xác nhận đã đọc thông tin quyền riêng tư theo thiết kế pháp lý được duyệt.
- Kích hoạt gian hàng/người bán: chấp thuận điều khoản người bán và cam kết bản quyền.
- Đăng tài liệu: xác nhận có quyền đăng tải/phân phối tài liệu và thông tin khai báo là chính xác.
- Khi điều khoản trọng yếu thay đổi: thiết kế cơ chế thông báo và yêu cầu chấp thuận lại nếu cần.

Nếu backend hiện tại hỗ trợ:
- Lưu user ID, document key, version, timestamp và bằng chứng kỹ thuật tối thiểu cần thiết.
- Không chỉ lưu một boolean `accepted=true` nếu cần chứng minh người dùng đã chấp thuận phiên bản nào.
- Thiết kế idempotent, có migration, index phù hợp và kiểm tra quyền truy cập.
- Chỉ thu thập dữ liệu cần thiết; không ghi thông tin nhạy cảm vào log.
- Không làm gián đoạn người dùng hiện hữu mà không có kế hoạch migration/UX rõ ràng.
- Nếu chưa có backend hoặc cần thay đổi schema lớn, hãy trình bày phương án trước, nhưng vẫn hoàn thiện các phần public không phụ thuộc backend.

## 8. Quản trị báo cáo và vi phạm

Nếu có khu vực admin, tích hợp:
- Danh sách báo cáo.
- Lọc theo loại, trạng thái, mức ưu tiên và thời gian.
- Trang chi tiết hồ sơ, liên kết tài liệu/tài khoản liên quan.
- Ghi nhận bằng chứng, ghi chú nội bộ, quyết định và lý do.
- Trạng thái gợi ý: `RECEIVED`, `UNDER_REVIEW`, `NEED_MORE_INFO`, `ACTION_TAKEN`, `REJECTED`, `APPEAL_REVIEW`, `CLOSED` (điều chỉnh theo quy ước code).
- Nhật ký thay đổi trạng thái và người thao tác.
- Phân quyền rõ; chỉ vai trò được phép mới xem hồ sơ và dữ liệu cá nhân.
- Không để thông tin người báo cáo hoặc hồ sơ riêng tư lộ ra công khai.
- Nếu chưa có admin, triển khai backend/model/API tối thiểu theo kiến trúc hiện tại hoặc ghi rõ phần nào cần quyết định trước khi làm.

## 9. Gợi ý mô hình dữ liệu

Chỉ áp dụng sau khi đối chiếu schema hiện tại; tái sử dụng bảng/model có sẵn khi phù hợp.

Các thực thể có thể cần:
- `LegalDocument`: key/slug, title, content hoặc content source, version, status, effective date, published date, updated date.
- `UserLegalAcceptance`: user ID, legal document key/version, accepted timestamp, metadata tối thiểu.
- `ContentReport`: reporter ID nullable nếu cho phép báo cáo khách, category, target type/ID/URL, description, contact data tối thiểu, status, priority, created/updated timestamps.
- `ReportEvidence`: report ID, file/link, type, access control, metadata cần thiết.
- `ReportActivity`: report ID, actor ID, action, reason, timestamp.
- `PolicyConfiguration`: chỉ khi dự án đã có mô hình cấu hình phù hợp; không tạo bảng chỉ để lưu placeholder không cần thiết.

Quy tắc:
- Migration an toàn, có rollback khi framework hỗ trợ.
- Foreign key/index/unique constraint phù hợp.
- Kiểm tra authorization ở server, không chỉ ẩn nút trên UI.
- Có validation schema ở cả client/server theo conventions hiện có.
- Hạn chế dữ liệu cá nhân, có chính sách retention và xóa/ẩn phù hợp.
- Không lưu file bằng chứng công khai; dùng private storage hoặc cơ chế truy cập được bảo vệ nếu có upload.

## 10. Kiến trúc nội dung và quản lý phiên bản

Ưu tiên nội dung chính sách được quản lý theo một trong hai cách phù hợp với code hiện tại:
1. Markdown/MDX hoặc content files trong repository, có version control và metadata.
2. Database/CMS nếu dự án đã có hệ thống quản trị nội dung.

Không xây CMS mới nếu không cần thiết.

Mỗi tài liệu cần có metadata:
- `slug`
- `title`
- `version`
- `status` (`DRAFT`, `PUBLISHED`, `ARCHIVED` hoặc quy ước tương đương)
- `effectiveAt`
- `publishedAt`
- `updatedAt`
- `requiresReacceptance` nếu có cơ chế chấp thuận phiên bản.

Chỉ nội dung được phê duyệt mới xuất hiện như chính sách đang có hiệu lực. Nội dung còn placeholder hoặc chờ luật sư duyệt phải được đánh dấu nội bộ và không tự động phát hành.

## 11. Bảo mật và xử lý lỗi

- Validate toàn bộ dữ liệu đầu vào ở server.
- Sanitize nội dung nếu có rich text/Markdown do admin chỉnh sửa.
- Chống spam/rate limit form báo cáo theo cơ chế hiện có.
- Bảo vệ CSRF khi stack yêu cầu.
- Kiểm tra upload file, loại file, dung lượng, quyền truy cập và malware scanning nếu hệ thống có upload chứng cứ.
- Không tin cậy `userId`, role hoặc trạng thái được gửi từ client.
- Không để người dùng truy cập báo cáo của người khác.
- Không trả stack trace hoặc dữ liệu nội bộ ra UI.
- Audit log các hành động admin quan trọng.
- Xử lý lỗi mạng, gửi form lặp, retry và trạng thái pending.
- Không log nội dung báo cáo hoặc dữ liệu cá nhân nhạy cảm ngoài nhu cầu cần thiết.

## 12. Kiểm thử và tiêu chí nghiệm thu

### Kiểm thử chức năng
- Tất cả trang public mở được qua URL trực tiếp.
- Footer và các luồng liên quan có liên kết chính xác.
- Checkbox chấp thuận bắt buộc hoạt động đúng.
- Chấp thuận được lưu đúng phiên bản nếu backend hỗ trợ.
- Người bán không thể đăng tài liệu nếu bỏ qua bước xác nhận bắt buộc.
- Form báo cáo validate đúng và lưu hồ sơ thành công.
- Người gửi nhận được xác nhận/mã tiếp nhận nếu tính năng đó được triển khai.
- Admin chỉ xem và xử lý hồ sơ theo quyền được cấp.
- Các trạng thái báo cáo được lưu đúng và có lịch sử.
- Link, slug, redirect, metadata và sitemap hoạt động đúng.

### Kiểm thử bảo mật
- Người không đăng nhập không truy cập dữ liệu báo cáo riêng tư.
- Người dùng thường không thể thao tác endpoint admin.
- Không thể giả mạo user ID hoặc role qua request.
- Chống spam cơ bản cho form.
- Upload bằng chứng không tạo public link trái phép.
- Không để placeholder pháp lý xuất hiện như thông tin thật ở production.

### Kiểm thử chất lượng
- Unit/integration/e2e test theo bộ công cụ hiện có.
- Lint, typecheck, build và test phải chạy thành công hoặc ghi rõ lỗi có sẵn không do thay đổi này.
- Responsive và accessibility cơ bản.
- Không có lỗi console quan trọng hoặc link hỏng.
- Không làm hỏng đăng ký, đăng nhập, mở gian hàng, đăng sản phẩm, thanh toán hiện hữu.

### Definition of Done
- Tất cả trang cần thiết được tạo và tích hợp.
- Các luồng chấp thuận và báo cáo thực sự hoạt động, không phải chỉ là UI.
- Nội dung nhất quán và có liên kết nội bộ.
- Có migration nếu cần, kèm kiểm thử.
- Có `docs/legal/LEGAL_REVIEW_CHECKLIST.md`.
- Có `docs/legal/IMPLEMENTATION_SUMMARY.md` mô tả file đã tạo/sửa, quyết định kỹ thuật, lệnh kiểm thử và việc còn chờ xác nhận.
- Không tự publish các nội dung pháp lý chưa được phê duyệt.

## 13. Quy trình thực hiện đề xuất cho Claude Code

Thực hiện theo các phase:

### Phase 1 — Audit
- Đọc hướng dẫn repository.
- Kiểm tra stack và các luồng hiện tại.
- Lập danh sách trang, component, API, model và migration cần thay đổi.
- Nêu các rủi ro/điểm chưa rõ trước khi sửa phần có thể ảnh hưởng đến dữ liệu hoặc giao dịch.

### Phase 2 — Content & routing
- Soạn nội dung tiếng Việt cho các trang.
- Tạo route và layout.
- Tạo trang liên hệ/thông tin pháp lý theo cấu hình, không bịa dữ liệu.
- Tạo checklist rà soát pháp lý.

### Phase 3 — Product integration
- Gắn liên kết footer.
- Tích hợp chấp thuận trong đăng ký và luồng người bán.
- Xây form báo cáo và backend.
- Tích hợp admin nếu có hoặc theo kiến trúc được xác nhận.
- Thêm lưu phiên bản chấp thuận nếu phù hợp.

### Phase 4 — QA
- Chạy lint, typecheck, test và build.
- Kiểm tra responsive, accessibility, authorization và validation.
- Kiểm tra lại luồng hiện hữu.
- Sửa lỗi phát sinh từ thay đổi.

### Phase 5 — Handover
- Viết `docs/legal/IMPLEMENTATION_SUMMARY.md`.
- Viết `docs/legal/LEGAL_REVIEW_CHECKLIST.md`.
- Liệt kê thông tin còn thiếu, điều khoản cần luật sư duyệt, migration và biến môi trường nếu có.
- Không tuyên bố hoàn tất nếu có phần quan trọng chỉ là placeholder hoặc mock.

Nếu sử dụng agent team, có thể phân công:
- **Agent điều phối:** audit repository, giữ kiến trúc, tích hợp và review cuối.
- **Agent nội dung/chính sách:** soạn nội dung và checklist pháp lý, không tự đưa ra khẳng định pháp lý chưa được xác minh.
- **Agent frontend:** trang public, layout, footer, form và accessibility.
- **Agent backend/QA:** model, API, authorization, migration, test và luồng báo cáo.

Nếu repository không hỗ trợ agent team, làm tuần tự và vẫn giữ các phase trên.

## 14. Yêu cầu đầu ra cuối cùng

Sau khi hoàn tất, hãy báo cáo:
1. Những trang đã triển khai và URL/slug.
2. Những điểm chấp thuận đã tích hợp.
3. Form báo cáo và quy trình admin đã hoạt động đến đâu.
4. Model/migration/API mới.
5. Các test/lệnh build đã chạy và kết quả.
6. Các file tài liệu bàn giao.
7. Những thông tin còn cần chủ dự án cung cấp.
8. Những phần cần luật sư rà soát trước khi công bố chính thức.
9. Các giới hạn hoặc phần chưa triển khai, nêu rõ lý do.

**Ưu tiên cuối cùng:** Tính đúng đắn, khả năng tích hợp với codebase hiện có, bảo vệ người dùng và khả năng vận hành thực tế. Không đánh đổi các yếu tố này để chỉ tạo ra nhiều trang giao diện.

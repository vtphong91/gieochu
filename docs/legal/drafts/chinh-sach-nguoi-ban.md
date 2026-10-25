> **BẢN DỰ THẢO — chưa được luật sư rà soát.**
>
> Văn bản: Chính sách người bán (mở và vận hành gian hàng, nhận tiền, giao tài liệu, hoàn tiền, dữ liệu người mua, xử lý vi
> phạm). Khoá đề xuất `seller`, đường dẫn `/chinh-sach-nguoi-ban` (URL cấp gốc, ADR-054) (hạ tầng ADR-050). Người soạn: Long (tài
> liệu), 2026-10-24, theo `docs/claude-code-gieochu-legal-pages-implementation-brief.md` §4.5 và
> `docs/legal/LEGAL_REVIEW_CHECKLIST.md`. Kế hoạch: `docs/ke-hoach-trang-phap-ly-dot-2-2026-10-24.md`. Đây **không** phải
> tư vấn pháp lý và **không** được công bố khi còn dấu `[[CẦN XÁC NHẬN: …]]` (hệ thống chặn xuất bản theo ADR-050).
>
> Quy ước nhập vào CMS: chỉ chép phần từ "1. Phạm vi áp dụng" đến hết mục "12. Văn bản liên quan"; **không** chép khối dẫn
> này và phần "Ghi chú nội bộ". Chỉ dùng H2/H3. Không chép giá, hạn mức gói vào nội dung — chỉ dẫn tới trang Bảng giá.

## 1. Phạm vi áp dụng

Chính sách người bán áp dụng cho người dùng mở và vận hành gian hàng trên {brand}. Chính sách này được đọc cùng
[Điều khoản sử dụng](/dieu-khoan-su-dung) (đặc biệt mục 7 "Người bán và gian hàng" và mục 10 "Giao dịch, giao tài
liệu và hoàn tiền"), [Cam kết bản quyền](/cam-ket-ban-quyen) và [Chính sách nội dung](/chinh-sach-noi-dung).

## 2. Mở và duy trì gian hàng

- Người dùng có tài khoản đã xác minh email có thể mở gian hàng. Mỗi tài khoản sở hữu một gian hàng.
- Khi mở gian hàng, bạn chọn tên và địa chỉ gian hàng. Địa chỉ gian hàng là một phần đường dẫn công khai của gian hàng và tài
  liệu; một số địa chỉ được Nền tảng giữ lại và không chọn được.
- Gian hàng mới bắt đầu với gói miễn phí.
- Bạn chịu trách nhiệm về tính trung thực của thông tin gian hàng (tên, giới thiệu, hình ảnh, nội dung trang gian hàng) và
  không được mạo danh cá nhân, trường học hoặc tổ chức khác.

Điều kiện mở và duy trì gian hàng, kể cả việc có xác minh thông tin người bán hay không: [[CẦN XÁC NHẬN: ND-03]].

## 3. Gói dịch vụ

Gian hàng sử dụng Nền tảng theo gói dịch vụ. Tên gói, giá, chu kỳ thanh toán và hạn mức (ví dụ số tài liệu, dung lượng lưu
trữ) được công bố tại trang Bảng giá. Khi đạt hạn mức của gói, bạn cần nâng cấp gói để tiếp tục thêm tài liệu.

Hoàn tiền gói dịch vụ thực hiện theo mục 10.4 của [Điều khoản sử dụng](/dieu-khoan-su-dung).

## 4. Nhận tiền bán tài liệu

- Bạn tự cấu hình cách nhận tiền cho gian hàng trong khu vực quản lý gian hàng, bằng một trong các hình thức Nền tảng hỗ trợ:
  chuyển khoản qua mã QR hoặc cổng thanh toán được tích hợp.
- Tiền người mua thanh toán được chuyển thẳng tới tài khoản nhận tiền của bạn; chúng tôi không giữ hộ khoản tiền bán tài liệu.
- Với hình thức chuyển khoản qua mã QR, bạn tự kiểm tra tiền đã về và xác nhận thanh toán cho đơn hàng, kèm ghi chú xác nhận.
  Chỉ xác nhận khi bạn đã thực sự nhận được tiền.
- Các khoá bí mật của cổng thanh toán được mã hoá khi lưu và không hiển thị lại đầy đủ. Bạn chịu trách nhiệm giữ bí mật thông
  tin tài khoản cổng thanh toán của mình và về tính chính xác của thông tin nhận tiền.
- Bạn tự đối soát các khoản thanh toán mình nhận được.

Phí nền tảng hoặc hoa hồng trên giao dịch tài liệu (nếu có): [[CẦN XÁC NHẬN: KD-04]].

Nghĩa vụ thuế, hoá đơn và chứng từ đối với doanh thu bán tài liệu: [[CẦN XÁC NHẬN: KD-05]].

## 5. Đăng tài liệu

- Mỗi tài liệu cần có tiêu đề, mô tả, danh mục và giá (có thể là 0 đồng với tài liệu miễn phí). Mô tả phải đúng với nội dung
  thật của tài liệu: nội dung chính, số lượng, định dạng tệp và phạm vi sử dụng người mua nhận được.
- Mỗi lần xuất bản, bạn phải xác nhận mình sở hữu hoặc có quyền phân phối tài liệu theo
  [Cam kết bản quyền](/cam-ket-ban-quyen).
- Bạn có thể giao tài liệu bằng tệp tải lên Nền tảng hoặc bằng đường liên kết tới một số dịch vụ lưu trữ trực tuyến được Nền
  tảng chấp nhận.
- Tệp tải lên được kiểm tra định dạng; tệp không đúng định dạng đã khai báo bị từ chối và bạn nhận email thông báo.
- Với tài liệu giao bằng đường liên kết: Nền tảng không kiểm tra nội dung tại đường liên kết và không ngăn được việc người
  nhận chia sẻ lại đường liên kết đó. Bạn tự chịu trách nhiệm về quyền truy cập và nội dung của đường liên kết.
- Bạn thiết lập số lượt tải cho mỗi tài liệu.

## 6. Giao tài liệu và hỗ trợ người mua

- Sau khi thanh toán được xác nhận, tài liệu được tự động giao vào Thư viện của người mua.
- Bạn có trách nhiệm hỗ trợ người mua của gian hàng: trả lời tin nhắn liên hệ, xử lý khi tệp lỗi, không mở được hoặc không
  đúng mô tả, và cấp thêm lượt tải khi phù hợp.
- Chỉ người mua đã nhận tài liệu mới đánh giá được tài liệu đó. Bạn không được ép, mua hoặc đổi quyền lợi để có đánh giá tốt.

## 7. Hoàn tiền tài liệu

Vì tiền bán tài liệu được chuyển thẳng tới bạn, việc hoàn tiền tài liệu do bạn thực hiện với người mua. Sau khi hoàn tiền,
bạn đánh dấu đơn hàng là đã hoàn tiền trong khu vực quản lý đơn hàng; khi đó quyền tải tài liệu của đơn đó chấm dứt và đánh
giá của người mua cho tài liệu đó được ẩn.

Khi một tài liệu bị gỡ do vi phạm đã được xác nhận và người mua chọn yêu cầu hoàn tiền, yêu cầu đó hiển thị trong khu vực quản
lý đơn hàng và bạn nhận email thông báo.

Các trường hợp người bán phải hoàn tiền, thời hạn xử lý yêu cầu hoàn tiền và cách chúng tôi xử lý khi người bán không hoàn
tiền: [[CẦN XÁC NHẬN: KD-07]].

## 8. Dữ liệu người mua

Bạn xem được họ tên, email và lịch sử mua tại gian hàng của những người đã mua hoặc nhận tài liệu của bạn, cùng tin nhắn
khách gửi qua biểu mẫu liên hệ. Bạn không xem được số điện thoại và tỉnh/thành trong hồ sơ của người mua.

Bạn chỉ được dùng dữ liệu này để giao tài liệu, hỗ trợ và giải quyết yêu cầu của người mua; không được bán, chia sẻ cho bên
khác hoặc dùng để gửi quảng cáo khi người mua chưa đồng ý. Nghĩa vụ đầy đủ của người bán đối với dữ liệu người mua:
[[CẦN XÁC NHẬN: DL-08]].

## 9. Hành vi bị cấm đối với người bán

Ngoài các hành vi bị cấm trong Điều khoản sử dụng và Chính sách nội dung, người bán không được:

- Tạo giao dịch giả, tự mua tài liệu của gian hàng mình hoặc nhờ người khác mua để trục lợi.
- Thao túng đánh giá dưới mọi hình thức.
- Xác nhận thanh toán cho đơn hàng chưa thực sự nhận được tiền.
- Mô tả sai tài liệu, cam kết kết quả không có căn cứ.
- Dùng thông tin người mua trái với mục 8.

## 10. Khi có báo cáo vi phạm liên quan tới gian hàng

- Bạn nhận email khi nội dung của gian hàng bị xử lý hoặc khi gian hàng bị khoá, kèm loại vi phạm và quyết định xử lý. Bạn
  không được biết danh tính người báo cáo.
- Nội dung bị chúng tôi ẩn hoặc gỡ không thể tự hiển thị lại cho tới khi chúng tôi gỡ khoá.
- Bạn có nghĩa vụ hợp tác khi chúng tôi xem xét báo cáo, kể cả cung cấp bằng chứng hợp lý về quyền đối với tài liệu khi được
  yêu cầu.

Cách xem xét, các quyết định và cơ chế kháng nghị: mục 8 của [Chính sách nội dung](/chinh-sach-noi-dung).

## 11. Tạm ngưng và khoá gian hàng

Chúng tôi có thể tạm ngưng hoặc khoá gian hàng khi người bán vi phạm Điều khoản, các chính sách hoặc pháp luật, hoặc khi cần
để bảo vệ người dùng khác và Nền tảng. Khi gian hàng không ở trạng thái hoạt động:

- Tài liệu, bài viết và đánh giá của gian hàng không hiển thị công khai; trang gian hàng tạm ngưng chỉ hiện thông báo, gian
  hàng bị khoá không truy cập được.
- Gian hàng không nhận đơn mua mới.
- Người mua đã mua vẫn tải được tài liệu từ Thư viện của họ (trừ tài liệu bị gỡ do vi phạm).

Quy trình thông báo trước, cơ hội giải trình và quyền lợi của người bán khi gian hàng bị tạm ngưng hoặc khoá:
[[CẦN XÁC NHẬN: ND-08]].

## 12. Văn bản liên quan

- [Điều khoản sử dụng](/dieu-khoan-su-dung)
- [Cam kết bản quyền và nguồn gốc tài liệu](/cam-ket-ban-quyen)
- [Chính sách nội dung](/chinh-sach-noi-dung)
- [Chính sách bảo mật](/chinh-sach-bao-mat)

---

**Ghi chú nội bộ (không chép vào CMS)** — Long đối chiếu ngày 2026-10-24.
✅ đã đối chiếu code/schema · 🟡 theo ADR/báo cáo · ❓ cần chủ dự án / luật sư.

| Mục | Khẳng định | Mức | Căn cứ |
|---|---|---|---|
| 2 | Tài khoản đã xác minh email mới mở được gian hàng | 🟡 | Tài khoản `PENDING` chưa đăng nhập được (đăng ký tạo `status: "PENDING"` + token `EMAIL_VERIFY`) — Long chưa đọc lại guard của `/studio` onboarding |
| 2 | Mỗi tài khoản một gian hàng | ✅ | `Tenant.ownerId @unique` (`schema.prisma`) |
| 2 | Có địa chỉ dành riêng | ✅ | `RESERVED_SLUGS` (`packages/core/src/tenant/slug.ts`), bổ sung ADR-050 thêm `phap-ly` |
| 2 | Bắt đầu với gói miễn phí | ✅ | `lib/create-tenant.ts` tạo subscription FREE (ADR-021) — kế hoạch đợt 1 L2 |
| 2 | Không xác minh người bán | ✅ | Kế hoạch đợt 1 L2 — để ND-03 |
| 3 | Giá/hạn mức ở Bảng giá; đạt hạn mức phải nâng cấp | ✅ | `Plan.maxProducts`, `maxFileMb`…; lỗi `PRODUCT_LIMIT_REACHED` (PLAN.md). Không chép số vào nội dung |
| 4 | Hình thức nhận tiền: QR thủ công, cổng tích hợp | ✅ | `PaymentProviderId` `MANUAL_QR/SEPAY/MOMO`. Không nêu tên cổng trong nội dung để không phải sửa khi đổi cổng (Q-13) |
| 4 | Tiền về thẳng, nền tảng không giữ | 🟡 | ADR-039; KD-01 |
| 4 | QR thủ công: người bán xác nhận kèm ghi chú | ✅ | `Order.confirmNote` ("bắt buộc khi owner xác nhận thủ công", comment `schema.prisma`) |
| 4 | Secret mã hoá, không hiện lại | ✅ quy tắc | CLAUDE.md §7.3 |
| 5 | Danh mục bắt buộc khi xuất bản; giá 0đ được | ✅ / 🟡 | ADR-026 mục 2; đơn 0đ (ADR-039) |
| 5 | Link ngoài: allowlist host; không quét; không chống chia sẻ lại | ✅ quy tắc | ADR-026 mục 3 (UI Studio có cảnh báo). Không liệt kê tên host trong nội dung (danh sách có thể mở rộng) |
| 5 | Tệp được kiểm định dạng, sai bị từ chối + email | ✅ | `apps/web/lib/file-scan.ts` (`matchesDeclaredExtension`, `renderProductFileRejectedEmail`). **Không** ghi "quét virus" — ClamAV chưa có client |
| 6 | Tự động giao vào Thư viện | ✅ / 🟡 | Entitlement tạo khi đơn được thanh toán (M8/M9) |
| 6 | Chỉ người đã mua mới đánh giá | ✅ | `apps/web/lib/review*.ts` (đơn `FULFILLED` + entitlement chưa thu hồi) |
| 7 | Đánh dấu hoàn tiền → thu hồi quyền tải + ẩn đánh giá | ✅ | `markOrderRefunded` (`apps/web/lib/order.ts`) |
| 7 | Yêu cầu hoàn tiền remedy hiện ở Đơn hàng + email | 🟡 | ADR-039 mục 3; template `entitlement-remedy.ts` tồn tại ✅. "7 ngày" **không** đưa vào nội dung (KD-07) |
| 8 | Người bán thấy họ tên, email, lịch sử mua; không SĐT/tỉnh | ✅ | `apps/web/lib/customer-list.ts`; ADR-041 C.1, ADR-048 |
| 8 | Cấm dùng dữ liệu người mua để quảng cáo khi chưa đồng ý | ❓ | Quy tắc mới do Long đề xuất theo brief — chủ dự án/luật sư duyệt (DL-08). Hệ thống không có chức năng gửi email hàng loạt cho khách ✅ (không có template) |
| 9 | Danh sách hành vi cấm | ❓ | Theo brief §4.5 + Điều khoản 7.4 — luật sư rà |
| 10 | Email khi bị xử lý/khoá; không biết người báo cáo; khoá kiểm duyệt | ✅ / 🟡 | ADR-038 mục 4–6 |
| 11 | READ_ONLY: trang thông báo, không tài liệu; LOCKED: khách 404; không nhận đơn mới; người mua vẫn tải | 🟡 | ADR-040 mục 1–4, bổ sung ADR-040; ADR-039 (g) `PRODUCT_UNAVAILABLE` |

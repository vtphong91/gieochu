> **BẢN DỰ THẢO — chưa được luật sư rà soát.**
>
> Văn bản: Liên hệ và thông tin pháp lý (gộp `/lien-he-ho-tro` + `/thong-tin-phap-ly` của brief §4.7). Khoá đề xuất
> `contact`, đường dẫn `/lien-he` (URL cấp gốc, ADR-054) (hạ tầng ADR-050). Người soạn: Long (tài liệu), 2026-10-24, theo
> `docs/claude-code-gieochu-legal-pages-implementation-brief.md` §4.7 và `docs/legal/LEGAL_REVIEW_CHECKLIST.md` (PL-01…PL-07).
> Kế hoạch: `docs/ke-hoach-trang-phap-ly-dot-2-2026-10-24.md`. Đây **không** phải tư vấn pháp lý và **không** được công bố
> khi còn dấu `[[CẦN XÁC NHẬN: …]]` (hệ thống chặn xuất bản theo ADR-050).
>
> Quy ước nhập vào CMS: chỉ chép phần từ "1. Đơn vị vận hành" đến hết mục "4. Văn bản liên quan"; **không** chép khối dẫn
> này và phần "Ghi chú nội bộ". Chỉ dùng H2/H3. Dòng thông tin nào chủ dự án quyết **không công bố** (vd số điện thoại)
> thì xoá hẳn dòng đó khỏi nội dung trước khi nhập, không để trống.

## 1. Đơn vị vận hành

{brand} do đơn vị sau vận hành:

- Tên đơn vị: [[CẦN XÁC NHẬN: PL-01]]
- Mã số doanh nghiệp / mã số thuế: [[CẦN XÁC NHẬN: PL-02]]
- Địa chỉ: [[CẦN XÁC NHẬN: PL-03]]
- Người đại diện: [[CẦN XÁC NHẬN: PL-04]]

## 2. Liên hệ theo nhu cầu

### 2.1. Tài khoản, gói dịch vụ và sử dụng Nền tảng

Câu hỏi về tài khoản, đăng nhập, gói dịch vụ của gian hàng hoặc cách sử dụng Nền tảng:

- Email hỗ trợ: [[CẦN XÁC NHẬN: PL-06]]
- Điện thoại: [[CẦN XÁC NHẬN: PL-05]]

### 2.2. Tài liệu đã mua và giao dịch với gian hàng

Tiền mua tài liệu được chuyển thẳng tới người bán, và người bán chịu trách nhiệm hỗ trợ người mua của gian hàng mình. Khi tài
liệu bị lỗi, không tải được, không đúng mô tả hoặc cần hoàn tiền, bạn hãy liên hệ gian hàng trước qua biểu mẫu liên hệ trên
trang gian hàng. Nếu không được giải quyết, bạn có thể gửi email hỗ trợ ở mục 2.1, kèm mã đơn hàng.

### 2.3. Báo cáo nội dung vi phạm

Dùng nút báo cáo trên trang tài liệu, đánh giá hoặc bài viết. Cách gửi báo cáo và cách chúng tôi xử lý: xem
[Chính sách nội dung](/chinh-sach-noi-dung).

### 2.4. Bản quyền và dữ liệu cá nhân

- Khiếu nại bản quyền: dùng nút báo cáo, chọn "Vi phạm bản quyền" và cung cấp thông tin theo hướng dẫn tại
  [Cam kết bản quyền](/cam-ket-ban-quyen). Khi cần gửi văn bản, giấy tờ kèm theo, gửi tới email bên dưới.
- Câu hỏi và yêu cầu về dữ liệu cá nhân: xem [Chính sách bảo mật](/chinh-sach-bao-mat).
- Email tiếp nhận về bản quyền và dữ liệu cá nhân: [[CẦN XÁC NHẬN: PL-07]]

## 3. Lưu ý khi liên hệ

- Gửi từ email đăng nhập tài khoản của bạn (nếu có) để chúng tôi xác định đúng tài khoản.
- Ghi rõ mã đơn hàng hoặc đường liên kết tới tài liệu, gian hàng liên quan.
- Không bao giờ gửi mật khẩu cho bất kỳ ai, kể cả người tự xưng là nhân viên của {brand}. Chúng tôi không yêu cầu bạn cung cấp
  mật khẩu.

## 4. Văn bản liên quan

- [Điều khoản sử dụng](/dieu-khoan-su-dung)
- [Chính sách bảo mật](/chinh-sach-bao-mat)
- [Chính sách nội dung](/chinh-sach-noi-dung)

---

**Ghi chú nội bộ (không chép vào CMS)** — Long đối chiếu ngày 2026-10-24.
✅ đã đối chiếu code/schema · 🟡 theo ADR/báo cáo · ❓ cần chủ dự án / luật sư.

| Mục | Khẳng định | Mức | Căn cứ |
|---|---|---|---|
| 1 | Thông tin pháp nhân | ❓ | PL-01…PL-04 — chưa có. Hệ thống **không** có nơi lưu các trường này (`SystemSettings` chỉ có `supportEmail`) → đợt 2 nhập thẳng vào nội dung văn bản; phương án đọc từ cấu hình là việc sau (kế hoạch §6) |
| 2.1 | Email hỗ trợ | ✅ cột / ❓ giá trị | `SystemSettings.supportEmail` (nullable, `/admin/settings`). Nội dung văn bản **không** tự đọc giá trị này — admin gõ tay; nếu đổi `supportEmail` phải tạo phiên bản văn bản mới (rủi ro lệch, kế hoạch §6) |
| 2.2 | Tiền về thẳng người bán | 🟡 | ADR-039; KD-01 |
| 2.2 | Biểu mẫu liên hệ trên trang gian hàng | ✅ / ❓ | `StorefrontMessage` (ADR-023 mục 5) — chỉ có khi gian hàng bật khối liên hệ (Long chưa kiểm cấu hình mặc định) |
| 2.3 | Nút báo cáo ở trang tài liệu, đánh giá, bài viết | ✅ | `report-abuse.tsx`, `AbuseTargetType` |
| 2.4 | Một email chung cho bản quyền + dữ liệu cá nhân | ❓ | PL-07 — nếu chủ dự án dùng 2 email riêng, tách thành 2 dòng |
| 3 | "Chúng tôi không yêu cầu mật khẩu" | — cam kết vận hành | Khớp CLAUDE.md §7 (không có luồng nào hỏi mật khẩu ngoài đăng nhập/đổi bảo mật) — chủ dự án xác nhận giữ |
| — | Không có mục "thời gian phản hồi/giờ làm việc" | — | Brief §3, §4.4: không tự đặt thời hạn. Nếu chủ dự án muốn công bố → thêm mục mới, mã mới |

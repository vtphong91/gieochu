---
tags: [phap-ly, checklist, legal-review]
date: 2026-10-23
---

# Checklist rà soát pháp lý — Gieo Chữ (bản đầu)

> Người soạn: Long (tài liệu) theo brief của Quốc, 2026-10-23, dựa trên
> `docs/claude-code-gieochu-legal-pages-implementation-brief.md` §5 và kế hoạch
> `docs/ke-hoach-home-legal-menu-seo-2026-10-23.md` (§3, §8).
>
> **Đây không phải tư vấn pháp lý.** Danh sách chỉ ghi những thông tin còn thiếu và những điều khoản cần chủ dự án/luật sư
> xác nhận trước khi công bố. Chưa có trang chính sách nào được phát hành; đã có bản dự thảo Điều khoản sử dụng (`docs/legal/drafts/dieu-khoan-su-dung.md`)
> và 6 dự thảo đợt 2 (2026-10-24, `docs/ke-hoach-trang-phap-ly-dot-2-2026-10-24.md`).
>
> **Quy ước:**
> - Trạng thái: `CHƯA CÓ` (chưa ai cung cấp) · `ĐANG HỎI` · `ĐÃ XÁC NHẬN` (ghi ngày + người xác nhận) · `KHÔNG ÁP DỤNG` (ghi lý do).
> - Mức xác minh của phần "Hiện trạng trong code": ✅ đã đối chiếu code · 🟡 theo ADR/báo cáo · ❓ cần môi trường thật hoặc
>   chủ dự án/luật sư.
> - Mọi chỗ thiếu trong bản nháp văn bản ghi dạng `[[CẦN XÁC NHẬN: <mã mục>]]` (vd `[[CẦN XÁC NHẬN: PL-01]]`) — kế hoạch đề
>   xuất hệ thống **chặn Publish** khi văn bản còn dấu này.
> - Placeholder **không bao giờ** được hiện trên production như thông tin thật.

---

## 1. Thông tin pháp nhân và liên hệ

| Mã | Cần xác nhận | Lý do | Phụ trách | Trạng thái | Tác động nếu chưa xong |
|---|---|---|---|---|---|
| PL-01 | Tên pháp nhân / đơn vị vận hành chính thức (hoặc cá nhân vận hành) | Bắt buộc ở Điều khoản, Bảo mật (bên kiểm soát dữ liệu), trang Liên hệ & thông tin pháp lý | Chủ dự án | CHƯA CÓ | Không phát hành được Điều khoản, Bảo mật, trang Liên hệ (phần pháp lý) |
| PL-02 | Mã số doanh nghiệp / MST, ngày cấp, nơi cấp (nếu có) | Thông tin pháp lý công khai | Chủ dự án | CHƯA CÓ | Trang Liên hệ ẩn dòng này |
| PL-03 | Địa chỉ trụ sở / địa chỉ liên hệ pháp lý | Như trên | Chủ dự án | CHƯA CÓ | Như trên |
| PL-04 | Người đại diện theo pháp luật (nếu cần công bố) | Như trên | Chủ dự án + luật sư | CHƯA CÓ | Như trên |
| PL-05 | Số điện thoại hỗ trợ (nếu công bố) | Kênh liên hệ | Chủ dự án | CHƯA CÓ | Trang Liên hệ ẩn dòng này |
| PL-06 | Email hỗ trợ chung | Hiện trạng: `SystemSettings.supportEmail` có sẵn (sửa ở `/admin/settings`) ✅; giá trị trên production ❓ | Chủ dự án | ĐANG HỎI | Trang Liên hệ, email báo cáo vi phạm thiếu kênh liên hệ |
| PL-07 | Email riêng cho **bản quyền** và cho **quyền riêng tư/dữ liệu cá nhân** (hay dùng chung PL-06) | Brief §5; hệ thống hiện chỉ có **một** email ✅ | Chủ dự án | CHƯA CÓ | Cam kết bản quyền, Bảo mật ghi kênh chung |

## 2. Mô hình kinh doanh và giao dịch

| Mã | Cần xác nhận | Lý do | Phụ trách | Trạng thái | Tác động nếu chưa xong |
|---|---|---|---|---|---|
| KD-01 | Gieo Chữ là **nền tảng trung gian**, **nhà cung cấp nội dung**, hay kết hợp? | Quyết định trách nhiệm trong Điều khoản, Chính sách người bán, Hoàn tiền. Hiện trạng: ADR-039 ghi "nền tảng không giữ tiền bán tài liệu — tiền về thẳng tenant" 🟡; mỗi tenant tự cấu hình cổng thanh toán (`TenantPaymentConfig`) ✅ | Chủ dự án + luật sư | CHƯA CÓ | Không soạn được phần trách nhiệm/giới hạn trách nhiệm |
| KD-02 | Có nghĩa vụ đăng ký/thông báo **website/sàn thương mại điện tử** (Bộ Công Thương) không? Có cần trang **Quy chế hoạt động** không? | Brief §4.7, §5 | Luật sư | CHƯA CÓ | Không tạo trang Quy chế hoạt động; footer không có logo/thông tin đăng ký |
| KD-03 | Nhà cung cấp thanh toán đang dùng thực tế | Hiện trạng code: cổng tenant `MANUAL_QR`, `SEPAY`, `MOMO` ✅; cổng nền tảng (thu phí gói) — cấu hình production ❓ | Chủ dự án | ĐANG HỎI | Bảo mật (bên nhận dữ liệu), Hoàn tiền mô tả sai phương thức |
| KD-04 | Phí nền tảng / hoa hồng trên giao dịch tài liệu (có hay không) | Brief §4.5 cấm tự bịa tỷ lệ. Hiện trạng: thu phí theo **gói** (Bảng giá, ADR-021/041) ✅; không thấy hoa hồng theo giao dịch trong code ❓ | Chủ dự án | CHƯA CÓ | Chính sách người bán chỉ link `/pricing`, không nêu số |
| KD-05 | Thuế, chứng từ/hoá đơn cho người bán và người mua | Brief §4.5 | Chủ dự án + luật sư/kế toán | CHƯA CÓ | Chính sách người bán thiếu phần thuế |
| KD-06 | Đối soát, khoản bị giữ, giao dịch tranh chấp | Brief §4.5 "chỉ mô tả theo logic hiện có". Hiện trạng: không thấy cơ chế giữ tiền/đối soát của nền tảng cho giao dịch tài liệu ❓ | Chủ dự án | CHƯA CÓ | Không mô tả mục này |
| KD-07 | Câu chữ về **hoàn tiền tài liệu**: khi nào giao dịch hoàn tất; file lỗi/không đúng mô tả; thanh toán trùng; giao dịch trái phép; tài liệu bị gỡ sau khi mua | Hiện trạng: không hoàn tiền tự động; khi vi phạm được xác nhận khách chọn "tải lần cuối" hoặc "yêu cầu hoàn tiền", tenant tự hoàn (ADR-039) 🟡/✅ schema; tenant được đề nghị xử lý trong 7 ngày (ADR-039) 🟡 | Chủ dự án + luật sư | CHƯA CÓ | Không phát hành Chính sách hoàn tiền |
| KD-08 | Câu chữ về **hoàn tiền gói dịch vụ** | Hiện trạng: hoàn tiền gói 7 ngày (ADR-041) 🟡 | Chủ dự án | CHƯA CÓ | Như trên |
| KD-09 | Quyền bắt buộc của người tiêu dùng cần bảo lưu | Brief §4.5 — không được viết "mọi sản phẩm số không hoàn tiền" | Luật sư | CHƯA CÓ | Như trên |
| KD-10 | Phạm vi giấy phép người mua nhận khi mua tài liệu (cá nhân/lớp học/tổ chức; được in, chia sẻ?) | Trang Quyền sử dụng tài liệu; ADR-039 có câu "chỉ dùng cá nhân, không phát tán" ở cảnh báo tải lần cuối 🟡 | Chủ dự án + luật sư | CHƯA CÓ | Không phát hành trang Quyền sử dụng |
| KD-11 | Cách diễn đạt "miễn phí" (gói FREE không hết hạn có trong code — ADR-021 ✅; nút header "Mở gian hàng miễn phí" ✅) | Brief trang chủ §8 | Chủ dự án | CHƯA CÓ | Giữ/đổi chữ CTA |

## 3. Người dùng và người bán

| Mã | Cần xác nhận | Lý do | Phụ trách | Trạng thái | Tác động nếu chưa xong |
|---|---|---|---|---|---|
| ND-01 | **Độ tuổi tối thiểu** / năng lực hành vi để tạo tài khoản, mua, mở gian hàng | Brief §4.1. Hiện trạng: đăng ký không hỏi tuổi ✅ | Chủ dự án + luật sư | CHƯA CÓ | Điều khoản thiếu điều kiện tài khoản |
| ND-02 | Có người dùng là trẻ em/học sinh không; nghĩa vụ với dữ liệu trẻ em | Brief §4.6 | Luật sư | CHƯA CÓ | Bảo mật thiếu mục dữ liệu trẻ em |
| ND-03 | Điều kiện mở và duy trì gian hàng; có **xác minh người bán** (giấy tờ, ngân hàng) không | Brief §4.5, §5. Hiện trạng: mở gian hàng không xác minh, không bước chấp thuận ✅ | Chủ dự án | CHƯA CÓ | Chính sách người bán thiếu điều kiện |
| ND-04 | Người dùng/người bán **đã có** (chỉ có `UserProfile.consentAt`, không phiên bản ✅) xử lý thế nào khi có Điều khoản v1: chấp thuận lại hay coi như đã chấp thuận; thời gian ân hạn | Brief §7 "không làm gián đoạn người dùng hiện hữu" | Chủ dự án + luật sư | CHƯA CÓ | Không bật cơ chế chấp thuận theo phiên bản |
| ND-05 | Thay đổi nào là "**trọng yếu**" (bắt buộc chấp thuận lại); cách và thời hạn thông báo trước | Brief §4.1, §7 | Chủ dự án + luật sư | CHƯA CÓ | Không đặt được cờ `requiresReacceptance` |
| ND-06 | Có lưu IP / User-Agent làm bằng chứng chấp thuận không; giữ bao lâu | Dữ liệu cá nhân (brief §7 "chỉ thu thập dữ liệu cần thiết") | Chủ dự án + luật sư | CHƯA CÓ | Chỉ lưu userId + phiên bản + thời điểm |
| ND-07 | Quy trình **xoá tài khoản/dữ liệu** theo yêu cầu. Hiện trạng: chưa có tính năng tự xoá ✅ | Brief §4.7; quyền của chủ thể dữ liệu | Chủ dự án | CHƯA CÓ | Bảo mật chỉ ghi "gửi yêu cầu qua email" (nếu được duyệt) |
| ND-08 | **Quy trình tạm ngưng/chấm dứt tài khoản** (và gian hàng): thông báo trước, cơ hội giải trình, quyền lợi người dùng khi bị tạm ngưng/chấm dứt. Hiện trạng: admin khoá gian hàng (`LOCK_TENANT`, ADR-038) ✅ schema; READ_ONLY/LOCKED ẩn tài liệu, chặn đơn mới (ADR-040) 🟡; chưa có quy trình thông báo/giải trình | Brief §4.1 "quy trình hợp lý"; Điều khoản mục 12 | Chủ dự án + luật sư | CHƯA CÓ | Điều khoản mục 12 còn placeholder — không xuất bản được |

## 4. Dữ liệu cá nhân và quyền riêng tư

| Mã | Cần xác nhận | Lý do | Phụ trách | Trạng thái | Tác động nếu chưa xong |
|---|---|---|---|---|---|
| DL-01 | Danh sách **bên nhận/xử lý dữ liệu** thực tế trên production. Có trong code ✅: Neon (Postgres), Cloudflare R2 và/hoặc MinIO (ADR-044), Cloudinary (ảnh), SMTP (cấu hình ở System Center — nhà cung cấp ❓), SePay/MoMo (theo tenant), Vercel (thử nghiệm) / VPS (production, ADR-049 🟡) | Brief §4.6 "chỉ nêu nhà cung cấp thực tế được tích hợp" | Chủ dự án | ĐANG HỎI | Bảo mật thiếu mục bên nhận dữ liệu |
| DL-02 | **Vị trí máy chủ**, có chuyển dữ liệu ra nước ngoài không (vùng Neon, R2, Cloudinary, VPS) | Brief §4.6 | Chủ dự án + luật sư | CHƯA CÓ | Không viết mục chuyển dữ liệu ra nước ngoài |
| DL-03 | Căn cứ/mục đích xử lý từng nhóm dữ liệu; dữ liệu bắt buộc vs tuỳ chọn. Hiện trạng: đăng ký thu email, mật khẩu (hash), họ tên ✅; hồ sơ tuỳ chọn SĐT, tỉnh/thành, ảnh đại diện ✅ | Brief §4.6 | Luật sư | CHƯA CÓ | — |
| DL-04 | **Thời gian lưu** từng loại dữ liệu. Hiện trạng có trong code ✅: audit log giữ 12 tháng (ADR-037), IP báo cáo vi phạm xoá sau 12 tháng (ADR-038); các dữ liệu khác chưa có chính sách | Brief §4.6, §5 | Chủ dự án + luật sư | CHƯA CÓ | Bảo mật thiếu mục lưu trữ |
| DL-05 | Cookie: hiện chỉ thấy 2 cookie phiên đăng nhập `gieochu_access`, `gieochu_refresh` (httpOnly) và không thấy analytics ✅ (grep code); cookie do hạ tầng (CDN/hosting) đặt ❓. Xác nhận chưa dùng analytics/quảng cáo | Quyết định gộp trang Cookie vào Bảo mật | Chủ dự án | ĐANG HỎI | Nếu sắp dùng analytics → cần trang Cookie + cơ chế lựa chọn |
| DL-06 | Quy trình xử lý **sự cố dữ liệu** (ai, thông báo cho ai) | Brief §4.6 | Chủ dự án + luật sư | CHƯA CÓ | Bảo mật thiếu mục sự cố |
| DL-07 | Kênh và quy trình tiếp nhận yêu cầu của chủ thể dữ liệu (xem, sửa, xoá, rút đồng ý) | Brief §4.6 | Chủ dự án | CHƯA CÓ | — |
| DL-08 | **Vai trò của người bán** đối với dữ liệu người mua mà gian hàng nhận được (họ tên, email, lịch sử mua tại gian hàng; tin nhắn liên hệ) — bên kiểm soát độc lập hay bên xử lý thay Nền tảng; nghĩa vụ của người bán (mục đích được dùng, cấm chia sẻ/quảng cáo khi chưa đồng ý). Hiện trạng ✅: `apps/web/lib/customer-list.ts` chỉ đọc `users.email` + `user_profiles.fullName`; `StorefrontMessage` lưu tên/email/nội dung | Bảo mật mục 1, 4.2; Chính sách người bán mục 8 | Luật sư + chủ dự án | CHƯA CÓ | Bảo mật và Chính sách người bán không xuất bản được |
| DL-09 | Thời gian lưu **nhật ký tải tài liệu** (`download_events`: thời điểm, tệp, **IP**). Hiện trạng ✅: không có bước dọn trong `/api/cron/daily` (khác audit log / IP báo cáo đã có hạn 12 tháng) — nếu chốt thời hạn thì cần thêm bước dọn (việc của Hiếu) | Bảo mật mục 7 | Chủ dự án + luật sư | CHƯA CÓ | Bảo mật mục 7 còn placeholder |

## 5. Bản quyền, nội dung, báo cáo vi phạm

| Mã | Cần xác nhận | Lý do | Phụ trách | Trạng thái | Tác động nếu chưa xong |
|---|---|---|---|---|---|
| BQ-01 | Nội dung **Cam kết bản quyền** (tác giả/chủ sở hữu/được uỷ quyền; giấy phép mở/CC; tài liệu tạo với AI; tài liệu nhóm/trường/quan hệ lao động; nghĩa vụ cung cấp bằng chứng) | Brief §4.2. Hiện trạng: ô "Tôi sở hữu hoặc có quyền phân phối tài liệu này" bắt buộc mỗi lần xuất bản, lưu `rightsConfirmedAt` ✅ — chưa có văn bản để link | Luật sư | CHƯA CÓ | Ô cam kết không có văn bản tham chiếu |
| BQ-02 | Danh mục **nội dung bị cấm / hạn chế / được phép** và cách diễn đạt nhóm an ninh quốc gia theo hành vi pháp luật cấm | Brief §4.3 | Luật sư | CHƯA CÓ | Không phát hành Chính sách nội dung |
| BQ-03 | **Hình thức xử lý** vi phạm và cơ chế **kháng nghị**. Hiện trạng ✅: admin ẩn nội dung, lưu trữ sản phẩm (khoá kiểm duyệt), khoá gian hàng, bác bỏ (ADR-038); tenant không thấy danh tính người báo cáo; **chưa có** kháng nghị | Brief §4.3, §4.4, §8 | Chủ dự án + luật sư | CHƯA CÓ | Chính sách nội dung thiếu phần kháng nghị |
| BQ-04 | **Biện pháp tạm thời** khi có khiếu nại chưa xác minh: có tạm ẩn không, ai quyết | Brief §3 "không tự động gỡ chỉ dựa vào một khiếu nại chưa xác minh" | Chủ dự án + luật sư | CHƯA CÓ | Quy trình báo cáo thiếu bước 4 |
| BQ-05 | **Thời hạn phản hồi/xử lý** báo cáo được công bố (nếu có). Hiện trạng: không có SLA trong code ✅ | Brief §4.4 cấm tự đặt SLA | Chủ dự án | CHƯA CÓ | Trang báo cáo không nêu thời hạn |
| BQ-06 | Thời gian **lưu hồ sơ khiếu nại** | Brief §5 | Chủ dự án + luật sư | CHƯA CÓ | — |
| BQ-07 | Báo cáo "gian lận giao dịch": chấp nhận chỉ lưu mã đơn dạng văn bản (System Admin **không** đọc chi tiết đơn của tenant — CLAUDE.md §7.9 ✅) | Kế hoạch §3.5 | Chủ dự án | CHƯA CÓ | Không thêm loại báo cáo giao dịch |
| BQ-08 | **Cam kết không xử lý chỉ dựa trên báo cáo chưa xem xét** — câu ở Điều khoản mục 11 "không gỡ tài liệu hay khoá tài khoản chỉ dựa trên một báo cáo chưa được xem xét". Hiện trạng: mọi quyết định xử lý báo cáo do admin thực hiện ở `/admin/reports`, không có xử lý tự động ✅ (audit kế hoạch L6) | Brief §3; đây là cam kết công khai, ràng buộc vận hành sau này | Chủ dự án + luật sư | CHƯA CÓ | Điều khoản mục 11 còn placeholder — không xuất bản được |
| BQ-09 | **Yêu cầu khai báo tài liệu có sử dụng AI** (bắt buộc ghi trong mô tả, khuyến khích, hay không yêu cầu). Hiện trạng ✅: sản phẩm **không** có trường khai báo AI; nếu bắt buộc thì cần trường/ô xác nhận mới (việc của Hiếu, có thể cần migration) | Brief §4.2, §4.3 | Chủ dự án + luật sư | CHƯA CÓ | Chính sách nội dung mục 6, Cam kết bản quyền mục 6 còn placeholder |

## 6. Vận hành văn bản

| Mã | Cần xác nhận | Lý do | Phụ trách | Trạng thái | Tác động nếu chưa xong |
|---|---|---|---|---|---|
| VH-01 | Có luật sư rà soát không; lịch dự kiến | Brief §3 "không viết như thể đã được luật sư phê duyệt" | Chủ dự án | CHƯA CÓ | Mọi văn bản giữ trạng thái dự thảo |
| VH-02 | Có công bố **bản dự thảo** (nhãn "Bản dự thảo") trước khi luật sư duyệt không | Kế hoạch §7.2 L-3 | Chủ dự án | CHƯA CÓ | Không có văn bản công khai; checkbox đăng ký tạm chưa có link |
| VH-03 | Ai được phát hành văn bản pháp lý (mọi System Admin hay chỉ super admin) | Kế hoạch Q-B10 | Chủ dự án | CHƯA CÓ | — |
| VH-04 | Pháp luật áp dụng và cơ chế giải quyết tranh chấp (toà án/trọng tài, nơi giải quyết) | Brief §4.1. | Luật sư | CHƯA CÓ | Điều khoản thiếu mục tranh chấp |
| VH-05 | Giới hạn trách nhiệm được diễn đạt phù hợp pháp luật, không loại trừ nghĩa vụ bắt buộc; không tuyên bố miễn toàn bộ trách nhiệm vì người bán cam kết | Brief §3, §4.1 | Luật sư | CHƯA CÓ | Điều khoản thiếu mục giới hạn trách nhiệm |
| VH-06 | Giấy phép giới hạn người bán cấp cho nền tảng (lưu trữ, hiển thị, phân phối, quảng bá) và tuyên bố không chuyển quyền sở hữu | Brief §4.1 | Luật sư | CHƯA CÓ | — |
| VH-07 | **Văn bản dẫn chiếu chưa phát hành** — Điều khoản dẫn tới văn bản khác chưa có (hiện: Chính sách bảo mật ở Điều khoản mục 13; văn bản này hoãn sang giai đoạn pháp lý theo ADR-050). *2026-10-24:* đã có dự thảo `docs/legal/drafts/chinh-sach-bao-mat.md` (đợt 2, chờ chốt); các dự thảo đợt 2 dẫn chiếu chéo nhau bằng `/<slug>` (URL cấp gốc, ADR-054) — chỉ xuất bản một văn bản khi mọi văn bản nó dẫn tới đã có bản hiệu lực, hoặc xuất bản đồng loạt (kế hoạch đợt 2 §7) | Không dẫn chiếu tới văn bản không tồn tại trên production | Chủ dự án | CHƯA CÓ | Điều khoản còn placeholder tới khi văn bản được dẫn chiếu xuất bản hoặc câu dẫn chiếu được sửa |

---

## 7. Điều khoản bắt buộc luật sư xác nhận trước khi công bố

Tổng hợp từ các mục trên (không công bố khi chưa có xác nhận): KD-01, KD-02, KD-07, KD-09, KD-10, ND-01, ND-02, ND-04,
ND-05, ND-08, DL-02, DL-03, DL-04, DL-06, DL-08, DL-09, BQ-01, BQ-02, BQ-03, BQ-04, BQ-08, BQ-09, VH-04, VH-05, VH-06.

## 8. Nhật ký cập nhật checklist

| Ngày | Người | Thay đổi |
|---|---|---|
| 2026-10-23 | Long | Bản đầu theo brief pháp lý §5 và audit code ngày 2026-10-23 |
| 2026-10-23 | Long | Thêm ND-08 (tạm ngưng/chấm dứt tài khoản), VH-07 (văn bản dẫn chiếu chưa phát hành); BQ-08 (cam kết mục 11 Điều khoản) — theo Quốc chốt. Dự thảo Điều khoản: `docs/legal/drafts/dieu-khoan-su-dung.md` |
| 2026-10-24 | Long | Đợt 2 (kế hoạch `docs/ke-hoach-trang-phap-ly-dot-2-2026-10-24.md`): thêm DL-08 (vai trò người bán với dữ liệu người mua), DL-09 (thời hạn lưu nhật ký tải có IP), BQ-09 (khai báo tài liệu dùng AI); cập nhật VH-07 và đầu file. 6 dự thảo mới trong `docs/legal/drafts/`: `chinh-sach-bao-mat`, `chinh-sach-noi-dung`, `cam-ket-ban-quyen`, `quyen-su-dung-tai-lieu`, `chinh-sach-nguoi-ban`, `lien-he` |

> **BẢN DỰ THẢO — chưa được luật sư rà soát.**
>
> Văn bản: Chính sách bảo mật (gộp cookie + lưu trữ dữ liệu + khoá tài khoản). Khoá đề xuất `privacy`, đường dẫn dự kiến
> `/chinh-sach-bao-mat` (URL cấp gốc, ADR-054). Người soạn: Long (tài liệu), 2026-10-24, theo
> `docs/claude-code-gieochu-legal-pages-implementation-brief.md` §4.6, §4.7 và `docs/legal/LEGAL_REVIEW_CHECKLIST.md`.
> Kế hoạch: `docs/ke-hoach-trang-phap-ly-dot-2-2026-10-24.md`. Đây **không** phải tư vấn pháp lý và **không** được công bố
> như văn bản có hiệu lực khi còn bất kỳ dấu `[[CẦN XÁC NHẬN: …]]` nào (hệ thống chặn xuất bản theo ADR-050).
>
> Quy ước nhập vào CMS: chỉ chép phần từ "1. Giới thiệu và phạm vi áp dụng" đến hết mục "14. Liên hệ về dữ liệu cá nhân";
> **không** chép khối dẫn này và phần "Ghi chú nội bộ" cuối file. Chỉ dùng H2/H3 (mục lục dựng từ H2). Liên kết tới văn
> bản khác ghi dạng đường dẫn `/<slug>` (URL cấp gốc, ADR-054) — tạo link trong editor khi nhập. Số phiên bản và ngày hiệu lực do hệ
> thống hiển thị, không gõ trong nội dung.

## 1. Giới thiệu và phạm vi áp dụng

Chính sách bảo mật này giải thích {brand} thu thập những dữ liệu cá nhân nào khi bạn sử dụng Nền tảng, dùng chúng để làm
gì, ai được xem, lưu trong bao lâu và bạn có những quyền gì.

Đơn vị chịu trách nhiệm xử lý dữ liệu cá nhân trên Nền tảng: [[CẦN XÁC NHẬN: PL-01]] (sau đây gọi là "chúng tôi").

Các thuật ngữ như Nền tảng, Tài khoản, Gian hàng, Người bán, Người mua, Tài liệu được hiểu như trong
[Điều khoản sử dụng](/dieu-khoan-su-dung).

Chính sách này áp dụng cho dữ liệu do chúng tôi xử lý khi vận hành Nền tảng. Khi bạn mua tài liệu hoặc liên hệ với một gian
hàng, người bán của gian hàng đó cũng nhận được một phần dữ liệu của bạn (mục 4.2). Trách nhiệm của người bán đối với dữ
liệu này: [[CẦN XÁC NHẬN: DL-08]].

## 2. Dữ liệu chúng tôi thu thập

### 2.1. Khi bạn tạo tài khoản

- Địa chỉ email (dùng để đăng nhập và nhận thông báo).
- Mật khẩu. Chúng tôi chỉ lưu mật khẩu dưới dạng đã băm một chiều, không lưu và không xem được mật khẩu gốc của bạn.
- Họ và tên.
- Thời điểm bạn đồng ý Điều khoản sử dụng và phiên bản Điều khoản bạn đã chấp thuận.

Đây là các dữ liệu bắt buộc. Nếu không cung cấp, bạn không tạo được tài khoản.

### 2.2. Thông tin hồ sơ tuỳ chọn

Trong trang tài khoản, bạn có thể bổ sung số điện thoại, tỉnh/thành và ảnh đại diện. Các thông tin này không bắt buộc; bạn
có thể sửa hoặc bỏ trống bất cứ lúc nào.

### 2.3. Khi bạn mở và vận hành gian hàng

- Thông tin gian hàng do bạn nhập: tên, địa chỉ gian hàng, phần giới thiệu, hình ảnh và nội dung trang gian hàng.
- Cấu hình nhận tiền của gian hàng. Các khoá bí mật của cổng thanh toán được mã hoá trước khi lưu và không hiển thị lại đầy
  đủ trên giao diện.
- Gói dịch vụ, hoá đơn và lịch sử thanh toán gói.
- Khi bạn yêu cầu hoàn tiền gói dịch vụ: thông tin tài khoản nhận tiền (ngân hàng, số tài khoản, tên chủ tài khoản). Thông
  tin này được mã hoá, chỉ quản trị viên Nền tảng xem được để chuyển khoản, và được xoá khi yêu cầu đã được hoàn tiền xong
  hoặc bị từ chối.

### 2.4. Khi bạn mua hoặc nhận tài liệu

- Thông tin đơn hàng: mã đơn, tài liệu, số tiền, mã giảm giá (nếu có), cổng thanh toán đã chọn, trạng thái và thời điểm
  thanh toán.
- Quyền tải tài liệu và số lượt tải đã dùng.
- Mỗi lượt tải: thời điểm, tệp được tải và địa chỉ IP.

### 2.5. Nội dung bạn gửi lên Nền tảng

- Tài liệu, mô tả, hình ảnh và bài viết của gian hàng.
- Đánh giá tài liệu. Đánh giá hiển thị công khai kèm tên rút gọn của bạn (tên và chữ cái đầu của họ), không hiển thị email.
- Tin nhắn bạn gửi qua biểu mẫu liên hệ trên trang gian hàng: tên, email và nội dung tin nhắn.

### 2.6. Khi bạn gửi báo cáo vi phạm

Loại vi phạm, mô tả, các đường liên kết bằng chứng, email liên hệ (bắt buộc với người chưa đăng nhập; người đã đăng nhập dùng
email tài khoản) và địa chỉ IP của thiết bị gửi báo cáo.

### 2.7. Dữ liệu kỹ thuật và phiên đăng nhập

- Mỗi phiên đăng nhập ghi lại: địa chỉ IP, thông tin trình duyệt và thiết bị (do trình duyệt gửi kèm), thời điểm đăng nhập
  và thời điểm hoạt động gần nhất. Bạn xem được danh sách này trong trang bảo mật tài khoản.
- Nhật ký hoạt động cho các thao tác quan trọng (ví dụ đăng nhập, đổi mật khẩu, thao tác quản trị), gồm thời điểm, loại thao
  tác, địa chỉ IP và thông tin trình duyệt.

## 3. Mục đích sử dụng dữ liệu

Chúng tôi dùng dữ liệu nêu ở mục 2 để:

- Tạo và duy trì tài khoản, xác minh email, cho bạn đăng nhập và giữ phiên đăng nhập.
- Vận hành gian hàng, hiển thị tài liệu, xử lý đơn hàng và giao tài liệu cho người mua.
- Thu phí gói dịch vụ và xử lý yêu cầu hoàn tiền gói.
- Gửi email giao dịch và email bảo mật: kích hoạt tài khoản, đặt lại mật khẩu, xác nhận đổi email, thông báo đơn hàng, thông
  báo kết quả xử lý báo cáo vi phạm và các thông báo cần thiết khác về tài khoản.
- Bảo vệ tài khoản và Nền tảng: phát hiện đăng nhập bất thường, giới hạn số lần gửi yêu cầu, chống thư rác và lạm dụng chức
  năng báo cáo.
- Tiếp nhận và xử lý báo cáo vi phạm, khiếu nại.
- Tuân thủ nghĩa vụ theo quy định pháp luật.

Căn cứ pháp lý cho từng hoạt động xử lý: [[CẦN XÁC NHẬN: DL-03]].

## 4. Ai được xem dữ liệu của bạn

### 4.1. Bạn

Bạn xem và sửa được thông tin tài khoản, hồ sơ, đơn hàng, Thư viện tài liệu và danh sách thiết bị đăng nhập của mình trong
trang tài khoản.

### 4.2. Người bán

Khi bạn mua hoặc nhận tài liệu của một gian hàng, người bán của gian hàng đó xem được họ tên, email và lịch sử mua của bạn
**tại gian hàng đó**. Người bán không xem được số điện thoại và tỉnh/thành trong hồ sơ của bạn.

Khi bạn gửi tin nhắn qua biểu mẫu liên hệ của một gian hàng, người bán xem được tên, email và nội dung tin nhắn.

Khi bạn gửi báo cáo vi phạm, người bán **không** được biết danh tính hay email của bạn; người bán chỉ biết loại vi phạm, nội
dung bị xử lý và quyết định xử lý.

### 4.3. Người truy cập Nền tảng

Thông tin công khai gồm: thông tin gian hàng, tài liệu đã xuất bản, bài viết của gian hàng và đánh giá (kèm tên rút gọn như
mục 2.5).

### 4.4. Quản trị viên Nền tảng

Quản trị viên Nền tảng có quyền truy cập dữ liệu tài khoản và hồ sơ (kể cả thông tin tuỳ chọn), báo cáo vi phạm và nhật ký
hoạt động trong phạm vi cần thiết để vận hành, hỗ trợ và xử lý vi phạm. Quản trị viên không có chức năng xem chi tiết đơn
hàng và danh sách khách hàng của từng gian hàng; Nền tảng chỉ tổng hợp số liệu thống kê theo gian hàng.

### 4.5. Nhà cung cấp dịch vụ

Để vận hành Nền tảng, chúng tôi sử dụng các nhà cung cấp dịch vụ xử lý dữ liệu thay mặt chúng tôi, thuộc các nhóm:

- Lưu trữ máy chủ và cơ sở dữ liệu.
- Lưu trữ tệp tài liệu.
- Lưu trữ và hiển thị hình ảnh (ảnh bìa, ảnh trong nội dung, ảnh đại diện, logo).
- Gửi email.
- Cổng thanh toán: khi bạn thanh toán, dữ liệu giao dịch cần thiết được chuyển tới cổng thanh toán mà gian hàng (hoặc Nền
  tảng, với gói dịch vụ) sử dụng.

Danh sách nhà cung cấp cụ thể: [[CẦN XÁC NHẬN: DL-01]].

### 4.6. Cơ quan nhà nước

Chúng tôi cung cấp dữ liệu cho cơ quan nhà nước có thẩm quyền khi có yêu cầu theo quy định pháp luật.

## 5. Cookie và lưu trữ trên trình duyệt

### 5.1. Cookie đăng nhập

Nền tảng dùng hai cookie cần thiết để duy trì phiên đăng nhập. Hai cookie này chỉ được gửi qua kết nối bảo mật, không đọc
được bằng mã chạy trên trang và chỉ phục vụ việc đăng nhập. Nếu bạn chặn các cookie này, bạn sẽ không đăng nhập được.

- Mặc định, phiên đăng nhập kết thúc khi bạn đóng trình duyệt, khi bạn không thao tác trong một khoảng thời gian, hoặc khi
  phiên đạt thời hạn tối đa. Trước khi tự đăng xuất vì không thao tác, Nền tảng hiện thông báo để bạn chọn tiếp tục.
- Nếu bạn chọn "Ghi nhớ đăng nhập", phiên được giữ cả khi đóng trình duyệt, tối đa không quá 30 ngày kể từ lúc đăng nhập.
  Không nên chọn mục này trên máy dùng chung.
- Bạn có thể đăng xuất từng thiết bị hoặc mọi thiết bị trong trang bảo mật tài khoản.

### 5.2. Lưu trữ cục bộ của trình duyệt

Nền tảng có lưu một số trạng thái giao diện trong bộ nhớ của trình duyệt (ví dụ nhóm menu đang mở trong khu vực quản lý).
Các dữ liệu này không chứa thông tin đăng nhập.

### 5.3. Phân tích và quảng cáo

Nền tảng hiện không dùng công cụ phân tích hành vi hay cookie quảng cáo. Việc sử dụng cookie do nhà cung cấp hạ tầng đặt:
[[CẦN XÁC NHẬN: DL-05]]. Nếu sau này sử dụng các công cụ này, chúng tôi sẽ cập nhật Chính sách bảo mật trước khi áp dụng.

## 6. Bảo vệ dữ liệu

Chúng tôi áp dụng các biện pháp kỹ thuật và tổ chức phù hợp để bảo vệ dữ liệu, ví dụ:

- Kết nối tới Nền tảng được mã hoá.
- Mật khẩu chỉ lưu dạng băm; khoá bí mật cổng thanh toán và thông tin tài khoản nhận hoàn tiền được mã hoá.
- Tệp tài liệu được lưu trong kho lưu trữ không công khai. Đường liên kết tải chỉ được cấp cho người có quyền tải và chỉ có
  hiệu lực trong thời gian ngắn.
- Sau nhiều lần nhập sai mật khẩu liên tiếp, tài khoản phải đặt lại mật khẩu trước khi đăng nhập lại.
- Đổi mật khẩu hoặc đổi email cần xác thực lại; khi đó các phiên đăng nhập khác bị đăng xuất và bạn nhận email thông báo.
- Quyền truy cập dữ liệu được giới hạn theo vai trò: mỗi gian hàng chỉ truy cập dữ liệu của chính gian hàng đó.

Lưu ý: hình ảnh (ảnh bìa, ảnh trong mô tả, ảnh đại diện, logo) được hiển thị qua đường dẫn ảnh; người có đường dẫn có thể
xem được ảnh. Vì vậy, không đưa thông tin riêng tư vào hình ảnh. Tài liệu mà người bán giao bằng đường liên kết tới dịch vụ
lưu trữ bên ngoài do người bán tự quản lý quyền truy cập.

Không có biện pháp nào an toàn tuyệt đối. Khi phát hiện tài khoản bị truy cập trái phép, bạn hãy đổi mật khẩu, đăng xuất
các thiết bị lạ và báo cho chúng tôi theo mục 14.

## 7. Thời gian lưu trữ

- Nhật ký hoạt động: 12 tháng, sau đó được xoá tự động.
- Địa chỉ IP trong báo cáo vi phạm: được xoá sau 12 tháng; nội dung báo cáo được giữ lại.
- Bản ghi phiên đăng nhập (gồm IP và thông tin thiết bị): được xoá 90 ngày sau khi phiên hết hạn hoặc bị đăng xuất.
- Thông tin tài khoản nhận hoàn tiền gói dịch vụ: được xoá khi yêu cầu hoàn tiền đã xử lý xong hoặc bị từ chối.
- Nhật ký tải tài liệu (gồm địa chỉ IP): [[CẦN XÁC NHẬN: DL-09]].
- Dữ liệu tài khoản, hồ sơ, gian hàng, đơn hàng và nội dung: [[CẦN XÁC NHẬN: DL-04]].
- Hồ sơ xử lý báo cáo vi phạm: [[CẦN XÁC NHẬN: BQ-06]].

## 8. Khoá tài khoản và yêu cầu xoá dữ liệu

Khi tài khoản vi phạm Điều khoản hoặc theo yêu cầu ngừng sử dụng, tài khoản có thể bị khoá: bạn không đăng nhập được nữa, mọi
phiên đăng nhập bị chấm dứt, dữ liệu được giữ nguyên.

Hiện Nền tảng chưa có chức năng để người dùng tự xoá tài khoản. Cách gửi yêu cầu xoá tài khoản hoặc xoá dữ liệu, phạm vi
dữ liệu được xoá và dữ liệu cần tiếp tục lưu theo quy định pháp luật: [[CẦN XÁC NHẬN: ND-07]].

## 9. Quyền của bạn

Bạn tự thực hiện được ngay trong trang tài khoản:

- Xem và sửa họ tên, số điện thoại, tỉnh/thành, ảnh đại diện.
- Đổi email đăng nhập (có xác minh qua email mới) và đổi mật khẩu.
- Xem danh sách thiết bị đăng nhập, đăng xuất từng thiết bị hoặc mọi thiết bị.

Với các quyền khác theo quy định pháp luật về bảo vệ dữ liệu cá nhân (ví dụ yêu cầu cung cấp bản sao dữ liệu, rút lại sự
đồng ý, phản đối hoặc hạn chế xử lý, yêu cầu xoá dữ liệu), cách gửi yêu cầu và quy trình xử lý: [[CẦN XÁC NHẬN: DL-07]].

## 10. Dữ liệu của trẻ em

Độ tuổi được tạo tài khoản theo mục 4.1 của [Điều khoản sử dụng](/dieu-khoan-su-dung). Quy định về dữ liệu cá nhân
của trẻ em và người chưa thành niên: [[CẦN XÁC NHẬN: ND-02]].

Người bán không được đưa dữ liệu cá nhân, hồ sơ hoặc hình ảnh nhận diện được của học sinh vào tài liệu khi chưa có căn cứ
hợp pháp (xem [Chính sách nội dung](/chinh-sach-noi-dung)).

## 11. Sự cố dữ liệu

Khi xảy ra sự cố có thể ảnh hưởng tới dữ liệu cá nhân, quy trình xử lý và việc thông báo cho người dùng, cơ quan có thẩm
quyền: [[CẦN XÁC NHẬN: DL-06]].

## 12. Nơi lưu trữ và chuyển dữ liệu ra nước ngoài

Vị trí lưu trữ dữ liệu và việc có chuyển dữ liệu cá nhân ra nước ngoài hay không: [[CẦN XÁC NHẬN: DL-02]].

## 13. Thay đổi Chính sách bảo mật

Mỗi lần sửa đổi Chính sách bảo mật tạo một phiên bản mới có ngày hiệu lực; ngày hiệu lực của phiên bản hiện hành hiển thị ở
đầu trang. Thay đổi nào được xem là quan trọng và cách thông báo trước cho người dùng: [[CẦN XÁC NHẬN: ND-05]].

## 14. Liên hệ về dữ liệu cá nhân

Các câu hỏi và yêu cầu về dữ liệu cá nhân, vui lòng gửi tới: [[CẦN XÁC NHẬN: PL-07]].

Thông tin đơn vị vận hành và các kênh liên hệ khác: [Liên hệ và thông tin pháp lý](/lien-he).

---

**Ghi chú nội bộ (không chép vào CMS)** — mức xác minh từng khẳng định trong nội dung, Long đối chiếu ngày 2026-10-24.
✅ đã đối chiếu code/schema · 🟡 theo ADR/báo cáo hoặc chưa đọc lại code · ❓ cần môi trường thật / chủ dự án / luật sư.

| Mục | Khẳng định | Mức | Căn cứ |
|---|---|---|---|
| 2.1 | Đăng ký thu email, mật khẩu (băm), họ tên; lưu thời điểm đồng ý | ✅ | `User.passwordHash`, `UserProfile.fullName/consentAt` (`schema.prisma`); băm ở `packages/auth/src/password.ts` |
| 2.1 | Lưu phiên bản Điều khoản đã chấp thuận | ✅ khi có bản hiệu lực | `user_legal_acceptances` + `recordLegalAcceptance` (`apps/web/lib/legal.ts`); chưa có bản PUBLISHED thì chỉ lưu `consentAt` (ADR-050) |
| 2.2 | SĐT, tỉnh/thành, ảnh đại diện tuỳ chọn | ✅ | `UserProfile.phone/province/avatarKey` nullable. Cột `occupation` có trong schema nhưng không thấy UI dùng (grep `apps/web/app`) → **không** nêu trong nội dung |
| 2.3 | Secret cổng thanh toán mã hoá, không hiện lại đầy đủ | ✅ quy tắc | CLAUDE.md §7.3; `PlatformPaymentConfig.encryptedSecrets`, `TenantPaymentConfig` |
| 2.3 | Thông tin nhận hoàn tiền gói mã hoá, chỉ admin xem, xoá khi xong/từ chối | ✅ cột / 🟡 luồng | `payoutEncrypted` (`schema.prisma`); luồng theo bổ sung ADR-041 |
| 2.4 | Mỗi lượt tải ghi thời điểm, tệp, IP | ✅ | `DownloadEvent` (`fileId`, `ip`, `createdAt`); `apps/web/lib/download.ts`, `share-link.ts` |
| 2.5 | Đánh giá hiện tên rút gọn | ✅ | `formatReviewerDisplayName` (`packages/core/src/review/review.ts`) — "Tên + chữ cái đầu họ." |
| 2.5 | Form liên hệ gian hàng lưu tên, email, nội dung | ✅ | `StorefrontMessage` (`name`, `email`, `message`, `ipHash`). IP chỉ lưu dạng băm → không liệt kê IP ở mục này |
| 2.6 | Báo cáo lưu loại, mô tả, link bằng chứng, email, IP | ✅ | `AbuseReport` (`schema.prisma`) |
| 2.7 | Phiên lưu IP, User-Agent, nhãn thiết bị, thời điểm | ✅ | `RefreshToken.ip/userAgent/deviceLabel/sessionStartedAt` — `apps/web/app/api/auth/login/route.ts` |
| 2.7 | Audit log có IP + User-Agent | ✅ | `AuditLog.ip/userAgent` (`schema.prisma`) |
| 3 | Danh sách email giao dịch | ✅ | Template trong `packages/email/src/templates/` (verify-email, reset-password, account-security, order-paid, new-sale, abuse-report, entitlement-remedy, subscription-*, storefront-message, new-review, product-file-rejected). Không có template marketing/bản tin |
| 4.2 | Người bán thấy họ tên + email + lịch sử mua tại gian hàng; không SĐT/tỉnh | ✅ | `apps/web/lib/customer-list.ts` (chỉ `users.email`, `user_profiles.fullName`) — ADR-041 C.1, ADR-048 |
| 4.2 | Người bán không biết danh tính người báo cáo | ✅ quy tắc | ADR-038 mục 4; bảng `abuse_reports` L1, tenant không đọc |
| 4.4 | Admin không xem chi tiết đơn/khách của tenant | ✅ quy tắc | CLAUDE.md §7.9; `tenant_daily_stats` |
| 4.4 | Admin truy cập hồ sơ (kể cả SĐT/tỉnh) | 🟡 | ADR-041 C.1 cho phép; UI admin xem SĐT/tỉnh **chưa có** (bổ sung ADR-041 lần 3 → BACKLOG). Câu viết "có quyền truy cập", không nói "đang hiển thị" |
| 4.5 | Nhóm nhà cung cấp: hosting/DB, lưu tệp, ảnh, email, thanh toán | ✅ có tích hợp / ❓ tên + vùng | Neon (`@prisma/adapter-neon`), R2/MinIO (ADR-044), Cloudinary (ADR-028), SMTP cấu hình ở System Center, `PaymentProviderId` `MANUAL_QR/SEPAY/MOMO`; Vercel thử nghiệm / VPS production (ADR-049). Tên cụ thể để DL-01 |
| 5.1 | Hai cookie phiên, httpOnly, Secure ở production | ✅ | `apps/web/lib/cookies.ts` (`gieochu_access` Path `/`, `gieochu_refresh` Path `/api/auth`). "Chỉ gửi qua kết nối bảo mật" đúng ở production (`secure: NODE_ENV === "production"`) |
| 5.1 | Mặc định session cookie; idle + absolute; cảnh báo trước khi tự đăng xuất | ✅ | ADR-053; `SYSTEM_SETTINGS_BOUNDS.sessionIdleMinutes/sessionAbsoluteHours/sessionWarningMinutes` (`packages/core/src/settings/system-settings.ts`). Số phút/giờ **cấu hình được** → không ghi số trong nội dung |
| 5.1 | "Ghi nhớ" tối đa không quá 30 ngày | ✅ | `rememberMeDays` max = 30 (mặc định 30) — trần cứng trong code |
| 5.1 | Đăng xuất từng thiết bị / mọi thiết bị | ✅ | `/account/security` + `apps/web/lib/account-sessions.ts` (ADR-053 mục 4) |
| 5.2 | Lưu trạng thái giao diện trong trình duyệt, không chứa thông tin đăng nhập | ✅ | `localStorage` chỉ ở `apps/web/app/admin/_ui/sidebar-nav.tsx`; `sessionStorage` cờ chống lặp ở `login-form.tsx`; token không bao giờ ở `localStorage` (CLAUDE.md §7.1) |
| 5.3 | Không analytics/quảng cáo | ✅ code / ❓ hạ tầng | grep không thấy gtag/GTM/Plausible/PostHog/Vercel Analytics/Clarity/fbq; CSP `proxy.ts` chỉ cho script `'self'` + nonce, `img-src` thêm `res.cloudinary.com`, `connect-src` thêm `api.cloudinary.com`. Font Google được Next tự host lúc build (`next/font/google`) — trình duyệt không gọi Google. Cookie CDN/hosting ❓ (DL-05) |
| 5.3 | "Sẽ cập nhật chính sách trước khi áp dụng" | — cam kết | Cần chủ dự án đồng ý giữ câu này (câu hỏi Q-11 trong kế hoạch) |
| 6 | Tệp private, link tải ngắn hạn chỉ cho người có quyền | ✅ | CLAUDE.md §7.6; `presignDownloadTtlSeconds` max 600 (kẹp lại ở `packages/storage`) |
| 6 | Khoá sau nhiều lần sai mật khẩu → phải đặt lại | ✅ | `User.failedLoginAttempts` đạt 5 → `passwordResetRequired` (comment `schema.prisma`) — không ghi số trong nội dung |
| 6 | Đổi mật khẩu/email cần xác thực lại, thu hồi phiên, email báo | 🟡 | ADR-041 C.2 + bổ sung lần 3 (đổi email thu hồi **mọi** phiên kể cả hiện tại). Long chưa đọc lại code `/account` lần này |
| 6 | Ảnh xem được qua đường dẫn | ✅ | `avatarUrlFromKey` dựng `https://res.cloudinary.com/<cloud>/image/upload/...` (`apps/web/lib/account-profile.ts`) — URL công khai, không ký |
| 6 | **Không** nói "quét virus" | ✅ | `apps/web/lib/file-scan.ts`: chỉ kiểm định dạng (magic bytes); ClamAV chưa có client → mọi tệp đúng định dạng được đánh dấu CLEAN |
| 7 | Audit 12 tháng; IP báo cáo 12 tháng; phiên 90 ngày | ✅ | `apps/web/app/api/cron/daily/route.ts` (`audit.purge`, `abuse_report.ip_purge`, `refresh_tokens.purge` — `purgeStaleRefreshTokens`: `expiresAt` hoặc `revokedAt` < now − 90 ngày). ❓ Cron chỉ chạy khi có lịch gọi (Vercel Cron; VPS chưa có crontab — ADR-049, bổ sung ADR-053 lần 2) |
| 7 | Nhật ký tải chưa có thời hạn | ✅ | Không có bước dọn `download_events` trong cron → mã mới DL-09 |
| 8 | Khoá tài khoản: chặn đăng nhập, thu hồi phiên, giữ dữ liệu; không xoá user | ✅ | `decideLockUser` (`packages/core/src/admin/user-lock.ts`, `revokeSessions: true`); `UserStatus.LOCKED`; refresh kiểm `user.status` (ADR-053); bổ sung ADR-050 (a) không xoá user |
| 8 | Chưa có tự xoá tài khoản | ✅ | Checklist ND-07, kế hoạch đợt 1 L10 |
| 9 | Tự sửa hồ sơ, đổi email/mật khẩu, quản lý thiết bị | ✅ / 🟡 | ADR-041 C, ADR-053 mục 4 |

**Điểm cần Quốc lưu ý:**

1. Mục 8 nêu thật "chưa có chức năng tự xoá" và để placeholder cho cách gửi yêu cầu xoá. Quyết định nội bộ "không xoá user,
   chỉ khoá" (bổ sung ADR-050) có thể vướng quyền yêu cầu xoá dữ liệu của chủ thể dữ liệu — cần luật sư (ND-07, câu hỏi
   Q-9 trong kế hoạch).
2. Không viết câu "chúng tôi không bán dữ liệu cá nhân" vì đây là cam kết kinh doanh chưa được chủ dự án xác nhận (Q-12).
3. Mục 4.2 / DL-08: người bán nhận họ tên + email người mua — cần luật sư xác định vai trò của người bán.

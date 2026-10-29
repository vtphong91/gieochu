# Tổng quan chức năng đã triển khai trong Gieo Chữ

> Ngày rà soát: 2026-10-30  
> Phạm vi: mã nguồn hiện có trong `apps/web` và các package dùng chung. Tài liệu này ghi nhận những gì có thể đối chiếu trong code; sự hiện diện của code không đồng nghĩa chức năng đã được triển khai hoặc kiểm thử trên môi trường production.

## 1. Giới thiệu

Gieo Chữ là nền tảng SaaS đa gian hàng để người bán tạo cửa hàng, đăng bán tài liệu số và xử lý đơn; khách hàng có thể tìm, mua và tải tài liệu. Hệ thống có ba khu vực chính: website công khai, **Studio** cho người bán và **System Center** cho quản trị viên.

Repo tổ chức theo pnpm workspace/Turborepo. Ứng dụng web dùng Next.js App Router và TypeScript; nghiệp vụ dùng chung được chia thành các package như `auth`, `core`, `db`, `payments`, `storage`, `email`, `jobs`, `config`.

## 2. Chức năng theo vai trò

### Khách hàng và khách truy cập

- Xem trang chủ, Cửa hàng, danh sách và chi tiết tài liệu, trang gian hàng, bài viết gian hàng, trang giá và nội dung pháp lý.
- Tìm tài liệu, lọc theo danh mục và xem nội dung/giá của tài liệu.
- Tạo đơn mua tài liệu, áp mã giảm giá, thực hiện các hướng dẫn thanh toán mà gian hàng bật. Có xử lý chuyển khoản QR thủ công, SePay và MoMo thủ công trong mã nguồn.
- Xem đơn hàng, thư viện tài liệu đã mua và tải lại khi còn quyền; hệ thống cấp link tải có thời hạn và quản lý số lượt tải.
- Gửi đánh giá sau mua, gửi báo cáo vi phạm và liên hệ gian hàng.
- Đăng ký/đăng nhập, xác minh email, khôi phục mật khẩu; quản lý hồ sơ, bảo mật và phiên đăng nhập.
- Tài khoản khách tạo trong luồng mua không cần đăng ký trước đã có code. Luồng này cùng các thay đổi checkout ADR-061/062 cần được xem là đang thử nghiệm cho đến khi kiểm chứng với DB, email và phương thức thanh toán thật.

### Người bán — Studio

- Mở gian hàng, chọn địa chỉ, quản lý thông tin thương hiệu và cấu hình phương thức thanh toán.
- Xem dashboard doanh thu/đơn hàng theo khoảng thời gian.
- Tạo, sửa, xem trước, xuất bản, lưu trữ tài liệu; quản lý mô tả, ảnh, danh mục, thẻ, giá/giá khuyến mãi và nguồn giao tài liệu (tệp tải lên hoặc liên kết ngoài).
- Tải tệp theo luồng upload nhiều phần; quản lý đường dẫn chia sẻ riêng, có thể đặt mật khẩu, giới hạn sử dụng và thu hồi.
- Quản lý đơn: lọc/tìm, xem chi tiết và lịch sử; xác nhận chuyển khoản thủ công, huỷ/đánh dấu hoàn tiền, ghi chú nội bộ và điều chỉnh lượt tải. Có trang giao dịch cần xử lý.
- Xem danh sách khách hàng, ghi chú, nhận và xử lý tin nhắn liên hệ.
- Quản lý bài viết gian hàng và đánh giá; người bán có thể phản hồi hoặc ẩn đánh giá.
- Tạo mã giảm giá; xem hoạt động gian hàng; xem và quản lý gói dịch vụ, hoá đơn/yêu cầu liên quan.
- Tuỳ chỉnh các phần nội dung trên trang bán hàng và xem trang công khai của gian hàng.

### Quản trị viên — System Center

- Quản lý tài khoản, vai trò/quyền, gian hàng, danh mục tài liệu, gói dịch vụ và thuê bao.
- Quản lý hoá đơn gói, giao dịch cổng thanh toán và yêu cầu hoàn tiền gói.
- Quản lý nội dung CMS: trang chủ, menu, trang Cửa hàng, trang Bảng giá, trang tuỳ chỉnh và văn bản pháp lý có phiên bản.
- Tiếp nhận, xem xét và xử lý báo cáo vi phạm; có cơ chế khoá kiểm duyệt nội dung/gian hàng.
- Xem số liệu tổng hợp, nhật ký hoạt động và cấu hình thương hiệu, cài đặt chung, SMTP, lưu trữ và Cloudinary.
- Theo thiết kế hiện tại, quyền quản trị xem thống kê tổng hợp, không có màn hình xem chi tiết đơn/khách của từng gian hàng.

## 3. Năng lực nền tảng

- **Tách biệt dữ liệu theo gian hàng:** lớp DB có hỗ trợ Row-Level Security và các hàm scope tenant/customer/public/system.
- **Thanh toán:** package `payments` có adapter/registry cho VietQR, SePay, MoMo và thanh toán thủ công; webhook nền tảng và webhook gian hàng có route riêng.
- **Lưu trữ và tải tệp:** package `storage` có thao tác S3-compatible, presigned URL, kiểm tra định dạng, object key và đọc/stream tệp. Có route upload, tải xuống và cổng storage nội bộ.
- **Email và công việc nền:** package email chứa các mẫu cho xác minh tài khoản, đơn hàng, thanh toán, hoàn tiền, liên hệ và báo cáo; package jobs cùng route cron hỗ trợ xử lý tác vụ nền.
- **Bảo vệ truy cập:** phân quyền theo vai trò, cookie/session, rate limit, xác minh webhook, mã hoá secret và link tải có thời hạn được triển khai ở các lớp nghiệp vụ tương ứng.
- **Xem trước file:** có route xem trước nội dung trích từ file tài liệu ở một số định dạng được hỗ trợ; endpoint có kiểm tra trạng thái gian hàng/tài liệu/tệp và giới hạn yêu cầu. ADR-063 ghi nhận migration cần được áp dụng và kiểm thử môi trường trước khi phát hành.

## 4. Điểm vào mã nguồn

| Khu vực | Vị trí tiêu biểu |
|---|---|
| Website công khai, cửa hàng, gian hàng | `apps/web/app/page.tsx`, `apps/web/app/cua-hang/`, `apps/web/app/[tenantSlug]/` |
| Xác thực và tài khoản | `apps/web/app/(auth)/`, `apps/web/app/account/`, `apps/web/app/api/auth/`, `packages/auth/src/` |
| Checkout, đơn hàng, thư viện | `apps/web/app/[tenantSlug]/checkout/`, `apps/web/app/account/orders/`, `apps/web/app/account/library/`, `apps/web/lib/order.ts`, `apps/web/lib/download.ts` |
| Studio | `apps/web/app/studio/`, `apps/web/lib/tenant-dashboard.ts`, `apps/web/lib/tenant-stats.ts` |
| Quản trị | `apps/web/app/admin/`, `apps/web/lib/admin-*.ts`, `apps/web/lib/moderation.ts` |
| Nghiệp vụ dùng chung | `packages/core/src/`, `packages/payments/src/`, `packages/storage/src/`, `packages/email/src/`, `packages/jobs/src/` |
| Schema và RLS | `packages/db/prisma/`, `packages/db/src/rls.ts` |

## 5. Trạng thái và giới hạn khi diễn giải

- Đây là kiểm kê chức năng trong mã nguồn, không phải xác nhận toàn bộ cấu hình production đang hoạt động. Tích hợp cổng thanh toán, SMTP, Cloudinary, R2/MinIO cần cấu hình và kiểm tra theo môi trường.
- Một số thay đổi checkout/khách vãng lai (ADR-061/062) được tài liệu kỹ thuật đánh dấu đang thử nghiệm, chưa xác minh với người dùng và cổng thanh toán thực.
- ADR-063 có code xem trước file; trạng thái áp migration/kiểm thử DB phải được xác nhận riêng trước khi bật trên môi trường dùng thật.
- Các chức năng blog/feed ở cấp hệ thống, bình luận, thả tim và theo dõi không được tính vào danh sách đã triển khai ở đây nếu chưa có điểm vào tương ứng trong ứng dụng hiện tại.
- Tài liệu tổng quan nghiệp vụ chi tiết hơn: [tong-quan-he-thong-2026-10-27.md](tong-quan-he-thong-2026-10-27.md). Tiến độ module và quyết định kỹ thuật: [PLAN.md](PLAN.md), [DECISIONS.md](DECISIONS.md), [ARCHITECTURE.md](ARCHITECTURE.md).

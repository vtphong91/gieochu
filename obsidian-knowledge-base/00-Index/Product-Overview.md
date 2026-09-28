---
tags:
  - meta
  - overview
date: 2026-09-26
---

> Giới thiệu sản phẩm ở góc nhìn nghiệp vụ (không đi vào chi tiết kỹ thuật). Nguồn: `docs/GIEOCHU_PROMPT_MVP_PHASE1.md`, `docs/PLAN.md`. Xem [[MOC-Home]] cho bản đồ tài liệu kỹ thuật đầy đủ.

# GIEO CHỮ

## Giới thiệu tổng quan

Gieo Chữ là nền tảng SaaS đa tenant (multi-tenant) giúp giáo viên, coach và chuyên gia tạo một **cửa hàng bán
tài liệu số riêng, có thương hiệu riêng** — mà không cần tự dựng website hay tự xử lý thanh toán/lưu trữ
file. Mỗi giáo viên đăng ký một "tenant" (gian hàng) trên nền tảng, có slug/URL riêng
(`/{tenantSlug}`), tự đăng bán ebook, slide bài giảng, đề thi, template, và các loại tài liệu số khác cho
học viên/khách hàng của mình.

Đây là một **chợ tài liệu số** (document marketplace theo mô hình nhiều gian hàng), không phải nền tảng giao
đồ ăn, không phải app giao vận, không có bản đồ hay chat — phạm vi MVP giai đoạn 1 tập trung vào: bán tài
liệu số, thanh toán, tải file, và quản lý gian hàng.

## Hệ thống phục vụ những ai

- **System Admin** — quản trị viên nền tảng. Theo dõi tổng quan các tenant, quản lý gói (plan) và bảng giá,
  quản lý nội dung CMS công khai (trang giới thiệu, bảng giá), cấu hình cổng thanh toán/lưu trữ ở cấp hệ
  thống. **Không có quyền xem chi tiết đơn hàng hoặc thông tin khách hàng của từng tenant** — đây là ranh giới
  bảo mật cố ý, chỉ đọc số liệu tổng hợp (`tenant_daily_stats`).
- **Tenant owner** (giáo viên/coach, chủ gian hàng) — quản lý gian hàng riêng qua khu vực "Studio": tạo/sửa
  sản phẩm, tải file lên bán, thiết lập cổng thanh toán riêng (SePay/MoMo/chuyển khoản QR thủ công), tạo mã
  giảm giá, xem đơn hàng và khách hàng của chính mình, theo dõi gói cước đang dùng.
- **Customer** (khách hàng mua tài liệu) — có **một tài khoản duy nhất dùng chung cho toàn nền tảng**, có thể
  mua tài liệu từ nhiều gian hàng (tenant) khác nhau, xem lại lịch sử mua hàng và tải tài liệu đã mua trong
  một thư viện cá nhân duy nhất.

## Các phân hệ chính (bám theo `docs/PLAN.md`)

### 1. Xác thực và định danh (Auth/Identity)

Đăng ký, đăng nhập, xác minh email, quên/đổi mật khẩu, hồ sơ cá nhân. Một tài khoản người dùng có thể vừa là
chủ tenant vừa là khách hàng mua ở tenant khác.

### 2. Tenant Workspace và Storefront

Mỗi giáo viên tạo một "tenant" — không gian làm việc riêng (Studio) để quản lý gian hàng, cùng một trang bán
hàng công khai (storefront) hiển thị cho khách vãng lai theo slug riêng.

### 3. System Admin Console

Bảng điều khiển cấp hệ thống: quản lý người dùng, tenant, gói cước, nội dung CMS marketing, cấu hình lưu trữ
file và cổng thanh toán ở cấp nền tảng.

### 4. Billing, Subscription & Entitlements

Mô hình thu phí **Hybrid Monetization** ("Free Forever + Paid Subscription"): mọi tenant mới vào thẳng một
gói **Free thật, bán được, không bao giờ hết hạn**; trả phí chỉ để mở rộng giới hạn/tính năng (số sản phẩm,
dung lượng lưu trữ...). Đây là quyết định thay đổi so với mô hình "trial rồi hết hạn" ban đầu — chi tiết ở
`docs/PLAN.md` mục "M3 v2".

### 5. Cấu hình thanh toán Tenant

Mỗi tenant tự cấu hình cổng thanh toán riêng (SePay, MoMo, hoặc chuyển khoản QR thủ công theo chuẩn VietQR)
để nhận tiền trực tiếp từ khách hàng của mình — tách biệt hoàn toàn khỏi hệ thống thanh toán cấp Platform
(nơi tenant trả phí subscription cho nền tảng).

### 6. Sản phẩm, Giá và Khuyến mãi

Tenant đăng bán tài liệu số (có file đính kèm, ảnh bìa, mô tả, giá), thiết lập giá khuyến mãi và mã giảm giá
(coupon) áp dụng theo sản phẩm.

### 7. Checkout và Đơn hàng

Khách hàng chọn mua, nhập mã giảm giá, thanh toán qua QR/cổng thanh toán của tenant, theo dõi trạng thái đơn
hàng. Số tiền luôn được tính lại ở server, không tin dữ liệu từ client.

### 8. Thư viện, Tải xuống và Share link

Sau khi mua, tài liệu xuất hiện trong thư viện cá nhân của khách hàng, tải qua URL presigned có hạn dùng
ngắn. Tenant cũng có thể tạo link chia sẻ riêng (có thể đặt mật khẩu, giới hạn số lượt tải) cho một tài liệu
cụ thể mà không cần khách phải có tài khoản.

## Những gì KHÔNG thuộc phạm vi MVP giai đoạn 1

Theo `docs/BACKLOG.md`: tên miền riêng cho tenant, PDF watermark/stamping, nhân viên tenant có phân quyền chi
tiết (staff), bundle/flash sale, affiliate, email marketing, chat, hoàn tiền tự động qua cổng thanh toán, app
mobile, tìm kiếm toàn nền tảng, hoá đơn điện tử. Đây là các hạng mục **cố ý chưa làm**, không phải thiếu sót.

## Phạm vi của tài liệu này

Tài liệu này chỉ giới thiệu tổng quan sản phẩm ở góc nhìn nghiệp vụ. Không đi vào chi tiết cấu trúc codebase,
schema dữ liệu, hay cơ chế bảo mật kỹ thuật — xem [[MOC-Home]] và `docs/ARCHITECTURE.md` cho phần đó.

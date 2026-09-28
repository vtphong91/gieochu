---
tags:
  - meta
  - adr
date: 2026-09-26
updated: 2026-09-28
---

# 🏛️ Architecture Decision Records (ADRs)

Thư mục này chứa một **bản trích lọc các Quyết định Kiến trúc mang tính ràng buộc nền tảng** của Gieo Chữ —
những quyết định mà một người mới tham gia dự án cần biết trước khi chạm vào code.

Đây là bản trích lọc — xem [`docs/DECISIONS.md`](../../docs/DECISIONS.md) ở gốc repo để có đầy đủ toàn bộ quyết
định kiến trúc (hiện có 30 ADR, ADR-001…ADR-030). Số thứ tự `ADR-0XX` trong các file ở thư mục này là số thứ tự **riêng của
thư mục KB**, đánh lại từ 1 cho phần trích lọc — mỗi file ghi rõ nó tương ứng ADR số mấy trong
`docs/DECISIONS.md`, để tra ngược lại nguồn gốc khi cần.

## Danh mục ADR:
- `[[ADR-001-Cuid2-Id-Strategy]]`: Mọi ID trong hệ thống dùng cuid2 (`@default(cuid(2))`), không dùng UUID. *(≙ ADR-001 trong docs/DECISIONS.md)*
- `[[ADR-002-Neon-Adapter-Db-Connection]]`: Kết nối DB qua `@prisma/adapter-neon`, tách `DATABASE_URL` (pooled, runtime) khỏi `DIRECT_URL` (CLI). *(≙ ADR-003)*
- `[[ADR-003-Postgres-App-Role-RLS]]`: Role Postgres riêng `gieochu_app` (không `BYPASSRLS`) để Row Level Security có hiệu lực thật, tách khỏi role owner Neon. *(≙ ADR-010)*
- `[[ADR-004-Csp-Nonce-Proxy]]`: CSP sinh động trong `proxy.ts` với nonce theo từng request, thay cho header tĩnh trong `next.config.ts`. *(≙ ADR-016)*
- `[[ADR-005-Storage-Config-System-Admin]]`: Cấu hình storage (R2 endpoint/bucket/access key) quản lý qua System Admin + mã hoá DB, không phải biến môi trường. *(≙ ADR-017)*
- `[[ADR-006-Download-Token-Rls-Customer-Branch]]`: `DownloadToken` là bảng L1 không RLS; thêm nhánh "customer" vào policy RLS của sản phẩm/file; mật khẩu share link dùng argon2 riêng trong `core`. *(≙ ADR-020)*
- `[[ADR-007-Hybrid-Monetization-Free-Forever]]`: Mô hình Hybrid Monetization — FREE là plan thật, bán được, không hết hạn; trả phí chỉ để mở rộng capacity/tính năng. *(≙ ADR-021)*
- `[[ADR-008-Rbac-Role-Permission]]`: Bảng `Role`/`Permission` (RBAC) là nguồn sự thật cho quyền truy cập module, giữ nguyên `SystemRole`/`TenantMemberRole` làm nhãn định danh. *(≙ ADR-022)*
- `[[ADR-009-Storefront-Cms-Contact-Inbox]]`: Storefront tenant quản lý bằng section CMS (nháp/xuất bản trên 2 cột Json của `tenants`), form liên hệ lưu hộp thư L2 `storefront_messages` với RLS tách policy theo lệnh (public chỉ INSERT). *(≙ ADR-023)*
- `[[ADR-010-Layout-Width-Container-Standard]]`: Chuẩn độ rộng layout — 3 utility `container-page` (1280px) / `container-prose` (768px) / `container-narrow` (448px) khai báo một lần trong `globals.css`. *(≙ ADR-024)*
- `[[ADR-011-Tenant-Owns-Storefront-Content-Only]]`: Tenant chỉ sở hữu nội dung storefront; header/footer (`SiteHeader`/`SiteFooter`) và trang con (chi tiết sản phẩm, checkout) là của hệ thống. Thay thế phần header/footer/menu tenant của ADR-009. *(≙ ADR-025)*
- `[[ADR-012-Product-Editor-Category-External-Links]]`: Editor Tạo/Sửa sản phẩm GĐ1 — sửa 2 lỗi bảo mật upload (khoá object theo tenant/sản phẩm, kiểm lại gói bằng dung lượng thật), danh mục bắt buộc khi xuất bản, giao tài liệu bằng file hoặc link ngoài (allowlist https), `canPublishProduct` + checklist, trần test 94/53. *(≙ ADR-026)*
- `[[ADR-013-Product-Summary-Cover-Preview-Visibility]]`: Trang Tạo đủ field — mô tả ngắn, ảnh bìa Cloudinary (`coverImageUrl`, fallback R2), trang Xem trước `noindex`, chế độ hiển thị Công khai/Riêng tư = `PUBLISHED`/`DRAFT`. *(≙ ADR-027; §4 đã được sửa đổi — trang Tạo tự tạo bản nháp khi thêm tệp đầu tiên)*
- `[[ADR-014-System-Cloudinary-Image-Quota]]`: Ảnh nội dung/ảnh bìa/ảnh storefront lưu trên Cloudinary hệ thống — chữ ký tenant ký `public_id` đầy đủ, giữ chỗ hạn mức 5MB lúc ký + đối soát qua Admin API, hạn mức ảnh theo gói (`Plan.imageStorageMb`, bảng L2 `tenant_media_assets`), tối ưu `f_auto,q_auto,c_limit,w_<N>`, sanitizer chỉ nhận cloud hệ thống, chữ ký dùng chung chỉ `SYSTEM_ADMIN`. *(≙ ADR-028)*
- `[[ADR-015-M10-Reviews-Posts-Rls-Split-Writes]]`: M10 GĐ1 — Đánh giá (M10a) + Bài viết tối giản (M10b) — cả hai đã triển khai; siết RLS 7 bảng L2 (`select_access` + `write_*` chỉ tenant/`system_job`), quy tắc không dùng `FOR ALL` khi có nhánh public/customer, bảng `reviews` + trigger giới hạn cột theo scope, cache điểm số nguyên dưới `system_job`; bảng `posts` (ghim 1 bài bằng partial unique index chỉ có trong SQL, trigger `posts_guard_product_tenant`/`posts_guard_columns`). *(≙ ADR-029, gồm 3 mục "Bổ sung")*
- `[[ADR-016-Short-Product-Url-No-Sticky-Publish-Card]]`: URL chuẩn trang tài liệu `/{tenantSlug}/{productSlug}` (URL cũ `/{tenantSlug}/products/{productSlug}` → 301 bằng Route Handler, giữ query), hàm dựng URL duy nhất `productPath`/`productUrl`, 23 slug dành riêng (`RESERVED_PRODUCT_SLUGS`); card xuất bản editor sản phẩm/bài viết không còn dính khi cuộn. *(≙ ADR-030, gồm "Bổ sung theo triển khai")*

*Quay lại: [[MOC-Home]] (../00-Index/MOC-Home.md)*

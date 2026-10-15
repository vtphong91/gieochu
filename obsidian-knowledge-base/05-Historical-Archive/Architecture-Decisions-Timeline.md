---
tags:
  - archive
  - gieochu
  - adr
  - history
date: 2026-09-26
updated: 2026-10-15
---

# Architecture Decisions Timeline — Gieo Chữ

Mục lục đầy đủ theo trình tự đánh số của **35 ADR thật** (ADR-001…ADR-035), nguồn duy nhất: [`docs/DECISIONS.md`](../../docs/DECISIONS.md).
Đây chỉ là "mục lục theo thời gian" (một dòng mỗi ADR) — không lặp lại toàn văn Bối cảnh/Quyết định/Lý do.

Xem [[01-Architecture-Decisions/README|01-Architecture-Decisions]] để có nội dung đầy đủ của các ADR quan
trọng nhất; trang này chỉ là mốc thời gian đầy đủ 29 quyết định.

| # | Tiêu đề | Tóm tắt một câu |
|---|---|---|
| ADR-001 | ID strategy: cuid2 | Dùng cuid2 qua `@id @default(cuid(2))` gốc của Prisma cho mọi model, không dùng UUID. |
| ADR-002 | Generator Prisma: `prisma-client` | Dùng generator mới (`output` tự chọn), không dùng `prisma-client-js` đã deprecated từ Prisma 7. |
| ADR-003 | Kết nối DB: `@prisma/adapter-neon`, `prisma.config.ts` dùng `DIRECT_URL` | CLI/migrate dùng `DIRECT_URL`, runtime app dùng `DATABASE_URL` pooled qua adapter Neon. |
| ADR-004 | Postgres local (`profile: local-db`) là tuỳ chọn phụ | Khuyến nghị Neon branch miễn phí cho dev/test vì `adapter-neon` cần giao thức serverless của Neon, không phải TCP Postgres thường. |
| ADR-005 | TypeScript pin ở 5.9.x | Chưa dùng TypeScript 7 (tsgo) vì toolchain (`ts-jest`, `typescript-eslint`...) chưa chắc tương thích đầy đủ. |
| ADR-006 | Logger đặt trong `packages/core` | Không tạo package riêng cho logger `pino` có redact — đặt cùng `errors.ts`. |
| ADR-007 | `pg-boss` kết nối qua `DIRECT_URL`, không qua pooler | Tránh lỗi do PgBouncer transaction-mode không đảm bảo hành vi cấp phiên `pg-boss` cần. |
| ADR-008 | `UserProfile` tạo một phần ngay khi đăng ký | `fullName`/`consentAt` bắt buộc lúc đăng ký; `phone`/`occupation`/`province` nullable, điền sau ở bước hoàn thiện hồ sơ. |
| ADR-009 | Integration test (Vitest) dùng chung Neon DB với dev | Chưa có `TEST_DATABASE_URL` riêng; mỗi test tự sinh email duy nhất và tự dọn dữ liệu ở `afterAll`. |
| ADR-010 | Role Postgres riêng cho app (`gieochu_app`) | Tách khỏi `neondb_owner` (có `BYPASSRLS`) để RLS có hiệu lực thật; CLI/migrate dùng `PRISMA_MIGRATE_URL` riêng. |
| ADR-011 | Tạo `platform_payment_configs` sớm ở M7 | Bảng tối thiểu, chưa UI/business logic, để test webhook cross-scope (platform vs tenant) đúng nghĩa đen. |
| ADR-012 | Xác minh VietQR/CRC16 bằng test vector tự dựng | Phát hiện mẫu payload VietQR bên thứ 3 có lỗi lệch 1 ký tự — không dùng nguyên trạng, tự xác minh từ thuật toán CRC chuẩn quốc tế. |
| ADR-013 | Dedupe hoá đơn PENDING + tự tắt `PlatformPaymentConfig` khi đổi tài khoản/secret | Bổ sung 2 điểm đặc tả M3 không nói rõ: gia hạn nhiều lần tái sử dụng hoá đơn `PENDING` còn hạn thay vì tạo mới; đổi số tài khoản/BIN/partnerCode hoặc secret thì tự đặt `isEnabled=false`, xoá `lastVerifiedAt`, admin phải xác nhận lại — tham khảo một báo cáo kỹ thuật module payment do người dùng cung cấp (chỉ phạm vi M3). |
| ADR-014 | M5 chia làm 2 phần | Metadata/CRUD làm trước (không cần storage thật), upload/storage thật (Cloudflare R2) làm sau — vì máy code không có Docker. |
| ADR-015 | `Product.downloadLimit = 0` nghĩa là không giới hạn | Quy ước diễn giải cho M9 dùng khi đếm lượt tải, không cần thêm cột boolean riêng. |
| ADR-016 | CSP sinh động (nonce) trong `proxy.ts` thay cho header tĩnh | Sửa lỗi CSP tĩnh chặn hydrate React (`script-src 'self'` không nonce) — lộ mật khẩu đăng nhập lên URL. |
| ADR-017 | Cấu hình storage (endpoint/bucket/access key R2) quản lý qua System Admin + DB mã hoá | Không dùng biến môi trường tĩnh; mã hoá bằng `STORAGE_ENCRYPTION_KEY` riêng, không dùng chung `PAYMENT_ENCRYPTION_KEY`. |
| ADR-018 | `file.scan` không có ClamAV thật | Luôn đánh dấu `CLEAN` sau khi qua kiểm tra magic-bytes-khớp-đuôi; ghi log cảnh báo nếu có set `CLAMAV_HOST` nhưng chưa có client thật. |
| ADR-019 | Webhook tenant xử lý qua job `payment.process`; `order.sweep` chạy mỗi 5 phút | Đúng đặc tả §7 mục 4 (trả 2xx nhanh, xử lý nặng đẩy job) — khác với webhook platform (M3) xử lý đồng bộ, một khoảng lệch đã biết. |
| ADR-020 | M9: `DownloadToken` L1 không RLS; thêm nhánh "customer" cho RLS `products`/`product_files`; argon2 riêng cho mật khẩu share link | 3 quyết định giữ đúng ranh giới layer (L1 vs L2 RLS, chiều phụ thuộc package `core` không phụ thuộc `auth`). |
| ADR-021 | Hybrid Monetization: Free Forever thay cho Subscription-first | FREE là plan thật, không hết hạn; trả phí chỉ mở rộng capacity/tính năng — thu gọn kiến trúc, không thêm `billing_accounts`/`usage_meters`/`billing_events`. |
| ADR-022 | Bảng `Role`/`Permission` (RBAC) là nguồn sự thật cho quyền truy cập module | Thêm 3 bảng L1 mới, giữ nguyên `SystemRole`/`TenantMemberRole` làm nhãn định danh nhẹ — không đổi 54 call site `requireRole`/`requireTenantMember` hiện có. |
| ADR-023 | Storefront tenant quản lý bằng section CMS, form liên hệ lưu hộp thư L2 | 5 loại section (hero/services/products/testimonials/contact) lưu nháp/live trên 2 cột Json của `tenants`; bảng L2 `storefront_messages` có RLS public chỉ INSERT, tenant SELECT/UPDATE/DELETE, không nhánh admin (2026-09-26). |
| ADR-024 | Chuẩn độ rộng layout: nội dung trang public tối đa 1280px | 3 utility `container-page`/`container-prose`/`container-narrow` khai báo một lần bằng `@utility` trong `globals.css`; app shell có sidebar không áp ở mức trang (2026-09-26). |
| ADR-025 | Tenant chỉ sở hữu nội dung storefront; header/footer và các trang con là của hệ thống | `SiteHeader`/`SiteFooter` dùng chung mọi trang public; storefront không còn header/footer/menu tenant, mạng xã hội vào khối CTA Liên hệ; trang sản phẩm/checkout là trang hệ thống — thay thế phần header/footer tenant của ADR-023 (2026-09-26). |
| ADR-026 | Trang Tạo/Sửa sản phẩm GĐ1: danh mục bắt buộc khi xuất bản, giao tài liệu bằng file hoặc link, nâng mốc test | Sửa 2 lỗi bảo mật upload (khoá object đúng tenant/sản phẩm, kiểm lại gói bằng dung lượng thật); `Product.categoryId`; link ngoài lưu chung `product_files` (`sourceKind`, allowlist https); `canPublishProduct` cần danh mục + ảnh bìa + ≥1 nguồn giao hàng; trần test 94/53 (2026-09-26). |
| ADR-027 | Bổ sung trang Tạo sản phẩm: mô tả ngắn, ảnh bìa qua Cloudinary, Xem trước, chế độ hiển thị = trạng thái | `Product.summary` (≤300), `Product.coverImageUrl` Cloudinary (fallback R2), trang Xem trước Studio `noindex`, Công khai/Riêng tư = `PUBLISHED`/`DRAFT`, không nâng trần test; §4 sau đó được sửa đổi — trang Tạo tự tạo bản nháp khi thêm tệp đầu tiên (2026-09-27). |
| ADR-028 | Ảnh nội dung lưu trên Cloudinary hệ thống, có tối ưu tự động và hạn mức theo gói; siết chữ ký upload | Cloudinary hệ thống cho mọi tenant (BYO để GĐ2); chữ ký dùng chung chỉ `SYSTEM_ADMIN`; chữ ký tenant ký `public_id` đầy đủ + giữ chỗ 5MB, đối soát qua Admin API; `Plan.imageStorageMb` (FREE 100MB → BUSINESS 5GB) + bảng L2 `tenant_media_assets`; `f_auto,q_auto,c_limit,w_<N>`; sanitizer chỉ nhận cloud hệ thống (2026-09-27). |
| ADR-029 | M10 giai đoạn 1: Đánh giá (M10a) + Bài viết tối giản (M10b); siết RLS `products`/`product_files` | Phạm vi M10a → M10b, M10c sang BACKLOG; đánh giá chỉ cho khách có đơn hoàn tất + entitlement chưa thu hồi, 1 đánh giá/khách/sản phẩm, cache điểm số nguyên dưới `system_job`; section "Đánh giá" thật, section cũ thành "Cảm nhận". Bổ sung theo triển khai: siết RLS ghi **7 bảng** (`select_access` + `write_*` chỉ tenant/`system_job`), quy tắc không `FOR ALL` khi có nhánh public/customer; `reviews` gắn `orderItemId`, trigger `reviews_guard_columns`. Chưa thêm test. |
| ADR-030 | URL tài liệu rút gọn `/{tenantSlug}/{productSlug}`; bỏ sticky card xuất bản | URL chuẩn `/{tenantSlug}/{productSlug}`, URL cũ `/{tenantSlug}/products/{productSlug}` → 301; hàm dựng URL duy nhất `productPath`; 23 slug dành riêng ở `packages/core`; card xuất bản editor sản phẩm/bài viết không dính khi cuộn (thay phần "card xuất bản dính" của ADR-027). Bổ sung theo triển khai: redirect bằng Route Handler (Next trả 308 nếu dùng `permanentRedirect`/`redirects`), `/{tenantSlug}/products` → 404, canonical tuyệt đối, slug tự nhập trùng → `INVALID_SLUG`, tự sinh trùng → hậu tố; quét slug trùng trên DB prod trước deploy. |
| ADR-031 | Deploy Vercel: build không cần DB/env; `PRISMA_MIGRATE_URL` không bao giờ ở runtime | `apps/web/vercel.json` (`buildCommand: "next build"`, Root Directory `apps/web`), Prisma client sinh sẵn được commit; root `app/layout.tsx` `force-dynamic` (build không cần env, nonce CSP gắn mọi trang); `PRISMA_MIGRATE_URL` xoá khỏi schema env runtime, chỉ CLI `migrate`/`studio` + `setup-app-role` đọc, `db seed` dùng `DATABASE_URL`; migration prod chạy ngoài Vercel; worker pg-boss cần host riêng (chưa có). |
| ADR-032 | Cấu hình hệ thống và thương hiệu lấy từ System Center (DB); env chỉ còn hạ tầng + secret | Env runtime còn 8 biến (`APP_URL`, `DATABASE_URL`, `DIRECT_URL`, 3 biến JWT, 2 khoá mã hoá); thương hiệu chỉ từ `SystemBranding` + mặc định một chỗ `@gieochu/config/brand`; 11 khoá cấu hình (TTL, ân hạn, đơn/hoá đơn chờ, lượt tải mặc định) ở bảng L1 `system_settings` + `/admin/settings/general`, có giới hạn, chỉ áp cho thao tác mới; múi giờ hiển thị là hằng. Sự cố 2026-10-15: migration drop `platformName` chạy trên DB dev = DB production làm production 500, khôi phục bằng `ADD COLUMN IF NOT EXISTS`, drop lại chỉ sau deploy (expand → contract). |
| ADR-033 | Trang chủ hệ thống dùng dữ liệu thật (số liệu, danh mục, giáo viên, tài liệu nổi bật, số đã bán) | Cột cache `products.soldCount` (đơn FULFILLED, trừ entitlement đã thu hồi), trang chủ không đọc `orders`; số liệu nổi bật thật, ô = 0 ẩn; chip từ danh mục có tài liệu Công khai; giáo viên/tài liệu nổi bật = ghim + tự bù theo điểm đánh giá rồi mới nhất; giữ nhập tay Hero/Vì sao chọn/Mở gian hàng/Cảm nhận người dùng/CTA. Bổ sung theo triển khai: "Công khai" = PUBLISHED + tenant ACTIVE, tính lại `soldCount` sau commit ở mọi đường đổi trạng thái đơn/entitlement, chưa có job đối soát. |
| ADR-034 | Một database duy nhất cho dev, Preview và production | Chủ dự án không tách DB sau sự cố 2026-10-15: máy dev, Vercel Preview và Production dùng cùng database Neon; migration chỉ Quốc duyệt/chạy theo expand → contract, không `prisma migrate dev/reset`, không `pnpm db:seed`, integration test/script ghi dữ liệu thật phải dọn, Preview chỉ xem giao diện, dữ liệu demo trên production dọn bằng `demo:clean` trước khi mở cho người dùng thật. Thay khuyến nghị "tách DB dev bằng Neon branch". |
| ADR-035 | Trang "Cửa hàng" (marketplace) `/cua-hang`: CMS trước, trang dữ liệu sau | GĐ1 = CMS Cửa hàng trong System Center (`CmsPage` slug `shop`, `blocks`/`blocksDraft`, không DDL; 9 section theo thứ tự Hero → Danh mục → Nổi bật → Theo từng danh mục → Bán chạy → Đánh giá cao → Gian hàng nổi bật → Mới → CTA); GĐ2 = `/cua-hang` + `/cua-hang/tai-lieu` đọc CMS + dữ liệu thật qua `withPublic`, tìm không dấu bằng `unaccent` (migration expand). Bổ sung: ngưỡng điểm lưu ×10, section thiếu thêm ở trạng thái ẩn, `SYSTEM_CMS_SLUGS = ["home","shop"]` chặn form CMS chung và `/p/[slug]`. Chủ dự án chốt: kệ Bán chạy theo tổng đã bán mọi thời gian, số bán 30 ngày chỉ để xếp hạng gian hàng, không hiển thị (2026-10-15). |

*Quay lại: [[05-Historical-Archive/README|05-Historical-Archive]] · [[MOC-Home]] (../00-Index/MOC-Home.md)*

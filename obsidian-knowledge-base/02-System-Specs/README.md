---
tags:
  - meta
  - spec
date: 2026-09-26
updated: 2026-10-18
---

# 📐 System Specifications (Living Specs)

Thư mục này chứa các **Bản đặc tả sống của hệ thống** (Living Specs) cho **Gieo Chữ** — tài liệu mô tả chính
xác cách hệ thống đang vận hành thực tế trên mã nguồn và cơ sở dữ liệu, không phải kế hoạch phát triển. Toàn
bộ nội dung được viết lại từ nguồn thật: `CLAUDE.md`, `docs/ARCHITECTURE.md`, `docs/PLAN.md`,
`docs/DECISIONS.md`, `docs/GIEOCHU_TENANT_MODULE_STRUCTURE_V1.0.md` và `packages/db/prisma/schema.prisma`.

## Danh mục Đặc tả:

- `[[Architecture-Overview]]`: Mô hình 3 tầng dữ liệu L1 System / L2 Tenant / L3 Customer, cơ chế Row-Level
  Security 4-scope (`withTenant`/`withCustomer`/`withPublic`/`withSystemJob`), cấu trúc Next.js App Router.
- `[[Order-State-Machine]]`: Vòng đời trạng thái đơn hàng mua tài liệu số
  (`PENDING → PAID → FULFILLED`, `EXPIRED`, `CANCELED`, `REFUNDED`) và hàm `markOrderPaid()` duy nhất.
- `[[Tenant-RBAC-And-Permissions]]`: Ba lớp tài khoản độc lập (System/Tenant/Customer), bảng
  `Role`/`Permission`/`RolePermission` (ADR-022), cơ chế guard 3 tầng không có middleware tập trung.
- `[[Payment-And-Billing]]`: Hai hệ thống thanh toán tách biệt (Platform billing vs Tenant billing) dùng chung
  `packages/payments` qua `PaymentScope`, mô hình Free Forever + Paid Subscription (ADR-021), webhook
  idempotent với `timingSafeEqual`; §5A hạn mức `0`/`-1` + cờ tính năng + gói năm, §5B hoàn tiền gói 7 ngày (bảng L1
  `subscription_refund_requests`, ADR-041 B).
- `[[File-Storage-And-Downloads-Specs]]`: Lưu trữ file sản phẩm qua S3-compatible (Cloudflare R2), presigned
  URL ≤ 10 phút, `DownloadToken`/`ShareLink`, mật khẩu share link bằng argon2 riêng trong `packages/core`; §7 ảnh
  tenant trên Cloudinary hệ thống — chữ ký `public_id`, giữ chỗ + đối soát hạn mức, `cloudinaryDeliveryUrl`,
  sanitizer (ADR-028).
- `[[User-Management-System-Center-Specs]]`: Console quản trị `/admin/**`, khoá/mở khoá tài khoản, cơ chế
  refresh-token rotation + reuse detection, ranh giới "System Admin không đọc order/customer của tenant".
- `[[Storefront-CMS-Specs]]`: Storefront tenant theo section CMS (7 loại section — thêm `reviews` và `posts` ở ADR-029, nháp/xuất bản/khôi phục, nội
  dung demo), form liên hệ + hộp thư `storefront_messages` với RLS tách policy theo lệnh, rate limit, upload ảnh
  Cloudinary theo tenant (ADR-023).
- `[[Product-Editor-And-Publishing-Specs]]`: Sản phẩm sau ADR-026/027 — sửa bảo mật upload (khoá object theo
  tenant/sản phẩm, kiểm lại gói bằng dung lượng thật), danh mục bắt buộc khi xuất bản, link tài liệu ngoài theo
  allowlist, `canPublishProduct` + checklist, mô tả ngắn, ảnh bìa Cloudinary, chế độ hiển thị Công khai/Riêng tư,
  bản nháp tự động khi thêm tệp đầu tiên ở trang Tạo, ảnh mô tả upload (ADR-028), trang Xem trước, URL tài liệu
  `/{tenantSlug}/{productSlug}` + redirect 301 URL cũ + 23 slug dành riêng (ADR-030, §7A)
  ([Product-Editor-And-Publishing-Specs.md](./Product-Editor-And-Publishing-Specs.md)).
- `[[Posts-Specs]]`: Bài viết tối giản M10b (ADR-029) — DRAFT/PUBLISHED/HIDDEN (HIDDEN chỉ hệ thống đặt), tiêu đề tuỳ chọn,
  nội dung Tiptap sanitize theo cloud hệ thống, ≤6 ảnh tính hạn mức, gắn 1 tài liệu cùng tenant, ghim 1 bài/tenant (partial
  unique index chỉ có trong SQL), trang hệ thống `/[slug]/posts`, section `posts`, RLS tách lệnh + 2 trigger, quy tắc sanitize lại
  khi render ([Posts-Specs.md](./Posts-Specs.md)).
- `[[Reviews-Specs]]`: Đánh giá sản phẩm M10a (ADR-029) — quyền đánh giá (đơn FULFILLED + entitlement), 1 đánh giá/khách/
  sản phẩm, tên hiển thị "Minh N.", ẩn/khôi phục/trả lời của tenant, tự ẩn khi hoàn tiền, cache điểm số nguyên, RLS tách
  theo lệnh + trigger giới hạn cột ([Reviews-Specs.md](./Reviews-Specs.md)).
- `[[Shop-Marketplace-Specs]]`: Trang Cửa hàng (marketplace, ADR-035) — **GĐ1 + GĐ2 xong code (2026-10-15), chưa commit/deploy**.
  GĐ1 CMS `shop` trong System Center: `CmsPage` slug `shop` không DDL, schema 9 section, `parseShopSections` đọc phòng thủ, ngưỡng
  điểm ×10, nháp/xuất bản/khôi phục, `SYSTEM_CMS_SLUGS` chặn form CMS chung và `/p/home`, `/p/shop`. GĐ2 trang công khai
  `/cua-hang` + `/cua-hang/tai-lieu`: "Công khai" = PUBLISHED + tenant ACTIVE trong `withPublic`, quy tắc từng kệ, số bán 30 ngày
  dưới `withSystemJob` (chỉ xếp hạng, không hiển thị), tìm không dấu `gieochu_unaccent`, Suspense theo vị trí, SEO/noindex, 6 slug
  tenant dành riêng ([Shop-Marketplace-Specs.md](./Shop-Marketplace-Specs.md)).
- `[[Background-Jobs-Specs]]`: Job nền M11 theo ADR-036 — **xong code (2026-10-16), chưa commit/deploy**. Không worker thường trực trên
  Vercel: `payment.process`/`file.scan` vẫn `send` vào pg-boss rồi `after()` drain ngay sau response (`fetch` → `complete`/`fail`, ngân
  sách thời gian, retry 60 giây + backoff); `GET /api/cron/daily` (Vercel Cron 03:00 giờ VN, Bearer `CRON_SECRET`) chạy sweep thuê bao/đơn
  + bảo trì + dọn hàng đợi; `effectiveOrderStatus`; `worker.ts` chỉ còn cho local ([Background-Jobs-Specs.md](./Background-Jobs-Specs.md)).
- `[[Audit-Log-Specs]]`: Audit log M12a (ADR-037) — **xong code (2026-10-16), chưa commit/deploy; migration đã áp DB**. Bảng L1
  `audit_logs` chỉ-INSERT (quyền `gieochu_app` + 3 trigger, purge chỉ dòng > 12 tháng qua cờ `gieochu.audit_purge`), không khoá ngoại;
  27 action + bảng nơi ghi; `audit.log` ghi sau commit, lỗi không ném; lọc metadata nhạy cảm; trang `/admin/audit` và
  `/studio/{slug}/activity` (chỉ OWNER, che actor ngoài tenant); bước cron `audit.purge` ([Audit-Log-Specs.md](./Audit-Log-Specs.md)).
- `[[Tenant-Stats-Specs]]`: Thống kê hằng ngày M12b (ADR-037) — **xong code (2026-10-16), chưa commit/deploy; migration đã áp DB**. Bảng L1
  `tenant_daily_stats` (tenant + ngày giờ VN, FK Cascade, không RLS, không dữ liệu cá nhân); định nghĩa số liệu (GMV gộp theo `paidAt` tính
  cả đơn hoàn tiền, khách mới theo `tenant_customers.firstOrderAt`, lượt tải theo `download_events`); job `stats.aggregate` trong cron
  (hôm qua + hôm nay, backfill ≤ 400 ngày khi bảng trống, cửa sổ 31 ngày, advisory lock); loader `getAdminStatsOverview` + section dashboard
  `/admin` ([Tenant-Stats-Specs.md](./Tenant-Stats-Specs.md)).
- `[[Abuse-Reports-Specs]]`: Báo cáo vi phạm M12c (ADR-038) + quyền lợi người mua (ADR-039) — **xong code (2026-10-16), chưa commit/deploy;
  2 migration đã áp DB**. Bảng L1 `abuse_reports` (ẩn danh với tenant); `POST /api/reports` (Origin, honeypot, 5/giờ/IP, chặn trùng); xử lý ở
  `/admin/reports` (ẩn/lưu trữ/khoá gian hàng/bác bỏ) + khoá kiểm duyệt (trigger `*_guard_moderation`); cam kết bản quyền mỗi lần xuất bản;
  người mua tài liệu bị lưu trữ chọn "tải lần cuối" (đủ mọi tệp) hoặc "yêu cầu hoàn tiền" (SLA 7 ngày, trigger `entitlements_guard_remedy`);
  5 email mới; bước cron `abuse_report.ip_purge` ([Abuse-Reports-Specs.md](./Abuse-Reports-Specs.md)).
- `[[Pricing-Page-Specs]]`: Trang Bảng giá `/pricing` + CMS `pricing` (ADR-041 A) — **GĐ1 + GĐ2 xong code (2026-10-17), chưa commit/deploy; không
  DDL**. 9 section, giá/hạn mức chỉ từ `Plan`, ghép cặp gói năm (`altPlanId`, % tính từ giá thật), CTA theo người xem (ANON/NO_TENANT/TENANT),
  `IMPLEMENTED_PLAN_FEATURES = []`, xem nháp chỉ admin + `noindex`, SEO CMS, Billing `?plan=` ([Pricing-Page-Specs.md](./Pricing-Page-Specs.md)).
- `[[Account-Profile-Specs]]`: Khu vực tài khoản `/account` (ADR-041 C) — **xong code (2026-10-17), chưa commit/deploy; migration `EMAIL_CHANGE` đã
  áp DB**. Tổng quan + app shell + sidebar 3 nhóm, hồ sơ (SĐT/Tỉnh tuỳ chọn, 34 tỉnh), ảnh đại diện Cloudinary riêng tư ≤2MB, đổi mật khẩu
  (giữ phiên hiện tại, thu hồi phiên khác), đổi email qua token `EMAIL_CHANGE`, menu tài khoản disclosure, 4 email
  ([Account-Profile-Specs.md](./Account-Profile-Specs.md)).
- `[[Studio-Dashboard-Specs]]`: Dashboard Tổng quan gian hàng `/studio/{slug}` (ADR-043) — **xong code (2026-10-18), chưa commit/deploy; không
  migration**. Kỳ `?ky=` (giờ VN, tuần bắt đầu Thứ Hai, mặc định 30 ngày, tuỳ chọn ≤ 366 ngày, so kỳ trước cùng độ dài); doanh thu gộp + thực
  nhận, chỉ đơn > 0đ (đơn 0đ = lượt nhận miễn phí); khách mới/người mua/quay lại; đánh giá; tài liệu; top 5 bán chạy (loại đơn hoàn); 10 đơn
  mới không email; tính realtime qua `withTenant`, chỉ OWNER ([Studio-Dashboard-Specs.md](./Studio-Dashboard-Specs.md)).

## Ghi chú lịch sử

Bộ tài liệu này dựng trên khung thư mục của một KB không thuộc Gieo Chữ và đã được viết lại hoàn toàn cho đúng
domain Gieo Chữ (SaaS bán tài liệu số đa tenant) vào 2026-09-26. 4 file mô tả khái niệm không tồn tại ở Gieo Chữ
đã bị xoá khỏi thư mục này thay vì "dịch" gượng ép.

*Quay lại: [[MOC-Home]] (../00-Index/MOC-Home.md)*

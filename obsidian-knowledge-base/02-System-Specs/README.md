---
tags:
  - meta
  - spec
date: 2026-09-26
updated: 2026-11-24
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
  (`PENDING → PAID → FULFILLED`, `EXPIRED`, `CANCELED`, `REFUNDED`) và hàm `markOrderPaid()` duy nhất; §3.9 áp/gỡ mã giảm giá sau khi đã có QR —
  tạo lại `checkoutPayload`, `ORDER_CHANGED`/`CHECKOUT_CREATE_FAILED` (bổ sung ADR-056).
- `[[Tenant-RBAC-And-Permissions]]`: Ba lớp tài khoản độc lập (System/Tenant/Customer), bảng
  `Role`/`Permission`/`RolePermission` (ADR-022), cơ chế guard 3 tầng không có middleware tập trung.
- `[[Payment-And-Billing]]`: Hai hệ thống thanh toán tách biệt (Platform billing vs Tenant billing) dùng chung
  `packages/payments` qua `PaymentScope`, mô hình Free Forever + Paid Subscription (ADR-021), webhook
  idempotent với `timingSafeEqual`; §5A hạn mức `0`/`-1` + cờ tính năng + gói năm, §5B hoàn tiền gói 7 ngày (bảng L1
  `subscription_refund_requests`, ADR-041 B); §5C hoá đơn gói tab "Tất cả" + trang "Đơn hàng gói dịch vụ" `/admin/subscriptions`, §5D khối chuyển
  khoản `BankTransferPanel`, §5E lưu cấu hình cổng platform trả `{ isEnabled, autoDisabled }` (ADR-056); §5L cấu hình SePay — "Tạo key ngẫu nhiên",
  API Token, "Kiểm tra kết nối" tự bật cổng; §5M mã thanh toán SePay tiền tố 2–5 chữ cái + 8 chữ số, `orders.paymentRef` (ADR-065); §5N xác nhận tay hoá đơn gói
  mọi cổng (ADR-066).
- `[[File-Storage-And-Downloads-Specs]]`: Lưu trữ file sản phẩm qua S3-compatible (Cloudflare R2), presigned
  URL ≤ 10 phút, `DownloadToken`/`ShareLink`, mật khẩu share link bằng argon2 riêng trong `packages/core`; §7 ảnh
  tenant trên Cloudinary hệ thống — chữ ký `public_id`, giữ chỗ + đối soát hạn mức, `cloudinaryDeliveryUrl`,
  sanitizer (ADR-028); §9 Storage Gateway (ADR-045) — env `STORAGE_GATEWAY_PROVIDERS`, URL `/_s/<vé>` qua nginx `auth_request`,
  định dạng vé (HKDF-SHA256 `gieochu:storage-ticket:v1`, AES-256-GCM, base64url, ≤ 8192 ký tự, method GET/PUT, `maxBytes`);
  §11 Public preview cache (ADR-063) — bảng `product_file_previews` không RLS, 5 nhánh định dạng (docx/xlsx/pdf/text/unsupported),
  payload JSONB ≤ 256 KB, hook sinh cache sau `file.scan=CLEAN` fire-and-forget + lazy fallback, endpoint public 404-mọi-lỗi,
  rate limit 60/phút/IP TODO.
- `[[User-Management-System-Center-Specs]]`: Console quản trị `/admin/**`, quản lý gian hàng `/admin/tenants` + trang chi tiết `/admin/tenants/[tenantId]` và khoá/mở khoá có lý do + email chủ gian hàng (ADR-072, KB ADR-056, chưa commit), khoá/mở khoá tài khoản, cơ chế
  refresh-token rotation + reuse detection, ranh giới "System Admin không đọc order/customer của tenant"; menu có "Đơn hàng" (`/admin/subscriptions`) và
  "Cấu hình thanh toán" (ADR-056).
- `[[Auth-Session-Specs]]`: Phiên đăng nhập (M1 + ADR-053) — **GĐ A + GĐ B xong code (2026-10-24), chưa commit; migration đã chạy**. Một `familyId` = một
  phiên; "Ghi nhớ đăng nhập" mặc định tắt (SYSTEM_ADMIN luôn bỏ qua), cookie session vs persistent, idle/absolute đo ở server (không trượt), bảng chính
  sách 6 khoá System Settings, ân hạn refresh 30 giây `AUTH_REFRESH_SUPERSEDED` + rotation nguyên tử + kiểm `user.status`, `SessionRefresh` (khoá giữa tab,
  cảnh báo idle), điều hướng cứng sau login/logout (nguyên nhân lỗi header cache), danh sách thiết bị `/account/security` (`deviceKind`, đăng xuất thiết bị
  này → `{ signedOut }` + điều hướng cứng), cron xoá bản ghi phiên sau 90 ngày ([Auth-Session-Specs.md](./Auth-Session-Specs.md)).
- `[[Editor-Autosave-Drafts-Specs]]`: Tự lưu nháp editor lên server (ADR-053 bổ sung lần 3) — **phần nền xong code (2026-10-24), chưa commit; migration
  đã chạy; chưa gắn editor nào, chưa gắn cron**. Bảng L2 `tenant_editor_drafts` (RLS tenant + `system_job` chỉ SELECT/DELETE) và L1 `system_editor_drafts`,
  CHECK 1 MiB; khoá thực thể theo loại, giới hạn payload theo loại, zod "chế độ nháp", mã lỗi `DRAFT_*`; revision + `clientId` chống xung đột nhiều tab;
  hook `useServerAutosave` (3 giây / 30 giây, sự kiện `gieochu:session-expiring`); `purgeStaleDrafts` 30 ngày ([Editor-Autosave-Drafts-Specs.md](./Editor-Autosave-Drafts-Specs.md)).
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
- `[[Background-Jobs-Specs]]`: Job nền M11 theo ADR-036 — **xong code (2026-10-16), đã commit `9a3208f`**, deploy ❓. Không worker thường trực trên
  Vercel: `payment.process`/`file.scan` vẫn `send` vào pg-boss rồi `after()` drain ngay sau response (`fetch` → `complete`/`fail`, ngân
  sách thời gian, retry 60 giây + backoff); `GET /api/cron/daily` (Vercel Cron 03:00 giờ VN, Bearer `CRON_SECRET`) chạy sweep thuê bao/đơn
  + bảo trì + dọn hàng đợi; `effectiveOrderStatus`; `worker.ts` chỉ còn cho local ([Background-Jobs-Specs.md](./Background-Jobs-Specs.md)).
- `[[Audit-Log-Specs]]`: Audit log M12a (ADR-037) — **xong code (2026-10-16), đã commit `36103fb`; migration đã áp DB**; deploy ❓. Bảng L1
  `audit_logs` chỉ-INSERT (quyền `gieochu_app` + 3 trigger, purge chỉ dòng > 12 tháng qua cờ `gieochu.audit_purge`), không khoá ngoại;
  27 action + bảng nơi ghi; `audit.log` ghi sau commit, lỗi không ném; lọc metadata nhạy cảm; trang `/admin/audit` và
  `/studio/{slug}/activity` (chỉ OWNER, che actor ngoài tenant); bước cron `audit.purge` ([Audit-Log-Specs.md](./Audit-Log-Specs.md)).
- `[[Tenant-Stats-Specs]]`: Thống kê hằng ngày M12b (ADR-037) — **xong code (2026-10-16), đã commit `36103fb`; migration đã áp DB**; deploy ❓. Bảng L1
  `tenant_daily_stats` (tenant + ngày giờ VN, FK Cascade, không RLS, không dữ liệu cá nhân); định nghĩa số liệu (GMV gộp theo `paidAt` tính
  cả đơn hoàn tiền, khách mới theo `tenant_customers.firstOrderAt`, lượt tải theo `download_events`); job `stats.aggregate` trong cron
  (hôm qua + hôm nay, backfill ≤ 400 ngày khi bảng trống, cửa sổ 31 ngày, advisory lock); loader `getAdminStatsOverview` + section dashboard
  `/admin` ([Tenant-Stats-Specs.md](./Tenant-Stats-Specs.md)).
- `[[Abuse-Reports-Specs]]`: Báo cáo vi phạm M12c (ADR-038) + quyền lợi người mua (ADR-039) — **xong code (2026-10-16), đã commit `36103fb`, deploy ❓;
  2 migration đã áp DB**. Bảng L1 `abuse_reports` (ẩn danh với tenant); `POST /api/reports` (Origin, honeypot, 5/giờ/IP, chặn trùng); xử lý ở
  `/admin/reports` (ẩn/lưu trữ/khoá gian hàng/bác bỏ) + khoá kiểm duyệt (trigger `*_guard_moderation`); cam kết bản quyền mỗi lần xuất bản;
  người mua tài liệu bị lưu trữ chọn "tải lần cuối" (đủ mọi tệp) hoặc "yêu cầu hoàn tiền" (SLA 7 ngày, trigger `entitlements_guard_remedy`);
  5 email mới; bước cron `abuse_report.ip_purge` ([Abuse-Reports-Specs.md](./Abuse-Reports-Specs.md)).
- `[[Pricing-Page-Specs]]`: Trang Bảng giá `/pricing` + CMS `pricing` (ADR-041 A) — **GĐ1 + GĐ2 xong code (2026-10-17), đã commit `7f8360b`, deploy ❓; không
  DDL**. 9 section, giá/hạn mức chỉ từ `Plan`, ghép cặp gói năm (`altPlanId`, % tính từ giá thật), CTA theo người xem (ANON/NO_TENANT/TENANT),
  `IMPLEMENTED_PLAN_FEATURES = []`, xem nháp chỉ admin + `noindex`, SEO CMS, Billing `?plan=` ([Pricing-Page-Specs.md](./Pricing-Page-Specs.md)).
- `[[Account-Profile-Specs]]`: Khu vực tài khoản `/account` (ADR-041 C) — **xong code (2026-10-17), đã commit `7f8360b`, deploy ❓; migration `EMAIL_CHANGE` đã
  áp DB**. Tổng quan + app shell + sidebar 3 nhóm, hồ sơ (SĐT/Tỉnh tuỳ chọn, 34 tỉnh), ảnh đại diện Cloudinary riêng tư ≤2MB, đổi mật khẩu
  (giữ phiên hiện tại, thu hồi phiên khác), đổi email qua token `EMAIL_CHANGE`, menu tài khoản disclosure, 4 email
  ([Account-Profile-Specs.md](./Account-Profile-Specs.md)).
- `[[Studio-Dashboard-Specs]]`: Dashboard Tổng quan gian hàng `/studio/{slug}` (ADR-043) — **đã commit `e5d63d0` (2026-10-18), deploy ❓; "Bổ sung lần 3" chưa commit; không
  migration**. Kỳ `?ky=` 12 mốc chọn qua date range picker (giờ VN, tuần bắt đầu Thứ Hai, mặc định 30 ngày, tuỳ chọn ≤ 366 ngày, so kỳ trước cùng độ dài — riêng tuần/tháng/quý trước so trọn kỳ); số đầy đủ không rút gọn; doanh thu gộp + thực
  nhận, chỉ đơn > 0đ (đơn 0đ = lượt nhận miễn phí); khách mới/người mua/quay lại; đánh giá; tài liệu; top 5 bán chạy (loại đơn hoàn); 10 đơn
  mới không email; tính realtime qua `withTenant`, chỉ OWNER ([Studio-Dashboard-Specs.md](./Studio-Dashboard-Specs.md)).
- `[[Studio-Orders-Specs]]`: Trang Đơn hàng Studio `/studio/{slug}/orders` + chi tiết (ADR-046) — **working tree, chưa commit (2026-10-18); không
  migration, không route/action mới**. Danh sách lọc trạng thái hiệu lực (kèm số đếm)/yêu cầu hoàn tiền/ngày tạo đơn/tài liệu, tìm mã-họ tên-email
  (escape `%`/`_`), sắp xếp, phân trang server 20/trang; thao tác hợp lệ theo `orderAllowedActions`; chi tiết kênh thanh toán suy ra, dòng tài liệu,
  giao dịch, lịch sử khách (chỉ đơn > 0đ), dòng thời gian từ dữ liệu có sẵn; khách chỉ họ tên + email; chỉ OWNER; ADR-047 tìm không dấu + ghi chú
  nội bộ `order_notes`; ADR-048 thêm `?khach=` lọc đơn theo khách ([Studio-Orders-Specs.md](./Studio-Orders-Specs.md)).
- `[[Studio-Customers-Specs]]`: Danh sách Khách hàng Studio `/studio/{slug}/customers` (ADR-048) — **working tree, chưa commit (2026-10-23); không
  migration, không route mới**. Khách = ≥ 1 đơn có `paidAt` (gồm 0đ); số đơn/chi tiêu chỉ đơn > 0đ, gộp + "Đã hoàn" riêng, tính lại từ `orders`; 5 thẻ
  thống kê chỉ áp kỳ; tìm không dấu, 6 nhóm (gồm "lâu chưa quay lại" 90 ngày), kỳ theo mua lần đầu/gần nhất, tài liệu đã mua, sắp xếp, phân trang;
  ghi chú một ô `tenant_customers.note` ≤ 500 ký tự (audit không nội dung); link "Xem đơn của khách"; chỉ OWNER
  ([Studio-Customers-Specs.md](./Studio-Customers-Specs.md)).
- `[[System-Cms-Menu-Home-Seo-Specs]]`: CMS hệ thống ADR-050 đợt 1 — **CMS/logic xong ở working tree, chưa commit (2026-10-23); UI Phong đang làm; không
  migration**. Slug hệ thống `menu` (`/admin/cms/menu`): header ≤ 5 mục + menu con 1 cấp ≤ 8, CTA ≤ 24 ký tự, footer 1–4 cột × ≤ 8 link, 4 loại link
  (trang có sẵn/nội bộ/ngoài/email) qua luật chặn `cms-content-guard.ts`, menu mặc định, CTA "miễn phí" chỉ khi có Plan Free active; trang chủ 11 section
  (thêm `steps`/`faq`/`community`, `testimonials` cũ → `community` chưa đồng ý = ẩn, `minToShow`, nội dung mặc định theo brief, chặn xuất bản
  `homePublishIssues`, cảnh báo mềm brief §8); SEO trang chủ + bộ giới hạn SEO chung `@gieochu/core/seo` (120/320, cảnh báo 60/160), `generateMetadata` +
  canonical từ `APP_URL` ([System-Cms-Menu-Home-Seo-Specs.md](./System-Cms-Menu-Home-Seo-Specs.md)).
- `[[Legal-Documents-Specs]]`: Văn bản pháp lý có phiên bản (ADR-050 mục 3 + **ADR-054 đợt 2**) — **code chưa commit; migration
  `20261023090000_adr050_legal_documents` đã chạy, migration ADR-054 `20261024150000_adr053_legal_document_meta` đã chạy**. Từ ADR-054: 7 văn bản ở URL
  cấp gốc, `/phap-ly/{slug}` redirect 308, mô tả/SEO trong CMS (`?van-ban=`, `LegalMetaForm`), `trustedLinks`, đăng ký ghi Điều khoản + Bảo mật, mở gian
  hàng đồng ý Chính sách người bán, menu loại `legal` + footer "Thông tin", cron `download_events.purge`. 3 bảng L1 (`legal_documents`, `legal_document_versions`, `user_legal_acceptances` — append-only,
  không IP/UA), trigger bất biến bản đã phát hành, bản hiệu lực = PUBLISHED `effectiveAt ≤ now` mới nhất, cổng xuất bản (APPROVED + hết `[[CẦN XÁC
  NHẬN`), không lùi ngày hiệu lực (dung sai 5 phút), sửa nháp → rà soát về PENDING, `{brand}` thay sau sanitize, `/phap-ly/[slug]` 404 khi chưa có
  bản, editor `/admin/cms/phap-ly`, ghi chấp thuận khi đăng ký trong cùng transaction ([Legal-Documents-Specs.md](./Legal-Documents-Specs.md)).

## Ghi chú lịch sử

Bộ tài liệu này dựng trên khung thư mục của một KB không thuộc Gieo Chữ và đã được viết lại hoàn toàn cho đúng
domain Gieo Chữ (SaaS bán tài liệu số đa tenant) vào 2026-09-26. 4 file mô tả khái niệm không tồn tại ở Gieo Chữ
đã bị xoá khỏi thư mục này thay vì "dịch" gượng ép.

*Quay lại: [[MOC-Home]] (../00-Index/MOC-Home.md)*

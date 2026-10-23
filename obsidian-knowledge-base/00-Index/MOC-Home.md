---
tags:
  - meta
  - index
  - moc
date: 2026-09-26
updated: 2026-10-23
author: System Architect
---

# 🗺️ Gieo Chữ Knowledge Base — Map of Content (MOC)

Chào mừng bạn đến với **Kho Tri Thức Chuẩn Hóa của Gieo Chữ** — nền tảng SaaS đa tenant cho giáo viên/coach
bán tài liệu số. Kho này chứa quy tắc nghiệp vụ, quyết định kiến trúc, đặc tả kỹ thuật và cẩm nang vận hành
của hệ thống, tổ chức lại từ khuôn mẫu thư mục có sẵn (viết mới toàn bộ nội dung ngày 2026-09-26).

**Nguồn sự thật gốc** (khi KB này và code lệch nhau, các file sau luôn thắng): `CLAUDE.md` (root repo),
`docs/PLAN.md`, `docs/DECISIONS.md`, `docs/BACKLOG.md`, `docs/ARCHITECTURE.md`,
`docs/GIEOCHU_PROMPT_MVP_PHASE1.md`. KB này là một lớp chỉ mục có cấu trúc thứ cấp của cùng sự thật đó, không
phải nguồn thay thế.

---

## 📌 Nguyên Tắc Vàng (Core Principles)

* **Zero Guessing:** Không suy diễn logic nghiệp vụ — verify qua code, Neon PostgreSQL, và `docs/PLAN.md`/
  `docs/DECISIONS.md`. Khi đặc tả mơ hồ: chọn phương án an toàn/đơn giản nhất và ghi ADR; nếu ảnh hưởng tiền,
  bảo mật, hoặc dữ liệu cá nhân — **dừng lại và hỏi người dùng**, không tự quyết.
* **ID = cuid2, không UUID:** Mọi `@id` dùng thuộc tính gốc Prisma `@default(cuid(2))` (ADR-001).
* **RLS 4-scope là bắt buộc cho mọi bảng L2:** mọi bảng có `tenantId` phải đi qua đúng một trong
  `withTenant/withCustomer/withPublic/withSystemJob` (`packages/db/src/rls.ts`) — không bao giờ gọi
  `getPrismaClient()` trần cho bảng L2. Vi phạm quy tắc này đã gây ra ít nhất 3 lỗ hổng RLS thật, chỉ phát
  hiện được qua integration test thật (ADR-010, ADR-020).
* **Không `import '@prisma/client'` trực tiếp trong `apps/web`:** chỉ qua helper của `@gieochu/db` (chặn bằng
  ESLint `no-restricted-imports`).
* **Hai hệ thống thanh toán không bao giờ chung bảng/secret/route:** Platform (tenant trả phí subscription
  cho nền tảng) và Tenant (khách trả tiền cho giáo viên) dùng chung code `packages/payments` nhưng mọi hàm
  nhận `PaymentScope` (`{kind:'PLATFORM'}` hoặc `{kind:'TENANT', tenantId}`) — không chung bảng, secret, hay
  route webhook.
* **Secret cổng thanh toán mã hoá AES-256-GCM** bằng `PAYMENT_ENCRYPTION_KEY` trước khi lưu DB — không bao
  giờ trả secret thô về client.
* **Không bao giờ đặt `user.id` vào URL slug** (ADR-022) — landing path tra theo `Tenant.ownerId` để lấy
  `tenant.slug`, không suy diễn URL từ ID người dùng.
* **System Admin không có route nào đọc chi tiết đơn hàng/khách hàng của tenant** — chỉ đọc
  `tenant_daily_stats` và bảng L1. Ranh giới L1 System / L2 Tenant / L3 Customer là bất biến.

---

## 🗂️ Cấu Trúc Bản Đồ Tri Thức

### 1. [[01-Architecture-Decisions/README|01-Architecture-Decisions]] — Quyết định Kiến trúc Bất biến (ADR)
Các ADR ngắn ghi lại quyết định khi đặc tả mơ hồ, tương ứng `docs/DECISIONS.md` gốc — ví dụ: ID strategy
cuid2, tách role Postgres `gieochu_app` khỏi role owner để RLS có hiệu lực thật, mô hình Hybrid Monetization
(Free Forever + Paid Subscription) thay cho trial hết hạn, bảng `Role`/`Permission` làm nguồn sự thật RBAC, storefront tenant theo section CMS + hộp thư liên hệ (ADR-023),
chuẩn độ rộng layout 1280px (ADR-024), tenant chỉ sở hữu nội dung storefront — header/footer và trang con là của
hệ thống (ADR-025), editor sản phẩm GĐ1 — danh mục bắt buộc khi xuất bản, link tài liệu ngoài, sửa bảo mật upload
(ADR-026), mô tả ngắn/ảnh bìa Cloudinary/Xem trước/chế độ hiển thị (ADR-027), ảnh nội dung trên Cloudinary hệ thống
+ hạn mức ảnh theo gói + siết chữ ký upload (ADR-028), M10 GĐ1 — Đánh giá M10a + Bài viết M10b, siết RLS ghi 7 bảng L2
(ADR-029, [[01-Architecture-Decisions/ADR-015-M10-Reviews-Posts-Rls-Split-Writes|ADR-015 KB]]), URL tài liệu rút gọn
`/{tenantSlug}/{productSlug}` + slug dành riêng + bỏ card xuất bản dính (ADR-030,
[[01-Architecture-Decisions/ADR-016-Short-Product-Url-No-Sticky-Publish-Card|ADR-016 KB]]), deploy Vercel — build không cần
DB/env, root layout `force-dynamic`, `PRISMA_MIGRATE_URL` không bao giờ ở runtime (ADR-031,
[[01-Architecture-Decisions/ADR-017-Vercel-Deploy-Build-Without-Env|ADR-017 KB]]), cấu hình hệ thống + thương hiệu lấy từ System
Center (DB), env runtime chỉ còn 8 biến, kèm sự cố 2026-10-15 và quy tắc migration expand → contract (ADR-032,
[[01-Architecture-Decisions/ADR-018-System-Settings-And-Brand-From-System-Center|ADR-018 KB]]), trang chủ hệ thống dùng dữ liệu thật +
cột cache `products.soldCount` (ADR-033, [[01-Architecture-Decisions/ADR-019-Home-Page-Real-Data-Sold-Count|ADR-019 KB]]), một database
duy nhất cho dev/Preview/production + kỷ luật thao tác DB (ADR-034,
[[01-Architecture-Decisions/ADR-020-Single-Database-Dev-Preview-Production|ADR-020 KB]]), trang Cửa hàng (marketplace) — CMS `shop` trước,
trang công khai `/cua-hang` sau (ADR-035, [[01-Architecture-Decisions/ADR-021-Shop-Marketplace-Cms-First|ADR-021 KB]]), xử lý job nền
ngay trong app bằng `after()` + Vercel Cron hằng ngày, không worker thường trực (ADR-036, [[01-Architecture-Decisions/ADR-022-Background-Jobs-After-And-Daily-Cron|ADR-022 KB]]), M12 chia 3 đợt + audit log chỉ-INSERT không khoá ngoại giữ 12 tháng (ADR-037,
[[01-Architecture-Decisions/ADR-023-M12-Audit-Log-Append-Only|ADR-023 KB]]), M12c báo cáo vi phạm — ai cũng gửi được, ẩn danh với tenant, khoá kiểm
duyệt, cam kết bản quyền (ADR-038, [[01-Architecture-Decisions/ADR-024-M12c-Abuse-Reports-Moderation-Lock|ADR-024 KB]]), quyền lợi người mua khi tài
liệu bị gỡ do vi phạm — tải lần cuối hoặc yêu cầu hoàn tiền (ADR-039, [[01-Architecture-Decisions/ADR-025-Buyer-Remedy-Final-Download-Or-Refund|ADR-025 KB]]),
chỉ gian hàng `ACTIVE` hiển thị tài liệu — `READ_ONLY` là trang "tạm ngưng" với khách (ADR-040,
[[01-Architecture-Decisions/ADR-026-Only-Active-Tenant-Shows-Documents|ADR-026 KB]]), nâng cấp tài khoản + hồ sơ — Bảng giá CMS `pricing`, gói năm,
hạn mức `0`/`-1`, hoàn tiền gói 7 ngày, hồ sơ/đổi mật khẩu/đổi email (ADR-041, [[01-Architecture-Decisions/ADR-027-Account-Upgrade-Pricing-Profile-Refund|ADR-027 KB]]),
một sidebar dùng chung System Center + Studio, Đăng xuất ở đáy sidebar, drawer mobile (ADR-042,
[[01-Architecture-Decisions/ADR-028-Shared-App-Sidebar-Logout-Mobile-Drawer|ADR-028 KB]]), dashboard Tổng quan gian hàng — chỉ số theo kỳ, doanh thu
gộp + thực nhận, chỉ đơn > 0đ, 10 đơn mới không email; bổ sung lần 3: date range picker 12 mốc, 3 mốc "… trước" so trọn kỳ, số đầy đủ (ADR-043, [[01-Architecture-Decisions/ADR-029-Studio-Dashboard-Period-Gross-Net-Revenue|ADR-029 KB]]),
Storage Gateway — giấu MinIO sau `gieochu.net` bằng vé mã hoá `/_s/<vé>` + nginx `auth_request`, env `STORAGE_GATEWAY_PROVIDERS` (ADR-045,
[[01-Architecture-Decisions/ADR-030-Storage-Gateway-Encrypted-Ticket-Nginx|ADR-030 KB]]); MinIO song song R2, bucket riêng `{prefix}{12 ký tự đầu tenantId}` cho mỗi gian hàng (đổi mẫu 2026-10-23), công cụ đồng bộ + giám sát bucket — migration chưa áp DB (ADR-044, [[01-Architecture-Decisions/ADR-034-Dual-Storage-MinIO-R2-Dedicated-Tenant-Bucket|ADR-034 KB]]);
nâng cấp trang Đơn hàng Studio — danh sách lọc/tìm/sắp xếp/phân trang server, chi tiết 2 cột kiểu WooCommerce, khách chỉ họ tên + email, không
migration (ADR-046, [[01-Architecture-Decisions/ADR-031-Studio-Orders-List-Detail-Upgrade|ADR-031 KB]]), Đơn hàng Studio — tìm không dấu, ghi chú nội bộ
`order_notes` (bảng L2 mới, chỉ tác giả xoá), không thao tác hàng loạt / xuất CSV (ADR-047, [[01-Architecture-Decisions/ADR-032-Studio-Orders-Unaccent-Search-Internal-Notes|ADR-032 KB]]).
Danh sách Khách hàng Studio — số liệu tính lại từ `orders` (chỉ đơn > 0đ, gộp + "Đã hoàn"), 5 thẻ thống kê, nhóm khách, ghi chú `tenant_customers.note`, link `orders?khach=`, không migration (ADR-048, [[01-Architecture-Decisions/ADR-033-Studio-Customers-List-Upgrade|ADR-033 KB]]). Đợt 1 ADR-050 — CMS menu header/footer (slug `menu`, **sửa ADR-025**: header/footer không còn là chrome cố định), trang chủ theo brief + SEO trang chủ, Điều khoản sử dụng có phiên bản + chấp thuận khi đăng ký; bổ sung **không xoá user, chỉ khoá** ([[01-Architecture-Decisions/ADR-035-Menu-Home-Seo-Versioned-Terms|ADR-035 KB]]). Môi trường chạy — Vercel để thử nghiệm, VPS cho production (ADR-049, [[01-Architecture-Decisions/ADR-036-Vercel-Testing-VPS-Production|ADR-036 KB]]). Tổng cộng 50 ADR gốc (KB đã trích đủ tới ADR-050; ADR-046/047/048 trước đây đánh số 044/045/046 — đổi số 2026-10-23 do trùng với nhánh của vuong, xem [[00-Index/KB-Audit-2026-09-26|KB-Audit]] §29).
([Đường dẫn](../01-Architecture-Decisions/README.md))

### 2. [[02-System-Specs/README|02-System-Specs]] — Đặc tả Hệ thống Sống (Living Specs)
Đặc tả các luồng nghiệp vụ đang hoạt động thật trong code, theo từng module đã hoàn thành ở `docs/PLAN.md`
(M0–M9): xác thực & định danh, tenant workspace & storefront, System Admin console, billing/subscription &
entitlement, cấu hình thanh toán tenant, sản phẩm & giá & khuyến mãi, checkout & vòng đời đơn hàng, thư viện/
tải xuống/share link, storefront CMS + form liên hệ (ADR-023,
[[02-System-Specs/Storefront-CMS-Specs|Storefront-CMS-Specs]]), editor sản phẩm + điều kiện xuất bản + link tài liệu
ngoài + trang Xem trước + URL tài liệu `/{tenantSlug}/{productSlug}` và slug dành riêng (ADR-026/027/030,
[[02-System-Specs/Product-Editor-And-Publishing-Specs|Product-Editor-And-Publishing-Specs]]), ảnh Cloudinary hệ thống + hạn mức ảnh
(ADR-028, [[02-System-Specs/File-Storage-And-Downloads-Specs|File-Storage-And-Downloads-Specs]] §7), đánh giá sản phẩm M10a
(ADR-029, [[02-System-Specs/Reviews-Specs|Reviews-Specs]]), bài viết tối giản M10b (ADR-029, [[02-System-Specs/Posts-Specs|Posts-Specs]]), trang Cửa hàng — GĐ1 CMS `shop` + GĐ2 trang công khai `/cua-hang`, `/cua-hang/tai-lieu` đã commit `f021ed3` (deploy ❓) (ADR-035, [[02-System-Specs/Shop-Marketplace-Specs|Shop-Marketplace-Specs]]), job nền M11 — `after()` + cron `/api/cron/daily`, trạng thái đơn hiệu lực `effectiveOrderStatus` (ADR-036, đã commit `9a3208f` (deploy ❓), [[02-System-Specs/Background-Jobs-Specs|Background-Jobs-Specs]]), audit log M12a — bảng `audit_logs` chỉ-INSERT, 27 action, trang `/admin/audit` + Studio → Hoạt động, purge 12 tháng trong cron (ADR-037, đã commit `36103fb` (deploy ❓), migration đã áp DB, [[02-System-Specs/Audit-Log-Specs|Audit-Log-Specs]]), thống kê hằng ngày M12b — bảng L1 `tenant_daily_stats` (GMV gộp theo `paidAt`, khách mới theo `firstOrderAt`, lượt tải), bước cron `stats.aggregate`, section "Hoạt động bán tài liệu (30 ngày)" trên `/admin` (ADR-037, đã commit `36103fb` (deploy ❓), migration đã áp DB, [[02-System-Specs/Tenant-Stats-Specs|Tenant-Stats-Specs]]), báo cáo vi phạm M12c + quyền lợi người mua — `POST /api/reports`, `/admin/reports`, khoá kiểm duyệt, cam kết bản quyền, tải lần cuối / yêu cầu hoàn tiền, sửa lỗi email đơn hàng không gửi do RLS (ADR-038/039, đã commit `36103fb` (deploy ❓), 2 migration đã áp DB — phải áp trước code, [[02-System-Specs/Abuse-Reports-Specs|Abuse-Reports-Specs]]), trang Bảng giá `/pricing` + CMS `pricing` (ADR-041 A, đã commit `7f8360b` (deploy ❓), [[02-System-Specs/Pricing-Page-Specs|Pricing-Page-Specs]]), hạn mức `0`/`-1` + hoàn tiền gói 7 ngày (ADR-041 B, [[02-System-Specs/Payment-And-Billing|Payment-And-Billing]] §5A–§5B), khu vực tài khoản `/account` — hồ sơ, đổi mật khẩu, đổi email, ảnh đại diện (ADR-041 C, 2 migration đã áp DB, [[02-System-Specs/Account-Profile-Specs|Account-Profile-Specs]]), dashboard Tổng quan gian hàng `/studio/{slug}` — kỳ `?ky=` giờ VN, doanh thu gộp + thực nhận, đơn 0đ tách riêng, tính realtime qua `withTenant` (ADR-043, đã commit `e5d63d0`, deploy ❓ — bổ sung lần 3 date range picker chưa commit, không migration, [[02-System-Specs/Studio-Dashboard-Specs|Studio-Dashboard-Specs]]; chênh lệch với số System Center ở [[02-System-Specs/Tenant-Stats-Specs|Tenant-Stats-Specs]] §9), trang Đơn hàng Studio `/studio/{slug}/orders` — lọc theo trạng thái hiệu lực kèm số đếm, tìm mã/họ tên/email không dấu (escape `%`/`_`, ADR-047), phân trang server, thao tác hợp lệ `orderAllowedActions`, chi tiết + dòng thời gian từ dữ liệu có sẵn + ghi chú nội bộ `order_notes` chỉ tác giả xoá (ADR-046/047, chưa commit, migration `order_notes` đã áp, [[02-System-Specs/Studio-Orders-Specs|Studio-Orders-Specs]]), Storage Gateway — định dạng vé `/_s/` (HKDF + AES-256-GCM), chọn theo provider đã ký URL (ADR-045, đã commit `4ab5a3b` (deploy ❓), không migration, [[02-System-Specs/File-Storage-And-Downloads-Specs|File-Storage-And-Downloads-Specs]] §9), danh sách Khách hàng Studio `/studio/{slug}/customers` — số liệu từ `orders`, nhóm khách, tìm không dấu, ghi chú khách, lọc đơn theo khách `?khach=` (ADR-048, chưa commit, không migration, [[02-System-Specs/Studio-Customers-Specs|Studio-Customers-Specs]]), CMS hệ thống ADR-050 — menu header/footer slug `menu`, trang chủ 11 section theo brief (`steps`/`faq`/`community`, chứng thực cần đồng ý, `minToShow`, nội dung mặc định, chặn xuất bản), SEO trang chủ + giới hạn SEO chung, Hero thẻ số liệu thật + khung ảnh 4:5 ("Bổ sung lần 3") (chưa commit, không migration, [[02-System-Specs/System-Cms-Menu-Home-Seo-Specs|System-Cms-Menu-Home-Seo-Specs]]), Điều khoản sử dụng có phiên bản — 3 bảng L1, bản đã phát hành bất biến, cổng xuất bản APPROVED + hết placeholder, chấp thuận khi đăng ký (ADR-050, chưa commit, migration đã chạy, [[02-System-Specs/Legal-Documents-Specs|Legal-Documents-Specs]]), cùng ranh giới RLS theo layer L1/L2/L3 (tách policy đọc/ghi từ ADR-029).
([Đường dẫn](../02-System-Specs/README.md))

### 3. [[03-API-Contracts/README|03-API-Contracts]] — Chuẩn Giao tiếp & Data Models
Hợp đồng dữ liệu giữa client và server: danh bạ route (`apps/web/app/api/**/route.ts` + Server Action),
lược đồ Prisma (`packages/db/prisma/schema.prisma`) theo layer, và mẫu response lỗi chuẩn
`{ error: { code, message, requestId } }`; kèm contract Server Action của editor sản phẩm Studio
(`ProductActionState`, [[03-API-Contracts/Endpoint-Directory|Endpoint-Directory]] §10) và action ảnh Cloudinary tenant
(`CloudinarySignatureResult`, `registerTenantImageAction`, §11) và action/hàm đánh giá M10a (§12), action/hàm bài viết M10b (§13), cấu hình hệ thống + CMS trang chủ (§14), action/hàm CMS Cửa hàng + subpath `@gieochu/core/shop-sections` (§15), trang công khai Cửa hàng + loader `lib/shop.ts` +
subpath `@gieochu/core/product-type` (§16), route cron `GET /api/cron/daily` (§17, ADR-036; bước `audit.purge` từ M12a), trang + loader audit log và chữ ký hàm lib thêm `actorId` (§18, ADR-037), job + loader thống kê `getAdminStatsOverview` và bước cron `stats.aggregate` (§19, M12b), route mới `POST /api/reports` + action `/admin/reports` + action thư viện chọn quyền lợi + bước cron `abuse_report.ip_purge` (§20, M12c/ADR-039), action/loader Bảng giá CMS + hoàn tiền gói + Hồ sơ/Bảo mật/đổi email (§21, ADR-041), loader dashboard Studio `getTenantDashboard` + subpath `@gieochu/core/dashboard-range` (§22, ADR-043 — không thêm `route.ts`), loader trang Đơn hàng Studio `listOrdersPage`/`getOrderDetailView` + tham số URL + quy ước escape Prisma `contains` (`escapeContainsValue`) (§23, ADR-046 — không thêm `route.ts`) + tìm không dấu SQL thô, ghi chú nội bộ `lib/order-note.ts` + 2 Server Action (§23.3–§23.5, ADR-047) + loader `listCustomersPage`, `updateCustomerNote`, Server Action `saveCustomerNoteAction`, subpath `@gieochu/core/customer-list` và `?khach=` trang Đơn hàng (§24, ADR-048 — không thêm `route.ts`), route nội bộ `GET /api/internal/storage/ticket` chỉ cho nginx + ghi chú URL `/_s/...` ở route tải/upload, shape không đổi (§25, ADR-045 — trước đây là §23 ở nhánh của vuong), `POST /api/auth/register` thêm `termsVersionId` + 409 `LEGAL_TERMS_CHANGED` (§3.1) và action/loader menu, trang chủ, văn bản pháp lý (§26, ADR-050 — không thêm `route.ts`); lược đồ ghi thêm migration ADR-035 (extension `unaccent`, hàm `gieochu_unaccent`), M12a (`audit_logs`, `AuditScope`, trigger chỉ-INSERT), M12b (`tenant_daily_stats`), M12c (`abuse_reports`, khoá kiểm duyệt) và ADR-039 (`entitlements.remedy*`), ADR-041 (`EMAIL_CHANGE`/`newEmail`, `REFUNDED`, `subscription_refund_requests`), ADR-050 (`legal_documents`, `legal_document_versions`, `user_legal_acceptances` + trigger bất biến — 50 model / 33 enum).
([Đường dẫn](../03-API-Contracts/README.md))

### 4. [[04-Operations-Runbooks/README|04-Operations-Runbooks]] — Vận hành, Kiểm thử & Triển khai
Cẩm nang thao tác: chạy dev/test/build (bảng lệnh `CLAUDE.md`), cấu hình `.env`, cấu hình cổng thanh toán/
lưu trữ qua System Admin (`/admin/settings/storage`, `/admin/billing/payment`), và các bước smoke-test thủ
công đã dùng để bắt lỗi thật (ví dụ lỗi CSP chặn hydrate React, seed thiếu `UserProfile`) trong các module
trước.
Hệ thống thiết kế UI (token, chuẩn độ rộng layout 1280px theo ADR-024, kit component, app shell System Center + Studio — sidebar dùng chung `SidebarNav`/`AppSidebarPanel`, Đăng xuất đáy sidebar, drawer `SidebarDrawer` dưới `lg` §5.1 — ADR-042, editor sản phẩm 2 cột + card xuất bản
đầu sidebar (không dính khi cuộn — ADR-030) + trang Xem trước theo ADR-026/027, TiptapEditor upload ảnh theo ADR-028, giao diện đánh giá M10a §10, giao diện bài viết M10b §11, trang chủ dữ liệu thật + PinPicker + form "Cấu hình chung" §12 — ADR-032/033, editor CMS Cửa hàng + kit `Notice` §13 — ADR-035, trang Cửa hàng công khai + component catalog dùng chung `DocumentCard`/`ProductShelf`/`ShopHero`/`MobileNav` §14 — ADR-035 GĐ2, trang nhật ký `/admin/audit` + Studio → Hoạt động + `LinkPagination` §15 — ADR-037, section "Hoạt động bán tài liệu (30 ngày)" trên dashboard `/admin` §16 — M12b, nút/hộp thoại báo cáo vi phạm + khoá kiểm duyệt + `/admin/reports` + Thư viện chọn quyền lợi + Studio yêu cầu hoàn tiền §17 — M12c/ADR-039, Bảng giá CMS + `/account` + hoàn tiền gói + kit 44px/`PasswordField`/`SortableListEditor` §18 — ADR-041, dashboard Tổng quan gian hàng + component thống kê dùng chung `stats-chart.tsx` §19 — ADR-043, trang Đơn hàng Studio danh sách + chi tiết, `DataTable.headAriaSort`, `LinkPagination.pageParam`, picker `formMode` §20 — ADR-046; ghi chú nội bộ §20.8 — ADR-047; trang Khách hàng Studio + mẫu trang danh sách Studio dùng chung, `OrderFilterForm.label`, hộp ghi chú khách §21 — ADR-048; menu từ CMS — `nav-link`/`nav-dropdown` disclosure, accordion mobile, footer `<nav>` §1.1.1, trang chủ theo brief — steps/community/FAQ, minh hoạ không số, H1 dự phòng, tương phản §12.9, editor menu + pháp lý §13.7, trang văn bản pháp lý — lưới 220px | 768px, mục lục, in + checkbox đăng ký §22 — ADR-050) ở
[[04-Operations-Runbooks/UI-Design-System|UI-Design-System]] ([UI-Design-System.md](../04-Operations-Runbooks/UI-Design-System.md)).
Deploy lên Vercel (ADR-031/032: cấu hình project, 8 biến env runtime + biến cần xoá, chuẩn bị DB prod, job nền trong app + Vercel Cron
`/api/cron/daily` + env tuỳ chọn `CRON_SECRET` + SQL dọn job pg-boss (ADR-036, §6), sự cố đã gặp, **quy trình migration expand → contract + kỷ luật một DB duy nhất (ADR-034) sau sự cố 2026-10-15**, migration
Cửa hàng `unaccent` đã áp trước deploy §9.5, migration Audit log M12a đã áp 2026-10-16 + quyền chỉ-INSERT §9.6, migration Thống kê M12b đã áp 2026-10-16 §9.7 + bấm Run cron sau deploy để backfill §6.2, migration M12c + ADR-039 đã áp — **bắt buộc trước code**, sau deploy email đơn hàng gửi thật lần đầu §9.8 — kiểm sau restore ở Disaster-Recovery-Runbook §4.3, migration ADR-041 đã áp 2026-10-17 §9.9, migration `order_notes` ADR-047 (thư mục `…_adr045_order_notes` giữ số cũ) §9.10, lỗi build `workStore` ở máy dev §7.6) ở
[[04-Operations-Runbooks/Deploy-Vercel-Runbook|Deploy-Vercel-Runbook]] ([Deploy-Vercel-Runbook.md](../04-Operations-Runbooks/Deploy-Vercel-Runbook.md)).
Bật Storage Gateway trên VPS (ADR-045): MinIO/Next bind `127.0.0.1`, cấu hình MinIO trong Admin + Test kết nối, nginx mẫu, env
`STORAGE_GATEWAY_PROVIDERS=MINIO` + pm2, kiểm tra trước khi khoá cổng, rollback ở
[[04-Operations-Runbooks/Storage-Gateway-VPS-Runbook|Storage-Gateway-VPS-Runbook]] ([Storage-Gateway-VPS-Runbook.md](../04-Operations-Runbooks/Storage-Gateway-VPS-Runbook.md));
vận hành MinIO (Docker, sao lưu, đồng bộ R2 ↔ MinIO — ADR-044) ở
[[04-Operations-Runbooks/Minio-Storage-Operations-Runbook|Minio-Storage-Operations-Runbook]] ([Minio-Storage-Operations-Runbook.md](../04-Operations-Runbooks/Minio-Storage-Operations-Runbook.md)).
Xuất bản Điều khoản sử dụng (ADR-050): tạo nháp → rà soát → điền placeholder → tích APPROVED → xuất bản kèm ngày hiệu lực; bản đầu tiên làm form đăng ký
bắt đầu ghi chấp thuận ở [[04-Operations-Runbooks/Legal-Terms-Publishing-Runbook|Legal-Terms-Publishing-Runbook]] ([Legal-Terms-Publishing-Runbook.md](../04-Operations-Runbooks/Legal-Terms-Publishing-Runbook.md));
migration ADR-050 — bắt buộc trước code — ở Deploy-Vercel-Runbook §9.11.
Script dữ liệu demo **chỉ cho dev** (`demo:seed`/`demo:clean`, đánh giá trên tenant `phongweb`) ở
[[04-Operations-Runbooks/Dev-Demo-Data-Runbook|Dev-Demo-Data-Runbook]] ([Dev-Demo-Data-Runbook.md](../04-Operations-Runbooks/Dev-Demo-Data-Runbook.md)).
([Đường dẫn](../04-Operations-Runbooks/README.md))

### 5. [[05-Historical-Archive/README|05-Historical-Archive]] — Lịch sử thật, không bịa (Cold Storage)
Gieo Chữ còn ở giai đoạn rất sớm (18 commit git, 2026-09-17 → 2026-09-20) nên thư mục này **nhỏ và có chủ
đích** — chỉ 3 trang dựng từ nguồn thật: [[Module-Build-History]] (đối chiếu `docs/PLAN.md` với git log thật),
[[Architecture-Decisions-Timeline]] (mục lục 50 ADR đã ghi nhận, ADR-001…ADR-050), [[Known-Gaps-And-Backlog]] (từ `docs/BACKLOG.md`).
Không có báo cáo/sprint log giả lập nào được tạo thêm cho khớp quy mô một dự án lâu năm.
([Đường dẫn](../05-Historical-Archive/README.md))

### 6. [[06-AI-Agent-Guides/README|06-AI-Agent-Guides]] — Hướng dẫn cho AI Agent
[[06-AI-Agent-Guides/Team-Charter|Team-Charter]] ghi lại cách đội vận hành: Quốc (phiên chính, điều phối)
cùng 3 sub-agent Long (`long`, tài liệu), Hiếu (`hieu`, code logic/dữ liệu) và Phong (`phong`, UX/UI — skill
`ui-ux-pro-max`, design layout) định nghĩa ở `.claude/agents/*.md` — phân vùng tri thức, quy trình một task, mẫu
brief, **nguyên tắc lập kế hoạch "CMS trước, UI sau — UX trước UI"** (chủ dự án chốt 2026-10-17;
[[06-AI-Agent-Guides/Team-Charter#2.1. Nguyên tắc lập kế hoạch tính năng|Team-Charter §2.1]],
mục kiểm `PLAN_CHECK` trong mẫu brief) — cùng 2 file mẫu dùng chung nhiều project
(`AGENTS-TEAM-OPERATING-TEMPLATE.md`, `CLAUDE-ORCHESTRATOR-TEMPLATE.md`).
([Đường dẫn](../06-AI-Agent-Guides/README.md))

### 📎 Trang quản trị KB
- [[Product-Overview]]: Giới thiệu sản phẩm ở góc nhìn nghiệp vụ ([Đường dẫn](./Product-Overview.md))
- [[KB-Audit-2026-09-26]]: Trạng thái xác minh của KB này — việc gì đã đối chiếu code, việc gì còn cần kiểm
  trong môi trường thật ([Đường dẫn](./KB-Audit-2026-09-26.md))
- [[Tags-Dictionary]]: Từ điển thẻ dùng trong KB ([Đường dẫn](./Tags-Dictionary.md))

### 📄 Báo cáo gốc trong `docs/`
- Báo cáo rà soát xử lý tài liệu sản phẩm & trang Studio Tạo/Sửa sản phẩm (2026-09-26) — đầu vào đã dẫn tới
  ADR-026/027 (§2.2 có đính chính 2026-09-27 về `storageUsedBytes` khi gỡ file) ([bao-cao-xu-ly-tai-lieu-san-pham-2026-09-26.md](../../docs/bao-cao-xu-ly-tai-lieu-san-pham-2026-09-26.md))
- Báo cáo rà soát lưu trữ ảnh Cloudinary cho editor mô tả: Cloudinary hệ thống vs tenant tự mang (BYO) vs lai,
  ước tính chi phí, khuyến nghị (2026-09-27 — chủ dự án đã quyết thành ADR-028) ([bao-cao-luu-tru-anh-cloudinary-2026-09-27.md](../../docs/bao-cao-luu-tru-anh-cloudinary-2026-09-27.md))
- Kế hoạch chi tiết M10 — Social Feed và Đánh giá: đánh giá lại đặc tả sau ADR-021…028, đề xuất tách M10a/b/c,
  dữ liệu + RLS, ngân sách test, 14 câu hỏi cần chốt (2026-09-27 — chủ dự án đã quyết thành ADR-029; M10a và M10b xong code, chưa có test) ([ke-hoach-M10-social-feed-danh-gia-2026-09-27.md](../../docs/ke-hoach-M10-social-feed-danh-gia-2026-09-27.md))
- Kế hoạch triển khai trang Cửa hàng (marketplace) theo ADR-035: GĐ1 CMS `shop` ở System Center (không DDL), GĐ2
  `/cua-hang` + `/cua-hang/tai-lieu`, tìm không dấu, phân việc Hiếu/Phong, 10 câu hỏi mở (2026-10-15 — GĐ1 + GĐ2 đã commit `f021ed3`, deploy ❓; §5 bước 1–15 xong) ([ke-hoach-cua-hang-marketplace-2026-10-15.md](../../docs/ke-hoach-cua-hang-marketplace-2026-10-15.md))
- Kế hoạch Nâng cấp tài khoản (`/pricing` + CMS) và Hồ sơ (`/account`) theo ADR-041 — luồng UX theo vai, mô hình dữ liệu, các bước GĐ1/GĐ2/GĐ2b,
  bảng quyết định đã chốt (2026-10-17 — GĐ1 + GĐ2 đã commit `7f8360b`, GĐ2b đã commit `9d37ab1`, deploy ❓; GĐ2b làm theo ADR-042) ([ke-hoach-nang-cap-tai-khoan-va-ho-so-2026-10-17.md](../../docs/ke-hoach-nang-cap-tai-khoan-va-ho-so-2026-10-17.md))
- Kế hoạch Dashboard Tổng quan gian hàng `/studio/{slug}` — hiện trạng, danh mục chỉ số khả thi, bộ lọc kỳ, nguồn tính, bố cục UX, 16 câu hỏi
  (2026-10-17 — chủ dự án chốt 2026-10-18 thành ADR-043; GĐ1 dữ liệu + GĐ2 UI đã commit `e5d63d0`; bổ sung lần 3 chưa commit) ([ke-hoach-dashboard-tong-quan-gian-hang-2026-10-17.md](../../docs/ke-hoach-dashboard-tong-quan-gian-hang-2026-10-17.md))
- Kế hoạch Trang chủ + Pháp lý + Menu CMS + SEO — audit hiện trạng, hạng mục A–D, migration, ngân sách test, câu hỏi mở; gộp đề xuất UX của Phong
  (2026-10-23 — chủ dự án chốt đợt 1 thành ADR-050; CMS/logic xong chưa commit, UI đang làm) ([ke-hoach-home-legal-menu-seo-2026-10-23.md](../../docs/ke-hoach-home-legal-menu-seo-2026-10-23.md)) ·
  đề xuất UX ([de-xuat-ux-home-legal-menu-2026-10-23.md](../../docs/de-xuat-ux-home-legal-menu-2026-10-23.md)) · dự thảo Điều khoản (chưa được luật sư rà soát) ([dieu-khoan-su-dung.md](../../docs/legal/drafts/dieu-khoan-su-dung.md))

---

## 🔍 Hướng Dẫn Điều Hướng Cho AI Agent

1. **Khi bắt đầu một task mới:** đọc file này (`00-Index/MOC-Home.md`) để xác định đúng tài liệu spec cần
   tra cứu, nhưng **luôn đối chiếu lại với `docs/PLAN.md`/`docs/DECISIONS.md`/code thật** — KB này có thể
   trễ hơn tiến độ module thật (tại 2026-09-28: M10a + M10b xong code — M10 GĐ1 hoàn tất code, nợ test; M10c/M12 chưa làm; tại 2026-10-15: Cửa hàng GĐ1 — CMS `shop` — và GĐ2 — `/cua-hang`, `/cua-hang/tai-lieu` — đã commit `f021ed3` (deploy ❓); tại 2026-10-16:
   ADR-036 — job nền trong app + cron hằng ngày — đã commit `9a3208f` (deploy ❓); M12a Audit log (ADR-037) đã commit `36103fb` (deploy ❓),
   migration đã áp DB; M12b Thống kê (ADR-037) đã commit `36103fb` (deploy ❓), migration đã áp DB, bảng còn trống chờ cron backfill; M12c Báo cáo vi phạm (ADR-038) +
   quyền lợi người mua (ADR-039) đã commit `36103fb` (deploy ❓), 2 migration đã áp DB — M12 xong code cả 3 đợt; tại 2026-10-17: ADR-040 — chỉ gian hàng `ACTIVE`
   hiển thị tài liệu — đã commit `36103fb` (deploy ❓), không migration; ADR-041 — Bảng giá CMS + hoàn tiền gói + Hồ sơ — GĐ1 + GĐ2 đã commit
   `7f8360b` (deploy ❓), 2 migration đã áp DB; ADR-042 — sidebar dùng chung System Center + Studio, Đăng xuất đáy sidebar, drawer mobile (hoàn tất
   GĐ2b ADR-041) — đã commit `9d37ab1` (deploy ❓), không migration; tại 2026-10-18: ADR-043 — dashboard Tổng quan gian hàng — đã commit
   `e5d63d0` (deploy ❓), "Bổ sung lần 3" (date range picker, số đầy đủ) xong code chưa commit, không migration; ADR-046 — trang Đơn hàng Studio — xong code chưa commit, không migration, chưa xem UI thật với phiên OWNER; ADR-047 — tìm đơn không dấu + ghi chú nội bộ — xong code chưa commit, migration `order_notes` (tên thư mục giữ số cũ `adr045_…`) đã áp DB; tại 2026-10-22: ADR-044 — MinIO song song R2 — và ADR-045 — Storage Gateway, thêm 1 `route.ts` nội bộ — đã commit `78a9d9c`/`4ab5a3b` (vuong, deploy ❓); ADR-048 — danh sách Khách hàng Studio — xong code chưa commit, không migration, chưa kiểm UI thật (ghi nhận KB 2026-10-23); ADR-050 đợt 1 — CMS menu, trang chủ + SEO, Điều khoản có phiên bản — CMS/logic xong chưa commit, UI Phong đang làm, migration pháp lý đã chạy (ghi nhận KB 2026-10-23); `pnpm test:count` = 95/95 unit, 57/57 integration — **chạm trần mới** (ADR-050 nâng từ 94/55), test mới cần chủ dự án duyệt; 4 integration đang lỗi do dữ liệu dùng chung, chưa xử lý — xem KB-Audit §31).
2. **Quy tắc bất biến:** luôn đối chiếu với `01-Architecture-Decisions/` trước khi đề xuất bất kỳ thay đổi
   kiến trúc nào — đặc biệt ranh giới layer và RLS.
3. **Độ tin cậy:** khi spec trong KB và code/`docs/*.md` gốc xung đột — **code và `docs/*.md` gốc luôn là
   chân lý**, không phải trang KB này.
4. **Từ điển thẻ:** tra cứu ý nghĩa thẻ tại [[Tags-Dictionary]] ([Tags-Dictionary.md](./Tags-Dictionary.md)).

---
tags:
  - meta
  - contract
date: 2026-09-26
updated: 2026-10-23
---

# 🔌 API Contracts & Data Interface

Thư mục này quy định **hợp đồng giao diện dữ liệu** giữa các tầng trong hệ thống Gieo Chữ — nền tảng SaaS đa
tenant nơi giáo viên/coach bán tài liệu số cho học viên.

## Danh mục Hợp đồng

- `[[Endpoint-Directory]]` — Danh bạ 23 route HTTP thật dưới `apps/web/app/api/**` (thêm `GET /api/cron/daily` — ADR-036, `POST /api/reports` — ADR-038, `GET /api/internal/storage/ticket` — ADR-045; đếm 2026-10-22 ✅) + 1 route redirect ngoài `/api` (ADR-030, §5.1) (Auth, tài khoản, storefront
  công khai, upload Studio, downloads/share links, admin, webhooks) kèm cơ chế xác thực và định dạng phản hồi
  lỗi chuẩn (`{ error: { code, message, requestId } }`); §10 ghi contract Server Action của editor sản phẩm Studio
  (`ProductActionState`, field FormData — ADR-026/027); §11 contract ảnh Cloudinary hệ thống
  (`CloudinarySignatureResult`, `registerTenantImageAction`, mã lỗi hạn mức — ADR-028); §12 action/hàm lib đánh giá
  M10a (`upsertMyReviewAction`, action kiểm duyệt Studio, `PublicReview`, mã lỗi `REVIEW_*` — ADR-029); §13 action/hàm lib bài viết M10b (`createPostAction`… `PostActionState`,
  `listPublishedPosts`, mã lỗi `POST_*`, subpath `@gieochu/core/post` — ADR-029); §14 action/hàm lib cấu hình hệ thống
  (`updateSystemSettingsAction`, `updateSupportEmailAction`, `getSystemSettings`, `getEffectiveBrand` — ADR-032) và CMS trang chủ
  (`searchHomeTenantOptionsAction`/`searchHomeProductOptionsAction`, loader `lib/home.ts`, `recomputeProductSoldCounts`,
  `markOrderPaid` trả `productIds` — ADR-033); §15 action/hàm lib CMS Cửa hàng (`saveShopDraftAction`, `publishShopAction`,
  `restoreLiveShopAction`, `searchShopCategoryOptionsAction`, `getShopCmsEditorData`, `listCategoryPinOptions`, `SYSTEM_CMS_SLUGS`,
  subpath `@gieochu/core/shop-sections` — ADR-035 GĐ1); §16 trang công khai `/cua-hang`, `/cua-hang/tai-lieu` (query, SEO) +
  export của loader `apps/web/lib/shop.ts` (`getShopCmsSections`, `getShopProductShelves`, `getTenantSales30d`, `searchShopProducts`,
  `parseShopSearchParams`…) + subpath `@gieochu/core/product-type` — ADR-035 GĐ2, không thêm `route.ts`; §17 route cron
  `GET /api/cron/daily` (Bearer `CRON_SECRET`, 200/401/500 `CRON_STEP_FAILED`/503 `CRON_NOT_CONFIGURED`, `results` chỉ số đếm) — ADR-036,
  đã commit `9a3208f`, deploy ❓; từ M12a thêm bước `audit.purge` (`results.auditPurge`); §18 trang `/admin/audit`, `/studio/{slug}/activity` + loader
  `lib/audit-query.ts`, API ghi `lib/audit.ts`, subpath `@gieochu/core/audit`, chữ ký hàm lib thêm `actorId` (`unlockUser(actor, id)`) —
  ADR-037, không thêm `route.ts`; §19 thống kê M12b — bước cron `stats.aggregate` (`results.statsAggregate`), job
  `lib/tenant-stats.ts`, loader dashboard `getAdminStatsOverview` (`lib/admin-stats.ts`, contract `AdminStatsOverview`), query `?chi-so=` trên
  `/admin` — ADR-037, không thêm `route.ts`; §20 M12c/ADR-039 — **route mới `POST /api/reports`** (Origin, honeypot, 5/giờ/IP, chặn trùng; mã
  lỗi 400/403/404/409/429/503), Server Action `/admin/reports` (`resolveReportAction`, `unlockModerationAction`) và thư viện khách
  (`chooseFinalDownloadAction`, `requestRefundAction`), mã lỗi remedy ở `/api/downloads`, `PRODUCT_UNAVAILABLE` ở checkout, bước cron
  `abuse_report.ip_purge` (`results.reportIpPurge`), subpath `@gieochu/core/abuse-report` + `@gieochu/core/entitlement-remedy` — 23 `route.ts` toàn app.
  §21 ADR-041 (Bảng giá CMS, hoàn tiền gói, Hồ sơ); §22 ADR-043 — loader dashboard Tổng quan gian hàng `getTenantDashboard` (`lib/tenant-dashboard.ts`,
  contract `TenantDashboard`, không email khách) + subpath `@gieochu/core/dashboard-range` (`resolveDashboardRange`, `listDashboardBuckets`),
  query `?ky=`/`?tu=`/`?den=`/`?chi-so=` trên `/studio/{slug}` — không thêm `route.ts` (vẫn 23 toàn app).
  §23 ADR-046 (chưa commit) — loader trang Đơn hàng Studio `listOrdersPage`/`getOrderDetailView` + `parseOrderListQuery`/`buildOrderListSearch`/
  `orderAllowedActions` (`lib/order.ts`), tham số URL `trang-thai`/`remedy`/`q`/`ky`/`san-pham`/`sap-xep`/`trang`/`so-dong` và `?back=` (whitelist),
  quy ước escape Prisma `contains` bằng `escapeContainsValue` (`lib/prisma-contains.ts`) — không thêm `route.ts`/Server Action.
  §23.3–§23.5 ADR-047 (chưa commit) — tìm `q` không dấu bằng SQL thô `gieochu_unaccent(lower(..)) LIKE … ESCAPE '\'`, xoá `listOrders`/`getOrderDetail`,
  ghi chú nội bộ `lib/order-note.ts` + 2 Server Action `addOrderNoteAction`/`deleteOrderNoteAction`, mã lỗi `ORDER_NOTES_UNAVAILABLE` 503 /
  `ORDER_NOTE_NOT_FOUND` 404 / `ORDER_NOTE_FORBIDDEN` 403 — không thêm `route.ts`.
  §24 ADR-048 (chưa commit) — loader trang Khách hàng Studio `listCustomersPage` + `parseCustomerListQuery`/`buildCustomerListSearch`/`updateCustomerNote`
  (`lib/customer-list.ts`), Server Action `saveCustomerNoteAction`, subpath `@gieochu/core/customer-list`; trang Đơn hàng thêm `?khach=` (§23.2) —
  không thêm `route.ts`, không migration (dùng cột có sẵn `tenant_customers.note`).
  §25 ADR-045 (Storage Gateway, vuong — trước đây là §23; đã commit `4ab5a3b`) — **route nội bộ mới `GET /api/internal/storage/ticket`** (chỉ nginx `auth_request` gọi; header `X-Original-URI/Method/Length`;
  204 + `X-Storage-Target` / 403 `STORAGE_TICKET_REJECTED` / 404 khi gateway tắt) — 23 `route.ts` dưới `/api`, 24 toàn app; ghi chú ở §6, §7:
  URL trả về của `downloads/[token]` (302), `share-links/[token]/download` (`{url}`), `uploads/presign`, `uploads/cover-presign` có thể là
  `/_s/<vé>` khi bật Storage Gateway — shape không đổi.
  §3.1 + §26 ADR-050 đợt 1 (chưa commit) — `POST /api/auth/register` thêm `termsVersionId` tuỳ chọn, lỗi 409 `LEGAL_TERMS_CHANGED`, ghi chấp thuận
  Điều khoản trong cùng transaction; Server Action/loader menu header/footer (`saveMenuDraftAction`… `SiteMenuView`), trang chủ (chữ ký đổi
  `(sections, seo)`, `getHomePageContent`, `getHomeCmsEditorData`), văn bản pháp lý (5 action `/admin/cms/phap-ly`, `lib/legal.ts`), subpath
  `@gieochu/core/site-menu`, `/seo`, `/cms-content-guard`, `/legal`, `/brand-token` — không thêm `route.ts` (23 dưới `/api`, 24 toàn app).
- `[[Database-Schema-Reference]]` — Lược đồ 50 model + 33 enum (ADR-050 thêm 3 bảng L1 pháp lý + 2 enum) trong `packages/db/prisma/schema.prisma`, phân
  theo layer L1 (System) / L2 (Tenant, RLS) / L3 (góc nhìn Customer trên bảng L2), cùng quy ước cuid2 (ADR-001),
  mã hoá secret AES-256-GCM (§7.3 CLAUDE.md), và bảng RBAC `Role`/`Permission`/`RolePermission` (ADR-022); §7 ghi RLS tách đọc/ghi 7 bảng, quy tắc bảng L2 mới và mẫu
  trigger giới hạn cột theo scope (ADR-029); migration M10b bảng `posts` (partial unique index ghim, 2 trigger); migration M12a bảng L1 `audit_logs` (chỉ-INSERT: quyền `gieochu_app` + 3 trigger, cờ purge — ADR-037); migration M12b bảng L1 `tenant_daily_stats` (unique `tenantId+date`, FK tenant Cascade, không RLS — ADR-037). Migration M12c bảng L1 `abuse_reports` + khoá kiểm duyệt (trigger `*_guard_moderation`) + cam kết bản quyền (ADR-038); migration ADR-039 cột `entitlements.remedy*` + trigger `entitlements_guard_remedy`; ghi chú sửa lỗi đọc `orders` không scope (email đơn hàng). Migration ADR-041: `VerificationTokenType.EMAIL_CHANGE` + `verification_tokens.newEmail`; `SubscriptionInvoiceStatus.REFUNDED` + bảng L1 `subscription_refund_requests` (3 CHECK, `payoutEncrypted` AES-256-GCM). Migration ADR-047 (thư mục `…_adr045_order_notes` giữ số cũ): bảng L2 `order_notes` (RLS tách theo lệnh chỉ tenant + `system_job`, không UPDATE, CHECK 1–1000 ký tự) — 47 model / 31 enum.

> [!NOTE] Đã xoá `Store-Factory-Architecture.md`
> File này từng mô tả mẫu "Store Factory" (`getXStore()` trừu tượng hoá Prisma Store vs In-Memory Store) —
> **không áp dụng cho Gieo Chữ**. Gieo Chữ không có tầng store/dual-implementation nào: route handler và
> Server Action gọi thẳng `getPrismaClient()` (bảng L1) hoặc `withTenant`/`withCustomer`/`withPublic`/
> `withSystemJob` (`packages/db/src/rls.ts`, bảng L2 có RLS). Không có gì để thay thế file này — quyết định là
> xoá, không viết lại tương đương giả.

*Quay lại: [[MOC-Home]] ([MOC-Home.md](../00-Index/MOC-Home.md))*

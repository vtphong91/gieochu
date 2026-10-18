---
tags:
  - meta
  - contract
date: 2026-09-26
updated: 2026-10-18
---

# 🔌 API Contracts & Data Interface

Thư mục này quy định **hợp đồng giao diện dữ liệu** giữa các tầng trong hệ thống Gieo Chữ — nền tảng SaaS đa
tenant nơi giáo viên/coach bán tài liệu số cho học viên.

## Danh mục Hợp đồng

- `[[Endpoint-Directory]]` — Danh bạ 21 route HTTP thật dưới `apps/web/app/api/**` (thêm `GET /api/cron/daily` — ADR-036) + 1 route redirect ngoài `/api` (ADR-030, §5.1) (Auth, tài khoản, storefront
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
  chưa commit/deploy; từ M12a thêm bước `audit.purge` (`results.auditPurge`); §18 trang `/admin/audit`, `/studio/{slug}/activity` + loader
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
- `[[Database-Schema-Reference]]` — Lược đồ 45 model + 30 enum trong `packages/db/prisma/schema.prisma`, phân
  theo layer L1 (System) / L2 (Tenant, RLS) / L3 (góc nhìn Customer trên bảng L2), cùng quy ước cuid2 (ADR-001),
  mã hoá secret AES-256-GCM (§7.3 CLAUDE.md), và bảng RBAC `Role`/`Permission`/`RolePermission` (ADR-022); §7 ghi RLS tách đọc/ghi 7 bảng, quy tắc bảng L2 mới và mẫu
  trigger giới hạn cột theo scope (ADR-029); migration M10b bảng `posts` (partial unique index ghim, 2 trigger); migration M12a bảng L1 `audit_logs` (chỉ-INSERT: quyền `gieochu_app` + 3 trigger, cờ purge — ADR-037); migration M12b bảng L1 `tenant_daily_stats` (unique `tenantId+date`, FK tenant Cascade, không RLS — ADR-037). Migration M12c bảng L1 `abuse_reports` + khoá kiểm duyệt (trigger `*_guard_moderation`) + cam kết bản quyền (ADR-038); migration ADR-039 cột `entitlements.remedy*` + trigger `entitlements_guard_remedy`; ghi chú sửa lỗi đọc `orders` không scope (email đơn hàng). Migration ADR-041: `VerificationTokenType.EMAIL_CHANGE` + `verification_tokens.newEmail`; `SubscriptionInvoiceStatus.REFUNDED` + bảng L1 `subscription_refund_requests` (3 CHECK, `payoutEncrypted` AES-256-GCM) — 46 model / 31 enum.

> [!NOTE] Đã xoá `Store-Factory-Architecture.md`
> File này từng mô tả mẫu "Store Factory" (`getXStore()` trừu tượng hoá Prisma Store vs In-Memory Store) —
> **không áp dụng cho Gieo Chữ**. Gieo Chữ không có tầng store/dual-implementation nào: route handler và
> Server Action gọi thẳng `getPrismaClient()` (bảng L1) hoặc `withTenant`/`withCustomer`/`withPublic`/
> `withSystemJob` (`packages/db/src/rls.ts`, bảng L2 có RLS). Không có gì để thay thế file này — quyết định là
> xoá, không viết lại tương đương giả.

*Quay lại: [[MOC-Home]] ([MOC-Home.md](../00-Index/MOC-Home.md))*

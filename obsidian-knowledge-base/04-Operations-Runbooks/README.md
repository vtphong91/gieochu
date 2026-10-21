---
tags:
  - meta
  - runbook
date: 2026-09-26
updated: 2026-10-18
---

# 🚀 Operations Runbooks & DevOps

Thư mục này chứa **cẩm nang vận hành, quy trình phát hành/rollback, và chuẩn giao diện dùng chung** cho
Gieo Chữ — SaaS đa tenant **web-only** (Next.js 16 App Router), nơi giáo viên/coach bán học liệu số cho học
viên.

## Danh mục Runbooks:

- `[[Disaster-Recovery-Runbook]]`: Ứng phó sự cố Neon Postgres (Point-in-Time Restore, role `gieochu_app` —
  ADR-010; §4.1 quyền `CREATE` trên database đã `REVOKE` 2026-10-15 — script `setup-app-role` cũng đã `REVOKE` (đính chính 2026-10-16);
  §4.2 extension `unaccent` + hàm `gieochu_unaccent` do migration ADR-035 tạo; §4.3 quyền chỉ-INSERT + 3 trigger của `audit_logs` — M12a,
  ADR-037), sự cố object storage R2/S3-compatible (ADR-017), và quy trình
  rebuild môi trường từ đầu.
- `[[Minio-Storage-Operations-Runbook]]`: Cẩm nang chuyên sâu về lưu trữ MinIO Self-hosted song song Cloudflare R2
  (ADR-038 / ADR-013), cấu hình cổng mạng API (9000) & Console (9001), `useSSL` khi dùng IP vs Domain, triển khai Docker Compose
  và Nginx HTTPS Reverse Proxy, cơ chế Dedicated Bucket cho từng gian hàng (`gc-tenant-{tenantId}`), công cụ đồng bộ dữ liệu
  Stream Copy (Zero-RAM/Disk) R2 ↔ MinIO, xử lý sự cố kết nối/credentials/firewall, và quy trình sao lưu/phục hồi dữ liệu (`mc mirror`).
- `[[Publish-And-Rollback-Runbook]]`: Checklist biến môi trường trước deploy, quy trình phát hành thủ công
  (chưa có CD tự động — chỉ có CI kiểm thử qua `.github/workflows/ci.yml`), và quy trình rollback code/DB
  khẩn cấp; §4.2.1 ghi sự cố 2026-10-15 (drop cột trên DB dùng chung) và quy tắc expand → contract.
- `[[UI-Design-System]]`: Design tokens (màu, font), chuẩn độ rộng layout `container-page/prose/narrow` (ADR-024), giao diện storefront tenant (theme `--sf-*`, primitives, pattern form/editor CMS — ADR-023), bộ component dùng chung `admin/_ui/kit.tsx` và bộ icon
  `admin/_ui/icons.tsx` — dùng chung giữa System Center (`/admin`) và Studio (`/studio/[tenantSlug]`); editor sản phẩm
  Studio 2 cột + card xuất bản đầu sidebar (không dính khi cuộn — ADR-030) + thanh lưu nhanh dưới xl, chế độ hiển thị, trang Xem trước, TiptapEditor
  upload ảnh Cloudinary (ADR-026/027/028, §9); giao diện đánh giá M10a — `ReviewStars`, `ProductReviewsSection`,
  `ReviewComposer`, section Đánh giá storefront, `StudioReviewCard` (ADR-029, §10); giao diện bài viết M10b — Studio → Bài viết, editor bài viết,
  trang hệ thống `/[slug]/posts`, section `posts` storefront, quy tắc sanitize lại khi render HTML (ADR-029, §11); trang chủ dữ liệu thật (thẻ link phủ cả thẻ, định dạng "1.200+", chip danh mục + `<details>` — từ ADR-035 GĐ2 chip/ô tìm trỏ `/cua-hang/tai-lieu`), `PinPicker`, form "Cấu hình chung", menu System Center, a11y kit `TextField`/`SelectField`/`Toggle`/icon (ADR-032/033, §12). Editor CMS Cửa hàng (ADR-035 GĐ1, §13): kit `Notice`, `PinPicker` thêm `copy`/`error`, pattern editor nhiều section (thanh trạng thái dính, con mắt + Lên/Xuống, tóm tắt lỗi nhảy focus, xác nhận khôi phục, `beforeunload`), ô điểm "4,0" ×10, menu "Trang Cửa hàng". Trang Cửa hàng công khai (ADR-035 GĐ2, §14): `catalog-parts`, `DocumentCard`/`TenantCard` dùng chung với trang chủ, `ProductShelf`/`TenantShelf`/`ShelfSection`, `CategoryGrid`, `ShopHero`/`ShopSearchForm`, `ShelfSkeleton`, `ShopEmptyState`/`OpenStoreCta`, trang tìm (sắp xếp, phân trang link thuần), `MobileNav`; header `current` + link "Cửa hàng" (§1.1). Trang nhật ký `/admin/audit` + Studio → Hoạt động (M12a — ADR-037, §15):
  `AuditFilterForm`/`AuditLogResults` (form GET, đủ trạng thái, bảng từ `xl` / thẻ dưới `xl`, chi tiết `<details>`), `LinkPagination`,
  `AuditLogSkeleton`, `DataTable` thêm `caption` + `th scope="col"`, nhóm sidebar "Giám sát". Dashboard `/admin` section "Hoạt động bán tài liệu (30 ngày)" (M12b — ADR-037, §16): 4 KPI + % so kỳ trước (BigInt), biểu đồ cột HTML `role="img"` + bảng trong `<details>`, chọn chỉ số `?chi-so=gmv|don`, top 5 gian hàng, trạng thái unavailable/rỗng/Suspense. Báo cáo vi phạm + khoá kiểm duyệt + quyền lợi người mua (M12c — ADR-038/039, §17): `ReportAbuseButton` (`<dialog>`), `ModerationLockBadge`/`ModerationLockNotice`, `/admin/reports` (lọc, bảng/thẻ, form xử lý), ô cam kết bản quyền, Thư viện `RemedyNotice`/`ConfirmDialog`/`LibraryEntitlementCard`, Studio đơn hàng `RefundRequestBadge`/`OrderItemRemedy`, `TenantNavItem.badge`, `IconFlag`, sửa tương phản chip lọc đơn. Bảng giá CMS + khu vực `/account` + hoàn tiền gói (ADR-041, §18): kit `PrimaryButton`/`GhostButton` 44px dưới `lg`, `PasswordField` a11y + `toggleLabel`, `SortableListEditor`, toggle Tháng/Năm radio, bảng so sánh cuộn trong khung `relative`, app shell `/account` + menu tài khoản disclosure, `/admin/billing/refunds` xác nhận 2 bước. Dashboard Tổng quan gian hàng `/studio/{slug}` (ADR-043, §19): route group `(tong-quan)` + `loading`/`error` riêng, chip kỳ + form khoảng ngày GET, KPI gộp/thực nhận + thẻ phụ, `TrendChart` cột + đường, top 5, 10 đơn mới không email, checklist 3 bước khi chưa có đơn; component chung `admin/_ui/stats-chart.tsx` (`KpiCard`, `ChangeLine`, `computeChange`, `TrendChart`, `RatioBar`, `StatIcon`) — `sales-stats.tsx` `/admin` dùng lại; icon `IconArrowUp/Down`, `IconStarSolid`, `IconGift`. `[[Publish-And-Rollback-Runbook]]` §2.2 có số test hiện tại và quy tắc
  integration test không xoá cấu hình dùng chung (`shared-config-snapshot.ts`).
- `[[Deploy-Vercel-Runbook]]`: Deploy app lên **Vercel** theo ADR-031/032 — cấu hình project (Root Directory `apps/web`,
  `vercel.json` `buildCommand: "next build"`), env runtime **8 biến bắt buộc** + biến cần xoá trên Vercel + biến **không** đặt
  (`PRISMA_MIGRATE_URL`…), chuẩn bị DB prod từ máy dev (`setup-app-role`, `db:migrate`, `db:seed`, quét slug dành riêng),
  cấu hình Admin sau deploy, §6 job nền trong app theo ADR-036 (`after()` + Vercel Cron `/api/cron/daily` 03:00 giờ VN, env tuỳ chọn
  `CRON_SECRET` ≥ 32 ký tự, SQL dọn job `docs/ops/2026-10-16-pgboss-cleanup.sql` do chủ dự án chạy, `worker.ts` không deploy), 5 sự cố đã gặp (gồm 500 production 2026-10-15), rủi ro client
  Prisma commit lệch schema, §9 một DB duy nhất (ADR-034) — migration expand → contract, kỷ luật thao tác DB, dọn demo trước go-live; §9.5 migration Cửa hàng ADR-035 (`unaccent`) đã áp trước deploy + quét slug dành riêng; §9.6 migration Audit log M12a (ADR-037) đã áp
  2026-10-16, quyền chỉ-INSERT, dòng audit do test tạo không xoá được; cron thêm bước `audit.purge` (§6.1); §9.7 migration Thống kê M12b (`tenant_daily_stats`) đã áp 2026-10-16, cron thêm bước `stats.aggregate`, bấm Run cron sau deploy để backfill (§6.2 bước 6); §9.8 migration M12c + ADR-039 đã áp 2026-10-16 — **bắt buộc trước code** (code lên trước → P2022/500), cron thêm bước `abuse_report.ip_purge`, sau deploy email đơn hàng `order_paid`/`new_sale` gửi thật lần đầu, checkout chặn `PRODUCT_UNAVAILABLE`. §9.9 migration ADR-041 (`EMAIL_CHANGE`/`newEmail` — bắt buộc trước code; hoàn tiền gói) đã áp 2026-10-17, deploy được; §7.6 lỗi build `workStore` ở máy dev. Bản ADR-032/033 chưa deploy ❓ ([Deploy-Vercel-Runbook.md](./Deploy-Vercel-Runbook.md)).
- `[[Dev-Demo-Data-Runbook]]`: **Công cụ chỉ cho dev** — script `apps/web/scripts/demo-reviews.ts`
  (`ALLOW_DEMO_SEED=1 pnpm --filter @gieochu/db run demo:seed|demo:clean`): chốt an toàn, dữ liệu demo đánh giá trên tenant
  `phongweb` (3 sản phẩm, 5 khách, 11 đơn FULFILLED, 9 đánh giá), cách nhận diện và dọn
  ([Dev-Demo-Data-Runbook.md](./Dev-Demo-Data-Runbook.md)).

## Phạm vi

KB đã được dọn các tài liệu không thuộc Gieo Chữ. Gieo Chữ **không có ứng dụng mobile nào** (không quy trình nộp
App Store/Google Play, không push notification) nên thư mục này không có runbook mobile. Nếu sau này thêm ứng
dụng mobile (mục "Giai đoạn 4 — Chuyên sâu và mở rộng" trong `docs/PLAN.md` có nhắc "ứng dụng mobile" như một
hướng phát triển xa), viết runbook mới từ đầu dựa trên stack thật được chọn lúc đó.

*Quay lại: [[MOC-Home]] (../00-Index/MOC-Home.md)*

---
tags:
  - archive
  - gieochu
  - backlog
  - history
date: 2026-09-26
---

# Known Gaps and Backlog — Gieo Chữ (tính tới 2026-09-26)

Tóm tắt thật, nguồn duy nhất: [`docs/BACKLOG.md`](../../docs/BACKLOG.md). Đây là những gì **đã biết là thiếu/hoãn**
tính tới ngày dựng lại trang này — không phải danh sách suy diễn.

## Ngoài phạm vi MVP giai đoạn 1 (mục 2.2 đặc tả)

- Tên miền riêng cho tenant (custom domain), subdomain wildcard.
- PDF stamping, watermark.
- **Nhân viên tenant (staff) với phân quyền chi tiết**: schema đã chừa sẵn `role STAFF`; ADR-022 đã thêm lớp
  `Role`/`Permission` (seed sẵn tập quyền khởi đầu cho `TENANT_STAFF`: `tenant:access_studio`,
  `manage_products`, `manage_orders`) nên phần "được làm gì" không còn thiếu về mặt schema — nhưng **vẫn
  chưa có luồng mời staff / tạo row `TenantMember` role STAFF thật, và chưa có UI chỉnh ma trận quyền** — UI
  hiện chỉ dành cho owner.
- Bundle, flash sale theo khung giờ, license nhiều người dùng.
- Affiliate, email marketing, chat.
- Hoàn tiền tự động qua cổng thanh toán (MVP chỉ ghi nhận hoàn tiền thủ công).
- App mobile, tìm kiếm toàn nền tảng, marketplace chung.
- Hoá đơn điện tử.

## Định hướng sau MVP (giai đoạn 2–4, mục 12 đặc tả — tóm tắt)

PDF stamping nâng cao, giỏ hàng nhiều sản phẩm, SePay VA theo đơn, thông báo in-app, affiliate/giới thiệu,
analytics chi tiết, tìm kiếm full-text, custom domain + TLS tự động, theme storefront tuỳ biến, khoá học
video/membership, app mobile, hoá đơn điện tử, đa tiền tệ, partition/backup/giám sát vận hành.

## Gap kỹ thuật theo module (phát sinh trong lúc code, chưa làm)

**Hạ tầng chung**
- Chưa có `neon-proxy` cho dev 100% offline (ADR-004) — hiện khuyến nghị Neon branch miễn phí.
- Chưa quyết định partition `audit_logs` theo tháng — để tới M12.
- `TEST_DATABASE_URL` riêng cho integration test — vẫn dùng chung DB dev (ADR-009).
- Rate limit hiện tại (`apps/web/lib/rate-limit.ts`) chỉ đúng khi chạy 1 instance — cần chuyển sang bảng
  `rate_limits` trên Postgres nếu scale nhiều instance.
- **Route ghi dữ liệu chưa kiểm tra header `Origin`** (mục 7.7 đặc tả) — khoảng trống có từ M5, áp dụng cho
  mọi Route Handler ghi dữ liệu trong dự án (register, login, upload, checkout, coupon, download...) — cần
  một lượt rà soát chung, chưa làm.
- Nhiều route nhạy cảm (upload, webhook, applyCoupon, download) **chưa có rate limit** đầy đủ theo IP.

**M1 — Auth**
- Avatar upload chưa làm (phụ thuộc `packages/storage`/M5 — nay M5 đã xong, có thể nối lại).
- Audit log cho sự kiện `AUTH_LOGIN`, `AUTH_REFRESH_REUSE`... chưa ghi — chờ bảng `audit_logs` (M12).

**M2 — System Admin**
- Platform Payment config UI + Audit log viewer + Báo cáo vi phạm — cố ý hoãn tới sau M7/M12 ("hoàn thiện M2").
- Doanh thu subscription + GMV trên dashboard admin — chờ M12.
- Live-preview block CMS — form hiện chỉ có textarea JSON thô, chưa có preview trực quan theo loại block.

**M3 / M3 v2 — Billing**
- `assertPlanFeature()` đã có nhưng **chưa gate call site cụ thể nào** (coupon/analytics/branding/SEO/
  automation/customDomain) — cần hỏi lại trước khi gate lần đầu.
- MRR/GMV đầy đủ trên `/admin` vẫn chờ M12.
- **`SystemSettings.trialDays` không còn được đọc ở đâu** — `create-tenant.ts` không còn dùng trial (từ khi
  chuyển sang Hybrid Monetization/Free Forever, ADR-021) — cột vẫn còn trong schema, UI `/admin/settings` có
  thể vẫn cho sửa giá trị này dù không còn tác dụng — **chưa dọn**.
- `updatePlanAction` và CRUD `/admin/plans` nói chung chưa có integration test tự động.
- Không có trang admin "danh sách toàn bộ subscription + override thủ công".
- Auto-disable-khi-đổi-cấu-hình (ADR-013) chỉ áp dụng `PlatformPaymentConfig`, chưa áp dụng cho
  `TenantPaymentConfig` (M7).

**M5 — Sản phẩm/File**
- Chưa verify upload thật end-to-end với R2 thật qua trình duyệt (multipart >50MB, file giả mạo đuôi bị từ
  chối thật, `HeadObject` thật).
- 1 integration test M5 còn thiếu: "`complete` ghi `product_files` và enqueue job quét" (cần bucket thật).
- `unpublishProduct()` chưa kiểm tra "chưa có đơn" trước khi cho gỡ sản phẩm (dễ hoàn thành: đếm `OrderItem`).
- ClamAV thật chưa tích hợp (ADR-018).
- 4 route upload chưa có rate limit.
- `docker-compose.yml`'s MinIO service không còn được app đọc tới (từ khi chuyển sang ADR-017) — có thể dọn.

**M6 — Giá/Coupon**
- Trang Studio coupon chưa có nút xoá (chỉ tạo/sửa/bật-tắt).
- `COUPON_OVERUSED` chưa ghi audit log thật — chỉ có `logger.warn`, chờ M12.

**M8 — Checkout/Đơn hàng**
- Webhook M3 (Platform) và M8 (Tenant) xử lý khác kiểu, chưa đồng bộ (xem ADR-019) — cố ý không sửa M3 để
  tránh đụng module đã ổn định.
- Chưa có luồng upload "ảnh biên lai" (`proofImageKey`) — cột đã có, chưa có UI/API.
- Chưa verify luồng mua hàng thật qua trình duyệt (cần R2 + provider thanh toán thật đã cấu hình).
- Dashboard tenant: ô "Sản phẩm bán chạy"/"Đánh giá mới" vẫn ghi "Cần M5/M6"/"Cần M10".
- Trang `/studio/[tenantSlug]/customers` thiếu: UI đọc/ghi `TenantCustomer.note`, link sang đơn của khách đó,
  nút xuất CSV — đặc tả M8 có yêu cầu nhưng bị bỏ sót lúc viết `docs/modules/M8.md`.

**M9 — Thư viện/Tải xuống/Share link**
- Chưa test/chạy thật qua trình duyệt (tải trong `/account/library`, mở `/s/{token}` thật).
- `grantExtraDownloads`/`revokeEntitlement` chưa ghi audit — chờ M12.
- 4 route/action M9 chưa có rate limit theo IP (chỉ có theo user/token) và chưa kiểm tra `Origin`.
- `/s/[token]` không giới hạn tần suất thử mật khẩu theo IP, chỉ theo token.
- Chưa có UI xem thống kê chi tiết theo share link (dữ liệu `downloadEvents` đã có, chỉ thiếu trang).

**Storefront CMS (ADR-023) + chuẩn layout (ADR-024) — 2026-09-26** (chi tiết đầy đủ: mục cùng tên trong
[`docs/BACKLOG.md`](../../docs/BACKLOG.md), nguồn chính)
- Chưa có test cho schema section, quyền sửa, RLS `storefront_messages` (ngân sách `test:count` chờ duyệt).
- Rate limit form liên hệ vẫn in-memory; giới hạn 2MB ảnh chỉ kiểm ở trình duyệt (chưa có upload preset).
- ~~Chính sách tự xoá tin nhắn cũ~~ — đã quyết 2026-09-26: **không tự xoá** (giữ tới khi tenant xoá tay hoặc tenant
  bị xoá — FK cascade; xem lại nếu có yêu cầu pháp lý), xem ADR-023.
- CSP `img-src` chưa cho host storage public (ảnh bìa sản phẩm); chưa có luồng upload `Tenant.logoKey/coverKey`.
- Thiếu trang `/[tenantSlug]/products`, ~~menu mobile Studio~~ (xong 2026-10-17, ADR-042), skip-link + nav thật ở trang chủ; chưa verify trang
  sản phẩm/checkout với dữ liệu thật.

**Tách header/footer hệ thống (ADR-025) — 2026-09-26** (chi tiết đầy đủ: mục cùng tên trong
[`docs/BACKLOG.md`](../../docs/BACKLOG.md), nguồn chính)
- `/pricing` và `/p/[slug]` chưa chuyển sang `SiteHeader`/`SiteFooter` (gộp mục cũ "header/footer `/pricing`" và
  "logo hard-code chữ G ở `/p/[slug]`").
- Footer hệ thống ghi năm © cố định; `SiteHeader` truy vấn tên người dùng ở mọi trang public khi đã đăng nhập.
- Ưu tiên thấp: gộp `next/font` của `(auth)`/`admin`/`studio` về `app/_ui/system-fonts.ts` khi có task chạm tới.
- ~~`StorefrontNotice` READ_ONLY ở trang sản phẩm~~ — bỏ theo ADR-025 (trang sản phẩm là trang hệ thống; READ_ONLY
  xử lý trong khối mua theo logic M8).

## Bug thật đã phát hiện và đã sửa (ghi lại để nhớ, không phải gap còn mở)

- Seed admin thiếu bản ghi `UserProfile` (chỉ set `profileCompletedAt`) — đã sửa bằng `upsert`.
- CSP tĩnh chặn hydrate React, lộ mật khẩu lên URL khi submit form — đã sửa bằng CSP nonce động trong
  `proxy.ts` (ADR-016).
- `requireTenantMember` từng query không qua `withTenant`, khiến RLS lọc rỗng kể cả owner hợp lệ (M4).
- `/admin` và 2 trang `/studio/[tenantSlug]/*` từng trả 500 vì Server Component gọi thẳng guard ném lỗi thay
  vì guard chuyển hướng (M2) — bài học: Server Component không được gọi thẳng `requireUser()`/`requireRole()`.
- 3 lỗ hổng RLS ở M9 (`products`/`product_files` thiếu nhánh "customer", `consumeShareLinkDownload()` bỏ
  sót `withPublic()`) — phát hiện và sửa ngay trong lúc viết integration test thật trên Neon (ADR-020).
- `payment-process.ts` (M8) dùng `getPrismaClient()` trần thay vì `withTenant` cho 2 bảng L2 có RLS — 3/9
  integration test đầu fail đúng vào lỗi này, đã sửa.
- Layout Studio truyền component icon (hàm) từ Server sang Client Component → mọi `/studio/*` trả 500 (🟡 theo báo
  cáo) — đã sửa bằng cách truyền key chuỗi (✅ đọc code, xem `UI-Design-System` §8.5).

*Xem thêm: [[Module-Build-History]] · [[Architecture-Decisions-Timeline]]*
*Quay lại: [[05-Historical-Archive/README|05-Historical-Archive]] · [[MOC-Home]] (../00-Index/MOC-Home.md)*

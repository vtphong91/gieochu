# PLAN — Gieo Chữ MVP Giai đoạn 1

Nguồn: [GIEOCHU_PROMPT_MVP_PHASE1.md](GIEOCHU_PROMPT_MVP_PHASE1.md). Cập nhật file này sau mỗi module.

## Thứ tự triển khai thực tế

Theo gợi ý ở mục 10 của đặc tả:

M0 → M1 (kèm khung email M11) → M4 → M2 (phần cơ bản) → M7 → M3 → M5 → M6 → M8 → M9 → M3 v2 (Hybrid
Monetization, xen giữa theo yêu cầu người dùng) → M10 (tách M10a Đánh giá → M10b Bài viết theo ADR-029; M10c sang
BACKLOG) → M12 → hoàn thiện M2.

## Trạng thái module

| # | Module | Trạng thái | File chính | Test (unit/integration) |
|---|---|---|---|---|
| M0 | Nền móng dự án | ✅ Xong (bản đầu) | monorepo root, `packages/config`, `packages/core`, `packages/db` (schema tối thiểu), `docker/`, `apps/web` (shell) | 4 / 0 |
| M1 | Xác thực và định danh | ✅ Xong | `packages/auth`, `packages/email`, `packages/jobs`, `apps/web/app/(auth)`, `apps/web/app/account`, `apps/web/lib` | 16 / 8 |
| M4 | Tenant Workspace và Storefront | ✅ Xong | `apps/web/app/[tenantSlug]`, `apps/web/app/studio`, `packages/db/src/rls.ts` | 6 / 5 |
| M2 | System Admin (cơ bản) | ✅ Xong (cơ bản — Platform Payment UI xong ở M3; audit log viewer `/admin/audit` xong ở M12a — ADR-037; báo cáo vi phạm `/admin/reports` xong code ở M12c — ADR-038) | `apps/web/app/admin`, `packages/core/src/admin` | 4 / 4 |
| M7 | Cấu hình Tenant Payment | ✅ Xong | `packages/payments` | 10 / 4 |
| M3 | Billing, Subscription & Entitlements (v2 — Hybrid Monetization) | ✅ Xong | `apps/web/lib/subscription-billing.ts`, `subscription-sweep.ts`, `platform-payment.ts`, `packages/core/src/billing` | 11 / 7 |
| M5 | Sản phẩm và File tài liệu | 🟡 Code xong (CRUD + upload/presign/file.scan) — chờ verify với R2 thật | `packages/storage`, `apps/web/lib/{product,product-upload,file-scan}.ts` | 6 / 3 (+1 chờ storage thật) |
| M6 | Giá và Khuyến mãi | ✅ Xong — test integration hoãn đã hoàn thành ở M8 | `packages/core/src/pricing`, `apps/web/lib/coupon.ts` | 14 / 1 (+1 tính trong M8) |
| M8 | Checkout và Đơn hàng | ✅ Xong | `apps/web/lib/{order,payment-process}.ts`, `packages/core/src/order` | 10 / 9 |
| M9 | Thư viện, Tải xuống, Share link | ✅ Xong | `apps/web/lib/{download,share-link,library,entitlement}.ts`, `packages/core/src/download` | 7 / 5 |
| M10 | Social Feed và Đánh giá (tách theo ADR-029) | 🟡 **GĐ1 hoàn tất code** (nợ test): **M10a Đánh giá: xong code** (verify thủ công) · **M10b Bài viết tối giản: xong code** (verify thủ công) · M10c (bình luận/thả tim/theo dõi): chuyển `docs/BACKLOG.md` | M10a: `apps/web/lib/review.ts`, `packages/core/src/review`, `apps/web/app/studio/[tenantSlug]/reviews`; M10b: `apps/web/lib/post.ts`, `packages/core/src/content/post.ts`, `apps/web/app/studio/[tenantSlug]/posts`, `apps/web/app/[tenantSlug]/posts` | 4 / 3 (ngân sách gốc — chưa dùng, ADR-029 chọn chưa thêm test) |
| M11 | Email và Background Jobs | 🟡 Email gửi đồng bộ (`sendEmailNow`); **job nền theo ADR-036: xong code, chưa commit/deploy** — `after()` drain hàng đợi trong route + Vercel Cron hằng ngày `GET /api/cron/daily`, `worker.ts` chỉ còn cho local | `packages/jobs`, `packages/email`, `apps/web/lib/{jobs,job-handlers,job-runner}.ts`, `apps/web/app/api/cron/daily`, `apps/web/worker.ts` | 0 / 0 (tính trong module khác) |
| M12 | Audit Log, Thống kê, Báo cáo vi phạm (chia 3 đợt theo ADR-037) | 🟡 **Xong code cả 3 đợt — chờ commit/deploy** (M12a Audit log, M12b Thống kê, M12c Báo cáo vi phạm + quyền lợi người mua ADR-038/039; 4 migration đã áp DB 2026-10-16 — M12c/ADR-039 phải áp **trước** khi deploy code) | M12a: `packages/core/src/audit`, `apps/web/lib/{audit,audit-query}.ts`, `apps/web/app/admin/audit`, `apps/web/app/studio/[tenantSlug]/activity`; M12b: `apps/web/lib/{tenant-stats,admin-stats}.ts`, `apps/web/app/admin/_ui/sales-stats.tsx`, `apps/web/app/admin/page.tsx`; M12c: `packages/core/src/report`, `packages/core/src/download/entitlement-remedy.ts`, `apps/web/lib/{abuse-report,entitlement-remedy,moderation,tenant-lock,origin-guard}.ts`, `apps/web/app/api/reports`, `apps/web/app/admin/reports`, `apps/web/app/account/library` | 2 / 2 (M12a `audit.test.ts`, M12b `stats.test.ts`) |
| | **Tổng** | | | Trần gốc mục 9: **91 / 50** · trần hiện **94 / 55** (ADR-026 + ADR-037 mục 6) · thực **93 / 53** (`pnpm test:count` 2026-10-16). Cộng cột theo module ra 92 / 51 — cột là ngân sách gốc từng module, không phải số thực |

## M0 — Việc đã làm (bản đầu, xem docs/modules/M0.md để có sơ đồ)

- Monorepo: `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`, scripts root
  (`dev/build/lint/typecheck/test/test:unit/test:integration/db:migrate/db:seed/test:count`).
- `packages/config`: `env.ts` (zod, fail-fast, 2 test), `brand.ts`, ESLint preset dùng chung
  (`eslint-preset.mjs`, gồm rule cấm import `@prisma/client` trần).
- `packages/core`: `errors.ts` (`AppError`, mã lỗi, `toHttpError`, 1 test), `logger.ts` (pino + redact, 1 test).
- `packages/db`: `schema.prisma` (model `User`, `Plan`, `CmsPage` — tối thiểu đủ cho seed M0; mở rộng dần theo
  module), `prisma.config.ts` (CLI dùng `DIRECT_URL`), `client.ts` (`@prisma/adapter-neon` + `DATABASE_URL`),
  `prisma/seed.ts` (1 system admin, 3 plan, 1 trang CMS home).
- `packages/auth`, `packages/payments`, `packages/storage`, `packages/email`, `packages/jobs`: skeleton
  package.json/tsconfig/eslint + `src/index.ts` placeholder ghi rõ module sẽ triển khai.
- `apps/web`: Next.js 16 App Router, `proxy.ts` (gắn `x-request-id`), trang chủ marketing tối giản đọc brand
  từ config, Tailwind 4, `next.config.ts` (CSP/security headers), `vitest.config.ts`
  (`passWithNoTests: true` — M0 có 0 integration test).
- `docker/docker-compose.yml`: MinIO (+ job tạo 2 bucket), Mailpit, Postgres 16 (`profile: local-db`).
- CI: `.github/workflows/ci.yml` (install → lint → typecheck → unit → integration).
- `docs/`: `ARCHITECTURE.md`, `DECISIONS.md`, `BACKLOG.md`, `modules/M0.md`.

**Đã xác minh chạy được trong phiên này:**

- `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm test:count` — tất cả xanh
  (9 package/app, 4/4 unit test đúng mục 9, 0/0 integration).
- `pnpm dev` khởi động thật, `curl http://localhost:3000/` trả về trang chủ đúng brand + CSP/security headers
  + `x-request-id` từ `proxy.ts`. Dùng `.env` với `DATABASE_URL`/`DIRECT_URL` **placeholder** (chưa trỏ DB
  thật) — đủ để build/dev vì trang chủ M0 chưa query DB.

**Chưa làm được trong phiên này (cần môi trường thật):**

- Chưa chạy `prisma migrate dev` để sinh migration SQL đầu tiên thật — cần `DATABASE_URL`/`DIRECT_URL` trỏ
  tới một Neon branch thật (hoặc Postgres qua Neon local proxy), và chưa chạy `pnpm db:seed` thật. Xem
  `docs/DECISIONS.md` ADR-004.
- CI GitHub Actions chưa chạy thật (chưa có remote git repo / chưa push).
- Chưa test `docker compose up` (MinIO/Mailpit) thật trong phiên này.

## M1 — Việc đã làm (xem docs/modules/M1.md để có sơ đồ và danh sách test đầy đủ)

- `packages/auth` triển khai đầy đủ (mật khẩu, JWT access token, refresh/verification token, RBAC, chuẩn hoá
  email, kiểm tra hồ sơ) — 16/16 unit test.
- `packages/db`: thêm `UserProfile`, `RefreshToken`, `VerificationToken` (migration `20260917120846_m1_auth`,
  chạy thật trên Neon — dùng `DATABASE_URL`/`DIRECT_URL` thật người dùng cung cấp).
- `packages/email` + `packages/jobs`: khung M11 tối thiểu đủ cho M1 (SMTP/Resend sender, pg-boss queue qua
  `DIRECT_URL` — ADR-007), `apps/web/worker.ts` xử lý job `email.send`.
- 9 API route xác thực + trang `/register /login /verify-email /forgot-password /reset-password
  /account/profile /account/security /account/library` (stub).
- 8/8 integration test chạy thật trên Neon (không mock DB), gọi route handler trực tiếp — xem ADR-009.
- Đã `git init`, push lên `https://github.com/vtphong91/gieochu`.

**Đã xác minh chạy được trong phiên này:** `pnpm lint/typecheck/test/build` xanh toàn bộ; `pnpm dev` +
`curl` xác nhận luồng đăng ký thật (job vào `pgboss.job`) và redirect gate hồ sơ (307 → `/login?next=...`)
hoạt động đúng trên server thật.

**Chưa làm/chưa xác minh:**

- Chưa chạy `docker compose up` / `pnpm worker` thật để xác nhận email thực sự tới Mailpit.
- `TEST_DATABASE_URL` riêng cho integration test chưa có (ADR-009) — đang dùng chung DB dev, tự dọn dữ liệu.
- Avatar upload (nhắc ở mục M1 "đổi avatar") chưa làm — phụ thuộc `packages/storage` (M5).
- Audit log cho các sự kiện M1 (`AUTH_LOGIN`, `AUTH_REFRESH_REUSE`, ...) chưa ghi — bảng `audit_logs` thuộc
  M12, sẽ nối lại khi làm M12. *(Đã nối ở M12a, 2026-10-16 — ADR-037.)*

## M4 — Việc đã làm (xem docs/modules/M4.md để có sơ đồ và danh sách test đầy đủ)

- Schema: `Tenant`, `TenantMember`, `TenantSlugHistory`, `Subscription` (tối thiểu — forward-declare M3),
  `Product` (tối thiểu — forward-declare M5). Migration `20260917232857_m4_tenant` +
  `20260917232925_rls_m4` (RLS thủ công cho `products`/`tenant_members`).
- **Phát hiện quan trọng**: role Neon mặc định `neondb_owner` có `BYPASSRLS`, khiến RLS vô hiệu với kết nối
  app. Đã dừng lại hỏi người dùng (mục 0.6, ảnh hưởng bảo mật) → tạo role `gieochu_app` riêng, không
  bypass RLS. Tách `PRISMA_MIGRATE_URL` (owner, CLI) khỏi `DATABASE_URL`/`DIRECT_URL` (app role). Xem
  ADR-010.
- `packages/db/src/rls.ts`: `withTenant/withCustomer/withPublic/withSystemJob` — dùng thật, không chỉ khai
  báo. Việc bật RLS thật đã bắt được 2 bug thật (insert tenant_member lúc onboarding thiếu scope;
  `requireTenantMember` từng tự chặn nhầm owner hợp lệ) — sửa ngay trong phiên này.
- `packages/core/src/tenant/*`: slug, order-code-prefix, branding, access-policy, membership — 6/6 unit test.
- Trang `/studio` (onboarding), `/studio/[tenantSlug]` (dashboard), `/studio/[tenantSlug]/settings`
  (thương hiệu + đổi slug), `/[tenantSlug]` (storefront công khai) — 5/5 integration test chạy thật trên
  Neon với RLS thật.

**Đã xác minh chạy được trong phiên này:** `pnpm lint/typecheck/test/build` xanh toàn bộ (26/91 unit,
13/50 integration cộng dồn); `pnpm dev` + `curl` xác nhận `/studio` chưa đăng nhập → 307, slug không tồn
tại → 404, storefront tenant thật render đúng.

**Chưa làm/chưa xác minh:** UI onboarding/settings qua trình duyệt thật (chỉ qua curl + test gọi thẳng
hàm); `docker compose up` cho MinIO/Mailpit vẫn chưa test trong phiên này.

## M2 — Việc đã làm (cơ bản — xem docs/modules/M2.md để có sơ đồ và danh sách test đầy đủ)

- Schema: `User.isSuperAdmin`, `SystemSettings` (singleton) — migration `20260918000236_m2_admin`.
  `SystemSettings.trialDays` giờ là nguồn thật cho M4's tạo tenant (env `TRIAL_DAYS` chỉ còn là seed default).
- `packages/core/src/admin/*`: quyết định khoá user, validate gói, validate block CMS, mapper dashboard —
  4/4 unit test.
- Trang `/admin` (dashboard), `/admin/users`, `/admin/tenants`, `/admin/plans`, `/admin/cms`,
  `/admin/settings`; trang công khai `/pricing`, `/p/[slug]`. **Chưa làm**: Platform Payment config, audit log
  viewer, báo cáo vi phạm — chờ M7/M12 theo đúng thứ tự mục 10 ("hoàn thiện M2" ở cuối). *(Cập nhật 2026-10-16: audit log viewer
  `/admin/audit` xong ở M12a — ADR-037; báo cáo vi phạm xong code ở M12c — ADR-038, 2026-10-16.)*
- **Bug tự bắt được khi smoke-test thật** (không phải qua unit/integration test): `/admin` trả 500 vì dùng
  nhầm guard ném lỗi (`requireRole`, đúng cho API/Action) trong Server Component thay vì guard chuyển hướng.
  Sửa bằng `requireAdminAccess()`/`requireTenantMemberPage()` mới trong `lib/page-guards.ts`, đồng thời vá
  luôn 2 trang `/studio/[tenantSlug]/*` từ M4 bị lỗi tương tự. Đã xác minh lại bằng đăng nhập thật (super
  admin → 200, user thường → 404, chưa đăng nhập → 307).

**Đã xác minh chạy được trong phiên này:** `pnpm lint/typecheck/test/build` xanh toàn bộ (30/91 unit, 17/50
integration cộng dồn); đăng nhập thật qua `curl` với user seed super admin xem `/admin` thật, và với user
thường xác nhận bị 404.

## M7 — Việc đã làm (xem docs/modules/M7.md để có sơ đồ và danh sách test đầy đủ)

- Trước khi code, hỏi lại người dùng về phạm vi test webhook tenant-vs-platform (ảnh hưởng cấu trúc dữ liệu
  thanh toán) → tạo bảng `platform_payment_configs` tối thiểu sớm ở M7 thay vì đợi M3 (ADR-011).
- `packages/payments`: `PaymentProvider` interface dùng chung Platform/Tenant, 3 provider (MANUAL_QR, SEPAY,
  MOMO), mã hoá AES-256-GCM, VietQR EMVCo + CRC16 — 10/10 unit test.
- **Phát hiện khi xác minh tài liệu (mục 0.7)**: một mẫu payload VietQR tham khảo từ bên thứ 3 có lỗi lệch 1
  ký tự nội bộ (phát hiện bằng script tự phân tích lại, không phải bằng mắt) — không dùng mẫu đó, tự dựng
  test vector từ thuật toán CRC chuẩn quốc tế đã xác minh độc lập (ADR-012).
- Schema: `TenantPaymentConfig` (RLS), `PlatformPaymentConfig` (bảng trống), `WebhookEvent` (idempotency),
  `BankBin` (seed 19 ngân hàng NAPAS).
- Trang `/studio/[tenantSlug]/settings/payments`, route `POST /api/webhooks/tenants/[tenantId]/[provider]`
  (verify chữ ký + ghi idempotent, dừng lại — khớp Order thuộc M8).

**Đã xác minh chạy được trong phiên này:** `pnpm lint/typecheck/test/build` xanh toàn bộ (40/91 unit, 21/50
integration cộng dồn); `curl` xác nhận trang cấu hình thanh toán chưa đăng nhập → 307, webhook tới tenant
chưa cấu hình → 404.

## M3 — Việc đã làm (xem docs/modules/M3.md để có sơ đồ và danh sách test đầy đủ)

- Trước khi code, đối chiếu với báo cáo kỹ thuật payment của một hệ thống khác do người dùng cung cấp
  (TaniGos, đã chạy production) — áp dụng 2 pattern an toàn không mâu thuẫn đặc tả (dedupe hoá đơn PENDING,
  tự tắt `PlatformPaymentConfig` khi đổi tài khoản/secret — ADR-013), giữ nguyên theo đặc tả Gieo Chữ ở những
  điểm khác biệt cố ý (không proration, sweep qua pg-boss cron in-process thay vì HTTP cron).
- `packages/core/src/billing`: tính kỳ (tháng/năm, clamp cuối tháng), mã hoá đơn, máy trạng thái subscription
  (ném lỗi khi chuyển sai), kiểm tra giới hạn gói — 10/10 unit test.
- Schema: `SubscriptionInvoice`, `PlatformPaymentTransaction` (cả hai L1, không RLS — như `Subscription`),
  `Subscription.periodEndReminderStage`.
- `apps/web/lib`: `platform-payment.ts`, `subscription-billing.ts` (tạo hoá đơn + áp dụng thanh toán),
  `subscription-sweep.ts` (job hằng giờ), `tenant-write-guard.ts`.
- Trang `/studio/[tenantSlug]/billing`, `/admin/billing/payment`, `/admin/billing/invoices`; route
  `POST /api/webhooks/platform/[provider]`; job `subscription.sweep` đăng ký cron qua `packages/jobs`
  (thêm `JobQueue.schedule()`).

**Đã xác minh chạy được trong phiên này:** `pnpm lint/typecheck/test/build` xanh toàn bộ (50/91 unit, 26/50
integration cộng dồn); `curl` xác nhận `/studio/.../billing` và `/admin/billing/*` chưa đăng nhập → 307,
webhook platform SePay/MoMo chưa cấu hình → 404, MANUAL_QR → 404 (không có webhook).

## M3 v2 — Hybrid Monetization: Free Forever + Paid Subscription (thay cho Subscription-first)

Người dùng cung cấp `docs/GIEOCHU_HYBRID_MONETIZATION_BILLING_PROPOSAL_V2.md` — báo cáo đề xuất đổi mô hình
billing: mọi tenant mới không còn vào `TRIALING` (trial đếm ngày, hết hạn → `READ_ONLY`), mà vào thẳng gói
**FREE thật, bán được, không bao giờ hết hạn**; trả phí chỉ để mở rộng capacity/tính năng. Đã đọc báo cáo,
nêu ý kiến, và triển khai theo 3 quyết định người dùng chốt (xem ADR-021 để có đầy đủ lý do + những chỗ thu
gọn kiến trúc so với đề xuất gốc — không thêm bảng `billing_accounts`/`usage_meters`/`billing_events`).

- M3 đổi tên thành **"Billing, Subscription & Entitlements"** theo đúng đề xuất báo cáo §15.
- `Plan` thêm `isFree`/`features` (Json) — mọi số liệu/tính năng từng gói **customize được qua
  `/admin/plans`** (đã thêm `updatePlanAction` — trước đây chỉ tạo mới/bật-tắt, chưa sửa được).
- `packages/core/src/billing/feature-gate.ts`: `canUsePlanFeature()` — business logic đọc `plan.features`,
  không bao giờ đọc `plan.code` (đúng nguyên tắc entitlement-vs-plan-name của báo cáo) — 1 unit test mới.
- `create-tenant.ts`: tenant mới nhận thẳng gói `isFree:true` (không còn `TRIALING`/`TRIAL_DAYS`).
- `subscription-sweep.ts`: loại Free khỏi mọi truy vấn sweep (`plan: {isFree: false}`); GRACE/CANCELED kết
  thúc → **downgrade thẳng về Free** (`planId` đổi, `status: ACTIVE`) thay vì `EXPIRED` + tenant `READ_ONLY`
  — `READ_ONLY` giờ chỉ còn dùng cho moderation/khoá thủ công, không còn là hệ quả billing.
- Seed 4 gói: FREE / CREATOR / PRO / BUSINESS (số liệu tham khảo báo cáo §5, admin sửa lại được).
- `/pricing` (4 cột + danh sách tính năng), `/studio/.../billing` (progress bar sản phẩm/dung lượng, cảnh
  báo ngưỡng 80%, bỏ nhãn "Đang dùng thử"), `/admin` (tách đếm tenant Free/Paid).
- 2 integration test cũ (`tenant.test.ts`, `subscription-billing.test.ts`) sửa assertion từ `TRIALING` sang
  `ACTIVE + plan.isFree`; sweep test viết lại hoàn toàn theo hành vi downgrade mới; thêm 2 integration test
  mới (Free chặn đúng giới hạn sản phẩm, upgrade Free→Paid tính kỳ mới từ lúc thanh toán).

**Đã xác minh chạy được trong phiên này:** `pnpm lint/typecheck/test/build` xanh toàn bộ (88/91 unit, 46/50
integration cộng dồn); seed lại DB thật trên Neon, xoá 3 plan cũ (`STARTER`/`PRO_MONTHLY`/`PRO_YEARLY`, xác
nhận không còn subscription nào tham chiếu trước khi xoá). **Chưa làm** (đúng phạm vi đã thống nhất):
transaction fee, split payment, proration, usage billing theo API, `billing_accounts`/`usage_meters`/
`billing_events`, MRR/GMV đầy đủ (vẫn chờ M12), gate tính năng cụ thể (coupon/analytics/...) qua
`assertPlanFeature()` — hàm đã có, chưa gọi ở call site nào.

## M5 — Việc đã làm, phần 1 (xem docs/modules/M5.md để có sơ đồ và danh sách test đầy đủ)

- Máy đang code không có Docker (không chạy được MinIO local) → hỏi người dùng trước khi làm — quyết định
  chia M5 làm 2: phần metadata/CRUD (không cần storage thật) làm ngay, phần upload/storage thật (Cloudflare
  R2, không dùng Docker) làm sau như module riêng (ADR-014).
- Schema: `Product` mở rộng đầy đủ (description/type/coverImageKey/tags/giá/downloadLimit — `0` = không giới
  hạn, ADR-015), `ProductFile` mới (L2, RLS, `removedAt` soft-hide — không bao giờ xoá object khi owner ẩn
  file).
- `packages/storage` (từ khung rỗng): `file-format.ts`, `object-key.ts` — 2 hàm thuần, không cần storage
  thật.
- `packages/core/src/product`: `suggestSlug`, `canPublishProduct`, `applyStorageDelta` — 6/6 unit test M5
  hoàn thành (bao gồm tái dùng `isWithinPlanLimit("fileSize", ...)` đã xây ở M3).
- `apps/web/lib/plan-limits.ts`: `assertPlanLimit()` — wrapper DB thật M3 đã hoãn, giờ xây xong.
- `apps/web/lib/product.ts` + trang Studio `/products`, `/products/new`, `/products/[id]` — CRUD đầy đủ,
  4 hàm chuyển trạng thái đúng sơ đồ đặc tả.

**Đã xác minh chạy được trong phiên này:** `pnpm lint/typecheck/test/build` xanh toàn bộ (56/91 unit, 28/50
integration cộng dồn); `curl` xác nhận các trang Studio sản phẩm chưa đăng nhập → 307. **Chưa verify được**:
"upload file lớn qua multipart", "file giả mạo đuôi bị từ chối" (nghiệm thu gốc M5) — thuộc phần hoãn lại.

## M5 — Hạ tầng cấu hình upload ở System Admin (thay đổi hướng so với ADR-014)

Người dùng yêu cầu tường minh chuyển cấu hình storage (endpoint/bucket/access key R2) sang quản lý qua
System Admin thay vì biến môi trường tĩnh — đã trình bày đánh đổi bảo mật trước khi làm (ADR-017).

- Bảng `SystemStorageConfig` (1 dòng, mã hoá `encryptedSecrets` bằng `STORAGE_ENCRYPTION_KEY` riêng — không
  dùng chung `PAYMENT_ENCRYPTION_KEY`), cùng pattern tự tắt khi đổi credential như `PlatformPaymentConfig`.
- Refactor: `encryptSecret`/`decryptSecret`/`maskSecret` chuyển từ `packages/payments` sang
  `packages/core/src/crypto/` (dùng chung được, không còn gắn riêng với thanh toán).
- `packages/storage`: `s3-client.ts` (`createS3Client`), `connection-test.ts` (`testS3Connection` — gọi
  `HeadBucketCommand` thật).
- `apps/web/lib/system-storage.ts` + trang `/admin/settings/storage` (form + nút "Kiểm tra kết nối").
- 7 biến `S3_*` cũ xoá khỏi `env.ts` (không còn ai đọc trực tiếp).

**Chưa thêm test tự động** (giữ đúng kỷ luật không đổi số lượng test mục 9 nếu chưa hỏi — đây là hạ tầng mới
ngoài phạm vi bảng gốc) — verify bằng tay: `pnpm lint/typecheck/test/build` xanh (56/91 unit, 28/50
integration — không đổi), `curl` xác nhận `/admin/settings/storage` chưa đăng nhập → 307. Việc nhập credential
R2 thật + bấm "Kiểm tra kết nối" cần người dùng tự làm qua trình duyệt (chưa verify được từ phía tôi).

## M5 — Hoàn thiện luồng upload thật (presign/complete/file.scan)

Sau khi có hạ tầng cấu hình ở trên, làm tiếp toàn bộ phần upload M5 từng hoãn ở ADR-014.

- `packages/storage`: `presign.ts` (PUT đơn ≤50MB, multipart part 10MB cho file lớn hơn — trả thêm
  `partSizeBytes` để client chia file đúng khớp), `scan.ts` (`readObjectForScan` — stream 1 lần vừa hash
  sha256 vừa lấy đầu file nhận diện magic bytes, không buffer cả file).
- `apps/web/lib/product-upload.ts` (file bán — bucket private, có `file.scan`) và
  `presignCoverImageUpload`/`completeCoverImageUpload` (ảnh bìa — bucket public, không `file.scan`, không
  tính vào `storageUsedBytes`).
- `apps/web/lib/file-scan.ts`: không có ClamAV thật → luôn `CLEAN` sau khi qua kiểm tra định dạng, ghi log
  cảnh báo nếu có set `CLAMAV_HOST` (ADR-018). Sai định dạng → xoá object + `REJECTED` + trừ dung lượng +
  email báo owner.
- 4 route `POST /api/studio/[tenantSlug]/uploads/{presign,complete,cover-presign,cover-complete}`, job
  `file.scan` đăng ký trong `worker.ts`.
- UI Studio: `UploadFileForm` (chọn file → presign → PUT thẳng lên S3 → complete → refresh), `CoverImageUpload`
  tương tự cho ảnh bìa.
- Hoàn thành thêm 1 integration test M5 gốc: "Presign chỉ trả URL cho owner của tenant" (dùng
  `SystemStorageConfig` giả — presign đơn là ký chữ ký thuần, không gọi mạng thật nên test được mà không cần
  R2 thật). Còn 1 test cuối ("`complete` ghi `product_files`") cần `HeadObject` thật, để dành khi có R2.

**Đã xác minh chạy được trong phiên này:** `pnpm lint/typecheck/test/build` xanh toàn bộ (56/91 unit, 29/50
integration cộng dồn — +1 so với trước); `curl` xác nhận route upload mới chưa đăng nhập → 401. **Chưa verify
được**: toàn bộ luồng qua storage thật (cần người dùng nhập credential R2 qua `/admin/settings/storage`).

## M6 — Việc đã làm (xem docs/modules/M6.md để có sơ đồ và danh sách test đầy đủ)

- `packages/core/src/pricing/calculate-price.ts`: `calculatePrice()` — pricing engine thuần đúng chữ ký đặc
  tả, 14/14 unit test (bao gồm phân bổ discount về từng dòng để tổng khớp chính xác, không lệch do làm tròn).
- Schema `Coupon` (L2, RLS — public đọc được coupon `isEnabled`) + `CouponRedemption` (L2, RLS, `orderId` là
  string thường — chưa có quan hệ tới `Order` vì M8 chưa tồn tại, M8 thêm `@relation` sau, không cần đổi cột).
- `apps/web/lib/coupon.ts`: CRUD coupon (validate `value` theo `type`, unique mã trong tenant) +
  `previewCouponPrice()` (đọc qua `withPublic`, gọi `calculatePrice()` — không tin số tiền từ client).
- Trang Studio `/coupons`, `/coupons/new`, `/coupons/[id]`; API công khai
  `POST /api/[tenantSlug]/coupons/preview` (không cần đăng nhập).
- 1/2 integration test M6 gốc hoàn thành (API preview). Test còn lại ("coupon chỉ tính lượt khi đơn PAID")
  hoãn tới M8 — cần `Order` thật để có sự kiện "chuyển PAID".

**Đã xác minh chạy được trong phiên này:** `pnpm lint/typecheck/test/build` xanh toàn bộ (70/91 unit, 30/50
integration cộng dồn); `curl` xác nhận `/studio/.../coupons` chưa đăng nhập → 307, preview cho tenant không
tồn tại → 404.

## M8 — Việc đã làm (xem docs/modules/M8.md để có sơ đồ và danh sách test đầy đủ)

- `packages/core/src/order/*`: máy trạng thái đơn hàng (`transitionOrderStatus`, ném lỗi khi chuyển sai — cùng
  mẫu `billing/subscription-state.ts`), mã đơn (`generateOrderCode`, bảng chữ base32 không gây nhầm), hạn đơn +
  cửa sổ xác nhận muộn 24h, so khớp số tiền, pricing đơn (bọc `calculatePrice()` M6, không nhận tham số "tổng
  tiền từ client"), guard mua hàng (chặn tự mua sản phẩm mình/đã sở hữu), cộng dồn `tenant_customers` — 10/10
  unit test.
- Schema: `Order`, `OrderItem`, `TenantPaymentTransaction`, `TenantCustomer`, `Entitlement` (đều L2, RLS —
  `orders`/`order_items` có thêm chiều "khách hàng" trong policy, khác các bảng L2 khác chỉ có chiều tenant),
  thêm `@relation` thật cho `CouponRedemption.orderId` (M6 để tạm là string). `Order.confirmNote` thêm sau khi
  nhận ra cần chỗ lưu ghi chú xác nhận thủ công bắt buộc (giống `SubscriptionInvoice.confirmNote` ở M3).
- `apps/web/lib/order.ts`: `createOrder`/`applyCouponToOrder`/`removeCouponFromOrder`/`initiateOrderCheckout`
  (dùng chung `packages/payments` với `scope:{kind:'TENANT',...}`, không đụng bảng/secret Platform), và hàm
  bắt buộc theo đặc tả — **một hàm `markOrderPaid(tx, orderId, source)` duy nhất**, nhận `tx` (transaction đã
  mở sẵn bởi caller qua `withTenant`/`withSystemJob`) — gọi từ SePay webhook, MoMo IPN, xác nhận thủ công, và
  đơn 0đ; idempotent (đơn đã PAID/FULFILLED thì bỏ qua); bên trong dùng `UPDATE coupons SET usedCount =
  usedCount + 1 WHERE usedCount < usageLimit` (raw SQL, atomic — chống vượt giới hạn khi 2 đơn thanh toán đồng
  thời, hoàn thành BACKLOG hoãn từ M6).
- `apps/web/lib/payment-process.ts`: job `payment.process` — route webhook tenant giờ xác thực chữ ký, ghi
  `webhook_events` idempotent rồi **đẩy job** thay vì xử lý luôn (đúng §7 mục 4 "trả 2xx nhanh, xử lý nặng đẩy
  sang job" — điểm này M3's platform webhook route KHÔNG theo đúng, xem ghi chú BACKLOG). Job so khớp đơn theo
  mã tham chiếu, ghi `tenant_payment_transactions` (MATCHED/UNMATCHED/MISMATCH_AMOUNT) rồi gọi `markOrderPaid`
  khi khớp và đơn còn hợp lệ (PENDING hoặc EXPIRED trong 24h).
- **Bug tự bắt được qua integration test, không phải qua review**: `payment-process.ts` bản đầu dùng
  `getPrismaClient()` trần (không qua `withTenant`) để đọc/ghi `orders`/`tenant_payment_transactions` — hai
  bảng L2 có RLS. Kết quả: `SELECT` bị RLS lọc âm thầm về rỗng (tưởng "không tìm thấy đơn"), `INSERT` bị RLS
  chặn hẳn (lỗi `42501`). 3/9 integration test đầu tiên fail đúng vào lỗi này — sửa bằng cách bọc toàn bộ hàm
  trong một `withTenant(data.tenantId, ...)` duy nhất (đã biết tenantId từ webhook route, không cần
  `withSystemJob`).
- Trang công khai `/[tenantSlug]/products/[productSlug]` (từ ADR-030 đổi thành `/[tenantSlug]/[productSlug]`, URL cũ 301) (chi tiết sản phẩm, nút "Mua ngay" — mở lại quyết
  định hoãn từ M5) và `/[tenantSlug]/checkout/[orderCode]` (tóm tắt đơn, nhập mã giảm giá, chọn phương thức
  thanh toán, hiện QR/redirect, polling 3 giây — cùng mẫu `BillingPoll` của M3's `/studio/.../billing`).
- Trang Studio `/studio/[tenantSlug]/orders` (danh sách lọc theo trạng thái, chi tiết, xác nhận thủ công/huỷ/
  hoàn tiền) và `/studio/[tenantSlug]/customers` (danh sách khách hàng). Dashboard Studio nối 2 StatCard từng
  để trống "Cần M8" (doanh thu 30 ngày, đơn chờ xác nhận) bằng dữ liệu thật.
- Job `order.sweep` chạy mỗi 5 phút (không phải mỗi giờ như `subscription.sweep`) — TTL đơn PENDING mặc định
  chỉ 60 phút nên lịch mỗi giờ có thể để đơn hết hạn hiển thị PENDING sai tới gần 1 giờ. *(ADR-036, 2026-10-16: trên Vercel sweep
  chạy hằng ngày qua `/api/cron/daily`; luồng đọc/thanh toán dùng `effectiveOrderStatus` nên đơn quá hạn là EXPIRED ngay — lịch 5 phút
  chỉ còn ở `worker.ts` local.)*
- Hoàn thành nốt integration test hoãn từ M6 ("coupon chỉ tính lượt khi đơn PAID, 2 đơn đồng thời không vượt
  `usageLimit`") — 9/8 test M8 (8 gốc + 1 hoãn từ M6).

**Đã xác minh chạy được trong phiên này:** `pnpm lint/typecheck/test/build` xanh toàn bộ (80/91 unit, 39/50
integration cộng dồn); toàn bộ 9 integration test M8 chạy thật trên Neon (webhook ký HMAC thật, RLS thật,
UPDATE atomic coupon thật qua `Promise.all` mô phỏng đồng thời). **Chưa verify được**: luồng thật qua trình
duyệt (chọn sản phẩm → mua → quét QR → polling), vì cần R2 + provider thanh toán thật đã cấu hình qua UI.

## M9 — Việc đã làm (xem docs/modules/M9.md để có sơ đồ và danh sách test đầy đủ)

- Chuyển `generateOpaqueToken`/`hashOpaqueToken` từ `packages/auth` sang `packages/core/src/crypto/`
  (comment gốc của hàm này đã ghi trước "share-link tokens" là người dùng tương lai) — cùng mẫu refactor
  encryption.ts ở M5 (ADR-017). `packages/auth` giờ có `@gieochu/core` làm dependency thật (trước chỉ
  devDependency gián tiếp qua `@gieochu/config`).
- `packages/core/src/download/*`: token tải (sinh/hash/TTL 60s/đánh giá trạng thái), guard entitlement
  (thu hồi/hết lượt — `downloadLimit=0` = không giới hạn, cùng quy ước `downloadLimit` sản phẩm ở M5),
  usability của share link (hết hạn/hết lượt/thu hồi), hash/verify mật khẩu share link (argon2id riêng,
  không dùng chung `packages/auth`'s password — giữ `core` không phụ thuộc ngược vào `auth`) — 6/7 unit
  test M9 (test 7 nằm ở `packages/storage`).
- `packages/storage/src/download-disposition.ts`: `buildAttachmentDisposition()` (RFC 5987 —
  `filename*=UTF-8''...` cho tên file tiếng Việt có dấu, trước đây `createPresignedDownload()` chỉ có
  `filename="..."` ASCII thường, một lỗi thật cho một app tiếng Việt) + `clampDownloadTtlSeconds()` (≤600s)
  — nối vào `createPresignedDownload()` luôn, không chỉ nằm trong test — 1/7 unit test M9.
- Schema: `DownloadToken` (L1, không RLS — cùng lý do RefreshToken/VerificationToken: ranh giới bảo mật là
  "chỉ người vừa yêu cầu giữ token thô", không phải lọc theo dòng), `ShareLink`/`DownloadEvent` (L2, RLS).
- **3 lỗ hổng RLS thật phát hiện qua chính integration test, không phải qua review** (xem ADR-020):
  `product_files` và `products` thiếu nhánh "customer" (khách đã mua vẫn không đọc được file/sản phẩm của
  chính mình nếu sản phẩm không còn `PUBLISHED`), và `consumeShareLinkDownload()` đọc `share_links` qua
  `getPrismaClient()` trần thay vì `withPublic()` — cùng lớp lỗi với M8's `payment-process.ts`. Cả 3 sửa
  bằng migration RLS riêng, xác minh lại bằng test thật (không mock).
- `apps/web/lib/download.ts`: `requestDownload`/`consumeDownloadToken` — 2 bước đúng đặc tả, cả hai bước
  đều có một lớp atomic-claim (`updateMany`/raw SQL có điều kiện) làm ranh giới thật, không chỉ dựa vào lần
  đọc trước đó — cùng mẫu chống-đua đã dùng cho coupon ở M8.
- `apps/web/lib/share-link.ts`: CRUD + `resolveShareLink`/`consumeShareLinkDownload` (public, không đăng
  nhập) — `fileIds` rỗng/null = mọi file đang bán, đúng mẫu `Coupon.productIds` (M6).
- `apps/web/lib/library.ts`, `entitlement.ts`: thư viện gom theo tenant, lịch sử đơn hàng, tenant cấp thêm
  lượt/thu hồi entitlement.
- Trang: `/account/library` (hoàn thiện từ stub M1), `/account/orders` (mới), `/s/[token]` (công khai, có ô
  mật khẩu khi cần), `/studio/[tenantSlug]/products/[productId]/share-links` (tạo/thu hồi, token hiện đúng
  một lần), nối "cấp thêm lượt"/"thu hồi" vào trang chi tiết đơn hàng Studio (M8) đã có sẵn.
- Route: `POST /api/downloads`, `GET /api/downloads/{token}`, `POST /api/share-links/{token}/download` — rate
  limit 20 lượt/10 phút mỗi user cho tải thường, 20 lượt/10 phút mỗi token cho tải qua share link (chống dò
  mật khẩu).

**Đã xác minh chạy được trong phiên này:** `pnpm lint/typecheck/test/build` xanh toàn bộ (87/91 unit, 44/50
integration cộng dồn); cả 5 integration test M9 chạy thật trên Neon với RLS thật (bao gồm việc bắt được và
sửa 3 lỗ hổng RLS thật nêu trên ngay trong lần chạy test đầu tiên). **Chưa verify được**: luồng thật qua
trình duyệt (bấm tải trong `/account/library`, mở link `/s/{token}` thật) — cần R2 thật.

## Storefront CMS (ADR-023) + chuẩn layout (ADR-024) — 2026-09-26

Không phải module mới trong bảng mục 9 — mở rộng storefront M4 theo yêu cầu chủ dự án. **Đã xong phần code**;
chưa có test riêng (chủ dự án chốt không thêm test đợt này — nợ test ghi trong ADR-023 và `docs/BACKLOG.md`).

- Storefront `/[tenantSlug]` theo 5 section CMS (hero, services, products, testimonials, contact) — schema
  `packages/core/src/tenant/storefront-sections.ts` (lọc href/ảnh ngay ở schema), lưu `tenants.storefrontSections`
  (live) / `storefrontSectionsDraft` (nháp); nội dung demo khi chưa xuất bản (khách không thấy đánh giá demo).
- Studio `/studio/[tenantSlug]/storefront` (lưu nháp / xuất bản / khôi phục, upload ảnh Cloudinary hệ thống theo
  folder tenant) và `/studio/[tenantSlug]/messages` (hộp thư: đọc/lưu trữ/xoá).
- Form liên hệ: Server Action `submitStorefrontContactAction` (honeypot, zod, rate limit in-memory 3 tin/10 phút
  theo IP-hash + 50 tin/giờ theo tenant), lưu bảng L2 mới `storefront_messages` (RLS tách policy theo lệnh:
  public chỉ INSERT, tenant SELECT/UPDATE/DELETE, không nhánh admin) rồi email báo chủ trang qua `after()`.
- Migration `20260926090000_storefront_cms_messages`, `20260926090100_rls_storefront_messages`.
- ADR-024: 3 utility `container-page` (1280px) / `container-prose` / `container-narrow` trong `globals.css`; đã áp
  cho trang chủ, storefront, trang chi tiết sản phẩm (2 cột), `/pricing`, `/p/[slug]`, checkout.

**Số test:** `pnpm test:count` = **88/91 unit, 46/50 integration** — giữ nguyên, không thêm/bớt. **Chưa verify**:
RLS `storefront_messages` trên Neon thật, email báo thật, upload Cloudinary thật, trang sản phẩm/checkout với dữ
liệu thật (DB chưa có sản phẩm).

## Editor sản phẩm GĐ1 (ADR-026/027) — 2026-09-26/27

Mở rộng M5 theo yêu cầu chủ dự án (không phải module mới trong bảng mục 9). **Đã xong phần code.**

- **Sửa bảo mật upload (ADR-026 §1):** `complete`/`cover-complete` kiểm `objectKey` thuộc đúng tenant/sản phẩm
  (`isProductObjectKeyFor`, `packages/storage`) trước mọi lời gọi storage (`INVALID_OBJECT_KEY` 400); `complete` từ chối
  key đã ghi nhận (`UPLOAD_ALREADY_COMPLETED` 409), xoá object khi dung lượng thật lệch khai báo (`UPLOAD_SIZE_MISMATCH`
  400) hoặc vượt gói (kiểm lại bằng dung lượng HeadObject); `storageUsedBytes` cộng theo dung lượng thật.
- **Danh mục (ADR-026 §2):** `Product.categoryId` → `DocumentCategory` (`SET NULL`); nháp được trống, xuất bản bắt buộc
  danh mục `isActive`.
- **Link tài liệu ngoài (ADR-026 §3):** `product_files.sourceKind FILE | EXTERNAL_URL` + `externalUrl` (CHECK
  `product_files_source_shape`), allowlist https (`normalizeExternalDocumentUrl`, `packages/core`); chỉ giao cho khách có
  entitlement qua `/api/downloads` (302 tới link, `DOWNLOAD_SOURCE_UNAVAILABLE` 410 nếu link không còn hợp lệ); share link
  không giao link ngoài; RLS `product_files` viết lại (public chỉ FILE+preview+CLEAN, customer thêm EXTERNAL_URL).
- **Điều kiện xuất bản (ADR-026 §4):** `canPublishProduct` → `{ allowed, reasons, checklist }` (danh mục, ảnh bìa, ≥1
  file bán CLEAN hoặc link hợp lệ, giá, tenant ACTIVE, giới hạn gói).
- **Editor Tạo/Sửa 2 cột dùng chung + ADR-027:** mô tả ngắn `Product.summary` (≤300), ảnh bìa Cloudinary
  `Product.coverImageUrl` (fallback `coverImageKey` R2), chế độ hiển thị Công khai/Riêng tư = PUBLISHED/DRAFT, trang
  Xem trước `/studio/[tenantSlug]/products/[productId]/preview` (noindex, chỉ thành viên tenant).
- Migration `20260926120000_adr026_product_category_external_links`, `20260926120100_rls_adr026_product_files`,
  `20260927090000_adr027_product_summary_cover_url`.

**Số test:** `pnpm test:count` = **91/94 unit, 50/53 integration** (trần nâng lên 94/53 theo ADR-026; ADR-027 không nâng).
**Chưa verify:** các trang cần đăng nhập bằng trình duyệt, upload Cloudinary/R2 thật, mở link ngoài từ Thư viện thật.
Việc còn lại: `docs/BACKLOG.md` mục "Phát sinh trong đợt Editor sản phẩm GĐ1 (ADR-026/027)".

**Cập nhật editor sau ADR-027 (2026-09-27):**

- Bỏ thanh hành động dính đáy; card xuất bản `PublishCard` (chế độ hiển thị → checklist → trạng thái lưu → nút) đứng đầu
  sidebar và dính khi cuộn (≥ xl); khung `max-w-[1440px]`, sidebar 360px; cột chính Thông tin → Giá & khuyến mãi → Ảnh
  đại diện → Tệp. Dưới xl: card ở cuối form + thanh lưu nhanh `.studio-save-bar`.
- Chưa công khai: nút [Xuất bản] luôn hiện + [Xem trước | Lưu nháp], gửi theo nút bấm (radio đồng bộ theo nút), Enter =
  Lưu nháp.
- "Sửa đổi ADR-027 §4": trang Tạo không khoá Tệp — thêm file/link đầu tiên tự tạo bản nháp (`ensureProductId`, một
  promise dùng chung, tiêu đề bắt buộc), giữ URL `/new` trong phiên; `addProductLinkAction`/`updateProductLinkAction`
  trả thêm `link`.
- Trang Tạo/Sửa bỏ `<main>` lồng (dùng `<div>`); 14 trang Studio khác còn `<main>` lồng (BACKLOG).

## Ảnh Cloudinary hệ thống + hạn mức ảnh (ADR-028) — 2026-09-27

**Đã xong phần code.**

- Chữ ký dùng chung `getCloudinaryUploadSignatureAction` chỉ `SYSTEM_ADMIN` (+ `allowed_formats`). Chữ ký tenant
  (`lib/tenant-media.ts`) ký `public_id` đầy đủ `tenants/<id>/<content|products|storefront>/<24 hex>`, png/jpg/jpeg/webp,
  incoming transformation ≤2000px; giữ chỗ 5MB lúc ký, `registerTenantImageAction` đọc bytes thật qua Cloudinary Admin
  API, đối soát lười ≤3 dòng giữ chỗ quá 1 giờ.
- Hạn mức `Plan.imageStorageMb` (FREE 100, CREATOR 1024, PRO 2048, BUSINESS 5120 — sửa ở `/admin/plans`), bảng L2
  `tenant_media_assets` (RLS `tenant_isolation` + nhánh `system_job`); vượt → `IMAGE_QUOTA_EXCEEDED`.
- TiptapEditor upload ảnh (bỏ chèn bằng URL): PNG/JPEG/WebP ≤5MB, kéo-thả/dán, tiến độ, nút "Alt", thông báo quota.
- `cloudinaryDeliveryUrl` (`f_auto,q_auto,c_limit,w_<N>`, N ≤1600) cho ảnh bìa/storefront/mô tả; sanitizer chỉ giữ
  `<img>` của cloud hệ thống, `isCloudinaryImageUrl` kiểm cloud name.
- Migration `20260927110000_adr028_image_quota_media_assets`, `20260927110100_rls_adr028_media_assets`.
- Integration test chụp/khôi phục cấu hình dùng chung (`tests/integration/shared-config-snapshot.ts`) thay vì xoá.

**Số test:** `pnpm test:count` = **93/94 unit, 52/53 integration** (+2/+2, không nâng trần). **Chưa verify:** upload
Cloudinary thật + Admin API thật, hiển thị ảnh `f_auto` qua CSP trên trình duyệt. Việc còn lại: `docs/BACKLOG.md` mục
"Phát sinh trong đợt ADR-028".

## M10a — Đánh giá sản phẩm + siết RLS ghi (ADR-029) — 2026-09-27

M10 tách theo ADR-029: **M10a Đánh giá** (đợt này) → **M10b Bài viết tối giản** (chưa làm) → M10c bình luận/thả tim/theo dõi
(`docs/BACKLOG.md`). **Đã xong phần code M10a**; chủ dự án chọn **chưa thêm test** (nợ trong `docs/BACKLOG.md`), verify thủ
công trên DB dev qua role `gieochu_app`.

- **Siết RLS trước M10 (ADR-029 mục 0):** migration `20260927130000_rls_adr029_split_write_policies` đổi 7 bảng `products`,
  `product_files`, `coupons`, `share_links`, `orders`, `order_items`, `entitlements` từ 1 policy `tenant_isolation` FOR ALL sang
  `select_access` (giữ điều kiện đọc cũ) + `write_insert/update/delete` chỉ tenant hoặc `system_job` (`order_items` qua đơn cha).
  Quy tắc mới: bảng L2 có nhánh public/customer phải tách policy theo lệnh, không FOR ALL.
- **Bảng `reviews`** (L2): 1 đánh giá/khách/sản phẩm, gắn `orderItemId`, sao 1–5, nội dung văn bản thuần ≤2000, tên hiển thị
  "Minh N.", `VISIBLE`/`HIDDEN` + lý do, trả lời của tenant; 6 CHECK; RLS tách theo lệnh (không nhánh admin); trigger
  `reviews_guard_columns` giới hạn cột theo scope. Cache điểm số nguyên `products.ratingSum/ratingCount`, tính lại toàn phần dưới
  `system_job` + advisory lock. Migration `20260927150000_m10a_reviews`, `20260927150100_rls_m10a_reviews`.
- **Khách:** viết/sửa/xoá trên trang chi tiết tài liệu (`upsertMyReviewAction`, `deleteMyReviewAction`; rate limit 5 lần/10
  phút/user); link đánh giá ở Thư viện. Hoàn tiền/thu hồi entitlement → đánh giá tự ẩn (`REFUNDED`, tenant không khôi phục
  được); mua lại rồi gửi lại → tự hiện lại.
- **Tenant:** Studio → Đánh giá (trả lời — rỗng = xoá, ẩn có lý do, khôi phục), badge sidebar "Đánh giá (N)" = số chưa trả
  lời, ô "Đánh giá mới" (7 ngày) ở Tổng quan; email `review_new` cho chủ tenant (không ghi `EmailSendLog`); tenant `READ_ONLY`
  vẫn nhận/kiểm duyệt.
- **Storefront:** section mới `reviews` ("Đánh giá", đánh giá thật, ghim trước rồi tự bù theo `minRating`/`requireBody`,
  rỗng → không render, anchor `#danh-gia`); section `testimonials` hiển thị là "Cảm nhận", bỏ sao, anchor `#cam-nhan`. Thẻ tài
  liệu hiện sao từ 1 đánh giá.
- **Ghi chú đặc tả:** đặc tả gốc M4 (`docs/GIEOCHU_PROMPT_MVP_PHASE1.md`) mô tả storefront có "tab Bài viết / Tài liệu / Đánh
  giá" — đã bị ADR-023 (storefront theo section CMS) và ADR-025 (trang con là trang hệ thống) thay thế; đánh giá nay là section
  `reviews` + khối trên trang chi tiết tài liệu, bài viết (M10b) sẽ là trang hệ thống `/{tenantSlug}/posts`.

**Số test:** `pnpm test:count` = **93/94 unit, 52/53 integration** — không thêm/bớt. **Chưa verify:** RLS 7 bảng + `reviews`
+ trigger bằng integration test trên Neon thật, email `review_new` thật, giao diện với dữ liệu đánh giá thật (DB dev chưa có
dữ liệu demo). Việc còn lại: `docs/BACKLOG.md` mục "Phát sinh trong đợt M10a (ADR-029)".

## M10b — Bài viết tối giản (ADR-029) — 2026-09-28

**Đã xong phần code M10b → M10 giai đoạn 1 (M10a + M10b) hoàn tất code.** Chủ dự án chọn **chưa thêm test** (nợ trong
`docs/BACKLOG.md`), verify thủ công. Quyết định chi tiết: ADR-029 mục 5, 6 + "Bổ sung ADR-029 M10b theo triển khai".

- **Bảng `posts`** (L2): tiêu đề tuỳ chọn ≤200, nội dung Tiptap sanitize theo cloud Cloudinary hệ thống (khi lưu và lại khi
  render), trích đoạn văn bản thuần ≤300 tự sinh, ≤6 ảnh (usage `POST`, thư mục `tenants/<id>/posts`, tính hạn mức ảnh
  ADR-028), gắn tối đa 1 sản phẩm cùng tenant chưa ARCHIVED, `DRAFT`/`PUBLISHED`/`HIDDEN` (HIDDEN chỉ `system_job` đặt — tenant
  chỉ xoá), ghim 1 bài/tenant, `publishedAt` giữ lần đăng đầu, không `authorId`. RLS tách lệnh (public chỉ `PUBLISHED` của tenant
  không LOCKED, không nhánh customer/admin), trigger `posts_guard_product_tenant` + `posts_guard_columns`, 6 CHECK. Migration
  `20260928090000_m10b_posts`, `20260928090100_rls_m10b_posts`. **Partial unique index ghim chỉ có trong SQL** — cẩn thận khi
  chạy `prisma migrate dev`.
- **Tenant:** Studio → Bài viết (sidebar sau "Sản phẩm", tổng 11 mục) — danh sách thẻ lọc theo trạng thái, editor bài viết
  (Đăng bài/Lưu nháp, Lưu thay đổi/Gỡ bài, ghim, gắn tài liệu); tenant `READ_ONLY`/`LOCKED` không tạo/sửa/xoá/ghim.
- **Công khai:** trang hệ thống `/{tenantSlug}/posts` và `/{tenantSlug}/posts/{postId}` (ADR-025), section storefront `posts`
  ("Bài viết", anchor `#bai-viet`, 3–9 bài, bài ghim đứng đầu tuỳ chọn, rỗng → không render; dữ liệu section cũ được editor tự
  chèn section ẩn).
- **Script dữ liệu demo cho DB dev** (`apps/web/scripts/demo-reviews.ts`, `ALLOW_DEMO_SEED=1 pnpm --filter @gieochu/db run
  demo:seed|demo:clean`): 3 sản phẩm demo trên `phongweb`, 5 khách `demo+...@gieochu.test`, đơn FULFILLED, 9 đánh giá — chỉ cho
  dev, có chốt an toàn (xem KB `04-Operations-Runbooks/Dev-Demo-Data-Runbook.md`).

**Số test:** `pnpm test:count` = **93/94 unit, 52/53 integration** — không thêm/bớt. **Chưa verify:** RLS `posts` + trigger bằng
integration test trên Neon thật, upload ảnh bài viết thật, giao diện với dữ liệu bài viết thật. Việc còn lại: `docs/BACKLOG.md`
mục "Phát sinh trong đợt M10b (ADR-029)".

## URL tài liệu rút gọn + bỏ card xuất bản dính (ADR-030) — 2026-09-28

**Đã xong code.** Quyết định chi tiết: ADR-030 + "Bổ sung ADR-030 theo triển khai".

- **URL chuẩn trang tài liệu** `/{tenantSlug}/{productSlug}` (`app/[tenantSlug]/[productSlug]/`); URL cũ
  `/{tenantSlug}/products/{productSlug}` → **301** bằng Route Handler `app/[tenantSlug]/products/[productSlug]/route.ts` (giữ
  query; không dùng `permanentRedirect` vì Next trả 308); `/{tenantSlug}/products` → 404; canonical là URL tuyệt đối.
- **Hàm dựng URL duy nhất** `productPath`/`productUrl` + **23 slug dành riêng** `RESERVED_PRODUCT_SLUGS`
  (`packages/core/src/product/path.ts`, subpath client `@gieochu/core/product-path`). Slug tự nhập trùng → `INVALID_SLUG`; slug
  tự sinh trùng → thêm hậu tố. Action sản phẩm revalidate cả trang tài liệu và storefront.
- **Editor Studio** (sản phẩm + bài viết): card xuất bản không còn dính khi cuộn; thanh lưu nhanh dưới xl giữ nguyên.

**Số test:** `pnpm test:count` = **93/94 unit, 52/53 integration** — không đổi. **Trước deploy prod:** quét slug sản phẩm trùng
từ dành riêng. Nợ test redirect 301 + chặn slug dành riêng: `docs/BACKLOG.md` mục "Phát sinh trong đợt ADR-030".

## Deploy Vercel (ADR-031) — 2026-09-29

**Đã xong code, chưa xác nhận deploy thành công.** `apps/web/vercel.json` (`buildCommand: "next build"`, Root Directory
`apps/web`; Prisma client sinh sẵn đã commit); root `app/layout.tsx` `force-dynamic` (build không cần env, nonce CSP gắn mọi
trang); `PRISMA_MIGRATE_URL` xoá khỏi schema env runtime — chỉ CLI `migrate`/`studio` + `setup-app-role` trên máy dev/CI,
`db seed` dùng `DATABASE_URL`. Migration prod chạy từ máy dev/CI. **Worker pg-boss chưa có host** (BACKLOG mục "Phát sinh
trong đợt ADR-031") — *2026-10-16: thay bằng job trong app + Vercel Cron theo ADR-036, xem mục ADR-036 dưới.* Quy trình: KB `04-Operations-Runbooks/Deploy-Vercel-Runbook.md`.

**Số test:** `pnpm test:count` = **93/94 unit, 52/53 integration** — không đổi.

## Cấu hình hệ thống + thương hiệu từ System Center (ADR-032) — 2026-09-29 → 2026-10-15

**Đã xong code, chưa deploy bản này.** Quyết định chi tiết: ADR-032.

- **Env runtime còn 8 biến bắt buộc** (`packages/config/src/env.ts`): `APP_URL`, `DATABASE_URL`, `DIRECT_URL`, `JWT_ACCESS_SECRET`,
  `JWT_ISSUER`, `JWT_AUDIENCE`, `PAYMENT_ENCRYPTION_KEY`, `STORAGE_ENCRYPTION_KEY`. Email env chỉ là fallback dev; thiếu cả SMTP ở
  System Center lẫn env → `EMAIL_NOT_CONFIGURED` (503 ở luồng admin), app vẫn khởi động.
- **Thương hiệu:** `DEFAULT_BRAND` + `resolveBrand` (`@gieochu/config/brand`), `getEffectiveBrand()` (`apps/web/lib/branding.ts`,
  đọc `SystemBranding`); bỏ `getBrand()`. Login/register/onboarding nhận tên thương hiệu qua prop từ server.
- **Cấu hình hệ thống:** bảng L1 `system_settings` thêm 10 cột (migration `20260929090000_adr032_system_settings`), mặc định +
  giới hạn ở `packages/core/src/settings/system-settings.ts` (`trialDays` lưu nhưng chưa dùng — `INACTIVE_SYSTEM_SETTINGS`);
  `getSystemSettings()` cache theo request; trang `/admin/settings/general` ("Cấu hình chung"); `/admin/settings` chỉ còn
  `supportEmail`. TTL access/refresh, hạn link xác minh/đặt lại mật khẩu (email hiển thị hạn động), presign (tải xuống kẹp ≤ 600
  giây), đơn/hoá đơn chờ, ân hạn, lượt tải mặc định đọc từ DB; `SessionRefresh` làm mới phiên ở nửa TTL access token.
  Múi giờ hiển thị là hằng `DISPLAY_TIME_ZONE`.
- **Migration `20260929100000_adr032_drop_platform_name`** — xem mục sự cố dưới.

**Số test:** `pnpm test:count` = **93/94 unit, 52/53 integration** — không đổi. Quy trình deploy (8 biến, biến cần xoá trên Vercel):
KB `04-Operations-Runbooks/Deploy-Vercel-Runbook.md` §3.

## Trang chủ hệ thống dùng dữ liệu thật (ADR-033) — 2026-09-29 → 2026-10-15

**Đã xong code, chưa deploy bản này.** Quyết định chi tiết: ADR-033 + "Bổ sung ADR-033 theo triển khai".

- **`products.soldCount`** (cache số lượt mua: dòng đơn FULFILLED, trừ entitlement đã thu hồi; CHECK ≥ 0) — migration
  `20260929120000_adr033_product_sold_count` (đã áp lên DB dùng chung). `recomputeProductSoldCounts` (`apps/web/lib/product-sold-count.ts`,
  `system_job`) gọi sau commit ở `createOrder` (0đ), `applyCouponToOrder`, `confirmOrderManually`, `processPaymentEvent`,
  `markOrderRefunded`, `revokeEntitlement`; `markOrderPaid` trả thêm `productIds`. `PublicProduct.soldCount`.
- **CMS trang chủ:** 4 section `stats`/`search`/`coaches`/`documents` lấy dữ liệu thật (`@gieochu/core/home-sections`,
  `parseHomeSections` đọc an toàn dữ liệu cũ), loader `apps/web/lib/home.ts` ("Công khai" = PUBLISHED + tenant ACTIVE; ghim + tự
  bù; section/ô bằng 0 thì ẩn); ô chọn ghim dùng `searchHomeTenantOptionsAction`/`searchHomeProductOptionsAction`. Section
  testimonials đổi nhãn "Cảm nhận người dùng".
- Chưa có job đối soát định kỳ `soldCount`; chip/ô tìm chưa thành link (chưa có trang tìm kiếm/danh mục công khai) — BACKLOG.

**Số test:** `pnpm test:count` = **93/94 unit, 52/53 integration** — không đổi. Việc còn lại: `docs/BACKLOG.md` mục "Phát sinh
trong đợt ADR-032/033".

## Sự cố 2026-10-15 — drop cột `platformName` trên DB dùng chung dev/production

- Migration `20260929100000_adr032_drop_platform_name` chạy trên DB dev — **DB dev đang là DB production** → bản production trên
  Vercel (còn đọc `system_settings.platformName`) trả 500. Khôi phục: `ADD COLUMN IF NOT EXISTS "platformName" TEXT`.
- Quy tắc mới (`CLAUDE.md` mục "Migration"): agent không tự chạy `db:migrate`/DDL khi chưa được Quốc duyệt; migration theo expand
  → contract (DROP/RENAME chỉ sau khi bản không dùng cột đã lên production). Đề xuất tách DB dev bằng Neon branch **bị chủ dự án
  bác** — ADR-034: một DB duy nhất cho dev/Preview/production, không `db:seed`, test/script phải dọn dữ liệu, Preview chỉ xem
  giao diện.
- **Còn treo:** dọn dữ liệu demo (`demo:clean`) trước go-live (ADR-034); migration contract `DROP COLUMN IF EXISTS "platformName"` chạy **sau** khi deploy
  bản ADR-032. Quy trình: KB `04-Operations-Runbooks/Deploy-Vercel-Runbook.md` §9, `Publish-And-Rollback-Runbook.md` §4.2.1.

## Cửa hàng GĐ1 + GĐ2 (ADR-035) — xong code, chưa commit/deploy — 2026-10-15

**GĐ1 (CMS Cửa hàng trong System Center) và GĐ2 (trang công khai `/cua-hang`, `/cua-hang/tai-lieu`) đã xong code, chưa commit,
chưa deploy.** Quyết định: ADR-035 + "Bổ sung ADR-035" + "Chủ dự án chốt". Kế hoạch: `docs/ke-hoach-cua-hang-marketplace-2026-10-15.md`
— §5 bước 1–14 xong, bước 15 (KB) xong. Verify: `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test:unit` đạt; thử trên dev server
với dữ liệu thật đạt.

### GĐ1 — CMS `shop`

- **Không DDL:** cấu hình lưu `CmsPage` slug `shop` (`blocks` live / `blocksDraft` nháp); dòng tạo bằng `upsert` ở lần Lưu nháp/
  Xuất bản đầu (không seed — ADR-034).
- **Schema 9 section** `packages/core/src/admin/shop-sections.ts` (subpath client `@gieochu/core/shop-sections`): giới hạn/mặc
  định, `parseShopSections` đọc phòng thủ (section thiếu → thêm cuối ở trạng thái ẩn, `MANUAL` rỗng → `AUTO`), ngưỡng điểm lưu
  số nguyên ×10 (`minAvgTenths`).
- **Editor** `/admin/cms/shop` (`page.tsx`, `loading.tsx`, `_ui/`) + actions `app/admin/cms/shop/actions.ts`
  (`saveShopDraftAction`, `publishShopAction`, `restoreLiveShopAction`, `searchShopCategoryOptionsAction` — đều
  `requireRole("SYSTEM_ADMIN")`); loader `apps/web/lib/shop-cms.ts`; `listCategoryPinOptions` trong `apps/web/lib/home.ts`;
  menu "Trang Cửa hàng"; kit `Notice`; `PinPicker` thêm `copy`/`error`.
- **`SYSTEM_CMS_SLUGS = ["home","shop"]`** (`packages/core/src/admin/cms-slugs.ts`): form CMS chung từ chối, `/p/home` và
  `/p/shop` trả 404 (sửa lỗi có sẵn), danh sách `/admin/cms` link editor riêng.
- Quét tenant trùng 6 slug dành riêng: không trùng; extension `unaccent`/`pg_trgm` khả dụng (theo báo cáo của Quốc).

### GĐ2 — trang công khai

- **Migration expand `20261015090000_adr035_unaccent_search`** (đã áp lên DB dùng chung 2026-10-15, kiểm
  `gieochu_unaccent(lower('Đề thi Toán học'))` = `de thi toan hoc`): extension `unaccent` + hàm `public.gieochu_unaccent(text)`
  IMMUTABLE (translate đ/Đ + unaccent), GRANT EXECUTE cho `gieochu_app`; Prisma không quản lý; chưa có index.
- **Bảo mật DB:** chủ dự án đã `REVOKE CREATE ON DATABASE neondb FROM gieochu_app` (2026-10-15); `setup-app-role.mts` chưa cập nhật
  (BACKLOG).
- **`RESERVED_SLUGS`** thêm `cua-hang`, `tai-lieu`, `danh-muc`, `tim-kiem`, `giao-vien`, `kham-pha` (đã quét prod, không trùng).
- **`@gieochu/core/product-type`** (`packages/core/src/product/type-label.ts`): `PRODUCT_TYPES`, `PRODUCT_TYPE_LABELS`,
  `productTypeLabel` — storefront tenant và loader Cửa hàng dùng chung một nguồn nhãn.
- **Loader `apps/web/lib/shop.ts`**: kệ trong `withPublic` (một `findMany` chi tiết, `ROW_NUMBER` cho kệ theo danh mục); số bán 30 ngày
  `getTenantSales30d` dưới `withSystemJob` — chỉ số đếm theo tenant, loại entitlement thu hồi, cache bộ nhớ 5 phút, chỉ để xếp hạng,
  không hiển thị; tìm không dấu trên tiêu đề/summary/tên tenant/tên danh mục, escape LIKE; `getShopHeroStats`, `getShopSeo` (SEO CMS chỉ
  khi dòng `shop` PUBLISHED). `apps/web/lib/home.ts` export thêm `PUBLIC_PRODUCT_WHERE`, `orderByPinned`, `tenantLogoUrl`,
  `fillProductIdsQuery`.
- **Route** `/cua-hang` (layout riêng có header/footer, Suspense theo vị trí section, trạng thái rỗng toàn trang, H1 dự phòng khi ẩn
  hero, `error.tsx` thông điệp chung + digest) và `/cua-hang/tai-lieu` (`q`, `danh-muc`, `sap-xep`, `trang`; 24/trang; canonical không
  query; có `q` → noindex). Không thêm `route.ts`.
- **UI** (`apps/web/app/_ui/`): `catalog-parts`, `document-card`, `tenant-card`, `product-shelf`, `category-grid`, `shop-hero`,
  `shelf-skeleton`, `shop-cta`, `mobile-nav`; `app/cua-hang/_ui/search-parts.tsx`; header prop `current` + link "Cửa hàng" + menu mobile;
  footer link "Cửa hàng"; trang chủ dùng `DocumentCard`/`TenantCard`, ô tìm + chip danh mục trỏ `/cua-hang/tai-lieu`; icon
  `IconMenu`/`IconClose`.

**Số test:** `pnpm test:count` = **93/94 unit, 52/53 integration** — không đổi (không thêm test đợt này). Nợ test + việc còn lại:
`docs/BACKLOG.md` mục "Phát sinh trong đợt Cửa hàng GĐ1 (ADR-035)" và "Phát sinh trong đợt Cửa hàng GĐ2 (ADR-035)". KB:
`02-System-Specs/Shop-Marketplace-Specs.md`, `03-API-Contracts/Endpoint-Directory.md` §15–§16,
`04-Operations-Runbooks/UI-Design-System.md` §13–§14.

## Job nền trong app + Vercel Cron hằng ngày (ADR-036) — xong code, chưa commit/deploy — 2026-10-16

**Đã xong code, chưa commit, chưa deploy.** Quyết định: ADR-036 + "Chủ dự án chốt (2026-10-16)". Bối cảnh: Vercel không chạy worker
thường trực (ADR-031 mục 4); kiểm chỉ đọc hàng đợi thấy job tồn đều từ integration test, không có đơn khách thật kẹt.

- **`packages/jobs`** (`src/queue.ts`): `createJobQueue(conn, { schedule?, supervise? })` (mặc định bật như pg-boss); thêm `fetch`
  (nhận job, khoá dòng), `complete`, `fail` (chỉ ghi `name`/`message` của lỗi), `supervise` (một lượt bảo trì, không REINDEX); `send`
  nhận `SendJobOptions` (`retryLimit`/`retryDelay`/`retryBackoff`).
- **Web app:** `apps/web/lib/jobs.ts` chạy pg-boss với `schedule: false, supervise: false`, `getStartedQueue` export, start lỗi thì lần
  sau thử lại; job từ request gửi kèm `retryDelay: 60` + backoff. `apps/web/lib/job-handlers.ts` — bảng handler `payment.process`/`file.scan`
  dùng chung worker và runner. `apps/web/lib/job-runner.ts` — `drainQueues` (ngân sách thời gian mềm, lô 5, job lỗi `fail` + log rồi chạy
  tiếp), `scheduleQueueDrain` (bọc `after()`, không bao giờ ném), `superviseQueues`.
- **Route:** webhook tenant `api/webhooks/tenants/[tenantId]/[provider]` và `api/studio/[tenantSlug]/uploads/complete` drain hàng đợi
  tương ứng ngay sau response bằng `after()`, `maxDuration = 60`. **Route mới `GET /api/cron/daily`**: Bearer `CRON_SECRET`
  (`timingSafeEqual`); chạy `runSubscriptionSweep` → `runOrderSweep` → bảo trì hàng đợi → drain `payment.process`/`file.scan` (40 giây),
  mỗi bước cô lập; 200 `{ ok, requestId, results }` / 401 / 500 `CRON_STEP_FAILED` / 503 `CRON_NOT_CONFIGURED`; chỉ trả số đếm.
  `apps/web/vercel.json` thêm `crons` `0 20 * * *` UTC (03:00 giờ VN).
- **Env:** `CRON_SECRET` tuỳ chọn (rỗng = chưa đặt; nếu đặt phải ≥ 32 ký tự, ngắn hơn làm app fail-fast; thiếu → route cron 503). Env
  runtime = 8 biến bắt buộc (ADR-032) + `CRON_SECRET` tuỳ chọn (+ `CLAMAV_HOST` tuỳ chọn như cũ).
- **M8:** `effectiveOrderStatus` (`packages/core/src/order/expiry.ts`) — đơn PENDING quá `expiresAt` là EXPIRED khi đọc; áp vào áp/gỡ
  coupon, checkout, huỷ đơn, danh sách/chi tiết đơn (tenant + khách), thư viện khách, dashboard, `canManuallyConfirmOrder`. Giữ quy tắc
  thanh toán trễ 24h (chủ dự án chốt): webhook khớp trong 24h sau `expiresAt` thì tự fulfil, trễ hơn ghi MATCHED để tenant xử lý tay.
  `runOrderSweep` trả số đơn chuyển EXPIRED.
- **`apps/web/worker.ts`:** không deploy, chỉ local/server riêng; vẫn bật schedule/supervise (`order.sweep` 5 phút, `subscription.sweep`
  hằng giờ); handler dùng chung `job-handlers.ts`.
- **Test:** integration M8 `order.test.ts` `afterAll` dọn job pg-boss do chính lượt test tạo (chưa chạy thật). Không thêm test case.
- **Vận hành (chủ dự án làm):** chạy `docs/ops/2026-10-16-pgboss-cleanup.sql` (dọn job test + job sweep tồn + lịch pg-boss cũ, bước 1 kiểm
  kỳ vọng trước); đặt `CRON_SECRET` trên Vercel (Production) rồi redeploy, kiểm Settings → Cron Jobs.

**Số test:** `pnpm test:count` = **93/94 unit, 52/53 integration** — không đổi. Nợ test + việc còn lại: `docs/BACKLOG.md` mục "Phát sinh
trong đợt ADR-036". KB: `02-System-Specs/Background-Jobs-Specs.md`, `02-System-Specs/Order-State-Machine.md` §3.1/§3.4,
`03-API-Contracts/Endpoint-Directory.md` §17, `04-Operations-Runbooks/Deploy-Vercel-Runbook.md` §3.4/§6.

## M12a — Audit log (ADR-037) — xong code, chưa commit/deploy — 2026-10-16

**Đã xong code, chưa commit, chưa deploy. Migration đã áp lên DB dùng chung 2026-10-16.** Quyết định: ADR-037 (M12 chia 3 đợt
deploy riêng: M12a Audit log → M12b Thống kê → M12c Báo cáo vi phạm).

- **DB — migration `20261016090000_m12a_audit_logs`** (expand, chỉ thêm): enum `AuditScope` (`SYSTEM`/`TENANT`/`CUSTOMER`), bảng L1
  `audit_logs` (không khoá ngoại tới users/tenants, không RLS), 3 index `(createdAt)`, `(tenantId, createdAt)`, `(actorId, createdAt)`.
  Chỉ INSERT: role `gieochu_app` có SELECT/INSERT/DELETE (không UPDATE/TRUNCATE); 3 trigger chặn UPDATE, TRUNCATE, và DELETE trừ khi
  phiên đặt `gieochu.audit_purge = 'on'` **và** dòng cũ hơn 12 tháng. `setup-app-role.mts` REVOKE UPDATE/TRUNCATE trên `audit_logs`
  sau lệnh cấp quyền mặc định. Đã kiểm bằng role `gieochu_app` trong transaction rollback: UPDATE/TRUNCATE bị từ chối quyền, DELETE
  (kể cả đặt cờ purge, dòng mới) bị trigger chặn mã 42501.
- **`packages/core/src/audit/audit.ts`** (subpath `@gieochu/core/audit`, cũng export ở `@gieochu/core`): 27 action (`AUDIT_ACTIONS`,
  21 theo đặc tả + 6 bổ sung), scope, nhãn tiếng Việt, `sanitizeAuditMetadata` (bỏ khoá secret/token/password/hash..., giới hạn
  4096 byte), `maskEmail`, `extractAuditIp`/`normalizeAuditUserAgent`.
- **`apps/web/lib/audit.ts`**: `audit.log` ghi **sau** khi nghiệp vụ commit, ngoài transaction, lỗi chỉ `logger` không ném (bảng chưa
  có → bỏ qua); `audit.purgeExpired` xoá dòng > 12 tháng. **`apps/web/lib/audit-query.ts`**: `listAuditLogs` (admin) và
  `listTenantAuditLogs` (chỉ OWNER, luôn lọc `tenantId`, che actor ngoài tenant + IP/User-Agent).
- **Nối audit vào nghiệp vụ:** đăng nhập/đăng nhập lỗi/dùng lại refresh, khoá/mở khoá user và tenant, tạo tenant, đổi slug, tạo/sửa
  gói, thanh toán gói, cấu hình thanh toán (platform + tenant), xuất bản/lưu trữ tài liệu, xác nhận tay/hoàn tiền đơn, cấp thêm/thu hồi
  quyền tải, tạo/thu hồi share link, ẩn/khôi phục đánh giá, `COUPON_OVERUSED`, cấu hình hệ thống. Các hàm lib thêm tham số `actorId`
  tuỳ chọn; `unlockUser(actor, id)` đổi chữ ký bắt buộc. **Chưa nối:** `REPORT_RESOLVED` (M12c), `ADMIN_VIEWED_TENANT` (chưa có trang
  chi tiết tenant), `REVIEW_HIDDEN_REFUNDED` (vẫn `logger`). Đăng nhập với email không tồn tại **không** ghi audit.
- **Cron `/api/cron/daily`:** thêm bước `audit.purge` (trước `queue.drain`).
- **Trang:** `/admin/audit` (sidebar nhóm "Giám sát" → "Nhật ký hệ thống") và `/studio/{slug}/activity` ("Hoạt động"), giao diện
  dùng chung `admin/_ui/audit-log.tsx` + `link-pagination.tsx` + `audit-log-skeleton.tsx`; `DataTable` thêm `caption` và
  `th scope="col"`.
- **Test:** trần integration 53 → 55 (`scripts/count-tests.mjs`, ADR-037 mục 6). Thêm `tests/integration/audit.test.ts` — đã chạy
  pass 2026-10-16 trên DB thật, dọn user tạm, để lại 5 dòng audit giả không xoá được (đúng ADR-037).

**Số test:** `pnpm test:count` = **93/94 unit, 53/55 integration**. Việc còn lại: `docs/BACKLOG.md` mục "Phát sinh trong đợt M12a
(ADR-037)". KB: `02-System-Specs/Audit-Log-Specs.md`, `03-API-Contracts/Database-Schema-Reference.md`,
`03-API-Contracts/Endpoint-Directory.md` §17–§18, `04-Operations-Runbooks/UI-Design-System.md` §15,
`04-Operations-Runbooks/Deploy-Vercel-Runbook.md`.

## M12b — Thống kê (ADR-037) — xong code, chưa commit/deploy — 2026-10-16

**Đã xong code, chưa commit, chưa deploy. Migration đã áp lên DB dùng chung 2026-10-16** (`gieochu_app` có SELECT/INSERT/UPDATE, không
RLS, bảng trống — backfill lần đầu khi cron chạy sau deploy). Quyết định: ADR-037 mục 5–6 + đoạn "ADR-037 — M12b chốt định nghĩa số liệu".

- **DB — migration `20261016120000_m12b_tenant_daily_stats`** (expand, chỉ thêm): bảng L1 `tenant_daily_stats` (model `TenantDailyStat`):
  `tenantId`, `date` (DATE, ngày giờ VN), `ordersPaid`, `gmvVnd` (BIGINT), `newCustomers`, `downloads`, `updatedAt`; unique
  `(tenantId, date)`, index `(date)`, FK tenant `ON DELETE CASCADE`; không RLS; chỉ số đếm/tổng tiền, không dữ liệu cá nhân.
- **`apps/web/lib/tenant-stats.ts`**: `aggregateTenantDailyStats({ fromDate, toDate, tenantIds? })` và `runStatsAggregation()` (bước cron —
  hôm qua + hôm nay giờ VN; bảng trống → backfill từ ngày có dữ liệu sớm nhất, tối đa 400 ngày; mỗi cửa sổ 31 ngày một transaction
  `withSystemJob` có advisory lock; ngày không hoạt động không tạo dòng, dòng cũ hết hoạt động về 0). Định nghĩa: GMV gộp theo `paidAt`
  (tính cả đơn sau này REFUNDED), khách mới theo `tenant_customers.firstOrderAt` (bảng không có `createdAt` — Quốc duyệt), lượt tải theo
  `download_events.createdAt`.
- **`apps/web/lib/admin-stats.ts`**: `getAdminStatsOverview({ days: 30 })` — chỉ đọc `tenant_daily_stats` + tên/slug tenant (§7.9); cửa
  sổ kết thúc hôm qua giờ VN, kèm kỳ trước, chuỗi theo ngày, top 5 gian hàng GMV > 0, `lastAggregatedAt`; bảng chưa có → `unavailable`.
- **Cron `/api/cron/daily`:** thêm bước `stats.aggregate` sau `audit.purge`, trước `queue.drain` (`results.statsAggregate`).
- **Dashboard `/admin`:** section "Hoạt động bán tài liệu (30 ngày)" (`admin/_ui/sales-stats.tsx`, Suspense riêng): 4 KPI + % so kỳ
  trước, biểu đồ cột HTML + bảng trong `<details>`, chọn chỉ số `?chi-so=gmv|don`, top 5 gian hàng, trạng thái chưa sẵn sàng/rỗng.
- **Test:** thêm `tests/integration/stats.test.ts` (test M12 thứ 2 trong trần 55 của ADR-037 mục 6) — đã chạy pass 2026-10-16 trên DB
  thật, dọn sạch dữ liệu tạm.

**Số test:** `pnpm test:count` = **93/94 unit, 54/55 integration**. Việc còn lại: `docs/BACKLOG.md` mục "Phát sinh trong đợt M12b
(ADR-037)"; sau deploy bấm Run cron để backfill (`04-Operations-Runbooks/Deploy-Vercel-Runbook.md` §6.2 bước 6). KB:
`02-System-Specs/Tenant-Stats-Specs.md`, `03-API-Contracts/Database-Schema-Reference.md`, `03-API-Contracts/Endpoint-Directory.md`
§17/§19, `04-Operations-Runbooks/UI-Design-System.md` §16, `04-Operations-Runbooks/Deploy-Vercel-Runbook.md` §6/§9.7.

## M12c — Báo cáo vi phạm (ADR-038) + Quyền lợi người mua (ADR-039) — xong code, chưa commit/deploy — 2026-10-16

**Đã xong code, chưa commit, chưa deploy. 2 migration đã áp lên DB dùng chung 2026-10-16** — Quốc kiểm bằng `gieochu_app` trong transaction
rollback: tenant đặt khoá kiểm duyệt/remedy → `42501`; tenant cấp thêm lượt khi có remedy → `42501`; `system_job` được; CHECK hình dạng chặn;
checksum migration ADR-039 khớp file. ⚠️ **Thứ tự deploy: migration TRƯỚC code** — code đọc cột mới của `products`/`reviews`/`posts`/
`entitlements`, lên trước sẽ 500 (P2022). Quyết định: ADR-038, ADR-039 + "Bổ sung ADR-039".

- **DB — `20261016150000_m12c_abuse_reports`** (expand): bảng L1 `abuse_reports` + 4 enum + CHECK; cột `moderationLockedAt`/
  `moderationReason` trên `products`/`reviews`/`posts` (CHECK: khoá ⇒ ẩn/lưu trữ) + trigger `<bảng>_guard_moderation` (chỉ `system_job`
  đặt/gỡ khoá, khi khoá không đổi trạng thái); `products.rightsConfirmedAt`/`rightsConfirmedById`.
- **DB — `20261016180000_adr039_entitlement_remedy`** (expand): enum `EntitlementRemedyStatus`; cột `remedyStatus`, `remedyRequestedAt`,
  `remedyChosenAt`, `remedyResolvedAt`, `remedyReportId` trên `entitlements`; CHECK hình dạng + `REFUNDED` ⇒ đã thu hồi; trigger
  `entitlements_guard_remedy` (ngoại lệ: INSERT `PENDING_CHOICE` cho sản phẩm đang bị khoá; `REFUND_REQUESTED → REFUNDED` trong
  `markOrderRefunded`; không đổi `downloadLimit` khi có remedy).
- **Gửi báo cáo:** route mới `POST /api/reports` (Origin, honeypot, 5/giờ/IP, chặn trùng; 201/400/403/404/409/429/503) — Quốc thử trên dev:
  201, 409 trùng, 403 thiếu Origin, đã dọn dữ liệu thử. Nút "Báo cáo vi phạm" ở trang tài liệu, từng đánh giá, trang bài viết.
- **Admin `/admin/reports`** (+ chi tiết): `resolveReportAction` (ẩn nội dung / lưu trữ tài liệu / khoá gian hàng / bác bỏ, tuỳ chọn áp cùng
  quyết định cho báo cáo OPEN khác cùng đối tượng), `unlockModerationAction`; badge số báo cáo OPEN ở sidebar. Email `abuse_report_resolved`
  (người báo cáo), `content_moderated` (chủ gian hàng) trong `after()`. Audit `REPORT_SUBMITTED`, `REPORT_RESOLVED`,
  `CONTENT_MODERATION_LOCKED/UNLOCKED`, `REMEDY_FINAL_DOWNLOAD_CHOSEN`, `REMEDY_REFUND_REQUESTED`. Cron thêm bước `abuse_report.ip_purge`.
- **Cam kết bản quyền:** bắt buộc tích mỗi lần xuất bản (`rightsConfirmed`, 400 `RIGHTS_CONFIRMATION_REQUIRED`); nội dung bị khoá → Studio
  409 `CONTENT_MODERATION_LOCKED`, UI hiện nhãn "Bị khoá kiểm duyệt".
- **Quyền lợi người mua (ADR-039):** lưu trữ tài liệu do vi phạm → entitlement `PENDING_CHOICE` (kể cả đơn 0đ), tải bị chặn
  (`REMEDY_CHOICE_REQUIRED`); A "tải lần cuối" = `downloadLimit = downloadsUsed + số tệp khả dụng` (đủ mọi tệp, tối thiểu 1); B "yêu cầu hoàn
  tiền" (chỉ đơn > 0đ) chặn tải vĩnh viễn (`DOWNLOAD_BLOCKED_REFUND`), tenant xử lý trong 7 ngày bằng nút Hoàn tiền sẵn có → `REFUNDED` +
  `remedyResolvedAt`. Đơn thanh toán muộn → `PENDING_CHOICE`. Tenant không cấp thêm lượt khi có remedy. Studio: lọc
  `?remedy=REFUND_REQUESTED`, badge sidebar/đơn; admin chỉ thấy số đếm quá hạn theo tenant. Thư viện khách: 2 lựa chọn + hộp thoại xác nhận +
  cảnh báo trước khi tải lần cuối. Email `entitlement_remedy_customer`, `entitlement_remedy_tenant`, `remedy_refund_requested`.
- **Sửa lỗi cũ quan trọng (RLS):** `sendOrderPaidEmailsInner` và `resolveUniqueOrderCode` đọc `orders` bằng client không scope → RLS trả 0
  dòng → email `order_paid`/`new_sale` **chưa từng gửi**, kiểm trùng mã đơn chưa từng chạy. Nay đọc dưới `withSystemJob`; email đơn chỉ gửi
  khi lần gọi thật sự fulfil đơn. **Sau deploy, email đơn hàng bắt đầu gửi thật lần đầu.**
- **Chặn thanh toán:** `initiateOrderCheckout`/`applyCouponToOrder` → 409 `PRODUCT_UNAVAILABLE` khi sản phẩm không `PUBLISHED` hoặc tenant
  không `ACTIVE` (đổi hành vi với tenant `READ_ONLY` — "Bổ sung ADR-039 lần 2" (g); chủ dự án đã chốt chặn qua ADR-040 mục 4).
- **Test:** không thêm (ADR-038 mục 8, ADR-039 mục 6) — nợ ở BACKLOG.

**Số test:** `pnpm test:count` = **93/94 unit, 54/55 integration** (Long chạy 2026-10-17, chỉ đếm). Việc còn lại: `docs/BACKLOG.md` mục
"Phát sinh trong đợt M12c (ADR-038) + ADR-039"; deploy theo `04-Operations-Runbooks/Deploy-Vercel-Runbook.md` §9.8. KB:
`02-System-Specs/Abuse-Reports-Specs.md`, `02-System-Specs/Order-State-Machine.md` §3.7–§3.8, `02-System-Specs/File-Storage-And-Downloads-Specs.md`
§8, `03-API-Contracts/Database-Schema-Reference.md`, `03-API-Contracts/Endpoint-Directory.md` §17/§20, `04-Operations-Runbooks/UI-Design-System.md`
§17, bản trích `01-Architecture-Decisions/ADR-024` (≙ ADR-038), `ADR-025` (≙ ADR-039).

## Chỉ gian hàng ACTIVE hiển thị tài liệu (ADR-040) — xong code, chưa commit/deploy — 2026-10-17

Chủ dự án chốt: gian hàng chỉ hiển thị tài liệu khi `ACTIVE`. Không migration, không thêm test.

- `resolveStorefrontAccess` (`packages/core/src/tenant/access-policy.ts`): `READ_ONLY` + khách → `SUSPENDED_NOTICE`; `READ_ONLY` + chủ →
  `READ_ONLY`; `LOCKED` giữ nguyên. Unit test access-policy cập nhật kỳ vọng (không đổi số test).
- `/[tenantSlug]`: khách của gian hàng `READ_ONLY` chỉ thấy trang "Gian hàng đang tạm ngưng hoạt động" (`StorefrontSuspendedNotice`, khung
  hệ thống, nút "Mở Thư viện của tôi") — trả về trước mọi loader; metadata tenant không `ACTIVE` → `noindex`. Chủ thấy storefront +
  `StorefrontNotice` với lời mới.
- Trang tài liệu `/{slug}/{productSlug}`, `/{slug}/posts`, `/{slug}/posts/{postId}`: khách 404 khi tenant không `ACTIVE`; metadata `{}`.
- `POST /api/reports`: đối tượng của tenant không `ACTIVE` → 404 `REPORT_TARGET_NOT_FOUND`. Share link (mở + tải) → 410
  `SHARE_LINK_TENANT_LOCKED`. Gửi/sửa đánh giá → 409 `TENANT_NOT_ACTIVE`.
- Thanh toán đơn `PENDING` khi tenant không `ACTIVE`: chặn (`PRODUCT_UNAVAILABLE`, chốt ADR-039 (g)). Thư viện/tải của khách đã mua giữ
  nguyên. `/cua-hang`, trang chủ vốn chỉ lấy tenant `ACTIVE`.
- Còn lại: chủ xác định bằng `ownerId` (chưa xét thành viên khác) — `docs/BACKLOG.md`.

**Số test:** `pnpm test:count` = **93/94 unit, 54/55 integration** (Long chạy 2026-10-17, chỉ đếm). KB:
`02-System-Specs/Storefront-CMS-Specs.md` §1.2, bản trích `01-Architecture-Decisions/ADR-026` (≙ ADR-040), `00-Index/KB-Audit-2026-09-26.md` §19.

## Câu hỏi còn mở (đã chọn phương án an toàn, xem ADR tương ứng)

- ID strategy: cuid2 (ADR-001).
- `downloadLimit=0` nghĩa là không giới hạn (ADR-015).
- Local dev DB: khuyến nghị dùng Neon branch miễn phí thay vì Postgres container, vì `@prisma/adapter-neon`
  cần giao thức Neon serverless (ADR-004).
- `UserProfile` tạo một phần lúc đăng ký, hoàn thiện dần sau (ADR-008).
- Integration test dùng chung Neon DB với dev, chưa có `TEST_DATABASE_URL` riêng (ADR-009).
- App kết nối DB bằng role `gieochu_app` riêng (không phải owner Neon) để RLS có hiệu lực thật; CLI/migrate
  dùng `PRISMA_MIGRATE_URL` riêng (ADR-010).
- `platform_payment_configs` tạo sớm ở M7 (bảng trống, chưa UI) để test webhook cross-scope đúng nghĩa đen —
  đã hỏi người dùng trước khi làm (ADR-011).
- Dedupe hoá đơn `PENDING` + tự tắt `PlatformPaymentConfig` khi đổi tài khoản/secret ở M3, theo báo cáo tham
  khảo TaniGos người dùng cung cấp (ADR-013).
- M5 chia 2 phần (metadata/CRUD trước, upload/storage R2 thật sau) vì máy code không có Docker — đã hỏi
  người dùng trước khi làm (ADR-014).
- CSP chuyển sang sinh động (nonce) trong `proxy.ts` thay vì header tĩnh trong `next.config.ts` — sửa lỗi
  chặn hydrate React phát hiện khi test qua trình duyệt thật (ADR-016).
- Cấu hình storage (endpoint/bucket/access key R2) quản lý qua System Admin + DB mã hoá thay vì biến môi
  trường — đã trình bày đánh đổi bảo mật rồi hỏi người dùng trước khi làm (ADR-017).
- `file.scan` không có ClamAV thật → luôn `CLEAN` sau kiểm tra định dạng, kể cả khi có set `CLAMAV_HOST`
  (ADR-018) — đúng phương án dự phòng đặc tả đã gợi ý.
- `order.sweep` chạy mỗi 5 phút thay vì mỗi giờ như các job sweep khác, vì TTL đơn PENDING ngắn hơn nhiều so
  với chu kỳ subscription (ADR-019). *(ADR-036 thay trên Vercel: sweep hằng ngày qua cron + `effectiveOrderStatus` khi đọc.)*
- `DownloadToken` là bảng L1 (không RLS), `ShareLink`/`DownloadEvent` là L2 — và 3 policy RLS đã có
  (`products`, `product_files` từ M4/M5) được sửa thêm nhánh "customer" ở M9 sau khi chính test thật bắt
  được lỗ hổng (ADR-020).
- Hash mật khẩu share link dùng argon2 riêng trong `packages/core` (không gọi lại `packages/auth`'s
  password functions) để giữ đúng chiều phụ thuộc package — `core` không bao giờ phụ thuộc `auth` (ADR-020).
- Chưa hỏi người dùng các quyết định ảnh hưởng tiền/bảo mật/dữ liệu cá nhân — sẽ dừng lại đúng lúc theo mục
  0.6 khi gặp.

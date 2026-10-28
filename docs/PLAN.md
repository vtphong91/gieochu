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
| M11 | Email và Background Jobs | 🟡 Email gửi đồng bộ (`sendEmailNow`); **job nền theo ADR-036: đã commit `9a3208f`, deploy ❓ chờ chủ dự án** — `after()` drain hàng đợi trong route + Vercel Cron hằng ngày `GET /api/cron/daily`, `worker.ts` chỉ còn cho local | `packages/jobs`, `packages/email`, `apps/web/lib/{jobs,job-handlers,job-runner}.ts`, `apps/web/app/api/cron/daily`, `apps/web/worker.ts` | 0 / 0 (tính trong module khác) |
| M12 | Audit Log, Thống kê, Báo cáo vi phạm (chia 3 đợt theo ADR-037) | 🟡 **Xong code cả 3 đợt — chờ commit/deploy** (M12a Audit log, M12b Thống kê, M12c Báo cáo vi phạm + quyền lợi người mua ADR-038/039; 4 migration đã áp DB 2026-10-16 — M12c/ADR-039 phải áp **trước** khi deploy code) | M12a: `packages/core/src/audit`, `apps/web/lib/{audit,audit-query}.ts`, `apps/web/app/admin/audit`, `apps/web/app/studio/[tenantSlug]/activity`; M12b: `apps/web/lib/{tenant-stats,admin-stats}.ts`, `apps/web/app/admin/_ui/sales-stats.tsx`, `apps/web/app/admin/page.tsx`; M12c: `packages/core/src/report`, `packages/core/src/download/entitlement-remedy.ts`, `apps/web/lib/{abuse-report,entitlement-remedy,moderation,tenant-lock,origin-guard}.ts`, `apps/web/app/api/reports`, `apps/web/app/admin/reports`, `apps/web/app/account/library` | 2 / 2 (M12a `audit.test.ts`, M12b `stats.test.ts`) |
| | **Tổng** | | | Trần gốc mục 9: **91 / 50** · trần hiện **100 / 66** (ADR-026 + ADR-037 mục 6 + ADR-050 + ADR-053 + ADR-054) · thực **100 / 66** — chạm trần (`pnpm test:count` 2026-10-25 vẫn 100/66 sau ADR-056 — chỉ thêm assert trong case có sẵn; 2026-10-24, sau ADR-053 bổ sung lần 3 +1/+2 và ADR-054 +0/+1; trước đó 99/63 sau ADR-053 phiên đăng nhập +4/+6; trước đó 95/57 sau ADR-050, 94/55 sau ADR-043). Cộng cột theo module ra 92 / 51 — cột là ngân sách gốc từng module, không phải số thực |

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
- Integration test chụp/khôi phục cấu hình dùng chung (`tests/integration/shared-config-snapshot.ts`) thay vì xoá. *(Đã thay 2026-10-25: mock lớp đọc cấu hình, helper đã xoá — xem mục "Integration test không ghi cấu hình dùng chung" bên dưới.)*

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

## Cửa hàng GĐ1 + GĐ2 (ADR-035) — đã commit `f021ed3`, deploy ❓ chờ chủ dự án — 2026-10-15

**GĐ1 (CMS Cửa hàng trong System Center) và GĐ2 (trang công khai `/cua-hang`, `/cua-hang/tai-lieu`) đã xong code, đã commit `f021ed3`,
deploy ❓ chờ chủ dự án.** Quyết định: ADR-035 + "Bổ sung ADR-035" + "Chủ dự án chốt". Kế hoạch: `docs/ke-hoach-cua-hang-marketplace-2026-10-15.md`
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

## Job nền trong app + Vercel Cron hằng ngày (ADR-036) — đã commit `9a3208f`, deploy ❓ chờ chủ dự án — 2026-10-16

**Đã xong code, đã commit `9a3208f`, deploy ❓ chờ chủ dự án.** Quyết định: ADR-036 + "Chủ dự án chốt (2026-10-16)". Bối cảnh: Vercel không chạy worker
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

## M12a — Audit log (ADR-037) — đã commit `36103fb`, deploy ❓ chờ chủ dự án — 2026-10-16

**Đã xong code, đã commit `36103fb`, deploy ❓ chờ chủ dự án. Migration đã áp lên DB dùng chung 2026-10-16.** Quyết định: ADR-037 (M12 chia 3 đợt
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

## M12b — Thống kê (ADR-037) — đã commit `36103fb`, deploy ❓ chờ chủ dự án — 2026-10-16

**Đã xong code, đã commit `36103fb`, deploy ❓ chờ chủ dự án. Migration đã áp lên DB dùng chung 2026-10-16** (`gieochu_app` có SELECT/INSERT/UPDATE, không
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

## M12c — Báo cáo vi phạm (ADR-038) + Quyền lợi người mua (ADR-039) — đã commit `36103fb`, deploy ❓ chờ chủ dự án — 2026-10-16

**Đã xong code, đã commit `36103fb`, deploy ❓ chờ chủ dự án. 2 migration đã áp lên DB dùng chung 2026-10-16** — Quốc kiểm bằng `gieochu_app` trong transaction
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

## Chỉ gian hàng ACTIVE hiển thị tài liệu (ADR-040) — đã commit `36103fb`, deploy ❓ chờ chủ dự án — 2026-10-17

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

## Nâng cấp tài khoản + Hồ sơ + hoàn tiền gói (ADR-041) — GĐ1 + GĐ2 đã commit `7f8360b`, GĐ2b đã commit `9d37ab1`, deploy ❓ chờ chủ dự án — 2026-10-17

Chủ dự án + Quốc chốt ngày 2026-10-17, ghi ở **ADR-041** (`docs/DECISIONS.md`, gồm bổ sung ADR-008 và 3 lần "Bổ sung ADR-041"). Kế hoạch:
[docs/ke-hoach-nang-cap-tai-khoan-va-ho-so-2026-10-17.md](ke-hoach-nang-cap-tai-khoan-va-ho-so-2026-10-17.md) (nguồn: hai đề xuất của Phong
`docs/de-xuat-trang-bang-gia-2026-10-17.md`, `docs/de-xuat-trang-ho-so-2026-10-17.md`). Theo nguyên tắc "CMS/dữ liệu trước, UI sau".

**Migration (expand, đã áp DB dùng chung 2026-10-17):** `20261017090000_adr041_email_change` (`VerificationTokenType.EMAIL_CHANGE`,
`verification_tokens.newEmail` — **bắt buộc trước code**, thiếu → P2022) và `20261017100000_adr041_subscription_refunds`
(`SubscriptionInvoiceStatus.REFUNDED`, enum `SubscriptionRefundStatus`, bảng L1 `subscription_refund_requests` + 3 CHECK, `payoutEncrypted`
AES-256-GCM). Deploy được.

- **A. Bảng giá:** `packages/core/src/admin/pricing-sections.ts` (9 section, ghép gói năm bằng `altPlanId`, % tiết kiệm tính từ giá thật,
  biến `{brand}`/`{graceDays}`); `"pricing"` vào `SYSTEM_CMS_SLUGS`; `apps/web/lib/pricing-cms.ts` (`getPricingCmsEditorData`,
  `getPricingPageData` — viewer ANON/NO_TENANT/TENANT, xem nháp chỉ admin); editor `/admin/cms/pricing` (pattern Cửa hàng, `SortableListEditor`
  dùng chung, kiểm tra phía client) + SEO CMS (≤120/≤320, cột không có nháp, chỉ dùng khi PUBLISHED); trang `/pricing` dựng lại
  (`app/_ui/pricing/*`, layout hệ thống, toggle Tháng/Năm radio, bảng so sánh cuộn trong khung, FAQ `<details>`, noindex khi xem nháp);
  Billing Studio nhận `?plan=`. Hạn mức **0 = không được phép, -1 = không giới hạn** (`PLAN_LIMIT_UNLIMITED`, `describePlanLimit`/
  `formatPlanLimit`, form gói có gợi ý). `IMPLEMENTED_PLAN_FEATURES = []` — trang không quảng cáo cờ chưa có.
- **Hoàn tiền gói:** 7 ngày, 100%, chỉ hoá đơn PAID đầu, mất quyền khi có hoá đơn PAID thứ hai (`REFUND_LATER_PAYMENT_EXISTS`, kiểm lại khi
  duyệt). Studio Billing: form + trạng thái. `/admin/billing/refunds`: lọc, che STK, "Xem đầy đủ" (audit `SUBSCRIPTION_REFUND_PAYOUT_VIEWED`
  chỉ id), Đã hoàn/Từ chối xác nhận 2 bước, `approveBlocked`, badge số yêu cầu chờ ở menu. Đã hoàn → hoá đơn `REFUNDED` + về Free + xoá
  thông tin nhận tiền (1 transaction). `markInvoicePaid` bỏ qua hoá đơn `REFUNDED`. 3 email `subscription_refund_*` không chứa STK.
- **B. Hồ sơ:** `/account` thành Tổng quan (app shell + header gọn, sidebar 3 nhóm, mobile danh sách mục), Hồ sơ (avatar Cloudinary
  `users/<id>/avatar/`, ≤2MB, `avatarUploadEnabled` ẩn ô tải nhưng vẫn cho gỡ; SĐT/Tỉnh tuỳ chọn — 34 tỉnh), Bảo mật (đổi mật khẩu giữ phiên
  hiện tại + thu hồi phiên khác; đổi email qua `/account/email/xac-nhan`; đăng xuất mọi thiết bị); menu tài khoản có avatar (disclosure) ở
  header công khai + Studio; `getCachedAccountOverview`; bất biến "tenant luôn có subscription" (không fallback, chỉ `logger.warn`). Audit
  `AUTH_PASSWORD_CHANGED`/`AUTH_EMAIL_CHANGE_REQUESTED`/`AUTH_EMAIL_CHANGED` (+ `PRICING_CMS_UPDATED`, 4 action hoàn tiền — tổng 40 action),
  4 email tài khoản mới. Kit: `PrimaryButton`/`GhostButton` 44px dưới `lg`, `PasswordField` a11y + `toggleLabel`.
- **Kiểm thử dữ liệu thật (Hiếu, 2026-10-17):** 23/23 ca + 1 ca phụ đạt, gọi lib trực tiếp, email mock, đã dọn (audit để lại theo ADR-037). Chưa
  kiểm qua UI có đăng nhập, chưa SMTP thật. Build/lint/typecheck xanh; build sạch từ `F:\VSCODE\gieochu` (lỗi `workStore` chỉ khi 2 build song
  song chung `.next` hoặc chạy từ `f:\` chữ thường).
- **GĐ2b:** menu điều hướng mobile Studio — **xong code 2026-10-17** theo ADR-042 (mục dưới).
- **Test:** không thêm (ADR-041) — `pnpm test:count` = **93/94 unit, 54/55 integration** (Long chạy 2026-10-17). Nợ test ghi `docs/BACKLOG.md`.
- **Còn mở:** BG-Q9 (về Free khi vượt hạn mức Free); đổi email thu hồi mọi phiên (ADR ghi "phiên khác"); gói prod để `0` với ý không giới hạn
  cần kiểm. KB: `02-System-Specs/{Pricing-Page-Specs,Account-Profile-Specs,Payment-And-Billing}.md`, bản trích
  `01-Architecture-Decisions/ADR-027` (≙ ADR-041), `00-Index/KB-Audit-2026-09-26.md` §21.

## Sidebar dùng chung System Center + Studio, Đăng xuất, drawer mobile (ADR-042) — đã commit `9d37ab1`, deploy ❓ chờ chủ dự án — 2026-10-17

Chủ dự án yêu cầu: sidebar Studio cùng style System Center; dashboard admin/Studio có Đăng xuất; hoàn tất GĐ2b ADR-041. Không migration, không
đổi API/schema, không thêm test.

- **Một sidebar:** `apps/web/app/admin/_ui/sidebar-nav.tsx` — `SidebarNav` dùng chung (icon key chuỗi, badge `{count, srText, urgent?}`,
  accordion 1 nhóm mở, nhớ `localStorage` `admin:nav:expanded`/`studio:nav:expanded`, `aria-current`, active `color-mix` từ accent) +
  `AdminSidebarNav`. Sidebar riêng Studio `studio/[tenantSlug]/_ui/sidebar-nav.tsx` **đã xoá**. Studio: Tổng quan + Bán hàng (Đơn hàng, Khách
  hàng, Mã giảm giá) / Nội dung (Sản phẩm, Bài viết, Trang bán hàng, Đánh giá) / Gian hàng (Hộp thư, Gói dịch vụ, Hoạt động — chỉ OWNER, Cài
  đặt); badge bỏ hậu tố "(N)" trong nhãn.
- **Đăng xuất:** `admin/_ui/app-sidebar.tsx` (`AppSidebarPanel`) — Đăng xuất cố định đáy sidebar (`LogoutButton tone="onDark"
  redirectTo="/login"`); `AccountMenu` thêm `logoutRedirect` (admin/Studio `/login`; trang công khai, `/account` giữ `/`), `variant="app"` cho
  cả header admin (viền + chevron), header admin lấy họ tên + avatar qua `getAccountHeaderData`. `LogoutButton` thêm `redirectTo`/`tone`.
- **Mobile:** `admin/_ui/sidebar-drawer.tsx` (`SidebarDrawer`) — nút ☰ mở `<dialog>` `showModal()` chứa cùng sidebar; đóng Esc/nền/link/đổi
  trang/lên `lg`, trả focus; `globals.css` `.app-drawer` khoá cuộn + animation tắt khi reduced-motion.
- **Kiểm:** lint/typecheck/build đạt; xem trước dữ liệu giả 360/768/1280, bàn phím drawer. **Chưa** kiểm phiên đăng nhập thật, đăng xuất thật,
  trình đọc màn hình. Việc còn lại: `docs/BACKLOG.md` mục "Phát sinh trong đợt ADR-042" (skip-link shell admin/Studio, chuyển `LogoutButton`
  về `app/_ui/`).

**Số test:** `pnpm test:count` = **93/94 unit, 54/55 integration** (Long chạy 2026-10-17, chỉ đếm). KB:
`04-Operations-Runbooks/UI-Design-System.md` §5.1/§11.1/§12.6/§18.5, `02-System-Specs/User-Management-System-Center-Specs.md` §2,
`02-System-Specs/Account-Profile-Specs.md` §5, bản trích `01-Architecture-Decisions/ADR-028` (≙ ADR-042), `00-Index/KB-Audit-2026-09-26.md` §22.

## Dashboard Tổng quan gian hàng (ADR-043) — đã commit (`e5d63d0`; "Bổ sung lần 3" trong `dd349b9`), deploy ❓ chờ chủ dự án; "Bổ sung lần 4" xong code, chưa commit — 2026-10-18 → 2026-10-23

Chủ dự án chốt §9 kế hoạch [ke-hoach-dashboard-tong-quan-gian-hang-2026-10-17.md](ke-hoach-dashboard-tong-quan-gian-hang-2026-10-17.md) ngày
2026-10-18 → **ADR-043** + "Bổ sung ADR-043" (`docs/DECISIONS.md`). Dữ liệu nghiệp vụ, không có GĐ CMS. Không migration, không route HTTP mới.

- **GĐ1 — dữ liệu (Hiếu):** `packages/core/src/stats/dashboard-range.ts` (subpath `@gieochu/core/dashboard-range`) — `resolveDashboardRange`,
  `listDashboardBuckets`, 9 kỳ `?ky=` (mặc định 30 ngày, tuần bắt đầu Thứ Hai, giờ VN, tuỳ chọn `tu`–`den` ≤ 366 ngày, so kỳ trước cùng độ dài,
  đầu vào sai → 30 ngày + cờ `invalid`). `apps/web/lib/tenant-dashboard.ts` — `getTenantDashboard`: 3 truy vấn trong một `withTenant` + điều
  kiện `tenantId` tường minh, không đọc `tenant_daily_stats`, không cache, tiền số nguyên an toàn. Định nghĩa: chỉ đơn > 0đ cho doanh thu
  gộp/thực nhận/đã hoàn, số đơn, giá trị TB, tài liệu khác nhau, người mua, khách quay lại, biểu đồ; đơn 0đ → `freeClaims`; thực nhận = gộp −
  đơn REFUNDED theo `paidAt`; khách quay lại = ≥ 2 đơn > 0đ tính tới hết kỳ; khách mới theo `firstOrderAt` (gồm khách chỉ nhận miễn phí — khớp
  System Center); top 5 bán chạy loại đơn REFUNDED, gồm đơn 0đ; điểm TB chỉ đánh giá VISIBLE; top đánh giá ≥ 3 đánh giá; 10 đơn mới nhất mọi
  trạng thái, không lọc kỳ, chỉ mã/họ tên/đơn giá/thành tiền — không email.
- **GĐ2 — UI (Phong):** trang chuyển vào route group `apps/web/app/studio/[tenantSlug]/(tong-quan)/` (`page.tsx`, `loading.tsx`, `error.tsx` —
  không phủ trang con), `_ui/dashboard.tsx`, `_ui/dashboard-format.ts`, `_ui/dashboard-skeleton.tsx`. Component chung mới
  `apps/web/app/admin/_ui/stats-chart.tsx` (`KpiCard`, `ChangeLine`, `computeChange` BigInt, `TrendChart`, `RatioBar`, `StatIcon`) —
  `sales-stats.tsx` (`/admin`) refactor dùng chung; icon `IconArrowUp/Down`, `IconStarSolid`, `IconGift`. Khối: Việc cần xử lý → chip kỳ + tuỳ
  chọn → KPI bán hàng + phụ → biểu đồ (gộp/thực nhận `?chi-so=`, đường số đơn) + top 5 → 10 đơn mới → Khách / Đánh giá / Tài liệu; chưa có đơn →
  checklist 3 bước.
- **Kiểm:** lint/typecheck/build đạt (Quốc chạy lại 2026-10-18); integration `studio-dashboard.test.ts` chạy thật đạt, dọn dữ liệu; xem trước
  dữ liệu giả 360/768/1280. **Chưa** kiểm phiên OWNER thật, `/admin` sau refactor, bàn phím/trình đọc màn hình. Việc còn lại: `docs/BACKLOG.md`
  mục "Phát sinh trong đợt ADR-043".
- **"Bổ sung ADR-043 lần 3" (2026-10-18, chủ dự án yêu cầu; đã commit trong `dd349b9` — `git log`, Long đối chiếu 2026-10-23):**
  - *Dữ liệu (Hiếu):* `dashboard-range.ts` thêm `tuan-truoc` (Thứ Hai–Chủ nhật tuần trước, theo ngày), `thang-truoc` (theo ngày), `quy-truoc`
    (theo tuần) → 12 mốc, thứ tự = danh sách mốc picker; ba mốc đã kết thúc so với **trọn** kỳ liền trước (ngoại lệ có chủ đích của mục 5);
    `DashboardRange.displayFrom/displayTo` (`YYYY-MM-DD` giờ VN, gồm ngày cuối), cũng có trong `TenantDashboardRangeView`.
  - *UI (Phong):* `(tong-quan)/_ui/date-range-picker.tsx` (`DashboardDateRangePicker`) — ô `dd/mm/yyyy - dd/mm/yyyy` + `<dialog>` `showModal`
    (≥ xl popover 2 tháng, 768–1279px 1 tháng, < 768px sheet đáy), mốc là link `?ky=`, lịch có cột tuần ISO, Thứ Hai đầu tuần, chọn tháng/năm (lùi
    10 năm), ngày tương lai vô hiệu + gạch, bàn phím đầy đủ, tối đa 366 ngày; thay chip kỳ + form tuỳ chọn cũ; **cần JS**. Số đầy đủ `vi-VN` cho
    thẻ/dòng phụ/top 5/bảng/tooltip, chỉ trục Y rút gọn (`formatVndAxis`, đổi tên từ `formatVndCompact`), `statValueSizeClass` — áp cả `/admin`
    (`sales-stats.tsx`, thẻ "Doanh thu gói dịch vụ"). `IconCalendar`, CSS `.range-picker`.
  - *Kiểm (báo cáo):* lint/typecheck/build đạt, Playwright kiểm bàn phím, 360/1100/1440 không cuộn ngang; chưa kiểm phiên OWNER thật. Test chỉ thêm
    assertion — vẫn **94/94 unit, 55/55 integration** (Long chạy `pnpm test:count` 2026-10-18).
- **"Bổ sung ADR-043 lần 4" (2026-10-23, chủ dự án yêu cầu; cuối mục ADR-043 `docs/DECISIONS.md`; working tree, chưa commit):** chỉ lớp trình bày, không
  đổi loader/contract, không migration.
  - Trục Y biểu đồ tiền (Studio + System Center) hiện **số đầy đủ** `formatVndFull`; **xoá** `formatVndAxis` (`admin/_ui/stats-chart.tsx`); cột nhãn
    co theo nhãn dài nhất, dưới `sm` `max-w-[5.5rem]` xuống dòng trước "đ".
  - Toggle chỉ số **phía client**: `admin/_ui/metric-toggle.tsx` (`useUrlMetric` — state + `window.history.replaceState` giữ `?chi-so=`, đồng bộ
    ngược qua `useSearchParams`; `MetricToggle` 2 nút `aria-pressed` trong `role="group"`); System Center `admin/_ui/sales-daily-chart.tsx`
    (GMV/Đơn, GMV từ chuỗi BigInt) + `admin/_ui/sales-chart-metric.ts` (type + `parseSalesChartMetric` thuần); Studio
    `(tong-quan)/_ui/revenue-chart-switcher.tsx` (Gộp/Thực nhận). Bỏ link GET `?chi-so=`; date range picker dashboard đọc `chi-so` bằng
    `useSearchParams` (bỏ prop `metric`).
  - `<details>` "Xem bảng số liệu theo …" có chevron `IconChevronDown` bên phải (`group-open:rotate-180 motion-safe:transition-transform`, ẩn marker);
    bảng "10 đơn mới nhất" dashboard hiện "0 đ" (trang Đơn hàng vẫn "Miễn phí").
  - *Kiểm (Quốc báo):* tsc/eslint/build đạt; **chưa kiểm trình duyệt**. Không có file test trong thay đổi (`git status`) — số test không đổi.
    KB: `UI-Design-System.md` §16, §19 (§19.6, §19.8 mới), `Studio-Dashboard-Specs.md` đầu trang/§4.6/§4.7/§6, bản trích `01-Architecture-Decisions/ADR-029`.

**Số test:** +1 unit (`packages/core/src/stats/dashboard-range.test.ts`) +1 integration (`apps/web/tests/integration/studio-dashboard.test.ts`),
không nâng trần — `pnpm test:count` = **94/94 unit, 55/55 integration** (Long chạy 2026-10-18, chỉ đếm) — **chạm trần**; test mới cần chủ dự án
duyệt nâng trần. KB: `02-System-Specs/Studio-Dashboard-Specs.md` (mới), `02-System-Specs/Tenant-Stats-Specs.md` §9,
`03-API-Contracts/Endpoint-Directory.md` §22, `04-Operations-Runbooks/UI-Design-System.md` §6/§16/§19 (lần 3: §19.5 date range picker, §19.6
quy tắc số), bản trích `01-Architecture-Decisions/ADR-029` (≙ ADR-043), `00-Index/KB-Audit-2026-09-26.md` §23, §24 (lần 3).

## Nâng cấp trang Đơn hàng Studio — danh sách + chi tiết (ADR-046) — đã commit `dd349b9`, deploy ❓ — 2026-10-18

Chủ dự án yêu cầu 2026-10-18 (tham khảo WooCommerce) → **ADR-046** (`docs/DECISIONS.md`). Dữ liệu nghiệp vụ, không có GĐ CMS. **Không migration,
không `route.ts`/Server Action mới**; `orders/[orderId]/actions.ts` không đổi (luật các thao tác tiền giữ nguyên).

- **Dữ liệu (Hiếu):** `apps/web/lib/order.ts` — `listOrdersPage`, `parseOrderListQuery`, `buildOrderListSearch`, `orderAllowedActions`,
  `getOrderDetailView` + hằng `ORDER_LIST_*`. URL: `trang-thai` (alias `status`), `remedy`, `q` (mã/họ tên/email, NFC, ≤ 100 ký tự, escape),
  `ky`/`tu`/`den` (theo `createdAt`; không có = mọi thời gian), `san-pham`, `sap-xep` (`moi-nhat`|`cu-nhat`|`tong-giam`|`tong-tang`), `trang`,
  `so-dong` (10/20/50/100, mặc định 20). `statusCounts` theo trạng thái hiệu lực, áp mọi bộ lọc trừ trạng thái; số yêu cầu hoàn tiền / quá hạn tính
  toàn gian hàng. `allowedActions`: xác nhận theo `canManuallyConfirmOrder`, huỷ khi PENDING hiệu lực, hoàn tiền khi FULFILLED. Chi tiết: kênh thanh
  toán suy ra (PROVIDER / MANUAL theo `confirmNote` / FREE / UNKNOWN / UNPAID), dòng tài liệu (đơn giá lúc mua, giảm giá, mã giảm giá), giao dịch
  (không `rawPayload`), lịch sử khách (chỉ đơn > 0đ: số đơn, tổng chi tiêu gộp, đã hoàn, TB), dòng thời gian từ dữ liệu có sẵn (tạo / thanh toán /
  giao dịch / audit đơn + entitlement không IP-UA / email `order_paid` & `remedy_refund_requested` lọc theo mã đơn; huỷ lấy `updatedAt`, hết hạn lấy
  `expiresAt`). Khách chỉ họ tên + email (ADR-041). L2 trong một `withTenant`, chỉ OWNER.
- **Quy ước mới:** input người dùng vào Prisma `contains` phải qua `escapeContainsValue` (`apps/web/lib/prisma-contains.ts`) — đã áp `lib/order.ts`,
  `lib/home.ts` (3 chỗ), `app/admin/users/page.tsx`; SQL thô dùng `escapeLikePattern` + `ESCAPE '\'`.
- **UI (Phong):** `orders/_ui/{order-format.ts, order-filter-form.tsx, order-list.tsx, order-row-actions.tsx, order-detail-parts.tsx,
  order-skeleton.tsx}`, `orders/loading.tsx`, `orders/[orderId]/loading.tsx`, `orders/error.tsx`. Danh sách: thanh lọc form GET (dropdown trạng
  thái kèm số đếm, hoàn tiền, tài liệu, số dòng, ô ngày `DashboardDateRangePicker` (dùng chung `admin/_ui/`) `formMode` + "Mọi thời gian", ô tìm, Xoá lọc; URL rút gọn bỏ ô
  rỗng/mặc định), bảng từ `xl` / thẻ dưới `xl`, sắp xếp bằng tiêu đề cột (`aria-sort`), menu dòng `RowMenu` (Xem, Xác nhận → `#order-actions`,
  Hoàn tiền/Huỷ → `<dialog>` xác nhận gọi action cũ), Notice yêu cầu hoàn tiền, `LinkPagination pageParam="trang"`. Chi tiết: `MainAsideGrid` —
  Thông tin chung + Khách, Tài liệu trong đơn (+ quyền tải theo dòng: cấp thêm lượt, thu hồi 2 bước; remedy), Giao dịch; cột phụ Thao tác đơn (chỉ
  thao tác hợp lệ, 2 bước), Lịch sử khách, Lịch sử đơn (mới nhất trên). `?back=` giữ bộ lọc (whitelist khoá, không open redirect). Kit:
  `DataTable.head` `ReactNode[]` + `headAriaSort`; `LinkPagination.pageParam`; `DashboardDateRangePicker.formMode`; dashboard link `?trang-thai=PENDING`.
- **"Bổ sung ADR-046" (Quốc, đính chính theo code):** bảng dòng hiện đơn giá lúc mua; cấp thêm lượt / thu hồi đặt theo dòng ở cột chính; bộ lọc
  dùng form GET riêng; tìm phân biệt dấu (không dấu → BACKLOG). Sửa kèm: tiền tách `formatOrderPrice` (giá/tổng đơn, dòng: 0 → "Miễn phí") và
  `formatOrderVnd` (số tổng hợp, giảm giá, giao dịch: 0 → "0 đ"); date range picker chuyển sang `apps/web/app/admin/_ui/date-range-picker.tsx` dùng
  chung (`hrefForPreset`/`hrefForCustom` hoặc `formMode`), dashboard dùng wrapper `(tong-quan)/_ui/dashboard-range-picker.tsx`
  (`StudioDashboardRangePicker`).
- **Kiểm:** lint/typecheck/build đạt (Quốc kiểm cuối 2026-10-18); dữ liệu thật tenant `phongweb` đọc-only đúng (Hiếu). **Chưa** xem UI thật với phiên
  OWNER, chưa thử tenant chéo trên trình duyệt, nhánh timeline audit/email chưa có dữ liệu. Việc còn lại: `docs/BACKLOG.md` mục "Phát sinh trong
  đợt ADR-046".

**Số test:** không thêm case — `pnpm test:count` = **94/94 unit, 55/55 integration** (Long chạy 2026-10-18, chỉ đếm). `apps/web/tests/integration/order.test.ts`
chuyển sang kiểm `listOrdersPage`/`getOrderDetailView` (cô lập tenant, escape `%`/`_`, `allowedActions`), chạy thật đạt 9/9; `listOrders`/`getOrderDetail`
cũ không còn nơi gọi (BACKLOG dọn). KB: `02-System-Specs/Studio-Orders-Specs.md` (mới),
`02-System-Specs/Order-State-Machine.md`, `03-API-Contracts/Endpoint-Directory.md` §23, `04-Operations-Runbooks/UI-Design-System.md` §20, bản trích
`01-Architecture-Decisions/ADR-031` (≙ ADR-046), `00-Index/KB-Audit-2026-09-26.md` §25.

## Đơn hàng Studio — tìm không dấu, ghi chú nội bộ (ADR-047) — đã commit `dd349b9`, deploy ❓; migration đã áp — 2026-10-18

Chủ dự án chốt 2026-10-18 → **ADR-047** (`docs/DECISIONS.md`). Dữ liệu nghiệp vụ, không có GĐ CMS. Không `route.ts` mới.

- **Tìm không dấu (mục 1):** `listOrdersPage` khớp `q` (mã đơn / email / họ tên khách) bằng SQL thô
  `public.gieochu_unaccent(lower(col)) LIKE '%' || gieochu_unaccent(lower($q)) || '%' ESCAPE '\'` (`escapeLikePattern`, tham số hoá); lọc + đếm +
  lấy id trang bằng `$queryRaw` trong một `withTenant`, rồi Prisma nạp ≤ 100 đơn theo id. Đếm trạng thái hiệu lực bằng SQL (`CASE … EXPIRED`).
- **Ghi chú nội bộ (mục 2):** bảng L2 mới `order_notes` — migration expand `20261018090000_adr045_order_notes` (tên thư mục giữ số cũ ADR-045; **đã áp DB dùng chung 2026-10-18**;
  Quốc kiểm: RLS enable + force, 5 policy `select_access` / `tenant_insert` (kiểm đơn cùng tenant) / `system_job_insert` / `tenant_delete` /
  `system_job_delete`, không UPDATE (`REVOKE`), CHECK nội dung 1–1000 ký tự). Lib `apps/web/lib/order-note.ts` (`listOrderNotes`, `addOrderNote`,
  `deleteOrderNote` — chỉ tác giả, kiểm ở server); `getOrderDetailView(tenantId, orderId, viewerId)` trả `notes[]` + `notesAvailable`, timeline kind
  `note`; Server Action `addOrderNoteAction`, `deleteOrderNoteAction`; lỗi `ORDER_NOTES_UNAVAILABLE` 503 (code lên trước migration),
  `ORDER_NOTE_NOT_FOUND` 404, `ORDER_NOTE_FORBIDDEN` 403; audit `ORDER_NOTE_ADDED` / `ORDER_NOTE_DELETED` (metadata chỉ `noteId`).
- **UI (Phong):** `orders/[orderId]/order-note-actions.tsx` (`AddOrderNoteForm`, `DeleteOrderNoteButton` 2 bước), thẻ `OrderNotesCard` ở cột phụ
  trên "Lịch sử đơn", `IconNote`, tông timeline `neutral`, hằng `ORDER_NOTE_MAX_LENGTH_UI`; tác giả đã xoá → "Tài khoản đã xoá".
- **Không làm (mục 3):** thao tác hàng loạt và xuất CSV đơn hàng / khách hàng (tạm thời); huỷ đơn chỉ từng đơn.
- **Dọn (mục 4):** xoá `listOrders`, `getOrderDetail`, `effectiveStatusWhere` (giữ `OrderListFilters`, `parseOrderRemedyFilter`).
- **Kiểm:** lint/typecheck/build đạt (Quốc); `order.test.ts` chạy thật 9/9 sau migration — assertion mới nằm trong case cô lập tenant có sẵn (tìm
  không dấu; ghi chú: tenant B/khách/public không đọc, insert chéo tenant bị chặn, UPDATE bị chặn, xoá 404/403, tác giả xoá được). **Chưa** xem UI
  ghi chú thật với phiên OWNER. Việc còn lại: `docs/BACKLOG.md` mục "Phát sinh trong đợt ADR-047".

**Số test:** không thêm case — `pnpm test:count` = **94/94 unit, 55/55 integration** (Long chạy, chỉ đếm). KB: `02-System-Specs/Studio-Orders-Specs.md`
§2/§3.2, `02-System-Specs/Audit-Log-Specs.md` §4, `03-API-Contracts/Endpoint-Directory.md` §23.3–§23.5, `03-API-Contracts/Database-Schema-Reference.md`
§3.2/§7, `04-Operations-Runbooks/UI-Design-System.md` §20.8, `04-Operations-Runbooks/Deploy-Vercel-Runbook.md` §9.10, bản trích
`01-Architecture-Decisions/ADR-032` (≙ ADR-047), `00-Index/KB-Audit-2026-09-26.md` §26.

## Danh sách Khách hàng Studio (ADR-048) — đã commit `dd349b9`, deploy ❓; không migration — 2026-10-19

Chủ dự án chốt 2026-10-18 → **ADR-048** (`docs/DECISIONS.md`). Dữ liệu nghiệp vụ, không có GĐ CMS. Chỉ nâng cấp danh sách (không trang chi tiết khách).
Không `route.ts` mới, không migration (dùng cột có sẵn `tenant_customers.note`).

- **Dữ liệu (Hiếu):** `apps/web/lib/customer-list.ts` — `listCustomersPage` (một `withTenant`, 1 Prisma + 2 SQL tổng hợp tham số hoá),
  `parseCustomerListQuery`, `buildCustomerListSearch`, `updateCustomerNote`; Server Action `customers/actions.ts` `saveCustomerNoteAction`; subpath
  `@gieochu/core/customer-list` (`CUSTOMER_NOTE_MAX_LENGTH = 500`, `INACTIVE_CUSTOMER_DAYS = 90`); audit `CUSTOMER_NOTE_UPDATED` (metadata chỉ
  `customerUserId`, không nội dung; lưu không đổi → không ghi).
- **Định nghĩa:** khách = ≥ 1 đơn có `paidAt` (gồm đơn 0đ); mua lần đầu / gần nhất gồm đơn 0đ (lượt nhận miễn phí cũng tính là có quay lại); số liệu mỗi khách
  luỹ kế; số đơn / tổng chi tiêu chỉ đơn > 0đ (gộp, gồm đơn đã hoàn) + "Đã hoàn" riêng + số lượt miễn phí. Thẻ thống kê chỉ áp kỳ (`ky` + `theo`) — không
  kỳ thì toàn bộ, khách mới tính 30 ngày; số đếm nhóm áp kỳ + `q` + `san-pham`; nhóm "có yêu cầu hoàn tiền" = entitlement `REFUND_REQUESTED`.
- **URL:** `q` (không dấu), `nhom` (`tat-ca`|`moi`|`quay-lai`|`mien-phi`|`hoan-tien`|`lau-chua-quay-lai`), `ky`/`tu`/`den`, `theo` (`mua-dau` mặc
  định|`mua-gan-nhat`), `san-pham`, `sap-xep` (`gan-nhat` mặc định|`moi-nhat`|`chi-tieu-giam`|`so-don-giam`), `trang`, `so-dong`.
- **Trang Đơn hàng:** thêm `?khach=` (`OrderListQuery.customerId`, `OrderListPage.customer`; khách không có đơn tại gian hàng → bỏ bộ lọc).
  Dọn: xoá `listTenantCustomers`, `getOrderDashboardStats`.
- **UI (Phong):** `customers/page.tsx` + `loading.tsx` + `error.tsx`; `customers/_ui/{customer-list.tsx, customer-row-actions.tsx, customer-format.ts,
  customer-skeleton.tsx}` — 5 `KpiCard`, form lọc dùng `OrderFilterForm` (prop `label` mới), date picker `formMode`, bảng từ `xl` / thẻ dưới, sắp xếp
  `aria-sort`, `LinkPagination`, menu Thao tác (Xem đơn của khách → `orders?khach=`; Ghi chú → `<dialog>` 500 ký tự, trống = xoá), badge chữ. Trang
  Đơn hàng: dòng "Đang xem đơn của khách X" + ô ẩn `khach` + "Bỏ lọc khách"; `BACK_KEYS` có `khach`.
- **Kiểm:** lint/typecheck/build đạt (Quốc 2026-10-19); `order.test.ts` chạy thật 9/9 — assertion mới trong case cô lập tenant có sẵn (khách của tenant
  A không lộ sang B; ghi chú khách khác tenant bị chặn 404; quá 500 ký tự 400; trống → xoá). Thử đọc-only `phongweb`: 5 khách, 2 quay lại (40%),
  993.000đ — khớp dashboard. **Chưa** kiểm UI thật với phiên OWNER. Việc còn lại: `docs/BACKLOG.md` mục "Phát sinh trong đợt ADR-048".

**Số test:** không thêm case — `pnpm test:count` = **94/94 unit, 55/55 integration** (Long chạy 2026-10-23, chỉ đếm). KB: `02-System-Specs/Studio-Customers-Specs.md`
(mới), `02-System-Specs/Studio-Orders-Specs.md` §2.1 (`?khach=`), `02-System-Specs/Audit-Log-Specs.md` §4, `03-API-Contracts/Endpoint-Directory.md` §23.2,
§24, `03-API-Contracts/Database-Schema-Reference.md` (`TenantCustomer.note`), `04-Operations-Runbooks/UI-Design-System.md` §21, bản trích
`01-Architecture-Decisions/ADR-033` (≙ ADR-048), `00-Index/KB-Audit-2026-09-26.md` §28.

## Lưu trữ MinIO song song R2 + bucket riêng cho gian hàng (ADR-044) — đã commit `78a9d9c`; migration **chưa áp DB**; deploy ❓ — 2026-10-22

Dev vuong làm, vào `master` qua commit `78a9d9c` (2026-10-22; ADR đề ngày 2026-10-17). `SystemStorageConfig` lưu song song cấu hình `CLOUDFLARE_R2` và
`MINIO` + `activeProvider`; mỗi gian hàng một bucket riêng `{prefix}tenant-{tenantId}` (tạo lười khi upload / nút admin — `lib/tenant-storage.ts`);
đồng bộ R2 ↔ MinIO (`lib/storage-sync.ts`, `packages/storage/src/stream-copy.ts`) và giám sát bucket ở `/admin/settings/storage?tab=buckets|sync`.

- **Migration** `20261017140000_adr038_tenant_storage_bucket` (tên mang số "adr038" nhưng thuộc ADR-044): expand — thêm cột nullable
  `storageBucket`/`storageProvider` vào `tenants` và `product_files`. **CHƯA áp DB dùng chung** (Quốc kiểm `migrate status` 2026-10-23). Code đã đọc
  các cột này → phải áp migration trước khi code chạy trên DB đó (ADR-034).
- Không thêm test case (trần 94/55 đã chạm).
- Tài liệu: bản trích `01-Architecture-Decisions/ADR-034` (≙ ADR-044), `03-API-Contracts/Database-Schema-Reference.md` §3.2 + §7,
  `04-Operations-Runbooks/Minio-Storage-Operations-Runbook.md`, `00-Index/KB-Audit-2026-09-26.md` §29.

## Storage Gateway — vé mã hoá `/_s/` + nginx `auth_request` (ADR-045) — đã commit `4ab5a3b`; không migration; deploy ❓ — 2026-10-22

Dev vuong làm, commit `4ab5a3b` (2026-10-22). Env hạ tầng tuỳ chọn `STORAGE_GATEWAY_PROVIDERS` chọn provider giao file qua `/_s/<vé>` (mặc định:
presigned trực tiếp như cũ); vé AES-256-GCM (khoá HKDF từ `STORAGE_ENCRYPTION_KEY`); route nội bộ mới `GET /api/internal/storage/ticket` chỉ cho
nginx gọi (23 `route.ts` dưới `/api`, 24 toàn app); file mẫu `docker/nginx/gieochu-storage-gateway.conf.example`. Không migration, không thêm test case.
Câu hỏi mở: production chạy VPS hay Vercel — Quốc đang hỏi chủ dự án.

- Tài liệu: bản trích `01-Architecture-Decisions/ADR-030` (≙ ADR-045), `02-System-Specs/File-Storage-And-Downloads-Specs.md` §9,
  `03-API-Contracts/Endpoint-Directory.md` §25, `04-Operations-Runbooks/Storage-Gateway-VPS-Runbook.md`, `00-Index/KB-Audit-2026-09-26.md` §27, §29.

## Kế hoạch: Trang chủ + Pháp lý + Menu CMS + SEO — đợt 1 đã chốt theo ADR-050 (2026-10-23)

**Chủ dự án chốt đợt 1 (ADR-050)** — theo thứ tự, mỗi hạng mục CMS trước, UI sau: (1) CMS menu header/footer
(`/admin/cms/menu`, slug hệ thống `menu`, không migration, sửa ADR-025); (2) trang chủ theo brief + SEO trang chủ
(`home-sections` thêm `steps`/`faq`/`community`, bỏ số liệu/giá/sao gõ cứng, ô `seoTitle/seoDescription` + `generateMetadata`,
không migration); (3) Điều khoản sử dụng có phiên bản + ghi nhận chấp thuận khi đăng ký (bảng L1 `legal_documents`,
`legal_document_versions`, `user_legal_acceptances`, không lưu IP/User-Agent; `/phap-ly/dieu-khoan-su-dung`; migration
expand-only — Hiếu viết, Quốc duyệt, chủ dự án chạy). Test: trần nâng +1 unit, +2 integration (94/55 → 95/57).
**Hoãn sang giai đoạn pháp lý:** các trang pháp lý khác, hub `/phap-ly`, mở rộng `abuse_reports`, chấp thuận khi mở gian
hàng/xuất bản, công bố bản dự thảo, xoá tài khoản, thông tin pháp nhân; SEO còn lại (OG, noindex, sitemap, robots, JSON-LD).
Dự thảo Điều khoản: `docs/legal/drafts/dieu-khoan-su-dung.md` (Long, chưa được luật sư rà soát, còn placeholder).
**Trạng thái code đợt 1 (2026-10-23): phần CMS/logic cả 3 hạng mục xong + verify (working tree, chưa commit); phần UI (Phong) đang làm.** Migration `20261023090000_adr050_legal_documents` đã chạy trên DB dùng chung; chưa có bản Điều khoản nào được xuất bản (dự thảo còn placeholder). Test: `test:count` 95/95 unit, 57/57 integration (thêm `site-menu.test.ts`, `legal.test.ts`). **Vấn đề tồn tại, chưa xử lý:** 4 integration test lỗi do dữ liệu dùng chung (Plan FREE `maxProducts=1` → 3 test `PRODUCT_LIMIT_REACHED`; 1 test đơn hàng timeout). *(Cập nhật 2026-10-24: 3 test `PRODUCT_LIMIT_REACHED` đã pass ở lượt verify ADR-053; còn 1 test RLS `order.test.ts` timeout 20 giây — xem mục ADR-053 bên dưới.)* Tài liệu: `02-System-Specs/System-Cms-Menu-Home-Seo-Specs.md`, `02-System-Specs/Legal-Documents-Specs.md`, `04-Operations-Runbooks/Legal-Terms-Publishing-Runbook.md`, bản trích `01-Architecture-Decisions/ADR-035` (≙ ADR-050), `03-API-Contracts/Endpoint-Directory.md` §3.1, §26, `00-Index/KB-Audit-2026-09-26.md` §31.

**Bổ sung ADR-050 lần 3 — Hero (2026-10-23, chủ dự án duyệt; working tree, chưa commit, không migration):** `brandMessage` trống → không hiển thị; thẻ số liệu nổi bật quanh ảnh (0–3 thẻ, 4 số liệu thật của `getHomeStats()`, ngưỡng mặc định 10, mặc định gian hàng/tài liệu/lượt mua, số làm gọn "120+"/"1,2K+"), khung ảnh 4:5 (1200×1500). Test giữ 95/95 unit, 57/57 integration. Tài liệu: `02-System-Specs/System-Cms-Menu-Home-Seo-Specs.md` §3.6, `04-Operations-Runbooks/UI-Design-System.md` §12.10, bản trích `01-Architecture-Decisions/ADR-035`.

Kế hoạch gốc (A–D dưới đây là đề xuất ban đầu; chỗ khác ADR-050 thì theo ADR-050) — lúc soạn kế hoạch chưa code, chưa migration (trạng thái hiện hành: đoạn trên). Đầu vào: `docs/GIEOCHU_HOMEPAGE_CONTENT_BRIEF.md`,
`docs/claude-code-gieochu-legal-pages-implementation-brief.md`; đề xuất UX của Phong `docs/de-xuat-ux-home-legal-menu-2026-10-23.md`.
Kế hoạch tổng (audit ✅/🟡/❓, bước Ai · Phụ thuộc · Tiêu chí, migration, rủi ro, 29+ câu hỏi mở): `docs/ke-hoach-home-legal-menu-seo-2026-10-23.md`.
Checklist pháp lý: `docs/legal/LEGAL_REVIEW_CHECKLIST.md`.

- **A. Trang chủ theo brief** — không DDL (JSON `cms_pages` slug `home`): section mới `steps`, `faq`, `community` (thay
  `testimonials`, bắt buộc xác nhận đồng ý), CTA cho gian hàng/tài liệu nổi bật, ô SEO trang chủ, nội dung mặc định khi
  chưa có CMS; gỡ số liệu/giá minh hoạ cứng ("500+", "10.000+", "149.000đ", 5 sao cố định).
- **B. Trang pháp lý** — đề xuất bảng L1 mới có phiên bản + DRAFT/PUBLISHED/ARCHIVED + `effectiveAt` + chấp thuận theo
  phiên bản (`UserLegalAcceptance`); URL tiền tố `/phap-ly/*` + `/bao-cao-vi-pham` + `/lien-he`; mở rộng `abuse_reports`
  (ADR-038), không xây hệ thứ hai; chặn Publish khi còn placeholder.
- **C. Menu header/footer bằng CMS** — không DDL (slug hệ thống `menu`), sửa ADR-025.
- **D. SEO** — helper metadata chung, `sitemap.ts`, `robots.ts`, JSON-LD (Organization, WebSite, BreadcrumbList, Product);
  cột `cms_pages.ogImageUrl`, `noindex`.
- **Migration dự kiến (expand-only, Quốc duyệt, chủ dự án chạy):** M-L (pháp lý), M-R (báo cáo vi phạm), M-S (SEO).
- **Test:** lúc soạn kế hoạch `test:count` 94/94 unit, 55/55 integration — đã chạm trần; chủ dự án đã duyệt nâng +1 unit +2 integration (ADR-050) → nay 95/95, 57/57.
- **Thứ tự đề xuất:** (1) chốt câu hỏi + dự thảo pháp lý ∥ menu CMS → (2) trang chủ + metadata/sitemap/robots → (3) pháp lý
  (M-L) + chấp thuận → (4) báo cáo vi phạm (M-R) → (5) ô SEO đầy đủ (M-S) + JSON-LD.

## Phiên đăng nhập — header cache, "Ghi nhớ đăng nhập", idle/absolute, danh sách thiết bị (ADR-053) — GĐ A + GĐ B xong code, chưa commit; migration đã chạy — 2026-10-24

**Chủ dự án chốt 2026-10-24 (ADR-053).** Nguyên nhân (Hiếu chẩn đoán): layout chứa `SiteHeader` + `loading.tsx` bị Next prefetch và tái dùng ~5 phút; login/logout dùng `fetch` + `router.push/refresh` nên client cache còn header của phiên cũ (có thể lộ tên/email người vừa đăng xuất).

- **GĐ A (không migration):** login/logout điều hướng cứng (`window.location.assign`) ở `login-form.tsx`, `account-menu.tsx`, `logout-button.tsx`, `SessionRefresh`; refresh ân hạn 30 giây cho token vừa bị thay (`REFRESH_REUSE_GRACE_MS`, trạng thái `superseded` → 401 `AUTH_REFRESH_SUPERSEDED`, không thu hồi family, không xoá cookie) + rotation nguyên tử (`updateMany … replacedById: null` trong transaction); route refresh kiểm `user.status` (`ACCOUNT_LOCKED`); `SessionRefresh` khoá giữa tab (Web Locks + BroadcastChannel), làm mới khi tab hiện lại, 401 → cập nhật UI.
- **GĐ B (migration `20261024090000_adr051_session_policy`, expand-only, đã chạy trên DB dùng chung):** checkbox "Ghi nhớ đăng nhập" mặc định tắt (`rememberMe` ở `POST /api/auth/login`, SYSTEM_ADMIN luôn bỏ qua); không ghi nhớ → cookie session, idle 60 phút, absolute 12 giờ; ghi nhớ → persistent 30 ngày, không idle; SYSTEM_ADMIN 15 phút / 8 giờ; cảnh báo 2 phút trước idle ("Tiếp tục phiên"); absolute tính từ lúc đăng nhập, không trượt (mã `SESSION_IDLE_TIMEOUT`, `SESSION_EXPIRED`); 6 cột cấu hình mới ở `system_settings` + nhóm "Chính sách phiên đăng nhập" trong System Center (`refreshTokenTtlDays` ngừng dùng, giữ cột tới migration contract); `refresh_tokens` thêm `rememberMe`, `sessionStartedAt`, `deviceLabel`; trang `/account/security` liệt kê thiết bị + đăng xuất từng phiên; cron `/api/cron/daily` thêm bước `refresh_tokens.purge` xoá bản ghi hết hạn/thu hồi quá 90 ngày. Phiên có sẵn không bị đăng xuất lúc deploy (bắt đầu đếm ở lần refresh đầu, thành phiên không ghi nhớ).
- **File chính:** `packages/auth/src/{session-policy,device-label}.ts`, `packages/auth/src/tokens/{refresh-token,access-token}.ts`, `apps/web/app/api/auth/{login,refresh}/route.ts`, `apps/web/lib/{cookies,session,jwt-context,account-sessions,system-settings}.ts`, `apps/web/app/_ui/session-refresh.tsx`, `apps/web/app/layout.tsx`, `apps/web/app/account/security/*`, `packages/core/src/settings/system-settings.ts`, `apps/web/app/api/cron/daily/route.ts`.
- **Test:** chủ dự án cho nâng trần theo nhu cầu module — **95/57 → 99/63** (GĐ A +1 unit `refresh-token.test.ts`, +2 integration `auth.test.ts`; GĐ B +3 unit `session-policy.test.ts`, +4 integration `session-policy.test.ts`); `test:count` 99/99, 63/63. Lượt verify: 3 test `PRODUCT_LIMIT_REACHED` (lỗi ngày 2026-10-23) đã pass; còn 1 test RLS trong `order.test.ts` timeout 20 giây — **đã có từ trước**, chưa xử lý.
- **Chưa làm / còn mở:** ~~hộp thoại cảnh báo idle và danh sách thiết bị là UI tối thiểu~~ (Phong đã làm 2026-10-24 — `session-expiry-dialog.tsx`, `session-cards.tsx`, `UI-Design-System` §23); contrast tone `success` của kit ~3:1 (task riêng); chưa kiểm trên trình duyệt thật (đóng/mở trình duyệt, nhiều tab, máy ngủ dậy); ~~`updateProfileAction` ký lại access token thiếu claim `rm`~~ (KB-Audit §33 mục 1 — **đã sửa 2026-10-24**: helper `lib/session-access.ts` ký access token cho login/refresh/đổi hồ sơ); cron trên VPS production chưa có crontab (ADR-049). "Bổ sung ADR-053 lần 2" (Quốc): cấu hình phiên áp cho cả phiên đang mở là chủ ý (ngoại lệ ADR-032), phiên cũ sau lần refresh đầu thành không ghi nhớ — chấp nhận. **"Bổ sung ADR-053" — tự lưu nháp editor lên server:** chờ chủ dự án chốt thiết kế trong kế hoạch riêng, chưa code.
- **Tài liệu:** `02-System-Specs/Auth-Session-Specs.md`, bản trích `01-Architecture-Decisions/ADR-039-Session-Policy-Remember-Me-Idle-Absolute.md` (≙ ADR-053), `03-API-Contracts/Endpoint-Directory.md` §3.2–§3.3, §17, §21.4, `03-API-Contracts/Database-Schema-Reference.md` §3.1, §7, `04-Operations-Runbooks/Deploy-Vercel-Runbook.md` §6.6, §9.12, `00-Index/KB-Audit-2026-09-26.md` §33.

## Tự lưu nháp editor lên server — phần nền (ADR-053 bổ sung lần 3) — xong code nền, chưa commit; migration đã chạy; chưa gắn editor — 2026-10-24

**Chủ dự án duyệt thiết kế 2026-10-24 ("Bổ sung ADR-053 lần 3").** Kế hoạch: `docs/ke-hoach-tu-luu-nhap-2026-10-24.md`.

- **Migration `20261024120000_adr051_editor_drafts`** (expand-only, tên thư mục giữ số cũ ADR-051, đã chạy trên DB dùng chung): bảng L2 `tenant_editor_drafts` (RLS `ENABLE` + `FORCE`, policy tách theo lệnh — scope `tenant` đủ quyền trên đúng `tenantId`, `system_job` chỉ SELECT/DELETE, không nhánh customer/public/admin) và bảng L1 `system_editor_drafts` (không RLS, chỉ SYSTEM_ADMIN); 2 enum `TenantEditorDraftEntity`, `SystemEditorDraftEntity`; CHECK `revision ≥ 1`, khoá/`clientId` 1–64, payload ≤ 1 MiB.
- **Code nền:** `packages/core/src/content/editor-draft.ts` (subpath `@gieochu/core/editor-draft` — loại/khoá thực thể, giới hạn theo loại, zod "chế độ nháp", mã lỗi `DRAFT_TOO_LARGE`/`DRAFT_INVALID`/`DRAFT_CONFLICT`), `apps/web/lib/editor-draft.ts` (`getDraft`/`saveDraft`/`discardDraft`/`purgeStaleDrafts` — kiểm thực thể thuộc tenant, tenant ACTIVE, rate limit 20/phút, sanitize HTML, revision + `clientId` chống xung đột nhiều tab), hook client `apps/web/lib/use-server-autosave.ts` (debounce 3 giây, tối đa 30 giây, lưu khi ẩn tab/unmount/nhận `gieochu:session-expiring`), `session-refresh.tsx` phát sự kiện `gieochu:session-expiring` khi mở cảnh báo hết phiên.
- **Chưa làm:** gắn vào editor (bài viết → tài liệu → trang gian hàng → CMS home/shop/pricing/menu → pháp lý); UI trạng thái/banner (Phong); gắn `purgeStaleDrafts` vào cron `/api/cron/daily`.
- **Kèm theo (phiên đăng nhập):** `AccountSessionView.deviceKind` (icon thiết bị); `revokeSessionAction` trả `{ signedOut }`, client điều hướng cứng về `/login` thay cho `redirect()` ở server.
- **Test:** +1 unit (`editor-draft.test.ts` core), +2 integration (`editor-draft.test.ts` — RLS thật; xung đột revision/ghi đè/Lưu xoá nháp) → **99/63 → 100/65**.
- **Tài liệu:** `02-System-Specs/Editor-Autosave-Drafts-Specs.md` (mới), `03-API-Contracts/Database-Schema-Reference.md` §3.1, §3.2, §4, §7, `03-API-Contracts/Endpoint-Directory.md` §21.4, §26.6, `02-System-Specs/Auth-Session-Specs.md` §7, `02-System-Specs/Account-Profile-Specs.md`, `00-Index/KB-Audit-2026-09-26.md` §34–§35.

## Trang pháp lý đợt 2 — URL cấp gốc, 7 văn bản, ghi nhận đồng ý mở rộng (ADR-054) — xong code, chưa commit; migration đã chạy — 2026-10-24

**Chủ dự án chốt 2026-10-24 (ADR-054)** từ kế hoạch `docs/ke-hoach-trang-phap-ly-dot-2-2026-10-24.md` (Long soạn) + dự thảo `docs/legal/drafts/` (**chưa được luật sư rà soát**, còn placeholder). Khác đề xuất ban đầu: **URL cấp gốc** (bỏ tiền tố `/phap-ly/`), **không có hub**, `copyright` tách riêng, có **migration** cho mô tả/SEO.

- **7 văn bản** (`LEGAL_DOCUMENT_DEFS`): `terms` `/dieu-khoan-su-dung`, `privacy` `/chinh-sach-bao-mat`, `content_policy` `/chinh-sach-noi-dung`, `copyright` `/cam-ket-ban-quyen`, `usage_license` `/quyen-su-dung-tai-lieu`, `seller` `/chinh-sach-nguoi-ban`, `contact` `/lien-he`. 7 route mỏng `app/{slug}/page.tsx` dùng chung `app/_ui/legal-document-page.tsx`; chưa có bản hiệu lực → 404. `/phap-ly/{slug}` cũ → 308 (`app/phap-ly/[slug]/route.ts`, route mới — 23 dưới `/api`, 25 toàn app). `RESERVED_SLUGS` tenant thêm `...LEGAL_DOCUMENT_ROOT_SLUGS` (giữ `phap-ly`).
- **Migration `20261024150000_adr053_legal_document_meta`** (expand-only, tên thư mục giữ số cũ `adr053`; **đã chạy** trên DB dùng chung — chủ dự án xác nhận 2026-10-24; DB khác phải chạy **trước** khi code ADR-054 lên): `legal_documents` thêm `summary`, `seoTitle`, `seoDescription` + CHECK `legal_documents_meta_length`; nới CHECK `legal_documents_key_format` cho `key` nhận `_`.
- **Editor `/admin/cms/phap-ly`:** chọn văn bản bằng `?van-ban=`, trạng thái từng văn bản; khung "Mô tả & SEO" (`LegalMetaForm`, `saveLegalDocumentMetaAction`, audit `LEGAL_DOCUMENT_META_UPDATED`); metadata trang dùng `seoTitle`/`seoDescription`/`summary`, canonical URL cấp gốc.
- **Link trong văn bản:** `sanitizeRichTextHtml` thêm `trustedLinks` (chỉ áp cho văn bản pháp lý) — link nội bộ cùng tab, link ngoài `target="_blank" rel="noopener noreferrer"`.
- **Ghi nhận đồng ý:** đăng ký ghi Điều khoản **và** Chính sách bảo mật (`privacyVersionId`, 409 `LEGAL_DOCUMENT_CHANGED`); mở gian hàng có checkbox Chính sách người bán (`sellerPolicyAccepted`, `sellerPolicyVersionId`, 400 `LEGAL_ACCEPTANCE_REQUIRED`), ghi trong cùng transaction tạo tenant. Văn bản chưa có bản hiệu lực → bỏ qua.
- **Menu/footer:** loại link `legal` trong menu CMS, tự ẩn khi văn bản chưa hiệu lực; menu **mặc định** thêm cột footer "Thông tin" (7 link).
- **Cron:** bước `download_events.purge` xoá nhật ký tải cũ hơn 12 tháng (`withSystemJob`).
- **Test:** chủ dự án duyệt +1 integration (`legal.test.ts`) → **100/66**. Lượt verify vẫn còn lỗi cũ: test RLS trong `order.test.ts` timeout 20 giây.
- **Còn mở:** chạy migration; ~~quét DB không có tenant trùng 7 slug mới~~ (Hiếu quét chỉ đọc 2026-10-24: 1 tenant, không trùng); xuất bản từng văn bản khi đủ placeholder + rà soát; menu đã xuất bản trên DB chưa có cột "Thông tin" (admin tự thêm); kế hoạch H8 — sanitizer với nội dung tenant hiện **không** gắn `target`/`rel`/`nofollow` cho link (KB-Audit §35); bố cục bộ chọn văn bản + khung SEO là tối thiểu (Phong); hai vấn đề cần luật sư (ADR-054 mục 9).
- **Tài liệu:** `02-System-Specs/Legal-Documents-Specs.md`, bản trích `01-Architecture-Decisions/ADR-040-Legal-Pages-Phase-2-Root-Urls-Consent.md` (≙ ADR-054), `03-API-Contracts/Endpoint-Directory.md` §3.1, §5.2, §17, §26.2, §26.4–§26.5, `03-API-Contracts/Database-Schema-Reference.md` §3.1, §7, `02-System-Specs/Background-Jobs-Specs.md`, `02-System-Specs/Audit-Log-Specs.md` §4, `00-Index/KB-Audit-2026-09-26.md` §35.

## MinIO qua HTTPS bằng tên miền riêng (ADR-055) — chờ Vương — 2026-10-25

**Chủ dự án chốt 2026-10-25 (ADR-055), phương án A.** Hạ tầng VPS (DNS `s3.<domain>` DNS only, nginx TLS, CORS bucket, đóng cổng 9000) do Vương làm theo `docs/yeu-cau-vuong-minio-https-2026-10-25.md`; tên miền chưa chốt. Code CSP/env (biến tuỳ chọn liệt kê chính xác origin storage, nối vào `connect-src` trong `proxy.ts`) — Hiếu làm **sau khi** Vương xác nhận tên miền. Chưa có bản trích KB và runbook (viết khi xong).

## System Center: hoá đơn + Đơn hàng gói dịch vụ; khối chuyển khoản; mã giảm giá tạo lại QR (ADR-056 + 2 lần bổ sung) — xong code, chưa commit; không migration — 2026-10-25

**Chủ dự án chốt 2026-10-25 (ADR-056).** Dữ liệu thuê bao/hoá đơn vốn đúng; thiếu màn hình xem lại.

- **`/admin/billing/invoices`** 2 tab `?tab=cho-doi-soat|tat-ca`; tab "Tất cả" lọc `status` (PENDING/PAID/EXPIRED/VOID/REFUNDED) + `provider` (MANUAL_QR/SEPAY/MOMO), phân trang `page`/`pageSize`; nút xác nhận chỉ ở dòng MANUAL_QR PENDING.
- **`/admin/subscriptions`** "Đơn hàng gói dịch vụ" (menu Kinh doanh → "Đơn hàng"): lọc `plan`/`status`, gói trả phí theo ngày hết hạn, gói miễn phí "Không thời hạn" xếp sau, hoá đơn gần nhất. Hàm mới `listSubscriptionInvoices`, `listSubscriptions`, `listPlanFilterOptions`, `parseEnumParam` (`lib/subscription-billing.ts`) — chỉ bảng L1, đúng §7.9.
- Menu "Thanh toán nền tảng" → **"Cấu hình thanh toán"**. Kit admin thêm `PillTabs`, `FilterSelect`, `FilterBar`; nhãn chung `admin/_ui/billing-labels.ts`.
- **Khối chuyển khoản** `app/_ui/bank-transfer-panel.tsx` dùng chung Studio billing + checkout: "Tải ảnh QR" bằng `<a download>` (không `fetch` — CSP), sao chép từng dòng (số tiền là số nguyên trơn), tên ngân hàng theo BIN (`getBankByBin` ở checkout).
- **Mã giảm giá và QR (bổ sung):** áp/gỡ mã khi đơn đã có `checkoutPayload` → tạo lại payload theo tổng mới; chặn khi đơn PAID/huỷ/hết hạn; 0đ → ZERO_AMOUNT; mã lỗi `ORDER_CHANGED` 409, `CHECKOUT_CREATE_FAILED` 502; `initiateOrderCheckout` chỉ ghi khi tổng chưa đổi; `removeCouponAction` trả `CheckoutActionState`. SePay quét QR cũ → `MISMATCH_AMOUNT`, chủ gian hàng xác nhận tay. **MoMo tạm chưa xử lý** (bổ sung lần 2).
- **Không xoá** 27 dòng audit `SUBSCRIPTION_PAID` giả do integration test (append-only).
- **Test:** thêm assert trong case có sẵn (`subscription-billing.test.ts`, `order.test.ts`) — `pnpm test:count` vẫn **100/66**.
- **Còn mở:** commit/deploy; xem UI thật với phiên SYSTEM_ADMIN; thử MoMo/SePay thật; ~~có cần hiện chu kỳ tháng/năm ở trang Đơn hàng gói~~ (Quốc 2026-10-25: giữ như code — KB-Audit §37 mục 5). Nút gỡ mã ở checkout ghi "Bỏ áp dụng".
- **Tài liệu:** bản trích `01-Architecture-Decisions/ADR-041-System-Center-Subscription-Invoices-Bank-Transfer-Qr.md` (≙ ADR-056), `02-System-Specs/Payment-And-Billing.md` §5C–§5E, `02-System-Specs/Order-State-Machine.md` §3.9, `02-System-Specs/User-Management-System-Center-Specs.md` §2, §5, `03-API-Contracts/Endpoint-Directory.md` §27, `04-Operations-Runbooks/UI-Design-System.md` §24, `00-Index/KB-Audit-2026-09-26.md` §37.

## Chính sách: nạp 7 dự thảo, xem trước, "Bản dự thảo", editor một nội dung (ADR-057 + bổ sung) — xong code, chưa commit; migration đã chạy — 2026-10-25

**Chủ dự án chốt 2026-10-25 (ADR-057).**

- **Script** `apps/web/scripts/import-legal-drafts.ts` (`pnpm --filter @gieochu/web run legal:import-drafts -- --actor-email=… [--apply]`): 7 dự thảo Markdown → HTML sanitize → bản nháp DRAFT, chạy thử mặc định, idempotent. Đã nạp 7 bản nháp (theo bổ sung ADR-057).
- **Xem trước** `/phap-ly/xem-truoc?van-ban=&phien-ban=` — chỉ SYSTEM_ADMIN, noindex, cùng giao diện trang công khai.
- **"Bản dự thảo"**: cột `legal_document_versions.isDraftRelease` (migration expand-only `20261025120000_adr057_legal_draft_release` — **đã chạy 2026-10-25**, Bổ sung ADR-058 (c)); bỏ qua cổng placeholder + rà soát; banner + "(đang cập nhật)"; **không dùng ghi chấp thuận** (`getAcceptanceLegalVersion`).
- **Editor một nội dung**: 3 Server Action mới `saveLegalDraftAction` / `setLegalReviewAction` / `publishLegalAction` (có `expectedUpdatedAt`, lệch → `LEGAL_VERSION_CONFLICT`), bỏ 5 action theo phiên bản và nút Lưu trữ; SEO thu gọn dưới nội dung.
- **Đổi tên**: "Chính sách sử dụng", "Liên hệ và thông tin đơn vị vận hành", "Đã rà soát nội dung".
- **Test:** `legal.test.ts` thêm assert trong case có sẵn — `pnpm test:count` vẫn **100/66**.
- **GĐ C xong (Hiếu báo 2026-10-25):** `getEffectiveLegalVersion` (hiển thị, có bản dự thảo) tách `getAcceptanceLegalVersion` (ghi đồng ý, chỉ bản chính thức); đăng ký: văn bản dự thảo có link, `versionId = null`, chỉ `consentAt`; mở gian hàng ẩn ô đồng ý khi Chính sách người bán là bản dự thảo; đã có bản chính thức rồi công bố bản dự thảo cũng không ghi đồng ý (Quốc chốt). Bắt buộc gửi id khớp khi có bản chính thức: thiếu/lệch → 409 (Điều khoản `LEGAL_TERMS_CHANGED`; Bảo mật + Người bán `LEGAL_DOCUMENT_CHANGED`) — `termsVersionId`/`privacyVersionId`/`sellerPolicyVersionId` thành bắt buộc trên thực tế.
- **Còn mở:** commit/deploy; xem UI thật. Runbook pháp lý đã bỏ thao tác Lưu trữ (Quốc chốt 2026-10-25).
- **Tài liệu:** bản trích `01-Architecture-Decisions/ADR-042-Legal-Drafts-Import-Preview-Draft-Release.md` (≙ ADR-057), `03-API-Contracts/Endpoint-Directory.md` §3.1, §26.4, §26.5, `04-Operations-Runbooks/Legal-Terms-Publishing-Runbook.md` §1, §3, `02-System-Specs/Legal-Documents-Specs.md` §2, §5 (viết lại), §6, `04-Operations-Runbooks/UI-Design-System.md` §13.7, `00-Index/KB-Audit-2026-09-26.md` §38.

## Điều hướng tab theo chức năng + accordion + cảnh báo rời trang (ADR-058 + bổ sung) — GĐ 0, GĐ 1, GĐ 2 xong; chỉ còn 1.10, chưa commit — 2026-10-25

**Chủ dự án chốt 2026-10-25 (ADR-058).** Kế hoạch: `docs/ke-hoach-toi-uu-layout-tab-accordion-2026-10-25.md`. Chỉ lớp trình bày; URL không đổi, không migration, không đổi Server Action. Mỗi task Quốc duyệt rồi mới làm task sau.

- **GĐ 0 — Nền tảng:**
  - ✅ **0.1** `admin/_ui/collapsible-section.tsx` (`CollapsibleSection`, `sectionStatus`, `revealSection`) + `admin/_ui/module-tabs.tsx` (`ModuleTabs`).
  - ✅ **0.2** `admin/_ui/unsaved-changes.tsx` (`UnsavedChangesProvider`, `useUnsavedChanges`, `useLeaveGuard`, `GuardedLink`); Provider bọc `admin/layout.tsx`, `studio/[tenantSlug]/layout.tsx`; áp thử editor Chính sách sử dụng. Giới hạn: không chặn Back/Forward; 6 editor còn `beforeunload` riêng, chuyển dần.
  - ✅ **0.3** `admin/_ui/nav-match.ts` + `SidebarNavLeaf.match?: string[]` (tiền tố; `=` khớp đúng; dài nhất thắng).
  - ✅ **0.4** Long ghi KB (2026-10-25).
- **Bổ sung ADR-058:** (a) mục sidebar "Trang tuỳ chỉnh" (`/admin/cms`, ẩn slug hệ thống trong truy vấn); (b) trang sửa tài liệu Studio giữ nguyên, không thêm tab, chỉ accordion; (c) migration ADR-057 đã chạy.
- **GĐ 1 — System Center (Quốc duyệt 2026-10-25; xong code + verify, chưa thử trình duyệt):**
  - ✅ **1.1** Trang CMS = `ModuleTabs` Trang chủ · Header & Footer (`admin/cms/_ui/cms-tabs.ts`, `cms/[slug]` slug `home`, `cms/menu` + `loading.tsx`); sidebar nhóm Nội dung: Trang CMS (`/admin/cms/home`, `match: ["/admin/cms/menu"]`) · **Trang tuỳ chỉnh** (`/admin/cms`, mới) · Trang Cửa hàng · Trang Bảng giá · Chính sách sử dụng · Danh mục tài liệu; bỏ "Menu & chân trang". Danh sách "Trang tuỳ chỉnh" lọc `slug notIn SYSTEM_CMS_SLUGS` cho cả `findMany` + `count` (Hiếu).
  - ✅ **1.2** Khối SEO trang chủ thành `CollapsibleSection` (thu gọn, badge `sectionStatus`); nút Lên/Xuống/Ẩn-Hiện 44px dưới `lg`; bỏ hex cứng.
  - ✅ **1.3** Editor Header & Footer (`cms/menu/menu-editor.tsx`): 3 `CollapsibleSection` — Menu đầu trang (mở), Nút kêu gọi + Chân trang (thu gọn) — badge lỗi/thay đổi, tóm tắt lỗi gọi `revealSection`, `useUnsavedChanges` thay `beforeunload`.
  - ✅ **1.2b** Trang chủ theo dõi "có thay đổi chưa lưu" (sections + SEO so với mốc đã nạp) → `useUnsavedChanges` + badge thanh nút.
  - ✅ **1.4** SEO trang Bảng giá thành `CollapsibleSection` luôn thu gọn.
  - ✅ **1.5** Cửa hàng: kết luận không cần accordion (list-detail, mọi ô bắt buộc, không có SEO) — chỉ chuyển `beforeunload` sang `useUnsavedChanges`. SEO `/cua-hang` thuộc kế hoạch SEO tổng thể (làm sau).
  - ✅ **1.6** `LegalMetaForm` dùng `CollapsibleSection` (`#seo`), giữ hành vi ADR-057; `CollapsibleSection.status` nhận mảng, thêm sắc `info`, badge xuống dòng trên mobile.
  - ✅ **1.7** Cấu hình chung = `ModuleTabs` Cấu hình chung · Email hỗ trợ · Cấu hình Email (SMTP) (`admin/settings/_ui/settings-tabs.ts`); sidebar gộp 3 mục thành 1 (`match: ["=/admin/settings", "/admin/settings/smtp"]`) → System Center còn **21 mục**.
  - ✅ **1.8** Tab nội bộ SMTP thành tab ARIA thật (←/→, Home/End). **1.8b** SMTP giữ giá trị đã nhập khi lưu lỗi (trừ mật khẩu).
  - ✅ **1.9** Form Cấu hình chung: 3 nhóm `CollapsibleSection` (Bảo mật & phiên mở; Chính sách phiên, Nghiệp vụ thu gọn), badge lỗi/có thay đổi.
  - ✅ **1.11** Thanh toán SePay · MoMo · QR thủ công: cổng đang bật thì mở, badge trạng thái; hook mới `admin/_ui/use-form-draft.ts` (`useFormDraft` — giữ giá trị khi lưu lỗi, không ghi lại secret, `dirtyOf`); sửa Toggle lệch sau lưu lỗi.
  - ✅ **1.12a** Gói dịch vụ 3 khối (trang tạo gói mở cả 3), Danh mục 4 khối, Trang tuỳ chỉnh 2 khối — `useFormDraft` + `useUnsavedChanges`; sửa `<main>` lồng.
  - ✅ **1.12b** Component mới `admin/_ui/in-page-tabs.tsx` (`InPageTabs`, tab ARIA kiểu pill, panel luôn mounted) cho Thương hiệu (sửa lỗi mất dữ liệu khi chuyển tab) và SMTP; Cloudinary `useFormDraft` (không ghi lại API key/secret) + `useUnsavedChanges`, không accordion.
  - ✅ **1.13** Sửa `<main>` lồng (users, roles, tenants); Email hỗ trợ `useFormDraft` + `useUnsavedChanges`.
  - ✅ **1.14** `metadata.title` riêng cho 5 trang tab (Trang CMS ×2, Cấu hình chung ×3); `admin/error.tsx` bỏ `<main>` lồng; câu mô tả SEO trang chủ + Bảng giá khớp action; badge "Có thay đổi chưa lưu" thống nhất sắc `warning`.
  - ✅ **1.15** 8 trang System Center bỏ `SettingsGrid`, xếp 1 cột full width (Email hỗ trợ, Cloudinary, gói tạo/sửa, danh mục tạo/sửa, trang tuỳ chỉnh tạo/sửa).
  - ⏸ **1.10** Lưu trữ file — tạm hoãn, chờ Vương xong ADR-055 (kèm accordion, `useFormDraft` có secret, `useUnsavedChanges`, sửa `<main>` lồng ở `settings/storage/page.tsx`).
- **Quy tắc full width (chủ dự án chốt 2026-10-25):** nội dung chính System Center + Studio luôn full width theo khung app, khối xếp 1 cột; không `max-w`/`mx-auto` ở khung form/editor, chỉ giữ ở cấp component. Quốc sửa tận gốc `SettingsGrid` (`admin/_ui/kit.tsx`) thành `mt-6 grid grid-cols-1 gap-6`, bỏ `max-w` ở `post-editor.tsx`, `admin/settings/storage/page.tsx`, trang Cấu hình thanh toán và 2 trang Cài đặt Studio; Phong bỏ `max-w-[1440px]` ở `product-editor.tsx`/`editor-skeleton.tsx` (2.3a). Không trang nào còn dùng `SettingsGrid`.
- **GĐ 2 — Studio (Quốc duyệt 2026-10-25; xong hết, không task nào hoãn; xong code + verify, chưa thử trình duyệt):**
  - ✅ **2.1** `ModuleTabs` "Cài đặt" (Thông tin & thương hiệu · Thanh toán; `studio/[tenantSlug]/settings/_ui/settings-tabs.ts`), h1 "Cài đặt", bỏ link chữ cuối trang, sửa `<main>` lồng 2 trang; sidebar không cần `match`. `useFormDraft` + `useUnsavedChanges` cho `branding-form` (`keepOnSuccess`), `slug-form`, `studio/onboarding-form.tsx` (trang onboarding ngoài layout Studio → bọc `UnsavedChangesProvider` ngay trong `studio/page.tsx`). Quốc thêm `revalidatePath` layout `/studio/{slug}` và `/{slug}` trong `updateBrandingAction`.
  - ✅ **2.2** Thanh toán tenant: QR thủ công · SePay · MoMo mỗi cổng 1 khối, cổng đang bật thì mở, badge trạng thái; không ghi lại secret; form có `key` → sửa Toggle lệch khi cổng tự tắt; xếp 1 cột.
  - ✅ **2.3a** Editor tài liệu (giữ bố cục 2 cột, không thêm tab): khối Thông tin (mở) / Giá & khuyến mãi (mở sẵn ở trang Tạo) / Danh mục & loại / Thẻ / Giới hạn lượt tải / Link chia sẻ private; Ảnh đại diện, Tệp tài liệu, card Xuất bản không thu gọn. `changedFields`/`touchField` chỉ cho badge, `dirty` vẫn là nguồn sự thật (lưu ý khi gắn tự lưu nháp). `beforeunload` → `useUnsavedChanges`; full width.
  - ✅ **2.3b** Link chia sẻ: `useFormDraft` không ghi lại mật khẩu link; hook hỗ trợ nhóm checkbox cùng tên (`RadioNodeList`); `fieldset/legend`; sửa `<main>` lồng; bỏ `SettingsGrid`.
  - ✅ **2.4** Editor bài viết: khối Nội dung bài viết (mở) / Tài liệu liên quan / Ghim bài; `beforeunload` → `useUnsavedChanges`.
  - ✅ **2.5** Trang bán hàng: kết luận không dùng accordion (list-detail chỉ hiện 1 section; mục ghim đổi hành vi hiển thị nên không giấu); badge → `warning`; `beforeunload` → `useUnsavedChanges`; sửa `<main>` lồng.
  - ✅ **2.6** Mã giảm giá 4 khối (Thông tin mã mở; Điều kiện & giới hạn, Thời gian áp dụng, Áp dụng cho sản phẩm thu gọn); `useFormDraft` trả thêm `values` cho badge tóm tắt. Rà 2 form ghi chú (đơn hàng, khách hàng): ô có kiểm soát → không cần `useFormDraft`. Sửa `<main>` lồng (coupons ×3, messages, products).
- **Hạ tầng sau GĐ 2:** `useFormDraft` có `names`, `secretNames`, `initial`, `resetKey`, `failed`, `keepOnSuccess`; trả `dirty`, `dirtyOf`, `values`, `formProps`; hỗ trợ nhóm checkbox. Không còn `<main>` lồng và không còn `beforeunload` riêng trong System Center lẫn Studio, trừ Lưu trữ file (1.10).
- **Còn mở:** 1.10 (chờ Vương); thử trình duyệt toàn GĐ 1 + GĐ 2 (hộp hỏi rời trang, giữ dữ liệu khi lưu lỗi, phím tab, 375px); 2 trang tab Cài đặt Studio chưa có `metadata.title` riêng, comment cũ ở `branding-form.tsx`/`product-editor.tsx`, 2 form billing Studio mức nguy cơ thấp chưa task nhận (KB-Audit §40 — chờ Quốc quyết).
- **Tiếp theo:** 1.10 khi Vương xong ADR-055.
- **Test:** `pnpm test:count` vẫn **100/66**.
- **Tài liệu:** bản trích `01-Architecture-Decisions/ADR-043-Module-Tabs-Accordion-Unsaved-Guard.md` (≙ ADR-058), `04-Operations-Runbooks/UI-Design-System.md` §4.4, §5 (quy tắc full width), §8.7, §9.1, §11.1, §11.3, §12.5, §12.6, §25, `00-Index/KB-Audit-2026-09-26.md` §38, §39, §40.

## Chuẩn bị chạy thử beta: thanh toán, email báo, giao dịch cổng (ADR-059 + 3 lần bổ sung) — B1, B2, B2b, B3 xong code, chưa commit; migration B3 chưa áp — 2026-10-25 → 26

**Chủ dự án chốt 2026-10-25 (ADR-059).** Đề xuất: `docs/de-xuat-chay-thu-thanh-toan-goi-tai-lieu-2026-10-25.md`. Beta chạy trên VPS (ADR-049). Không migration, không thêm `route.ts` (23 dưới `/api`, 25 toàn app).

- ✅ **B1 — Email báo + xác nhận trễ:**
  - Email `order_pending_manual` báo chủ gian hàng khi đơn gắn cổng thủ công **lần đầu** (khoá đơn `FOR UPDATE`, gửi bằng `after()`), không ghi `email_send_log`.
  - Email `invoice_pending_manual` báo admin tới "Email hỗ trợ" (`getSupportEmail()`, đọc động), chỉ khi hoá đơn **vừa tạo**.
  - Template `packages/email/src/templates/manual-payment-pending.ts`; helper `manualConfirmDeadline`, `isManualConfirmProvider` (hiện chỉ MANUAL_QR).
  - Xác nhận trễ hoá đơn MANUAL_QR EXPIRED (`confirmExpiredManualInvoice`, nút "Xác nhận trễ…"): chặn `NEWER_INVOICE_EXISTS`; tính lại kỳ bằng `computeRenewalPeriod`; `paidAt` = lúc xác nhận; khoá `subscriptions` FOR UPDATE; audit `lateConfirmation`, `periodRecomputed`, kỳ cũ/mới; mã lỗi `INVOICE_NOT_CONFIRMABLE`.
- ✅ **B2 — Nguyên tử + giao dịch cổng:** khoá race `createRenewalInvoice` (checkout tạo trước transaction); `markInvoicePaid` chỉ áp hoá đơn PENDING, idempotent (VOID/REFUNDED không xác nhận được); webhook platform ghi giao dịch trước khi áp hoá đơn; tab "Giao dịch cổng" `/admin/billing/invoices?tab=giao-dich` (`lib/platform-transactions.ts`, lọc chưa khớp / khớp chưa áp / đã áp, phân loại từng dòng); runbook chạy thử SePay.
- ✅ **B2b — SePay:**
  - Xác nhận hoá đơn từ giao dịch (`confirmInvoiceFromPlatformTransaction`): thiếu tiền chặn `TRANSACTION_UNDERPAID`, thừa/đúng cho; mỗi giao dịch một lần (`TRANSACTION_ALREADY_USED`); `INVOICE_ALREADY_PAID`; hoá đơn EXPIRED đi nhánh trễ (cả SEPAY, chỉ qua đường này); audit source `ADMIN_TRANSACTION_CONFIRM`, `differenceVnd`.
  - Tiền tố: hoá đơn SEPAY mới theo `paymentPrefix` (chữ/số ≤ 10, không thì SUB), webhook thử nhiều tiền tố, cảnh báo khi lưu; gian hàng giữ cách sinh mã đơn, webhook thử `paymentPrefix` + `orderCodePrefix`, form cảnh báo khi lệch; regex escape tiền tố + `codeLength` (8 / 6).
  - Studio `/studio/{slug}/orders/giao-dich` "Giao dịch cần xử lý" (UNMATCHED, MISMATCH_AMOUNT; `withTenant`); trang Đơn hàng báo số giao dịch cần xử lý.
  - Email `payment_mismatch` báo chủ gian hàng (sau commit trong job, không ghi log). Webhook body hỏng/thiếu trường → 400 `invalid_body` (platform + tenant).
- ✅ **B3 — MoMo cá nhân xác nhận tay (Bổ sung ADR-059 lần 3, chủ dự án chốt 2026-10-26):** xong code, chưa commit.
  - Provider mới `MOMO_MANUAL` cho cả PLATFORM (`/admin/billing/payment`) lẫn TENANT (`/studio/{slug}/settings/payments`); cấu hình `phone`, `accountName`, `vietQrAccountNo` (tuỳ chọn), không secret.
  - Checkout kiểu `WALLET` (`WalletTransferPanel`): có `vietQrAccountNo` thì sinh VietQR với `MOMO_VIETQR_BIN = 970454` (**chờ kiểm chứng**), không có thì chỉ thông tin + sao chép (F1).
  - Xác nhận tay + xác nhận trễ chung luật MANUAL_QR (`MANUAL_CONFIRM_PROVIDERS`); không webhook (route trả 404); email báo admin có `methodLabel`; cấu hình platform tự tắt khi đổi số điện thoại / số TK VietQR (ADR-013). MoMo API giữ nguyên, để tắt.
  - Migration expand-only `20261026150000_adr059_momo_manual` (`ALTER TYPE "PaymentProviderId" ADD VALUE 'MOMO_MANUAL'`) — **chưa áp**, chờ Quốc duyệt; trước khi áp, lưu cấu hình báo "chưa sẵn sàng" thay vì 500.
  - **Việc cần làm:** chạy runbook kiểm chứng MoMo (giải mã QR "Nhận tiền", chuyển thử 1.000đ) trước khi điền số TK VietQR; ghi vào **Chính sách người bán** rằng số điện thoại + tên chủ ví MoMo công khai ở trang thanh toán (chưa sửa văn bản trong CMS); `order_pending_manual` chưa có `methodLabel` (KB-Audit §43).
- **Chưa làm:** email cho giao dịch UNMATCHED và cho giao dịch khớp nhưng quá 24 giờ sau hạn đơn; kiểm trường payload MoMo.
- **Còn mở:** commit/deploy; chạy runbook SePay thật (giao dịch nhỏ, lưu cấu hình 2 lần — ADR-013); SMTP thật; **hạn đơn chờ thanh toán trong beta (60 phút hay 24 giờ) chưa chốt**; các điểm KB-Audit §41 chờ Quốc quyết.
- **Test:** assert thêm trong case có sẵn (`sepay.test.ts`, `order.test.ts`, `subscription-billing.test.ts`) — `pnpm test:count` vẫn **100/66**.
- **Tài liệu:** bản trích `01-Architecture-Decisions/ADR-044-Beta-Payments-Manual-Confirm-Emails-Sepay.md` (≙ ADR-059, §3.6 cho B3), `02-System-Specs/Payment-And-Billing.md` §2, §3, §5F–§5J, runbook `04-Operations-Runbooks/MoMo-Manual-Verification-Runbook.md`, `03-API-Contracts/Endpoint-Directory.md` §28.5, KB-Audit §43, `02-System-Specs/Order-State-Machine.md` §3.10–§3.11, `02-System-Specs/Audit-Log-Specs.md` §4, `03-API-Contracts/Endpoint-Directory.md` §9, §28, `03-API-Contracts/Database-Schema-Reference.md`, runbook mới `04-Operations-Runbooks/SePay-Live-Test-Runbook.md`, `00-Index/KB-Audit-2026-09-26.md` §41.

## Trang tuỳ chỉnh hiển thị Markdown + `{brand}` (ADR-060) — xong code, chưa commit; không migration — 2026-10-26

**Chủ dự án chốt 2026-10-26 (ADR-060, phương án a).**

- Khối `richText` của `/p/[slug]` render Markdown GFM ở server (`apps/web/lib/cms-markdown.ts`, thư viện `marked`): tiêu đề, đậm/nghiêng, danh sách, bảng, liên kết, trích dẫn. Không HTML thô (escape thành chữ), không ảnh.
- Làm sạch bằng `sanitizeRichTextHtml` + `trustedLinks`, tuỳ chọn mới `allowTables` (`packages/core/src/content/sanitize-html.ts`, chỉ trang tuỳ chỉnh bật); thay `{brand}` sau khi sanitize.
- Xuống dòng: nội dung có tiêu đề/bảng → xuống dòng đơn nối thành đoạn; không có → mỗi xuống dòng thành `<br>` (nội dung chữ thuần cũ hiển thị như trước).
- CSS bảng trong rich text (Phong, `globals.css`): cuộn ngang ngay trên `table`, ô tối thiểu 8em, dòng tiêu đề nền `#f5eedd`, bản in về bảng thường. Rủi ro: vùng cuộn chưa có `tabindex`.
- 3 dự thảo hướng dẫn khách hàng `docs/du-thao-huong-dan/` (đăng ký, kích hoạt, mua và tải) dùng `{brand}`; trang mua viết theo ADR-061, chưa đăng được khi còn dấu [CHƯA CÓ — ADR-061].
- **Test:** assert thêm trong `sanitize-html.test.ts` — `pnpm test:count` vẫn **100/66**.
- **Còn mở:** commit/deploy; thử trình duyệt 3 dự thảo; phạm vi luật in bảng ở trang tuỳ chỉnh (KB-Audit §42 mục 1).
- **Tài liệu:** bản trích `01-Architecture-Decisions/ADR-045-Custom-Page-Markdown-Brand-Token.md` (≙ ADR-060), `02-System-Specs/System-Cms-Menu-Home-Seo-Specs.md` §4A, `04-Operations-Runbooks/UI-Design-System.md` §3.1, `00-Index/KB-Audit-2026-09-26.md` §42.

## Luồng mua của khách: đơn chờ thanh toán, thông báo, email (ADR-061) — đã chốt, chưa triển khai — 2026-10-26

**Chủ dự án chốt 2026-10-26 (ADR-061 + "Chốt tiếp").** Phân tích: `docs/phan-tich-gio-hang-don-cho-48h-2026-10-26.md` (Hiếu).

- ⬜ Chỉ nút "Mua ngay"; không Giỏ hàng; mỗi đơn 1 tài liệu, hoàn cả đơn.
- ⬜ Mua không cần đăng ký trước: Họ tên + Email + ô xác nhận → tự tạo tài khoản, thanh toán và tải ngay trên phiên đó; email "Kích hoạt tài khoản và đặt mật khẩu" (token một lần, lưu hash); email đã có tài khoản → yêu cầu đăng nhập; rate limit tạo tài khoản/gửi email. Thay một phần ADR-053.
- ⬜ Hạn giữ đơn: thủ công (ngân hàng, MoMo) 72 giờ, SePay 48 giờ; không cửa sổ xác nhận trễ 24 giờ; giao dịch SePay đến sau hạn hiện ở "Giao dịch cần xử lý".
- ⬜ Danh sách "Đơn chờ thanh toán" + thông báo header khu vực Tài khoản; email khách lúc chọn cổng + 1 lần nhắc khi còn ≤ 24 giờ; email thanh toán thành công có nút "Tải tài liệu" về Thư viện.
- ⬜ Khách đổi được phương thức thanh toán; email người bán chống sót/trùng (cột đánh dấu trên `orders`, migration nhỏ — Quốc duyệt); người bán chỉ nhận email khi đơn thủ công chờ xác nhận và khi thanh toán thành công.
- ⬜ Giới hạn mã giảm giá "mỗi khách" tính cả đơn chờ còn hiệu lực.
- **Còn mở:** MoMo thủ công chờ kiểm thử thật; spec `Order-State-Machine`/`Auth-Session-Specs` chỉ sửa khi có code.
- **Tài liệu:** bản trích `01-Architecture-Decisions/ADR-046-Customer-Purchase-Flow-Pending-Orders-Notifications.md` (≙ ADR-061, đã chốt chưa triển khai), `00-Index/KB-Audit-2026-09-26.md` §42.

## Integration test không ghi cấu hình dùng chung + form cấu hình thanh toán (2026-10-24 → 25)

- **Sự cố 2026-10-24:** integration test ghi đè `system_storage_config` và dòng SEPAY platform trên DB dùng chung. Chủ dự án đã nhập lại cấu hình storage; hiện không còn dòng SEPAY.
- **Quy ước mới:** mock lớp đọc cấu hình, không snapshot/restore bảng singleton. `download.test.ts`, `product-upload.test.ts` mock `lib/system-storage`; `subscription-billing.test.ts` mock `getPlatformPaymentConfigRow` (hàm mới trong `lib/platform-payment.ts`, dùng ở `createRenewalInvoice` + webhook platform); `tenant-payment.test.ts` dựng cấu hình platform trong bộ nhớ. Đã xoá `tests/integration/shared-config-snapshot.ts`.
- **Form cấu hình thanh toán:** `savePlatformProviderConfig` trả `{ isEnabled, autoDisabled }`; 3 form có `key` theo dữ liệu đã lưu để nạp lại sau khi lưu và hiện thông báo khi cổng bị tự tắt (ADR-013).
- **Tài liệu:** `04-Operations-Runbooks/Publish-And-Rollback-Runbook.md` §2.2.1, `06-AI-Agent-Guides/Team-Charter.md` quy tắc 13, `04-Operations-Runbooks/Deploy-Vercel-Runbook.md` §9.1, `02-System-Specs/Payment-And-Billing.md` §5E. `docs/DECISIONS.md` ADR-034 mục 3, `docs/BACKLOG.md` và bản trích ADR-020 đã sửa theo quy ước mới (KB-Audit §37 mục 6).

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

## ADR-063 — Xem trước 20% nội dung thật của file tài liệu (2026-10-27)

- **Trạng thái:** code + UI + KB **xong, chưa commit** (working tree).
- **Thực thi:** Hiếu (schema `ProductFilePreview`, migration `20261027120000_adr063_product_file_previews`,
  lib `apps/web/lib/product-file-preview.ts`, route `GET /api/[tenantSlug]/[productSlug]/preview/[fileId]`,
  hook `apps/web/lib/file-scan.ts`, 2 unit `packages/core/src/content/preview-extract.test.ts` + 2 integration
  `apps/web/tests/integration/product-file-preview-route.test.ts`, nâng trần test 100→102 unit, 66→68
  integration ở `scripts/count-tests.mjs`, pure helper `packages/core/src/content/preview-extract.ts`,
  helper storage `packages/storage/src/read-object.ts`); Phong (polish section + modal UI, focus trap, Esc,
  body scroll lock, animation CSS trong `globals.css`, icon + skeleton + error retry); Long (KB
  [[ADR-047-Public-Product-File-Preview-20-Percent]] + updates Specs/Endpoints/Schema/Timeline/MOC/Audit/Tags).
- **Chưa làm (cần Quốc):**
  - `pnpm install` sạch để lockfile `pdf-parse@^1.1.1` (install cũ bị treo nhiều lần, cũng kéo `xlsx`/`marked` đã khai báo trước đó cài vào).
  - Áp migration `20261027120000_adr063_product_file_previews` lên DB dùng chung sau khi Quốc duyệt (ADR-034).
  - Rate limit 60 req/phút/IP (ADR-063 §5): bảng `rate_limit_counters` đã có nhưng chưa có helper public — route handler còn TODO.
  - Chạy integration test sau khi áp migration ADR-061 + ADR-063 (hiện FAIL do DB thiếu `users.hasPassword`).

## Kế hoạch SEO tổng thể — hoãn (chủ dự án chốt 2026-10-24)

- Không làm thêm chức năng SEO lẻ trong các phiên hiện tại; gom thành **một kế hoạch tổng thể cho toàn hệ thống** sau:
  khung xem trước kết quả Google dùng chung cho mọi editor (trang chủ, Bảng giá, pháp lý…), đồng bộ ô SEO (gợi ý mặc định,
  trạng thái lưu), ảnh OG, noindex, sitemap/robots, JSON-LD (Organization, WebSite, BreadcrumbList, Product), SEO cho
  gian hàng/tài liệu. Hiện có: ô SEO trang chủ (ADR-050), Bảng giá (ADR-041), văn bản pháp lý (ADR-054).


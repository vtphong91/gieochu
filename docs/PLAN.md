# PLAN — Gieo Chữ MVP Giai đoạn 1

Nguồn: [GIEOCHU_PROMPT_MVP_PHASE1.md](GIEOCHU_PROMPT_MVP_PHASE1.md). Cập nhật file này sau mỗi module.

## Thứ tự triển khai thực tế

Theo gợi ý ở mục 10 của đặc tả:

M0 → M1 (kèm khung email M11) → M4 → M2 (phần cơ bản) → M7 → M3 → M5 → M6 → M8 → M9 → M3 v2 (Hybrid
Monetization, xen giữa theo yêu cầu người dùng) → M10 → M12 → hoàn thiện M2.

## Trạng thái module

| # | Module | Trạng thái | File chính | Test (unit/integration) |
|---|---|---|---|---|
| M0 | Nền móng dự án | ✅ Xong (bản đầu) | monorepo root, `packages/config`, `packages/core`, `packages/db` (schema tối thiểu), `docker/`, `apps/web` (shell) | 4 / 0 |
| M1 | Xác thực và định danh | ✅ Xong | `packages/auth`, `packages/email`, `packages/jobs`, `apps/web/app/(auth)`, `apps/web/app/account`, `apps/web/lib` | 16 / 8 |
| M4 | Tenant Workspace và Storefront | ✅ Xong | `apps/web/app/[tenantSlug]`, `apps/web/app/studio`, `packages/db/src/rls.ts` | 6 / 5 |
| M2 | System Admin (cơ bản) | ✅ Xong (cơ bản — Platform Payment UI + audit log viewer chờ M7/M12) | `apps/web/app/admin`, `packages/core/src/admin` | 4 / 4 |
| M7 | Cấu hình Tenant Payment | ✅ Xong | `packages/payments` | 10 / 4 |
| M3 | Billing, Subscription & Entitlements (v2 — Hybrid Monetization) | ✅ Xong | `apps/web/lib/subscription-billing.ts`, `subscription-sweep.ts`, `platform-payment.ts`, `packages/core/src/billing` | 11 / 7 |
| M5 | Sản phẩm và File tài liệu | 🟡 Code xong (CRUD + upload/presign/file.scan) — chờ verify với R2 thật | `packages/storage`, `apps/web/lib/{product,product-upload,file-scan}.ts` | 6 / 3 (+1 chờ storage thật) |
| M6 | Giá và Khuyến mãi | 🟡 Engine + Coupon CRUD xong — 1 test chờ Order (M8) | `packages/core/src/pricing`, `apps/web/lib/coupon.ts` | 14 / 1 (+1 chờ M8) |
| M8 | Checkout và Đơn hàng | ✅ Xong | `apps/web/lib/{order,payment-process}.ts`, `packages/core/src/order` | 10 / 9 |
| M9 | Thư viện, Tải xuống, Share link | ✅ Xong | `apps/web/lib/{download,share-link,library,entitlement}.ts`, `packages/core/src/download` | 7 / 5 |
| M10 | Social Feed và Đánh giá | ⬜ Chưa làm | posts/comments/reviews | 4 / 3 |
| M11 | Email và Background Jobs | 🟡 Khung đã có (cùng M1) — job/worker còn lại thêm khi có nghiệp vụ tương ứng | `packages/jobs`, `packages/email`, `apps/web/worker.ts` | 0 / 0 (tính trong module khác) |
| M12 | Audit Log, Thống kê, Báo cáo vi phạm | ⬜ Chưa làm | audit + stats + reports | 0 / 2 |
| | **Tổng** | | | **91 / 50** |

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
  M12, sẽ nối lại khi làm M12.

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
  viewer, báo cáo vi phạm — chờ M7/M12 theo đúng thứ tự mục 10 ("hoàn thiện M2" ở cuối).
- **Bug tự bắt được khi smoke-test thật** (không phải qua unit/integration test): `/admin` trả 500 vì dùng
  nhầm guard ném lỗi (`requireRole`, đúng cho API/Action) trong Server Component thay vì guard chuyển hướng.
  Sửa bằng `requireAdminAccess()`/`requireTenantMemberPage()` mới trong `lib/page-guards.ts`, đồng thời vá
  luôn 2 trang `/studio/[tenantSlug]/*` từ M4 bị lỗi tương tự. Đã xác minh lại bằng đăng nhập thật (super
  admin → 200, user thường → 404, chưa đăng nhập → 307).

**Đã xác minh chạy được trong phiên này:** `pnpm lint/typecheck/test/build` xanh toàn bộ (30/91 unit, 17/50
integration cộng dồn); đăng nhập thật qua `curl` với user seed (`admin@gieochu.net`) xem `/admin` thật, và
với user thường xác nhận bị 404.

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
- Trang công khai `/[tenantSlug]/products/[productSlug]` (chi tiết sản phẩm, nút "Mua ngay" — mở lại quyết
  định hoãn từ M5) và `/[tenantSlug]/checkout/[orderCode]` (tóm tắt đơn, nhập mã giảm giá, chọn phương thức
  thanh toán, hiện QR/redirect, polling 3 giây — cùng mẫu `BillingPoll` của M3's `/studio/.../billing`).
- Trang Studio `/studio/[tenantSlug]/orders` (danh sách lọc theo trạng thái, chi tiết, xác nhận thủ công/huỷ/
  hoàn tiền) và `/studio/[tenantSlug]/customers` (danh sách khách hàng). Dashboard Studio nối 2 StatCard từng
  để trống "Cần M8" (doanh thu 30 ngày, đơn chờ xác nhận) bằng dữ liệu thật.
- Job `order.sweep` chạy mỗi 5 phút (không phải mỗi giờ như `subscription.sweep`) — TTL đơn PENDING mặc định
  chỉ 60 phút nên lịch mỗi giờ có thể để đơn hết hạn hiển thị PENDING sai tới gần 1 giờ.
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
  với chu kỳ subscription (ADR-019).
- `DownloadToken` là bảng L1 (không RLS), `ShareLink`/`DownloadEvent` là L2 — và 3 policy RLS đã có
  (`products`, `product_files` từ M4/M5) được sửa thêm nhánh "customer" ở M9 sau khi chính test thật bắt
  được lỗ hổng (ADR-020).
- Hash mật khẩu share link dùng argon2 riêng trong `packages/core` (không gọi lại `packages/auth`'s
  password functions) để giữ đúng chiều phụ thuộc package — `core` không bao giờ phụ thuộc `auth` (ADR-020).
- Chưa hỏi người dùng các quyết định ảnh hưởng tiền/bảo mật/dữ liệu cá nhân — sẽ dừng lại đúng lúc theo mục
  0.6 khi gặp.

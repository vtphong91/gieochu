# PLAN — Gieo Chữ MVP Giai đoạn 1

Nguồn: [GIEOCHU_PROMPT_MVP_PHASE1.md](GIEOCHU_PROMPT_MVP_PHASE1.md). Cập nhật file này sau mỗi module.

## Thứ tự triển khai thực tế

Theo gợi ý ở mục 10 của đặc tả:

M0 → M1 (kèm khung email M11) → M4 → M2 (phần cơ bản) → M7 → M3 → M5 → M6 → M8 → M9 → M10 → M12 → hoàn thiện M2.

## Trạng thái module

| # | Module | Trạng thái | File chính | Test (unit/integration) |
|---|---|---|---|---|
| M0 | Nền móng dự án | ✅ Xong (bản đầu) | monorepo root, `packages/config`, `packages/core`, `packages/db` (schema tối thiểu), `docker/`, `apps/web` (shell) | 4 / 0 |
| M1 | Xác thực và định danh | ✅ Xong | `packages/auth`, `packages/email`, `packages/jobs`, `apps/web/app/(auth)`, `apps/web/app/account`, `apps/web/lib` | 16 / 8 |
| M4 | Tenant Workspace và Storefront | ✅ Xong | `apps/web/app/[tenantSlug]`, `apps/web/app/studio`, `packages/db/src/rls.ts` | 6 / 5 |
| M2 | System Admin (cơ bản) | ✅ Xong (cơ bản — Platform Payment UI + audit log viewer chờ M7/M12) | `apps/web/app/admin`, `packages/core/src/admin` | 4 / 4 |
| M7 | Cấu hình Tenant Payment | ✅ Xong | `packages/payments` | 10 / 4 |
| M3 | Subscription và Platform Billing | ✅ Xong | `apps/web/lib/subscription-billing.ts`, `subscription-sweep.ts`, `platform-payment.ts`, `packages/core/src/billing` | 10 / 5 |
| M5 | Sản phẩm và File tài liệu | 🟡 Code xong (CRUD + upload/presign/file.scan) — chờ verify với R2 thật | `packages/storage`, `apps/web/lib/{product,product-upload,file-scan}.ts` | 6 / 3 (+1 chờ storage thật) |
| M6 | Giá và Khuyến mãi | ⬜ Chưa làm | `packages/core/pricing` | 14 / 2 |
| M8 | Checkout và Đơn hàng | ⬜ Chưa làm | order service, webhooks | 10 / 8 |
| M9 | Thư viện, Tải xuống, Share link | ⬜ Chưa làm | download API, `/s/[token]` | 7 / 5 |
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
- Chưa hỏi người dùng các quyết định ảnh hưởng tiền/bảo mật/dữ liệu cá nhân — sẽ dừng lại đúng lúc theo mục
  0.6 khi gặp.

# PLAN — Gieo Chữ MVP Giai đoạn 1

Nguồn: [GIEOCHU_PROMPT_MVP_PHASE1.md](GIEOCHU_PROMPT_MVP_PHASE1.md). Cập nhật file này sau mỗi module.

## Thứ tự triển khai thực tế

Theo gợi ý ở mục 10 của đặc tả:

M0 → M1 (kèm khung email M11) → M4 → M2 (phần cơ bản) → M7 → M3 → M5 → M6 → M8 → M9 → M10 → M12 → hoàn thiện M2.

## Trạng thái module

| # | Module | Trạng thái | File chính | Test (unit/integration) |
|---|---|---|---|---|
| M0 | Nền móng dự án | ✅ Xong (bản đầu) | monorepo root, `packages/config`, `packages/core`, `packages/db` (schema tối thiểu), `docker/`, `apps/web` (shell) | 4 / 0 |
| M1 | Xác thực và định danh | ⬜ Chưa làm | `packages/auth`, `apps/web/app/(auth)`, mở rộng schema User | 16 / 8 |
| M4 | Tenant Workspace và Storefront | ⬜ Chưa làm | `apps/web/app/[tenantSlug]`, `apps/web/app/studio` | 6 / 5 |
| M2 | System Admin (cơ bản) | ⬜ Chưa làm | `apps/web/app/admin` | 4 / 4 |
| M7 | Cấu hình Tenant Payment | ⬜ Chưa làm | `packages/payments` | 10 / 4 |
| M3 | Subscription và Platform Billing | ⬜ Chưa làm | billing service + jobs | 10 / 5 |
| M5 | Sản phẩm và File tài liệu | ⬜ Chưa làm | `packages/storage`, product CRUD | 6 / 4 |
| M6 | Giá và Khuyến mãi | ⬜ Chưa làm | `packages/core/pricing` | 14 / 2 |
| M8 | Checkout và Đơn hàng | ⬜ Chưa làm | order service, webhooks | 10 / 8 |
| M9 | Thư viện, Tải xuống, Share link | ⬜ Chưa làm | download API, `/s/[token]` | 7 / 5 |
| M10 | Social Feed và Đánh giá | ⬜ Chưa làm | posts/comments/reviews | 4 / 3 |
| M11 | Email và Background Jobs | ⬜ Chưa làm (khung sẽ thêm cùng M1) | `packages/jobs`, `packages/email` | 0 / 0 (tính trong module khác) |
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

## Câu hỏi còn mở (đã chọn phương án an toàn, xem ADR tương ứng)

- ID strategy: cuid2 (ADR-001).
- `downloadLimit=0` nghĩa là không giới hạn (ADR — sẽ ghi ở M5).
- Local dev DB: khuyến nghị dùng Neon branch miễn phí thay vì Postgres container, vì `@prisma/adapter-neon`
  cần giao thức Neon serverless (ADR-004).
- Chưa hỏi người dùng các quyết định ảnh hưởng tiền/bảo mật/dữ liệu cá nhân — sẽ dừng lại đúng lúc theo mục
  0.6 khi gặp.

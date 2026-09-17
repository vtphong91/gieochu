# CLAUDE.md — Gieo Chữ

Đặc tả đầy đủ: [docs/GIEOCHU_PROMPT_MVP_PHASE1.md](docs/GIEOCHU_PROMPT_MVP_PHASE1.md). File này chỉ ghi quy ước
vận hành cho các phiên làm việc sau — đọc đặc tả trước khi implement bất kỳ module nào.

## Tiến độ

Xem [docs/PLAN.md](docs/PLAN.md) cho thứ tự module và trạng thái hiện tại. Sau mỗi module, cập nhật PLAN.md.

## Lệnh chạy (từ root, pnpm workspaces + Turborepo)

| Lệnh | Việc làm |
|---|---|
| `pnpm install` | Cài dependencies toàn monorepo |
| `pnpm dev` | Chạy `next dev` (yêu cầu `.env` đầy đủ — env fail-fast qua zod) |
| `pnpm build` | Build tất cả package/app |
| `pnpm lint` | ESLint flat config, `--max-warnings=0` |
| `pnpm typecheck` | `tsc --noEmit` mọi package |
| `pnpm test` | Cả Jest (unit) và Vitest (integration) |
| `pnpm test:unit` | Jest trong `packages/*` |
| `pnpm test:integration` | Vitest trong `apps/web/tests/integration` |
| `pnpm test:count` | Đếm số test case, đối chiếu 91 unit / 50 integration (mục 9) |
| `pnpm db:migrate` | `prisma migrate deploy` (dùng `DIRECT_URL`) |
| `pnpm db:seed` | `prisma db seed` |
| `docker compose -f docker/docker-compose.yml up` | MinIO + Mailpit (+ `--profile local-db` để có Postgres local) |

Trước `pnpm dev`/test lần đầu: copy `.env.example` → `.env`, điền đủ biến (mục 11). Env thiếu biến bắt buộc sẽ
làm ứng dụng dừng ngay khi khởi động (`packages/config/src/env.ts`), kể cả khi chỉ mở trang marketing —
đây là hành vi cố ý (fail-fast).

## Cấu trúc thư mục

Xem sơ đồ đầy đủ ở `docs/GIEOCHU_PROMPT_MVP_PHASE1.md` §4.4. Tóm tắt:

- `apps/web` — Next.js 16 App Router. `proxy.ts` (không phải `middleware.ts`) chỉ gắn `x-request-id` và làm
  redirect thô; **mọi** route handler / server action / server component nhạy cảm phải tự `requireUser()` /
  `requireRole()` lại — không tin proxy.
- `packages/config` — env schema (zod, fail-fast), brand strings (`brand.ts`), ESLint preset dùng chung.
- `packages/core` — `AppError` + mã lỗi, logger (`pino`, có redact), sau này thêm pricing engine, order FSM.
- `packages/db` — Prisma schema, `prisma.config.ts` (CLI dùng `DIRECT_URL`), client chạy qua
  `@prisma/adapter-neon` (dùng `DATABASE_URL` pooled), seed script. RLS helpers `withTenant/withCustomer/
  withPublic/withSystemJob` sẽ thêm khi có bảng L2 đầu tiên (M4).
- `packages/auth`, `packages/payments`, `packages/storage`, `packages/email`, `packages/jobs` — skeleton hiện
  tại, mỗi package có comment ghi rõ sẽ triển khai ở module nào (xem source).
- `docker/docker-compose.yml` — MinIO (+ tạo bucket), Mailpit, Postgres 16 (`profile: local-db`, tuỳ chọn).

## Quy ước code

- TypeScript `strict: true` (kế thừa `tsconfig.base.json`), không `any` không cần thiết.
- Tiền tệ VND: số nguyên (`Int`/`BigInt`), không dùng `float`.
- Thời gian lưu UTC, hiển thị `Asia/Ho_Chi_Minh`.
- ID: **cuid2** — dùng thuộc tính Prisma gốc `@default(cuid(2))` cho mọi `@id`. Không dùng UUID (xem
  `docs/DECISIONS.md`).
- Không hard-code chuỗi thương hiệu ("Gieo Chữ", "Gieo", slogan) — luôn đọc từ `@gieochu/config/brand`.
- Không `import` `@prisma/client` trực tiếp trong `apps/web` — chỉ qua helper của `@gieochu/db`
  (ESLint `no-restricted-imports`, xem `packages/config/eslint-preset.mjs`).
- Lỗi nghiệp vụ ném `AppError` (`@gieochu/core`), không ném `Error` trần trong route handler.
- Response lỗi API luôn dạng `{ error: { code, message, requestId } }` (mục 6).
- Commit theo Conventional Commits (`feat(auth): ...`, `test(orders): ...`), commit nhỏ theo từng module.
- Test đặt tên tiếng Anh mô tả hành vi; `describe` theo module (`describe("M8 orders", ...)`). **Không thêm/bớt
  số lượng test case so với bảng ở mục 9** nếu chưa hỏi lại người dùng.

## Quy tắc bảo mật (mục 7 — bắt buộc cho mọi module)

1. Access/refresh token chỉ trong cookie `httpOnly`, `Secure` (prod), `SameSite=Lax`. Refresh cookie
   `Path=/api/auth`. Không dùng `localStorage`.
2. Chỉ lưu **hash SHA-256** của refresh token, token kích hoạt, token reset, token share link, token download.
3. Secret cổng thanh toán (platform lẫn tenant) mã hoá **AES-256-GCM** bằng `PAYMENT_ENCRYPTION_KEY` trước khi
   lưu DB. Không bao giờ trả secret về client — UI chỉ hiện `••••abcd`.
4. Webhook: xác thực chữ ký/API key **trước** khi parse nghiệp vụ, so sánh bằng `timingSafeEqual`, idempotent
   qua bảng `webhook_events`, trả 2xx nhanh rồi xử lý nặng trong job.
5. Không tin số tiền/trạng thái từ client — luôn tính lại tổng tiền ở server.
6. File trong bucket private. URL tải chỉ là presigned, sống ≤ 10 phút, `Content-Disposition: attachment`.
7. Server Actions dựa vào cơ chế CSRF sẵn có của Next.js; Route Handler ghi dữ liệu phải kiểm tra header
   `Origin`.
8. CSP, `X-Content-Type-Options`, `Referrer-Policy` cấu hình trong `next.config.ts`.
9. System admin **không có route nào** đọc chi tiết đơn hàng/khách hàng của tenant — chỉ đọc
   `tenant_daily_stats` và bảng L1.

## Ranh giới layer (không phá vỡ)

- L1 System / L2 Tenant / L3 Customer — xem `docs/ARCHITECTURE.md`. Hai hệ thống thanh toán (Platform vs
  Tenant) dùng chung `packages/payments` nhưng **không bao giờ** chung bảng, secret hay route. Mọi hàm thanh
  toán nhận `PaymentScope` (`{kind:'PLATFORM'}` hoặc `{kind:'TENANT', tenantId}`).

## Khi đặc tả mơ hồ

Chọn phương án an toàn/đơn giản nhất, ghi ADR ngắn vào `docs/DECISIONS.md`. Nếu ảnh hưởng tiền, bảo mật, hoặc
dữ liệu cá nhân — dừng lại và hỏi người dùng thay vì tự quyết.

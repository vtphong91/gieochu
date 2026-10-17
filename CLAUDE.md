# CLAUDE.md — Gieo Chữ

Đặc tả đầy đủ: [docs/GIEOCHU_PROMPT_MVP_PHASE1.md](docs/GIEOCHU_PROMPT_MVP_PHASE1.md). File này chỉ ghi quy ước
vận hành cho các phiên làm việc sau — đọc đặc tả trước khi implement bất kỳ module nào.

## Tiến độ

Xem [docs/PLAN.md](docs/PLAN.md) cho thứ tự module và trạng thái hiện tại. Sau mỗi module, cập nhật PLAN.md.

## Đội & phân công (Quốc · Long · Hiếu · Phong)

Hiến chương đội: [obsidian-knowledge-base/06-AI-Agent-Guides/Team-Charter.md](obsidian-knowledge-base/06-AI-Agent-Guides/Team-Charter.md).
**Phiên chính là Quốc** — kỹ sư trưởng / kiến trúc sư, điều phối, cổng duy nhất giữa chủ dự án và ba sub-agent.

| Thành viên | Vai trò | Hình thức | Quyền ghi |
|---|---|---|---|
| Quốc | Kỹ sư trưởng, kiến trúc, điều phối, review (A01/A02/A06/A07) | Phiên chính, persona ở file này | `CLAUDE.md`, `docs/DECISIONS.md` (ADR), `docs/PLAN.md`, brief, review; sửa code nhỏ/khẩn cấp |
| Long | Chuyên viên tài liệu, người giữ skill (A08) | Sub-agent `long` (`.claude/agents/long.md`) | `obsidian-knowledge-base/**` (01-Architecture-Decisions/ chỉ khi Quốc duyệt); `docs/*.md` gốc chỉ khi brief giao rõ |
| Hiếu | Kỹ sư lập trình 10 năm kinh nghiệm (A03/A04 logic/A05) | Sub-agent `hieu` (`.claude/agents/hieu.md`) | `apps/web/**`, `packages/**` (gồm `packages/db/prisma/`), test — lớp trình bày chỉ khi brief giao |
| Phong | Chuyên viên UX/UI — design layout, component, token, a11y (A04 UI) | Sub-agent `phong` (`.claude/agents/phong.md`), skill `ui-ux-pro-max` | Lớp trình bày: `apps/web/app/**/_ui/**`, `globals.css`, `public/**`, JSX/className/bố cục trong `page.tsx`/`layout.tsx`; `packages/config/src/theme.ts` chỉ khi brief nêu rõ |

**Vùng tri thức** — mỗi người chỉ mở vùng của mình, cần thứ ngoài vùng thì hỏi Quốc:

| Vùng | Quốc | Long | Hiếu | Phong |
|---|---|---|---|---|
| `CLAUDE.md`, `00-Index/` (MOC, KB-Audit) | đọc/ghi | đọc/ghi 00-Index; đọc `CLAUDE.md` | — | — |
| `docs/DECISIONS.md` + `01-Architecture-Decisions/` | ghi | đọc; ghi khi Quốc duyệt | đọc (ràng buộc) | đọc ADR liên quan UI |
| `02-System-Specs/` | đọc | ghi | đọc chỉ spec liên quan task | đọc chỉ spec liên quan task |
| `03-API-Contracts/` | đọc | ghi | đọc trang liên quan; contract đổi → báo Quốc để giao Long | — (nhận contract qua brief) |
| `04-Operations-Runbooks/` | đọc | ghi | — (trừ task release/DR) | đọc `UI-Design-System.md` |
| `05-Historical-Archive/` | — | đọc khi cần ngữ cảnh | không đọc | không đọc |
| `06-AI-Agent-Guides/` (Charter, template, skill) | đọc Team-Charter | ghi | — | — |
| Code logic: `route.ts`, Server Actions, `lib/**`, `packages/**`, schema | đọc khi review | đọc để đối chiếu, không sửa | ghi | đọc, không sửa |
| Lớp trình bày: `_ui/**`, `globals.css`, JSX/layout trong page/layout | đọc khi review | đọc để đối chiếu, không sửa | ghi khi brief giao | ghi |
| `.claude/skills/ui-ux-pro-max/` | — | — | — | dùng (nạp sẵn), không sửa |

**Quy trình một task:**
1. Quốc nhận yêu cầu, làm rõ business rule mơ hồ (Zero Guessing), **chốt phạm vi với chủ dự án trước khi code**,
   ghi ADR vào `docs/DECISIONS.md` nếu là quyết định dài hạn.
2. Quốc giao brief cho Hiếu (logic/dữ liệu) và/hoặc Phong (layout/UI) theo mẫu `obsidian-knowledge-base/06-AI-Agent-Guides/skills/CLAUDE-ORCHESTRATOR-TEMPLATE.md`
   §3 (TASK, READ_REQUIRED, CONSTRAINTS, OUTPUT_EXPECTED, DO_NOT_TOUCH, VERIFY_REQUIRED). READ_REQUIRED chỉ trỏ vào
   vùng của agent nhận việc. Task có cả UI lẫn dữ liệu: Phong chốt bố cục + contract dữ liệu cần, Hiếu làm phần
   dữ liệu/logic theo contract đó; Quốc là người chuyển contract giữa hai bên.
3. Hiếu/Phong thực hiện, verify (lint, typecheck, test, `test:count`; với thay đổi nghiệp vụ/bảo mật/RLS thêm dữ liệu thật
   qua dev server; Phong thêm kiểm tra a11y/responsive/trạng thái loading-empty-error), báo: file đã đổi, kết quả
   verify, rủi ro, tác động tài liệu.
4. Quốc review `git diff`/`git status`, đối chiếu ADR và ranh giới L1/L2/L3 + RLS. File ngoài vùng ghi hoặc không
   đạt → trả lại agent đã làm.
5. Quốc giao Long danh sách thay đổi cần ghi (spec, endpoint, schema, skill, runbook). Long cập nhật KB và báo
   lại các trang đã sửa; Quốc kiểm tra diff.
6. Task xong khi code đạt verify **và** Long đã ghi nhận (bỏ qua bước 5 với sửa lỗi nhỏ không đổi hành vi/contract).
   Commit chỉ khi chủ dự án yêu cầu.

Quốc không tự code phần lớn task — chỉ sửa nhỏ (1–2 file, nghiệp vụ rõ) hoặc khẩn cấp. Ranh giới vùng ghi/đọc là
ràng buộc bằng chỉ dẫn, không phải cơ chế công cụ. **Nguồn sự thật:** code runtime > `docs/*.md` gốc
(PLAN/DECISIONS/ARCHITECTURE/BACKLOG) > `obsidian-knowledge-base/`.

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
| `pnpm test:count` | Đếm số test case, đối chiếu mốc trong `scripts/count-tests.mjs` (trần gốc 91/50 mục 9; trần hiện 94/55 theo ADR-026 + ADR-037 — số test thực 93/54) |
| `pnpm db:migrate` | `prisma migrate deploy` (dùng `PRISMA_MIGRATE_URL`, role owner) |
| `pnpm db:seed` | `prisma db seed` (dùng `DATABASE_URL`, role `gieochu_app`) |
| `pnpm --filter @gieochu/db run setup-app-role` | Tạo/cập nhật role Postgres `gieochu_app` (chạy 1 lần/môi trường Neon mới) |
| `docker compose -f docker/docker-compose.yml up` | MinIO + Mailpit (+ `--profile local-db` để có Postgres local) |

Trước `pnpm dev`/test lần đầu: copy `.env.example` → `.env`, điền đủ biến (danh sách hiện hành: `packages/config/src/env.ts`
— runtime chỉ 8 biến hạ tầng + secret theo ADR-032, cộng `CRON_SECRET` tuỳ chọn theo ADR-036 — nếu đặt thì ≥32 ký tự, ngắn hơn làm app fail-fast; mục 11 đặc tả gốc đã cũ). ⚠️ `pnpm db:seed` ghi đè nội dung trang chủ
CMS — không chạy khi `.env` còn trỏ DB production. Env thiếu biến bắt buộc sẽ
làm ứng dụng dừng ngay khi khởi động (`packages/config/src/env.ts`), kể cả khi chỉ mở trang marketing —
đây là hành vi cố ý (fail-fast).

## Cấu trúc thư mục

Xem sơ đồ đầy đủ ở `docs/GIEOCHU_PROMPT_MVP_PHASE1.md` §4.4. Tóm tắt:

- `apps/web` — Next.js 16 App Router. `proxy.ts` (không phải `middleware.ts`) chỉ gắn `x-request-id` và làm
  redirect thô; **mọi** route handler / server action / server component nhạy cảm phải tự `requireUser()` /
  `requireRole()` lại — không tin proxy.
- `packages/config` — env schema (zod, fail-fast), brand strings (`brand.ts`), ESLint preset dùng chung.
- `packages/core` — `AppError` + mã lỗi, logger (`pino`, có redact), sau này thêm pricing engine, order FSM.
- `packages/db` — Prisma schema, `prisma.config.ts` (CLI dùng `PRISMA_MIGRATE_URL`, role owner — cần quyền DDL),
  client chạy qua `@prisma/adapter-neon` (dùng `DATABASE_URL` pooled, role `gieochu_app`), seed script. RLS
  helpers `withTenant/withCustomer/withPublic/withSystemJob` (`src/rls.ts`, từ M4) — **bắt buộc** dùng cho mọi
  bảng L2 (có `tenantId`); `getPrismaClient()` trực tiếp chỉ dành cho bảng L1 (users, tokens, plans...).
  **Quan trọng:** app kết nối bằng role `gieochu_app` (tạo qua `packages/db/scripts/setup-app-role.mts`), **không
  phải** role owner Neon mặc định — role owner có `BYPASSRLS` nên RLS vô hiệu nếu dùng nó (xem ADR-010).
- `packages/auth`, `packages/payments`, `packages/storage`, `packages/email`, `packages/jobs` — đã triển khai theo
  các module tương ứng (xem source).
- **Job nền (ADR-036):** Vercel không chạy worker thường trực. Job `payment.process`/`file.scan` được drain ngay sau
  response bằng `after()` (`apps/web/lib/job-runner.ts`); sweep thuê bao/đơn + dọn job sót chạy qua Vercel Cron
  `GET /api/cron/daily` (Bearer `CRON_SECRET`). `worker.ts` **không deploy** và **không chạy local trên DB dùng chung**
  (sẽ tạo lại lịch pg-boss và chạy song song với cron) trừ khi Quốc duyệt.
- `docker/docker-compose.yml` — MinIO (+ tạo bucket), Mailpit, Postgres 16 (`profile: local-db`, tuỳ chọn).

## Quy ước code

- TypeScript `strict: true` (kế thừa `tsconfig.base.json`), không `any` không cần thiết.
- Tiền tệ VND: số nguyên (`Int`/`BigInt`), không dùng `float`.
- Thời gian lưu UTC, hiển thị `Asia/Ho_Chi_Minh`.
- Độ rộng layout (ADR-024): trang public bọc nội dung bằng utility `container-page` (1280px, căn giữa), trang đọc
  dài `container-prose` (768px), form đơn lẻ `container-narrow` (448px) — khai báo trong `apps/web/app/globals.css`.
  Không tự đặt `max-w-[...]` cho khung trang; nền section vẫn full-bleed. App shell `/admin`, `/studio`,
  `/account` fluid theo sidebar.
- URL trang tài liệu (ADR-030): luôn dựng bằng `productPath(tenantSlug, productSlug)` → `/{tenantSlug}/{productSlug}`.
  Thêm route tĩnh mới dưới `app/[tenantSlug]/` thì **phải** thêm tên đó vào `RESERVED_PRODUCT_SLUGS`
  (`packages/core/src/product/path.ts`) và quét slug trùng trên DB prod.
- **Một DB duy nhất (ADR-034):** máy dev, Vercel Preview và Production dùng **cùng** database Neon — mọi thao tác DB
  từ máy dev là thao tác trên production. Agent **không tự chạy** `db:migrate`/DDL khi chưa được Quốc duyệt; migration
  theo expand → contract (deploy chỉ *thêm* cột/bảng; `DROP`/`RENAME` chỉ sau khi code không còn dùng đã lên prod).
  **Không chạy `pnpm db:seed`**. Integration test/script thủ công phải dọn dữ liệu tạm, không đụng cấu hình dùng chung,
  không gửi email tới địa chỉ thật.
- ID: **cuid2** — dùng thuộc tính Prisma gốc `@default(cuid(2))` cho mọi `@id`. Không dùng UUID (xem
  `docs/DECISIONS.md`).
- Không hard-code chuỗi thương hiệu ("Gieo Chữ", "Gieo", slogan) — đọc bằng `getEffectiveBrand()`
  (`apps/web/lib/branding.ts`, DB `SystemBranding`, fallback `DEFAULT_BRAND` ở `@gieochu/config/brand`); client
  component nhận tên qua prop từ server (ADR-032).
- Cấu hình nghiệp vụ/TTL đọc qua `getSystemSettings()` (`apps/web/lib/system-settings.ts`, ADR-032), không qua env;
  múi giờ hiển thị dùng hằng `DISPLAY_TIME_ZONE` (`@gieochu/core`).
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
8. CSP (nonce theo từng request, sinh trong `proxy.ts` — xem ADR-016), `X-Content-Type-Options`,
   `Referrer-Policy` (2 header sau cấu hình tĩnh trong `next.config.ts`).
9. System admin **không có route nào** đọc chi tiết đơn hàng/khách hàng của tenant — chỉ đọc
   `tenant_daily_stats` và bảng L1.

## Ranh giới layer (không phá vỡ)

- L1 System / L2 Tenant / L3 Customer — xem `docs/ARCHITECTURE.md`. Hai hệ thống thanh toán (Platform vs
  Tenant) dùng chung `packages/payments` nhưng **không bao giờ** chung bảng, secret hay route. Mọi hàm thanh
  toán nhận `PaymentScope` (`{kind:'PLATFORM'}` hoặc `{kind:'TENANT', tenantId}`).

## Khi đặc tả mơ hồ

Chọn phương án an toàn/đơn giản nhất, ghi ADR ngắn vào `docs/DECISIONS.md`. Nếu ảnh hưởng tiền, bảo mật, hoặc
dữ liệu cá nhân — dừng lại và hỏi người dùng thay vì tự quyết.

# GEMINI.md — Gieo Chữ

Đặc tả đầy đủ: [docs/GIEOCHU_PROMPT_MVP_PHASE1.md](docs/GIEOCHU_PROMPT_MVP_PHASE1.md). File này là quy ước vận hành cốt lõi cho Gemini và toàn bộ team code agent trong dự án Gieo Chữ — đọc kỹ đặc tả và các quyết định kiến trúc trước khi triển khai bất kỳ module nào.

## Tiến độ dự án

Xem [docs/PLAN.md](docs/PLAN.md) để biết thứ tự module và trạng thái hiện tại. Sau mỗi module hoàn thành, cập nhật lại `docs/PLAN.md`.

---

## Tổ chức Đội ngũ Agent & Phân công (Quốc · Long · Hiếu · Phong)

Hiến chương đội ngũ: [obsidian-knowledge-base/06-AI-Agent-Guides/Team-Charter.md](obsidian-knowledge-base/06-AI-Agent-Guides/Team-Charter.md).  
**Phiên làm việc chính (root session) luôn đóng vai Quốc** — Kỹ sư trưởng / Kiến trúc sư phần mềm, điều phối toàn bộ luồng công việc, là cổng giao tiếp duy nhất giữa Chủ dự án (User) và các sub-agent.

| Thành viên | Vai trò | Hình thức triển khai | Quyền ghi (Write Scope) |
|---|---|---|---|
| **Quốc** | Kỹ sư trưởng, kiến trúc sư, điều phối, review (A01/A02/A06/A07) | Phiên chính (Root Session Orchestrator) | `GEMINI.md`, `CLAUDE.md`, `docs/DECISIONS.md` (ADR), `docs/PLAN.md`, dispatch brief, code review; chỉ trực tiếp sửa code khi là hotfix nhỏ/khẩn cấp |
| **Long** | Chuyên viên tài liệu & bảo tồn tri thức (A08) | Sub-agent `long` (`.agents/long.md`) | `obsidian-knowledge-base/**` (riêng `01-Architecture-Decisions/` chỉ ghi khi Quốc duyệt); `docs/*.md` gốc chỉ khi brief giao rõ |
| **Hiếu** | Kỹ sư lập trình Full-stack 10 năm kinh nghiệm (A03/A04 logic/A05) | Sub-agent `hieu` (`.agents/hieu.md`) | `apps/web/**`, `packages/**` (gồm Prisma schema/migrations tại `packages/db/prisma/`), bộ test — chỉ đụng lớp trình bày khi brief yêu cầu cụ thể |
| **Phong** | Chuyên viên UX/UI — design layout, component, design token, a11y (A04 UI) | Sub-agent `phong` (`.agents/phong.md`) | Lớp trình bày: `apps/web/app/**/_ui/**`, `globals.css`, `public/**`, JSX/className/layout trong `page.tsx`/`layout.tsx`; `packages/config/src/theme.ts` chỉ khi brief nêu rõ |

### Ma trận Phân vùng Tri thức (Knowledge Boundaries)

Mỗi agent chỉ truy cập vùng được phân công để bảo toàn context window và chống sai lệch thông tin. Khi cần thông tin ngoài vùng, sub-agent phải gửi phản hồi về cho Quốc để Quốc điều phối:

| Vùng tài liệu / Codebase | Quốc | Long | Hiếu | Phong |
|---|---|---|---|---|
| `GEMINI.md`, `CLAUDE.md`, `00-Index/` (MOC, KB-Audit) | Đọc / Ghi | Đọc / Ghi `00-Index`; Đọc quy ước root | — | — |
| `docs/DECISIONS.md` + `01-Architecture-Decisions/` | Ghi | Đọc; Ghi khi Quốc duyệt | Đọc (ràng buộc cứng) | Đọc ADR liên quan UI |
| `02-System-Specs/` | Đọc | Ghi | Đọc spec liên quan task | Đọc spec liên quan task |
| `03-API-Contracts/` | Đọc | Ghi | Đọc contract liên quan; đổi contract phải báo Quốc | — (nhận contract từ brief của Quốc) |
| `04-Operations-Runbooks/` | Đọc | Ghi | — (trừ task release / DR) | Đọc `UI-Design-System.md` |
| `05-Historical-Archive/` | — | Đọc khi cần tra cứu lịch sử | Không đọc | Không đọc |
| `06-AI-Agent-Guides/` (Charter, templates, skills) | Đọc Team-Charter | Ghi | — | — |
| Code logic: `route.ts`, Server Actions, `lib/**`, `packages/**`, schema | Đọc khi review | Đọc đối chiếu, cấm sửa | **Ghi** | Đọc, cấm sửa |
| Lớp trình bày: `_ui/**`, `globals.css`, JSX/layout trong page/layout | Đọc khi review | Đọc đối chiếu, cấm sửa | Ghi khi brief giao | **Ghi** |
| Skill UI/UX (`ui-ux-pro-max`) | — | — | — | Sử dụng, cấm sửa |

---

## Cơ chế Điều phối Sub-agent trong Gemini / Antigravity

Quốc điều phối các sub-agent thông qua cơ chế multi-agent native của Gemini/Antigravity (`invoke_subagent`, `define_subagent`, `send_message`).

### 1. Khởi tạo / Định nghĩa Sub-agent
Nếu sub-agent chưa được nạp sẵn, Quốc gọi `define_subagent` theo đúng đặc tả:
- `hieu`: Kỹ sư backend & domain logic. Tool: read, write, bash/command.
- `phong`: Chuyên viên UI/UX và presentation. Tool: read, write, bash/command.
- `long`: Chuyên viên tài liệu Obsidian KB. Tool: read, write, bash/command.

### 2. Mẫu Task Brief chuẩn (Zero Guessing & Strict Boundary)
Khi Quốc giao việc qua `invoke_subagent` hoặc `send_message`, brief **bắt buộc** tuân thủ cấu trúc:

```markdown
SUBAGENT: [hieu | phong | long]
TASK: [Mô tả chi tiết mục tiêu, bối cảnh, lý do nghiệp vụ]
READ_REQUIRED:
  - [Chỉ liệt kê các file/spec trong vùng tri thức của agent đó]
CONSTRAINTS:
  - [Ràng buộc kỹ thuật: L1/L2/L3 RLS, PaymentScope, token, responsive, zero guessing]
OUTPUT_EXPECTED: [File diff / Component mới / Schema migration / Cập nhật KB]
DO_NOT_TOUCH: [Danh sách thư mục/file cấm đụng chạm để tránh xung đột vùng ghi]
VERIFY_REQUIRED:
  - [Lệnh test, lint, typecheck, check responsive/a11y bắt buộc chạy và báo kết quả]
```

### 3. Quy trình Thực thi một Task (6 bước chuẩn)
1. **Làm rõ & Chốt phạm vi (Zero Guessing):** Quốc tiếp nhận yêu cầu từ chủ dự án, xác minh kỹ các điểm mơ hồ. Nếu liên quan tiền bạc, bảo mật hoặc quyết định dài hạn → ghi ADR vào `docs/DECISIONS.md` trước khi code.
2. **Giao Brief:** Quốc gửi brief cho Hiếu (logic/dữ liệu) và/hoặc Phong (layout/UI). Nếu task có cả UI lẫn Logic: Phong chốt layout & contract dữ liệu (props, data shape); Quốc chuyển contract đó cho Hiếu triển khai logic tương ứng.
3. **Thực thi & Verify độc lập:** Hiếu/Phong thực hiện trong vùng ghi của mình, chạy toàn bộ lệnh kiểm thử (lint, typecheck, unit/integration test, `test:count`, kiểm tra dev server với dữ liệu thật).
4. **Kiểm tra & Code Review (Quốc):** Quốc kiểm tra `git diff`/`git status`, rà soát ranh giới L1/L2/L3, RLS, bảo mật. File ngoài vùng ghi hoặc không đạt chuẩn verify sẽ bị trả lại cho agent thực hiện.
5. **Đồng bộ Tài liệu (Long):** Quốc gửi danh sách thay đổi cho Long để cập nhật specs, API contracts, schema reference, runbook trong `obsidian-knowledge-base/`.
6. **Hoàn tất:** Task chỉ đóng khi code đã verify và Long đã cập nhật tri thức. **Chỉ commit khi chủ dự án yêu cầu.**

---

## Bộ Lệnh Vận Hành (Monorepo pnpm Workspaces + Turborepo)

Chạy từ thư mục gốc của repository:

| Lệnh | Mô tả chi tiết |
|---|---|
| `pnpm install` | Cài đặt toàn bộ dependencies trong monorepo |
| `pnpm dev` | Khởi chạy `next dev` (yêu cầu `.env` đầy đủ, env fail-fast qua Zod) |
| `pnpm build` | Build tất cả package và ứng dụng web |
| `pnpm lint` | ESLint flat config với `--max-warnings=0` |
| `pnpm typecheck` | `tsc --noEmit` toàn bộ packages và apps |
| `pnpm test` | Chạy toàn bộ unit test (Jest) và integration test (Vitest) |
| `pnpm test:unit` | Chạy Jest unit test trong `packages/*` |
| `pnpm test:integration` | Chạy Vitest integration test trong `apps/web/tests/integration` |
| `pnpm test:count` | Đếm số lượng test case, đối chiếu trần mốc `scripts/count-tests.mjs` (trần hiện 94/53 theo ADR-026) |
| `pnpm db:migrate` | `prisma migrate deploy` (dùng `PRISMA_MIGRATE_URL`, role Neon owner có quyền DDL) |
| `pnpm db:seed` | ⚠️ **CẤM CHẠY TRÊN DB DÙNG CHUNG** (ghi đè trang chủ CMS, xem ADR-034) |
| `pnpm --filter @gieochu/db run setup-app-role` | Tạo/cập nhật role Postgres `gieochu_app` (chạy 1 lần cho môi trường Neon mới) |
| `docker compose -f docker/docker-compose.yml up` | Khởi động MinIO + Mailpit (+ `--profile local-db` nếu cần Postgres cục bộ) |

### Lưu ý Khởi tạo Môi trường (.env & Fail-fast)
- Copy `.env.example` → `.env`. Runtime cần đúng 8 biến hạ tầng + secret theo ADR-032 (cộng `CRON_SECRET` ≥ 32 ký tự nếu có).
- Thiếu bất kỳ biến bắt buộc nào trong `packages/config/src/env.ts` sẽ khiến ứng dụng dừng ngay lập tức (fail-fast) — đây là thiết kế có chủ đích.

---

## Cấu trúc Thư mục & Trách nhiệm Kiến trúc

Chi tiết sơ đồ xem tại [docs/GIEOCHU_PROMPT_MVP_PHASE1.md](docs/GIEOCHU_PROMPT_MVP_PHASE1.md) §4.4:

- **`apps/web`**: Next.js 16 App Router.
  - `proxy.ts` (không dùng `middleware.ts`): Chỉ gán `x-request-id` và redirect thô sơ. **Mọi route handler / server action / server component nhạy cảm bắt buộc tự gọi `requireUser()` / `requireRole()`** — tuyệt đối không tin tưởng proxy.
  - `apps/web/app/**/_ui/**`: UI kit và presentation layer do Phong phụ trách.
- **`packages/config`**: Env validation schema (Zod fail-fast), brand configuration (`brand.ts`), ESLint shareable preset, `theme.ts`.
- **`packages/core`**: Định nghĩa `AppError`, bảng mã lỗi hệ thống, logger (`pino` có redact dữ liệu nhạy cảm), pricing engine, order FSM.
- **`packages/db`**: Prisma schema, migrations, seed scripts.
  - CLI migration dùng `PRISMA_MIGRATE_URL` (role owner).
  - App runtime dùng `DATABASE_URL` (pooled connection, role `gieochu_app` qua `@prisma/adapter-neon`).
  - **RLS Helpers bắt buộc (`src/rls.ts`):** `withTenant`, `withCustomer`, `withPublic`, `withSystemJob`. Bắt buộc bọc mọi query tới bảng L2 (có `tenantId`). Cấm gọi `getPrismaClient()` trực tiếp cho bảng L2.
- **`packages/auth`, `packages/payments`, `packages/storage`, `packages/email`, `packages/jobs`**: Các domain packages chuyên biệt.
- **Cơ chế Background Jobs (ADR-036):** Vercel không hỗ trợ worker thường trực.
  - Các job tức thì (`payment.process`, `file.scan`) được drain sau response qua hàm `after()` (`apps/web/lib/job-runner.ts`).
  - Quét định kỳ (sweep đơn hàng/thuê bao, dọn job sót) xử lý qua Vercel Cron: `GET /api/cron/daily` kèm Bearer `CRON_SECRET`.
  - `worker.ts` **không được chạy trên DB dùng chung** vì sẽ xung đột pg-boss với cron.

---

## Quy ước Lập trình Bắt buộc (Coding Conventions)

1. **TypeScript nghiêm ngặt:** `strict: true` (kế thừa từ `tsconfig.base.json`), tuyệt đối không dùng `any` bừa bãi.
2. **Tiền tệ & Thời gian:** Tiền tệ VND lưu dưới dạng số nguyên (`Int` / `BigInt`), cấm dùng số thực `float`. Thời gian lưu chuẩn UTC trong DB, render hiển thị theo múi giờ `Asia/Ho_Chi_Minh`.
3. **Độ rộng Layout (ADR-024):**
   - Trang public: Dùng utility class `container-page` (1280px, căn giữa).
   - Trang nội dung đọc dài: Dùng `container-prose` (768px).
   - Form nhập liệu đơn lẻ: Dùng `container-narrow` (448px).
   - App shell `/admin`, `/studio`, `/account`: Fluid theo sidebar. Cấm tự đặt `max-w-[...]` tuỳ tiện cho khung trang.
4. **Định dạng URL Sản phẩm (ADR-030):** Luôn dựng qua helper `productPath(tenantSlug, productSlug)` → `/{tenantSlug}/{productSlug}`. Thêm route tĩnh mới dưới `app/[tenantSlug]/` bắt buộc khai báo vào `RESERVED_PRODUCT_SLUGS` (`packages/core/src/product/path.ts`).
5. **Cảnh báo Database Dùng Chung (ADR-034):**
   - Máy dev, Vercel Preview và Production dùng **chung một Database Neon duy nhất**.
   - Mọi thao tác ghi dữ liệu từ máy local chính là thao tác trên database thật.
   - **Cấm tự ý chạy `pnpm db:seed`**.
   - Cấm tự chạy migration DDL nếu chưa được Quốc duyệt. Migration áp dụng chiến lược *expand → contract* (chỉ thêm cột/bảng trước; `DROP`/`RENAME` chỉ thực hiện khi code cũ đã ngừng hoạt động hoàn toàn).
   - Integration test và test script phải tự động dọn dẹp dữ liệu tạm sau khi chạy, không gửi email tới địa chỉ có thật.
6. **Định danh ID:** Sử dụng **cuid2** (`@default(cuid(2))` trong Prisma schema) cho mọi `@id`. Tuyệt đối không dùng UUID (xem `docs/DECISIONS.md`).
7. **Không hard-code Brand & Settings:**
   - Không hard-code chuỗi thương hiệu ("Gieo Chữ", "Gieo", slogan) — luôn đọc qua `getEffectiveBrand()` (`apps/web/lib/branding.ts`, fallback `DEFAULT_BRAND` tại `@gieochu/config/brand`).
   - Cấu hình nghiệp vụ, TTL đọc qua `getSystemSettings()` (`apps/web/lib/system-settings.ts`, ADR-032), không qua biến môi trường.
8. **Cách ly Prisma Client:** Không `import` `@prisma/client` trực tiếp trong `apps/web` — chỉ qua helper của `@gieochu/db` (được bảo vệ bằng ESLint `no-restricted-imports`).
9. **Xử lý Lỗi & API Response:**
   - Lỗi nghiệp vụ ném `AppError` (`@gieochu/core`), cấm ném `Error` trần trong route handlers/actions.
   - Response lỗi API luôn theo format: `{ error: { code, message, requestId } }`.
10. **Bảo tồn Test Cases:** Test đặt tên tiếng Anh mô tả hành vi, nhóm `describe` theo module. **Không tự ý tăng/giảm số lượng test case so với baseline kiểm thử** nếu chưa có quyết định rõ từ chủ dự án.

---

## 9 Quy tắc Bảo mật Cốt lõi (Bắt buộc cho mọi module)

1. **Authentication Token:** Access và Refresh token chỉ lưu trong cookie `httpOnly`, `Secure` (prod), `SameSite=Lax`. Refresh cookie gắn `Path=/api/auth`. Tuyệt đối không lưu vào `localStorage`.
2. **Hash Bí danh Token:** Chỉ lưu **hash SHA-256** của refresh token, token kích hoạt, token reset mật khẩu, token link chia sẻ và token download.
3. **Mã hoá Cổng thanh toán:** Secret key cổng thanh toán (của nền tảng lẫn từng tenant) phải được mã hoá **AES-256-GCM** bằng `PAYMENT_ENCRYPTION_KEY` trước khi lưu vào DB. UI chỉ hiển thị dạng masked `••••abcd`, không bao giờ gửi raw secret về client.
4. **Xử lý Webhook an toàn:** Xác thực chữ ký/API key **trước** khi parse dữ liệu; so sánh chữ ký bằng `timingSafeEqual`; đảm bảo idempotency qua bảng `webhook_events`; phản hồi 2xx ngay lập tức và đẩy logic xử lý nặng vào job nền.
5. **Toàn vẹn Dữ liệu Thanh toán:** Không tin tưởng số tiền hoặc trạng thái đơn hàng gửi từ phía client — luôn tính toán lại toàn bộ đơn giá và tổng tiền ở phía server.
6. **Lưu trữ & Tải File:** Tất cả file lưu trữ trong S3/MinIO private bucket. Link tải file chỉ là presigned URL tạm thời, hiệu lực ≤ 10 phút, header `Content-Disposition: attachment`.
7. **Phòng chống CSRF:** Server Actions tận dụng CSRF protection tích hợp sẵn của Next.js; các Route Handler ghi dữ liệu (POST/PUT/DELETE) bắt buộc kiểm tra header `Origin`.
8. **Bảo vệ Header & CSP:** CSP nonce được sinh theo từng request trong `proxy.ts` (ADR-016). Cấu hình tĩnh `X-Content-Type-Options` và `Referrer-Policy` trong `next.config.ts`.
9. **Cách ly Dữ liệu Multi-Tenant (L1/L2/L3):** Tuyệt đối không tạo route nào cho phép System Admin xem chi tiết danh sách đơn hàng hoặc thông tin khách hàng nhạy cảm của tenant — System Admin chỉ xem `tenant_daily_stats` tổng hợp và dữ liệu tầng L1.

---

## Ranh giới Phân tầng (Layer Boundaries)

- **L1 System:** Quản trị nền tảng, hệ thống gói dịch vụ, cấu hình thương hiệu chung.
- **L2 Tenant:** Dữ liệu riêng biệt của từng tenant (khóa theo `tenantId`, bắt buộc đi qua RLS).
- **L3 Customer:** Dữ liệu người mua hàng cuối (lọc chặt chẽ theo `userId`).
- **Phân định Thanh toán:** Hệ thống thanh toán Platform (gói thuê bao tenant) và hệ thống thanh toán Tenant (khách mua tài liệu số) cùng dùng thư viện `packages/payments` nhưng **tuyệt đối không dùng chung bảng DB, webhook secret hay route**. Mọi hàm thanh toán phải nhận tham số phân biệt rõ ràng: `PaymentScope` (`{kind: 'PLATFORM'}` hoặc `{kind: 'TENANT', tenantId}`).

---

## Nguyên tắc Giải quyết Điểm Mơ hồ (Zero Guessing)

- Khi gặp đặc tả chưa rõ ràng: Chọn giải pháp an toàn, tối giản nhất và ghi ADR ngắn vào `docs/DECISIONS.md`.
- **Nếu liên quan đến: TIỀN BẠC, BẢO MẬT, HOẶC DỮ LIỆU CÁ NHÂN → Dừng lại ngay lập tức và hỏi Chủ dự án, không bao giờ tự đưa ra giả định.**

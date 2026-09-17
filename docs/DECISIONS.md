# DECISIONS — ADR ngắn

Định dạng: mỗi mục là một quyết định khi đặc tả mơ hồ (mục 0.6 của
[GIEOCHU_PROMPT_MVP_PHASE1.md](GIEOCHU_PROMPT_MVP_PHASE1.md)), gồm Bối cảnh / Quyết định / Lý do.

## ADR-001 — ID strategy: cuid2

- **Bối cảnh:** Mục 3 yêu cầu "Mọi ID dùng cuid2 hoặc UUID v7 (chọn một)".
- **Quyết định:** Dùng cuid2 qua thuộc tính gốc của Prisma `@id @default(cuid(2))` cho mọi model.
- **Lý do:** Không cần thêm thư viện ngoài, Prisma sinh ở tầng ứng dụng, ngắn hơn UUID, sắp xếp được theo thời
  gian tạo (tốt cho index), và đã được xác minh hỗ trợ native trong Prisma Schema Reference.

## ADR-002 — Generator Prisma: `prisma-client` (không dùng `prisma-client-js`)

- **Bối cảnh:** `prisma-client-js` (sinh vào `node_modules`) đã deprecated kể từ Prisma 7.
- **Quyết định:** Dùng generator `prisma-client` với `output = "../src/generated/prisma"`, import trực tiếp
  từ đường dẫn sinh ra thay vì package `@prisma/client`.
- **Lý do:** Theo khuyến nghị chính thức của Prisma cho dự án mới (đã xác minh qua tài liệu Prisma ORM v7).

## ADR-003 — Kết nối DB: `@prisma/adapter-neon`, `prisma.config.ts` dùng `DIRECT_URL`

- **Bối cảnh:** Mục 3 yêu cầu ORM Prisma + `@prisma/adapter-neon`, CLI dùng `DIRECT_URL`, runtime dùng
  `DATABASE_URL` pooled.
- **Quyết định:** `prisma.config.ts` trỏ `datasource.url` sang `env("DIRECT_URL")` (dùng cho migrate/seed);
  `schema.prisma` có `datasource db { url = env("DATABASE_URL") }`; `packages/db/src/client.ts` tạo
  `PrismaNeon({ connectionString: getEnv().DATABASE_URL })` rồi truyền vào `new PrismaClient({ adapter })`.
- **Lý do:** Khớp đúng hướng dẫn chính thức tại prisma.io/docs/orm/overview/databases/neon (đã xác minh qua
  WebFetch trước khi code).

## ADR-004 — Postgres local (docker-compose `profile: local-db`) là tuỳ chọn phụ, không phải đường chính

- **Bối cảnh:** Mục 8/M0 liệt kê `postgres:16` trong docker-compose với "profile local-db, dùng khi không
  muốn gọi Neon", nhưng đồng thời mục 3 chốt dùng `@prisma/adapter-neon` — driver này nói chuyện qua giao thức
  serverless/WebSocket của Neon (Neon serverless driver), không phải giao thức Postgres TCP thường mà một
  container `postgres:16` thuần cung cấp.
- **Quyết định:** Giữ service `postgres` trong `docker-compose.yml` đúng như đặc tả (cho các trường hợp cần
  Postgres thuần, ví dụ chạy `psql` kiểm tra thủ công), nhưng khuyến nghị mặc định cho dev/test là dùng một
  Neon branch miễn phí (đặt `DATABASE_URL`/`DIRECT_URL` trỏ tới đó). Nếu người dùng thực sự cần offline
  hoàn toàn với `adapter-neon` + Postgres local, cần chạy thêm Neon local proxy (`neon-proxy`) — ghi vào
  `docs/BACKLOG.md`, chưa triển khai ở M0.
- **Lý do:** Đây là quyết định ảnh hưởng tới hạ tầng DB, không ảnh hưởng tiền/bảo mật/dữ liệu cá nhân trực
  tiếp, nên chọn phương án đơn giản nhất theo mục 0.6 và ghi rõ đánh đổi thay vì tự ý đổi driver.

## ADR-005 — TypeScript pin ở 5.9.x, chưa dùng TypeScript 7 (tsgo)

- **Bối cảnh:** `npm view typescript version` trả về `7.0.2` là bản mới nhất tại thời điểm code, nhưng đây là
  bản port native (tsgo) còn rất mới.
- **Quyết định:** Pin `typescript@5.9.3` (bản 5.x ổn định mới nhất) cho toàn monorepo.
- **Lý do:** `ts-jest`, `typescript-eslint`, và nhiều tool khác trong stack (mục 3) chưa chắc tương thích đầy
  đủ với TypeScript 7 tại thời điểm này; ưu tiên ổn định toolchain hơn là bản mới nhất.

## ADR-006 — Logger đặt trong `packages/core`, không tạo package riêng

- **Bối cảnh:** Mục M0 yêu cầu "Logger `pino` có redact" nhưng không chỉ định package chứa nó.
- **Quyết định:** Đặt `logger.ts` trong `packages/core` cùng `errors.ts`.
- **Lý do:** `core` đã là nơi chứa tiện ích dùng chung không phụ thuộc DB (theo mô tả ở mục 4.4: "pricing,
  order FSM, slug, code"); tạo thêm package riêng chỉ cho logger là over-engineering ở giai đoạn này.

## ADR-007 — `pg-boss` kết nối qua `DIRECT_URL`, không qua pooler

- **Bối cảnh:** `pg-boss` (M11 khung, dùng từ M1 để gửi email kích hoạt/reset) cần một kết nối Postgres ổn
  định; kết nối pooled của Neon đi qua PgBouncer ở chế độ transaction, không đảm bảo hành vi cấp phiên mà
  `pg-boss` có thể cần (LISTEN/NOTIFY, prepared statement, v.v.).
- **Quyết định:** `packages/jobs` nhận connection string do caller truyền vào; `apps/web` luôn truyền
  `DIRECT_URL` (không phải `DATABASE_URL`) khi tạo job queue, cả trong route handler lẫn `worker.ts`.
- **Lý do:** An toàn, đơn giản nhất — tránh lỗi khó tái hiện do pooler transaction-mode; `DIRECT_URL` vốn đã có
  sẵn cho CLI/migrate (ADR-003) nên không cần thêm biến môi trường mới.

## ADR-008 — `UserProfile` được tạo một phần ngay khi đăng ký, hoàn thiện dần sau

- **Bối cảnh:** Mục "M1" liệt kê đăng ký thu thập "họ tên" cùng lúc với "đồng ý điều khoản", nhưng ERD §5.1
  đặt `consentAt` trong bảng `UserProfile` cùng với `phone`, `occupation`, `province` — những trường chỉ được
  thu thập sau, ở bước hoàn thiện hồ sơ bắt buộc. Hai đoạn đặc tả này mâu thuẫn nếu `UserProfile` yêu cầu đủ 4
  trường ngay từ đầu.
- **Quyết định:** `UserProfile.fullName` và `consentAt` bắt buộc, tạo ngay lúc đăng ký (transaction cùng
  `User`). `phone`, `occupation`, `province` để `String?` (nullable), null lúc đăng ký, được điền ở
  `/account/profile?complete=1`. `isProfileComplete()` (`packages/auth/src/profile.ts`) kiểm tra đủ cả 4
  trường non-blank — không đổi hành vi gate `/account/*`, `/studio/*`, checkout.
- **Lý do:** Giữ đúng nghĩa đen của đặc tả (đăng ký thu "họ tên" + "đồng ý điều khoản") mà không phá vỡ yêu
  cầu hồ sơ bắt buộc đủ 4 trường; đây là quyết định về cấu trúc dữ liệu, không ảnh hưởng tiền/bảo mật/dữ liệu
  cá nhân theo hướng bất lợi (dữ liệu cá nhân vẫn được thu thập, chỉ tách làm hai bước).

## ADR-010 — Role Postgres riêng cho app (`gieochu_app`), tách khỏi `neondb_owner`, để RLS có hiệu lực thật

- **Bối cảnh:** Khi viết integration test cho RLS ở M4 (`withTenant(A)` không được đọc `products` của B), test thất
  bại dù policy RLS đã bật đúng (`ENABLE`/`FORCE ROW LEVEL SECURITY`, policy đúng). Kiểm tra `pg_roles` phát hiện
  role mặc định Neon cấp (`neondb_owner`) có `rolbypassrls = true` — Postgres luôn bỏ qua RLS cho role có cờ này,
  bất kể `FORCE`. Đây là hành vi mặc định của role "owner" trên nhiều nền tảng Postgres quản lý, không phải lỗi
  cấu hình. `ALTER ROLE neondb_owner NOBYPASSRLS` bị Neon từ chối (không có quyền tự đổi thuộc tính của chính role
  owner).
- **Quyết định:** Tạo role `gieochu_app` riêng (`NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS`), chỉ cấp
  `SELECT/INSERT/UPDATE/DELETE` trên các bảng hiện có + `ALTER DEFAULT PRIVILEGES` để tự động cấp quyền đó cho
  bảng mới tạo sau này (không cần nhớ GRANT lại mỗi migration). Runtime app (`DATABASE_URL`, `DIRECT_URL`) dùng
  role này. Việc tạo role nằm trong script riêng `packages/db/scripts/setup-app-role.mts` (chạy 1 lần/môi
  trường qua `pnpm --filter @gieochu/db run setup-app-role`), **không** nằm trong Prisma migration, vì role là
  đối tượng cấp cluster/project chứ không phải cấp schema.
  Vì `gieochu_app` không có quyền DDL (`CREATE`/`ALTER TABLE`), `prisma migrate`/`generate` vẫn cần role owner —
  tách riêng biến môi trường mới **`PRISMA_MIGRATE_URL`** (owner, chỉ CLI dùng) khỏi **`DIRECT_URL`** (nay là
  `gieochu_app`, dùng cho pg-boss — vẫn đúng tinh thần ADR-007 là không qua pooler).
- **Lý do:** Đây là quyết định bảo mật trực tiếp (RLS chỉ có ý nghĩa nếu kết nối app không bypass nó) nên đã dừng
  lại hỏi người dùng trước khi thực hiện thay vì tự ý chọn phương án "chấp nhận RLS chỉ là lớp phòng thủ trên
  giấy". Người dùng chọn tạo role riêng.
- **Việc cần làm khi thêm module có bảng L2 mới:** không cần chạy lại `setup-app-role.mts` (nhờ
  `ALTER DEFAULT PRIVILEGES`), nhưng nếu tạo schema Postgres mới (khác `public`/`pgboss`) thì cần chạy lại script
  để cấp quyền cho schema đó.

## ADR-009 — Integration test (Vitest) dùng chung Neon DB với dev, không có `TEST_DATABASE_URL` riêng

- **Bối cảnh:** Mục 9 khuyến nghị "DB test riêng cho test, Neon branch hoặc Postgres container", nhưng tạo
  Neon branch mới cần thao tác qua Neon Console/API mà phiên làm việc này không có quyền tự động hoá.
- **Quyết định:** M1 integration test chạy trực tiếp trên `DATABASE_URL`/`DIRECT_URL` hiện có (cùng DB với
  seed/dev). Mỗi test tự sinh email duy nhất (tiền tố theo timestamp + random) và tự dọn dẹp user đã tạo ở
  `afterAll`. `fileParallelism: false` trong `vitest.config.ts` để tránh xung đột giữa các file test chạy
  song song.
- **Lý do:** Đơn giản nhất trong điều kiện hiện tại; không có rủi ro tiền/bảo mật (dữ liệu test là dữ liệu
  tổng hợp do chính test tạo ra và tự xoá). Khi có quyền tạo Neon branch, nên tách `TEST_DATABASE_URL` riêng —
  ghi vào `docs/BACKLOG.md`.
- **Cách gọi route handler:** Test import trực tiếp hàm `POST`/`GET` từ file `route.ts` và gọi với
  `NextRequest` dựng tay (theo mục 9: "gọi route handler trực tiếp hoặc qua fetch tới server test"), tránh
  phải chạy cả một Next server thật trong lúc test. Với trang Server Component có `redirect()`
  (`/account/library`), test gọi thẳng hàm guard trong `lib/page-guards.ts`, mock `next/headers` để cấp cookie
  giả, và bắt lỗi `NEXT_REDIRECT` mà `redirect()` ném ra thay vì render cả trang.

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

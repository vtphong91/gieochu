---
tags:
  - adr
  - database
  - prisma
  - infra
  - status/accepted
date: 2026-09-26
decider: vtphong91
status: Accepted (Chốt — Áp dụng chính thức)
---

# 🏛️ ADR-002: Kết Nối Database — `@prisma/adapter-neon` & Tách Biến Môi Trường Theo Vai Trò

## 1. Trạng Thái (Status)
**ĐÃ PHÊ DUYỆT (Accepted)** — Áp dụng cho toàn bộ `packages/db` và mọi nơi trong `apps/web` cần truy cập Postgres.

---

## 2. Bối Cảnh (Context)
Mục 3 của đặc tả gốc yêu cầu dùng ORM Prisma kết hợp `@prisma/adapter-neon`, với quy ước: CLI (migrate/seed) dùng `DIRECT_URL`, runtime ứng dụng dùng `DATABASE_URL` (kết nối pooled qua Neon PgBouncer).

Cần xác định rõ nơi mỗi biến môi trường được đọc, để tránh tình trạng CLI vô tình chạy qua kết nối pooled (có thể gây lỗi với các lệnh DDL/migration cần session ổn định) hoặc runtime vô tình dùng kết nối trực tiếp (không có connection pooling, dễ hết connection khi tải cao).

---

## 3. Quyết Định (Decision)
1. `prisma.config.ts` trỏ `datasource.url` sang `env("DIRECT_URL")` — dùng riêng cho `prisma migrate`/`prisma db seed` (CLI).
2. `schema.prisma` khai báo `datasource db { url = env("DATABASE_URL") }` — đây là URL pooled, dùng cho runtime.
3. `packages/db/src/client.ts` tạo `PrismaNeon({ connectionString: getEnv().DATABASE_URL })` rồi truyền adapter này vào `new PrismaClient({ adapter })` — client chạy qua driver adapter Neon serverless, không phải driver Postgres TCP thường.

Cách làm này khớp đúng hướng dẫn chính thức của Prisma cho tích hợp Neon (đã xác minh qua tài liệu `prisma.io/docs/orm/overview/databases/neon` trước khi code).

---

## 4. Hệ Quả & Ràng Buộc Kỹ Thuật (Consequences & Rules)
* **Không dùng chung một URL cho cả hai mục đích:** vi phạm sẽ khiến CLI migrate qua pooler (rủi ro với DDL) hoặc runtime app mở quá nhiều kết nối trực tiếp.
* **Driver Neon serverless nói chuyện qua giao thức WebSocket/HTTP riêng của Neon** — không phải giao thức Postgres TCP thuần. Vì vậy một Postgres container thường (`postgres:16` trong `docker-compose.yml`, dùng khi cần `psql` kiểm tra thủ công) **không** thể thay thế Neon nếu muốn giữ đúng `@prisma/adapter-neon` — muốn chạy hoàn toàn offline cần thêm Neon local proxy (`neon-proxy`), việc này chưa triển khai, đã ghi vào `docs/BACKLOG.md`.
* **Về sau tách thêm `PRISMA_MIGRATE_URL`:** khi bổ sung role Postgres riêng cho app (xem [[ADR-003-Postgres-App-Role-RLS]]), `DIRECT_URL` được tái sử dụng làm URL cho role app không có quyền DDL (dùng cho `pg-boss`), còn một biến mới `PRISMA_MIGRATE_URL` (role owner) đảm nhận vai trò CLI migrate/generate.

---

## 5. Tài Liệu Tham Chiếu & Liên Kết
* [[MOC-Home]] — Trang chủ Map of Content ([MOC-Home.md](../00-Index/MOC-Home.md))
* Tương ứng **ADR-003** trong [`docs/DECISIONS.md`](../../docs/DECISIONS.md) (gốc repo) — mục này cũng ghi lại các quyết định liên quan: ADR-004 (Postgres local chỉ là tuỳ chọn phụ, không phải đường chính) và ADR-007 (`pg-boss` kết nối qua `DIRECT_URL`, không qua pooler).
* [[ADR-003-Postgres-App-Role-RLS]] — Role Postgres riêng cho app, RLS có hiệu lực thật.

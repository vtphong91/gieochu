---
tags:
  - adr
  - database
  - security
  - rls
  - status/accepted
date: 2026-09-26
updated: 2026-09-29
decider: vtphong91
status: Accepted (Chốt — Áp dụng chính thức)
---

# 🏛️ ADR-003: Role Postgres Riêng Cho App (`gieochu_app`) — Để RLS Có Hiệu Lực Thật

## 1. Trạng Thái (Status)
**ĐÃ PHÊ DUYỆT (Accepted)** — Đây là **ràng buộc bảo mật nền tảng**: mọi kết nối runtime của app (`apps/web`, `pg-boss`) bắt buộc dùng role `gieochu_app`, không bao giờ dùng role owner Neon.

---

## 2. Bối Cảnh (Context)
Khi viết integration test cho RLS (kiểm tra `withTenant(A)` không đọc được `products` của tenant B), test **thất bại dù policy RLS đã bật đúng** (`ENABLE ROW LEVEL SECURITY`, `FORCE ROW LEVEL SECURITY`, policy đúng logic).

Kiểm tra `pg_roles` phát hiện nguyên nhân gốc: role mặc định Neon cấp cho project (`neondb_owner`) có cờ `rolbypassrls = true`. Postgres luôn **bỏ qua RLS hoàn toàn** cho role có cờ này, bất kể `FORCE ROW LEVEL SECURITY` — đây là hành vi mặc định của role "owner" trên nhiều nền tảng Postgres quản lý (managed), không phải lỗi cấu hình phía dự án. Thử `ALTER ROLE neondb_owner NOBYPASSRLS` bị Neon từ chối — project không có quyền tự đổi thuộc tính của chính role owner do Neon cấp.

Đây là quyết định ảnh hưởng bảo mật trực tiếp (RLS chỉ có ý nghĩa nếu kết nối app không bypass nó), nên đã dừng lại hỏi người dùng trước khi triển khai thay vì tự chọn phương án "chấp nhận RLS chỉ là lớp phòng thủ trên giấy".

---

## 3. Quyết Định (Decision)
1. Tạo role Postgres riêng **`gieochu_app`** với `NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS`, chỉ cấp `SELECT/INSERT/UPDATE/DELETE` trên các bảng hiện có, cộng `ALTER DEFAULT PRIVILEGES` để tự động cấp đúng quyền đó cho mọi bảng tạo mới sau này (không cần nhớ GRANT lại ở mỗi migration).
2. Runtime app (`DATABASE_URL`, `DIRECT_URL`) dùng role `gieochu_app`.
3. Việc tạo/cập nhật role nằm trong script riêng `packages/db/scripts/setup-app-role.mts` (chạy qua `pnpm --filter @gieochu/db run setup-app-role`, 1 lần/môi trường Neon mới) — **không** nằm trong Prisma migration, vì role là đối tượng cấp cluster/project, không phải cấp schema.
4. Vì `gieochu_app` không có quyền DDL (`CREATE`/`ALTER TABLE`), `prisma migrate`/`generate` vẫn cần role owner — tách riêng biến môi trường mới **`PRISMA_MIGRATE_URL`** (role owner, chỉ CLI dùng), khác với **`DIRECT_URL`** (nay là role `gieochu_app`, dùng cho `pg-boss`).

---

## 4. Hệ Quả & Ràng Buộc Kỹ Thuật (Consequences & Rules)
* **Không bao giờ** để runtime app (route handler, server action, job worker) kết nối bằng role owner Neon — RLS sẽ vô hiệu hoàn toàn và im lặng (không có lỗi nào báo, dữ liệu chỉ đơn giản là không bị lọc).
* **Khi thêm module có bảng L2 mới:** không cần chạy lại `setup-app-role.mts` (nhờ `ALTER DEFAULT PRIVILEGES` đã cấp sẵn quyền cho bảng mới). Nếu tạo một schema Postgres mới (khác `public`/`pgboss`), phải chạy lại script để cấp quyền cho schema đó.
* **`PRISMA_MIGRATE_URL` chỉ dùng cho CLI** — không bao giờ đưa vào code runtime của `apps/web` hay job worker.
  > **Ghi chú (2026-09-29, theo ADR-031 — [[01-Architecture-Decisions/ADR-017-Vercel-Deploy-Build-Without-Env|ADR-017 KB]]) ✅:**
  > phạm vi hẹp lại so với mục 3.4 ở trên. `prisma generate` **không** cần biến này (không kết nối DB); `db seed` chạy bằng
  > `DATABASE_URL` (role `gieochu_app`, qua `getPrismaClient()`). `PRISMA_MIGRATE_URL` chỉ còn dành cho `prisma migrate`/`studio`
  > và `setup-app-role.mts`, **chỉ đặt trên máy dev/CI** — đã bị xoá khỏi schema env runtime (`packages/config/src/env.ts`),
  > `prisma.config.ts` bỏ `datasource` khi thiếu biến. Không đặt trên Vercel; nếu từng đặt thì xoá và đổi mật khẩu role owner.
* Đây là điều kiện tiên quyết để các helper RLS `withTenant/withCustomer/withPublic/withSystemJob` (`packages/db/src/rls.ts`) có ý nghĩa thật — nếu kết nối bypass RLS, các helper này chỉ là lớp bọc vô dụng.

---

## 5. Tài Liệu Tham Chiếu & Liên Kết
* [[MOC-Home]] — Trang chủ Map of Content ([MOC-Home.md](../00-Index/MOC-Home.md))
* Tương ứng **ADR-010** trong [`docs/DECISIONS.md`](../../docs/DECISIONS.md) (gốc repo).
* [[ADR-002-Neon-Adapter-Db-Connection]] — Kết nối DB qua `@prisma/adapter-neon`, nguồn của biến `DIRECT_URL`/`DATABASE_URL` được tách vai trò ở đây.
* [[01-Architecture-Decisions/ADR-017-Vercel-Deploy-Build-Without-Env|ADR-017 (≙ ADR-031)]] ([ADR-017-Vercel-Deploy-Build-Without-Env.md](./ADR-017-Vercel-Deploy-Build-Without-Env.md)) — thu hẹp phạm vi `PRISMA_MIGRATE_URL`.
* [[ADR-006-Download-Token-Rls-Customer-Branch]] — một ví dụ cụ thể về lỗ hổng RLS được phát hiện và sửa nhờ kỷ luật test tích hợp chạy thật trên role `gieochu_app`.

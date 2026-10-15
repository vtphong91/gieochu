---
tags:
  - adr
  - deployment
  - database
  - security
  - status/accepted
date: 2026-09-29
decider: vtphong91
status: Accepted (Chốt — Áp dụng chính thức)
---

# 🏛️ ADR-017: Deploy Vercel — Build Không Cần DB/Env; `PRISMA_MIGRATE_URL` Không Bao Giờ Ở Runtime

## 1. Trạng Thái (Status)
**ĐÃ PHÊ DUYỆT (Accepted)** — tương ứng **ADR-031** trong [`docs/DECISIONS.md`](../../docs/DECISIONS.md) (chủ dự án duyệt
mục 3). **Đã xong code** (chưa commit tại 2026-09-29). **Chưa xác nhận deploy thành công trên Vercel ❓.** Sửa đổi phần
`PRISMA_MIGRATE_URL` của [[01-Architecture-Decisions/ADR-003-Postgres-App-Role-RLS|ADR-003 (≙ ADR-010)]]; bổ sung hệ quả cho
[[01-Architecture-Decisions/ADR-004-Csp-Nonce-Proxy|ADR-004 (≙ ADR-016)]]. Quy trình thao tác:
[[04-Operations-Runbooks/Deploy-Vercel-Runbook|Deploy-Vercel-Runbook]].

> **Cập nhật 2026-10-15:** danh sách biến env runtime được rút còn 8 biến và thương hiệu/cấu hình nghiệp vụ chuyển vào DB theo
> [[01-Architecture-Decisions/ADR-018-System-Settings-And-Brand-From-System-Center|ADR-018 (≙ ADR-032)]]; root layout nay đọc thêm
> `system_settings` mỗi request (TTL cho `SessionRefresh`) ✅. Theo `docs/DECISIONS.md` đã có bản chạy production trên Vercel
> trước sự cố 2026-10-15 🟡.

---

## 2. Bối Cảnh (Context)
Theo ADR-031 (2026-09-29), deploy Vercel lỗi vì 3 nguyên nhân 🟡 (Long không tự chạy deploy):
1. Vercel tự chạy `turbo run build` → `prisma generate` đòi `PRISMA_MIGRATE_URL` (khi đó `prisma.config.ts` dùng `env()` của
   `prisma/config`, ném lỗi nếu thiếu biến).
2. `next build` prerender các trang đọc DB/env → env fail-fast ngay lúc build.
3. `packages/config/src/env.ts` bắt buộc `PRISMA_MIGRATE_URL` (role owner Neon, quyền DDL, **bỏ qua RLS**) cả lúc chạy app →
   buộc phải đưa secret của role owner lên Vercel.

---

## 3. Quyết Định (Decision)
1. **`apps/web/vercel.json`:** `framework: "nextjs"`, `buildCommand: "next build"`. Vercel **Root Directory = `apps/web`**,
   không override Build Command trên dashboard. Prisma client sinh sẵn được **commit** (`packages/db/src/generated`), nên
   Vercel không cần chạy `prisma generate`.
2. **Root `app/layout.tsx` đặt `export const dynamic = "force-dynamic"`** — mọi trang render lúc request; `next build` không
   cần biến env nào. Lợi ích kèm: nonce CSP (ADR-016) gắn được cho cả `/login`, `/register`, `/pricing`…; branding không bị
   đóng băng từ lúc build. Đổi lại: các trang trước đây static tốn 1 truy vấn branding/request (ADR ghi "7 trang" 🟡).
3. **`PRISMA_MIGRATE_URL` bị xoá khỏi schema env runtime.** Chỉ CLI Prisma (`migrate`, `studio`) và `setup-app-role` đọc
   thẳng `process.env`, báo lỗi rõ khi thiếu. `prisma.config.ts` **bỏ hẳn `datasource`** khi thiếu biến (không dùng URL
   giả). `db seed` chạy bằng `DATABASE_URL` (role `gieochu_app`). **Không đặt biến này trên Vercel/runtime**; nếu từng đặt
   thì xoá và **đổi mật khẩu role owner**.
4. **Migration production chạy ngoài Vercel** (máy dev/CI) bằng `pnpm db:migrate`. **Worker pg-boss** (`apps/web/worker.ts`)
   cần nơi chạy lâu dài riêng — **chưa có** (BACKLOG).

---

## 4. Hệ Quả & Ràng Buộc Kỹ Thuật (Consequences & Rules)
* **Hiện trạng code (Long đọc 2026-09-29, working tree chưa commit) ✅:**
  - `apps/web/vercel.json` đúng 2 khoá `framework: "nextjs"`, `buildCommand: "next build"` (kèm `$schema`).
  - `apps/web/app/layout.tsx`: `export const dynamic = "force-dynamic"`, comment nêu lý do (root layout đọc `SystemBranding`
    cho mọi trang kể cả `/_not-found`; nonce CSP chỉ gắn được vào trang render động).
  - `packages/config/src/env.ts`: không còn khoá `PRISMA_MIGRATE_URL` (chỉ còn comment giải thích);
    `env.test.ts` bỏ biến này khỏi fixture — **không đổi số test case** (`pnpm test:count` 2026-09-29 = 93/94 unit, 52/53
    integration ✅).
  - `packages/db/prisma.config.ts`: đọc `process.env.PRISMA_MIGRATE_URL?.trim()`; thiếu → `console.warn` và **không** có
    khoá `datasource`; không còn import `env` từ `prisma/config`.
  - `packages/db/prisma/seed.ts` dùng `getPrismaClient()` → `getEnv().DATABASE_URL` — tức seed cần **đủ env runtime**
    (đọc `.env` gốc repo), không cần `PRISMA_MIGRATE_URL`.
  - `packages/db/scripts/setup-app-role.mts` vẫn `assertEnv("PRISMA_MIGRATE_URL")`.
  - `.env.example`: comment mới "CHỈ đặt trên máy dev/CI chạy migration — KHÔNG đặt trên Vercel/runtime".
* **Ràng buộc cho code sau:**
  - Không đưa `PRISMA_MIGRATE_URL` trở lại `env.ts` hay bất kỳ code runtime nào (`apps/web`, `worker.ts`).
  - Không gỡ `force-dynamic` ở root layout khi chưa xử lý lại bài toán build không env + nonce CSP.
  - Sửa `schema.prisma` ⇒ **phải chạy `pnpm --filter @gieochu/db run generate` và commit `packages/db/src/generated`** — Vercel
    dùng đúng bản đã commit; quên generate ⇒ client lệch schema (rủi ro, xem runbook §8).
* **Chưa verify ❓:** deploy thật thành công trên Vercel; `prisma db seed` chạy được khi `prisma.config.ts` không có
  `datasource`; CSP nonce trên các trang trước đây static ở bản deploy thật; chi phí truy vấn branding/request.

---

## 5. Tài Liệu Tham Chiếu & Liên Kết
* [[MOC-Home]] — Trang chủ Map of Content ([MOC-Home.md](../00-Index/MOC-Home.md))
* Tương ứng **ADR-031** trong [`docs/DECISIONS.md`](../../docs/DECISIONS.md) (gốc repo).
* [[04-Operations-Runbooks/Deploy-Vercel-Runbook|Deploy-Vercel-Runbook]] ([Deploy-Vercel-Runbook.md](../04-Operations-Runbooks/Deploy-Vercel-Runbook.md))
* [[01-Architecture-Decisions/ADR-003-Postgres-App-Role-RLS|ADR-003 (≙ ADR-010)]] ([ADR-003-Postgres-App-Role-RLS.md](./ADR-003-Postgres-App-Role-RLS.md))
* [[01-Architecture-Decisions/ADR-004-Csp-Nonce-Proxy|ADR-004 (≙ ADR-016)]] ([ADR-004-Csp-Nonce-Proxy.md](./ADR-004-Csp-Nonce-Proxy.md))

*Quay lại: [[MOC-Home]] (../00-Index/MOC-Home.md)*

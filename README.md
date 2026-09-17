# Gieo Chữ

Nền tảng SaaS "Document Social" cho giáo viên, coach, chuyên gia giáo dục — bán tài liệu số, nhận thanh toán
trực tiếp vào tài khoản của mình, chia sẻ bài viết và quản lý khách hàng riêng.

Đặc tả đầy đủ: [docs/GIEOCHU_PROMPT_MVP_PHASE1.md](docs/GIEOCHU_PROMPT_MVP_PHASE1.md). Quy ước code, lệnh
chạy, bảo mật: [CLAUDE.md](CLAUDE.md). Tiến độ module: [docs/PLAN.md](docs/PLAN.md).

## Bắt đầu

```bash
pnpm install
cp .env.example .env   # điền DATABASE_URL/DIRECT_URL (Neon), S3, JWT secret, v.v. — xem CLAUDE.md
docker compose -f docker/docker-compose.yml up -d   # minio + mailpit (thêm --profile local-db nếu cần Postgres local)
pnpm db:migrate
pnpm db:seed
pnpm dev
```

`pnpm dev` sẽ dừng ngay và in lỗi rõ ràng nếu thiếu biến môi trường bắt buộc (fail-fast qua zod).

## Lệnh thường dùng

```bash
pnpm lint            # ESLint (flat config), --max-warnings=0
pnpm typecheck       # tsc --noEmit toàn monorepo
pnpm test            # Jest (unit) + Vitest (integration)
pnpm test:count      # đối chiếu số test case với mục 9 của đặc tả (91 unit / 50 integration)
```

## Tech stack

Next.js 16 (App Router, `proxy.ts`) · TypeScript strict · PostgreSQL 16 trên Neon · Prisma 7
(`@prisma/adapter-neon`) · `jose` + `argon2` · Tailwind CSS + shadcn/ui · S3-compatible storage (R2/MinIO) ·
`pg-boss` · `pino` · pnpm workspaces + Turborepo.

Chi tiết đầy đủ và ràng buộc: xem mục 3 của đặc tả.

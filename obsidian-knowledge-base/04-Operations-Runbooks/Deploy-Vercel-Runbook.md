---
tags:
  - runbook
  - deployment
  - database
  - security
  - jobs
  - status/living
date: 2026-09-29
author: Long
---

# 🚀 Cẩm Nang: Deploy Gieo Chữ Lên Vercel (Deploy Vercel Runbook)

> Quyết định gốc: **ADR-031** trong [`docs/DECISIONS.md`](../../docs/DECISIONS.md) — bản trích
> [[01-Architecture-Decisions/ADR-017-Vercel-Deploy-Build-Without-Env|ADR-017 (≙ ADR-031)]]. Checklist chung trước phát hành,
> CI và rollback: [[04-Operations-Runbooks/Publish-And-Rollback-Runbook|Publish-And-Rollback-Runbook]]. Dựng lại DB từ đầu:
> [[04-Operations-Runbooks/Disaster-Recovery-Runbook|Disaster-Recovery-Runbook]].
>
> Mức xác minh: ✅ Long đã đối chiếu code (working tree 2026-09-29, **chưa commit**) · 🟡 theo báo cáo/brief của Quốc hoặc
> hành vi nền tảng bên ngoài chưa tự kiểm · ❓ cần môi trường thật.
>
> **Trạng thái: ❓ chưa có xác nhận deploy thành công trên Vercel.** Runbook này ghi cấu hình đã chốt theo ADR-031 và các lỗi
> đã gặp khi thử deploy; cập nhật lại sau lần deploy thành công đầu tiên.

---

## 1. Kiến trúc triển khai (tóm tắt)

| Thành phần | Chạy ở đâu | Ghi chú |
| :-- | :-- | :-- |
| App Next.js 16 (`apps/web`) | **Vercel** | Root layout `force-dynamic` → mọi trang render lúc request ✅ |
| Postgres | **Neon** | Runtime dùng role `gieochu_app` (ADR-010) ✅ |
| Migration (`prisma migrate deploy`) | **Máy dev / CI**, không phải Vercel | Cần `PRISMA_MIGRATE_URL` (role owner) — chỉ ở máy chạy lệnh ✅ |
| Worker pg-boss (`apps/web/worker.ts`) | **Chưa có** — cần host chạy lâu dài riêng | Xem §6 ✅ (code) / ❓ (host) |
| Object storage (R2), Cloudinary, SMTP, cổng thanh toán | Dịch vụ ngoài, **cấu hình trong Admin** (lưu DB mã hoá) | Không phải biến env (ADR-017 gốc, ADR-028) ✅ |

---

## 2. Cấu hình project trên Vercel

| Mục | Giá trị | Mức |
| :-- | :-- | :-: |
| **Root Directory** | `apps/web` | 🟡 (theo ADR-031; thiếu → lỗi §7.1) |
| **Include files outside the root directory in the Build Step** | **Bật** — app import `packages/*` của monorepo | 🟡 |
| **Framework Preset** | Next.js — đã khai trong `apps/web/vercel.json` (`"framework": "nextjs"`) | ✅ |
| **Build Command** | **Không override** trên dashboard — `vercel.json` đặt `"buildCommand": "next build"` | ✅ file / 🟡 hành vi Vercel |
| **Install Command** | **Không override** — Vercel tự dùng pnpm theo `packageManager` + lockfile ở gốc repo | 🟡 |
| **Node.js** | ≥ 20.9 (`engines.node` ở `package.json` gốc: `>=20.9`) — chọn 20.x hoặc 22.x | ✅ |
| **pnpm** | `packageManager: "pnpm@10.15.1"` (`package.json` gốc) | ✅ |

`apps/web/vercel.json` hiện tại ✅:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "nextjs",
  "buildCommand": "next build"
}
```

**Vì sao không dùng `turbo run build`:** script `build` của `@gieochu/db` là `prisma generate && tsc …` ✅ — Vercel không cần
chạy lại vì Prisma client sinh sẵn đã được **commit** ở `packages/db/src/generated/prisma` (`git ls-files` có file) ✅. Hệ quả:
xem rủi ro §8.

**Build không cần env:** ADR-031 chốt `next build` không cần biến env nào nhờ root layout `force-dynamic` 🟡 (chưa có bản build
Vercel thành công để xác nhận). Env vẫn **fail-fast ở runtime** (`getEnv()` parse bằng zod lần gọi đầu) ✅ — thiếu biến bắt buộc
thì request đầu tiên lỗi, không phải lúc build.

---

## 3. Biến môi trường runtime (Vercel → Settings → Environment Variables)

Nguồn: `packages/config/src/env.ts` ✅, `.env.example` ✅. Đặt cho môi trường **Production** (và Preview nếu dùng — Preview nên
trỏ DB/branch Neon riêng, ❓ chưa chốt).

### 3.1. Bắt buộc (không có mặc định — thiếu là app dừng)

| Biến | Lưu ý |
| :-- | :-- |
| `APP_URL` | **Phải có `https://`**, **không có `/` cuối** — vd `https://gieochu.net`. Zod `z.string().url()` từ chối giá trị không có scheme ✅ (lỗi §7.3). Code ghép chuỗi dạng `` `${env.APP_URL}/account/library` `` (`lib/order.ts`, `lib/admin-users.ts`…) ✅ → có `/` cuối sẽ ra `//` trong link email |
| `APP_NAME`, `APP_SHORT_NAME`, `APP_SLOGAN` | Chuỗi thương hiệu (không hard-code ở chỗ khác) |
| `DATABASE_URL` | Neon **pooled** (`-pooler`), **role `gieochu_app`** — không bao giờ role owner (ADR-010) |
| `DIRECT_URL` | Neon **không pooler**, **role `gieochu_app`** — pg-boss dùng (`createJobQueue(env.DIRECT_URL)` ở `lib/jobs.ts`, `worker.ts`) ✅ |
| `JWT_ACCESS_SECRET` | ≥ 32 ký tự; khác dev |
| `JWT_ISSUER`, `JWT_AUDIENCE` | vd `gieochu`, `gieochu-web` |
| `PAYMENT_ENCRYPTION_KEY` | 32 bytes base64 — mã hoá secret cổng thanh toán |
| `STORAGE_ENCRYPTION_KEY` | 32 bytes base64, **khác** `PAYMENT_ENCRYPTION_KEY` (ADR-017 gốc) |
| `EMAIL_FROM` | vd `Gieo Chữ <no-reply@gieochu.net>` |

> ⚠️ Hai khoá mã hoá phải **giữ nguyên** giữa các lần deploy và giữa Vercel với host worker — đổi khoá thì cấu hình đã lưu
> trong Admin không giải mã được nữa (suy ra từ cơ chế mã hoá DB ✅; chưa có quy trình xoay khoá).

### 3.2. Theo `EMAIL_PROVIDER`

`EMAIL_PROVIDER` mặc định `smtp`. Zod **không** bắt buộc các biến dưới — lỗi chỉ xảy ra **lúc gửi** (`packages/email/src/sender.ts`)
✅. Và env chỉ là **đường dự phòng**: `getConfiguredEmailSender()` (`lib/email-dispatch.ts`) ưu tiên cấu hình SMTP ở
`/admin/settings/smtp` nếu đang bật + đã xác minh ✅.

| `EMAIL_PROVIDER` | Cần | Lưu ý |
| :-- | :-- | :-- |
| `smtp` | `SMTP_HOST`, `SMTP_PORT` | **Đừng chép** `SMTP_HOST=localhost`/`1025` (Mailpit dev) từ `.env.example` lên production |
| `resend` | `RESEND_API_KEY` | |

### 3.3. Có mặc định (chỉ đặt khi muốn khác)

`NODE_ENV` (mặc định schema `development`; cookie `Secure` chỉ bật khi `NODE_ENV=production` — `lib/cookies.ts` ✅; Vercel tự
đặt `production` cho Production 🟡 — **kiểm lại sau deploy** ❓), `TZ_DISPLAY` (`Asia/Ho_Chi_Minh`), `ACCESS_TOKEN_TTL` (`15m`),
`REFRESH_TOKEN_TTL_DAYS` (7), `EMAIL_VERIFY_TTL_HOURS` (24), `PASSWORD_RESET_TTL_MINUTES` (30), `PRESIGN_UPLOAD_TTL_SECONDS`
(600), `PRESIGN_DOWNLOAD_TTL_SECONDS` (600, tối đa 600), `TRIAL_DAYS` (14), `GRACE_DAYS` (7), `ORDER_PENDING_TTL_MINUTES` (60),
`INVOICE_PENDING_TTL_HOURS` (24), `DEFAULT_DOWNLOAD_LIMIT` (5) ✅.

Tuỳ chọn: `CLAMAV_HOST` (chưa có client ClamAV thật — ADR-018), `MOMO_SANDBOX_ENDPOINT` (chỉ dev/test theo `.env.example`) ✅.

### 3.4. KHÔNG đặt trên Vercel

| Biến | Lý do |
| :-- | :-- |
| `PRISMA_MIGRATE_URL` | Role owner Neon (DDL, **BYPASSRLS**). Đã xoá khỏi schema env runtime (ADR-031) ✅ — app không đọc. **Nếu từng đặt: xoá và đổi mật khẩu role owner.** |
| `TEST_DATABASE_URL` | Chỉ cho test |
| `ALLOW_DEMO_SEED`, `DEMO_SEED_BLOCKED_DB_HOSTS` | Công cụ dữ liệu demo **chỉ dev** ([[04-Operations-Runbooks/Dev-Demo-Data-Runbook|Dev-Demo-Data-Runbook]]) |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` | Chỉ `prisma/seed.ts` đọc, trên máy chạy seed — app không dùng ✅ |
| Endpoint/bucket/access key R2 (`S3_*`) | Không còn là env — cấu hình ở `/admin/settings/storage` (ADR-017 gốc) ✅ |

---

## 4. Chuẩn bị DB production (một lần, từ máy dev)

Chạy từ gốc repo trên máy dev. Các script đọc `.env` gốc repo (`dotenv`) ✅; cách an toàn là dùng một bản `.env` riêng trỏ DB
production cho phiên này rồi trả lại `.env` dev sau khi xong (tránh chạy nhầm lệnh dev vào prod).

1. **Tạo role `gieochu_app`** (chỉ Neon project/branch mới) — cần `PRISMA_MIGRATE_URL` (role owner) ✅:
   ```bash
   pnpm --filter @gieochu/db run setup-app-role
   ```
   Script in ra `DATABASE_URL`/`DIRECT_URL` cho role `gieochu_app` (pooled = chèn `-pooler` vào host) ✅ → dùng làm giá trị
   env trên Vercel (§3.1).
2. **Chạy migration** — cần `PRISMA_MIGRATE_URL` ✅:
   ```bash
   pnpm db:migrate    # prisma migrate deploy
   ```
   Thiếu biến → `prisma.config.ts` cảnh báo và bỏ `datasource`, lệnh migrate báo thiếu `datasource.url` ✅ (code) / ❓ (câu
   chữ lỗi thật của Prisma).
3. **Seed** — dùng `DATABASE_URL` (role `gieochu_app`) qua `getPrismaClient()` → `getEnv()`, nên `.env` phải **đủ biến runtime**
   ✅; đặt `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` để tạo super admin đầu tiên (bỏ trống thì bỏ qua) ✅:
   ```bash
   pnpm db:seed
   ```
   ❓ Chưa kiểm `prisma db seed` chạy được khi `prisma.config.ts` không có `datasource` (tức không đặt `PRISMA_MIGRATE_URL`).
4. **Quét slug sản phẩm trùng từ dành riêng** (ADR-030) — bắt buộc trước khi mở prod nếu DB đã có dữ liệu sản phẩm. Chạy bằng
   role owner (Neon SQL Editor) vì role `gieochu_app` bị RLS lọc; danh sách phải khớp `RESERVED_PRODUCT_SLUGS`
   (`packages/core/src/product/path.ts`, 23 mục) ✅:
   ```sql
   SELECT t.slug AS tenant_slug, p.slug AS product_slug, p.status
   FROM products p JOIN tenants t ON t.id = p."tenantId"
   WHERE lower(p.slug) IN ('products','posts','checkout','danh-gia','bai-viet','api','studio','account','login','admin',
     'p','s','feed','tag','category','search','cart','orders','reviews','about','contact','new','edit');
   ```
   Tên bảng/cột theo `@@map`/field trong `schema.prisma` ✅; câu lệnh **chưa chạy thật** ❓. Có kết quả → báo Quốc (slug không
   đổi được sau khi tạo — cách xử lý chưa chốt).

Mỗi lần có migration mới: chạy lại bước 2 **trước** khi deploy code dùng schema mới.

---

## 5. Sau khi deploy

### 5.1. Nhập cấu hình trong Admin (đăng nhập super admin vừa seed)

| Trang | Việc | Thiếu thì sao |
| :-- | :-- | :-- |
| `/admin/settings/storage` | Nhập R2 (endpoint, bucket, access key) + kiểm tra kết nối | Upload/tải file không chạy |
| `/admin/settings/cloudinary` | Nhập Cloudinary hệ thống + "Kiểm tra kết nối" | Chữ ký ảnh trả `CLOUDINARY_NOT_CONFIGURED` ✅ |
| `/admin/settings/smtp` | Nhập SMTP, bật + xác minh | Rơi về env (§3.2) |
| `/admin/billing/payment` | Cấu hình cổng thanh toán **platform** (SePay/MoMo/QR thủ công) | Tenant không trả phí gói được |
| `/admin/settings/branding` | Logo/branding hệ thống (tuỳ chọn) | Dùng mặc định |

Các trang trên tồn tại trong `apps/web/app/admin/**` ✅. Cổng thanh toán **tenant** do từng tenant tự cấu hình ở `/studio/{tenantSlug}/settings/payments` ✅.

### 5.2. Kiểm tra nhanh ❓ (chưa làm trên Vercel)

1. **CSP + hydrate:** mở `/login`, DevTools → không có lỗi CSP "inline script"; response có header `Content-Security-Policy`
   với `nonce-…`; form đăng nhập **không** đẩy mật khẩu lên URL (dấu hiệu hydrate hỏng — ADR-016).
2. **Đăng nhập/đăng xuất:** cookie `httpOnly`, `Secure`, `SameSite=Lax`; refresh cookie `Path=/api/auth`.
3. **Trang chính:** `/`, `/pricing`, `/register`, storefront `/{tenantSlug}`, trang tài liệu `/{tenantSlug}/{productSlug}`, URL cũ
   `/{tenantSlug}/products/{productSlug}` → **301**, `/admin`, `/studio/{tenantSlug}`, `/account/library`.
4. **Email:** gửi thử từ `/admin/settings/smtp`; kiểm link trong email dùng đúng `APP_URL` (không `//`).
5. **Upload:** tải một file thử trong Studio — nếu không có worker, file sẽ đứng ở "Đang quét" (§6).

---

## 6. Worker pg-boss — KHÔNG chạy trên Vercel

`apps/web/worker.ts` là tiến trình chạy lâu dài (`pnpm --filter @gieochu/web run worker` → `tsx worker.ts`), kết nối
`DIRECT_URL`, đăng ký 4 hàng đợi ✅:

| Hàng đợi | Lịch | Thiếu worker thì |
| :-- | :-- | :-- |
| `FILE_SCAN` | theo job (khi upload xong) | File sản phẩm kẹt trạng thái `PENDING` — Studio hiện nhãn **"Đang quét"** (`delivery-sources.tsx`) ✅ |
| `PAYMENT_PROCESS` | theo job (webhook thanh toán **tenant** enqueue ở `api/webhooks/tenants/[tenantId]/[provider]/route.ts`) | Webhook vẫn nhận/trả 2xx nhưng sự kiện **không được xử lý** → đơn không chuyển trạng thái ✅ (code) |
| `ORDER_SWEEP` | `*/5 * * * *` | Đơn `PENDING` quá `ORDER_PENDING_TTL_MINUTES` **không hết hạn** ✅ |
| `SUBSCRIPTION_SWEEP` | `0 * * * *` | Việc quét subscription theo giờ (`runSubscriptionSweep`) không chạy ✅ |

**Email không phụ thuộc worker:** comment đầu `worker.ts` ghi email đã chuyển sang gửi **đồng bộ** qua `sendEmailNow()`
(`lib/email-dispatch.ts`) ✅ — thiếu worker **không** làm mất email (khác với mô tả trong brief, xem KB-Audit §11).

**Host cho worker:** chưa chọn — ứng viên Railway / Fly.io / VPS 🟡 (theo brief, chưa quyết). Yêu cầu tối thiểu suy từ code ✅:
Node ≥ 20.9, cài cả monorepo (`pnpm install`), **cùng bộ env runtime §3.1** (worker gọi `getEnv()` và đọc `.env` gốc repo),
không `PRISMA_MIGRATE_URL`. Theo dõi: `docs/BACKLOG.md` mục "Phát sinh trong đợt ADR-031".

**Lưu ý phía gửi job trên Vercel ❓:** `apps/web/lib/jobs.ts` khởi động pg-boss lười trong chính tiến trình app để `send()` job;
comment ghi giả định "một tiến trình Node sống lâu, **không** phải serverless cold-start-per-request". Trên Vercel (serverless)
giả định này không còn đúng — chưa kiểm hành vi thật (độ trễ, số kết nối `DIRECT_URL`). Đã nêu câu hỏi cho Quốc.

---

## 7. Sự cố đã gặp khi deploy và cách sửa

Các lỗi dưới theo báo cáo đợt ADR-031 🟡; phần "cách sửa" đã có trong code ✅ trừ khi ghi khác.

| # | Triệu chứng | Nguyên nhân | Cách sửa |
| :-: | :-- | :-- | :-- |
| 7.1 | Vercel báo **"No Next.js version detected"** | Root Directory để gốc repo — `package.json` gốc không có `next` | Đặt **Root Directory = `apps/web`** (§2) 🟡 |
| 7.2 | Build chạy **`turbo run build`** rồi lỗi `prisma generate` đòi **`PRISMA_MIGRATE_URL`** | Vercel tự nhận Turborepo; `prisma.config.ts` cũ dùng `env("PRISMA_MIGRATE_URL")` (ném lỗi khi thiếu) | `apps/web/vercel.json` `buildCommand: "next build"` ✅; `prisma.config.ts` bỏ `datasource` khi thiếu biến ✅; client sinh sẵn đã commit ✅ |
| 7.3 | Runtime/build lỗi **`APP_URL: Invalid URL`** | Giá trị `APP_URL` thiếu scheme (vd `gieochu.net`) | Đặt `https://gieochu.net` — có `https://`, không `/` cuối (§3.1) |
| 7.4 | `next build` lỗi khi **prerender `/_not-found`** (đọc DB) | Root layout đọc `SystemBranding` từ DB cho mọi trang, kể cả `/_not-found`, nên prerender cần DB/env | Root `app/layout.tsx` `export const dynamic = "force-dynamic"` ✅ |

---

## 8. Rủi ro còn lại

* **Prisma client đã commit lệch schema:** Vercel dùng nguyên `packages/db/src/generated` trong git, không generate lại. Sửa
  `schema.prisma` mà quên `pnpm --filter @gieochu/db run generate` + commit thư mục `generated` ⇒ app trên Vercel chạy với
  client cũ (thiếu model/cột mới → lỗi runtime). Local có thể không lộ vì `typecheck` của `@gieochu/db` chạy
  `prisma generate` trước ✅. Phương án giảm rủi ro đang cân nhắc: build command
  `pnpm --filter @gieochu/db run generate && next build` (BACKLOG, chưa quyết).
* **Chi phí render động:** mọi trang render theo request + 1 truy vấn branding/request (ADR-031) 🟡 — chưa đo ❓.
* **Worker chưa có host** (§6) — file kẹt "Đang quét", đơn không hết hạn, webhook tenant không được xử lý.
* **pg-boss gửi job từ serverless** (§6) ❓.

---

## 9. Liên kết

* [[01-Architecture-Decisions/ADR-017-Vercel-Deploy-Build-Without-Env|ADR-017 (≙ ADR-031)]] ([ADR-017-Vercel-Deploy-Build-Without-Env.md](../01-Architecture-Decisions/ADR-017-Vercel-Deploy-Build-Without-Env.md))
* [[01-Architecture-Decisions/ADR-003-Postgres-App-Role-RLS|ADR-003 (≙ ADR-010)]] ([ADR-003-Postgres-App-Role-RLS.md](../01-Architecture-Decisions/ADR-003-Postgres-App-Role-RLS.md))
* [[01-Architecture-Decisions/ADR-004-Csp-Nonce-Proxy|ADR-004 (≙ ADR-016)]] ([ADR-004-Csp-Nonce-Proxy.md](../01-Architecture-Decisions/ADR-004-Csp-Nonce-Proxy.md))
* [[01-Architecture-Decisions/ADR-016-Short-Product-Url-No-Sticky-Publish-Card|ADR-016 (≙ ADR-030)]] ([ADR-016-Short-Product-Url-No-Sticky-Publish-Card.md](../01-Architecture-Decisions/ADR-016-Short-Product-Url-No-Sticky-Publish-Card.md)) — slug dành riêng
* [[04-Operations-Runbooks/Publish-And-Rollback-Runbook|Publish-And-Rollback-Runbook]] ([Publish-And-Rollback-Runbook.md](./Publish-And-Rollback-Runbook.md))
* [[04-Operations-Runbooks/Disaster-Recovery-Runbook|Disaster-Recovery-Runbook]] ([Disaster-Recovery-Runbook.md](./Disaster-Recovery-Runbook.md))

*Quay lại: [[MOC-Home]] (../00-Index/MOC-Home.md)*

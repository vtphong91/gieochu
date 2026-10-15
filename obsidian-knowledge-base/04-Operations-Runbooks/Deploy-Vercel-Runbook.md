---
tags:
  - runbook
  - deployment
  - database
  - security
  - jobs
  - status/living
date: 2026-09-29
updated: 2026-10-15
author: Long
---

# 🚀 Cẩm Nang: Deploy Gieo Chữ Lên Vercel (Deploy Vercel Runbook)

> Quyết định gốc: **ADR-031** trong [`docs/DECISIONS.md`](../../docs/DECISIONS.md) — bản trích
> [[01-Architecture-Decisions/ADR-017-Vercel-Deploy-Build-Without-Env|ADR-017 (≙ ADR-031)]]; env runtime rút còn 8 biến theo
> **ADR-032** — [[01-Architecture-Decisions/ADR-018-System-Settings-And-Brand-From-System-Center|ADR-018 (≙ ADR-032)]]; một DB duy
> nhất cho dev/Preview/production theo **ADR-034** —
> [[01-Architecture-Decisions/ADR-020-Single-Database-Dev-Preview-Production|ADR-020 (≙ ADR-034)]]; quy trình migration sau
> **sự cố 2026-10-15** ở §9. Checklist chung trước phát hành,
> CI và rollback: [[04-Operations-Runbooks/Publish-And-Rollback-Runbook|Publish-And-Rollback-Runbook]]. Dựng lại DB từ đầu:
> [[04-Operations-Runbooks/Disaster-Recovery-Runbook|Disaster-Recovery-Runbook]].
>
> Mức xác minh: ✅ Long đã đối chiếu code (working tree 2026-09-29 và 2026-10-15, **chưa commit**) · 🟡 theo báo cáo/brief của
> Quốc hoặc hành vi nền tảng bên ngoài chưa tự kiểm · ❓ cần môi trường thật.
>
> **Trạng thái (2026-10-15):** theo `docs/DECISIONS.md` (sự cố 2026-10-15) đã có **một bản đang chạy production trên Vercel** —
> bản trước ADR-032, còn đọc cột `system_settings.platformName` 🟡. Bản ADR-032/033 (8 biến env) **chưa deploy** ❓. Máy dev,
> Preview và Production dùng **một DB duy nhất** (ADR-034, quyết định lâu dài) — xem §9.

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

Nguồn: `packages/config/src/env.ts` ✅ (ADR-032), `.env.example` ✅. Đặt cho môi trường **Production** và **Preview** — cả hai trỏ
**cùng** DB (ADR-034); Preview chỉ dùng để xem giao diện (§9.1).

### 3.1. Bắt buộc — đúng 8 biến (thiếu là request đầu tiên lỗi)

| Biến | Lưu ý |
| :-- | :-- |
| `APP_URL` | **Phải có `https://`**, **không có `/` cuối** — vd `https://gieochu.net`. Zod `z.string().url()` từ chối giá trị không có scheme ✅ (lỗi §7.3). Code ghép chuỗi dạng `` `${env.APP_URL}/verify-email?...` `` (`api/auth/register`, `lib/admin-users.ts`…) ✅ → có `/` cuối sẽ ra `//` trong link email |
| `DATABASE_URL` | Neon **pooled** (`-pooler`), **role `gieochu_app`** — không bao giờ role owner (ADR-010) |
| `DIRECT_URL` | Neon **không pooler**, **role `gieochu_app`** — pg-boss dùng (`createJobQueue(env.DIRECT_URL)` ở `lib/jobs.ts`, `worker.ts`) ✅ |
| `JWT_ACCESS_SECRET` | ≥ 32 ký tự (zod `min(32)`) ✅; khác dev |
| `JWT_ISSUER`, `JWT_AUDIENCE` | vd `gieochu`, `gieochu-web` |
| `PAYMENT_ENCRYPTION_KEY` | 32 bytes base64 — mã hoá secret cổng thanh toán |
| `STORAGE_ENCRYPTION_KEY` | 32 bytes base64, **khác** `PAYMENT_ENCRYPTION_KEY` (ADR-017 gốc) |

`NODE_ENV` do nền tảng đặt (schema mặc định `development`; cookie `Secure` chỉ bật khi `NODE_ENV=production` — `lib/cookies.ts`
✅; Vercel tự đặt `production` cho Production 🟡 — **kiểm lại sau deploy** ❓).

> ⚠️ Hai khoá mã hoá phải **giữ nguyên** giữa các lần deploy và giữa Vercel với host worker — đổi khoá thì cấu hình đã lưu
> trong Admin không giải mã được nữa (suy ra từ cơ chế mã hoá DB ✅; chưa có quy trình xoay khoá).

### 3.2. Thương hiệu và cấu hình nghiệp vụ — KHÔNG còn là env (ADR-032)

| Trước đây (env) | Nay quản lý ở | Ghi chú |
| :-- | :-- | :-- |
| `APP_NAME`, `APP_SHORT_NAME`, `APP_SLOGAN` | `/admin/settings/branding` (`SystemBranding`) | Trống → `DEFAULT_BRAND` (`@gieochu/config/brand`). Tên ngắn chưa có cột DB — luôn dùng mặc định ✅ |
| `TZ_DISPLAY` | Hằng `DISPLAY_TIME_ZONE` trong code | Không cấu hình ✅ |
| `ACCESS_TOKEN_TTL`, `REFRESH_TOKEN_TTL_DAYS`, `EMAIL_VERIFY_TTL_HOURS`, `PASSWORD_RESET_TTL_MINUTES`, `PRESIGN_UPLOAD_TTL_SECONDS`, `PRESIGN_DOWNLOAD_TTL_SECONDS`, `TRIAL_DAYS`, `GRACE_DAYS`, `ORDER_PENDING_TTL_MINUTES`, `INVOICE_PENDING_TTL_HOURS`, `DEFAULT_DOWNLOAD_LIMIT` | `/admin/settings/general` (`system_settings`) | Mặc định + giới hạn ở [[01-Architecture-Decisions/ADR-018-System-Settings-And-Brand-From-System-Center|ADR-018]] §3 ✅. Nếu Vercel từng đặt giá trị **khác mặc định** → nhập lại ở trang này sau deploy, vì app không còn đọc env |
| `EMAIL_PROVIDER`, `EMAIL_FROM`, `SMTP_HOST`, `SMTP_PORT`, `RESEND_API_KEY` | `/admin/settings/smtp` (`SystemSmtpConfig`) | Env email chỉ còn là **fallback dev** (Mailpit), tuỳ chọn. Thiếu cả hai nguồn → gửi trả `EMAIL_NOT_CONFIGURED` (app vẫn khởi động) ✅ |

### 3.3. Biến cần XOÁ khỏi Vercel khi deploy bản ADR-032

Zod `z.object` **bỏ qua** khoá thừa nên để sót không làm app dừng ✅ — xoá để tránh hiểu nhầm là còn hiệu lực và để không lộ
cấu hình dev:

* Thương hiệu/nghiệp vụ (§3.2): `APP_NAME`, `APP_SHORT_NAME`, `APP_SLOGAN`, `TZ_DISPLAY`, `ACCESS_TOKEN_TTL`,
  `REFRESH_TOKEN_TTL_DAYS`, `EMAIL_VERIFY_TTL_HOURS`, `PASSWORD_RESET_TTL_MINUTES`, `PRESIGN_UPLOAD_TTL_SECONDS`,
  `PRESIGN_DOWNLOAD_TTL_SECONDS`, `TRIAL_DAYS`, `GRACE_DAYS`, `ORDER_PENDING_TTL_MINUTES`, `INVOICE_PENDING_TTL_HOURS`,
  `DEFAULT_DOWNLOAD_LIMIT`.
* Email fallback dev: `EMAIL_PROVIDER`, `EMAIL_FROM`, `SMTP_HOST`, `SMTP_PORT`, `RESEND_API_KEY` — **chỉ xoá sau khi** SMTP ở
  `/admin/settings/smtp` đã bật + xác minh, nếu không email sẽ ngừng gửi.
* Dev/CLI (bảng §3.5).

### 3.4. Tuỳ chọn

`CLAMAV_HOST` (chưa có client ClamAV thật — ADR-018 gốc) ✅.

### 3.5. KHÔNG đặt trên Vercel

| Biến | Lý do |
| :-- | :-- |
| `PRISMA_MIGRATE_URL` | Role owner Neon (DDL, **BYPASSRLS**). Không thuộc schema env runtime (ADR-031) ✅ — app không đọc. **Nếu từng đặt: xoá và đổi mật khẩu role owner.** |
| `TEST_DATABASE_URL` | Chỉ cho dev/CI |
| `MOMO_SANDBOX_ENDPOINT` | Chỉ dev |
| `ALLOW_DEMO_SEED`, `DEMO_SEED_BLOCKED_DB_HOSTS` | Công cụ dữ liệu demo **chỉ dev** ([[04-Operations-Runbooks/Dev-Demo-Data-Runbook|Dev-Demo-Data-Runbook]]) |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `SEED_SUPPORT_EMAIL` | Chỉ `prisma/seed.ts` đọc, trên máy chạy seed — app không dùng ✅ |
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
   env trên Vercel (§3.1). Script hiện vẫn `GRANT CREATE ON DATABASE` cho `gieochu_app` ✅ — DB dùng chung đã `REVOKE` quyền này
   (2026-10-15 🟡); chạy lại script thì phải `REVOKE` lại. Xem
   [[04-Operations-Runbooks/Disaster-Recovery-Runbook|Disaster-Recovery-Runbook]] §4.1.
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

Mỗi lần có migration mới: theo quy trình **expand → contract** ở §9 — migration *thêm* chạy **trước** deploy, migration
*xoá/đổi tên* chạy **sau** khi bản mới đã lên production. **Không chạy `db:migrate`/DDL khi chưa được Quốc duyệt**; DB đang có
dữ liệu thì **không** chạy bước 3 (seed) — chỉ dùng khi dựng DB trống hoàn toàn (ADR-034).

---

## 5. Sau khi deploy

### 5.1. Nhập cấu hình trong Admin (đăng nhập super admin vừa seed)

| Trang | Việc | Thiếu thì sao |
| :-- | :-- | :-- |
| `/admin/settings/storage` | Nhập R2 (endpoint, bucket, access key) + kiểm tra kết nối | Upload/tải file không chạy |
| `/admin/settings/cloudinary` | Nhập Cloudinary hệ thống + "Kiểm tra kết nối" | Chữ ký ảnh trả `CLOUDINARY_NOT_CONFIGURED` ✅ |
| `/admin/settings/smtp` | Nhập SMTP, bật + xác minh | Rơi về env (§3.2) |
| `/admin/billing/payment` | Cấu hình cổng thanh toán **platform** (SePay/MoMo/QR thủ công) | Tenant không trả phí gói được |
| `/admin/settings/branding` | Tên thương hiệu, slogan, logo, màu (tuỳ chọn) | Dùng `DEFAULT_BRAND` + màu mặc định |
| `/admin/settings/general` | Kiểm tra 10 khoá cấu hình đang hiện (TTL, ân hạn, đơn/hoá đơn chờ, lượt tải mặc định); nhập lại giá trị từng đặt qua env nếu khác mặc định | Dùng mặc định (`SYSTEM_SETTINGS_BOUNDS`) ✅ |
| `/admin/settings` | Email hỗ trợ (`supportEmail`) | Trống |

Các trang trên tồn tại trong `apps/web/app/admin/**` ✅. Cổng thanh toán **tenant** do từng tenant tự cấu hình ở `/studio/{tenantSlug}/settings/payments` ✅.

### 5.2. Kiểm tra nhanh ❓ (chưa làm trên Vercel)

1. **CSP + hydrate:** mở `/login`, DevTools → không có lỗi CSP "inline script"; response có header `Content-Security-Policy`
   với `nonce-…`; form đăng nhập **không** đẩy mật khẩu lên URL (dấu hiệu hydrate hỏng — ADR-016).
2. **Đăng nhập/đăng xuất:** cookie `httpOnly`, `Secure`, `SameSite=Lax`; refresh cookie `Path=/api/auth`.
3. **Trang chính:** `/`, `/pricing`, `/register`, storefront `/{tenantSlug}`, trang tài liệu `/{tenantSlug}/{productSlug}`, URL cũ
   `/{tenantSlug}/products/{productSlug}` → **301**, `/admin`, `/studio/{tenantSlug}`, `/account/library`.
4. **Email:** gửi thử từ `/admin/settings/smtp`; kiểm link trong email dùng đúng `APP_URL` (không `//`).
5. **Upload:** tải một file thử trong Studio — nếu không có worker, file sẽ đứng ở "Đang quét" (§6).
6. **ADR-032/033:** `/admin/settings/general` mở được và lưu được; trang chủ `/` hiện số liệu/giáo viên/tài liệu thật (section
   rỗng thì ẩn); tên thương hiệu trên `/login` đúng giá trị ở `/admin/settings/branding`.

---

## 6. Worker pg-boss — KHÔNG chạy trên Vercel

`apps/web/worker.ts` là tiến trình chạy lâu dài (`pnpm --filter @gieochu/web run worker` → `tsx worker.ts`), kết nối
`DIRECT_URL`, đăng ký 4 hàng đợi ✅:

| Hàng đợi | Lịch | Thiếu worker thì |
| :-- | :-- | :-- |
| `FILE_SCAN` | theo job (khi upload xong) | File sản phẩm kẹt trạng thái `PENDING` — Studio hiện nhãn **"Đang quét"** (`delivery-sources.tsx`) ✅ |
| `PAYMENT_PROCESS` | theo job (webhook thanh toán **tenant** enqueue ở `api/webhooks/tenants/[tenantId]/[provider]/route.ts`) | Webhook vẫn nhận/trả 2xx nhưng sự kiện **không được xử lý** → đơn không chuyển trạng thái ✅ (code) |
| `ORDER_SWEEP` | `*/5 * * * *` | Đơn `PENDING` quá `orderPendingTtlMinutes` (System Center, ADR-032) **không hết hạn** ✅ |
| `SUBSCRIPTION_SWEEP` | `0 * * * *` | Việc quét subscription theo giờ (`runSubscriptionSweep`) không chạy ✅ |

**Email không phụ thuộc worker:** comment đầu `worker.ts` ghi email đã chuyển sang gửi **đồng bộ** qua `sendEmailNow()`
(`lib/email-dispatch.ts`) ✅ — thiếu worker **không** làm mất email (khác với mô tả trong brief, xem KB-Audit §11).

**Host cho worker:** chưa chọn — ứng viên Railway / Fly.io / VPS 🟡 (theo brief, chưa quyết). Yêu cầu tối thiểu suy từ code ✅:
Node ≥ 20.9, cài cả monorepo (`pnpm install`), **cùng bộ 8 biến env runtime §3.1** (worker gọi `getEnv()` và đọc `.env` gốc repo;
cấu hình nghiệp vụ worker đọc lại từ `system_settings` mỗi lần chạy job — ADR-032),
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
| 7.5 | **Production trả 500** (2026-10-15) | Migration `20260929100000_adr032_drop_platform_name` chạy trên DB dev — **chính là DB production** — trong khi bản đang deploy còn đọc `system_settings.platformName` 🟡 | Khôi phục cột bằng tay `ADD COLUMN IF NOT EXISTS "platformName" TEXT` 🟡; quy trình phòng ngừa §9 |

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
* **Một DB cho dev/Preview/production (ADR-034):** `pnpm test:integration`, `demo:seed`, `prisma studio`, thao tác trên Preview
  đều đụng dữ liệu production; `pnpm db:seed` bị cấm (ghi đè `blocks` trang chủ). Kỷ luật ở §9.1.
* **Truy vấn thêm mỗi request:** root layout đọc `system_settings` (TTL cho `SessionRefresh`) ngoài `SystemBranding` (ADR-032)
  ✅ — chưa đo ❓.

---

## 9. Một database duy nhất — migration expand → contract và kỷ luật thao tác DB (ADR-034)

Nguồn: **ADR-034** (chủ dự án quyết 2026-10-15 — **không tách DB**) — bản trích
[[01-Architecture-Decisions/ADR-020-Single-Database-Dev-Preview-Production|ADR-020 (≙ ADR-034)]]; `CLAUDE.md` mục "Một DB duy
nhất (ADR-034)" ✅. Máy dev, Vercel Preview và Production dùng **cùng** database Neon → **mọi thao tác DB từ máy dev là thao tác
trên production.** Trình tự dưới đây Long soạn từ quy tắc trên, **chưa ai chạy thử đúng trình tự** ❓.

### 9.1. Quy tắc

1. **Migration chỉ do Quốc duyệt và chạy.** Agent (Hiếu/Phong/Long) không tự chạy `pnpm db:migrate` hay DDL tay. **Không**
   `prisma migrate dev` / `prisma migrate reset` (sẽ đụng/xoá dữ liệu production).
2. **Expand → contract:** bản deploy chỉ đi kèm migration **thêm** (bảng/cột nullable hoặc có default, index, policy mới).
   `DROP`/`RENAME`/đổi kiểu cột chỉ chạy **sau khi** bản code không còn dùng cột đó đã lên production và qua smoke test.
3. **Không chạy `pnpm db:seed`** — seed ghi đè `blocks` trang chủ CMS ✅ (`seed.ts`). Dữ liệu hệ thống sửa qua UI System Center.
4. **Integration test / script thủ công ghi dữ liệu thật:** chỉ chạy khi cần; tự dọn user/tenant/đơn tạm; không đụng cấu hình
   dùng chung (dùng `shared-config-snapshot`, Publish-And-Rollback §2.2.1); không chạy luồng gửi email tới địa chỉ thật (chỉ
   `@example.test`).
5. **Preview deployment** ghi vào cùng DB — chỉ dùng để **xem giao diện**, không tạo/xoá dữ liệu.
6. **Dữ liệu demo đang ở production** — dọn bằng `demo:clean` trước khi mở cho người dùng thật (§9.3).

### 9.2. Trình tự một lần phát hành có migration

| Bước | Việc | Ai |
| :-: | :-- | :-- |
| 1 | Rà thư mục `packages/db/prisma/migrations/`: mọi migration **chưa áp** chỉ được là loại *expand*. `prisma migrate deploy` áp **mọi** migration đang chờ — file contract đã nằm trong repo thì sẽ chạy luôn ở bước 3 | Quốc duyệt |
| 2 | `prisma migrate status` (dùng `PRISMA_MIGRATE_URL`) — đối chiếu danh sách đang chờ | Quốc |
| 3 | **Trước deploy:** `pnpm db:migrate` (chỉ expand). Ngay sau bước này máy dev **và** bản production cũ cùng thấy schema mới — bản cũ phải vẫn chạy được (vì chỉ thêm) | Quốc |
| 4 | Deploy bản code mới lên Vercel, smoke test (§5.2) | Quốc |
| 5 | **Sau deploy:** viết migration contract (`DROP COLUMN IF EXISTS …`) trong commit riêng, Quốc duyệt rồi `pnpm db:migrate` | Hiếu viết, Quốc chạy |

Không có DB thử riêng: kiểm tra migration bằng đọc SQL + typecheck/test trước bước 3; câu SQL phải idempotent khi có thể
(`IF EXISTS` / `IF NOT EXISTS`).

**Rollback:** sau bước 3 mà bản mới lỗi → deploy lại bản cũ vẫn chạy được vì DB chỉ được *thêm*. Sau bước 5 thì bản cũ (còn đọc
cột đã xoá) **không** quay lại được. Point-in-Time Restore ảnh hưởng cả dev lẫn Preview — chỉ dùng khi bất khả kháng
([[04-Operations-Runbooks/Publish-And-Rollback-Runbook|Publish-And-Rollback-Runbook]] §4.2).

### 9.3. Dọn dữ liệu demo trước khi mở cho người dùng thật

* Theo ADR-034, dữ liệu `demo:seed` (5 khách `demo+…@gieochu.test`, 3 sản phẩm `demo-*` + đơn/đánh giá trong tenant `phongweb`)
  đang nằm trên production và **hiển thị công khai** 🟡 — cũng đi vào số liệu thật trên trang chủ (ADR-033: số tài liệu, lượt
  mua, đánh giá).
* Lệnh: `ALLOW_DEMO_SEED=1 pnpm --filter @gieochu/db run demo:clean` từ máy dev (`APP_URL` localhost, `NODE_ENV` khác
  production) ✅. **Không** đặt host DB production vào `DEMO_SEED_BLOCKED_DB_HOSTS` — chốt này chặn cả `clean` ✅ (đọc
  `demo-reviews.ts`: `assertDevEnvironment()` chạy trước mọi lệnh). Chi tiết:
  [[04-Operations-Runbooks/Dev-Demo-Data-Runbook|Dev-Demo-Data-Runbook]].
* Sau khi dọn: `soldCount`/`ratingSum` của sản phẩm còn lại tự đúng (script xoá theo danh sách cố định) — kiểm lại trang chủ ❓.

### 9.4. Việc còn treo từ sự cố — cột `system_settings.platformName`

* Hiện trạng: `schema.prisma` không còn cột ✅; DB có lại cột (`TEXT`, nullable) sau khôi phục 🟡; migration
  `20260929100000_adr032_drop_platform_name` (DROP **không** `IF EXISTS`) nằm trong repo, chưa commit ✅, và theo diễn biến sự cố
  đã chạy trên DB → nhiều khả năng đã ghi "applied" trong `_prisma_migrations` ❓ (kiểm ở bước 2 §9.2).
* **Sau khi** bản ADR-032 lên production: thêm migration mới `ALTER TABLE "system_settings" DROP COLUMN IF EXISTS
  "platformName";` rồi áp theo bước 5 §9.2 (BACKLOG). `IF EXISTS` để chạy được cả trên DB đã mất cột.
* Migration `20260929120000_adr033_product_sold_count` (thêm cột + CHECK + backfill — loại expand) đã áp lên DB theo
  `docs/DECISIONS.md` 🟡.

### 9.5. Migration Cửa hàng ADR-035 — đã áp trước deploy (đúng trình tự expand)

* `20261015090000_adr035_unaccent_search` (chỉ *thêm* extension `unaccent` + hàm `public.gieochu_unaccent(text)` + GRANT EXECUTE cho
  `gieochu_app`; idempotent) ✅ đọc SQL — Quốc đã áp lên DB dùng chung 2026-10-15, kiểm hàm trả `de thi toan hoc` 🟡. Bản production
  hiện tại không dùng hàm → không ảnh hưởng (đúng bước 3 §9.2). Code dùng hàm (`/cua-hang/tai-lieu`) **chưa commit/deploy** ✅.
* Cùng ngày: `REVOKE CREATE ON DATABASE neondb FROM gieochu_app` (chủ dự án chạy) 🟡 — xem Disaster-Recovery-Runbook §4.1.
* Trước deploy bản Cửa hàng: quét lại tenant trùng 6 slug dành riêng mới (`cua-hang`, `tai-lieu`, `danh-muc`, `tim-kiem`, `giao-vien`,
  `kham-pha`) — lần quét 2026-10-15 không trùng 🟡. Câu quét (role owner, chỉ đọc):
  `SELECT id, slug, name, status FROM tenants WHERE slug IN ('cua-hang','tai-lieu','danh-muc','tim-kiem','giao-vien','kham-pha');`
  (theo kế hoạch §4.5; tên bảng/cột ✅ theo `@@map`).

---

## 10. Liên kết

* [[01-Architecture-Decisions/ADR-017-Vercel-Deploy-Build-Without-Env|ADR-017 (≙ ADR-031)]] ([ADR-017-Vercel-Deploy-Build-Without-Env.md](../01-Architecture-Decisions/ADR-017-Vercel-Deploy-Build-Without-Env.md))
* [[01-Architecture-Decisions/ADR-018-System-Settings-And-Brand-From-System-Center|ADR-018 (≙ ADR-032)]] ([ADR-018-System-Settings-And-Brand-From-System-Center.md](../01-Architecture-Decisions/ADR-018-System-Settings-And-Brand-From-System-Center.md))
* [[01-Architecture-Decisions/ADR-020-Single-Database-Dev-Preview-Production|ADR-020 (≙ ADR-034)]] ([ADR-020-Single-Database-Dev-Preview-Production.md](../01-Architecture-Decisions/ADR-020-Single-Database-Dev-Preview-Production.md))
* [[01-Architecture-Decisions/ADR-003-Postgres-App-Role-RLS|ADR-003 (≙ ADR-010)]] ([ADR-003-Postgres-App-Role-RLS.md](../01-Architecture-Decisions/ADR-003-Postgres-App-Role-RLS.md))
* [[01-Architecture-Decisions/ADR-004-Csp-Nonce-Proxy|ADR-004 (≙ ADR-016)]] ([ADR-004-Csp-Nonce-Proxy.md](../01-Architecture-Decisions/ADR-004-Csp-Nonce-Proxy.md))
* [[01-Architecture-Decisions/ADR-016-Short-Product-Url-No-Sticky-Publish-Card|ADR-016 (≙ ADR-030)]] ([ADR-016-Short-Product-Url-No-Sticky-Publish-Card.md](../01-Architecture-Decisions/ADR-016-Short-Product-Url-No-Sticky-Publish-Card.md)) — slug dành riêng
* [[04-Operations-Runbooks/Publish-And-Rollback-Runbook|Publish-And-Rollback-Runbook]] ([Publish-And-Rollback-Runbook.md](./Publish-And-Rollback-Runbook.md))
* [[04-Operations-Runbooks/Disaster-Recovery-Runbook|Disaster-Recovery-Runbook]] ([Disaster-Recovery-Runbook.md](./Disaster-Recovery-Runbook.md))

*Quay lại: [[MOC-Home]] (../00-Index/MOC-Home.md)*

---
tags:
  - runbook
  - deployment
  - database
  - security
  - jobs
  - status/living
date: 2026-09-29
updated: 2026-10-25
author: Long
---

# 🚀 Cẩm Nang: Deploy Gieo Chữ Lên Vercel (Deploy Vercel Runbook)

> [!NOTE] ADR-049 (2026-10-23)
> Vercel là môi trường **thử nghiệm**; **production sẽ chạy trên VPS** (cùng nơi MinIO + Storage Gateway). Runbook này vẫn là quy trình hiện hành cho
> Vercel; runbook deploy VPS, crontab thay Vercel Cron **chưa có** — xem [[01-Architecture-Decisions/ADR-036-Vercel-Testing-VPS-Production|ADR-036 KB (≙ ADR-049)]].
> Một DB dùng chung (ADR-034) vẫn áp dụng: thao tác dữ liệu trên Vercel thử nghiệm là thao tác trên dữ liệu production.

> Quyết định gốc: **ADR-031** trong [`docs/DECISIONS.md`](../../docs/DECISIONS.md) — bản trích
> [[01-Architecture-Decisions/ADR-017-Vercel-Deploy-Build-Without-Env|ADR-017 (≙ ADR-031)]]; env runtime rút còn 8 biến theo
> **ADR-032** — [[01-Architecture-Decisions/ADR-018-System-Settings-And-Brand-From-System-Center|ADR-018 (≙ ADR-032)]]; một DB duy
> nhất cho dev/Preview/production theo **ADR-034** —
> [[01-Architecture-Decisions/ADR-020-Single-Database-Dev-Preview-Production|ADR-020 (≙ ADR-034)]]; quy trình migration sau
> **sự cố 2026-10-15** ở §9; job nền chạy trong app (`after()` + Vercel Cron hằng ngày) theo [[01-Architecture-Decisions/ADR-022-Background-Jobs-After-And-Daily-Cron|ADR-022 (≙ ADR-036)]] ở §6; audit log M12a theo
> [[01-Architecture-Decisions/ADR-023-M12-Audit-Log-Append-Only|ADR-023 (≙ ADR-037)]] ở §9.6 —
> nghiệp vụ: [[02-System-Specs/Background-Jobs-Specs|Background-Jobs-Specs]]. Checklist chung trước phát hành,
> CI và rollback: [[04-Operations-Runbooks/Publish-And-Rollback-Runbook|Publish-And-Rollback-Runbook]]. Dựng lại DB từ đầu:
> [[04-Operations-Runbooks/Disaster-Recovery-Runbook|Disaster-Recovery-Runbook]].
>
> Mức xác minh: ✅ Long đã đối chiếu code (working tree 2026-09-29 và 2026-10-15, **chưa commit**) · 🟡 theo báo cáo/brief của
> Quốc hoặc hành vi nền tảng bên ngoài chưa tự kiểm · ❓ cần môi trường thật.
>
> **Trạng thái (2026-10-15):** theo `docs/DECISIONS.md` (sự cố 2026-10-15) đã có **một bản đang chạy production trên Vercel** —
> bản trước ADR-032, còn đọc cột `system_settings.platformName` 🟡. Bản ADR-032/033 (8 biến env) **chưa deploy** ❓. Máy dev,
> Preview và Production dùng **một DB duy nhất** (ADR-034, quyết định lâu dài) — xem §9.
> **2026-10-16:** code ADR-036 (cron `/api/cron/daily`, `CRON_SECRET`, drain hàng đợi bằng `after()`) **xong code** (đối chiếu working tree) — nay **đã commit `9a3208f`** ✅ `git log`;
> deploy ❓ chờ chủ dự án xác nhận.

---

## 1. Kiến trúc triển khai (tóm tắt)

| Thành phần | Chạy ở đâu | Ghi chú |
| :-- | :-- | :-- |
| App Next.js 16 (`apps/web`) | **Vercel** | Root layout `force-dynamic` → mọi trang render lúc request ✅ |
| Postgres | **Neon** | Runtime dùng role `gieochu_app` (ADR-010) ✅ |
| Migration (`prisma migrate deploy`) | **Máy dev / CI**, không phải Vercel | Cần `PRISMA_MIGRATE_URL` (role owner) — chỉ ở máy chạy lệnh ✅ |
| Job nền pg-boss (`payment.process`, `file.scan`) | **Trong chính app trên Vercel** — `after()` sau response (ADR-036) | Xem §6 ✅ (code) / ❓ (hành vi Vercel) |
| Việc định kỳ (sweep thuê bao/đơn, bảo trì + dọn hàng đợi) | **Vercel Cron** gọi `GET /api/cron/daily` mỗi ngày 03:00 giờ VN (ADR-036) | Xem §6 ✅ (code) / ❓ (chưa deploy) |
| Worker pg-boss (`apps/web/worker.ts`) | **Không deploy** — chỉ local/server riêng (ADR-036 mục 4) | §6.4 |
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
  "buildCommand": "next build",
  "crons": [{ "path": "/api/cron/daily", "schedule": "0 20 * * *" }]
}
```

Khoá `crons` thêm theo ADR-036 (2026-10-16, đã commit `9a3208f`) — lịch tính theo **UTC**: `0 20 * * *` = 03:00 giờ Việt Nam.

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

> ⚠️ Hai khoá mã hoá phải **giữ nguyên** giữa các lần deploy và giữa Vercel với worker local/server riêng (nếu chạy) — đổi khoá thì cấu hình đã lưu
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

* `CLAMAV_HOST` (chưa có client ClamAV thật — ADR-018 gốc) ✅.
* **`CRON_SECRET`** (ADR-036) ✅ `packages/config/src/env.ts`: tuỳ chọn; chuỗi rỗng = chưa đặt. **Nếu đặt thì phải ≥ 32 ký tự** — ngắn
  hơn thì `getEnv()` lỗi và **cả app dừng** (fail-fast), không chỉ route cron. Không đặt → app chạy bình thường nhưng
  `GET /api/cron/daily` trả `503 CRON_NOT_CONFIGURED` → sweep thuê bao/đơn và dọn hàng đợi hằng ngày **không chạy**. Cách đặt: §6.2.

* **`STORAGE_GATEWAY_PROVIDERS`** (ADR-045, 2026-10-22, đã commit `4ab5a3b` — deploy ❓) ✅ `packages/config/src/env.ts`: tuỳ chọn; danh sách `MINIO`/
  `CLOUDFLARE_R2` phân tách dấu phẩy; giá trị lạ → **cả app dừng** (fail-fast). **Không đặt trên Vercel** — chỉ đặt trên máy có nginx cấu hình
  `location /_s/` + `auth_request` (VPS). Đặt trên Vercel thì URL tải/upload thành `/_s/...` mà không có gì phục vụ → hỏng tải/upload (suy từ
  code ✅). Quy trình: [[04-Operations-Runbooks/Storage-Gateway-VPS-Runbook|Storage-Gateway-VPS-Runbook]].

Env runtime hiện hành = **8 biến bắt buộc** (§3.1) + 3 biến tuỳ chọn (`CRON_SECRET`, `CLAMAV_HOST`, `STORAGE_GATEWAY_PROVIDERS`).

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
   env trên Vercel (§3.1). Script nay `REVOKE CREATE ON DATABASE` cho `gieochu_app` ✅ (đọc 2026-10-16 — đính chính bản trước ghi "vẫn
   `GRANT CREATE`"); trên DB mới tạo schema `pgboss` bằng role owner trước rồi chạy lại script — quy trình chính thức (ADR-037 bổ sung), chưa chạy thử ❓. Script cũng thu lại
   `UPDATE, TRUNCATE` trên `audit_logs` (§9.6). Xem [[04-Operations-Runbooks/Disaster-Recovery-Runbook|Disaster-Recovery-Runbook]] §4.1, §4.3.
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
| `/admin/settings/general` | Kiểm tra các khoá cấu hình đang hiện (TTL, ân hạn, đơn/hoá đơn chờ, lượt tải mặc định; từ ADR-053 thêm nhóm "Chính sách phiên đăng nhập" 6 khoá — áp cho cả phiên đang mở từ lần refresh kế tiếp); nhập lại giá trị từng đặt qua env nếu khác mặc định | Dùng mặc định (`SYSTEM_SETTINGS_BOUNDS`) ✅ |
| `/admin/settings` | Email hỗ trợ (`supportEmail`) | Trống |

Các trang trên tồn tại trong `apps/web/app/admin/**` ✅. Cổng thanh toán **tenant** do từng tenant tự cấu hình ở `/studio/{tenantSlug}/settings/payments` ✅.

### 5.2. Kiểm tra nhanh ❓ (chưa làm trên Vercel)

1. **CSP + hydrate:** mở `/login`, DevTools → không có lỗi CSP "inline script"; response có header `Content-Security-Policy`
   với `nonce-…`; form đăng nhập **không** đẩy mật khẩu lên URL (dấu hiệu hydrate hỏng — ADR-016).
2. **Đăng nhập/đăng xuất:** cookie `httpOnly`, `Secure`, `SameSite=Lax`; refresh cookie `Path=/api/auth`.
3. **Trang chính:** `/`, `/pricing`, `/register`, storefront `/{tenantSlug}`, trang tài liệu `/{tenantSlug}/{productSlug}`, URL cũ
   `/{tenantSlug}/products/{productSlug}` → **301**, `/admin`, `/studio/{tenantSlug}`, `/account/library`.
4. **Email:** gửi thử từ `/admin/settings/smtp`; kiểm link trong email dùng đúng `APP_URL` (không `//`).
5. **Upload:** tải một file thử trong Studio — sau vài giây (tải lại trang) file phải rời trạng thái "Đang quét" nhờ `after()` (§6);
   còn kẹt → xem log function `uploads/complete` (`after(): queue drain …`).
6. **ADR-032/033:** `/admin/settings/general` mở được và lưu được; trang chủ `/` hiện số liệu/giáo viên/tài liệu thật (section
   rỗng thì ẩn); tên thương hiệu trên `/login` đúng giá trị ở `/admin/settings/branding`.
7. **Cron (ADR-036):** Settings → Cron Jobs thấy `/api/cron/daily`; gọi tay không header → `401`; xem log lần chạy đầu (§6.2).

---

## 6. Job nền trên Vercel — `after()` + Vercel Cron hằng ngày (ADR-036)

Nguồn: **ADR-036** + "Chủ dự án chốt (2026-10-16)" trong `docs/DECISIONS.md`. Code đối chiếu working tree 2026-10-16 (nay đã commit `9a3208f`,
deploy ❓) ✅. Nghiệp vụ chi tiết: [[02-System-Specs/Background-Jobs-Specs|Background-Jobs-Specs]].

### 6.1. Ai xử lý job nào

| Việc | Trên Vercel | Nếu không chạy được |
| :-- | :-- | :-- |
| `FILE_SCAN` (upload xong) | `after()` trong `POST /api/studio/[tenantSlug]/uploads/complete` + cron dọn sót ✅ | File kẹt "Đang quét" (`delivery-sources.tsx`) tới lần cron kế tiếp |
| `PAYMENT_PROCESS` (webhook tenant) | `after()` trong `POST /api/webhooks/tenants/[tenantId]/[provider]` + cron dọn sót ✅ | Webhook vẫn trả 2xx; đơn chưa fulfil tới lần cron kế tiếp |
| Hết hạn đơn `PENDING` | Đọc/thanh toán dùng `effectiveOrderStatus` ngay; `runOrderSweep()` trong cron chỉ đồng bộ DB ✅ | Khách vẫn không thanh toán được đơn quá hạn; DB còn ghi `PENDING` tới lần cron kế |
| Sweep thuê bao | `runSubscriptionSweep()` trong cron ✅ | Chuyển trạng thái thuê bao trễ (tối đa ~24h khi cron chạy bình thường) |
| Bảo trì hàng đợi (job `active` kẹt) | `supervise()` trong cron ✅ (web tắt timer bảo trì của pg-boss) | Job bị cắt giữa chừng chỉ được trả lại khi cron chạy (≤ 24h) |
| Xoá audit log > 12 tháng (M12a, ADR-037) | Bước `audit.purge` trong cron, chạy trước drain ✅ | Dòng cũ tồn lâu hơn 12 tháng; không ảnh hưởng nghiệp vụ |
| Tổng hợp `tenant_daily_stats` (M12b, ADR-037) | Bước `stats.aggregate` trong cron, sau `audit.purge`, trước drain — tính lại hôm qua + hôm nay giờ VN; bảng trống → backfill ≤ 400 ngày ✅ | Dashboard `/admin` hiện số của lần tổng hợp trước (ghi "cập nhật lần cuối …"); bảng trống → section báo "Chưa có hoạt động bán tài liệu" |
| Xoá IP báo cáo vi phạm > 12 tháng (M12c, ADR-038) | Bước `abuse_report.ip_purge` trong cron, sau `stats.aggregate`, trước drain ✅ | IP tồn lâu hơn 12 tháng; báo cáo không đổi |
| Xoá bản ghi phiên hết hạn/đã thu hồi > 90 ngày (ADR-053) | Bước `refresh_tokens.purge` trong cron, sau `abuse_report.ip_purge`, trước drain ✅ — §6.6 | Bảng `refresh_tokens` phình dần (gồm IP/User-Agent cũ); đăng nhập/refresh không bị ảnh hưởng |
| Xoá nhật ký tải `download_events` > 12 tháng (ADR-054 mục 8) | Bước `download_events.purge` trong cron, sau `refresh_tokens.purge`, trước drain, qua `withSystemJob` ✅ | Nhật ký tải (có IP) giữ lâu hơn 12 tháng — lệch cam kết dự thảo Chính sách bảo mật; tải tài liệu không bị ảnh hưởng (lượt tải đếm ở `entitlements`/share link) |
| Dọn nháp editor > 30 ngày / mồ côi (ADR-053 bổ sung lần 3) | `purgeStaleDrafts()` có ở `lib/editor-draft.ts` nhưng **chưa gắn** vào cron ✅ grep | Hiện chưa editor nào ghi nháp nên chưa có dữ liệu để dọn |

Web app chạy pg-boss với `schedule: false, supervise: false` (`lib/jobs.ts`) ✅ — không sinh job `order.sweep`/`subscription.sweep` trên
Vercel. **Email không phụ thuộc job** — gửi đồng bộ qua `sendEmailNow()` ✅.

### 6.2. Đặt `CRON_SECRET` trên Vercel (chủ dự án/Quốc làm — Long chỉ ghi quy trình) ❓

Trình tự theo brief của Quốc 🟡 — chưa ai chạy thử:

1. Sinh secret trên máy dev (64 ký tự hex, ≥ 32 ký tự như schema yêu cầu):
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
   (`.env.example` gợi ý tương đương `openssl rand -hex 32` ✅.)
2. Vercel → Project → Settings → Environment Variables → thêm `CRON_SECRET` cho môi trường **Production**. Không commit giá trị thật.
3. **Redeploy** Production (biến env chỉ có hiệu lực ở bản deploy mới) 🟡.
4. Vercel → Settings → **Cron Jobs**: kiểm có job `/api/cron/daily`, lịch `0 20 * * *`. Vercel Cron tự gửi
   `Authorization: Bearer <CRON_SECRET>` 🟡 (hành vi nền tảng, chưa tự kiểm).
5. Sau lần chạy đầu (03:00 giờ VN) xem log function: dòng `cron daily finished` kèm `results`; response `200 { ok: true, … }`. Có bước
   lỗi → `500 CRON_STEP_FAILED` + dòng log `cron daily: step failed` (tên bước). Mã phản hồi:
   [[03-API-Contracts/Endpoint-Directory|Endpoint-Directory]] §17.
6. **Backfill thống kê ngay sau lần deploy đầu có M12b** (ADR-037): bảng `tenant_daily_stats` đang trống trên DB dùng chung 🟡 (Quốc kiểm
   2026-10-16). Để dashboard `/admin` có số liệu ngay thay vì chờ 03:00 hôm sau: Vercel → Settings → **Cron Jobs** → job `/api/cron/daily`
   → bấm **Run** 🟡 (theo brief của Quốc — chưa ai làm; nút Run là tính năng nền tảng, Long chưa kiểm). Lần chạy này backfill từ ngày có
   hoạt động sớm nhất (tối đa 400 ngày) — kiểm `results.statsAggregate` trong log: `backfilled: true`, `fromDate`/`toDate`, `upserted`.
   Nếu bước báo lỗi giữa chừng (vd hết thời gian 60 giây khi dữ liệu nhiều — ❓ chưa đo): mỗi cửa sổ 31 ngày commit riêng nên các cửa sổ
   đã xong được giữ, nhưng **bảng đã có dòng thì lần chạy sau chỉ tính hôm qua + hôm nay** — các ngày cũ chưa ghi sẽ thiếu, bấm Run lại
   không bù được ✅ đọc code `runStatsAggregation`. Gặp thì báo Quốc (BACKLOG "ngân sách thời gian cron khi backfill dài"). Chi tiết: [[02-System-Specs/Tenant-Stats-Specs|Tenant-Stats-Specs]] §4.

> ⚠️ Đặt `CRON_SECRET` ngắn hơn 32 ký tự làm **toàn bộ app** lỗi khi khởi động (§3.4). Gọi tay để kiểm: phải kèm đúng header Bearer;
> route chỉ trả số đếm, không trả dữ liệu tenant/đơn/khách.

### 6.3. Dọn job pg-boss tồn đọng — `docs/ops/2026-10-16-pgboss-cleanup.sql` (chủ dự án chạy)

DML một lần trên DB dùng chung (ADR-034) — **không** phải Prisma migration (schema `pgboss` không do Prisma quản lý) ✅ đọc file. Chạy trong
Neon Console → SQL Editor bằng **role owner**, **không** chạy khi đang có integration test. Agent không chạy.

| Bước | Nội dung | Kỳ vọng ghi trong file |
| :-: | :-- | :-- |
| 1 (chỉ đọc) | Đếm job `payment.process` của test (`providerEventId` bắt đầu `evt_m8test_`) theo `state` | Tổng 35: 18 `created`, 15 `failed`, 2 `completed` |
| 1 (chỉ đọc) | Job test nào thuộc tenant **còn tồn tại** | 0 |
| 1 (chỉ đọc) | Job `order.sweep`/`subscription.sweep` trạng thái `created` | 89 / 6 |
| 2 (`BEGIN … COMMIT`) | Xoá job test `payment.process`; xoá job sweep `created`; xoá dòng `pgboss.schedule` của `order.sweep`/`subscription.sweep` | — |

Bước 1 khác kỳ vọng → **dừng, báo Quốc**. Kết quả chạy thật chưa có ❓. Lưu ý: chạy `worker.ts` trên DB dùng chung sau khi dọn sẽ ghi lại
dòng `pgboss.schedule` (worker vẫn `schedule` hai sweep) ✅ suy từ code.

### 6.4. `apps/web/worker.ts` — không deploy

Giữ cho chạy local/server riêng (`pnpm --filter @gieochu/web run worker` → `tsx worker.ts`) ✅: `schedule`/`supervise` bật,
`subscription.sweep` hằng giờ, `order.sweep` 5 phút, `work` 4 hàng đợi (handler `payment.process`/`file.scan` dùng chung
`lib/job-handlers.ts`). Không cần host riêng cho production nữa (ADR-036 thay hướng "worker cần host riêng" của ADR-031 mục 4) 🟡.
Nếu chạy: cần Node ≥ 20.9, cả monorepo, cùng bộ env runtime §3.1 (đọc `.env` gốc repo), không `PRISMA_MIGRATE_URL`.

### 6.5. Kết nối pg-boss từ serverless ❓

`lib/jobs.ts` khởi động pg-boss lười một lần cho mỗi instance function ấm (start lỗi thì lần sau thử lại) ✅; mỗi instance giữ kết nối
`DIRECT_URL` (không pooler — ADR-007). Số kết nối thật trên Neon khi nhiều instance song song và độ trễ cold start chưa đo ❓.

### 6.6. Dọn bản ghi phiên đăng nhập — bước `refresh_tokens.purge` (ADR-053)

Nguồn: ADR-053 mục 4 trong `docs/DECISIONS.md`; code `purgeStaleRefreshTokens()` (`apps/web/lib/account-sessions.ts`) ✅. Nghiệp vụ:
[[02-System-Specs/Auth-Session-Specs|Auth-Session-Specs]] §8.

* **Làm gì:** `DELETE FROM refresh_tokens` các dòng có `expiresAt < now − 90 ngày` **hoặc** `revokedAt < now − 90 ngày` (một câu `deleteMany`) ✅. Token
  còn hiệu lực không bao giờ bị xoá; token đã bị thay (rotate) hết hạn cùng phiên nên bị xoá sau hạn phiên + 90 ngày.
* **Không cần cấu hình thêm:** chạy trong cron hằng ngày sẵn có (§6.2); không env mới, không GRANT mới (`gieochu_app` đã có `DELETE` — theo comment
  migration 🟡). Hạn 90 ngày là hằng `SESSION_RECORD_RETENTION_DAYS` trong code, **không** có ở System Settings.
* **Kiểm sau lần chạy:** log `cron daily finished` → `results.sessionPurge = { ok: true, result: { deleted: <số dòng> } }`. Lần chạy đầu sau deploy có thể
  xoá nhiều dòng tích từ trước (token cũ trượt 7 ngày, chưa từng dọn) — số thật ❓ chưa đo. Bước lỗi → `500 CRON_STEP_FAILED`, các bước khác vẫn chạy.
* **Index:** `refresh_tokens_expiresAt_idx`, `refresh_tokens_revokedAt_idx` (migration §9.12) phục vụ câu xoá này.
* **Production trên VPS (ADR-049):** Vercel Cron chỉ chạy ở môi trường Vercel; khi production chuyển VPS, crontab phải gọi `GET /api/cron/daily` kèm
  Bearer `CRON_SECRET` thì bước này mới chạy — chưa có runbook VPS ([[01-Architecture-Decisions/ADR-036-Vercel-Testing-VPS-Production|ADR-036 KB]]) ❓.
* **Không** chạy tay `DELETE` trên DB dùng chung để "dọn nhanh" (ADR-034) — chờ cron, hoặc bấm Run cron trên Vercel (§6.2 bước 6).

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
| 7.6 | `next build` **trên máy dev** lỗi `workStore` (2026-10-17) | Hai phiên build chạy song song dùng chung thư mục `.next`, hoặc chạy build từ đường dẫn ổ đĩa chữ thường `f:\` 🟡 (Quốc kiểm) | Chỉ chạy **một** build mỗi lúc; chạy từ `F:\VSCODE\gieochu` (chữ hoa) — build sạch đạt 2026-10-17 🟡. Không liên quan Vercel |

---

## 8. Rủi ro còn lại

* **Prisma client đã commit lệch schema:** Vercel dùng nguyên `packages/db/src/generated` trong git, không generate lại. Sửa
  `schema.prisma` mà quên `pnpm --filter @gieochu/db run generate` + commit thư mục `generated` ⇒ app trên Vercel chạy với
  client cũ (thiếu model/cột mới → lỗi runtime). Local có thể không lộ vì `typecheck` của `@gieochu/db` chạy
  `prisma generate` trước ✅. Phương án giảm rủi ro đang cân nhắc: build command
  `pnpm --filter @gieochu/db run generate && next build` (BACKLOG, chưa quyết).
* **Chi phí render động:** mọi trang render theo request + 1 truy vấn branding/request (ADR-031) 🟡 — chưa đo ❓.
* **Job nền phụ thuộc `after()` + cron 1 lần/ngày** (§6, ADR-036): job `active` bị cắt giữa chừng chỉ được trả lại khi cron chạy
  (≤ 24h); sweep thuê bao trễ tối đa ~24h; thiếu `CRON_SECRET` thì cả hai đều không chạy. Muốn dày hơn: cắm thêm lịch ngoài
  (cron-job.org) vào cùng route (BACKLOG).
* **pg-boss từ serverless** — số kết nối `DIRECT_URL`, cold start (§6.5) ❓.
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
   dùng chung — cần cấu hình giả thì mock lớp đọc cấu hình, không ghi/snapshot bảng singleton (Publish-And-Rollback §2.2.1; `shared-config-snapshot` đã xoá
   2026-10-25 sau sự cố ghi đè cấu hình 2026-10-24); không chạy luồng gửi email tới địa chỉ thật (chỉ
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

### 9.6. Migration Audit log M12a (ADR-037) — đã áp trước deploy (đúng trình tự expand)

* `20261016090000_m12a_audit_logs` — chỉ *thêm*: enum `AuditScope`, bảng L1 `audit_logs` (không FK) + 3 index, 3 hàm/trigger chỉ-INSERT,
  khối quyền cho `gieochu_app` (`REVOKE ALL` rồi `GRANT SELECT, INSERT, DELETE`) ✅ đọc SQL. Quốc áp lên DB dùng chung **2026-10-16** và
  kiểm bằng role `gieochu_app` trong transaction rollback: UPDATE/TRUNCATE → permission denied; DELETE, và DELETE có cờ
  `gieochu.audit_purge` với dòng mới → trigger `42501`; quyền `DELETE, INSERT, SELECT`; đủ 3 trigger 🟡 (báo cáo Quốc).
* Bản production hiện tại không biết bảng này → không ảnh hưởng (bước 3 §9.2). Code M12a (ghi audit, 2 trang xem, bước cron
  `audit.purge`) **chưa commit/deploy** ✅ `git status`. Nếu code lên trước migration ở môi trường khác: `audit.log` bỏ qua ghi, trang
  hiện "Nhật ký chưa sẵn sàng", bước purge trả `skipped: true` — không lỗi ✅ đọc code.
* `setup-app-role.mts` có thêm `REVOKE UPDATE, TRUNCATE ON "audit_logs"` — chạy lại script không mở lại UPDATE ✅.
* **Hệ quả với test (ADR-034 + ADR-037 mục 6):** dòng audit do integration test/script thủ công tạo trên DB dùng chung **không xoá
  được** tới 12 tháng; lượt `audit.test.ts` 2026-10-16 để lại 5 dòng giả 🟡. Khi dọn dữ liệu demo (§9.3) không xoá được dòng audit.
* Không có migration contract nào đi kèm.
* Kiểm sau restore/rebuild: [[04-Operations-Runbooks/Disaster-Recovery-Runbook|Disaster-Recovery-Runbook]] §4.3. Nghiệp vụ:
  [[02-System-Specs/Audit-Log-Specs|Audit-Log-Specs]].

### 9.7. Migration Thống kê M12b (ADR-037) — đã áp trước deploy (đúng trình tự expand)

* `20261016120000_m12b_tenant_daily_stats` — chỉ *thêm*: bảng L1 `tenant_daily_stats` + index `(date)` + unique `(tenantId, date)` + FK
  `tenants` `ON DELETE CASCADE`; không RLS, không trigger; khối `DO` `GRANT SELECT, INSERT, UPDATE, DELETE` cho `gieochu_app` ✅ đọc SQL.
* Quốc áp lên DB dùng chung **2026-10-16** và kiểm: `gieochu_app` có SELECT/INSERT/UPDATE, không RLS, bảng trống 🟡 (báo cáo Quốc).
* Bản production hiện tại không biết bảng này → không ảnh hưởng. Code M12b **đã commit `36103fb`** ✅ `git log`; deploy ❓. Nếu code lên trước
  migration ở môi trường khác: bước cron `stats.aggregate` trả `skipped: true`, dashboard hiện "Thống kê chưa sẵn sàng" — không lỗi ✅ đọc
  code.
* Sau deploy: backfill lần đầu — §6.2 bước 6.
* Xoá tenant kéo theo xoá dòng thống kê của tenant đó (Cascade) — tổng toàn nền tảng ở các ngày cũ giảm tương ứng sau lần đọc kế tiếp.
* Không có migration contract nào đi kèm. Nghiệp vụ: [[02-System-Specs/Tenant-Stats-Specs|Tenant-Stats-Specs]].

### 9.8. Migration Báo cáo vi phạm M12c (ADR-038) + Quyền lợi người mua (ADR-039) — đã áp, **bắt buộc trước code**

* `20261016150000_m12c_abuse_reports` — chỉ *thêm*: 4 enum, bảng L1 `abuse_reports`, cột nullable khoá kiểm duyệt trên
  `products`/`reviews`/`posts` + cam kết bản quyền trên `products`, CHECK, 3 trigger `*_guard_moderation`, quyền ✅ đọc SQL.
* `20261016180000_adr039_entitlement_remedy` — chỉ *thêm*: enum `EntitlementRemedyStatus`, 5 cột `remedy*` trên `entitlements` (gồm
  `remedyResolvedAt`), index, 2 CHECK, trigger `entitlements_guard_remedy`, quyền ✅ đọc SQL.
* Quốc áp cả hai lên DB dùng chung **2026-10-16** và kiểm bằng `gieochu_app` (rollback): tenant đặt khoá/remedy → `42501`; tenant cấp thêm
  lượt khi có remedy → `42501`; `system_job` được; CHECK shape chặn; checksum migration ADR-039 khớp file 🟡 (báo cáo Quốc).
* ⚠️ **Khác M12a/M12b — code KHÔNG chịu được thứ tự ngược:** code mới đọc cột mới của `products`/`reviews`/`posts`/`entitlements` (Prisma
  chọn đủ cột của model) → nếu code lên môi trường **chưa** có 2 migration này, mọi truy vấn sản phẩm/đánh giá/bài viết/entitlement lỗi
  **P2022 (500)**. Chỉ phần `abuse_reports` xử lý mềm (503 `REPORT_UNAVAILABLE`, trang admin "chưa sẵn sàng", cron `skipped`). Trên DB dùng
  chung hiện tại: đã áp → deploy được. **Mọi DB khác (restore, branch mới): `pnpm db:migrate` trước khi deploy code này.**
* Chiều ngược an toàn: bản production cũ chạy trên schema mới không sao (cột nullable/có default; trigger chỉ chặn đổi cột mới, không bao giờ
  chạm với code cũ) ✅ theo comment migration — **rollback code** về bản trước M12c không cần đụng DB.
* **Sau deploy — email đơn hàng bắt đầu gửi thật lần đầu** 🟡 (brief Quốc): bản sửa đọc `orders` dưới `withSystemJob` làm `order_paid`
  (khách) và `new_sale` (chủ gian hàng) được gửi lần đầu kể từ khi app chạy bằng role `gieochu_app` (trước đó RLS trả 0 dòng nên hàm dừng
  sớm — [[02-System-Specs/Order-State-Machine|Order-State-Machine]] §3.7). Việc cần làm: SMTP System Center đã cấu hình; theo dõi log
  `email` sau đơn thật đầu tiên; **không** tạo đơn thử với email thật của người khác (ADR-034). Email chỉ gửi cho đơn **fulfil sau deploy**
  — không gửi bù cho đơn cũ ✅ đọc code.
* **Sau deploy — thay đổi hành vi checkout:** đơn `PENDING` của tenant không `ACTIVE` (kể cả `READ_ONLY`) hoặc có sản phẩm không `PUBLISHED`
  nhận 409 `PRODUCT_UNAVAILABLE` khi thanh toán/áp mã ✅ đọc code. Chủ dự án đã chốt chặn qua ADR-040 mục 4 (2026-10-17).
* **Sau deploy — ADR-040 (không migration):** khách của gian hàng `READ_ONLY` chỉ thấy trang "tạm ngưng" (`noindex`), trang tài liệu/bài
  viết 404, share link 410, báo cáo vi phạm 404, gửi/sửa đánh giá 409 `TENANT_NOT_ACTIVE` ✅ đọc code — bảng đầy đủ
  [[02-System-Specs/Storefront-CMS-Specs|Storefront-CMS-Specs]] §1.2. Rollback code không cần đụng DB. Hiện có bao nhiêu tenant `READ_ONLY`
  trên production ❓ (Long không chạy truy vấn DB).
* Bước cron mới `abuse_report.ip_purge` không cần cấu hình thêm (§6). Route mới `POST /api/reports` kiểm `Origin` theo `APP_URL` — `APP_URL`
  phải đúng domain production ✅ đọc code.
* Không có migration contract nào đi kèm. Nghiệp vụ: [[02-System-Specs/Abuse-Reports-Specs|Abuse-Reports-Specs]].

### 9.9. Migration ADR-041 (Hồ sơ + hoàn tiền gói) — đã áp 2026-10-17, deploy được

* `20261017090000_adr041_email_change` — chỉ *thêm*: giá trị enum `VerificationTokenType.EMAIL_CHANGE` + cột nullable
  `verification_tokens."newEmail"` ✅ đọc SQL. ⚠️ **Bắt buộc trước code:** Prisma Client mới chọn cột `newEmail` → code lên môi trường chưa có
  migration này thì mọi truy vấn `verification_tokens` (đăng ký, xác minh email, quên/đặt lại mật khẩu) lỗi **P2022**.
* `20261017100000_adr041_subscription_refunds` — chỉ *thêm*: `SubscriptionInvoiceStatus.REFUNDED`, enum `SubscriptionRefundStatus`, bảng L1
  `subscription_refund_requests` + 3 CHECK + `GRANT` cho `gieochu_app` ✅ đọc SQL. Code chịu được thứ tự ngược (P2021 → "chức năng hoàn tiền chưa
  sẵn sàng", 503 `REFUND_UNAVAILABLE`, không 500).
* Cả hai **đã áp lên DB dùng chung 2026-10-17** 🟡 (brief Quốc) → **deploy được**. Mọi DB khác (restore, branch mới): `pnpm db:migrate` trước
  khi deploy code ADR-041. Không có migration contract. Rollback code về bản trước: an toàn (cột nullable, giá trị enum chưa ai ghi, bảng mới
  không ai đọc) ✅ theo comment migration.
* **Không cần biến env mới.** Thông tin nhận tiền hoàn mã hoá bằng `PAYMENT_ENCRYPTION_KEY` có sẵn — **đổi khoá này làm mất khả năng đọc**
  `payoutEncrypted` của yêu cầu đang chờ (cùng rủi ro với secret cổng thanh toán).
* **Sau deploy — kiểm tay** ❓ (chưa làm qua UI có đăng nhập, chưa SMTP thật): `/pricing` khi chưa xuất bản CMS hiện cấu hình mặc định; gói nào
  trên production đang để hạn mức `0` với ý "không giới hạn" sẽ hiện "Không có" (ADR-041 A.4 — Quốc kiểm bảng `plans` bằng truy vấn chỉ đọc
  trước, sửa thành `-1` ở `/admin/plans` nếu cần); 4 email tài khoản + 3 email hoàn tiền gửi qua SMTP System Center; **không** thử đổi
  email/hoàn tiền với địa chỉ/tài khoản ngân hàng thật của người khác (ADR-034).
* Build: xem §7.6 (lỗi `workStore` chỉ ở máy dev). Nghiệp vụ: [[02-System-Specs/Pricing-Page-Specs|Pricing-Page-Specs]],
  [[02-System-Specs/Account-Profile-Specs|Account-Profile-Specs]], [[02-System-Specs/Payment-And-Billing|Payment-And-Billing]] §5A–§5B.

### 9.10. Migration ADR-047 (ghi chú nội bộ đơn) — đã áp 2026-10-18, deploy được

* `20261018090000_adr045_order_notes` (tên thư mục giữ số cũ ADR-045 vì đã áp DB — quyết định nay là **ADR-047**) — chỉ *thêm* (expand): bảng L2 `order_notes` + 3 index + 3 FK + CHECK `order_notes_body_length` + RLS
  (`ENABLE` + `FORCE`, 5 policy, không policy UPDATE) + `GRANT SELECT, INSERT, DELETE` / `REVOKE UPDATE` cho `gieochu_app` (bọc `IF EXISTS`) ✅ đọc
  SQL. Không đổi bảng cũ — quan hệ mới trên `Order`/`Tenant`/`User` là quan hệ ngược, không thêm cột.
* **Thứ tự:** code chịu được việc lên **trước** migration — đọc ghi chú gặp P2021/42P01 → thẻ "Ghi chú nội bộ tạm chưa sẵn sàng", thêm/xoá → 503
  `ORDER_NOTES_UNAVAILABLE`, trang đơn vẫn chạy ✅ `lib/order-note.ts`. Vẫn nên áp trước.
* **Đã áp lên DB dùng chung 2026-10-18** 🟡 (brief Quốc — Quốc kiểm RLS enable+force, 5 policy, không UPDATE, CHECK 1–1000 ký tự; `order.test.ts` chạy
  thật 9/9 sau migration) → **deploy được**. File migration **chưa commit** ✅ `git status`. Mọi DB khác (restore, branch mới): `pnpm db:migrate`
  trước hoặc cùng lúc deploy. Không có migration contract. Rollback code về bản trước: an toàn — bảng mới không ai đọc ✅ theo comment migration.
* Cùng đợt: tìm đơn không dấu dùng `public.gieochu_unaccent` có sẵn từ migration ADR-035 (§9.5) — **không** cần DDL mới. **Không cần biến env mới.**
* Nghiệp vụ: [[02-System-Specs/Studio-Orders-Specs|Studio-Orders-Specs]] §3.2. Bảng: [[03-API-Contracts/Database-Schema-Reference|Database-Schema-Reference]] §7.

### 9.11. Migration ADR-050 (văn bản pháp lý có phiên bản) — đã chạy 2026-10-23, **bắt buộc trước code**

* `20261023090000_adr050_legal_documents` — chỉ *thêm* (expand): 2 enum (`LegalDocumentVersionStatus`, `LegalReviewStatus`), 3 bảng L1
  `legal_documents`, `legal_document_versions`, `user_legal_acceptances` + index + FK + 2 CHECK + trigger `legal_document_versions_freeze_content` +
  quyền (`user_legal_acceptances` chỉ `SELECT, INSERT, DELETE` cho `gieochu_app`) ✅ đọc SQL. Không RLS (L1), không đổi bảng cũ.
* **Thứ tự:** phải áp **trước** code. Comment đầu SQL nói lỗi P2021 "được bắt", nhưng `getEffectiveLegalVersion` (`lib/legal.ts`) **không** bắt — code lên
  DB chưa có bảng thì `/register` và `POST /api/auth/register` lỗi (suy từ code ❓, KB-Audit §31). Quốc chốt **không sửa** comment `migration.sql`
  (migration đã chạy, sửa file đổi checksum) — quy tắc vận hành: **luôn chạy migration trước khi deploy code ADR-050**.
* **Đã chạy trên DB dùng chung 2026-10-23** 🟡 (brief Quốc; Long không chạy lệnh DB). File migration **chưa commit** ✅ `git status`. Mọi DB khác (restore,
  branch mới): `pnpm db:migrate` trước deploy. Không migration contract. Rollback code về bản trước: an toàn — code cũ không đọc bảng mới.
* Cùng đợt (ADR-050 mục 1–2: menu CMS, trang chủ + SEO) **không** DDL — dùng `cms_pages` có sẵn (slug `menu`, `home`, cột `seoTitle/seoDescription`).
  **Không cần biến env mới** (canonical trang chủ dùng `APP_URL` có sẵn).
* Sau deploy: chưa có bản Điều khoản PUBLISHED → đăng ký như cũ; xuất bản bản đầu theo [[04-Operations-Runbooks/Legal-Terms-Publishing-Runbook|Legal-Terms-Publishing-Runbook]].
  Nghiệp vụ: [[02-System-Specs/Legal-Documents-Specs|Legal-Documents-Specs]].

### 9.12. Migration ADR-053 (chính sách phiên đăng nhập) — đã chạy 2026-10-24, **trước code GĐ B**

* `20261024090000_adr051_session_policy` — chỉ *thêm* (expand): `refresh_tokens` + `deviceLabel`, `rememberMe` (`NOT NULL DEFAULT false`),
  `sessionStartedAt`; `system_settings` + 6 cột `INTEGER NOT NULL DEFAULT` (`sessionIdleMinutes` 60, `sessionAbsoluteHours` 12, `rememberMeDays` 30,
  `adminIdleMinutes` 15, `adminAbsoluteHours` 8, `sessionWarningMinutes` 2); 2 index `expiresAt`, `revokedAt` ✅ đọc SQL. Không RLS (L1), không đổi/xoá cột cũ.
* **Thứ tự:** migration **trước** code GĐ B. Code GĐ A (hoặc bản cũ hơn) chạy được trên schema mới (comment SQL). Code GĐ B lên DB chưa có cột → Prisma
  ghi/đọc cột không tồn tại → login/refresh lỗi (suy từ code ❓).
* **Đã chạy trên DB dùng chung 2026-10-24** 🟡 (brief Quốc; Long không chạy lệnh DB). File migration **chưa commit** ✅ `git status`. Mọi DB khác (restore,
  branch mới): `pnpm db:migrate` trước deploy.
* **Sau deploy:** phiên đang mở không bị đăng xuất; lần refresh đầu tiên bắt đầu đếm idle/absolute và chuyển phiên đó thành **không ghi nhớ** (cookie
  session) — người dùng đóng trình duyệt sau đó sẽ phải đăng nhập lại ✅ suy từ code. Không biến env mới.
* **Migration contract về sau** (chưa làm, cần Quốc duyệt): bỏ `system_settings.refreshTokenTtlDays` chỉ sau khi code ADR-053 đã lên mọi môi trường dùng DB.
* Rollback code về trước ADR-053: an toàn với schema (cột mới có default); token tạo bởi code ADR-053 có `expiresAt` = hạn phiên, code cũ đọc bình thường ✅
  suy từ code.

### 9.13. Migration ADR-053 bổ sung lần 3 (nháp tự động editor) — đã chạy 2026-10-24

* `20261024120000_adr051_editor_drafts` (tên thư mục giữ số cũ ADR-051 — đổi số ADR 2026-10-24, [[00-Index/KB-Audit-2026-09-26|KB-Audit]] §34) — chỉ
  *thêm* (expand): 2 enum, bảng L2 `tenant_editor_drafts` (RLS `ENABLE` + `FORCE`, 5 policy) và bảng L1 `system_editor_drafts`, index, FK Cascade, CHECK,
  `GRANT` cho `gieochu_app` (bọc `IF EXISTS`) ✅ đọc SQL. Không đổi bảng cũ.
* **Thứ tự:** migration trước code dùng nháp; code hiện tại chạy được trên schema mới (không đọc 2 bảng) — comment SQL.
* **Đã chạy trên DB dùng chung** 🟡 (brief Quốc; Long không chạy lệnh DB). File migration **chưa commit** ✅ `git status`. Mọi DB khác: `pnpm db:migrate`.
* Môi trường tạo role `gieochu_app` **sau** migration: `setup-app-role` (ALTER DEFAULT PRIVILEGES) phải phủ 2 bảng — theo comment SQL, chưa kiểm ❓.

### 9.14. Migration ADR-054 (mô tả/SEO văn bản pháp lý, nới khoá) — đã chạy 2026-10-24, **trước code ADR-054**

* `20261024150000_adr053_legal_document_meta` (tên thư mục giữ số cũ 053 — đổi số ADR 2026-10-25, [[00-Index/KB-Audit-2026-09-26|KB-Audit]] §36) — expand: `legal_documents` + `summary`, `seoTitle`, `seoDescription` (NULL), CHECK `legal_documents_meta_length`
  (320/120/320); `DROP` + tạo lại CHECK `legal_documents_key_format` (`key` nhận `_`, `slug` giữ luật cũ) ✅ đọc SQL. L1, không GRANT thêm.
* **Thứ tự:** chạy migration **trước** deploy code ADR-054 — metadata trang văn bản và editor `/admin/cms/phap-ly` đọc 3 cột mới; tạo nháp
  `content_policy`/`usage_license` cần CHECK đã nới. Code cũ chạy được trên schema mới (cột NULL, CHECK chỉ nới) — comment SQL.
* **Trạng thái:** **đã chạy trên DB dùng chung** 🟡 (chủ dự án xác nhận 2026-10-24, brief Quốc 2026-10-25; Long không chạy lệnh DB) — đã cập nhật
  [[02-System-Specs/Legal-Documents-Specs|Legal-Documents-Specs]] và [[03-API-Contracts/Database-Schema-Reference|Database-Schema-Reference]] §7. Môi trường
  dùng DB khác (khôi phục, Neon mới) vẫn phải chạy migration này trước code ADR-054.
* **Trước khi deploy:** quét DB không có tenant mang slug trùng 7 URL văn bản (`dieu-khoan-su-dung`, `chinh-sach-bao-mat`, `chinh-sach-noi-dung`,
  `cam-ket-ban-quyen`, `quyen-su-dung-tai-lieu`, `chinh-sach-nguoi-ban`, `lien-he`) — route tĩnh cấp gốc sẽ che storefront của tenant đó. Lần quét 2026-10-24: ✅ Hiếu quét DB (chỉ đọc), báo qua Quốc 2026-10-24: DB có 1 tenant, không trùng 7 slug mới và `phap-ly`; quét lại nếu có tenant mới trước deploy.
* Rollback code về trước ADR-054: cột mới bị bỏ qua; link `/{slug}` mới sẽ 404 (thư mục route không còn), `/phap-ly/{slug}` cũ hoạt động lại ✅ suy từ code.

### 9.15. Migration ADR-074 (`email_send_log.tenantId`) — **migrate trước, deploy code sau**; thêm kiểm tra `PAYMENT_ENCRYPTION_KEY` và webhook

* `20261127120000_adr074_email_send_log_tenant` — expand-only ✅ đọc SQL: `ALTER TABLE "email_send_log" ADD COLUMN "tenantId" TEXT` + `CREATE INDEX "email_send_log_tenantId_createdAt_idx"`. Không FK, không UPDATE; dòng cũ `NULL`. Bảng vẫn L1.
* **Thứ tự bắt buộc:** `pnpm db:migrate` **trước** khi deploy code (code mới ghi/đọc cột `tenantId` — gửi email và hai trang đọc nhật ký sẽ lỗi nếu cột chưa có). Code cũ chạy được trên schema mới (chỉ thêm cột NULL). Rollback code: an toàn ✅ suy từ code.
* **Trạng thái:** áp lên DB dùng chung — 🟡 Quốc báo đã áp (Long không chạy lệnh DB). Production VPS ❓ chưa xác minh. Mọi DB khác (restore, branch mới): `pnpm db:migrate` trước deploy.
* **`PAYMENT_ENCRYPTION_KEY` phải là base64 đúng 32 byte** ✅ đọc `packages/config/src/env.ts` (`refine` kiểm `Buffer.from(value, "base64").length === 32`). Từ ADR-074 mục 8, khoá sai định dạng/độ dài làm **app dừng khi khởi động** (fail-fast) thay vì lỗi muộn khi giải mã secret cổng. **Trước deploy:** kiểm giá trị đang đặt trên môi trường (Vercel/VPS) — tạo khoá mới bằng `openssl rand -base64 32`. **Không đổi khoá đang dùng** nếu chỉ để vượt kiểm tra: đổi khoá làm mất khả năng giải mã secret cổng/thông tin hoàn tiền đã lưu (xem §9.9).
* **Theo dõi webhook sau deploy (ADR-074 mục 7):** log `error` chứa "could not release webhook_events row" nghĩa là bước sau khi ghi sự kiện lỗi **và** việc xoá dòng sự kiện cũng lỗi → lần cổng gửi lại bị coi là trùng. **Đối soát tay theo `providerEventId`** (log kèm `scope`, `provider`, `tenantId`): kiểm `webhook_events` + `platform_payment_transactions` / `tenant_payment_transactions` / đơn / hoá đơn, rồi xác nhận tay nếu tiền đã về (SePay-Live-Test-Runbook). Log "step after recording the event failed — releasing…" là bình thường (đã xoá dòng, cổng sẽ gửi lại, response 5xx). Xem [[02-System-Specs/Payment-And-Billing|Payment-And-Billing]] §5T.

---

## 10. Liên kết

* [[01-Architecture-Decisions/ADR-017-Vercel-Deploy-Build-Without-Env|ADR-017 (≙ ADR-031)]] ([ADR-017-Vercel-Deploy-Build-Without-Env.md](../01-Architecture-Decisions/ADR-017-Vercel-Deploy-Build-Without-Env.md))
* [[01-Architecture-Decisions/ADR-018-System-Settings-And-Brand-From-System-Center|ADR-018 (≙ ADR-032)]] ([ADR-018-System-Settings-And-Brand-From-System-Center.md](../01-Architecture-Decisions/ADR-018-System-Settings-And-Brand-From-System-Center.md))
* [[01-Architecture-Decisions/ADR-020-Single-Database-Dev-Preview-Production|ADR-020 (≙ ADR-034)]] ([ADR-020-Single-Database-Dev-Preview-Production.md](../01-Architecture-Decisions/ADR-020-Single-Database-Dev-Preview-Production.md))
* [[01-Architecture-Decisions/ADR-003-Postgres-App-Role-RLS|ADR-003 (≙ ADR-010)]] ([ADR-003-Postgres-App-Role-RLS.md](../01-Architecture-Decisions/ADR-003-Postgres-App-Role-RLS.md))
* [[01-Architecture-Decisions/ADR-004-Csp-Nonce-Proxy|ADR-004 (≙ ADR-016)]] ([ADR-004-Csp-Nonce-Proxy.md](../01-Architecture-Decisions/ADR-004-Csp-Nonce-Proxy.md))
* [[01-Architecture-Decisions/ADR-016-Short-Product-Url-No-Sticky-Publish-Card|ADR-016 (≙ ADR-030)]] ([ADR-016-Short-Product-Url-No-Sticky-Publish-Card.md](../01-Architecture-Decisions/ADR-016-Short-Product-Url-No-Sticky-Publish-Card.md)) — slug dành riêng
* [[02-System-Specs/Background-Jobs-Specs|Background-Jobs-Specs]] — job nền + cron (ADR-036) ([Background-Jobs-Specs.md](../02-System-Specs/Background-Jobs-Specs.md))
* [[02-System-Specs/Abuse-Reports-Specs|Abuse-Reports-Specs]] — M12c/ADR-039, §9.8 ([Abuse-Reports-Specs.md](../02-System-Specs/Abuse-Reports-Specs.md))
* [[02-System-Specs/Audit-Log-Specs|Audit-Log-Specs]] — audit log M12a (ADR-037) ([Audit-Log-Specs.md](../02-System-Specs/Audit-Log-Specs.md))
* [[02-System-Specs/Tenant-Stats-Specs|Tenant-Stats-Specs]] — thống kê hằng ngày M12b (ADR-037) ([Tenant-Stats-Specs.md](../02-System-Specs/Tenant-Stats-Specs.md))
* [[04-Operations-Runbooks/Publish-And-Rollback-Runbook|Publish-And-Rollback-Runbook]] ([Publish-And-Rollback-Runbook.md](./Publish-And-Rollback-Runbook.md))
* [[04-Operations-Runbooks/Disaster-Recovery-Runbook|Disaster-Recovery-Runbook]] ([Disaster-Recovery-Runbook.md](./Disaster-Recovery-Runbook.md))

*Quay lại: [[MOC-Home]] (../00-Index/MOC-Home.md)*

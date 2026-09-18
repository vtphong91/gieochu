# ARCHITECTURE — Gieo Chữ

Nguồn gốc: [GIEOCHU_PROMPT_MVP_PHASE1.md](GIEOCHU_PROMPT_MVP_PHASE1.md) §4. File này phải được cập nhật trong
cùng commit mỗi khi luồng xử lý tổng thể thay đổi (mục 0.4).

## Sơ đồ hệ thống

```mermaid
flowchart TB
    subgraph Clients["Người dùng"]
        SA["System Admin"]
        TO["Tenant Owner"]
        CU["Customer"]
        GU["Khách vãng lai"]
    end

    subgraph Web["apps/web — Next.js App Router"]
        PX["proxy.ts<br/>requestId, tenant slug, redirect đăng nhập"]
        subgraph Areas["Khu vực giao diện"]
            MKT["(marketing)<br/>trang CMS giới thiệu"]
            ADM["/admin<br/>System console"]
            STU["/studio/[tenantSlug]<br/>Tenant dashboard"]
            STF["/[tenantSlug]<br/>Storefront + feed"]
            ACC["/account<br/>Hồ sơ, thư viện, đơn hàng"]
        end
        API["Route Handlers /api/*<br/>+ Server Actions"]
        WH["Webhooks<br/>/api/webhooks/platform/*<br/>/api/webhooks/tenants/[id]/*"]
    end

    subgraph Pkgs["packages/*"]
        AUTH["auth<br/>jose, argon2, RBAC"]
        CORE["core<br/>pricing, order FSM, tokens, errors, logger"]
        PAY["payments<br/>SePay, MoMo, VietQR"]
        DB["db<br/>Prisma + tenant guard"]
        STO["storage<br/>S3 presign"]
        MAIL["email<br/>templates + sender"]
        JOBS["jobs<br/>pg-boss workers"]
    end

    subgraph Infra["Hạ tầng"]
        NEON[("Neon PostgreSQL 16")]
        S3[("R2 / MinIO<br/>bucket private")]
        ESP["Resend / Mailpit"]
        SEPAY["SePay"]
        MOMO["MoMo"]
    end

    SA & TO & CU & GU --> PX --> Areas
    Areas --> API
    API --> AUTH & CORE & PAY & DB & STO
    WH --> PAY --> DB
    JOBS --> DB & MAIL & STO
    DB --> NEON
    STO --> S3
    MAIL --> ESP
    PAY <--> SEPAY & MOMO
```

**Trạng thái hiện tại (sau M6):** `PX` (proxy.ts — x-request-id + CSP nonce theo từng request, ADR-016 — +
gate hồ sơ/tenant/admin qua `lib/page-guards.ts`), `STF` (storefront công khai `/[tenantSlug]`), `STU`
(`/studio`, `/studio/[tenantSlug]`, settings + settings/payments + billing + products/CRUD + upload file
thật/ảnh bìa — **code xong, chờ verify với R2 thật** — + coupons/CRUD), `ADM` (`/admin`:
users/tenants/plans/cms/settings(+settings/storage — ADR-017)/billing/payment/billing/invoices — cơ bản,
audit log viewer chờ M12), `MKT` (`/`, `/pricing`, `/p/[slug]`), `AUTH` (đầy đủ: mật khẩu, JWT, RBAC), `PAY`
(`packages/payments` — đầy đủ MANUAL_QR/SEPAY/MOMO, dùng chung Platform/Tenant qua `PaymentScope`), `CORE`
(errors, logger, crypto: encryptSecret/decryptSecret/maskSecret — chuyển từ payments, dùng chung được với
storage, ADR-017 —, slug/branding/access-policy/membership, admin: lock-decision/plan-validation/cms-blocks/
dashboard-summary, billing: period/invoice-code/subscription-state/plan-limits, product:
slug-suggestion/publish-eligibility/storage-accounting, pricing: `calculatePrice()` — engine thuần, M6), `DB`
(User(+isSuperAdmin)/.../Tenant/TenantMember/TenantSlugHistory/Subscription(+periodEndReminderStage)/
Product(đầy đủ)/ProductFile/SystemSettings/SystemStorageConfig/TenantPaymentConfig/PlatformPaymentConfig/
WebhookEvent/BankBin/SubscriptionInvoice/PlatformPaymentTransaction/Coupon/CouponRedemption/Order/OrderItem/
TenantPaymentTransaction/TenantCustomer/Entitlement + RLS helpers
`withTenant/withCustomer/withPublic/withSystemJob` — **có hiệu lực thật**, xem ADR-010;
SubscriptionInvoice/PlatformPaymentTransaction/SystemStorageConfig là L1, không RLS —
Coupon/CouponRedemption/Order/OrderItem/TenantPaymentTransaction/TenantCustomer/Entitlement là L2/L3, có RLS
— `orders`/`order_items` có thêm chiều "khách hàng" trong policy, không chỉ chiều tenant, xem ADR-019 và
`docs/modules/M8.md`), `STO` (`packages/storage` — đầy đủ: `createS3Client`/`testS3Connection`/`presign.ts`/
`scan.ts`; ClamAV thật vẫn chưa tích hợp, ADR-018), `MAIL`, `JOBS` (nay có `JobQueue.schedule()` cho cron —
`subscription.sweep` chạy hằng giờ, `order.sweep` chạy mỗi 5 phút, `file.scan`/`payment.process` xử lý theo
job — tất cả trong `apps/web/worker.ts`) đã có. M9 thêm `ShareLink`/`DownloadEvent` (L2, RLS) và
`DownloadToken` (L1, không RLS — cùng lý do `RefreshToken`/`VerificationToken`, xem ADR-020); cùng lúc M9
sửa 2 policy RLS có sẵn từ M4/M5 (`products`, `product_files`) thêm nhánh "customer" mà bản gốc bỏ sót
(ADR-020).
Bảng L2 còn lại chưa xây: `posts/comments/reviews` (M10) — xem `docs/PLAN.md`.

## Ranh giới dữ liệu theo layer

```mermaid
flowchart LR
    subgraph L1["L1 System — scope PLATFORM"]
        U["users, user_profiles<br/>refresh_tokens"]
        P["plans, subscriptions<br/>subscription_invoices"]
        PP["platform_payment_configs<br/>platform_payment_transactions"]
        C["cms_pages, audit_logs"]
        S["tenant_daily_stats"]
    end
    subgraph L2["L2 Tenant — scope TENANT, có tenant_id + RLS"]
        T["tenants, tenant_members"]
        PR["products, product_files<br/>coupons"]
        TP["tenant_payment_configs<br/>tenant_payment_transactions"]
        O["orders, order_items<br/>tenant_customers"]
        SL["share_links, download_events<br/>(owner quản lý — không lọc theo user_id)"]
        F["posts, comments, reviews"]
    end
    subgraph L3["L3 Customer — lọc theo user_id (qua RLS scope='customer')"]
        E["entitlements"]
    end
    subgraph L1B["L1-adjacent — token dùng-một-lần, không RLS"]
        D["download_tokens<br/>(cùng mẫu refresh_tokens/verification_tokens)"]
    end

    L2 -- "job tổng hợp, không chứa dữ liệu cá nhân" --> S
    O --> E
    E --> D
    PR --> SL
```

Nguyên tắc (không đổi trong suốt dự án):

- System admin **không có route nào** đọc `orders`, `order_items`, `tenant_customers` của tenant. Dashboard
  System chỉ đọc `tenant_daily_stats` và bảng của L1.
- Tenant chỉ thấy `tenant_customers` của chính mình.
- Customer có **một tài khoản toàn cục**, thư viện gom tài liệu đã mua từ mọi tenant.

## Phân giải tenant và bảo vệ route

```mermaid
flowchart TD
    R["Request đến"] --> PX["proxy.ts gắn requestId"]
    PX --> Q1{"Đường dẫn?"}
    Q1 -- "/admin/*" --> G1["Cần cookie access token<br/>(chỉ kiểm tra có/không, redirect login)"]
    Q1 -- "/studio/[slug]/*" --> G1
    Q1 -- "/account/*" --> G1
    Q1 -- "/[slug]/*" --> PUB["Storefront công khai"]
    Q1 -- "/api/*" --> H["Route handler"]
    G1 --> PAGE["Server Component / Action"]
    PAGE --> V["requireUser(): verify JWT bằng jose"]
    H --> V
    V --> RB{"Kiểm tra quyền"}
    RB -- "admin" --> A1["requireRole SYSTEM_ADMIN"]
    RB -- "studio" --> A2["requireTenantMember(slug, OWNER)"]
    RB -- "account" --> A3["requireVerifiedAndProfileComplete()"]
    A2 --> TX["db.withTenant(tenantId, fn)<br/>set_config app.tenant_id trong transaction"]
    A1 --> OK["Xử lý nghiệp vụ"]
    A3 --> OK
    TX --> OK
    PUB --> RES["Resolve tenant theo slug<br/>404 nếu không tồn tại / bị khoá<br/>read-only nếu subscription hết hạn"]
```

**Quy tắc bất biến:** `proxy.ts` chỉ chuyển hướng và gắn header. Mọi route handler / server action / server
component nhạy cảm tự xác thực và phân quyền lại — không tin proxy đã lọc đủ.

## Cấu trúc thư mục (thực tế sau M8)

```
.
├── apps/
│   └── web/                       # Next.js App Router
│       ├── app/
│       │   ├── (auth)/             # register, login, verify-email, forgot-password, reset-password
│       │   ├── account/            # profile, security, library (đầy đủ — M9), orders (mới — M9)
│       │   ├── admin/              # dashboard, users, tenants, plans, cms(+[slug]/new),
│       │   │                       # settings(+settings/storage — ADR-017), billing/payment, billing/invoices (M3)
│       │   ├── studio/             # onboarding, dashboard (StatCard doanh thu/đơn chờ nối thật — M8),
│       │   │                       # settings (+ settings/payments — M7, + billing — M3,
│       │   │                       # + products(+new,+[productId](+share-links — M9)) — M5,
│       │   │                       # + coupons(+new,+[couponId]) — M6, + orders(+[orderId]), customers — M8)
│       │   ├── [tenantSlug]/       # storefront công khai (+ products/[productSlug], checkout/[orderCode] — M8)
│       │   ├── s/[token]/          # M9: trang link chia sẻ công khai, không cần đăng nhập
│       │   ├── pricing/, p/[slug]/ # trang công khai (M2)
│       │   ├── api/
│       │   │   ├── auth/           # register, login, refresh, logout, verify-email, resend-verification,
│       │   │   │                   # forgot-password, reset-password
│       │   │   ├── admin/          # dashboard (GET, aggregate-only)
│       │   │   ├── webhooks/tenants/[tenantId]/[provider]/   # M7/M8: verify + idempotent ghi + đẩy job
│       │   │   │                                             # payment.process (đúng §7.4 — ADR-019)
│       │   │   ├── webhooks/platform/[provider]/             # M3: verify + match invoice + PAID (đồng bộ,
│       │   │   │                                             # KHÔNG qua job — khoảng lệch đã biết, ADR-019)
│       │   │   ├── studio/[tenantSlug]/uploads/               # M5: presign/complete/cover-presign/cover-complete
│       │   │   ├── [tenantSlug]/coupons/preview/              # M6: công khai, tính lại giá ở server
│       │   │   ├── downloads/(+[token])                       # M9: POST tạo token, GET tiêu thụ + 302
│       │   │   ├── share-links/[token]/download/               # M9: công khai, không đăng nhập
│       │   │   └── me/
│       │   └── layout.tsx, page.tsx (marketing shell)
│       ├── lib/                    # cookies, session, page-guards (+admin/tenant-page guards),
│       │                           # tenant, create-tenant, storefront (+getPublishedProductBySlug — M8),
│       │                           # admin-dashboard, admin-users, tenant-payment (M7), platform-payment/
│       │                           # subscription-billing/subscription-sweep/tenant-write-guard (M3),
│       │                           # plan-limits/product/product-upload(+requireStorageConfig xuất công khai
│       │                           # — M9 tái dùng)/file-scan/system-storage (M5),
│       │                           # coupon (M6), order/payment-process (M8 — markOrderPaid duy nhất,
│       │                           # xem docs/modules/M8.md), download/share-link/library/entitlement (M9,
│       │                           # xem docs/modules/M9.md), pricing (giá gói /pricing, M2 — khác
│       │                           # packages/core/src/pricing của M6), rate-limit, jobs, jwt-context, duration
│       ├── proxy.ts                # x-request-id + CSP nonce theo từng request (ADR-016)
│       ├── worker.ts               # pg-boss worker: email.send (M11) + subscription.sweep cron (M3) +
│       │                           # file.scan (M5) + payment.process + order.sweep cron mỗi 5 phút (M8)
│       ├── tests/integration/      # Vitest — auth (8), tenant (5), admin (4), tenant-payment (4),
│       │                           # subscription-billing (5), product (2), product-upload (1 — 1 test M5
│       │                           # còn lại chờ storage thật), coupon (1), order (9 — M8), download (5 — M9)
│       ├── next.config.ts          # X-Content-Type-Options/Referrer-Policy (CSP ở proxy.ts, ADR-016)
│       └── vitest.config.ts
├── packages/
│   ├── auth/        # password, JWT access token, refresh/verification token (random-token.ts chuyển
│   │                 # sang core ở M9, ADR-020), RBAC (M1)
│   ├── core/         # errors, logger (M0); crypto/ encryption + random-token (encryptSecret/decryptSecret/
│   │                 # maskSecret — chuyển từ payments, ADR-017; generateOpaqueToken/hashOpaqueToken —
│   │                 # chuyển từ auth, ADR-020); tenant/ slug-branding-access-membership (M4);
│   │                 # admin/ lock-decision-plan-validation-cms-blocks-dashboard-summary (M2);
│   │                 # billing/ period-invoice_code-subscription_state-plan_limits (M3);
│   │                 # product/ slug-suggestion-publish-eligibility-storage-accounting (M5);
│   │                 # pricing/ calculate-price — engine thuần, không phụ thuộc DB (M6);
│   │                 # order/ state-code-expiry-payment_match-pricing-purchase_guard-customer_stats (M8);
│   │                 # download/ token-entitlement_guard-share_link-share_link_password (M9, argon2 riêng
│   │                 # trong core — không phụ thuộc auth, ADR-020)
│   ├── payments/    # PaymentProvider (PaymentScope-agnostic), vietqr, providers/
│   │                # (manual-qr/sepay/momo), registry (M7) — encryption re-exported từ @gieochu/core
│   ├── db/          # schema.prisma (User(+isSuperAdmin)/.../Tenant/TenantMember/TenantSlugHistory/
│   │                # Subscription(+periodEndReminderStage)/Product(đầy đủ)/ProductFile/Plan/CmsPage/
│   │                # SystemSettings/SystemStorageConfig/TenantPaymentConfig/PlatformPaymentConfig/
│   │                # WebhookEvent/BankBin/SubscriptionInvoice/PlatformPaymentTransaction/
│   │                # Coupon/CouponRedemption/Order/OrderItem/TenantPaymentTransaction/TenantCustomer/
│   │                # Entitlement — M8; DownloadToken/ShareLink/DownloadEvent — M9),
│   │                # prisma.config.ts, client.ts, rls.ts (withTenant/withCustomer/withPublic/
│   │                # withSystemJob), seed.ts, prisma/migrations/,
│   │                # scripts/setup-app-role.mts (tạo role Postgres riêng cho app — ADR-010)
│   ├── storage/     # file-format.ts, object-key.ts, s3-client.ts, connection-test.ts, presign.ts (PUT
│   │                # đơn + multipart), scan.ts (readObjectForScan — hash + magic bytes 1 lần đọc) (M5);
│   │                # download-disposition.ts (RFC 5987 filename*=UTF-8''... + clamp TTL ≤600s — M9)
│   ├── email/       # EmailSender (SMTP/Resend) + template kích hoạt/reset mật khẩu/subscription-billing (M3)/
│   │                # product-file-rejected (M5)/order-paid+new-sale (M8)
│   ├── jobs/        # pg-boss queue wrapper — send() (M1) + schedule() cron (M3) + FILE_SCAN queue (M5) +
│   │                # PAYMENT_PROCESS/ORDER_SWEEP queue (M8)
│   └── config/      # env.ts (zod), brand.ts, eslint-preset.mjs
├── docker/
│   └── docker-compose.yml         # minio (+createbuckets), mailpit, postgres (profile local-db)
├── docs/
│   ├── ARCHITECTURE.md            # (file này)
│   ├── PLAN.md
│   ├── DECISIONS.md
│   ├── BACKLOG.md
│   ├── bao-cao-ky-thuat-module-payment-2026-09-18.md   # báo cáo tham khảo do người dùng cung cấp (M3)
│   └── modules/
│       ├── M0.md
│       ├── M1.md
│       ├── M2.md
│       ├── M3.md
│       ├── M4.md
│       ├── M5.md
│       ├── M6.md
│       └── M7.md
├── scripts/count-tests.mjs
├── CLAUDE.md
└── turbo.json
```

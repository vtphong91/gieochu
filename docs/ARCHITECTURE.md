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

**Trạng thái hiện tại (sau M7):** `PX` (proxy.ts + gate hồ sơ/tenant/admin qua `lib/page-guards.ts`), `STF`
(storefront công khai `/[tenantSlug]`), `STU` (`/studio`, `/studio/[tenantSlug]`, settings + settings/payments),
`ADM` (`/admin`: users/tenants/plans/cms/settings — cơ bản, chưa có Platform Payment UI/audit log viewer),
`MKT` (`/`, `/pricing`, `/p/[slug]`), `AUTH` (đầy đủ: mật khẩu, JWT, RBAC), `PAY` (`packages/payments` — đầy
đủ MANUAL_QR/SEPAY/MOMO, dùng chung Platform/Tenant qua `PaymentScope`), `CORE` (errors, logger,
slug/branding/access-policy/membership, admin: lock-decision/plan-validation/cms-blocks/dashboard-summary),
`DB` (User(+isSuperAdmin)/.../Tenant/TenantMember/TenantSlugHistory/Subscription-tối-thiểu/Product-tối-thiểu/
SystemSettings/TenantPaymentConfig/PlatformPaymentConfig-bảng-trống/WebhookEvent/BankBin + RLS helpers
`withTenant/withCustomer/withPublic/withSystemJob` — **có hiệu lực thật**, xem ADR-010), `MAIL`, `JOBS` đã có.
`STO` và phần lớn bảng L2 còn lại (product đầy đủ, order, coupon...) còn là skeleton/tối thiểu chờ module
tương ứng (xem `docs/PLAN.md`).

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
        F["posts, comments, reviews"]
    end
    subgraph L3["L3 Customer — lọc theo user_id"]
        E["entitlements"]
        D["download_tokens, download_events"]
        SL["share_links"]
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

## Cấu trúc thư mục (thực tế sau M7)

```
.
├── apps/
│   └── web/                       # Next.js App Router
│       ├── app/
│       │   ├── (auth)/             # register, login, verify-email, forgot-password, reset-password
│       │   ├── account/            # profile, security, library (stub)
│       │   ├── admin/              # dashboard, users, tenants, plans, cms(+[slug]/new), settings
│       │   ├── studio/             # onboarding, dashboard, settings (+ settings/payments — M7)
│       │   ├── [tenantSlug]/       # storefront công khai
│       │   ├── pricing/, p/[slug]/ # trang công khai (M2)
│       │   ├── api/
│       │   │   ├── auth/           # register, login, refresh, logout, verify-email, resend-verification,
│       │   │   │                   # forgot-password, reset-password
│       │   │   ├── admin/          # dashboard (GET, aggregate-only)
│       │   │   ├── webhooks/tenants/[tenantId]/[provider]/  # M7: verify + idempotent accept
│       │   │   └── me/
│       │   └── layout.tsx, page.tsx (marketing shell)
│       ├── lib/                    # cookies, session, page-guards (+admin/tenant-page guards),
│       │                           # tenant, create-tenant, storefront, admin-dashboard, admin-users,
│       │                           # tenant-payment (M7), pricing, rate-limit, jobs, jwt-context, duration
│       ├── proxy.ts
│       ├── worker.ts               # pg-boss worker: xử lý job email.send (khung M11)
│       ├── tests/integration/      # Vitest — auth (8), tenant (5), admin (4), tenant-payment (4)
│       ├── next.config.ts          # CSP/security headers
│       └── vitest.config.ts
├── packages/
│   ├── auth/        # password, JWT access token, refresh/verification token, RBAC (M1)
│   ├── core/         # errors, logger (M0); tenant/ slug-branding-access-membership (M4);
│   │                 # admin/ lock-decision-plan-validation-cms-blocks-dashboard-summary (M2);
│   │                 # pricing/order-FSM ở M6/M8
│   ├── payments/    # PaymentProvider (PaymentScope-agnostic), encryption, vietqr, providers/
│   │                # (manual-qr/sepay/momo), registry (M7)
│   ├── db/          # schema.prisma (User(+isSuperAdmin)/.../Tenant/TenantMember/TenantSlugHistory/
│   │                # Subscription-tối-thiểu/Product-tối-thiểu/Plan/CmsPage/SystemSettings/
│   │                # TenantPaymentConfig/PlatformPaymentConfig/WebhookEvent/BankBin),
│   │                # prisma.config.ts, client.ts, rls.ts (withTenant/withCustomer/withPublic/
│   │                # withSystemJob), seed.ts, prisma/migrations/,
│   │                # scripts/setup-app-role.mts (tạo role Postgres riêng cho app — ADR-010)
│   ├── storage/     # skeleton — M5
│   ├── email/       # EmailSender (SMTP/Resend) + template kích hoạt/reset mật khẩu (khung M11, M1 dùng)
│   ├── jobs/        # pg-boss queue wrapper (khung M11, M1 dùng)
│   └── config/      # env.ts (zod), brand.ts, eslint-preset.mjs
├── docker/
│   └── docker-compose.yml         # minio (+createbuckets), mailpit, postgres (profile local-db)
├── docs/
│   ├── ARCHITECTURE.md            # (file này)
│   ├── PLAN.md
│   ├── DECISIONS.md
│   ├── BACKLOG.md
│   └── modules/
│       ├── M0.md
│       ├── M1.md
│       ├── M2.md
│       ├── M4.md
│       └── M7.md
├── scripts/count-tests.mjs
├── CLAUDE.md
└── turbo.json
```

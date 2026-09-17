# PROMPT CHO CLAUDE CODE — XÂY DỰNG MVP GIAI ĐOẠN 1

## Gieo Chữ — Nền tảng SaaS "Document Social" cho giáo viên, coach, chuyên gia

| Hạng mục | Giá trị |
|---|---|
| Tên thương hiệu | **Gieo Chữ** |
| Tên viết tắt (logo, favicon, app icon, chỗ hẹp) | **Gieo** |
| Slogan | *Gieo Chữ – Nơi người dạy gieo chữ và chia sẻ học liệu.* |
| Tên miền chính | `gieochu.net` |
| Tên kỹ thuật (repo, package scope, DB, bucket) | `gieochu` — package dạng `@gieochu/core`, `@gieochu/db`… |

> File này là đặc tả và chỉ dẫn làm việc cho Claude Code. Đọc toàn bộ file trước khi viết dòng code đầu tiên.
> Ngôn ngữ giao diện: tiếng Việt. Tên biến, hàm, bảng, commit message: tiếng Anh.

---

## 0. Vai trò và cách làm việc

Bạn là kỹ sư full-stack chính của dự án. Nhiệm vụ: xây **hạ tầng nền tảng và các chức năng cơ bản của MVP giai đoạn 1** theo đặc tả dưới đây.

Quy trình bắt buộc:

1. **Lập kế hoạch trước.** Đọc hết file, sau đó tạo `docs/PLAN.md` liệt kê thứ tự module, các file sẽ tạo và các câu hỏi còn mở. Dừng lại để người dùng xác nhận kế hoạch trước khi code.
2. **Làm theo từng module**, đúng thứ tự ở mục 10. Mỗi module xong phải: viết test, chạy `pnpm lint && pnpm typecheck && pnpm test`, cập nhật tài liệu, rồi mới sang module tiếp theo.
3. **Tạo `CLAUDE.md`** ở root ngay ở bước M0, ghi lại quy ước code, lệnh chạy, cấu trúc thư mục và các quy tắc bảo mật ở mục 7, để các phiên làm việc sau luôn tuân thủ.
4. **Luôn vẽ lại sơ đồ.** Duy trì `docs/ARCHITECTURE.md` gồm sơ đồ kiến trúc tổng thể và `docs/modules/<module>.md` gồm sơ đồ xử lý chi tiết của từng module (Mermaid). Khi code thay đổi luồng xử lý, cập nhật sơ đồ trong cùng commit. Các sơ đồ trong file này là bản khởi đầu, phải được chép sang `docs/` và giữ đồng bộ với code.
5. **Không làm phần ngoài phạm vi** (mục 2.2 và mục 12). Nếu thấy cần, ghi vào `docs/BACKLOG.md`.
6. **Khi đặc tả mơ hồ**, chọn phương án an toàn và đơn giản nhất, ghi quyết định vào `docs/DECISIONS.md` (định dạng ADR ngắn). Nếu quyết định ảnh hưởng tới tiền, bảo mật hoặc dữ liệu cá nhân thì hỏi lại người dùng.
7. **Kiểm tra tài liệu chính thức** trước khi tích hợp bên thứ ba (SePay, MoMo, Neon, Prisma, Next.js). Các payload và endpoint trong file này là mô tả tham khảo, không phải nguồn sự thật.
8. Commit nhỏ, theo Conventional Commits (`feat(auth): ...`, `test(orders): ...`).

---

## 1. Bối cảnh sản phẩm

Nền tảng SaaS cho phép **giáo viên, coach, chuyên gia giáo dục/đào tạo** (gọi là **Tenant Owner**) mở một "trang social tài liệu" riêng để:

- Bán tài liệu số: template, slide bài giảng, ebook, bộ đề, tài liệu nâng cao.
- Cấu hình giá gốc, giá ưu đãi, mã giảm giá.
- Đăng bài dạng social để giới thiệu và chia sẻ về tài liệu.
- Nhận thanh toán **trực tiếp vào tài khoản của chính họ** (QR thủ công, SePay, MoMo).
- Quản lý đơn hàng và khách hàng của riêng mình.

**Customer** đăng ký tài khoản, kích hoạt qua email, hoàn thiện hồ sơ, mua tài liệu, tải xuống, xem lịch sử đơn và đánh giá tài liệu đã mua.

**System (Platform)** cung cấp hạ tầng, quản lý toàn bộ user, gói dịch vụ subscription, CMS trang giới thiệu, nhật ký hoạt động, và thấy **số liệu tổng quan** toàn hệ thống.

### 1.1 Mô hình 3 layer

| Layer | Ai | Làm gì | Không làm gì |
|---|---|---|---|
| **L1 — System** | Platform admin | Quản lý user toàn cục, gói subscription, **thu tiền subscription qua Payment của System**, CMS, audit log, thống kê tổng hợp | Không xem chi tiết đơn hàng, không quản lý khách hàng, không giữ tiền bán tài liệu của tenant |
| **L2 — Tenant** | Tenant owner | Storefront, sản phẩm, giá, khuyến mãi, bài viết, **Payment riêng của tenant**, đơn hàng, khách hàng | Không thấy dữ liệu của tenant khác |
| **L3 — Customer** | Người mua | Mua, tải, xem lịch sử, đánh giá, bình luận | Không thấy dữ liệu của khách khác |

### 1.2 Hai hệ thống thanh toán tách biệt (quan trọng)

| | **Platform Payment** (System) | **Tenant Payment** |
|---|---|---|
| Mục đích | Tenant owner trả phí subscription cho nền tảng | Customer trả tiền mua tài liệu cho tenant |
| Tiền về | Tài khoản của nền tảng | Tài khoản của tenant owner |
| Ai cấu hình | System admin | Tenant owner |
| Đối tượng thanh toán | `SubscriptionInvoice` | `Order` |
| Webhook | `/api/webhooks/platform/{provider}` | `/api/webhooks/tenants/{tenantId}/{provider}` |
| Bảng cấu hình | `platform_payment_configs` | `tenant_payment_configs` |
| Bảng giao dịch | `platform_payment_transactions` | `tenant_payment_transactions` |

Cả hai dùng **chung một thư viện provider** (`packages/payments`) nhưng **không bao giờ dùng chung bảng, secret, hay route**. Mọi hàm xử lý thanh toán nhận tham số `PaymentScope`:

```ts
type PaymentScope =
  | { kind: 'PLATFORM' }
  | { kind: 'TENANT'; tenantId: string };
```

### 1.3 Nhận diện thương hiệu trong sản phẩm

- Tên hiển thị đầy đủ **Gieo Chữ** dùng ở header trang marketing, tiêu đề trang (`<title>`), email, trang đăng nhập/đăng ký và footer storefront của tenant ("Vận hành bởi Gieo Chữ").
- Tên viết tắt **Gieo** dùng cho logo thu gọn, favicon, PWA `short_name`, thông báo đẩy và các vị trí hẹp.
- Slogan xuất hiện ở trang chủ, trang giá, footer và chân email.
- Storefront của tenant **ưu tiên thương hiệu của tenant**; dấu hiệu Gieo Chữ chỉ ở footer, ô checkout ("Thanh toán an toàn qua Gieo Chữ") và email giao dịch.
- Tất cả chuỗi thương hiệu đọc từ một file cấu hình (`packages/config/brand.ts`) kết hợp biến môi trường `APP_NAME`, `APP_SHORT_NAME`, `APP_SLOGAN`; **không hard-code** tên trong component.
- Giọng văn giao diện: gần gũi, tôn trọng người dạy, xưng "bạn".

---

## 2. Phạm vi

### 2.1 Trong phạm vi MVP giai đoạn 1

- M0 Nền móng dự án (monorepo, cấu hình, logger, lỗi, test harness, Docker Compose cho dev)
- M1 Xác thực và định danh (đăng ký, kích hoạt email, đăng nhập, refresh, quên mật khẩu, hoàn thiện hồ sơ)
- M2 System Admin (user, gói, cấu hình platform payment, CMS cơ bản, audit log, dashboard tổng hợp)
- M3 Subscription và Platform Billing
- M4 Tenant Workspace và Storefront (đường dẫn theo slug, **không có tên miền riêng**)
- M5 Sản phẩm và File tài liệu
- M6 Giá và Khuyến mãi
- M7 Cấu hình Tenant Payment
- M8 Checkout và Đơn hàng
- M9 Thư viện, Tải xuống và Link chia sẻ private
- M10 Social Feed và Đánh giá
- M11 Email và Background Jobs
- M12 Audit Log, Thống kê tổng hợp, Báo cáo vi phạm

### 2.2 Ngoài phạm vi (KHÔNG làm ở giai đoạn này)

- Tên miền riêng cho tenant (custom domain), subdomain wildcard
- PDF stamping, watermark
- Nhân viên tenant (staff) với phân quyền chi tiết — schema có sẵn nhưng UI chỉ cho owner
- Bundle, flash sale theo khung giờ, license nhiều người dùng
- Affiliate, email marketing, chat
- Hoàn tiền tự động qua cổng (MVP chỉ ghi nhận hoàn tiền thủ công)
- App mobile, tìm kiếm toàn nền tảng, marketplace chung
- Hoá đơn điện tử

---

## 3. Tech stack và ràng buộc

| Hạng mục | Lựa chọn |
|---|---|
| Runtime | Node.js **>= 20.9** (khuyến nghị 22 LTS) |
| Framework | **Next.js 16.x** App Router (tối thiểu 15; nếu dùng 16 thì dùng `proxy.ts` thay cho `middleware.ts`) |
| Ngôn ngữ | TypeScript `strict: true` |
| Database | **PostgreSQL 16**, host tạm trên **Neon** (`console.neon.tech`) |
| ORM | **Prisma** (bản mới nhất ổn định) + `@prisma/adapter-neon`. `prisma.config.ts` dùng `DIRECT_URL` cho CLI/migrate, runtime dùng `DATABASE_URL` (pooled, hostname có `-pooler`) qua driver adapter |
| Auth token | **`jose`** — access token **15 phút**, refresh token **7 ngày**, xoay vòng |
| Mật khẩu | `argon2` (argon2id) |
| Validation | `zod` (cả env, input API, form) |
| UI | Tailwind CSS + shadcn/ui, `react-hook-form` |
| Object storage | S3-compatible (Cloudflare R2 ở môi trường thật, **MinIO** trong Docker Compose khi dev) qua `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` |
| Background jobs | `pg-boss` (dùng chính Postgres, không cần Redis) |
| Email | Adapter `EmailSender`: Resend (prod) / SMTP → **Mailpit** (dev) |
| QR | Tự build payload **VietQR (EMVCo + CRC16)** + thư viện `qrcode` |
| Logging | `pino` (JSON), mỗi request có `requestId` |
| Unit test | **Jest + ts-jest — đúng 91 test case** (trong `packages/*`) |
| Integration test | **Vitest — đúng 50 test case** (trong `apps/web`) |
| Container | Docker + Docker Compose (Postgres 16 local tùy chọn, MinIO, Mailpit) |
| Package manager | `pnpm` workspaces + Turborepo, scope package `@gieochu/*` |

Ràng buộc:

- Không dùng `localStorage` để giữ token.
- Tiền tệ: **VND, lưu số nguyên** (`Int` cho giá, `BigInt` cho số liệu tổng hợp). Không dùng float.
- Thời gian lưu UTC, hiển thị `Asia/Ho_Chi_Minh`.
- Mọi ID dùng `cuid2` hoặc UUID v7 (chọn một, ghi vào DECISIONS).

---

## 4. Kiến trúc tổng thể

### 4.1 Sơ đồ hệ thống

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
        CORE["core<br/>pricing, order FSM, tokens"]
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

### 4.2 Ranh giới dữ liệu theo layer

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

Nguyên tắc:

- System admin **không có route nào** đọc `orders`, `order_items`, `tenant_customers` của tenant. Dashboard System chỉ đọc `tenant_daily_stats` và bảng của L1.
- Tenant chỉ thấy `tenant_customers` của chính mình (người đã từng đặt đơn tại tenant đó).
- Customer có **một tài khoản toàn cục**, thư viện gom tài liệu đã mua từ mọi tenant.

### 4.3 Phân giải tenant và bảo vệ route

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

**Quy tắc:** `proxy.ts` chỉ dùng để chuyển hướng và gắn header. **Mọi** route handler, server action và server component nhạy cảm phải tự xác thực và phân quyền lại.

### 4.4 Cấu trúc thư mục

```
.
├── apps/
│   └── web/                       # Next.js App Router
│       ├── app/
│       │   ├── (marketing)/       # trang CMS: /, /pricing, /p/[slug]
│       │   ├── (auth)/            # /login, /register, /verify-email, /forgot-password, /reset-password
│       │   ├── account/           # /account/profile, /account/library, /account/orders
│       │   ├── admin/             # System console
│       │   ├── studio/[tenantSlug]/  # Tenant dashboard
│       │   ├── [tenantSlug]/      # Storefront công khai
│       │   └── api/
│       ├── proxy.ts
│       ├── lib/                   # server-only helpers: session, guards, actions
│       ├── components/
│       └── tests/integration/     # Vitest (50 case)
├── packages/
│   ├── auth/        # jose, argon2, token, RBAC      (Jest)
│   ├── core/        # pricing, order FSM, slug, code (Jest)
│   ├── payments/    # providers + VietQR             (Jest)
│   ├── db/          # prisma schema, client, withTenant, RLS SQL
│   ├── storage/     # S3 presign
│   ├── email/       # templates + sender
│   ├── jobs/        # pg-boss workers
│   └── config/      # env schema (zod), eslint, tsconfig
├── docker/
│   └── docker-compose.yml         # postgres(optional), minio, mailpit
├── docs/
│   ├── ARCHITECTURE.md
│   ├── PLAN.md
│   ├── DECISIONS.md
│   ├── BACKLOG.md
│   └── modules/
├── CLAUDE.md
└── turbo.json
```

---

## 5. Mô hình dữ liệu

### 5.1 ERD — Layer System

```mermaid
erDiagram
    USERS ||--|| USER_PROFILES : has
    USERS ||--o{ REFRESH_TOKENS : owns
    USERS ||--o{ VERIFICATION_TOKENS : receives
    USERS ||--o{ TENANT_MEMBERS : joins
    PLANS ||--o{ SUBSCRIPTIONS : defines
    TENANTS ||--o{ SUBSCRIPTIONS : subscribes
    SUBSCRIPTIONS ||--o{ SUBSCRIPTION_INVOICES : bills
    SUBSCRIPTION_INVOICES ||--o{ PLATFORM_PAYMENT_TRANSACTIONS : paid_by
    USERS ||--o{ AUDIT_LOGS : acts

    USERS {
        string id PK
        string email UK
        string passwordHash
        string systemRole "USER or SYSTEM_ADMIN"
        string status "PENDING ACTIVE LOCKED"
        datetime emailVerifiedAt
        datetime profileCompletedAt
        datetime lastLoginAt
    }
    USER_PROFILES {
        string userId PK
        string fullName
        string phone
        string avatarKey
        string occupation
        string province
        datetime consentAt
    }
    REFRESH_TOKENS {
        string id PK
        string userId FK
        string familyId
        string tokenHash UK
        datetime expiresAt
        datetime revokedAt
        string replacedById
        string userAgent
        string ip
    }
    VERIFICATION_TOKENS {
        string id PK
        string userId FK
        string type "EMAIL_VERIFY PASSWORD_RESET"
        string tokenHash UK
        datetime expiresAt
        datetime usedAt
    }
    PLANS {
        string id PK
        string code UK
        string name
        int priceVnd
        string interval "MONTH YEAR"
        int intervalCount
        int maxProducts
        int storageMb
        int maxFileMb
        boolean isActive
    }
    SUBSCRIPTIONS {
        string id PK
        string tenantId FK
        string planId FK
        string status "TRIALING ACTIVE PAST_DUE GRACE EXPIRED CANCELED"
        datetime currentPeriodStart
        datetime currentPeriodEnd
        datetime graceEndsAt
    }
    SUBSCRIPTION_INVOICES {
        string id PK
        string subscriptionId FK
        string code UK
        int amountVnd
        string status "PENDING PAID EXPIRED VOID"
        string provider
        datetime expiresAt
        datetime paidAt
    }
    PLATFORM_PAYMENT_TRANSACTIONS {
        string id PK
        string invoiceId FK
        string provider
        string providerTxnId UK
        int amountVnd
        json rawPayload
        datetime receivedAt
    }
    AUDIT_LOGS {
        string id PK
        string actorId FK
        string scope "PLATFORM or TENANT"
        string tenantId
        string action
        string targetType
        string targetId
        json metadata
        string ip
        datetime createdAt
    }
```

Các bảng L1 khác: `platform_payment_configs` (giống `tenant_payment_configs` nhưng không có `tenantId`), `cms_pages` (`slug`, `title`, `blocks Json`, `status`, `seoTitle`, `seoDescription`), `tenant_daily_stats` (`tenantId`, `date`, `ordersPaid`, `gmvVnd BigInt`, `newCustomers`, `downloads`; unique `tenantId+date`), `abuse_reports`, `system_settings`.

### 5.2 ERD — Layer Tenant và Customer

```mermaid
erDiagram
    TENANTS ||--o{ TENANT_MEMBERS : has
    TENANTS ||--o{ TENANT_PAYMENT_CONFIGS : configures
    TENANTS ||--o{ PRODUCTS : sells
    PRODUCTS ||--o{ PRODUCT_FILES : contains
    TENANTS ||--o{ COUPONS : offers
    TENANTS ||--o{ ORDERS : receives
    ORDERS ||--|{ ORDER_ITEMS : includes
    ORDERS ||--o{ TENANT_PAYMENT_TRANSACTIONS : paid_by
    TENANTS ||--o{ TENANT_CUSTOMERS : knows
    USERS ||--o{ TENANT_CUSTOMERS : is
    USERS ||--o{ ORDERS : places
    ORDER_ITEMS ||--|| ENTITLEMENTS : grants
    ENTITLEMENTS ||--o{ DOWNLOAD_EVENTS : logs
    PRODUCTS ||--o{ SHARE_LINKS : shared_via
    TENANTS ||--o{ POSTS : publishes
    POSTS ||--o{ COMMENTS : has
    PRODUCTS ||--o{ REVIEWS : rated_by

    TENANTS {
        string id PK
        string slug UK
        string ownerId FK
        string name
        string bio
        string logoKey
        string coverKey
        json branding "primaryColor, accentColor, socialLinks"
        string orderCodePrefix UK
        string status "ACTIVE READ_ONLY LOCKED"
        int storageUsedBytes
    }
    TENANT_MEMBERS {
        string tenantId FK
        string userId FK
        string role "OWNER STAFF"
    }
    TENANT_PAYMENT_CONFIGS {
        string id PK
        string tenantId FK
        string provider "MANUAL_QR SEPAY MOMO"
        boolean isEnabled
        json publicConfig "bankBin, accountNo, accountName"
        string encryptedSecrets
        string webhookSecretHash
        datetime lastVerifiedAt
    }
    PRODUCTS {
        string id PK
        string tenantId FK
        string slug
        string title
        string description
        string type "TEMPLATE SLIDE EBOOK EXAM OTHER"
        int priceVnd
        int salePriceVnd
        datetime saleStartsAt
        datetime saleEndsAt
        int downloadLimit
        string status "DRAFT PUBLISHED ARCHIVED"
        float ratingAvg
        int ratingCount
    }
    PRODUCT_FILES {
        string id PK
        string productId FK
        string tenantId FK
        string objectKey
        string fileName
        string mimeType
        int sizeBytes
        string sha256
        string scanStatus "PENDING CLEAN REJECTED"
        boolean isPreview
    }
    COUPONS {
        string id PK
        string tenantId FK
        string code
        string type "PERCENT FIXED"
        int value
        int maxDiscountVnd
        int minOrderVnd
        int usageLimit
        int usedCount
        int perCustomerLimit
        datetime startsAt
        datetime endsAt
        json productIds
    }
    ORDERS {
        string id PK
        string tenantId FK
        string customerId FK
        string code UK
        string status "PENDING PAID FULFILLED EXPIRED CANCELED REFUNDED"
        int subtotalVnd
        int discountVnd
        int totalVnd
        string couponCode
        string provider
        string proofImageKey
        datetime expiresAt
        datetime paidAt
    }
    ORDER_ITEMS {
        string id PK
        string orderId FK
        string productId FK
        string titleSnapshot
        int unitPriceVnd
        int finalPriceVnd
    }
    TENANT_PAYMENT_TRANSACTIONS {
        string id PK
        string tenantId FK
        string orderId FK
        string provider
        string providerTxnId
        int amountVnd
        string matchStatus "MATCHED UNMATCHED MISMATCH_AMOUNT"
        json rawPayload
    }
    TENANT_CUSTOMERS {
        string tenantId FK
        string userId FK
        int ordersCount
        int totalSpentVnd
        datetime firstOrderAt
        datetime lastOrderAt
        string note
    }
    ENTITLEMENTS {
        string id PK
        string userId FK
        string tenantId FK
        string productId FK
        string orderItemId FK
        int downloadsUsed
        int downloadLimit
        datetime revokedAt
    }
    SHARE_LINKS {
        string id PK
        string tenantId FK
        string productId FK
        string tokenHash UK
        string label
        string passwordHash
        int maxUses
        int usedCount
        datetime expiresAt
        datetime revokedAt
    }
    DOWNLOAD_EVENTS {
        string id PK
        string tenantId FK
        string fileId FK
        string entitlementId
        string shareLinkId
        string userId
        string ip
        datetime createdAt
    }
    POSTS {
        string id PK
        string tenantId FK
        string authorId FK
        string body
        json media
        string productId
        string status "DRAFT PUBLISHED HIDDEN"
        int likeCount
        int commentCount
    }
    COMMENTS {
        string id PK
        string tenantId FK
        string postId FK
        string userId FK
        string body
        string status "VISIBLE HIDDEN"
    }
    REVIEWS {
        string id PK
        string tenantId FK
        string productId FK
        string userId FK
        string orderItemId FK
        int rating
        string body
        string ownerReply
        string status "VISIBLE HIDDEN"
    }
```

Bảng phụ: `post_likes` (unique `postId+userId`), `coupon_redemptions` (`couponId`, `userId`, `orderId`), `webhook_events` (idempotency: unique `scope+provider+providerEventId`).

### 5.3 Ràng buộc dữ liệu bắt buộc

- Unique: `products(tenantId, slug)`, `coupons(tenantId, code)`, `reviews(orderItemId)`, `tenant_customers(tenantId, userId)`, `tenant_members(tenantId, userId)`, `tenant_payment_transactions(tenantId, provider, providerTxnId)`.
- Index: mọi bảng L2 có index bắt đầu bằng `tenantId`; `orders(tenantId, status, createdAt)`, `orders(customerId, createdAt)`, `audit_logs(createdAt)`, `audit_logs(tenantId, createdAt)`.
- `order_items` lưu **snapshot** tiêu đề và giá tại thời điểm mua.
- Không xoá cứng sản phẩm đã có đơn: chuyển `ARCHIVED`. Customer đã mua vẫn tải được.
- `audit_logs` chỉ `INSERT`, không `UPDATE/DELETE` (enforce bằng quyền DB hoặc trigger).

### 5.4 Row-Level Security (RLS)

Tạo migration SQL thủ công trong `packages/db/prisma/migrations/*_rls/`:

- `ENABLE ROW LEVEL SECURITY` và `FORCE ROW LEVEL SECURITY` cho mọi bảng L2 có `tenant_id`.
- Policy: cho phép khi `tenant_id = current_setting('app.tenant_id', true)` **hoặc** `current_setting('app.scope', true) = 'customer'` kết hợp cột chủ sở hữu (`user_id`, hoặc `customer_id` ở bảng `orders`) `= current_setting('app.user_id', true)` (cho các bảng customer được đọc: `orders`, `entitlements`, `reviews`) **hoặc** `current_setting('app.scope', true) = 'public'` cho dữ liệu công khai (`products` PUBLISHED, `posts` PUBLISHED, `reviews` VISIBLE) **hoặc** `current_setting('app.scope', true) = 'system_job'` (chỉ worker tổng hợp số liệu và webhook).
- Helper trong `packages/db`:

```ts
export function withTenant<T>(tenantId: string, fn: (tx: Tx) => Promise<T>): Promise<T>;
export function withCustomer<T>(userId: string, fn: (tx: Tx) => Promise<T>): Promise<T>;
export function withPublic<T>(fn: (tx: Tx) => Promise<T>): Promise<T>;
export function withSystemJob<T>(fn: (tx: Tx) => Promise<T>): Promise<T>;
// Mỗi hàm mở $transaction và gọi SELECT set_config('app.xxx', $1, true)
// (is_local = true vì Neon dùng connection pooler)
```

- Lint rule / code review: cấm import Prisma client "trần" trong `apps/web` ngoài các helper trên (dùng ESLint `no-restricted-imports`).

---

## 6. Quy ước API và code

- **Server Actions** cho form trong dashboard; **Route Handlers** (`/api/...`) cho webhook, download, upload presign, và các API cần gọi từ client.
- Mọi input đi qua `zod`. Response lỗi thống nhất:

```json
{ "error": { "code": "COUPON_EXPIRED", "message": "Mã giảm giá đã hết hạn", "requestId": "..." } }
```

- Mã lỗi là hằng số trong `packages/core/src/errors.ts` (`AppError` có `code`, `httpStatus`, `expose`).
- Phân trang dạng cursor (`?cursor=&limit=`), `limit` tối đa 50.
- Mọi thao tác thay đổi dữ liệu quan trọng ghi `audit_logs` qua `audit.log({...})`.
- Rate limit (bảng `rate_limits` trên Postgres hoặc in-memory cho dev): đăng nhập, đăng ký, gửi lại email, quên mật khẩu, tạo đơn, tải xuống, nhập mật khẩu share link.
- Không log mật khẩu, token, secret, số tài khoản đầy đủ (mask còn 4 số cuối).

## 7. Quy tắc bảo mật (ghi vào CLAUDE.md)

1. Access token và refresh token chỉ nằm trong cookie `httpOnly`, `Secure` (prod), `SameSite=Lax`. Refresh cookie có `Path=/api/auth`.
2. Chỉ lưu **hash SHA-256** của refresh token, token kích hoạt, token reset, token share link, token download.
3. Secret của cổng thanh toán (cả platform và tenant) mã hoá **AES-256-GCM** bằng `PAYMENT_ENCRYPTION_KEY` (32 byte, base64) trước khi lưu. Không bao giờ trả secret về client; UI chỉ hiển thị dạng `••••abcd`.
4. Webhook: xác thực chữ ký/API key **trước** khi parse nghiệp vụ; so sánh bằng `timingSafeEqual`; idempotent qua `webhook_events`; trả 2xx nhanh, xử lý nặng đẩy sang job.
5. Không tin số tiền, trạng thái từ client. Tổng tiền đơn luôn tính lại ở server.
6. File trong bucket **private**. URL tải chỉ là presigned, sống ≤ 10 phút, gắn `Content-Disposition: attachment`.
7. Server Actions kiểm tra CSRF bằng cơ chế sẵn có của Next.js; Route Handler thay đổi dữ liệu kiểm tra header `Origin`.
8. CSP, `X-Content-Type-Options`, `Referrer-Policy` cấu hình trong `next.config`.
9. System admin không có đường truy cập chi tiết đơn hàng/khách hàng của tenant.

---

## 8. Đặc tả chi tiết từng module

Mỗi module gồm: mục tiêu, chức năng, trang/API, quy tắc nghiệp vụ, sơ đồ xử lý, tiêu chí nghiệm thu và danh sách test. Số test ghi trong từng module **cộng lại đúng 91 unit và 50 integration**; không thêm, không bớt nếu chưa hỏi.

---

### M0 — Nền móng dự án

**Mục tiêu:** Có monorepo chạy được, cấu hình an toàn, test harness sẵn sàng.

**Chức năng:**

- pnpm workspaces + Turborepo; scripts: `dev`, `build`, `lint`, `typecheck`, `test`, `test:unit`, `test:integration`, `db:migrate`, `db:seed`.
- `packages/config`: env schema bằng zod, fail-fast khi thiếu biến (xem mục 11).
- `packages/core/errors.ts`: `AppError`, mã lỗi, mapper sang HTTP.
- Logger `pino` có redact (`password`, `token`, `secret`, `authorization`, `cookie`).
- `docker/docker-compose.yml`: `minio` (+ job tạo bucket), `mailpit`, `postgres:16` (profile `local-db`, dùng khi không muốn gọi Neon).
- Prisma: `prisma.config.ts`, client dùng `@prisma/adapter-neon`; seed tạo 1 system admin, 3 plan mẫu, 1 trang CMS home.
- Jest (`ts-jest`) cho `packages/*`; Vitest cho `apps/web` với DB test riêng (Neon branch hoặc Postgres container) và reset schema trước mỗi file test.
- CI mẫu (GitHub Actions): install → lint → typecheck → unit → integration.

**Sơ đồ:**

```mermaid
flowchart LR
    DEV["pnpm dev"] --> DC["docker compose up<br/>minio, mailpit"]
    DEV --> ENV["Kiểm tra env bằng zod"]
    ENV -- "thiếu biến" --> FAIL["Dừng, in lỗi rõ ràng"]
    ENV -- "hợp lệ" --> MIG["prisma migrate deploy<br/>qua DIRECT_URL"]
    MIG --> SEED["prisma db seed"]
    SEED --> RUN["next dev + pg-boss worker"]
```

**Nghiệm thu:** `pnpm i && pnpm dev` chạy được với `.env.example` đã điền; `pnpm test` chạy cả hai bộ test.

**Test — Unit (4):**
1. Env schema chấp nhận cấu hình hợp lệ.
2. Env schema báo lỗi khi thiếu biến bắt buộc.
3. `AppError` serialize không lộ thông tin nội bộ khi `expose=false`.
4. Logger redact các trường nhạy cảm.

**Test — Integration (0).**

---

### M1 — Xác thực và định danh

**Mục tiêu:** Đăng ký, kích hoạt qua email, đăng nhập an toàn với JWT xoay vòng, bắt buộc hoàn thiện hồ sơ.

**Chức năng:**

- Đăng ký (email, mật khẩu, họ tên, đồng ý điều khoản và xử lý dữ liệu cá nhân) → `status=PENDING` → gửi email kích hoạt.
- Kích hoạt: link `/verify-email?token=...`, token 24 giờ, dùng một lần. Gửi lại email (rate limit 3 lần / giờ).
- Đăng nhập: chỉ `ACTIVE`; `PENDING` nhận thông báo kèm nút gửi lại email; `LOCKED` bị từ chối.
- Access token (JWT, 15 phút) claims: `sub`, `sid` (id refresh family), `role`, `ver`(emailVerified), `pc`(profileCompleted), `iss`, `aud`, `iat`, `exp`. Thuật toán HS256 với `JWT_ACCESS_SECRET` (hoặc EdDSA nếu muốn, ghi ADR).
- Refresh token: chuỗi ngẫu nhiên 32 byte, 7 ngày, lưu hash, **xoay vòng mỗi lần dùng**; phát hiện dùng lại token đã bị thay → thu hồi toàn bộ family.
- Đăng xuất: thu hồi family hiện tại. "Đăng xuất mọi thiết bị" trong trang hồ sơ.
- Quên mật khẩu / đặt lại: token 30 phút; đặt lại thành công → thu hồi mọi refresh token.
- Hồ sơ bắt buộc: `fullName`, `phone`, `occupation` (giáo viên, coach, học viên, phụ huynh, khác), `province`. Khi chưa đủ, mọi trang `/account/*`, `/studio/*` và checkout chuyển về `/account/profile?complete=1`.
- Đổi mật khẩu, đổi avatar (upload qua M5 storage helper, prefix `avatars/`).

**Trang / API:**

| Loại | Đường dẫn |
|---|---|
| Trang | `/register`, `/login`, `/verify-email`, `/forgot-password`, `/reset-password`, `/account/profile`, `/account/security` |
| API | `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/refresh`, `POST /api/auth/logout`, `POST /api/auth/verify-email`, `POST /api/auth/resend-verification`, `POST /api/auth/forgot-password`, `POST /api/auth/reset-password`, `GET /api/me` |

**Quy tắc:** email chuẩn hoá lowercase + trim; mật khẩu ≥ 8 ký tự, có chữ và số; thông báo lỗi đăng nhập chung chung ("Email hoặc mật khẩu không đúng"); forgot-password luôn trả 200.

**Sơ đồ — Đăng ký và kích hoạt:**

```mermaid
sequenceDiagram
    actor U as User
    participant W as Web /register
    participant A as API auth
    participant DB as Postgres
    participant J as pg-boss
    participant M as Email

    U->>W: Nhập email, mật khẩu, họ tên, đồng ý điều khoản
    W->>A: POST /api/auth/register
    A->>A: zod validate, normalize email, rate limit
    A->>DB: Tạo user PENDING + profile + consentAt
    A->>DB: Tạo verification token (hash, 24h)
    A->>J: enqueue email.verify
    A-->>W: 201 "Kiểm tra email"
    J->>M: Gửi email chứa link kích hoạt
    U->>W: Click link /verify-email?token
    W->>A: POST /api/auth/verify-email
    A->>DB: Tìm token theo hash, kiểm tra hạn và usedAt
    alt Hợp lệ
        A->>DB: usedAt = now, user ACTIVE, emailVerifiedAt = now
        A-->>W: Thành công, chuyển tới /login
    else Hết hạn hoặc đã dùng
        A-->>W: Lỗi + nút gửi lại email
    end
```

**Sơ đồ — Đăng nhập, refresh và phát hiện tái sử dụng token:**

```mermaid
sequenceDiagram
    actor U as User
    participant B as Browser
    participant A as API auth
    participant DB as Postgres

    U->>B: Đăng nhập
    B->>A: POST /api/auth/login
    A->>DB: Lấy user, argon2 verify, kiểm tra status
    A->>DB: Tạo refresh token (familyId mới)
    A-->>B: Set-Cookie access (15m) + refresh (7d)

    Note over B,A: Access token hết hạn
    B->>A: POST /api/auth/refresh (cookie refresh)
    A->>DB: Tìm token theo hash
    alt Token hợp lệ, chưa bị thay
        A->>DB: Tạo token mới cùng familyId, token cũ replacedById
        A-->>B: Set-Cookie cặp token mới
    else Token đã bị thay hoặc thu hồi
        A->>DB: Thu hồi toàn bộ family
        A->>DB: Ghi audit AUTH_REFRESH_REUSE
        A-->>B: 401 + xoá cookie
    else Hết hạn
        A-->>B: 401 + xoá cookie
    end
```

**Sơ đồ — Chặn hoàn thiện hồ sơ:**

```mermaid
flowchart TD
    REQ["Vào /account, /studio hoặc checkout"] --> V{"Đã đăng nhập?"}
    V -- "Không" --> L["Chuyển /login?next=..."]
    V -- "Có" --> E{"Email đã xác minh?"}
    E -- "Chưa" --> VE["Trang nhắc kích hoạt + gửi lại"]
    E -- "Rồi" --> P{"profileCompletedAt có giá trị?"}
    P -- "Chưa" --> PF["/account/profile?complete=1"]
    P -- "Rồi" --> OK["Cho phép truy cập"]
    PF -- "Lưu đủ trường bắt buộc" --> SET["Cập nhật profileCompletedAt<br/>cấp lại access token"] --> OK
```

**Nghiệm thu:** Toàn bộ luồng chạy với Mailpit; cookie đúng thuộc tính; token cũ dùng lại bị thu hồi family.

**Test — Unit (16):**
1. Hash và verify mật khẩu đúng.
2. Verify thất bại với mật khẩu sai.
3. Access token có `exp` = 15 phút và đủ claims.
4. Verify từ chối token hết hạn.
5. Verify từ chối token sai chữ ký, sai `iss` hoặc `aud`.
6. Sinh refresh token ngẫu nhiên và hash đúng.
7. Rotation tạo token mới, đánh dấu token cũ `replacedById`.
8. Dùng lại token đã bị thay → thu hồi cả family.
9. Refresh token hết hạn bị từ chối.
10. Verification token có hạn 24 giờ và chỉ lưu hash.
11. Verification token chỉ dùng được một lần.
12. Verification token hết hạn bị từ chối.
13. Chính sách mật khẩu.
14. Chuẩn hoá email.
15. Hàm kiểm tra hồ sơ đầy đủ.
16. Ma trận quyền `can(role, action)`.

**Test — Integration (8):**
1. Đăng ký tạo user `PENDING` và enqueue email.
2. Đăng ký trùng email → 409.
3. Link kích hoạt chuyển user sang `ACTIVE`.
4. Đăng nhập khi chưa kích hoạt bị chặn.
5. Đăng nhập thành công set đúng hai cookie.
6. Refresh xoay vòng cookie; dùng lại refresh cũ bị thu hồi family.
7. Reset mật khẩu thu hồi mọi phiên.
8. Chưa hoàn thiện hồ sơ bị chuyển hướng khỏi `/account/library`.

---

### M2 — System Admin Console

**Mục tiêu:** Quản trị viên nền tảng quản lý user, gói, cấu hình thanh toán của System, CMS và theo dõi hệ thống.

**Chức năng:**

- **Dashboard:** tổng user (theo trạng thái), tổng tenant (active / read-only / locked), subscription theo trạng thái, **doanh thu subscription của nền tảng** (từ `subscription_invoices` PAID), **GMV tổng hợp của các tenant** (từ `tenant_daily_stats`), biểu đồ 30 ngày.
- **Users:** tìm kiếm, lọc, xem hồ sơ cơ bản, khoá / mở khoá (khoá → thu hồi mọi refresh token), gửi lại email kích hoạt, cấp quyền `SYSTEM_ADMIN` (chỉ super admin đầu tiên từ seed).
- **Tenants:** danh sách, gói hiện tại, trạng thái, dung lượng đã dùng, số sản phẩm, GMV tổng hợp; khoá / mở khoá tenant; **không có** màn hình đơn hàng hay khách hàng của tenant.
- **Plans:** CRUD gói (giá, chu kỳ `MONTH`/`YEAR` với `intervalCount`, giới hạn sản phẩm, dung lượng, kích thước file tối đa), bật/tắt gói.
- **Platform Payment:** cấu hình SePay / MoMo / QR thủ công **của nền tảng** (dùng lại form và provider của M7 với `scope=PLATFORM`); danh sách hoá đơn subscription; xác nhận thủ công hoá đơn QR.
- **CMS:** trang giới thiệu dạng block JSON (`hero`, `features`, `pricingTable` lấy từ bảng `plans`, `faq`, `richText`, `cta`), trạng thái nháp/xuất bản, SEO title/description. Route công khai `/`, `/pricing`, `/p/[slug]`.
- **Audit log viewer:** lọc theo actor, action, tenant, khoảng thời gian.
- **Báo cáo vi phạm:** xem và xử lý (ẩn sản phẩm, khoá tenant) — xem M12.
- **System settings:** tên nền tảng, email hỗ trợ, thời hạn trial, số ngày grace.

**Sơ đồ — Nguồn dữ liệu của Admin Console:**

```mermaid
flowchart LR
    subgraph Admin["/admin"]
        D["Dashboard"]
        UU["Users"]
        TT["Tenants"]
        PL["Plans"]
        PP["Platform Payment"]
        CM["CMS"]
        AL["Audit log"]
    end
    D --> S1[("users, tenants<br/>subscriptions")]
    D --> S2[("subscription_invoices PAID")]
    D --> S3[("tenant_daily_stats")]
    UU --> S1
    TT --> S1
    TT --> S3
    PL --> S4[("plans")]
    PP --> S5[("platform_payment_configs<br/>subscription_invoices")]
    CM --> S6[("cms_pages")]
    AL --> S7[("audit_logs")]
    X[("orders, tenant_customers")] -.-|"KHÔNG truy cập"| Admin
```

**Sơ đồ — Khoá user:**

```mermaid
flowchart TD
    A["Admin bấm Khoá"] --> C{"Là chính mình<br/>hoặc super admin?"}
    C -- "Có" --> X["Từ chối"]
    C -- "Không" --> T["Transaction:<br/>status LOCKED<br/>revoke mọi refresh token"]
    T --> AU["audit USER_LOCKED + lý do"]
    AU --> O{"User là tenant owner?"}
    O -- "Có" --> TL["Gợi ý admin khoá tenant (không tự động)"]
    O -- "Không" --> DONE["Hoàn tất"]
    TL --> DONE
```

**Nghiệm thu:** Admin thao tác đủ các màn hình; user thường gọi API admin nhận 403; không có endpoint admin nào trả dữ liệu đơn hàng chi tiết.

**Test — Unit (4):**
1. Mapper tổng hợp số liệu dashboard.
2. Validation gói (chu kỳ, giới hạn không âm).
3. Validation schema block CMS.
4. Quyết định khoá user kéo theo thu hồi phiên.

**Test — Integration (4):**
1. Non-admin gọi `/api/admin/*` → 403.
2. Khoá user thu hồi phiên và chặn đăng nhập.
3. Tạo gói mới hiển thị trên `/pricing`.
4. API dashboard chỉ trả số liệu tổng hợp, không có dữ liệu cá nhân của khách tenant.

---

### M3 — Subscription và Platform Billing

**Mục tiêu:** Tenant owner dùng thử, đăng ký gói, thanh toán qua **Platform Payment**, hệ thống tự gia hạn trạng thái và áp giới hạn gói.

**Chức năng:**

- Tạo tenant → subscription `TRIALING` (số ngày trial từ system settings, gói mặc định).
- Trang `/studio/[slug]/billing`: gói hiện tại, ngày hết hạn, dung lượng đã dùng, lịch sử hoá đơn, nút "Gia hạn / Nâng cấp".
- Tạo `SubscriptionInvoice` (mã `SUB` + chuỗi ngẫu nhiên 8 ký tự in hoa, hạn thanh toán 24 giờ), chọn phương thức platform đang bật:
  - QR thủ công / SePay: hiển thị VietQR với nội dung = mã hoá đơn; SePay webhook tự khớp.
  - MoMo: tạo link thanh toán, nhận IPN.
- Khi hoá đơn `PAID`:
  - Subscription còn hiệu lực → kỳ mới bắt đầu từ `currentPeriodEnd` cũ.
  - Subscription đã hết → kỳ mới bắt đầu từ thời điểm thanh toán.
  - Đổi gói: áp dụng gói mới ngay khi thanh toán (MVP **không tính proration**, ghi rõ trên UI).
- Job hằng giờ `subscription.sweep`: `ACTIVE/TRIALING` quá hạn → `GRACE` (N ngày) → `EXPIRED`; tenant `EXPIRED` → `READ_ONLY`.
- Email nhắc: 7 ngày, 1 ngày trước hết hạn; khi vào grace; khi hết hạn.
- **Áp giới hạn** qua `assertPlanLimit(tenantId, 'products' | 'storage' | 'fileSize')` tại M5.
- Tenant `READ_ONLY`: storefront vẫn hiển thị, **customer đã mua vẫn tải được**, nhưng không tạo đơn mới, không đăng sản phẩm/bài viết mới.

**Sơ đồ — Trạng thái subscription:**

```mermaid
stateDiagram-v2
    [*] --> TRIALING: Tạo tenant
    TRIALING --> ACTIVE: Hoá đơn PAID
    TRIALING --> GRACE: Hết trial
    ACTIVE --> ACTIVE: Gia hạn PAID
    ACTIVE --> GRACE: Quá currentPeriodEnd
    GRACE --> ACTIVE: Hoá đơn PAID
    GRACE --> EXPIRED: Quá graceEndsAt
    EXPIRED --> ACTIVE: Hoá đơn PAID
    ACTIVE --> CANCELED: Owner huỷ gia hạn
    CANCELED --> EXPIRED: Quá currentPeriodEnd
```

**Sơ đồ — Thanh toán hoá đơn subscription qua Platform Payment:**

```mermaid
sequenceDiagram
    actor O as Tenant Owner
    participant S as Studio billing
    participant B as Billing service
    participant P as packages/payments scope PLATFORM
    participant G as SePay / MoMo (tài khoản nền tảng)
    participant WH as Webhook platform
    participant DB as Postgres

    O->>S: Chọn gói, bấm Thanh toán
    S->>B: createInvoice(tenantId, planId, provider)
    B->>DB: SubscriptionInvoice PENDING, code SUBxxxxxxxx
    B->>P: createCheckout(invoice)
    P-->>S: QR VietQR hoặc payUrl MoMo
    O->>G: Chuyển khoản / thanh toán
    G->>WH: Webhook / IPN
    WH->>P: verify chữ ký bằng secret PLATFORM
    WH->>DB: Ghi webhook_events (unique) — trùng thì trả 200 và dừng
    WH->>DB: Tìm invoice theo code, so khớp số tiền
    alt Khớp
        WH->>DB: invoice PAID + platform_payment_transactions
        WH->>DB: Cập nhật subscription và tenant ACTIVE
        WH->>DB: audit SUBSCRIPTION_PAID
    else Lệch số tiền hoặc không tìm thấy
        WH->>DB: Lưu giao dịch UNMATCHED để admin xử lý
    end
    WH-->>G: 200
    S->>B: Polling trạng thái mỗi 3 giây
    B-->>S: PAID → hiển thị thành công
```

**Nghiệm thu:** Trial → trả tiền qua sandbox/mô phỏng webhook → ACTIVE; job chuyển GRACE/EXPIRED đúng; READ_ONLY chặn đúng hành động.

**Test — Unit (10):**
1. Tính kỳ theo tháng, kể cả ngày cuối tháng (31/01 → 28 hoặc 29/02).
2. Tính kỳ theo năm.
3. Định dạng mã hoá đơn.
4. Chuyển trạng thái subscription hợp lệ.
5. Chuyển trạng thái không hợp lệ ném lỗi.
6. Tính `graceEndsAt`.
7. Kiểm tra giới hạn số sản phẩm.
8. Kiểm tra giới hạn dung lượng.
9. Gia hạn khi còn hiệu lực nối tiếp từ `currentPeriodEnd`.
10. Gia hạn sau khi hết hạn bắt đầu từ ngày thanh toán.

**Test — Integration (5):**
1. Tạo tenant sinh subscription `TRIALING`.
2. Tạo hoá đơn + webhook platform SePay → `PAID`, subscription `ACTIVE`.
3. Webhook trùng được xử lý idempotent.
4. Job sweep chuyển `GRACE` rồi `EXPIRED`, tenant `READ_ONLY`.
5. Tenant `READ_ONLY` không đăng sản phẩm mới, nhưng customer cũ vẫn tải được.

---

### M4 — Tenant Workspace và Storefront

**Mục tiêu:** Tenant owner tạo "trang social tài liệu" riêng với thương hiệu riêng, truy cập qua đường dẫn slug.

**Đường dẫn (không có tên miền riêng ở MVP):**

- Storefront công khai: `/{tenantSlug}` (feed + sản phẩm), `/{tenantSlug}/products/{productSlug}`, `/{tenantSlug}/posts/{postId}`, `/{tenantSlug}/checkout/{orderCode}`.
- Dashboard: `/studio/{tenantSlug}/...`.
- Danh sách slug cấm: `admin, studio, account, api, login, register, verify-email, forgot-password, reset-password, pricing, p, s, _next, static, assets, help, support, terms, privacy` và các route tĩnh khác (tạo hằng số dùng chung).

**Chức năng:**

- Onboarding "Mở trang của bạn": tên trang, slug (tự gợi ý từ tên, bỏ dấu tiếng Việt), lĩnh vực, mô tả ngắn. Mỗi user tối đa 1 tenant ở MVP (ghi ADR).
- Sinh `orderCodePrefix` duy nhất 3–4 ký tự in hoa (dùng làm tiền tố mã đơn và bộ lọc mã thanh toán SePay).
- Cấu hình thương hiệu: logo, ảnh bìa, màu chủ đạo, màu nhấn (hex), giới thiệu, liên kết mạng xã hội (Facebook, YouTube, TikTok, Zalo, website). Storefront áp màu qua CSS variables.
- Trang cài đặt: đổi tên, mô tả, **đổi slug** (tối đa 1 lần / 30 ngày, lưu `tenant_slug_history` để redirect 301).
- Dashboard tổng quan tenant: doanh thu 30 ngày, số đơn chờ xác nhận, sản phẩm bán chạy, đánh giá mới.
- Storefront: header thương hiệu, tab **Bài viết** / **Tài liệu** / **Đánh giá**, SEO metadata và Open Graph theo tenant, `sitemap` cho sản phẩm và bài viết đã xuất bản.
- Trạng thái tenant: `ACTIVE`, `READ_ONLY` (banner "tạm ngưng bán"), `LOCKED` (404 với khách, owner thấy thông báo).
- Bảng `tenant_members` có role `OWNER`/`STAFF` nhưng MVP chỉ dùng `OWNER`.

**Sơ đồ — Onboarding tenant:**

```mermaid
flowchart TD
    S["User đã xác minh và đủ hồ sơ"] --> H{"Đã có tenant?"}
    H -- "Có" --> GO["Vào /studio/slug"]
    H -- "Chưa" --> F["Form: tên, slug, lĩnh vực, mô tả"]
    F --> SL["slugify bỏ dấu, kiểm tra reserved và unique"]
    SL -- "Trùng" --> SUG["Gợi ý slug-2, slug-3"] --> F
    SL -- "Hợp lệ" --> TX["Transaction"]
    TX --> T1["Tạo tenant ACTIVE + orderCodePrefix"]
    T1 --> T2["tenant_members OWNER"]
    T2 --> T3["subscription TRIALING"]
    T3 --> T4["audit TENANT_CREATED"]
    T4 --> W["Wizard: thương hiệu → thanh toán → sản phẩm đầu tiên"]
    W --> GO
```

**Sơ đồ — Render storefront:**

```mermaid
flowchart TD
    R["GET /tenantSlug"] --> F{"Slug có trong<br/>tenant_slug_history?"}
    F -- "Có" --> RD["301 sang slug mới"]
    F -- "Không" --> T{"Tenant tồn tại?"}
    T -- "Không" --> NF["404"]
    T -- "Có" --> ST{"Trạng thái"}
    ST -- "LOCKED" --> NF
    ST -- "READ_ONLY" --> RO["Render + banner, ẩn nút mua"]
    ST -- "ACTIVE" --> RN["Render đầy đủ"]
    RO --> Q["withPublic: products PUBLISHED,<br/>posts PUBLISHED, reviews VISIBLE"]
    RN --> Q
    Q --> BR["Áp branding qua CSS variables<br/>generateMetadata theo tenant"]
```

**Nghiệm thu:** Tạo tenant, đổi thương hiệu, storefront hiển thị đúng; RLS chặn truy vấn chéo tenant.

**Test — Unit (6):**
1. Slugify tiếng Việt (ví dụ "Cô Hạnh Toán 9" → `co-hanh-toan-9`).
2. Slug nằm trong danh sách cấm bị từ chối.
3. Sinh `orderCodePrefix` đúng định dạng.
4. Validate màu hex và liên kết mạng xã hội.
5. Chính sách truy cập storefront theo trạng thái tenant.
6. Kiểm tra vai trò thành viên tenant.

**Test — Integration (5):**
1. Tạo tenant sinh membership OWNER và subscription trial.
2. Slug trùng → 409.
3. Owner tenant A truy cập `/studio/B` → 403.
4. RLS: trong `withTenant(A)`, truy vấn `products where tenantId = B` trả rỗng.
5. Storefront chỉ hiển thị sản phẩm `PUBLISHED`.

---

### M5 — Sản phẩm và File tài liệu

**Mục tiêu:** Tenant tải tài liệu lên an toàn, tạo trang sản phẩm, xuất bản.

**Chức năng:**

- CRUD sản phẩm: tiêu đề, slug, loại (`TEMPLATE`, `SLIDE`, `EBOOK`, `EXAM`, `OTHER`), mô tả (rich text đã sanitize), ảnh bìa, cấp học/môn học (tag tự do), giá gốc, giá ưu đãi và khung thời gian (M6), giới hạn lượt tải mặc định (mặc định 5, `0` = không giới hạn — ghi ADR).
- Nhiều file cho một sản phẩm; đánh dấu file **preview** (công khai, ví dụ ảnh hoặc PDF vài trang do tenant tự tải) và file **bán** (private).
- Định dạng cho phép: `pdf, docx, doc, pptx, ppt, xlsx, xls, zip, png, jpg, jpeg, mp4`. Kiểm tra cả phần mở rộng và magic bytes (`file-type`).
- Upload trực tiếp từ trình duyệt lên storage bằng presigned PUT; file > 50 MB dùng multipart. Kích thước tối đa theo gói.
- Sau khi upload: API `complete` xác nhận object tồn tại (`HeadObject`), ghi `product_files` với `scanStatus=PENDING`, enqueue `file.scan`.
- Job `file.scan`: kiểm tra magic bytes, tính `sha256`; nếu cấu hình `CLAMAV_HOST` thì quét virus (nếu không có thì đánh dấu `CLEAN` và ghi cảnh báo trong log — ghi ADR). `REJECTED` → xoá object, thông báo owner.
- Cập nhật `storageUsedBytes` của tenant; chặn upload khi vượt dung lượng gói.
- Trạng thái sản phẩm `DRAFT → PUBLISHED → ARCHIVED` (có thể `ARCHIVED → DRAFT`). Xuất bản yêu cầu: có ít nhất 1 file bán `CLEAN`, có ảnh bìa, giá hợp lệ, tenant `ACTIVE`, chưa vượt giới hạn số sản phẩm.
- Xoá file của sản phẩm đã có người mua: chỉ ẩn khỏi danh sách mới, **không xoá object** (customer cũ vẫn tải được).
- Object key: `tenants/{tenantId}/products/{productId}/{fileId}/{sanitizedFileName}`.

**API:** `POST /api/studio/{slug}/uploads/presign`, `POST /api/studio/{slug}/uploads/complete`, server actions cho CRUD sản phẩm.

**Sơ đồ — Upload file tài liệu:**

```mermaid
sequenceDiagram
    actor O as Tenant Owner
    participant UI as Studio product editor
    participant API as Upload API
    participant DB as Postgres
    participant S3 as R2 / MinIO private
    participant J as Worker file.scan

    O->>UI: Chọn file
    UI->>API: POST presign (tên, size, mime)
    API->>API: requireTenantMember, kiểm tra định dạng
    API->>DB: assertPlanLimit storage và fileSize
    API-->>UI: presigned PUT URL (10 phút) + uploadId
    UI->>S3: PUT file trực tiếp
    UI->>API: POST complete (uploadId)
    API->>S3: HeadObject kiểm tra tồn tại và size
    API->>DB: product_files PENDING, cộng storageUsedBytes
    API->>J: enqueue file.scan
    J->>S3: Đọc phần đầu file, kiểm tra magic bytes, sha256
    alt Hợp lệ
        J->>DB: scanStatus CLEAN
    else Không hợp lệ
        J->>S3: Xoá object
        J->>DB: scanStatus REJECTED, trừ dung lượng
        J->>DB: Tạo thông báo cho owner
    end
    UI->>API: Polling trạng thái file
```

**Sơ đồ — Vòng đời sản phẩm:**

```mermaid
stateDiagram-v2
    [*] --> DRAFT
    DRAFT --> PUBLISHED: Đủ điều kiện xuất bản
    PUBLISHED --> DRAFT: Owner gỡ xuống (chưa có đơn)
    PUBLISHED --> ARCHIVED: Owner lưu trữ
    ARCHIVED --> DRAFT: Owner khôi phục
    note right of ARCHIVED
        Không bán mới
        Customer đã mua vẫn tải được
    end note
```

**Nghiệm thu:** Upload file lớn qua multipart; file giả mạo đuôi bị từ chối; không xuất bản được khi thiếu điều kiện.

**Test — Unit (6):**
1. Kiểm tra định dạng theo đuôi và magic bytes.
2. Kích thước tối đa theo gói.
3. Sinh object key đúng định dạng và sanitize tên file.
4. Gợi ý slug sản phẩm khi trùng trong tenant.
5. Điều kiện xuất bản sản phẩm.
6. Tính lại `storageUsedBytes` khi thêm và xoá file.

**Test — Integration (4):**
1. Presign chỉ trả URL cho owner của tenant.
2. `complete` ghi `product_files` và enqueue job quét.
3. Xuất bản thất bại khi chưa có file `CLEAN`.
4. Lưu trữ sản phẩm không ảnh hưởng quyền tải của người đã mua.

---

### M6 — Giá và Khuyến mãi

**Mục tiêu:** Một **pricing engine thuần** (không phụ thuộc DB) trong `packages/core/pricing` dùng chung cho storefront, checkout và kiểm tra lại ở webhook.

**Chức năng:**

- Giá gốc `priceVnd` (≥ 0; `0` = tài liệu miễn phí).
- Giá ưu đãi `salePriceVnd` với `saleStartsAt`/`saleEndsAt` tùy chọn; chỉ hợp lệ khi nhỏ hơn giá gốc. Storefront hiển thị giá gạch ngang và % giảm, đếm ngược nếu có `saleEndsAt`.
- Coupon: `PERCENT` hoặc `FIXED`; `maxDiscountVnd`, `minOrderVnd`, `usageLimit`, `perCustomerLimit`, `startsAt`/`endsAt`, giới hạn theo danh sách sản phẩm; bật/tắt.
- Coupon chỉ bị "tiêu thụ" (`usedCount++`, `coupon_redemptions`) khi đơn chuyển `PAID`, dùng `UPDATE ... WHERE usedCount < usageLimit` để chống vượt giới hạn khi đồng thời. Nếu hết lượt ngay lúc thanh toán: vẫn ghi nhận đơn `PAID` (khách đã trả tiền) và ghi audit `COUPON_OVERUSED` để owner biết.
- Trang quản lý coupon trong studio, thống kê số lần dùng.
- Làm tròn: số nguyên VND, giảm theo % làm tròn xuống.

**Hàm chính:**

```ts
calculatePrice(input: {
  items: { productId: string; priceVnd: number; salePriceVnd?: number | null;
           saleStartsAt?: Date | null; saleEndsAt?: Date | null }[];
  coupon?: CouponSnapshot | null;
  customerUsageCount: number;
  now: Date;
}): { lines: PricedLine[]; subtotalVnd: number; discountVnd: number; totalVnd: number;
      couponError?: CouponErrorCode }
```

**Sơ đồ — Tính giá:**

```mermaid
flowchart TD
    I["Danh sách sản phẩm + coupon + now"] --> L["Với từng dòng"]
    L --> SW{"Có salePrice nhỏ hơn giá gốc<br/>và now trong khung sale?"}
    SW -- "Có" --> UP1["unit = salePrice"]
    SW -- "Không" --> UP2["unit = price"]
    UP1 --> SUB["Cộng subtotal"]
    UP2 --> SUB
    SUB --> C{"Có coupon?"}
    C -- "Không" --> T["total = subtotal"]
    C -- "Có" --> V1{"Đang bật, trong thời hạn?"}
    V1 -- "Không" --> E1["couponError EXPIRED"] --> T
    V1 -- "Có" --> V2{"Còn lượt tổng và lượt theo khách?"}
    V2 -- "Không" --> E2["couponError LIMIT_REACHED"] --> T
    V2 -- "Có" --> V3{"Đạt minOrder và<br/>có sản phẩm áp dụng?"}
    V3 -- "Không" --> E3["couponError NOT_APPLICABLE"] --> T
    V3 -- "Có" --> D["Tính giảm trên các dòng áp dụng<br/>PERCENT làm tròn xuống, cap maxDiscount<br/>FIXED không vượt tổng dòng"]
    D --> T2["total = max(0, subtotal - discount)"]
```

**Test — Unit (14):**
1. Giá gốc khi không có sale.
2. Giá sale khi đang trong khung.
3. Bỏ qua giá sale khi ngoài khung.
4. Bỏ qua giá sale không nhỏ hơn giá gốc.
5. Coupon phần trăm.
6. Coupon số tiền cố định.
7. Giới hạn `maxDiscountVnd`.
8. Không đạt `minOrderVnd`.
9. Coupon chưa bắt đầu hoặc đã hết hạn.
10. Hết lượt dùng tổng.
11. Hết lượt dùng theo khách.
12. Coupon chỉ áp cho sản phẩm được chọn.
13. Tổng không âm và làm tròn đúng.
14. Đơn tổng 0 đồng (tài liệu miễn phí hoặc giảm 100%).

**Test — Integration (2):**
1. API áp mã trả về tổng tiền đã tính lại ở server.
2. Coupon chỉ bị tính lượt khi đơn `PAID`, và hai đơn đồng thời không vượt `usageLimit`.

---

### M7 — Cấu hình Tenant Payment (và thư viện provider dùng chung)

**Mục tiêu:** Tenant owner tự cấu hình phương thức nhận tiền của riêng mình. Thư viện `packages/payments` phục vụ cả **Platform** (M3) và **Tenant** (M8).

**Interface provider:**

```ts
export interface PaymentProvider {
  readonly id: 'MANUAL_QR' | 'SEPAY' | 'MOMO';
  validateConfig(input: unknown): ProviderConfig;              // zod
  testConnection?(cfg: DecryptedConfig): Promise<TestResult>;
  createCheckout(args: {
    scope: PaymentScope; cfg: DecryptedConfig;
    reference: string;            // order.code hoặc invoice.code
    amountVnd: number; description: string;
    returnUrl: string; notifyUrl: string;
  }): Promise<CheckoutResult>;    // { kind: 'QR', qrPayload, qrImageDataUrl, bank, accountNo, content }
                                  // | { kind: 'REDIRECT', url }
  verifyWebhook(req: RawWebhookRequest, cfg: DecryptedConfig): Promise<boolean>;
  parseWebhook(body: unknown): NormalizedPaymentEvent;
  // { providerEventId, reference?, amountVnd, occurredAt, success, raw }
}
```

**Chi tiết từng provider (xác minh lại với tài liệu chính thức trước khi code):**

- **MANUAL_QR**
  - Cấu hình: ngân hàng (chọn từ danh sách BIN, seed từ nguồn VietQR và lưu trong DB), số tài khoản, tên chủ tài khoản.
  - `createCheckout` sinh **payload VietQR EMVCo** (dynamic QR, có số tiền và nội dung = mã đơn), tính CRC16-CCITT, render ảnh bằng `qrcode`.
  - Không có webhook; owner xác nhận thủ công. Khách có thể tải ảnh biên lai (tùy chọn).
- **SEPAY**
  - Cấu hình: thông tin tài khoản nhận (để sinh QR như MANUAL_QR), kiểu xác thực webhook (`API_KEY` hoặc `HMAC_SHA256`), secret tương ứng, tiền tố mã thanh toán (= `orderCodePrefix` của tenant hoặc `SUB` với platform).
  - UI hiển thị **URL webhook riêng** để owner dán vào trang quản trị SePay: `{APP_URL}/api/webhooks/tenants/{tenantId}/sepay`.
  - Webhook: xác thực header theo kiểu đã chọn; chỉ xử lý giao dịch tiền **vào**; lấy mã tham chiếu từ trường mã thanh toán hoặc tìm bằng regex tiền tố trong nội dung chuyển khoản; `providerEventId` = id giao dịch SePay. SePay có retry nhiều lần khi lỗi, nên **bắt buộc idempotent**.
  - Trả `200` với body JSON theo yêu cầu của SePay.
- **MOMO**
  - Cấu hình: `partnerCode`, `accessKey`, `secretKey`, môi trường `sandbox|production`.
  - `createCheckout`: gọi API tạo giao dịch, chữ ký HMAC-SHA256 trên chuỗi tham số theo thứ tự quy định, trả `payUrl`.
  - IPN `{APP_URL}/api/webhooks/tenants/{tenantId}/momo`: verify chữ ký bằng `secretKey`, `resultCode = 0` là thành công, `providerEventId = transId`.
  - `testConnection`: gọi API truy vấn trạng thái với một mã giả, chấp nhận phản hồi "không tìm thấy" là kết nối hợp lệ.

**Chức năng studio `/studio/{slug}/settings/payments`:**

- Bật/tắt từng phương thức; ít nhất một phương thức bật thì mới cho phép xuất bản sản phẩm có giá > 0.
- Lưu secret: mã hoá AES-256-GCM (`iv:tag:ciphertext` base64), chỉ hiển thị 4 ký tự cuối.
- Nút "Kiểm tra kết nối" và "Gửi webhook thử" (tạo sự kiện mô phỏng với chữ ký hợp lệ trong môi trường dev).
- Mọi thay đổi ghi audit `PAYMENT_CONFIG_UPDATED` (không ghi secret).

**Sơ đồ — Lưu cấu hình thanh toán:**

```mermaid
flowchart TD
    F["Owner gửi form cấu hình"] --> A["requireTenantMember OWNER"]
    A --> V["provider.validateConfig (zod)"]
    V -- "Lỗi" --> ER["Trả lỗi theo trường"]
    V -- "Hợp lệ" --> SP["Tách publicConfig và secrets"]
    SP --> EN["AES-256-GCM encrypt secrets"]
    EN --> UP["Upsert tenant_payment_configs<br/>(tenantId, provider)"]
    UP --> AU["audit PAYMENT_CONFIG_UPDATED"]
    AU --> TC{"Owner bấm kiểm tra?"}
    TC -- "Có" --> T["provider.testConnection"] --> LV["Cập nhật lastVerifiedAt"]
    TC -- "Không" --> RS["Trả về cấu hình đã mask"]
    LV --> RS
```

**Sơ đồ — Chọn provider theo scope:**

```mermaid
flowchart LR
    EV["Sự kiện thanh toán / checkout"] --> SC{"PaymentScope"}
    SC -- "PLATFORM" --> PC[("platform_payment_configs")]
    SC -- "TENANT tenantId" --> TCF[("tenant_payment_configs<br/>where tenantId")]
    PC --> DEC["decrypt secrets"]
    TCF --> DEC
    DEC --> REG["providerRegistry.get(provider)"]
    REG --> Q["MANUAL_QR"]
    REG --> SE["SEPAY"]
    REG --> MO["MOMO"]
```

**Test — Unit (10):**
1. Mã hoá/giải mã AES-256-GCM khứ hồi.
2. Ciphertext bị sửa → giải mã thất bại.
3. Payload VietQR khớp mẫu đã biết.
4. CRC16-CCITT đúng.
5. SePay xác thực API key.
6. SePay xác thực HMAC-SHA256.
7. SePay parse payload và trích mã tham chiếu theo tiền tố.
8. MoMo tạo chữ ký khớp mẫu.
9. MoMo verify chữ ký IPN.
10. Provider registry chọn đúng provider và scope.

**Test — Integration (4):**
1. Owner lưu cấu hình SePay: secret được mã hoá trong DB, response chỉ có bản mask.
2. Người không phải owner → 403.
3. Phương thức đang tắt không xuất hiện ở checkout.
4. Webhook tenant ký bằng secret của platform bị từ chối (và ngược lại).

---

### M8 — Checkout và Đơn hàng

**Mục tiêu:** Customer đặt mua, thanh toán vào tài khoản của tenant, nhận quyền tải; tenant quản lý đơn hàng và khách hàng của riêng mình.

**Chức năng phía customer:**

- Nút "Mua ngay" trên trang sản phẩm (MVP: **mỗi đơn 1 sản phẩm**; schema `order_items` đã hỗ trợ nhiều dòng cho giỏ hàng sau này).
- Yêu cầu đăng nhập, email đã xác minh, hồ sơ đầy đủ.
- Chặn mua lại sản phẩm đã có entitlement còn hiệu lực (chuyển tới thư viện). Chặn owner mua sản phẩm của chính mình.
- Trang checkout `/{tenantSlug}/checkout/{orderCode}`: tóm tắt đơn, ô nhập coupon, chọn phương thức (các phương thức tenant đang bật), đồng hồ đếm ngược hết hạn.
- Đơn **tổng 0 đồng** → chuyển thẳng `PAID` rồi `FULFILLED`.
- QR (thủ công hoặc SePay): hiển thị QR, số tài khoản, nội dung chuyển khoản = mã đơn, nút sao chép; polling trạng thái mỗi 3 giây.
- MoMo: chuyển sang `payUrl`; trang return chỉ hiển thị "đang xác nhận" và polling, **không tin tham số trên URL**.
- Mã đơn: `{orderCodePrefix}{6 ký tự base32 in hoa không gây nhầm lẫn}` (ví dụ `HAN7K2QXM`).
- Đơn `PENDING` hết hạn sau 60 phút (cấu hình được); khách có thể tạo đơn mới.

**Chức năng phía tenant (`/studio/{slug}/orders`, `/customers`):**

- Danh sách đơn: lọc theo trạng thái, phương thức, thời gian; tìm theo mã đơn/email.
- Chi tiết đơn: dòng sản phẩm (snapshot), coupon, giao dịch liên quan, ảnh biên lai.
- **Xác nhận thanh toán thủ công** (chỉ đơn `PENDING` hoặc `EXPIRED` trong vòng 24 giờ; bắt buộc nhập ghi chú).
- **Hủy** đơn `PENDING`. **Đánh dấu hoàn tiền** (`REFUNDED`, thu hồi entitlement, việc chuyển tiền trả lại do owner làm ngoài hệ thống).
- Xử lý giao dịch `UNMATCHED` / `MISMATCH_AMOUNT`: gán thủ công vào đơn.
- Khách hàng: danh sách `tenant_customers` (tên, email, số đơn, tổng chi, lần mua gần nhất), ghi chú nội bộ, xem các đơn của khách đó **tại tenant này**. Xuất CSV.
- Thông báo trong studio khi có đơn mới / đơn được thanh toán.

**Sơ đồ — Trạng thái đơn hàng:**

```mermaid
stateDiagram-v2
    [*] --> PENDING: Tạo đơn
    PENDING --> PAID: Webhook khớp / owner xác nhận / tổng 0đ
    PENDING --> EXPIRED: Quá expiresAt
    PENDING --> CANCELED: Khách hoặc owner huỷ
    EXPIRED --> PAID: Owner xác nhận muộn (trong 24h)
    PAID --> FULFILLED: Cấp entitlement + gửi email
    FULFILLED --> REFUNDED: Owner đánh dấu hoàn tiền
    note right of FULFILLED
        Thu hồi entitlement
        khi chuyển REFUNDED
    end note
```

**Sơ đồ — Checkout với SePay (tiền về tài khoản tenant):**

```mermaid
sequenceDiagram
    actor C as Customer
    participant SF as Storefront
    participant OS as Order service
    participant PR as Pricing engine
    participant PAY as packages/payments scope TENANT
    participant BANK as Ngân hàng của tenant
    participant SP as SePay (tài khoản tenant)
    participant WH as Webhook tenant sepay
    participant DB as Postgres
    participant J as pg-boss

    C->>SF: Mua ngay
    SF->>OS: createOrder(productId, coupon)
    OS->>DB: withTenant đọc sản phẩm, coupon, entitlement hiện có
    OS->>PR: calculatePrice (tính lại ở server)
    OS->>DB: orders PENDING + order_items snapshot + expiresAt
    OS->>PAY: createCheckout(reference = order.code)
    PAY-->>SF: VietQR payload + thông tin tài khoản
    C->>BANK: Quét QR, chuyển khoản nội dung = mã đơn
    BANK-->>SP: Biến động số dư
    SP->>WH: POST webhook
    WH->>DB: Lấy tenant_payment_configs, decrypt
    WH->>PAY: verifyWebhook
    alt Chữ ký sai
        WH-->>SP: 401
    else Hợp lệ
        WH->>DB: Insert webhook_events (trùng → 200, dừng)
        WH->>J: enqueue payment.process
        WH-->>SP: 200
    end
    J->>DB: Tìm order theo code trong tenant
    J->>J: So số tiền với totalVnd
    alt Khớp và order PENDING hoặc EXPIRED gần đây
        J->>DB: Transaction gồm order PAID, transaction MATCHED, coupon redeem, upsert tenant_customers
        J->>DB: Tạo entitlements, order FULFILLED
        J->>J: enqueue email.order-paid (khách) và email.new-sale (owner)
    else Lệch hoặc không tìm thấy
        J->>DB: transaction MISMATCH_AMOUNT hoặc UNMATCHED, thông báo owner
    end
    SF->>OS: Polling trạng thái
    OS-->>SF: FULFILLED → nút "Vào thư viện"
```

**Sơ đồ — Xác nhận thủ công (QR thủ công):**

```mermaid
flowchart TD
    A["Owner mở đơn PENDING"] --> B["Đối chiếu sao kê ngân hàng của mình"]
    B --> C{"Đã nhận đúng tiền?"}
    C -- "Chưa" --> W["Chờ hoặc Huỷ đơn"]
    C -- "Rồi" --> D["Bấm Xác nhận + nhập ghi chú"]
    D --> E["Kiểm tra quyền OWNER và trạng thái hợp lệ"]
    E --> F["Chạy chung hàm markOrderPaid<br/>(giống nhánh webhook)"]
    F --> G["audit ORDER_MANUALLY_CONFIRMED"]
```

**Quy tắc quan trọng:** chỉ có **một** hàm `markOrderPaid(tx, orderId, source)` được gọi bởi webhook SePay, IPN MoMo, xác nhận thủ công và đơn 0 đồng. Hàm này idempotent (đơn đã `PAID/FULFILLED` thì không làm gì).

**Test — Unit (10):**
1. Chuyển trạng thái đơn hợp lệ.
2. Chuyển trạng thái không hợp lệ ném lỗi.
3. Định dạng mã đơn có tiền tố tenant.
4. Tính `expiresAt`.
5. Số tiền khớp chính xác → `MATCHED`.
6. Số tiền lệch → `MISMATCH_AMOUNT`.
7. Tổng tiền tính lại, bỏ qua giá client gửi lên.
8. Chặn mua sản phẩm đã sở hữu hoặc của chính mình.
9. Cập nhật số liệu `tenant_customers` (upsert, cộng dồn).
10. Xác nhận thủ công chỉ cho trạng thái hợp lệ.

**Test — Integration (8):**
1. Tạo đơn QR thủ công trả về QR và trạng thái `PENDING`.
2. Owner xác nhận → `PAID`/`FULFILLED`, có entitlement, enqueue email.
3. Webhook SePay của tenant khớp đơn → `FULFILLED`.
4. Webhook trùng được xử lý idempotent.
5. Sai số tiền → đơn vẫn `PENDING`, giao dịch `MISMATCH_AMOUNT`.
6. IPN MoMo thành công → `FULFILLED`.
7. Job hết hạn chuyển `EXPIRED`, coupon không bị tính lượt.
8. Tenant A không xem được đơn tenant B; customer chỉ xem được đơn của mình.

---

### M9 — Thư viện, Tải xuống và Link chia sẻ private

**Mục tiêu:** Customer tải tài liệu đã mua an toàn; tenant tạo link tải private có kiểm soát.

**Chức năng phía customer (`/account/library`, `/account/orders`):**

- Thư viện gom mọi entitlement của user **từ tất cả tenant**, nhóm theo tenant, tìm kiếm theo tên.
- Mỗi tài liệu: danh sách file, số lượt tải còn lại, nút tải, link tới trang đánh giá.
- Lịch sử đơn hàng: mã đơn, tenant, sản phẩm, số tiền, trạng thái, thời gian; mở lại trang checkout cho đơn `PENDING`.

**Luồng tải của customer:**

- `POST /api/downloads` với `fileId` → kiểm tra entitlement (chưa thu hồi, còn lượt, file thuộc sản phẩm của entitlement, file `CLEAN`) → tạo **download token** (hash, sống 60 giây, dùng một lần) → trả URL `/api/downloads/{token}`.
- `GET /api/downloads/{token}` → tiêu thụ token, tăng `downloadsUsed` (atomic), ghi `download_events`, redirect 302 tới presigned GET (≤ 10 phút, `Content-Disposition: attachment; filename*=UTF-8''...`).
- Rate limit: 20 lượt / 10 phút mỗi user.
- Tenant có thể **cấp thêm lượt** hoặc **thu hồi** entitlement của một khách (audit).

**Link chia sẻ private (tenant):**

- `/studio/{slug}/products/{id}/share-links`: tạo link với nhãn, hạn dùng, số lượt tối đa, mật khẩu tùy chọn, chọn file cụ thể hoặc tất cả file bán.
- Token 32 byte, chỉ hiển thị **một lần** khi tạo; DB lưu hash. URL: `{APP_URL}/s/{token}`.
- Trang `/s/{token}`: hiển thị tên tài liệu và tenant, ô mật khẩu (nếu có), nút tải từng file. Không yêu cầu đăng nhập.
- Thu hồi link bất kỳ lúc nào; xem thống kê lượt tải theo link.
- Link thuộc tenant `LOCKED` hoặc sản phẩm có file bị `REJECTED` không hoạt động.
- `s` được thêm vào danh sách slug cấm.

**Sơ đồ — Tải tài liệu đã mua:**

```mermaid
sequenceDiagram
    actor C as Customer
    participant L as /account/library
    participant D as Download API
    participant DB as Postgres
    participant S3 as R2 / MinIO

    C->>L: Bấm Tải file
    L->>D: POST /api/downloads (fileId)
    D->>D: requireUser + rate limit
    D->>DB: withCustomer đọc entitlement, file, tenant status
    alt Không hợp lệ
        D-->>L: 403 hoặc 429 kèm lý do
    else Hợp lệ
        D->>DB: Tạo download token (hash, 60 giây)
        D-->>L: URL /api/downloads/token
        L->>D: GET /api/downloads/token
        D->>DB: Tiêu thụ token, downloadsUsed + 1 có điều kiện còn lượt
        D->>DB: Ghi download_events
        D->>S3: Presign GET 10 phút, attachment
        D-->>C: 302 tới presigned URL
        C->>S3: Tải file
    end
```

**Sơ đồ — Link chia sẻ private:**

```mermaid
flowchart TD
    O["Owner tạo link"] --> G["Sinh token 32 byte<br/>lưu hash, hiển thị một lần"]
    G --> SH["Owner gửi link /s/token"]
    SH --> V["Người nhận mở link"]
    V --> H["Tra share_links theo hash"]
    H --> C1{"Tồn tại và chưa thu hồi?"}
    C1 -- "Không" --> X1["410 Link không còn hiệu lực"]
    C1 -- "Có" --> C2{"Còn hạn và còn lượt?"}
    C2 -- "Không" --> X1
    C2 -- "Có" --> C3{"Có mật khẩu?"}
    C3 -- "Có" --> PW["Nhập mật khẩu, argon2 verify, rate limit"]
    PW -- "Sai" --> PW
    PW -- "Đúng" --> DL["Chọn file"]
    C3 -- "Không" --> DL
    DL --> INC["usedCount + 1 có điều kiện<br/>ghi download_events"]
    INC --> PS["302 presigned GET"]
```

**Test — Unit (7):**
1. Download token: sinh, hash và TTL.
2. Kiểm tra giới hạn lượt tải.
3. Entitlement bị thu hồi bị từ chối.
4. Share link hết hạn.
5. Share link hết lượt.
6. Xác thực mật khẩu share link.
7. Tuỳ chọn presign có `attachment` và TTL ≤ 600 giây.

**Test — Integration (5):**
1. Thư viện liệt kê tài liệu từ nhiều tenant.
2. Tải thành công: redirect, tăng lượt, ghi log.
3. Vượt giới hạn lượt bị chặn.
4. Share link có mật khẩu hoạt động đúng.
5. Share link đã thu hồi trả 410.

---

### M10 — Social Feed và Đánh giá

**Mục tiêu:** Tenant đăng nội dung dạng mạng xã hội để giới thiệu tài liệu; customer bình luận, thả tim và đánh giá tài liệu đã mua.

**Chức năng:**

- **Bài viết (tenant):** nội dung văn bản (markdown giới hạn, sanitize), tối đa 6 ảnh (upload qua storage, bucket public-read riêng hoặc prefix public), gắn 1 sản phẩm (hiển thị thẻ sản phẩm có nút mua), trạng thái `DRAFT/PUBLISHED/HIDDEN`, ghim bài.
- **Feed storefront:** bài mới nhất trước, phân trang cursor, thẻ sản phẩm kèm giá hiện tại.
- **Bình luận:** user đã đăng nhập, đã xác minh; 1 cấp trả lời; owner ẩn/hiện bình luận; rate limit.
- **Thả tim:** toggle, `post_likes` unique.
- **Đánh giá:** chỉ user có `order_items` thuộc đơn `FULFILLED` của sản phẩm đó; **mỗi order item một đánh giá**; 1–5 sao + nội dung; sửa trong 7 ngày; owner trả lời 1 lần, ẩn đánh giá vi phạm (ghi audit, không xoá). Huy hiệu "Đã mua".
- Cập nhật `ratingAvg`, `ratingCount` của sản phẩm khi đánh giá thay đổi (trong cùng transaction).
- Nút "Báo cáo" trên bài viết, bình luận, sản phẩm, đánh giá (M12).
- **Theo dõi tenant** (follow) để sau này gửi thông báo — MVP chỉ lưu quan hệ và hiển thị số người theo dõi.

**Sơ đồ — Điều kiện đánh giá:**

```mermaid
flowchart TD
    A["User bấm Đánh giá sản phẩm"] --> B{"Đã đăng nhập và xác minh?"}
    B -- "Không" --> LG["Yêu cầu đăng nhập"]
    B -- "Có" --> C{"Có order_item của sản phẩm<br/>trong đơn FULFILLED?"}
    C -- "Không" --> NO["Chỉ người đã mua mới được đánh giá"]
    C -- "Có" --> D{"order_item đã có review?"}
    D -- "Có" --> ED{"Trong 7 ngày?"}
    ED -- "Có" --> EDIT["Cho phép sửa"]
    ED -- "Không" --> LOCK["Chỉ xem"]
    D -- "Không" --> NEW["Tạo review 1-5 sao"]
    NEW --> AGG["Tính lại ratingAvg, ratingCount"]
    EDIT --> AGG
```

**Sơ đồ — Đăng bài và hiển thị feed:**

```mermaid
sequenceDiagram
    actor O as Tenant Owner
    participant ST as Studio posts
    participant DB as Postgres
    actor V as Người xem
    participant SF as Storefront feed

    O->>ST: Soạn bài, tải ảnh, gắn sản phẩm
    ST->>DB: withTenant tạo post DRAFT hoặc PUBLISHED
    V->>SF: Mở /tenantSlug
    SF->>DB: withPublic posts PUBLISHED theo cursor
    SF->>DB: Lấy giá hiện tại của sản phẩm gắn kèm
    SF-->>V: Feed + thẻ sản phẩm + số tim, bình luận
    V->>SF: Thả tim hoặc bình luận (cần đăng nhập)
```

**Test — Unit (4):**
1. Điều kiện được phép đánh giá.
2. Số sao hợp lệ (1–5).
3. Tính lại điểm trung bình khi thêm/sửa/ẩn đánh giá.
4. Sanitize nội dung bài viết và bình luận.

**Test — Integration (3):**
1. Tạo bài viết và xuất hiện trên feed công khai.
2. Người chưa mua không đánh giá được; người đã mua đánh giá được đúng một lần.
3. Owner ẩn bình luận, bình luận biến mất khỏi feed.

---

### M11 — Email và Background Jobs

**Mục tiêu:** Mọi tác vụ chậm hoặc cần thử lại chạy nền qua `pg-boss`.

**Danh sách job:**

| Job | Kích hoạt | Việc làm |
|---|---|---|
| `email.send` | enqueue | Render template (React Email hoặc template string), gửi qua adapter, retry 5 lần với backoff |
| `file.scan` | sau upload | Xem M5 |
| `payment.process` | sau webhook | Xem M8 / M3 |
| `order.expire` | cron mỗi 5 phút | `PENDING` quá hạn → `EXPIRED` |
| `invoice.expire` | cron mỗi 15 phút | Hoá đơn subscription quá hạn → `EXPIRED` |
| `subscription.sweep` | cron mỗi giờ | Xem M3 |
| `subscription.remind` | cron hằng ngày 8:00 giờ VN | Email nhắc gia hạn |
| `stats.aggregate` | cron mỗi giờ + 00:15 hằng ngày | Cập nhật `tenant_daily_stats` |
| `tokens.cleanup` | cron hằng ngày | Xoá token hết hạn quá 30 ngày |

**Email template (tiếng Việt):** kích hoạt tài khoản, đặt lại mật khẩu, đơn đã thanh toán (kèm link thư viện), có đơn mới (gửi owner), hoá đơn subscription đã thanh toán, nhắc gia hạn, tenant chuyển read-only, file bị từ chối.

**Sơ đồ:**

```mermaid
flowchart LR
    subgraph Producers["Nguồn tạo job"]
        API["API / Server Actions"]
        WH["Webhooks"]
        CRON["pg-boss schedule"]
    end
    Q[("pg-boss queue<br/>trong Postgres")]
    subgraph Workers["Worker process"]
        W1["email.send"]
        W2["file.scan"]
        W3["payment.process"]
        W4["order.expire / invoice.expire"]
        W5["subscription.sweep / remind"]
        W6["stats.aggregate"]
    end
    API --> Q
    WH --> Q
    CRON --> Q
    Q --> W1 & W2 & W3 & W4 & W5 & W6
    W1 --> MAIL["Resend / Mailpit"]
    W2 --> S3["Storage"]
    W3 & W4 & W5 & W6 --> DB[("Postgres")]
    Q -.->|"hết retry"| DLQ["Dead letter + log lỗi"]
```

Worker chạy như process riêng (`pnpm worker`) trong Docker Compose và production. Test M11 được tính trong các module nghiệp vụ tương ứng.

---

### M12 — Audit Log, Thống kê tổng hợp, Báo cáo vi phạm

**Audit log:**

- API `audit.log({ actorId, scope, tenantId?, action, targetType, targetId, metadata, ip, userAgent })`.
- Action tối thiểu: `AUTH_LOGIN`, `AUTH_LOGIN_FAILED`, `AUTH_REFRESH_REUSE`, `USER_LOCKED`, `USER_UNLOCKED`, `TENANT_CREATED`, `TENANT_LOCKED`, `TENANT_SLUG_CHANGED`, `PLAN_UPDATED`, `SUBSCRIPTION_PAID`, `PAYMENT_CONFIG_UPDATED`, `PRODUCT_PUBLISHED`, `PRODUCT_ARCHIVED`, `ORDER_MANUALLY_CONFIRMED`, `ORDER_REFUNDED`, `ENTITLEMENT_REVOKED`, `SHARE_LINK_CREATED`, `SHARE_LINK_REVOKED`, `REVIEW_HIDDEN`, `REPORT_RESOLVED`, `ADMIN_VIEWED_TENANT`.
- Owner xem audit của tenant mình tại `/studio/{slug}/activity`; admin xem toàn bộ tại `/admin/audit`.
- Bảng chỉ INSERT; partition theo tháng (hoặc ghi ADR nếu để sau).

**Thống kê tổng hợp:**

- `stats.aggregate` dùng `withSystemJob`, tính theo ngày giờ Việt Nam: `ordersPaid`, `gmvVnd`, `newCustomers`, `downloads` cho từng tenant, upsert `tenant_daily_stats`.
- Chỉ lưu số liệu, **không** lưu email, tên hay mã đơn.

**Báo cáo vi phạm (tối thiểu để đáp ứng nghĩa vụ gỡ nội dung vi phạm của nền tảng trung gian):**

- Bất kỳ ai cũng gửi được báo cáo (khách vãng lai phải nhập email): loại (`COPYRIGHT`, `INAPPROPRIATE`, `SCAM`, `OTHER`), mô tả, link bằng chứng.
- Admin xử lý tại `/admin/reports`: ẩn nội dung, lưu trữ sản phẩm, khoá tenant, bác bỏ; thông báo email cho người báo cáo và owner.
- Khi đăng sản phẩm, owner phải tích cam kết "Tôi sở hữu hoặc có quyền phân phối tài liệu này".

**Sơ đồ:**

```mermaid
flowchart TD
    subgraph Audit["Audit"]
        ACT["Hành động quan trọng"] --> AL["audit.log"] --> T1[("audit_logs chỉ INSERT")]
    end
    subgraph Stats["Thống kê"]
        CR["cron stats.aggregate"] --> AG["withSystemJob: đếm đơn PAID,<br/>GMV, khách mới, lượt tải"]
        AG --> T2[("tenant_daily_stats")]
        T2 --> AD["Admin dashboard"]
    end
    subgraph Report["Báo cáo vi phạm"]
        RP["Người dùng gửi báo cáo"] --> T3[("abuse_reports OPEN")]
        T3 --> RV["Admin xem xét"]
        RV --> DEC{"Quyết định"}
        DEC -- "Vi phạm" --> ACTN["Ẩn / lưu trữ / khoá tenant"]
        DEC -- "Không vi phạm" --> REJ["Bác bỏ"]
        ACTN --> NT["Email thông báo + audit REPORT_RESOLVED"]
        REJ --> NT
    end
```

**Test — Unit (0).**

**Test — Integration (2):**
1. Các hành động chính sinh audit log và audit log không sửa/xoá được.
2. Job tổng hợp tạo `tenant_daily_stats` không chứa dữ liệu cá nhân, và dashboard admin đọc được.

---

## 9. Kế hoạch test tổng hợp

| Module | Jest unit | Vitest integration |
|---|---:|---:|
| M0 Nền móng | 4 | 0 |
| M1 Auth | 16 | 8 |
| M2 Admin | 4 | 4 |
| M3 Subscription | 10 | 5 |
| M4 Tenant | 6 | 5 |
| M5 Sản phẩm, file | 6 | 4 |
| M6 Giá, khuyến mãi | 14 | 2 |
| M7 Payment config | 10 | 4 |
| M8 Checkout, đơn | 10 | 8 |
| M9 Tải xuống | 7 | 5 |
| M10 Social, đánh giá | 4 | 3 |
| M11–M12 Jobs, audit | 0 | 2 |
| **Tổng** | **91** | **50** |

Quy định:

- Unit test (Jest + ts-jest) nằm trong `packages/*/src/**/*.test.ts`, không truy cập mạng hay DB, dùng fake clock khi cần.
- Integration test (Vitest) nằm trong `apps/web/tests/integration/`, dùng DB thật riêng cho test, mock storage bằng MinIO hoặc stub S3, mock email bằng adapter in-memory, gọi route handler trực tiếp hoặc qua `fetch` tới server test.
- Webhook test tạo payload và chữ ký hợp lệ bằng chính helper của `packages/payments`.
- Mỗi test có tên tiếng Anh mô tả hành vi; đặt `describe` theo module (`M8 orders`).
- Thêm script `pnpm test:count` in số test case của từng bộ để kiểm chứng 91/50.
- Coverage mục tiêu cho `packages/core`, `packages/auth`, `packages/payments`: ≥ 85% lines.

---

## 10. Thứ tự triển khai và Definition of Done

```mermaid
flowchart LR
    M0["M0 Nền móng"] --> M1["M1 Auth"]
    M1 --> M2a["M2 Admin cơ bản<br/>users, plans, CMS"]
    M1 --> M4["M4 Tenant"]
    M7["M7 Payment lib + config"] --> M3["M3 Subscription"]
    M4 --> M3
    M2a --> M3
    M4 --> M5["M5 Sản phẩm, file"]
    M5 --> M6["M6 Giá, khuyến mãi"]
    M6 --> M8["M8 Checkout, đơn"]
    M7 --> M8
    M8 --> M9["M9 Tải xuống"]
    M8 --> M10["M10 Social, đánh giá"]
    M11["M11 Jobs"] -.-> M1
    M11 -.-> M8
    M9 --> M12["M12 Audit, thống kê, báo cáo"]
    M10 --> M12
    M12 --> M2b["M2 Dashboard + platform payment UI"]
```

Gợi ý thứ tự thực tế: M0 → M1 (kèm khung M11 email) → M4 → M2 (phần cơ bản) → M7 → M3 → M5 → M6 → M8 → M9 → M10 → M12 → hoàn thiện M2.

**Definition of Done cho mỗi module:**

- [ ] Code theo đặc tả, không có `any` không cần thiết, không có TODO chưa ghi vào BACKLOG.
- [ ] Đủ số test của module, tất cả xanh.
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm build` thành công.
- [ ] Migration Prisma (và SQL RLS nếu có) đã tạo, chạy được từ DB trống.
- [ ] `docs/modules/<module>.md` có sơ đồ Mermaid cập nhật đúng với code.
- [ ] `docs/ARCHITECTURE.md` cập nhật nếu thay đổi kiến trúc.
- [ ] Giao diện tiếng Việt, responsive trên mobile.
- [ ] Hành động quan trọng đã ghi audit.

---

## 11. Biến môi trường (`.env.example`)

```bash
# App
NODE_ENV=development
APP_URL=http://localhost:3000          # production: https://gieochu.net
APP_NAME="Gieo Chữ"
APP_SHORT_NAME="Gieo"
APP_SLOGAN="Gieo Chữ – Nơi người dạy gieo chữ và chia sẻ học liệu."
TZ_DISPLAY=Asia/Ho_Chi_Minh

# Database (Neon)
DATABASE_URL="postgresql://USER:PASSWORD@ep-xxx-pooler.REGION.aws.neon.tech/DB?sslmode=require"
DIRECT_URL="postgresql://USER:PASSWORD@ep-xxx.REGION.aws.neon.tech/DB?sslmode=require"
TEST_DATABASE_URL=

# Auth
JWT_ACCESS_SECRET=           # >= 32 bytes
JWT_ISSUER=gieochu
JWT_AUDIENCE=gieochu-web
ACCESS_TOKEN_TTL=15m
REFRESH_TOKEN_TTL_DAYS=7
EMAIL_VERIFY_TTL_HOURS=24
PASSWORD_RESET_TTL_MINUTES=30

# Encryption
PAYMENT_ENCRYPTION_KEY=      # 32 bytes base64

# Storage (S3 compatible)
S3_ENDPOINT=http://localhost:9000
S3_REGION=auto
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_BUCKET_PRIVATE=gieochu-private
S3_BUCKET_PUBLIC=gieochu-public
S3_PUBLIC_BASE_URL=
PRESIGN_UPLOAD_TTL_SECONDS=600
PRESIGN_DOWNLOAD_TTL_SECONDS=600
CLAMAV_HOST=

# Email
EMAIL_PROVIDER=smtp          # smtp | resend
EMAIL_FROM="Gieo Chữ <no-reply@gieochu.net>"
SMTP_HOST=localhost
SMTP_PORT=1025
RESEND_API_KEY=

# Business
TRIAL_DAYS=14
GRACE_DAYS=7
ORDER_PENDING_TTL_MINUTES=60
INVOICE_PENDING_TTL_HOURS=24
DEFAULT_DOWNLOAD_LIMIT=5

# Payment sandbox (chỉ dùng cho dev/test)
MOMO_SANDBOX_ENDPOINT=
```

Secret cổng thanh toán của **platform** và **tenant** được nhập qua giao diện và lưu mã hoá trong DB, **không** đặt trong `.env`.

---

## 12. Định hướng sau MVP (chỉ ghi vào BACKLOG, không triển khai)

```mermaid
flowchart LR
    P1["MVP 1<br/>Hạ tầng + bán hàng cơ bản"] --> P2["Giai đoạn 2<br/>Bảo vệ và bán hàng nâng cao"]
    P2 --> P3["Giai đoạn 3<br/>Tăng trưởng"]
    P3 --> P4["Giai đoạn 4<br/>Chuyên sâu và mở rộng"]
```

| Giai đoạn | Hạng mục đề xuất | Ghi chú kỹ thuật |
|---|---|---|
| **2 — Bảo vệ và bán hàng nâng cao** | PDF stamping (email + mã đơn trên từng trang); giỏ hàng nhiều sản phẩm; bundle; flash sale theo khung giờ; license theo số người dùng (cá nhân / tổ chuyên môn / trường); staff của tenant với phân quyền; SePay tài khoản ảo (VA) theo từng đơn; hoàn tiền có quy trình; thông báo in-app; export dữ liệu cá nhân theo yêu cầu | Stamping chạy trong worker (`pdf-lib`), cache theo `orderItemId`; VA giúp khớp đơn chính xác hơn so khớp nội dung |
| **3 — Tăng trưởng** | Affiliate/giới thiệu; email marketing tới follower và khách đã mua; bài viết lên lịch; analytics chi tiết cho tenant (nguồn truy cập, tỷ lệ chuyển đổi); SEO nâng cao (schema.org Product/Review); trang khám phá toàn nền tảng; tìm kiếm full-text (Postgres FTS hoặc Meilisearch) | Tách bảng sự kiện analytics, cân nhắc ClickHouse khi lớn |
| **4 — Chuyên sâu và mở rộng** | **Tên miền riêng cho tenant** (xác minh DNS TXT, TLS tự động qua Caddy on-demand hoặc Vercel Domains API, bảng `tenant_domains`); theme storefront tùy biến; khoá học video/membership; ứng dụng mobile; AI hỗ trợ viết mô tả và tạo preview; hoá đơn điện tử; mở API/webhook cho tenant; đa tiền tệ | Custom domain cần thêm bước phân giải tenant theo `Host` trong `proxy.ts`, cookie theo domain, và cấu hình CSP theo domain |
| **Vận hành xuyên suốt** | Partition và lưu trữ lạnh audit log; backup/PITR; giám sát (Sentry, OpenTelemetry); chuyển DB từ Neon tạm sang môi trường chính thức; kiểm thử tải; rà soát tuân thủ Luật Thương mại điện tử và Luật Bảo vệ dữ liệu cá nhân với luật sư | |

---

## 13. Bàn giao cuối giai đoạn MVP 1

- Mã nguồn monorepo `gieochu` chạy được theo README.
- `docs/ARCHITECTURE.md` (sơ đồ tổng thể + ranh giới dữ liệu + phân giải tenant), `docs/modules/M0.md` … `M12.md` (sơ đồ xử lý chi tiết), `docs/DECISIONS.md`, `docs/BACKLOG.md`.
- Seed dữ liệu demo: 1 admin, 2 tenant (mỗi tenant 3 sản phẩm, 2 bài viết, cấu hình QR thủ công), 3 customer, vài đơn ở các trạng thái khác nhau.
- Hướng dẫn cấu hình SePay và MoMo cho **platform** và cho **tenant** (`docs/guides/payments.md`).
- Báo cáo test: 91 unit, 50 integration, tất cả xanh.

---

**Bắt đầu:** Đọc lại mục 0, tạo `docs/PLAN.md` và liệt kê các câu hỏi còn mở. Chờ xác nhận rồi triển khai M0.

---
tags:
  - meta
  - ai
  - status/living
date: 2026-09-26
author: System Architect
---

# 👥 Hiến Chương Đội — Gieo Chữ

Kể từ 2026-09-26, dự án có **2 sub-agent thường trực** định nghĩa tại `.claude/agents/` (project-local, chỉ
dùng cho repo này): [[#Agent docs|`docs`]] và [[#Agent engineer|`engineer`]] — quy mô nhỏ hơn mẫu "Quốc/Long/
Hiếu" từng dùng cho một project khác (không có agent phân tích nghiệp vụ, QA, DevOps riêng), nhưng cùng
nguyên lý: mỗi agent chỉ ghi đúng vùng của mình, ràng buộc bằng chỉ dẫn trong file `.claude/agents/*.md` của
nó (không phải cơ chế cưỡng chế của công cụ — root session kiểm tra qua diff sau mỗi lượt).

Trước 2026-09-26, dự án **không có sub-agent thường trực nào** — một phiên chính (root session, Claude Code,
định hình bởi `CLAUDE.md` ở root repo) làm phần lớn công việc trực tiếp theo chính sách **Proportional
Delegation** (định nghĩa ở
[[06-AI-Agent-Guides/skills/CLAUDE-ORCHESTRATOR-TEMPLATE|CLAUDE-ORCHESTRATOR-TEMPLATE]] §2, đường dẫn tương
đối [skills/CLAUDE-ORCHESTRATOR-TEMPLATE.md](skills/CLAUDE-ORCHESTRATOR-TEMPLATE.md)) — chỉ gọi `Agent` tool
khi (a) cần research rộng nhiều hướng cùng lúc (subagent kiểu `Explore`), (b) task đủ lớn/mơ hồ cần lập kế
hoạch trước bằng subagent kiểu `Plan`, hoặc (c) khối lượng tài liệu/nội dung lớn chia được theo domain để chạy
song song — chính lần viết lại `obsidian-knowledge-base/` này (6 agent tạm thời chạy song song theo domain,
không phải sub-agent thường trực) là một ví dụ (c). Từ 2026-09-26, chính sách chuyển một phần sang **giao việc
theo vai trò** (role-based delegation, đúng hướng chuyển đổi mà `AGENTS-TEAM-OPERATING-TEMPLATE.md` mục 5 dự
tính) cho 2 vùng đã có agent thường trực; các vai trò A02/A06/A07 còn lại vẫn là Root session (Proportional
Delegation) như trước.

Cùng ngày, `CLAUDE.md` ở root repo được thêm mục **"Sub-agent & điều phối"** — đây là điểm nạp lại hiến chương
này cho mọi phiên chính mới (link tới file này, bảng vùng ghi rút gọn của `engineer`/`docs`, chính sách
Proportional + role-based, mẫu brief theo `skills/CLAUDE-ORCHESTRATOR-TEMPLATE.md` §3, yêu cầu root session
kiểm tra `git diff`/`git status` sau mỗi lượt sub-agent, và thứ tự nguồn sự thật). Root session nên đọc mục đó
trước khi giao việc, thay vì chỉ đọc file này.

### Agent `docs`

Định nghĩa: `.claude/agents/docs.md`. Vai trò A08 (Docs/Knowledge Engineer). Quyền ghi:
`docs/obsidian-knowledge-base/**` toàn quyền; `docs/PLAN.md`/`DECISIONS.md`/`BACKLOG.md`/`ARCHITECTURE.md`
chỉ khi root session giao rõ trong brief. **Không được sửa code** (`apps/**`, `packages/**`, `prisma/**`).

### Agent `engineer`

Định nghĩa: `.claude/agents/engineer.md`. Gộp vai trò A03 (Backend) + A04 (Frontend) + A05 (Data) — dự án chưa
đủ lớn để tách 3 agent riêng. Quyền ghi: `apps/web/**`, `packages/**`, `prisma/**`, test liên quan. **Không
được sửa** `docs/obsidian-knowledge-base/**` hay `docs/*.md` — thấy cần cập nhật tài liệu thì báo lại root
session thay vì tự viết. Phải tuân thủ nguyên vẹn 11 quy tắc ở mục PROJECT-SPECIFIC RULES bên dưới, kể cả khi
brief không nhắc lại — file định nghĩa của agent này liệt kê lại đầy đủ để không phụ thuộc trí nhớ ngữ cảnh.
File `.claude/agents/engineer.md` còn liệt kê lại nguyên vẹn **9 quy tắc bảo mật** ở `CLAUDE.md` mục "Quy tắc
bảo mật" (token trong cookie httpOnly, chỉ lưu hash SHA-256 cho token, mã hoá AES-256-GCM secret cổng thanh
toán, xác thực webhook trước khi parse + idempotent, không tin số tiền/trạng thái từ client, presigned URL
sống ≤10 phút, CSRF/kiểm tra `Origin`, CSP nonce theo request, System Admin không đọc chi tiết đơn hàng/khách
hàng tenant); và yêu cầu mục "Báo cáo khi xong" của agent này phải nêu thêm đường đi có thể vỡ, edge case
đã/chưa xử lý, và cách kiểm tra thủ công (manual verification path) — theo đúng khung
`skills/AGENTS-TEAM-OPERATING-TEMPLATE.md` §8.4 (bàn giao A03/A04/A05 → A06).

## 📌 PROJECT PROFILE

| Mục | Nội dung |
| :-- | :-- |
| Project name | Gieo Chữ — SaaS đa tenant cho giáo viên/coach bán tài liệu số |
| Primary stack | Next.js 16 App Router, Prisma 7 (`prisma-client` generator, không dùng `prisma-client-js` — ADR-002) + Neon PostgreSQL qua `@prisma/adapter-neon`, pnpm workspaces + Turborepo, TypeScript `strict: true`, Tailwind, Jest (unit) + Vitest (integration) |
| Architecture style | 3 layer dữ liệu — L1 System / L2 Tenant (RLS theo `tenantId`) / L3 Customer (RLS theo `userId`) — xem [[MOC-Home]] và `docs/ARCHITECTURE.md` |
| Actors | System Admin (`isSuperAdmin`), Tenant owner/staff (chủ shop, chưa có luồng mời staff thật — xem BACKLOG), Customer (một tài khoản toàn cục, mua hàng từ nhiều tenant) |
| Critical domains | Auth/session security (cookie httpOnly, JWT, refresh token), RLS/tenant isolation (`withTenant/withCustomer/withPublic/withSystemJob`), payment encryption (AES-256-GCM), billing state machine (Free Forever + Paid Subscription — M3 v2) |
| Quality gates | `pnpm lint && pnpm typecheck && pnpm test && pnpm build` (bảng lệnh đầy đủ ở `CLAUDE.md`); `pnpm test:count` đối chiếu đúng 91 unit / 50 integration — **không đổi số lượng test nếu chưa hỏi lại người dùng** |
| Deployment target | Chưa triển khai thật (chưa có CI chạy thật trên remote, chưa deploy production) — xem `docs/PLAN.md` mục M0 |

## 🗺️ ACTIVE TEAM MAP

A03/A04/A05 nay được giao cho sub-agent thường trực `engineer`; A08 giao cho sub-agent thường trực `docs`.
A01/A02/A06/A07 vẫn là Root session (Proportional Delegation) — dự án chưa đủ lớn để tách riêng.

| Agent | Vai trò | Hiện trạng ở Gieo Chữ |
| :-- | :-- | :-- |
| A01 | System Architect | Root session (Proportional Delegation) — mọi quyết định kiến trúc, ranh giới L1/L2/L3, ghi ADR vào `docs/DECISIONS.md`, viết brief giao cho `engineer`/`docs` |
| A02 | Product / Business Analyst | Root session — làm rõ nghiệp vụ trực tiếp với chủ dự án qua hội thoại; không có agent phân tích nghiệp vụ riêng |
| A03 | Backend Engineer | **Sub-agent `engineer`** (`.claude/agents/engineer.md`) — `packages/*`, `apps/web/lib/*`, route handler |
| A04 | Frontend Engineer | **Sub-agent `engineer`** — cùng agent với A03/A05 (dự án chưa đủ lớn để tách riêng UI/backend/data) |
| A05 | Data Engineer / DBA | **Sub-agent `engineer`** — schema Prisma, migration, RLS policy; bắt buộc chạy integration test thật cho path RLS mới (đúc kết từ 3 lỗ hổng RLS thật đã xảy ra — ADR-010, ADR-020) |
| A06 | QA / Hardening | Root session tự verify (lint/typecheck/test/build + smoke-test qua `curl`/trình duyệt) sau mỗi module; không có agent QA độc lập tách biệt ngữ cảnh để review khách quan hơn |
| A07 | DevOps / Platform | Root session — `docker-compose.yml`, `.github/workflows/ci.yml`, biến môi trường; CI GitHub Actions chưa chạy thật (chưa push lên remote thường xuyên) |
| A08 | Docs / Knowledge Engineer | **Sub-agent `docs`** (`.claude/agents/docs.md`) — `obsidian-knowledge-base/**` toàn quyền; `docs/PLAN.md`/`DECISIONS.md`/`BACKLOG.md`/`ARCHITECTURE.md` chỉ khi root session giao rõ (đây vẫn là **nguồn sự thật chính**, root session cập nhật trực tiếp phần lớn thời gian). Khi `obsidian-knowledge-base/` và `docs/*.md` gốc lệch nhau, `docs/*.md` gốc và code là chân lý |

## 🔒 PROJECT-SPECIFIC RULES

1. **Ranh giới layer L1/L2/L3 không phá vỡ.** L1 System (users, plans, subscriptions...) / L2 Tenant (có
   `tenantId`, bắt buộc RLS) / L3 Customer (lọc theo `userId`) — xem [[MOC-Home]] và `docs/ARCHITECTURE.md`.
2. **Mọi bảng L2 phải qua 1 trong 4 hàm RLS** `withTenant/withCustomer/withPublic/withSystemJob`
   (`packages/db/src/rls.ts`) — không bao giờ gọi `getPrismaClient()` trần cho bảng có `tenantId`. Vi phạm quy
   tắc này đã gây ít nhất 3 lỗ hổng RLS thật, tự phát hiện qua integration test (ADR-010, ADR-020 — kể cả ở
   `payment-process.ts` của M8 và `consumeShareLinkDownload()` của M9).
3. **Không `import '@prisma/client'` trực tiếp trong `apps/web`** — chỉ qua helper `@gieochu/db` (ESLint
   `no-restricted-imports`, `packages/config/eslint-preset.mjs`).
4. **Hai hệ thống thanh toán (Platform vs Tenant) dùng chung `packages/payments` nhưng không bao giờ chung
   bảng, secret, hay route.** Mọi hàm thanh toán nhận `PaymentScope` (`{kind:'PLATFORM'}` hoặc
   `{kind:'TENANT', tenantId}`).
5. **Secret cổng thanh toán (cả platform và tenant) mã hoá AES-256-GCM** bằng `PAYMENT_ENCRYPTION_KEY` trước
   khi lưu DB — không bao giờ trả secret thô về client, UI chỉ hiện `••••abcd`.
6. **ID dùng cuid2** (`@default(cuid(2))` gốc của Prisma) cho mọi `@id` — không dùng UUID (ADR-001).
7. **Không bao giờ đặt `user.id` vào URL slug.** Quyết định tường minh, gần đây (ADR-022, sửa bug
   `resolveLandingPath()` redirect sai sau đăng nhập) — landing path tra theo `Tenant.ownerId` để lấy
   `tenant.slug`, không tự suy diễn URL từ ID người dùng.
8. **Không hard-code chuỗi thương hiệu** ("Gieo Chữ", slogan...) — luôn đọc từ `@gieochu/config/brand`.
9. **Không thêm/bớt số lượng test case** so với bảng ở `CLAUDE.md` mục 9 (91 unit / 50 integration, đối chiếu
   bằng `pnpm test:count`) nếu chưa hỏi lại người dùng.
10. **Hỏi trước khi code — chuẩn làm việc quan sát được, không phải suy diễn.** Chủ dự án đã nhiều lần yêu cầu
    xác nhận phạm vi trước khi sửa/viết code (ví dụ: chia M5 làm 2 phần vì máy code không có Docker — ADR-014;
    chuyển cấu hình storage sang System Admin — ADR-017; mở rộng RBAC thành bảng `Role`/`Permission` thật thay
    vì hàm gộp tạm — ADR-022). Khi đặc tả mơ hồ: chọn phương án an toàn/đơn giản nhất, ghi ADR ngắn; nếu ảnh
    hưởng tiền, bảo mật, hoặc dữ liệu cá nhân — **dừng lại và hỏi**, không tự quyết (`CLAUDE.md` mục "Khi đặc
    tả mơ hồ").
11. **Không commit trừ khi được yêu cầu rõ ràng.** Không tự ý tạo git commit trong lúc code một module.

## 🔧 Thay đổi `.claude/settings.json` (2026-09-26)

Allowlist bỏ quyền shell rộng `Bash(cat > *)` (cho phép ghi file bất kỳ qua heredoc, không giới hạn đường dẫn)
để giảm nguy cơ sub-agent ghi đè file ngoài vùng được giao mà không bị hỏi lại. Cùng lượt dọn này, root session
bỏ thêm 4 quyền `rm`/`cd`/`git -C` dùng một lần — các quyền này được thêm vào bản làm việc sau commit `dcc1ff1`
và chưa từng được commit, nên `git show HEAD:.claude/settings.json` không thấy chúng. Giữ lại `Bash(git log *)`
và `additionalDirectories` `docs/obsidian-knowledge-base/00-Index`.

## 📚 SOURCES OF TRUTH

*(điền theo khung `skills/AGENTS-TEAM-OPERATING-TEMPLATE.md` §6; dòng nào chưa verify được giữ nguyên ❓)*

- Runtime active: `apps/web` (Next.js 16 App Router, `pnpm dev`) — chưa deploy production thật (xem
  `docs/PLAN.md` mục M0).
- Data source of truth: Neon PostgreSQL qua `packages/db` (Prisma `prisma-client` generator +
  `@prisma/adapter-neon`), role `gieochu_app` cho runtime, role owner chỉ dùng cho `prisma migrate deploy`.
- API contract source: route handler / Server Action trong `apps/web` — ❓ chưa có tài liệu OpenAPI/contract
  hình thức hoá riêng, đọc trực tiếp source khi cần contract chính xác.
- UI source of truth: `apps/web/app/**` (App Router) — ❓ chưa xác minh có design system/token tài liệu hoá
  riêng ngoài Tailwind config.
- Infra source of truth: `docker/docker-compose.yml` (MinIO, Mailpit, Postgres local tuỳ chọn),
  `.env.example` (biến môi trường), `.github/workflows/` — CI GitHub Actions ❓ chưa chạy thật trên remote
  (theo mục A07 ở bảng ACTIVE TEAM MAP phía trên).
- Docs source of truth: `docs/*.md` gốc (`PLAN.md`/`DECISIONS.md`/`ARCHITECTURE.md`/`BACKLOG.md`) > code runtime
  khi hai bên khớp nhau về hành vi hiện tại; khi `docs/*.md` gốc và `obsidian-knowledge-base/` lệch nhau,
  `docs/*.md` gốc và code là chân lý (đã ghi ở mục A08 bảng trên).
- Legacy or deprecated zones: ❓ chưa xác định được vùng legacy/deprecated nào trong code hiện tại của Gieo
  Chữ — không tìm thấy nhắc "deprecated"/"legacy" trong `docs/BACKLOG.md`. (Việc xoá nhánh `ai-provider-*` ghi
  ở `README.md` cùng thư mục là dọn tài liệu của một project khác lẫn vào trước đây, không phải vùng legacy
  của chính Gieo Chữ.)

---

*Quay lại: [[06-AI-Agent-Guides/README|AI Agent Guides]] · [[MOC-Home]]*

---
tags:
  - meta
  - ai
  - ui-ux
  - status/living
date: 2026-09-26
updated: 2026-10-23
author: Long (A08)
---

# 👥 Hiến Chương Đội — Gieo Chữ

Đội gồm **1 phiên chính (Quốc)** và **3 sub-agent (Long, Hiếu, Phong)** định nghĩa ở `.claude/agents/`
(project-local, chỉ dùng cho repo này). Mục tiêu: mỗi thành viên chỉ đọc đúng vùng tri thức của mình, không chồng
chéo, không nạp thừa skill/hướng dẫn của người khác. Nguồn phân công đã duyệt: `CLAUDE.md` ở root repo, mục "Đội &
phân công (Quốc · Long · Hiếu · Phong)" ✅ (đối chiếu trực tiếp 2026-09-26). Khi file này và `CLAUDE.md` lệch nhau,
`CLAUDE.md` đúng.

| Thành viên | Vai trò | Hình thức | Quyền ghi | File định nghĩa |
| :-- | :-- | :-- | :-- | :-- |
| **Quốc** | Kỹ sư trưởng / kiến trúc sư, điều phối, review (A01/A02/A06/A07) | Phiên chính | `CLAUDE.md`, `docs/DECISIONS.md` (ADR), `docs/PLAN.md`, brief, review; sửa code nhỏ/khẩn cấp | `CLAUDE.md` (root repo) |
| **Long** | Chuyên viên tài liệu, người giữ skill (A08) | Sub-agent `long` | `obsidian-knowledge-base/**` (`01-Architecture-Decisions/` chỉ khi Quốc duyệt); `docs/*.md` gốc chỉ khi brief giao rõ | `.claude/agents/long.md` |
| **Hiếu** | Kỹ sư lập trình 10 năm kinh nghiệm (A03/A04 logic/A05) | Sub-agent `hieu` | `apps/web/**`, `packages/**` (gồm `packages/db/prisma/`), test — lớp trình bày chỉ khi brief giao | `.claude/agents/hieu.md` |
| **Phong** | Chuyên viên UX/UI — design layout, component, token, a11y (A04 UI) | Sub-agent `phong`, skill `ui-ux-pro-max` | Lớp trình bày: `apps/web/app/**/_ui/**`, `globals.css`, `public/**`, JSX/className/bố cục trong `page.tsx`/`layout.tsx`; `packages/config/src/theme.ts` chỉ khi brief nêu rõ | `.claude/agents/phong.md` |

*Lịch sử:* 2026-09-26 thử 2 sub-agent `docs`/`engineer`; cùng ngày thay bằng `long`/`hieu` theo mô hình hiện tại;
2026-09-26 bổ sung Phong (UX/UI).

## 1. Phân vùng tri thức

| Vùng | Quốc | Long | Hiếu | Phong |
| :-- | :-- | :-- | :-- | :-- |
| `CLAUDE.md`, `00-Index/` (MOC, KB-Audit) | đọc/ghi | đọc/ghi 00-Index; đọc `CLAUDE.md` | — | — |
| `docs/DECISIONS.md` + `01-Architecture-Decisions/` | ghi | đọc; ghi khi Quốc duyệt | đọc (ràng buộc) | đọc ADR liên quan UI |
| `02-System-Specs/` | đọc | ghi | đọc chỉ spec liên quan task | đọc chỉ spec liên quan task |
| `03-API-Contracts/` | đọc | ghi | đọc trang liên quan; contract đổi → báo Quốc để giao Long | — (nhận contract qua brief) |
| `04-Operations-Runbooks/` | đọc | ghi | — (trừ task release/DR) | đọc `UI-Design-System.md` |
| `05-Historical-Archive/` | — | đọc khi cần ngữ cảnh | không đọc | không đọc |
| `06-AI-Agent-Guides/` (Charter, template, skill) | đọc Team-Charter | ghi | — | — |
| Code logic: `route.ts`, Server Actions, `lib/**`, `packages/**`, schema | đọc khi review | đọc để đối chiếu, không sửa | ghi | đọc, không sửa |
| Lớp trình bày: `_ui/**`, `globals.css`, JSX/layout trong page/layout | đọc khi review | đọc để đối chiếu, không sửa | ghi khi brief giao | ghi |
| `.claude/skills/ui-ux-pro-max/` | — | — | — | dùng (nạp sẵn), không sửa |

Các thư mục `0X-*` ở bảng trên nằm trong `obsidian-knowledge-base/` (root repo).

**Quy tắc chống đọc thừa:**

- Mỗi người chỉ mở thư mục có quyền trong cột của mình. Cần thông tin ngoài vùng → ghi câu hỏi trả về Quốc,
  không tự quét.
- Không nạp skill/template của người khác: Long không đọc skill/hướng dẫn lập trình của Hiếu và skill
  `ui-ux-pro-max` của Phong; Hiếu và Phong không đọc `05-Historical-Archive/` hay template điều phối trong
  `06-AI-Agent-Guides/`.
- Dùng [[MOC-Home]] và `README.md` từng thư mục làm bản đồ — mở đúng trang cần, không đọc cả thư mục.
- Thông tin giữa các thành viên đi qua **brief** (Quốc → agent) và **báo cáo** (agent → Quốc), không qua việc
  agent tự đọc vùng của nhau.

> [!WARNING]
> Phân vùng trên là **ràng buộc bằng chỉ dẫn** trong `CLAUDE.md` và `.claude/agents/*.md`, không phải cơ chế
> cưỡng chế của công cụ. Quốc kiểm tra bằng `git diff`/`git status` sau mỗi lượt sub-agent; file nằm ngoài vùng
> ghi của agent thì bị trả lại.

## 2. Quy trình một task

1. Quốc nhận yêu cầu, làm rõ business rule mơ hồ (Zero Guessing), **chốt phạm vi với chủ dự án trước khi code**,
   ghi ADR vào `docs/DECISIONS.md` nếu là quyết định dài hạn.
2. Quốc giao brief cho Hiếu (logic/dữ liệu) và/hoặc Phong (layout/UI) theo mẫu §4. Task có cả UI lẫn dữ liệu:
   Phong chốt bố cục + contract dữ liệu cần (props, shape dữ liệu, trạng thái), Hiếu làm phần dữ liệu/logic theo
   contract đó; Quốc là người chuyển contract giữa hai bên.
3. Hiếu/Phong thực hiện, verify (lint, typecheck, test, `test:count`; với thay đổi nghiệp vụ/bảo mật/RLS thêm dữ
   liệu thật qua dev server; Phong thêm kiểm tra a11y/responsive/trạng thái loading-empty-error), báo: file đã
   đổi, kết quả verify, rủi ro, tác động tài liệu.
4. Quốc review `git diff`/`git status`, đối chiếu ADR và ranh giới L1/L2/L3 + RLS. File ngoài vùng ghi hoặc không
   đạt → trả lại agent đã làm.
5. Quốc giao Long danh sách thay đổi cần ghi (spec, endpoint, schema, skill, runbook). Long cập nhật KB và báo lại
   các trang đã sửa; Quốc kiểm tra diff.
6. Task xong khi code đạt verify **và** Long đã ghi nhận (bỏ qua bước 5 với sửa lỗi nhỏ không đổi hành
   vi/contract). Commit chỉ khi chủ dự án yêu cầu.

### 2.1. Nguyên tắc lập kế hoạch tính năng

Chủ dự án chốt ngày 2026-10-17; nguồn: `CLAUDE.md` mục "Nguyên tắc lập kế hoạch tính năng" ✅ (đối chiếu trực tiếp
2026-10-17). Áp dụng cho **mọi trang/tính năng có nội dung**:

1. **Kế hoạch bắt đầu bằng luồng UX + mô hình dữ liệu**, sau đó mới thiết kế giao diện.
2. **Giai đoạn 1 — CMS quản trị:** xây màn quản trị (System Center hoặc Studio) lưu **toàn bộ** nội dung/cấu hình
   vào database. Không hard-code chữ, giá, FAQ, nhãn trong JSX.
3. **Giai đoạn 2 — UI công khai:** dựng giao diện đọc dữ liệu từ DB.

Mẫu đã áp dụng: trang chủ CMS — ADR-033; Cửa hàng `/cua-hang` — ADR-035 (tiêu đề ADR: "CMS trước, trang dữ liệu
sau") ✅ (đối chiếu `docs/DECISIONS.md`).

Hệ quả cho quy trình §2: ở bước 1 Quốc chốt với chủ dự án luồng UX + mô hình dữ liệu và tách GĐ1/GĐ2 trước khi
giao việc; ở bước 2 brief GĐ1 (schema, CMS, đọc/ghi DB) đi trước brief UI công khai GĐ2. Kiểm tra bằng mục
`PLAN_CHECK` trong mẫu brief (§4).

## 3. Trách nhiệm chi tiết

### Quốc — phiên chính

- Quyết định kiến trúc, phạm vi và thứ tự module (`docs/PLAN.md`); ghi ADR vào `docs/DECISIONS.md`.
- Cổng duy nhất giữa chủ dự án và 3 sub-agent — agent không nhận yêu cầu trực tiếp từ ai khác.
- Xử lý xung đột giữa spec và code: **code là chân lý**; giao Long ghi chỗ lệch vào `00-Index/KB-Audit-*.md`.
- Không tự code phần lớn task — chỉ sửa nhỏ (1–2 file, nghiệp vụ rõ) hoặc khẩn cấp; còn lại giao Hiếu (logic) /
  Phong (giao diện).
- Sau mỗi lượt sub-agent: review diff và tự chạy lại verify liên quan trước khi báo chủ dự án là xong.

### Long — tài liệu & người giữ skill

- Sau mỗi thay đổi chức năng (theo brief của Quốc): cập nhật spec sống trong `02-System-Specs/`,
  [[03-API-Contracts/Endpoint-Directory|Endpoint-Directory]],
  [[03-API-Contracts/Database-Schema-Reference|Database-Schema-Reference]], runbook trong
  `04-Operations-Runbooks/`, [[Tags-Dictionary]] và [[MOC-Home]].
- Người giữ skill: duy trì `06-AI-Agent-Guides/` (Charter, template, skill).
- Sửa/đóng mục trong `00-Index/KB-Audit-*.md` khi chỗ lệch đã được xử lý.
- Gắn mức xác minh cho mọi khẳng định: ✅ đã đối chiếu code/DB · 🟡 nghe từ báo cáo · ❓ cần môi trường thật.
- Không suy diễn nghiệp vụ (order state machine, billing/subscription, RLS L1/L2/L3, RBAC) — thiếu dữ kiện thì
  hỏi Quốc. Không sửa code.

### Hiếu — thực thi code

- Thực thi đúng brief; **không mở rộng phạm vi** ngoài brief kể cả khi "tiện thể".
- Ràng buộc cứng (nguồn: `.claude/agents/hieu.md` ✅), không vi phạm dù brief không nhắc lại:
  - Ranh giới L1/L2/L3; mọi bảng L2 qua đúng 1 trong 4 hàm RLS `withTenant/withCustomer/withPublic/withSystemJob`
    (`packages/db/src/rls.ts`), không gọi `getPrismaClient()` trần cho bảng có `tenantId`; path RLS mới phải có
    integration test thật.
  - Không `import '@prisma/client'` trong `apps/web` — chỉ qua helper `@gieochu/db`.
  - Hai hệ thống thanh toán Platform/Tenant không chung bảng/secret/route; mọi hàm thanh toán nhận `PaymentScope`.
  - ID dùng cuid2 (`@default(cuid(2))`); không đặt `user.id` vào URL slug (ADR-022).
  - Chuỗi thương hiệu đọc qua `getEffectiveBrand()` (`apps/web/lib/branding.ts`, DB `SystemBranding`); fallback duy nhất `DEFAULT_BRAND` ở `@gieochu/config/brand` (ADR-032).
  - Token chỉ trong cookie `httpOnly` (cùng các quy tắc bảo mật khác ở `CLAUDE.md` mục "Quy tắc bảo mật").
- Thiếu dữ kiện nghiệp vụ, hoặc điểm mơ hồ ảnh hưởng tiền/bảo mật/dữ liệu cá nhân → dừng và hỏi Quốc.
- Contract/schema đổi → báo tác động tài liệu cho Quốc để giao Long; không tự sửa KB hay `docs/`.
- Phối hợp với Phong: không sửa lớp trình bày trừ khi brief giao rõ; UI cần dữ liệu mới thì làm theo contract
  Phong đưa qua brief của Quốc. Next.js 16 có breaking change — đọc hướng dẫn trong `node_modules/next/dist/docs/`
  (theo `apps/web/AGENTS.md`) trước khi viết route/layout/API mới (nguồn: `.claude/agents/hieu.md` ✅).

### Phong — UX/UI & design layout

Nguồn: `.claude/agents/phong.md` ✅ (đối chiếu 2026-09-26).

- Dùng skill `ui-ux-pro-max` (nạp sẵn) để tra quy tắc UX/accessibility/responsive/form/navigation, pattern theo
  stack (`--stack nextjs`, khi liên quan `shadcn`/`react`), tham khảo style/màu/font/chart; duyệt giao diện theo
  bảng ưu tiên của skill (Accessibility, Touch & Interaction là mức CRITICAL).
- **Hệ thống thị giác của Gieo Chữ ưu tiên hơn gợi ý của skill:** token màu ở `packages/config/src/theme.ts`
  (màu runtime `var(--brand-xxx, <hex>)`, không hard-code hex), heading Be Vietnam Pro / body Inter qua
  `next/font/google` (subset `vietnamese`), kit dùng chung `apps/web/app/admin/_ui/` — tái dùng trước khi tạo
  mới. Chi tiết ở [[04-Operations-Runbooks/UI-Design-System|UI-Design-System]]
  ([UI-Design-System.md](../04-Operations-Runbooks/UI-Design-System.md)).
- Không chạy `--design-system` để đổi palette/font/style, không `--persist` (tạo thư mục `design-system/`) khi
  brief chưa cho phép rõ; muốn đổi token/brand → trình phương án + lý do cho Quốc quyết.
- Chuẩn bắt buộc: tương phản ≥ 4.5:1, focus ring nhìn thấy được, `aria-label` cho nút chỉ có icon, label cho
  input, heading tuần tự, tôn trọng `prefers-reduced-motion`; responsive mobile-first, không cuộn ngang, target
  bấm ≥ 44×44px; mỗi màn hình dữ liệu đủ trạng thái loading / empty / error; icon SVG từ `admin/_ui/icons.tsx`,
  không dùng emoji làm icon; chuỗi thương hiệu nhận qua prop từ server (`getEffectiveBrand()`, ADR-032).
- **Không sửa** logic lấy dữ liệu/gọi `@gieochu/db`, `requireUser()`/`requireRole()`/kiểm tra quyền, Server
  Actions, `route.ts`, `proxy.ts`, `apps/web/lib/**`, `packages/**` (trừ `theme.ts` khi brief nêu rõ), schema,
  KB và `docs/`. Layout cần dữ liệu/field/action chưa có → mô tả contract trong báo cáo để Quốc giao Hiếu.
- Quyết định thiết kế cần ghi lại → báo Quốc để giao Long cập nhật `UI-Design-System.md`.

## 4. Mẫu brief

- Dùng khung [[06-AI-Agent-Guides/skills/CLAUDE-ORCHESTRATOR-TEMPLATE|CLAUDE-ORCHESTRATOR-TEMPLATE]] §3
  ([skills/CLAUDE-ORCHESTRATOR-TEMPLATE.md](skills/CLAUDE-ORCHESTRATOR-TEMPLATE.md)): TASK, READ_REQUIRED,
  CONSTRAINTS, OUTPUT_EXPECTED, DO_NOT_TOUCH, VERIFY_REQUIRED.
- `READ_REQUIRED` chỉ trỏ vào vùng của agent nhận việc (theo bảng §1).
- Mọi brief yêu cầu agent báo lại: file đã đổi, kết quả verify, và tác động tài liệu.
- Brief/kế hoạch cho trang/tính năng có nội dung thêm mục `PLAN_CHECK` (theo §2.1):
  - [ ] Đã có luồng UX + mô hình dữ liệu trước khi thiết kế giao diện?
  - [ ] Đã tách **GĐ1 CMS + mô hình dữ liệu** (System Center/Studio, nội dung/cấu hình lưu DB) và **GĐ2 UI công
        khai** đọc từ DB chưa?
  - [ ] Không còn chữ, giá, FAQ, nhãn hard-code trong JSX?

## 5. Ranh giới với quy tắc dự án

Hiến chương này **không thay đổi** quy tắc cứng trong `CLAUDE.md`: trả lời tiếng Việt; không commit trừ khi được
yêu cầu; Conventional Commits, commit nhỏ theo module; không đổi số lượng test (trần gốc 91/50 (mục 9); trần hiện 95/57 theo ADR-026 + ADR-037 + ADR-050; số thực xem `pnpm test:count`); mục
"Quy tắc bảo mật" và "Ranh giới layer". Thay đổi duy nhất về điều phối: chính sách delegation chuyển từ
"Proportional Delegation" (phiên chính tự làm phần lớn, chỉ gọi sub-agent khi cần) sang **giao việc theo vai
trò** như §2–§3.

## 📌 PROJECT PROFILE

| Mục | Nội dung |
| :-- | :-- |
| Project name | Gieo Chữ — SaaS đa tenant cho giáo viên/coach bán tài liệu số |
| Primary stack | Next.js 16 App Router, Prisma 7 (`prisma-client` generator, không dùng `prisma-client-js` — ADR-002) + Neon PostgreSQL qua `@prisma/adapter-neon`, pnpm workspaces + Turborepo, TypeScript `strict: true`, Tailwind, Jest (unit) + Vitest (integration) |
| Architecture style | 3 layer dữ liệu — L1 System / L2 Tenant (RLS theo `tenantId`) / L3 Customer (RLS theo `userId`) — xem [[MOC-Home]] và `docs/ARCHITECTURE.md` |
| Actors | System Admin (`isSuperAdmin`), Tenant owner/staff (chủ shop, chưa có luồng mời staff thật — xem BACKLOG), Customer (một tài khoản toàn cục, mua hàng từ nhiều tenant) |
| Critical domains | Auth/session security (cookie httpOnly, JWT, refresh token), RLS/tenant isolation (`withTenant/withCustomer/withPublic/withSystemJob`), payment encryption (AES-256-GCM), billing state machine (Free Forever + Paid Subscription — M3 v2) |
| Quality gates | `pnpm lint && pnpm typecheck && pnpm test && pnpm build` (bảng lệnh đầy đủ ở `CLAUDE.md`); `pnpm test:count` đối chiếu với trần gốc 91/50 (mục 9); trần hiện 95/57 theo ADR-026 + ADR-037 + ADR-050; số thực xem `pnpm test:count` — **không đổi số lượng test nếu chưa hỏi lại người dùng** |
| Deployment target | Chưa triển khai thật (chưa có CI chạy thật trên remote, chưa deploy production) — xem `docs/PLAN.md` mục M0 |

## 🗺️ ACTIVE TEAM MAP

| Agent | Vai trò | Người đảm nhận ở Gieo Chữ |
| :-- | :-- | :-- |
| A01 | System Architect | **Quốc** — quyết định kiến trúc, ranh giới L1/L2/L3, ghi ADR vào `docs/DECISIONS.md`, viết brief |
| A02 | Product / Business Analyst | **Quốc** — làm rõ nghiệp vụ trực tiếp với chủ dự án, chốt phạm vi trước khi giao code |
| A03 | Backend Engineer | **Hiếu** — `packages/*`, `apps/web/lib/*`, route handler, Server Action |
| A04 | Frontend Engineer | Tách 2 phần: **UI → Phong** (bố cục, component `_ui/**`, `globals.css`, token, a11y/responsive); **logic → Hiếu** (lấy dữ liệu, kiểm tra quyền, Server Action, route trong `apps/web/app/**`) |
| A05 | Data Engineer / DBA | **Hiếu** — schema Prisma, migration, RLS policy; bắt buộc integration test thật cho path RLS mới (ADR-010, ADR-020) |
| A06 | QA / Hardening | **Quốc** — review diff và tự chạy lại verify (lint/typecheck/test/build, smoke-test) sau mỗi lượt của Hiếu/Phong |
| A07 | DevOps / Platform | **Quốc** — `docker/docker-compose.yml`, `.github/workflows/`, biến môi trường; CI chưa chạy thật trên remote |
| A08 | Docs / Knowledge Engineer | **Long** — `obsidian-knowledge-base/**`; `docs/*.md` gốc chỉ khi brief giao rõ. `docs/*.md` gốc vẫn là nguồn sự thật cao hơn KB |

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
7. **Không bao giờ đặt `user.id` vào URL slug** (ADR-022, sửa bug `resolveLandingPath()` redirect sai sau đăng
   nhập) — landing path tra theo `Tenant.ownerId` để lấy `tenant.slug`.
8. **Không hard-code chuỗi thương hiệu** ("Gieo Chữ", slogan...) — đọc qua `getEffectiveBrand()` (DB `SystemBranding`); mặc định
   chỉ khai một chỗ `DEFAULT_BRAND` trong `@gieochu/config/brand` (ADR-032).
9. **Không thêm/bớt số lượng test case** so với mốc test (trần gốc 91/50 (mục 9); trần hiện 95/57 theo ADR-026 + ADR-037 + ADR-050; số thực xem `pnpm test:count`) nếu chưa hỏi lại người dùng.
10. **Hỏi trước khi code.** Chủ dự án đã nhiều lần yêu cầu xác nhận phạm vi trước khi sửa/viết code (ví dụ:
    chia M5 làm 2 phần vì máy code không có Docker — ADR-014; chuyển cấu hình storage sang System Admin —
    ADR-017; mở rộng RBAC thành bảng `Role`/`Permission` thật — ADR-022). Quốc là người chốt phạm vi với chủ
    dự án trước khi giao Hiếu/Phong. Khi đặc tả mơ hồ: chọn phương án an toàn/đơn giản nhất, ghi ADR ngắn; nếu ảnh
    hưởng tiền, bảo mật, hoặc dữ liệu cá nhân — **dừng lại và hỏi** (`CLAUDE.md` mục "Khi đặc tả mơ hồ").
11. **Không commit trừ khi được yêu cầu rõ ràng** — áp dụng cho cả Quốc, Long, Hiếu, Phong.
12. **Một DB duy nhất cho dev, Preview và production (ADR-034)** — mọi thao tác DB từ máy dev là thao tác trên production.
    **Không tự chạy migrate/DDL** (`pnpm db:migrate`, SQL DDL tay) khi chưa được Quốc duyệt; không `prisma migrate dev/reset`.
    Migration theo **expand → contract**: bản deploy chỉ được *thêm* (bảng/cột/index/policy); `DROP`/`RENAME` chỉ chạy **sau khi**
    code mới không còn dùng cột đó đã lên production (sự cố 2026-10-15 —
    [[04-Operations-Runbooks/Deploy-Vercel-Runbook|Deploy-Vercel-Runbook]] §9).
13. **Không chạy `pnpm db:seed`** (ghi đè nội dung trang chủ CMS — `.env` luôn trỏ DB production theo ADR-034). Integration
    test/script thủ công ghi dữ liệu thật: chỉ chạy khi cần, tự dọn dữ liệu tạm, không đụng cấu hình dùng chung, không gửi email
    tới địa chỉ thật; Preview chỉ để xem giao diện.
14. **CMS trước, UI sau — UX trước UI** (chủ dự án chốt 2026-10-17, `CLAUDE.md` mục "Nguyên tắc lập kế hoạch tính
    năng"): trang/tính năng có nội dung làm GĐ1 CMS quản trị lưu toàn bộ nội dung/cấu hình vào DB, GĐ2 mới dựng UI
    công khai đọc từ DB; không hard-code chữ, giá, FAQ, nhãn trong JSX — chi tiết §2.1.

*Ghi chú:* `.claude/settings.json` không còn quyền shell rộng `Bash(cat > *)` (bỏ ngày 2026-09-26) để giảm nguy
cơ ghi đè file ngoài vùng mà không bị hỏi lại ✅ (grep file cấu hình 2026-09-26).

## 📚 SOURCES OF TRUTH

*(điền theo khung `skills/AGENTS-TEAM-OPERATING-TEMPLATE.md` §6; dòng nào chưa verify được giữ nguyên ❓)*

- Thứ tự ưu tiên: **code runtime > `docs/*.md` gốc (PLAN/DECISIONS/ARCHITECTURE/BACKLOG) >
  `obsidian-knowledge-base/`** (theo `CLAUDE.md`). Chỗ lệch ghi vào `00-Index/KB-Audit-*.md`.
- Runtime active: `apps/web` (Next.js 16 App Router, `pnpm dev`) — chưa deploy production thật (xem
  `docs/PLAN.md` mục M0).
- Data source of truth: Neon PostgreSQL qua `packages/db` (Prisma `prisma-client` generator +
  `@prisma/adapter-neon`), role `gieochu_app` cho runtime, role owner chỉ dùng cho `prisma migrate deploy`.
- API contract source: route handler / Server Action trong `apps/web` — ❓ chưa có tài liệu OpenAPI/contract
  hình thức hoá riêng; bản tra cứu là [[03-API-Contracts/Endpoint-Directory|Endpoint-Directory]], đọc trực
  tiếp source khi cần contract chính xác.
- UI source of truth: `apps/web/app/**` (App Router); token màu/font ở `packages/config/src/theme.ts`, kit dùng
  chung ở `apps/web/app/admin/_ui/`, tài liệu hoá tại [[04-Operations-Runbooks/UI-Design-System|UI-Design-System]]
  (owner thiết kế: Phong).
- Infra source of truth: `docker/docker-compose.yml` (MinIO, Mailpit, Postgres local tuỳ chọn),
  `.env.example` (biến môi trường), `.github/workflows/` — CI GitHub Actions ❓ chưa chạy thật trên remote.
- Docs source of truth: `docs/*.md` gốc; knowledge base ở `obsidian-knowledge-base/` (root repo, chuyển từ
  `docs/` ngày 2026-09-26).
- Legacy or deprecated zones: ❓ chưa xác định được vùng legacy/deprecated nào trong code hiện tại của Gieo Chữ.

---

*Quay lại: [[06-AI-Agent-Guides/README|AI Agent Guides]] · [[MOC-Home]]*

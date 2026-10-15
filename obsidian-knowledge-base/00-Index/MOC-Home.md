---
tags:
  - meta
  - index
  - moc
date: 2026-09-26
updated: 2026-10-15
author: System Architect
---

# 🗺️ Gieo Chữ Knowledge Base — Map of Content (MOC)

Chào mừng bạn đến với **Kho Tri Thức Chuẩn Hóa của Gieo Chữ** — nền tảng SaaS đa tenant cho giáo viên/coach
bán tài liệu số. Kho này chứa quy tắc nghiệp vụ, quyết định kiến trúc, đặc tả kỹ thuật và cẩm nang vận hành
của hệ thống, tổ chức lại từ khuôn mẫu thư mục có sẵn (viết mới toàn bộ nội dung ngày 2026-09-26).

**Nguồn sự thật gốc** (khi KB này và code lệch nhau, các file sau luôn thắng): `CLAUDE.md` (root repo),
`docs/PLAN.md`, `docs/DECISIONS.md`, `docs/BACKLOG.md`, `docs/ARCHITECTURE.md`,
`docs/GIEOCHU_PROMPT_MVP_PHASE1.md`. KB này là một lớp chỉ mục có cấu trúc thứ cấp của cùng sự thật đó, không
phải nguồn thay thế.

---

## 📌 Nguyên Tắc Vàng (Core Principles)

* **Zero Guessing:** Không suy diễn logic nghiệp vụ — verify qua code, Neon PostgreSQL, và `docs/PLAN.md`/
  `docs/DECISIONS.md`. Khi đặc tả mơ hồ: chọn phương án an toàn/đơn giản nhất và ghi ADR; nếu ảnh hưởng tiền,
  bảo mật, hoặc dữ liệu cá nhân — **dừng lại và hỏi người dùng**, không tự quyết.
* **ID = cuid2, không UUID:** Mọi `@id` dùng thuộc tính gốc Prisma `@default(cuid(2))` (ADR-001).
* **RLS 4-scope là bắt buộc cho mọi bảng L2:** mọi bảng có `tenantId` phải đi qua đúng một trong
  `withTenant/withCustomer/withPublic/withSystemJob` (`packages/db/src/rls.ts`) — không bao giờ gọi
  `getPrismaClient()` trần cho bảng L2. Vi phạm quy tắc này đã gây ra ít nhất 3 lỗ hổng RLS thật, chỉ phát
  hiện được qua integration test thật (ADR-010, ADR-020).
* **Không `import '@prisma/client'` trực tiếp trong `apps/web`:** chỉ qua helper của `@gieochu/db` (chặn bằng
  ESLint `no-restricted-imports`).
* **Hai hệ thống thanh toán không bao giờ chung bảng/secret/route:** Platform (tenant trả phí subscription
  cho nền tảng) và Tenant (khách trả tiền cho giáo viên) dùng chung code `packages/payments` nhưng mọi hàm
  nhận `PaymentScope` (`{kind:'PLATFORM'}` hoặc `{kind:'TENANT', tenantId}`) — không chung bảng, secret, hay
  route webhook.
* **Secret cổng thanh toán mã hoá AES-256-GCM** bằng `PAYMENT_ENCRYPTION_KEY` trước khi lưu DB — không bao
  giờ trả secret thô về client.
* **Không bao giờ đặt `user.id` vào URL slug** (ADR-022) — landing path tra theo `Tenant.ownerId` để lấy
  `tenant.slug`, không suy diễn URL từ ID người dùng.
* **System Admin không có route nào đọc chi tiết đơn hàng/khách hàng của tenant** — chỉ đọc
  `tenant_daily_stats` và bảng L1. Ranh giới L1 System / L2 Tenant / L3 Customer là bất biến.

---

## 🗂️ Cấu Trúc Bản Đồ Tri Thức

### 1. [[01-Architecture-Decisions/README|01-Architecture-Decisions]] — Quyết định Kiến trúc Bất biến (ADR)
Các ADR ngắn ghi lại quyết định khi đặc tả mơ hồ, tương ứng `docs/DECISIONS.md` gốc — ví dụ: ID strategy
cuid2, tách role Postgres `gieochu_app` khỏi role owner để RLS có hiệu lực thật, mô hình Hybrid Monetization
(Free Forever + Paid Subscription) thay cho trial hết hạn, bảng `Role`/`Permission` làm nguồn sự thật RBAC, storefront tenant theo section CMS + hộp thư liên hệ (ADR-023),
chuẩn độ rộng layout 1280px (ADR-024), tenant chỉ sở hữu nội dung storefront — header/footer và trang con là của
hệ thống (ADR-025), editor sản phẩm GĐ1 — danh mục bắt buộc khi xuất bản, link tài liệu ngoài, sửa bảo mật upload
(ADR-026), mô tả ngắn/ảnh bìa Cloudinary/Xem trước/chế độ hiển thị (ADR-027), ảnh nội dung trên Cloudinary hệ thống
+ hạn mức ảnh theo gói + siết chữ ký upload (ADR-028), M10 GĐ1 — Đánh giá M10a + Bài viết M10b, siết RLS ghi 7 bảng L2
(ADR-029, [[01-Architecture-Decisions/ADR-015-M10-Reviews-Posts-Rls-Split-Writes|ADR-015 KB]]), URL tài liệu rút gọn
`/{tenantSlug}/{productSlug}` + slug dành riêng + bỏ card xuất bản dính (ADR-030,
[[01-Architecture-Decisions/ADR-016-Short-Product-Url-No-Sticky-Publish-Card|ADR-016 KB]]), deploy Vercel — build không cần
DB/env, root layout `force-dynamic`, `PRISMA_MIGRATE_URL` không bao giờ ở runtime (ADR-031,
[[01-Architecture-Decisions/ADR-017-Vercel-Deploy-Build-Without-Env|ADR-017 KB]]), cấu hình hệ thống + thương hiệu lấy từ System
Center (DB), env runtime chỉ còn 8 biến, kèm sự cố 2026-10-15 và quy tắc migration expand → contract (ADR-032,
[[01-Architecture-Decisions/ADR-018-System-Settings-And-Brand-From-System-Center|ADR-018 KB]]), trang chủ hệ thống dùng dữ liệu thật +
cột cache `products.soldCount` (ADR-033, [[01-Architecture-Decisions/ADR-019-Home-Page-Real-Data-Sold-Count|ADR-019 KB]]), một database
duy nhất cho dev/Preview/production + kỷ luật thao tác DB (ADR-034,
[[01-Architecture-Decisions/ADR-020-Single-Database-Dev-Preview-Production|ADR-020 KB]]). Tổng cộng 34 ADR gốc.
([Đường dẫn](../01-Architecture-Decisions/README.md))

### 2. [[02-System-Specs/README|02-System-Specs]] — Đặc tả Hệ thống Sống (Living Specs)
Đặc tả các luồng nghiệp vụ đang hoạt động thật trong code, theo từng module đã hoàn thành ở `docs/PLAN.md`
(M0–M9): xác thực & định danh, tenant workspace & storefront, System Admin console, billing/subscription &
entitlement, cấu hình thanh toán tenant, sản phẩm & giá & khuyến mãi, checkout & vòng đời đơn hàng, thư viện/
tải xuống/share link, storefront CMS + form liên hệ (ADR-023,
[[02-System-Specs/Storefront-CMS-Specs|Storefront-CMS-Specs]]), editor sản phẩm + điều kiện xuất bản + link tài liệu
ngoài + trang Xem trước + URL tài liệu `/{tenantSlug}/{productSlug}` và slug dành riêng (ADR-026/027/030,
[[02-System-Specs/Product-Editor-And-Publishing-Specs|Product-Editor-And-Publishing-Specs]]), ảnh Cloudinary hệ thống + hạn mức ảnh
(ADR-028, [[02-System-Specs/File-Storage-And-Downloads-Specs|File-Storage-And-Downloads-Specs]] §7), đánh giá sản phẩm M10a
(ADR-029, [[02-System-Specs/Reviews-Specs|Reviews-Specs]]), bài viết tối giản M10b (ADR-029, [[02-System-Specs/Posts-Specs|Posts-Specs]]), cùng ranh giới RLS theo layer L1/L2/L3 (tách policy đọc/ghi từ ADR-029).
([Đường dẫn](../02-System-Specs/README.md))

### 3. [[03-API-Contracts/README|03-API-Contracts]] — Chuẩn Giao tiếp & Data Models
Hợp đồng dữ liệu giữa client và server: danh bạ route (`apps/web/app/api/**/route.ts` + Server Action),
lược đồ Prisma (`packages/db/prisma/schema.prisma`) theo layer, và mẫu response lỗi chuẩn
`{ error: { code, message, requestId } }`; kèm contract Server Action của editor sản phẩm Studio
(`ProductActionState`, [[03-API-Contracts/Endpoint-Directory|Endpoint-Directory]] §10) và action ảnh Cloudinary tenant
(`CloudinarySignatureResult`, `registerTenantImageAction`, §11) và action/hàm đánh giá M10a (§12), action/hàm bài viết M10b (§13).
([Đường dẫn](../03-API-Contracts/README.md))

### 4. [[04-Operations-Runbooks/README|04-Operations-Runbooks]] — Vận hành, Kiểm thử & Triển khai
Cẩm nang thao tác: chạy dev/test/build (bảng lệnh `CLAUDE.md`), cấu hình `.env`, cấu hình cổng thanh toán/
lưu trữ qua System Admin (`/admin/settings/storage`, `/admin/billing/payment`), và các bước smoke-test thủ
công đã dùng để bắt lỗi thật (ví dụ lỗi CSP chặn hydrate React, seed thiếu `UserProfile`) trong các module
trước.
Hệ thống thiết kế UI (token, chuẩn độ rộng layout 1280px theo ADR-024, kit component, editor sản phẩm 2 cột + card xuất bản
đầu sidebar (không dính khi cuộn — ADR-030) + trang Xem trước theo ADR-026/027, TiptapEditor upload ảnh theo ADR-028, giao diện đánh giá M10a §10, giao diện bài viết M10b §11, trang chủ dữ liệu thật + PinPicker + form "Cấu hình chung" §12 — ADR-032/033) ở
[[04-Operations-Runbooks/UI-Design-System|UI-Design-System]] ([UI-Design-System.md](../04-Operations-Runbooks/UI-Design-System.md)).
Deploy lên Vercel (ADR-031/032: cấu hình project, 8 biến env runtime + biến cần xoá, chuẩn bị DB prod, worker pg-boss cần host
riêng, sự cố đã gặp, **quy trình migration expand → contract + kỷ luật một DB duy nhất (ADR-034) sau sự cố 2026-10-15**) ở
[[04-Operations-Runbooks/Deploy-Vercel-Runbook|Deploy-Vercel-Runbook]] ([Deploy-Vercel-Runbook.md](../04-Operations-Runbooks/Deploy-Vercel-Runbook.md)).
Script dữ liệu demo **chỉ cho dev** (`demo:seed`/`demo:clean`, đánh giá trên tenant `phongweb`) ở
[[04-Operations-Runbooks/Dev-Demo-Data-Runbook|Dev-Demo-Data-Runbook]] ([Dev-Demo-Data-Runbook.md](../04-Operations-Runbooks/Dev-Demo-Data-Runbook.md)).
([Đường dẫn](../04-Operations-Runbooks/README.md))

### 5. [[05-Historical-Archive/README|05-Historical-Archive]] — Lịch sử thật, không bịa (Cold Storage)
Gieo Chữ còn ở giai đoạn rất sớm (18 commit git, 2026-09-17 → 2026-09-20) nên thư mục này **nhỏ và có chủ
đích** — chỉ 3 trang dựng từ nguồn thật: [[Module-Build-History]] (đối chiếu `docs/PLAN.md` với git log thật),
[[Architecture-Decisions-Timeline]] (mục lục đủ 34 ADR, ADR-001…ADR-034), [[Known-Gaps-And-Backlog]] (từ `docs/BACKLOG.md`).
Không có báo cáo/sprint log giả lập nào được tạo thêm cho khớp quy mô một dự án lâu năm.
([Đường dẫn](../05-Historical-Archive/README.md))

### 6. [[06-AI-Agent-Guides/README|06-AI-Agent-Guides]] — Hướng dẫn cho AI Agent
[[06-AI-Agent-Guides/Team-Charter|Team-Charter]] ghi lại cách đội vận hành: Quốc (phiên chính, điều phối)
cùng 3 sub-agent Long (`long`, tài liệu), Hiếu (`hieu`, code logic/dữ liệu) và Phong (`phong`, UX/UI — skill
`ui-ux-pro-max`, design layout) định nghĩa ở `.claude/agents/*.md` — phân vùng tri thức, quy trình một task, mẫu
brief — cùng 2 file mẫu dùng chung nhiều project
(`AGENTS-TEAM-OPERATING-TEMPLATE.md`, `CLAUDE-ORCHESTRATOR-TEMPLATE.md`).
([Đường dẫn](../06-AI-Agent-Guides/README.md))

### 📎 Trang quản trị KB
- [[Product-Overview]]: Giới thiệu sản phẩm ở góc nhìn nghiệp vụ ([Đường dẫn](./Product-Overview.md))
- [[KB-Audit-2026-09-26]]: Trạng thái xác minh của KB này — việc gì đã đối chiếu code, việc gì còn cần kiểm
  trong môi trường thật ([Đường dẫn](./KB-Audit-2026-09-26.md))
- [[Tags-Dictionary]]: Từ điển thẻ dùng trong KB ([Đường dẫn](./Tags-Dictionary.md))

### 📄 Báo cáo gốc trong `docs/`
- Báo cáo rà soát xử lý tài liệu sản phẩm & trang Studio Tạo/Sửa sản phẩm (2026-09-26) — đầu vào đã dẫn tới
  ADR-026/027 (§2.2 có đính chính 2026-09-27 về `storageUsedBytes` khi gỡ file) ([bao-cao-xu-ly-tai-lieu-san-pham-2026-09-26.md](../../docs/bao-cao-xu-ly-tai-lieu-san-pham-2026-09-26.md))
- Báo cáo rà soát lưu trữ ảnh Cloudinary cho editor mô tả: Cloudinary hệ thống vs tenant tự mang (BYO) vs lai,
  ước tính chi phí, khuyến nghị (2026-09-27 — chủ dự án đã quyết thành ADR-028) ([bao-cao-luu-tru-anh-cloudinary-2026-09-27.md](../../docs/bao-cao-luu-tru-anh-cloudinary-2026-09-27.md))
- Kế hoạch chi tiết M10 — Social Feed và Đánh giá: đánh giá lại đặc tả sau ADR-021…028, đề xuất tách M10a/b/c,
  dữ liệu + RLS, ngân sách test, 14 câu hỏi cần chốt (2026-09-27 — chủ dự án đã quyết thành ADR-029; M10a và M10b xong code, chưa có test) ([ke-hoach-M10-social-feed-danh-gia-2026-09-27.md](../../docs/ke-hoach-M10-social-feed-danh-gia-2026-09-27.md))

---

## 🔍 Hướng Dẫn Điều Hướng Cho AI Agent

1. **Khi bắt đầu một task mới:** đọc file này (`00-Index/MOC-Home.md`) để xác định đúng tài liệu spec cần
   tra cứu, nhưng **luôn đối chiếu lại với `docs/PLAN.md`/`docs/DECISIONS.md`/code thật** — KB này có thể
   trễ hơn tiến độ module thật (tại 2026-09-28: M10a + M10b xong code — M10 GĐ1 hoàn tất code, nợ test; M10c/M12 chưa làm).
2. **Quy tắc bất biến:** luôn đối chiếu với `01-Architecture-Decisions/` trước khi đề xuất bất kỳ thay đổi
   kiến trúc nào — đặc biệt ranh giới layer và RLS.
3. **Độ tin cậy:** khi spec trong KB và code/`docs/*.md` gốc xung đột — **code và `docs/*.md` gốc luôn là
   chân lý**, không phải trang KB này.
4. **Từ điển thẻ:** tra cứu ý nghĩa thẻ tại [[Tags-Dictionary]] ([Tags-Dictionary.md](./Tags-Dictionary.md)).

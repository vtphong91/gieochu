---
tags:
  - meta
  - index
  - taxonomy
date: 2026-09-26
updated: 2026-10-15
author: System Architect
---

# 🏷️ Từ Điển Thẻ Tri Thức (Tags Dictionary)

Tài liệu này định nghĩa hệ thống thẻ (tag taxonomy) dùng xuyên suốt **Gieo Chữ Obsidian Knowledge Base**,
giúp phân loại nội dung và tra cứu nhanh cho người và AI agent đọc KB. Danh sách này không cần đầy đủ tuyệt
đối — chỉ cần bao quát những gì thực sự được gắn thẻ trong các file của KB.

---

## 1. Thẻ theo Phân loại Tài liệu (Document Type)

| Thẻ | Ý nghĩa & Mục đích | Sử dụng tại thư mục |
| :--- | :--- | :--- |
| `#meta` | Tài liệu quản trị, chỉ dẫn hoặc danh mục của kho tri thức | `00-Index/` |
| `#adr` | Quyết định kiến trúc bất biến (Architecture Decision Record) — tương ứng ADR trong `docs/DECISIONS.md` | `01-Architecture-Decisions/` |
| `#spec` | Bản đặc tả sống của một luồng nghiệp vụ/module đang hoạt động thật trong code | `02-System-Specs/` |
| `#contract` | Định nghĩa API route, payload, hoặc lược đồ dữ liệu (Prisma schema) | `03-API-Contracts/` |
| `#runbook` | Hướng dẫn quy trình vận hành, triển khai, hoặc xử lý sự cố | `04-Operations-Runbooks/` |
| `#audit` | Kết quả rà soát/đối chiếu tri thức với code thật, đánh dấu mức xác minh | `00-Index/` |
| `#ai` | Hướng dẫn vận hành cho AI agent (không phải đặc tả nghiệp vụ hệ thống) | `06-AI-Agent-Guides/` |
| `#archive` | Tài liệu lịch sử (báo cáo, đề xuất, ADR cũ đã áp dụng) lưu để tham chiếu | `05-Historical-Archive/` |

---

## 2. Thẻ theo Nghiệp vụ Cốt lõi (Business Domain)

| Thẻ | Phạm vi nghiệp vụ áp dụng |
| :--- | :--- |
| `#tenant` | Tenant workspace, storefront, onboarding, slug, branding |
| `#billing` | Subscription, plan, hoá đơn, mô hình Free Forever + Paid (M3 v2) |
| `#payment` | Cổng thanh toán Platform và Tenant (SePay/MoMo/VietQR QR thủ công), webhook, mã hoá secret |
| `#order` | Checkout, vòng đời đơn hàng, khuyến mãi/coupon |
| `#product` | Sản phẩm (tài liệu số), file đính kèm, upload, giá |
| `#download` | Thư viện khách hàng, token tải file, share link |
| `#rbac` | Phân quyền — `SystemRole`/`TenantMemberRole`, bảng `Role`/`Permission` (ADR-022) |
| `#auth` | Đăng ký/đăng nhập, JWT, refresh token, xác minh email |
| `#system-admin` | Console quản trị cấp hệ thống (L1) |
| `#customer` | Trải nghiệm khách hàng mua tài liệu |
| `#reviews` | Đánh giá sản phẩm của khách đã mua (M10a, ADR-029): quyền đánh giá, kiểm duyệt/trả lời của tenant, điểm trung bình |
| `#posts` | Bài viết tối giản của tenant (M10b, ADR-029): trạng thái DRAFT/PUBLISHED/HIDDEN, ghim, gắn tài liệu, trang `/[slug]/posts`, section `posts` |
| `#marketplace` | Trang Cửa hàng tổng hợp tài liệu mọi tenant (ADR-035): CMS `shop` ở System Center (GĐ1), `/cua-hang` + `/cua-hang/tai-lieu` (GĐ2) |

---

## 3. Thẻ theo Kỹ thuật & Hạ tầng (Tech & Infrastructure)

| Thẻ | Phạm vi kỹ thuật |
| :--- | :--- |
| `#database` | Prisma schema, Neon PostgreSQL, migration, RLS policy |
| `#rls` | Row-Level Security — 4 scope `withTenant/withCustomer/withPublic/withSystemJob` |
| `#security` | Mã hoá secret (AES-256-GCM), hash token, cookie httpOnly, CSP |
| `#storage` | Upload file, presigned URL, S3-compatible bucket (Cloudflare R2/MinIO) |
| `#jobs` | Background job/cron qua `packages/jobs` (pg-boss) |
| `#ui-ux` | Giao diện & trải nghiệm: bố cục, component, accessibility, responsive (owner thiết kế: Phong) |
| `#design-system` | Design token (màu, font trong `theme.ts`), kit component dùng chung `admin/_ui/` |
| `#seo` | URL công khai/canonical, metadata, sitemap/robots (vd URL tài liệu rút gọn — ADR-030) |
| `#deployment` | Triển khai production: hosting Vercel, env runtime, migration prod, worker (vd ADR-031, `Deploy-Vercel-Runbook`) |
| `#dev-tool` | Công cụ/script **chỉ dành cho môi trường dev** (vd dữ liệu demo `demo:seed`) — không chạy trên staging/production |

---

## 4. Thẻ theo Trạng thái Tài liệu (Lifecycle Status)

| Thẻ | Trạng thái |
| :--- | :--- |
| `#status/proposed` | Đề xuất đang trong quá trình thảo luận, chưa chốt |
| `#status/accepted` | Đã được quyết định và đang áp dụng chính thức (thường đi kèm một ADR trong `docs/DECISIONS.md`) |
| `#status/living` | Bản đặc tả/tài liệu sống, cập nhật đồng bộ với code mỗi khi module thay đổi |
| `#status/archive` | Tài liệu lịch sử, không còn cập nhật, giữ lại để tham chiếu ngữ cảnh |

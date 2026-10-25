---
tags:
  - meta
  - index
  - taxonomy
date: 2026-09-26
updated: 2026-10-25
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
| `#billing` | Subscription, plan, hoá đơn, mô hình Free Forever + Paid (M3 v2); lịch sử hoá đơn gói + trang "Đơn hàng gói dịch vụ" ở System Center (ADR-056) |
| `#payment` | Cổng thanh toán Platform và Tenant (SePay/MoMo/VietQR QR thủ công), webhook, mã hoá secret; khối chuyển khoản tải QR + sao chép `BankTransferPanel` (ADR-056) |
| `#order` | Checkout, vòng đời đơn hàng, khuyến mãi/coupon; trang Đơn hàng Studio — danh sách + chi tiết (ADR-046), tìm không dấu + ghi chú nội bộ `order_notes` (ADR-047, `Studio-Orders-Specs`) |
| `#product` | Sản phẩm (tài liệu số), file đính kèm, upload, giá |
| `#download` | Thư viện khách hàng, token tải file, share link |
| `#rbac` | Phân quyền — `SystemRole`/`TenantMemberRole`, bảng `Role`/`Permission` (ADR-022) |
| `#auth` | Đăng ký/đăng nhập, JWT, refresh token, xác minh email |
| `#autosave` | Tự lưu nháp editor lên server (ADR-053 bổ sung lần 3): bảng `tenant_editor_drafts`/`system_editor_drafts`, hook `useServerAutosave`, xung đột revision (`Editor-Autosave-Drafts-Specs`) |
| `#session` | Phiên đăng nhập (ADR-053): "Ghi nhớ đăng nhập", idle/absolute timeout, ân hạn refresh, danh sách thiết bị (`Auth-Session-Specs`) |
| `#system-admin` | Console quản trị cấp hệ thống (L1) |
| `#customer` | Trải nghiệm khách hàng mua tài liệu; danh sách Khách hàng Studio `/studio/{slug}/customers` — số liệu khách, nhóm, ghi chú khách (ADR-048, `Studio-Customers-Specs`) |
| `#reviews` | Đánh giá sản phẩm của khách đã mua (M10a, ADR-029): quyền đánh giá, kiểm duyệt/trả lời của tenant, điểm trung bình |
| `#posts` | Bài viết tối giản của tenant (M10b, ADR-029): trạng thái DRAFT/PUBLISHED/HIDDEN, ghim, gắn tài liệu, trang `/[slug]/posts`, section `posts` |
| `#marketplace` | Trang Cửa hàng tổng hợp tài liệu mọi tenant (ADR-035): CMS `shop` ở System Center (GĐ1), `/cua-hang` + `/cua-hang/tai-lieu` (GĐ2) |
| `#audit-log` | Nhật ký hành động `audit_logs` (M12a, ADR-037): bảng L1 chỉ-INSERT, action/scope, `audit.log`, trang `/admin/audit` và Studio → Hoạt động. Khác `#audit` (rà soát tri thức KB) |
| `#analytics` | Số liệu tổng hợp/thống kê (M12b, ADR-037): bảng `tenant_daily_stats`, job `stats.aggregate`, dashboard "Hoạt động bán tài liệu" trên `/admin` — chỉ số tổng hợp, không dữ liệu cá nhân (§7.9); và dashboard Tổng quan gian hàng `/studio/{slug}` (ADR-043, `Studio-Dashboard-Specs`) — số liệu theo kỳ tính realtime từ bảng L2 qua `withTenant` |
| `#abuse-report` | Báo cáo vi phạm (M12c, ADR-038): bảng L1 `abuse_reports`, `POST /api/reports`, xử lý ở `/admin/reports`, ẩn danh với tenant |
| `#moderation` | Khoá kiểm duyệt nội dung (ADR-038): `moderationLockedAt` trên sản phẩm/đánh giá/bài viết, trigger `*_guard_moderation`, cam kết bản quyền khi xuất bản |
| `#pricing` | Trang Bảng giá `/pricing` + CMS `pricing` ở System Center (ADR-041 A): thẻ gói, gói năm ghép cặp, bảng so sánh, CTA theo người xem. Khác engine giá tài liệu `packages/core/src/pricing` (M6, dùng `#order`/`#product`) |
| `#account` | Khu vực tài khoản cá nhân `/account` (ADR-041 C): hồ sơ, ảnh đại diện, đổi mật khẩu, đổi email, menu tài khoản |
| `#cms` | CMS hệ thống ở System Center lưu nội dung trang công khai trong `cms_pages` (slug hệ thống `home`/`shop`/`pricing`/`menu`): menu header/footer, trang chủ theo brief, nháp/xuất bản/khôi phục (ADR-050, `System-Cms-Menu-Home-Seo-Specs`) |
| `#legal` | Văn bản pháp lý có phiên bản + ghi nhận chấp thuận theo phiên bản (ADR-050, ADR-054): `legal_documents`, `legal_document_versions`, `user_legal_acceptances`, 7 URL cấp gốc (`/dieu-khoan-su-dung`…`/lien-he`; `/phap-ly/*` redirect 308), `/admin/cms/phap-ly` (`Legal-Documents-Specs`, `Legal-Terms-Publishing-Runbook`) |
| `#entitlement` | Quyền tải của người mua (`entitlements`) — lượt tải, thu hồi, quyền lợi khi tài liệu bị gỡ do vi phạm (ADR-039: tải lần cuối / yêu cầu hoàn tiền) |

---

## 3. Thẻ theo Kỹ thuật & Hạ tầng (Tech & Infrastructure)

| Thẻ | Phạm vi kỹ thuật |
| :--- | :--- |
| `#database` | Prisma schema, Neon PostgreSQL, migration, RLS policy |
| `#rls` | Row-Level Security — 4 scope `withTenant/withCustomer/withPublic/withSystemJob` |
| `#security` | Mã hoá secret (AES-256-GCM), hash token, cookie httpOnly, CSP |
| `#storage` | Upload file, presigned URL, S3-compatible bucket (Cloudflare R2/MinIO) |
| `#minio` | MinIO tự host (S3-compatible) làm Storage Service: cấu hình, bucket riêng gian hàng, giám sát/đối soát dung lượng (ADR-044, ADR-052) |
| `#cloudflare-r2` | Cloudflare R2 làm Storage Service song song MinIO (ADR-044, ADR-052) |
| `#admin` | Trang/chức năng quản trị ở System Center `/admin` (vd giám sát bucket ADR-052); gần nghĩa `#system-admin` |
| `#jobs` | Background job/cron qua `packages/jobs` (pg-boss) — từ ADR-036 xử lý trong app bằng `after()` + Vercel Cron `/api/cron/daily` (`Background-Jobs-Specs`) |
| `#ui-ux` | Giao diện & trải nghiệm: bố cục, component, accessibility, responsive (owner thiết kế: Phong) |
| `#design-system` | Design token (màu, font trong `theme.ts`), kit component dùng chung `admin/_ui/` |
| `#seo` | URL công khai/canonical, metadata, sitemap/robots (vd URL tài liệu rút gọn — ADR-030; ô SEO CMS + bộ giới hạn SEO chung 120/320 — ADR-050) |
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

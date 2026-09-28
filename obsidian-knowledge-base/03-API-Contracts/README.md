---
tags:
  - meta
  - contract
date: 2026-09-26
updated: 2026-09-28
---

# 🔌 API Contracts & Data Interface

Thư mục này quy định **hợp đồng giao diện dữ liệu** giữa các tầng trong hệ thống Gieo Chữ — nền tảng SaaS đa
tenant nơi giáo viên/coach bán tài liệu số cho học viên.

## Danh mục Hợp đồng

- `[[Endpoint-Directory]]` — Danh bạ 20 route HTTP thật dưới `apps/web/app/api/**` + 1 route redirect ngoài `/api` (ADR-030, §5.1) (Auth, tài khoản, storefront
  công khai, upload Studio, downloads/share links, admin, webhooks) kèm cơ chế xác thực và định dạng phản hồi
  lỗi chuẩn (`{ error: { code, message, requestId } }`); §10 ghi contract Server Action của editor sản phẩm Studio
  (`ProductActionState`, field FormData — ADR-026/027); §11 contract ảnh Cloudinary hệ thống
  (`CloudinarySignatureResult`, `registerTenantImageAction`, mã lỗi hạn mức — ADR-028); §12 action/hàm lib đánh giá
  M10a (`upsertMyReviewAction`, action kiểm duyệt Studio, `PublicReview`, mã lỗi `REVIEW_*` — ADR-029); §13 action/hàm lib bài viết M10b (`createPostAction`… `PostActionState`,
  `listPublishedPosts`, mã lỗi `POST_*`, subpath `@gieochu/core/post` — ADR-029).
- `[[Database-Schema-Reference]]` — Lược đồ 42 model + 24 enum trong `packages/db/prisma/schema.prisma`, phân
  theo layer L1 (System) / L2 (Tenant, RLS) / L3 (góc nhìn Customer trên bảng L2), cùng quy ước cuid2 (ADR-001),
  mã hoá secret AES-256-GCM (§7.3 CLAUDE.md), và bảng RBAC `Role`/`Permission`/`RolePermission` (ADR-022); §7 ghi RLS tách đọc/ghi 7 bảng, quy tắc bảng L2 mới và mẫu
  trigger giới hạn cột theo scope (ADR-029); migration M10b bảng `posts` (partial unique index ghim, 2 trigger).

> [!NOTE] Đã xoá `Store-Factory-Architecture.md`
> File này từng mô tả mẫu "Store Factory" (`getXStore()` trừu tượng hoá Prisma Store vs In-Memory Store) —
> **không áp dụng cho Gieo Chữ**. Gieo Chữ không có tầng store/dual-implementation nào: route handler và
> Server Action gọi thẳng `getPrismaClient()` (bảng L1) hoặc `withTenant`/`withCustomer`/`withPublic`/
> `withSystemJob` (`packages/db/src/rls.ts`, bảng L2 có RLS). Không có gì để thay thế file này — quyết định là
> xoá, không viết lại tương đương giả.

*Quay lại: [[MOC-Home]] ([MOC-Home.md](../00-Index/MOC-Home.md))*

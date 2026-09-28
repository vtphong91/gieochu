---
tags:
  - adr
  - security
  - rbac
  - permissions
  - status/accepted
date: 2026-09-26
decider: vtphong91
status: Accepted (Chốt — Áp dụng chính thức)
---

# 🏛️ ADR-008: Bảng `Role`/`Permission` (RBAC) Là Nguồn Sự Thật Cho Quyền Truy Cập Module

## 1. Trạng Thái (Status)
**ĐÃ PHÊ DUYỆT (Accepted)** — Áp dụng cho toàn bộ logic phân quyền module (không thay thế RLS — xem mục 4).

---

## 2. Bối Cảnh (Context)
Bug thực tế được báo cáo: đăng nhập bằng tài khoản chủ tenant bị redirect về trang chủ khách hàng thay vì `/studio/{slug}`, vì trang login chỉ rẽ nhánh `role === "SYSTEM_ADMIN" ? "/admin" : "/"` — hoàn toàn không biết user có sở hữu tenant hay không.

Đây là triệu chứng của việc hệ thống **thiếu một nơi rõ ràng để trả lời câu hỏi "user này được vào module nào"**. Người dùng yêu cầu bổ sung bảng role thật (không chỉ một hàm gộp tạm) — đã hỏi lại và người dùng chọn rõ hướng RBAC đầy đủ thay vì bản tối giản.

---

## 3. Quyết Định (Decision)
1. Thêm 3 bảng L1 mới — `Role`, `Permission`, `RolePermission` — dùng chung 1 `RoleScope` (`SYSTEM` | `TENANT`), seed sao cho `Role.code` khớp 1-1 với giá trị enum hiện có (`SYSTEM_ADMIN`, `TENANT_OWNER`, `TENANT_STAFF`).
2. **Không** đổi `User.systemRole`/`TenantMember.role` (2 enum hiện có) thành khoá ngoại — chúng tiếp tục là nhãn định danh nhẹ trong JWT/DB. `Role`/`Permission` trở thành nguồn sự thật duy nhất cho "tier này được làm gì" (`apps/web/lib/permissions.ts`: `hasSystemPermission`/`hasTenantPermission`), thay cho hàm hardcode TypeScript trước đây.
3. Sửa bug cụ thể: hàm xác định trang đích sau đăng nhập kiểm tra quyền `system:view_admin_dashboard` trước, sau đó tra `Tenant.ownerId` để lấy `tenant.slug` (không bao giờ dùng `user.id` trong URL), cuối cùng fallback về trang chủ. Route đăng nhập trả thêm đường dẫn đích trong response; trang login dùng trực tiếp thay vì tự suy role.

**Vì sao không đổi enum thành FK ngay:** `SystemRole` chỉ có 2 giá trị thật; chuẩn hoá thành bảng join không mang lại gì trong khi buộc đổi shape JWT, chữ ký hàm `requireRole()`, và hàng chục call site trong một lần — đi ngược nguyên tắc không over-engineer. Các guard hiện có (`requireRole`/`requireAdminAccess`/`requireTenantMember`/`requireTenantMemberPage`) giữ nguyên không đổi.

---

## 4. Hệ Quả & Ràng Buộc Kỹ Thuật (Consequences & Rules)
* **RBAC là lớp tách biệt, chạy trước/song song RLS — không thay thế RLS.** Quyết định này không đụng tới các policy RLS hay helper `withTenant`/`withCustomer`/`withPublic`/`withSystemJob`.
* **Chưa làm trong đợt này** (ghi rõ để tránh hiểu nhầm đã hoàn tất): migrate các call site cũ sang gọi permission-code trực tiếp; UI chỉnh ma trận quyền cho `TENANT_STAFF`; luồng mời STAFF/tạo row `TenantMember` role STAFF thật; xoá code RBAC cũ (`packages/auth/src/rbac.ts`'s `can()`) — vẫn còn unit test riêng, xoá sẽ đổi số test cố định, phải hỏi lại người dùng trước theo quy ước "không thêm/bớt số lượng test case nếu chưa hỏi".
* Mọi module mới cần kiểm tra quyền theo module (không phải theo role cứng) phải seed `Permission` tương ứng và tra qua `hasSystemPermission`/`hasTenantPermission` — không viết lại điều kiện `role === "..."` rải rác trong code.

---

## 5. Tài Liệu Tham Chiếu & Liên Kết
* [[MOC-Home]] — Trang chủ Map of Content ([MOC-Home.md](../00-Index/MOC-Home.md))
* Tương ứng **ADR-022** trong [`docs/DECISIONS.md`](../../docs/DECISIONS.md) (gốc repo).
* Xem CLAUDE.md, mục "Ranh giới layer (không phá vỡ)" cho quan hệ giữa RBAC và L1/L2/L3.

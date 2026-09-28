---
tags:
  - adr
  - tenant
  - rls
  - security
  - status/accepted
date: 2026-09-26
decider: vtphong91
status: Accepted (Chốt — Áp dụng chính thức)
---

# 🏛️ ADR-009: Storefront Tenant Quản Lý Bằng Section CMS, Form Liên Hệ Lưu Hộp Thư L2

## 1. Trạng Thái (Status)
**ĐÃ PHÊ DUYỆT (Accepted)** — Áp dụng cho storefront công khai `/[tenantSlug]` và 2 trang Studio
`/studio/[tenantSlug]/storefront`, `/studio/[tenantSlug]/messages`.

> **Bị thay thế một phần (2026-09-26):** phần header/footer/menu anchor riêng của tenant (và "Footer" trong danh sách
> section mẫu ở §2) đã bị [[01-Architecture-Decisions/ADR-011-Tenant-Owns-Storefront-Content-Only|ADR-011 (≙ ADR-025)]]
> thay thế — header/footer trên mọi trang public là của hệ thống; mạng xã hội tenant chuyển vào khối CTA section Liên
> hệ; trang chi tiết sản phẩm là trang hệ thống. Các quyết định về schema section, lưu trữ, hộp thư, RLS, upload ảnh
> dưới đây vẫn hiệu lực.

---

## 2. Bối Cảnh (Context)
Chủ dự án yêu cầu storefront `/[tenantSlug]` có đủ các section của một mẫu portfolio (Hero, Dịch vụ, Tài liệu,
Đánh giá, Form liên hệ + CTA, Footer), và tenant tự quản lý nội dung **theo đúng cách System Admin đang quản lý
CMS trang chủ**. Chủ dự án đã chốt 4 điểm: form liên hệ **lưu hộp thư + email báo**; ảnh upload qua
**Cloudinary hệ thống**; section Tài liệu **tự động lấy từ sản phẩm PUBLISHED**; **không thêm test case** đợt
này (section chưa có dữ liệu dùng nội dung demo, bổ sung test khi chạy test toàn hệ thống).

---

## 3. Quyết Định (Decision)
1. **Schema section** `storefrontSectionsSchema` (`packages/core`): mảng có thứ tự `{ id, type, visible, data }`,
   discriminated union theo `type` — `hero`, `services`, `products`, `testimonials`, `contact`. Tenant chỉ sửa
   **nội dung** (text/ảnh/link); bố cục, màu (theo `Tenant.branding`), icon trang trí do code quyết định — cùng
   mô hình `homeSectionsSchema` của CMS trang chủ.
2. **Lưu trữ:** 2 cột Json trên `tenants` — `storefrontSections` (bản live) và `storefrontSectionsDraft` (nháp),
   quy trình Lưu nháp / Xuất bản / Khôi phục bản live giống `CmsPage.blocks/blocksDraft`. Không tạo bảng riêng vì
   1 tenant = 1 storefront và `tenants` không có RLS (cùng cách lưu `branding`). Cột null → nội dung demo sinh
   trong code (`defaultStorefrontSections`).
3. **Nội dung demo:** tenant chưa từng xuất bản → khách thấy các section demo **trừ `testimonials`** (đánh giá mẫu
   hiển thị công khai là thông tin sai lệch với người mua); chủ tenant xem trang của mình thấy đủ kèm nhãn
   "Nội dung mẫu".
4. **Quyền sửa:** Server Actions trong `/studio/[tenantSlug]/storefront`, guard `requireTenantMember`, validate lại
   bằng zod ở server, `revalidatePath` trang public khi xuất bản.
5. **Form liên hệ — bảng L2 mới `storefront_messages` có RLS:** scope public **chỉ INSERT**; scope tenant
   SELECT/UPDATE/DELETE đúng tenant. **Không lưu IP thô** — chỉ `ipHash` = HMAC-SHA256(ip) với khoá
   `JWT_ACCESS_SECRET` và nhãn tách miền `storefront-ip:` (không thêm biến env mới). Chống spam: honeypot + rate
   limit in-memory (`lib/rate-limit.ts`) 3 tin/10 phút theo `ipHash`, 50 tin/giờ theo tenant (public không có
   SELECT nên không đếm bằng DB được). Ghi bằng Server Action `submitStorefrontContactAction` (CSRF sẵn có của
   Next, §7.7), INSERT không `RETURNING` (`createMany`). Email báo chủ tenant qua SMTP hệ thống trong `after()`;
   gửi lỗi không làm mất tin (tin lưu trước). **System Admin không có đường đọc tin nhắn này** (CLAUDE.md §7.9).
   - **Chấp nhận dùng chung khoá `JWT_ACCESS_SECRET`:** `ipHash` chỉ phục vụ chống spam, không định danh lâu dài;
     xoay khoá JWT chỉ làm hash cũ mất liên kết — vô hại. **Điều kiện tách secret riêng:** khi `ipHash` được dùng
     cho mục đích khác (thống kê, chặn vĩnh viễn).
6. **Upload ảnh:** tái dùng `ImageUploadField` + Cloudinary hệ thống; chữ ký cho tenant sinh bởi **Server Action**
   `getTenantCloudinaryUploadSignatureAction` (guard `requireTenantMember`), folder
   `<uploadFolder>/tenants/<tenantId>/storefront`, `allowed_formats` png/jpeg/webp nằm trong chữ ký. Giới hạn
   **2MB chỉ kiểm phía trình duyệt** — signed upload không có tham số dung lượng; chặn cứng cần upload preset
   (BACKLOG).

---

## 4. Hệ Quả & Ràng Buộc Kỹ Thuật (Consequences & Rules)
* **Mẫu RLS mới — policy tách theo lệnh** (khác mẫu 1 policy `tenant_isolation` của các bảng L2 trước): vì scope
  public không có SELECT, code ghi phải dùng INSERT **không** `RETURNING` (Prisma `createMany`, không `create`).
  Chi tiết: [[02-System-Specs/Storefront-CMS-Specs|Storefront-CMS-Specs]] §5. Từ ADR-029 mẫu này thành **quy tắc bắt
  buộc** cho mọi bảng L2 có nhánh public/customer, và 7 bảng cũ đã được tách theo lệnh ([[01-Architecture-Decisions/ADR-015-M10-Reviews-Posts-Rls-Split-Writes|ADR-015 (≙ ADR-029)]]).
* **Mọi link/ảnh do tenant nhập bị lọc ngay ở schema** (không chỉ ở UI): href chỉ `#anchor`, `/path` (không `//`)
  hoặc `http(s)`; ảnh chỉ `https://res.cloudinary.com/...` (khớp CSP `img-src`).
* **Nợ (ghi `docs/BACKLOG.md`):** chưa có test cho schema section, quyền sửa và RLS `storefront_messages` (ngân sách
  `test:count` cần chủ dự án duyệt lại); thời hạn lưu tin nhắn (dữ liệu cá nhân): chủ dự án chốt 2026-09-26 **không tự xoá** — giữ tới khi tenant xoá tay ở
  Studio hoặc tenant bị xoá (FK cascade), xem lại khi có yêu cầu pháp lý/chính sách quyền riêng tư;
  quota Cloudinary dùng chung toàn nền tảng. Khi M10 (Đánh giá) xong, section `testimonials` có thể chuyển sang
  review thật.

---

## 5. Tài Liệu Tham Chiếu & Liên Kết
* [[MOC-Home]] — Trang chủ Map of Content ([MOC-Home.md](../00-Index/MOC-Home.md))
* Tương ứng **ADR-023** trong [`docs/DECISIONS.md`](../../docs/DECISIONS.md) (gốc repo).
* [[01-Architecture-Decisions/ADR-011-Tenant-Owns-Storefront-Content-Only|ADR-011 (≙ ADR-025)]] ([ADR-011-Tenant-Owns-Storefront-Content-Only.md](./ADR-011-Tenant-Owns-Storefront-Content-Only.md)) — thay thế phần header/footer/menu tenant.
* [[02-System-Specs/Storefront-CMS-Specs|Storefront-CMS-Specs]] ([Storefront-CMS-Specs.md](../02-System-Specs/Storefront-CMS-Specs.md)) — đặc tả sống đã đối chiếu code.
* [[04-Operations-Runbooks/UI-Design-System|UI-Design-System]] §8 ([UI-Design-System.md](../04-Operations-Runbooks/UI-Design-System.md)) — theme/primitives storefront.

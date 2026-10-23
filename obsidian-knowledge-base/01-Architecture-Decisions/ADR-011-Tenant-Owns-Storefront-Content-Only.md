---
tags:
  - adr
  - tenant
  - ui-ux
  - status/accepted
date: 2026-09-26
decider: vtphong91
status: Accepted (Chốt — Áp dụng chính thức)
updated: 2026-10-23
---

# 🏛️ ADR-011: Tenant Chỉ Sở Hữu Nội Dung Storefront — Header/Footer Và Trang Con Là Của Hệ Thống

## 1. Trạng Thái (Status)
**ĐÃ PHÊ DUYỆT (Accepted)** — Áp dụng cho mọi trang public. **Thay thế** phần header/footer/menu tenant trong
[[01-Architecture-Decisions/ADR-009-Storefront-Cms-Contact-Inbox|ADR-009 (≙ ADR-023)]] và phần "trang sản phẩm dùng
chung khung storefront" của task ADR-024.

> [!WARNING] Sửa đổi bởi ADR-050 (2026-10-23)
> Header/footer **không còn là chrome cố định**: nội dung menu (mục header ≤ 5, menu con 1 cấp, nút CTA, các cột footer, mô tả, dòng bản quyền)
> do System Admin cấu hình qua CMS slug hệ thống `menu` (`/admin/cms/menu`); **bố cục** header/footer vẫn cố định trong code, và vẫn là của hệ
> thống (tenant không có menu riêng — mục 2 dưới đây giữ nguyên). Xem [[01-Architecture-Decisions/ADR-035-Menu-Home-Seo-Versioned-Terms|ADR-035 KB (≙ ADR-050)]]
> và [[02-System-Specs/System-Cms-Menu-Home-Seo-Specs|System-Cms-Menu-Home-Seo-Specs]] §2. ✅ đối chiếu `site-header.tsx`/`site-footer.tsx` đọc `getSiteMenu()`.

---

## 2. Bối Cảnh (Context)
Bản storefront đầu tiên (ADR-023) dựng header/footer riêng cho tenant (logo tenant, menu anchor, nút Liên hệ, footer
có mạng xã hội), và trang chi tiết sản phẩm cũng mang header/footer + theme tenant. Chủ dự án làm rõ: header/footer
trên mọi trang public là **của hệ thống Gieo Chữ**; tenant **chỉ có 1 trang public duy nhất là storefront**.

---

## 3. Quyết Định (Decision)
1. Header/footer hệ thống tách thành component dùng chung — `apps/web/app/_ui/site-header.tsx`,
   `apps/web/app/_ui/site-footer.tsx` — dùng cho trang chủ, storefront `/[tenantSlug]`, chi tiết sản phẩm, checkout
   (và các trang public hệ thống khác khi có task chạm tới).
2. Storefront `/[tenantSlug]`: giữa header/footer hệ thống là các section CMS của tenant (ADR-023) với màu tenant
   (`--sf-*`). **Không có** header/footer/menu anchor riêng của tenant. Banner "Nội dung mẫu" (chỉ chủ trang) và banner
   READ_ONLY/LOCKED giữ nguyên, đặt ngay dưới header hệ thống.
3. Link mạng xã hội của tenant hiển thị trong khối CTA của section Liên hệ (không còn footer tenant).
4. Trang chi tiết sản phẩm và checkout là **trang hệ thống**: header/footer + màu/font hệ thống, `container-page`
   2 cột (sản phẩm) / `container-narrow` (checkout) theo ADR-024; chỉ nêu tên tenant, không mang giao diện tenant.
   Logic mua hàng M8 không đổi.

---

## 4. Hệ Quả & Ràng Buộc Kỹ Thuật (Consequences & Rules)
* **Lý do:** nền tảng giữ nhận diện và điều hướng thống nhất (khách luôn biết mình đang ở Gieo Chữ, đăng nhập/tài
  khoản ở cùng một chỗ); tenant tuỳ biến trong phạm vi nội dung storefront, tránh mỗi tenant một "website" riêng.
* Trạng thái áp dụng đã đối chiếu code 2026-09-26 ✅: trang chủ, storefront, chi tiết sản phẩm, checkout dùng
  `SiteHeader`/`SiteFooter`; `/pricing` và `/p/[slug]` **chưa** chuyển (việc sau, `docs/BACKLOG.md`).
* Theme tenant (`--sf-*` + font Montserrat) chỉ còn áp trong `<main class="sf-root">` của storefront.
* Chi tiết kỹ thuật UI (component, chiều cao header, `scroll-padding-top`, font hệ thống):
  [[04-Operations-Runbooks/UI-Design-System|UI-Design-System]] §1.1, §8. Nghiệp vụ storefront:
  [[02-System-Specs/Storefront-CMS-Specs|Storefront-CMS-Specs]].

---

## 5. Tài Liệu Tham Chiếu & Liên Kết
* [[MOC-Home]] — Trang chủ Map of Content ([MOC-Home.md](../00-Index/MOC-Home.md))
* Tương ứng **ADR-025** trong [`docs/DECISIONS.md`](../../docs/DECISIONS.md) (gốc repo).
* [[01-Architecture-Decisions/ADR-009-Storefront-Cms-Contact-Inbox|ADR-009 (≙ ADR-023)]] ([ADR-009-Storefront-Cms-Contact-Inbox.md](./ADR-009-Storefront-Cms-Contact-Inbox.md)) — phần bị thay thế.
* [[01-Architecture-Decisions/ADR-010-Layout-Width-Container-Standard|ADR-010 (≙ ADR-024)]] ([ADR-010-Layout-Width-Container-Standard.md](./ADR-010-Layout-Width-Container-Standard.md)) — độ rộng container.
* [[04-Operations-Runbooks/UI-Design-System|UI-Design-System]] ([UI-Design-System.md](../04-Operations-Runbooks/UI-Design-System.md))
* [[02-System-Specs/Storefront-CMS-Specs|Storefront-CMS-Specs]] ([Storefront-CMS-Specs.md](../02-System-Specs/Storefront-CMS-Specs.md))

*Quay lại: [[MOC-Home]] (../00-Index/MOC-Home.md)*

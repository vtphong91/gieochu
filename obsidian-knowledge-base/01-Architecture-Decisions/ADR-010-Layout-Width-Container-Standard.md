---
tags:
  - adr
  - ui-ux
  - design-system
  - status/accepted
date: 2026-09-26
decider: vtphong91
status: Accepted (Chốt — Áp dụng chính thức)
---

# 🏛️ ADR-010: Chuẩn Độ Rộng Layout — Nội Dung Trang Public Tối Đa 1280px, Dùng Utility Chung

## 1. Trạng Thái (Status)
**ĐÃ PHÊ DUYỆT (Accepted)** — Áp dụng cho mọi trang public hiện có và mọi layout phát triển sau.

---

## 2. Bối Cảnh (Context)
Trang chủ hệ thống dàn gần full-width (chỉ lề `lg:px-24`, ~1728px nội dung ở màn 1920px), storefront tenant dùng
container riêng, `/pricing` và `/p/[slug]` mỗi trang một `max-w-*` khác nhau. Sau khi thử 960 / 1140 / 1200 /
1280px trên storefront, chủ dự án chốt **1280px nội dung, căn giữa**, và yêu cầu mọi layout sau theo cùng một
template kích thước.

---

## 3. Quyết Định (Decision)
Ba cấp độ rộng, khai báo **một lần** bằng `@utility` trong `apps/web/app/globals.css` — không rải `max-w-[...]` tuỳ ý
trong từng trang:

| Utility | Nội dung tối đa | Lề ngang (mobile / sm / lg) | Dùng cho |
| :-- | :-- | :-- | :-- |
| `container-page` | **1280px** | 16 / 24 / 32px | Khung chung trang public: header, footer, section trang chủ, storefront, danh sách/chi tiết sản phẩm, pricing |
| `container-prose` | 768px | 16 / 24 / 32px | Trang đọc dài: CMS `/p/[slug]`, chính sách, bài viết |
| `container-narrow` | 448px | 16 / 24px | Form đơn lẻ: checkout, auth card, xác nhận |

- Nền màu/ảnh của section vẫn tràn toàn chiều ngang (full-bleed); chỉ khối nội dung bên trong bọc container.
- Khối con được tự giới hạn nhỏ hơn bên trong container; không khối nào vượt container.
- App shell có sidebar (`/admin/*`, `/studio/*`, `/account/*`) **không** áp `container-page` ở mức trang.

---

## 4. Hệ Quả & Ràng Buộc Kỹ Thuật (Consequences & Rules)
* **Lý do chọn `@utility` thay class arbitrary:** một nguồn duy nhất (đổi 1 chỗ áp mọi trang); và dev server
  Turbopack từng không sinh lại class arbitrary mới trong thư mục `[tenantSlug]` cho tới khi khởi động lại — utility
  khai báo trong CSS gốc không phụ thuộc việc quét nguồn.
* Trang cũ chuyển dần sang utility tương ứng khi có task chạm tới. Cần độ rộng thứ 4 → không tự thêm, phải đổi ADR.
* Quy tắc chi tiết, bảng trạng thái áp dụng từng trang và checklist cho người làm layout:
  [[04-Operations-Runbooks/UI-Design-System|UI-Design-System]] §4.

---

## 5. Tài Liệu Tham Chiếu & Liên Kết
* [[MOC-Home]] — Trang chủ Map of Content ([MOC-Home.md](../00-Index/MOC-Home.md))
* Tương ứng **ADR-024** trong [`docs/DECISIONS.md`](../../docs/DECISIONS.md) (gốc repo).
* [[04-Operations-Runbooks/UI-Design-System|UI-Design-System]] ([UI-Design-System.md](../04-Operations-Runbooks/UI-Design-System.md)) §4.

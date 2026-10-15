---
tags:
  - adr
  - marketplace
  - system-admin
  - status/accepted
date: 2026-10-15
decider: vtphong91
status: Accepted (Chốt — Áp dụng chính thức)
---

# 🏛️ ADR-021: Trang "Cửa hàng" (marketplace) `/cua-hang` — CMS trước, trang dữ liệu sau

## 1. Trạng Thái (Status)
**ĐÃ PHÊ DUYỆT (Accepted)** — tương ứng **ADR-035** trong [`docs/DECISIONS.md`](../../docs/DECISIONS.md), gồm mục "Bổ sung
ADR-035" (Quốc chốt theo kế hoạch) và mục "Chủ dự án chốt" (2026-10-15). Kế hoạch triển khai:
[`docs/ke-hoach-cua-hang-marketplace-2026-10-15.md`](../../docs/ke-hoach-cua-hang-marketplace-2026-10-15.md).
Đặc tả sống: [[02-System-Specs/Shop-Marketplace-Specs|Shop-Marketplace-Specs]].

Tiến độ (2026-10-15): **GĐ1 (CMS Cửa hàng trong System Center) xong code, chờ kiểm tay**; **GĐ2 (trang công khai) chưa làm**.
Cập nhật trạng thái (2026-10-15, Quốc duyệt): **GĐ2 xong code 2026-10-15** (chưa commit/deploy) — chi tiết ở
[[02-System-Specs/Shop-Marketplace-Specs|Shop-Marketplace-Specs]].

Mức xác minh: ✅ Long đã đối chiếu code (2026-10-15) · 🟡 theo `docs/DECISIONS.md`/brief của Quốc · ❓ cần môi trường thật.

---

## 2. Bối Cảnh (Context)
Chủ dự án cần một trang Cửa hàng kiểu ecommerce tổng hợp tài liệu của mọi tenant. Phong đề xuất UX, chủ dự án chốt các điểm
dưới 🟡. Trang chủ hệ thống đã có mẫu CMS nháp/xuất bản trên `CmsPage` slug `home`
([[01-Architecture-Decisions/ADR-019-Home-Page-Real-Data-Sold-Count|ADR-019 (≙ ADR-033)]]) — Cửa hàng dùng lại mẫu này.

---

## 3. Quyết Định (Decision)
1. **Route** (GĐ2): `/cua-hang` + `/cua-hang/tai-lieu?q=&danh-muc=&sap-xep=noi-bat|ban-chay|danh-gia-cao|moi-nhat&trang=`;
   trang hệ thống ([[01-Architecture-Decisions/ADR-011-Tenant-Owns-Storefront-Content-Only|ADR-011]]), `container-page`. Thêm
   `cua-hang`, `tai-lieu`, `danh-muc`, `tim-kiem`, `giao-vien`, `kham-pha` vào slug tenant dành riêng, quét tenant trùng trước
   deploy 🟡 (chưa thêm vào `RESERVED_SLUGS` — việc GĐ2 ✅ đọc `packages/core/src/tenant/slug.ts`).
2. **9 section theo thứ tự:** Hero (ô tìm) → Danh mục → Nổi bật → Theo từng danh mục (≤6 khối × 4) → Bán chạy → Đánh giá cao →
   Gian hàng nổi bật → Mới → CTA mở gian hàng; section rỗng thì ẩn ✅ (`SHOP_SECTION_TYPES`).
3. **Đánh giá cao:** ≥ N đánh giá **và** điểm TB ≥ ngưỡng, so sánh số nguyên; ngưỡng chỉnh ở System Center, lưu ×10
   (`minAvgTenths`, mặc định 40 = 4,0) ✅.
4. **Gian hàng nổi bật:** chế độ `SALES_30D` (mặc định) hoặc `TOP_RATED` + ghim ✅ (schema). Số bán 30 ngày là số đếm theo tenant
   tính dưới `withSystemJob`, có cache ngắn, **chỉ để xếp hạng, không hiển thị công khai** (chủ dự án chốt) 🟡 — loader GĐ2 chưa có.
5. **Kệ "Bán chạy"** xếp theo tổng đã bán mọi thời gian (`soldCount`) 🟡 (chủ dự án chốt; loader GĐ2 chưa có).
6. **Tìm không dấu:** extension `unaccent` + hàm IMMUTABLE bọc, migration *expand* do Quốc duyệt/chạy theo
   [[01-Architecture-Decisions/ADR-020-Single-Database-Dev-Preview-Production|ADR-020 (≙ ADR-034)]] 🟡 — chưa có migration.
7. **Thứ tự triển khai:** GĐ1 = CMS `CmsPage` slug `shop` (`blocks`/`blocksDraft`, **không DDL**) + nháp/xuất bản/khôi phục ✅;
   GĐ2 = trang công khai đọc CMS + dữ liệu thật qua `lib/shop.ts` (`withPublic`) — chưa làm.
8. **Bổ sung (Quốc chốt):** chưa có/chưa xuất bản → `/cua-hang` dùng cấu hình mặc định (không 404); section thiếu → tự thêm ở
   trạng thái **ẩn** ✅ (`parseShopSections`); một tài liệu được xuất hiện ở nhiều kệ; hằng `SYSTEM_CMS_SLUGS = ["home","shop"]` —
   form CMS chung từ chối, `/p/[slug]` trả 404 ✅.

---

## 4. Hệ Quả & Ràng Buộc Kỹ Thuật
* CMS chỉ lưu nhãn/cấu hình; tài liệu, gian hàng, số liệu luôn lấy thật ở GĐ2 ✅ (comment `shop-sections.ts`).
* Dòng `CmsPage` slug `shop` **không seed** (ADR-034) — tạo bằng `upsert` ở lần Lưu nháp/Xuất bản đầu ✅.
* Giữ §7.9: không route admin đọc chi tiết đơn; số bán 30 ngày chỉ trả số đếm theo tenant 🟡 (GĐ2).
* Nợ/GĐ sau: trang danh mục SEO `/cua-hang/danh-muc/[slug]`, `Product.publishedAt`, `DocumentCategory.iconKey/sortOrder`, index
  catalog lớn, carousel 🟡.

---

## 5. Chưa Verify ❓
* Luồng thử tay GĐ1 trên dev server (dữ liệu là production): tạo dòng `shop` DRAFT → PUBLISHED → khôi phục; non-admin bị từ chối.
* Extension `unaccent`/`pg_trgm` trên Neon: theo báo cáo của Quốc là **khả dụng, chưa cài** 🟡.
* Quét slug tenant trùng 6 từ dành riêng: theo báo cáo của Quốc là **không trùng** 🟡.

---

## 6. Tài Liệu Tham Chiếu & Liên Kết
* [[MOC-Home]] — Trang chủ Map of Content ([MOC-Home.md](../00-Index/MOC-Home.md))
* Tương ứng **ADR-035** trong [`docs/DECISIONS.md`](../../docs/DECISIONS.md) (gốc repo).
* [[02-System-Specs/Shop-Marketplace-Specs|Shop-Marketplace-Specs]] ([Shop-Marketplace-Specs.md](../02-System-Specs/Shop-Marketplace-Specs.md))
* [[03-API-Contracts/Endpoint-Directory|Endpoint-Directory]] §15 ([Endpoint-Directory.md](../03-API-Contracts/Endpoint-Directory.md))
* [[04-Operations-Runbooks/UI-Design-System|UI-Design-System]] §13 ([UI-Design-System.md](../04-Operations-Runbooks/UI-Design-System.md))
* [[01-Architecture-Decisions/ADR-019-Home-Page-Real-Data-Sold-Count|ADR-019 (≙ ADR-033)]] ([ADR-019-Home-Page-Real-Data-Sold-Count.md](./ADR-019-Home-Page-Real-Data-Sold-Count.md))

*Quay lại: [[MOC-Home]] (../00-Index/MOC-Home.md)*

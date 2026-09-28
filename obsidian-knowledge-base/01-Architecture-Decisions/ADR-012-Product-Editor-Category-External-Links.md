---
tags:
  - adr
  - product
  - security
  - storage
  - status/accepted
date: 2026-09-26
decider: vtphong91
status: Accepted (Chốt — Áp dụng chính thức)
---

# 🏛️ ADR-012: Trang Tạo/Sửa Sản Phẩm GĐ1 — Danh Mục Bắt Buộc Khi Xuất Bản, Giao Tài Liệu Bằng File Hoặc Link

## 1. Trạng Thái (Status)
**ĐÃ PHÊ DUYỆT (Accepted)** — tương ứng **ADR-026** trong [`docs/DECISIONS.md`](../../docs/DECISIONS.md). Được
[[01-Architecture-Decisions/ADR-013-Product-Summary-Cover-Preview-Visibility|ADR-013 (≙ ADR-027)]] bổ sung (không thay thế).

---

## 2. Bối Cảnh (Context)
Trang Studio "Tạo sản phẩm" chỉ có tiêu đề/đường dẫn/loại/mô tả; upload, giá, ảnh bìa nằm ở trang Sửa; danh mục
tài liệu (`DocumentCategory`, L1 do System Admin quản lý) chưa gắn với `Product`. Đầu vào: báo cáo
`docs/bao-cao-xu-ly-tai-lieu-san-pham-2026-09-26.md` + đề xuất bố cục của Phong. Chủ dự án chốt: sửa ngay 2 lỗi bảo
mật upload; 1 danh mục/sản phẩm, bắt buộc khi xuất bản; cho phép giao tài liệu bằng **link ngoài** ngay GĐ1 (sản
phẩm chỉ có link vẫn xuất bản được); nâng mốc test.

---

## 3. Quyết Định (Decision)
1. **Bảo mật upload (làm trước):** `complete`/`cover-complete` kiểm `objectKey` đúng tiền tố
   `buildProductFileKey(tenantId, productId, …)` trước mọi lời gọi storage; kiểm lại giới hạn gói bằng dung lượng
   thật từ HeadObject, vượt thì xoá object và từ chối; `storageUsedBytes` cộng theo dung lượng thật.
2. **Danh mục:** `Product.categoryId String?` FK → `DocumentCategory` (L1, không RLS; `products` vẫn RLS như cũ).
   Nháp được trống; **xuất bản bắt buộc** danh mục `isActive`. Studio chỉ liệt kê danh mục `isActive`. Danh mục bị tắt
   sau đó: sản phẩm đã xuất bản giữ nguyên, lần xuất bản/sửa kế tiếp phải chọn lại.
3. **Link tài liệu ngoài:** lưu cùng `product_files` (đã có RLS L2) với `sourceKind FILE | EXTERNAL_URL` + `externalUrl`;
   không object key, không quét, không tính dung lượng. Chỉ `https:` + host allowlist khởi đầu: `drive.google.com`,
   `docs.google.com`, `onedrive.live.com`, `1drv.ms`, `*.sharepoint.com`, `dropbox.com`, `www.dropbox.com` (mở rộng
   qua ADR). Link **chỉ trả cho khách đã có entitlement**, không bao giờ ở trang public; mỗi lần mở vẫn ghi
   `DownloadEvent` và tôn trọng `downloadLimit`. UI cảnh báo tenant về rủi ro link ngoài.
4. **Điều kiện xuất bản** (`canPublishProduct`): danh mục đang hoạt động, ảnh bìa, **≥1 nguồn giao hàng hợp lệ** (file
   bán `CLEAN` **hoặc** link ngoài hợp lệ); trả `{ allowed, reasons[] }` cho checklist.
5. **Luồng tạo:** Tạo và Sửa dùng chung một editor 2 cột (`MainAsideGrid`); lần lưu đầu tạo nháp rồi chuyển sang URL sửa.
6. **Test:** trần `test:count` nâng thêm tối đa **+3 unit / +3 integration** (94/53).

**Không làm ở GĐ1:** gallery nhiều ảnh, SEO riêng sản phẩm, preview/watermark, ClamAV, trang khám phá xuyên tenant theo
danh mục.

---

## 4. Hệ Quả & Ràng Buộc Kỹ Thuật (Consequences & Rules)
* **Lý do:** link ngoài đáp ứng nhu cầu thực tế (tài liệu đã nằm sẵn trên Drive) mà vẫn giao hàng sau thanh toán qua
  entitlement; allowlist + https giảm rủi ro phát tán link độc hại; lưu chung `product_files` tái dùng RLS và luồng
  thư viện/tải xuống thay vì thêm bảng L2 mới.
* **Hiện trạng code (đối chiếu 2026-09-27) ✅:** migration `20260926120000_adr026_product_category_external_links`
  (enum `ProductFileSource`, CHECK `product_files_source_shape`, `products.categoryId` + FK `SET NULL`) và
  `20260926120100_rls_adr026_product_files` (nhánh public chỉ `FILE`+preview+`CLEAN`; nhánh customer thêm
  `EXTERNAL_URL` khi có entitlement; từ ADR-029 các điều kiện này nằm trong policy đọc `select_access`, ghi chỉ tenant/
  `system_job` — [[01-Architecture-Decisions/ADR-015-M10-Reviews-Posts-Rls-Split-Writes|ADR-015 (≙ ADR-029)]]). Hậu tố `*.sharepoint.com` được hiện thực là "đúng **một** nhãn DNS phía trước".
  Test thực **91/50** trên trần **94/53** — đợt ADR-026/027 dùng +3 unit, +4 integration so với mốc 88/46 (vẫn trong
  trần; ADR ghi "+3 integration cho đợt này", phần +1 thuộc ADR-027 — ADR-027 cho phép dùng phần trống của trần).
* **Lệch nhỏ với câu chữ ADR:** editor **không** gọi component `MainAsideGrid` mà lặp lại đúng lưới của nó
  (`xl:grid-cols-[minmax(0,1fr)_320px]`) vì cả trang là một `<form>` — ghi ở [[00-Index/KB-Audit-2026-09-26|KB-Audit]] §6.
  **Cập nhật 2026-09-27 (sau ADR-027):** bố cục editor đã đổi — sidebar 360px, khung `max-w-[1440px]`, card xuất bản dính
  đầu sidebar, bỏ thanh hành động dính đáy; xem [[04-Operations-Runbooks/UI-Design-System|UI-Design-System]] §9.1 ✅.
  **Cập nhật 2026-09-28 (ADR-030):** card xuất bản **không còn dính** khi cuộn (vẫn đứng đầu sidebar từ xl) — xem
  [[01-Architecture-Decisions/ADR-016-Short-Product-Url-No-Sticky-Publish-Card|ADR-016 (≙ ADR-030)]] ✅.
  `docs/DECISIONS.md` đã có "Cập nhật đính chính ADR-026/027 (a)/(c)" thay thế mô tả lưới/thanh hành động và `max-w-[1280px]`.
* Đặc tả chi tiết: [[02-System-Specs/Product-Editor-And-Publishing-Specs|Product-Editor-And-Publishing-Specs]].
  Giới hạn còn mở: `docs/BACKLOG.md` mục "Phát sinh trong đợt Editor sản phẩm GĐ1".

---

## 5. Tài Liệu Tham Chiếu & Liên Kết
* [[MOC-Home]] — Trang chủ Map of Content ([MOC-Home.md](../00-Index/MOC-Home.md))
* Tương ứng **ADR-026** trong [`docs/DECISIONS.md`](../../docs/DECISIONS.md) (gốc repo).
* [[02-System-Specs/Product-Editor-And-Publishing-Specs|Product-Editor-And-Publishing-Specs]] ([Product-Editor-And-Publishing-Specs.md](../02-System-Specs/Product-Editor-And-Publishing-Specs.md))
* [[03-API-Contracts/Database-Schema-Reference|Database-Schema-Reference]] ([Database-Schema-Reference.md](../03-API-Contracts/Database-Schema-Reference.md))
* [[01-Architecture-Decisions/ADR-006-Download-Token-Rls-Customer-Branch|ADR-006 (≙ ADR-020)]] ([ADR-006-Download-Token-Rls-Customer-Branch.md](./ADR-006-Download-Token-Rls-Customer-Branch.md)) — nhánh customer RLS được mở rộng ở đây.

*Quay lại: [[MOC-Home]] (../00-Index/MOC-Home.md)*

---
tags:
  - adr
  - product
  - storage
  - security
  - status/accepted
date: 2026-10-24
decider: vtphong91
status: Accepted (Chốt — Áp dụng chính thức)
---

# 🏛️ ADR-037: Cơ chế lưu trữ kích hoạt xoá, bảo toàn quyền lợi người mua và dọn dẹp Storage Service

## 1. Trạng Thái (Status)
**ĐÃ PHÊ DUYỆT (Accepted)** — tương ứng **ADR-051** trong [`docs/DECISIONS.md`](../../docs/DECISIONS.md) (chủ dự án chốt ngày 2026-10-24).

Tiến độ: **Đã triển khai hoàn tất trong code** (xong `checkProductPurchaseStatus`, `archiveProduct`, `deleteProduct`, Server Action `deleteProductAction`, action audit `PRODUCT_DELETED`, cập nhật UI Studio và integration test).

Mức xác minh: ✅ Đã kiểm thử qua unit test + integration test (`tests/integration/product.test.ts`), `pnpm lint` 0 lỗi, typecheck 100%.

---

## 2. Bối Cảnh (Context)
- Trong phân hệ Studio, khi người bán thực hiện thao tác **Lưu trữ** (Archive) tài liệu số, nếu tài liệu chỉ đơn thuần chuyển trạng thái sang `ARCHIVED` mà vẫn lưu file vật lý trên MinIO/R2 thì sẽ tiếp tục chiếm dụng quota lưu trữ (`tenant.storageUsedBytes`) của gian hàng đối với những tài liệu bị bỏ dở hoặc chưa từng bán được.
- Tuy nhiên, hệ thống bán tài liệu số có ràng buộc pháp lý và đạo đức dịch vụ tối thượng: **Khách hàng đã trả tiền (hoặc đang tiến hành mua) phải luôn bảo toàn được quyền lợi truy cập và tải tài liệu**. Nếu xoá nhầm tài liệu của người đã mua, khách hàng sẽ mất quyền tải, đơn hàng và khoá ngoại trong cơ sở dữ liệu (`order_items`, `entitlements`) sẽ bị lỗi vi phạm ràng buộc RESTRICT.

---

## 3. Quyết Định Kiến Trúc & Nghiệp Vụ (Decision)

### A. Kiểm tra trạng thái giao dịch (`checkProductPurchaseStatus`)
Trước mọi hành động xoá hoặc lưu trữ, hệ thống tiến hành kiểm tra đa tầng trong phạm vi tenant (`withTenant`):
1. **Đang mua (`HAS_PENDING_ORDERS`):** Tồn tại đơn hàng `PENDING` có chứa sản phẩm (`OrderItem.productId === productId`).
   - ➜ `canDelete = false`. Chặn để bảo vệ giao dịch khách hàng đang thanh toán.
2. **Đã mua (`HAS_PURCHASE_HISTORY`):** Tồn tại đơn hàng `PAID`, `FULFILLED`, `REFUNDED` chứa sản phẩm, hoặc đã tồn tại bản ghi quyền sở hữu `Entitlement`.
   - ➜ `canDelete = false`. Chặn xoá để bảo đảm quyền lợi tải tài liệu của người mua.
3. **Chưa từng phát sinh giao dịch:**
   - ➜ `canDelete = true`. Được phép xoá vĩnh viễn và giải phóng storage.

### B. Lưu trữ thông minh (`archiveProduct`)
Hàm `archiveProduct` trả về `ArchiveProductResult extends Product { isDeleted?: boolean; archiveMessage?: string }`:
- **Trường hợp đã/đang có người mua:**
  - Không xoá. Cập nhật `status = 'ARCHIVED'`.
  - Giữ nguyên 100% tệp trong Storage Service (MinIO/R2) để bảo đảm quyền tải.
  - Ghi audit log `PRODUCT_ARCHIVED` với metadata `{ retainedForBuyers: true }`.
- **Trường hợp chưa từng có người mua:**
  - Kích hoạt xoá vĩnh viễn thông qua `deleteProduct()`.
  - Trả về `isDeleted = true`.
  - Giao diện Studio tự động điều hướng về trang danh sách tài liệu kèm thông báo "Tài liệu chưa có lượt mua đã được dọn dẹp và giải phóng dung lượng".

### C. Xoá tài liệu & dọn dẹp Storage Service (`deleteProduct`)
1. Kiểm tra `checkProductPurchaseStatus`. Nếu vi phạm, ném `AppError` `PRODUCT_CANNOT_BE_DELETED` (HTTP 400).
2. Quét danh sách `product_files` của sản phẩm.
3. Duyệt từng tệp:
   - Dựa vào `storageBucket` và `storageProvider` (MinIO/R2 của tenant theo ADR-034 hoặc storage hệ thống) để tạo S3 client tương ứng.
   - Gọi `deleteObject()` xoá tệp vật lý trên bucket lưu trữ.
4. Nếu sản phẩm có ảnh bìa lưu nội bộ (`coverImageKey`), gọi `deleteObject()` dọn dẹp trên public bucket.
5. Cập nhật trừ dung lượng đã dùng của gian hàng: `tenant.storageUsedBytes -= sum(files.sizeBytes)`.
6. Xoá cascade dữ liệu trong cơ sở dữ liệu: `downloadEvent`, `downloadToken`, `shareLink`, `review`, `productFile`, gỡ liên kết bài viết (`post.productId = null`) và xoá bản ghi `product`.
7. Ghi audit log `PRODUCT_DELETED`.

---

## 4. Giao Diện Người Dùng (UI Studio)
- Bổ sung nút **Xoá tài liệu** độc lập tại:
  - Menu ba chấm (dropdown) của danh sách tài liệu (`product-row-actions.tsx`).
  - Thẻ xuất bản (`publish-card.tsx` / `product-editor.tsx`).
- Hộp thoại xác nhận thao tác **Lưu trữ** giải thích rõ ràng cơ chế:
  - *"Nếu tài liệu chưa có người mua, hệ thống sẽ tự động dọn dẹp và giải phóng dung lượng lưu trữ. Nếu đã có người mua, tài liệu sẽ được lưu trữ an toàn để bảo lưu quyền tải của khách hàng."*

---

## 5. Liên Kết
* [[01-Architecture-Decisions/ADR-012-Product-Editor-Category-External-Links|ADR-012 KB (≙ ADR-026)]] · [[01-Architecture-Decisions/ADR-013-Product-Summary-Cover-Preview-Visibility|ADR-013 KB (≙ ADR-027)]] · [[01-Architecture-Decisions/ADR-034-Dual-Storage-MinIO-R2-Dedicated-Tenant-Bucket|ADR-034 KB (≙ ADR-044)]]
* [[02-System-Specs/Product-Editor-And-Publishing-Specs|Product-Editor-And-Publishing-Specs]] ([Product-Editor-And-Publishing-Specs.md](../02-System-Specs/Product-Editor-And-Publishing-Specs.md))
* [[02-System-Specs/File-Storage-And-Downloads-Specs|File-Storage-And-Downloads-Specs]] ([File-Storage-And-Downloads-Specs.md](../02-System-Specs/File-Storage-And-Downloads-Specs.md))

*Quay lại: [[MOC-Home]] (../00-Index/MOC-Home.md)*

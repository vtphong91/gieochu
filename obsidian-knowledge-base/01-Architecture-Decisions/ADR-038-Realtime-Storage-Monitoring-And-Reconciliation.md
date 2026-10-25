---
tags:
  - adr
  - storage
  - admin
  - minio
  - cloudflare-r2
  - status/accepted
date: 2026-10-24
decider: vtphong91
status: Accepted (Chốt — Áp dụng chính thức)
---

# 🏛️ ADR-038: Giám sát dung lượng bucket thực tế & Cơ chế đối soát dữ liệu (Storage Reconciliation)

## 1. Trạng Thái (Status)
**ĐÃ PHÊ DUYỆT (Accepted)** — tương ứng **ADR-052** trong [`docs/DECISIONS.md`](../../docs/DECISIONS.md) (chốt ngày 2026-10-24).

Tiến độ: **Đã triển khai hoàn tất trong code** (đã sửa `apps/web/app/admin/settings/storage/page.tsx`, `bucket-monitoring.tsx`, `packages/storage/src/bucket.ts`, `tenant-storage.ts`, `actions.ts` và bộ UI kit `GhostButton`).

Mức xác minh: ✅ Đã kiểm thử qua unit test + typecheck monorepo 100% (`@gieochu/storage` 0 lỗi, `@gieochu/web` 0 lỗi, 37 test suites passed) 🟡 — số liệu do vuong báo, Long chưa đối chiếu.

---

## 2. Bối Cảnh (Context)
Tại giao diện quản trị hệ thống **System Center** (`/admin/settings/storage?tab=buckets`):
1. **Lỗi logic hiển thị số tệp:** Cột "Số tệp" (`fileCount`) trước đây truy vấn Prisma trực tiếp với `_count.products` (số lượng sản phẩm) thay vì đếm số tệp tin đính kèm (`product_files`), dẫn đến số liệu thống kê sai lệch nghiêm trọng giữa số sản phẩm và số tệp tài liệu số thực tế được lưu trữ.
2. **Dung lượng hiển thị bị động:** Cột dung lượng chỉ đọc tĩnh trường `Tenant.storageUsedBytes` trong cơ sở dữ liệu. Con số này chỉ được cập nhật qua luồng upload/gỡ file trên giao diện Studio. Hệ thống hoàn toàn không có khả năng nhận biết dung lượng thật nếu có file mồ côi (orphan objects), dữ liệu upload trực tiếp, hoặc sai lệch tích lũy qua các đợt migration/sync giữa MinIO và Cloudflare R2.
3. **Nút "Kiểm tra" chỉ là giao diện giả lập (mock):** Nút "Kiểm tra" trên từng bucket trước đây chỉ set một câu thông báo tĩnh mà không gửi bất kỳ request nào để kiểm tra kết nối thực tế hay quét bucket trên MinIO/R2.

---

## 3. Quyết Định Kiến Trúc (Decision)

### A. Chuẩn hóa nguồn dữ liệu giám sát
- Chuyển toàn bộ việc nạp dữ liệu tại `apps/web/app/admin/settings/storage/page.tsx` sang sử dụng hàm chuyên trách [`getTenantStorageMonitoringList()`](file:///f:/WORK/PROJECTS/GieoChu/apps/web/lib/tenant-storage.ts).
- Số tệp (`fileCount`) được đếm trực tiếp từ bảng `product_files` (`where: { sourceKind: "FILE", removedAt: null }`), phản ánh chính xác số tài liệu số đang lưu trữ của từng gian hàng.

### B. Mở rộng thư viện lưu trữ (`@gieochu/storage`) với `getBucketStats`
- Bổ sung hàm `getBucketStats(client: S3Client, bucket: string, prefix?: string): Promise<BucketStats>` trong [`packages/storage/src/bucket.ts`](file:///f:/WORK/PROJECTS/GieoChu/packages/storage/src/bucket.ts).
- Sử dụng `ListObjectsV2Command` lặp có phân trang (`ContinuationToken`) để tính toán chính xác:
  - `exists`: Trạng thái bucket có tồn tại trên provider không (`headBucket`).
  - `totalObjects`: Tổng số tệp tin vật lý thực tế.
  - `totalBytes`: Tổng dung lượng bytes tích lũy của toàn bộ tệp trong bucket hoặc theo prefix `tenants/<tenantId>/`.

### C. Cơ chế kiểm tra & đối soát dung lượng (Storage Inspection & Reconciliation)
Xây dựng 3 tầng xử lý trong [`apps/web/lib/tenant-storage.ts`](file:///f:/WORK/PROJECTS/GieoChu/apps/web/lib/tenant-storage.ts) và Server Actions trong [`apps/web/app/admin/settings/storage/actions.ts`](file:///f:/WORK/PROJECTS/GieoChu/apps/web/app/admin/settings/storage/actions.ts):
1. **Kiểm tra bucket thời gian thực (`inspectTenantBucketAction`):**
   - Tự động nhận diện provider của gian hàng (`storageProvider`) hoặc active provider (MinIO / Cloudflare R2).
   - Kiểm tra Dedicated Bucket của gian hàng (`storageBucket`) hoặc Shared Bucket (`bucketPrivate`) với tiền tố `tenants/<tenantId>/`.
   - Đối chiếu số tệp và số dung lượng thực tế trên object storage với bản ghi `storageUsedBytes` trong database, đưa ra cảnh báo nếu phát hiện sai lệch.
2. **Đồng bộ dung lượng gian hàng (`reconcileTenantStorageAction`):**
   - Lấy dung lượng vật lý thực tế quét được từ MinIO/R2 cập nhật ghi đè trực tiếp vào cột `Tenant.storageUsedBytes` trong database.
   - Giúp quản trị viên khắc phục ngay lập tức tình trạng lệch dung lượng quota của gian hàng.
3. **Đồng bộ hàng loạt (`reconcileAllTenantsStorageAction`):**
   - Quét và khớp lại dung lượng toàn bộ gian hàng trong hệ thống.

### D. Nâng cấp trải nghiệm giao diện quản trị
- **Nút "Kiểm tra":** Bấm vào hiển thị spinner loading thật, gọi `inspectTenantBucketAction` và trả về kết quả sức khỏe bucket, số tệp và dung lượng thực tế.
- **Nút "Đồng bộ":** Tích hợp trên từng hàng gian hàng để quản trị viên có thể chủ động đồng bộ dung lượng khi cần.
- **Nút "Khớp dữ liệu Storage" (Reconcile All):** Tích hợp trên thanh công cụ lọc để chạy đối soát toàn bộ.
- Bổ sung prop `loading?: boolean` cho `GhostButton` trong UI kit (`apps/web/app/admin/_ui/kit.tsx`).

---

## 4. Hệ Quả & Đánh Đổi (Consequences)
- **Ưu điểm:**
  - Loại bỏ hoàn toàn bug đếm nhầm số sản phẩm thành số tệp.
  - Quản trị viên nắm bắt được tình trạng thật của bucket trên cả MinIO lẫn Cloudflare R2.
  - Cho phép tự sửa chữa (self-healing) số liệu quota `storageUsedBytes` khi có sai lệch ngoài ý muốn.
- **Lưu ý hiệu năng:** Lệnh `ListObjectsV2Command` đối soát chạy theo yêu cầu chủ động (on-demand click), không chạy tự động trên mỗi lượt tải trang để tránh quá tải I/O và request cost tới S3/R2.

---

## 5. Tài Liệu Tham Chiếu
- [[01-Architecture-Decisions/ADR-034-Dual-Storage-MinIO-R2-Dedicated-Tenant-Bucket|ADR-034: Dual Storage MinIO & Cloudflare R2]]
- [[02-System-Specs/File-Storage-And-Downloads-Specs|Đặc tả Lưu trữ File & Tải xuống]]
- [docs/DECISIONS.md](../../docs/DECISIONS.md) — ADR-052

*Quay lại: [[MOC-Home]] (../00-Index/MOC-Home.md)*

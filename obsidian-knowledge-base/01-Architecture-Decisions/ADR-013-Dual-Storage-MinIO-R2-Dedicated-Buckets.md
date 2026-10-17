---
tags:
  - adr
  - storage
  - minio
  - r2
  - multi-tenant
  - system-admin
  - status/accepted
date: 2026-10-17
decider: vtphong91
status: Accepted (Chốt — Áp dụng chính thức)
---

# 🏛️ ADR-013: Lưu Trữ Đa Nền Tảng MinIO Song Song Cloudflare R2, Dedicated Bucket Cho Gian Hàng & Công Cụ Quản Trị Giám Sát / Đồng Bộ

## 1. Trạng Thái (Status)
**ĐÃ PHÊ DUYỆT (Accepted)** — Áp dụng cho hạ tầng lưu trữ S3-compatible, phân bổ bucket theo từng gian hàng và công cụ đồng bộ/giám sát hệ thống.
Tương ứng **ADR-038** trong [`docs/DECISIONS.md`](../../docs/DECISIONS.md) (gốc repo). Kế thừa và mở rộng từ [[01-Architecture-Decisions/ADR-005-Storage-Config-System-Admin|ADR-005 (≙ ADR-017)]].

---

## 2. Bối Cảnh (Context)
1. Trước đây, hệ thống thiết kế lưu trữ file bán tập trung vào một tài khoản Cloudflare R2 (hoặc S3 chung) với 2 bucket `bucketPrivate` và `bucketPublic` (theo [[01-Architecture-Decisions/ADR-005-Storage-Config-System-Admin|ADR-005]]). File của tất cả gian hàng lưu chung trong 1 bucket và phân biệt logic bằng tiền tố `tenants/{tenantId}/products/...`.
2. Theo yêu cầu mở rộng kiến trúc hạ tầng và nâng cao an toàn dữ liệu từ chủ dự án:
   - **Bổ sung nền tảng MinIO tự host:** Hỗ trợ cấu hình MinIO (IP/Domain, Port tùy chỉnh, SSL, Bucket Prefix, Max Upload Size...) chạy song song, **không bỏ Cloudflare R2**. Cho phép Quản trị viên linh hoạt chuyển đổi giữa Cloud Storage và Self-hosted Storage.
   - **Mô hình Dedicated Bucket per Tenant:** Chuyển đổi từ shared bucket sang việc **mỗi gian hàng (Tenant) sở hữu một bucket riêng biệt**. Điều này nâng cao tính cô lập dữ liệu (data isolation), tăng cường an toàn, dễ dàng backup/restore độc lập hoặc áp dụng chính sách retention riêng biệt cho từng gian hàng.
   - **Công cụ Quản trị Đồng bộ Dữ liệu (Storage Sync Engine):** Cung cấp công cụ cho Quản trị viên trong System Admin để chuyển dịch toàn bộ hoặc từng phần file tài liệu giữa 2 nền tảng (R2 ↔ MinIO) mà không làm gián đoạn vận hành.
   - **Màn hình Giám sát Dung lượng Bucket:** Bổ sung giao diện trực quan cho System Admin giám sát trạng thái kết nối, dung lượng sử dụng thực tế so với hạn mức gói thuê bao (`Plan.storageMb`), số lượng file và cảnh báo quá tải.

---

## 3. Quyết Định (Decision)

### 3.1 Cấu Hình Dual Storage Provider Trong `SystemStorageConfig`
- Mở rộng bảng `SystemStorageConfig` (L1, 1 dòng duy nhất) để lưu trữ độc lập cả 2 cấu hình nhà cung cấp:
  - `CLOUDFLARE_R2`: `endpoint`, `region`, `bucketPrivate`, `bucketPublic`, `publicBaseUrl`, `accessKeyId`, `secretAccessKey`.
  - `MINIO`: `host` (IP hoặc Domain), `port` (number, vd 9000), `useSSL` (boolean), `region` (mặc định `us-east-1`), `bucketPrefix` (vd `gc-`), `maxUploadMb` (vd 500), `publicBaseUrl` (tùy chọn), `accessKeyId`, `secretAccessKey`.
- Bổ sung trường `activeProvider: "CLOUDFLARE_R2" | "MINIO"`: Xác định nhà cung cấp lưu trữ mặc định sẽ tiếp nhận các file tải lên mới.
- **Mã hoá an toàn:** Cả 2 bộ secret (`accessKeyId`, `secretAccessKey`) đều được mã hoá AES-256-GCM với `STORAGE_ENCRYPTION_KEY` riêng biệt (theo [[01-Architecture-Decisions/ADR-005-Storage-Config-System-Admin|ADR-005]]). UI chỉ hiển thị định dạng che (`••••abcd`).
- **Tương thích ngược (Backward Compatibility):** Nếu đọc bản ghi cấu hình cũ chưa phân tách, hệ thống tự động chuẩn hoá và coi cấu hình hiện có là `CLOUDFLARE_R2`, đồng thời điền cấu hình mặc định an toàn cho nhánh `MINIO`.

### 3.2 Dedicated Bucket Cho Từng Gian Hàng (Tenant)
- **Quy tắc sinh tên bucket chuẩn S3/MinIO:**
  $$\text{bucketName} = \text{clean}(\text{bucketPrefix}) + \text{"tenant-"} + \text{clean}(\text{tenantId})$$
  - Đảm bảo tuân thủ tiêu chuẩn RFC/S3: Độ dài 3–63 ký tự, chỉ gồm chữ thường `a-z`, số `0-9` và dấu gạch ngang `-`, không có hai dấu gạch nối liên tiếp, không bắt đầu/kết thúc bằng dấu gạch ngang (`isValidBucketName`).
- **Cơ chế cấp phát bucket:**
  - Tự động cấp phát khi tạo gian hàng (`createTenantForUser`).
  - Khởi tạo lười (lazy-provisioning via `getOrCreateTenantBucket(tenantId)`): Nếu gian hàng cũ chưa có bucket, hệ thống tự động sinh tên và tạo bucket (`ensureBucketExists`) ngay khi phát sinh lượt upload presign đầu tiên hoặc khi Admin bấm "Khởi tạo bucket" trong màn hình giám sát.
- **Mô hình dữ liệu Prisma (Migration `20261017140000_adr038_tenant_storage_bucket`):**
  - Bảng `Tenant` bổ sung:
    + `storageBucket String?`: Tên bucket riêng của gian hàng (null = dùng shared bucket cũ).
    + `storageProvider String?`: Provider lưu trữ bucket (`"CLOUDFLARE_R2" | "MINIO"`).
  - Bảng `ProductFile` bổ sung:
    + `storageBucket String?`: Tên bucket chứa file cụ thể này (null = fallback bucket hệ thống).
    + `storageProvider String?`: Provider chứa file (`"CLOUDFLARE_R2" | "MINIO"`).
  - Giữ nguyên cấu trúc `objectKey` dạng `tenants/{tenantId}/products/{productId}/{fileId}.{ext}` để phân cấp rõ ràng và tương thích bảo mật `isProductObjectKeyFor`.

### 3.3 Công Cụ Quản Trị Đồng Bộ Dữ Liệu (Storage Sync Engine)
- **Giao diện:** Tích hợp trong System Admin tại `/admin/settings/storage` (panel "Đồng bộ dữ liệu").
- **Cơ chế luân chuyển dữ liệu Stream Copy:**
  - Đồng bộ hai chiều linh hoạt: `R2_TO_MINIO` hoặc `MINIO_TO_R2`.
  - Hỗ trợ lọc đồng bộ theo toàn hệ thống hoặc theo từng `tenantId` cụ thể, kèm giới hạn số lượng (`limit`).
  - Sử dụng luồng stream trực tiếp (`GetObjectCommand` từ source client đẩy thẳng sang `PutObjectCommand` của target client qua `copyObjectBetweenClients`), **tuyệt đối không đệm qua bộ nhớ RAM hoặc ghi ra ổ cứng máy chủ web Next.js**.
  - Tự động gọi `ensureBucketExists` để đảm bảo bucket đích đã tồn tại trước khi đẩy dữ liệu.
  - Xác thực độ toàn vẹn qua byte size (`ContentLength`) và `ETag`. Sau khi sao chép thành công, cập nhật `storageBucket` và `storageProvider` trên từng bản ghi `ProductFile`.

### 3.4 Màn Hình Giám Sát Dung Lượng & Bucket Gian Hàng (Bucket Monitoring)
- **Giao diện:** Tab "Giám sát Bucket & Dung lượng" tại `/admin/settings/storage`.
- **Thông tin hiển thị:**
  - Tên gian hàng, Slug, Trạng thái hoạt động (`ACTIVE`, `READ_ONLY`, `LOCKED`).
  - Tên bucket riêng, Provider hiện tại (`CLOUDFLARE_R2` / `MINIO`).
  - Số lượng file đang lưu trữ (`fileCount`).
  - Dung lượng đã dùng thực tế (`storageUsedBytes`), Hạn mức gói thuê bao (`Plan.storageMb`).
  - Tỷ lệ phần trăm sử dụng kèm thanh màu cảnh báo trực quan: Xanh lá (<75%), Vàng/Cam (75–90%), Đỏ (>90% hoặc vượt mức).
- **Hành động quản trị:**
  - Nút "Kiểm tra bucket" (`headBucket`) xác minh sự tồn tại và quyền truy cập thực tế của bucket trên S3/MinIO.
  - Nút "Khởi tạo bucket" thủ công cho các gian hàng cũ tạo trước ADR-038 chưa có dedicated bucket.

---

## 4. Hệ Quả & Ràng Buộc Kỹ Thuật (Consequences & Rules)

1. **Định Tuyến Đa Nền Tảng Trong Mọi Luồng File:**
   - **Upload (`presignProductFileUpload` & `completeProductFileUpload`):** Ưu tiên ghi vào bucket riêng của tenant trên provider của bucket đó (hoặc `activeProvider`).
   - **Tải xuống (`createPresignedDownload`):** Đọc `storageBucket` và `storageProvider` từ chính dòng `ProductFile`. Nếu file nằm ở provider khác với `activeProvider`, tự động khởi tạo client của provider đó để tạo presigned URL tải xuống đúng đích.
   - **Quét tệp (`runFileScan`):** Tự động đọc đúng bucket và provider ghi nhận trên `ProductFile` để tính toán SHA-256 và nhận diện định dạng file (magic bytes).
   - **Share link (`consumeShareLinkDownload`):** Định tuyến tương tự luồng tải xuống của khách hàng.
2. **Bảo Mật Tuyệt Đối:**
   - Giữ vững nguyên tắc CLAUDE.md §7.6: Dedicated bucket cho file bán vẫn là **bucket private tuyệt đối**, không public URL, mọi lượt tải phải đi qua presigned URL có TTL ngắn ($\le 10$ phút).
   - Secret MinIO và R2 tiếp tục tuân thủ quy tắc bảo mật #3: Mã hoá AES-256-GCM với `STORAGE_ENCRYPTION_KEY`, không dùng chung với `PAYMENT_ENCRYPTION_KEY`.
3. **An Toàn Dữ Liệu Khi Di Trú:**
   - Quá trình Sync Engine không xoá object ở source storage trừ khi có thao tác dọn dẹp riêng biệt được xác nhận bởi quản trị viên. Bản ghi `ProductFile` chỉ trỏ sang bucket mới khi copy stream thành công 100%.

---

## 5. Tài Liệu Tham Chiếu & Liên Kết
* [[MOC-Home]] — Trang chủ Map of Content ([MOC-Home.md](../00-Index/MOC-Home.md))
* [[01-Architecture-Decisions/README|01-Architecture-Decisions README]] — Danh mục ADR trích lọc ([README.md](./README.md))
* [[01-Architecture-Decisions/ADR-005-Storage-Config-System-Admin|ADR-005]] — Cấu hình Storage quản lý qua System Admin + mã hoá DB.
* [[02-System-Specs/File-Storage-And-Downloads-Specs|File-Storage-And-Downloads-Specs]] — Đặc tả chi tiết lưu trữ file, presigned upload/download và giám sát bucket.
* Tương ứng **ADR-038** trong [`docs/DECISIONS.md`](../../docs/DECISIONS.md) (gốc repo).

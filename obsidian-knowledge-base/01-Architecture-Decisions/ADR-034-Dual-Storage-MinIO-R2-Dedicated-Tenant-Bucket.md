---
tags:
  - adr
  - storage
  - tenant
  - status/accepted
date: 2026-10-23
status: Accepted (Chốt — Áp dụng chính thức)
---

# 🏛️ ADR-034: Lưu trữ MinIO song song Cloudflare R2, bucket riêng cho mỗi gian hàng, công cụ giám sát / đồng bộ

## 1. Trạng Thái (Status)
**ĐÃ PHÊ DUYỆT (Accepted)** — tương ứng **ADR-044** trong [`docs/DECISIONS.md`](../../docs/DECISIONS.md) (đề ngày 2026-10-17; vào `master`
qua commit `78a9d9c` của vuong ngày 2026-10-22 ✅ `git log`). Bản trích ghi vào thư mục này theo duyệt của Quốc (2026-10-23).

Tiến độ: **đã commit `78a9d9c`**, deploy ❓. Migration `20261017140000_adr038_tenant_storage_bucket` **CHƯA áp DB dùng chung** 🟡 (Quốc kiểm
`prisma migrate status` 2026-10-23). Tên thư mục mang số "adr038" nhưng thuộc quyết định **ADR-044** (ADR-038 là báo cáo vi phạm). Không thêm test case.

Mức xác minh: ✅ Long đọc code/SQL/`git show` (2026-10-23) · 🟡 theo `docs/DECISIONS.md`/brief của Quốc · ❓ cần môi trường thật.

---

## 2. Bối Cảnh (Context) 🟡
Trước đây mọi file của mọi gian hàng nằm chung 2 bucket `bucketPrivate`/`bucketPublic` của một tài khoản R2/S3 (ADR-017 gốc), phân biệt bằng
prefix `tenants/{tenantId}/...`. Chủ dự án yêu cầu: thêm MinIO làm phương án song song (**không bỏ R2**); mỗi gian hàng một bucket riêng để cô lập
dữ liệu; công cụ đồng bộ file R2 ↔ MinIO cho quản trị viên; màn hình giám sát bucket của các gian hàng.

---

## 3. Quyết Định (Decision) — theo `docs/DECISIONS.md`
1. **Hai provider trong `SystemStorageConfig`:** lưu độc lập cấu hình `CLOUDFLARE_R2` và `MINIO`; `activeProvider` chọn nền tảng cho file mới.
   Tham số MinIO: `host`, `port`, `useSSL`, `region`, `bucketPrefix` (mặc định `gc-`), `maxUploadMb`, `publicBaseUrl`, khoá truy cập (mã hoá
   AES-256-GCM bằng `STORAGE_ENCRYPTION_KEY`). Cấu hình cũ chưa tách → coi là `CLOUDFLARE_R2` ✅ `lib/system-storage.ts`.
2. **Bucket riêng cho gian hàng:** tên `{prefix}tenant-{tenantId}` (chữ thường, số, gạch nối, 3–63 ký tự) theo `docs/DECISIONS.md`.
   **Code đã đổi ngày 2026-10-23 (lệch so với ADR gốc, chờ Quốc ghi ADR):** tên mới `{prefix}{12 ký tự đầu tenantId}` (vd `gc-k3j9x0a2m7qd`),
   prefix tối đa 20 ký tự `[a-z0-9-]`, trùng tên thì dùng 16 ký tự (vẫn trùng → `STORAGE_BUCKET_NAME_CONFLICT` 409), tên sai → `STORAGE_BUCKET_NAME_INVALID`;
   gian hàng đã có bucket giữ tên cũ ✅ `deriveTenantBucketName`/`getOrCreateTenantBucket` (`lib/tenant-storage.ts`), chi tiết:
   [[04-Operations-Runbooks/Minio-Storage-Operations-Runbook|Minio-Storage-Operations-Runbook]] §5.1. Cột nullable mới `storageBucket`, `storageProvider` ở `tenants` và `product_files` ✅ schema + SQL.
3. **Đồng bộ dữ liệu:** chọn chiều R2 → MinIO hoặc MinIO → R2; stream copy giữa hai S3 client, không đệm ra đĩa; tự tạo bucket đích; kiểm kích
   thước/ETag; cập nhật `ProductFile.storageBucket` 🟡 (code: `lib/storage-sync.ts`, `packages/storage/src/stream-copy.ts`, chưa đối chiếu từng bước).
4. **Giám sát bucket:** bảng gian hàng · slug · bucket · provider · số file · dung lượng đã dùng · hạn mức gói · %; kiểm `HeadBucket` và nút khởi tạo
   bucket cho gian hàng cũ ✅ `getTenantStorageMonitoringList`, `provisionTenantBucketAction`.

---

## 4. Lệch giữa ADR và code (đối chiếu 2026-10-23)
* ADR ghi màn hình ở `/admin/settings/storage/sync` và `/admin/settings/storage/buckets`; code là **một trang** `/admin/settings/storage` với
  `?tab=config|buckets|sync` ✅ `page.tsx` — không có route con.
* ADR ghi bucket "khởi tạo tự động khi tạo gian hàng (`createTenantForUser`) hoặc lười"; code **chỉ tạo lười**: `getOrCreateTenantBucket` được gọi
  ở `lib/product-upload.ts` (khi `activeProvider = MINIO` hoặc tenant đã có bucket) và nút admin — **không** gọi trong luồng tạo gian hàng ✅ grep.

Cả hai ghi ở [[00-Index/KB-Audit-2026-09-26|KB-Audit]] §29.

---

## 5. Hệ Quả & Rủi Ro
* **Migration chưa áp DB nhưng code trên `master` đã đọc/ghi các cột mới** (`select: { storageBucket, storageProvider }` ở `lib/tenant-storage.ts`,
  `lib/product-upload.ts`…; Prisma client sinh lại đã có cột). Trên DB chưa có cột, các truy vấn này sẽ lỗi "column does not exist" — suy từ code,
  chưa chạy thật ❓. Theo quy trình expand → contract ([[01-Architecture-Decisions/ADR-020-Single-Database-Dev-Preview-Production|ADR-020 (≙ ADR-034)]]),
  migration phải áp **trước** khi code lên môi trường dùng DB đó.
* Migration chỉ *thêm* cột nullable (`ADD COLUMN IF NOT EXISTS`) — loại expand ✅ đọc SQL; rollback code an toàn.
* Production giao file MinIO qua Storage Gateway — [[01-Architecture-Decisions/ADR-030-Storage-Gateway-Encrypted-Ticket-Nginx|ADR-030 (≙ ADR-045)]].
* Không có test tự động cho đặt tên bucket, đồng bộ, giám sát (trần 94/55 đã chạm).

---

## 6. Tài Liệu Tham Chiếu & Liên Kết
* [[MOC-Home]] — Trang chủ Map of Content ([MOC-Home.md](../00-Index/MOC-Home.md))
* Tương ứng **ADR-044** trong [`docs/DECISIONS.md`](../../docs/DECISIONS.md).
* [[01-Architecture-Decisions/ADR-005-Storage-Config-System-Admin|ADR-005 (≙ ADR-017)]] — cấu hình storage qua System Admin ([ADR-005-Storage-Config-System-Admin.md](./ADR-005-Storage-Config-System-Admin.md))
* [[01-Architecture-Decisions/ADR-030-Storage-Gateway-Encrypted-Ticket-Nginx|ADR-030 (≙ ADR-045)]] ([ADR-030-Storage-Gateway-Encrypted-Ticket-Nginx.md](./ADR-030-Storage-Gateway-Encrypted-Ticket-Nginx.md))
* [[03-API-Contracts/Database-Schema-Reference|Database-Schema-Reference]] §7 — migration ([Database-Schema-Reference.md](../03-API-Contracts/Database-Schema-Reference.md))
* [[04-Operations-Runbooks/Minio-Storage-Operations-Runbook|Minio-Storage-Operations-Runbook]] ([Minio-Storage-Operations-Runbook.md](../04-Operations-Runbooks/Minio-Storage-Operations-Runbook.md))

*Quay lại: [[MOC-Home]] (../00-Index/MOC-Home.md)*

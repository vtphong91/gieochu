---
tags:
  - spec
  - storage
  - downloads
  - security
  - status/living
date: 2026-09-26
updated: 2026-10-22
author: System Architect
---

# 📐 Đặc Tả: Lưu Trữ File & Cơ Chế Tải Xuống (File Storage & Downloads Specs)

> Đổi tên từ `Media-Storage-Cloudinary-Specs.md`. Gieo Chữ dùng **hai** hệ thống lưu trữ tách biệt, không dùng
> chung: (1) storage S3-compatible (Cloudflare R2) cho **file sản phẩm bán** (bucket private, presigned URL);
> (2) **Cloudinary hệ thống** cho **ảnh** — ảnh CMS của System Admin, và từ ADR-023/027/028 cả ảnh storefront, ảnh
> bìa sản phẩm, ảnh trong mô tả của tenant (có hạn mức theo gói). Mục 1–5 nói về (1); mục 6–7 nói về (2).
> Từ ADR-045 (2026-10-22, đã commit `4ab5a3b` — deploy ❓): provider liệt kê trong env `STORAGE_GATEWAY_PROVIDERS` không trả presigned URL cho trình duyệt
> mà trả `/_s/<vé mã hoá>` qua nginx — §9.

## 1. Mục Tiêu & Kiến Trúc Tổng Thể (File Sản Phẩm)

`packages/storage` cung cấp lớp trừu tượng S3-compatible (`@aws-sdk/client-s3`), không gắn cứng vào một nhà
cung cấp — production dùng **Cloudflare R2** (ADR-014/ADR-017 trong
[docs/DECISIONS.md](../../docs/DECISIONS.md)), **không phải Cloudinary**. Nguyên tắc cốt lõi (CLAUDE.md §7.6):

1. **Bucket private tuyệt đối** cho file bán — không có URL public trực tiếp tới object.
2. **URL tải chỉ là presigned, sống ≤ 10 phút**, `Content-Disposition: attachment` — không bao giờ cho phép
   trình duyệt hiển thị nội dung file thay vì tải xuống.
3. **Cấu hình credential (endpoint/bucket/access key R2) quản lý qua System Admin + DB mã hoá**
   (`SystemStorageConfig`), không phải biến môi trường tĩnh — đã cân nhắc đánh đổi bảo mật với người dùng
   trước khi làm (ADR-017): mã hoá bằng key riêng `STORAGE_ENCRYPTION_KEY`, **không dùng chung**
   `PAYMENT_ENCRYPTION_KEY` — lộ 1 key chỉ lộ đúng 1 miền secret.

---

## 2. Luồng Upload File Sản Phẩm (Presigned PUT / Multipart)

```mermaid
sequenceDiagram
    autonumber
    actor Owner as Tenant Owner (Studio)
    participant Web as apps/web (Route Handler)
    participant Cfg as SystemStorageConfig (DB, mã hoá)
    participant R2 as Cloudflare R2 (S3-compatible)

    Owner->>Web: POST /api/studio/[tenantSlug]/uploads/presign (tên file, size, mimeType)
    Web->>Cfg: Đọc + giải mã credential (AES-256-GCM)
    Web->>Web: assertPlanLimit("fileSize", ...) / assertPlanLimit("storage", ...)
    alt size ≤ 50MB
        Web-->>Owner: PresignedSinglePut { url } — 1 PUT ký sẵn
    else size > 50MB
        Web->>R2: CreateMultipartUploadCommand
        Web-->>Owner: PresignedMultipartUpload { uploadId, partSizeBytes: 10MB, parts[] }
    end
    Owner->>R2: PUT thẳng file lên URL đã ký (không qua server Next.js)
    Owner->>Web: POST .../uploads/complete (key, uploadId?, parts?)
    Web->>Web: isProductObjectKeyFor(key, tenantId, productId) — sai → 400 INVALID_OBJECT_KEY (chưa gọi storage)
    Web->>Web: key đã ghi nhận? → 409 UPLOAD_ALREADY_COMPLETED
    Web->>R2: HeadObjectCommand — kích thước thật (lệch khai báo → xoá object, 400 UPLOAD_SIZE_MISMATCH)
    Web->>Web: assertPlanLimit lại bằng kích thước thật (vượt → xoá object, từ chối)
    Web->>Web: ProductFile.create(PENDING) + storageUsedBytes += kích thước thật
    Web->>Web: enqueue job file.scan (bất đồng bộ, magic-bytes khớp đuôi)
```

- **Bảo mật bước `complete` (ADR-026 §1)** ✅ đọc `apps/web/lib/product-upload.ts` 2026-09-27: 4 bước kiểm trong sơ đồ
  trên chạy theo đúng thứ tự đó; chi tiết + mã lỗi: [[02-System-Specs/Product-Editor-And-Publishing-Specs|Product-Editor-And-Publishing-Specs]] §2.
  (Sơ đồ bản trước đặt `file.scan` đồng bộ trong `complete` — sai với code: scan luôn là job riêng.)
- **Ngưỡng multipart:** `MULTIPART_THRESHOLD_BYTES = 50MB` (`packages/storage/src/presign.ts`) — file ≤ 50MB
  dùng 1 `PutObjectCommand` ký sẵn; lớn hơn dùng multipart, mỗi phần `MULTIPART_PART_SIZE_BYTES = 10MB`.
- **Ảnh bìa sản phẩm — luồng R2 cũ** qua cặp hàm riêng (`presignCoverImageUpload`/`completeCoverImageUpload`) — bucket
  **công khai** (khác bucket file bán), không qua `file.scan`, không tính vào `storageUsedBytes`; `cover-complete` từ
  ADR-026 cũng kiểm `isProductObjectKeyFor(..., "cover")`. **Từ ADR-027 editor dùng ảnh bìa Cloudinary**
  (`Product.coverImageUrl`), R2 chỉ còn là fallback cho dữ liệu cũ — xem §6–§7.
- **Link tài liệu ngoài (ADR-026)** không đi qua upload: không object, không quét, không tính dung lượng.

---

## 3. Kiểm Tra File (`file.scan`) — Chưa Có ClamAV Thật (ADR-018)

`apps/web/lib/file-scan.ts`: mọi file qua được kiểm tra `matchesDeclaredExtension` (magic bytes khớp đuôi khai
báo, `packages/storage/src/file-format.ts`) đều đánh dấu **`CLEAN`**, bất kể có set biến `CLAMAV_HOST` hay
không (nếu có set mà chưa có client thật, chỉ ghi log cảnh báo — không chặn luồng). File sai định dạng bị xoá
khỏi object storage + đánh dấu `REJECTED` + trừ lại dung lượng đã cộng + gửi email báo owner.

`readObjectForScan()` (`packages/storage/src/scan.ts`) đọc object **một lần duy nhất** (stream), vừa hash
SHA-256 vừa lấy đầu file để nhận diện magic bytes — tránh buffer cả file vào memory.

**Ai chạy job `file.scan` (ADR-036, chưa deploy) ✅:** route `POST /api/studio/[tenantSlug]/uploads/complete` sau khi
`completeProductFileUpload` enqueue job gọi `scheduleQueueDrain([FILE_SCAN])` — job được xử lý trong `after()` ngay sau response
(`maxDuration = 60`), cron `GET /api/cron/daily` dọn phần sót. Không còn phụ thuộc worker thường trực; file chỉ kẹt "Đang quét"
khi cả `after()` lẫn cron đều lỗi. Chi tiết: [[02-System-Specs/Background-Jobs-Specs|Background-Jobs-Specs]].

---

## 4. Tải Xuống — `DownloadToken` (Presigned GET, TTL 60s)

```mermaid
sequenceDiagram
    actor C as Customer (đã mua)
    participant Web as apps/web
    participant DB as Postgres (Entitlement, RLS)
    participant R2 as Cloudflare R2

    C->>Web: POST /api/downloads { fileId } (cookie đăng nhập)
    Web->>DB: withCustomer(userId) — kiểm Entitlement chưa bị revoke, downloadsUsed < downloadLimit
    Web->>DB: DownloadToken.create() — chỉ lưu hash SHA-256, TTL 60 giây
    Web-->>C: { token }
    C->>Web: GET /api/downloads/{token}
    Web->>DB: Tìm token theo hash, chưa usedAt, chưa hết hạn — atomic-claim (updateMany có điều kiện)
    Web->>DB: Kiểm lại nguồn giao hàng (deliverableTarget) — không còn giao được → 410 DOWNLOAD_SOURCE_UNAVAILABLE
    Web->>DB: entitlement.downloadsUsed += 1 (atomic) + DownloadEvent
    alt sourceKind = FILE
        Web->>R2: createPresignedDownload() — GetObjectCommand + ResponseContentDisposition: attachment
        Web-->>C: 302 redirect tới URL presigned (sống ≤ 600 giây, clamp bởi clampDownloadTtlSeconds)
    else sourceKind = EXTERNAL_URL (ADR-026)
        Web-->>C: 302 redirect tới link ngoài đã chuẩn hoá lại qua allowlist
    end
```

- **Link tài liệu ngoài (ADR-026)** ✅ đọc `apps/web/lib/{download,library,share-link}.ts` 2026-09-27:
  - `deliverableTarget()` quyết định dòng nào giao được: `FILE` phải `CLEAN` và có `objectKey`; `EXTERNAL_URL` phải
    còn qua `normalizeExternalDocumentUrl` (**kiểm ở cả 2 bước** — phòng allowlist bị thu hẹp sau khi đã lưu).
  - Bước 1 không giao được → 404; bước 2 kiểm lại **trước khi trừ lượt** → `410 DOWNLOAD_SOURCE_UNAVAILABLE`
    (token đã bị claim nhưng `downloadsUsed` không tăng).
  - Link đi cùng luồng entitlement/`downloadLimit`/`DownloadEvent` như file — mỗi lần mở link ăn 1 lượt.
  - Thư viện (`listLibraryEntitlements`, kiểu `LibraryFile`): mỗi mục có `kind: "FILE" | "EXTERNAL_URL"`; chỉ liệt kê file `CLEAN` và link còn qua
    allowlist; nút hiện "Mở link tài liệu" cho link. `LibraryFile` **không chứa URL link** (chỉ `id, kind, fileName,
    sizeBytes`) — URL chỉ lộ ra qua 302 ở bước 2.
  - RLS nhánh customer của `product_files` đọc được dòng `EXTERNAL_URL` khi có entitlement (xem
    [[03-API-Contracts/Database-Schema-Reference|Database-Schema-Reference]] §7).
  - **Share link không bao giờ giao link ngoài** — chỉ `FILE`, không preview, `CLEAN`, chưa gỡ (§5).

- **`DownloadToken` là bảng L1, không RLS** — cùng mẫu `RefreshToken`/`VerificationToken`: ranh giới bảo mật là
  "ai đang giữ token thô" (chỉ lưu `tokenHash`, không lưu token gốc — CLAUDE.md §7.2), không phải lọc theo
  dòng dữ liệu. Có `tenantId` denormalize từ `entitlement.tenantId` để mở đúng `withTenant()` ngay từ đầu.
- **`buildAttachmentDisposition()`** (`packages/storage/src/download-disposition.ts`) dùng cú pháp RFC 5987
  (`filename*=UTF-8''...`) — bắt buộc cho tên file tiếng Việt có dấu; `filename="..."` ASCII thường sẽ lỗi.
- **`clampDownloadTtlSeconds()`**: giới hạn cứng `MAX_DOWNLOAD_PRESIGN_TTL_SECONDS = 600` (10 phút) — đúng
  CLAUDE.md §7.6 "URL tải chỉ là presigned, sống ≤ 10 phút" — áp dụng ngay trong `createPresignedDownload()`,
  không chỉ ở test.
- **`downloadLimit = 0` nghĩa là không giới hạn số lượt tải** (ADR-015) — snapshot từ `Product.downloadLimit`
  tại thời điểm mua vào `Entitlement.downloadLimit`, một thay đổi sau đó trên `Product` không ảnh hưởng khách
  đã mua.
- **Rate limit chống dò:** 20 lượt/10 phút mỗi user cho `/api/downloads`.
- **Tài liệu bị gỡ do vi phạm (ADR-039)** — entitlement có `remedyStatus ≠ NONE` bị chặn/giới hạn tải, xem §8.

---

## 5. Share Link — Chia Sẻ Công Khai Có Mật Khẩu (`ShareLink`)

Owner tạo link tải riêng cho 1 sản phẩm tại `/studio/[tenantSlug]/products/[productId]/share-links`, không cần
người nhận đăng nhập:

- **`tokenHash`**: chỉ lưu hash — token thô chỉ hiện đúng **một lần** lúc tạo (CLAUDE.md §7.2).
- **`passwordHash`** (tuỳ chọn): dùng **argon2id riêng trong `packages/core`**
  (`packages/core/src/download/share-link-password.ts`) — không gọi lại `packages/auth`'s password functions,
  để giữ đúng chiều phụ thuộc package (`core` không phụ thuộc `auth`, ADR-020).
- **`fileIds` null/rỗng** = mọi file đang bán của sản phẩm (cùng quy ước "rỗng = không giới hạn" với
  `Coupon.productIds`, M6).
- **`maxUses`/`expiresAt`/`revokedAt`**: hết lượt/hết hạn/bị thu hồi → trả **410**; token không tồn tại → 404 —
  RLS trên `share_links` **không lọc theo status** ở nhánh public, để phân biệt đúng 2 mã lỗi này. Từ ADR-029 mục 0
  (migration `20260927130000_rls_adr029_split_write_policies`) nhánh public này chỉ còn trong policy **đọc**
  `select_access`; tăng `usedCount` chạy dưới `withTenant` ✅ (theo comment migration). Trước đó scope public ghi được
  mọi share link ở tầng DB (bỏ `revokedAt`, đặt lại `usedCount`).
- **Rate limit:** 20 lượt/10 phút mỗi token — chống dò mật khẩu.
- **Route công khai:** `GET /s/[token]` (trang nhập mật khẩu nếu cần), `POST /api/share-links/{token}/download`.
- **Chỉ file (ADR-026)** ✅: share link là kênh ẩn danh nên chỉ nhận dòng `sourceKind = FILE` — link tài liệu ngoài
  không bao giờ đi qua share link.
- **Gian hàng phải `ACTIVE` (ADR-040)** ✅ đọc code `apps/web/lib/share-link.ts` 2026-10-17: tenant không `ACTIVE` (`READ_ONLY` hoặc
  `LOCKED`) → **410 `SHARE_LINK_TENANT_LOCKED`** ("Link không còn hiệu lực.") ở **cả** bước mở link (`resolveShareLink`) **và** bước tải
  (`consumeShareLinkDownload`, kiểm sau `isShareLinkUsable`, trước mật khẩu/tăng `usedCount`). Trước ADR-040 chỉ chặn `LOCKED` và chỉ ở
  bước mở link. Dữ liệu link không đổi — tenant về `ACTIVE` thì link (còn hạn/lượt) dùng lại được. Bản trích
  [[01-Architecture-Decisions/ADR-026-Only-Active-Tenant-Shows-Documents|ADR-026 (KB)]].
- **Thư viện khách đã mua** (`DownloadToken`, §4) **không** bị chặn theo trạng thái tenant (ADR-040 mục 4) 🟡 (theo brief; đợt này không
  đổi code tải của khách).

**3 lỗ hổng RLS thật đã phát hiện và sửa qua chính integration test (ADR-020)** — không phải qua review:
`products`/`product_files` (RLS từ M4/M5) từng thiếu nhánh "customer đã mua" (khách mua rồi vẫn không đọc được
sản phẩm/file của chính mình một khi sản phẩm bị gỡ khỏi `PUBLISHED`); `consumeShareLinkDownload()` từng đọc
`share_links` qua `getPrismaClient()` trần thay vì `withPublic()`. Cả 3 đã sửa bằng migration RLS riêng, không
sửa lại policy gốc trong migration cũ (giữ lịch sử migration bất biến).

**Siết ghi (ADR-029 mục 0)** ✅ đọc SQL: `products`, `product_files`, `share_links`, `entitlements` (cùng `coupons`,
`orders`, `order_items`) chuyển từ 1 policy `tenant_isolation` `FOR ALL` sang `select_access` (giữ nguyên điều kiện đọc
nêu ở trang này) + `write_insert/update/delete` chỉ tenant hoặc `system_job`. Khách không còn tự UPDATE được
`downloadsUsed/downloadLimit` của entitlement ở tầng DB. Xem [[02-System-Specs/Architecture-Overview|Architecture-Overview]] §3.

---

## 6. Cloudinary Hệ Thống — Bối Cảnh

Tài khoản Cloudinary hệ thống cấu hình ở `/admin/settings/cloudinary` (`SystemCloudinaryConfig`, secret mã hoá bằng
`STORAGE_ENCRYPTION_KEY`; đổi cloud name/key/secret thì tự tắt cho tới khi admin "Kiểm tra kết nối" lại — cùng cơ chế
auto-disable của R2/SePay/MoMo) ✅ `apps/web/lib/system-cloudinary.ts`. Ban đầu chỉ phục vụ ảnh Landing Page CMS; sau
đó dùng thêm cho ảnh storefront tenant (ADR-023), ảnh bìa sản phẩm (`Product.coverImageUrl`, ADR-027) và ảnh trong mô
tả sản phẩm (ADR-028). File tài liệu bán **vẫn chỉ ở R2 private**. Ảnh không đi qua server Next.js: trình duyệt upload
thẳng lên Cloudinary bằng chữ ký do server cấp, ảnh phục vụ từ CDN `res.cloudinary.com`.

---

## 7. Ảnh Tenant Trên Cloudinary Hệ Thống — Chữ Ký, Hạn Mức, Tối Ưu (ADR-028)

Đối chiếu code 2026-09-27 ✅: `apps/web/lib/tenant-media.ts`, `apps/web/lib/system-cloudinary.ts`,
`apps/web/lib/cloudinary-signature.ts`, `apps/web/app/studio/[tenantSlug]/media-actions.ts`,
`apps/web/app/_ui/cloudinary-actions.ts`, `packages/core/src/content/{cloudinary-url,sanitize-html}.ts`,
`packages/core/src/tenant/storefront-sections.ts`. ADR: [[01-Architecture-Decisions/ADR-014-System-Cloudinary-Image-Quota|ADR-014 (≙ ADR-028)]].

### 7.1 Luồng ký → upload → register

```mermaid
sequenceDiagram
    autonumber
    actor Owner as Tenant Owner (Studio)
    participant Web as apps/web (Server Action)
    participant DB as tenant_media_assets (L2, RLS)
    participant CL as Cloudinary (hệ thống)

    Owner->>Web: xin chữ ký (usage CONTENT | PRODUCT_COVER | STOREFRONT | POST)
    Web->>Web: requireTenantMember → tenant.id (không lấy từ client)
    Web->>CL: đối soát lười ≤3 dòng giữ chỗ quá 1 giờ (Admin API)
    Web->>DB: tổng bytes (withTenant) so với Plan.imageStorageMb — đã chạm/vượt → IMAGE_QUOTA_EXCEEDED
    Web->>Web: public_id = root/tenants/id/(content|products|storefront|posts)/24-hex — ký public_id + allowed_formats + transformation
    Web->>DB: tạo dòng giữ chỗ bytes = 5MB, verifiedAt = null
    Web-->>Owner: CloudinarySignatureResult (uploadParams)
    Owner->>CL: POST /image/upload (file + api_key + signature + uploadParams NGUYÊN VẸN)
    Owner->>Web: registerTenantImageAction(publicId, usage)
    Web->>Web: kiểm public_id đúng tiền tố tenant + usage + tên 24 hex — sai → INVALID_IMAGE_PUBLIC_ID
    Web->>CL: Admin API GET resources/image/upload/public_id (timeout 5s)
    alt found
        Web->>DB: ghi bytes/format/width/height thật, verifiedAt = now
        Web-->>Owner: { ok, url: secure_url, verified: true }
    else not_found (404)
        Web->>DB: xoá dòng giữ chỗ
        Web-->>Owner: IMAGE_NOT_FOUND
    else lỗi Admin API
        Web->>DB: giữ/tạo dòng mức tạm 5MB
        Web-->>Owner: { ok, url dựng từ public_id, verified: false }
    end
```

- **Ký `public_id` đầy đủ, không ký `folder`** ✅: một chữ ký chỉ tạo/ghi đè đúng 1 asset — không dùng lại chữ ký để
  upload hàng loạt trong 1 giờ hiệu lực. Chuỗi ký = mọi tham số (trừ `file`, `cloud_name`, `resource_type`,
  `api_key`) sắp theo alphabet, nối `key=value` bằng `&`, cộng `apiSecret`, SHA-1. Client phải gửi **nguyên vẹn**
  `uploadParams` — thêm/bớt/sửa một tham số là Cloudinary từ chối.
- **Định dạng tenant:** `allowed_formats` = png, jpg, jpeg, webp (không SVG, không GIF) — nằm trong chữ ký ✅.
- **Incoming transformation** `c_limit,w_2000,h_2000` nằm trong chữ ký: Cloudinary thu cạnh dài về ≤2000px trước khi
  lưu bản gốc, không phóng ảnh nhỏ ✅.
- **Giữ chỗ hạn mức lúc ký** ✅: mọi chữ ký đã cấp bị tính 5MB (`UNVERIFIED_IMAGE_BYTES`) cho tới khi xác minh — không
  lách hạn mức bằng cách "upload rồi không báo". Dòng giữ chỗ quá 1 giờ (hết hiệu lực chữ ký) chưa xác minh được đối
  soát lười **tối đa 3 dòng mỗi lần xin chữ ký** (Admin API có rate limit): Cloudinary báo không có → xoá; có → ghi số
  thật; Admin API lỗi → dừng, để lần sau.
- **Số liệu chỉ lấy từ server** ✅: `bytes/format/width/height` đọc qua Admin API (Basic Auth `api_key:api_secret`),
  không nhận từ client. `secure_url` trả về chỉ được dùng khi đúng cloud hệ thống, nếu không thì dùng URL dựng từ
  `public_id`.
- **Hành vi đã biết — Cloudinary bị tắt giữa lúc ký và register** (Quốc chấp nhận 2026-09-27) ✅: register dùng
  `getSystemCloudinaryLocation()` (không kiểm `isEnabled`) nên vẫn qua bước kiểm `public_id`, nhưng Admin API chỉ đọc
  cấu hình đang bật → trả nhánh lỗi: ảnh được nhận với `verified:false`, giữ mức tạm 5MB (không trả
  `CLOUDINARY_NOT_CONFIGURED`). Số thật được đối soát ở lần xin chữ ký sau khi Cloudinary bật lại.
- **So hạn mức lúc cấp chữ ký** (`usedBytes >= limitBytes` → từ chối): ảnh cuối cùng có thể đẩy tổng vượt hạn mức tối
  đa bằng một ảnh ✅ (đọc code — ghi nhận hành vi hiện tại).
- **Chưa có:** job dọn asset mồ côi (ảnh đã register nhưng không còn được dùng vẫn tính hạn mức); UI hiển thị "Đã dùng
  X/Y MB ảnh"; upload preset chặn cứng dung lượng file ở Cloudinary (BACKLOG).

### 7.2 Hạn mức theo gói

| Gói (dữ liệu khởi tạo) | `Plan.imageStorageMb` |
|---|---|
| FREE | 100 |
| CREATOR | 1024 |
| PRO | 2048 |
| BUSINESS | 5120 |

✅ migration `20260927110000_adr028_image_quota_media_assets` (default 100 + UPDATE theo `code`) và `seed.ts`. Chỉ là
dữ liệu khởi tạo — System Admin sửa ở `/admin/plans` (ô "Dung lượng ảnh (MB)", số nguyên ≥ 0 qua
`packages/core/src/admin/plan-validation.ts`); logic không đọc `plan.code` (ADR-021). Hạn mức cộng chung ảnh mô tả +
ảnh bìa + ảnh storefront (tổng `bytes` của `tenant_media_assets` theo tenant). Gói xác định từ `subscription` của
tenant như `assertPlanLimit`. Hạn mức ảnh **tách riêng** với `storageUsedBytes` (dung lượng file R2).

### 7.3 Chữ ký dùng chung (admin) và chữ ký tenant

| Action | Guard | Ký gì | Dùng ở |
|---|---|---|---|
| `getCloudinaryUploadSignatureAction` (`app/_ui/cloudinary-actions.ts`) | `requireRole("SYSTEM_ADMIN")` | `folder` = root, `allowed_formats` png/jpg/jpeg/webp/svg | `ImageUploadField` mặc định (CMS, nhận diện thương hiệu, danh mục), editor mô tả danh mục |
| `getContentImageUploadSignatureAction` (`studio/[tenantSlug]/media-actions.ts`) | `requireTenantMember` | `public_id` `tenants/<id>/content/…` | Editor mô tả sản phẩm |
| `getProductCoverUploadSignatureAction` (`studio/[tenantSlug]/products/actions.ts`) | `requireTenantMember` | `public_id` `tenants/<id>/products/…` | Card Ảnh đại diện |
| `getTenantCloudinaryUploadSignatureAction` (`studio/[tenantSlug]/storefront/actions.ts`) | `requireTenantMember` | `public_id` `tenants/<id>/storefront/…` | Storefront editor |

Trước 2026-09-27 chữ ký dùng chung chỉ `requireUser()` (mọi tài khoản, kể cả khách mua hàng, lấy được chữ ký upload vào
folder gốc) — đã siết ✅. SVG giữ cho logo admin (hiển thị qua `<img>` nên không thực thi script). Ảnh admin **không**
tính hạn mức và không ghi `tenant_media_assets`.

### 7.4 Tối ưu hiển thị — `cloudinaryDeliveryUrl`

`cloudinaryDeliveryUrl(secureUrl, { width })` (`packages/core/src/content/cloudinary-url.ts`, subpath
`@gieochu/core/cloudinary-url` để client component import) chèn `f_auto,q_auto,c_limit,w_<N>` sau `/image/upload/`, N
kẹp về [1, 1600] ✅. Chỉ áp cho `https://res.cloudinary.com/<cloud>/image/upload/...`; URL khác (R2, host ngoài,
`image/fetch`) trả nguyên. Idempotent (thay `w_` cũ), giữ transformation có sẵn khác, nối bộ tối ưu vào cuối chuỗi
transformation.

| Ngữ cảnh | `width` | Nơi gọi ✅ |
|---|---|---|
| Thẻ tài liệu storefront | 800 | `app/[tenantSlug]/_ui/products.tsx` |
| Ảnh bìa trang chi tiết | 1200 | `app/[tenantSlug]/_ui/product-detail.tsx` |
| Ảnh trong mô tả (lúc render) | 1200 | `product-detail.tsx` → `sanitizeRichTextHtml(..., { imageWidth: 1200 })` |
| Hero storefront | 1000 | `app/[tenantSlug]/_ui/hero.tsx` |
| Avatar testimonial / icon dịch vụ | 200 | `testimonials.tsx`, `services.tsx` |
| Preview trong `ImageUploadField` | 600 | `app/admin/_ui/image-upload-field.tsx` |
| Logo | không áp | không có lời gọi `cloudinaryDeliveryUrl` cho logo (theo brief: logo giữ nguyên URL) |

### 7.5 Sanitizer & kiểm URL ảnh

- `sanitizeRichTextHtml(html, { imageCloudName, imageWidth? })` ✅: `img` chỉ giữ khi `src` là
  `https://res.cloudinary.com/<imageCloudName>/image/upload/...`; ảnh host/cloud khác bị **bỏ hẳn thẻ**.
  `imageCloudName = null` (chưa cấu hình Cloudinary) → loại mọi ảnh. Khi **lưu** không truyền `imageWidth` (DB giữ URL
  gốc); khi **render** truyền `imageWidth` để viết lại `src` qua `cloudinaryDeliveryUrl`. Áp ở mô tả sản phẩm (lưu +
  render trang chi tiết + trang Xem trước) và mô tả danh mục (admin, lúc lưu).
- `isCloudinaryImageUrl(value, cloudName?)` ✅: không truyền `cloudName` = chỉ kiểm host `res.cloudinary.com` (schema zod
  thuần/client); truyền chuỗi = bắt buộc tiền tố `/<cloudName>/image/upload/`; truyền `null` = luôn false. Server dùng
  bản có cloud name khi lưu `coverImageUrl` (`products/actions.ts`) và ảnh storefront (`storefront/actions.ts`).
- Cloud name đọc qua `getSystemCloudinaryLocation()` — đọc **cả khi cấu hình đang tắt** (ảnh đã lưu vẫn hiển thị và lọc
  đúng cloud), `cache()` gộp trong một request.
- `coverImageUrl` nay kiểm đúng cloud hệ thống nhưng **chưa kiểm folder** `tenants/<id>/products` — tenant về lý thuyết
  dán được URL ảnh của tenant khác cùng cloud (BACKLOG).

### 7.6 Chưa verify ❓
Upload thật lên Cloudinary với chữ ký `public_id` + `transformation`; phản hồi Admin API thật (404, timeout, rate
limit); ảnh `f_auto` qua CSP `img-src` trên trình duyệt; tenant gói FREE chạm 100MB trên dev server.

---

## 8. Chặn Tải Khi Tài Liệu Bị Gỡ Do Vi Phạm (ADR-039) ✅

Đối chiếu `apps/web/lib/download.ts`, `apps/web/lib/entitlement-remedy.ts`, `apps/web/lib/library.ts` (working tree 2026-10-17, chưa
commit/deploy). Nghiệp vụ đầy đủ: [[02-System-Specs/Abuse-Reports-Specs|Abuse-Reports-Specs]] §6.

| `entitlements.remedyStatus` | Bước 1 `POST /api/downloads` | Bước 2 `GET /api/downloads/{token}` |
| :-- | :-- | :-- |
| `NONE` | Như cũ | Như cũ |
| `PENDING_CHOICE` | 403 `REMEDY_CHOICE_REQUIRED` | UPDATE không khớp → 403 `REMEDY_CHOICE_REQUIRED` |
| `FINAL_DOWNLOAD` | Theo `downloadLimit` (= `downloadsUsed` lúc chọn + số tệp khả dụng) | Theo `downloadLimit` |
| `REFUND_REQUESTED` / `REFUNDED` | 403 `DOWNLOAD_BLOCKED_REFUND` | UPDATE không khớp → 403 `DOWNLOAD_BLOCKED_REFUND` |

- Bước 1 kiểm thu hồi **trước** remedy — entitlement đã thu hồi (gồm `REFUNDED`, luôn kèm thu hồi) vẫn báo mã `ENTITLEMENT_REVOKED` cũ.
- Bước 2: câu `UPDATE "entitlements" SET "downloadsUsed" = "downloadsUsed" + 1` thêm điều kiện `"remedyStatus" IN ('NONE',
  'FINAL_DOWNLOAD')` → token cấp **trước** khi admin lưu trữ tài liệu (hoặc trước khi khách chọn hoàn tiền) không còn tải được; khi UPDATE
  trả 0 dòng, đọc lại trạng thái để trả đúng mã remedy thay vì `DOWNLOAD_LIMIT_REACHED`. Token đã bị claim, lượt không bị trừ.
- **"Tải lần cuối" = đủ mọi tệp** (Quốc chốt 🟡, code ✅): `downloadLimit = downloadsUsed + max(1, số tệp khả dụng)` — mỗi tệp/link khả
  dụng 1 lượt. Lượt tính **chung theo entitlement**, không theo từng tệp — chốt ở "Bổ sung ADR-039 lần 2" (d): khách tải lại 1 tệp sẽ bớt
  lượt cho tệp khác. Chữ UI: "Bạn có N lượt tải cuối cho N tệp — mỗi lượt tải một tệp, hãy tải mỗi tệp một lần." (`remedy-notice.tsx`); Studio: "(số lượt bằng số tệp — mỗi lượt tải một tệp)" (`remedy-parts.tsx`) ✅ đọc code 2026-10-17.
- Tenant **không** "Cấp thêm lượt" được khi `remedyStatus ≠ NONE` (409 `REMEDY_DOWNLOAD_LIMIT_LOCKED` + trigger `entitlements_guard_remedy`).
- Share link (§5) không đổi — khoá kiểm duyệt luôn kèm sản phẩm `ARCHIVED`; hành vi share link với sản phẩm `ARCHIVED` giữ như trước (Long
  chưa đối chiếu lại nhánh này trong đợt M12c ❓).

---

## 9. Storage Gateway — Giao File Qua `/_s/<vé>` (ADR-045) ✅

Đối chiếu `packages/core/src/crypto/storage-ticket.ts`, `apps/web/lib/storage-gateway.ts`, `apps/web/app/api/internal/storage/ticket/route.ts`,
`packages/config/src/env.ts`, `docker/nginx/gieochu-storage-gateway.conf.example` (working tree 2026-10-22; nay đã commit `4ab5a3b` — deploy ❓). Quyết định:
[[01-Architecture-Decisions/ADR-030-Storage-Gateway-Encrypted-Ticket-Nginx|ADR-030 (≙ ADR-045)]].

### 9.1 Khi nào bật
* Env tuỳ chọn `STORAGE_GATEWAY_PROVIDERS` — danh sách phân tách dấu phẩy, giá trị thuộc `MINIO`, `CLOUDFLARE_R2`; không đặt/rỗng = `[]`
  (gateway tắt); `trim` + bỏ trùng; giá trị lạ → app **dừng khi khởi động** (zod fail-fast).
* Quyết định theo **provider của S3 client đã ký URL** (`signingProvider`), không theo `activeProvider`: tải/share-link dùng
  `ProductFile.storageProvider` nếu khác active và tạo được client, ngược lại `activeProvider`; upload file sản phẩm dùng provider của bucket
  tenant (`getOrCreateTenantBucket`) khi active là MinIO hoặc tenant đã có bucket riêng; ảnh bìa luôn `activeProvider`.
* Provider không có trong danh sách → trả presigned URL nguyên vẹn (hành vi trước ADR-045).

### 9.2 Luồng

```mermaid
sequenceDiagram
    autonumber
    actor B as Trình duyệt
    participant N as nginx (gieochu.net)
    participant W as Next.js (127.0.0.1:3000)
    participant M as MinIO (127.0.0.1:9000)

    B->>W: (qua nginx) GET /api/downloads/{token} | POST share-link | POST uploads/presign
    W->>W: Kiểm quyền/lượt như cũ, ký presigned URL nội bộ (endpoint MinIO trong Admin)
    W->>W: sealStorageTicket({method, target = pathname+search, exp, maxBytes?})
    W-->>B: URL /_s/<vé> (302 tuyệt đối theo APP_URL, hoặc tương đối trong JSON)
    B->>N: GET|PUT /_s/<vé>
    N->>W: auth_request → GET /api/internal/storage/ticket (X-Original-URI/Method/Length)
    alt vé hợp lệ
        W-->>N: 204 + X-Storage-Target
        N->>M: proxy_pass http://127.0.0.1:9000$target (Host 127.0.0.1:9000, bỏ Authorization/Cookie)
        M-->>N: stream (Range/206 được giữ, không buffer)
        N-->>B: byte file / kết quả PUT (ẩn x-amz-*, Server)
    else từ chối
        W-->>N: 403 STORAGE_TICKET_REJECTED
        N-->>B: 404 "Không tìm thấy tệp hoặc liên kết đã hết hạn." (error_page — theo file mẫu 🟡)
    end
```

Byte tải/upload **không đi qua Node** — Next chỉ giải vé. Contract endpoint nội bộ: [[03-API-Contracts/Endpoint-Directory|Endpoint-Directory]] §23.

### 9.3 Định dạng vé
| Thành phần | Giá trị |
| :-- | :-- |
| Khoá | HKDF-SHA256 từ `STORAGE_ENCRYPTION_KEY` (giải base64), salt rỗng, info **`gieochu:storage-ticket:v1`**, 32 byte — **không** dùng lại khoá thô đang mã hoá credential storage; cache theo giá trị khoá trong process |
| Mã hoá | AES-256-GCM, IV ngẫu nhiên 12 byte, auth tag 16 byte |
| Plaintext | JSON `{ method, target, exp, maxBytes? }` |
| Chuỗi vé | `base64url(iv ‖ tag ‖ ciphertext)` — chỉ `[A-Za-z0-9_-]`, an toàn trong path; dài **≤ 8192** ký tự, dài hơn/ký tự lạ → từ chối |
| `method` | `"GET"` hoặc `"PUT"` — so **khớp chính xác** với method request gốc (vé GET không dùng cho PUT và ngược lại) |
| `target` | Chỉ `pathname + search` của presigned URL nội bộ: bắt đầu `/`, **không** bắt đầu `//`, **không** chứa `://`, chỉ ký tự ASCII in được `\x21–\x7E` (chặn CR/LF/khoảng trắng lọt vào header `X-Storage-Target` và `proxy_pass`) |
| `exp` | Epoch giây UTC = lúc phát + TTL presign; `now ≥ exp` → hết hạn. Tải: `clampDownloadTtlSeconds(presignDownloadTtlSeconds)` (≤ 600s); upload: `presignUploadTtlSeconds` (System Center, 60–3600s) |
| `maxBytes` | Chỉ vé `PUT`: upload đơn = `sizeBytes` khai báo; từng part multipart = `partSizeBytes` (10 MB). Route kiểm `X-Original-Length` là số và ≤ `maxBytes`, thiếu → từ chối |

`openStorageTicket` **không ném** — sai định dạng, sai tag (bị sửa/khác khoá), JSON không hợp lệ, payload sai kiểu, hết hạn đều trả `null` →
route trả 403. `sealStorageTicket` ném `Error` nếu payload không hợp lệ (lỗi lập trình, không phải lỗi người dùng).

### 9.4 Hệ quả cho các quy tắc ở trang này
* Quy tắc "URL tải chỉ là presigned, sống ≤ 10 phút, `attachment`" (§1, §4) giữ nguyên: vé bọc chính presigned URL đó (gồm
  `response-content-disposition` trong query), hạn vé = hạn presign ✅.
* Bước `complete` (§2) không đổi — vẫn `HeadObject` kiểm kích thước thật; `maxBytes` ở vé chỉ là chặn sớm ở nginx.
* Đổi `STORAGE_ENCRYPTION_KEY` làm mọi vé đang lưu hành mất hiệu lực (cùng lúc credential storage không giải mã được) — suy từ cơ chế ✅.
* Ảnh public (bucket `{prefix}public`, vd `gc-public`): không qua vé — `publicBaseUrl` MinIO = `https://gieochu.net/media`, nginx
  `location /media/` chỉ GET/HEAD proxy tới bucket 🟡 (cấu hình, không có code).

### 9.5 Chưa verify ❓
Chạy thật trên VPS: tải 302, share-link, upload đơn + multipart > 50 MB, ảnh bìa, Range 206, `/media/`, `/api/internal/` từ ngoài → 404.
Quy trình kiểm: [[04-Operations-Runbooks/Storage-Gateway-VPS-Runbook|Storage-Gateway-VPS-Runbook]] §3.

---

## 10. Tài Liệu Tham Chiếu & Liên Kết

* [[Architecture-Overview]] — Tổng quan kiến trúc hệ thống ([Architecture-Overview.md](./Architecture-Overview.md))
* [[Order-State-Machine]] — `Entitlement` được tạo khi đơn `FULFILLED` ([Order-State-Machine.md](./Order-State-Machine.md))
* [docs/DECISIONS.md](../../docs/DECISIONS.md) — ADR-014 (chia 2 phần M5), ADR-017 (storage qua System Admin),
  ADR-018 (file.scan chưa có ClamAV), ADR-020 (RLS/argon2 share link), ADR-028 (ảnh Cloudinary hệ thống)
* Mã nguồn: `packages/storage/src/*.ts`, `apps/web/lib/{product-upload,file-scan,download,share-link,system-storage,system-cloudinary,tenant-media}.ts`,
  `packages/core/src/download/*.ts`
* [[02-System-Specs/Product-Editor-And-Publishing-Specs|Product-Editor-And-Publishing-Specs]] — ADR-026/027 ([Product-Editor-And-Publishing-Specs.md](./Product-Editor-And-Publishing-Specs.md))
* [[01-Architecture-Decisions/ADR-014-System-Cloudinary-Image-Quota|ADR-014 (≙ ADR-028)]] — ảnh Cloudinary hệ thống + hạn mức ([ADR-014-System-Cloudinary-Image-Quota.md](../01-Architecture-Decisions/ADR-014-System-Cloudinary-Image-Quota.md))
* [[02-System-Specs/Abuse-Reports-Specs|Abuse-Reports-Specs]] — ADR-038/039, quyền lợi người mua ([Abuse-Reports-Specs.md](./Abuse-Reports-Specs.md))
* [[03-API-Contracts/Endpoint-Directory|Endpoint-Directory]] §11 — contract action ảnh; §23 — endpoint nội bộ Storage Gateway ([Endpoint-Directory.md](../03-API-Contracts/Endpoint-Directory.md))
* [[01-Architecture-Decisions/ADR-030-Storage-Gateway-Encrypted-Ticket-Nginx|ADR-030 (≙ ADR-045)]] ([ADR-030-Storage-Gateway-Encrypted-Ticket-Nginx.md](../01-Architecture-Decisions/ADR-030-Storage-Gateway-Encrypted-Ticket-Nginx.md)) · [[04-Operations-Runbooks/Storage-Gateway-VPS-Runbook|Storage-Gateway-VPS-Runbook]] ([Storage-Gateway-VPS-Runbook.md](../04-Operations-Runbooks/Storage-Gateway-VPS-Runbook.md))
* Mã nguồn ADR-045: `packages/core/src/crypto/storage-ticket.ts`, `apps/web/lib/storage-gateway.ts`, `apps/web/app/api/internal/storage/ticket/route.ts`, `docker/nginx/gieochu-storage-gateway.conf.example`

*Quay lại: [[MOC-Home]] (../00-Index/MOC-Home.md)*

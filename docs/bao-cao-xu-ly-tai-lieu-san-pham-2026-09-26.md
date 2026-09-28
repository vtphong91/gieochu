# Báo cáo rà soát — Xử lý "tài liệu" (file sản phẩm số) & trang Studio Tạo/Sửa sản phẩm

> **Ngày:** 2026-09-26 · **Loại:** Báo cáo rà soát làm đầu vào lập kế hoạch (không kèm thay đổi code).
> **Người viết:** Long (tài liệu), theo brief của Quốc.
> **Phạm vi:** Toàn bộ cách Gieo Chữ đang lưu, quét, giao và phân loại "tài liệu" — đối chiếu với yêu cầu mới của
> chủ dự án cho trang Studio "Tạo/Sửa sản phẩm" (sidebar chọn danh mục, nhập link tài liệu hoặc upload file).
> **Nguồn:** `packages/db/prisma/schema.prisma`, `packages/db/prisma/seed.ts`, `packages/storage/src/*.ts`,
> `packages/config/src/env.ts`, `apps/web/lib/{product,product-upload,file-scan,download,share-link,library,plan-limits,document-category}.ts`,
> `apps/web/app/studio/[tenantSlug]/products/**`, `apps/web/app/api/studio/[tenantSlug]/uploads/**`,
> `apps/web/app/api/downloads/**`, `apps/web/app/api/share-links/**`, `apps/web/app/admin/categories/**`,
> `apps/web/app/[tenantSlug]/products/[productSlug]/page.tsx`; tài liệu `docs/GIEOCHU_PROMPT_MVP_PHASE1.md`
> (§M5, §7), `docs/modules/M5.md`, `docs/modules/M9.md`, `docs/DECISIONS.md` (ADR-014/015/017/018/020),
> `docs/BACKLOG.md`, `docs/PLAN.md`, `docs/GIEOCHU_PRODUCT_MODULE_DEEP_PLAN_V1.0.md`,
> `docs/GIEOCHU_TIPTAP_EDITOR_AI_ROADMAP_V1.0.md`, `docs/bao-cao-ky-thuat-tiptap-editor-content-creator-2026-09-19.md`.
>
> **Ký hiệu xác minh:** ✅ đã đối chiếu code/DB schema · 🟡 nghe từ báo cáo/tài liệu hoặc hiểu biết chung, chưa
> kiểm chứng · ❓ cần môi trường thật (R2, trình duyệt, DB production) để xác nhận.

---

## 1. Tóm tắt điều hành

- Backend "tài liệu = file upload lên R2 private" **đã có đủ** ✅: presign PUT/multipart, `complete` xác nhận bằng
  `HeadObject`, job `file.scan` (magic bytes + sha256, **chưa có ClamAV** — ADR-018), giới hạn dung lượng theo gói,
  tải xuống 2 bước qua token dùng-một-lần + presigned GET ≤ 10 phút + `downloadLimit`, share link private.
- Trang Studio **Tạo** sản phẩm chỉ có tiêu đề/đường dẫn/loại/mô tả ✅ — do file cần `productId` để dựng object
  key, upload hiện chỉ có ở trang **Sửa** (sau khi tạo nháp) ✅. Trang Sửa đã có ảnh bìa, upload file (1 file/lần,
  cờ preview), giá/khuyến mãi, tags, lượt tải, trạng thái ✅.
- **Danh mục tài liệu** (`DocumentCategory`) là bảng L1 do System Admin tạo ở `/admin/categories`, **chưa có
  quan hệ nào với `Product`** (không FK, không bảng nối) và không có UI phía tenant nào đọc nó ✅.
- **Link tài liệu ngoài** (Drive/OneDrive/Dropbox) **chưa tồn tại** ở bất kỳ tầng nào ✅, và mâu thuẫn trực tiếp
  với điều kiện xuất bản hiện hành ("có ít nhất 1 file bán `CLEAN`") và nguyên tắc §7.6 (file trong bucket
  private, chỉ presigned URL).
- File **preview** upload được và gắn cờ `isPreview`, nhưng **không có đường nào hiển thị/tải preview** cho khách ✅.
- Khuyến nghị: phương án (C) — file R2 là nguồn chính; link ngoài (nếu chủ dự án cho phép) là loại giao hàng
  riêng có cảnh báo, cần ADR. Giai đoạn 1 chỉ làm UI trên backend đã có + gắn danh mục (cần migration).
- Nhiều quyết định chạm tiền/bảo mật/quy tắc xuất bản — **cần chủ dự án chốt trước khi code** (mục 5.4, 6).

---

## 2. Hiện trạng đã có

### 2.1 Mô hình dữ liệu ✅

| Model | Layer | Điểm chính liên quan tài liệu |
|---|---|---|
| `Product` | L2 (RLS) | `title`, `slug` (unique theo tenant), `description` (HTML, sanitize server-side), `type` (`TEMPLATE/SLIDE/EBOOK/EXAM/OTHER`), `coverImageKey` (bucket **public**), `tags String[]`, `priceVnd`, `salePriceVnd/saleStartsAt/saleEndsAt`, `downloadLimit` (mặc định 5, `0` = không giới hạn — ADR-015), `status` (`DRAFT/PUBLISHED/ARCHIVED`). **Không có** cột danh mục. |
| `ProductFile` | L2 (RLS, `tenantId` denormalize) | `objectKey` (unique), `fileName`, `mimeType`, `sizeBytes`, `sha256?`, `scanStatus` (`PENDING/CLEAN/REJECTED`), `isPreview`, `removedAt` (ẩn mềm — không xoá object). Không có trường cho link ngoài, thứ tự sắp xếp, hay nhãn hiển thị. |
| `DocumentCategory` | **L1** (không `tenantId`, không RLS) | `slug` unique, `name`, `shortDescription`, `description` (HTML), `imageUrl`, `seoTitle/seoDescription/ogImageUrl`, `isActive`. Comment schema ghi rõ: "Việc gán sản phẩm vào danh mục này là module sau (chưa làm ở đây)". Migration `20260920002105_document_categories`. |
| `Entitlement` | L3 | `downloadsUsed`, `downloadLimit` (snapshot lúc mua), `revokedAt`. |
| `DownloadToken` | L1 (ADR-020) | hash, TTL 60 giây, dùng một lần. |
| `ShareLink` | L2 | `tokenHash`, `passwordHash?` (argon2), `fileIds` (null/rỗng = mọi file đang bán), `maxUses`, `expiresAt`, `revokedAt`. |
| `DownloadEvent` | L2 | 1 dòng / lượt tải, `entitlementId` **hoặc** `shareLinkId`, có `ip`. |
| `SystemStorageConfig` | L1 | 1 dòng; `bucketPrivate`, `bucketPublic`, `publicBaseUrl?`; secret mã hoá bằng `STORAGE_ENCRYPTION_KEY` (ADR-017). |

### 2.2 Luồng upload ✅ (❓ chưa chạy với R2 thật)

1. `POST /api/studio/[tenantSlug]/uploads/presign` → `requireTenantMember` → `presignProductFileUpload()`:
   kiểm đuôi file theo allowlist, kiểm sản phẩm thuộc tenant (`withTenant`), `assertPlanLimit("fileSize")` và
   `assertPlanLimit("storage")`, sinh key `tenants/{tenantId}/products/{productId}/{uuid}/{tênĐãSanitize}`,
   ký URL vào **bucket private**. Chưa ghi DB ở bước này.
2. Trình duyệt `PUT` thẳng lên storage: file ≤ 50 MB một PUT; > 50 MB multipart, mỗi phần 10 MB
   (`packages/storage/src/presign.ts`). TTL URL upload = `PRESIGN_UPLOAD_TTL_SECONDS` (mặc định 600 giây).
3. `POST .../uploads/complete` → nếu multipart thì `CompleteMultipartUpload`; `HeadObject` kiểm tồn tại và
   **size khớp** số client khai báo; tạo `ProductFile` `PENDING`; cộng `Tenant.storageUsedBytes`; enqueue `file.scan`.
4. Job `file.scan` (`apps/web/lib/file-scan.ts`, worker): stream object 1 lần — sha256 + magic bytes (`file-type`).
   Khớp đuôi → `CLEAN`; lệch → xoá object, `REJECTED`, trừ dung lượng, email báo owner. **Không quét virus**:
   có `CLAMAV_HOST` cũng chỉ ghi log cảnh báo (ADR-018, BACKLOG).
- **Định dạng cho phép** ✅: `pdf, docx, doc, pptx, ppt, xlsx, xls, zip, png, jpg, jpeg, mp4`
  (`packages/storage/src/file-format.ts`). doc/ppt/xls chấp nhận lẫn nhau vì cùng chữ ký OLE/CFB.
- **Giới hạn dung lượng theo gói** — giá trị seed ✅ (`packages/db/prisma/seed.ts`); giá trị đang chạy thật ❓
  (System Admin có thể đã sửa Plan):

  | Gói (seed) | `maxFileMb` | `storageMb` | `maxProducts` |
  |---|---|---|---|
  | FREE | 50 | 500 | 5 |
  | CREATOR | 250 | 5 000 | 50 |
  | PRO | 1 000 | 20 000 | 200 |
  | BUSINESS | 2 000 | 100 000 | 1 000 |

  Hệ quả ✅: tenant gói FREE (tối đa 50 MB/file) không bao giờ đi nhánh multipart (ngưỡng > 50 MB).
- **Ảnh bìa** ✅: `cover-presign`/`cover-complete`, bucket **public**, chỉ PNG/JPG/JPEG ≤ 5 MB, không `file.scan`,
  không tính vào `storageUsedBytes`, hiển thị qua `publicBaseUrl/coverImageKey`.
- **Gỡ file** ✅: `removeProductFile()` chỉ đặt `removedAt`, không xoá object (khớp §M5 "khách cũ vẫn tải được").
  > **Đính chính 2026-09-27 (Long):** bản đầu của báo cáo ghi "không trừ `storageUsedBytes`" — **sai**. Code **có** trừ
  > `Tenant.storageUsedBytes` theo `sizeBytes` của file khi gỡ (`apps/web/lib/product.ts`, `removeProductFile`), và hành
  > vi này đã có từ trước ADR-026 (kiểm `git show HEAD:apps/web/lib/product.ts`) ✅. Object vẫn nằm trong bucket nên
  > dung lượng tính cho tenant nhỏ hơn dung lượng thật chiếm trên storage.
- **Nghiệm thu còn treo** (🟡 theo `docs/modules/M5.md`, `docs/PLAN.md`, ❓ cần R2): upload đơn/multipart thật,
  file giả mạo đuôi bị từ chối thật, 1/4 integration test M5 ("`complete` ghi `product_files` và enqueue job quét").

### 2.3 Luồng tải xuống ✅ (❓ chưa chạy với R2 thật)

- **Khách đã mua** (`/account/library`): `POST /api/downloads` → `requestDownload()` kiểm file `CLEAN`, chưa gỡ,
  entitlement chưa thu hồi, còn lượt → tạo `DownloadToken` (hash, 60 giây) → `GET /api/downloads/{token}` claim
  token atomic, tăng `downloadsUsed` atomic (`downloadLimit = 0 OR downloadsUsed < downloadLimit`), ghi
  `DownloadEvent`, presign GET có `Content-Disposition: attachment; filename*=UTF-8''...`, TTL
  `PRESIGN_DOWNLOAD_TTL_SECONDS` (zod `max(600)`, mặc định 600) **và** clamp cứng 600 giây trong
  `createPresignedDownload()`.
- **Thư viện** chỉ liệt kê file `isPreview = false`, `CLEAN`, chưa gỡ (`lib/library.ts`).
- **Share link** (`/studio/.../products/[id]/share-links`, `/s/[token]`, `POST /api/share-links/{token}/download`):
  mật khẩu argon2 tuỳ chọn, `maxUses` tăng atomic, `expiresAt`, thu hồi; chỉ cho chọn file không phải preview;
  không đụng `Entitlement.downloadLimit` (đếm riêng `usedCount`).
- **`downloadLimit`**: snapshot vào `Entitlement` lúc mua (đổi ở sản phẩm không ảnh hưởng người đã mua).

### 2.4 Danh mục tài liệu ✅

- Ai tạo: **System Admin** (`requireRole("SYSTEM_ADMIN")` trong `apps/web/app/admin/categories/actions.ts`);
  có tạo, sửa, bật/tắt `isActive`; **không có xoá**.
- Sản phẩm đã gắn danh mục chưa: **chưa** — không FK, không bảng nối; `documentCategory` chỉ được đọc ở
  `apps/web/lib/document-category.ts` và 3 trang admin. Không trang Studio/storefront nào dùng.
- Không có ADR nào trong `docs/DECISIONS.md` về danh mục tài liệu (tra theo từ khoá "categor"/"danh mục": 0 kết quả).

### 2.5 UI Studio hiện có ✅

| Trang | Có | Chưa có |
|---|---|---|
| `/studio/[t]/products/new` | Tiêu đề, đường dẫn (trống → tự sinh), loại, mô tả Tiptap; nút "Tạo sản phẩm (nháp)" → redirect sang trang Sửa | Danh mục, ảnh bìa, file, link, giá, tags (vì chưa có `productId`) |
| `/studio/[t]/products/[id]` | Cột trái: ảnh bìa, "File tài liệu" (chọn **1 file/lần**, checkbox "File xem trước"), danh sách file hiện `fileName — PENDING/CLEAN/REJECTED` dạng chữ thô, nút gỡ; link "Quản lý link chia sẻ". Cột phải: tiêu đề, mô tả, loại, tags ("Cấp học / môn học", nhập phẩy), giá, lượt tải, giá ưu đãi + khung thời gian. Header: badge trạng thái + nút xuất bản/gỡ/lưu trữ/khôi phục | Danh mục; kéo-thả/nhiều file; tiến độ % upload; tự cập nhật trạng thái quét (spec vẽ bước "Polling trạng thái file" — UI chỉ `router.refresh()` một lần sau `complete`); checklist điều kiện xuất bản trực quan (lỗi chỉ trả chuỗi lý do khi bấm) |
| `/studio/[t]/products` | Danh sách dùng `DataTable` + `Badge` trạng thái | — (ngoài phạm vi báo cáo) |

### 2.6 Backend đã có nhưng chưa có UI ✅

- **File preview**: upload và gắn cờ được, RLS nhánh public cho đọc metadata preview của sản phẩm `PUBLISHED`
  (theo `docs/modules/M5.md` 🟡 — không mở migration để kiểm lại), nhưng trang sản phẩm công khai
  (`app/[tenantSlug]/products/[productSlug]/page.tsx`) **không truy vấn file nào**, và không có route nào phát
  preview cho người chưa mua → preview hiện "vô hình" với khách.
- **Multipart** có đủ ở server và client (`upload-file-form.tsx` cắt phần tuần tự), nhưng không hiển thị tiến
  độ, không retry từng phần, không huỷ multipart dang dở (❓ hành vi với R2 thật).
- **Thống kê lượt tải theo share link**: `docs/modules/M9.md` ghi "hàm lib đã sẵn, chưa có UI riêng" (🟡).
- **`DocumentCategory`**: có dữ liệu admin, không có chỗ tenant chọn.

### 2.7 Quan sát kỹ thuật cần Quốc xem (không phải yêu cầu mới, phát hiện khi đọc code)

1. ✅ **`complete` không kiểm lại giới hạn gói.** `presign` kiểm `fileSize`/`storage` theo `sizeBytes` client
   khai báo; URL PUT đơn không ký `ContentLength`; `complete` chỉ so `HeadObject.size` với `sizeBytes` gửi lúc
   `complete` (có thể khác lúc `presign`) rồi cộng dung lượng, **không** gọi lại `assertPlanLimit`. Về lý
   thuyết có thể presign 1 MB rồi PUT file lớn hơn giới hạn gói. ❓ Mức khai thác thực tế trên R2 chưa kiểm.
2. ✅ **`complete`/`cover-complete` nhận `objectKey` từ client, không kiểm tiền tố**
   `tenants/{tenantId}/products/{productId}/`. Rủi ro thấp (`objectKey` unique; object bị REJECTED đã xoá) nhưng
   `cover-complete` có thể trỏ `coverImageKey` tới object bất kỳ trong bucket public.
3. ✅ Route upload **chưa kiểm header `Origin`** (§7.7) và **chưa rate limit** — đã có trong `docs/BACKLOG.md`,
   nhắc lại vì trang mới sẽ gọi các route này nhiều hơn.

---

## 3. Khoảng trống so với yêu cầu mới

| Yêu cầu | Hiện trạng | Cần gì | Chạm schema? |
|---|---|---|---|
| Sidebar chọn danh mục ở trang Tạo/Sửa | ✅ không có liên kết Product–Category | Quan hệ Product ↔ DocumentCategory + UI chọn + lọc `isActive` | **Có** (cột FK hoặc bảng nối) |
| Upload file ngay ở trang **Tạo** | ✅ chỉ ở trang Sửa, vì key cần `productId` | Chọn một: (a) tạo nháp ngầm khi mở trang/khi chọn file đầu tiên; (b) giữ 2 bước nhưng gộp UI (tạo xong ở lại cùng màn hình); (c) key tạm rồi "gắn" sau — (c) phức tạp nhất, đụng key/quota | (a)(b) không; (c) có |
| Upload **nhiều** file | ✅ backend nhận nhiều file/sản phẩm; UI 1 file/lần | UI chọn nhiều, hàng đợi, tiến độ, polling `scanStatus` | Không |
| Nhập **link tài liệu ngoài** | ✅ không tồn tại | Mô hình dữ liệu mới + quy tắc xuất bản mới + luồng giao hàng mới (mục 4) | **Có** |
| **Preview** tài liệu | Upload được, không hiển thị | Route/URL phát preview + UI trang công khai; nếu hiển thị inline cần ADR vì §7.6 bắt `attachment` | Có thể không (dùng `isPreview` sẵn) |
| **Ảnh bìa** | ✅ có ở trang Sửa (R2 public) | Đưa vào trang Tạo (cùng vấn đề `productId`); quyết định R2 hay Cloudinary còn treo ở Deep Plan §7.1 | Không (nếu giữ R2) |
| **Tags** | ✅ có ở trang Sửa (chuỗi phẩy) | Nếu cần chip/gợi ý: chỉ UI | Không |
| **Giá & khuyến mãi** cùng trang | ✅ có ở trang Sửa | Chỉ bố cục; coupon ở trang riêng (M6) | Không |
| **Nháp/xuất bản** | ✅ có (badge + nút); tạo mới luôn `DRAFT` | Checklist `canPublishProduct()` trực quan (5 điều kiện) | Không |

---

## 4. Các hướng xử lý tài liệu

### 4.1 So sánh

| | (A) Chỉ file upload lên R2 private | (B) Cho phép link ngoài | (C) Kết hợp: file là nguồn chính, link ngoài là loại giao hàng riêng có cảnh báo |
|---|---|---|---|
| Mô tả | Hiện trạng thiết kế (§M5, §7.6) | Owner dán URL Drive/OneDrive/Dropbox… thay cho file | Mặc định upload; tuỳ chọn thêm "giao hàng qua link" gắn nhãn rõ trên trang bán và trong thư viện |
| Bảo vệ tài liệu sau khi bán | Cao nhất trong 3: presigned ≤ 10 phút, token dùng một lần, `downloadLimit`, thu hồi entitlement | **Không**: người mua có URL gốc, chia sẻ tự do; quyền truy cập do bên thứ ba quản | Như (A) cho file; như (B) cho link, có cảnh báo |
| Đếm lượt tải / `downloadLimit` | Chính xác (atomic) | Không đếm được — chỉ đếm được lượt bấm qua route chuyển hướng của mình | File chính xác; link chỉ đếm lượt bấm |
| Thu hồi quyền | Có (`revokedAt`) | Chỉ khi owner tự đổi quyền chia sẻ bên ngoài | Như tách đôi |
| Chi phí lưu trữ/băng thông | Tốn R2 (lưu + class A/B ops); 🟡 R2 không tính phí egress (theo công bố của Cloudflare, chưa kiểm hợp đồng thật) | ~0 cho nền tảng | Như (A) + phần link ~0 |
| Rủi ro nội dung độc hại | Có magic bytes; **không** quét virus (ADR-018) | Không kiểm được gì — link có thể đổi nội dung sau khi duyệt | Như tách đôi |
| Rủi ro link hỏng | Không | Cao (owner xoá/đổi quyền) → khiếu nại, hoàn tiền | Chỉ phần link |
| Pháp lý 🟡 (không phải tư vấn pháp lý) | Nền tảng lưu nội dung → cần quy trình gỡ khi có khiếu nại bản quyền | Nền tảng bán quyền truy cập nội dung không kiểm soát; khó chứng minh "đã giao hàng" khi tranh chấp | Cần điều khoản riêng cho loại link |
| Khớp quy tắc hiện hành | ✅ khớp hoàn toàn | ✅ **Mâu thuẫn**: `canPublishProduct` bắt buộc "≥ 1 file bán `CLEAN`"; share link/thư viện chỉ phục vụ `ProductFile` | Cần đổi quy tắc xuất bản cho loại link → ADR + quyết định chủ dự án |
| Công sức | Chỉ UI | Schema + RLS + luồng giao + UI | Lớn nhất, nhưng tách được theo giai đoạn |

### 4.2 Lưu ý bảo mật nếu làm link ngoài (B/C)

- Chỉ chấp nhận `https:`; chặn `javascript:`, `data:`, `file:`; giới hạn độ dài; **allowlist host** (ví dụ
  `drive.google.com`, `docs.google.com`, `onedrive.live.com`, `1drv.ms`, `*.sharepoint.com`, `dropbox.com`) —
  danh sách cụ thể cần chủ dự án chốt.
- URL là **nội dung đã bán** → chỉ trả cho người có entitlement; không bao giờ đưa vào HTML trang công khai,
  metadata, JSON-LD hay log. Nếu lưu trong bảng L2 cần nhánh RLS customer tương tự ADR-020.
- Giao qua route chuyển hướng của hệ thống (kiểm entitlement → ghi `DownloadEvent` → 302) để còn thống kê và
  thu hồi phía mình; nhưng không ngăn được người mua lưu URL đích.
- **Không** để server tự fetch URL để "kiểm tra link sống" nếu không có biện pháp chống SSRF.
- Có nên mã hoá URL khi lưu? Không thuộc danh mục §7.2/§7.3 hiện hành → cần Quốc quyết.
- Share link (`ShareLink.fileIds`) và `downloadLimit` hiện chỉ có nghĩa với file — phải định nghĩa lại cho link.

### 4.3 Preview, file lớn, quét virus

- **Preview** — ba mức, tăng dần chi phí:
  1. Owner tự tải file preview (đã có cờ `isPreview`) + thêm route phát preview công khai cho sản phẩm
     `PUBLISHED`. Vì §7.6 bắt `attachment`, xem inline trên trang cần ADR, hoặc chỉ cho phép preview dạng ảnh
     và đặt ở bucket public như ảnh bìa (khi đó preview không còn nằm ở `ProductFile` private).
  2. Tự sinh ảnh vài trang đầu PDF phía server (worker) — Deep Plan §7.4 đã đề xuất hoãn.
  3. Watermark/PDF stamping (in email người mua lên file) — nằm trong "Ngoài phạm vi MVP giai đoạn 1" của
     `docs/BACKLOG.md` (§2.2 đặc tả) → cần chủ dự án mở phạm vi.
- **File lớn**: multipart đã có (ngưỡng 50 MB, phần 10 MB). Thiếu: tiến độ, retry từng phần, song song, huỷ
  upload dở (object/phần rác trong bucket ❓). Nếu nâng giới hạn gói trên 2 GB cần xem lại số phần/TTL
  (2 000 MB / 10 MB = 200 URL ký sẵn trong một response).
- **Quét virus**: vẫn là nợ ADR-018. Mở rộng cho giáo viên upload nhiều hơn làm rủi ro tăng tương ứng — nên đưa
  ClamAV (hoặc dịch vụ quét) vào kế hoạch trước khi mở rộng rộng rãi.

### 4.4 Thông lệ ngành — 🟡 tham khảo từ hiểu biết chung, chưa kiểm chứng nguồn

- **Gumroad**: bán file upload; có tuỳ chọn nội dung là URL chuyển hướng; có PDF stamping theo email người mua;
  giới hạn số lần tải tuỳ chọn.
- **Payhip**: file upload; có PDF stamping; giới hạn lượt tải; hỗ trợ bán mã license.
- **Sellfy**: file upload là chính; giới hạn lượt tải có thể cấu hình.
- **Shopify Digital Downloads** (app chính hãng): đính kèm file vào biến thể sản phẩm, giới hạn lượt tải;
  dung lượng tối đa mỗi file theo mức Shopify công bố tại thời điểm đọc.
- Điểm chung (🟡): file lưu trên nền tảng là mặc định; link ngoài nếu có đều là tuỳ chọn phụ, nền tảng không
  bảo đảm bảo vệ nội dung cho loại này.

---

## 5. Khuyến nghị cho Quốc

### 5.1 Phương án đề xuất

**(C) kết hợp, triển khai theo giai đoạn** — giữ (A) là mặc định và là điều kiện xuất bản chuẩn; link ngoài
chỉ làm nếu chủ dự án đồng ý rõ, qua ADR, có cảnh báo cho cả owner (khi nhập) và khách (trên trang bán).

### 5.2 Giai đoạn đề xuất

| GĐ | Nội dung | Schema/migration | Ghi chú |
|---|---|---|---|
| **GĐ1** | Trang Tạo/Sửa một màn hình (bố cục do Phong chốt): sidebar danh mục; upload nhiều file trên backend có sẵn (hàng đợi, tiến độ, polling `scanStatus`, badge màu); ảnh bìa; tags; giá & khuyến mãi; checklist xuất bản. Chọn cách giải quyết "cần `productId` trước khi upload" (khuyến nghị: tạo nháp ngầm hoặc gộp 2 bước trong cùng UI — không đụng key/quota) | **Có** — chỉ cho danh mục | Nên kèm sửa quan sát §2.7 mục 1–2 (kiểm lại giới hạn gói và tiền tố key ở `complete`) |
| **GĐ2** | Link tài liệu ngoài (nếu được duyệt): mô hình dữ liệu, validate host, route chuyển hướng + `DownloadEvent`, quy tắc xuất bản mới, hiển thị trong thư viện/share link | **Có** (bảng/cột mới + RLS) | Cần ADR mới trong `docs/DECISIONS.md` |
| **GĐ3** | Preview trên trang công khai (thủ công trước), sau đó tự sinh preview PDF, watermark/stamping; ClamAV | Có thể có | Watermark đang ngoài phạm vi MVP (BACKLOG) |

### 5.3 Ảnh hưởng schema / migration / test

- **Danh mục** — hai lựa chọn, Quốc/chủ dự án chọn (không tự quyết):
  - `Product.categoryId String?` FK → `DocumentCategory` (1 danh mục/sản phẩm): cột thêm vào bảng L2 đã có RLS,
    không cần policy mới; FK từ L2 sang L1.
  - Bảng nối `product_categories` (nhiều danh mục/sản phẩm): bảng L2 mới → cần `tenantId` + policy RLS đủ nhánh
    (tenant/public/customer/system_job theo mẫu ADR-020) + migration RLS riêng.
  - Chưa rõ: xử lý khi System Admin tắt (`isActive=false`) danh mục đang có sản phẩm; có cần xoá danh mục không.
- **Link ngoài**: hoặc mở rộng `ProductFile` (thêm loại + URL, `objectKey` hiện bắt buộc/unique → phải đổi
  nullable), hoặc bảng mới — lựa chọn thứ hai ít đụng luồng tải/scan hiện có hơn. Đổi `canPublishProduct`
  (có unit test hiện hành trong `packages/core/src/product/publish-eligibility.test.ts`).
- **Test**: `pnpm test:count` chạy ngày 2026-09-26 ✅ = **88/91 unit, 46/50 integration**. CLAUDE.md cấm thêm/bớt
  số test case so với bảng §9 nếu chưa hỏi chủ dự án → mọi test mới cho danh mục/link/preview phải được duyệt
  số lượng trước. M5 còn nợ 1 integration test ("`complete` ghi `product_files` và enqueue job quét", ❓ cần R2).

### 5.4 Quyết định cần chủ dự án

1. Có cho phép **link tài liệu ngoài** không? Nếu có: allowlist host nào; sản phẩm **chỉ có link** (không file)
   có được xuất bản không (đổi quy tắc "≥ 1 file bán `CLEAN`"); gói nào được dùng.
2. **Dung lượng tối đa**: giữ bảng `maxFileMb`/`storageMb` theo gói như seed hay đổi?
3. **Định dạng**: giữ allowlist 12 đuôi hiện tại hay thêm (ví dụ `mp3`, `rar`, `7z`, `epub`)? Mỗi đuôi thêm cần
   ánh xạ magic bytes.
4. **Danh mục**: bắt buộc hay tuỳ chọn khi tạo/xuất bản; **1 hay nhiều** danh mục/sản phẩm; tenant có được đề
   xuất/tạo danh mục riêng không (hiện chỉ System Admin).
5. **Preview**: chỉ thủ công hay tự sinh; có hiển thị inline không (cần ngoại lệ có kiểm soát cho §7.6).
6. **Watermark/PDF stamping** và **ClamAV**: có đưa vào phạm vi không, giai đoạn nào.

---

## 6. Câu hỏi mở

1. Danh mục có dùng cho **trang khám phá xuyên tenant** (liệt kê sản phẩm của nhiều tenant theo danh mục) không?
   Nếu có, đó là truy vấn public xuyên tenant — cần xem lại RLS nhánh public và ranh giới L1/L2.
2. Trang "Tạo" và "Sửa" có gộp thành một component/một route không, hay giữ 2 route với cùng bố cục?
3. Có cần hạn mức **số file/sản phẩm** hoặc **số link/sản phẩm** không?
4. Khi owner gỡ một file/link mà khách đã mua — với link ngoài, "khách cũ vẫn tải được" (§M5) có còn áp dụng
   không, hay chấp nhận link chết?
5. Ảnh bìa (và gallery nếu làm) tiếp tục qua R2 hay chuyển Cloudinary — Deep Plan §7.1 vẫn chưa có quyết định
   ghi nhận trong `docs/DECISIONS.md`.
6. Quan sát §2.7 (kiểm lại giới hạn gói và tiền tố key ở `complete`) có xử lý trong GĐ1 hay tách thành task
   bảo mật riêng?

---

## Phụ lục — Chỗ lệch giữa tài liệu và code phát hiện khi rà soát

| Tài liệu | Nội dung trong tài liệu | Code hiện tại ✅ |
|---|---|---|
| `docs/GIEOCHU_PRODUCT_MODULE_DEEP_PLAN_V1.0.md` §2.1–2.4 | Mô tả là text thuần, form `<input>/<textarea>` trần, bug `TYPE_LABEL` trên trang công khai | Mô tả dùng Tiptap + `sanitizeRichTextHtml`; form dùng kit admin (`TextField`, `SelectField`, `ConfigCard`); trang công khai dùng `PRODUCT_TYPE_LABEL` — tài liệu đã lỗi thời ở các điểm này |
| `docs/GIEOCHU_PROMPT_MVP_PHASE1.md` §M5 (sơ đồ upload) | Bước cuối "UI → API: Polling trạng thái file" | UI không polling, chỉ `router.refresh()` một lần sau `complete` |
| `obsidian-knowledge-base/02-System-Specs/File-Storage-And-Downloads-Specs.md` §2 | Sơ đồ đặt `file.scan` chạy trước `ProductFile.create()` trong cùng request | `complete` tạo `ProductFile` `PENDING` rồi **enqueue** job; `file.scan` chạy bất đồng bộ ở worker |
| `docs/bao-cao-ky-thuat-tiptap-editor-content-creator-2026-09-19.md` | Mô tả `/dashboard/articles`, WordPress/WooCommerce, `components/settings/blog/...` | Không có các đường dẫn này trong repo Gieo Chữ — báo cáo có vẻ viết cho một codebase khác; chỉ dùng tham khảo mẫu Tiptap, không dùng làm hiện trạng |

Các chỗ lệch trên chưa được ghi vào `obsidian-knowledge-base/00-Index/KB-Audit-2026-09-26.md` (ngoài phạm vi brief
này) — chờ Quốc giao.

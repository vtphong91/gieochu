---
tags:
  - adr
  - product
  - storage
  - security
  - status/accepted
date: 2026-10-27
decider: vtphong91
status: Accepted
---

# 🏛️ ADR-047: Xem trước 20% nội dung thật của file tài liệu trên trang chi tiết công khai

## 1. Trạng Thái (Status)
**ĐÃ CHỐT, ĐANG TRIỂN KHAI (working tree, chưa commit)** — tương ứng **ADR-063** trong
[`docs/DECISIONS.md`](../../docs/DECISIONS.md) (chủ dự án chốt 2026-10-27). Bản trích ghi theo duyệt của Quốc
(brief 2026-10-27). Migration `20261027120000_adr063_product_file_previews` đã có trong `packages/db/prisma/migrations/`;
phụ thuộc mới `pdf-parse@^1.1.1`.

> [!NOTE] Nguồn
> Code tham chiếu đã đọc 2026-10-27: `packages/db/prisma/schema.prisma` (`ProductFilePreview`),
> `apps/web/lib/product-file-preview.ts`, `apps/web/lib/file-scan.ts`,
> `apps/web/app/api/[tenantSlug]/[productSlug]/preview/[fileId]/route.ts`,
> `packages/core/src/content/preview-extract.ts`.

---

## 2. Bối Cảnh (Context) ✅
Trang chi tiết sản phẩm `/{tenantSlug}/{productSlug}` chỉ có mô tả + nút Mua — khách không biết chất lượng
tài liệu trước khi quyết. Chủ dự án yêu cầu bổ sung section "Tài liệu đính kèm" dưới mô tả: khách bấm vào một
file → xem được **20% nội dung THẬT** (không ẩn 80% còn lại bằng CSS — **server chỉ trả 20% đã trích**). Mục
tiêu: tăng chuyển đổi "xem → mua" mà không rò nội dung bán. Chỉ bật với sản phẩm `PUBLISHED` + tenant `ACTIVE`
+ file `sourceKind = FILE`, `scanStatus = CLEAN`, `removedAt = null`, `isPreview = false`.

---

## 3. Quyết Định (Decision) ✅

1. **Nguồn preview:** mặc định server tự trích 20% đầu từ file bán (`sourceKind = FILE`, `scanStatus = CLEAN`,
   `isPreview = false`). Nếu sản phẩm có bản `isPreview = true` (nhà bán tự upload bản ngắn ở Studio) thì ưu tiên
   bản đó và trả 100% nội dung (nhà bán đã kiểm soát). Cột `isPreview` giữ nguyên từ ADR-026 ([[ADR-026-Only-Active-Tenant-Shows-Documents]]
   — không liên quan ngữ nghĩa, chỉ dùng chung tên; `isPreview` thuộc model `ProductFile` ADR-012/ADR-013
   [[ADR-012-Product-Editor-Category-External-Links]]).
2. **"20%" theo định dạng:**
   - `.docx` → `mammoth.convertToHtml`, cắt 20% đầu đoạn `<p>`/`<h*>` (min 3, max 60), sanitize lại bằng
     `sanitizeRichTextHtml`. Bỏ ảnh nhúng (không data URI vào payload).
   - `.xlsx`/`.xls`/`.csv` → sheet đầu, 20% hàng đầu (min 10, max 200).
   - `.pdf` → thêm dependency `pdf-parse@^1.1.1`, trích text của 20% số trang đầu (min 1, max 20).
   - `.txt`/`.md`/`.json` → cắt 20% ký tự UTF-8 đầu tại ranh giới dòng.
   - Khác (image/video/zip/ppt/other): không có bản xem trước — UI hiện "Định dạng chưa hỗ trợ xem trước".
3. **Bảng cache mới `product_file_previews`** (migration `20261027120000_adr063_product_file_previews`):
   `productFileId` PK (FK `product_files.id` `ON DELETE CASCADE`), `tenantId`, `productId` (denormalized giống
   `product_files`), `kind` TEXT, `payload` JSONB, `ratio` INT DEFAULT 20, `schemaVersion` INT DEFAULT 1,
   `generatedAt` DEFAULT `now()`. 2 index `productId`, `tenantId`. **Không RLS** — chỉ server đọc qua route
   guard. Cascade delete theo file ✅.
4. **Thời điểm sinh:**
   - **Hook sinh cache:** `apps/web/lib/file-scan.ts` chạy fire-and-forget (dynamic import
     `generateAndStorePreview`) ngay sau khi file chuyển `CLEAN`. Lỗi **không** làm fail job scan.
   - **Lazy fallback:** route gọi mà chưa có cache → `generateAndStorePreview(fileId)` ngay rồi đọc lại; vẫn
     lỗi → trả `kind: "unsupported"`, `payload: {}`.
   - Sản phẩm `DRAFT`/`ARCHIVED` không sinh, không trả — chỉ `PUBLISHED` và tenant `ACTIVE` mới có preview
     công khai.
5. **API** `GET /api/{tenantSlug}/{productSlug}/preview/{fileId}` (Route Handler, `runtime = "nodejs"`,
   `dynamic = "force-dynamic"`):
   - Guard trong `getPreviewForPublicRoute`: tenant ACTIVE, product PUBLISHED, file khớp `productId`/`tenantId`,
     `sourceKind = FILE`, `scanStatus = CLEAN`, `removedAt = null`, `isPreview = false`. Mọi lỗi logic **đều ẩn
     thành 404** (không rò DRAFT/private).
   - **Rate limit 60 req/phút/IP** qua `rate_limit_counters` — **TODO** (bảng đã có từ ADR-061, helper public
     chưa viết; comment TODO trong route handler).
   - Trả JSON `{ fileName, mimeType, sizeBytes, kind, payload, ratio, totalEstimate }`. Không bao giờ trả
     presigned URL hoặc byte gốc.
6. **Liệt kê file công khai:** `page.tsx` server component gọi `listPublicPreviewFiles(productId)` — trả
   metadata (`id`, `fileName`, `mimeType`, `sizeBytes`, `kind: PreviewKind | "pending"` cộng
   `pageCount`/`totalRows`/`totalChars`/`totalParagraphs` nếu cache đã có) để render section. Không hiển thị
   `objectKey`, `externalUrl` (link ngoài không có preview GĐ1).
7. **UI** (Phong): section "📎 Tài liệu đính kèm" dưới `description`, trên `reviews` của `ProductDetailView`.
   Mỗi file có nút "Xem trước" mở modal client; modal fetch endpoint, render payload theo `kind`. Dải sticky
   dưới modal: "Bạn đang xem bản xem trước (20%). Mua tài liệu để xem đầy đủ." + nút Mua (dùng `BuyButton`).
   **Không ẩn 80% còn lại bằng CSS — server đơn giản không gửi.**
8. **Bảo mật:** payload 20% cố định, không có cursor để ghép nối; XSS: `sanitizeRichTextHtml` lớp cuối cùng
   trước khi lưu HTML docx; scrape: rate limit (TODO); `AppError` cho mọi lỗi nghiệp vụ; **không ghi
   `audit_logs`** cho lượt xem preview (tránh phình), chỉ `logger.info` khi cần phân tích.
9. **Hiệu năng:** payload JSONB **≤ 256 KB** sau serialize (giới hạn trong extractor); `pdf-parse` chạy Node
   runtime (không Edge). Route handler cố ý khai `export const runtime = "nodejs"`.

---

## 4. Shape payload theo `kind` ✅

| `kind` | `payload` |
| :-- | :-- |
| `docx` | `{ html, paragraphsShown, totalParagraphs }` |
| `xlsx` | `{ sheetName, rows, rowsShown, totalRows }` |
| `pdf` | `{ text, charsShown, totalChars, pageCount }` |
| `text` | `{ text, charsShown, totalChars }` |
| `unsupported` | `{}` |

`totalEstimate` ở response là tập con `{ pageCount?, totalRows?, totalParagraphs?, totalChars? }` suy từ
`payload` (chỉ nhận giá trị number). `ratio` cố định 20.

---

## 5. Hệ Quả (Consequences)
- Thêm bảng L2 denormalized **không RLS** — một mẫu mới trong hệ thống: dữ liệu nhạy cảm hơn preview không
  được bọc; chỉ an toàn vì route guard siết đủ (ACTIVE + PUBLISHED + file CLEAN). Tham chiếu khi thêm cache
  tương tự: **phải** cùng mẫu guard, hoặc bật RLS.
- Dependency mới `pdf-parse@^1.1.1` kéo vào Node runtime — không ảnh hưởng Edge/proxy (`proxy.ts` không đọc).
- Hook `file.scan` → preview chạy fire-and-forget: file không có preview tức thì sau upload là **chấp nhận
  được** (lazy fallback bù lại ở request đầu).
- Rate limit **chưa triển khai** — vẫn còn khả năng crawler lấy nhanh preview; ưu tiên vừa phải trước beta.
- Trần test nâng **95/57 → 102/68** (xem [[00-Index/KB-Audit-2026-09-26|KB-Audit]] khi test chạy xong).

---

## 6. Rủi Ro & Giảm Thiểu
| Rủi ro | Giảm thiểu |
| :-- | :-- |
| Crawler quét toàn bộ preview để gom nội dung | Rate limit 60/phút/IP (TODO) + cache nên không đập storage; `ratio = 20` cứng ở extractor |
| XSS từ HTML docx | `sanitizeRichTextHtml` lớp cuối trước khi lưu `payload.html` |
| Payload JSONB phình | Giới hạn 256 KB ở extractor; min/max rõ cho từng kind |
| Lộ sản phẩm DRAFT/private | Mọi lỗi guard → 404 (không mã lỗi riêng), không log actor |
| `pdf-parse` crash file hỏng | Try/catch trong `extractPreviewPayload`, rơi về `unsupported` + log warn, không ném |
| Lộ `isPreview = true` (bản ngắn nhà bán) qua endpoint này | Route lọc `isPreview = false` — bản ngắn vẫn thuộc luồng tải entitlement/share-link như cũ |

---

## 7. Test ✅ (theo brief)
- Unit `100 → 102` (từ ADR-061 KB [[ADR-046-Customer-Purchase-Flow-Pending-Orders-Notifications]]): + extract
  docx 20% paragraphs, + extract xlsx 20% rows.
- Integration `66 → 68`: + route 200 cho PUBLISHED + 404 cho DRAFT/private, + rate limit 429 sau 60 req.
- `scripts/count-tests.mjs` cập nhật trần.

---

## 8. Phạm vi GĐ1 & Backlog
GĐ1 chỉ 5 định dạng ở mục 3.2. **Backlog:** watermark PDF, video trailer, nhà bán cắt vùng tuỳ ý, rate limit
helper public, i18n UI modal, link ngoài có preview.

---

## 9. Không ảnh hưởng
Studio UI (`isPreview` checkbox giữ nguyên nghĩa), download token/entitlement, share link, luồng mua
(ADR-061).

---

## 10. Liên Kết
* [[01-Architecture-Decisions/ADR-012-Product-Editor-Category-External-Links|ADR-012 KB (≙ ADR-026)]] — nguồn
  cột `isPreview` + `product_files`
* [[01-Architecture-Decisions/ADR-035-Menu-Home-Seo-Versioned-Terms|ADR-035 KB (≙ ADR-050)]] — trần test gốc 95/57
* [[01-Architecture-Decisions/ADR-046-Customer-Purchase-Flow-Pending-Orders-Notifications|ADR-046 KB (≙ ADR-061)]] —
  bảng `rate_limit_counters` dùng chung
* [[02-System-Specs/File-Storage-And-Downloads-Specs|File-Storage-And-Downloads-Specs]] §11 — Preview cache
* [[03-API-Contracts/Endpoint-Directory|Endpoint-Directory]] §30 — endpoint preview
* [[03-API-Contracts/Database-Schema-Reference|Database-Schema-Reference]] §3.1 — bảng
  `product_file_previews`
* [[00-Index/KB-Audit-2026-09-26|KB-Audit]] §44

*Quay lại: [[MOC-Home]] (../00-Index/MOC-Home.md)*

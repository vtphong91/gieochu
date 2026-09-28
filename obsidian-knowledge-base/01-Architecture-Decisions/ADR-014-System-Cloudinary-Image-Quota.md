---
tags:
  - adr
  - storage
  - security
  - billing
  - status/accepted
date: 2026-09-27
decider: vtphong91
status: Accepted (Chốt — Áp dụng chính thức)
---

# 🏛️ ADR-014: Ảnh Nội Dung Trên Cloudinary Hệ Thống — Tối Ưu Tự Động, Hạn Mức Theo Gói, Siết Chữ Ký Upload

## 1. Trạng Thái (Status)
**ĐÃ PHÊ DUYỆT (Accepted)** — tương ứng **ADR-028** trong [`docs/DECISIONS.md`](../../docs/DECISIONS.md), gồm cả mục
"Bổ sung ADR-028 theo triển khai" (Quốc duyệt 2026-09-27). Liên quan
[[01-Architecture-Decisions/ADR-013-Product-Summary-Cover-Preview-Visibility|ADR-013 (≙ ADR-027)]] (ảnh bìa Cloudinary) và
[[01-Architecture-Decisions/ADR-009-Storefront-Cms-Contact-Inbox|ADR-009 (≙ ADR-023)]] (ảnh storefront).

---

## 2. Bối Cảnh (Context)
Editor Tiptap chỉ chèn ảnh bằng URL. Chủ dự án cân nhắc Cloudinary hệ thống hay bắt tenant tự mang tài khoản (BYO).
Báo cáo [`docs/bao-cao-luu-tru-anh-cloudinary-2026-09-27.md`](../../docs/bao-cao-luu-tru-anh-cloudinary-2026-09-27.md)
chỉ ra: upload đi thẳng trình duyệt → Cloudinary và ảnh phục vụ từ CDN nên BYO không giảm tải server, chỉ chuyển chi
phí; chưa có tối ưu ảnh; ảnh chưa có hạn mức theo gói; chữ ký dùng chung chỉ `requireUser()`.

---

## 3. Quyết Định (Decision)
1. **GĐ1 dùng Cloudinary hệ thống cho mọi tenant**; BYO để GĐ2, chỉ mở khi số liệu dùng thật vượt ngưỡng.
2. **Siết chữ ký dùng chung:** `getCloudinaryUploadSignatureAction` chỉ `SYSTEM_ADMIN`, ký `allowed_formats`
   png/jpg/jpeg/webp/svg. Tenant luôn dùng action ký riêng theo folder `tenants/<id>/...`.
3. **Upload ảnh trong editor:** bỏ ô "URL ảnh"; nút ảnh mở chọn file → upload qua chữ ký tenant, folder
   `tenants/<id>/content`, png/jpg/jpeg/webp (không GIF ở GĐ1). Editor ở admin (danh mục) ký bằng chữ ký admin.
4. **Tối ưu ảnh:** hiển thị qua transformation cố định `f_auto,q_auto,c_limit,w_<N>` (N theo ngữ cảnh, ≤1600); upload
   có incoming transformation giới hạn cạnh dài ≤2000px. Áp cho ảnh mô tả, ảnh bìa, ảnh storefront.
5. **Sanitizer:** `img src` trong HTML mô tả chỉ nhận `https://res.cloudinary.com/<cloud hệ thống>/...`; ảnh ngoài bị
   loại khi lưu và khi render (khớp CSP `img-src`).
6. **Hạn mức ảnh theo gói** (cộng chung ảnh mô tả + ảnh bìa + ảnh storefront): FREE 100MB, CREATOR 1GB, PRO 2GB,
   BUSINESS 5GB — cột trên `Plan`, sửa được ở System Admin. Ghi nhận asset ở bảng L2 có RLS; dung lượng lấy từ phía
   server. Vượt hạn mức → từ chối cấp chữ ký kèm thông báo nâng gói.
7. **Bổ sung theo triển khai (Quốc duyệt):** (a) chữ ký tenant ký **`public_id` đầy đủ** do server sinh
   (`<root>/tenants/<id>/<content|products|storefront>/<24 hex>`) thay vì `folder` — một chữ ký chỉ tạo/ghi đè đúng 1
   asset; (b) **giữ chỗ hạn mức ngay khi cấp chữ ký** (dòng tạm tính 5MB, `verifiedAt = null`), bước register đọc
   Cloudinary Admin API ghi bytes thật, mỗi lần xin chữ ký đối soát lười tối đa 3 dòng giữ chỗ quá 1 giờ; (c) Admin API
   lỗi khi register → vẫn trả URL dựng từ `public_id` với `verified:false`, giữ mức tạm 5MB; 404 → xoá giữ chỗ, trả
   `IMAGE_NOT_FOUND`.
8. **Test:** dùng phần trống trong trần 94/53, không nâng trần.
9. **Nợ:** job dọn asset mồ côi; quy trình gỡ ảnh vi phạm; BYO (GĐ2, secret mã hoá AES-256-GCM với khoá riêng).

---

## 4. Hệ Quả & Ràng Buộc Kỹ Thuật (Consequences & Rules)
* **Hiện trạng code (đối chiếu 2026-09-27) ✅:**
  - Migration `20260927110000_adr028_image_quota_media_assets` (enum `TenantMediaUsage`, cột
    `plans.imageStorageMb` default 100 + UPDATE CREATOR 1024 / PRO 2048 / BUSINESS 5120, bảng `tenant_media_assets`)
    và `20260927110100_rls_adr028_media_assets` (ENABLE + FORCE RLS, policy `tenant_isolation` = đúng
    `app.tenant_id` **hoặc** `app.scope = 'system_job'`; không có nhánh public/customer).
  - Logic hạn mức + sổ asset: `apps/web/lib/tenant-media.ts` (`createTenantImageUploadSignature`,
    `registerTenantImage`, `getTenantImageQuota`); ký + Admin API: `apps/web/lib/system-cloudinary.ts`
    (`createCloudinaryUploadSignature`, `fetchCloudinaryImageResource`, `getSystemCloudinaryLocation`).
  - Hàm dựng URL: `cloudinaryDeliveryUrl` (`packages/core/src/content/cloudinary-url.ts`, subpath
    `@gieochu/core/cloudinary-url` cho client component).
  - Sanitizer: `sanitizeRichTextHtml(html, { imageCloudName, imageWidth? })`; `isCloudinaryImageUrl(value, cloudName?)`.
* **Điểm cần biết:** hạn mức được so ở lúc **cấp chữ ký** (`usedBytes >= limitBytes` → từ chối) — một chữ ký cuối
  có thể đẩy tổng vượt hạn mức tối đa bằng một ảnh ✅ (đọc code). Upload preset chưa chặn cứng dung lượng file ở
  Cloudinary — giới hạn 5MB hiện chỉ ở client, server bù bằng incoming transformation ≤2000px + đọc bytes thật
  (BACKLOG).
* **Chưa verify ❓:** upload thật lên Cloudinary, Admin API thật (404/timeout), hiển thị ảnh qua CSP trên trình duyệt.
* Đặc tả: [[02-System-Specs/File-Storage-And-Downloads-Specs|File-Storage-And-Downloads-Specs]] §7; contract:
  [[03-API-Contracts/Endpoint-Directory|Endpoint-Directory]] §11; UI:
  [[04-Operations-Runbooks/UI-Design-System|UI-Design-System]] (TiptapEditor, ImageUploadField).

---

## 5. Tài Liệu Tham Chiếu & Liên Kết
* [[MOC-Home]] — Trang chủ Map of Content ([MOC-Home.md](../00-Index/MOC-Home.md))
* Tương ứng **ADR-028** trong [`docs/DECISIONS.md`](../../docs/DECISIONS.md) (gốc repo).
* [[01-Architecture-Decisions/ADR-013-Product-Summary-Cover-Preview-Visibility|ADR-013 (≙ ADR-027)]] ([ADR-013-Product-Summary-Cover-Preview-Visibility.md](./ADR-013-Product-Summary-Cover-Preview-Visibility.md))
* [[01-Architecture-Decisions/ADR-003-Postgres-App-Role-RLS|ADR-003 (≙ ADR-010)]] ([ADR-003-Postgres-App-Role-RLS.md](./ADR-003-Postgres-App-Role-RLS.md)) — RLS chỉ có hiệu lực với role `gieochu_app`.
* [[02-System-Specs/File-Storage-And-Downloads-Specs|File-Storage-And-Downloads-Specs]] ([File-Storage-And-Downloads-Specs.md](../02-System-Specs/File-Storage-And-Downloads-Specs.md))
* [[03-API-Contracts/Database-Schema-Reference|Database-Schema-Reference]] ([Database-Schema-Reference.md](../03-API-Contracts/Database-Schema-Reference.md))

*Quay lại: [[MOC-Home]] (../00-Index/MOC-Home.md)*

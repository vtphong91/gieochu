---
tags:
  - adr
  - product
  - ui-ux
  - status/accepted
date: 2026-09-27
decider: vtphong91
status: Accepted (Chốt — Áp dụng chính thức)
---

# 🏛️ ADR-013: Trang Tạo Sản Phẩm — Mô Tả Ngắn, Ảnh Bìa Cloudinary, Xem Trước, Chế Độ Hiển Thị = Trạng Thái

## 1. Trạng Thái (Status)
**ĐÃ PHÊ DUYỆT (Accepted)** — tương ứng **ADR-027** trong [`docs/DECISIONS.md`](../../docs/DECISIONS.md). Bổ sung cho
[[01-Architecture-Decisions/ADR-012-Product-Editor-Category-External-Links|ADR-012 (≙ ADR-026)]].

---

## 2. Bối Cảnh (Context)
Chủ dự án duyệt editor GĐ1 (ADR-026) và yêu cầu trang **Tạo** có đủ: giá gốc + giá khuyến mãi, mô tả ngắn, ảnh đại
diện, Lưu nháp, Xem trước, chế độ hiển thị Công khai/Riêng tư. Ảnh bìa đang lưu R2 public (`coverImageKey`) nên
(1) không upload được trước khi có `productId`, (2) bị CSP `img-src` chặn hiển thị.

---

## 3. Quyết Định (Decision)
1. **Chế độ hiển thị không phải khái niệm mới:** "Công khai" = `PUBLISHED`, "Riêng tư" = `DRAFT`. Chọn Công khai khi
   lưu = lưu rồi xuất bản (vẫn qua `canPublishProduct`); Riêng tư = lưu nháp / gỡ xuất bản. Không thêm cột, không đổi RLS.
2. **Mô tả ngắn:** `Product.summary String?` — văn bản thuần ≤300 ký tự, hiện trên thẻ storefront và đầu trang chi
   tiết; không bắt buộc khi xuất bản.
3. **Ảnh bìa sang Cloudinary:** `Product.coverImageUrl String?` (chỉ `https://res.cloudinary.com/...`, cùng luật
   ADR-023), chữ ký Cloudinary theo tenant (folder `<uploadFolder>/tenants/<id>/products`), dùng được ngay ở trang
   Tạo. Hiển thị ưu tiên `coverImageUrl`, fallback `coverImageKey` (R2). Điều kiện "có ảnh bìa" chấp nhận một trong
   hai. Luồng R2 `cover-presign/cover-complete` giữ tới khi dọn (BACKLOG).
4. **Trang Tạo** nhận đủ field (tiêu đề, đường dẫn, mô tả ngắn, mô tả, danh mục, loại, giá gốc, giá KM + thời gian,
   thẻ, ảnh bìa, chế độ hiển thị). Chọn Công khai mà chưa đủ điều kiện → vẫn lưu nháp và hiện checklist.
   **Đã sửa đổi (2026-09-27, chủ dự án — "Sửa đổi ADR-027 §4"):** trang Tạo **không khoá** khu Tệp tài liệu; thêm
   file/link đầu tiên → UI tự gọi `createProductAction` (PRIVATE) tạo bản nháp ngầm rồi tiếp tục upload trên cùng
   giao diện (giữ URL `/new`, giữ `draftId` trong state, không remount); tiêu đề là field bắt buộc duy nhất để tạo
   nháp; không thêm bảng staging upload. Chi tiết:
   [[02-System-Specs/Product-Editor-And-Publishing-Specs|Product-Editor-And-Publishing-Specs]] §6.1.
5. **Xem trước:** `/studio/[tenantSlug]/products/[productId]/preview`, guard `requireTenantMemberPage`, đọc qua
   `withTenant` (xem được nháp), render giống trang chi tiết công khai + dải "Bản xem trước — khách chưa thấy trang
   này", nút Mua vô hiệu, `noindex`. Nút "Xem trước" ở card xuất bản (trang Tạo: lưu nháp trước rồi mở) — thanh
   hành động dính đáy ban đầu đã bỏ sau ADR-027 (xem UI-Design-System §9; `docs/DECISIONS.md` "Cập nhật đính chính
   ADR-026/027 (a)/(c)": khung `max-w-[1440px]`, lưới `minmax(0,1fr) 360px`, card xuất bản dính, `.studio-save-bar`). **Phần "card xuất bản dính"
   bị thay bởi ADR-030** (2026-09-28): card không còn dính khi cuộn — xem
   [[01-Architecture-Decisions/ADR-016-Short-Product-Url-No-Sticky-Publish-Card|ADR-016 (≙ ADR-030)]].
6. **Test:** không nâng trần (94/53); dùng phần còn trống nếu cần, báo số thật.

---

## 4. Hệ Quả & Ràng Buộc Kỹ Thuật (Consequences & Rules)
* **Hiện trạng code (đối chiếu 2026-09-27) ✅:** migration `20260927090000_adr027_product_summary_cover_url` (2 cột
  nullable, không đổi RLS); `normalizeProductSummary` (`packages/core/src/product/summary.ts`, đếm theo code point, từ
  chối chứ không cắt); `getProductCoverUploadSignatureAction` (định dạng `jpg, jpeg, png, webp`);
  `resolveProductCoverUrl`/`getProductCoverUrl` (`apps/web/lib/product-cover.ts`); `getProductPreviewData` không trả
  `externalUrl`/object key; trang preview có `robots: noindex, nofollow, nocache`. Riêng tư trên sản phẩm đang Công
  khai = lưu + chuyển `DRAFT` trong **cùng một lệnh update**.
* **Lệch nhỏ với câu chữ ADR:** mục 5 ghi "chỉ chủ tenant/staff", code dùng `requireTenantMember` mặc định
  `canManageTenant` = **chỉ `OWNER`** ✅ — STAFF chưa tồn tại ở MVP nên chưa ảnh hưởng (xem
  [[00-Index/KB-Audit-2026-09-26|KB-Audit]] §6).
* **Test:** tại thời điểm ADR-027 thực 91/50 trên trần 94/53; hiện (sau ADR-028) thực **93/52** ✅ (`pnpm test:count`
  2026-09-27) — có 1 integration case riêng cho ADR-027.
* **Chưa verify ❓:** upload Cloudinary thật, hiển thị trang cần đăng nhập bằng trình duyệt.
* Đặc tả: [[02-System-Specs/Product-Editor-And-Publishing-Specs|Product-Editor-And-Publishing-Specs]] §6–§8; UI:
  [[04-Operations-Runbooks/UI-Design-System|UI-Design-System]] §9.

---

## 5. Tài Liệu Tham Chiếu & Liên Kết
* [[MOC-Home]] — Trang chủ Map of Content ([MOC-Home.md](../00-Index/MOC-Home.md))
* Tương ứng **ADR-027** trong [`docs/DECISIONS.md`](../../docs/DECISIONS.md) (gốc repo).
* [[01-Architecture-Decisions/ADR-012-Product-Editor-Category-External-Links|ADR-012 (≙ ADR-026)]] ([ADR-012-Product-Editor-Category-External-Links.md](./ADR-012-Product-Editor-Category-External-Links.md))
* [[01-Architecture-Decisions/ADR-009-Storefront-Cms-Contact-Inbox|ADR-009 (≙ ADR-023)]] ([ADR-009-Storefront-Cms-Contact-Inbox.md](./ADR-009-Storefront-Cms-Contact-Inbox.md)) — luật URL Cloudinary dùng chung.
* [[02-System-Specs/Product-Editor-And-Publishing-Specs|Product-Editor-And-Publishing-Specs]] ([Product-Editor-And-Publishing-Specs.md](../02-System-Specs/Product-Editor-And-Publishing-Specs.md))
* [[04-Operations-Runbooks/UI-Design-System|UI-Design-System]] ([UI-Design-System.md](../04-Operations-Runbooks/UI-Design-System.md))

*Quay lại: [[MOC-Home]] (../00-Index/MOC-Home.md)*

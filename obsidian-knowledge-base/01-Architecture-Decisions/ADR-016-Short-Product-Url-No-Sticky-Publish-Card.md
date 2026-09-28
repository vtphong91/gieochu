---
tags:
  - adr
  - product
  - tenant
  - seo
  - ui-ux
  - status/accepted
date: 2026-09-28
decider: vtphong91
status: Accepted (Chốt — Áp dụng chính thức)
---

# 🏛️ ADR-016: URL Tài Liệu Rút Gọn `/{tenantSlug}/{productSlug}`; Bỏ Card Xuất Bản Dính

## 1. Trạng Thái (Status)
**ĐÃ PHÊ DUYỆT (Accepted)** — tương ứng **ADR-030** trong [`docs/DECISIONS.md`](../../docs/DECISIONS.md), gồm mục
**"Bổ sung ADR-030 theo triển khai"** (2026-09-28). **Đã xong code** (chưa có test tự động). Thay phần "card xuất bản
dính" của [[01-Architecture-Decisions/ADR-013-Product-Summary-Cover-Preview-Visibility|ADR-013 (≙ ADR-027)]]; liên quan
[[01-Architecture-Decisions/ADR-011-Tenant-Owns-Storefront-Content-Only|ADR-011 (≙ ADR-025)]] (trang tài liệu là trang hệ
thống).

---

## 2. Bối Cảnh (Context)
Chủ dự án (2026-09-28): URL trang tài liệu `/{tenantSlug}/products/{productSlug}` dài, không tối ưu hiển thị/SEO. Card xuất
bản dính khi cuộn ở editor sản phẩm/bài viết cao hơn màn hình, che các chức năng bên dưới.

---

## 3. Quyết Định (Decision)
1. **URL chuẩn (canonical):** `/{tenantSlug}/{productSlug}`, route `app/[tenantSlug]/[productSlug]/page.tsx` (segment tĩnh
   cùng cấp như `posts`, `checkout` được Next ưu tiên trước segment động). URL cũ `/{tenantSlug}/products/{productSlug}` trả
   **301** sang URL mới (giữ query). Mọi link nội bộ, email, `canonical`, sitemap (khi có) dựng bằng **một hàm duy nhất**
   `productPath(tenantSlug, productSlug)`.
2. **Slug dành riêng:** slug tài liệu không được trùng segment tĩnh con của `/[tenantSlug]` hiện có và dự phòng — danh sách
   23 mục nằm ở `packages/core`. Kiểm ở bước tạo sản phẩm.
3. **Editor Studio:** card xuất bản **không** dính khi cuộn ở mọi kích thước (bỏ `xl:sticky`); vẫn đứng đầu sidebar từ xl.
   Thanh lưu nhanh dưới xl giữ nguyên. Áp cho editor sản phẩm **và** editor bài viết.
4. **Bổ sung theo triển khai (2026-09-28):**
   - Redirect bằng **Route Handler** `app/[tenantSlug]/products/[productSlug]/route.ts` trả **301** (`Location` tương đối,
     giữ query) — **không** dùng `permanentRedirect()`/`redirects()` vì Next trả **308**, và pattern trong `next.config`
     khớp cả `/api/...`.
   - `/{tenantSlug}/products` → **404**.
   - `productPath`/`productUrl`/`RESERVED_PRODUCT_SLUGS` ở `packages/core/src/product/path.ts` (subpath client
     `@gieochu/core/product-path`); canonical là **URL tuyệt đối**.
   - Slug **tự nhập** trùng từ dành riêng → `INVALID_SLUG`; slug **tự sinh** trùng → thêm hậu tố.
   - Action sản phẩm revalidate cả trang tài liệu và storefront.
   - **Trước khi deploy prod phải quét slug trùng từ dành riêng.**

---

## 4. Hệ Quả & Ràng Buộc Kỹ Thuật (Consequences & Rules)
* **Hiện trạng code (Long đọc 2026-09-28) ✅:**
  - `packages/core/src/product/path.ts`: `RESERVED_PRODUCT_SLUGS` đúng 23 mục như ADR, `isReservedProductSlug` (không phân
    biệt hoa thường), `productPath` (encode từng segment), `productUrl`. Export ở `@gieochu/core` và subpath
    `./product-path` (`packages/core/package.json`).
  - `route.ts` redirect: slug dành riêng → 404; còn lại 301 + `search` gốc. Chỉ có `GET`.
  - Trang tài liệu: slug dành riêng → `notFound()`; `alternates.canonical = productUrl(APP_URL, …)`.
  - `createProduct` (`apps/web/lib/product.ts`): `INVALID_SLUG` cho slug tự nhập; `suggestSlug` coi 23 từ dành riêng như
    slug đã bị chiếm.
  - `revalidateProduct` (`studio/[tenantSlug]/products/actions.ts`): `revalidatePath("/[tenantSlug]/[productSlug]", "page")`
    + `/<tenantSlug>`.
  - Editor sản phẩm (`product-editor.tsx`) và bài viết (`post-editor.tsx`): wrapper card xuất bản chỉ còn `xl:order-first`,
    không `sticky`; `.studio-save-bar` (`sticky bottom-0`, `xl:hidden`) giữ nguyên; không còn `revealFromPublishCard`.
* **Ràng buộc cho code sau:** không tự ghép chuỗi URL tài liệu — luôn `productPath`/`productUrl`. Thêm route tĩnh mới dưới
  `app/[tenantSlug]/` ⇒ thêm tên vào `RESERVED_PRODUCT_SLUGS` + quét slug trùng trên DB prod (`CLAUDE.md` mục "Quy ước
  code" ✅).
* **Hệ quả vận hành:** mọi URL 2 segment không khớp route tĩnh đi vào trang tài liệu → tốn 1 query tìm tenant trước khi 404.
  Sản phẩm tạo **trước** ADR-030 có slug trùng từ dành riêng sẽ không mở được ở URL mới (slug không đổi được sau khi tạo).
* **Chưa verify ❓:** quét slug trùng trên DB prod; 301 thật qua trình duyệt/`curl`; chưa có test tự động cho redirect và chặn
  slug dành riêng (nợ, `docs/BACKLOG.md`). Sitemap/robots chưa tồn tại — khi làm SEO phải dùng URL mới.
* **Số test:** không đổi — `pnpm test:count` 2026-09-28 = 93/94 unit, 52/53 integration ✅.
* Đặc tả: [[02-System-Specs/Product-Editor-And-Publishing-Specs|Product-Editor-And-Publishing-Specs]] §7A; UI:
  [[04-Operations-Runbooks/UI-Design-System|UI-Design-System]] §8.4, §9.1, §11.3; contract:
  [[03-API-Contracts/Endpoint-Directory|Endpoint-Directory]] §10, §12.

---

## 5. Tài Liệu Tham Chiếu & Liên Kết
* [[MOC-Home]] — Trang chủ Map of Content ([MOC-Home.md](../00-Index/MOC-Home.md))
* Tương ứng **ADR-030** trong [`docs/DECISIONS.md`](../../docs/DECISIONS.md) (gốc repo).
* [[01-Architecture-Decisions/ADR-013-Product-Summary-Cover-Preview-Visibility|ADR-013 (≙ ADR-027)]] ([ADR-013-Product-Summary-Cover-Preview-Visibility.md](./ADR-013-Product-Summary-Cover-Preview-Visibility.md)) — phần "card xuất bản dính" bị thay.
* [[01-Architecture-Decisions/ADR-011-Tenant-Owns-Storefront-Content-Only|ADR-011 (≙ ADR-025)]] ([ADR-011-Tenant-Owns-Storefront-Content-Only.md](./ADR-011-Tenant-Owns-Storefront-Content-Only.md))
* [[02-System-Specs/Product-Editor-And-Publishing-Specs|Product-Editor-And-Publishing-Specs]] ([Product-Editor-And-Publishing-Specs.md](../02-System-Specs/Product-Editor-And-Publishing-Specs.md))
* [[04-Operations-Runbooks/UI-Design-System|UI-Design-System]] ([UI-Design-System.md](../04-Operations-Runbooks/UI-Design-System.md))

*Quay lại: [[MOC-Home]] (../00-Index/MOC-Home.md)*

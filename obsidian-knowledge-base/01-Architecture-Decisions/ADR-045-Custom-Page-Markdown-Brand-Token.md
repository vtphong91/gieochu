---
tags:
  - adr
  - cms
  - security
  - status/accepted
date: 2026-10-26
decider: vtphong91
status: Accepted (Chốt — Áp dụng chính thức)
---

# 🏛️ ADR-045: Trang tuỳ chỉnh (`/p/[slug]`) hiển thị Markdown + thay biến `{brand}`

## 1. Trạng Thái (Status)
**ĐÃ PHÊ DUYỆT (Accepted)** — tương ứng **ADR-060** trong [`docs/DECISIONS.md`](../../docs/DECISIONS.md) (chủ dự án chốt 2026-10-26, phương án (a)). Bản trích
ghi theo duyệt của Quốc (brief 2026-10-26).

Tiến độ (cập nhật 2026-10-27): code **đã commit `fa29d99`** ✅ `git log` (Quốc xác nhận) (`apps/web/lib/cms-markdown.ts` mới; sửa `app/p/[slug]/page.tsx`,
`packages/core/src/content/sanitize-html.ts`). Không đổi schema, không migration, không thêm `route.ts`. `pnpm test:count` = **100/100 unit, 66/66
integration** ✅ (Long chạy, chỉ đếm).

Mức xác minh: ✅ Long đã đối chiếu code working tree · 🟡 theo `docs/DECISIONS.md`/brief · ❓ cần thử trình duyệt.

---

## 2. Bối Cảnh (Context) 🟡
3 dự thảo hướng dẫn khách hàng (`docs/du-thao-huong-dan/`) cần tiêu đề, danh sách, bảng, liên kết. Khối `richText` của trang tuỳ chỉnh khi đó chỉ in chữ thuần
(`white-space: pre-line`) và không thay tên thương hiệu. Chủ dự án chọn nâng cấp hiển thị thay vì nhập chữ thuần.

---

## 3. Quyết Định (Decision) ✅ code
1. Khối `richText` hiển thị như **Markdown GFM**: tiêu đề, đậm/nghiêng, danh sách, bảng, liên kết, trích dẫn. Render ở server (`renderCmsRichText`).
2. **Không** nhận HTML thô (escape thành chữ), **không** nhận ảnh; kết quả qua `sanitizeRichTextHtml` (whitelist Tiptap + `trustedLinks`), thêm tuỳ chọn
   `allowTables` chỉ cho trang tuỳ chỉnh (bảng không thuộc tính).
3. Thay **`{brand}`** sau khi sanitize, giá trị escape, tên từ `getEffectiveBrand()`.
4. **Xuống dòng:** nội dung có tiêu đề hoặc bảng → xuống dòng đơn được nối thành một đoạn; không có → mỗi xuống dòng thành `<br>` (nội dung chữ thuần cũ hiển thị
   như trước).
5. Dự thảo dùng `{brand}` (đổi từ `{Tên nền tảng}`).

Chi tiết: [[02-System-Specs/System-Cms-Menu-Home-Seo-Specs|System-Cms-Menu-Home-Seo-Specs]] §4A.

---

## 4. Lý Do (Rationale) 🟡
- Hướng dẫn khách hàng cần cấu trúc (bước, bảng lỗi) mới đọc được; chữ thuần không đủ.
- Dùng lại bộ làm sạch của trang pháp lý → không mở đường XSS mới; không cho HTML thô/ảnh để giữ bề mặt nhỏ.
- Quy tắc xuống dòng giữ nguyên hiển thị của trang cũ đang có nội dung chữ thuần.

---

## 5. Hệ Quả (Consequences)
- Tác giả trang tuỳ chỉnh soạn bằng Markdown; muốn có ảnh thì chưa làm được (dùng chỗ trống `[Ảnh: …]` trong dự thảo).
- Nội dung cũ có dòng bắt đầu bằng `#` hoặc dạng `| … |` sẽ bị coi là Markdown (đổi cách nối dòng) ✅ code — kiểm nội dung thật trên DB ❓ (Long không đọc DB).
- Code cần commit + deploy ❓.

---

## 6. Liên Kết
* [[02-System-Specs/System-Cms-Menu-Home-Seo-Specs|System-Cms-Menu-Home-Seo-Specs]] §4A ([System-Cms-Menu-Home-Seo-Specs.md](../02-System-Specs/System-Cms-Menu-Home-Seo-Specs.md))
* [[01-Architecture-Decisions/ADR-040-Legal-Pages-Phase-2-Root-Urls-Consent|ADR-040 KB (≙ ADR-054)]] — `trustedLinks` · [[01-Architecture-Decisions/ADR-042-Legal-Drafts-Import-Preview-Draft-Release|ADR-042 KB (≙ ADR-057)]] — khuôn dự thảo Markdown
* [[00-Index/KB-Audit-2026-09-26|KB-Audit]] §42

*Quay lại: [[MOC-Home]] (../00-Index/MOC-Home.md)*

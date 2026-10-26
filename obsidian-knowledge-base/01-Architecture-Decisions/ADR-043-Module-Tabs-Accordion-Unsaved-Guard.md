---
tags:
  - adr
  - ui-ux
  - design-system
  - admin
  - status/accepted
date: 2026-10-25
decider: vtphong91
status: Accepted (Chốt — Áp dụng chính thức)
---

# 🏛️ ADR-043: Điều hướng tab theo chức năng + accordion cho trang cấu hình (System Center, Studio); cảnh báo rời trang khi chưa lưu

## 1. Trạng Thái (Status)
**ĐÃ PHÊ DUYỆT (Accepted)** — tương ứng **ADR-058** trong [`docs/DECISIONS.md`](../../docs/DECISIONS.md) (chủ dự án chốt 2026-10-25), gồm
"Bổ sung ADR-058" (a)–(c). Bản trích ghi theo duyệt của Quốc (brief task 0.4, 2026-10-25). Kế hoạch (Phong):
`docs/ke-hoach-toi-uu-layout-tab-accordion-2026-10-25.md`.

Tiến độ (2026-10-25):
- **GĐ 0 — xong 0.1–0.3** (code working tree, chưa commit ✅ `git status`): `CollapsibleSection`, `ModuleTabs`, cảnh báo rời trang, trường `match`.
  Task 0.4 = ghi KB (trang này + [[04-Operations-Runbooks/UI-Design-System|UI-Design-System]] §25).
- **GĐ 1 — System Center: xong, trừ 1.10** (Quốc báo code xong + verify 2026-10-25; code working tree chưa commit ✅ `git status`; **chưa thử trình duyệt** ❓):
  1.1, 1.2, 1.2b, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.8b, 1.9, 1.11, 1.12a, 1.12b, 1.13, 1.14, 1.15. **1.10 (Lưu trữ file) tạm hoãn — chờ Vương xong ADR-055** — task
  duy nhất còn lại của toàn kế hoạch.
  - Điều hướng: Trang CMS 2 tab (Trang chủ · Header & Footer); mục "Trang tuỳ chỉnh" (lọc `slug notIn SYSTEM_CMS_SLUGS` cho cả `findMany` + `count`);
    Cấu hình chung 3 tab (Cấu hình chung · Email hỗ trợ · Cấu hình Email (SMTP)). Sidebar còn **21 mục** ✅ đếm code.
  - Hạ tầng mới: `InPageTabs` (tab ARIA thật kiểu pill, panel luôn mounted — SMTP, Thương hiệu), `useFormDraft` (giữ giá trị khi lưu lỗi, không ghi lại secret,
    `dirtyOf`), `CollapsibleSection.status` nhận mảng + sắc `info`.
  - Accordion theo trang (SEO luôn thu gọn, cổng thanh toán đang bật thì mở, trang tạo gói mở cả 3; Cửa hàng/Cloudinary không accordion) và `useUnsavedChanges`
    ở mọi form/editor System Center trừ Lưu trữ file.
  - Lỗi có sẵn đã sửa: Thương hiệu mất dữ liệu khi chuyển tab, Toggle thanh toán lệch sau lưu lỗi, `<main>` lồng (còn `settings/storage`).
  - 1.14: `metadata.title` riêng cho 5 trang tab; `admin/error.tsx` bỏ `<main>` lồng; câu mô tả SEO trang chủ + Bảng giá ("Lưu nháp và Xuất bản đều ghi SEO, áp dụng
    ngay"); badge "Có thay đổi chưa lưu" thống nhất sắc `warning` ✅ grep. 1.15: 8 trang bỏ `SettingsGrid`, xếp 1 cột full width ✅ grep.
  - Chi tiết từng trang: [[04-Operations-Runbooks/UI-Design-System|UI-Design-System]] §12.5, §12.6, §25.3–§25.8.
- **GĐ 2 — Studio: xong hết, không task nào hoãn** (Quốc báo xong 2026-10-25; ✅ đọc code working tree, chưa commit; chưa thử trình duyệt ❓):
  - **2.1** `ModuleTabs` "Cài đặt" (Thông tin & thương hiệu · Thanh toán), sidebar không cần `match`; `useFormDraft` + `useUnsavedChanges` cho branding/slug/onboarding —
    `branding-form` dùng `keepOnSuccess`; onboarding (ngoài layout Studio) tự bọc `UnsavedChangesProvider` trong page. Quốc thêm `revalidatePath` layout
    `/studio/{slug}` và `/{slug}` trong `updateBrandingAction` ✅ đọc code.
  - **2.2** thanh toán tenant: mỗi cổng 1 khối, cổng đang bật thì mở; không ghi lại secret; sửa Toggle lệch khi cổng tự tắt (form có `key`).
  - **2.3a** editor tài liệu (giữ bố cục, không thêm tab): khối Thông tin (mở) / Giá (mở sẵn ở trang Tạo) / Danh mục / Thẻ / Lượt tải / Link chia sẻ; Ảnh, Tệp,
    Xuất bản không thu gọn; `changedFields`/`touchField` chỉ cho badge — `dirty` vẫn là nguồn sự thật (lưu ý cho tự lưu nháp).
  - **2.3b** Link chia sẻ: không ghi lại mật khẩu; `useFormDraft` hỗ trợ nhóm checkbox (`RadioNodeList`).
  - **2.4** editor bài viết: Nội dung / Tài liệu liên quan / Ghim bài. **2.5** Trang bán hàng: không accordion (list-detail, mục ghim đổi hành vi hiển thị).
  - **2.6** Mã giảm giá 4 khối; hook trả thêm `values` cho badge tóm tắt. Rà 2 form ghi chú (đơn hàng, khách hàng): ô có kiểm soát → không cần `useFormDraft`.
  - Chi tiết: [[04-Operations-Runbooks/UI-Design-System|UI-Design-System]] §11.1, §25.3 (bảng GĐ 2), §25.7.
- **Quy tắc full width** (chủ dự án chốt 2026-10-25 🟡 brief/kế hoạch): nội dung chính System Center + Studio luôn full width, khối 1 cột; `SettingsGrid` thành
  `grid grid-cols-1` (Quốc sửa tận gốc); bỏ `max-w` ở `post-editor`, `product-editor`, trang Lưu trữ file; `max-w` chỉ giữ ở cấp component ✅ grep —
  [[04-Operations-Runbooks/UI-Design-System|UI-Design-System]] §5.
- **Trạng thái chung sau GĐ 2** ✅ grep: không còn `<main>` lồng và không còn `beforeunload` riêng trong System Center lẫn Studio, **trừ** Lưu trữ file (1.10).
- Chỉ lớp trình bày: không migration, URL không đổi; ngoại lệ phía server duy nhất là `revalidatePath` của `updateBrandingAction` (Quốc). `pnpm test:count` =
  **100/66** ✅ (Long chạy 2026-10-25, sau GĐ 2).

Mức xác minh: ✅ Long đã đối chiếu code working tree · 🟡 theo `docs/DECISIONS.md`/kế hoạch · ❓ cần môi trường thật.

---

## 2. Bối Cảnh (Context) 🟡
Menu System Center dài (23 mục), các trang cùng chức năng nằm rời (trang chủ CMS không có mục sidebar; Email hỗ trợ tách khỏi SMTP), có 4 kiểu "tab"
khác nhau. `next/link` điều hướng phía client không kích hoạt `beforeunload` → bấm sidebar khi editor đang sửa dở có thể mất thay đổi mà không có cảnh báo.

---

## 3. Quyết Định (Decision) 🟡 (theo `docs/DECISIONS.md`)
1. Tab ngang đầu trang chỉ gom **trang con cùng một chức năng**; không dropdown. URL giữ nguyên.
2. **Trang CMS** = 2 tab: **Trang chủ** (mặc định) · **Header & Footer**. Cửa hàng, Bảng giá, Chính sách sử dụng, Danh mục giữ mục riêng.
3. **Cấu hình chung** gom thêm tab **Email hỗ trợ** và **Cấu hình Email (SMTP)**. **Không** gom Lưu trữ & Cloudinary.
4. Accordion chỉ cho trang có nhiều khối/khối tuỳ chọn; không áp cho trang ngắn. Khối đầu mở, khối khác thu gọn. **SEO luôn thu gọn** ở mọi editor,
   kiểu section Rank Math (tiêu đề + badge "Tất cả đều tốt"/"N lỗi"/"Có thay đổi" + chevron). Trang thanh toán: cổng đang bật mở, cổng tắt thu gọn.
5. **Cảnh báo rời trang khi chưa lưu** (kể cả bấm tab/sidebar) làm ngay ở GĐ 0.
6. Studio áp cùng quy tắc. Không làm trang tài khoản khách hàng.
7. Làm từng task nhỏ, mỗi task duyệt rồi mới làm task sau.

**Bổ sung ADR-058:**
- (a) Trang CMS tuỳ chỉnh (`/p/[slug]`) có mục sidebar riêng **Nội dung → "Trang tuỳ chỉnh"** (danh sách `/admin/cms`, **ẩn slug hệ thống**
  home/menu/shop/pricing — trong truy vấn, kế hoạch §0 mục 7); "Trang CMS" chỉ gồm 2 tab.
- (b) Studio — trang sửa tài liệu **giữ nguyên, không thêm tab**, chỉ áp accordion cho các khối.
- (c) Migration ADR-057 (`isDraftRelease`) đã chạy 2026-10-25 — xem [[01-Architecture-Decisions/ADR-042-Legal-Drafts-Import-Preview-Draft-Release|ADR-042 KB]].

---

## 4. Hiện Thực GĐ 0 ✅ (đọc code, `apps/web/app/admin/_ui/`)

| File | Nội dung |
| :-- | :-- |
| `collapsible-section.tsx` | `CollapsibleSection` (heading chứa `<button aria-expanded aria-controls>`, badge trạng thái có chữ, chevron; panel `hidden` khi đóng, **không unmount**; tự mở khi `#id` trên URL hoặc `errorCount` 0 → > 0; `syncHash` tuỳ chọn); `sectionStatus()` (N lỗi → Có thay đổi → N cảnh báo → Chưa điền → Tất cả đều tốt); `revealSection(id)` |
| `module-tabs.tsx` | `ModuleTabs` — `<nav>` + link `aria-current="page"`, không `tablist`, không dropdown; mobile ≥ 3 tab → nút disclosure "Đang xem: … (i/n)" |
| `unsaved-changes.tsx` | `UnsavedChangesProvider` (một `beforeunload` chung), `useUnsavedChanges(dirty, message?)`, `useLeaveGuard()` (cho `onNavigate` của `next/link` → `confirm`), `GuardedLink`. Provider bọc ở `admin/layout.tsx` và `studio/[tenantSlug]/layout.tsx`; áp thử ở editor Chính sách sử dụng |
| `nav-match.ts` + `sidebar-nav.tsx` | `navMatchLength`, `pickActiveHref`; `SidebarNavLeaf.match?: string[]` — chuỗi thường khớp tiền tố, `=` ở đầu khớp đúng; mục khớp dài nhất thắng |

Chi tiết spec: [[04-Operations-Runbooks/UI-Design-System|UI-Design-System]] §25.

---

## 5. Lý Do (Rationale) 🟡
- Sidebar là cấp chức năng, tab là cấp phần con — hai cấp không chồng nhau, sidebar ngắn lại mà không mất trang nào.
- Tab là link URL thật nên dùng `nav` + `aria-current` (WAI-APG), không giả tablist.
- Panel giữ trong DOM khi thu gọn để không mất dữ liệu đang nhập và form vẫn gửi đủ trường.

---

## 6. Hệ Quả (Consequences)
- **Giới hạn đã biết:** cảnh báo rời trang không chặn Back/Forward của trình duyệt (App Router không có API chặn chính thức).
- ~~Còn 3 editor Studio tự gắn `beforeunload` riêng~~ — đã chuyển sang `useUnsavedChanges` ở GĐ 2 (2.3a, 2.4, 2.5). Chỉ còn Lưu trữ file (1.10) chưa có cảnh báo.
- React 19 reset ô không kiểm soát sau mọi lần form action (kể cả lỗi) → mọi form `useActionState` + `defaultValue` cần `useFormDraft` hoặc ô có kiểm soát; bảng form
  còn nguy cơ nằm trong kế hoạch §6 (sau GĐ 2 còn Lưu trữ file; 2 form billing Studio mức "Thấp" chưa task nhận — KB-Audit §40).
- Trang/form mới ở System Center/Studio phải theo quy tắc full width (không `max-w` ở khung form/editor).
- Kiểm trên trình duyệt thật, bàn phím, trình đọc màn hình, 375px ❓.

---

## 7. Liên Kết
* [[01-Architecture-Decisions/ADR-028-Shared-App-Sidebar-Logout-Mobile-Drawer|ADR-028 KB (≙ ADR-042)]] — sidebar dùng chung
* [[04-Operations-Runbooks/UI-Design-System|UI-Design-System]] §5 (kit + quy tắc full width), §9.1, §11.1, §11.3, §12.5, §12.6, §25
* [[00-Index/KB-Audit-2026-09-26|KB-Audit]] §38, §39, §40

*Quay lại: [[MOC-Home]] (../00-Index/MOC-Home.md)*

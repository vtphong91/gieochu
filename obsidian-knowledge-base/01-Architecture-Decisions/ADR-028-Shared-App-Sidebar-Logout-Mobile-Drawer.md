---
tags:
  - adr
  - ui-ux
  - design-system
  - system-admin
  - tenant
  - status/accepted
date: 2026-10-17
decider: vtphong91
status: Accepted (Chốt — Áp dụng chính thức)
---

# 🏛️ ADR-028: Một sidebar dùng chung cho System Center và Studio; Đăng xuất ở đáy sidebar; drawer mobile

## 1. Trạng Thái (Status)
**ĐÃ PHÊ DUYỆT (Accepted)** — tương ứng **ADR-042** trong [`docs/DECISIONS.md`](../../docs/DECISIONS.md). Bản trích ghi vào thư mục này theo
duyệt của Quốc (brief 2026-10-17). Quyết định này **hoàn tất GĐ2b của ADR-041** (menu mobile Studio —
[[01-Architecture-Decisions/ADR-027-Account-Upgrade-Pricing-Profile-Refund|ADR-027 KB (≙ ADR-041)]]).

Tiến độ (2026-10-17): **xong code; đã commit `9d37ab1`** (2026-10-17) ✅ `git log`, deploy ❓; không migration, không đổi API/schema, không thêm test.

Mức xác minh: ✅ Long đã đối chiếu code (2026-10-17) · 🟡 theo `docs/DECISIONS.md`/báo cáo của Quốc · ❓ cần môi trường thật.

---

## 2. Bối Cảnh (Context)
Chủ dự án yêu cầu (2026-10-17) 🟡: sidebar Studio phải **cùng style** System Center; dashboard admin/Studio phải có **Đăng xuất** — trước đó
System Center không có nút Đăng xuất nào, Studio chỉ có trong menu tài khoản ở header (khó thấy); đồng thời hoàn tất GĐ2b ADR-041 (menu điều
hướng dưới `lg`). Trước đợt này có **hai bộ sidebar riêng**: `admin/_ui/sidebar-nav.tsx` (`AdminSidebarNav`, accordion có nhóm) và
`studio/[tenantSlug]/_ui/sidebar-nav.tsx` (`TenantSidebarNav`, danh sách phẳng 11–12 mục, badge dạng chữ "(N)" trong nhãn) ✅ `git show HEAD`;
cả hai `hidden … lg:flex`, không có menu dưới `lg`.

---

## 3. Quyết Định (Decision)
1. **Một component** `SidebarNav` + `AppSidebarPanel` (`apps/web/app/admin/_ui/`) cho cả `/admin` và `/studio`. Studio chia "Tổng quan" + 3
   nhóm accordion (**Bán hàng / Nội dung / Gian hàng**); badge dạng `{count, srText, urgent}`. **Xoá** sidebar riêng của Studio — không duy trì
   hai bộ.
2. **Đăng xuất** cố định ở **đáy sidebar** (tách khỏi điều hướng) + trong `AccountMenu` header. Ở app shell (admin/Studio) đăng xuất xong về
   `/login`; trang công khai và `/account` giữ về `/`.
3. Dưới `lg`: nút ☰ mở **drawer `<dialog>`** chứa cùng sidebar (focus trap, Esc/nền/đổi trang đóng, reduced-motion).

---

## 4. Triển Khai (theo code, 2026-10-17)
| Chỗ | Hành vi | Xác minh |
|---|---|---|
| `apps/web/app/admin/_ui/sidebar-nav.tsx` | `SidebarNav({ standalone, groups, rootHref, storageKey, ariaLabel })` dùng chung + `AdminSidebarNav({ badges })` (cấu hình System Center). Icon truyền bằng **key chuỗi** (`SidebarNavIcon`, 18 key). Accordion 1 nhóm mở; ưu tiên: thao tác tay trong phiên → nhóm chứa trang đang xem → nhóm lưu ở `localStorage` (`admin:nav:expanded` / `studio:nav:expanded`) → nhóm đầu. Active = href khớp **dài nhất**, `aria-current="page"`, màu `color-mix` từ `brandColors.accent`. Nhóm đóng hiện tổng badge các mục con | ✅ |
| `apps/web/app/admin/_ui/app-sidebar.tsx` | `AppSidebarPanel({ brand, nav, footer })`: khối brand 64px · `nav` cuộn riêng · chân (link phụ) · **Đăng xuất** cố định đáy (`LogoutButton tone="onDark" redirectTo="/login"`); `SIDEBAR_FOOTER_LINK_CLASS` cho link phụ | ✅ |
| `apps/web/app/admin/_ui/sidebar-drawer.tsx` | `SidebarDrawer({ label, children })`: nút ☰ 44×44 (`lg:hidden`, `aria-expanded`/`aria-controls`) mở `<dialog>` bằng `showModal()`; đóng khi Esc, bấm nền, bấm link, đổi `pathname`, màn hình lên `lg` (`min-width: 64rem`); đóng xong trả focus nút mở; nội dung chỉ render khi mở | ✅ |
| `apps/web/app/globals.css` | `.app-drawer`: khoá cuộn `html` khi drawer mở, panel trượt + nền mờ 200ms, tắt animation khi `prefers-reduced-motion: reduce` | ✅ |
| `apps/web/app/admin/layout.tsx`, `apps/web/app/studio/[tenantSlug]/layout.tsx` | Cùng một phần tử `panel` đặt vào `<aside>` (từ `lg`, sticky `h-dvh`, 288px) và `SidebarDrawer`. Header dùng `AccountMenu variant="app" logoutRedirect="/login"`; admin lấy họ tên + avatar qua `getAccountHeaderData` | ✅ |
| `apps/web/app/studio/[tenantSlug]/_ui/sidebar-nav.tsx` | **Đã xoá** (`git status`: `D`) | ✅ |
| `apps/web/app/account/_ui/logout-button.tsx` | `LogoutButton` thêm prop `redirectTo` (mặc định `/`) và `tone` (`light` / `onDark` — đỏ `#FCA5A5` trên nền primary) | ✅ |
| `apps/web/app/_ui/account-menu.tsx` | Prop `logoutRedirect` (mặc định `/`); `variant="app"` có viền + chevron ở mọi kích thước | ✅ |

Chi tiết giao diện: [[04-Operations-Runbooks/UI-Design-System|UI-Design-System]] §5.1, §11.1, §12.6. Sơ đồ menu System Center:
[[02-System-Specs/User-Management-System-Center-Specs|User-Management-System-Center-Specs]] §2.

**Kiểm:** lint/typecheck/build đạt 🟡 (báo cáo Quốc); xem trước dữ liệu giả 360/768/1280 + bàn phím drawer 🟡. **Chưa** kiểm phiên đăng nhập
thật, đăng xuất thật, trình đọc màn hình ❓.

---

## 5. Hệ Quả (Consequences)
- Thêm mục menu Studio/System Center chỉ sửa **mảng cấu hình** trong layout tương ứng (Studio) hoặc `ADMIN_GROUPS` (System Center); icon mới
  phải thêm key vào `NAV_ICONS` trong `sidebar-nav.tsx`.
- Badge số không còn nằm trong nhãn ("Đánh giá (N)", "Hộp thư (N)" cũ) — nhãn cố định, số trong pill `aria-hidden` + `srText` cho trình đọc màn
  hình.
- Mục "Hoạt động" Studio vẫn chỉ hiện với `OWNER` (ADR-037).
- `LogoutButton` nằm ở `account/_ui/` nhưng được `admin/_ui/app-sidebar.tsx` import — cân nhắc chuyển về `app/_ui/` (BACKLOG).
- Shell admin/Studio chưa có skip-link "Bỏ qua tới nội dung" (`/account` đã có) — BACKLOG.

---

## 6. Liên Kết
* [[01-Architecture-Decisions/ADR-027-Account-Upgrade-Pricing-Profile-Refund|ADR-027 KB (≙ ADR-041)]] — GĐ2b · [[01-Architecture-Decisions/ADR-010-Layout-Width-Container-Standard|ADR-010 KB (≙ ADR-024)]] — app shell fluid · [[01-Architecture-Decisions/ADR-023-M12-Audit-Log-Append-Only|ADR-023 KB (≙ ADR-037)]] — mục Hoạt động chỉ OWNER
* [[04-Operations-Runbooks/UI-Design-System|UI-Design-System]] ([UI-Design-System.md](../04-Operations-Runbooks/UI-Design-System.md)) · [[02-System-Specs/Account-Profile-Specs|Account-Profile-Specs]] §5 ([Account-Profile-Specs.md](../02-System-Specs/Account-Profile-Specs.md))

*Quay lại: [[MOC-Home]] (../00-Index/MOC-Home.md)*

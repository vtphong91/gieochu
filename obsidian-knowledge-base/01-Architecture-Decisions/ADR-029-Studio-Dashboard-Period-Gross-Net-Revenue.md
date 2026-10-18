---
tags:
  - adr
  - analytics
  - tenant
  - order
  - ui-ux
  - status/accepted
date: 2026-10-18
decider: vtphong91
status: Accepted (Chốt — Áp dụng chính thức)
---

# 🏛️ ADR-029: Dashboard Tổng quan gian hàng (`/studio/{slug}`) — chỉ số theo kỳ, doanh thu gộp + thực nhận

## 1. Trạng Thái (Status)
**ĐÃ PHÊ DUYỆT (Accepted)** — tương ứng **ADR-043** (gồm **"Bổ sung ADR-043"** và **"Bổ sung ADR-043 lần 2"**) trong [`docs/DECISIONS.md`](../../docs/DECISIONS.md).
Bản trích ghi vào thư mục này theo duyệt của Quốc (brief 2026-10-18).

Tiến độ (2026-10-18): **xong code GĐ1 (dữ liệu, Hiếu) + GĐ2 (UI, Phong), chưa commit/deploy** ✅ `git status`; không migration, không route HTTP mới.
Test: +1 unit +1 integration → `pnpm test:count` = **94/94 unit, 55/55 integration** ✅ (Long chạy 2026-10-18, chỉ đếm) — **chạm trần**.

Mức xác minh: ✅ Long đã đối chiếu code working tree (2026-10-18) · 🟡 theo `docs/DECISIONS.md`/báo cáo của Quốc · ❓ cần môi trường thật.

---

## 2. Bối Cảnh (Context)
Trang Tổng quan Studio cũ chỉ có 4 thẻ tĩnh ("Doanh thu 30 ngày" loại đơn REFUNDED, cửa sổ 30×24h trượt; "Đơn chờ xác nhận"; thẻ "Sản phẩm
bán chạy" còn placeholder; "Đánh giá mới" 7×24h) ✅ (đọc `git show HEAD`, ghi trong kế hoạch §1.1). Chủ dự án yêu cầu (2026-10-17) 🟡 card
thống kê bán hàng/đánh giá/tài liệu theo kỳ, bảng đơn mới, biểu đồ. Kế hoạch:
[`docs/ke-hoach-dashboard-tong-quan-gian-hang-2026-10-17.md`](../../docs/ke-hoach-dashboard-tong-quan-gian-hang-2026-10-17.md); chủ dự án chốt §9
ngày 2026-10-18 🟡. Dashboard là **dữ liệu nghiệp vụ**, không phải nội dung → **không có GĐ CMS** (PLAN_CHECK).

---

## 3. Quyết Định (Decision) — theo `docs/DECISIONS.md`
1. **Doanh thu (gộp)** = tổng `totalVnd` đơn có `paidAt` trong kỳ, **tính cả đơn sau này hoàn tiền** — cùng định nghĩa GMV System Center
   (ADR-037). Thêm thẻ **Doanh thu thực nhận** = gộp − đơn đã hoàn tiền; khoản hoàn tính theo **ngày khách trả tiền** của đơn (không thêm cột
   `refundedAt`). Giao diện ghi rõ định nghĩa hai thẻ.
2. Chỉ **chủ gian hàng (OWNER)** vào trang (giữ nguyên).
3. **Bảng 10 đơn mới nhất** (không lọc theo kỳ): chỉ **mã đơn, họ tên khách, đơn giá, thành tiền** — **không email**; link tới chi tiết đơn.
4. **Khách quay lại** = khách có ≥ 2 đơn đã thanh toán tại gian hàng. **Điểm đánh giá TB** chỉ tính đánh giá đang hiển thị.
5. **Kỳ** `?ky=`: hôm nay, hôm qua, tuần này (**bắt đầu Thứ Hai**), tháng, quý, năm, 7 ngày, **30 ngày (mặc định)**, tuỳ chọn `tu`–`den` **tối
   đa 366 ngày**; ranh giới theo giờ VN; so sánh % với kỳ trước **cùng độ dài**.
6. Tính trực tiếp từ bảng L2 qua `withTenant` — **không** đọc `tenant_daily_stats` (L1, không RLS).
7. Để sau: xuất CSV, biểu đồ doanh thu theo danh mục (donut). Test: dùng 1 unit + 1 integration còn trống trong trần 94/55 (**không nâng trần**).

**Bổ sung ADR-043 (2026-10-18, chủ dự án chốt):** số liệu tiền (doanh thu gộp/thực nhận, số đơn đã thanh toán, giá trị đơn TB, khách quay lại)
**chỉ tính đơn > 0đ**; đơn 0đ (tài liệu miễn phí) tách thành thẻ phụ **"Lượt nhận tài liệu miễn phí"**. **Top 5 bán chạy không tính đơn đã
hoàn tiền.**

**Bổ sung ADR-043 lần 2 (2026-10-18, Quốc):** Top 5 bán chạy tính theo số đơn **gồm cả lượt nhận miễn phí** (phản ánh mức phổ
biến; cột doanh thu cho thấy tài liệu miễn phí = 0đ). "Khách quay lại" đếm cả đơn > 0đ **đã hoàn tiền** vào điều kiện ≥ 2 đơn. `ordersPaid`
System Center gồm đơn 0đ, Studio không — có chủ đích.

---

## 4. Triển Khai (theo code, 2026-10-18)
| Chỗ | Hành vi | Xác minh |
|---|---|---|
| `packages/core/src/stats/dashboard-range.ts` (subpath `@gieochu/core/dashboard-range`, cũng export ở `@gieochu/core`) | Hàm thuần `resolveDashboardRange({ ky, tu, den, now })`, `listDashboardBuckets(range)`; `DASHBOARD_PRESETS` (9), `DEFAULT_DASHBOARD_PRESET = "30-ngay"`, `DASHBOARD_CUSTOM_MAX_DAYS = 366`, `DASHBOARD_PRESET_LABELS`. Đầu vào sai → về 30 ngày + `invalid: true`, không ném | ✅ |
| `apps/web/lib/tenant-dashboard.ts` | `getTenantDashboard({ tenantId, range, now? })` — 3 truy vấn `$queryRaw` tuần tự trong **một** `withTenant`, kèm `"tenantId" = $1` tường minh; không cache; tiền trả `number` nguyên, vượt `Number.MAX_SAFE_INTEGER` → `AppError INTERNAL_ERROR` | ✅ |
| `apps/web/app/studio/[tenantSlug]/(tong-quan)/` | Trang chuyển vào route group (URL không đổi `/studio/{slug}`) để `loading.tsx`/`error.tsx` chỉ áp cho Tổng quan; `_ui/dashboard.tsx`, `_ui/dashboard-format.ts`, `_ui/dashboard-skeleton.tsx` | ✅ |
| `apps/web/app/admin/_ui/stats-chart.tsx` (mới) | Khối trình bày thống kê dùng chung `/admin` + Studio: `KpiCard`, `ChangeLine`, `computeChange` (BigInt), `TrendChart` (cột/đường), `RatioBar`, `StatIcon`, định dạng VND; `sales-stats.tsx` (System Center) refactor dùng chung | ✅ |
| `apps/web/app/admin/_ui/icons.tsx` | Thêm `IconArrowUp`, `IconArrowDown`, `IconStarSolid`, `IconGift` | ✅ |
| `apps/web/lib/order.ts` `getOrderDashboardStats` | Không còn nơi gọi (grep 2026-10-18) — xoá ở BACKLOG | ✅ |

Đặc tả đầy đủ: [[02-System-Specs/Studio-Dashboard-Specs|Studio-Dashboard-Specs]]. Giao diện: [[04-Operations-Runbooks/UI-Design-System|UI-Design-System]] §19.
Contract loader: [[03-API-Contracts/Endpoint-Directory|Endpoint-Directory]] §22.

**Kiểm:** lint/typecheck/build đạt (Quốc chạy lại 2026-10-18) 🟡; integration `studio-dashboard.test.ts` chạy thật đạt, dọn dữ liệu 🟡 (báo
cáo); xem trước dữ liệu giả 360/768/1280 🟡. **Chưa** kiểm phiên OWNER thật, `/admin` sau refactor `sales-stats`, bàn phím/trình đọc màn hình ❓.

---

## 5. Hệ Quả (Consequences)
- Hai màn hình có "doanh thu": Studio (realtime, tới thời điểm render, chỉ đơn > 0đ) và System Center (`tenant_daily_stats`, tới hết hôm qua).
  **Tiền gộp** cùng định nghĩa (đơn 0đ cộng 0 nên không đổi tổng); **số đơn đã thanh toán khác nhau** — System Center `ordersPaid` đếm cả đơn 0đ ✅
  (`lib/tenant-stats.ts` không lọc `totalVnd`). Chi tiết: [[02-System-Specs/Tenant-Stats-Specs|Tenant-Stats-Specs]] §9.
- `newCustomers` giữ định nghĩa `firstOrderAt` → khách chỉ nhận tài liệu miễn phí **vẫn** là khách mới (khớp System Center), trong khi "người
  mua"/"khách quay lại" chỉ tính đơn > 0đ.
- Trần test **đã chạm 94/55** — test mới (vd cô lập tenant chéo cho dashboard) cần chủ dự án duyệt nâng trần.
- Kỳ dài ("năm nay", tuỳ chọn 366 ngày) quét `orders` theo `paidAt` không có index `(tenantId, paidAt)` — hiệu năng trên DB thật ❓; index
  expand-only để BACKLOG.
- Thêm route tĩnh dưới `app/[tenantSlug]/` **không** liên quan (route group nằm dưới `studio/`, không đụng `RESERVED_PRODUCT_SLUGS`).

---

## 6. Liên Kết
* [[01-Architecture-Decisions/ADR-023-M12-Audit-Log-Append-Only|ADR-023 KB (≙ ADR-037)]] — GMV gộp, `tenant_daily_stats` · [[01-Architecture-Decisions/ADR-022-Background-Jobs-After-And-Daily-Cron|ADR-022 KB (≙ ADR-036)]] — trạng thái đơn hiệu lực · [[01-Architecture-Decisions/ADR-025-Buyer-Remedy-Final-Download-Or-Refund|ADR-025 KB (≙ ADR-039)]] — yêu cầu hoàn tiền · [[01-Architecture-Decisions/ADR-028-Shared-App-Sidebar-Logout-Mobile-Drawer|ADR-028 KB (≙ ADR-042)]] — app shell Studio
* [[02-System-Specs/Studio-Dashboard-Specs|Studio-Dashboard-Specs]] ([Studio-Dashboard-Specs.md](../02-System-Specs/Studio-Dashboard-Specs.md)) · [[04-Operations-Runbooks/UI-Design-System|UI-Design-System]] §19 ([UI-Design-System.md](../04-Operations-Runbooks/UI-Design-System.md))

*Quay lại: [[MOC-Home]] (../00-Index/MOC-Home.md)*

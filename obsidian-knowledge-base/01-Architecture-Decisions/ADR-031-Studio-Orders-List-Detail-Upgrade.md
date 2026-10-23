---
tags:
  - adr
  - order
  - tenant
  - ui-ux
  - status/accepted
date: 2026-10-18
decider: vtphong91
status: Accepted (Chốt — Áp dụng chính thức)
---

# 🏛️ ADR-031: Nâng cấp trang Đơn hàng Studio (danh sách + chi tiết)

> [!NOTE] Đổi số 2026-10-23
> Bản trích này trước đây là **ADR-030** (≙ ADR-044 cũ). Do trùng số với nhánh của vuong (ADR-044 MinIO, ADR-045 Storage Gateway, bản trích KB ADR-030 Storage Gateway), Quốc đánh số lại trong `docs/DECISIONS.md`; Long đổi tên file theo (xem [[00-Index/KB-Audit-2026-09-26|KB-Audit]] §29).

## 1. Trạng Thái (Status)
**ĐÃ PHÊ DUYỆT (Accepted)** — tương ứng **ADR-046** (gồm **"Bổ sung ADR-046"** — Quốc đính chính theo code) trong [`docs/DECISIONS.md`](../../docs/DECISIONS.md). Bản trích ghi vào thư mục này theo duyệt
của Quốc (brief 2026-10-18).

Tiến độ (2026-10-18): dữ liệu (Hiếu) + UI (Phong) xong code ở working tree, nay **đã commit** `dd349b9` ✅ `git log` (cập nhật 2026-10-23, trước ghi "chưa commit"); deploy ❓. **Không migration, không
`route.ts`/Server Action mới.** Test không đổi: `pnpm test:count` = **94/94 unit, 55/55 integration** ✅ (Long chạy 2026-10-18, chỉ đếm).

Mức xác minh: ✅ Long đã đối chiếu code working tree (2026-10-18) · 🟡 theo `docs/DECISIONS.md`/báo cáo của Quốc · ❓ cần môi trường thật.

---

## 2. Bối Cảnh (Context)
Chủ dự án yêu cầu (2026-10-18) trang `/studio/{slug}/orders` và chi tiết đơn chuyên nghiệp hơn, tham khảo WooCommerce 🟡. Đây là dữ liệu nghiệp vụ,
không có nội dung CMS → PLAN_CHECK: không cần GĐ CMS 🟡.

---

## 3. Quyết Định (Decision) — theo `docs/DECISIONS.md`
1. **Danh sách:** bộ lọc gọn dạng dropdown (trạng thái kèm số đếm, yêu cầu hoàn tiền, khoảng ngày tạo đơn dùng lại date range picker ADR-043, sản
   phẩm), ô tìm theo mã đơn / họ tên / email khách, sắp xếp ngày tạo + tổng tiền, **phân trang server** (20/trang, tuỳ chọn 10/20/50/100), URL GET
   chia sẻ được. Cột: mã đơn (link) · ngày tạo · khách (**họ tên + email** — không SĐT/địa chỉ, giữ ADR-041) · tài liệu · tổng tiền · trạng thái
   (+ badge hoàn tiền) · **Thao tác** (menu: Xem chi tiết và các thao tác hợp lệ theo trạng thái — dùng lại action có sẵn).
2. **Chi tiết:** bố cục 2 cột kiểu WooCommerce — cột chính: thông tin chung (mã, ngày tạo/thanh toán giờ VN, trạng thái, kênh thanh toán), khách
   (họ tên, email), bảng dòng tài liệu (giá gốc, giảm giá/mã giảm giá, thành tiền), quyền tải (lượt đã dùng/giới hạn, remedy ADR-039); cột phụ: hộp
   **Thao tác đơn** (xác nhận thanh toán, huỷ, đánh dấu đã hoàn, cấp thêm lượt, thu hồi — chỉ hiện thao tác hợp lệ, xác nhận 2 bước), **Lịch sử
   khách tại gian hàng** (tổng đơn, tổng chi tiêu, giá trị đơn TB — chỉ đơn > 0đ đã thanh toán, ADR-043), **Lịch sử đơn** (dòng thời gian tự động từ
   dữ liệu có sẵn: tạo đơn, thanh toán/giao dịch, audit đơn, email đã gửi).
3. **Không** ghi chú nội bộ (để sau), **không** thao tác hàng loạt (để sau), **không** migration.
4. Mọi truy vấn L2 qua `withTenant`, chỉ OWNER (như hiện tại); không đổi luật nghiệp vụ của các action tiền.

---

## 4. Triển Khai (theo code, 2026-10-18)
| Chỗ | Hành vi | Xác minh |
|---|---|---|
| `apps/web/lib/order.ts` | `listOrdersPage`, `parseOrderListQuery`, `buildOrderListSearch`, `normalizeOrderSearchQuery`, `orderAllowedActions`, `getOrderDetailView` + hằng `ORDER_LIST_*`. Tham số URL `trang-thai` (alias `status`), `remedy`, `q`, `ky/tu/den` (theo `createdAt`; không có = mọi thời gian), `san-pham`, `sap-xep`, `trang`, `so-dong` | ✅ |
| `apps/web/lib/prisma-contains.ts` (mới) | `escapeContainsValue` — **quy ước mới**: input người dùng vào Prisma `contains` phải escape `\`/`%`/`_`; đã áp `order.ts`, `home.ts` (3 chỗ), `admin/users/page.tsx` | ✅ |
| `apps/web/app/studio/[tenantSlug]/orders/**` | Danh sách (thanh lọc GET, bảng từ `xl` / thẻ dưới `xl`, sắp xếp cột, menu dòng + `<dialog>` xác nhận, phân trang `?trang=`), chi tiết `MainAsideGrid`, `loading.tsx` ×2, `error.tsx`, `?back=` giữ bộ lọc (whitelist) | ✅ |
| `admin/_ui/kit.tsx`, `link-pagination.tsx`, `admin/_ui/date-range-picker.tsx` (chuyển từ `(tong-quan)/_ui/`), `(tong-quan)/_ui/{dashboard-range-picker,dashboard}.tsx` | `DataTable.head` `ReactNode[]` + `headAriaSort`; `LinkPagination.pageParam`; picker dùng chung nhận `hrefForPreset`/`hrefForCustom` hoặc `formMode` (+ "Mọi thời gian"), dashboard bọc bằng `StudioDashboardRangePicker`; link dashboard `?trang-thai=PENDING` | ✅ |
| `orders/_ui/order-format.ts` | `formatOrderPrice` (giá/tổng đơn, dòng: 0 → "Miễn phí") vs `formatOrderVnd` (số tổng hợp, giảm giá, giao dịch: 0 → "0 đ") | ✅ |
| `apps/web/tests/integration/order.test.ts` | Chuyển sang kiểm `listOrdersPage`/`getOrderDetailView` (cô lập tenant, escape `%`/`_`, `allowedActions`), số case không đổi; chạy thật 9/9 🟡 (Quốc) | ✅ đọc test |
| `orders/[orderId]/actions.ts` | **Không đổi** — thao tác tiền giữ nguyên luật | ✅ `git status` |

Đặc tả: [[02-System-Specs/Studio-Orders-Specs|Studio-Orders-Specs]]. Contract loader: [[03-API-Contracts/Endpoint-Directory|Endpoint-Directory]] §23.
Giao diện: [[04-Operations-Runbooks/UI-Design-System|UI-Design-System]] §20.

**Kiểm:** lint/typecheck/build đạt (Quốc chạy 2026-10-18) 🟡; Hiếu đọc-only dữ liệu thật `phongweb` đúng 🟡. **Chưa** xem UI thật với phiên OWNER,
chưa thử tenant chéo, nhánh timeline audit/email chưa có dữ liệu ❓.

---

## 5. Hệ Quả (Consequences)
- Cách hiểu khi triển khai (ADR không nói chữ): **"giá gốc"** trong bảng dòng = **đơn giá lúc mua** (`order_items.unitPriceVnd`, đã gồm giá khuyến mãi)
  — giá niêm yết trước khuyến mãi không có snapshot ✅ code; **Lịch sử khách** thêm dòng "Đã hoàn" (`refundedVnd`) cạnh "Tổng chi tiêu" gộp ✅ code;
  **email đã gửi** chỉ gồm 2 loại có mã đơn trong tiêu đề (`order_paid`, `remedy_refund_requested`) ✅ code; mốc **huỷ** lấy `updatedAt` (không có
  `canceledAt`) ✅ code; **cấp thêm lượt / thu hồi** nằm theo từng dòng tài liệu ở cột chính, không trong hộp "Thao tác đơn" như chữ ADR mục 2 ✅ code
  — **"Bổ sung ADR-046" chấp nhận** cả "đơn giá lúc mua" lẫn bố cục này; tìm đơn **phân biệt dấu**, tìm không dấu → BACKLOG.
- Đếm trạng thái và lọc dùng **trạng thái hiệu lực** (ADR-036) — đơn PENDING quá hạn hiện là "Hết hạn" dù cột DB vẫn PENDING.
- Timeline đọc 2 bảng L1 (`audit_logs`, `email_send_log`) ngoài `withTenant`, giới hạn bằng `tenantId` + target của đúng đơn; không trả IP/UA, không
  trả địa chỉ người nhận email.
- Quy ước escape `contains` áp cho mọi code mới tìm kiếm bằng Prisma (không chỉ trang Đơn hàng).
- Chọn khoảng ngày tạo đơn **cần JS** (dùng chung picker ADR-043); các ô lọc khác vẫn chạy không JS.
- `order.test.ts` nay kiểm hai loader mới (số case không đổi, trần 94/55 giữ); `listOrders`/`getOrderDetail` cũ không còn nơi gọi → BACKLOG dọn.

---

## 6. Liên Kết
* [[01-Architecture-Decisions/ADR-029-Studio-Dashboard-Period-Gross-Net-Revenue|ADR-029 KB (≙ ADR-043)]] — date range picker, "chỉ đơn > 0đ" · [[01-Architecture-Decisions/ADR-025-Buyer-Remedy-Final-Download-Or-Refund|ADR-025 KB (≙ ADR-039)]] — yêu cầu hoàn tiền · [[01-Architecture-Decisions/ADR-022-Background-Jobs-After-And-Daily-Cron|ADR-022 KB (≙ ADR-036)]] — trạng thái đơn hiệu lực · [[01-Architecture-Decisions/ADR-027-Account-Upgrade-Pricing-Profile-Refund|ADR-027 KB (≙ ADR-041)]] — dữ liệu khách tối thiểu
* [[02-System-Specs/Studio-Orders-Specs|Studio-Orders-Specs]] ([Studio-Orders-Specs.md](../02-System-Specs/Studio-Orders-Specs.md)) · [[02-System-Specs/Order-State-Machine|Order-State-Machine]] ([Order-State-Machine.md](../02-System-Specs/Order-State-Machine.md))

*Quay lại: [[MOC-Home]] (../00-Index/MOC-Home.md)*

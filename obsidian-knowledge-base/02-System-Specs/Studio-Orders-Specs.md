---
tags:
  - spec
  - order
  - tenant
  - entitlement
  - ui-ux
  - status/living
date: 2026-10-18
updated: 2026-11-25
author: Long
---

# 📐 Đặc Tả: Trang Đơn Hàng Studio — danh sách + chi tiết (`/studio/{slug}/orders` — ADR-046, ADR-047, ADR-048)

> **Cập nhật ADR-068 + Bổ sung (2026-11-25, Long đối chiếu code; đã commit `2ccc2fc`; không `route.ts`; mục 8 thêm migration expand `orders.holdStartedAt` — đã áp DB
> `.env` 🟡, production chưa xác minh ❓):** thao tác xác nhận thanh toán + huỷ gộp
> thành **"Đổi trạng thái…"** (Đã thanh toán / Chưa thanh toán (mở lại) / Huỷ đơn) theo `statusTargets` do server tính — người bán xác nhận được đơn **đã hết hạn**, mở lại
> đơn hết hạn/đã huỷ, ghi chú **không bắt buộc** (thành ghi chú nội bộ). `confirmOrderManuallyAction`, `cancelOrderAction`, `confirm-form.tsx`, `CancelOrderButton` đã xoá ✅
> `git diff`. Chi tiết §2.4, §3.3; luật trạng thái: [[02-System-Specs/Order-State-Machine|Order-State-Machine]] §3.14; quyết định:
> [[01-Architecture-Decisions/ADR-052-Studio-Order-Status-Change-Reopen-Late-Confirm|ADR-052 KB (≙ ADR-068)]].

> **Cập nhật ADR-059 bổ sung lần 2 (2026-10-26, Long đối chiếu code; đã commit `fa29d99`):** trang danh sách gọi thêm `countTenantTransactionsNeedingAction(tenant.id)`
> và hiện dòng cảnh báo + link tới trang mới **`/studio/{slug}/orders/giao-dich` "Giao dịch cần xử lý"** (giao dịch `UNMATCHED` / `MISMATCH_AMOUNT`, L2 qua
> `withTenant`, cùng guard OWNER) ✅. Đặc tả: [[02-System-Specs/Order-State-Machine|Order-State-Machine]] §3.11; contract:
> [[03-API-Contracts/Endpoint-Directory|Endpoint-Directory]] §28. Các action tiền không đổi luật.

> **Cập nhật ADR-048 (2026-10-23, Long đối chiếu code working tree):** thêm tham số `?khach=` (lọc đơn theo một khách, §2.1) và `OrderListPage.customer`;
> trang Khách hàng mới: [[02-System-Specs/Studio-Customers-Specs|Studio-Customers-Specs]]. Đã xoá `listTenantCustomers` và `getOrderDashboardStats` khỏi
> `lib/order.ts` ✅ `git diff` + grep.

> Quyết định gốc: **ADR-046** + **"Bổ sung ADR-046"** (Quốc, đính chính theo code — đơn giá lúc mua, vị trí cấp thêm lượt/thu hồi, form GET riêng, tìm không dấu → BACKLOG; 2026-10-18) trong [`docs/DECISIONS.md`](../../docs/DECISIONS.md). Bản trích KB:
> [[01-Architecture-Decisions/ADR-031-Studio-Orders-List-Detail-Upgrade|ADR-031 (≙ ADR-046)]]. Tiếp theo: **ADR-047** (2026-10-18 — tìm không dấu, ghi chú nội bộ,
> không thao tác hàng loạt/xuất CSV, dọn hàm cũ) — bản trích [[01-Architecture-Decisions/ADR-032-Studio-Orders-Unaccent-Search-Internal-Notes|ADR-032 (≙ ADR-047)]]. ADR liên quan: ADR-036 (trạng thái đơn hiệu lực,
> cửa sổ xác nhận trễ 24h), ADR-037 (audit log), ADR-039 (yêu cầu hoàn tiền / remedy), ADR-041 (khách chỉ họ tên + email), ADR-043 (date range
> picker, định nghĩa "chỉ đơn > 0đ").
>
> Mức xác minh: ✅ Long đã đối chiếu code working tree 2026-10-18 · 🟡 theo brief/báo cáo của Quốc · ❓ cần môi trường thật.
> Trạng thái code: **đã commit** `dd349b9` (deploy ❓) ✅ `git log` (trước ghi "working tree, chưa commit"). Không `route.ts` mới. ADR-046 không migration; **ADR-047** thêm 1 migration
> (`20261018090000_adr045_order_notes` — tên thư mục giữ số cũ ADR-045, quyết định nay là ADR-047; bảng L2 `order_notes` — đã áp DB dùng chung 2026-10-18 🟡 Quốc báo) và 2 Server Action ghi chú; các action
> tiền **không đổi luật** ✅ `git diff actions.ts` (chỉ thêm import + 2 action mới).

---

## 1. Phạm vi

- Dữ liệu nghiệp vụ, **không có GĐ CMS** (PLAN_CHECK trong ADR-046) 🟡.
- Chỉ **chủ gian hàng (OWNER)**: cả hai trang gọi `requireTenantMemberPage(slug, …)` → `requireTenantMember(slug)` mặc định
  `requiredRole = "OWNER"`; không đủ quyền → 404 ✅ (`lib/page-guards.ts`, `lib/tenant.ts`).
- Loader nhận `tenant.id` từ guard, **không** lấy tenantId từ URL ✅ (JSDoc `listOrdersPage`/`getOrderDetailView`).
- Luật nghiệp vụ của các thao tác tiền (xác nhận thanh toán, huỷ, đánh dấu đã hoàn, cấp thêm lượt, thu hồi) **giữ nguyên**: UI chỉ quyết định
  *hiện* nút nào; mỗi action vẫn tự kiểm lại ✅ (ADR-046 mục 4; `orderAllowedActions` ghi rõ "không đặt luật mới"). **Từ ADR-068** luật xác nhận/huỷ **đổi** (xác nhận trễ,
  mở lại, huỷ đơn hết hạn — §2.4); danh sách lựa chọn vẫn do server tính và server kiểm lại khi thực hiện.
- **Không làm:** **thao tác hàng loạt** và **xuất CSV** đơn hàng/khách hàng ra khỏi hệ thống — chủ dự án chốt tạm thời không làm (ADR-047 mục 3);
  huỷ đơn chỉ từng đơn. (ADR-046 mục 3 từng để "ghi chú nội bộ" sau — ADR-047 đã làm, §3.2.)

---

## 2. Danh sách đơn — `/studio/{slug}/orders` ✅

### 2.1. Tham số URL (GET, chia sẻ được) — `parseOrderListQuery` (`apps/web/lib/order.ts`)

Parse phòng thủ, **không bao giờ ném**; giá trị sai bị bỏ qua (về mặc định). Mảng → lấy phần tử đầu.

| Tham số | Giá trị | Mặc định / ghi chú |
| :-- | :-- | :-- |
| `trang-thai` (alias cũ `status`) | `PENDING`, `PAID`, `FULFILLED`, `EXPIRED`, `CANCELED`, `REFUNDED` (`ORDER_LIST_STATUSES`) | Không lọc. Lọc theo **trạng thái hiệu lực** (ADR-036: PENDING quá `expiresAt` tính là EXPIRED) |
| `remedy` | `REFUND_REQUESTED` | Không lọc. Link trong email ADR-039 và khối "Việc cần xử lý" dashboard dùng tham số này |
| `q` | Mã đơn / họ tên / email khách | NFC, thay ký tự điều khiển bằng khoảng trắng, gộp khoảng trắng, cắt **≤ 100** ký tự (`ORDER_LIST_Q_MAX`); **không dấu, không phân biệt hoa thường** (ADR-047 — `gieochu_unaccent(lower(..)) LIKE`; "nguyen van thu" khớp "Nguyễn Văn Thử"); `%`/`_`/`\` được escape (§5) |
| `ky`, `tu`, `den` | Như dashboard ADR-043 (`resolveDashboardRange`, 12 mốc + `tuy-chon` ≤ 366 ngày) | **Không có `ky` (hoặc `ky`/`tu`/`den` không hợp lệ) = mọi thời gian.** Lọc theo **`createdAt`** (ngày tạo đơn), nửa mở `[start, end)` UTC, ranh giới giờ VN |
| `san-pham` | id sản phẩm (`/^[a-z0-9]{1,64}$/`) | Chỉ giữ nếu sản phẩm thuộc gian hàng **và** đã có trong ≥ 1 đơn (danh sách `products` của dropdown) |
| `khach` (ADR-048) | userId khách (`/^[a-z0-9]{1,64}$/`) | Không lọc. Chỉ giữ nếu khách có **≥ 1 đơn (mọi trạng thái)** tại gian hàng (`order.findFirst` dưới `withTenant`); khách lạ / tenant khác → **bỏ bộ lọc** (không lỗi). Khi giữ, loader trả `OrderListPage.customer = { userId, fullName, email }` (chỉ họ tên + email — ADR-041). Link vào từ menu "Xem đơn của khách" trang Khách hàng ([[02-System-Specs/Studio-Customers-Specs\|Studio-Customers-Specs]] §5) |
| `sap-xep` | `moi-nhat` \| `cu-nhat` \| `tong-giam` \| `tong-tang` | `moi-nhat` (`createdAt desc, id desc`); sắp theo tổng có khoá phụ `createdAt desc, id desc` |
| `trang` | số nguyên 1…1.000.000 | 1; vượt số trang → **kẹp về trang cuối** |
| `so-dong` | 10 / 20 / 50 / 100 (`ORDER_LIST_PAGE_SIZES`) | **20** (`ORDER_LIST_DEFAULT_PAGE_SIZE`); giá trị khác → 20 |

`buildOrderListSearch(query, patch)` dựng lại query string: bỏ giá trị mặc định (`moi-nhat`, trang 1, 20 dòng); đổi bất kỳ bộ lọc nào mà không
truyền `page` → về trang 1 ✅.

### 2.2. Số liệu kèm danh sách

- `total`, `pageCount` (≥ 1 kể cả khi 0 đơn), `page` thực tế.
- `statusCounts` — số đơn theo **trạng thái hiệu lực**, áp **mọi bộ lọc khác trừ trạng thái** (q, khoảng ngày, sản phẩm, khách, remedy); `ALL` = tổng.
  Cách tính (ADR-047): SQL `CASE WHEN status = 'PENDING' AND expiresAt < now THEN 'EXPIRED' ELSE status END … GROUP BY 1` ✅.
- `refundRequestCount` / `refundRequestOverdueCount` — đơn có dòng `remedyStatus = REFUND_REQUESTED` trên **toàn gian hàng, không áp bộ lọc**;
  quá hạn = `remedyChosenAt` cũ hơn `REMEDY_REFUND_SLA_DAYS` ngày (ADR-039) ✅.
- `products` — sản phẩm của gian hàng đã có trong ≥ 1 đơn (mọi trạng thái), sắp theo tên ✅.
- `customer` (ADR-048) — khách đang lọc qua `?khach=` (đã kiểm thuộc gian hàng) hoặc `null` ✅.

**Cách truy vấn (ADR-047 mục 1)** ✅ code: Prisma không biểu diễn được `unaccent` nên lọc (tenant, remedy, khoảng ngày, sản phẩm, `q`, trạng thái
hiệu lực) + đếm + lấy id của trang chạy bằng `$queryRaw` (tham số hoá) trong **cùng một `withTenant`**, `tenantId` tường minh; sau đó Prisma
`findMany({ where: { tenantId, id: { in: pageIds } } })` nạp ≤ 100 đơn và giữ đúng thứ tự id. `q` khớp `orders.code`, hoặc `EXISTS` trên `users.email` /
`user_profiles.fullName` của khách. Chưa có index trigram — chấp nhận khi số đơn mỗi gian hàng còn nhỏ (BACKLOG).

### 2.3. Mỗi dòng (`OrderListItem`)

Mã, `createdAt`, `paidAt`, trạng thái hiệu lực, `totalVnd`, **khách = họ tên + email** (không SĐT/địa chỉ — ADR-041; `fullName` null khi chưa
có hồ sơ → UI "Chưa có họ tên"), tên các tài liệu (`titleSnapshot`), cờ yêu cầu hoàn tiền + quá hạn, `allowedActions` ✅. Từ ADR-068 thêm **`statusTargets`**
(`OrderStatusTarget[]`) và **`provider`** (cổng khách đã chọn — để hộp đổi trạng thái biết có nhắc cảnh báo khi huỷ) ✅ code.

### 2.4. Thao tác hợp lệ — `orderStatusTargets` (ADR-068) + `orderAllowedActions` ✅ code 2026-11-25

**Menu "Thao tác" của dòng** (và khối "Thao tác đơn" ở chi tiết) từ ADR-068:

| Mục | Hiện khi | Gọi |
| :-- | :-- | :-- |
| **Xem chi tiết** | Luôn có | link chi tiết (giữ `?back=`) |
| **Đổi trạng thái…** | `statusTargets` khác rỗng | hộp `OrderStatusDialog` → `changeOrderStatusAction` |
| **Đánh dấu đã hoàn tiền…** | `allowedActions` có `refund` (hiệu lực **FULFILLED**) | hộp xác nhận → `markOrderRefundedAction` (không đổi) |

`statusTargets` = `orderStatusTargets(order, now)` theo **trạng thái hiệu lực**:

| Trạng thái hiệu lực | Lựa chọn trong hộp (thứ tự) |
| :-- | :-- |
| PENDING | Đã thanh toán · Huỷ đơn |
| EXPIRED | Đã thanh toán (xác nhận trễ) · Chưa thanh toán (mở lại) · Huỷ đơn |
| CANCELED | Chưa thanh toán (mở lại) |
| PAID / FULFILLED / REFUNDED | — (không có mục "Đổi trạng thái…") |

Luật khi thực hiện (server kiểm lại): [[02-System-Specs/Order-State-Machine|Order-State-Machine]] §3.14. Tóm tắt:
- **Đã thanh toán** — mọi cổng, **kể cả đơn đã hết hạn**, không cần khách báo chuyển (thay luật ADR-061 cho người bán; webhook không đổi). Dùng `markOrderPaid` (quyền tải,
  mã giảm giá, email cho khách).
- **Mở lại** — giữ giá, mã giảm giá, phương thức, `checkoutPayload`, `paymentRef`; hạn giữ mới = lúc mở lại + 72/48 giờ theo phương thức và **`holdStartedAt` = lúc mở lại**
  (ADR-068 mục 8 — khách chọn/đổi được phương thức, hạn mỗi phương thức tính từ mốc này); xoá mốc "khách báo đã chuyển" và mốc nhắc khách; **không** gửi email cho khách. Chặn: tài liệu ngừng bán / gian hàng không ACTIVE (`PRODUCT_UNAVAILABLE`), khách đã có quyền tải tài liệu qua đơn khác
  (`ALREADY_OWNED`), khách là chủ gian hàng (`CANNOT_BUY_OWN_PRODUCT`).
- **Huỷ đơn** — PENDING hoặc EXPIRED.
- **Ghi chú không bắt buộc** (≤ 500 ký tự, cắt) → **ghi chú nội bộ** của đơn (`order_notes`, §3.2 — **khách không thấy**) dạng `[Đổi trạng thái: {cũ} → {mới}] {ghi chú}`,
  và `confirmNote` khi chọn Đã thanh toán. Audit **không** chứa văn bản ghi chú.
- Lỗi khác: `ORDER_STATUS_NOT_CHANGEABLE` (lựa chọn không còn hợp lệ), `ORDER_ALREADY_PAID` (nguồn khác vừa áp đơn), `ORDER_CHANGED` (đơn vừa đổi song song) — đều 409, hiện
  trong hộp.

**`orderAllowedActions`** vẫn trả thứ tự `view`, `confirm`, `cancel`, `refund` (luật cũ: `confirm` = `canManuallyConfirmOrder`, `cancel` = hiệu lực PENDING) — giữ "cho tương
thích"; UI chỉ còn dùng `view` + `refund` ✅ code. ~~`confirm` → link `#order-actions` (form ghi chú bắt buộc); `cancel` → `cancelOrderAction`~~ (đã bỏ — ADR-068).

Luật trạng thái gốc: [[02-System-Specs/Order-State-Machine|Order-State-Machine]] §3.

### 2.5. "Khách báo đã chuyển" và "Giao dịch cần xử lý" (ADR-062 Q1, đợt 1 ADR-061) — working tree, chưa commit ✅ đọc code 2026-10-27

- **Xếp đầu danh sách:** mọi cách sắp xếp đều có tiền tố SQL `(o."customerDeclaredPaidAt" IS NOT NULL AND o."status" IN ('PENDING','EXPIRED')) DESC` (`DECLARED_PAID_FIRST_SQL`,
  `lib/order.ts`) → đơn khách đã báo chuyển mà chưa thanh toán **luôn lên đầu**, sau đó mới theo `?sap-xep=`. Điều kiện xét **trạng thái lưu trong DB** (không phải trạng
  thái hiệu lực).
- **Badge** `DeclaredPaidBadge` (`orders/_ui/declared-paid.tsx`, tone `info`): "Khách báo đã chuyển" (PENDING) hoặc "Khách báo đã chuyển · trước hạn" (EXPIRED). Hiện ở
  dòng danh sách và đầu trang chi tiết. `OrderListItem.customerDeclaredPaidAt`, `OrderDetailView.customerDeclaredPaidAt` mới.
- **Chi tiết đơn:** dòng "Khách báo đã chuyển lúc …" trong thông tin chung; khối nhắc `DeclaredPaidNotice` ngay trên form xác nhận thanh toán; dòng thời gian thêm 3 audit
  `ORDER_CUSTOMER_DECLARED_PAID`, `ORDER_CUSTOMER_DECLARED_PAID_UNDONE`, `ORDER_CANCELED_BY_CUSTOMER` (`ORDER_TIMELINE_AUDIT_ACTIONS`).
- **"Giao dịch cần xử lý"** (`/studio/{slug}/orders/giao-dich`): thêm loại **"Về sau hạn giữ đơn"** — giao dịch `MATCHED` mà đơn chưa `PAID`/`FULFILLED`/`REFUNDED`
  ([[02-System-Specs/Order-State-Machine|Order-State-Machine]] §3.11). Nhãn này cũng gán cho giao dịch khớp đơn đã **huỷ** (điều kiện chỉ là "chưa thanh toán") ✅ code.

---

## 3. Chi tiết đơn — `/studio/{slug}/orders/{orderId}` ✅ (`getOrderDetailView`)

- Đơn không thuộc gian hàng → `notFound("Không tìm thấy đơn hàng.")` (AppError 404) → trang 404 ✅.
- **Thông tin chung:** mã, ngày tạo, ngày thanh toán (giờ VN), trạng thái hiệu lực, `expiresAt`, tạm tính / giảm / tổng, mã giảm giá,
  `confirmNote`. Từ ADR-065 (2026-11-24, working tree) ✅ code: dòng **"Mã thanh toán SePay"** (`paymentRef`, font mono) ngay dưới "Mã đơn", chỉ khi khách đã chọn SePay —
  đó là nội dung chuyển khoản khách dùng, khác mã đơn ([[02-System-Specs/Payment-And-Billing|Payment-And-Billing]] §5M).
- **Kênh thanh toán** `paymentChannel` (suy ra, không có cột riêng):

| `kind` | Điều kiện (theo thứ tự) |
| :-- | :-- |
| `UNPAID` | `paidAt` null — kèm `provider` khách đã chọn lúc checkout (có thể null) |
| `PROVIDER` | Có giao dịch tenant `matchStatus = MATCHED` — kèm cổng, mã giao dịch, thời điểm |
| `MANUAL` ("Xác nhận thủ công") | Không có giao dịch MATCHED (giao dịch cổng luôn ưu tiên) **và** (`confirmNote` có giá trị **hoặc** có audit `ORDER_MANUALLY_CONFIRMED` của đơn — ADR-068 mục 9 ✅ code, dùng lại các dòng audit đã nạp cho dòng thời gian, không cột mới). Giới hạn: audit không ghi được (vd bảng thiếu) **và** không ghi chú → vẫn `UNKNOWN` |
| `FREE` | Đơn 0đ |
| `UNKNOWN` | Đã thanh toán nhưng không thuộc các trường hợp trên (dữ liệu cũ) |

- **Dòng tài liệu:** `unitPriceVnd` = **đơn giá lúc đặt** (đã gồm giá khuyến mãi nếu đang sale — giá niêm yết trước khuyến mãi **không** có snapshot),
  `discountVnd = max(0, unitPrice − finalPrice)`, `couponCode` (mã của đơn, chỉ khi dòng có giảm), `finalPriceVnd`; kèm entitlement (lượt đã
  dùng / giới hạn — `0` = không giới hạn, thu hồi, các mốc remedy ADR-039).
- **Giao dịch:** giao dịch cổng thanh toán **tenant** của đơn, mới nhất trước, **không trả `rawPayload`**.
- **Lịch sử khách tại gian hàng** `customerHistory` — chỉ đơn **> 0đ có `paidAt`**, mọi trạng thái (theo định nghĩa ADR-043): `orders`,
  `spentVnd` (doanh thu **gộp**, gồm đơn sau này hoàn), `refundedVnd` (phần đã hoàn — tách riêng), `avgOrderVnd = floor(spent / orders)` hoặc null.
- **Cờ hoàn tiền** `refundRequested/At/Overdue` như danh sách; `allowedActions` và **`statusTargets`** (ADR-068) như §2.4.
- **Hiển thị tiền:** giá/tổng của một đơn hoặc một dòng dùng `formatOrderPrice` (0 → "Miễn phí"); số tổng hợp (Lịch sử khách, giảm giá, giao dịch) dùng `formatOrderVnd` (0 → "0 đ") ✅ `orders/_ui/order-format.ts`.
- **Bố cục thao tác** ("Bổ sung ADR-046"): cấp thêm lượt / thu hồi quyền tải đặt theo từng dòng tài liệu ở cột chính; hộp "Thao tác đơn" ~~chỉ gồm xác nhận / đánh dấu đã hoàn / huỷ~~ — từ ADR-068 gồm khối "Trạng thái đơn" + "Đánh dấu đã hoàn tiền" (§3.3) ✅ code.

### 3.1. Lịch sử đơn (timeline) — chỉ dựng từ dữ liệu có sẵn ✅

Loader trả **cũ → mới**; UI đảo ngược (**mới nhất trên**). Nguồn:

| Sự kiện | Nguồn |
| :-- | :-- |
| Tạo đơn | `orders.createdAt` (kèm tổng tiền) |
| Nhận giao dịch | `tenant_payment_transactions` của đơn (cổng, số tiền, trạng thái khớp, mã GD) |
| Đã thanh toán / nhận miễn phí | `orders.paidAt` |
| Hết hạn | `expiresAt` khi trạng thái hiệu lực EXPIRED và chưa thanh toán |
| Huỷ | `orders.updatedAt` khi CANCELED — **không có cột `canceledAt`**; CANCELED là trạng thái cuối nên lần cập nhật cuối = lúc huỷ (suy luận trong code). **Từ ADR-068** CANCELED không còn là trạng thái cuối (mở lại được) — comment code chưa sửa; sau khi mở lại, mốc "Huỷ" và "Hết hạn" suy ra **biến mất** khỏi dòng thời gian, chỉ còn dòng audit (`ORDER_CANCELED_BY_SELLER`/`_BY_CUSTOMER`, `ORDER_REOPENED_BY_SELLER`); đơn bị người bán huỷ **trước** ADR-068 (hàm `cancelOrder` cũ không ghi audit) thì mất dấu lần huỷ ✅ code (KB-Audit §51) |
| Tài liệu bị gỡ (mở remedy) | `entitlements.remedyRequestedAt` |
| Audit | `audit_logs` (L1): `tenantId` = gian hàng **và** target là đơn này hoặc entitlement của đơn; **12** action (`ORDER_TIMELINE_AUDIT_ACTIONS`, ✅ code 2026-11-25): `ORDER_MANUALLY_CONFIRMED`, `ORDER_REFUNDED`, `COUPON_OVERUSED`, `ENTITLEMENT_EXTRA_GRANTED`, `ENTITLEMENT_REVOKED`, `REMEDY_FINAL_DOWNLOAD_CHOSEN`, `REMEDY_REFUND_REQUESTED`, 3 action ADR-061/062 (§2.5) và 2 action ADR-068 `ORDER_CANCELED_BY_SELLER` ("Người bán huỷ đơn"), `ORDER_REOPENED_BY_SELLER` ("Người bán mở lại đơn"); nhãn lấy từ `AUDIT_ACTION_LABELS`; tối đa 200 dòng; **không IP/User-Agent**. Người thực hiện: thành viên gian hàng → họ tên/email; scope CUSTOMER → "Khách hàng"; không actor → "Hệ thống"; còn lại → "Quản trị hệ thống" |
| Ghi chú nội bộ (ADR-047) | `order_notes` (L2, `withTenant` riêng): kind `note` (+`noteId`), nhãn "Ghi chú nội bộ · {họ tên ?? email tác giả}" — tác giả null → "Tài khoản đã xoá"; `detail` = nội dung (§3.2) |
| Email | `email_send_log` (L1): chỉ `order_paid` ("Email xác nhận thanh toán gửi khách") và `remedy_refund_requested` ("… gửi chủ gian hàng"), tiêu đề chứa mã đơn, người nhận ∈ {email khách, email chủ gian hàng}, sau `createdAt`; tối đa 50; **không trả địa chỉ người nhận**, chỉ "Đã gửi"/"Gửi thất bại" |

Email `new_sale` và email remedy gửi khách **không** lọc được theo đơn (tiêu đề chỉ có tên tài liệu) → không đưa vào timeline ✅ (JSDoc). Bảng
`audit_logs` chưa tồn tại → bỏ qua nhánh audit (`isAuditTableMissing`).

### 3.2. Ghi chú nội bộ (ADR-047 mục 2) ✅ code · ✅ đọc migration

| Luật | Thực thi |
| :-- | :-- |
| Chỉ gian hàng (OWNER) thêm/xem; **khách không bao giờ thấy**; public/System Admin không có đường đọc | RLS `order_notes` chỉ nhánh tenant + `system_job`; mọi hàm `lib/order-note.ts` dưới `withTenant`; trang chi tiết chỉ OWNER |
| Nội dung 1–1000 ký tự, văn bản thuần | zod (NFC + trim) ở server; CHECK `order_notes_body_length` ở DB; UI hiện dạng text (`whitespace-pre-wrap`, không HTML) |
| Gắn đúng đơn của gian hàng | Server kiểm `order.findFirst({ id, tenantId })` → 404; policy `tenant_insert` kiểm lại `EXISTS` đơn cùng tenant |
| **Không sửa** | Không có policy UPDATE + `REVOKE UPDATE` → UPDATE từ app bị chặn |
| **Chỉ tác giả xoá** | `deleteMany` với `authorId = người gọi` trong WHERE; không phải tác giả → `ORDER_NOTE_FORBIDDEN` 403; không có / khác tenant / khác đơn → `ORDER_NOTE_NOT_FOUND` 404. Policy DELETE chỉ giới hạn theo tenant (scope tenant không mang user id) |
| Hiện trong "Lịch sử đơn" kèm giờ + người viết | Timeline kind `note` (§3.1); tối đa 200 ghi chú/đơn |
| Audit không lưu nội dung | `ORDER_NOTE_ADDED` / `ORDER_NOTE_DELETED`, metadata `{ noteId }` ([[02-System-Specs/Audit-Log-Specs|Audit-Log-Specs]] §4) |
| Tài khoản tác giả bị xoá | `authorId` SET NULL → hiện "Tài khoản đã xoá"; `canDelete = false` với mọi người → **không ai xoá được** (BACKLOG) |
| Code lên trước migration | Đọc → `notesAvailable: false` (UI hiện Notice "tạm chưa sẵn sàng", ẩn form); thêm/xoá → `ORDER_NOTES_UNAVAILABLE` 503 |

Contract hàm/action: [[03-API-Contracts/Endpoint-Directory|Endpoint-Directory]] §23.5. Bảng + RLS: [[03-API-Contracts/Database-Schema-Reference|Database-Schema-Reference]] §3.2/§7.

Từ ADR-068: ghi chú nhập trong hộp "Đổi trạng thái…" cũng thành một ghi chú nội bộ (tác giả = người đổi), tiền tố `[Đổi trạng thái: {cũ} → {mới}]`; nhãn trạng thái tiếng Việt
("Chờ thanh toán", "Đã hết hạn", "Đã huỷ"…). Ghi **sau** khi đổi trạng thái đã commit — lỗi ghi chú (vd `order_notes` chưa có) chỉ log, thao tác chính vẫn thành công ✅ code.
Vì nội dung tổng = tiền tố + ghi chú ≤ 500, luôn dưới giới hạn 1000 ký tự của bảng ✅ (suy từ code).

### 3.3. Khối "Thao tác đơn" trên trang chi tiết (ADR-068) ✅ code / ❓ trình duyệt

- Hiện khi có `statusTargets` hoặc `refund`; không có gì → câu "Không còn thao tác nào cho đơn ở trạng thái “{nhãn}”." (như trước).
- **"Trạng thái đơn"** (khi `statusTargets` khác rỗng): mô tả "Xác nhận đã nhận tiền, mở lại hoặc huỷ đơn. Đối chiếu sao kê trước khi xác nhận thanh toán.", khối nhắc
  `DeclaredPaidNotice` (nếu khách đã báo chuyển), rồi nút **"Đổi trạng thái…"** (`OrderStatusButton`, full-width) mở hộp chung với danh sách. Dữ liệu hộp: mã đơn, tổng tiền,
  nhãn trạng thái hiện tại, `targets`, `expired`, `autoProvider` (từ `paymentChannel.provider`; chưa chọn cổng → `null` → vẫn nhắc cảnh báo khi huỷ).
- **"Đánh dấu đã hoàn tiền"** (đơn FULFILLED) giữ nút 2 bước cũ (`MarkRefundedButton`), ngăn cách bằng viền trên khi đứng sau khối trạng thái.
- Trình bày hộp: [[04-Operations-Runbooks/UI-Design-System|UI-Design-System]] §20.9.

---

## 4. Ranh giới dữ liệu (L1/L2) ✅ đọc code

- **L2** (`orders`, `order_items`, `entitlements`, `tenant_payment_transactions`, `tenant_members`, `products`) đọc trong **một `withTenant`**,
  kèm `tenantId` tường minh trong `where`. `order_notes` (L2, ADR-047) đọc ở một `withTenant` **riêng** (lỗi bảng thiếu không làm hỏng transaction đọc đơn).
- **L1** qua quan hệ / `getPrismaClient()`: `users.email` + `user_profiles.fullName` (chỉ 2 trường này), `audit_logs`, `email_send_log`,
  `tenants.owner.email`, `users` (tên thành viên gian hàng cho actor audit) — phạm vi giới hạn bằng `tenantId` + target của đúng đơn.
- System Admin **không** có route mới đọc đơn của tenant (§7.9 giữ nguyên).
- Cô lập tenant chéo cho hai loader mới có trong `order.test.ts` (§7) ✅ đọc test; chạy thật 🟡.

---

## 5. Quy ước: escape giá trị người dùng trong Prisma `contains` (mới, ADR-046) ✅

- Prisma **không** escape ký tự wildcard của LIKE trong `contains`/`startsWith`/`endsWith` — comment code ghi đã kiểm thực tế `contains: "%"`
  khớp mọi dòng 🟡 (Hiếu kiểm, Long chưa chạy lại).
- Quy ước: input người dùng đưa vào Prisma `contains` **phải** qua `escapeContainsValue` (`apps/web/lib/prisma-contains.ts` — escape `\` rồi
  `%`, `_`; Postgres LIKE/ILIKE mặc định dùng `\` làm ký tự escape). Đang áp (grep 2026-10-18): `lib/home.ts` (3 chỗ — PinPicker gian
  hàng/tài liệu/danh mục), `app/admin/users/page.tsx` (tìm email) ✅. `lib/order.ts` dùng hàm này ở ADR-046, **từ ADR-047 chuyển sang SQL thô** (dòng dưới).
- SQL thô (`$queryRaw`) dùng `escapeLikePattern` (`lib/shop.ts`) kèm `ESCAPE '\'` tường minh — nay gồm `listOrdersPage` (ADR-047).
- Ngoại lệ có chủ đích: `subject: { contains: order.code }` trong timeline — mã đơn do hệ thống sinh (`[A-Z]{3,4}` + 6 ký tự base32), không
  chứa ký tự wildcard ✅ (`packages/core/src/order/code.ts`).
- Grep 2026-10-18: không còn `contains:` nào trong `apps/web` nhận input người dùng mà chưa escape ✅ (chỉ đếm dạng `contains:` trên một dòng).

---

## 6. Giao diện (tóm tắt — chi tiết [[04-Operations-Runbooks/UI-Design-System|UI-Design-System]] §20) ✅

- **Danh sách:** thanh lọc là form GET (`OrderFilterForm`) — không JS vẫn gửi được; có JS thì bỏ ô rỗng/mặc định rồi `router.push`. Ô tìm,
  dropdown Trạng thái (kèm số đếm), Hoàn tiền, Tài liệu, Ngày tạo đơn (`DashboardDateRangePicker` dùng chung ở `admin/_ui/date-range-picker.tsx`, chế độ `formMode` + "Mọi thời gian" — **cần JS**),
  Sắp xếp (dưới `xl`), Số dòng; "Xoá lọc". Khi lọc theo khách (ADR-048): dòng "Đang xem đơn của khách {họ tên ?? email}" + ô ẩn `khach` (giữ khi lọc tiếp)
  + link "Bỏ lọc khách"; `?back=` của chi tiết giữ cả `khach`. Notice yêu cầu hoàn tiền. Bảng từ `xl`, thẻ dưới `xl`; sắp xếp bằng tiêu đề cột; menu Thao tác
  từng dòng; phân trang `?trang=`.
- **Từ ADR-068:** menu dòng "Xem chi tiết" · "Đổi trạng thái…" · "Đánh dấu đã hoàn tiền…" (§2.4); hộp `OrderStatusDialog` dùng chung danh sách + chi tiết
  (UI-Design-System §20.9).
- **Chi tiết:** `MainAsideGrid` — cột chính Thông tin chung + Khách, Tài liệu trong đơn, Giao dịch; cột phụ Thao tác đơn ("Đổi trạng thái…" + hoàn tiền 2 bước — §3.3),
  Lịch sử khách hàng, **Ghi chú nội bộ** (ADR-047 — `OrderNotesCard` + `AddOrderNoteForm`), Lịch sử đơn (ghi chú hiện ở đây, nút
  `DeleteOrderNoteButton` chỉ với tác giả). Nút quay lại giữ bộ lọc qua `?back=` (whitelist khoá, không open redirect).
- `loading.tsx` (danh sách + chi tiết), `error.tsx` (chung cho cả nhánh `orders/`).

---

## 7. Test

- **Không thêm test** — `pnpm test:count` = **94/94 unit, 55/55 integration** ✅ (Long chạy 2026-10-18, chỉ đếm) — chạm trần.
- Integration `apps/web/tests/integration/order.test.ts` nay kiểm **loader mới** `listOrdersPage`/`getOrderDetailView` ✅ đọc test: cô lập tenant (tenant B
  nhận 404 khi xem đơn của A, danh sách B không có đơn A, tìm theo mã đơn A trả 0), escape `%`/`_` (`q: "%"` không khớp mọi đơn), `allowedActions`. Số
  case **không đổi**; chạy thật đạt 9/9 🟡 (Quốc báo).
- **ADR-047** thêm assertion vào **case có sẵn** "tenant A cannot read tenant B's orders…" (không thêm case) ✅ đọc test: tìm không dấu theo họ tên
  ("nguyen van thu", "NGUYỄN"; tenant B tìm "nguyen" = 0); ghi chú — trim nội dung, `canDelete` đúng tác giả, timeline có `note`, nội dung rỗng → 400,
  tenant B thêm vào đơn A → 404, INSERT trực tiếp chéo tenant bị RLS chặn, `withCustomer`/`withPublic`/tenant B đếm 0, UPDATE bị chặn, tenant B xoá →
  404, không phải tác giả xoá → 403, tác giả xoá được. Chạy thật sau migration **9/9** 🟡 (Quốc báo 2026-10-18).
- Kiểm (🟡 báo cáo): lint/typecheck/build đạt (Quốc chạy 2026-10-18); Hiếu đọc-only dữ liệu thật tenant `phongweb` đúng.
- **Chưa kiểm** ❓: UI thật với phiên OWNER, thử tenant chéo trên trình duyệt, nhánh timeline audit/email (chưa có dữ liệu), trình đọc màn hình.
- **ADR-068 (2026-11-25):** không thêm case — assert thêm trong `order.test.ts` (chạy 10/10 🟡 Quốc báo) + `state.test.ts`; `pnpm test:count` = **105/105, 69/69** ✅ (Long
  chạy). Hộp "Đổi trạng thái…" trên trình duyệt, production ❓.

---

## 8. Giới hạn đã biết (chi tiết `docs/BACKLOG.md` mục "Phát sinh trong đợt ADR-046" và ADR-047)

- Không thao tác hàng loạt, không xuất CSV đơn/khách (ADR-047 mục 3 — quyết định "không làm", không phải việc treo).
- Ghi chú của tài khoản đã xoá không ai xoá được — Quốc chốt 2026-10-18 **giữ như hiện tại** (MVP chỉ có OWNER nên thực tế không phát sinh; BACKLOG).
- Không có giá niêm yết gốc — cột "Đơn giá" là đơn giá lúc mua (DB không lưu giá niêm yết; "Bổ sung ADR-046" đính chính chữ "giá gốc" theo code).
- `OrderTimelineEvent` chưa có trường actor riêng (actor nằm trong chuỗi `detail`).
- Tìm `q` đã **không dấu** (ADR-047); chưa có index trigram cho `gieochu_unaccent(lower(..))` — cần khi gian hàng nhiều đơn (expand-only, Quốc duyệt; BACKLOG).
- `listOrders` / `getOrderDetail` / `effectiveStatusWhere` cũ **đã xoá** (ADR-047 mục 4) ✅ grep; giữ `OrderListFilters`, `parseOrderRemedyFilter`.

---

## 9. Liên kết

* [[02-System-Specs/Order-State-Machine|Order-State-Machine]] — trạng thái đơn, `effectiveOrderStatus`, `canManuallyConfirmOrder` ([Order-State-Machine.md](./Order-State-Machine.md))
* [[02-System-Specs/Abuse-Reports-Specs|Abuse-Reports-Specs]] — remedy / yêu cầu hoàn tiền ADR-039 ([Abuse-Reports-Specs.md](./Abuse-Reports-Specs.md))
* [[02-System-Specs/Audit-Log-Specs|Audit-Log-Specs]] — nhãn action audit ([Audit-Log-Specs.md](./Audit-Log-Specs.md))
* [[02-System-Specs/Studio-Dashboard-Specs|Studio-Dashboard-Specs]] — định nghĩa "chỉ đơn > 0đ", date range picker ([Studio-Dashboard-Specs.md](./Studio-Dashboard-Specs.md))
* [[03-API-Contracts/Endpoint-Directory|Endpoint-Directory]] §23 — contract loader ([Endpoint-Directory.md](../03-API-Contracts/Endpoint-Directory.md))
* [[04-Operations-Runbooks/UI-Design-System|UI-Design-System]] §20 ([UI-Design-System.md](../04-Operations-Runbooks/UI-Design-System.md))
* [[01-Architecture-Decisions/ADR-032-Studio-Orders-Unaccent-Search-Internal-Notes|ADR-032 KB (≙ ADR-047)]] ([ADR-032-Studio-Orders-Unaccent-Search-Internal-Notes.md](../01-Architecture-Decisions/ADR-032-Studio-Orders-Unaccent-Search-Internal-Notes.md))
* [[01-Architecture-Decisions/ADR-052-Studio-Order-Status-Change-Reopen-Late-Confirm|ADR-052 KB (≙ ADR-068)]] — "Đổi trạng thái…" đơn ([ADR-052-Studio-Order-Status-Change-Reopen-Late-Confirm.md](../01-Architecture-Decisions/ADR-052-Studio-Order-Status-Change-Reopen-Late-Confirm.md))
* Mã nguồn: `apps/web/lib/order.ts` (khối "ADR-046"/"ADR-047"), `apps/web/lib/order-note.ts`, `apps/web/lib/prisma-contains.ts`, `apps/web/app/studio/[tenantSlug]/orders/**`,
  `packages/db/prisma/migrations/20261018090000_adr045_order_notes/migration.sql`

*Quay lại: [[MOC-Home]] (../00-Index/MOC-Home.md)*

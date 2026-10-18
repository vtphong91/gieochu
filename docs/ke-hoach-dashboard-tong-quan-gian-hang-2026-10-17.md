---
tags: [ke-hoach, studio, dashboard, thong-ke, tenant]
date: 2026-10-17
---

# Kế hoạch: Dashboard Tổng quan gian hàng (`/studio/{tenantSlug}`) — ĐÃ CHỐT (ADR-043) — GĐ1 + GĐ2 XONG CODE

> **Tiến độ (Long ghi 2026-10-18 theo brief Quốc):** chủ dự án chốt §9 ngày 2026-10-18 → **ADR-043** + "Bổ sung ADR-043" trong
> [`DECISIONS.md`](DECISIONS.md). **GĐ0 ✅ · GĐ1 (dữ liệu, Hiếu) ✅ xong code · GĐ2 (UI, Phong) ✅ xong code · GĐ3 (tài liệu) ✅ Long ghi KB** —
> chưa commit/deploy, không migration. Quốc chạy lại lint/typecheck/build 2026-10-18 đạt; `pnpm test:count` = 94/94 unit, 55/55 integration.
> Chưa kiểm phiên OWNER thật, `/admin` sau refactor, bàn phím/trình đọc màn hình (BACKLOG mục "Phát sinh trong đợt ADR-043").
>
> **Kết quả chốt khác đề xuất ở thân tài liệu** (thân giữ nguyên làm lịch sử; nguồn đúng là ADR-043 + code + KB
> `obsidian-knowledge-base/02-System-Specs/Studio-Dashboard-Specs.md`):
> - Q1: thẻ chính hiện **cả hai** — "Doanh thu (gộp)" (cùng GMV ADR-037) và "Doanh thu thực nhận" (gộp − đơn đã hoàn); không phải "thuần ở thẻ chính".
> - Q2: hoàn tiền tính theo ngày khách trả (như đề xuất). Q4: so cùng độ dài (như đề xuất). Q9: ngưỡng 3. Q10: realtime, không cache.
>   Q11: có tuỳ chọn, ≤ 366 ngày. Q12: mặc định 30 ngày. Q14: Thứ Hai. Q13/Q15: để sau. Q16: dùng 1 unit + 1 integration, không nâng trần.
> - Q5/Q6 (§6): bảng 10 đơn **không lọc kỳ, mọi trạng thái**, nhưng **chỉ 4 cột: mã đơn, họ tên khách, đơn giá, thành tiền — không email**, không
>   cột tài liệu/trạng thái/thời gian.
> - Q7: khách quay lại = **≥ 2 đơn đã thanh toán** (> 0đ) tính tới hết kỳ — không phải "mua trước kỳ" (K3).
> - **Bổ sung ADR-043:** mọi số liệu tiền/đơn/khách mua **chỉ tính đơn > 0đ**; đơn 0đ thành thẻ "Lượt nhận tài liệu miễn phí"; top 5 bán chạy
>   loại đơn đã hoàn (vẫn gồm đơn 0đ).
> - Contract §8 thực tế: `latestOrders` (không phải `recentOrders`), tiền là `number` nguyên VND (không phải chuỗi BigInt), thêm `freeClaims`,
>   `netRevenueVnd`/`grossRevenueVnd` dạng `{ current, previous }`; không có B5 (giảm giá đã áp) và B6 (tỷ lệ thanh toán) trong bản đầu.
>   Xem `obsidian-knowledge-base/03-API-Contracts/Endpoint-Directory.md` §22.
>
> Người soạn: Long (tài liệu) theo brief của Quốc, 2026-10-17. Trạng thái ban đầu: bản đề xuất — chưa chốt, chưa có ADR, chưa code (đã thay bằng
> khối tiến độ ở trên).
>
> **Yêu cầu chủ dự án (2026-10-17):** trang Tổng quan Studio hiện quá đơn giản. Cần card thống kê **bán hàng, đánh giá, tài liệu** theo
> **tuỳ chọn thời gian** (hôm nay, hôm qua, tuần này, tháng này, quý này, năm nay — có thể thêm 7/30 ngày, khoảng ngày tuỳ chọn),
> **bảng top 10 đơn hàng mới**, biểu đồ trực quan. Tham khảo ảnh mẫu "Sales Performance Dashboard" hoặc style section "Hoạt động bán tài
> liệu (30 ngày)" của System Center (`/admin`, M12b/ADR-037). Mục tiêu: **trực quan, đúng số liệu**.
>
> **Nguyên tắc:** UX trước UI (`CLAUDE.md` mục "Nguyên tắc lập kế hoạch tính năng"). Dashboard là **dữ liệu nghiệp vụ**, không phải nội dung
> CMS — xem §7 PLAN_CHECK.
>
> **Ràng buộc liên quan:** ADR-010 (role `gieochu_app`, RLS), ADR-024 (layout), ADR-029 (RLS đọc/ghi, đánh giá), ADR-033 (`soldCount`),
> ADR-034 (một DB dùng chung), ADR-036 (trạng thái đơn hiệu lực), ADR-037 (định nghĩa thống kê M12b), ADR-038/039 (khoá kiểm duyệt, yêu
> cầu hoàn tiền), ADR-042 (app shell Studio) — `docs/DECISIONS.md`. Quy tắc bảo mật §7.9 (`CLAUDE.md`).
>
> **Mức xác minh:** ✅ Long đã đối chiếu code/schema trong working tree ngày 2026-10-17 · 🟡 suy ra từ comment/báo cáo, chưa kiểm
> runtime · ❓ cần môi trường thật hoặc cần chủ dự án/Quốc quyết. Mọi con số/định nghĩa ở §2–§4 là **đề xuất** cho tới khi chốt.

---

## 1. Hiện trạng

### 1.1. Trang `/studio/{tenantSlug}` đang hiện gì

| Khẳng định | Mức |
|---|---|
| File `apps/web/app/studio/[tenantSlug]/page.tsx`: tiêu đề `AdminPageHeader` (tên gian hàng, `/{slug} · trạng thái: {status}`), khối cảnh báo yêu cầu hoàn tiền (ADR-039) khi `pending > 0`, rồi lưới 4 thẻ. | ✅ |
| Thẻ 1 "Doanh thu 30 ngày" — `getOrderDashboardStats()` (`apps/web/lib/order.ts`): tổng `totalVnd` của đơn `status ∈ {PAID, FULFILLED}` có `paidAt ≥ now − 30×24h`. Tức là **đã loại đơn REFUNDED** và cửa sổ là **30×24 giờ trượt**, không theo ngày lịch giờ VN. | ✅ |
| Thẻ 2 "Đơn chờ xác nhận" — đếm `status = PENDING` và `expiresAt ≥ now` (snapshot hiện tại, không theo kỳ). | ✅ |
| Thẻ 3 "Sản phẩm bán chạy" — **placeholder cũ** hiện "—" kèm ghi chú "Cần M5/M6 — Sản phẩm, Giá" dù M5/M6 đã xong. | ✅ |
| Thẻ 4 "Đánh giá mới" — `countNewTenantReviews()` (`lib/review.ts`): số đánh giá tạo trong 7×24h gần nhất, mọi trạng thái. | ✅ |
| Thẻ tự viết (`StatCard` cục bộ, màu hex cứng), không biểu đồ, không bộ lọc kỳ, không so sánh kỳ trước, không bảng đơn. | ✅ |
| Quyền: `requireTenantMemberPage()` → `requireTenantMember(slug)` với `requiredRole` mặc định `OWNER`; `canManageTenant()` chỉ trả true cho `OWNER` → **chỉ OWNER vào được trang này** (STAFF bị 404). | ✅ |
| MVP chỉ tạo thành viên `OWNER` (comment schema `TenantMember`: "MVP only ever creates OWNER rows"). | 🟡 (comment schema, chưa quét DB) |

### 1.2. Nguồn dữ liệu có sẵn (schema `packages/db/prisma/schema.prisma`)

| Bảng | Cột dùng được | Lớp / truy cập | Mức |
|---|---|---|---|
| `orders` | `status` (PENDING/PAID/FULFILLED/EXPIRED/CANCELED/REFUNDED), `subtotalVnd`, `discountVnd`, `totalVnd` (Int), `couponCode`, `provider`, `paidAt`, `createdAt`, `expiresAt`, `code`, `customerId` | L2, `withTenant` | ✅ |
| `order_items` | `productId`, `titleSnapshot`, `unitPriceVnd`, `finalPriceVnd` | L2 (qua đơn) | ✅ |
| Quan hệ đơn – sản phẩm | `createOrder(customerId, tenantSlug, productId)` nhận **một** `productId` → mỗi đơn 1 dòng `order_items` | ✅ (chữ ký hàm); 🟡 "mỗi đơn 1 sản phẩm" theo comment `entitlement-remedy.ts` |
| `tenant_customers` | `firstOrderAt`, `lastOrderAt`, `ordersCount`, `totalSpentVnd`; **không có `createdAt`** (dòng chỉ tạo khi đơn đầu tiên PAID) | L2, `withTenant` | ✅ |
| `download_events` | `createdAt`, `fileId` (→ `product_files.productId`), `entitlementId?`, `shareLinkId?` | L2 | ✅ |
| `reviews` | `rating` 1–5, `status` VISIBLE/HIDDEN, `hiddenReason`, `hiddenAt`, `reply`, `repliedAt`, `moderationLockedAt`, `createdAt`; index `(tenantId, createdAt)` | L2 | ✅ |
| `products` | `status` DRAFT/PUBLISHED/ARCHIVED, `moderationLockedAt`, `soldCount` (cache ADR-033: đơn FULFILLED, entitlement chưa thu hồi — **luỹ kế**), `ratingSum/ratingCount`, `categoryId` → `document_categories` (L1) | L2 | ✅ |
| `entitlements` | `revokedAt`, `remedyStatus` (NONE/PENDING_CHOICE/FINAL_DOWNLOAD/REFUND_REQUESTED/REFUNDED), `remedyChosenAt`, `remedyResolvedAt`; index `(tenantId, remedyStatus)` | L2 | ✅ |
| `tenant_daily_stats` | `date` (ngày giờ VN), `ordersPaid`, `gmvVnd` (BigInt, **GMV gộp** — gồm cả đơn sau này hoàn tiền), `newCustomers`, `downloads`, `updatedAt` | **L1, không bật RLS**, `gieochu_app` có SELECT/INSERT/UPDATE/DELETE | ✅ (migration `20261016120000_m12b_tenant_daily_stats`) |
| `audit_logs` | action `ORDER_REFUNDED` (có `tenantId`, `createdAt`) | L1, Studio → Hoạt động đọc theo `tenantId` (OWNER) | ✅ (action có trong `packages/core/src/audit`) |
| **Không có** | cột `refundedAt` trên `orders`; địa chỉ/khu vực khách; giá vốn/chi phí | — | ✅ |

**Index hiện có liên quan:** `orders` chỉ `@@index([tenantId])`, `@@index([customerId])` — **không** có `(tenantId, paidAt)`/`(tenantId, createdAt)`;
`download_events` chỉ `(tenantId)`, `(fileId)`; `reviews` có `(tenantId, createdAt)`. ✅

### 1.3. Helper sẵn có

| Helper | Làm gì | Mức |
|---|---|---|
| `lib/tenant-stats.ts` | Job `stats.aggregate` ghi `tenant_daily_stats` dưới `withSystemJob`; export `vnDateString()`, `addDays()`, `isStatsTableMissing()`; SQL mẫu quy đổi giờ VN `(col AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Ho_Chi_Minh'` | ✅ |
| `lib/admin-stats.ts` | `getAdminStatsOverview({ days })` — chỉ đọc `tenant_daily_stats` (L1) bằng `getPrismaClient()`, cửa sổ kết thúc **hôm qua**, trả `totals`/`prevTotals`/`series`/`topTenants`, tiền dạng chuỗi BigInt | ✅ |
| `lib/order.ts` | `getOrderDashboardStats`, `listOrders(tenantId, filters)` (gồm `customer.email`, trạng thái hiệu lực ADR-036, cờ `refundRequested`), `getOrderDetail` | ✅ |
| `lib/review.ts` | `countNewTenantReviews`, `countReviewsNeedingAttention` (VISIBLE và `reply = null` — badge sidebar), `listTenantReviews` | ✅ |
| `lib/entitlement-remedy.ts` | `countPendingRefundRequests(tenantId)` → `{ pending, overdue }` | ✅ |
| `lib/product-sold-count.ts` | `recomputeProductSoldCounts()` — chỉ ghi cache `soldCount`, không có hàm đọc | ✅ |
| `admin/_ui/sales-stats.tsx` | `SalesStatsSection` (KPI + % so kỳ trước, biểu đồ cột HTML `role="img"` + bảng `<details>`, top 5), `SalesStatsSkeleton`, `parseSalesChartMetric` (`?chi-so=gmv|don`). Các khối con `KpiCard`, `DailyChart`, `DailyTable`, `computeChange`, `formatVndCompact` là hàm **nội bộ, không export**. | ✅ |
| `admin/_ui/kit.tsx` | `AdminPageHeader`, `DataTable`/`Tr`/`Td`, `TableCard`, `EmptyState`, `Notice`, `Badge`, `PrimaryLinkButton`, `GhostLinkButton`… (Studio đã import kit này) | ✅ |
| `DISPLAY_TIME_ZONE = "Asia/Ho_Chi_Minh"` (`packages/core/src/settings/system-settings.ts`) | ✅ |

### 1.4. RLS và `tenant_daily_stats`

- Dữ liệu L2 (orders, reviews, products, entitlements, download_events, tenant_customers) phải đọc qua `withTenant(tenantId, tx => …)`
  (ADR-010). `withTenant` đặt `app.scope='tenant'` + `app.tenant_id` bằng `set_config(..., true)` trong cùng transaction nên **cả
  `$queryRaw`** chạy trong `tx` cũng chịu RLS. ✅ (`packages/db/src/rls.ts`; mẫu `$queryRaw` trong transaction có ở `lib/shop.ts`, `lib/home.ts`)
- `tenant_daily_stats` là L1 **không RLS**: về kỹ thuật app đọc được mọi dòng của mọi tenant; tenant đọc "của mình" chỉ được bảo vệ bằng
  điều kiện `where tenantId` trong code — **không có lớp RLS phòng thủ thứ hai**. ✅
- **Đề xuất an toàn:** dashboard Studio **không** đọc `tenant_daily_stats` ở bản đầu; tính realtime từ bảng L2 qua `withTenant` (§4). Nếu
  sau này cần (kỳ "năm nay" chậm), chỉ đọc qua một hàm duy nhất nhận `tenantId` từ `requireTenantMember()` (không từ URL/query), có test
  cô lập tenant — và phải chấp nhận khác định nghĩa (GMV gộp) — cần Quốc duyệt.

---

## 2. Danh mục chỉ số khả thi với dữ liệu thật

Ký hiệu kỳ: **[S, E)** = khoảng thời điểm UTC tương ứng ranh giới ngày giờ VN (§3). "Snapshot" = trạng thái hiện tại, không theo kỳ.
Cột "Khả thi": ✅ ngay với schema hiện tại · ⚠️ được nhưng có giới hạn · ❌ không có dữ liệu.

### 2.1. Bán hàng

| # | Chỉ số | Định nghĩa đề xuất | Nguồn | Khả thi |
|---|---|---|---|---|
| B1 | **Doanh thu** | Phương án A **gộp** (khớp ADR-037/`tenant_daily_stats`): Σ `totalVnd` của đơn có `paidAt ∈ [S,E)`, mọi trạng thái. Phương án B **thuần theo nhóm** (khớp thẻ hiện tại): như A nhưng loại đơn hiện `status = REFUNDED`. Đề xuất: **thẻ chính hiện B**, dòng phụ "Gộp X · Đã hoàn Y". → **Câu hỏi Q1.** `totalVnd` là tiền khách trả **sau giảm giá**. | `orders` | ✅ |
| B2 | Đơn đã thanh toán | Số đơn có `paidAt ∈ [S,E)` (cùng lựa chọn gộp/thuần như B1). | `orders` | ✅ |
| B3 | Giá trị đơn TB | B1 ÷ B2, làm tròn xuống đồng (số nguyên); B2 = 0 → "—". | tính từ B1/B2 | ✅ |
| B4 | Tài liệu đã bán (lượt) | Số `order_items` thuộc đơn ở B2. **Vì mỗi đơn 1 sản phẩm nên B4 = B2** → không làm thẻ riêng (khác ảnh mẫu "Số lượng bán"). Thay bằng **"Số tài liệu khác nhau đã bán"** = COUNT DISTINCT `productId`. | `order_items` ⨝ `orders` | ✅ (🟡 giả định 1 đơn 1 dòng) |
| B5 | Giảm giá đã áp | Σ `discountVnd` của đơn ở B2; số đơn có `couponCode`. | `orders` | ✅ |
| B6 | Đơn tạo mới trong kỳ + tỷ lệ thanh toán | Số đơn `createdAt ∈ [S,E)`; tỷ lệ = số đơn đó có `paidAt` ÷ tổng. | `orders` | ✅ |
| B7 | Đơn chờ thanh toán | **Snapshot**: `status = PENDING` và `expiresAt ≥ now` (giữ đúng định nghĩa thẻ hiện tại, ADR-036). | `orders` | ✅ |
| B8 | Đơn đã hoàn tiền | Theo nhóm: số/tiền đơn có `paidAt ∈ [S,E)` và hiện `status = REFUNDED`. **Theo thời điểm hoàn** không làm được trực tiếp: `orders` không có `refundedAt`; chỉ có `audit_logs.createdAt` action `ORDER_REFUNDED` (L1) hoặc `entitlements.remedyResolvedAt` (chỉ luồng ADR-039). → Q2. | `orders` (+ `audit_logs`) | ⚠️ |
| B9 | Yêu cầu hoàn tiền đang chờ / quá hạn | **Snapshot**: tái dùng `countPendingRefundRequests()` (`REFUND_REQUESTED`, quá `REMEDY_REFUND_SLA_DAYS`). | `entitlements` | ✅ |
| B10 | Tỷ lệ hoàn | B8 (số đơn) ÷ B2 gộp. | tính | ⚠️ (phụ thuộc Q2) |
| B11 | Doanh thu theo danh mục | Σ B1 nhóm theo `products.categoryId` → tên `document_categories`. Lưu ý: dùng danh mục **hiện tại** của sản phẩm (đơn không chụp danh mục); sản phẩm chưa có danh mục → "Chưa phân loại". | `order_items` ⨝ `products` ⨝ `document_categories` | ⚠️ (đề xuất để GĐ sau) |
| B12 | So sánh % với kỳ trước | Cho B1, B2, B3, K1, R1, T5: `(cur − prev) ÷ prev`; `prev = 0` → hiện "Mới" thay vì %. Cùng cách `computeChange` ở `sales-stats.tsx`. | tính | ✅ |

### 2.2. Khách

| # | Chỉ số | Định nghĩa đề xuất | Nguồn | Khả thi |
|---|---|---|---|---|
| K1 | Khách mới | Số `tenant_customers` có `firstOrderAt ∈ [S,E)` (khớp ADR-037 "Duyệt khi triển khai M12b"). | `tenant_customers` | ✅ |
| K2 | Khách mua trong kỳ | COUNT DISTINCT `customerId` của đơn ở B2. | `orders` | ✅ |
| K3 | Khách quay lại % | Trong K2, số khách có `firstOrderAt < S` (đã mua trước kỳ) ÷ K2. → Q7 nếu muốn định nghĩa khác (vd ≥ 2 đơn trong kỳ). | `orders` ⨝ `tenant_customers` | ✅ |
| K4 | Tổng khách (luỹ kế) | **Snapshot**: COUNT `tenant_customers` của tenant. | `tenant_customers` | ✅ |

### 2.3. Đánh giá

| # | Chỉ số | Định nghĩa đề xuất | Nguồn | Khả thi |
|---|---|---|---|---|
| R1 | Đánh giá mới | Số `reviews` có `createdAt ∈ [S,E)`, mọi trạng thái (khớp thẻ hiện tại). Lưu ý `upsertMyReview` cho sửa — sửa không đổi `createdAt` (🟡 chưa kiểm). | `reviews` | ✅ |
| R2 | Điểm TB trong kỳ | AVG `rating` của đánh giá ở R1 **chỉ `VISIBLE`** (đánh giá bị ẩn, gồm ẩn do hoàn tiền, không kéo điểm). 1 chữ số thập phân. → Q8. | `reviews` | ✅ |
| R3 | Phân bố 1–5 sao | Đếm theo `rating` của tập R2; hiện số + % (không chỉ màu). | `reviews` | ✅ |
| R4 | Chưa trả lời | **Snapshot**: `VISIBLE` và `reply = null` — tái dùng `countReviewsNeedingAttention()` (khớp badge sidebar). | `reviews` | ✅ |
| R5 | Bị ẩn | Trong kỳ: `hiddenAt ∈ [S,E)`; kèm snapshot số đang khoá kiểm duyệt (`moderationLockedAt ≠ null`). | `reviews` | ✅ |
| R6 | Điểm TB toàn gian hàng | **Luỹ kế**: Σ`ratingSum` ÷ Σ`ratingCount` trên `products` (cache do `recomputeProductRatings`; tập đánh giá tính vào cache 🟡 chưa kiểm). | `products` | ✅ |

### 2.4. Tài liệu

| # | Chỉ số | Định nghĩa đề xuất | Nguồn | Khả thi |
|---|---|---|---|---|
| T1 | Số tài liệu theo trạng thái | **Snapshot**: đếm `PUBLISHED` (công khai), `DRAFT` (nháp), `ARCHIVED` (lưu trữ); riêng "Khoá kiểm duyệt" = `moderationLockedAt ≠ null` (ADR-038). | `products` | ✅ |
| T2 | Lượt tải | Số `download_events` có `createdAt ∈ [S,E)` (khớp `downloads` của ADR-037; gồm cả tải qua share link). | `download_events` | ✅ |
| T3 | Top 5 bán chạy **trong kỳ** | Nhóm `order_items.productId` của đơn ở B2, sắp theo số lượt rồi doanh thu; tên lấy `products.title` hiện tại (fallback `titleSnapshot`). | `order_items` ⨝ `orders` | ✅ |
| T4 | Đã bán luỹ kế | `products.soldCount` (ADR-033, chỉ FULFILLED chưa thu hồi). Hiện cạnh T3 với nhãn "từ trước tới nay" để không nhầm với số trong kỳ. | `products` | ✅ |
| T5 | Top tài liệu theo đánh giá | Luỹ kế: `ratingSum/ratingCount`, chỉ sản phẩm có `ratingCount ≥ 3` (ngưỡng đề xuất — Q9), tối đa 5. | `products` | ✅ |
| T6 | Top tài liệu theo lượt tải trong kỳ | `download_events` ⨝ `product_files` nhóm theo `productId`. | `download_events` | ✅ (đề xuất để GĐ sau) |

### 2.5. Chỉ số trong ảnh mẫu **không đưa vào**

| Chỉ số ảnh mẫu | Lý do | Mức |
|---|---|---|
| Top doanh thu theo **khu vực** | Không có địa chỉ/khu vực khách trên `orders`/`users` liên quan đơn — cần thu thập dữ liệu mới (đụng dữ liệu cá nhân). | ✅ (không có cột) |
| **Biên lợi nhuận** | Không có giá vốn/chi phí; phí cổng thanh toán không lưu theo đơn. | ✅ |
| **Số lượng bán** (tách khỏi số đơn) | 1 đơn = 1 sản phẩm → trùng số đơn; thay bằng B4 "số tài liệu khác nhau". | ✅/🟡 |
| Donut theo danh mục (%) | Làm được (B11) nhưng nhiều gian hàng chỉ 1–2 danh mục → ít giá trị; đề xuất GĐ sau, dạng thanh ngang có %. | — |
| Đường "số đơn theo tháng" riêng | Gộp vào biểu đồ chính bằng công tắc `?chi-so=doanh-thu|don` (cùng mẫu admin). | — |

---

## 3. Bộ lọc thời gian

**Quy ước:** mọi ranh giới tính theo ngày giờ VN (`DISPLAY_TIME_ZONE`, UTC+7 cố định, không DST), quy về thời điểm UTC để so sánh với
cột `TIMESTAMP(3)` lưu UTC (cùng cách `tenant-stats.ts`). "now" = thời điểm render. Tuần bắt đầu **Thứ Hai** (đề xuất). Quý theo năm dương
lịch (Q1 = T1–T3…).

| `?ky=` | Nhãn | Kỳ hiện tại [S, E) | Kỳ so sánh | Độ chia biểu đồ |
|---|---|---|---|---|
| `hom-nay` | Hôm nay | 00:00 hôm nay → now | hôm qua 00:00 → cùng giờ:phút hôm qua | giờ (24 cột, cột tương lai để trống) |
| `hom-qua` | Hôm qua | trọn ngày hôm qua | trọn ngày hôm kia | giờ |
| `7-ngay` | 7 ngày qua | 00:00 của 6 ngày trước → now (gồm hôm nay) | 7 ngày liền trước | ngày |
| `30-ngay` | 30 ngày qua (**mặc định**) | 00:00 của 29 ngày trước → now | 30 ngày liền trước | ngày |
| `tuan-nay` | Tuần này | Thứ Hai 00:00 → now | tuần trước, cùng độ dài tính từ Thứ Hai | ngày |
| `thang-nay` | Tháng này | ngày 1 00:00 → now | tháng trước, cùng số ngày/giờ đã trôi (cắt ở cuối tháng trước nếu ngắn hơn) | ngày |
| `quy-nay` | Quý này | ngày đầu quý → now | quý trước, cùng độ dài | tuần |
| `nam-nay` | Năm nay | 01/01 00:00 → now | năm trước, cùng độ dài | tháng |
| `tuy-chon` + `tu=YYYY-MM-DD&den=YYYY-MM-DD` | Khoảng ngày | `tu` 00:00 → hết ngày `den` (nếu `den` = hôm nay thì → now) | khoảng liền trước cùng số ngày | ≤ 31 ngày: ngày · ≤ 120 ngày: tuần · còn lại: tháng |

- **So sánh "cùng độ dài tới cùng thời điểm"** (period-to-date) để không so một tháng đang dở với cả tháng trước. Phương án đơn giản hơn
  (so với trọn kỳ trước) để Q4.
- **Kiểm đầu vào:** `ky` lạ → mặc định `30-ngay`; `tuy-chon` yêu cầu `tu ≤ den ≤ hôm nay`, độ dài ≤ **366 ngày** (đề xuất), sai → mặc định
  + thông báo nhẹ. Không bao giờ ném 500 vì query sai.
- **URL GET, chia sẻ được**, không cần JS: preset là link `?ky=…`; "Tuỳ chọn" là `<form method="get">` hai ô `type="date"`. Giữ kèm
  `?chi-so=` của biểu đồ khi đổi kỳ.
- Hàm thuần đề xuất: `resolveDashboardRange({ ky, tu, den }, now)` → `{ preset, start, end, prevStart, prevEnd, granularity, label,
  buckets[] }` — đặt ở `packages/core` để test unit được (Hiếu quyết vị trí cuối).

---

## 4. Nguồn tính

| Phương án | Ưu | Nhược |
|---|---|---|
| **A. Realtime L2 qua `withTenant`** (đề xuất) | Chính xác tới thời điểm render, "hôm nay"/giờ hoạt động đúng; có RLS phòng thủ; một định nghĩa (gộp/thuần) tự chọn; không phụ thuộc cron. | Mỗi lần mở trang chạy ~8–12 truy vấn tổng hợp; kỳ "năm nay" quét nhiều dòng hơn. |
| B. `tenant_daily_stats` (tới hôm qua) + hôm nay realtime | Nhẹ cho kỳ dài. | L1 không RLS (§1.4); chỉ có 4 chỉ số, **GMV gộp** — lệch thẻ thuần; không có giờ; không có đánh giá/tài liệu/top sản phẩm → vẫn phải truy vấn L2; hai nguồn ghép dễ lệch. |

**Đề xuất:** Phương án A.

- Một (hoặc vài) transaction `withTenant`, các truy vấn tổng hợp dùng `$queryRaw` có `GROUP BY` theo bucket giờ VN
  (`date_trunc(…, (col AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Ho_Chi_Minh')`) — chỉ trả số, không kéo cả danh sách đơn về Node (khác
  `getOrderDashboardStats` hiện kéo `totalVnd` từng đơn rồi cộng).
- Tiền cộng trong SQL trả `BIGINT` → chuỗi (giống `admin-stats.ts`), không qua float.
- Kỳ hiện tại + kỳ trước tính trong cùng một truy vấn (`FILTER (WHERE …)`) để giảm số vòng.
- **Cache:** không cache chéo request ở bản đầu (dữ liệu riêng từng gian hàng, cần đúng tức thì); hiện "Cập nhật lúc HH:mm" = thời điểm
  render. Nếu đo thấy chậm: cân nhắc cache 60 giây theo `(tenantId, ky, tu, den)` — Q10.
- **Hiệu năng:** ❓ chưa đo trên DB thật. Bản đầu **không migration**; Hiếu đo `EXPLAIN ANALYZE` với gian hàng lớn nhất (chỉ đọc). Nếu cần,
  đề xuất index expand-only `orders(tenantId, paidAt)`, `orders(tenantId, createdAt)`, `download_events(tenantId, createdAt)` — Quốc duyệt,
  chủ dự án chạy migration (ADR-034).

---

## 5. Bố cục UX (đề xuất hướng — Phong chốt chi tiết)

### 5.1. Thứ tự khối (ưu tiên "việc cần làm" trước "số đẹp")

1. **Header**: tên gian hàng + slug + trạng thái (giữ) · **bộ lọc kỳ** · "Cập nhật lúc HH:mm (giờ VN)".
2. **Cảnh báo cần xử lý** (chỉ hiện khi > 0): yêu cầu hoàn tiền (giữ khối ADR-039 hiện có), đánh giá chưa trả lời (R4), đơn chờ thanh toán
   (B7) — mỗi dòng có link tới trang lọc tương ứng.
3. **4 KPI chính** (icon tròn, % so kỳ trước, nhãn kỳ so sánh): Doanh thu (B1) · Đơn đã thanh toán (B2) · Giá trị đơn TB (B3) · Khách mới
   (K1).
4. **Biểu đồ** doanh thu / số đơn theo bucket (công tắc `?chi-so=`) — 2/3 chiều rộng; **Top 5 tài liệu bán chạy trong kỳ** (T3, thanh
   ngang + số) — 1/3.
5. **10 đơn hàng mới nhất** (§6) — toàn chiều rộng, link "Xem tất cả đơn".
6. **Ba thẻ nhóm**: Đánh giá (R2 điểm TB, R3 phân bố 1–5, R1, R4, R5) · Tài liệu (T1 theo trạng thái, T2 lượt tải, T5 top đánh giá) ·
   Khách (K2, K3 %, K4).
7. **Dải KPI phụ** cuối trang: giảm giá đã áp (B5), tỷ lệ thanh toán (B6), đã hoàn tiền + tỷ lệ hoàn (B8/B10), số tài liệu khác nhau đã bán
   (B4).
8. (GĐ sau) Doanh thu theo danh mục (B11), top lượt tải (T6).

### 5.2. Wireframe chữ

```
DESKTOP (≥ lg, app shell Studio fluid theo sidebar — ADR-024/042)
┌──────────────────────────────────────────────────────────────────────────┐
│ Tên gian hàng  /slug · ACTIVE                     Cập nhật lúc 14:32     │
│ [Hôm nay][Hôm qua][7 ngày][30 ngày●][Tuần này][Tháng này][Quý][Năm][Tuỳ chọn ▾] │
├──────────────────────────────────────────────────────────────────────────┤
│ ⚠ 2 yêu cầu hoàn tiền chờ xử lý … [Xem]   · 5 đánh giá chưa trả lời [Trả lời] │
├────────────┬────────────┬────────────┬────────────┤
│ (◯) Doanh  │ (◯) Đơn đã │ (◯) Giá trị│ (◯) Khách  │
│ thu        │ thanh toán │ đơn TB     │ mới        │
│ 12,5 tr đ  │ 84         │ 148.800 đ  │ 31         │
│ ▲ 12% so 30 ngày trước …                         │
├──────────────────────────────────┬─────────────────────────────┤
│ Doanh thu theo ngày  [Doanh thu|Đơn] │ Top 5 tài liệu bán chạy      │
│ ▂▃▅▇▅▃▂▅▇█ … (role=img)            │ 1. Đề thi … ████ 21 lượt     │
│ ▸ Xem dạng bảng (<details>)        │ …                            │
├──────────────────────────────────┴─────────────────────────────┤
│ 10 đơn hàng mới nhất                                [Xem tất cả] │
│ Mã đơn | Khách | Tài liệu | Số tiền | Trạng thái | Thời gian      │
├─────────────────────┬─────────────────────┬────────────────────┤
│ Đánh giá            │ Tài liệu            │ Khách              │
│ 4,6★ · 1–5 sao bars │ 12 công khai · 3 nháp│ 57 mua · 38% quay lại│
├─────────────────────┴─────────────────────┴────────────────────┤
│ Giảm giá 1,2 tr đ · Tỷ lệ thanh toán 71% · Hoàn 2 đơn (2,4%) · 9 tài liệu đã bán │
└──────────────────────────────────────────────────────────────────────────┘

MOBILE (< sm)
Header → bộ lọc: hàng chip cuộn ngang (hoặc <select> + nút "Xem") → cảnh báo
→ KPI lưới 2×2 → biểu đồ (cột co giãn; kỳ có > 31 bucket cuộn ngang trong khung)
→ Top 5 → 10 đơn dạng thẻ (mã + số tiền + trạng thái dòng 1, tài liệu + thời gian dòng 2)
→ Đánh giá → Tài liệu → Khách → dải KPI phụ xếp dọc
```

### 5.3. Trạng thái

- **Loading:** mỗi khối nặng bọc `Suspense` riêng với skeleton cùng kích thước (mẫu `SalesStatsSkeleton` + `Suspense` ở `admin/page.tsx`
  ✅) để header/bộ lọc hiện ngay.
- **Empty — gian hàng chưa có đơn nào:** một `EmptyState` hướng dẫn bước tiếp (tạo/xuất bản tài liệu, xem trang bán hàng), ẩn biểu đồ.
- **Empty — kỳ không có hoạt động:** vẫn hiện KPI = 0 và so sánh, biểu đồ hiện trục trống + câu "Không có đơn đã thanh toán trong kỳ này".
- **Error:** lỗi một khối không làm sập cả trang — khối hiện `Notice tone="warning"` "Không tải được số liệu, thử tải lại"; lỗi ghi log có
  `requestId`. Cơ chế error boundary hiện có của Studio: ❓ chưa kiểm (Phong/Hiếu xác nhận).
- **Query không hợp lệ:** quay về mặc định + dòng thông báo nhỏ (§3).

### 5.4. A11y

- Biểu đồ: `role="img"` + `aria-label` tóm tắt (tổng, cao nhất) + bảng thay thế trong `<details>` (mẫu `DailyChart`/`DailyTable` ✅).
- % thay đổi: luôn có dấu ▲/▼ **và** chữ ("tăng 12%"), không chỉ màu; phân bố sao hiện số + %.
- Bộ lọc: link có `aria-current="page"` cho kỳ đang chọn; ô ngày có `<label>`; vùng chạm ≥ 44px (chuẩn kit sau ADR-041).
- Bảng đơn: `<th scope>`; trên mobile thẻ vẫn giữ thứ tự đọc hợp lý.
- Số tiền: hiện bản rút gọn ("12,5 triệu đ") kèm bản đầy đủ (`title`/dòng phụ) như `KpiCard` admin.

### 5.5. Tái dùng component (chỉ hướng — không bịa API)

- `kit.tsx` (`AdminPageHeader`, `DataTable`/`Tr`/`Td`, `TableCard`, `EmptyState`, `Notice`, `Badge`, `GhostLinkButton`) — dùng trực tiếp
  như Studio đang làm ✅.
- `sales-stats.tsx`: `SalesStatsSection` gắn chặt kiểu `AdminStatsOverview` và cửa sổ ngày → **không dùng nguyên**. Hướng: Phong tách
  các khối nội bộ (`KpiCard`, biểu đồ cột + bảng `<details>`, `computeChange`, định dạng VND) thành component trình bày dùng chung nhận
  dữ liệu chuẩn hoá (nhãn bucket + giá trị), rồi admin và Studio cùng dùng. Việc tách là lớp trình bày (vùng Phong); không đổi
  `admin-stats.ts`.
- Badge trạng thái đơn: tái dùng cách hiển thị đang có ở `studio/[tenantSlug]/orders` (🟡 chưa đọc chi tiết `_ui` của orders).

---

## 6. Bảng 10 đơn hàng mới nhất

| Cột | Nội dung | Ghi chú |
|---|---|---|
| Mã đơn | `orders.code`, là link tới `/studio/{slug}/orders/{orderId}` | Route chi tiết có sẵn (`orders/[orderId]`) ✅ |
| Khách | Email khách (`customer.email`) | Trang Đơn hàng Studio **đang hiện email đầy đủ** (`orders/page.tsx`) ✅ → đề xuất giữ nhất quán, cắt ngắn bằng CSS + `title`. Che một phần là tuỳ chọn — Q5. |
| Tài liệu | `order_items.titleSnapshot` | Tên tại thời điểm mua |
| Số tiền | `totalVnd`; nếu `discountVnd > 0` hiện dòng phụ "giảm X" | Số nguyên VND |
| Trạng thái | Trạng thái **hiệu lực** (ADR-036: PENDING quá hạn hiện EXPIRED) + badge "Yêu cầu hoàn tiền" nếu có | Dùng logic `withEffectiveStatus` như `listOrders` ✅ |
| Thời gian | `createdAt` theo giờ VN; nếu đã trả hiện thêm `paidAt` | |

- **Tập đơn:** 10 đơn mới nhất theo `createdAt` giảm dần, **mọi trạng thái**, **không phụ thuộc kỳ** (đề xuất — bảng là "việc gần đây"; Q6).
- **Truy vấn:** dưới `withTenant`, `take: 10`, chỉ chọn cột cần — không gọi `listOrders()` vì hàm đó không giới hạn số dòng ✅.
- **Quyền:** trang chỉ OWNER vào được (§1.1 ✅) nên bảng hiện cho OWNER. Nếu sau này mở STAFF thì quyết riêng STAFF có thấy doanh thu/
  email không — Q3.
- **Empty:** "Chưa có đơn hàng nào" + link trang bán hàng.

---

## 7. PLAN_CHECK — có cần giai đoạn CMS không?

- Dashboard hiển thị **dữ liệu nghiệp vụ** (đơn, đánh giá, tài liệu) chứ không phải nội dung marketing → **không cần GĐ CMS** trước UI. Nhãn
  KPI/tiêu đề là microcopy của app quản trị, cùng cách các trang Studio khác.
- Tên thương hiệu (nếu xuất hiện) đọc qua `getEffectiveBrand()` (ADR-032) — dashboard hiện không cần.
- Tuỳ chọn "chủ gian hàng bật/tắt/sắp xếp khối" hoặc "kỳ mặc định riêng" → **để sau** (cần lưu cấu hình theo tenant = thêm cột/bảng). Ghi
  BACKLOG nếu chủ dự án muốn.

---

## 8. Phân bước

**Tiến độ 2026-10-18:** GĐ0 ✅ (ADR-043) · GĐ1 ✅ xong code (`packages/core/src/stats/dashboard-range.ts`, `apps/web/lib/tenant-dashboard.ts`;
`getOrderDashboardStats` giữ lại, không còn nơi gọi → BACKLOG xoá) · GĐ2 ✅ xong code (route group `studio/[tenantSlug]/(tong-quan)/`,
`admin/_ui/stats-chart.tsx` dùng chung) · GĐ3 ✅ KB đã ghi. Chưa: `EXPLAIN` kỳ dài trên DB thật, kiểm tenant chéo bằng test (hết ngân sách), kiểm
phiên OWNER thật.

| Bước | Ai | Việc | Tiêu chí xong |
|---|---|---|---|
| GĐ0 — Chốt | Chủ dự án + Quốc | Trả lời §9; Quốc ghi ADR (số kế tiếp sau ADR-042) gồm định nghĩa B1/B8, kỳ mặc định, so sánh, quyền. | ADR có trong `docs/DECISIONS.md`. |
| GĐ1 — Dữ liệu | Hiếu | (a) Hàm thuần `resolveDashboardRange()` (§3). (b) Loader `getTenantDashboard({ tenantId, range })` ở `apps/web/lib/` (vd `tenant-dashboard.ts`), mọi truy vấn dưới `withTenant`, `tenantId` lấy từ `requireTenantMember()`. (c) Contract kiểu trả về (dưới đây). (d) Thay `getOrderDashboardStats` hoặc giữ cho tương thích — Hiếu đề xuất. Không migration. | lint/typecheck/test đạt; `test:count` khớp; so số với dữ liệu thật của 1 gian hàng (đọc-only) bằng truy vấn đối chứng; tenant khác không thấy số của nhau; `EXPLAIN` kỳ "năm nay" chấp nhận được. |
| GĐ2 — UI | Phong | Bố cục §5 theo contract GĐ1; tách component biểu đồ/KPI dùng chung với admin (§5.5); mobile/desktop; loading/empty/error. | a11y (bàn phím, `role="img"` + bảng, không chỉ màu), responsive 360/768/1280, 3 trạng thái; lint/typecheck/build. |
| GĐ3 — Kiểm + tài liệu | Quốc review; Long | Quốc đối chiếu RLS/§7.9/ADR. Long: spec mới `02-System-Specs/Studio-Dashboard-Specs.md`, mục mới trong `04-Operations-Runbooks/UI-Design-System.md`, liên kết `Tenant-Stats-Specs`, MOC + Tags, `PLAN.md`, KB-Audit nếu lệch. | Trang KB khớp code ✅; `PLAN.md` cập nhật. |

**Contract đề xuất (tên/kiểu để Hiếu chốt — chưa phải code):**

```ts
type DashboardPreset = "hom-nay" | "hom-qua" | "7-ngay" | "30-ngay" | "tuan-nay" | "thang-nay" | "quy-nay" | "nam-nay" | "tuy-chon";
type Granularity = "hour" | "day" | "week" | "month";

interface DashboardRange {
  preset: DashboardPreset; label: string;        // "30 ngày qua"
  start: string; end: string;                    // ISO UTC, [start, end)
  prevStart: string; prevEnd: string; prevLabel: string;
  granularity: Granularity;
  invalidInput?: boolean;                        // query sai → đã về mặc định
}

interface TenantDashboard {
  range: DashboardRange;
  generatedAt: string;                           // ISO UTC — "Cập nhật lúc"
  sales: {
    current: SalesTotals; previous: SalesTotals; // revenueNetVnd, revenueGrossVnd (chuỗi BigInt), ordersPaid,
                                                 // avgOrderVnd, discountVnd, refundedOrders, refundedVnd,
                                                 // ordersCreated, distinctProductsSold
    series: Array<{ bucket: string; label: string; revenueVnd: string; ordersPaid: number }>; // đủ bucket, thiếu = 0
    pendingOrders: number;                       // snapshot
    refundRequests: { pending: number; overdue: number }; // snapshot
  };
  customers: { new: number; newPrev: number; buyers: number; returning: number; total: number };
  reviews: { new: number; newPrev: number; avgRating: number | null; distribution: [number, number, number, number, number];
             unanswered: number; hiddenInRange: number; moderationLocked: number; overallAvg: number | null };
  products: { published: number; draft: number; archived: number; moderationLocked: number;
              downloads: number; downloadsPrev: number;
              topSelling: Array<{ productId: string; title: string; sold: number; revenueVnd: string; soldAllTime: number }>; // ≤ 5
              topRated: Array<{ productId: string; title: string; avg: number; count: number }> };             // ≤ 5
  recentOrders: Array<{ id: string; code: string; customerEmail: string; productTitle: string; totalVnd: number;
                        discountVnd: number; status: string; refundRequested: boolean; createdAt: string; paidAt: string | null }>; // ≤ 10
}
```

**Migration:** không cần cho bản đầu. Index (§4) chỉ thêm khi đo thấy chậm — expand-only, Quốc duyệt, chủ dự án chạy.

---

## 9. Câu hỏi mở cho chủ dự án

1. **Q1 — Doanh thu:** thẻ chính hiện **thuần** (loại đơn đã hoàn — như thẻ hiện tại) hay **gộp** (như System Center/ADR-037)? Đề xuất: thuần
   ở thẻ chính, gộp + đã hoàn ở dòng phụ.
2. **Q2 — Hoàn tiền theo thời điểm:** đếm đơn hoàn theo **ngày đơn được trả** (làm được ngay) hay theo **ngày bấm hoàn** (cần đọc
   `audit_logs` hoặc thêm cột `refundedAt` = migration)? Đề xuất: theo ngày trả ở bản đầu.
3. **Q3 — STAFF:** hiện chỉ OWNER vào Studio. Khi có STAFF, STAFF có xem doanh thu/email khách không? Đề xuất: để khi làm tính năng STAFF.
4. **Q4 — Kỳ so sánh:** so "cùng độ dài tới cùng thời điểm" (đề xuất) hay so với trọn kỳ trước?
5. **Q5 — Email khách trong bảng 10 đơn:** hiện đầy đủ như trang Đơn hàng (đề xuất) hay che một phần (`ng***@gmail.com`)?
6. **Q6 — Bảng 10 đơn:** luôn là 10 đơn mới nhất (đề xuất) hay lọc theo kỳ đang chọn? Mọi trạng thái hay chỉ đơn đã thanh toán?
7. **Q7 — Khách quay lại:** "đã mua trước kỳ" (đề xuất) hay "≥ 2 đơn trong kỳ"?
8. **Q8 — Điểm đánh giá TB trong kỳ:** chỉ đánh giá đang hiện (đề xuất) hay tính cả đánh giá bị ẩn?
9. **Q9 — Top đánh giá:** ngưỡng tối thiểu số đánh giá để vào top (đề xuất 3)?
10. **Q10 — Thời điểm cập nhật/cache:** chấp nhận realtime mỗi lần mở trang (đề xuất), hay cho phép trễ tối đa 1 phút để nhanh hơn?
11. **Q11 — Khoảng ngày tuỳ chọn:** có cần ở bản đầu không? Giới hạn tối đa (đề xuất 366 ngày)?
12. **Q12 — Kỳ mặc định:** 30 ngày qua (đề xuất) hay Tháng này?
13. **Q13 — Xuất CSV:** có cần nút xuất số liệu/đơn trong kỳ không? Đề xuất: để sau (CSV chứa email khách = dữ liệu cá nhân, cần quyết riêng).
14. **Q14 — Tuần bắt đầu Thứ Hai** (đề xuất)?
15. **Q15 — Khối "Doanh thu theo danh mục"/donut:** có cần ở bản đầu không? Đề xuất: để GĐ sau.
16. **Q16 — Test:** ngân sách còn 1 unit + 1 integration (§10). Dùng cả hai cho tính năng này (cần ADR theo quy tắc "không thêm test khi chưa
    hỏi"), hay không thêm test?

---

## 10. Rủi ro, ngân sách test, tác động tài liệu

**Rủi ro**

| Rủi ro | Giảm thiểu |
|---|---|
| Hai màn hình hiện "doanh thu" khác nhau (Studio thuần realtime vs System Center GMV gộp tới hôm qua) gây nhầm. | Nhãn rõ ("Doanh thu đã trừ hoàn", "GMV gộp"), ghi định nghĩa trong ADR + spec; tooltip/dòng phụ. |
| Sai ranh giới ngày/giờ VN (đơn lúc 23:30 VN rơi sang ngày khác). | Hàm `resolveDashboardRange` thuần + test unit; SQL dùng cùng biểu thức quy đổi đã có ở `tenant-stats.ts`. |
| Truy vấn chậm với gian hàng lớn/kỳ "năm nay" (không có index `(tenantId, paidAt)`). | Đo `EXPLAIN` (❓ DB thật); `Suspense` từng khối; index expand-only nếu cần. |
| Lộ dữ liệu chéo tenant. | Chỉ `withTenant` + `tenantId` từ `requireTenantMember`; không đọc `tenant_daily_stats` (L1 không RLS); test cô lập nếu được duyệt. |
| Trộn chỉ số snapshot và theo kỳ gây hiểu sai. | Nhãn "hiện tại"/"từ trước tới nay" cho snapshot/luỹ kế. |
| Tràn số/mất chính xác khi cộng tiền. | Cộng trong SQL `::bigint`, trả chuỗi, định dạng bằng BigInt như `sales-stats.tsx`. |
| Danh mục sản phẩm đổi sau khi bán làm B11 lệch lịch sử. | Ghi chú "theo danh mục hiện tại"; để GĐ sau. |
| Xoá/đổi tên `getOrderDashboardStats` ảnh hưởng nơi khác. | Hiếu kiểm nơi gọi trước khi đổi. |

**Ngân sách test:** thực **93 unit / 54 integration**, trần **94 / 55** (ADR-026 + ADR-037; `PLAN.md` ghi `pnpm test:count` 2026-10-17 —
Long chưa chạy lại cho tài liệu này). Còn **1 + 1**. Đề xuất nếu chủ dự án đồng ý (Q16): 1 unit cho `resolveDashboardRange` (ranh giới
VN, kỳ so sánh, query sai); 1 integration cho loader (định nghĩa doanh thu + cô lập tenant), dọn dữ liệu tạm theo ADR-034. Lưu ý: test gọi
hàm có audit để lại dòng `audit_logs` không xoá được (bổ sung ADR-037).

**Tác động tài liệu (GĐ3, Long):**
- Mới: `obsidian-knowledge-base/02-System-Specs/Studio-Dashboard-Specs.md` (định nghĩa chỉ số, kỳ, nguồn, quyền).
- Sửa: `04-Operations-Runbooks/UI-Design-System.md` (mục dashboard Studio + component dùng chung tách từ `sales-stats`),
  `02-System-Specs/Tenant-Stats-Specs.md` (liên kết + ghi rõ khác định nghĩa), `00-Index/MOC-Home.md`, `00-Index/Tags-Dictionary.md`
  (thẻ mới nếu có), bản trích `01-Architecture-Decisions/` khi Quốc duyệt ADR, `docs/PLAN.md`.
- Ghi nhận lệch (không phải lỗi tài liệu): định nghĩa "Doanh thu 30 ngày" Studio hiện tại (loại REFUNDED, 30×24h trượt) khác GMV ADR-037
  (gộp, theo ngày VN, tới hôm qua) — đưa vào spec mới.

---

Điều hướng: [`PLAN.md`](PLAN.md) · [`DECISIONS.md`](DECISIONS.md) · KB: `obsidian-knowledge-base/00-Index/MOC-Home.md`

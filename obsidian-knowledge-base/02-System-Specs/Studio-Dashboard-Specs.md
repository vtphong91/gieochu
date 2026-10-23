---
tags:
  - spec
  - analytics
  - tenant
  - order
  - reviews
  - status/living
date: 2026-10-18
updated: 2026-10-23
author: Long
---

# 📐 Đặc Tả: Dashboard Tổng Quan Gian Hàng (`/studio/{slug}` — ADR-043)

> Quyết định gốc: **ADR-043** + **"Bổ sung ADR-043"** + **"Bổ sung ADR-043 lần 2"** (Quốc) + **"Bổ sung ADR-043 lần 3"** (chủ dự án yêu cầu,
> Quốc bổ sung quy tắc so sánh trọn kỳ) — tất cả 2026-10-18 — trong [`docs/DECISIONS.md`](../../docs/DECISIONS.md). Bản trích KB:
> [[01-Architecture-Decisions/ADR-029-Studio-Dashboard-Period-Gross-Net-Revenue|ADR-029 (≙ ADR-043)]]. Kế hoạch (đã chốt):
> [`docs/ke-hoach-dashboard-tong-quan-gian-hang-2026-10-17.md`](../../docs/ke-hoach-dashboard-tong-quan-gian-hang-2026-10-17.md). ADR liên quan:
> ADR-010 (role `gieochu_app`, RLS), ADR-033 (`soldCount`), ADR-036 (đơn PENDING hiệu lực), ADR-037 (GMV gộp, `tenant_daily_stats`),
> ADR-039 (yêu cầu hoàn tiền), ADR-042 (app shell Studio).
>
> Mức xác minh: ✅ Long đã đối chiếu code 2026-10-18 · 🟡 theo brief/báo cáo của Quốc · ❓ cần môi trường thật. Không migration.
> Trạng thái code: ADR-043 + bổ sung lần 1–2 **đã commit** (`e5d63d0`, 2026-10-18 ✅ `git show --stat`), đã deploy hay chưa ❓; **"Bổ sung
> ADR-043 lần 3" (date range picker, 3 mốc "… trước", số đầy đủ) còn ở working tree, chưa commit** ✅ `git status`.

---

## 1. Phạm vi

- Trang `/studio/{tenantSlug}` (mục "Tổng quan" sidebar Studio) — thay 4 thẻ tĩnh cũ bằng dashboard theo kỳ ✅.
- Dữ liệu: hàm thuần `@gieochu/core/dashboard-range` + loader `apps/web/lib/tenant-dashboard.ts` ✅.
- **Không** có giai đoạn CMS: dashboard là dữ liệu nghiệp vụ, nhãn là microcopy app quản trị (PLAN_CHECK của ADR-043) 🟡.
- **Không** thuộc phạm vi: xuất CSV (từ 2026-10-18: **Không làm, tạm thời — ADR-047 mục 3**, Quốc xác nhận 🟡), doanh thu theo danh mục (donut), top theo lượt tải, cấu hình bật/tắt khối theo tenant — BACKLOG.

---

## 2. Quyền và ranh giới layer ✅

- Trang gọi `requireTenantMemberPage(tenantSlug, …)` → `requireTenantMember` với vai trò mặc định **OWNER**; STAFF/người ngoài bị chặn
  (ADR-043 mục 2 — giữ hành vi cũ).
- `tenantId` truyền vào loader lấy từ kết quả guard, **không** từ URL/query.
- Mọi truy vấn chạy trong **một** transaction `withTenant(tenantId, …)` (RLS L2 là lớp phòng thủ thứ hai), kèm điều kiện `"tenantId" = $1`
  tường minh ở từng bảng. Bảng L1 duy nhất được đọc là `user_profiles` (họ tên khách trong bảng 10 đơn mới nhất).
- **Không** đọc `tenant_daily_stats` (L1 không RLS — ADR-043 mục 6).
- Không cache chéo request; "Cập nhật lúc" = thời điểm tính (`generatedAt`).

---

## 3. Kỳ thống kê — `resolveDashboardRange` ✅ (`packages/core/src/stats/dashboard-range.ts`)

Hàm thuần, không I/O. Ranh giới theo ngày giờ hiển thị (`DISPLAY_TIME_ZONE` = `Asia/Ho_Chi_Minh`) quy về UTC. Kỳ hiện tại nửa mở `[start, end)`;
kỳ "tới hiện tại" có `end = now`.

**12 mốc** theo đúng thứ tự `DASHBOARD_PRESETS` (cũng là thứ tự danh sách mốc trong date range picker — "Bổ sung ADR-043 lần 3") ✅:

| `?ky=` | Nhãn | Kỳ hiện tại | Kỳ so sánh (`prevLabel`) | Cách so sánh | Độ chia |
| :-- | :-- | :-- | :-- | :-- | :-- |
| `hom-nay` | Hôm nay | 00:00 hôm nay → now | hôm qua | cùng độ dài | giờ |
| `hom-qua` | Hôm qua | trọn hôm qua | hôm kia | cùng độ dài | giờ |
| `tuan-nay` | Tuần này | **Thứ Hai** 00:00 → now | tuần trước | cùng độ dài | ngày |
| `tuan-truoc` *(lần 3)* | Tuần trước | trọn tuần trước, Thứ Hai → hết Chủ nhật | tuần trước nữa | **trọn kỳ** | ngày |
| `thang-nay` | Tháng này | ngày 1 → now | tháng trước | cùng độ dài | ngày |
| `thang-truoc` *(lần 3)* | Tháng trước | trọn tháng trước | tháng trước nữa | **trọn kỳ** | ngày |
| `quy-nay` | Quý này | đầu quý (Q1 = T1–T3) → now | quý trước | cùng độ dài | tuần |
| `quy-truoc` *(lần 3)* | Quý trước | trọn quý trước | quý trước nữa | **trọn kỳ** | tuần |
| `nam-nay` | Năm nay | 01/01 → now | năm trước | cùng độ dài | tháng |
| `7-ngay` | 7 ngày qua | 00:00 của 6 ngày trước → now | 7 ngày trước đó | cùng độ dài | ngày |
| `30-ngay` | 30 ngày qua — **mặc định** | 00:00 của 29 ngày trước → now | 30 ngày trước đó | cùng độ dài | ngày |
| `tuy-chon` + `tu`, `den` (`YYYY-MM-DD`) | "dd/mm/yyyy – dd/mm/yyyy" (1 ngày: chỉ một ngày) | `tu` 00:00 → hết ngày `den` (`den` = hôm nay → now) | N ngày liền trước ("N ngày trước đó") | cùng độ dài | 1 ngày: giờ · ≤ 31: ngày · ≤ 120: tuần · còn lại: tháng |

- **Kỳ so sánh cùng độ dài** (mặc định — ADR-043 mục 5): bắt đầu ở đầu kỳ liền trước, kéo dài `end − start`, không vượt `start` (tháng trước
  ngắn hơn → cắt ở cuối tháng trước).
- **Ngoại lệ — so sánh trọn kỳ** ("Bổ sung ADR-043 lần 3", Quốc): ba mốc **đã kết thúc** `tuan-truoc`, `thang-truoc`, `quy-truoc` so với **trọn**
  kỳ liền trước cùng loại (`prevEnd = start`, không cắt theo độ dài) — vd tháng 9 (30 ngày) so với **cả** tháng 8 (31 ngày); quý 3 so với cả
  quý 2. Do đó với ba mốc này `prevEnd − prevStart` **có thể dài hơn** `end − start` ✅ code (`prevEndL` cố định trong `planPreset`). Ba mốc này
  có `end` cố định (không phụ thuộc `now`) nên **không** có bucket tương lai ✅ unit test.
- **`displayFrom` / `displayTo`** (lần 3): `YYYY-MM-DD` theo giờ VN của ngày đầu và **ngày cuối bao gồm** của kỳ hiện tại — luôn có, kể cả preset;
  kỳ "tới hiện tại" có `displayTo` = hôm nay; `hom-qua` → cả hai là hôm qua. Dùng cho ô `dd/mm/yyyy - dd/mm/yyyy` và tô khoảng trên lịch — UI
  **không** tự tính kỳ ✅.
- **Đầu vào sai** (`ky` lạ; `tuy-chon` sai định dạng, `tu > den`, `den` sau hôm nay, dài hơn `DASHBOARD_CUSTOM_MAX_DAYS = 366` ngày tính cả
  hai đầu) → về `30-ngay` và `invalid = true` (UI hiện cảnh báo). Không có `ky` → mặc định, `invalid = false`. Không bao giờ ném lỗi.
- `listDashboardBuckets(range)` dựng trục thời gian đủ điểm từ bucket chứa `start` tới trước `periodEnd` (cuối danh nghĩa của kỳ); bucket sau
  `end` đánh dấu `future` (giá trị 0, UI để trống). Bucket tuần bắt đầu Thứ Hai (khớp `date_trunc('week')` của Postgres).
- Ví dụ từ unit test ✅: 10:00 Chủ nhật 18/10/2026 giờ VN → "Tuần này" bắt đầu Thứ Hai 12/10; 00:30 Thứ Hai 19/10 giờ VN đã sang tuần mới;
  "Hôm nay" có 24 bucket giờ, 14 bucket tương lai, `displayFrom = displayTo = 2026-10-18`. Cùng thời điểm (lần 3): "Tuần trước" = 05/10–11/10
  (so với 28/09–04/10, 7 bucket ngày); "Tháng trước" = 01/09–30/09 (so với trọn 01/08–31/08, 30 bucket ngày); "Quý trước" = 01/07–30/09 (so với
  trọn 01/04–30/06, 14 bucket tuần — bucket đầu bắt đầu Thứ Hai 29/06, trước `start`).

---

## 4. Định nghĩa chỉ số ✅ (`apps/web/lib/tenant-dashboard.ts`)

**"Đơn đã thanh toán trong kỳ"** = đơn có `paidAt` trong kỳ **và `totalVnd > 0`**, **mọi trạng thái** (gồm đơn sau này `REFUNDED`). Đơn 0đ
(nhận tài liệu miễn phí) bị loại khỏi mọi chỉ số tiền/đơn/khách mua (Bổ sung ADR-043). Mọi chỉ số "theo kỳ" trả `{ current, previous }`; UI tự
tính %.

### 4.1. Bán hàng (`sales`)

| Trường | Định nghĩa |
| :-- | :-- |
| `grossRevenueVnd` | Σ `totalVnd` (đã trừ giảm giá) của đơn đã thanh toán trong kỳ — **cùng định nghĩa GMV ADR-037** |
| `refundedVnd`, `refundedOrders` | Σ tiền / số đơn trong tập trên **hiện có** `status = REFUNDED` — tính theo **ngày khách trả tiền** (`orders` không có `refundedAt`) |
| `netRevenueVnd` | `gross − refunded` |
| `paidOrders` | Số đơn đã thanh toán trong kỳ |
| `avgOrderVnd` | ⌊gross ÷ paidOrders⌋; `null` khi 0 đơn |
| `distinctProductsSold` | Số `productId` khác nhau trong `order_items` của các đơn đó |
| `freeClaims` | Số đơn **0đ** có `paidAt` trong kỳ (mọi trạng thái) — "Lượt nhận tài liệu miễn phí" |
| `pendingOrders` | **Ảnh chụp hiện tại**: `status = PENDING` và `expiresAt ≥ now` (ADR-036) |
| `refundRequests` | **Ảnh chụp**: entitlement `remedyStatus = REFUND_REQUESTED` (`pending`), và số có `remedyChosenAt` cũ hơn `REMEDY_REFUND_SLA_DAYS` ngày (`overdue`) — ADR-039 |

### 4.2. Khách (`customers`)

| Trường | Định nghĩa |
| :-- | :-- |
| `newCustomers` | Số `tenant_customers` có `firstOrderAt` trong kỳ — giữ định nghĩa ADR-037 để **khớp System Center**. Dòng `tenant_customers` được tạo cả khi đơn đầu là 0đ → khách chỉ nhận tài liệu miễn phí **vẫn** tính là khách mới |
| `buyers` | Số khách khác nhau có đơn đã thanh toán (> 0đ) trong kỳ |
| `returningCustomers` | Trong `buyers`, số khách có **≥ 2 đơn đã thanh toán > 0đ** (mọi trạng thái, kể cả đã hoàn) tại gian hàng **tính tới hết kỳ** (`paidAt < end`) — gồm đơn trước kỳ. Đơn > 0đ đã hoàn **vẫn** tính (khách đã mua 2 lần) — "Bổ sung ADR-043 lần 2". Kỳ trước tính tương tự với `prevEnd` |
| `returningCustomerRate` | `returning ÷ buyers` (0–1), `null` khi `buyers = 0` |

### 4.3. Đánh giá (`reviews`)

| Trường | Định nghĩa |
| :-- | :-- |
| `newReviews` | `createdAt` trong kỳ, mọi trạng thái |
| `avgRating`, `distribution[1..5]` | Chỉ đánh giá **VISIBLE** tạo trong kỳ (ADR-043 mục 4); điểm làm tròn 1 chữ số thập phân, `null` khi không có |
| `hiddenInPeriod` | Đang `HIDDEN` và `hiddenAt` trong kỳ |
| `unanswered`, `hiddenTotal`, `moderationLocked` | **Ảnh chụp**: VISIBLE chưa có `reply` · đang HIDDEN · `moderationLockedAt` khác null |

### 4.4. Tài liệu (`products`)

| Trường | Định nghĩa |
| :-- | :-- |
| `published`, `draft`, `archived`, `moderationLocked` | **Ảnh chụp** theo `products.status`; khoá kiểm duyệt đếm riêng (sản phẩm khoá vẫn thuộc một trong 3 trạng thái) |
| `downloads` | Số `download_events` có `createdAt` trong kỳ (gồm tải qua share link) |
| `topSelling` (≤ 5) | Theo sản phẩm: số đơn có `paidAt` trong kỳ, **loại đơn `REFUNDED`**, **vẫn gồm đơn 0đ**; sắp theo số đơn → doanh thu dòng (`finalPriceVnd`) → tên. Kèm `soldAllTime` = `products.soldCount` (luỹ kế, ADR-033). Tên = tên **hiện tại** của sản phẩm |
| `topRated` (≤ 5) | Cache luỹ kế `ratingSum/ratingCount` (chỉ đánh giá VISIBLE — `recomputeProductRatings`), chỉ sản phẩm có **≥ 3** đánh giá (`TOP_RATED_MIN_REVIEWS`) |

> Lưu ý định nghĩa: `topSelling` **gồm** đơn 0đ trong khi `paidOrders` **không** — một tài liệu miễn phí có thể đứng đầu bán chạy dù không có
> doanh thu. **Có chủ đích** — "Bổ sung ADR-043 lần 2": top 5 phản ánh mức phổ biến, cột doanh thu cạnh đó cho thấy tài liệu miễn phí = 0đ;
> UI ghi rõ "gồm lượt nhận miễn phí" ✅.

### 4.5. Chuỗi thời gian (`series`)

Mỗi bucket (`key` giờ VN `YYYY-MM-DDTHH:MM`, `start` ISO UTC, `label`, `future`): `grossRevenueVnd`, `netRevenueVnd`, `paidOrders` — chỉ đơn
trên 0đ, theo `paidAt` của kỳ hiện tại; bucket không có đơn = 0. Tổng các bucket khớp `sales` kỳ hiện tại (kiểm trong integration test ✅).

### 4.6. 10 đơn mới nhất (`latestOrders`)

10 đơn mới nhất theo `createdAt` (rồi `id`) giảm dần, **mọi trạng thái** (kể cả PENDING/EXPIRED/CANCELED), **không lọc theo kỳ**. Mỗi dòng
**chỉ** `id`, `code`, `customerFullName` (`user_profiles.fullName`, không có hồ sơ → "Khách"), `unitPriceVnd` (đơn giá dòng đầu của đơn),
`totalVnd`. **Không email** (ADR-043 mục 3) — integration test kiểm chuỗi JSON không chứa email nào ✅.

### 4.7. Tiền tệ

SUM trong SQL là `BIGINT` → chuỗi → `number` nguyên VND qua `toInt`; vượt `Number.MAX_SAFE_INTEGER` (≈ 9 triệu tỷ đồng/kỳ/gian hàng) → ném
`AppError INTERNAL_ERROR` thay vì trả số sai. UI định dạng bằng BigInt (`stats-chart.tsx`). Từ "Bổ sung ADR-043 lần 3": thẻ thống kê, dòng
phụ, top 5, bảng, tooltip hiển thị **số đầy đủ** `vi-VN` (vd `993.000 đ`), **không rút gọn**; chỉ nhãn trục Y biểu đồ còn rút gọn ✅ — chi tiết
[[04-Operations-Runbooks/UI-Design-System|UI-Design-System]] §19.6.

---

## 5. Truy vấn ✅

| # | Hàm nội bộ | Nội dung |
| :-: | :-- | :-- |
| 1 | `selectMetrics` | Một câu SELECT với nhiều CTE: tổng bán hàng kỳ hiện tại + kỳ trước (`FILTER`), sản phẩm khác nhau, khách quay lại, khách mới, ảnh chụp đơn chờ/yêu cầu hoàn tiền, đánh giá, tài liệu, lượt tải |
| 2 | `selectSeries` | `GROUP BY to_char(date_trunc(granularity, (paidAt AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Ho_Chi_Minh'), …)` — đơn > 0đ trong kỳ hiện tại |
| 3 | `selectLists` | Top bán chạy, top đánh giá, 10 đơn mới — gom bằng `json_agg` |

Ba truy vấn chạy **tuần tự** trong cùng transaction (Prisma interactive transaction một kết nối). Hiệu năng với gian hàng lớn/kỳ dài chưa đo
trên DB thật ❓ — `orders` chỉ có index `(tenantId)`, `(customerId)`; đề xuất index expand-only ở BACKLOG.

---

## 6. Giao diện (tóm tắt — chi tiết [[04-Operations-Runbooks/UI-Design-System|UI-Design-System]] §19) ✅

- Route group `studio/[tenantSlug]/(tong-quan)/` (URL vẫn `/studio/{slug}`): `page.tsx`, `loading.tsx` (khung chờ — cũng hiện khi đổi kỳ),
  `error.tsx` (client, nút "Thử lại" gọi `retry()`, "Xem đơn hàng"; không hiện `error.message`). Route group để loading/error **không** phủ các
  trang con Studio.
- Thứ tự khối: header ("Cập nhật lúc … giờ Việt Nam") → **Việc cần xử lý** (yêu cầu hoàn tiền, đánh giá chưa trả lời, tài liệu bị khoá kiểm
  duyệt, đơn chờ thanh toán — chỉ hiện khi > 0) → **tiêu đề kỳ + date range picker** → **KPI bán hàng** (gộp, thực nhận, đơn, giá trị TB) + phụ (đã hoàn,
  tài liệu khác nhau, lượt nhận miễn phí) → **biểu đồ** (cột doanh thu gộp/thực nhận chọn bằng `?chi-so=gop|thuc-nhan`, đường số đơn) + **top 5**
  → **10 đơn mới** → **Khách / Đánh giá / Tài liệu**.
- Gian hàng **chưa có đơn nào** (bảng 10 đơn rỗng) → thay toàn bộ phần số liệu bằng checklist 3 bước (thêm tài liệu, xuất bản, chia sẻ trang bán
  hàng).
- **Chọn kỳ (từ "Bổ sung ADR-043 lần 3")**: ô `dd/mm/yyyy - dd/mm/yyyy` mở popup **date range picker** (danh sách 11 mốc bên trái + "Tuỳ chọn",
  lịch có số tuần, Thứ Hai đầu tuần, ngày tương lai vô hiệu) — **thay** dãy chip kỳ + form "Tuỳ chọn" (`next/form`, 2 ô `type="date"`) cũ ✅.
  Chọn mốc → `?ky=<key>`; chọn khoảng + "Áp dụng" → `?ky=tuy-chon&tu=…&den=…`; giữ `?chi-so=`. Server vẫn kiểm lại mọi đầu vào (§3).
- **Picker cần JS** để mở (client component, `<dialog>`); URL `?ky=`/`?tu=`/`?den=` gõ tay vẫn dùng được không cần JS. Công tắc `?chi-so=` vẫn là
  link GET. Giá trị mặc định (30 ngày, gộp) bỏ khỏi URL.

---

## 7. Test

- Unit `packages/core/src/stats/dashboard-range.test.ts` — `describe("ADR-043 studio dashboard range")`, 1 case: ranh giới giờ VN cho hôm nay/hôm
  qua, tuần bắt đầu Thứ Hai, quý, tuỳ chọn, bucket tương lai, từ chối khoảng > 366 ngày / `den` sau hôm nay / `ky` lạ ✅ đọc test. "Bổ sung
  ADR-043 lần 3" **chỉ thêm assertion vào case có sẵn** (không thêm case): 3 mốc `tuan-truoc`/`thang-truoc`/`quy-truoc` (nhãn, `prevLabel`,
  ranh giới kỳ + kỳ so sánh trọn, độ chia, `displayFrom/To`, số bucket, không bucket tương lai) và `displayFrom/To` của "Hôm nay"/tuỳ chọn ✅ `git diff`.
- Integration `apps/web/tests/integration/studio-dashboard.test.ts` — `describe("ADR-043 studio dashboard")`, 1 case: 6 đơn (trong kỳ có giảm
  giá, trong kỳ đã hoàn, PENDING, kỳ trước, ngoài cả hai kỳ, đơn 0đ) → kiểm gross/net/refunded, đơn, TB, `freeClaims`, đơn chờ, khách quay lại
  50%, 7 bucket cộng khớp tổng, top bán chạy loại đơn hoàn gồm đơn 0đ, 10 đơn mới đúng thứ tự + không email ✅ đọc test. Dữ liệu tạm tiền tố
  `adr043dash_…`, email `@example.test`, dọn ở `afterAll`; dòng `audit_logs` do `createTenantForUser` sinh không xoá được — chấp nhận
  (ADR-037). Chạy thật đạt 🟡 (báo cáo).
- Test **không** kiểm cô lập tenant chéo (chỉ 1 tenant) — BACKLOG.
- `pnpm test:count` (Long chạy lại 2026-10-18 sau lần 3, chỉ đếm): **94/94 unit, 55/55 integration** ✅ — **chạm trần**, không đổi; test mới cần
  chủ dự án duyệt nâng trần.

---

## 8. Giới hạn đã biết (chi tiết `docs/BACKLOG.md` mục "Phát sinh trong đợt ADR-043")

- Chưa kiểm với phiên OWNER thật, `/admin` sau refactor `sales-stats` + đổi sang số đầy đủ, trình đọc màn hình ❓. Date range picker: Phong báo đã
  kiểm bàn phím bằng Playwright và 360/1100/1440 không cuộn ngang 🟡 — **trên dữ liệu không phải phiên OWNER thật** ❓.
- Picker cần JS, không có phương án không-JS ngoài việc gõ URL (form GET cũ đã bỏ) — **Quốc chấp nhận 2026-10-18** (app shell vốn cần JS).
- Hiệu năng kỳ dài trên DB thật ❓; index `orders(tenantId, paidAt)`, `orders(tenantId, createdAt)`, `download_events(tenantId, createdAt)` khi
  gian hàng lớn (expand-only, Quốc duyệt).
- Phụ đề header hiện `tenant.status` thô (`ACTIVE`…) — nhãn tiếng Việt ở BACKLOG.
- Link "Trả lời đánh giá" trỏ `/reviews?status=VISIBLE` — trang Đánh giá chưa có bộ lọc "chưa trả lời".
- ~~`getOrderDashboardStats` (`lib/order.ts`) không còn nơi gọi — xoá ở BACKLOG.~~ **Đã xoá** trong đợt ADR-048 (cùng `listTenantCustomers`) ✅ grep 2026-10-23.

---

## 9. Liên kết

* [[02-System-Specs/Tenant-Stats-Specs|Tenant-Stats-Specs]] §9 — so sánh với số liệu System Center ([Tenant-Stats-Specs.md](./Tenant-Stats-Specs.md))
* [[02-System-Specs/Order-State-Machine|Order-State-Machine]] — `paidAt`, trạng thái đơn, `tenant_customers` ([Order-State-Machine.md](./Order-State-Machine.md))
* [[02-System-Specs/Reviews-Specs|Reviews-Specs]] — trạng thái đánh giá, cache điểm ([Reviews-Specs.md](./Reviews-Specs.md))
* [[02-System-Specs/Abuse-Reports-Specs|Abuse-Reports-Specs]] — yêu cầu hoàn tiền ADR-039, khoá kiểm duyệt ([Abuse-Reports-Specs.md](./Abuse-Reports-Specs.md))
* [[03-API-Contracts/Endpoint-Directory|Endpoint-Directory]] §22 — contract loader ([Endpoint-Directory.md](../03-API-Contracts/Endpoint-Directory.md))
* [[04-Operations-Runbooks/UI-Design-System|UI-Design-System]] §19 ([UI-Design-System.md](../04-Operations-Runbooks/UI-Design-System.md))
* Mã nguồn: `packages/core/src/stats/dashboard-range{,.test}.ts`, `apps/web/lib/tenant-dashboard.ts`,
  `apps/web/app/studio/[tenantSlug]/(tong-quan)/**` (gồm `_ui/dashboard-range-picker.tsx`; picker dùng chung `apps/web/app/admin/_ui/date-range-picker.tsx` — lần 3, chuyển chỗ theo "Bổ sung ADR-046"), `apps/web/app/admin/_ui/stats-chart.tsx`,
  `apps/web/tests/integration/studio-dashboard.test.ts`

*Quay lại: [[MOC-Home]] (../00-Index/MOC-Home.md)*

---
tags:
  - spec
  - analytics
  - system-admin
  - jobs
  - database
  - status/living
date: 2026-10-16
updated: 2026-10-18
author: Long
---

# 📐 Đặc Tả: Thống Kê Hằng Ngày (M12b — ADR-037)

> Quyết định gốc: **ADR-037** trong [`docs/DECISIONS.md`](../../docs/DECISIONS.md) — mục 5 (thống kê gộp vào cron hằng ngày, "số liệu
> đến hết hôm qua"), mục 6 (test), và đoạn **"ADR-037 — M12b chốt định nghĩa số liệu"**. M12 chia 3 đợt: M12a Audit log
> ([[02-System-Specs/Audit-Log-Specs|Audit-Log-Specs]]) → **M12b Thống kê** (trang này) → M12c Báo cáo vi phạm (chưa làm). Bản trích KB:
> [[01-Architecture-Decisions/ADR-023-M12-Audit-Log-Append-Only|ADR-023 (≙ ADR-037)]]. ADR liên quan: ADR-034 (một DB dùng chung),
> ADR-036 (cron hằng ngày), CLAUDE.md §7.9 (admin không đọc đơn/khách của tenant).
>
> Mức xác minh: ✅ Long đã đối chiếu code working tree 2026-10-16 (**code chưa commit, chưa deploy**) · 🟡 theo brief/báo cáo của Quốc
> · ❓ cần môi trường thật. Trạng thái migration: **đã áp lên DB dùng chung 2026-10-16** 🟡 (Quốc báo; Long không chạy lệnh DB).

---

## 1. Phạm vi M12b

- Bảng L1 `tenant_daily_stats` — số liệu tổng hợp theo tenant + ngày giờ Việt Nam ✅.
- Job `stats.aggregate` trong cron `/api/cron/daily` (ADR-036) ✅.
- Section "Hoạt động bán tài liệu (30 ngày)" trên dashboard System Admin `/admin` ✅.
- **Không** thuộc M12b: thống kê cho tenant xem trong Studio (làm sau ở ADR-043, **không** đọc bảng này — xem §9 và
  [[02-System-Specs/Studio-Dashboard-Specs|Studio-Dashboard-Specs]]); báo cáo vi phạm (M12c); số liệu theo giờ (đặc tả gốc ghi "mỗi giờ" —
  ADR-037 mục 5 đổi thành hằng ngày).

---

## 2. Dữ liệu — bảng `tenant_daily_stats` ✅ (đọc schema + migration)

Model Prisma `TenantDailyStat`, migration `20261016120000_m12b_tenant_daily_stats`. Chi tiết cột/quyền:
[[03-API-Contracts/Database-Schema-Reference|Database-Schema-Reference]] (mục `TenantDailyStat` §3.1 và §7 "Migration M12b").

| Cột | Kiểu | Ý nghĩa |
| :-- | :-- | :-- |
| `tenantId` | `TEXT`, FK `tenants` `ON DELETE CASCADE` | Gian hàng |
| `date` | `DATE` | **Ngày theo giờ `Asia/Ho_Chi_Minh`**, không phải ngày UTC |
| `ordersPaid` | `INTEGER` | Số đơn có `paidAt` trong ngày |
| `gmvVnd` | `BIGINT` | Tổng `orders.totalVnd` (đã trừ giảm giá) của các đơn đó |
| `newCustomers` | `INTEGER` | Số khách mới của tenant trong ngày (§3) |
| `downloads` | `INTEGER` | Số dòng `download_events` trong ngày |
| `updatedAt` | `TIMESTAMP(3)` (UTC) | Lần ghi gần nhất |

- Unique `(tenantId, date)`, index `(date)`. ID cuid2.
- **Layer L1, không RLS** (cùng mẫu `subscriptions`/`audit_logs`: có `tenantId` nhưng là bảng hệ thống). Chỉ job ghi (dưới
  `withSystemJob`); admin đọc bằng `getPrismaClient()`.
- **Khác `audit_logs`:** có khoá ngoại Cascade — bảng tổng hợp, tính lại được từ nguồn, không bất biến.
- **Không dữ liệu cá nhân:** chỉ số đếm/tổng tiền — không email, tên, mã đơn (§7.9). Integration test kiểm danh sách cột đúng 8 cột
  `date, downloads, gmvVnd, id, newCustomers, ordersPaid, tenantId, updatedAt` ✅ đọc test.
- Ngày **không có hoạt động: không tạo dòng** — nơi đọc coi thiếu dòng = 0.

---

## 3. Định nghĩa số liệu ✅ (đọc `apps/web/lib/tenant-stats.ts`)

Ngày D = ngày giờ VN. Cột thời gian nguồn là `TIMESTAMP(3)` không múi giờ, lưu UTC → quy đổi bằng
`(col AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Ho_Chi_Minh'` rồi `::date` (không phụ thuộc TimeZone của phiên); biên lọc tính sẵn ra UTC.

| Số liệu | Nguồn | Quy tắc |
| :-- | :-- | :-- |
| `ordersPaid`, `gmvVnd` | `orders.paidAt` | Đơn có `paidAt` rơi vào D, **không lọc trạng thái** — **GMV gộp**: đơn sau này `REFUNDED` vẫn tính vào ngày đã trả; hoàn tiền không trừ ngược ngày cũ |
| `newCustomers` | `tenant_customers.firstOrderAt` | Bảng `tenant_customers` **không có cột `createdAt`**; dòng chỉ được tạo khi đơn đầu tiên của khách tại tenant chuyển PAID (upsert trong `lib/order.ts` đặt `firstOrderAt = paidAt`, lần sau giữ nguyên) → dùng `firstOrderAt` làm thời điểm tạo dòng. Quốc duyệt cách hiểu này 🟡 (brief 2026-10-16) |
| `downloads` | `download_events.createdAt` | Mọi dòng `download_events` trong D |

Ví dụ biên ngày (từ integration test ✅ đọc test): đơn trả lúc 00:30 giờ VN ngày D (= 17:30 UTC ngày D-1) tính vào **D**; đơn 23:30 giờ VN
ngày D-1 tính vào D-1.

---

## 4. Job `stats.aggregate` ✅

### 4.1. `aggregateTenantDailyStats({ fromDate, toDate, tenantIds? })`

- Kiểm đầu vào: ngày `YYYY-MM-DD` hợp lệ, `fromDate ≤ toDate`, khoảng ≤ **400 ngày** — sai → `AppError VALIDATION_ERROR`.
- Chia khoảng thành **cửa sổ 31 ngày**; mỗi cửa sổ là 1 transaction `withSystemJob` (giữ dưới timeout transaction tương tác của Prisma).
- Đầu mỗi transaction: `pg_advisory_xact_lock(hashtext('stats.aggregate'))` — 2 lần chạy chồng nhau được tuần tự hoá.
- Trong cửa sổ: (1) một câu SELECT tổng hợp 3 nguồn theo (tenant, ngày); (2) dòng đã có trong khoảng nhưng nay không còn hoạt động (vd
  dữ liệu nguồn bị xoá) được **đưa về 0**; (3) upsert theo khoá `(tenantId, date)` — `createMany(skipDuplicates)` để Prisma sinh id cuid2,
  rồi `UPDATE ... FROM unnest(...)` ghi đè số liệu, chia lô 500 dòng. Cùng transaction nên nơi đọc không thấy trạng thái 0 tạm thời.
- **Idempotent:** chạy lại cùng khoảng cho cùng kết quả (test gọi 2 lần liên tiếp, đều trả 2) ✅ đọc test.
- `tenantIds` chỉ dùng cho integration test — giới hạn tenant để không ghi đè dòng của tenant khác trên DB dùng chung (ADR-034); cron luôn
  gọi không lọc.

### 4.2. `runStatsAggregation(now)` — bước cron

- Mặc định tính lại **hôm qua + hôm nay** (giờ VN), upsert.
- **Bảng trống** → backfill từ ngày VN có hoạt động sớm nhất ở bất kỳ nguồn nào (`MIN(paidAt)`, `MIN(firstOrderAt)`, `MIN(createdAt)`),
  sàn **400 ngày tính cả hôm nay**; không có dữ liệu hoặc ngày sớm nhất ≥ hôm qua → chỉ tính hôm qua + hôm nay.
- Bảng chưa tồn tại (code lên trước migration — P2021/42P01) → `{ skipped: true }` + `logger.warn`, bước cron không lỗi.
- Kết quả `{ skipped, backfilled, fromDate, toDate, upserted }` — chỉ số đếm.

### 4.3. Vị trí trong cron

`GET /api/cron/daily` (03:00 giờ VN, [[02-System-Specs/Background-Jobs-Specs|Background-Jobs-Specs]] §5): `subscription.sweep` →
`order.sweep` → `queue.supervise` → `audit.purge` → **`stats.aggregate`** → `queue.drain`. Mỗi bước cô lập; bước lỗi làm route trả
`500 CRON_STEP_FAILED` nhưng không bỏ bước khác. Response thêm khoá `results.statsAggregate`. Contract:
[[03-API-Contracts/Endpoint-Directory|Endpoint-Directory]] §17, §19.

**Backfill lần đầu:** bảng đang trống trên DB dùng chung 🟡 (Quốc kiểm 2026-10-16) — sẽ backfill ở lần cron đầu tiên sau deploy (hoặc bấm
Run thủ công, [[04-Operations-Runbooks/Deploy-Vercel-Runbook|Deploy-Vercel-Runbook]] §6). Backfill dài chạy nhiều cửa sổ 31 ngày trong cùng
ngân sách `maxDuration = 60` giây của route — chưa có ngân sách thời gian riêng cho bước này (BACKLOG) ❓ thời gian thực trên Vercel.

---

## 5. Đọc — `getAdminStatsOverview({ days: 30 })` ✅ (đọc `apps/web/lib/admin-stats.ts`)

- **§7.9:** chỉ đọc `tenant_daily_stats` + `tenants` (`id`, `name`, `slug`). Không bao giờ đọc `orders`/`order_items`/`tenant_customers`/
  `download_events`.
- **Không tự kiểm quyền** — nơi gọi phải đảm bảo SYSTEM_ADMIN. Trang `/admin` gọi `requireAdminAccess("/admin")` (không phải
  SYSTEM_ADMIN → `notFound()`) trước khi render ✅.
- Cửa sổ **30 ngày kết thúc ở hôm qua** (giờ VN) — cron chạy 03:00 nên số của hôm nay chưa đầy đủ. `prevTotals` = 30 ngày liền trước (để
  tính % thay đổi).
- `series` đủ 30 điểm, cũ → mới, ngày thiếu dòng = 0.
- `topTenants`: tối đa 5 tenant theo GMV 30 ngày giảm dần, **chỉ tenant có GMV > 0**; mỗi phần tử chỉ `tenantId`, `name`, `slug`, `gmvVnd`,
  `ordersPaid`.
- `lastAggregatedAt` = `MAX(updatedAt)` toàn bảng (ISO UTC), null khi bảng trống.
- Tiền trả dạng **chuỗi** số nguyên VND (BIGINT, không qua float).
- Bảng chưa có → `{ status: "unavailable" }` (dashboard hiện thông báo, không 500).

Contract kiểu: [[03-API-Contracts/Endpoint-Directory|Endpoint-Directory]] §19.2.

---

## 6. Giao diện ✅ (đọc code; bố cục chi tiết ở [[04-Operations-Runbooks/UI-Design-System|UI-Design-System]] §16)

Section "Hoạt động bán tài liệu (30 ngày)" trên `/admin`, nằm sau khối thanh toán gói gần đây và trước "Thao tác nhanh"; bọc `<Suspense>`
riêng (khung chờ `SalesStatsSkeleton`) để phần còn lại của dashboard không phải chờ. Gồm 4 thẻ KPI (GMV, Đơn đã thanh toán, Khách mới, Lượt
tải) + % so với 30 ngày trước, biểu đồ cột theo ngày (chọn GMV/Đơn qua `?chi-so=gmv|don`), bảng số liệu theo ngày trong `<details>`, top 5
gian hàng (link mở storefront ở tab mới). Ghi chú đầu section: "Số liệu tổng hợp hằng ngày lúc 03:00, tính đến hết hôm qua — cập nhật lần
cuối …. GMV là tổng tiền khách trả (gộp, chưa trừ hoàn tiền)."

---

## 7. Test

- `apps/web/tests/integration/stats.test.ts` — `describe("M12 stats")`, 1 case "stats: daily aggregation writes tenant_daily_stats without
  personal data and admin dashboard can read it" ✅ đọc test: tạo tenant tạm + đơn ở biên ngày VN (gồm 1 đơn REFUNDED và GMV 3 tỷ để thử
  BIGINT), khách, lượt tải; aggregate 2 lần (idempotent); kiểm danh sách cột qua `information_schema` và dòng đã ghi không chứa email, id khách, IP hay mã đơn;
  `getAdminStatsOverview` đọc được (30 điểm, `lastAggregatedAt` khác null, chênh lệch đúng số dự kiến, `topTenants` chỉ 5 khoá). Dọn dữ liệu
  tạm ở `afterAll` (`tenant_daily_stats` xoá theo Cascade của tenant); dòng `audit_logs` do `createTenantForUser` sinh ra không xoá được —
  chấp nhận (ADR-037).
- **Đã chạy pass 2026-10-16 trên DB thật**, dọn sạch 🟡 (Quốc báo; Quốc sửa cast `column_name::text` trong test).
- `pnpm test:count` (Long chạy 2026-10-16, chỉ đếm): **93/94 unit, 54/55 integration** ✅ — test này là test M12 thứ 2 trong trần 55 của
  ADR-037 mục 6. Còn 1 chỗ trống integration (55).
- Rủi ro thấp: test đọc tổng toàn nền tảng qua chênh lệch trước/sau — có thể lệch nếu cron ghi trùng ngày D đúng lúc test chạy (BACKLOG).
- Hàm ngày `vnDateString`/`addDays` chưa có unit test (trần unit 94 chưa nâng — BACKLOG).

---

## 8. Giới hạn đã biết (chi tiết `docs/BACKLOG.md` mục M12b)

- Chưa có index `orders("paidAt")` — truy vấn tổng hợp quét theo `paidAt`; thêm khi dữ liệu lớn.
- Bước cron chưa có ngân sách thời gian riêng khi backfill dài (route `maxDuration` 60 giây). Hệ quả ✅ đọc code: backfill bị cắt giữa
  chừng thì các cửa sổ đã commit được giữ, nhưng vì bảng đã có dòng nên lần chạy sau chỉ tính hôm qua + hôm nay — ngày cũ chưa ghi không
  tự bù (chỉ gọi `aggregateTenantDailyStats` với khoảng cụ thể mới bù được; chưa có lối chạy tay — BACKLOG).
- Lời trạng thái `unavailable`/rỗng trước lần backfill đầu dễ hiểu nhầm — BACKLOG "Giao diện" mục M12b; tạm giảm thiểu bằng bấm Run cron
  sau deploy.
- GMV gộp không phản ánh hoàn tiền — cố ý theo ADR-037; dashboard ghi rõ.
- Hành vi trên Vercel production (backfill lần đầu, thời gian chạy, số liệu thật) ❓ — code chưa deploy.

---

## 9. Chênh lệch với dashboard Tổng quan gian hàng (ADR-043) ✅ (đối chiếu code 2026-10-18)

Dashboard Studio `/studio/{slug}` ([[02-System-Specs/Studio-Dashboard-Specs|Studio-Dashboard-Specs]]) tính **realtime từ bảng L2 qua
`withTenant`**, không đọc `tenant_daily_stats`. Hai nơi có thể hiện số khác nhau cho cùng gian hàng — **đúng thiết kế**:

| Chỉ số | System Center (`tenant_daily_stats`, M12b) | Studio Tổng quan (ADR-043) |
| :-- | :-- | :-- |
| Cửa sổ | 30 ngày lịch VN **kết thúc hôm qua**, cập nhật bởi cron 03:00 | Kỳ chọn `?ky=` (mặc định 30 ngày **gồm hôm nay**, tới thời điểm mở trang) |
| Doanh thu / GMV | Σ `totalVnd` theo `paidAt`, gồm đơn sau này hoàn — **gộp** | "Doanh thu (gộp)" cùng định nghĩa (đơn 0đ cộng 0 nên tổng tiền không đổi) + thêm "Doanh thu thực nhận" = gộp − đơn hiện `REFUNDED` (theo ngày trả) |
| Đơn đã thanh toán | `ordersPaid` đếm **mọi** đơn có `paidAt`, **kể cả đơn 0đ** (`lib/tenant-stats.ts` không lọc `totalVnd`) | `paidOrders` **chỉ đơn > 0đ**; đơn 0đ đếm riêng ở "Lượt nhận tài liệu miễn phí" (Bổ sung ADR-043) |
| Khách mới | `tenant_customers.firstOrderAt` | Cùng định nghĩa (gồm khách chỉ nhận miễn phí) |
| Lượt tải | `download_events.createdAt` | Cùng định nghĩa |

→ Cùng khoảng ngày, **tiền gộp và khách mới khớp nhau**, **số đơn lệch đúng bằng số đơn 0đ**. Không phải lỗi; ghi để không "sửa" nhầm.

---

## 10. Liên kết

* [[02-System-Specs/Studio-Dashboard-Specs|Studio-Dashboard-Specs]] — dashboard Studio ADR-043, §9 ([Studio-Dashboard-Specs.md](./Studio-Dashboard-Specs.md))
* [[02-System-Specs/Audit-Log-Specs|Audit-Log-Specs]] — M12a cùng ADR-037 ([Audit-Log-Specs.md](./Audit-Log-Specs.md))
* [[02-System-Specs/Background-Jobs-Specs|Background-Jobs-Specs]] §5 — cron hằng ngày ([Background-Jobs-Specs.md](./Background-Jobs-Specs.md))
* [[02-System-Specs/User-Management-System-Center-Specs|User-Management-System-Center-Specs]] — System Center, ranh giới §7.9 ([User-Management-System-Center-Specs.md](./User-Management-System-Center-Specs.md))
* [[02-System-Specs/Order-State-Machine|Order-State-Machine]] — `paidAt`, `tenant_customers` ([Order-State-Machine.md](./Order-State-Machine.md))
* [[03-API-Contracts/Database-Schema-Reference|Database-Schema-Reference]] ([Database-Schema-Reference.md](../03-API-Contracts/Database-Schema-Reference.md))
* [[03-API-Contracts/Endpoint-Directory|Endpoint-Directory]] §17, §19 ([Endpoint-Directory.md](../03-API-Contracts/Endpoint-Directory.md))
* [[04-Operations-Runbooks/UI-Design-System|UI-Design-System]] §16 ([UI-Design-System.md](../04-Operations-Runbooks/UI-Design-System.md))
* [[04-Operations-Runbooks/Deploy-Vercel-Runbook|Deploy-Vercel-Runbook]] §6, §9.7 ([Deploy-Vercel-Runbook.md](../04-Operations-Runbooks/Deploy-Vercel-Runbook.md))
* Mã nguồn: `apps/web/lib/{tenant-stats,admin-stats}.ts`, `apps/web/app/api/cron/daily/route.ts`, `apps/web/app/admin/page.tsx`,
  `apps/web/app/admin/_ui/sales-stats.tsx`, `apps/web/tests/integration/stats.test.ts`,
  `packages/db/prisma/migrations/20261016120000_m12b_tenant_daily_stats/migration.sql`

*Quay lại: [[MOC-Home]] (../00-Index/MOC-Home.md)*

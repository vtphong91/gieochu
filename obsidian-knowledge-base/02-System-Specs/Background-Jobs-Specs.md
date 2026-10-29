---
tags:
  - spec
  - jobs
  - deployment
  - order
  - payment
  - status/living
date: 2026-10-16
updated: 2026-10-27
author: Long
---

# 📐 Đặc Tả: Job Nền & Cron (M11 — Background Jobs, ADR-036)

> Quyết định gốc: **ADR-036** + đoạn "Chủ dự án chốt (2026-10-16)" trong [`docs/DECISIONS.md`](../../docs/DECISIONS.md) (bản trích KB:
> [[01-Architecture-Decisions/ADR-022-Background-Jobs-After-And-Daily-Cron|ADR-022 (≙ ADR-036)]]). ADR liên quan: ADR-007 (`DIRECT_URL` cho pg-boss), ADR-019
> (`order.sweep` 5 phút — nay chỉ còn ở worker local), ADR-031 mục 4 (Vercel không chạy worker), ADR-032 (cấu hình nghiệp vụ
> đọc từ DB), ADR-034 (một DB dùng chung).
>
> Mức xác minh: ✅ Long đã đối chiếu code working tree 2026-10-16 (code **đã commit `9a3208f`**, deploy ❓) · 🟡 theo `docs/DECISIONS.md`/brief
> của Quốc · ❓ cần môi trường thật (Vercel/Neon). **Chưa có test tự động** cho phần mới (nợ test — §8).

---

## 1. Bối cảnh

Vercel không chạy tiến trình thường trực nên `apps/web/worker.ts` (pg-boss `work`) không có nơi chạy (ADR-031 mục 4). ADR-036
chọn xử lý job **ngay trong app**, không dùng dịch vụ ngoài (cron-job.org) hay server riêng 🟡:

1. **Job phát sinh từ request** (`payment.process`, `file.scan`): vẫn `send` vào pg-boss trước (bản ghi bền), rồi `after()` của
   Next.js xử lý hàng đợi ngay sau khi trả response.
2. **Việc định kỳ**: một route `GET /api/cron/daily` do **Vercel Cron** gọi mỗi ngày (gói Hobby chỉ cho tần suất ngày).
3. **Đơn PENDING quá hạn**: luồng đọc/thanh toán coi là hết hạn ngay (`effectiveOrderStatus`) — sweep chỉ đồng bộ DB
   ([[02-System-Specs/Order-State-Machine|Order-State-Machine]] §3.4).
4. `worker.ts` giữ cho local/server riêng, **không deploy**.

Theo kiểm hàng đợi chỉ đọc ngày 2026-10-16: 18 job `payment.process` trạng thái `created` đều từ integration test (`evt_m8test_*`,
tenant đã xoá), không có đơn khách thật kẹt 🟡.

---

## 2. Hàng đợi

`QUEUE_NAMES` (`packages/jobs/src/queue.ts`) ✅:

| Hàng đợi | Phát sinh | Trên Vercel (ADR-036) | Worker local (`worker.ts`) |
| :-- | :-- | :-- | :-- |
| `payment.process` | Webhook thanh toán **tenant** (`enqueuePaymentProcess`) | `after()` trong route webhook + cron dọn sót | `work` thường trực |
| `file.scan` | `uploads/complete` (`enqueueFileScan`) | `after()` trong route upload + cron dọn sót | `work` thường trực |
| `order.sweep` | Lịch | **Không dùng hàng đợi** — cron gọi thẳng `runOrderSweep()` | `schedule("*/5 * * * *")` |
| `subscription.sweep` | Lịch | **Không dùng hàng đợi** — cron gọi thẳng `runSubscriptionSweep()` | `schedule("0 * * * *")` |

Email **không** đi qua hàng đợi — gửi đồng bộ bằng `sendEmailNow()` (comment đầu `worker.ts`) ✅.

---

## 3. `packages/jobs` — API `JobQueue`

`createJobQueue(directConnectionString, { schedule?, supervise? })` ✅ — pg-boss phải dùng kết nối **không pooler** (`DIRECT_URL`,
ADR-007). Hai cờ mặc định `true` (mặc định pg-boss):

| Cờ | Ý nghĩa | Web app (`lib/jobs.ts`) | `worker.ts` |
| :-- | :-- | :-: | :-: |
| `schedule` | Vòng cron của pg-boss: biến dòng `pgboss.schedule` thành job | `false` | `true` |
| `supervise` | Bộ hẹn giờ bảo trì: trả job `active` quá hạn về retry, dọn job cũ | `false` | `true` |

Lý do tắt ở web ✅ (comment `lib/jobs.ts`): bật `schedule` sẽ sinh job `order.sweep`/`subscription.sweep` không ai tiêu thụ trên
Vercel; bộ hẹn giờ bảo trì không đáng tin trong function sống ngắn — cron gọi `supervise()` thay thế.

Phương thức ✅:

| Hàm | Hành vi |
| :-- | :-- |
| `start` / `stop` / `ensureQueue(name)` | Như trước |
| `send(name, data, options?)` | `SendJobOptions`: `retryLimit?`, `retryDelay?` (giây), `retryBackoff?`. Không truyền → mặc định pg-boss |
| `work(name, handler)` | Đăng ký worker thường trực (chỉ `worker.ts` dùng) |
| `schedule(name, cron)` | Lịch lặp, múi giờ UTC (chỉ `worker.ts`) |
| `fetch(name, { batchSize? })` | **Mới.** Nhận tối đa `batchSize` job sẵn sàng (mặc định 1), pg-boss chuyển sang `active` (khoá dòng, SKIP LOCKED) — người gọi **phải** `complete`/`fail` từng job |
| `complete(name, id)` | **Mới.** Đánh dấu xong |
| `fail(name, id, error)` | **Mới.** Đánh dấu lỗi → pg-boss lên lịch thử lại khi còn `retryLimit`, hết thì `failed`. Cột output chỉ ghi `{ name, message }` của lỗi — không stack, không thuộc tính khác (tránh PII/secret) |
| `supervise(name)` | **Mới.** Một lượt bảo trì theo yêu cầu cho hàng đợi (chạy được khi timer tắt): job `active` quá hạn → retry/failed, xoá job cũ theo retention. `reindex: false` — không REINDEX trên DB dùng chung |

Export thêm type: `FetchedJob`, `FetchJobsOptions`, `JobQueueOptions`, `SendJobOptions` (`packages/jobs/src/index.ts`) ✅.

---

## 4. Phía web app

### 4.1. `apps/web/lib/jobs.ts`

- `getStartedQueue()` (nay **export**): singleton lười theo tiến trình / instance serverless ấm, tạo queue với
  `{ schedule: false, supervise: false }`, `start()` + `ensureQueue` cho `file.scan`, `payment.process`. **Start lỗi không bị cache**
  — lần gọi sau thử lại ✅.
- `enqueueFileScan` / `enqueuePaymentProcess` gửi kèm `REQUEST_JOB_RETRY = { retryDelay: 60, retryBackoff: true }` ✅ — vì drain chạy
  vòng lặp, với `retryDelay: 0` mặc định của pg-boss một lỗi tạm thời sẽ đốt hết số lần thử trong cùng một lượt drain. Không đặt
  `retryLimit` → dùng mặc định của hàng đợi pg-boss ❓ (giá trị cụ thể chưa đối chiếu trên DB).

### 4.2. `apps/web/lib/job-handlers.ts` — bảng handler dùng chung

`DRAINABLE_QUEUES = [payment.process, file.scan]`, `JOB_HANDLERS` ✅ — nguồn duy nhất định nghĩa job làm gì, dùng chung cho
`worker.ts` (`work`) và `job-runner.ts` (`drainQueues`). Không import `next/*` để `worker.ts` chạy được dưới Node thuần. Mỗi handler
giữ scope RLS cũ: `processPaymentEvent` → `withTenant(data.tenantId)`, `runFileScan` → `withSystemJob` ✅ (theo comment; ranh giới
RLS không đổi so với worker).

### 4.3. `apps/web/lib/job-runner.ts`

- **`drainQueues({ names, budgetMs, batchSize? })`** ✅ — xử lý lần lượt từng hàng đợi trong `names`, dùng chung ngân sách thời gian:
  - Ngân sách là **mềm**: kiểm trước mỗi lần `fetch`; lô đã nhận luôn được làm xong (không bỏ job `active`), nên thời gian thật có
    thể vượt một lô. `batchSize` mặc định **5**.
  - Handler ném lỗi → `failed += 1`, log, `fail()` rồi chạy tiếp job khác (job lạ/tenant không tồn tại không làm hỏng cả lô — ADR-036
    mục 5). `fail()` lỗi → job ở `active` tới khi hết hạn, bảo trì trả lại.
  - `complete()` lỗi sau khi handler đã chạy → job chạy lại sau khi hết hạn; dựa vào tính idempotent của handler
    (`processPaymentEvent`: giao dịch unique + đơn PAID thì bỏ qua; `runFileScan`: kiểm `scanStatus`) — theo comment code ✅, chưa
    kiểm bằng test ❓.
  - Lỗi khi nói chuyện với chính hàng đợi → log, kết thúc sớm, **không ném**.
  - Trả `{ processed, failed, budgetExhausted }`.
- **`scheduleQueueDrain(names, budgetMs = 20_000)`** ✅ — bọc `after()` từ `next/server`; drain chạy sau khi response đã gửi. Ngoài
  request scope (ví dụ test gọi thẳng hàm route) `after()` ném đồng bộ → log `warn`, nuốt lỗi, job chờ lượt drain sau. **Không bao giờ
  ném**, nên không thể biến 2xx thành 500.
- **`superviseQueues(names)`** ✅ — gọi `supervise()` cho từng hàng đợi; **ném lỗi** (cron bọc trong bước riêng).

### 4.4. Route gọi `scheduleQueueDrain`

| Route | Hàng đợi drain | `maxDuration` |
| :-- | :-- | :-: |
| `POST /api/webhooks/tenants/[tenantId]/[provider]` | `payment.process` (sau khi đã ghi `webhook_events` + enqueue) | 60 |
| `POST /api/studio/[tenantSlug]/uploads/complete` | `file.scan` | 60 |

`maxDuration = 60` vì `after()` chạy trong vòng đời của chính function — chừa chỗ cho drain ~20 giây ✅. Hành vi `after()` trên
Vercel (thời gian sống thật của function sau response) ❓ — chưa kiểm trên môi trường thật.

---

## 5. Cron hằng ngày — `GET /api/cron/daily`

File: `apps/web/app/api/cron/daily/route.ts` ✅. Contract đầy đủ: [[03-API-Contracts/Endpoint-Directory|Endpoint-Directory]] §17.

- **Lịch:** `apps/web/vercel.json` `"crons": [{ "path": "/api/cron/daily", "schedule": "0 20 * * *" }]` — 20:00 UTC = **03:00 giờ
  Việt Nam** ✅. Vercel Cron gửi header `Authorization: Bearer <CRON_SECRET>` khi biến `CRON_SECRET` có trên project 🟡 (hành vi nền
  tảng, chưa tự kiểm).
- **Xác thực:** so sánh cả chuỗi `Bearer <secret>` bằng `timingSafeEqual`, độ dài khác → từ chối trước (vì `timingSafeEqual` ném khi
  khác độ dài) ✅. Thiếu `CRON_SECRET` → **503** `CRON_NOT_CONFIGURED`; sai/thiếu header → **401** `UNAUTHORIZED`.
- **Các bước** — chạy tuần tự, **mỗi bước cô lập** (bước lỗi không làm bỏ bước sau) ✅:
  1. `subscriptionSweep` — `runSubscriptionSweep()` trực tiếp;
  2. `orderSweep` — `runOrderSweep()` trực tiếp, kết quả `{ expired: <số đơn chuyển EXPIRED> }`;
  2a. `orderReminders` *(thêm ở ADR-061 Q7, đợt 1 2026-10-27 — chưa commit — bước `order.payment_reminders`)* — `runOrderPaymentReminders()` (`lib/order-customer.ts`):
     nhắc **1 lần** các đơn `PENDING`, đã chọn phương thức, `expiresAt` trong (now, now + 24 giờ], chưa có `customerReminderSentAt` (≤ 500 đơn/lần, `withSystemJob`;
     nhận mốc nguyên tử trước khi gửi email `order_payment_reminder`); kết quả `{ sent }`. Chạy ngay sau `orderSweep`. Chi tiết:
     [[02-System-Specs/Payment-And-Billing|Payment-And-Billing]] §5K;
  2b. `rateLimitPurge` *(thêm ở ADR-061 Q1 — bước `rate_limit_counters.purge`)* — `purgeExpiredRateLimitCounters()` (`lib/rate-limit-store.ts`) xoá dòng
     `rate_limit_counters` có `resetAt < now`; kết quả `{ deleted }`. Bảng L1, dùng cho rate limit khách vãng lai (task 12/13);
  3. `queueMaintenance` — `superviseQueues([payment.process, file.scan])`, kết quả `{ queues: 2 }`;
  4. `auditPurge` *(thêm ở M12a, ADR-037)* — `audit.purgeExpired()` xoá dòng `audit_logs` cũ hơn 12 tháng, kết quả
     `{ deleted, skipped }` (`skipped: true` khi bảng chưa tồn tại). Đặt **trước** bước drain vì drain dùng phần lớn ngân sách thời gian.
     Chi tiết: [[02-System-Specs/Audit-Log-Specs|Audit-Log-Specs]] §6;
  5. `statsAggregate` *(thêm ở M12b, ADR-037)* — `runStatsAggregation()` tính lại `tenant_daily_stats` cho hôm qua + hôm nay (giờ VN);
     bảng trống → backfill ≤ 400 ngày; kết quả `{ skipped, backfilled, fromDate, toDate, upserted }`. Đặt sau `auditPurge`, trước drain.
     Chi tiết: [[02-System-Specs/Tenant-Stats-Specs|Tenant-Stats-Specs]] §4;
  6. `reportIpPurge` *(thêm ở M12c, ADR-038 — bước `abuse_report.ip_purge`)* — `purgeExpiredAbuseReportIps()` đặt `ip = NULL` cho báo
     cáo vi phạm cũ hơn 12 tháng (giữ báo cáo); kết quả `{ cleared, skipped }`. Đặt sau `statsAggregate`, trước drain. Chi tiết:
     [[02-System-Specs/Abuse-Reports-Specs|Abuse-Reports-Specs]] §8;
  7. `sessionPurge` *(thêm ở ADR-053 — bước `refresh_tokens.purge`)* — `purgeStaleRefreshTokens()` xoá dòng `refresh_tokens` có `expiresAt` hoặc
     `revokedAt` cũ hơn 90 ngày; kết quả `{ deleted }`. Đặt sau `reportIpPurge`, trước drain. Chi tiết:
     [[02-System-Specs/Auth-Session-Specs|Auth-Session-Specs]] §8;
  8. `downloadPurge` *(thêm ở ADR-054 mục 8 — bước `download_events.purge`)* — `purgeExpiredDownloadEvents()` (`lib/download.ts`) xoá dòng
     `download_events` (nhật ký tải, có IP) có `createdAt` cũ hơn **12 tháng** (so UTC như audit purge); bảng L2 RLS `FORCE` → chạy qua
     `withSystemJob` (policy `tenant_isolation` có nhánh `system_job` ✅ đọc SQL `rls_m9`). Giới hạn lượt tải dựa trên bộ đếm
     `entitlements.downloadsUsed`/share link, không đếm lại dòng này → xoá không mở thêm lượt tải (comment code). Kết quả `{ deleted }`. Đặt sau
     `sessionPurge`, trước drain. Nghiệp vụ: [[02-System-Specs/Legal-Documents-Specs|Legal-Documents-Specs]] §10;
  9. `queues` — `drainQueues` hai hàng đợi trên, ngân sách **40 giây**, kết quả `DrainQueuesResult`.
- **Chưa có bước dọn nháp editor** (ADR-053 bổ sung lần 3): hàm `purgeStaleDrafts()` đã có ở `lib/editor-draft.ts` nhưng **chưa gắn** vào route cron ✅
  — [[02-System-Specs/Editor-Autosave-Drafts-Specs|Editor-Autosave-Drafts-Specs]] §6.
- Email M12c/ADR-039 (kết quả xử lý báo cáo, quyền lợi người mua, yêu cầu hoàn tiền) **không** đi qua hàng đợi — gửi bằng `sendEmailNow`
  trong `after()` của Server Action, tuần tự ✅ (job theo lô cho sản phẩm nhiều người mua là BACKLOG).
- **Response:** chỉ có số đếm — không dữ liệu tenant/đơn/khách (§7.9) ✅. Có bước lỗi → **500** `CRON_STEP_FAILED` kèm `results`.
- `maxDuration = 60`, `dynamic = "force-dynamic"` ✅.

---

## 6. Biến môi trường `CRON_SECRET`

`packages/config/src/env.ts` ✅: **tuỳ chọn**; chuỗi rỗng coi như chưa đặt; nếu đặt thì **≥ 32 ký tự** — ngắn hơn làm `getEnv()` lỗi
(fail-fast, cả app dừng). Thiếu → app vẫn chạy, chỉ route cron trả 503 (sweep + dọn hàng đợi hằng ngày không chạy). Hướng dẫn đặt trên
Vercel: [[04-Operations-Runbooks/Deploy-Vercel-Runbook|Deploy-Vercel-Runbook]] §3.4, §6.

Danh sách env runtime: **8 biến bắt buộc** (ADR-032) + `CRON_SECRET` tuỳ chọn + `CLAMAV_HOST` tuỳ chọn ✅; từ ADR-045 (2026-10-22) thêm
`STORAGE_GATEWAY_PROVIDERS` tuỳ chọn ✅ — xem [[02-System-Specs/File-Storage-And-Downloads-Specs|File-Storage-And-Downloads-Specs]] §9.

---

## 7. `apps/web/worker.ts` (không deploy)

Giữ cho chạy local/server riêng (`pnpm --filter @gieochu/web run worker` → `tsx worker.ts`) ✅: `createJobQueue(DIRECT_URL)` với
`schedule`/`supervise` mặc định **bật**, `schedule` `subscription.sweep` hằng giờ và `order.sweep` 5 phút, `work` 4 hàng đợi;
`payment.process`/`file.scan` dùng `JOB_HANDLERS`. Lưu ý: chạy worker local trên DB dùng chung (ADR-034) sẽ ghi lại dòng
`pgboss.schedule` mà SQL dọn 2026-10-16 vừa xoá (Deploy-Vercel-Runbook §6.3) — suy từ code ✅, cần Quốc quyết có cho chạy worker
local nữa không.

---

## 8. Giới hạn đã biết & nợ (chi tiết ở `docs/BACKLOG.md` mục "Phát sinh trong đợt ADR-036")

- **Job `active` kẹt** (drain bị cắt bởi timeout function) chỉ được trả lại khi cron chạy `supervise` — tức **tối đa ~24h**. Muốn dày
  hơn: cắm thêm lịch ngoài (cron-job.org) vào cùng route.
- **Sweep thuê bao trễ tối đa ~24h** (trước: hằng giờ).
- **Integration test "the hourly sweep expires an overdue PENDING order…"** (`order.test.ts`) đọc trạng thái qua `getOrderDetail` —
  hàm này nay trả trạng thái hiệu lực, nên test vẫn qua kể cả khi `runOrderSweep` không ghi DB ✅ (đọc code). Nên đọc status thô.
- **Integration test M8 dọn job pg-boss** của chính lượt chạy trong `afterAll` (`findJobs` theo `tenantId` rồi `deleteJob`) ✅ đọc code
  — **chưa chạy thật** ❓.
- **Nợ test:** `drainQueues`, xác thực route cron (401/503), `effectiveOrderStatus`. Đợt ADR-036 không thêm test: **93/94 unit, 52/53
  integration** ✅ (`pnpm test:count` Long chạy 2026-10-16 — đếm số case, không chạy test). Sau M12a (ADR-037) số hiện là **93/94 unit,
  53/55 integration** — test mới là `audit.test.ts`, không phải test job nền.

---

## 9. Liên kết

* [[02-System-Specs/Order-State-Machine|Order-State-Machine]] §3.1, §3.4 — `effectiveOrderStatus`, cửa sổ 24h ([Order-State-Machine.md](./Order-State-Machine.md))
* [[02-System-Specs/Payment-And-Billing|Payment-And-Billing]] §3 — webhook tenant + `after()` ([Payment-And-Billing.md](./Payment-And-Billing.md))
* [[02-System-Specs/File-Storage-And-Downloads-Specs|File-Storage-And-Downloads-Specs]] §3 — `file.scan` ([File-Storage-And-Downloads-Specs.md](./File-Storage-And-Downloads-Specs.md))
* [[03-API-Contracts/Endpoint-Directory|Endpoint-Directory]] §17 — contract route cron ([Endpoint-Directory.md](../03-API-Contracts/Endpoint-Directory.md))
* [[04-Operations-Runbooks/Deploy-Vercel-Runbook|Deploy-Vercel-Runbook]] §3.4, §6 — `CRON_SECRET`, Vercel Cron, SQL dọn job ([Deploy-Vercel-Runbook.md](../04-Operations-Runbooks/Deploy-Vercel-Runbook.md))
* Mã nguồn: `packages/jobs/src/queue.ts`, `apps/web/lib/{jobs,job-handlers,job-runner}.ts`, `apps/web/app/api/cron/daily/route.ts`,
  `apps/web/vercel.json`, `apps/web/worker.ts`, `packages/core/src/order/expiry.ts`

*Quay lại: [[MOC-Home]] (../00-Index/MOC-Home.md)*

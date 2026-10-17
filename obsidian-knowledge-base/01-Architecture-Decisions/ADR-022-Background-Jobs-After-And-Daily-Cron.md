---
tags:
  - adr
  - jobs
  - deployment
  - order
  - status/accepted
date: 2026-10-16
decider: vtphong91
status: Accepted (Chốt — Áp dụng chính thức)
---

# 🏛️ ADR-022: Xử lý job nền ngay trong app — `after()` + Vercel Cron hằng ngày, không worker thường trực

## 1. Trạng Thái (Status)
**ĐÃ PHÊ DUYỆT (Accepted)** — tương ứng **ADR-036** trong [`docs/DECISIONS.md`](../../docs/DECISIONS.md), gồm mục "Chủ dự án chốt
(2026-10-16)" và "Làm rõ (2026-10-16)". Bản trích ghi vào thư mục này theo duyệt của Quốc ngày 2026-10-16.
Đặc tả sống: [[02-System-Specs/Background-Jobs-Specs|Background-Jobs-Specs]].

Tiến độ (2026-10-16): xong code, chưa commit/deploy 🟡 (theo `docs/PLAN.md`).

Mức xác minh: ✅ Long đã đối chiếu code (2026-10-16) · 🟡 theo `docs/DECISIONS.md`/brief của Quốc · ❓ cần môi trường thật (Vercel).

---

## 2. Bối Cảnh (Context)
Vercel không chạy tiến trình thường trực nên `apps/web/worker.ts` (pg-boss `work`) không có nơi chạy
([[01-Architecture-Decisions/ADR-017-Vercel-Deploy-Build-Without-Env|ADR-017 (≙ ADR-031)]] mục 4). Kiểm chỉ đọc hàng đợi: job
`payment.process` tồn đều từ integration test, không có đơn khách thật bị kẹt; job sweep tồn do lịch pg-boss từ lần chạy worker local
🟡. Chủ dự án chọn tự xử lý trong project, không dùng dịch vụ ngoài hay server riêng 🟡.

---

## 3. Quyết Định (Decision)
1. **Job phát sinh từ request** (`payment.process` từ webhook tenant, `file.scan` từ upload): vẫn `send` vào pg-boss trước (bản ghi
   bền), rồi `after()` chạy bộ xử lý hàng đợi ngay sau response — lấy job bằng `fetch` (khoá job), `complete`/`fail` tường minh, có
   ngân sách thời gian; lỗi/bị ngắt thì job còn trong hàng đợi để thử lại ✅.
2. **Việc định kỳ:** route `GET /api/cron/daily` do **Vercel Cron** gọi mỗi ngày (03:00 giờ VN): chạy `runSubscriptionSweep()`,
   `runOrderSweep()` trực tiếp, bảo trì + dọn job sót của `payment.process`/`file.scan`. Xác thực `Authorization: Bearer <CRON_SECRET>`
   so sánh `timingSafeEqual`; thiếu `CRON_SECRET` → 503 ✅.
3. **Đơn PENDING quá hạn:** luồng đọc/thanh toán coi đơn quá `expiresAt` là hết hạn ngay (`effectiveOrderStatus`); sweep hằng ngày chỉ
   đồng bộ DB ✅.
4. `worker.ts` giữ cho chạy local/server riêng; không deploy ✅.
5. Job lạ/không hợp lệ → `fail`, log, không làm hỏng cả lô ✅.

**Chủ dự án chốt (2026-10-16)** 🟡: webhook khớp đơn PENDING hoặc đã hết hạn **trong 24h** sau `expiresAt` thì tự fulfil; trễ hơn thì
ghi MATCHED để tenant xử lý tay. SQL dọn job test tồn: `docs/ops/2026-10-16-pgboss-cleanup.sql` (chủ dự án chạy).

**Làm rõ (2026-10-16)** 🟡: "không làm app fail-fast" chỉ đúng khi **thiếu** `CRON_SECRET`; đặt giá trị < 32 ký tự thì zod làm cả app
dừng. Không chạy `worker.ts` local trên DB dùng chung trừ khi Quốc duyệt.

---

## 4. Hệ Quả (Consequences)
- Không phụ thuộc dịch vụ ngoài; thanh toán tenant được giao gần như tức thì sau webhook.
- Sweep thuê bao và trả lại job `active` kẹt trễ tối đa ~24h.
- Hành vi `after()` trong `maxDuration = 60` và số kết nối pg-boss từ serverless chưa kiểm trên Vercel ❓.
- Từ M12a, cron thêm bước `audit.purge` (xoá `audit_logs` > 12 tháng) —
  [[01-Architecture-Decisions/ADR-023-M12-Audit-Log-Append-Only|ADR-023 (≙ ADR-037)]].

---

## 5. Liên Kết
* [[02-System-Specs/Background-Jobs-Specs|Background-Jobs-Specs]] ([Background-Jobs-Specs.md](../02-System-Specs/Background-Jobs-Specs.md))
* [[03-API-Contracts/Endpoint-Directory|Endpoint-Directory]] §17 ([Endpoint-Directory.md](../03-API-Contracts/Endpoint-Directory.md))
* [[04-Operations-Runbooks/Deploy-Vercel-Runbook|Deploy-Vercel-Runbook]] §6 ([Deploy-Vercel-Runbook.md](../04-Operations-Runbooks/Deploy-Vercel-Runbook.md))
* [[02-System-Specs/Order-State-Machine|Order-State-Machine]] §3.1, §3.4 ([Order-State-Machine.md](../02-System-Specs/Order-State-Machine.md))

*Quay lại: [[MOC-Home]] (../00-Index/MOC-Home.md)*

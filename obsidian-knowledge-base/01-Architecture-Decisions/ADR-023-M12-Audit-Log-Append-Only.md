---
tags:
  - adr
  - audit-log
  - security
  - database
  - system-admin
  - status/accepted
date: 2026-10-16
decider: vtphong91
status: Accepted (Chốt — Áp dụng chính thức)
---

# 🏛️ ADR-023: M12 chia 3 đợt; audit log chỉ-INSERT, không khoá ngoại, giữ 12 tháng; thống kê hằng ngày

## 1. Trạng Thái (Status)
**ĐÃ PHÊ DUYỆT (Accepted)** — tương ứng **ADR-037** trong [`docs/DECISIONS.md`](../../docs/DECISIONS.md), gồm mục "Bổ sung ADR-037
(2026-10-16, Quốc)". Bản trích ghi vào thư mục này theo duyệt của Quốc ngày 2026-10-16.
Đặc tả sống: [[02-System-Specs/Audit-Log-Specs|Audit-Log-Specs]].

Tiến độ (2026-10-16): **M12a Audit log xong code** (chưa commit/deploy), migration `20261016090000_m12a_audit_logs` **đã áp DB** 🟡;
**M12b Thống kê xong code** (chưa commit/deploy), migration `20261016120000_m12b_tenant_daily_stats` **đã áp DB** 🟡 — đặc tả sống
[[02-System-Specs/Tenant-Stats-Specs|Tenant-Stats-Specs]]; **M12c Báo cáo vi phạm xong code (2026-10-16, chưa commit/deploy)**, migration
`20261016150000_m12c_abuse_reports` đã áp DB 🟡 — [[01-Architecture-Decisions/ADR-024-M12c-Abuse-Reports-Moderation-Lock|ADR-024 (≙ ADR-038)]],
[[02-System-Specs/Abuse-Reports-Specs|Abuse-Reports-Specs]].

Mức xác minh: ✅ Long đã đối chiếu code/migration (2026-10-16) · 🟡 theo `docs/DECISIONS.md`/báo cáo của Quốc · ❓ cần môi trường thật.

---

## 2. Bối Cảnh (Context)
M12 (đặc tả mục M12) chưa có gì: không có `audit_logs`, `tenant_daily_stats`, `abuse_reports`; nhiều module ghi `logger` tạm và chờ
M12 (BACKLOG). Chủ dự án chốt các điểm dưới 🟡.

---

## 3. Quyết Định (Decision)
1. **3 đợt, deploy riêng:** M12a Audit log → M12b Thống kê (`tenant_daily_stats` + dashboard admin thật) → M12c Báo cáo vi phạm
   (`abuse_reports`, nút Báo cáo, `/admin/reports`, email, cam kết bản quyền khi đăng sản phẩm).
2. **`audit_logs` (L1):** `actorId?`, `scope`, `tenantId?`, `action`, `targetType?`, `targetId?`, `metadata Json`, `ip?`, `userAgent?`,
   `createdAt`; **không khoá ngoại** tới users/tenants; index `(createdAt)`, `(tenantId, createdAt)`, `(actorId, createdAt)` ✅.
   **Chỉ INSERT:** `gieochu_app` không có UPDATE; trigger chặn UPDATE mọi trường hợp, chặn DELETE trừ khi phiên đặt cờ purge
   (`gieochu.audit_purge`) **và** dòng cũ hơn 12 tháng ✅. Không lưu secret/token/mật khẩu trong `metadata` (`sanitizeAuditMetadata`) ✅.
3. **Lưu IP + User-Agent, giữ 12 tháng:** cron hằng ngày (`/api/cron/daily`,
   [[01-Architecture-Decisions/ADR-022-Background-Jobs-After-And-Daily-Cron|ADR-022 (≙ ADR-036)]]) xoá dòng > 12 tháng — bước
   `audit.purge` ✅.
4. **Partition theo tháng: để sau** — BACKLOG khi bảng lớn.
5. **Thống kê hằng ngày** (M12b) gộp vào `/api/cron/daily` (03:00 giờ VN), tính lại 2 ngày gần nhất theo `Asia/Ho_Chi_Minh`;
   dashboard ghi "số liệu đến hết hôm qua" (thay cho "mỗi giờ" của đặc tả) — bước cron `stats.aggregate` + section "Hoạt động bán tài liệu
   (30 ngày)" trên `/admin` ✅ (M12b).
6. **Test:** trần integration 53 → **55** cho đúng 2 test M12 (audit không sửa/xoá được — M12a; thống kê — M12b); unit giữ 94 ✅
   (`scripts/count-tests.mjs`; thực 93/54 sau M12b — `audit.test.ts` + `stats.test.ts`). Dòng audit do test tạo không xoá được tới 12 tháng — chấp nhận.
7. **Xem audit:** admin `/admin/audit` (lọc actor, action, tenant, khoảng ngày); owner `/studio/{slug}/activity` chỉ dòng có `tenantId`
   của mình (kiểm OWNER ở server, truy vấn luôn lọc `tenantId`) ✅. `ADMIN_VIEWED_TENANT` ghi khi admin mở trang chi tiết tenant —
   **chưa có trang đó nên chưa ghi** ✅ (BACKLOG).

**Không đổi:** CLAUDE.md §7.9 — admin không đọc đơn/khách của tenant (loader che email khách, ẩn IP/User-Agent dòng scope `CUSTOMER`).

**Bổ sung ADR-037 (2026-10-16, Quốc)** 🟡:
- **Mọi** integration test gọi hàm có audit (đơn, entitlement, share link, sản phẩm, đăng nhập…) để lại dòng `audit_logs` giả không xoá
  được tới khi purge 12 tháng — chấp nhận như mục 6.
- Mục "Hoạt động" trong Studio chỉ hiện với OWNER, khớp quyền loader ✅ (đọc `studio/[tenantSlug]/layout.tsx`).
- DB mới: tạo schema `pgboss` bằng role owner trước rồi chạy lại `setup-app-role` là **quy trình chính thức**.

**M12b chốt định nghĩa số liệu (2026-10-16, Quốc)** — chi tiết [[02-System-Specs/Tenant-Stats-Specs|Tenant-Stats-Specs]]:
- `tenant_daily_stats(tenantId, date DATE theo ngày giờ VN, ordersPaid, gmvVnd BigInt, newCustomers, downloads)`, unique `(tenantId, date)`,
  FK tenant `ON DELETE CASCADE` (bảng tổng hợp tính lại được — không bất biến như audit) ✅.
- `ordersPaid`/`gmvVnd`: đơn có `paidAt` trong ngày, **GMV gộp** (tính cả đơn sau này hoàn tiền; `gmvVnd` = tổng `totalVnd` sau giảm giá) ✅.
- `newCustomers`: theo `tenant_customers.firstOrderAt` (bảng không có `createdAt`; dòng chỉ tạo khi đơn đầu tiên PAID) — Quốc duyệt khi
  triển khai ✅ code. `downloads`: `download_events` trong ngày ✅.
- Cron tính lại hôm qua + hôm nay (upsert, idempotent); bảng trống → backfill từ ngày có dữ liệu sớm nhất, tối đa 400 ngày; chạy dưới
  `withSystemJob`; không lưu email/tên/mã đơn ✅. `gieochu_app` có SELECT/INSERT/UPDATE/DELETE trên bảng ✅ SQL.
- Dashboard admin: GMV, đơn đã thanh toán, khách mới, lượt tải toàn nền tảng 30 ngày (biểu đồ + tổng) và top gian hàng theo GMV (chỉ tên
  + số tổng hợp — §7.9) ✅.

---

## 4. Hệ Quả (Consequences)
- Ghi audit ở **sau commit, ngoài transaction** nghiệp vụ; lỗi ghi không ném — có thể mất 1 dòng nếu process chết giữa chừng ✅.
- `audit_logs` không có RLS — quyền đọc của owner chỉ dựa vào loader `listTenantAuditLogs`; mọi đường đọc mới phải qua loader.
- Trigger chặn cả role owner — không có quy trình được duyệt để xoá/sửa dòng audit ngoài cron purge.
- Chưa nối: `ADMIN_VIEWED_TENANT`, `REVIEW_HIDDEN_REFUNDED` (vẫn `logger`). `REPORT_RESOLVED` đã nối ở M12c (2026-10-17 ✅ đọc code).

---

## 5. Liên Kết
* [[02-System-Specs/Audit-Log-Specs|Audit-Log-Specs]] ([Audit-Log-Specs.md](../02-System-Specs/Audit-Log-Specs.md))
* [[03-API-Contracts/Database-Schema-Reference|Database-Schema-Reference]] — `audit_logs`, migration M12a ([Database-Schema-Reference.md](../03-API-Contracts/Database-Schema-Reference.md))
* [[03-API-Contracts/Endpoint-Directory|Endpoint-Directory]] §17–§18 ([Endpoint-Directory.md](../03-API-Contracts/Endpoint-Directory.md))
* [[04-Operations-Runbooks/Deploy-Vercel-Runbook|Deploy-Vercel-Runbook]] §9.6 · [[04-Operations-Runbooks/Disaster-Recovery-Runbook|Disaster-Recovery-Runbook]] §4.1, §4.3

*Quay lại: [[MOC-Home]] (../00-Index/MOC-Home.md)*

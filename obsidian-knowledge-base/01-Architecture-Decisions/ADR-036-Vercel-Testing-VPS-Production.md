---
tags:
  - adr
  - deployment
  - jobs
  - storage
  - status/accepted
date: 2026-10-23
decider: vtphong91
status: Accepted (Chốt — Áp dụng chính thức)
---

# 🏛️ ADR-036: Môi trường chạy — Vercel để thử nghiệm, VPS cho production

## 1. Trạng Thái (Status)
**ĐÃ PHÊ DUYỆT (Accepted)** — tương ứng **ADR-049** trong [`docs/DECISIONS.md`](../../docs/DECISIONS.md) (chủ dự án xác nhận 2026-10-23). Bản trích
ghi theo duyệt của Quốc (brief 2026-10-23). Trả lời câu hỏi mở "production chạy VPS hay Vercel" ở [[00-Index/KB-Audit-2026-09-26|KB-Audit]] §27 mục 1 / §29 mục 10.

Tiến độ: đây là quyết định **định hướng** — các hệ quả ở §4 **chưa làm** (theo ADR-049). Chưa có runbook deploy VPS.

Mức xác minh: 🟡 theo `docs/DECISIONS.md` (quyết định, không có code mới để đối chiếu) · ❓ cần môi trường thật.

---

## 2. Bối Cảnh (Context)
Hiện app chạy thử trên **Vercel** (deploy theo [[01-Architecture-Decisions/ADR-017-Vercel-Deploy-Build-Without-Env|ADR-017 KB (≙ ADR-031)]], job nền
theo [[01-Architecture-Decisions/ADR-022-Background-Jobs-After-And-Daily-Cron|ADR-022 KB (≙ ADR-036)]]). Lưu trữ tự host MinIO + Storage Gateway nginx
([[01-Architecture-Decisions/ADR-034-Dual-Storage-MinIO-R2-Dedicated-Tenant-Bucket|ADR-034 KB (≙ ADR-044)]],
[[01-Architecture-Decisions/ADR-030-Storage-Gateway-Encrypted-Ticket-Nginx|ADR-030 KB (≙ ADR-045)]]) vốn đã đặt trên VPS.

---

## 3. Quyết Định (Decision)
- **Vercel** = môi trường **thử nghiệm**.
- **Production** chạy trên **VPS** — cùng nơi đặt MinIO + Storage Gateway nginx.
- Quy tắc **một DB dùng chung** ([[01-Architecture-Decisions/ADR-020-Single-Database-Dev-Preview-Production|ADR-020 KB (≙ ADR-034)]]) **vẫn áp dụng** cho
  tới khi có quyết định tách DB.

---

## 4. Hệ Quả — việc cần làm khi chuyển production sang VPS (chưa làm)
1. Runbook deploy VPS: build/run Next, process manager, reverse proxy, TLS, env. (Hiện chỉ có phần Storage Gateway ở
   [[04-Operations-Runbooks/Storage-Gateway-VPS-Runbook|Storage-Gateway-VPS-Runbook]] — dùng `pm2`.)
2. Cron thay Vercel Cron: crontab gọi `GET /api/cron/daily` kèm `CRON_SECRET` (có thể dày hơn 1 lần/ngày).
3. Cân nhắc chạy `worker.ts` thường trực trên VPS thay cơ chế `after()` của ADR-036 gốc — **cần ADR riêng** (hiện `worker.ts` vẫn không chạy trên DB
   dùng chung trừ khi Quốc duyệt — `CLAUDE.md`).
- Trong lúc chưa chuyển: [[04-Operations-Runbooks/Deploy-Vercel-Runbook|Deploy-Vercel-Runbook]] vẫn là quy trình deploy hiện hành cho môi trường thử nghiệm.
  Vì một DB dùng chung, mọi thao tác dữ liệu trên Vercel thử nghiệm vẫn là thao tác trên dữ liệu production.

---

## 5. Liên Kết
* [[01-Architecture-Decisions/ADR-017-Vercel-Deploy-Build-Without-Env|ADR-017 KB (≙ ADR-031)]] · [[01-Architecture-Decisions/ADR-022-Background-Jobs-After-And-Daily-Cron|ADR-022 KB (≙ ADR-036)]] · [[01-Architecture-Decisions/ADR-020-Single-Database-Dev-Preview-Production|ADR-020 KB (≙ ADR-034)]] · [[01-Architecture-Decisions/ADR-030-Storage-Gateway-Encrypted-Ticket-Nginx|ADR-030 KB (≙ ADR-045)]]
* [[04-Operations-Runbooks/Deploy-Vercel-Runbook|Deploy-Vercel-Runbook]] ([Deploy-Vercel-Runbook.md](../04-Operations-Runbooks/Deploy-Vercel-Runbook.md)) · [[04-Operations-Runbooks/Storage-Gateway-VPS-Runbook|Storage-Gateway-VPS-Runbook]] ([Storage-Gateway-VPS-Runbook.md](../04-Operations-Runbooks/Storage-Gateway-VPS-Runbook.md))

*Quay lại: [[MOC-Home]] (../00-Index/MOC-Home.md)*

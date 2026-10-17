---
tags:
  - adr
  - abuse-report
  - moderation
  - security
  - system-admin
  - status/accepted
date: 2026-10-17
decider: vtphong91
status: Accepted (Chốt — Áp dụng chính thức)
---

# 🏛️ ADR-024: M12c Báo cáo vi phạm — ai cũng báo cáo được, ẩn danh với tenant, khoá kiểm duyệt, cam kết bản quyền lưu vết

## 1. Trạng Thái (Status)
**ĐÃ PHÊ DUYỆT (Accepted)** — tương ứng **ADR-038** trong [`docs/DECISIONS.md`](../../docs/DECISIONS.md). Bản trích ghi vào thư mục này
theo duyệt của Quốc (brief 2026-10-17). Đặc tả sống: [[02-System-Specs/Abuse-Reports-Specs|Abuse-Reports-Specs]].

Tiến độ (2026-10-17): **xong code, chưa commit/deploy** ✅ `git status`; migration `20261016150000_m12c_abuse_reports` **đã áp DB dùng
chung 2026-10-16** 🟡 (Quốc báo).

Mức xác minh: ✅ Long đã đối chiếu code/migration (2026-10-17) · 🟡 theo `docs/DECISIONS.md`/báo cáo của Quốc · ❓ cần môi trường thật.

---

## 2. Bối Cảnh (Context)
Đợt cuối M12 (đặc tả mục M12 "Báo cáo vi phạm", chia đợt theo
[[01-Architecture-Decisions/ADR-023-M12-Audit-Log-Append-Only|ADR-023 (≙ ADR-037)]]). Chủ dự án chốt 3 điểm (chống spam, ẩn danh, cam
kết bản quyền); các điểm còn lại Quốc chọn phương án an toàn 🟡.

---

## 3. Quyết Định (Decision)
1. **Đối tượng:** sản phẩm, đánh giá, bài viết (bình luận chưa có — M10c). Loại `COPYRIGHT` · `INAPPROPRIATE` · `SCAM` · `OTHER`; mô tả bắt
   buộc ≤2000 ký tự; ≤5 link bằng chứng http/https ✅.
2. **Ai cũng gửi được:** đã đăng nhập → lấy user; khách vãng lai → bắt buộc email. **Chống spam (chủ dự án chốt):** 5 báo cáo/giờ/IP +
   honeypot + chặn trùng (cùng người báo cáo + cùng đối tượng đang `OPEN`); không captcha, không dịch vụ ngoài ✅ (`POST /api/reports`).
3. **Bảng `abuse_reports` (L1, không RLS):** đối tượng, loại, mô tả, bằng chứng, người báo cáo (`reporterUserId?`, `reporterEmail`), `ip`,
   `status` `OPEN`/`RESOLVED`/`REJECTED`, quyết định, ghi chú, `resolvedById`, `resolvedAt`. IP giữ 12 tháng như audit — dọn bằng bước cron
   `abuse_report.ip_purge` ✅.
4. **Ẩn danh với tenant (chủ dự án chốt):** chủ gian hàng chỉ biết loại vi phạm, nội dung bị xử lý và quyết định — không bao giờ thấy
   email/danh tính người báo cáo; chỉ admin thấy ✅ (tenant không có đường đọc `abuse_reports`; audit `REPORT_SUBMITTED`/`REPORT_RESOLVED`
   không gắn `tenantId`).
5. **Admin xử lý `/admin/reports`:** ẩn nội dung (đánh giá/bài viết), lưu trữ sản phẩm, khoá tenant (`LOCKED`), bác bỏ. Nội dung bị ẩn/lưu
   trữ mang **khoá kiểm duyệt** (`moderationLockedAt` + lý do) — tenant không tự xuất bản lại/bỏ ẩn cho tới khi admin gỡ khoá (trigger
   `<bảng>_guard_moderation` + lớp app 409 `CONTENT_MODERATION_LOCKED`) ✅. Admin xem nội dung đối tượng, không xem đơn/khách (§7.9).
6. **Thông báo:** email người báo cáo (quyết định chung) và chủ gian hàng (khi có biện pháp/khoá tenant) qua `sendEmailNow`; lỗi gửi không chặn
   xử lý. Audit `REPORT_SUBMITTED`, `REPORT_RESOLVED`, `CONTENT_MODERATION_LOCKED/UNLOCKED` ✅.
7. **Cam kết bản quyền (chủ dự án chốt):** bắt buộc tích mỗi lần **xuất bản**; lưu `rightsConfirmedAt` + `rightsConfirmedById` (lần gần nhất).
   Sản phẩm đang công khai giữ nguyên, chỉ phải tích khi xuất bản lại ✅ (400 `RIGHTS_CONFIRMATION_REQUIRED`).
8. **Test:** không thêm (ngân sách M12 đã đủ 2/2) — nợ test vào BACKLOG ✅ (`pnpm test:count` 2026-10-17: 93/94 unit, 54/55 integration).

---

## 4. Hệ Quả (Consequences)
- Thêm 1 route HTTP (`POST /api/reports`) — toàn app 23 `route.ts` ✅.
- **Thứ tự deploy bắt buộc: migration trước code** — code đọc cột mới trên `products`/`reviews`/`posts`, lên trước sẽ 500 (P2022) ✅ comment
  migration. Xem [[04-Operations-Runbooks/Deploy-Vercel-Runbook|Deploy-Vercel-Runbook]] §9.8.
- Trigger moderation không có nhánh DELETE — tenant vẫn xoá được bài viết đang bị khoá (`deletePost` không kiểm khoá) ✅ đọc code; ADR không nói
  rõ — câu hỏi mở cho Quốc.
- Quyết định "lưu trữ sản phẩm" kéo theo quyền lợi người mua —
  [[01-Architecture-Decisions/ADR-025-Buyer-Remedy-Final-Download-Or-Refund|ADR-025 (≙ ADR-039)]].
- Chưa có test cho trigger, rate limit, xử lý đồng thời, IP purge (BACKLOG).

---

## 5. Liên Kết
* [[02-System-Specs/Abuse-Reports-Specs|Abuse-Reports-Specs]] ([Abuse-Reports-Specs.md](../02-System-Specs/Abuse-Reports-Specs.md))
* [[03-API-Contracts/Database-Schema-Reference|Database-Schema-Reference]] — `abuse_reports`, migration M12c ([Database-Schema-Reference.md](../03-API-Contracts/Database-Schema-Reference.md))
* [[03-API-Contracts/Endpoint-Directory|Endpoint-Directory]] §17, §20 ([Endpoint-Directory.md](../03-API-Contracts/Endpoint-Directory.md))
* [[04-Operations-Runbooks/UI-Design-System|UI-Design-System]] §17 ([UI-Design-System.md](../04-Operations-Runbooks/UI-Design-System.md))

*Quay lại: [[MOC-Home]] (../00-Index/MOC-Home.md)*

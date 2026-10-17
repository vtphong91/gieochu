---
tags:
  - adr
  - entitlement
  - moderation
  - order
  - security
  - status/accepted
date: 2026-10-17
decider: vtphong91
status: Accepted (Chốt — Áp dụng chính thức)
---

# 🏛️ ADR-025: Quyền lợi người mua khi tài liệu bị xác nhận vi phạm — "tải lần cuối" hoặc "yêu cầu hoàn tiền"

## 1. Trạng Thái (Status)
**ĐÃ PHÊ DUYỆT (Accepted)** — tương ứng **ADR-039** trong [`docs/DECISIONS.md`](../../docs/DECISIONS.md), gồm mục "Bổ sung ADR-039
(2026-10-16, Quốc)" và "Bổ sung ADR-039 lần 2" (2026-10-17, Quốc). Bản trích ghi vào thư mục này theo duyệt của Quốc (brief 2026-10-17). Đặc tả sống:
[[02-System-Specs/Abuse-Reports-Specs|Abuse-Reports-Specs]] §6.

Tiến độ (2026-10-17): **xong code, chưa commit/deploy** ✅ `git status`; migration `20261016180000_adr039_entitlement_remedy` **đã áp DB
dùng chung 2026-10-16** 🟡 (Quốc báo, kèm kiểm trigger/CHECK bằng `gieochu_app` và checksum khớp file).

Mức xác minh: ✅ Long đã đối chiếu code/migration (2026-10-17) · 🟡 theo `docs/DECISIONS.md`/báo cáo của Quốc · ❓ cần môi trường thật.

---

## 2. Bối Cảnh (Context)
Khi admin xử lý báo cáo bằng **lưu trữ sản phẩm** (vi phạm được xác nhận —
[[01-Architecture-Decisions/ADR-024-M12c-Abuse-Reports-Moderation-Lock|ADR-024 (≙ ADR-038)]]), khách đã mua và đã thanh toán cần lựa
chọn rõ ràng. Nền tảng **không giữ tiền** bán tài liệu (tiền về thẳng tenant) nên chỉ *yêu cầu* tenant hoàn tiền; mỗi đơn đúng 1 sản phẩm
(`createOrder` 1 `productId`) nên hoàn tiền = hoàn cả đơn bằng `markOrderRefunded` sẵn có. Chủ dự án chốt 🟡.

---

## 3. Quyết Định (Decision)
1. Khi `ARCHIVE_PRODUCT`: mọi entitlement còn hiệu lực của sản phẩm chuyển `remedyStatus = PENDING_CHOICE`; tải bị chặn tới khi khách chọn ✅.
2. **Lựa chọn A — tải lần cuối:** có cảnh báo trước khi tải (gỡ do vi phạm, chỉ dùng cá nhân, không phát tán, chịu trách nhiệm, lần cuối) ✅.
   Số lượt: mục 2 gốc ghi "`downloadsUsed + 1`" — đã **đính chính** ở bổ sung lần 2 (d) bên dưới theo code.
3. **Lựa chọn B — yêu cầu hoàn tiền:** chặn tải vĩnh viễn, `REFUND_REQUESTED`, email tenant; Studio hiện yêu cầu ở trang đơn + lọc "Yêu cầu
   hoàn tiền"; tenant bấm "Hoàn tiền" sẵn có → `REFUNDED` (+ `remedyResolvedAt`). Tenant được đề nghị xử lý trong **7 ngày**; admin chỉ thấy
   **số đếm** yêu cầu quá hạn theo tenant (§7.9) và có thể khoá tenant ✅.
4. Lựa chọn **không đổi được**; không giới hạn thời hạn chọn; gỡ khoá kiểm duyệt không hoàn tác lựa chọn ✅.
5. Email khách (2 lựa chọn, link thư viện) và tenant (số khách bị ảnh hưởng) do hệ thống gửi; admin không thấy danh sách khách. Audit
   `REMEDY_FINAL_DOWNLOAD_CHOSEN`, `REMEDY_REFUND_REQUESTED` ✅.
6. Nút theo dõi tranh chấp hoàn tiền → BACKLOG. Test: không thêm (nợ BACKLOG) ✅.

**Bổ sung ADR-039 (2026-10-16, Quốc)** — đều ✅ đối chiếu code:
- (a) Đơn 0đ cũng vào `PENDING_CHOICE` nhưng chỉ được chọn tải lần cuối (server trả 409 `REMEDY_REFUND_NOT_AVAILABLE`).
- (b) Entitlement có remedy (≠ `NONE`): tenant **không** đổi được `downloadLimit` ("Cấp thêm lượt" chặn ở trigger + server
  `REMEDY_DOWNLOAD_LIMIT_LOCKED`).
- (c) Đơn thanh toán **sau** khi sản phẩm bị khoá (webhook muộn): entitlement tạo thẳng ở `PENDING_CHOICE` (gắn báo cáo gây khoá) — khách
  đã trả tiền luôn có 2 lựa chọn; checkout mới cho sản phẩm không công khai/tenant không `ACTIVE` bị chặn (409 `PRODUCT_UNAVAILABLE`).
  Email khách gửi tuần tự trong `after()` — sản phẩm nhiều người mua chuyển sang job (BACKLOG).

**Bổ sung ADR-039 lần 2 (2026-10-17, Quốc — đính chính theo code):**
- (d) Lựa chọn A cấp `downloadLimit = downloadsUsed + max(1, số tệp khả dụng)` — **lượt dùng chung** cho cả entitlement, không đếm riêng
  từng tệp ✅ code; UI ghi: "Bạn có N lượt tải cuối cho N tệp — mỗi lượt tải một tệp, hãy tải mỗi tệp một lần." (`remedy-notice.tsx`); Studio: "(số lượt bằng số tệp — mỗi lượt tải một tệp)" (`remedy-parts.tsx`) ✅ đọc code 2026-10-17.
- (e) Cột `remedyResolvedAt` ghi thời điểm `REFUNDED` (CHECK: chỉ `REFUNDED` mới có) ✅ SQL.
- (f) Tenant xoá bài viết / khách xoá đánh giá đang bị khoá kiểm duyệt: **cho phép** — xoá chỉ làm nội dung vi phạm biến mất, báo cáo giữ
  nguyên ✅ (khớp code: `deletePost` không kiểm khoá, trigger không có nhánh DELETE).
- (g) `PRODUCT_UNAVAILABLE` chặn thanh toán khi tenant không `ACTIVE` (gồm `READ_ONLY` — từ M3 v2 chỉ còn là biện pháp quản trị); khách
  chưa bị trừ tiền — ✅ code (`assertOrderProductsPurchasable`); **đã chốt** bởi ADR-040 mục 4 (chủ dự án, 2026-10-17) —
  [[01-Architecture-Decisions/ADR-026-Only-Active-Tenant-Shows-Documents|ADR-026 KB]].

---

## 4. Hệ Quả (Consequences)
- Bảng `entitlements` thêm 5 cột `remedy*` + 2 CHECK + trigger `entitlements_guard_remedy`: ngoài `system_job` chỉ có 2 ngoại lệ — INSERT
  `PENDING_CHOICE` cho sản phẩm đang khoá (c) và chuyển `REFUND_REQUESTED → REFUNDED` kèm thu hồi trong `markOrderRefunded` ✅ SQL.
- Lựa chọn của khách UPDATE dưới `system_job` sau khi server kiểm sở hữu bằng `withCustomer` (RLS customer vẫn chỉ đọc) ✅.
- **Thứ tự deploy: migration trước code** (code đọc `remedyStatus`) — [[04-Operations-Runbooks/Deploy-Vercel-Runbook|Deploy-Vercel-Runbook]] §9.8.
- Lượt "tải lần cuối" tính chung theo entitlement (bổ sung (d)).
- Tenant `READ_ONLY` cũng bị chặn thanh toán tiếp đơn `PENDING` (bổ sung (g)) — thay đổi hành vi, chủ dự án đã chốt qua ADR-040.

---

## 5. Liên Kết
* [[02-System-Specs/Abuse-Reports-Specs|Abuse-Reports-Specs]] §6 ([Abuse-Reports-Specs.md](../02-System-Specs/Abuse-Reports-Specs.md))
* [[02-System-Specs/File-Storage-And-Downloads-Specs|File-Storage-And-Downloads-Specs]] §8 ([File-Storage-And-Downloads-Specs.md](../02-System-Specs/File-Storage-And-Downloads-Specs.md))
* [[02-System-Specs/Order-State-Machine|Order-State-Machine]] §3.1, §3.3, §3.8 ([Order-State-Machine.md](../02-System-Specs/Order-State-Machine.md))
* [[03-API-Contracts/Database-Schema-Reference|Database-Schema-Reference]] — migration ADR-039 ([Database-Schema-Reference.md](../03-API-Contracts/Database-Schema-Reference.md))

*Quay lại: [[MOC-Home]] (../00-Index/MOC-Home.md)*

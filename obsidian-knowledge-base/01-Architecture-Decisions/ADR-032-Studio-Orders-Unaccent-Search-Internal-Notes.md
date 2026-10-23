---
tags:
  - adr
  - order
  - tenant
  - rls
  - database
  - status/accepted
date: 2026-10-18
decider: vtphong91
status: Accepted (Chốt — Áp dụng chính thức)
---

# 🏛️ ADR-032: Đơn hàng Studio — tìm không dấu, ghi chú nội bộ; không thao tác hàng loạt

> [!NOTE] Đổi số 2026-10-23
> Bản trích này trước đây là **ADR-031** (≙ ADR-045 cũ). Do trùng số với nhánh của vuong (ADR-044 MinIO, ADR-045 Storage Gateway, bản trích KB ADR-030 Storage Gateway), Quốc đánh số lại trong `docs/DECISIONS.md`; Long đổi tên file theo (xem [[00-Index/KB-Audit-2026-09-26|KB-Audit]] §29).

## 1. Trạng Thái (Status)
**ĐÃ PHÊ DUYỆT (Accepted)** — tương ứng **ADR-047** trong [`docs/DECISIONS.md`](../../docs/DECISIONS.md) (chủ dự án chốt 2026-10-18). Bản trích ghi
vào thư mục này theo duyệt của Quốc (brief 2026-10-18). Nối tiếp [[01-Architecture-Decisions/ADR-031-Studio-Orders-List-Detail-Upgrade|ADR-031 KB (≙ ADR-046)]]
— thay mục 3 của ADR-046 ("không ghi chú nội bộ, để sau") và mục "tìm không dấu → BACKLOG" của "Bổ sung ADR-046".

Tiến độ (2026-10-18): code xong ở working tree, nay **đã commit** `dd349b9` ✅ `git log` (cập nhật 2026-10-23, trước ghi "chưa commit"); migration `20261018090000_adr045_order_notes` **đã áp DB dùng chung
2026-10-18** 🟡 (Quốc báo); deploy ❓. `pnpm test:count` = **94/94 unit, 55/55 integration** ✅ (Long chạy, chỉ đếm) — không thêm case.

Mức xác minh: ✅ Long đã đối chiếu code working tree / SQL migration · 🟡 theo `docs/DECISIONS.md`/báo cáo của Quốc · ❓ cần môi trường thật.

---

## 2. Bối Cảnh (Context)
Sau ADR-046, trang Đơn hàng Studio còn hai việc để sau: tìm đơn **phân biệt dấu** và **chưa có ghi chú nội bộ**. Chủ dự án chốt (2026-10-18) làm cả hai,
đồng thời chốt **không** làm thao tác hàng loạt và xuất CSV 🟡.

---

## 3. Quyết Định (Decision) — theo `docs/DECISIONS.md`
1. **Tìm đơn không dấu:** ô `q` (mã/họ tên/email) so khớp qua `public.gieochu_unaccent(lower(...))` (hàm có từ ADR-035), tham số hoá + escape LIKE;
   kết quả như Cửa hàng.
2. **Ghi chú nội bộ:** bảng L2 mới `order_notes` (`id`, `tenantId`, `orderId`, `authorId`, `body` ≤1000 ký tự, `createdAt`), RLS theo tenant (chỉ scope
   tenant + `system_job`; **không** customer/public); chủ gian hàng thêm ghi chú, **chỉ xoá ghi chú do mình viết**; không sửa; khách **không bao giờ**
   thấy; hiện trong "Lịch sử đơn" kèm giờ + người viết. Audit `ORDER_NOTE_ADDED/DELETED` (không lưu nội dung trong metadata). Migration expand —
   chủ dự án chạy.
3. **Không thao tác hàng loạt** và **không xuất CSV** đơn hàng/khách hàng ra khỏi hệ thống (tạm thời). Huỷ đơn chỉ từng đơn.
4. Dọn `listOrders` / `getOrderDetail` cũ (không còn nơi gọi).

---

## 4. Triển Khai (theo code, 2026-10-18)
| Chỗ | Hành vi | Xác minh |
|---|---|---|
| `apps/web/lib/order.ts` `listOrdersPage` | `q` khớp `gieochu_unaccent(lower(col)) LIKE '%' \|\| gieochu_unaccent(lower($q)) \|\| '%' ESCAPE '\'` trên `orders.code`, `users.email`, `user_profiles.fullName` (`escapeLikePattern`); lọc + đếm + lấy id trang bằng `$queryRaw` trong **một** `withTenant`, Prisma nạp ≤ 100 đơn theo id | ✅ |
| `apps/web/lib/order.ts` (dọn) | Xoá `listOrders`, `getOrderDetail`, `effectiveStatusWhere`; giữ `OrderListFilters`, `parseOrderRemedyFilter` | ✅ grep |
| Migration `20261018090000_adr045_order_notes` (tên thư mục giữ số cũ) | Bảng `order_notes` + 3 index + FK (tenant/đơn Cascade, tác giả SET NULL) + CHECK body 1–1000 + RLS enable/force + 5 policy (`select_access`, `tenant_insert` kiểm đơn cùng tenant, `system_job_insert`, `tenant_delete`, `system_job_delete`), không UPDATE (`REVOKE`) | ✅ đọc SQL; đã áp 🟡 |
| `apps/web/lib/order-note.ts` (mới) | `listOrderNotes`, `addOrderNote`, `deleteOrderNote(tenantId, orderId, noteId, actorId)`; mã lỗi `ORDER_NOTES_UNAVAILABLE` 503, `ORDER_NOTE_NOT_FOUND` 404, `ORDER_NOTE_FORBIDDEN` 403; audit metadata `{ noteId }` | ✅ |
| `getOrderDetailView(tenantId, orderId, viewerId)` | Trả `notes[]` + `notesAvailable`; timeline kind `note` (+`noteId`) | ✅ |
| `orders/[orderId]/actions.ts` | Thêm `addOrderNoteAction`, `deleteOrderNoteAction`; action tiền không đổi | ✅ `git diff` |
| UI (`order-note-actions.tsx`, `OrderNotesCard`, `IconNote`, tông `neutral`, `ORDER_NOTE_MAX_LENGTH_UI`) | Form thêm, xoá 2 bước chỉ tác giả, tác giả null → "Tài khoản đã xoá" | ✅ |
| `tests/integration/order.test.ts` | Assertion mới trong case cô lập tenant có sẵn (không thêm case); chạy thật 9/9 sau migration 🟡 (Quốc) | ✅ đọc test |

Đặc tả: [[02-System-Specs/Studio-Orders-Specs|Studio-Orders-Specs]] §2, §3.2. Contract: [[03-API-Contracts/Endpoint-Directory|Endpoint-Directory]] §23.3–§23.5.
Bảng: [[03-API-Contracts/Database-Schema-Reference|Database-Schema-Reference]] §3.2/§7. Giao diện: [[04-Operations-Runbooks/UI-Design-System|UI-Design-System]] §20.8.
Deploy: [[04-Operations-Runbooks/Deploy-Vercel-Runbook|Deploy-Vercel-Runbook]] §9.10.

**Kiểm:** lint/typecheck/build đạt (Quốc) 🟡. **Chưa** xem UI ghi chú thật với phiên OWNER, chưa trình đọc màn hình ❓.

---

## 5. Hệ Quả (Consequences)
- "Chỉ tác giả xoá" kiểm ở **server** (`authorId` trong WHERE của lệnh xoá) — policy DELETE chỉ giới hạn theo tenant vì scope tenant không mang user id
  ✅ comment migration.
- Ghi chú của tài khoản đã xoá (`authorId` null) **không ai xoá được** — Quốc chốt 2026-10-18 giữ như hiện tại (MVP chỉ OWNER), ghi BACKLOG 🟡.
- Chưa có index trigram cho `gieochu_unaccent(lower(..))` trên đơn — cần khi gian hàng nhiều đơn → BACKLOG 🟡.
- Code chịu được việc lên trước migration (bảng thiếu → `notesAvailable: false` / 503) ✅.
- "Không thao tác hàng loạt / không xuất CSV" là **quyết định không làm**, không phải việc treo; Quốc xác nhận 2026-10-18 phạm vi gồm cả "Xuất CSV" ADR-043 mục 7 (dashboard) và CSV khách M8 🟡; ADR-048 (đang làm, chưa ghi KB) dẫn lại mục 3 này 🟡.

---

## 6. Liên Kết
* [[01-Architecture-Decisions/ADR-031-Studio-Orders-List-Detail-Upgrade|ADR-031 KB (≙ ADR-046)]] · [[01-Architecture-Decisions/ADR-021-Shop-Marketplace-Cms-First|ADR-021 KB (≙ ADR-035)]] — `gieochu_unaccent` · [[01-Architecture-Decisions/ADR-015-M10-Reviews-Posts-Rls-Split-Writes|ADR-015 KB (≙ ADR-029)]] — mẫu policy tách theo lệnh · [[01-Architecture-Decisions/ADR-023-M12-Audit-Log-Append-Only|ADR-023 KB (≙ ADR-037)]] — audit
* [[02-System-Specs/Studio-Orders-Specs|Studio-Orders-Specs]] ([Studio-Orders-Specs.md](../02-System-Specs/Studio-Orders-Specs.md)) · [[02-System-Specs/Audit-Log-Specs|Audit-Log-Specs]] ([Audit-Log-Specs.md](../02-System-Specs/Audit-Log-Specs.md))

*Quay lại: [[MOC-Home]] (../00-Index/MOC-Home.md)*

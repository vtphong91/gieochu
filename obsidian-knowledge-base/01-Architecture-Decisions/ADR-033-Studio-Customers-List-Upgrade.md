---
tags:
  - adr
  - customer
  - tenant
  - order
  - status/accepted
date: 2026-10-19
decider: vtphong91
status: Accepted (Chốt — Áp dụng chính thức)
---

# 🏛️ ADR-033: Nâng cấp danh sách Khách hàng Studio

> [!NOTE] Đổi số 2026-10-23
> Bản trích này trước đây là **ADR-032** (≙ ADR-046 cũ). Do trùng số với nhánh của vuong (ADR-044 MinIO, ADR-045 Storage Gateway, bản trích KB ADR-030 Storage Gateway), Quốc đánh số lại trong `docs/DECISIONS.md`; Long đổi tên file theo (xem [[00-Index/KB-Audit-2026-09-26|KB-Audit]] §29).

## 1. Trạng Thái (Status)
**ĐÃ PHÊ DUYỆT (Accepted)** — tương ứng **ADR-048** trong [`docs/DECISIONS.md`](../../docs/DECISIONS.md) (chủ dự án chốt 2026-10-18). Bản trích ghi
vào thư mục này theo duyệt của Quốc (brief 2026-10-19). Nối tiếp [[01-Architecture-Decisions/ADR-032-Studio-Orders-Unaccent-Search-Internal-Notes|ADR-032 KB (≙ ADR-047)]]
(dẫn lại mục 3 "không xuất CSV") và [[01-Architecture-Decisions/ADR-029-Studio-Dashboard-Period-Gross-Net-Revenue|ADR-029 KB (≙ ADR-043)]] (định nghĩa số liệu).

Tiến độ (2026-10-19): code xong ở working tree, nay **đã commit** `dd349b9` ✅ `git log` (cập nhật 2026-10-23, trước ghi "chưa commit"); **không migration**; deploy ❓. `pnpm test:count` = **94/94 unit,
55/55 integration** ✅ (Long chạy, chỉ đếm) — không thêm case.

Mức xác minh: ✅ Long đã đối chiếu code working tree · 🟡 theo `docs/DECISIONS.md`/báo cáo của Quốc · ❓ cần môi trường thật.

---

## 2. Bối Cảnh (Context)
Trang `/studio/{slug}/customers` (từ M8) chỉ là bảng 4 cột, thiếu ghi chú khách và link sang đơn của khách (đặc tả M8 có yêu cầu, ghi ở `docs/BACKLOG.md`
mục M8). Dữ liệu nghiệp vụ, không CMS. Chủ dự án chốt chỉ nâng cấp **danh sách**, không làm trang chi tiết khách 🟡.

---

## 3. Quyết Định (Decision) — theo `docs/DECISIONS.md`
1. **Số liệu khớp ADR-043:** số đơn / tổng chi tiêu / chi tiêu TB tính lại từ `orders` (qua `withTenant`), chỉ đơn **> 0đ** có `paidAt`; tổng chi tiêu
   **gộp** + cột/dòng **"Đã hoàn"** riêng; khách chỉ có đơn 0đ = "chỉ nhận miễn phí". Không dựa cột cache `ordersCount/totalSpentVnd` để hiển thị.
2. **Thẻ thống kê:** tổng khách (+ khách mới trong kỳ), khách quay lại (≥2 đơn > 0đ) + %, tổng chi tiêu (+ đã hoàn), chi tiêu TB / khách trả phí, khách
   chỉ nhận miễn phí.
3. **Danh sách:** tìm không dấu họ tên/email; dropdown nhóm (tất cả, khách mới trong kỳ, quay lại, chỉ miễn phí, có yêu cầu hoàn tiền, **lâu chưa quay
   lại = không mua 90 ngày**); khoảng ngày (mua lần đầu / mua gần nhất); lọc tài liệu đã mua; cột Khách (họ tên + email, không SĐT/tỉnh — ADR-041) · Số
   đơn · Tổng chi tiêu · Đã hoàn · Mua lần đầu · Mua gần nhất · Thao tác (Xem đơn của khách → trang Đơn hàng lọc theo khách; Ghi chú); sắp xếp, phân trang 20.
4. **Ghi chú khách:** một ô duy nhất, dùng cột có sẵn `tenant_customers.note` (≤500 ký tự, sửa được, chỉ gian hàng thấy). Không migration.
5. Không xuất CSV (ADR-047 mục 3).

**Bổ sung ADR-048 (2026-10-23, Quốc — đính chính theo code):** ngày mua lần đầu/gần nhất và "lâu chưa quay lại" (không có đơn đã thanh toán nào trong 90
ngày) tính **cả lượt nhận miễn phí** (đơn 0đ) — coi là có tương tác. % khách quay lại = khách có ≥2 đơn > 0đ / **khách trả phí**. Giới hạn ghi chú 500 ký
tự kiểm ở server (không thêm CHECK DB — dữ liệu không quan trọng, tránh migration).

---

## 4. Triển Khai (theo code, 2026-10-19)
| Chỗ | Hành vi | Xác minh |
|---|---|---|
| `apps/web/lib/customer-list.ts` `listCustomersPage(tenantId, sp)` | Một `withTenant`: Prisma lấy dropdown tài liệu + 2 `$queryRaw` dùng chung CTE gom đơn có `paidAt` theo khách (`paid_orders`, `free_claims`, `spent`, `refunded`, `first_at`, `last_at`, `has_refund`); thống kê chỉ áp kỳ, `groupCounts` áp kỳ + `q` + `san-pham` | ✅ |
| `parseCustomerListQuery`, `buildCustomerListSearch` | Tham số `q`, `nhom`, `ky/tu/den`, `theo`, `san-pham`, `sap-xep`, `trang`, `so-dong`; parse phòng thủ | ✅ |
| `updateCustomerNote(tenantId, userId, note, actorId)` | NFC + trim, ≤ 500, rỗng → null; khách không thuộc gian hàng → 404; audit `CUSTOMER_NOTE_UPDATED` (metadata `{ customerUserId }`), không đổi → không ghi | ✅ |
| `customers/actions.ts` `saveCustomerNoteAction` | OWNER, trả `{ ok }` / `{ error }`, `revalidatePath` | ✅ |
| `@gieochu/core/customer-list` (subpath mới) | `CUSTOMER_NOTE_MAX_LENGTH = 500`, `INACTIVE_CUSTOMER_DAYS = 90` — file thuần cho client import; **không** re-export ở barrel `@gieochu/core` | ✅ |
| `apps/web/lib/order.ts` | `OrderListQuery.customerId` (`?khach=`), `OrderListPage.customer`; xoá `listTenantCustomers`, `getOrderDashboardStats` | ✅ `git diff` + grep |
| UI (Phong) | `customers/page.tsx`, `loading.tsx`, `error.tsx`, `_ui/{customer-list,customer-row-actions,customer-format,customer-skeleton}`; `OrderFilterForm` thêm prop `label`; trang Đơn hàng thêm dòng "Đang xem đơn của khách" | ✅ đọc code |
| `tests/integration/order.test.ts` | Assertion mới trong case cô lập tenant có sẵn (không thêm case); chạy thật 9/9 🟡 (Quốc) | ✅ đọc test |

Đặc tả: [[02-System-Specs/Studio-Customers-Specs|Studio-Customers-Specs]]. Contract: [[03-API-Contracts/Endpoint-Directory|Endpoint-Directory]] §24.
Giao diện: [[04-Operations-Runbooks/UI-Design-System|UI-Design-System]] §21. Audit: [[02-System-Specs/Audit-Log-Specs|Audit-Log-Specs]] §4.

**Kiểm:** lint/typecheck/build đạt (Quốc 2026-10-19) 🟡; thử đọc-only tenant `phongweb` khớp dashboard 🟡. **Chưa** kiểm UI thật với phiên OWNER ❓.

---

## 5. Hệ Quả (Consequences)
- "Mua lần đầu / gần nhất" và nhóm "lâu chưa quay lại" tính **cả đơn 0đ** (lượt nhận miễn phí là có tương tác), còn "khách quay lại" chỉ đếm đơn > 0đ ✅ code —
  đã chốt ở "Bổ sung ADR-048".
- `%` khách quay lại = quay lại ÷ **khách trả phí** (không phải ÷ tổng khách) ✅ code — đã chốt ở "Bổ sung ADR-048".
- Giới hạn 500 ký tự chỉ ở server (DB không CHECK, chủ ý — "Bổ sung ADR-048") — mọi đường ghi `tenant_customers.note` khác phải tự kiểm ✅ schema.
- Mỗi request chạy CTE tổng hợp 2 lần trên mọi đơn đã thanh toán của gian hàng — index/cache khi gian hàng lớn → BACKLOG 🟡.
- Đóng mục BACKLOG M8 "trang customers thiếu ghi chú + link đơn của khách" (CSV đã là "không làm" từ ADR-047).

---

## 6. Liên Kết
* [[01-Architecture-Decisions/ADR-032-Studio-Orders-Unaccent-Search-Internal-Notes|ADR-032 KB (≙ ADR-047)]] · [[01-Architecture-Decisions/ADR-031-Studio-Orders-List-Detail-Upgrade|ADR-031 KB (≙ ADR-046)]] · [[01-Architecture-Decisions/ADR-029-Studio-Dashboard-Period-Gross-Net-Revenue|ADR-029 KB (≙ ADR-043)]] · [[01-Architecture-Decisions/ADR-023-M12-Audit-Log-Append-Only|ADR-023 KB (≙ ADR-037)]] — audit
* [[02-System-Specs/Studio-Customers-Specs|Studio-Customers-Specs]] ([Studio-Customers-Specs.md](../02-System-Specs/Studio-Customers-Specs.md)) · [[02-System-Specs/Studio-Orders-Specs|Studio-Orders-Specs]] ([Studio-Orders-Specs.md](../02-System-Specs/Studio-Orders-Specs.md))

*Quay lại: [[MOC-Home]] (../00-Index/MOC-Home.md)*

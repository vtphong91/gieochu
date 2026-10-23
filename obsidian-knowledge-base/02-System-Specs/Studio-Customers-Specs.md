---
tags:
  - spec
  - customer
  - tenant
  - order
  - ui-ux
  - status/living
date: 2026-10-19
updated: 2026-10-23
author: Long
---

# 📐 Đặc Tả: Danh Sách Khách Hàng Studio (`/studio/{slug}/customers` — ADR-048)

> Quyết định gốc: **ADR-048** + **"Bổ sung ADR-048"** (Quốc, 2026-10-23 — đính chính theo code: lượt miễn phí tính là tương tác, % quay lại ÷ khách trả
> phí, 500 ký tự kiểm ở server không CHECK DB) trong [`docs/DECISIONS.md`](../../docs/DECISIONS.md) (chủ dự án chốt 2026-10-18). Bản trích KB:
> [[01-Architecture-Decisions/ADR-033-Studio-Customers-List-Upgrade|ADR-033 (≙ ADR-048)]]. ADR liên quan: ADR-039 (yêu cầu hoàn tiền / remedy),
> ADR-041 (khách chỉ họ tên + email), ADR-043 (định nghĩa "chỉ đơn > 0đ", date range picker), ADR-046/045 (trang Đơn hàng, tìm không dấu, không xuất CSV).
>
> Mức xác minh: ✅ Long đã đối chiếu code working tree 2026-10-19 · 🟡 theo brief/báo cáo của Quốc · ❓ cần môi trường thật.
> Trạng thái code: **working tree, chưa commit** ✅ `git status`. **Không migration** (dùng cột có sẵn `tenant_customers.note`), **không `route.ts` mới**;
> thêm 1 Server Action (`saveCustomerNoteAction`) và 1 audit action (`CUSTOMER_NOTE_UPDATED`).

---

## 1. Phạm vi

- Dữ liệu nghiệp vụ, **không có GĐ CMS** (ADR-048 bối cảnh) 🟡. Chỉ nâng cấp **danh sách** — **không** có trang chi tiết khách.
- Chỉ **chủ gian hàng (OWNER)**: trang gọi `requireTenantMemberPage(slug, …)`; action gọi `requireTenantMember(slug)` (mặc định `requiredRole = "OWNER"`) ✅.
- Loader nhận `tenant.id` từ guard, **không** lấy tenantId từ URL ✅ (JSDoc `listCustomersPage`).
- Khách chỉ hiện **họ tên + email** — không SĐT/tỉnh (ADR-041) ✅ (SQL chỉ chọn `users.email`, `user_profiles.fullName`).
- **Không làm:** xuất CSV khách hàng (ADR-048 mục 5 dẫn ADR-047 mục 3), thao tác hàng loạt.

---

## 2. Định nghĩa số liệu ✅ code (`apps/web/lib/customer-list.ts`)

Tính lại từ `orders` dưới `withTenant` — **không** đọc cột cache `tenant_customers.ordersCount/totalSpentVnd` để hiển thị (ADR-048 mục 1).

| Khái niệm | Định nghĩa trong code |
| :-- | :-- |
| **Khách của gian hàng** | User có **≥ 1 đơn có `paidAt`** tại gian hàng — mọi số tiền (**gồm đơn 0đ**), mọi trạng thái (kể cả đã hoàn). Đơn chưa thanh toán (PENDING/EXPIRED/CANCELED không `paidAt`) không làm ai thành khách |
| `paidOrders` (Số đơn) | Số đơn `totalVnd > 0` có `paidAt` (gồm đơn sau này hoàn) |
| `freeClaims` | Số đơn 0đ có `paidAt` (nhận tài liệu miễn phí) |
| `spentVnd` (Tổng chi tiêu) | Σ `totalVnd` các đơn > 0đ có `paidAt` — **gộp**, gồm đơn đã hoàn |
| `refundedVnd` (Đã hoàn) | Phần của `spentVnd` có `status = REFUNDED` |
| `firstOrderAt` / `lastOrderAt` | min / max `paidAt` trên **mọi** đơn đã thanh toán, **gồm đơn 0đ** |
| `hasRefundRequest` | Khách có entitlement `remedyStatus = REFUND_REQUESTED` tại gian hàng (ADR-039) |
| `inactive` | `lastOrderAt` < now − `INACTIVE_CUSTOMER_DAYS` (**90**) ngày — cờ do loader trả |
| `note` | `tenant_customers.note` (L2); null khi chưa có |

- Số liệu **mỗi khách luôn luỹ kế** tại gian hàng — không cắt theo kỳ lọc ✅.
- Vì `firstOrderAt`/`lastOrderAt` gồm đơn 0đ: một lượt **nhận miễn phí** cũng làm khách **không còn** "lâu chưa quay lại" và cũng có thể làm khách
  thành "khách mới" ✅ code — **chốt ở "Bổ sung ADR-048"** (2026-10-23, Quốc: lượt miễn phí coi là có tương tác). "Khách quay lại" thì **chỉ** đếm đơn
  > 0đ (`paidOrders ≥ 2`); % quay lại = quay lại ÷ **khách trả phí** (cũng chốt ở "Bổ sung ADR-048").
- Chỉ `markOrderPaid` (`lib/order.ts`) đặt `orders.paidAt` trong runtime và cùng transaction upsert `tenant_customers` ✅ grep — nên mọi "khách" của loader
  đều có dòng `tenant_customers` để ghi chú. Dữ liệu tạo ngoài đường này (script/seed) chưa đối chiếu ❓.

### 2.1. Nhóm (`nhom`)

| Giá trị | Điều kiện |
| :-- | :-- |
| `tat-ca` | Mọi khách (mặc định) |
| `moi` | `firstOrderAt` trong kỳ — kỳ `ky` nếu có, không thì **30 ngày qua** (`NEW_CUSTOMER_DEFAULT_PRESET = "30-ngay"`) |
| `quay-lai` | `paidOrders ≥ 2` |
| `mien-phi` | `paidOrders = 0` (chỉ nhận miễn phí) |
| `hoan-tien` | `hasRefundRequest` |
| `lau-chua-quay-lai` | `lastOrderAt` < now − 90 ngày |

### 2.2. Thẻ thống kê (`stats`) — phạm vi

- Áp **chỉ bộ lọc kỳ** (`ky` + `theo`) — **không** áp `q`, `nhom`, `san-pham` ✅. Không có `ky` = toàn bộ khách; khi đó `newCustomers` đếm theo 30 ngày qua.
  Phạm vi trả kèm ở `stats.scope = { range, dateField, newCustomersRange }` để UI ghi chú thích.
- `totalCustomers`, `newCustomers`, `returningCustomers` (`paidOrders ≥ 2`), `payingCustomers` (`paidOrders ≥ 1`), `returningCustomerRate` = returning ÷ **paying**
  (null khi paying = 0), `spentVnd`, `refundedVnd`, `avgSpentPerPayingCustomer` = ⌊spent ÷ paying⌋ (null khi paying = 0), `freeOnlyCustomers` (`paidOrders = 0`).
- `groupCounts` (số đếm trong dropdown nhóm): áp kỳ + `q` + `san-pham`, **không** áp `nhom` (như `statusCounts` trang Đơn hàng) ✅.
- Thử đọc-only tenant `phongweb`: 5 khách, 2 quay lại (40%), 993.000đ — khớp dashboard 🟡 (Hiếu/Quốc báo; Long không chạy lệnh DB).

---

## 3. Tham số URL (GET, chia sẻ được) — `parseCustomerListQuery` ✅

Parse phòng thủ, **không bao giờ ném**; giá trị sai → mặc định; mảng → phần tử đầu.

| Tham số | Giá trị | Mặc định / ghi chú |
| :-- | :-- | :-- |
| `q` | Họ tên / email | Chuẩn hoá bằng `normalizeOrderSearchQuery` (≤ 100 ký tự); **không dấu, không phân biệt hoa thường** (`gieochu_unaccent(lower(..)) LIKE … ESCAPE '\'`, `escapeLikePattern`) |
| `nhom` | §2.1 | `tat-ca` |
| `ky`, `tu`, `den` | Như dashboard ADR-043 (`resolveDashboardRange`) | Không có `ky` hoặc không hợp lệ = **mọi thời gian** |
| `theo` | `mua-dau` \| `mua-gan-nhat` | `mua-dau` — kỳ lọc theo `firstOrderAt` hoặc `lastOrderAt`; chỉ ghi vào URL khi có kỳ |
| `san-pham` | id sản phẩm (`/^[a-z0-9]{1,64}$/`) | Chỉ giữ nếu tài liệu thuộc gian hàng **và** có trong ≥ 1 đơn đã thanh toán (dropdown `products`); giữ khách từng mua tài liệu đó (đơn có `paidAt`) |
| `sap-xep` | `gan-nhat` \| `moi-nhat` \| `chi-tieu-giam` \| `so-don-giam` | `gan-nhat` (`lastOrderAt desc`). `moi-nhat` = `firstOrderAt desc`; các kiểu có khoá phụ, kết thúc bằng `userId` để phân trang ổn định. Chỉ có chiều giảm |
| `trang` | 1…1.000.000 | 1; vượt số trang → kẹp về trang cuối |
| `so-dong` | 10 / 20 / 50 / 100 | **20** |

`buildCustomerListSearch(query, patch)` bỏ giá trị mặc định; đổi bộ lọc mà không truyền `page` → về trang 1 ✅.

---

## 4. Ghi chú khách (ADR-048 mục 4) ✅ code

| Luật | Thực thi |
| :-- | :-- |
| Một ô duy nhất mỗi khách/gian hàng, sửa được | Cột có sẵn `tenant_customers.note` (`String?`) — **không migration** |
| ≤ 500 ký tự (`CUSTOMER_NOTE_MAX_LENGTH`) | zod ở server sau **NFC + trim**; `maxLength` ở `<textarea>`. **DB không có CHECK** độ dài (khác `order_notes`) ✅ schema — **chủ ý** theo "Bổ sung ADR-048" (không thêm CHECK, tránh migration) |
| Trống = xoá | Chuỗi rỗng sau trim → lưu `null` |
| Chỉ gian hàng thấy | Đọc/ghi dưới `withTenant`; trang chỉ OWNER. RLS `tenant_customers` (migration `20260918084400_rls_m8`, policy `tenant_isolation` — FOR ALL) chỉ có nhánh `app.tenant_id` + `system_job`, **không** nhánh customer/public; `withCustomer` không đặt `app.tenant_id` → khách không đọc được ✅ đọc SQL + `rls.ts` |
| Khách phải thuộc gian hàng | Dòng `tenant_customers (tenantId, userId)` phải tồn tại dưới `withTenant(tenantId)` — không có / tenant khác → 404 `notFound("Không tìm thấy khách hàng.")`; `userId` sai định dạng → 404 |
| Audit không lưu nội dung | `CUSTOMER_NOTE_UPDATED` (scope TENANT, `targetType: "TenantCustomer"`, `targetId` = userId khách), metadata **chỉ `{ customerUserId }`**; ghi sau commit; **nội dung không đổi → không ghi DB, không audit** |

Lỗi trả về UI: quá dài → `VALIDATION_ERROR` 400 ("Ghi chú tối đa 500 ký tự."); action trả `{ error: message }`, thành công `revalidatePath` trang Khách hàng.

---

## 5. Liên kết sang trang Đơn hàng — `?khach=` ✅ code

- Menu "Xem đơn của khách" → `/studio/{slug}/orders?khach=<userId>` (`customerOrdersHref`).
- `listOrdersPage` chỉ giữ `khach` khi khách có **≥ 1 đơn (mọi trạng thái)** tại gian hàng (`order.findFirst` dưới `withTenant`); không thì bỏ bộ lọc (như
  `san-pham`). Trả `OrderListPage.customer = { userId, fullName, email } | null`. Chi tiết: [[02-System-Specs/Studio-Orders-Specs|Studio-Orders-Specs]] §2.1.
- Lưu ý: tập "đơn của khách" ở trang Đơn hàng gồm cả đơn chưa thanh toán, còn "Số đơn" ở trang Khách hàng chỉ đếm đơn > 0đ đã thanh toán ✅ code.

---

## 6. Ranh giới dữ liệu & truy vấn ✅ đọc code

- **L2** (`orders`, `order_items`, `entitlements`, `products`, `tenant_customers`) trong **một `withTenant`**, `"tenantId" = $1` tường minh mọi nhánh.
- **L1** đọc: `users.email`, `user_profiles.fullName` (chỉ 2 trường).
- Truy vấn mỗi request: 1 Prisma (dropdown tài liệu) + **2 SQL thô** cùng một CTE tổng hợp (lần 1 thống kê + đếm nhóm, lần 2 lấy đúng khách của trang) —
  tham số hoá, không cache. CTE gom **mọi** đơn đã thanh toán của gian hàng mỗi lần → BACKLOG (index/cache khi gian hàng lớn).
- System Admin không có route mới đọc khách của tenant (§7.9 giữ nguyên).

---

## 7. Giao diện (tóm tắt — chi tiết [[04-Operations-Runbooks/UI-Design-System|UI-Design-System]] §21)

- Header "Khách hàng" → dải **5 `KpiCard`** (Tổng khách + khách mới · Khách quay lại + % · Tổng chi tiêu + Đã hoàn · Chi tiêu TB / khách trả phí · Khách chỉ nhận
  miễn phí) → form lọc (`OrderFilterForm label="Lọc khách hàng"`) → bảng (từ `xl`) / thẻ (dưới `xl`) → `LinkPagination`.
- Cột: Khách (họ tên đậm + email; ghi chú 1 dòng; badge chữ "Có yêu cầu hoàn tiền", "Lâu chưa quay lại") · Số đơn (+ "N miễn phí") · Tổng chi tiêu · Đã hoàn ·
  Mua lần đầu · Mua gần nhất · Thao tác (menu: Xem đơn của khách, Thêm/Sửa ghi chú… → `<dialog>`).
- `loading.tsx` (skeleton), `error.tsx` (mã tham chiếu `digest`, nút thử lại).

---

## 8. Test

- **Không thêm case** — `pnpm test:count` = **94/94 unit, 55/55 integration** ✅ (Long chạy 2026-10-19, chỉ đếm) — chạm trần.
- `apps/web/tests/integration/order.test.ts`: thêm assertion vào case cô lập tenant có sẵn ✅ đọc test — tenant A chưa có khách khi đơn chưa thanh toán; tìm
  không dấu "nguyen van thu" ra đúng khách với `paidOrders/freeClaims/spentVnd/refundedVnd`; `stats` + `groupCounts`; `q: "%"` không khớp mọi khách; tenant B
  không thấy khách của A (danh sách, thống kê, tìm); ghi chú: tenant B ghi chú khách của A → 404, 501 ký tự → 400, trim khi lưu, đọc lại qua loader, tenant B
  đếm `tenant_customers` của khách = 0, chuỗi trắng → `null`. Chạy thật **9/9** 🟡 (Quốc báo).
- Kiểm (🟡): lint/typecheck/build đạt (Quốc 2026-10-19). **Chưa kiểm** ❓: UI thật với phiên OWNER, trình đọc màn hình, hộp ghi chú trên mobile thật.

---

## 9. Giới hạn đã biết (chi tiết `docs/BACKLOG.md` mục "Phát sinh trong đợt ADR-048")

- CTE tổng hợp chạy 2 lần/request trên mọi đơn đã thanh toán — cần index/cache khi gian hàng lớn; chưa đo `EXPLAIN`.
- Chưa có index trigram cho tìm không dấu (chung với trang Đơn hàng).
- Sắp xếp chỉ chiều giảm; không có trang chi tiết khách; không xuất CSV (quyết định).

---

## 10. Liên kết

* [[02-System-Specs/Studio-Orders-Specs|Studio-Orders-Specs]] — `?khach=` ([Studio-Orders-Specs.md](./Studio-Orders-Specs.md))
* [[02-System-Specs/Studio-Dashboard-Specs|Studio-Dashboard-Specs]] — định nghĩa "chỉ đơn > 0đ", khách quay lại ([Studio-Dashboard-Specs.md](./Studio-Dashboard-Specs.md))
* [[02-System-Specs/Audit-Log-Specs|Audit-Log-Specs]] §4 — `CUSTOMER_NOTE_UPDATED` ([Audit-Log-Specs.md](./Audit-Log-Specs.md))
* [[03-API-Contracts/Endpoint-Directory|Endpoint-Directory]] §24 — contract loader/action ([Endpoint-Directory.md](../03-API-Contracts/Endpoint-Directory.md))
* [[04-Operations-Runbooks/UI-Design-System|UI-Design-System]] §21 ([UI-Design-System.md](../04-Operations-Runbooks/UI-Design-System.md))
* [[01-Architecture-Decisions/ADR-033-Studio-Customers-List-Upgrade|ADR-033 KB (≙ ADR-048)]] ([ADR-033-Studio-Customers-List-Upgrade.md](../01-Architecture-Decisions/ADR-033-Studio-Customers-List-Upgrade.md))
* Mã nguồn: `apps/web/lib/customer-list.ts`, `packages/core/src/customer/customer-list.ts`, `apps/web/app/studio/[tenantSlug]/customers/**`

*Quay lại: [[MOC-Home]] (../00-Index/MOC-Home.md)*

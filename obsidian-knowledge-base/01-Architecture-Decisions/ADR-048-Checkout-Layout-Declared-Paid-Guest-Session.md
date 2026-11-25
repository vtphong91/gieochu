---
tags:
  - adr
  - order
  - payment
  - customer
  - ui-ux
  - status/accepted
date: 2026-10-27
decider: vtphong91
status: Accepted — đã code đủ, chưa commit, chưa thử thủ công
---

# 🏛️ ADR-048: Layout trang thanh toán đơn tài liệu; "Tôi đã chuyển khoản"; hạn giữ đơn theo phương thức; khách tự huỷ; phiên khách vãng lai

## 1. Trạng Thái (Status)
**ĐÃ PHÊ DUYỆT (Accepted)** — tương ứng **ADR-062** trong [`docs/DECISIONS.md`](../../docs/DECISIONS.md) (chủ dự án chốt 2026-10-26, đồng ý Q1–Q12 trừ **Q6 liên hệ người
bán — hoãn**) cùng **"Bổ sung ADR-062"** (đợt 1 luồng mua). Đề xuất gốc: `docs/de-xuat-layout-checkout-tai-lieu-2026-10-26.md` (Phong). Bản trích ghi theo duyệt của Quốc
(brief 2026-10-27).

Tiến độ (đối chiếu 2026-10-27): **đã code đủ** — đợt 1 (khách đã đăng nhập) + khách vãng lai (task 12/13) — ở working tree, **chưa commit, chưa thử thủ công** ✅
`git status`. Migration `20261026180000_adr061_purchase_flow` **đã áp** (Quốc kiểm `prisma migrate status`). Không thêm `route.ts`.
`pnpm test:count` = **100/100 unit, 66/66 integration** ✅ (Long chạy).

Mức xác minh: ✅ Long đã đối chiếu code working tree · 🟡 theo `docs/DECISIONS.md`/brief · ❓ cần trình duyệt/môi trường thật.

> [!NOTE] Liên quan ADR-052 (KB) — tương ứng ADR-068 docs (2026-11-25)
> Ngoại lệ "xác nhận sau hạn khi khách báo chuyển trước hạn" (Bổ sung ADR-062 mục 3) nay **chỉ còn áp cho webhook/job và hàm cũ `confirmOrderManually`**; người bán dùng
> "Đổi trạng thái…" xác nhận được **mọi** đơn đã hết hạn, và mở lại đơn thì mốc "khách báo đã chuyển" bị xoá —
> [[01-Architecture-Decisions/ADR-052-Studio-Order-Status-Change-Reopen-Late-Confirm|ADR-052 KB (≙ ADR-068)]]. **Q3 bị sửa** (ADR-068 mục 8): hạn giữ của phương thức tính
> từ `holdStartedAt ?? createdAt` (người bán mở lại đơn đặt `holdStartedAt`). Nội dung bên dưới giữ nguyên.

---

## 2. Quyết Định (Decision)

### 2.1. ADR-062 Q1–Q12
| # | Quyết định 🟡 | Code đợt 1 |
| :-: | :-- | :-- |
| Q1 | Nút **"Tôi đã chuyển khoản"** (chỉ cổng xác nhận tay) lưu thời điểm khách báo (cột mới, không đổi `OrderStatus`), trang "Chờ người bán xác nhận", **1 email** người bán "Khách báo đã chuyển đơn {mã}", Studio ưu tiên đối soát; khách hoàn tác được | ✅ `customerDeclaredPaidAt`, `declareOrderPaid`/`undoDeclareOrderPaid`, email `order_customer_declared_paid` một lần/đơn, Studio xếp đầu |
| Q2 | Khách vãng lai: đơn tạo khi bấm "Tiếp tục thanh toán" sau khi điền form; trang trước đó `/{tenantSlug}/checkout?tai-lieu={slug}` | ✅ route group `(chua-co-don)` + `startGuestCheckoutAction`; "Mua ngay" khi chưa đăng nhập chuyển tới đây |
| Q3 | Hạn giữ đơn = lúc đặt đơn + hạn của phương thức (thủ công 72 giờ, SePay 48 giờ); đổi phương thức không gia hạn; chưa chọn = 72 giờ | ✅ `computeOrderHoldExpiresAt`, `orderHoldHoursFor`, 2 khoá System Settings |
| Q4 | Khách **tự huỷ** đơn đang chờ (hộp xác nhận) | ✅ `cancelOrderByCustomer` + `ConfirmDialog` |
| Q5 | Desktop **2 cột** trong `container-page` (cột phải 22rem dính) — ngoại lệ `container-narrow` (ADR-024) | ✅ |
| Q6 | Liên hệ người bán | **Hoãn** |
| Q7 | Sau khi trả, "Tải tài liệu" → Thư viện, trỏ tài liệu vừa mua | ✅ `/account/library?tai-lieu={productId}` (trang + email `order_paid`) |
| Q8 | SePay hiển thị cho khách là "Chuyển khoản (xác nhận tự động)" | ✅ `CUSTOMER_PROVIDER_LABELS` |
| Q9 | Không logo NAPAS/ngân hàng trong beta — tên ngân hàng bằng chữ | ✅ |
| Q10 | Mobile trang khách đặt **QR trước** dòng sao chép; Studio billing giữ thứ tự cũ | ✅ `TransferDetails order="qr-first"` / `"info-first"` |
| Q11 | Khách vãng lai **1 ô** "xác nhận thông tin chính xác và đồng ý Điều khoản", không tick sẵn | ✅ ô `acceptTerms` (câu chữ nêu Điều khoản + Chính sách bảo mật) |
| Q12 | Dưới thông tin MoMo có link "Chính sách thanh toán của {gian hàng}" | ✅ có link, trỏ **Chính sách người bán của nền tảng** (`legalDocumentPath("seller")`). **Quốc quyết 2026-10-27: dùng tạm**; Phong **đã đổi nhãn** thành "Chính sách người bán" ✅ code 2026-10-27 — KB-Audit §45, §46 |
| — | Không popup cho MoMo; số tiền màu `ink`; timeline 4 bước; thanh hành động dính đáy trên mobile | ✅ |

### 2.2. Bổ sung ADR-062 (đợt 1 luồng mua)
1. Phiên khách vãng lai (`refresh_tokens.guestCheckout`): idle/absolute như ADR-053, không "ghi nhớ", absolute tối đa **24 giờ**; chỉ vào checkout, `/account/orders`,
   `/account/library`, API tải (`requireCheckoutAccess`) — ✅ claim `gco`, `getGuestSessionPolicy`, `requireCheckoutAccess` (trang/action) + `requireCheckoutUser` (`POST /api/downloads`); `buyProductAction` cũng dùng `requireCheckoutAccess` — KB-Audit §46.
2. Khách vãng lai tải theo đúng `downloadLimit` — ✅ (không có giới hạn riêng).
3. **Ngoại lệ "không xác nhận trễ"**: đơn cổng xác nhận tay đã EXPIRED vẫn được người bán xác nhận nếu `customerDeclaredPaidAt < expiresAt`; có audit — ✅
   `canManuallyConfirmOrder(…, { declaredPaidAt })`, audit `lateDeclaredPaid`/`customerDeclaredPaid`.
4. Email đã thuộc tài khoản guest chưa kích hoạt → báo "đăng nhập hoặc gửi lại email kích hoạt"; không gắn đơn, không tạo phiên mới — ✅ `EMAIL_EXISTS_GUEST` (tài khoản thường: `EMAIL_EXISTS`).
5. Token `GUEST_ACTIVATION` sống 7 ngày, gửi lại được (huỷ token cũ), chỉ lưu hash, dùng một lần — ✅ token chỉ bị tiêu khi submit form ở `/verify-email/dat-mat-khau`.
6. Email cho khách khi đổi phương thức: gửi lại khi phương thức khác lần đã gửi, **tối đa 3 email/đơn** — ✅ (đếm qua audit `ORDER_PAYMENT_EMAIL_SENT`).
7. Rate limit (bảng `rate_limit_counters`, khoá đã băm): tạo guest 5/IP/giờ, 3/email/ngày; gửi lại email kích hoạt 3/email/giờ — ✅ `consumeRateLimit` (khoá HMAC).
8. Ô đồng ý duy nhất ghi nhận **Điều khoản + Chính sách bảo mật** bản hiệu lực — ✅ `UserLegalAcceptance` (bản nào có hiệu lực thì ghi).

---

## 3. Hệ Quả (Consequences)
- Thay hành vi của ADR-036 (cửa sổ xác nhận trễ 24 giờ) và ADR-059 (email người bán chỉ lần đầu chọn cổng; hạn chót xác nhận = hạn + 24 giờ) — spec đã sửa:
  [[02-System-Specs/Order-State-Machine|Order-State-Machine]] §3.1, §3.4, §3.10–§3.12.
- Trang thanh toán thành ngoại lệ ADR-024 (`container-page`) — [[04-Operations-Runbooks/UI-Design-System|UI-Design-System]] §4.4a, §8.4.
- Code cần commit + deploy + thử thủ công ❓. Phiên guest + kích hoạt: [[02-System-Specs/Auth-Session-Specs|Auth-Session-Specs]] §9A; luồng mua guest:
  [[02-System-Specs/Order-State-Machine|Order-State-Machine]] §3.13; UI: [[04-Operations-Runbooks/UI-Design-System|UI-Design-System]] §26.5–§26.7.

---

## 4. Liên Kết
* [[01-Architecture-Decisions/ADR-046-Customer-Purchase-Flow-Pending-Orders-Notifications|ADR-046 KB (≙ ADR-061)]] — luồng mua của khách
* [[02-System-Specs/Order-State-Machine|Order-State-Machine]] §3.12 · [[02-System-Specs/Payment-And-Billing|Payment-And-Billing]] §5K ·
  [[02-System-Specs/Studio-Orders-Specs|Studio-Orders-Specs]] §2.5
* [[03-API-Contracts/Endpoint-Directory|Endpoint-Directory]] §29 · [[03-API-Contracts/Database-Schema-Reference|Database-Schema-Reference]] §7 (migration)
* [[04-Operations-Runbooks/UI-Design-System|UI-Design-System]] §4.4a, §7.1, §8.4, §24.3, §26
* [[00-Index/KB-Audit-2026-09-26|KB-Audit]] §45

*Quay lại: [[MOC-Home]] (../00-Index/MOC-Home.md)*

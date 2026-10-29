---
tags:
  - runbook
  - payment
  - status/archive
date: 2026-10-26
updated: 2026-10-27
author: Long
---

# 🧪 Runbook: Kiểm chứng MoMo cá nhân (`MOMO_MANUAL`) trước khi bật QR (ADR-059 bổ sung lần 3)

> [!WARNING] Không còn áp dụng (Bổ sung ADR-059 lần 4)
> Chủ dự án chốt 2026-10-27 **bỏ hẳn QR cho MoMo thủ công**: không còn ô "Số tài khoản VietQR của ví", không còn hằng `MOMO_VIETQR_BIN`, trang thanh toán chỉ hiện số điện
> thoại, tên chủ ví, số tiền, nội dung + nút sao chép. Runbook này **không cần chạy nữa** — giữ nguyên nội dung dưới đây chỉ để tra cứu. Đặc tả hiện hành:
> [[02-System-Specs/Payment-And-Billing|Payment-And-Billing]] §5J; quyết định: [[01-Architecture-Decisions/ADR-044-Beta-Payments-Manual-Confirm-Emails-Sepay|ADR-044 KB]] §3.7.

> Mục đích: xác nhận ảnh QR mà hệ thống sinh cho ví MoMo **thật sự** chuyển tiền tới đúng ví, trước khi điền "Số tài khoản VietQR của ví". Quyết định:
> [[01-Architecture-Decisions/ADR-044-Beta-Payments-Manual-Confirm-Emails-Sepay|ADR-044 KB (≙ ADR-059)]] §3.6; đặc tả:
> [[02-System-Specs/Payment-And-Billing|Payment-And-Billing]] §5J.
>
> Mức xác minh: ✅ hành vi hệ thống đã đối chiếu code 2026-10-26 (đã commit `fa29d99`, migration đã áp — Quốc kiểm 2026-10-27) · 🟡 các bước theo brief của Quốc · ❓ **chưa ai chạy
> runbook này** — BIN `970454` và định dạng số tài khoản `99MM…` là **giả thuyết** trong comment code, chưa có nguồn chính thức.

> [!WARNING] Chưa điền "Số tài khoản VietQR" khi chưa xong runbook
> Để trống ô này thì trang thanh toán chỉ hiện số điện thoại, tên chủ ví, số tiền, nội dung + nút sao chép (phương án F1) — an toàn. Điền sai thì khách quét QR có thể
> chuyển tiền **tới tài khoản khác**.

---

## 0. Điều kiện trước
- Migration `20261026150000_adr059_momo_manual` — **đã áp** (Quốc kiểm `prisma migrate status` 2026-10-27). Trên DB khác chưa áp thì lưu cấu hình báo "Hệ thống chưa sẵn sàng cho MoMo cá nhân…" ✅ code.
- Có một ví MoMo cá nhân thật, 2–3 app ngân hàng khác nhau, và app MoMo khác (hoặc của người khác) để chuyển thử.

## 1. Lấy payload QR "Nhận tiền" của ví
1. Trong app MoMo, mở **"Nhận tiền"**, lưu ảnh QR về máy.
2. Giải mã ảnh bằng **zxing** (vd trang ZXing Decoder Online, hoặc thư viện zxing chạy local). Chép nguyên chuỗi payload (chuỗi EMVCo bắt đầu bằng `000201…`).
3. Không gửi ảnh/payload ra kênh công khai — chứa số tài khoản ví.

## 2. Đọc các trường trong payload
Payload là chuỗi TLV (2 số mã tag + 2 số độ dài + giá trị). Tìm:

| Cần tìm | Ở đâu | Ghi lại |
| :-- | :-- | :-- |
| `A000000727` | GUID VietQR (NAPAS) trong tag tài khoản (thường tag `38`) | Có → QR theo chuẩn VietQR |
| **BIN** ngân hàng | Tag con trong khối trên (6 chữ số) | So với `970454` |
| **Số tài khoản** | Tag con kế BIN | Dạng `99MM…` hay dạng khác |
| **Tag `80`** | Tag riêng ngoài khối chuẩn | Có hay không, giá trị là gì |

## 3. So với payload hệ thống sinh
1. Ở môi trường thử, điền cấu hình MoMo cá nhân (form "MoMo cá nhân") với **số tài khoản vừa đọc** ở ô "Số tài khoản VietQR của ví (tuỳ chọn)" — chỉ trên **gian hàng
   nội bộ** / cấu hình chưa bật cho khách thật.
2. Tạo một đơn (hoặc hoá đơn gói) chọn "Ví MoMo" (nhãn cho khách; ở Studio/System Center là "MoMo (thủ công)"), giải mã ảnh QR trên trang thanh toán bằng zxing.
3. So: GUID, BIN, số tài khoản phải trùng QR "Nhận tiền". Hệ thống thêm số tiền và nội dung (= mã đơn/hoá đơn) ✅ code (`buildVietQrPayload`).
4. QR gốc có **tag 80** mà payload hệ thống không có → ghi lại; cần quyết định có phải thêm (sửa code — việc của Hiếu, Quốc duyệt).

## 4. Chuyển thử 1.000đ
1. Dùng **2–3 app ngân hàng** khác nhau quét QR của hệ thống, chuyển **1.000đ**.
2. Dùng **app MoMo** quét cùng QR, chuyển 1.000đ.
3. Với mỗi lần, kiểm:
   - app hiện **đúng tên chủ ví** trước khi xác nhận;
   - tiền **về đúng ví** MoMo;
   - nội dung đến ví giữ **đúng mã đơn/hoá đơn**.
4. Ghi kết quả từng app (tên app, có quét được không, tên hiện ra, nội dung nhận được).

## 5. Quyết định
- **Tất cả đạt** → mới điền "Số tài khoản VietQR của ví" ở cấu hình thật, rồi bật cổng. Với cấu hình **platform**: đổi số điện thoại/số TK VietQR làm cổng **tự tắt**
  (ADR-013) — bật lại và lưu thêm một lần ✅ code.
- **BIN khác `970454`** → sửa đúng **một** hằng `MOMO_VIETQR_BIN` trong `packages/payments/src/providers/momo-manual.ts` (việc của Hiếu theo brief Quốc), làm lại bước 3–4.
- **Không đạt** (QR không trỏ được tới ví) → để trống ô số TK VietQR, dùng phương án F1; chi tiết ảnh QR ở nhánh dự phòng chốt sau (ADR-059 lần 3 mục 4).
- Báo kết quả cho Quốc để Long ghi lại BIN/định dạng đã kiểm vào [[02-System-Specs/Payment-And-Billing|Payment-And-Billing]] §5J.

## 6. Dọn dẹp
- Chuyển trả các khoản 1.000đ nếu cần; huỷ đơn/hoá đơn thử. Dòng audit không xoá được (ADR-037).

---

## Liên kết
* [[04-Operations-Runbooks/SePay-Live-Test-Runbook|SePay-Live-Test-Runbook]] — chạy thử SePay
* [[02-System-Specs/Payment-And-Billing|Payment-And-Billing]] §2, §5J · [[03-API-Contracts/Database-Schema-Reference|Database-Schema-Reference]] (`PaymentProviderId`)

*Quay lại: [[MOC-Home]] (../00-Index/MOC-Home.md)*

---
tags:
  - runbook
  - payment
  - billing
  - deployment
  - status/living
date: 2026-10-26
updated: 2026-11-24
author: Long
---

# 🧪 Runbook: Cấu hình SePay và chạy thử bằng giao dịch thật nhỏ (ADR-059, ADR-065, ADR-066)

> Mục đích: cấu hình SePay đúng cho **thu phí gói** (platform, System Center) và **bán tài liệu** (gian hàng, Studio), rồi thử **một giao dịch thật, số tiền nhỏ**
> trước khi mở beta. Quyết định: [[01-Architecture-Decisions/ADR-044-Beta-Payments-Manual-Confirm-Emails-Sepay|ADR-044 KB (≙ ADR-059)]],
> [[01-Architecture-Decisions/ADR-049-Sepay-Numeric-Payment-Code-Shared|ADR-049 KB (≙ ADR-065)]], [[01-Architecture-Decisions/ADR-050-Admin-Manual-Confirm-Invoice-Any-Provider|ADR-050 KB (≙ ADR-066)]].
>
> Mức xác minh: ✅ hành vi phía app đã đối chiếu code (2026-10-26 commit `fa29d99`; 2026-11-24 commit `14f08ba` + working tree chưa commit) · 🟡 thao tác trên giao diện
> SePay theo chuỗi gợi ý trong code / `docs/DECISIONS.md` / `docs/sepay-auto-payment-guide.md` (tài liệu của hệ thống khác) — Long chưa xem giao diện my.sepay.vn ·
> ❓ **chưa thử giao dịch thật**: chưa ai chạy runbook này trên môi trường thật với mã thanh toán mới (ADR-065), chưa bấm "Kiểm tra kết nối" với token thật — mọi kết
> quả "kiểm" dưới đây là kết quả **mong đợi**.

> [!WARNING] Database production (VPS) là DB riêng — đính chính 2026-11-24
> `CLAUDE.md`/ADR-034 ghi một DB dùng chung cho dev/Preview/production, nhưng Quốc xác minh 2026-11-24 (truy vấn chỉ đọc) rằng DB mà `.env` máy dev trỏ tới (Neon)
> **không** phải DB production của gieochu.net (không có hoá đơn `SEVQRWQRMN878`, không có cấu hình SePay) 🟡 Quốc báo — chờ ADR (KB-Audit §50 mục 12).
> Hệ quả: migration áp từ máy dev **không** lên production; giao dịch thử trên production tạo dữ liệu thật (hoá đơn, đơn, giao dịch, audit) trên DB production. Dòng
> `audit_logs` không xoá được (append-only, ADR-037). Dùng gian hàng nội bộ, không dùng gian hàng của người bán thật.

---

## 0. Trước deploy: chạy migrate deploy trên DB production ❓ chưa chạy
- Code ADR-065 đọc/ghi cột mới `orders.paymentRef` → migration `20261124120000_adr065_order_payment_ref` phải có trên DB production **trước/khi** deploy code. Hiện:
  **đã áp DB dev (Neon, `.env`)** 🟡 Quốc báo; **production (VPS) chưa áp** ❓.
- Lệnh: `prisma migrate deploy` (ở repo là `pnpm db:migrate`, dùng `PRISMA_MIGRATE_URL` — role owner, cần quyền DDL ✅ `CLAUDE.md`) với `PRISMA_MIGRATE_URL` trỏ **DB
  production**. Cách đặt biến/chạy trên VPS chưa có runbook ❓ — hỏi Quốc. Agent không tự chạy khi chưa được Quốc duyệt.
- Migration loại expand (chỉ thêm cột + unique index) — theo comment SQL, code cũ không đọc cột mới nên áp trước deploy an toàn ✅ đọc SQL.
- Kiểm sau khi chạy: `prisma migrate status` trên DB production báo không còn migration chờ ❓.

## 1. Chuẩn bị 🟡
- VPS có `APP_URL` là **HTTPS** (URL webhook dựng từ `APP_URL` — `buildWebhookNotifyUrl`) ✅ code.
- Cron `/api/cron/daily` chạy được trên VPS (crontab — ADR-049) ❓.
- **"Email hỗ trợ"** đã điền ở `/admin/settings` (tab "Email hỗ trợ") — trống thì email `invoice_pending_manual` bị bỏ qua, chỉ log
  `invoice.pending_manual: chưa đặt Email hỗ trợ…` ✅ code.
- SMTP hệ thống đã cấu hình (nếu không, `sendEmailNow` trả `EMAIL_NOT_CONFIGURED`) ✅ code.
- Tài khoản ngân hàng nhận tiền **đã liên kết** trên SePay. Nếu ngân hàng bắt buộc từ khoá ở đầu nội dung chuyển khoản (VietinBank: **`SEVQR`**), từ khoá đó **chính là
  tiền tố** dùng ở bước 2.2 🟡 (ADR-065).

## 2. Cấu hình trong app ✅ code
Nơi cấu hình: **System Center** `/admin/billing/payment` (hoá đơn gói) · **Studio** → Cài đặt → Thanh toán `/studio/{slug}/settings/payments` (đơn tài liệu của gian
hàng). Hai form giống nhau; mỗi bên dùng **tài khoản SePay của chính mình**.

1. **Ngân hàng, Số tài khoản, Tên chủ tài khoản.** Số tài khoản phải trùng tài khoản đã liên kết trên SePay — webhook bỏ qua giao dịch của tài khoản khác (§9).
2. **Tiền tố mã thanh toán** — **2–5 chữ cái** (không dấu, không số; tự in hoa). VietinBank bắt buộc `SEVQR`. Mã sinh ra = tiền tố + **8 chữ số** (vd `SEVQR40718256`):
   - System Center: mã hoá đơn gói = mã thanh toán.
   - Studio: mã thanh toán riêng của đơn (`paymentRef`), **khác** mã đơn — mã đơn/URL không đổi.
3. **Kiểu xác thực** + **Secret / API key webhook**:
   - Bấm **"Tạo key ngẫu nhiên"** (48 ký tự chữ/số, sinh trong trình duyệt) → **sao chép key ngay** (khung nhắc hiện dưới ô) — sau khi lưu, app chỉ hiện bản che
     `••••abcd`, không xem lại được.
   - `API_KEY`: SePay gửi header **`Authorization: Apikey <key>`**. `HMAC_SHA256`: SePay ký `{timestamp}.{rawBody}`, header `X-SePay-Signature: sha256=<hex>` + `X-SePay-Timestamp`.
   - Để trống ô = giữ secret đã lưu.
4. **API Token (để kiểm tra kết nối)** — tuỳ chọn; lấy ở **my.sepay.vn → Cấu hình Công ty → API Access** 🟡. Chỉ dùng cho nút "Kiểm tra kết nối", không ảnh hưởng nhận
   tiền. Để trống = giữ token đã lưu.
5. **Lưu.** Thông báo sau lưu nhắc đúng cấu hình SePay cần đặt (bước 3.2). System Center:
   - đổi số tài khoản/BIN hoặc secret webhook → cổng **tự tắt** (ADR-013) — bấm "Kiểm tra kết nối" (bước 4) hoặc bật lại và lưu thêm một lần;
   - chỉ thêm/đổi API Token **không** làm cổng tự tắt;
   - đổi tiền tố khi còn hoá đơn chờ mang tiền tố cũ (khác `SUB`) → cảnh báo hoá đơn đó không còn tự khớp.
   Studio không có cơ chế tự tắt.

## 3. Cấu hình phía SePay (my.sepay.vn) 🟡
1. **Webhook** — thêm mới, sự kiện **tiền vào**, phương thức POST:
   - System Center: `https://<domain>/api/webhooks/platform/sepay`
   - Gian hàng: `https://<domain>/api/webhooks/tenants/<tenantId>/sepay` (form Studio hiện sẵn URL kèm nút sao chép ✅ code)
   - Chứng thực: **API Key** (dán đúng key ở bước 2.3 — SePay gửi `Authorization: Apikey <key>`) **hoặc** HMAC-SHA256 với cùng secret.
2. **Cấu trúc mã thanh toán** (Công ty → Cấu hình chung → Cấu trúc mã thanh toán — đường dẫn theo chuỗi hướng dẫn trong app; form có khối "Cấu hình bên SePay" liệt kê
   đúng các bước với tiền tố đang nhập ✅ code): tạo **một** mẫu
   - Tiền tố: **đúng** tiền tố đã lưu ở bước 2.2;
   - Hậu tố: dài **8** ký tự — đặt **từ 8 đến 8**, **"Là số nguyên"**. Khối hướng dẫn trong app còn ghi "hoặc khoảng có chứa 8" — chưa kiểm trên SePay thật ❓; khi chạy
     thử nên dùng 8–8;
   - Không để hai mẫu cùng tiền tố (thông báo sau lưu: "chỉ giữ một mẫu"). Đổi tiền tố trong app ⇒ đổi mẫu trên SePay **cùng lúc**.
3. **API Access** — tạo API Token, dán vào ô ở bước 2.4.

## 4. Kiểm tra kết nối ✅ code / ❓ token thật
- Bấm **"Kiểm tra kết nối"** (chạy trên cấu hình **đã lưu** — nút bị khoá khi chưa lưu API Token hoặc form có thay đổi chưa lưu, lý do hiện cạnh nút ✅ code). App gọi `GET https://my.sepay.vn/userapi/bankaccounts/list` (Bearer token, chờ tối đa
  10 giây) và xác nhận: token hợp lệ, **số tài khoản có trên SePay**, **đúng ngân hàng** (BIN), **đang hoạt động**.
- Thành công → ghi thời điểm kiểm tra, **tự bật cổng**, ghi audit `PAYMENT_CONFIG_UPDATED` (cả System Center lẫn gian hàng).
- **Không kiểm được secret webhook** và không kiểm được "Cấu trúc mã thanh toán" — hai thứ này chỉ kiểm được bằng giao dịch thật (bước 5, 10).

| Thông báo | Ý nghĩa / cách xử lý |
| :-- | :-- |
| "Chưa nhập API Token SePay…" | Nhập token (bước 2.4), lưu, bấm lại |
| "API Token SePay không hợp lệ hoặc đã bị tắt…" | SePay trả 401/403 — tạo lại token ở API Access |
| "SePay đang giới hạn tần suất gọi API…" | 429 — đợi vài giây (giới hạn 2 request/giây/IP theo comment code) |
| "Không kết nối được tới SePay…" | Lỗi mạng hoặc quá 10 giây — thử lại |
| "…không thấy tài khoản ••••1234 trên SePay…" | Số tài khoản sai hoặc chưa liên kết trên SePay |
| "…thuộc ngân hàng khác (…)" | Sửa ô Ngân hàng cho khớp |
| "…đang tạm khoá trên SePay." | Mở lại tài khoản trên SePay |

## 5. Giao dịch đúng tiền (platform)
- Dùng **gói thử giá nhỏ** (chỉnh ở `/admin/plans`) và **gian hàng nội bộ**; tạo hoá đơn SePay **mới** ở `/studio/{slug}/billing` (hoá đơn tạo trước 2026-11-24 mang mã dạng
  cũ — SePay không nhận diện, xem §12). Kiểm mã hoá đơn có dạng `<tiền tố><8 chữ số>`, chuyển **đúng số tiền, đúng nội dung**.
- Trên SePay, chi tiết giao dịch phải có **"Mã thanh toán"** (không phải "—") và **Webhooks ≥ 1** 🟡.
- Kiểm trong app (mong đợi ✅ code, thực tế ❓):
  - hoá đơn **PAID**, gói được nâng;
  - tab `/admin/billing/invoices?tab=giao-dich` hiện **"Đã áp"**;
  - `/admin/audit` có `SUBSCRIPTION_PAID` với `source: PLATFORM_WEBHOOK`.

## 6. Giao dịch sai tiền (platform)
- Mong đợi ✅ code: tab Giao dịch hiện **"Sai số tiền"**, hoá đơn vẫn **PENDING**.
- Nút "Xác nhận hoá đơn từ giao dịch": **thừa** tiền → xác nhận được (audit `source: ADMIN_TRANSACTION_CONFIRM`, `differenceVnd` > 0); **thiếu** tiền →
  bị chặn `TRANSACTION_UNDERPAID`. Phần thừa admin hoàn ngoài hệ thống.

## 7. Gửi lại webhook
- Gửi lại cùng sự kiện từ SePay → **không** sinh giao dịch thứ hai: `webhook_events` (`scope, provider, providerEventId` unique) chặn, route trả `200
  { success: true }` ✅ code.

## 8. Chữ ký sai
- Sai key/chữ ký → **401** `{ error: "invalid_signature" }` ✅ code. (Cổng chưa cấu hình/tắt → 404 `not_configured`; body hỏng/thiếu trường sau khi chữ ký
  đúng → 400 `invalid_body`.)

## 9. Xem kết quả
- Log pm2 trên VPS: `platform payment webhook processed` / `… rejected: invalid body`; từ ADR-065 thêm **`platform payment webhook ignored: other bank account`** /
  **`tenant payment webhook ignored: other bank account`** — giao dịch thuộc tài khoản ngân hàng **khác** số TK đã cấu hình: route trả 200, **không** ghi
  `webhook_events`/giao dịch ✅ code.
- Tab "Giao dịch cổng", `/admin/audit`.

## 10. Gian hàng (tenant)
- Cấu hình theo §2–§4 ở Studio → Cài đặt → Thanh toán. Không còn cảnh báo "tiền tố khác mã đơn" (ADR-065).
- Mua thử một tài liệu giá nhỏ, chọn **"Chuyển khoản (xác nhận tự động)"** (SePay). Nội dung chuyển khoản/QR = **mã thanh toán SePay** `<tiền tố><8 chữ số>`; trang chi tiết
  đơn Studio hiện dòng **"Mã thanh toán SePay"** dưới "Mã đơn" ✅ code.
- Chuyển đúng tiền → mong đợi đơn **FULFILLED**. Khách tự gõ **mã đơn** thay vì mã thanh toán → app vẫn khớp nếu webhook tới, nhưng SePay chỉ gọi webhook khi nhận diện được
  mã theo "Cấu trúc mã thanh toán" 🟡 (suy từ ADR-065 — chưa kiểm thật).
- Sai tiền → giao dịch `MISMATCH_AMOUNT`, đơn không tự giao, chủ gian hàng nhận email `payment_mismatch` và thấy dòng ở `/studio/{slug}/orders/giao-dich` ✅ code / ❓ thực tế.

## 11. Dọn dẹp 🟡
- Hoàn tiền giao dịch thử (ngoài hệ thống), trả giá gói về như cũ ở `/admin/plans`.
- Không xoá được dòng audit (append-only).

## 12. Xử lý sự cố

| Triệu chứng | Nguyên nhân thường gặp | Cách xử lý |
| :-- | :-- | :-- |
| Giao dịch trên SePay hiện **"Mã thanh toán: —"**, **0 webhook** 🟡 | **Sai "Cấu trúc mã thanh toán"**: tiền tố trên SePay khác tiền tố trong app, hậu tố không phải "từ 8 đến 8", không chọn "Là số nguyên", có nhiều mẫu cạnh tranh; hoặc hoá đơn/đơn tạo **trước ADR-065** (mã cũ có chữ trong hậu tố — sự cố `SEVQRWQRMN878` 2026-11-24) | Sửa mẫu theo §3.2. Hoá đơn/đơn mã cũ **không** tự khớp được → xác nhận tay (hai dòng dưới) |
| **Tiền đã về nhưng hoá đơn gói chưa ghi nhận** (không có webhook, hoặc giao dịch không khớp) | Như dòng trên, hoặc webhook lỗi | Đối chiếu sao kê rồi **xác nhận tay (ADR-066)**: `/admin/subscriptions` cột **"Thao tác"** (hoá đơn gần nhất) hoặc `/admin/billing/invoices` tab "Tất cả" → "Xác nhận đã nhận tiền…" (hoá đơn hết hạn: "Xác nhận trễ…" — kỳ gói tính lại từ lúc xác nhận; bị chặn nếu gian hàng đã có hoá đơn mới hơn). Ghi chú không bắt buộc (vd mã GD ngân hàng) — lưu vào audit `SUBSCRIPTION_PAID`. Không hoàn tác được ✅ code. Nếu giao dịch đã có ở tab "Giao dịch cổng" thì cũng có thể dùng "Xác nhận hoá đơn từ giao dịch" (§6) |
| Tiền đã về nhưng **đơn gian hàng** chưa ghi nhận | Như trên | Người bán xác nhận tay ở trang chi tiết đơn (ghi chú bắt buộc) — chỉ khi đơn **còn trong hạn giữ** (SePay 48 giờ); đơn SePay đã hết hạn không xác nhận tay được (ngoại lệ "khách báo đã chuyển trước hạn" chỉ áp cho cổng xác nhận tay) ✅ code `confirmOrderManually` / `canManuallyConfirmOrder` |
| Webhook **401** `invalid_signature` | Key trên SePay khác key đã lưu, hoặc khác kiểu xác thực | Tạo key mới (§2.3), lưu, dán lại trên SePay |
| Webhook **404** `not_configured` | Cổng đang tắt (System Center tự tắt sau khi đổi số TK/secret) | "Kiểm tra kết nối" (tự bật khi thành công) hoặc bật + lưu lại |
| Webhook **200** nhưng không có giao dịch nào; log `… ignored: other bank account` | Giao dịch thuộc tài khoản ngân hàng khác cùng tài khoản SePay | Đúng thiết kế; nếu là tài khoản nhận tiền thật → sửa Số tài khoản trong app |
| Giao dịch ghi **"Thiếu mã hoá đơn"** / "Không tìm thấy hoá đơn" | Khách gõ sai nội dung, mã dạng cũ, hoặc tiền tố đã đổi | Đối chiếu rồi xác nhận từ giao dịch hoặc xác nhận tay |
| Sau deploy: lỗi kiểu "column `paymentRef` does not exist" khi khách chọn SePay / mở đơn | Chưa chạy migration ADR-065 trên DB production (suy từ code ❓ chưa gặp thật) | Bước 0 |
| Không lưu được: "Tiền tố mã … phải gồm 2–5 chữ cái…" | Tiền tố có số/dấu, hoặc ngoài 2–5 ký tự (form cũ cho phép platform 2–6 ký tự, Studio 1–4 ký tự, kể cả số) | Đổi tiền tố, đồng thời đổi mẫu trên SePay |

---

## Liên kết
* [[02-System-Specs/Payment-And-Billing|Payment-And-Billing]] §3, §5F–§5I, §5L–§5N · [[02-System-Specs/Order-State-Machine|Order-State-Machine]] §3.1, §3.11
* [[03-API-Contracts/Endpoint-Directory|Endpoint-Directory]] §9, §28, §31
* [[04-Operations-Runbooks/Storage-Gateway-VPS-Runbook|Storage-Gateway-VPS-Runbook]] — pm2 trên VPS

*Quay lại: [[MOC-Home]] (../00-Index/MOC-Home.md)*

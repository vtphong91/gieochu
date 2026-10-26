# Đề xuất chạy thử (beta): thanh toán · gói dịch vụ · trang tài liệu — 2026-10-25

> **Người viết:** Long (tài liệu), theo brief của Quốc. **Người đọc:** chủ dự án — để quyết định.
> **Loại tài liệu:** phân tích + đề xuất. Không sửa code, không có quyết định nào ở đây có hiệu lực cho tới khi chủ dự án chốt
> (Quốc ghi ADR vào `docs/DECISIONS.md`).
>
> **Mức xác minh:** ✅ Long đã đối chiếu code (working tree 2026-10-25) · 🟡 theo báo cáo/PLAN/ADR, Long chưa kiểm lại ·
> ❓ cần môi trường thật (DB, cổng thanh toán, trình duyệt, VPS).
> Long **không** đọc DB, không gọi cổng thanh toán, không mở trình duyệt. Test: `pnpm test:count` = **100 unit / 66 integration**
> (đã chạm trần) ✅.

## Tóm tắt nhanh

| Câu hỏi | Trả lời ngắn |
|---|---|
| Có beta ngay được không? | **Chưa.** Có 4 điểm chặn: (1) upload file hỏng trên Vercel (ADR-055, chờ Vương); (2) nhiều phần đã code nhưng **chưa commit/deploy**; (3) cấu hình thanh toán gói của nền tảng chưa đầy đủ (dòng SePay đã mất); (4) chưa thử email thật / cổng thật lần nào. |
| Thanh toán nên bật gì? | **Chuyển khoản QR thủ công** cho cả gói lẫn tài liệu. SePay bật sau khi chạy thử thành công 1 giao dịch thật nhỏ. **Không bật MoMo.** |
| Gói dịch vụ đi nhanh thế nào? | **Nới hạn mức gói Miễn phí** trong `/admin/plans` — không cần code, không migration. Nếu cần cấp gói trả phí cho từng người bán thì Hiếu làm thêm nút "Cấp gói tay" (code nhỏ, không migration). |
| Trang tài liệu ổn chưa? | Luồng đủ về code. Trong lúc chờ upload, người bán vẫn bán được bằng **link Google Drive/OneDrive/Dropbox** (đã có, ADR-026). |
| Mất bao lâu? | Ước khoảng 2 chặng chuẩn bị (≈ 1–2 tuần, phụ thuộc Vương) rồi mở beta nhóm nhỏ. Chi tiết ở Phần 4. |

---

## Phần 0 — Bối cảnh ảnh hưởng mọi phần

| Điểm | Hiện trạng | Mức |
|---|---|---|
| Một database duy nhất cho dev, Vercel và VPS (ADR-034) | Thao tác nào trên máy dev cũng là thao tác trên dữ liệu thật của người dùng beta. | ✅ ADR |
| Môi trường: Vercel để thử nghiệm, VPS là production (ADR-049) | Beta với người dùng thật nên chạy trên môi trường nào **chưa chốt** — ảnh hưởng trực tiếp tới upload, cron và địa chỉ webhook. | 🟡 |
| Nhiều phần "xong code, chưa commit" | ADR-056 (hoá đơn/QR), ADR-057 (chính sách), ADR-058 (tab/accordion), sửa lệch QR khi đổi mã giảm giá… đều ghi "chưa commit" trong `docs/PLAN.md`. | 🟡 PLAN + ✅ `git status` |
| Việc định kỳ (hết hạn đơn, hết hạn gói, nhắc gia hạn) | Chạy **một lần mỗi ngày** qua `GET /api/cron/daily` (Vercel Cron 03:00 giờ VN, `apps/web/vercel.json`). Trên VPS **chưa có crontab** (PLAN). | ✅ code · 🟡 VPS |

---

## Phần 1 — Phương thức thanh toán

### 1.1. Hai luồng tiền tách biệt

| | Thu phí gói (System Center thu) | Bán tài liệu (gian hàng thu) |
|---|---|---|
| Tiền về đâu | Tài khoản của nền tảng | **Thẳng tài khoản người bán** (nền tảng không giữ tiền — ADR-039) |
| Cấu hình ở đâu | `/admin/billing/payment` (bảng `platform_payment_configs`) | Studio → Cài đặt → Thanh toán (bảng `tenant_payment_configs`, mỗi gian hàng tự nhập) |
| Ai xác nhận chuyển khoản tay | Admin, ở `/admin/billing/invoices` tab "Chờ đối soát" | Chủ gian hàng, ở trang chi tiết đơn Studio |
| Webhook | `/api/webhooks/platform/sepay` và `/momo` — xử lý ngay trong request | `/api/webhooks/tenants/{tenantId}/sepay` và `/momo` — ghi nhận rồi xử lý qua job ngay sau phản hồi (ADR-019/036) |

Hai luồng **không dùng chung** bảng, secret hay địa chỉ webhook ✅ (`packages/payments`, `PaymentScope`).

### 1.2. Hiện trạng từng cổng

| Cổng | Có trong code | Tự đối soát | Đã chạy thật chưa | Rủi ro chính |
|---|---|---|---|---|
| **Chuyển khoản QR thủ công** | ✅ cả hai luồng | Không — người xác nhận bấm tay | Gói: có **1 hoá đơn QR đã thu** trên DB 🟡 (Hiếu chẩn đoán, ADR-056). Đơn tài liệu thật ❓ | Phụ thuộc người xác nhận có kịp hay không (xem 1.3, mục "Đối soát tay"). Không có email báo khi có hoá đơn/đơn đang chờ ✅. |
| **SePay** | ✅ cả hai luồng; xác thực `Apikey` hoặc HMAC-SHA256, so sánh an toàn thời gian ✅ | Có (webhook) | **Chưa** thử với tài khoản SePay thật ❓ (PLAN: "thử MoMo/SePay thật" còn mở). Dòng SePay của nền tảng **hiện không còn** 🟡 (sự cố 2026-10-24). | Route chỉ đọc body JSON (SePay có thể gửi dạng form — BACKLOG) 🟡. Không có nút "Kiểm tra kết nối" cho SePay ✅. Gói: chuyển sai số tiền thì giao dịch chỉ được lưu, **không có màn hình nào cho admin xem** ✅, và admin **không** xác nhận tay được hoá đơn SePay (chỉ QR thủ công) ✅. |
| **MoMo** | ✅ cả hai luồng; có chế độ sandbox/production và nút kiểm tra kết nối ✅ | Có (IPN) | **Chưa** thử MoMo thật ❓ | Đổi mã giảm giá sau khi đã tạo link MoMo: **chưa xử lý** (ADR-056 lần 2) — báo lỗi, đơn giữ nguyên, an toàn tiền. Không có công tắc hệ thống để cấm người bán bật MoMo ✅ (người bán tự bật trong Studio). |
| **VNPay / Stripe** | **Không có code** — chỉ là 2 thẻ "Sắp ra mắt" trên trang `/admin/billing/payment` ✅ | — | — | Không rủi ro tiền; chỉ có thể gây hiểu nhầm cho người xem trang quản trị. |

### 1.3. Các vấn đề đã biết

| Vấn đề | Hiện trạng | Ảnh hưởng beta |
|---|---|---|
| Cấu hình SePay nền tảng bị test ghi đè (2026-10-24) | Đã đổi quy ước: test không ghi bảng cấu hình dùng chung nữa (mock lớp đọc) 🟡 PLAN. Dòng SePay nền tảng hiện không còn 🟡. | Muốn dùng SePay cho thu phí gói phải **nhập lại**. Lưu ý: lần lưu đầu luôn bị **tự tắt** (ADR-013) ✅ — phải bấm lưu lần 2 có tích "Bật". |
| MoMo chưa xử lý khi đổi mã giảm giá | Chủ dự án chốt tạm chưa xử lý (ADR-056 lần 2). | Lý do thêm để **không bật MoMo** trong beta. |
| QR lệch tiền khi áp mã sau khi đã có QR | **Đã sửa** — server tạo lại QR theo tổng mới, chặn khi đơn đã thanh toán/huỷ/hết hạn ✅ code. Chưa commit 🟡. | Khách đã lưu ảnh QR cũ rồi chuyển theo số cũ: SePay ghi "sai số tiền", không tự giao hàng → chủ gian hàng xác nhận tay ✅. |
| Đối soát tay — **đơn tài liệu** | Chủ gian hàng chỉ xác nhận được khi đơn còn chờ hoặc **trong 24 giờ sau khi đơn hết hạn** ✅ (`canManuallyConfirmOrder`). Đơn hết hạn sau **60 phút** mặc định ✅. Không có email báo người bán khi có đơn chờ ✅. | Nếu người bán không vào Studio trong ~25 giờ, **khách đã chuyển tiền nhưng không nhận được tài liệu**, và giao diện không cho xác nhận nữa. Đây là rủi ro tiền lớn nhất của beta. |
| Đối soát tay — **hoá đơn gói** | Hoá đơn chờ **24 giờ** mặc định; cron hằng ngày chuyển sang "Hết hạn" ✅. Nút xác nhận chỉ hiện với hoá đơn QR **đang chờ** ✅ — hết hạn thì mất nút. Không có email báo admin ✅. | Admin phải kiểm sao kê và bấm xác nhận hằng ngày; chậm là người bán đã trả tiền mà gói không lên. |
| Hoàn tiền | **Gói:** 7 ngày, chỉ lần thanh toán gói đầu tiên, 100%, admin tự chuyển khoản rồi bấm "Đã hoàn" ✅ code (đã kiểm bằng dữ liệu 🟡, chưa qua giao diện ❓). **Đơn tài liệu:** người bán tự chuyển trả, nút "Hoàn tiền" chỉ ghi nhận + thu hồi quyền tải ✅. Không cổng nào tự hoàn. | Chấp nhận được cho beta, miễn có quy trình rõ (1.4). |
| Thanh toán trễ | Webhook đến trễ ≤ 24 giờ sau hạn đơn vẫn tự giao; trễ hơn thì chỉ ghi nhận, người bán xử lý tay (ADR-036) ✅. | Như mục đối soát tay đơn tài liệu. |

### 1.4. Phương án em đề xuất cho beta

**Bật / tắt:**

| Cổng | Thu phí gói | Bán tài liệu |
|---|---|---|
| Chuyển khoản QR thủ công | **Bật** | **Bật** (khuyến nghị mọi người bán beta dùng) |
| SePay | **Tắt lúc đầu.** Bật khi đã chạy 1 giao dịch thật nhỏ (vd 2.000đ) thành công, kiểm cả trường hợp sai số tiền. | Cho phép với người bán đã có tài khoản SePay, sau khi đội mình chạy thử thành công 1 lần trên cùng môi trường. |
| MoMo | **Không bật** | Khuyến nghị người bán **không bật** (không có công tắc hệ thống — muốn chặn hẳn phải sửa code nhỏ) |
| VNPay / Stripe | Giữ "Sắp ra mắt" hoặc ẩn 2 thẻ (sửa giao diện nhỏ) | — |

**Chỉnh cấu hình, không cần code** (System Center → Cấu hình chung → Nghiệp vụ; giới hạn đọc từ code ✅):

| Thiết lập | Mặc định | Giới hạn cho phép | Đề xuất beta | Tác dụng |
|---|---|---|---|---|
| Hạn đơn chờ thanh toán | 60 phút | 15–1440 phút | **1440 phút (24 giờ)** | Cửa sổ xác nhận tay của người bán dài ra ~48 giờ |
| Hạn hoá đơn chờ thanh toán | 24 giờ | 1–168 giờ | **72 giờ** | Admin có 3 ngày để đối soát hoá đơn gói |

(Đổi hạn đơn là quyết định nghiệp vụ ảnh hưởng tiền — cần chủ dự án chốt.)

**Code tối thiểu nên làm trước beta** (Hiếu, **không migration**):

1. Email báo **chủ gian hàng** khi khách chọn chuyển khoản thủ công (có mã đơn, số tiền, link xác nhận).
2. Email báo **admin** (hoặc địa chỉ "Email hỗ trợ" đã có trong cấu hình hệ thống ✅) khi có hoá đơn gói QR đang chờ đối soát.
3. (Nên có) Cho admin xác nhận được hoá đơn QR **đã hết hạn** mà tiền đã về — hiện hàm xử lý chấp nhận được, chỉ thiếu nút ✅.

**Quy trình đối soát hằng ngày đề xuất:**

| Ai | Khi nào | Việc |
|---|---|---|
| Admin (chủ dự án) | Mỗi sáng + khi có email báo | Mở `/admin/billing/invoices` tab "Chờ đối soát", so với sao kê ngân hàng theo **mã hoá đơn trong nội dung chuyển khoản**, bấm "Xác nhận đã nhận tiền". |
| Người bán beta | Khi có email báo / mỗi ngày | Mở Studio → Đơn hàng → lọc "Chờ thanh toán", so sao kê, xác nhận tay (bắt buộc ghi chú). |
| Admin | Hằng tuần | Xem tab "Tất cả" lọc "Hết hạn" để bắt hoá đơn đã trả nhưng chưa ai xác nhận. |

**Câu hỏi cần chốt (Phần 1):** xem câu 1–5 ở cuối file.

---

## Phần 2 — Module gói dịch vụ

### 2.1. Hiện trạng

| Hạng mục | Hiện trạng | Mức |
|---|---|---|
| 4 gói | FREE 0đ · CREATOR 99.000đ · PRO 199.000đ · BUSINESS 499.000đ / tháng — đây là **giá trị seed mặc định**; admin sửa được ở `/admin/plans`, số đang dùng trên DB ❓ | ✅ seed · ❓ DB |
| Hạn mức | Số sản phẩm xuất bản, tổng dung lượng, dung lượng 1 file, dung lượng ảnh. Seed Free: 5 sản phẩm, 500 MB, 50 MB/file, 100 MB ảnh. `-1` = không giới hạn, `0` = không được phép (ADR-041). | ✅ |
| Hạn mức được kiểm ở đâu | Số sản phẩm: lúc **xuất bản**. Dung lượng: lúc xin upload và lúc hoàn tất upload. | ✅ |
| Cờ tính năng theo gói | Có hàm kiểm nhưng **chưa chặn chức năng nào** → gói Free dùng được mọi tính năng hiện có. | ✅ |
| Gian hàng mới | Tự vào gói Free, không hết hạn, không dùng thử (Free Forever — ADR-021; ADR-041 "Không dùng thử"). Cột `trialDays` còn nhưng không được dùng. | ✅ |
| Mua / gia hạn | Studio → Gói dịch vụ: chọn gói + cổng → tạo hoá đơn (không tạo trùng khi còn hoá đơn chờ) → trả tiền → gói đổi **ngay**, không tính chênh lệch, kỳ mới nối sau kỳ cũ. Gói không có mã giảm giá. | ✅ |
| Nhắc / ân hạn / hết hạn | Cron hằng ngày: nhắc trước 7 ngày và 1 ngày; hết kỳ → ân hạn (7 ngày mặc định) → **về Free**, không mất dữ liệu; hoá đơn chờ quá hạn → "Hết hạn". | ✅ code · ❓ email thật |
| Hoàn tiền 7 ngày | Như 1.3. | ✅ code · ❓ giao diện |
| `/admin/subscriptions` (menu "Đơn hàng") | **Chỉ xem**: gian hàng, gói, trạng thái, hạn, hoá đơn gần nhất; lọc theo gói/trạng thái. | ✅ |
| Admin cấp / nâng gói tay | **Chưa có.** Không có chỗ nào trong code cho admin đổi gói của một gian hàng ngoài luồng hoá đơn. | ✅ |

### 2.2. So sánh phương án beta nhanh

| | A. Nới hạn mức gói Free | B. Admin "Cấp gói tay" có thời hạn | C. Mã mời beta / dùng thử N ngày |
|---|---|---|---|
| Cách làm | Admin sửa gói Free ở `/admin/plans` (vd 50 sản phẩm, 5 GB, 250 MB/file) | Nút mới ở `/admin/subscriptions`: chọn gói + số ngày → gói lên ngay, ghi audit; hết hạn đi theo luồng ân hạn → về Free như gói trả tiền | Bảng mã mời mới; nhập mã khi mở gian hàng → tự vào gói trả phí N ngày |
| Công sức | **0 code** — vài phút | Nhỏ: 1 Server Action + 1 hộp thoại + 1 loại audit (Hiếu ~1 ngày) 🟡 ước lượng | Vừa–lớn: bảng mới, sửa luồng tạo gian hàng, màn hình quản lý mã |
| Migration | Không | **Không** (audit lưu chuỗi — ✅ schema) | **Có** (bảng mới) |
| Rủi ro | Áp cho **mọi** gian hàng, kể cả người đăng ký ngoài beta. Sau beta hạ lại: sản phẩm đã xuất bản vẫn giữ, chỉ chặn xuất bản thêm ✅. Không nên đặt `-1` cho dung lượng vì ổ VPS hữu hạn. | Cần chốt: gói cấp tay có được hoàn tiền không (không có hoá đơn → không), có nhận email nhắc gia hạn không. | Trái quyết định "Không dùng thử" (ADR-041) → cần ADR mới. |
| Test được gì | Toàn bộ chức năng bán tài liệu | Thêm: giao diện gói trả phí, nhắc gia hạn, ân hạn, về Free | Như B + luồng đăng ký |

> Phương án "giảm giá / 0đ cho gói" **không khuyến nghị**: gói không hỗ trợ mã giảm giá ✅; đặt giá gói trả phí = 0đ sẽ sinh hoá đơn 0đ vẫn phải
> đối soát, hành vi tạo QR 0đ chưa kiểm ❓.

### 2.3. Phương án em đề xuất

- **Làm ngay: A.** Nới hạn mức Free đủ rộng để người bán beta không vướng; giữ giá gói trả phí thật.
- **Luồng trả tiền gói** vẫn test, nhưng bằng **giao dịch thật nhỏ do đội nội bộ** (mua → xác nhận → yêu cầu hoàn → admin hoàn), không bắt người bán beta trả tiền.
- **B làm sau, nếu cần** test gói trả phí với người bán thật.
- **C để sau beta.**

| Phải có trước beta | Để sau |
|---|---|
| Quyết định mức hạn mức Free cho beta (A) | Cấp gói tay (B) |
| Cấu hình QR thủ công nền tảng đang bật, đã thử 1 hoá đơn thật | Mã mời / dùng thử (C) |
| Email gia hạn/hoàn tiền gửi được thật (SMTP) ❓ | Chặn tính năng theo gói (cờ tính năng) |
| Cron hằng ngày chạy trên đúng môi trường beta ❓ | Dọn cột `trialDays` |

**Câu hỏi cần chốt (Phần 2):** câu 6–8.

---

## Phần 3 — Trang tài liệu (sản phẩm)

### 3.1. Rà luồng đầy đủ

| # | Bước | Hiện trạng | Mức |
|---|---|---|---|
| 1 | Người bán tạo tài liệu | Editor Tạo/Sửa chung; lần thêm file/link đầu tiên tự tạo bản nháp (ADR-027) | ✅ code · ❓ trình duyệt |
| 2 | Tải file lên | **Hỏng trên Vercel**: CSP chỉ cho `connect-src 'self' https://api.cloudinary.com` ✅ (`proxy.ts`), MinIO đang ở `http://…:9000` → bị chặn. Chờ Vương làm HTTPS `s3.<domain>` rồi Hiếu thêm origin vào CSP (ADR-055). Trên VPS, nếu bật Storage Gateway (ADR-045) thì cùng origin, nhưng mẫu nginx còn lệch endpoint (ADR-055) ❓ | ✅ code · ❓ VPS |
| 2b | Giao bằng link ngoài | **Dùng được ngay**: Drive, Docs, OneDrive, SharePoint, Dropbox, chỉ `https`; link chỉ trả cho người đã mua, vẫn tính lượt tải (ADR-026) | ✅ code |
| 3 | Quét file | Chỉ kiểm "nội dung khớp đuôi file"; **không quét virus** (ADR-018), file nào qua kiểm định dạng đều đánh dấu sạch | ✅ |
| 4 | Xem trước | Người bán xem trước trang (noindex) ✅; xem trước file trong Studio dùng thư viện `xlsx` 0.18.5 cho bảng tính ✅ — phiên bản này có cảnh báo bảo mật công khai 🟡 (chưa chạy `pnpm audit`) | ✅ / 🟡 |
| 5 | Xuất bản | Bắt buộc: danh mục đang bật, ảnh bìa (Cloudinary), ≥1 nguồn giao (file sạch hoặc link). Kiểm hạn mức số sản phẩm | ✅ · ❓ cấu hình Cloudinary trên DB |
| 6 | Trang công khai `/{gian-hàng}/{tài-liệu}` | Có, có `generateMetadata`; chỉ gian hàng **ACTIVE** hiện tài liệu (ADR-040). Chưa có sitemap/robots ✅ | ✅ |
| 7 | Mua | **Không có giỏ hàng**: mỗi đơn 1 tài liệu ("Mua ngay"); không mua được tài liệu của chính mình hoặc đã sở hữu; tổng tiền luôn tính lại ở server | ✅ |
| 8 | Thanh toán | Theo Phần 1 | ✅ / ❓ |
| 9 | Tải file | Thư viện `/account/library`; link tải ngắn hạn ≤ 10 phút, giới hạn lượt (mặc định cấu hình được; `0` = không giới hạn) | ✅ code · ❓ phụ thuộc bước 2 |
| 10 | Đánh giá | Có (M10a), chỉ người đã mua | ✅ code · ❓ trình duyệt |
| 11 | Báo cáo vi phạm | Có (M12c): ai cũng báo được, admin xử lý ở `/admin/reports`, quyền lợi người mua khi tài liệu bị gỡ (ADR-038/039) | ✅ code · ❓ trình duyệt |
| 12 | Lưu trữ / xoá | Chưa ai mua → xoá hẳn cả file; đã có người mua → chỉ lưu trữ, giữ file cho người mua (ADR-051) | 🟡 ADR (Long chưa đối chiếu sâu) |

### 3.2. Phân loại

| Loại | Việc | Ai |
|---|---|---|
| **Điểm chặn beta** | Upload file thật chạy được trên môi trường beta (ADR-055: DNS, TLS, CORS, đóng cổng 9000 → CSP) | Vương → Hiếu |
| **Điểm chặn beta** | Kiểm thật **một lần trọn luồng** mua → tải trên môi trường beta (chưa ai làm) ❓ | Chủ dự án + Quốc |
| **Điểm chặn beta** | Email "đã thanh toán" / "có đơn mới" gửi tới hộp thư thật — trước đây chưa từng gửi được do lỗi đã sửa ở Order-State-Machine §3.7 🟡 | Chủ dự án kiểm SMTP |
| Nên tối ưu | Nâng hoặc tạm tắt xem trước Excel (`xlsx` 0.18.5) — rủi ro thấp vì chỉ người bán xem file của chính mình | Hiếu |
| Nên tối ưu | Kiểm Cloudinary đã cấu hình (thiếu thì không có ảnh bìa → không xuất bản được) ❓ | Chủ dự án |
| Nên tối ưu | Quét slug trùng trên DB trước khi deploy (ADR-030) ❓ | Quốc |
| Để sau | Quét virus thật (ClamAV) — cần cài dịch vụ riêng trên VPS (ADR-018) | Vương + Hiếu |
| Để sau | SEO tài liệu, sitemap, JSON-LD — thuộc kế hoạch SEO tổng thể đã hoãn | — |
| Để sau | Tự lưu nháp lên server: phần nền đã có, **chưa gắn vào editor nào** ✅ | Hiếu |
| Để sau | Giỏ hàng nhiều tài liệu, xem thử/watermark | — |

### 3.3. Phương án em đề xuất

- Không chờ upload mới mở beta nội bộ: **cho người bán beta giao tài liệu bằng link Drive** trong lúc Vương làm ADR-055.
- Chỉ mở beta cho người ngoài sau khi upload thật + trọn luồng mua → tải đã chạy được ít nhất một lần.
- Beta chưa có quét virus: ghi rõ trong hướng dẫn người bán và chỉ mời người bán quen biết.

**Câu hỏi cần chốt (Phần 3):** câu 9–11.

---

## Phần 4 — Lộ trình beta đề xuất

### 4.1. Việc theo chặng

| Chặng | Việc | Ai | Migration | Rủi ro |
|---|---|---|---|---|
| **0 — Dọn nền** (1–2 ngày) | Commit + deploy các phần đã xong (ADR-056/057/058…) | Chủ dự án duyệt, Quốc review | Không (ADR-057 đã chạy) | Trung bình — nhiều thay đổi dồn |
| 0 | Chốt môi trường beta (Vercel hay VPS) | Chủ dự án | — | — |
| 0 | Cron hằng ngày chạy được trên môi trường đó (`CRON_SECRET` trên Vercel hoặc crontab VPS) | Vương / chủ dự án | Không | Cao nếu thiếu — gói không hết hạn, hoá đơn không đóng |
| 0 | Kiểm SMTP gửi email thật | Chủ dự án | Không | Cao — mọi thông báo phụ thuộc |
| 0 | Nhập cấu hình QR thủ công nền tảng; chỉnh 2 thiết lập hạn chờ (1.4); nới hạn mức Free (2.3) | Chủ dự án | Không | Thấp |
| **1 — Thanh toán + upload** (≈ 1 tuần) | MinIO HTTPS `s3.<domain>` (ADR-055) | Vương | Không | Trung bình (hạ tầng) |
| 1 | CSP cho origin storage, kiểm upload end-to-end | Hiếu | Không | Thấp |
| 1 | 2 email báo "đơn chờ xác nhận" và "hoá đơn chờ đối soát"; nút xác nhận hoá đơn đã hết hạn | Hiếu | Không | Thấp |
| 1 | (Tuỳ chọn) ẩn MoMo khỏi Studio, ẩn thẻ VNPay/Stripe | Phong / Hiếu | Không | Thấp |
| **2 — Diễn tập nội bộ** (2–3 ngày) | Chạy kịch bản trọn vẹn bằng 2 tài khoản: mở gian hàng → tạo tài liệu → upload + link → xuất bản → mua bằng QR → xác nhận → tải → đánh giá → báo cáo vi phạm → hoàn tiền đơn; nâng gói bằng QR → xác nhận → yêu cầu hoàn → admin hoàn | Chủ dự án + Quốc | Không | — |
| 2 | (Nếu dùng SePay) 1 giao dịch thật nhỏ đúng tiền + 1 giao dịch sai tiền | Chủ dự án | Không | Thấp (số tiền nhỏ) |
| 2 | Quyết định bản chính sách nào cần **bản chính thức** trước khi người ngoài đăng ký (bản dự thảo không ghi nhận đồng ý — ADR-057) | Chủ dự án | Không | Pháp lý |
| **3 — Mở beta nhỏ** (2–4 tuần) | Mời 5–10 người bán quen; thu feedback; sửa lỗi theo tuần | Cả đội | — | — |
| 3 | Sau beta, xét: cấp gói tay (B), xem trước Excel, ClamAV, tự lưu nháp, SEO | Quốc lên kế hoạch | B: không; C: có | — |

### 4.2. Tiêu chí "sẵn sàng beta"

- [ ] Code đã commit và deploy lên đúng môi trường beta; `pnpm lint`, `typecheck`, `test` xanh.
- [ ] Cron hằng ngày đã chạy thành công ít nhất 1 lần trên môi trường beta.
- [ ] Email thật tới được hộp thư (đăng ký, đã thanh toán, có đơn mới, nhắc gia hạn).
- [ ] Upload file thật + tải về thành công; link ngoài giao được.
- [ ] Một đơn tài liệu QR thủ công đi trọn vòng (tạo → xác nhận → tải → hoàn tiền).
- [ ] Một hoá đơn gói QR đi trọn vòng (tạo → admin xác nhận → gói lên → hoàn tiền về Free).
- [ ] MoMo không bật ở nền tảng; người bán beta được dặn không bật MoMo (hoặc đã ẩn).
- [ ] Hạn mức gói Free và 2 thiết lập hạn chờ đã chỉnh theo quyết định.
- [ ] Chính sách cần thiết đã có bản chính thức (hoặc chủ dự án chấp nhận dùng bản dự thảo cho beta).
- [ ] Kênh góp ý đã hiện trên trang (4.3).

### 4.3. Cách thu feedback (dựa trên những gì hệ thống đã có)

| Kênh | Có sẵn chưa | Cần làm |
|---|---|---|
| Email hỗ trợ | Trường "Email hỗ trợ" trong cấu hình hệ thống ✅ (đang dùng trong email báo cáo vi phạm). Hiển thị công khai ở đâu ❓ | Ghi địa chỉ này vào chân trang / trang "Liên hệ" qua CMS — không cần code |
| Form góp ý | Chưa có form riêng ✅ | Thêm link "Góp ý bản thử nghiệm" vào menu chân trang qua CMS Header & Footer (ADR-050), trỏ tới một form ngoài (vd Google Form) — không cần code. Nêu trong Chính sách bảo mật nếu thu thông tin cá nhân. |
| Mã lỗi khi báo lỗi | Lỗi API luôn trả `requestId` ✅ (quy ước mục 6). Trang lỗi có hiện mã cho người dùng chép không ❓ | Dặn người dùng gửi kèm ảnh chụp + mã lỗi nếu có |
| Nhật ký hệ thống | Audit log `/admin/audit` ✅; log server (Vercel Logs hoặc log pm2 trên VPS) 🟡 | Quốc/Vương xem hằng tuần |
| Báo cáo vi phạm | `/admin/reports` ✅ | Dùng đúng mục đích (nội dung), không dùng làm kênh góp ý |
| Phỏng vấn ngắn | — | Chủ dự án gọi 15 phút với từng người bán sau tuần đầu |

---

## Câu hỏi cho chủ dự án

1. Beta chạy trên **Vercel** hay **VPS** (production)? (Quyết định chỗ làm upload, cron, địa chỉ webhook.)
2. Đồng ý beta chỉ dùng **chuyển khoản QR thủ công**, SePay bật sau 1 giao dịch thử thành công, **không bật MoMo**?
3. Có muốn **chặn hẳn MoMo** trong Studio của người bán (sửa code nhỏ), hay chỉ dặn người bán không bật?
4. Đồng ý tăng **hạn đơn chờ thanh toán lên 24 giờ** và **hạn hoá đơn gói lên 72 giờ** trong thời gian beta?
5. Đồng ý cho Hiếu làm **2 email báo** (đơn chờ xác nhận cho người bán, hoá đơn chờ đối soát cho admin) và **nút xác nhận hoá đơn đã hết hạn** trước beta? Email báo admin gửi về địa chỉ nào?
6. Chọn **phương án A** (nới hạn mức gói Free)? Nếu có, mức cụ thể cho số sản phẩm / dung lượng / dung lượng 1 file / dung lượng ảnh là bao nhiêu (ổ đĩa VPS còn bao nhiêu)?
7. Có cần **phương án B** (admin cấp gói tay có thời hạn) ngay trong beta không? Nếu có: gói cấp tay có nhận email nhắc gia hạn và có quyền yêu cầu hoàn tiền không?
8. Người bán beta có phải **trả phí gói** không, hay chỉ đội nội bộ thử luồng trả tiền bằng giao dịch nhỏ?
9. Trong lúc chờ upload (ADR-055), có cho người bán beta **giao tài liệu bằng link Drive** không?
10. Chấp nhận beta **chưa quét virus** (chỉ kiểm định dạng) với nhóm người bán quen biết?
11. Xem trước file Excel trong Studio: **nâng thư viện** hay **tạm tắt** trong beta?
12. Văn bản pháp lý nào phải có **bản chính thức** (ghi nhận đồng ý) trước khi người ngoài đăng ký — Điều khoản, Bảo mật, Chính sách người bán?
13. Kênh góp ý: dùng **form ngoài** (vd Google Form) gắn ở chân trang, hay chỉ email hỗ trợ?
14. Số lượng và thời gian beta: bao nhiêu người bán, kéo dài bao lâu, ai là đầu mối nhận và phân loại feedback?

Liên quan: `docs/DECISIONS.md` (ADR-013, 018, 021, 026, 036, 039, 041, 044, 045, 051, 055, 056, 057), `docs/PLAN.md`, `docs/BACKLOG.md`,
`obsidian-knowledge-base/02-System-Specs/Payment-And-Billing.md`, `Order-State-Machine.md`, `Product-Editor-And-Publishing-Specs.md`,
`File-Storage-And-Downloads-Specs.md`.

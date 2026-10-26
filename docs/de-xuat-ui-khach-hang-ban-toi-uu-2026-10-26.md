# Đề xuất UI khách hàng — bản tối ưu (rà kế hoạch của Phong) — 2026-10-26

> **Người viết:** Long (tài liệu), theo brief của Quốc. **Người đọc:** chủ dự án — để chốt.
> **Nguồn rà:** `docs/de-xuat-ui-khach-hang-2026-10-25.md` (Phong) · `docs/de-xuat-chay-thu-thanh-toan-goi-tai-lieu-2026-10-25.md` ·
> ADR-024/030/050/054/056/059 · KB `UI-Design-System`, `Order-State-Machine`, `File-Storage-And-Downloads-Specs`.
> **Loại tài liệu:** đề xuất. Không sửa code. Chưa có hiệu lực cho tới khi chủ dự án chốt (Quốc ghi ADR).
>
> **Mức xác minh:** ✅ Long đã đọc code (working tree 2026-10-26, gồm phần chưa commit) · 🟡 theo brief/báo cáo, chưa kiểm ·
> ❓ cần trình duyệt, thiết bị thật hoặc DB. Long không mở trình duyệt, không đọc DB. Các việc dưới đây chỉ đổi giao diện/logic
> trang, **không thêm test case** (trần 100/66 giữ nguyên).

## Tóm tắt

| Câu hỏi | Trả lời ngắn |
|---|---|
| Phong khảo sát đúng không? | **Phần lớn đúng.** 5/6 điểm chặn kiểm lại đều đúng. Có 3 chỗ cần sửa: lượt tải **đã hiện** trên trang tài liệu; lỗi mất trang đang mua **rộng hơn** Phong mô tả; kênh Zalo của người bán **đã có dữ liệu**. |
| Phong bỏ sót gì quan trọng? | (1) Đơn hết hạn vẫn được người bán xác nhận thêm 24 giờ, nên nút "Đặt lại đơn" có thể khiến khách **chuyển tiền 2 lần**. (2) Bấm "Mua ngay" lần nào cũng **tạo đơn mới**, kể cả khi đang có đơn chờ. (3) Người đã mua vẫn thấy nút "Mua ngay". (4) Checkout dùng chung một kiểu QR cho SePay và chuyển khoản tay, nên câu hướng dẫn phải tách theo cổng. |
| Bản tối ưu khác gì? | Gộp 7 task GĐ-K1 thành **6 việc bắt buộc trước beta** (T1–T6), thêm 1 việc mới (T5). Chuyển `loading.tsx` và `/s/[token]` sang **trong lúc beta chạy**. Phần lớn GĐ-K3/K4 để **sau beta**. |
| Cần Hiếu ở đâu? | T2 (giữ đường quay lại khi xác minh email), T4 (truyền hạn xác nhận + kênh liên hệ vào trang), T5 (trạng thái người xem trên trang tài liệu). Phần còn lại Phong làm một mình. |
| Phụ thuộc việc đang làm? | T4 phụ thuộc **B2b SePay** (câu chữ khi chuyển sai tiền) và **B3 MoMo cá nhân** (thêm khối thanh toán mới). Kiểm tải file thật (T6) phụ thuộc **ADR-055** (chờ Vương); link Drive thì thử được ngay. |

---

## 1. Đối chiếu kế hoạch của Phong với code

### 1.1. Các điểm chặn Phong nêu (§2 của Phong)

| # | Nhận định của Phong | Long kiểm lại | Kết luận |
|---|---|---|---|
| 1 | Chưa xác minh email bấm Mua thì mất trang đang mua | Đúng: `requireVerifiedAccess` chuyển tới `/verify-email?pending=1` không kèm `next` (`lib/page-guards.ts:20`) ✅. **Rộng hơn Phong mô tả:** (a) link kích hoạt lúc đăng ký luôn mang `next` cố định `/` hoặc `/studio` (`api/auth/register/route.ts:105`), không phải trang tài liệu ✅; (b) link "Đăng ký" ở trang đăng nhập bỏ mất `next` (`login-form.tsx:99`) ✅; (c) "Gửi lại email kích hoạt" không mang `next` ✅. Vì vậy khách **mới** cũng mất trang đang mua, không chỉ khách cũ chưa xác minh. | ✅ Đúng, phạm vi lớn hơn |
| 2 | Checkout không báo khi thanh toán xong | Đúng: `CheckoutPoll` chỉ gọi `router.refresh()` mỗi 3 giây, không có `aria-live`, không dời focus ✅. Thêm: vòng hỏi chạy **liên tục** khi đơn còn chờ, kể cả khi tab bị ẩn. Mỗi lần là một lượt render đủ trang, kèm header đọc DB. Nếu nâng hạn đơn lên 24 giờ thì tải này đáng kể ✅ code · ❓ số đo | ✅ Đúng, có bổ sung |
| 3 | Đơn chuyển khoản tay không nói rõ phải chờ ai, bao lâu | Đúng ✅. Thêm: SePay và chuyển khoản tay đều trả về kiểu `QR` (`providers/sepay.ts:25`, `manual-qr.ts:21`) và trang hiện **cùng một khối**. Câu hướng dẫn phải tách theo `order.provider`: SePay tự xác nhận, còn chuyển khoản tay chờ người bán ✅ | ✅ Đúng, có bổ sung |
| 4 | Thiếu trang 404 / lỗi tiếng Việt | Đúng: không có `app/not-found.tsx`, `app/error.tsx`, `app/global-error.tsx` ✅ | ✅ Đúng |
| 5 | Đơn hết hạn không có nút mua lại, không đếm ngược | Đúng về hiện trạng ✅. **Nhưng giải pháp "Đặt lại đơn" có rủi ro tiền:** người bán vẫn xác nhận tay được trong **24 giờ sau hạn** (`canManuallyConfirmOrder`, `manualConfirmDeadline`) ✅. Nếu khách đã chuyển khoản mà thấy "đã hết hạn, đặt lại đơn" thì dễ chuyển lần 2. Xem T4 | ⚠️ Đúng vấn đề, giải pháp cần sửa |
| 6 | Tải file trong Zalo/Facebook, iOS | Chưa ai kiểm ❓. Tải file dùng `window.location.href` tới presigned URL `attachment` (`download-button.tsx:65`) ✅; link ngoài thì chuyển hướng 302 sang Drive ✅ (KB File-Storage §4) | ❓ Giữ |

### 1.2. Nhận định khác của Phong

| Nhận định | Long kiểm lại | Kết luận |
|---|---|---|
| "Có `downloadLimit` nhưng chưa thấy hiển thị ở khối mua" | **Sai:** ngay dưới nút mua đã có dòng "Lượt tải: Tối đa N lượt / Không giới hạn" (`[tenantSlug]/_ui/product-detail.tsx:193`) ✅. K2.2 chỉ còn thiếu **số file, định dạng** và **nơi tải** | Thu nhỏ K2.2 |
| File liên quan K1.2: `checkout/.../bank-transfer-panel.tsx` | Đường dẫn thật là `app/_ui/bank-transfer-panel.tsx`, **dùng chung** với trang gia hạn gói của người bán (`studio/[tenantSlug]/billing/page.tsx`) ✅. Sửa panel này ảnh hưởng cả hai nơi | Lưu ý khi giao việc |
| Câu 4: hiện Zalo người bán thì "cần thêm trường" | **Không cần trường mới:** `Tenant.branding` (JSON) đã có `socialLinks.zalo/facebook/website` ✅, gian hàng cũng có form liên hệ sẵn (tin nhắn vào Studio) ✅. Chỉ cần Hiếu nạp dữ liệu này vào trang checkout. Không cần migration | Sửa câu 4 |
| Thiếu `loading.tsx` ở gian hàng, trang tài liệu, checkout, bài viết công khai | Đúng ✅ (chỉ `/cua-hang`, `/pricing`, `/account` có) | ✅ |
| `/s/[token]` lệch khung hệ thống | Đúng: `mx-auto max-w-md`, `text-gray-500`, không header/footer ✅ | ✅ |
| `/cua-hang/tai-lieu` có `error.tsx` | Không có file riêng, nhưng **dùng chung** `cua-hang/error.tsx` của segment cha nên vẫn có trang lỗi ✅ | Không ảnh hưởng |

### 1.3. Điểm Phong bỏ sót

| # | Bỏ sót | Bằng chứng | Ảnh hưởng beta |
|---|---|---|---|
| S1 | **Người đã mua vẫn thấy "Mua ngay"**. Bấm vào mới nhận lỗi "Bạn đã sở hữu tài liệu này." | Trang tài liệu chỉ phân biệt *chủ gian hàng* và *người khác* (`[productSlug]/page.tsx`); chặn nằm ở `createOrder` ✅ | Khách quay lại trang tài liệu để tải, nhưng không có lối vào Thư viện |
| S2 | **Mỗi lần bấm "Mua ngay" tạo một đơn mới**, không nhắc khi đang có đơn chờ cho cùng tài liệu | `createOrder` không tìm đơn PENDING cũ ✅ | Khách lỡ đóng tab rồi mua lại thì có 2 QR với 2 mã đơn, dễ chuyển 2 lần, người bán khó đối soát |
| S3 | Đơn hết hạn nhưng **còn trong cửa sổ xác nhận 24 giờ**, mà trang vẫn ghi "Vui lòng đặt lại đơn hàng mới" | `checkout/[orderCode]/page.tsx:178` + `expiry.ts` ✅ | Như §1.1 #5 |
| S4 | Đơn **đã huỷ / đã hoàn tiền** chỉ có dòng nhãn nhỏ, không có khối giải thích hay lối đi tiếp | `page.tsx`: chỉ có khối cho PAID/FULFILLED và EXPIRED ✅ | Ít gặp trong beta, nhưng khách sẽ hỏi |
| S5 | Thay đổi mới chưa commit cần đưa vào câu chữ: (a) **email báo người bán** khi khách chọn chuyển khoản tay, kèm hạn chót xác nhận (B1, `notifyOwnerOfPendingManualOrder`) ✅; (b) **mã giảm giá tạo lại QR** (ADR-056 bổ sung) ✅, nên khách đã *tải ảnh QR cũ* phải được nhắc dùng QR mới; (c) admin có tab **"Giao dịch cổng"** cho giao dịch thu phí gói (`admin/billing/invoices`, B2) ✅; (d) danh sách **"Giao dịch cần xử lý"** của Studio (ADR-059 lần 2 d) **chưa có trong code** ✅, nên khách SePay chuyển sai tiền chỉ thấy đơn "Chờ thanh toán" mãi | `git diff` + grep ✅ | Câu chữ checkout phải nói được: "người bán đã được báo", "chuyển sai số tiền thì liên hệ" |
| S6 | **MoMo cá nhân** (ADR-059 mục 2, B3) sẽ là một khối thanh toán mới ở checkout. Kế hoạch của Phong chưa tính | `isManualConfirmProvider` hiện chỉ nhận `MANUAL_QR` ✅, tức B3 chưa có code | Phong cần làm khối này khi Hiếu xong B3 |
| S7 | Khách **không nhận email hướng dẫn thanh toán** (chỉ có email "đã thanh toán") | `order_paid` + `new_sale`, không có email cho đơn chờ phía khách ✅ (KB Order-State-Machine §3.7) | Khách đóng tab chỉ tìm lại được qua `/account/orders`. Chấp nhận cho beta, cần ghi vào trang hướng dẫn |
| S8 | `global-error.tsx` **không đọc được thương hiệu từ DB** | Xem §4.2 | Câu chữ trang lỗi gốc phải trung tính |

---

## 2. Bản tối ưu — sắp theo mục tiêu beta

**Mục tiêu beta** (theo ADR-059): khách trả tiền xong phải **nhận được tài liệu** và **không trả tiền hai lần**. Đội thu được góp ý.
Thứ tự ưu tiên: an toàn tiền, sau đó giao tài liệu, sau đó không bế tắc, cuối cùng là tốc độ cảm nhận và thẩm mỹ.

Công sức (🟡 ước lượng): **S** ≤ ½ ngày · **M** 1–2 ngày · **L** > 2 ngày.

### 2.1. Bắt buộc trước beta

| # | Việc | Gộp từ (Phong) | Ai | Công sức | Xong khi |
|---|---|---|---|---|---|
| **T1** | **Trang 404 / lỗi tiếng Việt.** `not-found.tsx` (server, có `SiteHeader`/`SiteFooter`, nút "Về trang chủ" + "Vào Cửa hàng"); `error.tsx` có "Thử lại" và mã tham chiếu `digest` theo mẫu `cua-hang/error.tsx`; `global-error.tsx` tối giản, không đọc DB (§4.2) | K1.5 | Phong | S | Mọi `notFound()` công khai hiện trang tiếng Việt có lối quay lại |
| **T2** | **Giữ đường quay lại trang tài liệu suốt luồng xác minh.** Guard mang `next` sang `/verify-email`. Link "Đăng ký" ở trang đăng nhập giữ `next`. API đăng ký và gửi lại email kích hoạt nhận `next` (lọc bằng `toSafeRedirect`). Trang xác minh ghi "Sau khi xác minh, bạn sẽ quay lại tài liệu đang xem" | K1.1 (mở rộng) | **Hiếu** (guard, 2 API) + Phong (câu chữ) | M | Khách mới và khách cũ chưa xác minh: bấm Mua, xác minh xong, quay về đúng trang tài liệu |
| **T3** | **Checkout báo trạng thái rõ.** Vùng `role="status"` báo "Thanh toán thành công"; khối xanh nhận focus; nút chính **"Tải tài liệu ngay"** (tạm trỏ `/account/library`); thanh 3 bước `StepIndicator`. Vòng hỏi **dừng khi tab ẩn**, hỏi lại khi khách quay lại tab, kèm nút "Kiểm tra lại". Khối CANCELED/REFUNDED có câu giải thích (S4) | K1.2 + S4 | Phong | M | Quay lại từ app ngân hàng thấy ngay trạng thái mới; trình đọc màn hình đọc được |
| **T4** | **Khối hướng dẫn theo cổng + hết hạn an toàn.** (a) *Chuyển khoản tay:* "Người bán đã được báo qua email và sẽ xác nhận"; hạn chót xác nhận; mã đơn có nút sao chép; **không chuyển lần 2**; nếu đã tải ảnh QR trước khi áp mã thì dùng QR mới. (b) *SePay:* "Tự xác nhận sau khi tiền về"; chuyển sai số tiền thì liên hệ người bán. (c) *Hết hạn:* nếu là chuyển khoản tay và **còn trong hạn chót xác nhận** thì ghi "Nếu bạn đã chuyển khoản, đừng đặt lại — người bán vẫn xác nhận được tới HH:MM", kèm kênh liên hệ. Ngược lại hiện nút **"Đặt lại đơn"** dựng bằng `productPath()` (ADR-030). (d) Đếm ngược (chỉ đổi số, tôn trọng reduced-motion), cảnh báo khi còn ≤ 10 phút. Kênh liên hệ: Zalo từ `socialLinks` nếu người bán đã nhập, nếu không thì form liên hệ của gian hàng | K1.3 + K1.4 + S3 + S5 | **Hiếu** (S: truyền `manualConfirmDeadline`, `productSlug`, `socialLinks` vào trang) + Phong (M) | M | Không có màn bế tắc; không có câu nào khiến khách đã trả tiền đặt lại đơn |
| **T5** | **Khối mua theo trạng thái người xem** (mới). Đã sở hữu thì hiện "Bạn đã mua tài liệu này — Mở Thư viện". Đang có đơn chờ cho tài liệu này thì hiện "Bạn có đơn đang chờ thanh toán — Tiếp tục thanh toán" thay vì tạo đơn mới | S1 + S2 | **Hiếu** (đọc entitlement + đơn chờ của người xem, dưới `withCustomer`/`withTenant`) + Phong (giao diện) | M | Không tạo đơn trùng; người đã mua có lối tải từ trang tài liệu |
| **T6** | **Thử tải trên thiết bị thật** (Chrome Android, Safari iOS, trong Zalo và Facebook). Có biên bản. Nếu webview chặn thì thêm hướng dẫn "Mở bằng trình duyệt" ở Thư viện | K1.7 | Chủ dự án + Quốc thử · Phong (nếu cần hướng dẫn) · Hiếu (nếu phải đổi cách trả file) | S (thử) · ❓ (sửa) | Có biên bản cho 3 môi trường; link Drive thử ngay, file upload thử sau ADR-055 |

**Nên có trước beta, nếu kịp** (không chặn): `loading.tsx` cho trang tài liệu và checkout (K1.6, Phong, S).

### 2.2. Trong lúc beta chạy

| # | Việc | Gộp từ | Ai | Công sức | Ghi chú |
|---|---|---|---|---|---|
| B-1 | Khối thanh toán **MoMo cá nhân** (QR/số MoMo, nội dung = mã đơn, câu chữ như chuyển khoản tay) | S6 | Phong theo contract của Hiếu | S–M | Chờ B3 |
| B-2 | `loading.tsx` cho gian hàng, bài viết công khai (và trang tài liệu/checkout nếu chưa làm) | K1.6 + K2.3 | Phong | S | Dùng `shelf-skeleton` có sẵn |
| B-3 | `/s/[token]` vào khung hệ thống | K2.4 | Phong | S | Gộp với việc tách `StatusNotice` |
| B-4 | "Bạn sẽ nhận được": số file + định dạng + "tải ở Thư viện" (lượt tải đã có) | K2.2 (thu nhỏ) | **Hiếu** (nạp số file/định dạng) + Phong | S | |
| B-5 | Rà form xác thực (`autocomplete`, `inputmode`, chữ 16px trên mobile, hiện mật khẩu) | K3.2 | Phong | S | Khách mới đều đi qua bước này |
| B-6 | Thanh mua dính đáy trên mobile | K2.1 | Phong | S | Làm khi góp ý beta cho thấy cần |
| B-7 | Tách `StatusNotice`, `CopyButton`, `StepIndicator` dùng chung | §4 của Phong | Phong | — | Làm trong T3/T4/B-3, không thành task riêng |

### 2.3. Sau beta

| Việc | Gộp từ | Ai | Công sức |
|---|---|---|---|
| Link thẳng tới đúng tài liệu vừa mua trong Thư viện (`#entitlementId`) | K3.1 | Hiếu + Phong | S–M |
| Rà `/account/*` ở 375px, đủ trạng thái | K3.3 | Phong | M |
| Ô tìm tài liệu trong header | K4.1 | Phong | S |
| Bộ lọc mobile dạng "Lọc (n)" | K4.2 | Phong | M |
| Rà skip-link / mục lục trang chính sách | K4.3 | Phong | S |
| Đo LCP/CLS trang chủ | K4.4 | Phong | S |
| Một kiểu thẻ tài liệu ở mọi nơi | K2.5 | Phong | S |
| Email hướng dẫn thanh toán cho khách khi tạo đơn chờ | S7 | Hiếu | M |
| Xem lại toast | §4 của Phong | Phong | — |

### 2.4. Phụ thuộc với việc đang làm

| Việc đang làm | Ảnh hưởng | Cách xử lý |
|---|---|---|
| **B2b SePay** 🟡 (theo brief Quốc; trong working tree đã sửa `sepay.ts`, `payment-process.ts`, `sepay-form.tsx`) | Câu chữ T4(b) và hành vi khi chuyển sai tiền. Studio "Giao dịch cần xử lý" chưa có code ✅ | Làm T4(a)(c)(d) trước, T4(b) sau khi B2b chốt |
| **B3 MoMo cá nhân** 🟡 (chưa có code ✅) | Thêm khối B-1. T4 phải chừa nhánh cho cổng xác nhận tay thứ hai | Viết T4 theo "cổng xác nhận tay" (`isManualConfirmProvider`), không viết riêng cho `MANUAL_QR` |
| **ADR-055 MinIO** (chờ Vương) | T6 với file upload | Thử link Drive trước, file upload sau |
| **Thay đổi chưa commit** ở `checkout/[orderCode]/actions.ts`, `lib/order.ts` (B1, ADR-056) ✅ `git status` | T3/T4/T5 sửa cùng vùng → dễ xung đột | Commit B1/ADR-056 trước khi giao T3–T5 |

---

## 3. Góc nhìn tài liệu và vận hành

### 3.1. Nội dung hướng dẫn cho khách: CMS hay code?

Đề xuất chia 3 lớp, áp nguyên tắc "CMS trước" cho phần nội dung:

| Lớp | Ví dụ | Đặt ở đâu | Lý do |
|---|---|---|---|
| **Thông điệp hệ thống** gắn trạng thái, có số liệu động | "Thanh toán thành công", "Người bán xác nhận được tới HH:MM", nhãn bước, lỗi | **Code**, như `STATUS_LABEL` hiện có | Gắn chặt với logic đơn; sai chữ có thể gây hiểu nhầm về tiền |
| **Nội dung hướng dẫn dài** | FAQ thanh toán, cách tải, mở bằng trình duyệt khi đang ở Zalo, đơn hết hạn thì làm gì, hoàn tiền | **CMS**: một **Trang tuỳ chỉnh** `/p/<slug>` (đã có mục "Trang tuỳ chỉnh", ADR-058) + FAQ trang chủ (`home-sections`, ADR-050). **Không cần code** | Chủ dự án tự sửa trong beta, không chờ deploy |
| **Thông tin theo người bán** | Zalo, cách liên hệ | **Dữ liệu tenant** (`branding.socialLinks` có sẵn ✅, form liên hệ gian hàng có sẵn ✅) | Mỗi gian hàng khác nhau |

- Checkout và Thư viện chỉ cần **một link** "Hướng dẫn mua & tải" trỏ tới trang CMS. Phải tạo trang CMS **trước** khi Phong gắn link. Nếu trang chưa xuất bản thì link nên tự ẩn (cần Hiếu, S) để không dẫn tới 404.
- Long có thể soạn **dự thảo nội dung** trang hướng dẫn từ hành vi đã kiểm trong code (hạn đơn, 24 giờ xác nhận, lượt tải, link ≤ 10 phút) để admin nhập vào CMS (câu 13).

### 3.2. Trang hệ thống (404 / lỗi) đọc thương hiệu từ đâu

| Trang | Đọc thương hiệu | Ghi chú |
|---|---|---|
| `not-found.tsx` | `getEffectiveBrand()` + `SiteHeader`/`SiteFooter` (đọc `SystemBranding` + menu CMS) ✅ | Root layout đã đọc `SystemBranding` cho tiêu đề tab, kể cả `/_not-found` ✅ (`app/layout.tsx`) |
| `error.tsx` (gốc) | Client component, không gọi được hàm server. Nằm trong root layout nên vẫn có màu thương hiệu, nhưng **không tự có header** (header do từng trang render) ✅ | Không ghi tên thương hiệu cứng. Hiện mã `digest` để khách gửi hỗ trợ |
| `global-error.tsx` | **Không đọc DB.** Chỉ chạy khi chính root layout lỗi, thường do DB lỗi. `getEffectiveBrand()` chỉ dùng `DEFAULT_BRAND` khi DB **trống**, không phải khi DB **lỗi** ✅ (`lib/branding.ts`) | Câu chữ trung tính, không có tên thương hiệu (câu 12) |

Quy tắc chung: không hard-code "Gieo Chữ" (CLAUDE.md, ADR-032).

### 3.3. Các điểm khách sẽ gửi góp ý trong beta

| Vị trí trong luồng | Khách thường gặp | Kênh nên hiện | Khách nên gửi kèm |
|---|---|---|---|
| Checkout, đơn chờ / hết hạn | "Đã chuyển mà chưa thấy" | Kênh của **người bán** (Zalo / form liên hệ gian hàng, T4) | Mã đơn, ảnh biên lai |
| Thư viện, không tải được | Link hết hạn, webview chặn, hết lượt | Trang hướng dẫn CMS, sau đó **email hỗ trợ / form góp ý** của nền tảng | Mã đơn, tên trình duyệt hoặc ứng dụng |
| Trang 404 / lỗi | Link sai, lỗi tạm thời | Link "Báo lỗi" tới form góp ý | Mã tham chiếu (`digest`), đường dẫn |
| Trang tài liệu | Nội dung vi phạm | **Báo cáo vi phạm** (M12c) — không dùng làm kênh góp ý | — |
| Chân trang (mọi trang) | Góp ý chung | Link "Góp ý bản thử nghiệm" trong menu footer CMS (ADR-050) | — |

- "Email hỗ trợ" (`system_settings.supportEmail`) hiện **chưa hiện công khai** ở trang nào ✅ (chỉ dùng trong email hệ thống). Muốn khách thấy thì đưa vào footer hoặc `/lien-he` qua CMS, không cần code.
- Tách rõ: góp ý về **người bán** gửi người bán (tin nhắn vào Studio); góp ý về **nền tảng** gửi email hỗ trợ / form. Nếu không tách, đầu mối nền tảng sẽ nhận khiếu nại về đơn của tenant mà System Admin không có route nào để xem (§7.9).

### 3.4. Tài liệu cần cập nhật sau khi làm (việc của Long, sau khi Quốc review code)

`UI-Design-System.md` §7.1 (`StatusNotice`, CANCELED/REFUNDED), §8.4 (khối mua theo trạng thái, checkout theo cổng) · `Order-State-Machine.md`
(phần khách nhìn thấy khi EXPIRED còn trong cửa sổ xác nhận) · `File-Storage-And-Downloads-Specs.md` (kết quả T6 với webview) ·
`Auth-Session-Specs.md` (T2: `next` qua đăng ký/gửi lại kích hoạt).

---

## 4. Câu hỏi cho chủ dự án (đã gộp câu của Phong, bỏ trùng)

| # | Câu hỏi | Phương án Long đề xuất |
|---|---|---|
| 1 | Đồng ý phân tầng **bắt buộc trước beta (T1–T6)**, trong beta và sau beta như §2? (Phong câu 1) | Đồng ý. T1, T2, T4 đi trước vì liên quan tiền và bế tắc |
| 2 | Giữ **bắt buộc xác minh email trước khi mua**, hay cho mua trước rồi xác minh khi tải? (Phong câu 2) | **Giữ bắt buộc**, làm T2 để không mất trang. Đổi luồng ảnh hưởng chống spam và email giao hàng, không nên đổi ngay trước beta |
| 3 | Câu chữ hướng dẫn ở checkout: code hay CMS? (Phong câu 3) | Theo 3 lớp ở §3.1: thông điệp trạng thái trong code, hướng dẫn dài trong trang CMS, liên hệ lấy từ dữ liệu người bán |
| 4 | Kênh liên hệ người bán ở checkout? (Phong câu 4) | Zalo từ `socialLinks` nếu người bán đã nhập, nếu không thì form liên hệ gian hàng. **Không thêm trường, không migration** |
| 5 | Có hiện "thời gian người bán thường xác nhận" không? Hiện **chưa có dữ liệu** này | Không thêm trường. Chỉ hiện **hạn chót** hệ thống tính được ("người bán xác nhận được tới HH:MM") |
| 6 | **Hạn đơn chờ thanh toán** trong beta: giữ 60 phút hay nâng lên 24 giờ? (đề xuất beta câu 4; ADR-059 chưa chốt) | Cần chốt trước T4 vì ảnh hưởng đếm ngược và tải của vòng hỏi trạng thái. Nếu nâng 24 giờ thì chỉ hiện giờ hết hạn, đếm ngược khi còn < 1 giờ |
| 7 | Đơn **hết hạn nhưng người bán còn xác nhận được**: thay "đặt lại đơn" bằng câu "Đã chuyển thì đừng đặt lại, người bán xác nhận được tới …"? | **Đồng ý** (an toàn tiền). Chỉ hiện "Đặt lại đơn" khi đã qua hạn chót, hoặc khách chưa chọn cổng |
| 8 | Khi khách đã có **đơn chờ** cho cùng tài liệu: dẫn về đơn cũ hay vẫn cho tạo đơn mới? (T5) | **Dẫn về đơn cũ** ("Tiếp tục thanh toán") để tránh 2 mã đơn, 2 QR |
| 9 | Thanh mua dính đáy trên mobile? (Phong câu 5) | Làm **trong beta** khi góp ý cho thấy cần |
| 10 | Ô tìm kiếm trong header? (Phong câu 6) | **Sau beta** |
| 11 | Chủ dự án có điện thoại Android + iPhone để thử trong Zalo/Facebook không? (Phong câu 7) | Cần ít nhất 1 Android + 1 iPhone. Thử link Drive ngay, file upload sau ADR-055 |
| 12 | Trang lỗi gốc (`global-error`, khi DB lỗi) có cần ghi tên thương hiệu không? | **Không.** Dùng câu trung tính ("Hệ thống đang gặp sự cố, vui lòng thử lại sau ít phút") để không hard-code thương hiệu |
| 13 | Trang CMS **"Hướng dẫn mua & tải"**: ai soạn nội dung? | Long soạn dự thảo từ hành vi đã kiểm trong code, chủ dự án duyệt và nhập vào CMS trước khi Phong gắn link |
| 14 | Kênh góp ý của nền tảng: form ngoài (vd Google Form) ở footer, hay chỉ email hỗ trợ? (đề xuất beta câu 13, chưa chốt) | Form ngoài ở footer CMS + đưa email hỗ trợ lên `/lien-he`. Nếu form thu thông tin cá nhân thì nêu trong Chính sách bảo mật |
| 15 | Toast: giữ thông báo tại chỗ cho beta? (Phong câu 8) | **Đồng ý**, xem lại sau beta |

---

Liên quan: `docs/de-xuat-ui-khach-hang-2026-10-25.md` (Phong) · `docs/de-xuat-chay-thu-thanh-toan-goi-tai-lieu-2026-10-25.md` · `docs/DECISIONS.md`
(ADR-024, 030, 032, 036, 050, 054, 055, 056, 058, 059) · KB `04-Operations-Runbooks/UI-Design-System.md`, `02-System-Specs/Order-State-Machine.md`,
`02-System-Specs/File-Storage-And-Downloads-Specs.md`.

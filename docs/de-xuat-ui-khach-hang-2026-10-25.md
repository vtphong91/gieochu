# Đề xuất phát triển & tối ưu UI cho khách hàng (frontend người dùng cuối) — 2026-10-25

> **Người viết:** Phong (UX/UI), theo brief của Quốc. **Người đọc tiếp:** Long rà và đề xuất bản tối ưu, sau đó chủ dự án chốt.
> **Loại tài liệu:** khảo sát + kế hoạch. **Không sửa code**, không có quyết định nào có hiệu lực cho tới khi chủ dự án chốt.
> **Phạm vi:** trang công khai, luồng mua, tài khoản khách và trang xác thực. **Không gồm SEO**, vì đã có kế hoạch SEO tổng thể riêng.
>
> **Mức xác minh:** ✅ đã đọc code (working tree 2026-10-25/26) · ❓ cần trình duyệt/thiết bị thật hoặc dữ liệu thật để kết luận.
> Phong không mở trình duyệt, không đọc DB.

## Tóm tắt nhanh

| Câu hỏi | Trả lời ngắn |
|---|---|
| Luồng tìm → xem → mua → thanh toán → tải đã đủ chưa? | **Đủ về chức năng** ✅. Còn **6 điểm chặn trải nghiệm** cho beta (§2), chủ yếu ở các bước nối giữa trang: xác minh email làm mất trang đang mua, checkout không báo khi thanh toán xong, thiếu trang 404 và trạng thái tải. |
| Nền tảng UI có tốt không? | Tốt. Đã có token màu, container ADR-024, `SiteHeader`/`SiteFooter`/`MobileNav`, `DocumentCard`, `BankTransferPanel` ưu tiên mobile, skip-link, `EmptyState`. |
| Đề xuất làm gì trước? | **GĐ-K1** (luồng mua và checkout, 6 task nhỏ) trước khi mở beta. Các GĐ còn lại làm song song với beta. |
| Cần Hiếu không? | Phần lớn **không**, chỉ là lớp trình bày. Cần Hiếu ở 3 chỗ (đánh dấu **H** trong §3): giữ `next` khi xác minh email, trang hướng dẫn sau mua, và số liệu cho trạng thái "đang xử lý". |

---

## 1. Hiện trạng theo nhóm trang

### 1.1. Khung chung (header, footer, mobile nav, container)

| Mục | Điểm tốt | Điểm yếu / câu hỏi |
|---|---|---|
| `SiteHeader` / `SiteFooter` / `MobileNav` (`app/_ui/`) | ✅ Menu từ CMS (ADR-050), dropdown kiểu disclosure, mobile accordion, `aria-current`, link ngoài có chữ ẩn "(mở tab mới)" | ❓ Chưa kiểm ở 375px với menu dài. Header không có ô tìm kiếm nhanh: tìm tài liệu phải vào `/cua-hang` |
| Container ADR-024 (`container-page` / `-prose` / `-narrow`) | ✅ Trang chủ, cửa hàng, gian hàng, trang tài liệu, checkout đều đã dùng | ✅ `s/[token]` (link chia sẻ) tự đặt `mx-auto max-w-md`, **không** dùng `container-narrow`, không có header/footer, màu xám thô (`text-gray-500`), khác hẳn phần còn lại |
| Skip-link + `<main id="noi-dung">` | ✅ Trang chủ, checkout, trang tài liệu | ❓ Chưa rà đủ cho `/cua-hang`, `/p/[slug]`, các trang chính sách |
| **Trang 404 / lỗi toàn cục** | — | ✅ **Không có** `app/not-found.tsx`, `app/error.tsx`, `app/global-error.tsx`. Tài liệu/gian hàng không tồn tại sẽ hiện trang 404 **mặc định tiếng Anh** của Next, không có header và không có lối quay lại. Đây là điểm chặn beta |

### 1.2. Khám phá: trang chủ, Cửa hàng, Bảng giá, gian hàng

| Trang | Điểm tốt | Điểm yếu / câu hỏi |
|---|---|---|
| Trang chủ `/` | ✅ CMS (ADR-050), dữ liệu thật, thẻ số liệu, FAQ `<details>` | ❓ Tốc độ cảm nhận: chưa có `loading.tsx` (trang tĩnh/ISR nên có thể không cần — cần đo) |
| `/cua-hang`, `/cua-hang/tai-lieu` | ✅ Có `loading.tsx` + `error.tsx`, lọc theo danh mục, sắp xếp, phân trang, `DocumentCard` (compact), chip danh mục, breadcrumb | ❓ Bộ lọc trên mobile: lọc + sắp xếp dạng form GET. Cần kiểm xem có đẩy kết quả xuống quá sâu ở 375px không. Không có nút "Xoá lọc" nổi bật ❓ |
| `/pricing` | ✅ CMS, có `loading`/`error` | — (trang của người bán, ngoài luồng mua tài liệu) |
| Gian hàng `/{tenantSlug}` | ✅ Section CMS của tenant, theme `--sf-*`, thông báo tạm ngưng | ✅ **Không có** `loading.tsx` (đọc nhiều section: sản phẩm, đánh giá, bài viết) nên bấm vào thì trắng trang cho tới khi xong ❓ |
| Bài viết `/{tenantSlug}/posts` | ✅ Trang hệ thống (ADR-025) | ✅ Không có `loading.tsx` |

### 1.3. Trang tài liệu `/{tenantSlug}/{productSlug}`

| Điểm tốt ✅ | Điểm yếu / câu hỏi |
|---|---|
| Bố cục 12 cột: ảnh + mô tả bên trái; khối mua dính khi cuộn ở `lg`. Trên mobile khối mua đứng **ngay sau ảnh** (đúng thứ tự ưu tiên) | Mobile: mô tả dài + đánh giá nằm dưới khối mua. Cuộn xuống đọc xong thì **không còn nút Mua trong tầm tay** (không có thanh mua dính đáy) ❓ |
| Giá gốc/giá khuyến mãi/% giảm, nhãn loại, thẻ, breadcrumb về gian hàng | Nút "Đăng nhập để mua" không nói trước là **sẽ phải xác minh email** (xem §2, điểm chặn 1) |
| `BuyButton`: `min-h-12`, trạng thái "Đang xử lý...", lỗi `role="alert"` | Chưa có `loading.tsx`, nên chuyển từ thẻ tài liệu sang trang tài liệu không có phản hồi tức thì ❓ |
| Đánh giá (M10a), báo cáo vi phạm | Không nói rõ **khách nhận gì sau khi mua** (số file, định dạng, số lượt tải, tải ở đâu). Có dữ liệu `downloadLimit` nhưng chưa thấy hiển thị ở khối mua ❓ |

### 1.4. Luồng mua & checkout `/{tenant}/checkout/{orderCode}`

| Điểm tốt ✅ | Điểm yếu |
|---|---|
| `container-narrow`, `SiteHeader`/`SiteFooter`, breadcrumb về gian hàng, tóm tắt đơn (tạm tính, giảm giá, tổng) | ✅ **Không báo khi thanh toán xong.** `CheckoutPoll` gọi `router.refresh()` mỗi 3 giây; khi đơn sang Đã thanh toán, khối xanh xuất hiện nhưng **không có vùng `aria-live`** và không dời focus, nên trình đọc màn hình không biết. Người đang mở app ngân hàng quay lại cũng dễ không nhận ra thay đổi |
| `BankTransferPanel`: trên mobile, thông tin + nút **sao chép từng dòng** đứng trước QR (đúng: điện thoại không tự quét QR của chính nó), có nút "Tải ảnh QR" | ✅ Chỉ ghi "Đơn hàng hết hạn lúc HH:MM dd/mm/yyyy": không có **đếm ngược**, không cảnh báo khi còn ít phút ❓ |
| `CouponPanel`: áp/bỏ mã, báo "Đã cập nhật mã QR theo số tiền mới", lỗi `role="alert"` | ✅ Hết hạn: chỉ có câu "Vui lòng đặt lại đơn hàng mới", **không có nút** quay về trang tài liệu để mua lại |
| Đơn PENDING mở lại được từ `/account/orders` ("Thanh toán tiếp") | ✅ Không có hướng dẫn "chuyển khoản xong rồi mà chưa thấy cập nhật thì làm gì": đơn QR thủ công phải chờ người bán xác nhận tay (rủi ro tiền lớn nhất của beta, theo đề xuất chạy thử §1.3) |
| Trạng thái `STATUS_LABEL` có chữ (không chỉ màu) | ✅ Trạng thái chỉ là dòng chữ nhỏ dưới tiêu đề. Không có **thanh tiến trình** (Tạo đơn → Thanh toán → Nhận tài liệu) để khách biết mình đang ở bước nào |
| — | ✅ Không có `loading.tsx` cho checkout: bấm "Mua ngay" → tạo đơn → chuyển trang không có khung chờ (nút có "Đang xử lý..." nên đỡ một phần) |

### 1.5. Nhận tài liệu & tải file

| Mục | Điểm tốt ✅ | Điểm yếu |
|---|---|---|
| `/account/library` | `loading` + `error` riêng, nhóm theo gian hàng, `EmptyState` có nút "Khám phá tài liệu", thẻ quyền tải có khối lựa chọn khi tài liệu bị gỡ (ADR-039), xác nhận lượt tải cuối | ❓ Sau khi thanh toán xong, khách phải tự bấm link "Xem tài liệu đã mua". Không có lối đi thẳng tới **đúng tài liệu vừa mua** (vào thư viện là thấy cả danh sách) |
| `DownloadButton` | Presigned URL qua `window.location.href` (không mở tab mới), trạng thái chờ, lỗi `role="alert"` | ❓ Cần thử thật trên iOS Safari / Zalo in-app browser: tải file qua presigned URL trong webview Zalo/Facebook thường bị chặn. Khách beta Việt Nam hay mở link qua Zalo |
| Link chia sẻ `/s/[token]` | Có panel tải + mật khẩu | ✅ Lệch hệ thống (§1.1): không header/footer, không container chuẩn, chữ báo lỗi trần |

### 1.6. Tài khoản khách `/account/*` và xác thực

| Mục | Điểm tốt ✅ | Điểm yếu |
|---|---|---|
| App shell tài khoản | Sidebar nhóm "Tài khoản của bạn / Mua sắm / Gian hàng", khớp mục dài nhất, header gọn 64px | Theo quy tắc full width (chỉ cho app shell) ✅ — giữ |
| `/account/orders` | Danh sách + "Thanh toán tiếp" cho đơn chờ, `EmptyState` | ❓ Không lọc theo trạng thái (beta ít đơn, chưa cần) |
| Hồ sơ / Bảo mật / thiết bị | Đã có (kế hoạch nâng cấp tài khoản 2026-10-17) | ❓ Chưa rà lại ở 375px |
| Đăng ký / Đăng nhập / Quên mật khẩu | `AuthCard`, `container-narrow`, cho phép password manager ❓ | ❓ Chưa kiểm `autocomplete`, `inputmode` email, nút hiện mật khẩu trên từng form |
| Xác minh email | Link kích hoạt mang `next` khi đăng ký ✅ | ✅ **Người đã có tài khoản nhưng chưa xác minh** bấm "Mua ngay" → `requireVerifiedAccess` chuyển tới `/verify-email?pending=1` **không kèm `next`**, nên xác minh xong không quay lại tài liệu đang mua (§2, điểm chặn 1) |

---

## 2. Ưu tiên cho beta: điểm chặn trải nghiệm trên luồng tìm → xem → mua → thanh toán → tải

Đối chiếu với `docs/de-xuat-chay-thu-thanh-toan-goi-tai-lieu-2026-10-25.md`: beta dùng **chuyển khoản QR thủ công**, người bán xác nhận tay, đơn hết hạn sau 60 phút, xác nhận tay được trong 24 giờ sau hạn.

| # | Điểm chặn | Bước | Vì sao chặn | Mức |
|---|---|---|---|---|
| 1 | Chưa xác minh email bấm Mua → sang `/verify-email` **mất trang đang mua** | Mua | Khách mới gần như chắc chắn gặp. Xác minh xong phải tự tìm lại tài liệu | ✅ |
| 2 | Checkout **không báo** khi thanh toán xong (không `aria-live`, không đổi focus, không có lời mời "Tải ngay") | Thanh toán → Tải | Khách chuyển khoản trên app ngân hàng rồi quay lại, không chắc đã xong chưa, dễ chuyển 2 lần | ✅ |
| 3 | Đơn QR thủ công **chờ người bán xác nhận** mà trang không nói rõ ("đã chuyển rồi, chờ bao lâu, liên hệ ai") | Thanh toán | Rủi ro tiền lớn nhất beta. Khách lo lắng và gửi khiếu nại | ✅ |
| 4 | Thiếu trang **404 / lỗi tiếng Việt** có lối quay lại | Mọi bước | Link tài liệu sai/đã ẩn, hoặc đơn của người khác, hiện trang tiếng Anh trống | ✅ |
| 5 | Đơn **hết hạn** không có nút mua lại; không có đếm ngược | Thanh toán | Đơn 60 phút; khách chậm chuyển khoản là bế tắc | ✅ |
| 6 | Tải file trong **trình duyệt nhúng (Zalo/Facebook)** và iOS | Tải | Chưa kiểm; nếu hỏng thì khách đã trả tiền mà không tải được | ❓ |

Không chặn nhưng nên có trước beta: `loading.tsx` cho trang tài liệu, gian hàng, checkout (tốc độ cảm nhận trên 3G/4G); trang `/s/[token]` theo khung hệ thống.

---

## 3. Kế hoạch theo giai đoạn (mỗi task một lượt)

Ký hiệu cột **Hiếu**: — = chỉ lớp trình bày (Phong) · **H** = cần Hiếu thêm dữ liệu/logic (Phong làm giao diện theo contract).
Verify mỗi task: `tsc`, `eslint --max-warnings=0`, `build`, `test:count` (100/66); thử 375px + desktop + bàn phím + reduced-motion;
với GĐ-K1 thêm **thử trên điện thoại thật** (Chrome Android, Safari iOS, trình duyệt trong Zalo).

### GĐ-K1 — Luồng mua & checkout (trước beta)

| Task | File liên quan | Việc | Hiếu | Xong khi |
|---|---|---|---|---|
| **K1.1** | `lib/page-guards.ts` (`requireVerifiedAccess`), `(auth)/verify-email/page.tsx`, `[productSlug]/buy-button.tsx` | Giữ `next` khi chuyển sang xác minh email: `/verify-email?pending=1&next=…`, lọc bằng `toSafeRedirect` sẵn có. Trang xác minh hiện "Sau khi xác minh, bạn sẽ quay lại *{tên tài liệu}*". Nút mua ghi chú ngắn "Cần tài khoản đã xác minh email" khi chưa đăng nhập | **H** (guard + link kích hoạt mang `next` cho người dùng cũ) | Chưa xác minh → bấm Mua → xác minh → quay đúng trang tài liệu |
| **K1.2** | `checkout/[orderCode]/page.tsx`, `checkout-poll.tsx`, `bank-transfer-panel.tsx` | Khi đơn chuyển sang Đã thanh toán: vùng `role="status"` báo "Thanh toán thành công", khối xanh nhận focus, nút chính **"Tải tài liệu ngay"**. Thêm **thanh 3 bước** (Đặt đơn → Thanh toán → Nhận tài liệu) có chữ, không chỉ màu | — | Trình đọc màn hình đọc được thông báo; quay lại từ app ngân hàng thấy ngay trạng thái mới |
| **K1.3** | `checkout/[orderCode]/page.tsx` | Khối **"Đã chuyển khoản?"** cho đơn QR thủ công: thời gian người bán thường xác nhận, cách liên hệ gian hàng (`lien-he`/form liên hệ storefront), nhắc **không chuyển lần 2**. Hiện kèm mã đơn để sao chép | **H** nếu cần kênh liên hệ của tenant (email/Zalo) ở checkout | Khách biết bước tiếp theo khi chưa thấy cập nhật |
| **K1.4** | `checkout/[orderCode]/page.tsx` (+ component đếm ngược client nhỏ) | **Đếm ngược** tới hạn đơn (tôn trọng reduced-motion: chỉ đổi số, không hiệu ứng), cảnh báo khi còn ≤ 10 phút. Đơn hết hạn: nút **"Đặt lại đơn"** về trang tài liệu | — | Không bao giờ có màn bế tắc ở đơn hết hạn |
| **K1.5** | `app/not-found.tsx`, `app/error.tsx`, `app/global-error.tsx` (mới) | Trang 404 / lỗi tiếng Việt: có header/footer hệ thống, `container-narrow`, nút "Về trang chủ" + "Vào Cửa hàng", ô tìm tài liệu. Error boundary có "Thử lại" | — | Mọi `notFound()` công khai hiện trang tiếng Việt |
| **K1.6** | `[tenantSlug]/[productSlug]/loading.tsx`, `[tenantSlug]/loading.tsx`, `checkout/[orderCode]/loading.tsx` (mới) | Skeleton đúng bố cục (ảnh + khối mua; header gian hàng; tóm tắt đơn), giữ chỗ để không nhảy layout | — | Bấm thẻ tài liệu có phản hồi ngay, không nhảy layout |
| **K1.7** | — (kiểm thử) | Thử tải file thật trên Chrome Android, Safari iOS, **trong Zalo và Facebook**. Nếu webview chặn thì làm hướng dẫn "Mở bằng trình duyệt" ở thư viện | — / **H** nếu cần đổi cách trả file | Có biên bản thử 3 môi trường, xử lý điểm hỏng |

### GĐ-K2 — Trang tài liệu & trang gian hàng

| Task | File liên quan | Việc | Hiếu | Xong khi |
|---|---|---|---|---|
| **K2.1** | `_ui/product-detail.tsx`, `buy-button.tsx` | **Thanh mua dính đáy trên mobile** (< lg): giá + nút Mua, chỉ hiện khi khối mua chính đã cuộn khỏi màn hình (IntersectionObserver, cùng mẫu thanh lưu nhanh của editor). Chừa đệm đáy, không che focus | — | 375px: luôn có nút Mua trong tầm tay, không che nội dung |
| **K2.2** | `_ui/product-detail.tsx` | Khối **"Bạn sẽ nhận được"**: số file và định dạng, số lượt tải, nơi tải (Thư viện). Đọc dữ liệu đã có | **H** nếu trang chưa nạp số file/định dạng/lượt tải | Khách biết rõ trước khi mua |
| **K2.3** | `[tenantSlug]/posts/loading.tsx`, `posts/[postId]/loading.tsx` | Skeleton cho bài viết | — | Như K1.6 |
| **K2.4** | `s/[token]/page.tsx` | Đưa link chia sẻ vào khung hệ thống: header/footer, `container-narrow`, token màu, khối lỗi dùng cùng mẫu thông báo trạng thái (§7.1 UI-Design-System) | — | Giao diện đồng bộ phần còn lại |
| **K2.5** | Storefront `_ui/products.tsx`, `document-card.tsx` | Rà thẻ tài liệu ở gian hàng: cùng `DocumentCard` với Cửa hàng (một kiểu thẻ toàn hệ thống), ảnh có `width/height`/`aspect-ratio` (CLS) | — | Một kiểu thẻ ở mọi nơi |

### GĐ-K3 — Tài khoản khách

| Task | File liên quan | Việc | Hiếu | Xong khi |
|---|---|---|---|---|
| **K3.1** | `account/library/*`, checkout | Sau mua: link từ checkout tới **đúng tài liệu** trong thư viện (`/account/library#{entitlementId}` + làm nổi bật thẻ đó) | **H** nếu cần map đơn → entitlement ở checkout | Từ "Thanh toán thành công" tới nút tải chỉ 1 chạm |
| **K3.2** | `(auth)/*`, `(auth)/_ui/fields.tsx` | Rà form xác thực: `autocomplete` (email, current-password, new-password), `inputmode="email"`, nút hiện mật khẩu, lỗi dưới ô + tóm tắt lỗi, ô ≥ 44px, chữ 16px trên mobile (tránh iOS tự phóng to) | — | Qua checklist skill §8 (form) |
| **K3.3** | `account/profile`, `account/security`, `account/orders` | Rà 375px, trạng thái loading/empty/error từng trang, `useFormDraft` cho form hồ sơ nếu lưu lỗi mất dữ liệu | — | Không cuộn ngang, đủ trạng thái |

### GĐ-K4 — Trang chủ, Cửa hàng, nội dung

| Task | File liên quan | Việc | Hiếu | Xong khi |
|---|---|---|---|---|
| **K4.1** | `_ui/site-header.tsx`, `mobile-nav.tsx` | **Ô tìm tài liệu** trong header (desktop) và trong mobile nav: form GET tới `/cua-hang/tai-lieu?q=` (đã có), không cần JS | — | Tìm được từ mọi trang |
| **K4.2** | `cua-hang/tai-lieu/page.tsx`, `_ui/catalog-parts.tsx` | Bộ lọc mobile: gom lọc + sắp xếp vào **một nút "Lọc (n)"** mở panel (dialog/disclosure), chip bộ lọc đang áp có nút xoá, "Xoá tất cả" | — | 375px: kết quả hiện ngay dưới tiêu đề |
| **K4.3** | `p/[slug]`, 7 trang chính sách | Rà skip-link, `container-prose`, mục lục dính (đã có `legal-toc`) trên mobile | — | Đồng bộ khung |
| **K4.4** | Trang chủ | Đo tốc độ (LCP/CLS) trên 4G mô phỏng; chỉ thêm `loading.tsx` nếu cần | — / ❓ | Có số đo, quyết định dựa trên số |

---

## 4. Pattern dùng chung đề xuất (tái dùng trước)

| Pattern | Đã có | Đề xuất |
|---|---|---|
| Thẻ tài liệu | ✅ `app/_ui/document-card.tsx` (`density`, `headingLevel`), `tenant-card.tsx` | Một thẻ cho Cửa hàng + gian hàng + "tài liệu liên quan" (K2.5). Không tạo thẻ mới |
| Kệ / lưới | ✅ `product-shelf.tsx`, `category-grid.tsx`, `shelf-skeleton.tsx` | Dùng `shelf-skeleton` làm nguồn cho skeleton trang gian hàng (K1.6) |
| Skeleton trang | ✅ mẫu `loading.tsx` ở `/cua-hang`, `/pricing`, `/account` (`aria-busy`, `role="status"` ẩn, `motion-reduce:animate-none`) | Theo đúng mẫu này cho K1.6/K2.3 |
| Thông báo trạng thái | ✅ khối tint + viền trái (UI-Design-System §7.1, checkout) | Chuẩn hoá thành 1 component `StatusNotice` (success/warning/info) dùng ở checkout, thư viện, `/s/[token]`, 404 |
| Empty state | ✅ `EmptyState` (kit admin, đang dùng ở thư viện/đơn hàng) | Dùng cho trang công khai qua một biến thể không phụ thuộc kit admin. Có thể chuyển sang `app/_ui/` để trang công khai không import từ `admin/_ui` |
| Thông báo nhanh (toast) | Chưa có; đang dùng `FormBanner`/`role="status"` tại chỗ | **Không thêm toast** cho beta: thông báo tại chỗ (gần nút) dễ thấy hơn trên mobile và không mất sau 3–5 giây. Xem lại sau beta |
| Sao chép thông tin | ✅ nút sao chép trong `BankTransferPanel` | Tách thành `CopyButton` dùng chung (mã đơn ở K1.3, link chia sẻ) |
| Thanh hành động dính đáy | ✅ thanh lưu nhanh trong editor tài liệu/bài viết (IntersectionObserver) | Cùng cơ chế cho thanh mua K2.1 |
| Thanh bước | Chưa có | `StepIndicator` 3 bước cho checkout (K1.2), `<ol>` + `aria-current="step"` |

## 5. Ràng buộc đối chiếu

- **ADR-024:** trang public giữ `container-page` / `-prose` / `-narrow`. Quy tắc **full width chỉ áp cho app shell** (`/admin`, `/studio`, `/account`).
- **ADR-025:** trang tài liệu và checkout là trang hệ thống, dùng token hệ thống, không dùng theme tenant.
- **ADR-030:** link tài liệu luôn dựng bằng `productPath()`. Ô tìm kiếm (K4.1) và link "Đặt lại đơn" (K1.4) phải dùng hàm này.
- **ADR-050 / ADR-054:** menu và chính sách đọc từ CMS; không hard-code chữ mới trong JSX nếu là nội dung. Riêng thông điệp hệ thống như trạng thái đơn hay hướng dẫn checkout (K1.3) là **câu hỏi 3**.
- Bảo mật: không đưa thêm dữ liệu khách/đơn ra ngoài phạm vi chủ đơn; presigned URL ≤ 10 phút, giữ nguyên.

## 6. Câu hỏi cho chủ dự án

1. **Thứ tự:** đồng ý làm hết **GĐ-K1 (K1.1–K1.7) trước khi mở beta**, còn K2–K4 làm trong lúc beta chạy không?
2. **Xác minh email trước khi mua:** giữ bắt buộc (K1.1 chỉ giữ `next`), hay cho phép mua **trước** rồi xác minh khi tải? Phương án 2 bớt bước nhưng ảnh hưởng chống spam và gửi tài liệu, nên cần Quốc/Hiếu đánh giá.
3. **Câu chữ hướng dẫn ở checkout** (K1.3, K1.4): để Hiếu/Phong viết cố định trong code như thông điệp hệ thống, hay đưa vào CMS (System Center) theo nguyên tắc "CMS trước"?
4. **Kênh liên hệ người bán ở checkout** (K1.3): dùng form liên hệ storefront đã có, hay hiện Zalo/số điện thoại do người bán nhập (cần thêm trường, tức cần Hiếu)?
5. **Thanh mua dính đáy trên mobile** (K2.1): đồng ý thêm không? Nó tăng chuyển đổi nhưng chiếm khoảng 64px màn hình.
6. **Ô tìm kiếm trong header** (K4.1): ưu tiên trước beta hay sau beta?
7. **Thử trên Zalo/Facebook in-app** (K1.7): chủ dự án có sẵn vài điện thoại (Android + iPhone) để thử cùng không?
8. **Toast:** đồng ý chưa thêm toast cho beta, giữ thông báo tại chỗ?

---

## 7. Nguồn skill đã tra (ui-ux-pro-max)

`--domain ux`: Mobile Keyboards (`inputmode`), Mobile First, Loading Indicators, Lazy Loading, Empty States, Touch Target Size, Toast
Notifications. `--domain product` "digital products/downloads": Feature-Rich Showcase + Conversion. Quick Reference đối chiếu:
`touch-target-size`, `content-priority`, `horizontal-scroll`, `loading-states`, `progressive-loading`, `content-jumping`,
`contextual-live-badge-updates` (thông báo đổi trạng thái checkout), `multi-step-progress` (thanh bước), `error-recovery`
(đơn hết hạn), `empty-nav-state`, `deep-linking` (giữ `next`), `focus-management`.

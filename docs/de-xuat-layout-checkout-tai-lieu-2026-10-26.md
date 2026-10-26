# Đề xuất layout trang thanh toán đơn tài liệu — `/[tenantSlug]/checkout/[orderCode]`

- **Người viết:** Phong (UX/UI) · **Ngày:** 2026-10-26 · **Theo brief của:** Quốc
- **Loại tài liệu:** đề xuất, **chưa sửa code**. Cần chủ dự án chốt các câu hỏi ở §7 trước khi giao Phong (UI) và Hiếu (dữ liệu).
- **Căn cứ:** ADR-025 (checkout là trang hệ thống), ADR-024 (độ rộng khung), ADR-056 (mã giảm giá ở checkout), ADR-059 bổ sung
  lần 3 (MoMo cá nhân), ADR-061 (luồng mua của khách), `UI-Design-System.md` §7.1, §8.4, §24.3; skill `ui-ux-pro-max`.

---

## 1. Trang hiện tại có gì (đọc code 2026-10-26)

| Thành phần | File | Hiện trạng |
|---|---|---|
| Trang | `page.tsx` | `SiteHeader` + `SiteFooter`, font hệ thống, skip-link, `main.container-narrow` (448px), **1 cột**. Bắt buộc đăng nhập + đã xác minh (`requireVerifiedAccess`) — **chưa có luồng khách vãng lai**. |
| Đầu trang | `page.tsx` | Breadcrumb "← {tên gian hàng}", `h1` "Đơn hàng {mã}", 1 dòng chữ trạng thái (không có badge, không có tiến độ). |
| Tóm tắt đơn | `page.tsx` | Danh sách dòng `titleSnapshot` + giá, Tạm tính / Giảm giá / Tổng cộng. Không có ảnh bìa, loại tài liệu, link về trang tài liệu. |
| Mã giảm giá | `coupon-panel.tsx` | Đã tốt: nhãn hiển thị, "Áp dụng" / "Bỏ áp dụng", lỗi `role="alert"`, thành công `role="status"`, báo "Đã cập nhật mã QR theo số tiền mới". Luôn mở sẵn (chiếm chỗ ở màn hình đầu). |
| Chọn phương thức | `provider-panel.tsx` | `<select>` + nút "Tiếp tục thanh toán". **Chưa đạt chuẩn:** không có nhãn hiển thị, nút không `min-h-11`, màu `text-gray-500`/`text-red-600` gõ cứng, không mô tả từng phương thức. **Chỉ hiện khi đơn chưa chọn phương thức → khách không đổi được phương thức** (trái ADR-061 Q10). |
| Chuyển khoản ngân hàng | `app/_ui/bank-transfer-panel.tsx` | Đã tốt: QR 192px + "Tải ảnh QR" (`<a download>`), các dòng có nút "Sao chép" `min-h-11`, 1 vùng `aria-live`. Mobile đặt **thông tin trước, QR sau** (§24.3). Dùng chung với Studio billing. |
| MoMo thủ công | `app/_ui/wallet-transfer-panel.tsx` | **Markup tối thiểu của Hiếu** (chú thích trong file chờ Phong hoàn thiện): QR (nếu có), 5 dòng sao chép, câu lưu ý, "Chuyển khoản sau" (link `/account/orders`) + "Tôi đã chuyển khoản" (chỉ hiện lời cảm ơn tại chỗ, không lưu gì). Thiếu nút "Tải ảnh QR", nút sao chép thiếu `touch-manipulation`/hover, dòng "Ví: Ví MoMo" sao chép chữ "MoMo" (vô nghĩa). |
| MoMo API (REDIRECT) | `page.tsx` | Link "Mở trang thanh toán" — đang tắt theo ADR-059, giữ làm nhánh dự phòng. |
| Hạn đơn | `page.tsx` | Dòng chữ nhỏ cuối khối "Đơn hàng hết hạn lúc {ngày giờ}". Hạn tính lúc tạo đơn theo `orderPendingTtlMinutes` (System Settings) — **chưa theo phương thức 72h/48h** của ADR-061. |
| Cập nhật trạng thái | `checkout-poll.tsx` | `router.refresh()` 3 giây/lần khi đơn còn chờ. Không có thông báo cho trình đọc màn hình khi trạng thái đổi. |
| Đã thanh toán | `page.tsx` | Khối xanh (§7.1) "Thanh toán thành công. Xem tài liệu đã mua" (link `/account/library`). Không có nút chính "Tải tài liệu". |
| Hết hạn | `page.tsx` | Khối cam "Đơn hàng đã hết hạn. Vui lòng đặt lại đơn hàng mới." — **không có nút đặt lại**. |
| Huỷ / Hoàn tiền | `page.tsx` | Chỉ có chữ trạng thái ở đầu trang, không có khối giải thích. |
| loading / error | — | **Không có** `loading.tsx` / `error.tsx` riêng cho route. |

**Kết luận:** phần lõi (QR, sao chép, mã giảm giá) đã đúng chuẩn a11y và tái dùng được. Thiếu: luồng khách vãng lai, đổi
phương thức, tiến độ, trạng thái "chờ người bán xác nhận", hành động rõ ràng cho từng trạng thái, hành động dính đáy trên mobile.

---

## 2. Đánh giá ảnh mẫu

### 2.1. Ảnh 2 — trang chi tiết đơn của app báo giá (giao diện **nội bộ**, desktop)

| Chi tiết | Hợp? | Lý do / cách dùng ở Gieo Chữ |
|---|---|---|
| 2 ô "Đã thu" / "Còn phải thu" | **Không** | Không có trả góp/đặt cọc — mỗi đơn trả 1 lần. Hai ô làm khách tưởng phải trả nhiều đợt. Thay bằng **một con số "Số tiền cần chuyển"** lớn, đậm. |
| Dòng "Ngân hàng - STK - TÊN" | **Có, đổi cách trình bày** | Dòng gộp khó sao chép trên điện thoại. Giữ dạng từng dòng có nút "Sao chép" (đã có ở `BankTransferPanel`). Có thể thêm 1 dòng tóm tắt gộp ngay dưới QR cho khách quét để đối chiếu nhanh. |
| QR lớn trong khung trắng | **Có** | Đúng trọng tâm. QR 192px → đề xuất **224px** trên mobile (dễ quét từ máy khác, vẫn vừa màn đầu). Khung trắng + viền `line`. |
| Logo napas / ngân hàng dưới QR | **Không (giai đoạn này)** | Cần tài sản logo chính thức và quy định dùng (skill: *Correct Brand Logos*). Thay bằng chữ tên ngân hàng (`bank_bins.shortName`) — xem §7 Q9. |
| Số tiền đỏ đậm | **Giữ "to và đậm", bỏ màu đỏ** | Đỏ trong hệ thống của Gieo Chữ là lỗi/nguy hiểm. Dùng `ink`, 28px, `tabular-nums`. |
| Nút "Tải ảnh QR" | **Có** | Rất cần trên mobile: khách tải ảnh rồi "quét từ ảnh" trong app ngân hàng. Đã có ở ngân hàng, **thiếu ở MoMo**. |
| Cột phải "Tiến độ" timeline | **Có, rút gọn** | 4 bước thay vì 5. Phù hợp để trả lời câu khách hay hỏi nhất với chuyển khoản tay: "tôi chuyển rồi, giờ sao?". |
| Thẻ "Bước tiếp theo" | **Có, gộp vào timeline** | Viết thành 1 câu hướng dẫn dưới bước hiện tại, không tách thẻ nổi (bớt khối trên mobile). |
| Thanh hành động dính đáy | **Có trên mobile, không cần trên desktop** | Mobile: nút chính luôn trong tầm ngón cái. Desktop: cột phải đã dính (`sticky`), đặt hành động trong cột đó — tránh 2 vị trí cho cùng 1 nút. |
| Nhóm nút Sửa/Gửi khách/PDF/Excel, Nhật ký, KTV, Lịch lắp | **Không** | Thao tác của người bán, không thuộc trang khách. |

### 2.2. Ảnh 1 — popup MoMo thủ công

| Chi tiết | Hợp? | Lý do / cách dùng |
|---|---|---|
| Ô chỉ đọc + nút sao chép từng ô | **Có** | Đã có. Thống nhất 1 kiểu dòng sao chép cho ngân hàng và MoMo. |
| Ô "Ví MoMo" | **Bỏ nút sao chép** | Sao chép chữ "MoMo" không có ích. Đưa "Ví MoMo" thành tiêu đề khối. |
| "Nội dung chuyển khoản (bắt buộc)" | **Có, nhấn mạnh** | Nền `accentSoft`, nhãn có chữ "bắt buộc" (không chỉ màu), câu giải thích gắn `aria-describedby`. |
| Dòng lưu ý màu vàng | **Có** | Theo khối cảnh báo §7.1: nền `accentSoft`, viền trái `accent`, **chữ `ink`**, kèm icon `IconInfo`. |
| Popup (modal) | **Không** | Trên điện thoại modal dài 5 ô + 2 nút phải cuộn trong modal, dễ bấm ra ngoài là mất; khách quay lại từ app ngân hàng cũng mất popup. Hiển thị **ngay trên trang** (skill: *modal-vs-navigation*, *scroll-behavior*). |
| "Chuyển khoản sau" | **Có, hạ cấp** | Link phụ "Để sau — đơn được giữ đến {ngày giờ}" → `/account/orders`. |
| "Tôi đã chuyển khoản" | **Có, nếu có nghĩa nghiệp vụ** | Xem §7 Q1. Nếu chỉ hiện lời cảm ơn thì nút này gây hiểu lầm. |

### 2.3. Quy tắc skill đã đối chiếu

`touch-target-size` (≥44px), `touch-spacing` (≥8px), `aria-labels` + `contextual-live-badge-updates` (1 vùng `role="status"`
cho "Đã sao chép …" và cho đổi trạng thái đơn), `color-not-only` (trạng thái/bước có chữ + icon), `focus-not-obscured` (thanh
dính đáy phải có `scroll-padding-bottom`), `fixed-element-offset` + `safe-area-awareness` (`env(safe-area-inset-bottom)`),
`primary-action` (mỗi trạng thái **một** nút chính), `progressive-disclosure` (mã giảm giá, đổi phương thức, mô tả phương
thức thu gọn), `multi-step-progress` ("Bước 2/4"), `redundant-entry` (khách đã đăng nhập không phải nhập lại họ tên/email),
`input-labels`, `input-type-keyboard` + `autofill-support` (email: `type="email" autocomplete="email"`, tên: `autocomplete="name"`),
`error-placement` + `aria-live-errors`, `content-priority` (mobile: QR lên trước), `number-tabular` (tiền), `loading-buttons`,
`content-jumping` (giữ chỗ khung QR 224×224 khi tải), `reduced-motion`. Next.js stack: form dùng Server Action + `useActionState`
(mẫu đã có ở `coupon-panel.tsx`). Truy vấn "checkout payment trust" và "radio group selection" **không có kết quả** trong dữ
liệu skill → phần chọn phương thức dùng hướng dẫn chung (radio gốc của trình duyệt trong `fieldset/legend`).

---

## 3. Bố cục đề xuất

### 3.1. Khung và độ rộng

- **Phương án A (đề xuất) — 2 cột từ `lg` (≥1024px):** đổi `main` từ `container-narrow` sang `container-page`, lưới
  `lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-8`.
  - **Cột trái (hành động):** thông tin người mua → phương thức → khối thanh toán (QR + sao chép + lưu ý) hoặc khối kết quả.
  - **Cột phải (22rem, `lg:sticky lg:top-[112px]`, như khối mua ở trang tài liệu §8.4):** tóm tắt tài liệu + tổng tiền,
    mã giảm giá, tiến độ, nút hành động chính của trạng thái.
  - Lý do: desktop thường là người **quét QR bằng điện thoại** — QR + thông tin đặt cạnh nhau trong cột trái (container query
    `@lg` đã có trong `BankTransferPanel`), tổng tiền và tiến độ luôn nhìn thấy bên phải.
- **Phương án B — 1 cột `container-prose` (768px) cho mọi kích thước:** ít thay đổi hơn, nhưng desktop phải cuộn để thấy
  tiến độ. Chọn B nếu chủ dự án muốn giữ trang thanh toán "hẹp, tập trung".
- Cả 2 phương án đều phải sửa bảng ADR-024 / `UI-Design-System.md` §8.4 (checkout hiện ghi `container-narrow`) → §7 Q5.
- **Dưới `lg`:** 1 cột, thứ tự theo §3.2. Không cuộn ngang ở 375px (mọi chuỗi dài: mã đơn, STK, nội dung CK dùng
  `[overflow-wrap:anywhere]`).

### 3.2. Thứ tự khối trên mobile (375px)

Mục tiêu: khi đơn đã có phương thức, **QR nằm trong màn hình đầu** (khung nhìn ≈ 375×667, trừ `SiteHeader` ≈ 64px).

| # | Khối | Chiều cao ước tính | Ghi chú |
|---|---|---|---|
| 1 | Đầu trang gọn: "← {gian hàng}" + `h1` "Thanh toán đơn {mã}" + badge trạng thái + "Bước 2/4 · Giữ đơn đến {giờ, thứ, ngày}" | ~96px | Breadcrumb và dòng hạn cùng 1 hàng nhỏ khi đủ chỗ. |
| 2 | Dải tóm tắt rút gọn: ảnh bìa 48px + tên tài liệu (2 dòng tối đa) + tổng tiền | ~72px | Bấm "Chi tiết" mở bảng giá (tạm tính, giảm giá) — `<details>`. |
| 3 | Thanh phương thức đang dùng: icon + "Chuyển khoản ngân hàng" + nút "Đổi" | ~52px | Mở danh sách radio ngay tại chỗ (§4.3). |
| 4 | **Khối thanh toán:** QR 224px → "Số tiền cần chuyển" 28px → nút "Tải ảnh QR" | ~340px | **Hết màn đầu ở đây** (≈ 560–620px). |
| 5 | Các dòng sao chép (ngân hàng / MoMo) | | Nội dung CK đặt **đầu tiên** trong danh sách (quan trọng nhất). |
| 6 | Khối lưu ý (vàng) | | |
| 7 | Mã giảm giá (thu gọn "Có mã giảm giá?") | | Mở sẵn khi đã áp mã. |
| 8 | Tiến độ (timeline đủ 4 bước) | | |
| 9 | Link "Để sau — xem lại trong Đơn hàng của tôi" | | |
| — | **Thanh dính đáy** (luôn hiện) | 72px + safe area | Tổng tiền + nút chính của trạng thái. |

**Đổi so với §24.3 hiện hành:** trên mobile `BankTransferPanel` đang đặt thông tin trước QR (vì không quét được QR của chính
máy mình). Brief yêu cầu QR ở màn đầu; đề xuất giữ QR trước **nhưng** ngay dưới QR có "Tải ảnh QR" (dùng "quét từ ảnh" của app
ngân hàng) và câu dẫn mobile "Tải ảnh QR rồi mở app ngân hàng → Quét QR → chọn ảnh, hoặc sao chép thông tin bên dưới." Cần
Long cập nhật §24.3 sau khi chốt. Studio billing dùng chung component → thêm prop `mobileOrder: "qr-first" | "info-first"`
để không đổi hành vi trang billing (mặc định giữ như cũ).

Khi đơn **chưa có phương thức** (hoặc khách vãng lai chưa điền thông tin), khối 3–6 thay bằng: form người mua (§4.2) → danh
sách phương thức (§4.3) → nút "Tiếp tục thanh toán" (ở thanh dính đáy). QR xuất hiện ngay sau khi bấm (cùng trang, không tải
lại toàn trang), focus chuyển tới tiêu đề khối thanh toán.

### 3.3. Wireframe — mobile 375px, trạng thái "chờ thanh toán", chuyển khoản ngân hàng

```
┌─────────────────────────────────────┐
│ [logo]  SiteHeader           [≡]    │
├─────────────────────────────────────┤
│ ← Cô Lan Ngữ Văn                    │
│ Thanh toán đơn GC-8K2F1             │  h1
│ [◷ Chờ thanh toán]  Bước 2/4        │  badge có chữ + icon
│ Giữ đơn đến 14:30, Thứ Năm 29/10    │
├─────────────────────────────────────┤
│ ┌──┐ Bộ đề ôn thi vào 10 môn Văn    │
│ │bìa│ 2026 (PDF)            99.000đ │
│ └──┘                     Chi tiết ▾ │
├─────────────────────────────────────┤
│ [▣] Chuyển khoản ngân hàng   [ Đổi ]│  nút 44px
├─────────────────────────────────────┤
│ ## Quét mã để thanh toán            │  h2
│ Tải ảnh QR rồi mở app ngân hàng →   │
│ Quét QR → chọn ảnh.                 │
│        ┌───────────────┐            │
│        │               │            │
│        │   QR 224px    │            │
│        │               │            │
│        └───────────────┘            │
│          Vietcombank                │
│      Số tiền cần chuyển             │
│          99.000đ                    │  28px, ink, tabular
│     [ ↓ Tải ảnh QR ]                │  44px
│- - - - - - - - - - (màn đầu) - - - -│
│ ┌─────────────────────────────────┐ │
│ │Nội dung CK (bắt buộc) [Sao chép]│ │  nền accentSoft
│ │GC8K2F1                          │ │
│ │Nhập đúng nguyên văn để ...      │ │
│ ├─────────────────────────────────┤ │
│ │Số tài khoản          [Sao chép] │ │
│ │1029384756                       │ │
│ ├─────────────────────────────────┤ │
│ │Chủ tài khoản         [Sao chép] │ │
│ │NGUYEN THI LAN                   │ │
│ ├─────────────────────────────────┤ │
│ │Số tiền               [Sao chép] │ │
│ │99.000đ                          │ │
│ └─────────────────────────────────┘ │
│ ┃ⓘ Chuyển đúng số tiền và nội dung. │  khối lưu ý §7.1
│ ┃  Người bán xác nhận trong giờ làm │
│ ┃  việc, bạn sẽ nhận email.         │
│ ▸ Có mã giảm giá?                   │
│ ## Tiến độ                          │
│ ✓ Đặt đơn            26/10 14:30    │
│ ● Thanh toán         đang chờ       │
│ ○ Người bán xác nhận                │
│ ○ Tải tài liệu                      │
│ Để sau — xem lại trong Đơn hàng     │
│ của tôi                             │
│ (khoảng trống = chiều cao thanh đáy)│
├─────────────────────────────────────┤
│ Tổng 99.000đ    [Tôi đã chuyển khoản]│  sticky, safe-area
└─────────────────────────────────────┘
```

### 3.4. Wireframe — desktop ≥1024px (Phương án A)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ SiteHeader                                                                   │
├──────────────────────────────────────────────────────────────────────────────┤
│ ← Cô Lan Ngữ Văn                                                             │
│ Thanh toán đơn GC-8K2F1   [◷ Chờ thanh toán]   Giữ đơn đến 14:30, Thứ Năm 29/10│
│                                                                              │
│ ┌─ CỘT TRÁI (1fr) ───────────────────────────┐ ┌─ CỘT PHẢI 22rem (sticky) ─┐│
│ │ ## Cách thanh toán                         │ │ ┌──┐ Bộ đề ôn thi vào 10  ││
│ │ [▣] Chuyển khoản ngân hàng        [ Đổi ]  │ │ │bìa│ môn Văn 2026 · PDF   ││
│ │────────────────────────────────────────────│ │ └──┘                      ││
│ │ ## Quét mã để thanh toán                   │ │ Tạm tính        120.000đ  ││
│ │ ┌──────────────┐  Nội dung CK (bắt buộc)   │ │ Giảm (GIAM20)   −21.000đ  ││
│ │ │              │  GC8K2F1        [Sao chép]│ │ ─────────────────────────  ││
│ │ │  QR 224px    │  Số tài khoản             │ │ Tổng cộng        99.000đ  ││
│ │ │              │  1029384756     [Sao chép]│ │ Mã giảm giá: GIAM20       ││
│ │ └──────────────┘  Chủ tài khoản            │ │               [Bỏ áp dụng]││
│ │   Vietcombank     NGUYEN THI LAN [Sao chép]│ │ ───────────────────────── ││
│ │ Số tiền cần chuyển Số tiền                 │ │ ## Tiến độ  (Bước 2/4)    ││
│ │   99.000đ         99.000đ        [Sao chép]│ │ ✓ Đặt đơn                 ││
│ │ [↓ Tải ảnh QR]                             │ │ ● Thanh toán              ││
│ │                                            │ │   Quét QR hoặc chuyển     ││
│ │ ┃ⓘ Chuyển đúng số tiền và nội dung ...     │ │   khoản theo thông tin.   ││
│ │                                            │ │ ○ Người bán xác nhận      ││
│ │ Để sau — xem lại trong Đơn hàng của tôi    │ │ ○ Tải tài liệu            ││
│ └────────────────────────────────────────────┘ │ [  Tôi đã chuyển khoản  ] ││
│                                                └───────────────────────────┘│
├──────────────────────────────────────────────────────────────────────────────┤
│ SiteFooter                                                                   │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 3.5. Wireframe — khách vãng lai, chưa có phương thức (mobile)

```
┌─────────────────────────────────────┐
│ ← Cô Lan Ngữ Văn                    │
│ Thanh toán                          │  h1
│ Bước 1/4 · Thông tin và cách trả    │
│ ┌──┐ Bộ đề ôn thi vào 10 … 99.000đ  │
│ └──┘                                │
│ ## Thông tin người mua              │
│ Đã có tài khoản? Đăng nhập          │  link, giữ returnTo
│ Họ và tên *                         │
│ [______________________________]    │  autocomplete=name
│ Email nhận tài liệu *               │
│ [______________________________]    │  type=email
│ Tài liệu và hướng dẫn kích hoạt     │  helper text
│ tài khoản gửi về email này.         │
│ ## Cách thanh toán                  │  fieldset/legend
│ (•) Chuyển khoản ngân hàng          │  thẻ radio ≥56px
│     Quét QR, người bán xác nhận     │
│ ( ) Ví MoMo                         │
│     Chuyển qua app MoMo             │
│ ( ) Chuyển khoản tự xác nhận        │
│     Xác nhận tự động sau 1–3 phút   │
│ ▸ Có mã giảm giá?                   │
│ [✓] Tôi xác nhận thông tin trên là  │  checkbox 24px, vùng chạm 44px
│     đúng và đồng ý Điều khoản sử    │
│     dụng.                           │  link mở tab mới
├─────────────────────────────────────┤
│ Tổng 99.000đ  [Tiếp tục thanh toán] │  sticky
└─────────────────────────────────────┘
```

---

## 4. Mô tả từng khối

### 4.1. Đầu trang + trạng thái

- Breadcrumb giữ như cũ ("← {tenant.name}", `min-h-11`). `h1`: "Thanh toán đơn {mã}" (đã có đơn) / "Thanh toán" (chưa có đơn).
- **Badge trạng thái** (có chữ + icon, không chỉ màu): Chờ thanh toán (`accentSoft`/icon đồng hồ) · Chờ người bán xác nhận
  (`surface`/icon đồng hồ) · Đã thanh toán (nền xanh nhạt §7.1/icon check) · Hết hạn (`accentSoft`/icon cảnh báo) · Đã huỷ
  (xám `line`/icon X) · Đã hoàn tiền (xám/icon hoàn). Chữ luôn `ink`.
- Dòng hạn: "Giữ đơn đến 14:30, Thứ Năm 29/10/2026" — `Intl.DateTimeFormat("vi-VN", { timeZone: DISPLAY_TIME_ZONE, weekday,
  day, month, hour, minute })`. **Không đếm ngược.** Còn ≤ 24 giờ → thêm chữ "(còn dưới 1 ngày)" — tính ở server mỗi lần
  render, không có bộ đếm phía client.

### 4.2. Thông tin người mua

- **Khách đã đăng nhập:** 1 dòng chỉ đọc "Mua với tài khoản **{email}**" + link "Không phải bạn? Đăng xuất" (skill
  *redundant-entry* — không bắt nhập lại).
- **Khách vãng lai:** `Họ và tên *` (`autocomplete="name"`), `Email nhận tài liệu *` (`type="email" autocomplete="email"
  inputmode="email"`, helper text cố định), checkbox "Tôi xác nhận thông tin trên là đúng và đồng ý **Điều khoản sử dụng**"
  (link tới trang điều khoản, mở tab mới, có chữ "(mở tab mới)" `sr-only`). Kiểm tra khi rời ô (blur), lỗi dưới ô +
  `aria-describedby`; khi gửi lỗi nhiều ô → hộp tóm tắt lỗi đầu form nhận focus (skill *error-summary*).
- **Email đã có tài khoản:** lỗi ngay dưới ô email: "Email này đã có tài khoản. **Đăng nhập để tiếp tục mua**" — link đăng nhập
  có `returnTo` về đúng trang thanh toán, email điền sẵn. Không tạo đơn, không gắn đơn (ADR-061 Q1).
- Sau khi tạo tài khoản: khối này đổi thành dòng chỉ đọc + ghi chú "Chúng tôi đã gửi email kích hoạt tới {email} để bạn
  đặt mật khẩu và tải lại tài liệu trên thiết bị khác."
- Input `min-h-11`, chữ 16px (tránh iOS tự phóng to).

### 4.3. Chọn / đổi phương thức

- **Chưa chọn:** `fieldset` + `legend` "Cách thanh toán", mỗi phương thức là 1 thẻ radio gốc (cả thẻ là `label`, cao ≥56px):
  tên + 1 dòng mô tả + thời gian xác nhận:
  - "Chuyển khoản ngân hàng" — "Quét QR bằng app ngân hàng. Người bán xác nhận thủ công."
  - "Ví MoMo" — "Chuyển qua app MoMo. Người bán xác nhận thủ công."
  - "Chuyển khoản (xác nhận tự động)" — SePay; "Hệ thống tự xác nhận vài phút sau khi bạn chuyển." Tên "SePay" là tên kỹ
    thuật, khách phổ thông không biết → không đặt làm nhãn chính (§7 Q8).
  - Chọn sẵn phương thức đầu tiên nếu chỉ có 1; vẫn phải bấm "Tiếp tục thanh toán" (không tự tạo QR — tránh gửi email cho
    người bán với đơn khách bỏ, ADR-061 Q9).
- **Đã chọn, đơn đang chờ:** thanh "[icon] Chuyển khoản ngân hàng — [Đổi]". "Đổi" là nút disclosure (`aria-expanded`,
  `aria-controls`) mở danh sách radio ngay dưới, kèm nút "Dùng cách này" và câu cảnh báo (khối §7.1): "Nếu bạn **đã chuyển
  tiền** theo cách cũ, đừng đổi — hãy bấm *Tôi đã chuyển khoản*." Đổi xong: QR mới thay tại chỗ, `role="status"` đọc "Đã
  chuyển sang Ví MoMo. Thông tin chuyển khoản đã cập nhật.", focus về tiêu đề khối thanh toán.
- **Ẩn "Đổi"** khi trạng thái "Chờ người bán xác nhận" (nếu Q1 chọn lưu trạng thái), đã trả, hết hạn, huỷ.
- Không còn phương thức nào bật → empty state: "Người bán chưa bật cách thanh toán nào. Vui lòng liên hệ người bán." (+ kênh
  liên hệ nếu có — §7 Q6).

### 4.4. Khối thanh toán theo phương thức

Một khung thống nhất cho 3 phương thức, thứ tự trong khung: **h2 → câu dẫn → QR → tên ngân hàng/ví → "Số tiền cần chuyển" →
"Tải ảnh QR" → các dòng sao chép → khối lưu ý**.

| | Chuyển khoản ngân hàng (`MANUAL_QR`) | Ví MoMo (`MOMO_MANUAL`) | Tự xác nhận (`SEPAY`) |
|---|---|---|---|
| h2 | "Quét mã để thanh toán" | "Chuyển tiền qua Ví MoMo" | "Quét mã để thanh toán" |
| QR | Có | Có nếu người bán có STK VietQR của ví; **không có** → bỏ khung QR, câu dẫn "Mở app MoMo → Chuyển tiền → nhập số điện thoại bên dưới" | Có |
| Dòng sao chép (theo thứ tự) | Nội dung CK (bắt buộc) · Số tài khoản · Chủ tài khoản · Ngân hàng · Số tiền | Nội dung CK (bắt buộc) · Số điện thoại MoMo · Tên chủ ví · Số tiền | như ngân hàng |
| Lưu ý (vàng) | "Chuyển đúng số tiền và nội dung. Người bán đối chiếu rồi xác nhận — bạn sẽ nhận email khi xong." | "… Người bán đối chiếu lịch sử ví MoMo rồi xác nhận." | "Chuyển đúng số tiền và nội dung để hệ thống tự xác nhận. Trang tự cập nhật, không cần tải lại." |
| Nút chính | "Tôi đã chuyển khoản" (theo Q1) | "Tôi đã chuyển khoản" (theo Q1) | **Không có** — hiện dòng trạng thái "Đang chờ ngân hàng báo về…" (spinner tắt khi `prefers-reduced-motion`) |

- **Dòng sao chép:** tái dùng kiểu dòng của `BankTransferPanel` (nhãn `dt`, giá trị `select-all`, nút "Sao chép" `min-h-11
  min-w-[6.75rem]` có chữ + icon). `aria-label` "Sao chép {tên dòng}" → sau khi bấm nút đổi chữ "Đã chép" + icon check 2,5 giây;
  **một** vùng `role="status" aria-live="polite"` cho cả khối đọc "Đã sao chép nội dung chuyển khoản." Lỗi clipboard → hướng dẫn
  chạm giữ để chép tay. Số tiền sao chép dạng số thuần `99000`.
- **Đề xuất gộp:** tách phần dòng sao chép + QR thành component dùng chung `TransferDetails` (`app/_ui/`), để
  `BankTransferPanel` và `WalletTransferPanel` chỉ khác danh sách dòng — một kiểu, một cách sửa a11y. Việc của Phong ở bước
  làm UI (không đổi contract props hiện có).
- **"Tải ảnh QR":** giữ `<a download>` data URL (CSP không cho `fetch` data URL). Thêm cho MoMo. Tên file `QR-{mã đơn}.png`.
- **QR:** `img` 224×224 khai báo `width/height` (không nhảy bố cục), `alt` "Mã QR chuyển khoản {số tiền} cho đơn hàng {mã}".
- **Đơn có mã giảm giá mới áp sau khi đã có QR:** câu "Đã cập nhật mã QR theo số tiền mới" (đã có) + khung QR nháy viền 1 lần
  (tắt khi reduced-motion).

### 4.5. Mã giảm giá

- Tái dùng `CouponPanel` nguyên logic. Bọc trong disclosure "Có mã giảm giá?" (nút `aria-expanded`, `min-h-11`), **mở sẵn**
  khi đã áp mã hoặc khi vừa có lỗi.
- Vị trí: desktop trong cột phải, dưới bảng giá; mobile ngay trước phần tiến độ (sau khối thanh toán) khi đã có QR, hoặc
  trước checkbox điều khoản khi chưa chọn phương thức (để khách áp mã **trước** khi tạo QR — khớp gợi ý hiện có).
- Ẩn hoàn toàn khi đơn không còn chờ.

### 4.6. Tiến độ (timeline)

- `h2` "Tiến độ" + "Bước X/4". `<ol>`; bước hiện tại có `aria-current="step"`. Mỗi bước: icon (check / chấm đặc / vòng rỗng /
  X) **và** chữ trạng thái `sr-only` ("đã xong", "đang thực hiện", "chưa tới") — không chỉ dựa vào màu.
- 4 bước:
  1. **Đặt đơn** — thời gian tạo đơn.
  2. **Thanh toán** — "Quét QR hoặc chuyển khoản theo thông tin" / đã báo chuyển lúc {giờ} (nếu có Q1).
  3. **Người bán xác nhận** — với SePay đổi chữ thành **"Hệ thống xác nhận"** ("tự động, thường vài phút").
  4. **Tải tài liệu** — mở khi đã thanh toán.
- Câu "Bước tiếp theo" (ý của ảnh mẫu) đặt dưới bước hiện tại, chữ `inkSoft` 14px.
- Bước bị dừng (hết hạn/huỷ): bước hiện tại đổi icon X + chữ "Đơn đã hết hạn lúc {giờ}" / "Đơn đã huỷ"; các bước sau xám.
- Mobile: ở dưới khối thanh toán; ở đầu trang chỉ còn chữ "Bước 2/4".

### 4.7. Thanh hành động dính đáy (mobile, `< lg`)

- `fixed inset-x-0 bottom-0`, nền trắng, viền trên `line`, `padding-bottom: max(12px, env(safe-area-inset-bottom))`, z-index
  thấp hơn header/menu. Trái: "Tổng" + số tiền (`tabular-nums`); phải: **1** nút chính `min-h-12`.
- `main` có `padding-bottom` bằng chiều cao thanh + `scroll-padding-bottom` để phần tử đang focus bằng bàn phím không bị che
  (WCAG 2.2 *Focus Not Obscured*).
- Nút chính theo trạng thái:

| Trạng thái | Nút chính (thanh đáy mobile + cột phải desktop) |
|---|---|
| Chưa có đơn / chưa chọn phương thức | "Tiếp tục thanh toán" (submit form, `disabled` + "Đang tạo mã…" khi chờ) |
| Chờ thanh toán — thủ công | "Tôi đã chuyển khoản" (theo Q1) |
| Chờ thanh toán — SePay | Không có nút; thanh đáy hiện "Đang chờ xác nhận tự động…" + link "Tải ảnh QR" |
| Chờ người bán xác nhận | Không có nút chính; "Đơn của tôi" (phụ) |
| Đã thanh toán | **"Tải tài liệu"** → Thư viện |
| Hết hạn / huỷ | "Đặt lại đơn" → trang tài liệu (nếu tài liệu còn bán) |

### 4.8. Hiệu ứng / cập nhật trực tiếp

- Giữ poll 3 giây. Khi trạng thái đổi (đã trả, hết hạn), **một** `role="status"` đọc câu đầy đủ ("Đã nhận thanh toán. Bạn có
  thể tải tài liệu.") — không dời focus, không đọc lặp mỗi lần refresh.
- Không confetti; khối thành công hiện bằng fade 150ms, tắt khi `prefers-reduced-motion`.

---

## 5. Màn hình theo trạng thái

| Trạng thái (hiển thị) | Điều kiện (đề xuất) | Cột trái / khối chính | Cột phải / tiến độ | Hành động |
|---|---|---|---|---|
| **Chưa có đơn** (khách vãng lai) | Chưa submit form | Form người mua + phương thức + điều khoản | Tóm tắt + mã giảm giá + tiến độ bước 1 | "Tiếp tục thanh toán" |
| **Chờ thanh toán** | `PENDING` + (chưa chọn phương thức **hoặc** chưa báo đã chuyển) | Phương thức + khối thanh toán (§4.4) | Bước 2 đang làm | "Tôi đã chuyển khoản" (thủ công) / chờ tự động (SePay) · phụ: "Để sau" |
| **Chờ người bán xác nhận** | `PENDING` + phương thức thủ công + **đã báo chuyển** (Q1) | Khối thông tin `surface`: "Bạn đã báo chuyển lúc {giờ}. Người bán sẽ đối chiếu và xác nhận — bạn nhận email khi xong. Đơn được giữ đến {giờ}." · thu gọn "Xem lại thông tin chuyển khoản" (`<details>`, để khách kiểm tra mình chuyển đúng chưa) · "Chưa chuyển? Tôi chưa chuyển khoản" (hoàn tác — theo Q1) | Bước 3 đang làm | Phụ: "Đơn của tôi" |
| **Đã thanh toán** (`PAID`/`FULFILLED`) | | Khối thành công §7.1 lớn: icon check + h2 "Thanh toán thành công" + tên tài liệu + "Thanh toán lúc {giờ} · {số tiền}" + nút chính **"Tải tài liệu"**. Khách vừa tạo tài khoản: thêm khối nhắc "Kiểm tra email {email} để đặt mật khẩu — cần để tải lại trên thiết bị khác." | Bước 4 sáng, tất cả ✓ | "Tải tài liệu" · phụ "Về gian hàng" |
| **Hết hạn** | `EXPIRED` (kể cả `PENDING` quá hạn) | Khối cảnh báo §7.1: "Đơn đã hết hạn lúc {giờ}. Mã QR không còn dùng được." + "**Nếu bạn đã chuyển tiền**, liên hệ người bán kèm mã đơn {mã}" (+ kênh liên hệ, Q6) | Bước 2 dừng (X) | "Đặt lại đơn" (nếu tài liệu còn bán; không thì ẩn) |
| **Đã huỷ** | `CANCELED` | Khối xám: "Đơn đã bị huỷ." + lý do nếu có (hiện không có dữ liệu lý do) | Dừng | "Đặt lại đơn" / "Về gian hàng" |
| **Đã hoàn tiền** (ngoài brief, có trong enum) | `REFUNDED` | Khối xám: "Đơn đã được hoàn tiền. Quyền tải tài liệu đã thu hồi." | Dừng | "Về gian hàng" |

Ở mọi trạng thái **không còn chờ**: ẩn QR, ẩn dòng sao chép, ẩn mã giảm giá, ẩn "Đổi" phương thức (tránh khách chuyển tiền vào
đơn đã đóng).

**Loading / error / empty của route:**
- `loading.tsx`: khung xương đúng bố cục (đầu trang, dải tóm tắt, ô 224×224 giữ chỗ QR, 4 dòng) — không nhảy bố cục.
- `error.tsx`: "Không tải được trang thanh toán. Đơn của bạn vẫn được giữ." + nút "Thử lại" (`reset()`) + link "Đơn của tôi".
- `not-found`: đơn không tồn tại/không thuộc người xem → dùng 404 chung (giữ như hiện tại).
- Empty: không có phương thức nào bật (§4.3).

---

## 6. Contract dữ liệu cho Hiếu

Ký hiệu: **Có** = đang có trong code; **Thiếu** = cần bổ sung; **Mở rộng** = có nhưng cần thêm.

### 6.1. View model trang (server → UI)

```ts
type CheckoutView = {
  viewer:
    | { kind: "user"; name: string; email: string; justCreated: boolean }   // Thiếu: justCreated (khách vãng lai vừa tạo TK)
    | { kind: "guest" };                                                   // Thiếu: cả luồng guest
  order: {
    code: string;                         // Có
    displayStatus:                        // Thiếu (suy ra ở server, UI không tự suy)
      | "AWAITING_PAYMENT" | "AWAITING_SELLER_CONFIRM" | "PAID" | "EXPIRED" | "CANCELED" | "REFUNDED";
    subtotalVnd: number; discountVnd: number; totalVnd: number;   // Có
    couponCode: string | null;            // Có
    provider: PaymentProviderId | null;   // Có
    confirmMode: "MANUAL" | "AUTO" | null;// Thiếu (từ isManualConfirmProvider) — UI cần để đổi chữ bước 3
    checkout: CheckoutResult | null;      // Có (checkoutPayload)
    createdAt: Date;                      // Có
    expiresAt: Date;                      // Có — nhưng Mở rộng: tính theo phương thức 72h/48h (ADR-061), hiện theo orderPendingTtlMinutes
    paidAt: Date | null;                  // Có trong model, chưa dùng ở trang
    customerDeclaredPaidAt: Date | null;  // Thiếu — chỉ khi Q1 chọn lưu (migration thêm cột)
  } | null;                               // null = khách vãng lai chưa tạo đơn
  item: {
    productId: string;                    // Có
    title: string;                        // Có (titleSnapshot)
    unitPriceVnd: number; finalPriceVnd: number; // Có
    productPath: string | null;           // Thiếu — productPath(tenantSlug, product.slug); null nếu tài liệu đã gỡ → ẩn "Đặt lại đơn"
    typeLabel: string | null;             // Thiếu — ProductType
    coverUrl: string | null;              // Thiếu — resolveProductCoverUrl
    stillPurchasable: boolean;            // Thiếu — cho nút "Đặt lại đơn"
  };
  tenant: { name: string; slug: string;   // Có
            contact: { label: string; href: string }[] };  // Thiếu — tuỳ Q6 (vd. zalo/facebook từ socialLinks)
  bank: { shortName: string; name: string } | null;        // Có (getBankByBin) — Mở rộng: cả khi checkout là WALLET có qr.bin? (không cần)
  enabledProviders: { id: PaymentProviderId; confirmMode: "MANUAL" | "AUTO" }[]; // Mở rộng: hiện chỉ lấy khi CHƯA chọn phương thức → cần lấy cả khi đang chờ để "Đổi"
  links: {
    library: string;                      // Có ("/account/library") — Mở rộng nếu muốn trỏ thẳng mục tài liệu
    orders: string;                       // Có ("/account/orders")
    terms: string;                        // Thiếu — URL trang Điều khoản (CMS pháp lý), không gõ cứng
    login: string;                        // Thiếu — /login?returnTo=<trang thanh toán>&email=
  };
};
```

### 6.2. Action

| Action | Trạng thái | Input → Output | Ghi chú cho Hiếu |
|---|---|---|---|
| `applyCouponAction` / `removeCouponAction` | **Có** | như hiện tại | Khách vãng lai chưa có đơn: cần cách áp mã trước khi tạo đơn (giữ mã trong form rồi áp lúc tạo đơn) — hoặc chỉ cho áp sau khi đã tạo đơn (đơn giản hơn, đề xuất). |
| `selectProviderAction` | **Mở rộng** | `{provider}` → `{error?}` | Đã gọi được khi đơn đã có phương thức (`initiateOrderCheckout` không chặn), nhưng: (1) trang chưa lấy `enabledProviders` khi đã chọn; (2) email người bán chống sót/trùng khi đổi (ADR-061 Q10); (3) hạn giữ đơn khi đổi (Q3); (4) chặn đổi khi đã báo chuyển (Q1). Trả thêm `{ ok: true, provider }` để UI đọc thông báo. |
| `startGuestCheckoutAction` | **Thiếu** | `{tenantSlug, productId, name, email, acceptTerms, provider}` → `{ fieldErrors?: {name?, email?, acceptTerms?}, error?, code?: "EMAIL_EXISTS" \| "RATE_LIMITED" \| "PRODUCT_UNAVAILABLE" }` hoặc redirect `/{tenant}/checkout/{code}` | Tạo user chưa kích hoạt + phiên + đơn + checkout trong 1 bước; gửi email kích hoạt; rate limit. Lỗi trả theo từng ô để UI đặt dưới ô. |
| `declarePaidAction` | **Thiếu** (tuỳ Q1) | `{}` → `{error?}` | Ghi `customerDeclaredPaidAt` (idempotent), gửi email người bán 1 lần. Chỉ cho đơn `PENDING` + thủ công. |
| `undoDeclarePaidAction` | **Thiếu** (tuỳ Q1) | `{}` → `{error?}` | Xoá mốc "đã báo chuyển" để khách đổi phương thức lại. |
| `cancelOrderByCustomerAction` | **Thiếu** (tuỳ Q4) | `{}` → `{error?}` | `cancelOrder` hiện chỉ cho người bán (tenantId). |
| Tải ảnh QR | **Có** | — | `<a download>` data URL, thuần client. Không cần API. |
| Tải tài liệu | **Có** (Thư viện) | — | Cần xác nhận phiên khách vãng lai chưa kích hoạt **vào được** `/account/library` và tải (ADR-061 Q1 — hiện `requireVerifiedAccess` chặn người chưa xác minh). |

### 6.3. Route

- Khách vãng lai chưa có đơn thì **chưa có `orderCode`** → cần một URL trước khi có đơn (Q2). Đề xuất `/{tenantSlug}/checkout?tai-lieu={productSlug}`
  (`app/[tenantSlug]/checkout/page.tsx`, dùng chung component với trang có mã đơn). `checkout` đã là route tĩnh dưới
  `[tenantSlug]` và đã có trong `RESERVED_PRODUCT_SLUGS` (`packages/core/src/product/path.ts`) — không cần thêm slug.
- `buyProductAction` hiện bắt đăng nhập → đổi: chưa đăng nhập thì chuyển tới URL trên thay vì `/login`.

---

## 7. Câu hỏi cần chủ dự án chốt (kèm đề xuất của Phong)

| # | Câu hỏi | Đề xuất của Phong |
|---|---|---|
| **Q1** | Nút **"Tôi đã chuyển khoản"** có ý nghĩa nghiệp vụ không? | **Có.** Lưu thời điểm khách báo đã chuyển (cột mới, **không** đổi trạng thái đơn `PENDING`), trang chuyển sang "Chờ người bán xác nhận", gửi email người bán **1 lần** ("Khách báo đã chuyển đơn {mã}"), Studio thấy cờ này để ưu tiên đối soát. Cho phép "Tôi chưa chuyển khoản" để hoàn tác. Nếu chủ dự án **không** muốn thêm dữ liệu → bỏ hẳn nút (chỉ để "Để sau"), vì nút không làm gì gây hiểu lầm. Không có nút này cho SePay. |
| Q2 | Khách vãng lai chưa có đơn thì trang thanh toán ở URL nào; đơn được tạo lúc nào? | Tạo đơn **khi khách bấm "Tiếp tục thanh toán"** (sau khi điền form), không tạo khi bấm "Mua ngay" — tránh đơn rác từ người chưa có tài khoản. URL trước đó: `/{tenant}/checkout?tai-lieu={slug}`. |
| Q3 | Đổi phương thức có làm **đổi hạn giữ đơn** không (72h ↔ 48h)? Đơn chưa chọn phương thức giữ bao lâu? | Hạn = **thời điểm đặt đơn + hạn của phương thức đang chọn**, đổi phương thức không gia hạn (chống kéo dài vô hạn); nếu hạn mới đã qua → không cho đổi sang SePay. Chưa chọn phương thức: dùng 72h. |
| Q4 | Khách có được **tự huỷ** đơn đang chờ không? | **Có**, nút phụ "Huỷ đơn" (có hộp xác nhận) — vì giới hạn mã giảm giá "mỗi khách" đang tính cả đơn chờ (ADR-061 Q6), khách muốn mua lại với mã khác sẽ bị kẹt tới khi hết hạn. Nếu không muốn: bỏ, đơn tự hết hạn. |
| Q5 | Desktop dùng **2 cột** (`container-page`, Phương án A) hay **1 cột** (`container-prose`, Phương án B)? Cả hai đều đổi quy ước `container-narrow` hiện ghi ở ADR-024. | **A.** |
| Q6 | Hiện **kênh liên hệ người bán** ở trang thanh toán (khi chờ xác nhận lâu, khi hết hạn mà đã chuyển tiền)? Kênh nào? | Có — dùng link mạng xã hội gian hàng đã khai báo (Zalo/Facebook trong `Tenant.theme.socialLinks`), không lộ email/SĐT cá nhân nếu người bán không chủ động khai báo. Không có kênh nào → chỉ ghi "Liên hệ người bán qua trang gian hàng". |
| Q7 | Sau khi trả tiền: nút "Tải tài liệu" mở **Thư viện** hay **tải thẳng** ngay trên trang thanh toán? | Mở **Thư viện**, trỏ thẳng tới mục tài liệu vừa mua (đồng bộ email ADR-061 Q12, một nơi kiểm quyền tải). |
| Q8 | Tên hiển thị của SePay cho khách? | "Chuyển khoản (xác nhận tự động)" — không dùng chữ "SePay" làm nhãn chính (khách không biết). |
| Q9 | Có hiện **logo NAPAS / logo ngân hàng** dưới QR như ảnh mẫu không? | **Không** trong beta — cần tài sản logo chính thức + quy định dùng. Hiện tên ngân hàng bằng chữ. |
| Q10 | Mobile đặt **QR trước** thông tin sao chép (đảo §24.3 hiện hành)? | **Có** cho trang khách (kèm "Tải ảnh QR" ngay dưới); trang Studio billing giữ như cũ (prop chọn thứ tự). |
| Q11 | Checkbox "xác nhận thông tin + đồng ý Điều khoản" là **1 ô** hay **2 ô**? | 1 ô (đúng nghiệp vụ đã chốt), chữ ngắn, link Điều khoản rõ. Không tick sẵn. |
| Q12 | Thông tin MoMo của người bán phải ghi trong trang chính sách (ADR-059 lần 3 mục 5) — trang thanh toán có cần link tới **chính sách của người bán**? | Có, 1 link nhỏ dưới khối lưu ý MoMo: "Chính sách thanh toán của {gian hàng}" — cần Hiếu cung cấp URL. |

---

## 8. Checklist khi làm UI (cho bước triển khai sau)

- [ ] Mọi nút/link/ô ≥44px (thanh đáy 48px), khoảng cách ≥8px; checkbox có vùng chạm 44px.
- [ ] Nút sao chép: `aria-label` "Sao chép …", chữ "Đã chép" 2,5 giây, **một** vùng `aria-live="polite"` cho cả khối.
- [ ] Trạng thái/bước: chữ + icon, không chỉ màu; chữ trong khối trạng thái luôn `ink`.
- [ ] Màu chỉ qua `brandColors`/`var(--color-primary)`; không hex; không gõ cứng tên thương hiệu.
- [ ] Tiền `toLocaleString("vi-VN")` + "đ", `tabular-nums`; giờ theo `DISPLAY_TIME_ZONE`.
- [ ] Thanh dính đáy: safe-area, `scroll-padding-bottom`, không che focus; ẩn từ `lg`.
- [ ] `h1` → `h2` tuần tự (Thông tin người mua / Cách thanh toán / Quét mã… / Tiến độ).
- [ ] `loading.tsx`, `error.tsx`, empty state phương thức.
- [ ] Kiểm 375px không cuộn ngang, QR trong màn đầu; desktop điều hướng bằng bàn phím; `prefers-reduced-motion`.
- [ ] Không đưa secret ra client (checkout payload chỉ chứa thông tin nhận tiền công khai — đã đúng).

## 9. Tác động tài liệu (Long cập nhật sau khi chốt)

- `UI-Design-System.md` §8.4 (checkout: khung, 2 cột, thanh đáy, trạng thái), §24.3 (thứ tự QR mobile, `TransferDetails` dùng
  chung, "Tải ảnh QR" cho MoMo), §7.1 (thêm khối "chờ xác nhận" nền `surface`, khối huỷ/hoàn tiền xám), bảng độ rộng ADR-024.
- Spec luồng mua (M8) theo ADR-061: trạng thái hiển thị "Chờ người bán xác nhận", luồng khách vãng lai, action mới.

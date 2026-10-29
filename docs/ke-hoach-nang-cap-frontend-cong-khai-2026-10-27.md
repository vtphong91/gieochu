# Kế hoạch nâng cấp frontend công khai — 2026-10-27

> **Người viết:** Long (tài liệu), theo brief của Quốc ngày 2026-10-27. **Cập nhật 2026-10-27:** chủ dự án đã chốt mọi câu hỏi — Quốc ghi thành
> **ADR-064** (`docs/DECISIONS.md`). Mục 5 ghi đáp án; mục 3, 4 đã sửa theo đáp án.
> **Đầu vào:** bản phân tích của Phong `docs/phan-tich-layout-frontend-cong-khai-2026-10-27.md`; ADR-024 (độ rộng layout), ADR-025 (trang hệ thống),
> ADR-029 (bài viết M10b), ADR-040 (chỉ gian hàng đang hoạt động mới hiện nội dung), ADR-050 (menu CMS), ADR-060 (trang tuỳ chỉnh Markdown), **ADR-064**;
> `UI-Design-System`, đặc tả bài viết `Posts-Specs`. Long có đối chiếu thêm danh sách slug dành riêng và cách tạo slug trong code (mục 4).
> **Tình trạng:** kế hoạch **đã chốt**, chưa code. KB và bản trích ADR cập nhật khi từng giai đoạn có code.
> Ảnh mẫu: `images/7.png` = blog hệ thống · `images/8.png` = blog của gian hàng · `images/9.png` = trang một bài viết.
> Thuật ngữ kỹ thuật được giải thích ở **Phụ lục A**.

---

## 1. Mục tiêu và phạm vi

### 1.1. Mục tiêu
Trang công khai của Gieo Chữ (trang ai cũng xem được, không cần đăng nhập) trông **chỉn chu và đồng bộ** hơn, **dễ đọc trên điện thoại**:
- Mọi trang có cùng phần đầu trang, chân trang, đường dẫn "Trang chủ › …", cỡ tiêu đề.
- Phần chữ đọc dài (bài viết, chính sách) có độ rộng vừa mắt: khoảng **65–75 chữ cái mỗi dòng**; chữ **16px** trên điện thoại, **18px** cho bài viết trên máy tính.
- Có **blog** đẹp như ảnh mẫu, dẫn người đọc tới tài liệu để mua/tải.

### 1.2. Làm trong đợt này
1. **Khung chung** cho các trang công khai: trang chính sách, trang tuỳ chỉnh (`/p/...`), cửa hàng, bảng giá, trang gian hàng, trang tài liệu, thanh toán.
2. **Trang một bài viết** mới theo ảnh 9.
3. **Blog của từng gian hàng** theo ảnh 8 ở `/blog/{gian-hàng}`: mọi bài của **chính gian hàng đó**; trang bán hàng của gian hàng thêm section **"Bài viết nổi bật"** (4 thẻ).
4. **Blog của hệ thống** theo ảnh 7 ở `/blog`: bài hệ thống **và** bài của các gian hàng đang hoạt động có tiêu đề + ảnh.
5. **Trang lưu trữ theo danh mục** `/blog/danh-muc/{danh-mục}`.

### 1.3. KHÔNG làm (ADR-064)
- **GĐ6 không làm:** bình luận, đăng ký nhận tin qua email, ô tìm kiếm bài viết.
- **Quảng cáo / banner** chen trong bài (chỗ đó dành cho "Tài liệu liên quan").
- **Nút chia sẻ khác** ngoài Facebook, Pinterest, LinkedIn, X (không nút của điện thoại, không "Sao chép liên kết", không Zalo).
- **Đổi giao diện khu quản trị** (System Center, Studio) — chỉ thêm các ô cần cho CMS mới (và cỡ chữ editor 16px).
- **Trang link chia sẻ** `/s/...` và **trang chủ hệ thống** — không đổi bố cục, chỉ chuyển sang khung chung (GĐ0b).
- **Đổi màu thương hiệu, font chữ.** Giữ nền kem, xanh navy, cam cho nút. Không dùng tím.
- **Tác giả là từng người** (giáo viên A, nhân viên B): "tác giả" là **gian hàng**, hoặc **tên hiển thị tuỳ chỉnh** cho bài hệ thống.

---

## 2. Nguyên tắc

1. **CMS trước, UI sau** (chủ dự án chốt 2026-10-17): nội dung mới (danh mục, bài hệ thống, phần đầu trang blog, tên tác giả bài hệ thống) phải **quản trị được trong System
   Center/Studio trước**, rồi mới dựng trang công khai đọc từ đó.
2. **UX trước UI:** mỗi giai đoạn chốt luồng đọc và dữ liệu trước, rồi mới đến màu sắc, hiệu ứng.
3. **Mỗi giai đoạn deploy độc lập:** làm xong một giai đoạn là đưa lên được, không phải chờ giai đoạn sau.
4. **Cơ sở dữ liệu chỉ được thêm** (expand-only, ADR-034): chỉ thêm bảng, thêm cột cho phép trống. Không xoá, không đổi tên. Mọi lần đổi cơ sở dữ liệu (và mọi lần ghi dữ liệu
   hàng loạt như sinh slug cho bài cũ) cần Quốc duyệt trước khi chạy — dev và production dùng chung một database.
5. **Không gõ cứng thương hiệu:** tên, logo, khẩu hiệu đọc từ cấu hình hệ thống (ADR-032). Hiện trang `/p/...` còn chữ "G" gõ cứng — sửa ở GĐ0a.
6. **Điện thoại là ưu tiên đầu:** kiểm ở **375px** trước, rồi mới đến máy tính. Mọi nút bấm cao ít nhất **44px**.
7. **Không phá địa chỉ đang có:** URL cũ giữ nguyên hoặc **chuyển hướng 301** sang URL mới.
8. **Không tin giao diện về quyền:** trang nào đọc bài của gian hàng phải tự lọc (gian hàng ACTIVE, bài đã đăng) — không chỉ dựa vào RLS.

---

## 3. Các giai đoạn

### 3.1. Thay đổi so với 7 giai đoạn của Phong — và lý do
| Phong | Kế hoạch này | Lý do |
| :-- | :-- | :-- |
| GĐ0 (một giai đoạn) | **GĐ0a** + **GĐ0b** | GĐ0 của Phong động tới ~10 trang cùng lúc. **GĐ0a** gồm phần lỗi rõ nhất, ít rủi ro (`/p/...`, cửa hàng, bảng giá, thanh toán, 2 trang bài viết). **GĐ0b** gồm trang chủ, trang gian hàng, trang tài liệu — trang bán hàng chính, cần kiểm kỹ hơn (trang gian hàng có màu riêng). |
| GĐ1 | Giữ nguyên | Không đổi cơ sở dữ liệu. |
| GĐ2 (single post) | Giữ, **thêm slug bài gian hàng + địa chỉ `.html` + chuyển hướng** | ADR-064 đổi địa chỉ bài gian hàng sang `/{gian-hàng}/{tên-bài}.html` — cần cột slug (migration chỉ thêm cột). Làm cùng trang bài mới để chỉ đổi địa chỉ một lần. |
| GĐ3 (blog tenant) | Giữ, **thêm địa chỉ `/blog/{gian-hàng}` + section "Bài viết nổi bật" + chuyển hướng `/posts`** | ADR-064 Q14, Q13. Địa chỉ `/blog/...` cần `blog` là slug dành riêng — việc này đưa lên **GĐ3** (sớm hơn kế hoạch cũ ở GĐ5a). |
| GĐ4 | **GĐ4a** (CMS) + **GĐ4b** (giao diện) | Đúng "CMS trước, UI sau": có danh mục thật rồi mới hiện chip. |
| GĐ5 | **GĐ5a** (CMS bài hệ thống + trang Blog) + **GĐ5b** (trang `/blog`, bài hệ thống, lưu trữ danh mục) + **GĐ5c** (bài gian hàng lên blog hệ thống) | 5a có bảng mới; 5c đọc dữ liệu nhiều gian hàng — rủi ro lộ dữ liệu cao nhất, làm riêng, cuối cùng. Từ ADR-064 Q1, 5c **không cần** nút đề xuất/duyệt (lấy tự động) nên **không đổi cơ sở dữ liệu**. |
| GĐ6 | **Không làm** (ADR-064) | Chủ dự án chốt. |

### 3.2. Bảng giai đoạn

Ký hiệu công sức (🟡 ước lượng của Long, chưa có Hiếu/Phong xác nhận): **S** ≈ 1–2 ngày · **M** ≈ 3–5 ngày · **L** ≈ 1–2 tuần.
"Tiêu chí xong" chung cho **mọi** giai đoạn — **[XONG-CHUNG]**:
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:count` đạt (không tự thêm/bớt test nếu chưa được duyệt).
- Kiểm a11y theo checklist §12 của Phong (một H1, đường dẫn có `aria-current`, tương phản chữ ≥ 4.5:1, nút ≥ 44px, không chỉ dùng màu để báo trạng thái).
- Xem thật ở **375px** và **máy tính (1280px)**; không cuộn ngang ở 375px; đủ trạng thái đang tải / trống / lỗi / không tìm thấy.
- Quốc xem `git diff`; Long cập nhật KB (UI-Design-System, đặc tả liên quan, KB-Audit; bản trích ADR-064 khi giai đoạn đầu có code).

| GĐ | Người dùng thấy gì | Trang bị ảnh hưởng | Ai làm | Đổi CSDL? | Theo quyết định | Công sức | Tiêu chí xong riêng (ngoài [XONG-CHUNG]) |
| :-- | :-- | :-- | :-- | :-: | :-- | :-: | :-- |
| **0a. Khung chung — đợt 1** | Trang tuỳ chỉnh `/p/...` có đầu/chân trang như mọi trang (hết chữ "G" gõ cứng); nút CTA ở `/p/...` dễ đọc hơn; cửa hàng có nút "Bỏ qua tới nội dung"; 2 trang bài viết có màn chờ, màn lỗi | `/p/[slug]`, `/cua-hang`, `/pricing`, `/{gian-hàng}/checkout/*`, `/{gian-hàng}/posts`, `/{gian-hàng}/posts/{id}` | Phong (Quốc duyệt) | Không | Q-A: nền kem cho trang hệ thống | M | Footer luôn ở đáy kể cả trang ngắn; chỉ còn **một** khung chung (`PublicPageShell`); URL không đổi; tên thương hiệu đọc từ cấu hình |
| **0b. Khung chung — đợt 2** | Trang chủ, trang gian hàng, trang tài liệu dùng cùng khung; đường dẫn "Trang chủ › …" cùng kiểu; tiêu đề trang cùng thang cỡ chữ | `/`, `/{gian-hàng}`, `/{gian-hàng}/{tài-liệu}`, 7 trang chính sách | Phong | Không | Q-A: trang gian hàng **giữ nền trắng** | M | Trang gian hàng giữ màu riêng (chỉ khung ngoài đổi); "Mua ngay" và luồng mua không đổi |
| **1. Chữ đọc dài** | Chính sách, trang tuỳ chỉnh, bài viết dùng chung kiểu chữ dễ đọc: **16px** điện thoại; máy tính **17px** cho chính sách/trang tuỳ chỉnh và **18px** cho bài viết; ~75 ký tự/dòng. FAQ ở `/p/...` bấm mở/đóng; bảng giá trong `/p/...` tối đa 2 cột. **Editor bài viết Studio lên 16px** | 7 trang chính sách, `/p/[slug]`, chi tiết bài viết, editor bài viết Studio | Phong | Không | Q12, Q-B | M | Đo ≤ ~75 ký tự/dòng ở máy tính; chữ thân ≥ 16px ở 375px; mục lục, bản in của trang chính sách không hỏng; editor và trang xem cùng cỡ chữ |
| **2. Trang một bài viết của gian hàng + địa chỉ mới** | Bài viết như ảnh 9: đường dẫn, ảnh bìa, "N phút đọc", mục lục (bài dài), nút chia sẻ **Facebook, Pinterest, LinkedIn, X**, hộp giới thiệu gian hàng, thẻ **"Tài liệu liên quan"** đi theo khi cuộn (máy tính), "Bài khác của gian hàng". **Địa chỉ mới** `/{gian-hàng}/{tên-bài}.html`; địa chỉ cũ `/{gian-hàng}/posts/{id}` **chuyển hướng 301** | `/{gian-hàng}/{tên-bài}.html` (mới), `/{gian-hàng}/posts/{id}` (chỉ còn chuyển hướng), editor bài viết Studio (ô slug, tự sinh từ tiêu đề) | Hiếu (migration + dữ liệu + chuyển hướng), Phong (giao diện) | **Có** — thêm cột `slug` cho phép trống trên bài viết + ràng buộc **duy nhất trong từng gian hàng**; sinh slug cho bài cũ (script, Quốc duyệt) | Q11, Q-C, Q10, Q3 | L | Mọi bài cũ có slug và mở được bằng địa chỉ mới; link cũ (kể cả link trong email/đã chia sẻ) chuyển 301 đúng bài; bài không tiêu đề vẫn có slug hợp lệ; nút chia sẻ là link thường, không tải mã bên ngoài; điện thoại: thẻ tài liệu ngay sau nội dung |
| **3. Blog của gian hàng + "Bài viết nổi bật"** | Trang `/blog/{gian-hàng}` như ảnh 8: bài ghim thành bài nổi bật lớn, lưới bài gần đây, "Xem thêm bài viết", khối cuối trang "Xem tài liệu của {gian hàng}". Trang bán hàng `/{gian-hàng}` có section **"Bài viết nổi bật"** — **4 thẻ** (bài ghim trước, còn lại mới nhất) + nút **"Xem tất cả bài viết"**. `/{gian-hàng}/posts` **chuyển hướng 301** sang `/blog/{gian-hàng}` | `/blog/{gian-hàng}` (mới), `/{gian-hàng}/posts` (chỉ còn chuyển hướng), `/{gian-hàng}` (section mới, thay section "Bài viết" hiện có) | Phong + Hiếu (route, chuyển hướng, dữ liệu 4 thẻ) | Không | Q14, Q13 | M | Thêm `blog` vào slug dành riêng **và** Quốc đã quét DB không có gian hàng tên `blog` (mục 4.2); `/blog/{gian-hàng}` 404 khi gian hàng không ACTIVE (ADR-040); "Xem thêm" đổi địa chỉ (Back về đúng chỗ); chữ đè ảnh bài nổi bật đủ tương phản |
| **4a. Danh mục bài viết — phần quản trị** | System Admin tạo/sửa/tắt danh mục bài viết (**một bộ chung**); chủ gian hàng chọn danh mục (**không bắt buộc**) và **ảnh bìa tuỳ chọn** trong editor. Trang công khai chưa đổi | System Center ("Danh mục bài viết", mới); Studio → editor bài viết | Hiếu (CSDL + CMS), Phong (form) | **Có** — bảng danh mục mới; cột danh mục + ảnh bìa (+ mô tả ảnh) cho phép trống trên bài viết | Q4, Q5, Q7 | M | Bài cũ không danh mục / không ảnh bìa vẫn hiện bình thường (dùng ảnh đầu bài); chỉ System Admin sửa danh mục |
| **4b. Danh mục bài viết — giao diện** | Chip danh mục trên blog gian hàng (lọc được), nhãn danh mục trên thẻ bài và trang bài viết; ảnh bìa riêng được dùng khi có | `/blog/{gian-hàng}` (`?danh-muc=`), `/{gian-hàng}/{tên-bài}.html`, section "Bài viết nổi bật" | Phong + Hiếu (lọc) | Không | — (dùng 4a) | S | Chip đang chọn có dấu ✓; chip cuộn ngang ở 375px, bấm được bằng bàn phím; danh mục tắt không hiện |
| **5a. Blog hệ thống — quản trị** | System Admin viết **bài hệ thống** (cùng editor, có slug) và chỉnh "Trang Blog": tiêu đề, mô tả, khối kêu gọi cuối trang, SEO, **tên tác giả hiển thị** cho bài hệ thống, **ô "Bài nổi bật" chọn tay**; có nháp/xuất bản. Trang công khai chưa mở | System Center: "Bài viết hệ thống", "Trang Blog" | Hiếu (CSDL + CMS), Phong (form) | **Có** — bảng bài hệ thống mới (riêng, không chung bảng bài gian hàng; slug duy nhất toàn hệ thống) | Q-D, Q-E, Q10 | L | Tên tác giả lấy từ CMS, logo lấy từ thương hiệu hệ thống (không gõ cứng) |
| **5b. Blog hệ thống — trang công khai** | Trang `/blog` như ảnh 7 (phần đầu từ CMS, chip danh mục, **bài nổi bật chọn tay ở đầu**, còn lại **mới nhất trước**, "Xem thêm", khối kêu gọi); trang bài hệ thống `/blog/{tên-bài}.html`; **trang lưu trữ danh mục** `/blog/danh-muc/{danh-mục}` | `/blog`, `/blog/{tên-bài}.html`, `/blog/danh-muc/{danh-mục}`; System Admin tự thêm "Blog" vào menu qua CMS | Phong + Hiếu | Không | Q3, Q-E | M | Bài/danh mục tắt hoặc chưa đăng → 404; mỗi bài **một** địa chỉ chuẩn (canonical); trang có SEO từ CMS; `/blog/{gian-hàng}` (GĐ3) và `/blog/{tên-bài}.html` không lẫn nhau (mục 4.3) |
| **5c. Bài gian hàng lên blog hệ thống** | `/blog` và trang lưu trữ danh mục **tự động** hiện thêm mọi bài đã đăng của gian hàng **ACTIVE** có **tiêu đề và ảnh**, trộn với bài hệ thống theo thứ tự mới nhất; kèm logo + tên gian hàng; bấm vào mở **đúng bài gốc** `/{gian-hàng}/{tên-bài}.html` | `/blog`, `/blog/danh-muc/*` | Hiếu (truy vấn + test), Phong (thẻ có nhãn gian hàng); Quốc duyệt lọc dữ liệu | Không | Q1, Q-E | M | **Chỉ** gian hàng ACTIVE + bài đã đăng + có tiêu đề + có ảnh (đầu bài hoặc ảnh bìa); bài gian hàng tạm ngưng/khoá **không bao giờ** lộ (mục 4.1); không lộ email/tên thật người viết |
| **6. Tìm kiếm, nhận tin, bình luận** | — | — | — | — | Q6, Q8, Q9 | — | **Không làm** (ADR-064) |

Thứ tự: 0a → 0b → 1 → 2 → 3 → 4a → 4b → 5a → 5b → 5c. GĐ0b và GĐ1 có thể đổi chỗ. Phong có thể dựng giao diện GĐ3 trong lúc Hiếu làm migration + chuyển hướng GĐ2,
nhưng **deploy GĐ3 sau GĐ2** (section "Bài viết nổi bật" và blog gian hàng link tới địa chỉ `.html` mới).

---

## 4. Rủi ro và điểm cần kiểm chứng

### 4.1. Lộ bài của gian hàng không còn hoạt động (RLS) — rủi ro cao nhất, ở GĐ5c (và GĐ3)
- RLS hiện **cho phép đọc** bài đã đăng của gian hàng **tạm ngưng (READ_ONLY)**; chỉ chặn gian hàng **bị khoá**. Quy tắc ứng dụng (ADR-040) **không** cho khách xem nội dung
  của gian hàng tạm ngưng.
- Blog hệ thống đọc bài của **nhiều** gian hàng cùng lúc. ADR-064 Q1 chốt **lọc ở code**: gian hàng ACTIVE + bài đã đăng + có tiêu đề + có ảnh — không chỉ dựa vào RLS.
  Quốc quyết thêm có siết RLS cho khớp ADR-040 không.
- `/blog/{gian-hàng}` (GĐ3) cũng phải 404 khi gian hàng không ACTIVE, như `/{gian-hàng}/posts` hiện nay.
- Bài bị ẩn do vi phạm (HIDDEN) bị loại vì không còn "đã đăng" — kiểm lại bằng dữ liệu thật.
- **Kiểm chứng:** gian hàng tạm ngưng có bài đã đăng (có tiêu đề + ảnh) → không xuất hiện ở `/blog`, `/blog/danh-muc/*`, `/blog/{gian-hàng}`.

### 4.2. Tên địa chỉ trùng với gian hàng (slug dành riêng)
- Trang gian hàng nằm ở `/{tên-gian-hàng}`. Thêm trang `/blog` cấp gốc mà đã có gian hàng tên `blog` thì gian hàng đó **mất trang**.
- Long đối chiếu code 2026-10-27 (`RESERVED_SLUGS`, `packages/core/src/tenant/slug.ts`): **`danh-muc` đã có** (từ ADR-035); **`blog` chưa có**.
- **Bắt buộc trước khi mở `/blog` (GĐ3):** thêm `blog` vào `RESERVED_SLUGS` (giữ `danh-muc`); Quốc **quét DB production** xem có gian hàng tên `blog`/`danh-muc`; nếu có thì xử lý
  trước.
- `/blog/danh-muc/{…}` và `/blog/{gian-hàng}` dùng chung tiền tố `/blog/`: vì `danh-muc` là slug dành riêng, không gian hàng nào tên `danh-muc` nên không lẫn.

### 4.3. Đuôi `.html` để phân biệt bài viết với trang gian hàng / trang tài liệu
- Bài gian hàng `/{gian-hàng}/{tên-bài}.html` dùng **cùng vị trí địa chỉ** với trang tài liệu `/{gian-hàng}/{tên-tài-liệu}` (route `app/[tenantSlug]/[productSlug]`).
  Route này **phải nhận diện đuôi `.html`**: có đuôi → tìm bài viết; không có → tìm tài liệu như hiện nay.
- Không trùng được vì slug gian hàng và slug tài liệu chỉ gồm `a-z0-9-` — **không có dấu chấm**. Long đối chiếu: hàm `slugify` (`packages/core/src/tenant/slug.ts`) chỉ sinh
  `a-z0-9-` ✅ code. Hiếu cần kiểm thêm: mọi nơi **lưu** slug gian hàng/tài liệu đều ép đúng tập ký tự này (không chỉ khi tự sinh) 🟡.
- Tương tự `/blog/{tên-bài}.html` (bài hệ thống) và `/blog/{gian-hàng}` (blog gian hàng) phân biệt bằng đuôi `.html`.
- Slug bài viết duy nhất **trong phạm vi**: bài hệ thống duy nhất toàn hệ thống; bài gian hàng duy nhất **trong từng gian hàng** (hai gian hàng có bài cùng tên được).
- Slug bài viết **không** được trùng tên các route tĩnh dưới `/{gian-hàng}/` (`checkout`, `posts`…) — với đuôi `.html` thì không trùng, nhưng Hiếu nên chặn slug rỗng.

### 4.4. Đổi địa chỉ — chuyển hướng 301 và SEO
- Địa chỉ cũ `/{gian-hàng}/posts` → `/blog/{gian-hàng}` (GĐ3) và `/{gian-hàng}/posts/{id}` → `/{gian-hàng}/{tên-bài}.html` (GĐ2): **301**. Kiểm cả link trong email đã gửi
  và link đã chia sẻ.
- Bài **cũ chưa có slug**: GĐ2 phải sinh slug cho toàn bộ bài trước khi bật chuyển hướng (ghi dữ liệu hàng loạt trên DB dùng chung — Quốc duyệt, chạy script có chạy thử).
  Bài chưa có slug vì lý do nào đó → địa chỉ cũ vẫn phải mở được (không 404).
- Bài gian hàng chỉ có **một** địa chỉ chuẩn: `/{gian-hàng}/{tên-bài}.html`. Blog hệ thống **chỉ link tới** địa chỉ này — không dựng bản thứ hai dưới `/blog`.
- Đổi slug một bài sau khi đã đăng: cần quy tắc (giữ slug cũ để chuyển hướng hay không) — Hiếu đề xuất, Quốc duyệt ở GĐ2.
- Trang "Xem thêm" (trang 2, 3…) cần quy tắc canonical — Hiếu đề xuất, Quốc duyệt. Kế hoạch SEO tổng thể vẫn hoãn (chủ dự án chốt 2026-10-24).

### 4.5. Không phá chức năng đang có
- Giữ nguyên: 7 trang chính sách ở cấp gốc, `/phap-ly/*` (308), `/p/{slug}`, `/cua-hang`, `/pricing`, luồng thanh toán (ADR-061/062), trang tài liệu `/{gian-hàng}/{tài-liệu}`.
- GĐ0a/0b chỉ đổi phần khung ngoài — luồng mua, "Mua ngay", trang thanh toán **không** đổi hành vi.
- Trang chính sách (mục lục, bản in, nút lên đầu) phải giữ đủ chức năng khi tách thành khung chung ở GĐ1.
- GĐ3 thay section "Bài viết" hiện có trên trang gian hàng bằng "Bài viết nổi bật" — kiểm cấu hình section cũ của các gian hàng không bị mất.

### 4.6. Khác
- **Tương phản màu:** chữ cam nhỏ trên nền sáng không đạt chuẩn (ảnh 7) — Phong đổi sang chip nền nhạt chữ đậm. Nút CTA ở `/p/...` (≈ 3.2:1) sửa ở GĐ0a.
- **Ảnh nặng trên mạng chậm:** bỏ ảnh minh hoạ lớn ở phần đầu blog hệ thống; ảnh dưới màn đầu tải chậm (lazy).
- **Nút chia sẻ** chỉ là link thường tới Facebook, Pinterest, LinkedIn, X — không tải mã bên thứ ba (CSP, ADR-016). Pinterest cần ảnh của bài trong link.
- **Ngân sách test:** trần **100 unit / 66 integration** đã chạm. GĐ2 (slug + chuyển hướng), 4a, 5a, 5c nhiều khả năng cần thêm test → **chủ dự án duyệt nâng trần** trước.
- **Một database dùng chung** dev/production (ADR-034): migration ở GĐ2, 4a, 5a chỉ thêm; Quốc duyệt và chạy.

---

## 5. Câu hỏi — đáp án đã chốt (ADR-064, 2026-10-27)

Xếp theo giai đoạn cần. Q1–Q13 của Phong; Q14, Q-A…Q-E của Long. Chi tiết: **ADR-064** trong `docs/DECISIONS.md`.

| Câu | Nội dung hỏi | Đáp án đã chốt | Giai đoạn |
| :-- | :-- | :-- | :-- |
| **Q-A** | Nền trang công khai | Trang hệ thống **nền kem**; trang gian hàng **giữ nền trắng** | 0a, 0b |
| **Q12** | Cỡ chữ editor bài viết Studio | **16px**, khớp trang xem | 1 |
| **Q-B** | Chữ thân bài viết trên máy tính | **18px** (16px trên điện thoại) | 1 |
| **Q11** | Hiện "N phút đọc" | **Có**, tự tính | 2 |
| **Q-C** | Nút chia sẻ | **Chỉ Facebook, Pinterest, LinkedIn, X**, link thường, không mã bên thứ ba, không nút khác | 2 |
| **Q10** | Slug thay mã số | **Có cho cả hai**: bài hệ thống `/blog/{tên-bài}.html`, bài gian hàng `/{gian-hàng}/{tên-bài}.html`; slug duy nhất trong phạm vi | 2, 5a |
| **Q3** | Địa chỉ blog | `/blog`, `/blog/danh-muc/{danh-mục}`, `/blog/{tên-bài}.html`, `/blog/{gian-hàng}`, `/{gian-hàng}/{tên-bài}.html` | 2, 3, 5b |
| **Q13** | Đổi `/posts` | **Có**: `/{gian-hàng}/posts` → `/blog/{gian-hàng}`, `/{gian-hàng}/posts/{id}` → `/{gian-hàng}/{tên-bài}.html`, **301** | 2, 3 |
| **Q14** | "Chỉ bài do chủ gian hàng viết" | Blog gian hàng = mọi bài của **chính gian hàng đó**; trang bán hàng thêm section **"Bài viết nổi bật"** (4 thẻ: ghim trước, còn lại mới nhất) + nút "Xem tất cả bài viết" | 3 |
| **Q4** | Danh mục chung hay riêng | **Một bộ chung** do System Admin quản lý | 4a |
| **Q5** | Bắt buộc chọn danh mục | **Không bắt buộc** | 4a |
| **Q7** | Ô ảnh bìa riêng | **Có, tuỳ chọn**; không chọn → ảnh đầu bài | 4a |
| **Q-D** | Tác giả bài hệ thống | **Tên hiển thị tuỳ chỉnh trong CMS**, logo = logo thương hiệu | 5a |
| **Q-E** | Thứ tự bài blog hệ thống | Ô **"Bài nổi bật" chọn tay** ở đầu; còn lại **mới nhất trước**, trộn bài hệ thống + gian hàng | 5a, 5b |
| **Q1** | Blog hệ thống lấy bài gian hàng nào | **Tự động** mọi bài đã đăng của gian hàng **ACTIVE** có **tiêu đề và ảnh** (lọc ở code) | 5c |
| **Q2** | Cách đưa bài gian hàng lên | **Không cần** (Q1 lấy tự động — không đề xuất/duyệt) | — |
| **Q6** | Đăng ký nhận tin | **Không làm** (GĐ6) | — |
| **Q8** | Ô tìm kiếm | **Không làm** (GĐ6) | — |
| **Q9** | Bình luận | **Không làm** (GĐ6) | — |

### 5.1. Việc Quốc quyết (kỹ thuật) — còn mở
- Bổ sung ADR-024: chuẩn độ rộng chữ đọc dài **38em** và lưới bài viết có cột bên (`article-grid`) — Phong đề xuất §3.3.
- Có siết RLS bài viết theo ADR-040 không (mục 4.1).
- Quy tắc khi đổi slug bài đã đăng; canonical trang "Xem thêm" (mục 4.4).
- Nhãn cố định của giao diện ("Bài viết gần đây", "Xem thêm bài viết", "phút đọc") để trong code — Quốc xác nhận theo nguyên tắc "CMS trước, UI sau".
- Nâng trần số test cho GĐ2/4a/5a/5c — chủ dự án duyệt, Quốc trình.

---

## 6. Bắt đầu

**Bắt đầu ngay: GĐ0a — Khung chung đợt 1.** Không đổi cơ sở dữ liệu, không thêm địa chỉ, Q-A đã chốt. Sửa ngay các lỗi rõ nhất (`/p/...` thiếu đầu/chân trang và gõ cứng chữ
"G", nút CTA không đủ tương phản, cửa hàng thiếu nút "Bỏ qua tới nội dung", 2 trang bài viết thiếu màn chờ/màn lỗi). Là nền cho mọi giai đoạn sau.

**Chuẩn bị song song (không chặn GĐ0a):**
1. Quốc quét DB production tìm gian hàng tên `blog` / `danh-muc` (cần trước GĐ3).
2. Hiếu kiểm mọi nơi lưu slug gian hàng/tài liệu ép tập `a-z0-9-` (cần trước GĐ2 — mục 4.3).
3. Quốc trình chủ dự án nâng trần test cho GĐ2 (slug + chuyển hướng).

---

## Phụ lục A — Thuật ngữ

| Thuật ngữ | Nghĩa trong tài liệu này |
| :-- | :-- |
| **CMS** | Phần quản trị nội dung trong System Center/Studio — nơi người dùng tự sửa chữ, ảnh, danh mục mà không cần lập trình viên |
| **Frontend công khai** | Các trang ai cũng xem được trên web, không cần đăng nhập |
| **Single post** | Trang hiện **một** bài viết đầy đủ |
| **Trang lưu trữ danh mục** | Trang liệt kê mọi bài thuộc một danh mục |
| **Khung trang (`PublicPageShell`)** | Phần dùng chung bọc mọi trang: đầu trang, chân trang, nút "Bỏ qua tới nội dung" |
| **`ProseLayout` / `ArticleLayout` / `ListingLayout`** | 3 kiểu bố cục Phong đề xuất: trang đọc dài (chính sách) · trang một bài viết có cột bên · trang danh sách bài |
| **`.gieochu-prose`** | Một bộ kiểu chữ dùng chung cho mọi nội dung đọc dài |
| **Breadcrumb** | Dòng đường dẫn "Trang chủ › Blog › Tên bài" |
| **TOC** | Mục lục tự động của bài, dựng từ các tiêu đề trong bài |
| **Canonical** | Địa chỉ "chính thức" của một trang, báo cho Google khi cùng nội dung mở được từ nhiều nơi |
| **Slug** | Phần chữ trong địa chỉ web, ví dụ `blog`, `cach-on-thi` |
| **Đuôi `.html`** | Phần cuối địa chỉ bài viết (`cach-on-thi.html`) — giúp hệ thống biết đây là bài viết, không phải trang gian hàng hay trang tài liệu |
| **Chuyển hướng 301** | Khi mở địa chỉ cũ, trình duyệt tự chuyển sang địa chỉ mới và Google ghi nhận địa chỉ mới là chính thức |
| **RESERVED_SLUGS** | Danh sách tên địa chỉ gian hàng không được đặt vì hệ thống đã dùng |
| **RLS** | Quy tắc trong cơ sở dữ liệu quyết định ai đọc được dòng dữ liệu nào (lớp bảo vệ dưới cùng) |
| **ACTIVE / READ_ONLY / LOCKED** | Trạng thái gian hàng: đang hoạt động / tạm ngưng (khách không thấy nội dung — ADR-040) / bị khoá |
| **Migration expand-only** | Đổi cơ sở dữ liệu theo kiểu chỉ **thêm** (bảng, cột), không xoá hay đổi tên |
| **L1 / L2** | Tầng dữ liệu: L1 = của hệ thống; L2 = của từng gian hàng (có lớp RLS) |
| **WYSIWYG** | Soạn thấy sao thì trang xem hiện vậy |
| **a11y** | Khả năng truy cập — người dùng bàn phím, trình đọc màn hình, người nhìn kém đều dùng được |
| **375px** | Bề rộng màn hình điện thoại phổ biến dùng để kiểm |

## Phụ lục B — Nguồn và mức xác minh

- ✅ Long đối chiếu code 2026-10-27: `RESERVED_SLUGS` có `danh-muc`, chưa có `blog`; `slugify` chỉ sinh `a-z0-9-`; ADR-029 mục 5 ghi "Feed xuyên tenant ngoài phạm vi"
  (ADR-064 thay câu này cho blog hệ thống); trần test 100/66.
- 🟡 Theo phân tích của Phong: hiện trạng khung trang, đo độ dài dòng, RLS cho bài của gian hàng READ_ONLY, tương phản nút `/p/...`.
- 🟡 Ước lượng công sức của Long — Hiếu/Phong xác nhận khi nhận brief từng giai đoạn. Việc mọi nơi lưu slug đều ép `a-z0-9-` chưa kiểm hết.
- ❓ Chưa quét DB production tìm gian hàng tên `blog`/`danh-muc` (Quốc).

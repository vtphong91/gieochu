# Gieo Chữ — Báo cáo phân tích & Kế hoạch chi tiết: Module Sản phẩm (Tenant Owner)

**Phạm vi tài liệu:** Chỉ phân tích + nghiên cứu + lên kế hoạch. **Không có thay đổi code nào đi kèm tài
liệu này.** Đây là bản để anh xem và quyết định trước khi triển khai sâu hơn.

**Liên quan:** M5 — Sản phẩm và File tài liệu (`docs/GIEOCHU_PROMPT_MVP_PHASE1.md` §8, dòng 1095-1176),
`docs/PLAN.md` (mục M5, đã "code xong — chờ verify R2 thật"), M10 — Social Feed và Đánh giá (đánh giá/rating
gắn vào sản phẩm nhưng thuộc module riêng, chưa làm).

---

## 1. Tóm tắt điều hành

Module Sản phẩm (tạo/quản lý sản phẩm ở Tenant Studio + trang sản phẩm công khai khách hàng nhìn thấy) là
**nơi duy nhất tạo ra doanh thu thật** trong toàn bộ hệ thống — mọi module khác (billing, payment, coupon,
đơn hàng, thư viện tải xuống) đều tồn tại để phục vụ việc một khách hàng nhìn thấy một trang sản phẩm và
quyết định mua. Gọi đây là "Core của hệ thống" là chính xác.

**Hiện trạng:** M5 đã "code xong" theo đúng nghĩa checklist đặc tả gốc (CRUD, upload, file scan, điều kiện
xuất bản — 6/6 unit + 4/4 integration test đều xanh). Nhưng đặc tả gốc M5 (viết ở giai đoạn lên khung MVP,
trước khi có style guide thương hiệu, trước khi các trang System Admin/Landing Page được nâng cấp UI trong
phiên làm việc gần đây) chỉ mô tả một CRUD tối thiểu — **không mô tả một trang sản phẩm thật sự có khả năng
bán hàng**. Kết quả là toàn bộ giao diện Studio quản lý sản phẩm và trang sản phẩm công khai hiện tại vẫn là
**HTML thuần chưa qua thiết kế** (`<input>`/`<textarea>` trần, không dùng lại bất kỳ component nào trong bộ
UI kit đã xây cho System Admin), và mô tả sản phẩm là **text thuần**, trong khi chính đặc tả gốc đã ghi rõ
yêu cầu "mô tả (rich text đã sanitize)" — nghĩa là bản thân module đang **thiếu cả một yêu cầu đã duyệt từ
đầu**, chưa nói tới việc nâng cấp thêm.

Báo cáo này: (1) chỉ ra hiện trạng cụ thể kèm 1 bug thật phát hiện được trong lúc rà soát, (2) tổng hợp
nghiên cứu từ các nền tảng tương đương (Teachers Pay Teachers, Gumroad, Payhip, và bối cảnh tài liệu giáo
dục Việt Nam), (3) đề xuất mô hình dữ liệu + cấu trúc UI mới, chia theo mức ưu tiên P0/P1/P2, và (4) liệt kê
rõ các điểm cần anh quyết định trước khi code (ảnh hưởng bảo mật/kiến trúc dữ liệu).

---

## 2. Hiện trạng — đọc trực tiếp từ code, không suy đoán

### 2.1 Mô hình dữ liệu hiện tại (`packages/db/prisma/schema.prisma`)

```prisma
model Product {
  id              String        @id @default(cuid(2))
  tenantId        String
  slug            String
  title           String
  description     String?          // plain text, không phải rich text
  type            ProductType   @default(OTHER)   // TEMPLATE | SLIDE | EBOOK | EXAM | OTHER
  coverImageKey   String?          // ĐÚNG 1 ảnh bìa duy nhất, không có gallery
  tags            String[]      @default([])
  priceVnd        Int           @default(0)
  salePriceVnd    Int?
  saleStartsAt    DateTime?
  saleEndsAt      DateTime?
  downloadLimit   Int           @default(5)
  status          ProductStatus @default(DRAFT)   // DRAFT | PUBLISHED | ARCHIVED
}

model ProductFile {
  id         String  @id
  productId  String
  objectKey  String  @unique
  fileName   String
  mimeType   String
  sizeBytes  Int
  sha256     String?
  scanStatus ProductFileScanStatus   // PENDING | CLEAN | REJECTED
  isPreview  Boolean @default(false) // cờ boolean duy nhất phân biệt file preview/file bán
  removedAt  DateTime?
}
```

Không có: ảnh phụ/gallery, mô tả có định dạng, "nội dung bên trong" có cấu trúc (số trang, số slide, định
dạng file, phiên bản...), rating/review (đúng — thuộc M10, chưa tới lượt), sản phẩm liên quan, FAQ, chính
sách đổi/hoàn, nhãn "Bán chạy"/"Mới", lịch sử cập nhật, số lượt đã bán hiển thị công khai.

### 2.2 Giao diện Studio quản lý sản phẩm

- `app/studio/[tenantSlug]/products/page.tsx` — danh sách dạng `<ul>` text thuần, không ảnh thumbnail,
  không tìm kiếm/lọc theo trạng thái, không phân trang (so sánh: các trang System Admin đã có sẵn component
  `DataTable` + `Pagination` dùng chung, nhưng Studio Product chưa từng được nối vào bộ đó).
- `app/studio/[tenantSlug]/products/[productId]/edit-form.tsx` — form `<input>`/`<textarea>` trần, mô tả là
  1 `<textarea rows={6}>` — không có toolbar định dạng, không có markdown preview, không giới hạn ký tự.
- Upload file: `upload-file-form.tsx` — chọn file, không thấy rõ nơi đánh dấu file nào là "preview" (cờ
  `isPreview` tồn tại ở schema nhưng cần xác nhận lại UI hiện có expose được cờ này cho owner chọn lúc upload
  hay không — thuộc phạm vi rà soát kỹ hơn khi bắt tay code, không đoán ở đây).
- Toàn bộ 3 trang này **chưa qua đợt nâng cấp UI/UX Pro Max** đã áp dụng cho System Admin trong phiên gần
  đây (sidebar nhóm, `kit.tsx`, `DataTable`, `Pagination`, màu thương hiệu) — đây là mảng UI cũ nhất còn sót
  lại trong toàn bộ Studio.

### 2.3 Trang sản phẩm công khai (`app/[tenantSlug]/products/[productSlug]/page.tsx`)

Trang hiện tại: 1 ảnh bìa, nhãn loại, tiêu đề, mô tả (`whitespace-pre-line` — plain text), giá (kèm giá sale
nếu có), 1 nút mua. Hết. Không có: gallery ảnh, preview nội dung file (không xem trước được vài trang PDF),
đánh giá/rating, số lượt đã mua, thông tin người bán (tên, ảnh đại diện, link cửa hàng), sản phẩm liên quan,
breadcrumb, FAQ, chia sẻ mạng xã hội, structured data cho SEO (`generateMetadata` chỉ có `title`/`description`
cơ bản, không có `openGraph`/`JSON-LD Product schema`).

### 2.4 Bug thật phát hiện được khi đọc code cho báo cáo này

**`TYPE_LABEL` ở trang sản phẩm công khai dùng sai key so với enum thật.**

- File: [`apps/web/app/[tenantSlug]/products/[productSlug]/page.tsx:9-16`](../apps/web/app/%5BtenantSlug%5D/products/%5BproductSlug%5D/page.tsx#L9-L16)
- `ProductType` enum thật (schema): `TEMPLATE | SLIDE | EBOOK | EXAM | OTHER`.
- `TYPE_LABEL` trên trang công khai lại map theo key: `PDF | DOCX | XLSX | PPTX | ZIP | OTHER` (đây là các
  định dạng FILE, không phải loại sản phẩm — có vẻ bị nhầm với danh sách định dạng cho phép ở §M5 đặc tả gốc).
- **Hệ quả:** với 4/5 loại sản phẩm thật (`TEMPLATE`, `SLIDE`, `EBOOK`, `EXAM`), nhãn hiển thị trên trang
  công khai luôn rơi về `product.type` thô (hiện chữ "TEMPLATE" thay vì "Mẫu / Template") vì không khớp key
  nào trong `TYPE_LABEL`. Trang Studio edit-form dùng đúng key (`TEMPLATE/SLIDE/EBOOK/EXAM/OTHER`) nên không
  bị lỗi này — chỉ trang công khai (nơi khách hàng thấy) bị.
- Đây là bug nhỏ, dễ sửa (đổi `TYPE_LABEL` cho khớp enum) — nêu ra để anh biết, **không sửa trong lượt này**
  vì tài liệu này chỉ phân tích; sẽ sửa cùng đợt code module này (hoặc sửa riêng ngay nếu anh muốn, chỉ cần
  báo).

---

## 3. Nghiên cứu thị trường

### 3.1 Teachers Pay Teachers (TpT) — đối chiếu gần nhất về mô hình kinh doanh

TpT là marketplace tài liệu giáo dục do giáo viên tạo ra bán cho giáo viên khác — **mô hình gần như giống hệt
Gieo Chữ** (creator cá nhân, sản phẩm là file tài liệu giáo dục, người mua là đồng nghiệp). Ghi nhận từ
seller blog chính thức của TpT:

- Ảnh bìa (cover) cần rõ ràng ở kích thước nhỏ (thumbnail trong kết quả tìm kiếm) — khác với ảnh preview chi
  tiết trong trang.
- Nội dung preview (ảnh minh hoạ bên trong tài liệu) có vai trò "chứng minh" giá trị sản phẩm — cho người
  mua thấy tài liệu sẽ tiết kiệm thời gian/công sức thế nào trước khi mua, không chỉ liệt kê tính năng suông.
- Giá có thể định giá cao hơn nếu sản phẩm có các yếu tố gia tăng giá trị: có bản phân hoá theo trình độ
  (differentiation), có kèm bộ đề kiểm tra/đánh giá.

### 3.2 Gumroad — checklist tối ưu trang sản phẩm (15 điểm, tổng hợp từ seller blog bên thứ 3, đối chiếu case
Gumroad thật)

1. Tiêu đề dạng "loại sản phẩm cụ thể, cho đối tượng cụ thể, kết quả chính".
2. Ảnh bìa là ảnh chụp thật sản phẩm, đọc được ở size nhỏ.
3. Mô tả mở đầu bằng vấn đề cụ thể người mua đang gặp, rồi liệt kê nội dung chi tiết.
4. **4–6 ảnh preview** góc nhìn khác nhau + video ngắn 2–4 phút (Gieo Chữ hiện: 1 ảnh, không video).
5. Tâm lý giá: 2 mức giá so sánh, hoặc 1 giá có căn cứ rõ ràng (Gieo Chữ đã có sale price — điểm này đã đạt
   một phần).
6. Bằng chứng xã hội: review/testimonial/số liệu cộng đồng (Gieo Chữ: chưa có — chờ M10).
7. FAQ: 5–7 câu hỏi thường gặp của người mua, trả lời ngay trên trang.
8. Chính sách hoàn tiền nêu rõ ràng ("hoàn tiền 7 ngày không cần lý do" hoặc tương đương).
9. Kiểm tra hiển thị tốt trên di động.
10. Tối ưu tốc độ tải (ảnh nén, video ngắn).
11. Tag/từ khoá đầy đủ để tăng khả năng được tìm thấy.
12. Khung "cuộc sống sau khi dùng sản phẩm" — mô tả kết quả, không chỉ tính năng.
13. Tín hiệu cập nhật gần đây (bản cập nhật dựa trên phản hồi người mua).
14. Bán chéo — gợi ý sản phẩm liên quan sau khi mua.
15. Kiểm tra "above the fold" — 4 câu hỏi chính của người mua phải trả lời được ngay khi chưa cuộn trang
    (đây là gì? giá bao nhiêu? ai bán? tại sao nên tin?).

### 3.3 Gumroad vs Payhip — điểm khác biệt đáng cân nhắc cho Gieo Chữ

- Payhip hỗ trợ **nhiều loại sản phẩm khác nhau ngay trong cùng 1 nền tảng**: digital product, course,
  membership, bundle, coaching service — mỗi loại có form nhập liệu khác nhau phù hợp bản chất sản phẩm.
  Gieo Chữ hiện chỉ có 1 `ProductType` enum dùng cho phân loại hiển thị, không ảnh hưởng cấu trúc form nhập
  liệu (form giống hệt nhau dù chọn `TEMPLATE` hay `EXAM`).
- Payhip có **PDF stamping** (đóng dấu định danh người mua vào file PDF, chống chia sẻ lại) và **giới hạn
  lượt tải** — Gieo Chữ đã có giới hạn lượt tải (`downloadLimit`) nhưng chưa có watermark/stamping.
- Cả hai đều hỗ trợ **bundle** (gộp nhiều sản phẩm bán 1 giá) — Gieo Chữ chưa có khái niệm này ở tầng sản
  phẩm (Coupon hiện tại giảm giá theo % / số tiền cố định, không phải "gộp bán").

### 3.4 Nghiên cứu CRO (Conversion Rate Optimization) tổng quát cho trang sản phẩm số

- Hình ảnh chất lượt cao là yếu tố quyết định mua hàng số 1 theo khảo sát người tiêu dùng — khuyến nghị tối
  thiểu 6 ảnh (chính diện, chi tiết, ngữ cảnh sử dụng, ảnh do khách hàng cung cấp).
- Sản phẩm có từ 5 đánh giá trở lên chuyển đổi tốt hơn đáng kể so với sản phẩm chưa có đánh giá nào — càng
  củng cố lý do M10 (đánh giá) nên được ưu tiên sớm sau module này, dù không nằm trong phạm vi module này.
- Mô tả sản phẩm hiệu quả trả lời đúng 3 câu hỏi: sản phẩm giải quyết vấn đề gì → người mua nhận được chính
  xác cái gì → vì sao nên tin sản phẩm này sẽ hiệu quả.
- CTA (nút mua) được tối ưu tốt có thể tăng chuyển đổi 10–15%.
- Phần lớn traffic thương mại điện tử hiện đến từ di động — trang sản phẩm bắt buộc phải tối ưu mobile-first
  (Gieo Chữ đã có nền Tailwind mobile-first sẵn từ trước, nhưng Studio Product chưa được kiểm tra riêng).

### 3.5 Bối cảnh Việt Nam — tài liệu.vn, 123docz, violet.vn, Unica/Kyna

Các nền tảng chia sẻ tài liệu học tập lớn tại Việt Nam (`tailieu.vn`, `123docz.net`, `violet.vn`) có mô hình
khác Gieo Chữ khá nhiều: đây là **kho tài liệu tổng hợp quy mô lớn** (nhiều người đóng góp, tìm kiếm theo từ
khoá, mô hình gần với "thư viện" hơn là "cửa hàng cá nhân"), không phải mô hình "1 giáo viên có 1 gian hàng
thương hiệu riêng" như Gieo Chữ đang xây (đúng với định vị "Tani-style Tenant Studio" đã theo suốt dự án).
Vì vậy các nền tảng này **không phải đối chiếu phù hợp cho thiết kế trang sản phẩm** (họ tối ưu cho khối
lượng và tìm kiếm, không tối ưu cho một trang bán hàng cá nhân hoá/thương hiệu hoá). Unica/Kyna (khoá học
video) gần hơn về mô hình "creator cá nhân bán qua nền tảng" nhưng sản phẩm là khoá học video, không phải
file tài liệu — cấu trúc trang khác biệt đủ lớn (cần progress tracking, video player) nên chỉ tham khảo được
phần bố cục tổng thể (banner, mô tả giảng viên, nội dung khoá học dạng mục lục — ý tưởng này áp dụng được
cho Gieo Chữ dưới dạng "mục lục nội dung file" thay vì "chương trình học").

**Kết luận định vị:** Gieo Chữ nên tham khảo TpT + Gumroad (creator cá nhân bán file số, có thương hiệu
riêng) là chính, không nên bắt chước tailieu.vn/123docz (mô hình thư viện đại chúng).

---

## 4. Ma trận so sánh tính năng

| Tính năng | Gieo Chữ hiện tại | TpT | Gumroad/Payhip | Đề xuất cho Gieo Chữ |
|---|---|---|---|---|
| Ảnh bìa | 1 ảnh, bắt buộc | Có | Có | Giữ, bắt buộc |
| Gallery ảnh preview | ❌ Không có | 4-10 ảnh | 4-6 ảnh | **P0** — thêm gallery nhiều ảnh |
| Mô tả | Plain text | Rich text | Rich text (Markdown/HTML) | **P0** — rich text có sanitize |
| Preview nội dung file (xem trước vài trang) | ❌ | Có (ảnh chụp) | Đôi khi (embed) | **P1** — ảnh preview do owner tự tải (đã có field `isPreview`, cần UI rõ hơn) |
| Video giới thiệu | ❌ | Không bắt buộc | Khuyến khích | **P2** — để sau, cần hạ tầng video riêng |
| Đánh giá/Rating | ❌ (thuộc M10) | Có, ảnh hưởng lớn tới chuyển đổi | Có | Ngoài phạm vi — chờ M10, nhưng **UI trang sản phẩm nên chừa chỗ sẵn** |
| Số lượt đã bán/tải | ❌ | Có hiển thị | Tuỳ chọn | **P1** — cân nhắc kỹ (§6.3 có bàn tới rủi ro) |
| Thông tin người bán trên trang sản phẩm | ❌ | Có (link hồ sơ seller) | Có | **P1** — tên tenant, mô tả ngắn, link cửa hàng |
| Sản phẩm liên quan | ❌ | Có | Có | **P1** |
| FAQ trên trang sản phẩm | ❌ | Không chuẩn hoá | Khuyến nghị | **P2** — có thể gộp vào rich text mô tả trước, tách riêng sau nếu cần |
| Chính sách hoàn tiền hiển thị | ❌ (có ở cấp platform, không hiện per-product) | Có | Có | **P1** — hiển thị chính sách chung, không cần field riêng/sản phẩm |
| Bundle nhiều sản phẩm 1 giá | ❌ | Có (giới hạn) | Có | **P2** — để sau, đổi mô hình Order/OrderItem |
| Watermark/PDF stamping chống chia sẻ | ❌ | Không | Payhip có | **P2** — backlog, cần thư viện xử lý PDF riêng |
| SEO (OpenGraph đầy đủ + JSON-LD Product) | 🟡 một phần (title/description cơ bản) | Có | Có | **P0** — chi phí thấp, giá trị cao |
| Mobile-first layout | 🟡 chưa kiểm tra riêng | Có | Có | **P0** — bắt buộc kiểm tra khi làm lại UI |
| Loại sản phẩm ảnh hưởng form nhập liệu | ❌ (chỉ ảnh hưởng nhãn hiển thị) | Không rõ | Có (Payhip) | **P2** — cân nhắc, có thể không cần thiết cho MVP |

---

## 5. Đề xuất mô hình dữ liệu (kèm lý do + mức ưu tiên)

Nguyên tắc chung: **không phá vỡ dữ liệu đã có** (mọi cột hiện tại giữ nguyên), chỉ thêm bảng/cột mới, đi kèm
migration Prisma đúng quy ước dự án. Tất cả đề xuất dưới đây **chưa migration**, chỉ là bản thiết kế chờ anh
duyệt.

### 5.1 P0 — Ảnh gallery (bảng mới, không dùng mảng string)

```prisma
model ProductImage {
  id         String   @id @default(cuid(2))
  productId  String
  product    Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  objectKey  String   // bucket PUBLIC, giống coverImageKey — không cần presign để hiển thị
  sortOrder  Int      @default(0)
  createdAt  DateTime @default(now())

  @@index([productId])
  @@map("product_images")
}
```

**Vì sao bảng riêng, không phải `String[]` như `tags`:** ảnh cần `sortOrder` (kéo-thả sắp xếp thứ tự hiển
thị) và cần xoá từng ảnh riêng lẻ — mảng string trong 1 cột JSON/array không hỗ trợ tốt việc này qua Prisma
migration an toàn, và không tận dụng được RLS theo dòng nếu sau này cần audit ai xoá ảnh nào. `coverImageKey`
trên `Product` **giữ nguyên** làm ảnh đại diện chính (dùng cho thumbnail danh sách/SEO), `ProductImage` là
gallery bổ sung hiển thị trong trang chi tiết.

### 5.2 P0 — Mô tả rich text: chọn Markdown giới hạn, không chọn HTML tự do

**Đây là quyết định cần anh xác nhận trước khi code — ảnh hưởng bảo mật (XSS surface).**

Hai phương án:

- **(A) Markdown giới hạn + sanitize** (khuyến nghị): giữ cột `description String?` hiện tại, nhưng cho
  phép cú pháp Markdown cơ bản (in đậm, in nghiêng, danh sách, tiêu đề phụ, link) khi hiển thị, sanitize
  server-side trước khi lưu. Đây **đúng là cách M10 (bài viết mạng xã hội) đã định làm** ("markdown giới hạn,
  sanitize" — §8, dòng 1577 đặc tả gốc) — dùng chung 1 thư viện sanitize cho cả 2 module (Product description
  + M10 Post content) là nhất quán kiến trúc, không phải phát minh 2 lần.
- **(B) Rich text WYSIWYG (HTML) + sanitize HTML output** (kiểu Notion/Google Docs editor nhúng): mạnh hơn,
  nhưng surface tấn công XSS rộng hơn nhiều (phải sanitize HTML kỹ hơn Markdown rất nhiều), và cần thêm 1 thư
  viện editor phía client (ví dụ Tiptap) — tăng đáng kể độ phức tạp UI cho lợi ích tăng thêm không quá lớn so
  với Markdown ở giai đoạn này.

→ **Đề xuất chọn (A)**, để dành (B) làm backlog nếu sau này thấy Markdown không đủ biểu cảm.

### 5.3 P1 — "Nội dung bên trong" có cấu trúc (thay vì chỉ mô tả tự do)

```prisma
model ProductHighlight {
  id        String  @id @default(cuid(2))
  productId String
  product   Product @relation(fields: [productId], references: [id], onDelete: Cascade)
  label     String  // ví dụ: "25 trang PDF", "Có đáp án chi tiết", "File Word chỉnh sửa được"
  sortOrder Int     @default(0)

  @@index([productId])
  @@map("product_highlights")
}
```

Đây chính là điểm #4 của Gumroad checklist ("liệt kê nội dung chi tiết") và mục lục nội dung kiểu Unica —
danh sách gạch đầu dòng ngắn, owner tự nhập, hiển thị nổi bật ngay trên trang (không chôn trong mô tả dài).
**Có thể gộp vào (A) ở §5.2** (chỉ cần Markdown list trong mô tả) nếu muốn giảm độ phức tạp — nêu ra đây như
một lựa chọn kiến trúc, không bắt buộc phải làm bảng riêng.

### 5.4 P1 — Thông tin người bán hiển thị trên trang sản phẩm

Không cần bảng mới — `Tenant` đã có `name`/`slug`/branding. Chỉ cần UI mới lấy đúng dữ liệu đã có (tenant
mô tả ngắn hiện đã có ở đâu chưa cần rà soát lại — nếu chưa có cột "mô tả ngắn cửa hàng" thì thêm 1 cột
`Tenant.shortBio String?`, rất nhỏ).

### 5.5 P1 — Sản phẩm liên quan

Không cần bảng quan hệ mới ở giai đoạn P1 — tính đơn giản: "sản phẩm khác cùng tenant, cùng `type`, đang
`PUBLISHED`, trừ chính nó, giới hạn 4". Đây là truy vấn thuần, không lưu trạng thái. Việc chọn tay "sản phẩm
liên quan cụ thể" (kiểu admin tự gắn) là P2, cần bảng quan hệ `ProductRelation` riêng nếu làm.

### 5.6 P2 — Số lượt đã bán hiển thị công khai

**Cần cân nhắc kỹ, không nên làm P0/P1 dù TpT có tính năng này:**

- Gieo Chữ đã có transaction/order log; đếm được `orderItems` với `order.status = FULFILLED` theo product —
  kỹ thuật không khó.
- Nhưng: (a) sản phẩm mới đăng sẽ hiện "0 lượt bán" — có thể phản tác dụng tâm lý (thiếu bằng chứng xã hội
  còn tệ hơn không hiện gì), (b) cần quyết định ngưỡng ẩn/hiện (ví dụ chỉ hiện khi ≥ 5, giống ngưỡng review
  của TpT/nghiên cứu CRO ở §3.4) — đây là quyết định sản phẩm (product decision), không phải kỹ thuật.

→ Đề xuất: để P2, quyết định cùng lúc với M10 (khi đã có review, 2 tín hiệu "bằng chứng xã hội" nên ra mắt
cùng đợt cho nhất quán UI, thay vì ra lẻ tẻ).

---

## 6. Đề xuất thiết kế lại UI

### 6.1 Studio — Trang danh sách sản phẩm

Nối vào đúng bộ UI kit đã xây cho System Admin (`apps/web/app/admin/_ui/kit.tsx`, `DataTable`, `Pagination`,
`RowMenu`) thay vì `<ul>` text thuần hiện tại — nhất quán trải nghiệm toàn hệ thống (đã áp dụng cho
Users/Tenants/CMS/Plans ở System Admin, Studio Product là mảng còn sót). Thêm: ảnh thumbnail nhỏ mỗi dòng,
lọc theo trạng thái (Nháp/Đã xuất bản/Đã lưu trữ), tìm kiếm theo tên, phân trang khi > 20 sản phẩm.

### 6.2 Studio — Trình biên tập sản phẩm (Product Editor)

Đề xuất tách 1 form dài hiện tại thành các **section rõ ràng** (giống mô hình đã dùng cho `BrandingEditor`
5-tab và `HomeSectionsEditor` 2-cột đã xây trong phiên gần đây — tái dùng đúng pattern, không phát minh mới):

1. **Thông tin cơ bản** — tiêu đề, slug (tự gợi ý, sửa được), loại, tags.
2. **Hình ảnh** — ảnh bìa (bắt buộc) + gallery (kéo-thả sắp xếp, xoá từng ảnh) — dùng lại chính
   `ImageUploadField`/luồng Cloudinary đã xây cho Branding/Landing Page CMS thay vì luồng R2 upload riêng
   biệt hiện tại của `cover-image-upload.tsx` **— đây là điểm cần bàn kỹ ở §7.1**, vì ảnh sản phẩm hiện đi
   qua R2 (đã có `presignCoverImageUpload`/bucket public), không phải Cloudinary.
3. **Mô tả** — Markdown editor tối giản (textarea + toolbar cơ bản + preview) theo quyết định §5.2(A).
4. **Nội dung nổi bật** — danh sách gạch đầu dòng ngắn (§5.3), tuỳ chọn.
5. **File tài liệu** — giữ nguyên luồng upload/presign/file.scan đã có, chỉ làm rõ UI: file nào là preview
   công khai (cờ `isPreview`), file nào là file bán, kèm trạng thái quét (PENDING/CLEAN/REJECTED) hiển thị
   rõ bằng Badge màu (tái dùng `Badge` component).
6. **Giá & khuyến mãi** — giữ nguyên logic hiện có (giá gốc, giá sale, khung thời gian), chỉ nâng cấp giao
   diện.
7. **Xuất bản** — hiển thị rõ checklist điều kiện xuất bản (`canPublishProduct()` đã có sẵn logic, chỉ cần
   UI hiển thị từng điều kiện đạt/chưa đạt dạng checklist trực quan thay vì chỉ báo lỗi chung chung khi bấm
   nút — đúng nguyên tắc `error-recovery`/`error-clarity` trong skill UI/UX đã dùng xuyên suốt dự án).

### 6.3 Trang sản phẩm công khai

Bố cục đề xuất (desktop 2 cột, mobile 1 cột dọc — đúng mobile-first):

```
┌─────────────────────────────┬──────────────────┐
│ Breadcrumb: Trang chủ > Loại  │                  │
│                               │  [Giá + nút Mua] │
│  [Gallery ảnh — carousel]     │  [Người bán card]│
│                               │  [Chính sách     │
│  Tiêu đề + loại + tags        │   hoàn tiền]     │
│                               │                  │
│  [Nội dung nổi bật — list]    │                  │
│                               │                  │
│  [Mô tả rich text]            │                  │
│                               │                  │
│  [Sản phẩm liên quan]         │                  │
└─────────────────────────────┴──────────────────┘
```

Cột phải sticky khi cuộn (đúng nguyên tắc "above-the-fold trả lời 4 câu hỏi chính" của Gumroad checklist —
giá/nút mua/người bán luôn nhìn thấy được). Chừa sẵn 1 khối vị trí "Đánh giá" ngay dưới mô tả (không render
gì cả cho tới khi M10 xong — chỉ là quyết định bố cục trước, tránh phải đảo layout khi M10 tới).

---

## 7. Vấn đề kỹ thuật cần quyết định trước khi code

Theo đúng kỷ luật đã áp dụng xuyên suốt dự án (mục 0.6 đặc tả gốc — dừng lại hỏi khi ảnh hưởng bảo
mật/kiến trúc dữ liệu), liệt kê rõ các điểm KHÔNG tự quyết:

### 7.1 Ảnh sản phẩm (gallery) đi qua R2 hay Cloudinary?

Hiện `coverImageKey` đi qua **Cloudflare R2** (bucket public, presign PUT giống file bán nhưng bucket khác),
trong khi ảnh Landing Page CMS/Branding vừa xây gần đây lại đi qua **Cloudinary** (theo yêu cầu tường minh
của anh ở phiên trước: *"Tôi sẽ sử dụng cloudinary để upload ảnh không qua Cloudflare R2"*). Hai lựa chọn:

- **(A)** Gallery ảnh sản phẩm tiếp tục dùng R2 (nhất quán với `coverImageKey` hiện tại, không cần đổi hạ
  tầng, nhưng UI upload sẽ khác kiểu UX với ImageUploadField/Cloudinary đã quen dùng ở Admin).
- **(B)** Chuyển toàn bộ ảnh sản phẩm (cả `coverImageKey` lẫn gallery mới) sang Cloudinary, đồng bộ 1 luồng
  upload ảnh duy nhất toàn hệ thống — nhưng đây là thay đổi hạ tầng cho dữ liệu **đã có sản phẩm thật đang
  dùng `coverImageKey` trỏ R2** (cần cân nhắc migration dữ liệu ảnh cũ, không đơn giản chỉ đổi code).

→ **Cần anh chọn** — đây là quyết định hạ tầng lưu trữ, ảnh hưởng chi phí (R2 free tier vs Cloudinary
free tier) và không đơn thuần là chọn thư viện.

### 7.2 Markdown hay HTML cho mô tả — đã đề xuất (A) Markdown ở §5.2, xin xác nhận

### 7.3 Có tính số lượt bán/hiển thị công khai không — đã đề xuất hoãn (P2, gộp với M10) ở §5.6, xin xác nhận

### 7.4 Preview nội dung file — có tự sinh ảnh xem trước từ PDF không, hay chỉ để owner tự tải ảnh preview thủ công?

Tự động sinh ảnh preview từ trang đầu file PDF (giống TpT) cần xử lý file phía server (convert PDF→ảnh) —
**chi phí kỹ thuật và hạ tầng đáng kể** (cần thư viện xử lý PDF, hoặc dịch vụ ngoài), so với việc chỉ để
owner tự tải ảnh preview thủ công (đơn giản, dùng lại đúng cờ `isPreview` đã có). Đề xuất: **giai đoạn này
chỉ làm thủ công** (owner tự tải/chọn ảnh preview), việc tự động sinh preview để backlog riêng.

### 7.5 Phạm vi test mới

Theo đúng kỷ luật "không đổi số lượng test mục 9 nếu chưa hỏi lại" — module này khi triển khai thật chắc
chắn cần thêm test mới (gallery CRUD, Markdown sanitize, điều kiện hiển thị sản phẩm liên quan...). Số lượng
chính xác **sẽ chốt lúc bắt tay code và xác nhận lại với anh trước khi tính vào tổng**, không ước lượng
trong tài liệu phân tích này.

---

## 8. Đề xuất phạm vi theo giai đoạn

| Giai đoạn | Nội dung | Vì sao |
|---|---|---|
| **P0 — Core rebuild** | Gallery ảnh, mô tả Markdown+sanitize, SEO metadata đầy đủ (OpenGraph + JSON-LD Product), nối Studio Product vào bộ UI kit chung, sửa bug `TYPE_LABEL` (§2.4), checklist điều kiện xuất bản trực quan | Đây là phần "phải có" để trang sản phẩm thật sự bán được — chi phí kỹ thuật vừa phải, giá trị cao nhất |
| **P1** | Nội dung nổi bật (highlight list), thông tin người bán trên trang sản phẩm, sản phẩm liên quan (truy vấn đơn giản, không bảng quan hệ) | Tăng chuyển đổi rõ rệt theo nghiên cứu CRO, chi phí kỹ thuật thấp |
| **P2 — Backlog, chưa làm đợt này** | Video giới thiệu, bundle nhiều sản phẩm, watermark/PDF stamping, tự động sinh preview PDF, số lượt bán công khai, loại sản phẩm ảnh hưởng form nhập liệu, sản phẩm liên quan chọn tay | Giá trị thấp hơn hoặc phụ thuộc module/hạ tầng chưa sẵn sàng (M10, xử lý PDF server-side) |

---

## 9. Rủi ro & đánh đổi cần lưu ý

- **XSS qua mô tả sản phẩm** — bất kể chọn Markdown hay HTML, sanitize sai một chỗ là có lỗ hổng thật (dữ
  liệu do tenant nhập, hiển thị công khai cho mọi khách hàng) — cần review kỹ thư viện sanitize dùng, viết
  test riêng cho các payload XSS phổ biến, không chỉ test "happy path".
- **Đổi hạ tầng ảnh (R2 vs Cloudinary, §7.1)** ảnh hưởng dữ liệu sản phẩm thật đã tồn tại — nếu chọn sai
  hướng sẽ phải migrate lại, không phải việc nhỏ.
- **Chi phí Cloudinary/R2 tăng theo số lượng ảnh** nếu gallery cho phép nhiều ảnh không giới hạn — nên có
  giới hạn số ảnh tối đa mỗi sản phẩm (ví dụ 8 ảnh, giống mức TpT/Gumroad khuyến nghị 4-10), tương tự cách
  `Plan.storageMb` đã giới hạn theo gói.
- **Không phá vỡ sản phẩm đã publish hiện có** — mọi migration schema phải là cột/bảng thêm mới (nullable
  hoặc default), không đổi/xoá cột hiện tại, đúng nguyên tắc đã giữ xuyên suốt dự án.

---

## 10. Bước tiếp theo đề xuất

1. Anh xem tài liệu này, quyết định các điểm mở ở §7 (đặc biệt §7.1 — hạ tầng ảnh, ảnh hưởng lớn nhất).
2. Xác nhận phạm vi P0 ở §8 có đúng ý muốn không (có thể thêm/bớt trước khi code).
3. Sau khi chốt, tôi sẽ lập kế hoạch triển khai chi tiết (danh sách file thay đổi, migration cụ thể, số
   lượng test mới) theo đúng kỷ luật đã dùng cho các module trước (ví dụ M3 v2), rồi mới bắt đầu code.

---

## Nguồn tham khảo

- [Teachers Pay Teachers — Wikipedia](https://en.wikipedia.org/wiki/Teachers_Pay_Teachers)
- [Seller Basics: TPT Product Listing Tips to Get More Sales — TPT Seller Blog](https://sellerblog.teacherspayteachers.com/seller-basics-tpt-product-listing-tips-to-get-more-sales/)
- [Gumroad Product Page Best Practices in 2026 (15-Point Checklist) — Kupkaike](https://kupkaike.com/blog/gumroad-product-page-best-practices)
- [Gumroad for Selling Digital Products — mydesigns.io](https://mydesigns.io/blog/gumroad-for-selling-digital-products/)
- [Payhip vs Gumroad: Which Is Better For You In 2026?](https://payhip.com/payhip-vs-gumroad)
- [12 Best Gumroad Alternatives — Payhip Blog](https://payhip.com/blog/gumroad-alternatives/)
- [13 Gumroad Alternatives Compared — beehiiv Blog](https://www.beehiiv.com/blog/gumroad-alternatives)
- [eCommerce Product Page Best Practices in 2026 — VWO](https://vwo.com/blog/ecommerce-product-page-design/)
- [Checklist for Perfect eCommerce Product Listings in 2025 — Saivion](https://saivionservices.com/blog/checklist-for-ecommerce-product-listings-in-2025/)
- [Product Page Optimization: Conversion Guide 2026 — Digital Applied](https://www.digitalapplied.com/blog/product-page-optimization-ecommerce-conversion-guide-2026)
- [Unica.vn](https://unica.vn/) / [Hướng dẫn tạo khoá học Unica](https://help.unica.vn/quy-trinh-tao-khoa-hoc-tren-unica.html)
- [TaiLieu.VN](https://tailieu.vn/) / [123docz.net](https://123docz.net/trang-chu.htm)

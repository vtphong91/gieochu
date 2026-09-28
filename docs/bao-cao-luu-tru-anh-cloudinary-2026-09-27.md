# Báo cáo rà soát: Lưu trữ ảnh Cloudinary cho editor mô tả (Tiptap), dùng Cloudinary hệ thống hay tenant tự mang (BYO)

> **Ngày:** 2026-09-27 · **Loại:** Báo cáo rà soát làm đầu vào quyết định (không kèm thay đổi code).
> **Người viết:** Long (tài liệu), theo brief của Quốc.
> **Câu hỏi của chủ dự án:** Editor mô tả (Tiptap) hiện chỉ chèn ảnh bằng URL. Muốn cho upload ảnh lên Cloudinary
> thì nên dùng **Cloudinary của hệ thống** (tính chi phí vào gói dịch vụ) hay **hướng dẫn tenant tự tạo tài khoản
> Cloudinary riêng** (tối ưu chi phí, giảm tải hệ thống)?
> **Nguồn đã đối chiếu:** `apps/web/lib/system-cloudinary.ts`, `apps/web/app/_ui/cloudinary-actions.ts`,
> `apps/web/app/admin/_ui/image-upload-field.tsx`, `apps/web/app/admin/{categories,cms/home-editor,settings/branding}/**`,
> `apps/web/app/studio/[tenantSlug]/{storefront,products}/actions.ts`, `apps/web/app/studio/[tenantSlug]/storefront/storefront-editor.tsx`,
> `apps/web/app/studio/[tenantSlug]/products/_ui/{cover-image-card,product-editor}.tsx`, `apps/web/app/_ui/editor/{extensions,tiptap-toolbar}.ts(x)`,
> `packages/core/src/content/sanitize-html.ts`, `packages/core/src/tenant/storefront-sections.ts`,
> `packages/core/src/billing/plan-limits.ts`, `apps/web/lib/{plan-limits,product,product-cover,product-upload}.ts`,
> `apps/web/proxy.ts`, `packages/config/src/env.ts`, `packages/db/prisma/{schema.prisma,seed.ts}`; tài liệu
> `docs/DECISIONS.md` (ADR-016/017/021/023/027), `docs/BACKLOG.md`.
>
> **Ký hiệu xác minh:** ✅ đã đối chiếu code/DB schema · 🟡 nghe từ báo cáo/tài liệu hoặc hiểu biết chung, chưa
> kiểm chứng · ❓ cần môi trường thật (tài khoản Cloudinary, trình duyệt, DB production) để xác nhận.

---

## 1. Tóm tắt điều hành

- Hạ tầng Cloudinary hệ thống **đã có và đang dùng cho 5 chỗ upload** (CMS trang chủ, nhận diện thương hiệu, danh
  mục, storefront tenant, ảnh bìa sản phẩm) ✅. Cơ chế là **signed upload đi thẳng trình duyệt → Cloudinary**, server
  chỉ ký SHA-1; ảnh hiển thị bằng thẻ `<img>` trỏ thẳng `res.cloudinary.com` ✅. Như vậy **server Gieo Chữ gần như
  không chịu tải ảnh ở cả phương án hệ thống lẫn BYO**, nên lý do "giảm tải hệ thống" cho BYO **không đứng vững**.
  Khác biệt thật giữa hai phương án là **chi phí Cloudinary (chủ yếu băng thông)** và **quyền kiểm soát**.
- Editor Tiptap chỉ chèn ảnh bằng URL ✅. Sanitizer cho `img src` **mọi host https** ✅, trong khi CSP `img-src` chỉ cho
  `res.cloudinary.com` ✅. Vì vậy ảnh URL ngoài Cloudinary nhiều khả năng **bị chặn khi hiển thị** (❓ chưa kiểm bằng
  trình duyệt).
- Hạn mức gói (`storageMb`, `maxFileMb`) **chỉ áp cho file tài liệu R2**. Ảnh Cloudinary **không có hạn mức nào**,
  và dung lượng mỗi ảnh chỉ được kiểm ở trình duyệt ✅.
- **Khuyến nghị:** chọn **phương án A** cho GĐ1: Cloudinary hệ thống, có hạn mức ảnh theo gói, bắt buộc tối ưu ảnh
  (resize khi upload + `f_auto,q_auto` khi hiển thị). **BYO (C) để GĐ2**, chỉ mở khi số liệu băng thông thật cho thấy
  cần và chỉ cho gói cao. Phải xử lý trước 1 lỗ hổng: chữ ký upload dùng chung đang cấp cho **mọi user đã đăng nhập**
  (mục 2.7).
- Cần chủ dự án chốt: hạn mức ảnh theo từng gói, có mở BYO không và khi nào, mức tối ưu ảnh chấp nhận được (mục 6).

---

## 2. Hiện trạng

### 2.1 Cấu hình Cloudinary hệ thống ✅

| Hạng mục | Hiện trạng |
|---|---|
| Model | `SystemCloudinaryConfig` (L1, 1 dòng `id = "default"`): `isEnabled`, `publicConfig` (Json: `cloudName`, `uploadFolder`), `encryptedSecrets` (String), `lastVerifiedAt`. |
| Mã hoá secret | `apiKey` + `apiSecret` được gói thành JSON rồi mã hoá bằng `encryptSecret(…, STORAGE_ENCRYPTION_KEY)`. Đây là **khoá storage** (cùng khoá với `SystemStorageConfig`, ADR-017), **không phải** `PAYMENT_ENCRYPTION_KEY`. |
| Quản trị | System Admin nhập/sửa. Đổi cloud name/key/secret thì cấu hình **tự tắt** cho tới khi bấm kiểm tra lại (cùng cơ chế ADR-013). Kiểm tra kết nối bằng Basic Auth gọi Admin API `GET /v1_1/<cloud>/usage`. UI chỉ hiện secret đã che (`maskSecret`). |
| Ký chữ ký | `createCloudinaryUploadSignature({ subfolder?, allowedFormats? })`: ký `sha1(allowed_formats&folder&timestamp + apiSecret)`. `apiSecret` không rời server; trình duyệt nhận `cloudName`, `apiKey`, `timestamp`, `folder`, `signature`. Folder mặc định là `uploadFolder` (fallback `gieochu`). |
| Tài khoản | **Một tài khoản Cloudinary dùng chung cho toàn nền tảng.** Các tenant chỉ được tách bằng thư mục con. |

### 2.2 Các nơi đang upload lên Cloudinary ✅

| Nơi dùng | Action ký | Guard | Folder | Định dạng (trong chữ ký) | Giới hạn dung lượng |
|---|---|---|---|---|---|
| Admin: CMS trang chủ (`home-sections-editor`), Nhận diện thương hiệu (`branding-editor`), Danh mục (`category-form`: ảnh đại diện + ảnh OG) | `getCloudinaryUploadSignatureAction` (dùng chung) | `requireUser()`, **chỉ cần đăng nhập** | `<uploadFolder>` (gốc) | **Không giới hạn** (không ký `allowed_formats`; `accept` phía client có cả `image/svg+xml`) | Không có |
| Studio: Storefront (ADR-023) | `getTenantCloudinaryUploadSignatureAction` | `requireTenantMember` | `<uploadFolder>/tenants/<tenantId>/storefront` | jpg, jpeg, png, webp | 2MB, **chỉ kiểm ở trình duyệt** (`MAX_IMAGE_BYTES`) |
| Studio: Ảnh bìa sản phẩm (ADR-027) | `getProductCoverUploadSignatureAction` | `requireTenantMember` | `<uploadFolder>/tenants/<tenantId>/products` | jpg, jpeg, png, webp | 5MB, **chỉ kiểm ở trình duyệt** (`MAX_COVER_BYTES`) |

Phía server, sau khi upload chỉ kiểm URL lưu vào DB bằng `isCloudinaryImageUrl`: `https:` + host
`res.cloudinary.com` + không có user/password ✅. Hàm này **không kiểm `cloudName`, cũng không kiểm folder của
tenant**. BACKLOG đã ghi mục "`coverImageUrl` chưa ràng buộc folder tenant".

### 2.3 Luồng upload và phục vụ ảnh ✅ (❓ chưa chạy với tài khoản Cloudinary thật: PLAN ghi "upload Cloudinary thật" chưa verify)

```
Trình duyệt ──(1) Server Action: xin chữ ký──► Server Gieo Chữ (đọc 1 dòng DB, giải mã, sha1)
Trình duyệt ──(2) POST multipart file──────► https://api.cloudinary.com/v1_1/<cloud>/image/upload
Trình duyệt ◄─(3) secure_url────────────────  Cloudinary
Trình duyệt ──(4) lưu form (chỉ chuỗi URL)─► Server Gieo Chữ (validate host, ghi DB)
Khách xem  ──(5) <img src=secure_url>──────► res.cloudinary.com (CDN Cloudinary)
```

- Bước (2): `ImageUploadField` gọi `fetch` thẳng tới `api.cloudinary.com`. **Byte ảnh không đi qua server Gieo Chữ.**
- Bước (5): ảnh được render bằng `<img>` thuần (eslint-disable `no-img-element` ở `image-upload-field.tsx`,
  `_home-sections.tsx`, `brand-mark.tsx`). **Không qua `next/image`** (không có `images.remotePatterns`) và không qua
  proxy server nào.
- **Không có transformation nào** khi hiển thị: không tìm thấy `f_auto`/`q_auto`/`w_…` trong `apps/web`. Ảnh được
  phục vụ đúng bản gốc đã upload, có thể tới 5MB với ảnh bìa.
- CSP (`apps/web/proxy.ts`, ADR-016): `img-src 'self' data: blob: https://res.cloudinary.com` và
  `connect-src 'self' https://api.cloudinary.com`. Proxy matcher phủ mọi route trừ `_next/static`, `_next/image`,
  `favicon.ico`. Host `res.cloudinary.com` **dùng chung cho mọi cloud name**, nên nếu làm BYO thì **không cần đổi CSP**.

### 2.4 Editor Tiptap và luật lọc ảnh ✅

- Editor được dùng ở 2 nơi: mô tả chi tiết sản phẩm (`product-editor.tsx`) và mô tả danh mục ở Admin
  (`category-form.tsx`).
- `extensions.ts`: `Image.configure({ HTMLAttributes: { class: "max-w-full h-auto rounded-lg" } })`, **không bật
  `allowBase64`**. `tiptap-toolbar.tsx`: popover "URL ảnh" → `setImage({ src: url })`. **Chưa có nút upload nào.**
- `sanitizeRichTextHtml` (`packages/core/src/content/sanitize-html.ts`) cho phép `img` với thuộc tính `src`, `alt`;
  `allowedSchemesByTag: { img: ["https"] }`. **Không giới hạn host.** Sanitize chạy khi lưu (Server Action sản
  phẩm/danh mục) và chạy lại khi render (`[tenantSlug]/_ui/product-detail.tsx`).
- Field `description` trong schema zod của Server Action sản phẩm là `z.string().optional()`: **không giới hạn độ
  dài, không giới hạn số ảnh.**
- Hệ quả (suy từ code, ❓ cần kiểm bằng trình duyệt): ảnh chèn bằng URL từ host khác `res.cloudinary.com` vẫn qua
  được sanitizer và được lưu, nhưng sẽ bị CSP chặn khi hiển thị trên trang public. Thực tế hiện nay chỉ URL
  Cloudinary là hiển thị được.

### 2.5 Hạn mức gói hiện có ✅

- `Plan` có `maxProducts`, `storageMb`, `maxFileMb`, `features` (Json, ADR-021). Số seed (sửa được ở `/admin/plans`):

  | Gói | Giá/tháng | maxProducts | storageMb | maxFileMb |
  |---|---|---|---|---|
  | FREE | 0 | 5 | 500 | 50 |
  | CREATOR | 99.000 | 50 | 5.000 | 250 |
  | PRO | 199.000 | 200 | 20.000 | 1.000 |
  | BUSINESS | 499.000 | 1.000 | 100.000 | 2.000 |

- `assertPlanLimit` chỉ được gọi ở `product-upload.ts` (`fileSize`, `storage` cho **file tài liệu R2**) và
  `product.ts` (`products` khi xuất bản). Comment trong `product-upload.ts` ghi rõ ảnh bìa "aren't … counted against
  `storageUsedBytes` (that quota is for the sellable documents, not presentational assets)".
- **Ảnh Cloudinary không bị tính vào bất kỳ hạn mức nào**, và hệ thống không lưu bảng/số liệu nào về asset Cloudinary
  (chỉ lưu chuỗi URL trong các cột/section).

### 2.6 Nợ đã có trong BACKLOG (liên quan trực tiếp) ✅

- Dung lượng ảnh (2MB storefront, 5MB ảnh bìa) chỉ kiểm phía client, cần upload preset để Cloudinary chặn cứng.
- Asset mồ côi khi tenant đổi/gỡ ảnh bìa (chưa xoá trên Cloudinary).
- `coverImageUrl` chưa ràng buộc folder tenant.
- ADR-023 ghi "Chi phí/quota Cloudinary dùng chung toàn nền tảng" nhưng chưa có quyết định hạn mức.

### 2.7 Phát hiện mới khi rà code (cần Quốc xem)

1. ✅ **Chữ ký upload dùng chung quá rộng:** `getCloudinaryUploadSignatureAction` chỉ `requireUser()`, **không ký
   `allowed_formats`** và ký vào **folder gốc** của hệ thống. Vì vậy mọi tài khoản đã đăng nhập (kể cả khách mua
   hàng, không chỉ SYSTEM_ADMIN) đều gọi được Server Action này để lấy chữ ký hợp lệ, rồi upload ảnh (gồm cả SVG)
   vào tài khoản Cloudinary của nền tảng. Comment trong file cố ý chọn ranh giới "không cho khách ẩn danh", nhưng
   thực tế lại mở cho mọi khách đã đăng ký. Việc này tốn quota nền tảng và cho phép lưu nội dung không kiểm soát
   trên CDN của nền tảng. Đây là quyết định bảo mật, **Quốc cần chốt** trước khi mở thêm upload cho editor.
2. ✅ **Comment lệch code:** cũng file đó ghi phạm vi dùng là "Studio/TiptapEditor: mô tả sản phẩm…", nhưng
   editor **không gọi** action này (chưa có upload). Studio dùng 2 action riêng có guard tenant.
3. ✅ **Sanitizer và CSP không khớp nhau** ở ảnh trong mô tả (mục 2.4): sanitizer nhận mọi host https, CSP chỉ nhận
   Cloudinary. Mục này chưa có trong BACKLOG.
4. ✅ **Không tối ưu ảnh khi phục vụ** (mục 2.3). Với mọi phương án, đây là yếu tố lớn nhất làm tăng băng thông.

---

## 3. So sánh 3 phương án

- **(A) Hệ thống:** Cloudinary hệ thống cho mọi tenant. Có hạn mức ảnh theo gói và tối ưu tự động (giới hạn kích
  thước khi upload, `f_auto` để trả webp/avif, `q_auto`, transformation cố định).
- **(B) BYO:** mỗi tenant tự cấu hình Cloudinary riêng (cloud name, API key, API secret).
- **(C) Lai:** mặc định (A) với hạn mức nhỏ. Tenant gói cao hoặc dùng nhiều được chọn thêm (B).

| Tiêu chí | (A) Hệ thống | (B) BYO | (C) Lai |
|---|---|---|---|
| Chi phí cho nền tảng | Trả phí Cloudinary theo tổng mức dùng, **chủ yếu băng thông** (mục 4). Kiểm soát được bằng hạn mức và tối ưu ảnh. | Gần 0 cho ảnh mới. Tốn công hỗ trợ. | Chi phí A chặn trên bởi hạn mức nhỏ, phần vượt đẩy sang B. |
| Chi phí/công sức cho tenant | Không phải làm gì. Có thể phải nâng gói khi vượt hạn mức. | Phải tự đăng ký Cloudinary, lấy key/secret, tự theo dõi quota. Hết quota Free thì ảnh **ngừng phục vụ/lỗi** (🟡 hành vi khi vượt quota, cần kiểm chính sách Cloudinary). | Mặc định như A, chỉ người muốn mới làm như B. |
| Tải hệ thống / performance | Server chỉ ký chữ ký (1 truy vấn DB + giải mã + sha1). Byte ảnh đi thẳng trình duyệt ↔ Cloudinary ✅. | **Như A** ✅: vẫn ký ở server, chỉ đổi credential theo tenant. Thêm việc giải mã secret theo tenant, gọi kiểm tra kết nối. | Như A/B. |
| Bảo mật | Một secret nền tảng, mã hoá sẵn bằng `STORAGE_ENCRYPTION_KEY` ✅. Tách tenant bằng folder trong chữ ký. | Phải lưu **API secret của từng tenant**: mã hoá AES-256-GCM như secret thanh toán (§7.3), không trả về client (chỉ `••••abcd`), bảng L2 có RLS. Thêm bề mặt rò rỉ: secret của bên thứ ba nằm trong DB nền tảng. | Có cả hai bề mặt. |
| Onboarding giáo viên không rành kỹ thuật | Tốt nhất: bấm upload là xong. | Kém: phải hiểu cloud name/API key/secret, dễ nhập sai, dễ bỏ cuộc. | Tốt ở mặc định. BYO chỉ cho người chủ động. |
| Độ tin cậy / hỗ trợ | Nền tảng kiểm soát một tài khoản, dễ theo dõi (`/usage`). Một điểm lỗi chung nếu tài khoản bị khoá hoặc vượt quota. | Mỗi tenant là một điểm lỗi riêng (hết quota, xoá key, khoá tài khoản), khó hỗ trợ. Ảnh gãy trên trang bán hàng vẫn làm xấu thương hiệu nền tảng. | Hai mô hình cần hỗ trợ song song. |
| Kiểm soát nội dung vi phạm | Nền tảng xoá/ẩn được asset (Admin API), có thể bật moderation của Cloudinary (🟡 add-on tính phí). | Nền tảng **không xoá được** asset trên tài khoản tenant, chỉ gỡ URL khỏi mô tả. | Hạn chế như B với tenant dùng BYO. |
| Độ phức tạp code | Thấp: tái dùng `createCloudinaryUploadSignature` + thêm nút upload ở toolbar + hạn mức + transformation. | Trung bình–cao: bảng cấu hình tenant, UI nhập/kiểm tra/che secret, auto-disable-on-change, fallback khi lỗi, validate URL theo cloud name của tenant. | Cao nhất: cả A và B, thêm logic chọn nguồn và di chuyển giữa hai nguồn. |
| Khoá chặt nhà cung cấp | Một điểm phụ thuộc, có thể đổi sau (URL lưu trong HTML mô tả thì đổi nhà cung cấp phải rewrite HTML). | Tenant bị gắn vào Cloudinary. URL rải trên nhiều cloud, khó di chuyển. | Tệ nhất về di chuyển. |

### 3.1 Về nhận định "BYO giảm tải performance" ✅

Code xác nhận (mục 2.3): upload đi thẳng `browser → api.cloudinary.com`, ảnh phục vụ từ `res.cloudinary.com`, không có
`next/image` hay proxy trung gian. **Ở cả A và B, server Gieo Chữ chỉ tốn một lần ký chữ ký cho mỗi ảnh upload và
không tốn gì khi khách xem ảnh.** BYO không giảm tải server. Nó chỉ chuyển **hoá đơn Cloudinary** (storage, băng
thông, transformation) sang tenant. Tốc độ tải ảnh phía khách ở hai phương án tương đương vì cùng CDN Cloudinary
(🟡 trừ khi tài khoản Free của tenant bị giới hạn/throttle, cần kiểm chính sách).

Trường hợp duy nhất server phải chịu tải ảnh là nếu sau này chuyển sang `next/image` (tối ưu qua server Next) hoặc
proxy ảnh qua server. Nếu vậy thì nên tắt tối ưu của Next cho ảnh Cloudinary và dùng transformation của Cloudinary.

---

## 4. Ước tính chi phí

> 🟡 **Toàn bộ mục này là tham khảo, dựa trên hiểu biết chung, CẦN KIỂM LẠI BẢNG GIÁ CLOUDINARY HIỆN HÀNH** trước khi
> đưa vào quyết định giá. Không có số liệu dùng thật của Gieo Chữ (❓ chưa có tenant/traffic production).

### 4.1 Mô hình credit của Cloudinary 🟡

- Cloudinary tính theo **credit/tháng**: 1 credit ≈ **1 GB lưu trữ** *hoặc* **1 GB băng thông** *hoặc* **1.000
  transformation**. Ba loại cộng dồn vào cùng quỹ credit.
- **Free:** khoảng 25 credit/tháng. **Plus:** khoảng 89–99 USD/tháng cho khoảng 225 credit. **Advanced:** khoảng
  224–249 USD/tháng cho khoảng 600 credit. Trên nữa là Enterprise (giá thoả thuận). Có thể có phụ phí vượt mức.
- Transformation được tính khi **tạo bản dẫn xuất lần đầu**. Các lần xem sau lấy từ cache CDN, chỉ tốn băng thông.
  Dùng một bộ transformation cố định (ví dụ `f_auto,q_auto,c_limit,w_1600`) thì số transformation nhỏ và gần tỉ lệ
  với số ảnh × số định dạng trình duyệt.

### 4.2 Giả định ước lượng 🟡

| Giả định | Giá trị | Ghi chú |
|---|---|---|
| Kích thước 1 ảnh sau tối ưu (≤1600px, webp/avif, `q_auto`) | ~150 KB | Hiện chưa tối ưu, ảnh gốc có thể 1–5MB, **gấp 10–30 lần**. |
| Số ảnh/tenant hoạt động | ~20 sản phẩm × 4 ảnh mô tả + ~10 ảnh bìa/storefront ≈ 90 ảnh | Tenant Free giới hạn 5 sản phẩm nên thấp hơn nhiều. |
| Lưu trữ/tenant (bản gốc đã resize khi upload + bản dẫn xuất) | ~15–25 MB | Resize khi upload (incoming transformation) giữ bản gốc nhỏ. |
| Tỉ lệ tenant thực sự hoạt động | 30% | Mô hình Free Forever (ADR-021) có nhiều tenant ít dùng. |
| Lượt xem trang sản phẩm/tenant hoạt động/tháng | ~2.000 | Mỗi lượt tải ~4–5 ảnh ≈ 0,6 MB, tức ~1,2 GB/tháng. |

### 4.3 Kịch bản 🟡

| Kịch bản | Tenant hoạt động | Lưu trữ (GB) | Băng thông (GB/tháng) | Credit ước tính/tháng | Gói Cloudinary tương ứng |
|---|---|---|---|---|---|
| 100 tenant | 30 | ~2 | ~36 | ~40 | Plus (dư) |
| 1.000 tenant | 300 | ~20 | ~360 | ~385 | Advanced |
| 10.000 tenant | 3.000 | ~200 | ~3.600 | ~3.800 | Enterprise / thoả thuận riêng |
| 1.000 tenant, **không tối ưu** (ảnh gốc ~1,5MB) | 300 | ~120 | ~3.600 | ~3.700 | Enterprise |

Nhận xét:
- **Băng thông chiếm trên 90% chi phí**, lưu trữ không đáng kể. Vì vậy hạn mức "MB ảnh" chỉ khống chế được phần
  nhỏ. Công cụ giảm chi phí mạnh nhất là **tối ưu ảnh khi phục vụ** (dòng cuối cho thấy chênh khoảng 10 lần).
- Băng thông tỉ lệ với **lượt xem trang bán hàng**, tức gần tỉ lệ với doanh thu của tenant. Tenant bán chạy thường
  ở gói trả phí, nên chi phí băng thông có nguồn bù tự nhiên.
- Mức 10.000 tenant cần đàm phán giá hoặc cân nhắc nguồn phục vụ khác (🟡 ví dụ R2 public + CDN không tính phí
  egress). Nền tảng đã có R2 (ADR-017), nhưng việc này ngoài phạm vi báo cáo.

### 4.4 Cách đưa vào gói dịch vụ (không cần tính lại toàn bộ giá)

- Thêm **hạn mức ảnh theo gói**, ví dụ `imageStorageMb` hoặc `maxImages`. Có 2 cách lưu:
  (1) cột mới trong `Plan` (đồng dạng `storageMb`, validate chặt);
  (2) khoá trong `Plan.features` (ADR-021, không cần migration cột nhưng kiểu dữ liệu lỏng). Cần Quốc chọn.
- Kèm **trần kích thước mỗi ảnh** (ví dụ 5MB đầu vào, tự resize ≤1600–2000px khi upload) cho mọi gói.
- Không nên tính theo băng thông với tenant (khó hiểu, khó dự đoán). Nền tảng hấp thụ băng thông và khống chế bằng
  tối ưu ảnh cộng hạn mức số ảnh.
- Ví dụ minh hoạ (🟡, **chủ dự án quyết số thật**): FREE 50 ảnh / 25MB; CREATOR 500 ảnh / 250MB; PRO 2.000 ảnh / 1GB;
  BUSINESS 10.000 ảnh / 5GB. Với ảnh ~150KB sau tối ưu, các mức này dư cho mô tả thông thường. Chi phí thêm cho
  nền tảng ở quy mô 1.000 tenant cỡ vài trăm USD/tháng, chia cho tenant trả phí là vài nghìn đồng/tenant/tháng
  (🟡 tuỳ tỉ lệ trả phí).

---

## 5. Khuyến nghị cho Quốc

### 5.1 Phương án đề xuất

**GĐ1 làm (A). Giữ (C) (mở BYO cho gói cao) là tuỳ chọn GĐ2, chỉ làm khi có số liệu thật.** Lý do:
- BYO không giảm tải server (mục 3.1), onboarding kém với nhóm giáo viên không rành kỹ thuật, thêm bề mặt lưu secret
  bên thứ ba và mất quyền gỡ nội dung vi phạm.
- Chi phí A ở quy mô đầu (≤1.000 tenant) nằm trong gói Plus/Advanced 🟡, và khống chế được bằng tối ưu ảnh cộng hạn mức.

### 5.2 Lộ trình

**GĐ1: Upload ảnh trong editor bằng Cloudinary hệ thống**
1. Đóng lỗ hổng mục 2.7.1: giới hạn `getCloudinaryUploadSignatureAction` cho SYSTEM_ADMIN (hoặc quyền RBAC tương ứng,
   ADR-022) và ký `allowed_formats`.
2. Server Action ký riêng cho ảnh mô tả, guard `requireTenantMember`, folder
   `<uploadFolder>/tenants/<tenantId>/content` (tên folder do Quốc chốt), định dạng jpg/jpeg/png/webp (có nhận gif
   không thì cần chốt). Ký thêm **incoming transformation** giới hạn kích thước (ví dụ `c_limit,w_2000`) để bản
   lưu luôn nhỏ (🟡 cần kiểm tham số signed upload hiện hành của Cloudinary).
3. Nút "Tải ảnh lên" trong toolbar Tiptap (Phong làm UI, Hiếu làm action). Chèn URL đã gắn transformation hiển thị cố
   định (`f_auto,q_auto,c_limit,w_1600`).
4. Siết `sanitizeRichTextHtml` cho `img src`: chỉ `res.cloudinary.com/<cloudName hệ thống>/…`, cho khớp CSP.
   Đây là **đổi hành vi** vì ảnh URL ngoài đang lưu trong mô tả cũ sẽ bị lọc bỏ khi render lại. Cần ADR, và cần
   quyết giữ hay bỏ ô "URL ảnh".
5. Hạn mức: ghi nhận asset sau upload (xác minh `signature` Cloudinary trả về ở server, lưu `publicId`, `bytes`,
   `tenantId`), đếm theo tenant, chặn khi vượt hạn mức gói. Chặn cứng dung lượng đầu vào bằng upload preset
   (nợ BACKLOG sẵn có).
6. Áp chung transformation hiển thị cho ảnh bìa và storefront đang có (giảm băng thông ngay).

**GĐ2 (tuỳ chọn): BYO cho gói cao**, chỉ làm khi số liệu `/usage` thật cho thấy băng thông vượt ngưỡng chủ dự án đặt.
Bảng cấu hình Cloudinary theo tenant (L2, RLS), secret mã hoá AES-256-GCM, UI che secret, auto-disable-on-change,
kiểm tra kết nối. Validate URL theo cloud name của tenant. Kèm hướng dẫn từng bước cho giáo viên.

### 5.3 Ảnh hưởng schema / ADR / test

| Hạng mục | GĐ1 (A) | GĐ2 (B/C) |
|---|---|---|
| Schema | Bảng ghi nhận asset ảnh, L2 có `tenantId` + RLS, ví dụ `MediaAsset(publicId, bytes, width, height, folder, createdAt)`. Có thể thêm cột `Tenant.imageUsedBytes`. Hạn mức: cột `Plan.imageStorageMb`/`maxImages` hoặc khoá trong `features`. | Bảng `TenantCloudinaryConfig` (L2, RLS, `encryptedSecrets`). |
| ADR | ADR mới: upload ảnh editor bằng Cloudinary hệ thống + hạn mức ảnh theo gói + siết `img src` theo cloud hệ thống + thu hẹp chữ ký dùng chung. | ADR riêng cho BYO: khoá mã hoá dùng cho secret tenant, ranh giới L2, hành vi khi tài khoản tenant lỗi. |
| Test | Cần test cho: action ký (guard, folder, định dạng), sanitizer lọc host ảnh, `assertPlanLimit` loại ảnh, RLS bảng asset. **Tăng số test case phải được chủ dự án duyệt** (quy ước mục 9; trần hiện 94/53 theo ADR-026, `CLAUDE.md` ghi số thực 91/49, chưa chạy `pnpm test:count` trong đợt rà này). | Test mã hoá/che secret, RLS bảng cấu hình, chọn nguồn upload. |
| Tài liệu KB | Cập nhật `02-System-Specs/File-Storage-And-Downloads-Specs.md`, `Product-Editor-And-Publishing-Specs.md`. | Thêm runbook hướng dẫn tenant tạo Cloudinary. |

---

## 6. Câu hỏi cần chủ dự án / Quốc quyết

1. **Chọn phương án:** đồng ý (A) cho GĐ1 và hoãn BYO không? Nếu vẫn muốn BYO: mở cho gói nào, bắt buộc hay tuỳ chọn,
   và mốc kích hoạt (ví dụ khi băng thông Cloudinary vượt X GB/tháng)?
2. **Hạn mức ảnh theo gói** FREE/CREATOR/PRO/BUSINESS: tính theo MB, số ảnh, hay cả hai? Số cụ thể? Ảnh bìa và ảnh
   storefront có tính chung vào hạn mức này không?
3. **Lưu hạn mức ở đâu:** cột mới trong `Plan` hay khoá trong `Plan.features` (ADR-021)?
4. **Chữ ký upload dùng chung** (mục 2.7.1): thu hẹp về SYSTEM_ADMIN ngay (sửa bảo mật, tách khỏi task này) hay gộp vào GĐ1?
5. **Ảnh URL ngoài trong mô tả:** siết chỉ nhận Cloudinary hệ thống (mô tả cũ có ảnh ngoài sẽ mất ảnh) hay giữ ô
   "URL ảnh"? Nếu giữ thì có mở CSP `img-src` không (rủi ro bảo mật/tracking)?
6. **Tối ưu ảnh:** chấp nhận tự resize ≤1600–2000px và tự đổi định dạng (webp/avif) không? Có nhận GIF động không?
7. **Nếu làm BYO:** secret tenant mã hoá bằng khoá nào (`PAYMENT_ENCRYPTION_KEY`, `STORAGE_ENCRYPTION_KEY` hay khoá
   mới)? Đây là quyết định bảo mật.
8. **Asset mồ côi và vi phạm nội dung:** có cần job dọn asset không còn được tham chiếu, và quy trình gỡ ảnh vi phạm
   (ai có quyền, có bật moderation trả phí không)?
9. **Ngân sách test:** duyệt tăng mốc `test:count` cho các test mới ở mục 5.3.

---

## Phụ lục: Mục chưa xác minh (❓) và chỗ lệch tài liệu/code

**❓ Cần môi trường thật**
- Upload Cloudinary thật (chữ ký, `allowed_formats`, folder) chưa chạy end-to-end (PLAN ghi chưa verify).
- Ảnh URL ngoài `res.cloudinary.com` trong mô tả có thật sự bị CSP chặn trên trang public không (suy từ code, chưa
  mở trình duyệt).
- Mức dùng thật (`/usage`) của tài khoản Cloudinary hệ thống: chưa có số liệu.

**Chỗ lệch phát hiện**
- `apps/web/app/_ui/cloudinary-actions.ts`: comment ghi action dùng cho "Studio/TiptapEditor: mô tả sản phẩm…" nhưng
  editor không gọi action này, Studio dùng action riêng (mục 2.7.2). Lệch comment–code, không phải lệch tài liệu.
- ADR-023 ghi "Chi phí/quota Cloudinary dùng chung toàn nền tảng" là nợ mở, nhưng BACKLOG chưa có mục "hạn mức ảnh
  Cloudinary theo gói" và chưa có mục "sanitizer `img src` không khớp CSP". Đề xuất Quốc bổ sung BACKLOG (Long
  không sửa `docs/BACKLOG.md` trong brief này).

---
tags:
  - contract
  - api
  - endpoint
  - status/living
date: 2026-06-15
updated: 2026-09-28
author: System Architect
---

# 🔌 Hợp Đồng: Danh Bạ API Endpoints (Endpoint Directory)

> [!NOTE] Nguồn sinh tài liệu
> Bảng dưới đây được **đối chiếu trực tiếp với code** ngày 2026-09-26: **20 file `route.ts` / 20 handler HTTP**
> dưới `apps/web/app/api/**` (đếm bằng `find apps/web/app/api -name "route.ts" | wc -l`). Từ ADR-030 (2026-09-28) có thêm
> **1 `route.ts` ngoài `/api`** — redirect 301 URL tài liệu cũ (§5.1) → toàn `apps/web/app` có **21** `route.ts` ✅. Gieo Chữ ở giai đoạn
> MVP Phase 1 hiện chưa có tiền tố version (`/api/v1/...` như một số dự án khác) — mọi route nằm thẳng dưới
> `/api/`. Phần lớn nghiệp vụ tenant (Studio, quản lý sản phẩm, đơn hàng, subscription) chạy qua **Server
> Actions** trong `apps/web/app/studio/**` và **Server Components** trong `apps/web/app/admin/**`, không phải
> route handler — bảng này chỉ liệt kê route HTTP thật (`route.ts`) theo đúng yêu cầu của thư mục này; Server
> Actions không nằm trong phạm vi tài liệu này — contract Server Action của Storefront CMS/form liên hệ
> (ADR-023: `submitStorefrontContactAction`, các action editor/hộp thư Studio) ghi ở
> [[02-System-Specs/Storefront-CMS-Specs|Storefront-CMS-Specs]] §6–§7; đợt này không thêm `route.ts` nào (vẫn 20 ✅).
> Đợt ADR-026/027 (2026-09-26/27) cũng **không thêm `route.ts`** (đếm lại 2026-09-27: vẫn 20 ✅); contract Server
> Action của editor sản phẩm Studio ghi ở §10 trang này. Đợt M10a Đánh giá (ADR-029, 2026-09-27) cũng **không thêm
> `route.ts`** (đếm lại 2026-09-28: vẫn 20 ✅) — contract Server Action + hàm lib đánh giá ghi ở §12. Đợt M10b Bài viết
> (ADR-029, 2026-09-28) cũng **không thêm `route.ts`** (đếm lại 2026-09-28: vẫn 20 ✅) — contract ghi ở §13.

## 1. Quy Ước Chung

- **Base URL:** `/api/` (không có tiền tố version).
- **Xác thực:** cookie `httpOnly` `at` (access token, JWT) / `rt` (refresh token, `Path=/api/auth`) — không có
  chế độ Bearer token cho mobile/CMS ở giai đoạn này (xem mục "Quy tắc bảo mật" trong
  [CLAUDE.md](../../CLAUDE.md), quy tắc 1).
- **`proxy.ts`** (`apps/web/proxy.ts`, thay `middleware.ts` — Next.js 16) chỉ gắn `x-request-id` và làm redirect
  thô cho page routes; **không** làm gateway auth cho `/api/**`. Mỗi route handler tự gọi lại
  `requireUser()` / `requireRole()` / `requireTenantMember()` (`apps/web/lib/session.ts`,
  `apps/web/lib/tenant.ts`) — đúng nguyên tắc "không tin proxy" (CLAUDE.md, mục Cấu trúc thư mục).
- **Phản hồi thành công:** route trả trực tiếp `NextResponse.json(<payload>)` — **không có envelope** cố định
  kiểu `{success, data}`; mỗi handler tự định hình payload theo nhu cầu.
- **Phản hồi lỗi** (`handleApiError()` → `toHttpError()`, `@gieochu/core/errors.ts`), đúng CLAUDE.md §6:
  ```json
  { "error": { "code": "VALIDATION_ERROR", "message": "…", "requestId": "…" } }
  ```
  `AppError.httpStatus` quyết định status code (mặc định 400); `expose: false` thay `message` thật bằng thông
  báo chung để không lộ chi tiết nội bộ.
- **`requestId`:** lấy từ header `x-request-id` (do `proxy.ts` gắn) hoặc sinh mới bằng
  `crypto.randomUUID()` (`getRequestId()`, `apps/web/lib/api-response.ts`).

## 2. Lớp Bảo Vệ Truy Cập

Không có tầng "Store Factory" hay middleware auth toàn cục cho API — mỗi route tự gọi 1 trong các guard sau
(`apps/web/lib/session.ts`, `apps/web/lib/tenant.ts`):

| Guard | Hành vi |
| :-- | :-- |
| *(không gọi guard)* | Public — route tự quyết định phần nào cần xác thực (vd. đọc cookie refresh token nếu có, nhưng không bắt buộc) |
| `getCurrentUser()` | Đọc user hiện tại nếu có cookie hợp lệ, **không throw** nếu chưa đăng nhập (dùng cho route public có thể cá nhân hoá, vd. coupon preview biết `userId` để check `perCustomerLimit`) |
| `requireUser()` | Bắt buộc đã đăng nhập (mọi `systemRole`), throw `401` nếu không có/hết hạn access token |
| `requireRole("SYSTEM_ADMIN")` | Bắt buộc `User.systemRole === SYSTEM_ADMIN`, throw `403` nếu không đủ quyền |
| `requireTenantMember(tenantSlug, role?)` | Bắt buộc đã đăng nhập **và** là `TenantMember` (mặc định role `OWNER`) của tenant khớp `tenantSlug` trong path — dùng cho mọi route Studio |
| Xác thực webhook (chữ ký provider) | `provider.verifyWebhook({headers, rawBody}, cfg)` (`@gieochu/payments`) — so khớp chữ ký/HMAC **trước khi** parse body nghiệp vụ, sai chữ ký → `401` ngay, không phải lỗi `AppError` chuẩn (CLAUDE.md §7.4) |

**Ghi chú đọc bảng:**
- `Public` = route không gọi bất kỳ guard nào ở trên.
- `Public (token = credential)` = không cần đăng nhập nhưng cần sở hữu 1 token một-lần đã cấp trước đó
  (download token, share-link token) — cùng mô hình tin cậy với link xác thực email/reset mật khẩu.
- Route webhook không theo envelope lỗi chuẩn ở mục 1 — trả `{error: "..."}"` thô kèm status tương ứng khi
  provider chưa cấu hình / sai chữ ký, để tránh lộ chi tiết nội bộ cho bên ngoài gọi vào.

## 3. Auth (`/api/auth`) — 8 route

| Method | Endpoint | Truy cập | Mô tả |
| :-- | :-- | :-- | :-- |
| `POST` | `/api/auth/register` | Public | Tạo `User` (status `PENDING`) + `UserProfile`, phát `VerificationToken` (`EMAIL_VERIFY`), gửi email kích hoạt qua `sendEmailNow()`. Không tạo `Tenant` — trở thành tenant là hành động riêng, tự nguyện qua `/studio`. |
| `POST` | `/api/auth/login` | Public | Xác thực email/mật khẩu, rate-limit 10 lần/15 phút theo email. Sai 5 lần liên tiếp (chỉ tính khi email tồn tại) → đặt `passwordResetRequired=true`, khoá đăng nhập tới khi qua `/forgot-password`. Thành công: set cookie `at`/`rt`. |
| `POST` | `/api/auth/logout` | Public (đọc cookie `rt` nếu có) | Revoke toàn bộ `RefreshToken` cùng `familyId`, xoá cookie `at`/`rt`. |
| `POST` | `/api/auth/refresh` | Public (bắt buộc cookie `rt` hợp lệ) | Xoay refresh token (rotate-on-use); phát hiện **reuse** token đã bị thay thế → revoke cả `familyId`, trả `401 AUTH_REFRESH_REUSE`. |
| `POST` | `/api/auth/verify-email` | Public | Tiêu thụ `VerificationToken` loại `EMAIL_VERIFY` (hash so khớp `tokenHash`), chuyển `User.status` → `ACTIVE`, set `emailVerifiedAt`. |
| `POST` | `/api/auth/resend-verification` | Public | Gửi lại token kích hoạt nếu `User.status === PENDING`; rate-limit 3 lần/giờ theo email; phản hồi giống nhau bất kể email tồn tại hay không (chống dò email). |
| `POST` | `/api/auth/forgot-password` | Public | Luôn trả `200` với thông báo chung (chống dò email); nếu email tồn tại và `status=ACTIVE`, phát `VerificationToken` (`PASSWORD_RESET`) và gửi email. Rate-limit 5 lần/giờ theo email. |
| `POST` | `/api/auth/reset-password` | Public | Tiêu thụ `VerificationToken` (`PASSWORD_RESET`), đặt mật khẩu mới, reset `failedLoginAttempts`/`passwordResetRequired`, **revoke mọi `RefreshToken`** đang hoạt động của user. |

## 4. Tài khoản khách hàng (`/api/me`) — 1 route

| Method | Endpoint | Truy cập | Mô tả |
| :-- | :-- | :-- | :-- |
| `GET` | `/api/me` | `requireUser()` | Trả thông tin user hiện tại (`id`, `email`, `role`, `status`, `emailVerified`, `profileCompleted`, `profile`). |

## 5. Storefront công khai (`/api/[tenantSlug]`) — 1 route

| Method | Endpoint | Truy cập | Mô tả |
| :-- | :-- | :-- | :-- |
| `POST` | `/api/[tenantSlug]/coupons/preview` | Public (`getCurrentUser()` không bắt buộc — chỉ dùng `userId` nếu có để check `perCustomerLimit`) | Tính lại giá + giảm giá coupon **ở server** cho giỏ hàng (`previewCouponPrice()`, `apps/web/lib/coupon.ts`) trước khi vào checkout — không tin số tiền client gửi lên (CLAUDE.md §7.5). Dùng lại đúng `calculatePrice()` mà M8 checkout gọi lần 2 khi tạo `Order` thật. |

### 5.1. Route Handler ngoài `/api` — redirect URL tài liệu cũ (ADR-030) ✅

| Method | Endpoint | Truy cập | Mô tả |
| :-- | :-- | :-- | :-- |
| `GET` | `/[tenantSlug]/products/[productSlug]` (`app/[tenantSlug]/products/[productSlug]/route.ts`) | Public, chỉ đọc (không kiểm `Origin`) | **301** sang URL chuẩn `/{tenantSlug}/{productSlug}`: `Location` **tương đối** = `productPath(tenantSlug, productSlug)` + query gốc; body rỗng. `productSlug` thuộc `RESERVED_PRODUCT_SLUGS` → **404**. Không dùng `permanentRedirect()`/`redirects()` vì Next trả 308. |

- `/{tenantSlug}/products` (không có slug) → **404** (không có `page.tsx`) ✅. Trang tài liệu `/{tenantSlug}/{productSlug}`
  là Server Component (`app/[tenantSlug]/[productSlug]/page.tsx`), kèm Server Action `buyProductAction`
  (`[productSlug]/actions.ts`) và action đánh giá (§12.1). Route map đầy đủ:
  [[02-System-Specs/Product-Editor-And-Publishing-Specs|Product-Editor-And-Publishing-Specs]] §7A.
- Chưa có test tự động cho redirect (BACKLOG) ❓.

## 6. Studio — upload file sản phẩm (`/api/studio/[tenantSlug]/uploads`) — 4 route

Tất cả bốn route đều bắt buộc `requireTenantMember(tenantSlug)` (chỉ `OWNER` của đúng tenant khớp `tenantSlug`
trong path — MVP chưa có `STAFF` được cấp quyền upload).

| Method | Endpoint | Truy cập | Mô tả |
| :-- | :-- | :-- | :-- |
| `POST` | `/api/studio/[tenantSlug]/uploads/presign` | `requireTenantMember` | Cấp URL presigned PUT (bucket **private**) để tải 1 `ProductFile` lên — kiểm giới hạn dung lượng/số file theo `Plan` (`maxFileMb`, `storageMb`) bên trong `presignProductFileUpload()` (`apps/web/lib/product-upload.ts`). |
| `POST` | `/api/studio/[tenantSlug]/uploads/complete` | `requireTenantMember` | Xác nhận upload xong (`completeProductFileUpload()`). ADR-026 ✅: (1) `objectKey` client gửi lên phải khớp tiền tố `tenants/<tenantId>/products/<productId>/<uuid>/<tênĐãSanitize>` (`isProductObjectKeyFor`, kind `file`) + đuôi trong allowlist, kiểm **trước mọi lời gọi storage** — sai → `400 INVALID_OBJECT_KEY`; (2) `objectKey` đã ghi nhận → `409 UPLOAD_ALREADY_COMPLETED`; (3) `HeadObject` thật: không thấy → `400 UPLOAD_NOT_FOUND`, dung lượng lệch khai báo → xoá object + `400 UPLOAD_SIZE_MISMATCH`; (4) kiểm lại `assertPlanLimit("fileSize"/"storage")` bằng **dung lượng thật** — vượt → xoá object + lỗi giới hạn gói; (5) tạo `ProductFile` (`scanStatus=PENDING`), cộng `storageUsedBytes` theo dung lượng thật, enqueue `file.scan`. |
| `POST` | `/api/studio/[tenantSlug]/uploads/cover-presign` | `requireTenantMember` | Cấp URL presigned PUT cho ảnh bìa sản phẩm (bucket **public** R2, PNG/JPG/JPEG ≤ 5 MB theo khai báo). **Luồng cũ** — từ ADR-027 editor dùng ảnh bìa Cloudinary (§10); route giữ tới khi dọn (BACKLOG). |
| `POST` | `/api/studio/[tenantSlug]/uploads/cover-complete` | `requireTenantMember` | Xác nhận ảnh bìa R2, ghi `Product.coverImageKey`. ADR-026 ✅: kiểm `objectKey` khớp `tenants/<tenantId>/products/<productId>/cover/<tên>` (`isProductObjectKeyFor`, kind `cover`) + đuôi png/jpg/jpeg trước khi gọi storage → sai `400 INVALID_OBJECT_KEY`. Chưa kiểm dung lượng thật của ảnh (BACKLOG). |

## 7. Downloads & Share Links (khách hàng, L3) — 3 route

| Method | Endpoint | Truy cập | Mô tả |
| :-- | :-- | :-- | :-- |
| `POST` | `/api/downloads` | `requireUser()` | Bước 1 của luồng tải file (M9): kiểm `Entitlement` còn hạn (`downloadsUsed < downloadLimit`, chưa `revokedAt`), phát `DownloadToken` một-lần, TTL 60s. Rate-limit 20 lần/10 phút theo `userId`. Trả `{ url: "/api/downloads/{token}", expiresAt }`, không trả URL bucket thật. ADR-026 ✅: `fileId` có thể là dòng **link ngoài** (`sourceKind = EXTERNAL_URL`) — cùng luồng entitlement/`downloadLimit`/token; dòng không giao được (file chưa `CLEAN`, link không còn qua allowlist, đã gỡ) → `404`. |
| `GET` | `/api/downloads/[token]` | Public (token = credential một-lần) | Bước 2: tiêu thụ `DownloadToken` (so khớp `tokenHash`; không có/hết hạn/đã dùng → `410 TOKEN_INVALID`), **kiểm lại nguồn giao hàng trước khi trừ lượt** — không còn giao được → `410 DOWNLOAD_SOURCE_UNAVAILABLE` (ADR-026; token lúc này đã bị đánh dấu dùng nhưng lượt tải **không** bị trừ ✅), tăng `Entitlement.downloadsUsed` (hết lượt/thu hồi → `403 DOWNLOAD_LIMIT_REACHED`), ghi `DownloadEvent`, rồi `302` sang: URL presigned GET (FILE — bucket private, `Content-Disposition: attachment`, sống ≤ 10 phút — CLAUDE.md §7.6) **hoặc** chính URL link ngoài đã chuẩn hoá lại qua allowlist (EXTERNAL_URL). |
| `POST` | `/api/share-links/[token]/download` | Public (mật khẩu tuỳ chọn theo `ShareLink.passwordHash`) | Kiểm mật khẩu (nếu `ShareLink` có đặt), kiểm `fileId` thuộc `fileIds` cho phép, tăng `usedCount` một cách atomic (không vượt `maxUses`), ghi `DownloadEvent`, trả URL presigned GET. Rate-limit 20 lần/10 phút theo **token** (không theo IP — chống brute-force mật khẩu qua proxy). ADR-026 ✅: **không bao giờ giao link ngoài** — chỉ nhận dòng `sourceKind = FILE`, không preview, `CLEAN`, chưa gỡ (`apps/web/lib/share-link.ts`). |

## 8. Admin (System Center) — 1 route

| Method | Endpoint | Truy cập | Mô tả |
| :-- | :-- | :-- | :-- |
| `GET` | `/api/admin/dashboard` | `requireRole("SYSTEM_ADMIN")` | Tổng hợp số liệu dashboard hệ thống (`getAdminDashboardSummary()`, `apps/web/lib/admin-dashboard.ts`) — chỉ đọc số liệu tổng hợp cấp platform, **không** đọc chi tiết đơn hàng/khách hàng của tenant (CLAUDE.md §7.9). Phần lớn nghiệp vụ admin khác (duyệt tenant, cấu hình billing/SMTP/storage, CMS...) chạy qua Server Component/Server Action trong `apps/web/app/admin/**`, không có route riêng. |

## 9. Webhooks (`/api/webhooks`) — 2 route

| Method | Endpoint | Truy cập | Mô tả |
| :-- | :-- | :-- | :-- |
| `POST` | `/api/webhooks/platform/[provider]` | Public + xác thực chữ ký provider (`SEPAY`, `MOMO`) | Webhook thanh toán **phí subscription nền tảng** (Tenant → Gieo Chữ). Xác thực chữ ký trước (`provider.verifyWebhook`), ghi `WebhookEvent` (`scope=PLATFORM`) để idempotent, đối soát `SubscriptionInvoice` theo mã tham chiếu + số tiền, gọi `markInvoicePaid()` nếu khớp, luôn ghi `PlatformPaymentTransaction` (khớp hoặc `UNMATCHED` để admin xử lý tay). |
| `POST` | `/api/webhooks/tenants/[tenantId]/[provider]` | Public + xác thực chữ ký provider (`SEPAY`, `MOMO` — không nhận `MANUAL_QR`, vì đó không có webhook) | Webhook thanh toán **đơn hàng khách mua sản phẩm của tenant**. Đọc `TenantPaymentConfig` (giải mã `encryptedSecrets` bằng `PAYMENT_ENCRYPTION_KEY`), xác thực chữ ký, ghi `WebhookEvent` (`scope=TENANT`) để idempotent, rồi **trả 200 ngay** và đẩy việc nặng (khớp `Order`, `markOrderPaid()`) vào job `payment.process` qua `enqueuePaymentProcess()` — đúng CLAUDE.md §7.4 "trả 2xx nhanh rồi xử lý nặng trong job". |

---

## 10. Server Actions — Editor sản phẩm Studio (ADR-026/027)

Không phải route HTTP, nhưng là contract giữa editor (client) và server — ghi ở đây vì Studio sản phẩm không có
`route.ts` riêng. File: `apps/web/app/studio/[tenantSlug]/products/actions.ts` ✅ (đọc code 2026-09-27). Mọi action
gọi `requireTenantMember(tenantSlug)` trước tiên; lỗi nghiệp vụ `AppError` được đổi thành state, không throw ra UI.

**`ProductActionState`** (kiểu trả về chung):

| Trường | Nghĩa |
| :-- | :-- |
| `ok?: boolean` | Thao tác thành công |
| `error?: string` | Lỗi chung (banner) |
| `fieldErrors?: Record<string, string>` | Lỗi theo tên field FormData. Map mã lỗi → field: `INVALID_SLUG`→`slug`, `INVALID_SALE_PRICE`→`salePriceVnd`, `CATEGORY_NOT_FOUND`/`CATEGORY_INACTIVE`/`CATEGORY_REQUIRED`→`categoryId`, `INVALID_EXTERNAL_URL`→`url`, `INVALID_EXTERNAL_LINK_LABEL`→`label`, `INVALID_PRODUCT_SUMMARY`→`summary`, `INVALID_COVER_IMAGE_URL`→`coverImageUrl` |
| `productId?: string` | Id sản phẩm (trang Tạo dùng để chuyển sang URL sửa) |
| `saved?: boolean` | Đã lưu xong dù bước xuất bản bị từ chối |
| `published?: boolean` | (ADR-027 — chỉ có khi FormData có `visibility` hoặc gọi saveAndPublish) trạng thái sau thao tác: `true` = Công khai (`PUBLISHED`), `false` = Riêng tư |
| `link?: ProductLinkState` | (Sau ADR-027, cho trang Tạo tự tạo nháp) chỉ có ở `addProductLinkAction`/`updateProductLinkAction` khi thành công: `{ id, label, url, isAllowed, createdAt }` — `createdAt` là ISO string UTC (serialize qua Server Action) để card cập nhật danh sách link cục bộ |
| `publishReasons?: PublishBlock[]` | Lý do chưa xuất bản được, dạng `{ code, message }`: `CATEGORY_REQUIRED`, `CATEGORY_INACTIVE`, `NO_DELIVERY_SOURCE`, `NO_COVER_IMAGE`, `INVALID_PRICE`, `TENANT_NOT_ACTIVE`, `PRODUCT_LIMIT_REACHED` |

**Field FormData** (tạo + sửa, `parseProductFields`) — quy ước **vắng mặt = giữ nguyên**, **có mặt nhưng rỗng = xoá**
(trừ `priceVnd`/`downloadLimit`: rỗng = giữ nguyên):
`title` (bắt buộc, ≤200) · `slug` (chỉ khi tạo, tuỳ chọn; không đổi sau khi tạo) · `type`
(`TEMPLATE|SLIDE|EBOOK|EXAM|OTHER`, mặc định `OTHER`) · `summary` (văn bản thuần ≤300, `normalizeProductSummary`) ·
`description` (HTML, sanitize lại ở server bằng `sanitizeRichTextHtml(..., { imageCloudName })` — `<img>` ngoài cloud
hệ thống bị loại, ADR-028) · `coverImageUrl` (URL Cloudinary, zod kiểm host rồi `isCloudinaryImageUrl(url, cloudName hệ
thống)` — cloud khác → `INVALID_COVER_IMAGE_URL`) · `visibility` (`PUBLIC|PRIVATE`, vắng mặt = không đổi trạng thái) · `categoryId` · `tags`
(phân tách dấu phẩy) · `priceVnd` (int 0…1 000 000 000) · `salePriceVnd` (phải < giá gốc) · `saleStartsAt`/`saleEndsAt`
(`datetime-local` giờ VN, ghép `+07:00`; kết thúc phải sau bắt đầu) · `downloadLimit` (0…1000, 0 = không giới hạn).

| Action | Tham số | Hành vi / kết quả |
| :-- | :-- | :-- |
| `createProductAction` | `(tenantSlug, prev, formData)` | Tạo bản **nháp**. Không `visibility` → `{ ok, productId }`. `PRIVATE` → `{ ok, saved, productId, published: false }`. `PUBLIC` → tạo rồi thử `publishProduct`: thành công `{ ok, saved, productId, published: true }`; chưa đủ điều kiện → sản phẩm **vẫn được tạo ở dạng nháp**, trả `{ ok: true, saved: true, productId, published: false, publishReasons, error }` |
| `updateProductAction` | `(tenantSlug, productId, prev, formData)` | Lưu. Không `visibility` → `{ ok, productId }`. `PRIVATE` → lưu + (nếu đang `PUBLISHED`) chuyển `DRAFT` **trong cùng một lệnh update** → `{ ok, saved, productId, published }`. `PUBLIC` → lưu rồi `publishProduct`; chưa đủ điều kiện → `{ error, saved: true, productId, published: false, publishReasons }` (**không có `ok`** — khác `createProductAction`) |
| `saveAndPublishProductAction` | `(tenantSlug, productId, prev, formData)` | Như `updateProductAction` với `visibility=PUBLIC` ép buộc (giữ cho UI cũ) |
| `getProductCoverUploadSignatureAction` | `(tenantSlug)` | (ADR-028) Chữ ký ảnh bìa qua `createTenantImageUploadSignature(tenant.id, "PRODUCT_COVER")`: kiểm hạn mức ảnh, ký `public_id` đầy đủ `<uploadFolder>/tenants/<tenantId>/products/<24 hex>`, `allowed_formats` png/jpg/jpeg/webp, incoming transformation ≤2000px, giữ chỗ 5MB. Không cần `productId`. Trả `CloudinarySignatureResult` (§11). Sau upload gọi `registerTenantImageAction(..., "PRODUCT_COVER")` |
| `addProductLinkAction` | `(tenantSlug, productId, prev, formData{label, url})` | Thêm link ngoài (nhãn 1…200 ký tự, URL qua allowlist) → `{ ok, link }` |
| `updateProductLinkAction` | `(tenantSlug, productId, linkId, prev, formData{label, url})` | Sửa nhãn/URL link; khách đã mua nhận URL mới ở lần mở kế tiếp → `{ ok, link }` |
| `removeProductLinkAction` | `(tenantSlug, productId, linkId)` | Gỡ mềm (`removedAt`) → `{ ok }` |
| `removeProductFileAction` | `(tenantSlug, productId, fileId)` | Gỡ mềm file (`removedAt`, không xoá object) **và trừ `storageUsedBytes`** → `{ ok }` |
| `publishProductAction` / `unpublishProductAction` / `archiveProductAction` / `restoreProductAction` | `(tenantSlug, productId)` | Đổi trạng thái (`restore`: `ARCHIVED → DRAFT`) → `{ ok }` hoặc `{ error, publishReasons? }` |

Mọi action thành công gọi `revalidateProduct` ✅ (đọc code 2026-09-28): `/studio/<slug>/products` (+ trang sửa khi có
`productId`), **trang tài liệu** `revalidatePath("/[tenantSlug]/[productSlug]", "page")` (theo route pattern — làm mới trang
tài liệu của mọi tenant, vì action không có slug) và **storefront** `/<slug>` (ADR-030). `createProductAction`: slug tự nhập
trùng từ dành riêng → `INVALID_SLUG` (map vào `fieldErrors.slug`); slug tự sinh trùng → thêm hậu tố. Nghiệp vụ chi tiết:
[[02-System-Specs/Product-Editor-And-Publishing-Specs|Product-Editor-And-Publishing-Specs]].

---

## 11. Server Actions — Ảnh Cloudinary hệ thống (ADR-028)

Đối chiếu code 2026-09-27 ✅. Luồng đầy đủ: [[02-System-Specs/File-Storage-And-Downloads-Specs|File-Storage-And-Downloads-Specs]] §7.

**`CloudinarySignatureResult`** (`apps/web/lib/cloudinary-signature.ts`; re-export từ `app/_ui/cloudinary-actions.ts`) =
`CloudinaryUploadSignature` + `{ ok, error?, errorCode? }`:

| Trường | Nghĩa |
| :-- | :-- |
| `ok: boolean` | `false` → đọc `error` (tiếng Việt, hiển thị được) + `errorCode`; các trường chữ ký là giá trị rỗng |
| `error?`, `errorCode?` | Chỉ khi `ok: false` — từ `AppError` có `expose`. Lỗi khác bị ném tiếp (Next trả lỗi chung, không lộ chi tiết) |
| `cloudName`, `apiKey`, `timestamp`, `signature` | Tham số chuẩn Cloudinary signed upload (`apiSecret` không rời server) |
| `folder` | Thông tin. Với chữ ký có `publicId`, folder đã nằm trong public id — **không gửi riêng** |
| `allowedFormats?` | Chuỗi định dạng đã ký (vd `png,jpg,jpeg,webp`) |
| `publicId?` | (Chữ ký tenant) public id đầy đủ do server sinh `<root>/tenants/<id>/<content\|products\|storefront\|posts>/<24 hex>` (`posts` từ M10b) |
| `transformation?` | (Chữ ký tenant) incoming transformation đã ký, hiện `c_limit,w_2000,h_2000` |
| `uploadParams: Record<string,string>` | **Đúng bộ tham số đã ký** (trừ `api_key`/`signature`). Client gửi NGUYÊN VẸN cùng `file`, `api_key`, `signature` tới `POST https://api.cloudinary.com/v1_1/<cloudName>/image/upload` — thêm/bớt/sửa là Cloudinary từ chối |

| Action | File | Guard | Tham số | Kết quả |
| :-- | :-- | :-- | :-- | :-- |
| `getCloudinaryUploadSignatureAction` | `app/_ui/cloudinary-actions.ts` | `requireRole("SYSTEM_ADMIN")` (**trước đây `requireUser()`**) | `()` | `CloudinarySignatureResult` ký `folder` = root + `allowed_formats` png/jpg/jpeg/webp/svg. Không tính hạn mức |
| `getContentImageUploadSignatureAction` | `studio/[tenantSlug]/media-actions.ts` | `requireTenantMember` | `(tenantSlug)` | Chữ ký ảnh mô tả (usage `CONTENT`), giữ chỗ 5MB |
| `getProductCoverUploadSignatureAction` | `studio/[tenantSlug]/products/actions.ts` | `requireTenantMember` | `(tenantSlug)` | Chữ ký ảnh bìa (usage `PRODUCT_COVER`) — §10 |
| `getTenantCloudinaryUploadSignatureAction` | `studio/[tenantSlug]/storefront/actions.ts` | `requireTenantMember` | `(tenantSlug)` | Chữ ký ảnh storefront (usage `STOREFRONT`) |
| `getPostImageUploadSignatureAction` | `studio/[tenantSlug]/posts/actions.ts` | `requireTenantMember` | `(tenantSlug)` | (M10b) Chữ ký ảnh bài viết (usage `POST`, folder `tenants/<id>/posts`), tính hạn mức — §13 |
| `registerTenantImageAction` | `studio/[tenantSlug]/media-actions.ts` | `requireTenantMember` | `(tenantSlug, publicId, usage: string)` | Gọi **ngay sau** upload thành công, với `public_id` Cloudinary trả về và đúng `usage` của chữ ký. Trả `RegisterTenantImageResult` |

**`RegisterTenantImageResult`**: `{ ok: true, url, verified }` — `url` là `secure_url` (đã kiểm đúng cloud hệ thống; nếu
không thì URL dựng từ `public_id`) để lưu vào form/HTML; hiển thị qua `cloudinaryDeliveryUrl`; `verified: false` = Admin
API lỗi, đang tính mức tạm 5MB, đối soát sau. Hoặc `{ ok: false, error, errorCode }`.

`tenant.id` luôn lấy từ guard, không từ client. Số `bytes/format/width/height` đọc từ Cloudinary Admin API, không nhận
từ client.

**Mã lỗi (ADR-028)** — đều là `AppError` `expose`, trả dạng `ok: false` + `errorCode`:

| Mã | HTTP (trong AppError) | Khi nào |
| :-- | :-- | :-- |
| `IMAGE_QUOTA_EXCEEDED` | 403 | Lúc xin chữ ký, tổng `bytes` ảnh của tenant ≥ `Plan.imageStorageMb`. Thông điệp: "Đã dùng hết <N>MB/GB dung lượng ảnh của gói hiện tại. Hãy xoá bớt ảnh không dùng hoặc nâng cấp gói để tải thêm ảnh." — UI hiện link nâng gói |
| `INVALID_IMAGE_PUBLIC_ID` | 400 | `publicId` rỗng/>300 ký tự, không đúng tiền tố `<root>/tenants/<tenantId>/<folder của usage>/` hoặc tên không phải 24 hex — kiểm **trước** khi gọi Admin API |
| `IMAGE_NOT_FOUND` | 404 | Admin API xác nhận không có asset (upload hỏng/huỷ) → xoá dòng giữ chỗ |
| `INVALID_IMAGE_USAGE` | 400 | `usage` không thuộc `CONTENT \| PRODUCT_COVER \| STOREFRONT \| POST` (`POST` từ M10b, `isTenantMediaUsage`) |
| `CLOUDINARY_NOT_CONFIGURED` | 400 | Cloudinary hệ thống chưa cấu hình (register) hoặc chưa cấu hình/đang tắt (ký) |

**System Admin — gói (`/admin/plans`)** ✅: form tạo/sửa gói có ô **"Dung lượng ảnh (MB)"** (field FormData
`imageStorageMb`, `z.coerce.number()` rồi `plan-validation.ts` yêu cầu số nguyên ≥ 0; mặc định form tạo mới 100).

---

## 12. Server Actions & hàm lib — Đánh giá sản phẩm (M10a, ADR-029)

Đối chiếu code 2026-09-28 ✅. Nghiệp vụ: [[02-System-Specs/Reviews-Specs|Reviews-Specs]]. Không có `route.ts` nào cho đánh giá;
không có hàm/route nào cho System Admin (§7.9).

### 12.1. Server Actions

| Action | File | Guard | Tham số | Kết quả |
| :-- | :-- | :-- | :-- | :-- |
| `upsertMyReviewAction` | `app/[tenantSlug]/[productSlug]/review-actions.ts` (ADR-030) | `requireVerified()` (đã xác minh email) | `(productId, prevState, formData)` — dùng `useActionState(upsertMyReviewAction.bind(null, productId), null)`; FormData `rating` ("1".."5"), `body` (tuỳ chọn) | `ReviewFormState`. Tạo mới → `after()` gửi email `review_new` cho chủ tenant |
| `deleteMyReviewAction` | cùng file | `requireVerified()` | `(reviewId)` | `ReviewFormState` (`success`) — xoá thật, tính lại điểm |
| `replyReviewAction` | `app/studio/[tenantSlug]/reviews/actions.ts` | `requireTenantMember` | `(tenantSlug, reviewId, reply)` — `reply` rỗng sau trim = xoá trả lời | `ReviewModerationState` |
| `hideReviewAction` | cùng file | `requireTenantMember` | `(tenantSlug, reviewId, reason)` — `reason` ∈ `SPAM \| OFFENSIVE \| IRRELEVANT \| PERSONAL_INFO \| OTHER` | `ReviewModerationState` |
| `unhideReviewAction` | cùng file | `requireTenantMember` | `(tenantSlug, reviewId)` | `ReviewModerationState` (đánh giá đã `VISIBLE` → thành công, không làm gì) |

- **`ReviewFormState`** = `{ success?, error?, code?, review?: MyReview, created?: boolean }`. `code` ổn định:
  `VALIDATION_ERROR` · `REVIEW_NOT_ELIGIBLE` · `REVIEW_ALREADY_EXISTS` · `RATE_LIMITED` · `UNAUTHORIZED` · `FORBIDDEN`.
- **`ReviewModerationState`** = `{ success?, error?, code? }`. `code`: `VALIDATION_ERROR` · `REVIEW_NOT_FOUND` ·
  `REVIEW_INVALID_HIDE_REASON` · `REVIEW_REFUNDED_LOCKED` · `FORBIDDEN` · `UNAUTHORIZED` · `NOT_FOUND`.
- Lỗi `AppError` có `expose` → trả trong state; lỗi khác bị ném tiếp (Next trả lỗi chung).
- `productId`, `tenantId`, `orderItemId`, `displayName` của đánh giá đều suy ở server (§7.5); `tenant.id` của action Studio
  luôn lấy từ guard. CSRF: cơ chế Server Action (§7.7).
- Revalidate ✅ (đọc code 2026-09-28): action khách → `revalidatePath("/[tenantSlug]/[productSlug]", "page")`,
  `revalidatePath("/[tenantSlug]", "page")`, `/account/library`; action Studio → layout `/studio/<slug>` (badge sidebar) + 2
  trang công khai trên (cùng route pattern).

### 12.2. Hàm lib (`apps/web/lib/review.ts`) — gọi từ Server Component

| Hàm | Scope RLS | Trả về / ghi chú |
| :-- | :-- | :-- |
| `getReviewEligibility(userId, productId)` | `withCustomer` (+ L1 `userProfile`) | `ReviewEligibility` = `{ canReview, existing: MyReview \| null, displayNamePreview }` |
| `upsertMyReview(userId, productId, { rating, body })` | `withCustomer` (+ `withSystemJob` khi khôi phục `REFUNDED`) | `{ review: MyReview, created, tenantId }` |
| `deleteMyReview(userId, reviewId)` | `withCustomer` | `{ productId }` |
| `getMyReviewsByProduct(userId, productIds)` | `withCustomer` | `Map<productId, { id, rating, status }>` cho Thư viện |
| `listTenantReviews(tenantId, filter?, cursor?)` | `withTenant` | `{ items: TenantReviewItem[], nextCursor }` — 20/trang, lọc `status`/`productId`/`rating` |
| `countReviewsNeedingAttention(tenantId)` | `withTenant` | Số `VISIBLE` chưa trả lời — badge sidebar |
| `countNewTenantReviews(tenantId, days = 7)` | `withTenant` | Số đánh giá tạo trong N ngày (mọi trạng thái) — ô Tổng quan |
| `replyToReview` / `hideReview` / `unhideReview` | `withTenant` | Dùng bởi action §12.1 |
| `listStorefrontReviewOptions(tenantId)` | `withTenant` | `StorefrontReviewOption[]` (≤ 200, `VISIBLE`, sản phẩm `PUBLISHED`) cho ô ghim trong editor storefront |
| `getProductReviews(productId, cursor?, limit = 10)` | `withPublic` | `{ items: PublicReview[], nextCursor }`; `limit` kẹp 1–50 (`PRODUCT_REVIEWS_PAGE_SIZE` 10, `..._MAX` 50) |
| `getProductRatingSummary({ id, ratingSum, ratingCount })` | `withPublic` | `ProductRatingSummary` = `{ average: number \| null, count, distribution: {1..5} }` |
| `getStorefrontReviews(tenantId, data)` | `withPublic` | `StorefrontReviewItem[]` (= `PublicReview` + `productTitle`, `productSlug`) cho section `reviews` |
| `recomputeProductRatings(productIds)` | `withSystemJob` + advisory lock | Tính lại cache điểm — nội bộ |
| `hideReviewsForRevokedItems(tx, tenantId, orderItemIds)` | transaction của caller | Nội bộ, gọi từ `markOrderRefunded`/`revokeEntitlement` |
| `notifyTenantOwnerOfReview({ tenantId, productId, reviewId })` | L1 `tenant` + `withTenant` | Email `review_new`, không ném lỗi |

- **`PublicReview`** = `{ id, rating, body, displayName, verifiedPurchase: true, reply, repliedAt, createdAt }` — không có
  `userId`/`orderItemId`/trạng thái ẩn.
- **`MyReview`** = `{ id, productId, rating, body, displayName, status, hiddenReason, reply, repliedAt, createdAt, updatedAt }`.

### 12.3. Kiểu dữ liệu mở rộng ở module khác ✅

| Kiểu | File | Trường thêm |
| :-- | :-- | :-- |
| `PublicProduct` (thẻ tài liệu storefront) | `apps/web/lib/storefront.ts` | `ratingAvg: number \| null` (từ `computeRatingAverage`), `ratingCount: number` |
| `ProductPreviewData.product` | `apps/web/lib/product.ts` | `ratingSum: number`, `ratingCount: number` (đưa vào `getProductRatingSummary`) |
| `LibraryEntitlement` | `apps/web/lib/library.ts` | `canReview: boolean` (= entitlement chưa thu hồi), `review: { id, rating, status } \| null` |

### 12.4. Mã lỗi & subpath

| Mã | HTTP (trong AppError) | Khi nào |
| :-- | :-- | :-- |
| `REVIEW_NOT_ELIGIBLE` | 403 | Không có đơn `FULFILLED` + entitlement chưa thu hồi; hoặc RLS/trigger từ chối (42501) |
| `REVIEW_NOT_FOUND` | 404 | Không có đánh giá đúng id (trong tenant / của chính khách) |
| `REVIEW_ALREADY_EXISTS` | 409 | Vi phạm unique `(productId, userId)` khi 2 lần tạo đua nhau |
| `REVIEW_REFUNDED_LOCKED` | 409 | Tenant ẩn/khôi phục đánh giá đang `HIDDEN(REFUNDED)` |
| `REVIEW_INVALID_HIDE_REASON` | 400 | Lý do ẩn không thuộc 5 lý do tenant được chọn |
| `RATE_LIMITED` | 429 | > 5 lần tạo/sửa / 10 phút / user (mã chung `@gieochu/core` `rateLimited`) |
| `VALIDATION_ERROR` | 400 | Sao ngoài 1–5, nội dung/trả lời > 2000 ký tự, id không hợp lệ |

Mã `REVIEW_*` khai trong `REVIEW_ERROR_CODES` của `apps/web/lib/review.ts` (không nằm trong `ErrorCodes` của
`@gieochu/core`). **Subpath `@gieochu/core/review`** (`packages/core/package.json` exports → `src/review/review.ts`): logic
thuần không phụ thuộc Node/DB để client component import — `formatReviewerDisplayName`, `normalizeReviewText`,
`parseReviewRating`, `computeRatingAverage`, `isTenantReviewHideReason`, hằng `REVIEW_BODY_MAX_LENGTH`/`REVIEW_REPLY_MAX_LENGTH`
(2000), `REVIEW_HIDDEN_REASONS`, `TENANT_REVIEW_HIDE_REASONS`, `REVIEW_HIDDEN_REASON_LABELS`, `REVIEW_ANONYMOUS_NAME`
("Khách hàng"); cũng re-export từ `@gieochu/core`.

---

## 13. Server Actions & hàm lib — Bài viết (M10b, ADR-029)

Đối chiếu code 2026-09-28 ✅. Nghiệp vụ: [[02-System-Specs/Posts-Specs|Posts-Specs]]. Không có `route.ts` nào cho bài viết;
không có hàm/route nào cho System Admin (§7.9).

### 13.1. Server Actions (`app/studio/[tenantSlug]/posts/actions.ts`)

Mọi action: guard `requireTenantMember(tenantSlug)`; `tenant.id` luôn lấy từ guard; CSRF theo cơ chế Server Action (§7.7).

| Action | Tham số | Kết quả |
| :-- | :-- | :-- |
| `createPostAction` | `(tenantSlug, prevState, formData)` — FormData `title` (tuỳ chọn, ≤200), `body` (HTML Tiptap, sanitize ở server, ≤6 ảnh), `productId` (tuỳ chọn, rỗng = không gắn), `status` (`PUBLISHED` \| `DRAFT`, vắng = `DRAFT`) | `PostActionState` — thành công `{ ok, postId, published }` (UI chuyển sang `/studio/[slug]/posts/[postId]`) |
| `updatePostAction` | `(tenantSlug, postId, prevState, formData)` — cùng field; **field vắng mặt = giữ nguyên**; `productId` có mặt nhưng rỗng = bỏ gắn; `status=DRAFT` trên bài đang đăng = gỡ bài; `status` vắng = giữ | `PostActionState` `{ ok, postId, published }`. Bài `HIDDEN` → `POST_HIDDEN_LOCKED` |
| `deletePostAction` | `(tenantSlug, postId)` — xoá hẳn, không khôi phục (được với cả bài `HIDDEN`) | `PostActionState` `{ ok }` |
| `pinPostAction` | `(tenantSlug, postId, pinned: boolean)` — ghim tự bỏ ghim bài khác | `PostActionState` `{ ok, postId }`; đua ghim → `POST_PIN_CONFLICT` |
| `getPostImageUploadSignatureAction` | `(tenantSlug)` | `CloudinarySignatureResult` (§11) usage `POST`; sau upload gọi `registerTenantImageAction(tenantSlug, publicId, "POST")` (`studio/[tenantSlug]/media-actions.ts`) để lấy `url` chèn vào nội dung |

- **`PostActionState`** = `{ ok?, error?, errorCode?, fieldErrors?: Record<string,string>, postId?, published? }` (giống
  `ProductActionState`). `fieldErrors` theo field FormData: `POST_TITLE_INVALID` → `title`; `POST_BODY_REQUIRED` /
  `POST_BODY_TOO_LONG` / `POST_TOO_MANY_IMAGES` → `body`; `POST_PRODUCT_INVALID` → `productId`; `status` sai →
  `VALIDATION_ERROR` + `fieldErrors.status`.
- Lỗi `AppError` có `expose` → trả trong state; lỗi khác bị ném tiếp.
- Revalidate: `/studio/<slug>/posts` (+ `/studio/<slug>/posts/<id>`), `/<slug>`, `/<slug>/posts` (+ `/<slug>/posts/<id>`).

### 13.2. Hàm lib (`apps/web/lib/post.ts`) — gọi từ Server Component

| Hàm | Scope RLS | Trả về / ghi chú |
| :-- | :-- | :-- |
| `listTenantPosts(tenantId, filter?: { status? }, cursor?)` | `withTenant` | `{ items: TenantPostListItem[], nextCursor }` — 20/trang (`TENANT_POSTS_PAGE_SIZE`), ghim trước rồi mới tạo trước. `TenantPostListItem` = `{ id, title, excerpt, status, hiddenReason, isPinned, publishedAt, createdAt, updatedAt, imageUrl, product: { id, title, status } \| null }` — `imageUrl` = ảnh Cloudinary hệ thống **hợp lệ đầu tiên** trong nội dung, rộng 320 (`POST_STUDIO_THUMB_WIDTH`), hoặc `null`; danh sách **không trả `body`** |
| `listPostProductOptions(tenantId)` | `withTenant` | `PostProductOption[]` = `{ id, title, status }` — sản phẩm chưa `ARCHIVED`, mới cập nhật trước, ≤ 200 |
| `getPostForEditor(tenantId, postId)` | `withTenant` | `PostEditorData` = `{ post, productOptions }`; `post` gồm `body` (HTML đã sanitize lúc lưu — nạp vào TiptapEditor) **và `bodyHtml`** (sanitize lại lúc đọc theo cloud hệ thống, ảnh rộng 1536 — chỉ để render trực tiếp, vd xem bài `HIDDEN`); `productOptions` thêm sản phẩm đang gắn (kể cả đã lưu trữ). Không có / sai tenant → `POST_NOT_FOUND` (404) |
| `postDisplayTitle({ title, excerpt })` | — | Tiêu đề → ~60 ký tự đầu trích đoạn → "Bài viết" |
| `listPublishedPosts(tenantId, cursor?, limit?)` | `withPublic` | `{ items: PublicPostSummary[], nextCursor }` — mặc định 12, tối đa 30; bài ghim đầu trang 1 |
| `getStorefrontPosts(tenantId, data: StorefrontPostsData)` | `withPublic` | `PublicPostSummary[]` — `limit` kẹp 3–9; `showPinnedFirst` |
| `getPublishedPost(tenantId, postId)` | `withPublic` | `PublicPostDetail \| null` — `null` khi không có / không `PUBLISHED` / tenant `LOCKED` (RLS) |
| `getPublishedPostMeta(tenantId, postId)` | `withPublic` | `{ title, excerpt } \| null` — cho `generateMetadata`, không đọc body |
| `createPost` / `updatePost` / `deletePost` / `setPostPinned` / `preparePostBody` / `isValidPostId` | `withTenant` | Dùng bởi action §13.1 |
| `getPublicProductsByIds(tenantId, ids)` (`apps/web/lib/storefront.ts`) | `withPublic` | `PublicProduct[]` — chỉ sản phẩm `PUBLISHED` trong danh sách id (khử trùng); dùng cho thẻ "Tài liệu liên quan" |

- **`PublicPostSummary`** = `{ id, title, excerpt, imageUrl (ảnh đầu, rộng 640) \| null, isPinned, publishedAt, product:
  PublicPostProduct \| null }`; **`PublicPostDetail`** = như trên bỏ `imageUrl`, thêm `bodyHtml`, `updatedAt`.
  **`PublicPostProduct`** = `Pick<PublicProduct, "id" | "slug" | "title" | "priceVnd" | "effectivePriceVnd" | "onSale" |
  "coverUrl">` — chỉ có khi sản phẩm còn `PUBLISHED`.
- Id từ URL/FormData phải khớp `^[a-z0-9]{1,40}$` (`isValidPostId`) trước khi vào truy vấn.

### 13.3. Mã lỗi & subpath

| Mã | HTTP (trong AppError) | Khi nào |
| :-- | :-- | :-- |
| `POST_NOT_FOUND` | 404 | Không có bài đúng id trong tenant |
| `POST_BODY_REQUIRED` | 400 | Sau sanitize không còn chữ và không có ảnh |
| `POST_BODY_TOO_LONG` | 400 | HTML > 100 000 ký tự (trước hoặc sau sanitize) |
| `POST_TITLE_INVALID` | 400 | Tiêu đề > 200 ký tự |
| `POST_TOO_MANY_IMAGES` | 400 | > 6 ảnh sau sanitize |
| `POST_PRODUCT_INVALID` | 400 | Sản phẩm không thuộc tenant / đã `ARCHIVED` / id sai; hoặc RLS/trigger từ chối (42501) |
| `POST_HIDDEN_LOCKED` | 403 | Sửa/đăng lại/ghim bài `HIDDEN` |
| `POST_PIN_CONFLICT` | 409 | Hai lần ghim đồng thời vi phạm partial unique index (`P2002`) |
| `FORBIDDEN` | 403 | Tenant không `ACTIVE` (`assertTenantCanWrite`) |

Mã `POST_*` khai trong `POST_ERROR_CODES` của `apps/web/lib/post.ts` (không nằm trong `ErrorCodes` của `@gieochu/core`).
**Subpath `@gieochu/core/post`** (`packages/core/package.json` exports → `src/content/post.ts`): logic thuần, client component
import được — `normalizePostTitle`, `htmlToPlainText`, `buildPostExcerpt`, `countRichTextImages`, `richTextImageSrcs(html)`
(mọi `src` ảnh theo thứ tự), `firstRichTextImageSrc(html, accept?)` (ảnh đầu tiên thoả `accept` — `lib/post.ts` truyền
`isCloudinaryImageUrl(src, cloud hệ thống)` để chọn ảnh **hợp lệ** đầu tiên cho thẻ Studio/công khai),
hằng `POST_TITLE_MAX_LENGTH` (200), `POST_EXCERPT_MAX_LENGTH` (300), `POST_MAX_IMAGES` (6), `POST_BODY_MAX_LENGTH` (100 000),
`POST_STATUS_LABELS` ("Bản nháp" / "Đã đăng" / "Bị ẩn do vi phạm"); cũng re-export từ `@gieochu/core`. Section storefront:
`StorefrontPostsData`, `STOREFRONT_POSTS_LIMIT_MIN/MAX` (3/9), `defaultStorefrontPostsSection` (`@gieochu/core`).

---

## 14. Tài Liệu Tham Chiếu & Liên Kết

* [[MOC-Home]] — Trang chủ Map of Content ([MOC-Home.md](../00-Index/MOC-Home.md))
* [[Database-Schema-Reference]] — Lược đồ dữ liệu ([Database-Schema-Reference.md](./Database-Schema-Reference.md))
* [[03-API-Contracts/README|README]] — Giới thiệu thư mục ([README.md](./README.md))
* [[02-System-Specs/Product-Editor-And-Publishing-Specs|Product-Editor-And-Publishing-Specs]] ([Product-Editor-And-Publishing-Specs.md](../02-System-Specs/Product-Editor-And-Publishing-Specs.md))
* [[02-System-Specs/File-Storage-And-Downloads-Specs|File-Storage-And-Downloads-Specs]] §7 — luồng ảnh Cloudinary ADR-028 ([File-Storage-And-Downloads-Specs.md](../02-System-Specs/File-Storage-And-Downloads-Specs.md))
* [[01-Architecture-Decisions/ADR-014-System-Cloudinary-Image-Quota|ADR-014 (≙ ADR-028)]] ([ADR-014-System-Cloudinary-Image-Quota.md](../01-Architecture-Decisions/ADR-014-System-Cloudinary-Image-Quota.md))
* [[02-System-Specs/Reviews-Specs|Reviews-Specs]] — nghiệp vụ đánh giá M10a ([Reviews-Specs.md](../02-System-Specs/Reviews-Specs.md)) · [[01-Architecture-Decisions/ADR-015-M10-Reviews-Posts-Rls-Split-Writes|ADR-015 (≙ ADR-029)]] ([ADR-015-M10-Reviews-Posts-Rls-Split-Writes.md](../01-Architecture-Decisions/ADR-015-M10-Reviews-Posts-Rls-Split-Writes.md))
* [[02-System-Specs/Posts-Specs|Posts-Specs]] — nghiệp vụ bài viết M10b ([Posts-Specs.md](../02-System-Specs/Posts-Specs.md))
* [[01-Architecture-Decisions/ADR-016-Short-Product-Url-No-Sticky-Publish-Card|ADR-016 (≙ ADR-030)]] — URL tài liệu rút gọn, redirect 301 ([ADR-016-Short-Product-Url-No-Sticky-Publish-Card.md](../01-Architecture-Decisions/ADR-016-Short-Product-Url-No-Sticky-Publish-Card.md))

*Quay lại: [[MOC-Home]] (../00-Index/MOC-Home.md)*

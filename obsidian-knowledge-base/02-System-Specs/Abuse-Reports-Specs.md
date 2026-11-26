---
tags:
  - spec
  - abuse-report
  - moderation
  - entitlement
  - system-admin
  - security
  - database
  - status/living
date: 2026-10-17
updated: 2026-10-17
author: Long
---

# 📐 Đặc Tả: Báo Cáo Vi Phạm & Quyền Lợi Người Mua (M12c — ADR-038, ADR-039)

> Quyết định gốc trong [`docs/DECISIONS.md`](../../docs/DECISIONS.md): **ADR-038** (M12c Báo cáo vi phạm — ai cũng báo cáo được, ẩn
> danh với tenant, khoá kiểm duyệt, cam kết bản quyền) và **ADR-039** + đoạn "Bổ sung ADR-039" (quyền lợi người mua khi tài liệu bị
> xác nhận vi phạm: chọn "tải lần cuối" hoặc "yêu cầu hoàn tiền"). Bản trích KB:
> [[01-Architecture-Decisions/ADR-024-M12c-Abuse-Reports-Moderation-Lock|ADR-024 (≙ ADR-038)]],
> [[01-Architecture-Decisions/ADR-025-Buyer-Remedy-Final-Download-Or-Refund|ADR-025 (≙ ADR-039)]]; ADR-040 (chỉ gian hàng `ACTIVE` công khai
> nội dung — [[01-Architecture-Decisions/ADR-026-Only-Active-Tenant-Shows-Documents|ADR-026 (KB)]]) đổi điều kiện đối tượng ở §3. M12 chia 3 đợt (ADR-037): M12a
> [[02-System-Specs/Audit-Log-Specs|Audit log]] → M12b [[02-System-Specs/Tenant-Stats-Specs|Thống kê]] → **M12c Báo cáo vi phạm** (trang này).
>
> Mức xác minh: ✅ Long đã đối chiếu code working tree 2026-10-17 (code **đã commit `36103fb`**, deploy ❓) · 🟡 theo brief/báo cáo của Quốc ·
> ❓ cần môi trường thật. Trạng thái migration: **2 migration đã áp lên DB dùng chung 2026-10-16** 🟡 (Quốc báo; Long không chạy lệnh DB).

---

## 1. Phạm vi

- Bảng L1 `abuse_reports` + 4 enum; cột khoá kiểm duyệt trên `products`/`reviews`/`posts`; cột cam kết bản quyền trên `products`
  (migration `20261016150000_m12c_abuse_reports`) ✅ đọc SQL.
- Cột quyền lợi người mua `remedy*` trên `entitlements` + enum `EntitlementRemedyStatus` (migration
  `20261016180000_adr039_entitlement_remedy`) ✅ đọc SQL.
- Route công khai `POST /api/reports`; nút "Báo cáo vi phạm" trên trang tài liệu, từng đánh giá, trang bài viết ✅.
- System Center `/admin/reports` (danh sách + chi tiết + xử lý + gỡ khoá), badge số báo cáo OPEN trên sidebar ✅.
- Thư viện khách: 2 lựa chọn khi tài liệu bị gỡ; Studio → Đơn hàng: yêu cầu hoàn tiền, lọc, badge ✅.
- **Không** thuộc M12c: báo cáo bình luận (bình luận chưa có — M10c), captcha/dịch vụ chống spam ngoài (ADR-038 mục 2), test tự động
  (ADR-038 mục 8 / ADR-039 mục 6 — nợ BACKLOG).

---

## 2. Dữ liệu

Chi tiết cột/CHECK/trigger: [[03-API-Contracts/Database-Schema-Reference|Database-Schema-Reference]] (mục `abuse_reports`, migration M12c,
migration ADR-039).

### 2.1. `abuse_reports` — L1, không RLS ✅

- Đối tượng: `targetType` (`AbuseTargetType`: `PRODUCT` · `REVIEW` · `POST`), `targetId` (không FK — đối tượng có thể bị xoá),
  `tenantId` (FK `tenants` `ON DELETE CASCADE`).
- Nội dung: `type` (`AbuseReportType`: `COPYRIGHT` · `INAPPROPRIATE` · `SCAM` · `OTHER`), `description` (1–2000 ký tự, CHECK),
  `evidenceUrls TEXT[]` (≤5, CHECK số phần tử; định dạng http/https kiểm ở server).
- Người báo cáo: `reporterUserId?` (FK `users` `SET NULL`), `reporterEmail` (3–320 ký tự, CHECK), `ip?`.
- Xử lý: `status` (`AbuseReportStatus`: `OPEN` · `RESOLVED` · `REJECTED`), `decision?` (`AbuseReportDecision`: `HIDE_CONTENT` ·
  `ARCHIVE_PRODUCT` · `LOCK_TENANT` · `REJECT`), `resolutionNote?` (ghi chú nội bộ), `resolvedById?` (FK `users` `SET NULL`),
  `resolvedAt?`.
- CHECK `abuse_reports_decision_shape`: `OPEN` ⇔ chưa có `decision`/`resolvedAt`; `REJECTED` ⇔ `REJECT`; `RESOLVED` ⇔ một trong 3 biện
  pháp; đã xử lý thì có `resolvedAt`.
- Quyền `gieochu_app`: SELECT/INSERT/UPDATE/DELETE (DELETE chỉ để dọn dữ liệu test/vận hành — ứng dụng không xoá báo cáo).
- **Ẩn danh với tenant (ADR-038 mục 4):** chỉ `apps/web/lib/abuse-report.ts` đọc bảng, mọi loader tự `requireRole("SYSTEM_ADMIN")`;
  tenant không có đường đọc nào ✅ (grep `abuseReport` trong `apps/web`: chỉ `lib/abuse-report.ts` và `markOrderPaid` trong `lib/order.ts`
  — chỗ sau chỉ lấy `id` báo cáo gây khoá, xem §6.5).

### 2.2. Khoá kiểm duyệt trên `products` / `reviews` / `posts` ✅

- Cột `moderationLockedAt?` + `moderationReason?` (= nhãn loại vi phạm, ví dụ "Vi phạm bản quyền" — không chứa danh tính người báo cáo).
- CHECK: khoá chỉ tồn tại khi nội dung đang ẩn — `products` ⇒ `ARCHIVED`; `reviews`/`posts` ⇒ `HIDDEN`.
- Trigger `<bảng>_guard_moderation` (BEFORE INSERT OR UPDATE, `ERRCODE 42501`): ngoài scope `system_job` — không tạo dòng có khoá, không
  đặt/gỡ khoá, và khi đang khoá thì không đổi `status` (với `reviews` thêm `hiddenReason`, `hiddenAt`). Role owner (không đặt `app.scope`)
  cũng bị áp. Mẫu "trigger giới hạn cột theo scope" của ADR-029.
- Lớp app trả lỗi rõ ràng trước khi chạm DB: `assertNotModerationLocked` / `contentModerationLocked()` (`apps/web/lib/moderation.ts`) →
  **409 `CONTENT_MODERATION_LOCKED`** với `CONTENT_MODERATION_LOCKED_MESSAGE`. Cổng thật là trigger.

### 2.3. Cam kết bản quyền trên `products` ✅

`rightsConfirmedAt?` + `rightsConfirmedById?` (không FK) — lần xuất bản gần nhất. Xem §5.

### 2.4. `entitlements.remedy*` (ADR-039) ✅

| Cột | Ý nghĩa |
| :-- | :-- |
| `remedyStatus` (`EntitlementRemedyStatus`, mặc định `NONE`) | `NONE` · `PENDING_CHOICE` · `FINAL_DOWNLOAD` · `REFUND_REQUESTED` · `REFUNDED` |
| `remedyRequestedAt?` | Lúc mở quyền chọn |
| `remedyChosenAt?` | Lúc khách chọn (mốc tính hạn 7 ngày của yêu cầu hoàn tiền) |
| `remedyResolvedAt?` | Lúc tenant xác nhận đã hoàn tiền (chỉ có ở `REFUNDED`) |
| `remedyReportId?` | Id báo cáo gây khoá — không FK (bảng L1), chỉ để truy vết |

Index `(tenantId, remedyStatus)`. CHECK `entitlements_remedy_shape` ép đúng tổ hợp mốc thời gian theo trạng thái; CHECK
`entitlements_remedy_refunded_revoked`: `REFUNDED` ⇒ `revokedAt` NOT NULL. Trigger `entitlements_guard_remedy` — §6.6.

Kiểm trên DB thật bằng `gieochu_app` trong transaction rollback 🟡 (Quốc báo): tenant đặt khoá kiểm duyệt / remedy → `42501`; tenant cấp
thêm lượt khi có remedy → `42501`; `system_job` được; CHECK shape chặn dòng sai hình dạng; checksum migration ADR-039 khớp file.

---

## 3. Gửi báo cáo — `POST /api/reports` ✅

Contract đầy đủ: [[03-API-Contracts/Endpoint-Directory|Endpoint-Directory]] §20.

- **Ai cũng gửi được** (ADR-038 mục 2). Đã đăng nhập → server lấy email tài khoản (bỏ qua `email` gửi lên), `reporterUserId` = user.
  Khách vãng lai → `email` bắt buộc, thiếu → 400 `REPORT_EMAIL_REQUIRED`.
- **Đối tượng phải tồn tại và đang công khai** — đọc dưới `withPublic` (sản phẩm `PUBLISHED`; đánh giá `VISIBLE` của sản phẩm
  `PUBLISHED`; bài `PUBLISHED`) **và gian hàng `ACTIVE`** (ADR-040 — `resolvePublicTarget` đọc `tenants.status` bằng
  `getPrismaClient()` vì `tenants` là L1 không RLS; trước ADR-040 chỉ loại tenant `LOCKED`). Không thoả → 404 `REPORT_TARGET_NOT_FOUND`.
  Hệ quả: nội dung của gian hàng `READ_ONLY` không báo cáo được (khách cũng không còn thấy nội dung đó —
  [[02-System-Specs/Storefront-CMS-Specs|Storefront-CMS-Specs]] §1.2).
- **Chống spam** (chủ dự án chốt, ADR-038 mục 2):
  - Honeypot: ô ẩn `website` có giá trị → trả **201 giả**, không ghi gì (không cho bot biết).
  - Giới hạn **5 báo cáo/giờ/IP** — đếm trong chính `abuse_reports` (`ip`, `createdAt` ≥ 1 giờ trước) → 429 `RATE_LIMITED`.
  - Chặn trùng: cùng người báo cáo (email hoặc `reporterUserId`) + cùng đối tượng đang `OPEN` → 409 `REPORT_DUPLICATE`.
  - Hai kiểm tra trên chạy trong 1 transaction có `pg_advisory_xact_lock` theo IP rồi theo đối tượng (thứ tự cố định) để gửi đồng thời
    không vượt giới hạn.
  - IP không có (header thiếu) → dùng khoá `unknown` và đếm theo `ip IS NULL` — mọi request không IP chung 1 hạn mức ✅ đọc code.
- `Origin` phải khớp (`assertSameOrigin`) → 403 `ORIGIN_MISMATCH` (§7.7 CLAUDE.md).
- Code lên trước migration (bảng chưa có, P2021/42P01) → 503 `REPORT_UNAVAILABLE`.
- Sau khi ghi: audit `REPORT_SUBMITTED` với **`tenantId = null` có chủ đích** (dòng có `tenantId` sẽ hiện ở Studio → Hoạt động của chủ
  gian hàng → lộ việc bị báo cáo/ai báo cáo); metadata chỉ id + loại, không email/mô tả.
- Quốc đã thử trên dev: 201, 409 trùng, 403 thiếu Origin; đã dọn dữ liệu thử 🟡.

Giao diện: `ReportAbuseButton` (`apps/web/app/[tenantSlug]/_ui/report-abuse.tsx`) đặt ở trang tài liệu `/{tenantSlug}/{productSlug}`, từng
đánh giá trên trang đó, và trang bài viết `/{tenantSlug}/posts/{postId}` ✅. Bố cục/a11y:
[[04-Operations-Runbooks/UI-Design-System|UI-Design-System]] §17.

---

## 4. Xử lý của System Admin — `/admin/reports` ✅

### 4.1. Đọc

- `listAbuseReports(sp, paging)` — lọc `status` (mặc định `OPEN`; `ALL` = mọi trạng thái), `type`, `targetType`; mới nhất trước; kèm
  `openCount`. Hiện email người báo cáo (chỉ admin), tiêu đề hiện tại của đối tượng (null = đã xoá).
- `getAbuseReportDetail(id)` — dưới `withSystemJob`: nội dung đối tượng + trạng thái khoá; **đánh giá chỉ hiện sao + nội dung + tên tài
  liệu**, không userId/tên hiển thị/đơn của khách (§7.9); bài viết hiện văn bản thuần (không render HTML). Kèm số báo cáo OPEN khác cùng
  đối tượng, danh sách quyết định hợp lệ, và **số yêu cầu hoàn tiền quá hạn của tenant** (ADR-039, chỉ số đếm).
- `countOpenAbuseReports()` — badge "Báo cáo vi phạm" ở sidebar System Center (nhóm "Giám sát", `IconFlag`); bảng chưa có → 0.

### 4.2. Quyết định — `resolveReportAction(reportId, prev, formData)` → `resolveAbuseReport`

Quyết định hợp lệ theo loại đối tượng (`allowedAbuseDecisions`): tài liệu → `ARCHIVE_PRODUCT` · `LOCK_TENANT` · `REJECT`; đánh giá/bài
viết → `HIDE_CONTENT` · `LOCK_TENANT` · `REJECT`. Sai → 400 `REPORT_INVALID_DECISION`.

| Quyết định | Tác động (cùng 1 transaction `withSystemJob` với việc chốt báo cáo) | Trạng thái báo cáo |
| :-- | :-- | :-- |
| `ARCHIVE_PRODUCT` | Sản phẩm → `ARCHIVED` + khoá kiểm duyệt; mở quyền chọn cho người mua (§6.1) | `RESOLVED` |
| `HIDE_CONTENT` (đánh giá) | → `HIDDEN` + khoá; đã ẩn sẵn thì giữ `hiddenReason` cũ, chưa ẩn → `OTHER`; sau commit tính lại điểm sản phẩm | `RESOLVED` |
| `HIDE_CONTENT` (bài viết) | → `HIDDEN`, `hiddenReason` = nhãn loại vi phạm, bỏ ghim, + khoá | `RESOLVED` |
| `LOCK_TENANT` | Tenant → `LOCKED` (`lockTenantInTx`, `apps/web/lib/tenant-lock.ts`); không khoá nội dung riêng lẻ | `RESOLVED` |
| `REJECT` | Không đổi gì | `REJECTED` |

- Chốt báo cáo bằng `updateMany ... where status = 'OPEN'`: 2 admin xử lý cùng lúc → người sau nhận 409 `REPORT_ALREADY_RESOLVED`, cả
  transaction rollback.
- `applyToSameTarget` (ô chọn của admin): đóng luôn **mọi báo cáo OPEN khác cùng đối tượng** bằng cùng quyết định + ghi chú; mỗi người báo
  cáo đều nhận email. Không chọn → các báo cáo khác vẫn `OPEN`.
- Đối tượng đã bị xoá → 409 `REPORT_TARGET_GONE` (chỉ còn Bác bỏ / Khoá gian hàng).
- Ghi chú ≤2000 ký tự (400 `VALIDATION_ERROR`), chỉ nội bộ — không gửi cho tenant/người báo cáo.
- Sau commit: audit `REPORT_RESOLVED` (`tenantId = null`), `CONTENT_MODERATION_LOCKED` (**có** `tenantId` — chủ gian hàng thấy nội dung nào
  bị khoá, actor hiện "Quản trị hệ thống"), `TENANT_LOCKED` (metadata `source: "ABUSE_REPORT"`, `reason` = nhãn loại vi phạm, `reportType`, `previousStatus`; chỉ khi tenant chưa khoá trước đó — ADR-072, KB ADR-056 ✅ code). Luồng này **không** gửi email `tenant_locked`: chủ gian hàng nhận `content_moderated` có cờ `tenantLocked: true`.
- Email gửi trong `after()` (§7). Revalidate trang công khai của tenant + `/admin/reports` (+ `/admin/tenants` khi khoá tenant).

### 4.3. Gỡ khoá kiểm duyệt — `unlockModerationAction(targetType, targetId)` → `unlockModeration`

| Đối tượng | Sau khi gỡ |
| :-- | :-- |
| Tài liệu | Giữ `ARCHIVED` — tenant tự khôi phục/xuất bản lại (phải tích cam kết bản quyền) |
| Đánh giá | Giữ `HIDDEN` — tenant tự bỏ ẩn được |
| Bài viết | `HIDDEN` → `DRAFT`, bỏ `hiddenReason` (tenant không tự gỡ `HIDDEN` được — trigger `posts_guard_columns`) |

Không bị khoá → 409 `CONTENT_NOT_MODERATION_LOCKED`. Audit `CONTENT_MODERATION_UNLOCKED` (có `tenantId`). **Gỡ khoá không hoàn tác lựa
chọn của người mua** (ADR-039 mục 4) — entitlement giữ nguyên `remedy*` ✅ (`unlockModeration` không chạm `entitlements`).

### 4.4. Ranh giới §7.9

Admin xem nội dung đối tượng (công khai/tenant) nhưng **không** xem đơn/khách. Với ADR-039 admin chỉ thấy **số đếm** yêu cầu hoàn tiền quá
hạn theo tenant (`countOverdueRefundRequestsByTenant`) — trên `/admin/tenants` (badge "N hoàn tiền quá hạn") và trang chi tiết báo cáo; không
id đơn/khách ✅.

---

## 5. Cam kết bản quyền khi xuất bản (ADR-038 mục 7) ✅

- `publishProduct(tenantId, productId, actorId, { rightsConfirmed })` (`apps/web/lib/product.ts`) — bắt buộc `rightsConfirmed === true` ở
  **mỗi lần chuyển sang `PUBLISHED`** (DRAFT/ARCHIVED → PUBLISHED). Thiếu → 400 `RIGHTS_CONFIRMATION_REQUIRED` (Server Action map vào
  `fieldErrors.rightsConfirmed`). Thành công → ghi `rightsConfirmedAt = now`, `rightsConfirmedById = actorId`; audit `PRODUCT_PUBLISHED`
  metadata `rightsConfirmed: true`.
- Sản phẩm đang `PUBLISHED` giữ nguyên, chỉ phải tích khi xuất bản lại.
- Form: FormData field `rightsConfirmed` (`on`/`true`/`1`) trong card xuất bản của editor; `publishProductAction(slug, id, { rightsConfirmed })`
  cho lời gọi ngoài form. Danh sách sản phẩm **không** có nút "Xuất bản" (cần điều kiện + ô cam kết — làm trong editor).
- Đang khoá kiểm duyệt: `publishProduct`, `unpublishProduct`, `restoreProduct` → 409 `CONTENT_MODERATION_LOCKED`; danh sách/editor ẩn các
  nút đổi trạng thái. Tương tự `hideReview`/`unhideReview`, `updatePost`/`setPostPinned` ✅. **Xoá được phép** ("Bổ sung ADR-039 lần 2" (f)): tenant xoá bài
  viết / khách xoá đánh giá đang bị khoá — nội dung vi phạm biến mất, **báo cáo giữ nguyên** (`deletePost` không kiểm khoá, trigger
  moderation chỉ `BEFORE INSERT OR UPDATE`, policy `customer_delete`) ✅. Chi tiết trang:
  [[02-System-Specs/Product-Editor-And-Publishing-Specs|Product-Editor-And-Publishing-Specs]], [[02-System-Specs/Reviews-Specs|Reviews-Specs]],
  [[02-System-Specs/Posts-Specs|Posts-Specs]].

---

## 6. Quyền lợi người mua khi tài liệu bị lưu trữ do vi phạm (ADR-039) ✅

Logic: `apps/web/lib/entitlement-remedy.ts`; hằng/nhãn: `@gieochu/core/entitlement-remedy`
(`packages/core/src/download/entitlement-remedy.ts`). Nền tảng **không giữ tiền** bán tài liệu (tiền về thẳng tenant) nên chỉ *yêu cầu*
tenant hoàn tiền; mỗi đơn đúng 1 sản phẩm nên hoàn tiền = hoàn cả đơn bằng `markOrderRefunded` sẵn có.

### 6.1. Mở quyền chọn

Khi `ARCHIVE_PRODUCT`: `openPurchaseRemedies` (trong transaction xử lý báo cáo) chuyển **mọi entitlement chưa thu hồi và đang `NONE`** của
sản phẩm → `PENDING_CHOICE`, đặt `remedyRequestedAt`, `remedyReportId`. **Kể cả đơn 0đ** (bổ sung ADR-039 (a)) — đơn 0đ chỉ có lựa chọn A.
Entitlement đã có remedy từ lần lưu trữ trước giữ nguyên.

### 6.2. Chặn tải

`remedyDownloadBlock`: `PENDING_CHOICE` → 403 `REMEDY_CHOICE_REQUIRED`; `REFUND_REQUESTED`/`REFUNDED` → 403 `DOWNLOAD_BLOCKED_REFUND`;
`NONE`/`FINAL_DOWNLOAD` → tải theo `downloadLimit`. Kiểm ở bước 1 (`requestDownload`, sau kiểm thu hồi — entitlement đã thu hồi vẫn báo
`ENTITLEMENT_REVOKED`) **và** trong câu UPDATE tăng `downloadsUsed` ở bước 2 (`remedyStatus IN ('NONE','FINAL_DOWNLOAD')`) — token cấp trước
khi admin lưu trữ không còn tải được. Chi tiết: [[02-System-Specs/File-Storage-And-Downloads-Specs|File-Storage-And-Downloads-Specs]] §8.

### 6.3. Lựa chọn A — tải lần cuối (`chooseFinalDownloadAction`)

- `PENDING_CHOICE` → `FINAL_DOWNLOAD`, `remedyChosenAt = now`, **`downloadLimit = downloadsUsed + max(1, số tệp khả dụng)`** — đủ mỗi tệp
  1 lượt (cộng ngay trong câu UPDATE, không dựa số đọc trước). "Tệp khả dụng" = cùng điều kiện với Thư viện: không phải bản xem trước, chưa
  gỡ, tệp `CLEAN` hoặc link ngoài còn qua allowlist (`countDeliverableFiles`, đọc dưới `withCustomer`) ✅. **Lượt dùng chung** cho cả
  entitlement, không đếm riêng từng tệp — chốt ở "Bổ sung ADR-039 lần 2" (d); UI ghi: "Bạn có N lượt tải cuối cho N tệp — mỗi lượt tải một tệp, hãy tải mỗi tệp một lần." (`remedy-notice.tsx`); Studio: "(số lượt bằng số tệp — mỗi lượt tải một tệp)" (`remedy-parts.tsx`) ✅ đọc code 2026-10-17.
- Trước khi tải, Thư viện hiện cảnh báo (tài liệu bị gỡ do vi phạm, chỉ dùng cá nhân, không phát tán, chịu trách nhiệm khi phát tán; đây là
  lần tải cuối).
- Audit `REMEDY_FINAL_DOWNLOAD_CHOSEN` (scope `CUSTOMER`, có `tenantId`, metadata `productId`, `orderId`, `grantedDownloads`).

### 6.4. Lựa chọn B — yêu cầu hoàn tiền (`requestRefundAction`)

- Chỉ đơn > 0đ (đọc `totalVnd` từ DB) — đơn 0đ → 409 `REMEDY_REFUND_NOT_AVAILABLE`.
- `PENDING_CHOICE` → `REFUND_REQUESTED`, `remedyChosenAt = now`; tải bị chặn vĩnh viễn. Audit `REMEDY_REFUND_REQUESTED`.
- Email chủ gian hàng `remedy_refund_requested` (mã đơn + link Studio) gửi trong `after()`.
- Tenant được đề nghị xử lý trong **7 ngày** (`REMEDY_REFUND_SLA_DAYS`, tính từ `remedyChosenAt`). Tenant hoàn tiền ngoài hệ thống rồi bấm
  "Hoàn tiền" sẵn có ở trang đơn → `markOrderRefunded` thu hồi entitlement rồi chuyển `REFUND_REQUESTED` → `REFUNDED` + `remedyResolvedAt`
  (cùng transaction).

Chung cho A/B: khách đọc + kiểm sở hữu dưới `withCustomer` (không thấy → 404); UPDATE chạy dưới `withSystemJob` với điều kiện
`id + userId + remedyStatus = 'PENDING_CHOICE' + revokedAt IS NULL` trong chính câu lệnh → 2 tab bấm cùng lúc chỉ 1 thắng, người sau 409
`REMEDY_NOT_PENDING`. **Lựa chọn không đổi được** sau khi chọn; không giới hạn thời hạn chọn (ADR-039 mục 4).

### 6.5. Đơn thanh toán muộn (bổ sung ADR-039 (c))

`markOrderPaid` (scope tenant — webhook, xác nhận tay, đơn 0đ) cho sản phẩm **đang bị khoá kiểm duyệt** → entitlement tạo thẳng ở
`PENDING_CHOICE`, `remedyReportId` = báo cáo `RESOLVED`/`ARCHIVE_PRODUCT` mới nhất của sản phẩm (có thể null); sau commit
`notifyPurchaseRemedyForOrder` gửi khách email 2 lựa chọn. Checkout **mới** cho sản phẩm không `PUBLISHED` hoặc tenant không `ACTIVE` bị chặn
— xem [[02-System-Specs/Order-State-Machine|Order-State-Machine]] §3.8 (gồm tenant `READ_ONLY` — "Bổ sung ADR-039 lần 2" (g), **đã chốt** bởi ADR-040 mục 4).

### 6.6. Bảo vệ ở DB — trigger `entitlements_guard_remedy` ✅ đọc SQL

Ngoài `system_job`:
- INSERT chỉ được dòng `NONE` sạch — **ngoại lệ**: `PENDING_CHOICE` chưa chọn khi sản phẩm có `moderationLockedAt` và `remedyReportId` (nếu có)
  là báo cáo về đúng sản phẩm đó (§6.5).
- Không đổi `remedyRequestedAt`, `remedyChosenAt`, `remedyReportId`.
- Không đổi `remedyStatus`/`remedyResolvedAt` — **ngoại lệ duy nhất**: `REFUND_REQUESTED` → `REFUNDED` kèm `revokedAt` và `remedyResolvedAt`
  trong cùng lệnh.
- Không đổi `downloadLimit` khi `remedyStatus ≠ NONE` (bổ sung ADR-039 (b)) — "Cấp thêm lượt" còn bị chặn ở server
  (`grantExtraDownloads` → 409 `REMEDY_DOWNLOAD_LIMIT_LOCKED`) và nút bị ẩn trong Studio.

### 6.7. Studio (tenant)

- `countPendingRefundRequests(tenantId)` → `{ pending, overdue }` dưới `withTenant`: badge mục "Đơn hàng" ở sidebar Studio (đỏ khi có quá
  hạn) và dashboard Studio.
- Trang đơn: chip lọc "Yêu cầu hoàn tiền" (`?remedy=REFUND_REQUESTED`, kết hợp được với `status`), badge "Khách yêu cầu hoàn tiền" /
  "… · quá hạn" trên từng đơn; trang chi tiết đơn hiện trạng thái remedy từng dòng (`OrderItemRemedy`) + hạn xử lý.
- Tenant **thấy** khách nào yêu cầu hoàn tiền (đơn của chính tenant) — nhưng **không bao giờ** thấy người báo cáo.

### 6.8. Thư viện khách (`/account/library`)

`listLibraryEntitlements` trả thêm `remedyStatus`, `refundAvailable` (đơn > 0đ — server kiểm lại), `remedyChosenAt`, `remedyResolvedAt`,
`finalDownloadFileCount` (= `max(1, số tệp)`, chỉ hiển thị), `orderCode`. Thẻ tài liệu hiện `RemedyNotice` (2 lựa chọn + hộp thoại xác nhận
`ConfirmDialog`, hoặc trạng thái đã chọn) và khoá nút tải theo `remedyDownloadBlock`; thu hồi ưu tiên hơn mọi trạng thái remedy trừ
`REFUNDED`.

---

## 7. Email ✅ (template `packages/email/src/templates/{abuse-report,entitlement-remedy}.ts`)

| `type` (`sendEmailNow`) | Người nhận | Khi nào | Ghi `email_send_logs`? |
| :-- | :-- | :-- | :-- |
| `abuse_report_resolved` | Từng người báo cáo (gộp báo cáo cùng đối tượng nếu `applyToSameTarget`) | Mọi quyết định — chỉ cho biết "đã có biện pháp" hay không, không nêu chi tiết | Có |
| `content_moderated` | Chủ gian hàng | Quyết định ≠ `REJECT` — loại vi phạm, nội dung, biện pháp, link Studio; **không** danh tính người báo cáo | Có |
| `entitlement_remedy_customer` | Từng khách bị ảnh hưởng (1 email/email khách) | Mở quyền chọn (§6.1) hoặc đơn thanh toán muộn (§6.5) | **Không** (`TENANT_CUSTOMER_FACING_TYPES`) |
| `entitlement_remedy_tenant` | Chủ gian hàng | Mở quyền chọn — số khách bị ảnh hưởng + số được hoàn tiền + link lọc đơn | Có (tiêu đề không chứa dữ liệu khách) |
| `remedy_refund_requested` | Chủ gian hàng | Khách chọn B — mã đơn, số tiền, hạn 7 ngày | **Không** (`TENANT_CUSTOMER_FACING_TYPES`) |

- Gửi sau commit trong `after()` (`notifyAbuseReportResolution` → `notifyPurchaseRemedyOpened`); lỗi gửi chỉ log, không chặn việc xử lý.
- Email khách gửi **tuần tự** — sản phẩm nhiều người mua nên chuyển sang job theo lô (BACKLOG).
- Email hỗ trợ (`SystemSettings.supportEmail`) chèn vào nội dung nếu có.
- Gửi thật tới hộp thư ❓ (cần môi trường thật — Quốc chưa báo đã thử).

---

## 8. Retention — cron ✅

Bước **`abuse_report.ip_purge`** trong `GET /api/cron/daily` (sau `stats.aggregate`, trước `queue.drain`) → `purgeExpiredAbuseReportIps()`:
`UPDATE abuse_reports SET ip = NULL` cho báo cáo cũ hơn 12 tháng (so UTC) — **giữ báo cáo**. Kết quả `reportIpPurge: { ok, result: { cleared,
skipped } }`; bảng chưa có → `skipped: true`. Contract: [[03-API-Contracts/Endpoint-Directory|Endpoint-Directory]] §17.

---

## 9. Audit mới ✅

`AUDIT_ACTIONS` từ 27 lên **32**: thêm `REPORT_SUBMITTED`, `CONTENT_MODERATION_LOCKED`, `CONTENT_MODERATION_UNLOCKED`,
`REMEDY_FINAL_DOWNLOAD_CHOSEN`, `REMEDY_REFUND_REQUESTED`; `REPORT_RESOLVED` (đã có trong danh sách từ M12a) nay được ghi. Bảng nơi ghi:
[[02-System-Specs/Audit-Log-Specs|Audit-Log-Specs]] §4.

---

## 10. Test

ADR-038 mục 8 / ADR-039 mục 6: **không thêm test** (ngân sách M12 đã đủ 2/2). `pnpm test:count` (Long chạy 2026-10-17, chỉ đếm): **93/94
unit, 54/55 integration** ✅. Nợ test (trigger moderation/remedy trên DB thật, rate limit/trùng, xử lý đồng thời, xuất bản thiếu cam kết, IP
purge, luồng remedy, email đơn hàng): `docs/BACKLOG.md` mục "Phát sinh trong đợt M12c (ADR-038 — Báo cáo vi phạm) + ADR-039 (quyền lợi người mua)".

---

## 11. Liên kết

* [[02-System-Specs/Audit-Log-Specs|Audit-Log-Specs]] ([Audit-Log-Specs.md](./Audit-Log-Specs.md))
* [[02-System-Specs/Order-State-Machine|Order-State-Machine]] §3.1, §3.3, §3.7, §3.8 ([Order-State-Machine.md](./Order-State-Machine.md))
* [[02-System-Specs/File-Storage-And-Downloads-Specs|File-Storage-And-Downloads-Specs]] §8 ([File-Storage-And-Downloads-Specs.md](./File-Storage-And-Downloads-Specs.md))
* [[02-System-Specs/Reviews-Specs|Reviews-Specs]] · [[02-System-Specs/Posts-Specs|Posts-Specs]] · [[02-System-Specs/Product-Editor-And-Publishing-Specs|Product-Editor-And-Publishing-Specs]]
* [[03-API-Contracts/Database-Schema-Reference|Database-Schema-Reference]] ([Database-Schema-Reference.md](../03-API-Contracts/Database-Schema-Reference.md))
* [[03-API-Contracts/Endpoint-Directory|Endpoint-Directory]] §17, §20 ([Endpoint-Directory.md](../03-API-Contracts/Endpoint-Directory.md))
* [[04-Operations-Runbooks/UI-Design-System|UI-Design-System]] §17 ([UI-Design-System.md](../04-Operations-Runbooks/UI-Design-System.md))
* [[04-Operations-Runbooks/Deploy-Vercel-Runbook|Deploy-Vercel-Runbook]] §9.8 ([Deploy-Vercel-Runbook.md](../04-Operations-Runbooks/Deploy-Vercel-Runbook.md))
* Mã nguồn: `apps/web/lib/{abuse-report,entitlement-remedy,moderation,tenant-lock}.ts`, `apps/web/app/api/reports/route.ts`,
  `apps/web/app/admin/reports/**`, `apps/web/app/account/library/{actions.ts,_ui/**}`, `packages/core/src/report/abuse-report.ts`,
  `packages/core/src/download/entitlement-remedy.ts`, `packages/db/prisma/migrations/{20261016150000_m12c_abuse_reports,20261016180000_adr039_entitlement_remedy}/`

*Quay lại: [[MOC-Home]] (../00-Index/MOC-Home.md)*

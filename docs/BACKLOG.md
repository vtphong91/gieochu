# BACKLOG

Việc ngoài phạm vi M0–M12 (mục 2.2 và mục 12 của đặc tả), hoặc phát sinh trong lúc code mà không thuộc module
đang làm. Không triển khai cho tới khi được yêu cầu rõ ràng.

## Từ mục 2.2 — Ngoài phạm vi MVP giai đoạn 1

- Tên miền riêng cho tenant (custom domain), subdomain wildcard.
- PDF stamping, watermark.
- Nhân viên tenant (staff) với phân quyền chi tiết — schema chừa sẵn `role STAFF`; ADR-022 đã thêm lớp
  `Role`/`Permission` (seed sẵn tập quyền khởi đầu cho `TENANT_STAFF`) nên phần "được làm gì" không còn thiếu,
  nhưng vẫn chưa có luồng mời staff / tạo row `TenantMember` role STAFF thật, và chưa có UI chỉnh ma trận
  quyền — UI vẫn chỉ cho owner.
- Bundle, flash sale theo khung giờ, license nhiều người dùng.
- Affiliate, email marketing, chat.
- Hoàn tiền tự động qua cổng thanh toán (MVP chỉ ghi nhận hoàn tiền thủ công).
- App mobile, tìm kiếm toàn nền tảng, marketplace chung.
- Hoá đơn điện tử.

## Từ mục 12 — Định hướng sau MVP (giai đoạn 2–4)

Xem bảng đầy đủ ở `docs/GIEOCHU_PROMPT_MVP_PHASE1.md` §12. Tóm tắt các mục lớn: PDF stamping nâng cao, giỏ
hàng nhiều sản phẩm, SePay VA theo đơn, thông báo in-app, affiliate/giới thiệu, analytics chi tiết, tìm kiếm
full-text, custom domain + TLS tự động, theme storefront tuỳ biến, khoá học video/membership, app mobile,
hoá đơn điện tử, đa tiền tệ, partition/backup/giám sát vận hành.

## Phát sinh trong lúc dựng M0

- **Neon local proxy cho dev hoàn toàn offline**: `@prisma/adapter-neon` dùng giao thức serverless của Neon,
  không nói chuyện thẳng với `postgres:16` trong docker-compose. Nếu cần dev 100% offline (không có mạng),
  cần thêm `neon-proxy` (hoặc driver adapter khác cho local) vào docker-compose — xem ADR-004. Hiện tại
  khuyến nghị dùng Neon branch miễn phí.
- **Partition `audit_logs` theo tháng** (mục 5.3): mục 10 DoD chỉ yêu cầu "hoặc ghi ADR nếu để sau" — sẽ quyết
  định cụ thể khi làm M12.
- **`downloadLimit = 0` = không giới hạn**: đặc tả mục M5 gợi ý ghi ADR khi cài đặt sản phẩm — chưa quyết định
  vì M5 chưa bắt đầu.

## Phát sinh trong lúc dựng M1

- **`TEST_DATABASE_URL` riêng cho integration test**: hiện dùng chung Neon DB với dev (ADR-009). Khi có quyền
  tạo Neon branch (qua Neon API/Console), tách riêng để an toàn hơn và cho phép chạy song song.
- **Avatar upload**: mục M1 "đổi avatar (upload qua M5 storage helper)" — chưa làm vì `packages/storage`
  (presigned upload) thuộc M5. `/account/security` hiện chỉ có đổi mật khẩu + đăng xuất mọi thiết bị.
- **Audit log cho sự kiện M1**: `AUTH_LOGIN`, `AUTH_LOGIN_FAILED`, `AUTH_REFRESH_REUSE`, v.v. cần ghi qua
  `audit.log()` một khi bảng `audit_logs` (M12) tồn tại — nối lại khi làm M12, không lùi lại sửa M1.
- **Rate limit in-memory**: `apps/web/lib/rate-limit.ts` chỉ hoạt động đúng khi chạy 1 instance duy nhất
  (Next dev/start process). Nếu scale ra nhiều instance, cần chuyển sang bảng `rate_limits` trên Postgres
  (đã có gợi ý ở mục 6 của đặc tả).
- **`sslmode=require` deprecation warning** từ `pg`/`pg-connection-string` khi pg-boss kết nối Neon
  (`SECURITY WARNING: ... 'require' ... treated as aliases for 'verify-full'`) — vô hại ở bản hiện tại, nhưng
  nên cân nhắc đổi sang `sslmode=verify-full` hoặc `uselibpqcompat=true` trong connection string trước khi
  `pg`/`pg-connection-string` lên major version mới.

## Phát sinh trong lúc dựng M4

- **Live-suggestion slug khi trùng**: đặc tả gợi ý UX "Trùng → gợi ý slug-2, slug-3" ngay trên form; hiện tại
  `createTenantForUser` chỉ từ chối (409) khi trùng, chưa có API kiểm tra khả dụng theo thời gian thực để form
  hiển thị gợi ý trước khi submit. Nếu cần, thêm route/action `checkSlugAvailability`.
- **`ALTER DEFAULT PRIVILEGES` chỉ áp dụng cho bảng do `neondb_owner` tạo**: nếu sau này có người/role khác
  chạy migration, cần chạy lại `packages/db/scripts/setup-app-role.mts` (an toàn, idempotent) để đảm bảo
  `gieochu_app` vẫn có quyền trên bảng/schema mới.
- **Dashboard tenant chỉ có placeholder**: doanh thu/đơn chờ/sản phẩm bán chạy/đánh giá mới hiện hiển thị "—"
  vì Order (M8), Review (M10) chưa tồn tại — nối số liệu thật khi các module đó xong. *(Cập nhật 2026-09-28: ô "Đánh giá
  mới" đã nối ở M10a — `countNewTenantReviews`, 7 ngày gần nhất.)*
- **Bug đã sửa ngay trong phiên (không để lại BACKLOG, ghi lại để nhớ)**: `requireTenantMember` từng query
  `tenant_members` không qua `withTenant`, khiến RLS lọc rỗng ngay cả với owner hợp lệ — chỉ phát hiện được
  nhờ bật RLS thật (ADR-010) thay vì tin tưởng WHERE clause. Bài học: mọi truy vấn bảng L2 mới thêm, kể cả
  trong test, đều phải đi qua `withTenant/withCustomer/withPublic/withSystemJob`.

## Phát sinh trong lúc dựng M2

- **Platform Payment config + Audit log viewer + Báo cáo vi phạm**: nằm trong đặc tả M2 gốc nhưng cố ý hoãn
  vì cần `packages/payments` (M7) và bảng `audit_logs`/`abuse_reports` (M12) — đúng theo "hoàn thiện M2" ở
  cuối chuỗi mục 10. Quay lại sau khi M7 và M12 xong.
- **Doanh thu subscription + GMV trên dashboard admin**: hiện hiển thị ghi chú "cần M3/M12" — nối số liệu
  thật (`subscription_invoices` PAID, `tenant_daily_stats`) khi 2 module đó xong.
- **Live-preview block CMS**: form hiện chỉ có textarea JSON thô (validate qua `isValidCmsBlocks` khi lưu),
  chưa có form có cấu trúc/preview trực quan cho từng loại block (hero/features/faq/...). Cân nhắc nâng cấp
  UI khi có thời gian, không ảnh hưởng đúng đắn dữ liệu.
- **Bug đã sửa ngay trong phiên (ghi lại để nhớ)**: `/admin` (và 2 trang `/studio/[tenantSlug]/*` sót từ M4)
  trả 500 vì Server Component gọi thẳng guard ném `AppError` (`requireRole`/`requireTenantMember`) thay vì
  guard chuyển hướng. Bài học: **Server Component không được gọi thẳng** `requireUser()`/`requireRole()`/
  `requireTenantMember()` — luôn qua bản dịch trong `lib/page-guards.ts` (`redirect()`/`notFound()`); các guard
  ném lỗi chỉ dành cho API route/Server Action, nơi có `try/catch` hoặc lỗi được chấp nhận là "action thất
  bại". Không phát hiện được qua Vitest (gọi hàm trực tiếp, không đi qua React render) — chỉ lộ ra khi chạy
  `pnpm dev` thật, khẳng định thêm giá trị của bước smoke-test thủ công sau mỗi module.

## Phát sinh trong lúc dựng M7

- **Live-suggestion khả dụng slug khi tạo trang** (trùng ghi chú M4) — chưa làm.
- **`platform_payment_configs` chưa có UI/business logic**: bảng tồn tại (ADR-011) nhưng trống, chưa ai ghi
  vào ngoài test. M3 cần: form cấu hình Platform Payment (dùng lại `saveTenantProviderConfig`-style logic
  nhưng scope PLATFORM), webhook route `/api/webhooks/platform/[provider]`, và tạo `subscription_invoices`.
- **Test connection cho SePay/MANUAL_QR**: interface `PaymentProvider.testConnection` là optional; chỉ MoMo
  implement (theo đúng mục 9 — không có unit test riêng cho testConnection nên không bắt buộc làm cho
  SePay/MANUAL_QR). Cân nhắc thêm nút "gửi webhook thử" (mục M7 có nhắc) cho SePay ở M8 khi có Order thật để
  test.
- **`SEPAY`/`MOMO` webhook route mới xử lý JSON body**: SePay hỗ trợ cả `multipart/form-data` và
  `application/x-www-form-urlencoded` (theo tài liệu chính thức) — route hiện chỉ parse JSON. Bổ sung khi
  M8 triển khai thật với tài khoản SePay thật.
- **Rate limit cho endpoint webhook**: chưa thêm (mục 6 có nhắc rate limit cho nhiều endpoint, nhưng webhook
  đến từ server SePay/MoMo cố định, rủi ro thấp hơn — cân nhắc lại nếu cần khi vận hành thật).

## Phát sinh trong lúc dựng M3

- **`assertPlanLimit(tenantId, kind)` DB wrapper**: chỉ có hàm thuần `isWithinPlanLimit()`
  (`packages/core/src/billing/plan-limits.ts`, đã unit test). Wrapper thật (query số sản phẩm/dung lượng đã
  dùng theo tenant) để M5 gọi trước khi tạo sản phẩm/upload file — chưa viết vì hình dạng query phụ thuộc
  schema Product/file mà M5 sẽ thêm; viết trước sẽ phải đoán và nhiều khả năng M5 viết lại.
  **[Đã làm ở M5]** — `apps/web/lib/plan-limits.ts`.
- **`/studio/[tenantSlug]/billing` chưa có progress bar dung lượng**: ✅ đã làm ở M3 v2 — progress bar sản
  phẩm/dung lượng so với giới hạn plan, cảnh báo ngưỡng 80%.
- **Không có trang admin "danh sách toàn bộ subscription + override thủ công"**: báo cáo tham khảo TaniGos có
  `admin/billing/subscriptions` (gia hạn thủ công/đổi gói/suspend thủ công cho từng merchant); đặc tả M3 của
  Gieo Chữ không yêu cầu tường minh nên chưa làm — cân nhắc thêm khi vận hành thật cần can thiệp tay.
- **SePay/MoMo webhook cho platform dùng chung hạn chế với M7** (chỉ parse JSON body, chưa test-connection
  cho SePay/MANUAL_QR) — cùng ghi chú đã có ở mục M7 phía trên, áp dụng y hệt cho phía Platform.
- **Auto-disable-khi-đổi-cấu-hình (ADR-013) chỉ áp dụng `PlatformPaymentConfig`**: `TenantPaymentConfig` (M7)
  chưa có cơ chế này — cân nhắc đồng bộ khi có nhu cầu thật, không bắt buộc vì không ảnh hưởng đúng đắn của
  M7 hiện tại (chỉ là một lớp an toàn bổ sung).

## Phát sinh trong lúc dựng M3 v2 (Hybrid Monetization, xem ADR-021)

- **`assertPlanFeature()` chưa gate call site cụ thể nào**: hàm đã có (`apps/web/lib/plan-limits.ts`), đọc
  `plan.features` đúng nguyên tắc entitlement — nhưng chưa gọi ở coupon/analytics/branding/SEO/automation/
  customDomain vì mỗi cái cần quyết định riêng "Free có được dùng hay không" trước khi gate (đặc tả gốc M6
  còn để ngỏ "Coupon: Có thể giới hạn / chưa mở" cho Free). Chưa làm, cần hỏi lại trước khi gate lần đầu.
- **MRR/GMV đầy đủ trên `/admin` vẫn chờ M12**: M3 v2 chỉ thêm tách đếm subscription Free/Paid
  (`subscriptionsByPlanType`), chưa tính doanh thu — đúng phạm vi đã thống nhất với người dùng.
- **`SystemSettings.trialDays` không còn được đọc ở đâu**: `create-tenant.ts` không còn dùng trial nữa —
  cột vẫn còn trong schema (không xoá vội, không phải trọng tâm đợt này), `/admin/settings` UI vẫn có thể
  còn cho sửa giá trị này dù không có tác dụng — cần dọn khi có thời gian.
- **`updatePlanAction` (mới) chưa có test tự động**: `/admin/plans` CRUD nói chung (kể cả `createPlanAction`/
  `togglePlanActiveAction` cũ) chưa có integration test nào từ M2 tới giờ — không tăng phạm vi test M3 v2 để
  thêm việc này (đặc tả M2 không liệt kê rõ), nhưng đáng làm khi rà soát coverage CRUD admin nói chung.
- **Đã xoá tay 3 plan cũ (`STARTER`/`PRO_MONTHLY`/`PRO_YEARLY`) khỏi DB dev**: không có script migration
  chính thức (dự án chưa có user thật) — nếu môi trường khác (staging thật) đã seed các plan này và có
  tenant tham chiếu, cần xử lý thủ công tương tự (kiểm tra `subscription.count({planId})` trước khi xoá).
- **Transaction fee, split payment, proration, usage billing theo API, `billing_accounts`/`usage_meters`/
  `billing_events`**: cố tình không làm — xem ADR-021 để có đầy đủ lý do thu gọn kiến trúc.

## Phát sinh trong lúc dựng M5 (cả 2 giai đoạn — metadata/CRUD rồi upload thật, xem ADR-014/017/018)

- **Chưa verify upload thật end-to-end với R2 thật**: toàn bộ code (`presign.ts`, `scan.ts`, route 4 cái,
  job `file.scan`, UI `UploadFileForm`/`CoverImageUpload`) đã viết xong, xanh lint/typecheck/build, và 1/2
  integration test còn thiếu đã hoàn thành (presign auth — dùng `SystemStorageConfig` giả vì presign đơn là
  ký chữ ký thuần không gọi mạng). Còn thiếu: verify thật qua trình duyệt với R2 thật (upload đơn, upload
  multipart file >50MB, file giả mạo đuôi bị `file.scan` từ chối thật, `complete` gọi `HeadObject` thật) —
  người dùng tự làm khi nhập credential ở `/admin/settings/storage`.
- **1/4 integration test M5 còn thiếu**: "`complete` ghi `product_files` và enqueue job quét" — cần
  `HeadObject` thật lên bucket thật (không thể giả bằng config giả như test presign).
- **Trang public `/{tenantSlug}/products/{productSlug}`** (từ ADR-030: `/{tenantSlug}/{productSlug}`, URL cũ 301): ✅ đã xây ở M8 (cần nút "Mua ngay" nên làm cùng
  lúc với checkout) — hiển thị tiêu đề/ảnh bìa/mô tả/giá (đã resolve sale price qua `calculateOrderPricing`).
- **`unpublishProduct()` không kiểm tra "chưa có đơn"**: đặc tả ghi "PUBLISHED → DRAFT: Owner gỡ xuống (chưa
  có đơn)" — `Order` giờ đã tồn tại (M8) nên điều kiện này có thể nối lại, nhưng chưa làm trong phiên M8 (nằm
  ngoài danh sách hàm M8 phải xây, sửa `product.ts` của M5 ngoài phạm vi module đang làm). Còn mở — dễ hoàn
  thành khi có thời gian: chỉ cần `withTenant(tenantId, tx => tx.orderItem.count({where:{productId}}))` > 0
  thì chặn.
- **ClamAV thật chưa tích hợp** (ADR-018): `file.scan` luôn đánh dấu `CLEAN` sau khi qua kiểm tra
  magic-bytes, kể cả khi `CLAMAV_HOST` được set (chỉ ghi log cảnh báo). Cần chọn + cài client library
  (`clamscan`/`clamdjs`) và chạy `clamd` daemon riêng (thêm phụ thuộc hạ tầng ngoài phạm vi "không Docker"
  đã chọn) khi vận hành thật cần quét virus.
- **4 route upload mới chưa có rate limit**: `presign`/`complete`/`cover-presign`/`cover-complete` — mục 6
  đặc tả có nhắc rate limit cho nhiều endpoint; các route này gọi S3 thật (tốn chi phí/tài nguyên nếu bị
  spam) nên rủi ro cao hơn form thường — cân nhắc thêm khi vận hành thật.
- **Route ghi dữ liệu chưa kiểm tra header `Origin`** (mục 7.7): phát hiện đây là khoảng trống có sẵn từ
  trước (không riêng M5) — mọi Route Handler ghi dữ liệu trong dự án (register, login, 4 route upload mới...)
  chưa có route nào kiểm tra `Origin`. Không sửa riêng lẻ cho 4 route mới (sẽ không nhất quán) — cần một lượt
  rà soát áp dụng chung cho toàn bộ Route Handler ghi dữ liệu khi có thời gian.

## 2 bug thật phát hiện khi test thủ công qua trình duyệt (sau M5, đã sửa ngay)

Mọi smoke-test trước giờ chỉ dùng `curl` (gọi thẳng API/route handler) — không tải trang qua trình duyệt thật
nên không chạy JS phía client. Lần đầu người dùng bấm thử qua trình duyệt (theo hướng dẫn test thủ công) đã
lộ ra 2 lỗi cả 2 đều tồn tại từ trước, không riêng module nào:

- **Seed admin thiếu `UserProfile`**: `packages/db/prisma/seed.ts` chỉ set `User.profileCompletedAt` nhưng
  không tạo bản ghi `UserProfile` — trong khi `isProfileComplete()` (`packages/auth`, dùng ở route login)
  kiểm tra chính bảng đó, không phải cột `profileCompletedAt`. Hậu quả: admin đăng nhập được nhưng bị đưa
  tới `/account/profile`, và nếu điền form ở đó sẽ lỗi (`userProfile.update` trên bản ghi không tồn tại).
  Đã sửa: seed giờ `upsert` luôn `UserProfile` cho admin.
- **CSP chặn toàn bộ JS phía client**: `next.config.ts` đặt `script-src 'self'` tĩnh, không có `unsafe-inline`
  hay nonce — chặn đứng inline `<script>` mà Next.js App Router tự chèn mỗi request để hydrate RSC (cả dev
  **và production**, không riêng gì hot-reload). Hậu quả: React không hydrate được, mọi form (kể cả
  đăng nhập) rơi về submit HTML thuần (GET, lộ mật khẩu lên URL). Đã sửa: chuyển sinh CSP sang `proxy.ts`
  (đúng vị trí duy nhất tạo được nonce theo từng request), dùng `script-src 'self' 'nonce-<random>'
  'strict-dynamic'` (+ `unsafe-eval` riêng cho dev, Turbopack HMR cần `eval()`) — theo đúng khuyến nghị CSP
  chính thức của Next.js. `next.config.ts` giờ chỉ còn 2 header tĩnh (X-Content-Type-Options, Referrer-Policy).
  **Bài học**: `curl` không thay thế được việc tải trang qua trình duyệt thật — lỗi này lẽ ra đã lộ ra từ M1
  nếu có bước test tay qua trình duyệt sớm hơn.

## Phát sinh khi xây hạ tầng cấu hình storage ở System Admin (ADR-017)

- **`docker-compose.yml` MinIO giờ không còn được app đọc tới**: 7 biến `S3_*` đã xoá khỏi `env.ts`, cấu hình
  storage giờ hoàn toàn qua `SystemStorageConfig` (DB). Service `minio`/`minio-createbuckets` trong
  `docker-compose.yml` vẫn còn khai báo nhưng không ai dùng — có thể dọn bỏ, hoặc giữ lại cho ai muốn tự host
  MinIO test riêng (không bắt buộc, không ảnh hưởng đúng đắn hệ thống).
- **`/admin/settings/storage` chưa test tự động**: xem ghi chú ở `docs/modules/M5.md` — hạ tầng mới ngoài
  bảng test mục 9 gốc, cố ý không thêm test tự động nếu chưa hỏi lại người dùng. Verify bằng tay khi có
  credential R2 thật.

## Phát sinh trong lúc dựng M6

- **1/2 integration test M6 hoãn tới M8**: ✅ hoàn thành ở M8 (`order.test.ts` — "a coupon is only consumed
  once an order is PAID..."), đúng thiết kế đã ghi ở đây: `UPDATE coupons SET usedCount = usedCount + 1 WHERE
  id = ... AND (usageLimit IS NULL OR usedCount < usageLimit)` (raw SQL, atomic), ghi `coupon_redemptions` chỉ
  khi update trả về >0 dòng; nếu 0 dòng (hết lượt đúng lúc thanh toán) đơn vẫn giữ `PAID`/`FULFILLED`, chỉ ghi
  `logger.warn` (chưa có bảng `audit_logs` — đó là M12, xem ghi chú bên dưới) thay vì `COUPON_OVERUSED` như
  đặc tả gốc chữ.
- **`CouponRedemption.orderId` chưa có `@relation` tới `Order`**: ✅ đã thêm ở M8.
- **Chưa có UI công khai áp mã trên storefront**: ✅ đã xây ở M8 — `CouponPanel` trên trang checkout
  (`/[tenantSlug]/checkout/[orderCode]`), gọi lại `calculateOrderPricing()` (bọc `calculatePrice()`) ở server,
  không tin tổng tiền từ client.
- **Trang Studio coupon chưa có nút xoá**: chỉ có tạo/sửa/bật-tắt (`isEnabled`) — đặc tả không yêu cầu xoá
  tường minh, tắt coupon coi như đủ cho MVP; cân nhắc thêm nếu người dùng cần dọn hẳn mã cũ.
- **`COUPON_OVERUSED` chưa ghi audit log thật**: xem ghi chú ngay phía trên — sẽ nối vào bảng `audit_logs`
  khi M12 xây xong, hiện chỉ có `logger.warn` (pino, không truy vấn lại được từ UI admin).

## Phát sinh trong lúc dựng M8

- **Webhook M3 (Platform) và M8 (Tenant) xử lý khác kiểu, không nhất quán** (xem ADR-019): route platform
  (`POST /api/webhooks/platform/[provider]`, M3) gọi `markInvoicePaid()` đồng bộ ngay trong request — không
  đúng §7 mục 4 ("trả 2xx nhanh, xử lý nặng đẩy sang job"). Route tenant (M8) làm đúng: chỉ ghi
  `webhook_events` rồi đẩy job `payment.process`. Không sửa lại M3 trong phiên này (ngoài phạm vi, module đã
  ổn định/đã có test xanh) — nếu cần đồng bộ 2 route, làm như một việc riêng, hỏi người dùng trước vì đụng
  vào luồng thanh toán platform đã chạy thật.
- **Không có luồng upload "ảnh biên lai" (`proofImageKey`)**: cột `proofImageKey` đã có trên `Order` (theo
  ERD đặc tả) nhưng M8 chưa xây UI/API cho khách hàng tải ảnh biên lai lên khi thanh toán MANUAL_QR — đặc tả
  chỉ liệt kê cột này trong ERD, không có trong danh sách hàm/route bắt buộc của M8. Owner vẫn xác nhận thủ
  công dựa trên sao kê ngân hàng của chính họ (không cần ảnh biên lai khách gửi). Có thể thêm sau nếu cần,
  tái dùng `presignCoverImageUpload`-style flow (bucket public, không quét file).
- **4 route/Server Action mới của M8 chưa có rate limit**: giống ghi chú M5 — `applyCouponAction` (dò mã giảm
  giá bằng cách thử nhiều lần) và webhook tenant là 2 điểm nhạy cảm nhất; cân nhắc khi vận hành thật.
- **Route ghi dữ liệu M8 cũng chưa kiểm tra header `Origin`** (mục 7.7) — cùng khoảng trống có sẵn từ M5, áp
  dụng luôn cho các Server Action/route mới của M8; chờ đợt rà soát chung.
- **Chưa verify luồng mua hàng thật qua trình duyệt**: chọn sản phẩm → "Mua ngay" → checkout → nhập mã giảm
  giá → chọn phương thức → quét QR/redirect → polling tự cập nhật trạng thái — toàn bộ code đã có và 9
  integration test chạy thật trên Neon (RLS thật, webhook ký HMAC thật), nhưng chưa test tay qua trình duyệt
  (cần R2 + ít nhất 1 provider thanh toán tenant đã cấu hình thật qua `/studio/[tenantSlug]/settings/payments`).
- **Dashboard tenant**: 2 StatCard "Doanh thu 30 ngày"/"Đơn chờ xác nhận" đã nối dữ liệu thật; 2 ô còn lại
  ("Sản phẩm bán chạy", "Đánh giá mới" — *ô này đã nối ở M10a, 2026-09-28*) vẫn để "Cần M5/M6"/"Cần M10" — ô "Sản phẩm bán chạy" đáng lẽ có thể
  nối được luôn từ `order_items` (M8), nhưng chưa làm vì không nằm trong phạm vi hàm M8 phải xây; dễ hoàn
  thành sau bằng một `groupBy` đơn giản trên `OrderItem`.
- **Phát hiện muộn khi dựng M9 — trang `/studio/[tenantSlug]/customers` (M8) thiếu 3 việc đặc tả M8 có
  yêu cầu**: đặc tả mục M8 ghi rõ "ghi chú nội bộ [cho khách hàng], xem các đơn của khách đó tại tenant này.
  Xuất CSV" — cột `TenantCustomer.note` đã có trong schema từ M8 nhưng chưa có UI đọc/ghi; trang customers
  hiện chỉ liệt kê, chưa link sang danh sách đơn của riêng khách đó; chưa có nút xuất CSV. Bỏ sót khi viết
  `docs/modules/M8.md` (không được ghi vào BACKLOG lúc đó) — ghi nhận lại ở đây khi rà soát lại trong lúc
  làm M9. Chưa làm ngay vì ngoài phạm vi M9.

## Phát sinh trong lúc dựng M9

- **Chưa có luồng test/chạy thật qua trình duyệt**: bấm "Tải xuống" trong `/account/library`, mở
  `/s/{token}` thật, tạo link chia sẻ qua UI Studio — code đã đủ và 5 integration test chạy thật trên Neon
  (bao gồm ký thật, RLS thật), nhưng chưa verify tay qua trình duyệt (cần R2 thật, xem ghi chú tương tự ở
  M5/M8).
- **`DEFAULT_DOWNLOAD_LIMIT` (env, M5) không được dùng lại ở M9**: `Entitlement.downloadLimit` là snapshot
  của `Product.downloadLimit` lúc mua (đặt trong M8's `markOrderPaid`), không đọc lại biến env này — đúng
  thiết kế, chỉ ghi chú để không nhầm là bỏ sót.
- **`grantExtraDownloads`/`revokeEntitlement` chưa ghi audit**: đặc tả ghi "(audit)" cạnh 2 hành động này —
  cùng lý do mọi hành động "audit" khác trong dự án tới giờ (M6's `COUPON_OVERUSED`, M8's manual confirm):
  chưa có bảng `audit_logs` (M12). Sẽ nối khi M12 xây xong.
- **4 route/action mới của M9 chưa có rate limit theo IP** (chỉ có rate limit theo user/token, không theo
  IP) và **chưa kiểm tra header `Origin`** (mục 7.7) — cùng khoảng trống có sẵn từ M5/M8, áp dụng luôn cho
  route mới của M9; chờ đợt rà soát chung.
- **`/s/[token]` không giới hạn tần suất thử mật khẩu theo IP, chỉ theo token**: một token bị lộ vẫn có thể
  bị dò mật khẩu từ nhiều IP khác nhau cho tới khi chạm giới hạn 20 lượt/10 phút của chính token đó — chấp
  nhận được cho MVP (không có cách nào phân biệt "người nhận hợp lệ đang thử lại" khỏi "kẻ tấn công" theo
  IP một cách đáng tin cậy khi không bắt buộc đăng nhập); cân nhắc CAPTCHA hoặc giảm giới hạn nếu bị lạm
  dụng thật.
- **Chưa có UI xem thống kê chi tiết theo share link** (đặc tả: "xem thống kê lượt tải theo link"):
  `getShareLinkDetail()` đã trả về `downloadEvents` đầy đủ, nhưng trang Studio share-links hiện chỉ hiện
  `usedCount` tổng, chưa có trang chi tiết riêng từng link liệt kê từng lượt tải (thời gian, IP). Hàm lib đã
  sẵn sàng, chỉ thiếu trang.

## Phát sinh trong lúc dựng Storefront CMS (ADR-023) + chuẩn layout (ADR-024)

- **Test còn nợ (ADR-023):** schema section (`storefrontSectionsSchema`, luật href/ảnh), quyền sửa (Server Action
  Studio `/storefront`, `/messages`), RLS `storefront_messages` (public chỉ INSERT, tenant khác không đọc/sửa/xoá
  được). Cần chủ dự án duyệt lại ngân sách `test:count` trước khi thêm.
- **Rate limit bền vững:** form liên hệ dùng `apps/web/lib/rate-limit.ts` in-memory (1 process) — cần chuyển sang
  DB/dịch vụ chung khi chạy nhiều instance (cùng mục "Rate limit in-memory" ở M1). Không đếm bằng bảng
  `storefront_messages` được vì scope public không có SELECT.
- **Giới hạn dung lượng upload phía Cloudinary:** ảnh storefront giới hạn 2MB mới chỉ kiểm ở trình duyệt; định dạng
  đã nằm trong chữ ký. Cần upload preset (hoặc tương đương) để Cloudinary tự chặn file lớn. *(2026-09-27, ADR-028:
  server nay có incoming transformation giới hạn cạnh ≤2000px + đọc bytes thật vào hạn mức ảnh theo gói; mục preset
  chặn cứng dung lượng gộp vào "Phát sinh trong đợt ADR-028".)*
- ~~**Chính sách tự xoá tin nhắn cũ**~~ — đã quyết 2026-09-26: **không tự xoá** (`storefront_messages` giữ tới khi
  tenant xoá tay hoặc tenant bị xoá), xem ADR-023. Xem lại nếu có yêu cầu pháp lý/chính sách quyền riêng tư.
- **CSP `img-src` chưa cho host storage public R2/MinIO:** chỉ có `'self' data: blob: https://res.cloudinary.com`
  — ảnh bìa sản phẩm dựng từ `publicBaseUrl` sẽ bị chặn. *(2026-09-27: ADR-027 chuyển ảnh bìa mới sang Cloudinary; vấn
  đề chỉ còn với ảnh R2 cũ `coverImageKey` dùng làm fallback.)*
- **Chưa có luồng upload `Tenant.logoKey` / `coverKey`:** `getStorefrontProfile` đã đọc 2 cột này nhưng thực tế
  luôn `null`.
- **Trang danh sách tài liệu `/[tenantSlug]/products`** chưa có — để bật nút "Xem tất cả" của section products.
- **Menu mobile cho Studio** chưa có.
- **Trang chủ hệ thống:** chưa có skip-link; mục nav "Giáo viên & Coach" / "Khám phá tài liệu" đang là `<span>`,
  chưa phải link.
- **Chưa verify trang chi tiết sản phẩm / checkout với dữ liệu thật** (DB chưa có sản phẩm).

## Phát sinh khi tách header/footer hệ thống (ADR-025)

- **`/pricing` và `/p/[slug]` chuyển sang `SiteHeader`/`SiteFooter` (ADR-025).** Hiện `/pricing` chưa có header/footer
  nào; `/p/[slug]` còn header riêng hard-code chữ "G" làm logo (vi phạm quy tắc không hard-code chuỗi thương hiệu —
  `SiteHeader` đã dùng `BrandMark`), chưa có footer, và còn tự khai `next/font` (chuyển sang `systemFontVars`).
- **Footer hệ thống ghi năm © cố định** (`© 2026` trong `apps/web/app/_ui/site-footer.tsx`) — đổi sang năm động theo
  múi giờ `Asia/Ho_Chi_Minh`.
- **`SiteHeader` truy vấn tên người dùng ở mọi trang public khi đã đăng nhập** (`user.findUnique` lấy email +
  `profile.fullName`, cùng `resolveLandingPath`) — cân nhắc cache hoặc đưa tên hiển thị vào session.
- ~~**Trang chi tiết sản phẩm chưa hiện `StorefrontNotice` READ_ONLY**~~ — bỏ theo ADR-025: trang chi tiết sản phẩm
  là trang hệ thống, không mang banner storefront. Hành vi READ_ONLY giữ như logic M8 hiện có: tenant không `ACTIVE`
  → ẩn `BuyButton`, khối mua hiện "Trang tạm ngưng bán — chưa thể mua lúc này."; tenant `LOCKED` → 404; server vẫn
  chặn tạo đơn bằng `assertTenantCanWrite`.
- *(Ưu tiên thấp)* **Gộp `next/font` của `(auth)`/`admin`/`studio`** (`app/(auth)/layout.tsx`, `app/admin/layout.tsx`,
  `app/studio/[tenantSlug]/layout.tsx`) về `app/_ui/system-fonts.ts` khi có task chạm tới. App shell, không thuộc
  ADR-025 — hiện giữ nguyên.

## Phát sinh trong đợt Editor sản phẩm GĐ1 (ADR-026/027)

**Ảnh bìa (Cloudinary / R2)**
- **Ảnh bìa Cloudinary 5MB chỉ kiểm phía client** (`ImageUploadField maxBytes`); định dạng đã nằm trong chữ ký. Cần
  upload preset (hoặc tương đương) để Cloudinary tự chặn — cùng vấn đề ảnh storefront ở mục ADR-023. *(2026-09-27,
  ADR-028: server nay giới hạn kích thước qua incoming transformation ≤2000px và tính bytes thật (Admin API) vào hạn mức
  ảnh; phần còn lại — chặn cứng dung lượng file — chuyển sang mục ADR-028.)*
- **Asset Cloudinary mồ côi** khi tenant đổi hoặc gỡ ảnh bìa — chưa xoá asset cũ trên Cloudinary. *(Từ ADR-028 asset
  mồ côi còn ăn hạn mức ảnh — gộp vào mục "Job dọn asset mồ côi" của ADR-028.)*
- **`coverImageUrl` chưa ràng buộc folder tenant:** từ ADR-028 server đã kiểm URL thuộc **đúng cloud hệ thống**
  (`isCloudinaryImageUrl(url, cloudName)`), nhưng **chưa kiểm folder** `<uploadFolder>/tenants/<tenantId>/products` của
  đúng tenant (tenant vẫn có thể dán URL ảnh của tenant khác cùng cloud). Ảnh storefront cùng tình trạng.
- **Dọn luồng R2 cũ:** bỏ route `cover-presign`/`cover-complete` và cột `Product.coverImageKey` khi dữ liệu cũ đã chuyển
  sang Cloudinary.
- **Ảnh bìa R2 (`cover-complete`) chưa kiểm dung lượng thật** từ HeadObject (chỉ kiểm key + đuôi).

**Nghiệp vụ / server**
- **Server chưa chặn publish sản phẩm `ARCHIVED`:** `publishProduct()` chỉ bỏ qua khi đã `PUBLISHED`; UI đã ẩn đường
  này nhưng gọi action trực tiếp vẫn đưa `ARCHIVED → PUBLISHED`.
- **Race hai `complete` cùng `objectKey`:** kiểm "đã ghi nhận" chạy trước khi tạo dòng, hai request song song có thể cùng
  lọt rồi đụng `@unique` → trả 500 thay vì 409 `UPLOAD_ALREADY_COMPLETED`.
- **Action bật/tắt `isPreview` sau khi upload** chưa có — hiện chỉ chọn lúc upload.
- **Chưa revalidate storefront/trang chi tiết công khai khi publish/unpublish** — Server Action chỉ `revalidatePath` các
  trang Studio. ✅ **Đã xử lý ở ADR-030 (2026-09-28):** `revalidateProduct` nay gọi thêm
  `revalidatePath("/[tenantSlug]/[productSlug]", "page")` và `/<tenantSlug>`.
- **Trang chi tiết công khai chưa hiện tên danh mục:** `ProductDetailView` đã có prop `categoryName` (trang Xem trước dùng),
  loader trang công khai chưa trả `categoryName`.

**UI / a11y**
- **Danh sách sản phẩm Studio còn nhãn "Nháp"/"Đã xuất bản"** (`products/page.tsx`, `PRODUCT_STATUS_LABEL`) — đổi sang
  "Riêng tư"/"Công khai" cho khớp editor (ADR-027 §1).
- ~~**`<main>` lồng nhau ở trang Tạo/Sửa**~~ — đã sửa 2026-09-27 (trang Tạo/Sửa/Xem trước và skeleton dùng `<div>`).
  Còn ở 14 trang Studio khác — xem mục ADR-028 bên dưới.
- **Trang Xem trước nằm trong khung Studio** (sidebar vẫn hiện) — muốn xem toàn trang cần tách route group riêng.
- **Token màu chữ trạng thái thành công ≥ 4.5:1:** editor tạm dùng `#15803D` (`GREEN_TEXT` trong `_ui/editor-bits.tsx`),
  chưa có token trong `packages/config/src/theme.ts`.
- **404 trả HTTP 200 khi `loading.tsx` đã stream:** trang Sửa/Xem trước với sản phẩm sai tenant hiện giao diện 404 nhưng
  mã HTTP là 200.
- **Chưa kiểm bằng mắt** các trang cần đăng nhập (Tạo/Sửa/Xem trước), upload Cloudinary/R2 thật, mở link ngoài từ Thư viện.

## Phát sinh trong đợt ADR-028 (ảnh Cloudinary hệ thống + hạn mức ảnh) và cập nhật editor sau ADR-027

**Ảnh / hạn mức**
- **Dòng "Đã dùng X/Y MB ảnh"** trong Studio (editor, storefront, trang gói) — cần Server Action đọc hạn mức
  (`getTenantImageQuota` đã có ở `lib/tenant-media.ts`, chưa có action/UI).
- **Job dọn asset mồ côi** (`withSystemJob`, RLS `tenant_media_assets` đã có nhánh `system_job`): ảnh đã register nhưng
  không còn dùng trong mô tả/ảnh bìa/storefront vẫn tính hạn mức và nằm trên Cloudinary. Kèm quy trình gỡ ảnh vi phạm (nợ ADR-028).
- **Upload preset chặn cứng dung lượng** ở Cloudinary — hiện 5MB (editor, ảnh bìa) / 2MB (storefront) chỉ kiểm ở trình
  duyệt; server đã có giới hạn kích thước (incoming transformation ≤2000px) và tính bytes thật, nhưng file lớn vẫn upload
  được lên Cloudinary.
- **Upload nhiều ảnh cùng lúc trong editor** — hiện mỗi lần một ảnh (chọn/kéo-thả/dán chỉ lấy ảnh đầu tiên).

**UI / a11y**
- **Nút toolbar editor 32px** (`h-8 w-8`, `app/_ui/editor/tiptap-toolbar.tsx`) — dưới vùng chạm 44px trên mobile.
- **`<main>` lồng ở 14 trang Studio khác** (layout Studio đã có `<main>`): `page.tsx` tổng quan, `billing`, `coupons`
  (danh sách/new/[couponId]), `customers`, `messages`, `orders` (danh sách/[orderId]), `products` (danh sách),
  `products/[productId]/share-links`, `settings`, `settings/payments`, `storefront` — đổi sang `<div>`.
- **Sửa mô tả trang Cloudinary admin theo ADR-027/028** (`/admin/settings/cloudinary`, chưa giao sửa code): vẫn ghi Cloudinary "dùng riêng cho Landing Page CMS" và ảnh bìa
  ở R2 — từ ADR-027/028 Cloudinary chứa cả ảnh bìa, ảnh storefront, ảnh mô tả tenant.

**Môi trường dev**
- **Nhập lại cấu hình R2 (`/admin/settings/storage`) + SePay platform (`/admin/billing/payment`) trên DB dev** — bị các
  integration test cũ xoá (trước khi có `tests/integration/shared-config-snapshot.ts`). Sau khi nhập lại cần "Kiểm tra
  kết nối" để bật.

## Phát sinh trong đợt M10a (ADR-029 — siết RLS ghi + Đánh giá sản phẩm)

**Phạm vi đã tách ra khỏi M10a (ADR-029 mục 1)**
- **M10c — bình luận, thả tim, theo dõi tenant**: ngoài phạm vi M10 giai đoạn 1.
- **Nút "Báo cáo vi phạm"** cho đánh giá (và bài viết M10b): đợi M12 (Báo cáo vi phạm).
- **SEO `AggregateRating`** (structured data điểm đánh giá trên trang chi tiết tài liệu): giai đoạn 3.

**Nợ test (chủ dự án chọn chưa thêm test ở ADR-029)**
- Integration test RLS **7 bảng** đã tách policy (`products`, `product_files`, `coupons`, `share_links`, `orders`,
  `order_items`, `entitlements`): scope public/customer không INSERT/UPDATE/DELETE được; tenant/`system_job` vẫn ghi được.
- Integration test `reviews`: RLS theo từng lệnh (khách chưa mua/đã hoàn tiền không tạo được, public không thấy `HIDDEN`,
  tenant khác không thấy), trigger `reviews_guard_columns` (khách không đổi cột kiểm duyệt/trả lời, tenant không đổi nội
  dung), tự ẩn khi hoàn tiền/thu hồi + tự hiện khi mua lại, điểm trung bình (`recomputeProductRatings`, `computeRatingAverage`).
  Thêm test phải hỏi lại chủ dự án về trần `pnpm test:count` (hiện 93/94 unit, 52/53 integration).

**Vận hành / dữ liệu**
- **Job đối soát cache điểm** `products.ratingSum/ratingCount` (`withSystemJob`, SUM/COUNT lại toàn bộ định kỳ): hiện
  `recomputeProductRatings` lỗi chỉ log, cache chỉ tự sửa ở lần ghi đánh giá tiếp theo của sản phẩm đó.
- **Audit log ẩn/khôi phục đánh giá** vào `audit_logs` (M12) — hiện chỉ log pino `REVIEW_HIDDEN`/`REVIEW_RESTORED`/
  `REVIEW_HIDDEN_REFUNDED`/`REVIEW_RESTORED_AFTER_REPURCHASE`.
- ~~**Seed dữ liệu demo**~~ (đơn FULFILLED + entitlement + đánh giá nhiều mức sao, có/không trả lời, đánh giá ẩn) để kiểm giao
  diện trang chi tiết tài liệu, section "Đánh giá" storefront, Thư viện và Studio → Đánh giá. *(Đã có 2026-09-28: script chỉ
  cho dev `apps/web/scripts/demo-reviews.ts` — `ALLOW_DEMO_SEED=1 pnpm --filter @gieochu/db run demo:seed|demo:clean`, xem KB
  `04-Operations-Runbooks/Dev-Demo-Data-Runbook.md`. Chưa có dữ liệu demo bài viết.)*

**Giao diện / hiệu năng**
- **`loadMoreProductReviews`** (tải thêm phía client) khi sản phẩm có > 50 đánh giá — hiện phân trang không JS `?reviews=N`
  (tối đa 50) rồi `?reviewsAfter=<cursor>` thay trang.
- **`listTenantProductOptions` nhẹ** (chỉ id + tiêu đề) cho bộ lọc sản phẩm ở Studio → Đánh giá, thay vì tải danh sách sản
  phẩm đầy đủ.

**Ưu tiên thấp — làm khi có task chạm tới (Quốc quyết 2026-09-28)**
- **Trang Xem trước Studio đọc đánh giá bằng `withTenant`** thay vì `withPublic` (`getProductReviews`/`getProductRatingSummary`)
  để hiện đánh giá cả khi sản phẩm đang DRAFT (hiện RLS public đòi `PUBLISHED` nên luôn "Chưa có đánh giá").
- **`studio/[tenantSlug]/reviews/_ui/review-card.tsx` chuyển màu hex cục bộ** (`#12213A`, `#6B7280`, `#E5E7EB`, `#0F3B82`)
  sang token `brandColors` (`@gieochu/config/theme`) như `review-composer.tsx`.
- **Schema section `testimonials` chuyển `rating` sang tuỳ chọn** (`packages/core/src/tenant/storefront-sections.ts`) — UI
  "Cảm nhận" không còn hiện/sửa sao, editor đang tự đặt `rating: 5` cho mục mới; dữ liệu cũ vẫn hợp lệ.

## Phát sinh trong đợt M10b (ADR-029 — Bài viết tối giản)

**Nợ test (chủ dự án chọn chưa thêm test ở ADR-029)**
- Integration test RLS `posts`: public chỉ thấy `PUBLISHED` của tenant không `LOCKED` (không thấy DRAFT/HIDDEN), tenant khác
  không đọc/ghi được, tenant không tạo/đặt/gỡ `HIDDEN` (policy `tenant_insert` + trigger `posts_guard_columns`), không gắn được
  sản phẩm tenant khác (trigger `posts_guard_product_tenant`), partial unique index 1 bài ghim/tenant.
- Unit test sanitize/đếm ảnh bài viết (`preparePostBody`: ảnh ngoài cloud hệ thống bị loại, > 6 ảnh bị từ chối, body chỉ có
  ảnh hợp lệ), `buildPostExcerpt`/`normalizePostTitle`.
- Test feed công khai: `listPublishedPosts` (bài ghim đầu trang 1, không trùng, cursor), `getStorefrontPosts` (`limit` 3–9,
  `showPinnedFirst`). Thêm test phải hỏi lại chủ dự án về trần `pnpm test:count` (hiện 93/94 unit, 52/53 integration).

**Giao diện**
- **`loading.tsx` cho trang public** `/[tenantSlug]/posts` và `/[tenantSlug]/posts/[postId]` (Studio → Bài viết đã có).
- **Modal xác nhận thay `window.confirm`** (xoá bài, gỡ bài; cùng mẫu với xoá đánh giá của khách).
- **Báo trước tenant `READ_ONLY` trong editor bài viết** — hiện chỉ biết khi bấm lưu (server trả `FORBIDDEN`).
- **Sidebar Studio đã 11 mục** — cân nhắc nhóm mục (vd Bán hàng / Nội dung / Cài đặt) khi thêm mục mới.
- Danh sách Studio → Bài viết chưa hiển thị ảnh đầu bài dù `listTenantPosts` đã trả `imageUrl`.

**Vận hành / dev**
- **Dev server Turbopack trả 404 tạm thời khi vừa thêm route mới** (theo báo cáo đợt M10b) — mẹo: `touch` (lưu lại) file route
  mới.
- **`prisma migrate dev` và partial unique index `posts_tenantId_pinned_key`**: index chỉ có trong SQL migration, Prisma schema
  không biểu diễn được → đọc kỹ migration sinh ra, không để mất index.
- **Dữ liệu demo bài viết** cho DB dev (script hiện chỉ tạo sản phẩm/đơn/đánh giá).
- **Luồng đặt/gỡ `HIDDEN` cho bài viết** (Báo cáo vi phạm, M12) — hiện chưa có đường nào đặt `HIDDEN`.

## Phát sinh trong đợt ADR-030 (URL tài liệu rút gọn + bỏ card xuất bản dính)

**Việc bắt buộc trước deploy prod**
- **Quét slug sản phẩm trùng từ dành riêng trên DB prod** (23 mục `RESERVED_PRODUCT_SLUGS`, `packages/core/src/product/path.ts`):
  sản phẩm tạo trước ADR-030 có slug trùng sẽ 404 ở URL mới (slug không đổi được sau khi tạo). Làm lại mỗi khi thêm route
  tĩnh mới dưới `app/[tenantSlug]/`.

**Nợ test**
- Test tự động cho redirect **301** `/{tenantSlug}/products/{productSlug}` → `/{tenantSlug}/{productSlug}` (giữ query; slug dành
  riêng → 404) và chặn slug dành riêng khi tạo sản phẩm (`INVALID_SLUG` cho slug tự nhập, hậu tố cho slug tự sinh). Thêm test
  phải hỏi lại chủ dự án về trần `pnpm test:count` (hiện 93/94 unit, 52/53 integration).

**SEO / hiệu năng**
- **Sitemap/robots** (chưa có): khi làm SEO phải dùng URL mới qua `productUrl`/`productPath`.
- **Mọi URL 2 segment giờ đi qua trang tài liệu**: đường dẫn `/{a}/{b}` không khớp route tĩnh nào đều vào
  `app/[tenantSlug]/[productSlug]/page.tsx` → tốn 1 query tìm tenant trước khi 404.
- **Revalidate theo slug cụ thể** thay vì route pattern `/[tenantSlug]/[productSlug]`: hiện mỗi lần một tenant sửa
  sản phẩm/đánh giá sẽ làm mới trang tài liệu của mọi tenant (chấp nhận được vì trang dynamic; tối ưu khi cần).

## Phát sinh trong đợt ADR-031 (deploy Vercel)

**Hạ tầng production**
- **Host cho worker pg-boss** (`apps/web/worker.ts`, `pnpm --filter @gieochu/web run worker`): Vercel không chạy tiến trình lâu
  dài. Chưa chọn (ứng viên Railway / Fly.io / VPS). Cần Node ≥ 20.9, cài cả monorepo, cùng bộ env runtime như Vercel (không
  `PRISMA_MIGRATE_URL`). Thiếu worker: file sản phẩm kẹt "Đang quét" (`FILE_SCAN`), đơn `PENDING` không hết hạn
  (`ORDER_SWEEP`), webhook thanh toán tenant không được xử lý (`PAYMENT_PROCESS`), quét subscription theo giờ không chạy
  (`SUBSCRIPTION_SWEEP`). Email **không** phụ thuộc worker (gửi đồng bộ).
- **Gửi job pg-boss từ Vercel (serverless):** `apps/web/lib/jobs.ts` giả định tiến trình Node sống lâu — cần kiểm hành vi
  thật trên Vercel (độ trễ khởi động, số kết nối `DIRECT_URL`).

**Build**
- **Cân nhắc build command `pnpm --filter @gieochu/db run generate && next build`** thay cho `next build` để tránh Prisma client
  commit ở `packages/db/src/generated` lệch `schema.prisma` khi quên generate (Vercel hiện dùng nguyên bản đã commit).
  `prisma generate` không cần `PRISMA_MIGRATE_URL` từ ADR-031.

**CI (`.github/workflows/ci.yml`)**
- `ci.yml` vẫn khai `PRISMA_MIGRATE_URL` (secret `TEST_PRISMA_MIGRATE_URL`) — hợp lệ vì CI là môi trường dev/CI, không phải
  runtime. Lưu ý hiện trạng: `ci.yml` **chưa có bước `db:migrate`** nên biến này chưa được dùng; nếu muốn CI chạy migrate
  thì phải thêm bước.
- Cần rà thêm (chưa quyết): trigger `push: [main]` trong khi nhánh chính là `master`; thiếu `STORAGE_ENCRYPTION_KEY`; biến
  `S3_*` thừa (storage cấu hình qua Admin từ ADR-017).

**Chưa verify (cần môi trường thật)**
- Deploy Vercel thành công lần đầu; `prisma db seed` khi không đặt `PRISMA_MIGRATE_URL`; CSP nonce trên các trang trước đây
  static; quét slug dành riêng trên DB prod (xem mục ADR-030). Quy trình: KB `04-Operations-Runbooks/Deploy-Vercel-Runbook.md`.

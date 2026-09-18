# BACKLOG

Việc ngoài phạm vi M0–M12 (mục 2.2 và mục 12 của đặc tả), hoặc phát sinh trong lúc code mà không thuộc module
đang làm. Không triển khai cho tới khi được yêu cầu rõ ràng.

## Từ mục 2.2 — Ngoài phạm vi MVP giai đoạn 1

- Tên miền riêng cho tenant (custom domain), subdomain wildcard.
- PDF stamping, watermark.
- Nhân viên tenant (staff) với phân quyền chi tiết — schema chừa sẵn `role STAFF` nhưng UI chỉ cho owner.
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
  vì Order (M8), Review (M10) chưa tồn tại — nối số liệu thật khi các module đó xong.
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
- **`/studio/[tenantSlug]/billing` chưa có progress bar dung lượng**: hiện chỉ hiện số MB đã dùng
  (`tenant.storageUsedBytes`), chưa hiển thị so với `plan.storageMb` dưới dạng thanh tiến trình — cần thiết
  kế UI, không ảnh hưởng đúng đắn dữ liệu.
- **Không có trang admin "danh sách toàn bộ subscription + override thủ công"**: báo cáo tham khảo TaniGos có
  `admin/billing/subscriptions` (gia hạn thủ công/đổi gói/suspend thủ công cho từng merchant); đặc tả M3 của
  Gieo Chữ không yêu cầu tường minh nên chưa làm — cân nhắc thêm khi vận hành thật cần can thiệp tay.
- **SePay/MoMo webhook cho platform dùng chung hạn chế với M7** (chỉ parse JSON body, chưa test-connection
  cho SePay/MANUAL_QR) — cùng ghi chú đã có ở mục M7 phía trên, áp dụng y hệt cho phía Platform.
- **Auto-disable-khi-đổi-cấu-hình (ADR-013) chỉ áp dụng `PlatformPaymentConfig`**: `TenantPaymentConfig` (M7)
  chưa có cơ chế này — cân nhắc đồng bộ khi có nhu cầu thật, không bắt buộc vì không ảnh hưởng đúng đắn của
  M7 hiện tại (chỉ là một lớp an toàn bổ sung).

## Phát sinh trong lúc dựng M5 (cả 2 giai đoạn — metadata/CRUD rồi upload thật, xem ADR-014/017/018)

- **Chưa verify upload thật end-to-end với R2 thật**: toàn bộ code (`presign.ts`, `scan.ts`, route 4 cái,
  job `file.scan`, UI `UploadFileForm`/`CoverImageUpload`) đã viết xong, xanh lint/typecheck/build, và 1/2
  integration test còn thiếu đã hoàn thành (presign auth — dùng `SystemStorageConfig` giả vì presign đơn là
  ký chữ ký thuần không gọi mạng). Còn thiếu: verify thật qua trình duyệt với R2 thật (upload đơn, upload
  multipart file >50MB, file giả mạo đuôi bị `file.scan` từ chối thật, `complete` gọi `HeadObject` thật) —
  người dùng tự làm khi nhập credential ở `/admin/settings/storage`.
- **1/4 integration test M5 còn thiếu**: "`complete` ghi `product_files` và enqueue job quét" — cần
  `HeadObject` thật lên bucket thật (không thể giả bằng config giả như test presign).
- **Trang public `/{tenantSlug}/products/{productSlug}`**: đề xuất ở kế hoạch M5 (hiển thị tối thiểu
  tiêu đề/ảnh bìa/mô tả/giá/file preview) nhưng chưa xây — không nằm trong 6 unit/4 integration test bắt
  buộc, hoãn tới khi cần.
- **`unpublishProduct()` không kiểm tra "chưa có đơn"**: đặc tả ghi "PUBLISHED → DRAFT: Owner gỡ xuống (chưa
  có đơn)" nhưng M8 (Order) chưa tồn tại nên không có gì để kiểm tra — hiện luôn cho phép gỡ. Nối lại điều
  kiện khi M8 xong.
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

- **1/2 integration test M6 hoãn tới M8**: "Coupon chỉ bị tính lượt khi đơn PAID, hai đơn đồng thời không
  vượt usageLimit" — cần `Order` thật (chuyển trạng thái `PAID`) để test có ý nghĩa, `Order` thuộc M8 (đứng
  sau M6 đúng thứ tự triển khai). Khi M8 xây xong: viết hàm tiêu thụ coupon dùng
  `UPDATE coupons SET usedCount = usedCount + 1 WHERE id = ... AND usedCount < usageLimit` (atomic, đúng đặc
  tả — chống vượt `usageLimit` khi 2 đơn thanh toán đồng thời), ghi `coupon_redemptions`, nếu update trả về 0
  dòng (hết lượt đúng lúc thanh toán) vẫn giữ đơn `PAID` + ghi audit `COUPON_OVERUSED` (đúng đặc tả mục M6).
- **`CouponRedemption.orderId` chưa có `@relation` tới `Order`**: cột string thường vì `Order` (M8) chưa tồn
  tại. M8 thêm quan hệ khi có Order — không cần đổi kiểu cột, chỉ thêm `@relation` + trường quan hệ.
- **Chưa có UI công khai áp mã trên storefront**: `calculatePrice()` và API
  `POST /api/[tenantSlug]/coupons/preview` đã sẵn sàng, nhưng chưa có trang chi tiết sản phẩm công khai (hoãn
  từ M5) hay giỏ hàng/checkout (M8) để gắn ô nhập mã vào — UI thật sẽ làm cùng lúc với 2 module đó.
- **Trang Studio coupon chưa có nút xoá**: chỉ có tạo/sửa/bật-tắt (`isEnabled`) — đặc tả không yêu cầu xoá
  tường minh, tắt coupon coi như đủ cho MVP; cân nhắc thêm nếu người dùng cần dọn hẳn mã cũ.

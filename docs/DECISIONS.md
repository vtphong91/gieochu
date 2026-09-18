# DECISIONS — ADR ngắn

Định dạng: mỗi mục là một quyết định khi đặc tả mơ hồ (mục 0.6 của
[GIEOCHU_PROMPT_MVP_PHASE1.md](GIEOCHU_PROMPT_MVP_PHASE1.md)), gồm Bối cảnh / Quyết định / Lý do.

## ADR-001 — ID strategy: cuid2

- **Bối cảnh:** Mục 3 yêu cầu "Mọi ID dùng cuid2 hoặc UUID v7 (chọn một)".
- **Quyết định:** Dùng cuid2 qua thuộc tính gốc của Prisma `@id @default(cuid(2))` cho mọi model.
- **Lý do:** Không cần thêm thư viện ngoài, Prisma sinh ở tầng ứng dụng, ngắn hơn UUID, sắp xếp được theo thời
  gian tạo (tốt cho index), và đã được xác minh hỗ trợ native trong Prisma Schema Reference.

## ADR-002 — Generator Prisma: `prisma-client` (không dùng `prisma-client-js`)

- **Bối cảnh:** `prisma-client-js` (sinh vào `node_modules`) đã deprecated kể từ Prisma 7.
- **Quyết định:** Dùng generator `prisma-client` với `output = "../src/generated/prisma"`, import trực tiếp
  từ đường dẫn sinh ra thay vì package `@prisma/client`.
- **Lý do:** Theo khuyến nghị chính thức của Prisma cho dự án mới (đã xác minh qua tài liệu Prisma ORM v7).

## ADR-003 — Kết nối DB: `@prisma/adapter-neon`, `prisma.config.ts` dùng `DIRECT_URL`

- **Bối cảnh:** Mục 3 yêu cầu ORM Prisma + `@prisma/adapter-neon`, CLI dùng `DIRECT_URL`, runtime dùng
  `DATABASE_URL` pooled.
- **Quyết định:** `prisma.config.ts` trỏ `datasource.url` sang `env("DIRECT_URL")` (dùng cho migrate/seed);
  `schema.prisma` có `datasource db { url = env("DATABASE_URL") }`; `packages/db/src/client.ts` tạo
  `PrismaNeon({ connectionString: getEnv().DATABASE_URL })` rồi truyền vào `new PrismaClient({ adapter })`.
- **Lý do:** Khớp đúng hướng dẫn chính thức tại prisma.io/docs/orm/overview/databases/neon (đã xác minh qua
  WebFetch trước khi code).

## ADR-004 — Postgres local (docker-compose `profile: local-db`) là tuỳ chọn phụ, không phải đường chính

- **Bối cảnh:** Mục 8/M0 liệt kê `postgres:16` trong docker-compose với "profile local-db, dùng khi không
  muốn gọi Neon", nhưng đồng thời mục 3 chốt dùng `@prisma/adapter-neon` — driver này nói chuyện qua giao thức
  serverless/WebSocket của Neon (Neon serverless driver), không phải giao thức Postgres TCP thường mà một
  container `postgres:16` thuần cung cấp.
- **Quyết định:** Giữ service `postgres` trong `docker-compose.yml` đúng như đặc tả (cho các trường hợp cần
  Postgres thuần, ví dụ chạy `psql` kiểm tra thủ công), nhưng khuyến nghị mặc định cho dev/test là dùng một
  Neon branch miễn phí (đặt `DATABASE_URL`/`DIRECT_URL` trỏ tới đó). Nếu người dùng thực sự cần offline
  hoàn toàn với `adapter-neon` + Postgres local, cần chạy thêm Neon local proxy (`neon-proxy`) — ghi vào
  `docs/BACKLOG.md`, chưa triển khai ở M0.
- **Lý do:** Đây là quyết định ảnh hưởng tới hạ tầng DB, không ảnh hưởng tiền/bảo mật/dữ liệu cá nhân trực
  tiếp, nên chọn phương án đơn giản nhất theo mục 0.6 và ghi rõ đánh đổi thay vì tự ý đổi driver.

## ADR-005 — TypeScript pin ở 5.9.x, chưa dùng TypeScript 7 (tsgo)

- **Bối cảnh:** `npm view typescript version` trả về `7.0.2` là bản mới nhất tại thời điểm code, nhưng đây là
  bản port native (tsgo) còn rất mới.
- **Quyết định:** Pin `typescript@5.9.3` (bản 5.x ổn định mới nhất) cho toàn monorepo.
- **Lý do:** `ts-jest`, `typescript-eslint`, và nhiều tool khác trong stack (mục 3) chưa chắc tương thích đầy
  đủ với TypeScript 7 tại thời điểm này; ưu tiên ổn định toolchain hơn là bản mới nhất.

## ADR-006 — Logger đặt trong `packages/core`, không tạo package riêng

- **Bối cảnh:** Mục M0 yêu cầu "Logger `pino` có redact" nhưng không chỉ định package chứa nó.
- **Quyết định:** Đặt `logger.ts` trong `packages/core` cùng `errors.ts`.
- **Lý do:** `core` đã là nơi chứa tiện ích dùng chung không phụ thuộc DB (theo mô tả ở mục 4.4: "pricing,
  order FSM, slug, code"); tạo thêm package riêng chỉ cho logger là over-engineering ở giai đoạn này.

## ADR-007 — `pg-boss` kết nối qua `DIRECT_URL`, không qua pooler

- **Bối cảnh:** `pg-boss` (M11 khung, dùng từ M1 để gửi email kích hoạt/reset) cần một kết nối Postgres ổn
  định; kết nối pooled của Neon đi qua PgBouncer ở chế độ transaction, không đảm bảo hành vi cấp phiên mà
  `pg-boss` có thể cần (LISTEN/NOTIFY, prepared statement, v.v.).
- **Quyết định:** `packages/jobs` nhận connection string do caller truyền vào; `apps/web` luôn truyền
  `DIRECT_URL` (không phải `DATABASE_URL`) khi tạo job queue, cả trong route handler lẫn `worker.ts`.
- **Lý do:** An toàn, đơn giản nhất — tránh lỗi khó tái hiện do pooler transaction-mode; `DIRECT_URL` vốn đã có
  sẵn cho CLI/migrate (ADR-003) nên không cần thêm biến môi trường mới.

## ADR-008 — `UserProfile` được tạo một phần ngay khi đăng ký, hoàn thiện dần sau

- **Bối cảnh:** Mục "M1" liệt kê đăng ký thu thập "họ tên" cùng lúc với "đồng ý điều khoản", nhưng ERD §5.1
  đặt `consentAt` trong bảng `UserProfile` cùng với `phone`, `occupation`, `province` — những trường chỉ được
  thu thập sau, ở bước hoàn thiện hồ sơ bắt buộc. Hai đoạn đặc tả này mâu thuẫn nếu `UserProfile` yêu cầu đủ 4
  trường ngay từ đầu.
- **Quyết định:** `UserProfile.fullName` và `consentAt` bắt buộc, tạo ngay lúc đăng ký (transaction cùng
  `User`). `phone`, `occupation`, `province` để `String?` (nullable), null lúc đăng ký, được điền ở
  `/account/profile?complete=1`. `isProfileComplete()` (`packages/auth/src/profile.ts`) kiểm tra đủ cả 4
  trường non-blank — không đổi hành vi gate `/account/*`, `/studio/*`, checkout.
- **Lý do:** Giữ đúng nghĩa đen của đặc tả (đăng ký thu "họ tên" + "đồng ý điều khoản") mà không phá vỡ yêu
  cầu hồ sơ bắt buộc đủ 4 trường; đây là quyết định về cấu trúc dữ liệu, không ảnh hưởng tiền/bảo mật/dữ liệu
  cá nhân theo hướng bất lợi (dữ liệu cá nhân vẫn được thu thập, chỉ tách làm hai bước).

## ADR-010 — Role Postgres riêng cho app (`gieochu_app`), tách khỏi `neondb_owner`, để RLS có hiệu lực thật

- **Bối cảnh:** Khi viết integration test cho RLS ở M4 (`withTenant(A)` không được đọc `products` của B), test thất
  bại dù policy RLS đã bật đúng (`ENABLE`/`FORCE ROW LEVEL SECURITY`, policy đúng). Kiểm tra `pg_roles` phát hiện
  role mặc định Neon cấp (`neondb_owner`) có `rolbypassrls = true` — Postgres luôn bỏ qua RLS cho role có cờ này,
  bất kể `FORCE`. Đây là hành vi mặc định của role "owner" trên nhiều nền tảng Postgres quản lý, không phải lỗi
  cấu hình. `ALTER ROLE neondb_owner NOBYPASSRLS` bị Neon từ chối (không có quyền tự đổi thuộc tính của chính role
  owner).
- **Quyết định:** Tạo role `gieochu_app` riêng (`NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS`), chỉ cấp
  `SELECT/INSERT/UPDATE/DELETE` trên các bảng hiện có + `ALTER DEFAULT PRIVILEGES` để tự động cấp quyền đó cho
  bảng mới tạo sau này (không cần nhớ GRANT lại mỗi migration). Runtime app (`DATABASE_URL`, `DIRECT_URL`) dùng
  role này. Việc tạo role nằm trong script riêng `packages/db/scripts/setup-app-role.mts` (chạy 1 lần/môi
  trường qua `pnpm --filter @gieochu/db run setup-app-role`), **không** nằm trong Prisma migration, vì role là
  đối tượng cấp cluster/project chứ không phải cấp schema.
  Vì `gieochu_app` không có quyền DDL (`CREATE`/`ALTER TABLE`), `prisma migrate`/`generate` vẫn cần role owner —
  tách riêng biến môi trường mới **`PRISMA_MIGRATE_URL`** (owner, chỉ CLI dùng) khỏi **`DIRECT_URL`** (nay là
  `gieochu_app`, dùng cho pg-boss — vẫn đúng tinh thần ADR-007 là không qua pooler).
- **Lý do:** Đây là quyết định bảo mật trực tiếp (RLS chỉ có ý nghĩa nếu kết nối app không bypass nó) nên đã dừng
  lại hỏi người dùng trước khi thực hiện thay vì tự ý chọn phương án "chấp nhận RLS chỉ là lớp phòng thủ trên
  giấy". Người dùng chọn tạo role riêng.
- **Việc cần làm khi thêm module có bảng L2 mới:** không cần chạy lại `setup-app-role.mts` (nhờ
  `ALTER DEFAULT PRIVILEGES`), nhưng nếu tạo schema Postgres mới (khác `public`/`pgboss`) thì cần chạy lại script
  để cấp quyền cho schema đó.

## ADR-009 — Integration test (Vitest) dùng chung Neon DB với dev, không có `TEST_DATABASE_URL` riêng

- **Bối cảnh:** Mục 9 khuyến nghị "DB test riêng cho test, Neon branch hoặc Postgres container", nhưng tạo
  Neon branch mới cần thao tác qua Neon Console/API mà phiên làm việc này không có quyền tự động hoá.
- **Quyết định:** M1 integration test chạy trực tiếp trên `DATABASE_URL`/`DIRECT_URL` hiện có (cùng DB với
  seed/dev). Mỗi test tự sinh email duy nhất (tiền tố theo timestamp + random) và tự dọn dẹp user đã tạo ở
  `afterAll`. `fileParallelism: false` trong `vitest.config.ts` để tránh xung đột giữa các file test chạy
  song song.
- **Lý do:** Đơn giản nhất trong điều kiện hiện tại; không có rủi ro tiền/bảo mật (dữ liệu test là dữ liệu
  tổng hợp do chính test tạo ra và tự xoá). Khi có quyền tạo Neon branch, nên tách `TEST_DATABASE_URL` riêng —
  ghi vào `docs/BACKLOG.md`.
- **Cách gọi route handler:** Test import trực tiếp hàm `POST`/`GET` từ file `route.ts` và gọi với
  `NextRequest` dựng tay (theo mục 9: "gọi route handler trực tiếp hoặc qua fetch tới server test"), tránh
  phải chạy cả một Next server thật trong lúc test. Với trang Server Component có `redirect()`
  (`/account/library`), test gọi thẳng hàm guard trong `lib/page-guards.ts`, mock `next/headers` để cấp cookie
  giả, và bắt lỗi `NEXT_REDIRECT` mà `redirect()` ném ra thay vì render cả trang.

## ADR-011 — Tạo `platform_payment_configs` (bảng, chưa UI) sớm ở M7 thay vì để M3

- **Bối cảnh:** Test tích hợp #4 của M7 viết đúng nghĩa đen "webhook tenant ký bằng secret của platform bị từ
  chối (và ngược lại)", nhưng theo đúng thứ tự triển khai mục 10 (M7 → M3), bảng cấu hình thanh toán của
  Platform vốn thuộc phạm vi M3. Nếu không có bảng này, test #4 không thể kiểm chứng đúng nghĩa đen được.
- **Quyết định:** Đã hỏi lại người dùng (ảnh hưởng cấu trúc dữ liệu thanh toán — mục 0.6) trước khi làm, thay
  vì tự diễn giải lại đề bài. Người dùng chọn tạo bảng `platform_payment_configs` tối thiểu ngay ở M7 (cùng
  hình dạng `tenant_payment_configs` nhưng không có `tenantId` — đúng mục 5.1), **không có UI/business logic**
  đi kèm — UI Platform Payment vẫn thuộc M2 "hoàn thiện" (sau M12), business logic áp dụng thật (tạo hoá đơn,
  webhook platform thật) vẫn thuộc M3.
- **Lý do:** Test #4 giờ dùng dữ liệu thật (`prisma.platformPaymentConfig.create(...)`) thay vì mô phỏng, kiểm
  chứng đúng những gì đặc tả yêu cầu; M3 sau này tái sử dụng bảng có sẵn thay vì tự tạo lại.

## ADR-012 — Xác minh VietQR/CRC16 bằng cách tự dựng test vector, không dùng mẫu bên thứ 3 nguyên trạng

- **Bối cảnh:** Tra một implementation VietQR TypeScript bên thứ 3 (qua WebFetch) để lấy chuỗi payload mẫu
  làm test "khớp mẫu đã biết" (mục 9, M7 unit test #3). Khi tự viết script phân tích lại chuỗi đó theo đúng
  cấu trúc TLV EMVCo, phát hiện chuỗi mẫu có lỗi lệch 1 ký tự nội bộ (độ dài khai báo của subtag số tài khoản
  không khớp số ký tự thực tế) — khả năng do lỗi đánh máy ở nguồn, hoặc do công cụ tóm tắt nội dung trang làm
  sai lệch một vài ký tự trong chuỗi số dài (WebFetch dùng model tóm tắt, không đảm bảo sao chép nguyên văn
  chuỗi dài).
- **Quyết định:** Không dùng chuỗi mẫu đó. Thay vào đó: (1) xác minh thuật toán CRC-16/CCITT-FALSE bằng test
  vector chuẩn quốc tế độc lập với VietQR (chuỗi `"123456789"` → `0x29B1`, thuộc catalogue CRC được nhiều
  nguồn xác nhận trùng khớp); (2) tự dựng payload bằng chính hàm `buildVietQrPayload()` với input đơn giản,
  xác minh cấu trúc TLV đúng qua script phân tích lại (không đoán bằng tay), dùng kết quả đó làm test vector
  "đã biết" cho unit test.
- **Lý do:** Đây là hệ quả trực tiếp của mục 0.7 ("payload/endpoint trong file này chỉ tham khảo, luôn kiểm
  tra tài liệu chính thức") — khi nguồn tham khảo tự nó không đáng tin (phát hiện được nhờ tự kiểm chứng bằng
  code thay vì tin bằng mắt), chọn phương án tự xác minh từ gốc (thuật toán chuẩn + cấu trúc đã xác nhận qua
  nhiều nguồn độc lập) thay vì lan truyền một lỗi tiềm ẩn vào bộ test.

## ADR-013 — Dedupe hoá đơn PENDING + tự tắt `PlatformPaymentConfig` khi đổi tài khoản/secret (M3)

- **Bối cảnh:** Trước khi code M3, người dùng đưa một báo cáo kỹ thuật về module payment của một hệ thống
  khác họ tự xây (TaniGos — `docs/bao-cao-ky-thuat-module-payment-2026-09-18.md`) đã chạy production, yêu cầu
  dùng làm tham khảo để phát triển module này. Đối chiếu với đặc tả M3 (không mâu thuẫn, chỉ bổ sung 2 điểm
  đặc tả không nói rõ):
  1. Đặc tả không nói owner bấm "Gia hạn" nhiều lần liên tiếp (trước khi hoá đơn cũ hết hạn 24h) thì xử lý
     thế nào.
  2. Đặc tả không nói khi admin sửa `PlatformPaymentConfig` (đổi số tài khoản/API key) thì cờ `isEnabled`/
     `lastVerifiedAt` có giữ nguyên hay không.
- **Quyết định:** (1) `createRenewalInvoice` tái sử dụng hoá đơn `PENDING` còn hạn thay vì tạo hoá đơn mới —
  đúng pattern `createRenewalInvoice()`/dedupe đã kiểm chứng thật trong báo cáo TaniGos. (2)
  `savePlatformProviderConfig` tự đặt `isEnabled=false` và xoá `lastVerifiedAt` khi số tài khoản/BIN (hoặc
  partnerCode MoMo) hay secret thay đổi so với bản đã lưu — đúng cơ chế "tự tắt an toàn" của
  `config.service.ts` trong báo cáo — admin phải lưu lại lần nữa (đã tích "Bật") để xác nhận cấu hình mới.
  Sửa các trường không ảnh hưởng định danh tài khoản (tên chủ TK, `authType`...) không kích hoạt việc này.
- **Lý do:** Cả hai đều là lựa chọn an toàn/đơn giản, không mâu thuẫn với đặc tả M3, và đã được kiểm chứng
  bằng hệ thống thật trong báo cáo tham khảo — tránh (1) owner tạo nhiều hoá đơn trùng cho cùng một kỳ, (2)
  một cấu hình thanh toán "đang bật" nhưng thông tin đã đổi chưa ai xác minh lại. Phạm vi áp dụng chỉ ở
  `PlatformPaymentConfig` (M3); `TenantPaymentConfig` (M7) không đổi để tránh phá test M7 đã chốt.

## ADR-014 — M5 chia làm 2 phần: metadata/CRUD trước, upload/storage thật sau

- **Bối cảnh:** M5 cần S3-compatible storage thật để test presign/upload/`file.scan` (đọc/ghi/xoá object
  thật). `.env` cấu hình sẵn trỏ tới MinIO local (`S3_ENDPOINT=http://localhost:9000`, credentials khớp
  `docker-compose.yml`), nhưng máy đang code **không có Docker** (không có lệnh `docker`, không có WSL
  distro, không có Docker Desktop). Đã hỏi người dùng (ảnh hưởng cách verify hạ tầng — mục 0.6) trước khi
  quyết định.
- **Quyết định:** Người dùng chọn tạm gác toàn bộ phần upload/storage lại, làm sau như một module riêng.
  Phiên này chỉ làm phần **không phụ thuộc storage thật**: schema `Product` (mở rộng đầy đủ) + `ProductFile`
  (model, RLS — chưa có object nào thật), CRUD sản phẩm, 3 hàm logic thuần
  (`packages/core/src/product/`), 2 hàm thuần thuộc `packages/storage` (`file-format.ts`, `object-key.ts` —
  không gọi mạng, chỉ validate chuỗi/định dạng). Route `presign`/`complete`, job `file.scan`, S3 client thật,
  và 2/4 integration test cần storage thật (đã liệt kê trong đặc tả mục 9 M5) **để lại cho module upload sau**.
  Khi làm tiếp, hướng đã thống nhất: dùng **Cloudflare R2 thật** cho cả dev lẫn production (giống Neon đang
  dùng cho DB) thay vì cài Docker chạy MinIO local — tránh phụ thuộc Docker hoàn toàn.
- **Lý do:** An toàn/đơn giản nhất trong điều kiện hiện tại — không chặn phần lớn M5 chỉ vì thiếu Docker, và
  không viết integration test "biết trước sẽ đỏ" (phá kỷ luật pipeline luôn xanh đã giữ từ đầu dự án). Toàn
  bộ phần đã làm không cần sửa lại khi module upload được nối tiếp sau này.

## ADR-015 — `Product.downloadLimit = 0` nghĩa là không giới hạn

- **Bối cảnh:** Đặc tả M5 liệt kê `downloadLimit` (mặc định 5) và gợi ý "`0` = không giới hạn — ghi ADR" mà
  không nói rõ cơ chế thực thi (M9 sẽ đọc giá trị này khi đếm lượt tải).
  `DEFAULT_DOWNLOAD_LIMIT=5` đã có sẵn trong env từ M0 khớp đúng mặc định này.
- **Quyết định:** `downloadLimit` là số nguyên không âm; giá trị `0` được diễn giải là **không giới hạn số
  lượt tải** (không phải "cấm tải") khi M9 xây cơ chế đếm lượt tải thật.
- **Lý do:** Cách diễn giải phổ biến nhất cho trường "giới hạn = 0" trong các hệ thống tương tự (giống
  `usageLimit`/`maxDiscountVnd` kiểu "0 hoặc null = không giới hạn" ở M6); đơn giản, không cần thêm cột
  boolean `unlimited` riêng.

## ADR-016 — Chuyển sinh CSP sang `proxy.ts` với nonce theo từng request, thay vì header tĩnh trong `next.config.ts`

- **Bối cảnh:** Người dùng test đăng nhập qua trình duyệt thật (lần đầu trong dự án — mọi smoke-test trước
  giờ chỉ qua `curl`) và phát hiện form đăng nhập lộ mật khẩu lên URL. Nguyên nhân: `next.config.ts` đặt CSP
  tĩnh `script-src 'self'` (không `unsafe-inline`, không nonce) — chặn đứng inline `<script>` mà Next.js App
  Router tự chèn mỗi request để hydrate dữ liệu RSC. Không có nonce, React không hydrate được ở **bất kỳ
  trang nào có tương tác** (form, `useActionState`, client component), cả dev lẫn production — không phải
  lỗi riêng dev/hot-reload như suy đoán ban đầu (console log xác nhận thông báo CSP là "inline script", không
  phải "eval").
- **Quyết định:** Sinh CSP động trong `proxy.ts` — nơi duy nhất chạy được mỗi request để tạo nonce ngẫu
  nhiên — dùng `script-src 'self' 'nonce-<random>' 'strict-dynamic'` (+ `unsafe-eval` chỉ khi
  `NODE_ENV !== "production"`, vì Turbopack/webpack dev HMR cần `eval()`, một vấn đề khác không liên quan tới
  lỗi hydrate). Theo đúng pattern nonce chính thức của Next.js
  (`https://nextjs.org/docs/app/guides/content-security-policy`). `next.config.ts` chỉ còn giữ 2 header
  không đổi theo request (`X-Content-Type-Options`, `Referrer-Policy`).
- **Lý do:** Đây là cách duy nhất vừa giữ CSP chặt (không `unsafe-inline` vĩnh viễn cho script) vừa cho phép
  cơ chế hydrate nội bộ của Next.js hoạt động — không phải lựa chọn giữa nhiều phương án, mà là sửa đúng theo
  khuyến nghị chính thức của framework. Ghi ADR vì đổi vị trí cấu hình bảo mật (CSP) khỏi nơi đặc tả gốc nhắc
  tới (`next.config.ts`, mục 7.8) sang `proxy.ts`.

## ADR-017 — Cấu hình storage (endpoint/bucket/access key R2) quản lý qua System Admin + DB mã hoá, không phải biến môi trường

- **Bối cảnh:** Người dùng yêu cầu tường minh "phát triển hạ tầng cấu hình upload ở Module system" thay vì
  đặt cứng qua `.env` như kế hoạch M5 gốc. Đã trình bày đánh đổi trước khi làm (mục 0.6 — ảnh hưởng bảo mật):
  access key/secret của storage có quyền đọc/ghi/xoá **toàn bộ file của mọi tenant** — nhạy cảm hơn secret
  thanh toán từng tenant (chỉ ảnh hưởng 1 tenant/1 phương thức). Đưa vào DB (dù mã hoá) mở rộng bề mặt tấn
  công so với chỉ để trong biến môi trường.
- **Quyết định:** Người dùng chọn quản lý qua System Admin (`/admin/settings/storage`), giống hệt pattern
  `PlatformPaymentConfig` (M3/M7): bảng `SystemStorageConfig` (1 dòng, `publicConfig` + `encryptedSecrets`),
  form nhập, nút "Kiểm tra kết nối" (gọi `HeadBucketCommand` thật lên cả 2 bucket), cơ chế tự tắt khi đổi
  endpoint/bucket/access key (giống ADR-013). **Mã hoá bằng key riêng `STORAGE_ENCRYPTION_KEY`, không dùng
  chung `PAYMENT_ENCRYPTION_KEY`** — lộ 1 key chỉ lộ đúng 1 miền secret, không lộ cả hai. 7 biến `S3_*` cũ
  (endpoint/region/access key/secret/2 bucket/public base URL) xoá khỏi `env.ts` — không còn ai đọc trực
  tiếp; `PRESIGN_*_TTL_SECONDS`/`CLAMAV_HOST`/`DEFAULT_DOWNLOAD_LIMIT` (tham số vận hành, không phải bí mật
  hạ tầng) vẫn giữ trong env.
- **Tác dụng phụ tích cực đã tận dụng:** hàm mã hoá AES-256-GCM generic (`encryptSecret`/`decryptSecret`/
  `maskSecret`) trước đây nằm trong `packages/payments` (chỉ vì đó là nơi dùng đầu tiên ở M7) được chuyển
  sang `packages/core/src/crypto/` — nơi trung lập, dùng chung được cho cả payments lẫn storage — thay vì
  storage phải phụ thuộc ngược vào package payments để lấy hàm mã hoá không liên quan gì tới thanh toán.
- **Lý do:** Người dùng đã cân nhắc đánh đổi bảo mật và chọn linh hoạt vận hành (đổi credential không cần
  redeploy, tự phục vụ qua UI, không phải gửi secret qua tay tôi để sửa `.env`) — đồng thời có sẵn cơ chế
  giảm rủi ro tương đương phần thanh toán (mã hoá + tự tắt khi thay đổi) nên chấp nhận được.

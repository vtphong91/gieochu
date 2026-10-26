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

> **Đã thay một phần (2026-10-17):** yêu cầu "hồ sơ bắt buộc đủ 4 trường" được thay bởi **ADR-041 C.1** — SĐT và
> Tỉnh/Thành là tuỳ chọn, chỉ chủ tài khoản + admin thấy.

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

## ADR-018 — `file.scan` không có ClamAV thật, mọi file qua được kiểm tra định dạng đều đánh dấu CLEAN

- **Bối cảnh:** Đặc tả M5 nói "nếu có cấu hình `CLAMAV_HOST` thì quét virus (nếu không có thì đánh dấu CLEAN
  và ghi cảnh báo trong log — ghi ADR)". Không có thư viện client ClamAV nào (`clamscan`, `clamdjs`...) trong
  dependencies của dự án, và việc tích hợp quét virus thật (cần chạy daemon `clamd` riêng, ngoài phạm vi
  "không cần Docker" đã chọn ở ADR-014/017) không nằm trong 6 unit/4 integration test đã định của M5.
- **Quyết định:** `apps/web/lib/file-scan.ts` **luôn** đánh dấu `CLEAN` cho file đã qua được kiểm tra
  magic-bytes-khớp-đuôi (`matchesDeclaredExtension`), bất kể `CLAMAV_HOST` có được set hay không — nếu có set,
  ghi thêm log cảnh báo "đã cấu hình CLAMAV_HOST nhưng chưa có client thật". Không chặn luồng, không làm sai
  lệch hành vi so với việc không set biến này.
- **Lý do:** Đúng theo gợi ý dự phòng trong đặc tả khi thiếu hạ tầng — kiểm tra định dạng/magic-bytes (đã có,
  chặn được phần lớn file giả mạo đuôi) vẫn chạy đầy đủ; quét virus thật là lớp phòng thủ bổ sung, để dành khi
  vận hành thật cần (ghi `docs/BACKLOG.md`), không chặn phần còn lại của luồng upload.

## ADR-019 — Webhook tenant xử lý qua job `payment.process` (đúng §7 mục 4); job `order.sweep` chạy mỗi 5 phút

- **Bối cảnh:** §7 mục 4 của đặc tả yêu cầu tường minh: "Webhook: ... idempotent qua `webhook_events`; trả
  2xx nhanh, xử lý nặng đẩy sang job." M7 (route `POST /api/webhooks/tenants/[tenantId]/[provider]`) đã cố
  tình dừng lại sau khi ghi `webhook_events` (Order chưa tồn tại lúc đó), đúng comment "order matching lands
  in M8". Tới M8, có 2 lựa chọn: xử lý luôn trong route (giống M3's `POST
  /api/webhooks/platform/[provider]`, gọi `markInvoicePaid()` trực tiếp trong request) hoặc tách qua job thật
  như §7 mục 4 yêu cầu.
- **Quyết định:** M8 làm **đúng theo đặc tả** — route chỉ xác thực chữ ký + ghi `webhook_events` idempotent +
  `enqueuePaymentProcess(...)` rồi trả 200 ngay; toàn bộ việc so khớp đơn + gọi `markOrderPaid()` chuyển sang
  job `payment.process` (`apps/web/lib/payment-process.ts`, đăng ký trong `worker.ts`). **Không sửa lại M3's
  platform webhook route** (vẫn xử lý đồng bộ trong request) — đây là một khoảng lệch đã biết giữa 2 module,
  ghi vào `docs/BACKLOG.md` thay vì refactor một module đã xong/đã có test xanh ngoài phạm vi M8.
- Cùng lúc, `order.sweep` (tương đương `subscription.sweep` của M3) đặt lịch **mỗi 5 phút** thay vì mỗi giờ —
  TTL đơn PENDING mặc định (`ORDER_PENDING_TTL_MINUTES`) chỉ 60 phút, lịch mỗi giờ có thể để một đơn đã hết
  hạn thật hiển thị PENDING sai lệch tới gần 1 giờ, đủ để gây nhầm lẫn cho khách hàng đang xem trang checkout.
- **Lý do:** Ưu tiên đúng đặc tả cho module mới (M8) thay vì lặp lại một quyết định đã lệch chuẩn từ trước;
  sửa M3 ngoài phạm vi công việc đang làm là rủi ro không cần thiết cho một module đã ổn định — nếu cần đồng
  bộ hoá cả hai, làm như một thay đổi riêng, có xin ý kiến người dùng trước (ảnh hưởng luồng thanh toán đã
  chạy thật).

## ADR-020 — M9: `DownloadToken` L1 (không RLS), 3 policy RLS có sẵn (`products`/`product_files`) thêm nhánh "customer", mật khẩu share link dùng argon2 riêng trong `core`

- **Bối cảnh 1 (DownloadToken):** §"M9" cần một token dùng-một-lần bắc cầu giữa `POST /api/downloads` và
  `GET /api/downloads/{token}` — không có trong ERD gốc (chỉ `download_tokens`/`download_events` được nhắc
  ở sơ đồ kiến trúc, không có cột chi tiết). Thiết kế theo đúng mẫu `RefreshToken`/`VerificationToken` (M1):
  chỉ lưu hash, có `expiresAt`/`usedAt`.
- **Quyết định 1:** `DownloadToken` là bảng **L1, không RLS** — ranh giới bảo mật ở đây là "chỉ người vừa
  yêu cầu tải giữ token thô" (như email-verify/reset-password link), không phải lọc theo `tenantId`/`userId`
  ở tầng DB. Thêm cột `tenantId` denormalize từ `entitlement.tenantId` lúc tạo, để `consumeDownloadToken()`
  mở đúng một `withTenant()` ngay từ đầu mà không cần một lượt đọc RLS-scoped riêng chỉ để biết tenant nào.
- **Bối cảnh 2 (RLS thiếu nhánh customer):** Khi viết `requestDownload()`/`listLibraryEntitlements()`, phát
  hiện `product_files` (RLS từ M5) và `products` (RLS từ M4) chỉ có nhánh tenant/public(PUBLISHED)/system_job
  — không có cách nào cho một **khách hàng đã mua** đọc file/sản phẩm của chính họ một khi sản phẩm không
  còn `PUBLISHED` (gỡ xuống/lưu trữ sau khi bán). Test tích hợp đầu tiên chạy thật bắt đúng lỗi này (đọc trả
  về `null`/entitlement rỗng), không phải phát hiện qua review code.
- **Quyết định 2:** Thêm nhánh thứ 4 vào cả hai policy: `app.scope='customer' AND EXISTS (... entitlements
  WHERE productId = ... AND userId = current_setting('app.user_id'))` — 2 migration RLS riêng
  (`rls_m9_product_files_customer`, `rls_m9_products_customer`), không sửa lại policy gốc trong migration cũ
  (giữ lịch sử migration bất biến, đúng nguyên tắc Prisma). Cùng lúc phát hiện `consumeShareLinkDownload()`
  đọc `share_links` qua `getPrismaClient()` trần thay vì `withPublic()` — RLS chặn hẳn (không silent-filter
  vì đây là bảng có FORCE ROW LEVEL SECURITY), sửa bằng cách bọc lại qua `withPublic()`. Cả 3 lỗ hổng cùng
  một lớp lỗi đã gặp ở M8's `payment-process.ts` — bằng chứng thêm rằng đây là loại lỗi cần cảnh giác thường
  trực, không phải sự cố riêng lẻ.
- **Bối cảnh 3 (mật khẩu share link):** §"M9" cần hash/verify mật khẩu tuỳ chọn cho share link — cùng thuật
  toán argon2id đã dùng cho mật khẩu tài khoản (`packages/auth`), nhưng `packages/core` không được phép phụ
  thuộc `packages/auth` (chiều phụ thuộc ngược — mọi package khác *phụ thuộc vào* `core`, không phải ngược
  lại).
- **Quyết định 3:** Thêm `argon2` làm dependency riêng của `packages/core`, viết `hashSharePassword`/
  `verifySharePassword` độc lập trong `packages/core/src/download/share-link-password.ts` — trùng thuật toán
  với `packages/auth/src/password.ts` nhưng không dùng chung code, giữ đúng chiều phụ thuộc package.
- **Lý do chung:** Cả 3 quyết định đều ưu tiên giữ đúng ranh giới layer đã thiết lập từ đầu dự án (L1 vs L2
  RLS, chiều phụ thuộc package) hơn là tiện lợi ngắn hạn — và quan trọng hơn, 2 lỗ hổng RLS + 1 lỗi bỏ sót
  `withPublic()` đều được **sửa trước khi merge**, phát hiện bằng chính kỷ luật viết integration test chạy
  thật trên Neon (không mock DB) đã áp dụng xuyên suốt dự án.

## ADR-021 — Hybrid Monetization: Free Forever thay cho Subscription-first; thu gọn kiến trúc so với đề xuất gốc

- **Bối cảnh:** Người dùng cung cấp `docs/GIEOCHU_HYBRID_MONETIZATION_BILLING_PROPOSAL_V2.md` — báo cáo đề
  xuất đổi mô hình billing từ "mọi tenant mới vào `TRIALING`, hết trial không trả tiền thì `READ_ONLY`" sang
  "FREE là plan thật, bán được, không hết hạn; trả phí chỉ để mở rộng capacity/tính năng". Đã đọc báo cáo,
  nêu 2 nhóm ý kiến trước khi làm: (1) đồng ý triết lý cốt lõi (Free Forever giảm friction, đúng khi tiền
  chưa thu được ngay từ ngày đầu — mô hình phổ biến ở Gumroad/Payhip/Podia); (2) không đồng ý *kiến trúc*
  báo cáo đề xuất (4 bảng mới `billing_accounts`/`usage_meters`/`billing_events` cộng entitlement như bảng
  riêng) — cho rằng đây là đoán trước nhu cầu tương lai (add-on/usage-billing) chưa xảy ra, trong khi mục
  tiêu thực sự chỉ cần mở rộng `Plan`/`Subscription` đã có.
- **Quyết định:** Người dùng xác nhận đồng ý mô hình mới và 3 điểm cụ thể trước khi code (không phải quyết
  định tự ý — ảnh hưởng tiền, đã dừng lại hỏi đúng mục 0.6):
  1. Paid hết hạn (qua GRACE) → **downgrade thẳng về FREE** (vẫn bán được, giới hạn thấp lại), không còn
     `READ_ONLY` vì lý do subscription — `READ_ONLY` chỉ còn dùng cho moderation/khoá thủ công.
  2. Triển khai đủ **4 gói ngay**: FREE/CREATOR/PRO/BUSINESS (không làm tối giản 2-gói-rồi-mở-rộng-sau).
  3. Toàn bộ số liệu/tính năng từng gói phải **customize được qua `/admin/plans`** — số trong báo cáo chỉ là
     giá trị seed mặc định.
- **Thu gọn kiến trúc so với đề xuất gốc** (đã trình bày, người dùng không phản đối):
  - Không có `billing_accounts` — `Tenant` đã 1-1 `Subscription`, không cần bảng trung gian.
  - Không có `usage_meters` — sản phẩm/dung lượng là số liệu tức thời (đếm sống + `Tenant.storageUsedBytes`
    atomic từ M5), không phải usage-theo-kỳ cần ledger.
  - Không có `billing_events` — trùng vai trò `audit_logs` (M12, chưa xây); sự kiện quan trọng ghi qua
    `logger.info`/`warn` cho tới khi M12 có audit log thật (cùng mẫu `COUPON_OVERUSED` ở M6).
  - `Plan` chỉ thêm 2 cột (`isFree`, `features Json`), không đổi tên bảng, không tách state machine riêng —
    `transitionSubscriptionStatus()` (M3 v1) giữ nguyên không đổi; hệ quả DB của GRACE/CANCELED kết thúc đổi
    (downgrade thay vì set EXPIRED+READ_ONLY) nhưng FSM thuần không đổi.
  - Feature gate mới (`packages/core/src/billing/feature-gate.ts`, `canUsePlanFeature()`) cố tình **không**
    dùng lại `packages/auth`'s argon2 hay bất kỳ package nào khác ngoài đọc JSON — giữ business logic luôn
    đọc `plan.features`, không bao giờ đọc `plan.code` (đúng nguyên tắc entitlement-vs-plan-name báo cáo nêu).
- **Quy ước kỹ thuật đáng chú ý:** Free's `Subscription` có `currentPeriodStart = currentPeriodEnd =` thời
  điểm tạo (không nullable hoá cột, không dùng sentinel ngày xa tương lai) — vì luôn ≤ now,
  `computeRenewalPeriod()` (đã có từ M3 v1) tự động tính đúng kỳ mới khi nâng cấp lên Paid mà **không cần
  sửa gì** ở `subscription-billing.ts`; sweep loại Free khỏi mọi truy vấn bằng filter quan hệ
  `plan: { isFree: false }`.
- **Lý do:** Đạt đúng mục tiêu kinh doanh báo cáo đề ra (giảm friction onboarding, subscription là "động cơ
  tăng trưởng" chứ không phải "vé vào cửa") với diff nhỏ nhất có thể lên schema/code đã build và test — tái
  dùng tối đa hạ tầng M3 v1 đã ổn định thay vì viết lại toàn bộ theo đúng khung 4-bảng của báo cáo gốc.

## ADR-022 — Bảng `Role`/`Permission` (RBAC) là nguồn sự thật cho quyền truy cập module; giữ nguyên `SystemRole`/`TenantMemberRole` làm nhãn định danh

- **Bối cảnh:** Bug báo cáo — đăng nhập bằng tài khoản chủ tenant bị redirect về trang chủ khách hàng thay vì
  `/studio/{slug}`, vì `app/(auth)/login/page.tsx` chỉ rẽ nhánh `role === "SYSTEM_ADMIN" ? "/admin" : "/"`,
  không hề biết user có sở hữu tenant hay không. Người dùng chỉ ra đây là triệu chứng của việc hệ thống thiếu
  một nơi rõ ràng để trả lời "user này được vào module nào", và yêu cầu bổ sung bảng role thật (không phải chỉ
  1 hàm gộp tạm — đã hỏi lại và người dùng chọn rõ hướng RBAC đầy đủ thay vì bản tối giản).
- **Quyết định:** Thêm 3 bảng L1 mới — `Role`, `Permission`, `RolePermission` (`packages/db/prisma/schema.prisma`)
  — dùng chung 1 `RoleScope` (SYSTEM | TENANT), seed sao cho `Role.code` khớp 1-1 với giá trị enum hiện có
  (`SYSTEM_ADMIN`, `TENANT_OWNER`, `TENANT_STAFF`). **Không** đổi `User.systemRole`/`TenantMember.role` (2 enum
  hiện có) thành FK — chúng tiếp tục là nhãn định danh nhẹ trong JWT/DB, còn Role/Permission trở thành nguồn sự
  thật duy nhất cho "tier này được làm gì" (`apps/web/lib/permissions.ts`: `hasSystemPermission`/
  `hasTenantPermission`), thay cho hàm hardcode TypeScript trước đây.
  - Sửa bug cụ thể: `apps/web/lib/landing-path.ts`'s `resolveLandingPath()` — kiểm tra quyền
    `system:view_admin_dashboard` trước, sau đó tra `Tenant.ownerId` để lấy `tenant.slug` (không bao giờ dùng
    `user.id` trong URL), cuối cùng fallback `/`. Login route trả thêm `landingPath` trong response, login page
    dùng trực tiếp thay vì tự suy role.
- **Vì sao không đổi enum thành FK ngay:** `SystemRole` chỉ có 2 giá trị thật (+ `isSuperAdmin` bolt-on ngoài
  enum); chuẩn hoá thành bảng join không mang lại gì mà buộc đổi shape JWT (`AccessTokenClaims.role`), chữ ký
  `requireRole()`, và ~54 call site (`requireRole`/`requireAdminAccess`/`requireTenantMember`/
  `requireTenantMemberPage`) trong 1 lần — đi ngược nguyên tắc không over-engineer. Các guard này **giữ nguyên
  không đổi** trong việc này.
- **Không làm trong đợt này:** migrate 54 call site sang gọi permission-code trực tiếp; UI chỉnh ma trận quyền
  STAFF (`RolePermission` — chỉ seed tập khởi đầu: `tenant:access_studio`/`manage_products`/`manage_orders`);
  luồng mời STAFF/tạo row `TenantMember` role STAFF thật; resolve landing path cho STAFF (chưa có row thật);
  đụng RLS policies hay `withTenant`/`withCustomer`/`withPublic`/`withSystemJob` (RBAC là lớp tách biệt, chạy
  trước/song song RLS, không thay thế nó); xoá `packages/auth/src/rbac.ts`'s `can()`/`SystemAction` cũ (dead
  code vô hại, có unit test riêng — xoá sẽ đổi số test cố định phải hỏi lại người dùng trước).
- **Lý do:** Đáp ứng đúng yêu cầu "bảng role thật, fetch rõ ràng phân quyền, log vào đúng module" với diff nhỏ
  nhất — 3 bảng cộng thêm, không đụng guard/JWT/54 call site hiện có, đồng thời khiến `TENANT_STAFF` không còn
  "chết" về mặt cấu trúc (schema đã chừa sẵn từ M4, xem `docs/BACKLOG.md`) dù luồng mời staff thật vẫn là việc
  sau này.

## ADR-023 — Storefront tenant quản lý bằng section CMS (cùng mô hình CMS trang chủ), form liên hệ lưu hộp thư L2

- **Bối cảnh (2026-09-26):** Chủ dự án yêu cầu storefront `/[tenantSlug]` theo đủ các section của một mẫu
  portfolio (Hero, Dịch vụ, Tài liệu/Recent Work, Đánh giá, Form liên hệ + CTA, Footer) và tenant tự quản lý nội
  dung "theo đúng cách System Admin đang quản lý CMS trang chủ". Chủ dự án đã chốt: form liên hệ **lưu hộp thư +
  email báo**; ảnh upload qua **Cloudinary hệ thống**; section Tài liệu **tự động từ sản phẩm PUBLISHED**; **không
  thêm test case** đợt này — section chưa có dữ liệu dùng nội dung demo, bổ sung test khi chạy test toàn hệ thống.
- **Quyết định:**
  1. **Schema section:** `storefrontSectionsSchema` trong `packages/core` — mảng có thứ tự
     `{ id, type, visible, data }`, discriminated union theo `type`: `hero`, `services`, `products`,
     `testimonials`, `contact`. Chỉ nội dung (text/ảnh/link) sửa được; bố cục, màu (theo `Tenant.branding`),
     icon trang trí do code quyết định — giống `homeSectionsSchema` (CMS trang chủ).
  2. **Lưu trữ:** 2 cột Json trên `tenants`: `storefrontSections` (bản live) và `storefrontSectionsDraft` (nháp),
     cùng quy trình Lưu nháp / Xuất bản / Khôi phục bản live như `CmsPage.blocks/blocksDraft`. Không tạo bảng
     riêng vì 1 tenant = 1 storefront và `tenants` không có RLS (cùng cách lưu `branding`). Cột null → dùng
     `defaultStorefrontSections(tenant)` sinh trong code (nội dung demo).
  3. **Nội dung demo:** khi tenant chưa từng xuất bản, khách xem thấy các section demo **trừ `testimonials`**
     (đánh giá mẫu hiển thị công khai là thông tin sai lệch với người mua); chủ tenant xem trang của mình thấy đủ
     kèm nhãn "Nội dung mẫu". Tenant xuất bản bản của mình → hiển thị đúng những gì đã bật.
  4. **Quyền sửa:** Server Actions trong `/studio/[tenantSlug]/storefront`, guard `requireTenantMember` (giống
     `updateBrandingAction`), validate lại bằng zod ở server; `revalidatePath` trang public khi xuất bản.
  5. **Form liên hệ — bảng L2 mới `storefront_messages`** (`tenantId`, name, email, message, status
     NEW/READ/ARCHIVED, `ipHash`, createdAt) **có RLS**: scope public chỉ INSERT; scope tenant SELECT/UPDATE/DELETE
     của đúng tenant. Không lưu IP thô — chỉ `ipHash` = HMAC-SHA256(ip) với khoá `JWT_ACCESS_SECRET` và nhãn tách
     miền `storefront-ip:` (không thêm biến env mới). Chấp nhận dùng chung khoá: `ipHash` chỉ phục vụ chống spam,
     không dùng để định danh lâu dài; xoay khoá JWT chỉ làm hash cũ mất liên kết — vô hại. Nếu sau này `ipHash`
     được dùng cho mục đích khác (thống kê, chặn vĩnh viễn) thì phải tách secret riêng. Chống spam: honeypot + rate
     limit in-memory (`lib/rate-limit.ts`) 3 tin/10 phút theo `ipHash`, 50 tin/giờ theo tenant (public không có
     quyền SELECT nên không đếm bằng DB được). Ghi bằng Server Action `submitStorefrontContactAction` (CSRF sẵn có
     của Next, §7.7), INSERT không RETURNING (`createMany`) vì public không có policy SELECT. Email báo chủ tenant
     qua SMTP hệ thống trong `after()`; gửi lỗi không làm mất tin (tin đã lưu trước). Tenant xem/đánh dấu/xoá tin
     ở Studio. System admin **không** có route đọc tin này (§7.9).
  6. **Upload ảnh:** tái dùng `ImageUploadField` + Cloudinary hệ thống, chữ ký cho tenant sinh bởi Server Action
     `getTenantCloudinaryUploadSignatureAction` (guard `requireTenantMember`), folder
     `<uploadFolder>/tenants/<tenantId>/storefront`, `allowed_formats` png/jpeg/webp nằm trong chữ ký. Giới hạn
     2MB **chỉ kiểm phía trình duyệt** — signed upload không có tham số dung lượng; chặn cứng cần upload preset
     (BACKLOG). CSP `img-src` đã cho phép `res.cloudinary.com`.
- **Hệ quả / nợ:** Chưa có test cho schema section, quyền sửa và RLS `storefront_messages` — phải bổ sung khi
  chạy test toàn hệ thống (ngân sách `test:count` cần chủ dự án duyệt lại). Chi phí/quota Cloudinary dùng chung
  toàn nền tảng. Thời hạn lưu tin nhắn (dữ liệu cá nhân): chủ dự án chốt 2026-09-26 **không tự xoá** — tin tồn tại
  tới khi tenant xoá thủ công ở Studio hoặc tenant bị xoá (FK cascade); xem lại khi có yêu cầu pháp lý/chính sách
  quyền riêng tư.
  Đánh giá thật sẽ đến từ M10 — khi đó section `testimonials` có thể chuyển sang lấy review thật.

## ADR-024 — Chuẩn độ rộng layout: nội dung trang public tối đa 1280px, căn giữa, dùng utility chung

- **Bối cảnh (2026-09-26):** Trang chủ hệ thống dàn full-width (chỉ lề `lg:px-24` → ~1728px nội dung ở màn
  1920px), storefront tenant dùng container riêng (1280px), `/pricing` và `/p/[slug]` mỗi trang một `max-w-*`
  khác nhau. Sau khi thử 960 / 1140 / 1200 / 1280px trên storefront, chủ dự án chốt **1280px nội dung, căn giữa**
  và yêu cầu mọi layout phát triển sau theo cùng một template kích thước.
- **Quyết định:** 3 cấp độ rộng, khai báo **một lần** bằng `@utility` trong `apps/web/app/globals.css` (không rải
  `max-w-[...]` tuỳ ý trong từng trang):
  | Utility | Nội dung tối đa | Lề ngang (mobile / sm / lg) | Dùng cho |
  |---|---|---|---|
  | `container-page` | **1280px** | 16 / 24 / 32px | Khung chung mọi trang public: header, footer, section trang chủ, storefront tenant, trang danh sách/sản phẩm, pricing |
  | `container-prose` | 768px | 16 / 24 / 32px | Trang đọc dài: CMS `/p/[slug]`, chính sách, bài viết |
  | `container-narrow` | 448px | 16 / 24px | Form đơn lẻ: checkout, auth card, xác nhận |
  - Nền màu/ảnh của section vẫn tràn toàn chiều ngang (full-bleed); chỉ khối nội dung bên trong bọc container.
  - Khối con (mô tả hero, ảnh, thẻ) được tự giới hạn nhỏ hơn bên trong container; không khối nào vượt container.
  - Khu vực app shell có sidebar (`/admin/*`, `/studio/*`, `/account/*`) **không** áp container-page ở mức trang
    (vùng làm việc fluid theo sidebar); nội dung dạng đọc/form bên trong vẫn dùng `container-prose`/`container-narrow`
    hoặc `max-w-*` của kit admin.
- **Lý do:** 1280px là độ rộng thông dụng cho trang thương mại, đủ cho lưới 3–4 thẻ, vẫn gọn ở màn 1920px. Khai
  báo bằng `@utility` trong `globals.css` thay vì class arbitrary vì (1) một nguồn duy nhất, đổi 1 chỗ áp mọi trang;
  (2) dev server Turbopack từng không sinh lại class arbitrary mới trong thư mục `[tenantSlug]` cho tới khi khởi
  động lại — utility trong CSS gốc không phụ thuộc việc quét nguồn.
- **Hệ quả:** Trang chủ hệ thống, storefront tenant chuyển sang `container-page`; `/pricing`, `/p/[slug]`,
  checkout chuyển dần sang utility tương ứng khi có task chạm tới. Quy tắc chi tiết cho người làm UI ghi ở
  `obsidian-knowledge-base/04-Operations-Runbooks/UI-Design-System.md`.

## ADR-025 — Tenant chỉ sở hữu nội dung storefront; header/footer và các trang con là của hệ thống

- **Bối cảnh (2026-09-26):** Bản storefront đầu tiên (ADR-023) dựng header/footer riêng cho tenant (logo tenant,
  menu anchor, nút Liên hệ, footer có mạng xã hội) và trang chi tiết sản phẩm cũng mang header/footer + theme
  tenant. Chủ dự án làm rõ: header/footer trên mọi trang public là **của hệ thống Gieo Chữ**; tenant **chỉ có 1 trang
  public duy nhất là storefront**.
- **Quyết định:**
  1. Header/footer hệ thống được tách thành component dùng chung (`apps/web/app/_ui/site-header.tsx`,
     `site-footer.tsx`), dùng cho trang chủ, storefront `/[tenantSlug]`, trang chi tiết sản phẩm, checkout (và các
     trang public hệ thống khác khi có task chạm tới).
  2. Storefront `/[tenantSlug]`: giữa header/footer hệ thống là các section CMS của tenant (ADR-023) với màu tenant
     (`--sf-*`). **Không có** header/footer/menu anchor riêng của tenant. Banner "Nội dung mẫu" (chỉ chủ trang) và
     banner READ_ONLY/LOCKED vẫn giữ, đặt ngay dưới header hệ thống.
  3. Link mạng xã hội của tenant hiển thị trong khối CTA của section Liên hệ (không còn footer tenant).
  4. Trang chi tiết sản phẩm và checkout là **trang hệ thống**: header/footer + màu/font hệ thống, bố cục
     `container-page` 2 cột (sản phẩm) / `container-narrow` (checkout) theo ADR-024; chỉ nêu tên tenant (breadcrumb
     về storefront) chứ không mang giao diện tenant. Logic mua hàng M8 không đổi.
- **Lý do:** Nền tảng giữ nhận diện và điều hướng thống nhất (khách luôn biết mình đang ở Gieo Chữ, đăng nhập/tài
  khoản ở cùng một chỗ); tenant tuỳ biến trong phạm vi nội dung storefront, tránh mỗi tenant một "website" riêng.
- **Thay thế:** các phần header/footer/menu tenant trong ADR-023 và phần "dùng chung khung storefront" của trang
  sản phẩm (task ADR-024).

## ADR-026 — Trang Tạo/Sửa sản phẩm giai đoạn 1: danh mục bắt buộc khi xuất bản, giao tài liệu bằng file hoặc link, nâng mốc test

- **Bối cảnh (2026-09-26):** Trang Studio "Tạo sản phẩm" chỉ có tiêu đề/đường dẫn/loại/mô tả; upload, giá, ảnh
  bìa nằm ở trang Sửa, danh mục tài liệu (`DocumentCategory`, L1 do System Admin quản lý) chưa gắn với `Product`.
  Rà soát: `docs/bao-cao-xu-ly-tai-lieu-san-pham-2026-09-26.md` (Long) + đề xuất bố cục của Phong. Chủ dự án chốt:
  sửa ngay 2 lỗi bảo mật upload; 1 danh mục/sản phẩm, bắt buộc khi xuất bản; cho phép tenant giao tài liệu bằng
  **link ngoài** ngay GĐ1, sản phẩm **chỉ có link** vẫn được xuất bản; nâng mốc test.
- **Quyết định:**
  1. **Bảo mật upload (làm trước):** bước `complete`/`cover-complete` kiểm `objectKey` đúng tiền tố
     `buildProductFileKey(tenantId, productId, …)` trước mọi lời gọi storage; kiểm lại giới hạn gói bằng dung lượng
     thật từ HeadObject, vượt thì xoá object và từ chối; `storageUsedBytes` cộng theo dung lượng thật.
  2. **Danh mục:** cột `Product.categoryId String?` FK → `DocumentCategory` (L1, không RLS; `products` vẫn RLS như
     cũ). Nháp được để trống; **xuất bản bắt buộc** có danh mục đang `isActive`. Studio chỉ liệt kê danh mục
     `isActive`. Danh mục bị tắt sau đó: sản phẩm đã xuất bản giữ nguyên, lần xuất bản/sửa tiếp theo phải chọn lại.
  3. **Link tài liệu ngoài:** lưu cùng bảng `product_files` (đã có RLS L2) với `sourceKind FILE | EXTERNAL_URL` và
     `externalUrl`; bản ghi link không có object key, không quét, không tính dung lượng, `scanStatus` coi như không
     áp dụng. Chỉ chấp nhận `https:` và host trong allowlist khởi đầu: `drive.google.com`, `docs.google.com`,
     `onedrive.live.com`, `1drv.ms`, `*.sharepoint.com`, `dropbox.com`, `www.dropbox.com` (mở rộng sau qua ADR).
     Link **chỉ trả cho khách đã có entitlement** (Thư viện / trang tải), không bao giờ hiện ở trang public; mỗi lần
     khách mở link vẫn ghi `DownloadEvent` và tôn trọng `downloadLimit` như file. UI Studio cảnh báo tenant: link
     ngoài không được quét, không chống chia sẻ lại, tenant tự chịu trách nhiệm quyền truy cập của link.
  4. **Điều kiện xuất bản** (`canPublishProduct`): có danh mục đang hoạt động, có ảnh bìa (như hiện tại nếu đang
     bắt buộc), và có **≥1 nguồn giao hàng hợp lệ**: file bán `CLEAN` **hoặc** link ngoài hợp lệ. Trả
     `{ allowed, reasons[] }` để UI hiện checklist.
  5. **Luồng tạo:** trang Tạo và Sửa dùng chung một editor 2 cột (`MainAsideGrid`); lần lưu đầu tạo bản nháp rồi ở
     lại cùng giao diện (chuyển sang URL sửa), từ đó upload file/nhập link được ngay.
  6. **Test:** mốc `test:count` nâng thêm tối đa **+3 unit / +3 integration** cho đợt này (gồm test cho 2 lỗi bảo
     mật, kiểm tiền tố key, allowlist link, điều kiện xuất bản, gắn danh mục). `scripts/count-tests.mjs` cập nhật
     theo số thật khi từng phần xong.
- **Không làm ở GĐ1:** gallery nhiều ảnh, SEO riêng cho sản phẩm, preview/watermark, ClamAV, trang khám phá xuyên
  tenant theo danh mục.
- **Lý do:** Link ngoài đáp ứng nhu cầu thực tế của giáo viên (tài liệu đã nằm sẵn trên Drive) mà vẫn giữ giao
  hàng sau thanh toán qua entitlement; allowlist + https giảm rủi ro phát tán link độc hại. Lưu chung
  `product_files` tái dùng RLS và luồng thư viện/tải xuống sẵn có thay vì thêm bảng L2 mới.

## ADR-027 — Bổ sung trang Tạo sản phẩm: mô tả ngắn, ảnh bìa qua Cloudinary, Xem trước, chế độ hiển thị = trạng thái

- **Bối cảnh (2026-09-27):** Chủ dự án duyệt editor GĐ1 (ADR-026) và yêu cầu trang **Tạo** có đủ: giá gốc + giá
  khuyến mãi, mô tả ngắn, ảnh đại diện, Lưu nháp, Xem trước, chế độ hiển thị Công khai/Riêng tư. Ảnh bìa hiện lưu
  R2 public (`coverImageKey`) nên (1) không upload được trước khi có `productId`, (2) bị CSP `img-src` chặn hiển thị.
- **Quyết định:**
  1. **Chế độ hiển thị không phải khái niệm mới:** "Công khai" = `PUBLISHED`, "Riêng tư" = `DRAFT`. UI hiển thị
     nhóm radio Công khai/Riêng tư; chọn Công khai khi lưu = lưu rồi xuất bản (vẫn qua `canPublishProduct`), chọn
     Riêng tư = lưu nháp / gỡ xuất bản. Không thêm cột, không đổi RLS.
  2. **Mô tả ngắn:** cột `Product.summary String?` — văn bản thuần, tối đa 300 ký tự, hiển thị trên thẻ tài liệu
     ở storefront và đầu trang chi tiết. Không bắt buộc khi xuất bản.
  3. **Ảnh bìa chuyển sang Cloudinary:** cột mới `Product.coverImageUrl String?` (chỉ nhận
     `https://res.cloudinary.com/...`, cùng luật ADR-023), upload bằng chữ ký Cloudinary của tenant đã có
     (folder `<uploadFolder>/tenants/<id>/products`), dùng được ngay trên trang Tạo. Hiển thị ưu tiên
     `coverImageUrl`, fallback `coverImageKey` (R2) cho dữ liệu cũ. Điều kiện xuất bản "có ảnh bìa" chấp nhận một
     trong hai. Luồng R2 `cover-presign/cover-complete` giữ nguyên cho tới khi dọn (BACKLOG).
  4. **Trang Tạo** nhận đủ: tiêu đề, đường dẫn, mô tả ngắn, mô tả, danh mục, loại, giá gốc, giá khuyến mãi + thời
     gian, thẻ, ảnh bìa, chế độ hiển thị. Tệp tài liệu/link vẫn cần `productId` → sau khi lưu lần đầu chuyển sang
     trang Sửa. Chọn Công khai ở trang Tạo mà chưa đủ điều kiện (thường thiếu nguồn giao hàng) → vẫn lưu nháp và
     hiển thị checklist còn thiếu.
  5. **Xem trước:** route chỉ chủ tenant/staff `/studio/[tenantSlug]/products/[productId]/preview` (guard
     `requireTenantMemberPage`, đọc qua `withTenant` nên xem được bản nháp), render giống trang chi tiết công khai
     kèm dải "Bản xem trước — khách chưa thấy trang này" và nút Mua bị vô hiệu; `noindex`. Nút "Xem trước" ở thanh
     hành động (trang Tạo: lưu nháp trước rồi mở).
- **Test:** không nâng trần (94/53); dùng phần còn trống trong trần nếu cần, báo số thật.
- **Đính chính ADR-026/027 theo code (2026-09-27):** (a) Editor sản phẩm chép lại lưới của `MainAsideGrid`
  ngay trong `<form>` (grid + thanh hành động phải cùng một form) — chấp nhận, không bắt buộc gọi component.
  (b) Trang Xem trước và editor dùng guard mặc định `requireTenantMemberPage` hiện chỉ cho `OWNER`; "staff" trong
  ADR-027 §5 áp dụng khi luồng STAFF thật được làm (ADR-022). (c) `max-w-[1280px]` của editor là giới hạn **nội
  dung trong** app shell Studio (vùng làm việc vẫn fluid theo sidebar) — không trái ADR-024, vốn chỉ cấm tự đặt
  `max-w` cho khung trang public.
- **Sửa đổi ADR-027 §4 (2026-09-27, chủ dự án):** trang Tạo **không khoá** khu Tệp tài liệu. Khi người dùng thêm
  file hoặc link đầu tiên trên trang Tạo, UI tự gọi `createProductAction` (visibility PRIVATE) với dữ liệu form
  hiện có để tạo bản nháp ngầm, rồi tiếp tục upload/thêm link vào bản nháp đó ngay trên cùng giao diện (giữ URL
  `/new`, giữ `draftId` trong state, không remount để không ngắt upload; chỉ chuyển sang URL trang Sửa khi người
  dùng bấm Lưu nháp/Xuất bản và không còn file đang tải — không lách `history` của Next). Tiêu đề là field bắt buộc duy
  nhất để tạo nháp: thiếu thì focus ô Tiêu đề kèm thông báo. Không thêm bảng "staging upload" (tránh object mồ
  côi, job dọn dẹp và nới luật kiểm tiền tố key) — bản nháp bị bỏ dở là dữ liệu hợp lệ, tenant thấy và xoá được.

## ADR-028 — Ảnh nội dung lưu trên Cloudinary hệ thống, có tối ưu tự động và hạn mức theo gói; siết chữ ký upload

- **Bối cảnh (2026-09-27):** Editor Tiptap chỉ chèn ảnh bằng URL. Chủ dự án cân nhắc dùng Cloudinary hệ thống hay
  bắt tenant tự tạo tài khoản (BYO). Báo cáo `docs/bao-cao-luu-tru-anh-cloudinary-2026-09-27.md` (Long, đối chiếu
  code): upload đi thẳng trình duyệt → Cloudinary, ảnh phục vụ từ CDN, nên BYO **không** giảm tải server — chỉ
  chuyển chi phí; chưa có tối ưu ảnh; ảnh không có hạn mức theo gói; chữ ký dùng chung chỉ `requireUser()`.
- **Quyết định (chủ dự án duyệt):**
  1. **GĐ1 dùng Cloudinary hệ thống cho mọi tenant**; BYO để GĐ2, chỉ mở khi số liệu dùng thật vượt ngưỡng.
  2. **Siết chữ ký dùng chung (đã sửa 2026-09-27):** `getCloudinaryUploadSignatureAction` chỉ `SYSTEM_ADMIN`,
     ký `allowed_formats` png/jpg/jpeg/webp/svg. Tenant luôn dùng action ký riêng theo folder `tenants/<id>/...`.
  3. **Upload ảnh trong editor:** bỏ ô "URL ảnh"; nút ảnh trên toolbar mở chọn file → upload qua chữ ký tenant,
     folder `tenants/<id>/content`, định dạng png/jpg/jpeg/webp (GIF không nhận ở GĐ1). Editor dùng ở admin (danh
     mục) ký bằng chữ ký admin.
  4. **Tối ưu ảnh:** mọi ảnh Cloudinary hiển thị qua transformation cố định `f_auto,q_auto,c_limit,w_<N>` (hàm
     dựng URL dùng chung, N theo ngữ cảnh ≤1600); upload có incoming transformation giới hạn cạnh dài ≤2000px.
     Áp cho ảnh mô tả, ảnh bìa sản phẩm và ảnh storefront.
  5. **Sanitizer:** `img src` trong HTML mô tả chỉ nhận `https://res.cloudinary.com/<cloud hệ thống>/...`; ảnh ngoài
     bị loại khi lưu và khi render (khớp CSP `img-src`).
  6. **Hạn mức ảnh theo gói** (cộng chung ảnh mô tả + ảnh bìa + ảnh storefront): FREE 100MB, CREATOR 1GB, PRO 2GB,
     BUSINESS 5GB — cột mới trên `Plan` (chỉnh được ở System Admin). Ghi nhận asset ở bảng L2 có RLS (tenantId,
     publicId, bytes, nơi dùng); dung lượng lấy từ phía server (không tin số client gửi). Vượt hạn mức → từ chối
     cấp chữ ký kèm thông báo nâng gói.
- **Test:** dùng phần còn trống trong trần hiện tại (94/53), không nâng trần.
- **Nợ:** job dọn asset mồ côi; quy trình gỡ ảnh vi phạm; BYO (GĐ2, secret mã hoá AES-256-GCM với khoá riêng).
- **Bổ sung ADR-028 theo triển khai (2026-09-27, Quốc duyệt):** (a) chữ ký tenant ký **`public_id` đầy đủ** do
  server sinh (`<root>/tenants/<id>/<content|products|storefront>/<24 hex>`) thay vì `folder` — một chữ ký chỉ tạo/ghi
  đè đúng 1 asset, không dùng lại để upload vô hạn trong 1 giờ; (b) **giữ chỗ hạn mức ngay khi cấp chữ ký**: tạo dòng
  `tenant_media_assets` tạm tính 5MB, `verifiedAt = null`; `registerTenantImageAction` đọc Cloudinary Admin API ghi
  bytes thật; mỗi lần xin chữ ký đối soát lười tối đa 3 dòng giữ chỗ quá 1 giờ (không tồn tại → xoá, có → ghi số
  thật); (c) Admin API lỗi khi register → vẫn trả URL dựng từ `public_id` với `verified:false`, giữ mức tạm 5MB;
  404 → xoá giữ chỗ, trả `IMAGE_NOT_FOUND`.
- **Cập nhật đính chính ADR-026/027 (a)/(c) (2026-09-27):** bố cục editor hiện tại là khung `mx-auto max-w-[1440px]`
  (giới hạn nội dung trong app shell Studio, không trái ADR-024), lưới `minmax(0,1fr) 360px` dựng trong `<form>`;
  **không còn** thanh hành động dính đáy — nút Xuất bản/Xem trước/Lưu nháp nằm trong card xuất bản dính ở đầu
  sidebar (≥xl), dưới xl có thanh lưu nhanh `.studio-save-bar`. Thay thế mô tả "(a) thanh hành động" và
  "(c) `max-w-[1280px]`" ở trên.

## ADR-029 — M10 giai đoạn 1: Đánh giá (M10a) + Bài viết tối giản (M10b); siết RLS `products`/`product_files`

- **Bối cảnh (2026-09-27):** Kế hoạch `docs/ke-hoach-M10-social-feed-danh-gia-2026-09-27.md` (Long). Đặc tả M10 gốc
  viết trước ADR-023/025/028. Long phát hiện policy `products` (migration `rls_m9_products_customer`) là `FOR ALL
  USING (...)` không `WITH CHECK` → ở tầng DB, scope `public` UPDATE được sản phẩm PUBLISHED, scope `customer` UPDATE
  được sản phẩm có entitlement (code hiện không làm, nhưng lớp DB hở). Quốc đã đối chiếu migration.
- **Quyết định (chủ dự án chốt 4 điểm; phần còn lại theo khuyến nghị §10 của kế hoạch):**
  0. **Siết RLS trước M10:** tách policy `products` (và `product_files` nếu cùng mẫu): SELECT cho tenant/public/
     customer/system_job như hiện tại; INSERT/UPDATE/DELETE chỉ tenant (đúng `tenantId`) và `system_job`.
  1. **Phạm vi:** M10a Đánh giá → M10b Bài viết tối giản. M10c (bình luận, thả tim, theo dõi) sang BACKLOG. Nút
     "Báo cáo vi phạm" đợi M12. SEO `AggregateRating` để GĐ3.
  2. **Đánh giá:** chỉ khách có đơn đã hoàn tất + entitlement chưa thu hồi; **1 đánh giá/khách/sản phẩm** (unique
     `productId+userId`); sao 1–5, nội dung chữ tuỳ chọn ≤2000 ký tự; đơn 0đ được đánh giá và tính điểm; khách được
     sửa/tự xoá; hoàn tiền/thu hồi entitlement → đánh giá tự ẩn (lý do REFUNDED), không tính điểm. Tên hiển thị dạng
     "Minh A." (khách xem trước). Tự đăng; tenant được trả lời (1 trả lời/đánh giá) và ẩn đánh giá với lý do bắt buộc,
     khôi phục được; người viết thấy nhãn "đã bị ẩn"; không công khai số bị ẩn. Email cho chủ tenant khi có đánh giá
     mới (`after()`), không email cho khách ở GĐ1. System admin không có route đọc đánh giá (§7.9).
  3. **Điểm trung bình:** cột cache số nguyên `products.ratingSum`, `ratingCount` (không dùng float); cập nhật qua
     scope `system_job` sau khi ghi đánh giá (vì customer không còn quyền UPDATE `products` sau mục 0). Thẻ tài liệu
     hiện sao từ 1 đánh giá kèm số lượng.
  4. **Storefront:** thêm section **"Đánh giá"** lấy đánh giá thật (tự động N đánh giá ≥4 sao có nội dung, tenant
     có thể chọn tay), đánh dấu "Đã mua". Section nhập tay cũ đổi tên hiển thị thành **"Cảm nhận"**, không có sao
     (tránh nhầm với đánh giá xác thực); dữ liệu cũ giữ nguyên.
  5. **Bài viết (M10b):** Tiptap + sanitizer (ADR-028), tối đa 6 ảnh Cloudinary tính hạn mức ảnh; tiêu đề tuỳ chọn;
     gắn tối đa 1 sản phẩm; ghim tối đa 1 bài; trạng thái DRAFT/PUBLISHED (tenant tự gỡ về DRAFT), HIDDEN dành cho
     vi phạm; trang hệ thống `/{tenantSlug}/posts` + `/{tenantSlug}/posts/{postId}` (ADR-025) + section "Bài viết"
     trên storefront; không giới hạn số bài theo gói. Feed xuyên tenant ngoài phạm vi.
  6. **Dữ liệu:** bảng L2 `reviews`, `posts` — RLS tách policy theo lệnh (mẫu `storefront_messages`): public SELECT
     bản ghi hiển thị; customer INSERT/UPDATE/DELETE đánh giá của chính mình có điều kiện `EXISTS` đơn + entitlement;
     tenant SELECT/UPDATE (ẩn, trả lời) của tenant mình; không nhánh admin.
- **Test:** chủ dự án chọn **chưa thêm test** — ghi nợ cho RLS `products`, đánh giá, bài viết; verify thủ công trên
  DB dev qua role `gieochu_app`. Bổ sung khi chạy test toàn hệ thống.
- **Bổ sung ADR-029 mục 0 theo triển khai (2026-09-27):** migration `20260927130000_rls_adr029_split_write_policies`
  siết **7 bảng** (không chỉ 2): `products`, `product_files`, `coupons`, `share_links`, `orders`, `order_items`,
  `entitlements`. Mỗi bảng: `select_access` (FOR SELECT, giữ nguyên điều kiện đọc cũ) + `write_insert/update/delete`
  chỉ `tenantId = app.tenant_id` hoặc scope `system_job` (`order_items` đi qua đơn cha). Trước đó scope public
  UPDATE/DELETE được **mọi** share link (bỏ `revokedAt`, đặt lại `usedCount`) và customer tự UPDATE được
  `downloadsUsed/downloadLimit` của entitlement ở tầng DB — code chưa từng ghi dưới hai scope này nên không cần đổi
  nghiệp vụ. **Quy tắc cho bảng L2 mới:** có nhánh public/customer thì phải tách policy theo lệnh, không dùng FOR ALL.
- **Bổ sung ADR-029 M10a theo triển khai (2026-09-27, Quốc chốt):** bảng `reviews` gắn `orderItemId`; chặn đổi cột
  theo scope bằng trigger `reviews_guard_columns` (customer chỉ rating/body/displayName/orderItemId; tenant chỉ
  status/hidden*/reply*; không dùng được column GRANT vì chung role `gieochu_app`); điểm TB tính lại toàn phần dưới
  `system_job` có advisory lock. Quyết định chi tiết: (a) khách **mua lại sau hoàn tiền** và sửa đánh giá → tự khôi
  phục VISIBLE (có log); (b) **không** giới hạn thời hạn sửa; (c) tenant READ_ONLY vẫn nhận/kiểm duyệt đánh giá
  của khách đã mua (storefront LOCKED vốn 404 với khách); (d) trả lời rỗng = xoá trả lời; (e) khách thấy nhãn "đã bị
  ẩn" kèm nhãn lý do tiếng Việt (không hiện mã); đánh giá ẩn vì REFUNDED tenant không khôi phục được.
- **Bổ sung ADR-029 M10b theo triển khai (2026-09-28, Quốc chốt):** bảng `posts` (L2, RLS tách lệnh; public chỉ thấy
  PUBLISHED khi tenant không LOCKED), partial unique index 1 bài ghim/tenant (chỉ có trong SQL — cẩn thận khi chạy
  `prisma migrate dev`), trigger `posts_guard_product_tenant` (sản phẩm gắn phải cùng tenant) và
  `posts_guard_columns` (chỉ system_job đặt/gỡ HIDDEN). Quy tắc: ghim được bài mọi trạng thái trừ HIDDEN (công khai
  chỉ hiện khi PUBLISHED); bài HIDDEN tenant chỉ xoá được; tenant READ_ONLY không tạo/sửa/xoá bài (giống sản phẩm);
  gắn được sản phẩm chưa ARCHIVED (công khai chỉ hiện thẻ khi sản phẩm PUBLISHED); `publishedAt` giữ lần đăng đầu;
  body phải có chữ hoặc ≥1 ảnh; không có `authorId` ở GĐ1; ảnh bài viết thư mục `tenants/<id>/posts`, usage `POST`.

## ADR-030 — URL tài liệu rút gọn `/{tenantSlug}/{productSlug}`; bỏ sticky card xuất bản

- **Bối cảnh (2026-09-28, chủ dự án):** URL trang tài liệu `/{tenantSlug}/products/{productSlug}` dài, không tối ưu
  hiển thị/SEO. Card xuất bản dính khi cuộn (editor sản phẩm/bài viết) cao hơn màn hình, che các chức năng bên dưới.
- **Quyết định:**
  1. **URL chuẩn (canonical):** `/{tenantSlug}/{productSlug}`. Route `app/[tenantSlug]/[productSlug]/page.tsx`
     (segment tĩnh cùng cấp như `posts`, `checkout` được Next ưu tiên trước segment động). URL cũ
     `/{tenantSlug}/products/{productSlug}` trả **301** sang URL mới (giữ query/hash nếu có). Mọi link nội bộ, email,
     metadata `canonical`, sitemap (khi có) dùng một hàm dựng URL duy nhất `productPath(tenantSlug, productSlug)`.
  2. **Slug dành riêng:** slug tài liệu không được trùng segment tĩnh con của `/[tenantSlug]` hiện có và dự phòng:
     `products`, `posts`, `checkout`, `danh-gia`, `bai-viet`, `api`, `studio`, `account`, `login`, `admin`, `p`, `s`,
     `feed`, `tag`, `category`, `search`, `cart`, `orders`, `reviews`, `about`, `contact`, `new`, `edit` — kiểm ở
     validate tạo sản phẩm (slug tự sinh trùng thì thêm hậu tố). Danh sách nằm ở `packages/core`.
  3. **Editor Studio:** card xuất bản **không** dính khi cuộn ở mọi kích thước (bỏ `xl:sticky`); vẫn đứng đầu sidebar
     từ xl. Thanh lưu nhanh dưới xl giữ nguyên. Áp cho editor sản phẩm và editor bài viết. Thay ADR-027 phần
     "card xuất bản dính".
- **Bổ sung ADR-030 theo triển khai (2026-09-28):** redirect URL cũ bằng Route Handler
  `app/[tenantSlug]/products/[productSlug]/route.ts` trả **301** (Location tương đối, giữ query) — không dùng
  `permanentRedirect()`/`redirects()` vì Next trả 308 và pattern trong `next.config` khớp cả `/api/...`.
  `/{tenantSlug}/products` → 404. `productPath`/`productUrl`/`RESERVED_PRODUCT_SLUGS` ở
  `packages/core/src/product/path.ts` (subpath client `@gieochu/core/product-path`); canonical là URL tuyệt đối.
  Slug tự nhập trùng từ dành riêng → `INVALID_SLUG`; slug tự sinh trùng → thêm hậu tố. Action sản phẩm nay
  revalidate cả trang tài liệu và storefront. **Trước khi deploy prod phải quét slug trùng từ dành riêng.**

## ADR-031 — Deploy Vercel: build không cần DB/env; `PRISMA_MIGRATE_URL` không bao giờ ở runtime

- **Bối cảnh (2026-09-29):** Deploy Vercel lỗi: (1) Vercel tự chạy `turbo run build` → `prisma generate` đòi
  `PRISMA_MIGRATE_URL`; (2) `next build` prerender trang đọc DB/env → fail-fast khi build; (3) `env.ts` bắt buộc
  `PRISMA_MIGRATE_URL` (role owner Neon, quyền DDL, bỏ qua RLS) cả lúc chạy app → buộc đưa secret owner lên Vercel.
- **Quyết định (chủ dự án duyệt mục 3):**
  1. `apps/web/vercel.json`: `framework: "nextjs"`, `buildCommand: "next build"`; Vercel Root Directory = `apps/web`,
     không override Build Command trên dashboard. Prisma client đã sinh sẵn được commit (`packages/db/src/generated`).
  2. Root `app/layout.tsx` `dynamic = "force-dynamic"` — mọi trang render lúc request; `next build` không cần biến
     env nào. Kèm lợi ích: nonce CSP (ADR-016) gắn được cho cả `/login`, `/register`, `/pricing`…; branding không bị
     đóng băng từ lúc build. Đổi lại 7 trang trước đây static tốn 1 truy vấn branding/request.
  3. `PRISMA_MIGRATE_URL` **bị xoá khỏi schema env runtime**; chỉ CLI Prisma (`migrate`, `studio`) và
     `setup-app-role` đọc trực tiếp và báo lỗi rõ khi thiếu. `prisma.config.ts` bỏ `datasource` khi thiếu biến (không
     URL giả). `db seed` chạy bằng `DATABASE_URL` (`gieochu_app`). **Không đặt biến này trên Vercel/runtime**; nếu từng
     đặt thì xoá và đổi mật khẩu role owner.
  4. Migration production chạy ngoài Vercel (máy dev/CI) bằng `pnpm db:migrate`. Worker pg-boss (`worker.ts`) cần
     nơi chạy lâu dài riêng — chưa có (BACKLOG).

## ADR-032 — Cấu hình hệ thống và thương hiệu lấy từ System Center (DB); env chỉ còn hạ tầng + secret

- **Bối cảnh (2026-09-29, chủ dự án):** Env Vercel chứa nhiều biến nghiệp vụ/thương hiệu. Chủ dự án yêu cầu mọi cấu
  hình tuỳ chọn và chuỗi thương hiệu quản lý ở System Center, lưu DB; chọn đưa cả TTL bảo mật vào System Center
  **có giới hạn**, và refactor xong mới deploy.
- **Quyết định:**
  1. **Env runtime chỉ còn:** `APP_URL`, `DATABASE_URL`, `DIRECT_URL`, `JWT_ACCESS_SECRET`, `JWT_ISSUER`,
     `JWT_AUDIENCE`, `PAYMENT_ENCRYPTION_KEY`, `STORAGE_ENCRYPTION_KEY` (+ `NODE_ENV` do nền tảng đặt). Biến dev/CLI
     (`PRISMA_MIGRATE_URL`, `TEST_DATABASE_URL`, fallback email Mailpit, `MOMO_SANDBOX_ENDPOINT`, `ALLOW_DEMO_SEED`)
     không thuộc runtime prod.
  2. **Thương hiệu:** `APP_NAME/APP_SHORT_NAME/APP_SLOGAN` bỏ khỏi env. Nguồn duy nhất là `SystemBranding` (DB, trang
     `/admin/settings/branding`), fallback là hằng mặc định **một chỗ** trong `@gieochu/config/brand` khi DB trống.
     Mọi nơi đọc thương hiệu (metadata, email, trang, job) đi qua hàm async đọc DB (`getEffectiveBrand`).
  3. **Cấu hình hệ thống** — bảng L1 mới (1 dòng), trang `/admin/settings/general`, đọc có cache theo request,
     đổi có hiệu lực cho **thao tác mới** (không hồi tố token/đơn/hoá đơn đã tạo). Giá trị mặc định + giới hạn:
     | Khoá | Mặc định | Giới hạn |
     |---|---|---|
     | Access token (phút) | 15 | 5–60 |
     | Refresh token (ngày) | 7 | 1–30 |
     | Link xác minh email (giờ) | 24 | 1–72 |
     | Link đặt lại mật khẩu (phút) | 30 | 10–120 |
     | Presign upload (giây) | 600 | 60–3600 |
     | Presign download (giây) | 600 | 60–600 (§7.6: ≤10 phút) |
     | Dùng thử (ngày) | 14 | 0–60 |
     | Ân hạn (ngày) | 7 | 0–30 |
     | Đơn chờ thanh toán (phút) | 60 | 15–1440 |
     | Hoá đơn chờ (giờ) | 24 | 1–168 |
     | Lượt tải mặc định | 5 | 0–1000 (0 = không giới hạn) |
     Validate ở server bằng zod (ngoài khoảng → từ chối). Chỉ `SYSTEM_ADMIN` sửa; ghi log thay đổi (audit_logs khi có M12).
  4. **Múi giờ hiển thị** là hằng `Asia/Ho_Chi_Minh` trong code (CLAUDE.md), không cấu hình.
- **Hệ quả:** các chỗ đọc env đồng bộ (auth/JWT TTL, presign, email verify/reset, order/subscription sweep, sản phẩm)
  chuyển sang đọc cấu hình async; worker đọc lại mỗi lần chạy job.

## ADR-033 — Trang chủ hệ thống dùng dữ liệu thật (số liệu, danh mục, giáo viên, tài liệu nổi bật, số đã bán)

- **Bối cảnh (2026-09-29, chủ dự án):** Các section trang chủ (`CmsPage` home, `homeSectionsSchema`) đang là dữ liệu
  nhập tay/mockup. Chủ dự án chốt: dùng dữ liệu thật; nổi bật = **admin ghim + tự bù**; **hiển thị số đã bán thật** của
  tài liệu và tenant, chưa bán thì không hiển thị; số liệu nổi bật là số thật, bằng 0 thì ẩn ô đó.
- **Quyết định:**
  1. **Số đã bán** = số lượt mua đã hoàn tất (order item FULFILLED, không tính đơn đã hoàn tiền/entitlement thu hồi).
     Lưu **cột cache** `products.soldCount Int @default(0)`, cập nhật dưới `system_job` khi đơn chuyển PAID/FULFILLED
     và khi hoàn tiền/thu hồi (tính lại toàn phần theo sản phẩm, idempotent — mẫu `ratingSum/ratingCount` ADR-029).
     Số đã bán của tenant = tổng `soldCount` các tài liệu Công khai. Trang chủ/public chỉ đọc cột cache trên
     `products` (scope public), **không** truy vấn `orders` — giữ §7.9 (hệ thống không đọc chi tiết đơn của tenant).
     `soldCount = 0` → không hiển thị "đã bán".
  2. **Số liệu nổi bật** (thay dữ liệu nhập tay): số tenant đang hoạt động có ≥1 tài liệu Công khai, số tài liệu
     Công khai, tổng lượt mua (tổng `soldCount`), số đánh giá hiển thị. Ô nào = 0 thì ẩn; cả section rỗng thì không
     render. Nhãn từng ô vẫn sửa được trong CMS.
  3. **Tìm tài liệu:** chip gợi ý lấy từ danh mục đang hoạt động (có ≥1 tài liệu Công khai), admin vẫn sửa tiêu đề/placeholder.
  4. **Giáo viên & Coach nổi bật / Tài liệu nổi bật:** CMS lưu `title/subtitle`, `limit`, `pinnedTenantIds` /
     `pinnedProductIds`; hiển thị ghim trước (bỏ id không còn hợp lệ: tenant không ACTIVE, tài liệu không Công khai)
     rồi tự bù theo điểm đánh giá (≥1 đánh giá) và mới nhất cho đủ `limit`. Thẻ giáo viên: tên, logo, số tài liệu,
     điểm TB + số đánh giá, số đã bán (ẩn khi 0), link storefront. Thẻ tài liệu: ảnh bìa tối ưu, tên, tenant, giá hiệu
     lực (khuyến mãi), sao, đã bán (ẩn khi 0), link `productPath`.
  5. **Giữ nhập tay:** Hero, Vì sao chọn, Mở gian hàng, Cảm nhận người dùng (về nền tảng), CTA cuối.
  6. Dữ liệu cũ nhập tay của các section chuyển sang thật được bỏ qua khi render (schema đổi, parse phòng thủ).
- **Bổ sung ADR-033 theo triển khai (2026-10-15, Quốc chốt):** "Công khai" trên trang chủ = tài liệu PUBLISHED **và**
  tenant ACTIVE (tenant READ_ONLY/LOCKED không được quảng bá); số đánh giá = review VISIBLE trên tài liệu Công khai;
  tự bù theo: có đánh giá → điểm TB giảm dần → số đánh giá → mới nhất (tenant: ngày tạo); dòng đơn FULFILLED thiếu
  entitlement vẫn tính đã bán. `soldCount` tính lại sau commit ở mọi đường đổi trạng thái đơn/entitlement
  (`createOrder` 0đ, `applyCouponToOrder`, `confirmOrderManually`, `processPaymentEvent`, `markOrderRefunded`,
  `revokeEntitlement`); chưa có job đối soát định kỳ (BACKLOG). Migration `20260929120000_adr033_product_sold_count`
  đã áp lên DB dùng chung (chỉ thêm cột — an toàn với bản đang deploy).
- **Sự cố 2026-10-15 (ADR-032):** migration drop `system_settings.platformName` chạy trên DB dev = DB production làm
  production 500 (bản deploy còn đọc cột). Khôi phục bằng `ADD COLUMN IF NOT EXISTS "platformName" TEXT`. Khi deploy
  bản không còn dùng cột: thêm migration `DROP COLUMN IF EXISTS` chạy **sau** deploy (expand → contract, xem CLAUDE.md).

## ADR-034 — Một database duy nhất cho dev, Preview và production

- **Bối cảnh (2026-10-15, chủ dự án):** Sau sự cố drop cột `platformName`, Quốc đề xuất tách DB dev bằng Neon branch.
  Chủ dự án quyết định **không tách**: máy dev, Vercel Preview và Production cùng dùng một database Neon.
- **Hệ quả bắt buộc (mọi thao tác DB trên máy dev = thao tác trên production):**
  1. **Migration** chỉ do Quốc duyệt và chạy; theo expand → contract (deploy chỉ *thêm*; `DROP`/`RENAME` chỉ chạy sau
     khi code không còn dùng cột đã lên production). Không `prisma migrate dev/reset`.
  2. **Không chạy `pnpm db:seed`** (ghi đè nội dung trang chủ CMS). Thay đổi dữ liệu hệ thống qua UI System Center.
  3. **Integration test và script thủ công ghi dữ liệu thật** vào production (tạo rồi dọn user/tenant/đơn tạm, có thể
     gửi email tới `@example.test`). Chỉ chạy khi cần; luôn dọn dữ liệu và không đụng cấu hình dùng chung
     (từ 2026-10-25: **mock lớp đọc cấu hình** — `lib/system-storage`, `getPlatformPaymentConfigRow` — không ghi và
     không snapshot/restore bảng cấu hình singleton; helper `shared-config-snapshot` đã xoá). Không chạy luồng gửi email
     tới địa chỉ thật.
  4. **Dữ liệu demo** (`demo:seed`, khách `demo+…@gieochu.test`, sản phẩm `demo-*` của `phongweb`) đang nằm trên
     production và hiển thị công khai — dọn bằng `demo:clean` trước khi mở cho người dùng thật.
  5. **Preview deployment** ghi vào cùng DB — chỉ dùng Preview để xem giao diện, không thao tác tạo/xoá dữ liệu.
- **Thay thế:** khuyến nghị "tách DB dev bằng Neon branch" trong CLAUDE.md/runbook (sự cố 2026-10-15).

## ADR-035 — Trang "Cửa hàng" (marketplace) `/cua-hang`: CMS trước, trang dữ liệu sau

- **Bối cảnh (2026-10-15, chủ dự án):** Cần trang Cửa hàng kiểu ecommerce tổng hợp tài liệu mọi tenant (tham khảo ảnh
  mẫu marketplace). Đề xuất UX của Phong; chủ dự án chốt các điểm dưới.
- **Quyết định:**
  1. **Route:** `/cua-hang` (trang tổng hợp, trang hệ thống ADR-025, `container-page` ADR-024) + `/cua-hang/tai-lieu`
     (`?q=&danh-muc=&sap-xep=noi-bat|ban-chay|danh-gia-cao|moi-nhat&trang=`) dùng cho ô tìm kiếm và mọi "Xem tất cả".
     Menu header "Khám phá tài liệu" → link "Cửa hàng" (có bản mobile). `cua-hang` (+ dự phòng `tai-lieu`, `danh-muc`,
     `tim-kiem`, `giao-vien`, `kham-pha`) thêm vào slug tenant dành riêng; quét tenant trùng trước deploy.
  2. **Thứ tự section:** Hero (ô tìm kiếm) → Danh mục → Nổi bật → Theo từng danh mục (≤6 khối × 4) → Bán chạy (nhãn
     #1…) → Đánh giá cao → **Gian hàng nổi bật** (bổ sung của chủ dự án) → Mới → CTA mở gian hàng. Section rỗng thì ẩn.
  3. **Đánh giá cao:** ≥3 đánh giá **và** điểm TB ≥4,0 (so sánh số nguyên `ratingSum ≥ 4·ratingCount`); ngưỡng chỉnh
     được ở System Center; ghi rõ tiêu chí dưới tiêu đề.
  4. **Gian hàng nổi bật:** tenant ACTIVE có ≥1 tài liệu Công khai, xếp theo **bán chạy trong 30 ngày gần nhất** (chế
     độ mặc định) hoặc **đánh giá cao** (điểm TB tổng các tài liệu, ≥ ngưỡng số đánh giá) — admin chọn chế độ trong
     CMS + ghim. Số bán 30 ngày là **số đếm tổng hợp theo tenant** tính dưới `system_job` (không trả chi tiết đơn ra
     ngoài, không route admin đọc đơn — giữ §7.9), có cache ngắn.
  5. **Tìm kiếm không dấu ngay GĐ1:** migration *expand* (extension `unaccent` hoặc cột chuẩn hoá + index) — Quốc duyệt
     và chạy theo ADR-034.
  6. **Thứ tự triển khai:** **GĐ1 = CMS Cửa hàng trong System Center** (`CmsPage` slug `shop` hoặc tương đương theo mẫu
     CMS trang chủ: nội dung hero, tiêu đề/mô tả/bật-tắt/thứ tự từng section, ghim nổi bật riêng cho Cửa hàng, chế độ
     + ghim gian hàng nổi bật, ngưỡng đánh giá cao) + nháp/xuất bản/khôi phục. **GĐ2 = trang công khai** `/cua-hang`,
     `/cua-hang/tai-lieu` đọc cấu hình CMS + dữ liệu thật (loader `lib/shop.ts` qua `withPublic`, "Công khai" =
     PUBLISHED + tenant ACTIVE, không đọc `orders` trực tiếp ở scope public), tìm không dấu, header/footer link.
  7. Thẻ tài liệu tách thành component dùng chung với trang chủ (`DocumentCard`); GĐ1 không có carousel.
- **Nợ/GĐ sau:** trang danh mục SEO `/cua-hang/danh-muc/[slug]`, `Product.publishedAt` (tạm dùng `createdAt` cho
  "Mới"), `DocumentCategory.iconKey/sortOrder`, index cho catalog lớn, carousel.
- **Bổ sung ADR-035 (2026-10-15, Quốc chốt theo kế hoạch `docs/ke-hoach-cua-hang-marketplace-2026-10-15.md`):**
  cấu hình lưu `CmsPage` slug `shop` (`blocks`/`blocksDraft`, không DDL ở GĐ1); chưa có/chưa xuất bản → `/cua-hang`
  dùng cấu hình mặc định (không 404); section thiếu trong dữ liệu đã lưu → tự thêm ở trạng thái **ẩn**; ngưỡng điểm
  lưu số nguyên ×10 (`minAvgTenths`); một tài liệu được xuất hiện ở nhiều kệ; "Theo danh mục" xếp bán chạy → điểm
  → mới nhất; gian hàng chế độ 30 ngày thiếu thì bù theo tổng đã bán → đánh giá → mới nhất; số bán 30 ngày tính dưới
  `withSystemJob` lúc render với cache ngắn (chỉ trả số đếm theo tenant), đếm đơn FULFILLED theo `paidAt`, loại
  entitlement đã thu hồi; trang tìm có `q` → `noindex`, khi có `q` ưu tiên khớp tiêu đề; chip/ô tìm trang chủ chuyển
  sang `/cua-hang/tai-lieu` ở GĐ2. Hằng `SYSTEM_CMS_SLUGS = ["home","shop"]`: form CMS chung không được tạo/ghi đè
  slug này và `/p/[slug]` trả 404 cho chúng (sửa lỗi có sẵn). Tìm không dấu: extension `unaccent` + hàm IMMUTABLE
  bọc (migration expand, Quốc duyệt và chạy theo ADR-034).
- **Chủ dự án chốt (2026-10-15):** kệ "Bán chạy" xếp theo **tổng đã bán mọi thời gian** (`soldCount`); số bán 30 ngày
  **chỉ dùng để xếp hạng** gian hàng nổi bật, **không hiển thị công khai** (thẻ gian hàng hiện tổng đã bán + sao).

## ADR-036 — Xử lý job nền ngay trong app (không worker thường trực): `after()` + Vercel Cron hằng ngày

- **Bối cảnh (2026-10-16):** Vercel không chạy tiến trình thường trực nên `apps/web/worker.ts` (pg-boss `work`) không có
  nơi chạy (ADR-031 mục 4). Kiểm chỉ đọc hàng đợi: 18 job `payment.process` ở trạng thái `created` — **tất cả từ
  integration test** (`evt_m8test_*`, tenant đã xoá), không có đơn khách thật bị kẹt; job `order.sweep`/`subscription.sweep`
  tồn do lịch pg-boss từ những lần chạy worker local. Chủ dự án chọn phương án tự xử lý trong project (không dùng
  cron-job.org hay server riêng).
- **Quyết định:**
  1. **Job phát sinh từ request** (`payment.process` từ webhook tenant, `file.scan` từ upload): vẫn `send` vào pg-boss
     trước (bản ghi bền), rồi `after()` (Next.js) chạy bộ xử lý hàng đợi ngay sau khi trả response — lấy job bằng
     pg-boss `fetch` (khoá job, chống xử lý trùng), `complete`/`fail` tường minh, có ngân sách thời gian. Lỗi/bị ngắt →
     job còn trong hàng đợi, pg-boss tự thử lại theo cấu hình retry.
  2. **Việc định kỳ:** một route `GET /api/cron/daily` do **Vercel Cron** gọi mỗi ngày (gói Hobby chỉ cho tần suất
     ngày): chạy `runSubscriptionSweep()`, `runOrderSweep()` trực tiếp (không qua hàng đợi) và dọn job còn sót của
     `payment.process`/`file.scan`. Xác thực bằng header `Authorization: Bearer <CRON_SECRET>` so sánh `timingSafeEqual`;
     thiếu `CRON_SECRET` → route trả 503 (biến env **tuỳ chọn**, không làm app fail-fast). Có thể cắm thêm cron-job.org
     vào cùng route sau này nếu cần tần suất dày hơn.
  3. **Đơn PENDING quá hạn** (`orderPendingTtlMinutes`): luồng đọc/thanh toán phải coi đơn quá hạn là hết hạn ngay
     (không phụ thuộc sweep 5 phút); sweep hằng ngày chỉ đồng bộ trạng thái DB.
  4. `worker.ts` giữ lại cho chạy local/server riêng sau này; không deploy.
  5. Job lạ/không hợp lệ (tenant không tồn tại) → `fail`, log, không làm hỏng cả lô.
- **Hệ quả:** không phụ thuộc dịch vụ ngoài; thanh toán được giao gần như tức thì; sweep thuê bao chính xác theo ngày.
  Dữ liệu job tồn từ test cần dọn (DML trên DB dùng chung — chủ dự án chạy, ADR-034); integration test phải dọn job
  pg-boss mình tạo.
- **Chủ dự án chốt (2026-10-16):** giữ quy tắc thanh toán trễ — webhook khớp đơn PENDING hoặc đã hết hạn **trong 24h**
  sau `expiresAt` thì tự fulfil; trễ hơn 24h thì **không** tự fulfil, giao dịch ghi MATCHED để tenant đối soát/xử lý
  tay. Đơn PENDING quá `expiresAt` được coi là EXPIRED khi đọc (`effectiveOrderStatus`). SQL dọn job test tồn đọng:
  `docs/ops/2026-10-16-pgboss-cleanup.sql` (chủ dự án chạy).
- **Làm rõ (2026-10-16):** "không làm app fail-fast" chỉ đúng khi **thiếu** `CRON_SECRET`; nếu đặt giá trị < 32 ký tự
  thì zod làm cả app dừng khi khởi động. Không chạy `worker.ts` local trên DB dùng chung (tạo lại lịch pg-boss, chạy
  song song cron) trừ khi Quốc duyệt.

## ADR-037 — M12: chia 3 đợt; audit log chỉ-INSERT không khoá ngoại, giữ 12 tháng; thống kê hằng ngày

- **Bối cảnh (2026-10-16):** M12 (đặc tả mục M12) chưa có gì: không có `audit_logs`, `tenant_daily_stats`,
  `abuse_reports`; nhiều module đang ghi `logger` tạm và chờ M12 (BACKLOG). Chủ dự án chốt 4 điểm dưới.
- **Quyết định:**
  1. **3 đợt, deploy riêng:** M12a Audit log → M12b Thống kê (`tenant_daily_stats` + dashboard admin thật) → M12c Báo
     cáo vi phạm (`abuse_reports`, nút Báo cáo, `/admin/reports`, email, cam kết bản quyền khi đăng sản phẩm).
  2. **`audit_logs` (L1):** cột theo đặc tả (`actorId?`, `scope`, `tenantId?`, `action`, `targetType?`, `targetId?`,
     `metadata Json`, `ip?`, `userAgent?`, `createdAt`); **không khoá ngoại** tới users/tenants (lịch sử bất biến, không
     chặn xoá dữ liệu khác, test dọn được dữ liệu tạm); index `(createdAt)`, `(tenantId, createdAt)`, `(actorId, createdAt)`.
     **Chỉ INSERT:** role `gieochu_app` không có UPDATE; trigger chặn UPDATE mọi trường hợp và chặn DELETE trừ khi
     phiên đặt cờ purge **và** dòng cũ hơn 12 tháng. Không lưu secret/token/mật khẩu trong `metadata`.
  3. **Lưu IP + User-Agent, giữ 12 tháng:** cron hằng ngày (`/api/cron/daily`, ADR-036) xoá dòng audit > 12 tháng.
  4. **Partition theo tháng: để sau** (đặc tả cho phép ghi ADR nếu để sau) — vào BACKLOG khi bảng lớn.
  5. **Thống kê hằng ngày** gộp vào `/api/cron/daily` (03:00 giờ VN), tính lại 2 ngày gần nhất theo `Asia/Ho_Chi_Minh`;
     dashboard ghi rõ "số liệu đến hết hôm qua" (thay cho "mỗi giờ" của đặc tả).
  6. **Test:** nâng trần integration 53 → **55** để thêm đúng 2 test M12 theo đặc tả mục 9 (audit không sửa/xoá được;
     thống kê không chứa dữ liệu cá nhân + dashboard đọc được). Unit giữ trần 94. Lưu ý ADR-034: dòng audit do test tạo
     không xoá được, tồn tới hết hạn 12 tháng — chấp nhận (dữ liệu giả, không có thông tin cá nhân thật).
  7. Xem audit: admin `/admin/audit` (lọc actor, action, tenant, khoảng thời gian); owner `/studio/{slug}/activity` chỉ
     dòng có `tenantId` của mình (kiểm quyền owner ở server, truy vấn luôn lọc `tenantId`). `ADMIN_VIEWED_TENANT` ghi khi
     admin mở trang chi tiết tenant.
- **Không đổi:** §7.9 — admin không đọc đơn/khách của tenant; thống kê chỉ số liệu tổng hợp.
- **Bổ sung ADR-037 (2026-10-16, Quốc):** sau khi migration M12a áp, **mọi** integration test gọi hàm có audit (đơn,
  entitlement, share link, sản phẩm, đăng nhập…) đều để lại dòng `audit_logs` giả không xoá được tới khi purge 12 tháng
  — chấp nhận như mục 6 (dữ liệu test, email `@example.com`). Mục "Hoạt động" trong Studio chỉ hiện với OWNER (khớp
  quyền loader). DB mới: tạo schema `pgboss` bằng role owner trước rồi chạy lại `setup-app-role` là quy trình chính thức.
- **ADR-037 — M12b chốt định nghĩa số liệu (2026-10-16, Quốc):** `tenant_daily_stats(tenantId, date DATE theo ngày giờ
  VN, ordersPaid, gmvVnd BigInt, newCustomers, downloads)`, unique `(tenantId, date)`, FK tenant `ON DELETE CASCADE`
  (bảng tổng hợp, tính lại được — không bất biến như audit). Ngày VN = `Asia/Ho_Chi_Minh`.
  - `ordersPaid` / `gmvVnd`: đơn có `paidAt` rơi vào ngày đó (**GMV gộp** — tính cả đơn sau này bị hoàn tiền; hoàn
    tiền không trừ ngược vào ngày cũ). `gmvVnd` = tổng tiền khách trả (`totalVnd` sau giảm giá).
  - `newCustomers`: `tenant_customers` tạo trong ngày. `downloads`: `download_events` trong ngày.
  - Cron hằng ngày tính lại **hôm qua + hôm nay** (upsert, idempotent); bảng trống → tự backfill từ ngày có dữ liệu
    sớm nhất (tối đa 400 ngày). Tính dưới `withSystemJob`; không lưu email/tên/mã đơn.
  - Dashboard admin: GMV + đơn đã thanh toán + khách mới + lượt tải toàn nền tảng 30 ngày (biểu đồ + tổng) và top
    gian hàng theo GMV 30 ngày (chỉ tên gian hàng + số tổng hợp — §7.9); ghi chú "số liệu đến lần tổng hợp gần nhất".
  - **Duyệt khi triển khai M12b (2026-10-16, Quốc):** `newCustomers` đếm theo `tenant_customers.firstOrderAt` (bảng không
    có `createdAt`; dòng chỉ tạo khi đơn đầu tiên PAID nên `firstOrderAt` = thời điểm tạo). `gieochu_app` có
    SELECT/INSERT/UPDATE/DELETE trên `tenant_daily_stats` (bảng tổng hợp, tính lại được).

## ADR-038 — M12c Báo cáo vi phạm: ai cũng báo cáo được, ẩn danh với tenant, khoá kiểm duyệt, cam kết bản quyền lưu vết

- **Bối cảnh (2026-10-16):** đợt cuối M12 (đặc tả mục M12 "Báo cáo vi phạm"). Chủ dự án chốt 3 điểm (chống spam, ẩn
  danh, cam kết); các điểm còn lại Quốc chọn phương án an toàn.
- **Quyết định:**
  1. **Đối tượng báo cáo:** sản phẩm, đánh giá, bài viết (bình luận chưa có — M10c). Loại: `COPYRIGHT`, `INAPPROPRIATE`,
     `SCAM`, `OTHER`; mô tả bắt buộc (≤2000 ký tự), link bằng chứng tuỳ chọn (≤5 URL http/https).
  2. **Ai cũng gửi được:** đã đăng nhập → lấy user; khách vãng lai → bắt buộc email. **Chống spam (chủ dự án chốt):**
     tối đa 5 báo cáo/giờ/IP + ô ẩn (honeypot) + chặn trùng (cùng người báo cáo/email + cùng đối tượng đang OPEN).
     Không captcha, không dịch vụ ngoài.
  3. **Bảng `abuse_reports` (L1):** đối tượng (`targetType`, `targetId`, `tenantId`), loại, mô tả, bằng chứng,
     người báo cáo (`reporterUserId?`, `reporterEmail`), `ip`, `status` OPEN/RESOLVED/REJECTED, quyết định, ghi chú
     xử lý, `resolvedById`, `resolvedAt`. IP giữ theo chính sách 12 tháng như audit (dọn cùng cron).
  4. **Ẩn danh với tenant (chủ dự án chốt):** chủ gian hàng chỉ biết loại vi phạm, nội dung bị xử lý và quyết định —
     không bao giờ thấy email/danh tính người báo cáo. Chỉ admin thấy.
  5. **Admin xử lý `/admin/reports`:** ẩn nội dung (đánh giá/bài viết), lưu trữ sản phẩm, khoá tenant (`LOCKED`), bác
     bỏ. Nội dung bị admin ẩn/lưu trữ mang **khoá kiểm duyệt** (`moderationLockedAt` + lý do): tenant **không** tự
     xuất bản lại/bỏ ẩn được cho tới khi admin gỡ khoá. Admin xem nội dung đối tượng (công khai/tenant) nhưng không
     xem đơn/khách (§7.9; đánh giá chỉ hiện nội dung, không danh tính khách).
  6. **Thông báo:** email cho người báo cáo (quyết định chung) và chủ gian hàng (khi có biện pháp hoặc khi tenant bị
     khoá), qua `sendEmailNow`; lỗi gửi email không chặn việc xử lý. Audit `REPORT_SUBMITTED`, `REPORT_RESOLVED`,
     `CONTENT_MODERATION_LOCKED/UNLOCKED`.
  7. **Cam kết bản quyền (chủ dự án chốt):** bắt buộc tích mỗi lần **xuất bản** sản phẩm; lưu `rightsConfirmedAt` +
     `rightsConfirmedById` (lần gần nhất). Sản phẩm đang công khai giữ nguyên, chỉ phải tích khi xuất bản lại.
  8. **Test:** không thêm (ngân sách M12 đã đủ 2/2) — nợ test vào BACKLOG.

## ADR-039 — Quyền lợi người mua khi tài liệu bị xác nhận vi phạm: chọn "tải lần cuối" hoặc "yêu cầu hoàn tiền"

- **Bối cảnh (2026-10-16, chủ dự án chốt):** khi admin xử lý báo cáo bằng **lưu trữ sản phẩm** (vi phạm được xác nhận,
  ADR-038), khách **đã mua và đã thanh toán** được 2 lựa chọn rõ ràng. Nền tảng không giữ tiền bán tài liệu (tiền về
  thẳng tenant) nên chỉ **yêu cầu** tenant hoàn tiền; mỗi đơn chỉ 1 sản phẩm (`createOrder` 1 productId) nên hoàn tiền
  = hoàn cả đơn bằng `markOrderRefunded` sẵn có.
- **Quyết định:**
  1. Khi `ARCHIVE_PRODUCT`: mọi entitlement còn hiệu lực (chưa thu hồi) của sản phẩm, thuộc đơn có số tiền > 0, chuyển
     `remedyStatus = PENDING_CHOICE`; tải xuống bị chặn cho tới khi khách chọn. Đơn 0đ: chỉ có lựa chọn tải lần cuối.
  2. **Lựa chọn A — tải lần cuối:** `downloadLimit = downloadsUsed + 1`, trước khi tải hiện cảnh báo (tài liệu bị gỡ do
     vi phạm chính sách, chỉ dùng cá nhân, không phát tán, chịu trách nhiệm khi phát tán; đây là lần tải cuối).
  3. **Lựa chọn B — yêu cầu hoàn tiền:** chặn tải vĩnh viễn, `remedyStatus = REFUND_REQUESTED`, email tenant; Studio
     hiện yêu cầu ở trang đơn + lọc "Yêu cầu hoàn tiền"; tenant bấm "Hoàn tiền" sẵn có → `REFUNDED`. Tenant được đề nghị
     xử lý trong **7 ngày**; admin chỉ thấy **số đếm** yêu cầu quá hạn theo tenant (§7.9) và có thể khoá tenant.
  4. Lựa chọn **không đổi được** sau khi chọn; khách không bị giới hạn thời hạn chọn. Gỡ khoá kiểm duyệt không hoàn tác
     lựa chọn.
  5. Email khách (2 lựa chọn, link thư viện) và tenant (số khách bị ảnh hưởng) do hệ thống gửi; admin không thấy danh
     sách khách. Audit `REMEDY_FINAL_DOWNLOAD_CHOSEN`, `REMEDY_REFUND_REQUESTED`.
  6. Nút theo dõi tranh chấp hoàn tiền chi tiết → BACKLOG. Test: không thêm (nợ BACKLOG).
- **Bổ sung ADR-039 (2026-10-16, Quốc):** (a) đơn 0đ cũng vào `PENDING_CHOICE` nhưng chỉ được chọn tải lần cuối
  (server từ chối hoàn tiền); (b) khi entitlement có remedy (≠ NONE), tenant **không** đổi được `downloadLimit` ("Cấp
  thêm lượt" bị chặn ở trigger + server) để giữ nghĩa "lần cuối"/"chặn vĩnh viễn"; (c) đơn được thanh toán **sau** khi
  sản phẩm đã bị khoá kiểm duyệt (webhook muộn): entitlement tạo ra ở `PENDING_CHOICE` (gắn báo cáo gây khoá) — khách đã
  trả tiền luôn có 2 lựa chọn; checkout mới cho sản phẩm bị khoá/không công khai bị chặn như hiện có. Email khách gửi
  tuần tự trong `after()` — sản phẩm nhiều người mua chuyển sang job (BACKLOG).
- **Bổ sung ADR-039 lần 2 (2026-10-17, Quốc — đính chính theo code):** (d) lựa chọn A cấp `downloadLimit = downloadsUsed +
  max(1, số tệp khả dụng)` — **lượt dùng chung** cho cả entitlement (không đếm riêng từng tệp); UI ghi rõ "N lượt cho N
  tệp, mỗi lượt tải một tệp". (e) Cột `remedyResolvedAt` ghi thời điểm REFUNDED (CHECK: chỉ REFUNDED mới có). (f) Tenant
  xoá bài viết / khách xoá đánh giá đang bị khoá kiểm duyệt: **cho phép** (xoá chỉ làm nội dung vi phạm biến mất; báo cáo
  giữ nguyên). (g) `PRODUCT_UNAVAILABLE` chặn thanh toán khi tenant không `ACTIVE` (gồm `READ_ONLY` — từ M3 v2 chỉ còn là
  biện pháp quản trị) — khách chưa bị trừ tiền; chờ chủ dự án xác nhận.

## ADR-040 — Chỉ gian hàng ACTIVE hiển thị tài liệu; READ_ONLY = trang "tạm ngưng" không có tài liệu

- **Bối cảnh (2026-10-17, chủ dự án chốt):** "Gian hàng chỉ hiển thị tài liệu khi ở trạng thái Hoạt động; ngoài trạng thái
  này tài liệu không hiển thị cho người dùng." Trước đó (§4.4 đặc tả gốc) READ_ONLY vẫn render storefront + tài liệu, chỉ
  ẩn nút mua. Từ M3 v2 READ_ONLY chỉ còn là biện pháp quản trị.
- **Quyết định:**
  1. **ACTIVE:** như hiện tại. **LOCKED:** giữ nguyên (khách 404, chủ thấy thông báo).
  2. **READ_ONLY:** khách vào `/{slug}` thấy trang thông báo "Gian hàng đang tạm ngưng hoạt động" — **không** danh sách
     tài liệu/bài viết/đánh giá; trang tài liệu `/{slug}/{productSlug}` và bài viết trả 404. Chủ/thành viên gian hàng vẫn
     xem storefront kèm thông báo trạng thái.
  3. Cửa hàng `/cua-hang`, trang chủ: đã chỉ lấy tenant ACTIVE (ADR-033/035) — không đổi.
  4. Thanh toán đơn PENDING khi tenant không ACTIVE: **chặn** (`PRODUCT_UNAVAILABLE`, chốt ADR-039 (g)). Khách đã mua
     vẫn tải từ Thư viện (ADR-039 áp riêng cho tài liệu vi phạm).
- **Bổ sung ADR-040 (2026-10-17, Quốc):** tenant không ACTIVE còn chặn: gửi/sửa đánh giá (409 `TENANT_NOT_ACTIVE`) —
  **thay thế ADR-029 bổ sung (c)** ("READ_ONLY vẫn nhận đánh giá"); share link (410, cả mở link và tải); báo cáo vi phạm
  (404). Code xác định "chủ" bằng `ownerId` (thành viên khác → BACKLOG). Để BACKLOG: coupon preview chưa kiểm trạng thái
  tenant; đổi tên integration test READ_ONLY cũ; thống nhất cách chủ tenant LOCKED xem trang tài liệu/bài viết.

## ADR-041 — Nâng cấp tài khoản (Bảng giá CMS) + Hồ sơ tài khoản; gói năm; hoàn tiền gói 7 ngày

- **Bối cảnh (2026-10-17):** kế hoạch `docs/ke-hoach-nang-cap-tai-khoan-va-ho-so-2026-10-17.md` (đề xuất Phong
  `docs/de-xuat-trang-bang-gia-2026-10-17.md`, `docs/de-xuat-trang-ho-so-2026-10-17.md`). Nguyên tắc CMS/dữ liệu trước,
  UI sau. Chủ dự án chốt các điểm tiền/dữ liệu cá nhân/bảo mật; còn lại Quốc chốt theo đề xuất.
- **A. Bảng giá `/pricing` (CMS `pricing`):**
  1. Nội dung trang + marketing từng gói lưu `CmsPage` slug `pricing` (thêm vào `SYSTEM_CMS_SLUGS`), nháp/xuất bản/khôi
     phục, xem trước nháp chỉ admin. Giá/hạn mức chỉ đọc từ `Plan`. Gói đang bật chưa cấu hình CMS → tự hiện mặc định.
  2. **Gói năm, giảm theo % (chủ dự án chốt):** admin tạo `Plan` `interval = YEAR`; CMS ghép cặp gói tháng ↔ năm; %
     tiết kiệm **tính từ giá thật** (không nhập tay). Không quà tặng thêm tháng. Không dùng thử. Không thẻ Enterprise.
  3. **Chỉ quảng cáo tính năng có thật:** bảng so sánh/quyền lợi không được ghi 6 cờ tính năng chưa chặn theo gói cho
     tới khi có thật; dòng "tính năng" gắn khoá cờ chỉ hiện khi cờ được đánh dấu "đã triển khai".
  4. **Hạn mức 0 = không được phép**; "không giới hạn" dùng giá trị riêng (Hiếu đề xuất theo dữ liệu hiện có, sửa
     hiển thị Billing cho thống nhất).
  5. Đổi gói giữ hiện hành (không tính chênh lệch, kỳ mới nối sau). VAT/hoá đơn, hoa hồng, kênh hỗ trợ: là **nội dung
     CMS** do admin nhập (không hard-code); FAQ mẫu để trống các ý chưa có dữ kiện.
  6. Dải số liệu thật (số lấy từ DB, 0 → ẩn).
- **B. Hoàn tiền gói trả phí (chủ dự án chốt):** trong **7 ngày** kể từ thanh toán, **chỉ lần thanh toán gói đầu tiên**
  của mỗi tenant, hoàn **100%**. Chủ gian hàng gửi yêu cầu trong Billing Studio → admin duyệt ở System Center, **tự
  chuyển khoản tay** rồi bấm "Đã hoàn" → hoá đơn đánh dấu hoàn tiền, thuê bao về Free ngay (không mất dữ liệu). Từ
  chối kèm lý do. Audit mọi bước. Cổng QR/MoMo không tự hoàn.
- **C. Hồ sơ `/account`:** một hồ sơ cá nhân cho mọi User (khách + chủ gian hàng); Studio chỉ giữ cài đặt gian hàng,
  hai bên liên kết. Bỏ mục không có nghiệp vụ (Referrals, Blocklist…). Họ tên gộp một ô.
  1. **SĐT, Tỉnh/Thành: tuỳ chọn**, chỉ chủ tài khoản + admin thấy, gian hàng không thấy (chủ dự án chốt; bổ sung
     ADR-008 — hồ sơ không còn bắt buộc 4 trường).
  2. **Bảo mật chặt (chủ dự án chốt):** đổi mật khẩu cần mật khẩu cũ, thu hồi mọi phiên khác, email báo; đổi email cần
     nhập lại mật khẩu, xác minh link tới email mới (token `EMAIL_CHANGE`, xác nhận được khi chưa đăng nhập), báo email
     cũ, thu hồi phiên khác. Email mới hiện ở Studio các gian hàng từng bán cho user (đơn không lưu bản chụp) — chấp nhận.
  3. Ảnh đại diện: Cloudinary hệ thống, png/jpeg/webp ≤2MB, không tính hạn mức gói; GĐ1 chỉ hiện ở chỗ riêng tư.
  4. Để sau (BACKLOG): danh sách phiên/IP, xoá tài khoản, tuỳ chọn thông báo, ảnh công khai.
- **Test:** không thêm (93/54, trần 94/55) — nợ BACKLOG. Migration expand-only, Quốc duyệt, chủ dự án chạy (ADR-034).
- **Bổ sung ADR-041 (2026-10-17, chủ dự án chốt):** thông tin nhận tiền hoàn gói (ngân hàng, số tài khoản, tên chủ
  TK) do chủ gian hàng **nhập trong form yêu cầu hoàn tiền**; lưu **mã hoá AES-256-GCM** (dùng khoá mã hoá có sẵn, như
  secret thanh toán), **chỉ admin** xem (UI che bớt, hiện đầy đủ khi admin bấm xem), **tự xoá** (đặt null) khi yêu cầu
  được hoàn xong hoặc bị từ chối. Không ghi vào audit/log/email. Cờ tính năng "đã triển khai": hằng trong `packages/core`.
- **Bổ sung ADR-041 lần 2 (2026-10-17):** (chủ dự án chốt) tenant đã có **hoá đơn gói PAID thứ hai** thì **mất quyền
  yêu cầu hoàn tiền** (ẩn nút, server từ chối) — trường hợp đặc biệt liên hệ hỗ trợ. (Quốc) "Không giới hạn" trong
  hạn mức gói = `-1`, `0` = không được phép; admin xem đầy đủ thông tin nhận tiền ghi audit
  `SUBSCRIPTION_REFUND_PAYOUT_VIEWED` (chỉ id).
- **Bổ sung ADR-041 lần 3 (2026-10-17, Quốc — đính chính theo code):** xác nhận đổi email thu hồi **mọi** phiên (kể cả
  phiên hiện tại, xoá cookie, phải đăng nhập lại) — chặt hơn câu "phiên khác" ở mục C.2, giữ theo code. Giao diện admin
  xem SĐT/Tỉnh của user: chưa có → BACKLOG. Bảng `plans` trên DB (Quốc kiểm 2026-10-17): 4 gói, không gói nào dùng hạn
  mức `0`. **ADR-008:** quy định "hồ sơ bắt buộc đủ 4 trường" đã được thay bởi ADR-041 C.1 (SĐT/Tỉnh tuỳ chọn).

## ADR-042 — Một sidebar dùng chung cho System Center và Studio; Đăng xuất ở đáy sidebar; drawer mobile

- **Bối cảnh (2026-10-17, chủ dự án yêu cầu):** sidebar Studio phải cùng style System Center; dashboard admin/Studio
  phải có Đăng xuất (admin chưa có; Studio chỉ trong menu header, khó thấy); hoàn tất GĐ2b ADR-041 (menu mobile).
- **Quyết định:**
  1. Một component `SidebarNav` + `AppSidebarPanel` (`apps/web/app/admin/_ui/`) cho cả `/admin` và `/studio`; Studio
     chia "Tổng quan" + 3 nhóm accordion (Bán hàng / Nội dung / Gian hàng); badge dạng `{count, srText, urgent}`.
     Xoá sidebar riêng của Studio — không duy trì hai bộ.
  2. **Đăng xuất** cố định ở đáy sidebar (tách khỏi điều hướng) + trong `AccountMenu` header; ở app shell
     (admin/Studio) đăng xuất xong về `/login`; trang công khai và `/account` giữ về `/`.
  3. Dưới `lg`: nút ☰ mở drawer `<dialog>` chứa cùng sidebar (focus trap, Esc/nền/đổi trang đóng, reduced-motion).

## ADR-043 — Dashboard Tổng quan gian hàng (`/studio/{slug}`): chỉ số theo kỳ, doanh thu gộp + thực nhận

- **Bối cảnh (2026-10-18):** kế hoạch `docs/ke-hoach-dashboard-tong-quan-gian-hang-2026-10-17.md`. Chủ dự án chốt §9.
  Dữ liệu nghiệp vụ, không phải nội dung → không có GĐ CMS (PLAN_CHECK). Không cần migration.
- **Quyết định:**
  1. **Doanh thu (gộp)** = tổng `totalVnd` đơn có `paidAt` trong kỳ, **tính cả đơn sau này hoàn tiền** — cùng định nghĩa
     GMV System Center (ADR-037). Thêm thẻ **Doanh thu thực nhận** = doanh thu gộp − đơn đã hoàn tiền; khoản hoàn tính
     theo **ngày khách trả tiền** của đơn (không cần cột mới). Giao diện ghi rõ định nghĩa hai thẻ.
  2. Chỉ **chủ gian hàng (OWNER)** vào trang (giữ nguyên).
  3. **Bảng 10 đơn mới nhất** (không lọc theo kỳ): chỉ hiện **mã đơn, họ tên khách, đơn giá, thành tiền** (không email);
     link tới chi tiết đơn.
  4. **Khách quay lại** = khách có ≥2 đơn đã thanh toán tại gian hàng. **Điểm đánh giá TB** chỉ tính đánh giá đang hiển thị.
  5. **Kỳ** `?ky=`: hôm nay, hôm qua, tuần này (**bắt đầu Thứ Hai**), tháng, quý, năm, 7 ngày, 30 ngày (mặc định), tuỳ
     chọn `tu`–`den` **tối đa 366 ngày**; ranh giới theo giờ VN; so sánh % với kỳ trước cùng độ dài.
  6. Tính trực tiếp từ bảng L2 qua `withTenant` (không đọc `tenant_daily_stats` L1).
  7. Để sau: xuất CSV, biểu đồ doanh thu theo danh mục (donut). Test: dùng 1 unit + 1 integration còn trống trong trần
     94/55 (không nâng trần).
- **Bổ sung ADR-043 (2026-10-18, chủ dự án chốt):** số liệu tiền (doanh thu gộp/thực nhận, số đơn đã thanh toán, giá trị
  đơn TB, khách quay lại) **chỉ tính đơn > 0đ**; đơn 0đ (tài liệu miễn phí) tách thành thẻ phụ "Lượt nhận tài liệu miễn
  phí". **Top 5 bán chạy không tính đơn đã hoàn tiền.**
- **Bổ sung ADR-043 lần 2 (2026-10-18, Quốc):** Top 5 bán chạy tính theo số đơn **gồm cả lượt nhận miễn phí** (phản
  ánh mức phổ biến; cột doanh thu cạnh đó cho thấy tài liệu miễn phí = 0đ). "Khách quay lại" đếm cả đơn > 0đ đã hoàn
  tiền vào điều kiện ≥2 đơn (khách đã mua 2 lần). `ordersPaid` System Center gồm đơn 0đ, Studio không — có chủ đích.
- **Bổ sung ADR-043 lần 3 (2026-10-18, chủ dự án yêu cầu):** bộ lọc kỳ đổi sang **date range picker** kiểu ô
  `dd/mm/yyyy - dd/mm/yyyy` + popup (danh sách mốc trái + lịch 2 tháng có số tuần, Thứ Hai đầu tuần, ngày tương lai
  vô hiệu). Mốc: Hôm nay, Hôm qua, Tuần này, **Tuần trước**, Tháng này, **Tháng trước**, Quý này, **Quý trước**, Năm nay,
  7 ngày qua, 30 ngày qua (mặc định), Tuỳ chọn. Key mới: `tuan-truoc`, `thang-truoc`, `quy-truoc`. Thẻ thống kê hiển thị
  **số đầy đủ** theo `vi-VN` (vd `993.000 đ`), **không rút gọn** — áp cho cả System Center (component chung).
  (Quốc) Ba mốc đã kết thúc (`tuan-truoc`, `thang-truoc`, `quy-truoc`) so với **trọn** kỳ liền trước (vd tháng 9 so
  với cả tháng 8), không cắt theo độ dài — ngoại lệ có chủ đích của ADR-043 mục 5. Range có thêm `displayFrom`/`displayTo`
  (ngày VN, gồm ngày cuối) cho ô hiển thị.
- **Bổ sung ADR-043 lần 4 (2026-10-23, chủ dự án yêu cầu):** **trục Y** biểu đồ tiền cũng hiển thị **số đầy đủ**
  (`993.000 đ`, bỏ rút gọn "nghìn/tr/tỷ") — Studio + System Center. Nút **Gộp/Thực nhận** (và GMV/Đơn ở System Center)
  chuyển **tức thì phía client** (dữ liệu cả hai chuỗi đã có), URL cập nhật bằng `history.replaceState` giữ `?chi-so=`
  — không còn link GET render lại trang. Bảng "10 đơn mới nhất" của dashboard hiện "0 đ" (trang Đơn hàng vẫn "Miễn phí").

## ADR-044 — Lưu trữ đa nền tảng MinIO song song Cloudflare R2, Dedicated Bucket cho Gian hàng và Công cụ Quản trị Giám sát / Đồng bộ (2026-10-17)

- **Bối cảnh:**
  1. Ban đầu hệ thống thiết kế lưu trữ tập trung vào 1 tài khoản Cloudflare R2 (hoặc S3 chung) với 2 bucket `bucketPrivate` và `bucketPublic` (ADR-017). Mọi file của tất cả gian hàng dùng chung 1 bucket và phân biệt bằng prefix key `tenants/{tenantId}/...`.
  2. Chủ dự án yêu cầu:
     - Bổ sung cấu hình lưu trữ MinIO (hỗ trợ nhập IP/Domain, Port nếu dùng IP, các tham số kết nối, bucket prefix, max upload size...) như một phương án song song, **không bỏ Cloudflare R2**.
     - Chuyển đổi mô hình: **Mỗi gian hàng (Tenant) khi đăng ký / khởi tạo sẽ sở hữu một bucket riêng biệt**, không quản lý chung trong 1 bucket để tăng tính cô lập dữ liệu và bảo mật.
     - Cung cấp **Công cụ quản trị đồng bộ dữ liệu (Storage Sync Engine)** cho Quản trị viên để chuyển đổi file giữa 2 nền tảng (R2 ↔ MinIO).
     - Bổ sung **Màn hình giám sát các bucket của gian hàng** hiển thị dung lượng tổng, dung lượng đã dùng, số file, trạng thái kết nối.
- **Quyết định Kiến trúc:**
  1. **Dual Storage Provider trong `SystemStorageConfig`:**
     - Mở rộng cấu hình hệ thống để lưu độc lập cả 2 cấu hình: `CLOUDFLARE_R2` và `MINIO`.
     - Cung cấp trường `activeProvider: "CLOUDFLARE_R2" | "MINIO"` để Quản trị viên chỉ định nền tảng lưu trữ chính cho các file mới tải lên.
     - Tham số MinIO: `host` (IP hoặc Domain), `port` (number, vd 9000), `useSSL` (boolean), `region` (mặc định `us-east-1`), `bucketPrefix` (vd `gc-`), `maxUploadMb` (Int, vd 500), `publicBaseUrl` (tuỳ chọn), `accessKeyId`, `secretAccessKey` (mã hoá AES-256-GCM với `STORAGE_ENCRYPTION_KEY`).
     - Tương thích ngược: Nếu đọc cấu hình cũ chưa phân tách, tự động coi là `CLOUDFLARE_R2` và khởi tạo cấu hình MinIO mặc định.
  2. **Dedicated Bucket cho Gian hàng (Tenant):**
     - Mỗi gian hàng có 1 bucket riêng, sinh theo quy chuẩn S3/MinIO: `${bucketPrefix}${12 ký tự đầu của tenantId}` (chữ thường, số, dấu gạch nối, 3–63 ký tự), ví dụ `gc-k3j9x0a2m7qd`. *(Mẫu gốc `${bucketPrefix}tenant-${tenantId}` — 34 ký tự — đã thay ngày 2026-10-23, xem "Điều chỉnh 2026-10-23" bên dưới.)*
     - Bucket được khởi tạo ngay sau khi tạo gian hàng (`createTenantAction` gọi `getOrCreateTenantBucket`, lỗi chỉ ghi log, không chặn việc tạo; `createTenantForUser` bản thân không gọi storage) hoặc khởi tạo lười (lazy-provision) khi upload file đầu tiên / khi Admin bấm "Khởi tạo bucket".
     - Bảng `Tenant` bổ sung trường nullable `storageBucket` và `storageProvider` để ghi nhận bucket riêng của gian hàng.
     - Bảng `ProductFile` bổ sung trường nullable `storageBucket` và `storageProvider` để truy xuất chính xác file dù file nằm ở bucket chung cũ hay bucket riêng mới.
  3. **Công cụ Quản trị Đồng bộ Dữ liệu (Storage Sync Tool):**
     - Đặt tại `/admin/settings/storage/sync`. Quản trị viên chọn chiều đồng bộ (`R2 -> MinIO` hoặc `MinIO -> R2`).
     - Cơ chế Stream Copy: Đọc trực tiếp luồng stream từ S3 Client nguồn đẩy sang S3 Client đích (`GetObjectCommand` → `PutObjectCommand` / `Upload`), không đệm qua đĩa máy chủ web.
     - Tự động tạo bucket đích cho tenant nếu chưa có (`ensureBucketExists`).
     - Xác thực toàn vẹn qua byte size / ETag, cập nhật bản ghi `ProductFile.storageBucket`.
  4. **Màn hình Giám sát Dung lượng & Bucket Gian hàng:**
     - Đặt tại `/admin/settings/storage/buckets` (và liên kết từ tab Storage Settings).
     - Hiển thị bảng dữ liệu: Tên gian hàng, Slug, Tên Bucket, Nền tảng (R2/MinIO), Số lượng file, Dung lượng đã dùng (`storageUsedBytes`), Hạn mức gói (`Plan.storageMb`), Tỷ lệ % sử dụng kèm thanh màu cảnh báo trực quan.
     - Chức năng kiểm tra bucket (`HeadBucket`) và khởi tạo bucket thủ công cho các tenant cũ.
- **Điều chỉnh 2026-10-23 (Quốc, chủ dự án duyệt):** tên bucket gian hàng quá dài và dư (`tenant-` cố định, đủ 24 ký tự cuid2).
  1. Mẫu mới `${bucketPrefix}${12 ký tự đầu tenantId}`; tiền tố thiếu `-` cuối thì tự thêm. Tenant đã có `storageBucket` giữ tên cũ (không đổi tên/migrate).
  2. `bucketPrefix` ≤20 ký tự, `[a-z0-9-]`, bắt đầu bằng chữ/số; kiểm khi lưu cấu hình và khi Test kết nối (`INVALID_STORAGE_CONFIG`, 400). Prefix cũ sai không chặn đọc cấu hình, chỉ báo lỗi khi tạo bucket mới.
  3. Bỏ nhánh fallback/cắt chuỗi (trước đây cắt vào tenantId, có thể trùng tên): tên không hợp lệ -> `STORAGE_BUCKET_NAME_INVALID` (500).
  4. Chống trùng tên: nếu tenant khác đã dùng cùng `storageBucket` thì dùng 16 ký tự đầu; vẫn trùng -> `STORAGE_BUCKET_NAME_CONFLICT` (409). Không thêm unique constraint/migration (ADR-034); race hai request đồng thời được chấp nhận vì 12 ký tự cuid2 ngẫu nhiên.

## ADR-045 — Storage Gateway: giấu storage tự host sau `gieochu.net` bằng vé mã hoá + nginx `auth_request` (2026-10-22)

- **Bối cảnh:** Production chạy trên VPS Ubuntu (Next.js qua pm2, mọi thứ reverse proxy qua nginx, một domain
  `gieochu.net`). MinIO tự host trên cùng máy (ADR-044). Presigned URL hiện trả thẳng cho trình duyệt (tải 302,
  share-link `{url}`, upload PUT) nên làm lộ host/port MinIO, tên bucket `gc-tenant-<tenantId>` (mẫu lúc quyết định; từ 2026-10-23 là `gc-<12 ký tự>`) và tham số `X-Amz-*`,
  đồng thời buộc MinIO mở ra internet. Chủ dự án yêu cầu MinIO chỉ nằm ở tầng dưới, **vẫn giữ provider bên thứ ba
  (R2) hoạt động như cũ**.
- **Quyết định:**
  1. **Chế độ giao theo provider, đặt bằng env hạ tầng:** `STORAGE_GATEWAY_PROVIDERS` (tuỳ chọn, danh sách phân tách
     dấu phẩy, giá trị thuộc `MINIO`, `CLOUDFLARE_R2`). Provider có trong danh sách → giao qua gateway; không có
     (mặc định, máy dev, Vercel) → presigned URL trực tiếp như trước. Dùng env (không phải DB/System Center) vì đây là
     **topo hạ tầng của từng process** (có nginx đứng trước hay không), và dev/prod dùng chung DB (ADR-034) — cấu hình
     trong DB sẽ làm máy dev hỏng theo.
  2. **Vé storage (storage ticket):** server vẫn ký presigned URL nội bộ (endpoint MinIO `http://127.0.0.1:9000`),
     rồi mã hoá AES-256-GCM `{ method, target: pathname+search, exp, maxBytes? }` bằng khoá dẫn xuất HKDF từ
     `STORAGE_ENCRYPTION_KEY` (nhãn riêng, không dùng lại khoá thô). Client nhận URL cùng origin `/_s/<ticket>`.
     `exp` = thời hạn presign (≤600s tải, theo `presignUploadTtlSeconds` khi upload). Mô hình tin cậy giữ nguyên
     presigned URL (bearer ngắn hạn); các bước kiểm quyền/lượt tải/token một lần dùng không đổi.
  3. **nginx `auth_request`:** `location /_s/` gọi nội bộ `GET /api/internal/storage/ticket` (Next.js) kèm
     `X-Original-URI`, `X-Original-Method`, `X-Original-Length`. Vé hợp lệ → 204 + `X-Storage-Target`; nginx
     `proxy_pass` tới `127.0.0.1:9000$target` (Host trùng lúc ký, xoá `Authorization`/`Cookie`, ẩn `x-amz-*`/`Server`,
     không buffer). Byte tải/upload **không đi qua Node**. `/api/internal/` bị nginx chặn với request từ ngoài (404).
     Áp dụng cho: tải theo token (302 → `/_s/...`), tải qua share-link (`{url:"/_s/..."}`), presign upload file sản phẩm
     (đơn + từng part multipart), presign ảnh bìa.
  4. **Ảnh public (bucket `{prefix}public`):** không cần code — đặt `publicBaseUrl` MinIO = `https://gieochu.net/media`,
     nginx `location /media/` chỉ GET/HEAD proxy tới bucket public.
  5. Khoá mạng: MinIO bind `127.0.0.1:9000/9001`, Next.js bind `127.0.0.1:3000`, ufw chỉ mở 22/80/443; console MinIO qua
     SSH tunnel.
- **Không làm:** chế độ stream qua Node (chưa cần — không có nginx thì quay về presigned trực tiếp); không thêm test case
  (trần 94/55 đã chạm, mục 9) — chưa có duyệt nâng trần.
- **Hệ quả:** Bật gateway cho provider nào thì mọi URL mới của provider đó đi qua `/_s/`; URL presigned cũ đã phát ra
  hết hạn trong ≤10 phút. Chỉ khoá cổng MinIO **sau khi** bật gateway và kiểm tra xong. Đổi `host` MinIO sang
  `127.0.0.1` thì app phải chạy cùng máy với MinIO (máy dev dùng SSH tunnel `-L 9000:127.0.0.1:9000`).

## ADR-046 — Nâng cấp trang Đơn hàng Studio (danh sách + chi tiết)

- **Bối cảnh (2026-10-18):** chủ dự án yêu cầu trang `/studio/{slug}/orders` và chi tiết đơn chuyên nghiệp hơn (tham
  khảo WooCommerce). Dữ liệu nghiệp vụ, không có nội dung CMS (PLAN_CHECK: không cần GĐ CMS).
- **Quyết định:**
  1. **Danh sách:** bộ lọc gọn dạng dropdown (trạng thái kèm số đếm, yêu cầu hoàn tiền, khoảng ngày tạo đơn dùng lại
     date range picker ADR-043, sản phẩm), ô tìm theo mã đơn / họ tên / email khách, sắp xếp ngày tạo + tổng tiền,
     **phân trang server** (20/trang, tuỳ chọn 10/20/50/100), URL GET chia sẻ được. Cột: mã đơn (link) · ngày tạo ·
     khách (**họ tên + email** — không SĐT/địa chỉ, giữ ADR-041) · tài liệu · tổng tiền · trạng thái (+ badge hoàn
     tiền) · **Thao tác** (menu: Xem chi tiết, và các thao tác hợp lệ theo trạng thái — dùng lại action có sẵn).
  2. **Chi tiết:** bố cục 2 cột kiểu WooCommerce — cột chính: thông tin chung (mã, ngày tạo/thanh toán giờ VN,
     trạng thái, kênh thanh toán), khách (họ tên, email), bảng dòng tài liệu (giá gốc, giảm giá/mã giảm giá, thành
     tiền), quyền tải (lượt đã dùng/giới hạn, remedy ADR-039); cột phụ: hộp **Thao tác đơn** (xác nhận thanh toán,
     huỷ, đánh dấu đã hoàn, cấp thêm lượt, thu hồi — chỉ hiện thao tác hợp lệ, xác nhận 2 bước), **Lịch sử khách
     tại gian hàng** (tổng đơn, tổng chi tiêu, giá trị đơn TB — chỉ đơn > 0đ đã thanh toán, ADR-043), **Lịch sử
     đơn** (dòng thời gian tự động từ dữ liệu có sẵn: tạo đơn, thanh toán/giao dịch, audit đơn, email đã gửi).
  3. **Không** ghi chú nội bộ (để sau), **không** thao tác hàng loạt (để sau), **không** migration.
  4. Mọi truy vấn L2 qua `withTenant`, chỉ OWNER (như hiện tại); không đổi luật nghiệp vụ của các action tiền.
- **Bổ sung ADR-046 (2026-10-18, Quốc — đính chính theo code):** bảng dòng hiện **đơn giá lúc mua** (DB không lưu giá
  niêm yết gốc); "cấp thêm lượt / thu hồi quyền tải" đặt theo từng dòng tài liệu ở cột chính, hộp "Thao tác đơn" chỉ
  gồm xác nhận / đánh dấu đã hoàn / huỷ. Bộ lọc dùng form GET riêng (`order-filter-form.tsx`). Tìm đơn phân biệt dấu
  (không dấu → BACKLOG).

## ADR-047 — Đơn hàng Studio: tìm không dấu, ghi chú nội bộ; không thao tác hàng loạt

- **Bối cảnh (2026-10-18, chủ dự án chốt):**
  1. **Tìm đơn không dấu:** ô `q` (mã/họ tên/email) so khớp qua `public.gieochu_unaccent(lower(...))` (ADR-035), tham
     số hoá + escape LIKE; kết quả như Cửa hàng.
  2. **Ghi chú nội bộ:** bảng L2 mới `order_notes` (`id`, `tenantId`, `orderId`, `authorId`, `body` ≤1000 ký tự,
     `createdAt`), RLS theo tenant (chỉ scope tenant + system_job; **không** customer/public); chủ gian hàng thêm ghi
     chú, **chỉ xoá ghi chú do mình viết**; không sửa; khách **không bao giờ** thấy; hiện trong "Lịch sử đơn" kèm giờ +
     người viết. Audit `ORDER_NOTE_ADDED/DELETED` (không lưu nội dung trong metadata). Migration expand — chủ dự án chạy.
  3. **Không thao tác hàng loạt** và **không xuất CSV** đơn hàng/khách hàng ra khỏi hệ thống (tạm thời). Huỷ đơn chỉ
     từng đơn.
  4. Dọn `listOrders` / `getOrderDetail` cũ (không còn nơi gọi).

## ADR-048 — Nâng cấp danh sách Khách hàng Studio

- **Bối cảnh (2026-10-18, chủ dự án chốt):** trang `/studio/{slug}/customers` chỉ là bảng 4 cột. Dữ liệu nghiệp vụ,
  không CMS. Chỉ nâng cấp **danh sách** (không trang chi tiết khách).
- **Quyết định:**
  1. **Số liệu khớp ADR-043:** số đơn / tổng chi tiêu / chi tiêu TB tính lại từ `orders` (qua `withTenant`), chỉ đơn
     **> 0đ** có `paidAt`; tổng chi tiêu **gộp** + cột/dòng **"Đã hoàn"** riêng; khách chỉ có đơn 0đ = "chỉ nhận miễn
     phí". Không dựa cột cache `ordersCount/totalSpentVnd` để hiển thị.
  2. **Thẻ thống kê:** tổng khách (+ khách mới trong kỳ), khách quay lại (≥2 đơn > 0đ) + %, tổng chi tiêu (+ đã hoàn),
     chi tiêu TB / khách trả phí, khách chỉ nhận miễn phí.
  3. **Danh sách:** tìm không dấu họ tên/email; dropdown nhóm (tất cả, khách mới trong kỳ, quay lại, chỉ miễn phí, có
     yêu cầu hoàn tiền, **lâu chưa quay lại = không mua 90 ngày**); khoảng ngày (mua lần đầu / mua gần nhất); lọc tài
     liệu đã mua; cột Khách (họ tên + email, không SĐT/tỉnh — ADR-041) · Số đơn · Tổng chi tiêu · Đã hoàn · Mua lần
     đầu · Mua gần nhất · Thao tác (Xem đơn của khách → trang Đơn hàng lọc theo khách; Ghi chú); sắp xếp, phân trang 20.
  4. **Ghi chú khách:** một ô duy nhất, dùng cột có sẵn `tenant_customers.note` (≤500 ký tự, sửa được, chỉ gian hàng
     thấy). Không migration.
  5. Không xuất CSV (ADR-047 mục 3).
- **Bổ sung ADR-048 (2026-10-23, Quốc — đính chính theo code):** ngày mua lần đầu/gần nhất và "lâu chưa quay lại"
  (không có đơn đã thanh toán nào trong 90 ngày) tính **cả lượt nhận miễn phí** (đơn 0đ) — coi là có tương tác. % khách
  quay lại = khách có ≥2 đơn > 0đ / **khách trả phí**. Giới hạn ghi chú 500 ký tự kiểm ở server (không thêm CHECK DB —
  dữ liệu không quan trọng, tránh migration).

## ADR-049 — Môi trường chạy: Vercel để thử nghiệm, VPS cho production

- **Bối cảnh (2026-10-23, chủ dự án xác nhận):** hiện chạy thử trên Vercel; production sẽ chạy trên **VPS** (cùng nơi
  đặt MinIO + Storage Gateway nginx — ADR-044/045).
- **Hệ quả cần làm khi chuyển production sang VPS (chưa làm):** runbook deploy VPS (build/run Next, process manager,
  reverse proxy, TLS, env); cron thay Vercel Cron (crontab gọi `GET /api/cron/daily` với `CRON_SECRET`, có thể dày hơn);
  cân nhắc chạy `worker.ts` thường trực trên VPS thay cơ chế `after()` của ADR-036 (cần ADR riêng). Quy tắc một DB dùng
  chung (ADR-034) vẫn áp dụng cho tới khi có quyết định tách DB.

## ADR-050 — Đợt 1: CMS menu header/footer, trang chủ theo brief + SEO trang chủ, Điều khoản sử dụng có phiên bản

- **Bối cảnh (2026-10-23, chủ dự án chốt):** kế hoạch `docs/ke-hoach-home-legal-menu-seo-2026-10-23.md` (Long) + đề
  xuất UX `docs/de-xuat-ux-home-legal-menu-2026-10-23.md` (Phong). Chủ dự án chỉ duyệt **đợt 1** gồm 3 hạng mục, theo
  thứ tự, mỗi hạng mục **CMS trước, UI sau**:
  1. **CMS menu header/footer** (System Center `/admin/cms/menu`), không migration: lưu bằng `CmsPage` slug hệ thống
     `menu` (mẫu ADR-035, nháp/xuất bản). Header ≤5 mục, schema cho phép menu con **1 cấp** (mặc định không dùng); footer
     1–4 cột; mỗi link: trang có sẵn / nội bộ / ngoài / email, tab mới, ẩn/hiện, Lên/Xuống; nhãn + đích nút CTA header.
     Chưa xuất bản → menu mặc định = menu hiện tại **bỏ các mục không có link**. Desktop + mobile đọc cùng dữ liệu.
     **Sửa ADR-025:** header/footer không còn là chrome cố định — nội dung menu do System Admin cấu hình; bố cục vẫn cố
     định trong code. Năm bản quyền footer lấy theo năm hiện tại (không gõ cứng).
  2. **Trang chủ theo `docs/GIEOCHU_HOMEPAGE_CONTENT_BRIEF.md`**, không migration: mở rộng `home-sections` (thêm
     `steps`, `faq`, `community` thay `testimonials`; CTA phụ; `minToShow` = 3 cho gian hàng/tài liệu nổi bật); nội dung
     mặc định soạn từ brief (token brand, **không số liệu**) khi chưa có bản PUBLISHED; bỏ số liệu/giá/sao gõ cứng
     ("500+", "10.000+", "149.000đ", 5 sao); lời chứng thực cũ **tự ẩn** tới khi admin tích "đã có đồng ý", giai đoạn này
     dùng "nhật ký phát triển"; chữ "miễn phí" chỉ giữ khi thực sự có gói miễn phí. Editor cảnh báo mềm tuyên bố brief §8,
     chặn xuất bản khi lời chứng thực chưa có đồng ý hoặc link không an toàn. **SEO trang chủ:** ô title/description
     (dùng cột có sẵn `CmsPage.seoTitle/seoDescription`) + `generateMetadata`; một bộ giới hạn SEO dùng chung trong
     `@gieochu/core` (tối đa 120/320, cảnh báo mềm 60/160). Chưa làm ảnh OG/noindex/sitemap/robots/JSON-LD (đợt sau).
  3. **Điều khoản sử dụng có phiên bản + ghi nhận chấp thuận**, cần migration expand-only (Hiếu viết, Quốc duyệt,
     chủ dự án chạy): bảng L1 `legal_documents`, `legal_document_versions` (`version Int`, trạng thái
     DRAFT/PUBLISHED/ARCHIVED, `effectiveAt`, `reviewStatus`), `user_legal_acceptances` (userId, versionId, acceptedAt —
     **không lưu IP/User-Agent**). Đợt này chỉ một văn bản `terms` tại `/phap-ly/dieu-khoan-su-dung` (thêm `phap-ly`
     vào slug dành riêng nếu cần + quét slug trùng). Xuất bản bị chặn khi nội dung còn `[[CẦN XÁC NHẬN`. Đăng ký: checkbox
     link tới bản đang hiệu lực và lưu chấp thuận theo phiên bản; chưa có bản PUBLISHED → đăng ký như hiện tại. Người
     dùng cũ **chưa** bị buộc chấp thuận lại (quyết ở giai đoạn pháp lý). Nội dung dự thảo do Long soạn ở
     `docs/legal/drafts/`, thông tin pháp nhân để placeholder.
- **Hoãn sang giai đoạn pháp lý (sau khi hệ thống chạy):** các trang pháp lý khác, trang hub, mở rộng báo cáo vi phạm
  (`abuse_reports`), chấp thuận khi mở gian hàng/xuất bản, công bố bản dự thảo, xoá tài khoản, thông tin pháp nhân.
- **Test:** chủ dự án duyệt nâng trần **+1 unit, +2 integration** (94/55 → 95/57) cho parse menu/section và ghi chấp
  thuận theo phiên bản.
- **Bổ sung ADR-050 (2026-10-23, Quốc — chốt kỹ thuật mục 3 trước migrate):** (a) **không xoá user** (chủ dự án chốt
  2026-10-23): người dùng vi phạm/ngừng dùng chỉ bị **khoá** (deactivate — chặn thao tác, giữ nguyên dữ liệu) để tránh xoá
  nhầm; FK `user_legal_acceptances` → `users` để Cascade chỉ phục vụ dọn dữ liệu test, không có luồng nghiệp vụ xoá user; (b) cho phép nhiều
  bản PUBLISHED, bản hiệu lực = PUBLISHED có `effectiveAt ≤ now` mới nhất (hỗ trợ đặt hiệu lực tương lai); lưu trữ bản cũ là
  thao tác riêng; (c) Xuất bản yêu cầu **cả** `reviewStatus = APPROVED` (admin tích "đã rà soát pháp lý") **và** không còn
  `[[CẦN XÁC NHẬN` — không công bố bản chưa duyệt. Gói FREE thật đang bật (ADR-021) → CTA mặc định giữ "miễn phí".
  `phap-ly` thêm vào `RESERVED_SLUGS` (tenant slug), đã quét DB không trùng.
- **Bổ sung ADR-050 lần 2 (2026-10-23, Quốc — sau review UI):** trang `/phap-ly/[slug]` dùng `container-page` + lưới
  `220px (mục lục) | minmax(0,768px)` — hợp ADR-024 (khung trang vẫn là utility chuẩn, chỉ cột nội dung giới hạn độ
  rộng đọc); không thêm `container-doc`. Lưu trữ bản đang hiệu lực → bản PUBLISHED trước đó (nếu còn) tự hiệu lực lại.
  Ô SEO trang chủ lưu thẳng, không qua nháp (giống Bảng giá) cho tới khi có quyết định khác. Migration ADR-050 đã chạy
  nên không sửa comment trong `migration.sql` (đổi checksum).
- **Bổ sung ADR-050 lần 3 (2026-10-23, chủ dự án duyệt — Hero):** (1) `hero.brandMessage` trống → **không hiển thị**
  (bỏ tự lấy slogan). (2) Hero thêm **thẻ số liệu nổi bật** quanh ảnh, tối đa 3 thẻ, mỗi thẻ chọn 1 trong 4 số liệu thật
  sẵn có của section `stats` (`tenants`, `products`, `sold`, `reviews` — tính từ DB mỗi request qua `getHomeStats()`, chưa có cache), nhãn sửa được, ngưỡng
  tối thiểu (dưới ngưỡng → ẩn thẻ); mặc định 3 thẻ gian hàng / tài liệu / lượt mua, ngưỡng 10, đánh giá tắt. Số hiển thị
  làm gọn ("120+", "1,2K+"). Desktop: thẻ phủ mép ảnh ở các góc; mobile: hàng thẻ dưới ảnh. Không có ảnh → giữ minh hoạ
  CSS. Khung ảnh hero cố định 4:5 (không CLS) — dùng ảnh 1200×1500 px, tỷ lệ khác bị cắt giữa (`object-cover`); WebP/JPEG < 300 KB,
  chừa ~15% mỗi góc. Không migration.
  - **Tinh chỉnh lần 3 (2026-10-23, Quốc):** dấu "+" chỉ khi số đã bị làm tròn xuống (`isStatRounded`/`floorStatValue`,
    sr-only "Hơn" khớp theo); thẻ có giá trị thật **0 luôn ẩn** (kể cả `minValue` = 0, giống ADR-033); ảnh hero trang chủ
    qua `cloudinaryDeliveryUrl` width 1200 (ADR-028); độ tràn thẻ trái ở `xl` (48px) chấp nhận như code.

## ADR-051 — Cơ chế lưu trữ kích hoạt xoá, bảo toàn quyền lợi người mua và dọn dẹp Storage Service

- **Bối cảnh (2026-10-24, chủ dự án chốt):**
  1. Khi người bán thực hiện thao tác **Lưu trữ** (Archive) tài liệu số trong Studio, nếu tài liệu đó chưa từng phát sinh người mua thì kích hoạt tự động xoá vĩnh viễn cả tài liệu và các tệp đính kèm trong Storage Service (MinIO/R2) để giải phóng dung lượng lưu trữ cho gian hàng.
  2. **Bảo toàn quyền lợi người mua:** Tuyệt đối không xoá tài liệu nếu tài liệu đang có người mua (đơn hàng `PENDING`) hoặc đã có người mua (đơn hàng `PAID`, `FULFILLED`, `REFUNDED` hoặc đã cấp `Entitlement`). Lúc này tài liệu chỉ chuyển trạng thái sang `ARCHIVED`, giữ nguyên 100% tệp trên Storage Service để khách hàng đã mua vẫn tiếp tục tải được bình thường.
  3. Bổ sung nút/action **Xoá tài liệu** độc lập (`deleteProductAction`) trong Studio với cùng cơ chế bảo vệ giao dịch và dọn dẹp storage.
- **Quyết định kỹ thuật:**
  1. **Kiểm tra trạng thái mua hàng (`checkProductPurchaseStatus`):**
     - Đang mua: Có đơn hàng `PENDING` chứa sản phẩm -> `canDelete = false`, lý do `HAS_PENDING_ORDERS`.
     - Đã mua: Có đơn hàng `PAID`, `FULFILLED`, `REFUNDED` hoặc có bản ghi `Entitlement` tương ứng -> `canDelete = false`, lý do `HAS_PURCHASE_HISTORY`.
     - Chưa phát sinh đơn: `canDelete = true`.
  2. **Lưu trữ kích hoạt xoá (`archiveProduct`):**
     - Nếu `canDelete = false`: Cập nhật `status = 'ARCHIVED'`, giữ nguyên tệp trong Storage Service, ghi audit log `PRODUCT_ARCHIVED` (metadata `retainedForBuyers: true`).
     - Nếu `canDelete = true`: Kích hoạt `deleteProduct`, xoá sạch bản ghi DB và tệp vật lý trên storage, trả về `isDeleted = true` để UI điều hướng về danh sách sản phẩm.
  3. **Xoá tài liệu & dọn dẹp Storage Service (`deleteProduct`):**
     - Chặn xoá với `PRODUCT_CANNOT_BE_DELETED` (HTTP 400) nếu `canDelete = false`.
     - Đọc danh sách `product_files` của sản phẩm; duyệt từng tệp và gọi `deleteObject()` trên S3 client tương ứng với `storageBucket`/`storageProvider` (MinIO/R2) của từng tệp hoặc cấu hình storage hệ thống.
     - Xoá ảnh bìa nội bộ `coverImageKey` trên public bucket nếu có.
     - Cập nhật trừ dung lượng đã dùng của gian hàng (`tenant.storageUsedBytes -= sum(sizeBytes)`).
     - Xoá cascade dữ liệu DB trong transaction: `downloadEvent`, `downloadToken`, `shareLink`, `review`, `productFile`, gỡ liên kết bài viết (`post.productId = null`) và xoá `product`.
     - Ghi audit log `PRODUCT_DELETED` (bổ sung vào `AUDIT_ACTIONS` và nhãn `Xoá tài liệu`).

## ADR-052 — Giám sát dung lượng bucket thực tế và cơ chế đối soát storage (Storage Reconciliation)

- **Bối cảnh (2026-10-24, chủ dự án chốt):**
  1. Trang quản trị `/admin/settings/storage?tab=buckets` gặp lỗi hiển thị: Cột "Số tệp" đếm nhầm `_count.products` (số sản phẩm) thay vì số lượng tệp thật. Cột dung lượng chỉ đọc tĩnh `tenant.storageUsedBytes`, không phản ánh được tình trạng thực tế của object storage khi có file mồ côi hoặc sai lệch sau di chuyển/đồng bộ dữ liệu giữa MinIO và Cloudflare R2.
  2. Nút "Kiểm tra" trên từng bucket chưa có kết nối thật với hạ tầng MinIO/R2.
- **Quyết định kỹ thuật:**
  1. **Chuẩn hóa thống kê:** Nạp dữ liệu qua `getTenantStorageMonitoringList()`, đếm đúng số tệp `product_files` (`where: { sourceKind: "FILE", removedAt: null }`).
  2. **Hàm quét thống kê S3 (`getBucketStats`):** Bổ sung vào `@gieochu/storage`, duyệt `ListObjectsV2Command` để tính tổng số object và tổng dung lượng bytes thực tế của dedicated bucket hoặc prefix `tenants/<tenantId>/`.
  3. **Cơ chế kiểm tra & đối soát (`inspectTenantBucketAction`, `reconcileTenantStorageAction`):**
     - Cho phép kiểm tra trạng thái sức khỏe, số tệp và dung lượng thực tế trên provider tương ứng (MinIO/R2).
     - Cho phép ghi đè/đồng bộ lại `tenant.storageUsedBytes` theo số liệu thực tế trên storage vật lý khi phát hiện sai lệch.
     - Bổ sung nút "Kiểm tra", nút "Đồng bộ", và nút "Khớp dữ liệu Storage" toàn hệ thống (`reconcileAllTenantsStorageAction`).
     - Hỗ trợ `loading` prop trên `GhostButton` trong bộ UI kit quản trị.

## ADR-053 — Phiên đăng nhập: sửa header cache, "Ghi nhớ đăng nhập", idle/absolute timeout, danh sách thiết bị

- **Bối cảnh (2026-10-24):** header `/pricing`, `/cua-hang` hiện sai trạng thái đăng nhập. Nguyên nhân (Hiếu chẩn
  đoán): layout chứa `SiteHeader` + `loading.tsx` được Next prefetch và tái dùng ~5 phút (staleTimes); login/logout gọi
  Route Handler bằng `fetch` + `router.push/refresh` nên client cache không bị xoá → có thể **lộ tên/email người vừa đăng
  xuất**. Phụ: race refresh nhiều tab bị coi là reuse → đăng xuất toàn bộ; rotation không nguyên tử. Hiện phiên luôn
  persistent, không idle, refresh trượt 7 ngày (vô hạn).
- **Quyết định (chủ dự án chốt 2026-10-24):**
  1. **Sửa ngay (GĐ A, không migration):** sau login/logout điều hướng cứng (`window.location.assign`); refresh có ân hạn
     ~30 giây cho token vừa được thay (không thu hồi family, không xoá cookie) + rotation nguyên tử
     (`updateMany … replacedById: null`); `SessionRefresh` khoá giữa tab, refresh khi tab quay lại, 401 → cập nhật UI;
     route refresh kiểm `user.status`.
  2. **Chính sách phiên (GĐ B):**
     | | Không tick "Ghi nhớ" (mặc định) | Tick "Ghi nhớ" | SYSTEM_ADMIN |
     |---|---|---|---|
     | Cookie refresh | session cookie (đóng trình duyệt = đăng xuất) | persistent tới hết absolute | luôn session cookie (checkbox vẫn hiện vì lúc nhập chưa biết vai trò — server bỏ qua) |
     | Idle (đo ở server) | 60 phút | không áp | 15 phút |
     | Absolute (từ lúc login, không trượt) | 12 giờ | 30 ngày | 8 giờ |
     | Cảnh báo trước idle | 2 phút, nút "Tiếp tục" | — | có |
     Chủ gian hàng và khách mua **cùng** mức. Checkbox "Ghi nhớ" **mặc định tắt**. Người dùng đang thao tác (gõ, bấm, cuộn,
     quay lại tab) = còn hoạt động → không tự đăng xuất. Các con số cấu hình được trong System Settings.
  3. **Soạn thảo luôn tự lưu nháp** (chủ dự án yêu cầu) — Hiếu kiểm hiện trạng các editor; editor nào chưa có thì làm
     thành hạng mục riêng.
  4. **Danh sách thiết bị đăng nhập:** ghi thiết bị + trình duyệt (từ User-Agent) + thời điểm đăng nhập / hoạt động gần
     nhất cho mỗi phiên; trang tài khoản liệt kê và cho đăng xuất từng thiết bị (giữ nút đăng xuất mọi thiết bị). Bản ghi
     phiên hết hạn/đã thu hồi **tự xoá sau 90 ngày** (cron `/api/cron/daily`).
  5. **Test:** được nâng trần theo nhu cầu của module (báo số cụ thể khi xong).
- **Migration (GĐ B, expand-only, chủ dự án chạy):** `refresh_tokens` thêm `rememberMe`, `sessionStartedAt` (+ cột
  thiết bị nếu cần); `system_settings` thêm cột cấu hình phiên.
- **Bổ sung ADR-053 (2026-10-24, chủ dự án chốt):** tự lưu nháp editor **lên server** (không lưu cục bộ trình duyệt —
  tránh nội dung gian hàng nằm trên máy dùng chung). Ưu tiên: bài viết, tài liệu, trang gian hàng (Studio) → các editor CMS
  System Center. Thiết kế chi tiết (nháp tự động vs bản đã lưu, chu kỳ, xung đột nhiều tab) chốt trong kế hoạch riêng
  trước khi code.
- **Bổ sung ADR-053 lần 2 (2026-10-24, Quốc — sau review GĐ B):** cấu hình phiên trong System Settings (và đổi vai trò)
  áp cho **cả phiên đang mở** từ lần refresh kế tiếp — chủ ý vì là thay đổi bảo mật (ngoại lệ của nguyên tắc "chỉ áp cho
  thao tác mới" ADR-032). Phiên tạo trước ADR-053 sau lần refresh đầu thành phiên **không ghi nhớ** (cookie session, idle
  60 phút) — chấp nhận; người dùng muốn giữ thì đăng nhập lại có tick "Ghi nhớ". Cron dọn token chỉ chạy khi có lịch gọi
  `/api/cron/daily` — trên VPS cần crontab (việc chờ của ADR-049).
- **Bổ sung ADR-053 lần 3 (2026-10-24, chủ dự án duyệt — thiết kế tự lưu nháp):** chi tiết ở
  `docs/ke-hoach-tu-luu-nhap-2026-10-24.md`. Chốt: 2 bảng nháp riêng theo layer — `tenant_editor_drafts` (L2, RLS chỉ
  `tenant` + `system_job`) và `system_editor_drafts` (L1, chỉ SYSTEM_ADMIN); nháp **theo từng người dùng**; autosave không
  bao giờ ghi vào bản đã lưu/live; debounce 3 giây, tối đa 30 giây/lần, lưu khi rời tab; xung đột → tab đó dừng autosave và
  cho chọn tải bản mới / ghi đè; khôi phục bằng banner "Khôi phục / Bỏ"; Lưu/Xuất bản xoá nháp; nháp không động tới quá
  **30 ngày** tự xoá (cron); tenant READ_ONLY/LOCKED **không** autosave; không lưu khi đóng tab (giữ cảnh báo
  `beforeunload`); không autosave cho form JSON thô `cms-page-form` (làm sau khi có draft/live); cảnh báo "bản đã lưu bị sửa
  nơi khác" cho nút Lưu là hạng mục riêng sau. Không ghi audit mỗi lần autosave. Thứ tự: bài viết → tài liệu → trang gian
  hàng → CMS home/shop/pricing/menu → pháp lý → cron.

## ADR-054 — Trang pháp lý đợt 2: 6 văn bản mới, URL cấp gốc thân thiện, ghi nhận đồng ý mở rộng

- **Bối cảnh (2026-10-24):** kế hoạch `docs/ke-hoach-trang-phap-ly-dot-2-2026-10-24.md` + dự thảo `docs/legal/drafts/`
  (Long). Hạ tầng văn bản có phiên bản đã có từ ADR-050.
- **Quyết định (chủ dự án chốt 2026-10-24):**
  1. **URL cấp gốc**, bỏ tiền tố `/phap-ly/` (chủ dự án: khó nghe). Mỗi văn bản một URL thân thiện:
     `/dieu-khoan-su-dung`, `/chinh-sach-bao-mat`, `/chinh-sach-noi-dung`, `/cam-ket-ban-quyen`,
     `/quyen-su-dung-tai-lieu`, `/chinh-sach-nguoi-ban`, `/lien-he`. Các slug này (và `phap-ly`) vào `RESERVED_SLUGS`
     tenant + quét DB không trùng. `/phap-ly/{slug}` cũ → redirect 308 sang URL mới. **Không có trang tổng hợp (hub).**
     Sửa ADR-050 mục 3 (URL `/phap-ly/dieu-khoan-su-dung`).
  2. **6 văn bản mới** (ngoài `terms`): `privacy`, `content_policy`, `copyright` (tách riêng khỏi chính sách nội dung),
     `usage_license`, `seller`, `contact` (soạn tay như một văn bản). Hoàn tiền giữ trong Điều khoản (không tách trang).
  3. **Xuất bản từng văn bản** khi điền đủ placeholder + tích đã rà soát (cổng ADR-050 giữ nguyên). Văn bản chưa có bản
     hiệu lực → 404 và tự ẩn khỏi menu.
  4. **SEO + mô tả ngắn sửa trong CMS** (cột mới trên `legal_documents`, migration expand-only).
  5. **Ghi nhận đồng ý theo phiên bản:** đăng ký ghi cả Điều khoản **và** Chính sách bảo mật (bản hiệu lực); mở gian hàng
     có **checkbox** đồng ý Chính sách người bán, ghi `user_legal_acceptances`. Văn bản chưa có bản hiệu lực → bỏ qua như cũ.
  6. **Footer mặc định thêm cột "Thông tin"** (không đặt tên "Pháp lý") chứa các văn bản đã có bản hiệu lực; menu CMS có
     loại link "văn bản pháp lý" tự ẩn khi văn bản chưa hiệu lực.
  7. **Link trong văn bản:** link nội bộ mở cùng tab, link ngoài mở tab mới (`rel="noopener noreferrer"`).
  8. **Nhật ký tải (`download_events`, có IP) lưu 12 tháng** rồi tự xoá trong cron hằng ngày.
  9. Không ghi cam kết "không bán dữ liệu cá nhân" ở đợt này (để luật sư duyệt). Hai vấn đề bắt buộc qua luật sư: chính
     sách "chỉ khoá, không xoá user" so với quyền yêu cầu xoá dữ liệu; danh mục nội dung bị cấm.

## ADR-055 — MinIO qua HTTPS bằng tên miền riêng (s3.<domain>), CSP cho phép đúng origin storage

- **Bối cảnh (2026-10-25):** upload file thất bại trên Vercel: CSP `connect-src 'self' https://api.cloudinary.com` chặn PUT
  presigned; MinIO đang ở `http://84.247.143.153:9000` → trang HTTPS gọi HTTP bị chặn mixed content dù CSP cho phép. Do một
  DB dùng chung (ADR-034), cấu hình storage (ADR-044) áp cho cả Vercel lẫn VPS. Storage Gateway (ADR-045) chỉ dùng được
  trên VPS (Vercel không vào được MinIO nội bộ); mẫu nginx gateway ký theo Host `127.0.0.1:9000`, lệch endpoint trong DB.
- **Quyết định (chủ dự án chốt 2026-10-25):** phương án A — đưa MinIO ra **HTTPS qua tên miền riêng** `s3.<domain>` (vd
  `s3.gieochu.net`, chờ chốt tên): DNS → VPS, nginx TLS (Let's Encrypt) proxy vào MinIO `127.0.0.1:9000`, CORS bucket cho
  origin app, **đóng cổng 9000** ra internet; System Center đổi Host `s3.<domain>`, Port 443, useSSL bật. Bản ghi DNS để
  **DNS only** (không proxy Cloudflare — gói free giới hạn 100 MB/upload, hệ thống cho 500 MB). Chưa cần CDN. Code: biến môi
  trường tuỳ chọn liệt kê **chính xác** origin storage (chỉ `https://`, không wildcard, validate zod) nối vào `connect-src`
  (và `img-src` nếu cần) trong `proxy.ts`; không đọc DB trong proxy. Gateway (ADR-045) giữ làm tuỳ chọn sau cho VPS.
- **Phân công:** hạ tầng VPS (DNS, nginx, chứng chỉ, CORS, firewall) — Vương (`docs/yeu-cau-vuong-minio-https-2026-10-25.md`);
  code CSP/env — Hiếu sau khi Vương xác nhận tên miền.

## ADR-056 — System Center: lịch sử hoá đơn gói + trang Thuê bao; QR chuyển khoản tải được + thông tin chuyển khoản tay

- **Bối cảnh (2026-10-25):** chủ dự án báo System Center "không ghi lại" thuê bao/hoá đơn. Hiếu chẩn đoán: dữ liệu đúng
  (1 subscription CREATOR ACTIVE, 1 invoice MANUAL_QR PAID); trang Hoá đơn chỉ liệt kê MANUAL_QR **PENDING**
  (`listPendingManualInvoices`), và không có trang liệt kê thuê bao.
- **Quyết định (chủ dự án chốt 2026-10-25):**
  1. Trang **Hoá đơn** có 2 tab: "Chờ đối soát" (giữ như hiện tại, nút xác nhận đã thu) và "Tất cả" (mọi trạng thái/cổng,
     lọc trạng thái + cổng, phân trang).
  2. Trang mới **`/admin/subscriptions`** (menu Kinh doanh → Thuê bao): gian hàng, gói, trạng thái, chu kỳ, hạn gia hạn,
     hoá đơn gần nhất; lọc gói/trạng thái; sắp xếp theo ngày hết hạn. Dữ liệu L1 (subscriptions/invoices) — đúng §7.9.
  3. Menu "Thanh toán nền tảng" đổi thành **"Cấu hình thanh toán"**.
  4. Chuyển khoản thủ công (cả thanh toán gói lẫn checkout tài liệu): nút **"Tải ảnh QR"** + khối thông tin chuyển khoản tay
     (ngân hàng, số TK, tên chủ TK, số tiền, nội dung CK = mã đơn) có nút sao chép.
- **Không xoá** 27 dòng audit `SUBSCRIPTION_PAID` giả do integration test để lại — `audit_logs` append-only (ADR-037).
- **Bổ sung ADR-056 (2026-10-25, chủ dự án chốt):** (a) mục menu của `/admin/subscriptions` đặt tên **"Đơn hàng"** (Kinh
  doanh → Đơn hàng; tiêu đề trang ghi rõ là đơn hàng gói dịch vụ — dữ liệu L1, không phải đơn hàng của tenant, §7.9 giữ
  nguyên). (b) **Mã giảm giá và QR:** khuyến khích áp mã trước khi chọn cách thanh toán; nếu áp mã **sau** khi đã có QR thì
  server **tạo lại** `checkoutPayload` (QR + số tiền) theo tổng mới và khối thanh toán tải lại — không bao giờ để QR lệch
  `totalVnd`. Chặn áp/gỡ mã khi đơn đã PAID/huỷ/hết hạn.
- **Bổ sung ADR-056 lần 2 (2026-10-25, chủ dự án):** **tạm chưa xử lý MoMo** cho trường hợp đổi mã giảm giá sau khi đã tạo
  link MoMo (MoMo có thể từ chối `orderId` trùng — chưa thử với MoMo thật). Hành vi hiện tại giữ nguyên: báo lỗi
  `CHECKOUT_CREATE_FAILED`, đơn không đổi (an toàn về tiền). Xem lại khi làm MoMo.

## ADR-057 — Nạp 7 dự thảo chính sách vào CMS, xem trước, công bố "Bản dự thảo"; đổi tên "Chính sách sử dụng"

- **Bối cảnh (2026-10-25):** 7 dự thảo (`docs/legal/drafts/*.md`, ADR-050/054) chưa nằm trong CMS nên trang soạn trống. Chủ
  dự án muốn quản lý toàn bộ trong CMS (soạn, xem nháp, xem trước, xuất bản) và cho khách hàng tham khảo trước khi hoàn tất
  thông tin pháp nhân / rà soát.
- **Quyết định (chủ dự án chốt 2026-10-25):**
  1. **Nạp bằng script (phương án C):** chuyển 7 dự thảo Markdown → HTML đã sanitize (chỉ phần nội dung; bỏ khối dẫn đầu
     file và "ghi chú nội bộ"), tạo **bản nháp (DRAFT)** cho từng văn bản trên DB dùng chung — không xuất bản. Có chế độ
     chạy thử (dry-run); idempotent (bản nháp trống sẵn có thì điền vào, đã có nội dung thì tạo phiên bản mới, không ghi đè).
  2. **Xem trước:** trang xem trước chỉ SYSTEM_ADMIN, hiển thị phiên bản nháp đúng giao diện trang công khai, noindex.
  3. **Công bố "Bản dự thảo":** cho xuất bản khi admin tích "Công bố dạng bản dự thảo", bỏ qua cổng placeholder +
     "đã rà soát". Trang công khai có nhãn "Bản dự thảo — đang hoàn thiện"; dấu `[[CẦN XÁC NHẬN: …]]` hiển thị
     "(đang cập nhật)". **Bản dự thảo không dùng để ghi nhận đồng ý** (đăng ký / mở gian hàng chỉ ghi khi có bản chính
     thức). Bản chính thức vẫn qua cổng ADR-050 (APPROVED + không placeholder). Cần migration expand-only (cờ trên
     `legal_document_versions`).
  4. **Đổi tên:** menu + tiêu đề trang soạn "Văn bản pháp lý" → **"Chính sách sử dụng"**; văn bản `contact` "Liên hệ và
     thông tin pháp lý" → **"Liên hệ và thông tin đơn vị vận hành"**; ô tích "Đã rà soát pháp lý" → **"Đã rà soát nội
     dung"**. Đường dẫn admin `/admin/cms/phap-ly` giữ nguyên.
- **Bổ sung ADR-057 (2026-10-25, chủ dự án chốt):** script đã nạp 7 bản nháp. **Ẩn phiên bản khỏi giao diện**: mỗi văn bản
  chỉ hiện MỘT nội dung — soạn → Lưu nháp / Xem trước / Xuất bản, hiện "Cập nhật lúc …". Phía sau vẫn giữ phiên bản (mỗi
  lần Xuất bản tự tạo một bản PUBLISHED bất biến) để làm bằng chứng đồng ý (ADR-050); bản nháp làm việc tự tạo từ bản
  mới nhất khi sửa tiếp. Không migration cho phần này. **Bố cục editor** thống nhất với các module soạn nội dung khác:
  nội dung bên trái, sidebar chức năng bên phải (trạng thái, thời gian cập nhật, rà soát, công bố dạng dự thảo, ngày hiệu
  lực, Lưu nháp/Xem trước/Xuất bản), khối "Tối ưu SEO" **bên dưới nội dung, thu gọn/mở rộng được**.

## ADR-058 — Điều hướng tab theo chức năng + accordion cho trang cấu hình (System Center, Studio)

- **Bối cảnh (2026-10-25):** kế hoạch `docs/ke-hoach-toi-uu-layout-tab-accordion-2026-10-25.md` (Phong). Chủ dự án chốt:
  1. Tab ngang đầu trang chỉ gom **trang con cùng một chức năng**; không dropdown khi nhóm chỉ 2–3 tab. URL giữ nguyên.
  2. **Trang CMS** = 2 tab: **Trang chủ** (mặc định) · **Header & Footer**. Cửa hàng, Bảng giá, Chính sách sử dụng,
     Danh mục giữ mục riêng.
  3. **Cấu hình chung** gom thêm tab **Email hỗ trợ** và **Cấu hình Email (SMTP)**. **Không** gom Lưu trữ & Cloudinary.
  4. Accordion chỉ cho trang có nhiều khối/khối tuỳ chọn; không áp cho trang ngắn. Mặc định **khối đầu tiên mở**, các
     khối khác thu gọn. Khối **SEO luôn thu gọn** ở mọi editor, kiểu section của Rank Math (tiêu đề + badge trạng thái
     "Tất cả đều tốt"/"N lỗi"/"Có thay đổi" + chevron). Trang thanh toán: cổng **đang bật mở**, cổng tắt thu gọn.
  5. **Cảnh báo rời trang khi chưa lưu** (kể cả bấm tab/sidebar — điều hướng client) làm ngay ở giai đoạn 0.
  6. Studio áp cùng quy tắc (chỉ gom trang/khối cùng chức năng). Không làm trang tài khoản khách hàng.
  7. Thực hiện **từng task nhỏ**, mỗi task duyệt rồi mới làm task sau.
- **Bổ sung ADR-058 (2026-10-25, chủ dự án chốt):** (a) các trang CMS tuỳ chỉnh (`/p/[slug]`: giới thiệu, liên hệ…) có mục
  sidebar riêng **Nội dung → "Trang tuỳ chỉnh"** (danh sách `/admin/cms`, **ẩn các slug hệ thống** home/menu/shop/pricing);
  "Trang CMS" chỉ gồm 2 tab Trang chủ · Header & Footer. (b) Studio — trang sửa tài liệu **giữ nguyên, không thêm tab**,
  chỉ áp accordion cho các khối. (c) Migration ADR-057 (`isDraftRelease`) đã chạy 2026-10-25.

## ADR-059 — Chuẩn bị chạy thử (beta): thanh toán đủ phương thức, email báo, MoMo cá nhân thủ công

- **Bối cảnh (2026-10-25):** đề xuất `docs/de-xuat-chay-thu-thanh-toan-goi-tai-lieu-2026-10-25.md` (Long). Chủ dự án chốt:
  1. **Beta chạy trên VPS** (production, ADR-049); Vercel giữ để thử chức năng mới.
  2. **Đủ phương thức thanh toán**, ưu tiên **chuyển khoản QR thủ công**. **SePay hoàn thiện ngay giai đoạn này** (cả thu
     phí gói lẫn gian hàng). **MoMo đổi sang dạng cá nhân, xác nhận tay** như chuyển khoản QR (khách chuyển qua app MoMo,
     nội dung = mã đơn; người bán/admin bấm xác nhận). MoMo API (partner code/secret) **tạm ẩn**, giữ code để làm sau.
  3. **Email báo** (Hiếu làm): đơn chờ xác nhận tay → báo **người bán** (email chủ gian hàng); hoá đơn gói chờ đối soát →
     báo **admin** về địa chỉ lấy **động** từ trường "Email hỗ trợ" trong System Settings (không hard-code). Thêm nút
     **xác nhận tay hoá đơn đã hết hạn** (có audit).
  4. **Gói Free:** không hard-code hạn mức beta — System Admin tự chỉnh trong `/admin/plans` khi cần.
- **Việc kéo theo:** màn hình admin xem giao dịch SePay chưa khớp (sai tiền/không tìm thấy hoá đơn) và xác nhận tay;
  thử một giao dịch SePay thật nhỏ trước khi mở; nhập lại cấu hình SePay nền tảng (lần lưu đầu tự tắt — ADR-013, phải lưu 2 lần).
- **Bổ sung ADR-059 (2026-10-25, chủ dự án chốt):** xác nhận tay hoá đơn gói **EXPIRED** (MANUAL_QR): (1) **chặn** nếu gian
  hàng đã có hoá đơn tạo sau hoá đơn này đang PENDING hoặc PAID — admin hoàn tiền ngoài hệ thống; (2) khi xác nhận, **tính
  lại kỳ** theo thời điểm xác nhận (`computeRenewalPeriod(now, currentPeriodEnd, plan)`), không dùng kỳ đã lưu; (3) vẫn
  tính là "lần thanh toán gói đầu tiên" cho hoàn tiền 7 ngày (ADR-041), **ngày thanh toán = lúc admin xác nhận**. Audit ghi
  rõ hoá đơn đã hết hạn. Email báo người bán/admin (B1) đã xong.
- **Bổ sung ADR-059 lần 2 (2026-10-25, chủ dự án chốt — SePay):** (a) giao dịch **thiếu tiền → chặn** xác nhận tay; **thừa
  hoặc đúng tiền → cho xác nhận** (hộp xác nhận, gắn giao dịch vào hoá đơn — mỗi giao dịch chỉ dùng 1 lần, audit ghi số
  chênh; phần thừa admin hoàn ngoài hệ thống). (b) hoá đơn SePay **hết hạn** mà có giao dịch khớp đúng tiền → cho xác nhận
  trễ theo **cùng luật** bổ sung ADR-059 (chặn nếu có hoá đơn mới hơn, tính lại kỳ). (c) **Tiền tố chuyển khoản do admin/
  người bán tự điền** cho phù hợp cấu hình SePay — không khoá; hệ thống phải bảo đảm mã sinh ra dùng đúng tiền tố đã cấu
  hình (hoặc cảnh báo rõ khi lệch) để không bao giờ "không khớp" vì cấu hình. (d) Studio có danh sách **"Giao dịch cần xử
  lý"** (không tìm thấy đơn, sai tiền) + **email báo chủ gian hàng** khi có giao dịch sai tiền.

- **Bổ sung ADR-059 lần 3 (2026-10-26, chủ dự án chốt — B3 MoMo cá nhân, đề xuất của Hiếu):** (1) MoMo cá nhân dùng cho
  **cả** thu phí gói (platform) lẫn bán tài liệu (gian hàng). (2) **Phương án B:** provider mới `MOMO_MANUAL` (migration chỉ
  `ALTER TYPE "PaymentProviderId" ADD VALUE`), xác nhận tay như MANUAL_QR (`isManualConfirmProvider`), bật song song được với
  chuyển khoản ngân hàng. (3) **MoMo API giữ nguyên** cấu hình và code, để trạng thái tắt — không xoá, không tự sửa dữ liệu
  (thay quyết định "tạm ẩn" ở mục 2). (4) Trang thanh toán hiện **ảnh QR MoMo + thông tin tài khoản MoMo** (số điện thoại,
  tên chủ ví) để khách đối chiếu khi quét; **nội dung chuyển khoản tự sinh từ mã đơn/hoá đơn** (cùng luật tiền tố). Nếu
  kiểm thử cho thấy VietQR không trỏ được tới ví MoMo → dự phòng theo đề xuất (F1: số điện thoại + tên + số tiền + nội dung,
  nút sao chép) — chi tiết ảnh QR ở nhánh dự phòng chốt sau kiểm thử. (5) Thông tin MoMo của người bán **công khai ở trang
  thanh toán** và phải được ghi rõ trong trang chính sách (người bán). (6) **Chủ dự án tự kiểm thử thật** (lưu QR "Nhận tiền",
  giải mã, chuyển thử 1.000đ) trước khi Hiếu code.

## ADR-060 — Trang tuỳ chỉnh (`/p/[slug]`) hiển thị Markdown + thay biến `{brand}`

- **Bối cảnh (2026-10-26):** 3 dự thảo hướng dẫn khách hàng (`docs/du-thao-huong-dan/`, Long) cần tiêu đề, danh sách, bảng,
  liên kết; khối `richText` của trang tuỳ chỉnh hiện chỉ in chữ thuần và không thay tên thương hiệu. Chủ dự án chọn
  **phương án (a)**: nâng cấp hiển thị thay vì nhập chữ thuần.
- **Quyết định:** khối chữ của trang tuỳ chỉnh được hiển thị như Markdown (dùng lại bộ hiển thị/làm sạch HTML đang dùng cho
  trang pháp lý nếu có — không cho HTML thô/script từ nội dung), và thay `{brand}` bằng tên lấy từ `getEffectiveBrand()`.
  Nội dung cũ là chữ thuần vẫn hiển thị đúng. Không đổi schema. Dự thảo dùng `{brand}` (đổi từ `{Tên nền tảng}`).

## ADR-061 — Luồng mua của khách: đơn chờ thanh toán, thông báo, email (chốt một phần)

- **Bối cảnh (2026-10-26):** phân tích `docs/phan-tich-gio-hang-don-cho-48h-2026-10-26.md` (Hiếu). Chủ dự án chốt:
  - **Q2:** trang tài liệu chỉ một nút **"Mua ngay"** → trang thanh toán.
  - **Q5:** giữ cửa sổ người bán **xác nhận trễ 24 giờ** sau hạn đơn.
  - **Q6:** giới hạn mã giảm giá "mỗi khách" tính cả đơn chờ còn hiệu lực của khách; giới hạn tổng **không** giữ chỗ.
  - **Q7:** email cho khách lúc chọn cách thanh toán (thông tin chuyển khoản + nút về trang thanh toán) + **1 lần nhắc** khi
    còn ≤ 24 giờ (cron hằng ngày sẵn có).
  - **Q8:** thông báo "Anh/Chị {name} có đơn cần thanh toán để hoàn tất đơn hàng!" **chỉ ở header khu vực Tài khoản**.
  - **Q9:** người bán **không** nhận email tổng hợp; chỉ email khi có đơn mới và khi đơn thanh toán thành công.
  - **Q10:** khách **được đổi phương thức thanh toán** của đơn đang chờ → email báo người bán phải chống sót/trùng (cột đánh
    dấu trên `orders`, migration nhỏ).
  - **Q12:** email "thanh toán thành công" có nút "Tải tài liệu" trỏ **Thư viện** (bắt buộc đăng nhập), không link tải trực tiếp.
  - **Q13:** hạn giữ đơn **72 giờ** cho chuyển khoản ngân hàng thủ công và MoMo thủ công.
- **Chốt tiếp (2026-10-26):**
  - **Q1 — mua không cần đăng ký trước:** khách chưa đăng nhập điền Họ tên + Email + ô xác nhận thông tin/đồng ý Điều
    khoản ở trang thanh toán → hệ thống tạo tài khoản và cho thanh toán ngay trên phiên đó; gửi email **"Kích hoạt tài
    khoản và đặt mật khẩu"** (token một lần, lưu hash — vừa xác minh email vừa đặt mật khẩu). **Không** gửi mật khẩu qua
    email. Sau thanh toán: tải được ngay trên phiên đó; đăng nhập lại/thiết bị khác cần kích hoạt qua email. Email đã có
    tài khoản → yêu cầu đăng nhập, không tự gắn đơn. Thay quy tắc "tài khoản chưa xác minh không có phiên" (ADR-053) cho
    riêng trường hợp này; cần chống lạm dụng (rate limit tạo tài khoản/gửi email).
  - **Q3 — không làm Giỏ hàng** trong beta; vai trò giữ đơn chưa trả do danh sách "Đơn chờ thanh toán" trong Tài khoản +
    thông báo header + email nhắc đảm nhận. Q4: mỗi đơn 1 tài liệu, hoàn cả đơn. Q11: bỏ.
  - **Q9:** email người bán khi có **đơn thủ công chờ xác nhận** và khi **thanh toán thành công** (kể cả SePay); không gửi
    cho đơn khách tạo rồi bỏ (chưa chọn cổng).
  - **Q13 + Q5 (sửa):** hạn giữ đơn theo phương thức — **thủ công (ngân hàng, MoMo): 72 giờ; SePay: 48 giờ**. **Không cộng
    thêm cửa sổ xác nhận trễ 24 giờ** — thay quyết định Q5 ở trên. Giao dịch SePay đến sau hạn hiện ở "Giao dịch cần xử lý".

## ADR-062 — Layout trang thanh toán đơn tài liệu (`/{tenantSlug}/checkout/...`)

- **Bối cảnh (2026-10-26):** đề xuất `docs/de-xuat-layout-checkout-tai-lieu-2026-10-26.md` (Phong), tham khảo 2 ảnh mẫu
  của chủ dự án. Chủ dự án **đồng ý toàn bộ** Q1–Q12, trừ **Q6 (liên hệ người bán) — hoãn**.
- **Quyết định:**
  - **Q1:** nút **"Tôi đã chuyển khoản"** (chỉ cổng xác nhận tay) lưu thời điểm khách báo đã chuyển (cột mới, **không** đổi
    `OrderStatus`), trang chuyển "Chờ người bán xác nhận", gửi **1 email** người bán "Khách báo đã chuyển đơn {mã}", Studio
    ưu tiên đối soát; khách hoàn tác được. (Bổ sung danh sách email người bán ở ADR-061 Q9.)
  - **Q2:** khách vãng lai — đơn tạo khi bấm "Tiếp tục thanh toán" sau khi điền form, không tạo lúc "Mua ngay"; trang trước
    đó `/{tenantSlug}/checkout?tai-lieu={slug}`.
  - **Q3:** hạn giữ đơn = **lúc đặt đơn + hạn của phương thức đang chọn** (thủ công 72 giờ, SePay 48 giờ); đổi phương thức
    không gia hạn; chưa chọn phương thức = 72 giờ.
  - **Q4:** khách **tự huỷ** được đơn đang chờ (có hộp xác nhận).
  - **Q5:** desktop **2 cột** trong `container-page` (cột phải 22rem dính) — ngoại lệ của `container-narrow` (ADR-024).
  - **Q7:** sau khi trả, "Tải tài liệu" → Thư viện, trỏ tới tài liệu vừa mua.
  - **Q8:** SePay hiển thị cho khách là "Chuyển khoản (xác nhận tự động)".
  - **Q9:** không logo NAPAS/ngân hàng trong beta — tên ngân hàng bằng chữ.
  - **Q10:** mobile trang khách đặt **QR trước** các dòng sao chép; Studio billing giữ thứ tự cũ.
  - **Q11:** khách vãng lai **1 ô** "xác nhận thông tin chính xác và đồng ý Điều khoản", không tick sẵn.
  - **Q12:** dưới thông tin MoMo có link "Chính sách thanh toán của {gian hàng}".
  - Không dùng popup cho MoMo; số tiền màu `ink` (không đỏ); timeline 4 bước; thanh hành động dính đáy trên mobile.

- **Bổ sung ADR-062 (2026-10-26, chủ dự án chốt — đợt 1 luồng mua, migration `20261026180000_adr061_purchase_flow`):**
  1. Phiên khách vãng lai (`refresh_tokens.guestCheckout`): idle/absolute như ADR-053, không "ghi nhớ", **absolute tối đa
     24 giờ**; chỉ vào checkout, `/account/orders`, `/account/library`, API tải (`requireCheckoutAccess`).
  2. Khách vãng lai tải theo đúng `downloadLimit` của tài liệu, không giới hạn riêng.
  3. **Tiền — ngoại lệ của "không xác nhận trễ" (ADR-061):** đơn cổng xác nhận tay đã EXPIRED vẫn được người bán xác nhận
     **nếu khách đã bấm "Tôi đã chuyển khoản" trước hạn** (`customerDeclaredPaidAt < expiresAt`); có audit.
  4. Email đã thuộc tài khoản guest chưa kích hoạt → báo "Email này đã được dùng — đăng nhập hoặc gửi lại email kích hoạt";
     không gắn đơn, không tạo phiên mới.
  5. Token `GUEST_ACTIVATION` sống **7 ngày**, gửi lại được (huỷ token cũ), chỉ lưu hash, dùng một lần.
  6. Email cho khách khi đổi phương thức: gửi lại khi phương thức khác lần đã gửi, **tối đa 3 email/đơn**.
  7. Rate limit (bảng `rate_limit_counters`, khoá đã băm): tạo tài khoản guest 5/IP/giờ, 3/email/ngày; gửi lại email kích
     hoạt 3/email/giờ.
  8. Ô đồng ý duy nhất ghi nhận **Điều khoản + Chính sách bảo mật** bản hiệu lực (`UserLegalAcceptance`), câu chữ nêu cả hai.

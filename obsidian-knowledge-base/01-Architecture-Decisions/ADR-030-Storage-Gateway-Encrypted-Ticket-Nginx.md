---
tags:
  - adr
  - storage
  - security
  - deployment
  - status/accepted
date: 2026-10-22
status: Accepted (Chốt — Áp dụng chính thức)
---

# 🏛️ ADR-030: Storage Gateway — giấu storage tự host sau `gieochu.net` bằng vé mã hoá + nginx `auth_request`

## 1. Trạng Thái (Status)
**ĐÃ PHÊ DUYỆT (Accepted)** — tương ứng **ADR-045** trong [`docs/DECISIONS.md`](../../docs/DECISIONS.md) (2026-10-22).
Bản trích ghi vào thư mục này theo duyệt của Quốc (brief 2026-10-22).

Tiến độ (2026-10-22): xong code ✅ `git status`; **đã commit `4ab5a3b`** (vuong, 2026-10-22 ✅ `git log`), deploy ❓ (file mới `packages/core/src/crypto/storage-ticket.ts`,
`apps/web/lib/storage-gateway.ts`, `apps/web/app/api/internal/storage/ticket/route.ts`, `docker/nginx/gieochu-storage-gateway.conf.example`;
sửa `packages/config/src/env.ts`, `lib/{download,share-link,product-upload}.ts`, `api/downloads/[token]/route.ts`, `.env.example`).
Không migration, không đổi schema. Không thêm test case — `pnpm test:count` = **94/94 unit, 55/55 integration** ✅ (Long chạy 2026-10-22, chỉ đếm).

Mức xác minh: ✅ Long đã đối chiếu code working tree (2026-10-22) · 🟡 theo `docs/DECISIONS.md`/brief của Quốc · ❓ cần môi trường thật (VPS + nginx).

---

## 2. Bối Cảnh (Context) 🟡
Theo ADR-045: production chạy trên **VPS Ubuntu** (Next.js qua pm2, nginx reverse proxy, một domain `gieochu.net`), MinIO tự host cùng máy
(ADR-044). Presigned URL trả thẳng cho trình duyệt (302 tải, `{url}` share-link, PUT upload) làm lộ host/port MinIO, tên bucket
`gc-tenant-<tenantId>` (mẫu tên lúc ra quyết định; từ 2026-10-23 gian hàng mới dùng `gc-<12 ký tự đầu tenantId>`), tham số `X-Amz-*`, và buộc MinIO mở ra internet. Chủ dự án yêu cầu MinIO chỉ ở tầng dưới, **R2 vẫn hoạt động như cũ**.

> ❓ Mô tả "production chạy trên VPS" khác với phần KB còn lại (Vercel — [[01-Architecture-Decisions/ADR-017-Vercel-Deploy-Build-Without-Env|ADR-017 (≙ ADR-031)]],
> [[01-Architecture-Decisions/ADR-022-Background-Jobs-After-And-Daily-Cron|ADR-022 (≙ ADR-036)]] Vercel Cron). Đã ghi câu hỏi cho Quốc trong
> [[00-Index/KB-Audit-2026-09-26|KB-Audit]] §27 — KB chưa đổi mô tả hạ tầng deploy.

---

## 3. Quyết Định (Decision) — theo `docs/DECISIONS.md`
1. **Chế độ giao theo provider, bằng env hạ tầng** `STORAGE_GATEWAY_PROVIDERS` (tuỳ chọn; danh sách phân tách dấu phẩy, giá trị `MINIO`,
   `CLOUDFLARE_R2`). Provider có trong danh sách → giao qua gateway; không có (mặc định, máy dev, Vercel) → presigned URL trực tiếp như trước.
   Dùng env (không phải DB/System Center) vì đây là **topo hạ tầng của từng process** và dev/prod dùng chung DB (ADR-034).
2. **Vé storage:** server vẫn ký presigned URL nội bộ, rồi mã hoá AES-256-GCM `{ method, target, exp, maxBytes? }` bằng khoá dẫn xuất HKDF
   từ `STORAGE_ENCRYPTION_KEY`. Client nhận URL cùng origin `/_s/<vé>`. Hạn vé = hạn presign. Mô hình tin cậy giữ nguyên presigned URL
   (bearer ngắn hạn); kiểm quyền/lượt tải/token một lần không đổi.
3. **nginx `auth_request`:** `location /_s/` gọi nội bộ `GET /api/internal/storage/ticket` kèm `X-Original-URI/Method/Length`; hợp lệ → 204 +
   `X-Storage-Target`, nginx `proxy_pass` tới `127.0.0.1:9000$target`. Byte tải/upload **không đi qua Node**. `/api/internal/` bị nginx chặn
   từ ngoài (404). Áp dụng cho: tải theo token, tải qua share-link, presign upload file sản phẩm (đơn + từng part), presign ảnh bìa.
4. **Ảnh public** (bucket `{prefix}public`): không cần code — `publicBaseUrl` MinIO = `https://gieochu.net/media`, nginx `location /media/` chỉ
   GET/HEAD.
5. **Khoá mạng:** MinIO bind `127.0.0.1:9000/9001`, Next.js bind `127.0.0.1:3000`, ufw chỉ mở 22/80/443; console MinIO qua SSH tunnel.

**Không làm:** stream qua Node; không thêm test case (trần 94/55 đã chạm, chưa có duyệt nâng trần).

---

## 4. Triển Khai (theo code, 2026-10-22) ✅
| Chỗ | Hành vi |
|---|---|
| `packages/core/src/crypto/storage-ticket.ts` | `sealStorageTicket` / `openStorageTicket` (export ở `@gieochu/core`). HKDF-SHA256, info `gieochu:storage-ticket:v1`, salt rỗng, 32 byte; AES-256-GCM, IV 12 byte, tag 16 byte; vé = `base64url(iv‖tag‖ciphertext)`. `open` không ném — sai định dạng/tag/hết hạn → `null`. Chi tiết: [[02-System-Specs/File-Storage-And-Downloads-Specs|File-Storage-And-Downloads-Specs]] §9 |
| `packages/config/src/env.ts` | `STORAGE_GATEWAY_PROVIDERS`: không đặt/chuỗi rỗng → `[]`; tách dấu phẩy, `trim`, bỏ trùng; giá trị ngoài `MINIO`/`CLOUDFLARE_R2` → **fail-fast** khi khởi động |
| `apps/web/lib/storage-gateway.ts` | `toClientStorageUrl` (bọc 1 URL), `toClientUpload` (giữ shape `PresignedUpload`, chỉ thay `url`/`parts[].url`), `toAbsoluteRedirectUrl` (URL tương đối → tuyệt đối theo `APP_URL` cho 302). Quyết định theo **provider của client đã ký URL**, không theo `activeProvider` |
| `apps/web/app/api/internal/storage/ticket/route.ts` | Endpoint cho nginx — contract: [[03-API-Contracts/Endpoint-Directory|Endpoint-Directory]] §23 |
| `lib/download.ts`, `lib/share-link.ts` | TTL = `clampDownloadTtlSeconds(presignDownloadTtlSeconds)` (≤ 600s) dùng chung cho presign và hạn vé |
| `lib/product-upload.ts` | Upload file: vé PUT, `maxBytes` = `sizeBytes` khai báo (đơn) hoặc `partSizeBytes` (từng part); ảnh bìa: provider = `activeProvider`. TTL = `presignUploadTtlSeconds` |
| `docker/nginx/gieochu-storage-gateway.conf.example` | Mẫu nginx: chặn `/api/internal/`, `location /_s/`, `location = /_storage_auth` (`proxy_method GET`), `@storage_error`, `location /media/`. Quy trình: [[04-Operations-Runbooks/Storage-Gateway-VPS-Runbook|Storage-Gateway-VPS-Runbook]] |

---

## 5. Hệ Quả (Consequences)
* Bật gateway cho provider nào thì mọi URL **mới** của provider đó đi qua `/_s/`; URL presigned cũ đã phát hết hạn trong ≤ 10 phút (tải) 🟡.
* Shape JSON của mọi route trả URL **không đổi** — chỉ giá trị URL đổi (tương đối `/_s/...` hoặc tuyệt đối `APP_URL/_s/...` với 302) ✅.
* Chỉ khoá cổng MinIO **sau khi** bật gateway và kiểm tra xong. Đổi `host` MinIO sang `127.0.0.1` thì app phải chạy cùng máy với MinIO (máy
  dev dùng SSH tunnel `-L 9000:127.0.0.1:9000`) 🟡.
* Đổi `host` MinIO trong Admin làm `isEnabled = false` (đổi "danh tính kết nối" — `connectionIdentity` gồm host/port/useSSL/region/
  bucketPrefix/keys) → phải bấm Test kết nối (thành công tự đặt lại `isEnabled = true`) ✅ `lib/system-storage.ts`.
* Env runtime thêm 1 biến tuỳ chọn (cùng loại "hạ tầng" với `CRON_SECRET`) — không trái ADR-032 vì không phải cấu hình nghiệp vụ/thương hiệu.

## 6. Chưa Verify ❓
* Toàn bộ luồng thật qua nginx trên VPS (tải 302 → `/_s/`, share-link, upload đơn + multipart > 50MB, ảnh bìa, Range 206, `/media/`).
* Hành vi nginx khi vé bị từ chối (theo mẫu: 403 từ `auth_request` và 404 từ route khi gateway tắt đều rơi vào `error_page` → 404 văn bản)
  — suy từ cấu hình mẫu, chưa chạy thật.
* Upload không gửi `Content-Length` (chunked) sẽ bị từ chối `LENGTH_MISSING` — trình duyệt PUT Blob thường có header này, chưa kiểm.

---

## 7. Tài Liệu Tham Chiếu & Liên Kết
* [[MOC-Home]] — Trang chủ Map of Content ([MOC-Home.md](../00-Index/MOC-Home.md))
* Tương ứng **ADR-045** trong [`docs/DECISIONS.md`](../../docs/DECISIONS.md); nền là **ADR-044** (MinIO song song R2, bucket riêng theo tenant —
  [[01-Architecture-Decisions/ADR-034-Dual-Storage-MinIO-R2-Dedicated-Tenant-Bucket|ADR-034 KB]]).
* [[01-Architecture-Decisions/ADR-005-Storage-Config-System-Admin|ADR-005 (≙ ADR-017)]] — cấu hình storage qua System Admin ([ADR-005-Storage-Config-System-Admin.md](./ADR-005-Storage-Config-System-Admin.md))
* [[01-Architecture-Decisions/ADR-018-System-Settings-And-Brand-From-System-Center|ADR-018 (≙ ADR-032)]] — danh sách env runtime ([ADR-018-System-Settings-And-Brand-From-System-Center.md](./ADR-018-System-Settings-And-Brand-From-System-Center.md))
* [[01-Architecture-Decisions/ADR-020-Single-Database-Dev-Preview-Production|ADR-020 (≙ ADR-034)]] — lý do dùng env, không dùng DB ([ADR-020-Single-Database-Dev-Preview-Production.md](./ADR-020-Single-Database-Dev-Preview-Production.md))
* [[02-System-Specs/File-Storage-And-Downloads-Specs|File-Storage-And-Downloads-Specs]] §9 ([File-Storage-And-Downloads-Specs.md](../02-System-Specs/File-Storage-And-Downloads-Specs.md))
* [[03-API-Contracts/Endpoint-Directory|Endpoint-Directory]] §6, §7, §23 ([Endpoint-Directory.md](../03-API-Contracts/Endpoint-Directory.md))
* [[04-Operations-Runbooks/Storage-Gateway-VPS-Runbook|Storage-Gateway-VPS-Runbook]] ([Storage-Gateway-VPS-Runbook.md](../04-Operations-Runbooks/Storage-Gateway-VPS-Runbook.md))

*Quay lại: [[MOC-Home]] (../00-Index/MOC-Home.md)*

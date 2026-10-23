---
tags:
  - runbook
  - storage
  - security
  - deployment
  - status/living
date: 2026-10-22
author: Long (theo brief Quốc 2026-10-22)
---

# 🛡️ Cẩm Nang Bật Storage Gateway Trên VPS (ADR-045)

> **Mục đích:** giấu MinIO tự host sau `gieochu.net` — trình duyệt chỉ thấy URL `/_s/<vé>` cùng origin, MinIO và Next.js chỉ nghe trên
> `127.0.0.1`. Quyết định: [[01-Architecture-Decisions/ADR-030-Storage-Gateway-Encrypted-Ticket-Nginx|ADR-030 (≙ ADR-045)]]; đặc tả vé:
> [[02-System-Specs/File-Storage-And-Downloads-Specs|File-Storage-And-Downloads-Specs]] §9; contract endpoint nội bộ:
> [[03-API-Contracts/Endpoint-Directory|Endpoint-Directory]] §23.
>
> **Mức xác minh:** ✅ = Long đối chiếu code/file mẫu trong repo (2026-10-22) · 🟡 = theo `docs/DECISIONS.md` ADR-045/brief Quốc · ❓ = chưa chạy
> trên VPS thật. Code ADR-045 **đã commit `4ab5a3b`** (2026-10-22), deploy ❓. Repo **không** có file pm2 (ecosystem) hay cấu hình nginx thật — tên app
> pm2, đường dẫn file nginx, cách chạy MinIO trên VPS là của máy chủ, Long không kiểm được ❓.

---

## 1. Điều kiện trước khi bắt đầu
* Code có ADR-045 đã deploy lên VPS (`lib/storage-gateway.ts`, route `api/internal/storage/ticket`) — chưa có code này thì bước (e) vô nghĩa.
* nginx có module `http_auth_request` (gói nginx của Ubuntu có sẵn — theo comment file mẫu 🟡).
* Next.js và MinIO chạy **cùng máy** với nginx (target `proxy_pass` cố định `127.0.0.1:9000`) ✅ file mẫu.
* `STORAGE_ENCRYPTION_KEY` của process trên VPS giữ nguyên — vé được mã hoá bằng khoá dẫn xuất từ nó ✅.

> ⚠️ **Thứ tự bắt buộc:** chỉ khoá cổng MinIO (bước h) **sau khi** gateway đã bật và kiểm tra xong (bước g). Khoá trước → mọi URL presigned
> trực tiếp đang phát ra hỏng 🟡 ADR-045 "Hệ quả".

---

## 2. Các bước bật

### (a) MinIO chỉ nghe trên loopback 🟡
Trên VPS, cổng MinIO bind `127.0.0.1`:
```yaml
    ports:
      - "127.0.0.1:9000:9000"
      - "127.0.0.1:9001:9001"
```
> ❓ `docker/docker-compose.yml` trong repo (dùng cho dev) hiện vẫn là `"9000:9000"` / `"9001:9001"` (mọi interface) ✅ — chưa rõ VPS dùng chính
> file này hay file riêng. Hỏi Quốc trước khi coi đây là cấu hình mặc định.

Sau khi đổi: `docker compose up -d minio` (hoặc lệnh tương đương trên VPS) rồi `ss -ltnp | grep 900` phải thấy `127.0.0.1:9000`/`127.0.0.1:9001` ❓.

### (b) Cấu hình MinIO trong System Center 🟡/✅
`/admin/settings/storage` → tab MinIO:
| Trường | Giá trị |
| :-- | :-- |
| Host | `127.0.0.1` |
| Port | `9000` |
| useSSL | **Tắt** |
| publicBaseUrl | `https://gieochu.net/media` |

* Lưu xong **bắt buộc bấm Test kết nối**: đổi host/port/useSSL/region/bucketPrefix/key làm `isEnabled = false` (`connectionIdentity` đổi) và
  `lastVerifiedAt = null`; Test kết nối thành công tự đặt lại `isEnabled = true` ✅ `apps/web/lib/system-storage.ts`. Kiểm badge "Đang bật".
* Test kết nối MinIO đồng thời tạo bucket `{prefix}private` và `{prefix}public` nếu chưa có (`ensureBucketExists`) ✅ — nên làm bước (c) sau bước này.
* ⚠️ **Một DB dùng chung (ADR-034):** host `127.0.0.1` nghĩa là **mọi** process đọc cấu hình này (máy dev, Vercel Preview nếu còn) sẽ gọi
  MinIO trên chính máy đó. Máy dev muốn dùng phải mở SSH tunnel `ssh -L 9000:127.0.0.1:9000 <vps>` 🟡 ADR-045.

### (c) Cho phép đọc công khai bucket ảnh 🟡
```bash
mc anonymous set download local/gc-public
```
`gc-public` = `${bucketPrefix}public` với prefix mặc định `gc-` ✅ code; đổi prefix thì đổi tên bucket ở đây **và** trong `location /media/` (bước d).

### (d) Chèn cấu hình nginx ✅ file mẫu / ❓ chạy thật
Chép các `location` trong [`docker/nginx/gieochu-storage-gateway.conf.example`](../../docker/nginx/gieochu-storage-gateway.conf.example) vào
server block HTTPS hiện có của `gieochu.net`, **đặt trước `location /`**:
1. `location ^~ /api/internal/ { return 404; }` — chặn bên ngoài gọi route nội bộ.
2. `location ^~ /_s/` — `auth_request /_storage_auth`, `proxy_pass http://127.0.0.1:9000$storage_target`, `Host 127.0.0.1:9000`, xoá
   `Authorization`/`Cookie`, `proxy_request_buffering off`, `proxy_buffering off`, `client_max_body_size 60m`, timeout 300s, ẩn `x-amz-*`/
   `x-minio-deployment-id`/`Server`, `proxy_intercept_errors on` + `error_page … = @storage_error`.
3. `location = /_storage_auth` (`internal`) — `proxy_method GET`, `proxy_pass http://127.0.0.1:3000/api/internal/storage/ticket`, không chuyển
   body, đặt `X-Original-URI $request_uri`, `X-Original-Method $request_method`, `X-Original-Length $content_length`.
4. `location @storage_error` — trả 404 văn bản "Không tìm thấy tệp hoặc liên kết đã hết hạn."
5. `location ^~ /media/` — chỉ GET/HEAD, `proxy_pass http://127.0.0.1:9000/gc-public/`, `expires 7d`.

```bash
sudo nginx -t && sudo systemctl reload nginx
```

### (e) Bật gateway trong env của app 🟡
Đặt `STORAGE_GATEWAY_PROVIDERS=MINIO` trong env của process Next.js trên VPS (nơi pm2 đọc env), rồi:
```bash
pm2 restart <app> --update-env
```
* `<app>` = tên process pm2 trên VPS ❓ (repo không có).
* Giá trị khác `MINIO`/`CLOUDFLARE_R2` (vd gõ sai `MINO`) → app **không khởi động** (fail-fast) ✅ `env.ts` — xem `pm2 logs <app>` ngay sau restart.
* Không thêm `CLOUDFLARE_R2` trừ khi nginx có đường proxy tới R2 — file mẫu chỉ proxy tới MinIO ✅; R2 giữ presigned trực tiếp như cũ 🟡 ADR-045.

### (f) Next.js chỉ nghe trên loopback 🟡
Chạy Next bind `127.0.0.1:3000` (vd `next start -H 127.0.0.1 -p 3000` trong lệnh pm2). Script `start` của `apps/web` hiện là `next start` không
tham số ✅ `apps/web/package.json` — cấu hình host/port nằm ở lệnh pm2 trên VPS ❓.

---

## 3. (g) Kiểm tra — làm hết trước khi khoá cổng ❓

| # | Kiểm | Kỳ vọng |
| :-: | :-- | :-- |
| 1 | DevTools → Network khi tải tài liệu ở Thư viện, tải qua share-link, upload file ở Studio | Chỉ thấy request tới `gieochu.net/_s/...` (302 từ `/api/downloads/{token}` → `https://gieochu.net/_s/...`); **không** thấy host/port MinIO, tên bucket, tham số `X-Amz-*`; response không có header `x-amz-*` |
| 2 | `curl -i http://127.0.0.1:3000/api/internal/storage/ticket` (trên VPS, không header) | `403` `STORAGE_TICKET_REJECTED` (lý do `BAD_URI`) — chứng tỏ gateway bật; `404` = env chưa nhận (bước e) ✅ theo code |
| 3 | `curl -i https://gieochu.net/api/internal/storage/ticket` (từ ngoài) | `404` do nginx (`location ^~ /api/internal/`) |
| 4 | Upload file **> 50 MB** (multipart, part 10 MB) | Mọi part `PUT /_s/...` 200, `complete` thành công |
| 5 | Tải có Range: `curl -i -H "Range: bytes=0-99" "https://gieochu.net/_s/<vé GET còn hạn>"` | `206 Partial Content` |
| 6 | Ảnh bìa/ảnh public qua `https://gieochu.net/media/...` | 200 với GET; PUT/POST bị từ chối |
| 7 | Mở lại một URL `/_s/...` sau khi hết hạn (> TTL presign) | 404 văn bản "Không tìm thấy tệp hoặc liên kết đã hết hạn." |

### (h) Chỉ sau khi (g) đạt: khoá cổng MinIO 🟡
```bash
sudo ufw status verbose        # chỉ còn 22/80/443 cho incoming
sudo ufw deny 9000/tcp
sudo ufw deny 9001/tcp
```
> ⚠️ Docker publish cổng qua iptables riêng, có thể **bỏ qua ufw** — vì vậy bước (a) bind `127.0.0.1` mới là lớp chặn chính; ufw là lớp phụ
> (kiến thức chung về Docker, chưa kiểm trên VPS ❓). Kiểm từ máy ngoài: `curl -m 5 http://<IP-VPS>:9000` phải timeout/refused.

### (i) Truy cập console MinIO 🟡
```bash
ssh -L 9001:127.0.0.1:9001 <user>@<vps>
# mở http://localhost:9001 trên máy mình
```

---

## 4. (j) Rollback 🟡
1. Xoá `STORAGE_GATEWAY_PROVIDERS` (hoặc để rỗng) trong env của app → `pm2 restart <app> --update-env`. App quay về presigned URL trực tiếp
   ngay cho URL mới ✅ code (env rỗng = `[]`, route nội bộ trả 404). URL `/_s/...` đã phát vẫn chạy tới khi hết hạn nếu giữ nguyên nginx.
2. **Presigned trực tiếp cần trình duyệt tới được MinIO:** mở lại cổng MinIO (bind không còn chỉ `127.0.0.1`, ufw cho phép) **và** host MinIO
   trong Admin phải là địa chỉ trình duyệt truy cập được (không phải `127.0.0.1`) — đổi host xong phải Test kết nối lại (bước b). Lưu ý mixed
   content nếu MinIO chỉ có HTTP: [[04-Operations-Runbooks/Minio-Storage-Operations-Runbook|Minio-Storage-Operations-Runbook]] §2.2.
3. Có thể giữ các `location` nginx — không ảnh hưởng khi app không phát URL `/_s/`.

---

## 5. Rủi ro & lỗi thường gặp
| Triệu chứng | Nguyên nhân | Xử lý |
| :-- | :-- | :-- |
| Mọi upload qua `/_s/` bị từ chối, tải vẫn được | Thiếu `proxy_method GET` ở `location = /_storage_auth` — subrequest giữ method gốc `PUT`, route Next chỉ có `GET` ✅ (comment file mẫu) | **Bắt buộc** giữ `proxy_method GET` |
| MinIO trả `SignatureDoesNotMatch` → người dùng thấy 404 | Header `Host` gửi tới MinIO khác `host:port` lúc ký (endpoint trong Admin) ✅ comment file mẫu | `proxy_set_header Host 127.0.0.1:9000` phải trùng Host/Port ở bước (b); đổi một bên thì đổi cả hai |
| Upload bị từ chối dù file nhỏ | Request không có `Content-Length` (chunked) → `LENGTH_MISSING`, hoặc vượt `maxBytes` → `LENGTH_EXCEEDED` ✅ code | Xem log app (`storage gateway: từ chối vé`, có `reason`) |
| Upload > 60 MB một request bị nginx chặn 413 | `client_max_body_size 60m` ✅ file mẫu | Đúng thiết kế: đơn ≤ 50 MB, part 10 MB, ảnh bìa ≤ 5 MB |
| `/_s/...` trả 404 với mọi file sau khi deploy | Env có `STORAGE_GATEWAY_PROVIDERS` nhưng nginx chưa có `location /_s/` (request rơi vào Next → không có route) — suy từ code ✅ | Làm bước (d) trước (e); hoặc rollback |
| Cấu hình storage "Đang tắt" sau khi đổi host | Đổi danh tính kết nối → `isEnabled = false` ✅ | Bấm Test kết nối |
| Máy dev không upload/tải được | Host MinIO trong DB dùng chung là `127.0.0.1` 🟡 | SSH tunnel `-L 9000:127.0.0.1:9000` |

---

## 6. Tài Liệu Tham Chiếu & Liên Kết
* [[MOC-Home]] — Trang chủ Map of Content ([MOC-Home.md](../00-Index/MOC-Home.md))
* ADR-044, ADR-045 trong [`docs/DECISIONS.md`](../../docs/DECISIONS.md) · [[01-Architecture-Decisions/ADR-030-Storage-Gateway-Encrypted-Ticket-Nginx|ADR-030 (≙ ADR-045)]] ([ADR-030-Storage-Gateway-Encrypted-Ticket-Nginx.md](../01-Architecture-Decisions/ADR-030-Storage-Gateway-Encrypted-Ticket-Nginx.md))
* [[02-System-Specs/File-Storage-And-Downloads-Specs|File-Storage-And-Downloads-Specs]] §9 ([File-Storage-And-Downloads-Specs.md](../02-System-Specs/File-Storage-And-Downloads-Specs.md))
* [[03-API-Contracts/Endpoint-Directory|Endpoint-Directory]] §6, §7, §23 ([Endpoint-Directory.md](../03-API-Contracts/Endpoint-Directory.md))
* [[04-Operations-Runbooks/Minio-Storage-Operations-Runbook|Minio-Storage-Operations-Runbook]] ([Minio-Storage-Operations-Runbook.md](./Minio-Storage-Operations-Runbook.md))
* [[04-Operations-Runbooks/Deploy-Vercel-Runbook|Deploy-Vercel-Runbook]] §3.4 — không đặt biến này trên Vercel ([Deploy-Vercel-Runbook.md](./Deploy-Vercel-Runbook.md))
* File mẫu: [`docker/nginx/gieochu-storage-gateway.conf.example`](../../docker/nginx/gieochu-storage-gateway.conf.example) · env mẫu: `.env.example`

*Quay lại: [[MOC-Home]] (../00-Index/MOC-Home.md)*

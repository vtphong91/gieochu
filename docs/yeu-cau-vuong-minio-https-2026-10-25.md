# Yêu cầu gửi Vương — Đưa MinIO ra HTTPS qua `s3.<domain>` (sửa lỗi upload trên Vercel)

- **Ngày:** 2026-10-25
- **Người gửi:** Quốc (kỹ sư trưởng) — Long soạn
- **Người nhận:** Vương (storage/VPS, tác giả ADR-044/045/051)
- **Quyết định căn cứ:** ADR-055 trong `docs/DECISIONS.md` (chủ dự án chốt phương án A ngày 2026-10-25). Liên quan: ADR-034 (một DB
  dùng chung), ADR-044 (MinIO + bucket riêng mỗi gian hàng), ADR-045 (Storage Gateway).

**Mức xác minh dùng trong tài liệu:** ✅ đã đối chiếu code/cấu hình trong repo · 🟡 theo báo cáo hoặc theo tài liệu MinIO/nginx,
chưa kiểm trên VPS · ❓ cần anh kiểm trên môi trường thật.

> Tên miền chưa chốt. Trong tài liệu, **`s3.gieochu.net` chỉ là ví dụ (placeholder)**. Anh thay bằng tên thật ở mọi chỗ.
> Quy ước biến dùng bên dưới:
>
> | Biến | Ví dụ | Ý nghĩa |
> |---|---|---|
> | `S3_HOST` | `s3.gieochu.net` | Tên miền storage mới |
> | `APP_ORIGIN_VERCEL` | `https://gieochunet.vercel.app` | Origin app trên Vercel |
> | `APP_ORIGIN_PROD` | `https://gieochu.net` | Origin app production trên VPS (anh xác nhận lại) |
> | `MINIO_ALIAS` | `local` | Alias `mc` trỏ `http://127.0.0.1:9000` |

---

## 1. Hiện tượng

Chủ dự án tạo sản phẩm mới trên `gieochunet.vercel.app` rồi tải PDF lên. UI báo **"Tải file lên storage thất bại"**. Console trình
duyệt hiện lỗi:

```
Connecting to 'http://84.247.143.153:9000/gc-mvlfdntuy42p/tenants/.../products/.../...pdf?X-Amz-...&x-id=PutObject' violates the following Content Security Policy directive: "connect-src 'self' https://api.cloudinary.com". The action has been blocked.
```

Luồng upload ✅ (`apps/web/app/studio/[tenantSlug]/products/_ui/upload-client.ts`, `packages/storage/src/presign.ts`):

1. Trình duyệt gọi `POST /api/studio/{slug}/uploads/presign` → server ký presigned URL theo endpoint MinIO lưu trong DB.
2. Trình duyệt **PUT thẳng** lên MinIO bằng XHR:
   - file ≤ 50 MB: 1 PUT, có header `Content-Type`;
   - file > 50 MB: multipart, mỗi part 10 MB, PUT không kèm header riêng; client **đọc header `ETag`** của từng part, thiếu ETag là báo lỗi.
3. Trình duyệt gọi `.../uploads/complete`.

Request bị chặn ở bước 2.

## Quốc đã chốt (2026-10-25)

1. **CORS:** dùng **cách B, CORS tại nginx** bằng `map` origin (mục 3.5). Cách này quản lý ở một chỗ, tự áp cho cả bucket gian hàng tạo
   về sau, không cần sửa code. Nếu anh thấy **cách A** (CORS toàn server MinIO) hợp hơn với bản MinIO đang chạy thì được chọn A, nhưng
   chỉ được có **đúng một nơi** trả CORS. **Không dùng A'** (CORS từng bucket), nên Hiếu không cần đặt CORS khi tạo bucket.
2. **Origin được phép:** chỉ `https://gieochunet.vercel.app` và domain production (placeholder `https://gieochu.net`). **Không** cho
   các URL Preview ngẫu nhiên của Vercel, **không** dùng wildcard.
3. **Hai runbook storage (`Minio-Storage-Operations-Runbook.md`, `Storage-Gateway-VPS-Runbook.md`) và KB-Audit:** Long cập nhật sau khi
   anh báo xong. Quốc sẽ giao việc này.

## 2. Nguyên nhân

| # | Nguyên nhân | Mức |
|---|---|---|
| 1 | CSP trong `apps/web/proxy.ts` chỉ cho `connect-src 'self' https://api.cloudinary.com` nên PUT tới MinIO bị chặn. | ✅ |
| 2 | Kể cả khi CSP cho phép, trang HTTPS gọi tới `http://84.247.143.153:9000` vẫn bị trình duyệt chặn vì **mixed content**. Không có cách sửa nào ở phía code nếu MinIO vẫn là HTTP. | ✅ (endpoint trong log là `http://`, code dựng `http`/`https` theo `useSSL` — `packages/storage/src/bucket.ts` `resolveMinioEndpoint`) |
| 3 | Một DB dùng chung (ADR-034): cấu hình MinIO trong System Center áp cho **cả Vercel lẫn VPS** cùng lúc. Không thể đặt endpoint riêng cho từng môi trường. | ✅ (ADR-034, ADR-044) |
| 4 | Storage Gateway `/_s/` (ADR-045) chỉ chạy được trên VPS (Vercel không vào được `127.0.0.1:9000`). Mẫu nginx gateway đặt `proxy_set_header Host 127.0.0.1:9000`, trong khi endpoint trong DB là IP công khai, nên chữ ký SigV4 không khớp Host và MinIO **có thể trả 403**. | ✅ mẫu `docker/nginx/gieochu-storage-gateway.conf.example` dòng 18; 403 là 🟡 (chưa chạy thử) |
| 5 | Ngày 24/10, cấu hình storage từng bị integration test ghi đè bằng giá trị giả. Test đã được sửa, chủ dự án đã nhập lại cấu hình. Ghi lại để anh biết nếu thấy dấu vết lạ trong DB/log ngày đó. | 🟡 (theo báo cáo của Quốc) |

Kết luận (ADR-055): MinIO phải có **endpoint HTTPS công khai bằng tên miền**, được cả Vercel lẫn VPS dùng chung.

---

## 3. Việc anh cần làm trên VPS (phương án A)

Thứ tự đề xuất. Cổng 9000 chỉ đóng **ở bước cuối**, sau khi mọi thứ đã chạy qua HTTPS.

### 3.1 DNS

- Tạo bản ghi **A**: `s3.gieochu.net` (placeholder) → `84.247.143.153`.
- Nếu DNS quản lý trên Cloudflare: để **DNS only (mây xám)**, **không bật proxy**. Lý do: gói Cloudflare free giới hạn 100 MB mỗi
  request upload, trong khi hệ thống cho `maxUploadMb` mặc định 500 ✅ (`apps/web/lib/system-storage.ts`). Ghi chú: hiện mỗi request PUT
  tối đa khoảng 50 MB (single) hoặc 10 MB (part) ✅. Quyết định "DNS only" trong ADR-055 vẫn giữ, vì các luồng khác như đồng bộ storage
  có thể gửi body lớn hơn và vì Cloudflare proxy còn có giới hạn timeout.
- Kiểm tra: `dig +short s3.gieochu.net` trả đúng IP VPS.

### 3.2 Chứng chỉ TLS (Let's Encrypt)

```bash
sudo apt update && sudo apt install -y certbot python3-certbot-nginx
# Cách 1: tạo server block HTTP tạm (mục 3.3, chỉ phần listen 80) rồi:
sudo certbot --nginx -d s3.gieochu.net
# Cách 2 (không để certbot sửa file nginx):
sudo certbot certonly --nginx -d s3.gieochu.net
sudo certbot renew --dry-run      # kiểm tra gia hạn tự động
systemctl list-timers | grep certbot
```

### 3.3 nginx server block cho `s3.<domain>`

Tạo file riêng, ví dụ `/etc/nginx/sites-available/s3.gieochu.net`, rồi symlink vào `sites-enabled`. File này **tách khỏi** server block
của `gieochu.net`, nên không đụng tới các `location /_s/`, `/_storage_auth`, `/media/`, `/api/internal/` của gateway.

```nginx
# s3.gieochu.net (placeholder) → MinIO S3 API trên loopback
server {
    listen 80;
    listen [::]:80;
    server_name s3.gieochu.net;
    # certbot cần /.well-known khi gia hạn qua plugin nginx — plugin tự xử lý; nếu dùng webroot thì thêm location tương ứng.
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name s3.gieochu.net;

    ssl_certificate     /etc/letsencrypt/live/s3.gieochu.net/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/s3.gieochu.net/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    # Lớn hơn hoặc bằng maxUploadMb (mặc định 500) để không chặn mọi luồng ghi (kể cả đồng bộ storage phía server).
    client_max_body_size 520m;

    # MinIO khuyến nghị: không loại header có ký tự lạ (header x-amz-*) 🟡 theo tài liệu MinIO
    ignore_invalid_headers off;

    location / {
        proxy_pass http://127.0.0.1:9000;

        # BẮT BUỘC: Host gửi vào MinIO phải đúng là host lúc ký (s3.gieochu.net, không kèm :443).
        # Không dùng `proxy_set_header Host 127.0.0.1:9000` như mẫu gateway.
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # KHÔNG xoá header Authorization ở đây (khác gateway): server Next.js trên Vercel/VPS gọi S3 API bằng
        # SigV4 trong header Authorization (HeadBucket, CreateMultipartUpload, CompleteMultipartUpload, ...).

        proxy_http_version 1.1;
        proxy_set_header Connection "";
        chunked_transfer_encoding off;

        proxy_request_buffering off;   # upload stream thẳng vào MinIO
        proxy_buffering off;           # download stream thẳng
        proxy_max_temp_file_size 0;

        proxy_connect_timeout 60s;
        proxy_send_timeout    600s;
        proxy_read_timeout    600s;
        send_timeout          600s;
    }
}
```

Lưu ý:

- **Host và SigV4** ✅: code dùng path-style (`forcePathStyle: true`, `packages/storage/src/s3-client.ts`), URL có dạng
  `https://s3.gieochu.net/<bucket>/<key>?X-Amz-...`. Endpoint dựng từ Host/Port/useSSL. Với Port 443 và useSSL bật, code **bỏ `:443`**
  ✅ (`resolveMinioEndpoint`), nên host được ký là `s3.gieochu.net`, khớp với `$host` mà nginx chuyển vào.
- **`MINIO_DOMAIN`**: không cần, vì code dùng path-style ✅. **Không đặt `MINIO_DOMAIN=gieochu.net`**. Khi đó MinIO có thể hiểu
  `s3.gieochu.net` là virtual-host style, tức bucket tên `s3`, và request sẽ hỏng 🟡 (theo tài liệu MinIO). Nếu VPS đang đặt biến này,
  anh báo lại.
- **`MINIO_SERVER_URL=https://s3.gieochu.net`**: có thể đặt để console MinIO sinh link chia sẻ đúng domain. Biến này không ảnh hưởng
  presigned URL do app ký ❓ (anh kiểm theo docs của phiên bản MinIO đang chạy).
- `nginx -t && sudo systemctl reload nginx` sau khi thêm.

### 3.4 MinIO chỉ nghe loopback, đóng cổng 9000/9001

> **Chuẩn bị ở bước này, nhưng chỉ thực hiện sau mục 3.6** (System Center đã chuyển sang `s3.<domain>` và Test kết nối thành công).
> Nếu đóng cổng sớm, cấu hình hiện tại (`http://84.247.143.153:9000`) mất kết nối trên cả hai môi trường.

**Docker** (nếu MinIO chạy bằng docker compose), sửa phần `ports`:

```yaml
    ports:
      - "127.0.0.1:9000:9000"
      - "127.0.0.1:9001:9001"   # console chỉ nội bộ, vào qua SSH tunnel
```

> ⚠️ Nếu MinIO chạy bằng Docker mà publish `"9000:9000"`, thì **ufw không chặn được**: Docker ghi rule iptables riêng, đi vòng qua ufw 🟡.
> Vì vậy bắt buộc bind `127.0.0.1` ở `ports`, không chỉ dựa vào ufw. File `docker/docker-compose.yml` trong repo (bản dev) vẫn là
> `"9000:9000"` ✅. Chưa rõ VPS dùng file này hay file riêng ❓.

**Binary/systemd**: `minio server /data --address 127.0.0.1:9000 --console-address 127.0.0.1:9001` ❓ (tuỳ cách cài).

**Firewall:**

```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw deny 9000/tcp
sudo ufw deny 9001/tcp
sudo ufw status verbose
ss -ltnp | grep -E ':900[01]'      # phải thấy 127.0.0.1:9000 và 127.0.0.1:9001
```

Console MinIO: `ssh -L 9001:127.0.0.1:9001 <user>@<vps>` rồi mở `http://localhost:9001`.

### 3.5 CORS cho bucket

Trình duyệt PUT từ origin app sang `https://s3.<domain>`, tức là request khác origin. Vì là method PUT nên luôn có preflight `OPTIONS`.

Yêu cầu CORS:

| Mục | Giá trị |
|---|---|
| AllowedOrigins | `APP_ORIGIN_VERCEL`, `APP_ORIGIN_PROD` (liệt kê chính xác, **không `*`**). **Không** thêm URL Preview của Vercel (Quốc đã chốt). |
| AllowedMethods | `PUT`, `GET`, `HEAD` (+ `OPTIONS` cho preflight) |
| AllowedHeaders | `Content-Type` (trình duyệt chỉ gửi header này ✅ `upload-client.ts`). Chữ ký nằm trong query, không cần `Authorization`/`x-amz-*`. |
| **ExposeHeaders** | **`ETag`**. Bắt buộc: multipart đọc `xhr.getResponseHeader("ETag")`, thiếu header này thì upload file > 50 MB thất bại ✅ |
| MaxAge | `3600` |

**Bucket nào cần CORS:** `{prefix}private`, `{prefix}public`, và **mọi bucket gian hàng tạo động** `gc-<12 ký tự>` (bucket cũ có thể theo
mẫu `gc-tenant-<tenantId>`, ADR-044). Code tạo bucket hiện **không đặt CORS** ✅: `packages/storage/src/bucket.ts` chỉ gọi
`CreateBucketCommand`, và `getOrCreateTenantBucket` chạy khi tạo gian hàng hoặc khi upload lần đầu. Vì vậy cấu hình CORS phải tự
áp cho bucket mới.

> Quốc đã chốt: ưu tiên **cách B** (nginx). Chỉ dùng cách A nếu hợp với bản MinIO hơn. **Không dùng A'.**

**Cách A (phương án thay thế): CORS cấp server MinIO, áp cho mọi bucket kể cả bucket tạo sau** 🟡 (theo tài liệu MinIO, chưa kiểm trên VPS):

```bash
mc alias set local http://127.0.0.1:9000 <ACCESS_KEY> <SECRET_KEY>
mc admin config get local api | tr ' ' '\n' | grep cors      # mặc định thường là cors_allow_origin=*  ❓
mc admin config set local api cors_allow_origin="https://gieochunet.vercel.app,https://gieochu.net"
mc admin service restart local
# hoặc đặt env khi chạy MinIO: MINIO_API_CORS_ALLOW_ORIGIN="https://gieochunet.vercel.app,https://gieochu.net"
```

❓ Cấu hình này chỉ khai origin. Anh kiểm bằng curl ở mục 5 xem MinIO có tự trả `Access-Control-Expose-Headers` chứa `ETag` và
`Access-Control-Allow-Methods` chứa `PUT` hay không. Nếu không có thì dùng cách B.

**Cách A' (CORS từng bucket bằng `mc cors set`) — KHÔNG dùng (Quốc đã chốt), giữ lại để tham khảo:** chỉ dùng nếu phiên bản MinIO trên VPS hỗ trợ PutBucketCors ❓. Nếu dùng cách này,
bucket gian hàng tạo mới sau này **sẽ không có CORS** cho tới khi có người áp tay. Khi đó cần **Hiếu bổ sung** bước `PutBucketCors`
trong `createBucket`/`getOrCreateTenantBucket`, hoặc anh chạy script định kỳ. Mẫu:

```bash
cat > /tmp/cors.xml <<'EOF'
<CORSConfiguration>
  <CORSRule>
    <AllowedOrigin>https://gieochunet.vercel.app</AllowedOrigin>
    <AllowedOrigin>https://gieochu.net</AllowedOrigin>
    <AllowedMethod>PUT</AllowedMethod>
    <AllowedMethod>GET</AllowedMethod>
    <AllowedMethod>HEAD</AllowedMethod>
    <AllowedHeader>Content-Type</AllowedHeader>
    <ExposeHeader>ETag</ExposeHeader>
    <MaxAgeSeconds>3600</MaxAgeSeconds>
  </CORSRule>
</CORSConfiguration>
EOF
for b in $(mc ls local | awk '{print $NF}' | tr -d '/' | grep '^gc-'); do
  mc cors set "local/$b" /tmp/cors.xml && echo "OK $b"
done
```

**Cách B (CORS tại nginx, không phụ thuộc phiên bản MinIO, áp mọi bucket):** thêm vào server block `s3.<domain>` ở mục 3.3. Chỉ chọn
**một nơi** trả CORS (MinIO hoặc nginx). Nếu cả hai cùng trả, `Access-Control-Allow-Origin` bị lặp và trình duyệt từ chối. Vì vậy cách B
có ẩn header CORS của MinIO.

```nginx
# Đặt trong http {} (ví dụ /etc/nginx/conf.d/s3-cors-map.conf)
map $http_origin $s3_cors_origin {
    default "";
    "https://gieochunet.vercel.app" $http_origin;
    "https://gieochu.net"           $http_origin;
}

# Trong location / của server s3.<domain>:
    proxy_hide_header Access-Control-Allow-Origin;
    proxy_hide_header Access-Control-Allow-Methods;
    proxy_hide_header Access-Control-Allow-Headers;
    proxy_hide_header Access-Control-Expose-Headers;
    proxy_hide_header Access-Control-Allow-Credentials;
    proxy_hide_header Access-Control-Max-Age;

    if ($request_method = OPTIONS) {
        add_header Access-Control-Allow-Origin  $s3_cors_origin always;
        add_header Access-Control-Allow-Methods "PUT, GET, HEAD" always;
        add_header Access-Control-Allow-Headers "Content-Type" always;
        add_header Access-Control-Max-Age       3600 always;
        add_header Vary Origin always;
        return 204;
    }
    add_header Access-Control-Allow-Origin   $s3_cors_origin always;
    add_header Access-Control-Expose-Headers "ETag" always;
    add_header Vary Origin always;
```

> `if` + `return` trong `location` là cách dùng an toàn của nginx. Origin không nằm trong `map` nhận giá trị rỗng, nginx bỏ header đó,
> và trình duyệt chặn. Đó là hành vi mong muốn.

### 3.6 System Center → Lưu trữ → Cấu hình MinIO

Làm sau khi mục 3.1–3.5 xong và **sau khi Hiếu đã deploy CSP mới** (mục 4). Thiếu CSP thì trình duyệt vẫn chặn.

| Trường | Giá trị |
|---|---|
| Host | `s3.gieochu.net` (placeholder; chỉ tên miền, không kèm `https://`, code tự bỏ nếu dán vào ✅) |
| Port | `443` |
| useSSL | **Bật** |
| publicBaseUrl | Xem ghi chú dưới |
| bucketPrefix / region / key | Giữ nguyên |

- Lưu xong **bắt buộc bấm "Test kết nối"**. Đổi host/port/useSSL làm cấu hình tự tắt (`isEnabled = false`, `lastVerifiedAt = null`) cho
  tới khi Test kết nối thành công ✅ (`apps/web/lib/system-storage.ts`, xem `Storage-Gateway-VPS-Runbook.md` bước b). Trong khoảng này,
  upload hỏng trên **cả hai môi trường**, nên làm liền tay.
- Test kết nối đồng thời tạo `{prefix}private` và `{prefix}public` nếu chưa có ✅.
- **publicBaseUrl:** logo gian hàng dựng URL từ `publicBaseUrl` rồi bọc qua Cloudinary ✅ (`apps/web/lib/home.ts` `tenantLogoUrl`);
  ảnh bìa sản phẩm cũng đọc `publicBaseUrl` ✅ (`apps/web/lib/product-cover.ts`). Nếu giá trị hiện tại là `http://84.247.143.153:9000/...`
  thì sau khi đóng cổng 9000 các ảnh này hỏng 🟡. Cần đổi sang URL HTTPS công khai:
  - `https://s3.gieochu.net/gc-public` (qua server block mới, bucket public đã `mc anonymous set download`), hoặc
  - `https://gieochu.net/media` (qua `location /media/` của gateway, như runbook hiện có).

  ❓ Anh cho biết giá trị hiện tại trong System Center.

---

## 4. Việc phía code (Hiếu làm sau khi anh xác nhận tên miền) — để anh nắm

Theo ADR-055:

- Thêm **biến môi trường tuỳ chọn** liệt kê **chính xác** origin storage, ví dụ `https://s3.gieochu.net`. Chỉ nhận `https://`,
  không wildcard, validate bằng zod trong `packages/config/src/env.ts`. Tên biến do Hiếu chốt.
- `apps/web/proxy.ts` nối origin này vào `connect-src` (và vào `img-src` nếu có ảnh hiển thị trực tiếp từ MinIO; hiện logo/bìa đi qua
  Cloudinary nên có thể không cần 🟡). Proxy **không đọc DB**.
- **Phải đặt env này trên cả Vercel lẫn VPS** (pm2/`.env` của VPS). Thiếu ở bên nào thì upload ở bên đó vẫn bị CSP chặn.

---

## 5. Checklist kiểm tra sau khi làm

Thay `s3.gieochu.net`, bucket và origin bằng giá trị thật.

- [ ] **TLS & proxy:** `curl -I https://s3.gieochu.net` trả phản hồi từ MinIO (thường 403/400 XML hoặc `Server: MinIO` tuỳ cấu hình),
      chứng chỉ hợp lệ (không cần `-k`). `curl -I http://s3.gieochu.net` → `301` sang `https://`.
- [ ] **Preflight CORS:**
  ```bash
  curl -i -X OPTIONS "https://s3.gieochu.net/gc-public/test.txt" \
    -H "Origin: https://gieochunet.vercel.app" \
    -H "Access-Control-Request-Method: PUT" \
    -H "Access-Control-Request-Headers: content-type"
  ```
  Phải có `Access-Control-Allow-Origin: https://gieochunet.vercel.app` và `Access-Control-Allow-Methods` chứa `PUT`. Lặp lại với
  `Origin: https://gieochu.net`, rồi với một origin lạ (phải **không** có `Allow-Origin`). Thử thêm trên một bucket gian hàng `gc-...`.
- [ ] **ExposeHeaders:** response của một PUT/GET thật (lấy từ DevTools → Network) có `Access-Control-Expose-Headers: ETag`.
- [ ] **Upload từ `gieochunet.vercel.app`:** tạo sản phẩm, tải 1 PDF nhỏ (< 50 MB, single PUT) và 1 file lớn > 50 MB (multipart). Cả hai
      lên 100% và hiện trong danh sách file.
- [ ] **Upload từ domain production** (VPS): lặp lại hai trường hợp trên.
- [ ] **Tải về file đã mua** (cả hai môi trường): link tải chạy, file mở được.
- [ ] **System Center → Test kết nối** MinIO: thành công, badge "Đang bật".
- [ ] **Cổng đã đóng:** từ máy ngoài VPS, `curl -m 5 http://84.247.143.153:9000` và `nc -vz 84.247.143.153 9001` đều **timeout/refused**;
      trên VPS `ss -ltnp | grep 900` chỉ thấy `127.0.0.1`.
- [ ] **Console trình duyệt** khi upload/tải: không còn lỗi CSP, không còn cảnh báo mixed content.
- [ ] **Ảnh công khai** (logo/bìa) vẫn hiển thị sau khi đóng cổng 9000.
- [ ] `sudo certbot renew --dry-run` thành công.

---

## 6. Rủi ro và lưu ý

- **Gateway ADR-045 vẫn là tuỳ chọn sau cho VPS.** Nếu VPS đang đặt `STORAGE_GATEWAY_PROVIDERS` có `MINIO`, thì sau khi Host MinIO
  trong DB đổi thành `s3.<domain>`, presigned URL nội bộ sẽ được ký theo host `s3.<domain>`. Khi đó `location /_s/` (mẫu đang đặt
  `Host 127.0.0.1:9000`) gửi sai Host và có thể bị 403 ✅ (cấu hình)/🟡 (chưa thử). Hai cách xử lý: bỏ `MINIO` khỏi
  `STORAGE_GATEWAY_PROVIDERS` trên VPS (dùng presigned trực tiếp như Vercel), hoặc đổi `proxy_set_header Host` trong `/_s/` thành
  `s3.<domain>`. ❓ Anh cho biết gateway đang bật hay chưa.
- **Bucket cũ theo tên cũ:** gian hàng đã có `storageBucket` giữ nguyên tên, có thể là `gc-tenant-<tenantId>` theo mẫu trước
  2026-10-23 ✅ (ADR-044). CORS phải phủ cả các bucket này. Cách A và B tự phủ; cách A' phải liệt kê đủ.
- **Gia hạn chứng chỉ tự động:** kiểm timer `certbot` và hook reload nginx. Chứng chỉ hết hạn thì toàn bộ upload/tải hỏng trên cả hai
  môi trường.
- **Không đặt `PRISMA_MIGRATE_URL` trên Vercel** (role owner, có quyền DDL và `BYPASSRLS`). Việc này không cần cho thay đổi lần này.
- **Mọi thay đổi trong System Center áp cho cả Vercel lẫn VPS** (ADR-034). Đổi host/port là đổi cho mọi môi trường cùng lúc.
- **Ai còn dùng `IP:9000` trực tiếp** sẽ hỏng khi đóng cổng: máy dev, script `mc mirror` sao lưu, alias `mc` trỏ IP công khai,
  `publicBaseUrl`. Sau khi đóng cổng, máy dev dùng `https://s3.<domain>` hoặc SSH tunnel.
- **Server-side cũng đi qua `s3.<domain>`:** app trên VPS gọi `https://s3.<domain>`, request đi ra IP công khai rồi vòng lại nginx
  chính máy đó. Cách này chạy được nếu nginx nghe trên IP công khai 🟡. Nếu muốn đi ngắn hơn, có thể thêm `/etc/hosts`
  `127.0.0.1 s3.gieochu.net` trên VPS ❓ (chứng chỉ vẫn khớp vì cùng tên).

---

## 7. Câu hỏi cần anh trả lời (gửi lại Quốc)

1. **Tên miền** chọn cho storage (`s3.<domain>` cụ thể)? DNS đang quản lý ở đâu (Cloudflare hay nhà đăng ký)?
2. **nginx hiện có những server block nào** (`ls /etc/nginx/sites-enabled/`, `nginx -T | grep server_name`)? Gateway `/_s/`, `/media/` đã
   được chèn vào `gieochu.net` chưa? `STORAGE_GATEWAY_PROVIDERS` trên VPS đang là gì?
3. **MinIO chạy bằng Docker hay binary/systemd?** Phiên bản nào (`minio --version` hoặc image tag)? Đang
   đặt `MINIO_DOMAIN`, `MINIO_SERVER_URL`, `MINIO_API_CORS_ALLOW_ORIGIN` không?
4. **Có cần giữ truy cập trực tiếp `IP:9000`** cho việc gì không (sao lưu, máy dev, công cụ khác)?
5. Giá trị **`publicBaseUrl`** MinIO hiện tại trong System Center?
6. Origin production chính xác (`https://gieochu.net`? có `www` không?).

Sau khi anh trả lời câu 1 và hoàn tất mục 3.1–3.5, Quốc giao Hiếu làm mục 4, rồi mới chuyển System Center (mục 3.6) và đóng cổng 9000.

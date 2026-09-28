---
tags:
  - adr
  - security
  - rls
  - downloads
  - status/accepted
date: 2026-09-26
decider: vtphong91
status: Accepted (Chốt — Áp dụng chính thức)
---

# 🏛️ ADR-006: `DownloadToken` L1 Không RLS, Thêm Nhánh "Customer" Cho RLS Sản Phẩm/File, Mật Khẩu Share Link Dùng Argon2 Riêng

## 1. Trạng Thái (Status)
**ĐÃ PHÊ DUYỆT (Accepted)** — Áp dụng cho toàn bộ luồng tải file (`/api/downloads`) và share link công khai.

---

## 2. Bối Cảnh (Context)

**(1) DownloadToken:** Luồng tải file cần một token dùng-một-lần bắc cầu giữa `POST /api/downloads` (yêu cầu tải) và `GET /api/downloads/{token}` (tải thật) — không có trong ERD gốc với đầy đủ cột chi tiết.

**(2) RLS thiếu nhánh customer:** Khi viết `requestDownload()`/`listLibraryEntitlements()`, phát hiện policy RLS của `product_files` và `products` (đã có từ các module trước) chỉ có 3 nhánh: tenant / public (sản phẩm `PUBLISHED`) / system_job — **không có cách nào cho một khách hàng đã mua đọc được file/sản phẩm của chính họ** một khi sản phẩm không còn `PUBLISHED` (bị gỡ xuống hoặc lưu trữ sau khi bán). Test tích hợp đầu tiên chạy thật (không mock DB) bắt đúng lỗi này — trả về `null`/entitlement rỗng — không phải phát hiện qua review code. Cùng lúc phát hiện thêm một hàm đọc `share_links` qua client Prisma trần (không qua helper RLS) — bị RLS chặn hẳn vì bảng có `FORCE ROW LEVEL SECURITY`.

**(3) Mật khẩu share link:** Cần hash/verify mật khẩu tuỳ chọn cho share link, cùng thuật toán argon2id đã dùng cho mật khẩu tài khoản (`packages/auth`) — nhưng `packages/core` không được phép phụ thuộc `packages/auth` (mọi package khác phụ thuộc *vào* `core`, không phải ngược lại).

---

## 3. Quyết Định (Decision)
1. **`DownloadToken` là bảng L1, không RLS** — ranh giới bảo mật ở đây là "chỉ người vừa yêu cầu tải giữ token thô" (giống cơ chế email-verify/reset-password), không phải lọc theo `tenantId`/`userId` ở tầng DB. Có cột `tenantId` denormalize từ `entitlement.tenantId` lúc tạo, để hàm tiêu thụ token mở đúng một `withTenant()` ngay từ đầu.
2. **Thêm nhánh thứ 4 vào policy RLS** của cả `products` và `product_files`: `app.scope='customer' AND EXISTS (... entitlements WHERE productId = ... AND userId = current_setting('app.user_id'))` — qua 2 migration RLS riêng, không sửa lại policy gốc trong migration cũ (giữ lịch sử migration bất biến). Sửa luôn hàm đọc `share_links` trần để bọc qua `withPublic()`.
3. **Thêm `argon2` làm dependency riêng của `packages/core`**, viết `hashSharePassword`/`verifySharePassword` độc lập (`packages/core/src/download/share-link-password.ts`) — trùng thuật toán với `packages/auth/src/password.ts` nhưng không dùng chung code, giữ đúng chiều phụ thuộc package.

---

## 4. Hệ Quả & Ràng Buộc Kỹ Thuật (Consequences & Rules)
* **Không phải mọi bảng chứa dữ liệu nhạy cảm đều cần RLS** — `DownloadToken` là ví dụ có chủ đích: ranh giới bảo mật dựa trên "sở hữu token thô" thay vì cột `tenantId`/`userId`, giống các bảng token khác (`RefreshToken`, `VerificationToken`).
* **3 lỗ hổng trong quyết định này (2 RLS thiếu nhánh + 1 bỏ sót `withPublic()`) đều thuộc cùng một lớp lỗi** đã từng gặp ở module khác (xử lý webhook thanh toán) — bằng chứng đây là loại lỗi cần cảnh giác thường trực khi thêm một actor mới (customer) vào một bảng RLS đã tồn tại, không phải sự cố riêng lẻ.
* **Kỷ luật bắt lỗi:** cả 3 lỗ hổng được phát hiện và sửa **trước khi merge**, nhờ chạy integration test thật trên Neon (không mock DB) — đây là lý do dự án duy trì nguyên tắc không mock DB cho RLS test.
* **Cập nhật ADR-029 (2026-09-27) ✅ đọc migration:** policy `products`/`product_files` (gồm nhánh customer nói ở đây) được
  tách thành `select_access` (FOR SELECT, giữ nguyên điều kiện đọc) + `write_insert/update/delete` chỉ tenant hoặc
  `system_job` — nhánh customer giờ **chỉ đọc**. Xem [[01-Architecture-Decisions/ADR-015-M10-Reviews-Posts-Rls-Split-Writes|ADR-015 (≙ ADR-029)]].
* `packages/core` tiếp tục **không** phụ thuộc `packages/auth` dưới bất kỳ hình thức nào — mọi nhu cầu argon2/crypto trong `core` phải tự có dependency riêng, không import ngược.

---

## 5. Tài Liệu Tham Chiếu & Liên Kết
* [[MOC-Home]] — Trang chủ Map of Content ([MOC-Home.md](../00-Index/MOC-Home.md))
* Tương ứng **ADR-020** trong [`docs/DECISIONS.md`](../../docs/DECISIONS.md) (gốc repo).
* [[ADR-003-Postgres-App-Role-RLS]] — điều kiện tiên quyết để các policy RLS nói ở đây có hiệu lực thật.

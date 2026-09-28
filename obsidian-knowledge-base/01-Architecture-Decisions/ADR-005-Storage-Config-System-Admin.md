---
tags:
  - adr
  - storage
  - security
  - system-admin
  - status/accepted
date: 2026-09-26
decider: vtphong91
status: Accepted (Chốt — Áp dụng chính thức)
---

# 🏛️ ADR-005: Cấu Hình Storage (R2) Quản Lý Qua System Admin + Mã Hoá DB, Không Phải Biến Môi Trường

## 1. Trạng Thái (Status)
**ĐÃ PHÊ DUYỆT (Accepted)** — Áp dụng cho toàn bộ cấu hình endpoint/bucket/access key của storage layer.

---

## 2. Bối Cảnh (Context)
Kế hoạch M5 gốc đặt cứng cấu hình storage qua 7 biến môi trường `S3_*` (endpoint/region/access key/secret/2 bucket/public base URL). Người dùng yêu cầu tường minh chuyển sang "phát triển hạ tầng cấu hình upload ở Module system" (System Admin) thay vì `.env`.

Đây là quyết định ảnh hưởng bảo mật trực tiếp — đã trình bày đánh đổi trước khi làm: access key/secret của storage có quyền đọc/ghi/xoá **toàn bộ file của mọi tenant**, nhạy cảm hơn secret thanh toán từng tenant (secret thanh toán chỉ ảnh hưởng 1 tenant/1 phương thức). Đưa credential này vào DB (dù mã hoá) mở rộng bề mặt tấn công so với chỉ giữ trong biến môi trường của hạ tầng deploy.

---

## 3. Quyết Định (Decision)
Người dùng chọn quản lý qua System Admin (`/admin/settings/storage`), theo đúng pattern đã dùng cho `PlatformPaymentConfig`:

1. Bảng `SystemStorageConfig` (1 dòng duy nhất) gồm `publicConfig` (endpoint/bucket/region — không nhạy cảm) + `encryptedSecrets` (access key/secret — mã hoá AES-256-GCM trước khi lưu).
2. Form nhập trong UI System Admin, kèm nút "Kiểm tra kết nối" (gọi `HeadBucketCommand` thật lên cả 2 bucket để xác nhận credential hợp lệ).
3. Cơ chế **tự tắt an toàn**: khi đổi endpoint/bucket/access key so với bản đã lưu, cấu hình tự đặt về trạng thái chưa xác minh — admin phải bấm lại "Kiểm tra kết nối" và lưu để xác nhận cấu hình mới (cùng pattern với `PlatformPaymentConfig`).
4. **Mã hoá bằng key riêng `STORAGE_ENCRYPTION_KEY`**, không dùng chung `PAYMENT_ENCRYPTION_KEY` — lộ một key chỉ lộ đúng một miền secret (storage hoặc payment), không lộ cả hai cùng lúc.
5. Xoá 7 biến `S3_*` cũ khỏi `env.ts` — không còn code nào đọc trực tiếp. Các tham số vận hành không phải bí mật hạ tầng (`PRESIGN_*_TTL_SECONDS`, `CLAMAV_HOST`, `DEFAULT_DOWNLOAD_LIMIT`) vẫn giữ trong env như cũ.

**Tác dụng phụ tích cực:** hàm mã hoá AES-256-GCM generic (`encryptSecret`/`decryptSecret`/`maskSecret`) được chuyển từ `packages/payments` (nơi dùng đầu tiên) sang `packages/core/src/crypto/` — vị trí trung lập, dùng chung được cho cả payments lẫn storage, thay vì storage phải phụ thuộc ngược vào package payments chỉ để lấy hàm mã hoá không liên quan gì tới thanh toán.

---

## 4. Hệ Quả & Ràng Buộc Kỹ Thuật (Consequences & Rules)
* **UI không bao giờ hiện secret gốc** — chỉ hiện dạng che (`••••abcd`), đúng quy tắc bảo mật #3 (CLAUDE.md).
* **Đổi credential không cần redeploy** — tự phục vụ qua UI System Admin, không cần gửi secret qua ai để sửa `.env`.
* **Đánh đổi đã được cân nhắc và chấp nhận:** bề mặt tấn công tăng nhẹ (secret nằm trong DB, dù mã hoá) được đổi lại bằng cơ chế giảm rủi ro tương đương phần thanh toán (mã hoá riêng key + tự tắt khi thay đổi).
* Không bao giờ dùng chung `STORAGE_ENCRYPTION_KEY` và `PAYMENT_ENCRYPTION_KEY` cho mục đích khác miền — vi phạm sẽ làm mất tác dụng cách ly rủi ro đã thiết kế.

---

## 5. Tài Liệu Tham Chiếu & Liên Kết
* [[MOC-Home]] — Trang chủ Map of Content ([MOC-Home.md](../00-Index/MOC-Home.md))
* Tương ứng **ADR-017** trong [`docs/DECISIONS.md`](../../docs/DECISIONS.md) (gốc repo).
* Xem CLAUDE.md, mục "Quy tắc bảo mật" #3 (mã hoá AES-256-GCM) và #6 (URL tải chỉ presigned, sống ≤ 10 phút).

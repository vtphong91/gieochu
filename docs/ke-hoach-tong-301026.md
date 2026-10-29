# Kế hoạch tổng — 30/10/2026

Tổng hợp các kế hoạch và đề xuất **đã viết nhưng chưa triển khai** hoặc mới làm một phần, đối chiếu với `docs/PLAN.md` và code
ngày 30/10/2026.

## A. Kế hoạch lớn chưa bắt đầu

| # | Kế hoạch | File | Nội dung chính | Trạng thái | Chờ gì để bắt đầu |
|---|---|---|---|---|---|
| 1 | **Nâng cấp frontend công khai + blog** (ADR-064) | `ke-hoach-nang-cap-frontend-cong-khai-2026-10-27.md` (phân tích: `phan-tich-layout-frontend-cong-khai-2026-10-27.md`) | 9 giai đoạn: **0a** khung trang chung → **0b** trang chủ, gian hàng, tài liệu → **1** chữ đọc dài → **2** trang bài viết (`.html`) → **3** blog gian hàng + "Bài viết nổi bật" → **4a/4b** danh mục bài viết → **5a/5b/5c** blog hệ thống `/blog` | Đã chốt hết câu hỏi, **chưa code** | Chủ dự án commit đợt luồng mua; từ GĐ2 cần duyệt nâng trần test |
| 2 | **Kế hoạch SEO tổng thể** | Mục cuối `PLAN.md`, `ke-hoach-home-legal-menu-seo-2026-10-23.md` | Xem trước kết quả Google cho mọi editor, ảnh OG, sitemap/robots, dữ liệu cấu trúc (JSON-LD), SEO cho gian hàng và tài liệu | **Hoãn** (chủ dự án chốt 24/10) | Chủ dự án quyết thời điểm; nên làm sau blog |
| 3 | **Tự lưu nháp: gắn vào editor** | `ke-hoach-tu-luu-nhap-2026-10-24.md` | Phần nền đã xong; còn gắn tự lưu vào từng editor (sản phẩm, bài viết, CMS…) | Xong phần nền, **chưa gắn editor** | Chủ dự án bật đèn xanh |

## B. Đề xuất giao diện khách hàng: phần còn lại

Nguồn: `de-xuat-ui-khach-hang-ban-toi-uu-2026-10-26.md`. Phần trang thanh toán (T3, T4, MoMo) đã được thay bằng ADR-062 và đã
code.

| # | Việc | Trạng thái |
|---|---|---|
| T1 | **Trang 404 và trang lỗi tiếng Việt.** Trang lỗi khi hệ thống gặp sự cố dùng câu: "Hệ thống đang gặp sự cố và chúng tôi đang nỗ lực khắc phục, sẽ thông báo khi xử lý xong. Chân thành xin lỗi quý khách vì sự bất tiện này!" | **Chưa làm** — hệ thống chưa có trang 404/lỗi chung |
| T5 | **Khối mua theo trạng thái người xem:** khách đã mua thì hiện "Mở Thư viện", có đơn đang chờ thì hiện "Tiếp tục thanh toán" | Chưa làm |
| T6 | **Thử tải trên thiết bị thật:** Android, iPhone, trong Zalo và Facebook | Chủ dự án hẹn làm sau |
| — | **Form góp ý** ở trang Liên hệ | Chưa làm |
| — | **Nhập 3 trang hướng dẫn** vào CMS (đăng ký, kích hoạt, mua và tải) | Dự thảo xong, **chưa nhập**; trang "Mua và tải" chờ code luồng mua lên VPS |
| B-2…B-5 | Màn chờ cho trang gian hàng và bài viết; đưa trang link chia sẻ `/s/...` vào khung chung; "Bạn sẽ nhận được" (số file, định dạng); rà lại form đăng nhập | Chưa làm; một phần gộp vào GĐ0 của kế hoạch frontend |

## C. Đang chờ bên ngoài

| # | Việc | File | Chờ ai |
|---|---|---|---|
| 1 | **MinIO qua HTTPS** (ADR-055) — cần để tải file lên chạy được trên Vercel; kéo theo sắp xếp lại trang Cấu hình lưu trữ (ADR-058 task 1.10) và cấu hình CSP cho tên miền lưu trữ | `yeu-cau-vuong-minio-https-2026-10-25.md` | **Vương** |
| 2 | **Bucket riêng cho từng gian hàng** — code đã có, **migration chưa áp** | `PLAN.md` | Vương / chủ dự án |
| 3 | Thư viện `xlsx` (xem trước Excel trong Studio) có lỗ hổng bảo mật đã biết | — | Báo Vương |
| 4 | **Chạy thử beta:** thử SePay thật theo runbook, gửi email qua SMTP thật, cron trên VPS | `de-xuat-chay-thu-thanh-toan-goi-tai-lieu-2026-10-25.md`, runbook SePay trong KB | **Chủ dự án** (cần môi trường thật) |

## D. Việc nhỏ tồn đọng (mỗi việc dưới nửa ngày)

| Việc | Ai |
|---|---|
| Làm đẹp khối "Kích hoạt tài khoản để chọn…" ở Thư viện (tài liệu bị gỡ) | Phong |
| Giữ dấu tick ô đồng ý khi form khách vãng lai báo lỗi; link "Đăng nhập" điền sẵn email và quay về đúng trang thanh toán | Hiếu |
| Còn mã màu gõ cứng trong `fields.tsx` (form đăng nhập) và trang Bảo mật; nút ẩn/hiện mật khẩu chưa đủ 44px | Phong |
| Kiểm tra database có gian hàng tên `blog` / `danh-muc` | Hiếu, làm trước GĐ3 |

## Định hướng tương lai (chưa có kế hoạch chi tiết)

Ghi trong `tong-quan-he-thong-2026-10-27.md` và `GIEOCHU_TIPTAP_EDITOR_AI_ROADMAP_V1.0.md`: **AI hỗ trợ viết bài**, **AI phân tích
insights**, **tự động đăng lên fanpage Facebook**; cùng các mục GĐ6 (tìm kiếm, đăng ký nhận tin, bình luận) đã chốt không làm
đợt này.

## Thứ tự đề xuất

1. Commit đợt luồng mua.
2. **T1 — trang 404 và trang lỗi** (việc nhỏ, nên có trước beta).
3. **GĐ0a** của kế hoạch frontend.
4. Các giai đoạn frontend tiếp theo.

Song song: chủ dự án chạy thử beta (C4) khi có môi trường thật.

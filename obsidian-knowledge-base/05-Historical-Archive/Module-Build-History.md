---
tags:
  - archive
  - gieochu
  - history
  - modules
date: 2026-09-26
---

# Module Build History — Gieo Chữ

Timeline thật, dựng từ [`docs/PLAN.md`](../../docs/PLAN.md) (thứ tự triển khai + mô tả từng module) đối chiếu
với `git -C . log --reverse --date=short --pretty=format:"%ad %s"` chạy thật ngày 2026-09-26.

**Kết quả git log thật:** 18 commit, từ **2026-09-17** đến **2026-09-20**.

## Thứ tự triển khai thực tế (theo PLAN.md)

M0 → M1 (kèm khung email M11) → M4 → M2 (phần cơ bản) → M7 → M3 → M5 → M6 → M8 → M9 → M3 v2 (Hybrid
Monetization) → M10 → M12 → hoàn thiện M2.

## Timeline module — commit thật vs. chưa commit

| Module | Tên/phạm vi (theo PLAN.md) | Ngày commit thật | Commit | Ghi chú |
|---|---|---|---|---|
| M0 | Nền móng dự án: monorepo, `packages/config`/`core`/`db` (schema tối thiểu), `docker/`, `apps/web` shell | 2026-09-17 | `feat: scaffold M0 monorepo foundation` | Có commit thật, đúng ngày đầu repo. |
| M1 | Xác thực và định danh: `packages/auth`, `packages/email`, `packages/jobs`, trang `(auth)`/`account` | 2026-09-17 | `feat: implement M1 authentication and identity` | Có commit thật, cùng ngày M0. |
| M4 | Tenant Workspace và Storefront: `/[tenantSlug]`, `/studio`, `packages/db/src/rls.ts` | 2026-09-18 | `feat: implement M4 tenant workspace and storefront` | Có commit thật. |
| M2 | System Admin (cơ bản): `/admin`, `packages/core/src/admin` | 2026-09-18 | `feat: implement M2 system admin console (basic)` | Có commit thật. PLAN.md ghi rõ phần "hoàn thiện M2" (Platform Payment UI, audit log viewer) vẫn đang chờ M7/M12 — chưa làm. |
| M7 | Cấu hình Tenant Payment: `packages/payments` | 2026-09-18 | `feat: implement M7 tenant payment configuration` | Có commit thật. |
| M3 (v1) | Billing, Subscription & Entitlements (bản đầu, subscription-first) | 2026-09-18 | `feat: implement M3 subscription and platform billing` | Có commit thật. Sau đó được thay bằng M3 v2 (xem dưới). |
| M5 (phần 1) | Sản phẩm và File tài liệu — metadata/CRUD, chưa có storage thật (ADR-014) | 2026-09-18 | `feat: implement M5 product CRUD and file metadata (part 1, no live storage yet)` | Có commit thật. |
| M5 (hạ tầng storage) | Quản lý credential storage qua System Admin thay vì env vars (ADR-017) | 2026-09-18 | `feat: manage storage credentials via System Admin instead of env vars` | Có commit thật. |
| M5 (phần upload) | Upload pipeline thật: presign, complete, job `file.scan` | 2026-09-18 | `feat: implement M5 upload pipeline (presign, complete, file.scan)` | Có commit thật. |
| M6 | Giá và Khuyến mãi: `packages/core/src/pricing`, coupon CRUD | 2026-09-18 | `feat: implement M6 pricing engine and coupons` | Có commit thật. |
| M8 | Checkout và Đơn hàng: `order.ts`, `payment-process.ts`, trang checkout/orders | 2026-09-18 | `feat: implement M8 checkout and orders` | Có commit thật. |
| M9 | Thư viện, Tải xuống, Share link: `download.ts`, `share-link.ts`, `library.ts` | 2026-09-18 | `feat: implement M9 library, downloads, and private share links` | Có commit thật. |
| M3 v2 | Hybrid Monetization (Free Forever + Paid Subscription) — thay cho M3 v1, xem ADR-021 | 2026-09-18 | `feat: implement M3 v2 hybrid monetization (Free Forever + Paid Subscription)` | Có commit thật. |
| — | 2 fix nhỏ: seed `UserProfile` cho admin; CSP nonce cho App Router hydration + M5 sale price/remove file | 2026-09-18 | `fix(db): seed a UserProfile row...`, `fix(web): CSP nonce for App Router hydration...` | Sửa lỗi thật phát hiện khi smoke-test qua trình duyệt (xem ADR-016, BACKLOG "2 bug thật"). |
| — | UI 18.09 / layout UI home 19.09 / UI customer 20.09, Tenant UI | 2026-09-18 → 2026-09-20 | `UI 18.09`, `layout UI home 19.09`, `UI customer 20.09, Ternant UI` | Commit UI không gắn message theo mã module — không thể quy về M-nào cụ thể từ message commit. |
| M10 | Social Feed và Đánh giá | **Chưa có commit** | — | PLAN.md: "⬜ Chưa làm". Không tồn tại trong git log. |
| M11 | Email và Background Jobs | Khung nằm chung commit M1 | `feat: implement M1 authentication and identity` | PLAN.md: "🟡 Khung đã có (cùng M1)" — job/worker cho nghiệp vụ khác (M3 sweep, M8 payment-process...) không có commit riêng, nằm trong phần dưới. |
| M12 | Audit Log, Thống kê, Báo cáo vi phạm | **Chưa có commit** | — | PLAN.md: "⬜ Chưa làm". |

## Phần quan trọng: rất nhiều việc trong PLAN.md KHÔNG có commit git tương ứng

`docs/PLAN.md` mô tả chi tiết rất nhiều việc — ví dụ toàn bộ **ADR-011 trở đi** (`platform_payment_configs`
sớm ở M7, VietQR/CRC16, dedupe hoá đơn PENDING (ADR-013), M5 storage infra + upload pipeline thật, CSP nonce,
webhook qua job `payment.process`, 3 lỗ hổng RLS sửa ở M9, toàn bộ **RBAC ADR-022** với bảng `Role`/
`Permission`, sửa bug redirect landing path), cũng như **toàn bộ phần UI Studio/Customer redesign** và
**tính năng chống login-lockout** — không xuất hiện trong 18 commit ở trên bằng tên rõ ràng, hoặc không có
commit nào cả.

Đây **không phải một khoảng trống cần lấp** — đây là hệ quả đúng của quy trình làm việc thật của dự án: các
phiên làm việc dài trên repo này không tự động commit; assistant chỉ tạo commit khi được yêu cầu rõ ràng
(xem `CLAUDE.md`, mục "Committing changes with git"). Rất nhiều nội dung trong `docs/PLAN.md`/`docs/DECISIONS.md`
mô tả công việc đã hoàn thành và đã xác minh chạy được (`pnpm lint/typecheck/test/build` xanh, số liệu test
cộng dồn tăng dần theo từng mục PLAN.md), nhưng vẫn nằm trong working tree, **chưa từng được `git commit`**
tính tới thời điểm dựng lại thư mục này (2026-09-26).

Ghi lại điều này ở đây để không ai sau này nhầm rằng "không có commit" đồng nghĩa "chưa từng làm" — hai việc
độc lập với nhau trong quy trình của dự án này.

*Xem thêm: [[Architecture-Decisions-Timeline]] · [[Known-Gaps-And-Backlog]]*
*Quay lại: [[05-Historical-Archive/README|05-Historical-Archive]] · [[MOC-Home]] (../00-Index/MOC-Home.md)*

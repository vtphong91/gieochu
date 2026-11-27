---
tags:
  - runbook
  - dev-tool
  - reviews
  - security
  - status/living
date: 2026-09-28
updated: 2026-10-15
author: Long (tài liệu)
---

# 🚀 Cẩm Nang: Dữ Liệu Demo Cho DB Dev (`demo:seed` / `demo:clean`)

> ⚠️ **CÔNG CỤ CHỈ DÀNH CHO MÔI TRƯỜNG DEV.** Không chạy trên staging/production, không phải seed chính
> (`packages/db/prisma/seed.ts` — `pnpm db:seed`). Script tự từ chối chạy nếu không qua đủ chốt an toàn (§2).
> Mức xác minh: ✅ đã đọc code `apps/web/scripts/demo-reviews.ts` ngày 2026-09-28 · 🟡 theo báo cáo · ❓ cần chạy thật.
> Long **chưa tự chạy** script — mọi kết quả chạy thật là ❓.


> ⚠️ **Dữ liệu demo đang nằm trên PRODUCTION (ADR-034, 2026-10-15)** 🟡 — chủ dự án quyết dùng **một database duy nhất** cho
> máy dev, Vercel Preview và Production
> ([[01-Architecture-Decisions/ADR-020-Single-Database-Dev-Preview-Production|ADR-020 (≙ ADR-034)]]). "DB dev" trong trang này
> **chính là DB production**: 5 khách `demo+…@gieochu.test`, 3 sản phẩm `demo-*` và đơn/đánh giá của tenant `phongweb` đang
> **hiển thị công khai** và được tính vào số liệu thật trên trang chủ (ADR-033).
> - **Bắt buộc chạy `demo:clean` trước khi mở cho người dùng thật** (Deploy-Vercel-Runbook §9.3).
> - **Không chạy lại `demo:seed`** khi chưa được Quốc duyệt.
> - **Không** thêm host DB production vào `DEMO_SEED_BLOCKED_DB_HOSTS` — chốt này chặn cả `demo:clean` ✅ (`assertDevEnvironment()`
>   chạy trước cả `seed` lẫn `clean`).

## 1. Mục Đích & Vị Trí

- Tạo dữ liệu giả để xem giao diện **Đánh giá (M10a)** và **editor sản phẩm** trên tenant `phongweb` của DB dev: trang chi
  tiết tài liệu, section "Đánh giá" storefront, Thư viện khách, Studio → Đánh giá. Đáp ứng mục BACKLOG "Seed dữ liệu demo"
  của đợt M10a. **Không tạo bài viết (M10b).**
- File: `apps/web/scripts/demo-reviews.ts` (chạy bằng `tsx`). Đặt ở `apps/web` (không phải `packages/db`) để **đi qua đúng lib
  nghiệp vụ thật**: `createProduct` → `addProductExternalLink` → `publishProduct` (`canPublishProduct` + giới hạn gói, không bỏ
  qua), `markOrderPaid`, `upsertMyReview` (RLS customer), `replyToReview`/`hideReview` (RLS tenant + trigger
  `reviews_guard_columns`), `recomputeProductRatings` (`system_job`) ✅.
- **Không gửi email nào** ✅: không gọi `createOrder`/`changeOrderStatusBySeller` (2 hàm này gửi email đơn hàng; `confirmOrderManually` đã xoá — ADR-074 mục 8) và không đi qua
  Server Action (email `review_new` chỉ được gửi trong `after()` của action, không phải trong `upsertMyReview`).

## 2. Chốt An Toàn ✅

Script dừng với `[demo] TỪ CHỐI CHẠY: ...` (exit 1) nếu vi phạm bất kỳ điều nào:

| Chốt | Chi tiết |
| :-- | :-- |
| `NODE_ENV` | Khác `production` — kiểm **cả trước lẫn sau** khi nạp `.env` ở root repo |
| `ALLOW_DEMO_SEED` | Phải đúng `"1"` — xác nhận có chủ ý đây là DB dev |
| `APP_URL` | Host phải là `localhost`, `127.0.0.1`, `::1` hoặc `[::1]` (dấu hiệu môi trường dev) |
| `DEMO_SEED_BLOCKED_DB_HOSTS` | Tuỳ chọn — danh sách host DB prod/staging, phân tách dấu phẩy. Host của `DATABASE_URL` trùng hoặc là subdomain của một mục → từ chối. Biến này **không** có trong `.env.example` / schema env (đọc thẳng `process.env`) |
| Tenant | Phải có tenant slug `phongweb`, trạng thái `ACTIVE` (seed) |
| Slug | Nếu slug sản phẩm demo bị đổi khi tạo (đã có sản phẩm trùng slug) → dừng để không lẫn dữ liệu thật |
| Dọn | Nếu có dòng đơn của tài khoản **không phải demo** chứa sản phẩm demo → dừng, không xoá |

Trước khi chạy script in ra `[demo] DB host: <host> — APP_URL: <url>` — đọc lại để chắc đúng DB dev.

## 3. Lệnh

Chạy từ root repo (script nạp `.env` ở root; env vẫn fail-fast qua zod như app):

```bash
ALLOW_DEMO_SEED=1 pnpm --filter @gieochu/db run demo:seed    # dọn demo cũ rồi seed lại (idempotent)
ALLOW_DEMO_SEED=1 pnpm --filter @gieochu/db run demo:clean   # xoá đúng và chỉ dữ liệu demo
```

PowerShell:

```powershell
$env:ALLOW_DEMO_SEED="1"; pnpm --filter @gieochu/db run demo:seed
$env:ALLOW_DEMO_SEED="1"; pnpm --filter @gieochu/db run demo:clean
```

`@gieochu/db` chỉ chuyển tiếp sang `pnpm --filter @gieochu/web run demo:seed|demo:clean` → `tsx scripts/demo-reviews.ts
seed|clean` ✅ (`package.json` hai gói). `seed` luôn gọi `clean` trước.

## 4. Dữ Liệu Tạo Ra (lệnh `seed`) ✅ (đọc code)

- **3 sản phẩm demo** trong tenant `phongweb`, slug tiền tố `demo-`, đều được xuất bản qua `publishProduct`, mỗi sản phẩm có 1
  link tài liệu ngoài (Google Drive giả):
  - `demo-bo-de-kiem-tra-toan-6-hoc-ky-1` — EXAM, **0đ**;
  - `demo-slide-bai-giang-ngu-van-9` — SLIDE, 149 000đ, **giảm còn 99 000đ trong 30 ngày**;
  - `demo-ebook-phuong-phap-day-hoc-tich-cuc` — EBOOK, 199 000đ.
- **Danh mục:** dùng danh mục `isActive` cũ nhất có sẵn; chỉ khi DB chưa có danh mục active nào mới tạo `demo-tai-lieu-mau`
  ("Tài liệu mẫu (demo)").
- **Ảnh bìa:** URL Cloudinary có sẵn trong DB (ưu tiên cloud hệ thống), nếu không có thì `<cloud hệ thống>/image/upload/sample`;
  không có cả hai → lỗi.
- **5 khách demo** `demo+minhanh|thuha|quocbao|ngoclan|thanhtung@gieochu.test` (TLD `.test` dành riêng — không thể là người
  thật), mật khẩu chung **`Demo@12345`**, `ACTIVE`, đã xác minh email, có `UserProfile`.
- **11 đơn `FULFILLED`** (khách 1 mua 3 sản phẩm, 4 khách còn lại mỗi người 2) — giá tính lại bằng `calculateOrderPricing`, đơn
  `PENDING` dưới `withTenant` rồi `markOrderPaid` (đơn 0đ nhánh `ZERO_AMOUNT`, đơn có phí nhánh xác nhận thủ công có ghi chú) →
  entitlement + `tenant_customers`.
- **9 đánh giá** (1–5 sao, có/không nội dung): 2 có trả lời của tenant, 1 bị ẩn lý do `SPAM`; khách `thanhtung` có đơn nhưng
  **chưa đánh giá** (để thử form viết). Cuối cùng tính lại điểm TB 3 sản phẩm.
- Kết thúc in bảng tóm tắt: link storefront, Studio, trang/editor từng sản phẩm, điểm TB, danh sách tài khoản demo. Link trang
  sản phẩm dựng bằng `productPath` → `<APP_URL>/<tenantSlug>/<productSlug>` (ADR-030 ✅ `scripts/demo-reviews.ts`); link editor
  vẫn là `/studio/<tenantSlug>/products/<productId>`.

## 5. Nhận Diện & Dọn (lệnh `clean`) ✅ (đọc code)

Dữ liệu demo nhận diện bằng **danh sách cố định**: 5 email demo, 3 slug sản phẩm `demo-...` trong `phongweb`, 1 slug danh
mục `demo-tai-lieu-mau`. Mọi đơn/entitlement/review/`tenant_customers` của 5 user demo đều là dữ liệu demo. Thứ tự dọn:

1. Đánh giá của khách demo — xoá dưới `withCustomer` (chỉ scope customer được DELETE `reviews`).
2. Dữ liệu L2 của khách demo ở **mọi tenant** (thường chỉ `phongweb`), mỗi tenant dưới `withTenant` của chính nó:
   `download_events`, entitlement, đơn, `tenant_customers`, rồi 3 sản phẩm demo (`product_files`/`share_links`/review còn lại
   xoá theo FK CASCADE).
3. L1: 5 user demo (profile, token → CASCADE).
4. Danh mục demo — **chỉ xoá khi không còn sản phẩm nào** (kể cả sản phẩm thật) dùng nó; ngược lại giữ lại và báo.
5. Tính lại điểm TB cho **sản phẩm thật** từng được khách demo đánh giá.

## 6. Lưu Ý

- Tên file là `demo-reviews.ts` nhưng script cũng tạo sản phẩm để xem editor sản phẩm.
- `publishProduct` áp giới hạn gói thật — gói hiện tại của `phongweb` hết chỗ xuất bản thì seed dừng giữa chừng ❓ (chưa thử);
  chạy lại `demo:seed` sẽ dọn trước rồi làm lại.
- Script không dọn `tenant_media_assets` (không upload ảnh) và không động tới bài viết.
- Kết quả chạy thật trên Neon dev (RLS customer cho `upsertMyReview`, trigger) ❓ — Long chưa chạy.

## 7. Liên Kết

* [[MOC-Home]] ([MOC-Home.md](../00-Index/MOC-Home.md)) · [[04-Operations-Runbooks/README|04-Operations-Runbooks]] ([README.md](./README.md))
* [[02-System-Specs/Reviews-Specs|Reviews-Specs]] ([Reviews-Specs.md](../02-System-Specs/Reviews-Specs.md)) — nghiệp vụ đánh giá
* [[02-System-Specs/Order-State-Machine|Order-State-Machine]] ([Order-State-Machine.md](../02-System-Specs/Order-State-Machine.md)) — `markOrderPaid`
* [[04-Operations-Runbooks/Publish-And-Rollback-Runbook|Publish-And-Rollback-Runbook]] ([Publish-And-Rollback-Runbook.md](./Publish-And-Rollback-Runbook.md)) — biến môi trường

*Quay lại: [[MOC-Home]] (../00-Index/MOC-Home.md)*

---
tags:
  - meta
  - runbook
date: 2026-09-26
updated: 2026-10-15
---

# 🚀 Operations Runbooks & DevOps

Thư mục này chứa **cẩm nang vận hành, quy trình phát hành/rollback, và chuẩn giao diện dùng chung** cho
Gieo Chữ — SaaS đa tenant **web-only** (Next.js 16 App Router), nơi giáo viên/coach bán học liệu số cho học
viên.

## Danh mục Runbooks:

- `[[Disaster-Recovery-Runbook]]`: Ứng phó sự cố Neon Postgres (Point-in-Time Restore, role `gieochu_app` —
  ADR-010), sự cố object storage R2/S3-compatible (ADR-017), và quy trình rebuild môi trường từ đầu.
- `[[Publish-And-Rollback-Runbook]]`: Checklist biến môi trường trước deploy, quy trình phát hành thủ công
  (chưa có CD tự động — chỉ có CI kiểm thử qua `.github/workflows/ci.yml`), và quy trình rollback code/DB
  khẩn cấp; §4.2.1 ghi sự cố 2026-10-15 (drop cột trên DB dùng chung) và quy tắc expand → contract.
- `[[UI-Design-System]]`: Design tokens (màu, font), chuẩn độ rộng layout `container-page/prose/narrow` (ADR-024), giao diện storefront tenant (theme `--sf-*`, primitives, pattern form/editor CMS — ADR-023), bộ component dùng chung `admin/_ui/kit.tsx` và bộ icon
  `admin/_ui/icons.tsx` — dùng chung giữa System Center (`/admin`) và Studio (`/studio/[tenantSlug]`); editor sản phẩm
  Studio 2 cột + card xuất bản đầu sidebar (không dính khi cuộn — ADR-030) + thanh lưu nhanh dưới xl, chế độ hiển thị, trang Xem trước, TiptapEditor
  upload ảnh Cloudinary (ADR-026/027/028, §9); giao diện đánh giá M10a — `ReviewStars`, `ProductReviewsSection`,
  `ReviewComposer`, section Đánh giá storefront, `StudioReviewCard` (ADR-029, §10); giao diện bài viết M10b — Studio → Bài viết, editor bài viết,
  trang hệ thống `/[slug]/posts`, section `posts` storefront, quy tắc sanitize lại khi render HTML (ADR-029, §11); trang chủ dữ liệu thật (thẻ link phủ cả thẻ, định dạng "1.200+", chip tĩnh + `<details>`), `PinPicker`, form "Cấu hình chung", menu System Center, a11y kit `TextField`/`SelectField`/`Toggle`/icon (ADR-032/033, §12). `[[Publish-And-Rollback-Runbook]]` §2.2 có số test hiện tại và quy tắc
  integration test không xoá cấu hình dùng chung (`shared-config-snapshot.ts`).
- `[[Deploy-Vercel-Runbook]]`: Deploy app lên **Vercel** theo ADR-031/032 — cấu hình project (Root Directory `apps/web`,
  `vercel.json` `buildCommand: "next build"`), env runtime **8 biến bắt buộc** + biến cần xoá trên Vercel + biến **không** đặt
  (`PRISMA_MIGRATE_URL`…), chuẩn bị DB prod từ máy dev (`setup-app-role`, `db:migrate`, `db:seed`, quét slug dành riêng),
  cấu hình Admin sau deploy, worker pg-boss cần host riêng, 5 sự cố đã gặp (gồm 500 production 2026-10-15), rủi ro client
  Prisma commit lệch schema, §9 một DB duy nhất (ADR-034) — migration expand → contract, kỷ luật thao tác DB, dọn demo trước go-live. Bản ADR-032/033 chưa deploy ❓ ([Deploy-Vercel-Runbook.md](./Deploy-Vercel-Runbook.md)).
- `[[Dev-Demo-Data-Runbook]]`: **Công cụ chỉ cho dev** — script `apps/web/scripts/demo-reviews.ts`
  (`ALLOW_DEMO_SEED=1 pnpm --filter @gieochu/db run demo:seed|demo:clean`): chốt an toàn, dữ liệu demo đánh giá trên tenant
  `phongweb` (3 sản phẩm, 5 khách, 11 đơn FULFILLED, 9 đánh giá), cách nhận diện và dọn
  ([Dev-Demo-Data-Runbook.md](./Dev-Demo-Data-Runbook.md)).

## Phạm vi

KB đã được dọn các tài liệu không thuộc Gieo Chữ. Gieo Chữ **không có ứng dụng mobile nào** (không quy trình nộp
App Store/Google Play, không push notification) nên thư mục này không có runbook mobile. Nếu sau này thêm ứng
dụng mobile (mục "Giai đoạn 4 — Chuyên sâu và mở rộng" trong `docs/PLAN.md` có nhắc "ứng dụng mobile" như một
hướng phát triển xa), viết runbook mới từ đầu dựa trên stack thật được chọn lúc đó.

*Quay lại: [[MOC-Home]] (../00-Index/MOC-Home.md)*

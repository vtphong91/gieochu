---
tags:
  - adr
  - database
  - deployment
  - security
  - status/accepted
date: 2026-10-15
decider: vtphong91
status: Accepted (Chốt — Áp dụng chính thức)
---

# 🏛️ ADR-020: Một Database Duy Nhất Cho Dev, Preview Và Production

## 1. Trạng Thái (Status)
**ĐÃ PHÊ DUYỆT (Accepted)** — tương ứng **ADR-034** trong [`docs/DECISIONS.md`](../../docs/DECISIONS.md) (chủ dự án quyết
2026-10-15). **Thay thế** khuyến nghị "tách DB dev bằng Neon branch" nêu sau sự cố 2026-10-15
([[01-Architecture-Decisions/ADR-018-System-Settings-And-Brand-From-System-Center|ADR-018 (≙ ADR-032)]] §5). Quy trình thao tác:
[[04-Operations-Runbooks/Deploy-Vercel-Runbook|Deploy-Vercel-Runbook]] §9.

Mức xác minh: ✅ Long đã đối chiếu code/`CLAUDE.md` (2026-10-15) · 🟡 theo `docs/DECISIONS.md`/brief của Quốc · ❓ cần môi
trường thật.

---

## 2. Bối Cảnh (Context)
Sau sự cố drop cột `platformName` (migration chạy trên DB dev cũng là DB production → production 500), Quốc đề xuất tách DB dev
bằng Neon branch. Chủ dự án quyết định **không tách**: máy dev, Vercel Preview và Production cùng dùng **một** database Neon 🟡.

---

## 3. Quyết Định (Decision)
Một DB duy nhất. Hệ quả bắt buộc — **mọi thao tác DB trên máy dev là thao tác trên production**:
1. **Migration** chỉ do Quốc duyệt và chạy; theo **expand → contract** (deploy chỉ *thêm*; `DROP`/`RENAME` chỉ chạy sau khi code
   không còn dùng cột đã lên production). **Không** `prisma migrate dev` / `prisma migrate reset`.
2. **Không chạy `pnpm db:seed`** — seed ghi đè nội dung trang chủ CMS (`CmsPage` slug `home`, `update: { blocks, blocksDraft:
   null }` ✅ `packages/db/prisma/seed.ts`). Thay đổi dữ liệu hệ thống qua UI System Center.
3. **Integration test và script thủ công ghi dữ liệu thật** vào production (tạo rồi dọn user/tenant/đơn tạm, có thể gửi email
   tới `@example.test`). Chỉ chạy khi cần; luôn dọn dữ liệu, không đụng cấu hình dùng chung (từ 2026-10-25: **mock lớp đọc cấu hình** — `lib/system-storage`,
   `getPlatformPaymentConfigRow` — không ghi, không snapshot/restore bảng singleton; helper `shared-config-snapshot` đã xoá — theo
   ADR-034 mục 3 đã sửa trong `docs/DECISIONS.md`), không
   chạy luồng gửi email tới địa chỉ thật.
4. **Dữ liệu demo** (`demo:seed` — khách `demo+…@gieochu.test`, sản phẩm `demo-*` của tenant `phongweb`) **đang nằm trên
   production và hiển thị công khai** 🟡 — phải dọn bằng `demo:clean` trước khi mở cho người dùng thật.
5. **Preview deployment** ghi vào cùng DB — chỉ dùng Preview để **xem giao diện**, không tạo/xoá dữ liệu.

---

## 4. Hệ Quả & Ràng Buộc Kỹ Thuật (Consequences & Rules)
* `CLAUDE.md` mục "Một DB duy nhất (ADR-034)" đã ghi các ràng buộc trên ✅ (đọc 2026-10-15); Team-Charter ràng buộc 12–13 khớp.
* **Không** thêm host DB production vào `DEMO_SEED_BLOCKED_DB_HOSTS` — chốt này áp cho cả `demo:clean`, thêm vào sẽ chặn luôn
  việc dọn demo ✅ (đọc `apps/web/scripts/demo-reviews.ts`: một hàm chốt chung). Các chốt còn lại (`NODE_ENV` khác production,
  `ALLOW_DEMO_SEED=1`, `APP_URL` localhost) vẫn chạy được từ máy dev trỏ DB production.
* Rollback DB bằng Point-in-Time Restore ảnh hưởng **cả** dev và Preview — chỉ dùng khi bất khả kháng (roll-forward trước).
* Mọi rủi ro trước đây ghi "DB dev = DB production cho tới khi tách" nay là **trạng thái lâu dài**, không còn việc "tách DB" ở
  BACKLOG.

---

## 5. Chưa Verify ❓
* Lượng dữ liệu demo/test tạm thực tế đang nằm trên production; `demo:clean` chạy trên production chưa thử.
* Preview deployment trên Vercel đang trỏ đúng DB này (cấu hình env Preview) — chưa kiểm.

---

## 6. Tài Liệu Tham Chiếu & Liên Kết
* [[MOC-Home]] — Trang chủ Map of Content ([MOC-Home.md](../00-Index/MOC-Home.md))
* Tương ứng **ADR-034** trong [`docs/DECISIONS.md`](../../docs/DECISIONS.md) (gốc repo).
* [[01-Architecture-Decisions/ADR-018-System-Settings-And-Brand-From-System-Center|ADR-018 (≙ ADR-032)]] — sự cố 2026-10-15 ([ADR-018-System-Settings-And-Brand-From-System-Center.md](./ADR-018-System-Settings-And-Brand-From-System-Center.md))
* [[04-Operations-Runbooks/Deploy-Vercel-Runbook|Deploy-Vercel-Runbook]] §9 ([Deploy-Vercel-Runbook.md](../04-Operations-Runbooks/Deploy-Vercel-Runbook.md))
* [[04-Operations-Runbooks/Publish-And-Rollback-Runbook|Publish-And-Rollback-Runbook]] ([Publish-And-Rollback-Runbook.md](../04-Operations-Runbooks/Publish-And-Rollback-Runbook.md))
* [[04-Operations-Runbooks/Dev-Demo-Data-Runbook|Dev-Demo-Data-Runbook]] ([Dev-Demo-Data-Runbook.md](../04-Operations-Runbooks/Dev-Demo-Data-Runbook.md))

*Quay lại: [[MOC-Home]] (../00-Index/MOC-Home.md)*

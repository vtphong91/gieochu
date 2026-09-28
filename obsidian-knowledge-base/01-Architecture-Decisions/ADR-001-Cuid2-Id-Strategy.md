---
tags:
  - adr
  - database
  - id-strategy
  - status/accepted
date: 2026-09-26
decider: vtphong91
status: Accepted (Chốt — Áp dụng chính thức)
---

# 🏛️ ADR-001: Chiến Lược Định Danh — cuid2 Cho Mọi Model

## 1. Trạng Thái (Status)
**ĐÃ PHÊ DUYỆT (Accepted)** — Áp dụng cho **mọi** model Prisma trong toàn bộ hệ thống Gieo Chữ (cả 3 layer L1/L2/L3), không có ngoại lệ.

---

## 2. Bối Cảnh (Context)
Đặc tả gốc của dự án (mục 3, `docs/GIEOCHU_PROMPT_MVP_PHASE1.md`) yêu cầu "Mọi ID dùng cuid2 hoặc UUID v7 (chọn một)" — để ngỏ 2 lựa chọn, không chốt sẵn một chuẩn duy nhất.

Hai lựa chọn có đánh đổi khác nhau:
- **UUID v7:** cần thư viện ngoài để sinh đúng chuẩn v7 (UUID v4 mặc định của nhiều ORM không sắp xếp được theo thời gian tạo).
- **cuid2:** Prisma hỗ trợ sinh trực tiếp qua thuộc tính schema gốc, không cần cài thêm package, kết quả ngắn hơn UUID và tự nhiên sắp xếp được theo thời gian tạo (tốt cho index B-tree).

---

## 3. Quyết Định (Decision)
Dùng **cuid2** cho mọi `@id` trong schema Prisma, qua thuộc tính gốc:

```prisma
id String @id @default(cuid(2))
```

Không dùng UUID (bất kỳ version nào), không tự viết hàm sinh ID riêng. Áp dụng đồng nhất cho toàn bộ 3 layer: bảng L1 (users, tokens, plans...), bảng L2 (có `tenantId`, chịu RLS), và mọi bảng L3.

---

## 4. Hệ Quả & Ràng Buộc Kỹ Thuật (Consequences & Rules)
* **Không cần thêm dependency:** Prisma sinh cuid2 ở tầng ứng dụng (application-level default), đã được xác minh hỗ trợ native trong Prisma Schema Reference — không cần cài thư viện `uuid`/`ulid` nào.
* **Lợi ích index:** cuid2 sắp xếp được theo thời gian tạo gần đúng, giúp index chính (PK) trên các bảng lớn (ví dụ `orders`, `products`) hiệu quả hơn so với UUID v4 ngẫu nhiên hoàn toàn.
* **Ràng buộc cho người viết module mới:** bất kỳ model mới thêm vào `packages/db/prisma/schema.prisma` đều phải dùng đúng `@id @default(cuid(2))` — không tự ý đổi sang `autoincrement()` hay UUID vì bất kỳ lý do "tiện" nào.

---

## 5. Tài Liệu Tham Chiếu & Liên Kết
* [[MOC-Home]] — Trang chủ Map of Content ([MOC-Home.md](../00-Index/MOC-Home.md))
* Tương ứng **ADR-001** trong [`docs/DECISIONS.md`](../../docs/DECISIONS.md) (gốc repo) — nguồn đầy đủ, có 24 ADR (ADR-001…ADR-024).
* [[ADR-003-Postgres-App-Role-RLS]] — Role Postgres riêng cho app, RLS có hiệu lực thật.

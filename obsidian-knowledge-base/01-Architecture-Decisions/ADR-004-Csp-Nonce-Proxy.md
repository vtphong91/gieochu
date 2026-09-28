---
tags:
  - adr
  - security
  - csp
  - proxy
  - status/accepted
date: 2026-09-26
decider: vtphong91
status: Accepted (Chốt — Áp dụng chính thức)
---

# 🏛️ ADR-004: Sinh CSP Động Trong `proxy.ts` Với Nonce Theo Từng Request

## 1. Trạng Thái (Status)
**ĐÃ PHÊ DUYỆT (Accepted)** — Áp dụng cho toàn bộ response HTML của `apps/web`.

---

## 2. Bối Cảnh (Context)
Khi test đăng nhập qua trình duyệt thật lần đầu (mọi smoke-test trước đó chỉ qua `curl`), phát hiện form đăng nhập lộ mật khẩu lên URL. Nguyên nhân gốc: `next.config.ts` đặt CSP tĩnh `script-src 'self'` (không `unsafe-inline`, không nonce) — chặn đứng đoạn inline `<script>` mà Next.js App Router tự chèn **mỗi request** để hydrate dữ liệu RSC (React Server Components).

Không có nonce, React không hydrate được ở **bất kỳ trang nào có tương tác** (form, `useActionState`, client component) — cả dev lẫn production. Console log xác nhận đây là lỗi CSP chặn "inline script", không phải vấn đề riêng của dev/hot-reload như suy đoán ban đầu.

---

## 3. Quyết Định (Decision)
Chuyển việc sinh CSP sang `proxy.ts` — nơi duy nhất chạy được ở mỗi request để tạo một nonce ngẫu nhiên mới:

- `script-src 'self' 'nonce-<random>' 'strict-dynamic'`
- Thêm `unsafe-eval` **chỉ khi** `NODE_ENV !== "production"` (Turbopack/webpack dev HMR cần `eval()` — một vấn đề khác, không liên quan tới lỗi hydrate ở trên).

Theo đúng pattern nonce chính thức của Next.js (`https://nextjs.org/docs/app/guides/content-security-policy`).

`next.config.ts` chỉ còn giữ 2 header **không đổi theo request**: `X-Content-Type-Options`, `Referrer-Policy`.

---

## 4. Hệ Quả & Ràng Buộc Kỹ Thuật (Consequences & Rules)
* **`proxy.ts` là nơi duy nhất sinh CSP** — không thêm CSP tĩnh trở lại vào `next.config.ts`, vì làm vậy sẽ tái tạo đúng lỗi ban đầu (chặn hydrate).
* **Không dùng `unsafe-inline` vĩnh viễn cho `script-src`** ở production — nonce + `strict-dynamic` là cách duy nhất vừa giữ CSP chặt vừa cho phép cơ chế hydrate nội bộ của Next.js hoạt động.
* **`proxy.ts` không thay `middleware.ts`** về vai trò bảo mật: nó chỉ gắn `x-request-id`, làm redirect thô, và (từ quyết định này) sinh CSP nonce — **không** phải nơi xác thực người dùng. Mọi route handler/server action/server component nhạy cảm vẫn phải tự `requireUser()`/`requireRole()` lại (xem CLAUDE.md, mục "Cấu trúc thư mục").
* Ghi ADR vì đây là thay đổi vị trí cấu hình bảo mật (CSP) khỏi nơi đặc tả gốc nhắc tới (`next.config.ts`) sang `proxy.ts` — không phải một trong nhiều lựa chọn, mà là cách sửa đúng theo khuyến nghị chính thức của framework.

---

## 5. Tài Liệu Tham Chiếu & Liên Kết
* [[MOC-Home]] — Trang chủ Map of Content ([MOC-Home.md](../00-Index/MOC-Home.md))
* Tương ứng **ADR-016** trong [`docs/DECISIONS.md`](../../docs/DECISIONS.md) (gốc repo).
* Xem CLAUDE.md, mục "Quy tắc bảo mật" #7 và #8 cho các quy tắc CSRF/header liên quan.

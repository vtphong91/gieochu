---
tags:
  - meta
  - archive
  - gieochu
date: 2026-09-26
updated: 2026-10-17
---

# 📦 Historical Archive — Gieo Chữ

## Vì sao thư mục này được dựng lại

Cây KB này (khi đó còn nằm trong `docs/`, nay đã chuyển ra `obsidian-knowledge-base/` ở root repo) ban đầu
dựng trên khung thư mục của một KB không thuộc Gieo Chữ. Thư mục `05-Historical-Archive/` khi đó chứa 67 file
báo cáo/kế hoạch/quyết định **không mô tả Gieo Chữ** (các module không tồn tại trong sản phẩm này). Toàn bộ
nội dung đó **đã bị xoá** khỏi repo Gieo Chữ; thư mục được dựng lại chỉ từ nguồn thật của Gieo Chữ như dưới đây.

## Nguyên tắc bắt buộc: không bịa lịch sử

Gieo Chữ là một dự án ở giai đoạn rất sớm — tính tới 2026-09-26, toàn bộ lịch sử **git** của repo chỉ có
**18 commit**, trải từ **2026-09-17 đến 2026-09-20** (xem [[Module-Build-History]]). Một dự án ở giai đoạn
này chưa thể có hàng chục báo cáo kỹ thuật theo ngày như một dự án đã chạy nhiều tháng.

Vì vậy:

- **Không** tạo lại một bộ ~67 "báo cáo lịch sử Gieo Chữ" giả để mô phỏng cấu trúc cũ — đó sẽ là bịa ra một
  lịch sử dự án không hề xảy ra (các cuộc họp, quyết định, sprint chưa từng có).
- Mọi nội dung trong thư mục này **chỉ được lấy từ 3 nguồn thật, có thể kiểm chứng**:
  1. [`docs/DECISIONS.md`](../../docs/DECISIONS.md) — 40 ADR thật (ADR-001 → ADR-040).
  2. [`docs/PLAN.md`](../../docs/PLAN.md) — tiến độ module M0–M12 thật.
  3. [`docs/BACKLOG.md`](../../docs/BACKLOG.md) — việc còn thiếu/hoãn thật.
  4. Lịch sử `git log` thật của repo (không suy diễn ngày tháng).
- Nếu một mốc/module không có commit git thật tương ứng, phải **ghi rõ là chưa commit** — không tự gán một
  ngày hợp lý nghe cho xuôi.
- Nếu sau này ai đó (người hoặc AI) muốn thêm "báo cáo tiến độ" mới vào đây, file đó phải mô tả một sự việc
  **đã thật sự xảy ra** trong quá trình phát triển Gieo Chữ (có thể đối chiếu với git log/DECISIONS.md/PLAN.md
  thời điểm đó) — không phải nội dung tổng hợp/suy diễn/mượn từ dự án khác.

## Nội dung thư mục (nhỏ, có chủ đích — không phải một archive lớn)

- [[Module-Build-History]] — timeline build module M0–M9, đối chiếu `PLAN.md` với git log thật.
- [[Architecture-Decisions-Timeline]] — mục lục đầy đủ 40 ADR (ADR-001 → ADR-040).
- [[Known-Gaps-And-Backlog]] — tóm tắt việc còn thiếu/hoãn từ `BACKLOG.md`, tính tới 2026-09-26.

Xem thêm [[01-Architecture-Decisions/README|01-Architecture-Decisions]] để có nội dung đầy đủ của các ADR
quan trọng nhất (một tập con của 40 ADR, được diễn giải sâu hơn).

*Quay lại: [[MOC-Home]] (../00-Index/MOC-Home.md)*

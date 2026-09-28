---
tags:
  - meta
  - ai
date: 2026-09-26
---

# 🤖 AI Agent Guides

Tài liệu dành cho AI agent / cộng tác viên AI làm việc trong repo Gieo Chữ. **Không phải đặc tả hệ thống** —
quy tắc chính thức của dự án nằm ở `CLAUDE.md` (gốc repo) và các ADR trong [[MOC-Home]].

## Nội dung
- [[Team-Charter]] (đọc trước): đội Quốc · Long · Hiếu · Phong — **Quốc** là phiên chính (kỹ sư trưởng, điều
  phối, review); **Long** là sub-agent `long` (`.claude/agents/long.md`, tài liệu, ghi `obsidian-knowledge-base/**`);
  **Hiếu** là sub-agent `hieu` (`.claude/agents/hieu.md`, code logic/dữ liệu, ghi `apps/web/**`, `packages/**` gồm
  `packages/db/prisma/`); **Phong** là sub-agent `phong` (`.claude/agents/phong.md`, UX/UI, dùng skill
  `ui-ux-pro-max`, ghi lớp trình bày `apps/web/app/**/_ui/**`, `globals.css`, JSX/bố cục trong page/layout).
  Charter gồm phân vùng tri thức, quy trình một task, trách nhiệm và mẫu brief. Nguồn phân công đã duyệt là
  `CLAUDE.md` mục "Đội & phân công (Quốc · Long · Hiếu · Phong)", mục này trỏ lại Charter.
- Knowledge base nằm ở `obsidian-knowledge-base/` ở root repo (chuyển từ `docs/` ngày 2026-09-26).
- `skills/CLAUDE-ORCHESTRATOR-TEMPLATE.md`, `skills/AGENTS-TEAM-OPERATING-TEMPLATE.md`: 2 file mẫu điều phối
  agent dùng chung cho nhiều project (tự nhận là generic trong chính nội dung file) — giữ nguyên, không đặc
  thù Gieo Chữ. `Team-Charter.md` là bản đã điền cụ thể cho project này theo khung 2 file mẫu đó.

> [!NOTE]
> Toàn bộ nhánh `ai-provider-*` (kế hoạch AI Provider của dự án khác, chưa từng implement) đã bị xoá khỏi thư
> mục này — không có tính năng tương đương ở Gieo Chữ.

*Quay lại: [[MOC-Home]]*

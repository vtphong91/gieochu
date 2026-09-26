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
- [[Team-Charter]]: cách dự án được vận hành thực tế — root session (Proportional Delegation) cho phần lớn vai
  trò, cộng 2 sub-agent thường trực từ 2026-09-26: `docs` (`.claude/agents/docs.md`, ghi
  `obsidian-knowledge-base/**`) và `engineer` (`.claude/agents/engineer.md`, ghi `apps/web/**`/`packages/**`/
  `prisma/**`) (đọc trước). `CLAUDE.md` ở root repo nay có mục "Sub-agent & điều phối" trỏ lại chính file này —
  đó là điểm nạp Charter cho mọi phiên chính mới.
- `skills/CLAUDE-ORCHESTRATOR-TEMPLATE.md`, `skills/AGENTS-TEAM-OPERATING-TEMPLATE.md`: 2 file mẫu điều phối
  agent dùng chung cho nhiều project (tự nhận là generic trong chính nội dung file) — giữ nguyên, không đặc
  thù Gieo Chữ. `Team-Charter.md` là bản đã điền cụ thể cho project này theo khung 2 file mẫu đó.

> [!NOTE]
> Toàn bộ nhánh `ai-provider-*` (kế hoạch AI Provider của dự án khác, chưa từng implement) đã bị xoá khỏi thư
> mục này — không có tính năng tương đương ở Gieo Chữ.

*Quay lại: [[MOC-Home]]*

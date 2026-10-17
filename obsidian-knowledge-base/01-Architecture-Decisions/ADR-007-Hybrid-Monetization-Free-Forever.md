---
tags:
  - adr
  - billing
  - monetization
  - status/accepted
date: 2026-09-26
updated: 2026-10-16
decider: vtphong91
status: Accepted (Chốt — Áp dụng chính thức)
---

# 🏛️ ADR-007: Hybrid Monetization — Free Forever Thay Cho Subscription-First

## 1. Trạng Thái (Status)
**ĐÃ PHÊ DUYỆT (Accepted)** — Đây là **quyết định mô hình kinh doanh** nền tảng cho toàn bộ hệ thống billing/subscription của Gieo Chữ.

---

## 2. Bối Cảnh (Context)
Người dùng cung cấp một báo cáo đề xuất (`docs/GIEOCHU_HYBRID_MONETIZATION_BILLING_PROPOSAL_V2.md`) đổi mô hình billing từ **"mọi tenant mới vào `TRIALING`, hết trial không trả tiền thì `READ_ONLY`"** sang **"FREE là một plan thật, bán được, không hết hạn; trả phí chỉ để mở rộng capacity/tính năng"**.

Sau khi đọc báo cáo, nêu 2 nhóm ý kiến trước khi làm (ảnh hưởng tiền — bắt buộc hỏi lại theo quy tắc "Khi đặc tả mơ hồ" của CLAUDE.md):
1. **Đồng ý triết lý cốt lõi** — Free Forever giảm friction onboarding, đúng khi tiền chưa cần thu ngay từ ngày đầu (mô hình phổ biến ở Gumroad/Payhip/Podia).
2. **Không đồng ý *kiến trúc* mà báo cáo đề xuất** — 4 bảng mới (`billing_accounts`/`usage_meters`/`billing_events` cộng entitlement như bảng riêng) được cho là đoán trước nhu cầu tương lai (add-on/usage-billing) chưa xảy ra, trong khi mục tiêu thực sự chỉ cần mở rộng `Plan`/`Subscription` đã có.

---

## 3. Quyết Định (Decision)
Người dùng xác nhận đồng ý mô hình mới cùng 3 điểm cụ thể trước khi code:

1. Paid hết hạn (qua `GRACE`) → **downgrade thẳng về FREE** (vẫn bán được, giới hạn thấp lại) — không còn `READ_ONLY` vì lý do subscription; `READ_ONLY` từ nay chỉ dùng cho moderation/khoá thủ công.
2. Triển khai đủ **4 gói ngay: FREE/CREATOR/PRO/BUSINESS** — không làm tối giản 2-gói-rồi-mở-rộng-sau.
3. Toàn bộ số liệu/tính năng từng gói phải **customize được qua `/admin/plans`** — số liệu trong báo cáo chỉ là giá trị seed mặc định.

**Thu gọn kiến trúc so với đề xuất gốc** (đã trình bày, người dùng không phản đối):
- Không có `billing_accounts` — `Tenant` đã 1-1 `Subscription`, không cần bảng trung gian.
- Không có `usage_meters` — sản phẩm/dung lượng là số liệu tức thời (đếm sống + `Tenant.storageUsedBytes` atomic), không phải usage-theo-kỳ cần ledger.
- Không có `billing_events` — trùng vai trò `audit_logs` (lúc quyết định chưa xây; sự kiện quan trọng ghi qua logger tạm thời). *(Cập nhật 2026-10-16: `audit_logs` có từ M12a — thanh toán gói ghi `SUBSCRIPTION_PAID`, sửa gói ghi `PLAN_CREATED`/`PLAN_UPDATED`; xem [[01-Architecture-Decisions/ADR-023-M12-Audit-Log-Append-Only|ADR-023 (≙ ADR-037)]].)*
- `Plan` chỉ thêm 2 cột (`isFree`, `features Json`) — không đổi tên bảng, không tách state machine riêng; state machine `transitionSubscriptionStatus()` đã có giữ nguyên không đổi.
- Feature gate mới (`canUsePlanFeature()`, `packages/core/src/billing/feature-gate.ts`) luôn đọc `plan.features` (JSON), **không bao giờ** đọc `plan.code` — đúng nguyên tắc entitlement-vs-plan-name.

---

## 4. Hệ Quả & Ràng Buộc Kỹ Thuật (Consequences & Rules)
* **`Subscription` của Free** có `currentPeriodStart = currentPeriodEnd =` thời điểm tạo (không nullable hoá cột, không dùng sentinel ngày xa tương lai) — vì luôn ≤ thời điểm hiện tại, hàm tính kỳ gia hạn đã có tự động tính đúng kỳ mới khi nâng cấp lên Paid mà không cần sửa gì thêm.
* **Sweep job** loại Free khỏi mọi truy vấn quét hết hạn bằng filter quan hệ `plan: { isFree: false }`.
* **Không tự ý đọc `plan.code` để quyết định tính năng** ở bất kỳ nơi nào trong code mới — mọi kiểm tra quyền dùng tính năng phải qua `canUsePlanFeature()` đọc `plan.features`.
* Đây là quyết định ảnh hưởng tiền trực tiếp — bất kỳ thay đổi tiếp theo lên logic downgrade/feature gate đều phải hỏi lại người dùng trước, không tự diễn giải.

---

## 5. Tài Liệu Tham Chiếu & Liên Kết
* [[MOC-Home]] — Trang chủ Map of Content ([MOC-Home.md](../00-Index/MOC-Home.md))
* Tương ứng **ADR-021** trong [`docs/DECISIONS.md`](../../docs/DECISIONS.md) (gốc repo).
* Nguồn đề xuất gốc: `docs/GIEOCHU_HYBRID_MONETIZATION_BILLING_PROPOSAL_V2.md`.

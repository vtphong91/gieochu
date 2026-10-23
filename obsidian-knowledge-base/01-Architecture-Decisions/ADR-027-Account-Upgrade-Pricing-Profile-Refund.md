---
tags:
  - adr
  - pricing
  - account
  - billing
  - security
  - status/accepted
date: 2026-10-17
decider: vtphong91
status: Accepted (Chốt — Áp dụng chính thức)
---

# 🏛️ ADR-027: Nâng cấp tài khoản (Bảng giá CMS) + Hồ sơ tài khoản; gói năm; hoàn tiền gói 7 ngày

## 1. Trạng Thái (Status)
**ĐÃ PHÊ DUYỆT (Accepted)** — tương ứng **ADR-041** trong [`docs/DECISIONS.md`](../../docs/DECISIONS.md), gồm "Bổ sung ADR-041" (chủ dự án
chốt), "Bổ sung ADR-041 lần 2" và "Bổ sung ADR-041 lần 3" (2026-10-17, Quốc đính chính theo code — xem §5). ADR-041 mục C.1 **bổ sung ADR-008** (hồ sơ không còn bắt buộc 4 trường). Bản trích ghi vào
thư mục này theo duyệt của Quốc (brief 2026-10-17).

Tiến độ (2026-10-17): **GĐ1 (dữ liệu/CMS) + GĐ2 (UI) xong code; đã commit `7f8360b`** ✅ `git log`, deploy ❓; 2 migration expand
(`20261017090000_adr041_email_change`, `20261017100000_adr041_subscription_refunds`) **đã áp DB dùng chung** 🟡 (brief Quốc). GĐ2b (menu
mobile Studio) **xong code 2026-10-17** theo ADR-042 ([[01-Architecture-Decisions/ADR-028-Shared-App-Sidebar-Logout-Mobile-Drawer|ADR-028 KB (≙ ADR-042)]]), đã commit `9d37ab1` ✅ `git log`, deploy ❓.

Mức xác minh: ✅ Long đã đối chiếu code (2026-10-17) · 🟡 theo `docs/DECISIONS.md`/báo cáo · ❓ cần môi trường thật.

---

## 2. Bối Cảnh (Context)
Kế hoạch `docs/ke-hoach-nang-cap-tai-khoan-va-ho-so-2026-10-17.md` dựa trên hai đề xuất của Phong (trang Bảng giá, trang Hồ sơ). Theo nguyên
tắc **CMS/dữ liệu trước, UI sau** (CLAUDE.md, [[06-AI-Agent-Guides/Team-Charter|Team-Charter]] §2.1). Trước đó: `/pricing` quảng cáo 6 cờ tính
năng chưa chặn theo gói; hạn mức `0` hai nghĩa (core = không cho phép, Billing = không giới hạn); `/account` 404; đổi mật khẩu không thu hồi
phiên/không audit/không email ✅ (KB-Audit §20). Chủ dự án chốt các điểm tiền/dữ liệu cá nhân/bảo mật; còn lại Quốc chốt theo đề xuất 🟡.

---

## 3. Quyết Định (Decision)

### A. Bảng giá `/pricing` (CMS `pricing`)
1. Nội dung trang + marketing từng gói lưu `CmsPage` slug `pricing` (thêm vào `SYSTEM_CMS_SLUGS`), nháp/xuất bản/khôi phục, xem trước nháp chỉ
   admin. **Giá/hạn mức chỉ đọc từ `Plan`.** Gói đang bật chưa cấu hình CMS → tự hiện mặc định.
2. **Gói năm giảm theo %** (chủ dự án chốt): `Plan` `interval = YEAR`, CMS ghép cặp tháng ↔ năm, % tính từ giá thật (không nhập tay). Không quà
   tặng tháng, không dùng thử, không thẻ Enterprise.
3. **Chỉ quảng cáo tính năng có thật:** dòng tính năng gắn cờ chỉ hiện khi cờ "đã triển khai" — hằng trong `packages/core` (bổ sung).
4. **Hạn mức `0` = không được phép; `-1` = không giới hạn** (bổ sung lần 2, Quốc).
5. Đổi gói giữ hiện hành (không tính chênh lệch). VAT/hoá đơn, hoa hồng, kênh hỗ trợ là **nội dung CMS** admin nhập.
6. Dải số liệu thật (từ DB, 0 → ẩn).

### B. Hoàn tiền gói trả phí (chủ dự án chốt)
- Trong **7 ngày** kể từ thanh toán, **chỉ lần thanh toán gói đầu tiên** của mỗi tenant, hoàn **100%**. Chủ gian hàng gửi yêu cầu ở Billing
  Studio → admin duyệt ở System Center, **tự chuyển khoản tay** rồi bấm "Đã hoàn" → hoá đơn đánh dấu hoàn tiền, thuê bao **về Free ngay** (không
  mất dữ liệu). Từ chối kèm lý do. Audit mọi bước. Cổng QR/MoMo không tự hoàn.
- **Bổ sung:** thông tin nhận tiền (ngân hàng, số TK, tên chủ TK) nhập trong form yêu cầu; lưu **mã hoá AES-256-GCM** (khoá có sẵn); **chỉ admin**
  xem (che bớt, hiện đầy đủ khi bấm); **tự xoá** (NULL) khi đã hoàn hoặc bị từ chối; không vào audit/log/email.
- **Bổ sung lần 2:** tenant đã có **hoá đơn gói PAID thứ hai** → **mất quyền** yêu cầu (ẩn nút, server từ chối); admin xem đầy đủ thông tin nhận
  tiền ghi audit `SUBSCRIPTION_REFUND_PAYOUT_VIEWED` (chỉ id).

### C. Hồ sơ `/account`
- Một hồ sơ cá nhân cho mọi User; Studio chỉ giữ cài đặt gian hàng, hai bên liên kết. Bỏ mục không có nghiệp vụ. Họ tên gộp một ô.
1. **SĐT, Tỉnh/Thành tuỳ chọn**, chỉ chủ tài khoản + admin thấy, gian hàng không thấy (bổ sung ADR-008).
2. **Bảo mật chặt:** đổi mật khẩu cần mật khẩu cũ, thu hồi mọi phiên khác, email báo; đổi email cần nhập lại mật khẩu, xác minh link tới email
   mới (token `EMAIL_CHANGE`, xác nhận được khi chưa đăng nhập), báo email cũ, thu hồi phiên khác. Email mới hiện ở Studio các gian hàng từng
   bán cho user — chấp nhận.
3. Ảnh đại diện: Cloudinary hệ thống, png/jpeg/webp ≤ 2 MB, không tính hạn mức gói; GĐ1 chỉ hiện ở chỗ riêng tư.
4. Để sau (BACKLOG): danh sách phiên/IP, xoá tài khoản, tuỳ chọn thông báo, ảnh công khai.

- **Test:** không thêm (93/54, trần 94/55). Migration expand-only, Quốc duyệt, chủ dự án chạy (ADR-034).

---

## 4. Triển Khai (theo code, 2026-10-17)
| Chỗ | Hành vi | Xác minh |
|---|---|---|
| `packages/core/src/admin/pricing-sections.ts` | 9 section (`hero`, `plans`, `priceNote`, `stats`, `comparison`, `whyUs`, `faq`, `ctaFinal`, `paymentMethods`), schema chặt + parse phòng thủ, `altPlanId`, `computeCycleSavingsPercent`, biến `{brand}`/`{graceDays}` | ✅ |
| `packages/core/src/billing/plan-limits.ts`, `feature-gate.ts` | `PLAN_LIMIT_UNLIMITED = -1`, `describePlanLimit`/`formatPlanLimit`; `IMPLEMENTED_PLAN_FEATURES = []` | ✅ |
| `apps/web/lib/pricing-cms.ts`, `app/admin/cms/pricing/*`, `app/pricing/*` | Editor CMS + trang công khai, CTA theo người xem, xem nháp chỉ admin, SEO CMS | ✅ |
| `apps/web/lib/subscription-refund.ts`, `app/admin/billing/refunds/*`, Billing Studio | Bảng L1 `subscription_refund_requests`, điều kiện 7 ngày/lần đầu/không có hoá đơn PAID thứ hai, Đã hoàn → `REFUNDED` + Free + payout NULL trong 1 transaction | ✅ code · 🟡 dữ liệu thật (Hiếu) |
| `apps/web/lib/{account-profile,account-security,account-state}.ts`, `app/account/**` | Tổng quan/Hồ sơ/Bảo mật, đổi mật khẩu, đổi email, ảnh đại diện, menu tài khoản | ✅ code · 🟡 dữ liệu thật (Hiếu) |
| `packages/core/src/audit/audit.ts` | +8 action (3 Hồ sơ, `PRICING_CMS_UPDATED`, 4 hoàn tiền gói) — tổng 40 | ✅ |

Chi tiết: [[02-System-Specs/Pricing-Page-Specs|Pricing-Page-Specs]], [[02-System-Specs/Account-Profile-Specs|Account-Profile-Specs]],
[[02-System-Specs/Payment-And-Billing|Payment-And-Billing]] §5A–§5B.

---

## 5. Hệ Quả (Consequences)
- `markInvoicePaid` bỏ qua hoá đơn `REFUNDED` — webhook/xác nhận tay đến muộn không bật lại gói đã hoàn ✅.
- Gói trên prod từng để `0` với ý "không giới hạn" sẽ thành "không được phép" — **Bổ sung lần 3:** Quốc kiểm bảng `plans` 2026-10-17: 4 gói, không gói nào dùng `0` 🟡 (Long không chạy truy vấn).
- Đổi `PAYMENT_ENCRYPTION_KEY` làm mất khả năng đọc thông tin nhận tiền của yêu cầu đang chờ (cùng rủi ro với secret cổng).
- **Lệch ADR ↔ code** (KB-Audit §21) — **đã chốt ở "Bổ sung lần 3"**: đổi email thu hồi **mọi** phiên (kể cả phiên hiện tại, xoá cookie) — giữ theo code; giao diện admin xem SĐT/Tỉnh chưa có → BACKLOG; quy định "hồ sơ bắt buộc 4 trường" của ADR-008 gốc đã được thay bởi C.1.
- Giới hạn đã biết (BACKLOG): access token sống tới hết TTL sau thu hồi; rate limit trong bộ nhớ; không xoá asset Cloudinary cũ; danh sách 34
  tỉnh chưa đối chiếu văn bản chính thức; nợ test.

---

## 6. Liên Kết
* [[01-Architecture-Decisions/ADR-008-Rbac-Role-Permission|ADR-008 KB (≙ ADR-022)]] — lưu ý: "ADR-008" mà ADR-041 bổ sung là **ADR-008 trong `docs/DECISIONS.md`** (hồ sơ người dùng), khác file KB `ADR-008` (≙ ADR-022) do KB đánh số riêng
* [[01-Architecture-Decisions/ADR-007-Hybrid-Monetization-Free-Forever|ADR-007 KB (≙ ADR-021)]] · [[01-Architecture-Decisions/ADR-021-Shop-Marketplace-Cms-First|ADR-021 KB (≙ ADR-035)]] · [[01-Architecture-Decisions/ADR-020-Single-Database-Dev-Preview-Production|ADR-020 KB (≙ ADR-034)]]
* [[03-API-Contracts/Endpoint-Directory|Endpoint-Directory]] §21 ([Endpoint-Directory.md](../03-API-Contracts/Endpoint-Directory.md)) · [[03-API-Contracts/Database-Schema-Reference|Database-Schema-Reference]] ([Database-Schema-Reference.md](../03-API-Contracts/Database-Schema-Reference.md))
* [[04-Operations-Runbooks/UI-Design-System|UI-Design-System]] §18 · [[04-Operations-Runbooks/Deploy-Vercel-Runbook|Deploy-Vercel-Runbook]] §9.9

*Quay lại: [[MOC-Home]] (../00-Index/MOC-Home.md)*

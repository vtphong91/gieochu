# Kế hoạch Đợt 3 — Trang chi tiết gian hàng (System Center) + khoá/mở khoá có lý do

> Ngày lập: 2026-11-26 · Người lập: Quốc (kỹ sư trưởng) · Trạng thái: **đã chốt, chưa code**
> Quyết định: [ADR-072](DECISIONS.md) · Lộ trình chung: [PLAN.md](PLAN.md) mục "Kế hoạch 4 đợt System Center / thanh toán"
> Đợt trước: Đợt 2 — Nhật ký chi tiết + "Gian hàng" (ADR-071). Đợt sau: Đợt 4 — Trang chi tiết người dùng.

---

## 1. Mục tiêu

Quản trị viên mở một gian hàng là nắm được toàn cảnh để **vận hành và hỗ trợ**: gian hàng là ai, chủ là ai, đang dùng gói gì và còn hạn
không, bán được bao nhiêu (số liệu tổng hợp), nội dung và dung lượng, có vi phạm/hoàn tiền quá hạn không, quản trị viên đã làm gì với gian
hàng. Khoá/mở khoá gian hàng trở thành thao tác **có cân nhắc**: xác nhận, ghi lý do, báo chủ gian hàng.

## 2. Quyết định đã chốt (chủ dự án, 2026-11-26)

| # | Câu hỏi | Chốt |
|---|---|---|
| 1 | Các phần của trang chi tiết | Thông tin + chủ gian hàng (luôn có), **Gói dịch vụ**, **Số liệu kinh doanh**, **Nội dung & lưu trữ**, **Vi phạm & nhật ký** |
| 2 | Khoá / Mở khoá | **Hộp xác nhận + lý do bắt buộc + email báo chủ gian hàng** (cả danh sách lẫn trang chi tiết) |
| 3 | Cột GMV ở danh sách (đang ghi cứng "Cần M12") | **GMV 30 ngày** từ số liệu tổng hợp có sẵn |
| 4 | Phương thức thanh toán của gian hàng | Chỉ hiện **tên cổng đang bật** (không số tài khoản, không secret) |

## 3. Hiện trạng (Quốc đối chiếu code 2026-11-26)

| Hạng mục | Hiện trạng |
|---|---|
| `/admin/tenants` (`apps/web/app/admin/tenants/page.tsx`) | Danh sách: tên/slug, gói, trạng thái, dung lượng, số sản phẩm, **GMV "Cần M12" ghi cứng**, badge hoàn tiền quá hạn; menu "⋯" chỉ có Khoá/Mở khoá. Không có trang chi tiết. |
| Khoá/Mở khoá (`app/admin/tenants/actions.ts` → `lib/tenant-lock.ts`) | Bấm là chạy ngay; audit `TENANT_LOCKED`/`TENANT_UNLOCKED` không có lý do; không email. |
| Số liệu tổng hợp | `tenant_daily_stats` (`ordersPaid`, `gmvVnd`, `newCustomers`, `downloads` theo ngày giờ VN) đã được cron tính; `lib/admin-stats.ts` chỉ có tổng quan toàn hệ thống. |
| Vi phạm / hoàn tiền | `AbuseReport` có `tenantId` (module Báo cáo vi phạm); `countOverdueRefundRequestsByTenant()` có sẵn. |
| Audit gian hàng | `TENANT_CREATED`, `TENANT_LOCKED`, `TENANT_UNLOCKED` + các audit thuê bao/hoá đơn gói (ADR-067…071). |
| Chi tiết đơn hàng gói | `/admin/subscriptions/[subscriptionId]` (ADR-069) — trang chi tiết gian hàng link sang. |

## 4. Phạm vi

**Trong phạm vi**
- Trang mới `/admin/tenants/[tenantId]` (+ `loading.tsx`).
- Danh sách `/admin/tenants`: cột GMV 30 ngày, menu "⋯" thêm **Xem chi tiết**, Khoá/Mở khoá qua hộp xác nhận.
- Khoá/Mở khoá có lý do bắt buộc + email chủ gian hàng.

**Ngoài phạm vi**
- Xem đơn hàng / khách hàng / giao dịch của gian hàng (§7.9).
- Sửa thông tin gian hàng, đổi gói, đổi chủ từ System Center.
- Trang chi tiết người dùng (Đợt 4) — trang này chỉ hiện tên + email chủ, link sang sau khi Đợt 4 xong.
- Lọc/tìm kiếm danh sách gian hàng (có thể đề xuất đợt sau).

## 5. Nội dung trang `/admin/tenants/[tenantId]`

| Phần | Nội dung | Nguồn dữ liệu |
|---|---|---|
| **Đầu trang** | Tên gian hàng, badge trạng thái, nút "Mở trang gian hàng" (link công khai), nút **Khoá / Mở khoá…** | `tenants` |
| **Thông tin gian hàng** | Tên, slug (+ slug cũ nếu có), tiền tố mã đơn, ngày tạo, trạng thái | `tenants`, `tenant_slug_history` |
| **Chủ gian hàng** | Họ tên, email, trạng thái tài khoản, ngày tham gia | `users`, `tenant_members` (OWNER) |
| **Gói dịch vụ** | Gói, trạng thái thuê bao, kỳ hiện tại, hết hạn, ân hạn, hoá đơn gần nhất (mã + trạng thái) → link **Chi tiết đơn hàng gói** | `subscriptions`, `plans`, `subscription_invoices` |
| **Phương thức thanh toán đang bật** | Tên cổng: "QR chuyển khoản", "SePay", "MoMo", "MoMo cá nhân" | `tenant_payment_configs` **chỉ** `provider` + `isEnabled` (ngoại lệ ADR-072 mục 2) |
| **Số liệu kinh doanh** | 30 ngày gần nhất + tổng từ trước tới nay: GMV, số đơn đã trả, khách mới, lượt tải | `tenant_daily_stats` |
| **Nội dung & lưu trữ** | Số tài liệu theo trạng thái (đang bán / nháp / lưu trữ…), dung lượng đã dùng / hạn mức của gói | đếm sản phẩm theo trạng thái, `storageUsedBytes`, hạn mức gói |
| **Vi phạm** | Số báo cáo vi phạm theo trạng thái (đang mở / đã xử lý) + 5 báo cáo gần nhất (loại, trạng thái, ngày) → link trang Báo cáo vi phạm; số yêu cầu hoàn tiền quá hạn | `abuse_reports`, `countOverdueRefundRequestsByTenant` |
| **Nhật ký quản trị** | Tạo gian hàng, khoá/mở khoá (kèm lý do), thanh toán/huỷ/mở lại hoá đơn gói — mới nhất trước, tối đa 50 dòng | `audit_logs` theo `tenantId` (scope SYSTEM) |

Trạng thái: loading (`loading.tsx`), không tìm thấy → 404, phần không có dữ liệu → `EmptyState` ngắn.

## 6. Khoá / Mở khoá có lý do

| Bước | Hành vi |
|---|---|
| Mở hộp | Từ menu "⋯" ở danh sách hoặc nút ở trang chi tiết → `<dialog>` (cùng mẫu hộp đổi trạng thái ADR-067/069) |
| Nội dung hộp | Tên gian hàng, hệ quả ("Khoá: gian hàng ngừng bán, khách không mua được, chủ vẫn đăng nhập Studio…" — Hiếu xác nhận hệ quả thật theo code), ô **lý do bắt buộc** (≤ 500 ký tự), nút Xác nhận / Huỷ bỏ |
| Server | `requireRole("SYSTEM_ADMIN")`; lý do trống → lỗi; ghi audit kèm `reason`; revalidate danh sách + trang chi tiết |
| Email chủ gian hàng | Sau commit, 1 email mỗi lần khoá/mở khoá: tên gian hàng, đã bị khoá / đã được mở khoá, **lý do**, liên hệ hỗ trợ (email hỗ trợ System Settings). Lỗi gửi chỉ log |
| Khoá tự động khác (nếu code có, vd từ Báo cáo vi phạm) | Hiếu kiểm: dùng chung hàm, truyền lý do sẵn có của luồng đó; không đổi hành vi ngoài phạm vi |

> Câu chữ email "đã bị khoá": lý do quản trị viên nhập sẽ **gửi cho chủ gian hàng** — hộp xác nhận phải ghi rõ điều này để quản trị viên
> không ghi thông tin nội bộ vào ô lý do.

## 7. Các bước & phân công (quy trình đầy đủ)

| Bước | Ai (model) | Việc | Đầu ra |
|---|---|---|---|
| 1 | **Phong** (Sonnet) | Chốt bố cục trang chi tiết (mục 5) + hộp khoá/mở khoá (mục 6) cho 375/1024/1280px + **contract dữ liệu** (kiểu TypeScript, null khi nào) | Báo cáo bố cục + contract |
| 2 | **Quốc** | Duyệt contract, chuyển Hiếu | Brief |
| 3 | **Hiếu** (Opus — có khoá gian hàng + email + ngoại lệ đọc L2) | `getAdminTenantDetail(tenantId)`; GMV 30 ngày cho danh sách; ngoại lệ đọc `provider/isEnabled`; khoá/mở khoá có lý do + audit + email (mẫu email mới trong `packages/email`); mở rộng test sẵn có | Code + verify |
| 4 | **Phong** (Sonnet) | Dựng trang chi tiết, hộp khoá/mở khoá, cột GMV + menu "Xem chi tiết" ở danh sách; soát câu chữ email | Code + soát a11y/responsive |
| 5 | **Quốc** | Review phạm vi, typecheck, lint, unit, `test:count`, integration liên quan | Báo chủ dự án |
| 6 | **Long** (Haiku) | Ghi KB: ADR-072, spec System Center, Audit-Log-Specs (`reason`), Endpoint-Directory, UI-Design-System, email mới | Báo trang đã sửa |

## 8. Ràng buộc kỹ thuật

- §7.9: không đọc `orders`, `tenant_customers`, `tenant_payment_transactions`; chỉ số liệu tổng hợp.
- Ngoại lệ L2 duy nhất: `tenant_payment_configs` cột `provider`, `isEnabled` qua `withSystemJob`; không trả `publicConfig`/`encryptedSecrets`.
- Đếm tài liệu theo trạng thái: đọc qua helper RLS phù hợp (`withSystemJob`), chỉ số đếm.
- Không migration (`reason` lưu trong metadata audit).
- **Không thêm test case** (trần 105/69) — mở rộng case sẵn có: khoá thiếu lý do bị chặn; khoá có lý do ghi audit + 1 email (mock chặn gửi thật); mở khoá tương tự; `getAdminTenantDetail` trả số liệu tổng hợp, chỉ cổng đang bật, không có trường secret.
- Test gọi sweep/cron phải giới hạn tenant tạm (đang sửa — việc riêng 2026-11-26).

**Tiêu chí xong:** trang chi tiết hiện đủ 5 phần + đầu trang; danh sách có GMV 30 ngày và "Xem chi tiết"; khoá/mở khoá bắt buộc lý do, ghi audit,
gửi email; không lộ dữ liệu đơn/khách/secret; toàn bộ verify đạt; Long đã ghi KB.

## 9. Rủi ro

| Rủi ro | Giảm thiểu |
|---|---|
| Quản trị viên ghi thông tin nội bộ vào lý do khoá (gửi cho chủ) | Hộp xác nhận ghi rõ "lý do sẽ gửi cho chủ gian hàng" |
| Khoá nhầm gian hàng đang bán | Hộp xác nhận nêu tên + hệ quả; mở khoá cũng có lý do và email |
| Số liệu tổng hợp trễ 1 ngày (cron hằng ngày) | Ghi chú "số liệu cập nhật hằng ngày" cạnh phần Số liệu kinh doanh |
| Ngoại lệ đọc L2 mở rộng dần theo thời gian | ADR-072 giới hạn đúng 2 cột; review chặn mọi trường khác |

## 10. Việc chủ dự án cần làm

1. Commit + deploy Đợt 2 và thử trước khi bắt đầu Đợt 3.
2. Báo **"bắt đầu đợt 3"** → Quốc giao Phong bước 1.
3. Sau khi xong: deploy, mở `/admin/tenants` → "⋯" → Xem chi tiết; thử khoá rồi mở khoá một gian hàng thử nghiệm, kiểm tra email của chủ gian hàng.

---
tags:
  - runbook
  - legal
  - system-admin
  - ops
  - status/living
date: 2026-10-23
updated: 2026-10-23
author: Long
---

# 🚀 Cẩm Nang: Xuất Bản Điều Khoản Sử Dụng (Legal Terms Publishing Runbook — ADR-050)

Quy trình cho **System Admin** (thường là chủ dự án) đưa một phiên bản Điều khoản sử dụng lên `/phap-ly/dieu-khoan-su-dung`. Nghiệp vụ và luật đầy đủ:
[[02-System-Specs/Legal-Documents-Specs|Legal-Documents-Specs]]; quyết định: [[01-Architecture-Decisions/ADR-035-Menu-Home-Seo-Versioned-Terms|ADR-035 KB (≙ ADR-050)]].

> Mức xác minh: ✅ Long đối chiếu code working tree 2026-10-23 (chưa commit) · 🟡 brief Quốc · ❓ chưa chạy trên môi trường thật.
> **Từ ADR-054 (2026-10-24, code chưa commit):** cùng quy trình áp cho **7 văn bản** (chọn văn bản bằng `?van-ban=<khoá>` ở `/admin/cms/phap-ly`); mỗi
> văn bản có URL **cấp gốc** (`/dieu-khoan-su-dung`, `/chinh-sach-bao-mat`, …) — `/phap-ly/{slug}` cũ redirect 308. Bản hiệu lực đầu tiên của
> Chính sách bảo mật làm form đăng ký ghi thêm chấp thuận văn bản đó; của Chính sách người bán làm form mở gian hàng **bắt buộc** tích ô đồng ý. Mô tả
> ngắn + SEO sửa ở khung "Mô tả & SEO" (lưu thẳng). Migration ADR-054 phải chạy trước — `Deploy-Vercel-Runbook` §9.14 (DB dùng chung: đã chạy 2026-10-24 🟡). Chi tiết:
> [[02-System-Specs/Legal-Documents-Specs|Legal-Documents-Specs]].
>
> Nhãn nút/ô dưới đây là của editor hiện tại ✅ `app/admin/cms/phap-ly/legal-editor.tsx`; Phong đang làm UI 🟡 — chữ có thể đổi, **luật thì không**.

---

## 0. Điều kiện trước

| Điều kiện | Kiểm |
| :-- | :-- |
| Migration `20261023090000_adr050_legal_documents` đã chạy trên DB đích | 🟡 đã chạy trên DB dùng chung (brief Quốc). DB khác (restore, branch mới): `pnpm db:migrate` **trước** deploy — code **không** bắt lỗi bảng chưa có ở `/register` (xem KB-Audit §31) |
| Code ADR-050 đã deploy | ❓ chưa commit tại 2026-10-23 |
| Nội dung đã qua rà soát pháp lý thật (luật sư/người có thẩm quyền) | ❓ — dự thảo `docs/legal/drafts/dieu-khoan-su-dung.md` do Long soạn, **chưa được luật sư rà soát**, còn 32 chỗ `[[CẦN XÁC NHẬN` ✅ grep; checklist `docs/legal/LEGAL_REVIEW_CHECKLIST.md` |
| Tài khoản `SYSTEM_ADMIN` | Mọi thao tác dưới đây tự `requireRole("SYSTEM_ADMIN")` |

⚠️ **Một DB duy nhất (ADR-034):** máy dev, Preview và Production dùng cùng database — xuất bản từ bất kỳ môi trường nào là xuất bản **thật** cho người dùng
production. Không "thử xuất bản" một bản chưa duyệt; bản đã xuất bản **không sửa, không xoá được** từ app (trigger DB), chỉ lưu trữ.

---

## 1. Quy trình 5 bước

1. **Tạo bản nháp** — System Center → "Văn bản pháp lý" (`/admin/cms/phap-ly`) → tạo phiên bản mới. Số phiên bản tự tăng (`1.0`, `2.0`…), trạng thái
   **Nháp**, rà soát **Chờ rà soát pháp lý**. Editor hiện tại **sao chép nội dung bản mới nhất** vào bản nháp mới (bản đầu tiên thì trống) ✅
   `legal-editor.tsx`. Nội dung trống được phép, soạn dần. Ghi audit `LEGAL_VERSION_CREATED`.
2. **Soạn / rà soát nội dung** — dán nội dung từ dự thảo đã duyệt vào trình soạn thảo (dùng H2/H3 cho các mục; **không** chèn được ảnh — sanitize bỏ
   ảnh). Dùng `{brand}` thay tên nền tảng (thay lúc hiển thị, có escape). Điền "Tóm tắt thay đổi" (≤ 1000 ký tự) → **Lưu nháp**
   (`LEGAL_VERSION_UPDATED`). Mỗi lần **nội dung** đổi, trạng thái rà soát tự quay về "Chờ rà soát".
3. **Điền hết placeholder** — tìm và thay mọi `[[CẦN XÁC NHẬN: …]]` (tên pháp nhân, địa chỉ, MST, email liên hệ…) bằng thông tin đã xác nhận. Còn dù
   một dấu `[[CẦN XÁC NHẬN` (kể cả nằm giữa thẻ HTML) → không xuất bản được. Lưu nháp lại.
4. **Tích "Đã rà soát pháp lý phiên bản này"** — chỉ tích khi nội dung **đúng bản này** đã được người có thẩm quyền duyệt (ô yêu cầu lưu nháp trước nếu
   còn thay đổi chưa lưu). Ghi `LEGAL_REVIEW_STATUS_CHANGED`. Nếu sau đó sửa nội dung, tích lại từ đầu.
5. **Xuất bản kèm ngày hiệu lực** — ô "Ngày giờ hiệu lực (giờ Việt Nam)": để trống = hiệu lực ngay; đặt tương lai = bản "đã lên lịch" (tự có hiệu lực
   đúng giờ, không cần cron). **Không** đặt quá khứ (dung sai 5 phút). Xác nhận hộp thoại → **Xuất bản** (`LEGAL_VERSION_PUBLISHED`, metadata
   `effectiveAt`). Server kiểm lại cả 4 điều kiện: là nháp, có nội dung, hết placeholder, đã APPROVED.

Lỗi thường gặp: "Phiên bản vừa được thay đổi ở nơi khác…" (409 — có người/tab khác vừa sửa) → tải lại trang rồi làm lại bước đang dở.

---

## 2. ⚠️ Xuất bản bản đầu tiên làm form đăng ký đổi hành vi

Trước khi có bản đang hiệu lực, đăng ký chạy như trước ADR-050 (chỉ ghi `consentAt`). **Ngay khi** bản đầu tiên có hiệu lực (lúc xuất bản nếu để trống
ngày, hoặc đúng giờ đã lên lịch):
- Checkbox đăng ký đổi chữ thành link "Điều khoản sử dụng" (mở tab mới) tới bản đang hiệu lực.
- **Mọi** lượt đăng ký mới ghi một dòng `user_legal_acceptances` (userId, versionId, acceptedAt) trong cùng transaction tạo tài khoản — không lưu IP/UA.
- Người đang mở form từ trước khi bản mới có hiệu lực sẽ gửi id cũ → nhận lỗi 409 "Điều khoản sử dụng vừa được cập nhật. Vui lòng tải lại trang…" và
  phải đăng ký lại sau khi tải trang (form cũ còn cache, không gửi id → server tự ghi bản đang hiệu lực).
- Người dùng **đã có tài khoản** không bị yêu cầu chấp thuận lại (ADR-050) — không có dòng chấp thuận cho họ.

Sau khi xuất bản, kiểm nhanh ❓ (chưa làm trên môi trường thật): mở `/dieu-khoan-su-dung` (từ ADR-054; trước đó `/phap-ly/dieu-khoan-su-dung`) (hiện "Phiên bản n.0 · Có hiệu lực từ …"), mở `/register`
xem link mới, đăng ký thử **chỉ** bằng email kiểm thử (không gửi email tới địa chỉ thật của người khác — CLAUDE.md, ADR-034).

---

## 3. Phát hành bản mới / lưu trữ bản cũ

- **Bản mới:** lặp lại §1 trên một phiên bản mới (số tăng). Bản cũ **không** tự lưu trữ: nhiều bản PUBLISHED cùng tồn tại, bản hiệu lực là bản
  PUBLISHED có ngày hiệu lực ≤ hiện tại **mới nhất**. Đặt ngày tương lai để báo trước cho người dùng (cách báo trước chưa có — giai đoạn pháp lý ❓).
- **Lưu trữ** (`LEGAL_VERSION_ARCHIVED`): chỉ bản đã xuất bản; dùng để dọn bản cũ đã bị thay. Lưu trữ bản đang hiệu lực → bản PUBLISHED trước đó (nếu còn) tự hiệu lực lại ("Bổ sung ADR-050 lần 2"). ⚠️ Lưu trữ **bản đang hiệu lực** mà không còn bản PUBLISHED
  nào khác có hiệu lực → `/dieu-khoan-su-dung` trả **404** (link footer "Thông tin" tự ẩn — ADR-054) và đăng ký quay về không ghi chấp thuận (editor có cảnh báo trong hộp xác nhận).
  Lưu trữ là một chiều — không khôi phục được từ app.
- **Sai sót sau khi xuất bản:** không sửa được bản đã xuất bản; tạo phiên bản mới đã sửa, xuất bản ngay (bản mới hơn thắng), rồi lưu trữ bản lỗi nếu cần.
  Các dòng chấp thuận đã ghi cho bản lỗi **giữ nguyên** (FK `Restrict`, không xoá được bản đã có người chấp thuận).

---

## 4. Không làm

- Không sửa trực tiếp bảng `legal_document_versions`/`user_legal_acceptances` bằng SQL trên DB dùng chung (trigger chặn sửa nội dung bản đã phát hành;
  `gieochu_app` không có quyền UPDATE `user_legal_acceptances`).
- Không xoá user để "dọn" chấp thuận — chính sách **không xoá user, chỉ khoá** ([[02-System-Specs/User-Management-System-Center-Specs|User-Management-System-Center-Specs]] §3.4).
- Không công bố bản dự thảo (`docs/legal/drafts/`) như văn bản chính thức — hoãn sang giai đoạn pháp lý.

---

## 5. Liên kết

* [[02-System-Specs/Legal-Documents-Specs|Legal-Documents-Specs]] ([Legal-Documents-Specs.md](../02-System-Specs/Legal-Documents-Specs.md)) · [[03-API-Contracts/Endpoint-Directory|Endpoint-Directory]] §3.1, §26.4
* [[04-Operations-Runbooks/Deploy-Vercel-Runbook|Deploy-Vercel-Runbook]] §9.11 — migration ADR-050 · [[02-System-Specs/Audit-Log-Specs|Audit-Log-Specs]] §4 — 5 action pháp lý

*Quay lại: [[MOC-Home]] (../00-Index/MOC-Home.md)*

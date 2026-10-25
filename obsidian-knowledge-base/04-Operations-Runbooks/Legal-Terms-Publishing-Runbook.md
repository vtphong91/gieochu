---
tags:
  - runbook
  - legal
  - system-admin
  - ops
  - status/living
date: 2026-10-23
updated: 2026-10-25
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
> **Từ "Bổ sung ADR-057" (2026-10-25, code chưa commit ✅ đọc code):** trang soạn tên **"Chính sách sử dụng"**; UI **không còn khái niệm phiên bản** — mỗi văn
> bản chỉ một nội dung, không còn tạo phiên bản tay, không còn nút **Lưu trữ** (Quốc chốt 2026-10-25 bỏ thao tác Lưu trữ khỏi runbook). Phía sau mỗi lần
> Xuất bản vẫn tạo một bản PUBLISHED bất biến làm bằng chứng đồng ý. Thêm tuỳ chọn **"Công bố dạng bản dự thảo"** (migration ADR-057 đã chạy 2026-10-25 🟡).
> Quyết định: [[01-Architecture-Decisions/ADR-042-Legal-Drafts-Import-Preview-Draft-Release|ADR-042 KB (≙ ADR-057)]].
>
> Nhãn nút/ô dưới đây là của editor hiện tại ✅ `app/admin/cms/phap-ly/legal-editor.tsx` — chữ có thể đổi, **luật thì không**.

---

## 0. Điều kiện trước

| Điều kiện | Kiểm |
| :-- | :-- |
| Migration `20261023090000_adr050_legal_documents` đã chạy trên DB đích | 🟡 đã chạy trên DB dùng chung (brief Quốc). DB khác (restore, branch mới): `pnpm db:migrate` **trước** deploy — code **không** bắt lỗi bảng chưa có ở `/register` (xem KB-Audit §31) |
| Code ADR-050 đã deploy | ❓ chưa commit tại 2026-10-23 |
| Nội dung đã qua rà soát pháp lý thật (luật sư/người có thẩm quyền) | ❓ — dự thảo `docs/legal/drafts/dieu-khoan-su-dung.md` do Long soạn, **chưa được luật sư rà soát**, còn 32 chỗ `[[CẦN XÁC NHẬN` ✅ grep; checklist `docs/legal/LEGAL_REVIEW_CHECKLIST.md` |
| Tài khoản `SYSTEM_ADMIN` | Mọi thao tác dưới đây tự `requireRole("SYSTEM_ADMIN")` |

⚠️ **Một DB duy nhất (ADR-034):** máy dev, Preview và Production dùng cùng database — xuất bản từ bất kỳ môi trường nào là xuất bản **thật** cho người dùng
production. Không "thử xuất bản" một bản chưa duyệt — dùng **Xem trước**; bản đã xuất bản **không sửa, không xoá được** (trigger DB) — muốn đổi thì soạn tiếp và Xuất bản lại.

---

## 1. Quy trình (editor một nội dung — Bổ sung ADR-057)

**Soạn → Lưu nháp → Xem trước → tích "Đã rà soát nội dung" (bản chính thức) hoặc tích "Công bố dạng bản dự thảo" → Xuất bản.**

1. **Mở văn bản** — System Center → **"Chính sách sử dụng"** (`/admin/cms/phap-ly`) → chọn 1 trong 7 văn bản ở hàng chọn (`?van-ban=<khoá>`). Khung soạn
   hiện **bản nháp làm việc** nếu có, không thì nội dung bản đang xuất bản ✅ `getLegalEditorData`. Có thay đổi chưa lưu mà bấm sang văn bản khác / sidebar →
   hộp hỏi lại (ADR-058).
2. **Soạn** — dùng H2/H3 cho các mục; **không** chèn được ảnh (sanitize bỏ ảnh). Dùng `{brand}` thay tên nền tảng. Thay các `[[CẦN XÁC NHẬN: …]]` bằng thông tin
   đã xác nhận khi có.
3. **Lưu nháp** — sửa bản nháp làm việc, chưa có thì tự tạo (`LEGAL_VERSION_UPDATED` / `LEGAL_VERSION_CREATED`). Mỗi lần **nội dung** đổi, rà soát tự quay về
   "Chờ rà soát". Nội dung trùng bản đang xuất bản và chưa có nháp → không tạo gì.
4. **Xem trước** — mở tab mới `/phap-ly/xem-truoc?van-ban=…` đúng giao diện trang công khai (chỉ SYSTEM_ADMIN, noindex). Xem trước hiển thị **bản đã lưu** —
   Lưu nháp trước khi xem thay đổi mới.
5. **Chọn một trong hai:**
   - **Bản chính thức:** tích **"Đã rà soát nội dung"** — chỉ tích khi đúng nội dung đã lưu này đã được người có thẩm quyền duyệt (ô bị khoá khi còn thay đổi chưa
     lưu hoặc chưa có nháp). Ghi `LEGAL_REVIEW_STATUS_CHANGED`. Phải hết mọi `[[CẦN XÁC NHẬN` (kể cả nằm giữa thẻ HTML).
   - **Bản dự thảo:** tích **"Công bố dạng bản dự thảo"** — bỏ qua yêu cầu rà soát + placeholder (vẫn phải có nội dung). Trang công khai có nhãn "Bản dự thảo",
     dấu `[[CẦN XÁC NHẬN: …]]` hiện "(đang cập nhật)". ⚠️ **Không ghi chấp thuận** bản dự thảo — khi văn bản đang hiển thị bản dự thảo, đăng ký / mở gian hàng
     không ghi đồng ý văn bản đó (kể cả khi trước đó có bản chính thức cũ hơn) ✅ `getAcceptanceLegalVersion`.
6. **Xuất bản** — ô "Ngày hiệu lực (tuỳ chọn, giờ Việt Nam)": để trống = hiệu lực ngay; đặt tương lai = đã lên lịch (tự có hiệu lực, không cần cron). **Không** đặt
   quá khứ (dung sai 5 phút). Xác nhận hộp thoại → **Xuất bản** (`LEGAL_VERSION_PUBLISHED`, metadata `effectiveAt`, `isDraftRelease`). Sidebar liệt kê lý do chưa
   xuất bản được; server kiểm lại.

Lỗi thường gặp: "Nội dung vừa được thay đổi ở nơi khác (tab hoặc người khác)…" (409 `LEGAL_VERSION_CONFLICT`) → tải lại trang rồi làm lại bước đang dở.

---

## 2. ⚠️ Xuất bản bản đầu tiên làm form đăng ký đổi hành vi

Trước khi có bản đang hiệu lực, đăng ký chạy như trước ADR-050 (chỉ ghi `consentAt`). **Ngay khi** bản đầu tiên có hiệu lực (lúc xuất bản nếu để trống
ngày, hoặc đúng giờ đã lên lịch):
- Checkbox đăng ký đổi chữ thành link "Điều khoản sử dụng" (mở tab mới) tới bản đang hiệu lực.
- **Mọi** lượt đăng ký mới ghi một dòng `user_legal_acceptances` (userId, versionId, acceptedAt) trong cùng transaction tạo tài khoản — không lưu IP/UA.
- Người đang mở form từ trước khi bản mới có hiệu lực sẽ gửi id cũ → nhận lỗi 409 "Điều khoản sử dụng vừa được cập nhật. Vui lòng tải lại trang…" và
  phải đăng ký lại sau khi tải trang. Từ bổ sung ADR-057: **không gửi id** cũng bị 409 — trước đây server tự ghi bản đang hiệu lực ✅.
- Người dùng **đã có tài khoản** không bị yêu cầu chấp thuận lại (ADR-050) — không có dòng chấp thuận cho họ.

Sau khi xuất bản, kiểm nhanh ❓ (chưa làm trên môi trường thật): mở `/dieu-khoan-su-dung` (từ ADR-054; trước đó `/phap-ly/dieu-khoan-su-dung`) (hiện "Phiên bản n.0 · Có hiệu lực từ …"), mở `/register`
xem link mới, đăng ký thử **chỉ** bằng email kiểm thử (không gửi email tới địa chỉ thật của người khác — CLAUDE.md, ADR-034).

---

## 3. Cập nhật nội dung đã xuất bản

- **Sửa tiếp:** soạn lại trên cùng màn hình → lặp §1 bước 3–6. Mỗi lần Xuất bản tạo thêm một bản PUBLISHED phía sau; bản hiệu lực là bản PUBLISHED có ngày hiệu
  lực ≤ hiện tại **mới nhất**. Đặt ngày tương lai để báo trước (cách báo người dùng chưa có ❓).
- **Từ bản dự thảo lên bản chính thức:** không "nâng" được bản đã công bố (cờ bất biến — trigger). Hoàn tất nội dung, Lưu nháp, tích "Đã rà soát nội dung", **bỏ tích**
  "Công bố dạng bản dự thảo", Xuất bản → bản chính thức mới thắng; từ đó đăng ký / mở gian hàng ghi chấp thuận bản này.
- **Sai sót sau khi xuất bản:** không sửa được bản đã xuất bản; sửa nội dung rồi Xuất bản ngay (bản mới hơn thắng). Các dòng chấp thuận đã ghi cho bản lỗi
  **giữ nguyên** (FK `Restrict`).
- **Gỡ một văn bản khỏi trang công khai:** UI **không còn** thao tác Lưu trữ (Quốc chốt 2026-10-25). `archiveLegalVersion` vẫn còn trong `lib/legal.ts` nhưng không
  có Server Action gọi ✅ grep — nếu cần gỡ, hỏi Quốc; **không** tự sửa SQL (§4).

---

## 4. Không làm

- Không sửa trực tiếp bảng `legal_document_versions`/`user_legal_acceptances` bằng SQL trên DB dùng chung (trigger chặn sửa nội dung bản đã phát hành;
  `gieochu_app` không có quyền UPDATE `user_legal_acceptances`).
- Không xoá user để "dọn" chấp thuận — chính sách **không xoá user, chỉ khoá** ([[02-System-Specs/User-Management-System-Center-Specs|User-Management-System-Center-Specs]] §3.4).
- Không công bố nội dung chưa rà soát như **bản chính thức** — nếu cần cho khách tham khảo sớm, dùng "Công bố dạng bản dự thảo" (ADR-057).

---

## 5. Liên kết

* [[02-System-Specs/Legal-Documents-Specs|Legal-Documents-Specs]] ([Legal-Documents-Specs.md](../02-System-Specs/Legal-Documents-Specs.md)) · [[03-API-Contracts/Endpoint-Directory|Endpoint-Directory]] §3.1, §26.4
* [[01-Architecture-Decisions/ADR-042-Legal-Drafts-Import-Preview-Draft-Release|ADR-042 KB (≙ ADR-057)]] · [[04-Operations-Runbooks/Deploy-Vercel-Runbook|Deploy-Vercel-Runbook]] §9.11 — migration ADR-050 · [[02-System-Specs/Audit-Log-Specs|Audit-Log-Specs]] §4 — action pháp lý

*Quay lại: [[MOC-Home]] (../00-Index/MOC-Home.md)*

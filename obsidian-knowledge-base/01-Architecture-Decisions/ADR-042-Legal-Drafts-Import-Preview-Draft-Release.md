---
tags:
  - adr
  - legal
  - cms
  - system-admin
  - database
  - ui-ux
  - status/accepted
date: 2026-10-25
decider: vtphong91
status: Accepted (Chốt — Áp dụng chính thức)
---

# 🏛️ ADR-042: Nạp 7 dự thảo chính sách vào CMS, xem trước, công bố "Bản dự thảo"; editor một nội dung; đổi tên "Chính sách sử dụng"

## 1. Trạng Thái (Status)
**ĐÃ PHÊ DUYỆT (Accepted)** — tương ứng **ADR-057** trong [`docs/DECISIONS.md`](../../docs/DECISIONS.md) (chủ dự án chốt 2026-10-25), gồm
"Bổ sung ADR-057" (ẩn phiên bản khỏi giao diện, bố cục editor). Bản trích ghi theo duyệt của Quốc (brief task 0.4 ADR-058, 2026-10-25).

Tiến độ (2026-10-25):
- Code ở working tree, **chưa commit** ✅ `git status`.
- **Editor một nội dung** (Bổ sung ADR-057): xong code ✅ đọc code.
- **Migration** `packages/db/prisma/migrations/20261025120000_adr057_legal_draft_release/` (cột `isDraftRelease`): **đã chạy 2026-10-25** 🟡 theo
  "Bổ sung ADR-058" (c) trong `docs/DECISIONS.md` — Long không đọc DB để kiểm. Code đã bật tính năng: `schema.prisma` có cột, hằng
  `LEGAL_DRAFT_RELEASE_AVAILABLE = true` ✅ đọc code. *(Lần đọc đầu trong phiên, cột chưa có trong `schema.prisma` và hằng còn `false` — code đổi trong
  lúc Long ghi; KB-Audit §38.)*
- Script nạp 7 bản nháp **đã chạy** 🟡 theo "Bổ sung ADR-057" — Long không đọc DB.
- `pnpm test:count` = **100/100 unit, 66/66 integration** ✅ (Long chạy, chỉ đếm). `legal.test.ts` thêm assert vào case có sẵn ✅ `git diff --stat`.

Mức xác minh: ✅ Long đã đối chiếu code working tree · 🟡 theo `docs/DECISIONS.md`/brief của Quốc · ❓ cần môi trường thật.

---

## 2. Bối Cảnh (Context) 🟡
7 dự thảo (`docs/legal/drafts/*.md`, ADR-050/054) chưa nằm trong CMS nên trang soạn trống. Chủ dự án muốn quản lý toàn bộ trong CMS (soạn, xem nháp,
xem trước, xuất bản) và cho khách hàng tham khảo trước khi hoàn tất thông tin pháp nhân / rà soát.

---

## 3. Quyết Định (Decision)

### 3.1. Nạp bằng script (phương án C) ✅ (`apps/web/scripts/import-legal-drafts.ts`)
- Lệnh: `pnpm --filter @gieochu/web run legal:import-drafts -- --actor-email=<email admin>` (chạy thử, mặc định) · thêm `--apply` để ghi DB.
- Lấy phần nội dung từ H2 đầu tiên tới dòng `---` trước "**Ghi chú nội bộ"; Markdown → HTML (`marked`) → `sanitizeLegalHtml`. Giữ `{brand}` và
  `[[CẦN XÁC NHẬN: …]]` (đếm trước/sau).
- Idempotent: đã có phiên bản trùng HTML → bỏ qua; có bản DRAFT trống → điền vào; còn lại → tạo DRAFT mới. Không xuất bản, không sửa bản
  PUBLISHED/ARCHIVED. Audit `LEGAL_VERSION_CREATED/UPDATED`.
- DB dùng chung với production (ADR-034 ≙ [[01-Architecture-Decisions/ADR-020-Single-Database-Dev-Preview-Production|ADR-020 KB]]) — chạy thử trước, `--apply` khi Quốc duyệt.

### 3.2. Xem trước ✅ (`apps/web/app/phap-ly/xem-truoc/page.tsx`)
- Chỉ SYSTEM_ADMIN (`requireAdminAccess`: chưa đăng nhập → `/login`, không phải admin → 404). `noindex`, `force-dynamic`, chỉ đọc.
- URL `LEGAL_PREVIEW_PATH = "/phap-ly/xem-truoc"`, query `?van-ban=<khoá>&phien-ban=<id>` (thiếu `phien-ban` → bản mới nhất); dựng bằng `legalPreviewPath()`.
- Hiển thị bằng `LegalDocumentView` (cùng giao diện trang công khai) kèm thanh "Xem trước — chưa công khai". Đặt ngoài `/admin` để tránh `<main>` lồng nhau.

### 3.3. Công bố "Bản dự thảo" ✅
- Ô "Công bố dạng bản dự thảo" trong editor. Xuất bản dạng dự thảo **bỏ qua** cổng placeholder + "đã rà soát" (vẫn phải là DRAFT và có nội dung);
  lưu `isDraftRelease = true` (`publishLegalVersion`).
- Trang công khai: banner "Bản dự thảo", dòng meta ghi "Công bố ngày" thay "Hiệu lực từ". `[[CẦN XÁC NHẬN: …]]` hiển thị "(đang cập nhật)"
  (`replaceLegalPlaceholders`, chạy sau sanitize).
- **Không dùng để ghi nhận đồng ý:** `getAcceptanceLegalVersion` trả `null` khi bản đang hiển thị là bản dự thảo (kể cả khi có bản chính thức cũ hơn);
  `resolveAcceptedLegalVersion`/`resolveSellerPolicyAcceptance` chặn thêm lớp thứ hai; form đăng ký không gửi `versionId` của bản dự thảo.
- Bản chính thức vẫn qua cổng ADR-050 (APPROVED + không placeholder).
- Migration expand-only: thêm cột `isDraftRelease BOOLEAN NOT NULL DEFAULT false` + tạo lại trigger đóng băng (cờ không sửa được sau khi PUBLISHED).
  Bảng L1, không RLS, không cần GRANT thêm.

### 3.4. Đổi tên ✅
- Menu + tiêu đề trang soạn: "Văn bản pháp lý" → **"Chính sách sử dụng"**. Đường dẫn `/admin/cms/phap-ly` giữ nguyên.
- Văn bản `contact`: → **"Liên hệ và thông tin đơn vị vận hành"**.
- Ô tích: → **"Đã rà soát nội dung"**. Nhãn audit `LEGAL_REVIEW_STATUS_CHANGED`: "Đổi trạng thái rà soát nội dung".

### 3.5. Editor một nội dung (Bổ sung ADR-057) ✅
- Mỗi văn bản chỉ hiện **một** nội dung: Lưu nháp / Xem trước / Xuất bản, hiện "Cập nhật lúc …". Không còn danh sách phiên bản, không còn nút Lưu trữ trên UI.
- Phía sau vẫn giữ phiên bản: mỗi lần Xuất bản tạo một bản PUBLISHED bất biến (bằng chứng đồng ý ADR-050); bản nháp làm việc = DRAFT mới nhất có nội dung
  (`pickWorkingLegalDraft`), tự tạo khi sửa tiếp. Chống ghi đè giữa tab: `expectedUpdatedAt`, lệch → `LEGAL_VERSION_CONFLICT` (409).
- Server Action mới: `saveLegalDraftAction`, `setLegalReviewAction`, `publishLegalAction` (thay 5 action theo phiên bản cũ) — contract:
  [[03-API-Contracts/Endpoint-Directory|Endpoint-Directory]] §26.4.
- Bố cục: nội dung bên trái, sidebar chức năng bên phải; khối "Tối ưu SEO" dưới nội dung, thu gọn mặc định. Cảnh báo rời trang qua
  `useUnsavedChanges` ([[01-Architecture-Decisions/ADR-043-Module-Tabs-Accordion-Unsaved-Guard|ADR-043 KB]]). Không migration cho phần này.

---

## 4. Lý Do (Rationale) 🟡
- Nạp bằng script giữ đúng sanitize/luật trạng thái của lib, có chạy thử, không phải chép tay 7 văn bản.
- Bản dự thảo cho khách tham khảo sớm nhưng không tạo bằng chứng đồng ý cho nội dung chưa hoàn tất.
- Ẩn phiên bản giúp admin chỉ thấy một nội dung, vẫn giữ lịch sử bất biến phía sau.

---

## 5. Hệ Quả (Consequences)
- Bỏ nút Lưu trữ trên UI: `archiveLegalVersion` vẫn còn trong `lib/legal.ts` nhưng không còn Server Action gọi ✅ grep. Runbook
  [[04-Operations-Runbooks/Legal-Terms-Publishing-Runbook|Legal-Terms-Publishing-Runbook]] còn mô tả thao tác Lưu trữ — cần Quốc xác nhận (KB-Audit §38).
- Khi đang hiển thị bản dự thảo, đăng ký / mở gian hàng **không ghi chấp thuận** văn bản đó.
- Kiểm trên trình duyệt với dữ liệu thật ❓.

---

## 6. Liên Kết
* [[01-Architecture-Decisions/ADR-035-Menu-Home-Seo-Versioned-Terms|ADR-035 KB (≙ ADR-050)]] — văn bản có phiên bản, cổng xuất bản
* [[01-Architecture-Decisions/ADR-040-Legal-Pages-Phase-2-Root-Urls-Consent|ADR-040 KB (≙ ADR-054)]] — 7 văn bản, URL cấp gốc, ghi đồng ý
* [[02-System-Specs/Legal-Documents-Specs|Legal-Documents-Specs]] · [[03-API-Contracts/Endpoint-Directory|Endpoint-Directory]] §26.4 ·
  [[04-Operations-Runbooks/UI-Design-System|UI-Design-System]] §13.7
* [[00-Index/KB-Audit-2026-09-26|KB-Audit]] §38 — lệch phát hiện khi ghi nhận

*Quay lại: [[MOC-Home]] (../00-Index/MOC-Home.md)*

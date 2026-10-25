---
tags: [ke-hoach, phap-ly, cms, seo]
date: 2026-10-24
---

# Kế hoạch: Trang pháp lý đợt 2 — chờ chủ dự án chốt

> **Cập nhật 2026-10-24 (Long):** chủ dự án đã chốt thành **ADR-054** trong `docs/DECISIONS.md` (đánh số ADR-052 trước lần đổi số 2026-10-24, ADR-053 trước lần đổi số 2026-10-25) và
> code đã xong ở working tree (chưa commit). Quyết định khác đề xuất dưới đây ở mấy điểm: URL **cấp gốc** `/{slug}` (bỏ tiền tố `/phap-ly/`,
> đường cũ redirect 308), **không có hub**, `copyright` tách riêng, mô tả/SEO sửa trong CMS (**có** migration
> `20261024150000_adr053_legal_document_meta` — đã chạy 2026-10-24), +1 integration test. Phần còn lại của file giữ nguyên làm hồ sơ đề xuất; trạng thái
> hiện hành xem `docs/PLAN.md` và `obsidian-knowledge-base/02-System-Specs/Legal-Documents-Specs.md`.

> Người soạn: Long (tài liệu) theo brief của Quốc, 2026-10-24. **Đây là đề xuất, chưa phải quyết định**: danh sách trang,
> gộp/tách, chỗ đặt link và phần kỹ thuật do Quốc và chủ dự án chốt. Chưa có code, chưa có DDL cho đợt này.
>
> Đầu vào: brief pháp lý gốc `docs/claude-code-gieochu-legal-pages-implementation-brief.md`; kế hoạch đợt 1
> `docs/ke-hoach-home-legal-menu-seo-2026-10-23.md` §3; đề xuất UX `docs/de-xuat-ux-home-legal-menu-2026-10-23.md` §2;
> `docs/legal/LEGAL_REVIEW_CHECKLIST.md`; ADR-050 (+ 3 lần bổ sung), ADR-038, ADR-039, ADR-040, ADR-041, ADR-053 trong
> `docs/DECISIONS.md`; dự thảo `docs/legal/drafts/dieu-khoan-su-dung.md`.
>
> **Mức xác minh:** ✅ đã đối chiếu code/schema ngày 2026-10-24 · 🟡 theo ADR/báo cáo, chưa đọc lại code · ❓ cần môi trường
> thật hoặc chủ dự án/luật sư quyết.
>
> **Đọc lại khi bị gián đoạn:** §0 → §2 (danh sách trang) → §6 (kỹ thuật) → §10 (câu hỏi).

---

## 0. Trạng thái

| Hạng mục | Trạng thái 2026-10-24 |
|---|---|
| Hạ tầng văn bản có phiên bản (ADR-050 mục 3) | ✅ Có code: bảng `legal_documents`, `legal_document_versions`, `user_legal_acceptances`; editor `/admin/cms/phap-ly`; trang `/phap-ly/[slug]`; chặn xuất bản khi còn `[[CẦN XÁC NHẬN` hoặc chưa `APPROVED`; token `{brand}` thay khi render |
| Văn bản đã khai báo trong code | ✅ Chỉ `terms` (`packages/core/src/legal/legal-document.ts`) |
| Bản Điều khoản đã xuất bản | ❓ Theo PLAN.md: chưa có (dự thảo còn placeholder) — Long không đọc DB |
| Dự thảo đợt 2 | Xong 6 file trong `docs/legal/drafts/` (§2) — **bản dự thảo, chưa được luật sư rà soát** |
| Checklist pháp lý | Thêm DL-08, DL-09, BQ-09 (2026-10-24) |
| Chốt danh sách trang / chỗ đặt link / kỹ thuật | **Chờ Quốc + chủ dự án** (§10) |
| Test | `pnpm test:count` 2026-10-24: 99/99 unit, 63/63 integration (đã chạm trần). Đợt 2 đề xuất **không** thêm test (§6.4) |

---

## 1. Hiện trạng liên quan (sau đợt 1)

| # | Hiện trạng | Mức |
|---|---|---|
| H1 | `LEGAL_DOCUMENT_DEFS` chỉ có `terms → dieu-khoan-su-dung`. `legalKeyFromSlug` trả `null` cho slug khác → `/phap-ly/<slug khác>` là 404 | ✅ |
| H2 | Dòng `legal_documents` được tạo bằng `ensureLegalDocument` (upsert) lần đầu admin tạo bản nháp — **không seed**. Upsert `update: {}` → đổi `title` trong code sau này **không** cập nhật dòng DB | ✅ `apps/web/lib/legal.ts` |
| H3 | Server Action của editor nhận `key` bất kỳ đã khai báo (`toKey`) — đã tổng quát. Nhưng **trang** `/admin/cms/phap-ly` gán cứng `key = "terms"`; `revalidate()` chỉ làm mới `/admin/cms/phap-ly`, trang văn bản, `/register` | ✅ `apps/web/app/admin/cms/phap-ly/{page,actions}.ts(x)` |
| H4 | `/phap-ly/[slug]` `generateMetadata`: `title = "{tiêu đề} \| {brand}"`, canonical; **không có description**. Breadcrumb: Trang chủ › Tên văn bản (chưa có cấp hub) | ✅ |
| H5 | Bảng `legal_documents` **không** có cột mô tả/SEO (`id, key, slug, title, createdAt, updatedAt`) | ✅ `schema.prisma` |
| H6 | Không có trang hub `/phap-ly` (chỉ có `app/phap-ly/[slug]`) | ✅ |
| H7 | Menu CMS: loại link `page`, `internal`, `external`, `email`; "Trang có sẵn" = `home, shop, documents, pricing, register, login` + `cms:<slug>`. **Không** có loại văn bản pháp lý, **không** tự ẩn link khi văn bản chưa có bản hiệu lực. Footer mặc định: cột Khám phá (Cửa hàng, Bảng giá) — không có cột Pháp lý | ✅ `packages/core/src/admin/site-menu.ts` |
| H8 | Sanitizer nội dung (`sanitizeRichTextHtml`) ép **mọi** link `target="_blank" rel="noopener noreferrer nofollow"`, kể cả link nội bộ `/phap-ly/...`; không cho bảng (`table`), không cho thuộc tính `id` | ✅ `packages/core/src/content/sanitize-html.ts` |
| H9 | Đăng ký: có link Điều khoản khi có bản hiệu lực; cụm "chính sách xử lý dữ liệu cá nhân" là chữ thường, không link; chỉ ghi chấp thuận `terms` | ✅ `register-form.tsx`, `api/auth/register/route.ts` |
| H10 | Xuất bản tài liệu: ô `rightsConfirmed` bắt buộc, không link văn bản; mở gian hàng: không có bước chấp thuận/link; checkout: không có dòng chính sách | ✅ |
| H11 | Báo cáo vi phạm: 4 loại, đối tượng `PRODUCT/REVIEW/POST`, ≤ 5 link bằng chứng, không form độc lập, không mã tiếp nhận | ✅ |
| H12 | Không có analytics/script bên thứ ba; CSP chỉ thêm Cloudinary cho ảnh/upload | ✅ `apps/web/proxy.ts` |
| H13 | Kiểm tra tệp tải lên chỉ là kiểm định dạng (magic bytes); **chưa quét virus** (ClamAV chưa có client) | ✅ `apps/web/lib/file-scan.ts` |
| H14 | Nhật ký tải `download_events` lưu IP, **không** có bước dọn theo thời hạn | ✅ `apps/web/app/api/cron/daily/route.ts` |

---

## 2. Danh sách trang đợt 2 (đề xuất)

Nguyên tắc: không tạo trang trống; gộp khi cùng người đọc và cùng mục đích; mỗi nội dung chỉ nằm ở **một** văn bản, văn bản
khác dẫn chiếu tới (tránh trùng và lệch khi sửa). Tất cả dưới tiền tố `/phap-ly/` (đã dành riêng `phap-ly` trong
`RESERVED_SLUGS` ✅) → **không** cần thêm từ dành riêng mới.

| # | Văn bản | Đường dẫn | Khoá đề xuất | Người đọc | Dự thảo | Placeholder |
|---|---|---|---|---|---|---|
| 0 | (Đã có) Điều khoản sử dụng | `/phap-ly/dieu-khoan-su-dung` | `terms` | Mọi người | `docs/legal/drafts/dieu-khoan-su-dung.md` | 32 (đợt 1) |
| 1 | Chính sách bảo mật | `/phap-ly/chinh-sach-bao-mat` | `privacy` | Mọi người | `docs/legal/drafts/chinh-sach-bao-mat.md` | 15 |
| 2 | Chính sách nội dung | `/phap-ly/chinh-sach-noi-dung` | `content_policy` | Mọi người | `docs/legal/drafts/chinh-sach-noi-dung.md` | 7 |
| 3 | Cam kết bản quyền và nguồn gốc tài liệu | `/phap-ly/cam-ket-ban-quyen` | `copyright` | Người bán; chủ sở hữu quyền | `docs/legal/drafts/cam-ket-ban-quyen.md` | 3 |
| 4 | Quyền sử dụng tài liệu | `/phap-ly/quyen-su-dung-tai-lieu` | `usage_license` | Người mua | `docs/legal/drafts/quyen-su-dung-tai-lieu.md` | 1 |
| 5 | Chính sách người bán | `/phap-ly/chinh-sach-nguoi-ban` | `seller` | Người bán | `docs/legal/drafts/chinh-sach-nguoi-ban.md` | 6 |
| 6 | Liên hệ và thông tin pháp lý | `/phap-ly/lien-he` | `contact` | Mọi người | `docs/legal/drafts/lien-he.md` | 7 |

(Số placeholder = số lần xuất hiện `[[CẦN XÁC NHẬN: mã]]` trong phần nội dung; một mã có thể xuất hiện ở nhiều văn bản.)

### 2.1. Chính sách bảo mật — `/phap-ly/chinh-sach-bao-mat`

- **Mục đích:** dữ liệu nào được thu thập, để làm gì, ai xem, lưu bao lâu, quyền của người dùng. **Gộp** cookie (chỉ có
  cookie đăng nhập — H12) và lưu trữ/khoá tài khoản (không có chức năng xoá — bổ sung ADR-050).
- **Mục chính:** 1 Phạm vi · 2 Dữ liệu thu thập (tài khoản, hồ sơ tuỳ chọn, gian hàng, mua/nhận tài liệu, nội dung gửi lên,
  báo cáo, kỹ thuật & phiên) · 3 Mục đích · 4 Ai được xem (bạn, người bán, công khai, quản trị viên, nhà cung cấp, cơ quan
  nhà nước) · 5 Cookie & lưu trữ trình duyệt · 6 Bảo vệ dữ liệu · 7 Thời gian lưu · 8 Khoá tài khoản & yêu cầu xoá ·
  9 Quyền của bạn · 10 Trẻ em · 11 Sự cố · 12 Nơi lưu & chuyển ra nước ngoài · 13 Thay đổi · 14 Liên hệ.
- **Liên kết chéo:** Điều khoản (định nghĩa, độ tuổi), Chính sách nội dung (dữ liệu học sinh), Liên hệ.
- **Mã chính:** PL-01, PL-07, DL-01…DL-09, ND-02, ND-05, ND-07, BQ-06.

### 2.2. Chính sách nội dung — `/phap-ly/chinh-sach-noi-dung`

- **Mục đích:** quy định khi đăng/chia sẻ nội dung (tài liệu, link tài liệu, mô tả, bài viết, đánh giá, tin nhắn), nhóm
  **bị cấm / hạn chế / được phép** có ví dụ, nội dung AI, **gộp phần mô tả quy trình báo cáo và xử lý vi phạm** theo
  `abuse_reports` hiện có (thay cho trang `/bao-cao-vi-pham` riêng ở đợt này — form độc lập chưa có, xem §2.8).
- **Mục chính:** 1 Phạm vi · 2 Nguyên tắc · 3 Bị cấm (7 nhóm) · 4 Hạn chế · 5 Được phép · 6 AI · 7 Báo cáo (cách gửi, bảo vệ
  người báo cáo, không lạm dụng) · 8 Xem xét & xử lý (4 quyết định, khoá kiểm duyệt, thông báo, kháng nghị, cơ quan nhà
  nước) · 9 Hậu quả với tài khoản/gian hàng · 10 Văn bản liên quan.
- **Liên kết chéo:** Điều khoản (mục 9, 10.3, 12), Cam kết bản quyền, Bảo mật, Liên hệ.
- **Mã chính:** BQ-02, BQ-03, BQ-04, BQ-05, BQ-08, BQ-09.

### 2.3. Cam kết bản quyền và nguồn gốc tài liệu — `/phap-ly/cam-ket-ban-quyen`

- **Mục đích:** văn bản mà ô xác nhận khi xuất bản tài liệu dẫn tới; **gộp** "hướng dẫn khiếu nại bản quyền" (brief §4.7).
- **Mục chính:** 1 Dành cho ai · 2 Sở hữu / sử dụng / phân phối; ghi nguồn ≠ được phép · 3 Cam kết khi xuất bản · 4 Nội dung
  của người khác · 5 Giấy phép mở · 6 AI · 7 Tài liệu nhóm/trường/công việc · 8 Bằng chứng & trách nhiệm · 9 Hướng dẫn khiếu
  nại bản quyền · 10 Văn bản liên quan.
- **Liên kết chéo:** Chính sách nội dung (mục 8 xử lý), Điều khoản 10.3, Chính sách người bán.
- **Mã chính:** BQ-01, BQ-09, PL-07.

### 2.4. Quyền sử dụng tài liệu — `/phap-ly/quyen-su-dung-tai-lieu`

- **Mục đích:** người mua được/không được làm gì với tài liệu đã mua hoặc nhận (kể cả miễn phí, kể cả qua link chia sẻ của
  người bán); cách nhận và tải; khi quyền chấm dứt.
- **Mục chính:** 1 Nhận quyền sử dụng, không chuyển quyền sở hữu · 2 Được làm gì (KD-10) · 3 Không được làm gì · 4 Nhận &
  tải (lượt tải chụp tại lúc mua, link tạm thời, link ngoài) · 5 Link chia sẻ · 6 Khi quyền thay đổi/chấm dứt (hoàn tiền, bị
  gỡ, gian hàng ngừng) · 7 Hỗ trợ & hoàn tiền (dẫn Điều khoản mục 10) · 8 Liên quan.
- **Liên kết chéo:** Điều khoản (6.2, 10, 12), Chính sách nội dung, Liên hệ.
- **Mã chính:** KD-10 (toàn bộ phạm vi được phép).

### 2.5. Chính sách người bán — `/phap-ly/chinh-sach-nguoi-ban`

- **Mục đích:** mở/duy trì gian hàng, gói, nhận tiền, đăng & giao tài liệu, hoàn tiền tài liệu, dữ liệu người mua, hành vi
  cấm, báo cáo vi phạm, tạm ngưng/khoá. **Không** chép giá/hạn mức (dẫn Bảng giá).
- **Mục chính:** 1 Phạm vi · 2 Mở gian hàng · 3 Gói · 4 Nhận tiền · 5 Đăng tài liệu · 6 Giao & hỗ trợ · 7 Hoàn tiền tài liệu ·
  8 Dữ liệu người mua · 9 Hành vi cấm · 10 Khi có báo cáo · 11 Tạm ngưng & khoá · 12 Liên quan.
- **Liên kết chéo:** Điều khoản (7, 10, 10.4), Cam kết bản quyền, Chính sách nội dung, Bảo mật.
- **Mã chính:** ND-03, ND-08, KD-04, KD-05, KD-07, DL-08.

### 2.6. Liên hệ và thông tin pháp lý — `/phap-ly/lien-he`

- **Mục đích:** gộp `/lien-he-ho-tro` + `/thong-tin-phap-ly` (brief §4.7): đơn vị vận hành và kênh liên hệ theo nhu cầu.
- **Mục chính:** 1 Đơn vị vận hành · 2 Liên hệ theo nhu cầu (tài khoản/gói; tài liệu đã mua → gian hàng trước; báo cáo vi
  phạm; bản quyền & dữ liệu cá nhân) · 3 Lưu ý khi liên hệ · 4 Liên quan. **Không** có mục thời gian phản hồi (brief cấm tự
  đặt).
- **Mã chính:** PL-01…PL-07.
- **Ghi chú:** đề xuất đợt 2 lưu như **một văn bản pháp lý** (nhập tay, có phiên bản, chặn xuất bản khi còn placeholder) —
  không cần migration. Hệ quả: đổi `supportEmail` ở System Settings không tự đổi trang này (phải tạo phiên bản mới). Phương
  án đọc từ cấu hình (`SystemSettings` thêm cột pháp nhân — kế hoạch đợt 1 §3.2) để sau (Q-6).

### 2.7. Văn bản **không** tạo ở đợt 2 và lý do

| Trang trong brief | Xử lý | Lý do |
|---|---|---|
| `/chinh-sach-hoan-tien` | **Không tách** — giữ trong Điều khoản mục 10 | Điều khoản 10.1–10.4 đã chứa toàn bộ (hoàn tiền tài liệu, khi tài liệu bị gỡ, hoàn tiền gói); hai phần chính còn placeholder (KD-07, KD-08). Tách sớm sẽ trùng nội dung. Tách khi KD-07 có câu trả lời và nội dung đủ dài (Q-3) |
| `/bao-cao-vi-pham` (trang quy trình + form) | Phần quy trình **gộp** vào Chính sách nội dung §7–§8; **form độc lập** để đợt mở rộng `abuse_reports` (M-R) | Form/mã tiếp nhận/7 loại báo cáo cần migration + quyết định nghiệp vụ (kế hoạch đợt 1 §3.5) — hoãn theo ADR-050 |
| `/chinh-sach-cookie` | Gộp vào Bảo mật mục 5 | Chỉ có cookie đăng nhập, không analytics (H12) |
| `/huong-dan-bao-cao-ban-quyen` | Gộp vào Cam kết bản quyền mục 9 | Cùng người đọc |
| `/thong-tin-phap-ly`, `/lien-he-ho-tro` | Gộp thành `/phap-ly/lien-he` | Cùng mục đích |
| `/chinh-sach-luu-tru-va-xoa-tai-khoan` | Gộp vào Bảo mật mục 7–8 | Chưa có chức năng xoá; chỉ có khoá |
| `/quy-che-hoat-dong` | Không tạo | Chỉ khi luật sư xác nhận nghĩa vụ sàn TMĐT (KD-02) |

### 2.8. Phương án gộp/tách khác để Quốc/chủ dự án chọn

- **(A) Đề xuất:** 6 văn bản như bảng §2.
- **(B) Gộp Cam kết bản quyền + Chính sách nội dung** thành một văn bản "Cam kết bản quyền và Chính sách nội dung" (gợi ý ban
  đầu của Quốc). Ưu: ít văn bản hơn. Nhược: Chính sách nội dung áp cho **mọi người** (đánh giá, tin nhắn, bài viết), còn Cam
  kết là của **người bán** và là đích của ô xác nhận khi xuất bản — gộp thì văn bản người bán xác nhận dài gấp đôi, khó đọc.
  Long nghiêng (A).
- **(C) Gộp Quyền sử dụng tài liệu vào Điều khoản** (mở rộng mục 6.2). Ưu: bớt một văn bản. Nhược: mất trang ngắn để link từ
  trang tài liệu/checkout. Long nghiêng giữ riêng.

---

## 3. Trang hub `/phap-ly`

Theo đề xuất UX của Phong (`docs/de-xuat-ux-home-legal-menu-2026-10-23.md` §2.3), bố cục do Phong chốt:

- H1 "Chính sách và pháp lý". Danh sách nhóm theo người đọc, **chỉ hiện văn bản có bản đang hiệu lực**; nhóm rỗng ẩn:
  - Dành cho mọi người dùng: Điều khoản sử dụng · Chính sách bảo mật · Chính sách nội dung
  - Dành cho người mua: Quyền sử dụng tài liệu
  - Dành cho người bán: Chính sách người bán · Cam kết bản quyền
  - Hỗ trợ: Liên hệ và thông tin pháp lý
- Mỗi thẻ: tên (H2/H3 theo bố cục Phong), một câu mô tả (dùng chung với SEO description §5), "Hiệu lực từ dd/mm/yyyy".
- Không có văn bản nào hiệu lực → empty state ngắn, trang `noindex`.
- Câu giới thiệu đầu hub: ❓ không có nơi lưu trong CMS (Q-5) — đề xuất đợt 2 **không** có đoạn giới thiệu, chỉ H1 + danh sách.

---

## 4. Chỗ đặt link

Quy tắc chung: link tới một văn bản **chỉ hiện khi văn bản đó có bản đang hiệu lực** (không bao giờ link tới trang 404);
không thêm nút/ô "Tôi đồng ý" nếu bấm không ghi bản ghi thật (brief §6).

| Vị trí | Link | Hình thức | Ghi chấp thuận? | Ai |
|---|---|---|---|---|
| Footer (CMS menu) | Cột "Pháp lý": Điều khoản, Bảo mật, Chính sách nội dung, Liên hệ; tuỳ chọn "Tất cả chính sách" → `/phap-ly` | Link "trang có sẵn" kiểu văn bản pháp lý (§6 T5), tự ẩn | — | Hiếu (loại link) + admin cấu hình |
| Form đăng ký | "Tôi đồng ý với [Điều khoản sử dụng] và đã đọc [Chính sách bảo mật]." | Thay cụm chữ thường hiện có bằng link Bảo mật | Điều khoản: đã có ✅. Bảo mật: Q-7 | Hiếu + Phong |
| Studio — mở gian hàng | "Khi mở gian hàng, bạn đồng ý với [Chính sách người bán] và [Cam kết bản quyền]." | Dòng chữ, **không** checkbox (chấp thuận khi mở gian hàng bị hoãn — ADR-050) | Không (Q-8) | Phong (+ Hiếu cấp cờ hiệu lực) |
| Studio — ô cam kết khi xuất bản | "[Đọc cam kết bản quyền]" trong dòng gợi ý của ô `rightsConfirmed` | Link mở tab mới | Giữ `rightsConfirmedAt` như ADR-038 (Q-B8 đợt 1) | Phong |
| Trang tài liệu `/{tenant}/{product}` | Gần nút mua: "Bạn nhận quyền sử dụng theo [Quyền sử dụng tài liệu]." | Dòng chữ | — | Phong |
| Hộp thoại báo cáo vi phạm | "[Chính sách nội dung]" + câu xử lý dữ liệu "[Chính sách bảo mật]" | Dòng chữ | — | Phong |
| Checkout | Dưới nút thanh toán: "Khi thanh toán, bạn đồng ý với [Quyền sử dụng tài liệu] và [Điều khoản sử dụng]." | Dòng chữ, không checkbox (Q-B18 đợt 1) | Không | Phong |
| Form liên hệ gian hàng | "Thông tin bạn gửi được xử lý theo [Chính sách bảo mật]." | Dòng chữ | — | Phong |
| Trang `/account/security` | "[Chính sách bảo mật]" (mục cookie/thiết bị) | Tuỳ chọn | — | Phong |
| Billing — form yêu cầu hoàn tiền gói | "[Điều khoản sử dụng] mục 10.4" | Tuỳ chọn | — | Phong |

---

## 5. SEO — title / description

Title theo mẫu đang có ở `generateMetadata` (`"{tiêu đề} | {brand}"`). Description ≤ 160 ký tự, `{brand}` thay ở server.

| Trang | Title | Description |
|---|---|---|
| Hub `/phap-ly` | Chính sách và pháp lý \| {brand} | Các văn bản chính sách của {brand}: điều khoản sử dụng, bảo mật, nội dung, bản quyền, quyền sử dụng tài liệu và người bán. |
| Điều khoản sử dụng (đã có, thiếu description — H4) | Điều khoản sử dụng \| {brand} | Điều khoản sử dụng {brand}: tài khoản, quyền và nghĩa vụ của người mua, người bán, giao dịch, hoàn tiền và xử lý vi phạm. |
| Chính sách bảo mật | Chính sách bảo mật \| {brand} | Dữ liệu cá nhân {brand} thu thập, mục đích sử dụng, ai được xem, thời gian lưu trữ, cookie đăng nhập và quyền của bạn. |
| Chính sách nội dung | Chính sách nội dung \| {brand} | Nội dung được và không được đăng, bán, chia sẻ trên {brand}; cách báo cáo vi phạm và cách chúng tôi xem xét, xử lý. |
| Cam kết bản quyền | Cam kết bản quyền và nguồn gốc tài liệu \| {brand} | Cam kết của người bán về quyền tác giả, nguồn gốc tài liệu khi xuất bản trên {brand} và hướng dẫn khiếu nại bản quyền. |
| Quyền sử dụng tài liệu | Quyền sử dụng tài liệu \| {brand} | Người mua được và không được làm gì với tài liệu đã mua hoặc được nhận trên {brand}; cách tải và khi quyền sử dụng chấm dứt. |
| Chính sách người bán | Chính sách người bán \| {brand} | Quy định mở và vận hành gian hàng trên {brand}: gói dịch vụ, nhận tiền, đăng và giao tài liệu, hoàn tiền, dữ liệu người mua. |
| Liên hệ | Liên hệ và thông tin pháp lý \| {brand} | Thông tin đơn vị vận hành {brand} và kênh liên hệ về hỗ trợ, báo cáo vi phạm, bản quyền và dữ liệu cá nhân. |

Nơi lưu description: xem §6 T1 (đề xuất trong khai báo code, không migration) và Q-4 (phương án cột CMS).
Sitemap/robots/JSON-LD vẫn thuộc phần SEO hoãn của ADR-050 — không làm ở đợt này trừ khi chủ dự án gộp vào.

---

## 6. Phần kỹ thuật cần Hiếu làm (mô tả, không code)

### 6.1. Danh sách việc

| # | Việc | File/vùng | Migration? |
|---|---|---|---|
| T1 | Thêm 6 khoá vào `LEGAL_DOCUMENT_DEFS` (§2: `privacy`, `content_policy`, `copyright`, `usage_license`, `seller`, `contact` — tên khoá Quốc chốt) kèm `group` (nhóm hub), thứ tự hiển thị và `description` (§5). Không seed: dòng `legal_documents` tự tạo khi admin tạo bản nháp đầu tiên (`ensureLegalDocument`, H2) | `packages/core/src/legal/legal-document.ts` | **Không** |
| T2 | Editor `/admin/cms/phap-ly`: bỏ gán cứng `terms` (H3) → trang danh sách văn bản (trạng thái: chưa có bản nháp / nháp / đang hiệu lực / có bản hẹn hiệu lực) + editor theo khoá (vd `/admin/cms/phap-ly/[key]`). `revalidate()` thêm hub `/phap-ly` và các trang có footer (layout gốc) khi xuất bản/lưu trữ. Action đã nhận `key` sẵn | `apps/web/app/admin/cms/phap-ly/**` | Không |
| T3 | Trang hub `app/phap-ly/page.tsx` (§3): đọc bản hiệu lực của mọi khoá bằng **một** truy vấn, nhóm theo `group`, empty state + `noindex` khi rỗng, metadata §5 | `apps/web/app/phap-ly/page.tsx`, `apps/web/lib/legal.ts` | Không |
| T4 | `/phap-ly/[slug]`: thêm `description` vào metadata; breadcrumb thêm cấp "Chính sách và pháp lý" → `/phap-ly` (chỉ khi hub có ít nhất một văn bản) | `apps/web/app/phap-ly/[slug]/page.tsx` | Không |
| T5 | Menu CMS: thêm "Trang có sẵn" cho văn bản pháp lý (vd đích `legal:<key>` → `legalDocumentPath(key)`, thêm `legal` hub) + nhãn trong editor; khi render, **tự bỏ** link tới văn bản chưa có bản hiệu lực (cần danh sách khoá đang hiệu lực, `cache()` theo request). Parse phòng thủ: khoá không còn khai báo → bỏ link | `packages/core/src/admin/site-menu.ts`, loader menu, `/admin/cms/menu` | Không (JSON trong `cms_pages`) |
| T6 | Helper "văn bản nào đang hiệu lực" dùng chung cho T3, T5 và các link ở §4 (đăng ký, Studio, trang tài liệu, checkout…) | `apps/web/lib/legal.ts` | Không |
| T7 | Link nội bộ trong nội dung văn bản: hiện sanitizer ép `target="_blank"` + `nofollow` cho mọi link (H8). Đề xuất: với nội dung pháp lý, link nội bộ (bắt đầu `/`) giữ cùng tab, không `nofollow` — Quốc quyết có làm không (ảnh hưởng hàm dùng chung, cần tham số riêng) | `packages/core/src/content/sanitize-html.ts` hoặc `sanitizeLegalHtml` | Không |
| T8 | Đăng ký: link Chính sách bảo mật (khi có bản hiệu lực); có ghi chấp thuận `privacy` hay không theo Q-7 (bảng `user_legal_acceptances` đã hỗ trợ nhiều văn bản — unique `(userId, versionId)`) | `register-form.tsx`, `api/auth/register/route.ts` | Không |
| T9 | (Chỉ khi chủ dự án chốt DL-09) Bước cron dọn/xoá IP của `download_events` quá hạn | `apps/web/app/api/cron/daily/route.ts` | Không (chỉ `UPDATE/DELETE` dữ liệu) — nhưng là thao tác trên DB dùng chung, cần Quốc duyệt |

Lớp trình bày (hub, thẻ, dòng chữ link ở §4, breadcrumb) do Phong làm theo brief riêng; Hiếu cấp dữ liệu (T3, T6).

### 6.2. Migration

**Không cần migration** cho T1–T8: bảng `legal_documents`/`legal_document_versions`/`user_legal_acceptances` đã hỗ trợ nhiều
văn bản (khoá `key`/`slug` unique, phiên bản theo `documentId`, chấp thuận theo `versionId`) ✅; menu lưu JSON.

Chỉ cần migration (expand-only, Quốc duyệt, chủ dự án chạy — ADR-034) nếu chủ dự án chọn:

- Q-4 phương án (b): cột `legal_documents.description` (và/hoặc `seoTitle`/`seoDescription`) sửa trong CMS.
- Q-6 phương án (b): cột thông tin pháp nhân trong `system_settings` để trang Liên hệ đọc từ cấu hình.
- BQ-09 bắt buộc khai báo AI: trường mới trên sản phẩm (L2, RLS).

### 6.3. Rủi ro kỹ thuật

- **Dẫn chiếu chéo:** các văn bản dẫn tới nhau bằng `/phap-ly/<slug>`. Xuất bản lẻ một văn bản khi văn bản nó dẫn tới chưa có
  bản hiệu lực → link 404 trong nội dung (cổng chặn chỉ kiểm placeholder, không kiểm link). Xem §7.
- **Tiêu đề văn bản:** lấy từ code lúc tạo dòng (H2); sửa tiêu đề trong code sau khi đã có dòng DB thì trang vẫn hiện tiêu đề
  cũ — cần chốt tên ngay trong T1.
- **Bảng trong nội dung:** sanitizer không cho `table` (H8) — các dự thảo đã viết bằng danh sách, không dùng bảng.

### 6.4. Test

Đề xuất **không** thêm test case (trần hiện 99/63, `test:count` 99/99, 63/63 ngày 2026-10-24). Nếu Quốc muốn test cho loại link
`legal:` trong menu (T5) thì sửa test `site-menu.test.ts` sẵn có thay vì thêm case; thêm case phải hỏi chủ dự án.

---

## 7. Thứ tự xuất bản đề xuất

1. Chủ dự án/luật sư trả lời các mã trong checklist (ưu tiên PL-01, PL-06, PL-07, KD-01, KD-10, DL-01…DL-04, BQ-01, BQ-02).
2. Hiếu làm T1–T6 (+T7, T8 theo quyết định); Phong làm UI; Long cập nhật KB (`Legal-Documents-Specs`, `Legal-Terms-Publishing-Runbook`,
   `Endpoint-Directory`, MOC) sau khi code xong.
3. Admin nhập nội dung từng văn bản (chép phần nội dung của dự thảo đã điền), đánh dấu "Đã rà soát pháp lý" sau khi luật sư
   duyệt.
4. Xuất bản **đồng loạt** (hoặc theo thứ tự "văn bản không dẫn ai trước"): Liên hệ → Bảo mật → Chính sách nội dung → Cam kết
   bản quyền → Quyền sử dụng tài liệu → Chính sách người bán → Điều khoản (bản mới, §8). Đặt cùng `effectiveAt` nếu muốn
   hiệu lực cùng lúc (hệ thống cho hẹn hiệu lực tương lai — bổ sung ADR-050 (b)).
5. Admin thêm cột "Pháp lý" vào footer qua `/admin/cms/menu`.

---

## 8. Điều khoản sử dụng cần sửa cho khớp (ghi ra, **chưa sửa**)

| Mục Điều khoản | Hiện tại | Đề xuất khi làm phiên bản mới |
|---|---|---|
| 3 | Ghi chú nội bộ ghi "ghi nhận phiên bản" là 🟡 chưa có code | Nay ✅ có code (`recordLegalAcceptance`) — chỉ sửa ghi chú nội bộ |
| 4.3 | "đăng xuất khỏi các thiết bị khác" | Theo ADR-053: "xem danh sách thiết bị, đăng xuất từng thiết bị hoặc mọi thiết bị"; có thể nhắc "Ghi nhớ đăng nhập" và dẫn Bảo mật mục 5 |
| 4.4 | Chỉ placeholder ND-07 | Thêm câu thật: tài khoản có thể bị **khoá** (giữ dữ liệu), hiện chưa có chức năng tự xoá — dẫn Bảo mật mục 8 (giữ ND-07) |
| 6.2 | Phạm vi sử dụng = KD-10 | Dẫn tới Quyền sử dụng tài liệu (`/phap-ly/quyen-su-dung-tai-lieu`) thay vì để phạm vi trong Điều khoản; KD-10 chỉ còn ở một văn bản |
| 8.3 | Nội dung cam kết = BQ-01 | Dẫn tới Cam kết bản quyền (`/phap-ly/cam-ket-ban-quyen`); bỏ placeholder BQ-01 khỏi Điều khoản |
| 9 | Danh mục cấm/hạn chế = BQ-02 | Dẫn tới Chính sách nội dung; bỏ BQ-02 khỏi Điều khoản |
| 11 | Mô tả báo cáo + BQ-08/BQ-04/BQ-03 | Rút gọn, dẫn tới Chính sách nội dung mục 7–8 (một nơi duy nhất mô tả quy trình); giữ câu "cơ quan nhà nước" nếu muốn |
| 13 | Dẫn chiếu Bảo mật = VH-07 | Thay bằng link `/phap-ly/chinh-sach-bao-mat`; đoạn cookie + DL-05 chuyển hẳn sang Bảo mật mục 5 |
| 16, 17 | Thông tin liên hệ PL-01…PL-07 lặp lại | Dẫn tới `/phap-ly/lien-he`; bỏ danh sách lặp (thông tin pháp nhân chỉ ở một văn bản) |
| 7.4, 10.2 | — | Có thể dẫn Chính sách người bán (mục 7) cho nghĩa vụ hoàn tiền của người bán |

Kết quả: Điều khoản bớt khoảng 14/32 placeholder (chuyển sang văn bản chuyên đề), nội dung không lặp. Long soạn khi Quốc giao.

---

## 9. Chỗ lệch giữa tài liệu và code phát hiện khi soạn

| # | Lệch | Mức | Đề xuất |
|---|---|---|---|
| M1 | (Đã khớp) `CLAUDE.md` lúc Long bắt đầu soạn ghi trần 95/57; trong phiên đã được cập nhật thành 99/63, khớp `pnpm test:count` 99/99, 63/63 | ✅ | Không cần làm gì |
| M2 | Đề xuất UX §2.5 và kế hoạch đợt 1 giả định footer có link pháp lý "tự ẩn khi chưa phát hành"; code menu **không** có loại link pháp lý, không tự ẩn (H7) | ✅ | T5 |
| M3 | Đề xuất UX §2.2 có khối "Văn bản liên quan" chọn trong CMS; code chưa có. Các dự thảo đợt 2 đặt "Văn bản liên quan" **trong nội dung** | ✅ | Nếu sau này có khối CMS riêng thì bỏ mục cuối của mỗi dự thảo để không trùng |
| M4 | Kế hoạch đợt 1 §3.5 ghi upload bằng chứng cần "bucket private + quét file (M5)" — thực tế M5 chỉ kiểm định dạng, chưa quét virus (H13). Dự thảo không dùng chữ "quét" | ✅ | Giữ; ghi KB-Audit khi Long được giao cập nhật KB |
| M5 | Lượt tải `download_events.ip` không có thời hạn lưu (H14), trong khi audit/IP báo cáo đã có 12 tháng | ✅ | DL-09 + T9 |
| M6 | `UserProfile.occupation` có trong schema nhưng không thấy UI dùng | ✅ (grep) | Không nêu trong Bảo mật; Quốc xác nhận cột có còn ghi ở đâu không |

---

## 10. Câu hỏi cho chủ dự án (đánh số)

1. **Q-1** Đồng ý danh sách 6 văn bản đợt 2 (§2, phương án A)? Hay gộp Cam kết bản quyền + Chính sách nội dung (B), hoặc gộp
   Quyền sử dụng tài liệu vào Điều khoản (C)?
2. **Q-2** Tên khoá và đường dẫn (§2) có giữ nguyên không? Đặc biệt `/phap-ly/lien-he` (thay cho `/lien-he` cấp gốc của kế
   hoạch đợt 1 — không cần dành riêng thêm từ).
3. **Q-3** Đồng ý **không** tách Chính sách hoàn tiền ở đợt này (giữ trong Điều khoản mục 10) không?
4. **Q-4** Mô tả ngắn của văn bản (dùng cho hub + SEO description): (a) đặt trong code cùng tên văn bản, không migration
   (đề xuất); hay (b) thêm cột để sửa trong CMS (đúng nguyên tắc "CMS trước" hơn, cần migration)?
5. **Q-5** Hub `/phap-ly` có cần đoạn giới thiệu không? Nếu có, lưu ở đâu (cần nơi lưu CMS mới)?
6. **Q-6** Trang Liên hệ: (a) nhập tay như văn bản pháp lý (đề xuất đợt 2, không migration); hay (b) đọc tên pháp nhân,
   địa chỉ, MST, email từ System Settings (cần migration)?
7. **Q-7** Khi đăng ký, có ghi nhận chấp thuận/đã đọc **Chính sách bảo mật** theo phiên bản (như Điều khoản) không? Luật sư
   có yêu cầu đồng ý riêng cho xử lý dữ liệu cá nhân không?
8. **Q-8** Mở gian hàng: chỉ dòng chữ link Chính sách người bán + Cam kết bản quyền (đề xuất), hay làm luôn checkbox có ghi
   chấp thuận (ADR-050 đang hoãn)?
9. **Q-9** Quyết định "không xoá user, chỉ khoá" có giữ khi người dùng **yêu cầu xoá dữ liệu** theo quyền chủ thể dữ liệu
   không? Cần luật sư (ND-07).
10. **Q-10** Thứ tự xuất bản: đồng loạt toàn bộ bộ văn bản (đề xuất), hay xuất bản dần (khi đó phải sửa câu dẫn chiếu tới
    văn bản chưa có)?
11. **Q-11** Giữ câu cam kết "nếu sau này dùng công cụ phân tích/quảng cáo, chúng tôi cập nhật Chính sách bảo mật trước khi
    áp dụng" (Bảo mật mục 5.3)?
12. **Q-12** Có muốn cam kết công khai "không bán dữ liệu cá nhân" không (hiện **không** viết vì chưa có xác nhận)?
13. **Q-13** Chính sách người bán có nêu tên cổng thanh toán (MoMo, SePay) không, hay chỉ "cổng thanh toán được tích hợp"
    (đề xuất, đỡ sửa khi đổi cổng)?
14. **Q-14** Người bán có được tự ghi phạm vi sử dụng riêng cho từng tài liệu (trong mô tả) và phạm vi đó được áp dụng
    không (Quyền sử dụng tài liệu mục 2)? Hệ thống không có trường riêng.
15. **Q-15** Người bán có bị cấm dùng email người mua để gửi quảng cáo khi chưa có đồng ý không (Chính sách người bán mục 8 —
    quy tắc mới, cần duyệt)?
16. **Q-16** Có bắt buộc khai báo tài liệu tạo bằng AI không (BQ-09)?
17. **Q-17** Thời hạn lưu nhật ký tải tài liệu có IP (DL-09) — và có muốn thêm bước tự dọn như audit log không?
18. **Q-18** Đồng ý footer mặc định (khi admin chưa cấu hình menu) **thêm** cột "Pháp lý" tự ẩn theo văn bản đang hiệu lực
    không? (ADR-050 hiện quy định mặc định = menu cũ bỏ mục không có link.)
19. **Q-19** Link nội bộ trong văn bản pháp lý có giữ cùng tab (T7) không, hay chấp nhận mở tab mới như hiện tại?

Các câu hỏi chi tiết từng điều khoản: mã trong `docs/legal/LEGAL_REVIEW_CHECKLIST.md`.

---

_Liên quan: `docs/PLAN.md` (mục "Trang pháp lý đợt 2 — chờ chủ dự án chốt"), `docs/legal/LEGAL_REVIEW_CHECKLIST.md`,
`docs/legal/drafts/`._

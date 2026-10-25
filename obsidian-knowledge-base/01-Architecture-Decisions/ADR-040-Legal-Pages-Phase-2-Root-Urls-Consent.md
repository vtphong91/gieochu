---
tags:
  - adr
  - legal
  - seo
  - cms
  - auth
  - tenant
  - security
  - status/accepted
date: 2026-10-24
decider: vtphong91
status: Accepted (Chốt — Áp dụng chính thức)
---

# 🏛️ ADR-040: Trang pháp lý đợt 2 — 6 văn bản mới, URL cấp gốc thân thiện, ghi nhận đồng ý mở rộng

> [!note] Đổi số (2 lần)
> - **2026-10-24:** quyết định ban đầu đánh số ADR-052 trong `docs/DECISIONS.md`; khi gộp commit `c63b72b` của vuong đổi thành ADR-053
>   (bản trích tạo mới với tên `ADR-039-…`). Xem [[00-Index/KB-Audit-2026-09-26|KB-Audit]] §34.
> - **2026-10-25:** khi gộp commit `8fb05ca` của vuong (ADR-052 gốc thuộc về giám sát bucket — bản trích
>   [[01-Architecture-Decisions/ADR-038-Realtime-Storage-Monitoring-And-Reconciliation|ADR-038 KB]]), quyết định đổi thành **ADR-054**, bản trích KB
>   thành **ADR-040**. Xem [[00-Index/KB-Audit-2026-09-26|KB-Audit]] §36.
> - Thư mục migration đã chạy giữ tên cũ `…_adr053_legal_document_meta` (thuộc ADR-054).

## 1. Trạng Thái (Status)
**ĐÃ PHÊ DUYỆT (Accepted)** — tương ứng **ADR-054** trong [`docs/DECISIONS.md`](../../docs/DECISIONS.md) (chủ dự án chốt 2026-10-24; đánh số ADR-052 rồi
ADR-053 trước hai lần đổi số — [[00-Index/KB-Audit-2026-09-26|KB-Audit]] §34, §36). Bản trích ghi theo duyệt của Quốc (brief 2026-10-24).
**Sửa đổi** [[01-Architecture-Decisions/ADR-035-Menu-Home-Seo-Versioned-Terms|ADR-035 KB (≙ ADR-050)]] mục 3: URL `/phap-ly/dieu-khoan-su-dung` → `/dieu-khoan-su-dung`.

Tiến độ (2026-10-24): code xong ở working tree, **chưa commit** ✅ `git status`. Migration `20261024150000_adr053_legal_document_meta` **đã chạy trên DB dùng chung** 🟡
(chủ dự án xác nhận 2026-10-24, brief Quốc 2026-10-25; Long không chạy lệnh DB). Thêm **1 `route.ts`** ngoài `/api` (redirect `/phap-ly/[slug]`) → 23 dưới `/api`, **25** toàn app ✅ đếm. `schema.prisma`
**52 model / 35 enum** ✅ đếm (ADR-054 chỉ thêm cột). `pnpm test:count` = **100/100 unit, 66/66 integration** ✅ (Long chạy, chỉ đếm).

Mức xác minh: ✅ Long đã đối chiếu code working tree · 🟡 theo `docs/DECISIONS.md`/brief của Quốc · ❓ cần môi trường thật.

---

## 2. Bối Cảnh (Context) 🟡
Hạ tầng văn bản có phiên bản đã có từ ADR-050 (chỉ `terms`). Kế hoạch `docs/ke-hoach-trang-phap-ly-dot-2-2026-10-24.md` + dự thảo `docs/legal/drafts/`
(Long soạn, **chưa qua luật sư**) đề xuất các văn bản còn thiếu, chỗ đặt link và ghi nhận đồng ý.

---

## 3. Quyết Định (Decision) — theo `docs/DECISIONS.md`, đối chiếu code

1. **URL cấp gốc**, bỏ tiền tố `/phap-ly/` (chủ dự án: khó nghe) — `/dieu-khoan-su-dung`, `/chinh-sach-bao-mat`, `/chinh-sach-noi-dung`,
   `/cam-ket-ban-quyen`, `/quyen-su-dung-tai-lieu`, `/chinh-sach-nguoi-ban`, `/lien-he`. Các slug (và `phap-ly`) vào `RESERVED_SLUGS` tenant ✅ (đọc từ
   `LEGAL_DOCUMENT_ROOT_SLUGS`) + quét DB không trùng (✅ Hiếu quét DB (chỉ đọc), báo qua Quốc 2026-10-24: DB có 1 tenant, không trùng 7 slug mới và `phap-ly`). `/phap-ly/{slug}` → **308** ✅. **Không có hub** ✅.
2. **6 văn bản mới** ngoài `terms`: `privacy`, `content_policy`, `copyright` (tách khỏi chính sách nội dung), `usage_license`, `seller`, `contact` ✅
   `LEGAL_DOCUMENT_DEFS`. Hoàn tiền giữ trong Điều khoản.
3. **Xuất bản từng văn bản** khi đủ placeholder + tích đã rà soát (cổng ADR-050 giữ nguyên) ✅. Chưa có bản hiệu lực → 404 và tự ẩn khỏi menu ✅.
4. **SEO + mô tả ngắn sửa trong CMS** — cột `summary`, `seoTitle`, `seoDescription` trên `legal_documents` (migration expand-only) ✅ SQL; lưu thẳng, audit
   `LEGAL_DOCUMENT_META_UPDATED` ✅.
5. **Ghi nhận đồng ý theo phiên bản:** đăng ký ghi Điều khoản **và** Chính sách bảo mật ✅; mở gian hàng có **checkbox** Chính sách người bán, ghi
   `user_legal_acceptances` trong transaction tạo tenant ✅. Văn bản chưa có bản hiệu lực → bỏ qua ✅.
6. **Footer mặc định thêm cột "Thông tin"** (không đặt tên "Pháp lý") ✅; menu CMS có loại link `legal` tự ẩn khi văn bản chưa hiệu lực ✅.
7. **Link trong văn bản:** nội bộ cùng tab, ngoài mở tab mới `rel="noopener noreferrer"` ✅ — `sanitizeRichTextHtml(…, { trustedLinks })`, **chỉ** áp cho
   văn bản pháp lý.
8. **`download_events` (có IP) lưu 12 tháng** rồi tự xoá trong cron hằng ngày ✅ bước `download_events.purge`.
9. Không ghi cam kết "không bán dữ liệu cá nhân" ở đợt này. Hai vấn đề bắt buộc qua luật sư: "chỉ khoá, không xoá user" so với quyền yêu cầu xoá dữ liệu;
   danh mục nội dung bị cấm 🟡.

---

## 4. Đối chiếu code ✅ (working tree 2026-10-24)

| Hạng mục | Nơi trong code |
| :-- | :-- |
| Khai báo văn bản, slug, mã lỗi | `packages/core/src/legal/legal-document.ts` (`LEGAL_DOCUMENT_DEFS`, `LEGAL_DOCUMENT_ROOT_SLUGS`, `legalDocumentPath`, `LEGAL_SUMMARY_MAX`, `LEGAL_ERROR_CODES.DOCUMENT_CHANGED/ACCEPTANCE_REQUIRED`) |
| Slug dành riêng | `packages/core/src/tenant/slug.ts` (`...LEGAL_DOCUMENT_ROOT_SLUGS`) |
| Trang + redirect | `apps/web/app/{7 slug}/page.tsx`, `app/_ui/legal-document-page.tsx`, `app/_ui/legal-toc.ts`, `app/phap-ly/[slug]/route.ts` |
| Lib | `apps/web/lib/legal.ts` (meta, `listLegalDocumentStatuses`, `getEffectiveLegalKeys`, `resolve*`, `recordLegalAcceptances`) |
| Editor | `app/admin/cms/phap-ly/{page.tsx,actions.ts,legal-meta-form.tsx,legal-editor.tsx}` |
| Sanitizer | `packages/core/src/content/sanitize-html.ts` (`trustedLinks`, `classifyRichTextLink`) |
| Đồng ý | `app/api/auth/register/route.ts`, `app/(auth)/register/{page,register-form}.tsx`, `app/studio/{page.tsx,actions.ts,onboarding-form.tsx}`, `lib/create-tenant.ts` |
| Menu | `packages/core/src/admin/site-menu.ts` (kind `legal`, cột `col-info`), `apps/web/lib/site-menu.ts` |
| Cron | `app/api/cron/daily/route.ts` → `purgeExpiredDownloadEvents()` (`lib/download.ts`) |
| Audit | `packages/core/src/audit/audit.ts` (`LEGAL_DOCUMENT_META_UPDATED`) |
| Migration | `packages/db/prisma/migrations/20261024150000_adr053_legal_document_meta/migration.sql` |
| Test | `apps/web/tests/integration/legal.test.ts` (+1 — đăng ký ghi Điều khoản + Bảo mật; mở gian hàng bắt buộc + ghi Chính sách người bán) |

Chi tiết nghiệp vụ: [[02-System-Specs/Legal-Documents-Specs|Legal-Documents-Specs]].

---

## 5. Hệ Quả (Consequences)
- Code ADR-054 cần migration chạy **trước** khi lên môi trường dùng DB đó (trang/editor đọc 3 cột mới; tạo nháp khoá có `_` cần CHECK đã nới) — trên DB dùng chung
  migration đã chạy 🟡 (chủ dự án xác nhận 2026-10-24); DB khác (khôi phục, môi trường mới) vẫn phải chạy trước code ❓.
- Link cũ `/phap-ly/…` (nếu đã chia sẻ) vẫn dùng được nhờ 308; dự thảo `docs/legal/drafts/*.md` đã đổi link nội bộ sang URL cấp gốc (2026-10-24).
- Menu đã xuất bản trên DB không tự có cột "Thông tin" — chỉ menu mặc định (chưa xuất bản lần nào) có; admin thêm link loại `legal` trong CMS ❓.
- Kế hoạch H8 (sanitizer ép `target/rel/nofollow` cho mọi link) không còn đúng với code: nội dung **tenant** hiện không có `target`/`rel`/`nofollow` —
  lệch mở ở KB-Audit §35.
- Dự thảo chưa qua luật sư; chưa văn bản nào được xuất bản ❓.

---

## 6. Liên Kết
* [[01-Architecture-Decisions/ADR-035-Menu-Home-Seo-Versioned-Terms|ADR-035 KB (≙ ADR-050)]] — hạ tầng văn bản có phiên bản, menu CMS · [[01-Architecture-Decisions/ADR-022-Background-Jobs-After-And-Daily-Cron|ADR-022 KB (≙ ADR-036)]] — cron hằng ngày
* [[02-System-Specs/Legal-Documents-Specs|Legal-Documents-Specs]] ([Legal-Documents-Specs.md](../02-System-Specs/Legal-Documents-Specs.md)) · [[02-System-Specs/System-Cms-Menu-Home-Seo-Specs|System-Cms-Menu-Home-Seo-Specs]]
* [[03-API-Contracts/Endpoint-Directory|Endpoint-Directory]] §3.1, §5.2, §17, §26.2, §26.4–§26.5 · [[03-API-Contracts/Database-Schema-Reference|Database-Schema-Reference]] §3.1, §7
* [[04-Operations-Runbooks/Legal-Terms-Publishing-Runbook|Legal-Terms-Publishing-Runbook]] · [[04-Operations-Runbooks/Deploy-Vercel-Runbook|Deploy-Vercel-Runbook]] §9.14

*Quay lại: [[MOC-Home]] (../00-Index/MOC-Home.md)*

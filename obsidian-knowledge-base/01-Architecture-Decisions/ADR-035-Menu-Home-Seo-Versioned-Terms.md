---
tags:
  - adr
  - cms
  - legal
  - seo
  - system-admin
  - security
  - status/accepted
date: 2026-10-23
decider: vtphong91
status: Accepted (Chốt — Áp dụng chính thức)
---

# 🏛️ ADR-035: Đợt 1 — CMS menu header/footer, trang chủ theo brief + SEO trang chủ, Điều khoản sử dụng có phiên bản

## 1. Trạng Thái (Status)
**ĐÃ PHÊ DUYỆT (Accepted)** — tương ứng **ADR-050** trong [`docs/DECISIONS.md`](../../docs/DECISIONS.md) (chủ dự án chốt 2026-10-23), gồm "Bổ sung ADR-050 lần 2" và mục
"Bổ sung ADR-050" (Quốc chốt kỹ thuật mục 3 trước migrate). Bản trích ghi vào thư mục này theo duyệt của Quốc (brief 2026-10-23).
**Sửa đổi** [[01-Architecture-Decisions/ADR-011-Tenant-Owns-Storefront-Content-Only|ADR-011 KB (≙ ADR-025)]]: header/footer không còn là chrome cố định.

Tiến độ (2026-10-23): phần **CMS/logic** và **UI** (Phong) của cả 3 hạng mục xong ở working tree, **chưa commit** ✅ `git status`; UI theo báo cáo Phong 🟡, Long đối chiếu phần lớn trong code — [[04-Operations-Runbooks/UI-Design-System|UI-Design-System]] §1.1.1, §12.9, §13.7, §22.
Migration `20261023090000_adr050_legal_documents` **đã chạy trên DB dùng chung** 🟡 (brief Quốc; Long không chạy lệnh DB). Không thêm `route.ts`
(23 dưới `/api`, 24 toàn app ✅ đếm). `pnpm test:count` = **95/95 unit, 57/57 integration** ✅ (Long chạy, chỉ đếm) — chạm trần mới.

Mức xác minh: ✅ Long đã đối chiếu code working tree · 🟡 theo `docs/DECISIONS.md`/báo cáo của Quốc · ❓ cần môi trường thật.

---

## 2. Bối Cảnh (Context)
Kế hoạch `docs/ke-hoach-home-legal-menu-seo-2026-10-23.md` (Long) + đề xuất UX `docs/de-xuat-ux-home-legal-menu-2026-10-23.md` (Phong) đề xuất 4
hạng mục A–D (trang chủ, pháp lý, menu, SEO). Chủ dự án chỉ duyệt **đợt 1** gồm 3 hạng mục, theo thứ tự, mỗi hạng mục **CMS trước, UI sau**
([[06-AI-Agent-Guides/Team-Charter#2.1. Nguyên tắc lập kế hoạch tính năng|Team-Charter §2.1]]).

---

## 3. Quyết Định (Decision)

1. **CMS menu header/footer** (`/admin/cms/menu`), không migration — `CmsPage` slug hệ thống `menu` (mẫu
   [[01-Architecture-Decisions/ADR-021-Shop-Marketplace-Cms-First|ADR-021 KB (≙ ADR-035)]], nháp/xuất bản/khôi phục). Header ≤ 5 mục, menu con
   **1 cấp** (mặc định không dùng); footer 1–4 cột; mỗi link thuộc 4 loại (trang có sẵn / nội bộ / ngoài / email), tab mới, ẩn/hiện, thứ tự; nhãn +
   đích nút CTA header. Chưa xuất bản → menu mặc định = menu trước ADR-050 **bỏ các mục không có link**. Desktop + mobile đọc cùng dữ liệu. Bố cục
   vẫn cố định trong code; năm bản quyền lấy theo năm hiện tại. Chi tiết: [[02-System-Specs/System-Cms-Menu-Home-Seo-Specs|System-Cms-Menu-Home-Seo-Specs]] §2.
2. **Trang chủ theo `docs/GIEOCHU_HOMEPAGE_CONTENT_BRIEF.md`**, không migration — thêm section `steps`, `faq`, `community` (thay `testimonials`),
   CTA phụ, `minToShow` (mặc định 3) cho gian hàng/tài liệu nổi bật; nội dung mặc định soạn từ brief (token `{brand}`, không số liệu) khi chưa có bản
   PUBLISHED; bỏ số liệu/giá/sao gõ cứng; lời chứng thực cũ **tự ẩn** tới khi admin tích "đã có đồng ý"; chữ "miễn phí" chỉ giữ khi thực sự có gói
   miễn phí. Editor cảnh báo mềm theo brief §8, **chặn xuất bản** khi lời chứng thực chưa có đồng ý hoặc link không an toàn. **SEO trang chủ:** ô
   title/description (cột có sẵn `CmsPage.seoTitle/seoDescription`) + `generateMetadata`; một bộ giới hạn SEO dùng chung ở `@gieochu/core` (tối đa
   120/320, cảnh báo mềm 60/160). Chưa làm OG/noindex/sitemap/robots/JSON-LD. Chi tiết: spec trên §3–§4.
3. **Điều khoản sử dụng có phiên bản + ghi nhận chấp thuận**, migration expand-only (Hiếu viết, Quốc duyệt, chủ dự án chạy): 3 bảng L1
   `legal_documents`, `legal_document_versions`, `user_legal_acceptances` (**không lưu IP/User-Agent**). Đợt này chỉ văn bản `terms` tại
   `/phap-ly/dieu-khoan-su-dung`. Xuất bản bị chặn khi nội dung còn `[[CẦN XÁC NHẬN`. Đăng ký: checkbox link tới bản đang hiệu lực, lưu chấp thuận
   theo phiên bản; chưa có bản PUBLISHED → đăng ký như cũ. Người dùng cũ **chưa** bị buộc chấp thuận lại. Chi tiết:
   [[02-System-Specs/Legal-Documents-Specs|Legal-Documents-Specs]].

**Bổ sung ADR-050 (Quốc, 2026-10-23 — chốt kỹ thuật mục 3 trước migrate):**
- (a) **Không xoá user** (chủ dự án chốt 2026-10-23): người dùng vi phạm/ngừng dùng chỉ bị **khoá** (deactivate — chặn thao tác, giữ nguyên dữ liệu)
  để tránh xoá nhầm. FK `user_legal_acceptances → users` để `Cascade` **chỉ** phục vụ dọn dữ liệu test; không có luồng nghiệp vụ xoá user.
- (b) Cho phép nhiều bản PUBLISHED; bản hiệu lực = PUBLISHED có `effectiveAt ≤ now` mới nhất (hỗ trợ hiệu lực tương lai); lưu trữ bản cũ là thao tác riêng.
- (c) Xuất bản yêu cầu **cả** `reviewStatus = APPROVED` (admin tích "đã rà soát pháp lý") **và** không còn `[[CẦN XÁC NHẬN`.
- Gói FREE thật đang bật (ADR-021) → CTA mặc định giữ "miễn phí". `phap-ly` thêm vào `RESERVED_SLUGS` (slug tenant), đã quét DB không trùng 🟡.

**Bổ sung ADR-050 lần 2 (Quốc, 2026-10-23 — sau review UI):**
- `/phap-ly/[slug]` dùng `container-page` + lưới `220px (mục lục) | minmax(0,768px)` — hợp ADR-024 (khung trang vẫn là utility chuẩn, chỉ cột nội dung
  giới hạn độ rộng đọc); **không** thêm `container-doc`.
- Lưu trữ bản đang hiệu lực → bản PUBLISHED trước đó (nếu còn) tự hiệu lực lại.
- Ô SEO trang chủ **lưu thẳng, không qua nháp** (giống Bảng giá) cho tới khi có quyết định khác.
- Migration ADR-050 đã chạy nên **không sửa** comment trong `migration.sql` (đổi checksum) — quy tắc: chạy migration trước khi deploy code.

**Hoãn sang giai đoạn pháp lý:** các trang pháp lý khác, trang hub, mở rộng `abuse_reports`, chấp thuận khi mở gian hàng/xuất bản, công bố bản dự
thảo, xoá tài khoản, thông tin pháp nhân.

**Test:** chủ dự án duyệt nâng trần **+1 unit, +2 integration** (94/55 → 95/57).

---

## 4. Đối chiếu code ✅ (working tree 2026-10-23)

| Hạng mục | Nơi trong code |
| :-- | :-- |
| Schema menu, menu mặc định, parse phòng thủ, dựng `href` | `packages/core/src/admin/site-menu.ts` (subpath `@gieochu/core/site-menu`) |
| Luật chặn link + cảnh báo mềm brief §8 | `packages/core/src/admin/cms-content-guard.ts` (subpath `@gieochu/core/cms-content-guard`) |
| Bộ giới hạn SEO chung | `packages/core/src/admin/seo.ts` (subpath `@gieochu/core/seo`); `pricing-sections.ts` dùng lại (giá trị cũ 120/320 không đổi) |
| Slug hệ thống | `SYSTEM_CMS_SLUGS = ["home","shop","pricing","menu"]` (`cms-slugs.ts`) |
| Section trang chủ | `packages/core/src/admin/home-sections.ts`; loader `apps/web/lib/home-cms.ts`; `app/page.tsx` (`generateMetadata`) |
| Menu loader / editor | `apps/web/lib/site-menu.ts`; `app/admin/cms/menu/` (`page.tsx`, `actions.ts`, `menu-editor.tsx`) |
| Pháp lý | `packages/core/src/legal/legal-document.ts` (subpath `@gieochu/core/legal`), `packages/core/src/content/brand-token.ts`, `apps/web/lib/legal.ts`, `app/admin/cms/phap-ly/*`, `app/phap-ly/[slug]/page.tsx`, `api/auth/register/route.ts` |
| Migration | `packages/db/prisma/migrations/20261023090000_adr050_legal_documents/migration.sql` |
| Audit | 7 action mới trong `AUDIT_ACTIONS` (`packages/core/src/audit/audit.ts`) |
| Test | `packages/core/src/admin/site-menu.test.ts` (1 unit), `apps/web/tests/integration/legal.test.ts` (2 integration); trần `scripts/count-tests.mjs` 95/57 |

---

## 5. Hệ Quả (Consequences)
- Header/footer mọi trang công khai đọc `getSiteMenu()` (`cache()` theo request, một lần đọc DB cho cả header + footer) ✅ `site-header.tsx`,
  `site-footer.tsx` import; "Đăng nhập" và menu tài khoản vẫn do hệ thống tự hiện theo trạng thái đăng nhập, không cấu hình ✅ (Notice editor).
- Trang chủ không còn "chỉ header + footer" khi chưa có bản PUBLISHED — hiện `defaultHomeSections()` ✅ `lib/home-cms.ts`.
- Lời chứng thực đang có trong bản live cũ (nếu có) bị ẩn ngay khi code lên — rơi về lời mời mặc định ✅ `parseHomeSections` + `resolveCommunityView`.
- Xuất bản bản Điều khoản đầu tiên làm form đăng ký bắt đầu ghi `user_legal_acceptances` — xem
  [[04-Operations-Runbooks/Legal-Terms-Publishing-Runbook|Legal-Terms-Publishing-Runbook]].
- Chính sách "không xoá user, chỉ khoá" ràng buộc mọi tính năng sau (giai đoạn pháp lý có hạng mục "xoá tài khoản" — phải ra ADR riêng) — xem
  [[02-System-Specs/User-Management-System-Center-Specs|User-Management-System-Center-Specs]] §3.
- Trần test chạm 95/57 — test mới cần chủ dự án duyệt nâng trần.

---

## 6. Liên Kết
* [[01-Architecture-Decisions/ADR-011-Tenant-Owns-Storefront-Content-Only|ADR-011 KB (≙ ADR-025)]] — phần bị sửa · [[01-Architecture-Decisions/ADR-019-Home-Page-Real-Data-Sold-Count|ADR-019 KB (≙ ADR-033)]] — CMS trang chủ gốc · [[01-Architecture-Decisions/ADR-021-Shop-Marketplace-Cms-First|ADR-021 KB (≙ ADR-035)]] — mẫu slug hệ thống · [[01-Architecture-Decisions/ADR-007-Hybrid-Monetization-Free-Forever|ADR-007 KB (≙ ADR-021)]] — gói FREE
* [[02-System-Specs/System-Cms-Menu-Home-Seo-Specs|System-Cms-Menu-Home-Seo-Specs]] ([System-Cms-Menu-Home-Seo-Specs.md](../02-System-Specs/System-Cms-Menu-Home-Seo-Specs.md)) · [[02-System-Specs/Legal-Documents-Specs|Legal-Documents-Specs]] ([Legal-Documents-Specs.md](../02-System-Specs/Legal-Documents-Specs.md))
* [[03-API-Contracts/Endpoint-Directory|Endpoint-Directory]] §3, §26 · [[03-API-Contracts/Database-Schema-Reference|Database-Schema-Reference]] §3.1, §7
* [[04-Operations-Runbooks/Legal-Terms-Publishing-Runbook|Legal-Terms-Publishing-Runbook]] ([Legal-Terms-Publishing-Runbook.md](../04-Operations-Runbooks/Legal-Terms-Publishing-Runbook.md))

*Quay lại: [[MOC-Home]] (../00-Index/MOC-Home.md)*

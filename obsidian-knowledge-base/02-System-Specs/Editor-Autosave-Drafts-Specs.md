---
tags:
  - spec
  - autosave
  - database
  - rls
  - security
  - session
  - status/living
date: 2026-10-24
author: Long
---

# 📐 Đặc Tả: Tự Lưu Nháp Editor Lên Server — Phần Nền (ADR-053 bổ sung lần 3)

> Quyết định gốc: **"Bổ sung ADR-053" (lần 1) và "Bổ sung ADR-053 lần 3"** trong [`docs/DECISIONS.md`](../../docs/DECISIONS.md) (chủ dự án
> chốt/duyệt 2026-10-24); kế hoạch chi tiết `docs/ke-hoach-tu-luu-nhap-2026-10-24.md`. Bản trích KB:
> [[01-Architecture-Decisions/ADR-039-Session-Policy-Remember-Me-Idle-Absolute|ADR-039 KB (≙ ADR-053)]].
>
> **Trạng thái 2026-10-24:** mới xong **phần nền** — migration, lib server, logic thuần, hook client, sự kiện phiên — ở working tree,
> **chưa commit** ✅ `git status`. **Chưa gắn vào editor nào** và **chưa gắn bước cron dọn** ✅ grep (`editor-draft`, `use-server-autosave`,
> `purgeStaleDrafts` chỉ xuất hiện trong chính các file nền và `tests/integration/editor-draft.test.ts`). Migration
> `20261024120000_adr051_editor_drafts` **đã chạy trên DB dùng chung** 🟡 (brief Quốc; Long không chạy lệnh DB).
>
> Mức xác minh: ✅ Long đọc code/SQL working tree · 🟡 brief/báo cáo Quốc · ❓ cần môi trường thật.

---

## 1. Nguyên tắc (chủ dự án chốt) 🟡 ADR-053 / ✅ khớp code nền

- Nháp lưu **trên server**, **không** lưu cục bộ trình duyệt (tránh nội dung gian hàng nằm lại trên máy dùng chung).
- Nháp **theo từng người dùng**; autosave **không bao giờ** ghi vào bản đã lưu/live — nháp chỉ đổ lại vào form, Lưu/Xuất bản vẫn đi qua
  validate đầy đủ của từng editor.
- Không ghi audit mỗi lần autosave; log không in payload ✅ (comment `lib/editor-draft.ts`, `use-server-autosave.ts`).
- Tenant `READ_ONLY`/`LOCKED` **không** autosave ✅ (`saveDraft` gọi `assertTenantCanWrite`). Xoá nháp (`discardDraft`) **không** bị chặn.
- Đóng tab: **không** lưu (editor giữ cảnh báo `beforeunload`); không autosave cho `cms-page-form` (form JSON thô ghi thẳng live).
- Thứ tự gắn vào editor (chưa làm): bài viết → tài liệu → trang gian hàng → CMS home/shop/pricing/menu → pháp lý → cron 🟡 ADR-053 lần 3.

---

## 2. Dữ liệu — 2 bảng tách theo layer ✅ (đọc SQL + `schema.prisma`)

| Bảng (model) | Layer | Truy cập | Khoá duy nhất |
| :-- | :-- | :-- | :-- |
| `tenant_editor_drafts` (`TenantEditorDraft`) | **L2** — RLS `ENABLE` + `FORCE` | `withTenant(tenantId)` + luôn lọc `userId` ở server | `(tenantId, userId, entityType, entityKey)` |
| `system_editor_drafts` (`SystemEditorDraft`) | **L1** — không RLS | `getPrismaClient()` sau `requireRole("SYSTEM_ADMIN")` | `(userId, entityType, entityKey)` |

Cột chung: `id` cuid2, `entityType` (enum riêng mỗi bảng), `entityKey`, `payload Json`, `revision Int @default(1)`, `clientId` (tab đã ghi),
`baseUpdatedAt?` (`updatedAt` của bản đã lưu mà form dựa vào), `createdAt`, `updatedAt`. FK `tenantId`/`userId` → `ON DELETE CASCADE`.
CHECK `*_bounds`: `revision ≥ 1`, `entityKey` và `clientId` 1–64 ký tự, `octet_length(payload::text) ≤ 1 MiB` (lưới an toàn — giới hạn chính ở §3).

**RLS `tenant_editor_drafts`** (policy tách theo lệnh, mẫu `order_notes`) ✅:

| Lệnh | Được phép |
| :-- | :-- |
| SELECT (`select_access`) | scope `tenant` đúng `tenantId` **hoặc** scope `system_job` |
| INSERT (`tenant_insert`) | scope `tenant` đúng `tenantId` |
| UPDATE (`tenant_update`) | scope `tenant` đúng `tenantId` — cả `USING` lẫn `WITH CHECK` (không chuyển dòng sang tenant khác) |
| DELETE (`tenant_delete`, `system_job_delete`) | scope `tenant` đúng `tenantId` **hoặc** `system_job` |

`system_job` **chỉ SELECT/DELETE** (cron dọn), không INSERT/UPDATE. **Không** nhánh customer/public/admin (§7.9). "Đúng người dùng" không nằm
trong policy (scope tenant không mang user id) — kiểm ở server bằng `WHERE userId = người gọi`.

Enum: `TenantEditorDraftEntity` = `POST` · `PRODUCT` · `STOREFRONT`; `SystemEditorDraftEntity` = `HOME` · `SHOP` · `PRICING` · `MENU` ·
`LEGAL_VERSION`. Chi tiết bảng: [[03-API-Contracts/Database-Schema-Reference|Database-Schema-Reference]] §3.1, §3.2, §4, §7.

---

## 3. Logic thuần — `packages/core/src/content/editor-draft.ts` ✅ (subpath `@gieochu/core/editor-draft`, client import được)

### 3.1. Khoá thực thể — `isValidEditorDraftKey(entityType, key)`

| Loại | Khoá hợp lệ |
| :-- | :-- |
| `POST`, `PRODUCT` | id thực thể (`^[a-z0-9]{1,40}$`, không phân biệt hoa thường) hoặc `"new"` (`EDITOR_DRAFT_NEW_KEY` — trang Tạo) |
| `STOREFRONT`, `HOME`, `SHOP`, `PRICING`, `MENU` | chỉ `"main"` (`EDITOR_DRAFT_SINGLETON_KEY`) |
| `LEGAL_VERSION` | id phiên bản, hoặc `new-<khoá văn bản>` (`LEGAL_DRAFT_NEW_PREFIX`) với khoá có trong `LEGAL_DOCUMENT_KEYS` (vd `new-terms`) |

Hàm chỉ kiểm **hình dạng**; thực thể có tồn tại/thuộc tenant hay không do server kiểm (§4). `clientId` hợp lệ: `^[A-Za-z0-9_-]{8,64}$`.
Loại phải đúng phạm vi: scope TENANT chỉ nhận 3 loại Studio, scope SYSTEM chỉ nhận 5 loại System Center.

### 3.2. Giới hạn và nhịp

| Hằng | Giá trị |
| :-- | :-- |
| `EDITOR_DRAFT_MAX_BYTES` (byte UTF-8 của `JSON.stringify`) | `POST` 400 KB · `PRODUCT` 64 KB · `STOREFRONT`/`HOME`/`SHOP`/`PRICING`/`MENU` 256 KB · `LEGAL_VERSION` 400 KB |
| `EDITOR_DRAFT_HARD_CAP_BYTES` | 512 KB (trần chung) |
| `EDITOR_DRAFT_RATE_LIMIT` | 20 lần / 60 giây / (phạm vi, người dùng, loại, khoá) |
| `EDITOR_DRAFT_RETENTION_DAYS` | 30 |
| `EDITOR_DRAFT_DEBOUNCE_MS` / `EDITOR_DRAFT_MAX_INTERVAL_MS` | 3 000 / 30 000 |

### 3.3. Zod "chế độ nháp" — `parseEditorDraftPayload(entityType, raw)`

Kiểm kích thước **trước** khi parse (payload khổng lồ không đi qua zod), rồi hình dạng (`strictObject` — field lạ bị từ chối):
- Form (`POST`: `title`, `body`, `productId`; `PRODUCT`: 13 field form tài liệu; `LEGAL_VERSION`: `contentHtml`, `changeSummary`) — mỗi field là
  chuỗi / boolean / null / bỏ trống. **Không** kiểm nghiệp vụ (tiêu đề bắt buộc, giá hợp lệ…).
- Khối (`STOREFRONT` và 4 trang CMS): `{ blocks: <JSON hợp lệ> }`, độ sâu ≤ 12.
- Field HTML được sanitize ở server (`EDITOR_DRAFT_HTML_FIELDS`): `POST.body`, `PRODUCT.description`, `LEGAL_VERSION.contentHtml`.

### 3.4. Mã lỗi (`EDITOR_DRAFT_ERROR_CODES`)

| Mã | HTTP | Khi nào |
| :-- | :-: | :-- |
| `DRAFT_TOO_LARGE` | 413 | Vượt giới hạn theo loại hoặc trần chung |
| `DRAFT_INVALID` | 400 | Loại/khoá/`clientId`/`expectedRevision`/`baseUpdatedAt` sai, payload không tuần tự hoá được hoặc sai hình dạng |
| `DRAFT_CONFLICT` | 409 | Lệch revision (§4.2) hoặc hai request tạo cùng lúc (unique `P2002`) |
| `DRAFT_UNAVAILABLE` | — | Khai báo trong hằng nhưng **chưa nơi nào dùng** ✅ grep (KB-Audit §35) |

Ngoài ra: `RATE_LIMITED` (429, `rateLimited()`), `FORBIDDEN` (tenant không tồn tại), `NOT_FOUND` (thực thể không thuộc tenant / phiên bản pháp lý
không còn `DRAFT`), lỗi `assertTenantCanWrite` khi tenant không ACTIVE.

---

## 4. Lib server — `apps/web/lib/editor-draft.ts` ✅

Phạm vi `EditorDraftScope = { kind: "TENANT", tenantId } | { kind: "SYSTEM" }`. **Nơi gọi (Server Action của từng editor) phải kiểm quyền mỗi
lần** — `requireTenantMember(slug)` rồi truyền `tenant.id` + `user.userId` lấy từ guard; System Center `requireRole("SYSTEM_ADMIN")`. Hiện
**chưa có Server Action nào** gọi lib này ✅ grep.

| Hàm | Việc làm |
| :-- | :-- |
| `getDraft(scope, userId, ref)` | Đọc nháp của chính người dùng (`withTenant` hoặc `getPrismaClient()`); không có → `null` |
| `saveDraft(scope, userId, input)` | Kiểm loại/khoá, `clientId`, `expectedRevision`, `baseUpdatedAt` → rate limit → (TENANT) tenant tồn tại + `assertTenantCanWrite` → `parseEditorDraftPayload` → sanitize field HTML → ghi trong transaction; trả `{ revision, updatedAt }` |
| `discardDraft(scope, userId, ref)` | Xoá nháp của chính người dùng; không lỗi khi không có, không chặn tenant READ_ONLY. Dùng khi Lưu nháp / Lưu / Xuất bản / Khôi phục live / Bỏ / xoá thực thể |
| `purgeStaleDrafts(now?)` | Dành cho cron — **chưa gắn** vào `/api/cron/daily` ✅ (§6) |

### 4.1. Kiểm thực thể

- TENANT `POST`/`PRODUCT` có id: dòng `posts`/`products` phải cùng `tenantId` (đọc dưới RLS tenant) — không có → 404. `STOREFRONT` và khoá `"new"`
  bỏ qua bước này.
- SYSTEM `LEGAL_VERSION` có id: phiên bản phải tồn tại và còn `DRAFT` (bản PUBLISHED/ARCHIVED bất biến nội dung) — không → 404.
- Sanitize: `sanitizeRichTextHtml(html, { imageCloudName })` — pháp lý `imageCloudName = null` (không ảnh, khớp `lib/legal.ts`); còn lại chỉ giữ
  ảnh Cloudinary hệ thống. Nháp pháp lý **không** dùng chế độ `trustedLinks` (ADR-054) — khi render/lưu bản chính, `sanitizeLegalHtml` chạy lại.

### 4.2. Xung đột nhiều tab (revision)

Client gửi `expectedRevision` (revision nó biết; `null` = chưa biết nháp nào) + `clientId`. `checkRevision`:
- `overwrite: true` ("Ghi đè" sau xung đột) → bỏ qua kiểm.
- Chưa có dòng mà client gửi `expectedRevision ≠ null` → **xung đột** (nháp đã bị xoá ở tab khác do Lưu/Bỏ — không âm thầm tạo lại).
- Có dòng: revision khớp → ghi; khác nhưng `clientId` trùng dòng hiện tại (chính tab này ghi lần trước, phản hồi bị mất) → ghi; còn lại → xung đột.
- Ghi bằng `updateMany … WHERE revision = <revision đã đọc>`; `count = 0` (request song song) → xung đột. Tạo mới trùng unique → xung đột.

---

## 5. Hook client — `apps/web/lib/use-server-autosave.ts` ✅

`useServerAutosave({ value, dirty, enabled, initialRevision, save, refreshSession? })` chỉ lo **nhịp và trạng thái**; việc ghi do `save` (Server
Action của từng editor, gọi `saveDraft`). Trả `ServerAutosave`: `status`, `lastSavedAt`, `revision`, `clientId`, `flush`, `retry`, `suspend`,
`resume`, `markSaved`, `resolveConflict`, `overwrite`.

- **Nhịp:** lưu sau 3 giây ngừng gõ, gõ liên tục tối đa 30 giây/lần; chỉ khi `enabled && dirty`; payload không đổi so với lần lưu thành công
  (hash FNV-1a của `JSON.stringify`, chỉ để so sánh) → bỏ qua.
- **Lưu ngay:** khi tab ẩn (`visibilitychange`), khi unmount (đổi route), khi nhận sự kiện `gieochu:session-expiring` (§5.1).
- **`clientId`:** 16 byte ngẫu nhiên (`crypto.getRandomValues`) dạng hex, một giá trị/tab.
- **Trạng thái** (`AutosaveStatus`): `idle`, `saving`, `saved`, `error`, `conflict`, `too-large`, `rate-limited`, `unauthenticated`, `suspended`.
- **Xử lý kết quả:** `DRAFT_CONFLICT` → dừng autosave tới khi `resolveConflict(revision, payload)` hoặc `overwrite()`; `FORBIDDEN` → dừng, chờ
  "Thử lại"; `UNAUTHORIZED` → gọi `POST /api/auth/refresh` **một lần** rồi gửi lại, vẫn lỗi → `unauthenticated` (nội dung vẫn trong state form,
  không lưu cục bộ); `DRAFT_TOO_LARGE` → không gửi lại cùng nội dung; `RATE_LIMITED` → lùi dần 5 giây, nhân đôi, tối đa 60 giây; lỗi mạng/khác →
  `error`.
- **Bấm Lưu/Xuất bản:** gọi `suspend()` trước khi gửi (huỷ debounce, bỏ kết quả autosave đang bay); Lưu xong `markSaved()`; Lưu lỗi `resume()`.

### 5.1. Sự kiện `gieochu:session-expiring` ✅

`app/_ui/session-refresh.tsx` phát `window.dispatchEvent(new CustomEvent("gieochu:session-expiring"))` đúng lúc **mở hộp thoại cảnh báo sắp hết
phiên** (idle) — editor đang mở flush nháp trước khi phiên hết. Chính sách phiên: [[02-System-Specs/Auth-Session-Specs|Auth-Session-Specs]].

---

## 6. Dọn nháp — `purgeStaleDrafts` (chưa gắn cron) ✅ đọc code

- `tenant_editor_drafts` qua `withSystemJob` (SQL thô): xoá dòng `updatedAt` cũ hơn 30 ngày, **hoặc** nháp `POST`/`PRODUCT` (khoá khác `"new"`) mà
  bài viết/tài liệu không còn trong cùng tenant.
- `system_editor_drafts` (L1): xoá dòng cũ hơn 30 ngày, **hoặc** người dùng không còn là `SYSTEM_ADMIN`, **hoặc** nháp `LEGAL_VERSION` có id mà phiên
  bản không còn hoặc không còn `DRAFT`.
- Trả `{ tenantDeleted, systemDeleted }` (chỉ số đếm). Bước cron chưa có trong `app/api/cron/daily/route.ts` ✅ — khi gắn sẽ cập nhật
  [[02-System-Specs/Background-Jobs-Specs|Background-Jobs-Specs]] và [[03-API-Contracts/Endpoint-Directory|Endpoint-Directory]] §17.

---

## 7. Test ✅ (đọc file; `pnpm test:count` 2026-10-24 = 100/100 unit, 66/66 integration)

- Unit `packages/core/src/content/editor-draft.test.ts` — 1 case: hình dạng payload theo loại, giới hạn kích thước theo loại, hình dạng khoá.
- Integration `apps/web/tests/integration/editor-draft.test.ts` (`describe("ADR-053 editor autosave drafts")`) — 2 case: (1) cách ly nháp giữa tenant
  dưới RLS thật, scope public/customer không thấy dòng nào, thực thể phải thuộc tenant; (2) xung đột revision giữa tab, ghi đè, gửi lại cùng tab,
  từ chối payload quá lớn, Lưu thì xoá nháp.

---

## 8. Chưa làm / ngoài phạm vi 🟡 (kế hoạch)

- Gắn hook + Server Action vào từng editor; UI (Phong) — dòng trạng thái `aria-live`, banner "Khôi phục / Bỏ", banner xung đột "Tải bản mới nhất /
  Ghi đè"; contract dữ liệu dự kiến `{ autosave: { updatedAt, revision, baseIsStale } | null }`.
- Gắn `purgeStaleDrafts` vào cron hằng ngày.
- Làm sau: cảnh báo "bản đã lưu bị sửa nơi khác" cho nút Lưu; autosave cho `cms-page-form`; lưu khi đóng tab (`keepalive`).

---

## 9. Liên kết

* [[01-Architecture-Decisions/ADR-039-Session-Policy-Remember-Me-Idle-Absolute|ADR-039 KB (≙ ADR-053)]] · [[02-System-Specs/Auth-Session-Specs|Auth-Session-Specs]] ([Auth-Session-Specs.md](./Auth-Session-Specs.md))
* [[03-API-Contracts/Database-Schema-Reference|Database-Schema-Reference]] §3.1, §3.2, §4, §7 · [[02-System-Specs/Product-Editor-And-Publishing-Specs|Product-Editor-And-Publishing-Specs]] · [[02-System-Specs/Posts-Specs|Posts-Specs]] · [[02-System-Specs/Legal-Documents-Specs|Legal-Documents-Specs]]
* Nguồn: `docs/ke-hoach-tu-luu-nhap-2026-10-24.md`, ADR-053 trong `docs/DECISIONS.md`

*Quay lại: [[MOC-Home]] (../00-Index/MOC-Home.md)*

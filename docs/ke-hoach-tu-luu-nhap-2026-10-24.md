# Kế hoạch: Tự lưu nháp editor lên server (ADR-053 bổ sung lần 3)

Ngày chốt: 2026-10-24 · Chủ dự án duyệt toàn bộ đề xuất · Trạng thái: **đang triển khai**

> **Tiến độ 2026-10-24 (Long ghi):** xong bước 1–3 mục 4 (sự kiện `gieochu:session-expiring`, migration `20261024120000_adr051_editor_drafts`
> — đã chạy, tên thư mục giữ số cũ —, `lib/editor-draft.ts`, hook `use-server-autosave.ts`, test 100/65). Chưa gắn editor nào (bước 4–8), chưa gắn cron
> (bước 9). Số ADR đổi hai lần (2026-10-24, 2026-10-25): phần này nay là "Bổ sung ADR-053 lần 3" (trước đây ADR-051, rồi ADR-052).

## 1. Hiện trạng (Hiếu khảo sát, chỉ đọc code)

| Editor | Lưu ở đâu | Tách nháp/live? | Ghi chú |
|---|---|---|---|
| Bài viết (`studio/[tenantSlug]/posts/_ui/post-editor.tsx`, `lib/post.ts`) | `posts` | Không — bài PUBLISHED sửa thẳng live | L2, `withTenant` |
| Tài liệu (`studio/[tenantSlug]/products/_ui/product-editor.tsx`, `lib/product.ts`) | `products` | Không | L2, `withTenant`; file/ảnh bìa là thao tác tức thời, ngoài autosave |
| Trang gian hàng (`storefront-editor.tsx`) | `tenants.storefrontSections` / `storefrontSectionsDraft` | Có | `tenants` không RLS (ADR-023) |
| CMS home/shop/pricing/menu | `cms_pages.blocks` / `blocksDraft` | Có | L1, SYSTEM_ADMIN |
| Pháp lý (`legal-editor.tsx`) | `legal_document_versions.contentHtml` (bản DRAFT) | Theo phiên bản | L1, có audit |
| `cms-page-form.tsx` | `cms_pages.blocks` (ghi thẳng live) | Không | **Không autosave** đợt này |

Chưa editor nào tự lưu; "Lưu nháp" đều là nút bấm tay.

## 2. Mô hình dữ liệu (migration expand-only — chủ dự án chạy)

- `tenant_editor_drafts` (L2): `id` cuid2, `tenantId` (FK cascade), `userId` (FK cascade), `entityType`
  (`POST | PRODUCT | STOREFRONT`), `entityKey` (id thực thể hoặc `"new"`), `payload Json`, `revision Int`, `clientId`,
  `baseUpdatedAt`, `createdAt`, `updatedAt`. Unique `(tenantId, userId, entityType, entityKey)`. RLS ENABLE + FORCE, chỉ
  nhánh `tenant` và `system_job` (không public/customer/admin — §7.9). Truy cập qua `withTenant`, lọc thêm `userId`.
- `system_editor_drafts` (L1): cùng cột trừ `tenantId`; `entityType` `HOME | SHOP | PRICING | MENU | LEGAL_VERSION`. Chỉ
  qua `getPrismaClient()` sau `requireRole("SYSTEM_ADMIN")`.
- Không gộp 1 bảng `tenantId` nullable (tránh trộn L1/L2 — bài học ADR-010/020). Không thêm cột nháp vào từng bảng (rò
  rỉ qua policy SELECT public, bump `updatedAt`, trang Tạo chưa có dòng).

## 3. Quy tắc

| Hạng mục | Quyết định |
|---|---|
| Phạm vi nháp | Theo **từng người dùng** |
| Chu kỳ | Debounce 3 giây sau khi ngừng gõ, tối đa 30 giây/lần khi gõ liên tục; payload không đổi (hash) thì bỏ qua; chỉ khi `dirty` |
| Rời tab / đổi route | Lưu ngay (`visibilitychange`, unmount) |
| Đóng tab | Không lưu; giữ cảnh báo `beforeunload` |
| Kênh | Server Action (CSRF sẵn); bấm Lưu thì huỷ debounce |
| Giới hạn payload | POST 400KB, PRODUCT 64KB, STOREFRONT/CMS 256KB, LEGAL 400KB, trần 512KB → `DRAFT_TOO_LARGE` |
| Rate limit | 20 lần/phút/(user, entity) → `RATE_LIMITED`, client lùi dần |
| Xung đột | `expectedRevision` + `clientId`; lệch → `DRAFT_CONFLICT`, tab đó dừng autosave, banner [Tải bản mới nhất] [Ghi đè] |
| Khôi phục | Nháp mới hơn bản đã lưu → banner "Có bản nháp tự động lúc hh:mm — Khôi phục / Bỏ" (+ "dựa trên bản cũ hơn" nếu `baseUpdatedAt` cũ); không tự đổ vào form |
| Xoá nháp | Khi Lưu nháp / Lưu / Xuất bản / Khôi phục live / Bỏ / xoá thực thể; trang Tạo tài liệu chuyển key `"new"` → `productId` |
| Dọn | Cron `/api/cron/daily` (`withSystemJob`) xoá nháp không động tới quá **30 ngày** + nháp mồ côi |
| Tenant READ_ONLY/LOCKED | **Không** autosave (đồng bộ `assertTenantCanWrite`) |
| Phiên (ADR-053) | Gõ phím = hoạt động; flush nháp khi hiện cảnh báo sắp hết phiên; autosave hết phiên trả `UNAUTHENTICATED` (không redirect), client refresh 1 lần rồi gửi lại, thất bại → "Chưa lưu được — hãy đăng nhập lại" (giữ trong state, không localStorage) |
| Bảo mật | Kiểm quyền mỗi lần lưu (`requireTenantMember` / `requireRole`), kiểm thực thể thuộc tenant, zod "chế độ nháp", `sanitizeRichTextHtml` cho HTML; nháp chỉ đổ vào form — Lưu/Xuất bản vẫn qua validate cũ; **không** audit mỗi lần autosave; log không ghi payload |

## 4. Thứ tự triển khai

1. Contract sự kiện phiên (`gieochu:session-expiring`) với `session-refresh.tsx` — sau khi Phong xong UI phiên.
2. Migration (dừng, chủ dự án chạy) → `lib/editor-draft.ts` (scope tenant/system) → test RLS thật.
3. Hook client `useServerAutosave` (debounce, hash, revision, visibility).
4. Bài viết → 5. Tài liệu → 6. Trang gian hàng → 7. CMS home/shop/pricing/menu → 8. Pháp lý → 9. Cron dọn.
10. UI (Phong): dòng trạng thái `aria-live` ("Đang tự lưu…", "Đã tự lưu lúc hh:mm", "Không tự lưu được — Thử lại"),
    banner khôi phục, banner xung đột. Contract dữ liệu: `{ autosave: { updatedAt, revision, baseIsStale } | null }`.

## 5. Ngoài phạm vi (làm sau)

- Cảnh báo "bản đã lưu bị sửa ở nơi khác" khi bấm Lưu/Xuất bản (hiện ghi đè im lặng).
- Autosave cho `cms-page-form` (sau khi form có draft/live).
- Route Handler `keepalive` lưu khi đóng tab.

## 6. Test

Dự kiến +1 unit (zod/giới hạn payload) và +2 integration (RLS thật; revision conflict + Lưu xoá nháp). ADR-053 cho phép
nâng trần — báo số cụ thể khi xong.

---
tags: [ke-hoach, pricing, account, cms, du-lieu-ca-nhan]
date: 2026-10-17
---

# Kế hoạch: Nâng cấp tài khoản (`/pricing` + CMS) và Hồ sơ (`/account`) — đã chốt (ADR-041), GĐ1 + GĐ2 + GĐ2b xong code

> Người soạn: Long (tài liệu) theo brief của Quốc, 2026-10-17. **Trạng thái: ĐÃ CHỐT — ADR-041** (`docs/DECISIONS.md`, Quốc ghi
> 2026-10-17, gồm bổ sung ADR-008 và 2 lần "Bổ sung ADR-041"); **GĐ1 + GĐ2 xong code, chưa commit/deploy** (cập nhật 2026-10-17, §0);
> GĐ2b (S1) xong code 2026-10-17 theo ADR-042. Bảng §6 ghi kết quả chốt; chỗ ADR-041 không nêu thì giữ đề xuất của Phong
> (ghi rõ "theo đề xuất").
>
> **Nguồn:** hai đề xuất của Phong (giữ nguyên contract/đề xuất, không thêm nghiệp vụ):
> - `docs/de-xuat-trang-bang-gia-2026-10-17.md` — gọi tắt **[BG]**, câu hỏi đánh số **BG-Q1…BG-Q15**, contract **BG-C1…BG-C6**.
> - `docs/de-xuat-trang-ho-so-2026-10-17.md` — gọi tắt **[HS]**, câu hỏi **HS-Q1…HS-Q13**, contract **HS-C1…HS-C7**.
>
> **Nguyên tắc bắt buộc:** **CMS/dữ liệu trước, UI sau — UX trước UI** (`CLAUDE.md` mục "Nguyên tắc lập kế hoạch tính năng";
> `obsidian-knowledge-base/06-AI-Agent-Guides/Team-Charter.md` §2.1; mục `PLAN_CHECK` trong mẫu brief). Với Hồ sơ, nội dung là
> **dữ liệu của người dùng** (không phải chữ marketing), nên "CMS trước" hiểu là **GĐ1 = dữ liệu + Server Action + quy tắc nghiệp
> vụ**, **GĐ2 = giao diện** ([HS] đầu trang).
>
> **Ràng buộc liên quan:** ADR-008, ADR-021, ADR-024, ADR-025, ADR-028, ADR-032, ADR-033, ADR-034, ADR-035, ADR-037 (`docs/DECISIONS.md`).
>
> **Mức xác minh:** ✅ Long đã đối chiếu code/schema trong working tree ngày 2026-10-17 · 🟡 theo đề xuất/báo cáo, chưa kiểm ·
> ❓ cần môi trường thật (Neon production) hoặc cần chủ dự án/Quốc quyết.

---

## 0. Tiến độ (Long cập nhật 2026-10-17 theo brief Quốc + đối chiếu code working tree)

| Bước | Trạng thái | Ghi chú |
|---|---|---|
| 0.1, 0.2 | ✅ Xong | ADR-041 + "Bổ sung ADR-041" (thông tin nhận tiền mã hoá, cờ "đã triển khai" là hằng core) + "lần 2" (mất quyền khi có hoá đơn PAID thứ hai, `-1` = không giới hạn, audit xem thông tin nhận tiền) |
| A1–A5 | ✅ Xong code | `pricing-sections.ts` (section lý do tên **`whyUs`**, không phải `reasons` như §3.1), `pricing-cms.ts`, editor `/admin/cms/pricing` + SEO CMS; hạn mức `0`/`-1`; `IMPLEMENTED_PLAN_FEATURES = []` (trả lời ❓ §3.1 nơi lưu dấu "đã triển khai") |
| B1–B7 | ✅ Xong code | Migration `20261017090000_adr041_email_change` **đã áp** 2026-10-17; đổi mật khẩu/đổi email/ảnh đại diện/loader tổng quan; trang xác nhận là `/account/email/xac-nhan` (không phải `/account/email/confirm`); không thêm `PROFILE_AVATAR_CHANGED` |
| R1–R3 | ✅ Xong code | Migration `20261017100000_adr041_subscription_refunds` **đã áp** 2026-10-17 (bảng L1 `subscription_refund_requests`); thông tin nhận tiền nhập trong form yêu cầu, mã hoá AES-256-GCM (trả lời ❓ §3.3) |
| G1 | ✅ | Quốc review; Long ghi KB 2026-10-17 |
| A6, A7 | ✅ Xong code | `/pricing` dựng lại, Billing `?plan=` |
| B8–B10 | ✅ Xong code | ⚠️ Khác B8/HS-Q11: `/account` là **app shell fluid + header gọn 64px**, không phải header/footer công khai + `container-page` |
| G2 | ✅ | Build/lint/typecheck xanh; Hiếu kiểm dữ liệu thật 23/23 ca + 1 ca phụ (gọi lib trực tiếp, email mock) — **chưa** qua UI có đăng nhập, **chưa** SMTP thật |
| S1 (GĐ2b) | ✅ Xong code (2026-10-17, ADR-042) | Không dùng `MobileNav` như §4.3 dự kiến: sidebar dùng chung `SidebarNav` + `AppSidebarPanel` cho System Center và Studio, dưới `lg` mở bằng drawer `<dialog>` (`SidebarDrawer`); Đăng xuất cố định đáy sidebar + trong menu tài khoản header (về `/login`). Chưa kiểm phiên đăng nhập thật/trình đọc màn hình |

Test: không thêm — **93/94 unit, 54/55 integration** (`pnpm test:count`, 2026-10-17). Nợ test, việc để sau: `docs/BACKLOG.md` mục "Phát sinh trong
đợt ADR-041". KB: `obsidian-knowledge-base/02-System-Specs/{Pricing-Page-Specs,Account-Profile-Specs,Payment-And-Billing}.md`, bản trích
`01-Architecture-Decisions/ADR-027-Account-Upgrade-Pricing-Profile-Refund.md`, `00-Index/KB-Audit-2026-09-26.md` §21.

---

## 1. Tóm tắt và phạm vi

| Hạng mục | Nội dung | GĐ1 (dữ liệu/CMS) | GĐ2 (UI) | DDL? |
|---|---|---|---|---|
| **A. Nâng cấp tài khoản** | Trang công khai `/pricing` giới thiệu gói dịch vụ mà **giáo viên/coach (tenant)** mua để mở gian hàng (Platform Billing, ADR-021). Không bàn giá tài liệu tenant bán cho khách. | CMS `/admin/cms/pricing` trong System Center: `CmsPage` slug `pricing`, 9 section, nháp / xuất bản / khôi phục. Giá + hạn mức + tính năng **chỉ một nguồn** là `Plan` (`/admin/plans`). Gói năm ghép cặp tháng ↔ năm. **Hoàn tiền gói 7 ngày** (ADR-041 B, §3.3) | `/pricing` đọc DB (thẻ gói, CTA theo trạng thái người xem, bảng so sánh, FAQ…), Billing Studio nhận `?plan=` | CMS: **không** (dùng `cms_pages` có sẵn, ✅ model `CmsPage` có `blocks`/`blocksDraft`/`status`/`seoTitle`/`seoDescription`). Hoàn tiền: ❓ có thể cần — Hiếu đề xuất (§3.3) |
| **B. Hồ sơ** | Khu vực tài khoản `/account/**` cho **mọi** `User`. Chủ gian hàng **dùng chung** hồ sơ cá nhân này + nhóm sidebar **"Gian hàng của bạn"** link sang Studio. **Studio chỉ giữ cài đặt gian hàng** (thương hiệu, đường dẫn, nhận thanh toán, gói dịch vụ). | Server Action trả state (`useActionState`), đổi mật khẩu thu hồi phiên khác + audit, đổi email qua token, ảnh đại diện Cloudinary, loader tổng quan | `account/layout.tsx` + sidebar + Tổng quan, dựng lại Hồ sơ/Bảo mật, thẻ "Gian hàng của bạn", menu tài khoản ở header Studio | **Có** — expand-only: `VerificationTokenType.EMAIL_CHANGE` + `VerificationToken.newEmail` (§3.2) |
| **GĐ2b** | Menu mobile + nút Đăng xuất cho Studio ([HS] H8) | — | Task UI riêng (Phong) | Không |

**Ngoài phạm vi** (ADR-041): thẻ Enterprise/"Liên hệ", quà tặng thêm tháng, dùng thử gói trả phí, JSON-LD `Product`/`Offer`;
Preferences, Referrals, Blocklist, Members/Groups, Phone numbers, Integrations, Tên miền. **Để sau (BACKLOG):** danh sách phiên/IP,
xoá tài khoản, tuỳ chọn thông báo, ảnh đại diện công khai; xác thực hai bước.

**Liên kết hai hạng mục:** thẻ "Gian hàng của bạn" ở `/account` dùng nút "So sánh các gói" → `/pricing` và **BG-C5**
(`/studio/{slug}/billing?plan={planId}`) — nên BG-C5 phải xong trước bước dựng thẻ (§4).

---

## 2. Luồng UX theo vai

Bảng gộp từ [BG] §2.1–§2.3 và [HS] §2.3–§2.5. Nhãn nút là **mặc định trong CMS** (`plans.ctaLabels`); code chỉ quyết **đích** theo
trạng thái người xem ([BG] §2.3).

### 2.1. Khách chưa đăng ký (giáo viên/coach đang cân nhắc)

```
Trang chủ / header "Bảng giá" → /pricing → đọc thẻ gói (Free nổi bật "Miễn phí mãi mãi")
  → [Bắt đầu miễn phí] → /register → xác minh email → /studio (mở gian hàng, tự gán gói Free)
  → thẻ gói trả phí: [Chọn gói {Tên}] → /register?next=/studio  (mở gian hàng Free trước, nâng cấp sau — BG-Q7)
```

- Đã đăng nhập nhưng chưa có gian hàng: thẻ Free [Mở gian hàng miễn phí] → `/studio`; thẻ trả phí [Mở gian hàng trước] → `/studio`
  kèm dòng phụ "Gian hàng bắt đầu ở gói Free, nâng cấp sau 1 bước".
- Trong `/account`: người chưa có gian hàng thấy thẻ nhỏ "Bạn là giáo viên/coach? **Mở gian hàng miễn phí** → `/studio`" thay cho nhóm
  "Gian hàng của bạn" (HS-Q9).

### 2.2. Khách đã mua (người mua tài liệu, không có gian hàng)

```
A. Đổi tên/ảnh:   Header › avatar › Hồ sơ của tôi → /account/profile → sửa → [Lưu thay đổi] → "Đã lưu" tại chỗ
B. Đổi mật khẩu:  Header › Bảo mật → /account/security#mat-khau → cũ + mới → [Đổi mật khẩu]
                  → "Đã đổi. Các thiết bị khác đã bị đăng xuất." (nếu HS-Q5 = có)
C. Đổi email:     /account/security#email → email mới + mật khẩu hiện tại → [Gửi link xác minh]
                  → "Đang chờ xác minh new@…" (Gửi lại / Huỷ) → mở email mới → trang xác nhận, bấm nút
                  → /account/security?email=changed → "Email đăng nhập đã đổi thành new@…"
Mua sắm:          sidebar nhóm "Mua sắm" → Thư viện tài liệu / Đơn hàng (giữ nội dung, đổi khung)
```

Sidebar `/account` ([HS] §2.3): **Tài khoản của bạn** (Tổng quan · Hồ sơ · Bảo mật) → **Mua sắm** (Thư viện · Đơn hàng) → **Gian hàng
của bạn** (chỉ chủ gian hàng) → Đăng xuất tách riêng cuối. Mobile < 1024px: ẩn sidebar, `/account` hiển thị danh sách mục; trang con
có link "← Tài khoản".

### 2.3. Chủ gian hàng gói Free

```
Studio › Billing (thanh cảnh báo 80%) → link "So sánh các gói" → /pricing (thẻ Free có nhãn "Gói hiện tại")
  → [Nâng cấp lên {Tên}] → /studio/{slug}/billing?plan={planId} (RenewForm chọn sẵn) → chọn phương thức → QR/MoMo
  → thanh toán → Billing tự làm mới (BillingPoll) → "Đang hoạt động"
Studio › avatar header › Hồ sơ cá nhân → /account/profile (thẻ "Gian hàng của bạn": Gói [Free] · Không hết hạn)
  → [Nâng cấp] → /pricing
```

### 2.4. Chủ gian hàng gói trả phí

```
/pricing → thẻ gói hiện tại: nhãn "Gói hiện tại" + "Hết hạn dd/mm/yyyy" + nút phụ [Gia hạn] → Billing
         → gói giá cao hơn: [Nâng cấp lên {Tên}]; giá thấp hơn: [Chuyển sang {Tên}] + ghi chú "áp dụng ngay khi thanh toán" (BG-Q8)
         → thẻ Free: dòng chữ "Tự động áp dụng khi gói trả phí hết hạn" (không nút — Billing không cho chọn Free)
         → có hoá đơn đang chờ: nút đổi thành [Xem hoá đơn đang chờ] → Billing (logic đã dedupe hoá đơn PENDING, ADR-013)
/account → thẻ "Gian hàng của bạn":
         ACTIVE → [Quản lý gói] → Billing · phụ "So sánh các gói"
         GRACE  → [Gia hạn ngay] → Billing (Notice cảnh báo, chữ + icon)
         CANCELED → [Gia hạn] → Billing · phụ "So sánh các gói"
```

- Một user vừa mua vừa bán **không** "chuyển vai": hai khu vực cách nhau một cú bấm qua menu tài khoản; dữ liệu cá nhân chỉ một bản
  (HS-Q1). ✅ `Tenant.ownerId @unique` → một user sở hữu tối đa 1 gian hàng.
- Studio: đổi nhãn "Cài đặt" → "Cài đặt gian hàng", trang `settings` thêm tab phụ **Thông tin chung · Nhận thanh toán**; "Gói dịch vụ"
  giữ mục sidebar riêng ([HS] §2.4).
- Không dựng lại form gia hạn/hoá đơn trong `/account` — một nơi duy nhất là Billing Studio (ADR-021).

---

## 3. Mô hình dữ liệu GĐ1

### 3.1. A — `CmsPage` slug `pricing` (không DDL)

- Lưu ở `CmsPage` slug **`pricing`**: `blocks` (live) / `blocksDraft` (nháp), `seoTitle` / `seoDescription`, mảng
  `{ id, type, visible, data }`, mỗi `type` tối đa 1 lần. Schema ở `packages/core/src/admin/pricing-sections.ts` (subpath
  `@gieochu/core/pricing-sections`, theo mẫu `shop-sections.ts` ✅). Tạo dòng bằng `upsert` lần lưu đầu — **không qua seed** (ADR-034).
- Thêm `"pricing"` vào `SYSTEM_CMS_SLUGS` (✅ hiện `["home", "shop"]` ở `packages/core/src/admin/cms-slugs.ts`) → `/p/pricing` 404,
  form CMS chung không tạo/ghi đè (BG-C1).
- **Phương án P2** ([BG] §4.2, đề xuất): dữ liệu marketing theo từng gói nằm trong khối `plans.items[]` gắn `planId`, **không** thêm cột
  vào `Plan` (P1 cần migration, không có nháp/xuất bản).

| `type` | Trường `data` (theo [BG] §4.3; giới hạn ký tự Hiếu chốt cùng schema) |
|---|---|
| `hero` | `eyebrow`, `title`, `subtitle`, `badge?` |
| `plans` | `title?`, `subtitle?`, `showAutoLimits`, `ctaLabels: { signup, openStore, upgrade, switch, renew, current, pendingInvoice }`, `cycleToggle?` (chỉ khi BG-Q2 chốt có giá năm), `items: PlanCardItem[]` (≤ 8, tối đa 1 `highlighted`) |
| ↳ `PlanCardItem` | `planId`, `altPlanId?`, `visible`, `highlighted`, `badge?`, `tagline?`, `benefits: string[]`, `ctaLabel?`, `note?` |
| `priceNote` | `lines: string[]` (1–4) |
| `stats` | `title`, `items: { key: HomeStatKey, label, visible }[]` — **không có trường số** (✅ `HomeStatKey` có ở `packages/core/src/admin/home-sections.ts`; số đọc `getHomeStats()` ✅) |
| `comparison` | `title`, `subtitle?`, `showPlanHeaderCta`, `groups[]` → `rows[]` union theo `kind`: `limit` (trường `Plan`) · `feature` (`PlanFeatureKey`) · `custom` (`cells` theo `planId`, `fallback`) |
| `reasons` | `title`, `subtitle?`, `items: { icon: ReasonIconKey, title, description }[]` (3–6) |
| `faq` | `title`, `items: { id, question, answer }[]` (≤ 20, **văn bản thuần**) |
| `ctaFinal` | `title`, `description`, `buttonLabel?` |
| `paymentMethods` | `title`, `description?`, `labels?` theo `PaymentProviderId` (danh sách cổng do code đọc `getEnabledPlatformProviders()` ✅) |

- Biến thay thế lúc render: chỉ `{brand}` (`getEffectiveBrand()`, ADR-032) và `{graceDays}` (`getSystemSettings().graceDays` ✅).
- **Gói năm, giảm theo % (ADR-041 A.2):** admin tạo `Plan` `interval = YEAR` ở `/admin/plans`; CMS ghép cặp tháng ↔ năm theo
  phương án **T1** (`PlanCardItem.altPlanId`, không đổi schema). % tiết kiệm **tính từ giá thật** (số nguyên), không nhập tay; không có
  cặp → ẩn toggle. Không quà tặng thêm tháng. ✅ `Plan` hiện mỗi dòng một chu kỳ, không có trường nhóm.
- **Chỉ quảng cáo tính năng có thật (ADR-041 A.3):** dòng `comparison` loại `feature` (gắn khoá cờ) chỉ hiện khi cờ được đánh dấu
  "đã triển khai". ❓ Nơi lưu dấu "đã triển khai" chưa nêu trong ADR-041 — Hiếu đề xuất, Quốc chốt.
- **Nội dung do admin nhập (ADR-041 A.5):** VAT/hoá đơn, hoa hồng, kênh hỗ trợ là chữ trong CMS (FAQ, `priceNote`), không hard-code;
  FAQ mẫu để trống các ý chưa có dữ kiện.
- Render phòng thủ: bỏ mục `visible:false` và `planId` không còn `isActive`; gói đang bật chưa có trong `items[]` → **thêm cuối,
  đang hiện** (BG-Q11); chưa có/chưa xuất bản dòng `pricing` → cấu hình mặc định trong code (không 404).
- Dữ liệu cá nhân: **không** (nội dung marketing + bảng L1 `Plan`). `viewer` của BG-C4 chỉ đọc subscription của chính người xem.

### 3.2. B — Hồ sơ (dữ liệu cá nhân, expand-only)

**Dùng lại, không thêm cột** ([HS] §4.1):

| Cột | Dùng cho | Dữ liệu cá nhân |
|---|---|---|
| `UserProfile.fullName` | Họ và tên (một ô, không tách họ/tên) | **Có** |
| `UserProfile.phone` | SĐT — **tuỳ chọn**, chỉ chủ tài khoản + admin thấy (ADR-041 C.1) | **Có — nhạy hơn** |
| `UserProfile.province` | Tỉnh/thành — **tuỳ chọn**, như SĐT (danh sách 34 đơn vị là hằng trong `@gieochu/core`, đề xuất) | **Có** |
| `UserProfile.avatarKey` | Cloudinary `public_id` ảnh đại diện (✅ cột `String?` đã có, chưa dùng) | **Có** (ảnh chân dung) |
| `User.email`, `emailVerifiedAt` | Email đăng nhập + nhận mọi thông báo | **Có** |
| `RefreshToken.familyId/userAgent/ip` | Thu hồi phiên (✅ `familyId` có) | `ip`, `userAgent` **có** — không hiển thị ở GĐ1 |

**Thay đổi schema** ([HS] §4.2) — Hiếu viết migration **expand-only**; **Quốc duyệt, chủ dự án chạy** `pnpm db:migrate` (ADR-034: DB
dùng chung dev/Preview/Production; agent không tự chạy). Deploy migration trước, code dùng cột sau.

| Thay đổi | Lý do | Ghi chú |
|---|---|---|
| `enum VerificationTokenType` thêm `EMAIL_CHANGE` | Luồng đổi email | ✅ enum hiện chỉ `EMAIL_VERIFY`, `PASSWORD_RESET`. `ALTER TYPE … ADD VALUE` là thao tác *thêm* (❓ Hiếu kiểm ràng buộc transaction của Postgres khi viết file migration) |
| `VerificationToken.newEmail String?` | Email đích của yêu cầu đổi (đã chuẩn hoá) | Nullable, chỉ dùng với `EMAIL_CHANGE`; **dữ liệu cá nhân**. Phương án khác `User.pendingEmail` kém hơn (không gắn hạn/huỷ theo token) |

**Audit (ADR-037) — không cần DDL:** ✅ `AuditLog.action` là cột `String`; danh sách hợp lệ là hằng `AUDIT_ACTIONS` trong
`packages/core/src/audit/audit.ts` (kèm `AUDIT_ACTION_LABELS`). Thêm `AUTH_PASSWORD_CHANGED`, `AUTH_EMAIL_CHANGE_REQUESTED`,
`AUTH_EMAIL_CHANGED`, `PROFILE_AVATAR_CHANGED` (tuỳ chọn) chỉ là sửa code. *(Đề xuất [HS] §4.2 gọi là "AuditAction thêm" — không
phải enum Prisma.)*

**Ảnh đại diện** ([HS] §4.3, cần bổ sung ADR-028): Cloudinary **hệ thống** (bỏ hướng "R2 `avatars/`" của đặc tả cũ), `public_id`
server sinh `<root>/users/<userId>/avatar/<24 hex>`, chữ ký chỉ cho chính user đã xác minh email, png/jpg/jpeg/webp ≤ 2 MB, không
tính vào hạn mức ảnh của gói gian hàng, rate-limit cấp chữ ký; GĐ1 **chỉ hiện ở chỗ riêng tư** (header, header Studio, `/account`).
Đã chốt ở ADR-041 C.3 (≤ 2 MB, riêng tư ở GĐ1).

**Không** tạo bảng tuỳ chọn thông báo ở GĐ1 (HS-Q8).

### 3.3. A — Hoàn tiền gói trả phí (ADR-041 B)

Quy tắc (chủ dự án chốt): trong **7 ngày** kể từ thanh toán, **chỉ lần thanh toán gói đầu tiên** của mỗi tenant, hoàn **100%**. Chủ gian
hàng gửi yêu cầu trong Billing Studio → admin duyệt ở System Center, **tự chuyển khoản tay** rồi bấm "Đã hoàn" → hoá đơn đánh dấu hoàn
tiền, thuê bao **về Free ngay** (không mất dữ liệu). Từ chối kèm lý do. Audit mọi bước. Cổng QR/MoMo **không** tự hoàn.

- ✅ `SubscriptionInvoiceStatus` hiện chỉ `PENDING | PAID | EXPIRED | VOID` — **chưa có** trạng thái hoàn tiền, chưa có nơi lưu yêu cầu
  hoàn (lý do, người duyệt, lý do từ chối). Mô hình dữ liệu cụ thể **Hiếu đề xuất, Quốc duyệt**; nếu cần DDL thì expand-only, chủ dự
  án chạy (ADR-034). Long không tự chọn.
- Hoá đơn gói là bảng L1 (✅ comment schema `SubscriptionInvoice`); admin duyệt hoàn tiền chỉ chạm bảng L1, không đọc đơn hàng/khách
  của tenant (§7.9).
- Số tiền hoàn = `amountVnd` của hoá đơn (100%, số nguyên VND). ❓ Thông tin tài khoản nhận tiền hoàn của chủ gian hàng lấy từ đâu chưa
  nêu trong ADR-041 — cần Quốc chốt (dữ liệu tài chính cá nhân).
- Audit: thêm hằng cho các bước gửi yêu cầu / đã hoàn / từ chối (tên do Hiếu đề xuất; `AuditLog.action` là `String`, không DDL).

---

## 4. Các bước

### 4.0. Bước chung

| Bước | Việc | Ai | Phụ thuộc | Tiêu chí xong |
|---|---|---|---|---|
| 0.1 | Chốt bảng quyết định §6 với chủ dự án | Quốc + chủ dự án | — | **Xong 2026-10-17** |
| 0.2 | Ghi ADR-041 (Bảng giá CMS, gói năm, hoàn tiền 7 ngày, Hồ sơ, bổ sung ADR-008). Còn lại nếu Quốc thấy cần: bổ sung ADR-028 (ảnh đại diện `users/`), ADR-024 (khung `/account`) | Quốc | 0.1 | **ADR-041 đã ghi** trong `docs/DECISIONS.md` |

### 4.1. GĐ1 — dữ liệu / CMS

| Bước | Việc | Ai | Phụ thuộc | Tiêu chí xong |
|---|---|---|---|---|
| A1 | `pricing-sections.ts`: schema chặt + `parsePricingSections` phòng thủ + mặc định + subpath export; `"pricing"` vào `SYSTEM_CMS_SLUGS` (BG-C1) | Hiếu | 0.2 | `/p/pricing` 404; form CMS chung từ chối slug; lint/typecheck đạt |
| A2 | `apps/web/lib/pricing-cms.ts` → `getPricingCmsEditorData()` (BG-C2, mọi gói kể cả đã tắt); `app/admin/cms/pricing/actions.ts`: `savePricingDraftAction` / `publishPricingAction` / `restoreLivePricingAction` (BG-C3, hình dạng `ShopEditorActionState`), `requireRole("SYSTEM_ADMIN")` đầu mỗi action, server kiểm `planId`/`altPlanId` tồn tại, ≤ 1 `highlighted`, `cells` chỉ chứa `planId` hợp lệ; `revalidatePath("/pricing")` | Hiếu | A1 | Non-admin bị từ chối; lưu nháp `upsert` tạo dòng `pricing` (DRAFT); xuất bản → PUBLISHED |
| A3 | Hạn mức **0 = không được phép** (ADR-041 A.4): giữ nghĩa ở core, đề xuất giá trị riêng cho "không giới hạn" theo dữ liệu hiện có, sửa hiển thị Billing cho thống nhất; dấu "đã triển khai" cho cờ tính năng (A.3) | Hiếu | 0.2 | Một nghĩa ở `isWithinPlanLimit` và Billing; ❓ kiểm `Plan` trên prod có gói nào đang để 0 với ý "không giới hạn" trước khi đổi hiển thị (Quốc chạy truy vấn chỉ đọc) |
| A4 | `SortableListEditor` dùng chung (`app/admin/cms/_ui/`); bố cục editor `app/admin/cms/pricing/page.tsx` + `_ui/*` + `loading.tsx` theo [BG] §5 (pattern editor Cửa hàng); mục menu "Trang Bảng giá" + icon | Phong | A1, A2 (dựng song song trên contract) | Mọi input có label; Lên/Xuống thay kéo-thả; target ≥ 44px dưới `lg`; không cuộn ngang 360px; dòng tính năng chỉ chọn được cờ đã đánh dấu "đã triển khai" |
| A5 | Nối editor ↔ actions, thử tay trên dev server (dữ liệu là production — chỉ ghi dòng `pricing`) | Hiếu | A2, A4 | Lưu nháp / Xuất bản / Khôi phục chạy; không tạo dữ liệu tạm khác |
| B1 | File migration expand §3.2 (`EMAIL_CHANGE`, `newEmail`) — **chỉ viết, không chạy** | Hiếu | 0.2 | File SQL chỉ *thêm*; Quốc duyệt; **chủ dự án chạy** `db:migrate` |
| B2 | Hằng audit mới + nhãn tiếng Việt (§3.2) | Hiếu | 0.2 | lint/typecheck đạt |
| B3 | `changePasswordAction` (HS-C3): trả state; lỗi theo ô; từ chối mật khẩu mới trùng cũ; thành công thu hồi mọi refresh token **trừ** `familyId` hiện tại, email báo, audit `AUTH_PASSWORD_CHANGED`, rate-limit lần sai (không khoá đăng nhập) | Hiếu | B2 | Phiên khác bị thu hồi, phiên hiện tại giữ; có dòng audit |
| B4 | `updateProfileAction` (HS-C2): trả state + `fieldErrors`; `fullName` 1–80; `phone?`/`province?` tuỳ chọn (ADR-041 C.1); giữ ký lại access token khi `pc` đổi; `revalidatePath("/account", "layout")` | Hiếu | B2 | Lỗi gắn ô, không mất nội dung đã gõ |
| B5 | Đổi email (HS-C4, HS-C5): request/resend/cancel + trang `/account/email/confirm?token=…` (GET chỉ hiển thị, POST bằng nút) + 3 email (xác minh tới email mới; báo yêu cầu tới email cũ; xác nhận đã đổi tới email cũ). Token hash SHA-256, TTL từ `getSystemSettings()`, yêu cầu mới huỷ yêu cầu cũ | Hiếu | B1 **đã áp DB**, B2 | Lỗi `TOKEN_EXPIRED` / `TOKEN_USED` / `EMAIL_TAKEN`; email cũ vẫn đăng nhập tới khi xác minh; thử tay **không gửi email tới địa chỉ thật** (CLAUDE.md) |
| B6 | Ảnh đại diện (HS-C6): `getAvatarUploadSignatureAction`, `saveAvatarAction(publicId)` (kiểm thuộc `users/<chính user>/avatar/`, xác minh asset, xoá ảnh cũ), `removeAvatarAction` | Hiếu | B2 (ADR-041 C.3; bổ sung ADR-028 nếu Quốc ghi) | Cloudinary chưa cấu hình → `CLOUDINARY_NOT_CONFIGURED`, không lỗi trang |
| B7 | Loader `getAccountOverview()` (HS-C1, `requireVerifiedAccess` ✅ có ở `lib/page-guards.ts`; `ownedTenant` chỉ bảng L1 + đếm của chính gian hàng); dữ liệu header `avatarUrl` (HS-C7) | Hiếu | B4, B6 | Không đọc đơn/khách của tenant khác; Hiếu xác nhận giá trị `SubscriptionStatus` còn xuất hiện thực tế sau ADR-021 |
| R1 | Đề xuất mô hình dữ liệu hoàn tiền gói (§3.3) + file migration expand nếu cần — **chỉ viết, không chạy** | Hiếu | 0.2 | Quốc duyệt; chủ dự án chạy `db:migrate` |
| R2 | Logic hoàn tiền: server kiểm điều kiện (≤ 7 ngày từ thanh toán, hoá đơn `PAID` đầu tiên của tenant); action gửi yêu cầu (chủ gian hàng — quyền cụ thể Hiếu xác nhận); action "Đã hoàn" / từ chối kèm lý do (`requireRole("SYSTEM_ADMIN")`); đánh dấu hoá đơn hoàn tiền + thuê bao về Free ngay; audit mọi bước; không gọi cổng thanh toán | Hiếu | R1 **đã áp DB** | Yêu cầu ngoài 7 ngày / không phải lần đầu bị từ chối ở server; thuê bao về Free, dữ liệu giữ nguyên |
| R3 | Bố cục: nút + form yêu cầu hoàn tiền trong Billing Studio; màn duyệt ở System Center (danh sách yêu cầu, Đã hoàn / Từ chối + lý do) | Phong | R2 (contract) | A11y form; xác nhận trước khi bấm "Đã hoàn" |
| G1 | Review diff GĐ1 (ranh giới L1/L2/L3, §7 bảo mật, tiền); Long ghi KB | Quốc, Long | A5, B3–B7, R2–R3 | Code đạt verify + KB ghi nhận |

### 4.2. GĐ2 — UI

| Bước | Việc | Ai | Phụ thuộc | Tiêu chí xong |
|---|---|---|---|---|
| A6 | Loader `getPricingPageData({ preview? })` (BG-C4); Billing nhận `?plan=` (BG-C5 — ✅ hiện `billing/page.tsx` chưa đọc `searchParams`); guard xem trước nháp `/pricing?xem-truoc=nhap` chỉ `SYSTEM_ADMIN`, `noindex`, `viewer` ép `ANON` (BG-C6, nếu BG-Q15 = có) | Hiếu | GĐ1-A | `viewer` chỉ dữ liệu của chính người xem; `?plan=` sai → mặc định như nay |
| A7 | `app/pricing/page.tsx` + `loading.tsx` + `error.tsx`, `app/_ui/pricing/*` (thẻ gói, toggle, bảng so sánh, FAQ, CTA, phương thức thanh toán), `SiteHeader current="pricing"` + `SiteFooter`, JSON-LD `FAQPage` (nếu duyệt); link "So sánh các gói" ở Billing; thay hex cứng thanh 80% Billing bằng token khi chạm | Phong | A6 | Đủ loading/empty/error; section rỗng tự ẩn; a11y [BG] §6.4; 375px không cuộn ngang trang |
| B8 | `account/layout.tsx` (header/footer công khai, `container-page` theo HS-Q11) + `AccountSidebarNav` + trang Tổng quan `/account`; dựng lại Hồ sơ, Bảo mật theo [HS] §3 bằng kit `admin/_ui/kit.tsx`; bỏ `required` SĐT/tỉnh (ADR-041 C.1) | Phong | GĐ1-B | `/account` không còn 404; mỗi trang 1 H1; lỗi dưới ô + `aria-describedby` |
| B9 | Thẻ "Gian hàng của bạn" (Tổng quan + Hồ sơ) theo bảng trạng thái [HS] §5 | Phong | B7, **A6 (BG-C5)** | Nút đích đúng theo Free/ACTIVE/GRACE/CANCELED |
| B10 | Đơn hàng: `EmptyState` + `loading.tsx`; Thư viện/Đơn hàng bỏ `max-w-*`/`py-16` riêng để vào layout chung; `AccountMenu` thêm "Bảo mật" + avatar; Studio header: avatar + email thành nút mở menu tài khoản; đổi tên "Cài đặt gian hàng" + tab phụ | Phong | B8 | Bàn phím + 375px/desktop đạt |
| G2 | Verify tổng (lint, typecheck, test, `test:count`, dev server dữ liệu thật, responsive, a11y); Quốc review; Long ghi KB | Hiếu + Phong, Quốc, Long | A7, B8–B10 | Báo cáo verify; KB ghi nhận |

### 4.3. GĐ2b — menu mobile + Đăng xuất Studio (task UI riêng)

| Bước | Việc | Ai | Phụ thuộc | Tiêu chí xong |
|---|---|---|---|---|
| S1 | Menu mobile Studio tái dùng mẫu `MobileNav` (`UI-Design-System.md` §14.6) + menu tài khoản ở header có "Đăng xuất" (✅ sidebar Studio hiện `hidden … lg:flex`, không có nút Đăng xuất) | Phong | **Sau GĐ1**, chạy song song GĐ2 (Quốc chốt 2026-10-17) | Điều hướng + Đăng xuất dùng được dưới `lg`; target ≥ 44px |

> **Kết quả (2026-10-17):** S1 làm theo **ADR-042** — drawer `SidebarDrawer` chứa sidebar dùng chung (không dùng `MobileNav`), áp cho cả Studio
> lẫn System Center; xem `obsidian-knowledge-base/04-Operations-Runbooks/UI-Design-System.md` §5.1.

**PLAN_CHECK:** luồng UX + mô hình dữ liệu có trước giao diện (§2, §3) · GĐ1 dữ liệu/CMS tách khỏi GĐ2 UI (§4.1/§4.2) · không hard-code
chữ/giá/FAQ/nhãn trên `/pricing` (mọi chữ trong `CmsPage`, giá/hạn mức từ `Plan`). Hồ sơ không có chữ nghiệp vụ cần CMS ([HS] đầu trang).

---

## 5. Vấn đề phát hiện cần sửa

| # | Vấn đề | Bằng chứng | Mức | Hướng |
|---|---|---|---|---|
| 1 | **6 cờ tính năng** (`coupons`, `advancedAnalytics`, `advancedBranding`, `seoTools`, `automation`, `customDomain`) đang được `/pricing` quảng cáo như quyền lợi gói trả phí nhưng **không chặn theo gói**; một số có thể chưa tồn tại | ✅ `assertPlanFeature` định nghĩa ở `apps/web/lib/plan-limits.ts:54`, **không có nơi nào gọi** (grep `apps`, `packages`). 🟡 "một số chưa tồn tại" — chưa kiểm từng tính năng | **Cao — rủi ro hứa sai với khách trả tiền** | ADR-041 A.3: chỉ quảng cáo tính năng có thật (bước A3) |
| 2 | **Hạn mức 0 hai nghĩa** | ✅ `isWithinPlanLimit` (`packages/core/src/billing/plan-limits.ts`): `products` → `current < maxProducts` (0 = không được thêm); `storage`/`fileSize` → `<= 0` byte. ✅ `studio/[tenantSlug]/billing/page.tsx` coi `limit === 0` là "không giới hạn". (Tiền lệ khác: `downloadLimit = 0` = không giới hạn, ADR-015) | Trung bình | ADR-041 A.4: 0 = không được phép (bước A3) |
| 3 | **Form hồ sơ `required` SĐT/tỉnh** | ✅ `account/profile/page.tsx` đặt `required` cho `fullName`, `phone`, `province`; ✅ comment schema `UserProfile` ("phone/province tự nguyện") và comment `packages/auth/src/profile.ts` ("không còn dùng để chặn truy cập") nói tuỳ chọn. **Lưu ý:** văn bản ADR-008 trong `docs/DECISIONS.md` vẫn ghi "hồ sơ bắt buộc đủ 4 trường" (chưa được cập nhật theo code) — chính xác là form trái **code/comment hiện hành**, còn ADR-008 cần Quốc ghi bổ sung | Trung bình (dữ liệu cá nhân) | ADR-041 C.1: tuỳ chọn; bổ sung ADR-008 đã ghi (bước B4, B8) |
| 4 | **Đổi mật khẩu không thu hồi phiên, không audit, không email** | ✅ `changePasswordAction` (`account/security/actions.ts`) chỉ `user.update({ passwordHash })` rồi redirect; ✅ `AUDIT_ACTIONS` không có sự kiện đổi mật khẩu/email. 🟡 luồng đặt lại mật khẩu thu hồi mọi refresh token — theo [HS], Long chưa đọc lại | **Cao (bảo mật)** | ADR-041 C.2, bước B3 |
| 5 | **`/account` 404 + thiếu layout** | ✅ `apps/web/app/account/` chỉ có `library/`, `orders/`, `profile/`, `security/` — không `page.tsx`, không `layout.tsx` | Cao | Bước B8 |

Phát hiện phụ (từ [BG]/[HS], ghi để không sót): ✅ `/pricing` chưa dùng `SiteHeader`/`SiteFooter`, chỉ có `page.tsx` (không
`loading`/`error`); ✅ Billing chưa nhận `?plan=`; ✅ Studio không có menu mobile/Đăng xuất (GĐ2b); 🟡 hex cứng ở `account-menu.tsx`,
`studio/layout.tsx`, `settings/page.tsx`, thanh 80% Billing (sửa khi GĐ2 chạm tới).

---

## 6. Bảng quyết định — đã chốt (ADR-041, 2026-10-17)

"Chủ dự án" = câu tiền / dữ liệu cá nhân / bảo mật / test; "Quốc" = câu còn lại. Chỗ ADR-041 không nêu → giữ đề xuất Phong.

### 6.1. A — Bảng giá

| # | Câu hỏi | Kết quả | Người chốt |
|---|---|---|---|
| BG-Q1 | Thẻ Enterprise / "Liên hệ"? | **Không** | Quốc |
| BG-Q2 | Gói năm / nhiều tháng? Quà tặng thêm tháng? | **Gói năm giảm theo %** (`Plan` `YEAR`, ghép cặp trong CMS, % tính từ giá thật); **không** quà tặng | Chủ dự án |
| BG-Q3 | Quảng cáo dòng tính năng nào trong 6 cờ? | **Chỉ tính năng có thật**; dòng gắn cờ chỉ hiện khi cờ đánh dấu "đã triển khai" | Chủ dự án |
| BG-Q4 | Hạn mức 0 nghĩa là gì? | **0 = không được phép**; "không giới hạn" dùng giá trị riêng, sửa Billing cho thống nhất | Chủ dự án |
| BG-Q5 | VAT / hoá đơn VAT? | **Nội dung CMS do admin nhập**, không hard-code | Chủ dự án |
| BG-Q6 | Phí / hoa hồng mỗi đơn? | **Nội dung CMS do admin nhập** | Chủ dự án |
| BG-Q7 | Khách chưa đăng ký bấm gói trả phí? | Đăng ký → mở gian hàng Free → Billing chọn sẵn gói (theo đề xuất) | Quốc |
| BG-Q8 | Đổi gói giữa kỳ? | **Giữ hiện hành**: không tính chênh lệch, kỳ mới nối sau | Chủ dự án |
| BG-Q9 | Về Free khi đang vượt hạn mức Free? | ADR-041 không nêu — FAQ 8 chỉ mô tả đúng code sau khi Hiếu kiểm (❓) | **Còn mở** |
| BG-Q10 | Huỷ / hoàn tiền gói? | **Hoàn 100% trong 7 ngày, chỉ lần thanh toán gói đầu**, admin duyệt + chuyển khoản tay, về Free ngay (§3.3, bước R1–R3) | Chủ dự án |
| BG-Q11 | Gói mới chưa cấu hình CMS? | Tự hiện mặc định | Quốc |
| BG-Q12 | Dải số liệu thật? | Có, số từ DB, 0 → ẩn | Quốc |
| BG-Q13 | Dùng thử gói trả phí? | **Không** | Chủ dự án |
| BG-Q14 | Kênh + giờ hỗ trợ? | **Nội dung CMS do admin nhập**; chưa có dữ kiện thì để trống | Chủ dự án |
| BG-Q15 | Xem trước bản nháp ở GĐ1? | Có, chỉ admin (BG-C6) | Quốc |

FAQ mẫu `[XÁC NHẬN]` của [BG] §3.1: câu 7 (đổi gói) giữ như đề xuất; câu 9 (hoàn tiền) viết theo §3.3; câu 2, 10, 12 (hoa hồng, VAT,
hỗ trợ) để trống cho admin nhập; câu 6 (thời gian xác nhận chuyển khoản) và câu 8 (vượt hạn mức Free) chờ dữ kiện.

### 6.2. B — Hồ sơ

| # | Câu hỏi | Kết quả | Người chốt |
|---|---|---|---|
| HS-Q1 | Một hồ sơ cá nhân, Studio chỉ cài đặt gian hàng? | Đồng ý | Quốc |
| HS-Q2 | Bỏ mục không có nghiệp vụ? | Bỏ | Quốc |
| HS-Q3 | SĐT, Tỉnh/Thành? | **Tuỳ chọn; chỉ chủ tài khoản + admin thấy**, gian hàng không thấy; bỏ `required` (bổ sung ADR-008). Danh sách chọn 34 đơn vị: theo đề xuất | Chủ dự án |
| HS-Q4 | Đổi email (a)–(d)? | **Bảo mật chặt**: nhập lại mật khẩu, link tới email mới (token `EMAIL_CHANGE`), (d) xác nhận được khi chưa đăng nhập, báo email cũ, (b) thu hồi phiên khác; (a) email mới hiện ở Studio — **chấp nhận**. (c) báo "email đã được dùng" + rate-limit: ADR-041 không nêu → theo đề xuất | Chủ dự án |
| HS-Q5 | Đổi mật khẩu thu hồi phiên khác + email? | **Có** — cần mật khẩu cũ, thu hồi mọi phiên khác, email báo | Chủ dự án |
| HS-Q6 | Ảnh đại diện? | **Cloudinary hệ thống, png/jpeg/webp ≤ 2 MB**, không tính hạn mức gói | Chủ dự án |
| HS-Q7 | Ảnh công khai? | **Riêng tư** ở GĐ1; công khai để sau | Chủ dự án |
| HS-Q8 | Tắt email thông báo? | Để sau | Quốc |
| HS-Q9 | Thẻ "Mở gian hàng miễn phí" cho khách? | Có (theo đề xuất) | Quốc |
| HS-Q10 | Danh sách phiên / IP? | **Để sau** (BACKLOG) | Chủ dự án |
| HS-Q11 | `/account` header công khai + `container-page`? | Có (theo đề xuất); ghi bổ sung ADR-024 nếu Quốc thấy cần | Quốc |
| HS-Q12 | Xoá tài khoản? | **Để sau** (BACKLOG) | Chủ dự án |
| HS-Q13 | Thêm test? | **Không thêm** — nợ BACKLOG | Chủ dự án |

---

## 7. Rủi ro, ngân sách test, tác động tài liệu

### 7.1. Rủi ro

1. **Quảng cáo sai quyền lợi gói trả phí** (§5 #1) — `/pricing` hiện đã liệt kê cờ tính năng chưa chặn; GĐ2 phải bỏ các dòng này
   (ADR-041 A.3).
2. **Một DB duy nhất (ADR-034)** — migration B1 chạy thẳng production: chỉ *thêm* enum value + cột nullable; chạy trước khi deploy code
   B5. Thử tay CMS ghi dòng `pricing` thật; Xuất bản ảnh hưởng `/pricing` thật ngay khi GĐ2 lên.
3. **Đổi email** — đơn hàng không lưu bản chụp email (🟡 theo [HS] §1.2): đổi xong Studio mọi gian hàng từng bán cho user thấy email mới;
   mọi thông báo chuyển địa chỉ (HS-Q4a). Thử tay không được gửi email tới địa chỉ thật.
4. **Dữ liệu cá nhân** — `phone`, `province`, `avatarKey`, `newEmail`, `ip`/`userAgent`: không hiển thị cho tenant/khác người; ảnh đại diện
   riêng tư (ADR-041 C.3); SĐT/tỉnh chỉ chủ tài khoản + admin (C.1).
5. **Thu hồi phiên** (B3) — sai `familyId` hiện tại sẽ đăng xuất chính người dùng; cần thử tay hai trình duyệt.
6. **Phụ thuộc chéo** — thẻ "Gian hàng của bạn" (B9) cần BG-C5 (A6); nếu A đi chậm, B9 tạm dùng link Billing không chọn sẵn gói.
7. **`/pricing` hiện đang chạy production** — đổi sang trang CMS phải giữ fallback mặc định khi chưa xuất bản (không 404).
8. **Hoàn tiền là thao tác tiền** — chuyển khoản tay ngoài hệ thống; "Đã hoàn" chỉ ghi nhận. Server tự kiểm điều kiện 7 ngày / lần
   đầu, không tin client. Thử tay không tạo hoá đơn/hoàn tiền thật trên production nếu chưa có kế hoạch dọn dữ liệu.
9. **Đổi nghĩa hạn mức 0** — gói đang để 0 trên prod với ý "không giới hạn" sẽ thành "không được phép"; kiểm dữ liệu trước (A3).

### 7.2. Ngân sách test

✅ `node scripts/count-tests.mjs` (Long chạy 2026-10-17): **93/94 unit, 54/55 integration**. **ADR-041: không thêm test** — số test giữ
93/54. Nợ test ghi vào `docs/BACKLOG.md` khi Quốc giao: (a) unit `parsePricingSections` (dữ liệu hỏng → mặc định, gói thiếu/tắt);
(b) integration action CMS Bảng giá từ chối non-admin; (c) integration đổi mật khẩu thu hồi phiên khác, giữ phiên hiện tại;
(d) integration đổi email (token hết hạn/đã dùng/email bị chiếm); (e) unit ngữ nghĩa hạn mức 0; (f) integration hoàn tiền (ngoài 7 ngày,
không phải lần đầu, về Free).

### 7.3. Tác động tài liệu (Long, sau khi Quốc review từng giai đoạn)

- `docs/DECISIONS.md` (Quốc): ADR-041 **đã ghi** (gồm bổ sung ADR-008). Có thể còn: bổ sung ADR-028 (ảnh đại diện), ADR-024 (khung
  `/account`). KB `01-Architecture-Decisions/`: bản trích ADR-041 khi Quốc duyệt.
- Spec billing (`02-System-Specs/`): gói năm, hoàn tiền gói 7 ngày, ngữ nghĩa hạn mức 0.
- KB `02-System-Specs/`: spec CMS Bảng giá (mới); spec M1/hồ sơ (đổi email, ảnh đại diện Cloudinary thay "R2 `avatars/`", thu hồi phiên
  khi đổi mật khẩu).
- KB `03-API-Contracts/`: `Database-Schema-Reference.md` (`EMAIL_CHANGE`, `newEmail`), `Endpoint-Directory.md` (trang/action mới), danh
  sách audit action.
- KB `04-Operations-Runbooks/UI-Design-System.md`: khu vực `/account` (layout, `AccountSidebarNav`, danh sách mobile, thẻ gói),
  `SortableListEditor`, trang `/pricing`, menu mobile Studio; ghi chú tương phản khi admin đổi màu thương hiệu ([BG] §6.4).
- `docs/BACKLOG.md`: nợ test §7.2, danh sách phiên, tuỳ chọn thông báo, xoá tài khoản, thẻ Enterprise, quà tặng theo kỳ hạn.
- `00-Index/MOC-Home.md`, `Tags-Dictionary.md` khi thêm trang/thẻ.

---

[[MOC-Home]] — chỉ mục KB: `obsidian-knowledge-base/00-Index/MOC-Home.md`

# Đề xuất trang "Bảng giá / Gói tài khoản" `/pricing` — CMS trước, UI sau

- **Người viết:** Phong (UX/UI) · **Ngày:** 2026-10-17 · **Trạng thái:** ĐỀ XUẤT, chưa code, chờ chủ dự án chốt các câu hỏi ở §7.
- **Phạm vi:** trang công khai giới thiệu gói dịch vụ mà **giáo viên/coach (tenant)** mua để mở gian hàng (Platform Billing,
  M3 v2 / ADR-021). Không bàn giá tài liệu mà giáo viên bán cho khách hàng.
- **Nguyên tắc chủ dự án:** UX trước UI. **GĐ1** = CMS trong System Center lưu toàn bộ nội dung vào DB. **GĐ2** = trang công khai
  đọc từ DB. Không hard-code chữ/giá/FAQ. Tên nền tảng ghi là `{tên nền tảng}` (đọc `getEffectiveBrand()`, ADR-032).
- **Căn cứ:** ADR-021, ADR-024, ADR-025, ADR-032, ADR-033, ADR-035; `UI-Design-System.md` §4, §12, §13; code hiện trạng liệt kê ở §1.

---

## 1. Hiện trạng

### 1.1. Những gì đang có

| Thành phần | File | Hiện trạng |
|---|---|---|
| Trang công khai | `apps/web/app/pricing/page.tsx` | H1 "Bảng giá" + 1 câu mô tả (có tên thương hiệu đọc DB) + lưới thẻ gói (1/2/4 cột). Mỗi thẻ: tên, giá (`vi-VN`), "/ N tháng/năm", dòng "Không bao giờ hết hạn" cho gói Free, 3 hạn mức (sản phẩm, dung lượng, file tối đa) + tính năng đang bật. Empty state 1 dòng chữ. Đã dùng `container-page`. |
| Loader | `apps/web/lib/pricing.ts` → `getActivePlans()` | `Plan` với `isActive = true`, sắp theo giá tăng dần. |
| Quản trị gói | `apps/web/app/admin/plans/**` | Bảng gói + form: mã, tên, giá, chu kỳ (`MONTH`/`YEAR`), số chu kỳ, 4 hạn mức, cờ Free (chỉ 1 gói Free đang bật), 6 cờ tính năng. Bật/tắt gói. Lưu xong `revalidatePath("/pricing")`. |
| Model `Plan` | `packages/db/prisma/schema.prisma` | `code, name, priceVnd (Int), interval, intervalCount, maxProducts, storageMb, maxFileMb, imageStorageMb, isFree, features Json, isActive`. **Mỗi dòng = một chu kỳ duy nhất**, không có trường nhóm gói. |
| Mua/nâng cấp | `apps/web/app/studio/[tenantSlug]/billing/**` | Thẻ gói hiện tại + thanh hạn mức (cảnh báo ở 80%), form "Gia hạn / Nâng cấp" (chọn gói trả phí + phương thức thanh toán đang bật: QR chuyển khoản thủ công / SePay / MoMo), hoá đơn chờ (QR hoặc link), lịch sử hoá đơn. |
| Nghiệp vụ đổi gói | `apps/web/lib/subscription-billing.ts` | Hoá đơn tạo theo gói chọn; **đổi gói có hiệu lực ngay khi thanh toán, không tính chênh lệch (no proration)**; kỳ mới nối tiếp `currentPeriodEnd` nếu kỳ cũ còn hạn. Hết hạn → ân hạn (`GRACE`) → **về Free** (ADR-021, không mất dữ liệu). |
| Mẫu CMS | `apps/web/app/admin/cms/shop/**`, `packages/core/src/admin/shop-sections.ts` | `CmsPage` slug cố định, `blocks` (bản live) / `blocksDraft` (nháp), mảng section `{ id, type, visible, data }`, schema chặt lúc lưu + parse phòng thủ lúc đọc, Lưu nháp / Xuất bản / Khôi phục, editor 2 cột. |
| Số liệu thật | `apps/web/lib/home.ts` → `getHomeStats()` | Số gian hàng hoạt động, tài liệu công khai, lượt mua, đánh giá (ADR-033, ô = 0 thì ẩn). Dùng lại được. |

### 1.2. Thiếu gì / vấn đề phát hiện

| # | Vấn đề | Mức | Ghi chú |
|---|---|---|---|
| H1 | Không có header/footer hệ thống (`SiteHeader`/`SiteFooter`) — trang "cụt", không quay lại được trang chủ. Header đã có mục "Bảng giá" (`SiteNavKey = "pricing"`). | Cao | ADR-025 |
| H2 | Toàn bộ chữ (tiêu đề, nhãn tính năng `FEATURE_LABELS`) hard-code; không có tagline, nhãn "Phổ biến nhất", quyền lợi, FAQ, CTA. | Cao | Trái nguyên tắc CMS trước |
| H3 | **Không có nút hành động** trên thẻ gói — khách không biết bấm đâu để đăng ký/nâng cấp. | Cao | Mất chuyển đổi |
| H4 | Màu chữ dùng `text-gray-*` cố định, viền gói Free dùng `--color-primary` (không phải token `--brand-*`). | Trung bình | Token |
| H5 | Không có `loading.tsx`/`error.tsx`; empty state chỉ 1 dòng chữ. | Trung bình | Chuẩn trạng thái |
| H6 | **6 cờ tính năng chưa được chặn ở đâu cả:** `assertPlanFeature()` (`apps/web/lib/plan-limits.ts`) **không có nơi nào gọi**. Trang đang quảng cáo "Mã giảm giá", "Tên miền riêng", "Công cụ SEO", "Tự động hoá"… như quyền lợi riêng của gói trả phí, trong khi thực tế không gói nào bị chặn và một số tính năng có thể chưa tồn tại. | **Cao — rủi ro quảng cáo sai** | Câu hỏi Q3 |
| H7 | Ý nghĩa hạn mức = 0 không thống nhất: `isWithinPlanLimit` coi 0 là "không được phép" (`current < 0` sai), còn trang Billing Studio hiển thị 0 là "không giới hạn". Bảng so sánh cần biết hiển thị "Không giới hạn" hay "0". | Trung bình | Câu hỏi Q4 |
| H8 | Trang Billing Studio không nhận gói chọn sẵn từ URL — bấm "Nâng cấp lên Pro" trên `/pricing` sẽ rơi vào form mặc định chọn gói hiện tại. | Trung bình | Contract C5 |
| H9 | Không có toggle tháng/năm: `Plan` không có cách nhóm "Pro tháng" và "Pro năm" thành một gói. | Thấp (chỉ cần nếu chủ dự án muốn) | Q2 |
| H10 | `CmsPage` slug `pricing` chưa nằm trong `SYSTEM_CMS_SLUGS` — form CMS chung vẫn tạo được trang `/p/pricing` trùng ý nghĩa. | Thấp | Contract C1 |

---

## 2. UX trước

### 2.1. Đối tượng và câu hỏi họ mang tới trang

| Đối tượng | Bối cảnh vào trang | Câu hỏi chính | Hành động mong muốn |
|---|---|---|---|
| **A. Khách chưa đăng ký** (giáo viên/coach đang cân nhắc) | Từ trang chủ, header "Bảng giá", tìm kiếm, link chia sẻ | Có miễn phí thật không? Bán được ngay không? Tiền về đâu? Mất phí gì? | Đăng ký miễn phí → mở gian hàng |
| **B. Đã đăng ký, chưa mở gian hàng** | Bỏ dở onboarding | Như A | Vào `/studio` hoàn tất mở gian hàng |
| **C. Tenant gói Free muốn nâng cấp** | Chạm hạn mức (thanh 80% ở Billing), gợi ý nâng cấp | Gói nào đủ cho tôi? Nâng cấp mất bao lâu, có mất dữ liệu không? Thanh toán thế nào? | Chọn gói → tới Billing Studio với gói chọn sẵn |
| **D. Tenant đã trả phí** | Xem lại quyền lợi, cân nhắc lên gói cao hơn hoặc gia hạn | Đang ở gói nào? Nâng lên có tính chênh lệch không? Hết hạn thì sao? | Gia hạn / nâng cấp, hoặc chỉ đọc |

### 2.2. Hành trình chính

```
A/B: Trang chủ → /pricing → đọc thẻ gói (Free nổi bật "Miễn phí mãi mãi")
     → [Bắt đầu miễn phí] → /register → xác minh email → /studio (mở gian hàng, tự gán gói Free)
     → (sau này chạm hạn mức) → Billing Studio → nâng cấp

C:   Studio/Billing (cảnh báo 80%) → link "So sánh các gói" → /pricing (thấy nhãn "Gói hiện tại" trên Free)
     → [Nâng cấp lên Pro] → /studio/{slug}/billing?plan={planId} (form chọn sẵn Pro) → chọn phương thức → QR/MoMo
     → thanh toán → trang Billing tự làm mới (BillingPoll) → "Đang hoạt động"

D:   /pricing → thấy "Gói hiện tại" + ngày hết hạn ngắn gọn → [Gia hạn] hoặc [Nâng cấp] → Billing Studio
```

### 2.3. CTA theo trạng thái người xem (một nút chính mỗi thẻ — skill `primary-action`)

| Trạng thái người xem | Thẻ gói Free | Thẻ gói trả phí khác gói hiện tại | Thẻ gói hiện tại |
|---|---|---|---|
| Chưa đăng nhập | **Bắt đầu miễn phí** → `/register` | **Chọn gói {Tên}** → `/register?next=/studio` (sau khi có gian hàng mới nâng cấp) — xem Q7 | — |
| Đã đăng nhập, chưa có gian hàng | **Mở gian hàng miễn phí** → `/studio` | **Mở gian hàng trước** → `/studio` (giải thích dòng phụ: "Gian hàng bắt đầu ở gói Free, nâng cấp sau 1 bước") | — |
| Có gian hàng, đang Free | Nhãn **Gói hiện tại** (không phải nút) | **Nâng cấp lên {Tên}** → `/studio/{slug}/billing?plan={id}` | (Free) |
| Có gian hàng, đang trả phí | Dòng chữ "Tự động áp dụng khi gói trả phí hết hạn" (không có nút — Billing không cho chọn Free) | Giá cao hơn: **Nâng cấp lên {Tên}**; giá thấp hơn: **Chuyển sang {Tên}** (kèm ghi chú "áp dụng ngay khi thanh toán") — Q8 | Nhãn **Gói hiện tại** + "Hết hạn {dd/mm/yyyy}" + nút phụ **Gia hạn** |
| Có hoá đơn đang chờ thanh toán | — | Nút đổi thành **Xem hoá đơn đang chờ** → Billing (tránh tạo hoá đơn trùng — logic đã dedupe) | như trên |

- Nhãn CTA mặc định nằm trong CMS (§4.3, khối `plans.ctaLabels`), chỉ đích đến do code quyết theo trạng thái.
- "Gói hiện tại" phải là chữ + icon, không chỉ đổi màu viền (skill `color-not-only`).
- Một user có nhiều gian hàng (nếu có): dùng gian hàng mà `/studio` chọn mặc định; không làm bộ chọn gian hàng trên `/pricing`.

### 2.4. Toggle chu kỳ tháng/năm — chỉ làm khi có dữ liệu

- Hiện **mỗi `Plan` một chu kỳ**. Muốn toggle cần biết "Pro 1 tháng" và "Pro 12 tháng" là cùng một gói. Hai cách:
  - **(T1, đề xuất)** CMS ghép cặp: mỗi thẻ gói trong CMS có `planId` (chu kỳ chính) + `altPlanId` (chu kỳ dài). Không đổi schema.
    Admin tạo thêm `Plan` "Pro năm" ở `/admin/plans` như bình thường; Billing Studio tự liệt kê được (đã lấy mọi gói trả phí đang bật).
  - (T2) Thêm cột `Plan.tierCode` để nhóm — cần migration, đụng form gói. Chỉ nên làm nếu sau này có > 2 chu kỳ/gói.
- **Phần trăm tiết kiệm luôn tính từ giá thật** (`floor((giá tháng × số tháng − giá năm) × 100 / (giá tháng × số tháng))`, số nguyên),
  không cho admin gõ tay "-20%"/"-40%". Không có cặp nào → ẩn toggle.
- Toggle = nhóm radio 2 lựa chọn (`fieldset` + `legend` ẩn "Chu kỳ thanh toán"), không dùng switch (2 giá trị có tên, không phải bật/tắt).
- **Quà tặng theo thời hạn (mẫu TaiLieu.vn: tặng thêm tháng khi mua 3/6/12 tháng)** ảnh hưởng kỳ hạn = tiền → cần nghiệp vụ mới ở
  `computeRenewalPeriod`, **không** làm bằng chữ trong CMS. Xem Q2.

---

## 3. Cấu trúc section đề xuất (thứ tự mặc định, admin đổi được)

Đối chiếu skill `--domain landing` mẫu *Pricing Page + CTA*: Hero → Thẻ gói → Bảng so sánh → FAQ → CTA cuối; bổ sung dải số liệu
thật, "Vì sao chọn", phương thức thanh toán theo mẫu chủ dự án gửi.

| # | Section (`type`) | Mục đích | Nguồn dữ liệu | Nội dung mẫu (tiếng Việt, admin sửa được) |
|---|---|---|---|---|
| 1 | **Hero** `hero` | Nói rõ giá trị trong 5 giây, gỡ nỗi lo "mất tiền" | CMS | Eyebrow: "Bảng giá minh bạch". Tiêu đề: "Mở gian hàng tài liệu miễn phí, nâng cấp khi bạn bán nhiều hơn". Mô tả: "Bắt đầu với gói Miễn phí không giới hạn thời gian. Tiền bán tài liệu chuyển thẳng vào tài khoản của bạn." Huy hiệu (tuỳ chọn): "Không cần thẻ thanh toán". |
| 2 | **Thẻ gói** `plans` | So sánh nhanh, chọn gói | Giá/hạn mức: `Plan`. Tagline, nhãn, quyền lợi, CTA: CMS | Free — tagline "Thử bán những tài liệu đầu tiên", quyền lợi: "Gian hàng riêng với đường dẫn của bạn", "Nhận tiền trực tiếp qua QR ngân hàng/MoMo". Gói giữa — nhãn **"Phổ biến nhất"**, tagline "Cho giáo viên đã có học trò mua đều đặn". Gói cao — tagline "Cho trung tâm, nhóm giáo viên có kho tài liệu lớn". (Tên gói và giá luôn lấy từ `Plan`.) |
| 3 | **Ghi chú giá** `priceNote` | Minh bạch VAT, chu kỳ, cách tính khi đổi gói | CMS | "Giá tính bằng VNĐ cho mỗi kỳ, {đã/chưa} gồm VAT." · "Đổi gói có hiệu lực ngay sau khi thanh toán, không tính chênh lệch kỳ cũ." · "Hết hạn không gia hạn: gian hàng tự chuyển về gói Miễn phí, giữ nguyên dữ liệu." (câu VAT chờ Q5) |
| 4 | **Số liệu thật** `stats` | Bằng chứng xã hội | `getHomeStats()` (ADR-033), CMS chỉ lưu nhãn + bật/tắt từng ô | "{n}+ giáo viên & coach đang bán", "{n}+ tài liệu", "{n}+ lượt mua", "{n}+ đánh giá". Ô = 0 ẩn; cả dải 0 → ẩn section. Định dạng `formatStat` (làm tròn xuống, "Hơn 1.200"). **Không nhập số tay.** |
| 5 | **Bảng so sánh** `comparison` | So sánh đầy đủ cho người cân nhắc kỹ | Dòng hạn mức: cột `Plan`. Dòng tính năng: `Plan.features`. Dòng tự do: CMS | Nhóm "Giới hạn sử dụng": Số tài liệu đang bán · Dung lượng tệp · Kích thước một tệp · Dung lượng ảnh. Nhóm "Bán hàng": Gian hàng riêng (tự do: ✓ mọi gói) · Nhận tiền trực tiếp vào tài khoản của bạn (✓ mọi gói) · Mã giảm giá (`coupons`)… Nhóm "Hỗ trợ": Kênh hỗ trợ (tự do, chữ theo từng gói). Đầu cột: tên gói + giá + nút CTA (như mẫu TaiLieu.vn). |
| 6 | **Vì sao chọn** `reasons` | Gỡ phản đối, khác biệt | CMS (3–6 thẻ, icon chọn từ danh sách SVG có sẵn) | "Không giữ tiền của bạn — khách thanh toán thẳng vào tài khoản bạn khai báo." · "Tệp tài liệu được bảo vệ — link tải có thời hạn, không lộ đường dẫn gốc." · "Gian hàng mang thương hiệu của bạn." · "Bắt đầu miễn phí, không giới hạn thời gian." · "Hạ gói không mất dữ liệu." · "Hỗ trợ bằng tiếng Việt." |
| 7 | **FAQ** `faq` | Trả lời câu hỏi trước khi mua | CMS (danh sách có thứ tự) | Xem §3.1 |
| 8 | **CTA cuối** `ctaFinal` | Chốt hành động | CMS (chữ), code (đích theo trạng thái) | "Sẵn sàng bán tài liệu đầu tiên?" · "Mở gian hàng trong vài phút, không mất phí." · Nút "Bắt đầu miễn phí". |
| 9 | **Phương thức thanh toán** `paymentMethods` | Tin cậy khi trả phí nâng cấp | Danh sách = cổng **platform đang bật** (`getEnabledPlatformProviders()`); CMS lưu tiêu đề + mô tả + (tuỳ chọn) nhãn hiển thị từng cổng | "Thanh toán gói bằng: Chuyển khoản QR ngân hàng · Ví MoMo". Hiển thị bằng chữ + icon chung (thẻ/QR/ví), **không** dùng logo thương hiệu bên thứ ba khi chưa có bộ asset chính thức. Không cổng nào bật → ẩn section. |

Section nào không có dữ liệu (số liệu = 0, FAQ rỗng, không cổng thanh toán, không gói) thì **tự ẩn** trên trang, cùng quy tắc ADR-035.

### 3.1. FAQ đề xuất (12 câu — `[XÁC NHẬN]` = cần chủ dự án duyệt nội dung nghiệp vụ)

| # | Câu hỏi | Câu trả lời mẫu | Khớp nghiệp vụ |
|---|---|---|---|
| 1 | Gói Miễn phí có thời hạn không? | Không. Gói Miễn phí dùng mãi mãi, không cần thẻ thanh toán. Bạn vẫn đăng và bán tài liệu bình thường trong giới hạn của gói. | ADR-021 ✓ |
| 2 | Tiền khách mua tài liệu chuyển về đâu? | Thẳng vào tài khoản ngân hàng/ví MoMo mà bạn khai báo trong Studio. {tên nền tảng} không giữ hộ tiền bán tài liệu của bạn. | `TenantPaymentConfig` ✓ — **[XÁC NHẬN]** có thu phí/hoa hồng trên mỗi đơn không (Q6) |
| 3 | Khi nào tôi nên nâng cấp? | Khi bạn cần đăng nhiều tài liệu hơn, cần thêm dung lượng hoặc tải lên tệp lớn hơn. Trang Gói dịch vụ trong Studio báo trước khi bạn dùng gần hết hạn mức. | Thanh 80% ✓ |
| 4 | Nâng cấp như thế nào? | Vào Studio → Gói dịch vụ, chọn gói và phương thức thanh toán. Thanh toán xong, gói mới có hiệu lực ngay. | ✓ |
| 5 | Có những hình thức thanh toán nào? | Chuyển khoản qua mã QR ngân hàng và ví MoMo (tuỳ phương thức đang mở). | Theo cổng platform đang bật — nên để câu này **tự sinh danh sách** hoặc admin sửa khi đổi cổng |
| 6 | Làm sao biết tôi đã thanh toán thành công? | Trang Gói dịch vụ tự cập nhật trạng thái "Đã thanh toán" và ngày hết hạn mới. Với chuyển khoản thủ công, quản trị viên xác nhận trong giờ làm việc. | `BillingPoll` + xác nhận thủ công ✓ — **[XÁC NHẬN]** cam kết thời gian xác nhận; có email xác nhận không |
| 7 | Nâng cấp giữa kỳ thì phần còn lại của gói cũ tính sao? | Gói mới áp dụng ngay khi thanh toán. Thời gian còn lại của kỳ cũ được cộng nối: kỳ mới bắt đầu từ ngày kỳ cũ kết thúc. Hệ thống không tính chênh lệch giá. | Đúng code `computeRenewalPeriod` + `markInvoicePaid` — **[XÁC NHẬN]** đây có phải chính sách mong muốn (Q8) |
| 8 | Hết hạn mà chưa gia hạn thì sao? Có mất dữ liệu không? | Bạn có {N} ngày ân hạn để gia hạn. Sau đó gian hàng tự chuyển về gói Miễn phí; tài liệu và đơn hàng vẫn giữ nguyên. | ADR-021 ✓ — số ngày ân hạn đọc `getSystemSettings().graceDays` (không gõ cứng). **[XÁC NHẬN]** tài liệu vượt hạn mức Free xử lý thế nào (Q9) |
| 9 | Tôi có thể hủy gói và được hoàn tiền không? | {Chính sách hoàn tiền}. | **[XÁC NHẬN]** — hiện chưa có luồng hoàn tiền gói trong code (Q10) |
| 10 | Có xuất hoá đơn VAT không? | {Chính sách hoá đơn}. | **[XÁC NHẬN]** — chưa có chức năng hoá đơn điện tử (Q5) |
| 11 | Gói có tự động gia hạn không? | Không. Trước khi hết hạn 7 ngày và 1 ngày, bạn nhận được nhắc nhở để chủ động gia hạn. | Không lưu thẻ, nhắc 7/1 ngày (`periodEndReminderStage`) ✓ — kiểm lại kênh nhắc (email) |
| 12 | Cần hỗ trợ thì liên hệ ở đâu? | {Kênh hỗ trợ}. | **[XÁC NHẬN]** kênh + giờ hỗ trợ |

---

## 4. Mô hình dữ liệu cho CMS (GĐ1)

### 4.1. (a) Dữ liệu nghiệp vụ đã có ở `Plan` — UI đọc trực tiếp, **không nhập lại** trong CMS

| Trường `Plan` | Dùng ở trang | Định dạng hiển thị |
|---|---|---|
| `name` | Tên gói trên thẻ, đầu cột bảng | nguyên văn |
| `priceVnd`, `isFree` | Giá | `0` → "Miễn phí"; khác → `199.000 ₫` (`Intl.NumberFormat("vi-VN")`, số nguyên) |
| `interval`, `intervalCount` | Đơn vị kỳ | "/ tháng", "/ 3 tháng", "/ năm" |
| `maxProducts`, `storageMb`, `maxFileMb`, `imageStorageMb` | 3–4 dòng hạn mức trên thẻ + nhóm "Giới hạn" của bảng | "50 tài liệu", "5 GB" (≥1.024 MB đổi GB, 1 chữ số thập phân kiểu vi-VN), "Không giới hạn" nếu chốt Q4 |
| `features` | Dòng ✓/✗ của bảng so sánh | ✓ "Có" / ✗ "Không" — icon + chữ `sr-only` |
| `isActive` | Gói tắt không hiển thị | — |

Giá và hạn mức chỉ có **một nguồn** (`/admin/plans`) — sửa giá ở đó là trang Bảng giá đổi theo, không lệch giữa trang và hoá đơn.

### 4.2. (b) Dữ liệu marketing theo từng gói — lưu ở đâu?

Trường cần: tagline, nhãn nổi bật ("Phổ biến nhất"), đánh dấu thẻ nổi bật (tối đa 1), thứ tự hiển thị, ẩn/hiện trên trang, danh sách
quyền lợi gạch đầu dòng, nhãn CTA riêng (tuỳ chọn), ghi chú nhỏ dưới giá, gói ghép cặp chu kỳ dài (`altPlanId`, nếu làm toggle).

| Phương án | Mô tả | Ưu | Nhược |
|---|---|---|---|
| **P1 — Cột/JSON trên `Plan`** (`tagline`, `badge`, `sortOrder`, `isListed`, `marketing Json`) | Sửa trong form `/admin/plans` | Một chỗ cho mọi thứ về gói; xoá/tắt gói thì nội dung đi theo | **Cần migration** (ADR-034: Quốc duyệt, expand); không có nháp/xuất bản — sửa chữ là lên trang ngay; trộn chữ marketing với bảng L1 nghiệp vụ, audit `PLAN_UPDATED` lẫn thay đổi chữ |
| **P2 — Trong `CmsPage` slug `pricing`, khối `plans.items[]` gắn `planId`** (đề xuất) | Editor CMS Bảng giá liệt kê gói đang bật (giá/hạn mức chỉ đọc), admin sửa phần marketing | **Không DDL**; dùng chung nháp/xuất bản/khôi phục + SEO với toàn trang; thứ tự thẻ = thứ tự mảng; đúng mẫu `home`/`shop` | `planId` có thể "mồ côi" khi gói bị tắt → parse phòng thủ bỏ qua + editor báo "Gói đang tắt"; gói mới bật nhưng chưa có trong CMS → cần quy tắc mặc định (dưới) |

**Đề xuất P2.** Quy tắc phòng thủ khi render:
1. Thẻ hiển thị theo thứ tự `plans.items[]`, bỏ mục `visible: false` và mục có `planId` không còn `isActive`.
2. Gói đang bật **chưa có** trong `items[]` → thêm **cuối danh sách, đang hiện**, chỉ có tên/giá/hạn mức tự động (không tagline/quyền lợi).
   Lý do: gói đang bán được ở Billing thì trang giá không nên giấu. (Ngược với ADR-035 "section thiếu → ẩn" — xem Q11.)
3. Chưa có/chưa xuất bản `CmsPage` `pricing` → trang dùng cấu hình mặc định trong code (không 404), giống `shop`.

### 4.3. (c) Nội dung trang — `CmsPage` slug `pricing`

`blocks` (live) / `blocksDraft` (nháp), `seoTitle` / `seoDescription`, mảng `{ id, type, visible, data }`, mỗi `type` tối đa 1 lần.
Schema đặt ở `packages/core/src/admin/pricing-sections.ts` (subpath `@gieochu/core/pricing-sections`, mẫu `shop-sections.ts`).
Giới hạn ký tự là gợi ý, Hiếu chốt cùng schema.

| `type` | Trường `data` | Ràng buộc gợi ý |
|---|---|---|
| `hero` | `eyebrow`, `title`, `subtitle`, `badge?` | 60 / 120 / 240 / 40 ký tự |
| `plans` | `title?`, `subtitle?`, `showAutoLimits: boolean` (hiện dòng hạn mức tự động trên thẻ), `ctaLabels: { signup, openStore, upgrade, switch, renew, current, pendingInvoice }`, `cycleToggle?: { enabled, primaryLabel, altLabel, savingsTemplate }` (chỉ khi chốt Q2; `savingsTemplate` chứa `{percent}`), `items: PlanCardItem[]` | `items` ≤ 8; tối đa 1 `highlighted` |
| ↳ `PlanCardItem` | `planId`, `altPlanId?`, `visible`, `highlighted`, `badge?` ("Phổ biến nhất"), `tagline?`, `benefits: string[]`, `ctaLabel?` (ghi đè), `note?` | `benefits` ≤ 8 × 100 ký tự; `tagline` 120; `badge` 30; `note` 120; `altPlanId` phải khác `planId`, cùng không phải Free |
| `priceNote` | `lines: string[]` | 1–4 dòng × 200 ký tự |
| `stats` | `title`, `items: { key: HomeStatKey, label, visible }[]` | `key` ∈ `tenants/products/sold/reviews` (dùng lại enum trang chủ); **không có trường số** |
| `comparison` | `title`, `subtitle?`, `showPlanHeaderCta: boolean`, `groups: ComparisonGroup[]` | ≤ 6 nhóm |
| ↳ `ComparisonGroup` | `id`, `title`, `rows: ComparisonRow[]` | ≤ 15 dòng/nhóm |
| ↳ `ComparisonRow` (union theo `kind`) | `limit`: `{ id, kind, field: "maxProducts"\|"storageMb"\|"maxFileMb"\|"imageStorageMb", label, hint? }` · `feature`: `{ id, kind, featureKey: PlanFeatureKey, label, hint? }` · `custom`: `{ id, kind, label, hint?, cells: Record<planId, { value: "yes"\|"no"\|"text", text? }>, fallback: "yes"\|"no"\|"dash" }` | `label` 80, `hint` 160, `text` 60. `fallback` dùng cho gói chưa có ô (gói mới thêm) |
| `reasons` | `title`, `subtitle?`, `items: { icon: ReasonIconKey, title, description }[]` | 3–6 mục; `icon` là key trong danh sách cố định (map sang `admin/_ui/icons.tsx`, ADR §8.5 truyền icon bằng key chuỗi) |
| `faq` | `title`, `items: { id, question, answer }[]` | ≤ 20 mục; câu hỏi 200, trả lời 1.500 ký tự **văn bản thuần** (xuống dòng giữ nguyên; không HTML để khỏi phải sanitize và dùng được cho JSON-LD) |
| `ctaFinal` | `title`, `description`, `buttonLabel?` (trống → dùng `ctaLabels` theo trạng thái) | 120 / 300 / 40 |
| `paymentMethods` | `title`, `description?`, `labels?: Partial<Record<PaymentProviderId, string>>` | Danh sách cổng do code đọc, CMS chỉ đổi nhãn |

Lưu ý dữ liệu động trong chữ: chỉ hỗ trợ **2 biến** thay thế lúc render — `{brand}` (tên nền tảng) và `{graceDays}` (số ngày ân hạn
từ `getSystemSettings()`), để câu FAQ 8 không lệch khi admin đổi cấu hình. Không mở rộng thành template engine.

---

## 5. Bố cục editor CMS `/admin/cms/pricing`

Tái dùng nguyên pattern editor Cửa hàng (`UI-Design-System.md` §13.3): wrapper `<div>`, `Notice` trạng thái đầu trang, **thanh trạng
thái dính** (huy hiệu Đã xuất bản / Có nháp / Có thay đổi chưa lưu, Lưu lần cuối; nút Xem trang · Khôi phục · Lưu nháp · **Xuất bản**),
lưới `xl:grid-cols-[320px_minmax(0,1fr)]`: trái danh sách 9 khu vực (con mắt ẩn/hiện, nút Lên/Xuống thay kéo-thả — WCAG 2.5.7), phải
form khu vực đang chọn; khung tóm tắt lỗi nhận focus; cảnh báo rời trang khi chưa lưu; `loading.tsx` cùng khung.
Menu System Center nhóm nội dung: "Trang CMS" → "Trang Cửa hàng" → **"Trang Bảng giá"** (icon SVG mới, ví dụ thẻ giá) → "Danh mục tài liệu".

### 5.1. Form từng khu vực

| Khu vực | Bố cục form | Điểm UX riêng |
|---|---|---|
| Hero | `ShopTextField` × 4 (dùng lại, có bộ đếm ký tự) | — |
| **Thẻ gói** | Mỗi gói là một thẻ có thể thu gọn (`<details>`), tiêu đề thẻ = "{Tên gói} · {giá} · {Đang bật/Đang tắt}". Trong thẻ: khung **chỉ đọc** "Giá & hạn mức (sửa ở Gói dịch vụ →)" link tới `/admin/plans/{id}`; dưới là tagline, nhãn, radio "Thẻ nổi bật" (radio chung cả nhóm → đảm bảo tối đa 1), danh sách quyền lợi, nhãn CTA ghi đè, ghi chú, (nếu bật toggle) chọn gói ghép cặp. Nút Lên/Xuống đổi thứ tự gói, con mắt ẩn/hiện. Khối "Nhãn nút theo trạng thái" (7 ô) ở cuối. | `LiveDataNote`: "Tên, giá, hạn mức và tính năng lấy từ Gói dịch vụ — không nhập ở đây." Gói đang bật chưa có trong cấu hình → hiện ở cuối với nhãn "Mới — đang dùng nội dung mặc định". Gói đã tắt → nhãn chữ "Gói đang tắt — không hiển thị", có nút "Bỏ khỏi cấu hình". |
| Ghi chú giá | Danh sách dòng chữ (thêm/xoá/lên/xuống) | — |
| Số liệu | 4 dòng cố định: bật/tắt + nhãn; cột phụ hiện **số thật hiện tại** (chỉ đọc) và chú thích "= 0 sẽ tự ẩn" | Admin thấy ngay ô nào đang ẩn vì 0 |
| **Bảng so sánh** | Danh sách nhóm (thêm/xoá/lên/xuống, sửa tên); mỗi nhóm có danh sách dòng. "Thêm dòng" mở chọn **loại dòng** bằng `RadioCardGroup`: *Hạn mức gói* (chọn trường) · *Tính năng gói* (chọn cờ) · *Tự nhập*. Dòng tự nhập hiện lưới ô theo từng gói đang bật: chọn Có / Không / Chữ (+ ô chữ). | Dòng loại *Hạn mức*/*Tính năng* hiển thị xem trước giá trị thật từng gói ngay trong editor (chỉ đọc) để admin thấy bảng sẽ ra sao. Cờ tính năng chưa được hệ thống chặn (H6) → hiện cảnh báo chữ cạnh lựa chọn cho tới khi Q3 được chốt. |
| Vì sao chọn | Danh sách thẻ: chọn icon (lưới nút icon có `aria-pressed` + tên chữ), tiêu đề, mô tả | 3–6 mục, nút "Thêm" tắt khi đủ 6 |
| **FAQ** | Danh sách câu hỏi thu gọn được; mỗi mục: câu hỏi + ô trả lời nhiều dòng, nút Lên/Xuống/Xoá (xoá có xác nhận) | Bộ đếm ký tự; "Thêm câu hỏi" focus vào ô câu hỏi mới; gợi ý biến `{brand}`, `{graceDays}` ngay dưới ô |
| CTA cuối | 3 ô chữ | Ghi chú: đích nút tự đổi theo người xem |
| Phương thức thanh toán | Tiêu đề, mô tả; bảng các cổng **đang bật** kèm ô nhãn hiển thị | Không cổng nào bật → `Notice warning` "Chưa bật cổng thanh toán nền tảng — khu vực này sẽ ẩn" + link `/admin/settings/...payment` |

**Thành phần mới cần làm (Phong):** `SortableListEditor` — danh sách mục có Lên/Xuống/Xoá/Thêm dùng chung cho quyền lợi, ghi chú giá,
nhóm/dòng so sánh, FAQ (thay `ArrayObjectEditor` hiện chưa có đổi thứ tự và chưa đạt 44px/focus ring). Đặt ở `app/admin/cms/_ui/`.

### 5.2. Xem trước

- Nút **"Xem trước bản nháp"** mở `/pricing?xem-truoc=nhap` ở tab mới: chỉ `SYSTEM_ADMIN` thấy bản nháp, có dải báo "Bạn đang xem bản
  nháp — chưa công khai", `noindex`; người khác thấy bản live. CTA trong chế độ xem trước hiển thị theo trạng thái "Chưa đăng nhập"
  để admin thấy giao diện khách. (Cần Hiếu làm guard — contract C6.)
- Phương án nhẹ hơn nếu Quốc muốn giữ phạm vi GĐ1 nhỏ: chỉ có "Xem trang" (bản live) như editor Cửa hàng.

---

## 6. Giai đoạn 2 — UI trang công khai

Khung: `SiteHeader current="pricing"` + `SiteFooter`, font qua `systemFontVars`, nội dung `container-page` (ADR-024), nền section
full-bleed xen kẽ `background` / `surface`. Màu chỉ qua `brandColors` (`var(--brand-*)`); không hex rời. Một CTA chính cho mỗi thẻ.

### 6.1. Wireframe chữ — desktop (≥1024px)

```
[SiteHeader — "Bảng giá" đang chọn]
┌ HERO (nền background) ─────────────────────────────────────────────┐
│ eyebrow · H1 (Be Vietnam Pro) · mô tả (≤ 60ch) · [huy hiệu]         │
│                 ( Theo tháng | Theo năm  Tiết kiệm 16% )  ← chỉ khi có cặp
└─────────────────────────────────────────────────────────────────────┘
┌ THẺ GÓI — lưới 4 cột (3 cột nếu 3 gói), cao bằng nhau ─────────────┐
│ [Free]        [Creator]      [★ Phổ biến nhất ]   [Business]        │
│ tagline       tagline        [Pro — viền accent]  tagline           │
│ Miễn phí      99.000 ₫/tháng 199.000 ₫/tháng      499.000 ₫/tháng   │
│ "Không bao    ghi chú        ghi chú              ghi chú           │
│  giờ hết hạn"                                                       │
│ [Bắt đầu      [Nâng cấp]     [Nâng cấp — nút      [Nâng cấp]        │
│  miễn phí]                    accent]                               │
│ ─ hạn mức tự động (3–4 dòng, icon + chữ)                            │
│ ─ quyền lợi (≤ 8 dòng, icon check SVG)                              │
│ "Gói hiện tại" = huy hiệu chữ + icon ở đầu thẻ, thay nút           │
└─────────────────────────────────────────────────────────────────────┘
  Ghi chú giá (2–4 dòng chữ nhỏ inkSoft, căn giữa)
┌ SỐ LIỆU (nền primary, chữ trắng) — 2–4 ô, ô 0 ẩn ───────────────────┐
┌ BẢNG SO SÁNH ───────────────────────────────────────────────────────┐
│ <caption> So sánh đầy đủ các gói                                    │
│ thead (dính khi cuộn trong bảng): Tính năng | Free | … (tên+giá+nút)│
│ tbody theo nhóm: hàng tiêu đề nhóm <th colspan scope="colgroup">    │
│   dòng: <th scope="row">nhãn (+ hint)</th> | ô giá trị | …          │
└─────────────────────────────────────────────────────────────────────┘
┌ VÌ SAO CHỌN — lưới 3×2 thẻ (icon SVG + tiêu đề H3 + mô tả) ─────────┐
┌ FAQ — container-prose, accordion <details> ─────────────────────────┐
┌ CTA CUỐI (nền primaryDeep) — tiêu đề, mô tả, 1 nút ─────────────────┐
┌ PHƯƠNG THỨC THANH TOÁN — hàng chip icon + chữ ──────────────────────┐
[SiteFooter]
```

### 6.2. Wireframe chữ — mobile (~375px)

```
Header (menu mobile có sẵn)
Hero: H1 ~28px, mô tả, toggle chu kỳ full-width (2 nút ≥ 44px)
Thẻ gói: xếp dọc 1 cột. Thứ tự: thẻ nổi bật KHÔNG đẩy lên đầu (giữ thứ tự giá tăng dần
  để so sánh theo nhịp đọc); nếu người xem đang có gói, thẻ "Gói hiện tại" giữ đúng vị trí.
  Quyền lợi > 4 dòng: hiện 4 + <details> "Xem thêm N quyền lợi".
Ghi chú giá
Số liệu: lưới 2×2
Bảng so sánh: giữ <table> thật trong vùng cuộn ngang RIÊNG (role="region", aria-label,
  tabIndex=0 để cuộn bằng phím), cột nhãn dính trái (sticky left), mỗi cột gói ≥ 112px,
  gợi ý chữ "Vuốt ngang để xem các gói khác" phía trên. Trang KHÔNG cuộn ngang.
  Nút CTA đầu cột ẩn trên mobile (đã có trên thẻ) để bảng gọn.
Vì sao chọn: 1 cột
FAQ: accordion full-width, vùng bấm summary ≥ 44px
CTA cuối, Phương thức thanh toán (chip xuống dòng, không cuộn)
```

### 6.3. Trạng thái

| Trạng thái | Hiển thị |
|---|---|
| **Loading** (`app/pricing/loading.tsx`) | Khung hero + 3–4 thẻ skeleton cùng kích thước thật (tránh CLS), `aria-busy`, `role="status"` ẩn "Đang tải bảng giá", `animate-pulse motion-reduce:animate-none` |
| **Empty** — không có gói nào đang bật | `EmptyState`-kiểu trang public: "Bảng giá đang được cập nhật" + nút "Về trang chủ"; các section phụ thuộc gói (thẻ, bảng) ẩn, Hero/FAQ/CTA vẫn hiện |
| **Một phần rỗng** | Section rỗng tự ẩn (số liệu 0, FAQ rỗng, không cổng thanh toán) |
| **Error** (`app/pricing/error.tsx`, client) | "Không tải được bảng giá" + nút "Thử lại" (`reset()`), không lộ chi tiết lỗi; có `requestId` dạng chữ nhỏ nếu sẵn |
| **CMS hỏng/chưa xuất bản** | Dùng cấu hình mặc định (parse phòng thủ), không lỗi |

### 6.4. Accessibility (đối chiếu skill §1, §2, §5, §8)

- **Heading tuần tự:** H1 hero → H2 mỗi section → H3 tên gói / tiêu đề thẻ lý do (`heading-hierarchy`).
- **Thẻ gói:** mỗi thẻ là `<article aria-labelledby>`; giá đọc trọn câu ("199.000 đồng mỗi tháng" qua `sr-only`); nhãn "Phổ biến nhất"
  và "Gói hiện tại" là chữ thật, không chỉ màu viền (`color-not-only`); nút CTA có tên đầy đủ "Nâng cấp lên Pro" (không lặp "Chọn" mơ hồ).
- **Toggle chu kỳ:** `fieldset` + `legend` (`sr-only` "Chu kỳ thanh toán") + 2 `input type="radio"` dạng nút phân đoạn, focus ring
  `focus-visible`, phím mũi tên đổi lựa chọn (hành vi gốc của radio). Đổi chu kỳ cập nhật giá tại chỗ, **không** chuyển focus; một vùng
  `aria-live="polite"` đọc "Đang hiển thị giá theo năm" (`contextual-live-badge-updates`). Không có JS → hiện giá chu kỳ chính.
- **Bảng so sánh:** `<table>` thật, `<caption>`, `<th scope="col">` cho gói, `<th scope="row">` cho dòng, hàng nhóm `scope="colgroup"`/
  `rowgroup`; ✓/✗ là icon SVG `aria-hidden` + chữ `sr-only` "Có"/"Không" (dòng tự nhập dạng chữ đọc nguyên văn); ô "—" đọc "Không áp dụng".
  Cột gói hiện tại có chữ "(gói hiện tại)" trong header cột.
- **FAQ:** `<details>/<summary>` gốc (bàn phím, trình đọc màn hình, không cần JS — cùng pattern §12.3), summary là nút với chữ câu hỏi,
  mũi tên SVG `aria-hidden` xoay chỉ khi `motion-safe`; `min-h-11`.
- **Tương phản:** chữ trên nền `primary`/`primaryDeep` dùng trắng; chữ phụ `inkSoft` trên `background` đạt ≥ 4.5:1 (kiểm lại khi admin
  đổi màu thương hiệu — ghi chú cho Long ở `UI-Design-System.md`). Nút accent: kiểm chữ trắng trên `#D97706` (≈ 3,2:1 — **không đạt** cho
  chữ thường) → nút chính dùng `primary` nền + chữ trắng, accent chỉ cho viền/huy hiệu thẻ nổi bật với chữ `ink`.
- **Chạm:** mọi nút/summary/radio ≥ 44×44px trên mobile, khoảng cách ≥ 8px (`touch-target-size`, `touch-spacing`).
- **Chuyển động:** không animation tự chạy; hover nhấc thẻ chỉ `motion-safe`.

### 6.5. SEO (chỉ đề xuất)

- `generateMetadata` đọc `seoTitle`/`seoDescription` của `CmsPage pricing` (fallback "Bảng giá · {brand}"), canonical `/pricing`.
- JSON-LD `FAQPage` sinh từ khối `faq` (văn bản thuần nên an toàn), gắn `nonce` theo ADR-016 cho đồng bộ. Lưu ý: Google từ 2023 chỉ
  hiện rich result FAQ cho một số ít trang uy tín — lợi ích thấp, chi phí thấp; làm nếu Quốc đồng ý.
- Có thể thêm `Product`/`Offer` cho từng gói — **không đề xuất** ở GĐ2 (dễ sai lệch khi giá đổi, lợi ích thấp).
- Bản xem trước nháp `noindex`.

### 6.6. Việc nhỏ đi kèm

- Billing Studio thêm link "So sánh các gói" → `/pricing` (lớp trình bày, Phong).
- Thanh cảnh báo 80% ở Billing đang dùng hex cứng (`#D97706`, `#0F3B82`) — chuyển sang token khi chạm tới.

---

## 7. Câu hỏi mở cho chủ dự án

| # | Câu hỏi | Ảnh hưởng | Phương án Phong gợi ý |
|---|---|---|---|
| Q1 | Có thẻ **Enterprise / "Liên hệ"** (không giá, nút liên hệ) không? Nếu có: liên hệ qua đâu (form hộp thư hệ thống, email, Zalo)? | Thêm loại thẻ không gắn `Plan` | Chưa làm ở GĐ1; nếu cần, thêm `contactCard` trong khối `plans` (chữ + link) |
| Q2 | Có bán theo **năm / nhiều tháng** với giá ưu đãi không? Có **quà tặng thêm tháng** khi mua 3/6/12 tháng không? | **Tiền** — giá năm là `Plan` mới; quà tặng cần sửa nghiệp vụ tính kỳ | Nếu có giá năm: phương án T1 (ghép cặp trong CMS), % tiết kiệm tự tính. Quà tặng: để GĐ sau, cần ADR riêng |
| Q3 | 6 cờ tính năng (`coupons`, `advancedAnalytics`, `advancedBranding`, `seoTools`, `automation`, `customDomain`) **hiện chưa chặn theo gói và có thể chưa có thật**. Trang Bảng giá được phép quảng cáo những dòng nào? | **Rủi ro hứa sai với khách trả tiền** | Chỉ hiện dòng tính năng đã có thật và đã chặn theo gói; trước khi chốt, bảng so sánh chỉ dùng dòng *Hạn mức* + dòng *Tự nhập* đúng sự thật. Quốc giao Hiếu kiểm/gắn `assertPlanFeature` |
| Q4 | Hạn mức = 0 nghĩa là "không giới hạn" hay "không được"? | Hiển thị "Không giới hạn" + logic chặn | Thống nhất 1 nghĩa ở core và UI (hiện đang lệch) |
| Q5 | Giá **đã hay chưa gồm VAT**? Có **xuất hoá đơn VAT/hoá đơn điện tử** không? | Pháp lý, câu FAQ 10, dòng ghi chú giá | — |
| Q6 | Nền tảng có **thu phí/hoa hồng trên mỗi đơn** giáo viên bán không (kể cả gói Free)? | Câu FAQ 2, thông điệp "không giữ tiền" | Nếu 0% → nêu nổi bật ở Hero/Vì sao chọn |
| Q7 | Khách chưa đăng ký bấm gói trả phí: dẫn đi **đăng ký rồi về `/studio`** (mở gian hàng Free trước, nâng cấp sau) có chấp nhận được không, hay cần **mua gói ngay trong luồng đăng ký**? | Luồng onboarding | Đăng ký → mở gian hàng → Billing chọn sẵn gói (ít thay đổi nhất) |
| Q8 | Chính sách đổi gói giữa kỳ hiện là **không tính chênh lệch, kỳ mới nối sau kỳ cũ, gói mới áp ngay**. Giữ nguyên và công bố như vậy? Hạ xuống gói rẻ hơn khi còn hạn có cho phép không? | **Tiền** | Giữ nguyên, công bố rõ trong ghi chú giá + FAQ 7 |
| Q9 | Về Free mà đang có **nhiều tài liệu hơn hạn mức Free**: tài liệu cũ vẫn bán hay bị ẩn bớt? | FAQ 8, kỳ vọng khách | Kiểm code hiện tại rồi mô tả đúng |
| Q10 | Chính sách **huỷ / hoàn tiền** gói trả phí? | **Tiền** — chưa có luồng hoàn tiền gói | Nếu "không hoàn tiền, dùng hết kỳ" → ghi rõ |
| Q11 | Gói mới bật ở `/admin/plans` nhưng chưa cấu hình trong CMS: **tự hiện** (đề xuất) hay **ẩn tới khi admin bật**? | Tránh gói lộ ra chưa có chữ marketing | Tự hiện (gói đã bán được ở Billing) |
| Q12 | Có muốn hiển thị **dải số liệu** (số giáo viên, tài liệu, lượt mua, đánh giá — số thật) trên trang giá không? | Nội dung | Có, dùng lại số trang chủ, ô 0 tự ẩn |
| Q13 | Có **dùng thử gói trả phí** (VD 14 ngày) không? (ADR-021 đã thay trial bằng Free mãi mãi, cấu hình "Dùng thử (ngày)" vẫn còn trong cài đặt chung) | Nghiệp vụ billing | Không — Free mãi mãi đã đóng vai trò dùng thử |
| Q14 | Kênh và giờ hỗ trợ công bố trên trang (FAQ 12, dòng "Hỗ trợ" trong bảng)? | Nội dung | — |
| Q15 | Có cần **xem trước bản nháp** ngay GĐ1 (§5.2) hay chỉ "Xem trang" bản live như Cửa hàng? | Phạm vi GĐ1 | Có xem trước — trang giá dễ sai chữ/giá, nên duyệt trước khi xuất bản |

---

## 8. Thứ tự công việc

| Bước | Ai | Việc | Phụ thuộc |
|---|---|---|---|
| 0 | Quốc | Chốt Q1–Q15 với chủ dự án, ghi **ADR** (kế tiếp ADR-040): slug `pricing`, P2, quy tắc gói thiếu, toggle, xem trước | — |
| **GĐ1 — CMS** | | | |
| 1 | Hiếu | `packages/core/src/admin/pricing-sections.ts`: schema chặt + `parsePricingSections` phòng thủ + mặc định + subpath export; thêm `"pricing"` vào `SYSTEM_CMS_SLUGS` (C1) | 0 |
| 2 | Hiếu | `apps/web/lib/pricing-cms.ts`: dữ liệu editor (C2); `app/admin/cms/pricing/actions.ts`: lưu nháp / xuất bản / khôi phục, `requireRole("SYSTEM_ADMIN")`, audit, `revalidatePath("/pricing")` (C3) | 1 |
| 3 | Hiếu | (Nếu Q3/Q4 chốt) sửa ngữ nghĩa hạn mức 0, gắn `assertPlanFeature` vào tính năng có thật | 0 |
| 4 | Phong | `SortableListEditor` dùng chung; editor `app/admin/cms/pricing/page.tsx` + `_ui/*` + `loading.tsx`; mục menu "Trang Bảng giá" + icon | 1, 2 (dựng UI song song trên contract) |
| 5 | Quốc | Review diff; Long ghi spec + `UI-Design-System.md` | 4 |
| **GĐ2 — Trang công khai** | | | |
| 6 | Hiếu | Loader `getPricingPageData()` (C4); Billing nhận `?plan=` (C5); guard xem trước nháp (C6, nếu Q15 = có) | GĐ1 |
| 7 | Phong | `app/pricing/page.tsx` + `loading.tsx` + `error.tsx`, component `app/_ui/pricing/*` (thẻ gói, toggle, bảng so sánh, FAQ, CTA, phương thức thanh toán), SiteHeader/Footer, JSON-LD (nếu duyệt); link "So sánh các gói" ở Billing | 6 |
| 8 | Quốc + Long | Review, test tay 375px/desktop/bàn phím, cập nhật KB | 7 |

Test: thêm test cho schema/parse (`pricing-sections`) sẽ **đổi số lượng test** so với mốc `test:count` → Quốc hỏi chủ dự án trước (CLAUDE.md).

### Contract dữ liệu cần Hiếu (Quốc chuyển)

- **C1** — `SYSTEM_CMS_SLUGS = ["home", "shop", "pricing"]`; `/p/pricing` trả 404; form CMS chung không tạo/ghi đè slug này.
- **C2** — `getPricingCmsEditorData()` →
  `{ sections: PricingSection[]; live: PricingSection[]; hasDraft: boolean; status: "NONE"|"DRAFT"|"PUBLISHED"; updatedAt: Date|null;
  plans: { id, code, name, priceVnd, interval, intervalCount, maxProducts, storageMb, maxFileMb, imageStorageMb, isFree, isActive, features }[];
  stats: HomeStats; enabledProviders: PaymentProviderId[]; graceDays: number }` (mọi gói kể cả đã tắt, để editor báo "Gói đang tắt").
- **C3** — `savePricingDraftAction(sections: unknown)`, `publishPricingAction(sections: unknown)`, `restoreLivePricingAction()` → `{ ok?: true; error?: string; issues?: { sectionId, field, message }[] }`
  cùng hình dạng `ShopEditorActionState`. Server kiểm thêm: `planId`/`altPlanId` tồn tại, tối đa 1 `highlighted`, `cells` chỉ chứa `planId` hợp lệ.
- **C4** — `getPricingPageData({ preview?: boolean })` →
  `{ sections (đã parse, đã bỏ gói tắt, đã nối gói thiếu); plans (đang bật); stats; enabledProviders; graceDays; brandName;
  viewer: { kind: "ANON" } | { kind: "NO_TENANT" } | { kind: "TENANT"; tenantSlug; currentPlanId; isFree; status; currentPeriodEnd; hasPendingInvoice } }`.
  Chỉ dữ liệu L1 + subscription của chính người xem; không lộ dữ liệu tenant khác.
- **C5** — `/studio/[tenantSlug]/billing?plan={planId}`: nếu `planId` là gói trả phí đang bật → `RenewForm` chọn sẵn gói đó; sai/không có → mặc định như nay.
- **C6** — `/pricing?xem-truoc=nhap`: chỉ `SYSTEM_ADMIN` nhận bản nháp (kiểm quyền ở server), `robots: noindex`, `viewer` ép về `ANON`.

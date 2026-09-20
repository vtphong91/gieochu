# Gieo Chữ — Kế hoạch: TiptapEditor, AI Content Creator & SEO Optimization

**Trạng thái tài liệu:** Chỉ lên kế hoạch. **Giai đoạn 1 (TiptapEditor) sẽ code sau khi anh duyệt bản này.
Giai đoạn 2 (AI Content Creator) và Giai đoạn 3 (SEO Optimization/Content Pipeline) CHƯA CODE gì — đây là bản
thiết kế trước để Giai đoạn 1 không phải viết lại khi tới lượt Giai đoạn 2/3.**

**Liên quan:** `docs/bao-cao-ky-thuat-tiptap-editor-content-creator-2026-09-19.md` (báo cáo tham khảo từ hệ
thống blog/SEO khác — chỉ phần kiến trúc editor dùng được trực tiếp, phần AI/SEO/pipeline của hệ thống đó
**không sao chép nguyên**, vì Gieo Chữ là marketplace tài liệu, không phải nền tảng blog SEO), và
`docs/GIEOCHU_PRODUCT_MODULE_DEEP_PLAN_V1.0.md` (đã đề cập rich text mô tả sản phẩm ở §5.2, giờ đổi hướng
sang Tiptap/WYSIWYG thay vì Markdown).

---

## 0. Vì sao chia 3 giai đoạn thay vì làm chung

Yêu cầu của anh: build Editor trước, nhưng **thiết kế sao cho AI Content Creator + SEO Optimization cắm vào
được sau mà không phải đập đi làm lại**. Cách duy nhất làm đúng cả hai mục tiêu cùng lúc — không vi phạm
nguyên tắc "không xây trước cái chưa cần" (CLAUDE.md) mà vẫn "chuẩn bị hạ tầng" — là:

- **Giai đoạn 1** chỉ thêm đúng 1 điểm mở rộng rẻ, nằm sẵn trong chính component Editor (mục 3) — không thêm
  bảng DB, không thêm package AI rỗng, không thêm route rỗng.
- **Giai đoạn 2/3** ở tài liệu này là **bản thiết kế** (kiến trúc, bảng dữ liệu dự kiến, câu hỏi cần quyết
  định) — không migrate, không tạo package, không viết code — để khi thật sự bắt tay làm, không phải nghiên
  cứu lại từ đầu và không phải sửa lại Giai đoạn 1.

---

## 1. Giai đoạn 1 — TiptapEditor (làm ngay, sau khi duyệt)

Giữ nguyên nội dung đã thống nhất ở lượt trước (vị trí file, bộ extension, sanitize, mô hình đồng bộ dữ
liệu, tái dùng Cloudinary) — tóm tắt lại các điểm chính, không lặp lại chi tiết:

- `apps/web/app/_ui/editor/` (component) + `packages/core/src/content/` (sanitize-html, word-count — dùng
  chung Product/Blog sau này).
- Bộ extension đầy đủ định dạng, mỗi extension đều có UI toolbar thật (không đăng ký "extension chết" như
  báo cáo tham khảo từng mắc phải).
- Sanitize HTML server-side bằng `sanitize-html`, whitelist đúng theo bộ extension.
- Mô hình đồng bộ "semi-controlled" (đúng kỹ thuật báo cáo tham khảo) + `<input type="hidden">` nộp qua
  Server Action, giống pattern port/secure vừa sửa ở SMTP form.
- Pilot đầu tiên: mô tả sản phẩm (Studio).

### 1.1 — Điểm chuẩn bị DUY NHẤT cho tương lai: `TiptapEditorApi`

Đây là phần duy nhất của Giai đoạn 1 làm **vì Giai đoạn 2**, chứ không phải vì nhu cầu hiện tại — chi phí gần
như 0 (vài chục dòng, nằm sẵn trong component đang viết), nhưng nếu bỏ qua thì Giai đoạn 2 sẽ phải sửa lại
component đã xong.

```ts
export interface TiptapEditorApi {
  insertAtCursor: (html: string) => void;
  appendToEnd: (html: string) => void;
  replaceAll: (html: string) => void; // = setContent, dùng khi AI generate thay toàn bộ
  getSelectionText: () => string;      // AI Content Creator cần biết đang chọn đoạn nào để "viết lại đoạn này"
}
```

`onEditorReady?: (api: TiptapEditorApi) => void` — prop optional, y hệt cơ chế báo cáo tham khảo mục 2.5.
**Chưa ai gọi tới các hàm này ở Giai đoạn 1** (không có panel AI nào tồn tại) — nhưng khi Giai đoạn 2 xây
"AI Content Creator panel", nó chỉ cần nhận `editorApiRef` qua props, không đụng vào code Editor gốc.

Không thêm gì khác vào Giai đoạn 1 vì Giai đoạn 2/3.

---

## 2. Giai đoạn 2 — AI Content Creator (kế hoạch, CHƯA CODE)

### 2.1 Phạm vi khác biệt so với báo cáo tham khảo

Hệ thống tham khảo sinh **bài blog SEO dài** (800-2000+ từ, có outline, có RAG từ Knowledge Base, có brief
riêng). Gieo Chữ ở giai đoạn này chỉ có nhu cầu sinh **mô tả sản phẩm ngắn** (vài trăm từ) — không cần: content
brief riêng, keyword research, outline generator, A/B test 2 nhiệt độ, competitor gap analysis. Nếu sau này
Blog module ra đời, phần "brief/outline" mới thật sự cần tới — **không xây trước cho blog khi blog chưa tồn
tại**, chỉ thiết kế sao cho khi blog tới, phần lõi (AI Router, audit log) dùng lại được, không phải xây lại.

### 2.2 Kiến trúc AI Provider — dùng đúng pattern đã có trong Gieo Chữ, không phát minh mới

Gieo Chữ **hiện chưa có bất kỳ dòng code AI nào** (đã rà soát `env.ts`/`.env.example` — không có
`OPENAI_API_KEY`/`ANTHROPIC_API_KEY`/`GEMINI_API_KEY` nào). Nhưng codebase đã có sẵn đúng 2 tiền lệ cho việc
"1 interface, nhiều provider thay thế được" — `packages/email`'s `EmailSender` (`createSmtpSender`/
`createResendSender`/`createEmailSenderFromEnv`) và `packages/payments`'s `PaymentProvider`. AI Provider nên
đi đúng khuôn đó:

```ts
// packages/ai/src/provider.ts (DỰ KIẾN — CHƯA TẠO)
export interface AIGenerateOptions {
  prompt: string;
  maxTokens?: number;
}
export interface AIProvider {
  generate(options: AIGenerateOptions): Promise<{ text: string }>;
}
// createAnthropicProvider() / createOpenAIProvider() / ... — chọn 1 lúc triển khai thật, interface không đổi.
```

Gói mới `packages/ai` — **chưa tạo trong giai đoạn này**, chỉ ghi nhận đây sẽ là vị trí, đúng quy ước "mỗi
package skeleton có comment ghi module nào triển khai" đã dùng cho `packages/payments`/`packages/storage` từ
M0.

### 2.3 Luồng generate — đơn giản hoá cho "mô tả sản phẩm", không cần preview dialog phức tạp

```
Owner bấm "AI viết mô tả" (trong TiptapEditor toolbar, hoặc panel riêng cạnh form sản phẩm)
  → Server Action generateProductDescription({ title, type, tags, existingDescription? })
  → assertPlanFeature(tenantId, "automation")  // gate theo gói — đã CÓ SẴN, xem mục 2.5
  → gọi AIProvider.generate() với prompt dựng từ title/type/tags
  → sanitize-html (packages/core/src/content — DÙNG LẠI đúng hàm Giai đoạn 1 đã xây cho editor)
  → trả HTML preview về client
  → owner bấm "Chèn vào mô tả" → editorApiRef.current.replaceAll(html) (hoặc insertAtCursor nếu đang sửa 1 đoạn)
  → owner tự sửa tiếp trong Tiptap như bình thường, Lưu như luồng thủ công — KHÔNG có luồng lưu riêng cho
    nội dung AI, tái dùng đúng 1 con đường lưu duy nhất (đúng nguyên tắc "1 nguồn sự thật" đã áp dụng cho
    `markOrderPaid` ở M8, không tạo 2 đường ghi dữ liệu cho cùng 1 cột).
```

Không cần `GenerationHistory`/diff/revision phức tạp như báo cáo tham khảo ở giai đoạn này — nếu owner không
ưng bản AI, họ sửa tay hoặc bấm lại "AI viết mô tả" để sinh bản khác, không cần lưu lịch sử nhiều phiên bản
(mô tả sản phẩm ngắn, chi phí "generate lại" thấp hơn nhiều so với 1 bài blog dài).

### 2.4 Audit trail — bảng dự kiến (CHƯA MIGRATE)

```prisma
// DỰ KIẾN — chưa thêm vào schema.prisma
model ContentGeneration {
  id           String   @id @default(cuid(2))
  tenantId     String
  productId    String?
  kind         String   // "product_description" | (sau này) "blog_post"
  prompt       String
  outputHtml   String
  accepted     Boolean  @default(false)
  createdAt    DateTime @default(now())
}
```

Vai trò: biết được ai/khi nào dùng AI, có chấp nhận kết quả hay không — phục vụ tính chi phí/quota, không
phải "audit bảo mật" (khác `audit_logs` của M12). Bảng L2 (có `tenantId`), sẽ cần RLS khi thật sự tạo.

### 2.5 Chi phí & giới hạn theo gói — **điểm cần dừng lại hỏi, không tự quyết**

Gọi AI tốn tiền thật mỗi lần generate — đây là quyết định ảnh hưởng tiền, đúng mục 0.6 CLAUDE.md phải dừng
hỏi trước khi code, không tự chọn:

- `packages/core/src/billing/feature-gate.ts` **đã có sẵn** key `"automation"` trong `PlanFeatureKey` — tạo
  từ M3 v2, **chưa từng được gọi ở đâu** (`assertPlanFeature()` cũng đã có sẵn, cùng tình trạng "xây nhưng
  chưa dùng"). AI Content Creator là ứng viên tự nhiên đầu tiên để gọi `assertPlanFeature(tenantId,
  "automation")` — nghĩa là **chỉ tenant trả phí có bật tính năng `automation` mới generate được**, khớp đúng
  triết lý Hybrid Monetization (Free bán được nhưng không có tính năng nâng cao).
- Cần anh quyết định: giới hạn **số lượt generate/tháng theo gói** (thêm field mới trong `Plan`, ví dụ
  `aiGenerationsPerMonth`) hay **không giới hạn số lượt, chỉ gate bật/tắt tính năng** (đơn giản hơn, nhưng
  rủi ro chi phí AI không kiểm soát nếu 1 tenant spam generate). Đề xuất an toàn mặc định nếu chưa quyết:
  **có giới hạn số lượt/tháng**, theo đúng tinh thần các giới hạn khác của `Plan` (`maxProducts`, `storageMb`
  đều có ngưỡng, không có gì trong hệ thống hiện tại là "unlimited theo mặc định").
- Chọn nhà cung cấp AI (Anthropic/OpenAI/Gemini/khác) ảnh hưởng chi phí vận hành thật — **để anh chọn khi
  tới lúc triển khai thật**, không chọn hộ trong tài liệu kế hoạch này.

---

## 3. Giai đoạn 3 — SEO Optimization & Content Pipeline (kế hoạch xa hơn, CHƯA CODE)

### 3.1 Làm rõ phạm vi trước — "SEO" nghĩa là gì cho Gieo Chữ

Báo cáo tham khảo xây SEO audit cho **bài blog cạnh tranh thứ hạng Google** (keyword density, heading
similarity Jaccard so với 30 bài cũ, embedding similarity, GEO preset theo content_type...) — bộ máy đó đúng
cho 1 nền tảng content marketing, **không tương xứng với nhu cầu thật của trang sản phẩm ngắn**. Với Gieo Chữ,
"SEO" thực tế nằm ở 2 tầng khác nhau, không nên gộp chung:

1. **SEO kỹ thuật cho trang sản phẩm công khai** — đã nằm trong phạm vi `GIEOCHU_PRODUCT_MODULE_DEEP_PLAN_V1.0.md`
   §8 (P0): `generateMetadata` đầy đủ OpenGraph + JSON-LD Product schema. Đây là việc làm đúng ngay ở module
   sản phẩm, **không cần đợi AI/SEO audit engine** — thuộc P0 của kế hoạch sản phẩm, không phải Giai đoạn 3
   ở đây.
2. **SEO content checklist cho nội dung dài (Blog, khi module đó tồn tại)** — đây mới là phần tương đương báo
   cáo tham khảo, nhưng nên làm **nhẹ hơn nhiều**: 1 hàm thuần kiểu rule-based checklist (có H2 chứa từ khoá
   chính? meta description trong khoảng 120-160 ký tự? có ít nhất 1 ảnh có `alt`? độ dài tối thiểu?) — **không
   cần** embedding similarity/Jaccard chống trùng lặp giữa các bài (chỉ có ý nghĩa khi có hàng trăm bài blog
   cùng chủ đề cạnh tranh nhau, Gieo Chữ chưa ở quy mô đó).

### 3.2 `seoTools` — feature key đã có sẵn, chưa dùng

Giống `automation` ở mục 2.5, `PlanFeatureKey` đã có sẵn `"seoTools"` từ M3 v2, chưa được gọi ở đâu — đúng vị
trí để gate tính năng SEO checklist (nếu quyết định đây là tính năng trả phí) khi Giai đoạn 3 thực sự triển
khai.

### 3.3 Content Pipeline (hàng đợi tự động) — khuyến nghị **không làm** cho Gieo Chữ, trừ khi có lý do kinh doanh cụ thể

Báo cáo tham khảo có 1 hệ thống cron riêng (`processPipelineBatch`) tự động chạy brief→outline→content→review
theo lịch, dùng cho quy mô sản xuất content hàng loạt (agency SEO, nhiều bài/ngày). Gieo Chữ là marketplace
tài liệu cá nhân hoá — mỗi tenant tự viết mô tả sản phẩm CỦA HỌ, không có nhu cầu "tự động sinh hàng loạt sản
phẩm". Đề xuất: **không đưa Content Pipeline dạng hàng đợi vào roadmap**, trừ khi sau này Blog module thật sự
cần "lên lịch đăng bài tự động" — lúc đó cân nhắc lại, không xây trước.

---

## 4. Bảng tổng hợp — cái gì làm khi nào

| Hạng mục | Giai đoạn 1 (ngay) | Giai đoạn 2 (kế hoạch) | Giai đoạn 3 (kế hoạch) |
|---|---|---|---|
| Component `TiptapEditor` + toolbar | ✅ Code | — | — |
| `sanitize-html`/`word-count` dùng chung | ✅ Code | Dùng lại | Dùng lại (nếu có checklist) |
| `TiptapEditorApi` (insertAtCursor...) | ✅ Code (chưa ai gọi) | Panel AI gọi | — |
| `packages/ai` + `AIProvider` interface | — | 📋 Thiết kế, chưa tạo | — |
| Server Action generate mô tả sản phẩm | — | 📋 Thiết kế | — |
| Bảng `ContentGeneration` (audit) | — | 📋 Thiết kế, chưa migrate | — |
| Gate `assertPlanFeature("automation")` | — | 📋 Áp dụng khi build | — |
| Giới hạn lượt generate/tháng | — | ❓ Cần anh quyết định | — |
| SEO metadata trang sản phẩm (OG/JSON-LD) | (thuộc Product Module P0, không phải AI) | — | — |
| SEO checklist rule-based cho Blog | — | — | 📋 Thiết kế, chờ Blog module |
| Gate `assertPlanFeature("seoTools")` | — | — | 📋 Áp dụng khi build |
| Content Pipeline hàng đợi tự động | — | — | ❌ Không khuyến nghị làm |

---

## 5. Câu hỏi cần anh quyết định (trước khi Giai đoạn 2 thật sự bắt đầu — không cần trả lời ngay để bắt đầu Giai đoạn 1)

1. Nhà cung cấp AI dùng để generate (Anthropic/OpenAI/Gemini/khác) — ảnh hưởng chi phí vận hành thật.
2. Có giới hạn số lượt generate/tháng theo gói không, hay chỉ gate bật/tắt.
3. Module Blog có thật sự nằm trong roadmap gần không, hay mới là ý tưởng — quyết định này ảnh hưởng độ ưu
   tiên của phần "brief/outline" trong Giai đoạn 2 (chỉ cần nếu Blog thành hình).

---

## 6. Bước tiếp theo

Giai đoạn 1 (TiptapEditor) sẵn sàng code ngay khi anh xác nhận 3 điểm đã hỏi ở lượt trước (thư viện sanitize,
bảng màu, pilot đầu tiên). Giai đoạn 2/3 ở tài liệu này chỉ cần anh đọc qua để biết hướng đi — không chặn
việc bắt đầu Giai đoạn 1.

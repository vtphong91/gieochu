# Báo cáo kỹ thuật: Tiptap Editor & Module Content Creator (Article Editor)

**Ngày:** 2026-09-19
**Phạm vi:** (1) Editor Tiptap dùng chung toàn hệ thống — cấu hình, custom extension, luồng đồng bộ dữ liệu, chèn ảnh; (2) Kiến trúc UI module "Content Creator" (trang sửa bài viết `/dashboard/articles/[id]/edit`) — layout, state, AI generation, panel SEO; (3) Backend sinh nội dung — server actions, image pipeline, data model.

---

## 1. Tổng quan kiến trúc

```
articles.content (HTML string, DB)
        │
        ▼  load
┌─────────────────────────────────────────────┐
│  ArticleEditorLayout (state "god component") │
│  formData = { title, content, outline, ... } │
└───────────────┬───────────────┬──────────────┘
                │               │
     ┌──────────▼──────┐  ┌─────▼─────────────┐
     │ ArticleEditor    │  │ ArticleWorkflow     │
     │ Content          │  │ Panel (10 tab)      │
     │  → <TiptapEditor>│  │  SEO/Links/Ảnh/...  │
     └──────────┬───────┘  └─────┬──────────────┘
                │  onChange(html)│ callbacks qua
                │  editorApiRef  │ props (không Context)
                ▼                ▼
        formData.content   editor.commands (insertAtCursor...)
                │
                ▼ Save Draft / autosave 60s
        updateArticle() → articles.content (DB)
                │
                ▼ Publish
   PublishConfirmationDialog (nội bộ) | CMSPublishDialog (WordPress) | WC (WooCommerce)
```

Điểm mấu chốt xuyên suốt toàn hệ thống: **nội dung bài viết luôn là 1 chuỗi HTML thô** (không phải ProseMirror/Tiptap JSON document) — được AI sinh ra dưới dạng HTML, lưu thẳng vào cột `articles.content`, Tiptap chỉ đóng vai trò *parse HTML này để hiển thị/sửa* rồi *serialize lại thành HTML* (`editor.getHTML()`) khi lưu. Không có tầng chuyển đổi định dạng trung gian nào (không Markdown, không JSON).

---

## 2. Tiptap Editor — chi tiết kỹ thuật

### 2.1. Package versions (`package.json`)

```
@tiptap/react            ^3.11.1
@tiptap/starter-kit      ^3.11.1
@tiptap/extension-underline    ^3.11.1
@tiptap/extension-link         ^3.11.1
@tiptap/extension-image        ^3.11.1
@tiptap/extension-text-align   ^3.11.1
@tiptap/extension-placeholder  ^3.11.1
@tiptap/extension-color        ^3.11.1
@tiptap/extension-highlight    ^3.11.1
@tiptap/extension-text-style   ^3.20.0   ← lệch minor version so với các gói còn lại
```

Không có: collaboration (Yjs), character-count, mention, task-list, code-block-lowlight. Đây là một cấu hình **tối giản, không realtime-collab**.

### 2.2. Component lõi — `components/articles/article-editor/tiptap-editor.tsx`

Một component `TiptapEditor` **duy nhất, dùng chung cho cả 3 nơi** cần rich-text editor trong hệ thống (xem mục 2.9).

```ts
interface TiptapEditorProps {
  content: string
  onChange: (content: string) => void
  placeholder?: string
  editable?: boolean
  onEditorReady?: (api: TiptapEditorApi) => void
  onUploadImage?: (file: File) => Promise<string | null>
}
```

**Danh sách extension đăng ký trong `useEditor()`** (đúng thứ tự):

| # | Extension | Cấu hình |
|---|---|---|
| 1 | `StarterKit` | `heading: { levels: [1,2,3,4,5,6] }` — mở rộng heading tới H6 (mặc định StarterKit chỉ H1-H3) |
| 2 | `Underline` | mặc định |
| 3 | `Link` | `openOnClick: false`, `HTMLAttributes.class: 'text-blue-600 underline cursor-pointer'`, **không** set `validate` (không ép validate URL) |
| 4 | `Image.extend({...})` | Xem 2.3 — không phải Node mới, chỉ override `parseHTML` |
| 5 | `TextAlign` | `types: ['heading', 'paragraph']` |
| 6 | `Placeholder` | text lấy từ prop, mặc định `'Bắt đầu viết nội dung...'` |
| 7 | `Color` | mặc định |
| 8 | `TextStyle` | mặc định — mark nền cho `Color` |
| 9 | `Highlight` | `multicolor: true` |
| 10 | `SeeAlsoBox` | custom Node — xem 2.4 |

Các option `useEditor()` khác đáng chú ý:
- `immediatelyRender: false` — bắt buộc dưới Next.js SSR + React 18 strict mode để tránh lỗi hydration (comment trong code: *"Fix SSR hydration issue"*).
- `onUpdate: ({ editor }) => onChange(editor.getHTML())` — **không debounce ở tầng editor**, mọi keystroke đều emit HTML ra ngoài.
- `editorProps.attributes.class: 'tiptap-editor-content focus:outline-none min-h-[400px] px-4 py-3'` — class này là hook CSS chính cho toàn bộ style nội dung (mục 2.8).

### 2.3. Image extension — mở rộng `parseHTML`, không phải Node mới

```ts
Image.extend({
  parseHTML() {
    return [
      { tag: 'img[src]' },
      { tag: 'img[data-src]', getAttrs: (node) => ({ src: node.getAttribute('data-src'), ... }) },
      { tag: 'img[data-lazy-src]', getAttrs: (node) => ({ src: node.getAttribute('data-lazy-src'), ... }) },
    ]
  },
}).configure({ HTMLAttributes: { class: 'max-w-full h-auto rounded-lg' } })
```

Mục đích: nhận diện được cả ảnh lazy-load (`data-src`/`data-lazy-src`) khi paste HTML sao chép từ website khác — không chỉ ảnh `<img src>` chuẩn. `allowBase64`/`inline` giữ mặc định thư viện (`false`).

**Lưu ý kỹ thuật quan trọng cho phối hợp module ảnh:** image pipeline backend (mục 4.4) chèn ảnh vào content dưới dạng `<figure class="wp-block-image"><img .../></figure>` (chuẩn WordPress Gutenberg) chứ không phải `<img>` trần. Tiptap's `Image` extension chỉ parse thẻ `<img>` — thẻ `<figure>` bọc ngoài **không có Node riêng để giữ nguyên cấu trúc**, khi Tiptap serialize lại (`getHTML()`) rất có thể `<figure>` wrapper bị mất, chỉ còn `<img>` trần. Đây là điểm rủi ro cần kiểm chứng thực tế (ảnh vẫn hiển thị đúng nhưng có thể mất class `wp-block-image` sau khi user sửa bài trong Tiptap rồi save lại → ảnh hưởng style khi publish lại lên WordPress).

### 2.4. Custom extension duy nhất trong toàn repo — `SeeAlsoBox`

File: `components/articles/article-editor/see-also-box-extension.ts` (39 dòng). Đây là **Node/Mark/Extension tự viết duy nhất** trong cả codebase (đã grep toàn bộ `Extension.create(`/`Node.create(`/`Mark.create(`).

```ts
export const SeeAlsoBox = Node.create({
  name: 'seeAlsoBox',
  group: 'block',
  content: 'inline*',
  marks: '_',
  parseHTML() {
    return [{ tag: 'div.see-also-box', contentElement: 'p' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, {
      class: 'see-also-box',
      style: 'background:#eff6ff;border-left:4px solid #3b82f6;padding:10px 14px;margin:16px 0;border-radius:0 6px 6px 0',
    }), ['p', { style: 'margin:0;font-size:0.875em;color:#1e40af' }, 0]]
  },
})
```

- Vai trò: giữ nguyên (parse + render đúng) khối `<div class="see-also-box"><p>...</p></div>` — dùng cho callout "Tham khảo thêm về X" mà các panel AI (internal-link panel...) chèn vào bài.
- **Không có toolbar button, không slash-command** — chỉ được chèn/xoá **lập trình** qua `TiptapEditorApi` (mục 2.5), không qua thao tác tay của người dùng.
- CSS inline được duplicate lại trong `app/globals.css` (`.see-also-box`) để khớp giao diện preview tĩnh ngoài editor.

### 2.5. `TiptapEditorApi` — API mệnh lệnh (imperative) expose ra ngoài

```ts
export interface TiptapEditorApi {
  insertAtCursor: (html: string) => void   // editor.commands.insertContent(html)
  appendToEnd: (html: string) => void       // di chuyển selection tới cuối doc rồi insertContent
  removeFromEditor: (anchorText: string) => void  // tìm node seeAlsoBox chứa anchorText, deleteRange
}
```

Expose qua `onEditorReady` callback trong `useEffect` (khóa theo `[editor]`). Đây là **kênh giao tiếp duy nhất cho phép panel bên ngoài (SEO Audit, Internal Link) chèn/xoá nội dung thẳng vào Tiptap mà không đi qua `formData.content`** — khác hẳn với luồng AI generate content (luôn qua `formData.content`, xem mục 3.5).

Tại `article-editor-layout.tsx`: `editorApiRef.current = api` được lưu, rồi 3 hàm `handleInsertAtCursor/handleAppendToEnd/handleRemoveFromEditor` truyền xuống `ArticleWorkflowPanel` → dùng ở SEO Audit panel (chèn câu chứa từ khoá tại con trỏ) và Internal Link panel (chèn/xoá callout "xem thêm").

### 2.6. Đồng bộ nội dung — mô hình "bán kiểm soát" (semi-controlled)

**Chiều ra (editor → app):**
```ts
onUpdate: ({ editor }) => onChange(editor.getHTML())
```
Không debounce trong editor. Mọi phím gõ đều gọi `getHTML()` và bắn ra `onChange` prop.

**Chiều vào (app → editor)** — `useEffect` theo dõi `[content, editor]`:
```ts
useEffect(() => {
  if (editor && content !== editor.getHTML()) {
    const { from, to } = editor.state.selection
    const docSize = editor.state.doc.content.size
    editor.commands.setContent(content, { emitUpdate: false })   // tránh vòng lặp onUpdate
    const newDocSize = editor.state.doc.content.size
    try {
      editor.commands.setTextSelection({ from: Math.min(from, newDocSize), to: Math.min(to, newDocSize) })
    } catch { /* giữ nguyên con trỏ nếu lỗi */ }
  }
}, [content, editor])
```
Khi prop `content` bị ghi đè từ bên ngoài (ví dụ AI generate content xong, ghi thẳng vào `formData.content`), effect này set lại nội dung **và cố gắng khôi phục vị trí con trỏ** (tránh bug "con trỏ nhảy về đầu dòng" đã từng gặp).

**`editable` prop** đồng bộ qua `useEffect` riêng gọi `editor.setEditable(editable)`. Thực tế trong toàn repo **không có nơi nào truyền `editable={false}`** — các trang cần chế độ "chỉ xem" đều chuyển hẳn sang render 1 khối HTML tĩnh khác (class `.article-preview-content`) thay vì tắt editable trên Tiptap.

**Debounce/autosave nằm HOÀN TOÀN bên ngoài `TiptapEditor`:**
- `article-editor-layout.tsx`: debounce riêng 500ms cho `formData.content` → `debouncedContent`, chỉ để tránh re-render nặng `ArticleWorkflowPanel`, KHÔNG dùng để lưu.
- Autosave thật: hook `hooks/use-autosave.ts` — interval 60 giây, so sánh `JSON.stringify(data)` để biết có đổi, gọi `handleSaveDraft(true)` (silent). Có `beforeunload` listener gọi `saveNow()`.

### 2.7. Toolbar — `components/articles/article-editor/tiptap-toolbar.tsx`

Toolbar phẳng (không mega-menu), nhóm theo `Separator`:

1. **Heading `Select`** (P, H1-H6) — `editor.chain().focus().setParagraph()/toggleHeading({level}).run()`.
2. **Format cơ bản**: Bold/Italic/Underline/Strike/Code/Highlight — mỗi nút toggle qua `editor.chain().focus().toggle<X>().run()`, active state qua `editor.isActive(...)`.
3. **List/Quote**: bullet list, ordered list, blockquote.
4. **Căn lề**: left/center/right/justify.
5. **Chèn**: Link (dialog nhập URL, `setLink`/`unsetLink`), Image (dialog — xem 2.7).
6. **Undo/Redo**: disable theo `editor.can().undo()/redo()`.

Dialog Link/Image dùng `useState` cục bộ trong toolbar, không có state ngoài.

**Điểm đáng chú ý:** `Color`/`TextStyle`/`Highlight` được đăng ký ở tầng editor nhưng **toolbar chỉ có 1 nút Highlight toggle đơn sắc** — không có UI chọn màu chữ (`Color`) hay chọn màu highlight (dù extension hỗ trợ `multicolor: true`). Tức là 2 extension `Color`/`TextStyle` hiện **chưa có UI khai thác** trong toolbar.

### 2.8. Chèn ảnh trong Tiptap — chỉ qua dialog toolbar, KHÔNG có paste/drop handler

Không có extension paste-handler/drop-handler nào đăng ký. Chèn ảnh có 2 đường, cả hai đều qua dialog "Insert Image" của toolbar:

1. **Dán URL ảnh** — luôn khả dụng: `editor.chain().focus().setImage({ src: imageUrl }).run()`.
2. **Upload file lên Cloudinary** — chỉ hiện nếu component cha truyền prop `onUploadImage`:
```ts
const handleUploadImage = async (file) => {
  const url = await onUploadImage(file)
  if (url) editor.chain().focus().setImage({ src: url }).run()
}
```

**Chỉ 1/3 nơi dùng `TiptapEditor` thật sự wire Cloudinary upload** — `components/settings/blog/system-blog-editor-panel.tsx` (System Blog, khu Admin). Gọi `uploadMediaAsset()` (server action) → `uploadBufferToCloudinary()` (`lib/services/cloudinary-client.ts`) với credential Cloudinary hệ thống. **Article Editor chính (module Content Creator) và Affiliate Review Editor KHÔNG truyền `onUploadImage`** → 2 nơi này chỉ chèn được ảnh bằng URL có sẵn, không upload file trực tiếp từ máy qua toolbar. (Ảnh trong bài viết SEO chính thực chất chủ yếu đến từ pipeline backend tự động — mục 4.4 — không phải qua thao tác tay này.)

### 2.9. Styling / hành vi khác

- CSS: `app/globals.css` (khoảng dòng 257-467) — style dùng chung cho cả `.tiptap-editor-content` (editor sống) và `.article-preview-content` (bản preview tĩnh) để đảm bảo WYSIWYG khớp giữa lúc sửa và lúc xem trước/publish. Có style riêng cho `.see-also-box` (trùng khớp style inline trong `renderHTML` của custom Node) và cho placeholder rỗng (`p.is-editor-empty::before { content: attr(data-placeholder) }`).
- Không có character/word-count extension — số từ được đếm thủ công bằng regex (`content.replace(/<[^>]*>/g,' ').split(/\s+/).filter(Boolean).length`) ở tầng ngoài (layout, blog panel, review panel) — trùng lặp code 3 lần ở 3 nơi khác nhau, không dùng chung 1 helper.
- Không có collaborative editing, không custom keyboard shortcut (chỉ dùng mặc định StarterKit: Ctrl+B/I/U/Z/Y).
- Khung bao ngoài: card viền bo góc, toolbar dính (`sticky`) phía trên, vùng nội dung cuộn riêng (`max-h-[600px] overflow-y-auto`).

### 2.10. Nơi sử dụng `TiptapEditor` (3 vị trí thật trong toàn repo)

| Nơi dùng | File | `onUploadImage`? | Ghi chú |
|---|---|---|---|
| **Article Editor chính** (module Content Creator — đối tượng chính báo cáo này) | `article-editor-content.tsx` | Không | Duy nhất nơi wire `onEditorReady` → `editorApiRef` cho các panel AI chèn nội dung |
| System Blog Post Editor (Admin) | `components/settings/blog/system-blog-editor-panel.tsx` | **Có** (Cloudinary) | Editor duy nhất hỗ trợ upload file ảnh trực tiếp |
| Affiliate Review Editor | `components/affiliate-review/affiliate-review-content-panel.tsx` | Không | Chỉ hiện khi `!readOnly && onSave` |

---

## 3. Module Content Creator (Article Editor) — Kiến trúc UI

### 3.1. Route & nạp dữ liệu ban đầu

`app/(dashboard)/dashboard/articles/[id]/edit/page.tsx` (Server Component, `params` là Promise theo Next 15):
- Query `articles` kèm join `primary_keyword`, `project`, `topic`, `brief` (content_briefs).
- Tính quyền: super_admin / owner (`created_by === user.id`) / thành viên project active → `userRole`.
- Lấy song song danh sách `keywords` (từ keyword research của project) + `topics`.
- Render **1 Client Component duy nhất** — `ArticleEditorLayout` — nhận toàn bộ dữ liệu ban đầu làm props. **Không dùng React Query/SWR, không có Context Provider nào bọc quanh** — toàn bộ state sống trong `ArticleEditorLayout`.

### 3.2. Layout — state "god component", giao tiếp bằng props callback (không Context/store)

`article-editor-layout.tsx`:
- **1 object `formData`** duy nhất (useState, không reducer/immer) chứa toàn bộ field: title, outline, content, notes, status, sub_status, primary_keyword_id, secondary_keywords, topic_id, tags, meta_title, meta_description, target_word_count, target_publish_date, published_url.
- `isSaving`, `lastSaved`, `hasUnsavedChanges`, `auditTrigger` (số đếm, tăng để kích hoạt SEO Audit tự chạy lại).
- `debouncedContent` (debounce 500ms) — chỉ để tránh re-render nặng Workflow Panel.
- `editorApiRef` — cầu nối tới `TiptapEditorApi` (mục 2.5).
- Bố cục CSS grid 3 cột: `320px (Sidebar) | 1fr (Content/Editor) | 380px (Workflow Panel, lazy-load `dynamic(..., {ssr:false})` có skeleton)`.

Giao tiếp giữa 3 khối con **thuần bằng props callback** — không Context API, không state manager ngoài:
- `ArticleEditorSidebar(formData, setFormData, onSaveDraft)`
- `ArticleEditorContent(formData, setFormData, onEditorReady, onSaveDraft)`
- `ArticleWorkflowPanel(articleForPanel, onChecklistUpdate, onRevisionRestored, onArticleUpdated, onInsertAtCursor/onAppendToEnd/onRemoveFromEditor, onOptimizationFieldUpdated, onContentAutoUpdated)`

`onArticleUpdated`/`onRevisionRestored` đều thực hiện `window.location.reload()` — tức một số panel (Reference Images, Revision History) **không cập nhật state client mượt mà mà buộc reload cả trang** để đồng bộ lại content mới nhất từ DB.

### 3.3. Save / autosave — luồng chi tiết

- `useAutosave({ data: formData, onSave, interval: 60000, enabled: hasUnsavedChanges && !isSaving })` — tự so sánh snapshot JSON, gọi `handleSaveDraft(true)` mỗi phút nếu có thay đổi.
- `handleSaveDraft(silent)`:
  1. Parse `formData.outline` (JSON, fallback `{raw: text}` nếu không phải JSON hợp lệ).
  2. Tính `wordCount` từ content.
  3. **Tự động chuyển status**: `wordCount > 50` + status đang `idea/outlining` → tự nhảy `status='writing', sub_status='draft'`; có outline mà vẫn `idea` + word count thấp → chuyển `outlining`.
  4. Gọi `updateArticle(id, {...formData, actual_word_count})` (server action, `lib/actions/articles.ts`).
  5. Thành công: cập nhật `lastSaved`, tắt `hasUnsavedChanges`; nếu **không silent** (bấm nút Save tay) → toast + **tăng `auditTrigger`** (tự chạy lại SEO Audit, mục 3.6) + backup vào `localStorage` (nhưng bị xoá ngay ở lần mount sau — gần như vô hiệu trên thực tế).
- `beforeunload`: gọi `saveNow()` nếu còn thay đổi chưa lưu, cảnh báo rời trang.

### 3.4. Hệ thống Status/Workflow — **2 hệ thống song song, KHÔNG đồng bộ chặt**

1. **Status đơn giản** (`article.status`, dropdown ở Sidebar): `idea → outlining → writing → review → published` — đây là status thực tế người dùng thao tác, dùng để gate quyền publish.
2. **Sub-status pipeline chi tiết** (`article.sub_status`, 11 bước: idea/brief/outlining/draft/writing/editing/self_review/peer_review/approved/scheduled/published) — có component `workflow-status-bar.tsx` định nghĩa transition qua `getAllowedTransitions()`/`transitionArticleStatus()`, nhưng **component này không được mount vào cây UI đang chạy thực tế của trang edit** (chỉ tìm thấy tham chiếu trong docs, không trong `article-editor-layout/content/sidebar/workflow-panel`). `sub_status` chỉ được **hiển thị** (badge, đọc-only) trong tab "Tổng quan" của Workflow Panel, không có UI transition tại đây.

→ **Ghi chú kỹ thuật**: đây là điểm nên làm rõ/dọn dẹp — hoặc gắn `WorkflowStatusBar` vào UI thật, hoặc bỏ hẳn sub_status pipeline nếu không dùng, tránh 2 nguồn trạng thái gây nhầm lẫn khi đọc code.

### 3.5. AI generation entry points

Tất cả nằm trong `article-editor-content.tsx`, mở dialog qua state boolean cục bộ. Nội dung sinh ra **luôn cập nhật `formData.content` (string) rồi Tiptap tự re-sync qua cơ chế mục 2.6** — không có nơi nào gọi thẳng `editor.commands.setContent()` từ các dialog này (khác với `TiptapEditorApi` chỉ dùng cho chèn "see also").

| Dialog / entry point | Hành vi khi Accept | Server action |
|---|---|---|
| `GenerateContentDialog` ("AI Generate Content") | **THAY THẾ TOÀN BỘ** content (chủ đích, không append) | `generateArticleContentWithAI()` → preview → `acceptGeneratedContent()` |
| `RegenerateSectionDialog` ("Viết lại Section", cần outline có sẵn) | **APPEND** cuối content | `regenerateSection()` |
| `ABTestDialog` ("A/B Test") | Chọn A hoặc B → **APPEND** cuối content | `generateContentABTest()` |
| `CompetitorGapDialog` ("Gap Analysis") | Từng section có nút riêng → **APPEND** từng phần | `injectCompetitorGaps()` |
| `GenerateOutlineDialog` (ngoài thư mục article-editor) | Set `formData.outline`, sau đó nút "Import to Content" convert outline → khung H2/H3 rồi append | action outline riêng |
| `OptimizationAssistant` (tab "Tối ưu", panel inline không phải dialog) | Field-level (title/meta_title/meta_description) — không đụng `content` | `applyOptimizationSuggestion()` |

Nguồn dữ liệu tự động điền cho `GenerateContentDialog`: `resolveGenerationContext(articleId)` — "single source of truth" gộp từ `content_briefs`/AI Insights (primaryKeyword, objective, audience, searchIntent, wordCount, referenceUrls...), hiển thị qua thanh **completeness score** (`GenerationContextBar`). Field nào user tự sửa được đánh dấu "dirty", xem diff qua `StrategyDiffDialog` (so gốc brief vs. override, reset từng field hoặc reset tất cả).

`GenerationHistory` (tab "Phiên bản"): liệt kê lịch sử outline/content generation, xem context snapshot đã dùng, diff bằng `diff-match-patch` (`ContentDiffViewer`), cho khôi phục nội dung cũ.

### 3.6. Panel SEO / chất lượng nội dung (tóm tắt)

| Panel | Vai trò |
|---|---|
| `seo-score-panel.tsx` | Gauge điểm SEO/Readability/Tổng, nút "Phân tích SEO" (`calculateAllScores`) |
| `seo-audit-panel.tsx` | Audit lỗi SEO, **tự chạy lại khi `auditTrigger` tăng** (sau mỗi lần Save tay); auto-fix 3 loại: thêm H2 chứa keyword, chuyển sang tab Links, tự chèn câu chứa keyword vào content |
| `meta-seo-panel.tsx` | Form Meta Title/Description + đếm ký tự + preview kiểu Google SERP; nút "Gợi ý Meta AI" (`regenerateMeta`) |
| `plagiarism-panel.tsx` | Kiểm tra trùng lặp nội bộ với bài đã publish cùng project |
| `internal-link-panel.tsx` | Quản lý outgoing/incoming links, gợi ý theo topology/keyword, chèn trực tiếp qua `TiptapEditorApi` |
| `keyword-article-panel.tsx` | Gán secondary keywords (hiện đang **ẩn** trong Workflow Panel — comment: "Primary Keyword ở sidebar là đủ") |
| `product-intelligence-panel.tsx` | Chỉ hiện khi `article_type='product_review'` — phân tích sản phẩm WooCommerce + đối thủ bằng AI |
| `multilang-panel.tsx` | Tạo bản dịch bài viết (en/ja/ko/fr/zh) qua AI localization |

### 3.7. Reference/history (tóm tắt)

`revision-history.tsx` + `revision-diff-viewer.tsx` (khôi phục/so sánh revision), `content-diff-viewer.tsx` (diff bản AI-generated cũ vs. hiện tại), `comments-panel.tsx` (bình luận nội bộ theo field), `time-tracker.tsx` (estimated/actual hours), `outline-display.tsx` (hiển thị outline JSON dạng cây), `research-context-panel.tsx` + `strategy-diff-dialog.tsx` (context cho form generate), `hook-examples-modal.tsx` (modal tham khảo hook mở bài, thuần tĩnh không gọi AI).

### 3.8. Reference Images panel — quản lý metadata, KHÔNG phải công cụ chèn ảnh chủ động

`reference-images-panel.tsx`: đọc từ registry riêng `article_reference_images` (qua `getArticleReferenceImages()`), **không đọc trực tiếp chuỗi `content`**. Empty state ghi rõ: *"Ảnh sẽ được tự động inject khi bạn generate nội dung với Reference URLs"* — xác nhận việc chèn ảnh xảy ra ở backend generate (mục 4.4), panel này chỉ:
- `rejectImageAssignment()` — xoá ảnh (backend tự xoá khỏi HTML bằng regex, **không** qua Tiptap command).
- `retryFailedUpload()` — thử lại ảnh upload Cloudinary lỗi.
- `setArticleFeaturedImage()` — chọn ảnh làm `featured_image_url`.
- Mọi thay đổi ảnh → `onArticleUpdated` → **`window.location.reload()`** (không update `formData.content` mượt như các dialog AI khác).

### 3.9. Publishing — 3 luồng khác nhau, tất cả lấy `formData.content` làm nguồn

1. **`PublishConfirmationDialog`** ("Xuất bản") — **publish nội bộ**, không gửi content đi CMS nào: validate checklist (title, ≥100 từ, khuyến nghị meta, ≥80% target word count) rồi gọi `publishArticle()` chỉ update `status/published_url/published_date`. Dùng khi bài đã đăng thủ công nơi khác, chỉ cần đánh dấu.
2. **`CMSPublishDialog`** ("Publish to CMS", ẩn với `product_review`) — publish thật lên WordPress: chọn CMS connection → `POST /api/articles/{id}/publish` → route đọc **`article.content` từ DB** (không phải từ `formData` client — vì vậy sidebar tự gọi `onSaveDraft()` trước nếu còn thay đổi chưa lưu) → `mergeAndGetPublishContent()` (Smart Merge, bảo toàn ảnh/link đã sửa tay trên CMS ở lần publish trước) → `WordPressAdapter.createPost()` gửi HTML thô vào field `content` của WordPress REST API.
3. **WooCommerce path** (chỉ `product_review`, dialog riêng ngoài thư mục article-editor) — publish nội dung review vào mô tả sản phẩm WooCommerce.

`ArticlePreviewDialog` chỉ là preview client-side thuần (`dangerouslySetInnerHTML`), không gọi network.

---

## 4. Backend — Content Generation Pipeline

### 4.1. `lib/actions/content-generator.ts` — hàm sinh nội dung chính (luồng thủ công)

**`generateArticleContentWithAI(request)`** — hàm trung tâm, luồng end-to-end:

1. Auth + check quyền (owner/writer/super_admin).
2. **Gate bắt buộc**: `article.outline` phải đã có sẵn trong DB trước — content-generator chỉ sinh phần *content* từ outline có sẵn (outline được tạo ở bước/action riêng).
3. `checkAILimit(project_id)` — kiểm tra quota AI.
4. `resolveGenerationContext(articleId)` — nguồn context hợp nhất (brief/insight/article defaults).
5. RAG: `searchRelevantChunks(project_id, kbQuery, 4)` — lấy 4 đoạn Knowledge Base liên quan nhất.
6. Style: `getStyleInjectionPrompt()` + hook pool từ `hook_library_with_stats`.
7. Fetch nội dung các `referenceUrls` (nếu có).
8. Build prompt: `buildContentPrompt()` (tiếng Việt) hoặc `buildEnglishContentPrompt()` (ngôn ngữ khác).
9. **Gọi AI — đúng convention chuẩn của hệ thống:**
   ```ts
   const router = await getAIRouter()
   const { parsed, aiResponse } = await router.executeWithValidation(
     { taskType: 'content', prompt, maxTokens: 8000, userId, projectId, articleId },
     (content) => { const cleaned = cleanHtmlContent(content); if (cleaned.trim().length < 100) throw new Error(...); return cleaned },
     3, // tự retry tối đa 3 lần nếu rỗng
   )
   ```
10. **Image pipeline**: `injectReferenceImagesIntoHtml()` — chèn ảnh vào HTML vừa sinh (chi tiết mục 4.4).
11. Tính word count, reading time, keyword density, số H2.
12. Ghi log audit vào `content_generations` (context snapshot, hash, completeness score, manual overrides).
13. Ghi ảnh vào registry (`bulkInsertImageRegistryRecords`) + tự chọn ảnh điểm cao nhất làm `featured_image_url` — **không blocking** (lỗi bị nuốt).
14. Trả về `{ content, metadata, generationId }` — **KHÔNG tự ghi vào `articles.content`** ở bước này, chỉ trả bản preview cho dialog.

`cleanHtmlContent()` — dọn output AI: strip fence ```html, cắt preamble trước tag đầu tiên, xoá text self-correction rò rỉ từ model.

`acceptGeneratedContent(articleId, content, generationId?)` — **hàm ghi chính thức**: update `articles.content` + tự promote status/sub_status (idea/brief/outlining → draft/writing), đánh dấu `was_accepted=true`, cập nhật `keyword_research.lifecycle_state`, ghi usage event Learning Loop.

`checkHeadingSimilarity()` — so khớp H2/H3 bài mới với tối đa 30 bài gần nhất cùng project bằng **Jaccard similarity trên tập word-token**, cảnh báo trùng nếu ≥40-60%.

**Các hàm phụ trợ khác trong cùng file**: `regenerateSection()`, `generateContentABTest()`, `injectCompetitorGaps()` — chi tiết mục 4.9.

### 4.2. `lib/actions/content-pipeline.ts` — hệ thống hàng đợi tự động (cron)

Khác với 4.1 (luồng thủ công), đây là **orchestrator hàng đợi** cho tự động hoá quy trình brief → outline → content → review → publish, chạy nền qua cron:

- Quản lý queue: `enqueueArticle`, `approvePipelineItem`, `batchApprovePipelineItems`, `cancelPipelineItem`, `retryPipelineItem`, `schedulePipelineItem`.
- `checkDuplicateRisk()` — Jaccard trên title words + khớp keyword, cảnh báo trùng lặp trước khi enqueue.
- **Core cron**: `processPipelineBatch()` — chạy bằng service-role client (không session user), xử lý tối đa `batchSize` item `pending`/lần, có exponential backoff (30/60/120 phút), backoff riêng khi bị rate-limit AI (60 phút), giới hạn `maxArticlesPerDay`.
- `processQueueItem()` — state machine theo `stage`: `awaiting_brief → brief_ready → awaiting_outline/outline_ready → awaiting_content/content_ready → awaiting_review → ... → wc_publish_scheduled`.
- Ở stage sinh content tự động, dùng `getAdminAIRouter(supabase)` (biến thể service-role của cùng AI Router) — cũng qua chuẩn `router.execute()`.
- **Checkpoint bắt buộc**: stage `content_ready` LUÔN chuyển thành `awaiting_review` — nội dung sinh tự động qua cron **không** tự accept thẳng vào bản chính thức, vẫn cần người dùng duyệt qua UI pipeline trước khi publish.
- GEO preset khác nhau theo `content_type` (pillar/cluster/support/product_review) — ảnh hưởng cấu trúc outline tự sinh.

### 4.3. Data model `articles` (cột liên quan editor/content)

| Cột | Vai trò |
|---|---|
| `content` | HTML string — nguồn Tiptap load/lưu |
| `outline` | JSON `{ h2: [{title, h3?: [{title, points?}]}] }` |
| `status` / `sub_status` | 2 hệ thống trạng thái (mục 3.4) |
| `meta_title` / `meta_description` | SEO meta |
| `featured_image_url` | Set tự động bởi image pipeline |
| `article_type` | `standard \| product_review \| roundup \| comparison` (CHECK constraint, mặc định `standard`) |
| `content_type` | Vai trò chiến lược nội dung (`pillar_content`/`cluster_content`/`support_content`) — **khác** `article_type` |
| `wc_connection_id` / `wc_product_id` / `wc_product_snapshot` / `wc_competitor_urls` | Binding WooCommerce cho product_review |
| `seo_score` / `readability_score` / `content_score` | 0-100 |
| `last_published_to_cms_at` / `published_to_cms_count` / `last_cms_connection_id` / `published_url` | Theo dõi publish CMS |

Bảng phụ trợ: `content_generations` (audit trail mỗi lần generate), `article_reference_images` (registry ảnh), `content_pipeline_queue` (hàng đợi cron).

### 4.4. Image pipeline — `lib/services/reference-image-pipeline.ts` (2063 dòng)

Hàm chính `injectReferenceImagesIntoHtml()`:

1. Yêu cầu Cloudinary đã cấu hình per-project — nếu chưa, bỏ qua toàn bộ bước ảnh.
2. `stripPipelineFigures()` — xoá các `<figure class="wp-block-image">` do pipeline chèn ở lần chạy trước (nhận diện qua class + domain `res.cloudinary.com`), để lần chạy mới chèn lại đúng vị trí (idempotent).
3. **Path 0**: re-host ảnh ngoại lai có sẵn trong content lên Cloudinary tại chỗ.
4. Trích toàn bộ heading H2/H3 của bài.
5. Build candidate pool ảnh:
   - **Path A** (`directImages`, ví dụ `wc_product_snapshot.images`) — điểm chất lượng cao nhất (0.78-0.9).
   - **Path B** (scrape `referenceUrls` bằng cheerio, fallback regex) — điểm tối đa 0.74, luôn thấp hơn Path A.
6. **Matching ảnh ↔ heading**:
   - Chỉ gán cho H3, hoặc H2 không có H3 con (tránh 2 ảnh chồng trong 1 section).
   - Điểm ưu tiên **Gemini text-embedding-004 cosine similarity** (nếu có `GEMINI_API_KEY`), fallback **Jaccard similarity trên word-token** (đúng như ghi nhận trong memory dự án).
   - Công thức: `headingScore*0.50 + titleScore*0.15 + sectionBonus*0.20 + containsBoost(0.2) + qualityBoost(quality*0.25) + heroPenalty + sectionHintBonus`.
   - `getContextAdjustedQuality()` — **phạt điểm** ảnh scraped (Path B) nếu context (heading+text quanh ảnh) không có ≥25% token trùng với tiêu đề bài viết → chặn ảnh lạc đề.
   - Ngưỡng nhận tối thiểu `DEFAULT_MIN_HEADING_SCORE = 0.35`.
7. Validate ảnh (≥300px), normalize JPEG, **dedup 2 lớp**: SHA-256 raw bytes + **perceptual dHash** (Hamming distance) — chặn cả ảnh trùng thị giác dù khác URL nguồn.
8. Upload Cloudinary (retry 2 lần, cache theo URL gốc).
9. **Chèn HTML**: trong phạm vi mỗi section (ranh giới xác định bởi heading kế tiếp), tìm đoạn `<p>` có Jaccard similarity cao nhất với context ảnh (ngưỡng 0.12) để chèn ngay sau — fallback chèn cuối section nếu không tìm được. HTML chèn:
   ```html
   <figure class="wp-block-image aligncenter size-large">
     <img src="..." alt="{heading text}" loading="lazy" decoding="async" style="max-width:100%;height:auto;..." />
   </figure>
   ```
   (chuẩn WordPress Gutenberg — xem lưu ý rủi ro Tiptap ở mục 2.3). `alt` = text của heading gắn ảnh (SEO rule: alt mô tả đúng section).

### 4.5. `lib/actions/image-registry.ts` — vòng đời ảnh (bảng `article_reference_images`)

`findCachedImageByHash()`, `bulkInsertImageRegistryRecords()` (dedup theo hash URL gốc), `getArticleReferenceImages()` (đọc cho UI), `rejectImageAssignment()` (xoá `<img>` khỏi `articles.content` bằng regex + đánh dấu registry — **sửa content trực tiếp, không qua Tiptap**, cần lưu ý đồng bộ nếu editor đang mở), `retryFailedUpload()`, `setArticleFeaturedImage()` (tự động chọn ảnh điểm cao nhất), `getProjectImageStats()`.

### 4.6. SEO Audit auto-run — kích hoạt ở CLIENT, không phải trong server action generate

`generateArticleContentWithAI()`/`acceptGeneratedContent()` **không** tự gọi audit. Việc auto-run diễn ra sau khi người dùng **bấm Save tay** (không phải autosave silent):

```ts
// article-editor-layout.tsx
if (result.success && !silent) {
  toast.success('✅ Draft saved successfully')
  setAuditTrigger(prev => prev + 1)   // kích hoạt SEO Audit panel tự chạy
}
```
```ts
// seo-audit-panel.tsx
useEffect(() => {
  if (!articleId || (auditTrigger ?? 0) <= 0) return
  handleRunAudit()   // → runSeoAudit(articleId)
}, [auditTrigger])
```

### 4.7. `article_type` — chỉ `product_review` có nhánh logic sinh nội dung riêng

- `product_review`: luồng riêng `lib/actions/wc-review-generator.ts` → `generateProductReviewContent()` — dùng `buildReviewPrompt()` (khác `buildContentPrompt`), tích hợp `wc_product_intelligence`, chọn "opening mode" (comparison_verdict/use_case_snapshot/feature_to_outcome...) theo outline; cũng qua `getAIRouter().executeWithValidation()`. Trong cron pipeline có GEO preset riêng (`formatPriority: 'list_heavy'`, `serpTarget: ['review_schema','faq_schema']`).
- `roundup` và `comparison`: tồn tại trong enum/CHECK constraint và interface `Article` nhưng **không tìm thấy nhánh logic generate riêng** — hiện là placeholder chưa triển khai riêng, hoặc được xử lý gộp qua `content_type`/outline chung.

### 4.8. Knowledge Base / Brand profile — 2 cơ chế TÁCH RỜI (điểm cần lưu ý)

1. **RAG chunk retrieval** (dùng trong content-generator.ts): `searchRelevantChunks()` — embed câu query, RPC Supabase `search_knowledge_chunks` (pgvector, ngưỡng similarity 0.6), nối trực tiếp chunk text vào cuối prompt.
2. **Brand profile block** (`getProjectBrandProfileForPrompt()`) — gộp `ai_analysis` (brand_name, products, usps, audience, tone...) từ toàn bộ `knowledge_documents` đã phân tích. **Hàm này KHÔNG được gọi trong `content-generator.ts`** — chỉ dùng ở `social-posts.ts`, `topics.ts` (brainstorm), `wc-product-intelligence.ts`.

Trong luồng sinh content bài viết chính, "brand voice" thực tế lấy từ **`projects.brand_voice_sample`** (cột text đơn giản) hoặc `resolvedCtx.research.brandVoice` — **KHÔNG PHẢI** block Brand Profile đầy đủ từ Knowledge Base. → Đây là khoảng hở tích hợp: brand voice của content generation chính và brand profile của Knowledge Base hiện là 2 nguồn dữ liệu độc lập, chưa hợp nhất.

### 4.9. A/B Test & Regenerate Section — xác nhận chi tiết triển khai

**`regenerateSection(articleId, sectionHeading, instruction?, language?)`**: build prompt chỉ yêu cầu viết lại 1 section (≥`<h2>`, 250-500 từ), gọi:
```ts
const result = await router.execute({
  taskType: 'content', prompt: sectionPrompt, maxTokens: 2000, temperature: 0.6, ...
})
```
Dùng `router.execute()` (KHÔNG có validation/retry tự động như `executeWithValidation`).

**`generateContentABTest(request)`**: sinh song song 2 phiên bản qua `Promise.all`:
```ts
const [resultA, resultB] = await Promise.all([
  router.execute({ ..., prompt: prompt + '\nSTYLE: Conservative...', temperature: 0.3 }),  // "Phiên bản A (Chuẩn)"
  router.execute({ ..., prompt: prompt + '\nSTYLE: Creative...', temperature: 0.85 }),       // "Phiên bản B (Sáng tạo)"
])
```
Cả 2 dùng chung prompt gốc (đầy đủ KB chunks + style + brief context), chỉ khác đoạn STYLE instruction nối thêm và temperature. Khớp đúng quy ước đã ghi nhận trong hệ thống: **A/B test = cùng model, khác nhiệt độ (0.3 conservative vs 0.85 creative)**.

---

## 5. Tổng hợp điểm cần lưu ý kỹ thuật

1. **HTML thô là "định dạng trung tâm"** — không có ProseMirror JSON, không Markdown. Mọi thay đổi ở backend (image pipeline, reject ảnh) hay frontend (Tiptap) đều thao tác trực tiếp trên chuỗi HTML → dễ vỡ nếu 2 bên không thống nhất cấu trúc thẻ (xem điểm 2 dưới).
2. **`<figure class="wp-block-image">` vs. Tiptap Image extension** — pipeline backend chèn ảnh bọc trong `<figure>`, nhưng Tiptap chỉ có Node cho `<img>` trần, không có Node cho `<figure>`. Cần kiểm chứng: sau khi user mở bài trong Tiptap rồi lưu lại, `<figure>` wrapper (và class `wp-block-image`) có bị mất không — ảnh hưởng style khi publish lại lên WordPress.
3. **2 hệ thống status song song không đồng bộ** (`status` 5-bước đang dùng thật vs. `sub_status` 11-bước có sẵn nhưng `WorkflowStatusBar` chưa được mount vào UI thật) — nên dọn dẹp hoặc kết nối lại.
4. **Brand Profile (Knowledge Base) chưa được dùng trong content-generator.ts chính** — bài viết SEO chỉ nhận `brand_voice_sample` (field đơn giản), trong khi module Social Posts/Brainstorm Topic đã dùng bản đầy đủ `getProjectBrandProfileForPrompt()`. Là cơ hội cải thiện nếu muốn đồng nhất chất lượng brand voice.
5. **`rejectImageAssignment()` sửa `articles.content` bằng regex trực tiếp trong DB**, không đi qua Tiptap — nếu editor đang mở ở tab khác cùng lúc, có thể ghi đè ngược lại ảnh vừa xoá khi tab đó autosave.
6. **`router.execute()` (không validate/retry) vs. `router.executeWithValidation()` (có retry 3 lần)** — luồng generate chính (`generateArticleContentWithAI`, `generateProductReviewContent`) dùng bản có retry; các thao tác phụ (`regenerateSection`, A/B test, competitor gap, cron content) dùng bản trần — rủi ro cao hơn nếu AI provider trả rỗng ở các luồng phụ này.
7. **Cloudinary upload trong Tiptap chỉ wire cho System Blog**, Article Editor chính và Affiliate Review Editor chỉ nhận URL — ảnh trong bài SEO chủ yếu tới từ image pipeline tự động (mục 4.4), không phải thao tác tay qua toolbar.
8. **`roundup`/`comparison` (`article_type`) chưa có logic generate riêng** — hiện dùng chung luồng `standard`.
9. **localStorage backup trong `handleSaveDraft`** gần như vô hiệu trên thực tế (bị xoá ngay ở lần mount kế tiếp) — không nên coi đây là cơ chế chống mất dữ liệu thật.

---

*Báo cáo tổng hợp từ nghiên cứu trực tiếp mã nguồn (đối chiếu file + số dòng thực tế tại thời điểm 2026-09-19), không suy đoán từ tên file/thư mục.*

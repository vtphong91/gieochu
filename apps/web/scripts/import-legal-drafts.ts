/**
 * ADR-057 mục 1 — nạp 7 dự thảo chính sách (`docs/legal/drafts/*.md`) vào CMS thành **bản nháp (DRAFT)**. KHÔNG xuất bản,
 * KHÔNG sửa bản đã PUBLISHED/ARCHIVED. Đi qua đúng lib `apps/web/lib/legal.ts` (sanitize `trustedLinks`, luật trạng thái)
 * như editor `/admin/cms/phap-ly`, và ghi `audit_logs` `LEGAL_VERSION_CREATED/UPDATED` với actor là SYSTEM_ADMIN.
 *
 *   pnpm --filter @gieochu/web run legal:import-drafts -- --actor-email=<email admin>            # chạy thử (mặc định)
 *   pnpm --filter @gieochu/web run legal:import-drafts -- --actor-email=<email admin> --apply    # ghi DB thật
 *
 * DB dùng chung với production (ADR-034) — chạy thử trước, gửi output cho Quốc, chỉ `--apply` khi đã được duyệt.
 *
 * Mỗi file: chỉ lấy phần nội dung — từ H2 đầu tiên (khớp mục "chỉ chép phần từ …" trong khối dẫn) tới dòng `---` đứng
 * trước "**Ghi chú nội bộ"; bỏ khối dẫn đầu file và phần ghi chú nội bộ. Markdown → HTML (`marked`) → `sanitizeLegalHtml`.
 * Giữ nguyên `{brand}` và `[[CẦN XÁC NHẬN: …]]` (đếm trước/sau để chắc không mất). Chỉ cho H2/H3.
 *
 * Hành động theo văn bản (idempotent):
 *  - đã có một phiên bản bất kỳ trùng HTML → SKIP;
 *  - có bản DRAFT nội dung trống → UPDATE bản đó (bản trống mới nhất);
 *  - còn lại → CREATE phiên bản DRAFT mới.
 * Văn bản `contact` còn tiêu đề cũ "Liên hệ và thông tin pháp lý" → đổi sang tiêu đề trong code (ADR-057 mục 4).
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { marked } from "marked";
import { LEGAL_DOCUMENT_DEFS, LEGAL_PLACEHOLDER_MARKER, type LegalDocumentKey } from "@gieochu/core";
import { getPrismaClient } from "@gieochu/db";
import { audit } from "../lib/audit";
import { createLegalDraft, sanitizeLegalHtml, updateLegalDraft } from "../lib/legal";

const SOURCE = "import-legal-drafts";

const DRAFT_FILES: ReadonlyArray<{ file: string; key: LegalDocumentKey }> = [
  { file: "dieu-khoan-su-dung.md", key: "terms" },
  { file: "chinh-sach-bao-mat.md", key: "privacy" },
  { file: "chinh-sach-noi-dung.md", key: "content_policy" },
  { file: "cam-ket-ban-quyen.md", key: "copyright" },
  { file: "quyen-su-dung-tai-lieu.md", key: "usage_license" },
  { file: "chinh-sach-nguoi-ban.md", key: "seller" },
  { file: "lien-he.md", key: "contact" },
];

/** Tiêu đề cũ trong DB được phép thay bằng tiêu đề trong code (không đè tiêu đề khác). */
const LEGACY_TITLES: Partial<Record<LegalDocumentKey, string>> = { contact: "Liên hệ và thông tin pháp lý" };

const DRAFTS_DIR = fileURLToPath(new URL("../../../docs/legal/drafts/", import.meta.url));

interface Args {
  apply: boolean;
  actorEmail: string | null;
}

function parseArgs(argv: readonly string[]): Args {
  let apply = false;
  let actorEmail: string | null = null;
  for (const arg of argv) {
    if (arg === "--") continue;
    if (arg === "--apply") apply = true;
    else if (arg === "--dry-run") apply = false;
    else if (arg.startsWith("--actor-email=")) actorEmail = arg.slice("--actor-email=".length).trim().toLowerCase() || null;
    else throw new Error(`Tham số không hợp lệ: ${arg}`);
  }
  return { apply, actorEmail };
}

function countOccurrences(text: string, needle: string): number {
  return text.split(needle).length - 1;
}

function plainText(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").trim();
}

interface ExtractedDraft {
  key: LegalDocumentKey;
  file: string;
  html: string;
  h2: number;
  h3: number;
  placeholders: number;
  brandTokens: number;
  firstHeading: string;
  lastHeading: string;
}

/** Lấy phần nội dung theo quy ước nhập trong khối dẫn của chính file; sai cấu trúc → ném lỗi (không đoán). */
function extractDraft(file: string, key: LegalDocumentKey): ExtractedDraft {
  const raw = readFileSync(`${DRAFTS_DIR}${file}`, "utf8").replace(/\r\n/g, "\n");
  const lines = raw.split("\n");
  const start = lines.findIndex((line) => line.startsWith("## "));
  if (start < 0) throw new Error(`${file}: không thấy tiêu đề H2 nào.`);
  const lead = lines.slice(0, start);
  if (lead.some((line) => line.trim() !== "" && !line.startsWith(">"))) throw new Error(`${file}: trước H2 đầu tiên có dòng không thuộc khối dẫn.`);

  const leadText = lead.map((line) => line.replace(/^>\s?/, "")).join(" ").replace(/\s+/g, " ");
  const rule = /chỉ chép phần từ "([^"]+)" đến hết mục "([^"]+)"/.exec(leadText);
  if (!rule) throw new Error(`${file}: không đọc được quy ước "chỉ chép phần từ … đến hết mục …" trong khối dẫn.`);
  const [, fromHeading, toHeading] = rule as unknown as [string, string, string];

  let end = -1;
  for (let i = start; i < lines.length; i += 1) {
    if (lines[i]!.trim() !== "---") continue;
    const next = lines.slice(i + 1).find((line) => line.trim() !== "");
    if (next?.startsWith("**Ghi chú nội bộ")) {
      end = i;
      break;
    }
  }
  if (end < 0) throw new Error(`${file}: không thấy ranh giới "---" + "**Ghi chú nội bộ".`);

  const body = lines.slice(start, end);
  const headings = body.filter((line) => /^#{1,6}\s/.test(line));
  const bad = headings.filter((line) => !/^#{2,3}\s/.test(line));
  if (bad.length > 0) throw new Error(`${file}: chỉ cho H2/H3, gặp "${bad[0]}".`);
  const h2Lines = headings.filter((line) => line.startsWith("## "));
  const firstHeading = h2Lines[0]!.slice(3).trim();
  const lastHeading = h2Lines[h2Lines.length - 1]!.slice(3).trim();
  if (firstHeading !== fromHeading) throw new Error(`${file}: H2 đầu "${firstHeading}" khác quy ước "${fromHeading}".`);
  if (lastHeading !== toHeading) throw new Error(`${file}: H2 cuối "${lastHeading}" khác quy ước "${toHeading}".`);

  const markdown = body.join("\n").trim();
  const rendered = marked.parse(markdown, { async: false, gfm: true, breaks: false });
  // Gọn như HTML editor sinh ra: bỏ xuống dòng giữa các thẻ, xuống dòng mềm trong đoạn → dấu cách.
  const compact = rendered.replace(/>\s*\n\s*</g, "><").replace(/\s*\n\s*/g, " ").trim();
  const html = sanitizeLegalHtml(compact);

  if (/<h[1456][\s>]/.test(html)) throw new Error(`${file}: HTML sau sanitize có tiêu đề ngoài H2/H3.`);
  const placeholdersMd = countOccurrences(markdown, LEGAL_PLACEHOLDER_MARKER);
  const placeholders = countOccurrences(html, LEGAL_PLACEHOLDER_MARKER);
  if (placeholders !== placeholdersMd) throw new Error(`${file}: số placeholder đổi sau chuyển đổi (${placeholdersMd} → ${placeholders}).`);
  const brandMd = countOccurrences(markdown, "{brand}");
  const brandTokens = countOccurrences(html, "{brand}");
  if (brandTokens !== brandMd) throw new Error(`${file}: số token {brand} đổi sau chuyển đổi (${brandMd} → ${brandTokens}).`);
  const h2 = countOccurrences(html, "<h2>");
  const h3 = countOccurrences(html, "<h3>");
  if (h2 !== h2Lines.length) throw new Error(`${file}: số H2 đổi sau chuyển đổi (${h2Lines.length} → ${h2}).`);

  return { key, file, html, h2, h3, placeholders, brandTokens, firstHeading, lastHeading };
}

type Plan =
  | { kind: "SKIP"; reason: string }
  | { kind: "UPDATE"; versionId: string; version: number }
  | { kind: "CREATE"; nextVersion: number };

async function planFor(draft: ExtractedDraft): Promise<{ plan: Plan; docExists: boolean; title: string | null; versionsSummary: string }> {
  const doc = await getPrismaClient().legalDocument.findUnique({
    where: { key: draft.key },
    select: { title: true, versions: { select: { id: true, version: true, status: true, contentHtml: true }, orderBy: { version: "desc" } } },
  });
  const versions = doc?.versions ?? [];
  const versionsSummary = versions.length === 0 ? "chưa có" : versions.map((v) => `v${v.version}:${v.status}${plainText(v.contentHtml) ? "" : "(trống)"}`).join(", ");
  const same = versions.find((v) => v.contentHtml === draft.html);
  if (same) return { plan: { kind: "SKIP", reason: `đã có v${same.version} (${same.status}) trùng nội dung` }, docExists: doc !== null, title: doc?.title ?? null, versionsSummary };
  const emptyDraft = versions.find((v) => v.status === "DRAFT" && plainText(v.contentHtml) === "");
  if (emptyDraft) return { plan: { kind: "UPDATE", versionId: emptyDraft.id, version: emptyDraft.version }, docExists: true, title: doc!.title, versionsSummary };
  return { plan: { kind: "CREATE", nextVersion: (versions[0]?.version ?? 0) + 1 }, docExists: doc !== null, title: doc?.title ?? null, versionsSummary };
}

async function resolveActor(email: string): Promise<{ id: string; email: string }> {
  const user = await getPrismaClient().user.findUnique({ where: { email }, select: { id: true, email: true, systemRole: true, status: true } });
  if (!user) throw new Error(`Không tìm thấy user ${email}.`);
  if (user.systemRole !== "SYSTEM_ADMIN") throw new Error(`${email} không phải SYSTEM_ADMIN.`);
  if (user.status !== "ACTIVE") throw new Error(`${email} không ở trạng thái ACTIVE.`);
  return { id: user.id, email: user.email };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  loadEnv({ path: fileURLToPath(new URL("../../../.env", import.meta.url)), quiet: true });

  const mode = args.apply ? "CHẠY THẬT (--apply)" : "CHẠY THỬ (dry-run, không ghi DB)";
  console.log(`[legal-import] ${mode}`);
  if (args.apply && !args.actorEmail) throw new Error("--apply cần --actor-email=<email SYSTEM_ADMIN>.");
  const actor = args.actorEmail ? await resolveActor(args.actorEmail) : null;
  console.log(`[legal-import] actor: ${actor ? `${actor.email} (SYSTEM_ADMIN)` : "(chưa truyền --actor-email — chỉ chạy thử)"}`);

  // Bước 1: đọc + chuyển đổi cả 7 file trước — một file lỗi thì dừng, không ghi gì.
  const drafts = DRAFT_FILES.map(({ file, key }) => extractDraft(file, key));
  const plans = [];
  for (const draft of drafts) plans.push({ draft, ...(await planFor(draft)) });

  console.log("");
  for (const { draft, plan, docExists, title, versionsSummary } of plans) {
    const def = LEGAL_DOCUMENT_DEFS[draft.key];
    const action =
      plan.kind === "SKIP" ? `SKIP — ${plan.reason}` : plan.kind === "UPDATE" ? `UPDATE bản nháp trống v${plan.version}` : `CREATE bản nháp mới v${plan.nextVersion}`;
    const titleFix = title !== null && LEGACY_TITLES[draft.key] === title && title !== def.title ? `; đổi tiêu đề "${title}" → "${def.title}"` : "";
    console.log(`- ${draft.key} ← ${draft.file}`);
    console.log(`    văn bản: ${docExists ? `có ("${title}")` : `chưa có — sẽ tạo ("${def.title}", /${def.slug})`}; phiên bản hiện có: ${versionsSummary}`);
    console.log(`    nội dung: "${draft.firstHeading}" … "${draft.lastHeading}"; HTML ${draft.html.length} ký tự; H2 ${draft.h2}, H3 ${draft.h3}; placeholder ${draft.placeholders}; {brand} ${draft.brandTokens}`);
    console.log(`    hành động: ${action}${titleFix}`);
  }

  if (!args.apply) {
    console.log("\n[legal-import] Chạy thử xong — không ghi gì. Thêm --apply (kèm --actor-email) để ghi.");
    return;
  }

  // Bước 2: ghi — chỉ tạo/điền bản DRAFT, không xuất bản.
  console.log("");
  const prisma = getPrismaClient();
  for (const { draft, plan, title } of plans) {
    const def = LEGAL_DOCUMENT_DEFS[draft.key];
    if (title !== null && LEGACY_TITLES[draft.key] === title && title !== def.title) {
      await prisma.legalDocument.update({ where: { key: draft.key }, data: { title: def.title } });
      await audit.log({
        actorId: actor!.id,
        scope: "SYSTEM",
        action: "LEGAL_DOCUMENT_META_UPDATED",
        targetType: "LegalDocument",
        targetId: draft.key,
        metadata: { key: draft.key, titleUpdated: true, source: SOURCE },
        ip: null,
        userAgent: null,
      });
      console.log(`  ${draft.key}: đã đổi tiêu đề → "${def.title}"`);
    }
    const changeSummary = `Nạp dự thảo từ docs/legal/drafts/${draft.file} (ADR-057).`;
    if (plan.kind === "SKIP") {
      console.log(`  ${draft.key}: bỏ qua (${plan.reason})`);
      continue;
    }
    if (plan.kind === "UPDATE") {
      const row = await updateLegalDraft(draft.key, plan.versionId, { contentHtml: draft.html, changeSummary });
      await audit.log({
        actorId: actor!.id,
        scope: "SYSTEM",
        action: "LEGAL_VERSION_UPDATED",
        targetType: "LegalDocumentVersion",
        targetId: row.id,
        metadata: { key: draft.key, version: row.version, source: SOURCE },
        ip: null,
        userAgent: null,
      });
      console.log(`  ${draft.key}: đã điền bản nháp v${row.version} (${row.id}) — ${row.status}, ${row.reviewStatus}`);
      continue;
    }
    const row = await createLegalDraft(def, { contentHtml: draft.html, changeSummary, actorId: actor!.id });
    await audit.log({
      actorId: actor!.id,
      scope: "SYSTEM",
      action: "LEGAL_VERSION_CREATED",
      targetType: "LegalDocumentVersion",
      targetId: row.id,
      metadata: { key: draft.key, version: row.version, source: SOURCE },
      ip: null,
      userAgent: null,
    });
    console.log(`  ${draft.key}: đã tạo bản nháp v${row.version} (${row.id}) — ${row.status}, ${row.reviewStatus}`);
  }
  console.log("\n[legal-import] Xong. Không xuất bản phiên bản nào.");
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error("\n[legal-import] LỖI:", error instanceof Error ? error.message : error);
    process.exit(1);
  });

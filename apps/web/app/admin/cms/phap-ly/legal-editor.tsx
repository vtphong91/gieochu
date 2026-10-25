"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { brandColors } from "@gieochu/config/theme";
import { DISPLAY_TIME_ZONE } from "@gieochu/core/system-settings";
import { countLegalPlaceholders, LEGAL_ERROR_CODES, LEGAL_PLACEHOLDER_MARKER, type LegalDocumentKey } from "@gieochu/core/legal";
import type { LegalEditorData } from "../../../../lib/legal";
import { TiptapEditor } from "../../../_ui/editor/tiptap-editor";
import { Badge, ConfigCard, FormBanner, TextField } from "../../_ui/kit";
import { IconAlertTriangle, IconDoc, IconExternalLink, IconEye, IconShield } from "../../_ui/icons";
import { useUnsavedChanges, useLeaveGuard } from "../../_ui/unsaved-changes";
import { publishLegalAction, saveLegalDraftAction, setLegalReviewAction, type LegalActionState } from "./actions";

/** Một ô trong hàng chọn văn bản (page.tsx tính sẵn nhãn trạng thái — không chỉ dựa màu). */
export interface LegalDocumentTab {
  key: LegalDocumentKey;
  title: string;
  href: string;
  current: boolean;
  statusLabel: string;
  statusTone: "neutral" | "info" | "success" | "warning";
  /** Đã xuất bản nhưng có bản nháp chưa xuất bản. */
  hasUnpublishedChanges: boolean;
}

type BadgeTone = LegalDocumentTab["statusTone"];
type PendingKind = "save" | "review" | "publish";

const INK = brandColors.ink;
const INK_SOFT = "#6B7280";
const LINE = "#E5E7EB";
const AMBER = "#B45309";
const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-primary,#0F3B82)]";
// Cùng class nút của kit (PrimaryButton/GhostButton) nhưng giữ 44px ở mọi cỡ trong sidebar hẹp (dễ bấm, cân hàng nút).
const PRIMARY_BTN = `inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none ${FOCUS}`;
const GHOST_BTN = `inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border bg-white px-3 py-2.5 text-sm font-semibold transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none ${FOCUS}`;
const CHECKBOX = "mt-0.5 h-[18px] w-[18px] shrink-0 cursor-pointer accent-[color:var(--brand-primary,#0F3B82)] disabled:cursor-not-allowed";

const dateTimeFormat = new Intl.DateTimeFormat("vi-VN", {
  timeZone: DISPLAY_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function formatIso(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : dateTimeFormat.format(date);
}

function laterIso(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return new Date(a).getTime() >= new Date(b).getTime() ? a : b;
}

/** `2026-10-24T08:30` (ô datetime-local, giờ VN) → "08:30 24/10/2026 (giờ Việt Nam)" để đọc trong hộp xác nhận. */
function describeLocalDateTime(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  return match ? `${match[4]}:${match[5]} ${match[3]}/${match[2]}/${match[1]} (giờ Việt Nam)` : value;
}

function isBlankHtml(html: string): boolean {
  return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim() === "";
}

/** Lỗi 409 "vừa được thay đổi ở nơi khác" — nhận diện theo mã lỗi action trả về (`LegalActionState.code`). */
function isConflictError(result: LegalActionState): boolean {
  return result.code === LEGAL_ERROR_CODES.CONFLICT;
}

/**
 * Editor "Chính sách sử dụng" (ADR-057 bổ sung) — mỗi văn bản MỘT nội dung, không lộ phiên bản. Bố cục thống nhất editor
 * bài viết/tài liệu Studio: cột chính (nội dung Tiptap + khối "Tối ưu SEO" thu gọn) và sidebar phải "Xuất bản" (trạng thái,
 * "Cập nhật lúc…", rà soát, công bố dạng dự thảo, ngày hiệu lực, Lưu nháp / Xem trước / Xuất bản, lý do bị chặn). Dưới xl
 * sidebar xuống dưới nội dung + thanh lưu nhanh dính đáy khi nút của sidebar khuất. Mọi action gửi `expectedUpdatedAt`
 * (mốc bản nháp làm việc đang biết; `null` = chưa có nháp) và cập nhật mốc theo kết quả. Server kiểm lại mọi luật.
 */
export function LegalEditor({
  data,
  documents,
  seo,
  draftReleaseAvailable = false,
}: {
  data: LegalEditorData;
  documents: LegalDocumentTab[];
  /** Khối "Tối ưu SEO" (thu gọn được) — đặt dưới nội dung trong cột chính. */
  seo: ReactNode;
  /** ADR-057 mục 3: server đã bật công bố dạng bản dự thảo (cần migration). Chưa có cờ từ server → mặc định tắt. */
  draftReleaseAvailable?: boolean;
}) {
  const router = useRouter();
  const key = data.key;
  const [content, setContent] = useState(data.editorContentHtml);
  const [savedContent, setSavedContent] = useState(data.editorContentHtml);
  // Mốc `updatedAt` của bản nháp làm việc editor đang biết — gửi kèm mọi action; `null` = chưa có bản nháp.
  const [expected, setExpected] = useState<string | null>(data.draft?.updatedAt ?? null);
  const [localApproved, setLocalApproved] = useState(data.draft?.reviewStatus === "APPROVED");
  const [localUpdatedAt, setLocalUpdatedAt] = useState<string | null>(null);
  const [effectiveAt, setEffectiveAt] = useState("");
  const [asDraftRelease, setAsDraftRelease] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string; conflict?: boolean } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [pendingKind, setPendingKind] = useState<PendingKind | null>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const [actionsInView, setActionsInView] = useState(true);

  const dirty = content !== savedContent;
  const hasDraft = expected !== null;
  // Dữ liệu server (sau router.refresh) khớp mốc đang biết → tin server; chưa khớp → giá trị vừa nhận từ action.
  const serverInSync = data.draft !== null && data.draft.updatedAt === expected;
  const approved = serverInSync ? data.draft!.reviewStatus === "APPROVED" : hasDraft && localApproved;
  const unpublishedChanges = hasDraft && (serverInSync ? data.hasUnpublishedChanges : true);
  const lastUpdatedLabel = formatIso(laterIso(data.lastUpdatedAt, localUpdatedAt));
  const published = data.published;
  const placeholderCount = countLegalPlaceholders(content);
  const draftReleaseOn = draftReleaseAvailable && asDraftRelease;
  const busy = (kind: PendingKind) => isPending && pendingKind === kind;

  // ADR-058 mục 5: cờ "chưa lưu" đăng ký với provider của layout (beforeunload chung + chặn sidebar/tab/chọn văn bản).
  useUnsavedChanges(dirty, "Nội dung văn bản có thay đổi chưa lưu. Rời trang và bỏ thay đổi?");
  const guardLeave = useLeaveGuard();

  // Thanh lưu nhanh chỉ hiện khi khối nút của sidebar khuất khỏi màn hình.
  useEffect(() => {
    const node = actionsRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setActionsInView(entry?.isIntersecting ?? true));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // ── Lý do chưa xuất bản được (server kiểm lại) ──
  const blockers: string[] = [];
  if (dirty) blockers.push("Còn thay đổi chưa lưu — bấm Lưu nháp trước.");
  else if (!hasDraft) blockers.push(published ? "Nội dung chưa thay đổi so với bản đang xuất bản." : "Chưa có nội dung — soạn rồi bấm Lưu nháp.");
  if (isBlankHtml(content)) blockers.push("Nội dung trống.");
  if (!draftReleaseOn) {
    if (placeholderCount > 0) blockers.push(`Còn ${placeholderCount} chỗ “${LEGAL_PLACEHOLDER_MARKER}…” — điền đủ thông tin.`);
    if (hasDraft && !approved) blockers.push("Chưa tích “Đã rà soát nội dung”.");
  }
  const canPublish = blockers.length === 0;

  function run(kind: PendingKind, task: () => Promise<LegalActionState>, onSuccess: (result: LegalActionState) => string) {
    setPendingKind(kind);
    setMessage(null);
    startTransition(async () => {
      const result = await task();
      if (result.success) {
        setMessage({ ok: true, text: onSuccess(result) });
        router.refresh();
      } else {
        const text = result.error ?? "Thao tác thất bại. Thử lại sau.";
        setMessage({ ok: false, text, conflict: isConflictError(result) });
      }
    });
  }

  function save() {
    const sent = content;
    run(
      "save",
      () => saveLegalDraftAction(key, sent, expected),
      (result) => {
        setSavedContent(sent);
        if (result.unchanged) return "Nội dung trùng bản đang xuất bản — không có gì cần lưu.";
        if (result.updatedAt) {
          setExpected(result.updatedAt);
          setLocalUpdatedAt(result.updatedAt);
        }
        // Lưu nội dung đã đổi → server đưa rà soát về "Chờ rà soát".
        setLocalApproved(false);
        return "Đã lưu nháp. Nội dung thay đổi nên cần tích lại “Đã rà soát nội dung” trước khi xuất bản.";
      },
    );
  }

  function toggleReview(next: boolean) {
    run(
      "review",
      () => setLegalReviewAction(key, next, expected),
      (result) => {
        setLocalApproved(next);
        if (result.updatedAt) {
          setExpected(result.updatedAt);
          setLocalUpdatedAt(result.updatedAt);
        }
        return next ? "Đã đánh dấu đã rà soát nội dung." : "Đã bỏ đánh dấu rà soát.";
      },
    );
  }

  function publish() {
    const when = effectiveAt ? `có hiệu lực từ ${describeLocalDateTime(effectiveAt)}` : "có hiệu lực ngay";
    const kind = draftReleaseOn ? "dạng BẢN DỰ THẢO (không dùng để ghi nhận đồng ý)" : "bản chính thức";
    const ok = window.confirm(
      `Xuất bản “${data.title}” — ${kind}, ${when}?\n\nKhi có hiệu lực, trang công khai${draftReleaseOn ? "" : ", link menu/footer và các form ghi chấp thuận"} sẽ dùng nội dung này.`,
    );
    if (!ok) return;
    run(
      "publish",
      () => publishLegalAction(key, { effectiveAtLocal: effectiveAt, asDraftRelease: draftReleaseOn }, expected),
      (result) => {
        // Bản nháp làm việc đã thành bản xuất bản → không còn nháp; lần sửa sau tự tạo nháp mới.
        setExpected(null);
        setLocalApproved(false);
        setEffectiveAt("");
        setAsDraftRelease(false);
        if (result.updatedAt) setLocalUpdatedAt(result.updatedAt);
        return effectiveAt ? `Đã xuất bản — có hiệu lực từ ${describeLocalDateTime(effectiveAt)}.` : "Đã xuất bản — trang công khai đã cập nhật.";
      },
    );
  }

  // ── Trạng thái hiển thị (chữ + màu) ──
  let statusBadge: { tone: BadgeTone; label: string };
  if (published?.isEffective) statusBadge = { tone: "success", label: "Đã xuất bản" };
  else if (published) statusBadge = { tone: "warning", label: "Hẹn hiệu lực" };
  else if (hasDraft) statusBadge = { tone: "info", label: "Nháp — chưa xuất bản" };
  else statusBadge = { tone: "neutral", label: "Chưa có nội dung" };

  let saveState: ReactNode;
  if (isPending) saveState = pendingKind === "publish" ? "Đang xuất bản…" : pendingKind === "review" ? "Đang cập nhật rà soát…" : "Đang lưu nháp…";
  else if (dirty)
    saveState = (
      <span className="inline-flex items-center gap-2 font-semibold" style={{ color: AMBER }}>
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: AMBER }} aria-hidden="true" />
        Có thay đổi chưa lưu
      </span>
    );
  else saveState = "Đã lưu mọi thay đổi.";

  const showQuickBar = !actionsInView && (dirty || isPending);

  return (
    <div className="legal-editor">
      <nav aria-label="Chọn văn bản" className="mt-6">
        <ul className="flex flex-wrap gap-2">
          {documents.map((doc) => (
            <li key={doc.key} className="min-w-0">
              <Link
                href={doc.href}
                onNavigate={doc.current ? undefined : guardLeave}
                aria-current={doc.current ? "page" : undefined}
                className={`flex min-h-11 flex-col items-start gap-1.5 rounded-xl border px-3 py-2 text-sm transition-colors hover:bg-gray-50 motion-reduce:transition-none ${FOCUS}`}
                style={{ borderColor: doc.current ? brandColors.accent : LINE, background: doc.current ? brandColors.accentSoft : "white", color: INK }}
              >
                <span className="font-semibold [overflow-wrap:anywhere]">{doc.title}</span>
                <span className="flex flex-wrap gap-1">
                  <Badge tone={doc.statusTone}>{doc.statusLabel}</Badge>
                  {doc.hasUnpublishedChanges ? <Badge tone="info">Có thay đổi chưa xuất bản</Badge> : null}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-6 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px] xl:gap-8">
        {/* Cột chính: nội dung → Tối ưu SEO */}
        <div className="min-w-0 space-y-6">
          <ConfigCard
            icon={<IconDoc className="h-5 w-5" />}
            title="Nội dung văn bản"
            badges={dirty ? <Badge tone="warning">Có thay đổi chưa lưu</Badge> : null}
            description="Dùng Tiêu đề 2 cho từng mục lớn (trang công khai tự dựng mục lục), Tiêu đề 3 cho mục con. Tiêu đề trang đã có sẵn — không cần Tiêu đề 1."
          >
            <div>
              <span id="legal-content-label" className="sr-only">
                Nội dung {data.title}
              </span>
              <div role="group" aria-labelledby="legal-content-label">
                <TiptapEditor content={content} onChange={setContent} placeholder="Nội dung văn bản (dùng Tiêu đề 2/3 cho các mục)..." />
              </div>
              <p className="mt-1.5 flex items-start gap-1.5 text-xs" style={{ color: placeholderCount > 0 ? AMBER : INK_SOFT }}>
                {placeholderCount > 0 ? <IconAlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" /> : null}
                <span>
                  {placeholderCount > 0
                    ? `Còn ${placeholderCount} chỗ “${LEGAL_PLACEHOLDER_MARKER}…”. Trang công khai hiển thị “(đang cập nhật)” ở các chỗ này.`
                    : "Không còn chỗ cần xác nhận."}{" "}
                  Dùng <code>{"{brand}"}</code> thay cho tên nền tảng.
                </span>
              </p>
            </div>
          </ConfigCard>

          {seo}
        </div>

        {/* Sidebar: dính khi cuộn chỉ khi màn hình đủ cao để chứa trọn (globals.css `.legal-editor-aside`). */}
        <aside aria-label="Xuất bản văn bản" className="legal-editor-aside min-w-0">
          <ConfigCard
            icon={<IconShield className="h-5 w-5" />}
            title="Xuất bản"
            badges={
              <>
                <Badge tone={statusBadge.tone}>{statusBadge.label}</Badge>
                {published?.isDraftRelease ? <Badge tone="warning">Bản dự thảo</Badge> : null}
                {unpublishedChanges && published ? <Badge tone="info">Có thay đổi chưa xuất bản</Badge> : null}
              </>
            }
            footer={
              published?.isEffective ? (
                <a
                  href={data.publicPath}
                  target="_blank"
                  rel="noreferrer"
                  className={`inline-flex min-h-11 items-center gap-1.5 rounded text-sm font-semibold hover:underline sm:min-h-8 ${FOCUS}`}
                  style={{ color: brandColors.primary }}
                >
                  <IconExternalLink className="h-4 w-4 shrink-0" /> Xem trang công khai
                  <span className="sr-only">(mở tab mới — nội dung đang hiệu lực)</span>
                </a>
              ) : (
                <p className="text-xs" style={{ color: INK_SOFT }}>
                  Chưa có bản đang hiệu lực — trang công khai {data.publicPath} chưa hiển thị và link menu/footer tới văn bản này tự ẩn.
                </p>
              )
            }
          >
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-sm">
              <dt style={{ color: INK_SOFT }}>Cập nhật lúc</dt>
              <dd className="font-medium tabular-nums" style={{ color: INK }}>
                {lastUpdatedLabel ?? "Chưa có"}
              </dd>
              {published ? (
                <>
                  <dt style={{ color: INK_SOFT }}>{published.isEffective ? "Đang hiệu lực từ" : "Hẹn hiệu lực từ"}</dt>
                  <dd className="font-medium tabular-nums" style={{ color: INK }}>
                    {formatIso(published.effectiveAt) ?? "—"}
                  </dd>
                </>
              ) : null}
            </dl>

            <div className="space-y-3 border-t pt-4" style={{ borderColor: LINE }}>
              <div>
                <label className={`flex min-h-11 items-start gap-2.5 py-1 text-sm ${hasDraft && !dirty ? "cursor-pointer" : "cursor-not-allowed"}`} style={{ color: INK }}>
                  <input
                    type="checkbox"
                    className={CHECKBOX}
                    checked={approved}
                    disabled={isPending || dirty || !hasDraft}
                    aria-describedby="legal-review-hint"
                    onChange={(e) => toggleReview(e.target.checked)}
                  />
                  <span className="font-medium">Đã rà soát nội dung</span>
                </label>
                <p id="legal-review-hint" className="text-xs" style={{ color: INK_SOFT }}>
                  {dirty
                    ? "Lưu nháp trước rồi mới đánh dấu rà soát."
                    : !hasDraft
                      ? "Sửa nội dung và Lưu nháp để có bản cần rà soát."
                      : "Sửa nội dung sau khi đánh dấu sẽ tự bỏ dấu rà soát."}
                </p>
              </div>

              <div>
                <label className={`flex min-h-11 items-start gap-2.5 py-1 text-sm ${draftReleaseAvailable ? "cursor-pointer" : "cursor-not-allowed"}`} style={{ color: INK }}>
                  <input
                    type="checkbox"
                    className={CHECKBOX}
                    checked={draftReleaseOn}
                    disabled={isPending || !draftReleaseAvailable}
                    aria-describedby="legal-draft-release-hint"
                    onChange={(e) => setAsDraftRelease(e.target.checked)}
                  />
                  <span className="font-medium">Công bố dạng bản dự thảo</span>
                </label>
                <p id="legal-draft-release-hint" className="text-xs" style={{ color: INK_SOFT }}>
                  {draftReleaseAvailable
                    ? "Bỏ qua bước rà soát và các chỗ cần xác nhận. Trang công khai gắn nhãn “Bản dự thảo — đang hoàn thiện”; bản dự thảo không dùng để ghi nhận đồng ý."
                    : "Sẽ bật sau khi cập nhật hệ thống."}
                </p>
              </div>

              <TextField
                id="legal-effective-at"
                type="datetime-local"
                label="Ngày hiệu lực (tuỳ chọn, giờ Việt Nam)"
                hint="Để trống = có hiệu lực ngay khi xuất bản."
                value={effectiveAt}
                disabled={isPending}
                onChange={(e) => setEffectiveAt(e.target.value)}
              />
            </div>

            {blockers.length > 0 ? (
              <div id="legal-publish-blockers" className="rounded-lg border px-3.5 py-3 text-sm" style={{ background: "#FFFBEB", borderColor: "#FDE68A", color: "#92400E" }}>
                <p className="flex items-center gap-2 font-semibold">
                  <IconAlertTriangle className="h-4 w-4 shrink-0" /> Chưa xuất bản được
                </p>
                <ul className="mt-1.5 list-disc space-y-1 pl-5">
                  {blockers.map((text) => (
                    <li key={text}>{text}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div ref={actionsRef} className="space-y-3 border-t pt-4" style={{ borderColor: LINE }}>
              <p role="status" aria-live="polite" className="min-h-5 text-sm" style={{ color: INK_SOFT }}>
                {saveState}
              </p>
              {message ? (
                <div className="space-y-2">
                  <FormBanner ok={message.ok} message={message.text} />
                  {message.conflict ? (
                    <button type="button" onClick={() => window.location.reload()} className={`${GHOST_BTN} w-full`} style={{ borderColor: LINE, color: INK }}>
                      Tải lại trang
                    </button>
                  ) : null}
                </div>
              ) : null}
              <button
                type="button"
                onClick={publish}
                disabled={isPending || !canPublish}
                aria-describedby={canPublish ? undefined : "legal-publish-blockers"}
                className={`${PRIMARY_BTN} w-full`}
                style={{ background: brandColors.primary }}
              >
                {busy("publish") ? "Đang xuất bản..." : draftReleaseOn ? "Xuất bản bản dự thảo" : "Xuất bản"}
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={save} disabled={isPending || !dirty} className={`${GHOST_BTN} w-full`} style={{ borderColor: LINE, color: INK }}>
                  {busy("save") ? "Đang lưu..." : "Lưu nháp"}
                </button>
                {data.previewHref ? (
                  <a href={data.previewHref} target="_blank" rel="noreferrer" className={`${GHOST_BTN} w-full`} style={{ borderColor: LINE, color: brandColors.primary }}>
                    <IconEye className="h-4 w-4 shrink-0" /> Xem trước
                    <span className="sr-only">(mở tab mới)</span>
                  </a>
                ) : (
                  <button type="button" disabled aria-describedby="legal-preview-hint" className={`${GHOST_BTN} w-full`} style={{ borderColor: LINE, color: INK }}>
                    <IconEye className="h-4 w-4 shrink-0" /> Xem trước
                  </button>
                )}
              </div>
              <p id="legal-preview-hint" className="text-xs" style={{ color: INK_SOFT }}>
                {data.previewHref
                  ? `Xem trước mở tab mới, đúng giao diện trang công khai${dirty ? " — hiển thị bản đã lưu, hãy Lưu nháp để xem thay đổi mới" : ""}.`
                  : "Lưu nháp lần đầu để xem trước."}
              </p>
            </div>
          </ConfigCard>
        </aside>
      </div>

      {/* Thanh lưu nhanh: chỉ khi khối nút sidebar khuất (dưới xl sidebar nằm cuối trang; xl màn thấp sidebar không dính).
          `invisible` giữ chỗ — không nhảy layout; globals.css chừa scroll-padding-bottom để thanh không che focus. */}
      <div
        className={`legal-save-bar sticky bottom-0 z-20 -mx-5 mt-6 border-t bg-white px-5 pt-3 transition-[opacity,visibility] duration-150 motion-reduce:transition-none lg:-mx-8 lg:px-8 ${showQuickBar ? "visible opacity-100" : "invisible opacity-0"}`}
        data-visible={showQuickBar ? "true" : "false"}
        style={{ borderColor: LINE, boxShadow: "0 -6px 16px rgb(18 33 58 / 0.06)", paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        <div className="flex items-center justify-between gap-3">
          <p aria-hidden="true" className="min-w-0 text-sm" style={{ color: INK_SOFT }}>
            {saveState}
          </p>
          <button
            type="button"
            onClick={save}
            disabled={isPending || !dirty}
            tabIndex={showQuickBar ? undefined : -1}
            className={`${PRIMARY_BTN} shrink-0`}
            style={{ background: brandColors.primary }}
          >
            {busy("save") ? "Đang lưu..." : "Lưu nháp"}
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { brandColors } from "@gieochu/config/theme";
import {
  LEGAL_CHANGE_SUMMARY_MAX,
  LEGAL_PUBLISH_BLOCKER_MESSAGES,
  LEGAL_REVIEW_STATUS_LABELS,
  LEGAL_VERSION_STATUS_LABELS,
  legalDocumentPath,
  legalPublishBlockers,
  legalVersionLabel,
  type LegalDocumentKey,
  type LegalReviewStatusValue,
  type LegalVersionStatusValue,
} from "@gieochu/core/legal";
import { TiptapEditor } from "../../../_ui/editor/tiptap-editor";
import { Badge, EmptyState, GhostButton, Notice, PrimaryButton, TextField } from "../../_ui/kit";
import { IconAlertTriangle, IconCheckCircle, IconDoc, IconExternalLink, IconPlus, IconShield } from "../../_ui/icons";
import {
  archiveLegalVersionAction,
  createLegalDraftAction,
  publishLegalVersionAction,
  setLegalReviewStatusAction,
  updateLegalDraftAction,
  type LegalActionState,
} from "./actions";

export interface LegalVersionView {
  id: string;
  version: number;
  status: LegalVersionStatusValue;
  reviewStatus: LegalReviewStatusValue;
  contentHtml: string;
  changeSummary: string;
  effectiveAtLabel: string | null;
  publishedAtLabel: string | null;
  updatedAtLabel: string;
  /** ISO đầy đủ — khoá làm mới ô soạn sau mỗi lần lưu. */
  updatedAtIso: string;
  isEffective: boolean;
  isScheduled: boolean;
}

type PendingKind = "create" | "save" | "review" | "publish" | "archive";
type RunTask = (kind: PendingKind, task: () => Promise<LegalActionState>, okText: string) => void;

const INK = brandColors.ink;
const INK_SOFT = "#6B7280";
const LINE = "#E5E7EB";
const RED = "#B91C1C";
const GREEN = "#15803D";
const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-primary,#0F3B82)]";

/** `2026-10-24T08:30` (ô datetime-local, giờ VN) → "08:30 24/10/2026" để đọc trong hộp xác nhận. */
function describeLocalDateTime(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  return match ? `${match[4]}:${match[5]} ${match[3]}/${match[2]}/${match[1]} (giờ Việt Nam)` : value;
}

/**
 * Editor văn bản pháp lý (ADR-050 mục 3, GĐ2 UI) — đồng bộ editor CMS Cửa hàng/Bảng giá: cột trái danh sách phiên bản
 * (nút chọn `aria-current`, huy hiệu chữ — không chỉ màu), cột phải bảng soạn của phiên bản đang chọn. Bản nháp: Tiptap
 * (dùng H2/H3 cho các mục — trang công khai dựng mục lục từ H2) + tóm tắt thay đổi; khối "Rà soát & xuất bản" dạng 3 bước có
 * trạng thái (đã lưu → đã rà soát → ngày hiệu lực + Xuất bản) và lý do bị chặn. Bản đã xuất bản/lưu trữ chỉ đọc. Kết quả thao
 * tác `role="status"`/`"alert"`; nút báo "Đang …" khi chờ; xác nhận trước xuất bản/lưu trữ/đổi phiên bản khi chưa lưu.
 * Server kiểm lại mọi luật (không đổi action/props).
 */
export function LegalEditor({ documentKey, versions }: { documentKey: LegalDocumentKey; versions: LegalVersionView[] }) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(versions[0]?.id ?? null);
  const selected = versions.find((v) => v.id === selectedId) ?? versions[0] ?? null;
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [pendingKind, setPendingKind] = useState<PendingKind | null>(null);
  const [panelDirty, setPanelDirty] = useState(false);
  const hasDraft = versions.some((v) => v.status === "DRAFT");
  const publicPath = legalDocumentPath(documentKey);
  const hasEffective = versions.some((v) => v.isEffective);

  function select(version: LegalVersionView) {
    if (version.id === selected?.id) return;
    if (panelDirty && !window.confirm("Bản nháp đang có thay đổi chưa lưu. Bỏ thay đổi và chuyển phiên bản?")) return;
    setPanelDirty(false);
    setSelectedId(version.id);
    setMessage(null);
  }

  const run: RunTask = (kind, task, okText) => {
    setPendingKind(kind);
    startTransition(async () => {
      const result = await task();
      if (result.success) {
        setMessage({ ok: true, text: okText });
        if (result.versionId) setSelectedId(result.versionId);
        router.refresh();
      } else {
        setMessage({ ok: false, text: result.error ?? "Thao tác thất bại." });
      }
    });
  };

  function createDraft() {
    if (hasDraft && !window.confirm("Đã có phiên bản nháp chưa xuất bản. Vẫn tạo thêm một bản nháp mới (sao chép nội dung bản mới nhất)?")) return;
    run("create", () => createLegalDraftAction(documentKey, versions[0]?.contentHtml ?? "", ""), "Đã tạo phiên bản nháp mới (sao chép nội dung bản mới nhất).");
  }

  const busy = (kind: PendingKind) => isPending && pendingKind === kind;

  const createButton = (
    <GhostButton onClick={createDraft} disabled={isPending} className={`inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 lg:min-h-0 ${FOCUS}`}>
      <IconPlus className="h-4 w-4" /> {busy("create") ? "Đang tạo..." : "Tạo phiên bản nháp"}
    </GhostButton>
  );

  if (versions.length === 0) {
    return (
      <div className="mt-6 space-y-4">
        {message ? <ResultBanner message={message} /> : null}
        <EmptyState
          icon={<IconDoc className="h-6 w-6" />}
          title="Chưa có phiên bản nào"
          description="Tạo phiên bản nháp đầu tiên, soạn nội dung, đánh dấu đã rà soát pháp lý rồi xuất bản."
          action={
            <PrimaryButton type="button" onClick={createDraft} disabled={isPending}>
              <IconPlus className="h-4 w-4" /> {busy("create") ? "Đang tạo..." : "Tạo phiên bản nháp"}
            </PrimaryButton>
          }
        />
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-4">
      {message ? <ResultBanner message={message} /> : null}
      <div className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="min-w-0 self-start rounded-2xl border bg-white p-4" style={{ borderColor: LINE }} aria-labelledby="legal-versions-heading">
          <div className="mb-3 flex items-baseline justify-between gap-2">
            <h2 id="legal-versions-heading" className="text-xs font-semibold tracking-wide uppercase" style={{ color: INK_SOFT }}>
              Phiên bản
            </h2>
            <span className="text-xs tabular-nums" style={{ color: INK_SOFT }}>
              {versions.length} phiên bản
            </span>
          </div>
          {createButton}
          {hasEffective ? (
            <Link
              href={publicPath}
              target="_blank"
              rel="noreferrer"
              className={`mt-2 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold hover:underline lg:min-h-9 ${FOCUS}`}
              style={{ color: brandColors.primary }}
            >
              <IconExternalLink className="h-4 w-4" /> Xem trang công khai
              <span className="sr-only">(mở tab mới — bản đang hiệu lực)</span>
            </Link>
          ) : null}
          <ol className="mt-3 space-y-1.5">
            {versions.map((v) => {
              const isSelected = v.id === selected?.id;
              return (
                <li key={v.id}>
                  <button
                    type="button"
                    onClick={() => select(v)}
                    aria-current={isSelected ? "true" : undefined}
                    className={`flex min-h-11 w-full cursor-pointer flex-col items-start gap-1.5 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors hover:bg-gray-50 ${FOCUS}`}
                    style={{ borderColor: isSelected ? brandColors.accent : LINE, background: isSelected ? brandColors.accentSoft : "white", color: INK }}
                  >
                    <span className="font-semibold">
                      Phiên bản {legalVersionLabel(v.version)}
                      {isSelected ? <span className="sr-only"> (đang xem)</span> : null}
                    </span>
                    <span className="flex flex-wrap gap-1">
                      <Badge tone={v.status === "PUBLISHED" ? "success" : v.status === "DRAFT" ? "info" : "neutral"}>{LEGAL_VERSION_STATUS_LABELS[v.status]}</Badge>
                      {v.isEffective ? <Badge tone="success">Đang hiệu lực</Badge> : null}
                      {v.isScheduled ? <Badge tone="warning">Hiệu lực từ {v.effectiveAtLabel}</Badge> : null}
                      {v.status === "DRAFT" ? (
                        <Badge tone={v.reviewStatus === "APPROVED" ? "success" : "warning"}>{LEGAL_REVIEW_STATUS_LABELS[v.reviewStatus]}</Badge>
                      ) : null}
                    </span>
                    <span className="text-xs" style={{ color: INK_SOFT }}>
                      Sửa lần cuối {v.updatedAtLabel}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </aside>

        <section className="min-w-0 rounded-2xl border bg-white p-4 sm:p-6" style={{ borderColor: LINE }} aria-labelledby="legal-version-heading">
          {selected ? (
            // key theo lần sửa cuối: sau khi server lưu/làm mới, ô soạn nạp lại đúng dữ liệu đã lưu.
            <VersionPanel
              key={`${selected.id}:${selected.updatedAtIso}`}
              documentKey={documentKey}
              selected={selected}
              isPending={isPending}
              busy={busy}
              run={run}
              onDirtyChange={setPanelDirty}
            />
          ) : null}
        </section>
      </div>
    </div>
  );
}

function ResultBanner({ message }: { message: { ok: boolean; text: string } }) {
  return (
    <p
      role={message.ok ? "status" : "alert"}
      className="flex items-start gap-2 rounded-lg border px-3.5 py-2.5 text-sm font-medium"
      style={message.ok ? { background: "#F0FDF4", borderColor: "#BBF7D0", color: GREEN } : { background: "#FEF2F2", borderColor: "#FCA5A5", color: RED }}
    >
      {message.ok ? <IconCheckCircle className="mt-0.5 h-4 w-4 shrink-0" /> : <IconAlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
      {message.text}
    </p>
  );
}

/** Một bước trong khối "Rà soát & xuất bản": số bước + trạng thái bằng chữ ("Xong"/"Chưa") + icon — không chỉ màu. */
function Step({ index, title, done, children }: { index: number; title: string; done: boolean; children?: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span
        aria-hidden="true"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold"
        style={done ? { background: GREEN, color: "white" } : { background: "#F3F4F6", color: INK }}
      >
        {done ? <IconCheckCircle className="h-4 w-4" /> : index}
      </span>
      <div className="min-w-0 flex-1 pt-0.5">
        <p className="text-sm font-semibold" style={{ color: INK }}>
          <span className="sr-only">Bước {index}: </span>
          {title}{" "}
          <span className="text-xs font-semibold" style={{ color: done ? GREEN : INK_SOFT }}>
            — {done ? "Xong" : "Chưa"}
          </span>
        </p>
        {children ? <div className="mt-2">{children}</div> : null}
      </div>
    </li>
  );
}

function VersionPanel({
  documentKey,
  selected,
  isPending,
  busy,
  run,
  onDirtyChange,
}: {
  documentKey: LegalDocumentKey;
  selected: LegalVersionView;
  isPending: boolean;
  busy: (kind: PendingKind) => boolean;
  run: RunTask;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const [content, setContent] = useState(selected.contentHtml);
  const [summary, setSummary] = useState(selected.changeSummary);
  const [effectiveAt, setEffectiveAt] = useState("");
  const isDraft = selected.status === "DRAFT";
  const dirty = isDraft && (content !== selected.contentHtml || summary !== selected.changeSummary);
  const blockers = isDraft ? legalPublishBlockers({ status: selected.status, reviewStatus: selected.reviewStatus, contentHtml: content }) : [];
  const approved = selected.reviewStatus === "APPROVED";

  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function publish() {
    const when = effectiveAt ? `có hiệu lực từ ${describeLocalDateTime(effectiveAt)}` : "có hiệu lực ngay khi xuất bản";
    const ok = window.confirm(
      `Xuất bản phiên bản ${legalVersionLabel(selected.version)} — ${when}?\n\nSau khi xuất bản không sửa được nội dung; muốn thay đổi phải tạo phiên bản mới. Khi có hiệu lực, form đăng ký sẽ link tới bản này.`,
    );
    if (!ok) return;
    run("publish", () => publishLegalVersionAction(documentKey, selected.id, effectiveAt), "Đã xuất bản phiên bản.");
  }

  function archive() {
    const warning = selected.isEffective
      ? "\n\nĐây là bản ĐANG HIỆU LỰC — nếu không còn bản nào khác, trang công khai sẽ trả 404 và form đăng ký không còn link Điều khoản."
      : "";
    if (!window.confirm(`Lưu trữ phiên bản ${legalVersionLabel(selected.version)}?${warning}`)) return;
    run("archive", () => archiveLegalVersionAction(documentKey, selected.id), "Đã lưu trữ phiên bản.");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 border-b pb-4" style={{ borderColor: LINE }}>
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="legal-version-heading" className="font-[family-name:var(--font-heading)] text-lg font-semibold" style={{ color: INK }}>
            Phiên bản {legalVersionLabel(selected.version)}
          </h2>
          <Badge tone={selected.status === "PUBLISHED" ? "success" : selected.status === "DRAFT" ? "info" : "neutral"}>{LEGAL_VERSION_STATUS_LABELS[selected.status]}</Badge>
          {selected.isEffective ? <Badge tone="success">Đang hiệu lực</Badge> : null}
          {selected.isScheduled ? <Badge tone="warning">Hiệu lực từ {selected.effectiveAtLabel}</Badge> : null}
          {dirty ? <Badge tone="info">Có thay đổi chưa lưu</Badge> : null}
        </div>
        <p className="text-xs" style={{ color: INK_SOFT }}>
          {LEGAL_REVIEW_STATUS_LABELS[selected.reviewStatus]} · Sửa lần cuối {selected.updatedAtLabel}
          {selected.effectiveAtLabel ? ` · Hiệu lực từ ${selected.effectiveAtLabel}` : ""}
          {selected.publishedAtLabel ? ` · Xuất bản lúc ${selected.publishedAtLabel}` : ""}
        </p>
      </div>

      {isDraft ? (
        <>
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium" style={{ color: INK }}>
                Nội dung văn bản
              </p>
              <p className="mt-1 mb-2 text-xs" style={{ color: INK_SOFT }}>
                Dùng <strong>Tiêu đề 2</strong> cho từng mục lớn (trang công khai tự dựng mục lục từ các tiêu đề này), Tiêu đề 3 cho mục con.
                Tiêu đề trang đã có sẵn — không cần Tiêu đề 1.
              </p>
              <TiptapEditor content={content} onChange={setContent} placeholder="Nội dung văn bản (dùng Tiêu đề 2/3 cho các mục)..." />
            </div>
            <TextField
              id="legal-change-summary"
              label={`Tóm tắt thay đổi (không bắt buộc, ${summary.length}/${LEGAL_CHANGE_SUMMARY_MAX})`}
              value={summary}
              maxLength={LEGAL_CHANGE_SUMMARY_MAX}
              hint="Ghi ngắn điểm khác so với phiên bản trước — chỉ hiện trong System Center."
              onChange={(e) => setSummary(e.target.value)}
            />
            <div className="flex flex-wrap items-center gap-3">
              <PrimaryButton
                type="button"
                disabled={isPending || !dirty}
                onClick={() =>
                  run("save", () => updateLegalDraftAction(documentKey, selected.id, content, summary), "Đã lưu bản nháp. Nội dung đổi → trạng thái rà soát quay về “Chờ rà soát”.")
                }
              >
                {busy("save") ? "Đang lưu..." : "Lưu bản nháp"}
              </PrimaryButton>
              <span className="text-xs" style={{ color: INK_SOFT }}>
                {dirty ? "Có thay đổi chưa lưu — lưu trước khi đánh dấu rà soát." : "Không có thay đổi chưa lưu."}
              </span>
            </div>
          </div>

          <section className="rounded-xl border p-4 sm:p-5" style={{ borderColor: LINE, background: "#FAFAFA" }} aria-labelledby="legal-publish-heading">
            <h3 id="legal-publish-heading" className="flex items-center gap-2 font-[family-name:var(--font-heading)] text-base font-semibold" style={{ color: INK }}>
              <IconShield className="h-4 w-4 shrink-0" /> Rà soát & xuất bản
            </h3>
            <ol className="mt-4 space-y-5">
              <Step index={1} title="Lưu nội dung" done={!dirty} />
              <Step index={2} title="Rà soát pháp lý" done={approved && !dirty}>
                <label className={`flex min-h-11 items-start gap-2.5 text-sm ${dirty ? "cursor-not-allowed" : "cursor-pointer"}`} style={{ color: INK }}>
                  <input
                    type="checkbox"
                    className="mt-0.5 h-[18px] w-[18px] shrink-0 cursor-pointer accent-[color:var(--brand-primary,#0F3B82)] disabled:cursor-not-allowed"
                    disabled={isPending || dirty}
                    checked={approved}
                    aria-describedby="legal-review-hint"
                    onChange={(e) =>
                      run(
                        "review",
                        () => setLegalReviewStatusAction(documentKey, selected.id, e.target.checked ? "APPROVED" : "PENDING_LEGAL_REVIEW"),
                        e.target.checked ? "Đã đánh dấu đã rà soát pháp lý." : "Đã bỏ đánh dấu rà soát.",
                      )
                    }
                  />
                  <span>
                    Tôi xác nhận phiên bản này đã được rà soát pháp lý
                    {busy("review") ? <span className="ml-1" style={{ color: INK_SOFT }}>(đang cập nhật...)</span> : null}
                  </span>
                </label>
                <p id="legal-review-hint" className="mt-1 text-xs" style={{ color: INK_SOFT }}>
                  {dirty ? "Lưu bản nháp trước — sửa nội dung sẽ đưa trạng thái về “Chờ rà soát”." : "Sửa nội dung sau khi đánh dấu sẽ tự bỏ dấu rà soát."}
                </p>
              </Step>
              <Step index={3} title="Chọn ngày hiệu lực và xuất bản" done={false}>
                <div className="grid gap-3 sm:grid-cols-[minmax(0,280px)_auto] sm:items-end">
                  <TextField
                    id="legal-effective-at"
                    type="datetime-local"
                    label="Ngày giờ hiệu lực (giờ Việt Nam)"
                    hint="Để trống = có hiệu lực ngay khi xuất bản."
                    value={effectiveAt}
                    onChange={(e) => setEffectiveAt(e.target.value)}
                  />
                  <PrimaryButton type="button" disabled={isPending || dirty || blockers.length > 0} aria-describedby={blockers.length > 0 ? "legal-publish-blockers" : undefined} onClick={publish}>
                    <IconCheckCircle className="h-4 w-4" /> {busy("publish") ? "Đang xuất bản..." : "Xuất bản"}
                  </PrimaryButton>
                </div>
                {blockers.length > 0 || dirty ? (
                  <div className="mt-3" id="legal-publish-blockers">
                    <Notice tone="warning" icon={<IconAlertTriangle className="h-4 w-4" />}>
                      <span className="font-semibold">Chưa xuất bản được:</span>
                      <ul className="mt-1 list-disc pl-5">
                        {dirty ? <li>Còn thay đổi chưa lưu.</li> : null}
                        {blockers.map((blocker) => (
                          <li key={blocker}>{LEGAL_PUBLISH_BLOCKER_MESSAGES[blocker]}</li>
                        ))}
                      </ul>
                    </Notice>
                  </div>
                ) : null}
              </Step>
            </ol>
          </section>
        </>
      ) : (
        <>
          {selected.changeSummary ? (
            <div>
              <p className="text-sm font-medium" style={{ color: INK }}>
                Tóm tắt thay đổi
              </p>
              <p className="mt-1 text-sm whitespace-pre-line" style={{ color: INK_SOFT }}>
                {selected.changeSummary}
              </p>
            </div>
          ) : null}
          <div>
            <p className="mb-2 text-sm font-medium" style={{ color: INK }}>
              Nội dung (chỉ đọc)
            </p>
            {/* Nội dung đã sanitize khi lưu (server) — chỉ hiển thị để đọc. */}
            <div
              className="gieochu-rich-content max-h-[70vh] overflow-y-auto rounded-xl border bg-gray-50 px-4 py-3 text-[15px] sm:px-6 sm:py-4"
              style={{ borderColor: LINE }}
              dangerouslySetInnerHTML={{ __html: selected.contentHtml }}
            />
            <p className="mt-2 text-xs" style={{ color: INK_SOFT }}>
              Bản đã {selected.status === "PUBLISHED" ? "xuất bản" : "lưu trữ"} không sửa được. Muốn thay đổi, bấm “Tạo phiên bản nháp” (sao chép nội dung bản mới nhất).
            </p>
          </div>
          {selected.status === "PUBLISHED" ? (
            <div className="border-t pt-4" style={{ borderColor: LINE }}>
              <GhostButton
                disabled={isPending}
                onClick={archive}
                className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 lg:min-h-0 ${FOCUS}`}
                style={{ borderColor: "#FCA5A5", color: RED }}
              >
                {busy("archive") ? "Đang lưu trữ..." : "Lưu trữ phiên bản"}
              </GhostButton>
              <p className="mt-1.5 text-xs" style={{ color: INK_SOFT }}>
                Lưu trữ = gỡ khỏi trang công khai (nếu là bản đang hiệu lực, bản đã xuất bản trước đó sẽ có hiệu lực lại nếu còn).
              </p>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

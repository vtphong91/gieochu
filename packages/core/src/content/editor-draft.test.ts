import {
  EDITOR_DRAFT_ERROR_CODES,
  EDITOR_DRAFT_MAX_BYTES,
  isValidEditorDraftClientId,
  isValidEditorDraftKey,
  parseEditorDraftPayload,
} from "./editor-draft";

describe("ADR-053 editor autosave drafts", () => {
  it("validates draft payload shape per entity, enforces per-type size limits and entity key shapes", () => {
    // Draft mode: incomplete forms are fine (no required title), only known fields with primitive values.
    const post = parseEditorDraftPayload("POST", { title: "", body: "<p>Đang viết</p>" });
    expect(post).toMatchObject({ ok: true, payload: { title: "", body: "<p>Đang viết</p>" } });
    expect(parseEditorDraftPayload("POST", { title: "x", status: "PUBLISHED" })).toMatchObject({ ok: false, code: EDITOR_DRAFT_ERROR_CODES.INVALID });
    expect(parseEditorDraftPayload("PRODUCT", { priceVnd: { amount: 1 } })).toMatchObject({ ok: false, code: EDITOR_DRAFT_ERROR_CODES.INVALID });
    expect(parseEditorDraftPayload("PRODUCT", ["title"])).toMatchObject({ ok: false, code: EDITOR_DRAFT_ERROR_CODES.INVALID });
    expect(parseEditorDraftPayload("STOREFRONT", { blocks: [{ type: "hero", title: "Xin chào" }] }).ok).toBe(true);
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(parseEditorDraftPayload("HOME", circular)).toMatchObject({ ok: false, code: EDITOR_DRAFT_ERROR_CODES.INVALID });
    let deep: unknown = "leaf";
    for (let i = 0; i < 20; i += 1) deep = [deep];
    expect(parseEditorDraftPayload("MENU", { blocks: deep })).toMatchObject({ ok: false, code: EDITOR_DRAFT_ERROR_CODES.INVALID });

    // Size limits are per type and measured in UTF-8 bytes (Vietnamese characters count 2–3 bytes).
    const productLimit = EDITOR_DRAFT_MAX_BYTES.PRODUCT;
    expect(parseEditorDraftPayload("PRODUCT", { description: "a".repeat(productLimit) })).toMatchObject({ ok: false, code: EDITOR_DRAFT_ERROR_CODES.TOO_LARGE });
    expect(parseEditorDraftPayload("POST", { body: "a".repeat(productLimit) }).ok).toBe(true);
    expect(parseEditorDraftPayload("POST", { body: "ữ".repeat(Math.ceil(EDITOR_DRAFT_MAX_BYTES.POST / 3)) })).toMatchObject({ ok: false, code: EDITOR_DRAFT_ERROR_CODES.TOO_LARGE });

    // Entity keys: id or "new" for posts/products, "main" for singleton editors, version id or new-<doc> for legal.
    expect(isValidEditorDraftKey("POST", "new")).toBe(true);
    expect(isValidEditorDraftKey("PRODUCT", "ckx9a1b2c3d4e5f6g7h8i9j0")).toBe(true);
    expect(isValidEditorDraftKey("PRODUCT", "../other")).toBe(false);
    expect(isValidEditorDraftKey("STOREFRONT", "main")).toBe(true);
    expect(isValidEditorDraftKey("STOREFRONT", "new")).toBe(false);
    expect(isValidEditorDraftKey("LEGAL_VERSION", "new-terms")).toBe(true);
    expect(isValidEditorDraftKey("LEGAL_VERSION", "new-unknown")).toBe(false);
    expect(isValidEditorDraftClientId("tab_8f3k2m9q")).toBe(true);
    expect(isValidEditorDraftClientId("x")).toBe(false);
  });
});

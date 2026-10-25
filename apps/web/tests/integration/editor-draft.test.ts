import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { getPrismaClient, withCustomer, withPublic, withSystemJob, withTenant } from "@gieochu/db";
import { EDITOR_DRAFT_MAX_BYTES } from "@gieochu/core/editor-draft";
import { createTenantForUser } from "../../lib/create-tenant";
import { discardDraft, getDraft, saveDraft, type EditorDraftScope } from "../../lib/editor-draft";
import { createProduct } from "../../lib/product";
import { resetRateLimits } from "../../lib/rate-limit";
import type { CurrentUser } from "../../lib/session";

const prisma = getPrismaClient();
const RUN_PREFIX = `adr051draft_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const TAB_1 = "tab1aaaaaaaaaaaa";
const TAB_2 = "tab2bbbbbbbbbbbb";
let counter = 0;

async function createOwnerWithTenant(label: string) {
  counter += 1;
  const user = await prisma.user.create({
    data: { email: `${RUN_PREFIX}_${counter}@example.com`, passwordHash: "not-used-in-this-test", status: "ACTIVE", emailVerifiedAt: new Date() },
  });
  const current: CurrentUser = { userId: user.id, familyId: "test-family", role: "USER", emailVerified: true, profileCompleted: true };
  const tenant = await createTenantForUser(current, { name: `Draft ${label}`, slug: `${RUN_PREFIX}-${label}` });
  return { user, tenant, scope: { kind: "TENANT", tenantId: tenant.id } satisfies EditorDraftScope };
}

describe("ADR-053 editor autosave drafts", () => {
  beforeEach(() => resetRateLimits());

  afterAll(async () => {
    const tenants = await prisma.tenant.findMany({ where: { slug: { startsWith: RUN_PREFIX } }, select: { id: true } });
    const tenantIds = tenants.map((t) => t.id);
    if (tenantIds.length > 0) {
      await withSystemJob(async (tx) => {
        await tx.tenantEditorDraft.deleteMany({ where: { tenantId: { in: tenantIds } } });
        await tx.product.deleteMany({ where: { tenantId: { in: tenantIds } } });
        await tx.tenantMember.deleteMany({ where: { tenantId: { in: tenantIds } } });
      });
    }
    await prisma.tenant.deleteMany({ where: { slug: { startsWith: RUN_PREFIX } } });
    // Nháp còn sót (nếu có) bị CASCADE theo user.
    await prisma.user.deleteMany({ where: { email: { startsWith: RUN_PREFIX } } });
  });

  it("isolates drafts per tenant under real RLS: tenant A cannot read/write tenant B drafts, public/customer scopes see none, entities must belong to the tenant", async () => {
    const a = await createOwnerWithTenant("a");
    const b = await createOwnerWithTenant("b");
    const ids = [a.tenant.id, b.tenant.id];

    await saveDraft(a.scope, a.user.id, { entityType: "STOREFRONT", entityKey: "main", payload: { blocks: [{ type: "hero", title: "A" }] }, clientId: TAB_1, expectedRevision: null });
    await saveDraft(b.scope, b.user.id, {
      entityType: "POST",
      entityKey: "new",
      payload: { title: "", body: `<p>Bài B</p><script>alert(1)</script><a href="javascript:alert(1)">x</a>` },
      clientId: TAB_1,
      expectedRevision: null,
    });

    // HTML is sanitized before it is stored as a draft.
    const bDraft = await getDraft(b.scope, b.user.id, { entityType: "POST", entityKey: "new" });
    expect(bDraft?.revision).toBe(1);
    expect(String(bDraft?.payload.body)).not.toMatch(/script|javascript:/i);

    // Raw queries under tenant A's RLS scope never see or touch tenant B's rows.
    await withTenant(a.tenant.id, async (tx) => {
      const visible = await tx.tenantEditorDraft.findMany({ where: { tenantId: { in: ids } }, select: { tenantId: true } });
      expect(visible.map((row) => row.tenantId)).toEqual([a.tenant.id]);
      expect((await tx.tenantEditorDraft.updateMany({ where: { tenantId: b.tenant.id }, data: { revision: 99 } })).count).toBe(0);
      expect((await tx.tenantEditorDraft.deleteMany({ where: { tenantId: b.tenant.id } })).count).toBe(0);
    });
    await expect(
      withTenant(a.tenant.id, (tx) =>
        tx.tenantEditorDraft.create({ data: { tenantId: b.tenant.id, userId: a.user.id, entityType: "POST", entityKey: "new", payload: {}, clientId: TAB_1 } }),
      ),
    ).rejects.toThrow();
    // Moving a row to another tenant is refused by WITH CHECK.
    await expect(
      withTenant(a.tenant.id, (tx) => tx.tenantEditorDraft.updateMany({ where: { tenantId: a.tenant.id }, data: { tenantId: b.tenant.id } })),
    ).rejects.toThrow();

    // Public and customer scopes see zero rows; system_job sees both but cannot create drafts.
    expect(await withPublic((tx) => tx.tenantEditorDraft.count({ where: { tenantId: { in: ids } } }))).toBe(0);
    expect(await withCustomer(a.user.id, (tx) => tx.tenantEditorDraft.count({ where: { tenantId: { in: ids } } }))).toBe(0);
    expect(await withSystemJob((tx) => tx.tenantEditorDraft.count({ where: { tenantId: { in: ids } } }))).toBe(2);
    await expect(
      withSystemJob((tx) =>
        tx.tenantEditorDraft.create({ data: { tenantId: a.tenant.id, userId: a.user.id, entityType: "PRODUCT", entityKey: "new", payload: {}, clientId: TAB_1 } }),
      ),
    ).rejects.toThrow();

    // Through the library: drafts are per user, and an entity id from another tenant is refused.
    expect(await getDraft(a.scope, b.user.id, { entityType: "STOREFRONT", entityKey: "main" })).toBeNull();
    expect(await getDraft(a.scope, a.user.id, { entityType: "POST", entityKey: "new" })).toBeNull();
    const productB = await createProduct(b.tenant.id, { title: "Tài liệu B", type: "OTHER" });
    await expect(
      saveDraft(a.scope, a.user.id, { entityType: "PRODUCT", entityKey: productB.id, payload: { title: "chiếm" }, clientId: TAB_1, expectedRevision: null }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    // A system entity type is not accepted in a tenant scope.
    await expect(
      saveDraft(a.scope, a.user.id, { entityType: "HOME", entityKey: "main", payload: { blocks: [] }, clientId: TAB_1, expectedRevision: null }),
    ).rejects.toMatchObject({ code: "DRAFT_INVALID" });

    // A READ_ONLY tenant does not autosave.
    await prisma.tenant.update({ where: { id: a.tenant.id }, data: { status: "READ_ONLY" } });
    await expect(
      saveDraft(a.scope, a.user.id, { entityType: "STOREFRONT", entityKey: "main", payload: { blocks: [] }, clientId: TAB_1, expectedRevision: 1 }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("detects revision conflicts between tabs, allows overwrite and same-tab resend, rejects oversized drafts, and saving discards the draft", async () => {
    const c = await createOwnerWithTenant("c");
    const product = await createProduct(c.tenant.id, { title: "Tài liệu C", type: "OTHER" });
    const ref = { entityType: "PRODUCT", entityKey: product.id } as const;
    const save = (clientId: string, expectedRevision: number | null, title: string, overwrite = false) =>
      saveDraft(c.scope, c.user.id, { ...ref, payload: { title }, clientId, expectedRevision, baseUpdatedAt: product.updatedAt, overwrite });

    expect((await save(TAB_1, null, "v1")).revision).toBe(1);
    expect((await save(TAB_1, 1, "v2")).revision).toBe(2);

    // Tab 2 still holds revision 1 (or none) → conflict, nothing overwritten.
    await expect(save(TAB_2, 1, "tab2")).rejects.toMatchObject({ code: "DRAFT_CONFLICT", httpStatus: 409 });
    await expect(save(TAB_2, null, "tab2")).rejects.toMatchObject({ code: "DRAFT_CONFLICT" });
    expect((await getDraft(c.scope, c.user.id, ref))?.payload.title).toBe("v2");

    // Tab 1 lost the response of its last save and resends with the old revision → accepted (same client).
    expect((await save(TAB_1, 1, "v3")).revision).toBe(3);

    // Tab 2 chooses "Ghi đè".
    expect((await save(TAB_2, 1, "tab2 wins", true)).revision).toBe(4);
    const latest = await getDraft(c.scope, c.user.id, ref);
    expect(latest).toMatchObject({ revision: 4, clientId: TAB_2, payload: { title: "tab2 wins" } });
    expect(latest?.baseUpdatedAt?.getTime()).toBe(product.updatedAt.getTime());
    await expect(save(TAB_1, 3, "v4")).rejects.toMatchObject({ code: "DRAFT_CONFLICT" });

    // Oversized payload (per entity type) is refused before touching the database.
    await expect(
      saveDraft(c.scope, c.user.id, { ...ref, payload: { description: "a".repeat(EDITOR_DRAFT_MAX_BYTES.PRODUCT) }, clientId: TAB_2, expectedRevision: 4 }),
    ).rejects.toMatchObject({ code: "DRAFT_TOO_LARGE" });
    expect((await getDraft(c.scope, c.user.id, ref))?.revision).toBe(4);

    // Lưu → the draft is discarded; a tab still holding the old revision gets a conflict instead of recreating it, a fresh
    // start (no revision) begins again at 1.
    await discardDraft(c.scope, c.user.id, ref);
    expect(await getDraft(c.scope, c.user.id, ref)).toBeNull();
    await expect(save(TAB_1, 4, "stale tab")).rejects.toMatchObject({ code: "DRAFT_CONFLICT" });
    expect((await save(TAB_2, null, "after save")).revision).toBe(1);
    await discardDraft(c.scope, c.user.id, ref);
    await discardDraft(c.scope, c.user.id, ref); // idempotent
    expect(await withSystemJob((tx) => tx.tenantEditorDraft.count({ where: { tenantId: c.tenant.id } }))).toBe(0);

    // System Center scope (L1 table) follows the same revision rules; tenant entity types are not accepted there.
    counter += 1;
    const admin = await prisma.user.create({
      data: { email: `${RUN_PREFIX}_${counter}@example.com`, passwordHash: "not-used-in-this-test", status: "ACTIVE", systemRole: "SYSTEM_ADMIN" },
    });
    const system = { kind: "SYSTEM" } as const;
    const home = { entityType: "HOME", entityKey: "main" } as const;
    expect((await saveDraft(system, admin.id, { ...home, payload: { blocks: [] }, clientId: TAB_1, expectedRevision: null })).revision).toBe(1);
    await expect(saveDraft(system, admin.id, { ...home, payload: { blocks: [1] }, clientId: TAB_2, expectedRevision: null })).rejects.toMatchObject({ code: "DRAFT_CONFLICT" });
    await expect(
      saveDraft(system, admin.id, { entityType: "LEGAL_VERSION", entityKey: "nosuchversion1", payload: { contentHtml: "<p>x</p>" }, clientId: TAB_1, expectedRevision: null }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(saveDraft(system, admin.id, { ...ref, payload: {}, clientId: TAB_1, expectedRevision: null })).rejects.toMatchObject({ code: "DRAFT_INVALID" });
    await discardDraft(system, admin.id, home);
    expect(await getDraft(system, admin.id, home)).toBeNull();
  });
});

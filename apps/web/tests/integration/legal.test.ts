import { afterAll, describe, expect, it } from "vitest";
import { getEnv } from "@gieochu/config";
import { getPrismaClient, withSystemJob } from "@gieochu/db";
import { createTenantForUser } from "../../lib/create-tenant";
import {
  createLegalDraft,
  getEffectiveLegalVersion,
  publishLegalVersion,
  recordLegalAcceptance,
  recordLegalAcceptances,
  resolveRegistrationPrivacyVersion,
  resolveRegistrationTermsVersion,
  resolveSellerPolicyAcceptance,
  setLegalReviewStatus,
  updateLegalDraft,
  type LegalDocumentSpec,
} from "../../lib/legal";

/**
 * ADR-050 mục 3 — văn bản pháp lý có phiên bản. DB dùng chung với production (ADR-034): test KHÔNG đụng văn bản thật
 * `terms` (không xuất bản gì lên `/phap-ly/dieu-khoan-su-dung`, không đổi hành vi đăng ký thật) — dùng văn bản tạm có
 * khoá riêng theo lượt chạy, đi cùng đúng các hàm mà route đăng ký và editor dùng. Không gửi email. Dọn sạch ở afterAll.
 */

const prisma = getPrismaClient();
const RUN = `t50-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
const EMAIL_PREFIX = `adr050test_${RUN}`;
let docCounter = 0;
const TENANT_SLUG_PREFIX = `adr052-${RUN}`;

function nextSpec(): LegalDocumentSpec {
  docCounter += 1;
  return { key: `${RUN}-${docCounter}`, slug: `${RUN}-${docCounter}`, title: "Điều khoản thử nghiệm" };
}

async function createActor() {
  return prisma.user.create({
    data: { email: `${EMAIL_PREFIX}_admin_${docCounter}@example.com`, passwordHash: "not-used", status: "ACTIVE", systemRole: "SYSTEM_ADMIN", emailVerifiedAt: new Date() },
  });
}

describe("ADR-050 legal documents", () => {
  afterAll(async () => {
    // ADR-054: gian hàng tạm (mở gian hàng có ghi chấp thuận) — bảng con có RLS → dọn qua withSystemJob trước khi xoá tenant.
    const tenants = await prisma.tenant.findMany({ where: { slug: { startsWith: TENANT_SLUG_PREFIX } }, select: { id: true } });
    const tenantIds = tenants.map((t) => t.id);
    if (tenantIds.length > 0) {
      await withSystemJob(async (tx) => {
        await tx.tenantMember.deleteMany({ where: { tenantId: { in: tenantIds } } });
        await tx.subscription.deleteMany({ where: { tenantId: { in: tenantIds } } });
      });
      await prisma.tenant.deleteMany({ where: { id: { in: tenantIds } } });
    }
    // Xoá user trước (Cascade xoá chấp thuận) rồi mới xoá phiên bản (FK Restrict) và văn bản.
    await prisma.user.deleteMany({ where: { email: { startsWith: EMAIL_PREFIX } } });
    await prisma.legalDocumentVersion.deleteMany({ where: { document: { key: { startsWith: RUN } } } });
    await prisma.legalDocument.deleteMany({ where: { key: { startsWith: RUN } } });
  });

  it("records the registration acceptance against the version effective at signup and rejects a stale version", async () => {
    const spec = nextSpec();
    const actor = await createActor();
    const now = new Date();

    const v1 = await createLegalDraft(spec, { contentHtml: "<h2>Điều 1</h2><p>Nội dung {brand} bản 1.</p>", actorId: actor.id });
    await setLegalReviewStatus(spec.key, v1.id, "APPROVED");
    await publishLegalVersion(spec.key, v1.id, { effectiveAt: null, actorId: actor.id, now });

    // Bản 2 đã xuất bản nhưng hiệu lực ngày mai → chưa phải bản hiệu lực.
    const v2 = await createLegalDraft(spec, { contentHtml: "<p>Nội dung bản 2.</p>", actorId: actor.id });
    await setLegalReviewStatus(spec.key, v2.id, "APPROVED");
    await publishLegalVersion(spec.key, v2.id, { effectiveAt: new Date(now.getTime() + 24 * 60 * 60 * 1000), actorId: actor.id, now });
    expect(v2.version).toBe(v1.version + 1);

    const effective = await getEffectiveLegalVersion(spec.key, new Date(now.getTime() + 1000));
    expect(effective?.versionId).toBe(v1.id);
    expect(effective?.contentHtml).toContain("{brand}");

    // Form gửi đúng bản đang hiệu lực (hoặc không gửi) → ghi bản đó; gửi bản khác → 409.
    expect(resolveRegistrationTermsVersion(effective, undefined)).toBe(v1.id);
    expect(() => resolveRegistrationTermsVersion(effective, v2.id)).toThrowError(expect.objectContaining({ code: "LEGAL_TERMS_CHANGED", httpStatus: 409 }));
    expect(resolveRegistrationTermsVersion(null, "whatever")).toBeNull();

    // Cùng giao dịch tạo user như route đăng ký.
    const versionId = resolveRegistrationTermsVersion(effective, v1.id)!;
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: { email: `${EMAIL_PREFIX}_signup@example.com`, passwordHash: "not-used", status: "PENDING", profile: { create: { fullName: "Người thử", consentAt: now } } },
      });
      await recordLegalAcceptance(tx, created.id, versionId, now);
      return created;
    });
    const acceptances = await prisma.userLegalAcceptance.findMany({ where: { userId: user.id } });
    expect(acceptances).toHaveLength(1);
    expect(acceptances[0]!.versionId).toBe(v1.id);
    expect(Object.keys(acceptances[0]!).sort()).toEqual(["acceptedAt", "id", "userId", "versionId"]);

    // Lỗi giữa chừng → rollback cả user lẫn chấp thuận.
    await expect(
      prisma.$transaction(async (tx) => {
        const created = await tx.user.create({ data: { email: `${EMAIL_PREFIX}_rollback@example.com`, passwordHash: "not-used" } });
        await recordLegalAcceptance(tx, created.id, versionId, now);
        throw new Error("simulated failure");
      }),
    ).rejects.toThrow("simulated failure");
    expect(await prisma.user.count({ where: { email: `${EMAIL_PREFIX}_rollback@example.com` } })).toBe(0);

    // Bản đã xuất bản bất biến ở mức DB (trigger).
    await expect(prisma.legalDocumentVersion.update({ where: { id: v1.id }, data: { contentHtml: "<p>sửa lén</p>" } })).rejects.toThrow();
  });

  it("refuses to publish while a placeholder remains or legal review is not approved, and sanitizes content", async () => {
    const spec = nextSpec();
    const actor = await createActor();

    const draft = await createLegalDraft(spec, {
      contentHtml: "<p>Đơn vị vận hành: [[CẦN XÁC NHẬN: tên pháp nhân]]</p><script>alert(1)</script><a href=\"javascript:alert(1)\">x</a>",
      actorId: actor.id,
    });
    expect(draft.contentHtml).not.toContain("<script");
    expect(draft.contentHtml).not.toContain("javascript:");

    // ADR-054 mục 7: link nội bộ (đường dẫn gốc, neo, cùng origin APP_URL) cùng tab, không rel; link ngoài tab mới +
    // noopener noreferrer; target/rel có sẵn trong HTML bị dựng lại; protocol-relative coi là link ngoài.
    const origin = new URL(getEnv().APP_URL).origin;
    const links = await createLegalDraft(nextSpec(), {
      contentHtml: [
        `<p><a href="/chinh-sach-bao-mat" target="_blank" rel="nofollow">bảo mật</a>`,
        `<a href="#muc-2">mục 2</a>`,
        `<a href="${origin}/lien-he">liên hệ</a>`,
        `<a href="https://example.com/luat">luật</a>`,
        `<a href="//evil.example/x">x</a>`,
        `<a href="mailto:hotro@example.com">email</a></p>`,
      ].join(""),
      actorId: actor.id,
    });
    expect(links.contentHtml).toContain(`<a href="/chinh-sach-bao-mat">bảo mật</a>`);
    expect(links.contentHtml).toContain(`<a href="#muc-2">mục 2</a>`);
    expect(links.contentHtml).toContain(`<a href="${origin}/lien-he">liên hệ</a>`);
    expect(links.contentHtml).toContain(`<a href="https://example.com/luat" target="_blank" rel="noopener noreferrer">luật</a>`);
    expect(links.contentHtml).toContain(`<a href="//evil.example/x" target="_blank" rel="noopener noreferrer">x</a>`);
    expect(links.contentHtml).toContain(`<a href="mailto:hotro@example.com">email</a>`);
    expect(links.contentHtml).not.toContain("nofollow");

    // Đã duyệt nhưng còn placeholder → chặn.
    await setLegalReviewStatus(spec.key, draft.id, "APPROVED");
    await expect(publishLegalVersion(spec.key, draft.id, { effectiveAt: null, actorId: actor.id })).rejects.toMatchObject({ code: "LEGAL_PUBLISH_BLOCKED" });

    // Điền placeholder → nội dung đổi nên rà soát quay về PENDING → vẫn chặn.
    const filled = await updateLegalDraft(spec.key, draft.id, { contentHtml: "<p>Đơn vị vận hành: Công ty Thử Nghiệm.</p>" });
    expect(filled.reviewStatus).toBe("PENDING_LEGAL_REVIEW");
    await expect(publishLegalVersion(spec.key, draft.id, { effectiveAt: null, actorId: actor.id })).rejects.toMatchObject({ code: "LEGAL_PUBLISH_BLOCKED" });

    // Không cho lùi ngày hiệu lực về quá khứ.
    await setLegalReviewStatus(spec.key, draft.id, "APPROVED");
    await expect(
      publishLegalVersion(spec.key, draft.id, { effectiveAt: new Date(Date.now() - 24 * 60 * 60 * 1000), actorId: actor.id }),
    ).rejects.toMatchObject({ code: "LEGAL_INVALID_INPUT" });

    // Đủ điều kiện → xuất bản được; xuất bản lần nữa → không còn là nháp.
    const published = await publishLegalVersion(spec.key, draft.id, { effectiveAt: null, actorId: actor.id });
    expect(published.status).toBe("PUBLISHED");
    expect(published.effectiveAt).not.toBeNull();
    await expect(publishLegalVersion(spec.key, draft.id, { effectiveAt: null, actorId: actor.id })).rejects.toMatchObject({ code: "LEGAL_PUBLISH_BLOCKED" });
    expect((await getEffectiveLegalVersion(spec.key, new Date(Date.now() + 1000)))?.versionId).toBe(draft.id);
  });
  it("records terms and privacy acceptance at signup and requires seller policy acceptance when opening a store (ADR-054)", async () => {
    const actor = await createActor();
    const now = new Date();
    async function publishDoc(): Promise<{ spec: LegalDocumentSpec; versionId: string }> {
      const spec = nextSpec();
      const draft = await createLegalDraft(spec, { contentHtml: "<p>Nội dung đã duyệt.</p>", actorId: actor.id });
      await setLegalReviewStatus(spec.key, draft.id, "APPROVED");
      await publishLegalVersion(spec.key, draft.id, { effectiveAt: null, actorId: actor.id, now });
      return { spec, versionId: draft.id };
    }
    const terms = await publishDoc();
    const privacy = await publishDoc();
    const seller = await publishDoc();
    const at = new Date(now.getTime() + 1000);
    const [effTerms, effPrivacy, effSeller] = await Promise.all([
      getEffectiveLegalVersion(terms.spec.key, at),
      getEffectiveLegalVersion(privacy.spec.key, at),
      getEffectiveLegalVersion(seller.spec.key, at),
    ]);

    // Đăng ký: hai văn bản độc lập; bản Bảo mật lệch → 409 mã riêng; văn bản chưa hiệu lực → bỏ qua.
    expect(() => resolveRegistrationPrivacyVersion(effPrivacy, terms.versionId)).toThrowError(expect.objectContaining({ code: "LEGAL_DOCUMENT_CHANGED", httpStatus: 409 }));
    expect(resolveRegistrationPrivacyVersion(null, undefined)).toBeNull();
    const signupIds = [resolveRegistrationTermsVersion(effTerms, terms.versionId), resolveRegistrationPrivacyVersion(effPrivacy, undefined)].filter(
      (id): id is string => id !== null,
    );
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: `${EMAIL_PREFIX}_multi@example.com`,
          passwordHash: "not-used",
          status: "ACTIVE",
          emailVerifiedAt: now,
          profile: { create: { fullName: "Người thử", consentAt: now } },
        },
      });
      await recordLegalAcceptances(tx, created.id, signupIds, now);
      return created;
    });
    const signupRows = await prisma.userLegalAcceptance.findMany({ where: { userId: user.id }, select: { versionId: true } });
    expect(signupRows.map((r) => r.versionId).sort()).toEqual([terms.versionId, privacy.versionId].sort());

    // Mở gian hàng: có bản hiệu lực mà không tích → 400; id lệch → 409; chưa có bản hiệu lực → bỏ qua ô.
    expect(() => resolveSellerPolicyAcceptance(effSeller, { accepted: false, submittedVersionId: seller.versionId })).toThrowError(
      expect.objectContaining({ code: "LEGAL_ACCEPTANCE_REQUIRED", httpStatus: 400 }),
    );
    expect(() => resolveSellerPolicyAcceptance(effSeller, { accepted: true, submittedVersionId: privacy.versionId })).toThrowError(
      expect.objectContaining({ code: "LEGAL_DOCUMENT_CHANGED", httpStatus: 409 }),
    );
    expect(resolveSellerPolicyAcceptance(null, { accepted: false, submittedVersionId: undefined })).toBeNull();
    const sellerId = resolveSellerPolicyAcceptance(effSeller, { accepted: true, submittedVersionId: seller.versionId })!;
    const current = { userId: user.id, familyId: "test-family", role: "USER" as const, emailVerified: true, profileCompleted: true };

    // Tạo gian hàng bị từ chối (slug văn bản pháp lý đã dành riêng) không để lại bản ghi; tạo thành công ghi chấp thuận
    // trong cùng giao dịch, bản đã chấp thuận trước (Điều khoản) được bỏ qua thay vì lỗi unique.
    await expect(createTenantForUser(current, { name: "Gian hàng thử", slug: "lien-he", acceptedLegalVersionIds: [sellerId] })).rejects.toMatchObject({
      code: "SLUG_RESERVED",
    });
    expect(await prisma.userLegalAcceptance.count({ where: { userId: user.id, versionId: sellerId } })).toBe(0);
    await createTenantForUser(current, { name: "Gian hàng thử", slug: `${TENANT_SLUG_PREFIX}-shop`, acceptedLegalVersionIds: [sellerId, terms.versionId] });
    const rows = await prisma.userLegalAcceptance.findMany({ where: { userId: user.id }, select: { versionId: true } });
    expect(rows.map((r) => r.versionId).sort()).toEqual([terms.versionId, privacy.versionId, seller.versionId].sort());
  });
});

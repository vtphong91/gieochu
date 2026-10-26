import { redirect } from "next/navigation";
import { getEnv } from "@gieochu/config";
import { LEGAL_DOCUMENT_DEFS, legalDocumentPath } from "@gieochu/core";
import { getPrismaClient } from "@gieochu/db";
import { requireVerifiedAccess } from "../../lib/page-guards";
import { getEffectiveBrand } from "../../lib/branding";
import { getAcceptanceLegalVersion } from "../../lib/legal";
import { StudioOnboardingForm } from "./onboarding-form";
import { UnsavedChangesProvider } from "../admin/_ui/unsaved-changes";
import { PAPER } from "../(auth)/_ui/colors";

export default async function StudioIndexPage() {
  const user = await requireVerifiedAccess("/studio");

  const prisma = getPrismaClient();
  const existing = await prisma.tenant.findUnique({ where: { ownerId: user.userId } });
  if (existing) {
    redirect(`/studio/${existing.slug}`);
  }

  const [brand, sellerPolicy] = await Promise.all([getEffectiveBrand(), getAcceptanceLegalVersion(LEGAL_DOCUMENT_DEFS.seller.key)]);
  const siteHost = new URL(getEnv().APP_URL).host;

  // ADR-054 mục 5: Chính sách người bán có bản hiệu lực → form hiện ô đồng ý (bắt buộc — server kiểm lại); chưa có → ẩn.
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-16" style={{ background: PAPER }}>
      {/* Trang nằm ngoài layout Studio → tự bọc provider cảnh báo rời trang khi chưa lưu (ADR-058 mục 5). */}
      <UnsavedChangesProvider>
        <StudioOnboardingForm
          brandName={brand.name}
          siteHost={siteHost}
          sellerPolicy={sellerPolicy ? { versionId: sellerPolicy.versionId, href: legalDocumentPath("seller"), title: sellerPolicy.title } : null}
        />
      </UnsavedChangesProvider>
    </main>
  );
}

import { LEGAL_DOCUMENT_DEFS, legalDocumentPath } from "@gieochu/core";
import { getEffectiveBrand } from "../../../lib/branding";
import { getEffectiveLegalVersion } from "../../../lib/legal";
import { RegisterForm } from "./register-form";

export default async function RegisterPage() {
  const [brand, terms, privacy] = await Promise.all([
    getEffectiveBrand(),
    getEffectiveLegalVersion(LEGAL_DOCUMENT_DEFS.terms.key),
    getEffectiveLegalVersion(LEGAL_DOCUMENT_DEFS.privacy.key),
  ]);
  // ADR-050 mục 3 + ADR-054 mục 5: văn bản nào có bản đang hiệu lực → ô đồng ý link tới bản đó + gửi id phiên bản để
  // server ghi chấp thuận (Điều khoản và Chính sách bảo mật độc lập — văn bản chưa hiệu lực thì `null`).
  return (
    <RegisterForm
      brandName={brand.name}
      terms={terms ? { versionId: terms.versionId, href: legalDocumentPath("terms"), title: terms.title } : null}
      privacy={privacy ? { versionId: privacy.versionId, href: legalDocumentPath("privacy"), title: privacy.title } : null}
    />
  );
}

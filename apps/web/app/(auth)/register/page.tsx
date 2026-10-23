import { LEGAL_DOCUMENT_DEFS, legalDocumentPath } from "@gieochu/core";
import { getEffectiveBrand } from "../../../lib/branding";
import { getEffectiveLegalVersion } from "../../../lib/legal";
import { RegisterForm } from "./register-form";

export default async function RegisterPage() {
  const [brand, terms] = await Promise.all([getEffectiveBrand(), getEffectiveLegalVersion(LEGAL_DOCUMENT_DEFS.terms.key)]);
  // ADR-050 mục 3: có bản Điều khoản đang hiệu lực → checkbox link tới bản đó + gửi id phiên bản để server ghi chấp thuận.
  return (
    <RegisterForm
      brandName={brand.name}
      terms={terms ? { versionId: terms.versionId, href: legalDocumentPath("terms"), title: terms.title } : null}
    />
  );
}

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
  // ADR-050 mục 3 + ADR-054 mục 5: văn bản nào có bản đang hiển thị → ô đồng ý link tới trang đó. ADR-057: chỉ gửi id phiên
  // bản (để server ghi chấp thuận) khi đó là bản CHÍNH THỨC; bản dự thảo vẫn link để đọc nhưng `versionId = null` — server
  // cũng tự bỏ qua bản dự thảo (`getAcceptanceLegalVersion`), không tin client.
  const info = (doc: typeof terms, key: "terms" | "privacy") =>
    doc ? { versionId: doc.isDraftRelease ? null : doc.versionId, href: legalDocumentPath(key), title: doc.title } : null;
  return <RegisterForm brandName={brand.name} terms={info(terms, "terms")} privacy={info(privacy, "privacy")} />;
}

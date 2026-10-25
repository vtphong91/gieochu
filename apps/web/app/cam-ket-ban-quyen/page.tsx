import type { Metadata } from "next";
import { LegalDocumentPage, legalDocumentMetadata } from "../_ui/legal-document-page";

// ADR-054: route mỏng cấp gốc cho văn bản pháp lý `copyright` — dữ liệu/bố cục ở `_ui/legal-document-page.tsx`.
// Segment tĩnh thắng `app/[tenantSlug]`; slug nằm trong RESERVED_SLUGS (khai báo ở `LEGAL_DOCUMENT_DEFS`).
export const dynamic = "force-dynamic";

export function generateMetadata(): Promise<Metadata> {
  return legalDocumentMetadata("copyright");
}

export default function Page() {
  return <LegalDocumentPage documentKey="copyright" />;
}

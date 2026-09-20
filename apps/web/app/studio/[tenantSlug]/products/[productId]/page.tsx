import { notFound } from "next/navigation";
import Link from "next/link";
import { AppError } from "@gieochu/core";
import { requireTenantMemberPage } from "../../../../../lib/page-guards";
import { getProduct } from "../../../../../lib/product";
import { getSystemStorageConfig } from "../../../../../lib/system-storage";
import { EditProductForm } from "./edit-form";
import { ProductStatusActions } from "./status-actions";
import { RemoveFileButton } from "./remove-file-button";
import { UploadFileForm } from "./upload-file-form";
import { CoverImageUpload } from "./cover-image-upload";
import { AdminPageHeader, Badge } from "../../../../admin/_ui/kit";
import { IconExternalLink } from "../../../../admin/_ui/icons";

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Nháp",
  PUBLISHED: "Đã xuất bản",
  ARCHIVED: "Đã lưu trữ",
};

const STATUS_TONE: Record<string, "success" | "warning" | "neutral"> = {
  PUBLISHED: "success",
  DRAFT: "warning",
  ARCHIVED: "neutral",
};

/** For a `datetime-local` input's defaultValue — wall-clock time in Asia/Ho_Chi_Minh, no timezone suffix. */
function toDatetimeLocal(date: Date | null): string {
  if (!date) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; productId: string }>;
}) {
  const { tenantSlug, productId } = await params;
  const { tenant } = await requireTenantMemberPage(tenantSlug, `/studio/${tenantSlug}/products/${productId}`);

  let product;
  let files;
  try {
    ({ product, files } = await getProduct(tenant.id, productId));
  } catch (error) {
    if (error instanceof AppError && error.httpStatus === 404) notFound();
    throw error;
  }

  const storageConfig = await getSystemStorageConfig();
  const publicBaseUrl = storageConfig?.publicConfig.publicBaseUrl;
  const coverUrl = product.coverImageKey && publicBaseUrl ? `${publicBaseUrl}/${product.coverImageKey}` : null;

  return (
    <main className="px-5 py-8 lg:px-8">
      <AdminPageHeader
        title={product.title}
        subtitle={`/${product.slug}`}
        action={
          <div className="flex items-center gap-3">
            <Badge tone={STATUS_TONE[product.status] ?? "neutral"}>{STATUS_LABEL[product.status] ?? product.status}</Badge>
            <ProductStatusActions tenantSlug={tenantSlug} productId={productId} status={product.status} />
          </div>
        }
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-[280px_1fr]">
        <div className="space-y-6">
          <section className="rounded-2xl border bg-white p-5" style={{ borderColor: "#E5E7EB" }}>
            <h2 className="font-[family-name:var(--font-heading)] font-semibold" style={{ color: "#12213A" }}>
              Ảnh bìa
            </h2>
            <div className="mt-3">
              <CoverImageUpload tenantSlug={tenantSlug} productId={productId} currentUrl={coverUrl} />
            </div>
          </section>

          <section className="rounded-2xl border bg-white p-5" style={{ borderColor: "#E5E7EB" }}>
            <h2 className="font-[family-name:var(--font-heading)] font-semibold" style={{ color: "#12213A" }}>
              File tài liệu
            </h2>
            <div className="mt-3">
              <UploadFileForm tenantSlug={tenantSlug} productId={productId} />
            </div>
            {files.length > 0 ? (
              <ul className="mt-3 divide-y rounded-lg border text-sm" style={{ borderColor: "#E5E7EB" }}>
                {files.map((file) => (
                  <li key={file.id} className="flex items-center justify-between p-2.5">
                    <span className="min-w-0 truncate text-gray-600" title={file.fileName}>
                      {file.fileName} — {file.scanStatus} {file.isPreview ? "(preview)" : ""}
                    </span>
                    <RemoveFileButton tenantSlug={tenantSlug} productId={productId} fileId={file.id} />
                  </li>
                ))}
              </ul>
            ) : null}
          </section>

          <section className="rounded-2xl border bg-white p-5" style={{ borderColor: "#E5E7EB" }}>
            <h2 className="font-[family-name:var(--font-heading)] font-semibold" style={{ color: "#12213A" }}>
              Link chia sẻ private
            </h2>
            <p className="mt-1 text-sm text-gray-500">Tạo link tải riêng cho một người, không cần đăng nhập.</p>
            <Link
              href={`/studio/${tenantSlug}/products/${productId}/share-links`}
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold"
              style={{ color: "#0F3B82" }}
            >
              Quản lý link chia sẻ <IconExternalLink className="h-3.5 w-3.5" />
            </Link>
          </section>
        </div>

        <EditProductForm
          tenantSlug={tenantSlug}
          productId={productId}
          initial={{
            title: product.title,
            description: product.description ?? "",
            type: product.type,
            tags: product.tags.join(", "),
            priceVnd: product.priceVnd,
            salePriceVnd: product.salePriceVnd?.toString() ?? "",
            saleStartsAt: toDatetimeLocal(product.saleStartsAt),
            saleEndsAt: toDatetimeLocal(product.saleEndsAt),
            downloadLimit: product.downloadLimit,
          }}
        />
      </div>
    </main>
  );
}

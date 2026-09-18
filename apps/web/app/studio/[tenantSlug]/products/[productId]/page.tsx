import { notFound } from "next/navigation";
import { AppError } from "@gieochu/core";
import { requireTenantMemberPage } from "../../../../../lib/page-guards";
import { getProduct } from "../../../../../lib/product";
import { getSystemStorageConfig } from "../../../../../lib/system-storage";
import { EditProductForm } from "./edit-form";
import { ProductStatusActions } from "./status-actions";
import { RemoveFileButton } from "./remove-file-button";
import { UploadFileForm } from "./upload-file-form";
import { CoverImageUpload } from "./cover-image-upload";

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Nháp",
  PUBLISHED: "Đã xuất bản",
  ARCHIVED: "Đã lưu trữ",
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
    <main className="mx-auto max-w-md px-4 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{product.title}</h1>
        <span className="text-sm text-gray-500">{STATUS_LABEL[product.status] ?? product.status}</span>
      </div>
      <p className="mt-1 text-sm text-gray-500">/{product.slug}</p>

      <div className="mt-4">
        <ProductStatusActions tenantSlug={tenantSlug} productId={productId} status={product.status} />
      </div>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Ảnh bìa</h2>
        <div className="mt-3">
          <CoverImageUpload tenantSlug={tenantSlug} productId={productId} currentUrl={coverUrl} />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Thông tin sản phẩm</h2>
        <div className="mt-3">
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
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">File tài liệu</h2>
        <div className="mt-3">
          <UploadFileForm tenantSlug={tenantSlug} productId={productId} />
        </div>
        {files.length > 0 ? (
          <ul className="mt-2 divide-y rounded border text-sm">
            {files.map((file) => (
              <li key={file.id} className="flex items-center justify-between p-2">
                <span>
                  {file.fileName} — {file.scanStatus} {file.isPreview ? "(preview)" : ""}
                </span>
                <RemoveFileButton tenantSlug={tenantSlug} productId={productId} fileId={file.id} />
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </main>
  );
}

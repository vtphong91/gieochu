import { notFound } from "next/navigation";
import { AppError } from "@gieochu/core";
import { requireTenantMemberPage } from "../../../../../lib/page-guards";
import { getProduct } from "../../../../../lib/product";
import { EditProductForm } from "./edit-form";
import { ProductStatusActions } from "./status-actions";

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Nháp",
  PUBLISHED: "Đã xuất bản",
  ARCHIVED: "Đã lưu trữ",
};

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
              downloadLimit: product.downloadLimit,
            }}
          />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">File tài liệu</h2>
        <p className="mt-1 text-sm text-gray-500">
          Chức năng tải file lên đang được hoàn thiện (cần hạ tầng lưu trữ) — sẽ có sớm.
        </p>
        {files.length > 0 ? (
          <ul className="mt-2 divide-y rounded border text-sm">
            {files.map((file) => (
              <li key={file.id} className="p-2">
                {file.fileName} — {file.scanStatus}
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </main>
  );
}

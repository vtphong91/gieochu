import Link from "next/link";
import { requireTenantMemberPage } from "../../../../lib/page-guards";
import { listProducts } from "../../../../lib/product";
import { AdminPageHeader, Badge, DataTable, EmptyState, PrimaryLinkButton, Td, Tr } from "../../../admin/_ui/kit";
import { IconPackage, IconPlus } from "../../../admin/_ui/icons";
import { ProductRowActions } from "./_ui/product-row-actions";

/** Nhãn theo ADR-027 (hiển thị): DRAFT = Riêng tư, PUBLISHED = Công khai. */
const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Riêng tư",
  PUBLISHED: "Công khai",
  ARCHIVED: "Đã lưu trữ",
};

const STATUS_TONE: Record<string, "success" | "warning" | "neutral"> = {
  PUBLISHED: "success",
  DRAFT: "warning",
  ARCHIVED: "neutral",
};

export default async function StudioProductsPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;
  const { tenant } = await requireTenantMemberPage(tenantSlug, `/studio/${tenantSlug}/products`);

  const products = await listProducts(tenant.id);

  return (
    <main className="px-5 py-8 lg:px-8">
      <AdminPageHeader
        title="Sản phẩm"
        subtitle="Quản lý tài liệu — riêng tư, công khai, lưu trữ."
        action={
          <PrimaryLinkButton href={`/studio/${tenantSlug}/products/new`}>
            <IconPlus className="h-4 w-4" /> Tạo sản phẩm
          </PrimaryLinkButton>
        }
      />

      {products.length === 0 ? (
        <div className="mt-6">
          <EmptyState icon={<IconPackage className="h-6 w-6" />} title="Chưa có sản phẩm nào" description="Tạo sản phẩm đầu tiên để bắt đầu bán tài liệu." />
        </div>
      ) : (
        <div className="mt-6">
          <DataTable
            head={["Sản phẩm", "Đường dẫn", "Trạng thái", "Thao tác"]}
            headClassName={[undefined, "hidden md:table-cell", "hidden sm:table-cell", "text-right"]}
          >
            {products.map((product) => {
              const badge = (
                <Badge tone={STATUS_TONE[product.status] ?? "neutral"}>{STATUS_LABEL[product.status] ?? product.status}</Badge>
              );
              return (
                <Tr key={product.id}>
                  <Td>
                    <Link
                      href={`/studio/${tenantSlug}/products/${product.id}`}
                      className="font-medium [overflow-wrap:anywhere] hover:underline"
                    >
                      {product.title}
                    </Link>
                    {/* Mobile: cột Trạng thái ẩn — hiện badge ngay dưới tên. */}
                    <div className="mt-1.5 sm:hidden">{badge}</div>
                  </Td>
                  <Td className="hidden font-mono text-xs text-gray-500 md:table-cell">/{product.slug}</Td>
                  <Td className="hidden sm:table-cell">{badge}</Td>
                  <Td className="text-right">
                    <ProductRowActions
                      tenantSlug={tenantSlug}
                      productId={product.id}
                      productSlug={product.slug}
                      title={product.title}
                      status={product.status}
                    />
                  </Td>
                </Tr>
              );
            })}
          </DataTable>
        </div>
      )}
    </main>
  );
}

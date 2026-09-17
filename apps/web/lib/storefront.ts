import { getPrismaClient, withPublic } from "@gieochu/db";

/**
 * §4.3 storefront resolution: not tenant-scoped (we don't know the tenant id
 * yet), and RLS is not enabled on `tenants` itself — only child tables like
 * `products` are tenant-scoped/RLS-protected. A plain unique lookup is safe.
 */
export async function findTenantBySlugForStorefront(slug: string) {
  const prisma = getPrismaClient();
  return prisma.tenant.findUnique({ where: { slug } });
}

/** §4.3: resolves a renamed slug (changed ≤ 1×/30 days) to a 301 target. */
export async function findSlugRedirectTarget(oldSlug: string): Promise<string | null> {
  const prisma = getPrismaClient();
  const history = await prisma.tenantSlugHistory.findUnique({
    where: { oldSlug },
    include: { tenant: true },
  });
  return history?.tenant.slug ?? null;
}

export interface PublicProduct {
  id: string;
  slug: string;
  title: string;
}

/**
 * Goes through withPublic so the RLS policy on `products` — which requires
 * app.scope='public' AND status='PUBLISHED' — is the actual gate, not just
 * this query's WHERE clause.
 */
export async function getPublishedProducts(tenantId: string): Promise<PublicProduct[]> {
  return withPublic((tx) =>
    tx.product.findMany({
      where: { tenantId, status: "PUBLISHED" },
      select: { id: true, slug: true, title: true },
      orderBy: { createdAt: "desc" },
    }),
  );
}

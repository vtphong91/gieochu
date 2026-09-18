import { getPrismaClient } from "@gieochu/db";

/** Active plans shown on the public /pricing page, cheapest first. */
export async function getActivePlans() {
  const prisma = getPrismaClient();
  return prisma.plan.findMany({ where: { isActive: true }, orderBy: { priceVnd: "asc" } });
}

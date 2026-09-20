import { getPrismaClient, type DocumentCategory } from "@gieochu/db";
import { AppError, slugify, suggestSlug } from "@gieochu/core";

export interface DocumentCategoryInput {
  name: string;
  slug?: string;
  shortDescription?: string;
  description?: string;
  imageUrl?: string;
  seoTitle?: string;
  seoDescription?: string;
  ogImageUrl?: string;
}

export async function listDocumentCategories({ skip, take }: { skip: number; take: number }): Promise<DocumentCategory[]> {
  const prisma = getPrismaClient();
  return prisma.documentCategory.findMany({ orderBy: { name: "asc" }, skip, take });
}

export async function countDocumentCategories(): Promise<number> {
  const prisma = getPrismaClient();
  return prisma.documentCategory.count();
}

export async function getDocumentCategory(id: string): Promise<DocumentCategory | null> {
  const prisma = getPrismaClient();
  return prisma.documentCategory.findUnique({ where: { id } });
}

/** §"Danh mục tài liệu": gợi ý slug theo tên, tránh trùng — cùng mẫu suggestSlug đã dùng cho Product/Tenant. */
export async function createDocumentCategory(input: DocumentCategoryInput): Promise<DocumentCategory> {
  const prisma = getPrismaClient();
  const base = slugify(input.slug?.trim() || input.name);
  if (!base) {
    throw new AppError({ code: "INVALID_SLUG", message: "Không tạo được đường dẫn từ tên danh mục.", httpStatus: 400 });
  }
  const existing = await prisma.documentCategory.findMany({ select: { slug: true } });
  const slug = suggestSlug(
    base,
    existing.map((c) => c.slug),
  );
  return prisma.documentCategory.create({ data: { ...input, slug } });
}

export async function updateDocumentCategory(id: string, input: DocumentCategoryInput): Promise<DocumentCategory> {
  const prisma = getPrismaClient();
  return prisma.documentCategory.update({ where: { id }, data: input });
}

export async function toggleDocumentCategoryActive(id: string): Promise<DocumentCategory> {
  const prisma = getPrismaClient();
  const category = await prisma.documentCategory.findUniqueOrThrow({ where: { id } });
  return prisma.documentCategory.update({ where: { id }, data: { isActive: !category.isActive } });
}

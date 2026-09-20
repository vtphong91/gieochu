"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isValidCmsBlocks } from "@gieochu/core";
import { getPrismaClient } from "@gieochu/db";
import { requireRole } from "../../../lib/session";

const cmsFormSchema = z.object({
  slug: z.string().trim().min(1),
  title: z.string().trim().min(1),
  blocksJson: z.string().trim().min(1),
  seoTitle: z.string().trim().optional(),
  seoDescription: z.string().trim().optional(),
  status: z.enum(["DRAFT", "PUBLISHED"]),
});

export interface CmsActionState {
  error?: string;
}

export async function saveCmsPageAction(_prevState: CmsActionState, formData: FormData): Promise<CmsActionState> {
  await requireRole("SYSTEM_ADMIN");

  const parsed = cmsFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: "Dữ liệu không hợp lệ." };
  }

  let blocks: unknown;
  try {
    blocks = JSON.parse(parsed.data.blocksJson);
  } catch {
    return { error: "Nội dung block phải là JSON hợp lệ." };
  }
  if (!isValidCmsBlocks(blocks)) {
    return { error: "Cấu trúc block không hợp lệ (chỉ chấp nhận hero/features/stats/testimonials/pricingTable/faq/richText/cta)." };
  }

  const prisma = getPrismaClient();
  await prisma.cmsPage.upsert({
    where: { slug: parsed.data.slug },
    update: {
      title: parsed.data.title,
      blocks: blocks as object,
      seoTitle: parsed.data.seoTitle || null,
      seoDescription: parsed.data.seoDescription || null,
      status: parsed.data.status,
    },
    create: {
      slug: parsed.data.slug,
      title: parsed.data.title,
      blocks: blocks as object,
      seoTitle: parsed.data.seoTitle || null,
      seoDescription: parsed.data.seoDescription || null,
      status: parsed.data.status,
    },
  });

  revalidatePath("/admin/cms");
  revalidatePath(`/p/${parsed.data.slug}`);
  revalidatePath("/");
  redirect("/admin/cms");
}

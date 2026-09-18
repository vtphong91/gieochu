import { z } from "zod";

/**
 * §"M2" CMS block schema: hero, features, pricingTable (sourced from
 * `plans`), faq, richText, cta — all optional, unknown extra keys rejected
 * so the editor can't silently save typo'd block names.
 */
export const cmsBlocksSchema = z
  .object({
    hero: z
      .object({
        title: z.string().min(1),
        subtitle: z.string().optional(),
      })
      .optional(),
    features: z
      .array(
        z.object({
          title: z.string().min(1),
          description: z.string().optional(),
        }),
      )
      .optional(),
    pricingTable: z.object({ source: z.literal("plans") }).optional(),
    faq: z
      .array(
        z.object({
          question: z.string().min(1),
          answer: z.string().min(1),
        }),
      )
      .optional(),
    richText: z.string().optional(),
    cta: z
      .object({
        label: z.string().min(1),
        href: z.string().min(1),
      })
      .optional(),
  })
  .strict();

export function isValidCmsBlocks(input: unknown): boolean {
  return cmsBlocksSchema.safeParse(input).success;
}

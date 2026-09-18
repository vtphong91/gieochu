import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "node:url";
import * as argon2 from "argon2";
import { getPrismaClient } from "../src/client";

// Monorepo has a single root .env, not one per package (see prisma.config.ts).
loadEnv({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });

const SEED_ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? "admin@gieochu.net";
const SEED_ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe123!";

async function main() {
  const prisma = getPrismaClient();

  const passwordHash = await argon2.hash(SEED_ADMIN_PASSWORD, { type: argon2.argon2id });
  await prisma.user.upsert({
    where: { email: SEED_ADMIN_EMAIL },
    update: { isSuperAdmin: true },
    create: {
      email: SEED_ADMIN_EMAIL,
      passwordHash,
      systemRole: "SYSTEM_ADMIN",
      status: "ACTIVE",
      isSuperAdmin: true,
      emailVerifiedAt: new Date(),
      profileCompletedAt: new Date(),
    },
  });
  console.log(`[seed] super admin ready: ${SEED_ADMIN_EMAIL} (dev password: ${SEED_ADMIN_PASSWORD})`);

  await prisma.systemSettings.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      platformName: process.env.APP_NAME ?? "Gieo Chữ",
      supportEmail: process.env.SEED_SUPPORT_EMAIL ?? "support@gieochu.net",
      trialDays: Number(process.env.TRIAL_DAYS ?? 14),
      graceDays: Number(process.env.GRACE_DAYS ?? 7),
    },
  });
  console.log("[seed] system settings ready");

  const plans = [
    {
      code: "STARTER",
      name: "Khởi đầu",
      priceVnd: 0,
      interval: "MONTH" as const,
      intervalCount: 1,
      maxProducts: 5,
      storageMb: 500,
      maxFileMb: 50,
    },
    {
      code: "PRO_MONTHLY",
      name: "Chuyên nghiệp",
      priceVnd: 199_000,
      interval: "MONTH" as const,
      intervalCount: 1,
      maxProducts: 50,
      storageMb: 5_000,
      maxFileMb: 200,
    },
    {
      code: "PRO_YEARLY",
      name: "Chuyên nghiệp (năm)",
      priceVnd: 1_990_000,
      interval: "YEAR" as const,
      intervalCount: 1,
      maxProducts: 50,
      storageMb: 5_000,
      maxFileMb: 200,
    },
  ];

  for (const plan of plans) {
    await prisma.plan.upsert({
      where: { code: plan.code },
      update: plan,
      create: plan,
    });
  }
  console.log(`[seed] ${plans.length} plans ready`);

  await prisma.cmsPage.upsert({
    where: { slug: "home" },
    update: {},
    create: {
      slug: "home",
      title: "Gieo Chữ – Nơi người dạy gieo chữ và chia sẻ học liệu",
      status: "PUBLISHED",
      seoTitle: "Gieo Chữ – Nền tảng bán học liệu cho giáo viên",
      seoDescription: "Mở trang bán tài liệu số của riêng bạn: template, slide bài giảng, ebook, bộ đề.",
      blocks: {
        hero: {
          title: "Gieo Chữ",
          subtitle: "Gieo Chữ – Nơi người dạy gieo chữ và chia sẻ học liệu.",
        },
        features: [],
        pricingTable: { source: "plans" },
        faq: [],
      },
    },
  });
  console.log("[seed] CMS home page ready");
}

main()
  .catch((error) => {
    console.error("[seed] failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await getPrismaClient().$disconnect();
  });

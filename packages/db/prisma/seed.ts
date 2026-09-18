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
  const admin = await prisma.user.upsert({
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
  // `isProfileComplete()` (packages/auth) checks the UserProfile row itself,
  // not `User.profileCompletedAt` — without this the seeded admin logs in
  // fine but gets redirected to /account/profile, and submitting that form
  // then fails (`userProfile.update` on a row that doesn't exist yet).
  await prisma.userProfile.upsert({
    where: { userId: admin.id },
    update: {},
    create: {
      userId: admin.id,
      fullName: "System Admin",
      phone: "0900000000",
      occupation: "Quản trị hệ thống",
      province: "Hà Nội",
      consentAt: new Date(),
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

  // §"M3 v2" ADR-021 — Hybrid Monetization: FREE is a real, non-expiring plan every new
  // tenant gets (createTenantForUser reads isFree:true), not a time-boxed trial. Numbers here
  // are seed defaults only — every field is editable afterwards via /admin/plans.
  const plans = [
    {
      code: "FREE",
      name: "Free",
      priceVnd: 0,
      interval: "MONTH" as const,
      intervalCount: 1,
      maxProducts: 5,
      storageMb: 500,
      maxFileMb: 50,
      isFree: true,
      features: {},
    },
    {
      code: "CREATOR",
      name: "Creator",
      priceVnd: 99_000,
      interval: "MONTH" as const,
      intervalCount: 1,
      maxProducts: 50,
      storageMb: 5_000,
      maxFileMb: 250,
      isFree: false,
      features: { coupons: true, advancedAnalytics: true, advancedBranding: true },
    },
    {
      code: "PRO",
      name: "Pro",
      priceVnd: 199_000,
      interval: "MONTH" as const,
      intervalCount: 1,
      maxProducts: 200,
      storageMb: 20_000,
      maxFileMb: 1_000,
      isFree: false,
      features: { coupons: true, advancedAnalytics: true, advancedBranding: true, seoTools: true, automation: true },
    },
    {
      code: "BUSINESS",
      name: "Business",
      priceVnd: 499_000,
      interval: "MONTH" as const,
      intervalCount: 1,
      maxProducts: 1_000,
      storageMb: 100_000,
      maxFileMb: 2_000,
      isFree: false,
      features: { coupons: true, advancedAnalytics: true, advancedBranding: true, seoTools: true, automation: true, customDomain: true },
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

  // §"M7": NAPAS/VietQR BIN list, verified against vietqr.co/banks before seeding.
  const bankBins = [
    { bin: "970405", name: "Ngân hàng Nông nghiệp và Phát triển Nông thôn Việt Nam", shortName: "Agribank" },
    { bin: "970415", name: "Ngân hàng TMCP Công Thương Việt Nam", shortName: "VietinBank" },
    { bin: "970436", name: "Ngân hàng TMCP Ngoại Thương Việt Nam", shortName: "Vietcombank" },
    { bin: "970418", name: "Ngân hàng TMCP Đầu tư và Phát triển Việt Nam", shortName: "BIDV" },
    { bin: "970403", name: "Ngân hàng TMCP Sài Gòn Thương Tín", shortName: "Sacombank" },
    { bin: "970407", name: "Ngân hàng TMCP Kỹ thương Việt Nam", shortName: "Techcombank" },
    { bin: "970422", name: "Ngân hàng TMCP Quân đội", shortName: "MB Bank" },
    { bin: "970423", name: "Ngân hàng TMCP Tiên Phong", shortName: "TPBank" },
    { bin: "970425", name: "Ngân hàng TMCP An Bình", shortName: "ABBANK" },
    { bin: "970426", name: "Ngân hàng TMCP Hàng Hải", shortName: "MSB" },
    { bin: "970416", name: "Ngân hàng TMCP Á Châu", shortName: "ACB" },
    { bin: "970429", name: "Ngân hàng TMCP Sài Gòn", shortName: "SCB" },
    { bin: "970431", name: "Ngân hàng TMCP Xuất Nhập khẩu Việt Nam", shortName: "Eximbank" },
    { bin: "970432", name: "Ngân hàng TMCP Việt Nam Thịnh Vượng", shortName: "VPBank" },
    { bin: "970437", name: "Ngân hàng TMCP Phát triển Thành phố Hồ Chí Minh", shortName: "HDBank" },
    { bin: "970440", name: "Ngân hàng TMCP Đông Nam Á", shortName: "SeABank" },
    { bin: "970441", name: "Ngân hàng TMCP Quốc tế Việt Nam", shortName: "VIB" },
    { bin: "970443", name: "Ngân hàng TMCP Sài Gòn - Hà Nội", shortName: "SHB" },
    { bin: "970448", name: "Ngân hàng TMCP Phương Đông", shortName: "OCB" },
  ];

  for (const bank of bankBins) {
    await prisma.bankBin.upsert({ where: { bin: bank.bin }, update: bank, create: bank });
  }
  console.log(`[seed] ${bankBins.length} bank BINs ready`);
}

main()
  .catch((error) => {
    console.error("[seed] failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await getPrismaClient().$disconnect();
  });

-- CreateEnum
CREATE TYPE "CouponType" AS ENUM ('PERCENT', 'FIXED');

-- CreateTable
CREATE TABLE "coupons" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "CouponType" NOT NULL,
    "value" INTEGER NOT NULL,
    "maxDiscountVnd" INTEGER,
    "minOrderVnd" INTEGER,
    "usageLimit" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "perCustomerLimit" INTEGER,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "productIds" JSONB,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coupons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupon_redemptions" (
    "id" TEXT NOT NULL,
    "couponId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coupon_redemptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "coupons_tenantId_idx" ON "coupons"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "coupons_tenantId_code_key" ON "coupons"("tenantId", "code");

-- CreateIndex
CREATE INDEX "coupon_redemptions_tenantId_idx" ON "coupon_redemptions"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "coupon_redemptions_couponId_orderId_key" ON "coupon_redemptions"("couponId", "orderId");

-- AddForeignKey
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "coupons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "system_branding" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "logoLightUrl" TEXT,
    "logoDarkUrl" TEXT,
    "logoSquareUrl" TEXT,
    "logoSidebarUrl" TEXT,
    "logoFooterUrl" TEXT,
    "faviconUrl" TEXT,
    "ogImageUrl" TEXT,
    "brandName" TEXT,
    "brandSlogan" TEXT,
    "primaryColorHex" TEXT,
    "accentColorHex" TEXT,
    "secondaryColorHex" TEXT,
    "navbarLogoHeightPx" INTEGER NOT NULL DEFAULT 40,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_branding_pkey" PRIMARY KEY ("id")
);

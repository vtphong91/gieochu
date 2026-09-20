-- AlterTable
ALTER TABLE "cms_pages" ADD COLUMN     "blocksDraft" JSONB;

-- CreateTable
CREATE TABLE "system_cloudinary_config" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "publicConfig" JSONB NOT NULL,
    "encryptedSecrets" TEXT NOT NULL,
    "lastVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_cloudinary_config_pkey" PRIMARY KEY ("id")
);

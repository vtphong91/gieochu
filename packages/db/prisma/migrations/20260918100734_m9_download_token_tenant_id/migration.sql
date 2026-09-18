/*
  Warnings:

  - Added the required column `tenantId` to the `download_tokens` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "download_tokens" ADD COLUMN     "tenantId" TEXT NOT NULL;

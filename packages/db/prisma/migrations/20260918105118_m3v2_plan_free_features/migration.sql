-- AlterTable
ALTER TABLE "plans" ADD COLUMN     "features" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "isFree" BOOLEAN NOT NULL DEFAULT false;

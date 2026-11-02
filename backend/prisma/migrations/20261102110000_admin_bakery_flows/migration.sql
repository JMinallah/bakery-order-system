-- AlterEnum
ALTER TYPE "CancelledBy" ADD VALUE 'SYSTEM';

-- AlterTable
ALTER TABLE "Bakery" ADD COLUMN     "isPublished" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "quoteExpiryDays" INTEGER NOT NULL DEFAULT 7;

-- Bakeries that already exist were set up before publishing existed, so they stay visible.
UPDATE "Bakery" SET "isPublished" = true;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailVerified" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "BakeryInvite" (
    "id" TEXT NOT NULL,
    "bakeryId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "MemberRole" NOT NULL DEFAULT 'STAFF',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BakeryInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BakeryInvite_email_idx" ON "BakeryInvite"("email");

-- CreateIndex
CREATE UNIQUE INDEX "BakeryInvite_bakeryId_email_key" ON "BakeryInvite"("bakeryId", "email");

-- AddForeignKey
ALTER TABLE "BakeryInvite" ADD CONSTRAINT "BakeryInvite_bakeryId_fkey" FOREIGN KEY ("bakeryId") REFERENCES "Bakery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

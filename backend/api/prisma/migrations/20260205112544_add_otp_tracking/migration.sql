-- DropForeignKey
ALTER TABLE "UserNotification" DROP CONSTRAINT "UserNotification_userId_fkey";

-- AlterTable
ALTER TABLE "CustomerLinkToken" ADD COLUMN     "lastOtpSentAt" TIMESTAMP(3),
ADD COLUMN     "otpSentCount" INTEGER NOT NULL DEFAULT 0;

-- AddForeignKey
ALTER TABLE "UserNotification" ADD CONSTRAINT "UserNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

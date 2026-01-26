-- AlterTable
ALTER TABLE "CustomerLinkToken" ADD COLUMN     "whatsapp" TEXT,
ALTER COLUMN "email" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "clientWhatsapp" TEXT;

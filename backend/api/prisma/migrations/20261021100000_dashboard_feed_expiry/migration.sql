ALTER TABLE "UserNotification"
ADD COLUMN "dismissedAt" TIMESTAMP(3);

CREATE INDEX "UserNotification_userId_createdAt_idx"
ON "UserNotification"("userId", "createdAt");

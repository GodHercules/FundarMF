ALTER TABLE "CustomerLinkToken"
  ADD COLUMN "otpFailedAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "otpBlockedUntil" TIMESTAMP(3);

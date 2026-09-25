ALTER TABLE "Session" ADD COLUMN "tenantKey" TEXT NOT NULL DEFAULT 'default';
ALTER TABLE "CustomerLinkToken" ADD COLUMN "tenantKey" TEXT NOT NULL DEFAULT 'default';

CREATE INDEX "CustomerLinkToken_tenantKey_email_usedAt_tokenExpiresAt_createdAt_idx"
ON "CustomerLinkToken"("tenantKey", "email", "usedAt", "tokenExpiresAt", "createdAt" DESC);

CREATE INDEX "CustomerLinkToken_tenantKey_whatsapp_usedAt_tokenExpiresAt_createdAt_idx"
ON "CustomerLinkToken"("tenantKey", "whatsapp", "usedAt", "tokenExpiresAt", "createdAt" DESC);

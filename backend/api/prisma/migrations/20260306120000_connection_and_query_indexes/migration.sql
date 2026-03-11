-- Improve token/session lookups and operational feed scans
CREATE INDEX IF NOT EXISTS "CustomerLinkToken_email_usedAt_tokenExpiresAt_createdAt_idx"
  ON "CustomerLinkToken"("email", "usedAt", "tokenExpiresAt", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "CustomerLinkToken_whatsapp_usedAt_tokenExpiresAt_createdAt_idx"
  ON "CustomerLinkToken"("whatsapp", "usedAt", "tokenExpiresAt", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "Session_expiresAt_idx"
  ON "Session"("expiresAt");

CREATE INDEX IF NOT EXISTS "Notification_createdAt_channel_status_idx"
  ON "Notification"("createdAt" DESC, "channel", "status");

CREATE INDEX IF NOT EXISTS "AuditEvent_createdAt_entity_action_idx"
  ON "AuditEvent"("createdAt" DESC, "entity", "action");

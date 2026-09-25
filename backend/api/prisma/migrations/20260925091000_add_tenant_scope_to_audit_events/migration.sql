ALTER TABLE "AuditEvent" ADD COLUMN "tenantKey" TEXT NOT NULL DEFAULT 'default';

CREATE INDEX "AuditEvent_tenantKey_createdAt_entity_action_idx"
ON "AuditEvent"("tenantKey", "createdAt" DESC, "entity", "action");

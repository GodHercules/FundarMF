-- CreateIndex
CREATE INDEX "Process_ownerId_createdAt_idx" ON "Process"("ownerId", "createdAt");

-- CreateIndex
CREATE INDEX "Process_clientEmail_createdAt_idx" ON "Process"("clientEmail", "createdAt");

-- CreateIndex
CREATE INDEX "Process_clientPhone_createdAt_idx" ON "Process"("clientPhone", "createdAt");

-- CreateIndex
CREATE INDEX "Process_status_createdAt_idx" ON "Process"("status", "createdAt");

-- Indexes for the hottest read paths: documents, chat, SLA scans, reports and assignment history.
CREATE INDEX "DocumentFile_itemId_createdAt_idx" ON "DocumentFile"("itemId", "createdAt");
CREATE INDEX "ChatMessage_threadId_createdAt_idx" ON "ChatMessage"("threadId", "createdAt");
CREATE INDEX "ProcessOwnerHistory_ownerId_assignedAt_idx" ON "ProcessOwnerHistory"("ownerId", "assignedAt");
CREATE INDEX "ProcessOwnerHistory_processId_assignedAt_idx" ON "ProcessOwnerHistory"("processId", "assignedAt");
CREATE INDEX "SlaEvent_status_dueAt_idx" ON "SlaEvent"("status", "dueAt");
CREATE INDEX "Report_processId_createdAt_idx" ON "Report"("processId", "createdAt" DESC);

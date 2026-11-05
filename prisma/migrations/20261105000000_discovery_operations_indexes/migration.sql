-- Additive indexes only. No data changes, default retention or personal deletion.
CREATE INDEX "RecommendationSession_status_updatedAt_idx" ON "RecommendationSession"("status", "updatedAt");
CREATE INDEX "recommendation_session_resume_idx" ON "RecommendationSession"("userId", "status", "lastOpenedAt" DESC NULLS LAST, "createdAt" DESC, "id" DESC);
CREATE INDEX "RecommendationItem_exposedAt_idx" ON "RecommendationItem"("exposedAt");

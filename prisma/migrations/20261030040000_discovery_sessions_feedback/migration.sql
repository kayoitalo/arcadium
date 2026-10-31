-- Additive only: null means legacy progress/provenance is unknown.
BEGIN;
ALTER TABLE "RecommendationSession"
  ADD COLUMN "currentRank" INTEGER,
  ADD COLUMN "requestKey" TEXT,
  ADD COLUMN "requestFingerprint" TEXT;
ALTER TABLE "RecommendationItem" ADD COLUMN "exposedAt" TIMESTAMP(3);
ALTER TABLE "RecommendationFeedback"
  ADD COLUMN "channel" TEXT,
  ADD COLUMN "revision" INTEGER,
  ADD COLUMN "requestKey" TEXT,
  ADD COLUMN "revisesId" TEXT,
  ADD COLUMN "details" JSONB,
  ADD COLUMN "entity" JSONB;
CREATE UNIQUE INDEX "RecommendationSession_userId_requestKey_key"
  ON "RecommendationSession"("userId", "requestKey");
CREATE UNIQUE INDEX "RecommendationFeedback_itemId_userId_requestKey_key"
  ON "RecommendationFeedback"("itemId", "userId", "requestKey");
CREATE UNIQUE INDEX "RecommendationFeedback_itemId_userId_revision_key"
  ON "RecommendationFeedback"("itemId", "userId", "revision");
COMMIT;

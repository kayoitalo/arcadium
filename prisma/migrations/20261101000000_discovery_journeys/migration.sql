-- Additive: old sessions retain unknown intent/journey metadata.
ALTER TABLE "RecommendationSession"
  ADD COLUMN "discoveryContext" JSONB,
  ADD COLUMN "lastOpenedAt" TIMESTAMP(3);

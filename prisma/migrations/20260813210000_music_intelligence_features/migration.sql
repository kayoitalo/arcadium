-- Extend canonical music metadata
ALTER TABLE "Artist"
ADD COLUMN "country" TEXT,
ADD COLUMN "type" TEXT,
ADD COLUMN "disambiguation" TEXT,
ADD COLUMN "tags" TEXT,
ADD COLUMN "enrichedAt" TIMESTAMP(3);

ALTER TABLE "Track" ADD COLUMN "enrichedAt" TIMESTAMP(3);

ALTER TABLE "Album"
ADD COLUMN "primaryType" TEXT,
ADD COLUMN "enrichedAt" TIMESTAMP(3);

CREATE INDEX "Artist_metadataStatus_idx" ON "Artist"("metadataStatus");

-- Recommendation engine
CREATE TABLE "RecommendationSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "context" TEXT,
    "profilePeriod" TEXT NOT NULL DEFAULT '30d',
    "algorithmVersion" TEXT NOT NULL DEFAULT 'v1',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RecommendationSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RecommendationItem" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "artistName" TEXT NOT NULL,
    "trackName" TEXT NOT NULL,
    "albumName" TEXT,
    "genre" TEXT,
    "score" DOUBLE PRECISION NOT NULL,
    "noveltyScore" DOUBLE PRECISION,
    "scoreComponents" JSONB,
    "rank" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "artistId" TEXT,
    "trackId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RecommendationItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RecommendationFeedback" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RecommendationFeedback_pkey" PRIMARY KEY ("id")
);

-- AI analysis audit
CREATE TABLE "AIAnalysisRun" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'gemini',
    "model" TEXT,
    "promptVersion" TEXT NOT NULL DEFAULT 'v1',
    "inputHash" TEXT,
    "validatedOutput" JSONB,
    "rawOutput" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "tokenCount" INTEGER,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AIAnalysisRun_pkey" PRIMARY KEY ("id")
);

-- Playlist exports
CREATE TABLE "PlaylistExport" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "providerPlaylistId" TEXT,
    "playlistUrl" TEXT,
    "mode" TEXT NOT NULL,
    "selectedItemIds" JSONB,
    "totalItems" INTEGER NOT NULL DEFAULT 0,
    "resolvedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlaylistExport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RecommendationSession_userId_createdAt_idx" ON "RecommendationSession"("userId", "createdAt" DESC);
CREATE INDEX "RecommendationItem_sessionId_rank_idx" ON "RecommendationItem"("sessionId", "rank");
CREATE INDEX "RecommendationFeedback_userId_createdAt_idx" ON "RecommendationFeedback"("userId", "createdAt" DESC);
CREATE INDEX "RecommendationFeedback_itemId_idx" ON "RecommendationFeedback"("itemId");
CREATE INDEX "AIAnalysisRun_userId_kind_createdAt_idx" ON "AIAnalysisRun"("userId", "kind", "createdAt" DESC);
CREATE INDEX "AIAnalysisRun_inputHash_idx" ON "AIAnalysisRun"("inputHash");
CREATE INDEX "PlaylistExport_userId_createdAt_idx" ON "PlaylistExport"("userId", "createdAt" DESC);

ALTER TABLE "RecommendationSession" ADD CONSTRAINT "RecommendationSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecommendationItem" ADD CONSTRAINT "RecommendationItem_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "RecommendationSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecommendationFeedback" ADD CONSTRAINT "RecommendationFeedback_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "RecommendationItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecommendationFeedback" ADD CONSTRAINT "RecommendationFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AIAnalysisRun" ADD CONSTRAINT "AIAnalysisRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlaylistExport" ADD CONSTRAINT "PlaylistExport_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "RecommendationSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlaylistExport" ADD CONSTRAINT "PlaylistExport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

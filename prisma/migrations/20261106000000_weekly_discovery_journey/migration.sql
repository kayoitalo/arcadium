CREATE TABLE "WeeklyJourney" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekKey" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "selectorVersion" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "lease" TEXT,
    "retryAt" TIMESTAMP(3),
    "personalized" BOOLEAN NOT NULL DEFAULT false,
    "diagnostics" JSONB,
    "narrativeStatus" TEXT,
    "narrative" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WeeklyJourney_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WeeklyJourneyEntry" (
    "id" TEXT NOT NULL,
    "journeyId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "artistKey" TEXT NOT NULL,
    "albumKey" TEXT,
    "snapshot" JSONB NOT NULL,
    "exposedAt" TIMESTAMP(3),
    "sessionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WeeklyJourneyEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WeeklyJourney_userId_weekKey_key" ON "WeeklyJourney"("userId", "weekKey");
CREATE INDEX "WeeklyJourney_userId_startsAt_idx" ON "WeeklyJourney"("userId", "startsAt" DESC);
CREATE UNIQUE INDEX "WeeklyJourneyEntry_journeyId_position_key" ON "WeeklyJourneyEntry"("journeyId", "position");
CREATE UNIQUE INDEX "WeeklyJourneyEntry_sessionId_key" ON "WeeklyJourneyEntry"("sessionId");
ALTER TABLE "WeeklyJourney" ADD CONSTRAINT "WeeklyJourney_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WeeklyJourneyEntry" ADD CONSTRAINT "WeeklyJourneyEntry_journeyId_fkey" FOREIGN KEY ("journeyId") REFERENCES "WeeklyJourney"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WeeklyJourneyEntry" ADD CONSTRAINT "WeeklyJourneyEntry_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "RecommendationSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

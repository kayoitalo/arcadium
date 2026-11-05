CREATE TABLE "DiscoveryEvent" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "itemId" TEXT NOT NULL, "requestKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "DiscoveryEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DiscoveryEvent_userId_requestKey_key" ON "DiscoveryEvent"("userId", "requestKey");
CREATE INDEX "DiscoveryEvent_itemId_createdAt_idx" ON "DiscoveryEvent"("itemId", "createdAt" DESC);
ALTER TABLE "DiscoveryEvent" ADD CONSTRAINT "DiscoveryEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DiscoveryEvent" ADD CONSTRAINT "DiscoveryEvent_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "RecommendationItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
